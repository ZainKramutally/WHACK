// Pure helpers for the render layer (no three.js): grid ↔ world mapping, organism-id bookkeeping,
// ray marching for picking, and the bead layout of a body plan. Tested in layout.test.ts.
import type { BodyPlan } from '../sim/develop';
import type { InspectTarget } from '../worlds/types';
import { SNAP_DEG, armPhase, solveTwoBone } from './motion';

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

/** A leg for 2-bone IK: hip in body space (resting on y = 0 ground), two bones, and the beads it is drawn with. */
export interface LimbRig {
  hip: { x: number; y: number; z: number };
  side: 1 | -1;
  pair: number;
  len1: number;
  len2: number;
  /** Bead radius at the hip; carbon limbs taper toward the foot. */
  r: number;
  taper: boolean;
  /** Beads per bone. */
  perBone: number;
  /** Index of this limb's first bead in BeadLayout.beads. */
  first: number;
  /** Joint snap in degrees (15 for silicon rods, 0 for carbon). */
  snap: number;
  /** Horizontal distance from the hip to the foot at rest. */
  restOut: number;
}

/** A hexagonal/n-gonal prism from a to b with radius r (silicon's straight, faceted parts), in body space, metres. */
export interface Rod { ax: number; ay: number; az: number; bx: number; by: number; bz: number; r: number; tone: BeadTone }

/** A radial body's arm: a 2-bone rod chain from a hub facet, stepped with IK; dot eyes sit at its tip. */
export interface ArmRig {
  index: number;
  hip: { x: number; y: number; z: number };
  /** Outward unit direction in the ground plane (azimuth around the hub). */
  dirX: number; dirZ: number;
  len1: number; len2: number;
  r: number;
  snap: number;
  /** Horizontal hip→foot distance at rest, and the foot's rest height. */
  restOut: number; restFootY: number;
  /** Gait phase offset (tripod groups). */
  phase: number;
  /** Index of this arm's first rod in BeadLayout.rods (two rods per arm). */
  firstRod: number;
  /** Eye dots at the tip: first bead index, count, radius and offsets from the tip in the ground plane. */
  eyeFirst: number; eyeN: number; eyeR: number; eyeDX: number[]; eyeDZ: number[];
}

/** The prism parts of a radial (silicon) body. For these, BeadLayout.beads holds only the arm-tip eye dots. */
export interface RadialLayout {
  /** Hub tiers first (nTiers of them), then tiles and spires (up to nHubRods), then two rods per arm. */
  rods: Rod[];
  nTiers: number;
  /** Hub prism sides (3, 4 or 6) of the first nTiers rods. */
  hubSides: number;
  /** Count of rods before the arm rods (hub + tiles + spires). */
  nHubRods: number;
  arms: ArmRig[];
  /** Height of the hub's centre of rotation (for rolling), above the ground. */
  pivotY: number;
  /** Largest arm reach from the hub axis, for the roll radius. */
  rollRadius: number;
}

export interface BeadLayout {
  /** Present for radial (silicon) bodies; axial (carbon) bodies are beads and limbs only. */
  radial?: RadialLayout;
  /** Body beads first (nBody of them), then limb beads at their rest pose. */
  beads: Bead[];
  nBody: number;
  limbs: LimbRig[];
  /** Half stride of the gait, in layout units. */
  stride: number;
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
  return { beads, nBody: beads.length, limbs: [], stride: 0, radius: length * 0.6, centreY: r };
}


/**
 * Axial (carbon) bodies as spheres: a head-to-tail spine of `segmentCount` soft round beads curling by `curl` radians
 * per joint with a tapering tail and a swollen head, plates on top, paired eyes and horns on the head, and paired
 * tentacle limbs as chains of tapering beads. Pure and deterministic.
 */
function axialLayout(plan: BodyPlan): BeadLayout {
  const n = Math.max(3, Math.round(plan.segmentCount));
  const L = plan.scale;
  const s = L / n;
  const rMax = Math.min(0.22 * L, 1.1 * s);

  // Spine in the XZ plane: tail (i = 0) to head (i = n−1), curling by `curl` radians per joint.
  const spine: { x: number; z: number; r: number; heading: number }[] = [];
  let hx = 0, hz = 0, ang = -(plan.curl * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let prof = 0.55 + 0.45 * Math.sin(Math.PI * (0.1 + 0.8 * t));
    // Head end swells a little; the tail end tapers to a point.
    if (i === n - 1) prof *= 1.12;
    if (i === 0) prof *= 0.6;
    else if (i === 1 && n > 4) prof *= 0.85;
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

  const body: Bead[] = [], eyes: Bead[] = [], horns: Bead[] = [], plates: Bead[] = [];
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
      r: Math.max(head.r * 0.3, 0.01 * L),
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

  // Limbs: legPairs along the front two-thirds of the spine, as 2-bone rigs. Hips sit at body-centre height, and the
  // body is lifted so a slightly bent leg reaches the ground.
  const rigs: LimbRig[] = [];
  const nLegs = plan.legPairs > 0 && plan.limbLength > 0 ? plan.legPairs * 2 : 0;
  const reach = plan.limbLength;
  const lift = nLegs > 0 ? 0.75 * reach : rMax;
  for (const bd of [body, eyes, horns, plates]) for (const b of bd) b.y += lift;
  const bodyBeads = [...body, ...eyes, ...horns, ...plates].slice(0, MAX_BEADS_PER_ORGANISM - 2 * nLegs);
  if (nLegs > 0) {
    const budget = MAX_BEADS_PER_ORGANISM - bodyBeads.length;
    const perBone = Math.max(1, Math.min(2, Math.floor(budget / (2 * nLegs))));
    const rl = Math.max(0.03 * L, rMax * 0.45);
    const restOut = Math.sqrt(Math.max(1e-6, (0.9 * reach) ** 2 - lift * lift));
    let first = bodyBeads.length;
    for (let pair = 0; pair < plan.legPairs; pair++) {
      const idx = Math.min(n - 1, Math.round((n - 1) * (0.2 + 0.75 * (plan.legPairs === 1 ? 0.5 : pair / (plan.legPairs - 1)))));
      const p = spine[idx];
      for (const side of [1, -1] as const) {
        rigs.push({
          hip: { x: p.x, y: lift, z: p.z + side * p.r * 0.7 }, side, pair,
          len1: reach / 2, len2: reach / 2, r: rl, taper: true, perBone, first, snap: 0, restOut,
        });
        first += 2 * perBone;
      }
    }
  }
  const all: Bead[] = bodyBeads.slice();
  for (const rig of rigs) {
    const out: number[] = [];
    limbChain(rig, rig.hip.x, rig.r, rig.hip.z + rig.side * rig.restOut, out);
    for (let i = 0; i < out.length; i += 4) all.push({ x: out[i], y: out[i + 1], z: out[i + 2], r: out[i + 3], tone: BEAD_LIMB });
  }
  let maxY = -Infinity;
  for (const b of all) maxY = Math.max(maxY, b.y + b.r);
  let rad = 0;
  for (const b of all) rad = Math.max(rad, Math.hypot(b.x, b.y - maxY / 2, b.z) + b.r);
  return { beads: all, nBody: bodyBeads.length, limbs: rigs, stride: 0.3 * reach, radius: rad, centreY: maxY / 2 };
}


// --- radial layout (silicon) ---------------------------------------------------------------------------------------
const MAX_TILES = 12;
const D15 = Math.PI / 12;

/**
 * Radial (silicon) bodies as prisms: no head or tail. A hub of `tiers` stacked n-gon facet tiers (n = symmetry), straight
 * rod arms (one per vertex, two bones with 15° joints) radiating from the lowest tier, ceramic tiles on facets (top
 * tiers first), one or three crystal spires on the apex, and dot-eye clusters at the arm tips. The pose is a spoke
 * pose (arms out); fauna re-poses the arms per locomotion mode. Pure and deterministic.
 */
function radialLayout(plan: BodyPlan): BeadLayout {
  const N = plan.symmetry, tiers = Math.max(1, plan.tiers), L = plan.scale;
  const tierH = plan.tierHeight;
  const reach = plan.limbLength;
  const legged = plan.legPairs > 0;
  const lift = legged ? Math.max(tierH / 2, 0.75 * reach) : tierH / 2;
  const radii = plan.tierRadii.length === tiers ? plan.tierRadii : Array.from({ length: tiers }, () => plan.hubRadius);
  const rods: Rod[] = [], beads: Bead[] = [];

  // Hub tiers, bottom to top.
  for (let i = 0; i < tiers; i++) {
    const yc = lift + i * tierH;
    rods.push({ ax: 0, ay: yc - tierH / 2, az: 0, bx: 0, by: yc + tierH / 2, bz: 0, r: radii[i], tone: BEAD_BODY });
  }
  const topY = lift + (tiers - 1) * tierH + tierH / 2;

  // Ceramic tiles flush on facets, top tier first.
  const facets = tiers * N;
  const nTiles = Math.min(MAX_TILES, Math.round(plan.plateCover * facets));
  const tileT = 0.14 * tierH, tileR = 0.32 * tierH;
  for (let k = 0; k < nTiles; k++) {
    const tier = tiers - 1 - Math.floor(k / N), j = k % N;
    const az = ((j + 0.5) * 2 * Math.PI) / N;
    const ap = radii[tier] * Math.cos(Math.PI / N) - 0.3 * tileT, yc = lift + tier * tierH;
    const cx = Math.cos(az), cz = Math.sin(az);
    rods.push({ ax: cx * ap, ay: yc, az: cz * ap, bx: cx * (ap + tileT * 1.3), by: yc, bz: cz * (ap + tileT * 1.3), r: tileR, tone: BEAD_PLATE });
  }

  // Apex spires: one upright, or three tilted 15° outward. Two rods each (thick base, thin tip).
  const spireR = Math.max(0.12 * radii[tiers - 1], 0.01 * L);
  for (let k = 0; k < Math.min(3, plan.hornCount); k++) {
    const az = plan.hornCount === 1 ? 0 : (k * 2 * Math.PI) / 3 + Math.PI / 6;
    const tilt = plan.hornCount === 1 ? 0 : D15;
    const dx = Math.sin(tilt) * Math.cos(az), dy = Math.cos(tilt), dz = Math.sin(tilt) * Math.sin(az);
    const ox = plan.hornCount === 1 ? 0 : Math.cos(az) * 0.4 * radii[tiers - 1], oz = plan.hornCount === 1 ? 0 : Math.sin(az) * 0.4 * radii[tiers - 1];
    const len = Math.max(plan.hornLength, 0.15 * L);
    rods.push({ ax: ox, ay: topY - 0.05 * tierH, az: oz, bx: ox + dx * 0.6 * len, by: topY - 0.05 * tierH + dy * 0.6 * len, bz: oz + dz * 0.6 * len, r: spireR, tone: BEAD_HORN });
    rods.push({ ax: ox + dx * 0.55 * len, ay: topY - 0.05 * tierH + dy * 0.55 * len, az: oz + dz * 0.55 * len, bx: ox + dx * len, by: topY - 0.05 * tierH + dy * len, bz: oz + dz * len, r: spireR * 0.5, tone: BEAD_HORN });
  }
  const nHubRods = rods.length;

  // Arms from the lowest tier's vertices, plus eye dots at the tips.
  const arms: ArmRig[] = [];
  const armR = Math.max(0.04 * L, 0.16 * radii[0]);
  const restOut = legged ? Math.sqrt(Math.max(1e-6, (0.9 * reach) ** 2 - lift * lift)) : 0.9 * reach;
  const restFootY = legged ? armR : Math.max(armR, lift - 0.2 * reach);
  const eyesPerArm = plan.eyeKind === 'none' || plan.eyeCount === 0 ? 0 : Math.max(1, Math.round(plan.eyeCount / N));
  const eyeR = Math.max(1.1 * armR, 0.012 * L);
  for (let k = 0; k < N; k++) {
    const az = (plan.arms[k]?.azimuthDeg ?? (360 / N) * k) * (Math.PI / 180);
    const dirX = Math.cos(az), dirZ = Math.sin(az);
    const rig: ArmRig = {
      index: k, hip: { x: dirX * radii[0], y: lift, z: dirZ * radii[0] }, dirX, dirZ,
      len1: reach / 2, len2: reach / 2, r: armR, snap: SNAP_DEG, restOut, restFootY,
      phase: armPhase(k, N), firstRod: rods.length, eyeFirst: 0, eyeN: eyesPerArm, eyeR, eyeDX: [], eyeDZ: [],
    };
    const out: number[] = [];
    armRods(rig, rig.hip.x + dirX * restOut, restFootY, rig.hip.z + dirZ * restOut, out);
    for (let i = 0; i < out.length; i += 7) rods.push({ ax: out[i], ay: out[i + 1], az: out[i + 2], bx: out[i + 3], by: out[i + 4], bz: out[i + 5], r: out[i + 6], tone: BEAD_LIMB });
    rig.eyeFirst = beads.length;
    for (let e = 0; e < eyesPerArm; e++) {
      const a = (2 * Math.PI * e) / Math.max(1, eyesPerArm);
      const ring = eyesPerArm === 1 ? 0 : 1.5 * eyeR;
      rig.eyeDX.push(Math.cos(a) * ring); rig.eyeDZ.push(Math.sin(a) * ring);
    }
    const tip = rods[rods.length - 1];
    for (let e = 0; e < eyesPerArm; e++) beads.push({ x: tip.bx + rig.eyeDX[e], y: tip.by + eyeR * 0.6, z: tip.bz + rig.eyeDZ[e], r: eyeR, tone: BEAD_EYE });
    arms.push(rig);
  }

  let maxY = topY, rad = 0, maxOut = radii.reduce((m, r) => Math.max(m, r), 0);
  for (const r of rods) { maxY = Math.max(maxY, r.ay + r.r, r.by + r.r); maxOut = Math.max(maxOut, Math.hypot(r.bx, r.bz), Math.hypot(r.ax, r.az)); }
  const cy = maxY / 2;
  for (const r of rods) rad = Math.max(rad, Math.hypot(r.ax, r.ay - cy, r.az) + r.r, Math.hypot(r.bx, r.by - cy, r.bz) + r.r);
  for (const b of beads) rad = Math.max(rad, Math.hypot(b.x, b.y - cy, b.z) + b.r);
  return {
    beads, nBody: 0, limbs: [], stride: 0.3 * reach, radius: rad, centreY: cy,
    radial: { rods, nTiers: tiers, hubSides: N, nHubRods, arms, pivotY: lift + ((tiers - 1) * tierH) / 2, rollRadius: Math.max(maxOut, radii[0]) },
  };
}

/**
 * Rods of an arm for a foot at (fx, fy, fz) in body space (fy is the foot-centre height): the 2-bone IK in the vertical
 * plane through hip and foot, joints snapped to 15°. Appends ax, ay, az, bx, by, bz, r for the two bones to `out`.
 */
export function armRods(rig: ArmRig, fx: number, fy: number, fz: number, out: number[]): void {
  const dx = fx - rig.hip.x, dz = fz - rig.hip.z;
  const u = Math.hypot(dx, dz) || 1e-6;
  const ex = dx / u, ez = dz / u;
  const sol = solveTwoBone(u, fy - rig.hip.y, rig.len1, rig.len2, rig.snap);
  const kx = rig.hip.x + ex * sol.kneeU, ky = rig.hip.y + sol.kneeV, kz = rig.hip.z + ez * sol.kneeU;
  const px = rig.hip.x + ex * sol.footU, py = rig.hip.y + sol.footV, pz = rig.hip.z + ez * sol.footU;
  out.push(rig.hip.x, rig.hip.y, rig.hip.z, kx, ky, kz, rig.r);
  out.push(kx, ky, kz, px, py, pz, rig.r * 0.8);
}

/**
 * Turns a BodyPlan into a creature layout: spheres for axial (carbon) bodies, prisms for radial (silicon) ones.
 * The architecture comes from the plan; the two share nothing but the BeadLayout envelope.
 */
export function beadLayout(plan: BodyPlan): BeadLayout {
  return plan.architecture === 'radial' ? radialLayout(plan) : axialLayout(plan);
}

/**
 * Bead positions of a limb for a foot at (fx, fy, fz) in body space (fy is the foot-centre height). Solves the 2-bone
 * IK in the vertical plane through hip and foot; silicon joints snap to 15°. Appends x, y, z, r for each bead to `out`.
 */
export function limbChain(rig: LimbRig, fx: number, fy: number, fz: number, out: number[]): void {
  const dx = fx - rig.hip.x, dz = fz - rig.hip.z;
  const u = Math.hypot(dx, dz) || 1e-6;
  const ex = dx / u, ez = dz / u;
  const sol = solveTwoBone(u, fy - rig.hip.y, rig.len1, rig.len2, rig.snap);
  const total = rig.perBone * 2;
  for (let bone = 0; bone < 2; bone++) {
    const u0 = bone === 0 ? 0 : sol.kneeU, v0 = bone === 0 ? 0 : sol.kneeV;
    const u1 = bone === 0 ? sol.kneeU : sol.footU, v1 = bone === 0 ? sol.kneeV : sol.footV;
    for (let k = 1; k <= rig.perBone; k++) {
      const f = k / rig.perBone, idx = bone * rig.perBone + k;
      const uu = u0 + (u1 - u0) * f, vv = v0 + (v1 - v0) * f;
      const r = rig.taper ? rig.r * (1 - 0.5 * (idx / total)) : rig.r;
      out.push(rig.hip.x + ex * uu, rig.hip.y + vv, rig.hip.z + ez * uu, r);
    }
  }
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
