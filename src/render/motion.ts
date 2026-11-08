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

/**
 * Step timing per leg. Quadrupeds (legPairs 2, pair 0 hind) walk a lateral sequence: left hind, left fore, right hind,
 * right fore, a quarter cycle apart. Others alternate: the two sides half a cycle apart, successive pairs alternating
 * again (a hexapod's tripod, a biped's left-right).
 */
export function limbPhaseOffset(pair: number, side: 1 | -1, legPairs = 0): number {
  if (legPairs === 2) return (side < 0 ? 0.5 : 0) + 0.25 * pair;
  return (((pair & 1) + (side > 0 ? 0 : 1)) & 1) * 0.5;
}

/** Below this many drawn body lengths per second the feet stop stepping and ease to neutral. */
export const IDLE_BL = 0.03;
/** Seconds for the walk weight to ease between standing (0) and walking (1). */
export const WALK_EASE = 0.25;
const G0 = 9.81;

/**
 * Half stride (drawn world metres) at world speed v, for a leg with drawn hip height `hip` and reach `reach`: stride
 * length λ = 2.3·h·Fr^0.3 with Fr = v²/(g·h) (Alexander's dynamic-similarity fit), of which a foot sweeps STANCE·λ/2
 * each side of neutral; capped at 0.4 of the reach. Grows with speed, so faster walkers take longer steps.
 */
export function halfStride(hip: number, reach: number, v: number, gravity = 1): number {
  const h = Math.max(hip, 1e-3);
  const fr = (v * v) / (G0 * gravity * h);
  return Math.min(0.5 * STANCE * 2.3 * h * Math.pow(fr, 0.3), 0.4 * reach);
}

/**
 * One frame of the walking gait. The phase is integrated from the distance the body was drawn moving this frame
 * (`dist`, plus any turn sweep), one cycle per 2·halfStride/STANCE metres, so planted feet never slide; the walk weight
 * eases to 0 when the speed drops under IDLE_BL body lengths a second, and the phase then stops (feet ease to neutral).
 * Cadence is capped at 4 Hz. Returns the half stride used (drawn world metres).
 */
export function gaitStep(
  g: { gait: number; walkW: number }, dist: number, speed: number, L: number, hip: number, reach: number, dt: number, gravity = 1,
): number {
  const k = dt / WALK_EASE;
  g.walkW = speed / Math.max(L, 1e-6) >= IDLE_BL ? Math.min(1, g.walkW + k) : Math.max(0, g.walkW - k);
  const hW = halfStride(hip, reach, speed, gravity);
  if (g.walkW > 0 && hW > 1e-6) g.gait += Math.min(4 * dt, (STANCE * dist) / (2 * hW));
  return hW;
}

/** Turn `cur` toward `target` (radians, shortest arc) by at most `maxStep`. */
export function slewAngle(cur: number, target: number, maxStep: number): number {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return cur + (d > maxStep ? maxStep : d < -maxStep ? -maxStep : d);
}

/** Heading slew limit (rad/s) for a body `L` drawn metres long: long bodies turn slower. */
export const turnRateMax = (L: number) => 2.5 / Math.sqrt(Math.max(L, 0.5) / 5);

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

// --- radial bodies (silicon): arm stances, tripod phases and rolling ---------------------------------------------
/** Tripod stepping: arms alternate in two groups (even folds); an odd-fold body (3, 5) steps its arms in turn. */
export function armPhase(index: number, symmetry: number): number {
  return symmetry % 2 === 1 ? index / symmetry : (index & 1) * 0.5;
}

export type ArmStance = 'spoke' | 'bell' | 'crystal';

/**
 * Foot target of a radial arm relative to its hip, as horizontal distance outward `out` and height `up`.
 * spoke: straight out (the rolling pose); bell: arms hang down and in, pulsing with the bell; crystal: prongs raised
 * and still (a rooted colony). Walking uses gaitFoot instead.
 */
export function armStance(stance: ArmStance, reach: number, t: number, phase: number): { out: number; up: number } {
  if (stance === 'bell') {
    const p = bellPulse(t, phase);
    return { out: 0.55 * reach * p, up: -0.7 * reach * (2 - p) };
  }
  if (stance === 'crystal') return { out: 0.35 * reach, up: 0.85 * reach };
  return { out: 0.9 * reach, up: 0 };
}

/** Roll angle (radians) after travelling `distance` metres: a rolling hub of the given radius turns distance/radius. */
export function rollAngle(distance: number, radius: number): number {
  return distance / Math.max(1e-6, radius);
}

/**
 * Lay a radial (silicon) body along its travel axis: a quarter turn about the lateral (z) axis through the hub centre
 * at height `pivotY`, so the hub's axis points forward (+x) instead of up and the arms radiate around the travel axis,
 * as the near LOD's rower swims (faunaLib/aquatic). In place, on rods (a and b endpoints at offsets 0 and 3 of each
 * `rodStride` record) and eye beads (x, y at offsets 0 and 1 of each `eyeStride` record).
 */
export function layAlongTravel(
  rods: Float32Array, nRods: number, rodStride: number, eyes: Float32Array, nEyes: number, eyeStride: number, pivotY: number,
): void {
  for (let r = 0; r < nRods; r++) { layPoint(rods, r * rodStride, pivotY); layPoint(rods, r * rodStride + 3, pivotY); }
  for (let k = 0; k < nEyes; k++) layPoint(eyes, k * eyeStride, pivotY);
}
/** One point (x, y at a[i], a[i+1]) of layAlongTravel's quarter turn about the lateral axis at height pivotY. */
function layPoint(a: Float32Array, i: number, pivotY: number): void {
  const x = a[i], y = a[i + 1] - pivotY;
  a[i] = y; a[i + 1] = pivotY - x;
}

// --- swimmer depth ----------------------------------------------------------------------------------------
export const SWIM_MARGIN = 0.15; // m (drawn): a swimmer's top stays at least this far under the surface
export const SWIM_EMBED = 0.4;   // a swimmer in water shallower than its body may sink at most this share of its height into the seabed

/**
 * Where a swimmer is drawn. lo and hi are the drawn body's bottom and top above y0 (metres). In water it sits 35% of the
 * way up from the seabed, then is clamped so its top stays SWIM_MARGIN under the surface, sinking at most SWIM_EMBED of
 * its height into the seabed. A swimmer with no water over it (sea ≤ ground, or no sea: pass -Infinity) is beached,
 * lying on the ground; one in water too shallow even with the embed lies on the seabed at the embed limit, beached too.
 * Beached swimmers are drawn with their stroke frozen, so a fish is never drawn swimming in the air.
 */
export function swimY(ground: number, sea: number, lo: number, hi: number, margin = SWIM_MARGIN): { y0: number; beached: boolean } {
  const rest = ground - lo; // body bottom on the ground
  if (!(sea > ground)) return { y0: rest, beached: true };
  const floor = rest - SWIM_EMBED * Math.max(0, hi - lo);
  const cap = sea - margin - hi;
  if (cap < floor) return { y0: floor, beached: true };
  return { y0: Math.max(floor, Math.min(cap, ground + (sea - ground) * 0.35)), beached: false };
}
