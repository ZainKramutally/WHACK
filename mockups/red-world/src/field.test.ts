import { describe, it, expect } from 'vitest';
import { mulberry32, fbm } from './rng';
import { heightAt, baseHeight, riverDist, groundData } from './field';
import { RIVER } from './layout';

describe('rng', () => {
  it('mulberry32 is deterministic per seed and differs across seeds', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });
  it('fbm stays in [-1, 1]', () => {
    for (let i = 0; i < 500; i++) {
      const v = fbm(i * 1.37, i * -2.11, 5, 3);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });
});

describe('terrain field', () => {
  it('is finite and bounded over the frame', () => {
    for (let x = -3000; x <= 3000; x += 250) for (let z = -8000; z <= 100; z += 250) {
      const h = heightAt(x, z);
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThan(-60);
      expect(h).toBeLessThan(160);
    }
  });
  it('carves the riverbed below its banks', () => {
    for (const [x, z] of RIVER.slice(1, -1)) {
      expect(heightAt(x, z)).toBeLessThan(baseHeight(x, z) - 1.5);
      expect(riverDist(x, z).d).toBeLessThan(1e-6);
      expect(groundData(x, z)[0]).toBeCloseTo(1, 3);
    }
  });
  it('river arc fraction runs 0 → 1 from camera to hero', () => {
    expect(riverDist(...RIVER[0]).t).toBeCloseTo(0, 5);
    expect(riverDist(...RIVER[RIVER.length - 1]).t).toBeCloseTo(1, 5);
  });
  it('is deterministic', () => {
    expect(heightAt(123.4, -567.8)).toBe(heightAt(123.4, -567.8));
  });
});
