import { describe, expect, it } from 'vitest';
import { CELLS, GRID, GRID_FIELDS, cellOf, createGrid } from './grid';

describe('grid', () => {
  const grid = createGrid({ liquid: new Float64Array(CELLS), supply: { c: 5, si: 2, o: 1 } });
  it('is 64×64 with exactly the allowed per-cell fields', () => {
    expect(GRID).toBe(64);
    expect(CELLS).toBe(4096);
    expect(Object.keys(grid).sort()).toEqual(['c', 'canopy', 'light', 'liquid', 'mat', 'o', 'risk', 'si', 'stone']);
    expect([...GRID_FIELDS].sort()).toEqual(Object.keys(grid).sort());
    for (const f of GRID_FIELDS) expect(grid[f]).toHaveLength(CELLS);
  });
  it('starts with the supplied nutrients and no life, stone or risk', () => {
    expect(grid.c[100]).toBe(5);
    expect(grid.si[100]).toBe(2);
    expect(grid.o[100]).toBe(1);
    for (const f of ['mat', 'canopy', 'stone', 'risk'] as const) expect(grid[f].every((v) => v === 0)).toBe(true);
  });
  it('rejects a liquid map of the wrong size and clamps negative depths', () => {
    expect(() => createGrid({ liquid: [1, 2, 3], supply: { c: 1, si: 1, o: 1 } })).toThrow();
    const l = new Float64Array(CELLS).fill(-3);
    expect(createGrid({ liquid: l, supply: { c: 1, si: 1, o: 1 } }).liquid[0]).toBe(0);
  });
  it('maps positions to cells and clamps at the edges', () => {
    expect(cellOf(0.5, 0.5)).toBe(0);
    expect(cellOf(3.2, 2.9)).toBe(2 * GRID + 3);
    expect(cellOf(-5, 99)).toBe((GRID - 1) * GRID);
  });
});
