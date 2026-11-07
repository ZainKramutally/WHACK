// Wire format for SimSnapshot.births[].plan: develop()'s BodyPlan as a flat Float32Array.
// Layout = [PLAN_VERSION, ...PLAN_FIELDS in order]. Append only; bump PLAN_VERSION when it changes.
import type { BodyPlan, LocomotionMode } from './develop';

export const PLAN_VERSION = 1;
/** limbJointAngles is variable-length (0..6 in practice); this many slots are reserved. */
export const MAX_LIMB_JOINTS = 8;

export const PLAN_FIELDS = [
  'scale', 'mass', 'bodyDensity',
  'chemistry', // 0 carbon, 1 silicon
  'segmentCount', 'sides', 'flatShaded', // flatShaded: 0/1
  'profile', // 0 smooth, 1 stepped
  'bodyJointMaxDeg', 'jointSnapDeg', 'curl', 'radialOrder',
  'legPairs',
  'limbKind', // 0 none, 1 rod, 2 tentacle
  'limbLength', 'limbSegments',
  'limbJointCount', // how many of the limbJointAngle slots below are used
  ...Array.from({ length: MAX_LIMB_JOINTS }, (_, i) => `limbJointAngle${i}`),
  'plateCover', 'hornCount', 'hornLength', 'gapeSize',
  'dorsal', // 0 rods, 1 frills
  'eyeKind', // 0 none, 1 dots, 2 rings
  'eyeCount', 'eyeArea', 'eyeUpkeep', 'glow',
  'defence', 'diet', 'plantGain', 'meatGain',
  'mode', // LOCOMOTION value
  'modeCostWalk', 'modeCostSwim', 'modeCostHover', 'modeCostSessile',
] as const;
export type PlanField = (typeof PLAN_FIELDS)[number];

/** Buffer length: version + one float per field. */
export const PLAN_LENGTH = 1 + PLAN_FIELDS.length;

const IDX = Object.fromEntries(PLAN_FIELDS.map((f, i) => [f, i + 1])) as Record<PlanField, number>;
/** Index of a field in the packed buffer (for the renderer's direct reads). */
export const planField = (f: PlanField): number => IDX[f];

const LIMB_KINDS = ['none', 'rod', 'tentacle'] as const;
const EYE_KINDS = ['none', 'dots', 'rings'] as const;

export function packBodyPlan(plan: BodyPlan): Float32Array {
  const b = new Float32Array(PLAN_LENGTH);
  const n = Math.min(plan.limbJointAngles.length, MAX_LIMB_JOINTS);
  if (plan.limbJointAngles.length > MAX_LIMB_JOINTS) throw new Error(`plan has ${plan.limbJointAngles.length} limb joints; max ${MAX_LIMB_JOINTS}`);
  b[0] = PLAN_VERSION;
  const set = (f: PlanField, v: number) => { b[IDX[f]] = v; };
  set('scale', plan.scale); set('mass', plan.mass); set('bodyDensity', plan.bodyDensity);
  set('chemistry', plan.chemistry === 'silicon' ? 1 : 0);
  set('segmentCount', plan.segmentCount); set('sides', plan.sides); set('flatShaded', plan.flatShaded ? 1 : 0);
  set('profile', plan.profile === 'stepped' ? 1 : 0);
  set('bodyJointMaxDeg', plan.bodyJointMaxDeg); set('jointSnapDeg', plan.jointSnapDeg);
  set('curl', plan.curl); set('radialOrder', plan.radialOrder);
  set('legPairs', plan.legPairs); set('limbKind', LIMB_KINDS.indexOf(plan.limbKind));
  set('limbLength', plan.limbLength); set('limbSegments', plan.limbSegments);
  set('limbJointCount', n);
  for (let i = 0; i < n; i++) b[IDX.limbJointAngle0 + i] = plan.limbJointAngles[i];
  set('plateCover', plan.plateCover); set('hornCount', plan.hornCount);
  set('hornLength', plan.hornLength); set('gapeSize', plan.gapeSize);
  set('dorsal', plan.dorsal === 'frills' ? 1 : 0);
  set('eyeKind', EYE_KINDS.indexOf(plan.eyeKind)); set('eyeCount', plan.eyeCount);
  set('eyeArea', plan.eyeArea); set('eyeUpkeep', plan.eyeUpkeep); set('glow', plan.glow);
  set('defence', plan.defence); set('diet', plan.diet);
  set('plantGain', plan.plantGain); set('meatGain', plan.meatGain);
  set('mode', plan.mode);
  set('modeCostWalk', plan.modeCosts.walk); set('modeCostSwim', plan.modeCosts.swim);
  set('modeCostHover', plan.modeCosts.hover); set('modeCostSessile', plan.modeCosts.sessile);
  return b;
}

export function unpackBodyPlan(buf: Float32Array): BodyPlan {
  if (buf[0] !== PLAN_VERSION) throw new Error(`unknown plan version ${buf[0]} (expected ${PLAN_VERSION})`);
  if (buf.length !== PLAN_LENGTH) throw new Error(`plan length ${buf.length} (expected ${PLAN_LENGTH})`);
  const g = (f: PlanField) => buf[IDX[f]];
  const limbJointAngles: number[] = [];
  for (let i = 0; i < g('limbJointCount'); i++) limbJointAngles.push(buf[IDX.limbJointAngle0 + i]);
  return {
    scale: g('scale'), mass: g('mass'), bodyDensity: g('bodyDensity'),
    chemistry: g('chemistry') === 1 ? 'silicon' : 'carbon',
    segmentCount: g('segmentCount'), sides: g('sides') as 6 | 12, flatShaded: g('flatShaded') === 1,
    profile: g('profile') === 1 ? 'stepped' : 'smooth',
    bodyJointMaxDeg: g('bodyJointMaxDeg'), jointSnapDeg: g('jointSnapDeg'),
    curl: g('curl'), radialOrder: g('radialOrder'),
    legPairs: g('legPairs'), limbKind: LIMB_KINDS[g('limbKind')],
    limbLength: g('limbLength'), limbSegments: g('limbSegments'), limbJointAngles,
    plateCover: g('plateCover'), hornCount: g('hornCount'), hornLength: g('hornLength'), gapeSize: g('gapeSize'),
    dorsal: g('dorsal') === 1 ? 'frills' : 'rods',
    eyeKind: EYE_KINDS[g('eyeKind')], eyeCount: g('eyeCount'),
    eyeArea: g('eyeArea'), eyeUpkeep: g('eyeUpkeep'), glow: g('glow'),
    defence: g('defence'), diet: g('diet'), plantGain: g('plantGain'), meatGain: g('meatGain'),
    mode: g('mode') as LocomotionMode,
    modeCosts: { walk: g('modeCostWalk'), swim: g('modeCostSwim'), hover: g('modeCostHover'), sessile: g('modeCostSessile') },
  };
}
