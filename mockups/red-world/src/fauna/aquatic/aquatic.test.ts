import { describe, expect, it } from 'vitest';
import type { V3 } from '../../flora/mesh';
import type { Path } from '../path';
import { buildSwimmer, type SwimSink } from './build';
import { swimmerParamsFromPlan, type AppBodyPlan } from './fromPlan';
import { advance, armAngle, bodyWave, envelope, kinematics, STEP_DEG } from './motion';
import { AXIAL_PLANS, DEFAULT_PARAMS, mergeParams, normaliseParams, RADIAL_PLANS, type SwimmerParams } from './params';
import { AQUATIC_VARIANTS, planLike, variantParams } from './variants';

const line: Path = { length: Infinity, at: (s) => ({ p: [s, 2, 0], t: [1, 0, 0] }) };
const INST = { s0: 0, phase: 0.3, off: [0, 0] as [number, number], k: 0 };

/** Everything one pose emits, flattened to numbers (tubes, sheets, then parts). */
function record(sw: ReturnType<typeof buildSwimmer>, t: number) {
  const out: (number | string)[] = [];
  const parts: { type: string; o: V3; x: V3; y: V3; z: V3 }[] = [];
  const sink: SwimSink = {
    tube: (i, c, _U, _R, rw, rh) => { out.push('tube', i, ...c.flat(), ...rw, ...rh); },
    sheet: (i, a, b) => { out.push('sheet', i, ...a.flat(), ...b.flat()); },
    part: (type, o, x, y, z, a, b, glow) => { out.push(type, ...o, ...x, ...y, ...z, a, b, glow); parts.push({ type, o, x, y, z }); },
  };
  const r = sw.pose(t, line, INST, sink);
  return { out, parts, centre: r.centre };
}
const det = (x: V3, y: V3, z: V3) => x[0] * (y[1] * z[2] - y[2] * z[1]) - x[1] * (y[0] * z[2] - y[2] * z[0]) + x[2] * (y[0] * z[1] - y[1] * z[0]);
const radialArms = (n: number, length: number) => Array.from({ length: n }, (_, k) => ({ azimuthDeg: (360 / n) * k, length }));

describe('buildSwimmer', () => {
  it('is deterministic: same params and seed give the same swimmer and the same pose at every t', () => {
    for (const v of AQUATIC_VARIANTS) {
      const p = variantParams(v);
      const a = buildSwimmer(p, 7), b = buildSwimmer(p, 7);
      expect(a.L).toBe(b.L);
      expect(a.tubes).toEqual(b.tubes);
      for (const t of [0, 1.3, 5.75]) expect(record(a, t).out).toEqual(record(b, t).out);
    }
  });

  it('the seed only jitters proportions (±4%), never the structure, and the input params are not mutated', () => {
    const p = variantParams(AQUATIC_VARIANTS[2]);
    const before = structuredClone(p);
    const a = buildSwimmer(p, 1), b = buildSwimmer(p, 2);
    expect(p).toEqual(before);
    expect(a.L).not.toBe(b.L);
    expect(Math.abs(a.L / p.length - 1)).toBeLessThanOrEqual(0.04);
    expect(a.tubes.map((t) => [t.rings, t.sides])).toEqual(b.tubes.map((t) => [t.rings, t.sides]));
    expect(a.sheets.length).toBe(b.sheets.length);
  });

  it('every variant poses finite geometry with right-handed part bases (the material flips back faces)', () => {
    for (const v of AQUATIC_VARIANTS) {
      const sw = buildSwimmer(variantParams(v), 3);
      for (const t of [0, 0.41, 2.2]) {
        const { out, parts } = record(sw, t);
        expect(out.filter((x) => typeof x === 'number').every((x) => Number.isFinite(x))).toBe(true);
        for (const q of parts) expect(det(q.x, q.y, q.z), `${v.name} ${q.type}`).toBeGreaterThan(0);
      }
    }
  });

  it('chemistry is the grammar: silicon always builds radial, carbon always axial', () => {
    expect(normaliseParams({ ...DEFAULT_PARAMS, chemistry: 'silicon', plan: 'fusiform' }).plan).toBe('radial');
    expect(normaliseParams({ ...DEFAULT_PARAMS, chemistry: 'carbon', plan: 'bell' }).plan).toBe('fusiform');
    const si = normaliseParams(mergeParams(DEFAULT_PARAMS, { chemistry: 'silicon', plan: 'bell', tail: 'fork', fins: { dorsal: 0.2 } }));
    expect(si.tail).toBe('none');
    expect(si.fins.dorsal).toBe(0);
    expect(buildSwimmer(si, 1).kin.kind).toBe('jet');
    expect(buildSwimmer({ ...si, plan: 'radial' }, 1).kin.kind).toBe('row');
  });
});

describe('swimmerParamsFromPlan', () => {
  const siPlan = (o: Partial<AppBodyPlan> = {}) => planLike({ chemistry: 'silicon', architecture: 'radial', symmetry: 4, segmentCount: 0, tiers: 3, hubRadius: 0.3, arms: radialArms(4, 0.7), armKind: 'rod', eyeKind: 'dots', eyeCount: 8, ...o });

  it('maps a silicon plan to a radial swimmer: a rower, or a bell when the hub flares or trails whip arms', () => {
    const rower = swimmerParamsFromPlan(siPlan());
    expect(rower.chemistry).toBe('silicon');
    expect(rower.plan).toBe('radial');
    expect(rower.radial.symmetry).toBe(4);
    expect(rower.head.eyes).toBe(2); // 8 dot eyes over 4 arms
    expect(rower.tail).toBe('none');
    expect(swimmerParamsFromPlan(siPlan({ flare: 0.6 })).plan).toBe('bell');
    expect(swimmerParamsFromPlan(siPlan({ armKind: 'whip' })).plan).toBe('bell');
    for (const sym of [3, 5, 6, 8]) expect(swimmerParamsFromPlan(siPlan({ symmetry: sym })).radial.symmetry).toBe(sym);
    for (const o of [{}, { flare: 0.9 }, { tiers: 5, armKind: 'branch' as const }]) expect(RADIAL_PLANS).toContain(swimmerParamsFromPlan(siPlan(o)).plan);
  });

  it('maps a carbon plan to an axial swimmer: ribbon when long and thin, segmented when plated, fusiform otherwise', () => {
    expect(swimmerParamsFromPlan(planLike({ segmentCount: 15, girth: 0.4 })).plan).toBe('ribbon');
    expect(swimmerParamsFromPlan(planLike({ plateCover: 0.6 })).plan).toBe('segmented');
    const fish = swimmerParamsFromPlan(planLike({}));
    expect(fish.chemistry).toBe('carbon');
    expect(fish.plan).toBe('fusiform');
    for (const o of [{}, { segmentCount: 16, girth: 0.3 }, { legPairs: 2 }, { flatten: 0.5, girth: 1.2 }]) expect(AXIAL_PLANS).toContain(swimmerParamsFromPlan(planLike(o)).plan);
  });

  it('takes glow straight from plan.glow (glow from darkness is already in it), clamped to 0..1', () => {
    for (const g of [0, 0.35, 0.9]) {
      expect(swimmerParamsFromPlan(planLike({ glow: g })).glow).toBe(g);
      expect(swimmerParamsFromPlan(siPlan({ glow: g })).glow).toBe(g);
    }
    expect(swimmerParamsFromPlan(planLike({ glow: 1.7 })).glow).toBe(1);
    const dark = swimmerParamsFromPlan(planLike({ glow: 0 }));
    expect(dark.lateralLine).toBe(0);
    expect(dark.photophores).toBe(0);
    expect(swimmerParamsFromPlan(planLike({ glow: 0.85, segmentCount: 4 })).photophores).toBeGreaterThanOrEqual(3);
  });

  it('is pure: same plan gives the same params, and the plan is not mutated', () => {
    const plan = siPlan({ flare: 0.5, glow: 0.4 });
    const before = structuredClone(plan);
    expect(swimmerParamsFromPlan(plan, { sociality: 0.7 })).toEqual(swimmerParamsFromPlan(plan, { sociality: 0.7 }));
    expect(plan).toEqual(before);
  });

  it('small social plans school; big or solitary ones swim alone', () => {
    expect(swimmerParamsFromPlan(planLike({ scale: 0.3 }), { sociality: 0.95 }).school).toBeGreaterThan(10);
    expect(swimmerParamsFromPlan(planLike({ scale: 6 }), { sociality: 0.95 }).school).toBeLessThan(5);
    expect(swimmerParamsFromPlan(planLike({ scale: 0.3 }), { sociality: 0 }).school).toBe(1);
  });
});

describe('motion: wave speed vs travel speed (no sliding)', () => {
  const carbon = (o: Partial<SwimmerParams>) => normaliseParams({ ...DEFAULT_PARAMS, ...o });

  it('body-wave swimmers travel slower than their wave (slip 0.6–0.8), at a speed tied to the wave', () => {
    for (const und of [0, 0.5, 1]) for (const L of [0.3, 1, 7]) {
      const k = kinematics(carbon({ length: L, undulation: und }));
      expect(k.kind).toBe('wave');
      expect(k.waveSpeed).toBeCloseTo(k.lambda * L * k.freq, 9);
      expect(k.slip).toBeGreaterThanOrEqual(0.6);
      expect(k.slip).toBeLessThanOrEqual(0.8);
      expect(k.speed).toBeCloseTo(k.slip * k.waveSpeed, 9);
      expect(k.speed).toBeLessThan(k.waveSpeed);
      expect(advance(k, 3.7)).toBeCloseTo(k.speed * 3.7, 9);
    }
  });

  it('the rendered body wave runs nose → tail at exactly waveSpeed, and fin ripples at the same speed', () => {
    const p = carbon({ length: 2, undulation: 0.7, fins: { ...DEFAULT_PARAMS.fins, lateral: 9 } });
    const k = kinematics(p);
    const dt = 0.05, du = (k.waveSpeed * dt) / p.length; // where a crest at u moves to after dt
    for (const u of [0.2, 0.5, 0.8]) {
      const w0 = bodyWave(k, p.undulation, u, 1.1) / envelope(u, p.undulation);
      const w1 = bodyWave(k, p.undulation, u + du, 1.1 + dt) / envelope(u + du, p.undulation);
      expect(w1).toBeCloseTo(w0, 9);
    }
    expect(k.finFreq * k.finLambda * p.length).toBeCloseTo(k.waveSpeed, 9);
  });

  it('a posed body-wave swimmer moves forward at its travel speed', () => {
    const sw = buildSwimmer(carbon({ length: 1.5, undulation: 0.4 }), 5);
    const c0 = record(sw, 2).centre, c1 = record(sw, 2 + sw.kin.cycle).centre; // one full beat: the wave phase repeats
    expect((c1[0] - c0[0]) / sw.kin.cycle).toBeCloseTo(sw.kin.speed, 6);
  });

  it('rowers and bells never slide back, cover one stroke per cycle and most of it in the power phase', () => {
    const rower = buildSwimmer(variantParams(AQUATIC_VARIANTS[3]), 1).kin;
    const bell = buildSwimmer(variantParams(AQUATIC_VARIANTS[4]), 1).kin;
    for (const [k, bells, power] of [[rower, 1, 0.5], [bell, 1, 0.3], [bell, 4, 0.3]] as const) {
      let prev = advance(k, 0, 0, bells);
      for (let i = 1; i <= 400; i++) {
        const s = advance(k, (i / 400) * 3 * k.cycle, 0, bells);
        expect(s).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = s;
      }
      expect(advance(k, 2 * k.cycle, 0, bells) - advance(k, k.cycle, 0, bells)).toBeCloseTo(k.stroke, 9);
      expect(k.speed).toBeCloseTo(k.stroke * k.freq, 9);
      if (bells === 1) expect(advance(k, power * k.cycle) / k.stroke).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('rowing arms sweep 45° → 135° in stepped 15° beats, then fold and swing back', () => {
    const k = buildSwimmer(variantParams(AQUATIC_VARIANTS[3]), 1).kin;
    const beats = (k.sweep[1] - k.sweep[0]) / STEP_DEG;
    for (let b = 0; b < beats; b++) {
      // early in each beat the arm holds on a 15° step
      const phi = (0.5 * (b + 0.3)) / beats;
      const { deg, fold } = armAngle(k, phi);
      expect((deg - k.sweep[0]) % STEP_DEG).toBeCloseTo(0, 9);
      expect(fold).toBe(0);
    }
    for (let i = 0; i <= 100; i++) {
      const { deg } = armAngle(k, i / 100.5);
      expect(deg).toBeGreaterThanOrEqual(k.sweep[0] - 1e-9);
      expect(deg).toBeLessThanOrEqual(k.sweep[1] + 1e-9);
    }
    expect(armAngle(k, 0.75).fold).toBeGreaterThan(0.9);
  });
});

describe('variants', () => {
  it('five named variants, each with a one-line why; silicon ones are radial and carbon ones axial', () => {
    expect(AQUATIC_VARIANTS).toHaveLength(5);
    expect(new Set(AQUATIC_VARIANTS.map((v) => v.name)).size).toBe(5);
    for (const v of AQUATIC_VARIANTS) {
      expect(v.why.length).toBeGreaterThan(20);
      expect(v.why).not.toContain('\n');
      const p = variantParams(v);
      expect(p.chemistry).toBe(v.plan.chemistry);
      expect(p.chemistry === 'silicon' ? RADIAL_PLANS : AXIAL_PLANS).toContain(p.plan);
      expect(p.glow).toBe(v.plan.glow);
    }
    expect(AQUATIC_VARIANTS.filter((v) => v.plan.chemistry === 'silicon').length).toBeGreaterThanOrEqual(2);
    expect(AQUATIC_VARIANTS.filter((v) => v.plan.chemistry === 'carbon').length).toBeGreaterThanOrEqual(2);
  });
});
