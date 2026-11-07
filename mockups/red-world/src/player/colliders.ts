// Collision data, built once at startup. Pure (no three.js): plant trunk circles from the placement instances, and a
// landform occupancy grid rasterised from world-space triangles (buttes, arch feet: anything rw-scene adds).
import type { PlantInstance, SpeciesId } from '../contracts';
import type { Circle } from './math';

/** Trunk (not canopy) radius and solid height, as fractions of the instance height. From the flora generators' stalk radii, with a little margin for base flares. */
export const TRUNK: Partial<Record<SpeciesId, { r: number; top: number }>> = {
  parasolTitan: { r: 0.045, top: 0.85 },
  coilSpire: { r: 0.06, top: 0.95 },
  weeper: { r: 0.035, top: 0.6 },
  ribFan: { r: 0.035, top: 0.16 },
};

/** Circle colliders for every placed plant with a trunk. `heightOf` gives the unscaled archetype height. */
export function plantColliders(plants: readonly PlantInstance[], heightOf: (s: SpeciesId, v: number) => number, groundAt: (x: number, z: number) => number): Circle[] {
  const out: Circle[] = [];
  for (const p of plants) {
    const t = TRUNK[p.species];
    if (!t) continue;
    const h = p.scale * heightOf(p.species, p.variant);
    const [x, , z] = p.position;
    out.push({ x, z, r: Math.max(0.4, t.r * h), top: groundAt(x, z) + t.top * h });
  }
  return out;
}

/** XZ uniform grid over a square; buckets circles so a query only touches nearby ones. */
export class CircleGrid {
  private cells = new Map<number, Circle[]>();
  /** `margin` pads each circle's bucket extent by at least the player radius so cell-edge contacts are found. */
  constructor(readonly circles: Circle[], readonly cell = 40, margin = 1) {
    for (const c of circles) {
      const r = c.r + margin;
      const i0 = Math.floor((c.x - r) / cell), i1 = Math.floor((c.x + r) / cell);
      const j0 = Math.floor((c.z - r) / cell), j1 = Math.floor((c.z + r) / cell);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = this.key(i, j);
        let b = this.cells.get(k); if (!b) this.cells.set(k, (b = []));
        b.push(c);
      }
    }
  }
  private key(i: number, j: number) { return (i + 4096) * 8192 + (j + 4096); }
  near(x: number, z: number): Circle[] { return this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) ?? EMPTY; }
}
const EMPTY: Circle[] = [];

/**
 * Landform occupancy: per cell, the lowest and highest surface a vertical ray through the cell centre hits.
 * Solid where lo <= y <= hi; a cell whose lo is high (under an arch span) leaves a passage beneath.
 */
export class LandGrid {
  readonly lo: Float32Array; readonly hi: Float32Array; readonly n: number;
  constructor(readonly x0: number, readonly z0: number, readonly size: number, readonly cell: number) {
    this.n = Math.ceil(size / cell);
    this.lo = new Float32Array(this.n * this.n).fill(Infinity);
    this.hi = new Float32Array(this.n * this.n).fill(-Infinity);
  }
  /** Rasterise a flat [x,y,z, x,y,z, x,y,z, ...] world-space triangle list (non-indexed). */
  addTriangles(p: ArrayLike<number>) {
    const { n, cell, x0, z0 } = this;
    for (let t = 0; t + 8 < p.length; t += 9) {
      const ax = p[t], ay = p[t + 1], az = p[t + 2], bx = p[t + 3], by = p[t + 4], bz = p[t + 5], cx = p[t + 6], cy = p[t + 7], cz = p[t + 8];
      const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / cell - 0.5)), i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx, cx) - x0) / cell - 0.5));
      const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / cell - 0.5)), j1 = Math.min(n - 1, Math.floor((Math.max(az, bz, cz) - z0) / cell - 0.5));
      if (i0 > i1 || j0 > j1) continue;
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-9) continue; // vertical triangle: its neighbours carry the hit
      for (let j = j0; j <= j1; j++) {
        const z = z0 + (j + 0.5) * cell;
        for (let i = i0; i <= i1; i++) {
          const x = x0 + (i + 0.5) * cell;
          const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
          const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
          const w = 1 - u - v;
          if (u < 0 || v < 0 || w < 0) continue;
          const y = u * ay + v * by + w * cy, k = j * n + i;
          if (y < this.lo[k]) this.lo[k] = y;
          if (y > this.hi[k]) this.hi[k] = y;
        }
      }
    }
  }
  private idx(x: number, z: number) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    return i < 0 || j < 0 || i >= this.n || j >= this.n ? -1 : j * this.n + i;
  }
  /** True if a body from y to y + h overlaps solid rock at (x, z). */
  blocked(x: number, z: number, y: number, h: number): boolean {
    const k = this.idx(x, z);
    return k >= 0 && y + h > this.lo[k] && y < this.hi[k];
  }
  /** Top of the rock at (x, z) if the feet at y are within `step` of it (so the player can stand on a butte top), else -Infinity. */
  topNear(x: number, z: number, y: number, step: number): number {
    const k = this.idx(x, z);
    return k >= 0 && this.hi[k] > -Infinity && y >= this.hi[k] - step ? this.hi[k] : -Infinity;
  }
}
