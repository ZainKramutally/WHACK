// Functional colour and lighting choices, as pure functions of the stats (never of a world id), so visuals cannot
// contradict the numbers. Hex ints. The art team's look replaces this file's outputs, not the callers.
import type { VisualInputs } from '../worlds/types';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function mixHex(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

export function scaleHex(a: number, k: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (c((a >> 16) & 255) << 16) | (c((a >> 8) & 255) << 8) | c(a & 255);
}

const STAR_COLOUR: Record<string, number> = { F: 0xf4f6ff, G: 0xfff1d0, K: 0xffd4a0, M: 0xffab80 };

export interface SkyStyle {
  zenith: number;
  horizon: number;
  fog: number;
  starColour: number;
  /** 0..1 perceptual brightness (light^0.22): dim star → dim scene without going black. */
  brightness: number;
  sunIntensity: number;
  ambientIntensity: number;
  /** Apparent angular size of the star relative to the Sun from Earth (∝ √light for the same star). */
  starSize: number;
  /** Fog distances as fractions of the patch size. */
  fogNearFrac: number;
  fogFarFrac: number;
}

export function skyStyle(starType: string, light: number, pressureBar: number, temperatureC: number): SkyStyle {
  const L = Math.max(1e-4, light);
  const brightness = clamp01(Math.pow(L, 0.22));
  const cold = clamp01((15 - temperatureC) / 180);
  // Red World white sky, turning to the silicon violet-lilac as the world gets colder.
  const C = LOOK_PALETTES.carbon, S = LOOK_PALETTES.silicon;
  const zenith = mixHex(C.skyZenith, S.skyZenith, cold);
  const horizon = mixHex(C.skyHorizon, S.skyHorizon, cold);
  // Thicker air hazes the horizon toward the lilac haze (log scale around 1 bar).
  const haze = clamp01(Math.log10(Math.max(0.05, pressureBar)) * 0.6);
  const horizonHazed = mixHex(horizon, mixHex(C.haze, S.haze, cold), haze * 0.5);
  const dim = 0.12 + 0.88 * brightness;
  const k = Math.pow(dim, 1 / 2.2);   // dim is a linear-light factor; hex colours are sRGB
  return {
    zenith: scaleHex(zenith, k),
    horizon: scaleHex(horizonHazed, k),
    fog: scaleHex(horizonHazed, k),
    starColour: STAR_COLOUR[starType[0]?.toUpperCase()] ?? STAR_COLOUR.G,
    brightness,
    sunIntensity: 3 * brightness,
    ambientIntensity: 0.4 + 0.4 * brightness,
    starSize: Math.sqrt(L),
    fogNearFrac: 0.2 / (1 + haze),
    fogFarFrac: 0.85 / (1 + 1.2 * haze),
  };
}

export interface SeaStyle {
  colour: number;
  opacity: number;
  roughness: number;
  /** Colour/tint the scene takes when the camera is below the surface. */
  underwater: number;
  underwaterFar: number;
  metalness: number;
}

/** Liquid or frozen, from the solvent: water is blue-teal, liquid nitrogen is clear and nearly colourless. */
export function seaStyle(solventName: string, frozen: boolean, solidSinks: boolean): SeaStyle {
  const nitrogen = /nitrogen/i.test(solventName);
  if (frozen) {
    const colour = nitrogen ? 0xe4ecf2 : 0xdcf0f8;
    return { colour, opacity: 1, roughness: nitrogen ? 0.5 : 0.25, underwater: colour, underwaterFar: 6, metalness: 0 };
  }
  if (nitrogen) {
    return { colour: 0xd8eaf4, opacity: 0.16, roughness: 0.05, underwater: 0x6a8aa8, underwaterFar: 90, metalness: 0 };
  }
  void solidSinks;
  return { colour: 0x2a86a0, opacity: 0.62, roughness: 0.08, underwater: 0x1b5f78, underwaterFar: 35, metalness: 0 };
}

/** Ground colour (Red World base ground): red on carbon, pale violet stone on silicon. Life is the plants' colour, so
 *  lifeBlend only deepens the ground slightly toward its shadow family (0..1). */
export function groundColour(comp: { c: number; si: number; o: number }, lifeBlend: number): number {
  const p = LOOK_PALETTES[comp.si > 0.5 ? 'silicon' : 'carbon'];
  return mixHex(p.red, p.crimson, 0.15 * clamp01(lifeBlend));
}

export type Tone = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Rotates a hex colour's hue by `deg` degrees (and shifts its lightness by `dl`), keeping saturation. */
export function shiftHue(hex: number, deg: number, dl = 0): number {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-9) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + deg + 360) % 360;
  const l = clamp01((mx + mn) / 2 + dl);
  const sat = d < 1e-9 ? 0 : d / (1 - Math.abs(2 * ((mx + mn) / 2) - 1) || 1);
  const c = (1 - Math.abs(2 * l - 1)) * clamp01(sat);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const q = (v: number) => Math.round(clamp01(v + m) * 255);
  return (q(rr) << 16) | (q(gg) << 8) | q(bb);
}

/**
 * Creature colour by chemistry and diet; tones: body, eye, plate, limb, horn, accent (bands, fins, crests), spot.
 * Base is the Red World palette: carbon grazers pale blush-bone and hunters dark maroon; silicon grazers ice-bone and
 * hunters violet. The lineage's `hue` (0..1) turns that base (±35° carbon, ±18° silicon) so related lineages share a
 * colour and strangers differ, and `accent` (0..1) picks how far the accent tone sits from the body. Silicon dot eyes take
 * the glow accent (dark world), carbon ring eyes are ink. Inputs come from the plan, never from a world id.
 */
export function creatureColour(silicon: boolean, diet: number, tone: Tone, hue = 0.5, accent = 0.5): number {
  const p = LOOK_PALETTES[silicon ? 'silicon' : 'carbon'];
  // silicon: deep indigo-violet bodies (darker hunters) that read against the pale-lilac ground (#50)
  const base = silicon
    ? mixHex(mixHex(p.maroon, p.crimson, 0.35), p.ink, 0.35 * clamp01(diet))
    : mixHex(mixHex(p.bone, p.blush, 0.5), p.maroon, clamp01(diet));
  const band = shiftHue(base, (hue - 0.5) * (silicon ? 36 : 70));
  switch (tone) {
    case 1: return silicon ? p.glow : p.ink;
    case 2: return scaleHex(band, 0.62);
    case 3: return scaleHex(band, 0.82);
    case 4: return mixHex(band, p.bone, 0.5);
    case 5: return silicon
      ? shiftHue(mixHex(p.bone, p.blush, 0.35 + 0.4 * clamp01(accent)), (hue - 0.5) * 36)   // pale ice rim
      : shiftHue(band, 25 + 55 * accent, -0.05);
    case 6: return mixHex(shiftHue(band, silicon ? 40 : 150, 0.05), 0xffffff, 0.35);
    default: return band;
  }
}

/** Plant value inverts with height (ART_DIRECTION rule 4): dark stems, pale tips that read against the white sky. */
export function floraColours(silicon: boolean, canopy: number): { stem: number; tip: number } {
  const p = LOOK_PALETTES[silicon ? 'silicon' : 'carbon'];
  return { stem: mixHex(p.maroon, p.crimson, 0.35), tip: mixHex(p.bone, p.blush, clamp01(canopy)) };
}

/** Everything the scene needs from a VisualInputs, in one place. */
export function styleFor(i: VisualInputs) {
  const t = i.stats.temperature ?? 15;
  return {
    sky: skyStyle(i.world.starType, i.light, i.stats.pressure ?? 1, t),
    sea: seaStyle(i.world.solvent.name, i.frozen, i.world.solvent.solidSinks),
  };
}

// ---- Red World look (docs/ART_DIRECTION.md). Keys are colour ROLES named after the carbon palette, so the reference
// code ports by swapping `PALETTE.x` for `pal.x`: on silicon `red` is still "the base ground", `glow` still "the accent".
export type LookKey =
  | 'skyZenith' | 'skyHorizon' | 'haze'
  | 'redLight' | 'red' | 'crimson' | 'maroon' | 'ink'
  | 'bone' | 'blush' | 'shadow' | 'glow' | 'glowDeep';
export type LookColours = Record<LookKey, number>;

/** Unmodulated palettes. Vertex colours and colorNodes on worldMaterial surfaces use these (the material applies the star). */
export const LOOK_PALETTES: Record<'carbon' | 'silicon', LookColours> = {
  // Red World exactly (mockups/red-world/src/contracts.ts PALETTE, lilac haze pick).
  carbon: {
    skyZenith: 0xeef0f4, skyHorizon: 0xf3eef8, haze: 0xe4daef,
    redLight: 0xff5a36, red: 0xe8331f, crimson: 0xa8122a, maroon: 0x5c0a1e, ink: 0x22060f,
    bone: 0xf4e6dc, blush: 0xf2a2a0, shadow: 0x5a1040, glow: 0x3ff5e0, glowDeep: 0x0f8f9a,
  },
  // Silicon: the same two-family structure turned cold, with the value order inverted so it reads apart at thumbnail
  // size: pale bone-lilac stone ground under a deeper violet-lilac sky (thick nitrogen air, distant star), indigo-ink
  // darks, ice-blue highlights, indigo shadow, and an ice-cyan accent (glow from darkness).
  silicon: {
    skyZenith: 0x6450b0, skyHorizon: 0xbca8ea, haze: 0xab98e2,
    redLight: 0xf4eefa, red: 0xd8c8ee, crimson: 0x7c5cc8, maroon: 0x3a2478, ink: 0x100828,
    bone: 0xf6f8ff, blush: 0x9fcff2, shadow: 0x2a2272, glow: 0x6ff4ff, glowDeep: 0x2f7fe0,
  },
};

/** Which look a world gets: from its body chemistry (as groundColour does), never its id. */
export function lookKind(comp: { si: number }): 'carbon' | 'silicon' {
  return comp.si > 0.5 ? 'silicon' : 'carbon';
}

export interface LookPalette extends LookColours {
  /** The unmodulated palette (for vertex colours / colorNodes that go through worldMaterial). */
  base: LookColours;
  kind: 'carbon' | 'silicon';
  /** skyStyle brightness, light^0.22. */
  brightness: number;
  /** Scene dimming 0.12..1 from brightness (as skyStyle). Lit and shadow terms are multiplied by it. */
  dim: number;
  /** Star tint relative to a G star (G → white), multiplied into the key light. Hex. */
  starTint: number;
  /** 0..~1 extra air from pressure (as skyStyle): thicker air shortens the fog. */
  airHaze: number;
}

/** Per-channel ratio a/b as a hex (clamped to 255). */
function ratioHex(a: number, b: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 255, y = Math.max(1, (b >> s) & 255);
    return Math.max(0, Math.min(255, Math.round((255 * x) / y)));
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * The active Red World palette modulated by the star (skyStyle): dimmed by brightness and tinted by the star's colour
 * relative to a G star. Carbon under a G star at light 1 is the reference palette exactly. Glow is emissive, so it is
 * never dimmed: on a dim world it dominates, which is honest (glow from darkness).
 */
export function lookPalette(i: Pick<VisualInputs, 'world' | 'light' | 'stats'>): LookPalette {
  const kind = lookKind(i.world.composition);
  const base = LOOK_PALETTES[kind];
  const st = skyStyle(i.world.starType, i.light, i.stats.pressure ?? 1, i.stats.temperature ?? 15);
  const dim = 0.12 + 0.88 * st.brightness;
  const starTint = ratioHex(st.starColour, STAR_COLOUR.G);
  const k = Math.pow(dim, 1 / 2.2);   // dim is linear light (as the material applies it); hexes are sRGB
  const tint = (hex: number) => {
    const t = scaleHex(hex, k);
    const r = Math.round((((t >> 16) & 255) * ((starTint >> 16) & 255)) / 255);
    const g = Math.round((((t >> 8) & 255) * ((starTint >> 8) & 255)) / 255);
    const b = Math.round(((t & 255) * (starTint & 255)) / 255);
    return (r << 16) | (g << 8) | b;
  };
  const out = { base, kind, brightness: st.brightness, dim, starTint, airHaze: clamp01(Math.log10(Math.max(0.05, i.stats.pressure ?? 1)) * 0.6) } as LookPalette;
  for (const k of Object.keys(base) as LookKey[]) out[k] = k === 'glow' || k === 'glowDeep' ? base[k] : tint(base[k]);
  return out;
}
