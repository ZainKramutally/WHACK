// develop(): the only place genes become traits (DECISIONS §3 rule 9; F §3.3). Pure: same input → same output.
// No randomness, no species names, no preset ids, no role input. Grid-dependent quantities are not here
// (ecology.ts owns those). Glow comes from darkness on both worlds; oxygen does NOT feed glow.
//
// Chemistry is the grammar. The composition decides the shape family by a hard threshold on the silicon
// fraction (F §3.3): si > 0.5 → silicon grammar (hex facets, rod limbs, 15° joints, dot eyes);
// otherwise carbon grammar (round, curling, tentacle limbs, ring eyes). Continuous quantities (joint limit,
// curl, hardness, tissue density) still vary smoothly with c and si, so a mixed body is a mixture, not a switch.
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

export interface BodyPlan {
  // size and mass
  scale: number; // adult body length, metres
  mass: number; // kg-ish; hub for upkeep (Kleiber), generation time, gape reach
  bodyDensity: number; // g/cm³, after buoy and plates
  // chemistry grammar
  chemistry: 'silicon' | 'carbon';
  segmentCount: number; // 3..16
  sides: 6 | 12; // cross-section: hexagonal prism or smooth loft
  flatShaded: boolean; // true when si > 0.45: facets read as flat
  profile: 'stepped' | 'smooth'; // radius profile: stacked repeat units (silicon) or smooth (carbon)
  bodyJointMaxDeg: number; // how far adjacent segments can bend; quantised to 15° for silicon
  jointSnapDeg: number; // 15 for silicon, 0 for carbon (continuous)
  curl: number; // radians of curl per joint (carbon); 0 for silicon
  radialOrder: number; // 0 = bilateral; 3 or 6 = radial symmetry (silicon with no legs)
  // limbs
  legPairs: number; // 0..4
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

  // --- chemistry grammar -------------------------------------------------
  const silicon = comp.si > 0.5;
  const sides = silicon ? 6 : 12;
  const jointSnapDeg = silicon ? 15 : 0;

  // --- tissue density and size --------------------------------------------
  const siShare = comp.si / Math.max(1e-9, comp.c + comp.si); // o is not a structural tissue here
  const tissue = tissueRho.C + (tissueRho.Si - tissueRho.C) * siShare;
  const bodyDensity = (1 - body.buoy) * tissue * (1 + K.PLATE_MASS.value * body.plates);

  // Adult scale before the temperature–size rule, which depends on the locomotion mode chosen below.
  const baseScale =
    G.baseScale * 2 ** (G.sizeOctaves * body.size) * (1 + G.airLift * rhoAir * body.buoy) * (1 + comp.o);

  // --- limbs --------------------------------------------------------------
  const legPairs = Math.round(4 * body.limbPairs);
  const nLegs = 2 * legPairs;
  const limbLenRel = 0.3 + 1.7 * body.limbLen; // × scale
  // Effective leg length: a bud (limbPairs below one pair) is a stubby leg; smooth, so there is no fitness valley.
  const legLenEff = limbLenRel * Math.min(1, 4 * body.limbPairs);
  const limbKind: BodyPlan['limbKind'] = legPairs === 0 ? 'none' : silicon ? 'rod' : 'tentacle';
  const limbSegments = legPairs === 0 ? 0 : silicon ? 2 : 2 + Math.round(4 * comp.c * body.limbLen);
  const limbJointAngles: number[] = [];
  if (legPairs > 0) {
    if (silicon) {
      const hip = 20 + 50 * body.limbLen;
      limbJointAngles.push(snap(hip, 15), snap(-1.5 * hip, 15)); // straight rods, one knee
    } else {
      const bend = 12 + 20 * body.limbLen;
      for (let j = 0; j < limbSegments; j++) limbJointAngles.push(bend * (j % 2 === 0 ? 1 : -1));
    }
  }

  // --- segments -----------------------------------------------------------
  const segmentCount = Math.min(16, 3 + Math.round(13 * body.segments));

  // --- locomotion (R10): cheapest of walk / swim / hover / sessile ----------------
  const rhoBodyScaled = bodyDensity / tissueRho.C; // unbuoyed carbon = 1, same scale as AIR_RHO
  const elongation = segmentCount / 12;
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

  // --- mass ---------------------------------------------------------------
  const limbFrac = nLegs * legLenEff ** 2 * G.limbMass * (1 - 0.5 * comp.si);
  const mass =
    1000 * G.fill * scale ** 3 * (bodyDensity / 1) *
    (1 + limbFrac + K.PLATE_MASS.value * body.plates + G.hornMass * body.horns + G.headMass * body.gape);

  // --- eyes and glow (reaction norms of light) --------------------------------
  const eyeArea = body.eyes * (1.5 - light);
  const eyeUpkeep = K.EYE_FRAC.value * (eyeArea / 1.5) ** 2;
  const eyeless = body.eyes < 0.05;
  const eyeCount = eyeless ? 0 : silicon ? (body.eyes < 0.4 ? 3 : body.eyes < 0.7 ? 4 : 6) : 2;
  const eyeKind: BodyPlan['eyeKind'] = eyeless ? 'none' : silicon ? 'dots' : 'rings';
  const glow = clamp(body.glow * (1 - light), 0, 1);

  // --- horns, defence, diet -------------------------------------------------------
  const hornCount = body.horns < 0.05 ? 0 : silicon ? (body.horns < 0.5 ? 1 : 3) : 2;
  const defence = Math.max(
    0,
    (body.plates + body.horns) * (1 + G.hardness * comp.si) - G.buoyDefence * body.buoy,
  );

  return {
    scale,
    mass,
    bodyDensity,
    chemistry: silicon ? 'silicon' : 'carbon',
    segmentCount,
    sides,
    flatShaded: comp.si > 0.45,
    profile: silicon ? 'stepped' : 'smooth',
    bodyJointMaxDeg: snap(55 + (14 - 55) * comp.si, jointSnapDeg),
    jointSnapDeg,
    curl: silicon ? 0 : 0.3 * comp.c,
    radialOrder: silicon && legPairs === 0 ? (body.segments < 0.5 ? 3 : 6) : 0,
    legPairs,
    limbKind,
    limbLength: legPairs === 0 ? 0 : scale * limbLenRel,
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
