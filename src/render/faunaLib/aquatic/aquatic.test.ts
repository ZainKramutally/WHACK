import { describe, expect, it } from 'vitest';
import { develop, type DevelopInputs } from '../../../sim/develop';
import { makeFounders, type AnimalGenome, type BodyGenes } from '../../../sim/genome';
import { buildSwimmer, plesioMarks, type SwimSink } from './build';
import { neckFrac, swimmerParamsFromPlan, tailFrac } from './fromPlan';
import { advance, armAngle, kinematics, STEP_DEG } from './motion';
import { DEFAULT_PARAMS, mergeParams, normaliseParams } from './params';
import type { Path, V3 } from './v3';

// Ported from the mockup's aquatic.test.ts (the parts the app relies on), with plans from the app's own develop().
const water: DevelopInputs = {
  solvent: { rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] }, airDensity: 0.1, tissueDensity: { C: 1.05, Si: 2.2 },
  gravity: 1,
};
const founder = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
const genome = (body: Partial<BodyGenes>, si = false): AnimalGenome => ({
  ...founder, body: { ...founder.body, ...body }, comp: si ? { c: 0.05, si: 0.9, o: 0.05 } : founder.comp,
});
const plan = (body: Partial<BodyGenes>, si = false) => develop(genome(body, si), { light: 1, heatBand: 0.5 }, water);
const line: Path = { length: Infinity, at: (s) => ({ p: [s, 2, 0], t: [1, 0, 0] }) };
const INST = { s0: 0, phase: 0.3, off: [0, 0] as [number, number], k: 0 };
const det = (x: V3, y: V3, z: V3) => x[0] * (y[1] * z[2] - y[2] * z[1]) - x[1] * (y[0] * z[2] - y[2] * z[0]) + x[2] * (y[0] * z[1] - y[1] * z[0]);

function record(sw: ReturnType<typeof buildSwimmer>, t: number) {
  const nums: number[] = [];
  const parts: { type: string; x: V3; y: V3; z: V3 }[] = [];
  let tubes = 0;
  const sink: SwimSink = {
    tube: (_i, c, _U, _R, rw, rh) => { tubes++; nums.push(...c.flat(), ...rw, ...rh); },
    sheet: (_i, a, b) => { nums.push(...a.flat(), ...b.flat()); },
    // the pose reuses its vectors between calls (build.ts): keep copies, as fauna.ts's sink does
    part: (type, o, x, y, z) => { nums.push(...o, ...x, ...y, ...z); parts.push({ type, x: [...x], y: [...y], z: [...z] }); },
  };
  sw.pose(t, line, INST, sink);
  return { nums, parts, tubes };
}

const SWIMMERS = {
  'carbon eel': swimmerParamsFromPlan(plan({ segments: 0.9, limbPairs: 0, size: 0.4, buoy: 0.5 })),
  'carbon plated': swimmerParamsFromPlan(plan({ segments: 0.4, plates: 0.8, limbPairs: 0.5, horns: 0.5, diet: 0.8 })),
  'silicon rower': swimmerParamsFromPlan(plan({ limbPairs: 0.5, limbLen: 0.6, size: 0.4 }, true)),
  'carbon plesiosaur': swimmerParamsFromPlan(plan({ limbPairs: 0.6, limbLen: 0.8, segments: 0.4, size: 0.4 })),
  'carbon long-neck': swimmerParamsFromPlan(plan({ limbPairs: 0.6, limbLen: 0.8, segments: 1, size: 0.4, gape: 0, eyes: 0, diet: 0.1 })),
  'silicon bell': normaliseParams(mergeParams(DEFAULT_PARAMS, { chemistry: 'silicon', plan: 'bell', radial: { chain: 3 } as never })),
};

describe('aquatic swimmers (port)', () => {
  it('app plans map onto the chemistry grammar: carbon axial waves, silicon radial rowers or bells', () => {
    expect(['fusiform', 'ribbon', 'disc', 'segmented']).toContain(SWIMMERS['carbon eel'].plan);
    expect(buildSwimmer(SWIMMERS['carbon eel'], 1).kin.kind).toBe('wave');
    expect(['radial', 'bell']).toContain(SWIMMERS['silicon rower'].plan);
    expect(normaliseParams({ ...DEFAULT_PARAMS, chemistry: 'silicon', plan: 'fusiform' }).plan).toBe('radial');
    expect(normaliseParams({ ...DEFAULT_PARAMS, chemistry: 'carbon', plan: 'bell' }).plan).toBe('fusiform');
    expect(buildSwimmer(SWIMMERS['silicon bell'], 1).kin.kind).toBe('jet');
  });

  it('poses deterministically, with finite geometry and right-handed part bases, for every kind', () => {
    for (const [name, p] of Object.entries(SWIMMERS)) {
      const a = buildSwimmer(p, 7), b = buildSwimmer(p, 7);
      for (const t of [0, 0.41, 2.2]) {
        const ra = record(a, t);
        expect(ra.nums).toEqual(record(b, t).nums);
        expect(ra.tubes).toBeGreaterThan(0);
        expect(ra.nums.every((x) => Number.isFinite(x)), name).toBe(true);
        for (const q of ra.parts) expect(det(q.x, q.y, q.z), `${name} ${q.type}`).toBeGreaterThan(0);
      }
    }
  });

  it('one stroke cycle carries the body exactly the distance fauna.ts drives the phase by (no treadmilling)', () => {
    for (const p of Object.values(SWIMMERS)) {
      const sw = buildSwimmer(p, 3), k = sw.kin;
      const bells = p.plan === 'bell' ? p.radial.chain : 1;
      const perCycle = k.kind === 'wave' ? k.slip * k.lambda * sw.L : k.stroke; // fauna.ts: per-cycle travel
      expect(advance(k, 3 * k.cycle, 0, bells) - advance(k, 2 * k.cycle, 0, bells)).toBeCloseTo(perCycle, 9);
    }
    const k = kinematics(normaliseParams({ ...DEFAULT_PARAMS, length: 1.5 }));
    expect(k.speed).toBeCloseTo(k.slip * k.waveSpeed, 9);
    expect(k.speed).toBeLessThan(k.waveSpeed);
  });

  it('two or more long limb pairs make a plesiosaur: four flippers rooted inside the flank, flapping, fore and hind out of phase', () => {
    const p = SWIMMERS['carbon plesiosaur'];
    expect(p.plan).toBe('plesiosaur');
    expect(swimmerParamsFromPlan(plan({ limbPairs: 0.6, limbLen: 0.1, segments: 0.4, size: 0.4 })).plan).not.toBe('plesiosaur'); // short limbs
    expect(swimmerParamsFromPlan(plan({ limbPairs: 0.2, limbLen: 0.8, segments: 0.4, size: 0.4 })).plan).not.toBe('plesiosaur'); // one pair
    const sw = buildSwimmer(p, 7), k = sw.kin;
    const tips = (t: number) => {
      const blades = record(sw, t).parts.filter((q) => q.type === 'blade');
      expect(blades.length).toBe(4);
      return blades;
    };
    // the tips' height above the root, per flipper (order: fore left, fore right, hind left, hind right)
    const lift = (t: number) => tips(t).map((q) => q.y[1]);
    const a = lift(0.25 * k.cycle), b = lift(0.75 * k.cycle);
    for (let i = 0; i < 4; i++) expect(Math.abs(a[i] - b[i]), `flipper ${i} flaps`).toBeGreaterThan(0.05 * p.fins.lateralSize * sw.L);
    expect(Math.sign(a[0] - b[0])).toBe(Math.sign(a[1] - b[1])); // left and right beat together
    let differs = false;
    for (const t of [0, 0.2, 0.4, 0.6, 0.8].map((x) => x * k.cycle)) { const l = lift(t); if (Math.abs(l[0] - l[2]) > 0.02 * sw.L) differs = true; }
    expect(differs, 'hind pair lags the fore pair').toBe(true);
  });

  it('necks lengthen with segments and shorten with head and gape; tails lengthen with their segments (both extremes)', () => {
    expect(neckFrac({ segmentCount: 16, headScale: 0.75, gapeSize: 0, scale: 1 })).toBeCloseTo(0.45, 9);
    expect(neckFrac({ segmentCount: 3, headScale: 2, gapeSize: 2, scale: 1 })).toBeCloseTo(0.06, 9);
    const base = { segmentCount: 9, headScale: 1.2, gapeSize: 0.4, scale: 1 };
    let prev = -Infinity;
    for (let n = 3; n <= 16; n++) { const v = neckFrac({ ...base, segmentCount: n }); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    prev = Infinity;
    for (let h = 0.75; h <= 2; h += 0.125) { const v = neckFrac({ ...base, headScale: h }); expect(v).toBeLessThanOrEqual(prev); prev = v; }
    prev = Infinity;
    for (let g = 0; g <= 2; g += 0.25) { const v = neckFrac({ ...base, gapeSize: g }); expect(v).toBeLessThanOrEqual(prev); prev = v; }
    // through develop(): a many-segmented small-headed grazer and a short big-jawed hunter, both on long flippers
    const long = SWIMMERS['carbon long-neck'];
    const short = swimmerParamsFromPlan(plan({ limbPairs: 0.6, limbLen: 0.8, segments: 0, size: 0.4, gape: 1, eyes: 1, diet: 0.9 }));
    expect([long.plan, short.plan]).toEqual(['plesiosaur', 'plesiosaur']);
    expect(long.neck).toBeGreaterThan(short.neck + 0.2);
    expect(plesioMarks(long).fore - plesioMarks(short).fore).toBeGreaterThan(0.2);
    expect(tailFrac({ tailKind: 'whip', tailSegments: 6 })).toBeGreaterThan(tailFrac({ tailKind: 'whip', tailSegments: 2 }));
    expect(tailFrac({ tailKind: 'whip', tailSegments: 2 })).toBeGreaterThan(tailFrac({ tailKind: 'fluke', tailSegments: 1 }));
    expect(plesioMarks({ ...long, tailLen: 0.35 }).hind).toBeLessThan(plesioMarks({ ...long, tailLen: 0.12 }).hind);
  });

  it('silicon rowers beat in stepped 15° strokes', () => {
    const k = buildSwimmer(SWIMMERS['silicon rower'].plan === 'radial' ? SWIMMERS['silicon rower'] : { ...SWIMMERS['silicon rower'], plan: 'radial' }, 1).kin;
    for (let b = 0; b < (k.sweep[1] - k.sweep[0]) / STEP_DEG; b++) {
      const { deg } = armAngle(k, (0.5 * (b + 0.3)) / ((k.sweep[1] - k.sweep[0]) / STEP_DEG));
      expect((deg - k.sweep[0]) % STEP_DEG).toBeCloseTo(0, 9);
    }
  });
});
