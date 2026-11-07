// Tiny pure mesh builder (no three.js) so shapes can be unit-tested for triangle counts.
export type V3 = [number, number, number];

export interface MeshData {
  position: number[]; normal: number[]; aux: number[]; // aux = vec4: xyz offset (shape-specific), w = mask
  index: number[];
}

function h3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = (t: number) => t * t * (3 - 2 * t);
export function vnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx), fy),
    l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  );
}
export function fbm(x: number, y: number, z: number, oct = 4): number {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct));
}

export class MB {
  position: number[] = []; normal: number[] = []; aux: number[] = []; index: number[] = [];
  get verts() { return this.position.length / 3; }
  get tris() { return this.index.length / 3; }

  v(p: V3, n: V3 = [0, 1, 0], mask = 0, off: V3 = [0, 0, 0]): number {
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.position.push(p[0], p[1], p[2]);
    this.normal.push(n[0] / l, n[1] / l, n[2] / l);
    this.aux.push(off[0], off[1], off[2], mask);
    return this.verts - 1;
  }

  /** Triangle; winding is auto-flipped to agree with the vertex normals (so shapes never come out inside-out). */
  tri(a: number, b: number, c: number, doubleSided = false) {
    const P = this.position, N = this.normal;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (!doubleSided && fx * nx + fy * ny + fz * nz < 0) this.index.push(a, c, b);
    else this.index.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number, ds = false) { this.tri(a, b, c, ds); this.tri(c, b, d, ds); }

  /** Recompute smooth normals from faces (for hand-built blobs/strips). */
  smooth() {
    const n = new Array(this.position.length).fill(0), P = this.position;
    for (let i = 0; i < this.index.length; i += 3) {
      const [a, b, c] = [this.index[i], this.index[i + 1], this.index[i + 2]];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const f = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (const k of [a, b, c]) for (let j = 0; j < 3; j++) n[k * 3 + j] += f[j];
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
      this.normal[i] = n[i] / l; this.normal[i + 1] = n[i + 1] / l; this.normal[i + 2] = n[i + 2] / l;
    }
  }

  data(): MeshData { return { position: this.position, normal: this.normal, aux: this.aux, index: this.index }; }
}

export type ProfilePt = [r: number, y: number, mask?: number];

/** Surface of revolution. Analytic normals from the profile (outward = (dy, -dr)). `radial(theta, i)` modulates r. */
export function lathe(mb: MB, prof: ProfilePt[], segs: number, opt: { radial?: (th: number, i: number) => number; yOf?: (th: number, i: number, y: number) => number; center?: V3 } = {}) {
  const c = opt.center ?? [0, 0, 0];
  const rows: number[][] = [];
  for (let i = 0; i < prof.length; i++) {
    const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1];
    const row: number[] = [];
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      const r = prof[i][0] * (opt.radial ? opt.radial(th, i) : 1);
      const y = opt.yOf ? opt.yOf(th, i, prof[i][1]) : prof[i][1];
      const cs = Math.cos(th), sn = Math.sin(th);
      row.push(mb.v([c[0] + r * cs, c[1] + y, c[2] + r * sn], [dy * cs, -dr, dy * sn], prof[i][2] ?? 0, [r * cs, y - 0, r * sn]));
    }
    rows.push(row);
  }
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = rows[i][j], b = rows[i][j + 1], c2 = rows[i + 1][j], d = rows[i + 1][j + 1];
      if (prof[i][0] < 1e-6 && prof[i + 1][0] < 1e-6) continue;
      if (prof[i][0] < 1e-6) mb.tri(a, c2, d);
      else if (prof[i + 1][0] < 1e-6) mb.tri(a, b, c2);
      else mb.quad(a, b, c2, d);
    }
  }
}

/** Tapered tube along a polyline, radius per point, closed to a point if the last radius is 0. */
export function tube(mb: MB, path: V3[], radii: number[], radial: number, mask: (t: number) => number = () => 0) {
  const rows: number[][] = [];
  let up: V3 = Math.abs(path[1][1] - path[0][1]) > 0.9 * Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1], path[1][2] - path[0][2]) ? [1, 0, 0] : [0, 1, 0];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let t: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const tl = Math.hypot(...t) || 1; t = [t[0] / tl, t[1] / tl, t[2] / tl];
    // frame: u = up × t, w = t × u
    let u: V3 = [up[1] * t[2] - up[2] * t[1], up[2] * t[0] - up[0] * t[2], up[0] * t[1] - up[1] * t[0]];
    const ul = Math.hypot(...u) || 1; u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const w: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
    up = w; // transport
    const row: number[] = [];
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
      const n: V3 = [u[0] * cs + w[0] * sn, u[1] * cs + w[1] * sn, u[2] * cs + w[2] * sn];
      const r = radii[i];
      row.push(mb.v([path[i][0] + n[0] * r, path[i][1] + n[1] * r, path[i][2] + n[2] * r], n, mask(i / (path.length - 1))));
    }
    rows.push(row);
  }
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j], d = rows[i + 1][j + 1];
      if (radii[i + 1] < 1e-6) mb.tri(a, b, c); else mb.quad(a, b, c, d);
    }
  }
  return path[0];
}

export function merge(parts: MB[]): MeshData {
  const out = new MB();
  for (const p of parts) {
    const o = out.verts;
    for (const x of p.position) out.position.push(x);
    for (const x of p.normal) out.normal.push(x);
    for (const x of p.aux) out.aux.push(x);
    for (const i of p.index) out.index.push(i + o);
  }
  return out.data();
}
