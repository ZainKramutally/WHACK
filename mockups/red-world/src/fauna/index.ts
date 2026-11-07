// Public fauna API. buildCreature(genes, comp, seed) is pure: the same input always gives the same plan, loft template
// and pose function. Rendering many creatures goes through buildHerd (render.ts): one loft draw + one per part type.
import type { BodyGenes, Composition, DevelopConditions } from './genome';
import { LAB_CONDITIONS } from './genome';
import { develop, type FaunaPlan } from './develop';
import { loftTemplate, type LoftTemplate } from './loft';
import { pose, type Instance, type PoseOut, type Sink } from './rig';
import type { Path } from './path';

export interface Creature {
  plan: FaunaPlan;
  loft: LoftTemplate;
  pose(t: number, path: Path, inst: Instance, sink: Sink): PoseOut;
}

export function buildCreature(genes: BodyGenes, comp: Composition, seed: number, cond: DevelopConditions = LAB_CONDITIONS): Creature {
  const plan = develop(genes, comp, seed, cond);
  return { plan, loft: loftTemplate(plan), pose: (t, path, inst, sink) => pose(plan, t, path, inst, sink) };
}

export type { BodyGenes, Composition, DevelopConditions } from './genome';
export type { FaunaPlan } from './develop';
export { develop } from './develop';
export { VARIANTS } from './variants';
