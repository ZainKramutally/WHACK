import { describe, expect, it } from 'vitest';
import { develop, type DevelopInputs } from './develop';
import { makeFounders, type AnimalGenome } from './genome';
import { PLAN_FIELDS, PLAN_LENGTH, PLAN_VERSION, packBodyPlan, planField, unpackBodyPlan } from './plan';

const base = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
const legged = (g: AnimalGenome): AnimalGenome => ({
  ...g, body: { ...g.body, limbPairs: 0.5, limbLen: 0.6, size: 0.4, eyes: 0.6, horns: 0.6, glow: 0.8 },
});
const carbon = legged(base);
const silicon: AnimalGenome = { ...legged(base), comp: { c: 0.05, si: 0.9, o: 0.05 } };
const water: DevelopInputs = {
  solvent: { rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] },
  airDensity: 0.1,
  tissueDensity: { C: 1.05, Si: 2.2 },
};
const cond = { light: 0.3, heatBand: 0.5 };

function expectClose(a: unknown, b: unknown, path = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), path).toBeLessThanOrEqual(Math.abs(b) * 1e-6 + 1e-6); // float32 relative precision
  } else if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, path).toBe(b.length);
    a.forEach((v, i) => expectClose(v, b[i], `${path}[${i}]`));
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(b)) expectClose((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
  } else {
    expect(a, path).toBe(b);
  }
}

describe('body plan wire format', () => {
  it('has a versioned fixed layout', () => {
    const buf = packBodyPlan(develop(carbon, cond, water));
    expect(buf).toBeInstanceOf(Float32Array);
    expect(buf.length).toBe(PLAN_LENGTH);
    expect(buf[0]).toBe(PLAN_VERSION);
    expect(planField(PLAN_FIELDS[0])).toBe(1);
    expect(new Set(PLAN_FIELDS).size).toBe(PLAN_FIELDS.length);
  });

  for (const [name, genome] of [['carbon', carbon], ['silicon', silicon]] as const) {
    it(`round-trips a ${name} plan`, () => {
      const plan = develop(genome, cond, water);
      const back = unpackBodyPlan(packBodyPlan(plan));
      expectClose(back, plan);
      // enums and integers are exact
      expect(back.chemistry).toBe(plan.chemistry);
      expect(back.limbKind).toBe(plan.limbKind);
      expect(back.eyeKind).toBe(plan.eyeKind);
      expect(back.dorsal).toBe(plan.dorsal);
      expect(back.mode).toBe(plan.mode);
      expect(back.limbJointAngles.length).toBe(plan.limbJointAngles.length);
    });
  }

  it('carries the architecture: axial carbon has no arms or tiers, radial silicon has them all', () => {
    const c = unpackBodyPlan(packBodyPlan(develop(carbon, cond, water)));
    expect([c.architecture, c.symmetry, c.tiers, c.arms.length, c.tierRadii.length]).toEqual(['axial', 2, 0, 0, 0]);
    const plan = develop(silicon, cond, water);
    const s = unpackBodyPlan(packBodyPlan(plan));
    expect(s.architecture).toBe('radial');
    expect(s.symmetry).toBe(plan.symmetry);
    expect(s.arms).toHaveLength(plan.symmetry);
    expect(s.tierRadii).toHaveLength(plan.tiers);
    expect(s.arms.map((a) => a.azimuthDeg)).toEqual(plan.arms.map((a) => a.azimuthDeg));
  });

  it('keeps silicon joint angles on the 15° grid', () => {
    const back = unpackBodyPlan(packBodyPlan(develop(silicon, cond, water)));
    for (const a of back.limbJointAngles) expect(Math.abs(a % 15)).toBe(0);
  });

  it('rejects unknown versions and bad lengths', () => {
    const buf = packBodyPlan(develop(carbon, cond, water));
    const bad = buf.slice(); bad[0] = 99;
    expect(() => unpackBodyPlan(bad)).toThrow(/version/);
    expect(() => unpackBodyPlan(buf.slice(0, 10))).toThrow(/length/);
  });
});
