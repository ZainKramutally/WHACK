// Pure geometry builders (arrays only, no three import) for spires, horns, arches and walls.
// Everything is a swept tube: a centre curve, a radius function and an optional elliptical section.
import { clamp, fbm3, mix, noise3, ridged3, smoothstep } from './noise';

export type V3 = [number, number, number];

export interface Geo { pos: number[]; idx: number[]; aT: number[]; aS: number[] }
export const newGeo = (): Geo => ({ pos: [], idx: [], aT: [], aS: [] });

export interface TubeOpts {
  center: (s: number) => V3;                 // s in 0..1 along the curve
  radius: (s: number, th: number, c: V3, dir: V3) => number;
  rings: number; radial: number;
  ellipse?: [number, number];                // scale on the first (N) and second (B) section axes
  n0?: V3;                                   // initial section normal (defaults to +X, or +Y if the curve starts sideways)
  param?: (u: number) => number;             // ring spacing u→s (default identity)
  tag?: number;                              // written to aT (e.g. 0 body, 1 horn)
}

const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Appends a swept tube to `g`. Rings wrap (no duplicated seam), the last ring should have radius 0 for a closed tip. */
export function addTube(g: Geo, o: TubeOpts): void {
  const base = g.pos.length / 3;
  const [kn, kb] = o.ellipse ?? [1, 1];
  const ds = 1e-3;
  let N: V3 | null = o.n0 ? norm(o.n0) : null;
  for (let i = 0; i <= o.rings; i++) {
    const s = (o.param ?? ((u) => u))(i / o.rings);
    const c = o.center(s);
    const c2 = o.center(Math.min(1, s + ds)), c1 = o.center(Math.max(0, s - ds));
    const T = norm([c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]]);
    if (!N) N = Math.abs(T[1]) < 0.9 ? norm(cross([0, 1, 0], T)) : [1, 0, 0];
    // parallel transport: project previous N onto the plane ⟂ T
    const d = dot(N, T);
    N = norm([N[0] - T[0] * d, N[1] - T[1] * d, N[2] - T[2] * d]);
    const B = cross(T, N);
    for (let k = 0; k < o.radial; k++) {
      const th = (k / o.radial) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const dir: V3 = [N[0] * ct * kn + B[0] * st * kb, N[1] * ct * kn + B[1] * st * kb, N[2] * ct * kn + B[2] * st * kb];
      const r = o.radius(s, th, c, dir);
      g.pos.push(c[0] + dir[0] * r, c[1] + dir[1] * r, c[2] + dir[2] * r);
      g.aT.push(s); g.aS.push(o.tag ?? 0);
    }
  }
  for (let i = 0; i < o.rings; i++) for (let k = 0; k < o.radial; k++) {
    const a = base + i * o.radial + k, b = base + i * o.radial + ((k + 1) % o.radial);
    const c = a + o.radial, d = b + o.radial;
    g.idx.push(a, b, c, b, d, c);
  }
}

// ---------------------------------------------------------------- spire

/**
 * Radius multiplier along a spire, t = 0 base → 1 tip. Monotonic non-increasing.
 * Fresh (erosion 0): fat bulbous column, rounded top. Eroded (1): thin tapering finger with a sharp tip.
 */
export function spireProfile(t: number, erosion: number): number {
  const e = clamp(erosion), tt = clamp(t);
  const taperExp = mix(0.3, 0.72, e);
  const tipSharp = mix(2.8, 1.1, e);
  const body = Math.pow(1 - Math.pow(tt, tipSharp), taperExp) * mix(1, 0.7, e);
  const flare = 1 + mix(0.35, 0.6, e) * Math.exp(-tt * mix(10, 16, e));
  return body * flare;
}

export interface SpireOpts {
  H: number; R: number; erosion: number; lean?: [number, number]; horns?: boolean;
  radial: number; rings: number; seed: number; bury?: number;
}

/** Spire in local space: base at y = 0 (buried `bury` m below), tip at y = H. */
export function buildSpire(o: SpireOpts): Geo {
  const { H, R, erosion: e, seed } = o;
  const bury = o.bury ?? Math.max(3, H * 0.03);
  const lean = o.lean ?? [0, 0];
  const lumpAmp = mix(0.28, 0.13, e);
  const lumpFreq = 1 / (R * mix(1.1, 2.2, e));
  const centre = (s: number): V3 => {
    const y = -bury + (H + bury) * s;
    const t = clamp(y / H);
    const wob = R * 0.5 * (noise3(t * 2.3, 1.7, 0, seed) * (1 - t * 0.3));
    return [lean[0] * H * Math.pow(t, 1.6) + wob, y, lean[1] * H * Math.pow(t, 1.6) + R * 0.4 * noise3(t * 2.1, 5.1, 9, seed + 1)];
  };
  const g = newGeo();
  addTube(g, {
    center: centre,
    rings: o.rings, radial: o.radial,
    param: (u) => mix(u, u * u, 0.35),
    radius: (s, th, c, dir) => {
      const t = clamp(c[1] / H);
      const prof = spireProfile(t, e) * R;
      // stacked lumps (bulbous when fresh) …
      const qx = c[0] + dir[0] * prof, qz = c[2] + dir[2] * prof;
      const lump = fbm3(qx * lumpFreq, c[1] * lumpFreq * 0.8, qz * lumpFreq, 3, seed + 3);
      // … vertical grooves + ragged notches when eroded
      const groove = ridged3(Math.cos(th) * 2.2, c[1] / (H * 0.07), Math.sin(th) * 2.2, 2, seed + 5) - 0.55;
      const notch = noise3(c[1] / (H * 0.025), th * 1.5, 3, seed + 6);
      const k = 1 + lump * lumpAmp + e * (groove * 0.34 + notch * 0.12) * smoothstep(0.02, 0.25, t);
      return Math.max(0.0001, prof * k);
    },
  });
  if (o.horns) {
    const arms: Array<{ t0: number; sign: number; len: number; up: number }> = [
      { t0: 0.8, sign: -1, len: 0.55, up: 0.07 }, { t0: 0.75, sign: 1, len: 0.65, up: 0.085 },
    ];
    for (const a of arms) {
      const y0 = a.t0 * H, r0 = spireProfile(a.t0, e) * R;
      const c0 = centre((y0 + bury) / (H + bury));
      const L = R * 2.4 * a.len * 2.2, U = H * a.up;
      const p0: V3 = [c0[0] + a.sign * r0 * 0.5, y0, c0[2]];
      const p1: V3 = [p0[0] + a.sign * L, p0[1] + U * 0.05, p0[2]];
      const p2: V3 = [p0[0] + a.sign * L * 1.15, p0[1] + U, p0[2]];
      const rA = r0 * 0.34;
      addTube(g, {
        rings: Math.max(6, o.rings >> 3), radial: Math.max(6, o.radial >> 2), tag: 1, n0: [0, 0, 1],
        center: (s) => {
          const q = 1 - s;
          return [q * q * p0[0] + 2 * q * s * p1[0] + s * s * p2[0], q * q * p0[1] + 2 * q * s * p1[1] + s * s * p2[1], q * q * p0[2] + 2 * q * s * p1[2] + s * s * p2[2]];
        },
        radius: (s) => rA * (1 - 0.35 * s) * Math.sqrt(Math.max(0, 1 - Math.pow(smoothstep(0.88, 1, s), 2))) * (s < 0.1 ? 1 + (0.1 - s) * 6 : 1),
      });
    }
  }
  return g;
}

// ---------------------------------------------------------------- arch

export interface ArchOpts {
  a: [number, number]; b: [number, number]; ha: number; hb: number; apex: number; R: number;
  radial: number; rings: number; seed: number;
}

/** Arch in WORLD space (mesh at the origin). Planar sweep from foot a to foot b, apex = height above the higher foot. */
export function buildArch(o: ArchOpts): Geo {
  const dx = o.b[0] - o.a[0], dz = o.b[1] - o.a[1], len = Math.hypot(dx, dz) || 1;
  const px = -dz / len, pz = dx / len; // lateral
  const arc = (s: number) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(s), 0.92)), 0.78);
  const g = newGeo();
  addTube(g, {
    center: (s) => [
      o.a[0] + dx * s + px * len * 0.07 * Math.sin(Math.PI * s),
      mix(o.ha, o.hb, s) + o.apex * arc(s) - 4 * (1 - smoothstep(0, 0.04, s)) - 4 * smoothstep(0.96, 1, s),
      o.a[1] + dz * s + pz * len * 0.07 * Math.sin(Math.PI * s),
    ],
    rings: o.rings, radial: o.radial, ellipse: [1.55, 0.85], n0: [px, 0, pz],
    radius: (s, th, c, dir) => {
      const crown = Math.pow(Math.sin(Math.PI * s), 1.3);
      const feet = 1 + 0.9 * Math.exp(-s * 12) + 0.9 * Math.exp(-(1 - s) * 12);
      const n = fbm3(c[0] / (o.R * 2.2) + dir[0], c[1] / (o.R * 2.2), c[2] / (o.R * 2.2) + dir[2], 3, o.seed + 7);
      return o.R * (1 - 0.5 * crown) * feet * (1 + 0.16 * n);
    },
  });
  return g;
}

// ---------------------------------------------------------------- wall / cliff / crust lump

export interface WallOpts {
  H: number; w: number; d: number; overhang: boolean; radial: number; rings: number; seed: number;
}

/** Wall profile (radius multiplier). Overhang: waist then a big mushroom lip, rounded top. */
export function wallProfile(t: number, overhang: boolean): number {
  const tt = clamp(t);
  const flare = 1 + 0.45 * Math.exp(-tt * 7);
  if (overhang) {
    const waist = 1 - 0.38 * smoothstep(0.35, 0.72, tt);
    const lip = 1 + 0.95 * smoothstep(0.7, 0.88, tt);
    const top = Math.sqrt(Math.max(0, 1 - Math.pow(smoothstep(0.9, 1, tt), 2)));
    return flare * waist * lip * top;
  }
  const top = Math.sqrt(Math.max(0, 1 - Math.pow(smoothstep(0.78, 1, tt), 2.2)));
  return flare * (1 - 0.2 * tt) * top;
}

/** Local space: base at y = 0 (buried a bit), centred on x/z = 0. */
export function buildWall(o: WallOpts): Geo {
  const g = newGeo();
  const crust = o.H < 14;                 // small ones are rough sponge lumps
  const size = Math.min(o.w, o.d);
  const bury = Math.max(1.5, o.H * 0.06);
  const amp = crust ? 0.34 : 0.2;
  const f = 1 / (size * (crust ? 0.35 : 0.8));
  addTube(g, {
    center: (s) => [0, -bury + (o.H + bury) * s, 0],
    rings: o.rings, radial: o.radial, ellipse: [o.w / 2, o.d / 2], n0: [1, 0, 0],
    param: (u) => mix(u, u * u, 0.25),
    radius: (s, th, c, dir) => {
      const t = clamp(c[1] / o.H);
      const prof = crust ? Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.4))) * (1 + 0.5 * Math.exp(-t * 6)) : wallProfile(t, o.overhang);
      const qx = c[0] + dir[0] * prof, qz = c[2] + dir[2] * prof;
      const n = fbm3(qx * f, c[1] * f * 0.9, qz * f, crust ? 4 : 3, o.seed);
      const strata = crust ? 0 : 0.06 * Math.sin(c[1] * 0.35 + 3 * noise3(qx * f, c[1] * f, qz * f, o.seed + 2));
      const rid = crust ? (ridged3(qx * f * 2.2, c[1] * f * 2.2, qz * f * 2.2, 2, o.seed + 4) - 0.5) * 0.35 : 0;
      return Math.max(0.0001, prof * (1 + n * amp + strata + rid));
    },
  });
  return g;
}
