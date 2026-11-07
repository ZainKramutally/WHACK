// Creatures roam (owner mandate): they graze on the move and cross the patch instead of sitting where they were born.
import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import type { WorldConfig } from '../worlds/types';
import { ecologyFromWorld } from './__fixtures__/ecologyFromWorld';
import { CAP } from './ecology';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
const DT = 1 / 20;

function pathLengths(w: WorldConfig, warm: number, watch: number): { mean: number; tracked: number } {
  const { eco, env } = ecologyFromWorld(w);
  eco.seedLife(env);
  for (let t = 0; t < warm; t++) eco.step(env, DT);
  const last = new Map<number, [number, number]>();
  const path = new Map<number, number>();
  const born = new Set<number>();
  for (let i = 0; i < CAP; i++) if (eco.alive[i]) { last.set(eco.id[i], [eco.x[i], eco.y[i]]); born.add(eco.id[i]); }
  for (let t = 0; t < watch; t++) {
    eco.step(env, DT);
    for (let i = 0; i < CAP; i++) {
      if (!eco.alive[i] || !born.has(eco.id[i])) continue;
      const p = last.get(eco.id[i])!;
      path.set(eco.id[i], (path.get(eco.id[i]) ?? 0) + Math.hypot(eco.x[i] - p[0], eco.y[i] - p[1]));
      last.set(eco.id[i], [eco.x[i], eco.y[i]]);
    }
  }
  const v = [...path.values()];
  return { mean: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length), tracked: v.length };
}

describe('animals roam', () => {
  it.each([carbon, silicon])('an animal covers several cells in 10 s of grazing ($id)', (w: WorldConfig) => {
    const r = pathLengths(w, 100, 200);
    expect(r.tracked).toBeGreaterThan(10);
    expect(r.mean).toBeGreaterThan(3); // cells; before the wander walk an animal moved about 0.3 cells in 10 s
  });
  it.skipIf(!slow).each([carbon, silicon])('a full ecology still roams: several cells per 10 s at the cap ($id) (SLOW)', { timeout: 120000 }, (w: WorldConfig) => {
    const r = pathLengths(w, 3400, 200);
    expect(r.tracked).toBeGreaterThan(200);
    expect(r.mean).toBeGreaterThan(3);
  });
});
