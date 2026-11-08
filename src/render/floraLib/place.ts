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
import type { VisualInputs } from '../../worlds/types';
import { FLORA_EPS, FLORA_GRID, cellCentre, hash01 } from '../layout';
import { floraBin, floraForm, formForBin, type FloraBin, type FloraForm } from '../floraForm';
import { ARCHETYPE_INDEX, ARCHETYPE_META, pickArchetype, plantHeight, type FloraRole } from './index';

export const MAX_PLANTS = 16000;
/** Base ground-cover plants per fully grown cell, and the extra dark ones in the foreground. */
const GROUND_PER_CELL = 5, FOREGROUND_EXTRA = 8; // base (≤ 6) + extra ≤ 14 = SLOTS − GROUND_SLOT
const FOREGROUND_R = 30;
/** Ground cover thins from THIN_START to none at THIN_END metres from the camera (sub-pixel at our resolution). */
const THIN_START = 45, THIN_END = 150;
/** Giants: at most one per SUPER × SUPER cells (~31 m). */
const SUPER = 5;
/** Canopy biomass needed for a giant / a mid plant in a cell. */
const GIANT_CANOPY = 0.2, MID_CANOPY = 0.04;
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
}

export function makePlantList(cap = MAX_PLANTS): PlantList {
  return {
    n: 0, arch: new Int16Array(cap), x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap),
    h: new Float32Array(cap), yaw: new Float32Array(cap), lod: new Uint8Array(cap), dark: new Uint8Array(cap), glow: new Float32Array(cap),
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

/**
 * Optional ground-height cache for placePlants. The terrain is `rise × h(x, z)`, and h drifts only slowly (landform
 * progress), so each plant slot keeps h and is re-sampled round-robin: 1/4 of slots per rebuild during the build,
 * 1/8 after it. Cuts ~10k terrain samples per rebuild to ~1–2k. Reset it when the world or patch changes.
 */
export interface HeightCache { unit: Float32Array; ok: Uint8Array; gen: number }
/** Density by FloraForm.lush (biomass magnitude): sparse, normal, lush. Absent (older floraForm) counts as normal. */
const LUSH_DENSITY = [0.7, 1, 1.2] as const;
/** Mid groves thin in sparse cells but never thicken past normal: mids are the costliest plants, and the worst case
 * (canopy over the whole patch, every cell lush) must hold the mid budget. Lush thickens ground cover only. */
const MID_DENSITY = LUSH_DENSITY.map((d) => Math.min(1, d));
const lushOf = (f: FloraForm): 0 | 1 | 2 => (f as { lush?: 0 | 1 | 2 }).lush ?? 1;
/** The cell's bin with another mix: keeps every per-cell field the bin carries (submerged, lush on newer floraForm). */
const withMix = (b: FloraBin, mix: 0 | 1 | 2): FloraBin => Object.assign({}, b, { mix });

/** Plant slots per cell: 1 giant, 3 mid, the rest ground cover. */
const SLOTS = 18, MID_SLOT = 1, GROUND_SLOT = 4;
export function makeHeightCache(): HeightCache {
  return { unit: new Float32Array(FLORA_GRID * FLORA_GRID * SLOTS), ok: new Uint8Array(FLORA_GRID * FLORA_GRID * SLOTS), gen: 0 };
}
export function resetHeightCache(c: HeightCache) { c.ok.fill(0); c.gen = 0; }

/**
 * Fill `out` with every plant to draw. Deterministic: the same inputs, patch and camera give the same list (with a
 * cache, ground heights may lag the terrain by up to a few rebuilds while it is still rising).
 * `cam` is the camera's ground position (x, z). `clearing` (the spawn point) keeps a disc free of mid and giant plants
 * (ground cover only), so the spawn frame opens onto groves and giants in the middle distance.
 */
export interface Clearing { x: number; z: number; r: number }

/** Extra clearance for giants beyond the clearing radius: their caps overhang (m). */
const GIANT_OVERHANG = 12;

export function placePlants(inputs: VisualInputs, patch: number, cam: { x: number; z: number }, out: PlantList, cache?: HeightCache, clearing?: Clearing | null): PlantList {
  out.n = 0;
  const cell = patch / FLORA_GRID;
  const cells = Math.min(inputs.flora.length / 2, FLORA_GRID * FLORA_GRID);
  const sea = inputs.seaLevel;
  const H = inputs.terrain.height;
  const rise = inputs.terrain.rise;
  const cap = out.arch.length;
  const R = inputs.buildProgress < 1 ? 4 : 8;
  const turn = cache ? cache.gen++ % R : 0;
  const yAt = (slot: number, x: number, z: number) => {
    if (!cache || rise < 1e-3) return H(x, z);
    if (cache.ok[slot] && slot % R !== turn) return cache.unit[slot] * rise;
    const y = H(x, z);
    cache.unit[slot] = y / rise; cache.ok[slot] = 1;
    return y;
  };
  const cleared = (x: number, z: number, extra: number) =>
    !!clearing && Math.hypot(x - clearing.x, z - clearing.z) < clearing.r + extra;
  const push = (key: string | null, x: number, z: number, h: number, yaw: number, role: FloraRole, d: number, dark: boolean, glow: number, y: number) => {
    if (!key || out.n >= cap) return;
    const i = out.n++;
    out.arch[i] = ARCHETYPE_INDEX.get(key)!;
    out.x[i] = x; out.y[i] = y; out.z[i] = z; out.h[i] = h; out.yaw[i] = yaw;
    // Mid and giant plants always split at their LOD radius: it is also the focus cut-out's boundary. Ground cover has
    // no cut-out, so it takes the far LOD only where that is lighter (carbon; silicon's far LOD is its near one).
    out.lod[i] = d < LOD_NEAR[role] || (role === 'ground' && !ARCHETYPE_META[out.arch[i]].farLod) ? 0 : 1;
    out.dark[i] = dark ? 1 : 0;
    out.glow[i] = glow;
  };
  // One lookup per cell: its form (ground cover) and bin (light, mix) for the tall forms.
  const forms: (FloraForm | null)[] = new Array(cells);
  const bins: (FloraBin | null)[] = new Array(cells);
  for (let c = 0; c < cells; c++) {
    const mat = inputs.flora[c * 2] ?? 0, canopy = inputs.flora[c * 2 + 1] ?? 0;
    const f = mat + canopy > FLORA_EPS ? floraForm(c, inputs) : null;
    forms[c] = f;
    bins[c] = f ? floraBin(mat, canopy, inputs) : null;
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
      const cc = cellCentre(c, patch);
      const col = c % FLORA_GRID, row = Math.floor(c / FLORA_GRID);
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
        const x = cc.x + (hash01(c, 0, 12) - 0.5) * cell * 0.6, z = cc.z + (hash01(c, 0, 13) - 0.5) * cell * 0.6;
        if (cleared(x, z, GIANT_OVERHANG)) continue;
        const y = yAt(c * SLOTS, x, z);
        if (y < sea) continue;
        const d = Math.hypot(x - cam.x, z - cam.z);
        push(pickArchetype(tall, 'giant', bright, hash01(c, 0, 14)), x, z, plantHeight('giant', tall, canopy * 2, hash01(c, 0, 15)), hash01(c, 0, 16) * 6.283, 'giant', d, false, tall.glow, y);
      } else if (pass === 1) {
        if (canopy < MID_CANOPY || !inputs.lifeOnLand) continue;
        const tall = formForBin(withMix(bin, bin.mix === 0 ? 1 : bin.mix));
        const want = smooth(MID_CANOPY, 0.45, canopy) * (0.08 + 1.3 * groveAt(col, row)) * MID_DENSITY[lushOf(form)];
        const n = Math.min(GROUND_SLOT - MID_SLOT, Math.floor(want + hash01(c, 1, 20)));
        for (let k = 0; k < n; k++) {
          const x = cc.x + (hash01(c, k, 21) - 0.5) * cell, z = cc.z + (hash01(c, k, 22) - 0.5) * cell;
          if (cleared(x, z, 0)) continue;
          const d = Math.hypot(x - cam.x, z - cam.z);
          // far groves thin to 30% (stable per plant): they read as masses in the haze, and it caps the budget
          if (hash01(c, k, 26) >= 1 - 0.7 * smooth(MID_THIN_START, MID_THIN_END, d)) continue;
          const y = yAt(c * SLOTS + MID_SLOT + k, x, z);
          if (y < sea) continue;
          push(pickArchetype(tall, 'mid', bright, hash01(c, k, 23)), x, z, plantHeight('mid', tall, canopy * 2.5, hash01(c, k, 24)), hash01(c, k, 25) * 6.283, 'mid', d, false, tall.glow, y);
        }
      } else {
        const dc = Math.hypot(cc.x - cam.x, cc.z - cam.z);
        if (dc > THIN_END + cell) continue;
        const grown = 1 - Math.exp(-3 * Math.max(mat, 0.3 * total));
        const base = Math.max(1, Math.min(GROUND_PER_CELL + 1, Math.round(GROUND_PER_CELL * grown * LUSH_DENSITY[lushOf(form)])));
        const extra = dc < FOREGROUND_R + cell ? Math.round(FOREGROUND_EXTRA * grown) : 0;
        for (let k = 0; k < base + extra; k++) {
          const x = cc.x + (hash01(c, k, 31) - 0.5) * cell, z = cc.z + (hash01(c, k, 32) - 0.5) * cell;
          const d = Math.hypot(x - cam.x, z - cam.z);
          const fg = k >= base;
          // foreground extras fade out between 20 and 30 m; base cover thins with distance and gathers into clumps
          // (stable per-plant threshold)
          const keep = fg ? 1 - smooth(FOREGROUND_R - 10, FOREGROUND_R, d) : (1 - smooth(THIN_START, THIN_END, d)) * clumpAt(col, row);
          if (hash01(c, k, 33) >= keep) continue;
          const y = yAt(c * SLOTS + GROUND_SLOT + k, x, z);
          if (y >= sea && !inputs.lifeOnLand) continue;
          push(pickArchetype(form, 'ground', bright, hash01(c, k, 34)), x, z, plantHeight('ground', form, mat + 0.5 * canopy, hash01(c, k, 35)), hash01(c, k, 36) * 6.283, 'ground', d, fg, form.glow, y);
        }
      }
    }
  }
  return out;
}
