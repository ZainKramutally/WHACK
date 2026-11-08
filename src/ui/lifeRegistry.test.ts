import { describe, expect, it } from 'vitest';
import { createBus } from '../bus';
import { makeFounders, type AnimalGenome } from '../sim/genome';
import { ORGANISM_STRIDE, packOrganism, type OrganismRecord } from '../sim/organismLayout';
import { PLAN_FIELDS, PLAN_LENGTH, PLAN_VERSION } from '../sim/plan';
import { LOCOMOTION, type LocomotionMode } from '../sim/develop';
import { organismRows } from './lifeText';
import { assignSpecies, mountLifeRegistry, type Species } from './lifeRegistry';
import { genomeCentroid } from '../sim/guide';
import type { SimSnapshot } from '../worlds/types';

function buffer(genomes: AnimalGenome[], producers = 0, modes: LocomotionMode[] = []): Float32Array {
  const buf = new Float32Array((genomes.length + producers) * ORGANISM_STRIDE);
  const rec = (g: AnimalGenome, i: number, role: number): OrganismRecord => ({
    x: 0.5, y: 0.5, role, size: 0.2, prefTemp: g.climate.prefTemp, tolerance: g.climate.tolerance, chem: g.climate.chem, energy: 0.5,
    id: 100 + i, generation: 1, heading: 0, mode: modes[i] ?? 0, body: g.body, comp: g.comp, lineage: g.lineage,
  });
  genomes.forEach((g, i) => packOrganism(buf, i, rec(g, i, 1)));
  for (let k = 0; k < producers; k++) packOrganism(buf, genomes.length + k, rec(genomes[0]!, 1000 + k, 0));
  return buf;
}

const founders = makeFounders(3, 24, { c: 0.8, si: 0, o: 0.2 });
// One tight cluster (founders carry standing variation wider than one form radius, so pin them to a single body plan, with tiny jitter).
const worms = founders.map((g, i) => ({ ...g, body: { ...founders[0]!.body, size: founders[0]!.body.size + 0.002 * (i % 5) } }));
// A second body plan far from the worms in gene space (well beyond FORM_RADIUS).
const far = worms.map((g) => ({ ...g, body: { ...g.body, size: 0.95, plates: 0.95, horns: 0.95, limbPairs: 0.9, limbLen: 0.9, eyes: 0.95 } }));
const speciesOf = (binId: number, name: string, g: AnimalGenome): Species => ({ binId, name, centroid: genomeCentroid(g) });
const newForm = (binId: number, name: string, organismId: number) => ({ binId, name, organismId });
const snap = (t: number, buf: Float32Array, births: SimSnapshot['births'] = []) => ({ timeSec: t, organisms: buf, births } as SimSnapshot);
const click = (bus: ReturnType<typeof createBus>, id: number) => bus.emit('inspect:open', { target: { kind: 'organism', organismId: id }, at: { x: 0, y: 0 } });

describe('assignSpecies and architecture', () => {
  const siWalker = (g: AnimalGenome, axial: boolean): AnimalGenome => ({ ...g, comp: { c: 0.05, si: 0.9, o: 0.05 }, body: { ...g.body, segments: axial ? 0.6 : 0.5, limbPairs: 0.3 } });
  it('an armoured biped does not take a radial tripod species name, and vice versa', () => {
    const tripodG = siWalker(worms[0]!, false), bipedG = siWalker(worms[0]!, true);
    const sp: Species[] = [
      { ...speciesOf(1, 'Zhek Tripod', tripodG), mode: LOCOMOTION.walk, axial: false },
      { ...speciesOf(2, 'Qox Bastion', bipedG), mode: LOCOMOTION.walk, axial: true },
    ];
    const a = assignSpecies(buffer([tripodG, bipedG]), sp);   // both walk (mode 0 in the helper)
    expect(a.nameOf.get(100)).toBe('Zhek Tripod');
    expect(a.nameOf.get(101)).toBe('Qox Bastion');
    const only = assignSpecies(buffer([bipedG]), [sp[0]!]);
    expect(only.nameOf.size).toBe(0);   // the only species is radial: the biped stays unnamed
  });
});

describe('assignSpecies and locomotion', () => {
  it('an animal never takes the name of a species that moves another way (a hoverer is not a "swimmer")', () => {
    const swimmers = speciesOf(1, 'Short Mote Swimmer', worms[0]!);
    const sp: Species[] = [{ ...swimmers, mode: LOCOMOTION.swim }];
    const modes = worms.slice(0, 6).map((_, i) => (i < 3 ? LOCOMOTION.swim : LOCOMOTION.hover));
    const a = assignSpecies(buffer(worms.slice(0, 6), 0, modes), sp);
    expect([...a.nameOf.keys()].sort()).toEqual([100, 101, 102]);   // the three swimmers only
    expect(a.forms.get('Short Mote Swimmer')!.alive).toBe(3);
  });
  it('a hoverer takes the nearest species that also hovers', () => {
    const sp: Species[] = [{ ...speciesOf(1, 'Short Mote Swimmer', worms[0]!), mode: LOCOMOTION.swim }, { ...speciesOf(2, 'Mote Drifter', worms[0]!), mode: LOCOMOTION.hover }];
    const a = assignSpecies(buffer(worms.slice(0, 2), 0, [LOCOMOTION.hover, LOCOMOTION.swim]), sp);
    expect(a.nameOf.get(100)).toBe('Mote Drifter');
    expect(a.nameOf.get(101)).toBe('Short Mote Swimmer');
  });
});

describe('assignSpecies', () => {
  it('with no announced species nothing is named, even for a big tight cluster', () => {
    const a = assignSpecies(buffer(worms, 5), []);
    expect(a.nameOf.size).toBe(0);
    expect(a.forms.size).toBe(0);
    expect(a.dominant).toBeNull();
  });
  it('maps each animal to its nearest announced species; producers are ignored', () => {
    const buf = buffer([...worms.slice(0, 10), ...far.slice(0, 6)], 5);
    const a = assignSpecies(buf, [speciesOf(2, 'Far Thing', far[0]!), speciesOf(1, 'Worm Thing', worms[0]!)]);
    expect(a.forms.get('Worm Thing')!.alive).toBe(10);
    expect(a.forms.get('Far Thing')!.alive).toBe(6);
    expect(a.nameOf.size).toBe(16);
    expect(a.nameOf.get(100)).toBe('Worm Thing');
    expect(a.nameOf.get(110)).toBe('Far Thing');
    expect(a.dominant!.name).toBe('Worm Thing');
    expect(a.dominant!.type.label).toMatch(/ · /);
  });
  it('leaves animals beyond the form radius unmapped', () => {
    const a = assignSpecies(buffer([...worms.slice(0, 4), ...far.slice(0, 3)]), [speciesOf(1, 'Worm Thing', worms[0]!)]);
    expect(a.nameOf.size).toBe(4);
    expect(a.nameOf.has(104)).toBe(false);
  });
  it('types a species by its members real locomotion mode, not its genes', () => {
    const walkers = worms.slice(0, 12).map((g) => ({ ...g, body: { ...g.body, buoy: 0.9, limbPairs: 0.5, limbLen: 0.3 } }));
    const sp = [speciesOf(1, 'Sim Name', walkers[0]!)];
    expect(assignSpecies(buffer(walkers), sp).forms.get('Sim Name')!.type.locomotion).toBe('floater'); // genes alone
    expect(assignSpecies(buffer(walkers), sp, () => LOCOMOTION.walk).forms.get('Sim Name')!.type.locomotion).toBe('walker');
  });
  it('is deterministic', () => {
    const sp = [speciesOf(1, 'Worm Thing', worms[0]!)];
    expect([...assignSpecies(buffer(worms), sp).nameOf]).toEqual([...assignSpecies(buffer(worms), sp).nameOf]);
  });
});

describe('creature card rows', () => {
  it('the card says "Walks on the ground" when the plan mode is walk, whatever the buffer mode says', () => {
    const plan = { mode: LOCOMOTION.walk, diet: 0.1 } as Parameters<typeof organismRows>[1];
    const rows = organismRows(
      { ...({} as Parameters<typeof organismRows>[0]), size: 0.2, prefTemp: 15, tolerance: 5, chem: 0.5, energy: 0.5, generation: 1, mode: LOCOMOTION.swim, body: worms[0]!.body },
      plan, { chemistry: 'carbon', form: { name: 'Soft Walker', recognised: true }, alive: true },
    );
    expect(rows.find(([k]) => k === 'Moves')![1]).toBe('Walks on the ground');
  });
  it('an animal matching no announced species reads "(not yet a recognised species)"', () => {
    const rows = organismRows(
      { ...({} as Parameters<typeof organismRows>[0]), size: 0.2, prefTemp: 15, tolerance: 5, chem: 0.5, energy: 0.5, generation: 1, mode: 0, body: worms[0]!.body },
      undefined, { chemistry: 'carbon', form: { recognised: false }, alive: true },
    );
    expect(rows.find(([k]) => k === 'Form')![1]).toBe('(not yet a recognised species)');
  });
});

describe('mountLifeRegistry: species come from the sim', () => {
  it('a cluster of 4 (or 24) that the sim never announced creates no kind', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const found: string[] = [];
    reg.onDiscover((n) => found.push(n));
    bus.emit('sim:snapshot', snap(5, buffer(worms)));
    bus.emit('sim:snapshot', snap(7, buffer(worms)));
    expect(reg.bestiary().living()).toEqual([]);
    expect(reg.bestiary().counts()).toEqual({ found: 0, total: 0 });
    expect(reg.formOf(100)).toEqual({ recognised: false }); // a live animal, but no announced species
    expect(reg.dominant()).toBeNull();
    click(bus, 100);
    expect(found).toEqual([]);
    expect(reg.bestiary().counts().total).toBe(0);
    reg.dispose();
  });

  it("an announced species appears locked with the sim's name, and live animals map to it", () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    bus.emit('sim:snapshot', snap(4, buffer(worms)));
    bus.emit('guide:newForm', newForm(1, 'Keen Glass Spoke', 100)); // events arrive before the snapshot that holds the animal
    bus.emit('sim:snapshot', snap(4.05, buffer(worms)));
    const living = reg.bestiary().living();
    expect(living.map((e) => e.name)).toEqual(['Keen Glass Spoke']);
    expect(living[0]).toMatchObject({ found: false, alive: 24 });
    expect(reg.formOf(105)).toEqual({ name: 'Keen Glass Spoke', recognised: false });
    reg.dispose();
  });

  it('resolves the species from the previous snapshot when the announced animal is already gone', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    bus.emit('sim:snapshot', snap(4, buffer(worms)));
    bus.emit('guide:newForm', newForm(1, 'Soft Walker', 100));
    bus.emit('sim:snapshot', snap(4.05, new Float32Array(0))); // the announced animal is not in the new snapshot
    expect(reg.bestiary().get('Soft Walker')).toBeDefined();
    reg.dispose();
  });

  it('keeps two species apart, counts them separately, and updates the counts', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const both = buffer([...worms.slice(0, 20), ...far.slice(0, 20)]);
    bus.emit('sim:snapshot', snap(4, both));
    bus.emit('guide:newForm', newForm(1, 'Worm One', 100));
    bus.emit('guide:newForm', newForm(2, 'Far Two', 120));
    bus.emit('sim:snapshot', snap(4.05, both));
    const alive = () => Object.fromEntries(reg.bestiary().living().map((e) => [e.name, e.alive]));
    expect(alive()).toEqual({ 'Worm One': 20, 'Far Two': 20 });
    expect(reg.formOf(100)!.name).toBe('Worm One');
    expect(reg.formOf(125)!.name).toBe('Far Two');
    bus.emit('sim:snapshot', snap(6, buffer([...worms.slice(0, 7), ...far.slice(0, 20)])));
    expect(alive()).toEqual({ 'Worm One': 7, 'Far Two': 20 });
    expect(reg.dominant()!.info.name).toBe('Far Two');
    reg.dispose();
  });

  it('a duplicate announcement does not add a second kind', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    bus.emit('sim:snapshot', snap(4, buffer(worms)));
    bus.emit('guide:newForm', newForm(1, 'Soft Walker', 100));
    bus.emit('guide:newForm', newForm(1, 'Soft Walker', 100));
    bus.emit('sim:snapshot', snap(4.05, buffer(worms)));
    expect(reg.bestiary().counts().total).toBe(1);
    reg.dispose();
  });

  it('finds a species when one of its animals is clicked, and files it extinct when all are gone', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const found: string[] = [];
    reg.onDiscover((n) => found.push(n));
    bus.emit('sim:snapshot', snap(4, buffer(worms)));
    bus.emit('guide:newForm', newForm(1, 'Soft Walker', 100));
    bus.emit('sim:snapshot', snap(5, buffer(worms)));
    expect(reg.formOf(100)).toEqual({ name: 'Soft Walker', recognised: false });

    click(bus, 100);
    expect(reg.formOf(100)!.recognised).toBe(true);
    expect(found).toEqual(['Soft Walker']);
    expect(reg.bestiary().get('Soft Walker')!).toMatchObject({ found: true, foundAtSec: 5, generation: 1 });
    expect(reg.bestiary().get('Soft Walker')!.type).toMatch(/ · /);
    click(bus, 100);
    expect(found).toEqual(['Soft Walker']); // announced once

    bus.emit('sim:snapshot', snap(9, new Float32Array(0)));
    expect(reg.bestiary().get('Soft Walker')!.extinct).toBe(false);
    bus.emit('sim:snapshot', snap(11, new Float32Array(0)));
    expect(reg.bestiary().get('Soft Walker')!).toMatchObject({ extinct: true, found: true, alive: 0 });
    expect(reg.dominant()).toBeNull();
    reg.dispose();
  });

  it("types the species from the announced animal's plan mode", () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const walkers = worms.slice(0, 12).map((g) => ({ ...g, body: { ...g.body, buoy: 0.9, limbPairs: 0.5, limbLen: 0.3 } }));
    const plan = new Float32Array(PLAN_LENGTH);
    plan[0] = PLAN_VERSION;
    plan[1 + PLAN_FIELDS.indexOf('mode')] = LOCOMOTION.walk;
    plan[1 + PLAN_FIELDS.indexOf('segmentCount')] = 4;
    plan[1 + PLAN_FIELDS.indexOf('sides')] = 12;
    bus.emit('guide:newForm', newForm(1, 'Sim Walker', 100));
    bus.emit('sim:snapshot', snap(3, buffer(walkers), walkers.map((_, i) => ({ id: 100 + i, plan }))));
    expect(reg.bestiary().get('Sim Walker')!.type).toMatch(/walker$/);
    reg.dispose();
  });

  it("the tile's plan is the announced organism's own plan, and waits if it hasn't arrived", () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const mk = (m: number) => { const p = new Float32Array(PLAN_LENGTH); p[0] = PLAN_VERSION; p[1 + PLAN_FIELDS.indexOf('mode')] = m; return p; };
    bus.emit('guide:newForm', newForm(1, 'Late One', 103));
    bus.emit('sim:snapshot', snap(3, buffer(worms), [{ id: 100, plan: mk(LOCOMOTION.swim) }]));   // another animal's plan: must not be used
    expect(reg.bestiary().get('Late One')!.plan).toBeUndefined();
    bus.emit('sim:snapshot', snap(4.5, buffer(worms), [{ id: 103, plan: mk(LOCOMOTION.walk) }]));
    const tile = reg.bestiary().get('Late One')!.plan;
    expect(tile).toBe(reg.planOf(103));
    expect(tile!.mode).toBe(LOCOMOTION.walk);
    reg.dispose();
  });

  it('keeps unpacked body plans from births and survives a bad plan', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    const bad = new Float32Array(PLAN_LENGTH); // version 0: unknown
    bus.emit('sim:snapshot', snap(1, new Float32Array(0), [{ id: 5, plan: bad }]));
    expect(reg.planOf(5)).toBeUndefined();
    const ok = new Float32Array(PLAN_LENGTH);
    ok[0] = PLAN_VERSION;
    bus.emit('sim:snapshot', snap(2, new Float32Array(0), [{ id: 6, plan: ok }]));
    expect(reg.planOf(6)).toBeDefined();
    reg.dispose();
  });

  it('notifies subscribers when the analysis refreshes', () => {
    const bus = createBus();
    const reg = mountLifeRegistry(bus);
    let n = 0;
    const off = reg.onChange(() => n++);
    bus.emit('sim:snapshot', snap(0, new Float32Array(0)));
    bus.emit('sim:snapshot', snap(0.5, new Float32Array(0))); // less than a second later: no re-analysis
    bus.emit('sim:snapshot', snap(1.2, new Float32Array(0)));
    expect(n).toBe(2);
    off();
    reg.dispose();
  });
});
