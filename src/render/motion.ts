// Pure maths for creature motion (render-only, no three.js): snapshot interpolation, 2-bone IK with 15° joint
// snapping, a planted-foot gait, and the swim wave / bell pulse / sessile sway. Tested in motion.test.ts.

// --- snapshot interpolation -------------------------------------------------------------------------------
export const EXTRAPOLATE_CAP = 1.4; // render at most 40% past the target before the next snapshot lands

/** Shortest-arc interpolation between two angles in radians. */
export function lerpAngle(a: number, b: number, u: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * u;
}

/**
 * Pose at progress u between the previous rendered pose and the newest snapshot target. u is clamped to
 * [0, EXTRAPOLATE_CAP]: beyond 1 the pose continues along the same velocity for a short while, then holds.
 */
export function interpPose(
  prev: { x: number; z: number; h: number }, cur: { x: number; z: number; h: number }, u: number,
): { x: number; z: number; h: number } {
  const k = u < 0 ? 0 : u > EXTRAPOLATE_CAP ? EXTRAPOLATE_CAP : u;
  return { x: prev.x + (cur.x - prev.x) * k, z: prev.z + (cur.z - prev.z) * k, h: lerpAngle(prev.h, cur.h, Math.min(k, 1)) };
}

/** Birth fade-in / death fade-out scale: 0 → 1 over `dur` seconds, smoothstepped. */
export function fadeScale(age: number, dur = 0.3): number {
  const x = age <= 0 ? 0 : age >= dur ? 1 : age / dur;
  return x * x * (3 - 2 * x);
}

// --- two-bone IK ------------------------------------------------------------------------------------------
export const SNAP_DEG = 15;

/** Round an angle (degrees) to the nearest multiple of `step` (0 = continuous). */
export function snapDeg(deg: number, step: number): number {
  return step > 0 ? Math.round(deg / step) * step : deg;
}

export interface Bone2D { kneeU: number; kneeV: number; footU: number; footV: number; th1: number; th2: number }

/**
 * Solve a 2-bone limb in a vertical plane: hip at the origin, target at (u, v) with u horizontal (outward along the
 * leg's plane) and v up. The knee bends upward. Reach is clamped, so an unreachable target gives a fully stretched
 * limb pointing at it. With `snap` > 0 (silicon) both joint angles are rounded to that many degrees and the limb is
 * rebuilt by forward kinematics, so the result only ever uses 15° steps.
 */
export function solveTwoBone(u: number, v: number, l1: number, l2: number, snap = 0): Bone2D {
  const maxReach = l1 + l2 - 1e-6;
  const minReach = Math.abs(l1 - l2) + 1e-6;
  let d = Math.hypot(u, v);
  const ang = Math.atan2(v, u);
  d = Math.min(maxReach, Math.max(minReach, d));
  // Law of cosines: angle at the hip between the hip→target line and bone 1.
  const cosA = (d * d + l1 * l1 - l2 * l2) / (2 * d * l1);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  let th1 = ang + a;                    // knee above the hip→target line
  let kneeU = Math.cos(th1) * l1, kneeV = Math.sin(th1) * l1;
  let th2 = Math.atan2(d * Math.sin(ang) - kneeV, d * Math.cos(ang) - kneeU);
  if (snap > 0) {
    const s = (snap * Math.PI) / 180;
    th1 = Math.round(th1 / s) * s;
    th2 = Math.round(th2 / s) * s;
    kneeU = Math.cos(th1) * l1; kneeV = Math.sin(th1) * l1;
  }
  return { kneeU, kneeV, footU: kneeU + Math.cos(th2) * l2, footV: kneeV + Math.sin(th2) * l2, th1, th2 };
}

// --- gait ---------------------------------------------------------------------------------------------------
export const STANCE = 0.6; // fraction of the cycle a foot is on the ground

/** Alternating pairs: the two sides are half a cycle apart, and successive pairs alternate again. */
export function limbPhaseOffset(pair: number, side: 1 | -1): number {
  return (((pair & 1) + (side > 0 ? 0 : 1)) & 1) * 0.5;
}

/**
 * Foot offset in the body frame at gait phase `phase` (any real number; only the fraction counts). During stance the
 * foot sweeps from +stride to −stride (planted: the body moves over it); during swing it returns, lifted by up to
 * `lift`. Returns the forward offset dx and the height above ground dy.
 */
export function gaitFoot(phase: number, stride: number, lift: number): { dx: number; dy: number } {
  const p = phase - Math.floor(phase);
  if (p < STANCE) return { dx: stride * (1 - (2 * p) / STANCE), dy: 0 };
  const q = (p - STANCE) / (1 - STANCE);
  return { dx: -stride + 2 * stride * q, dy: lift * Math.sin(Math.PI * q) };
}

// --- body motion by locomotion mode ---------------------------------------------------------------------------
/** Swim wave: lateral offset for a bead at body position xn (0 tail … 1 head). The tail swings most, the head least. */
export function swimWave(xn: number, t: number, amp: number, freq = 1.1, waves = 1): number {
  const env = 0.25 + 0.75 * (1 - xn);
  return amp * env * Math.sin(2 * Math.PI * (xn * waves - freq * t));
}

/** Bell pulse: radial scale factor around 1. */
export function bellPulse(t: number, phase: number, depth = 0.1, freq = 1.2): number {
  return 1 + depth * Math.sin(2 * Math.PI * freq * t + phase);
}

/** Sessile sway: lateral offset that grows with the square of relative height hn (0 base … 1 top). */
export function swayOffset(hn: number, t: number, phase: number, amp: number): number {
  return amp * hn * hn * Math.sin(0.7 * t + phase);
}
