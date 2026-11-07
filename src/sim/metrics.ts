// DECISIONS §A variety metrics, as pure functions over the live animals (and, for mass, their body plans).
// No state, no randomness. Species = OTU: clusterForms() clusters at FORM_RADIUS and an OTU needs MIN_MEMBERS live animals.
import { BODY_GENES } from './genome';
import { clusterForms, functionalType, MIN_MEMBERS, type FormCluster, type GuideAnimal } from './guide';

/** The OTUs: clusters with at least MIN_MEMBERS live animals, in ascending key order. */
export function otus(animals: readonly GuideAnimal[]): FormCluster[] {
  return clusterForms(animals).filter((c) => c.members.length >= MIN_MEMBERS).sort((a, b) => a.key - b.key);
}

/** OTU richness S. */
export function otuCount(animals: readonly GuideAnimal[]): number {
  return otus(animals).length;
}

/** Abundance of each OTU, in OTU key order (the vector Bray–Curtis compares). */
export function otuAbundances(animals: readonly GuideAnimal[]): number[] {
  return otus(animals).map((c) => c.members.length);
}

/** Largest OTU's share of all animals that belong to an OTU (bar ≤ 0.4). 0 when there are no OTUs. */
export function dominantShare(animals: readonly GuideAnimal[]): number {
  const sizes = otuAbundances(animals);
  const total = sizes.reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : Math.max(...sizes) / total;
}

/** Linear-interpolated percentile (p in 0..100) of an unsorted list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = (p / 100) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Body-mass spread log10(M95/M5) over the animals' masses (BodyPlan.mass); bar ≥ 1.5. 0 for fewer than 2 animals. */
export function bodyMassSpread(masses: readonly number[]): number {
  const m = masses.filter((v) => v > 0);
  if (m.length < 2) return 0;
  return Math.log10(percentile(m, 95) / percentile(m, 5));
}

export interface TrophicWeb {
  /** Directed OTU pairs (a, b), a ≠ b, where a eats b. */
  links: number;
  /** L / S², S = OTU count (bar 0.05–0.3). 0 when S = 0. */
  connectance: number;
  /** Longest simple feeding chain, in OTUs (bar ≥ 3 when Hunger ≥ 0.5). 0 when S = 0, 1 when there are no links. */
  maxChain: number;
}

/**
 * Food-web size at OTU level. `eats(predator, prey)` comes from relationships.ts; each OTU is represented by its
 * lowest-id member (the cluster key), so the result does not depend on input order.
 */
export function trophicWeb(
  animals: readonly GuideAnimal[],
  eats: (predator: GuideAnimal, prey: GuideAnimal) => boolean,
): TrophicWeb {
  const byId = new Map(animals.map((a) => [a.id, a]));
  const reps = otus(animals).map((c) => byId.get(c.key)!);
  const s = reps.length;
  const out: number[][] = reps.map(() => []);
  let links = 0;
  for (let i = 0; i < s; i++) {
    for (let j = 0; j < s; j++) {
      if (i !== j && eats(reps[i], reps[j])) { out[i].push(j); links++; }
    }
  }
  const seen = new Array<boolean>(s).fill(false);
  const longest = (n: number): number => {
    seen[n] = true;
    let best = 1;
    for (const m of out[n]) if (!seen[m]) best = Math.max(best, 1 + longest(m));
    seen[n] = false;
    return best;
  };
  let maxChain = 0;
  for (let i = 0; i < s; i++) maxChain = Math.max(maxChain, longest(i));
  return { links, connectance: s === 0 ? 0 : links / (s * s), maxChain };
}

/**
 * Functional dispersion over the 12 body genes (Laliberté & Legendre 2010): the mean Euclidean distance of each
 * animal to the centroid of all animals. Genes are already 0..1, so there is no rescaling. 0 for fewer than 2 animals.
 */
export function functionalDispersion(animals: readonly GuideAnimal[]): number {
  const n = animals.length;
  if (n < 2) return 0;
  const centroid = BODY_GENES.map((g) => animals.reduce((s, a) => s + a.genome.body[g], 0) / n);
  let total = 0;
  for (const a of animals) {
    let d2 = 0;
    BODY_GENES.forEach((g, i) => { d2 += (a.genome.body[g] - centroid[i]) ** 2; });
    total += Math.sqrt(d2);
  }
  return total / n;
}

/** Bray–Curtis dissimilarity of two abundance vectors aligned by index (shorter one is padded with 0). 0 identical, 1 disjoint; 0 if both empty. */
export function brayCurtis(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let diff = 0;
  let sum = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    diff += Math.abs(x - y);
    sum += x + y;
  }
  return sum === 0 ? 0 : diff / sum;
}

/** Counts per functional type label (role · locomotion) over the OTUs, weighted by abundance. Align two runs by key via brayCurtisCensus. */
export function functionalCensus(animals: readonly GuideAnimal[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of otus(animals)) {
    const label = functionalType(c.centroid, c.hint).label;
    out[label] = (out[label] ?? 0) + c.members.length;
  }
  return out;
}

/** Bray–Curtis between two censuses keyed by label (missing key = 0). This is DECISIONS §A's beta-diversity form. */
export function brayCurtisCensus(a: Record<string, number>, b: Record<string, number>): number {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return brayCurtis(keys.map((k) => a[k] ?? 0), keys.map((k) => b[k] ?? 0));
}
