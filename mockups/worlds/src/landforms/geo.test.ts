import { describe, expect, it } from 'vitest';
import { buildArch, buildSpire, spireProfile, wallProfile } from './geo';

describe('spireProfile', () => {
  it.each([0, 0.3, 0.6, 0.9, 1])('tapers monotonically (erosion %s)', (e) => {
    let prev = Infinity;
    for (let i = 0; i <= 100; i++) {
      const r = spireProfile(i / 100, e);
      expect(r).toBeLessThanOrEqual(prev + 1e-9);
      prev = r;
    }
    expect(spireProfile(1, e)).toBeCloseTo(0, 6);
  });
  it('fresh is fatter than eroded at mid height', () => {
    expect(spireProfile(0.5, 0)).toBeGreaterThan(spireProfile(0.5, 1) * 1.5);
  });
});

describe('geometry', () => {
  it('spire has finite vertices, tip near H and valid indices', () => {
    const g = buildSpire({ H: 100, R: 8, erosion: 0.5, radial: 16, rings: 40, seed: 1, horns: true });
    expect(g.pos.every(Number.isFinite)).toBe(true);
    expect(Math.max(...g.idx)).toBeLessThan(g.pos.length / 3);
    const ys = g.pos.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeGreaterThan(95);
  });
  it('arch spans between the feet and peaks near apex', () => {
    const g = buildArch({ a: [0, 0], b: [40, 0], ha: 0, hb: 0, apex: 50, R: 4, radial: 12, rings: 40, seed: 2 });
    const ys = g.pos.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeGreaterThan(45);
    expect(Math.max(...ys)).toBeLessThan(60);
  });
  it('overhang lip is wider than the waist', () => {
    expect(wallProfile(0.88, true)).toBeGreaterThan(wallProfile(0.6, true) * 1.4);
  });
});
