// Palette roles and the reference Red World values. Pure (no three.js, no DOM), shared by derive.ts and contracts.ts.

export const PALETTE_KEYS = [
  'skyZenith', 'skyHorizon', 'haze',
  'redLight', 'red', 'crimson', 'maroon', 'ink',
  'bone', 'blush', 'shadow', 'glow', 'glowDeep',
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type Palette = Record<PaletteKey, number>;

/** The adopted Red World palette (docs/ART_DIRECTION.md §2). The Rust World sample point reproduces it. */
export const RED_WORLD: Palette = {
  skyZenith: 0xeef0f4, skyHorizon: 0xf3eef8, haze: 0xe4daef,
  redLight: 0xff5a36, red: 0xe8331f, crimson: 0xa8122a, maroon: 0x5c0a1e, ink: 0x22060f,
  bone: 0xf4e6dc, blush: 0xf2a2a0, shadow: 0x5a1040, glow: 0x3ff5e0, glowDeep: 0x0f8f9a,
};

// ---- OKLab colour maths (Björn Ottosson 2020), on sRGB hex ints

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export type Lab = [number, number, number];

export function hexToLab(hex: number): Lab {
  const r = toLin(((hex >> 16) & 255) / 255), g = toLin(((hex >> 8) & 255) / 255), b = toLin((hex & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function labToHex([L, A, B]: Lab): number {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const q = (v: number) => Math.round(clamp01(toSrgb(clamp01(v))) * 255);
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

/** Weighted OKLab mix of hexes (weights need not sum to 1; all-zero returns the first). */
export function mixLab(entries: [number, number][]): number {
  let w = 0;
  const acc: Lab = [0, 0, 0];
  for (const [hex, k] of entries) {
    if (k <= 0) continue;
    const c = hexToLab(hex);
    acc[0] += c[0] * k; acc[1] += c[1] * k; acc[2] += c[2] * k; w += k;
  }
  if (w <= 0) return entries[0][0];
  return labToHex([acc[0] / w, acc[1] / w, acc[2] / w]);
}

export const mix2 = (a: number, b: number, t: number) => mixLab([[a, 1 - clamp01(t)], [b, clamp01(t)]]);

/** OKLCH hue in radians and chroma. */
export function lch(hex: number): { L: number; C: number; h: number } {
  const [L, a, b] = hexToLab(hex);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
}
export function fromLch(L: number, C: number, h: number): number {
  return labToHex([L, C * Math.cos(h), C * Math.sin(h)]);
}

/** OKLab distance (≈ perceptual ΔE/100). */
export function dE(a: number, b: number): number {
  const x = hexToLab(a), y = hexToLab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
