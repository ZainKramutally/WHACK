// Wire format for SimSnapshot.births[].plan: develop()'s BodyPlan as a flat Float32Array.
// Layout = [PLAN_VERSION, ...PLAN_FIELDS in order]. Append only; bump PLAN_VERSION when it changes.
import type { Arm, BodyPlan, LocomotionMode } from './develop';

export const PLAN_VERSION = 5;
/** limbJointAngles is variable-length (0..6 in practice); this many slots are reserved. */
export const MAX_LIMB_JOINTS = 8;
/** Radial bodies: up to 8 arms (8-fold symmetry) and 5 hub tiers. */
export const MAX_ARMS = 8;
export const MAX_TIERS = 5;

export const PLAN_FIELDS = [
  'scale', 'mass', 'bodyDensity',
  'chemistry', // 0 carbon, 1 silicon
  'architecture', // 0 axial, 1 radial
  'symmetry', // 2 bilateral; 3, 4, 6 radial
  'segmentCount', 'sides', 'flatShaded', // flatShaded: 0/1
  'profile', // 0 smooth, 1 stepped
  'bodyJointMaxDeg', 'jointSnapDeg', 'curl',
  'tiers', 'hubRadius', 'tierHeight',
  ...Array.from({ length: MAX_TIERS }, (_, i) => `tierRadius${i}`),
  'armCount',
  ...Array.from({ length: MAX_ARMS }, (_, i) => `armAzimuth${i}`),
  ...Array.from({ length: MAX_ARMS }, (_, i) => `armLength${i}`),
  'legPairs',
  'limbKind', // 0 none, 1 rod, 2 tentacle
  'limbLength', 'limbSegments',
  'limbJointCount', // how many of the limbJointAngle slots below are used
  ...Array.from({ length: MAX_LIMB_JOINTS }, (_, i) => `limbJointAngle${i}`),
  'plateCover', 'hornCount', 'hornLength', 'gapeSize',
  'dorsal', // 0 rods, 1 frills
  'hornKind', // HORN_KINDS index
  'girth', 'flatten', 'headScale', 'gradient', 'carapace', 'crest', 'jaw',
  'tailKind', // TAIL_KINDS index
  'tailSegments', 'finSpan', 'wingSpan', 'flare',
  'armKind', // ARM_KINDS index
  'tileLength', 'hue', 'accent', 'bands', 'spots',
  'eyeKind', // 0 none, 1 dots, 2 rings
  'eyeCount', 'eyeArea', 'eyeUpkeep', 'glow',
  'defence', 'diet', 'plantGain', 'meatGain',
  'mode', // LOCOMOTION value
  'modeCostWalk', 'modeCostSwim', 'modeCostHover', 'modeCostSessile',
  'shellCover', // v4: silicon bilateral walkers: share of the segments under a ceramic shell (0 otherwise)
  'liftSpan', // v5: span of the lift surface the flight power uses, m (0 unless hovering)
] as const;
export type PlanField = (typeof PLAN_FIELDS)[number];

/** Buffer length: version + one float per field. */
export const PLAN_LENGTH = 1 + PLAN_FIELDS.length;

const IDX = Object.fromEntries(PLAN_FIELDS.map((f, i) => [f, i + 1])) as Record<PlanField, number>;
/** Index of a field in the packed buffer (for the renderer's direct reads). */
export const planField = (f: PlanField): number => IDX[f];

const LIMB_KINDS = ['none', 'rod', 'tentacle', 'leg'] as const;
const HORN_KINDS = ['none', 'pair', 'crown', 'antler', 'tusk', 'spire'] as const;
const TAIL_KINDS = ['none', 'taper', 'whip', 'fluke', 'club'] as const;
const ARM_KINDS = ['none', 'rod', 'branch', 'fan', 'whip'] as const;
const EYE_KINDS = ['none', 'dots', 'rings'] as const;

export function packBodyPlan(plan: BodyPlan): Float32Array {
  const b = new Float32Array(PLAN_LENGTH);
  const n = Math.min(plan.limbJointAngles.length, MAX_LIMB_JOINTS);
  if (plan.limbJointAngles.length > MAX_LIMB_JOINTS) throw new Error(`plan has ${plan.limbJointAngles.length} limb joints; max ${MAX_LIMB_JOINTS}`);
  b[0] = PLAN_VERSION;
  const set = (f: PlanField, v: number) => { b[IDX[f]] = v; };
  set('scale', plan.scale); set('mass', plan.mass); set('bodyDensity', plan.bodyDensity);
  set('chemistry', plan.chemistry === 'silicon' ? 1 : 0);
  set('architecture', plan.architecture === 'radial' ? 1 : 0); set('symmetry', plan.symmetry);
  set('segmentCount', plan.segmentCount); set('sides', plan.sides); set('flatShaded', plan.flatShaded ? 1 : 0);
  set('profile', plan.profile === 'stepped' ? 1 : 0);
  set('bodyJointMaxDeg', plan.bodyJointMaxDeg); set('jointSnapDeg', plan.jointSnapDeg);
  set('curl', plan.curl);
  if (plan.tierRadii.length > MAX_TIERS) throw new Error(`plan has ${plan.tierRadii.length} tiers; max ${MAX_TIERS}`);
  if (plan.arms.length > MAX_ARMS) throw new Error(`plan has ${plan.arms.length} arms; max ${MAX_ARMS}`);
  set('tiers', plan.tiers); set('hubRadius', plan.hubRadius); set('tierHeight', plan.tierHeight);
  plan.tierRadii.forEach((r, i) => { b[IDX.tierRadius0 + i] = r; });
  set('armCount', plan.arms.length);
  plan.arms.forEach((a, i) => { b[IDX.armAzimuth0 + i] = a.azimuthDeg; b[IDX.armLength0 + i] = a.length; });
  set('legPairs', plan.legPairs); set('limbKind', LIMB_KINDS.indexOf(plan.limbKind));
  set('limbLength', plan.limbLength); set('limbSegments', plan.limbSegments);
  set('limbJointCount', n);
  for (let i = 0; i < n; i++) b[IDX.limbJointAngle0 + i] = plan.limbJointAngles[i];
  set('plateCover', plan.plateCover); set('hornCount', plan.hornCount);
  set('hornLength', plan.hornLength); set('gapeSize', plan.gapeSize);
  set('dorsal', plan.dorsal === 'frills' ? 1 : 0);
  set('hornKind', HORN_KINDS.indexOf(plan.hornKind));
  set('girth', plan.girth); set('flatten', plan.flatten); set('headScale', plan.headScale); set('gradient', plan.gradient);
  set('carapace', plan.carapace); set('crest', plan.crest); set('jaw', plan.jaw);
  set('tailKind', TAIL_KINDS.indexOf(plan.tailKind)); set('tailSegments', plan.tailSegments);
  set('finSpan', plan.finSpan); set('wingSpan', plan.wingSpan); set('flare', plan.flare);
  set('armKind', ARM_KINDS.indexOf(plan.armKind)); set('tileLength', plan.tileLength);
  set('hue', plan.hue); set('accent', plan.accent); set('bands', plan.bands); set('spots', plan.spots);
  set('eyeKind', EYE_KINDS.indexOf(plan.eyeKind)); set('eyeCount', plan.eyeCount);
  set('eyeArea', plan.eyeArea); set('eyeUpkeep', plan.eyeUpkeep); set('glow', plan.glow);
  set('defence', plan.defence); set('diet', plan.diet);
  set('plantGain', plan.plantGain); set('meatGain', plan.meatGain);
  set('mode', plan.mode);
  set('modeCostWalk', plan.modeCosts.walk); set('modeCostSwim', plan.modeCosts.swim);
  set('modeCostHover', plan.modeCosts.hover); set('modeCostSessile', plan.modeCosts.sessile);
  set('shellCover', plan.shellCover);
  set('liftSpan', plan.liftSpan ?? 0);
  return b;
}

export function unpackBodyPlan(buf: Float32Array): BodyPlan {
  if (buf[0] !== PLAN_VERSION) throw new Error(`unknown plan version ${buf[0]} (expected ${PLAN_VERSION})`);
  if (buf.length !== PLAN_LENGTH) throw new Error(`plan length ${buf.length} (expected ${PLAN_LENGTH})`);
  const g = (f: PlanField) => buf[IDX[f]];
  const limbJointAngles: number[] = [];
  for (let i = 0; i < g('limbJointCount'); i++) limbJointAngles.push(buf[IDX.limbJointAngle0 + i]);
  const tierRadii: number[] = [];
  for (let i = 0; i < g('tiers'); i++) tierRadii.push(buf[IDX.tierRadius0 + i]);
  const arms: Arm[] = [];
  for (let i = 0; i < g('armCount'); i++) arms.push({ azimuthDeg: buf[IDX.armAzimuth0 + i], length: buf[IDX.armLength0 + i] });
  return {
    scale: g('scale'), mass: g('mass'), bodyDensity: g('bodyDensity'),
    chemistry: g('chemistry') === 1 ? 'silicon' : 'carbon',
    architecture: g('architecture') === 1 ? 'radial' : 'axial', symmetry: g('symmetry'),
    segmentCount: g('segmentCount'), sides: g('sides') as BodyPlan['sides'], flatShaded: g('flatShaded') === 1,
    profile: g('profile') === 1 ? 'stepped' : 'smooth',
    bodyJointMaxDeg: g('bodyJointMaxDeg'), jointSnapDeg: g('jointSnapDeg'),
    curl: g('curl'),
    tiers: g('tiers'), hubRadius: g('hubRadius'), tierHeight: g('tierHeight'), tierRadii, arms,
    legPairs: g('legPairs'), limbKind: LIMB_KINDS[g('limbKind')],
    limbLength: g('limbLength'), limbSegments: g('limbSegments'), limbJointAngles,
    plateCover: g('plateCover'), hornCount: g('hornCount'), hornLength: g('hornLength'), gapeSize: g('gapeSize'),
    dorsal: g('dorsal') === 1 ? 'frills' : 'rods',
    hornKind: HORN_KINDS[g('hornKind')],
    girth: g('girth'), flatten: g('flatten'), headScale: g('headScale'), gradient: g('gradient'),
    carapace: g('carapace'), crest: g('crest'), jaw: g('jaw'),
    tailKind: TAIL_KINDS[g('tailKind')], tailSegments: g('tailSegments'),
    finSpan: g('finSpan'), wingSpan: g('wingSpan'), flare: g('flare'),
    armKind: ARM_KINDS[g('armKind')], tileLength: g('tileLength'),
    hue: g('hue'), accent: g('accent'), bands: g('bands'), spots: g('spots'),
    eyeKind: EYE_KINDS[g('eyeKind')], eyeCount: g('eyeCount'),
    eyeArea: g('eyeArea'), eyeUpkeep: g('eyeUpkeep'), glow: g('glow'),
    defence: g('defence'), diet: g('diet'), plantGain: g('plantGain'), meatGain: g('meatGain'),
    mode: g('mode') as LocomotionMode,
    shellCover: g('shellCover'),
    liftSpan: g('liftSpan'),
    modeCosts: { walk: g('modeCostWalk'), swim: g('modeCostSwim'), hover: g('modeCostHover'), sessile: g('modeCostSessile') },
  };
}
