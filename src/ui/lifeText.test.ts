import { describe, expect, it } from 'vitest';
import { LOCOMOTION, develop, type DevelopInputs } from '../sim/develop';
import { makeFounders } from '../sim/genome';
import type { BodyPlan } from '../sim/develop';
import type { OrganismRecord } from '../sim/organismLayout';
import { biomassWords, dominantRows, geneRows, lengthWords, movesWords, organismRows, planRows, producerRows, roleWords } from './lifeText';

function plan(over: Partial<BodyPlan> = {}): BodyPlan {
  return {
    scale: 0.4, mass: 1, bodyDensity: 1, chemistry: 'carbon', architecture: 'axial', symmetry: 2, segmentCount: 6,
    tiers: 0, hubRadius: 0, tierHeight: 0, tierRadii: [], arms: [], sides: 12, flatShaded: false, profile: 'smooth',
    bodyJointMaxDeg: 40, jointSnapDeg: 0, curl: 0.3, legPairs: 2, limbKind: 'tentacle', limbLength: 0.2, limbSegments: 2,
    limbJointAngles: [0, 0], plateCover: 0.4, hornCount: 2, hornLength: 0.05, gapeSize: 0.1, dorsal: 'rods', eyeKind: 'rings',
    eyeCount: 2, eyeArea: 1, eyeUpkeep: 0.1, glow: 0, defence: 0.2, diet: 0.1, plantGain: 0.8, meatGain: 0.01,
    mode: LOCOMOTION.walk, modeCosts: { walk: 1, swim: 2, hover: 3, sessile: 4 }, ...over,
  };
}
const rec = (over: Partial<OrganismRecord> = {}): OrganismRecord => ({
  x: 0.5, y: 0.5, role: 1, size: 0.2, prefTemp: 16.3, tolerance: 7.4, chem: 0.64, energy: 0.94, id: 7, generation: 11,
  heading: 0, mode: 0,
  body: { size: 0.2, segments: 0.4, limbPairs: 0.5, limbLen: 0.3, plates: 0.4, horns: 0.2, gape: 0.2, diet: 0.1, eyes: 0.3, buoy: 0.1, glow: 0, sociality: 0.3 },
  comp: { c: 0.8, si: 0, o: 0.2 }, lineage: 1, ...over,
});
const get = (rows: [string, string][], k: string) => rows.find(([a]) => a === k)?.[1];

describe('planRows', () => {
  it('describes a carbon walker in plain words', () => {
    const r = planRows(plan());
    expect(get(r, 'Body')).toBe('6 segments, curling');
    expect(get(r, 'Legs')).toBe('2 pairs of tentacles');
    expect(get(r, 'Plates')).toBe('Shell over 40% of the back');
    expect(get(r, 'Horns')).toBe('2 horns');
    expect(get(r, 'Eyes')).toBe('2 ring eyes');
    expect(get(r, 'Glow')).toBeUndefined();
  });
  it('uses silicon words: radial crystal, ceramic tiles, arm-tip dot eyes, speculative glow', () => {
    const r = planRows(plan({
      chemistry: 'silicon', architecture: 'radial', symmetry: 6, segmentCount: 0, tiers: 3, sides: 6, flatShaded: true, curl: 0,
      eyeKind: 'dots', eyeCount: 12, glow: 0.7, limbKind: 'rod', legPairs: 3, hornCount: 1,
    }));
    expect(get(r, 'Body')).toBe('Radial crystal: 6-fold symmetry, 3 facet tiers, no head or tail');
    expect(get(r, 'Plates')).toMatch(/^Silicon-nitride ceramic tiles/);
    expect(get(r, 'Eyes')).toBe('2 dot eyes at each arm tip');
    expect(get(r, 'Arms')).toBe('6 straight rod arms');
    expect(get(r, 'Legs')).toBeUndefined();
    expect(get(r, 'Horns')).toBe('1 crystal spire');
    expect(get(r, 'Glow')).toMatch(/^Bright.*speculative/);
  });
  it('says None for a bare worm', () => {
    const r = planRows(plan({ legPairs: 0, plateCover: 0, hornCount: 0, eyeKind: 'none', eyeCount: 0, segmentCount: 1 }));
    expect(get(r, 'Body')).toBe('1 segment, curling');
    expect([get(r, 'Legs'), get(r, 'Plates'), get(r, 'Horns'), get(r, 'Eyes')]).toEqual(['None', 'None', 'None', 'None']);
  });
  it('matches develop() output for a real founder', () => {
    const water: DevelopInputs = { solvent: { rho: 1, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] }, airDensity: 0.1, tissueDensity: { C: 1.05, Si: 2.2 } };
    const g = makeFounders(1, 1, { c: 0.8, si: 0, o: 0.2 })[0]!;
    const rows = planRows(develop(g, { light: 1, heatBand: 0.5 }, water));
    expect(get(rows, 'Body')).toMatch(/^\d+ segments?, /);
    expect(get(rows, 'Legs')).toBeDefined();
  });
});

describe('words', () => {
  it('maps locomotion modes', () => {
    expect([0, 1, 2, 3].map((m) => movesWords(m as 0))).toEqual(['Walks on the ground', 'Swims', 'Floats and hovers in the air', 'Stays rooted in one place']);
  });
  it('maps roles', () => {
    expect(roleWords('grazer')).toMatch(/plants/);
    expect(roleWords('hunter')).toMatch(/other animals/);
  });
  it('formats lengths and biomass', () => {
    expect(lengthWords(0.4)).toBe('40 cm');
    expect(lengthWords(2.34)).toBe('2.3 m');
    expect(lengthWords(0.001)).toBe('1 cm');
    expect([0, 0.1, 0.3, 0.5, 0.9].map(biomassWords)).toEqual(['Almost none', 'Sparse', 'Thin', 'Thick', 'Dense']);
  });
});

describe('organismRows', () => {
  const ctx = { chemistry: 'carbon' as const, form: { name: 'Soft Walker', recognised: true }, alive: true };
  it('puts form, role and moves first, then body, climate and generation', () => {
    const r = organismRows(rec(), plan(), ctx);
    expect(r.slice(0, 3)).toEqual([['Form', 'Soft Walker'], ['Role', 'Grazer (eats plants)'], ['Moves', 'Walks on the ground']]);
    expect(get(r, 'Oxygen need')).toBe('64%');
    expect(get(r, 'Preferred temperature')).toBe('16.3 °C ± 7.4 °C');
    expect(get(r, 'Generation')).toBe('11');
    expect(get(r, 'Energy')).toBe('94% of the way to copying');
  });
  it('labels silicon cold stability, unrecognised forms, and drops energy when dead', () => {
    const r = organismRows(rec({ chem: 0.33, energy: 1 }), plan({ diet: 0.9, mode: LOCOMOTION.hover }), { chemistry: 'silicon', form: { name: 'Glass Strider', recognised: false }, alive: false });
    expect(get(r, 'Cold stability')).toBe('33%');
    expect(get(r, 'Form')).toBe('Glass Strider (not yet a common form)');
    expect(get(r, 'Role')).toMatch(/^Hunter/);
    expect(get(r, 'Moves')).toBe('Floats and hovers in the air');
    expect(get(r, 'Energy')).toBeUndefined();
  });
  it('falls back to genes when the body plan was not captured', () => {
    const r = organismRows(rec({ mode: 1 }), undefined, { ...ctx, form: undefined });
    expect(get(r, 'Form')).toBeUndefined();
    expect(get(r, 'Body')).toMatch(/not captured/);
    expect(get(r, 'Moves')).toBe('Swims');
    expect(geneRows(rec().body)).toHaveLength(1);
  });
});

describe('producerRows and dominantRows', () => {
  it('describes a plant cell', () => {
    const form = { key: 'k', chemistry: 'carbon', species: 'cup', curl: 0.3, branchDeg: 0, facets: false, branches: 0, heightScale: 1.4, capScale: 0.1, glow: 0.7, translucent: false } as const;
    const r = producerRows(0.5, 0.05, form);
    expect(r).toEqual([['Form', 'Lantern cup'], ['Ground cover', 'Thick'], ['Taller growth', 'Sparse'], ['Height', 'Tall (cold favours size)'], ['Glow', 'Glows in the dim light']]);
    expect(producerRows(0.5, 0, null).map(([k]) => k)).toEqual(['Ground cover', 'Taller growth']);
  });
  it('summarises the dominant form', () => {
    const r = dominantRows({ name: 'Mote Walker', alive: 300, type: { role: 'grazer', locomotion: 'walker', label: 'grazer · walker' } }, plan());
    expect(r.slice(0, 4)).toEqual([['Form', 'Mote Walker'], ['Alive now', '300'], ['Type', 'grazer · walker'], ['Moves', 'Walks on the ground']]);
    expect(dominantRows({ name: 'X', alive: 1, type: { role: 'hunter', locomotion: 'swimmer', label: 'hunter · swimmer' } }, undefined)).toHaveLength(3);
  });
});
