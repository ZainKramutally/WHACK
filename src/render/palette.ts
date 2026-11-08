// Functional colour and lighting choices, as pure functions of the stats (never of a world id), so visuals cannot
// contradict the numbers. Hex ints. The art team's look replaces this file's outputs, not the callers.
import type { VisualInputs } from '../worlds/types';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Clamp to 0..1; NaN → 0, so a bad gene degrades to a colour instead of an out-of-range table index. */
const clamp01 = (v: number) => (v > 0 ? (v < 1 ? v : 1) : 0);

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

/** Air colours from the rock under the world (crustLook.crustRock): replaces the fixed per-world haze and horizon. */
export interface AirTint { haze: number; horizon: number }

export function skyStyle(starType: string, light: number, pressureBar: number, temperatureC: number, air?: AirTint): SkyStyle {
  const L = Math.max(1e-4, light);
  const brightness = clamp01(Math.pow(L, 0.22));
  const cold = clamp01((15 - temperatureC) / 180);
  // Red World white sky, turning to the silicon violet-lilac as the world gets colder.
  const C = LOOK_PALETTES.carbon, S = LOOK_PALETTES.silicon;
  const zenith0 = mixHex(C.skyZenith, S.skyZenith, cold);
  const zenith = air ? labMix(zenith0, air.haze, 0.12) : zenith0;   // physical sky, only breathed on by the haze
  const horizon = air ? air.horizon : mixHex(C.skyHorizon, S.skyHorizon, cold);
  // Thicker air hazes the horizon toward the lilac haze (log scale around 1 bar).
  const haze = clamp01(Math.log10(Math.max(0.05, pressureBar)) * 0.6);
  const horizonHazed = mixHex(horizon, air ? air.haze : mixHex(C.haze, S.haze, cold), haze * 0.5);
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

// Liquid water's own colour. Water absorbs red light (its O–H stretch overtones), so deep water reads blue and shallow
// water cyan-blue (Braun & Smirnov 1993, "Why is water blue?", J. Chem. Educ. 70:612). The open sea comes from this ramp,
// never from the rock roles; minerals reach it only through the seabed showing in the shallows and a small body nudge.
export const WATER = { navy: 0x0b2a5c, ocean: 0x1670b8, cyan: 0x38b4d8 } as const;
/** Largest share of the open sea's body colour the crust may move (owner brief: ≤ 15%). */
export const WATER_NUDGE_MAX = 0.12;
/** The open sea's body colour at mid depth, nudged a little towards `nudge` (a crust-derived water hue) when given. */
export function waterBody(nudge?: number): number {
  const base = labMix(WATER.navy, WATER.ocean, 0.6);
  return nudge === undefined ? base : labMix(base, nudge, WATER_NUDGE_MAX);
}
/** Shallows colour at `depth` metres: the seabed tint where the water is thin (Beer–Lambert-style e-fold of 2 m, capped at 80%), the water ramp below. */
export function waterAtDepth(depth: number, seabed?: number, nudge?: number): number {
  const d = Math.max(0, depth);
  const ramp = labMix(labMix(WATER.cyan, WATER.ocean, 1 - Math.exp(-d / 5)), waterBody(nudge), 1 - Math.exp(-d / 14));
  const deep = labMix(ramp, WATER.navy, 0.5 * (1 - Math.exp(-d / 40)));
  return seabed === undefined ? deep : labMix(deep, seabed, 0.8 * Math.exp(-d / 2));
}

/** Liquid or frozen, from the solvent: water is blue-teal, liquid nitrogen is clear and nearly colourless. */
export function seaStyle(solventName: string, frozen: boolean, solidSinks: boolean, shallows?: number, nudge?: number): SeaStyle {
  const nitrogen = /nitrogen/i.test(solventName);
  if (frozen) {
    const colour = nitrogen ? 0xe4ecf2 : 0xdcf0f8;
    return { colour, opacity: 1, roughness: nitrogen ? 0.5 : 0.25, underwater: colour, underwaterFar: 6, metalness: 0 };
  }
  if (nitrogen) {
    return { colour: 0xd8eaf4, opacity: 0.16, roughness: 0.05, underwater: 0x6a8aa8, underwaterFar: 90, metalness: 0 };
  }
  void solidSinks;
  // underwater: the water's own deep blue (the camera is inside the water, not looking at the seabed), nudged by the crust
  return { colour: shallows ?? WATER.cyan, opacity: 0.62, roughness: 0.08, underwater: scaleHex(waterBody(nudge), 0.8), underwaterFar: 35, metalness: 0 };
}

/** Ground colour (Red World base ground): red on carbon, pale violet stone on silicon. Life is the plants' colour, so
 *  lifeBlend only deepens the ground slightly toward its shadow family (0..1). */
export function groundColour(comp: { c: number; si: number; o: number }, lifeBlend: number): number {
  const p = LOOK_PALETTES[comp.si > 0.5 ? 'silicon' : 'carbon'];
  return mixHex(p.red, p.crimson, 0.15 * clamp01(lifeBlend));
}

export type Tone = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Bead tone → the tone the world draws it in (fauna.ts): plates and limbs wear the body colour, horns and spots the
 *  accent, so every view of a creature shows the world's one body colour + one accent. */
export const WORLD_TONE: readonly Tone[] = [0, 1, 0, 0, 5, 5, 5];

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

// ---- Creature colour (#57; fauna, the inspect view and the bestiary sprite) ---------------------------------------------
// Colour is a strong species axis: each species' `hue` (0..1) picks a place on a wide ring of saturated, mid-value body
// colours, and its diet slides that place and the value (grazers light and cool, hunters dark and warm). Worked in OKLab
// (Ottosson 2020), so equal steps look equal and lightness can be held against the ground and the sky.
//   carbon ring:  orchid pink → violet → periwinkle → slate → sage → leaf green → maize → amber → orange. It never
//     passes pure red (it would vanish into the red ground) or the cyan glow hue (reserved for bioluminescence).
//     Grazers sit lighter than the red ground (OKLab L ≈ 0.61) and darker than the white sky; hunters sit darker than
//     the ground.
//   silicon ring: glassy blue → cobalt → indigo → violet → plum, all dark against the pale-lilac ground (L ≈ 0.84);
//     the fauna material adds a pale fresnel rim, and the dot eyes are the cyan glow.
// One accent per species, picked by `accent`: carbon a deep tone of the body (flips light on dark bodies), pale bone (Red
// World maroon on light bodies), or a contrasting ring hue; silicon a pale ice (white, ice blue or lilac). It colours the pattern (bands or spots), fins,
// crests and horns. Inputs come from the plan (or the species look attractor), never from a world id.
export type Lab = [number, number, number];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function hexToLab(hex: number): Lab {
  const r = toLin(((hex >> 16) & 255) / 255), g = toLin(((hex >> 8) & 255) / 255), b = toLin((hex & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q,
  ];
}

/** OKLab → hex. Out-of-gamut colours lose chroma (hue and lightness kept) until they fit. */
export function labToHex(L: number, A: number, B: number): number {
  let r = 0, g = 0, b = 0;
  for (let k = 0; k < 10; k++) {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const q = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q;
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q;
    b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * q;
    if (r >= -1e-4 && g >= -1e-4 && b >= -1e-4 && r <= 1.0001 && g <= 1.0001 && b <= 1.0001) break;
    A *= 0.82; B *= 0.82;
  }
  const e = (c: number) => Math.round(clamp01(toSrgb(clamp01(c))) * 255);
  return (e(r) << 16) | (e(g) << 8) | e(b);
}

/** OKLCH anchors [L, C, hue°] along each chemistry's ring, interpolated in OKLab. */
// Carbon passes from slate to sage through a muted pewter, so no blend lands on the glow's cyan (OKLab hue ≈ 183°).
const RING: Record<'carbon' | 'silicon', Lab[]> = {
  carbon: [
    [0.76, 0.1, 345], [0.67, 0.12, 305], [0.69, 0.1, 275], [0.67, 0.07, 248], [0.7, 0.03, 205],
    [0.73, 0.1, 148], [0.76, 0.125, 128], [0.8, 0.13, 96], [0.75, 0.14, 72], [0.71, 0.15, 56],
  ],
  silicon: [[0.58, 0.1, 235], [0.55, 0.12, 255], [0.51, 0.14, 275], [0.5, 0.15, 295], [0.52, 0.14, 318], [0.55, 0.12, 340]],
};
const RING_LAB: Record<'carbon' | 'silicon', Lab[]> = {
  carbon: RING.carbon.map(lchToLab), silicon: RING.silicon.map(lchToLab),
};
function lchToLab([L, C, h]: Lab): Lab {
  const r = (h * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
}
function ringAt(kind: 'carbon' | 'silicon', p: number): Lab {
  const a = RING_LAB[kind], x = clamp01(p) * (a.length - 1), i = Math.min(a.length - 2, Math.floor(x)), t = x - i;
  return [lerp(a[i][0], a[i + 1][0], t), lerp(a[i][1], a[i + 1][1], t), lerp(a[i][2], a[i + 1][2], t)];
}
const smooth01 = (e0: number, e1: number, x: number) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const SI_ICE: Lab[] = [0xf6f8ff, 0xb9dcf6, 0xdccbff].map(hexToLab); // silicon accents: ice white, ice blue, pale lilac

/** A species' place (0..1) on its chemistry's colour ring: hue spreads species, diet slides it (grazers → hunters). */
export function creatureRing(silicon: boolean, diet: number, hue: number): number {
  const k = silicon ? 0.8 : 0.62; // silicon's ring is narrower, so hue keeps more of it
  return clamp01(k * clamp01(hue) + (1 - k) * smooth01(0.2, 0.8, diet));
}

/** The species' body colour in OKLab and its place on the ring: hunters sit darker (below the ground) and richer. */
function creatureBody(silicon: boolean, diet: number, hue: number): { lab: Lab; p: number } {
  const w = smooth01(0.2, 0.8, diet); // 0 grazer … 1 hunter
  const p = creatureRing(silicon, diet, hue);
  const [L, A, B] = ringAt(silicon ? 'silicon' : 'carbon', p);
  const dl = silicon ? -0.08 * w : 0.04 * (1 - w) - 0.24 * w;
  const k = silicon ? 0.95 + 0.2 * w : 1.1 + 0.15 * w; // carbon: cel shadows hide half the body, so the lit half carries more chroma
  return { lab: [Math.min(0.82, L + dl), A * k, B * k], p };
}

/**
 * Creature colour by chemistry, diet and the species' hue and accent (each 0..1); tones: body, eye, plate, limb, horn,
 * accent (bands, fins, crests), spot. Plates and limbs are the body a little deeper; horns and spots wear the accent.
 * Carbon eyes are ink; silicon's dot eyes are the cyan glow.
 */
export function creatureColour(silicon: boolean, diet: number, tone: Tone, hue = 0.5, accent = 0.5): number {
  const pal = LOOK_PALETTES[silicon ? 'silicon' : 'carbon'];
  if (tone === 1) return silicon ? pal.glow : pal.ink;
  const { lab: [L, A, B], p } = creatureBody(silicon, diet, hue);
  if (tone === 0) return labToHex(L, A, B);
  if (tone === 2) return labToHex(L - 0.08, A * 1.05, B * 1.05);
  if (tone === 3) return labToHex(L - 0.04, A, B);
  // the accent (tones 4, 5, 6)
  const a = clamp01(accent);
  if (silicon) {
    const t = a * (SI_ICE.length - 1), i = Math.min(SI_ICE.length - 2, Math.floor(t)), f = t - i;
    const [l0, a0, b0] = SI_ICE[i], [l1, a1, b1] = SI_ICE[i + 1];
    return labToHex(lerp(l0, l1, f), lerp(a0, a1, f), lerp(b0, b1, f));
  }
  if (a < 1 / 3) { // a deep tone of the body hue, or a light one on a dark body
    const dark = L >= 0.55;
    return labToHex(dark ? L - 0.3 : Math.min(0.9, L + 0.32), A * (dark ? 0.85 : 0.6), B * (dark ? 0.85 : 0.6));
  }
  if (a < 2 / 3) { // pale bone with a breath of the body hue; on a light body, Red World maroon instead
    const [bl, ba, bb] = hexToLab(L > 0.68 ? pal.maroon : pal.bone);
    return labToHex(lerp(L, bl, 0.82), lerp(A, ba, 0.82), lerp(B, bb, 0.82));
  }
  // a contrasting hue from the far side of the ring, pushed away from the body's value
  const [cl, ca, cb] = ringAt('carbon', (p + 0.5) % 1);
  void cl;
  return labToHex(L >= 0.6 ? L - 0.2 : L + 0.22, ca, cb);
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

/** The roles that mean rock or air; the crust look fills them. */
export type RockLook = Pick<LookColours, 'redLight' | 'red' | 'crimson' | 'maroon' | 'shadow' | 'haze' | 'skyHorizon'>;

/** Mix two hexes in OKLab (perceptual). */
export function labMix(a: number, b: number, t: number): number {
  const x = hexToLab(a), y = hexToLab(b);
  return labToHex(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t));
}

export interface LookPalette extends LookColours {
  /** The unmodulated palette (for vertex colours / colorNodes that go through worldMaterial). */
  base: LookColours;
  kind: 'carbon' | 'silicon';
  /** True when the rock/air roles come from the crust (crustLook) rather than the fixed per-world palette. */
  crust: boolean;
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
export function lookPalette(i: Pick<VisualInputs, 'world' | 'light' | 'stats'>, rock?: RockLook): LookPalette {
  const kind = lookKind(i.world.composition);
  const fixed = LOOK_PALETTES[kind];
  // With a crust look the rock-and-air roles follow the minerals; ink, bone, blush and the glows stay the world's own.
  const base: LookColours = rock
    ? { ...fixed, ...rock, skyZenith: labMix(fixed.skyZenith, rock.haze, 0.12) }
    : fixed;
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
  const out = { base, kind, crust: !!rock, brightness: st.brightness, dim, starTint, airHaze: clamp01(Math.log10(Math.max(0.05, i.stats.pressure ?? 1)) * 0.6) } as LookPalette;
  for (const k of Object.keys(base) as LookKey[]) out[k] = k === 'glow' || k === 'glowDeep' ? base[k] : tint(base[k]);
  return out;
}
