// Rule 6: relationships come from bodies (DECISIONS §3). Pure. The only inputs are a develop() BodyPlan's
// scale, gape, defence and diet, plus lineage and sociality. No species names, no role input, no preset ids.
import type { BodyPlan } from './develop';

export interface RelBody {
  plan: Pick<BodyPlan, 'scale' | 'gapeSize' | 'defence' | 'diet'>;
  lineage: number;
  sociality: number; // the sociality gene, 0..1
}

export interface RelContext {
  /** Plant scarcity 0..1 (demand ÷ supply). Shared pools matter more when food is short. */
  hunger: number;
}

/** What `a` thinks of `b`. All 0..1. */
export interface Relation { eats: number; afraid: number; rival: number; kin: number }

/** R4: prey is edible iff 2·gape·S > S_prey·(1 + defence); `gapeSize` is already 2·gape·S. Intensity is the meat share of the diet. */
export function eatsIntensity(
  a: Pick<BodyPlan, 'gapeSize' | 'diet'>,
  b: Pick<BodyPlan, 'scale' | 'defence'>,
): number {
  return a.gapeSize > b.scale * (1 + b.defence) ? a.diet * a.diet : 0;
}

/** Shared plant pools: both graze, and their diets overlap. */
export function rivalOverlap(a: Pick<BodyPlan, 'diet'>, b: Pick<BodyPlan, 'diet'>): number {
  const pa = (1 - a.diet) ** 2;
  const pb = (1 - b.diet) ** 2;
  return Math.min(pa, pb) * (1 - Math.abs(a.diet - b.diet));
}

/** Same lineage, weighted by how social both are. */
export function kinStrength(a: RelBody, b: RelBody): number {
  return a.lineage === b.lineage ? Math.min(a.sociality, b.sociality) : 0;
}

export function relationship(a: RelBody, b: RelBody, ctx: RelContext): Relation {
  return {
    eats: eatsIntensity(a.plan, b.plan),
    afraid: eatsIntensity(b.plan, a.plan),
    rival: rivalOverlap(a.plan, b.plan) * Math.min(1, Math.max(0, ctx.hunger)),
    kin: kinStrength(a, b),
  };
}
