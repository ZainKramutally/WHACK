// The plants the world places in one flora cell, for the producer card's live view. Pure (no three.js): it runs the
// world's own placement (floraLib/place.ts placePlants) on the cell's neighbourhood and keeps the plants that land in
// the cell, so the card shows the same archetypes, sizes, yaws, value step and glow the world draws there.
import type { VisualInputs } from '../worlds/types';
import { FLORA_GRID, cellAt, cellCentre } from './layout';
import { placePlants, type Clearing, type PlantList } from './floraLib/place';

/** Cells kept around the clicked one: its giant is picked per 5 × 5 superblock, which a ±4 window always covers. */
export const NEAR_CELLS = 4;

/**
 * Indices into `out` of the plants placePlants puts in `cell`, seen from `cam` (so distance thinning matches what the
 * player clicked) or, if that leaves none, from the cell's own centre. Only the cell's ±NEAR_CELLS neighbourhood keeps
 * its biomass, so this places a few dozen plants, not the whole patch. `out` needs room for ~81 cells' plants (2048).
 * `clearing`: the world's spawn clearing (flora.setClearing), so plants the world clears there stay out of the card.
 */
export function plantsInCell(
  inputs: VisualInputs, patch: number, cell: number, cam: { x: number; z: number }, out: PlantList, clearing: Clearing | null = null,
): number[] {
  const flora = new Float32Array(inputs.flora.length);
  const col = cell % FLORA_GRID, row = Math.floor(cell / FLORA_GRID);
  for (let j = Math.max(0, row - NEAR_CELLS); j <= Math.min(FLORA_GRID - 1, row + NEAR_CELLS); j++) {
    for (let i = Math.max(0, col - NEAR_CELLS); i <= Math.min(FLORA_GRID - 1, col + NEAR_CELLS); i++) {
      const c = j * FLORA_GRID + i;
      flora[c * 2] = inputs.flora[c * 2] ?? 0; flora[c * 2 + 1] = inputs.flora[c * 2 + 1] ?? 0;
    }
  }
  const near = { ...inputs, flora };
  for (const from of [cam, cellCentre(cell, patch)]) {
    placePlants(near, patch, from, out, undefined, clearing); // the world's spawn clearing too, so the card never shows cleared plants
    const mine: number[] = [];
    for (let i = 0; i < out.n; i++) if (cellAt(out.x[i], out.z[i], patch) === cell) mine.push(i);
    if (mine.length) return mine;
  }
  return [];
}
