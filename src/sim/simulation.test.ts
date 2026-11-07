import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { controlList } from '../worlds/controls';
import type { Conditions, WorldConfig } from '../worlds/types';
import { canLive } from './limits';
import type { LifeDrivers, LifeModel } from './lifeModel';
import { PLAN_LENGTH } from './plan';
import { makeRng } from './rng';
import { WorldSimulation, ticksDueAfter, ticksDueAt, type SimEvent } from './simulation';

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
      expect(s.organisms.length % 28).toBe(0);
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
    expect(sim.conditions().temperature).toBeCloseTo(122, 2);
    expect(sim.drainEvents()).toEqual([{ type: 'control:blocked', controlId: 'temperature', limitId: 'tooHot' }]);
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
    expect(sim.conditions().temperature).toBeCloseTo(40, 6);
    const hot = sim.snapshot().stats.light;
    sim.setControl('temperature', -10);
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
        expect(s.organisms.length / 28).toBe(s.population.consumers);
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
