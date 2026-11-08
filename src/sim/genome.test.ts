import { describe, expect, it } from 'vitest';
import { BODY_GENES, DEFAULT_CLIMATE_RULES, makeFounders, mutate, type AnimalGenome } from './genome';
import { CONSTANTS } from './constants';
import { makeRng } from './rng';

const comp = { c: 0.8, si: 0.05, o: 0.15 };

describe('makeFounders', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(makeFounders(7, 24, comp)).toEqual(makeFounders(7, 24, comp));
    expect(makeFounders(7, 24, comp)).not.toEqual(makeFounders(8, 24, comp));
  });
  it('makes tiny worms inheriting the world composition, one lineage each', () => {
    const f = makeFounders(1, 40, comp);
    expect(f).toHaveLength(40);
    f.forEach((g, i) => {
      expect(g.comp).toEqual(comp);
      expect(g.lineage).toBe(i);
      expect(g.body.size).toBeLessThan(0.5);
      expect(g.body.segments).toBe(0.2);
      for (const k of BODY_GENES) expect(g.body[k]).toBeGreaterThanOrEqual(0);
      for (const k of BODY_GENES) expect(g.body[k]).toBeLessThanOrEqual(1);
    });
  });
  it('gives about 15% tiny limb buds that are too small to be legs', () => {
    const f = makeFounders(3, 1000, comp);
    const buds = f.filter((g) => g.body.limbPairs > 0);
    expect(buds.length / f.length).toBeGreaterThan(0.1);
    expect(buds.length / f.length).toBeLessThan(0.2);
    for (const g of buds) expect(Math.round(4 * g.body.limbPairs)).toBe(0);
  });
  it('has standing variation on size', () => {
    const sizes = makeFounders(5, 200, comp).map((g) => g.body.size);
    const mean = sizes.reduce((a, b) => a + b) / sizes.length;
    const sd = Math.sqrt(sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / sizes.length);
    expect(sd).toBeGreaterThan(0.08);
    expect(sd).toBeLessThan(0.14);
  });
});

describe('mutate', () => {
  const parent: AnimalGenome = makeFounders(2, 1, comp)[0]!;
  it('is deterministic given the rng stream', () => {
    const a = mutate(parent, makeRng(9)('m'));
    const b = mutate(parent, makeRng(9)('m'));
    expect(a).toEqual(b);
    expect(mutate(parent, makeRng(10)('m'))).not.toEqual(a);
  });
  it('keeps genes in [0, 1], inherits composition and lineage, and does not touch the parent', () => {
    const snapshot = structuredClone(parent);
    let g = parent;
    const rng = makeRng(1)('walk');
    for (let i = 0; i < 300; i++) {
      g = mutate(g, rng);
      for (const k of BODY_GENES) {
        expect(g.body[k]).toBeGreaterThanOrEqual(0);
        expect(g.body[k]).toBeLessThanOrEqual(1);
      }
      expect(g.climate.chem).toBeGreaterThanOrEqual(0);
      expect(g.climate.chem).toBeLessThanOrEqual(1);
      expect(g.climate.tolerance).toBeGreaterThanOrEqual(1);
    }
    expect(g.comp).toEqual(parent.comp);
    expect(g.lineage).toBe(parent.lineage);
    expect(parent).toEqual(snapshot);
  });
  it('steps every body gene by about SIGMA', () => {
    const mid: AnimalGenome = { ...parent, body: Object.fromEntries(BODY_GENES.map((k) => [k, 0.5])) as AnimalGenome['body'] };
    const rng = makeRng(4)('sd');
    const diffs: number[] = [];
    for (let i = 0; i < 400; i++) for (const k of BODY_GENES) diffs.push(mutate(mid, rng).body[k] - 0.5);
    const sd = Math.sqrt(diffs.reduce((a, b) => a + b * b, 0) / diffs.length);
    expect(sd).toBeGreaterThan(0.87 * CONSTANTS.SIGMA.value);
    expect(sd).toBeLessThan(1.13 * CONSTANTS.SIGMA.value);
  });
  it('makes a large jump on 1-3 genes when jumpRate fires, and none when it is 0', () => {
    const mid: AnimalGenome = { ...parent, body: Object.fromEntries(BODY_GENES.map((k) => [k, 0.5])) as AnimalGenome['body'] };
    const rules = { ...DEFAULT_CLIMATE_RULES, mutation: { ...DEFAULT_CLIMATE_RULES.mutation, jumpRate: 1, jumpScale: 0.3 } };
    const rng = makeRng(9)('jump');
    for (let i = 0; i < 50; i++) {
      const moved = BODY_GENES.filter((k) => Math.abs(mutate(mid, rng, rules, 0).body[k] - 0.5) > 0.15);
      expect(moved.length).toBeGreaterThanOrEqual(0);
    }
    const counts = Array.from({ length: 50 }, () => { const c = mutate(mid, rng, rules, 0); return BODY_GENES.filter((k) => c.body[k] !== 0.5).length; });
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(3);
    const calm = mutate(mid, rng, DEFAULT_CLIMATE_RULES, 0);
    expect(BODY_GENES.every((k) => calm.body[k] === 0.5)).toBe(true);
  });
  it('draws the founders latent mean from the seed inside the bounds, and leaves other genes fixed', () => {
    const latent = { diet: [0.02, 0.3], buoy: [0, 0.7], budShare: [0.05, 0.95] } as const;
    const means = [1, 2, 3, 4, 5, 6].map((seed) => {
      const f = makeFounders(seed, 200, comp, undefined, { diet: [...latent.diet], buoy: [...latent.buoy], budShare: [...latent.budShare] });
      return f.reduce((a, g) => a + g.body.buoy, 0) / f.length;
    });
    expect(new Set(means.map((m) => m.toFixed(2))).size).toBeGreaterThan(3);   // runs differ
    const a = makeFounders(7, 50, comp, undefined, { buoy: [0, 0.7] });
    expect(makeFounders(7, 50, comp, undefined, { buoy: [0, 0.7] })).toEqual(a);   // deterministic
    expect(a.every((g) => g.body.sociality === makeFounders(7, 50, comp)[0].body.sociality)).toBe(true);   // unlisted genes stay fixed
  });
});
