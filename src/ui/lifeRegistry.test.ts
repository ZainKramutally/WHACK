import { describe, expect, it } from 'vitest';
import { createBus } from '../bus';
import { makeFounders, type AnimalGenome } from '../sim/genome';
import { ORGANISM_STRIDE, packOrganism, type OrganismRecord } from '../sim/organismLayout';
import { PLAN_LENGTH, PLAN_VERSION } from '../sim/plan';
import { analyseAnimals, mountLifeRegistry } from './lifeRegistry';
import type { SimSnapshot } from '../worlds/types';

function buffer(genomes: AnimalGenome[], producers = 0): Float32Array {
  const buf = new Float32Array((genomes.length + producers) * ORGANISM_STRIDE);
  const rec = (g: AnimalGenome, i: number, role: number): OrganismRecord => ({
    x: 0.5, y: 0.5, role, size: 0.2, prefTemp: g.climate.prefTemp, tolerance: g.climate.tolerance, chem: g.climate.chem, energy: 0.5,
    id: 100 + i, generation: 1, heading: 0, mode: 0, body: g.body, comp: g.comp, lineage: g.lineage,
  });
  genomes.forEach((g, i) => packOrganism(buf, i, rec(g, i, 1)));
  for (let k = 0; k < producers; k++) packOrganism(buf, genomes.length + k, rec(genomes[0]!, 1000 + k, 0));
  return buf;
}

describe('analyseAnimals', () => {
  const worms = makeFounders(3, 24, { c: 0.8, si: 0, o: 0.2 });

  it('names every animal and counts forms; producers are ignored', () => {
    const a = analyseAnimals(buffer(worms, 5));
    expect(a.nameOf.size).toBe(24);
    const total = [...a.forms.values()].reduce((n, f) => n + f.alive, 0);
    expect(total).toBe(24);
    expect(a.dominant).not.toBeNull();
    expect(a.dominant!.alive).toBe(Math.max(...[...a.forms.values()].map((f) => f.alive)));
    expect(a.dominant!.type.label).toMatch(/ · /);
  });
  it('is deterministic and empty for no animals', () => {
    expect([...analyseAnimals(buffer(worms)).nameOf]).toEqual([...analyseAnimals(buffer(worms)).nameOf]);
    expect(analyseAnimals(new Float32Array(0)).dominant).toBeNull();
  });
  it('gives silicon-leaning bodies silicon names', () => {
    const si = worms.map((g) => ({ ...g, comp: { c: 0.05, si: 0.9, o: 0.05 } }));
    const names = [...analyseAnimals(buffer(si)).forms.keys()];
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => /^(Glass|Prism|Ceramic|Shard|Monolith|Fleck) /.test(n))).toBe(true);
  });
});

describe('mountLifeRegistry', () => {
  function snapshot(t: number, buf: Float32Array, births: SimSnapshot['births'] = []): SimSnapshot {
    return { timeSec: t, organisms: buf, births } as SimSnapshot;
  }

  it('maps animals to forms, recognising a name only after guide:newForm, and lists the guide with live counts', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const worms = makeFounders(3, 24, { c: 0.8, si: 0, o: 0.2 });
    bus.emit('sim:snapshot', snapshot(5, buffer(worms)));
    const f = reg.formOf(100)!;
    expect(f.name).toBeTruthy();
    expect(f.recognised).toBe(false);
    expect(reg.forms()).toEqual([]);

    bus.emit('guide:newForm', { binId: 1, name: f.name, organismId: 100 });
    expect(reg.formOf(100)!.recognised).toBe(true);
    const row = reg.forms()[0]!;
    expect(row.name).toBe(f.name);
    expect(row.firstSeenSec).toBe(5);
    expect(row.alive).toBeGreaterThan(0);
    expect(row.type).toMatch(/ · /);

    // later: the whole population is gone → none alive, the entry stays
    bus.emit('sim:snapshot', snapshot(9, new Float32Array(0)));
    expect(reg.forms()[0]!.alive).toBe(0);
    expect(reg.dominant()).toBeNull();
    reg.dispose();
  });

  it('keeps unpacked body plans from births and survives a bad plan', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const bad = new Float32Array(PLAN_LENGTH); // version 0: unknown
    bus.emit('sim:snapshot', snapshot(1, new Float32Array(0), [{ id: 5, plan: bad }]));
    expect(reg.planOf(5)).toBeUndefined();
    const ok = new Float32Array(PLAN_LENGTH);
    ok[0] = PLAN_VERSION;
    bus.emit('sim:snapshot', snapshot(2, new Float32Array(0), [{ id: 6, plan: ok }]));
    expect(reg.planOf(6)).toBeDefined();
    reg.dispose();
  });

  it('notifies subscribers when the analysis refreshes', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    let n = 0;
    const off = reg.onChange(() => n++);
    bus.emit('sim:snapshot', snapshot(0, new Float32Array(0)));
    bus.emit('sim:snapshot', snapshot(0.5, new Float32Array(0))); // less than a second later: no re-analysis
    bus.emit('sim:snapshot', snapshot(1.2, new Float32Array(0)));
    expect(n).toBe(2);
    off();
    reg.dispose();
  });
});
