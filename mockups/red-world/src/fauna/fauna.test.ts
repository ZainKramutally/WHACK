import { describe, expect, it } from 'vitest';
import { develop, gaitFor } from './develop';
import { footAt, legPhase, plantDistance, twoBoneIK } from './ik';
import { pose, type Sink } from './rig';
import { line } from './path';
import { VARIANTS } from './variants';
import type { BodyGenes, Composition } from './genome';
import type { V3 } from '../flora/mesh';

const base: BodyGenes = {
  size: 0.4, segments: 0.3, limbPairs: 0.5, limbLen: 0.3, plates: 0.2, horns: 0.2,
  gape: 0.3, diet: 0.2, eyes: 0.5, buoy: 0, glow: 0.2, sociality: 0.2,
};
const SI: Composition = { c: 0.2, si: 0.7, o: 0.1 };
const C: Composition = { c: 0.75, si: 0.1, o: 0.15 };
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('develop()', () => {
  it('is pure and deterministic', () => {
    for (const v of VARIANTS) expect(develop(v.genes, v.comp, 7)).toEqual(develop(v.genes, v.comp, 7));
  });
  it('seed varies proportions but never the trait classes', () => {
    const a = develop(base, SI, 1), b = develop(base, SI, 2);
    expect(a.scale).not.toBe(b.scale);
    for (const k of ['chemistry', 'legPairs', 'gait', 'sides', 'eyeKind', 'eyeCount', 'hornCount', 'mode'] as const) expect(a[k]).toEqual(b[k]);
  });
  it('limbPairs drives the gait: 1 pair hops, 2 trot, 3+ metachronal wave', () => {
    expect(gaitFor(0)).toBe('none');
    const g = (lp: number) => develop({ ...base, limbPairs: lp }, C, 1);
    expect(g(0.25).legPairs).toBe(1); expect(g(0.25).gait).toBe('hop');
    expect(g(0.5).gait).toBe('trot');
    expect(g(0.75).gait).toBe('wave'); expect(g(1).gait).toBe('wave'); expect(g(1).legPairs).toBe(4);
    expect(g(0).gait).toBe('none'); expect(g(0).mode).toBe('crawl');
  });
  it('silicon → hex sides, flat facets, 15° joint snap; carbon → 12 smooth sides', () => {
    const s = develop(base, SI, 1), c = develop(base, C, 1);
    expect([s.sides, s.flat, s.jointSnapDeg, s.limbKind, s.eyeKind]).toEqual([6, true, 15, 'rod', 'dots']);
    expect(s.jointMaxDeg % 15).toBe(0);
    expect([c.sides, c.flat, c.jointSnapDeg, c.limbKind, c.eyeKind]).toEqual([12, false, 0, 'tentacle', 'rings']);
    expect(c.jointMaxDeg).toBeGreaterThan(s.jointMaxDeg);
  });
  it('size spans a sub-metre critter to a 20 m+ cold floater, monotonically', () => {
    const sc = (size: number, extra: Partial<BodyGenes> = {}) => develop({ ...base, size, ...extra }, C, 1).scale;
    expect(sc(0.1)).toBeLessThan(0.5);
    for (let s = 0.1; s < 1; s += 0.1) expect(sc(s + 0.1)).toBeGreaterThan(sc(s));
    // ±5% seed jitter around a ~20.5 m giant: the mean is over 20 m and no individual drops below 19 m
    const giants = [1, 2, 3, 4, 5, 6, 7, 8].map((sd) => develop({ ...base, size: 1, buoy: 0.95, limbPairs: 0 }, C, sd).scale);
    expect(giants.reduce((a, b) => a + b, 0) / giants.length).toBeGreaterThanOrEqual(20);
    expect(Math.min(...giants)).toBeGreaterThan(19);
    expect(develop({ ...base, size: 1, buoy: 0.95, limbPairs: 0 }, C, 1).mode).toBe('hover');
  });
  it('speed = stride × cadence (no foot sliding) and a stance stride never overstretches the leg', () => {
    for (const v of VARIANTS) {
      const p = develop(v.genes, v.comp, 3);
      if (p.gait === 'none') continue;
      expect(p.speed).toBeCloseTo(p.stride * p.cadence, 9);
      expect(p.stride).toBeLessThanOrEqual(0.9 * p.legLen + 1e-9);
      expect(p.hipHeight).toBeLessThan(p.legLen);
    }
  });
  it('plates, horns, eyes and glow follow their genes', () => {
    expect(develop({ ...base, plates: 0 }, SI, 1).plates.length).toBe(0);
    expect(develop({ ...base, plates: 0.9 }, SI, 1).plates.length).toBeGreaterThan(2);
    expect(develop({ ...base, horns: 0.8 }, SI, 1).hornCount).toBe(3);
    expect(develop({ ...base, horns: 0.8 }, C, 1).hornCount).toBe(2);
    expect(develop({ ...base, eyes: 0.9 }, SI, 1).eyeCount).toBe(6);
    expect(develop({ ...base, glow: 0 }, C, 1).glowSpots).toBe(0);
    expect(develop({ ...base, glow: 1 }, C, 1).glowSpots).toBeGreaterThan(0);
  });
});

describe('twoBoneIK', () => {
  it('reaches a reachable target with exact bone lengths', () => {
    const hip: V3 = [0, 2, 0], target: V3 = [0.6, 0.2, 0.3];
    const r = twoBoneIK(hip, target, 1.1, 1.0, [0, 1, 0]);
    expect(r.reached).toBe(true);
    expect(dist(r.foot, target)).toBeLessThan(1e-9);
    expect(dist(hip, r.knee)).toBeCloseTo(1.1, 9);
    expect(dist(r.knee, r.foot)).toBeCloseTo(1.0, 9);
    expect(r.knee[1]).toBeGreaterThan((hip[1] + target[1]) / 2 - 0.5); // bends toward the pole
  });
  it('clamps an out-of-reach target to full extension along the hip→target line', () => {
    const r = twoBoneIK([0, 0, 0], [5, 0, 0], 1, 1, [0, 1, 0]);
    expect(r.reached).toBe(false);
    expect(dist([0, 0, 0], r.foot)).toBeLessThanOrEqual(2);
    expect(r.foot[0]).toBeGreaterThan(1.99);
    expect(dist([0, 0, 0], r.knee)).toBeCloseTo(1, 9);
  });
  it('clamps a too-close target so the chain never folds through itself', () => {
    const r = twoBoneIK([0, 0, 0], [0.01, 0, 0], 1, 0.6, [0, 1, 0]);
    expect(dist([0, 0, 0], r.foot)).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });
});

describe('foot planting', () => {
  const stride = 1.2, duty = 0.6;
  const plant = (k: number): V3 => [plantDistance(k, stride, duty, 0), 0, 0];
  it('stays fixed for the whole stance phase', () => {
    const p0 = footAt(3.0, duty, plant, 0.3).pos;
    for (const ph of [3.1, 3.3, 3.59]) expect(footAt(ph, duty, plant, 0.3).pos).toEqual(p0);
  });
  it('swings in an arc and lands exactly on the next plant, one stride ahead', () => {
    const mid = footAt(3.8, duty, plant, 0.3);
    expect(mid.stance).toBe(false);
    expect(mid.pos[1]).toBeGreaterThan(0);
    const land = footAt(4 - 1e-9, duty, plant, 0.3).pos;
    expect(dist(land, plant(4))).toBeLessThan(1e-6);
    expect(plant(4)[0] - plant(3)[0]).toBeCloseTo(stride, 12);
  });
  it('trot pairs diagonals; hop moves both legs together; tripod alternates', () => {
    expect(legPhase('trot', 0, 2, -1)).toBe(legPhase('trot', 1, 2, 1));
    expect(legPhase('trot', 0, 2, -1)).not.toBe(legPhase('trot', 0, 2, 1));
    expect(legPhase('hop', 0, 1, -1)).toBe(legPhase('hop', 0, 1, 1));
    expect(legPhase('wave', 0, 3, -1)).toBe(legPhase('wave', 1, 3, 1));
    expect(legPhase('wave', 0, 3, -1)).toBe(legPhase('wave', 2, 3, -1));
  });
  it('a walking creature never slides a planted foot (posed end to end on a straight path)', () => {
    const v = VARIANTS[0];
    const p = develop(v.genes, v.comp, 1);
    const feet = (t: number) => {
      const out: V3[] = [];
      // the rod rig emits hip→knee, knee→foot, then the foot pad per leg; pads carry the planted position
      const sink: Sink = { part: (type, o) => { if (type === 'plateSi' && o[1] < p.legRadius * 0.2) out.push([o[0], 0, o[2]]); } };
      pose(p, t, line(0, 0), { s0: 0, phase: 0 }, sink);
      return out;
    };
    // sample a stance window of the first leg: phase in [k, k + duty) where phase = s / stride
    const off = legPhase(p.gait, 0, p.legPairs, -1);
    const tStart = ((10 - off) * p.stride) / p.speed, tEnd = ((10 + p.duty - off) * p.stride) / p.speed;
    const f0 = feet(tStart + 1e-6)[0];
    for (let k = 1; k <= 5; k++) expect(dist(feet(tStart + ((tEnd - tStart) * k) / 6)[0], f0)).toBeLessThan(1e-9);
  });
});
