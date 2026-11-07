// Mirror of the sim genome contract, so the sim can plug straight in later.
// Source of truth (READ ONLY, another branch): .sandboxes/session-logic/src/sim/genome.ts (BodyGenes, Composition),
// rules in docs/emergence/DECISIONS.md §G.1 (12 body genes) and F-body-plan-first.md §3.3 (develop grammar).
// Keep these shapes identical to the sim's; the 3 climate genes are not needed for rendering.

export const BODY_GENES = [
  'size', 'segments', 'limbPairs', 'limbLen', 'plates', 'horns',
  'gape', 'diet', 'eyes', 'buoy', 'glow', 'sociality',
] as const;
export type BodyGene = (typeof BODY_GENES)[number];

/** Each body gene is a float in [0, 1]. */
export type BodyGenes = Record<BodyGene, number>;

/** Inherited body composition, rebuilt at each birth. Not a gene. c + si + o = 1. */
export interface Composition { c: number; si: number; o: number }

/** Mirrors the sim's DevelopConditions (light and heatBand 0..1, airDensity in AIR_RHO's scale). */
export interface DevelopConditions { light: number; heatBand: number; airDensity: number }

/** Lab conditions: a cold (living-band floor), dim, thick-aired Red World (so the TSR and air-lift terms reach giants, and glow shows). */
export const LAB_CONDITIONS: DevelopConditions = { light: 0.3, heatBand: 0, airDensity: 0.4 };
