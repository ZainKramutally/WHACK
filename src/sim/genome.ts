// Shared genome contract (CLAUDE.md "Life: creatures and plants"; DECISIONS.md §G.1).
// 15 genes: 12 body genes + 3 climate genes (as built in population.ts). Change only by agreement:
// develop.ts, guide.ts, ecology.ts and the organism buffer all read this shape.
import type { Genome as ClimateGenome } from './population';

export const BODY_GENES = [
  'size', 'segments', 'limbPairs', 'limbLen', 'plates', 'horns',
  'gape', 'diet', 'eyes', 'buoy', 'glow', 'sociality',
] as const;
export type BodyGene = (typeof BODY_GENES)[number];

/** Each body gene is a float in [0, 1]. */
export type BodyGenes = Record<BodyGene, number>;

/** Inherited body composition, rebuilt at each birth. Not a gene. c + si + o = 1. */
export interface Composition { c: number; si: number; o: number }

/** The 3 climate genes, used as built in population.ts. */
export type ClimateGenes = Pick<ClimateGenome, 'prefTemp' | 'tolerance' | 'chem'>;

export interface AnimalGenome {
  body: BodyGenes;
  climate: ClimateGenes;
  comp: Composition;
  lineage: number; // founder id this animal descends from (for kin relationships)
}
