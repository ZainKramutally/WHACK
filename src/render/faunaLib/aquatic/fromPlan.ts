// Copied from mockups/red-world/src/fauna/aquatic/ (never imported; docs/features/aquatic-life.md). Edits for the app: imports only.
// The bridge the app will use: swimmerParamsFromPlan(plan, genes) maps the app's develop() BodyPlan (PLAN_VERSION 3,
// src/sim/develop.ts) plus the organism's body genes to SwimmerParams. Pure: same input → same output.
// AppBodyPlan is a structural subset of the app's BodyPlan (copied, not imported: mockups never import across
// projects), so the app's BodyPlan (or unpackBodyPlan(births[i].plan)) is assignable to it as is.
// The full mapping table is in docs/features/aquatic-life.md.
import type { LookKey as PaletteKey } from '../../palette';
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
  limbLength: number; // metres (0 without limbs)
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
  headScale: number; // axial: head size ÷ trunk, 0.75 … 2
  gapeSize: number; // metres of mouth reach
  tailSegments: number; // axial: beads behind the trunk
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

/** The body genes the bridge reads from the organism record (OrganismField genes 12..23, here only sociality); optional. */
export interface AppGenes { sociality?: number }

const cl = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Neck (skull to front girdle) ÷ body length, render-side: longer with more spine segments, shorter with a bigger head
 * or a wider gape, so small-headed grazers grow long necks and big-jawed hunters short ones. Pure, and monotone in each
 * input. fauna.ts passes the species book's attract()ed plan, so a species shares its head and gape (segments are the
 * animal's own count).
 */
export function neckFrac(p: Pick<AppBodyPlan, 'segmentCount' | 'headScale' | 'gapeSize' | 'scale'>): number {
  const seg = cl((p.segmentCount - 3) / 13, 0, 1);
  const head = cl((p.headScale - 0.75) / 1.25, 0, 1);
  const gape = cl(p.gapeSize / Math.max(1e-6, p.scale) / 2, 0, 1);
  return 0.06 + 0.39 * seg * (1 - 0.55 * head) * (1 - 0.45 * gape);
}

/** Tail (hind girdle or peak girth to tip) ÷ body length, from the tail kind and its segments: whips long, flukes short. */
export function tailFrac(p: Pick<AppBodyPlan, 'tailKind' | 'tailSegments'>): number {
  const base = p.tailKind === 'whip' ? 0.2 : p.tailKind === 'fluke' ? 0.12 : 0.14;
  return cl(base + 0.03 * Math.max(0, p.tailSegments), 0.1, 0.4);
}

/** Axial body plan kind from the plan's form traits (first match wins). */
export function axialKind(p: AppBodyPlan): BodyPlanKind {
  // two or more limb pairs with long limbs (or wide fins) fly underwater on four flippers
  if (p.legPairs >= 2 && (p.limbLength >= p.scale || p.finSpan >= 0.7)) return 'plesiosaur';
  if (p.segmentCount >= 11 && p.girth < 0.6) return 'ribbon';
  if (p.plateCover >= 0.6 || p.carapace >= 0.6) return 'segmented'; // heavy armour rows on lobes; everything else swims like a fish
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
  // SI_PALETTE roles: bone = ice white, blush = ice blue, red = pale lilac, crimson = violet, maroon = indigo.
  // Value contrast carries the read in both waters (the material's rim flips: blush on dark water, indigo on pale
  // nitrogen). Hubs are violet crystal with ice-pale rod arms (the land look: violet bodies, pale accent, cyan arm-tip
  // eyes); bells are pale-lilac glass with violet rims and stems. Hunters go a step darker (indigo hub or rims).
  const hunter = p.diet > 0.6;
  if (kind === 'bell') return { body: 'red', accent: hunter ? 'maroon' : 'crimson' };
  return { body: hunter ? 'maroon' : 'crimson', accent: p.accent < 0.5 ? 'bone' : 'blush' };
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
    p.plates = 0; // axial tergites only: silicon armour shows as facet spikes (tileLength, which develop() grows from plates)
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
  // girth is segment thickness ÷ segment length, so the trunk's cross-section ÷ length is girth / n; compressed (^0.6) so
  // short fat plans don't become balls and long thin ones don't vanish. depth (height ÷ width) splits that section:
  // flatten 0.45 → flat, 1.3 → hatchet-deep; a crest deepens it further.
  const section = cl(0.45 * (plan.girth / n) ** 0.6, 0.03, 0.4);
  p.depth = kind === 'ribbon' ? cl(2.6 * plan.flatten, 1.5, 4) : kind === 'segmented' ? cl(0.45 * plan.flatten, 0.25, 0.7) : kind === 'disc' ? 0.5
    : cl(0.7 + 2.2 * cl((plan.flatten - 0.45) / 0.85, 0, 1) ** 1.2 + 0.4 * plan.crest, 0.6, 3.4);
  p.aspect = kind === 'disc' ? cl((2.2 * section) / Math.sqrt(p.depth), 0.3, 1.2) : cl(section / Math.sqrt(p.depth), 0.02, 0.6);
  // a longer tail moves the widest point forward, so the taper behind it (the tail stock) runs longer
  p.peak = cl(0.45 - 0.4 * plan.gradient - 0.8 * (tailFrac(plan) - 0.2), 0.2, 0.6);
  p.undulation = cl((n - 4) / 10, 0, 1);
  // Fish-like by default (owner feedback): very small fins, all rooted on the body: a small dorsal, one small pectoral
  // pair just behind the head (none on eel ribbons), and a caudal fin from the tail kind. Heavy armour rows on small lobes.
  if (kind === 'plesiosaur') {
    // a broad barrel on four long flippers that do the swimming (fringe: the body barely waves); no dorsal, a short tail
    const limbRel = plan.limbLength / Math.max(1e-6, plan.scale);
    p.aspect = cl(1.6 * section, 0.16, 0.3);
    p.depth = cl(0.75 * plan.flatten, 0.55, 0.95);
    p.undulation = 0.1;
    p.neck = neckFrac(plan);
    p.tailLen = tailFrac(plan);
    p.fins = { lateral: 2, lateralSize: cl(0.22 + 0.1 * (limbRel - 1) + 0.08 * plan.finSpan, 0.22, 0.42), dorsal: 0, ventral: 0, fringe: 0.85 };
    p.tail = 'taper';
    p.tailSize = 0;
  } else p.fins = {
    lateral: kind === 'segmented' ? cl(n - 2, 4, 13) : kind === 'ribbon' ? 0 : 1,
    lateralSize: kind === 'segmented' ? 0.06 + 0.06 * plan.finSpan : 0.05 + 0.05 * plan.finSpan,
    dorsal: (kind === 'ribbon' ? 0.03 + 0.06 * plan.crest : 0.04 + 0.05 * plan.crest) + (plan.dorsal === 'frills' ? 0.01 : 0),
    ventral: 0,
    fringe: kind === 'segmented' ? 0.85 : kind === 'ribbon' ? cl(0.2 + 0.6 * plan.crest, 0, 1) : 0,
  };
  const tails: Record<AppBodyPlan['tailKind'], TailKind> = { none: 'fork', taper: 'fork', whip: 'whip', fluke: 'lunate', club: 'fan' };
  if (kind !== 'plesiosaur') {
    p.tail = kind === 'segmented' ? 'fan' : tails[plan.tailKind];
    p.tailSize = 0.1 + 0.12 * plan.finSpan;
  }
  const grasp = plan.diet > 0.55 && plan.hornCount > 0;
  p.head = {
    eyes: plan.eyeKind === 'none' ? 0 : cl(plan.eyeCount, 0, 6),
    eyeSize: (0.22 + 0.3 * eyeBig) * section * 0.5, // eyes scale with the head's section, bigger in the dark
    stalks: cl((plan.eyeArea - 0.8) * 0.25, 0, 0.2) * (kind === 'segmented' ? 1.5 : 1),
    feelers: grasp && kind === 'segmented' ? Math.min(4, plan.hornKind === 'pair' || plan.hornKind === 'tusk' ? 2 : plan.hornCount) : 0,
    feelerLen: cl((plan.hornLength / Math.max(1e-6, plan.scale)) * 1.5 + 0.15, 0.1, 0.9),
    mouth: plan.jaw > 0.5 ? 'jaw' : plan.diet > 0.6 ? 'cone' : 'none',
    crest: Math.round(plan.crest * 6),
  };
  // glow from darkness: a lateral line once it is clearly expressed; a ventral photophore row on shorter bodies, and only
  // when it is a row (≥ 3 pairs), never a stray dot
  p.lateralLine = plan.glow > 0.2 ? 0.8 * plan.glow : 0;
  const rowPairs = plan.glow > 0.3 ? Math.round(plan.glow * 16 * cl(1 - n / 20, 0, 1)) : 0;
  p.photophores = rowPairs >= 3 ? rowPairs : 0;
  p.plates = Math.max(plan.plateCover, plan.carapace) * (kind === 'segmented' ? 1 : 0.6);
  p.translucency = cl(0.15 + 0.4 * plan.glow - 0.5 * plan.plateCover, 0, 0.7);
  p.colour = carbonColours(plan);
  return normaliseParams(p);
}
