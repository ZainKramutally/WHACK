// SLOW safety check for the rock chips: every pick on both worlds, at the demo seed, must leave life alive at build end.
// Run once: SLOW=1 npx vitest run src/sim/crustPick.safety.test.ts
import { describe, expect, it } from 'vitest';
import { withCrustChoice } from '../gen/crust';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import type { Conditions } from '../worlds/types';
import { WorldSimulation } from './simulation';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;

describe('rock pick safety', () => {
  it.skipIf(!slow)('life survives the build under every pick', () => {
    const rows: string[] = [];
    for (const w of [carbon, silicon]) {
      const req = { ...w.startDefaults, ...(w.id === 'carbon' ? { temperature: 15, nitrogen: 1, oxygen: 21 } : {}) } as Conditions;
      for (const pick of [undefined, ...w.terrain.crust.minerals.filter((m) => m.pick).map((m) => m.id)]) {
        const sim = new WorldSimulation(withCrustChoice(w, pick), req);
        for (let i = 0; i < 20 * (w.build.durationSec + 1); i++) sim.advance(0.05);
        const s = sim.snapshot();
        rows.push(`${w.id} ${pick ?? 'natural'}: build=${s.buildProgress.toFixed(2)} producers=${s.population.producers.toFixed(1)} consumers=${s.population.consumers.toFixed(1)}`);
        expect(s.population.producers, `${w.id}/${pick}`).toBeGreaterThan(0);
        expect(s.population.consumers, `${w.id}/${pick}`).toBeGreaterThan(0);
      }
    }
    console.log(rows.join('\n'));
  }, 300_000);
});
