import { describe, expect, it } from 'vitest';
import { BODY_GENES, type AnimalGenome, type BodyGenes } from './genome';
import type { GuideAnimal } from './guide';
import {
  bodyMassSpread, brayCurtis, brayCurtisCensus, dominantShare, functionalCensus, functionalDispersion,
  otuAbundances, otuCount, percentile, trophicWeb,
} from './metrics';

const flat = (v: number): BodyGenes => Object.fromEntries(BODY_GENES.map((g) => [g, v])) as BodyGenes;
const genome = (body: BodyGenes, c = 0.9, si = 0.05): AnimalGenome => ({
  body, climate: { prefTemp: 15, tolerance: 5, chem: 0.5 }, comp: { c, si, o: 1 - c - si }, lineage: 0,
});
let nextId = 1;
/** n animals at a single point in gene space (so they form one cluster). */
const group = (n: number, body: BodyGenes, c?: number, si?: number): GuideAnimal[] =>
  Array.from({ length: n }, () => ({ id: nextId++, genome: genome(body, c, si) }));

// Three well-separated OTUs of 6, 4, 2 animals (the last is below MIN_MEMBERS → not an OTU).
const A = flat(0.1), B = flat(0.5), C = flat(0.9);
const world = () => { nextId = 1; return [...group(6, A), ...group(4, B), ...group(2, C)]; };

describe('OTU metrics', () => {
  it('counts only clusters with ≥ 4 live animals', () => {
    expect(otuCount(world())).toBe(2);
    expect(otuAbundances(world())).toEqual([6, 4]);
  });
  it('dominant share is the largest OTU over animals in OTUs', () => {
    expect(dominantShare(world())).toBeCloseTo(0.6);
  });
  it('is 0 / 0 on an empty or all-singleton population', () => {
    expect(otuCount([])).toBe(0);
    expect(dominantShare([])).toBe(0);
    nextId = 1;
    expect(otuCount([...group(1, A), ...group(1, B)])).toBe(0);
  });
  it('is independent of input order', () => {
    const w = world();
    expect(otuAbundances([...w].reverse())).toEqual(otuAbundances(w));
  });
});

describe('body-mass spread', () => {
  it('percentile interpolates linearly', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([0, 10], 25)).toBe(2.5);
    expect(percentile([7], 95)).toBe(7);
  });
  it('log10(M95/M5)', () => {
    // 21 masses 1..100 spaced as powers of 10 → M5 = 10^0.1, M95 = 10^1.9 (to interpolation)
    const masses = Array.from({ length: 21 }, (_, i) => 10 ** (i / 10));
    expect(bodyMassSpread(masses)).toBeCloseTo(1.8, 1);
    expect(bodyMassSpread([3, 3, 3, 3])).toBe(0);
  });
  it('is 0 for fewer than two animals', () => {
    expect(bodyMassSpread([])).toBe(0);
    expect(bodyMassSpread([5])).toBe(0);
  });
});

describe('trophic web', () => {
  // OTU A (6) eats B (4); B eats C-like OTU D (5); D eats nobody.
  const build = () => { nextId = 1; return [...group(6, A), ...group(4, B), ...group(5, C)]; };
  const d = (a: GuideAnimal) => a.genome.body.size;
  const eats = (p: GuideAnimal, q: GuideAnimal) => d(p) + 0.4 === d(q) || (d(p) === 0.1 && d(q) === 0.5) || (d(p) === 0.5 && d(q) === 0.9);
  it('counts links, connectance and the longest chain', () => {
    const w = trophicWeb(build(), eats);
    expect(w.links).toBe(2);
    expect(w.connectance).toBeCloseTo(2 / 9);
    expect(w.maxChain).toBe(3);
  });
  it('survives cycles', () => {
    const w = trophicWeb(build(), () => true);
    expect(w.links).toBe(6);
    expect(w.maxChain).toBe(3);
  });
  it('no links → chain of 1; no OTUs → zeros', () => {
    expect(trophicWeb(build(), () => false)).toEqual({ links: 0, connectance: 0, maxChain: 1 });
    expect(trophicWeb([], () => true)).toEqual({ links: 0, connectance: 0, maxChain: 0 });
  });
});

describe('functional dispersion', () => {
  it('is 0 for identical animals and for fewer than two', () => {
    nextId = 1;
    expect(functionalDispersion(group(5, A))).toBe(0);
    expect(functionalDispersion(group(1, A))).toBe(0);
  });
  it('is the mean distance to the centroid (two points 0.2 apart on every gene)', () => {
    nextId = 1;
    const pts = [...group(1, flat(0.4)), ...group(1, flat(0.6))];
    expect(functionalDispersion(pts)).toBeCloseTo(0.1 * Math.sqrt(12));
  });
  it('grows when the population spreads out', () => {
    nextId = 1;
    const tight = [...group(2, flat(0.45)), ...group(2, flat(0.55))];
    const wide = [...group(2, flat(0.1)), ...group(2, flat(0.9))];
    expect(functionalDispersion(wide)).toBeGreaterThan(functionalDispersion(tight));
  });
});

describe('Bray–Curtis', () => {
  it('0 for identical, 1 for disjoint, 0 for two empties', () => {
    expect(brayCurtis([3, 1], [3, 1])).toBe(0);
    expect(brayCurtis([4, 0], [0, 4])).toBe(1);
    expect(brayCurtis([], [])).toBe(0);
  });
  it('matches a hand value: [6,4] vs [4,6] → 4/20', () => {
    expect(brayCurtis([6, 4], [4, 6])).toBeCloseTo(0.2);
  });
  it('pads the shorter vector with zeros', () => {
    expect(brayCurtis([5], [5, 5])).toBeCloseTo(5 / 15);
  });
  it('censuses align by label; missing = 0', () => {
    expect(brayCurtisCensus({ 'a · x': 6, 'b · y': 4 }, { 'b · y': 4, 'a · x': 6 })).toBe(0);
    expect(brayCurtisCensus({ 'a · x': 4 }, { 'b · y': 4 })).toBe(1);
  });
  it('functionalCensus buckets OTUs by role · locomotion', () => {
    const w = world();
    const census = functionalCensus(w);
    expect(Object.values(census).reduce((s, n) => s + n, 0)).toBe(10); // the 2-animal cluster is not an OTU
    expect(brayCurtisCensus(census, census)).toBe(0);
  });
});
