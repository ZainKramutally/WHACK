import { describe, expect, it } from 'vitest';
import { visibleCount, mulberry32, powerLaw, thomas, makeValley, valleyPoint, distToValley } from './placement';
import { growFan } from './fan';

const opts = { total: 200, parents: 9, parentAt: (r: () => number) => [r() * 40 - 20, -r() * 60] as [number, number], sigma: 2 };

describe('thomas', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = thomas(mulberry32(7), opts), b = thomas(mulberry32(7), opts), c = thomas(mulberry32(8), opts);
    expect(a).toEqual(b);
    expect(a[0].x).not.toBe(c[0].x);
  });
  it('produces exactly `total` points, with few big and many small clusters', () => {
    const pts = thomas(mulberry32(3), opts);
    expect(pts.length).toBe(200);
    const sizes = new Map<number, number>();
    pts.forEach((p) => sizes.set(p.parent, (sizes.get(p.parent) ?? 0) + 1));
    const s = [...sizes.values()].sort((x, y) => y - x);
    expect(s[0]).toBeGreaterThan(s[s.length - 1] * 2);
  });
});

describe('powerLaw', () => {
  it('stays within bounds and skews small', () => {
    const r = mulberry32(1);
    const xs = Array.from({ length: 2000 }, () => powerLaw(r, 0.3, 3, 2.2));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.3);
    expect(Math.max(...xs)).toBeLessThanOrEqual(3);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeLessThan(1.2);
    expect(Math.max(...xs)).toBeGreaterThan(2);
  });
  it('handles alpha = 1', () => {
    const x = powerLaw(mulberry32(2), 1, 10, 1);
    expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(10);
  });
});

describe('valley', () => {
  it('offsets laterally and measures distance', () => {
    const v = makeValley([[0, 0], [0, -100]]);
    const p = valleyPoint(v, 50, 6);
    expect(Math.abs(distToValley(v, p[0], p[1]) - 6)).toBeLessThan(1e-6);
    expect(p[1]).toBeCloseTo(-50);
  });
});

describe('growFan', () => {
  it('segment count stays within [levels, cap] and reaches the deepest level', () => {
    for (let seed = 0; seed < 40; seed++) {
      const levels = 4 + (seed % 3);
      const segs = growFan(mulberry32(seed), { levels, maxSegments: 150 });
      expect(segs.length).toBeGreaterThanOrEqual(levels);
      expect(segs.length).toBeLessThanOrEqual(150);
      if (segs.length < 150) expect(Math.max(...segs.map((s) => s.level))).toBe(levels - 1);
    }
  });
  it('is deterministic and has straight segments that all grow upward-ish', () => {
    const a = growFan(mulberry32(5), { levels: 5 }), b = growFan(mulberry32(5), { levels: 5 });
    expect(a).toEqual(b);
    expect(Math.max(...a.map((s) => s.y1))).toBeGreaterThan(1);
  });
});

describe('visibleCount', () => {
  it('counts instances below niche×1.1 in a sorted array', () => {
    const r = new Float32Array([0.1, 0.3, 0.5, 0.7, 0.9]);
    expect(visibleCount(r, 5, 0)).toBe(0);
    expect(visibleCount(r, 5, 0.5)).toBe(3);
    expect(visibleCount(r, 5, 1)).toBe(5);
  });
});
