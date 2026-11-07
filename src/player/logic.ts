// Pure player maths: no three.js, no DOM. Everything here is unit-tested.

export type PlayerMode = 'walk' | 'swim';

/** Radial dead zone with rescaling: 0 inside `dz`, ramps to 1 at full deflection. */
export function applyDeadZone(x: number, y: number, dz = 0.18): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag <= dz) return [0, 0];
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  return [(x / mag) * scaled, (y / mag) * scaled];
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Frame-rate independent critically damped smoothing (Unity's SmoothDamp). Returns [value, velocity]. */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): [number, number] {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const newVel = (velocity - omega * temp) * exp;
  return [target + (change + temp) * exp, newVel];
}

/** Exponential ease of `v` toward `target` with time constant `tau` seconds (frame-rate independent). */
export function approach(v: number, target: number, tau: number, dt: number): number {
  return target + (v - target) * Math.exp(-dt / Math.max(0.0001, tau));
}

/** Shortest signed angle difference a→b in (-π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// --- walk / swim -----------------------------------------------------------------------------

/** Water deeper than this (metres, over the ground) is swum, not waded. */
export const WADE_DEPTH = 1.3;
/** Back to walking once the water over the ground is shallower than this (hysteresis). */
export const STAND_DEPTH = 1.0;

export interface ModeInput {
  mode: PlayerMode;
  ground: number;     // terrain height under the player
  seaLevel: number;
  frozen: boolean;
}

/**
 * Walk vs swim. Frozen seas are solid, so always walk (on max(ground, seaLevel)).
 * Liquid seas: swim once the water over the ground is deeper than WADE_DEPTH, and walk again
 * only below STAND_DEPTH. A sea that melts under a walker on the ice therefore flips to swim.
 */
export function decideMode(i: ModeInput): PlayerMode {
  if (i.frozen) return 'walk';
  const depth = i.seaLevel - i.ground;
  if (i.mode === 'swim') return depth < STAND_DEPTH ? 'walk' : 'swim';
  return depth > WADE_DEPTH ? 'swim' : 'walk';
}

/** The height the player stands on: the ground, or the ice surface on a frozen sea. */
export function walkFloor(ground: number, seaLevel: number, frozen: boolean): number {
  return frozen ? Math.max(ground, seaLevel) : ground;
}

// --- click vs drag ---------------------------------------------------------------------------

/** Pixels of pointer travel after which a press counts as a camera drag, not a click. */
export const DRAG_THRESHOLD_PX = 5;

export interface DragState {
  startX: number;
  startY: number;
  dragging: boolean;
}

export function dragStart(x: number, y: number): DragState {
  return { startX: x, startY: y, dragging: false };
}

/** Marks the press as a drag once it has moved past the threshold; stays a drag. */
export function dragMove(s: DragState, x: number, y: number, threshold = DRAG_THRESHOLD_PX): DragState {
  if (s.dragging) return s;
  return Math.hypot(x - s.startX, y - s.startY) > threshold ? { ...s, dragging: true } : s;
}

/** On release: was it a click (inspect) or the end of a drag (orbit)? */
export function dragEnd(s: DragState, x: number, y: number, threshold = DRAG_THRESHOLD_PX): 'click' | 'drag' {
  return dragMove(s, x, y, threshold).dragging ? 'drag' : 'click';
}
