// derive(dials) → Derived. Pure, no THREE import. Spec: docs/features/world-generator.md §2, §7.
// Everything downstream reads only these values.
import type { Dials, Derived, Palette, Preset, Recipe, SeaWeights, SpeciesId } from './contracts';
import { SPECIES } from './contracts';

// ------------------------------------------------------------------ small maths / colour helpers

export const sat = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const g = (x: number, mu: number, sigma: number) => Math.exp(-(((x - mu) / sigma) ** 2));

type RGB = [number, number, number];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export const hexToLinear = (hex: number): RGB => [
  toLin(((hex >> 16) & 255) / 255), toLin(((hex >> 8) & 255) / 255), toLin((hex & 255) / 255),
];
export const linearToHex = (c: RGB): number => {
  const b = (v: number) => Math.round(sat(fromLin(Math.max(0, v))) * 255);
  return (b(c[0]) << 16) | (b(c[1]) << 8) | b(c[2]);
};
export const mixHex = (a: number, b: number, t: number): number => {
  const A = hexToLinear(a), B = hexToLinear(b);
  return linearToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
};
/** Weighted mix of several hex colours in linear RGB. */
export const blendHex = (cols: number[], w: number[]): number => {
  let s = 0; const acc: RGB = [0, 0, 0];
  cols.forEach((c, i) => { const l = hexToLinear(c); acc[0] += l[0] * w[i]; acc[1] += l[1] * w[i]; acc[2] += l[2] * w[i]; s += w[i]; });
  return linearToHex([acc[0] / s, acc[1] / s, acc[2] / s]);
};

export function hexToHsl(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-9) return [0, 0, l];
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, sat, l];
}
export function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = (((h % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2, B = (v: number) => Math.round(sat(v + m) * 255);
  return (B(r1) << 16) | (B(g1) << 8) | B(b1);
}

/** Dominant-family glow colour: the leading recipe family wins (soft-argmax), hue is a circular mean, S/L held at the family level. */
export function glowHueOf(recipe: Recipe): number {
  const r = [recipe.c, recipe.si, recipe.o], fam = [FAMILY.c, FAMILY.si, FAMILY.o].map(hexToHsl);
  const mx = Math.max(...r);
  // soft-argmax, not recipe^4: near-ties (eco04 si .40 vs o .45) would average to purple (~280°) instead of the leader's pink
  const w = r.map((v) => Math.exp((v - mx) / 0.025));
  const ws = w[0] + w[1] + w[2];
  let sx = 0, sy = 0, S = 0, L = 0;
  fam.forEach(([h, s, l], i) => {
    const k = w[i] / ws, a = (h * Math.PI) / 180;
    sx += Math.cos(a) * k; sy += Math.sin(a) * k; S += s * k; L += l * k;
  });
  return hslToHex((Math.atan2(sy, sx) * 180) / Math.PI, S, L);
}

// ------------------------------------------------------------------ normalisation

export function normalizeRecipe(r: Recipe): Recipe {
  const c = Math.max(0, r.c), si = Math.max(0, r.si), o = Math.max(0, r.o);
  const s = c + si + o;
  return s > 1e-9 ? { c: c / s, si: si / s, o: o / s } : { c: 1 / 3, si: 1 / 3, o: 1 / 3 };
}
export function normalizeSea(w: SeaWeights): SeaWeights {
  const a = Math.max(0, w.water), b = Math.max(0, w.ammonia), c = Math.max(0, w.methane), d = Math.max(0, w.acid);
  const s = a + b + c + d;
  return s > 1e-9 ? { water: a / s, ammonia: b / s, methane: c / s, acid: d / s } : { water: 1, ammonia: 0, methane: 0, acid: 0 };
}

// ------------------------------------------------------------------ constants

export const BONE = 0xece4d6;
export const STAIN: Record<keyof SeaWeights, number> = {
  water: 0xf94b1e, acid: 0xa47c68, methane: 0x577c99, ammonia: 0x5a3b52, // methane = cold blue-slate (eco-04 rock)
};
const FAMILY = { c: 0xffa41b, si: 0x27aaa6, o: 0xda1b58 }; // glow hue: C amber, Si cyan, O magenta
const PORE_GLOW = 0xff7a1a;
// base fog density (1/m, exponential) per sea; × (1.2 − heat)
const FOG_BASE: Record<keyof SeaWeights, number> = { water: 0.003, ammonia: 0.0045, methane: 0.0045, acid: 0.0045 };

// ------------------------------------------------------------------ calibrated palette field

/** ART_DIRECTION §3 sea palettes. skyHorizon = sky→haze 70%. */
const SEA_PALETTES: Record<keyof SeaWeights, Palette> = {
  water:   { skyTop: 0x0b2f38, skyHorizon: 0x2b7d88, haze: 0x44aeb7, fog: 0x1f7689, ground: 0x14444c, shadow: 0x062a3a, accent: 0xf2552c },
  ammonia: { skyTop: 0x1e0e5c, skyHorizon: 0x7a5aa2, haze: 0x9a68b4, fog: 0x4a2a8c, ground: 0x3a2163, shadow: 0x120840, accent: 0xff4fa3 },
  methane: { skyTop: 0xeef2f6, skyHorizon: 0xf8fafc, haze: 0xffffff, fog: 0xa9bacd, ground: 0xcbd7e3, shadow: 0x5a7c9c, accent: 0xda1b58 },
  acid:    { skyTop: 0xfbf6dc, skyHorizon: 0xfcf9e6, haze: 0xfffbea, fog: 0xead99a, ground: 0xe2cf95, shadow: 0x7a3e5c, accent: 0xec5401 },
};
const SEA_KEYS: (keyof SeaWeights)[] = ['water', 'ammonia', 'methane', 'acid'];
const unit = (k: keyof SeaWeights): SeaWeights => ({ water: 0, ammonia: 0, methane: 0, acid: 0, [k]: 1 } as SeaWeights);

interface Anchor { sea: SeaWeights; heat: number; light: number; palette: Palette }
let anchorCache: { key: Preset[]; anchors: Anchor[] } | null = null;
function anchorsFor(presets: Preset[]): Anchor[] {
  if (anchorCache && anchorCache.key === presets) return anchorCache.anchors;
  const anchors: Anchor[] = [
    ...presets.map((p) => ({ sea: normalizeSea(p.dials.sea), heat: p.dials.heat, light: p.dials.light, palette: p.pinPalette })),
    ...SEA_KEYS.map((k) => ({ sea: unit(k), heat: 0.5, light: 0.6, palette: SEA_PALETTES[k] })),
  ];
  anchorCache = { key: presets, anchors };
  return anchors;
}

const PAL_KEYS: (keyof Palette)[] = ['skyTop', 'skyHorizon', 'haze', 'fog', 'ground', 'shadow', 'accent'];
const IDW_POWER = 3;

/** Inverse-distance blend over anchors in (sea weights, heat, light). Exact at anchors. */
export function paletteField(sea: SeaWeights, heat: number, light: number, presets: Preset[]): Palette {
  const anchors = anchorsFor(presets);
  const ws: number[] = [];
  for (const a of anchors) {
    const d2 =
      (sea.water - a.sea.water) ** 2 + (sea.ammonia - a.sea.ammonia) ** 2 +
      (sea.methane - a.sea.methane) ** 2 + (sea.acid - a.sea.acid) ** 2 +
      (heat - a.heat) ** 2 + (light - a.light) ** 2;
    if (d2 < 1e-12) return { ...a.palette };
    ws.push(1 / d2 ** (IDW_POWER / 2));
  }
  const out = {} as Palette;
  for (const k of PAL_KEYS) out[k] = blendHex(anchors.map((a) => a.palette[k]), ws);
  return out;
}

// ------------------------------------------------------------------ niches (spec §7)

export function niches(d: Dials): Record<SpeciesId, number> {
  const { c, si, o } = d.recipe;
  const { heat, light, age, sea } = d;
  const n: Record<SpeciesId, number> = {
    lanternCups: g(o, 0.45, 0.15) * g(light, 0.2, 0.2) * g(heat, 0.15, 0.3),
    frostFans: g(si, 0.45, 0.2) * g(heat, 0.05, 0.2) * (0.4 + 0.6 * sea.methane),
    glowStalks: g(si, 0.55, 0.15) * g(light, 0.05, 0.15) * g(heat, 0.5, 0.2),
    mossDomes: g(c, 0.3, 0.15) * g(heat, 0.5, 0.2) * g(light, 0.2, 0.3),
    shadeRibbons: g(c, 0.3, 0.2) * g(light, 0.1, 0.2) * g(heat, 0.5, 0.25),
    poreDwellers: g(si + o, 0.9, 0.15) * g(light, 0.3, 0.2) * g(heat, 0.6, 0.25),
    glassWhiskers: g(si, 0.5, 0.15) * g(heat, 0.6, 0.2) * (0.3 + 0.7 * sea.acid),
    blackMonoliths: g(heat, 0.9, 0.12) * g(light, 0.85, 0.2) * g(age, 0.95, 0.25),
    ashScrub: g(heat, 0.9, 0.15) * g(light, 0.8, 0.25),
  };
  for (const s of SPECIES) n[s] = sat(n[s]);
  return n;
}

// ------------------------------------------------------------------ derive

export function derive(dialsIn: Dials, presets: Preset[]): Derived {
  const recipe = normalizeRecipe(dialsIn.recipe);
  const sea = normalizeSea(dialsIn.sea);
  const heat = sat(dialsIn.heat), light = sat(dialsIn.light), age = sat(dialsIn.age);
  const d: Dials = { ...dialsIn, recipe, sea, heat, light, age };

  const palette = paletteField(sea, heat, light, presets);

  // cold methane stone takes stain readily (blue-slate); acid stain is capped so its bone stays pale
  const stainAmount = Math.min(sat(age * (0.3 + heat) * 1.4 * (1 + 0.8 * sea.methane)), 1 - 0.5 * sea.acid);
  const stain = blendHex(SEA_KEYS.map((k) => STAIN[k]), SEA_KEYS.map((k) => sea[k] + 1e-6));
  const stoneColor = mixHex(BONE, stain, stainAmount);

  const builders = smoothstep(0.45, 0.8, recipe.si + recipe.o) * age;
  const erosion = sat(heat * age);
  const life = g(heat, 0.5, 0.28);
  const glowHue = glowHueOf(recipe);
  const fogDensity = SEA_KEYS.reduce((s, k) => s + sea[k] * FOG_BASE[k], 0) * Math.max(0.2, 1.2 - heat);

  return {
    palette,
    stoneColor,
    stainAmount,
    builders,
    spireHeight: (0.4 + 0.6 * age) * (1.3 - 0.6 * heat),
    erosion,
    pores: sat(recipe.si * recipe.o * 5) * (1 - erosion * erosion),
    arches: builders * (1 - heat) ** 2,
    snow: sat(sea.methane * (1 - heat) ** 2),
    life,
    glow: sat(life * (1 - light) ** 1.5),
    glowHue,
    poreGlowHue: PORE_GLOW,
    capWidth: light,
    stalkHeight: sat((1 - light) * (1 - heat)),
    fogDensity,
    char: sat(heat * light * age * recipe.c * 6),
    niches: niches(d),
  };
}
