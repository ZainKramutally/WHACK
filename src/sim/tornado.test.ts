// Repro for the "animal tornado" bug: buoy = 1 gives a massless body (develop mass 0), ecology floors M at 1e-6,
// and M^0.75 income vs M cost makes such animals bud every ~second and die after ~1.3 s, pinning the population at CAP
// with ~24 births per tick. See scripts/debug-tornado.ts for the probe.
import { describe, expect, it } from 'vitest';
import { develop, type DevelopInputs } from './develop';
import { makeFounders } from './genome';
import { carbon } from '../worlds/carbon';
import { CAP } from './ecology';
import { WorldSimulation } from './simulation';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
const water: DevelopInputs = {
  solvent: { rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] },
  airDensity: 0.1,
  tissueDensity: { C: 1.05, Si: 2.2 },
  gravity: 1,
};

describe('tornado: massless bodies', () => {
  it('a fully buoyant body still has tissue mass (gas bag ≠ zero mass)', () => {
    const g = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
    const solid = develop({ ...g, body: { ...g.body, buoy: 0 } }, { light: 1, heatBand: 0.5 }, water);
    const bag = develop({ ...g, body: { ...g.body, buoy: 1 } }, { light: 1, heatBand: 0.5 }, water);
    expect(bag.mass).toBeGreaterThan(0.01 * solid.mass); // fails: bag.mass === 0
  });

  it.skipIf(!slow)('carbon demo run: no mass-floor animals and no per-tick birth storm after the build', () => {
    const w = carbon;
    const sim = new WorldSimulation(w, { ...w.startDefaults });
    const dt = 1 / 20;
    for (let t = 0; t < w.build.durationSec; t += dt) sim.advance(dt);
    const eco = (sim as unknown as { life: { eco: { alive: Uint8Array; struct: Float64Array; nextId: number } } }).life.eco;
    const id0 = eco.nextId;
    const liveSec = 10;
    for (let t = 0; t < liveSec; t += dt) sim.advance(dt);
    let n = 0, atFloor = 0;
    for (let i = 0; i < CAP; i++) if (eco.alive[i]) { n++; if (eco.struct[i] <= 1e-5) atFloor++; }
    const birthsPerTick = (eco.nextId - id0) / (liveSec * 20);
    expect(atFloor / Math.max(1, n)).toBeLessThan(0.05);   // observed 0.65
    expect(birthsPerTick).toBeLessThan(5);                  // observed ~24; ~2 with a mass floor (natural turnover at the cap)
  }, 120_000);
});
