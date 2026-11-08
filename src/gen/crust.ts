// Seeded crust map (docs/features/crust.md): one mineral per cell of the 64² grid. Pure and deterministic from (world, seed).
import { CELLS, GRID } from '../sim/grid';
import { makeRng } from '../sim/rng';
import type { MineralDef, WorldConfig } from '../worlds/types';
import { createTerrain, sampleHeights } from './terrain';

export interface CrustMap { mineral: Uint8Array; shares: number[] }

const NOISE_WEIGHT = 0.5;   // how much seeded noise (vs height rank) decides a cell's place in the order
const SHARE_MARGIN = 0.001; // realised shares stay this far inside the bounds, so rounding to whole cells can't leave them

function crustOf(world: WorldConfig) {
  const c = world.terrain.crust;
  if (!c) throw new Error(`world ${world.id} has no terrain.crust`);
  return c;
}

/** Rank of each value among all, scaled to 0..1 (ties broken by index). */
function ranks(v: ArrayLike<number>): Float64Array {
  const idx = Array.from({ length: v.length }, (_, i) => i).sort((a, b) => v[a] - v[b] || a - b);
  const out = new Float64Array(v.length);
  idx.forEach((cell, r) => { out[cell] = r / (v.length - 1); });
  return out;
}

/** Smooth value noise over the grid, lattice spacing `scale` cells. */
function noiseField(rng: () => number, scale: number): Float64Array {
  const n = Math.ceil(GRID / scale) + 2;
  const lat = Float64Array.from({ length: n * n }, () => rng());
  const sm = (t: number) => t * t * (3 - 2 * t);
  const out = new Float64Array(CELLS);
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const fx = col / scale, fz = row / scale;
      const x0 = Math.floor(fx), z0 = Math.floor(fz);
      const tx = sm(fx - x0), tz = sm(fz - z0);
      const a = lat[z0 * n + x0], b = lat[z0 * n + x0 + 1], c = lat[(z0 + 1) * n + x0], d = lat[(z0 + 1) * n + x0 + 1];
      out[row * GRID + col] = (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
    }
  }
  return out;
}

function sampleShares(minerals: MineralDef[], rng: () => number): number[] {
  const n = minerals.length;
  const lo = minerals.map((m) => m.share[0] + SHARE_MARGIN), hi = minerals.map((m) => m.share[1] - SHARE_MARGIN);
  for (let attempt = 0; attempt < 200; attempt++) {
    const s = minerals.map((_, i) => lo[i] + (hi[i] - lo[i]) * rng());
    const sum = s.reduce((a, b) => a + b, 0);
    const norm = s.map((x) => x / sum);
    if (norm.every((x, i) => x >= lo[i] && x <= hi[i])) return norm;
  }
  const mid = minerals.map((m) => (m.share[0] + m.share[1]) / 2);   // fallback: bounds midpoints, normalised
  const sum = mid.reduce((a, b) => a + b, 0);
  return mid.slice(0, n).map((x) => x / sum);
}

export function crustMap(world: WorldConfig, seed: number): CrustMap {
  const crust = crustOf(world);
  const minerals = crust.minerals;
  const rng = makeRng(seed)('crust');
  const terrain = createTerrain(world.terrain, seed);
  const heights = sampleHeights(terrain, { rise: 1, progress: {}, heatSolvent: 0.5 });
  const h = ranks(heights);
  const nz = ranks(noiseField(rng, Math.max(1, crust.patchCells)));
  const score = new Float64Array(CELLS);
  for (let i = 0; i < CELLS; i++) score[i] = (1 - NOISE_WEIGHT) * h[i] + NOISE_WEIGHT * nz[i];
  const order = Array.from({ length: CELLS }, (_, i) => i).sort((a, b) => score[a] - score[b] || a - b);

  const shares = sampleShares(minerals, rng);
  const byElev = minerals.map((_, i) => i).sort((a, b) => minerals[a].elevation - minerals[b].elevation);
  const mineral = new Uint8Array(CELLS);
  const counts = new Array<number>(minerals.length).fill(0);
  let pos = 0;
  byElev.forEach((mi, k) => {
    const count = k === byElev.length - 1 ? CELLS - pos : Math.round(shares[mi] * CELLS);
    for (let j = 0; j < count; j++) mineral[order[pos + j]] = mi;
    counts[mi] = count;
    pos += count;
  });
  return { mineral, shares: counts.map((c) => c / CELLS) };
}

/** Starting nutrient per cell: base ledger supply × mineral multiplier, renormalised so each element's patch mean equals base. */
export function cellSupply(world: WorldConfig, map: CrustMap): { c: Float64Array; si: Float64Array; o: Float64Array } {
  const minerals = crustOf(world).minerals;
  const led = world.life.ledger;
  const base = { c: led.supplyC ?? 0, si: led.supplySi ?? 0, o: led.supplyO ?? 0 };
  const out = { c: new Float64Array(CELLS), si: new Float64Array(CELLS), o: new Float64Array(CELLS) };
  for (const el of ['c', 'si', 'o'] as const) {
    if (base[el] === 0) continue;
    let mean = 0;
    for (let i = 0; i < CELLS; i++) mean += minerals[map.mineral[i]].supply[el];
    mean /= CELLS;
    if (mean === 0) continue;
    for (let i = 0; i < CELLS; i++) out[el][i] = (base[el] * minerals[map.mineral[i]].supply[el]) / mean;
  }
  return out;
}

/** Mineral under a world position (metres, patch centred on the origin; col along x, row along z). */
export function mineralAt(world: WorldConfig, map: CrustMap, x: number, z: number): MineralDef {
  const S = world.terrain.patchSize;
  const clamp = (v: number) => Math.min(GRID - 1, Math.max(0, Math.floor(v)));
  const col = clamp((x / S + 0.5) * GRID), row = clamp((z / S + 0.5) * GRID);
  return crustOf(world).minerals[map.mineral[row * GRID + col]];
}

/** 0..1: how far oxidising rock has rusted at this oxygen (%). */
export function rust(world: WorldConfig, oxygenPct: number): number {
  return Math.min(1, Math.max(0, oxygenPct / crustOf(world).rustOxygen));
}
