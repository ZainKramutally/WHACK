// L0 analytic terrain (CLAUDE.md "Terrain and landforms"). Pure TS, deterministic per seed.
//
// `heightCore` is THE height formula. src/render/terrainNode.ts mirrors it line for line in TSL.
// If you change one, change the other. Rules that keep the mirror trivial:
//   - only + - * /, sqrt, sin/cos, abs, floor, fract, mix, smoothstep, pow (non-negative base), min/max
//   - no branches (machines are multiplied by their progress, so progress 0 contributes exactly 0)
//   - lattice noise uses a u32 integer hash, so CPU and GPU agree bit-for-bit on the random values
//
// Every coefficient comes from TerrainConfig (base + machines[].params + relics[].params); only the
// seed-derived offsets/angles/positions are computed here.
import type { TerrainConfig } from '../worlds/types';
import { makeRng } from '../sim/rng';

export type MachineId = 'M2' | 'M3' | 'M4' | 'M5' | 'M6';
export const MACHINE_IDS: MachineId[] = ['M2', 'M3', 'M4', 'M5', 'M6'];

/** Inputs that move the terrain. progress.Mx is 0..1; the sim sets M4 = age × past-liquid. Missing = 0. */
export interface TerrainState {
  rise: number;                                   // 0 flat → 1 full relief
  progress: Partial<Record<MachineId, number>>;
  heatSolvent: number;                            // 0.5 = solvent freezing point
}

export interface Relic {
  kind: 'iceArch' | 'iceSpire';
  position: [number, number];                     // x, z (metres); arches: centre of the span
  params: { height: number; radius: number; span: number; angle: number };   // span 0 for spires; angle = span direction (rad)
}

// ---- required config keys (createTerrain throws on a missing one, so a config typo is loud) ----
export const BASE_KEYS = ['amplitude', 'frequency', 'octaves', 'lacunarity', 'gain', 'warpAmp', 'warpFreq', 'exponent', 'rampRange', 'rampDetail'] as const;
export const MACHINE_KEYS: Record<MachineId, readonly string[]> = {
  M2: ['rimHeight', 'bandCenter', 'bandWidth', 'patchFreq', 'threshold'],
  M3: ['halfWidth', 'finHeight', 'finSpacing', 'finWarp', 'finSharp', 'breakup', 'uplandMin'],
  M4: ['depth', 'widthWet', 'widthDry', 'steepWet', 'steepDry', 'dryStart', 'dryEnd', 'meanderAmp', 'meanderFreq', 'offsetFrac'],
  M5: ['bandH', 'sharpness', 'strength'],
  M6: ['moundHeight', 'bandCenter', 'bandWidth', 'moundFreq', 'threshold'],
};
export const RELIC_KEYS = { iceSpire: ['height', 'radius'], iceArch: ['height', 'radius', 'span'] } as const;

/** Everything heightCore needs, flat numbers only (the TSL node bakes these as constants). */
export interface TerrainParams {
  patchSize: number;
  A: number; freq: number; oct: number; lac: number; gain: number; warpAmp: number; warpFreq: number; expo: number;
  rampRange: number; rampDetail: number;
  // seed-derived hash seeds (u32) and noise-space offsets
  sBase: number; sWx: number; sWz: number; sM2: number; sM3a: number; sM3b: number; sM4: number; sM6: number;
  oBaseX: number; oBaseZ: number; oWxX: number; oWxZ: number; oWzX: number; oWzZ: number;
  // shore ramp (spawn area)
  ramp: { cx: number; cz: number; ux: number; uz: number; rIn: number; rOut: number };
  machines: Partial<Record<MachineId, Record<string, number>>>;
  m3dir: [number, number];
  m4x: number;                                    // canyon centre-line x offset (m)
  piers: { x: number; z: number; height: number; radius: number }[];   // relic footprints (spire = 1 pier, arch = 2)
}

export interface Terrain {
  config: TerrainConfig;
  seed: number;
  params: TerrainParams;
  relics: Relic[];
  patchSize: number;
  height(x: number, z: number, state: TerrainState): number;
}

// ---------- primitives (rounding hook `r` lets the f32 test kit emulate GPU precision) ----------
export type Round = (n: number) => number;
const C_ROT = Math.cos(0.5);
const S_ROT = Math.sin(0.5);

export function makeKit(r: Round) {
  const fract = (v: number) => r(v - Math.floor(v));
  const mix = (a: number, b: number, t: number) => r(a + (b - a) * t);
  const smoothstep = (a: number, b: number, x: number) => {
    let t = r((x - a) / (b - a));
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return r(t * t * (3 - 2 * t));
  };
  /** u32 integer hash → [0,1) with 24 bits (exactly representable in f32). */
  const hash = (ix: number, iz: number, seed: number) => {
    let h = (Math.imul(ix, 0x1b873593) ^ Math.imul(iz, 0x85ebca6b) ^ seed) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    h = Math.imul(h, 0x7feb352d) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    h = Math.imul(h, 0x846ca68b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return (h >>> 8) / 16777216;
  };
  /** Value noise in [0,1). */
  const vnoise = (x: number, z: number, seed: number) => {
    const fx0 = Math.floor(x), fz0 = Math.floor(z);
    const tx = r(x - fx0), tz = r(z - fz0);
    const ux = r(tx * tx * (3 - 2 * tx)), uz = r(tz * tz * (3 - 2 * tz));
    const a = hash(fx0, fz0, seed), b = hash(fx0 + 1, fz0, seed);
    const c = hash(fx0, fz0 + 1, seed), d = hash(fx0 + 1, fz0 + 1, seed);
    return mix(mix(a, b, ux), mix(c, d, ux), uz);
  };
  /** fBm in [-1,1]; each octave is rotated and offset so lattices never line up. */
  const fbm = (x: number, z: number, oct: number, lac: number, gain: number, seed: number) => {
    let amp = 1, sum = 0, norm = 0, px = x, pz = z;
    for (let i = 0; i < oct; i++) {
      sum = r(sum + amp * (2 * vnoise(px, pz, (seed + i * 1013) >>> 0) - 1));
      norm += amp;
      amp *= gain;
      const nx = r((px * C_ROT - pz * S_ROT) * lac + 17.1 * (i + 1));
      pz = r((px * S_ROT + pz * C_ROT) * lac + 31.7 * (i + 1));
      px = nx;
    }
    return r(sum / norm);
  };
  return { r, fract, mix, smoothstep, hash, vnoise, fbm };
}
export type Kit = ReturnType<typeof makeKit>;
export const kit64: Kit = makeKit((n) => n);
/** Emulates GPU f32 intermediate precision; used by the parity test. */
export const kit32: Kit = makeKit(Math.fround);

export const TWO_PI = Math.PI * 2;

/**
 * The height formula. Metres. `pr` = progress per machine (missing → 0).
 * Order: warp → base fBm → M5 strata → + M3 fins + M6 mounds + M2 crusts − M4 canyon + relic piers → shore ramp → × rise.
 */
export function heightCore(
  P: TerrainParams, rise: number, hs: number,
  p2: number, p3: number, p4: number, p5: number, p6: number,
  x: number, z: number, k: Kit = kit64,
): number {
  const { fract, mix, smoothstep, fbm, vnoise } = k;
  const M = P.machines;

  // domain warp
  const wx = fbm(x * P.warpFreq + P.oWxX, z * P.warpFreq + P.oWxZ, 2, P.lac, P.gain, P.sWx) * P.warpAmp;
  const wz = fbm(x * P.warpFreq + P.oWzX, z * P.warpFreq + P.oWzZ, 2, P.lac, P.gain, P.sWz) * P.warpAmp;
  const qx = x + wx, qz = z + wz;

  // base relief: bn in [-1,1]
  const f = fbm(qx * P.freq + P.oBaseX, qz * P.freq + P.oBaseZ, P.oct, P.lac, P.gain, P.sBase);
  const bn = (f < 0 ? -1 : 1) * Math.pow(Math.abs(f), P.expo);
  const base = 0.5 * P.A * bn;

  // M5 strata terraces (smooth staircase blended in by progress)
  const m5 = M.M5!;
  const u5 = base / m5.bandH;
  const w5 = Math.max(0.02, 0.5 * (1 - m5.sharpness));
  const stepped = m5.bandH * (Math.floor(u5) + smoothstep(0.5 - w5, 0.5 + w5, fract(u5)));
  const hb = base + p5 * m5.strength * (stepped - base);

  // M3 hoodoos / frost fins: only near the freezing point (heatSolvent ≈ 0.5), uplands only
  const m3 = M.M3!;
  const g3 = 1 - smoothstep(0, m3.halfWidth, Math.abs(hs - 0.5));
  const up3 = smoothstep(m3.uplandMin, m3.uplandMin + 0.3, bn);
  const wf3 = 1 / (m3.finSpacing * 2.5);
  const along = qx * P.m3dir[0] + qz * P.m3dir[1] + m3.finWarp * fbm(qx * wf3, qz * wf3, 2, P.lac, P.gain, P.sM3a);
  const fin = Math.pow(Math.max(0.5 + 0.5 * Math.cos(TWO_PI * (along / m3.finSpacing)), 0), m3.finSharp);
  const bf3 = 1 / (m3.finSpacing * 1.5);
  const brk3 = smoothstep(m3.breakup, m3.breakup + 0.25, vnoise(qx * bf3, qz * bf3, P.sM3b));
  const h3 = p3 * g3 * up3 * m3.finHeight * fin * brk3;

  // M6 shell-stone mounds in the shallows (band of base elevation)
  const m6 = M.M6!;
  const band6 = 1 - smoothstep(0, 1, Math.abs(bn - m6.bandCenter) / m6.bandWidth);
  const mound6 = smoothstep(m6.threshold, m6.threshold + 0.2, vnoise(qx * m6.moundFreq, qz * m6.moundFreq, P.sM6));
  const h6 = p6 * m6.moundHeight * band6 * mound6;

  // M2 silicon crystal-crust rims at the sea margin (band of base elevation)
  const m2 = M.M2!;
  const band2 = 1 - smoothstep(0, 1, Math.abs(bn - m2.bandCenter) / m2.bandWidth);
  const crust2 = smoothstep(m2.threshold, m2.threshold + 0.25, vnoise(qx * m2.patchFreq, qz * m2.patchFreq, P.sM2));
  const h2 = p2 * m2.rimHeight * band2 * crust2;

  // M4 canyon: depth ∝ progress; walls steepen with dry heat
  const m4 = M.M4!;
  const cx = P.m4x + m4.meanderAmp * fbm(z * m4.meanderFreq + 7.3, 0.5, 2, P.lac, P.gain, P.sM4);
  const dry = smoothstep(m4.dryStart, m4.dryEnd, hs);
  const wC = mix(m4.widthWet, m4.widthDry, dry);
  const stC = mix(m4.steepWet, m4.steepDry, dry);
  const uu = Math.min(Math.abs(qx - cx) / wC, 1);
  const carve = p4 * m4.depth * (1 - smoothstep(0, 1, Math.pow(uu, stC)));

  // relic footprints (silicon): fixed positions, scaled by rise like everything else
  let relic = 0;
  for (const pier of P.piers) {
    const dx = x - pier.x, dz = z - pier.z;
    const s = 1 - smoothstep(0, 1, Math.sqrt(dx * dx + dz * dz) / pier.radius);
    relic += pier.height * s * s;
  }

  const hTerrain = hb + h3 + h6 + h2 - carve + relic;

  // shore ramp near spawn: sloped plane from below to above any plausible sea level, blended in by a disc mask
  const R = P.ramp;
  const rdx = x - R.cx, rdz = z - R.cz;
  const dist = Math.sqrt(rdx * rdx + rdz * rdz);
  const mask = 1 - smoothstep(R.rIn, R.rOut, dist);
  const t = rdx * R.ux + rdz * R.uz;
  const rampH = mix(-P.rampRange * P.A, P.rampRange * P.A, smoothstep(-R.rIn, R.rIn, t)) + P.rampDetail * base;
  const h = mix(hTerrain, rampH, mask);

  return rise * h;
}

// ---------- construction ----------
function need(label: string, obj: Record<string, number> | undefined, keys: readonly string[]) {
  if (!obj) throw new Error(`terrain config: missing ${label}`);
  for (const key of keys) if (typeof obj[key] !== 'number' || !Number.isFinite(obj[key])) throw new Error(`terrain config: ${label}.${key} missing or not a number`);
}

/** Machines a config does not list stay off: filled with harmless in-range params so the shared formula still runs (progress is 0). */
const OFF: Record<MachineId, Record<string, number>> = {
  M2: { rimHeight: 0, bandCenter: 0, bandWidth: 1, patchFreq: 0.01, threshold: 0.5 },
  M3: { halfWidth: 0.1, finHeight: 0, finSpacing: 10, finWarp: 0, finSharp: 1, breakup: 0.5, uplandMin: 0 },
  M4: { depth: 0, widthWet: 10, widthDry: 10, steepWet: 1, steepDry: 1, dryStart: 0.5, dryEnd: 1, meanderAmp: 0, meanderFreq: 0.01, offsetFrac: 0 },
  M5: { bandH: 10, sharpness: 0.5, strength: 0 },
  M6: { moundHeight: 0, bandCenter: 0, bandWidth: 1, moundFreq: 0.01, threshold: 0.5 },
};

export function createTerrain(config: TerrainConfig, seed: number): Terrain {
  need('base', config.base, BASE_KEYS);
  const b = config.base;
  const S = config.patchSize;
  const rng = makeRng(seed)('terrain');
  const u32 = () => Math.floor(rng() * 4294967296) >>> 0;
  const off = () => (rng() - 0.5) * 2000;

  const machines: Partial<Record<MachineId, Record<string, number>>> = {};
  for (const id of MACHINE_IDS) machines[id] = OFF[id];
  for (const m of config.machines) {
    need(`machines.${m.id}.params`, m.params, MACHINE_KEYS[m.id]);
    machines[m.id] = m.params;
  }

  const sBase = u32(), sWx = u32(), sWz = u32(), sM2 = u32(), sM3a = u32(), sM3b = u32(), sM4 = u32(), sM6 = u32();
  const oBaseX = off(), oBaseZ = off(), oWxX = off(), oWxZ = off(), oWzX = off(), oWzZ = off();

  // spawn / shore ramp: centre within 0.25·S of the middle, ramp direction seeded
  const sd = config.spawn.shoreDistance;
  const rr = rng();
  const cAng = rng() * TWO_PI;
  const rAng = rng() * TWO_PI;
  const ramp = {
    cx: Math.cos(cAng) * (0.05 + 0.2 * rr) * S, cz: Math.sin(cAng) * (0.05 + 0.2 * rr) * S,
    ux: Math.cos(rAng), uz: Math.sin(rAng),
    rIn: 2 * sd, rOut: 2.8 * sd,
  };
  const m3Ang = rng() * Math.PI;
  const m4x = ((rng() * 2 - 1) * machines.M4!.offsetFrac) * S;

  // relics (silicon only): seeded positions away from the ramp disc
  const relics: Relic[] = [];
  const piers: TerrainParams['piers'] = [];
  const rrng = makeRng(seed)('relics');
  for (const rel of config.relics ?? []) {
    need(`relics.${rel.kind}.params`, rel.params, RELIC_KEYS[rel.kind]);
    for (let n = 0; n < rel.count; n++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 60; tries++) {
        x = (rrng() * 2 - 1) * 0.42 * S;
        z = (rrng() * 2 - 1) * 0.42 * S;
        if (Math.hypot(x - ramp.cx, z - ramp.cz) > ramp.rOut + rel.params.radius + (rel.params.span ?? 0)) break;
      }
      const angle = rrng() * Math.PI;
      const span = rel.kind === 'iceArch' ? rel.params.span : 0;
      relics.push({ kind: rel.kind, position: [x, z], params: { height: rel.params.height, radius: rel.params.radius, span, angle } });
      if (rel.kind === 'iceArch') {
        for (const sgn of [-1, 1]) piers.push({ x: x + sgn * 0.5 * span * Math.cos(angle), z: z + sgn * 0.5 * span * Math.sin(angle), height: rel.params.height, radius: rel.params.radius });
      } else {
        piers.push({ x, z, height: rel.params.height, radius: rel.params.radius });
      }
    }
  }

  const params: TerrainParams = {
    patchSize: S,
    A: b.amplitude, freq: b.frequency, oct: Math.floor(b.octaves), lac: b.lacunarity, gain: b.gain,
    warpAmp: b.warpAmp, warpFreq: b.warpFreq, expo: b.exponent, rampRange: b.rampRange, rampDetail: b.rampDetail,
    sBase, sWx, sWz, sM2, sM3a, sM3b, sM4, sM6,
    oBaseX, oBaseZ, oWxX, oWxZ, oWzX, oWzZ,
    ramp, machines, m3dir: [Math.cos(m3Ang), Math.sin(m3Ang)], m4x, piers,
  };

  const height = (x: number, z: number, st: TerrainState) => {
    const pr = st.progress;
    return heightCore(params, st.rise, st.heatSolvent, pr.M2 ?? 0, pr.M3 ?? 0, pr.M4 ?? 0, pr.M5 ?? 0, pr.M6 ?? 0, x, z);
  };
  return { config, seed, params, relics, patchSize: S, height };
}

// ---------- sea level and spawn ----------

/** Heights on a res×res grid of cell centres across the patch (row-major, z outer). */
export function sampleHeights(terrain: Terrain, state: TerrainState, res = 64): Float32Array {
  const out = new Float32Array(res * res);
  const S = terrain.patchSize;
  for (let j = 0; j < res; j++) {
    const z = ((j + 0.5) / res - 0.5) * S;
    for (let i = 0; i < res; i++) out[j * res + i] = terrain.height(((i + 0.5) / res - 0.5) * S, z, state);
  }
  return out;
}

/** Height at which `cover` (0..1) of the samples lie below it. Callers may cache `heights` and reuse this. */
export function seaLevelFromHeights(heights: Float32Array, cover: number): number {
  const sorted = Float32Array.from(heights).sort();
  const n = sorted.length;
  if (cover <= 0) return sorted[0] - 1;
  if (cover >= 1) return sorted[n - 1] + 1;
  const q = cover * n - 0.5;                       // sample i sits at quantile (i+0.5)/n
  const lo = Math.max(0, Math.min(n - 1, Math.floor(q)));
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * Math.max(0, Math.min(1, q - lo));
}

/** Sea level in metres so the fraction of the patch below it equals `cover` (sampled at `res`², default 64²). */
export function seaLevelForCover(terrain: Terrain, state: TerrainState, cover: number, res = 64): number {
  return seaLevelFromHeights(sampleHeights(terrain, state, res), cover);
}

export interface SpawnPoint { x: number; z: number; height: number; shoreFound: boolean }

/**
 * A point on land within `spawn.shoreDistance` of the shoreline. Scans the shore-ramp axis from inland to
 * the sea, finds where the ground drops to `seaLevel`, and steps ~0.3·shoreDistance back inland.
 * `shoreFound` is false if the axis never crosses sea level (e.g. cover 0 or 1); the spawn is then the best land on the axis.
 */
export function spawnPoint(terrain: Terrain, state: TerrainState, seaLevel: number): SpawnPoint {
  const R = terrain.params.ramp;
  const sd = terrain.config.spawn.shoreDistance;
  const at = (t: number) => ({ x: R.cx + R.ux * t, z: R.cz + R.uz * t });
  const hAt = (t: number) => { const p = at(t); return terrain.height(p.x, p.z, state); };
  const step = 1;
  let prevT = R.rIn, prevH = hAt(prevT);
  let best = { t: prevT, h: prevH };
  if (prevH <= seaLevel) {                         // inland end is already under water: take the highest point instead
    for (let t = R.rIn; t >= -R.rIn; t -= step) { const h = hAt(t); if (h > best.h) best = { t, h }; }
    const p = at(best.t);
    return { x: p.x, z: p.z, height: best.h, shoreFound: false };
  }
  for (let t = R.rIn - step; t >= -R.rIn; t -= step) {
    const h = hAt(t);
    if (h <= seaLevel) {
      const tShore = t + step * ((seaLevel - h) / (prevH - h || 1));
      let tSpawn = Math.min(R.rIn, tShore + Math.max(3, 0.3 * sd));
      while (tSpawn < R.rIn && hAt(tSpawn) <= seaLevel + 0.25) tSpawn += step;   // never start wading
      const p = at(tSpawn);
      return { x: p.x, z: p.z, height: hAt(tSpawn), shoreFound: true };
    }
    prevT = t; prevH = h;
  }
  const p = at(-R.rIn);                            // all land along the axis: no shore here
  return { x: p.x, z: p.z, height: hAt(-R.rIn), shoreFound: false };
}
