// Shared genome contract (CLAUDE.md "Life: creatures and plants"; DECISIONS.md §G.1).
// 15 genes: 12 body genes + 3 climate genes (as built in population.ts). Change only by agreement:
// develop.ts, guide.ts, ecology.ts and the organism buffer all read this shape.
import { CONSTANTS } from './constants';
import { mutateClimate, type Genome as ClimateGenome, type LifeRules } from './population';
import { gaussian, makeRng, type Rng } from './rng';

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

// ---------------------------------------------------------------------------
// Functions: mutation and founders (DECISIONS §3 rule 8; CLAUDE.md "Founders").
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Matches the test rules in population.test.ts; callers should pass the world's own `life.rules`. */
export const DEFAULT_CLIMATE_RULES: Pick<LifeRules, 'mutation' | 'bounds'> = {
  mutation: { size: 0.05, prefTemp: 0.6, tolerance: 0.3, chem: 0.05, roleFlip: 0 },
  bounds: { size: [0.2, 5], tolerance: [1, 30] },
};

/** A child genome: every body gene steps by N(0, sigma) clamped to [0, 1] (sigma defaults to SIGMA); composition and lineage are inherited. */
export function mutate(
  parent: AnimalGenome,
  rng: Rng,
  climate: Pick<LifeRules, 'mutation' | 'bounds'> = DEFAULT_CLIMATE_RULES,
  sigma: number = CONSTANTS.SIGMA.value,
): AnimalGenome {
  const body = {} as BodyGenes;
  const sizeBoost = climate.mutation.sizeBoost ?? 1;
  for (const g of BODY_GENES) body[g] = clamp01(parent.body[g] + sigma * (g === 'size' ? sizeBoost : 1) * gaussian(rng));
  // Punctuated equilibrium (Gould & Eldredge 1972): rarely, 1-3 genes jump far, founding a new form that establishes or dies out.
  const jumpRate = climate.mutation.jumpRate ?? 0;
  if (jumpRate > 0 && rng() < jumpRate) {
    const scale = climate.mutation.jumpScale ?? 0;
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const g = BODY_GENES[Math.floor(rng() * BODY_GENES.length)];
      const step = scale * (0.6 + 0.8 * rng());
      body[g] = clamp01(body[g] + (rng() < 0.5 ? -step : step));
    }
  }
  return {
    body,
    climate: mutateClimate(parent.climate, climate, rng),
    comp: { ...parent.comp },
    lineage: parent.lineage,
  };
}

/** Founder body: tiny capsule worm (F §3.2: "the first animals are always worms"). */
const FOUNDER_BASE: BodyGenes = {
  size: 0.05, segments: 0.2, limbPairs: 0, limbLen: 0.3, plates: 0.05, horns: 0.05,
  gape: 0.2, diet: 0.1, eyes: 0.2, buoy: 0.2, glow: 0, sociality: 0.3,
};
/** Standing variation σ on these genes (research/body-plans/notes/01 §5: g1, g9–g12, g14, g21, g24). */
const FOUNDER_SIGMA = 0.12; // size starts near 0 (0.05, clamped at 0): founders are the smallest bodies the grammar makes
const FOUNDER_VARIED: BodyGene[] = ['size', 'gape', 'limbLen', 'plates', 'horns', 'diet'];
/** Share of founders that start with a tiny limb bud (limbPairs > 0 but too small to round to a leg pair). */
const BUD_SHARE = 0.15;
const BUD_RANGE: [number, number] = [0.02, 0.12]; // below 0.125 = 0 leg pairs after round(4·g)

/** Per-world bounds for the run-seeded mean of the founders' latent genes (and the share with a limb bud). A gene not listed keeps its fixed founder value. */
export type FounderLatent = Partial<Record<BodyGene | 'budShare' | 'budMax', [number, number]>>;

/** Fallback climate genes, until the caller passes the world's. Placeholder: `life.rules` should supply them. */
const DEFAULT_FOUNDER_CLIMATE: ClimateGenes = { prefTemp: 15, tolerance: 8, chem: 0.5 };

/**
 * At least 24 seeded capsule worms with standing variation. Same seed → same founders. Each founder is its own
 * lineage (id = index). `climate` should come from the world's founder climate genes.
 */
export function makeFounders(
  seed: number,
  count: number,
  worldComposition: Composition,
  climate: ClimateGenes = DEFAULT_FOUNDER_CLIMATE,
  latent?: FounderLatent,
): AnimalGenome[] {
  const rng = makeRng(seed)('founders');
  // Historical contingency (Gould 1989; Blount, Borland and Lenski 2008): the founders' MEAN latent genes are drawn from the run
  // seed inside the world's bounds, so each run starts from a differently-leaning lineage. Standing variation (σ) is unchanged.
  const mean = { ...FOUNDER_BASE };
  let budShare = BUD_SHARE;
  let budMax = BUD_RANGE[1];
  if (latent) {
    const lr = makeRng(seed)('founder-mean');
    for (const g of BODY_GENES) { const b = latent[g]; if (b) mean[g] = b[0] + (b[1] - b[0]) * lr(); }
    if (latent.budShare) budShare = latent.budShare[0] + (latent.budShare[1] - latent.budShare[0]) * lr();
    if (latent.budMax) budMax = latent.budMax[0] + (latent.budMax[1] - latent.budMax[0]) * lr();
  }
  const out: AnimalGenome[] = [];
  for (let i = 0; i < count; i++) {
    const body = { ...mean };
    for (const g of FOUNDER_VARIED) body[g] = clamp01(mean[g] + FOUNDER_SIGMA * gaussian(rng));
    const bud = rng() < budShare;
    const budLo = latent?.budMax ? 0.6 * budMax : BUD_RANGE[0];   // with a seeded leg lean the run's founders all lean about the same way
    const budSize = budLo + (budMax - budLo) * rng(); // always drawn, so the stream is stable
    body.limbPairs = bud ? budSize : 0;
    out.push({ body, climate: { ...climate }, comp: { ...worldComposition }, lineage: i });
  }
  return out;
}
