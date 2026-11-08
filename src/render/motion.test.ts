import { describe, expect, it } from 'vitest';
import {
  EXTRAPOLATE_CAP, IDLE_BL, WALK_EASE, gaitStep, halfStride, slewAngle, turnRateMax, armPhase, armStance, bellPulse, fadeScale, gaitFoot, interpPose, lerpAngle, limbPhaseOffset, rollAngle, snapDeg, solveTwoBone,
  STANCE, swayOffset, swimWave, swimY, SWIM_MARGIN, SWIM_EMBED, swimNeed, nudgeToWater,
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

describe('walking gait (distance-integrated)', () => {
  it('halfStride grows with speed and is capped by the reach', () => {
    expect(halfStride(1, 3, 2)).toBeGreaterThan(halfStride(1, 3, 1));
    expect(halfStride(1, 3, 100)).toBeCloseTo(0.4 * 3, 9);
  });
  it('gaitStep: phase follows distance, eases the walk weight, and freezes when idle', () => {
    const g = { gait: 0, walkW: 0 };
    const dt = 1 / 60, L = 5;
    for (let i = 0; i < 30; i++) gaitStep(g, 1 * dt, 1, L, 1, 3, dt);
    expect(g.walkW).toBe(1); // eased in within WALK_EASE
    const before = g.gait, hW = gaitStep(g, 0.02, 1, L, 1, 3, dt);
    expect(g.gait - before).toBeCloseTo((STANCE * 0.02) / (2 * hW), 9); // one cycle per 2·hW/STANCE metres
    const idle = { gait: 0.3, walkW: 1 };
    for (let i = 0; i < Math.ceil(WALK_EASE / dt) + 1; i++) gaitStep(idle, 0, 0.5 * IDLE_BL * L, L, 1, 3, dt);
    expect(idle.walkW).toBe(0);
    const frozen = idle.gait;
    gaitStep(idle, 0.01, 0.5 * IDLE_BL * L, L, 1, 3, dt);
    expect(idle.gait).toBe(frozen);
  });
  it('slewAngle turns the short way by at most the step; long bodies turn slower', () => {
    expect(slewAngle(0, 1, 0.1)).toBeCloseTo(0.1, 9);
    expect(slewAngle(3, -3, 0.1)).toBeCloseTo(3.1, 9); // across ±π, the short way
    expect(slewAngle(0, 0.05, 0.1)).toBeCloseTo(0.05, 9);
    expect(turnRateMax(20)).toBeLessThan(turnRateMax(5));
  });
});

describe('swimY: swimmers stay in the water', () => {
  // a body 1 m tall resting on y0 (lo 0, hi 1)
  it('deep water: unchanged, 35% of the way up from the seabed', () => {
    const r = swimY(-20, 0, 0, 1);
    expect(r.beached).toBe(false);
    expect(r.y0).toBeCloseTo(-20 + 20 * 0.35);
  });
  it('shallow water: the top stays a margin under the surface', () => {
    const r = swimY(-1.5, 0, 0, 1);
    expect(r.beached).toBe(false);
    expect(r.y0 + 1).toBeLessThanOrEqual(-SWIM_MARGIN + 1e-9);
    expect(r.y0).toBeGreaterThanOrEqual(-1.5); // and not into the seabed while there is room
  });
  it('very shallow water: sinks into the seabed, at most 40% of its height', () => {
    const r = swimY(-0.9, 0, 0, 1);
    expect(r.beached).toBe(false);
    expect(r.y0 + 1).toBeLessThanOrEqual(-SWIM_MARGIN + 1e-9);
    expect(-0.9 - r.y0).toBeGreaterThan(0);
    expect(-0.9 - r.y0).toBeLessThanOrEqual(SWIM_EMBED + 1e-9);
  });
  it('water too shallow even with the embed: beached on the seabed at the embed limit', () => {
    const r = swimY(-0.3, 0, 0, 1);
    expect(r.beached).toBe(true);
    expect(r.y0).toBeCloseTo(-0.3 - SWIM_EMBED);
  });
  it('dry cell or no sea: beached, lying on the ground', () => {
    expect(swimY(2, 0, 0, 1)).toEqual({ y0: 2, beached: true });
    expect(swimY(-5, -Infinity, 0, 1)).toEqual({ y0: -5, beached: true });
  });
  it('a body centred below its y0 (lo < 0) rests its bottom on the ground and never sinks past the embed', () => {
    expect(swimY(1, 0, -0.5, 0.5).y0).toBeCloseTo(1.5);
    const r = swimY(-3, 0, -2, 2); // 4 m tall in 3 m of water
    expect(r.y0 + 2).toBeLessThanOrEqual(-SWIM_MARGIN + 1e-9);
    expect(-3 - (r.y0 - 2)).toBeLessThanOrEqual(SWIM_EMBED * 4 + 1e-9);
  });
});

describe('nudgeToWater: shoreline swimmers are drawn over deep enough water', () => {
  const ramp = (x: number) => -0.5 * x; // seabed falls 0.5 m per metre towards +x; the shore (h = 0) is at x = 0
  const H = (x: number) => ramp(x);
  const out = { dx: 0, dz: 0 };
  it('need matches swimY: the shallowest depth it does not beach', () => {
    const need = swimNeed(0, 1);
    expect(swimY(-need, 0, 0, 1).beached).toBe(false);
    expect(swimY(-need + 0.01, 0, 0, 1).beached).toBe(true);
  });
  it('deep enough already: no nudge', () => {
    expect(nudgeToWater(10, 0, 0, 1, H, 6.25, out)).toBe(true);
    expect(out).toEqual({ dx: 0, dz: 0 });
  });
  it('on dry sand by the shore: walks downhill into deep enough water, within the distance', () => {
    expect(nudgeToWater(-1, 3, 0, 1, H, 6.25, out)).toBe(true);
    expect(out.dx).toBeGreaterThan(0);
    expect(Math.abs(out.dz)).toBeLessThan(1e-6);
    expect(Math.hypot(out.dx, out.dz)).toBeLessThanOrEqual(6.25 + 1e-9);
    expect(0 - H(-1 + out.dx)).toBeGreaterThanOrEqual(1);
  });
  it('no deep water within reach: false, no offset (it beaches)', () => {
    expect(nudgeToWater(-20, 0, 0, 1, H, 6.25, out)).toBe(false);
    expect(out).toEqual({ dx: 0, dz: 0 });
    expect(nudgeToWater(0, 0, 0, 1, () => 0.2, 6.25, out)).toBe(false); // flat dry ground
  });
});
