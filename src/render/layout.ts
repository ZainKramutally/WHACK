// Pure helpers for the render layer (no three.js): grid ↔ world mapping, organism-id bookkeeping,
// ray marching for picking, and the bead layout of a body plan. Tested in layout.test.ts.
import type { InspectTarget } from '../worlds/types';

export const FLORA_GRID = 64;


// --- grid ↔ world ----------------------------------------------------------------------------------
// The terrain patch is centred on the origin: world x, z ∈ [−patch/2, patch/2]. Organism (x, y) in 0..1 maps to
// world (x, z). Flora cell index = row·64 + col, col along world x, row along world z, interleaved [mat, canopy].

export function patchToWorld(u: number, patch: number): number {
  return (u - 0.5) * patch;
}

export function worldToPatch(w: number, patch: number): number {
  return w / patch + 0.5;
}

/** World-space centre of a flora cell. */
export function cellCentre(cell: number, patch: number): { x: number; z: number } {
  const col = cell % FLORA_GRID;
  const row = Math.floor(cell / FLORA_GRID);
  return { x: patchToWorld((col + 0.5) / FLORA_GRID, patch), z: patchToWorld((row + 0.5) / FLORA_GRID, patch) };
}

/** Flora cell under a world point, or −1 outside the patch. */
export function cellAt(x: number, z: number, patch: number): number {
  const u = worldToPatch(x, patch);
  const v = worldToPatch(z, patch);
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return -1;
  return Math.floor(v * FLORA_GRID) * FLORA_GRID + Math.floor(u * FLORA_GRID);
}

/** Biomass of a cell from the interleaved flora buffer. */
export function floraAt(flora: Float32Array, cell: number): { mat: number; canopy: number } {
  return { mat: flora[cell * 2] ?? 0, canopy: flora[cell * 2 + 1] ?? 0 };
}

export const FLORA_EPS = 0.002;

// --- ray marching for picking ------------------------------------------------------------------------
export interface Vec3 { x: number; y: number; z: number }

export interface MarchOptions {
  maxDist: number;
  step: number;
  patch: number;
  heightAt: (x: number, z: number) => number;
  seaLevel: number;
  seaVisible: boolean;
  flora: Float32Array;
}

/**
 * Walks a ray over the terrain and returns what it meets first: the sea surface, the ground (a producer if the
 * cell under the hit has flora), or the sky. Does not test organisms (fauna does that).
 */
export function marchRay(o: Vec3, d: Vec3, opt: MarchOptions): { target: InspectTarget; dist: number } {
  const { maxDist, step, heightAt, seaLevel } = opt;
  let prevT = 0;
  let prevAbove = o.y - heightAt(o.x, o.z);
  let prevSea = o.y - seaLevel;
  for (let t = step; t <= maxDist; t += step) {
    const x = o.x + d.x * t;
    const y = o.y + d.y * t;
    const z = o.z + d.z * t;
    const g = y - heightAt(x, z);
    const s = y - seaLevel;
    // Sea first: crossed the surface downwards over ground that is below the surface.
    if (opt.seaVisible && prevSea > 0 && s <= 0 && heightAt(x, z) < seaLevel) {
      return { target: { kind: 'sea' }, dist: t };
    }
    if (prevAbove > 0 && g <= 0) {
      // Bisect the crossing for a stable hit point.
      let lo = prevT, hi = t;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) / 2;
        const gm = o.y + d.y * m - heightAt(o.x + d.x * m, o.z + d.z * m);
        if (gm > 0) lo = m; else hi = m;
      }
      const hx = o.x + d.x * hi, hz = o.z + d.z * hi;
      const cell = cellAt(hx, hz, opt.patch);
      if (cell >= 0) {
        const f = floraAt(opt.flora, cell);
        if (f.mat + f.canopy > FLORA_EPS) return { target: { kind: 'producer', cell }, dist: hi };
      }
      return { target: { kind: 'ground' }, dist: hi };
    }
    prevT = t; prevAbove = g; prevSea = s;
  }
  return { target: { kind: 'sky' }, dist: maxDist };
}

/**
 * Where a ray ENTERS a sphere: the near intersection if it is in front of the origin, else −1. A ray that starts inside
 * the sphere (or points away from it) does not enter it. `d` must be normalised.
 */
export function raySphereEntry(o: Vec3, d: Vec3, c: Vec3, r: number): number {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const disc = b * b - (ox * ox + oy * oy + oz * oz - r * r);
  if (disc < 0) return -1;
  const t0 = -b - Math.sqrt(disc);
  return t0 > 0 ? t0 : -1;
}

/** Ray vs sphere; returns the nearest positive distance or −1 (counts the far side when starting inside). `d` must be normalised. */
export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  if (t0 > 0) return t0;
  const t1 = -b + s;
  return t1 > 0 ? t1 : -1;
}

// Creature layouts (axial beads, radial prisms) live in creatureLayout.ts; re-exported here for existing callers.
export * from './creatureLayout';

/** Nearest sphere hit by a ray among n spheres held in parallel arrays (organism id + centre + radius). */
export function nearestSphere(
  o: Vec3, d: Vec3,
  ids: ArrayLike<number>, xs: ArrayLike<number>, ys: ArrayLike<number>, zs: ArrayLike<number>, rs: ArrayLike<number>,
  n: number,
): { id: number; dist: number } | null {
  let best: { id: number; dist: number } | null = null;
  for (let i = 0; i < n; i++) {
    const t = raySphereEntry(o, d, { x: xs[i], y: ys[i], z: zs[i] }, rs[i]);
    if (t > 0 && (!best || t < best.dist)) best = { id: ids[i], dist: t };
  }
  return best;
}

/** Deterministic hash → [0, 1). Stable plant jitter per (cell, k, salt). */
export function hash01(a: number, b = 0, c = 0): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How many plants a cell shows and how tall they are, from its biomass (0 biomass → nothing). */
export function floraShape(mat: number, canopy: number): { count: number; height: number; cap: number } {
  const b = mat + canopy;
  if (b <= FLORA_EPS) return { count: 0, height: 0, cap: 0 };
  const f = 1 - Math.exp(-b);
  return {
    count: Math.max(1, Math.min(3, Math.ceil(f * 3))),
    height: Math.min(4, 0.25 + 1.1 * Math.sqrt(Math.max(0, mat)) + 2.2 * Math.max(0, canopy)),
    cap: canopy,
  };
}

// --- display scale (render-only illustration) ---------------------------------------------------------------
// Real body lengths run from ~0.15 m worms to ~10 m giants, which makes typical animals invisible next to 1–2 m flora
// from a 5 m follow camera. One rule for every creature: displayed length = DISPLAY_REF · (scale / BODY_REF)^DISPLAY_EXP.
// It is monotonic, so bigger stays bigger; it compresses the ~64× real range to ~5×. Whole bodies scale together.
export const BODY_REF = 0.15;     // m: the smallest founder worm
export const DISPLAY_REF = 3;   // m: how long that worm is drawn
export const DISPLAY_EXP = 0.4;

export function displayLength(scale: number): number {
  return DISPLAY_REF * Math.pow(Math.max(scale, 0.01) / BODY_REF, DISPLAY_EXP);
}

/** Multiplier from a plan's real size to its drawn size. */
export function displayFactor(scale: number): number {
  return displayLength(scale) / Math.max(scale, 0.01);
}
