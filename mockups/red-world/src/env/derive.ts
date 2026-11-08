// environmentFrom(soup): the primordial soup the player sets up → the look of the world. Pure and deterministic
// (no three.js, no DOM, no randomness), so it ports to the app's src/render/palette.ts lookPalette(inputs) later.
//
// Derivation, not presets: the soup is turned into a handful of continuous chemistry drivers (oxidation, humidity, heat,
// frost, air thickness, dimness, near-critical opalescence). Each palette role is an OKLab mix of real materials
// (minerals, aerosols, pigments) weighted by those drivers. The named environments in NAMED are only sample points.
// Everything moves continuously with the sliders; the only steps are phase changes (`frozen`) and the element choice.
// Rationale and science tags per material: docs/features/environments.md.
import { PALETTE_KEYS, RED_WORLD, mixLab, mix2, lch, fromLch, type Palette, type PaletteKey } from './palette';

export interface Soup {
  element: 'carbon' | 'silicon';
  temperatureC: number;
  nitrogenX: number;   // × Earth's nitrogen per m² (the Nitrogen slider)
  oxygenPct: number;   // % free O₂ (the Oxygen slider)
  light: number;       // starlight at the surface, × Earth's (1 = Sun at 1 AU, 0.01 = the silicon world)
  frozen: boolean;     // solvent below its freezing point (VisualInputs.frozen)
  seaCover: number;    // 0..1 fraction of the patch under sea
}

/** The continuous chemistry drivers, 0..1 unless noted. Exposed for the doc, tests and the debug overlay. */
export interface Drivers {
  si: number;          // 1 on silicon
  ox: number;          // free-oxygen oxidation of the ground
  wet: number;         // humidity: solvent vapour in the air (carbon: water vapour pressure × sea)
  heat: number;        // hot side (carbon 35 → 105 °C)
  frost: number;       // cold side: frost/ice cover of the ground
  pressureBar: number; // surface pressure (carbon: N₂ + O₂ + H₂O partials; silicon: N₂ vapour pressure)
  thick: number;       // air thickness, log scale (1 bar → 0, 60 bar → 1)
  dim: number;         // dimness, log scale (light 1 → 0, 0.01 → 1)
  crit: number;        // silicon: approach to nitrogen's critical point (−147 °C), critical opalescence
}

export interface Environment {
  palette: Palette;
  fog: { density: number; hazeAmount: number; startScale: number };
  sky: {
    /** Per moon (large, small): 0 = hidden by the air, ~0.8 = clear. Continuous; `moons` counts the visible ones. */
    moonStrength: [number, number];
    moons: number;
    moonTint: number;
  };
  light: { sun: number; intensity: number; shadowMix: number };
  ground: {
    rock: { light: number; base: number; shade: number }; // bedrock under any frost (steep faces show it)
    sheen: number;     // metallic specular glints (specular hematite / silicide)
    banding: number;   // banded iron formation stripes on landforms
    crust: number;     // crystal crust clusters (silicon nitride; silica sinter on hot carbon)
    deadBands: number; // pale rings just above the shore: crust left by a falling sea (silicon), sinter terraces (hot carbon)
    ice: number;       // snow/frost on up-facing surfaces
    relicIce: number;  // landform arches are water-ice bedrock (silicon)
    cracks: number;    // polygonal crack strength on dry/frozen beds
    prismatic: number; // hot-spring pigment rings around pools (carbon, hot)
  };
  sea: { cover: number; shallow: number; deep: number; clarityM: number; frozen: boolean; ice: number; gloss: number };
  flora: { tint: number; tintAmount: number; facet: number; heightScale: number; lanternBias: number; sway: number };
  glow: { strength: number };
  drivers: Drivers;
  /** One plain sentence: the dominant chemistry behind the colours. */
  rationale: string;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Water vapour pressure over liquid water, bar (Magnus–Tetens; good to ~1% for −40..100 °C, extrapolated beyond). */
export const waterVapourBar = (tC: number) => 0.0061094 * Math.exp((17.625 * tC) / (tC + 243.04));
/** N₂ vapour pressure, bar: Clausius–Clapeyron through the normal boiling point (77.35 K, 1.013 bar) and the critical
 *  point (126.2 K, 33.9 bar) (NIST); gives 3.6 bar at −183 °C as CLAUDE.md states. */
export const n2VapourBar = (tC: number) => Math.exp(9.082 - 701.5 / Math.max(40, tC + 273.15));

export function driversFrom(s: Soup): Drivers {
  const si = s.element === 'silicon' ? 1 : 0;
  const T = s.temperatureC, O = Math.max(0, s.oxygenPct), N = Math.max(0.001, s.nitrogenX);
  // carbon: ferric oxides need free O₂ (Great Oxidation ~2.4 Ga, rust from a few %); silicon: any trace turns it to silica
  const ox = si ? smoothstep(0.05, 3, O) : smoothstep(0.5, 12, O);
  const pH2O = si ? 0 : waterVapourBar(Math.min(T, 125));
  const pressureBar = si ? Math.min(33.9, n2VapourBar(Math.min(T, -147))) : 0.79 * N + O / 100 + pH2O * (0.3 + 0.7 * s.seaCover);
  const wet = si ? 0 : clamp01((Math.log10(Math.max(1e-4, pH2O)) + 1.8) / 1.5) * (0.4 + 0.6 * clamp01(s.seaCover));
  const heat = si ? 0 : smoothstep(35, 105, T);
  const frost = si ? smoothstep(-200, -214, T) : smoothstep(6, -32, T);
  const thick = clamp01(Math.log10(Math.max(1, pressureBar)) / Math.log10(60));
  const dim = clamp01(-Math.log10(Math.max(1e-4, s.light)) / 2);
  const crit = si * smoothstep(-172, -149, T);
  return { si, ox, wet, heat, frost, pressureBar, thick, dim, crit };
}

// ---- materials. Ground ramp keys: redLight (sunlit) → red (base) → crimson (shade) → maroon (crevice) → ink, + shadow.
type GroundKeys = 'redLight' | 'red' | 'crimson' | 'maroon' | 'ink' | 'shadow';
type Ramp = Record<GroundKeys, number>;
const R = (redLight: number, red: number, crimson: number, maroon: number, ink: number, shadow: number): Ramp =>
  ({ redLight, red, crimson, maroon, ink, shadow });

/** Ground minerals. Shadows are always the cool complement-side tint (never grey), as in the Red World. */
export const MINERALS = {
  hematite: R(0xff5a36, 0xe8331f, 0xa8122a, 0x5c0a1e, 0x22060f, 0x5a1040),   // Fe₂O₃, dry + oxidised [sci]
  goethite: R(0xf6a640, 0xd8781c, 0x9a4416, 0x52200e, 0x1e0b05, 0x4a1c4c),   // FeO(OH), wet + oxidised: ochre [sci]
  ferrous: R(0xc2cc94, 0x8fa06c, 0x5c7254, 0x2e3e36, 0x0e1612, 0x4a1a52),    // green rust / greenalite, reducing [sci]
  basalt: R(0x8a7a6c, 0x5a4c44, 0x38302e, 0x1e1a1c, 0x0a0809, 0x24203e),     // wet dark rock of a steam world [sci]
  snow: R(0xfafcfe, 0xdfe9f4, 0x9bb6da, 0x4a68a4, 0x121c40, 0x3456a8),       // H₂O ice: blue shadows (ice absorbs red) [sci]
  nitride: R(0xf4eefa, 0xd8c8ee, 0x7c5cc8, 0x3a2478, 0x100828, 0x2a2272),    // Si₃N₄ / silicide crust under violet skylight [speculative]
  silica: R(0xe8e4de, 0xc6c0b8, 0x8a8480, 0x4a4648, 0x18161a, 0x3a3a54),     // SiO₂: silicon + oxygen = rock [sci]
  opal: R(0xfdf2f4, 0xecd4de, 0xb48aaa, 0x5e3e70, 0x1c1028, 0x4a2c74),       // pearly crust in opalescent air [speculative]
  n2frost: R(0xf2f6ff, 0xd8e0f8, 0x96a6dc, 0x46508e, 0x101438, 0x283088),     // N₂ ice below −210 °C [sci]
} as const;

type SkyKeys = 'skyZenith' | 'skyHorizon' | 'haze';
const S = (skyZenith: number, skyHorizon: number, haze: number) => ({ skyZenith, skyHorizon, haze });
/** Air: aerosols and gases. */
export const AIRS = {
  aerosol: S(0xeef0f4, 0xf3eef8, 0xe4daef),  // bright sulfate/dust aerosol: Mie scattering is grey → white sky [sci mechanism, game choice]
  tholin: S(0xe9b07c, 0xf8dcb0, 0xf0c08e),   // methane photochemical haze, Archean "orange haze" (Arney 2016) [sci]
  steam: S(0xe2e6e0, 0xf4f2e6, 0xe8e4d2),    // water-vapour cloud deck of a hot humid world [sci]
  frost: S(0xc4d8f0, 0xeef4fa, 0xdce8f4),    // cold dry air: little vapour, Rayleigh blue shows [sci]
  deep: S(0xeaa088, 0xf8d2b8, 0xf2baa0),     // tens of bar: Rayleigh strips blue from the sunlight (Venus surface) [sci]
  rayleighN2: S(0x2c1f6e, 0xb09ce4, 0x9a86d6), // 3.6 bar N₂ under a dim star: violet skylight [sci] pushed to lilac [game]
  opalescent: S(0xb8a6d8, 0xf2e6f2, 0xe8d8ec), // near-critical N₂: density fluctuations scatter all colours (critical opalescence) [sci]
} as const;

type FloraKeys = 'bone' | 'blush';
const F = (bone: number, blush: number, tint: number, amount: number) => ({ bone, blush, tint, amount });
/** Plant pigments. */
export const PIGMENTS = {
  redPigment: F(0xf4e6dc, 0xf2a2a0, 0xa8122a, 0),    // the Red World's crimson/bone flora (carotenoid/anthocyanin reds) [game]
  retinal: F(0xeadcf6, 0xc08ade, 0x8a3cb0, 0.55),   // retinal phototrophs absorb green → purple ("Purple Earth", DasSarma 2018) [speculative]
  snowAlgae: F(0xfcf4f6, 0xf6a2bc, 0xe0507a, 0.45), // astaxanthin "watermelon snow" algae [sci]
  thermophile: F(0xfaecd0, 0xf4b25c, 0xe8781c, 0.6), // carotenoid mats of hot springs (Yellowstone) [sci]
  crystal: F(0xf6f8ff, 0x9fcff2, 0xbfd8ff, 0.25),   // pigment-free crystal tissue: pale by scattering [speculative]
  dark: F(0xb8aec0, 0x6a5878, 0x2a2034, 0.5),      // dim-light phototrophs absorb everything → near-black (Kiang 2007) [speculative]
} as const;

/** Sea colours by solvent and chemistry: [shallow, deep, clarity m]. Water absorbs red → teal-blue [sci]. */
const WATERS = {
  oxic: [0x3ab8c8, 0x0b4a6a, 9],      // oxygenated water [sci]
  ferrous: [0x4e9a76, 0x143e34, 7],   // Fe(II)-rich Archean ocean reads green (Matsuo 2025) [sci]
  hot: [0xbaf0e0, 0x2aa0b0, 14],      // silica-rich hot spring: milky turquoise [sci]
  n2: [0xeef2ff, 0xb8c2ee, 60],       // liquid N₂: clear and colourless [sci]; tinted by the violet sky [game]
} as const;

// glow: the accent is the ground's complement. Calibrated so hematite gives exactly the Red World cyan.
const G0 = lch(RED_WORLD.glow), GD0 = lch(RED_WORLD.glowDeep), H0 = lch(MINERALS.hematite.red);
function glowFor(groundRed: number): [number, number] {
  const h = lch(groundRed).h;
  return [fromLch(G0.L, G0.C, h + (G0.h - H0.h)), fromLch(GD0.L, GD0.C, h + (GD0.h - H0.h))];
}
const MINERAL_GLOW = Object.fromEntries(Object.entries(MINERALS).map(([k, r]) => [k, glowFor(r.red)])) as Record<keyof typeof MINERALS, [number, number]>;

type Weights<K extends string> = Record<K, number>;

export function mineralWeights(d: Drivers, s: Soup): Weights<keyof typeof MINERALS> {
  const c = 1 - d.si;
  const bare = 1 - d.frost;
  return {
    hematite: c * bare * d.ox * (1 - d.wet * 0.85),
    goethite: c * bare * d.ox * d.wet * 0.85 * (1 - d.heat * 0.6),
    ferrous: c * bare * (1 - d.ox),
    basalt: c * bare * d.heat * d.wet * 1.4,
    snow: c * d.frost * (s.frozen ? 1.25 : 1),
    nitride: d.si * (1 - d.ox) * (1 - d.crit) * bare,
    silica: d.si * d.ox,
    opal: d.si * (1 - d.ox) * d.crit * 1.2 * bare,
    n2frost: d.si * d.frost,
  };
}

export function airWeights(d: Drivers): Weights<keyof typeof AIRS> {
  const c = 1 - d.si;
  return {
    aerosol: c * d.ox * (1 - d.frost) * (1 - d.heat) * (1 - d.thick),
    tholin: c * (1 - d.ox) * (1 - d.frost * 0.5),
    steam: c * d.heat * 1.6,
    frost: c * d.frost * 1.3,
    deep: c * d.thick * 2.2,
    rayleighN2: d.si * (1 - d.crit),
    opalescent: d.si * d.crit * 1.3,
  };
}

export function pigmentWeights(d: Drivers): Weights<keyof typeof PIGMENTS> {
  const c = 1 - d.si;
  return {
    redPigment: c * d.ox * (1 - d.frost) * (1 - d.heat),
    retinal: c * (1 - d.ox) * (1 - d.heat * 0.5),
    snowAlgae: c * d.frost * 1.2,
    thermophile: c * d.heat * 1.5,
    crystal: d.si,
    dark: c * d.dim * 1.5,
  };
}

function mixRole<T extends Record<string, Record<string, number>>, K extends string>(table: T, w: Record<string, number>, key: K): number {
  return mixLab(Object.entries(table).map(([n, v]) => [v[key], w[n] ?? 0]));
}

const top = (w: Record<string, number>) => Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];

const GROUND_WHY: Record<string, string> = {
  hematite: 'free O₂ rusts iron to hematite: red ground with metallic specular crusts and banded iron',
  goethite: 'wet oxidised iron hydrates to ochre goethite',
  ferrous: 'no free O₂, so iron stays ferrous: green-grey ground',
  basalt: 'hot rain darkens bare basalt',
  snow: 'water ice and snow cover the ground; ice absorbs red, so shadows go blue',
  nitride: 'oxygen-free silicon makes nitride and silicide crusts, lit violet by a dim star',
  silica: 'free oxygen locks silicon into grey silica rock',
  opal: 'shrinking seas leave pale crust bands',
  n2frost: 'the nitrogen seas freeze to white N₂ ice',
};
const AIR_WHY: Record<string, string> = {
  aerosol: 'bright aerosol whitens the sky',
  tholin: 'methane haze turns the sky orange',
  steam: 'a steam deck hangs in the air',
  frost: 'dry cold air shows a thin blue sky',
  deep: 'tens of bar of air redden the sunlight',
  rayleighN2: '3.6 bar of nitrogen scatters a violet sky',
  opalescent: 'near its critical point the nitrogen air turns milky (critical opalescence)',
};

export function environmentFrom(soup: Soup): Environment {
  const d = driversFrom(soup);
  const wM = mineralWeights(d, soup), wA = airWeights(d), wP = pigmentWeights(d);
  const p = {} as Palette;
  for (const k of ['redLight', 'red', 'crimson', 'maroon', 'ink', 'shadow'] as const) p[k] = mixRole(MINERALS, wM, k);
  for (const k of ['skyZenith', 'skyHorizon', 'haze'] as const) p[k] = mixRole(AIRS, wA, k);
  for (const k of ['bone', 'blush'] as const) p[k] = mixRole(PIGMENTS, wP, k);
  p.glow = mixLab(Object.entries(MINERAL_GLOW).map(([n, g]) => [g[0], wM[n as keyof typeof MINERALS]]));
  p.glowDeep = mixLab(Object.entries(MINERAL_GLOW).map(([n, g]) => [g[1], wM[n as keyof typeof MINERALS]]));
  // dimness: the zenith darkens (value inversion on dim worlds); the horizon/haze keep most of their value so fog reads
  const zen = lch(p.skyZenith);
  p.skyZenith = fromLch(zen.L * (1 - 0.18 * d.dim * (1 - d.si)), zen.C, zen.h);
  // thick air pulls the horizon toward the haze (sky and fog meet seamlessly)
  p.skyHorizon = mix2(p.skyHorizon, p.haze, d.thick * 0.5 + d.crit * 0.3);

  const tintHex = mixLab(Object.entries(PIGMENTS).map(([n, v]) => [v.tint, wP[n as keyof typeof PIGMENTS]]));
  const wsum = Object.values(wP).reduce((a, b) => a + b, 0) || 1;
  const tintAmount = Object.entries(PIGMENTS).reduce((a, [n, v]) => a + v.amount * wP[n as keyof typeof PIGMENTS], 0) / wsum;

  // optical depth of the air: thick air, a steam deck and opalescence hide the moons (the small one first)
  const opacity = clamp01(Math.max(d.thick * 1.1, d.heat * d.wet * 1.2, d.crit * 0.9));
  const moonStrength: [number, number] = [0.78 * clamp01(1 - 1.25 * opacity), 0.82 * clamp01(1 - 2.2 * opacity)];
  const sun = mixLab([[0xfffcf7, (1 - d.si) * (1 - d.thick)], [0xffcf9a, (1 - d.si) * d.thick * 1.5], [0xe4e8ff, (1 - d.si) * d.frost],
    [0xd8d4ff, d.si * (1 - d.crit)], [0xffeef4, d.si * d.crit]]);

  const water: (readonly [number, number, number])[] = d.si ? [WATERS.n2] : [];
  const waterW: number[] = d.si ? [1] : [];
  if (!d.si) { water.push(WATERS.oxic, WATERS.ferrous, WATERS.hot); waterW.push(d.ox * (1 - d.heat), (1 - d.ox) * (1 - d.heat), d.heat * 1.5); }
  const seaShallow = mixLab(water.map((w, i) => [w[0], waterW[i]]));
  const seaDeep = mixLab(water.map((w, i) => [w[1], waterW[i]]));
  const clarity = water.reduce((a, w, i) => a + w[2] * waterW[i], 0) / (waterW.reduce((a, b) => a + b, 0) || 1);

  const facet = d.si;
  const rationale = `${GROUND_WHY[top(wM)]}; ${AIR_WHY[top(wA)]}.`.replace(/^./, (c) => c.toUpperCase());

  return {
    palette: p,
    fog: {
      density: 1 + 1.7 * d.thick + 1.6 * d.heat * d.wet + 0.6 * d.crit + 0.4 * d.si,
      hazeAmount: Math.min(0.85, 0.42 * (1 + 0.8 * d.thick + d.heat * d.wet + 0.7 * d.crit)),
      startScale: 1 / (1 + 0.6 * d.thick + 0.5 * d.heat * d.wet + 0.3 * d.crit),
    },
    sky: { moonStrength, moons: moonStrength.filter((m) => m > 0.05).length, moonTint: mix2(0xf4e6dc, sun, 0.35) },
    light: { sun, intensity: 1 - 0.38 * d.dim, shadowMix: lerp(0.86, 0.9, d.frost) },
    ground: {
      rock: (() => { const w = mineralWeights({ ...d, frost: 0 }, { ...soup, frozen: false });
        return { light: mixRole(MINERALS, w, 'redLight'), base: mixRole(MINERALS, w, 'red'), shade: mixRole(MINERALS, w, 'crimson') }; })(),
      sheen: (1 - d.si) * d.ox * (1 - d.wet * 0.6) * (1 - d.frost) + d.si * (1 - d.ox) * 0.55 * (1 - d.frost),
      // BIFs: ferrous iron meeting oxygen; strongest through the transition, kept present on the oxidised side
      banding: (1 - d.si) * clamp01(0.55 * d.ox + 1.6 * d.ox * (1 - d.ox)) * (1 - d.frost),
      crust: d.si * (1 - d.ox) * (1 - d.frost * 0.7) + (1 - d.si) * d.heat * 0.35,
      deadBands: d.si * (1 - d.ox) * clamp01(0.35 + d.crit * 0.9),
      prismatic: (1 - d.si) * smoothstep(0.3, 0.8, d.heat) * clamp01(soup.seaCover * 6),
      ice: (1 - d.si) * d.frost + d.si * d.frost * 0.8,
      relicIce: d.si,
      cracks: clamp01(0.8 * (1 - d.wet) + 0.6 * d.frost),
    },
    sea: {
      cover: clamp01(soup.seaCover),
      shallow: seaShallow, deep: seaDeep, clarityM: clarity,
      frozen: soup.frozen,
      ice: soup.frozen ? 1 : 0,
      gloss: lerp(0.6, 1, d.si),
    },
    flora: {
      tint: tintHex, tintAmount,
      facet,
      heightScale: lerp(0.92, 1.12, Math.max(d.frost, d.si * 0.8)),   // cold makes tall (CLAUDE.md flora form rule)
      lanternBias: clamp01(0.3 + 0.7 * d.dim),                         // glow pays as a lure only when light is scarce
      sway: (1 - facet * 0.75) * (1 - d.frost * 0.4),                  // crystal and frozen tissue is stiff
    },
    glow: { strength: lerp(1, 2.1, d.dim) * lerp(1, 0.75, d.frost * (1 - d.si)) },
    drivers: d,
    rationale,
  };
}

// ---- sample points (the only "named" environments; each is just a soup)

export const NAMED: Record<string, { soup: Soup; title: string }> = {
  rust: { title: 'Rust World', soup: { element: 'carbon', temperatureC: 15, nitrogenX: 1, oxygenPct: 21, light: 1, frozen: false, seaCover: 0 } },
  archean: { title: 'Archean Haze', soup: { element: 'carbon', temperatureC: 22, nitrogenX: 1.5, oxygenPct: 0.2, light: 0.8, frozen: false, seaCover: 0.3 } },
  hothouse: { title: 'Hothouse', soup: { element: 'carbon', temperatureC: 88, nitrogenX: 1.6, oxygenPct: 12, light: 1.2, frozen: false, seaCover: 0.35 } },
  snowball: { title: 'Snowball', soup: { element: 'carbon', temperatureC: -38, nitrogenX: 1, oxygenPct: 21, light: 0.75, frozen: true, seaCover: 0.3 } },
  deepair: { title: 'Deep Air', soup: { element: 'carbon', temperatureC: 40, nitrogenX: 60, oxygenPct: 18, light: 1, frozen: false, seaCover: 0.15 } },
  cryo: { title: 'Cryo Silicon', soup: { element: 'silicon', temperatureC: -183, nitrogenX: 40, oxygenPct: 0, light: 0.01, frozen: false, seaCover: 0.3 } },
  critical: { title: 'Critical Shore', soup: { element: 'silicon', temperatureC: -152, nitrogenX: 60, oxygenPct: 0, light: 0.012, frozen: false, seaCover: 0.12 } },
};

/** `?soup=c,T,N,O[,light[,seaCover]]` (c|carbon|s|si|silicon). `frozen` follows the solvent (water 0 °C, N₂ −210 °C). */
export function parseSoup(str: string, base: Soup = NAMED.rust.soup): Soup {
  const [e, T, N, O, L, Sc] = str.split(',').map((x) => x.trim());
  const element = /^s/i.test(e ?? '') ? 'silicon' : 'carbon';
  const num = (v: string | undefined, dflt: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : dflt);
  const def = element === base.element ? base : element === 'silicon' ? NAMED.cryo.soup : NAMED.rust.soup;
  const temperatureC = num(T, def.temperatureC);
  return {
    element, temperatureC,
    nitrogenX: num(N, def.nitrogenX), oxygenPct: num(O, def.oxygenPct),
    light: num(L, element !== def.element ? (element === 'silicon' ? 0.01 : 1) : def.light),
    seaCover: num(Sc, def.seaCover),
    frozen: element === 'silicon' ? temperatureC < -210 : temperatureC < 0,
  };
}

export const formatSoup = (s: Soup) =>
  `${s.element} · ${s.temperatureC} °C · N₂ ${s.nitrogenX}× · O₂ ${s.oxygenPct}% · light ${s.light}× · sea ${Math.round(s.seaCover * 100)}%${s.frozen ? ' · frozen' : ''}`;

export { PALETTE_KEYS, type PaletteKey };
