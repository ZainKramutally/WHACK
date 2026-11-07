import { describe, expect, it } from 'vitest';
import { develop, LOCOMOTION, type DevelopConditions } from './develop';
import { makeFounders, type AnimalGenome } from './genome';

const base = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
const legged = (g: AnimalGenome): AnimalGenome => ({
  ...g, body: { ...g.body, limbPairs: 0.5, limbLen: 0.6, size: 0.4, eyes: 0.6, horns: 0.6, glow: 0.8 },
});
const carbon: AnimalGenome = legged(base);
const silicon: AnimalGenome = { ...legged(base), comp: { c: 0.05, si: 0.9, o: 0.05 } };
const day: DevelopConditions = { light: 1, heatBand: 0.5, airDensity: 0.1 };

describe('develop', () => {
  it('is referentially transparent', () => {
    expect(develop(carbon, day)).toEqual(develop(structuredClone(carbon), { ...day }));
    expect(develop(silicon, day)).toEqual(develop(silicon, day));
  });

  it('silicon: hex facets, rod limbs, 15° joints, dot eyes', () => {
    const p = develop(silicon, day);
    expect(p.chemistry).toBe('silicon');
    expect(p.sides).toBe(6);
    expect(p.flatShaded).toBe(true);
    expect(p.limbKind).toBe('rod');
    expect(p.limbSegments).toBe(2);
    expect(p.limbJointAngles.length).toBeGreaterThan(0);
    for (const a of p.limbJointAngles) expect(Math.abs(a % 15)).toBe(0);
    expect(p.bodyJointMaxDeg % 15).toBe(0);
    expect([3, 4, 6]).toContain(p.eyeCount);
    expect(p.eyeKind).toBe('dots');
    expect(p.curl).toBe(0);
  });

  it('carbon: round curling segments, tentacle limbs, ring eyes', () => {
    const p = develop(carbon, day);
    expect(p.chemistry).toBe('carbon');
    expect(p.sides).toBe(12);
    expect(p.flatShaded).toBe(false);
    expect(p.curl).toBeGreaterThan(0);
    expect(p.limbKind).toBe('tentacle');
    expect(p.limbSegments).toBeGreaterThan(2);
    expect(p.jointSnapDeg).toBe(0);
    expect(p.limbJointAngles.some((a) => a % 15 !== 0)).toBe(true);
    expect(p.eyeCount).toBe(2);
    expect(p.eyeKind).toBe('rings');
  });

  it('glow is 0 at full light, rises as light falls, and ignores oxygen', () => {
    const at = (g: AnimalGenome, light: number) => develop(g, { ...day, light }).glow;
    expect(at(carbon, 1)).toBe(0);
    expect(at(carbon, 0.5)).toBeGreaterThan(0);
    expect(at(carbon, 0.1)).toBeGreaterThan(at(carbon, 0.5));
    expect(at(carbon, 0)).toBeCloseTo(carbon.body.glow);
    const oxy = { ...carbon, comp: { c: 0.3, si: 0.1, o: 0.6 } };
    const noOxy = { ...carbon, comp: { c: 0.9, si: 0.1, o: 0 } };
    expect(at(oxy, 0.3)).toBe(at(noOxy, 0.3));
    expect(at(silicon, 0.3)).toBe(at(carbon, 0.3));
  });

  it('eyes grow, and cost more, in the dark', () => {
    const bright = develop(carbon, { ...day, light: 1 });
    const dark = develop(carbon, { ...day, light: 0.05 });
    expect(dark.eyeArea).toBeGreaterThan(bright.eyeArea);
    expect(dark.eyeUpkeep).toBeGreaterThan(bright.eyeUpkeep);
  });

  it('cold makes bigger bodies (temperature–size rule), more so in the sea than on land', () => {
    const worm = base; // legless: not a walker
    const cold = develop(worm, { ...day, heatBand: 0 }).scale;
    const hot = develop(worm, { ...day, heatBand: 1 }).scale;
    expect(cold).toBeGreaterThan(hot);
    const w = (h: number) => develop(carbon, { ...day, heatBand: h });
    expect(w(0).mode).toBe(LOCOMOTION.walk);
    expect(w(0).scale / w(1).scale).toBeLessThan(cold / hot);
  });

  it('a legless worm swims; a long-legged dense body walks', () => {
    expect(develop(base, day).mode).toBe(LOCOMOTION.swim);
    const stilts = { ...silicon, body: { ...silicon.body, limbPairs: 1, limbLen: 1, buoy: 0 } };
    expect(develop(stilts, day).mode).toBe(LOCOMOTION.walk);
  });

  it('gas-filled bodies hover in thick air but not thin air', () => {
    const bell: AnimalGenome = { ...base, body: { ...base.body, buoy: 0.7, limbPairs: 0, segments: 0, size: 0.5 } };
    const thin = develop(bell, { ...day, airDensity: 0.1 });
    const thick = develop(bell, { ...day, airDensity: 0.4 });
    expect(thin.modeCosts.hover).toBeGreaterThan(thick.modeCosts.hover);
    expect(thick.mode).toBe(LOCOMOTION.hover);
  });

  it('derives defence from plates and horns, mass from size, and diet gains', () => {
    const plain = develop(base, day);
    const armed = develop({ ...base, body: { ...base.body, plates: 0.8, horns: 0.8 } }, day);
    expect(armed.defence).toBeGreaterThan(plain.defence);
    expect(armed.mass).toBeGreaterThan(plain.mass);
    const big = develop({ ...base, body: { ...base.body, size: 0.9 } }, day);
    expect(big.mass).toBeGreaterThan(plain.mass);
    const hunter = develop({ ...base, body: { ...base.body, diet: 1 } }, day);
    expect(hunter.meatGain).toBe(1);
    expect(hunter.plantGain).toBe(0);
  });

  it('a limb bud smoothly lowers walking cost without being a leg', () => {
    const cost = (lp: number) => develop({ ...base, body: { ...base.body, limbPairs: lp } }, day).modeCosts.walk;
    expect(develop({ ...base, body: { ...base.body, limbPairs: 0.1 } }, day).legPairs).toBe(0);
    expect(cost(0.1)).toBeLessThan(cost(0));
  });
});
