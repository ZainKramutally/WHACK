// The bridge the app will use: swimmerParamsFromPlan(plan, genes) maps the app's develop() BodyPlan (PLAN_VERSION 3,
// src/sim/develop.ts) plus the organism's body genes to SwimmerParams. Pure: same input → same output.
// AppBodyPlan is a structural subset of the app's BodyPlan (copied, not imported: mockups never import across
// projects), so the app's BodyPlan (or unpackBodyPlan(births[i].plan)) is assignable to it as is.
// The full mapping table is in docs/features/aquatic-life.md.
import type { PaletteKey } from '../../contracts';
import { DEFAULT_PARAMS, normaliseParams, type BodyPlanKind, type Symmetry, type SwimmerParams, type TailKind } from './params';

export interface AppBodyPlan {
  scale: number;
  chemistry: 'silicon' | 'carbon';
  architecture: 'axial' | 'radial';
  symmetry: number;
  segmentCount: number;
  tiers: number;
  hubRadius: number;
  arms: { azimuthDeg: number; length: number }[];
  legPairs: number;
  plateCover: number;
  hornCount: number;
  hornLength: number;
  hornKind: 'none' | 'pair' | 'crown' | 'antler' | 'tusk' | 'spire';
  dorsal: 'rods' | 'frills';
  girth: number;
  flatten: number;
  gradient: number;
  carapace: number;
  crest: number;
  jaw: number;
  tailKind: 'none' | 'taper' | 'whip' | 'fluke' | 'club';
  finSpan: number;
  flare: number;
  armKind: 'none' | 'rod' | 'branch' | 'fan' | 'whip';
  tileLength: number;
  hue: number;
  accent: number;
  eyeKind: 'dots' | 'rings' | 'none';
  eyeCount: number;
  eyeArea: number;
  glow: number;
  diet: number;
  mode: number; // LOCOMOTION: 0 walk, 1 swim, 2 hover, 3 sessile
}

/** The body genes the bridge reads (OrganismField genes 12..23); all optional. */
export interface AppGenes { sociality?: number; size?: number; buoy?: number }

const cl = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Axial body plan kind from the plan's form traits (first match wins). */
export function axialKind(p: AppBodyPlan): BodyPlanKind {
  if (p.segmentCount >= 11 && p.girth < 0.6) return 'ribbon';
  if (p.plateCover >= 0.45 || p.legPairs >= 2 || p.carapace >= 0.4) return 'segmented';
  if (p.flatten < 0.65 && p.girth >= 0.9) return 'disc';
  return 'fusiform';
}

/** Radial kind: a flared or whip-armed hub carries its tissue as a bell; the rest row with rod arms. */
export function radialKind(p: AppBodyPlan): BodyPlanKind {
  return p.flare > 0.25 || p.armKind === 'whip' ? 'bell' : 'radial';
}

function carbonColours(p: AppBodyPlan): { body: PaletteKey; accent: PaletteKey } {
  // hunters warm red (reads on dark water and pale), grazers pale bone/blush; accent from the lineage accent value
  const body: PaletteKey = p.diet > 0.6 ? 'red' : p.diet < 0.3 ? (p.hue < 0.5 ? 'bone' : 'blush') : 'redLight';
  const acc: PaletteKey[] = ['crimson', 'maroon', 'blush', 'bone'];
  let accent = acc[Math.min(3, Math.floor(p.accent * 4))];
  if (accent === body) accent = body === 'bone' ? 'crimson' : 'maroon';
  return { body, accent };
}

function siliconColours(p: AppBodyPlan, kind: BodyPlanKind): { body: PaletteKey; accent: PaletteKey } {
  // SI_PALETTE roles: bone = ice white, red = pale lilac, crimson = violet, maroon = indigo, blush = ice blue
  // bells are ice-white glass with a violet accent; hubs are violet crystal (reads on pale nitrogen and dark water alike)
  // two values so it reads on dark water and pale nitrogen: a pale body (ice / pale lilac) and a dark accent
  // (indigo / violet) on arms, rims and stems; hunters swap to a violet body with an ice accent
  const body: PaletteKey = kind === 'bell' ? 'bone' : p.diet > 0.6 ? 'crimson' : 'red';
  const accent: PaletteKey = p.diet > 0.6 ? 'bone' : p.accent < 0.5 ? 'maroon' : 'crimson';
  return { body, accent };
}

/**
 * BodyPlan (+ genes) → SwimmerParams. Meant for mode = 1 (swim) organisms; any plan maps, the chemistry grammar is kept:
 * silicon → radial (hub rower or bell/chain), carbon → axial (fusiform, ribbon, disc or segmented).
 */
export function swimmerParamsFromPlan(plan: AppBodyPlan, genes: AppGenes = {}): SwimmerParams {
  const p = structuredClone(DEFAULT_PARAMS);
  const social = genes.sociality ?? 0.2;
  const small = plan.scale < 0.6 ? 1 : plan.scale < 1.5 ? 0.35 : 0.1;
  p.school = 1 + Math.round(social * social * 28 * small);
  p.glow = cl(plan.glow, 0, 1);
  const eyeBig = cl(plan.eyeArea / 1.5, 0, 1);

  if (plan.chemistry === 'silicon' || plan.architecture === 'radial') {
    const kind = radialKind(plan);
    const armRel = plan.arms.length ? plan.arms[0].length / Math.max(1e-6, plan.scale) : 0.6;
    p.chemistry = 'silicon';
    p.plan = kind;
    p.length = kind === 'bell' ? 0.5 * plan.scale : plan.scale;
    p.aspect = kind === 'bell' ? 0.9 + 0.6 * cl(plan.flare, 0, 1) : cl((2 * plan.hubRadius) / Math.max(1e-6, plan.scale) * 0.9, 0.3, 1);
    p.depth = 1;
    p.radial = {
      symmetry: ([3, 4, 5, 6, 8].includes(plan.symmetry) ? plan.symmetry : 6) as Symmetry,
      armLen: cl(armRel * 1.1, 0.3, 2),
      tiers: cl(plan.tiers, 1, 5),
      chain: kind === 'bell' ? cl(plan.tiers - 1, 1, 5) : 1,
      spikes: cl(plan.tileLength, 0, 1),
      trail: kind === 'bell' ? (plan.armKind === 'whip' ? 1.5 + armRel : 0.8) : plan.armKind === 'branch' ? 0.4 : 0,
    };
    p.head = { ...p.head, eyes: plan.eyeKind === 'none' ? 0 : Math.max(1, Math.round(plan.eyeCount / Math.max(1, plan.symmetry))), eyeSize: 0.025 + 0.025 * eyeBig, stalks: 0, feelers: plan.armKind === 'branch' ? 2 : 0, crest: 0, mouth: 'none' };
    p.fins = { lateral: 0, lateralSize: 0, dorsal: 0, ventral: 0, fringe: 0 };
    p.tail = 'none';
    p.plates = cl(plan.plateCover, 0, 1);
    p.translucency = kind === 'bell' ? 0.75 : cl(0.35 + 0.3 * plan.glow, 0, 1);
    p.lateralLine = 0;
    p.photophores = 0;
    p.colour = siliconColours(plan, kind);
    return normaliseParams(p);
  }

  const kind = axialKind(plan);
  const n = Math.max(3, plan.segmentCount);
  p.chemistry = 'carbon';
  p.plan = kind;
  p.length = plan.scale;
  p.aspect = cl((plan.girth / n) * 1.2, 0.025, 0.6);
  p.depth = kind === 'ribbon' ? cl(2.6 * plan.flatten, 1.5, 4) : kind === 'segmented' ? cl(0.45 * plan.flatten, 0.25, 0.7) : kind === 'disc' ? 0.5 : cl(1.1 * plan.flatten + 0.6 * plan.crest, 0.6, 2.6);
  p.peak = cl(0.45 - 0.4 * plan.gradient, 0.2, 0.6);
  p.undulation = cl((n - 4) / 10, 0, 1);
  p.fins = {
    lateral: kind === 'segmented' ? cl(n - 2, 4, 13) : plan.legPairs > 0 ? Math.min(2, plan.legPairs) : plan.finSpan > 0 ? 1 : 0,
    lateralSize: kind === 'segmented' ? 0.12 + 0.12 * plan.finSpan : 0.08 + 0.2 * plan.finSpan,
    dorsal: plan.crest * (kind === 'ribbon' ? 0.12 : 0.1) + (plan.dorsal === 'frills' ? 0.02 : 0),
    ventral: kind === 'fusiform' ? 0.2 * cl(plan.flatten - 0.8, 0, 1) * (1 - plan.plateCover) : 0,
    fringe: kind === 'segmented' ? 0.85 : kind === 'ribbon' ? cl(0.2 + 0.6 * plan.crest, 0, 1) : 0,
  };
  const tails: Record<AppBodyPlan['tailKind'], TailKind> = { none: 'taper', taper: plan.finSpan > 0.3 ? 'fork' : 'taper', whip: 'whip', fluke: 'lunate', club: 'fan' };
  p.tail = kind === 'segmented' ? 'fan' : tails[plan.tailKind];
  p.tailSize = 0.15 + 0.3 * plan.finSpan;
  const grasp = plan.diet > 0.55 && plan.hornCount > 0;
  p.head = {
    eyes: plan.eyeKind === 'none' ? 0 : cl(plan.eyeCount, 0, 6),
    eyeSize: 0.02 + 0.03 * eyeBig,
    stalks: cl((plan.eyeArea - 0.8) * 0.25, 0, 0.2) * (kind === 'segmented' ? 1.5 : 1),
    feelers: grasp ? Math.min(4, plan.hornKind === 'pair' || plan.hornKind === 'tusk' ? 2 : plan.hornCount) : 0,
    feelerLen: cl((plan.hornLength / Math.max(1e-6, plan.scale)) * 1.5 + 0.15, 0.1, 0.9),
    mouth: plan.jaw > 0.5 ? 'jaw' : plan.diet > 0.6 ? 'cone' : 'none',
    crest: Math.round(plan.crest * 6),
  };
  p.lateralLine = plan.glow > 0.1 ? 0.8 * plan.glow : 0;
  p.photophores = Math.round(plan.glow * 16 * cl(1 - n / 20, 0, 1));
  p.plates = Math.max(plan.plateCover, plan.carapace) * (kind === 'segmented' ? 1 : 0.6);
  p.translucency = cl(0.15 + 0.4 * plan.glow - 0.5 * plan.plateCover, 0, 0.7);
  p.colour = carbonColours(plan);
  return normaliseParams(p);
}
