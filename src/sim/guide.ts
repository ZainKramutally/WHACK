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
export interface FormHint { role?: Role; mode?: LocomotionMode }

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
  return { role: r === undefined ? undefined : ROLE_ORDER[r], mode: majority(modes) };
}
const ROLE_ORDER: readonly Role[] = ['grazer', 'omnivore', 'hunter'];

export function functionalType(centroid: FormCentroid, hint: FormHint = {}): FunctionalType {
  const role = hint.role ?? roleOf(centroid.body.diet);
  const locomotion = hint.mode === undefined ? locomotionOf(centroid.body) : locomotionForMode(centroid.body, hint.mode);
  return { role, locomotion, label: `${role} · ${locomotion}` };
}

// ---- Names ----

// Nouns fit the architecture: carbon is bilateral and axial (worms, striders), silicon is a radial lattice
// (arms stepping in tripods, rolling hubs, bells, rooted crystal colonies).
const NOUN: Record<'si' | 'c', Record<Locomotion, string>> = {
  c: { floater: 'Drifter', strider: 'Strider', walker: 'Walker', crawler: 'Crawler', swimmer: 'Swimmer' },
  si: { floater: 'Bloom', strider: 'Spoke', walker: 'Tripod', crawler: 'Lattice', swimmer: 'Roller' },
};

// Distinguishing feature, strongest first. Chemistry picks the word set; the feature picks the word.
type Feature = 'glow' | 'plated' | 'horned' | 'giant' | 'tiny' | 'plain';
const ADJ: Record<'si' | 'c', Record<Feature, string>> = {
  si: { glow: 'Prism', plated: 'Ceramic', horned: 'Shard', giant: 'Monolith', tiny: 'Fleck', plain: 'Glass' },
  c: { glow: 'Lantern', plated: 'Shell', horned: 'Thorn', giant: 'Great', tiny: 'Mote', plain: 'Soft' },
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
  const chem = centroid.si > 0.5 ? 'si' : 'c';
  const loco = hint.mode === undefined ? locomotionOf(centroid.body) : locomotionForMode(centroid.body, hint.mode);
  return `${ADJ[chem][featureOf(centroid.body)]} ${NOUN[chem][loco]}`;
}

// ---- Tracker ----

interface Bin { id: number; centroid: Float64Array }

/**
 * Remembers which forms have already been announced. Call update() with the live animals each tick (or each
 * snapshot); it returns forms that reached MIN_MEMBERS live animals for the first time this run.
 * Clusters are matched to known bins by nearest stored centroid within FORM_RADIUS, so slow drift keeps the
 * same bin, and a form that dips below MIN_MEMBERS and returns does not fire again.
 */
export class FormTracker {
  private bins: Bin[] = [];
  private nextId = 1;

  update(animals: readonly GuideAnimal[]): NewForm[] {
    const out: NewForm[] = [];
    const byId = new Map(animals.map((a) => [a.id, a]));
    const clusters = clusterForms(animals).filter((c) => c.members.length >= MIN_MEMBERS);
    for (const cl of clusters) { // ascending key → deterministic bin ids
      const v = fromCentroid(cl.centroid);
      let best: Bin | undefined;
      let bestD = FORM_RADIUS;
      for (const b of this.bins) {
        const d = dist(v, b.centroid);
        if (d <= bestD && (!best || d < bestD)) { best = b; bestD = d; }
      }
      if (best) { best.centroid = v; continue; } // known form: follow its drift
      const bin: Bin = { id: this.nextId++, centroid: v };
      this.bins.push(bin);
      out.push({ binId: bin.id, name: nameForm(cl.centroid, cl.hint), organismId: representative(cl, v, byId) });
    }
    return out;
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
