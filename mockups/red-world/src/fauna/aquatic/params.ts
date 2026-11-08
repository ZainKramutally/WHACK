// Aquatic swimmer parameters: the documented, configurable input to buildSwimmer(params, seed).
// Everything a swimmer looks like and how it moves comes from these numbers (lengths are metres or ÷ body length).
// Chemistry is the grammar (CLAUDE.md "Development"): carbon swimmers are bilateral and axial (fusiform, ribbon, disc,
// segmented), silicon swimmers are radial/lattice (a crystal hub that rows with rod arms, or faceted bells, alone or in
// a colony chain). normaliseParams() enforces that, so no setting can build a bilateral silicon swimmer.
import type { PaletteKey } from '../../contracts';

export type Chemistry = 'carbon' | 'silicon';
/** Axial (carbon): fusiform | ribbon | disc | segmented. Radial (silicon): radial (hub rower) | bell (one bell or a chain). */
export type BodyPlanKind = 'fusiform' | 'ribbon' | 'disc' | 'segmented' | 'radial' | 'bell';
export const AXIAL_PLANS: BodyPlanKind[] = ['fusiform', 'ribbon', 'disc', 'segmented'];
export const RADIAL_PLANS: BodyPlanKind[] = ['radial', 'bell'];
/** fork / lunate: two vertical blades; fan: three horizontal blade pairs (anomalocarid); whip: a long filament. */
export type TailKind = 'none' | 'taper' | 'fork' | 'lunate' | 'fan' | 'whip';
/** jaw: a protruding lower jaw; cone: a ring-toothed oral cone under the head; proboscis: a long grasping snout (Opabinia). */
export type MouthKind = 'none' | 'jaw' | 'cone' | 'proboscis';
export type Symmetry = 3 | 4 | 5 | 6 | 8;

export interface SwimmerParams {
  chemistry: Chemistry;
  plan: BodyPlanKind;
  /** m: nose→tail (axial), hub tip→tip along the travel axis (radial), height of one bell (bell). */
  length: number;
  /** Widest body width ÷ length (axial), hub width ÷ length (radial), bell rim diameter ÷ bell height (bell). */
  aspect: number;
  /** Cross-section height ÷ width: > 1 laterally compressed (oarfish, hatchetfish), < 1 flattened (anomalocarid). */
  depth: number;
  /** 0..1: where along the body the girth peaks (0.25 = blunt head and a long taper). */
  peak: number;
  /** 0 carangiform (rear-third tail beat) … 1 anguilliform (the whole body waves). Axial only. */
  undulation: number;
  fins: {
    /** Pairs of lateral fins: 1–2 = pectoral paddles, ≥ 3 = a lobed fringe that ripples metachronally (anomalocarid). */
    lateral: number;
    /** Lateral fin length ÷ body length. */
    lateralSize: number;
    /** Dorsal sail height ÷ body length (0 = none); a long sail ripples (oarfish). */
    dorsal: number;
    /** Ventral keel depth ÷ body length (the hatchetfish blade), 0 = none. */
    ventral: number;
    /** 0..1: share of thrust from fin ripple instead of the body wave (high: the body stays straight, the fins row). */
    fringe: number;
  };
  tail: TailKind;
  /** Tail fin span ÷ body length. */
  tailSize: number;
  head: {
    /** Eye count. Axial: pairs, plus a median eye when odd (Opabinia has five). Radial: dot eyes per arm tip. */
    eyes: number;
    /** Eye radius ÷ length. */
    eyeSize: number;
    /** Eye stalk length ÷ length (0 = eyes sit in the head). */
    stalks: number;
    /** Grasping frontal appendages (axial, 0..4: anomalocarid claws) or arm-tip feelers (radial). */
    feelers: number;
    /** Feeler length ÷ length. */
    feelerLen: number;
    mouth: MouthKind;
    /** Head crest rays (the oarfish crown), 0..8. */
    crest: number;
  };
  /** 0..1: glow dots along the mid-flank lateral line. */
  lateralLine: number;
  /** Ventral photophores (counter-illumination row), 0..24. */
  photophores: number;
  /** 0..1: dorsal armour plates (tergites) along the back. Axial only. */
  plates: number;
  /** 0..1: how see-through the body tissue is (fins and bells first). */
  translucency: number;
  /** 0..1: expressed glow (BodyPlan.glow = glow gene × darkness). Scales every cyan accent. */
  glow: number;
  /** One body colour + one accent, as roles of the chemistry's palette (carbon = PALETTE, silicon = SI_PALETTE). */
  colour: { body: PaletteKey; accent: PaletteKey };
  radial: {
    /** Radial symmetry order: arms (rower) or facets ÷ 2 (bell). */
    symmetry: Symmetry;
    /** Arm length ÷ length (rower). */
    armLen: number;
    /** Stepped facet tiers on the hub or bell, 1..5. */
    tiers: number;
    /** Bells in the colony chain (bell plan; 1 = a lone bell), 1..6. */
    chain: number;
    /** 0..1: crystal spikes on the hub facets (geode). */
    spikes: number;
    /** Trailing lattice tendril length ÷ length (0 = none). */
    trail: number;
  };
  /** Individuals that travel together (1 = solitary). */
  school: number;
}

export const DEFAULT_PARAMS: SwimmerParams = {
  chemistry: 'carbon', plan: 'fusiform', length: 1, aspect: 0.2, depth: 1.3, peak: 0.35, undulation: 0.4,
  fins: { lateral: 1, lateralSize: 0.18, dorsal: 0.08, ventral: 0, fringe: 0 },
  tail: 'fork', tailSize: 0.3,
  head: { eyes: 2, eyeSize: 0.035, stalks: 0, feelers: 0, feelerLen: 0.4, mouth: 'none', crest: 0 },
  lateralLine: 0, photophores: 0, plates: 0, translucency: 0, glow: 0,
  colour: { body: 'bone', accent: 'crimson' },
  radial: { symmetry: 6, armLen: 0.8, tiers: 3, chain: 1, spikes: 0, trail: 0 },
  school: 1,
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Deep merge (objects merge, everything else replaces). Pure. */
export function mergeParams(base: SwimmerParams, over: DeepPartial<SwimmerParams> | undefined): SwimmerParams {
  if (!over) return structuredClone(base);
  const out: any = structuredClone(base);
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...out[k], ...v };
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

const cl = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : lo);
const SYM: Symmetry[] = [3, 4, 5, 6, 8];

/**
 * Clamp every number to its documented range, round the counts, and enforce the chemistry grammar:
 * silicon is always radial (an axial plan becomes the hub rower), carbon is always axial (a radial plan becomes fusiform).
 */
export function normaliseParams(p: SwimmerParams): SwimmerParams {
  const q = structuredClone(p);
  if (q.chemistry === 'silicon' && !RADIAL_PLANS.includes(q.plan)) q.plan = 'radial';
  if (q.chemistry === 'carbon' && !AXIAL_PLANS.includes(q.plan)) q.plan = 'fusiform';
  q.length = cl(q.length, 0.05, 40);
  q.aspect = cl(q.aspect, 0.02, 1.6);
  q.depth = cl(q.depth, 0.25, 4);
  q.peak = cl(q.peak, 0.1, 0.8);
  q.undulation = cl(q.undulation, 0, 1);
  q.fins.lateral = Math.round(cl(q.fins.lateral, 0, 14));
  q.fins.lateralSize = cl(q.fins.lateralSize, 0, 0.6);
  q.fins.dorsal = cl(q.fins.dorsal, 0, 0.4);
  q.fins.ventral = cl(q.fins.ventral, 0, 0.5);
  q.fins.fringe = cl(q.fins.fringe, 0, 1);
  q.tailSize = cl(q.tailSize, 0, 0.8);
  q.head.eyes = Math.round(cl(q.head.eyes, 0, 6));
  q.head.eyeSize = cl(q.head.eyeSize, 0.005, 0.15);
  q.head.stalks = cl(q.head.stalks, 0, 0.5);
  q.head.feelers = Math.round(cl(q.head.feelers, 0, 4));
  q.head.feelerLen = cl(q.head.feelerLen, 0.05, 1.2);
  q.head.crest = Math.round(cl(q.head.crest, 0, 8));
  q.lateralLine = cl(q.lateralLine, 0, 1);
  q.photophores = Math.round(cl(q.photophores, 0, 24));
  q.plates = cl(q.plates, 0, 1);
  q.translucency = cl(q.translucency, 0, 1);
  q.glow = cl(q.glow, 0, 1);
  const s = Math.round(q.radial.symmetry);
  q.radial.symmetry = SYM.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a), 6 as Symmetry);
  q.radial.armLen = cl(q.radial.armLen, 0.1, 2.5);
  q.radial.tiers = Math.round(cl(q.radial.tiers, 1, 5));
  q.radial.chain = Math.round(cl(q.radial.chain, 1, 6));
  q.radial.spikes = cl(q.radial.spikes, 0, 1);
  q.radial.trail = cl(q.radial.trail, 0, 4);
  q.school = Math.round(cl(q.school, 1, 64));
  if (q.chemistry === 'silicon') { q.fins = { ...q.fins, dorsal: 0, ventral: 0 }; q.tail = 'none'; q.head.crest = 0; q.head.mouth = 'none'; }
  return q;
}

/** Read `key:value,key.sub:value` overrides (URL ?set=) into a partial params object. Unknown keys are ignored. */
export function parseSet(s: string | null): DeepPartial<SwimmerParams> {
  const out: any = {};
  if (!s) return out;
  for (const kv of s.split(',')) {
    const [k, v] = kv.split(':');
    if (!k || v === undefined) continue;
    const path = k.split('.');
    let o = out;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]] ??= {};
    const n = Number(v);
    o[path[path.length - 1]] = Number.isFinite(n) && v.trim() !== '' ? n : v;
  }
  return out;
}
