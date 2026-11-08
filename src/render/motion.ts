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
 * Beached swimmers are drawn with their stroke frozen, so a fish is never drawn swimming in the air. Pass `out` to reuse
 * one result object (the per-frame caller does: nothing is allocated).
 */
export function swimY(
  ground: number, sea: number, lo: number, hi: number,
  out: { y0: number; beached: boolean } = { y0: 0, beached: false }, margin = SWIM_MARGIN,
): { y0: number; beached: boolean } {
  const rest = ground - lo; // body bottom on the ground
  if (!(sea > ground)) { out.y0 = rest; out.beached = true; return out; }
  const floor = rest - SWIM_EMBED * Math.max(0, hi - lo);
  const cap = sea - margin - hi;
  if (cap < floor) { out.y0 = floor; out.beached = true; return out; }
  out.y0 = Math.max(floor, Math.min(cap, ground + (sea - ground) * 0.35)); out.beached = false;
  return out;
}

/** Least water depth (m) over the seabed at which swimY can draw a body spanning lo … hi without beaching it. */
export function swimNeed(lo: number, hi: number, margin = SWIM_MARGIN): number {
  return margin + (1 - SWIM_EMBED) * Math.max(0, hi - lo);
}

const NUDGE_STEPS = 4;
const NUDGE_EPS = 0.5; // m: the finite-difference step for the downhill gradient

/**
 * A swimmer whose exact ground is too shallow for its body (the sim's liquid test is per 6.25 m cell, so near the shore
 * the ground under the fish itself can be dry) walks downhill in NUDGE_STEPS equal steps up to maxDist, stopping at the
 * first point with at least `need` metres of water. Writes the offset to out and returns true, or writes 0 and returns
 * false when nothing within maxDist is deep enough (the caller beaches it). At most 1 + 3·NUDGE_STEPS height samples;
 * allocates nothing.
 */
export function nudgeToWater(
  x: number, z: number, sea: number, need: number, heightAt: (x: number, z: number) => number, maxDist: number,
  out: { dx: number; dz: number },
): boolean {
  out.dx = 0; out.dz = 0;
  let h = heightAt(x, z);
  if (sea - h >= need) return true;
  const step = maxDist / NUDGE_STEPS;
  let cx = x, cz = z;
  for (let k = 0; k < NUDGE_STEPS; k++) {
    const gx = (heightAt(cx + NUDGE_EPS, cz) - h) / NUDGE_EPS, gz = (heightAt(cx, cz + NUDGE_EPS) - h) / NUDGE_EPS;
    const g = Math.hypot(gx, gz);
    if (!(g > 1e-6)) break; // flat (or NaN): no downhill to follow
    cx -= (gx / g) * step; cz -= (gz / g) * step;
    h = heightAt(cx, cz);
    if (sea - h >= need) { out.dx = cx - x; out.dz = cz - z; return true; }
  }
  return false;
}

// --- hunting: attack pose, strike and the kill animation (render-only illustration) ----------------------------
/** Diet at which an animal reads as a hunter for the attack pose (the creatureLayout jaw ramps in from 0.35 to 0.75). */
export const HUNTER_DIET = 0.6;
/** Intent codes in the organism buffer (layout v4): what the utility loop chose this tick. */
export const INTENT = { forage: 0, hunt: 1, flee: 2, home: 3, rest: 4, bud: 5 } as const;

const smooth01 = (x: number) => { const k = x <= 0 ? 0 : x >= 1 ? 1 : x; return k * k * (3 - 2 * k); };

/**
 * How open a creature's attack pose wants to be, 0..1. With the sim's intent (−1 when the buffer has none): hunting
 * opens fully, scaled by closeness to the target when known (`targetBL`, distance in body lengths; Infinity unknown).
 * Without intent, a stand-in: a hunter (diet ≥ HUNTER_DIET) opens with speed (`speedBL`, body lengths per second).
 */
export function attackTarget(diet: number, speedBL: number, intent = -1, targetBL = Infinity): number {
  if (intent >= 0) {
    if (intent !== INTENT.hunt) return 0;
    return Number.isFinite(targetBL) ? 0.35 + 0.65 * smooth01((5 - targetBL) / 4) : 1;
  }
  if (diet < HUNTER_DIET) return 0;
  return 0.6 * smooth01((speedBL - 0.25) / 0.75);
}

/** Ease `cur` toward `target`: quick to open (0.12 s), slower to close (0.35 s), frame-rate independent. */
export function easeAttack(cur: number, target: number, dt: number): number {
  const tau = target > cur ? 0.12 : 0.35;
  return target + (cur - target) * Math.exp(-Math.max(0, dt) / tau);
}

/** A strike when a kill lands for this hunter: a sharp snap-and-lunge pulse 0..1 over STRIKE_SEC, 0 outside it. */
export const STRIKE_SEC = 0.35;
export function strikePulse(age: number): number {
  if (!(age >= 0) || age >= STRIKE_SEC) return 0;
  const u = age / STRIKE_SEC;
  return u < 0.25 ? smooth01(u / 0.25) : 1 - smooth01((u - 0.25) / 0.75);
}

/** Jaw gape in radians at attack a (0 closed). */
export const JAW_OPEN_RAD = 0.75;
/**
 * Open a jaw: rotate the tip (tx, ty) about the hinge (hx, hy) in the body's x–y plane by `ang` radians, downward
 * (the lower jaw drops). Writes the new tip into out[0..1]; the hinge–tip distance is kept, so the tip stays attached.
 */
export function jawTip(hx: number, hy: number, tx: number, ty: number, ang: number, out: { 0: number; 1: number }): void {
  const dx = tx - hx, dy = ty - hy, c = Math.cos(ang), s = Math.sin(ang);
  out[0] = hx + dx * c + dy * s; out[1] = hy - dx * s + dy * c;
}

/** The kill animation's length: flash → collapse → burst → fade, done by KILL_SEC. */
export const KILL_SEC = 1.2;
export interface KillFrame { flash: number; collapse: number; burst: number; alpha: number; done: boolean }
/** The prey's kill timeline at `age` seconds since the kill (writes into `out`). */
export function killFrame(age: number, out: KillFrame): KillFrame {
  const a = Math.max(0, age);
  out.flash = a < 0.06 ? a / 0.06 : Math.max(0, 1 - (a - 0.06) / 0.24);   // a bright pulse in the first 0.3 s
  out.collapse = smooth01((a - 0.05) / 0.55);                              // falls over between 0.05 and 0.6 s
  out.burst = a < 0.1 ? 0 : Math.min(1, (a - 0.1) / 0.6);                   // fragments fly 0.1 → 0.7 s
  out.alpha = 1 - smooth01((a - 0.45) / (KILL_SEC - 0.45));                 // fades out from 0.45 s, gone at KILL_SEC
  out.done = a >= KILL_SEC;
  return out;
}

/** A darting yaw wobble (rad) for a fleeing animal: two incommensurate sines, so it reads as panic, not a wag. */
export function fleeWobble(t: number, phase: number, amp = 0.22): number {
  return amp * (0.65 * Math.sin(13 * t + phase) + 0.35 * Math.sin(29 * t + 2.3 * phase));
}
