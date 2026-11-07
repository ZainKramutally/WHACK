// Pure placement helpers (no three.js): seeded rng, power-law sizes, Thomas cluster process, valley sampling.
import type { Vec2 } from '../contracts';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inverse-CDF sample of pdf ∝ x^-alpha on [min, max]. Few big, many small. */
export function powerLaw(rng: Rng, min: number, max: number, alpha: number): number {
  const u = rng();
  if (Math.abs(alpha - 1) < 1e-6) return min * Math.pow(max / min, u);
  const e = 1 - alpha;
  return Math.pow(Math.pow(min, e) + u * (Math.pow(max, e) - Math.pow(min, e)), 1 / e);
}

export function gauss(rng: Rng): number {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export interface ThomasPoint { x: number; z: number; parent: number; w: number }

export interface ThomasOpts {
  total: number;                       // children to produce
  parents: number;                     // cluster centres
  parentAt: (rng: Rng, i: number) => Vec2;
  alpha?: number;                      // power-law exponent for cluster weights
  wMax?: number;                       // biggest cluster weight relative to smallest (=1)
  sigma: number;                       // gaussian spread of a weight-1 cluster (m); bigger clusters spread by sqrt(w)
}

/** Thomas cluster process: parent points, children gaussian around them, power-law cluster sizes. */
export function thomas(rng: Rng, o: ThomasOpts): ThomasPoint[] {
  const ws: number[] = [];
  const centres: Vec2[] = [];
  for (let i = 0; i < o.parents; i++) {
    ws.push(powerLaw(rng, 1, o.wMax ?? 12, o.alpha ?? 1.6));
    centres.push(o.parentAt(rng, i));
  }
  const sum = ws.reduce((a, b) => a + b, 0);
  // largest-remainder allocation so the total is exact
  const raw = ws.map((w) => (w / sum) * o.total);
  const counts = raw.map(Math.floor);
  let left = o.total - counts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) counts[order[k][1]]++;
  const out: ThomasPoint[] = [];
  for (let i = 0; i < o.parents; i++) {
    const s = o.sigma * Math.sqrt(ws[i]);
    for (let c = 0; c < counts[i]; c++) {
      out.push({ x: centres[i][0] + gauss(rng) * s, z: centres[i][1] + gauss(rng) * s, parent: i, w: ws[i] });
    }
  }
  return out;
}

// ------------------------------------------------------------------ valley polyline

export interface Valley { pts: Vec2[]; cum: number[]; length: number }

export function makeValley(pts: Vec2[]): Valley {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, length: cum[cum.length - 1] || 1 };
}

/** Point at arclength s along the valley plus the left-hand unit normal there. */
export function valleyAt(v: Valley, s: number): { p: Vec2; n: Vec2 } {
  const t = Math.min(Math.max(s, 0), v.length);
  let i = 1;
  while (i < v.cum.length - 1 && v.cum[i] < t) i++;
  const a = v.pts[i - 1], b = v.pts[i];
  const seg = v.cum[i] - v.cum[i - 1] || 1;
  const f = (t - v.cum[i - 1]) / seg;
  const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], n: [-dz, dx] };
}

/** Valley-relative coords → world xz. `lat` is metres to the side of the centreline. */
export function valleyPoint(v: Valley, s: number, lat: number): Vec2 {
  const { p, n } = valleyAt(v, s);
  return [p[0] + n[0] * lat, p[1] + n[1] * lat];
}

/** Distance from (x,z) to the valley centreline polyline. */
export function distToValley(v: Valley, x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < v.pts.length; i++) {
    const [ax, az] = v.pts[i - 1], [bx, bz] = v.pts[i];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** Number of leading (sorted) instances that can be visible at this niche value. */
export function visibleCount(rands: Float32Array, n: number, niche: number): number {
  const x = Math.min(1, Math.max(0, (niche - 0.1) / 0.5)); // keep in sync with effNiche in nodes.ts
  const lim = x * x * (3 - 2 * x) * 1.1;
  let lo = 0, hi = n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rands[mid] < lim) lo = mid + 1; else hi = mid; }
  return lo;
}
