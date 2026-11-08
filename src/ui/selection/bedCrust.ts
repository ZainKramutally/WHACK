// The only place the box reads the world's crust: the demo seed's mineral shares and the oxygen rust factor.
import { crustMap, rust } from '../../gen/crust';
import type { MineralDef, WorldConfig } from '../../worlds/types';

const cache = new WeakMap<WorldConfig, number[]>();

export function crustMinerals(world: WorldConfig): MineralDef[] {
  return world.terrain.crust.minerals;
}

/** Share per mineral id, summing to 1. Cached per world: crustMap builds terrain. */
export function bedShares(world: WorldConfig): Record<string, number> {
  const ms = crustMinerals(world);
  let sh = cache.get(world);
  if (!sh) { sh = crustMap(world, world.demoSeed).shares; cache.set(world, sh); }
  return Object.fromEntries(ms.map((m, i) => [m.id, sh![i]]));
}

/** 0..1: how far oxidising rock has rusted at this oxygen percentage. */
export function bedRust(world: WorldConfig, oxygenPct: number): number {
  return rust(world, oxygenPct);
}
