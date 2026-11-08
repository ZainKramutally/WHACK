// Field guide logic (CLAUDE.md "Life: creatures and plants" → Presentation; DECISIONS §A, §G guardrail 3).
// Pure and deterministic: OTU clustering on the 12 body genes + comp (c, si), a tracker that reports
// when a form first reaches MIN_MEMBERS live animals (the `guide:newForm` payload), and a trait-based
// name generator. No authored species list; every word is chosen from gene thresholds.
// The look attractor (third part of DECISIONS §A's functional type) is render-only and lives in the art layer.
import { LOCOMOTION, isSiliconWalkerGenes, type LocomotionMode } from './develop';
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

export interface NewForm { binId: number; name: string; scientific: string; organismId: number }

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
    if (si) return b.limbPairs >= 0.5 ? 'Sculler' : 'Rower';
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
  if (si && isSiliconWalkerGenes(b)) return b.plates >= 0.5 ? 'Bastion' : b.limbLen >= LIMBS_LONG ? 'Strider' : b.eyes >= 0.5 ? 'Sentry' : 'Plodder';   // bilateral armoured walkers
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

// ---- Binomial names ----

// Scientific name = Genus epithet, from Greek/Latin roots that encode real traits (a designed generator, not emergent).
//   Genus = chemistry root + body-plan root, so species of one chemistry and body layout share a genus.
//   Epithet = the species' most distinctive trait (and the common name's modifier is the same trait in plain English).
// The run seed only picks between synonyms of the same meaning, so names are deterministic per seed.
export interface Scientific { genus: string; epithet: string }

export type BodyRoot = 'nema' | 'pus' | 'ptera' | 'stoma' | 'phora' | 'ella' | 'saurus' | 'petra' | 'rhiza';

/** Body-plan root: sessile → petra (rock) / rhiza (root); hovering → phora (bell/float) or ptera (winged); gaping hunters → stoma; giants → saurus; tiny → ella; legged walkers → pus; the rest → nema (worm). */
export function bodyRoot(chem: Chem, b: BodyGenes, mode: LocomotionMode): BodyRoot {
  if (mode === LOCOMOTION.sessile) return chem === 'si' ? 'petra' : 'rhiza';
  if (mode === LOCOMOTION.hover) return b.buoy >= BUOY_FLOATER ? 'phora' : 'ptera';
  if (b.gape >= 0.5 && b.diet > DIET_HUNTER_MIN) return 'stoma';
  if (b.size >= 0.7) return 'saurus';
  if (b.size <= 0.25) return 'ella';
  if (mode === LOCOMOTION.walk && b.limbPairs >= LIMBS_PRESENT) return 'pus';
  return 'nema';
}

/** Chemistry root: Carbo- (bilateral carbon), Phyto- (rooted carbon), Silico- (armoured axial silicon), Hyalo- ("glass": radial crystal silicon). */
export function chemRoot(chem: Chem, b: BodyGenes, mode: LocomotionMode): string {
  if (chem === 'c') return mode === LOCOMOTION.sessile ? 'Phyto' : 'Carbo';
  return isSiliconWalkerGenes(b) && mode === LOCOMOTION.walk ? 'Silico' : 'Hyalo';
}

export function genusOf(chem: Chem, b: BodyGenes, mode: LocomotionMode): string {
  const root = bodyRoot(chem, b, mode);
  const prefix = chemRoot(chem, b, mode);
  // join without doubled vowels: Carbo + nema = Carbonema, Hyalo + ella = Hyalella
  return prefix.slice(0, /^[aeiou]/.test(root) ? -1 : undefined) + root;
}

interface Trait { id: string; score: number; epithets: string[]; modifier: string }

/** Traits that can name a species, each with a strength 0..1 (0 = absent). Strongest first decides the epithet and the common modifier. */
function traitsOf(chem: Chem, b: BodyGenes, mode: LocomotionMode): Trait[] {
  const si = chem === 'si';
  const t: Trait[] = [];
  if (b.glow >= 0.6) t.push({ id: 'glow', score: b.glow, epithets: ['noctiluca', 'lucens'], modifier: 'Night-glow' });
  if (b.size >= 0.7) t.push({ id: 'giant', score: b.size, epithets: ['megas', 'grandis'], modifier: 'Great' });
  if (b.size <= 0.25) t.push({ id: 'tiny', score: 0.3 * (1 - b.size), epithets: ['minutus', 'parvus'], modifier: 'Mote' });
  if (b.plates >= 0.5) t.push({ id: 'plated', score: b.plates, epithets: si ? ['nitridis', 'loricatus'] : ['armatus', 'loricatus'], modifier: si ? 'Ceramic' : 'Shell-backed' });
  if (b.horns >= 0.5) t.push({ id: 'horned', score: b.horns, epithets: ['cornutus', 'spinosus'], modifier: 'Horned' });
  if (mode === LOCOMOTION.walk && b.limbPairs >= LIMBS_PRESENT && b.limbLen >= LIMBS_LONG) t.push({ id: 'fast', score: b.limbLen, epithets: ['velox', 'celer'], modifier: 'Swift' });
  if (mode === LOCOMOTION.swim && b.buoy < 0.3) t.push({ id: 'deep', score: 1 - b.buoy, epithets: ['abyssalis', 'profundus'], modifier: 'Deep' });
  // habitat, a weak trait: names a species when no body trait stands out
  if (mode === LOCOMOTION.swim && b.buoy >= 0.3) t.push({ id: 'shallows', score: 0.35, epithets: ['littoralis', 'aquaticus'], modifier: 'Shallows' });
  if (mode === LOCOMOTION.walk) t.push({ id: 'ground', score: 0.35, epithets: ['terrestris', 'campestris'], modifier: 'Ground' });
  if (mode === LOCOMOTION.hover) t.push({ id: 'sky', score: 0.35, epithets: ['aerius', 'volans'], modifier: 'Sky' });
  if (mode === LOCOMOTION.sessile) t.push({ id: 'shore', score: 0.5, epithets: ['littoralis', 'maritimus'], modifier: 'Shore' });
  if (b.eyes >= 0.7) t.push({ id: 'eyed', score: b.eyes, epithets: ['oculatus', 'ocellatus'], modifier: 'Keen-eyed' });
  if (b.diet > DIET_HUNTER_MIN) t.push({ id: 'hunter', score: b.diet, epithets: ['rapax', 'praedator'], modifier: 'Fanged' });
  if (b.sociality >= 0.7) t.push({ id: 'herd', score: b.sociality, epithets: ['gregarius', 'socialis'], modifier: 'Herd' });
  t.sort((x, y) => y.score - x.score);
  // the plain fallback: a species with no standout trait is named for its chemistry
  t.push(si ? { id: 'plain', score: 0, epithets: ['vitreus', 'glacialis'], modifier: 'Glass' } : { id: 'plain', score: 0, epithets: ['vulgaris', 'communis'], modifier: 'Common' });
  return t;
}

const ORDINALS = ['primus', 'secundus', 'tertius', 'quartus', 'quintus', 'sextus', 'septimus', 'octavus', 'nonus', 'decimus'];

function seededPick(seed: number, key: number, n: number): number {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(key + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) % n;
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
  nameSeed?: number;     // when set, a form gets a trait-based common name ("<trait modifier> <movement word>") instead of "<feature word> <movement word>"; the scientific name is always binomial
}

export class FormTracker {
  private bins: Bin[] = [];
  private nextId = 1;
  private pending: { centroid: Float64Array; since: number }[] = [];
  private readonly used = new Set<string>();
  private readonly usedSci = new Set<string>();
  private minMembers: number;
  private gapSec = 0;
  private lastAnnounced = -Infinity;
  private readonly persistSec: number;
  private readonly distinct: boolean;
  private readonly nameSeed: number | undefined;

  constructor(opts: TrackerOptions = {}) {
    this.minMembers = opts.minMembers ?? MIN_MEMBERS;
    this.persistSec = opts.persistSec ?? 0;
    this.distinct = opts.distinctNames ?? false;
    this.nameSeed = opts.nameSeed;
  }

  /** Change the announcement rules between calls: the member threshold, and the least time between two announcements (0 = none). */
  configure(c: { minMembers?: number; gapSec?: number; forgetPending?: boolean }): void {
    if (c.minMembers !== undefined) this.minMembers = c.minMembers;
    if (c.gapSec !== undefined) this.gapSec = c.gapSec;
    if (c.forgetPending) this.pending = [];
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
      const prev = this.pending.find((q) => dist(v, q.centroid) <= FORM_RADIUS);
      if (prev) since = prev.since;
      if ((this.persistSec > 0 && nowSec - since < this.persistSec) || nowSec - this.lastAnnounced < this.gapSec) { stillPending.push({ centroid: v, since }); continue; }
      const bin: Bin = { id: this.nextId++, centroid: v };
      this.bins.push(bin);
      this.lastAnnounced = nowSec;
      const base = nameForm(cl.centroid, cl.hint);
      const chem: Chem = cl.centroid.si > 0.5 ? 'si' : 'c';
      const mode: LocomotionMode = cl.hint.mode ?? modeFromGenes(cl.centroid.body);
      const { name, scientific } = this.nameSpecies(bin.id, cl.centroid, chem, mode, base);
      this.used.add(name);
      this.usedSci.add(scientific);
      out.push({ binId: bin.id, name, scientific, organismId: representative(cl, v, byId) });
    }
    this.pending = stillPending;
    return out;
  }

  /**
   * Both names from the species' strongest traits. Walks the trait list (and each trait's synonyms) until the common name
   * and the scientific name are both unused in this run; then falls back to a qualifier / ordinal.
   */
  private nameSpecies(binId: number, c: FormCentroid, chem: Chem, mode: LocomotionMode, base: string): { name: string; scientific: string } {
    const seed = this.nameSeed ?? 0;
    const genus = genusOf(chem, c.body, mode);
    const move = base.split(' ').pop()!;
    const traits = traitsOf(chem, c.body, mode);
    const common = (t: Trait) => `${t.modifier} ${move}`;
    for (const t of traits) {
      const first = seededPick(seed, binId, t.epithets.length);
      for (let k = 0; k < t.epithets.length; k++) {
        const sci = `${genus} ${t.epithets[(first + k) % t.epithets.length]}`;
        const name = this.nameSeed === undefined ? (this.distinct ? this.unique(base, c) : base) : common(t);
        if (!this.usedSci.has(sci) && (this.nameSeed === undefined || !this.used.has(name))) return { name, scientific: sci };
      }
    }
    const top = traits[0];   // every trait's epithets were taken: number the species within its genus
    let scientific = '';
    for (const o of ORDINALS) { scientific = `${genus} ${o}`; if (!this.usedSci.has(scientific)) break; }
    return { name: this.nameSeed === undefined ? (this.distinct ? this.unique(base, c) : base) : this.unique(common(top), c), scientific };
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
