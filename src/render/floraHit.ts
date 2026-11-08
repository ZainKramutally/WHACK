// Ray vs drawn plants (click-to-inspect). Each plant is a vertical capsule: base position, height and crown radius.
// Pure and allocation-free: the flora part feeds it the CPU plant list of its last rebuild.
import type { PlantList } from './floraLib/place';
import type { Vec3 } from './layout';

export interface PlantRayHit { index: number; dist: number }

/** Crown radius as a fraction of the native crown radius, thinned so a clicked capsule hugs the drawn silhouette. */
const CROWN_FRACTION = 0.7;
const MIN_RADIUS = 0.15;

/** Entry distance of a ray into a vertical capsule (axis x,z from y0 to y1, radius r), or -1. d must be normalised. */
export function rayCapsuleY(o: Vec3, d: Vec3, x: number, z: number, y0: number, y1: number, r: number): number {
  let best = -1;
  const ox = o.x - x, oz = o.z - z;
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-9) {
    const b = ox * d.x + oz * d.z;
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      if (t > 0) {
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) best = t;
      }
    }
  }
  for (let k = 0; k < 2; k++) {
    const cy = k ? y1 : y0;
    const px = o.x - x, py = o.y - cy, pz = o.z - z;
    const b = px * d.x + py * d.y + pz * d.z;
    const c = px * px + py * py + pz * pz - r * r;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

/**
 * Nearest plant under a ray. `radiusPerHeight[arch]` is the crown radius over the plant's height for each archetype
 * (native radius ÷ native size). `baseDrop` is the fraction of height the drawn plant sits below its list y; it also
 * sits `list.sink` lower (placed onto its slope). `yScale` is the flora group's vertical stretch (flora.ts: it follows
 * the rising terrain between rebuilds), applied about y = 0 as the group applies it.
 */
export function rayPlants(list: PlantList, radiusPerHeight: ArrayLike<number>, o: Vec3, d: Vec3, maxDist: number, baseDrop = 0.03, yScale = 1): PlantRayHit | null {
  let bi = -1, bt = maxDist;
  for (let i = 0; i < list.n; i++) {
    const h = list.h[i];
    const r = Math.max(MIN_RADIUS, h * radiusPerHeight[list.arch[i]] * CROWN_FRACTION);
    const y0 = (list.y[i] - baseDrop * h - list.sink[i]) * yScale;
    const t = rayCapsuleY(o, d, list.x[i], list.z[i], y0, y0 + h * yScale, Math.min(r, h * 0.5));
    if (t > 0 && t < bt) { bt = t; bi = i; }
  }
  return bi < 0 ? null : { index: bi, dist: bt };
}
