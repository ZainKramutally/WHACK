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

/** A path the swimmer's head travels: a point and unit tangent at distance s (the app feeds a straight one per animal).
 *  The pose copies what at() returns before calling it again, so an implementation may reuse one return object. */
export interface Path { at(s: number): { p: V3; t: V3 }; length: number }

// In-place forms for the per-frame pose (build.ts): each writes into `o` and returns it, allocating nothing. `o` may be
// one of the inputs (every component is computed before any is written). Same operation order as the tuple helpers,
// so results match them to the last bit or two.
export const v3 = (): V3 => [0, 0, 0];
export const set3 = (o: V3, x: number, y: number, z: number): V3 => { o[0] = x; o[1] = y; o[2] = z; return o; };
export const copy3 = (o: V3, a: V3): V3 => set3(o, a[0], a[1], a[2]);
export const add3 = (o: V3, a: V3, b: V3): V3 => set3(o, a[0] + b[0], a[1] + b[1], a[2] + b[2]);
export const sub3 = (o: V3, a: V3, b: V3): V3 => set3(o, a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const scl3 = (o: V3, a: V3, s: number): V3 => set3(o, a[0] * s, a[1] * s, a[2] * s);
/** o = a + b·s */
export const madd3 = (o: V3, a: V3, b: V3, s: number): V3 => set3(o, a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s);
export const cross3 = (o: V3, a: V3, b: V3): V3 => set3(o, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
/** Length by sqrt (Math.hypot guards overflow we never reach, at several times the cost). */
export const len3 = (a: V3): number => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
export const norm3 = (o: V3, a: V3): V3 => { const l = len3(a) || 1; return set3(o, a[0] / l, a[1] / l, a[2] / l); };
export const lerp3o = (o: V3, a: V3, b: V3, t: number): V3 => set3(o, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
/** o = v with its component along unit `t` removed (a − t·(a·t)). */
export const reject3 = (o: V3, a: V3, t: V3): V3 => { const d = dot(a, t); return set3(o, a[0] - t[0] * d, a[1] - t[1] * d, a[2] - t[2] * d); };
/** Rotate v about unit axis k by angle a (Rodrigues), into o. */
export const rotate3 = (o: V3, v: V3, k: V3, a: number): V3 => rotate3cs(o, v, k, Math.cos(a), Math.sin(a));
/** rotate3 with the angle's cosine and sine precomputed (many rotations by one angle). */
export const rotate3cs = (o: V3, v: V3, k: V3, c: number, s: number): V3 => {
  const cx = k[1] * v[2] - k[2] * v[1], cy = k[2] * v[0] - k[0] * v[2], cz = k[0] * v[1] - k[1] * v[0];
  const d = dot(k, v) * (1 - c);
  return set3(o, v[0] * c + cx * s + k[0] * d, v[1] * c + cy * s + k[1] * d, v[2] * c + cz * s + k[2] * d);
};
