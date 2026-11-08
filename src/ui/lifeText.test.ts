import { describe, expect, it } from 'vitest';
import { LOCOMOTION, develop, type DevelopInputs } from '../sim/develop';
import { makeFounders } from '../sim/genome';
import type { BodyPlan } from '../sim/develop';
import type { OrganismRecord } from '../sim/organismLayout';
import { biomassWords, dominantRows, geneRows, lengthWords, livingRange, livingRangeText, minOxygen, movesWords, organismRows, organismTags, planRows, producerRows, roleWords } from './lifeText';
import { bitmapPath, habitatOf } from './cardIcons';
import { maxBodySize } from '../sim/population';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';

function plan(over: Partial<BodyPlan> = {}): BodyPlan {
  return {
    scale: 0.4, mass: 1, bodyDensity: 1, chemistry: 'carbon', architecture: 'axial', symmetry: 2, segmentCount: 6,
    tiers: 0, hubRadius: 0, tierHeight: 0, tierRadii: [], arms: [], sides: 12, flatShaded: false, profile: 'smooth',
    bodyJointMaxDeg: 40, jointSnapDeg: 0, curl: 0.3, legPairs: 2, limbKind: 'tentacle', limbLength: 0.2, limbSegments: 2,
    limbJointAngles: [0, 0], plateCover: 0.4, hornCount: 2, hornLength: 0.05, gapeSize: 0.1, dorsal: 'rods', eyeKind: 'rings',
    eyeCount: 2, eyeArea: 1, eyeUpkeep: 0.1, glow: 0, defence: 0.2, diet: 0.1, plantGain: 0.8, meatGain: 0.01,
    mode: LOCOMOTION.walk, modeCosts: { walk: 1, swim: 2, hover: 3, sessile: 4 },
    hornKind: 'pair', girth: 0.8, flatten: 1, headScale: 1, gradient: 0, carapace: 0, crest: 0, jaw: 0, tailKind: 'taper', tailSegments: 2,
    finSpan: 0, wingSpan: 0, flare: 0, armKind: 'none', tileLength: 0, shellCover: 0, hue: 0.5, accent: 0.5, bands: 0, spots: 0, ...over,
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
      eyeKind: 'dots', eyeCount: 12, glow: 0.7, limbKind: 'rod', legPairs: 3, hornCount: 1, hornKind: 'spire', armKind: 'rod', flare: 0,
    }));
    expect(get(r, 'Body')).toBe('Radial crystal: 6-fold symmetry, 3 facet tiers, straight-sided, no head or tail');
    expect(get(r, 'Plates')).toMatch(/^Silicon-nitride ceramic tiles/);
    expect(get(r, 'Eyes')).toBe('2 dot eyes at each arm tip');
    expect(get(r, 'Arms')).toBe('6 straight rod arms');
    expect(get(r, 'Legs')).toBeUndefined();
    expect(get(r, 'Horns')).toBe('1 crystal spire');
    expect(get(r, 'Glow')).toMatch(/^Bright.*speculative/);
  });
  it('names the new forms: branching arms, tapered hubs, jointed legs, tails, fins and wings', () => {
    const si = planRows(plan({ architecture: 'radial', chemistry: 'silicon', symmetry: 8, tiers: 2, armKind: 'branch', flare: -0.6, hornCount: 3, hornKind: 'spire', eyeKind: 'dots', eyeCount: 8 }));
    expect(get(si, 'Body')).toContain('8-fold');
    expect(get(si, 'Body')).toContain('tapered');
    expect(get(si, 'Arms')).toBe('8 branching arms');
    const c = planRows(plan({ limbKind: 'leg', tailKind: 'fluke', finSpan: 0.6, wingSpan: 0, hornKind: 'antler', hornCount: 5 }));
    expect(get(c, 'Legs')).toBe('2 pairs of jointed legs');
    expect(get(c, 'Tail')).toBe('Flat fluke');
    expect(get(c, 'Fins')).toBeDefined();
    expect(get(c, 'Wings')).toBeUndefined();
    expect(get(c, 'Horns')).toBe('5 antler tines');
  });
  it('says None for a bare worm', () => {
    const r = planRows(plan({ legPairs: 0, plateCover: 0, hornCount: 0, eyeKind: 'none', eyeCount: 0, segmentCount: 1 }));
    expect(get(r, 'Body')).toBe('1 segment, curling');
    expect([get(r, 'Legs'), get(r, 'Plates'), get(r, 'Horns'), get(r, 'Eyes')]).toEqual(['None', 'None', 'None', 'None']);
  });
  it('matches develop() output for a real founder', () => {
    const water: DevelopInputs = { solvent: { rho: 1, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] }, airDensity: 0.1, tissueDensity: { C: 1.05, Si: 2.2 }, gravity: 1 };
    const g = makeFounders(1, 1, { c: 0.8, si: 0, o: 0.2 })[0]!;
    const rows = planRows(develop(g, { light: 1, heatBand: 0.5 }, water));
    expect(get(rows, 'Body')).toMatch(/^\d+ segments?, /);
    expect(get(rows, 'Legs')).toBeDefined();
  });
});

describe('words', () => {
  it('maps locomotion modes', () => {
    expect([0, 1, 2, 3].map((m) => movesWords(m as 0))).toEqual(['Walks on the ground', 'Swims', 'Floats and hovers in the air', 'Stays rooted in one place']);
    expect(movesWords(1, true)).toMatch(/Rows through the liquid/);
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
  const ct = carbon.life.rules.chemTrait;
  if (ct.kind !== 'oxygenNeed') throw new Error('carbon must use the oxygen trait');
  const ctx = { chemistry: 'carbon' as const, chemTrait: ct, form: { name: 'Soft Walker', recognised: true }, alive: true };
  it('lists form, living conditions, length, generation: no visible-body rows, no role or moves', () => {
    const r = organismRows(rec(), plan(), ctx);
    expect(r.map(([k]) => k)).toEqual(['Form', 'Lives at', 'Needs', 'Length', 'Generation', 'Energy']);
    expect(get(r, 'Form')).toBe('Soft Walker');
    expect(get(r, 'Lives at')).toBe('8.9 – 23.7 °C');
    expect(get(r, 'Needs')).toMatch(/^≥ [\d.]+% oxygen \(64% of its energy from oxygen\)$/);
    expect(get(r, 'Length')).toBe('40 cm');
    expect(get(r, 'Generation')).toBe('11');
    expect(get(r, 'Energy')).toBe('94% of the way to copying');
  });
  it('silicon: no oxygen row; warm edge stretched by cold stability; drops energy when dead', () => {
    const si = silicon.life.rules.chemTrait;
    const r = organismRows(rec({ chem: 0.5, prefTemp: -183, tolerance: 4, energy: 1 }), plan({ diet: 0.9, mode: LOCOMOTION.hover }), { chemistry: 'silicon', chemTrait: si, form: { name: 'Glass Strider', recognised: false }, alive: false });
    expect(get(r, 'Form')).toBe('Glass Strider (not yet a common form)');
    expect(get(r, 'Needs')).toBeUndefined();
    expect(get(r, 'Energy')).toBeUndefined();
    const [lo, hi] = livingRange(-183, 4, 0.5, si);
    expect(lo).toBe(-187);
    expect(hi).toBeCloseTo(-183 + 4 / (1 - (si.kind === 'coldStability' ? si.warmRelief : 0) * 0.5), 9);
    expect(hi).toBeGreaterThan(-179);
    expect(get(r, 'Lives at')).toBe(livingRangeText(lo, hi));
  });
  it('without a body plan it still gives conditions and generation', () => {
    const r = organismRows(rec({ mode: 1 }), undefined, { ...ctx, form: undefined });
    expect(r.map(([k]) => k)).toEqual(['Lives at', 'Needs', 'Generation', 'Energy']);
    expect(geneRows(rec().body)).toHaveLength(1);
  });
});

describe('livingRange and minOxygen', () => {
  it('formats the carbon range as preferred ± tolerance', () => {
    expect(livingRange(14.5, 6.9, 0.5, carbon.life.rules.chemTrait)).toEqual([7.6, 21.4].map((v) => expect.closeTo(v, 9)));
    expect(livingRangeText(7.6, 21.4)).toBe('7.6 – 21.4 °C');
    expect(livingRangeText(-190, -170)).toBe('−190 – −170 °C');
  });
  const ct = { kind: 'oxygenNeed' as const, halfSaturation: 8, aerobicBonus: 1, baseMaxSize: 0.5, maxSizePerPercent: 0.1, huntPenalty: 1 };
  it('is the larger of the aerobic break-even and the size-cap threshold, from config', () => {
    expect(minOxygen(0.5, 0.2, 0, ct)).toBe(8);          // break-even halfSaturation / aerobicBonus beats a small body's cap
    expect(minOxygen(0.5, 2, 0, ct)).toBeCloseTo(15, 9);   // (2 − 0.5) / 0.1
    expect(minOxygen(0.5, 2, 1, ct)).toBeCloseTo(35, 9);   // hunters: (2·2 − 0.5) / 0.1
    expect(minOxygen(0, 0.2, 0, ct)).toBe(0);            // no aerobic share, tiny body
    expect(minOxygen(0.5, 0.2, 0, { ...ct, halfSaturation: 2 })).toBe(2);
    // consistent with the sim's cap: at the threshold, size equals maxBodySize
    const o2 = minOxygen(0, 2, 1, ct)!;
    expect(maxBodySize(ct, o2, 1)).toBeCloseTo(2, 9);
  });
  it('hunters also need the oxygen where aerobic scope reaches 1 (ledger aerobicRef)', () => {
    const led = { aerobicRef: 21, aerobicHunt: 1 };
    expect(minOxygen(0.5, 0.2, 0.9, ct, led)).toBe(21);
    expect(minOxygen(0.5, 0.2, 0.1, ct, led)).toBe(8);           // grazer: unaffected
    expect(minOxygen(0.5, 0.2, 0.9, ct, { aerobicRef: 21, aerobicHunt: 0 })).toBe(8);
    expect(minOxygen(0.5, 0.2, 0.9, ct, { aerobicRef: 0, aerobicHunt: 1 })).toBe(8);   // silicon-style: off
  });
  it('reads the real world configs: carbon has a threshold, silicon none', () => {
    expect(minOxygen(0.5, 0.2, 0, carbon.life.rules.chemTrait)).toBeGreaterThan(0);
    expect(minOxygen(0.5, 0.2, 0, silicon.life.rules.chemTrait)).toBeNull();
  });
});

describe('organismTags and icons', () => {
  it('maps diet to role and locomotion to habitat', () => {
    expect(organismTags(rec(), plan({ diet: 0.05, mode: LOCOMOTION.walk }))).toEqual({ role: 'grazer', habitat: 'land' });
    expect(organismTags(rec(), plan({ diet: 0.95, mode: LOCOMOTION.swim }))).toEqual({ role: 'hunter', habitat: 'sea' });
    expect(organismTags(rec(), plan({ diet: 0.5, mode: LOCOMOTION.hover })).habitat).toBe('air');
    expect(habitatOf(LOCOMOTION.sessile, 0.9)).toBe('sea');
    expect(habitatOf(LOCOMOTION.sessile, 0.1)).toBe('land');
  });
  it('turns a bitmap into rect-run path data', () => {
    expect(bitmapPath(['.##.#', '#....'])).toBe('M1 0h2v1h-2zM4 0h1v1h-1zM0 1h1v1h-1z');
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
