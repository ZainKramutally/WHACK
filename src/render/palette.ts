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
  // Warm daylight to cold blue-violet as the world gets colder.
  const zenith = mixHex(0x4f94d8, 0x4a58b8, cold);
  const horizon = mixHex(0xcfe6ef, 0x8fa4d8, cold);
  // Thicker air hazes the horizon (log scale around 1 bar).
  const haze = clamp01(Math.log10(Math.max(0.05, pressureBar)) * 0.6);
  const horizonHazed = mixHex(horizon, 0xe6edf5, haze * 0.5);
  const dim = 0.12 + 0.88 * brightness;
  return {
    zenith: scaleHex(zenith, dim * 0.8),
    horizon: scaleHex(horizonHazed, dim),
    fog: scaleHex(horizonHazed, dim),
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

/** Ground colour: bare rock; carbon ground greens as life reaches land (lifeBlend 0..1). */
export function groundColour(comp: { c: number; si: number; o: number }, lifeBlend: number): number {
  const silicon = comp.si > 0.5;
  if (silicon) return 0x6e7388;                       // water-ice bedrock and silicate rock, blue-grey
  return mixHex(0x8a7960, 0x5b7d3d, clamp01(lifeBlend)); // bare rock → vegetated
}

export type Tone = 0 | 1 | 2 | 3 | 4;

/** Creature colour by chemistry and diet; tones: body, eye, plate, limb, horn. */
export function creatureColour(silicon: boolean, diet: number, tone: Tone): number {
  const base = silicon
    ? mixHex(0xd6ecff, 0xe0b8ff, clamp01(diet))      // glassy blue → violet hunters
    : mixHex(0xc4ee4a, 0xff8a2c, clamp01(diet));     // green grazers → orange hunters
  switch (tone) {
    case 1: return silicon ? 0xfaffff : 0x161616;
    case 2: return scaleHex(base, 0.62);
    case 3: return scaleHex(base, 0.82);
    case 4: return mixHex(base, 0xf0f0e0, 0.5);
    default: return base;
  }
}

export function floraColours(silicon: boolean, canopy: number): { stem: number; tip: number } {
  if (silicon) return { stem: 0xa8c8dc, tip: mixHex(0xdff4ff, 0xc9b6ff, clamp01(canopy)) };
  return { stem: 0x4f8f3a, tip: mixHex(0x9bd25a, 0xe6c34a, clamp01(canopy)) };
}

/** Everything the scene needs from a VisualInputs, in one place. */
export function styleFor(i: VisualInputs) {
  const t = i.stats.temperature ?? 15;
  return {
    sky: skyStyle(i.world.starType, i.light, i.stats.pressure ?? 1, t),
    sea: seaStyle(i.world.solvent.name, i.frozen, i.world.solvent.solidSinks),
  };
}
