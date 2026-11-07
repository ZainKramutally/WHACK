// Plant form from conditions (decision #36, option a): a pure function of the world's chemistry, light, heat band and
// the cell's biomass mix. No flora genome, no randomness, nothing fed back to the sim. Archetypes are cached per
// quantised bin, so the same inputs always return the same (frozen) object.
//
//   chemistry (composition.si)  → silicon: straight stems, flat facets, branches at 60°; carbon: curl
//   light                       → bright: caps; dim: lantern cups; dark: cups that glow, and glowing tips on silicon
//   heatBand                    → height (cold → taller, as the temperature–size rule)
//   mat vs canopy               → species: mat-dominant is ground cover, canopy-dominant stands tall
//   water + dark + mat          → translucent jellyshroom dome
import type { VisualInputs } from '../worlds/types';
import { FLORA_EPS } from './layout';

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
}

export interface FloraBin {
  silicon: boolean;
  water: boolean;
  light: 0 | 1 | 2;     // dark, dim, bright
  heat: number;         // 0..4 (heatBand quantised to quarters)
  mix: 0 | 1 | 2;       // mat-dominant, mixed, canopy-dominant
}

export const DARK_BELOW = 0.05;
export const DIM_BELOW = 0.4;

/** Quantise the inputs for a cell with this biomass into a bin. */
export function floraBin(mat: number, canopy: number, i: Pick<VisualInputs, 'world' | 'light' | 'heatBand'>): FloraBin {
  const total = mat + canopy;
  const share = total > 0 ? canopy / total : 0;
  return {
    silicon: i.world.composition.si > 0.5,
    water: /water/i.test(i.world.solvent.name),
    light: i.light < DARK_BELOW ? 0 : i.light < DIM_BELOW ? 1 : 2,
    heat: Math.round(Math.max(0, Math.min(1, i.heatBand)) * 4),
    mix: share < 0.34 ? 0 : share < 0.67 ? 1 : 2,
  };
}

const cache = new Map<string, FloraForm>();

function build(b: FloraBin, key: string): FloraForm {
  const heightScale = 1.4 - 0.8 * (b.heat / 4);
  const dark = b.light === 0;
  if (b.silicon) {
    const species: FloraSpecies = b.mix === 0 ? 'crust' : 'spire';
    return Object.freeze({
      key, chemistry: 'silicon', species, curl: 0, branchDeg: 60, facets: true,
      branches: b.mix === 2 ? 4 : b.mix === 1 ? 2 : 0,
      heightScale, capScale: 0.1, glow: dark ? 0.6 : b.light === 1 ? 0.25 : 0, translucent: false,
    });
  }
  let species: FloraSpecies;
  if (b.mix === 0) species = dark && b.water ? 'dome' : 'tuft';
  else species = b.light === 2 ? 'capped' : 'cup';
  const big = b.mix === 2;
  return Object.freeze({
    key, chemistry: 'carbon', species, curl: 0.3, branchDeg: 0, facets: false, branches: 0,
    heightScale, capScale: species === 'dome' ? 0.45 : big ? 0.14 : 0.1,
    glow: species === 'cup' || species === 'dome' ? (dark ? 0.7 : b.light === 1 ? 0.3 : 0) : 0,
    translucent: species === 'dome',
  });
}

/** Archetype for a bin (cached). */
export function formForBin(b: FloraBin): FloraForm {
  const key = `${b.silicon ? 'si' : 'c'}${b.water ? 'w' : 'n'}-L${b.light}-H${b.heat}-M${b.mix}`;
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
  return formForBin(floraBin(mat, canopy, inputs));
}
