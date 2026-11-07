// Fauna rendering: ONE shared loft batch (all bodies, one draw call) + one InstancedMesh per part type (shared geometry,
// all creatures), and exactly two materials (the shared world material). Nothing is per creature except buffer slices,
// so a scene can run hundreds of individuals; the GPU-loft path of F §3.6 reads the same spine layout.
import * as THREE from 'three/webgpu';
import { attribute, mix } from 'three/tsl';
import { LINEAR } from '../flora/mesh';
import { worldMaterial } from '../material';
import { tube } from '../geo';
import type { PaletteKey } from '../contracts';
import type { FaunaPlan } from './develop';
import { loftTemplate, writeLoft, type LoftTemplate } from './loft';
import { PART_TYPES, pose, type Instance, type PartType, type Sink } from './rig';
import type { Path } from './path';

// ---- shared part geometry ----------------------------------------------------------------------------------------
/** Non-indexed copy with aBand set per triangle from its centroid (hard palette steps, no blended colours). */
function banded(g: any, band: (c: any) => number, flat: boolean): any {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && (k !== 'normal' || !flat)) geo.deleteAttribute(k);
  if (flat || !geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = p.count, b = new Float32Array(n);
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(p, i + k));
    c.multiplyScalar(1 / 3);
    b[i] = b[i + 1] = b[i + 2] = band(c);
  }
  geo.setAttribute('aBand', new THREE.BufferAttribute(b, 1));
  return geo;
}
const lathe = (pts: [number, number][], segs: number) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

function frillGeometry(): any {
  // fin in local XY: x 0..1 along the body (backwards), y 0..1 up; ribbed, scalloped rim; two-sided slab
  const cols = 12, rows = 4, th = 0.04, pos: number[] = [];
  const rim = (x: number) => Math.max(0.05, Math.sin(Math.PI * Math.min(1, (x + 0.15) / 1.15)) * (0.9 + 0.1 * Math.cos(x * cols * Math.PI)));
  const P = (i: number, j: number, z: number) => { const x = i / cols; return [x, rim(x) * (j / rows), z]; };
  for (const z of [th, -th]) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const a = P(i, j, z), b = P(i + 1, j, z), c = P(i, j + 1, z), d = P(i + 1, j + 1, z);
    const quad = z > 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d];
    for (const q of quad) pos.push(...q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // band 1 = membrane (back colour), 0 = ribs and base (mark colour)
  return banded(g, (c) => (c.y < 0.12 || Math.floor(c.x * cols) % 3 === 0 ? 0 : 1), true);
}

function curvedHorn(): any {
  const path: any[] = [], radii: number[] = [];
  for (let i = 0; i <= 8; i++) { const y = i / 8; path.push(new THREE.Vector3(0, y, 2.2 * y * y)); radii.push(Math.max(0.03, 1 - y)); }
  const g = tube(path, radii, 8);
  g.computeVertexNormals();
  return banded(g, (c) => (c.y > 0.55 ? 1 : 0), false);
}

export function partGeometries(): Record<PartType, any> {
  const eyeRing = banded(new THREE.IcosahedronGeometry(1, 3), (c) => {
    const n = c.clone().normalize();
    const glint = n.distanceTo(new THREE.Vector3(0.32, 0.42, 0.85).normalize()) < 0.2;
    return glint || (n.z > 0.55 && n.z < 0.8) ? 1 : 0;
  }, false);
  const eyeDot = banded(new THREE.IcosahedronGeometry(1, 1), (c) => (c.clone().normalize().distanceTo(new THREE.Vector3(0.35, 0.5, 0.79)) < 0.42 ? 1 : 0), false);
  return {
    rodSi: banded(lathe([[0, 0], [1, 0], [1, 0.06], [0.78, 1], [0, 1]], 6), (c) => (c.y > 0.55 ? 1 : 0), true),
    rodC: banded(lathe([[0, -0.12], [0.7, -0.07], [1, 0.03], [0.8, 1.0], [0.55, 1.07], [0, 1.1]], 10), (c) => (c.y > 0.5 ? 1 : 0), false),
    plateSi: banded(lathe([[0, -0.5], [1, -0.5], [1, 0.1], [0.78, 0.5], [0, 0.5]], 6), (c) => (c.y > 0.25 ? 0 : 1), true),
    plateC: banded(lathe([[0, -0.4], [1, -0.4], [1, -0.1], [0.85, 0.25], [0.5, 0.45], [0, 0.5]], 12), (c) => (c.y > 0 ? 0 : 1), false),
    hornSi: banded(lathe([[0, 0], [1, 0], [0.62, 0.5], [0, 1]], 6), (c) => (c.y > 0.5 ? 1 : 0), true),
    hornC: curvedHorn(),
    frill: frillGeometry(),
    eyeRing, eyeDot,
  };
}

// ---- materials (the only two) ------------------------------------------------------------------------------------
let mats: { loft: any; part: any } | null = null;
export function faunaMaterials() {
  if (!mats) {
    const loft = worldMaterial({ glow: true, bounce: false });
    const part = worldMaterial({ glow: true, bounce: false, colorNode: mix(attribute('iColA', 'vec3'), attribute('iColB', 'vec3'), attribute('aBand', 'float')) });
    mats = { loft, part };
  }
  return mats;
}

// ---- part batches ----------------------------------------------------------------------------------------------
class PartBatch {
  mesh: any; colA: Float32Array; colB: Float32Array; glow: Float32Array; m: Float32Array; n = 0; cap: number;
  aA: any; aB: any; aG: any;
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
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.m = this.mesh.instanceMatrix.array;
  }
  push(o: number[], x: number[], y: number[], z: number[], a: PaletteKey, b: PaletteKey, glow: number) {
    if (this.n >= this.cap) return;
    const i = this.n++, m = this.m, k = i * 16;
    m[k] = x[0]; m[k + 1] = x[1]; m[k + 2] = x[2]; m[k + 3] = 0;
    m[k + 4] = y[0]; m[k + 5] = y[1]; m[k + 6] = y[2]; m[k + 7] = 0;
    m[k + 8] = z[0]; m[k + 9] = z[1]; m[k + 10] = z[2]; m[k + 11] = 0;
    m[k + 12] = o[0]; m[k + 13] = o[1]; m[k + 14] = o[2]; m[k + 15] = 1;
    const ca = LINEAR[a], cb = LINEAR[b];
    this.colA.set(ca, i * 3); this.colB.set(cb, i * 3); this.glow[i] = glow;
  }
  flush() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aA.needsUpdate = this.aB.needsUpdate = this.aG.needsUpdate = true;
  }
}

// ---- the herd: every individual in one loft batch + shared part batches -------------------------------------------
export interface Individual { plan: FaunaPlan; path: Path; inst: Instance }

export function buildHerd(individuals: Individual[], partCap = 4096) {
  const geos = partGeometries();
  const { loft: loftMat, part: partMat } = faunaMaterials();
  const group = new THREE.Group();
  const batches = Object.fromEntries(PART_TYPES.map((t) => [t, new PartBatch(geos[t], partMat, partCap)])) as Record<PartType, PartBatch>;
  for (const t of PART_TYPES) group.add(batches[t].mesh);

  const templates: LoftTemplate[] = individuals.map((d) => loftTemplate(d.plan));
  const offsets: number[] = [];
  let nv = 0;
  for (const tp of templates) { offsets.push(nv); nv += tp.vertexCount; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), glw = new Float32Array(nv);
  const idx: number[] = [];
  templates.forEach((tp, i) => {
    col.set(tp.color, offsets[i] * 3); glw.set(tp.glow, offsets[i]);
    if (tp.index) for (const k of tp.index) idx.push(k + offsets[i]);
    else for (let k = 0; k < tp.vertexCount; k++) idx.push(k + offsets[i]);
  });
  const g = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3), aN = new THREE.BufferAttribute(nor, 3);
  aP.setUsage(THREE.DynamicDrawUsage); aN.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aP); g.setAttribute('normal', aN);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glw, 1));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  const loft = new THREE.Mesh(g, loftMat);
  loft.castShadow = true; loft.receiveShadow = true; loft.frustumCulled = false;
  group.add(loft);

  const sink: Sink = { part: (type, o, x, y, z, a, b, gl) => batches[type].push(o, x, y, z, a, b, gl) };
  const spines: ReturnType<typeof pose>['spine'][] = [];
  function update(t: number) {
    for (const b of Object.values(batches)) b.n = 0;
    individuals.forEach((d, i) => {
      const out = pose(d.plan, t, d.path, d.inst, sink);
      spines[i] = out.spine;
      writeLoft(templates[i], d.plan, out.spine, pos, nor, offsets[i]);
    });
    aP.needsUpdate = aN.needsUpdate = true;
    for (const b of Object.values(batches)) b.flush();
  }
  const stats = () => ({
    individuals: individuals.length, loftVerts: nv,
    parts: Object.fromEntries(PART_TYPES.map((t) => [t, batches[t].n])), drawCalls: 1 + PART_TYPES.length,
  });
  return { group, update, spines, stats };
}
