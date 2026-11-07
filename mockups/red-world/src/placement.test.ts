import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng';
import { poissonDisk, placePlants } from './placement';
import { riverDist } from './field';

describe('poissonDisk', () => {
  it('keeps every pair at least minDist apart and fills the rect', () => {
    const pts = poissonDisk(mulberry32(1), { x0: 0, x1: 200, z0: 0, z1: 100 }, 6);
    expect(pts.length).toBeGreaterThan(200);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
      expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThanOrEqual(6 - 1e-9);
    expect(pts.every(([x, z]) => x >= 0 && x < 200 && z >= 0 && z < 100)).toBe(true);
  });
  it('density mask 0 rejects everything', () => {
    expect(poissonDisk(mulberry32(2), { x0: 0, x1: 50, z0: 0, z1: 50 }, 5, () => 0)).toHaveLength(0);
  });
});

describe('placePlants', () => {
  const run = (seed: number) => placePlants(seed, () => 10);
  it('is deterministic per seed', () => {
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });
  it('keeps scattered plants off the riverbed and gives positive scales', () => {
    const all = run(5);
    expect(all.length).toBeGreaterThan(300);
    for (const p of all.slice(20)) {
      const r = riverDist(p.position[0], p.position[2]);
      expect(r.d).toBeGreaterThan(r.w);
      expect(p.scale).toBeGreaterThan(0);
    }
  });
});

describe('getPlacedPlants (collider export)', () => {
  it('mirrors the last placement with ground height, height and trunk radius', async () => {
    const { getPlacedPlants } = await import('./placement');
    const { heightAt } = await import('./field');
    const all = placePlants(5, () => 10);
    const placed = getPlacedPlants();
    expect(placed).toHaveLength(all.length);
    const p = placed.find((q) => q.species === 'parasolTitan')!;
    expect(p.position[1]).toBe(heightAt(p.position[0], p.position[2]));
    expect(p.height).toBeCloseTo(p.scale * 10);
    expect(p.trunkRadius).toBeGreaterThan(0);
    expect(placed.filter((q) => q.species === 'groundCover').every((q) => q.trunkRadius === 0)).toBe(true);
  });
});
