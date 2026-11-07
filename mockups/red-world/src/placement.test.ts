import { describe, it, expect, beforeAll } from 'vitest';
import { mulberry32 } from './rng';
import { poissonDisk, placePlants, getPlacedPlants } from './placement';
import { riverDist, heightAt } from './field';

describe('poissonDisk', () => {
  it('keeps every pair at least minDist apart and fills the rect', () => {
    const pts = poissonDisk(mulberry32(1), { x0: 0, x1: 200, z0: 0, z1: 100 }, 6);
    expect(pts.length).toBeGreaterThan(200);
    let min = Infinity; // all pairs, one assertion (an expect per pair made this test slow)
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
      min = Math.min(min, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    expect(min).toBeGreaterThanOrEqual(6 - 1e-9);
    expect(pts.every(([x, z]) => x >= 0 && x < 200 && z >= 0 && z < 100)).toBe(true);
  });
  it('density mask 0 rejects everything', () => {
    expect(poissonDisk(mulberry32(2), { x0: 0, x1: 50, z0: 0, z1: 50 }, 5, () => 0)).toHaveLength(0);
  });
});

// One full-world placement shared by the property tests (it is the expensive call); determinism runs on a clipped region
// that still spans the hero frame, the start dunes and the explorer, across two seeds.
const REGION = { x0: -320, x1: 320, z0: -520, z1: 160 };
let full: ReturnType<typeof placePlants>, placedAfterFull: ReturnType<typeof getPlacedPlants>;
beforeAll(() => { full = placePlants(5, () => 10); placedAfterFull = getPlacedPlants(); });

describe('placePlants', () => {
  const run = (seed: number) => placePlants(seed, () => 10, undefined, REGION);
  it('is deterministic per seed', () => {
    const a = run(5), b = run(5), c = run(6);
    expect(a.length).toBeGreaterThan(500);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
  it('keeps scattered plants off the riverbed and gives positive scales', () => {
    expect(full.length).toBeGreaterThan(300);
    const bad = full.slice(20).filter((p) => { const r = riverDist(p.position[0], p.position[2]); return !(r.d > r.w) || !(p.scale > 0); });
    expect(bad).toEqual([]);
  });
});

describe('getPlacedPlants (collider export)', () => {
  it('mirrors the last placement with ground height, height and trunk radius', () => {
    const placed = placedAfterFull;
    expect(placed).toHaveLength(full.length);
    const p = placed.find((q) => q.species === 'parasolTitan')!;
    expect(p.position[1]).toBe(heightAt(p.position[0], p.position[2]));
    expect(p.height).toBeCloseTo(p.scale * 10);
    expect(p.trunkRadius).toBeGreaterThan(0);
    expect(placed.filter((q) => q.species === 'groundCover').every((q) => q.trunkRadius === 0)).toBe(true);
  });
});
