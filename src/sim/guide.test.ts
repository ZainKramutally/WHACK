import { describe, expect, it } from 'vitest';
import type { AnimalGenome, BodyGenes } from './genome';
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
    expect(nameForm(mk(genome({ limbPairs: 0.7, limbLen: 0.8, size: 0.5 }, 0.05, 0.9)))).toBe('Glass Strider');
    expect(nameForm(mk(genome({ buoy: 0.9, glow: 0.8 })))).toBe('Lantern Drifter');
  });

  it('functional type combines role and locomotion', () => {
    const cen = clusterForms([{ id: 1, genome: siStrider }])[0].centroid;
    expect(functionalType(cen)).toEqual({ role: 'hunter', locomotion: 'strider', label: 'hunter · strider' });
  });
});
