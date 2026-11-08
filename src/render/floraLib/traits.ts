// Condition-justified plant traits (docs/features/flora-traits.md §1, WP-A). Every drawn plant feature is the value a
// published trait–environment relationship predicts for the plant's cell and the world's live stats: environmental
// filtering drawn as an instant equilibrium (plants don't evolve in the sim). Pure: f(VisualInputs, cell, plant). The
// T-numbers, tags and sources are the design doc's; base hue stays [art] (§0.3), traits only modulate it.
//
//   shape (TRAITS, one row per rule: driver → monotone map → look parameter, applied in vary.ts)
//     T10 height     etiolation in dim light (Franklin 2008) [analogue]; cold → tall stays floraForm's heightScale [art]
//     T11 girth      elastic similarity: d ∝ √(g) and stouter when taller (McMahon 1973) [sci], carbon only
//     T5  cap size   peaks warm–wet, small when cold or hot–dry–bright (Wright et al. 2017) [sci]/[analogue], carbon
//     T4  cap size   by mineral supply: basalt × 1.1, granite × 0.85, blended by root depth (§3.3) [analogue], carbon
//     T7  droop/bend leaf mass per area (stiffness) rises with light, poor soil and CO₂ (Poorter et al. 2009), carbon
//   tint (TINTS: weight 0..1 × a multiplier, composed by product, on a 0.9 neutral so nothing exceeds 1, §7)
//     T1 anthocyanin (Chalker-Scott 1999), T2 carotenoid (Demmig-Adams & Adams 1996), T3 shade (Kiang et al. 2007),
//     T4 gley bronzing (Becker & Asch 2005), T8 pale coat (Ehleringer et al. 1976; Meinzer et al. 1985), T16 nitride
//     film colour (Henrie et al. 2004) [speculative], T17 dopant (silicide smoky, nitride pale) [speculative],
//     T18 vitality [art]
//     T6  teeth      toothed leaf margins in the cold, smooth in the warm (leaf-margin analysis, Wolfe 1979) [sci], carbon
// Not here: T14 root nodules (needs the optional luma-weighted tint), T9/T15 variants and T12/T13 archetypes (WP-B).
//
// Mineral: the world's crust map (VisualInputs.terrain.crust; place.ts takes the argmax of the crust weights at the cell
// centre, as gen/crust.ts crustMap() gives the sim, so a plant's mineral is the ground's), with each mineral's own supply
// and `oxidises`. Without crust config, the doc's height-rank proxy (§3.1): carbon basalt below rank 0.55, granite above; silicon silicide < 0.4,
// nitride < 0.8, water ice above.
import type { MineralDef, VisualInputs } from '../../worlds/types';
import type { FloraRole } from './index';

/** A crust mineral id (worlds' terrain.crust.minerals: basalt, granite, ironstone; silicide, nitride, waterIce). */
export type Mineral = string;


/** Everything a trait reads: the world's live stats, and the plant's own cell and spot. */
export interface CellEnv {
  // world-wide
  carbon: boolean;
  /** Heat band 0..1, light × Earth, temperature °C, nitrogen × Earth, oxygen %, CO₂ %, gravity g, air density
   * (VisualInputs units), the photorespiration index (O₂/CO₂) ÷ 525 (Earth today = 1). */
  heatBand: number; light: number; temperature: number; nitrogen: number; oxygen: number; co2: number;
  gravity: number; airDensity: number; photoresp: number;
  frozen: boolean; buildProgress: number;
  stats: Readonly<Record<string, number>>;
  // per cell and plant
  /** The cell's biomass, and whether the plant stands under the sea, and its base height above sea level (m). */
  mat: number; canopy: number; submerged: boolean; elevation: number;
  /** Waterlogging 0..1 (1 under the sea, falling over 0.5–4 m above it, 0 on frozen seas) (§3.1). */
  wet: number;
  /** The plant's ground height rank in the patch, 0 (lowest) .. 1 (highest). */
  rank: number;
  mineral: Mineral;
  /** Mineral supply multiplier of its ground for this world's chemistry (c on carbon, si on silicon; crust config). */
  supply: number;
  /** Its ground is iron-bearing / oxidising rock (gley on waterlogged ground). */
  oxidises: boolean;
  /** Root depth blend: how much of its ground the plant shows (ground cover 0.4, mid 0.25, giants 0.15) (§3.3, [art]). */
  depth: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const sat = (x: number) => 1 - Math.exp(-Math.max(0, x));

/** Proxy minerals' supply and oxidising (the crust configs' values), for worlds without crust config. */
const PROXY: Record<string, { supply: number; oxidises: boolean }> = {
  basalt: { supply: 1.4, oxidises: true }, granite: { supply: 0.6, oxidises: false },
  silicide: { supply: 1.6, oxidises: true }, nitride: { supply: 1.2, oxidises: false }, waterIce: { supply: 0, oxidises: false },
};
const ROOT_DEPTH: Record<FloraRole, number> = { ground: 0.4, mid: 0.25, giant: 0.15 };
/** Earth's O₂/CO₂ ratio today (21 / 0.04), the photorespiration index's unit. */
const EARTH_O2_CO2 = 525;

/** A fresh environment (fill with worldEnv, then plantEnv per plant). */
export function makeEnv(): CellEnv {
  return {
    carbon: true, heatBand: 0.5, light: 1, temperature: 15, nitrogen: 1, oxygen: 21, co2: 0.04, gravity: 1, airDensity: 0.06,
    photoresp: 1, frozen: false, buildProgress: 1, stats: {}, mat: 0, canopy: 0, submerged: false, elevation: 0, wet: 0,
    rank: 0.5, mineral: 'basalt', supply: 1.4, oxidises: true, depth: 0.4,
  };
}

/** Fill the world-wide fields from the inputs (once per placement). */
export function worldEnv(inputs: VisualInputs, env: CellEnv): CellEnv {
  const s = inputs.stats;
  env.carbon = inputs.world.composition.si <= 0.5;
  env.heatBand = inputs.heatBand; env.light = inputs.light; env.airDensity = inputs.airDensity;
  env.temperature = s.temperature ?? 15; env.nitrogen = s.nitrogen ?? 1; env.oxygen = s.oxygen ?? 0; env.co2 = s.co2 ?? 0;
  env.gravity = s.gravity ?? 1;
  env.photoresp = env.co2 > 0 ? env.oxygen / env.co2 / EARTH_O2_CO2 : 0;
  env.frozen = inputs.frozen; env.buildProgress = inputs.buildProgress; env.stats = s;
  return env;
}

/** Mineral by height rank (§3.1 proxy until session/crust's crust weights land). */
export function mineralAt(carbon: boolean, rank: number): Mineral {
  return carbon ? (rank < 0.55 ? 'basalt' : 'granite') : rank < 0.4 ? 'silicide' : rank < 0.8 ? 'nitride' : 'waterIce';
}

/** Fill the per-plant fields: its cell's biomass, its ground height `y` against `sea`, its height rank and role, and its
 * cell's crust mineral when the world has a crust map, else the height-rank proxy. */
export function plantEnv(env: CellEnv, mat: number, canopy: number, y: number, sea: number, rank: number, role: FloraRole, mineral?: Pick<MineralDef, 'id' | 'supply' | 'oxidises'> | null): CellEnv {
  env.mat = mat; env.canopy = canopy; env.submerged = y < sea; env.elevation = y - sea;
  env.wet = env.frozen ? 0 : env.submerged ? 1 : 1 - smooth(0.5, 4, env.elevation);
  env.rank = rank; env.depth = ROOT_DEPTH[role];
  const m = mineral;
  if (m) { env.mineral = m.id; env.supply = env.carbon ? m.supply.c : m.supply.si; env.oxidises = m.oxidises; }
  else { env.mineral = mineralAt(env.carbon, rank); const p = PROXY[env.mineral]; env.supply = p.supply; env.oxidises = p.oxidises; }
  return env;
}

/** Sorted ground heights of a coarse sample of the patch, for heightRank. */
export function heightSample(height: (x: number, z: number) => number, patch: number, n = 32): Float32Array {
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out[j * n + i] = height(((i + 0.5) / n - 0.5) * patch, ((j + 0.5) / n - 0.5) * patch);
  return out.sort();
}
/** Rank 0..1 of a ground height among a sorted sample (binary search). */
export function heightRank(sorted: Float32Array, y: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < y) lo = m + 1; else hi = m; }
  return sorted.length ? lo / sorted.length : 0.5;
}

// ---- shape traits ------------------------------------------------------------------------------------------------

export type TraitParam = 'size' | 'girth' | 'crown' | 'lean' | 'bend' | 'twist' | 'droop' | 'teeth';
/** One condition → look rule. */
export interface Trait {
  id: string;
  /** Why the condition shapes the plant, in one plain sentence (with its source and tag in the header). */
  why: string;
  param: TraitParam;
  /** 'mul' multiplies the parameter by map(driver), 'add' adds it. Rows apply in table order. */
  op: 'mul' | 'add';
  /** Only on this chemistry (silicon never curls, and keeps girth and crown within ±6% for the 60° rule). */
  chem?: 'carbon' | 'silicon';
  /** 'world': the same for every plant; 'cell': read from the plant's own cell or spot. */
  scope: 'world' | 'cell';
  driver: (e: CellEnv) => number;
  /** Monotone in the driver. */
  map: (x: number) => number;
}
const total = (e: CellEnv) => e.mat + e.canopy, wetBool = (e: CellEnv) => (e.submerged ? 1 : 0);
/** Poor ground 0..1 (supply below 1: granite 0.6 and ironstone 0.5 are fully poor; basalt none). */
const poor = (e: CellEnv) => clamp01((1 - e.supply) / 0.4);
/** Leaf mass per area 0..1 (T7): light, poor ground (by root depth) and high CO₂ thicken leaves. Default carbon ≈ 0.44. */
export const lma = (e: CellEnv) => 0.4 * sat(e.light) + 0.3 * poor(e) * (e.depth / 0.4) + 0.3 * smooth(0.04, 0.4, e.co2);
const LMA_DEFAULT = 0.44;

export const TRAITS: readonly Trait[] = [
  { id: 'T10etiolation', why: 'In dim light stems stretch toward it (shade avoidance).', param: 'size', op: 'mul', scope: 'world', driver: (e) => e.light, map: (x) => 1 + 0.15 * clamp01(1 - x / 0.4) },
  { id: 'T11gravity', why: 'Stronger gravity needs stouter stems to stand without buckling.', param: 'girth', op: 'mul', chem: 'carbon', scope: 'world', driver: (e) => e.gravity, map: (x) => Math.sqrt(Math.max(0.25, x)) },
  { id: 'T11tall', why: 'Taller plants need stouter stems (cold grows them tall here).', param: 'girth', op: 'mul', chem: 'carbon', scope: 'world', driver: (e) => 1.4 - 0.8 * clamp01(e.heatBand), map: (x) => Math.sqrt(x) },
  { id: 'T5cold', why: 'Cold nights keep leaves and caps small.', param: 'crown', op: 'mul', chem: 'carbon', scope: 'world', driver: (e) => 1 - smooth(0.1, 0.25, e.heatBand), map: (x) => 1 - 0.35 * x },
  { id: 'T5warmWet', why: 'Warm, wet ground grows the biggest leaves and caps.', param: 'crown', op: 'mul', chem: 'carbon', scope: 'cell', driver: (e) => smooth(0.4, 0.55, e.heatBand) * (1 - smooth(0.8, 0.95, e.heatBand)) * smooth(0.3, 0.6, e.wet), map: (x) => 1 + 0.4 * x },
  { id: 'T5hotDryBright', why: 'Hot, dry, bright ground keeps leaves small so they don\'t overheat.', param: 'crown', op: 'mul', chem: 'carbon', scope: 'cell', driver: (e) => smooth(0.8, 0.95, e.heatBand) * (1 - e.wet) * smooth(1, 1.5, e.light), map: (x) => 1 - 0.3 * x },
  { id: 'T4supply', why: 'Fertile ground (basalt) grows bigger caps than poor ground (granite, ironstone).', param: 'crown', op: 'mul', chem: 'carbon', scope: 'cell', driver: (e) => (e.supply - 1) * e.depth, map: (x) => 1 + (x >= 0 ? 0.375 : 0.5) * x },
  { id: 'T7stiffDroop', why: 'Thick, stiff leaves (bright light, poor ground, high CO₂) hold their caps up; thin ones droop.', param: 'droop', op: 'mul', chem: 'carbon', scope: 'cell', driver: lma, map: (x) => Math.max(0.2, 1 + 1.2 * (LMA_DEFAULT - x)) },
  { id: 'T7stiffBend', why: 'Thick, stiff leaves bend less.', param: 'bend', op: 'mul', chem: 'carbon', scope: 'cell', driver: lma, map: (x) => Math.max(0.3, 1 + 0.8 * (LMA_DEFAULT - x)) },
  // T6 leaf-margin analysis: the share of smooth-margined species = (T − 1.14) / 0.306 % (Wing & Greenwood 1993;
  // Wolfe 1979; Wilf 1997; coefficients [unverified]), so ~45% smooth at 15 °C, all toothed ≤ 1 °C, all smooth ≥ 32 °C.
  // 'teeth' is the chance a plant is toothed; vary.ts draws it per plant from the seeded hash. [sci]
  { id: 'T6margin', why: 'Cold climates grow more toothed leaf margins, warm ones smooth (leaf-margin analysis).', param: 'teeth', op: 'mul', chem: 'carbon', scope: 'world', driver: (e) => e.temperature, map: (x) => 1 - clamp01((x - 1.14) / 30.6) },
  { id: 'denseStraight', why: 'Plants in dense cells hold each other up, so they stand straighter.', param: 'lean', op: 'mul', scope: 'cell', driver: total, map: (x) => 1.15 - 0.3 * clamp01(x / 1.5) },
  { id: 'waterHolds', why: 'Water buoys submerged plants upright.', param: 'lean', op: 'mul', scope: 'cell', driver: wetBool, map: (x) => 1 - 0.3 * x },
  { id: 'waterBendsLess', why: 'Water buoys submerged stems, so they bend less.', param: 'bend', op: 'mul', chem: 'carbon', scope: 'cell', driver: wetBool, map: (x) => 1 - 0.5 * x },
  { id: 'waterDroopsLess', why: 'Water buoys submerged caps, so they droop less.', param: 'droop', op: 'mul', chem: 'carbon', scope: 'cell', driver: wetBool, map: (x) => 1 - 0.5 * x },
];

/** The rows of TRAITS by chemistry and parameter (filtered once, not per plant). */
const ROWS = Object.fromEntries((['carbon', 'silicon'] as const).map((chem) => [chem, Object.fromEntries(
  (['size', 'girth', 'crown', 'lean', 'bend', 'twist', 'droop', 'teeth'] as const).map((p) => [p, TRAITS.filter((t) => t.param === p && (!t.chem || t.chem === chem))]),
)])) as Record<'carbon' | 'silicon', Record<TraitParam, Trait[]>>;
/** Apply every shape row for a chemistry to a parameter's base value. */
export function traited(param: TraitParam, chem: 'carbon' | 'silicon', env: CellEnv, base: number): number {
  let v = base;
  for (const t of ROWS[chem][param]) {
    const m = t.map(t.driver(env));
    v = t.op === 'mul' ? v * m : v + m;
  }
  return v;
}

// ---- tint traits -------------------------------------------------------------------------------------------------

export type Rgb = [number, number, number];
/** One condition → colour rule: at weight w the plant's tint is multiplied by lerp(1, mul, w). */
export interface TintTrait {
  id: string;
  why: string;
  chem?: 'carbon' | 'silicon';
  scope: 'world' | 'cell';
  /** 0..1, monotone in its condition. */
  weight: (e: CellEnv) => number;
  /** The multiplier at full weight (linear rgb, relative to the neutral tint). */
  mul: (e: CellEnv) => Readonly<Rgb>;
}
const CRIMSON: Rgb = [1, 0.55, 0.62], APRICOT: Rgb = [1, 0.86, 0.62], SHADE: Rgb = [0.75, 0.75, 0.75], BRONZE: Rgb = [1, 0.82, 0.6];
// Silicon's tissues include an ice-blue (blush ≈ 205°) beside the cyan accent band (165–200°), so its multipliers never
// lift green over red: they lower green with red (toward blue/violet) or lift red (toward grey), never toward cyan.
const COAT: Rgb = [1.1, 1.11, 1.11], SMOKY: Rgb = [0.8, 0.76, 0.8], CLEAR: Rgb = [1.1, 1.1, 1.1];
const GREY_C: Rgb = [0.85, 1.04, 1.04], GREY_SI: Rgb = [1.05, 0.98, 0.93];
const FILM: Rgb[] = [[0.95, 0.82, 1], [0.86, 0.82, 1], [1.05, 1.04, 1.07]]; // violet → blue → silver-ice (hue 230–300°)
const lerp3 = (a: Readonly<Rgb>, b: Readonly<Rgb>, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const same = (c: Readonly<Rgb>) => () => c;

export const TINTS: readonly TintTrait[] = [
  { id: 'T1anthocyanin', why: 'Cold, strong light, too little nitrogen, poor ground or drought flush pale tops toward crimson.', chem: 'carbon', scope: 'cell',
    weight: (e) => 0.5 * clamp01(Math.max(1 - smooth(0.15, 0.3, e.heatBand), smooth(1.5, 2.5, e.light), 1 - smooth(0.3, 0.5, e.nitrogen),
      smooth(0.6, 0.8, e.rank) * smooth(0.6, 0.8, e.heatBand)) + 0.3 * poor(e) * (e.depth / 0.4)), mul: same(CRIMSON) },
  { id: 'T2carotenoid', why: 'Very bright light raises protective carotenoids: tops warm toward apricot.', chem: 'carbon', scope: 'world', weight: (e) => 0.35 * smooth(1, 3, e.light), mul: same(APRICOT) },
  { id: 'T3shade', why: 'Under a dim star, tissue packs more pigment and reads darker.', scope: 'world', weight: (e) => clamp01(1 - e.light / 0.4), mul: same(SHADE) },
  { id: 'T4gley', why: 'Waterlogged iron-bearing ground releases iron that bronzes the tips.', chem: 'carbon', scope: 'cell', weight: (e) => 0.5 * e.wet * (e.oxidises ? 1 : 0) * (e.depth / 0.4), mul: same(BRONZE) },
  { id: 'T8paleCoat', why: 'Hairs or wax pale the tops in hot, dry, bright spots and on cold, bright heights.', chem: 'carbon', scope: 'cell',
    weight: (e) => Math.max(smooth(0.6, 0.8, e.heatBand) * (1 - smooth(0.1, 0.3, e.wet)) * smooth(1, 1.5, e.light),
      (1 - smooth(0.2, 0.3, e.heatBand)) * smooth(0.6, 0.8, e.rank) * smooth(1, 1.5, e.light)), mul: same(COAT) },
  { id: 'T16film', why: 'Thickening nitride films shift their interference colour from violet through blue to silver.', chem: 'silicon', scope: 'cell',
    weight: () => 1, mul: (e) => { const t = clamp01((e.mat + e.canopy) * (0.4 + 0.6 * e.buildProgress)); return t < 0.5 ? lerp3(FILM[0], FILM[1], t * 2) : lerp3(FILM[1], FILM[2], t * 2 - 1); } },
  { id: 'T17silicide', why: 'Metal-rich silicide ground grows smoky, darker crystals.', chem: 'silicon', scope: 'cell', weight: (e) => (e.mineral === 'silicide' ? e.depth / 0.4 : 0), mul: same(SMOKY) },
  { id: 'T17nitride', why: 'Pure nitride ground grows clear, pale crystals.', chem: 'silicon', scope: 'cell', weight: (e) => (e.mineral === 'nitride' ? e.depth / 0.4 : 0), mul: same(CLEAR) },
  { id: 'T18vitality', why: 'Sparse, starved cells lose colour; lush ones show it in full.', scope: 'cell', weight: (e) => 1 - clamp01((e.mat + e.canopy) / 0.9), mul: (e) => (e.carbon ? GREY_C : GREY_SI) },
];

/** The darkest the conditions may tint a plant, per channel. */
export const TINT_FLOOR = 0.6;
/** The tint the plant's conditions give it (multiplier on the neutral tint; product of every row). */
export function traitTint(chem: 'carbon' | 'silicon', env: CellEnv, out: Rgb = [1, 1, 1]): Rgb {
  out[0] = 1; out[1] = 1; out[2] = 1;
  for (const t of TINTS) {
    if (t.chem && t.chem !== chem) continue;
    const w = t.weight(env);
    if (!(w > 0)) continue;
    const m = t.mul(env);
    for (let k = 0; k < 3; k++) out[k] *= 1 + (m[k] - 1) * w;
  }
  // stacked darkening (shade × smoky × film on dim silicon) stops at TINT_FLOOR, so a plant reads as a form, never a black blob
  for (let k = 0; k < 3; k++) out[k] = Math.max(TINT_FLOOR, out[k]);
  return out;
}
