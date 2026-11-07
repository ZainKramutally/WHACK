// The one world grid (DECISIONS §G guardrail 6): 64×64 cells, exactly these per-cell fields and no others.
// Sim state only: no preset ids, species names or render fields. Positions elsewhere are in cell units [0, GRID).
//
// Matter is conserved: c/si/o are nutrient pools in "matter units" (the same unit as animal mass and energy,
// and flora biomass × ledger.cellMass). Flora biomass (mat, canopy) is 0..1 of a cell's capacity.

export const GRID = 64;
export const CELLS = GRID * GRID;

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
