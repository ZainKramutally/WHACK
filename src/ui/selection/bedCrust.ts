// The only place the box reads the world's crust. Interim: shares are the normalised midpoints of each mineral's
// `share` range and rust is oxygen ÷ rustOxygen. When src/gen/crust.ts lands, swap the two bodies for
// `crustMap(world, world.demoSeed).shares` and `rust(world, oxygenPct)`.
import type { MineralDef, WorldConfig } from '../../worlds/types';

export function crustMinerals(world: WorldConfig): MineralDef[] {
  return world.terrain.crust?.minerals ?? [];
}

/** Share per mineral id, summing to 1. Empty when the world has no crust. */
export function bedShares(world: WorldConfig): Record<string, number> {
  const ms = crustMinerals(world);
  const mid = ms.map((m) => (m.share[0] + m.share[1]) / 2);
  const sum = mid.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(ms.map((m, i) => [m.id, mid[i] / sum]));
}

/** 0..1: how far oxidising rock has rusted at this oxygen percentage. */
export function bedRust(world: WorldConfig, oxygenPct: number): number {
  const ro = world.terrain.crust?.rustOxygen ?? 0;
  return ro > 0 ? Math.min(1, Math.max(0, oxygenPct / ro)) : 0;
}
