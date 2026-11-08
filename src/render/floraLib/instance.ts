// How one placed plant is drawn: its instance matrix, its shape terms for the flora material and its instance colour,
// from the PlantList (place.ts) and its archetype. flora.ts fills its buckets with these; anything else that draws the
// world's plants (the producer card) can call them to draw the same plant.
import * as THREE from 'three/webgpu';
import { NEUTRAL_TINT, type Archetype } from './index';
import type { BuiltPlant } from './mesh';
import type { PlantList } from './place';

const UP = new THREE.Vector3(0, 1, 0);

/** Per-instance attributes every plant look geometry adds (aPlant shape terms, aLook tint and glow), besides the
 * instance matrix. */
export const LOOK_INSTANCE_ATTRS = 2;
/** The packed per-vertex attribute of a look geometry: vec4(sway, glow-site weight, rim, cap). */
export const VTX_ATTR = 'aVtx';
/** Material attribute names for its components (material.ts reads 'name.c' as one component of a vec4). */
export const VTX_SWAY = 'aVtx.x', VTX_GLOW = 'aVtx.y', VTX_RIM = 'aVtx.z', VTX_CAP = 'aVtx.w';
/**
 * A drawable copy of a library plant for one look (archetype × LOD × value step): position, normal and index shared
 * with the library; its own colour (paintSites writes it), and one packed aVtx vec4 = (sway, glow-site weight, rim,
 * cap) from the library's aSway, aGlow and part weights, so a look binds position, normal, color, aVtx and its
 * LOOK_INSTANCE_ATTRS per-instance buffers plus the matrix: 7 of three's 8. flora.ts's buckets and the producer card
 * both draw through these.
 */
export function lookGeometry(built: Pick<BuiltPlant, 'geometry' | 'part'>): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), src = built.geometry;
  for (const [name, at] of Object.entries(src.attributes)) {
    if (name === 'aSway' || name === 'aGlow' || name === 'aPart') continue; // packed into aVtx below
    g.setAttribute(name, name === 'color' ? at.clone() : at);
  }
  const n = src.getAttribute('position').count, vtx = new Float32Array(n * 4);
  const sway = src.getAttribute('aSway')?.array, glow = src.getAttribute('aGlow')?.array, part = built.part;
  for (let i = 0; i < n; i++) {
    vtx[i * 4] = sway ? sway[i] : 0; vtx[i * 4 + 1] = glow ? glow[i] : 0;
    vtx[i * 4 + 2] = part ? part[i * 2] : 0; vtx[i * 4 + 3] = part ? part[i * 2 + 1] : 0;
  }
  g.setAttribute(VTX_ATTR, new THREE.BufferAttribute(vtx, 4));
  g.setIndex(src.index);
  g.boundingBox = src.boundingBox; g.boundingSphere = src.boundingSphere;
  return g;
}
const q = new THREE.Quaternion(), qt = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), n = new THREE.Vector3();

/**
 * Instance matrix of plant `i`: scaled to its size with its girth (xz ÷ y), turned by its yaw, tilted by its slope and
 * lean (gx/gz), and sunk 3% of its height plus its slope sink. `onFlat`: the same plant standing on flat ground at
 * height 0 (its own lean only, no slope tilt or slope sink), as the inspect card's plate shows it.
 */
export function plantMatrix(list: PlantList, i: number, a: Archetype, out: THREE.Matrix4, onFlat = false): THREE.Matrix4 {
  const s = list.h[i] / a.size, g = 1 + list.wg[i];
  const tx = onFlat ? list.lx[i] : list.gx[i], tz = onFlat ? list.lz[i] : list.gz[i];
  q.setFromAxisAngle(UP, list.yaw[i]);
  if (tx || tz) q.premultiply(qt.setFromUnitVectors(UP, n.set(-tx, 1, -tz).normalize()));
  p.set(list.x[i], onFlat ? -0.03 * list.h[i] : list.y[i] - 0.03 * list.h[i] - list.sink[i], list.z[i]);
  return out.compose(p, q, sc.set(s * g, s, s * g));
}

/**
 * The flora material's per-instance shape terms (material.ts plantAttr), in the archetype's native metres so they
 * apply before instancing: vec4(crown, twist, droop, bend) with crown scale 1 + c·y², twist t·y radians, droop
 * −d·r²·y² and bend b·y² along local +X. So at the top (y = H) the crown is × (1 + wc), the stem has turned wt, the
 * rim (r = R) has dropped wd·H and the tip has moved wb·H.
 */
export function plantShape(list: PlantList, i: number, a: Archetype, out: Float32Array, o: number): void {
  const H = Math.max(1e-3, a.height), R = Math.max(a.radius, 0.1 * H);
  out[o] = list.wc[i] / (H * H);
  out[o + 1] = list.wt[i] / H;
  out[o + 2] = list.wd[i] / (R * R * H);
  out[o + 3] = list.wb[i] / H;
}

/** The flora material's per-instance look (material.ts lookAttr): vec4(tint r, g, b, glow 0..1 + 2 × teeth 0/1). */
export function plantLook(list: PlantList, i: number, out: Float32Array, o: number): void {
  plantTint(list, i, out, o);
  out[o + 3] = lookW(list.glow[i], list.teeth[i]);
}
/** aLook.w: a plant's glow 0..1 and margin teeth 0/1 in one float (the material decodes teeth = floor(w / 2)). */
export const lookW = (glow: number, teeth: number): number => Math.min(1, Math.max(0, glow)) + 2 * (teeth ? 1 : 0);

/** Instance colour of plant `i` (linear rgb multiplier on its painted vertex colours). */
export function plantTint(list: PlantList, i: number, out: Float32Array, o: number): void {
  out[o] = NEUTRAL_TINT + list.tr[i];
  out[o + 1] = NEUTRAL_TINT + list.tg[i];
  out[o + 2] = NEUTRAL_TINT + list.tb[i];
}

/** Crown radius (m) of plant `i` as drawn: its archetype's radius at its size, widened by its girth and crown. */
export function plantRadius(list: PlantList, i: number, radiusPerSize: number): number {
  return list.h[i] * radiusPerSize * (1 + list.wg[i]) * (1 + list.wc[i]);
}
