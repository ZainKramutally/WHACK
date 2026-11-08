import { describe, expect, it } from 'vitest';
import { createBus } from '../bus';
import { makeFounders, type AnimalGenome } from '../sim/genome';
import { ORGANISM_STRIDE, packOrganism, type OrganismRecord } from '../sim/organismLayout';
import { PLAN_FIELDS, PLAN_LENGTH, PLAN_VERSION } from '../sim/plan';
import { LOCOMOTION } from '../sim/develop';
import { organismRows } from './lifeText';
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

describe('form name and card agree on locomotion', () => {
  // Genes that would read as a floater (high buoy), but whose real, cost-picked mode is walking.
  const walkers = makeFounders(4, 12, { c: 0.8, si: 0, o: 0.2 }).map((g) => ({ ...g, body: { ...g.body, buoy: 0.9, limbPairs: 0.5, limbLen: 0.3 } }));

  it('uses the plan mode, so a walker cluster is named and typed as a walker, not a drifter', () => {
    const buf = buffer(walkers);
    const byGenes = analyseAnimals(buf);
    expect([...byGenes.forms.keys()].every((n) => n.endsWith('Drifter'))).toBe(true); // genes alone say floater
    const byMode = analyseAnimals(buf, () => LOCOMOTION.walk);
    for (const f of byMode.forms.values()) {
      expect(f.name).toMatch(/Walker$/);
      expect(f.type.locomotion).toBe('walker');
    }
  });

  it('the card says "Walks on the ground" for a member of that walker cluster', () => {
    const buf = buffer(walkers);
    const a = analyseAnimals(buf, () => LOCOMOTION.walk);
    const name = a.nameOf.get(100)!;
    const plan = { mode: LOCOMOTION.walk, diet: 0.1 } as Parameters<typeof organismRows>[1];
    const rows = organismRows(
      { ...({} as Parameters<typeof organismRows>[0]), size: 0.2, prefTemp: 15, tolerance: 5, chem: 0.5, energy: 0.5, generation: 1, mode: LOCOMOTION.swim, body: walkers[0]!.body },
      plan, { chemistry: 'carbon', form: { name, recognised: true }, alive: true },
    );
    expect(name).toMatch(/Walker$/);
    expect(rows.find(([k]) => k === 'Moves')![1]).toBe('Walks on the ground'); // plan mode wins over rec.mode (swim)
  });

  it('mountLifeRegistry feeds plan modes into the analysis', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const buf = buffer(walkers);
    const plan = new Float32Array(PLAN_LENGTH);
    plan[0] = PLAN_VERSION;
    plan[1 + PLAN_FIELDS.indexOf('mode')] = LOCOMOTION.walk;
    plan[1 + PLAN_FIELDS.indexOf('segmentCount')] = 4;
    plan[1 + PLAN_FIELDS.indexOf('sides')] = 12;
    const births = walkers.map((_, i) => ({ id: 100 + i, plan }));
    bus.emit('sim:snapshot', { timeSec: 3, organisms: buf, births } as SimSnapshot);
    expect(reg.formOf(100)!.name).toMatch(/Walker$/);
    reg.dispose();
  });
});

describe('mountLifeRegistry', () => {
  function snapshot(t: number, buf: Float32Array, births: SimSnapshot['births'] = []): SimSnapshot {
    return { timeSec: t, organisms: buf, births } as SimSnapshot;
  }

  it('files common kinds locked, finds a kind when one of its animals is clicked, and files it extinct when all are gone', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const worms = makeFounders(3, 24, { c: 0.8, si: 0, o: 0.2 });
    const found: string[] = [];
    reg.onDiscover((n) => found.push(n));
    bus.emit('sim:snapshot', snapshot(5, buffer(worms)));
    const f = reg.formOf(100)!;
    expect(f.name).toBeTruthy();
    expect(f.recognised).toBe(false);
    const locked = reg.bestiary().living();
    expect(locked.length).toBeGreaterThan(0);              // the founders' kinds are common enough to be filed
    expect(locked.every((e) => !e.found)).toBe(true);

    bus.emit('inspect:open', { target: { kind: 'organism', organismId: 100 }, at: { x: 0, y: 0 } });
    expect(reg.formOf(100)!.recognised).toBe(true);
    expect(found).toEqual([f.name]);
    const e = reg.bestiary().get(f.name)!;
    expect(e).toMatchObject({ found: true, foundAtSec: 5, generation: 1 });
    expect(e.type).toMatch(/ · /);
    bus.emit('inspect:open', { target: { kind: 'organism', organismId: 100 }, at: { x: 0, y: 0 } });
    expect(found).toEqual([f.name]);                         // announced once

    // later: the whole population is gone → filed as extinct after the grace period, still found
    bus.emit('sim:snapshot', snapshot(9, new Float32Array(0)));
    expect(reg.bestiary().get(f.name)!.extinct).toBe(false);
    bus.emit('sim:snapshot', snapshot(11, new Float32Array(0)));
    expect(reg.bestiary().get(f.name)!).toMatchObject({ extinct: true, found: true, alive: 0 });
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
