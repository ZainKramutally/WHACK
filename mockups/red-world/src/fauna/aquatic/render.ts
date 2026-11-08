// Aquarium renderer: every swimmer's tubes and sheets go into TWO dynamic batches (opaque, translucent; one draw each),
// and every part goes into one InstancedMesh per (part type × opacity) with shared unit geometry. Four materials in
// total, none per creature, so the app can draw hundreds of swimmers in at most 15 draw calls.
import * as THREE from 'three/webgpu';
import type { PaletteKey } from '../../contracts';
import { cross, norm, sub, type V3 } from '../../flora/mesh';
import type { Path } from '../path';
import { SWIM_PARTS, type SwimInstance, type SwimPart, type SwimSink, type Swimmer } from './build';
import { aquaMaterial } from './material';
import { linearOf } from './palette';

// ---- shared unit part geometry -----------------------------------------------------------------------------------
function banded(g: any, band: (c: any, n: any) => number, flat: boolean): any {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && (k !== 'normal' || !flat)) geo.deleteAttribute(k);
  if (flat || !geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = p.count, b = new Float32Array(n);
  const c = new THREE.Vector3(), v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(p, k + i));
    c.multiplyScalar(1 / 3);
    nn.copy(c).normalize();
    b[i] = b[i + 1] = b[i + 2] = band(c, nn);
  }
  geo.setAttribute('aBand', new THREE.BufferAttribute(b, 1));
  return geo;
}
const lathe = (pts: [number, number][], segs: number) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

/** Lens-section leaf blade: y 0..1 along the blade, x ±half-chord, z ±1 thickness; band 1 = midrib and root. */
function leaf(): any {
  const cols = 8, rows = 12, pos: number[] = [], idx: number[] = [];
  const w = (y: number) => 0.5 * Math.sin(Math.PI * (0.06 + 0.94 * y)) ** 0.6 * (1 - 0.25 * y);
  for (const side of [1, -1]) {
    const o = pos.length / 3;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const y = j / rows, x = (i / cols - 0.5) * 2 * w(y);
      const z = side * Math.sqrt(Math.max(0, 1 - (x / Math.max(1e-4, w(y))) ** 2)) * (0.3 + 0.7 * (1 - y));
      pos.push(x, y, z);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = o + j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
      if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return banded(g, (c) => (Math.abs(c.x) < 0.05 || c.y < 0.08 ? 1 : 0), false);
}

/** Faceted hexagonal paddle (silicon): flat-shaded slab, band 1 = central ridge. */
function hexPaddle(): any {
  const outline: [number, number][] = [[0, 0], [0.22, 0.12], [0.5, 0.4], [0.5, 0.78], [0.28, 1], [-0.28, 1], [-0.5, 0.78], [-0.5, 0.4], [-0.22, 0.12]];
  const pos: number[] = [];
  const cy = 0.55;
  for (const z of [1, -1]) for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const tri = [[0, cy, z * 1.6], [a[0], a[1], z * 0.6], [b[0], b[1], z * 0.6]];
    if (z < 0) tri.reverse();
    for (const v of tri) pos.push(...v);
  }
  for (let i = 0; i < outline.length; i++) { // rim
    const a = outline[i], b = outline[(i + 1) % outline.length];
    pos.push(a[0], a[1], 0.6, a[0], a[1], -0.6, b[0], b[1], 0.6, b[0], b[1], 0.6, a[0], a[1], -0.6, b[0], b[1], -0.6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return banded(g, (c) => (Math.abs(c.x) < 0.12 && Math.abs(c.z) > 0.8 ? 1 : 0), true);
}

export function swimPartGeometries(): Record<SwimPart, any> {
  const glint = new THREE.Vector3(0.35, 0.45, 0.82).normalize();
  const torus = new THREE.TorusGeometry(1, 0.16, 6, 16);
  torus.rotateX(Math.PI / 2);
  const dome = new THREE.SphereGeometry(1, 12, 5, 0, 2 * Math.PI, 0, Math.PI / 2);
  return {
    eye: banded(new THREE.IcosahedronGeometry(1, 3), (_c, n) => (n.distanceTo(glint) < 0.34 ? 1 : 0), false),
    dot: banded(new THREE.IcosahedronGeometry(1, 1), () => 0, false),
    rod: banded(lathe([[0, -0.04], [1, 0], [0.92, 0.5], [0.72, 1], [0, 1.04]], 8), () => 0, false),
    rodSi: banded(lathe([[0, 0], [1, 0], [0.82, 0.88], [0, 1]], 6), (c) => (c.y > 0.85 ? 1 : 0), true),
    blade: leaf(),
    bladeSi: hexPaddle(),
    plate: banded(dome, (c) => (c.y < 0.28 ? 1 : 0), false),
    crystal: banded(lathe([[0, -1], [1, -0.22], [1, 0.22], [0, 1]], 6), (c) => (c.y > 0.25 ? 1 : 0), true),
    ring: banded(torus, (c) => (Math.hypot(c.x, c.z) < 0.95 ? 1 : 0), false),
  };
}

// ---- part batches -------------------------------------------------------------------------------------------------
class PartBatch {
  mesh: any; colA: Float32Array; colB: Float32Array; glow: Float32Array; m: Float32Array; n = 0; cap: number; aA: any; aB: any; aG: any;
  constructor(geo: any, mat: any, cap: number) {
    this.cap = cap;
    const g = geo.clone();
    this.colA = new Float32Array(cap * 3); this.colB = new Float32Array(cap * 3); this.glow = new Float32Array(cap);
    this.aA = new THREE.InstancedBufferAttribute(this.colA, 3); this.aB = new THREE.InstancedBufferAttribute(this.colB, 3);
    this.aG = new THREE.InstancedBufferAttribute(this.glow, 1);
    for (const a of [this.aA, this.aB, this.aG]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iColA', this.aA); g.setAttribute('iColB', this.aB); g.setAttribute('aGlow', this.aG);
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.m = this.mesh.instanceMatrix.array;
  }
  push(o: V3, x: V3, y: V3, z: V3, ca: V3, cb: V3, glow: number) {
    if (this.n >= this.cap) return;
    const i = this.n++, m = this.m, k = i * 16;
    m[k] = x[0]; m[k + 1] = x[1]; m[k + 2] = x[2]; m[k + 3] = 0;
    m[k + 4] = y[0]; m[k + 5] = y[1]; m[k + 6] = y[2]; m[k + 7] = 0;
    m[k + 8] = z[0]; m[k + 9] = z[1]; m[k + 10] = z[2]; m[k + 11] = 0;
    m[k + 12] = o[0]; m[k + 13] = o[1]; m[k + 14] = o[2]; m[k + 15] = 1;
    this.colA.set(ca, i * 3); this.colB.set(cb, i * 3); this.glow[i] = glow;
  }
  flush() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aA.needsUpdate = this.aB.needsUpdate = this.aG.needsUpdate = true;
  }
}

// ---- dynamic tube/sheet batch ----------------------------------------------------------------------------------------
interface Slot { kind: 'tube' | 'sheet'; off: number; rings: number; sides: number; flat: boolean; cos: number[]; sin: number[] }
/** Shared scratch for ring points (grows to the largest tube). */
let SCRATCH = new Float64Array(0);
const scratch = (n: number) => (SCRATCH.length >= n ? SCRATCH : (SCRATCH = new Float64Array(n)));
class DynBatch {
  slots: Slot[] = []; nv = 0; idx: number[] = [];
  pos!: Float32Array; nor!: Float32Array; col!: Float32Array; glw!: Float32Array; mesh: any; aP: any; aN: any;
  colours: { off: number; count: number; c: V3; g: number }[] = [];
  add(kind: 'tube' | 'sheet', rings: number, sides: number, flat: boolean, c: V3, glow: number, theta0 = 0): number {
    const theta = Array.from({ length: sides }, (_, j) => theta0 + (j * 2 * Math.PI) / sides);
    const off = this.nv;
    let count: number;
    if (kind === 'tube' && flat) count = (rings - 1) * sides * 6;
    else {
      count = kind === 'tube' ? rings * sides : rings * 2;
      if (kind === 'tube') for (let i = 0; i < rings - 1; i++) for (let j = 0; j < sides; j++) {
        const a = off + i * sides + j, b = off + i * sides + ((j + 1) % sides), cc = a + sides, d = b + sides;
        this.idx.push(a, b, cc, b, d, cc);
      }
      else for (let i = 0; i < rings - 1; i++) { const a = off + i * 2, b = a + 1, cc = a + 2, d = a + 3; this.idx.push(a, cc, b, b, cc, d); }
    }
    if (kind === 'tube' && flat) for (let k = 0; k < count; k++) this.idx.push(off + k);
    this.nv += count;
    this.colours.push({ off, count, c, g: glow });
    this.slots.push({ kind, off, rings, sides, flat, cos: theta.map(Math.cos), sin: theta.map(Math.sin) });
    return this.slots.length - 1;
  }
  finish(mat: any) {
    const n = Math.max(3, this.nv);
    this.pos = new Float32Array(n * 3); this.nor = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.glw = new Float32Array(n);
    for (const c of this.colours) for (let k = 0; k < c.count; k++) { this.col.set(c.c, (c.off + k) * 3); this.glw[c.off + k] = c.g; }
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.pos, 3); this.aN = new THREE.BufferAttribute(this.nor, 3);
    this.aP.setUsage(THREE.DynamicDrawUsage); this.aN.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('normal', this.aN);
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(this.glw, 1));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.idx.length ? this.idx : [0, 0, 0]), 1));
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = this.nv > 0;
  }
  tube(si: number, c: V3[], U: V3[], R: V3[], rw: number[], rh: number[], top = 1) {
    // hot path (every tube vertex, every frame): ring points go into a shared scratch buffer, normals are computed in place
    const s = this.slots[si], S = s.sides, nr = s.rings, pos = this.pos, nor = this.nor;
    const G = scratch(nr * S * 3);
    for (let i = 0; i < nr; i++) {
      const ci = c[i], Ri = R[i], Ui = U[i];
      for (let j = 0; j < S; j++) {
        const w = rw[i] * s.cos[j], h = rh[i] * s.sin[j] * (s.sin[j] > 0 ? top : 1), k = (i * S + j) * 3;
        G[k] = ci[0] + Ri[0] * w + Ui[0] * h; G[k + 1] = ci[1] + Ri[1] * w + Ui[1] * h; G[k + 2] = ci[2] + Ri[2] * w + Ui[2] * h;
      }
    }
    if (!s.flat) {
      for (let i = 0; i < nr; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(nr - 1, i + 1);
        for (let j = 0; j < S; j++) {
          const k = (i * S + j) * 3, ka = (i * S + ((j + 1) % S)) * 3, kb = (i * S + ((j - 1 + S) % S)) * 3;
          const k1 = (i1 * S + j) * 3, k0 = (i0 * S + j) * 3;
          const ax = G[ka] - G[kb], ay = G[ka + 1] - G[kb + 1], az = G[ka + 2] - G[kb + 2]; // around the ring
          let bx = G[k1] - G[k0], by = G[k1 + 1] - G[k0 + 1], bz = G[k1 + 2] - G[k0 + 2];    // along the body
          if (bx * bx + by * by + bz * bz < 1e-14) { bx = c[i1][0] - c[i0][0]; by = c[i1][1] - c[i0][1]; bz = c[i1][2] - c[i0][2]; }
          let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          if (rw[i] < 1e-6) { // a closed tip: the normal points out along the axis
            const sg = i === 0 ? 1 : -1;
            nx = sg * (c[i0][0] - c[i1][0]); ny = sg * (c[i0][1] - c[i1][1]); nz = sg * (c[i0][2] - c[i1][2]);
          }
          const l = Math.hypot(nx, ny, nz);
          if (l > 0) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
          const o = (s.off + i * S + j) * 3;
          pos[o] = G[k]; pos[o + 1] = G[k + 1]; pos[o + 2] = G[k + 2];
          nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
        }
      }
      return;
    }
    // faceted: two triangles per quad, one flat normal per quad
    let v = s.off * 3;
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < S; j++) {
      const a = (i * S + j) * 3, b = (i * S + ((j + 1) % S)) * 3, cc = ((i + 1) * S + j) * 3, d = ((i + 1) * S + ((j + 1) % S)) * 3;
      let ux = G[b] - G[a], uy = G[b + 1] - G[a + 1], uz = G[b + 2] - G[a + 2];
      let wx = G[cc] - G[a], wy = G[cc + 1] - G[a + 1], wz = G[cc + 2] - G[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      if (nx * nx + ny * ny + nz * nz < 1e-16) { // degenerate at a tip: use the other triangle of the quad
        ux = G[d] - G[b]; uy = G[d + 1] - G[b + 1]; uz = G[d + 2] - G[b + 2];
        wx = G[cc] - G[b]; wy = G[cc + 1] - G[b + 1]; wz = G[cc + 2] - G[b + 2];
        nx = uy * wz - uz * wy; ny = uz * wx - ux * wz; nz = ux * wy - uy * wx;
      }
      const l = Math.hypot(nx, ny, nz);
      if (l > 0) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
      for (const q of [a, b, cc, b, d, cc]) {
        pos[v] = G[q]; pos[v + 1] = G[q + 1]; pos[v + 2] = G[q + 2];
        nor[v] = nx; nor[v + 1] = ny; nor[v + 2] = nz;
        v += 3;
      }
    }
  }
  sheet(si: number, A: V3[], B: V3[]) {
    const s = this.slots[si], n = s.rings, pos = this.pos, nor = this.nor;
    for (let i = 0; i < n; i++) {
      const along = sub(A[Math.min(n - 1, i + 1)], A[Math.max(0, i - 1)]);
      let nn = cross(along, sub(B[i], A[i]));
      if (nn[0] * nn[0] + nn[1] * nn[1] + nn[2] * nn[2] < 1e-18) nn = i > 0 ? [nor[(s.off + i * 2 - 2) * 3], nor[(s.off + i * 2 - 2) * 3 + 1], nor[(s.off + i * 2 - 2) * 3 + 2]] : [0, 1, 0];
      nn = norm(nn);
      for (const [k, q] of [[0, A[i]], [1, B[i]]] as [number, V3][]) {
        const o = (s.off + i * 2 + k) * 3;
        pos[o] = q[0]; pos[o + 1] = q[1]; pos[o + 2] = q[2];
        nor[o] = nn[0]; nor[o + 1] = nn[1]; nor[o + 2] = nn[2];
      }
    }
  }
  flush() { this.aP.needsUpdate = this.aN.needsUpdate = true; }
}

// ---- the aquarium -----------------------------------------------------------------------------------------------------
export interface SwimEntry { sw: Swimmer; path: Path; inst: SwimInstance }

let MATS: { dyn: any; dynT: any; part: any; partT: any } | null = null;
export function aquaMaterials() {
  if (!MATS) MATS = {
    dyn: aquaMaterial(), dynT: aquaMaterial({ translucent: true }),
    part: aquaMaterial({ instanced: true }), partT: aquaMaterial({ instanced: true, translucent: true }),
  };
  return MATS;
}
let GEOS: Record<SwimPart, any> | null = null;

export function buildAquarium(entries: SwimEntry[], partCap = Math.max(4000, 200 * entries.length)) {
  GEOS ??= swimPartGeometries();
  const mats = aquaMaterials();
  const group = new THREE.Group();
  const opaque: Record<string, PartBatch> = {}, trans: Record<string, PartBatch> = {};
  for (const t of SWIM_PARTS) {
    opaque[t] = new PartBatch(GEOS[t], mats.part, partCap);
    group.add(opaque[t].mesh);
    if (t === 'blade' || t === 'bladeSi' || t === 'crystal' || t === 'rodSi') {
      trans[t] = new PartBatch(GEOS[t], mats.partT, Math.ceil(partCap / 3));
      trans[t].mesh.renderOrder = 2;
      group.add(trans[t].mesh);
    }
  }
  const dyn = new DynBatch(), dynT = new DynBatch();
  const maps = entries.map((e) => {
    const chem = e.sw.params.chemistry;
    const tubes = e.sw.tubes.map((tb) => { const b = tb.translucent ? dynT : dyn; return { b, i: b.add('tube', tb.rings, tb.sides, tb.flat, linearOf(chem, tb.colour), tb.glow, tb.theta0) }; });
    const sheets = e.sw.sheets.map((sh) => { const b = sh.translucent ? dynT : dyn; return { b, i: b.add('sheet', sh.cols, 0, false, linearOf(chem, sh.colour), sh.glow) }; });
    return { tubes, sheets };
  });
  dyn.finish(mats.dyn); dynT.finish(mats.dynT);
  dynT.mesh.renderOrder = 1;
  group.add(dyn.mesh, dynT.mesh);

  const centres: V3[] = entries.map(() => [0, 0, 0]);
  const forwards: V3[] = entries.map(() => [1, 0, 0]);
  function update(t: number) {
    for (const b of Object.values(opaque)) b.n = 0;
    for (const b of Object.values(trans)) b.n = 0;
    entries.forEach((e, k) => {
      const chem = e.sw.params.chemistry, mp = maps[k];
      const sink: SwimSink = {
        tube: (i, c, U, R, rw, rh, top) => mp.tubes[i].b.tube(mp.tubes[i].i, c, U, R, rw, rh, top),
        sheet: (i, a, b) => mp.sheets[i].b.sheet(mp.sheets[i].i, a, b),
        part: (type, o, x, y, z, a: PaletteKey, b: PaletteKey, glow, tr) => {
          const batch = tr && trans[type] ? trans[type] : opaque[type];
          batch.push(o, x, y, z, linearOf(chem, a), linearOf(chem, b), glow);
        },
      };
      const r = e.sw.pose(t, e.path, e.inst, sink);
      centres[k] = r.centre; forwards[k] = r.forward;
    });
    dyn.flush(); dynT.flush();
    for (const b of Object.values(opaque)) b.flush();
    for (const b of Object.values(trans)) b.flush();
  }
  const stats = () => ({
    swimmers: entries.length, dynVerts: dyn.nv + dynT.nv,
    parts: Object.values(opaque).reduce((a, b) => a + b.n, 0) + Object.values(trans).reduce((a, b) => a + b.n, 0),
    drawCalls: 2 + Object.values(opaque).filter((b) => b.n > 0).length + Object.values(trans).filter((b) => b.n > 0).length,
  });
  function dispose() {
    for (const b of [...Object.values(opaque), ...Object.values(trans)]) b.mesh.geometry.dispose();
    dyn.mesh.geometry.dispose(); dynT.mesh.geometry.dispose();
  }
  return { group, update, stats, centres, forwards, dispose };
}
export type Aquarium = ReturnType<typeof buildAquarium>;
