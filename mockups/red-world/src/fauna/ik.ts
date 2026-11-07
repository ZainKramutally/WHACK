// Pure locomotion maths: 2-bone IK (law of cosines), gait phase offsets, and distance-driven foot planting.
// Feet are planted at fixed world points spaced exactly one stride apart along the body's path, and the gait phase is
// distance / stride, so a foot in stance never moves (no sliding at any speed, including stops and turns).
import { add, cross, dot, len, lerp3, norm, scl, sub, type V3 } from '../flora/mesh';
import type { Gait } from './develop';

export interface IKResult { knee: V3; foot: V3; reached: boolean }

/**
 * Analytic 2-bone IK. Hip at `hip`, bone lengths a (upper) and b (lower), target foot `target`, knee bends toward `pole`.
 * The hip→foot distance is clamped to [|a − b| + ε, a + b − ε], so the chain never overstretches or folds through itself.
 */
export function twoBoneIK(hip: V3, target: V3, a: number, b: number, pole: V3): IKResult {
  const d0 = sub(target, hip);
  const dist = len(d0) || 1e-9;
  const dir = scl(d0, 1 / dist);
  const lo = Math.abs(a - b) + 1e-4, hi = a + b - 1e-4;
  const d = Math.min(hi, Math.max(lo, dist));
  // angle at the hip between hip→foot and the upper bone
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  // bend plane: the component of the pole perpendicular to dir
  let bend = sub(pole, scl(dir, dot(pole, dir)));
  if (len(bend) < 1e-6) bend = norm(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  bend = norm(bend);
  const knee = add(hip, add(scl(dir, a * cosA), scl(bend, a * sinA)));
  const foot = add(hip, scl(dir, d));
  return { knee, foot, reached: dist <= hi && dist >= lo };
}

/** Phase offset (0..1) of leg `pair` on `side` (−1 left, +1 right) for a gait (F §3.5). */
export function legPhase(gait: Gait, pair: number, pairs: number, side: -1 | 1): number {
  const s = side > 0 ? 0.5 : 0;
  if (gait === 'hop') return 0;                                   // both rear legs together
  if (gait === 'trot') return (s + pair * 0.5) % 1;               // diagonal pairs: LF+RH, RF+LH
  if (gait === 'wave') return (s + pair * (pairs === 3 ? 0.5 : 1 / pairs)) % 1; // 3 pairs = tripod, more = metachronal
  return 0;
}

export interface FootState { pos: V3; stance: boolean; swing: number } // swing 0..1 within the swing phase

/**
 * Foot position from the gait phase p = distance / stride + legOffset. Plant k sits under the hip at mid-stance of cycle k:
 * `plant(k)` must return that world point. Stance: fixed at plant(k). Swing: an arc from plant(k) to plant(k + 1).
 */
export function footAt(p: number, duty: number, plant: (k: number) => V3, lift: number): FootState {
  const k = Math.floor(p), phi = p - k;
  if (phi < duty) return { pos: plant(k), stance: true, swing: 0 };
  const u = (phi - duty) / (1 - duty);
  const e = u * u * (3 - 2 * u);
  const pos = lerp3(plant(k), plant(k + 1), e);
  pos[1] += lift * Math.sin(Math.PI * u);
  return { pos, stance: false, swing: u };
}

/** Path distance at which plant k is placed (mid-stance of cycle k) for a leg with this offset. */
export const plantDistance = (k: number, stride: number, duty: number, offset: number) => (k + duty / 2 - offset) * stride;
