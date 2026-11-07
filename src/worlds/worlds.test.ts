import { describe, expect, it } from 'vitest';
import { carbon } from './carbon';
import { silicon } from './silicon';
import { controls, controlIds } from './controls';
import { sourceFor, sources } from './sources';
import { worldFor, worlds } from './index';
import type { Sourced, WorldConfig } from './types';

const all: WorldConfig[] = [carbon, silicon];

/** Every Sourced value in a world, with a label for failure messages. */
function sourcedItems(w: WorldConfig): [string, Sourced | { sources: string[]; assumption?: boolean }][] {
  const items: [string, Sourced | { sources: string[]; assumption?: boolean }][] = [];
  w.stats.forEach((s) => items.push([`stat ${s.id}`, s]));
  w.facts.forEach((s) => items.push([`fact ${s.id}`, s]));
  w.feedbacks.forEach((s) => items.push([`feedback ${s.id}`, s]));
  w.derived.forEach((s) => items.push([`derived ${s.statId}`, s]));
  w.limits.forEach((s) => items.push([`limit ${s.id}`, s]));
  w.reasoning.forEach((s, i) => items.push([`reasoning ${i + 1}`, s]));
  Object.entries(w.features).forEach(([k, s]) => items.push([`feature ${k}`, s]));
  items.push(['build', w.build], ['terrain', w.terrain]);
  const { solvent, airDensity, tissueDensity } = w.life.inputs;
  items.push(['life.solvent', solvent], ['life.airDensity', airDensity], ['life.tissueDensity', tissueDensity]);
  return items;
}

describe.each(all)('$id world config', (w) => {
  it('every sourced value has sources or assumption: true', () => {
    for (const [label, s] of sourcedItems(w)) {
      expect(s.sources.length > 0 || s.assumption === true, label).toBe(true);
    }
  });

  it('every source id exists', () => {
    const ids = [...sourcedItems(w).flatMap(([, s]) => s.sources), ...w.solvent.sources];
    for (const id of ids) expect(() => sourceFor(id), id).not.toThrow();
  });

  it('every sourced value has a why', () => {
    for (const [label, s] of sourcedItems(w)) {
      if ('why' in s) expect(s.why.length, label).toBeGreaterThan(0);
    }
  });

  it('limit ids are unique, and limits test a known stat', () => {
    const ids = w.limits.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const statIds = new Set(w.stats.map((s) => s.id));
    for (const l of w.limits) expect(statIds.has(l.statId), l.id).toBe(true);
  });

  it('stat ids are unique; targets, features, feedbacks and derived reference real stats and facts', () => {
    const statIds = w.stats.map((s) => s.id);
    expect(new Set(statIds).size).toBe(statIds.length);
    const factIds = new Set(w.facts.map((f) => f.id));
    for (const k of Object.keys(w.targets)) expect(statIds, k).toContain(k);
    for (const f of Object.values(w.features)) {
      for (const id of f.statIds) expect(statIds, id).toContain(id);
      for (const id of f.factIds) expect(factIds.has(id), id).toBe(true);
    }
    for (const f of w.feedbacks) expect(statIds, f.id).toContain(f.statId);
    for (const d of w.derived) {
      expect(statIds, d.statId).toContain(d.statId);
      for (const i of d.inputs) expect(statIds, i).toContain(i);
    }
  });

  it('has features for all five inspect kinds', () => {
    expect(Object.keys(w.features).sort()).toEqual(['ground', 'organism', 'producer', 'sea', 'sky']);
  });

  it('startDefaults sit inside the full slider range, and not in a fixed-value red zone', () => {
    for (const id of controlIds) {
      expect(w.startDefaults[id]).toBeGreaterThanOrEqual(controls[id].min);
      expect(w.startDefaults[id]).toBeLessThanOrEqual(controls[id].max);
    }
    for (const l of w.limits.filter((l) => l.model === 'fixed')) {
      const v = w.startDefaults[l.statId as keyof typeof w.startDefaults];
      if (v === undefined) continue;
      if (l.side === 'below') expect(v, l.id).toBeGreaterThanOrEqual(l.params.value!);
      else expect(v, l.id).toBeLessThanOrEqual(l.params.value!);
    }
  });

  it('target ranges are well-formed, and the build fits its clock', () => {
    for (const [k, [lo, hi]] of Object.entries(w.targets)) expect(lo, k).toBeLessThanOrEqual(hi);
    const b = w.build;
    expect(b.spawnSec).toBeLessThan(b.durationSec);
    expect(b.seasSec[0]).toBeLessThan(b.seasSec[1]);
    expect(b.seasSec[1]).toBeLessThanOrEqual(b.durationSec);
    expect(b.lifeSec).toBeLessThan(b.durationSec);
  });

  it('vapour-pressure table is sorted by temperature and increasing', () => {
    const t = w.solvent.vapourPressure;
    for (let i = 1; i < t.length; i++) {
      expect(t[i]![0]).toBeGreaterThan(t[i - 1]![0]);
      expect(t[i]![1]).toBeGreaterThan(t[i - 1]![1]);
    }
  });

  it('composition sums to 1', () => {
    const c = w.life.composition;
    expect(c.c + c.si + c.o).toBeCloseTo(1, 10);
  });

  it('terrain relics exist only on silicon', () => {
    expect(Boolean(w.terrain.relics?.length)).toBe(w.id === 'silicon');
  });
});

describe('speculative worlds', () => {
  it('have a caveat; known worlds do not need one', () => {
    for (const w of all) if (w.status === 'speculative') expect(w.caveat?.length).toBeGreaterThan(0);
    expect(carbon.status).toBe('known');
    expect(silicon.status).toBe('speculative');
  });

  it('silicon has the seven-step reasoning chain', () => {
    expect(silicon.reasoning).toHaveLength(7);
  });
});

describe('silicon chemistry', () => {
  it('oxygen limit sits above a trace but pins life to near zero', () => {
    const ox = silicon.limits.find((l) => l.statId === 'oxygen');
    expect(ox).toBeDefined();
    expect(ox!.side).toBe('above');
    expect(ox!.model).toBe('fixed');
    expect(ox!.boxEffect).toBe('rust');
    expect(ox!.params.value!).toBeGreaterThan(0);
    expect(ox!.params.value!).toBeLessThanOrEqual(1);
  });

  it('has no oxygen in its body composition', () => {
    expect(silicon.life.composition.o).toBe(0);
    expect(silicon.life.composition.si).toBeGreaterThan(silicon.life.composition.c);
  });

  it('nitrogen: freezes at -210 C, critical at -147 C, solid sinks; about 3.6 bar at -183 C', () => {
    expect(silicon.solvent.freezeC).toBe(-210);
    expect(silicon.solvent.criticalC).toBe(-147);
    expect(silicon.solvent.solidSinks).toBe(true);
    const at = silicon.solvent.vapourPressure.find(([t]) => Math.abs(t + 183.15) < 0.01);
    expect(at![1]).toBeCloseTo(3.6, 1);
  });

  it('starts cold and oxygen-free, with temperature and sea-cover limits', () => {
    expect(silicon.startDefaults).toEqual({ temperature: -183, nitrogen: 30, oxygen: 0 });
    const t = silicon.limits.filter((l) => l.statId === 'temperature').map((l) => l.id);
    expect(t).toEqual(expect.arrayContaining(['seasFreeze', 'beyondCritical']));
    expect(silicon.limits.find((l) => l.model === 'seasEmpty')).toMatchObject({ statId: 'seaCover', side: 'below' });
  });

  it('uses the vapourPressure and seaVolume models; carbon uses partialPressures', () => {
    const model = (w: WorldConfig, id: string) => w.derived.find((d) => d.statId === id)?.model;
    expect(model(silicon, 'pressure')).toBe('vapourPressure');
    expect(model(silicon, 'seaCover')).toBe('seaVolume');
    expect(model(carbon, 'pressure')).toBe('partialPressures');
  });
});

describe('carbon limits', () => {
  it('has exactly the slider-table edges: -50 C, 122 C, 0.05 x nitrogen, and none for oxygen', () => {
    const v = (id: string) => carbon.limits.find((l) => l.id === id)!;
    expect(v('tooCold').params.value).toBe(-50);
    expect(v('tooHot').params.value).toBe(122);
    expect(v('tooLittleNitrogen').params.value).toBe(0.05);
    expect(carbon.limits.some((l) => l.statId === 'oxygen')).toBe(false);
    expect(carbon.limits).toHaveLength(3);
  });
});

describe('controls', () => {
  it('match the shared ranges', () => {
    expect(controls.temperature).toMatchObject({ min: -250, max: 150, scale: 'linear', default: 15, moves: 'orbitDistance' });
    expect(controls.nitrogen).toMatchObject({ min: 0.01, max: 1000, scale: 'log', default: 1, moves: 'nitrogenInventory' });
    expect(controls.oxygen).toMatchObject({ min: 0, max: 40, scale: 'linear', default: 21, moves: 'oxygenInventory' });
    for (const c of Object.values(controls)) expect(c.hint.length).toBeGreaterThan(0);
  });
});

describe('lookups', () => {
  it('sourceFor throws on an unknown id and returns known ones', () => {
    expect(() => sourceFor('nope')).toThrow(/Unknown source/);
    expect(sourceFor('petkowski2020').doi).toBe('10.3390/life10060084');
    for (const s of Object.values(sources)) expect(s.doi).toBeTruthy();
  });

  it('worldFor returns the config by id', () => {
    expect(worldFor('carbon')).toBe(carbon);
    expect(worldFor('silicon')).toBe(silicon);
    expect(Object.keys(worlds)).toEqual(['carbon', 'silicon']);
    expect(() => worldFor('germanium' as never)).toThrow();
  });
});

describe('air density inputs', () => {
  it.each([carbon, silicon])('$id carries the main gas molar mass (nitrogen, kg/mol)', (w) => {
    expect(w.life.inputs.airDensity.molarMass).toBeCloseTo(0.028, 3);
  });
});
