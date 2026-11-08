// Mesh builders for the per-mineral macro rock structures (see gen/rockForms.ts). Pure arrays, no three.js.
// The tube technique is ported from the Red World mockup (mockups/red-world/src/geo.ts `tube()` and landforms.ts `arch()`):
// a ring of vertices per path point, radius per point, a noisy radius jitter, parallel-transported frames.
//
// Output is a triangle soup with flat per-triangle colour *roles* instead of hex, so the render part can re-tint the rock
// when the rust ratchet moves: role 0 = the mineral's own colour, 1..4 = the Red World ramp (ironstone), 5 = dark ink
// (tunnel mouths); `shade` multiplies the colour (value variation, lit tops, pits).
import type { RockForm } from './rockForms';

export type V3 = [number, number, number];
export const ROLE = { MINERAL: 0, REDLIGHT: 1, RED: 2, CRIMSON: 3, MAROON: 4, DARK: 5 } as const;

export interface Soup { pos: number[]; role: number[]; shade: number[]; mat: number[]; lichen: number[]; top: number }
export const newSoup = (): Soup => ({ pos: [], role: [], shade: [], mat: [], lichen: [], top: -Infinity });

/** Lichen suitability 0..1 of a surface: upward faces only, in patches (crustose lichens settle on Icelandic basalt tops). */
export function lichenMask(ny: number, x: number, y: number, z: number, seed: number): number {
  const up = Math.min(1, Math.max(0, (ny - 0.45) / 0.35));
  const patch = Math.min(1, Math.max(0, (noise3(x * 0.3, y * 0.3, z * 0.3, seed + 77) + 0.1) / 0.5));
  return up * patch;
}
/** Lichen cover eases toward 1 once life is on land (about 3 s), and stays 0 before. Pure; `dt` in seconds. */
export function lichenStep(current: number, lifeOnLand: boolean, dt: number): number {
  if (!lifeOnLand) return current;                          // colonisation never reverses
  const next = current + (1 - current) * (1 - Math.exp(-dt / 1.2));
  return next > 0.999 ? 1 : next;
}

/** Ground height relative to the form's centre, at a world offset (dx, dz) from it. */
export type Ground = (dx: number, dz: number) => number;
/** Colour of a triangle from its centroid, outward normal and an auxiliary 0..1 value (pit depth, facet id…). */
export type Look = (c: V3, n: V3, aux: number) => { role: number; shade: number };

const TWO_PI = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function hash3(i: number, j: number, k: number, s: number): number {
  let x = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1) ^ Math.imul(s | 0, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const h = (a: number, b: number, c: number) => hash3(xi + a, yi + b, zi + c, s);
  const l = (p: number, q: number, t: number) => p + (q - p) * t;
  return 2 * l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w) - 1;
}
export function fbm3(x: number, y: number, z: number, s: number, oct = 3): number {
  let sum = 0, a = 0.5, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { sum += noise3(x * f, y * f, z * f, s + i * 31) * a; n += a; a *= 0.5; f *= 2.03; }
  return sum / n;
}
export const rnd = (s: number, i: number, j = 0) => hash3(i, j, 7, s);

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Emit one triangle, wound so its normal points away from `ref` (a point inside the solid), and coloured by `look`. */
export function tri(s: Soup, a: V3, b: V3, c: V3, ref: V3, look: Look, mat: number, aux = 0, noLichen = false): void {
  let n = cross(sub(b, a), sub(c, a));
  if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;       // degenerate (pinched at a pole)
  const ctr: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  if (dot(n, sub(ctr, ref)) < 0) { const t = b; b = c; c = t; n = [-n[0], -n[1], -n[2]]; }
  const nn = norm(n);
  const { role, shade } = look(ctr, nn, aux);
  const lich = noLichen || role === ROLE.DARK ? 0 : lichenMask(nn[1], ctr[0], ctr[1], ctr[2], 5);
  for (const p of [a, b, c]) { s.pos.push(p[0], p[1], p[2]); s.role.push(role); s.shade.push(shade); s.lichen.push(lich); s.mat.push(mat); if (p[1] > s.top) s.top = p[1]; }
}

/** A closed-in-u grid surface: nu columns (wrapped) by nv rows; `at(i, j)` gives the point and an aux value, `ref(j)` an inside point. */
function grid(s: Soup, nu: number, nv: number, at: (i: number, j: number) => [number, number, number, number], ref: (j: number) => V3, look: Look, mat: number): void {
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const p00 = at(i, j), p10 = at(i1, j), p01 = at(i, j + 1), p11 = at(i1, j + 1);
      const r = ref(j);
      const aux = (p00[3] + p10[3] + p01[3] + p11[3]) / 4;
      tri(s, p00 as unknown as V3, p01 as unknown as V3, p10 as unknown as V3, r, look, mat, aux);
      tri(s, p10 as unknown as V3, p01 as unknown as V3, p11 as unknown as V3, r, look, mat, aux);
    }
  }
}

// ---------- looks ----------

const lit = (n: V3) => 0.9 + 0.2 * clamp(n[1], -0.3, 1);
/** Plain rock: the mineral colour with value variation by facet noise and a lit top. */
export const plainLook = (seed: number, role: number = ROLE.MINERAL): Look => (c, n) => ({ role, shade: lit(n) * (0.9 + 0.12 * (noise3(c[0] * 0.21, c[1] * 0.21, c[2] * 0.21, seed) + 1) / 2 * 2 - 0.12) });

// ---------- primitives ----------

/**
 * Tube along `path` (a ring of `radial` vertices per point, `radii` per point, noisy jitter): the Red World arch technique.
 * Both ends are closed with a dark "mouth" disc so a tunnel reads as a tunnel.
 */
export function tubeSoup(s: Soup, path: V3[], radii: number[], radial: number, seed: number, look: Look, mat: number, mouths: boolean | 'top' = true): void {
  const n = path.length;
  if (n < 2) return;
  const ring = (i: number, j: number): V3 => {
    // parallel-transport frame, recomputed incrementally by `frames`
    const f = frames[i];
    const a = (j / radial) * TWO_PI;
    const jit = 1 + 0.16 * fbm3(i * 0.22, j * 0.55, seed * 0.01, seed, 2);
    const r = radii[i] * jit;
    return [path[i][0] + (f.n[0] * Math.cos(a) + f.b[0] * Math.sin(a)) * r, path[i][1] + (f.n[1] * Math.cos(a) + f.b[1] * Math.sin(a)) * r, path[i][2] + (f.n[2] * Math.cos(a) + f.b[2] * Math.sin(a)) * r];
  };
  const frames: { n: V3; b: V3 }[] = [];
  let prevN: V3 | null = null;
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    const t = norm(sub(b, a));
    let nr: V3;
    if (!prevN) nr = norm(cross(t, Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    else { const d = dot(prevN, t); nr = norm([prevN[0] - t[0] * d, prevN[1] - t[1] * d, prevN[2] - t[2] * d]); }
    prevN = nr;
    frames.push({ n: nr, b: norm(cross(t, nr)) });
  }
  grid(s, radial, n - 1, (j, i) => { const p = ring(i, j); return [p[0], p[1], p[2], 0]; }, (i) => path[i], look, mat);
  if (mouths === 'top') {
    // a column: buried foot, flat lighter top
    const topLook: Look = (c, nn, a) => { const o = look(c, nn, a); return { role: o.role, shade: o.shade * 1.15 }; };
    for (let j = 0; j < radial; j++) tri(s, path[n - 1], ring(n - 1, j), ring(n - 1, (j + 1) % radial), path[n - 2], topLook, mat);
  } else if (mouths) {
    const dark: Look = () => ({ role: ROLE.DARK, shade: 1 });
    for (const [end, other] of [[0, 1], [n - 1, n - 2]] as const) {
      const ref: V3 = path[other];
      for (let j = 0; j < radial; j++) tri(s, path[end], ring(end, j), ring(end, (j + 1) % radial), ref, dark, mat);
    }
  }
}

/** Ellipsoid (superquadric when `boxy` < 1) with fbm bumps and optional thumbprint pits (aux = pit depth 0..1). */
export function blobSoup(s: Soup, c: V3, rad: V3, o: { seed: number; bump?: number; boxy?: number; yaw?: number; pits?: { dir: V3; rho: number; depth: number }[]; nu?: number; nv?: number; cutBelow?: number }, look: Look, mat: number): void {
  const nu = o.nu ?? 16, nv = o.nv ?? 10, bump = o.bump ?? 0.08, e = o.boxy ?? 1, yaw = o.yaw ?? 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const pt = (i: number, j: number): [number, number, number, number] => {
    const th = (i / nu) * TWO_PI, ph = (j / nv) * Math.PI;   // 0 = top pole
    const sp = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
    const dx = sp(Math.sin(ph) * Math.cos(th)), dy = sp(Math.cos(ph)), dz = sp(Math.sin(ph) * Math.sin(th));
    let k = 1 + bump * fbm3(dx * 2.1 + o.seed * 0.01, dy * 2.1, dz * 2.1, o.seed, 3);
    let pit = 0;
    if (o.pits) {
      const u = norm([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]);
      for (const p of o.pits) {
        const ang = Math.acos(clamp(dot(u, p.dir), -1, 1));
        const f = 1 - smooth(p.rho * 0.55, p.rho, ang);        // flat floor, soft rim
        pit = Math.max(pit, f * p.depth);
        k -= f * p.depth;
      }
    }
    const x = dx * rad[0] * k, z = dz * rad[2] * k;
    return [c[0] + x * cy - z * sy, c[1] + dy * rad[1] * k, c[2] + x * sy + z * cy, pit > 0 ? clamp(pit * 4, 0, 1) : 0];
  };
  grid(s, nu, nv, pt, () => c, look, mat);
}

/** Vertical stack of rings -> a ledged column. `rings`: y offset, radius; `wob(angle, y)` multiplies the radius. Closed with a flat top. */
export function columnSoup(s: Soup, c: V3, rings: { y: number; r: number }[], sides: number, wob: (a: number, y: number) => number, look: Look, mat: number, topLook?: Look): void {
  const at = (i: number, j: number): [number, number, number, number] => {
    const a = (i / sides) * TWO_PI, g = rings[j];
    const r = g.r * wob(a, g.y);
    return [c[0] + Math.cos(a) * r, c[1] + g.y, c[2] + Math.sin(a) * r, 0];
  };
  const mid = (j: number): V3 => [c[0], c[1] + (rings[j].y + rings[Math.min(rings.length - 1, j + 1)].y) / 2, c[2]];
  grid(s, sides, rings.length - 1, at, mid, look, mat);
  const last = rings.length - 1, topC: V3 = [c[0], c[1] + rings[last].y, c[2]];
  const tl = topLook ?? look;
  for (let i = 0; i < sides; i++) tri(s, topC, at(i, last) as unknown as V3, at((i + 1) % sides, last) as unknown as V3, [c[0], c[1] + rings[last].y - 5, c[2]], tl, mat);
}

/** Hexagonal prism pointing along `dir` from `base`, with a pointed tip: a crystal. Facet shade varies per side. */
export function prismSoup(s: Soup, base: V3, dir: V3, len: number, r: number, seed: number, look: Look, mat: number): void {
  const d = norm(dir);
  const u = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(d, u);
  const at = (k: number, t: number, rr: number): V3 => {
    const a = (k / 6) * TWO_PI + 0.3;
    return [base[0] + d[0] * t + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * rr, base[1] + d[1] * t + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * rr, base[2] + d[2] * t + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * rr];
  };
  const tip: V3 = [base[0] + d[0] * (len + r * 1.5), base[1] + d[1] * (len + r * 1.5), base[2] + d[2] * (len + r * 1.5)];
  const inside = (t: number): V3 => [base[0] + d[0] * t, base[1] + d[1] * t, base[2] + d[2] * t];
  for (let k = 0; k < 6; k++) {
    const k1 = (k + 1) % 6, ref = inside(len * 0.5);
    const facet = (0.82 + 0.3 * rnd(seed, k)) ;
    const fl: Look = (c, n, a) => { const o = look(c, n, a); return { role: o.role, shade: o.shade * facet }; };
    const a0 = at(k, -r * 0.2, r), a1 = at(k1, -r * 0.2, r), b0 = at(k, len, r), b1 = at(k1, len, r);
    tri(s, a0, b0, a1, ref, fl, mat, k / 6);
    tri(s, a1, b0, b1, ref, fl, mat, k / 6);
    tri(s, b0, tip, b1, inside(len), fl, mat, k / 6);            // pointed tip, a touch brighter
  }
}

// ---------- the forms ----------

type Variant = RockForm['variant'];
const sinuous = (a: number, p: number, amp: number) => amp * Math.sin(a * 2.1 + p) * (1 - 0.3 * Math.sin(a * 5 + p * 2));

/**
 * Lava tube (basalt, reduced lava): a long sinuous tunnel arch, half buried. Lava tubes really form in flowing basaltic
 * (pahoehoe) lava: the surface crusts over, the molten core drains and leaves a tunnel; where the roof collapses a
 * "skylight" opens. Built with the tube technique: foot A over to foot B, riding the ground and bridging dips, with one or
 * two skylight gaps (the path is cut, each gap strewn with fallen blocks) and dark tunnel mouths at every open end.
 */
export function lavaTubeSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): { path: V3[]; radii: number[]; gaps: [number, number][] } {
  const len = f.length ?? 80, R = f.size;
  const N = Math.max(24, Math.round(len / 2));
  const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
  const wob = [8, 14, 6][f.variant] ?? 8;
  const pts: V3[] = [], radii: number[] = [];
  const gy: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, along = (t - 0.5) * len, side = sinuous(t * 6, f.seed * 0.001, wob);
    const dx = ca * along - sa * side, dz = sa * along + ca * side;
    pts.push([dx, 0, dz]);
    gy.push(ground(dx, dz));
  }
  // bridge dips: rolling upper envelope of the ground, then smoothed, so the tube arches over hollows and hugs rises
  const env = gy.map((_, i) => { let m = -Infinity; for (let k = -4; k <= 4; k++) m = Math.max(m, gy[clamp(i + k, 0, N)]); return m; });
  for (let pass = 0; pass < 5; pass++) for (let i = 1; i < N; i++) env[i] = (env[i - 1] + 2 * env[i] + env[i + 1]) / 4;
  for (let i = 0; i <= N; i++) {
    const t = i / N, arch = f.variant === 1 ? Math.pow(Math.sin(Math.PI * t), 0.8) * R * 1.2 : 0;   // variant 1 lifts into a bridge-like arch
    const r = R * (0.9 + 0.22 * fbm3(t * 5, 0.5, f.seed * 0.01, f.seed, 2)) * (0.78 + 0.22 * Math.sin(Math.PI * clamp(t, 0.02, 0.98)) ** 0.5);
    radii.push(r);
    pts[i][1] = Math.max(env[i], gy[i]) + r * 0.35 + arch;     // half buried: axis a third of a radius above the ground
  }
  const gaps: [number, number][] = f.variant === 2 ? [[0.5, 4]] : [[0.36, 3], [0.7, 4]];
  const cut = new Set<number>();
  const gapIdx: [number, number][] = [];
  for (const [t, w] of gaps) { const c = Math.round(t * N); gapIdx.push([c - Math.floor(w / 2), c + Math.ceil(w / 2)]); for (let k = c - Math.floor(w / 2); k <= c + Math.ceil(w / 2); k++) cut.add(k); }
  let start = 0;
  const pieces: [number, number][] = [];
  for (let i = 0; i <= N + 1; i++) {
    if (i === N + 1 || cut.has(i)) { if (i - 1 - start >= 2) pieces.push([start, i - 1]); start = i + 1; }
  }
  for (const [a, b] of pieces) tubeSoup(s, pts.slice(a, b + 1), radii.slice(a, b + 1), 12, f.seed + a, look, mat);
  // fallen roof blocks in each skylight
  gapIdx.forEach(([g0, g1], gi) => {
    const m = clamp(Math.round((g0 + g1) / 2), 0, N), p = pts[m];
    for (let k = 0; k < 2; k++) {
      const a = rnd(f.seed, gi, k) * TWO_PI, d = radii[m] * (0.3 + 0.9 * rnd(f.seed, gi, k + 9)), br = radii[m] * (0.22 + 0.2 * rnd(f.seed, gi, k + 3));
      const x = p[0] + Math.cos(a) * d, z = p[2] + Math.sin(a) * d;
      blobSoup(s, [x, ground(x, z) + br * 0.3, z], [br * 1.2, br * 0.8, br], { seed: f.seed + gi * 7 + k, bump: 0.18, boxy: 0.7, nu: 8, nv: 5, yaw: a }, look, mat);
    }
  });
  return { path: pts, radii, gaps: gapIdx };
}

/** Sea stack: a narrow tapering pillar left standing off the coast as the sea eats the headland, with a squat foot. */
export function seaStackSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const H = f.height, R = f.size, low = Math.min(ground(0, 0), ground(R, 0), ground(-R, 0), ground(0, R), ground(0, -R)) - 3;
  const rings = [
    { y: low, r: R * 1.6 }, { y: low + (H - low) * 0.18, r: R * 1.15 }, { y: low + (H - low) * 0.5, r: R * 0.88 },
    { y: low + (H - low) * 0.8, r: R * 0.92 }, { y: H, r: R * 0.74 },
  ];
  columnSoup(s, [0, 0, 0], rings, 12, (a, y) => 1 + 0.2 * fbm3(Math.cos(a) * 1.7 + f.seed * 0.01, y * 0.09, Math.sin(a) * 1.7, f.seed, 2), look, mat);
  const fr = R * 0.9;
  blobSoup(s, [R * 1.7, ground(R * 1.7, R * 0.4) + fr * 0.2, R * 0.4], [fr, fr * 0.9, fr], { seed: f.seed + 5, bump: 0.2, boxy: 0.8, nu: 8, nv: 5 }, look, mat);
}

/** Flat-topped mesa/butte with banded sides: ledges, a talus flare at the foot, a flat top (the Hamersley-style iron plateau). */
export function mesaSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const H = f.height, R = f.size;
  const low = Math.min(ground(0, 0), ground(R, 0), ground(-R, 0), ground(0, R), ground(0, -R), ground(R * 0.7, R * 0.7), ground(-R * 0.7, -R * 0.7)) - 2;
  const rings: { y: number; r: number }[] = [{ y: low, r: R * 1.5 }, { y: 0, r: R * 1.18 }];
  const steps = 6;
  for (let k = 1; k <= steps; k++) {
    const y = (H * k) / steps, r = R * (1.1 - 0.16 * (k / steps) + (k % 2 ? 0.05 : -0.03));
    rings.push({ y: y - H / steps * 0.18, r: rings[rings.length - 1].r * 0.99 }, { y, r });   // each band: a near-vertical wall, then a small ledge
  }
  columnSoup(s, [0, 0, 0], rings, 26, (a, y) => 1 + 0.2 * fbm3(Math.cos(a) * 2.2 + f.seed * 0.01, y * 0.06, Math.sin(a) * 2.2, f.seed, 3), look, mat, (c) => ({ role: ROLE.REDLIGHT, shade: 1.05 + 0.1 * noise3(c[0] * 0.2, 0, c[2] * 0.2, f.seed) }));
  if (f.variant === 2) {   // twin: a lesser butte beside the mesa
    const ox = Math.cos(f.angle) * R * 1.9, oz = Math.sin(f.angle) * R * 1.9, h2 = H * 0.7, r2 = R * 0.45;
    const lo = Math.min(ground(ox, oz), ground(ox + r2, oz), ground(ox - r2, oz)) - 2;
    columnSoup(s, [ox, 0, oz], [{ y: lo, r: r2 * 1.5 }, { y: 0, r: r2 * 1.15 }, { y: h2 * 0.5, r: r2 }, { y: h2, r: r2 * 0.9 }], 14, (a, y) => 1 + 0.18 * fbm3(Math.cos(a) * 2 + f.seed * 0.02, y * 0.08, Math.sin(a) * 2, f.seed + 3, 2), look, mat, (c) => ({ role: ROLE.REDLIGHT, shade: 1.1 + 0 * c[0] }));
  }
}

/** Bornhardt: a large smooth dome of granite (a lathe through a rounded profile, almost no detail, faint exfoliation seams). */
export function domeSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const H = f.height, R = f.size;
  const low = Math.min(ground(0, 0), ground(R, 0), ground(-R, 0), ground(0, R), ground(0, -R)) - 3;
  const rings: { y: number; r: number }[] = [{ y: low, r: R * 1.12 }];
  const M = 10;
  for (let k = 0; k <= M; k++) {
    const t = k / M, y = H * Math.sin(t * Math.PI / 2) ** 0.9;
    rings.push({ y: Math.max(y, 0.01 + t * 0.01), r: R * Math.cos(t * Math.PI / 2) ** 0.7 + 0.001 });
  }
  const ya = 0.88 + 0.24 * rnd(f.seed, 1);
  columnSoup(s, [0, 0, 0], rings, 28, (a, y) => (1 + 0.05 * fbm3(Math.cos(a) + f.seed * 0.01, y * 0.05, Math.sin(a), f.seed, 2)) * (a < 0 ? 1 : ya + (1 - ya) * Math.cos(2 * a - f.angle) ** 2), look, mat);
}

/** Tor: a stack of rounded, squarish granite blocks (joint-bounded corestones), a few high. */
export function torSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const R = f.size, n = f.variant === 1 ? 3 : 4 + (f.seed % 2);
  let y = Math.min(ground(0, 0), ground(R, 0), ground(-R, 0), ground(0, R), ground(0, -R)) - 1, rr = R * 1.15;
  const base = y;
  for (let k = 0; k < n; k++) {
    const h = R * (0.55 + 0.35 * rnd(f.seed, k)), a = rnd(f.seed, k, 4) * TWO_PI, off = k === 0 ? 0 : rr * 0.32;
    const cx = Math.cos(a) * off, cz = Math.sin(a) * off;
    const ry = k === 0 ? h + (0 - base) * 0.5 : h;
    const cy = k === 0 ? base + ry * 0.8 : y + h * 0.8;
    blobSoup(s, [cx, cy, cz], [rr, ry, rr * (0.85 + 0.3 * rnd(f.seed, k, 2))], { seed: f.seed + k * 13, bump: 0.07, boxy: 0.55, nu: 14, nv: 8, yaw: a }, look, mat);
    y = cy + ry * 0.7;
    rr *= 0.8 - 0.08 * rnd(f.seed, k, 6);
  }
}

/** Balancing boulder: a big rounded block perched on a small pedestal stone on a low dome of the same granite. */
export function balancerSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const R = f.size;
  const low = Math.min(ground(0, 0), ground(R, 0), ground(-R, 0), ground(0, R), ground(0, -R)) - 2;
  blobSoup(s, [0, low + (R * 0.55 - low) * 0.4, 0], [R * 1.1, (R * 0.55 - low) * 0.6, R * 1.1], { seed: f.seed, bump: 0.05, nu: 14, nv: 7 }, look, mat);
  const py = R * 0.55;
  blobSoup(s, [0, py + R * 0.35, 0], [R * 0.34, R * 0.45, R * 0.34], { seed: f.seed + 1, bump: 0.1, boxy: 0.8, nu: 10, nv: 6 }, look, mat);
  blobSoup(s, [R * 0.12, py + R * 0.6 + R * 0.95, 0], [R * 1.0, R * 0.95, R * 0.85], { seed: f.seed + 2, bump: 0.08, boxy: 0.75, nu: 16, nv: 9, yaw: 0.6 }, look, mat);
}

/** Silicide mound: a dark rounded metallic hill with a few thumbprint pits, like a meteorite surface. Smooth, no fine detail. */
export function moundSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const R = f.size, H = f.height;
  const low = Math.min(ground(0, 0), ground(R, 0), ground(-R, 0), ground(0, R), ground(0, -R)) - 3;
  const pits = Array.from({ length: 3 + (f.seed % 2) }, (_, k) => {
    const th = rnd(f.seed, k) * TWO_PI, ph = 0.2 + 0.6 * rnd(f.seed, k, 3);
    return { dir: norm([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]) as V3, rho: 0.28 + 0.1 * rnd(f.seed, k, 5), depth: 0.13 };
  });
  blobSoup(s, [0, low + (H - low) * 0.0, 0], [R, H - low, R * (0.8 + 0.3 * rnd(f.seed, 2))], { seed: f.seed, bump: 0.04, pits, nu: 22, nv: 11, yaw: f.angle }, look, mat);
  if (f.variant === 1) {   // a lesser knoll beside it
    const ox = Math.cos(f.angle) * R * 1.3, oz = Math.sin(f.angle) * R * 1.3, r2 = R * 0.5, h2 = H * 0.6;
    const lo = ground(ox, oz) - 3;
    blobSoup(s, [ox, lo, oz], [r2, h2 - lo, r2], { seed: f.seed + 9, bump: 0.04, nu: 14, nv: 7 }, look, mat);
  }
}

/** Big pitted boulder: a near-sphere with many thumbprint pits (regmaglypts), half sunk in the ground. */
export function pitBoulderSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const R = f.size;
  const pits = Array.from({ length: 7 + (f.seed % 3) }, (_, k) => {
    const th = rnd(f.seed, k) * TWO_PI, ph = 0.15 + 0.75 * rnd(f.seed, k, 3);
    return { dir: norm([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]) as V3, rho: 0.2 + 0.1 * rnd(f.seed, k, 5), depth: 0.12 + 0.05 * rnd(f.seed, k, 7) };
  });
  const gy = Math.max(ground(0, 0), ground(R * 0.7, 0), ground(-R * 0.7, 0), ground(0, R * 0.7), ground(0, -R * 0.7));
  blobSoup(s, [0, gy + R * 0.15, 0], [R, R * 0.85, R * 0.92], { seed: f.seed, bump: 0.05, pits, nu: 22, nv: 12, yaw: f.angle }, look, mat);
}

/** Giant hexagonal crystal cluster: a few tall hex prisms tilted out from a rocky base. */
export function crystalSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const R = f.size, H = f.height;
  const n = 4 + (f.seed % 3) + (f.variant === 1 ? 1 : 0);
  const gy = Math.min(ground(0, 0), ground(R, 0), ground(-R, 0), ground(0, R), ground(0, -R));
  blobSoup(s, [0, gy + R * 0.1, 0], [R * 1.5, R * 0.55, R * 1.5], { seed: f.seed, bump: 0.18, boxy: 0.8, nu: 10, nv: 5 }, look, mat);
  for (let k = 0; k < n; k++) {
    const a = rnd(f.seed, k) * TWO_PI, tilt = k === 0 ? 0.06 : 0.22 + 0.28 * rnd(f.seed, k, 2);
    const off = k === 0 ? 0 : R * (0.45 + 0.5 * rnd(f.seed, k, 3));
    const bx = Math.cos(a) * off, bz = Math.sin(a) * off;
    const dir: V3 = [Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)];   // leans outward from the base
    const len = H * (k === 0 ? 1 : 0.4 + 0.45 * rnd(f.seed, k, 4)), rr = R * (k === 0 ? 0.5 : 0.28 + 0.14 * rnd(f.seed, k, 6));
    prismSoup(s, [bx, ground(bx, bz) - 1.5, bz], dir, len, rr, f.seed + k * 5, look, mat);
  }
}

/**
 * Fan cliff (basalt, reduced lava): bundles of hexagonal columns that curve and fan like Stuðlagil. Columns grow perpendicular to
 * the cooling surface, so where lava cooled unevenly the front is curved and the columns splay out from it and bend over.
 * Two rows along a curved front facing downhill (`angle`); each column is a 6-sided tube of segments whose direction turns
 * progressively; tops are stepped and broken (varying heights) and flat.
 */
export function fanCliffSoup(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  const W = f.length ?? 32, rad = f.size, H = f.height, SEG = 6;
  const O: [number, number] = [Math.cos(f.angle), Math.sin(f.angle)], L: [number, number] = [-O[1], O[0]];
  const spread = f.variant === 0 ? 0.9 : 1.35, n = Math.max(5, Math.round(W / (rad * 2.1)));
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1) - 0.5;
      const front = -u * u * W * 0.45 - row * rad * 1.7;            // curved cooling front, the back row further in
      const bx = L[0] * u * W + O[0] * front, bz = L[1] * u * W + O[1] * front;
      const by = ground(bx, bz) - 2.5;
      const phi = u * spread, tilt = 0.18 + 0.25 * Math.abs(u) + 0.1 * rnd(f.seed, i, row);
      // start direction: up, splayed sideways by the fan angle and tipped outward
      let d: V3 = norm([L[0] * Math.sin(phi) + O[0] * Math.sin(tilt), Math.cos(phi) * Math.cos(tilt), L[1] * Math.sin(phi) + O[1] * Math.sin(tilt)]);
      const len = H * (row ? 1.22 : 1) * (0.45 + 0.11 * Math.floor(rnd(f.seed + row * 3, i) * 5)), step = len / SEG;   // stepped, broken tops
      const path: V3[] = [[bx, by, bz]];
      for (let k = 0; k < SEG; k++) {
        const p = path[k];
        path.push([p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step]);
        const bend = 0.16 + 0.1 * Math.abs(u);                        // progressive curvature, columns lean over toward the outflow
        d = norm([d[0] + (O[0] * 0.8 + L[0] * u) * bend, d[1] - 0.06, d[2] + (O[1] * 0.8 + L[1] * u) * bend]);
      }
      const tone = 0.9 + 0.14 * rnd(f.seed, i, 5 + row);
      tubeSoup(s, path, path.map(() => rad), 6, f.seed + i * 3 + row, (c, nn, a) => { const o = look(c, nn, a); return { role: o.role, shade: o.shade * tone }; }, mat, 'top');
    }
  }
}

/** Dispatch: build the form into `s` in the form's local space (origin = its centre on the ground; y is relative to it). */
export function buildForm(s: Soup, f: RockForm, ground: Ground, look: Look, mat: number): void {
  switch (f.kind) {
    case 'lavaTube': lavaTubeSoup(s, f, ground, look, mat); break;
    case 'seaStack': seaStackSoup(s, f, ground, look, mat); break;
    case 'mesa': mesaSoup(s, f, ground, look, mat); break;
    case 'dome': domeSoup(s, f, ground, look, mat); break;
    case 'torStack': torSoup(s, f, ground, look, mat); break;
    case 'balancer': balancerSoup(s, f, ground, look, mat); break;
    case 'silicideMound': moundSoup(s, f, ground, look, mat); break;
    case 'pitBoulder': pitBoulderSoup(s, f, ground, look, mat); break;
    case 'fanCliff': fanCliffSoup(s, f, ground, look, mat); break;
    case 'crystalCluster': crystalSoup(s, f, ground, look, mat); break;
  }
}

export type { Variant };
