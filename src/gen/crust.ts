// Seeded crust map (docs/features/crust.md): one mineral per cell of the 64² grid. Pure and deterministic from (world, seed).
import { CELLS, GRID } from '../sim/grid';
import { CRUST_PICKS } from '../worlds/controls';
import type { CrustPickId, MineralDef, WorldConfig } from '../worlds/types';
import { createTerrain } from './terrain';

export interface CrustMap { mineral: Uint8Array; shares: number[] }

function crustOf(world: WorldConfig) {
  const c = world.terrain.crust;
  if (!c) throw new Error(`world ${world.id} has no terrain.crust`);
  return c;
}

/**
 * One mineral per 64² cell: the argmax of the terrain's shared crust weights (gen/terrain.ts crustWeights) at the cell centre,
 * so the sim's cell mineral always equals what the ground look shows there. Thresholds are baked in createTerrain from the
 * sampled shares, so realised shares land inside each mineral's bounds.
 */
export function crustMap(world: WorldConfig, seed: number): CrustMap {
  const minerals = crustOf(world).minerals;
  const terrain = createTerrain(world.terrain, seed);
  const S = world.terrain.patchSize;
  const mineral = new Uint8Array(CELLS);
  const counts = new Array<number>(minerals.length).fill(0);
  for (let row = 0; row < GRID; row++) {
    const z = ((row + 0.5) / GRID - 0.5) * S;
    for (let col = 0; col < GRID; col++) {
      const w = terrain.crustWeights(((col + 0.5) / GRID - 0.5) * S, z);
      let best = 0;
      for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
      mineral[row * GRID + col] = best;
      counts[best]++;
    }
  }
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

const derived = new WeakMap<WorldConfig, Map<string, WorldConfig>>();

/**
 * The world a run uses when the player picks a rock chip: the picked chip's mineral's share bounds sit at `crust.favour`, the others
 * share the rest in proportion to their bound midpoints. Pure, memoised per (world, pick id). No id, or an unknown or unpickable id,
 * returns `world` itself, so object identity keys every cache.
 */
export function withCrustChoice(world: WorldConfig, pickId?: CrustPickId): WorldConfig {
  const crust = world.terrain.crust;
  const picked = pickId ? crust?.minerals.find((m) => m.pick?.id === pickId) : undefined;
  if (!picked) return world;
  let byId = derived.get(world);
  if (!byId) { byId = new Map(); derived.set(world, byId); }
  let out = byId.get(pickId!);
  if (!out) {
    const HALF = 0.01;
    const mid = (m: MineralDef) => (m.share[0] + m.share[1]) / 2;
    const rest = crust.minerals.filter((m) => m !== picked).reduce((a, m) => a + mid(m), 0);
    const minerals = crust.minerals.map((m): MineralDef => {
      const t = m === picked ? crust.favour : ((1 - crust.favour) * mid(m)) / rest;
      return { ...m, share: [t - HALF, t + HALF] };
    });
    // The Conditions panel's Ground row says which rock was picked.
    const facts = world.facts.map((f) => (f.id === 'rock' ? { ...f, value: `Mostly ${picked.label.replace(/ \(.*\)/, '').toLowerCase()} (${CRUST_PICKS.find((c) => c.id === pickId)!.label})` } : f));
    out = { ...world, facts, terrain: { ...world.terrain, crust: { ...crust, minerals } } };
    byId.set(pickId!, out);
  }
  return out;
}
