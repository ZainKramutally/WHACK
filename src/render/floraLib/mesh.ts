// Ring-stack mesh builder for flora, ported from mockups/red-world/src/flora/mesh.ts (copied and adapted, never imported).
// Every part (stalk, cap, pod, spike, filament) is a stack of rings swept along an axis or a curve. Colour and glow are
// per *band* (ring i → i+1), so bands are flat palette colours with hard steps. Sway is per ring (continuous).
//
// Differences from the reference:
//  - Vertices store a palette KEY, not a colour. `paint()` (index.ts) writes the linear-rgb `color` attribute from the
//    active palette, so one geometry serves both worlds' palettes and the darker foreground shift.
//  - Glow is a *site* weight. The final `aGlow` = site × form.glow (darkness), written by `paint()`. A site that is not
//    glowing is painted as pale tissue (bone / blush), so no fixed cyan survives in bright light.
//  - A global detail scale (setDetail) thins ring segments for the far LOD; small counts (≤ 6, facets) never change.
//  - build({ flat: true }) de-indexes and recomputes normals: true facets for silicon.
import { BufferAttribute, BufferGeometry } from 'three/webgpu';

export type V3 = [number, number, number];

/** Palette roles flora uses (a subset of the look palette's keys). */
export type FloraKey = 'ink' | 'maroon' | 'crimson' | 'blush' | 'bone' | 'glow' | 'glowDeep';
export const FLORA_KEYS: readonly FloraKey[] = ['ink', 'maroon', 'crimson', 'blush', 'bone', 'glow', 'glowDeep'];
const KEY_INDEX = Object.fromEntries(FLORA_KEYS.map((k, i) => [k, i])) as Record<FloraKey, number>;
/** Tissue a glow site shows when it is not glowing. */
const TISSUE: Partial<Record<FloraKey, FloraKey>> = { glow: 'bone', glowDeep: 'blush' };

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scl = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Rotate v around unit axis k by angle a (Rodrigues). */
export const rotate = (v: V3, k: V3, a: number): V3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(scl(v, c), scl(cross(k, v), s)), scl(k, dot(k, v) * (1 - c)));
};
/** Any unit vector perpendicular to t. */
export const perp = (t: V3): V3 => norm(Math.abs(t[1]) < 0.9 ? cross(t, [0, 1, 0]) : cross(t, [1, 0, 0]));

let SEG_SCALE = 1;
/** Ring-segment scale for the next builds (1 = near LOD). Every count scales, but never below 3 (thin filaments). */
export function setDetail(scale: number) { SEG_SCALE = scale; }
const segsFor = (segs: number) => (SEG_SCALE >= 1 ? segs : Math.max(3, Math.round(segs * SEG_SCALE)));

export interface Ring {
  c: V3; t: V3; u: V3; r: number;
  key: FloraKey;
  glow?: number;
  sway: number;
  crease?: boolean;
  mod?: (j: number, theta: number) => number;
  lift?: (j: number, theta: number) => number;
}

const POLE = 1e-6;

export interface BuiltPlant {
  geometry: BufferGeometry;
  height: number;
  radius: number;
  triangles: number;
  /** Per vertex: tissue palette key index into FLORA_KEYS. */
  keys: Uint8Array;
  /** Per vertex: 0 none, else the FLORA_KEYS index of the glow colour (glow / glowDeep). */
  glowKey: Uint8Array;
  /** Per vertex: glow site weight 0..1 (aGlow = site × form.glow). */
  site: Float32Array;
}

export class MeshBuilder {
  pos: number[] = [];
  nor: number[] = [];
  key: number[] = [];
  gk: number[] = [];
  site: number[] = [];
  swy: number[] = [];
  idx: number[] = [];

  vert(p: V3, n: V3, key: FloraKey, glow: number, sway: number) {
    const tissue = TISSUE[key];
    const isSite = tissue !== undefined || glow > 0;
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.key.push(KEY_INDEX[tissue ?? key]);
    this.gk.push(isSite ? KEY_INDEX[tissue ? key : 'glow'] : 0);
    this.site.push(isSite ? clamp01(glow) : 0);
    this.swy.push(clamp01(sway));
    return this.pos.length / 3 - 1;
  }

  /** Emit a ring stack (outward faces assume rings travel bottom → top of a solid's profile). */
  stack(rings: Ring[], segsIn: number, phase = 0) {
    const n = rings.length;
    if (n < 2) return;
    const segs = segsFor(segsIn);
    const P: V3[][] = rings.map((R) => {
      const v = cross(R.u, R.t);
      if (R.r <= POLE) return [R.c];
      const row: V3[] = [];
      for (let j = 0; j < segs; j++) {
        const th = phase + (j / segs) * Math.PI * 2;
        // mod/lift take the reference's vertex index; map back so pleats keep their parity at lower detail
        const jj = Math.round((j * segsIn) / segs);
        const r = R.r * (R.mod ? R.mod(jj, th) : 1);
        const l = R.lift ? R.lift(jj, th) : 0;
        const d = add(scl(R.u, Math.cos(th) * r), scl(v, Math.sin(th) * r));
        row.push(add(add(R.c, d), scl(R.t, l)));
      }
      return row;
    });
    const at = (i: number, j: number): V3 => (P[i].length === 1 ? P[i][0] : P[i][((j % segs) + segs) % segs]);
    const normalAt = (i: number, j: number, a: number, b: number): V3 => {
      if (P[i].length === 1) {
        const nb = i === b ? a : b;
        let acc: V3 = [0, 0, 0];
        for (let k = 0; k < segs; k++) {
          const ds = nb > i ? sub(at(nb, k), at(i, k)) : sub(at(i, k), at(nb, k));
          const dth = sub(at(nb, k + 1), at(nb, k - 1));
          acc = add(acc, norm(cross(ds, dth)));
        }
        return norm(acc);
      }
      const ds = sub(at(b, j), at(a, j));
      const dth = sub(at(i, j + 1), at(i, j - 1));
      return norm(cross(ds, dth));
    };
    const bandKey = (i: number) => rings[i].key;
    const bandGlow = (i: number) => rings[i].glow ?? 0;
    const inRow: number[][] = [];
    const outRow: number[][] = [];
    const emitRow = (i: number, band: number, a: number, b: number) => {
      const out: number[] = [];
      for (let j = 0; j < P[i].length; j++) out.push(this.vert(P[i][j], normalAt(i, j, a, b), bandKey(band), bandGlow(band), rings[i].sway));
      return out;
    };
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      if (i === 0) { outRow[i] = emitRow(i, 0, i, b); continue; }
      if (i === n - 1) { inRow[i] = emitRow(i, n - 2, a, i); continue; }
      const split = rings[i].crease || bandKey(i - 1) !== bandKey(i) || bandGlow(i - 1) !== bandGlow(i);
      if (!split) { inRow[i] = outRow[i] = emitRow(i, i, a, b); continue; }
      const cr = !!rings[i].crease;
      inRow[i] = emitRow(i, i - 1, a, cr ? i : b);
      outRow[i] = emitRow(i, i, cr ? i : a, b);
    }
    for (let i = 0; i < n - 1; i++) {
      const A = outRow[i], B = inRow[i + 1];
      for (let j = 0; j < segs; j++) {
        const a0 = A.length === 1 ? A[0] : A[j], a1 = A.length === 1 ? A[0] : A[(j + 1) % segs];
        const b0 = B.length === 1 ? B[0] : B[j], b1 = B.length === 1 ? B[0] : B[(j + 1) % segs];
        if (A.length > 1) this.idx.push(a0, b0, a1);
        if (B.length > 1) this.idx.push(a1, b0, b1);
      }
    }
  }

  get triangles() { return this.idx.length / 3; }

  /** Finish: lift so min y = 0, keep the x/z origin (base centre). `flat` gives faceted normals (silicon). */
  build(opts: { flat?: boolean } = {}): BuiltPlant {
    let minY = Infinity, maxY = -Infinity, rad = 0;
    for (let i = 0; i < this.pos.length; i += 3) {
      minY = Math.min(minY, this.pos[i + 1]);
      maxY = Math.max(maxY, this.pos[i + 1]);
      rad = Math.max(rad, Math.hypot(this.pos[i], this.pos[i + 2]));
    }
    const pos = new Float32Array(this.pos);
    for (let i = 1; i < pos.length; i += 3) pos[i] -= minY;
    let g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('aSway', new BufferAttribute(new Float32Array(this.swy), 1));
    g.setAttribute('aKey', new BufferAttribute(new Float32Array(this.key), 1));
    g.setAttribute('aGk', new BufferAttribute(new Float32Array(this.gk), 1));
    g.setAttribute('aSite', new BufferAttribute(new Float32Array(this.site), 1));
    const vcount = pos.length / 3;
    g.setIndex(new BufferAttribute(vcount > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    if (opts.flat) {
      g = g.toNonIndexed();
      g.computeVertexNormals();
    }
    const take = (name: string) => {
      const a = g.getAttribute(name).array as Float32Array;
      g.deleteAttribute(name);
      return a;
    };
    const keyF = take('aKey'), gkF = take('aGk'), site = take('aSite');
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aGlow', new BufferAttribute(new Float32Array(n), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return {
      geometry: g, height: maxY - minY, radius: rad, triangles: this.triangles,
      keys: Uint8Array.from(keyF), glowKey: Uint8Array.from(gkF), site: Float32Array.from(site),
    };
  }
}

// ---------------------------------------------------------------------------------------------------
// Part helpers (as the reference)

export interface ProfilePt {
  r: number; y: number; key: FloraKey; sway: number; glow?: number; crease?: boolean;
  mod?: Ring['mod']; lift?: Ring['lift'];
}

/** Surface of revolution around `axis` through `origin`. Profile runs bottom → top of the solid. */
export function revolve(b: MeshBuilder, origin: V3, axis: V3, profile: ProfilePt[], segs: number, phase = 0, u?: V3) {
  const t = norm(axis);
  const uu = u ? norm(sub(u, scl(t, dot(u, t)))) : perp(t);
  b.stack(profile.map((p) => ({
    c: add(origin, scl(t, p.y)), t, u: uu, r: p.r, key: p.key, glow: p.glow, sway: p.sway,
    crease: p.crease, mod: p.mod, lift: p.lift,
  })), segs, phase);
}

export interface SweepOpts {
  segs: number;
  radius: (s: number, i: number) => number;
  key: (s: number, i: number) => FloraKey;
  sway: (s: number, p: V3) => number;
  glow?: (s: number) => number;
  mod?: (s: number) => Ring['mod'];
  crease?: (i: number) => boolean;
  u0?: V3;
  phase?: number;
}

/** Tube along a polyline with parallel-transport frames. Returns the frames (for attaching parts). */
export function sweep(b: MeshBuilder, pts: V3[], o: SweepOpts) {
  const n = pts.length;
  const T: V3[] = pts.map((_, i) => norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
  const U: V3[] = [];
  let u = o.u0 ? norm(sub(o.u0, scl(T[0], dot(o.u0, T[0])))) : perp(T[0]);
  for (let i = 0; i < n; i++) {
    if (i > 0) { u = sub(u, scl(T[i], dot(u, T[i]))); u = len(u) < 1e-6 ? perp(T[i]) : norm(u); }
    U.push(u);
  }
  const S: number[] = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = S[n - 1] || 1;
  b.stack(pts.map((c, i) => {
    const s = S[i] / L;
    return {
      c, t: T[i], u: U[i], r: o.radius(s, i), key: o.key(s, i), glow: o.glow?.(s), sway: o.sway(s, c),
      mod: o.mod?.(s), crease: o.crease?.(i),
    };
  }), o.segs, o.phase ?? 0);
  return { T, U, S, L };
}

/** Sample a cubic Bezier into n+1 points. */
export function bezier(p0: V3, p1: V3, p2: V3, p3: V3, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    out.push(add(add(scl(p0, m * m * m), scl(p1, 3 * m * m * t)), add(scl(p2, 3 * m * t * t), scl(p3, t * t * t))));
  }
  return out;
}

/** Small sphere-ish bead (pod core, pore). rings = latitude bands. */
export function bead(b: MeshBuilder, c: V3, axis: V3, r: number, segs: number, rings: number, key: FloraKey, glow: number, sway: number) {
  const prof: ProfilePt[] = [];
  for (let i = 0; i <= rings; i++) {
    const a = -Math.PI / 2 + (i / rings) * Math.PI;
    prof.push({ r: i === 0 || i === rings ? 0 : Math.cos(a) * r, y: Math.sin(a) * r, key, glow, sway });
  }
  revolve(b, c, axis, prof, segs);
}

/** Two-sided sheet over a grid G[i][j]. Each band (row i → i+1) gets its own rows so colours stay flat steps. */
export function sheet(b: MeshBuilder, G: V3[][], key: (i: number) => FloraKey, sway: (p: V3) => number, thick: number, skip?: (i: number, j: number) => boolean) {
  const rows = G.length, cols = G[0].length;
  const nrm = (i: number, j: number): V3 => {
    const dr = sub(G[Math.min(rows - 1, i + 1)][j], G[Math.max(0, i - 1)][j]);
    const dc = sub(G[i][Math.min(cols - 1, j + 1)], G[i][Math.max(0, j - 1)]);
    return norm(cross(dr, dc));
  };
  const N = G.map((row, i) => row.map((_, j) => nrm(i, j)));
  const v = b.vert.bind(b);
  for (let i = 0; i < rows - 1; i++) {
    for (const side of [1, -1]) {
      const A: number[] = [], B: number[] = [];
      for (let j = 0; j < cols; j++) {
        const na = scl(N[i][j], side), nb = scl(N[i + 1][j], side);
        A.push(v(add(G[i][j], scl(na, thick)), na, key(i), 0, sway(G[i][j])));
        B.push(v(add(G[i + 1][j], scl(nb, thick)), nb, key(i), 0, sway(G[i + 1][j])));
      }
      for (let j = 0; j < cols - 1; j++) {
        if (skip?.(i, j)) continue;
        if (side > 0) b.idx.push(A[j], B[j], A[j + 1], A[j + 1], B[j], B[j + 1]);
        else b.idx.push(A[j], A[j + 1], B[j], A[j + 1], B[j + 1], B[j]);
      }
    }
  }
}

/** Planar curve by integrating a tangent angle theta(s) (radians from horizontal) in the plane (dir, up). */
export function curl(o: V3, dir: V3, length: number, n: number, theta: (s: number) => number): V3[] {
  const pts: V3[] = [o];
  let p = o;
  for (let i = 1; i <= n; i++) {
    const s = (i - 0.5) / n, th = theta(s), d = length / n;
    p = add(p, add(scl(dir, Math.cos(th) * d), [0, Math.sin(th) * d, 0]));
    pts.push(p);
  }
  return pts;
}

/** Straight faceted prism/rod from a to b (silicon): `segs` sides, radius r0 → r1, optional pointed tip. */
export function rod(b: MeshBuilder, a: V3, e: V3, r0: number, r1: number, segs: number, key: (s: number) => FloraKey, sway: (s: number) => number, tip = 0, phase = 0) {
  const ax = sub(e, a), L = len(ax);
  const prof: ProfilePt[] = [
    { r: r0, y: 0, key: key(0), sway: sway(0), crease: true },
    { r: (r0 + r1) / 2, y: L * 0.5, key: key(0.5), sway: sway(0.5), crease: true },
    { r: r1, y: L, key: key(1), sway: sway(1), crease: true },
  ];
  if (tip > 0) prof.push({ r: 0, y: L + tip, key: key(1), sway: sway(1) });
  else prof.push({ r: 0, y: L, key: key(1), sway: sway(1) });
  revolve(b, a, ax, prof, segs, phase);
}
