// Small geometry helpers shared by landforms, the explorer and the stand-in flora.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmp = new THREE.Color();

/** Non-indexed copy with flat normals and the contract attributes: color (linear), aGlow, aSway. */
export function paint(
  g: any,
  colorOf: (p: any, n: any) => number | [number, number, number],
  glowOf: (p: any, n: any) => number = () => 0,
  swayOf: (p: any) => number = () => 0,
  flat = true,
): any {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  if (flat || !geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
  const col = new Float32Array(n * 3), glow = new Float32Array(n), sway = new Float32Array(n);
  const p = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i); nn.fromBufferAttribute(nor, i);
    const c = colorOf(p, nn);
    if (typeof c === 'number') { tmp.setHex(c); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
    else { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
    glow[i] = glowOf(p, nn); sway[i] = swayOf(p);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  geo.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  return geo;
}

export const merge = (parts: any[]) => mergeGeometries(parts, false);

/** Linear rgb lerp of two sRGB hexes. */
export function lerpHex(a: number, b: number, t: number): [number, number, number] {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return [ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t];
}

/** Generalised tube: ring of `radial` verts around each path point, radius per point, optional radius jitter fn. */
export function tube(path: any[], radii: number[], radial = 10, jitter?: (i: number, j: number) => number, cap = true): any {
  const n = path.length, pos: number[] = [], idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3();
  let prevN: any = null;
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    t.subVectors(b, a).normalize();
    if (!prevN) { nrm.crossVectors(t, Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize(); }
    else { nrm.copy(prevN).sub(t.clone().multiplyScalar(prevN.dot(t))).normalize(); } // parallel transport
    prevN = nrm.clone();
    bin.crossVectors(t, nrm).normalize();
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const r = radii[i] * (jitter ? jitter(i, j) : 1);
      pos.push(
        path[i].x + (nrm.x * Math.cos(ang) + bin.x * Math.sin(ang)) * r,
        path[i].y + (nrm.y * Math.cos(ang) + bin.y * Math.sin(ang)) * r,
        path[i].z + (nrm.z * Math.cos(ang) + bin.z * Math.sin(ang)) * r,
      );
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
    idx.push(a, c, b, b, c, d);
  }
  if (cap) {
    for (const [ring, flip] of [[0, true], [n - 1, false]] as [number, boolean][]) {
      const ci = pos.length / 3; pos.push(path[ring].x, path[ring].y, path[ring].z);
      for (let j = 0; j < radial; j++) {
        const a = ring * radial + j, b = ring * radial + ((j + 1) % radial);
        if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
