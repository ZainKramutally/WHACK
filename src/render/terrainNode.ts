// GPU terrain: the same height formula as src/gen/terrain.ts `heightCore`, written as a TSL node.
// MIRROR RULE: every block below matches the block of the same name in heightCore, line for line.
// EXCEPTION: the M7 basalt pillar term is left out of the GPU mesh (it would be jaggy at ~2 m per vertex and z-fight the hexagonal
// prisms of render/basaltPillars.ts), so this node mirrors heightCore with p7 = 0.
// If you change one, change the other (and keep the f32 parity test in src/gen/terrain.test.ts green).
// The look: worldMaterial({ kind: 'ground' }) with the Red World ground field as its colorNode (groundField below),
// driven by GROUND uniforms that updateGround() sets from VisualInputs each frame. A skirt of square rings outside the
// patch carries the same height and colour out to the far plane, so no view ends at an empty edge.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec3, vec4, uint, uniform, positionLocal, normalize, transformNormalToView, vertexStage,
  floor, fract, step, sqrt, abs, cos, max, min, mix, pow, sign, smoothstep, mod, mx_noise_float, clamp, sin, positionWorld, cameraPosition,
} from 'three/tsl';
import { worldMaterial, PAL } from './material';
import { BAND_DARK, RED_WORLD_GROUND_IDS, crustRatchet, mineralColour, redWorldRamp, type RampRole } from './crustLook';
import type { VisualInputs } from '../worlds/types';
import type { Terrain, TerrainState, MachineId, TerrainParams } from '../gen/terrain';
import { MACHINE_IDS, CRUST_NOISE_WEIGHT, SQRT3, HEX_H } from '../gen/terrain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;
const F = (n: number): N => float(n);
const U = (n: number): N => uint(n >>> 0);
const C_ROT = Math.cos(0.5);
const S_ROT = Math.sin(0.5);
const TWO_PI = Math.PI * 2;

/** Uniforms the sim drives each frame. progress holds one per machine (unused machines stay 0). */
export interface TerrainUniforms {
  rise: N;
  heatSolvent: N;
  progress: Record<MachineId, N>;
}

export function createTerrainUniforms(): TerrainUniforms {
  const progress = {} as Record<MachineId, N>;
  for (const id of MACHINE_IDS) progress[id] = uniform(0);
  return { rise: uniform(0), heatSolvent: uniform(0.5), progress };
}

export function setTerrainUniforms(u: TerrainUniforms, s: TerrainState): void {
  u.rise.value = s.rise;
  u.heatSolvent.value = s.heatSolvent;
  for (const id of MACHINE_IDS) u.progress[id].value = s.progress[id] ?? 0;
}

// ---- primitives (mirror makeKit) ----
const hash = (ix: N, iz: N, seed: N): N => {          // ix, iz int nodes; seed uint node
  let h = uint(ix).mul(U(0x1b873593)).bitXor(uint(iz).mul(U(0x85ebca6b))).bitXor(seed);
  h = h.bitXor(h.shiftRight(U(16)));
  h = h.mul(U(0x7feb352d));
  h = h.bitXor(h.shiftRight(U(15)));
  h = h.mul(U(0x846ca68b));
  h = h.bitXor(h.shiftRight(U(16)));
  return float(h.shiftRight(U(8))).div(16777216.0);
};

const vnoise = Fn(([x, z, seed]: N[]) => {
  const fx0 = floor(x), fz0 = floor(z);
  const ix = fx0.toInt(), iz = fz0.toInt();
  const tx = x.sub(fx0), tz = z.sub(fz0);
  const ux = tx.mul(tx).mul(float(3).sub(tx.mul(2))), uz = tz.mul(tz).mul(float(3).sub(tz.mul(2)));
  const a = hash(ix, iz, seed), b = hash(ix.add(1), iz, seed);
  const c = hash(ix, iz.add(1), seed), d = hash(ix.add(1), iz.add(1), seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uz);
});

const fbm = (x: N, z: N, oct: number, lac: number, gain: number, seed: number): N => {
  let amp = 1, norm = 0, px = x, pz = z;
  let sum: N = F(0);
  for (let i = 0; i < oct; i++) {
    sum = sum.add(F(amp).mul(vnoise(px, pz, U(seed + i * 1013)).mul(2).sub(1)));
    norm += amp;
    amp *= gain;
    const nx = px.mul(C_ROT).sub(pz.mul(S_ROT)).mul(lac).add(17.1 * (i + 1));
    pz = px.mul(S_ROT).add(pz.mul(C_ROT)).mul(lac).add(31.7 * (i + 1));
    px = nx;
  }
  return sum.div(norm);
};

const bandOf = (bn: N, centre: number, width: number): N => F(1).sub(smoothstep(0, 1, abs(bn.sub(centre)).div(width)));

/** Mirrors Kit.hexCell: branch-free hex tiling in cell units; hd = hex distance to the centre (0..0.5), ix/iz = int cell ids. */
const hexCell = (u: N, v: N): { hd: N; ix: N; iz: N } => {
  const av = v.div(SQRT3);
  const cuA = floor(u.add(0.5)), cvA = floor(av.add(0.5));
  const cuB = floor(u).add(0.5), cvB = floor(av).add(0.5);
  const dxA = u.sub(cuA), dzA = v.sub(cvA.mul(SQRT3)), dxB = u.sub(cuB), dzB = v.sub(cvB.mul(SQRT3));
  const dA = dxA.mul(dxA).add(dzA.mul(dzA)), dB = dxB.mul(dxB).add(dzB.mul(dzB));
  const t = clamp(dA.sub(dB).mul(1e5).add(0.5), 0, 1);
  const dx = mix(dxA, dxB, t), dz = mix(dzA, dzB, t);
  const cu = mix(cuA, cuB, t), cv = mix(cvA, cvB, t);
  const hd = max(max(abs(dx), abs(dx.mul(0.5).add(dz.mul(HEX_H)))), abs(dx.mul(-0.5).add(dz.mul(HEX_H))));
  return { hd, ix: floor(cu.mul(2).add(0.5)).toInt(), iz: floor(cv.mul(2).add(0.5)).toInt() };
};

/** Mirrors warpBase: domain warp + base relief. */
const warpBase = (P: TerrainParams, x: N, z: N): { qx: N; qz: N; bn: N; base: N } => {
  const wx = fbm(x.mul(P.warpFreq).add(P.oWxX), z.mul(P.warpFreq).add(P.oWxZ), 2, P.lac, P.gain, P.sWx).mul(P.warpAmp);
  const wz = fbm(x.mul(P.warpFreq).add(P.oWzX), z.mul(P.warpFreq).add(P.oWzZ), 2, P.lac, P.gain, P.sWz).mul(P.warpAmp);
  const qx = x.add(wx), qz = z.add(wz);
  const f = fbm(qx.mul(P.freq).add(P.oBaseX), qz.mul(P.freq).add(P.oBaseZ), P.oct, P.lac, P.gain, P.sBase);
  const bn = sign(f).mul(pow(abs(f), P.expo));
  return { qx, qz, bn, base: bn.mul(0.5 * P.A) };
};

/**
 * Mirrors crustScore + crustWeights: weights per mineral in ELEVATION order (length = number of minerals, at most 8; sum 1).
 * Only present minerals get a smoothstep band; absent ones are the constant 0 (no subgraph), so cost grows with present minerals.
 */
const crustW = (P: TerrainParams, bn: N, x: N, z: N): N[] => {
  const { thr, w, nf, k, bands } = P.crust;
  const nw = CRUST_NOISE_WEIGHT;
  const out: N[] = Array.from({ length: k }, () => F(0));
  if (!bands.length) return out;
  const score = bn.mul(0.5 * (1 - nw)).add(0.5 * (1 - nw)).add(vnoise(x.mul(nf), z.mul(nf), U(P.sCrust)).mul(nw));
  let prev: N = F(1);
  bands.forEach((e, i) => {
    const next: N = i < thr.length ? smoothstep(thr[i] - w, thr[i] + w, score) : F(0);
    out[e] = prev.sub(next);
    prev = next;
  });
  return out;
};

/**
 * Crust weights for the ground look: (x, z) → two vec4s holding up to 8 mineral weights in `crust.minerals` (config) order
 * (component i of the pair = mineral i; unused or absent = 0; sum 1). Use crustComponents() to unpack. The second vec4 is a constant
 * zero when the world has 4 minerals or fewer. CPU twin: terrain.crustWeights(x, z). Evaluates the base relief itself (3 fBm);
 * in a fragment shader prefer evaluating at the vertex and passing it on.
 */
export function crustWeightsNode(terrain: Terrain): (x: N, z: N) => [N, N] {
  const P = terrain.params;
  return (x: N, z: N) => {
    const w = crustW(P, warpBase(P, x, z).bn, x, z);
    const out: N[] = Array.from({ length: 8 }, () => F(0));
    P.crust.order.forEach((ci, j) => { out[ci] = w[j]; });
    return [vec4(out[0], out[1], out[2], out[3]), vec4(out[4], out[5], out[6], out[7])];
  };
}

/** The first `count` weight components (config order) of a crustWeightsNode pair. */
const crustComponents = (cw: [N, N], count: number): N[] => {
  const all = [cw[0].x, cw[0].y, cw[0].z, cw[0].w, cw[1].x, cw[1].y, cw[1].z, cw[1].w];
  return all.slice(0, count);
};

/** Height node (metres) at world (x, z). Mirrors heightCore. */
export function createHeightNode(terrain: Terrain, u: TerrainUniforms): (x: N, z: N) => N {
  const P = terrain.params;
  const M = P.machines;
  const on = P.active;   // machines absent from the config contribute exactly 0 (OFF params), so their subgraphs are not built
  const R = P.ramp;
  const gated = Object.keys(P.gates).length > 0;

  return Fn(([x, z]: N[]) => {
    const hs = u.heatSolvent;
    const p2 = u.progress.M2, p3 = u.progress.M3, p4 = u.progress.M4, p5 = u.progress.M5, p6 = u.progress.M6;
    const p8 = u.progress.M8, p9 = u.progress.M9;

    // domain warp + base relief
    const { qx, qz, bn, base } = warpBase(P, x, z);

    // shared crust weights; a machine with `minerals` is multiplied by the summed weight of its minerals
    const cw = gated ? crustW(P, bn, x, z) : [];
    const gateOf = (id: MachineId): N => {
      const g = P.gates[id];
      if (!g) return F(1);
      let sum: N = F(0);
      g.forEach((c, j) => { if (c) sum = sum.add(cw[j]); });
      return sum;
    };

    // M5 strata terraces
    let hb: N = base;
    if (on.M5) {
      const m5 = M.M5!;
      const w5 = Math.max(0.02, 0.5 * (1 - m5.sharpness));
      const u5 = base.div(m5.bandH);
      const stepped = floor(u5).add(smoothstep(0.5 - w5, 0.5 + w5, fract(u5))).mul(m5.bandH);
      const s5: N = P.gates.M5 ? gateOf('M5').mul(1 - m5.offMineral).add(m5.offMineral).mul(m5.strength) : F(m5.strength);
      hb = base.add(p5.mul(s5).mul(stepped.sub(base)));
    }

    // M3 hoodoos / frost fins
    let h3: N | null = null;
    if (on.M3) {
      const m3 = M.M3!;
      const wf3 = 1 / (m3.finSpacing * 2.5);
      const bf3 = 1 / (m3.finSpacing * 1.5);
      const g3 = F(1).sub(smoothstep(0, m3.halfWidth, abs(hs.sub(0.5))));
      const up3 = smoothstep(m3.uplandMin, m3.uplandMin + 0.3, bn);
      const along = qx.mul(P.m3dir[0]).add(qz.mul(P.m3dir[1])).add(fbm(qx.mul(wf3), qz.mul(wf3), 2, P.lac, P.gain, P.sM3a).mul(m3.finWarp));
      const fin = pow(max(cos(along.div(m3.finSpacing).mul(TWO_PI)).mul(0.5).add(0.5), 0), m3.finSharp);
      const brk3 = smoothstep(m3.breakup, m3.breakup + 0.25, vnoise(qx.mul(bf3), qz.mul(bf3), U(P.sM3b)));
      h3 = p3.mul(g3).mul(up3).mul(m3.finHeight).mul(fin).mul(brk3).mul(gateOf('M3'));
    }

    // M6 shell-stone mounds
    let h6: N | null = null;
    if (on.M6) {
      const m6 = M.M6!;
      const band6 = bandOf(bn, m6.bandCenter, m6.bandWidth);
      const mound6 = smoothstep(m6.threshold, m6.threshold + 0.2, vnoise(qx.mul(m6.moundFreq), qz.mul(m6.moundFreq), U(P.sM6)));
      h6 = p6.mul(m6.moundHeight).mul(band6).mul(mound6).mul(gateOf('M6'));
    }

    // M2 silicon crystal-crust rims
    let h2: N | null = null;
    if (on.M2) {
      const m2 = M.M2!;
      const band2 = bandOf(bn, m2.bandCenter, m2.bandWidth);
      const crust2 = smoothstep(m2.threshold, m2.threshold + 0.25, vnoise(qx.mul(m2.patchFreq), qz.mul(m2.patchFreq), U(P.sM2)));
      h2 = p2.mul(m2.rimHeight).mul(band2).mul(crust2).mul(gateOf('M2'));
    }

    // M8 granite domes and tors
    let h8: N | null = null;
    if (on.M8) {
      const m8 = M.M8!;
      const w8 = Math.max(0.02, 0.5 * (1 - m8.stackSharp));
      const dome = smoothstep(m8.threshold, m8.threshold + 0.3, vnoise(qx.mul(m8.domeFreq), qz.mul(m8.domeFreq), U(P.sM8)));
      const up8 = smoothstep(m8.uplandMin, m8.uplandMin + 0.3, bn);
      const dH = dome.mul(m8.domeHeight);
      const u8 = dH.div(m8.stackStep);
      const stack8 = floor(u8).add(smoothstep(0.5 - w8, 0.5 + w8, fract(u8))).mul(m8.stackStep);
      h8 = p8.mul(up8).mul(dH.add(stack8.sub(dH).mul(m8.stackShare))).mul(gateOf('M8'));
    }

    // M9 nitride crystals
    let h9: N | null = null;
    if (on.M9) {
      const m9 = M.M9!;
      const hx9 = hexCell(x.div(m9.size), z.div(m9.size));
      const here9 = smoothstep(1 - m9.density, 1 - m9.density + 0.04, hash(hx9.ix, hx9.iz, U(P.sM9a)));
      const tall9 = hash(hx9.ix, hx9.iz, U(P.sM9b)).mul(0.5).add(0.5);
      const tip9 = pow(max(F(1).sub(hx9.hd.div(0.5 * m9.girth)), 0), m9.sharp);
      h9 = p9.mul(m9.spikeHeight).mul(here9).mul(tall9).mul(tip9).mul(gateOf('M9'));
    }

    // M4 canyon
    let carve: N | null = null;
    if (on.M4) {
      const m4 = M.M4!;
      const cx = fbm(z.mul(m4.meanderFreq).add(7.3), F(0.5), 2, P.lac, P.gain, P.sM4).mul(m4.meanderAmp).add(P.m4x);
      const dry = smoothstep(m4.dryStart, m4.dryEnd, hs);
      const wC = mix(F(m4.widthWet), F(m4.widthDry), dry);
      const stC = mix(F(m4.steepWet), F(m4.steepDry), dry);
      const uu = min(abs(qx.sub(cx)).div(wC), 1);
      carve = p4.mul(m4.depth).mul(F(1).sub(smoothstep(0, 1, pow(uu, stC)))).mul(gateOf('M4'));
    }

    // relic footprints
    let relic: N = F(0);
    for (const pier of P.piers) {
      const dx = x.sub(pier.x), dz = z.sub(pier.z);
      const s = F(1).sub(smoothstep(0, 1, sqrt(dx.mul(dx).add(dz.mul(dz))).div(pier.radius)));
      relic = relic.add(s.mul(s).mul(pier.height));
    }

    let hTerrain: N = hb;
    for (const h of [h3, h6, h2, h8, h9]) if (h) hTerrain = hTerrain.add(h);
    if (carve) hTerrain = hTerrain.sub(carve);
    hTerrain = hTerrain.add(relic);

    // shore ramp
    const rdx = x.sub(R.cx), rdz = z.sub(R.cz);
    const dist = sqrt(rdx.mul(rdx).add(rdz.mul(rdz)));
    const mask = F(1).sub(smoothstep(R.rIn, R.rOut, dist));
    const t = rdx.mul(R.ux).add(rdz.mul(R.uz));
    const rampH = mix(F(-P.rampRange * P.A), F(P.rampRange * P.A), smoothstep(-R.rIn, R.rIn, t)).add(base.mul(P.rampDetail));
    const hf = mix(hTerrain, rampH, mask);

    // M7 basalt pillars are NOT part of the GPU mesh (src/render/basaltPillars.ts draws them as prisms): see the file header.
    return u.rise.mul(hf);
  }) as (x: N, z: N) => N;
}

export interface TerrainMeshOptions { segments?: number }

/** Ground-look uniforms, set from VisualInputs by updateGround() (shared by every terrain mesh and its skirt). */
export const GROUND = {
  seaLevel: uniform(0),
  hasSea: uniform(0),     // 1 when a sea is drawn (seaCover > 0.005), so shore bands never appear on a dry world
  life: uniform(0),       // lifeOnLand, eased over ~3 s
  build: uniform(1),      // buildProgress
  frozen: uniform(0),     // 1 when the sea is frozen: no wet band or tide line on an ice shore
  rust: uniform(0),       // 0..1: how far oxidising rock has rusted (crustRatchet)
};

let lifeEase = 0;
/** Drive GROUND from the inputs. Call once per frame (world.ts step). */
export function updateGround(inputs: VisualInputs, dt: number): void {
  lifeEase += ((inputs.lifeOnLand ? 1 : 0) - lifeEase) * (1 - Math.exp(-dt / 3));
  GROUND.seaLevel.value = inputs.seaLevel;
  GROUND.hasSea.value = (inputs.stats.seaCover ?? 1) > 0.005 ? 1 : 0;
  GROUND.life.value = lifeEase;
  GROUND.build.value = inputs.buildProgress;
  GROUND.frozen.value = inputs.frozen ? 1 : 0;
  GROUND.rust.value = crustRatchet.update(inputs.world, inputs.stats.oxygen ?? 0, inputs.buildProgress);
}

/**
 * The Red World ground field (colour roles from PAL; worldMaterial applies light, cel shadow and fog).
 * Height above the sea sets the base ramp (crimson hollows → red → lit redLight crests), steep walls show strata banded
 * at the M5 terrace height, shore bands sit at seaLevel (wet dark band, pale tide line, darker seabed), frost dusts flats
 * only below the solvent's freezing point (heatSolvent < 0.5), heat bleaches, land life darkens the low flats, and the
 * contrast grows with rise so freshly settled ground starts even.
 */
function groundField(terrain: Terrain, u: TerrainUniforms, h: N, n: N, cw: [N, N]): N {
  const P = terrain.params;
  const minerals = terrain.config.crust?.minerals ?? [];   // cw: vertex-stage crust weights, in config order
  const halfA = 0.5 * P.A;
  const bandH = P.machines.M5?.bandH ?? Math.max(1, P.A * 0.08);
  return Fn(() => {
    const nn = normalize(n);
    const x = positionLocal.x, z = positionLocal.z;
    const rise = u.rise, hs = u.heatSolvent;
    const d = h.sub(GROUND.seaLevel);                                   // metres above the sea
    const e = clamp(d.div(rise.mul(halfA).add(1)), -1, 1);               // relative elevation
    const flat = smoothstep(0.78, 0.95, nn.y);
    const steep = float(1).sub(smoothstep(0.55, 0.85, nn.y));
    const vary = mx_noise_float(vec3(x.mul(0.035), 0, z.mul(0.035))).mul(0.5).add(0.5);
    const fine = mx_noise_float(vec3(x.mul(0.21), 1.7, z.mul(0.21)));

    // base ramp on stepped elevation bands: shadowed hollows → base red → lit crests. `ramp` takes the four role colours so
    // the same structure can be evaluated with PAL (the world's blended palette) and with the fixed Red World palette
    // (ironstone ground).
    const eS = floor(e.mul(5).add(vary.mul(0.6))).div(5);
    const hollow = clamp(float(0.5).sub(mx_noise_float(vec3(x.div(60), 4.1, z.div(60))).mul(1.4)), 0, 1);
    const mott = mx_noise_float(vec3(x.div(16), 2.3, z.div(16))).add(fine.mul(0.25));
    const near = smoothstep(70, 25, positionWorld.sub(cameraPosition).length());
    const rip = sin(x.mul(0.62).add(z.mul(0.38)).add(fine.mul(3.5)).add(vary.mul(6)));
    const ramp = (R: Record<'redLight' | 'red' | 'crimson' | 'maroon', N>): N => {
      const c = mix(R.crimson, R.red, smoothstep(-0.6, 0.0, eS)).toVar();
      c.assign(mix(c, R.redLight, smoothstep(0.2, 0.8, eS).mul(flat.mul(0.6).add(0.4))));
      // the reference's patchy ground: low-frequency crimson hollows and sunlit flats
      c.assign(mix(c, R.crimson, hollow.mul(0.6)));
      c.assign(mix(c, R.redLight, smoothstep(0.62, 0.9, vary).mul(flat).mul(0.35)));
      // mid-scale two-tone mottling and near wind ripples: value structure that holds on low relief (the spawn frame at
      // rise ≈ 0.3 is mostly gentle shore ramp)
      c.assign(mix(c, R.crimson, smoothstep(-0.12, -0.3, mott).mul(0.45)));
      c.assign(mix(c, R.redLight, smoothstep(0.25, 0.42, mott).mul(flat).mul(0.3)));
      c.assign(mix(c, mix(R.crimson, R.maroon, 0.3), smoothstep(0.82, 0.96, rip).mul(flat).mul(near).mul(0.35)));
      return c;
    };
    const c = ramp({ redLight: vec3(PAL.redLight), red: vec3(PAL.red), crimson: vec3(PAL.crimson), maroon: vec3(PAL.maroon) }).toVar();

    // crust: mineral colours blended by the shared weights, rusted by the ratchet, keeping the ramp's light/shade structure
    if (minerals.length) {
      const col = (hex: number): N => { const k = new THREE.Color(hex); return vec3(k.r, k.g, k.b); };
      const comp = crustComponents(cw, minerals.length);
      const hem = step(0.8, fract(h.div(bandH * 0.5).add(fine.mul(0.25))));   // ironstone's thin hematite bands: two per terrace
      let mc: N = vec3(0, 0, 0);
      let wi: N = float(0);   // weight of the minerals drawn with the Red World ramp
      minerals.forEach((m, i) => {
        if (RED_WORLD_GROUND_IDS.includes(m.id)) { wi = wi.add(comp[i]); return; }
        mc = mc.add(mix(col(mineralColour(m.id, 0)), col(mineralColour(m.id, 1)), GROUND.rust).mul(comp[i]));
      });
      const lum = c.x.mul(0.3).add(c.y.mul(0.5)).add(c.z.mul(0.2));
      const wo = clamp(float(1).sub(wi), 0.001, 1);
      const other = mix(c, mc.div(wo).mul(lum.mul(0.9).add(0.55)), 0.9);
      c.assign(mix(c, other, wo));   // weight 1 of other minerals = the old blend; ironstone weight leaves the ramp alone
      if (minerals.some((m) => RED_WORLD_GROUND_IDS.includes(m.id))) {
        // ironstone: the Red World ramp in its fixed palette, jasper (dark, muted) when fresh and the mockup red when rusted
        const r0 = redWorldRamp(0), r1 = redWorldRamp(1);
        const rw = (k: RampRole): N => mix(col(r0[k]), col(r1[k]), GROUND.rust);
        const iron = ramp({ redLight: rw('redLight'), red: rw('red'), crimson: rw('crimson'), maroon: rw('maroon') });
        const banded = mix(iron, mix(iron, col(BAND_DARK), 0.6), hem.mul(0.3));   // subtle maroon hematite bands by height
        c.assign(mix(c, banded, wi));
      }
    }

    // strata: stepped bands on walls, keyed to the terrace height (index mod 3 → light / dark / mid)
    const band = floor(h.div(bandH).add(fine.mul(0.35)));
    const k = mod(band, 3);
    const dark = k.lessThan(0.5).select(float(0.62), k.lessThan(1.5).select(float(0.15), float(0.38)));
    c.assign(mix(c, mix(vec3(PAL.red), vec3(PAL.maroon), dark), steep.mul(0.85)));
    c.assign(mix(c, mix(vec3(PAL.red), vec3(PAL.crimson), dark), float(1).sub(steep).mul(0.18)));

    // heat: frost below freezing (on flats and crests), bleaching when hot and dry
    const frost = smoothstep(0.5, 0.36, hs).mul(flat.mul(0.7).add(0.3)).mul(smoothstep(-0.3, 0.3, e));
    c.assign(mix(c, vec3(PAL.bone), frost.mul(0.85)));
    c.assign(mix(c, vec3(PAL.blush), smoothstep(0.78, 1.0, hs).mul(flat).mul(0.3)));

    // land life darkens the low flats (soil under the groves)
    c.assign(mix(c, vec3(PAL.maroon), GROUND.life.mul(flat).mul(float(1).sub(smoothstep(0.05, 0.55, e))).mul(0.4)));

    // shore: a wet dark band just above the water and a pale tide line above it, both a few metres wide on the ground
    // whatever the slope (height widths scale with tan(slope)); the seabed darkens with depth
    const sea = GROUND.hasSea.mul(rise.greaterThan(0.02).select(float(1), float(0)));
    const tanS = sqrt(max(float(1).sub(nn.y.mul(nn.y)), 0)).div(max(nn.y, 0.2));
    const wetW = clamp(tanS.mul(3.0), 0.12, 1.6).mul(fine.mul(0.3).add(1));
    const tideW = clamp(tanS.mul(1.0), 0.06, 0.5);
    const wet = smoothstep(-0.2, 0.05, d).mul(float(1).sub(smoothstep(wetW.mul(0.8), wetW, d)));
    const tide = smoothstep(wetW, wetW.add(tideW.mul(0.3)), d).mul(float(1).sub(smoothstep(wetW.add(tideW.mul(0.7)), wetW.add(tideW), d)));
    c.assign(mix(c, mix(vec3(PAL.crimson), vec3(PAL.maroon), 0.45), wet.mul(sea).mul(float(0.75).sub(GROUND.frozen.mul(0.55)))));
    c.assign(mix(c, mix(vec3(PAL.blush), vec3(PAL.bone), 0.5), tide.mul(sea).mul(float(0.5).sub(GROUND.frozen.mul(0.5)))));
    c.assign(mix(c, mix(vec3(PAL.crimson), vec3(PAL.maroon), smoothstep(0, -8, d)), smoothstep(0.1, -0.6, d).mul(sea).mul(0.7)));

    // freshly settled ground is even; its colour structure is in place early (rise ≈ 0.15), so the spawn frame reads
    return mix(vec3(PAL.red), c, smoothstep(0.0, 0.15, rise));
  })();
}

/**
 * A patchSize² plane displaced by the height node, plus a skirt (child mesh) of square rings outside it out to
 * ~3 patch widths, on the same height node and material, so the land continues to the far plane. Vertex-stage normals
 * by central differences. Drive `uniforms` with setTerrainUniforms() each frame and GROUND with updateGround().
 */
export function createTerrainMesh(terrain: Terrain, uniforms: TerrainUniforms, opts: TerrainMeshOptions = {}): THREE.Mesh {
  const segments = opts.segments ?? 192;
  const S = terrain.patchSize;
  const geo = new THREE.PlaneGeometry(S, S, segments, segments);
  geo.rotateX(-Math.PI / 2);                         // vertices now lie in XZ at y = 0

  const height = createHeightNode(terrain, uniforms);
  const x = positionLocal.x, z = positionLocal.z;
  const h = height(x, z);
  const eps = S / segments;
  const hL = height(x.sub(eps), z), hR = height(x.add(eps), z);
  const hD = height(x, z.sub(eps)), hU = height(x, z.add(eps));
  const nLocal = normalize(vec3(hL.sub(hR), 2 * eps, hD.sub(hU)));

  const mat = worldMaterial({ kind: 'ground', colorNode: groundField(terrain, uniforms, vertexStage(h), vertexStage(nLocal), (([a, b]) => [vertexStage(a), terrain.params.crust.k > 4 ? vertexStage(b) : b] as [N, N])(crustWeightsNode(terrain)(x, z))) });
  mat.positionNode = vec3(x, h, z);
  mat.normalNode = transformNormalToView(vertexStage(nLocal));

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;                        // displacement is not in the flat plane's bounds
  const skirt = new THREE.Mesh(skirtGeometry(S, segments), mat);
  skirt.frustumCulled = false;
  skirt.name = 'terrainSkirt';
  skirt.raycast = () => {};                           // decoration: never picked
  mesh.add(skirt);
  return mesh;
}

/** Square rings from the patch edge outward; the inner ring matches the patch's edge vertices exactly (no seam). */
function skirtGeometry(S: number, segments: number): THREE.BufferGeometry {
  const half = S / 2;
  const offs = [0, 3, 8, 15, 25, 40, 60, 90, 130, 180, 250, 340, 460, 620, 820, 1050].map((m) => (m * S) / 400);
  const per = segments * 4;                          // vertices per ring (each side has `segments` steps)
  const pos = new Float32Array(offs.length * per * 3);
  let k = 0;
  for (const o of offs) {
    const hh = half + o;
    for (let i = 0; i < per; i++) {
      const side = Math.floor(i / segments), t = (i % segments) / segments;
      const a = -hh + 2 * hh * t;
      const [px, pz] = side === 0 ? [a, -hh] : side === 1 ? [hh, a] : side === 2 ? [-a, hh] : [-hh, -a];
      pos[k++] = px; pos[k++] = 0; pos[k++] = pz;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < offs.length - 1; r++) {
    for (let i = 0; i < per; i++) {
      const a = r * per + i, b = r * per + ((i + 1) % per), c = a + per, d = b + per;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length).fill(0).map((_, j) => (j % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}
