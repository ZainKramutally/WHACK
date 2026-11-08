import { describe, expect, it } from 'vitest';
import type { AnimalGenome, BodyGenes } from './genome';
import { LOCOMOTION, type LocomotionMode } from './develop';
import { FormTracker, clusterForms, functionalType, nameForm, type GuideAnimal } from './guide';

const flat: BodyGenes = {
  size: 0.5, segments: 0.3, limbPairs: 0, limbLen: 0.3, plates: 0, horns: 0,
  gape: 0.3, diet: 0.2, eyes: 0.3, buoy: 0.1, glow: 0, sociality: 0.5,
};
const genome = (body: Partial<BodyGenes>, c = 0.8, si = 0.1): AnimalGenome => ({
  body: { ...flat, ...body },
  climate: { prefTemp: 15, tolerance: 8, chem: 0.5 },
  comp: { c, si, o: 1 - c - si },
  lineage: 1,
});
const group = (startId: number, n: number, g: AnimalGenome, jitter = 0.01): GuideAnimal[] =>
  Array.from({ length: n }, (_, i) => ({
    id: startId + i,
    genome: { ...g, body: { ...g.body, size: g.body.size + (i % 3) * jitter } },
  }));

const carbonWorm = genome({});
const siStrider = genome({ limbPairs: 0.7, limbLen: 0.8, plates: 0.8, diet: 0.8, size: 0.2 }, 0.05, 0.9);

describe('clusterForms', () => {
  it('splits two well-separated groups into 2 clusters', () => {
    const cl = clusterForms([...group(1, 5, carbonWorm), ...group(100, 6, siStrider)]);
    expect(cl.map((c) => c.members.length).sort()).toEqual([5, 6]);
  });

  it('is order-independent with stable keys', () => {
    const a = [...group(1, 5, carbonWorm), ...group(100, 6, siStrider)];
    const shuffled = [...a].sort((x, y) => ((x.id * 7919) % 13) - ((y.id * 7919) % 13));
    expect(clusterForms(shuffled)).toEqual(clusterForms(a));
    expect(clusterForms(a).map((c) => c.key)).toEqual([1, 100]);
  });

  it('handles empty input', () => {
    expect(clusterForms([])).toEqual([]);
  });
});

describe('FormTracker discovery (owner ruling 2026-11-08)', () => {
  const opts = { minMembers: 20, persistSec: 20, distinctNames: true };
  it('announces a cluster only after it has held 20 members for 20 s', () => {
    const t = new FormTracker(opts);
    const all = group(1, 25, carbonWorm);
    expect(t.update(all.slice(0, 10), 0)).toEqual([]);
    expect(t.update(all, 5)).toEqual([]);
    expect(t.update(all, 24)).toEqual([]);
    expect(t.update(all, 25)).toHaveLength(1);
    expect(t.update(all, 60)).toEqual([]);
  });
  it('restarts the clock when the cluster falls below the size', () => {
    const t = new FormTracker(opts);
    const all = group(1, 25, carbonWorm);
    t.update(all, 0);
    t.update(all.slice(0, 5), 10);
    expect(t.update(all, 25)).toEqual([]);
    expect(t.update(all, 45)).toHaveLength(1);
  });
  it('gives two forms of the same type different names', () => {
    const t = new FormTracker(opts);
    const a = group(1, 25, carbonWorm);
    const b = group(100, 25, genome({ size: 0.5, sociality: 0.1, eyes: 0.9, limbLen: 0.9 }));
    t.update([...a, ...b], 0);
    const out = t.update([...a, ...b], 30);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((f) => f.name)).size).toBe(2);
  });
});

describe('FormTracker', () => {
  it('fires once when a cluster reaches 4, not before, not on re-entry', () => {
    const t = new FormTracker();
    const all = group(1, 6, carbonWorm);
    expect(t.update(all.slice(0, 3))).toEqual([]);
    const fired = t.update(all.slice(0, 4));
    expect(fired).toHaveLength(1);
    expect(fired[0].binId).toBe(1);
    expect(all.slice(0, 4).map((a) => a.id)).toContain(fired[0].organismId);
    expect(fired[0].name).toBe(nameForm(clusterForms(all.slice(0, 4))[0].centroid));
    expect(t.update(all)).toEqual([]);
    expect(t.update(all.slice(0, 2))).toEqual([]); // dips below 4
    expect(t.update(all)).toEqual([]); // returns: no re-fire
  });

  it('follows slow drift without re-firing, but fires a distinct new form', () => {
    const t = new FormTracker();
    expect(t.update(group(1, 5, carbonWorm))).toHaveLength(1);
    const drifted = genome({ size: 0.6, sociality: 0.6 }); // ~0.14 away
    expect(t.update(group(1, 5, drifted))).toEqual([]);
    const next = t.update([...group(1, 5, drifted), ...group(100, 4, siStrider)]);
    expect(next).toHaveLength(1);
    expect(next[0].binId).toBe(2);
    expect(t.count).toBe(2);
  });
});

describe('names', () => {
  it('are deterministic and chemistry-dependent', () => {
    const c = clusterForms(group(1, 4, carbonWorm))[0].centroid;
    const s = clusterForms(group(1, 4, genome({}, 0.05, 0.9)))[0].centroid;
    expect(nameForm(c)).toBe(nameForm(c));
    expect(nameForm(c)).not.toBe(nameForm(s));
    expect(nameForm(c).split(' ')[0]).not.toBe(nameForm(s).split(' ')[0]);
  });

  it('reads locomotion and features from traits', () => {
    const mk = (g: AnimalGenome) => clusterForms([{ id: 1, genome: g }])[0].centroid;
    expect(nameForm(mk(genome({ limbPairs: 0.7, limbLen: 0.8, size: 0.5 }, 0.05, 0.9)))).toBe('Glass Spoke');
    expect(nameForm(mk(genome({ buoy: 0.9, glow: 0.8 })))).toBe('Lantern Drifter');
  });

  it('silicon names use architecture nouns (Spoke, Tripod, Lattice, Roller, Bloom), never carbon\'s', () => {
    const mk = (b: Partial<AnimalGenome['body']>) => clusterForms([{ id: 1, genome: genome(b, 0.05, 0.9) }])[0].centroid;
    const nm = (b: Partial<AnimalGenome['body']>, mode: LocomotionMode) => nameForm(mk(b), { mode });
    expect(nm({ limbPairs: 0.7, limbLen: 0.8 }, LOCOMOTION.walk)).toMatch(/Spoke$/);
    expect(nm({ limbPairs: 0.7, limbLen: 0.2 }, LOCOMOTION.walk)).toMatch(/Tripod$/);
    expect(nm({}, LOCOMOTION.sessile)).toMatch(/Lattice$/);
    expect(nm({}, LOCOMOTION.swim)).toMatch(/Roller$/);
    expect(nm({}, LOCOMOTION.hover)).toMatch(/Bloom$/);
    const carbonNames = (['walk', 'swim', 'hover', 'sessile'] as const).map((m) => nameForm(clusterForms(group(1, 4, carbonWorm))[0].centroid, { mode: LOCOMOTION[m] }).split(' ')[1]);
    for (const n of carbonNames) expect(['Spoke', 'Tripod', 'Lattice', 'Roller', 'Bloom']).not.toContain(n);
  });

  it('functional type combines role and locomotion', () => {
    const cen = clusterForms([{ id: 1, genome: siStrider }])[0].centroid;
    expect(functionalType(cen)).toEqual({ role: 'hunter', locomotion: 'strider', label: 'hunter · strider' });
  });
});

describe('real locomotion mode overrides the genes', () => {
  const withMode = (animals: GuideAnimal[], mode: LocomotionMode): GuideAnimal[] => animals.map((a) => ({ ...a, mode }));
  const nameOf = (animals: GuideAnimal[]) => {
    const cl = clusterForms(animals)[0];
    return nameForm(cl.centroid, cl.hint);
  };

  it('never names a cluster of walkers a Swimmer or a Drifter, whatever the genes say', () => {
    // genes that read as floaters (buoy 0.9) and as swimmers (no legs, few segments)
    for (const body of [{ buoy: 0.9 }, { buoy: 0.1, limbPairs: 0, segments: 0.1 }, { buoy: 0.9, glow: 0.8 }]) {
      const name = nameOf(withMode(group(1, 6, genome(body)), LOCOMOTION.walk));
      expect(name).not.toMatch(/Swimmer|Drifter/);
    }
    // with legs they are strider / walker; without, they creep
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.9, limbPairs: 0.7, limbLen: 0.8 })), LOCOMOTION.walk))).toMatch(/Strider$/);
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.9, limbPairs: 0.7, limbLen: 0.2 })), LOCOMOTION.walk))).toMatch(/Walker$/);
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.9 })), LOCOMOTION.walk))).toMatch(/Crawler$/);
  });

  it('names swimmers and hoverers by what they do', () => {
    expect(nameOf(withMode(group(1, 6, genome({ limbPairs: 0.7, limbLen: 0.8 })), LOCOMOTION.swim))).toMatch(/Swimmer$/);
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.1 })), LOCOMOTION.hover))).toMatch(/Drifter$/);
  });

  it('uses the majority mode of the members and breaks ties toward the lower mode', () => {
    const g = genome({ buoy: 0.9 });
    const mixed = group(1, 7, g).map((a, i) => ({ ...a, mode: (i < 4 ? LOCOMOTION.walk : LOCOMOTION.hover) as LocomotionMode }));
    expect(clusterForms(mixed)[0].hint.mode).toBe(LOCOMOTION.walk);
    const tie = group(1, 6, g).map((a, i) => ({ ...a, mode: (i < 3 ? LOCOMOTION.hover : LOCOMOTION.walk) as LocomotionMode }));
    expect(clusterForms(tie)[0].hint.mode).toBe(LOCOMOTION.walk);
  });

  it('classifies by the members\' majority role, not the centroid\'s mean diet', () => {
    const g = genome({});
    const animals = group(1, 6, g).map((a, i) => ({ ...a, genome: { ...a.genome, body: { ...a.genome.body, diet: i < 4 ? 0.1 : 0.9 } } }));
    const cl = clusterForms(animals);
    const biggest = cl.reduce((a, b) => (b.members.length > a.members.length ? b : a));
    expect(functionalType(biggest.centroid, biggest.hint).role).toBe(biggest.hint.role);
  });

  it('keeps genes-only behaviour when no mode is given, and the tracker names with the real mode once', () => {
    const plain = group(1, 5, genome({ buoy: 0.9 }));
    expect(nameOf(plain)).toMatch(/Drifter$/);
    const t = new FormTracker();
    const fired = t.update(withMode(plain, LOCOMOTION.walk));
    expect(fired).toHaveLength(1);
    expect(fired[0].name).toMatch(/Crawler$/);
    expect(t.update(withMode(plain, LOCOMOTION.hover))).toEqual([]); // already announced: the name stays
  });
});
