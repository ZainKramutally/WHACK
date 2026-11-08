// Ground colours for the inspect card's live views: the crust's rock, never the old fixed Red World ground.
import { mineralColour } from './crustLook';
import type { VisualInputs, WorldConfig } from '../worlds/types';

type CrustIn = Pick<VisualInputs['terrain'], 'crust' | 'crustWeights'>;

/** Plate colour for a clicked cell: the crust's argmax mineral at the cell centre, else the world's dominant mineral. */
export function cellPlateColour(terrain: CrustIn, x: number, z: number, rust: number, world: Pick<WorldConfig, 'terrain'>): number {
  const c = terrain.crust;
  const w = terrain.crustWeights?.(x, z) ?? c?.weights(x, z);
  if (c && w && w.length) {
    let best = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    const m = c.minerals[best];
    if (m) return mineralColour(m.id, m.oxidises ? rust : 0);
  }
  return dominantMineralColour(world, rust);
}

/** A world's dominant mineral (largest mean share), at the given rust. */
export function dominantMineralColour(world: Pick<WorldConfig, 'terrain'>, rust: number): number {
  const ms = world.terrain.crust.minerals;
  let best = ms[0];
  for (const m of ms) if (m.share[0] + m.share[1] > best.share[0] + best.share[1]) best = m;
  return mineralColour(best.id, best.oxidises ? rust : 0);
}

/** The other world's default rock, unrusted: the bed/base of the sea and ground views. */
export function otherGroundColour(other: Pick<WorldConfig, 'terrain'>): number {
  const id = other.terrain.crust.defaultPick;
  return id ? mineralColour(id, 0) : dominantMineralColour(other, 0);
}
