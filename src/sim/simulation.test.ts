import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { controlList } from '../worlds/controls';
import type { Conditions, WorldConfig } from '../worlds/types';
import { canLive } from './limits';
import type { LifeDrivers, LifeModel } from './lifeModel';
import { PLAN_LENGTH } from './plan';
import { organismCount, readOrganism } from './organismLayout';
import { makeRng } from './rng';
import { CONSTANTS } from './constants';
import { ORGANISM_STRIDE } from './organismLayout';
import { WorldSimulation, mutationSigmaAt, ticksDueAfter, ticksDueAt, type SimEvent } from './simulation';

// Multi-second ecology runs (full 20 s builds) only run with SLOW=1 (npm run test:slow).
const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;

/** A 4 s build at 1/17 of the ecology fast-forward: the whole lifecycle in a fraction of a second. */
const quick = (w: WorldConfig): WorldConfig => ({ ...w, build: { ...w.build, durationSec: 4, lifeSec: 1, seasSec: [0.5, 1], ecologySec: 20 } });

const EARTH: Conditions = { temperature: 15, nitrogen: 1, oxygen: 21 };

/** A life model with fixed drivers, to test the feedbacks on their own. */
class FixedLife implements LifeModel {
  constructor(private d: LifeDrivers) {}
  seedFounders() {}
  step() {}
  drivers() { return this.d; }
  summary() { return { producers: 0, consumers: 0, generation: 0, traitAverages: {} }; }
  floraBuffer() { return new Float32Array(0); }
  packOrganisms() { return new Float32Array(0); }
  guideAnimals() { return []; }
  drainBirths() { return []; }
}

/** Step the build clock in `dt` slices up to `total` seconds, collecting events. */
function run(sim: WorldSimulation, total: number, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  const n = Math.floor(total / dt + 1e-9);
  for (let i = 0; i < n; i++) {
    sim.advance(dt);
    events.push(...sim.drainEvents());
  }
  if (total - n * dt > 1e-9) sim.advance(total - n * dt); // the remainder, so every frame rate ends at exactly `total`
  events.push(...sim.drainEvents());
  return events;
}

/** Everything state-like in a snapshot, with births (which depend on snapshot timing) left out. */
function fingerprint(sim: WorldSimulation) {
  const s = sim.snapshot();
  return {
    ticks: sim.tickCount, stats: s.stats, controls: s.controls, bands: s.bands, population: s.population,
    generation: s.generation, traitAverages: s.traitAverages, organisms: Array.from(s.organisms), flora: Array.from(s.flora),
  };
}

describe.each([carbon, silicon])('ticksDueAt ($id)', (w: WorldConfig) => {
  const b = w.build;
  it('is zero before life, and reaches ecologySec × 20 ticks exactly at durationSec', () => {
    expect(ticksDueAt(0, b)).toBe(0);
    expect(ticksDueAt(b.lifeSec, b)).toBe(0);
    expect(ticksDueAt(b.durationSec, b)).toBe(b.ecologySec * 20);
    expect(ticksDueAt(b.durationSec + 50, b)).toBe(b.ecologySec * 20);
  });
  it('never decreases', () => {
    let prev = 0;
    for (let t = 0; t <= b.durationSec + 1; t += 0.05) {
      const n = ticksDueAt(t, b);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
  it('continues at 20 ticks per second after the build', () => {
    expect(ticksDueAfter(b.durationSec + 10, b)).toBe(b.ecologySec * 20 + 200);
  });
});

describe('WorldSimulation', () => {
  it('gives the same state at the same time whatever the frame rate', { timeout: 30000 }, () => {
    const at = (dt: number) => {
      const sim = new WorldSimulation(carbon, EARTH);
      run(sim, 9.4, dt);
      return fingerprint(sim);
    };
    const a = at(1 / 60);
    expect(a.ticks).toBe(ticksDueAfter(9.4, carbon.build));
    expect(a.population.consumers).toBeGreaterThan(0);
    expect(at(1 / 17)).toEqual(a);
    expect(at(9.4)).toEqual(a);
  });

  it('catching up in budgeted slices gives the same state as running everything at once', { timeout: 30000 }, () => {
    const once = new WorldSimulation(carbon, EARTH);
    once.advance(9.4);
    const sliced = new WorldSimulation(carbon, EARTH);
    expect(sliced.advance(9.4, 64)).toBe(64);
    expect(sliced.behind).toBe(true);
    while (sliced.behind) sliced.advance(0, 64);
    expect(fingerprint(sliced)).toEqual(fingerprint(once));
  });

  it.each([carbon, silicon])('is deterministic for a seed and differs across seeds ($id)', { timeout: 30000 }, (w: WorldConfig) => {
    const make = (seed?: number) => {
      const sim = new WorldSimulation(w, EARTH, { seed });
      run(sim, 9.4, 0.25);
      return fingerprint(sim);
    };
    const a = make();
    expect(make()).toEqual(a);
    expect(make((w.demoSeed ?? 1) + 1).organisms).not.toEqual(a.organisms);
  });

  it('fires build:life and build:complete once each, at the right times', () => {
    const sim = new WorldSimulation(carbon, EARTH, { life: new FixedLife({ producerBiomass: 0, consumerBiomass: 0, deadBiomass: 0 }) });
    const seen: { type: string; at: number }[] = [];
    for (let i = 0; i < 300; i++) {
      sim.advance(0.1);
      for (const e of sim.drainEvents()) seen.push({ type: e.type, at: sim.elapsedSec });
    }
    const life = seen.filter((e) => e.type === 'build:life');
    const done = seen.filter((e) => e.type === 'build:complete');
    expect(life).toHaveLength(1);
    expect(done).toHaveLength(1);
    expect(life[0].at).toBeGreaterThanOrEqual(carbon.build.lifeSec - 1e-9);
    expect(life[0].at).toBeLessThan(carbon.build.lifeSec + 0.2);
    expect(done[0].at).toBeGreaterThanOrEqual(carbon.build.durationSec - 1e-9);
    expect(done[0].at).toBeLessThan(carbon.build.durationSec + 0.2);
  });

  it('reports buildProgress 0 → 1, reaching 1 only with build:complete', () => {
    const sim = new WorldSimulation(carbon, EARTH, { life: new FixedLife({ producerBiomass: 0, consumerBiomass: 0, deadBiomass: 0 }) });
    expect(sim.snapshot().buildProgress).toBe(0);
    sim.advance(10);
    const mid = sim.snapshot();
    expect(mid.buildProgress).toBeCloseTo(0.5, 6);
    expect(mid.yearsShown).toBeGreaterThan(0);
    expect(mid.yearsShown).toBeLessThan(carbon.build.yearsShown);
    sim.advance(10);
    const end = sim.snapshot();
    expect(sim.buildComplete).toBe(true);
    expect(end.buildProgress).toBe(1);
    expect(end.yearsShown).toBeCloseTo(carbon.build.yearsShown, 0);
  });

  it('moves sliders in a red zone at start and reports each, in order', () => {
    const si = new WorldSimulation(silicon, EARTH);
    expect(si.drainEvents().map((e) => (e.type === 'control:blocked' ? e.controlId : e.type))).toEqual(['temperature', 'nitrogen', 'oxygen']);
    expect(si.conditions()).toEqual(silicon.startDefaults);
    const ca = new WorldSimulation(carbon, EARTH);
    expect(ca.drainEvents()).toEqual([]);
    expect(ca.conditions().temperature).toBeCloseTo(15, 9);
  });

  it('flags only the world-start moves with start: true', () => {
    const sim = new WorldSimulation(silicon, EARTH);
    const atStart = sim.drainEvents();
    expect(atStart).toHaveLength(3);
    for (const e of atStart) expect(e).toMatchObject({ type: 'control:blocked', start: true });
    sim.setControl('temperature', 100); // a drag into a red zone later on
    const later = sim.drainEvents();
    expect(later).toHaveLength(1);
    expect(later[0]).toMatchObject({ type: 'control:blocked', controlId: 'temperature' });
    expect('start' in later[0]).toBe(false);
  });

  it('starts every control inside its living band, and keeps every snapshot field valid', () => {
    for (const w of [carbon, silicon]) {
      const sim = new WorldSimulation(quick(w), EARTH);
      sim.advance(3);
      const s = sim.snapshot();
      for (const c of controlList) {
        expect(s.bands[c.id].empty).toBeFalsy();
        expect(s.controls[c.id]).toBeGreaterThanOrEqual(s.bands[c.id].low - 1e-6);
        expect(s.controls[c.id]).toBeLessThanOrEqual(s.bands[c.id].high + 1e-6);
      }
      for (const stat of w.stats) expect(Number.isFinite(s.stats[stat.id])).toBe(true);
      expect(Number.isFinite(s.stats.seaLevel)).toBe(true);
      expect(s.organisms.length % ORGANISM_STRIDE).toBe(0);
      expect(s.flora.length).toBe(64 * 64 * 2);
    }
  });

  it.each([carbon, silicon])('no sequence of control:set puts a control into a red zone ($id)', { timeout: 30000 }, (w: WorldConfig) => {
    const sim = new WorldSimulation(w, EARTH, { life: new FixedLife({ producerBiomass: 3000, consumerBiomass: 400, deadBiomass: 5 }) });
    sim.advance(10);
    const gravity = sim.snapshot().stats.gravity;
    const rnd = makeRng(99)('controls');
    for (let i = 0; i < 60; i++) {
      const def = controlList[Math.floor(rnd() * 3)];
      const t = rnd();
      // Mostly sweep the full range (log for nitrogen), sometimes jump to the extremes.
      const v = t < 0.15 ? def.min : t > 0.85 ? def.max
        : def.scale === 'log' ? Math.exp(Math.log(def.min) + rnd() * (Math.log(def.max) - Math.log(def.min))) : def.min + rnd() * (def.max - def.min);
      sim.setControl(def.id, v);
      expect(canLive(w, sim.conditions(), { gravity, controls: controlList }).ok).toBe(true);
      sim.advance(0.1);
      expect(canLive(w, sim.conditions(), { gravity, controls: controlList }).ok).toBe(true);
    }
  });

  it('stops a drag at the edge and names the limit', () => {
    const sim = new WorldSimulation(carbon, EARTH);
    sim.drainEvents();
    sim.setControl('temperature', 500);
    expect(sim.drainEvents()).toEqual([{ type: 'control:blocked', controlId: 'temperature', limitId: 'tooHot' }]);
    sim.advance(1.05); // the thumb glides there over 1 s
    expect(sim.conditions().temperature).toBeCloseTo(122, 2);
  });

  describe('slider glide (issue #3)', () => {
    const idle = () => new FixedLife({ producerBiomass: 0, consumerBiomass: 0, deadBiomass: 0 });
    it('moves linearly over 1 s of demo time, then holds the target', () => {
      const sim = new WorldSimulation(carbon, EARTH, { life: idle() });
      sim.advance(30); // build done, live ticks at 20 Hz
      const t0 = sim.conditions().temperature;
      sim.setControl('temperature', t0 + 20);
      expect(sim.conditions().temperature).toBeCloseTo(t0, 6); // nothing jumps
      sim.advance(0.5);
      expect(sim.conditions().temperature).toBeCloseTo(t0 + 10, 1);
      sim.advance(0.55);
      expect(sim.conditions().temperature).toBeCloseTo(t0 + 20, 6);
      sim.advance(1);
      expect(sim.conditions().temperature).toBeCloseTo(t0 + 20, 6);
    });
    it('glides on the build clock before life too, and takes 1 s of demo time in the fast-forward', () => {
      const early = new WorldSimulation(carbon, EARTH, { life: idle() });
      early.advance(2);
      early.setControl('oxygen', 31);
      early.advance(0.5);
      expect(early.conditions().oxygen).toBeCloseTo(26, 1);
      early.advance(0.5);
      expect(early.conditions().oxygen).toBeCloseTo(31, 6);

      const ff = new WorldSimulation(carbon, EARTH, { life: idle() });
      ff.advance(12); // inside the fast-forward: 618 ticks per second of wall time
      const o0 = ff.conditions().oxygen;
      ff.setControl('oxygen', o0 + 10);
      const ticks0 = ff.tickCount;
      ff.advance(0.5); // about 309 ticks, i.e. 0.5 s of demo time
      expect(ff.tickCount - ticks0).toBeGreaterThan(250);
      expect(ff.conditions().oxygen).toBeCloseTo(o0 + 5, 0);
    });
    it('is frame-independent: 60 fps, 17 fps and one jump give the same glide', () => {
      const at = (dt: number) => {
        const sim = new WorldSimulation(carbon, EARTH, { life: idle() });
        run(sim, 11, dt);
        sim.setControl('temperature', 40);
        run(sim, 1.4, dt);
        return fingerprint(sim);
      };
      const a = at(1 / 60);
      expect(at(1 / 17)).toEqual(a);
      expect(at(1.4)).toEqual(a);
    });
    it('restarts from the current value when a drag changes mid-glide', () => {
      const sim = new WorldSimulation(carbon, EARTH, { life: idle() });
      sim.advance(30);
      const t0 = sim.conditions().temperature;
      sim.setControl('temperature', t0 + 20);
      sim.advance(0.5);
      sim.setControl('temperature', t0);
      sim.advance(1.05);
      expect(sim.conditions().temperature).toBeCloseTo(t0, 6);
    });
  });

  it('rejects malformed control:set without changing state', () => {
    const sim = new WorldSimulation(carbon, EARTH);
    const before = sim.conditions();
    expect(() => sim.setControl('nope' as never, 1)).toThrow();
    expect(() => sim.setControl('oxygen', NaN)).toThrow();
    expect(sim.conditions()).toEqual(before);
  });

  it('lets the Temperature slider move the orbit: the new temperature holds', () => {
    const sim = new WorldSimulation(carbon, EARTH);
    sim.setControl('temperature', 40);
    sim.advance(1.05);
    expect(sim.conditions().temperature).toBeCloseTo(40, 6);
    const hot = sim.snapshot().stats.light;
    sim.setControl('temperature', -10);
    sim.advance(1.05);
    expect(sim.snapshot().stats.light).toBeLessThan(hot);
  });

  describe('feedbacks', () => {
    const through = (w: WorldConfig, d: Partial<LifeDrivers>) => {
      const life = new FixedLife({ producerBiomass: 0, consumerBiomass: 0, deadBiomass: 0, ...d });
      const sim = new WorldSimulation(w, EARTH, { life });
      const before = sim.snapshot().stats;
      run(sim, 20, 0.5);
      return { before, after: sim.snapshot().stats };
    };
    describe('carbon air at the ecology steady state (#31)', () => {
      // Late-build ecology (roaming, with the high-mutation build's large bodies): producers ≈ 3,100, consumers ≈ 7,000 biomass units.
      const steady = { producerBiomass: 3100, consumerBiomass: 7000, deadBiomass: 0 };
      const over = (d: Partial<LifeDrivers>, sec = 300) => {
        const sim = new WorldSimulation(carbon, EARTH, { life: new FixedLife({ ...steady, ...d }) });
        const before = sim.snapshot().stats;
        run(sim, sec, 1);
        const after = sim.snapshot().stats;
        return { co2: after.co2 - before.co2, oxygen: after.oxygen - before.oxygen };
      };
      it('holds still when idle: under 0.03 % CO₂ and 0.3 % O₂ in 5 minutes', () => {
        const d = over({});
        expect(Math.abs(d.co2)).toBeLessThan(0.03);
        expect(Math.abs(d.oxygen)).toBeLessThan(0.3);
      });
      it('a consumer crash raises O₂ and lowers CO₂; a consumer boom does the opposite', () => {
        const crash = over({ consumerBiomass: 0 });
        expect(crash.oxygen).toBeGreaterThan(0.3);
        expect(crash.co2).toBeLessThan(-0.01);
        const boom = over({ consumerBiomass: 20000 });
        expect(boom.oxygen).toBeLessThan(-0.3);
        expect(boom.co2).toBeGreaterThan(0.01);
      });
      it('a producer crash lowers O₂ and raises CO₂ (less photosynthesis, same respiration)', () => {
        const crash = over({ producerBiomass: 0 });
        expect(crash.oxygen).toBeLessThan(-0.3);
        expect(crash.co2).toBeGreaterThan(0.01);
      });
    });
    it('carbon: producers raise oxygen and draw down CO₂; consumers pull oxygen back down', () => {
      const p = through(carbon, { producerBiomass: 100 });
      expect(p.after.oxygen).toBeGreaterThan(p.before.oxygen);
      expect(p.after.co2).toBeLessThan(p.before.co2);
      const c = through(carbon, { consumerBiomass: 100 });
      expect(c.after.oxygen).toBeLessThan(c.before.oxygen);
      expect(c.after.co2).toBeGreaterThan(c.before.co2);
    });
    it('carbon: falling CO₂ weakens the greenhouse and cools the climate (when the config carries the CO₂ term)', () => {
      const withCo2 = {
        ...carbon,
        derived: carbon.derived.map((d) => (d.model === 'radiativeBalance' ? { ...d, params: { ...d.params, referenceCo2: 0.04, co2PerDoublingK: 3 } } : d)),
      };
      const p = through(withCo2, { producerBiomass: 100 });
      expect(p.after.temperature).toBeLessThan(p.before.temperature);
    });
    it('silicon: a growing population locks nitrogen away, so the seas shrink; decay returns it', () => {
      const grow = through(silicon, { producerBiomass: 100, consumerBiomass: 100 });
      expect(grow.after.nitrogen).toBeLessThan(grow.before.nitrogen);
      expect(grow.after.seaCover).toBeLessThan(through(silicon, {}).after.seaCover);
      const decay = through(silicon, { deadBiomass: 100 });
      expect(decay.after.nitrogen).toBeGreaterThan(decay.before.nitrogen);
    });
    it('silicon: oxygen stays at zero throughout', () => {
      const g = through(silicon, { producerBiomass: 100, consumerBiomass: 100 });
      expect(g.after.oxygen).toBe(0);
    });
    it('eases a setting back inside its band when the feedbacks push it into a red zone', () => {
      // Silicon: enough nitrogen lock-up to boil the seas away would be a red zone; the sim holds the edge.
      const life = new FixedLife({ producerBiomass: 1e6, consumerBiomass: 1e6, deadBiomass: 0 });
      const sim = new WorldSimulation(silicon, EARTH, { life });
      sim.drainEvents();
      const events = run(sim, 12, 0.5);
      const gravity = sim.snapshot().stats.gravity;
      expect(canLive(silicon, sim.conditions(), { gravity, controls: controlList }).ok).toBe(true);
      expect(events.some((e) => e.type === 'control:blocked' && e.controlId === 'nitrogen' && e.limitId === 'seasGone')).toBe(true);
    });
  });

  describe('life and the field guide', () => {
    it('packs animals and reports each newborn body plan once', () => {
      const sim = new WorldSimulation(carbon, EARTH);
      const ids = new Set<number>();
      let forms = 0;
      for (let i = 0; i < 50; i++) {
        sim.advance(0.25);
        const s = sim.snapshot();
        expect(s.organisms.length / ORGANISM_STRIDE).toBe(s.population.consumers);
        for (const b of s.births) {
          expect(b.plan.length).toBe(PLAN_LENGTH);
          expect(ids.has(b.id)).toBe(false);
          ids.add(b.id);
        }
        forms += sim.drainEvents().filter((e) => e.type === 'guide:newForm').length;
      }
      expect(ids.size).toBeGreaterThan(20);
      expect(forms).toBeGreaterThan(0);
    });
    it('keeps the ecology liquid grid on the sea: founders start in water', () => {
      const sim = new WorldSimulation(carbon, EARTH);
      sim.advance(9.05);
      const s = sim.snapshot();
      expect(s.population.consumers).toBeGreaterThanOrEqual(24);
      expect(s.flora.length).toBe(64 * 64 * 2);
      expect(s.flora.some((v) => v > 0)).toBe(true);
    });
  });

  describe.each([carbon, silicon])('a quick build ($id)', (w: WorldConfig) => {
    it('runs the whole lifecycle: life once, complete once, animals alive, controls in band, deterministic', () => {
      const q = quick(w);
      const go = () => {
        const sim = new WorldSimulation(q, EARTH);
        const events = [...sim.drainEvents()];
        for (let i = 0; i < 90; i++) { sim.advance(0.1); events.push(...sim.drainEvents()); }
        return { sim, events };
      };
      const a = go();
      expect(a.events.filter((e) => e.type === 'build:life')).toHaveLength(1);
      expect(a.events.filter((e) => e.type === 'build:complete')).toHaveLength(1);
      const s = a.sim.snapshot();
      expect(s.buildProgress).toBe(1);
      expect(s.population.consumers).toBeGreaterThan(0);
      for (const c of controlList) {
        expect(s.controls[c.id]).toBeGreaterThanOrEqual(s.bands[c.id].low - 1e-6);
        expect(s.controls[c.id]).toBeLessThanOrEqual(s.bands[c.id].high + 1e-6);
      }
      expect(fingerprint(go().sim)).toEqual(fingerprint(a.sim));
    });
  });

  describe('life near the spawn shore', () => {
    /** Animals within `radius` metres of the character's spawn point. */
    const near = (sim: WorldSimulation, w: WorldConfig, radius: number) => {
      const sp = sim.spawnPointM();
      const o = sim.snapshot().organisms;
      let n = 0;
      for (let i = 0; i < organismCount(o); i++) {
        const r = readOrganism(o, i);
        if (Math.hypot((r.x - 0.5) * w.terrain.patchSize - sp.x, (r.y - 0.5) * w.terrain.patchSize - sp.z) <= radius) n++;
      }
      return n;
    };
    it.each([carbon, silicon])('founders appear in the shallows nearest the spawn ($id)', (w: WorldConfig) => {
      const sim = new WorldSimulation(w, EARTH);
      sim.advance(w.build.lifeSec + 0.05);
      expect(sim.snapshot().population.consumers).toBeGreaterThanOrEqual(24);
      expect(near(sim, w, 40)).toBeGreaterThanOrEqual(20);
    });
    it.skipIf(!slow).each([carbon, silicon])('many animals are still within 40 m of the spawn at the end of the build ($id) (SLOW)', { timeout: 60000 }, (w: WorldConfig) => {
      const sim = new WorldSimulation(w, EARTH);
      sim.advance(w.build.durationSec);
      expect(near(sim, w, 40)).toBeGreaterThanOrEqual(10);
    });
  });

  describe('spores (owner ruling, issue #6)', () => {
    const consumers = (sim: WorldSimulation) => sim.snapshot().population.consumers;
    /** A quick-build world, run past its build, then a heat spike held for `hold` seconds, then back. */
    const spike = (w: WorldConfig, hot: number, back: number, hold: number) => {
      const sim = new WorldSimulation(quick(w), EARTH);
      sim.advance(5);
      const before = consumers(sim);
      sim.setControl('temperature', hot);
      let lowest = before;
      let extinctAt = -1;
      for (let t = 0; t < hold; t += 0.25) {
        sim.advance(0.25);
        const n = consumers(sim);
        lowest = Math.min(lowest, n);
        if (n === 0 && extinctAt < 0) extinctAt = t;
      }
      const atHoldEnd = consumers(sim);
      sim.setControl('temperature', back);
      let backAt = -1;
      for (let t = 0; t < 15 && backAt < 0; t += 0.25) {
        sim.advance(0.25);
        if (consumers(sim) > 0) backAt = t;
      }
      return { sim, before, lowest, extinctAt, atHoldEnd, backAt };
    };

    it('carbon at the hot edge of its band dies out, then animals reappear within seconds of returning to 15 °C', () => {
      const r = spike(carbon, 150, 15, 30); // the sim clamps the drag to the edge, where the kill condition sits
      expect(r.before).toBeGreaterThan(10);
      expect(r.extinctAt).toBeGreaterThanOrEqual(0);
      expect(r.atHoldEnd).toBe(0);
      expect(r.backAt).toBeGreaterThanOrEqual(0);
      expect(r.backAt).toBeLessThanOrEqual(5);
    });
    it('silicon at the warm edge of its band collapses, and life is back (or never left) after returning to −183 °C', () => {
      const r = spike(silicon, -100, -183, 30); // clamped to the edge
      expect(r.lowest).toBeLessThan(r.before / 2);
      expect(r.backAt).toBeGreaterThanOrEqual(0);
      expect(r.backAt).toBeLessThanOrEqual(5);
      expect(consumers(r.sim)).toBeGreaterThan(0);
    });
    it('is deterministic with spores', () => {
      const a = spike(carbon, 150, 15, 20);
      const b = spike(carbon, 150, 15, 20);
      expect(fingerprint(b.sim)).toEqual(fingerprint(a.sim));
      expect([b.extinctAt, b.backAt]).toEqual([a.extinctAt, a.backAt]);
    });
    it('never germinates while conditions are lethal', () => {
      const sim = new WorldSimulation(quick(carbon), EARTH);
      sim.advance(5);
      sim.setControl('temperature', 150); // clamped to the hot edge
      sim.advance(20); // everything is dead by now (see the first test)
      expect(consumers(sim)).toBe(0);
      for (let i = 0; i < 80; i++) {
        sim.advance(0.5);
        expect(consumers(sim)).toBe(0);
      }
    });
  });

  describe('life persists anywhere inside the living band (CLAUDE.md "Condition sliders")', () => {
    // Held for 30 s after the build: stressed near the edges, but not dead. Death is only at or beyond the edge.
    const FAST = new Set(['carbon 55', 'carbon -35', 'silicon -163']);
    const points: [WorldConfig, number][] = [
      ...[-35, 40, 55, 70, 110].map((t): [WorldConfig, number] => [carbon, t]),
      ...[-205, -175, -165, -163].map((t): [WorldConfig, number] => [silicon, t]),
    ];
    const hold = (w: WorldConfig, t: number) => {
      const sim = new WorldSimulation(quick(w), EARTH);
      sim.advance(5);
      sim.setControl('temperature', t);
      sim.advance(1.05);
      expect(sim.conditions().temperature).toBeCloseTo(t, 1); // really inside the band
      sim.advance(30);
      return sim.snapshot().population.consumers;
    };
    it.each(points.filter(([w, t]) => FAST.has(`${w.id} ${t}`)))('%# keeps animals alive for 30 s at an in-band temperature', (w, t) => {
      expect(hold(w, t), `${w.id} ${t} °C`).toBeGreaterThan(0);
    });
    it.skipIf(!slow).each(points)('keeps animals alive for 30 s at %# in band (SLOW)', { timeout: 60000 }, (w, t) => {
      expect(hold(w, t), `${w.id} ${t} °C`).toBeGreaterThan(0);
    });
  });

  describe('a full population holds in band for minutes (SLOW)', () => {
    it.skipIf(!slow).each([[carbon, 70], [carbon, -35], [silicon, -163]] as [WorldConfig, number][])('%# keeps a full-size ecology alive for 90 s at %# °C', { timeout: 120000 }, (w, t) => {
      const sim = new WorldSimulation(w, EARTH);
      sim.advance(w.build.durationSec);
      expect(sim.snapshot().population.consumers).toBeGreaterThan(900);
      sim.setControl('temperature', t);
      for (let i = 0; i < 6; i++) {
        sim.advance(15);
        expect(sim.snapshot().population.consumers, `${w.id} ${t} °C after ${(i + 1) * 15} s`).toBeGreaterThan(0);
      }
    });
  });

  describe('producers feel the lethal edge too', () => {
    const flora = (sim: WorldSimulation) => sim.snapshot().flora.reduce((a, v) => a + v, 0);
    const held = (hot: number) => {
      const sim = new WorldSimulation(quick(carbon), EARTH);
      sim.advance(6);
      const before = flora(sim);
      const o2 = sim.snapshot().stats.oxygen;
      sim.setControl('temperature', hot);
      sim.advance(12);
      return { sim, before, after: flora(sim), o2, o2After: sim.snapshot().stats.oxygen };
    };
    it('at the hot edge the flora dies back to a seed bank and oxygen stops rising', () => {
      const r = held(150);
      expect(r.before).toBeGreaterThan(20);
      expect(r.after).toBeLessThan(0.05 * r.before);
      expect(r.o2After - r.o2).toBeLessThan(0.05);
    });
    it('well inside the band the flora is untouched', () => {
      const r = held(70);
      expect(r.after).toBeGreaterThan(0.8 * r.before);
    });
    it('and it regrows from the seed bank when conditions return', () => {
      const r = held(150);
      r.sim.setControl('temperature', 15);
      r.sim.advance(40);
      expect(flora(r.sim)).toBeGreaterThan(0.6 * r.before);
    });
  });

  describe('field guide events', () => {
    // The silicon case takes over a second, so it only runs with SLOW=1; carbon (under a second) covers the same code in the default run.
    const announcesOnce = (w: WorldConfig) => {
      // 6 s build with 200 ecology-seconds of life (enough for a cluster to reach the build's announcement share), snapshotted at 20 Hz as the worker does.
      const sim = new WorldSimulation({ ...w, build: { ...w.build, durationSec: 6, lifeSec: 1, seasSec: [0.5, 1], ecologySec: 200 } }, EARTH);
      const forms: { binId: number; name: string }[] = [];
      for (let i = 0; i < 160; i++) {
        sim.advance(0.05);
        sim.snapshot();
        for (const e of sim.drainEvents()) if (e.type === 'guide:newForm') forms.push(e);
      }
      expect(forms.length).toBeGreaterThan(0);
      expect(forms.length).toBeLessThanOrEqual(30);
      expect(new Set(forms.map((f) => f.name)).size).toBe(forms.length);
      expect(new Set(forms.map((f) => f.binId)).size).toBe(forms.length);
    };
    it('announces each form once, not once per snapshot (carbon)', () => announcesOnce(carbon));
    it.skipIf(!slow)('announces each form once, not once per snapshot (silicon) (SLOW)', { timeout: 60000 }, () => announcesOnce(silicon));
  });

  describe('end of the build, demo seeds', () => {
    // Both worlds land inside every target at the default sliders with the demo seeds.
    const memo = new Map<string, Record<string, number>>();
    const endOfBuild = (w: WorldConfig) => {
      let stats = memo.get(w.id);
      if (!stats) {
        const sim = new WorldSimulation(w, EARTH);
        sim.advance(w.build.durationSec);
        expect(sim.buildComplete).toBe(true);
        memo.set(w.id, (stats = sim.snapshot().stats));
      }
      return stats;
    };
    it.skipIf(!slow).each([carbon, silicon])('lands inside targets at the default sliders ($id) (SLOW)', { timeout: 60000 }, (w: WorldConfig) => {
      const stats = endOfBuild(w);
      for (const [id, [lo, hi]] of Object.entries(w.targets)) {
        expect(stats[id], `${w.id} ${id}`).toBeGreaterThanOrEqual(lo);
        expect(stats[id], `${w.id} ${id}`).toBeLessThanOrEqual(hi);
      }
    });
    it.skipIf(!slow)('carbon holds O₂, CO₂ and temperature inside targets for 10 minutes after the build, idle (SLOW, #31)', { timeout: 120000 }, () => {
      const sim = new WorldSimulation(carbon, EARTH);
      sim.advance(carbon.build.durationSec);
      const first = sim.snapshot().stats;
      for (let i = 0; i < 20; i++) {
        sim.advance(30);
        const s = sim.snapshot();
        expect(s.population.consumers, `consumers at ${(i + 1) * 30} s`).toBeGreaterThan(0);
        for (const id of ['oxygen', 'co2', 'temperature', 'pressure']) {
          const [lo, hi] = carbon.targets[id];
          expect(s.stats[id], `${id} at ${(i + 1) * 30} s`).toBeGreaterThanOrEqual(lo);
          expect(s.stats[id], `${id} at ${(i + 1) * 30} s`).toBeLessThanOrEqual(hi);
        }
        if (i === 19) {
          expect(Math.abs(s.stats.co2 - first.co2), 'CO₂ drift over 10 min').toBeLessThan(0.1);
          expect(Math.abs(s.stats.temperature - first.temperature), 'temperature drift over 10 min').toBeLessThan(2);
        }
      }
    });
    it.skipIf(!slow).each([carbon, silicon])('stays alive and in band for a minute after the build ($id) (SLOW)', { timeout: 60000 }, (w: WorldConfig) => {
      const sim = new WorldSimulation(w, EARTH);
      sim.advance(w.build.durationSec + 60);
      const s = sim.snapshot();
      expect(s.population.consumers).toBeGreaterThan(100);
      for (const [id, [lo, hi]] of Object.entries(w.targets)) {
        if (id === 'light' || id === 'pace' || id === 'gravity') continue;
        expect(s.stats[id], `${w.id} ${id}`).toBeGreaterThanOrEqual(lo);
        expect(s.stats[id], `${w.id} ${id}`).toBeLessThanOrEqual(hi);
      }
    });
  });
});

describe('mutation schedule (owner ruling: high σ while the world builds, normal σ after)', () => {
  const total = ticksDueAt(carbon.build.durationSec, carbon.build);
  it('starts at SIGMA_BUILD, eases down, and is SIGMA from the end of the build on', () => {
    expect(mutationSigmaAt(0, total)).toBe(CONSTANTS.SIGMA_BUILD.value);
    expect(mutationSigmaAt(total, total)).toBe(CONSTANTS.SIGMA.value);
    expect(mutationSigmaAt(total * 5, total)).toBe(CONSTANTS.SIGMA.value);
    let prev = Infinity;
    for (let t = 0; t <= total; t += 100) {
      const s = mutationSigmaAt(t, total);
      expect(s).toBeLessThanOrEqual(prev);
      expect(s).toBeGreaterThanOrEqual(CONSTANTS.SIGMA.value);
      expect(s).toBeLessThanOrEqual(CONSTANTS.SIGMA_BUILD.value);
      prev = s;
    }
  });
  it('is a pure function of the tick count, so it is the same at any frame rate', () => {
    for (const t of [0, 1000, 3000, 6800, 9000]) expect(mutationSigmaAt(t, total)).toBe(mutationSigmaAt(t, total));
  });
});
