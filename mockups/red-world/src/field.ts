// Pure terrain field: height + ground data. No three.js (unit-tested).
import { fbm, smoothstep } from './rng';
import { RIVER, RIVER_HALF_WIDTH, BASIN } from './layout';

const SEED = 7;

/** Distance to the river polyline and the arc-length fraction (0 at camera end, 1 at hero). */
export function riverDist(x: number, z: number): { d: number; t: number } {
  let best = Infinity, bestT = 0, acc = 0;
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const l = Math.hypot(RIVER[i + 1][0] - RIVER[i][0], RIVER[i + 1][1] - RIVER[i][1]);
    lens.push(l); total += l;
  }
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const dx = bx - ax, dz = bz - az;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const px = ax + dx * u, pz = az + dz * u;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bestT = (acc + u * lens[i]) / total; }
    acc += lens[i];
  }
  return { d: best, t: bestT };
}

/** Local half-width of the bed: narrow near the hero, wider at the near end (perspective-friendly). */
export const riverHalfWidth = (t: number) => RIVER_HALF_WIDTH * (1.25 - 0.55 * t);

/** Ground height before the riverbed carve. */
export function baseHeight(x: number, z: number): number {
  const camD = Math.hypot(x, z);
  let h = 0;
  h += 1.5 * (1 - smoothstep(8, 70, camD));                                      // camera rise
  h -= BASIN.depth * (1 - smoothstep(BASIN.radius * 0.25, BASIN.radius, Math.hypot(x - BASIN.x, z - BASIN.z)));
  h += fbm(x / 520, z / 520, 4, SEED) * 13 * smoothstep(80, 600, camD);            // broad swells away from camera
  h += Math.max(0, fbm(x / 260, z / 180, 3, SEED + 5)) * 34 * smoothstep(520, 1100, camD) * (1 - smoothstep(2500, 4000, camD)); // far dune ridges
  h += Math.max(0, fbm(x / 70, z / 45, 3, SEED + 6)) * 11 * smoothstep(160, 300, camD) * (1 - smoothstep(520, 720, camD)); // hummocks break the crest
  h += fbm(x / 110, z / 110, 4, SEED + 3) * 3.2;                                    // medium ripples
  h += fbm(x / 22, z / 22, 3, SEED + 9) * 0.55;                                     // small lumps
  h += smoothstep(600, 4500, -z) * 70;                                              // far ground rises into the ranges
  return h;
}

export function heightAt(x: number, z: number): number {
  const h = baseHeight(x, z);
  const { d, t } = riverDist(x, z);
  if (d > 40) return h;
  const w = riverHalfWidth(t);
  const carve = 2.6 * (1 - smoothstep(w * 0.55, w * 1.35, d));
  const bank = 0.6 * smoothstep(w * 1.1, w * 1.6, d) * (1 - smoothstep(w * 1.6, w * 3.2, d));
  return h - carve + bank;
}

/** Ground data per point, each 0..1: [riverbed mask, hollow (crimson), sunlit variation, river arc fraction]. */
export function groundData(x: number, z: number): [number, number, number, number] {
  const { d, t } = riverDist(x, z);
  const w = riverHalfWidth(t);
  const river = 1 - smoothstep(w * 0.75, w * 1.05, d);
  const hollow = Math.max(0, Math.min(1, 0.5 - fbm(x / 60, z / 60, 3, SEED + 21) * 1.4)) * (1 - river);
  const vary = Math.max(0, Math.min(1, 0.5 + fbm(x / 35, z / 35, 3, SEED + 33)));
  return [river, hollow, vary, t];
}
