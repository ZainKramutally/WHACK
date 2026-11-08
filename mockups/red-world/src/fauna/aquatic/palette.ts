// Swimmer colour roles. Carbon = Red World PALETTE (contracts.ts). Silicon = the app's LOOK_PALETTES.silicon
// (src/render/palette.ts), COPIED here (mockups never import across projects). Same role keys in both, so a swimmer's
// { body, accent } names a role and the chemistry picks the hex.
import { Color } from 'three';
import { PALETTE, type PaletteKey } from '../../contracts';
import type { Chemistry } from './params';

export const SI_PALETTE: Record<PaletteKey, number> = {
  skyZenith: 0x6450b0, skyHorizon: 0xbca8ea, haze: 0xab98e2,
  redLight: 0xf4eefa, red: 0xd8c8ee, crimson: 0x7c5cc8, maroon: 0x3a2478, ink: 0x100828,
  bone: 0xf6f8ff, blush: 0x9fcff2, shadow: 0x2a2272, glow: 0x6ff4ff, glowDeep: 0x2f7fe0,
};

export const paletteOf = (chem: Chemistry): Record<PaletteKey, number> => (chem === 'silicon' ? SI_PALETTE : PALETTE);

const cache = new Map<string, [number, number, number]>();
/** Linear rgb of a palette role for a chemistry. */
export function linearOf(chem: Chemistry, key: PaletteKey): [number, number, number] {
  const k = chem + key;
  let v = cache.get(k);
  if (!v) { const c = new Color().setHex(paletteOf(chem)[key]); v = [c.r, c.g, c.b]; cache.set(k, v); }
  return v;
}

/** The two waters (lab tank). Carbon: dark violet-oxblood (PALETTE.shadow toward crimson, as the app's underwater tint).
 *  Nitrogen: pale, clear, faintly ice-lilac (SI_PALETTE bone/blush/haze). sRGB hex. */
export const WATERS = {
  carbon: { surface: 0xb0507a, mid: 0x5a1040, deep: 0x22060f, floor: 0x5c0a1e, floorLight: 0xa8122a, rim: 0xf2a2a0, shadow: 0x2a0624, fogStart: 4, fogDist: 34, caustic: 0.55, sun: 0xfff0f0 },
  nitrogen: { surface: 0xf6f8ff, mid: 0xc9d2ee, deep: 0x8e94c8, floor: 0xb4a8d8, floorLight: 0xc8bce6, rim: 0x3a2478, shadow: 0x3a2478, fogStart: 10, fogDist: 120, caustic: 0.22, sun: 0xffffff },
} as const;
export type WaterKind = keyof typeof WATERS;
