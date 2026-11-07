// Pure geometry builders for each species, in a unit frame: base at y=0, ~1 m tall (or ~1 m wide for mats/domes),
// so instances are UNIFORMLY scaled (normals stay right). aux.w = mask (meaning per shape), aux.xyz = shape offset.
import { growFan } from './fan';
import { mulberry32 } from './placement';
import { MB, MeshData, V3, fbm, lathe, merge, tube, vnoise, ProfilePt } from './meshdata';

const TAU = Math.PI * 2;

/** eco-04 hero: stalked goblet with flared cup and rolled rim. mask 1 = interior, 0.5 = rim. */
export function lanternCup(segs = 22): MeshData {
  const mb = new MB();
  const prof: ProfilePt[] = [
    [0, 0, 0], [0.085, 0, 0], [0.07, 0.1, 0], [0.06, 0.2, 0], [0.07, 0.3, 0],
    [0.13, 0.4, 0], [0.2, 0.52, 0], [0.265, 0.65, 0], [0.31, 0.78, 0], [0.33, 0.9, 0], [0.335, 0.96, 0.5],
    [0.325, 1.0, 0.5], [0.3, 0.995, 0.5], [0.28, 0.95, 1], [0.24, 0.84, 1], [0.17, 0.74, 1], [0.09, 0.68, 1], [0, 0.66, 1],
  ];
  lathe(mb, prof, segs, { radial: (th, i) => 1 + (i > 5 ? 0.07 * Math.sin(5 * th + i * 0.3) : 0) });
  return mb.data();
}

/** eco-04 new: 3 planar coral fans sharing a base at different yaws. Unit height 1. mask = branch level / levels. */
export function frostFan(seed = 3): MeshData {
  const mb = new MB();
  [0, 1.05, -0.95].forEach((yaw, k) => {
    const rng = mulberry32(seed * 31 + k * 7);
    const segs = growFan(rng, { levels: 4 + ((seed + k) % 3), maxSegments: 90, baseLen: 0.38, baseWidth: 0.07 });
    const maxY = Math.max(...segs.map((s) => Math.max(s.y0, s.y1))) || 1;
    const sc = (k === 0 ? 1 : 0.72) / maxY, c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (x: number, y: number, dz = 0): V3 => [(x * sc) * c + dz * s, y * sc, -(x * sc) * s + dz * c];
    const nrm: V3 = [-s, 0, c];
    for (const g of segs) {
      const dx = g.x1 - g.x0, dy = g.y1 - g.y0, l = Math.hypot(dx, dy) || 1;
      const px = -dy / l, py = dx / l; // in-plane perpendicular
      const m = g.level / 5;
      const mid = 0.5, wm = (g.w0 + g.w1) * 0.5 * 1.25; // slightly fat in the middle: faceted glass blade
      const a = mb.v(P(g.x0 + px * g.w0 * 0.5, g.y0 + py * g.w0 * 0.5), nrm, m);
      const b = mb.v(P(g.x0 - px * g.w0 * 0.5, g.y0 - py * g.w0 * 0.5), nrm, m);
      const c1 = mb.v(P(g.x0 + dx * mid + px * wm * 0.5, g.y0 + dy * mid + py * wm * 0.5, 0.012), nrm, m);
      const d1 = mb.v(P(g.x0 + dx * mid - px * wm * 0.5, g.y0 + dy * mid - py * wm * 0.5, -0.012), nrm, m);
      const e = mb.v(P(g.x1 + px * g.w1 * 0.5, g.y1 + py * g.w1 * 0.5), nrm, m + 0.15);
      const f = mb.v(P(g.x1 - px * g.w1 * 0.5, g.y1 - py * g.w1 * 0.5), nrm, m + 0.15);
      mb.quad(a, b, c1, d1, true); mb.quad(c1, d1, e, f, true);
    }
  });
  mb.smooth();
  return mb.data();
}

/** eco-12 hero: thin curving stalk with a small flat cap. aux.xz of cap verts = offset from the cap axis (lets
 * the shader widen caps with `capWidth`). mask: 0 stalk, 0.5 cap top, 1 cap underside. */
export function glowStalk(seed = 1): MeshData {
  const rng = mulberry32(seed * 977);
  const mb = new MB();
  const bx = (rng() - 0.5) * 0.14, bz = (rng() - 0.5) * 0.14, tx = bx * 1.6, tz = bz * 1.6;
  const N = 14, path: V3[] = [], radii: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    path.push([2 * u * t * bx + t * t * tx, t * 0.985, 2 * u * t * bz + t * t * tz]);
    radii.push(0.0058 * (1 - 0.55 * t) * (1 + 1.8 * Math.pow(1 - t, 14)));
  }
  tube(mb, path, radii, 5, () => 0);
  const R = 0.034;
  const cap: ProfilePt[] = [[0.003, -0.01, 1], [0.014, -0.008, 1], [0.028, -0.003, 1], [R, 0.001, 1], [R * 0.96, 0.004, 0.5], [0.022, 0.009, 0.5], [0.009, 0.012, 0.5], [0, 0.0128, 0.5]];
  const top = path[N];
  lathe(mb, cap, 12, { center: [top[0], top[1] + 0.005, top[2]] });
  return mb.data();
}

/** eco-12: lumpy half-sphere, unit radius, flat bottom at y≈-0.1 (sunk into the ground by the placer). */
export function mossDome(seed = 1): MeshData {
  const mb = new MB();
  const W = 40, H = 24, rows: number[][] = [];
  for (let i = 0; i <= H; i++) {
    const phi = (i / H) * Math.PI; // 0 top → π bottom
    const row: number[] = [];
    for (let j = 0; j <= W; j++) {
      const th = (j / W) * TAU;
      const d: V3 = [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
      const lump = 0.62 + 0.55 * fbm(d[0] * 1.7 + seed * 5.1, d[1] * 1.7, d[2] * 1.7 + seed * 2.3, 4) + 0.18 * vnoise(d[0] * 5 + seed, d[1] * 5, d[2] * 5);
      const r = Math.min(1.25, lump);
      const y = Math.max(-0.1, d[1] * r * 0.82);
      row.push(mb.v([d[0] * r, y, d[2] * r], d, d[1] * 0.5 + 0.5, [d[0], d[1], d[2]]));
    }
    rows.push(row);
  }
  for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) mb.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j], rows[i + 1][j + 1]);
  mb.smooth();
  // seam: copy the smooth normal of column 0 to column W
  for (let i = 0; i <= H; i++) {
    const a = rows[i][0] * 3, b = rows[i][W] * 3;
    for (let k = 0; k < 3; k++) { const v = (mb.normal[a + k] + mb.normal[b + k]) / 2; mb.normal[a + k] = v; mb.normal[b + k] = v; }
  }
  return mb.data();
}

/** eco-12 new: a tall curling blade, 1 m unit (scaled 30–70 m). mask = t along the blade (0 base → 1 tip). */
export function shadeRibbon(seed = 1): MeshData {
  const rng = mulberry32(seed * 131);
  const mb = new MB();
  const N = 18, W = 0.06, curl = 0.1 + rng() * 0.12, twist = (rng() - 0.5) * 1.6;
  const L: number[] = [], R: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = curl * t * t, z = 0.03 * Math.sin(t * 3.1 + seed);
    const hw = W * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.82)), 0.7) * (1 - t * 0.4);
    const a = twist * t, cx = Math.cos(a), sx = Math.sin(a);
    const y = t;
    const nrm: V3 = [-sx, 0, cx];
    L.push(mb.v([x - hw * cx, y, z + hw * sx], nrm, t));
    R.push(mb.v([x + hw * cx, y, z - hw * sx], nrm, t));
  }
  for (let i = 0; i < N; i++) mb.quad(L[i], R[i], L[i + 1], R[i + 1], true);
  return mb.data();
}

/** eco-14 new: tuft of hair-thin straight cilia, ~1 m unit. mask = t along the hair. */
export function glassWhiskers(seed = 1, hairs = 22): MeshData {
  const rng = mulberry32(seed * 53);
  const mb = new MB();
  for (let k = 0; k < hairs; k++) {
    const a = rng() * TAU, rr = Math.sqrt(rng()) * 0.1;
    const tilt = Math.pow(rng(), 0.7) * 0.55, dir = rng() * TAU;
    const len = 0.6 + rng() * 0.4;
    const d: V3 = [Math.sin(tilt) * Math.cos(dir), Math.cos(tilt), Math.sin(tilt) * Math.sin(dir)];
    const o: V3 = [Math.cos(a) * rr, 0, Math.sin(a) * rr];
    const path: V3[] = [0, 0.5, 1].map((t) => [o[0] + d[0] * len * t, d[1] * len * t, o[2] + d[2] * len * t] as V3);
    tube(mb, path, [0.006, 0.0035, 0], 3, (t) => t);
  }
  return mb.data();
}

/** eco-01: hooded, hunched, teardrop-column figure with two antlers and a ragged drip skirt. Unit height 1.
 * mask: 0 body, 1 eyes (white), 0.5 horns. */
export function blackMonolith(seed = 1): MeshData {
  const rng = mulberry32(seed * 7919);
  const mb = new MB();
  const body: ProfilePt[] = [
    [0, 0.12], [0.085, 0.12], [0.10, 0.2], [0.125, 0.36], [0.16, 0.52], [0.185, 0.64], [0.165, 0.72],
    [0.098, 0.78], [0.07, 0.83], [0.074, 0.88], [0.066, 0.93], [0.04, 0.965], [0, 0.98],
  ];
  const hunch = (y: number) => 0.055 * Math.pow(Math.max(0, (y - 0.45) / 0.5), 1.6);
  const saw = (th: number) => 0.045 * Math.abs(Math.sin(th * 4.5 + seed)) + 0.03 * vnoise(th * 3, seed, 0);
  lathe(mb, body, 20, { yOf: (th, i, y) => (i <= 1 ? y - saw(th) : y) });
  for (let i = 0; i < mb.verts; i++) mb.position[i * 3 + 2] += hunch(mb.position[i * 3 + 1]); // head tilts forward (+z, towards the camera)
  // drip skirt: strands hanging from the hem
  const strands = 13;
  for (let k = 0; k < strands; k++) {
    const th = (k / strands) * TAU + rng() * 0.3, r = 0.075 + rng() * 0.02;
    const y0 = 0.12 - saw(th) * 0.5, drop = 0.11 + rng() * 0.1;
    const o: V3 = [Math.cos(th) * r, y0, Math.sin(th) * r];
    const out: V3 = [Math.cos(th) * 0.012, 0, Math.sin(th) * 0.012];
    tube(mb, [o, [o[0] + out[0], y0 - drop * 0.5, o[2] + out[2]], [o[0] + out[0] * 2, Math.max(0, y0 - drop), o[2] + out[2] * 2]], [0.016, 0.011, 0], 4);
  }
  // antlers
  for (const s of [-1, 1]) {
    const hz = hunch(0.9);
    const path: V3[] = [[0.045 * s, 0.9, hz], [0.1 * s, 0.925, hz], [0.15 * s, 0.97, hz], [0.158 * s, 1.03, hz], [0.135 * s, 1.07, hz]];
    tube(mb, path, [0.019, 0.016, 0.0125, 0.009, 0], 4, () => 0.5);
    tube(mb, [[0.11 * s, 0.94, hz], [0.145 * s, 0.975, hz], [0.185 * s, 0.985, hz]], [0.01, 0.0075, 0], 3, () => 0.5);
  }
  // three white eye dots on the hood, facing +z (the camera)
  for (const [ex, ey] of [[-0.028, 0.9], [0.028, 0.9], [0, 0.935]] as const) {
    const e = new MB();
    const c: V3 = [ex, ey, 0.062 + hunch(ey)];
    const ids = [e.v(c, [0, 0, 1], 1)];
    for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU; ids.push(e.v([c[0] + Math.cos(a) * 0.0105, c[1] + Math.sin(a) * 0.0105, c[2]], [0, 0, 1], 1)); }
    for (let j = 1; j <= 6; j++) e.tri(ids[0], ids[j], ids[(j % 6) + 1], true);
    const o = mb.verts;
    for (const x of e.position) mb.position.push(x);
    for (const x of e.normal) mb.normal.push(x);
    for (const x of e.aux) mb.aux.push(x);
    for (const i of e.index) mb.index.push(i + o);
  }
  return mb.data();
}

/** eco-01 new: flat irregular mat, unit width, ~0.05 thick. */
export function ashMat(seed = 1): MeshData {
  const mb = new MB();
  const S = 26, RING = 5, rows: number[][] = [];
  const stretch = 0.5 + 0.2 * vnoise(seed, 1, 2);
  rows.push([mb.v([0, 0.045, 0], [0, 1, 0], 0)]);
  for (let r = 1; r <= RING; r++) {
    const row: number[] = [];
    for (let j = 0; j <= S; j++) {
      const th = (j / S) * TAU, cs = Math.cos(th), sn = Math.sin(th);
      const edge = 0.5 * (0.72 + 0.55 * fbm(cs * 1.6 + seed, sn * 1.6, seed * 0.7, 3));
      const rho = r / RING, rad = edge * rho;
      const h = 0.045 * (1 - rho * rho * 0.9) + 0.012 * vnoise(cs * rho * 6 + seed, sn * rho * 6, 3) - (r === RING ? 0.03 : 0);
      row.push(mb.v([cs * rad, Math.max(0.003, h), sn * rad * stretch], [0, 1, 0], rho));
    }
    rows.push(row);
  }
  for (let j = 0; j < S; j++) mb.tri(rows[0][0], rows[1][j], rows[1][j + 1]);
  for (let r = 1; r < RING; r++) for (let j = 0; j < S; j++) mb.quad(rows[r][j], rows[r][j + 1], rows[r + 1][j], rows[r + 1][j + 1]);
  mb.smooth();
  return mb.data();
}

/** Pooled-light decal: unit disc in the xz plane (radius 1), mask = radial 0 centre → 1 edge. */
export function lightPool(): MeshData {
  const mb = new MB(), S = 20, R = 4, rows: number[][] = [[mb.v([0, 0, 0], [0, 1, 0], 0)]];
  for (let r = 1; r <= R; r++) { const row: number[] = []; for (let j = 0; j <= S; j++) { const a = (j / S) * TAU; row.push(mb.v([Math.cos(a) * r / R, 0, Math.sin(a) * r / R], [0, 1, 0], r / R)); } rows.push(row); }
  for (let j = 0; j < S; j++) mb.tri(rows[0][0], rows[1][j], rows[1][j + 1], true);
  for (let r = 1; r < R; r++) for (let j = 0; j < S; j++) mb.quad(rows[r][j], rows[r][j + 1], rows[r + 1][j], rows[r + 1][j + 1], true);
  return mb.data();
}

export { merge };
