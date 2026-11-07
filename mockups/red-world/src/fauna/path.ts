// Ground paths the creatures walk. A path maps a distance s (any real, wraps for loops) to a point and unit tangent on y = 0.
import type { V3 } from '../flora/mesh';

export interface Path { at(s: number): { p: V3; t: V3 }; length: number }

/** Stadium loop: two straights of length 2·a along x joined by half-circles of radius b, centred at (cx, cz). */
export function stadium(cx: number, cz: number, a: number, b: number): Path {
  const arc = Math.PI * b, L = 4 * a + 2 * arc;
  return {
    length: L,
    at(s) {
      let u = ((s % L) + L) % L;
      if (u < 2 * a) return { p: [cx - a + u, 0, cz + b], t: [1, 0, 0] };              // near straight, heading +x
      u -= 2 * a;
      if (u < arc) { const th = u / b; return { p: [cx + a + Math.sin(th) * b, 0, cz + Math.cos(th) * b], t: [Math.cos(th), 0, -Math.sin(th)] }; }
      u -= arc;
      if (u < 2 * a) return { p: [cx + a - u, 0, cz - b], t: [-1, 0, 0] };
      u -= 2 * a;
      const th = u / b;
      return { p: [cx - a - Math.sin(th) * b, 0, cz - Math.cos(th) * b], t: [-Math.cos(th), 0, Math.sin(th)] };
    },
  };
}

/** Straight line through (x0, z0) heading +x forever. */
export function line(x0: number, z0: number): Path {
  return { length: Infinity, at: (s) => ({ p: [x0 + s, 0, z0], t: [1, 0, 0] }) };
}
