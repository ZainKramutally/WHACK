// Pixel Diorama palette + band logic (docs/ART_DIRECTION_PIXEL.md §3–5). Pure data/logic: unit-tested, mirrored in the TSL pass.
import type { SeaWeights } from '../contracts';

export type SeaKey = keyof SeaWeights;
const SEA_KEYS: SeaKey[] = ['water', 'ammonia', 'methane', 'acid'];

const h = (s: string) => parseInt(s.slice(1), 16);
const ramp = (...s: string[]) => s.map(h);

/** §4.1 field ramps, steps 0..5 (deep, shadow, base, base-lit, light, highlight). */
export const SEA_RAMPS: Record<SeaKey, number[]> = {
  water: ramp('#04202B', '#0A4C5E', '#0F7A8A', '#1BA8AE', '#5DDCCF', '#C4FFEE'),
  ammonia: ramp('#12073A', '#2D1585', '#4F27C2', '#7B4BEB', '#B48CFF', '#EADBFF'),
  methane: ramp('#1E2C66', '#34549E', '#5C86CF', '#8FB6EC', '#CFE6FF', '#FFFFFF'),
  acid: ramp('#4A1745', '#8A2F62', '#D8723E', '#F2B13A', '#FFE14A', '#FFF8C2'),
};

/** §4.2 families (steps 1..4). */
export const FAMILIES = {
  carbon: ramp('#7A1622', '#D2332A', '#FF6A3D', '#FFB08A'),
  silicon: ramp('#0B3A78', '#1B8FD6', '#3FE3F2', '#BFF8FF'),
  oxygen: ramp('#5C0E4E', '#BE1F86', '#FF4FB0', '#FFC0E6'),
  spark: ramp('#FF7A00', '#FFB300', '#FFF2A0'),
};
export const INK = h('#120D1C');
export const WHITE = h('#FFFFFF');

/** §4.3 stone: bone + per-sea stain. */
export const BONE = ramp('#A8957C', '#D8CBB4', '#EFE6D4', '#FFFAEE');
export const STAINS: Record<SeaKey, number[]> = {
  water: ramp('#5E0F08', '#B3260F', '#F2592A', '#FF9A62'),
  acid: ramp('#5A3424', '#A86A3C', '#E0A458', '#FFD98A'),
  ammonia: ramp('#2A1238', '#5A2F6A', '#8E5A98', '#C79BD0'),
  methane: ramp('#3A4466', '#6A7AA6', '#A3B2D6', '#DCE4F6'),
};

export const PALETTE_SIZE = 32;

// §3 / §5 constants shared with the shader.
export const SHADE_EDGES: [number, number] = [0.15, 0.55];      // N·L: shadow | base | light
export const DEPTH_EDGES: [number, number, number] = [25, 70, 160]; // metres
export const DEPTH_MIX = [0, 0.25, 0.5, 0.75];                     // share of the horizon colour per depth band
export const SURFACE_GAIN = 0.88;                                 // keeps palette step 5 for highlights: lit surfaces land on step 4
export const BONE_BIAS = 0.006;                                   // Oklab² penalty so desaturated cool greys prefer a stain/field ramp over fresh bone
export const HALO_HDR2 = 2;                                        // emissive above this gets a 2 px ring

/** The sea with the largest weight (ties resolve in dial order). */
export function dominantSea(sea: SeaWeights): SeaKey {
  let best: SeaKey = 'water';
  for (const k of SEA_KEYS) if (sea[k] > sea[best]) best = k;
  return best;
}

/** Active scene palette: field ramp of the dominant sea + family ramps + stone/stain ramps + spark + ink + white. Exactly 32 entries (padded). */
export function buildPalette(sea: SeaWeights): number[] {
  const k = dominantSea(sea);
  const all = [
    ...SEA_RAMPS[k], ...FAMILIES.carbon, ...FAMILIES.silicon, ...FAMILIES.oxygen, ...FAMILIES.spark,
    ...BONE, ...STAINS[k], INK, WHITE,
  ];
  const out = [...new Set(all)];
  while (out.length < PALETTE_SIZE) out.push(out[0]);
  return out.slice(0, PALETTE_SIZE);
}

/** Field ramp for the dominant sea (sky, depth haze). */
export const fieldRamp = (sea: SeaWeights): number[] => SEA_RAMPS[dominantSea(sea)];

/** 0 shadow · 1 base · 2 light from N·L. */
export function shadeBand(nl: number): 0 | 1 | 2 {
  return nl < SHADE_EDGES[0] ? 0 : nl < SHADE_EDGES[1] ? 1 : 2;
}

/** 0..3 depth band from view distance in metres. */
export function depthBand(dist: number): 0 | 1 | 2 | 3 {
  const e = DEPTH_EDGES;
  return dist < e[0] ? 0 : dist < e[1] ? 1 : dist < e[2] ? 2 : 3;
}

const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const hexToLin = (hex: number): [number, number, number] => [lin((hex >> 16) & 255), lin((hex >> 8) & 255), lin(hex & 255)];

/** Oklab (Björn Ottosson) from linear sRGB. Mirrored in the shader. */
export function toOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
/** Squared-distance weights in Oklab (L, a, b). Hue is weighted over lightness so pale tints keep their hue ramp. */
export const LAB_W: [number, number, number] = [1, 2, 2];
const labDist = (x: number[], y: number[]) => LAB_W[0] * (x[0] - y[0]) ** 2 + LAB_W[1] * (x[1] - y[1]) ** 2 + LAB_W[2] * (x[2] - y[2]) ** 2;

/** Extra distance for fresh-bone (BONE_BIAS) and family colours (FAMILY_BIAS). */
export const FAMILY_BIAS = 0.004; // same idea for carbon/silicon/oxygen: pale scene colours shouldn't read as life
const FAMILY_HEX = new Set([...FAMILIES.carbon, ...FAMILIES.silicon, ...FAMILIES.oxygen]);
export const paletteBias = (hex: number): number => (BONE.includes(hex) ? BONE_BIAS : FAMILY_HEX.has(hex) ? FAMILY_BIAS : 0);

/** Index of the palette colour nearest to a linear RGB value. */
export function nearestIndex(rgbLin: [number, number, number], palette: number[]): number {
  const x = toOklab(rgbLin);
  let best = 0, bd = Infinity;
  palette.forEach((hex, i) => {
    const d = labDist(x, toOklab(hexToLin(hex))) + paletteBias(hex);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/** Largest integer scale that fits, ≥ 1 (§3). */
export function integerScale(w: number, h: number, vw: number, vh: number): number {
  return Math.max(1, Math.floor(Math.min(vw / w, vh / h)));
}

/** Sky band 0..3 (top dark → horizon light) from elevation (y of view direction). */
export const SKY_EDGES: [number, number, number] = [0.05, 0.16, 0.34];
export function skyBand(elevation: number): 0 | 1 | 2 | 3 {
  const e = SKY_EDGES;
  return elevation < e[0] ? 3 : elevation < e[1] ? 2 : elevation < e[2] ? 1 : 0;
}

/** Field-ramp step (0..5) nearest to a hex colour. */
export const nearestStep = (hex: number, ramp: number[]): number => nearestIndex(hexToLin(hex), ramp);

/**
 * Field-ramp steps for the 4 sky bands (top → horizon), spanning the v1 sky's own range (skyTop → haze) so a pale
 * pin keeps a pale sky (spec §9 uses steps 3–5 there) and a dusk sky keeps its dark top. Monotone, ≥ 1 step apart.
 */
export function skySteps(skyTop: number, haze: number, ramp: number[]): [number, number, number, number] {
  let a = nearestStep(skyTop, ramp), b = nearestStep(haze, ramp);
  if (a > b) [a, b] = [b, a];
  if (a === b) { if (b < 5) b++; else a--; }
  const at = (i: number) => Math.round(a + ((b - a) * i) / 3);
  return [at(0), at(1), at(2), at(3)];
}
