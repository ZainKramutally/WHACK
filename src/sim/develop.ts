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
  symmetry: number; // 2 = bilateral (axial); 3, 4 or 6 = n-fold radial symmetry
  segmentCount: number; // axial: 3..16 spine segments; radial: 0 (see `tiers`)
  tiers: number; // radial: 1..5 facet tiers of the hub, accreting with the `segments` gene; axial: 0
  hubRadius: number; // radial: widest tier radius, metres; axial: 0
  tierHeight: number; // radial: height of one tier, metres; axial: 0
  tierRadii: number[]; // radial: tier radius per tier, bottom to top (stepped); axial: []
  arms: Arm[]; // radial: one per symmetry vertex; axial: []
  sides: 3 | 4 | 6 | 12; // cross-section: n-gon prism hub (radial) or smooth 12-sided loft (axial)
  flatShaded: boolean; // true when si > 0.45: facets read as flat
  profile: 'stepped' | 'smooth'; // radius profile: stacked repeat units (silicon) or smooth (carbon)
  bodyJointMaxDeg: number; // how far adjacent segments (axial) or arm joints (radial) can bend; quantised to 15° for silicon
  jointSnapDeg: number; // 15 for silicon, 0 for carbon (continuous)
  curl: number; // radians of curl per joint (axial); 0 for radial
  // limbs
  legPairs: number; // 0..4: round(4·limbPairs) on both; radial arms are walking arms only when this is > 0
  limbKind: 'rod' | 'tentacle' | 'none';
  limbLength: number; // metres
  limbSegments: number; // rods: 2; tentacles: 2 + round(4·c·limbLen)
  limbJointAngles: number[]; // degrees, per limb segment; multiples of 15 for silicon
  // armour, weapons, head
  plateCover: number; // 0..1 dorsal fraction
  hornCount: number;
  hornLength: number; // metres
  gapeSize: number; // metres of mouth reach (2·gape·scale is the prey limit)
  dorsal: 'rods' | 'frills';
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

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const snap = (deg: number, step: number) => (step > 0 ? Math.round(deg / step) * step : deg);

export function develop(genome: AnimalGenome, conditions: DevelopConditions, inputs: DevelopInputs): BodyPlan {
  const { body, comp } = genome;
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
  // Radial: one arm per symmetry vertex; 0–1 pairs → 3-fold, 2 → 4-fold, 3–4 → 6-fold. Arms walk only when legPairs > 0.
  const symmetry = radial ? (legPairs <= 1 ? 3 : legPairs === 2 ? 4 : 6) : 2;
  const nLegs = radial ? (legPairs === 0 ? 0 : symmetry) : 2 * legPairs;
  // Effective limb length in body lengths. Radial arms are shorter than legs (the hub is wide: 0.6×) plus a spiky stub.
  const legLenEff = (radial ? 0.6 : 1) * limbLenRel * budGrowth;
  const limbKind: BodyPlan['limbKind'] = radial ? 'rod' : legPairs === 0 ? 'none' : 'tentacle';
  const limbSegments = radial ? 2 : legPairs === 0 ? 0 : 2 + Math.round(4 * comp.c * body.limbLen);
  const limbJointAngles: number[] = [];
  if (radial) {
    const hip = 20 + 50 * body.limbLen;
    limbJointAngles.push(snap(hip, 15), snap(-1.5 * hip, 15)); // straight rods, one knee
  } else if (legPairs > 0) {
    const bend = 12 + 20 * body.limbLen;
    for (let j = 0; j < limbSegments; j++) limbJointAngles.push(bend * (j % 2 === 0 ? 1 : -1));
  }

  // --- segments (axial: spine length) / tiers (radial: facet tiers accreting as it grows) ----------------
  const segmentCount = radial ? 0 : Math.min(16, 3 + Math.round(13 * body.segments));
  const tiers = radial ? 1 + Math.round(4 * body.segments) : 0;

  // --- locomotion (R10): cheapest of walk / swim / hover / sessile ----------------
  const rhoBodyScaled = bodyDensity / tissueRho.C; // unbuoyed carbon = 1, same scale as AIR_RHO
  // Swim cost's elongation term: axial spine length; radial (rolling) hubs get more elongated as tiers accrete.
  const elongation = radial ? 0.25 + 0.2 * tiers : segmentCount / 12;
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
  const eyeCount = eyeless ? 0 : radial ? symmetry * (body.eyes < 0.4 ? 1 : body.eyes < 0.7 ? 2 : 3) : 2;
  const eyeKind: BodyPlan['eyeKind'] = eyeless ? 'none' : silicon ? 'dots' : 'rings';
  const glow = clamp(body.glow * (1 - light), 0, 1);

  // --- horns (axial: head horns; radial: apex spires), defence, diet -----------------------------
  const hornCount = body.horns < 0.05 ? 0 : radial ? (body.horns < 0.5 ? 1 : 3) : 2;
  const defence = Math.max(
    0,
    (body.plates + body.horns) * (1 + G.hardness * comp.si) - G.buoyDefence * body.buoy,
  );

  // --- radial hub and arms (axial: none) -------------------------------------------------------------
  const hubRadius = radial ? 0.32 * scale : 0;
  const tierHeight = radial ? 0.6 * hubRadius : 0;
  const tierRadii: number[] = [];
  for (let i = 0; i < tiers; i++) {
    // Widest in the middle, quantised to quarters so each tier reads as a distinct step (a lattice, not a loft).
    const prof = tiers === 1 ? 1 : 0.4 + 0.6 * Math.sin(Math.PI * (0.1 + 0.8 * (i / (tiers - 1))));
    tierRadii.push(hubRadius * Math.max(0.4, Math.round(prof * 4) / 4));
  }
  const armLength = radial ? scale * (0.25 + 0.6 * limbLenRel * budGrowth) : 0;
  const arms: Arm[] = [];
  if (radial) for (let k = 0; k < symmetry; k++) arms.push({ azimuthDeg: (360 / symmetry) * k, length: armLength });

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
    sides: radial ? (symmetry as 3 | 4 | 6) : 12,
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
    plateCover: body.plates,
    hornCount,
    hornLength: hornCount === 0 ? 0 : body.horns * 0.6 * scale,
    gapeSize: 2 * body.gape * scale,
    dorsal: comp.si >= comp.c ? 'rods' : 'frills',
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
