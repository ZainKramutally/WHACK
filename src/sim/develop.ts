// develop(): the only place genes become traits (DECISIONS §3 rule 9; F §3.3). Pure: same input → same output.
// No randomness, no species names, no preset ids, no role input. Grid-dependent quantities are not here
// (ecology.ts owns those). Glow comes from darkness on both worlds; oxygen does NOT feed glow.
//
// Chemistry is the grammar, and it picks the body ARCHITECTURE, not just the skin (owner ruling 2026-11-07).
// The composition decides by a hard threshold on the silicon fraction: si > 0.5 → RADIAL (silicon): no head or
// tail, a faceted hub with 3-, 4- or 6-fold symmetry whose facet tiers accrete with `segments`, straight rod arms
// radiating from it (joints snapped to 15°), ceramic tiles on facets, apex spires, dot-eye clusters at the arm tips.
// Otherwise AXIAL (carbon): a head-to-tail chain of soft round curling segments, paired tentacle limbs, a tail,
// paired ring eyes at the head. The same 12 genes are read through each grammar (segments = spine length vs facet
// tiers; limbPairs = leg pairs vs arm count by symmetry order). Continuous quantities (joint limit, hardness,
// tissue density) still vary smoothly with c and si, so a mixed body is a mixture, not a switch.
import { CONSTANTS } from './constants';
import type { AnimalGenome } from './genome';

export const LOCOMOTION = { walk: 0, swim: 1, hover: 2, sessile: 3 } as const;
export type LocomotionMode = (typeof LOCOMOTION)[keyof typeof LOCOMOTION];

/** What the body is developing into. Both are 0..1. */
export interface DevelopConditions {
  light: number; // starlight at the surface relative to the world's reference (clamped to 0..1)
  heatBand: number; // temperature within the world's living band, 0 = lower edge, 1 = upper edge
}

/**
 * World facts develop() needs: the fields of WorldConfig.life.inputs (without their why/sources), with
 * `airDensity` already scaled into develop()'s range (`airDensity.scale` × live P·M/(R·T)).
 */
export interface DevelopInputs {
  solvent: { rho: number; mu: number; epsilonR: number; liquidBandC: [number, number] }; // g/cm³, mPa·s, –, °C
  airDensity: number; // 0..1-ish, unbuoyed carbon tissue = 1
  tissueDensity: { C: number; Si: number }; // g/cm³
}

/** One arm of a radial body: its direction around the hub (a multiple of 15°) and its length. */
export interface Arm { azimuthDeg: number; length: number }

export interface BodyPlan {
  // size and mass
  scale: number; // adult body length (axial) or hub diameter (radial), metres
  mass: number; // kg-ish; tissue mass (a gas bag adds volume, never removes mass); hub for upkeep (Kleiber), generation time, gape reach
  bodyDensity: number; // g/cm³, whole body including any gas bag and plates
  // chemistry grammar
  chemistry: 'silicon' | 'carbon';
  architecture: 'axial' | 'radial'; // carbon: bilateral head-to-tail chain; silicon: radial faceted hub with arms
  symmetry: number; // 2 = bilateral (axial); 3, 4, 5, 6 or 8 = n-fold radial symmetry
  segmentCount: number; // axial: 3..16 spine segments; radial: 0 (see `tiers`)
  tiers: number; // radial: 1..5 facet tiers of the hub, accreting with the `segments` gene; axial: 0
  hubRadius: number; // radial: widest tier radius, metres; axial: 0
  tierHeight: number; // radial: height of one tier, metres; axial: 0
  tierRadii: number[]; // radial: tier radius per tier, bottom to top (stepped); axial: []
  arms: Arm[]; // radial: one per symmetry vertex; axial: []
  sides: 3 | 4 | 5 | 6 | 8 | 12; // cross-section: n-gon prism hub (radial) or smooth 12-sided loft (axial)
  flatShaded: boolean; // true when si > 0.45: facets read as flat
  profile: 'stepped' | 'smooth'; // radius profile: stacked repeat units (silicon) or smooth (carbon)
  bodyJointMaxDeg: number; // how far adjacent segments (axial) or arm joints (radial) can bend; quantised to 15° for silicon
  jointSnapDeg: number; // 15 for silicon, 0 for carbon (continuous)
  curl: number; // radians of curl per joint (axial); 0 for radial
  // limbs
  legPairs: number; // 0..4: round(4·limbPairs) on both; radial arms are walking arms only when this is > 0
  limbKind: 'rod' | 'tentacle' | 'leg' | 'none'; // rod: radial arm; tentacle: soft; leg: jointed (axial)
  limbLength: number; // metres
  limbSegments: number; // rods: 2; tentacles: 2 + round(4·c·limbLen)
  limbJointAngles: number[]; // degrees, per limb segment; multiples of 15 for silicon
  // armour, weapons, head
  plateCover: number; // 0..1 dorsal fraction
  hornCount: number;
  hornLength: number; // metres
  gapeSize: number; // metres of mouth reach (2·gape·scale is the prey limit)
  dorsal: 'rods' | 'frills';
  hornKind: 'none' | 'pair' | 'crown' | 'antler' | 'tusk' | 'spire'; // layout of the horns: how hornCount is arranged
  // form: derived shape traits, pure blends of genes (render reads them; the ecology does not)
  girth: number; // axial: segment thickness relative to its length, eel 0.3 … slug 1.5
  flatten: number; // axial: body height ÷ width, slug 0.45 … bloated 1.3
  headScale: number; // axial: head size relative to the trunk, 0.75 … 2
  gradient: number; // axial: front-to-back size trend, −0.5 (heavy rear) … 0.5 (heavy front)
  carapace: number; // axial: 0..1 dorsal shield
  crest: number; // axial: 0..1 dorsal crest/frill height
  jaw: number; // axial: 0..1 protruding jaw
  tailKind: 'none' | 'taper' | 'whip' | 'fluke' | 'club'; // axial
  tailSegments: number; // axial: beads behind the trunk
  finSpan: number; // axial swimmers: paddle-fin size (0 when not swimming)
  wingSpan: number; // axial hoverers: membrane wing size (0 when not hovering)
  flare: number; // radial: −1 tapered cone … +1 flared bowl
  armKind: 'none' | 'rod' | 'branch' | 'fan' | 'whip'; // radial
  tileLength: number; // radial: 0 flat tiles … 1 long crystal spikes (geode)
  // per-lineage colour and pattern, from genes (render-only)
  hue: number; // 0..1 position inside the world's palette band
  accent: number; // 0..1 accent mix
  bands: number; // 0..3 stripe bands
  spots: number; // 0..1 spot density
  // senses and light
  eyeKind: 'dots' | 'rings' | 'none';
  eyeCount: number;
  eyeArea: number; // eyes·(1.5 − light): bigger in the dark
  eyeUpkeep: number; // share of upkeep, EYE_FRAC·(eyeArea/1.5)²
  glow: number; // expressed glow = glow gene × (1 − light)
  // derived for the ecology
  defence: number; // (plates + horns)·(1 + 0.5·si) − 0.3·buoy, ≥ 0: prey edible iff 2·gape·S > S_prey·(1 + defence)
  diet: number; // 0 grazer .. 1 hunter
  plantGain: number; // (1 − diet)²
  meatGain: number; // diet²
  mode: LocomotionMode; // cheapest of walk / swim / hover / sessile
  modeCosts: { walk: number; swim: number; hover: number; sessile: number }; // so ecology can re-pick by medium
}

/**
 * Coefficients of the grammar itself (F §3.3 / DECISIONS §B), not sim tunables, so not in constants.ts.
 * Designed and declared; each is a shape or unit-conversion factor.
 */
const G = {
  baseScale: 0.15, // m at size 0; ×2^(6·size)
  sizeOctaves: 6,
  airLift: 0.6, // (1 + airLift·ρ_air·buoy) on scale: gas bells grow in thick air
  fill: 0.1, // volume of an elongated body as a share of scale³
  limbMass: 0.05, // limb mass share per leg·len² (× (1 − 0.5·si))
  hornMass: 0.1,
  headMass: 0.1,
  sessileCost: 8, // normalisation: filter-feeding costs about a crawl (6), so legless worms still move
  crawlBase: 5, // legless crawl multiplier: 1 + 5·exp(−4·len) (F; no fitness valley, buds help smoothly)
  gasFloor: 0.02, // a gas bag cannot be perfectly empty: whole-body density never falls below this share of tissue density
  hoverBase: 0.5,
  hoverSlope: 16,
  swimBase: 0.5,
  swimSlope: 4,
  swimElongation: 0.6, // elongation cuts swim cost at high Re
  hardness: 0.5, // silicon hardness adds this × si to defence
  buoyDefence: 0.3,
  reRef: { rho: 1.0, mu: 0.89 }, // water at 20 °C: the unit the Reynolds weight is anchored to (a scale, not a world fact)
};

const SYMMETRIES = [3, 4, 5, 6, 8] as const;
/**
 * Evolved genes crowd the low end of [0, 1] (CLAUDE.md: mutation drifts against the 0 wall; measured 5–95% band ≈ 0..0.6).
 * Form traits (shape only, never ecology) read the genes through this stretch so the reachable range spans every family.
 */
const FORM_SPAN = 0.55;
const stretch = (g: number) => Math.min(1, g / FORM_SPAN);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const snap = (deg: number, step: number) => (step > 0 ? Math.round(deg / step) * step : deg);

export function develop(genome: AnimalGenome, conditions: DevelopConditions, inputs: DevelopInputs): BodyPlan {
  const { body, comp } = genome;
  const f = {} as typeof body; // body genes stretched for form traits
  for (const k of Object.keys(body) as (keyof typeof body)[]) f[k] = stretch(body[k]);
  const K = CONSTANTS;
  const light = clamp(conditions.light, 0, 1);
  const heat = clamp(conditions.heatBand, 0, 1);
  const rhoAir = inputs.airDensity;
  const sea = inputs.solvent;
  const tissueRho = inputs.tissueDensity;

  // --- chemistry grammar: the architecture -------------------------------------
  const silicon = comp.si > 0.5;
  const radial = silicon;
  const jointSnapDeg = silicon ? 15 : 0;

  // --- tissue density and size --------------------------------------------
  const siShare = comp.si / Math.max(1e-9, comp.c + comp.si); // o is not a structural tissue here
  const tissue = tissueRho.C + (tissueRho.Si - tissueRho.C) * siShare;
  // Tissue density with plates. This sets MASS: buoyancy never removes tissue.
  const tissueDense = tissue * (1 + K.PLATE_MASS.value * body.plates);
  // A gas bag adds VOLUME around the same tissue, so whole-body density falls with `buoy` (floored) while mass stays.
  const bodyDensity = tissueDense * (1 - (1 - G.gasFloor) * body.buoy);

  // Adult scale before the temperature–size rule, which depends on the locomotion mode chosen below.
  const baseScale =
    G.baseScale * 2 ** (G.sizeOctaves * body.size) * (1 + G.airLift * rhoAir * body.buoy) * (1 + comp.o);

  // --- limbs / arms: limbPairs and limbLen are read by each grammar --------------------------------
  const legPairs = Math.round(4 * body.limbPairs);
  const limbLenRel = 0.3 + 1.7 * body.limbLen; // × scale
  const budGrowth = Math.min(1, 4 * body.limbPairs); // a bud is a stubby limb; smooth, so there is no fitness valley
  // Radial: one arm per symmetry vertex; the limbPairs gene walks 3 → 4 → 5 → 6 → 8-fold. Arms walk only when legPairs > 0.
  const symmetry = radial ? SYMMETRIES[Math.min(SYMMETRIES.length - 1, Math.floor(f.limbPairs * SYMMETRIES.length))] : 2;
  const nLegs = radial ? (legPairs === 0 ? 0 : symmetry) : 2 * legPairs;
  // Effective limb length in body lengths. Radial arms are shorter than legs (the hub is wide: 0.6×) plus a spiky stub.
  const legLenEff = (radial ? 0.6 : 1) * limbLenRel * budGrowth;
  // Axial limbs: stiff, long, hunting or plated bodies grow jointed legs; the rest keep soft tentacles.
  const legScore = 0.7 * f.limbLen + 0.5 * f.plates + 0.6 * f.diet;
  const jointed = legScore >= 0.8;
  const limbKind: BodyPlan['limbKind'] = radial ? 'rod' : legPairs === 0 ? 'none' : jointed ? 'leg' : 'tentacle';
  const limbSegments = radial ? 2 : legPairs === 0 ? 0 : jointed ? 2 : 2 + Math.round(4 * comp.c * body.limbLen);
  const limbJointAngles: number[] = [];
  if (radial) {
    const hip = 20 + 50 * body.limbLen;
    limbJointAngles.push(snap(hip, 15), snap(-1.5 * hip, 15)); // straight rods, one knee
  } else if (legPairs > 0 && jointed) {
    limbJointAngles.push(35 + 25 * body.limbLen, -(70 + 40 * body.limbLen)); // a stiff knee
  } else if (legPairs > 0) {
    const bend = 12 + 20 * body.limbLen;
    for (let j = 0; j < limbSegments; j++) limbJointAngles.push(bend * (j % 2 === 0 ? 1 : -1));
  }

  // --- segments (axial: spine length) / tiers (radial: facet tiers accreting as it grows) ----------------
  // Size extremes change the build: tiny bodies are simpler (fewer segments and tiers, fewer ornaments), giants have more
  // segments and tiers, thicker bodies and heavier plating. Shape only: swim cost reads the unscaled counts below.
  const tiny = 0.6 * clamp(1 - body.size / 0.06, 0, 1), giant = clamp((body.size - 0.2) / 0.4, 0, 1);
  const baseSegments = 3 + 13 * body.segments, baseTiers = 1 + 4 * body.segments;
  const segmentCount = radial ? 0 : clamp(Math.round(baseSegments * (1 - 0.45 * tiny + 0.4 * giant)), 3, 16);
  const tiers = radial ? clamp(Math.round(baseTiers * (1 - 0.4 * tiny + 0.5 * giant)), 1, 5) : 0;

  // --- locomotion (R10): cheapest of walk / swim / hover / sessile ----------------
  const rhoBodyScaled = bodyDensity / tissueRho.C; // unbuoyed carbon = 1, same scale as AIR_RHO
  // Swim cost's elongation term: axial spine length; radial (rolling) hubs get more elongated as tiers accrete.
  const elongation = radial ? 0.25 + 0.2 * Math.round(baseTiers) : Math.min(16, Math.round(baseSegments)) / 12;
  const reRel = ((sea.rho / sea.mu) / (G.reRef.rho / G.reRef.mu)) * baseScale; // Re vs water, size-weighted
  const reWeight = clamp(1 + 0.25 * Math.log(reRel), 0, 2);
  const walk =
    (1 + G.crawlBase * Math.exp(-4 * legLenEff)) / (Math.sqrt(Math.max(1, nLegs)) * (1 + legLenEff));
  const swim =
    (G.swimBase + G.swimSlope * Math.abs(bodyDensity - sea.rho)) /
    (1 + G.swimElongation * elongation * reWeight);
  const hover = K.FLY_K.value * (G.hoverBase + G.hoverSlope * Math.max(0, rhoBodyScaled - rhoAir));
  const modeCosts = { walk, swim, hover, sessile: G.sessileCost };
  let mode: LocomotionMode = LOCOMOTION.walk;
  let best = walk;
  if (swim < best) { best = swim; mode = LOCOMOTION.swim; }
  if (hover < best) { best = hover; mode = LOCOMOTION.hover; }
  if (modeCosts.sessile < best) { mode = LOCOMOTION.sessile; }

  // --- temperature–size rule by medium (R9): cold → giants; walkers feel it less -------------
  const tsr = mode === LOCOMOTION.walk ? K.TSR_LAND.value : K.TSR.value;
  const scale = baseScale * (1 + tsr * (1 - 2 * heat));

  // --- mass (tissue only) ---------------------------------------------------------------------
  const limbFrac = nLegs * legLenEff ** 2 * G.limbMass * (1 - 0.5 * comp.si);
  const mass =
    1000 * G.fill * scale ** 3 * tissueDense *
    (1 + limbFrac + K.PLATE_MASS.value * body.plates + G.hornMass * body.horns + G.headMass * body.gape);

  // --- eyes and glow (reaction norms of light) --------------------------------
  const eyeArea = body.eyes * (1.5 - light);
  const eyeUpkeep = K.EYE_FRAC.value * (eyeArea / 1.5) ** 2;
  const eyeless = body.eyes < 0.05;
  // Axial: a pair of ring eyes at the head. Radial: a dot-eye cluster (1–3 dots) at the tip of every arm.
  const eyePairs = tiny > 0.3 ? 1 : f.eyes < 0.75 ? 1 : f.eyes < 0.92 ? 2 : 3; // axial: more pairs when the genes are strongly eyed
  const eyeCount = eyeless ? 0 : radial ? symmetry * (f.eyes < 0.4 ? 1 : f.eyes < 0.7 ? 2 : 3) : 2 * eyePairs;
  const eyeKind: BodyPlan['eyeKind'] = eyeless ? 'none' : silicon ? 'dots' : 'rings';
  const glow = clamp(body.glow * (1 - light), 0, 1);

  // --- horns (axial: head horns; radial: apex spires), defence, diet -----------------------------
  const hornCount = body.horns < 0.05 ? 0 : radial ? clamp(Math.round(f.horns * 7 * (1 - 0.5 * tiny)), 1, 7) : clamp(Math.round(f.horns * 6 * (1 - 0.5 * tiny)), 1, 6);
  // How the horns are laid out: tusks (big jaws, few horns), a pair, a crown ring, or branching antlers; radial: a spire crown.
  const hornKind: BodyPlan['hornKind'] =
    hornCount === 0 ? 'none'
    : radial ? 'spire'
    : f.gape > 0.6 && f.horns < 0.45 ? 'tusk'
    : hornCount <= 2 ? 'pair'
    : hornCount <= 4 ? 'crown'
    : 'antler';
  const defence = Math.max(
    0,
    (body.plates + body.horns) * (1 + G.hardness * comp.si) - G.buoyDefence * body.buoy,
  );

  // --- radial hub and arms (axial: none) -------------------------------------------------------------
  // flare: tapered cone (spire-bearing, armed) ↔ flared bowl (buoyant, gaping bell). Nonlinear blend of three genes.
  const flare = radial ? clamp(1.5 * (f.buoy - f.horns) + (f.gape - 0.4), -1, 1) : 0;
  const hubRadius = radial ? 0.32 * scale : 0;
  const tierHeight = radial ? hubRadius * (0.35 + 0.6 * (1 - f.plates)) : 0;
  const tierRadii: number[] = [];
  for (let i = 0; i < tiers; i++) {
    const t = tiers === 1 ? 0.5 : i / (tiers - 1);
    const bulge = 0.4 + 0.6 * Math.sin(Math.PI * (0.1 + 0.8 * t)); // widest in the middle
    const lin = flare >= 0 ? 0.4 + 0.8 * t : 1.15 - 0.75 * t;     // bowl widens upward; cone narrows upward
    const prof = (1 - Math.abs(flare)) * bulge + Math.abs(flare) * lin;
    // Quantised to quarters so each tier reads as a distinct step (a lattice, not a loft).
    tierRadii.push(hubRadius * Math.max(0.35, Math.round((tiers === 1 ? 1 : prof) * 4) / 4));
  }
  const armLength = radial ? scale * (0.25 + 0.6 * limbLenRel * budGrowth) : 0;
  // Arm kind: whichever of four nonlinear scores wins (rod ← long lone arms, branch ← social, fan ← gaping, whip ← buoyant).
  const armScores = {
    rod: 0.45 + 0.4 * f.limbLen * (1 - f.sociality),
    branch: 1.1 * f.sociality * (0.4 + f.limbLen),
    fan: 1.2 * f.gape * (1 - f.buoy) * (0.5 + f.plates),
    whip: 1.3 * f.buoy * (0.3 + f.limbLen),
  };
  let armKind: BodyPlan['armKind'] = 'rod';
  if (radial) for (const k of ['branch', 'fan', 'whip'] as const) if (armScores[k] > armScores[armKind]) armKind = k;
  const tileLength = radial ? clamp((f.plates - 0.55) * 2.2, 0, 1) : 0;
  const arms: Arm[] = [];
  if (radial) for (let k = 0; k < symmetry; k++) arms.push({ azimuthDeg: (360 / symmetry) * k, length: armLength });

  // --- axial form: blends of the genes (pure; the ecology never reads these) ----------------------------------
  const axial = !radial;
  const girth = axial ? clamp((0.32 + 0.85 * (1 - f.segments) ** 1.5 + 0.3 * f.buoy + 0.25 * f.plates * (1 - 0.5 * f.segments)) * (1 + 0.35 * giant), 0.3, 1.8) : 0;
  const flatten = axial ? clamp(1 - 0.5 * f.plates * (1 - f.buoy) - 0.25 * (1 - f.limbPairs) * (1 - f.buoy) + 0.35 * f.buoy, 0.45, 1.3) : 0;
  const headScale = axial ? clamp(0.75 + 0.9 * f.gape + 0.35 * f.diet * f.gape + 0.25 * f.eyes, 0.75, 2) : 0;
  const gradient = axial ? clamp(0.9 * (f.sociality - 0.5) + 0.5 * (f.diet - 0.5) - 0.3 * (f.plates - 0.5), -0.5, 0.5) : 0;
  const carapace = axial ? clamp(clamp((f.plates - 0.2) * 1.6, 0, 1) * (1 - 0.5 * f.segments) + 0.3 * giant, 0, 1) : 0;
  const crest = axial ? clamp(1.6 * (0.5 * f.glow + 0.5 * f.sociality - 0.3), 0, 1) * (1 - 0.7 * tiny) : 0;
  const jaw = axial ? clamp((f.gape - 0.4) * 2, 0, 1) : 0;
  let tailKind: BodyPlan['tailKind'] = 'none';
  let tailSegments = 0;
  if (axial) {
    // Whichever tail fits the form wins: whip (long and slender), fluke (swimmers), club (armoured), else a taper.
    const tail = {
      taper: 0.25,
      whip: 0.1 + 0.9 * f.segments * (1 - f.plates),
      fluke: mode === LOCOMOTION.swim ? 0.3 + 0.5 * (1 - f.segments) : 0.05,
      club: 1.3 * f.plates * (0.4 + f.horns),
    };
    tailKind = 'taper';
    for (const k of ['whip', 'fluke', 'club'] as const) if (tail[k] > tail[tailKind]) tailKind = k;
    tailSegments = tailKind === 'whip' ? Math.max(2, Math.round((3 + 3 * f.segments) * (1 - 0.4 * tiny))) : tailKind === 'club' ? 2 : tailKind === 'fluke' ? 1 : 2;
  }
  // Mode follows form: swimmers get paddle fins, hoverers get membrane wings (sized by limb length).
  const finSpan = axial && mode === LOCOMOTION.swim ? clamp(0.25 + 0.9 * f.limbLen * (0.5 + 0.5 * (1 - f.segments)), 0, 1.2) : 0;
  const wingSpan = axial && mode === LOCOMOTION.hover ? clamp(0.4 + 0.8 * f.limbLen + 0.3 * f.buoy, 0, 1.4) : 0;

  // --- lineage colour and pattern: nonlinear mixes of the genes, so related lineages look related -----------------
  const frac = (v: number) => v - Math.floor(v);
  const hue = frac(1.7 * body.size + 2.9 * body.limbLen + 1.3 * body.horns + 0.7 * body.limbPairs + 3.1 * body.sociality + 0.37 * body.gape);
  const accent = frac(2.3 * body.plates + 1.1 * body.glow + 1.9 * body.eyes + 0.6 * body.buoy);
  const bands = Math.min(3, Math.floor(4 * frac(1.3 * body.diet + 2.1 * body.segments + 0.8 * body.plates)));
  const spots = clamp(2 * frac(0.9 * body.sociality + 1.7 * body.gape + 1.1 * body.size) - 0.8, 0, 1) * (1 - 0.6 * tiny);

  return {
    scale,
    mass,
    bodyDensity,
    chemistry: silicon ? 'silicon' : 'carbon',
    architecture: radial ? 'radial' : 'axial',
    symmetry,
    segmentCount,
    tiers,
    hubRadius,
    tierHeight,
    tierRadii,
    arms,
    sides: radial ? (symmetry as 3 | 4 | 5 | 6 | 8) : 12,
    flatShaded: comp.si > 0.45,
    profile: silicon ? 'stepped' : 'smooth',
    bodyJointMaxDeg: snap(55 + (14 - 55) * comp.si, jointSnapDeg),
    jointSnapDeg,
    curl: radial ? 0 : 0.3 * comp.c,
    legPairs,
    limbKind,
    limbLength: radial ? armLength : legPairs === 0 ? 0 : scale * limbLenRel,
    limbSegments,
    limbJointAngles,
    plateCover: clamp(f.plates + 0.35 * giant, 0, 1),
    hornCount,
    hornLength: hornCount === 0 ? 0 : f.horns * (radial ? 0.6 : hornCount > 2 ? 0.35 : 0.6) * scale,
    gapeSize: 2 * body.gape * scale,
    dorsal: comp.si >= comp.c ? 'rods' : 'frills',
    hornKind,
    girth, flatten, headScale, gradient, carapace, crest, jaw, tailKind, tailSegments, finSpan, wingSpan,
    flare, armKind: radial ? armKind : 'none', tileLength,
    hue, accent, bands, spots,
    eyeKind,
    eyeCount,
    eyeArea,
    eyeUpkeep,
    glow,
    defence,
    diet: body.diet,
    plantGain: (1 - body.diet) ** 2,
    meatGain: body.diet ** 2,
    mode,
    modeCosts,
  };
}
