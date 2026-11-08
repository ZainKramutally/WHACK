// Small vector helpers for the aquatic swimmers (copied from the Red World mockup's flora/mesh.ts, never imported).
export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scl = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Rotate v about unit axis k by angle a (Rodrigues). */
export const rotate = (v: V3, k: V3, a: number): V3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(scl(v, c), scl(cross(k, v), s)), scl(k, dot(k, v) * (1 - c)));
};

/** A path the swimmer's head travels: a point and unit tangent at distance s (the app feeds a straight one per animal). */
export interface Path { at(s: number): { p: V3; t: V3 }; length: number }
