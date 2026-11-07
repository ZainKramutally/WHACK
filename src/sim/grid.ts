// The one world grid (DECISIONS §G guardrail 6): 64×64 cells, exactly these per-cell fields and no others.
// Sim state only: no preset ids, species names or render fields. Positions elsewhere are in cell units [0, GRID).
//
// Spatial conventions (shared with the renderer and VisualInputs):
//  - SimSnapshot.organisms x, y are 0..1 over the patch; world (x, z) = ((x − 0.5)·patchSize, (y − 0.5)·patchSize).
//    The ecology works in cell units (0..64) internally and divides by GRID when packing.
//  - Cell index = row·64 + col; col runs along world x (organism x), row along world z (organism y).
//  - SimSnapshot.flora is interleaved [mat, canopy] per cell: mat at cell·FLORA_STRIDE, canopy at +1 (8,192 floats).
//  - liquid depth comes from terrain: see liquidFromHeights (height at each cell centre against sea level).
//
// Matter is conserved: c/si/o are nutrient pools in "matter units" (the same unit as animal mass and energy,
// and flora biomass × ledger.cellMass). Flora biomass (mat, canopy) is 0..1 of a cell's capacity.

export const GRID = 64;
export const CELLS = GRID * GRID;
/** Floats per cell in the SimSnapshot.flora buffer: [mat, canopy]. */
export const FLORA_STRIDE = 2;

/** The complete list of per-cell fields. A test pins this: adding one must cost a removal. */
export const GRID_FIELDS = ['c', 'si', 'o', 'light', 'mat', 'canopy', 'stone', 'liquid', 'risk'] as const;
export type GridField = (typeof GRID_FIELDS)[number];

export type Grid = Record<GridField, Float64Array>;

export interface GridSetup {
  /** Static liquid depth per cell (0 = dry land), from the terrain heightmap and sea level. Length CELLS. */
  liquid: ArrayLike<number>;
  /** Starting nutrient supply per cell, in matter units. */
  supply: { c: number; si: number; o: number };
}

export function createGrid(setup: GridSetup): Grid {
  if (setup.liquid.length !== CELLS) throw new Error(`liquid must have ${CELLS} cells, got ${setup.liquid.length}`);
  const g = {} as Grid;
  for (const f of GRID_FIELDS) g[f] = new Float64Array(CELLS);
  g.c.fill(setup.supply.c);
  g.si.fill(setup.supply.si);
  g.o.fill(setup.supply.o);
  for (let i = 0; i < CELLS; i++) g.liquid[i] = Math.max(0, setup.liquid[i]);
  return g;
}

/** Cell index of a position in cell units, clamped to the grid. */
export function cellOf(x: number, y: number): number {
  const cx = x < 0 ? 0 : x >= GRID ? GRID - 1 : x | 0;
  const cy = y < 0 ? 0 : y >= GRID ? GRID - 1 : y | 0;
  return cy * GRID + cx;
}

/** Total matter held in the grid (nutrients + stone + flora), for conservation checks. */
export function gridMatter(g: Grid, cellMass: number): number {
  let m = 0;
  for (let i = 0; i < CELLS; i++) m += g.c[i] + g.si[i] + g.o[i] + g.stone[i] + (g.mat[i] + g.canopy[i]) * cellMass;
  return m;
}

/**
 * Static liquid depth per cell from a terrain height function: depth = max(0, seaLevel − height) at each cell
 * centre. `height(x, y)` takes patch coordinates in 0..1 (col along x, row along y).
 */
export function liquidFromHeights(height: (x: number, y: number) => number, seaLevel: number): Float32Array {
  const out = new Float32Array(CELLS);
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) out[row * GRID + col] = Math.max(0, seaLevel - height((col + 0.5) / GRID, (row + 0.5) / GRID));
  }
  return out;
}
