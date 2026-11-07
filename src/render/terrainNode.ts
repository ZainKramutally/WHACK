// GPU terrain: the same height formula as src/gen/terrain.ts `heightCore`, written as a TSL node.
// MIRROR RULE: every block below matches the block of the same name in heightCore, line for line.
// If you change one, change the other (and keep the f32 parity test in src/gen/terrain.test.ts green).
// Custom TSL is limited to this height node and its normal; the material is a plain built-in node
// material that the art layer re-skins (set colorNode etc. on `mesh.material`).
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec3, uint, uniform, positionLocal, normalize, transformNormalToView, vertexStage,
  floor, fract, sqrt, abs, cos, max, min, mix, pow, sign, smoothstep,
} from 'three/tsl';
import type { Terrain, TerrainState, MachineId } from '../gen/terrain';
import { MACHINE_IDS } from '../gen/terrain';

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

/** Height node (metres) at world (x, z). Mirrors heightCore. */
export function createHeightNode(terrain: Terrain, u: TerrainUniforms): (x: N, z: N) => N {
  const P = terrain.params;
  const M = P.machines;
  const m2 = M.M2!, m3 = M.M3!, m4 = M.M4!, m5 = M.M5!, m6 = M.M6!;
  const R = P.ramp;
  const w5 = Math.max(0.02, 0.5 * (1 - m5.sharpness));
  const wf3 = 1 / (m3.finSpacing * 2.5);
  const bf3 = 1 / (m3.finSpacing * 1.5);

  return Fn(([x, z]: N[]) => {
    const hs = u.heatSolvent;
    const p2 = u.progress.M2, p3 = u.progress.M3, p4 = u.progress.M4, p5 = u.progress.M5, p6 = u.progress.M6;

    // domain warp
    const wx = fbm(x.mul(P.warpFreq).add(P.oWxX), z.mul(P.warpFreq).add(P.oWxZ), 2, P.lac, P.gain, P.sWx).mul(P.warpAmp);
    const wz = fbm(x.mul(P.warpFreq).add(P.oWzX), z.mul(P.warpFreq).add(P.oWzZ), 2, P.lac, P.gain, P.sWz).mul(P.warpAmp);
    const qx = x.add(wx), qz = z.add(wz);

    // base relief
    const f = fbm(qx.mul(P.freq).add(P.oBaseX), qz.mul(P.freq).add(P.oBaseZ), P.oct, P.lac, P.gain, P.sBase);
    const bn = sign(f).mul(pow(abs(f), P.expo));
    const base = bn.mul(0.5 * P.A);

    // M5 strata terraces
    const u5 = base.div(m5.bandH);
    const stepped = floor(u5).add(smoothstep(0.5 - w5, 0.5 + w5, fract(u5))).mul(m5.bandH);
    const hb = base.add(p5.mul(m5.strength).mul(stepped.sub(base)));

    // M3 hoodoos / frost fins
    const g3 = F(1).sub(smoothstep(0, m3.halfWidth, abs(hs.sub(0.5))));
    const up3 = smoothstep(m3.uplandMin, m3.uplandMin + 0.3, bn);
    const along = qx.mul(P.m3dir[0]).add(qz.mul(P.m3dir[1])).add(fbm(qx.mul(wf3), qz.mul(wf3), 2, P.lac, P.gain, P.sM3a).mul(m3.finWarp));
    const fin = pow(max(cos(along.div(m3.finSpacing).mul(TWO_PI)).mul(0.5).add(0.5), 0), m3.finSharp);
    const brk3 = smoothstep(m3.breakup, m3.breakup + 0.25, vnoise(qx.mul(bf3), qz.mul(bf3), U(P.sM3b)));
    const h3 = p3.mul(g3).mul(up3).mul(m3.finHeight).mul(fin).mul(brk3);

    // M6 shell-stone mounds
    const band6 = bandOf(bn, m6.bandCenter, m6.bandWidth);
    const mound6 = smoothstep(m6.threshold, m6.threshold + 0.2, vnoise(qx.mul(m6.moundFreq), qz.mul(m6.moundFreq), U(P.sM6)));
    const h6 = p6.mul(m6.moundHeight).mul(band6).mul(mound6);

    // M2 silicon crystal-crust rims
    const band2 = bandOf(bn, m2.bandCenter, m2.bandWidth);
    const crust2 = smoothstep(m2.threshold, m2.threshold + 0.25, vnoise(qx.mul(m2.patchFreq), qz.mul(m2.patchFreq), U(P.sM2)));
    const h2 = p2.mul(m2.rimHeight).mul(band2).mul(crust2);

    // M4 canyon
    const cx = fbm(z.mul(m4.meanderFreq).add(7.3), F(0.5), 2, P.lac, P.gain, P.sM4).mul(m4.meanderAmp).add(P.m4x);
    const dry = smoothstep(m4.dryStart, m4.dryEnd, hs);
    const wC = mix(F(m4.widthWet), F(m4.widthDry), dry);
    const stC = mix(F(m4.steepWet), F(m4.steepDry), dry);
    const uu = min(abs(qx.sub(cx)).div(wC), 1);
    const carve = p4.mul(m4.depth).mul(F(1).sub(smoothstep(0, 1, pow(uu, stC))));

    // relic footprints
    let relic: N = F(0);
    for (const pier of P.piers) {
      const dx = x.sub(pier.x), dz = z.sub(pier.z);
      const s = F(1).sub(smoothstep(0, 1, sqrt(dx.mul(dx).add(dz.mul(dz))).div(pier.radius)));
      relic = relic.add(s.mul(s).mul(pier.height));
    }

    const hTerrain = hb.add(h3).add(h6).add(h2).sub(carve).add(relic);

    // shore ramp
    const rdx = x.sub(R.cx), rdz = z.sub(R.cz);
    const dist = sqrt(rdx.mul(rdx).add(rdz.mul(rdz)));
    const mask = F(1).sub(smoothstep(R.rIn, R.rOut, dist));
    const t = rdx.mul(R.ux).add(rdz.mul(R.uz));
    const rampH = mix(F(-P.rampRange * P.A), F(P.rampRange * P.A), smoothstep(-R.rIn, R.rIn, t)).add(base.mul(P.rampDetail));
    const h = mix(hTerrain, rampH, mask);

    return u.rise.mul(h);
  }) as (x: N, z: N) => N;
}

export interface TerrainMeshOptions { segments?: number }

/**
 * A patchSize² plane displaced by the height node. Vertex-stage normals by central differences.
 * Drive `uniforms` with setTerrainUniforms() each frame. The art layer sets colorNode etc. on mesh.material.
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

  const mat = new THREE.MeshStandardNodeMaterial();
  mat.positionNode = vec3(x, h, z);
  mat.normalNode = transformNormalToView(vertexStage(nLocal));
  mat.roughness = 0.9;
  mat.metalness = 0;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;                        // displacement is not in the flat plane's bounds
  return mesh;
}
