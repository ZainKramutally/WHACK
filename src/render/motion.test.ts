import { describe, expect, it } from 'vitest';
import {
  EXTRAPOLATE_CAP, armPhase, armStance, bellPulse, fadeScale, gaitFoot, interpPose, lerpAngle, limbPhaseOffset, rollAngle, snapDeg, solveTwoBone,
  STANCE, swayOffset, swimWave,
} from './motion';

describe('interpolation', () => {
  it('lerps position and takes the short way round for heading', () => {
    const p = interpPose({ x: 0, z: 0, h: 3 }, { x: 10, z: -4, h: -3 }, 0.5);
    expect(p.x).toBeCloseTo(5); expect(p.z).toBeCloseTo(-2);
    expect(Math.abs(Math.sin(p.h))).toBeLessThan(0.2); // near π, not near 0
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4);
  });
  it('extrapolates a little past the target, then holds', () => {
    const a = { x: 0, z: 0, h: 0 }, b = { x: 10, z: 0, h: 0 };
    expect(interpPose(a, b, 1.2).x).toBeCloseTo(12);
    expect(interpPose(a, b, 5).x).toBeCloseTo(10 * EXTRAPOLATE_CAP);
    expect(interpPose(a, b, -1).x).toBe(0);
  });
  it('fades in and out smoothly between 0 and 1', () => {
    expect(fadeScale(0)).toBe(0); expect(fadeScale(0.3)).toBe(1); expect(fadeScale(9)).toBe(1);
    expect(fadeScale(0.15)).toBeCloseTo(0.5); expect(fadeScale(0.05)).toBeLessThan(fadeScale(0.1));
  });
});

describe('two-bone IK', () => {
  const len = (a: number, b: number) => Math.hypot(a, b);
  it('reaches a reachable target with the right bone lengths and the knee above', () => {
    const s = solveTwoBone(0.6, -0.8, 1, 1);
    expect(s.footU).toBeCloseTo(0.6, 5); expect(s.footV).toBeCloseTo(-0.8, 5);
    expect(len(s.kneeU, s.kneeV)).toBeCloseTo(1, 5);
    expect(len(s.footU - s.kneeU, s.footV - s.kneeV)).toBeCloseTo(1, 5);
    expect(s.kneeV).toBeGreaterThan(-0.8 / 2); // above the hip→foot midpoint line
  });
  it('stretches toward an unreachable target without breaking bone lengths', () => {
    const s = solveTwoBone(10, 0, 1, 1);
    expect(s.footU).toBeCloseTo(2, 3); expect(len(s.kneeU, s.kneeV)).toBeCloseTo(1, 5);
  });
  it('silicon joints only use 15° steps', () => {
    for (const [u, v] of [[0.7, -1.1], [1.2, -0.5], [0.2, -1.6], [1.5, -0.9]]) {
      const s = solveTwoBone(u, v, 1, 1.2, 15);
      for (const th of [s.th1, s.th2]) {
        const deg = (th * 180) / Math.PI;
        expect(Math.abs(deg / 15 - Math.round(deg / 15))).toBeLessThan(1e-6);
      }
      expect(len(s.kneeU, s.kneeV)).toBeCloseTo(1, 5);
      expect(len(s.footU - s.kneeU, s.footV - s.kneeV)).toBeCloseTo(1.2, 5);
    }
    expect(snapDeg(22, 15)).toBe(15); expect(snapDeg(22, 0)).toBe(22);
  });
});

describe('gait', () => {
  it('stance plants the foot (no lift) and sweeps it back; swing returns it lifted', () => {
    expect(gaitFoot(0, 1, 0.3)).toEqual({ dx: 1, dy: 0 });
    const mid = gaitFoot(STANCE / 2, 1, 0.3);
    expect(mid.dx).toBeCloseTo(0); expect(mid.dy).toBe(0);
    expect(gaitFoot(STANCE, 1, 0.3).dx).toBeCloseTo(-1);
    const swing = gaitFoot(STANCE + (1 - STANCE) / 2, 1, 0.3);
    expect(swing.dy).toBeCloseTo(0.3); expect(swing.dx).toBeCloseTo(0);
  });
  it('is periodic and alternates sides and pairs', () => {
    expect(gaitFoot(0.25, 1, 1).dx).toBeCloseTo(gaitFoot(3.25, 1, 1).dx);
    expect(limbPhaseOffset(0, 1)).toBe(0); expect(limbPhaseOffset(0, -1)).toBe(0.5);
    expect(limbPhaseOffset(1, 1)).toBe(0.5); expect(limbPhaseOffset(1, -1)).toBe(0);
  });
});

describe('body motion', () => {
  it('swim wave: tail swings more than head, and moves with time', () => {
    const peak = (xn: number) => Math.max(...Array.from({ length: 40 }, (_, i) => Math.abs(swimWave(xn, i / 40, 1))));
    expect(peak(0)).toBeGreaterThan(peak(1));
    expect(swimWave(0.3, 0, 1)).not.toBeCloseTo(swimWave(0.3, 0.2, 1));
  });
  it('bell pulses around 1 and sway grows with height', () => {
    expect(bellPulse(0.2, 0)).toBeGreaterThan(0.85); expect(bellPulse(0.2, 0)).toBeLessThan(1.15);
    expect(Math.abs(swayOffset(1, 1.3, 0, 1))).toBeGreaterThan(Math.abs(swayOffset(0.3, 1.3, 0, 1)));
    expect(swayOffset(0, 1.3, 0, 1)).toBe(0);
  });
});

describe('radial motion', () => {
  it('tripod stepping alternates opposite arms; a 3-fold body steps its arms in turn', () => {
    expect([0, 1, 2, 3, 4, 5].map((k) => armPhase(k, 6))).toEqual([0, 0.5, 0, 0.5, 0, 0.5]);
    expect([0, 1, 2, 3].map((k) => armPhase(k, 4))).toEqual([0, 0.5, 0, 0.5]);
    expect([0, 1, 2].map((k) => armPhase(k, 3))).toEqual([0, 1 / 3, 2 / 3]);
  });
  it('arm stances: spokes straight out, a bell hanging down and pulsing, crystal prongs raised and still', () => {
    expect(armStance('spoke', 2, 0.3, 0)).toEqual({ out: 1.8, up: 0 });
    const b = armStance('bell', 2, 0.3, 0);
    expect(b.up).toBeLessThan(-1); expect(b.out).toBeGreaterThan(0);
    expect(armStance('bell', 2, 0, 0).out).not.toBeCloseTo(armStance('bell', 2, 0.4, 0).out);
    const c1 = armStance('crystal', 2, 0, 0), c2 = armStance('crystal', 2, 5, 3);
    expect(c1).toEqual(c2); expect(c1.up).toBeGreaterThan(0);
  });
  it('rolling turns distance ÷ radius', () => {
    expect(rollAngle(Math.PI, 1)).toBeCloseTo(Math.PI);
    expect(rollAngle(2, 4)).toBeCloseTo(0.5);
  });
});
