// Render-side develop(): genes + composition + seed → a body plan the rig can pose. Pure and deterministic.
// Follows the sim's develop() (session-logic src/sim/develop.ts) wherever the sim already decides a trait
// (scale, leg pairs, sides, joint limit and 15° snap, eye and horn counts, glow = glow·(1 − light)), and F §3.3 /
// DECISIONS §G.1 "derived, not genes" for render-only look (radius profile, head width, dorsal row, pattern, colours).
// The seed only jitters proportions and picks colourways inside the gene-decided family; it never changes a trait class.
import type { PaletteKey } from '../contracts';
import { makeRng, subSeed } from '../flora/rng';
import { BODY_GENES, LAB_CONDITIONS, type BodyGenes, type Composition, type DevelopConditions } from './genome';

// Sim constants mirrored (session-logic src/sim/constants.ts). Change there first.
const K = { TSR: 0.6, TSR_LAND: 0.1, PLATE_MASS: 0.15, FLY_K: 1.0, TISSUE_C: 1.05, TISSUE_SI: 2.2 };
// Grammar coefficients mirrored from the sim's develop() G table.
const G = { baseScale: 0.15, sizeOctaves: 6, airLift: 0.6, crawlBase: 5, hoverBase: 0.5, hoverSlope: 16, sessileCost: 8 };

export type Gait = 'hop' | 'trot' | 'wave' | 'none';
export type Mode = 'walk' | 'crawl' | 'hover' | 'sessile';
export type EyeKind = 'dots' | 'rings' | 'glossy' | 'glowDots' | 'none';
export type Pattern = 'spots' | 'bands' | 'patch';

export interface LegPair { u: number }  // attach position along the body, 0 head → 1 tail

export interface FaunaPlan {
  seed: number;
  chemistry: 'silicon' | 'carbon';
  comp: Composition;
  mode: Mode;
  // body
  scale: number;            // body length, metres
  segments: number;         // 3..16 (sim rule)
  radii: number[];          // per ring (segments + 1), metres; stepped for silicon
  hump: number[];           // per ring: extra dorsal height share (shoulder hump, hip rise)
  sag: number[];            // per ring: extra ventral depth share (belly)
  aspect: number;           // cross-section height / width
  sides: number;           // 6 silicon prism, 12 carbon loft, 24 for a gas bell
  flat: boolean;            // faceted normals
  jointMaxDeg: number;      // body bend limit per joint
  jointSnapDeg: number;     // 15 for silicon, 0 for carbon
  radialOrder: number;      // 0 bilateral; 3/6 radial (silicon, legless)
  headLen: number;          // fraction of the body that is head
  // limbs and gait
  legPairs: number;
  legs: LegPair[];
  limbKind: 'rod' | 'tentacle' | 'none';
  legLen: number;           // metres, hip → foot fully extended
  legBones: number;         // drawn bones per leg (rods 2, tentacles 3–6)
  legRadius: number;        // metres at the hip
  hipHeight: number;        // standing hip height, metres
  splay: number;            // lateral foot offset as a share of legLen
  gait: Gait;
  duty: number;             // stance share of the cycle
  stride: number;           // metres between successive plants of one foot
  speed: number;            // m/s (= stride × cadence: no foot sliding)
  cadence: number;          // steps per second per foot
  // armour, weapons, head
  plates: { u: number; size: number }[];
  hornCount: number;
  hornLen: number;
  hornCurved: boolean;
  gape: number;             // mouth size share of head radius
  diet: number;             // 0 grazer .. 1 hunter (claw length, jaw)
  eyeKind: EyeKind;
  eyeCount: number;
  eyeRadius: number;        // metres
  headWidth: number;        // 0 normal .. 1 hammerhead eye bar
  dorsal: 'rods' | 'frills';
  dorsalCount: number;
  dorsalHeight: number;     // metres
  tendrils: number;         // trailing tendrils (floaters)
  tendrilLen: number;
  arms: number;             // feeding arms (sessile)
  armLen: number;
  // skin and light
  glow: number;             // expressed glow 0..1 (glow gene × darkness)
  glowSpots: number;        // number of cyan patches
  pattern: Pattern;
  back: PaletteKey; belly: PaletteKey; mark: PaletteKey; plate: PaletteKey; limbHi: PaletteKey; limbLo: PaletteKey;
  // motion character
  tick: boolean;            // stiff, stepped heading/look updates (silicon)
  undulate: number;         // lateral wave amplitude share (carbon follow-through)
  breathHz: number;
  // gas-bell form (hover + short body): the gas sac is a radial bell and the body hangs under it
  form: 'body' | 'bell';
  age: number;              // 0..1 life stage (1 = the genome's adult scale); growth is the only difference
  bellR: number;            // bell radius, metres
  bodyLen: number;          // body length under the bell, metres
  gripArms: number;         // arms that wrap up and grip the bell
  social: number;           // group size for the lab
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const snap = (deg: number, step: number) => (step > 0 ? Math.round(deg / step) * step : deg);
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Hash the genome into a 32-bit seed so the same genes + seed always give the same individual. */
export function genomeSeed(genes: BodyGenes, comp: Composition, seed: number): number {
  return subSeed(seed, ...BODY_GENES.map((g) => Math.round(genes[g] * 1000)), Math.round(comp.c * 1000), Math.round(comp.si * 1000));
}

/** Gait from leg count (Spore approach, F §3.5): 1 pair hops, 2 pairs trot, 3+ run a metachronal wave. */
export function gaitFor(legPairs: number): Gait {
  return legPairs <= 0 ? 'none' : legPairs === 1 ? 'hop' : legPairs === 2 ? 'trot' : 'wave';
}

/** Stance share per gait: hoppers spend half the cycle airborne-ish; many legs keep more feet down. */
export const DUTY: Record<Gait, number> = { hop: 0.45, trot: 0.6, wave: 0.65, none: 1 };

export function develop(genes: BodyGenes, comp: Composition, seed: number, cond: DevelopConditions = LAB_CONDITIONS, age = 1): FaunaPlan {
  const g = genes;
  const rng = makeRng(genomeSeed(g, comp, seed));
  const jit = (k: number) => 1 + (rng() * 2 - 1) * k; // ±k proportional jitter

  const silicon = comp.si > 0.5;
  const light = clamp(cond.light, 0, 1), heat = clamp(cond.heatBand, 0, 1), rhoAir = cond.airDensity;

  // --- tissue, size and mode (sim formulas) ---------------------------------------------------------------
  const siShare = comp.si / Math.max(1e-9, comp.c + comp.si);
  const tissue = K.TISSUE_C + (K.TISSUE_SI - K.TISSUE_C) * siShare;
  const bodyDensity = (1 - g.buoy) * tissue * (1 + K.PLATE_MASS * g.plates);
  const baseScale = G.baseScale * 2 ** (G.sizeOctaves * g.size) * (1 + G.airLift * rhoAir * g.buoy) * (1 + comp.o);
  const legPairs = Math.round(4 * g.limbPairs);
  const nLegs = 2 * legPairs;
  const limbLenRel = 0.3 + 1.7 * g.limbLen;
  const legLenEff = limbLenRel * Math.min(1, 4 * g.limbPairs);
  const walkCost = (1 + G.crawlBase * Math.exp(-4 * legLenEff)) / (Math.sqrt(Math.max(1, nLegs)) * (1 + legLenEff));
  const hoverCost = K.FLY_K * (G.hoverBase + G.hoverSlope * Math.max(0, bodyDensity / K.TISSUE_C - rhoAir));
  const segments = Math.min(16, 3 + Math.round(13 * g.segments));
  const radialOrder = silicon && legPairs === 0 ? (g.segments < 0.5 ? 3 : 6) : 0;
  // render-derived: a radial legless body that cannot float roots in place (F §3.5 "sessile"; the sim's walk cost
  // never exceeds the sessile cost, so this is a look rule until the ecology picks sessile itself)
  let mode: Mode = hoverCost < walkCost ? 'hover' : legPairs > 0 ? 'walk' : 'crawl';
  if (radialOrder > 0 && mode !== 'hover') mode = 'sessile';
  const tsr = mode === 'walk' || mode === 'crawl' ? K.TSR_LAND : K.TSR;
  const grow = Math.max(0.05, Math.min(1, age));
  const scale = baseScale * (1 + tsr * (1 - 2 * heat)) * jit(0.05) * grow;
  // render-derived: a floater too short to hold its gas in an elongated hull carries it as a radial bell (F: bells)
  const bell = mode === 'hover' && g.segments < 0.35 && radialOrder === 0;

  // --- radius profile (F: quadratic Bézier head/mid/tail; si quantises to 3 steps, c smooths) ---------------
  const stout = 1 - g.segments;                      // short bodies are stout, serpents slim
  const rh = (0.07 + 0.07 * g.gape + 0.03 * g.eyes) * jit(0.06);
  const rm = (0.07 + 0.13 * stout + 0.03 * g.plates + (legPairs === 1 ? 0.05 : 0)) * (1 + 0.5 * g.buoy) * jit(0.06);
  const rt = mode === 'hover' ? 0.02 : 0.012;
  const ctrl = 2 * rm - (rh + rt) / 2;
  const headLen = clamp(0.08 + 0.12 * g.gape + 0.08 * stout, 0.08, 0.3) * (radialOrder ? 0 : 1);
  const smooth: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const uw = mode === 'hover' ? u ** 0.6 : u; // floaters carry their bulk forward and taper to a long tail
    let r = (1 - uw) ** 2 * rh + 2 * uw * (1 - uw) * ctrl + uw * uw * rt;
    if (mode === 'walk' || mode === 'crawl') r *= 1 - (silicon ? 0.15 : 0.3) * Math.exp(-(((u - headLen) / 0.07) ** 2)); // neck pinch
    if (i === 0) r *= 0.75;
    if (radialOrder) r = rm * (u < 0.15 ? 1.3 - 1.5 * u : u > 0.78 ? 1.2 + 3 * (u - 0.78) : 0.62 + 0.15 * u);  // foot, column, flared crown cup
    smooth.push(Math.max(0.006, r) * scale);
  }
  const rMax = Math.max(...smooth);
  // silicon: each segment is one prism whose radius is the segment's mean, quantised to 3 steps (stacked repeat units)
  const quant = (r: number) => rMax * (r > rMax * 0.78 ? 1 : r > rMax * 0.5 ? 0.66 : r > rMax * 0.28 ? 0.42 : r / rMax);
  const radii = smooth.map((r, i) => {
    if (silicon && mode !== 'sessile') return r + (quant(r) - r) * 0.4 * comp.si; // one faceted hull, gently stepped
    if (!silicon || i === segments) return r;
    const m = (r + smooth[i + 1]) / 2;
    return m + (quant(m) - m) * comp.si;
  });

  // --- limbs and gait -------------------------------------------------------------------------------------
  const gait = gaitFor(legPairs);
  const legs: LegPair[] = [];
  if (legPairs === 1) legs.push({ u: 0.48 });
  else for (let p = 0; p < legPairs; p++) legs.push({ u: headLen + 0.06 + (p / (legPairs - 1)) * (0.62 - headLen) });
  const legLen = legPairs ? scale * limbLenRel * jit(0.05) : 0;
  const limbKind = legPairs === 0 ? 'none' : silicon ? 'rod' : 'tentacle';
  const legBones = legPairs === 0 ? 0 : silicon ? 2 : 2 + Math.round(4 * comp.c * g.limbLen);
  // short legs sprawl (lizard posture: low hips, feet out wide); long legs stand tall (stilts)
  const tall = sstep(0.2, 0.9, g.limbLen);
  const stand = gait === 'hop' ? 0.42 : (silicon ? 0.5 : 0.48) + 0.32 * tall; // hoppers crouch on folded legs
  const hipHeight = legLen * stand;
  const splay = (legPairs > 2 ? 0.5 : 0.42) - 0.22 * tall;
  const duty = DUTY[gait];
  // Stride: the hip may travel ±half a stance stride over a planted foot within reach (IK never overstretches).
  const reach = Math.sqrt(Math.max(0, 1 - stand * stand - splay * splay * 0.5)) * legLen;
  const stride = gait === 'none' ? 0 : Math.min(0.9 * legLen, (1.6 * reach) / duty);
  // Froude walking (v = √(Fr·g·L)): small animals walk at a higher Froude number; silicon is slower.
  const Fr = (0.03 + 0.12 * (1 - g.size)) * (silicon ? 0.7 : 1); // a slow amble (Fr ≈ 0.03–0.15)
  let speed = 0;
  if (gait !== 'none') speed = Math.sqrt(Fr * 9.81 * legLen);
  else if (mode === 'crawl') speed = 0.18 * scale;
  else if (mode === 'hover') speed = 0.07 * scale;
  const cadence = stride > 0 ? speed / stride : 0;

  // --- silhouette: shoulder hump over the front legs, a lower hip rise, belly sag and a waist between them --------
  const gss = (x: number, m: number, w: number) => Math.exp(-(((x - m) / w) ** 2));
  const uF0 = legs.length ? Math.min(...legs.map((l) => l.u)) : headLen + 0.1, uB0 = legs.length ? Math.max(...legs.map((l) => l.u)) : 0.6;
  const walker = mode === 'walk';
  const humpA = walker ? 0.22 + 0.25 * g.plates + 0.1 * g.size : mode === 'crawl' ? 0.05 : 0;
  const hump = radii.map((_, i) => { const u = i / segments; return humpA * gss(u, uF0, 0.13) + 0.5 * humpA * gss(u, uB0, 0.1); });
  const sag = radii.map((_, i) => { const u = i / segments; return walker && legPairs >= 2 ? 0.14 * gss(u, (uF0 + uB0) / 2, 0.14) : 0; });
  if (walker && legPairs >= 2) for (let i = 0; i <= segments; i++) radii[i] *= 1 - 0.16 * gss(i / segments, (uF0 + uB0) / 2 + 0.05, 0.08);

  // --- plates, horns, eyes, dorsal row ---------------------------------------------------------------------
  const plates: FaunaPlan['plates'] = [];
  if (g.plates > 0.08) {
    for (let i = 1; i < segments; i++) {
      const u = i / segments;
      if (u < headLen * 0.6 || u > 0.3 + 0.65 * g.plates) continue;
      plates.push({ u, size: 0.6 + 0.6 * g.plates });
    }
  }
  const hornCount = g.horns < 0.05 ? 0 : silicon ? (g.horns < 0.5 ? 1 : 3) : 2;
  const hornLen = hornCount ? g.horns * 0.6 * scale * (silicon ? 0.6 : 0.5) * jit(0.08) : 0;
  const eyeless = g.eyes < 0.05;
  const glow = clamp(g.glow * (1 - light), 0, 1);
  // render-derived: a carbon body with a big eye budget concentrates it into one glossy eye (F: eyeCountBias)
  let eyeKind: EyeKind = eyeless ? 'none' : silicon ? 'dots' : g.eyes > 0.85 ? 'glossy' : 'rings';
  if (silicon && glow > 0.35 && !eyeless) eyeKind = 'glowDots';
  const eyeCount = eyeless ? 0 : silicon ? (g.eyes < 0.4 ? 3 : g.eyes < 0.7 ? 4 : 6) : eyeKind === 'glossy' ? 1 : 2;
  const eyeArea = g.eyes * (1.5 - light);                         // dark → bigger eyes (sim)
  const headR = radii[Math.max(0, Math.round(headLen * segments * 0.5))];
  const eyeRadius = Math.max(0.006, headR * (silicon ? 0.2 : 0.22) * Math.sqrt(eyeArea) * (eyeKind === 'glossy' ? 2.4 : 1));
  const headWidth = sstep(0.6, 0.9, g.limbLen) * g.eyes;          // tall watchers spread their eyes (F g31)
  const dorsal: FaunaPlan['dorsal'] = comp.si >= comp.c ? 'rods' : 'frills';
  const dorsalCount = mode === 'hover' || radialOrder ? 0 : Math.round((comp.si >= comp.c ? 2 : 0.6) * segments * clamp(g.diet * 0.6 + g.segments * 0.5 - g.plates * 0.4, 0, 1));
  const dorsalHeight = rMax * (dorsal === 'frills' ? 1.5 : 0.9);
  const tendrils = mode === 'hover' ? 6 + 2 * Math.round(4 * g.buoy * (1 - g.limbPairs)) : 0;
  const arms = radialOrder ? radialOrder * (g.diet < 0.5 ? 2 : 1) : 0;

  // --- skin: value-inverted bands, dark under / pale back (ART_DIRECTION §1.4) -------------------------------
  const pattern: Pattern = g.segments > 0.6 ? 'bands' : g.plates > 0.5 ? 'patch' : 'spots';
  const back: PaletteKey = silicon ? rng.pick(['bone', 'bone', 'blush'] as const) : rng.pick(['blush', 'crimson', 'blush'] as const);
  const belly: PaletteKey = silicon ? 'ink' : rng.pick(['maroon', 'ink'] as const);
  const mark: PaletteKey = back === 'crimson' ? 'bone' : 'crimson';

  const out: FaunaPlan = {
    seed, chemistry: silicon ? 'silicon' : 'carbon', comp: { ...comp }, mode,
    scale, segments, radii, hump, sag, aspect: mode === 'hover' ? 0.9 : silicon ? 0.85 : 0.8, sides: silicon ? 6 : 12, flat: comp.si > 0.45,
    jointMaxDeg: snap(55 + (14 - 55) * comp.si, silicon ? 15 : 0), jointSnapDeg: silicon ? 15 : 0, radialOrder, headLen,
    legPairs, legs, limbKind, legLen, legBones, legRadius: Math.max(0.004, rMax * (0.22 + 0.16 * g.size) * (silicon ? 1 : 1.15) / Math.sqrt(Math.max(1, legPairs) / 2) * (1 + 0.3 * g.plates)),
    hipHeight, splay, gait, duty, stride, speed, cadence,
    plates, hornCount, hornLen, hornCurved: !silicon, gape: g.gape, diet: g.diet,
    eyeKind, eyeCount, eyeRadius, headWidth, dorsal, dorsalCount, dorsalHeight,
    tendrils, tendrilLen: scale * (0.25 + 0.25 * g.buoy), arms, armLen: scale * (0.35 + 0.4 * g.limbLen),
    glow, glowSpots: Math.round(glow * (3 + 1.5 * segments)), pattern,
    back, belly, mark, plate: silicon ? 'bone' : 'blush', limbHi: 'maroon', limbLo: 'ink',
    tick: comp.si > 0.6, undulate: mode === 'crawl' ? 0.12 + 0.1 * comp.c : 0.03 * comp.c, breathHz: 0.5 / Math.max(0.5, scale) ** 0.25,
    social: Math.max(1, Math.round(1 + 7 * sstep(0.5, 1, g.sociality) * (1 - g.size))),
    form: 'body', age: grow, bellR: 0, bodyLen: 0, gripArms: 0,
  };
  if (!bell) return out;
  // ---- gas bell: an egg of gas (taller as it matures; juveniles are rounder with bigger eyes: eye ∝ size^0.65) ----
  const nB = 8;
  const aspect = 0.94 + 0.22 * grow; // juveniles round, adolescents a taller egg
  const R = (0.5 * scale) / aspect;
  const bradii: number[] = [];
  for (let i = 0; i <= nB; i++) { const u = i / nB; bradii.push(R * Math.max(0.04, Math.sin(Math.PI * (0.12 + 0.88 * u ** 1.3)) ** 0.5)); } // round crown, narrower rim
  bradii[nB] = 0.42 * R; // the crown closes with a dome cap, not a point
  const bodyLen = scale * (0.44 - 0.14 * grow); // juveniles: relatively bigger body and head
  return {
    ...out, form: 'bell', segments: nB, radii: bradii, hump: bradii.map(() => 0), sag: bradii.map(() => 0), sides: 40, flat: false, aspect: 1, headLen: 0,
    bellR: R, bodyLen, gripArms: 2 + Math.round(2 * g.limbLen),
    eyeKind: eyeless ? 'none' : 'rings', eyeCount: eyeless ? 0 : 2,
    eyeRadius: bodyLen * 0.12 * Math.sqrt(eyeArea) * grow ** -0.35,
    tendrils: 3 + Math.round(3 * g.buoy), tendrilLen: scale * (0.8 + 0.45 * grow),
    plates: [], dorsalCount: 0, glowSpots: 0, hornCount: 0,
    back: 'blush', mark: 'crimson', belly: 'maroon', limbHi: 'maroon', limbLo: 'ink',
  };
}
