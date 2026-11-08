// How one placed plant is drawn: its instance matrix, its shape terms for the flora material and its instance colour,
// from the PlantList (place.ts) and its archetype. flora.ts fills its buckets with these; anything else that draws the
// world's plants (the producer card) can call them to draw the same plant.
import * as THREE from 'three/webgpu';
import type { Archetype } from './index';
import type { PlantList } from './place';

const UP = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion(), qt = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), n = new THREE.Vector3();

/**
 * Instance matrix of plant `i`: scaled to its size with its girth (xz ÷ y), turned by its yaw, tilted by its slope and
 * lean (gx/gz), and sunk 3% of its height plus its slope sink.
 */
export function plantMatrix(list: PlantList, i: number, a: Archetype, out: THREE.Matrix4): THREE.Matrix4 {
  const s = list.h[i] / a.size, g = 1 + list.wg[i];
  q.setFromAxisAngle(UP, list.yaw[i]);
  if (list.gx[i] || list.gz[i]) q.premultiply(qt.setFromUnitVectors(UP, n.set(-list.gx[i], 1, -list.gz[i]).normalize()));
  p.set(list.x[i], list.y[i] - 0.03 * list.h[i] - list.sink[i], list.z[i]);
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

/** The flora material's per-instance look (material.ts lookAttr): vec4(tint r, g, b, glow 0..1). */
export function plantLook(list: PlantList, i: number, out: Float32Array, o: number): void {
  plantTint(list, i, out, o);
  out[o + 3] = list.glow[i];
}

/** Instance colour of plant `i` (linear rgb multiplier on its painted vertex colours). */
export function plantTint(list: PlantList, i: number, out: Float32Array, o: number): void {
  out[o] = 1 + list.tr[i];
  out[o + 1] = 1 + list.tg[i];
  out[o + 2] = 1 + list.tb[i];
}

/** Crown radius (m) of plant `i` as drawn: its archetype's radius at its size, widened by its girth and crown. */
export function plantRadius(list: PlantList, i: number, radiusPerSize: number): number {
  return list.h[i] * radiusPerSize * (1 + list.wg[i]) * (1 + list.wc[i]);
}
