// Copied from mockups/red-world/src/fauna/aquatic/ (never imported; docs/features/aquatic-life.md). Edits for the app: imports only.
// Swimming kinematics, closed-form so the app can move them into a TSL positionNode unchanged.
//   wave (carbon, axial): a travelling body wave lat(u, t) = L·A(u)·sin(2π(f·t − u/λ)), crest running nose → tail at
//     c = λ·L·f. The animal advances at V = slip·c (slip 0.6–0.8 as in real fish), so the body never slides.
//     A(u) blends carangiform (rear third only) and anguilliform (whole body). Fin fringes ripple at the same wave speed.
//   row (silicon hub): arms sweep from 45° to 135° off the travel axis in stepped 15° beats (power), then fold and
//     swing forward (recovery). The hub advances D per stroke, mostly during the power phase.
//   jet (silicon bell / chain): bells contract fast (30% of the cycle) and refill slowly; each pulse moves D; a chain's
//     bells pulse in sequence so the colony moves smoothly.
// Distances along the path come from advance(), so speed and stroke can never disagree.
import type { SwimmerParams } from './params';

export type MotionKind = 'wave' | 'row' | 'jet';
export interface Kinematics {
  kind: MotionKind;
  freq: number;      // Hz: body wave, stroke or pulse frequency
  cycle: number;     // s: 1 / freq
  lambda: number;    // body wavelength in body lengths (wave)
  ampTail: number;   // tail amplitude ÷ length (wave)
  slip: number;      // V ÷ wave speed (wave)
  waveSpeed: number; // m/s (wave): λ·L·f
  finLambda: number; // fin ripple wavelength in body lengths
  finFreq: number;   // Hz: chosen so the fin ripple travels at waveSpeed too
  stroke: number;    // m advanced per stroke / pulse cycle (row, jet)
  speed: number;     // m/s mean travel speed
  sweep: [number, number]; // row: arm angle off the forward axis, degrees (power stroke from [0] to [1])
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const cl = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const STEP_DEG = 15;

export function kinematics(p: SwimmerParams): Kinematics {
  const L = p.length;
  if (p.chemistry === 'silicon' && p.plan === 'radial') {
    const freq = cl(0.95 * L ** -0.4, 0.25, 2.2);
    const sweep: [number, number] = [45, 135];
    const arm = p.radial.armLen * L;
    // oar geometry: the tip sweeps 2·sin(45°)·arm along the axis per power stroke; ~0.55 of it becomes travel
    const stroke = 0.55 * arm * (Math.cos((sweep[0] * Math.PI) / 180) - Math.cos((sweep[1] * Math.PI) / 180));
    return { kind: 'row', freq, cycle: 1 / freq, lambda: 0, ampTail: 0, slip: 0, waveSpeed: 0, finLambda: 0, finFreq: 0, stroke, speed: stroke * freq, sweep };
  }
  if (p.chemistry === 'silicon') {
    const freq = cl(0.75 * L ** -0.35, 0.2, 1.4);
    const stroke = 0.32 * L * (1 + 0.2 * (p.radial.chain - 1));
    return { kind: 'jet', freq, cycle: 1 / freq, lambda: 0, ampTail: 0, slip: 0, waveSpeed: 0, finLambda: 0, finFreq: 0, stroke, speed: stroke * freq, sweep: [0, 0] };
  }
  const u = p.undulation, fr = p.fins.fringe;
  const freq = cl(1.5 * L ** -0.45 * (1 - 0.3 * fr), 0.25, 4);
  const lambda = mix(1.05, 0.65, u);
  const ampTail = mix(0.17, 0.1, u) * (1 - 0.7 * fr);
  const slip = mix(0.78, 0.66, u);
  const waveSpeed = lambda * L * freq;
  const finLambda = p.fins.lateral >= 3 ? 0.55 : 0.4;
  return {
    kind: 'wave', freq, cycle: 1 / freq, lambda, ampTail, slip, waveSpeed,
    finLambda, finFreq: waveSpeed / (finLambda * L), stroke: slip * waveSpeed / freq, speed: slip * waveSpeed, sweep: [0, 0],
  };
}

/** Body-wave envelope A(u) ÷ ampTail, u = 0 nose … 1 tail: carangiform (u = 0) ↔ anguilliform (u = 1) blend. */
export function envelope(u: number, undulation: number): number {
  const car = 0.06 + 0.94 * u ** 2.6;
  const ang = 0.3 + 0.7 * u;
  return mix(car, ang, undulation);
}

/** Lateral body offset ÷ length at body position u, time t (phase in radians). */
export function bodyWave(k: Kinematics, undulation: number, u: number, t: number, phase = 0): number {
  return k.ampTail * envelope(u, undulation) * Math.sin(2 * Math.PI * (k.freq * t - u / k.lambda) + phase);
}

/** Fin ripple angle (radians) at body position u: a backward-travelling wave at the body's wave speed. */
export function finRipple(k: Kinematics, u: number, t: number, amp: number, phase = 0): number {
  return amp * Math.sin(2 * Math.PI * (k.finFreq * t - u / k.finLambda) + phase);
}

const ss = (x: number) => { const t = cl(x, 0, 1); return t * t * (3 - 2 * t); };
/** Share of one stroke's distance covered by phase φ ∈ [0, 1): mostly in the power phase (row) or contraction (jet). */
export function strokeProgress(kind: MotionKind, phi: number): number {
  const power = kind === 'row' ? 0.5 : 0.3, gain = kind === 'row' ? 0.8 : 0.82;
  if (phi < power) return gain * ss(phi / power);
  const x = (phi - power) / (1 - power);
  return gain + (1 - gain) * (1 - (1 - x) * (1 - x)); // coast: decelerating glide
}

/**
 * Distance along the path at time t. Wave swimmers: V·t. Rowers and bells: whole strokes plus the progress through the
 * current one, averaged over a chain's staggered bells (each pulses 1/n of a cycle after the one ahead).
 */
export function advance(k: Kinematics, t: number, phase = 0, bells = 1): number {
  if (k.kind === 'wave') return k.speed * t;
  let s = 0;
  for (let b = 0; b < bells; b++) {
    const c = k.freq * t + phase - b / bells;
    s += Math.floor(c) + strokeProgress(k.kind, c - Math.floor(c));
  }
  return (k.stroke * s) / bells;
}

/** Arm angle off the forward axis (degrees) through a row cycle, snapped into 15° beats with a quick 0.08-cycle ease
 *  between beats; recovery folds the arm forward in fewer, bigger snaps. `out` (optional) is filled and returned, so
 *  the per-frame pose allocates nothing. */
export function armAngle(k: Kinematics, phi: number, out: { deg: number; fold: number } = { deg: 0, fold: 0 }): { deg: number; fold: number } {
  const a0 = k.sweep[0], a1 = k.sweep[1];
  if (phi < 0.5) {
    const cont = a0 + (a1 - a0) * (phi / 0.5);
    const beats = (cont - a0) / STEP_DEG;
    const i = Math.floor(beats), f = beats - i;
    const deg = a0 + STEP_DEG * (i + ss((f - 0.72) / 0.28));
    out.deg = Math.min(a1, deg); out.fold = 0;
    return out;
  }
  const x = (phi - 0.5) / 0.5;
  const steps = (a1 - a0) / (2 * STEP_DEG); // recovery: double-width beats
  const beats = x * steps, i = Math.floor(beats), f = beats - i;
  const deg = a1 - 2 * STEP_DEG * (i + ss((f - 0.6) / 0.4));
  out.deg = Math.max(a0, deg); out.fold = Math.sin(Math.PI * x);
  return out;
}

/** Bell rim radius factor through a pulse: quick contraction to 0.72, slow refill. */
export function bellPulse(phi: number): number {
  return phi < 0.3 ? 1 - 0.28 * Math.sin((Math.PI / 2) * (phi / 0.3)) : 0.72 + 0.28 * ss((phi - 0.3) / 0.7);
}
