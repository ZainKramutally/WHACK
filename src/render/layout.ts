// Pure helpers for the render layer (no three.js): grid ↔ world mapping, organism-id bookkeeping,
// ray marching for picking, and the bead layout of a body plan. Tested in layout.test.ts.
import type { BodyPlan } from '../sim/develop';
import type { InspectTarget } from '../worlds/types';

export const FLORA_GRID = 64;
const D2R = Math.PI / 180;

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

/** Ray vs sphere; returns the nearest positive distance or −1. `d` must be normalised. */
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

// --- bead layout of a body plan ------------------------------------------------------------------------
export const BEAD_BODY = 0, BEAD_EYE = 1, BEAD_PLATE = 2, BEAD_LIMB = 3, BEAD_HORN = 4;
export type BeadTone = 0 | 1 | 2 | 3 | 4;

/** One sphere of a creature, in body space (x forward, y up, z lateral), metres, resting on y = 0. */
export interface Bead { x: number; y: number; z: number; r: number; tone: BeadTone }

export interface BeadLayout {
  beads: Bead[];
  /** Bounding radius around the layout's centre, for picking. */
  radius: number;
  /** Height of the layout's centre above the ground. */
  centreY: number;
}

export const MAX_BEADS_PER_ORGANISM = 64;

/** A plain 5-bead worm for organisms whose plan hasn't arrived (sizes in metres). */
export function capsuleLayout(length: number): BeadLayout {
  const n = 5, s = length / n, r = Math.min(s * 0.7, length * 0.17);
  const beads: Bead[] = [];
  for (let i = 0; i < n; i++) beads.push({ x: (i - (n - 1) / 2) * s, y: r, z: 0, r, tone: BEAD_BODY });
  return { beads, radius: length * 0.6, centreY: r };
}

/**
 * Turns a BodyPlan into spheres: a spine of `segmentCount` beads (curling for carbon, straight and stepped for
 * silicon), plates on top, horns and eyes on the head, and limbs as chains of beads (rods: three beads per segment
 * along straight 15°-snapped joints; tentacles: tapering beads). Pure and deterministic.
 */
export function beadLayout(plan: BodyPlan): BeadLayout {
  const n = Math.max(3, Math.round(plan.segmentCount));
  const L = plan.scale;
  const s = L / n;
  const rMax = Math.min(0.22 * L, 1.1 * s);
  const silicon = plan.chemistry === 'silicon';

  // Spine in the XZ plane: tail (i = 0) to head (i = n−1), curling by `curl` radians per joint.
  const spine: { x: number; z: number; r: number; heading: number }[] = [];
  let hx = 0, hz = 0, ang = -(plan.curl * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let prof = 0.55 + 0.45 * Math.sin(Math.PI * (0.1 + 0.8 * t));
    if (plan.profile === 'stepped') prof = Math.max(0.4, Math.round(prof * 3) / 3);
    spine.push({ x: hx, z: hz, r: rMax * prof, heading: ang });
    hx += Math.cos(ang) * s;
    hz += Math.sin(ang) * s;
    ang += plan.curl;
  }
  // Centre the spine on the origin, then rotate so the head faces +x.
  const cx = (spine[0].x + spine[n - 1].x) / 2, cz = (spine[0].z + spine[n - 1].z) / 2;
  const headDir = Math.atan2(spine[n - 1].z - spine[0].z, spine[n - 1].x - spine[0].x);
  const cosR = Math.cos(-headDir), sinR = Math.sin(-headDir);
  for (const p of spine) {
    const dx = p.x - cx, dz = p.z - cz;
    p.x = dx * cosR - dz * sinR;
    p.z = dx * sinR + dz * cosR;
  }

  const body: Bead[] = [], eyes: Bead[] = [], horns: Bead[] = [], limbs: Bead[] = [], plates: Bead[] = [];
  for (const p of spine) body.push({ x: p.x, y: 0, z: p.z, r: p.r, tone: BEAD_BODY });

  // Plates: dorsal beads on the first plateCover share of segments.
  const nPlates = Math.round(plan.plateCover * n);
  for (let i = 0; i < nPlates; i++) {
    const p = spine[n - 1 - i];
    plates.push({ x: p.x, y: p.r * 0.95, z: p.z, r: p.r * 0.55, tone: BEAD_PLATE });
  }

  // Head features.
  const head = spine[n - 1];
  for (let k = 0; k < Math.min(plan.eyeCount, 6); k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const row = Math.floor(k / 2);
    eyes.push({
      x: head.x + head.r * (0.55 - 0.35 * row),
      y: head.r * (0.35 + 0.3 * row),
      z: side * head.r * 0.65,
      r: Math.max(head.r * (silicon ? 0.18 : 0.3), 0.01 * L),
      tone: BEAD_EYE,
    });
  }
  for (let k = 0; k < Math.min(plan.hornCount, 3); k++) {
    const zz = plan.hornCount === 1 ? 0 : (k - (plan.hornCount - 1) / 2) * head.r * 0.8;
    const len = plan.hornLength;
    for (let j = 1; j <= 2; j++) {
      horns.push({ x: head.x + head.r * 0.4 + len * 0.45 * j, y: head.r * 0.5 + len * 0.3 * j, z: zz, r: Math.max(head.r * 0.3 * (1 - 0.35 * j), 0.008 * L), tone: BEAD_HORN });
    }
  }

  // Limbs: legPairs along the front two-thirds of the spine; each limb leaves the body sideways and goes down.
  if (plan.legPairs > 0 && plan.limbSegments > 0) {
    const segLen = plan.limbLength / plan.limbSegments;
    const rl = Math.max(0.03 * L, rMax * 0.45);
    for (let pair = 0; pair < plan.legPairs; pair++) {
      const idx = Math.min(n - 1, Math.round((n - 1) * (0.2 + 0.75 * (plan.legPairs === 1 ? 0.5 : pair / (plan.legPairs - 1)))));
      const p = spine[idx];
      for (const side of [1, -1]) {
        let theta = 30 * D2R; // from straight down, outward positive
        let lz = p.z + side * p.r * 0.7, ly = 0;
        const perSeg = silicon ? 4 : 2;
        for (let j = 0; j < plan.limbSegments; j++) {
          theta += (plan.limbJointAngles[j] ?? 0) * D2R;
          const dz = Math.sin(theta) * side, dy = -Math.cos(theta);
          for (let k = 1; k <= perSeg; k++) {
            const f = k / perSeg;
            const taper = silicon ? 1 : 1 - 0.5 * ((j + f) / plan.limbSegments);
            limbs.push({ x: p.x, y: ly + dy * segLen * f, z: lz + dz * segLen * f, r: rl * taper, tone: BEAD_LIMB });
          }
          lz += dz * segLen;
          ly += dy * segLen;
        }
      }
    }
  }

  // Lift so the lowest bead rests on the ground. Priority order when truncating: body, eyes, horns, limbs, plates.
  const all = [...body, ...eyes, ...horns, ...limbs, ...plates].slice(0, MAX_BEADS_PER_ORGANISM);
  let minY = Infinity;
  for (const b of all) minY = Math.min(minY, b.y - b.r);
  let maxY = -Infinity;
  for (const b of all) {
    b.y -= minY;
    maxY = Math.max(maxY, b.y + b.r);
  }
  let rad = 0;
  for (const b of all) rad = Math.max(rad, Math.hypot(b.x, b.y - maxY / 2, b.z) + b.r);
  return { beads: all, radius: rad, centreY: maxY / 2 };
}

/** Nearest sphere hit by a ray among n spheres held in parallel arrays (organism id + centre + radius). */
export function nearestSphere(
  o: Vec3, d: Vec3,
  ids: ArrayLike<number>, xs: ArrayLike<number>, ys: ArrayLike<number>, zs: ArrayLike<number>, rs: ArrayLike<number>,
  n: number,
): { id: number; dist: number } | null {
  let best: { id: number; dist: number } | null = null;
  for (let i = 0; i < n; i++) {
    const t = raySphere(o, d, { x: xs[i], y: ys[i], z: zs[i] }, rs[i]);
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
