// L0 analytic terrain (CLAUDE.md "Terrain and landforms"). Pure TS, deterministic per seed.
//
// `heightCore` is THE height formula. src/render/terrainNode.ts mirrors it line for line in TSL.
// If you change one, change the other. Rules that keep the mirror trivial:
//   - only + - * /, sqrt, sin/cos, abs, floor, fract, mix, smoothstep, pow (non-negative base), min/max
//   - no branches (machines are multiplied by their progress, so progress 0 contributes exactly 0)
//   - lattice noise uses a u32 integer hash, so CPU and GPU agree bit-for-bit on the random values
//
// EXCEPTION (basalt pillars, M7): the GPU ground mesh does NOT include the M7 term, because ~2 m vertices would make jaggy blocks
// that z-fight the real hexagonal prisms. The mirror therefore holds for heightCore with p7 = 0; the prisms (render/basaltPillars.ts)
// draw M7 and stand at exactly the CPU tops given by `pillarCell` below, so the player and flora still see them.
//
// Every coefficient comes from TerrainConfig (base + machines[].params + relics[].params); only the
// seed-derived offsets/angles/positions are computed here.
import type { TerrainConfig } from '../worlds/types';
import { makeRng } from '../sim/rng';
import { CELLS, GRID } from '../sim/grid';

export type MachineId = 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9';
export const MACHINE_IDS: MachineId[] = ['M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'];

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
  M7: ['stepH', 'nSteps', 'baseH', 'size', 'bandCenter', 'bandWidth', 'rampClear'],                      // basalt pillars (3D prisms drawn by render/basaltPillars.ts)
  M8: ['domeHeight', 'domeFreq', 'threshold', 'uplandMin', 'stackStep', 'stackSharp', 'stackShare'], // granite domes and tors
  M9: ['spikeHeight', 'size', 'density', 'girth', 'sharp'],                                         // nitride crystal spikes
};
// M5 also reads an optional `offMineral` (0..1, default 1): the share of its strength kept where its listed minerals are absent.
// A machine with `minerals` in config is multiplied by the summed local crust weight of those minerals (absent = everywhere).
export const RELIC_KEYS = { iceSpire: ['height', 'radius'], iceArch: ['height', 'radius', 'span'] } as const;

/** Everything heightCore needs, flat numbers only (the TSL node bakes these as constants). */
export interface TerrainParams {
  patchSize: number;
  A: number; freq: number; oct: number; lac: number; gain: number; warpAmp: number; warpFreq: number; expo: number;
  rampRange: number; rampDetail: number;
  // seed-derived hash seeds (u32) and noise-space offsets
  sBase: number; sWx: number; sWz: number; sM2: number; sM3a: number; sM3b: number; sM4: number; sM6: number;
  sM7: number; sM8: number; sM9a: number; sM9b: number; sCrust: number;   // from their own rng stream, so older seeds' terrain is unchanged
  /** Shared crust weights (see crustScore/crustWeights): quantile thresholds baked once from the 64² cell-centre scores. */
  crust: { k: number; thr: number[]; w: number; nf: number; order: number[]; bands: number[] };   // order[j] = config index of the j-th lowest mineral; bands = elevation indices of the PRESENT minerals (realised share > 0), lowest first; thr[i] separates bands[i] from bands[i+1]
  gates: Partial<Record<MachineId, number[]>>;   // machines gated by minerals: 0/1 per mineral in elevation order (absent = ungated)
  oBaseX: number; oBaseZ: number; oWxX: number; oWxZ: number; oWzX: number; oWzZ: number;
  // shore ramp (spawn area)
  ramp: { cx: number; cz: number; ux: number; uz: number; rIn: number; rOut: number };
  machines: Partial<Record<MachineId, Record<string, number>>>;
  /** true only for machines listed in the config. An unlisted machine runs on OFF params (every height coefficient 0), so its term is exactly 0 and both backends skip it. */
  active: Record<MachineId, boolean>;
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
  /** CPU twin of crustWeightsNode: smooth mineral weights at (x, z) in `crust.minerals` order (sum 1). */
  crustWeights(x: number, z: number): number[];
}

// ---------- primitives (rounding hook `r` lets the f32 test kit emulate GPU precision) ----------
export type Round = (n: number) => number;
const C_ROT = Math.cos(0.5);
const S_ROT = Math.sin(0.5);
export const SQRT3 = Math.sqrt(3);
export const HEX_H = SQRT3 / 2;
export const CRUST_NOISE_WEIGHT = 0.5;   // weight of seeded noise (vs base height) in the crust score; an algorithm constant, patch scale comes from crust.patchCells

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
  /**
   * Closed-form hexagonal tiling, branch-free (nearest of two offset rectangular lattices). (u, v) are in cell units,
   * where neighbouring centres are 1 apart. Returns the hex distance to the centre (0..0.5 at the edge) and integer cell ids.
   */
  const hexCell = (u: number, v: number) => {
    const av = r(v / SQRT3);
    const cuA = Math.floor(u + 0.5), cvA = Math.floor(av + 0.5);
    const cuB = Math.floor(u) + 0.5, cvB = Math.floor(av) + 0.5;
    const dxA = r(u - cuA), dzA = r(v - cvA * SQRT3), dxB = r(u - cuB), dzB = r(v - cvB * SQRT3);
    const dA = r(dxA * dxA + dzA * dzA), dB = r(dxB * dxB + dzB * dzB);
    let t = r(0.5 + (dA - dB) * 1e5);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = mix(dxA, dxB, t), dz = mix(dzA, dzB, t);
    const cu = mix(cuA, cuB, t), cv = mix(cvA, cvB, t);
    const a = Math.abs(dx), b = Math.abs(r(0.5 * dx + HEX_H * dz)), c = Math.abs(r(-0.5 * dx + HEX_H * dz));
    return { hd: Math.max(a, b, c), ix: Math.floor(2 * cu + 0.5), iz: Math.floor(2 * cv + 0.5) };
  };
  return { r, fract, mix, smoothstep, hash, vnoise, fbm, hexCell };
}
export type Kit = ReturnType<typeof makeKit>;
export const kit64: Kit = makeKit((n) => n);
/** Emulates GPU f32 intermediate precision; used by the parity test. */
export const kit32: Kit = makeKit(Math.fround);

export const TWO_PI = Math.PI * 2;

/** Domain warp + base relief: shared by heightCore, the crust score and the threshold bake. bn in [-1,1]. */
export function warpBase(P: TerrainParams, x: number, z: number, k: Kit = kit64) {
  const wx = k.fbm(x * P.warpFreq + P.oWxX, z * P.warpFreq + P.oWxZ, 2, P.lac, P.gain, P.sWx) * P.warpAmp;
  const wz = k.fbm(x * P.warpFreq + P.oWzX, z * P.warpFreq + P.oWzZ, 2, P.lac, P.gain, P.sWz) * P.warpAmp;
  const qx = x + wx, qz = z + wz;
  const f = k.fbm(qx * P.freq + P.oBaseX, qz * P.freq + P.oBaseZ, P.oct, P.lac, P.gain, P.sBase);
  const bn = (f < 0 ? -1 : 1) * Math.pow(Math.abs(f), P.expo);
  return { qx, qz, bn, base: 0.5 * P.A * bn };
}

/** Crust score: base height (no machines) mixed with seeded noise at `patchCells` scale. Higher = higher-elevation minerals. */
export function crustScore(P: TerrainParams, bn: number, x: number, z: number, k: Kit = kit64): number {
  return k.r((1 - CRUST_NOISE_WEIGHT) * (0.5 + 0.5 * bn) + CRUST_NOISE_WEIGHT * k.vnoise(x * P.crust.nf, z * P.crust.nf, P.sCrust));
}

/** Smooth weights per mineral in ELEVATION order (length k, absent minerals exactly 0, sum 1): successive smoothsteps across the baked thresholds of the present minerals. */
export function crustWeights(P: TerrainParams, score: number, k: Kit = kit64): number[] {
  const { thr, w, bands } = P.crust;
  const out = new Array<number>(P.crust.k).fill(0);
  if (bands.length === 0) return out;
  let prev = 1;
  for (let i = 0; i < bands.length; i++) {
    const next = i < thr.length ? k.smoothstep(thr[i] - w, thr[i] + w, score) : 0;
    out[bands[i]] = prev - next;
    prev = next;
  }
  return out;
}

/** One basalt pillar cell of the M7 hex lattice (ids ix, iz as in Kit.hexCell). `ground` is the surface at the cell centre without M7
 *  (so the prism top is flat); the top is `rise * (ground + p7 * step)`. `present` = the cell sits in the coastal band on an M7 mineral. */
export interface PillarCell { cx: number; cz: number; ground: number; step: number; present: boolean; gate: number; band: number }
export function pillarCell(
  P: TerrainParams, ix: number, iz: number, hs: number,
  p2: number, p3: number, p4: number, p5: number, p6: number, p8: number, p9: number, k: Kit = kit64,
): PillarCell {
  const m7 = P.machines.M7!;
  const cx = ix * 0.5 * m7.size, cz = iz * 0.5 * SQRT3 * m7.size;
  const ground = heightCore(P, 1, hs, p2, p3, p4, p5, p6, cx, cz, k, 0, p8, p9);
  const g = P.gates.M7;
  const cw = g ? crustWeights(P, crustScore(P, warpBase(P, cx, cz, k).bn, cx, cz, k), k) : [];
  const gate = g ? g.reduce((a, c, j) => a + c * (cw[j] ?? 0), 0) : 1;
  const band = 1 - k.smoothstep(0, 1, Math.abs(ground / (0.5 * P.A) - m7.bandCenter) / m7.bandWidth);
  // Spawn ramp: a flat-topped pillar on a slope is a cliff, so cells where the ramp mask exceeds `rampClear` stay smooth ground
  // (the walk from the spawn to the sea has no steps); pillars take over beyond it.
  const R = P.ramp;
  const mask = 1 - k.smoothstep(R.rIn, R.rOut, Math.sqrt((cx - R.cx) ** 2 + (cz - R.cz) ** 2));
  const q = Math.floor(k.hash(ix, iz, P.sM7) * m7.nSteps);
  const step = m7.baseH + m7.stepH * q;
  return { cx, cz, ground, step, present: band > 0.5 && gate > 0.5 && mask <= m7.rampClear, gate, band };
}

/**
 * The height formula. Metres. `pr` = progress per machine (missing → 0).
 * Order: warp → base fBm → M5 strata → + M3 fins + M6 mounds + M2 crusts + M8 domes + M9 crystals − M4 canyon + relic piers
 * → shore ramp → M7 pillar tops replace the surface in pillar cells (post-ramp, so they can stand on the coast) → × rise.
 * p7..p9 trail the signature so older callers keep working.
 */
export function heightCore(
  P: TerrainParams, rise: number, hs: number,
  p2: number, p3: number, p4: number, p5: number, p6: number,
  x: number, z: number, k: Kit = kit64,
  p7 = 0, p8 = 0, p9 = 0,
): number {
  const { fract, mix, smoothstep, fbm, vnoise, hash, hexCell } = k;
  const M = P.machines;
  const on = P.active;

  // domain warp + base relief: bn in [-1,1]
  const { qx, qz, bn, base } = warpBase(P, x, z, k);

  // shared crust weights (elevation order); a machine with `minerals` is multiplied by the summed weight of its minerals
  const cw = Object.keys(P.gates).length ? crustWeights(P, crustScore(P, bn, x, z, k), k) : [];
  const gateOf = (id: MachineId) => { const g = P.gates[id]; return g ? g.reduce((a, c, j) => a + c * (cw[j] ?? 0), 0) : 1; };

  // M5 strata terraces (smooth staircase blended in by progress)
  let hb = base;
  if (on.M5) {
    const m5 = M.M5!;
    const u5 = base / m5.bandH;
    const w5 = Math.max(0.02, 0.5 * (1 - m5.sharpness));
    const stepped = m5.bandH * (Math.floor(u5) + smoothstep(0.5 - w5, 0.5 + w5, fract(u5)));
    const s5 = m5.strength * (P.gates.M5 ? m5.offMineral + (1 - m5.offMineral) * gateOf('M5') : 1);
    hb = base + p5 * s5 * (stepped - base);
  }

  // M3 hoodoos / frost fins: only near the freezing point (heatSolvent ≈ 0.5), uplands only
  let h3 = 0;
  if (on.M3) {
    const m3 = M.M3!;
    const g3 = 1 - smoothstep(0, m3.halfWidth, Math.abs(hs - 0.5));
    const up3 = smoothstep(m3.uplandMin, m3.uplandMin + 0.3, bn);
    const wf3 = 1 / (m3.finSpacing * 2.5);
    const along = qx * P.m3dir[0] + qz * P.m3dir[1] + m3.finWarp * fbm(qx * wf3, qz * wf3, 2, P.lac, P.gain, P.sM3a);
    const fin = Math.pow(Math.max(0.5 + 0.5 * Math.cos(TWO_PI * (along / m3.finSpacing)), 0), m3.finSharp);
    const bf3 = 1 / (m3.finSpacing * 1.5);
    const brk3 = smoothstep(m3.breakup, m3.breakup + 0.25, vnoise(qx * bf3, qz * bf3, P.sM3b));
    h3 = p3 * g3 * up3 * m3.finHeight * fin * brk3 * gateOf('M3');
  }

  // M6 shell-stone mounds in the shallows (band of base elevation)
  let h6 = 0;
  if (on.M6) {
    const m6 = M.M6!;
    const band6 = 1 - smoothstep(0, 1, Math.abs(bn - m6.bandCenter) / m6.bandWidth);
    const mound6 = smoothstep(m6.threshold, m6.threshold + 0.2, vnoise(qx * m6.moundFreq, qz * m6.moundFreq, P.sM6));
    h6 = p6 * m6.moundHeight * band6 * mound6 * gateOf('M6');
  }

  // M2 silicon crystal-crust rims at the sea margin (band of base elevation)
  let h2 = 0;
  if (on.M2) {
    const m2 = M.M2!;
    const band2 = 1 - smoothstep(0, 1, Math.abs(bn - m2.bandCenter) / m2.bandWidth);
    const crust2 = smoothstep(m2.threshold, m2.threshold + 0.25, vnoise(qx * m2.patchFreq, qz * m2.patchFreq, P.sM2));
    h2 = p2 * m2.rimHeight * band2 * crust2 * gateOf('M2');
  }

  // M8 granite domes and stacked-boulder tors on highlands: smooth domes, partly quantised into rounded stacked steps
  let h8 = 0;
  if (on.M8) {
    const m8 = M.M8!;
    const dome = smoothstep(m8.threshold, m8.threshold + 0.3, vnoise(qx * m8.domeFreq, qz * m8.domeFreq, P.sM8));
    const up8 = smoothstep(m8.uplandMin, m8.uplandMin + 0.3, bn);
    const dH = m8.domeHeight * dome;
    const u8 = dH / m8.stackStep;
    const w8 = Math.max(0.02, 0.5 * (1 - m8.stackSharp));
    const stack8 = m8.stackStep * (Math.floor(u8) + smoothstep(0.5 - w8, 0.5 + w8, fract(u8)));
    h8 = p8 * up8 * (dH + m8.stackShare * (stack8 - dH)) * gateOf('M8');
  }

  // M9 nitride crystals: sparse tall hexagonal spikes, one per chosen hex cell
  let h9 = 0;
  if (on.M9) {
    const m9 = M.M9!;
    const hx9 = hexCell(x / m9.size, z / m9.size);
    const here9 = smoothstep(1 - m9.density, 1 - m9.density + 0.04, hash(hx9.ix, hx9.iz, P.sM9a));
    const tall9 = 0.5 + 0.5 * hash(hx9.ix, hx9.iz, P.sM9b);
    const tip9 = Math.pow(Math.max(1 - hx9.hd / (0.5 * m9.girth), 0), m9.sharp);
    h9 = p9 * m9.spikeHeight * here9 * tall9 * tip9 * gateOf('M9');
  }

  // M4 canyon: depth ∝ progress; walls steepen with dry heat
  let carve = 0;
  if (on.M4) {
    const m4 = M.M4!;
    const cx = P.m4x + m4.meanderAmp * fbm(z * m4.meanderFreq + 7.3, 0.5, 2, P.lac, P.gain, P.sM4);
    const dry = smoothstep(m4.dryStart, m4.dryEnd, hs);
    const wC = mix(m4.widthWet, m4.widthDry, dry);
    const stC = mix(m4.steepWet, m4.steepDry, dry);
    const uu = Math.min(Math.abs(qx - cx) / wC, 1);
    carve = p4 * m4.depth * (1 - smoothstep(0, 1, Math.pow(uu, stC))) * gateOf('M4');
  }

  // relic footprints (silicon): fixed positions, scaled by rise like everything else
  let relic = 0;
  for (const pier of P.piers) {
    const dx = x - pier.x, dz = z - pier.z;
    const s = 1 - smoothstep(0, 1, Math.sqrt(dx * dx + dz * dz) / pier.radius);
    relic += pier.height * s * s;
  }

  const hTerrain = hb + h3 + h6 + h2 + h8 + h9 - carve + relic;

  // shore ramp near spawn: sloped plane from below to above any plausible sea level, blended in by a disc mask
  const R = P.ramp;
  const rdx = x - R.cx, rdz = z - R.cz;
  const dist = Math.sqrt(rdx * rdx + rdz * rdz);
  const mask = 1 - smoothstep(R.rIn, R.rOut, dist);
  const t = rdx * R.ux + rdz * R.uz;
  const rampH = mix(-P.rampRange * P.A, P.rampRange * P.A, smoothstep(-R.rIn, R.rIn, t)) + P.rampDetail * base;
  const hf = mix(hTerrain, rampH, mask);

  // M7 basalt pillars: whole hexagonal cells are flat-topped prisms (see pillarCell). The GPU ground mesh skips this term (file header).
  if (on.M7 && p7 > 0) {
    const m7 = M.M7!;
    const hx7 = hexCell(x / m7.size, z / m7.size);
    const pc = pillarCell(P, hx7.ix, hx7.iz, hs, p2, p3, p4, p5, p6, p8, p9, k);
    if (pc.present) return rise * (pc.ground + p7 * pc.step);
  }
  return rise * hf;
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
  M7: { stepH: 0, nSteps: 1, baseH: 0, size: 10, bandCenter: 0, bandWidth: 1, rampClear: 1 },
  M8: { domeHeight: 0, domeFreq: 0.01, threshold: 0.5, uplandMin: 0, stackStep: 1, stackSharp: 0.5, stackShare: 0 },
  M9: { spikeHeight: 0, size: 10, density: 0.1, girth: 0.5, sharp: 1 },
};

const SHARE_MARGIN = 0.001;   // realised shares stay this far inside the bounds, so rounding to whole cells can't leave them

/** Target share per mineral (config order), sampled inside the bounds from the world seed and normalised to sum 1. */
export function sampleShares(minerals: { share: [number, number] }[], rng: () => number): number[] {
  // a mineral with hi <= 0 is absent (share exactly 0); a narrow band gets a proportionally smaller margin so lo <= hi always holds
  const lo: number[] = [], hi: number[] = [];
  for (const m of minerals) {
    const a = Math.max(0, m.share[0]), b = Math.max(0, m.share[1]);
    const mg = Math.min(SHARE_MARGIN, Math.max(0, b - a) / 4);
    lo.push(b <= 0 ? 0 : a + mg); hi.push(b <= 0 ? 0 : b - mg);
  }
  const fix = (v: number[]) => { const sum = v.reduce((a, b) => a + b, 0); return sum > 0 ? v.map((x) => x / sum) : v; };
  for (let attempt = 0; attempt < 200; attempt++) {
    const norm = fix(minerals.map((_, i) => lo[i] + (hi[i] - lo[i]) * rng()));
    if (norm.every((x, i) => x >= lo[i] - 1e-12 && x <= hi[i] + 1e-12)) return norm;
  }
  return fix(minerals.map((m, i) => (hi[i] > 0 ? (m.share[0] + m.share[1]) / 2 : 0)));   // fallback: bounds midpoints, normalised
}

export function createTerrain(config: TerrainConfig, seed: number): Terrain {
  need('base', config.base, BASE_KEYS);
  const b = config.base;
  const S = config.patchSize;
  const rng = makeRng(seed)('terrain');
  const u32 = () => Math.floor(rng() * 4294967296) >>> 0;
  const off = () => (rng() - 0.5) * 2000;

  const machines: Partial<Record<MachineId, Record<string, number>>> = {};
  for (const id of MACHINE_IDS) machines[id] = OFF[id];
  const active = {} as Record<MachineId, boolean>;
  for (const id of MACHINE_IDS) active[id] = false;
  for (const m of config.machines) {
    active[m.id] = true;
    need(`machines.${m.id}.params`, m.params, MACHINE_KEYS[m.id]);
    machines[m.id] = m.id === 'M5' ? { offMineral: 1, ...m.params } : m.params;
  }

  const sBase = u32(), sWx = u32(), sWz = u32(), sM2 = u32(), sM3a = u32(), sM3b = u32(), sM4 = u32(), sM6 = u32();
  const oBaseX = off(), oBaseZ = off(), oWxX = off(), oWxZ = off(), oWzX = off(), oWzZ = off();
  const frng = makeRng(seed)('forms');   // own stream: adding landforms must not shift the older terrain's random values
  const fu32 = () => Math.floor(frng() * 4294967296) >>> 0;
  const sM7 = fu32(), sM8 = fu32(), sM9a = fu32(), sM9b = fu32(), sCrust = fu32();

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

  const crustMinerals = config.crust.minerals;
  if (crustMinerals.length > 8) throw new Error('terrain config: at most 8 crust minerals per world');
  const order = crustMinerals.map((_, i) => i).sort((a, b) => crustMinerals[a].elevation - crustMinerals[b].elevation || a - b);
  const gateFor = (ids: string[] | undefined) => ids ? order.map((ci) => (ids.includes(crustMinerals[ci].id) ? 1 : 0)) : undefined;
  const gates: TerrainParams['gates'] = {};
  for (const m of config.machines) { const g = gateFor(m.minerals); if (g) gates[m.id] = g; }
  const relics: Relic[] = [];
  const piers: TerrainParams['piers'] = [];

  const params: TerrainParams = {
    patchSize: S,
    A: b.amplitude, freq: b.frequency, oct: Math.floor(b.octaves), lac: b.lacunarity, gain: b.gain,
    warpAmp: b.warpAmp, warpFreq: b.warpFreq, expo: b.exponent, rampRange: b.rampRange, rampDetail: b.rampDetail,
    sBase, sWx, sWz, sM2, sM3a, sM3b, sM4, sM6, sM7, sM8, sM9a, sM9b, sCrust,
    crust: { k: crustMinerals.length, thr: [], w: 0.03, nf: 1 / (Math.max(1, config.crust.patchCells) * (S / GRID)), order, bands: [] }, gates,
    oBaseX, oBaseZ, oWxX, oWxZ, oWzX, oWzZ,
    ramp, machines, active, m3dir: [Math.cos(m3Ang), Math.sin(m3Ang)], m4x, piers,
  };

  // bake the crust thresholds: quantiles of the score at the 64² cell centres, so realised shares land on the sampled shares
  {
    const sc = new Float64Array(CELLS);
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const cxm = ((i + 0.5) / GRID - 0.5) * S, czm = ((j + 0.5) / GRID - 0.5) * S;
      sc[j * GRID + i] = crustScore(params, warpBase(params, cxm, czm).bn, cxm, czm);
    }
    const sorted = Float64Array.from(sc).sort();
    const shares = sampleShares(crustMinerals, makeRng(seed)('crust'));
    const cellsOf = order.map((ci) => Math.round(shares[ci] * CELLS));
    const present = order.map((_, j) => j).filter((j) => cellsOf[j] > 0);   // elevation indices; absent minerals get no band
    let pos = 0;
    const thr: number[] = [];
    for (let b = 0; b < present.length - 1; b++) {
      pos += cellsOf[present[b]];
      thr.push((sorted[pos - 1] + sorted[pos]) / 2);
    }
    params.crust.bands = present;
    let gap = Infinity;
    for (let j = 0; j + 1 < thr.length; j++) gap = Math.min(gap, thr[j + 1] - thr[j]);
    params.crust.thr = thr;
    params.crust.w = Math.min(0.03, 0.4 * gap);   // narrow enough that at most one blend is active between two thresholds, so argmax = region
  }

  // relics (silicon only): seeded positions in a ring just outside the ramp disc, biased to the default camera's side
  // (yaw 0 looks down -z). The spawn sits within ~20 m of the ramp centre (the shore is where the ramp crosses sea level),
  // so the ring puts a few relics 60-150 m from spawn and ahead of it. If the cone falls outside the patch, any direction does.
  // With `minerals` set, a relic takes the first try whose crust weight there is >= 0.5, else the best clear try.
  const rrng = makeRng(seed)('relics');
  const placed: [number, number][] = [];
  for (const rel of config.relics ?? []) {
    need(`relics.${rel.kind}.params`, rel.params, RELIC_KEYS[rel.kind]);
    for (let n = 0; n < rel.count; n++) {
      let x = 0, z = 0;
      const ring = ramp.rOut + rel.params.radius + 0.5 * (rel.params.span ?? 0);
      const relGate = gateFor(rel.minerals);
      const wOf = (px: number, pz: number) => {   // summed crust weight of the minerals this relic may stand on (1 if unrestricted)
        if (!relGate) return 1;
        const w = crustWeights(params, crustScore(params, warpBase(params, px, pz).bn, px, pz));
        return relGate.reduce((a: number, g: number, j) => a + g * w[j], 0);
      };
      let best: { x: number; z: number; w: number } | undefined;
      for (let tries = 0; tries < 90; tries++) {
        const a = tries < 60 ? -Math.PI / 2 + (rrng() * 2 - 1) * (55 * Math.PI / 180) : rrng() * TWO_PI;
        const rho = ring + rrng() * 70;
        x = ramp.cx + Math.cos(a) * rho;
        z = ramp.cz + Math.sin(a) * rho;
        const clear = placed.every(([px, pz]) => Math.hypot(x - px, z - pz) > 40);
        const inside = Math.abs(x) <= 0.46 * S && Math.abs(z) <= 0.46 * S;
        const w = inside && (clear || tries >= 75) ? wOf(x, z) : 0;
        if (inside && (clear || tries >= 75) && w >= 0.5) break;   // good ground for this relic
        if (inside && clear && (!best || w > best.w)) best = { x, z, w };
        // end of the camera-side cone, or out of tries: settle for the best-weighted clear spot seen, else the original rule
        if (best && (tries === 29 || tries >= 75)) { x = best.x; z = best.z; break; }
        if (!best && tries >= 75 && inside) break;
      }
      placed.push([x, z]);
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

  const height = (x: number, z: number, st: TerrainState) => {
    const pr = st.progress;
    return heightCore(params, st.rise, st.heatSolvent, pr.M2 ?? 0, pr.M3 ?? 0, pr.M4 ?? 0, pr.M5 ?? 0, pr.M6 ?? 0, x, z, kit64, pr.M7 ?? 0, pr.M8 ?? 0, pr.M9 ?? 0);
  };
  const crustWeightsAt = (x: number, z: number) => {
    const w = crustWeights(params, crustScore(params, warpBase(params, x, z).bn, x, z));
    const out = new Array<number>(crustMinerals.length).fill(0);
    order.forEach((ci, j) => { out[ci] = w[j]; });
    return out;
  };
  return { config, seed, params, relics, patchSize: S, height, crustWeights: crustWeightsAt };
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
