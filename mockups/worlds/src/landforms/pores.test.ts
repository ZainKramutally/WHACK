import { describe, expect, it } from 'vitest';
import { bakePores, worleyPore } from './pores';

const L = { size: 10, rLo: 0.3, rHi: 0.45, off: 0, dens: 1 };

describe('worleyPore', () => {
  it('is deterministic and dn is non-negative', () => {
    const a = worleyPore(3.1, 4.2, -5.3, L, 1), b = worleyPore(3.1, 4.2, -5.3, L, 1);
    expect(a).toEqual(b);
    expect(a.dn).toBeGreaterThanOrEqual(0);
    expect(a.t).toBeGreaterThanOrEqual(0);
    expect(a.t).toBeLessThan(1);
  });
});

describe('bakePores', () => {
  const o = {
    W: 32, Hpx: 48, H: 100, bury: 3, radiusAt: () => [8, 8] as [number, number],
    layers: [L, { ...L, size: 4 }, null] as any, densBuild: 0.8, vertex: true, scale: 1, seed: 1,
  };
  it('is seamless around the angle (first and last columns agree)', () => {
    const { t1 } = bakePores(o);
    // texel 0 and W-1 sit ±half a texel from the seam: values must be close
    const j = 20;
    const a = t1[(j * 32) * 4], b = t1[(j * 32 + 31) * 4];
    expect(Math.abs(a - b)).toBeLessThan(40);
  });
  it('produces pores (some dn < 1/1.6) and displacement both ways', () => {
    const { t1, t2 } = bakePores(o);
    let inside = 0, neg = 0;
    for (let i = 0; i < t1.length; i += 4) if (t1[i] / 255 * 1.6 < 1 && t1[i + 1] / 255 < 0.8) inside++;
    for (let i = 0; i < t2.length; i += 4) if (t2[i + 2] < 120) neg++;
    expect(inside).toBeGreaterThan(20);
    expect(neg).toBeGreaterThan(5);
  });
});
