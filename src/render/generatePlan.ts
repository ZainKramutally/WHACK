// The Generate transition's plan (CLAUDE.md "The particle box and the Generate transition"): pure maths, no three.js, no DOM.
// The box's dots divide on a steady pulse (196 → 25,088 grains for 7 doublings). Each pulse is a front sweeping outward by
// ground distance: daughters appear at their parent, flash, and arc to a landing spot. Landing spots are found by casting rays
// through a lattice of the spawn view (the camera pose the player will have at build.spawnSec) onto the real analytic terrain,
// so the grains land exactly where the finished frame shows ground. Everything is a pure function of the world, the run seed and
// the box layout, so the same inputs give the same plan. render/generate.ts turns the plan into GPU attributes.
import { seaLevelForCover, spawnPoint, type MachineId, type Terrain, type TerrainState } from '../gen/terrain';
import { createFollowCamera } from '../player/camera';
import { walkFloor } from '../player/logic';
import { equilibriumSeaCover } from '../sim/limits';
import { makeRng } from '../sim/rng';
import { controlList } from '../worlds';
import type { Conditions, WorldConfig } from '../worlds/types';

/** Total grains at the end, whatever the box holds: the doublings are derived from the number of box dots. */
export const GRAIN_BUDGET = 27000;
/** Pulse g (1-based) starts at PULSE0 + PULSE_DT·(g−1); a pulse's front sweeps outward over SWEEP seconds. */
export const PULSE0 = 0.6;
export const PULSE_DT = 0.5;
export const SWEEP = 0.4;
/** Grains float this far above the surface (m). */
export const LIFT = 0.1;
/** Gen-0 dots start falling from here; they are on the box plane until then. */
export const FALL0 = 0.4;
/** The box copy: gen-0 grains appear over it, it stops moving, then dissolves pixel by pixel while the first divisions happen. */
export const APPEAR0 = 0.35;
export const BOX_STOP: [number, number] = [0.15, 0.45];
export const BOX_FADE: [number, number] = [0.4, 0.85];
/** Start camera distance from the box plane (m); the DOM sheet's scale is D0 ÷ distance. */
export const D0 = 5.17;
/** Reveal field resolution over the patch. */
export const REVEAL_RES = 512;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Soft attack + decay, peak 1 at tau = a. */
export const alpha = (tau: number, a: number) => (tau <= 0 ? 0 : (tau / a) * Math.exp(1 - tau / a));

export interface Vec3 { x: number; y: number; z: number }
export interface CamPose { pos: Vec3; look: Vec3 }

/** The camera the player has right after spawning: the app's own follow camera, snapped. Pure. */
export function spawnCameraPose(spawn: { x: number; z: number }, ground: (x: number, z: number) => number, floorAt?: (x: number, z: number) => number): CamPose {
  const fc = createFollowCamera({ floorAt: floorAt ?? ground });
  fc.snap({ x: spawn.x, y: ground(spawn.x, spawn.z), z: spawn.z }, false);
  return { pos: { ...fc.position }, look: { ...fc.lookAt } };
}

/** Piecewise cubic Hermite through (times, vals) with finite-difference tangents and zero velocity at the ends. */
export function hermite(vals: number[], times: number[], t: number): number {
  const n = vals.length;
  const m = vals.map((_, i) => (i === 0 || i === n - 1 ? 0 : (vals[i + 1] - vals[i - 1]) / (times[i + 1] - times[i - 1])));
  let i = 0;
  while (i < n - 2 && t > times[i + 1]) i++;
  const h = times[i + 1] - times[i];
  const s = clamp01((t - times[i]) / h), s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vals[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * vals[i + 1] + (s3 - s2) * h * m[i + 1];
}

export interface PlanInput {
  world: WorldConfig;
  terrain: Terrain;
  seed: number;
  /** The conditions the sim starts from (after any slider move): temperature sets the terrain's heat input, nitrogen the silicon seas. */
  start: Conditions;
  /** Internal (lattice) resolution of the pixel pass. */
  lowW: number;
  lowH: number;
  /** Vertical field of view (deg) and aspect of the scene camera. */
  fov: number;
  aspect: number;
  /** Every box dot as 0..1 fractions of the box (y down); `atom` marks element atoms. */
  gen0: { x: number; y: number; atom: boolean }[];
  /** World placement of the box plane: centre height and side length (m). Its z is the spawn z. */
  boxCy: number;
  boxSize: number;
  /** Total grains (default GRAIN_BUDGET). */
  budget?: number;
}

export interface GenPlan {
  N: number;
  /** Box dots (generation 0). */
  n0: number;
  doublings: number;
  spawn: { x: number; z: number };
  /** The player's camera at spawn, from the estimated spawn. */
  pose: CamPose;
  seaCover: number;
  /** Per grain (4 floats each): start xyz + birth time | land x, land z, flight time, arc height | start colour rgb + appear time | world size, kind, hash, depth. */
  A: Float32Array; B: Float32Array; C: Float32Array; D: Float32Array;
  parent: Int32Array;
  gen: Uint8Array;
  /** REVEAL_RES² seconds at which the terrain under each texel is revealed (REVEAL_NEVER where no grain lands). */
  reveal: Float32Array;
  lastLand: number;
  stateAt(t: number): TerrainState;
  /** Box dot positions in world space that A was built from. */
  gen0World: Vec3[];
}

/** Atoms are drawn red-orange; solvent dots are teal. The generator reads these two as colour keys. */
export const KIND_COLOURS = { atom: [1.0, 0.42, 0.24], solvent: [0.77, 1.0, 0.93] } as const;

/** Stats the sim samples once from the world's ranges, in config order (simulation.ts): the sea cover is among them. */
export function sampledStats(world: WorldConfig, seed: number): Record<string, number> {
  const rnd = makeRng(seed)('world');
  const out: Record<string, number> = {};
  for (const s of world.stats) {
    const r = world.ranges[s.id];
    out[s.id] = r ? r[0] + (r[1] - r[0]) * rnd() : 0;
  }
  return out;
}

/** The sea cover (%) the sim starts the build with: sampled from the world's range, or (nitrogen seas) from the sea-volume model. */
export function startSeaCover(world: WorldConfig, seed: number, start: Conditions): number {
  const sampled = sampledStats(world, seed);
  if (world.derived.some((d) => d.model === 'seaVolume')) return 100 * equilibriumSeaCover(world, start, { gravity: sampled.gravity ?? 1, controls: controlList });
  return sampled.seaCover ?? 0;
}

export function* planSteps(inp: PlanInput): Generator<void, GenPlan> {
  const { world, terrain } = inp;
  const n0 = inp.gen0.length;
  const budget = Math.max(n0, inp.budget ?? GRAIN_BUDGET);
  const doublings = Math.max(0, Math.ceil(Math.log2(budget / n0)));
  const N = Math.min(budget, n0 * Math.pow(2, doublings));
  const S = terrain.patchSize;
  const dur = world.build.durationSec;
  const spawnSec = world.build.spawnSec;
  const [s0, s1] = world.build.seasSec;
  const temperature = inp.start.temperature;
  const heat = heatSolvent(temperature, world.solvent.freezeC, world.terrain.heatSolventSpan);
  const progressAll = (r: number) => { const p: Partial<Record<MachineId, number>> = {}; for (const m of world.terrain.machines) p[m.id] = r; return p; };
  const stateAt = (t: number): TerrainState => { const r = clamp01(t / dur); return { rise: r, progress: progressAll(r), heatSolvent: heat }; };

  // Spawn: exactly as main.ts spawnFor (finished terrain, the sea cover the sim starts with, unquantised).
  const cover = startSeaCover(world, inp.seed, inp.start);
  const full = stateAt(dur);
  const sp = spawnPoint(terrain, full, seaLevelForCover(terrain, full, cover / 100));
  const spawn = { x: sp.x, z: sp.z };
  yield;

  // Spawn camera (the player's), on the terrain as it stands at spawnSec.
  const st6 = stateAt(spawnSec);
  const fill6 = sstep(s0, s1, spawnSec);
  const level6 = seaLevelForCover(terrain, st6, cover / 100 * fill6);
  const frozen = temperature < world.solvent.freezeC;
  const pose = spawnCameraPose(spawn, (x, z) => terrain.height(x, z, st6), (x, z) => walkFloor(terrain.height(x, z, st6), level6, frozen));
  yield;

  // Height grid for ray marching (256², bilinear). Chunked by rows.
  const G = 256, cell = S / G, R = G + 1;
  const hgrid = new Float32Array(R * R);
  for (let j = 0; j <= G; j++) {
    for (let i = 0; i <= G; i++) hgrid[j * R + i] = terrain.height(-S / 2 + i * cell, -S / 2 + j * cell, st6);
    if (j % 8 === 7) yield;
  }
  const hAt = (x: number, z: number) => {
    const fx = (x + S / 2) / cell, fz = (z + S / 2) / cell;
    const i = Math.min(G - 1, Math.max(0, Math.floor(fx))), j = Math.min(G - 1, Math.max(0, Math.floor(fz)));
    const a = fx - i, b = fz - j;
    return lerp(lerp(hgrid[j * R + i], hgrid[j * R + i + 1], a), lerp(hgrid[(j + 1) * R + i], hgrid[(j + 1) * R + i + 1], a), b);
  };
  const inPatch = (x: number, z: number) => Math.abs(x) < S / 2 - 1 && Math.abs(z) < S / 2 - 1;

  // Camera basis for rays.
  const P = pose.pos;
  let fx = pose.look.x - P.x, fy = pose.look.y - P.y, fz = pose.look.z - P.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;   // f × up(0,1,0)
  const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const tanH = Math.tan((inp.fov * Math.PI) / 360);
  const { lowW, lowH } = inp;
  const rayHit = (px: number, py: number): { x: number; z: number; depth: number } | null => {
    const nx = (px / lowW) * 2 - 1, ny = 1 - (py / lowH) * 2;
    let dx = fx + rx * nx * inp.aspect * tanH + ux * ny * tanH, dy = fy + ry * nx * inp.aspect * tanH + uy * ny * tanH, dz = fz + rz * nx * inp.aspect * tanH + uz * ny * tanH;
    const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
    let tPrev = 0.3, prevAbove = true;
    for (let t = 0.3; t < 380; t += Math.max(0.4, t * 0.014)) {
      const x = P.x + dx * t, y = P.y + dy * t, z = P.z + dz * t;
      if (!inPatch(x, z)) { if (t > 4) return null; continue; }
      const above = y > hAt(x, z);
      if (prevAbove && !above) {
        let lo = tPrev, hi = t;
        for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; (P.y + dy * mid > hAt(P.x + dx * mid, P.z + dz * mid)) ? (lo = mid) : (hi = mid); }
        const tm = (lo + hi) / 2;
        return { x: P.x + dx * tm, z: P.z + dz * tm, depth: tm };
      }
      prevAbove = above; tPrev = t;
    }
    return null;
  };

  // Landing slots: stratified rays through the lattice cells of the spawn view, plus a sparser margin so the tide never shows
  // a frustum edge while the camera pulls back. Pitch is iterated until ~N cells land on ground.
  const rs = makeRng(inp.seed)('generate');
  type Slot = { x: number; z: number; depth: number; kind: number };
  let slots: Slot[] = [];
  let pitch = 2.0;
  for (let it = 0; it < 4; it++) {
    slots = [];
    for (let cy = 0; cy < lowH; cy += pitch) {
      for (let cx = 0; cx < lowW; cx += pitch) {
        const h = rayHit(Math.min(lowW - 1, cx + rs() * pitch), Math.min(lowH - 1, cy + rs() * pitch));
        if (h) slots.push({ x: h.x, z: h.z, depth: h.depth, kind: 0 });
      }
      yield;
    }
    const pm = pitch * 2.3;
    for (let cy = -0.3 * lowH; cy < 1.55 * lowH; cy += pm) {
      for (let cx = -0.3 * lowW; cx < 1.3 * lowW; cx += pm) {
        const px = cx + rs() * pm, py = cy + rs() * pm;
        if (px >= 0 && px < lowW && py >= 0 && py < lowH) continue;
        const h = rayHit(px, py);
        if (h) slots.push({ x: h.x, z: h.z, depth: h.depth, kind: 2 });
      }
      yield;
    }
    pitch *= Math.sqrt(slots.length / N);
    if (Math.abs(slots.length - N) < N * 0.03) break;
  }
  for (let guard = 0; slots.length < N && guard < 40000; guard++) {
    const h = rayHit(rs() * lowW, (0.3 + 0.7 * rs()) * lowH);
    if (h) slots.push({ x: h.x, z: h.z, depth: h.depth, kind: 0 });
    if (guard % 500 === 0) yield;
  }
  while (slots.length > N) slots.splice(Math.floor(rs() * slots.length), 1);
  if (slots.length < N) while (slots.length < N) slots.push({ ...slots[slots.length % Math.max(1, slots.length)] });   // degenerate view: reuse
  yield;

  // Sort by ground distance from the spawn: generation g owns the next block of slots.
  const dist = (s: Slot) => Math.hypot(s.x - spawn.x, s.z - spawn.z);
  slots.sort((a, b) => dist(a) - dist(b));
  for (const s of slots) if (s.kind !== 2) s.kind = rs() < (s.depth < 14 ? 0.55 : s.depth < 45 ? 0.3 : 0.12) ? 1 : 0;
  yield;

  // Typed arrays.
  const A = new Float32Array(N * 4), B = new Float32Array(N * 4), C = new Float32Array(N * 4), D = new Float32Array(N * 4);
  const parent = new Int32Array(N).fill(-1);
  const gen = new Uint8Array(N);
  const boxZ = spawn.z;
  const gen0World: Vec3[] = inp.gen0.map((d) => ({ x: spawn.x + (d.x - 0.5) * inp.boxSize, y: inp.boxCy + (0.5 - d.y) * inp.boxSize, z: boxZ + 0.03 }));
  const atomCol = KIND_COLOURS.atom, solvCol = KIND_COLOURS.solvent;

  const posAt = (i: number, t: number): [number, number, number] => {
    const birth = A[i * 4 + 3], dd = B[i * 4 + 2];
    const u = clamp01((t - birth) / dd), e = 1 - Math.pow(1 - u, 2.2);
    const lx = B[i * 4], lz = B[i * 4 + 1];
    const hL = terrain.height(lx, lz, stateAt(t)) + LIFT;
    return [lerp(A[i * 4], lx, e), lerp(A[i * 4 + 1], hL, u) + B[i * 4 + 3] * 4 * u * (1 - u), lerp(A[i * 4 + 2], lz, e)];
  };

  // Generation 0: the box's own dots.
  for (let i = 0; i < n0; i++) {
    const s = slots[i], w = gen0World[i], atom = inp.gen0[i].atom;
    const f = FALL0 + 0.3 * rs() + 0.35 * inp.gen0[i].y;   // lower dots fall later: they are already in the liquid
    A.set([w.x, w.y, w.z, f], i * 4);
    B.set([s.x, s.z, 0.55 + 0.25 * rs(), 0.4 + rs() * 0.8], i * 4);
    const c = atom ? atomCol : solvCol;
    C.set([c[0], c[1], c[2], APPEAR0], i * 4);
    D.set([atom ? 0.06 : 0.02, s.kind, rs(), s.depth], i * 4);
    gen[i] = 0;
  }
  yield;
  let have = n0;
  for (let g = 1; g <= doublings; g++) {
    const nKids = Math.min(have, N - have);
    if (nKids <= 0) break;
    const Pg = PULSE0 + PULSE_DT * (g - 1);
    // Pair parents and daughters by bearing from the spawn, so daughters leave their parent along the tide, outward.
    // The last generation may be partial (the budget caps the total): an evenly spread subset of parents divides.
    const dividing = Array.from({ length: nKids }, (_, j) => Math.floor((j * have) / nKids));
    const bearingP = dividing.map((i) => ({ i, a: Math.atan2(B[i * 4 + 1] - spawn.z, B[i * 4] - spawn.x) })).sort((a, b) => a.a - b.a);
    const kids = Array.from({ length: nKids }, (_, k) => have + k).sort((a, b) => Math.atan2(slots[a].z - spawn.z, slots[a].x - spawn.x) - Math.atan2(slots[b].z - spawn.z, slots[b].x - spawn.x));
    const order = [...kids].sort((a, b) => dist(slots[a]) - dist(slots[b]));
    const rank = new Map(order.map((k, r) => [k, r / Math.max(1, order.length - 1)]));
    for (let j = 0; j < kids.length; j++) {
      const k = kids[j], par = bearingP[j].i, s = slots[k];
      const b = Pg + SWEEP * Math.pow(rank.get(k)!, 0.85);
      const at = posAt(par, b);
      const d = Math.hypot(s.x - at[0], s.z - at[2]);
      A.set([at[0], at[1], at[2], b], k * 4);
      B.set([s.x, s.z, Math.min(0.8, Math.max(0.32, 0.28 + 0.004 * d)), Math.min(18, 0.09 * d + 0.2 + rs() * 0.6)], k * 4);
      C.set([C[par * 4], C[par * 4 + 1], C[par * 4 + 2], b], k * 4);
      D.set([g <= 3 ? 0.05 / g : 0, s.kind, rs(), s.depth], k * 4);   // the first divisions are drawn large enough to read
      parent[k] = par; gen[k] = g;
      if (j % 2500 === 2499) yield;
    }
    have += nKids;
    yield;
  }
  let lastLand = 0;
  for (let i = 0; i < N; i++) lastLand = Math.max(lastLand, A[i * 4 + 3] + B[i * 4 + 2]);

  // Reveal field: when the real terrain under each texel is uncovered. The tide is a ring around the spawn: the time the ring
  // reaches a distance is when most grains landing there have landed (a monotone profile over distance), with a little noise so
  // its edge is ragged, not a clean circle. Texels the view never reaches follow the last ring outward.
  const reveal = new Float32Array(REVEAL_RES * REVEAL_RES);
  const texel = S / REVEAL_RES;
  const BINS = 96;
  let rmax = 0;
  for (let i = 0; i < N; i++) rmax = Math.max(rmax, Math.hypot(B[i * 4] - spawn.x, B[i * 4 + 1] - spawn.z));
  const binW = rmax / BINS;
  const perBin: number[][] = Array.from({ length: BINS }, () => []);
  for (let i = 0; i < N; i++) {
    const r = Math.hypot(B[i * 4] - spawn.x, B[i * 4 + 1] - spawn.z);
    perBin[Math.min(BINS - 1, Math.floor(r / binW))].push(A[i * 4 + 3] + B[i * 4 + 2]);
  }
  const ring = new Float32Array(BINS + 1);
  const raw = new Float32Array(BINS);
  let last = 1.5;
  for (let k = 0; k < BINS; k++) {
    const v = perBin[k].sort((x, y) => x - y);
    raw[k] = v.length >= 8 ? v[Math.floor(v.length * 0.3)] : NaN;   // sparse bins say nothing: interpolate over them
  }
  for (let k = 0; k < BINS; k++) {
    if (Number.isNaN(raw[k])) {
      let j = k; while (j < BINS && Number.isNaN(raw[j])) j++;
      raw[k] = j < BINS ? raw[j] : last;
    }
    last = raw[k];
  }
  // Smooth (moving average), then force monotone: the ring only ever moves outward.
  let prev = 1.5;
  for (let k = 0; k < BINS; k++) {
    let sum = 0, n = 0;
    for (let d = -4; d <= 4; d++) { const q = k + d; if (q >= 0 && q < BINS) { sum += raw[q]; n++; } }
    prev = Math.max(prev + 0.004, sum / n);
    ring[k] = prev;
  }
  ring[BINS] = prev + 0.05;
  const vFar = 80;   // m/s: how fast the ring runs past the last grain
  for (let zz = 0; zz < REVEAL_RES; zz++) {
    for (let xx = 0; xx < REVEAL_RES; xx++) {
      const wx = (xx + 0.5) * texel - S / 2, wz = (zz + 0.5) * texel - S / 2;
      const r = Math.hypot(wx - spawn.x, wz - spawn.z);
      const f = r / binW, k0 = Math.min(BINS - 1, Math.floor(f));
      const base = r > rmax ? ring[BINS] + (r - rmax) / vFar : lerp(ring[k0], ring[Math.min(BINS, k0 + 1)], f - k0);
      const h = Math.sin(xx * 12.9898 + zz * 78.233) * 43758.5453; const n = h - Math.floor(h);
      reveal[zz * REVEAL_RES + xx] = base + (n - 0.5) * 0.3;
    }
    if (zz % 32 === 31) yield;
  }

  return { N, n0, doublings, spawn, pose, seaCover: cover, A, B, C, D, parent, gen, reveal, lastLand, stateAt, gen0World };
}

/** Pure helper: run a plan to completion (tests, and the rare click-before-ready case). */
export function runPlan(inp: PlanInput): GenPlan {
  const it = planSteps(inp);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

function heatSolvent(tempC: number, freezeC: number, span: number): number {
  return clamp01(0.5 + (tempC - freezeC) / span);
}

/**
 * The box is live until Generate: when the transition starts, the dots are somewhere else than where the plan assumed. Re-seat
 * generation 0 on the live dots and recompute the early daughters' starts (they leave from mid-air parents). Cheap: ~3k heights.
 */
export function refineEarly(plan: GenPlan, terrain: Terrain, gen0World: Vec3[], maxGen = 4): number {
  const { A, B, parent, gen } = plan;
  for (let i = 0; i < plan.n0 && i < gen0World.length; i++) { A[i * 4] = gen0World[i].x; A[i * 4 + 1] = gen0World[i].y; A[i * 4 + 2] = gen0World[i].z; }
  plan.gen0World = gen0World;
  const upto = Math.min(plan.N, plan.n0 * Math.pow(2, Math.min(maxGen, plan.doublings)));
  for (let k = plan.n0; k < upto; k++) {
    const par = parent[k], b = A[k * 4 + 3];
    const u = clamp01((b - A[par * 4 + 3]) / B[par * 4 + 2]), e = 1 - Math.pow(1 - u, 2.2);
    const hL = terrain.height(B[par * 4], B[par * 4 + 1], plan.stateAt(b)) + LIFT;
    A[k * 4] = lerp(A[par * 4], B[par * 4], e);
    A[k * 4 + 1] = lerp(A[par * 4 + 1], hL, u) + B[par * 4 + 3] * 4 * u * (1 - u);
    A[k * 4 + 2] = lerp(A[par * 4 + 2], B[par * 4 + 1], e);
  }
  void gen;
  return upto;
}
