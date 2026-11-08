import { describe, expect, it } from 'vitest';
import { cellAt, cellCentre, FLORA_GRID } from './layout';
import { makePlantList } from './floraLib/place';
import { makeStubVisualInputs } from './visualInputs';
import { plantsInCell } from './cellPlants';

const PATCH = 400;
function inputsWith(cells: Record<number, [number, number]>) {
  const flora = new Float32Array(FLORA_GRID * FLORA_GRID * 2);
  for (const [c, [mat, canopy]] of Object.entries(cells)) { flora[+c * 2] = mat; flora[+c * 2 + 1] = canopy; }
  return { ...makeStubVisualInputs(), flora, lifeOnLand: true, seaLevel: -10, terrain: { rise: 1, progress: {}, height: () => 0, patchSize: PATCH } };
}

describe('plantsInCell (the producer card draws what the world places in the cell)', () => {
  const cell = 20 * FLORA_GRID + 30, beside = cell + 1;

  it('returns only the clicked cell’s plants, even with a lush neighbour', () => {
    const out = makePlantList(2048);
    const inputs = inputsWith({ [cell]: [0.8, 0.3], [beside]: [0.9, 0.6] });
    const cc = cellCentre(cell, PATCH);
    const mine = plantsInCell(inputs, PATCH, cell, { x: cc.x, z: cc.z }, out);
    expect(mine.length).toBeGreaterThan(0);
    for (const i of mine) expect(cellAt(out.x[i], out.z[i], PATCH)).toBe(cell);
  });

  it('falls back to the cell’s own view when the camera is too far for its ground cover, and is empty where nothing grows', () => {
    const out = makePlantList(2048);
    const inputs = inputsWith({ [cell]: [0.8, 0] });
    expect(plantsInCell(inputs, PATCH, cell, { x: 1e5, z: 1e5 }, out).length).toBeGreaterThan(0);
    expect(plantsInCell(inputs, PATCH, beside, { x: 0, z: 0 }, out)).toEqual([]);
  });
});
