// Headless A/B for the crust (DECISIONS §G): uniform starting supply vs crust supply, both worlds, several seeds.
// Slow: run with `SLOW=1 npx vitest run src/sim/crust.ab.test.ts`. Prints mean §A metrics per arm.
import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import type { WorldConfig } from '../worlds/types';
import { ecologyFromWorld } from './__fixtures__/ecologyFromWorld';
import { CAP } from './ecology';
import type { GuideAnimal } from './guide';
import { eatsIntensity } from './relationships';
import type { BodyPlan } from './develop';
import { bodyMassSpread, dominantShare, functionalDispersion, otuCount, trophicWeb } from './metrics';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
const DT = 1 / 20;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const TICKS = 340 * 20;   // the build's fast-forward: about 340 ecology-seconds

function run(w: WorldConfig, seed: number, uniform: boolean) {
  const { eco, env } = ecologyFromWorld(w, { uniform, seed });
  eco.seedLife(env);
  for (let t = 0; t < TICKS; t++) eco.step(env, DT);
  const animals: GuideAnimal[] = [];
  const masses: number[] = [];
  const plans = new Map<number, BodyPlan>();
  for (let i = 0; i < CAP; i++) {
    if (!eco.alive[i]) continue;
    animals.push({ id: eco.id[i], genome: eco.genome[i], mode: eco.plan[i].mode });
    masses.push(eco.plan[i].mass);
    plans.set(eco.id[i], eco.plan[i]);
  }
  const web = trophicWeb(animals, (a, b) => eatsIntensity(plans.get(a.id)!, plans.get(b.id)!) > 0);
  return { n: animals.length, otus: otuCount(animals), fdis: functionalDispersion(animals), dom: dominantShare(animals), links: web.links, chain: web.maxChain, massSpread: bodyMassSpread(masses) };
}

describe('crust A/B', () => {
  it.skipIf(!slow)('uniform vs crust supply', () => {
    for (const w of [carbon, silicon]) {
      for (const uniform of [true, false]) {
        const rs = SEEDS.map((s) => run(w, s, uniform));
        const mean = (k: keyof (typeof rs)[number]) => (rs.reduce((a, r) => a + r[k], 0) / rs.length).toFixed(3);
        console.log(`${w.id} ${uniform ? 'uniform' : 'crust  '} n=${mean('n')} otus=${mean('otus')} fdis=${mean('fdis')} dom=${mean('dom')} links=${mean('links')} chain=${mean('chain')} massSpread=${mean('massSpread')}`);
      }
    }
    expect(true).toBe(true);
  }, 600_000);
});
