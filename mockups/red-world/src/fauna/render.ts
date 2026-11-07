// Fauna rendering: ONE shared loft batch (all bodies, one draw call) + one InstancedMesh per part type (shared geometry,
// all creatures), and exactly two materials (the shared world material). Nothing is per creature except buffer slices,
// so a scene can run hundreds of individuals; the GPU-loft path of F §3.6 reads the same spine layout.
import * as THREE from 'three/webgpu';
import { Fn, attribute, mix, vec3, vec4, float, max, abs, exp, floor, clamp, dot, smoothstep, normalWorld, positionWorld, cameraPosition } from 'three/tsl';
import { LINEAR } from '../flora/mesh';
import { worldMaterial, U, PIXEL } from '../material';
import { tube } from '../geo';
import type { PaletteKey } from '../contracts';
import type { FaunaPlan } from './develop';
import { LOFT, loftTemplate, writeLoft, type LoftTemplate } from './loft';
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

/** Skull: cranium tapering to a snout along +x (length 1), flattened jaw underneath; band 0 = jaw/underside, 1 = skull. */
function skull(segs: number, flat: boolean): any {
  const g = lathe([[0, -0.5], [0.55, -0.46], [0.85, -0.33], [1.0, -0.13], [0.96, 0.07], [0.8, 0.24], [0.62, 0.38], [0.46, 0.48], [0.22, 0.55], [0, 0.57]], segs);
  g.rotateZ(-Math.PI / 2); // lathe axis +y → forward +x
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i);
    if (y < 0) y *= 0.7;                                 // flat jaw
    if (y > 0 && x < 0.1 && x > -0.35) y *= 1.08;        // domed cranium
    p.setXY(i, x, y);
  }
  g.computeVertexNormals();
  return banded(g, (c) => (c.y < -0.18 + 0.32 * Math.max(0, c.x) ? 0 : 1), flat);
}
/** Thigh / upper arm: muscle belly near the hip tapering to a slim knee (length 1 along +y). */
const thigh = (segs: number, flat: boolean) => banded(lathe(flat
  ? [[0, 0], [0.8, 0], [1, 0.16], [0.88, 0.5], [0.5, 0.94], [0, 1]]
  : [[0, -0.1], [0.8, -0.06], [1.0, 0.12], [0.96, 0.35], [0.72, 0.68], [0.48, 0.92], [0.4, 1.03], [0, 1.08]], segs), (c) => (c.y > 0.62 ? 1 : 0), flat);

export function partGeometries(facet = LOFT.facet): Record<PartType, any> {
  const eyeRing = banded(new THREE.IcosahedronGeometry(1, 3), (c) => {
    const n = c.clone().normalize();
    const glint = n.distanceTo(new THREE.Vector3(0.32, 0.42, 0.85).normalize()) < 0.2;
    return glint || (n.z > 0.55 && n.z < 0.8) ? 1 : 0;
  }, false);
  const eyeDot = banded(new THREE.IcosahedronGeometry(1, facet ? 1 : 2), (c) => (c.clone().normalize().distanceTo(new THREE.Vector3(0.35, 0.5, 0.79)) < 0.42 ? 1 : 0), false);
  return {
    // silicon parts: straight, tapering, flat-plated shapes (the chemistry reads in silhouette), smooth unless ?facet=1
    rodSi: facet ? banded(lathe([[0, 0], [0.9, 0], [1, 0.08], [0.82, 0.55], [0.55, 1], [0, 1]], 6), (c) => (c.y > 0.55 ? 1 : 0), true)
      : banded(lathe([[0, -0.07], [0.72, -0.05], [0.96, 0.05], [0.84, 0.5], [0.58, 0.96], [0.32, 1.03], [0, 1.06]], 10), (c) => (c.y > 0.55 ? 1 : 0), false),
    rodC: banded(lathe([[0, -0.12], [0.7, -0.07], [1, 0.03], [0.8, 1.0], [0.55, 1.07], [0, 1.1]], 10), (c) => (c.y > 0.5 ? 1 : 0), false),
    plateSi: facet ? banded(lathe([[0, -0.5], [1, -0.5], [1, 0.1], [0.78, 0.5], [0, 0.5]], 6), (c) => (c.y > 0.25 ? 0 : 1), true)
      : banded(lathe([[0, -0.5], [0.88, -0.5], [1, -0.3], [1, 0.05], [0.86, 0.38], [0.5, 0.5], [0, 0.52]], 12), (c) => (c.y > 0.25 ? 0 : 1), false),
    plateC: banded(lathe([[0, -0.4], [1, -0.4], [1, -0.1], [0.85, 0.25], [0.5, 0.45], [0, 0.5]], 12), (c) => (c.y > 0 ? 0 : 1), false),
    hornSi: facet ? banded(lathe([[0, 0], [1, 0], [0.62, 0.5], [0, 1]], 6), (c) => (c.y > 0.5 ? 1 : 0), true)
      : banded(lathe([[0, -0.06], [0.8, -0.04], [1, 0.04], [0.62, 0.5], [0.22, 0.9], [0, 1]], 10), (c) => (c.y > 0.5 ? 1 : 0), false),
    hornC: curvedHorn(),
    thighSi: facet ? thigh(6, true) : thigh(10, false), thighC: thigh(10, false),
    skullSi: facet ? skull(6, true) : skull(12, false), skullC: skull(12, false),
    frill: frillGeometry(),
    eyeRing, eyeDot,
  };
}

// ---- materials: the shared world material for bodies and parts, plus one gas-bell material shared by every bell ------
/** Gas bell: soft wrap lighting (a gas-filled membrane has no hard terminator), light glowing through the membrane when
 * backlit, and a pale rim at grazing angles, so the bell reads translucent; same coloured shadow tint and fog as the world. */
function bellMaterial(): any {
  const m = new THREE.MeshLambertNodeMaterial();
  const c3 = (hex: number) => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };
  m.outputNode = Fn(() => {
    const base = attribute('color', 'vec3');
    const N = normalWorld.toVar();
    const V = cameraPosition.sub(positionWorld).normalize();
    const L = U.lightDir;
    const wrap = dot(N, L).mul(0.5).add(0.5);
    const lit = smoothstep(0.2, 0.7, wrap).toVar();
    if (PIXEL) lit.assign(floor(lit.mul(3).add(0.5)).div(3));
    const shadowCol = mix(base, vec3(U.shadowTint), 0.45).mul(0.85);
    const col = mix(shadowCol, base.mul(U.sun), lit).toVar();
    const through = max(dot(V, L).negate(), 0).pow(2).mul(float(1).sub(lit)).mul(0.55);       // backlit membrane
    const rim = float(1).sub(abs(dot(N, V))).pow(3).mul(0.6);                                // pale rim
    const glowIn = max(through, rim).toVar();
    if (PIXEL) glowIn.assign(floor(glowIn.mul(4).add(0.5)).div(4));
    col.assign(mix(col, mix(c3(PALETTE_BLUSH), c3(PALETTE_BONE), rim), glowIn));
    const dist = positionWorld.sub(cameraPosition).length();
    const f = clamp(float(1).sub(exp(max(dist.sub(U.fogStart), 0).div(U.fogDist).negate())), 0, 1).toVar();
    if (PIXEL) f.assign(floor(f.mul(16).add(0.5)).div(16));
    return vec4(mix(col, vec3(U.fogColor), f), 1);
  })();
  return m;
}
const PALETTE_BLUSH = 0xf2a2a0, PALETTE_BONE = 0xf4e6dc; // = PALETTE.blush / PALETTE.bone

let mats: { loft: any; part: any; bell: any } | null = null;
export function faunaMaterials() {
  if (!mats) {
    const loft = worldMaterial({ glow: true, bounce: false });
    const part = worldMaterial({ glow: true, bounce: false, colorNode: mix(attribute('iColA', 'vec3'), attribute('iColB', 'vec3'), attribute('aBand', 'float')) });
    mats = { loft, part, bell: bellMaterial() };
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
  const { loft: loftMat, part: partMat, bell: bellMat } = faunaMaterials();
  const group = new THREE.Group();
  const batches = Object.fromEntries(PART_TYPES.map((t) => [t, new PartBatch(geos[t], partMat, partCap)])) as Record<PartType, PartBatch>;
  for (const t of PART_TYPES) group.add(batches[t].mesh);

  const templates: LoftTemplate[] = individuals.map((d) => loftTemplate(d.plan));
  const offsets: number[] = [];
  let nv = 0;
  for (const tp of templates) { offsets.push(nv); nv += tp.vertexCount; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), glw = new Float32Array(nv);
  // index ranges: bodies first (world material), then bells (bell material): one mesh, two groups
  const idx: number[] = [], bellIdx: number[] = [];
  templates.forEach((tp, i) => {
    col.set(tp.color, offsets[i] * 3); glw.set(tp.glow, offsets[i]);
    const dst = individuals[i].plan.form === 'bell' ? bellIdx : idx;
    if (tp.index) for (const k of tp.index) dst.push(k + offsets[i]);
    else for (let k = 0; k < tp.vertexCount; k++) dst.push(k + offsets[i]);
  });
  const nBody = idx.length;
  idx.push(...bellIdx);
  const g = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3), aN = new THREE.BufferAttribute(nor, 3);
  aP.setUsage(THREE.DynamicDrawUsage); aN.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aP); g.setAttribute('normal', aN);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glw, 1));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  g.addGroup(0, nBody, 0); g.addGroup(nBody, bellIdx.length, 1);
  const loft = new THREE.Mesh(g, [loftMat, bellMat]);
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
    parts: Object.fromEntries(PART_TYPES.map((t) => [t, batches[t].n])), drawCalls: 2 + PART_TYPES.length,
  });
  return { group, update, spines, stats };
}
