// Pure terrain field: height + ground data. No three.js (unit-tested).
import { fbm, smoothstep } from './rng';
import { RIVER_HALF_WIDTH, RIVERS, BASIN, HOLLOW } from './layout';

const SEED = 7;

// Precomputed segments of every river (bbox-rejected so the 2048² ground texture and the terrain build stay fast).
const CUT = 80; // beyond this distance nobody cares about the exact value
const SEGS = RIVERS.flatMap((r, ri) => {
  const lens = r.pts.slice(1).map((p, i) => Math.hypot(p[0] - r.pts[i][0], p[1] - r.pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  return lens.map((l, i) => {
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
    const seg = { ri, ax, az, dx: bx - ax, dz: bz - az, f0: acc / total, f1: (acc + l) / total,
      x0: Math.min(ax, bx) - CUT, x1: Math.max(ax, bx) + CUT, z0: Math.min(az, bz) - CUT, z1: Math.max(az, bz) + CUT };
    acc += l;
    return seg;
  });
});

/**
 * Nearest dry river: distance d (capped near CUT), bed-brightness fraction t (main river: 0 at the camera end, 1 at the hero)
 * and local half-width w.
 */
export function riverDist(x: number, z: number): { d: number; t: number; w: number } {
  let best = CUT + 1, bt = 0, bw = RIVERS[0].w0;
  for (const s of SEGS) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    const u = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / (s.dx * s.dx + s.dz * s.dz)));
    const d = Math.hypot(x - s.ax - s.dx * u, z - s.az - s.dz * u);
    if (d < best) {
      const r = RIVERS[s.ri], f = s.f0 + (s.f1 - s.f0) * u;
      best = d; bt = r.t0 + (r.t1 - r.t0) * f; bw = r.w0 + (r.w1 - r.w0) * f;
    }
  }
  return { d: best, t: bt, w: bw };
}

/** Half-width of the main bed at fraction t: wider at the near end (perspective-friendly). */
export const riverHalfWidth = (t: number) => RIVER_HALF_WIDTH * (1.25 - 0.55 * t);

/** Ground height before the riverbed carve. */
export function baseHeight(x: number, z: number): number {
  const camD = Math.hypot(x, z);
  let h = 0;
  h += 1.5 * (1 - smoothstep(8, 70, camD));                                      // camera rise
  h -= BASIN.depth * (1 - smoothstep(BASIN.radius * 0.25, BASIN.radius, Math.hypot(x - BASIN.x, z - BASIN.z)));
  h -= HOLLOW.depth * (1 - smoothstep(HOLLOW.radius * 0.3, HOLLOW.radius, Math.hypot(x - HOLLOW.x, z - HOLLOW.z)));
  h += fbm(x / 520, z / 520, 4, SEED) * 13 * smoothstep(80, 600, camD);            // broad swells away from camera
  h += Math.max(0, fbm(x / 260, z / 180, 3, SEED + 5)) * 34 * smoothstep(520, 1100, camD) * (1 - smoothstep(2500, 4000, camD)); // far dune ridges
  h += Math.max(0, fbm(x / 70, z / 45, 3, SEED + 6)) * 11 * smoothstep(160, 300, camD) * (1 - smoothstep(520, 720, camD)); // hummocks break the crest
  {
    // a low wind-cut fold on the right bank in the hero frame's bottom-right: its lit crest breaks the dark foreground
    const ax = 4, az = -4, bx = 22, bz = -34, dx = bx - ax, dz = bz - az;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const dl = Math.hypot(x - ax - dx * u, z - az - dz * u);
    if (dl < 8) h += 1.3 * Math.sin(Math.PI * u) ** 0.6 * Math.max(0, 1 - dl / 3.2) ** 1.5;
  }
  h += fbm(x / 110, z / 110, 4, SEED + 3) * 3.2;                                    // medium ripples
  h += fbm(x / 22, z / 22, 3, SEED + 9) * 0.55;                                     // small lumps
  h += smoothstep(600, 4500, camD) * 70;                                              // far ground rises into the ranges
  return h;
}

export function heightAt(x: number, z: number): number {
  const h = baseHeight(x, z);
  const { d, w } = riverDist(x, z);
  if (d > 40) return h;
  const carve = 2.6 * (1 - smoothstep(w * 0.55, w * 1.35, d));
  const bank = 0.6 * smoothstep(w * 1.1, w * 1.6, d) * (1 - smoothstep(w * 1.6, w * 3.2, d));
  return h - carve + bank;
}

/** Ground data per point, each 0..1: [riverbed mask, hollow (crimson), sunlit variation, river arc fraction]. */
export function groundData(x: number, z: number): [number, number, number, number] {
  const { d, t, w } = riverDist(x, z);
  const river = 1 - smoothstep(w * 0.75, w * 1.05, d);
  const hollow = Math.max(0, Math.min(1, 0.5 - fbm(x / 60, z / 60, 3, SEED + 21) * 1.4)) * (1 - river);
  const vary = Math.max(0, Math.min(1, 0.5 + fbm(x / 35, z / 35, 3, SEED + 33)));
  return [river, hollow, vary, t];
}
