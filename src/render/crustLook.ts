// Crust look (docs/features/crust.md "The look"): ground colour per mineral, the rust ratchet, and the carbon flora
// pigment blend (purple → green). Pure; the art layer feeds it the oxygen stat and reads colours back. Decoration only.
import type { FloraPalette } from './floraLib';
import type { VisualInputs } from '../worlds/types';
import { hexToLab, labToHex, labMix, mixHex, type RockLook } from './palette';

/** [fresh, rusted] ground colour per mineral id; minerals that don't oxidise have the same colour twice. */
export const MINERAL_COLOURS: Record<string, readonly [number, number]> = {
  basalt: [0x2a3330, 0x6a2c22],     // charcoal, green-black → oxidised brown-red
  ironstone: [0xa8122a, 0xe8331f],  // red jasper → the Red World red (the ground shader draws the full Red World ramp, see RED_WORLD_GROUND_IDS)
  granite: [0xc8b4b0, 0xc8b4b0],    // pale pink-grey
  silicide: [0x3a3e4c, 0x9a9488],   // dark metallic → pale silica
  nitride: [0xf0e6cc, 0xf0e6cc],    // pale cream
  waterIce: [0xdcecf8, 0xdcecf8],   // white-blue
  reducedLava: [0x30363e, 0xb8bcc2], // dark slate (metallic flecks are a look detail) → pale grey silica
};
/** Ironstone's hematite band colour (mixed in by height, subtly): maroon, in the red family. */
export const BAND_DARK = 0x5c0a1e;
/** Minerals whose ground is drawn with the fixed Red World ramp (LOOK_PALETTES.carbon), not a flat colour. */
export const RED_WORLD_GROUND_IDS: readonly string[] = ['ironstone'];
export type RampRole = 'redLight' | 'red' | 'crimson' | 'maroon';
/** The Red World ramp's colours at a rust level: rust 1 is the mockup palette; fresh is darker and less saturated (jasper). */
export function redWorldRamp(rustLevel: number): Record<RampRole, number> {
  const t = Math.min(1, Math.max(0, rustLevel)), P = LOOK_PALETTES.carbon;
  const fresh = (hex: number): number => {
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255, y = 0.3 * r + 0.5 * g + 0.2 * b;
    const f = (v: number) => Math.round((v + (y - v) * 0.3) * 0.68);
    return (f(r) << 16) | (f(g) << 8) | f(b);
  };
  const at = (hex: number) => mixHex(fresh(hex), hex, t);
  return { redLight: at(P.redLight), red: at(P.red), crimson: at(P.crimson), maroon: at(P.maroon) };
}
const FALLBACK = 0x6a6a6a;

/** Ground colour of a mineral at a rust level 0..1 (non-oxidising minerals ignore it). */
export function mineralColour(id: string, rustLevel: number): number {
  const c = MINERAL_COLOURS[id];
  if (!c) return FALLBACK;
  return mixHex(c[0], c[1], Math.min(1, Math.max(0, rustLevel)));
}

/** Highest oxygen seen this run, as a rust level. Rock doesn't un-rust; a new world resets it. */
export class RustRatchet {
  private worldId = '';
  private maxO2 = 0;
  private lastProgress = 0;
  /** Feed the oxygen stat (%); returns rust(max seen). */
  /** `buildProgress` (optional): a drop in it means a new run of the same world started, so the ratchet resets. */
  update(world: { id: string; rustOxygen?: number }, oxygenPct: number, buildProgress?: number): number {
    const newRun = buildProgress !== undefined && buildProgress < this.lastProgress - 0.5;
    if (buildProgress !== undefined) this.lastProgress = buildProgress;
    if (newRun || world.id !== this.worldId) { this.worldId = world.id; this.maxO2 = 0; }
    if (Number.isFinite(oxygenPct) && oxygenPct > this.maxO2) this.maxO2 = oxygenPct;
    return world.rustOxygen ? Math.min(1, Math.max(0, this.maxO2 / world.rustOxygen)) : 0;   // same form as gen/crust rust()
  }
  reset() { this.worldId = ''; this.maxO2 = 0; this.lastProgress = 0; }
}
/** The run's shared ratchet (flora and ground both read it). */
export const crustRatchet = new RustRatchet();

// Carbon flora pigment: early life on retinal purple, then chlorophyll green once oxygenic photosynthesis takes over.
const PURPLE = { maroon: 0x3a1450, crimson: 0x6a2a96, blush: 0xb48ad8 } as const;
const GREEN = { maroon: 0x123a20, crimson: 0x2e8a3c, blush: 0xa8dc88 } as const;
const STEPS = 8;
const cache = new Map<string, FloraPalette>();

/** Carbon flora palette at ratchet `r` (0 purple … 1 green-end `tint`, default chlorophyll green). Silicon passes through unless a crust `tint` is given. Cached per step. */
export function floraPigment(base: FloraPalette, silicon: boolean, r: number, tint?: FloraTint): FloraPalette {
  if (silicon) {
    if (!tint) return base;   // silicon flora takes the crust tint whole (blue-black on silicide, steel-blue on reduced lava, cream on nitride)
    const key = `si-${base.ink}-${tint.crimson}`;
    let q = cache.get(key);
    if (!q) { q = { ...base, maroon: tint.maroon, crimson: tint.crimson, blush: tint.blush }; cache.set(key, q); }
    return q;
  }
  const step = Math.round(Math.min(1, Math.max(0, r)) * STEPS);
  const key = `${base.ink}-${step}-${tint ? tint.crimson : 0}`;
  let p = cache.get(key);
  if (!p) {
    const t = step / STEPS, g = tint ?? GREEN;
    p = { ...base,
      maroon: mixHex(PURPLE.maroon, g.maroon, t),
      crimson: mixHex(PURPLE.crimson, g.crimson, t),
      blush: mixHex(PURPLE.blush, g.blush, t) };
    cache.set(key, p);
  }
  return p;
}

export interface FloraTint { maroon: number; crimson: number; blush: number }

// ---- Mineral look families (owner request 2026-11-08: the look comes from the rock, not one red palette) -------------------
// One family per mineral id, [fresh, rusted] (non-oxidising minerals repeat). Roles: the rock ramp light → deep, the cel
// shadow, the haze/fog and horizon of air carrying that rock's dust, the flora's green end (maroon/crimson/blush), and the
// sea shallows over that seabed. Look decisions, kept inside the Red World style; the real-world anchors are in comments.
export interface Family {
  redLight: number; red: number; crimson: number; maroon: number; shadow: number; haze: number; horizon: number; sea: number;
  floraMaroon: number; floraCrimson: number; floraBlush: number;
  /** 0..1: how much this rock counts when mixing the flora tint (ice grows nothing). */
  floraWeight: number;
}
const fam = (redLight: number, red: number, crimson: number, maroon: number, shadow: number, haze: number, horizon: number, sea: number,
  fl: [number, number, number], floraWeight = 1): Family =>
  ({ redLight, red, crimson, maroon, shadow, haze, horizon, sea, floraMaroon: fl[0], floraCrimson: fl[1], floraBlush: fl[2], floraWeight });

// Ironstone = the Red World (owner request 2026-11-08, "iron should still make everything red"): rock ramp and oxblood shadow are
// LOOK_PALETTES.carbon's; the air carries rose-red iron dust; the shallows are stained red-orange by iron oxide; and the plants are
// red. Plant reason (recalled, NOT verified): iron oxides in the soil bind phosphate, and phosphate-starved plants build red
// anthocyanin pigments. The ratchet still runs purple → this red tint, so an iron world's flora goes purple → red, never green.
const IRONSTONE_RED = fam(0xff5a36, 0xe8331f, 0xa8122a, 0x5c0a1e, 0x5a1040, 0xf0c4bc, 0xf6d4cc, 0xd8502a, [0x5c0a1e, 0xa8122a, 0xf2a2a0]);
export const MINERAL_LOOK: Record<string, readonly [Family] | readonly [Family, Family]> = {
  // charcoal teal-grey volcanic rock under cool blue-grey air (Iceland, the Faroes); emerald flora; teal over dark sand. Rusted: brown-red.
  basalt: [
    fam(0x86a0a0, 0x4a6466, 0x2c4448, 0x16282c, 0x1a3a4a, 0xc0d2dc, 0xd4e2ec, 0x1a6a78, [0x0c3a28, 0x1f9a5c, 0x9ae6b4]),
    // mild brown oxidation (dark brown-grey, no Red World red); flora stays emerald and the air cool so 'Volcanic' stays green and Earth-like
    fam(0x968a86, 0x645a58, 0x453c3c, 0x261f20, 0x1e2e3a, 0xc0d2dc, 0xd4e2ec, 0x2a5a60, [0x0c3a28, 0x1f9a5c, 0x9ae6b4]),
  ],
  ironstone: [
    // jasper before full oxidation: same family, a little darker and less saturated
    fam(0xd0664a, 0xa83c2e, 0x7a2430, 0x43121c, 0x4a1238, 0xe2c0b8, 0xecd0c8, 0xb04e30, [0x4a0e1c, 0x8c1a2c, 0xe09a98]),
    IRONSTONE_RED,
  ],
  // pale pink-grey and warm-white granite, pale warm haze, heath and bronze-green moorland, turquoise over quartz sand
  granite: [fam(0xf2e6e0, 0xd8bcb8, 0xa4828a, 0x5c4450, 0x6a4a60, 0xf2e6da, 0xf8eee0, 0x3ab8b0, [0x2a3a18, 0x6a7a2e, 0xc8c88a])],
  // dark steel and gunmetal, steel-blue haze, blue-black crystal crust, dark shallows. Rusted: pale silica.
  silicide: [
    fam(0x8a97ab, 0x4c566a, 0x2e3648, 0x161c2c, 0x1a2a4c, 0x8fa4c8, 0xa9bcdc, 0x1a2640, [0x080c1c, 0x1c2c5a, 0x6a8ad0]),
    fam(0xe8e4dc, 0xb4aea4, 0x7a7678, 0x3a3e48, 0x2a3a5c, 0xb8bfcc, 0xd0d0dc, 0x3a4260, [0x080c1c, 0x1c2c5a, 0x6a8ad0]),
  ],
  // cream and pale gold, pale cream haze, cream-white crystal flora, pale shallows
  nitride: [fam(0xfff8e4, 0xf0e0b8, 0xc8aa6a, 0x7a6030, 0x44587a, 0xeeeadc, 0xf6f2e4, 0xcfd8d0, [0x6a5a30, 0xe6d8a8, 0xfffaf0])],
  // Reduced lava (silicon's volcanic rock, no oxygen): dark slate grey with metallic flecks, grey-blue haze, steel-blue crystal
  // flora, dark clear shallows. Rusted = silica: pale grey. Look decision, speculative like the world.
  reducedLava: [
    fam(0x7a838e, 0x424a54, 0x2a3139, 0x151a20, 0x1a2c4a, 0x8c9db0, 0xa4b4c6, 0x16202e, [0x0a1220, 0x2a4a6e, 0x7fa6c8]),
    fam(0xe4e6e8, 0xb8bcc0, 0x7c8086, 0x3c4046, 0x2a3a58, 0xb4bfcc, 0xcfd7e0, 0x34404e, [0x0a1220, 0x2a4a6e, 0x7fa6c8]),
  ],
  // white and pale blue, frost-white haze, nothing grows, white-blue shallows
  waterIce: [fam(0xffffff, 0xdcecf8, 0x9cc0e0, 0x4a6a96, 0x32467a, 0xe8f2fa, 0xf2f8fd, 0xe0f0fa, [0x4a6a96, 0x9cc0e0, 0xffffff], 0)],
};
const NEUTRAL_FAMILY = fam(0x9a9a9a, 0x6a6a6a, 0x484848, 0x242424, 0x2a2a3a, 0xd0d0d8, 0xe0e0e8, 0x4a6a7a, [0x1a3a20, 0x4a8a50, 0xb0d8a0], 1);

type FamKey = Exclude<keyof Family, 'floraWeight'>;
const FAM_KEYS: FamKey[] = ['redLight', 'red', 'crimson', 'maroon', 'shadow', 'haze', 'horizon', 'sea', 'floraMaroon', 'floraCrimson', 'floraBlush'];

export function mineralFamily(id: string, oxidises: boolean, rustLevel: number): Family {
  const f = MINERAL_LOOK[id];
  if (!f) return NEUTRAL_FAMILY;
  if (!oxidises || f.length < 2) return f[0];
  const t = Math.min(1, Math.max(0, rustLevel));
  const out = { ...f[0] };
  for (const k of FAM_KEYS) out[k] = labMix(f[0][k], f[1]![k], t);
  return out;
}

export type CrustMix = NonNullable<VisualInputs['world']['crust']>;
const norm = (w: number[]): number[] => {
  const t = w.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  return t > 0 ? w.map((x) => (x > 0 ? x : 0) / t) : w.map(() => 1 / Math.max(1, w.length));
};
/** Perceptual weighted mean of one hex role over the families. */
function labMean(items: { hex: number; w: number }[]): number {
  let L = 0, A = 0, B = 0;
  for (const { hex, w } of items) { const l = hexToLab(hex); L += l[0] * w; A += l[1] * w; B += l[2] * w; }
  return labToHex(L, A, B);
}
/** Blend the families by `weights` (normalised here) at rust level `rust`. `floraWeights` defaults to weights × floraWeight; `seaWeights` to the seabed weights. */
export function blendFamilies(crust: CrustMix, weights: number[], rust: number): { family: Family; weights: number[]; seaWeights: number[] } {
  const w = norm(weights);
  const fams = crust.ids.map((id, i) => mineralFamily(id, crust.oxidises[i], rust));
  // squared: the soil that dominates sets the plants' colour (an iron-rich crust reads red, a mixed one stays mixed)
  const fw = norm(fams.map((f, i) => (w[i] * f.floraWeight) ** 2));
  const minElev = Math.min(...crust.elevation);
  const sw = norm(crust.elevation.map((e, i) => w[i] * Math.max(0, 1 - (e - minElev) / 0.4)));
  // squared, like the flora: the dominant rock sets the palette (a 70% iron crust reads as the Red World, not a 70/30 blend)
  const rw = norm(w.map((x) => x * x));
  const family = { floraWeight: 1 } as Family;
  for (const k of FAM_KEYS) {
    const ws = k.startsWith('flora') ? fw : k === 'sea' ? sw : rw;
    family[k] = labMean(fams.map((f, i) => ({ hex: f[k], w: ws[i] })));
  }
  return { family, weights: w, seaWeights: sw };
}

const memo = { key: '', rust: -1, value: null as null | ReturnType<typeof blendFamilies> };
/** The global (whole-patch) blend at the ratchet's rust level: shares as weights. Memoised per crust and rust step. */
export function crustGlobal(inputs: Pick<VisualInputs, 'world' | 'stats' | 'buildProgress'>): { family: Family; rust: number } | null {
  const c = inputs.world.crust;
  if (!c) return null;
  const rust = crustRatchet.update(inputs.world, inputs.stats.oxygen ?? 0, inputs.buildProgress);
  const key = c.ids.join() + c.shares.join();
  const step = Math.round(rust * 64);
  if (memo.key !== key || memo.rust !== step || !memo.value) { memo.key = key; memo.rust = step; memo.value = blendFamilies(c, c.shares, step / 64); }
  return { family: memo.value.family, rust };
}

/** The flora's green end (carbon) or whole tint (silicon) from the crust; undefined without a crust (fixed palette). */
export function crustFloraTint(inputs: Pick<VisualInputs, 'world' | 'stats' | 'buildProgress'>): FloraTint | undefined {
  const g = crustGlobal(inputs);
  return g ? { maroon: g.family.floraMaroon, crimson: g.family.floraCrimson, blush: g.family.floraBlush } : undefined;
}

/** Sea-shallows colour from the seabed rocks (the lowest-elevation minerals, by share). */
export function crustSeaTint(inputs: Pick<VisualInputs, 'world' | 'stats' | 'buildProgress'>): number | undefined {
  return crustGlobal(inputs)?.family.sea;
}

/** 0..1: how much of the seabed is ironstone (sea-weighted). Drives a stronger, deeper iron-oxide stain in the shallows. */
export function crustSeaStain(inputs: Pick<VisualInputs, 'world' | 'stats' | 'buildProgress'>): number {
  const c = inputs.world.crust;
  if (!c || !crustGlobal(inputs) || !memo.value) return 0;
  const i = c.ids.indexOf('ironstone');
  return i < 0 ? 0 : memo.value.seaWeights[i];
}

// Open-sea body nudge per seabed mineral (≤ WATER_NUDGE_MAX of the body colour, palette.waterBody): granite sand is clear and
// bright, basalt dark, iron-rich water greener (dissolved iron feeds plankton: the iron hypothesis, Martin 1990, Nature 345:156).
// Not rusted: rust colours the shallows only.
const WATER_NUDGE: Record<string, number> = {
  granite: 0x58d0ec, basalt: 0x08183c, ironstone: 0x2c9c88, silicide: 0x0a1c48, nitride: 0x4cc0d8, waterIce: 0x70c8e8, reducedLava: 0x0a1830,
};
/** The crust-derived hue the open sea's body leans towards (sea-weighted over the seabed rocks); undefined without a crust. */
export function crustWaterNudge(inputs: Pick<VisualInputs, 'world' | 'stats' | 'buildProgress'>): number | undefined {
  const c = inputs.world.crust;
  if (!c || !crustGlobal(inputs) || !memo.value) return undefined;
  const sw = memo.value.seaWeights;
  const items = c.ids.map((id, i) => ({ hex: WATER_NUDGE[id] ?? 0x1670b8, w: sw[i] }));
  return labMean(items);
}

/** Local share of the camera's surroundings, eased: haze leans towards the rock under and around the camera. */
export const LOCAL_SHARE = 0.6;      // 60% local, 40% global
export const LOCAL_TAU_SEC = 0.7;    // ≈95% of the way in 2 s
const RING_M = 40;                   // metres: sample ring around the camera
export class LocalCrust {
  private w: number[] | null = null;
  /** One easing step towards `target`: exponential, so the distance only ever shrinks. */
  step(target: number[], dt: number): number[] {
    if (!this.w || this.w.length !== target.length) { this.w = target.slice(); return this.w; }
    const k = 1 - Math.exp(-Math.max(0, dt) / LOCAL_TAU_SEC);
    for (let i = 0; i < target.length; i++) this.w[i] += (target[i] - this.w[i]) * k;
    return this.w;
  }
  reset() { this.w = null; }
}
const local = new LocalCrust();

/** Mean crust weights at the camera and four points around it (null if the terrain has no crust sampler). */
function sampleAround(inputs: Pick<VisualInputs, 'terrain'>, x: number, z: number, n: number): number[] | null {
  const f = inputs.terrain.crustWeights;
  if (!f) return null;
  const acc = new Array<number>(n).fill(0);
  const pts: [number, number][] = [[0, 0], [RING_M, 0], [-RING_M, 0], [0, RING_M], [0, -RING_M]];
  for (const [dx, dz] of pts) { const w = f(x + dx, z + dz); for (let i = 0; i < n; i++) acc[i] += (w[i] ?? 0) / pts.length; }
  return acc;
}

/**
 * The rock-and-air roles for this frame (palette.lookPalette's `rock`): the family blend by crust shares, with haze and
 * horizon leaning 60% towards the rock around the camera (eased). Silicon has no extra retained tint: its rock
 * families are already cold, and its sky is Rayleigh blue (palette.rayleighZenith). Null without a crust (fixed palette).
 */
export function crustRock(inputs: Pick<VisualInputs, 'world' | 'stats' | 'buildProgress' | 'terrain'>, camX: number, camZ: number, dt: number): RockLook | null {
  const g = crustGlobal(inputs);
  const c = inputs.world.crust;
  if (!g || !c) return null;
  let haze = g.family.haze, horizon = g.family.horizon;
  const around = sampleAround(inputs, camX, camZ, c.ids.length);
  if (around) {
    const lw = local.step(around, dt);
    const lf = blendFamilies(c, lw, g.rust).family;
    haze = labMix(haze, lf.haze, LOCAL_SHARE);
    horizon = labMix(horizon, lf.horizon, LOCAL_SHARE);
  }
  const f = g.family;
  return {
    redLight: f.redLight, red: f.red, crimson: f.crimson, maroon: f.maroon,
    shadow: f.shadow, haze, skyHorizon: horizon,
  };
}
export function resetCrustLook() { local.reset(); memo.value = null; }
