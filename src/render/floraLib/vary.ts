// Per-plant variation (owner ruling 2026-11-08: no two plants look like copies). Every placed plant gets its own
// proportions, crown, lean, curl and colour, the way a creature comes from its genes: a pure function of its archetype,
// its cell's conditions (biomass, submerged; world light and heat band) and a seeded hash of (cell, slot). Nothing
// per frame: place.ts calls it once per plant per rebuild, so a plant keeps its look while its cell holds.
//
// What varies, and where it is drawn (floraLib/instance.ts):
//   girth  xz ÷ y scale of the instance matrix          crown  radius factor at the top, ramping in as (y/H)²
//   lean   tilt of the instance, on top of the slope     bend   tip offset toward the plant's own +X, as (y/H)²
//   twist  turn about the stem, ∝ y/H                   droop  rim drop (> 0) or splay (< 0), ∝ (r/R)²(y/H)²
//   tint   rgb multiplier inside the palette band: value × a warm/cool shift
// Crown, twist, droop and bend bend the geometry in the plant's own frame, before instancing (material.ts plantAttr),
// so the far LOD and the focus cut-out see the same plant. Girth and lean are in the instance matrix, tint is instanceColor.
//
// Chemistry (CLAUDE.md "Plant form"): silicon stays straight, faceted and 60°-branched, so it never bends, twists or
// droops, and its girth and crown stay within ±6%: a branch built at 60° is drawn between 57° and 63°. Carbon gets all.
//
// Conditions shape the look through TRAITS: one row per rule, a driver read from the plant's cell or world, a monotone
// mapping and the parameter it moves. A new trait is a new row. Rows driven by the cell (biomass, sea, elevation) may
// move only the free parameters (lean, bend, twist, droop): girth and crown carry the levels that keep neighbours
// apart, so they take world-wide drivers only (tested).
//
// No two neighbours alike. Each plant's girth, crown, value and hue LEVELS come from a code that is distinct for every
// plant of the same role and value step within any 3 × 3 block of cells: the cell's class (col mod 3, row mod 3) × its
// slot, scrambled by a fixed permutation so no stripes form. Adjacent levels sit ≥ 2.4 JND apart and jitter by at most
// ±0.2 of a step, so two such plants differ by > 1 JND (VARY_JND) in at least one of them. Lean, bend, twist and droop
// are free per-plant noise on top, biased by the cell's conditions. (One JND ≈ one internal pixel at the role's usual
// viewing distance in the 360 px pixel look, or a just-visible colour step between two flat patches.)
import { FLORA_GRID, hash01 } from '../layout';
import { ARCHETYPE_KEYS, ARCHETYPE_META, NEUTRAL_TINT, type FloraRole } from './index';
import { traitTint, traited, type CellEnv, type Rgb } from './traits';

/** What a plant's look reads: its cell and world (traits.ts). */
export type TraitContext = CellEnv;
export { TRAITS, TINTS } from './traits';
export { NEUTRAL_TINT };

export interface PlantVary {
  /** Size multiplier from the conditions (T10); place.ts keeps full-grown plants in their role band. */
  size: number;
  /** 1: its cap and fan rims are toothed (T6), 0: smooth. */
  teeth: number;
  /** Instance xz ÷ y scale (1: native proportions). */
  girth: number;
  /** Crown radius factor at the plant's top (1: native). */
  crown: number;
  /** Lean as a slope (dy/dx, dy/dz) the up axis follows, like place.ts gx/gz: tan(angle) toward −(x, z). */
  leanX: number; leanZ: number;
  /** Radians of turn about the stem at the top (carbon). */
  twist: number;
  /** Rim drop as a share of the plant's height: > 0 droops, < 0 splays (carbon). */
  droop: number;
  /** Tip offset as a share of the height, toward the plant's own +X (turned by its yaw) (carbon). */
  bend: number;
  /** Instance colour (linear rgb multiplier). */
  r: number; g: number; b: number;
}

/** One just-noticeable difference per parameter (see the header): relative size, girth and crown, rgb tint distance,
 * lean as a slope (1°), and bend and droop as shares of the height. */
export const VARY_JND = { size: 0.04, girth: 0.02, crown: 0.025, tint: 0.025, lean: Math.tan(Math.PI / 180), bend: 0.02, droop: 0.02 } as const;

/** Level grids: steps between adjacent levels; each level jitters by ±JITTER of its step. */
const JITTER = 0.2;
interface Grid { girth: [number, number]; crown: [number, number]; value: [number, number]; hue: [number, number] }
/** [levels, step]. Carbon: girth 0.85–1.15, crown 0.8–1.2. Silicon: girth 0.95–1.05, crown 0.94–1.06 (keeps 60°). */
const GRID: Record<'carbon' | 'silicon', Grid> = {
  carbon: { girth: [4, 0.09], crown: [4, 0.12], value: [4, 0.06], hue: [3, 0.045] },
  silicon: { girth: [3, 0.044], crown: [3, 0.05], value: [4, 0.06], hue: [3, 0.045] },
};
const SPACE = { carbon: 4 * 4 * 4 * 3, silicon: 3 * 3 * 4 * 3 };
/** Slots per cell that must differ, by role (ground: base cover; its darker foreground extras count apart). */
export const VARY_SLOTS: Record<FloraRole | 'groundDark', number> = { giant: 1, mid: 3, ground: 6, groundDark: 8 };

/** A fixed scramble of each code space (Fisher–Yates on a seeded hash), so level combinations don't line up in rows. */
const PERM = { carbon: perm(SPACE.carbon, 11), silicon: perm(SPACE.silicon, 13) };
function perm(n: number, seed: number): Uint16Array {
  const p = Uint16Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hash01(i, seed, 991) * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  return p;
}

/** Lean scale by archetype: flat crusts, bells and domes lie on the ground (their tilt is the slope's). */
const LEAN_SCALE: Record<string, number> = { 'crystalGround#1': 0.3, 'crystalGround#3': 0.5, 'jellyDome#0': 0.4, 'jellyDome#1': 0.4, 'groundCover#0': 0.6 };
/** Lean range in degrees by role (sparse cells lean most; dense ones hold each other up). */
const LEAN_DEG: Record<FloraRole, [number, number]> = { ground: [1, 8], mid: [1, 7], giant: [0.5, 5] };
const ROLE_INDEX: Record<FloraRole, number> = { ground: 0, mid: 1, giant: 2 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const TINT: Rgb = [1, 1, 1];
/** A plant's seeded noise 0..1 for one of its dimensions (module scope: no closure per plant per rebuild). */
const noise = (cell: number, slot: number, salt: number, dim: number) => hash01(cell, slot * 16 + dim, salt);
/** A plant's seeded sign ±1 for one of its dimensions. */
const signOf = (cell: number, slot: number, salt: number, dim: number) => (noise(cell, slot, salt, dim) < 0.5 ? -1 : 1);
/** Level value: (level − centre) × step, jittered by ±JITTER step. */
const level = (lvl: number, n: number, step: number, u: number) => (lvl - (n - 1) / 2 + (u - 0.5) * 2 * JITTER) * step;

/**
 * The look of one plant. `arch`: archetype index; `cell`, `slot`: where place.ts put it (slot counts within the cell's
 * role, and for the darker foreground extras from 0 again); `ctx`: its cell and world (TRAITS read it). Pure and
 * deterministic; writes into `out` when given.
 */
export function varyPlant(
  arch: number, cell: number, slot: number, dark: boolean, ctx: TraitContext,
  out: PlantVary = { size: 1, teeth: 0, girth: 1, crown: 1, leanX: 0, leanZ: 0, twist: 0, droop: 0, bend: 0, r: 1, g: 1, b: 1 },
): PlantVary {
  const meta = ARCHETYPE_META[arch];
  const chem = meta.chem, role = meta.role, G = GRID[chem];
  const roleI = ROLE_INDEX[role];
  const salt = 4242 + roleI * 2 + (dark ? 1 : 0); // per-plant noise: noise(cell, slot, salt, dim)

  // the level code: distinct per role and value step within any 3 × 3 block of cells
  const col = cell % FLORA_GRID, row = Math.floor(cell / FLORA_GRID);
  const S = role === 'ground' && dark ? VARY_SLOTS.groundDark : VARY_SLOTS[role];
  const q = ((col % 3) + 3 * (row % 3)) * S + (slot % S);
  let code = PERM[chem][(q + 37 * roleI + 71 * (dark ? 1 : 0)) % SPACE[chem]];
  const gl = code % G.girth[0]; code = Math.floor(code / G.girth[0]);
  const cl = code % G.crown[0]; code = Math.floor(code / G.crown[0]);
  const vl = code % G.value[0]; code = Math.floor(code / G.value[0]);
  const hl = code % G.hue[0];

  const carbon = chem === 'carbon';
  // the levels, then the traits (world-wide only on these two, so the levels keep their spacing between neighbours)
  out.girth = traited('girth', chem, ctx, 1 + level(gl, G.girth[0], G.girth[1], noise(cell, slot, salt, 0)));
  out.crown = traited('crown', chem, ctx, 1 + level(cl, G.crown[0], G.crown[1], noise(cell, slot, salt, 1)));
  const v = 1 + level(vl, G.value[0], G.value[1], noise(cell, slot, salt, 2));
  const h = level(hl, G.hue[0], G.hue[1], noise(cell, slot, salt, 3));
  // the tint: neutral × these levels × what the plant's conditions give it (traits.ts TINTS), never above 1
  const c = traitTint(chem, ctx, TINT);
  out.r = Math.min(1, NEUTRAL_TINT * v * (1 + h) * c[0]);
  out.g = Math.min(1, NEUTRAL_TINT * v * c[1]);
  out.b = Math.min(1, NEUTRAL_TINT * v * (1 - h) * c[2]);
  out.size = traited('size', chem, ctx, 1);
  out.teeth = noise(cell, slot, salt, 11) < traited('teeth', chem, ctx, carbon ? 1 : 0) ? 1 : 0;

  // free per-plant noise, shaped by the traits of the plant's own cell and world
  const [lo, hi] = LEAN_DEG[role];
  const deg = traited('lean', chem, ctx, (lo + (hi - lo) * noise(cell, slot, salt, 4)) * (LEAN_SCALE[ARCHETYPE_KEYS[arch]] ?? 1));
  const t = Math.tan((deg * Math.PI) / 180), az = noise(cell, slot, salt, 5) * Math.PI * 2;
  out.leanX = -t * Math.cos(az); out.leanZ = -t * Math.sin(az);
  if (!carbon) { out.twist = 0; out.droop = 0; out.bend = 0; return out; }
  // carbon curls: stems bend and twist, caps droop or splay
  out.bend = signOf(cell, slot, salt, 6) * traited('bend', chem, ctx, 0.02 + 0.1 * noise(cell, slot, salt, 7));
  out.twist = signOf(cell, slot, salt, 8) * traited('twist', chem, ctx, role === 'giant' ? 0.05 + 0.35 * noise(cell, slot, salt, 9) : 0.1 + 0.6 * noise(cell, slot, salt, 9));
  out.droop = traited('droop', chem, ctx, 0.12 * noise(cell, slot, salt, 10));
  return out;
}

/**
 * Distance between two plants' looks in JNDs (≥ 1: they can be told apart). `ha`, `hb`: their heights; `yawA`, `yawB`
 * turn each one's bend into the world. Twist is left out: it does not show on plants that are round about their stem.
 */
export function varyDistance(a: PlantVary, b: PlantVary, ha: number, hb: number, yawA: number, yawB: number): number {
  const J = VARY_JND;
  const size = Math.abs(ha - hb) / Math.max(1e-6, 0.5 * (ha + hb)) / J.size;
  const tint = Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) / J.tint;
  const lean = Math.hypot(a.leanX - b.leanX, a.leanZ - b.leanZ) / J.lean;
  const bend = Math.hypot(a.bend * Math.cos(yawA) - b.bend * Math.cos(yawB), a.bend * Math.sin(yawA) - b.bend * Math.sin(yawB)) / J.bend;
  return Math.hypot(size, (a.girth - b.girth) / J.girth, (a.crown - b.crown) / J.crown, tint, lean, bend, (a.droop - b.droop) / J.droop);
}
