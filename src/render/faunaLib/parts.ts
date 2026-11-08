// Shared part geometry and instanced batches for the fauna (ported from mockups/red-world/src/fauna/render.ts, smooth
// variants). One InstancedMesh per part type, shared by every creature; colour per instance, glow per instance through
// the world material's glowAttr. Carbon parts are round and swelling; silicon parts are hexagonal (6-sided lathes,
// smooth-shaded): the lattice reads in silhouette, the cel shading stays soft. Lathe parts run along local +y, 0 → 1.
import * as THREE from 'three/webgpu';
import { PART_TYPES, type PartType } from './adapter';

const lathe = (pts: [number, number][], segs: number): THREE.BufferGeometry => {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
};

function frill(): THREE.BufferGeometry {
  // fin in local XY: x 0..1 along the body (backwards), y 0..1 up; scalloped rim, two-sided thin slab
  const cols = 12, rows = 3, th = 0.04, pos: number[] = [];
  const rim = (x: number) => Math.max(0.05, Math.sin(Math.PI * Math.min(1, (x + 0.15) / 1.15)) * (0.9 + 0.1 * Math.cos(x * cols * Math.PI)));
  const P = (i: number, j: number, z: number) => { const x = i / cols; return [x, rim(x) * (j / rows), z]; };
  for (const z of [th, -th]) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const a = P(i, j, z), b = P(i + 1, j, z), c = P(i, j + 1, z), d = P(i + 1, j + 1, z);
    for (const q of z > 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]) pos.push(...q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function curvedHorn(): THREE.BufferGeometry {
  const g = lathe([[0, -0.05], [0.85, -0.03], [1, 0.05], [0.8, 0.35], [0.5, 0.7], [0.2, 0.93], [0, 1]], 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.9 * y * y); } // sweeps toward local +x
  g.computeVertexNormals();
  return g;
}

export function partGeometries(): Record<PartType, THREE.BufferGeometry> {
  // knobs (eyes, knees, tips, catchlights) are the most numerous part: 80 triangles, smooth on carbon, faceted on silicon
  const knob = new THREE.IcosahedronGeometry(1, 1); knob.deleteAttribute('uv');
  const knobSi = new THREE.IcosahedronGeometry(1, 1); knobSi.deleteAttribute('uv'); knobSi.computeVertexNormals();
  const ring = new THREE.TorusGeometry(1, 0.2, 5, 14); ring.rotateX(Math.PI / 2); ring.translate(0, 0.5, 0); ring.deleteAttribute('uv');
  return {
    thighC: lathe([[0, -0.1], [0.8, -0.06], [1.0, 0.12], [0.96, 0.35], [0.72, 0.68], [0.48, 0.92], [0.4, 1.03], [0, 1.08]], 10),
    rodC: lathe([[0, -0.12], [0.7, -0.07], [1, 0.03], [0.8, 1.0], [0.55, 1.07], [0, 1.1]], 10),
    thighSi: lathe([[0, 0], [0.8, 0], [1, 0.16], [0.88, 0.5], [0.5, 0.94], [0, 1]], 6),
    rodSi: lathe([[0, -0.07], [0.72, -0.05], [0.96, 0.05], [0.84, 0.5], [0.58, 0.96], [0.32, 1.03], [0, 1.06]], 6),
    plateC: lathe([[0, -0.4], [0.9, -0.4], [1, -0.15], [0.9, 0.2], [0.55, 0.42], [0, 0.5]], 14),
    plateSi: lathe([[0, -0.5], [0.88, -0.5], [1, -0.3], [1, 0.05], [0.86, 0.38], [0.5, 0.5], [0, 0.52]], 6),
    hornC: curvedHorn(),
    hornSi: lathe([[0, -0.06], [0.8, -0.04], [1, 0.04], [0.62, 0.5], [0.22, 0.9], [0, 1]], 6),
    frill: frill(),
    knob,
    ring,
    knobSi,
  };
}

export class PartBatch {
  mesh: THREE.InstancedMesh; m: Float32Array; col: Float32Array; glow: Float32Array; n = 0; cap: number;
  private aG: THREE.InstancedBufferAttribute;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) {
    this.cap = cap;
    this.glow = new Float32Array(cap);
    // Static usage on every buffer: in three r187 a DynamicDraw attribute is re-uploaded whole on every render, even at
    // count 0 (warm); a static one uploads only after flush()'s needsUpdate, and then only the used range.
    this.aG = new THREE.InstancedBufferAttribute(this.glow, 1);
    geo.setAttribute('aGlow', this.aG);
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.col = new Float32Array(cap * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.col, 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.m = this.mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < cap; i++) this.m[i * 16 + 15] = 1;
  }
  /** Origin o and three scaled basis axes (the instance matrix columns), linear colour, glow weight. */
  push(
    ox: number, oy: number, oz: number, xx: number, xy: number, xz: number, yx: number, yy: number, yz: number,
    zx: number, zy: number, zz: number, r: number, g: number, b: number, glow: number,
  ): void {
    if (this.n >= this.cap) return;
    const i = this.n++, m = this.m, k = i * 16;
    m[k] = xx; m[k + 1] = xy; m[k + 2] = xz;
    m[k + 4] = yx; m[k + 5] = yy; m[k + 6] = yz;
    m[k + 8] = zx; m[k + 9] = zy; m[k + 10] = zz;
    m[k + 12] = ox; m[k + 13] = oy; m[k + 14] = oz;
    const c = i * 3; this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b;
    this.glow[i] = glow;
  }
  /** `warm`: stay visible while empty (count 0 issues no draw) so the selection screen's compile includes this pipeline. */
  flush(warm = false): void {
    const n = this.n;
    this.mesh.count = n;
    this.mesh.visible = n > 0 || warm; // hidden objects cost nothing per frame (and are skipped by compileAsync)
    if (n === 0) return;
    // upload only the used instances
    const up = (a: THREE.BufferAttribute, k: number) => { a.clearUpdateRanges(); a.addUpdateRange(0, k); a.needsUpdate = true; };
    up(this.mesh.instanceMatrix, n * 16);
    up(this.mesh.instanceColor as THREE.InstancedBufferAttribute, n * 3);
    up(this.aG, n);
  }
}

/** One batch per part type; `matFor` picks each type's material (silicon types carry the rim). */
export function partBatches(matFor: (t: PartType) => THREE.Material, caps: Partial<Record<PartType, number>>, fallback: number): PartBatch[] {
  const geos = partGeometries();
  return PART_TYPES.map((t) => new PartBatch(geos[t], matFor(t), caps[t] ?? fallback));
}
