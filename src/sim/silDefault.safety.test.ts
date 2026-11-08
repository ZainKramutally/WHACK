// SLOW: silicon default-run population at build end and +60 s. SLOW=1 npx vitest run src/sim/silDefault.safety.test.ts
import { it } from 'vitest';
import { withCrustChoice } from '../gen/crust';
import { silicon } from '../worlds/silicon';
import { WorldSimulation } from './simulation';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
const EARTH = { temperature: 15, nitrogen: 1, oxygen: 21 };
it.skipIf(!slow)('silicon default run', () => {
  for (const pick of [undefined, 'silicide'] as const) {
    for (const seed of [undefined, 2611, 7, 90210]) {
      const w = withCrustChoice(silicon, pick);
      const sim = new WorldSimulation(w, EARTH, { seed });
      sim.advance(w.build.durationSec);
      const a = sim.snapshot().population.consumers;
      sim.advance(60);
      const b = sim.snapshot().population.consumers;
      console.log(`SIL pick=${pick ?? 'natural'} seed=${seed ?? 'demo'} build=${a} +60s=${b}`);
    }
  }
}, 600_000);
