import { describe, expect, it } from 'vitest';
import { createTerrain } from '../gen/terrain';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { GEN0, PULSE0, PULSE_DT, runPlan, type PlanInput } from './generatePlan';

const gen0 = Array.from({ length: GEN0 }, (_, i) => ({ x: ((i * 37) % 100) / 100, y: ((i * 53) % 100) / 100, atom: i < 26 }));
const inputFor = (world: typeof carbon, seed: number): PlanInput => ({
  world, terrain: createTerrain(world.terrain, seed), seed, start: world.startDefaults,
  lowW: 213, lowH: 120, fov: 60, aspect: 16 / 9, gen0, boxCy: 1.6, boxSize: 4, doublings: 3,
});

// Each plan takes ~1.5 s (a 256² terrain grid and thousands of rays): off the default run, per the testing rules.
const SLOW = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
describe.skipIf(!SLOW)('generate plan', { timeout: 120_000 }, () => {
  it('is deterministic and lands every grain inside the patch', () => {
    const a = runPlan(inputFor(carbon, carbon.demoSeed)), b = runPlan(inputFor(carbon, carbon.demoSeed));
    expect(a.N).toBe(GEN0 * 8);
    expect(Array.from(a.A)).toEqual(Array.from(b.A));
    expect(Array.from(a.B)).toEqual(Array.from(b.B));
    const S = carbon.terrain.patchSize;
    for (let i = 0; i < a.N; i++) {
      expect(Math.abs(a.B[i * 4])).toBeLessThan(S / 2);
      expect(Math.abs(a.B[i * 4 + 1])).toBeLessThan(S / 2);
    }
  });
  it('doubles on a pulse: daughters are born after their parents and every generation is complete', () => {
    const p = runPlan(inputFor(silicon, silicon.demoSeed));
    const per = new Array(p.doublings + 1).fill(0);
    for (let i = 0; i < p.N; i++) {
      per[p.gen[i]]++;
      if (p.gen[i] > 0) expect(p.A[i * 4 + 3]).toBeGreaterThanOrEqual(PULSE0 + PULSE_DT * (p.gen[i] - 1));
    }
    expect(per).toEqual([GEN0, GEN0, GEN0 * 2, GEN0 * 4]);
  });
  it('the camera at spawn looks down at the spawn point from behind and above', () => {
    const p = runPlan(inputFor(carbon, carbon.demoSeed));
    expect(p.pose.pos.y).toBeGreaterThan(p.pose.look.y);
    expect(p.pose.pos.z).toBeGreaterThan(p.spawn.z);
  });
  it('silicon plans its seas from the sea-volume model, not a sampled range', () => {
    const p = runPlan(inputFor(silicon, silicon.demoSeed));
    expect(p.seaCover).toBeGreaterThan(5);
  });
});
