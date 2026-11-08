// Plant placement from the flora grid: a pure function of VisualInputs, the patch size and the camera's ground position.
// No three.js. Composition (docs/ART_DIRECTION.md §1.3/§1.6):
//   foreground  dense, darker ground cover within ~30 m of the camera (extra plants, one value step darker)
//   midground   mid species gathered into groves by a low-frequency grove field
//   background  giants on a sparse superblock lattice, so their silhouettes read against the sky and haze
// Each biomass pool feeds its own role: mat → ground cover (count and size), canopy → mid and giant plants (the
// cell's canopy form, formForBin with the bin's mix raised; still a pure function of the cell's conditions). A
// canopy-dominant cell (floraForm's own bin) makes the biggest giants likelier. Plants exist only where the cell has
// biomass; mid and giant plants need land (and so lifeOnLand); underwater cells keep only ground cover (sea-margin mats
// and crusts). Camera distance thins far ground cover and picks the LOD.
// Plants stand on the DRAWN ground: the terrain mesh is piecewise linear between its vertices (TERRAIN_SEGMENTS), so
// heights and slopes come from the mesh triangle under the plant, not the analytic height (they differ by metres on
// frost fins and relic flanks). Each ground plant takes the form of its own side of the sea (a shore cell holds both).
import type { VisualInputs } from '../../worlds/types';
import { FLORA_EPS, FLORA_GRID, hash01, patchToWorld } from '../layout';
import { floraBin, formForBin, type FloraBin, type FloraForm } from '../floraForm';
import { ARCHETYPE_INDEX, ARCHETYPE_META, NEUTRAL_TINT, ROLE_BAND, pickPlant, plantHeight, type FloraRole } from './index';
import { AQUATIC_B, activeGates, aquaticFor, gateKey, worldEnv, type CellProbe } from './gates';
import { varyPlant, type PlantVary } from './vary';
import { makeEnv, plantEnv, worldEnv as traitWorld } from './traits';

export const MAX_PLANTS = 16000;
/** Base ground-cover plants per fully grown cell, and the extra dark ones in the foreground. */
const GROUND_PER_CELL = 5, FOREGROUND_EXTRA = 8; // base (≤ 6) + extra ≤ 14 per cell
const FOREGROUND_R = 30;
/** Ground cover thins from THIN_START to none at THIN_END metres from the camera (sub-pixel at our resolution). */
const THIN_START = 45, THIN_END = 150;
/** Giants: at most one per SUPER × SUPER cells (~31 m). */
const SUPER = 5;
/** Canopy biomass needed for a giant / a mid plant in a cell (backdrop.ts reads GIANT_CANOPY for its horizon giants). */
export const GIANT_CANOPY = 0.2, MID_CANOPY = 0.04;
/** Mid plants thin from MID_THIN_START to 30% at MID_THIN_END metres from the camera. */
const MID_THIN_START = 70, MID_THIN_END = 200;
/** Near-LOD radius per role (m). At 30 m the pixel look (360 px internal height) gives ~10 px per metre, so ground cover
 * beyond it draws its far LOD; the dark foreground step (≤ 30 m) is always near. */
export const LOD_NEAR: Record<FloraRole, number> = { ground: 30, mid: 40, giant: 90 };

export interface PlantList {
  n: number;
  arch: Int16Array;
  x: Float32Array; y: Float32Array; z: Float32Array;
  h: Float32Array; yaw: Float32Array;
  lod: Uint8Array; dark: Uint8Array;
  glow: Float32Array;
  /** Tilt to draw the plant with, as the slope (dy/dx, dy/dz) its up axis follows (0: upright). */
  gx: Float32Array; gz: Float32Array;
  /** Extra depth (m) to sink the base so its contact ring meets the drawn ground on every side. */
  sink: Float32Array;
  /** Flora cell and slot (within the cell's role; the darker foreground extras count from 0 again) of each plant. */
  cell: Uint16Array; slot: Uint8Array;
  /** Per-plant look (vary.ts), each 0 for none, so a zeroed list draws native plants: girth − 1, crown − 1, twist,
   * droop, bend, the lean slope (already added into gx/gz) and the tint − NEUTRAL_TINT (rgb). */
  wg: Float32Array; wc: Float32Array; wt: Float32Array; wd: Float32Array; wb: Float32Array;
  lx: Float32Array; lz: Float32Array;
  tr: Float32Array; tg: Float32Array; tb: Float32Array;
  /** 1: toothed cap and fan rims (T6). */
  teeth: Uint8Array;
}

export function makePlantList(cap = MAX_PLANTS): PlantList {
  return {
    n: 0, arch: new Int16Array(cap), x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap),
    h: new Float32Array(cap), yaw: new Float32Array(cap), lod: new Uint8Array(cap), dark: new Uint8Array(cap), glow: new Float32Array(cap),
    gx: new Float32Array(cap), gz: new Float32Array(cap), sink: new Float32Array(cap),
    cell: new Uint16Array(cap), slot: new Uint8Array(cap),
    wg: new Float32Array(cap), wc: new Float32Array(cap), wt: new Float32Array(cap), wd: new Float32Array(cap), wb: new Float32Array(cap),
    lx: new Float32Array(cap), lz: new Float32Array(cap), tr: new Float32Array(cap), tg: new Float32Array(cap), tb: new Float32Array(cap),
    teeth: new Uint8Array(cap),
  };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Smooth value noise 0..1 over flora cells on an L-cell lattice. */
function noiseAt(col: number, row: number, L: number, salt: number): number {
  const gx = col / L, gz = row / L;
  const x0 = Math.floor(gx), z0 = Math.floor(gz), fx = gx - x0, fz = gz - z0;
  const v = (i: number, j: number) => hash01(i + 1000, j + 1000, salt);
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = v(x0, z0) + (v(x0 + 1, z0) - v(x0, z0)) * sx;
  const b = v(x0, z0 + 1) + (v(x0 + 1, z0 + 1) - v(x0, z0 + 1)) * sx;
  return a + (b - a) * sz;
}

/** Low-frequency grove field 0..1 (6-cell lattice, ~37 m): mid species gather where it is high. */
export function groveAt(col: number, row: number): number {
  return smooth(0.35, 0.75, noiseAt(col, row, 6, 77));
}

/** Ground-cover clumps (4-cell lattice, ~25 m): 0.25 in the gaps, 1 in the clumps, so plain ground shows between. */
export function clumpAt(col: number, row: number): number {
  return 0.25 + 0.75 * smooth(0.3, 0.6, noiseAt(col, row, 4, 78));
}

/** Segments per side of the GPU terrain mesh: terrainNode.ts createTerrainMesh's default, which main.ts uses
 * (floraAudit.test.ts keeps the two in step). */
export const TERRAIN_SEGMENTS = 192;
const VERTS = (TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1);

/**
 * Optional ground-height cache for placePlants, one entry per terrain-mesh vertex. The terrain is rise × h(x, z, p),
 * and h is affine in the landform progress p (each machine adds p × its term; during the build every machine's
 * progress is buildProgress) while heatSolvent holds. So a vertex keeps its last two unit heights h and gives h at any
 * p exactly; vertices are re-sampled round-robin (1/4 per rebuild during the build, 1/8 after it) and all of them when
 * heatSolvent moves. A single cached h went stale by up to 0.5 m while the landforms grew. Reset it when the world or
 * patch changes.
 */
export interface HeightCache {
  /** Per vertex: the last two unit heights (height ÷ rise), the build progress of each, and how many are held. */
  a: Float32Array; b: Float32Array; pa: Float32Array; pb: Float32Array; n: Uint8Array;
  /** placePlants call that last sampled each vertex. */
  stamp: Int32Array;
  gen: number;
  /** heatSolvent the samples hold for. */
  hs: number;
}
/** Density by FloraForm.lush (biomass magnitude): sparse, normal, lush. Absent (older floraForm) counts as normal. */
const LUSH_DENSITY = [0.7, 1, 1.2] as const;
/** Mid groves thin in sparse cells but never thicken past normal: mids are the costliest plants, and the worst case
 * (canopy over the whole patch, every cell lush) must hold the mid budget. Lush thickens ground cover only. */
const MID_DENSITY = LUSH_DENSITY.map((d) => Math.min(1, d));
const lushOf = (f: FloraForm): 0 | 1 | 2 => (f as { lush?: 0 | 1 | 2 }).lush ?? 1;
/** The cell's bin with another mix: keeps every per-cell field the bin carries (submerged, lush on newer floraForm). */
const withMix = (b: FloraBin, mix: 0 | 1 | 2): FloraBin => Object.assign({}, b, { mix });

/** Plants per cell: 1 giant, up to 3 mid (GROUND_SLOT − MID_SLOT), and up to 14 ground cover. */
const MID_SLOT = 1, GROUND_SLOT = 4;
export function makeHeightCache(): HeightCache {
  const f = () => new Float32Array(VERTS);
  return { a: f(), b: f(), pa: f(), pb: f(), n: new Uint8Array(VERTS), stamp: new Int32Array(VERTS).fill(-1), gen: 0, hs: NaN };
}
export function resetHeightCache(c: HeightCache) { c.n.fill(0); c.stamp.fill(-1); c.gen = 0; c.hs = NaN; }

/**
 * Fill `out` with every plant to draw. Deterministic: the same inputs, patch and camera give the same list (with a
 * cache, ground heights may lag the terrain by up to a few rebuilds while it is still rising).
 * `cam` is the camera's ground position (x, z). `clearing` (the spawn point) keeps a disc free of mid and giant plants
 * (ground cover only), so the spawn frame opens onto groves and giants in the middle distance.
 */
export interface Clearing { x: number; z: number; r: number }

/** Extra clearance for giants beyond the clearing radius: their caps overhang (m). */
const GIANT_OVERHANG = 12;
/** Ground cover tilts with the ground under its contact ring up to TILT_MAX (crusts, mats and domes lie on slopes); mid
 * and giant plants stay upright. What the tilt leaves (more slope, crests, terrace edges) sinks the base until the whole
 * ring meets the ground, up to SINK_MAX × its drawn height; a plant that would still float there (a cliff) is not drawn. */
const TILT_MAX = Math.tan(0.7);
const SINK_MAX: Record<FloraRole, number> = { ground: 0.35, mid: 0.15, giant: 0.15 };
/** The contact ring: a hexagon of unit offsets, and a scratch for the ground heights under it (reused per plant, so a
 * rebuild allocates nothing per plant). */
const RING_C = new Float32Array(6), RING_S = new Float32Array(6), RING_H = new Float32Array(6);
/** Gate probes' scratch (gates.ts CellProbe): cell-centre ground heights stamped per call, and a 32² rank sample. */
const CELL_Y = new Float32Array(FLORA_GRID * FLORA_GRID), CELL_AT = new Int32Array(FLORA_GRID * FLORA_GRID).fill(-1);
const RANK_N = 32, RANK_SAMPLE = new Float32Array(RANK_N * RANK_N);
let placeCall = 0;
for (let k = 0; k < 6; k++) { RING_C[k] = Math.cos((k * Math.PI) / 3); RING_S[k] = Math.sin((k * Math.PI) / 3); }

/** Per archetype index, each ÷ the archetype's native size: its contact-ring radius and its drawn height. */
export interface PlantShapes { foot: ArrayLike<number>; height: ArrayLike<number> }

/** With `shapes`, plants tilt and sink onto the drawn ground under their whole contact ring; without, they stand on it
 * at their centre. */
export function placePlants(inputs: VisualInputs, patch: number, cam: { x: number; z: number }, out: PlantList, cache?: HeightCache, clearing?: Clearing | null, shapes?: PlantShapes): PlantList {
  out.n = 0;
  const cell = patch / FLORA_GRID;
  const cells = Math.min(inputs.flora.length / 2, FLORA_GRID * FLORA_GRID);
  const sea = inputs.seaLevel;
  const H = inputs.terrain.height;
  const rise = inputs.terrain.rise;
  const cap = out.arch.length;
  const R = inputs.buildProgress < 1 ? 4 : 8;
  const gen = cache ? cache.gen++ : 0, turn = gen % R, prog = inputs.buildProgress;
  if (cache && !(Math.abs(inputs.heatSolvent - cache.hs) <= 0.01)) { cache.n.fill(0); cache.hs = inputs.heatSolvent; }
  const SEG = TERRAIN_SEGMENTS, e = patch / SEG, half = patch / 2;
  /** Height of terrain-mesh vertex (i, j). */
  const vh = (i: number, j: number): number => {
    const x = i * e - half, z = j * e - half;
    if (!cache || rise < 1e-3) return H(x, z);
    const v = j * (SEG + 1) + i, k = cache.n[v];
    if (cache.stamp[v] !== gen && (k === 0 || v % R === turn)) {
      const u = H(x, z) / rise;
      if (k && Math.abs(prog - cache.pb[v]) > 1e-4) { cache.a[v] = cache.b[v]; cache.pa[v] = cache.pb[v]; cache.n[v] = 2; }
      else if (!k) cache.n[v] = 1;
      cache.b[v] = u; cache.pb[v] = prog; cache.stamp[v] = gen;
      return u * rise;
    }
    const u = k === 2 ? cache.b[v] + ((prog - cache.pb[v]) * (cache.b[v] - cache.a[v])) / (cache.pb[v] - cache.pa[v]) : cache.b[v];
    return u * rise;
  };
  /** Drawn ground height at (x, z), on the mesh triangle under it (PlaneGeometry splits each quad along b–d). */
  const yAt = (x: number, z: number): number => {
    const fi = (x + half) / e, fj = (z + half) / e;
    const i = Math.min(SEG - 1, Math.max(0, Math.floor(fi))), j = Math.min(SEG - 1, Math.max(0, Math.floor(fj)));
    const fx = fi - i, fz = fj - j;
    if (fx + fz <= 1) {
      const ha = vh(i, j);
      return ha + fx * (vh(i + 1, j) - ha) + fz * (vh(i, j + 1) - ha);
    }
    const hc = vh(i + 1, j + 1);
    return hc + (1 - fx) * (vh(i, j + 1) - hc) + (1 - fz) * (vh(i + 1, j) - hc);
  };
  const cleared = (x: number, z: number, extra: number) =>
    !!clearing && Math.hypot(x - clearing.x, z - clearing.z) < clearing.r + extra;
  const look: PlantVary = { size: 1, teeth: 0, girth: 1, crown: 1, leanX: 0, leanZ: 0, twist: 0, droop: 0, bend: 0, r: 1, g: 1, b: 1 };
  // the world's stats once; each plant adds its cell, its spot and its cell's height rank (traits.ts)
  const tenv = traitWorld(inputs, makeEnv());
  /** `topAt` (optional): size the plant so its drawn top stands at this height (aquatic mids, by the sea surface). */
  const push = (key: string | null, x: number, z: number, h: number, yaw: number, role: FloraRole, d: number, dark: boolean, glow: number, y: number, c: number, slot: number, topAt = NaN) => {
    if (!key || out.n >= cap) return;
    const ai = ARCHETYPE_INDEX.get(key)!;
    const hr = shapes ? shapes.height[ai] : 1; // drawn height per unit h
    if (topAt === topAt) h = Math.max(0.5, (topAt - y) / Math.max(0.1, hr - 0.03)); // guard a near-flat archetype
    // this plant's own look (vary.ts): its girth widens the contact ring, and its lean adds to the slope tilt below
    plantEnv(tenv, inputs.flora[c * 2] ?? 0, inputs.flora[c * 2 + 1] ?? 0, y, sea, probe.rank(c), role);
    const v = varyPlant(ai, c, slot, dark, tenv, look);
    if (topAt !== topAt) h = Math.min(h * v.size, ROLE_BAND[role][1]); // T10 (etiolation), never past the role's band
    let tx = 0, tz = 0, sink = 0;
    const r = shapes ? shapes.foot[ai] * h * v.girth : 0;
    let ringed = false;
    if (r > 0.02) {
      // the ground under the contact ring (a hexagon), its mean slope, and the deepest drop below the drawn plane
      let sx = 0, sz = 0;
      for (let k = 0; k < 6; k++) {
        const hk = yAt(x + RING_C[k] * r, z + RING_S[k] * r);
        RING_H[k] = hk; sx += hk * RING_C[k]; sz += hk * RING_S[k];
      }
      sx /= 3 * r; sz /= 3 * r;
      ringed = true;
      if (role === 'ground') {
        const g = Math.hypot(sx, sz), k = g > TILT_MAX ? TILT_MAX / g : 1;
        tx = sx * k; tz = sz * k;
      }
    }
    tx += v.leanX; tz += v.leanZ;
    if (ringed) {
      for (let k = 0; k < 6; k++) sink = Math.max(sink, y + (tx * RING_C[k] + tz * RING_S[k]) * r - RING_H[k]);
      if (sink > SINK_MAX[role] * shapes!.height[ai] * h) return;
    }
    if (topAt === topAt) h = Math.max(0.5, (topAt - y + sink) / Math.max(0.1, hr - 0.03)); // the sunk base still tops out at topAt
    const i = out.n++;
    out.arch[i] = ai;
    out.x[i] = x; out.y[i] = y; out.z[i] = z; out.h[i] = h; out.yaw[i] = yaw;
    // Mid and giant plants always split at their LOD radius: it is also the focus cut-out's boundary. Ground cover has
    // no cut-out, so it takes the far LOD only where that is lighter (carbon; silicon's far LOD is its near one).
    out.lod[i] = d < LOD_NEAR[role] || (role === 'ground' && !ARCHETYPE_META[out.arch[i]].farLod) ? 0 : 1;
    out.dark[i] = dark ? 1 : 0;
    out.glow[i] = glow;
    out.gx[i] = tx; out.gz[i] = tz; out.sink[i] = sink;
    out.cell[i] = c; out.slot[i] = slot;
    out.wg[i] = v.girth - 1; out.wc[i] = v.crown - 1; out.wt[i] = v.twist; out.wd[i] = v.droop; out.wb[i] = v.bend;
    out.lx[i] = v.leanX; out.lz[i] = v.leanZ; out.tr[i] = v.r - NEUTRAL_TINT; out.tg[i] = v.g - NEUTRAL_TINT; out.tb[i] = v.b - NEUTRAL_TINT; out.teeth[i] = v.teeth;
  };
  // One lookup per cell: its bin (light, mix) and land form (floraForm's, for a cell above the sea). Ground cover under
  // the sea takes the cell's submerged form (seaForm), so a shore cell keeps jellyshroom domes and low crusts in the
  // water and land cover on the dry side, whichever side its centre is on.
  const forms: (FloraForm | null)[] = new Array(cells);
  const bins: (FloraBin | null)[] = new Array(cells);
  // world-wide: C2 body variants follow heatBand (pickAlong), and the T9 dense build switches on photorespiration
  const env = worldEnv(inputs), hb = inputs.heatBand;
  // gated archetypes (gates.ts): the world-wide halves once here; cells answer the rest lazily through the probe
  const gates = activeGates(env), aquatic = aquaticFor(env);
  const call = ++placeCall;
  const cellY = (c: number) => {
    if (CELL_AT[c] !== call) {
      CELL_Y[c] = yAt(patchToWorld(((c % FLORA_GRID) + 0.5) / FLORA_GRID, patch), patchToWorld((Math.floor(c / FLORA_GRID) + 0.5) / FLORA_GRID, patch));
      CELL_AT[c] = call;
    }
    return CELL_Y[c];
  };
  let ranked = false;
  const probe: CellProbe = {
    shore(c) {
      const col = c % FLORA_GRID, row = Math.floor(c / FLORA_GRID);
      let lo = Infinity, hi = -Infinity;
      for (let j = Math.max(0, row - 1); j <= Math.min(FLORA_GRID - 1, row + 1); j++) for (let i = Math.max(0, col - 1); i <= Math.min(FLORA_GRID - 1, col + 1); i++) {
        const y = cellY(j * FLORA_GRID + i);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
      return lo < sea && hi > sea;
    },
    rank(c) {
      if (!ranked) {
        const st = FLORA_GRID / RANK_N;
        for (let j = 0; j < RANK_N; j++) for (let i = 0; i < RANK_N; i++) RANK_SAMPLE[j * RANK_N + i] = cellY(j * st * FLORA_GRID + i * st);
        RANK_SAMPLE.sort();
        ranked = true;
      }
      const y = cellY(c);
      let a = 0, b = RANK_SAMPLE.length;
      while (a < b) { const m = (a + b) >> 1; if (RANK_SAMPLE[m] < y) a = m + 1; else b = m; }
      return a / RANK_SAMPLE.length;
    },
    total: (c) => (inputs.flora[c * 2] ?? 0) + (inputs.flora[c * 2 + 1] ?? 0),
  };
  /** The gated archetype for a plant at its own ground height (its base pick when no gate holds). */
  const gated = (key: string | null, role: FloraRole, c: number, y: number, h: number) =>
    key && gates[role].length ? gateKey(key, gates[role], c, y, sea, probe, h) : key;
  const seaForms: (FloraForm | undefined)[] = new Array(cells);
  const seaForm = (c: number): FloraForm => {
    let f = seaForms[c];
    if (!f) f = seaForms[c] = formForBin(Object.assign({}, bins[c], { sub: true }));
    return f;
  };
  for (let c = 0; c < cells; c++) {
    const mat = inputs.flora[c * 2] ?? 0, canopy = inputs.flora[c * 2 + 1] ?? 0;
    const b = mat + canopy > FLORA_EPS ? floraBin(mat, canopy, inputs) : null;
    bins[c] = b;
    forms[c] = b ? formForBin(b) : null;
  }
  // Giants first (fewest, most important to the silhouette), then mid groves, then ground cover, so a full list drops
  // ground cover rather than the landmarks.
  for (let pass = 0; pass < 3; pass++) {
    for (let c = 0; c < cells; c++) {
      const form = forms[c], bin = bins[c];
      if (!form || !bin) continue;
      const mat = inputs.flora[c * 2] ?? 0, canopy = inputs.flora[c * 2 + 1] ?? 0;
      const total = mat + canopy;
      const bright = bin.light === 2;
      const col = c % FLORA_GRID, row = Math.floor(c / FLORA_GRID);
      const ccx = patchToWorld((col + 0.5) / FLORA_GRID, patch), ccz = patchToWorld((row + 0.5) / FLORA_GRID, patch); // cellCentre, unallocated
      if (pass === 0) {
        // the cell with the most canopy in each superblock may hold its one giant
        if (canopy < GIANT_CANOPY || !inputs.lifeOnLand) continue;
        const sc = Math.floor(col / SUPER) * SUPER, sr = Math.floor(row / SUPER) * SUPER;
        let best = -1, bestC = -1;
        for (let j = 0; j < SUPER && sr + j < FLORA_GRID; j++) for (let i = 0; i < SUPER && sc + i < FLORA_GRID; i++) {
          const cj = (sr + j) * FLORA_GRID + sc + i, v = inputs.flora[cj * 2 + 1] ?? 0;
          if (v > bestC) { bestC = v; best = cj; }
        }
        if (best !== c) continue;
        if (hash01(c, 0, 10) > 0.3 + (bin.mix === 2 ? 0.4 : 0) + 0.6 * canopy) continue;
        const tall = formForBin(withMix(bin, 2));
        const x = ccx + (hash01(c, 0, 12) - 0.5) * cell * 0.6, z = ccz + (hash01(c, 0, 13) - 0.5) * cell * 0.6;
        if (cleared(x, z, GIANT_OVERHANG)) continue;
        const y = yAt(x, z);
        if (y < sea) continue;
        const d = Math.hypot(x - cam.x, z - cam.z);
        push(gated(pickPlant(tall, 'giant', bright, hash01(c, 0, 14), hb, hash01(c, 0, 17), env.dense), 'giant', c, y, hash01(c, 0, 18)), x, z, plantHeight('giant', tall, canopy * 2, hash01(c, 0, 15)), hash01(c, 0, 16) * 6.283, 'giant', d, false, tall.glow, y, c, 0);
      } else if (pass === 1) {
        // the aquatic mid slot (A5 kelp, A8 whisker reef): one per lush submerged cell in the grove field, inside its
        // depth window and sized to the water; before land life too (life starts in the shallows)
        if (aquatic && total >= AQUATIC_B && hash01(c, 7, 40) < smooth(AQUATIC_B, 0.9, total) * groveAt(col, row)) {
          const x = ccx + (hash01(c, 7, 41) - 0.5) * cell, z = ccz + (hash01(c, 7, 42) - 0.5) * cell;
          const d = Math.hypot(x - cam.x, z - cam.z);
          if (!cleared(x, z, 0) && hash01(c, 7, 46) < 1 - 0.7 * smooth(MID_THIN_START, MID_THIN_END, d)) {
            const y = yAt(x, z), depth = sea - y;
            const aq = depth <= aquatic.depth[1] || !aquatic.deep ? aquatic : aquatic.deep;
            if (depth >= aq.depth[0] && depth <= aq.depth[1]) push(aq.key, x, z, depth, hash01(c, 7, 45) * 6.283, 'mid', d, false, seaForm(c).glow, y, c, GROUND_SLOT - MID_SLOT, sea + aq.top);
          }
        }
        if (canopy < MID_CANOPY || !inputs.lifeOnLand) continue;
        const tall = formForBin(withMix(bin, bin.mix === 0 ? 1 : bin.mix));
        const want = smooth(MID_CANOPY, 0.45, canopy) * (0.08 + 1.3 * groveAt(col, row)) * MID_DENSITY[lushOf(form)];
        const n = Math.min(GROUND_SLOT - MID_SLOT, Math.floor(want + hash01(c, 1, 20)));
        for (let k = 0; k < n; k++) {
          const x = ccx + (hash01(c, k, 21) - 0.5) * cell, z = ccz + (hash01(c, k, 22) - 0.5) * cell;
          if (cleared(x, z, 0)) continue;
          const d = Math.hypot(x - cam.x, z - cam.z);
          // far groves thin to 30% (stable per plant): they read as masses in the haze, and it caps the budget
          if (hash01(c, k, 26) >= 1 - 0.7 * smooth(MID_THIN_START, MID_THIN_END, d)) continue;
          const y = yAt(x, z);
          if (y < sea) continue;
          push(gated(pickPlant(tall, 'mid', bright, hash01(c, k, 23), hb, hash01(c, k, 27), env.dense), 'mid', c, y, hash01(c, k, 28)), x, z, plantHeight('mid', tall, canopy * 2.5, hash01(c, k, 24)), hash01(c, k, 25) * 6.283, 'mid', d, false, tall.glow, y, c, k);
        }
      } else {
        const dc = Math.hypot(ccx - cam.x, ccz - cam.z);
        if (dc > THIN_END + cell) continue;
        const grown = 1 - Math.exp(-3 * Math.max(mat, 0.3 * total));
        const base = Math.max(1, Math.min(GROUND_PER_CELL + 1, Math.round(GROUND_PER_CELL * grown * LUSH_DENSITY[lushOf(form)])));
        const extra = dc < FOREGROUND_R + cell ? Math.round(FOREGROUND_EXTRA * grown) : 0;
        for (let k = 0; k < base + extra; k++) {
          const x = ccx + (hash01(c, k, 31) - 0.5) * cell, z = ccz + (hash01(c, k, 32) - 0.5) * cell;
          const d = Math.hypot(x - cam.x, z - cam.z);
          const fg = k >= base;
          // foreground extras fade out between 20 and 30 m; base cover thins with distance and gathers into clumps
          // (stable per-plant threshold)
          const keep = fg ? 1 - smooth(FOREGROUND_R - 10, FOREGROUND_R, d) : (1 - smooth(THIN_START, THIN_END, d)) * clumpAt(col, row);
          if (hash01(c, k, 33) >= keep) continue;
          const y = yAt(x, z);
          const under = y < sea;
          if (!under && !inputs.lifeOnLand) continue;
          const f = under ? seaForm(c) : form;
          push(gated(pickPlant(f, 'ground', bright, hash01(c, k, 34), hb, 0.5, env.dense), 'ground', c, y, hash01(c, k, 37)), x, z, plantHeight('ground', f, mat + 0.5 * canopy, hash01(c, k, 35)), hash01(c, k, 36) * 6.283, 'ground', d, fg, f.glow, y, c, fg ? k - base : k);
        }
      }
    }
  }
  return out;
}
