import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { withCrustChoice } from '../gen/crust';
import { createTerrain, seaLevelForCover, spawnPoint, type TerrainState } from '../gen/terrain';
import { makeRng } from './rng';
import { iceCoverShift, seaFreeboard, type FreeboardParams } from './models';
import { organismCount, readOrganism } from './organismLayout';
import { WorldSimulation } from './simulation';

const P = carbon.derived.find((d) => d.model === 'seaFreeboard')!.params as unknown as FreeboardParams;
const EARTH = { temperature: 15, nitrogen: 1, oxygen: 21 };
const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
const cover = (w = carbon, seed?: number, temperature = 15) => new WorldSimulation(w, { ...EARTH, temperature }, { seed }).snapshot().stats;

describe('carbon sea cover from crust and temperature', () => {
  it('is monotonic in basalt share and in temperature, and clamps', () => {
    let prev = -1;
    for (let b = 0; b <= 1; b += 0.1) { const c = seaFreeboard(P, 0.67, b, 0.05, 15, 15); expect(c).toBeGreaterThanOrEqual(prev); prev = c; }
    prev = -1;
    for (let t = -60; t <= 130; t += 10) { const c = seaFreeboard(P, 0.67, 0.05, 0.05, t, 15); expect(c).toBeGreaterThanOrEqual(prev); prev = c; }
    expect(seaFreeboard(P, 0.9, 1, 0.05, 130, 15)).toBe(P.maxCover);
    expect(seaFreeboard(P, 0.3, 0, 0.5, -200, 15)).toBe(P.minCover);
    expect(iceCoverShift(P, 0)).toBe(0);
    expect(iceCoverShift(P, -65)).toBeCloseTo(-0.15, 2);
    expect(iceCoverShift(P, 45)).toBeCloseTo(0.05, 2);
  });

  it('the default rock chip at 15 °C keeps the sampled cover exactly', () => {
    const w = withCrustChoice(carbon, carbon.terrain.crust.defaultPick);
    const sampled = makeRng(carbon.demoSeed)('world');
    const st = Object.fromEntries(carbon.stats.map((s) => { const r = carbon.ranges[s.id]; return [s.id, r ? r[0] + (r[1] - r[0]) * sampled() : 0]; }));
    const c = new WorldSimulation(w, EARTH);
    // stats.seaCover is scaled by the sea fill during the build; read it once the seas have filled
    c.advance(c.world.build.seasSec[1] + 0.1);
    expect(c.snapshot().stats.seaCover).toBeCloseTo(st.seaCover, 6);
  });

  it('basalt floods, granite does not, cold lowers and warm raises the sea', () => {
    const end = (w: typeof carbon, t = 15) => { const s = new WorldSimulation(w, { ...EARTH, temperature: t }); s.advance(w.build.seasSec[1] + 0.1); return s.snapshot().stats.seaCover; };
    const base = end(withCrustChoice(carbon, 'ironstone'));
    expect(end(withCrustChoice(carbon, 'basalt'))).toBeGreaterThan(90);
    expect(end(carbon)).toBeGreaterThan(base);
    expect(end(withCrustChoice(carbon, 'granite'))).toBeLessThanOrEqual(base + 1);
    expect(end(withCrustChoice(carbon, 'ironstone'), -40)).toBeLessThan(base);
    expect(end(withCrustChoice(carbon, 'ironstone'), 60)).toBeGreaterThan(base);
  });

  it('a slider drag eases the sea over seconds, not instantly', () => {
    const w0 = withCrustChoice(carbon, 'ironstone');
    const w = { ...w0, build: { ...w0.build, durationSec: 2, lifeSec: 0.5, seasSec: [0.2, 0.5] as [number, number], ecologySec: 5 } };
    const sim = new WorldSimulation(w, EARTH);
    sim.advance(w.build.durationSec + 0.1);
    const before = sim.snapshot().stats.seaCover;
    sim.setControl('temperature', -40);
    sim.advance(0.5);
    const mid = sim.snapshot().stats.seaCover;
    sim.advance(10);
    const after = sim.snapshot().stats.seaCover;
    expect(before - mid).toBeLessThan(before - after);
    expect(after).toBeLessThan(before - 5);
  });

  it('a cold drag and back keeps the world finite and alive', () => {
    const w0 = withCrustChoice(carbon, 'ironstone');
    const w = { ...w0, build: { ...w0.build, durationSec: 4, lifeSec: 1, seasSec: [0.5, 1] as [number, number], ecologySec: 20 } };
    const sim = new WorldSimulation(w, EARTH);
    sim.advance(5);
    const covers: number[] = [];
    const step = (sec: number) => { for (let i = 0; i < sec * 4; i++) { sim.advance(0.25); const s = sim.snapshot(); covers.push(s.stats.seaCover); for (const v of Object.values(s.stats)) expect(Number.isFinite(v)).toBe(true); } };
    sim.setControl('temperature', -40); step(6);
    sim.setControl('temperature', 15); step(6);
    const s = sim.snapshot();
    expect(s.population.consumers).toBeGreaterThan(0);
    expect(s.population.producers).toBeGreaterThan(0);
    for (let i = 1; i < covers.length; i++) expect(Math.abs(covers[i] - covers[i - 1])).toBeLessThan(1.6);   // eased: no jump (cover moves at most 3 points/s, plus the fill)
  });

  const state: TerrainState = { rise: 1, heatSolvent: 0.5, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 } };
  it('the spawn stays on land by a reachable shore at every cover from the minimum to the maximum', () => {
    for (const seed of [1, 2, 3, 42, 99, 314, carbon.demoSeed]) {
      const t = createTerrain(carbon.terrain, seed);
      for (const c of [P.minCover, 0.5, 0.84, 0.95, P.maxCover]) {
        const lvl = seaLevelForCover(t, state, c);
        const sp = spawnPoint(t, state, lvl);
        expect(sp.shoreFound, `seed ${seed} cover ${c}`).toBe(true);
        expect(sp.height, `seed ${seed} cover ${c}`).toBeGreaterThan(lvl);
      }
    }
  });

  it('founders still seed in the shallows on the basalt pick', () => {
    const w = withCrustChoice(carbon, 'basalt');
    const sim = new WorldSimulation(w, EARTH);
    sim.advance(w.build.lifeSec + 0.05);
    const snap = sim.snapshot();
    expect(snap.population.consumers).toBeGreaterThanOrEqual(24);
    const sp = sim.spawnPointM(), o = snap.organisms;
    let n = 0;
    for (let i = 0; i < organismCount(o); i++) {
      const r = readOrganism(o, i);
      if (Math.hypot((r.x - 0.5) * w.terrain.patchSize - sp.x, (r.y - 0.5) * w.terrain.patchSize - sp.z) <= 40) n++;
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });

  it.skipIf(!slow)('safety: every case ends the build alive (SLOW)', { timeout: 280000 }, () => {
    const cases: [string, typeof carbon, number][] = [
      ['natural', carbon, 15], ['ironstone', withCrustChoice(carbon, 'ironstone'), 15], ['basalt', withCrustChoice(carbon, 'basalt'), 15],
      ['granite', withCrustChoice(carbon, 'granite'), 15], ['basalt 60C', withCrustChoice(carbon, 'basalt'), 60], ['basalt -10C', withCrustChoice(carbon, 'basalt'), -10],
    ];
    for (const [name, w, t] of cases) {
      const sim = new WorldSimulation(w, { ...EARTH, temperature: t });
      sim.advance(w.build.durationSec);
      const s = sim.snapshot();
      console.log(`SAFETY ${name}: cover ${s.stats.seaCover.toFixed(1)} producers ${s.population.producers.toFixed(1)} consumers ${s.population.consumers}`);
      expect(s.population.consumers, name).toBeGreaterThan(0);
      expect(s.population.producers, name).toBeGreaterThan(0);
    }
  });
});
