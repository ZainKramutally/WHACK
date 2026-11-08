// Field guide logic (CLAUDE.md "Life: creatures and plants" → Presentation; DECISIONS §A, §G guardrail 3).
// Pure and deterministic: OTU clustering on the 12 body genes + comp (c, si), a tracker that reports
// when a form first reaches MIN_MEMBERS live animals (the `guide:newForm` payload), and a trait-based
// name generator. No authored species list; every word is chosen from gene thresholds.
// The look attractor (third part of DECISIONS §A's functional type) is render-only and lives in the art layer.
import { LOCOMOTION, type LocomotionMode } from './develop';
import { BODY_GENES, type AnimalGenome, type BodyGenes } from './genome';

// DECISIONS §A: a species is a cluster at radius 0.25 with at least 4 live animals.
export const FORM_RADIUS = 0.25;
export const MIN_MEMBERS = 4;

/** `mode` is the animal's real locomotion mode (develop()'s plan.mode: the cheapest of walk / swim / hover / sessile). Optional: without it the genes decide. */
export interface GuideAnimal { id: number; genome: AnimalGenome; mode?: LocomotionMode }

/** Centroid in the clustering space: the 12 body genes plus composition c and si. */
export interface FormCentroid { body: BodyGenes; c: number; si: number }

export interface FormCluster {
  /** Lowest member id: stable for a given input set, whatever order it arrives in. */
  key: number;
  centroid: FormCentroid;
  /** Member ids, ascending. */
  members: number[];
  /** What the members actually are: majority role and majority real locomotion mode (see FormHint). */
  hint: FormHint;
}

/** The members' majority role and locomotion mode, which override the centroid's genes when naming or classifying a form. */
export interface FormHint { role?: Role; mode?: LocomotionMode; /** members both swim and hover (at least a quarter each) */ amphibious?: boolean }

export interface NewForm { binId: number; name: string; organismId: number }

const DIM = BODY_GENES.length + 2; // 12 genes + c + si

function vectorOf(g: AnimalGenome): Float64Array {
  const v = new Float64Array(DIM);
  for (let i = 0; i < BODY_GENES.length; i++) v[i] = g.body[BODY_GENES[i]];
  v[DIM - 2] = g.comp.c;
  v[DIM - 1] = g.comp.si;
  return v;
}

function toCentroid(v: ArrayLike<number>): FormCentroid {
  const body = {} as BodyGenes;
  for (let i = 0; i < BODY_GENES.length; i++) body[BODY_GENES[i]] = v[i];
  return { body, c: v[DIM - 2], si: v[DIM - 1] };
}

function fromCentroid(c: FormCentroid): Float64Array {
  const v = new Float64Array(DIM);
  for (let i = 0; i < BODY_GENES.length; i++) v[i] = c.body[BODY_GENES[i]];
  v[DIM - 2] = c.c;
  v[DIM - 1] = c.si;
  return v;
}

/** Distance between two points in the clustering space (12 genes + c + si). Species matching uses it with FORM_RADIUS. */
export function centroidDistance(a: FormCentroid, b: FormCentroid): number { return dist(fromCentroid(a), fromCentroid(b)); }
/** A genome's point in the clustering space. */
export function genomeCentroid(g: AnimalGenome): FormCentroid { return toCentroid(vectorOf(g)); }
/** Mean of several centroids. */
export function meanCentroid(cs: readonly FormCentroid[]): FormCentroid {
  const m = new Float64Array(DIM);
  for (const c of cs) { const v = fromCentroid(c); for (let i = 0; i < DIM; i++) m[i] += v[i] / cs.length; }
  return toCentroid(m);
}

function dist(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < DIM; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/**
 * Leader clustering at FORM_RADIUS in id order (so input order never matters), centroids as running means.
 * Cost: O(n·k) distance evaluations of 14 dims, k = clusters (a handful to a few dozen). For n ≤ 1,024 at
 * 20 Hz that is well under 1 ms of work per tick; the sort is O(n log n) on ids only.
 */
export function clusterForms(animals: readonly GuideAnimal[]): FormCluster[] {
  const sorted = [...animals].sort((a, b) => a.id - b.id);
  const sums: Float64Array[] = [];
  const means: Float64Array[] = [];
  const ids: number[][] = [];
  for (const a of sorted) {
    const v = vectorOf(a.genome);
    let best = -1;
    let bestD = FORM_RADIUS;
    for (let k = 0; k < means.length; k++) {
      const d = dist(v, means[k]);
      if (d <= bestD && (best < 0 || d < bestD)) { best = k; bestD = d; }
    }
    if (best < 0) {
      sums.push(Float64Array.from(v));
      means.push(Float64Array.from(v));
      ids.push([a.id]);
    } else {
      ids[best].push(a.id);
      const n = ids[best].length;
      for (let i = 0; i < DIM; i++) {
        sums[best][i] += v[i];
        means[best][i] = sums[best][i] / n;
      }
    }
  }
  const byId = new Map(sorted.map((a) => [a.id, a]));
  return ids.map((members, k) => ({ key: members[0], centroid: toCentroid(means[k]), members, hint: hintOf(members.map((id) => byId.get(id)!)) }));
}

// ---- Functional type (trophic role × locomotion hint) ----

export type Role = 'grazer' | 'omnivore' | 'hunter';
export type Locomotion = 'floater' | 'strider' | 'walker' | 'crawler' | 'swimmer';
export interface FunctionalType { role: Role; locomotion: Locomotion; label: string }

// Classification thresholds on 0..1 genes. These label forms for the UI; they are not sim tunables.
const DIET_GRAZER_MAX = 0.35; // diet < 0.35: plant gain (1−t)² dominates → grazer
const DIET_HUNTER_MIN = 0.65; // diet > 0.65: meat gain t² dominates → hunter; between: omnivore
const BUOY_FLOATER = 0.6;     // body density low enough to hover or drift
const LIMBS_PRESENT = 0.25;   // limbPairs gene at which legs read as legs
const LIMBS_LONG = 0.6;       // limbLen at which legs read as stilts/striders
const SEGMENTS_LONG = 0.5;    // many segments with no legs read as crawlers; fewer as swimmers

export function roleOf(diet: number): Role {
  return diet < DIET_GRAZER_MAX ? 'grazer' : diet > DIET_HUNTER_MIN ? 'hunter' : 'omnivore';
}

/** Locomotion word from the genes alone (used when no real mode is known). */
export function locomotionOf(b: BodyGenes): Locomotion {
  if (b.buoy >= BUOY_FLOATER) return 'floater';
  if (b.limbPairs >= LIMBS_PRESENT) return b.limbLen >= LIMBS_LONG ? 'strider' : 'walker';
  return b.segments >= SEGMENTS_LONG ? 'crawler' : 'swimmer';
}

/**
 * Locomotion word when the real mode is known: swim → swimmer, hover → floater, walk → strider/walker with legs or
 * crawler without (a legless body that "walks" creeps); sessile bodies creep too. The genes only pick strider vs walker.
 */
export function locomotionForMode(b: BodyGenes, mode: LocomotionMode): Locomotion {
  if (mode === LOCOMOTION.swim) return 'swimmer';
  if (mode === LOCOMOTION.hover) return 'floater';
  if (mode === LOCOMOTION.walk && b.limbPairs >= LIMBS_PRESENT) return b.limbLen >= LIMBS_LONG ? 'strider' : 'walker';
  return 'crawler';
}

/** Most common value; ties go to the smallest (lowest mode number, or role in grazer < omnivore < hunter order). */
function majority<T extends number | string>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestN = 0;
  for (const [v, n] of [...counts].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) if (n > bestN) { best = v; bestN = n; }
  return best;
}

/** Majority role (from each member's diet gene) and majority real mode (when members carry one). */
export function hintOf(members: readonly GuideAnimal[]): FormHint {
  const roles = members.map((a) => ROLE_ORDER.indexOf(roleOf(a.genome.body.diet)));
  const modes = members.flatMap((a) => (a.mode === undefined ? [] : [a.mode]));
  const r = majority(roles);
  const share = (m: LocomotionMode) => (modes.length ? modes.filter((x) => x === m).length / modes.length : 0);
  return { role: r === undefined ? undefined : ROLE_ORDER[r], mode: majority(modes), amphibious: share(LOCOMOTION.swim) >= 0.25 && share(LOCOMOTION.hover) >= 0.25 };
}
const ROLE_ORDER: readonly Role[] = ['grazer', 'omnivore', 'hunter'];

export function functionalType(centroid: FormCentroid, hint: FormHint = {}): FunctionalType {
  const role = hint.role ?? roleOf(centroid.body.diet);
  const locomotion = hint.mode === undefined ? locomotionOf(centroid.body) : locomotionForMode(centroid.body, hint.mode);
  return { role, locomotion, label: `${role} · ${locomotion}` };
}

// ---- Names ----

// The movement word comes from how the species actually moves (its members' live mode), then from body traits, so names vary:
// carbon is bilateral and axial (eels, paddlers, striders), silicon is a radial lattice (rollers, tripods, bells, rooted spires).
type Chem = 'si' | 'c';
function moveWord(chem: Chem, b: BodyGenes, mode: LocomotionMode, amphibious: boolean): string {
  const si = chem === 'si';
  if (amphibious) return 'Diver';
  if (mode === LOCOMOTION.swim) {
    if (si) return b.limbPairs >= 0.5 ? 'Spinner' : 'Roller';
    if (b.segments >= 0.6) return 'Eel';
    if (b.limbPairs >= LIMBS_PRESENT) return 'Paddler';
    if (b.buoy >= 0.4 || b.plates >= 0.4) return 'Drifter';
    return 'Darter';
  }
  if (mode === LOCOMOTION.hover) {
    if (b.buoy >= BUOY_FLOATER) return si ? 'Bell' : 'Floater';
    if (b.size >= 0.5) return 'Glider';
    if (b.size <= 0.25) return 'Flitter';
    return b.eyes >= 0.5 ? 'Soarer' : 'Flier';
  }
  if (mode === LOCOMOTION.sessile) return si ? 'Spire' : b.limbLen >= 0.5 ? 'Frond' : 'Anchor';
  if (b.limbPairs < LIMBS_PRESENT) return si ? 'Lattice' : 'Crawler';
  if (si) return b.limbLen >= LIMBS_LONG ? 'Spoke' : 'Tripod';
  if (b.limbLen >= LIMBS_LONG) return 'Strider';
  if (b.size >= 0.5) return 'Stomper';
  return b.size <= 0.25 ? 'Skitter' : 'Walker';
}

// Distinguishing feature, strongest first. Chemistry picks the word set, the feature the row, and the eyes gene the word in it.
type Feature = 'glow' | 'plated' | 'horned' | 'giant' | 'tiny' | 'plain';
const ADJ: Record<Chem, Record<Feature, string[]>> = {
  si: {
    glow: ['Prism', 'Beacon', 'Opal'], plated: ['Ceramic', 'Slate', 'Basalt'], horned: ['Shard', 'Spike', 'Quartz'],
    giant: ['Monolith', 'Colossal', 'Titan'], tiny: ['Fleck', 'Grain', 'Speck'], plain: ['Glass', 'Frost', 'Pale'],
  },
  c: {
    glow: ['Lantern', 'Ember', 'Glimmer'], plated: ['Shell', 'Scale', 'Bark'], horned: ['Thorn', 'Horn', 'Briar'],
    giant: ['Great', 'Grand', 'Elder'], tiny: ['Mote', 'Wisp', 'Sprig'], plain: ['Soft', 'Dusky', 'Russet'],
  },
};

function featureOf(b: BodyGenes): Feature {
  if (b.glow >= 0.6) return 'glow';
  if (b.plates >= 0.5) return 'plated';
  if (b.horns >= 0.5) return 'horned';
  if (b.size >= 0.7) return 'giant';
  if (b.size <= 0.25) return 'tiny';
  return 'plain';
}

/** Deterministic two-word name from traits only, e.g. "Glass Spoke". Centroids that develop() builds radially (si > 0.5) use the silicon word sets. */
export function nameForm(centroid: FormCentroid, hint: FormHint = {}): string {
  const chem: Chem = centroid.si > 0.5 ? 'si' : 'c';
  const b = centroid.body;
  const mode: LocomotionMode = hint.mode ?? modeFromGenes(b);
  const words = ADJ[chem][featureOf(b)];
  return `${words[Math.min(words.length - 1, Math.floor(b.eyes * words.length))]} ${moveWord(chem, b, mode, hint.amphibious === true)}`;
}

function modeFromGenes(b: BodyGenes): LocomotionMode {
  const l = locomotionOf(b);
  return l === 'swimmer' ? LOCOMOTION.swim : l === 'floater' ? LOCOMOTION.hover : LOCOMOTION.walk;
}

// ---- Tracker ----

interface Bin { id: number; centroid: Float64Array }

/**
 * Remembers which forms have already been announced. Call update() with the live animals each tick (or each
 * snapshot); it returns forms that reached MIN_MEMBERS live animals for the first time this run.
 * Clusters are matched to known bins by nearest stored centroid within FORM_RADIUS, so slow drift keeps the
 * same bin, and a form that dips below MIN_MEMBERS and returns does not fire again.
 */
export interface TrackerOptions {
  minMembers?: number;   // live animals a cluster needs before it can be announced (default MIN_MEMBERS)
  persistSec?: number;   // and how long it must have held that size, in ecology seconds (default 0: announce at once)
  distinctNames?: boolean; // give every announced form its own name (a qualifier word on collision)
}

export class FormTracker {
  private bins: Bin[] = [];
  private nextId = 1;
  private pending: { centroid: Float64Array; since: number }[] = [];
  private readonly used = new Set<string>();
  private readonly minMembers: number;
  private readonly persistSec: number;
  private readonly distinct: boolean;

  constructor(opts: TrackerOptions = {}) {
    this.minMembers = opts.minMembers ?? MIN_MEMBERS;
    this.persistSec = opts.persistSec ?? 0;
    this.distinct = opts.distinctNames ?? false;
  }

  /** `nowSec` is the ecology clock; only needed when persistSec > 0. */
  update(animals: readonly GuideAnimal[], nowSec = 0): NewForm[] {
    const out: NewForm[] = [];
    const byId = new Map(animals.map((a) => [a.id, a]));
    const clusters = clusterForms(animals).filter((c) => c.members.length >= this.minMembers);
    const stillPending: { centroid: Float64Array; since: number }[] = [];
    for (const cl of clusters) { // ascending key → deterministic bin ids
      const v = fromCentroid(cl.centroid);
      let best: Bin | undefined;
      let bestD = FORM_RADIUS;
      for (const b of this.bins) {
        const d = dist(v, b.centroid);
        if (d <= bestD && (!best || d < bestD)) { best = b; bestD = d; }
      }
      if (best) { best.centroid = v; continue; } // known form: follow its drift
      let since = nowSec;
      if (this.persistSec > 0) {
        const prev = this.pending.find((q) => dist(v, q.centroid) <= FORM_RADIUS);
        if (prev) since = prev.since;
        if (nowSec - since < this.persistSec) { stillPending.push({ centroid: v, since }); continue; }
      }
      const bin: Bin = { id: this.nextId++, centroid: v };
      this.bins.push(bin);
      const base = nameForm(cl.centroid, cl.hint);
      const name = this.distinct ? this.unique(base, cl.centroid) : base;
      this.used.add(name);
      out.push({ binId: bin.id, name, organismId: representative(cl, v, byId) });
    }
    this.pending = stillPending;
    return out;
  }

  /** A name nobody has: the base name, else a trait qualifier ("Keen Glass Spoke"), else a numeral. */
  private unique(base: string, c: FormCentroid): string {
    if (!this.used.has(base)) return base;
    const b = c.body;
    const quals: string[] = [];
    quals.push(b.size >= 0.5 ? 'Greater' : 'Lesser');
    quals.push(b.sociality >= 0.5 ? 'Herd' : 'Lone');
    quals.push(b.eyes >= 0.5 ? 'Keen' : 'Blind');
    quals.push(b.limbLen >= 0.5 ? 'Long' : 'Short');
    quals.push(b.diet >= 0.35 ? 'Stalking' : 'Grazing');
    quals.push(b.gape >= 0.5 ? 'Gaping' : 'Narrow');
    for (const q of quals) if (!this.used.has(`${q} ${base}`)) return `${q} ${base}`;
    for (let i = 0; i < quals.length; i++) for (let j = i + 1; j < quals.length; j++) {
      const n = `${quals[i]} ${quals[j]} ${base}`;
      if (!this.used.has(n)) return n;
    }
    for (let k = 2; ; k++) if (!this.used.has(`${base} ${k}`)) return `${base} ${k}`;
  }

  /** Number of forms announced so far. */
  get count(): number { return this.bins.length; }
}

/** Member nearest the centroid; ties go to the lowest id. */
function representative(cl: FormCluster, centroid: Float64Array, byId: Map<number, GuideAnimal>): number {
  let best = cl.members[0];
  let bestD = Infinity;
  for (const id of cl.members) {
    const d = dist(vectorOf(byId.get(id)!.genome), centroid);
    if (d < bestD) { best = id; bestD = d; }
  }
  return best;
}
