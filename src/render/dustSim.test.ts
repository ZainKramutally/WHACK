import { describe, expect, it } from 'vitest';
import { createDustPool, dustSurface, LANDING_CAP, type DustPlayer } from './dustSim';

const tint = { r: 0.5, g: 0.5, b: 0.5 };
const base: DustPlayer = { x: 0, y: 0, z: 0, vx: 0, vz: 0, heading: 0, speed: 0, mode: 'walk', grounded: true, sprinting: false, onIce: false, landed: 0 };
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const run = (pool: ReturnType<typeof createDustPool>, p: DustPlayer, sec: number, surface = dustSurface(p)) => {
  for (let t = 0; t < sec; t += 1 / 60) pool.update(1 / 60, p, surface, 1, tint, rand);
};

describe('dust emitter', () => {
  it('emits nothing while standing still', () => {
    const pool = createDustPool(); run(pool, base, 2);
    expect(pool.alive()).toBe(0);
  });
  it('emits footfall puffs while walking, more when sprinting', () => {
    const a = createDustPool(); run(a, { ...base, speed: 5, vx: 5 }, 0.5);
    const b = createDustPool(); run(b, { ...base, speed: 9, vx: 9, sprinting: true }, 0.5);
    expect(a.alive()).toBeGreaterThan(0);
    expect(b.alive()).toBeGreaterThan(a.alive());
  });
  it('emits nothing while swimming', () => {
    const pool = createDustPool(); run(pool, { ...base, mode: 'swim', speed: 5, vx: 5 }, 1);
    expect(pool.alive()).toBe(0);
  });
  it('landing burst grows with impact and respects the cap', () => {
    const light = createDustPool(); light.update(1 / 60, { ...base, landed: 0.1 }, 'ground', 1, tint, rand);
    const hard = createDustPool(); hard.update(1 / 60, { ...base, landed: 1 }, 'ground', 1, tint, rand);
    expect(hard.alive()).toBeGreaterThan(light.alive());
    expect(hard.alive()).toBeLessThanOrEqual(LANDING_CAP);
  });
  it('reuses pool slots and fades out', () => {
    const pool = createDustPool(16);
    for (let i = 0; i < 10; i++) pool.update(1 / 60, { ...base, landed: 1 }, 'ground', 1, tint, rand);
    expect(pool.alive()).toBeLessThanOrEqual(16);
    run(pool, base, 1.5);
    expect(pool.alive()).toBe(0);
  });
  it('dust hangs longer at low gravity', () => {
    const peak = (g: number) => {
      const pool = createDustPool(8); let max = 0;
      pool.update(1 / 60, { ...base, landed: 1 }, 'ground', g, tint, () => 0.5);
      for (let t = 0; t < 0.3; t += 1 / 60) { pool.update(1 / 60, base, 'none', g, tint, () => 0.5); for (let i = 0; i < 8; i++) if (pool.life[i] > 0) max = Math.max(max, pool.py[i]); }
      return max;
    };
    expect(peak(0.3)).toBeGreaterThan(peak(1.5));
  });
});
