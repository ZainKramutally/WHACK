import { describe, expect, it } from 'vitest';
import type { AnimalGenome, BodyGenes } from './genome';
import { LOCOMOTION, type LocomotionMode } from './develop';
import { genusWord, FormTracker, clusterForms, functionalType, nameForm, type GuideAnimal } from './guide';

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

describe('names say how a species moves (owner, #75)', () => {
  const centroid = (b: Partial<BodyGenes>, c = 0.8, si = 0.1) => clusterForms(group(1, 5, genome(b, c, si)))[0].centroid;
  const word = (b: Partial<BodyGenes>, mode: LocomotionMode, si = 0.1, amphibious = false) =>
    nameForm(centroid(b, si > 0.5 ? 0.05 : 0.8, si), { mode, amphibious }).split(' ').pop()!;
  const SWIM = ['Darter', 'Drifter', 'Paddler', 'Eel', 'Rower', 'Sculler'];
  const FLY = ['Flier', 'Glider', 'Soarer', 'Flitter', 'Bell', 'Floater'];
  const WALK = ['Strider', 'Crawler', 'Stomper', 'Skitter', 'Tripod', 'Walker', 'Spoke', 'Lattice'];
  const SESSILE = ['Anchor', 'Frond', 'Spire'];
  it('gives each mode a word of that mode', () => {
    for (const b of [{}, { size: 0.1 }, { size: 0.9 }, { segments: 0.9 }, { limbPairs: 0.6, limbLen: 0.9 }, { buoy: 0.9 }]) {
      for (const si of [0.1, 0.9]) {
        expect(SWIM).toContain(word(b, LOCOMOTION.swim, si));
        expect(FLY).toContain(word(b, LOCOMOTION.hover, si));
        expect(WALK).toContain(word(b, LOCOMOTION.walk, si));
        expect(SESSILE).toContain(word(b, LOCOMOTION.sessile, si));
      }
    }
  });
  it('lets two different bodies of one mode get different words', () => {
    expect(new Set([{ segments: 0.9 }, { limbPairs: 0.6 }, { buoy: 0.5 }, {}].map((b) => word(b, LOCOMOTION.swim))).size).toBe(4);
    expect(new Set([{ buoy: 0.9 }, { size: 0.9 }, { size: 0.1 }, { size: 0.4, eyes: 0.9 }].map((b) => word(b, LOCOMOTION.hover))).size).toBe(4);
    expect(new Set([{ limbPairs: 0.6, limbLen: 0.9 }, { limbPairs: 0.6, size: 0.9 }, { limbPairs: 0.6, size: 0.1 }, {}].map((b) => word(b, LOCOMOTION.walk))).size).toBe(4);
    expect(word({}, LOCOMOTION.swim, 0.9)).not.toBe(word({ limbPairs: 0.6 }, LOCOMOTION.swim, 0.9));
  });
  it('calls a lineage that both swims and flies a Diver, and says so from its members modes', () => {
    expect(word({}, LOCOMOTION.swim, 0.1, true)).toBe('Diver');
    const mixed = group(1, 8, carbonWorm).map((a, i) => ({ ...a, mode: i < 4 ? LOCOMOTION.swim : LOCOMOTION.hover }));
    const cl = clusterForms(mixed)[0];
    expect(cl.hint.amphibious).toBe(true);
    expect(nameForm(cl.centroid, cl.hint)).toMatch(/Diver$/);
    expect(clusterForms(group(1, 8, carbonWorm).map((a) => ({ ...a, mode: LOCOMOTION.swim })))[0].hint.amphibious).toBe(false);
  });
  it('varies the first word with the eyes gene within a feature', () => {
    expect(new Set([0, 0.4, 0.9].map((eyes) => nameForm(centroid({ eyes }), { mode: LOCOMOTION.walk }).split(' ')[0])).size).toBe(3);
  });
});

describe('genus words', () => {
  it('are deterministic, pronounceable-looking, and differ across runs, species and chemistries', () => {
    expect(genusWord(5, 1, 'c')).toBe(genusWord(5, 1, 'c'));
    const names = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (let key = 1; key <= 6; key++) names.add(genusWord(seed * 977, key, 'c'));
    expect(names.size).toBeGreaterThan(220);   // 240 draws, almost no repeats
    expect(genusWord(5, 1, 'c')).not.toBe(genusWord(5, 1, 'si'));
    expect(genusWord(5, 1, 'c')).toMatch(/^[A-Z][a-z]+$/);
  });
  it('names tracked forms "<genus> <movement>" when given a seed, never repeating within a run', () => {
    const t = new FormTracker({ minMembers: 4, nameSeed: 99, distinctNames: true });
    const out = t.update([...group(1, 5, carbonWorm), ...group(100, 5, genome({ size: 0.9, sociality: 0.05 }))]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toMatch(/^[A-Z][a-z]+ \w+$/);
    expect(out[0].name).not.toBe(out[1].name);
    const other = new FormTracker({ minMembers: 4, nameSeed: 100, distinctNames: true }).update(group(1, 5, carbonWorm));
    expect(other[0].name.split(' ')[0]).not.toBe(out[0].name.split(' ')[0]);
  });
});

describe('FormTracker pacing', () => {
  it('announces at most one species per gap, queueing the rest', () => {
    const t = new FormTracker({ minMembers: 4, persistSec: 0, distinctNames: true });
    t.configure({ gapSec: 25 });
    const all = [...group(1, 6, carbonWorm), ...group(100, 6, genome({ size: 0.9, sociality: 0.05 }))];
    expect(t.update(all, 0)).toHaveLength(1);
    expect(t.update(all, 10)).toEqual([]);
    expect(t.update(all, 25)).toHaveLength(1);
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
    expect(nameForm(mk(genome({ buoy: 0.9, glow: 0.8 })))).toBe('Lantern Floater');
  });

  it('silicon names use architecture nouns (Spoke, Tripod, Lattice, Rower, Bell, Spire), never carbon\'s', () => {
    const mk = (b: Partial<AnimalGenome['body']>) => clusterForms([{ id: 1, genome: genome(b, 0.05, 0.9) }])[0].centroid;
    const nm = (b: Partial<AnimalGenome['body']>, mode: LocomotionMode) => nameForm(mk(b), { mode });
    expect(nm({ limbPairs: 0.7, limbLen: 0.8 }, LOCOMOTION.walk)).toMatch(/Spoke$/);
    expect(nm({ limbPairs: 0.7, limbLen: 0.2 }, LOCOMOTION.walk)).toMatch(/Tripod$/);
    expect(nm({}, LOCOMOTION.walk)).toMatch(/Lattice$/);
    expect(nm({}, LOCOMOTION.sessile)).toMatch(/Spire$/);
    expect(nm({}, LOCOMOTION.swim)).toMatch(/Rower$/);
    expect(nm({ buoy: 0.9 }, LOCOMOTION.hover)).toMatch(/Bell$/);
    const carbonNames = (['walk', 'swim', 'hover', 'sessile'] as const).map((m) => nameForm(clusterForms(group(1, 4, carbonWorm))[0].centroid, { mode: LOCOMOTION[m] }).split(' ')[1]);
    for (const n of carbonNames) expect(['Spoke', 'Tripod', 'Lattice', 'Rower', 'Bell', 'Spire']).not.toContain(n);
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

  it('never names a cluster of walkers a swimmer or flier word, whatever the genes say', () => {
    // genes that read as floaters (buoy 0.9) and as swimmers (no legs, few segments)
    for (const body of [{ buoy: 0.9 }, { buoy: 0.1, limbPairs: 0, segments: 0.1 }, { buoy: 0.9, glow: 0.8 }]) {
      const name = nameOf(withMode(group(1, 6, genome(body)), LOCOMOTION.walk));
      expect(name).not.toMatch(/Darter|Drifter|Paddler|Eel|Diver|Floater|Flier|Glider|Soarer|Flitter/);
    }
    // with legs they are strider / walker; without, they creep
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.9, limbPairs: 0.7, limbLen: 0.8 })), LOCOMOTION.walk))).toMatch(/Strider$/);
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.9, limbPairs: 0.7, limbLen: 0.2 })), LOCOMOTION.walk))).toMatch(/Stomper$/);   // default size 0.5 reads as big
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.9 })), LOCOMOTION.walk))).toMatch(/Crawler$/);
  });

  it('names swimmers and hoverers by what they do', () => {
    expect(nameOf(withMode(group(1, 6, genome({ limbPairs: 0.7, limbLen: 0.8 })), LOCOMOTION.swim))).toMatch(/Paddler$/);
    expect(nameOf(withMode(group(1, 6, genome({ buoy: 0.1 })), LOCOMOTION.hover))).toMatch(/Glider$/);
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
    expect(nameOf(plain)).toMatch(/Floater$/);
    const t = new FormTracker();
    const fired = t.update(withMode(plain, LOCOMOTION.walk));
    expect(fired).toHaveLength(1);
    expect(fired[0].name).toMatch(/Crawler$/);
    expect(t.update(withMode(plain, LOCOMOTION.hover))).toEqual([]); // already announced: the name stays
  });
});
