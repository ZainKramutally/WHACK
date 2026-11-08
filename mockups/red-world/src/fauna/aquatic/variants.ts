// The five review swimmers. Each starts from a BodyPlan-like input (the fields the app's develop() would give a
// swimming organism, mode = 1) and its genes, goes through swimmerParamsFromPlan(), then a small hand-tuned override
// shows the generator is configurable. Field-guide names are for review only.
import type { AppBodyPlan, AppGenes } from './fromPlan';
import { swimmerParamsFromPlan } from './fromPlan';
import { mergeParams, type DeepPartial, type SwimmerParams } from './params';

export interface AquaticVariant {
  name: string;
  why: string;
  inspiration: string;
  plan: AppBodyPlan;
  genes: AppGenes;
  override: DeepPartial<SwimmerParams>;
}

/** A swimming BodyPlan with neutral defaults; pass only what differs. */
export function planLike(o: Partial<AppBodyPlan>): AppBodyPlan {
  return {
    scale: 1, chemistry: 'carbon', architecture: 'axial', symmetry: 2, segmentCount: 8, tiers: 0, hubRadius: 0, arms: [],
    legPairs: 0, plateCover: 0, hornCount: 0, hornLength: 0, hornKind: 'none', dorsal: 'frills', girth: 0.8, flatten: 1,
    gradient: 0, carapace: 0, crest: 0, jaw: 0, tailKind: 'taper', finSpan: 0.4, flare: 0, armKind: 'none', tileLength: 0,
    hue: 0.5, accent: 0.5, eyeKind: 'rings', eyeCount: 2, eyeArea: 0.6, glow: 0, diet: 0.3, mode: 1, ...o,
  };
}

const radialArms = (n: number, length: number) => Array.from({ length: n }, (_, k) => ({ azimuthDeg: (360 / n) * k, length }));

export const AQUATIC_VARIANTS: AquaticVariant[] = [
  {
    name: 'Crested Oarwyrm',
    inspiration: 'oarfish, lancelet',
    why: 'segments 16 on a thin body (girth .42) → a 7 m ribbon that swims anguilliform by rippling one long dorsal sail; crest .9 → a crown of rays; glow .35 → a faint lateral line.',
    plan: planLike({ scale: 7, segmentCount: 16, girth: 0.42, flatten: 1.1, gradient: 0.4, crest: 0.9, tailKind: 'whip', finSpan: 0.3, eyeArea: 0.9, glow: 0.35, diet: 0.25, hue: 0.3, accent: 0.1 }),
    genes: { sociality: 0.1 },
    override: { aspect: 0.05, fins: { dorsal: 0.075 }, head: { crest: 7, eyeSize: 0.012 }, photophores: 0, lateralLine: 0.5, school: 2 },
  },
  {
    name: 'Five-eyed Lobeclaw',
    inspiration: 'Anomalocaris, Opabinia',
    why: 'a plated hunter (plates .6, diet .9): its segments become nine pairs of lateral lobes that row in a metachronal wave, horns become two grasping frontal claws, and eyes 1.2 in the dark sit on stalks (five, as Opabinia).',
    plan: planLike({ scale: 2.2, segmentCount: 11, girth: 1.0, flatten: 0.8, plateCover: 0.6, carapace: 0.5, hornCount: 2, hornKind: 'pair', hornLength: 0.66, jaw: 0.2, tailKind: 'club', finSpan: 0.6, eyeCount: 4, eyeArea: 1.2, glow: 0.15, diet: 0.9, accent: 0.3 }),
    genes: { sociality: 0.15 },
    override: { aspect: 0.2, fins: { lateralSize: 0.13 }, head: { eyes: 5, feelerLen: 0.34 }, photophores: 0, lateralLine: 0, colour: { accent: 'blush' }, school: 3 },
  },
  {
    name: 'Lantern Hatchet',
    inspiration: 'hatchetfish, lanternfish',
    why: 'tiny (28 cm) and social (.95) → it schools; four segments and a deep body → carangiform tail beats; glow .85 in the dark → a ventral photophore row along its keel blade; big eyes (eyeArea 1.4).',
    plan: planLike({ scale: 0.28, segmentCount: 4, girth: 1.4, flatten: 1.3, crest: 0.5, tailKind: 'fluke', finSpan: 0.5, eyeArea: 1.4, glow: 0.85, diet: 0.1, hue: 0.2, accent: 0.1 }),
    genes: { sociality: 0.95 },
    override: { aspect: 0.12, depth: 3.2, peak: 0.3, tail: 'fork', tailSize: 0.32, fins: { ventral: 0.24, dorsal: 0.1 }, head: { eyes: 4, stalks: 0.06, eyeSize: 0.05, crest: 0 }, lateralLine: 0.25, school: 32 },
  },
  {
    name: 'Glass Oarstar',
    inspiration: 'radiolarian, nauplius, sea angel',
    why: 'silicon (si .8) is radial: six-fold symmetry (limbPairs .6) on a three-tier crystal hub; its rod arms row in stepped 15° beats with faceted paddles and fold to recover; two dot eyes per arm tip; glow .7 lights its core through the facets.',
    plan: planLike({ chemistry: 'silicon', architecture: 'radial', symmetry: 6, segmentCount: 0, tiers: 3, scale: 1.1, hubRadius: 0.35, arms: radialArms(6, 0.85), flare: -0.3, armKind: 'rod', tileLength: 0.4, eyeKind: 'dots', eyeCount: 12, eyeArea: 1.2, glow: 0.7, diet: 0.3, accent: 0.3, plateCover: 0.3 }),
    genes: { sociality: 0.5 },
    override: { school: 10, radial: { spikes: 0.5, armLen: 0.62 } },
  },
  {
    name: 'Prism Lanternchain',
    inspiration: 'siphonophore, ctenophore, pyrosome',
    why: 'a flared buoyant hub (flare .6) carries its tissue as faceted translucent bells; five tiers accrete into a four-bell colony that jet-pulses in sequence; eight comb rows shimmer with glow .9; whip arms trail as a 15°-jointed lit lattice.',
    plan: planLike({ chemistry: 'silicon', architecture: 'radial', symmetry: 8, segmentCount: 0, tiers: 5, scale: 1.6, hubRadius: 0.5, arms: radialArms(8, 1.44), flare: 0.6, armKind: 'whip', eyeKind: 'dots', eyeCount: 8, eyeArea: 1.0, glow: 0.9, diet: 0.2, accent: 0.7 }),
    genes: { sociality: 0.3 },
    override: { aspect: 1.1, school: 2 },
  },
];

/** The variant's params: plan → params bridge, then the hand-tuned override. */
export function variantParams(v: AquaticVariant): SwimmerParams {
  return mergeParams(swimmerParamsFromPlan(v.plan, v.genes), v.override);
}
