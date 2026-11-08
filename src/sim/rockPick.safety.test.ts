// Safety check for strong rock picks (favour 0.9): life must survive the build on every pick, both worlds.
// Slow: SLOW=1 npx vitest run src/sim/rockPick.safety.test.ts
import { describe, expect, it } from 'vitest';
import { withCrustChoice } from '../gen/crust';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { ecologyFromWorld } from './__fixtures__/ecologyFromWorld';
import { CAP } from './ecology';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
const PICKS = [undefined, 'basalt', 'granite', 'ironstone', 'silicide', 'nitride'] as const;

describe('rock pick safety', () => {
  it.skipIf(!slow)('producers and consumers survive the build on every pick', () => {
    for (const base of [carbon, silicon]) {
      for (const pick of PICKS) {
        const w = withCrustChoice(base, pick);
        const { eco, env } = ecologyFromWorld(w);
        eco.seedLife(env);
        for (let t = 0; t < 340 * 20; t++) eco.step(env, 1 / 20);
        let n = 0;
        for (let i = 0; i < CAP; i++) if (eco.alive[i]) n++;
        const f = eco.floraSnapshot();
        let producers = 0;
        for (let i = 0; i < f.length; i++) producers += f[i];
        console.log(`SAFETY ${base.id} ${pick ?? 'natural'} producers=${producers.toFixed(2)} consumers=${n}`);
        expect(producers).toBeGreaterThan(0);
        expect(n).toBeGreaterThan(0);
      }
    }
  }, 300_000);
});
