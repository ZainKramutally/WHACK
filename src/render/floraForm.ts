// Plant form from conditions (decision #36, option a): a pure function of the world's chemistry, light, heat band and
// the cell's biomass mix. No flora genome, no randomness, nothing fed back to the sim. Archetypes are cached per
// quantised bin, so the same inputs always return the same (frozen) object.
//
//   chemistry (composition.si)  → silicon: straight stems, flat facets, branches at 60°; carbon: curl
//   light                       → bright: caps; dim: lantern cups; dark: cups that glow, and glowing tips on silicon
//   heatBand                    → height (cold → taller, as the temperature–size rule)
//   mat vs canopy               → species: mat-dominant is ground cover, canopy-dominant stands tall
//   submerged cell (per cell)    → on a water world a mat-dominant submerged cell is a translucent jellyshroom dome;
//                                  on silicon a submerged crust glows and sits low
//   biomass magnitude (per cell) → sparse / normal / lush: smaller or larger caps and cups
import type { VisualInputs } from '../worlds/types';
import { FLORA_EPS, cellCentre } from './layout';

export type FloraSpecies = 'tuft' | 'capped' | 'cup' | 'dome' | 'spire' | 'crust';

export interface FloraForm {
  /** Cache key: the bin this archetype belongs to. */
  readonly key: string;
  readonly chemistry: 'carbon' | 'silicon';
  readonly species: FloraSpecies;
  /** Radians of curl per stem segment (carbon); 0 for silicon. */
  readonly curl: number;
  /** Degrees between a silicon branch and its trunk (60); 0 for carbon. */
  readonly branchDeg: number;
  /** Flat-shaded facets (silicon). */
  readonly facets: boolean;
  /** Branches per spire (silicon). */
  readonly branches: number;
  /** Height multiplier from the heat band: cold 1.4 … hot 0.6. */
  readonly heightScale: number;
  /** Cap, cup or dome radius relative to height. */
  readonly capScale: number;
  /** 0..1 emissive amount (from darkness). */
  readonly glow: number;
  readonly translucent: boolean;
  /** The cell is under the sea (cell centre below sea level). */
  readonly submerged?: boolean;
  /** Biomass magnitude of the cell: 0 sparse, 1 normal, 2 lush. */
  readonly lush?: 0 | 1 | 2;
}

export interface FloraBin {
  silicon: boolean;
  water: boolean;       // the world's solvent is water
  sub: boolean;         // this cell is under the sea
  lush: 0 | 1 | 2;      // total biomass: sparse, normal, lush
  light: 0 | 1 | 2;     // dark, dim, bright
  heat: number;         // 0..4 (heatBand quantised to quarters)
  mix: 0 | 1 | 2;       // mat-dominant, mixed, canopy-dominant
}

export const DARK_BELOW = 0.05;
export const DIM_BELOW = 0.4;

export const SPARSE_BELOW = 0.35;
export const LUSH_ABOVE = 0.9;

/** True when the cell centre lies below sea level. Needs terrain.patchSize; false without it. */
export function cellSubmerged(cell: number, i: Pick<VisualInputs, 'terrain' | 'seaLevel'>): boolean {
  const patch = i.terrain.patchSize;
  if (!patch) return false;
  const c = cellCentre(cell, patch);
  return i.terrain.height(c.x, c.z) < i.seaLevel;
}

/** Quantise the inputs for a cell with this biomass into a bin. `submerged` is per cell (see cellSubmerged). */
export function floraBin(mat: number, canopy: number, i: Pick<VisualInputs, 'world' | 'light' | 'heatBand'>, submerged = false): FloraBin {
  const total = mat + canopy;
  const share = total > 0 ? canopy / total : 0;
  return {
    silicon: i.world.composition.si > 0.5,
    water: /water/i.test(i.world.solvent.name),
    sub: submerged,
    lush: total < SPARSE_BELOW ? 0 : total > LUSH_ABOVE ? 2 : 1,
    light: i.light < DARK_BELOW ? 0 : i.light < DIM_BELOW ? 1 : 2,
    heat: Math.round(Math.max(0, Math.min(1, i.heatBand)) * 4),
    mix: share < 0.34 ? 0 : share < 0.67 ? 1 : 2,
  };
}

const cache = new Map<string, FloraForm>();

function build(b: FloraBin, key: string): FloraForm {
  const heightScale = 1.4 - 0.8 * (b.heat / 4);
  const dark = b.light === 0;
  const size = b.lush === 0 ? 0.8 : b.lush === 2 ? 1.25 : 1;
  if (b.silicon) {
    const species: FloraSpecies = b.mix === 0 ? 'crust' : 'spire';
    return Object.freeze({
      key, chemistry: 'silicon', species, curl: 0, branchDeg: 60, facets: true,
      branches: b.mix === 2 ? 4 : b.mix === 1 ? 2 : 0,
      heightScale, capScale: 0.1 * size, glow: Math.min(1, (dark ? 0.6 : b.light === 1 ? 0.25 : 0) + (b.sub ? 0.25 : 0)),
      translucent: false, submerged: b.sub, lush: b.lush,
    });
  }
  let species: FloraSpecies;
  if (b.mix === 0) species = b.sub && b.water ? 'dome' : 'tuft';
  else species = b.light === 2 ? 'capped' : 'cup';
  const big = b.mix === 2;
  return Object.freeze({
    key, chemistry: 'carbon', species, curl: 0.3, branchDeg: 0, facets: false, branches: 0,
    heightScale, capScale: (species === 'dome' ? 0.45 : big ? 0.14 : 0.1) * size,
    glow: species === 'cup' || species === 'dome' ? (dark ? 0.7 : b.light === 1 ? 0.3 : 0) : 0,
    translucent: species === 'dome', submerged: b.sub, lush: b.lush,
  });
}

/** Archetype for a bin (cached). */
export function formForBin(b: FloraBin): FloraForm {
  const key = `${b.silicon ? 'si' : 'c'}${b.water ? 'w' : 'n'}${b.sub ? 's' : 'l'}-L${b.light}-H${b.heat}-M${b.mix}-B${b.lush}`;
  let f = cache.get(key);
  if (!f) { f = build(b, key); cache.set(key, f); }
  return f;
}

/**
 * Form of the plants in a flora cell, or null when the cell has no biomass. Pure: the same cell and inputs always
 * give the same archetype (the identical frozen object).
 */
export function floraForm(cell: number, inputs: VisualInputs): FloraForm | null {
  const mat = inputs.flora[cell * 2] ?? 0, canopy = inputs.flora[cell * 2 + 1] ?? 0;
  if (mat + canopy <= FLORA_EPS) return null;
  return formForBin(floraBin(mat, canopy, inputs, cellSubmerged(cell, inputs)));
}
