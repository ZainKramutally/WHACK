// Species looks: the art layer's read-only look attractor (DECISIONS §G.3, G.9). No three.js, no sim writes.
// Each animal is binned once, when first seen, in the field guide's clustering space (its 12 body genes + comp c, si;
// join radius FORM_RADIUS, as sim/guide.ts). A bin keeps running means of its members' centroid and proportions
// (girth, head size, gape, crest, horn and limb length, tier height, ...), and its founder's diet and pattern.
// Colour: a bin gets a colourway of its own (hue, accent, and its founder's diet for value) once it is a real population
// (SETTLE members) clearly apart from every coloured species (centroid ≥ SEPARATE away), picked to sit as far as
// possible from the other live colourways. Until then it wears the colourway of the nearest coloured species, so the
// periphery of a species' gene cloud and lone mutants never show colours of their own. The pattern travels with the
// colourway: one per species, bands or spots (develop() derives both with frac(), so on their own they flicker between
// siblings).
// A member is drawn from attract(plan): the colourway and pattern, and its own proportions pulled KAPPA of the way to its
// bin's means (or, for a bin too small to have means, to the species it wears). Counts and kinds (legs, plates, horns,
// eyes, tail, arms, tiers) stay the animal's own, so the inspect card's words always match the body.
// Members of a species look alike; species look apart (CLAUDE.md "The intended experience of life").
import type { BodyPlan } from '../../sim/develop';
import { FORM_RADIUS } from '../../sim/guide';
import { creatureHard, creatureRing, skinGroundShift } from '../palette';

/** Floats per animal in the classifier: the 12 body genes in BODY_GENES order, then comp c and si (OrganismField 12..25). */
export const SPECIES_DIM = 14;
/** Members before a bin has means of its own, and may take a colourway of its own. */
export const SETTLE = 6;
/** A bin takes its own colourway only this far (gene space) from every coloured species; closer ones share the colour. */
export const SEPARATE = 2 * FORM_RADIUS;
/** Pull of a member's proportions toward its species' mean (0 = own, 1 = the mean). */
export const KAPPA = 0.75;
const TRACK = 32;   // centroid and means follow roughly the last TRACK members (capped running mean), so slow drift is kept
const HUES = 9;     // hue candidates (0..1) for creatureColour's ring
// Accent candidates, one per creatureColour accent family. Carbon: a deep tone of the body, pale bone, or a contrasting
// ring hue. Silicon: ice blue, ice white or pale lilac. The first is the default.
const ACCENTS_SI = [0.5, 0.15, 0.85];
const ACCENTS_C = [0.15, 0.5, 0.85];
const ACCENT_W = 0.12; // a different accent family is worth at most ~0.08 of ring distance

/** `hard`: the species' mineral armour hex (creatureHard), stamped once with its colourway; absent before the world's
 *  mineral tint is known (the hard tone then falls back to the body a little deeper). `skin`: its carbon readability
 *  shift off the chip's ground (skinGroundShift, lightness), stamped with it; 0 or absent when none. */
export interface SpeciesLook { hue: number; accent: number; diet: number; bands: number; spots: number; hard?: number; skin?: number }

/** Proportions pulled toward the species mean. `has`: only members with the feature take part (no fins grown on a walker). */
interface Trait { get(p: BodyPlan): number; set(p: BodyPlan, v: number): void; has?(p: BodyPlan): boolean }
const rel = (k: 'hornLength' | 'limbLength' | 'tierHeight' | 'gapeSize', has: (p: BodyPlan) => boolean): Trait => ({
  get: (p) => p[k] / Math.max(1e-6, p.scale),
  set: (p, v) => { p[k] = v * p.scale; },
  has,
});
const plain = (k: 'girth' | 'flatten' | 'headScale' | 'gradient' | 'carapace' | 'curl' | 'tileLength' | 'crest' | 'jaw' | 'finSpan' | 'wingSpan', has?: (p: BodyPlan) => boolean): Trait => ({
  get: (p) => p[k], set: (p, v) => { p[k] = v; }, has,
});
export const TRAITS: Trait[] = [
  plain('girth'), plain('flatten'), plain('headScale'), plain('gradient'), plain('carapace'), plain('curl'), plain('tileLength'),
  plain('crest', (p) => p.crest > 0), plain('jaw', (p) => p.jaw > 0.05),
  plain('finSpan', (p) => p.finSpan > 0.01), plain('wingSpan', (p) => p.wingSpan > 0.01),
  rel('hornLength', (p) => p.hornCount > 0), rel('limbLength', (p) => p.limbLength > 0), rel('tierHeight', (p) => p.tiers > 0),
  rel('gapeSize', (p) => p.gapeSize > 0), // with headScale, sets a swimmer's neck (aquatic/fromPlan.ts neckFrac)
];
const NT = TRAITS.length;

export class SpeciesBook {
  readonly max: number;
  private cen: Float32Array; private n: Int32Array; private live: Int32Array; private used: Uint8Array;
  private coloured: Uint8Array; private silicon: Uint8Array; private wears: Int32Array; private stamp: Int32Array;
  private hue: Float32Array; private accent: Float32Array; private diet: Float32Array; private bands: Float32Array; private spots: Float32Array;
  private tm: Float32Array; private tn: Int32Array;
  private readonly v = new Float32Array(SPECIES_DIM);
  // mineral armour per bin (hex, −1 none) and the world's current tint (fauna sets it from crustHard each frame)
  private hard: Float64Array; private skin: Float32Array;
  private worldHardHex = -1; private groundHex = -1;

  constructor(max = 96) {
    this.max = max;
    this.cen = new Float32Array(max * SPECIES_DIM);
    this.n = new Int32Array(max); this.live = new Int32Array(max); this.used = new Uint8Array(max);
    this.coloured = new Uint8Array(max); this.silicon = new Uint8Array(max); this.wears = new Int32Array(max).fill(-1); this.stamp = new Int32Array(max);
    this.hue = new Float32Array(max); this.accent = new Float32Array(max); this.diet = new Float32Array(max);
    this.bands = new Float32Array(max); this.spots = new Float32Array(max);
    this.tm = new Float32Array(max * NT); this.tn = new Int32Array(max * NT);
    this.hard = new Float64Array(max).fill(-1); this.skin = new Float32Array(max);
  }

  reset(): void {
    this.used.fill(0); this.live.fill(0); this.coloured.fill(0); this.wears.fill(-1); this.hard.fill(-1); this.skin.fill(0); this.worldHardHex = -1; this.groundHex = -1;
  }

  /** The world's mineral armour tint right now (crustHard at the ratchet's armour step), or undefined without a crust.
   *  Species stamp it when they take their colourway, and keep it: old lineages keep black iron after the oxygen rise. */
  setWorldHard(hex: number | undefined, groundHex?: number): void {
    this.worldHardHex = hex === undefined ? -1 : hex;
    this.groundHex = groundHex === undefined ? -1 : groundHex;
  }

  /** Bins in use with live members, and how many of them show a colourway of their own (tests and debugging). */
  liveBins(): number {
    let k = 0;
    for (let b = 0; b < this.max; b++) if (this.used[b] && this.live[b] > 0) k++;
    return k;
  }
  colourways(): number {
    let k = 0;
    for (let b = 0; b < this.max; b++) if (this.used[b] && this.live[b] > 0 && this.coloured[b]) k++;
    return k;
  }

  /**
   * Bin a newly seen animal. `src[off .. off + SPECIES_DIM)` holds its 12 body genes and comp c, si (in the organism
   * buffer: off = record + 12). Returns the bin; the caller keeps it with `stampOf(bin)` for release().
   */
  assign(src: ArrayLike<number>, off: number, plan: BodyPlan): number {
    const v = this.v;
    for (let i = 0; i < SPECIES_DIM; i++) v[i] = src[off + i];
    const si = plan.chemistry === 'silicon' ? 1 : 0;
    let b = this.nearest(v, si, FORM_RADIUS, false);
    if (b < 0) {
      b = this.create(v, si, plan);
      if (b < 0) b = this.nearest(v, si, Infinity, false); // every bin busy: join the nearest
      if (b < 0) return -1;
    }
    // Join: running means of the centroid and the proportions.
    const w = 1 / Math.min(++this.n[b], TRACK);
    const c = b * SPECIES_DIM;
    for (let i = 0; i < SPECIES_DIM; i++) this.cen[c + i] += (v[i] - this.cen[c + i]) * w;
    for (let t = 0; t < NT; t++) {
      const tr = TRAITS[t];
      if (tr.has && !tr.has(plan)) continue;
      const k = b * NT + t, x = tr.get(plan);
      this.tm[k] += (x - this.tm[k]) / Math.min(++this.tn[k], TRACK);
    }
    this.live[b]++;
    if (!this.coloured[b] && this.live[b] >= SETTLE && this.nearestColoured(b, SEPARATE) < 0) this.colour(b);
    return b;
  }

  /** Recycle stamp of a bin (bins are reused once empty). */
  stampOf(b: number): number { return b < 0 ? 0 : this.stamp[b]; }

  /** A member died or was forgotten. Stale stamps (the bin was recycled meanwhile) are ignored. */
  release(b: number, stamp: number): void {
    if (b >= 0 && this.used[b] && this.stamp[b] === stamp && this.live[b] > 0) this.live[b]--;
  }

  /** The colourway and pattern a member of bin `b` wears right now: its own if coloured, else its nearest coloured species'. */
  lookOf(b: number, out: SpeciesLook): SpeciesLook {
    const d = b >= 0 ? this.worn(b) : -1;
    if (d < 0) { out.hue = 0.5; out.accent = 0.55; out.diet = 0; out.bands = 0; out.spots = 0; out.hard = undefined; return out; }
    out.hue = this.hue[d]; out.accent = this.accent[d]; out.diet = this.diet[d];
    out.bands = this.bands[d]; out.spots = this.spots[d];
    // a species coloured before the world's tint was known takes it at its first look, then keeps it
    if (this.hard[d] < 0 && this.worldHardHex >= 0) this.stampHard(d);
    out.hard = this.hard[d] >= 0 ? this.hard[d] : undefined;
    out.skin = this.skin[d];
    return out;
  }

  /** The member's plan as drawn: species colourway and pattern, proportions pulled toward the species mean. New object. */
  attract(plan: BodyPlan, b: number, look: SpeciesLook, kappa = KAPPA): BodyPlan {
    const p: BodyPlan = {
      ...plan, tierRadii: plan.tierRadii.slice(), arms: plan.arms.map((a) => ({ ...a })),
      limbJointAngles: plan.limbJointAngles.slice(), modeCosts: { ...plan.modeCosts },
    };
    p.hue = look.hue; p.accent = look.accent; p.bands = look.bands; p.spots = look.spots;
    if (b < 0) return p;
    // Means: the bin's own once it has SETTLE members, else those of the species it wears.
    let m = b;
    if (this.n[b] < SETTLE) { const w = this.worn(b); if (w >= 0) m = w; }
    for (let t = 0; t < NT; t++) {
      const tr = TRAITS[t], k = m * NT + t;
      if (this.tn[k] === 0 || (tr.has && !tr.has(plan))) continue;
      const own = tr.get(plan);
      tr.set(p, own + (this.tm[k] - own) * kappa);
    }
    return p;
  }

  /** Bin whose colourway `b` wears: itself if coloured, else the coloured species it was born near (re-found if gone). */
  private worn(b: number): number {
    if (this.coloured[b]) return b;
    const w = this.wears[b];
    if (w >= 0 && this.used[w] && this.coloured[w] && this.silicon[w] === this.silicon[b]) return w;
    const c = this.nearestColoured(b, Infinity);
    this.wears[b] = c;
    return c;
  }

  /** Nearest coloured bin with live members, of b's chemistry, within r of b's centroid (−1 if none). */
  private nearestColoured(b: number, r: number): number {
    let best = -1, bestD = r * r;
    const cb = b * SPECIES_DIM;
    for (let o = 0; o < this.max; o++) {
      if (o === b || !this.used[o] || !this.coloured[o] || this.live[o] === 0 || this.silicon[o] !== this.silicon[b]) continue;
      const c = o * SPECIES_DIM;
      let d = 0;
      for (let i = 0; i < SPECIES_DIM; i++) { const x = this.cen[cb + i] - this.cen[c + i]; d += x * x; }
      if (d < bestD) { best = o; bestD = d; }
    }
    return best;
  }

  private nearest(v: Float32Array, si: number, r: number, colouredOnly: boolean): number {
    let best = -1, bestD = r * r;
    for (let b = 0; b < this.max; b++) {
      if (!this.used[b] || this.silicon[b] !== si || (colouredOnly && (!this.coloured[b] || this.live[b] === 0))) continue;
      const c = b * SPECIES_DIM;
      let d = 0;
      for (let i = 0; i < SPECIES_DIM; i++) { const x = v[i] - this.cen[c + i]; d += x * x; }
      if (d <= bestD) { best = b; bestD = d; }
    }
    return best;
  }

  private create(v: Float32Array, si: number, plan: BodyPlan): number {
    let b = -1;
    for (let i = 0; i < this.max && b < 0; i++) if (!this.used[i]) b = i;
    if (b < 0) for (let i = 0; i < this.max && b < 0; i++) if (this.live[i] === 0) b = i; // recycle an empty bin
    if (b < 0) return -1;
    this.used[b] = 1; this.stamp[b]++; this.n[b] = 0; this.live[b] = 0; this.coloured[b] = 0; this.silicon[b] = si;
    this.cen.set(v, b * SPECIES_DIM);
    this.tm.fill(0, b * NT, (b + 1) * NT); this.tn.fill(0, b * NT, (b + 1) * NT);
    // One pattern per species, in its accent: bands or spots (the founder's stronger one), never both and never neither.
    const spotty = plan.spots >= 0.5 || plan.bands === 0;
    this.diet[b] = plan.diet; this.bands[b] = spotty ? 0 : Math.max(1, plan.bands); this.spots[b] = spotty ? Math.max(0.6, plan.spots) : 0;
    this.wears[b] = this.nearest(v, si, Infinity, true);
    if (this.wears[b] < 0) this.colour(b); // the first species of a world shows its own colourway at once
    return b;
  }

  /**
   * Give b its own colourway: the one farthest from every other live, coloured species of the same chemistry, measured
   * where the body colours really land (creatureRing: the hue and the founder's diet together). The accent family only
   * breaks near-ties (ACCENT_W), so species are told apart by body colour first.
   */
  private colour(b: number): void {
    const si = this.silicon[b] === 1, accents = si ? ACCENTS_SI : ACCENTS_C;
    let bestH = 0.5, bestA = accents[0], bestS = -1;
    for (let hi = 0; hi < HUES; hi++) {
      // centre first, then outward: 0.5, 0.375, 0.625, ... so ties keep the middle of the ring
      const h = 0.5 + (hi % 2 === 1 ? -1 : 1) * Math.ceil(hi / 2) / (HUES - 1);
      const p = creatureRing(si, this.diet[b], h);
      for (const a of accents) {
        let s = Infinity;
        for (let o = 0; o < this.max; o++) {
          if (o === b || !this.used[o] || !this.coloured[o] || this.live[o] === 0 || this.silicon[o] !== this.silicon[b]) continue;
          const dp = p - creatureRing(si, this.diet[o], this.hue[o]), da = ACCENT_W * (a - this.accent[o]);
          s = Math.min(s, dp * dp + da * da);
        }
        if (s > bestS + 1e-9) { bestS = s; bestH = h; bestA = a; }
      }
    }
    this.hue[b] = bestH; this.accent[b] = bestA; this.coloured[b] = 1; this.wears[b] = b;
    this.hard[b] = -1; this.skin[b] = 0;
    if (this.worldHardHex >= 0) this.stampHard(b);
  }

  /** Stamp bin b's mineral armour from the world's tint now (fauna-colour §2.2: the species keeps its founding era). */
  private stampHard(b: number): void {
    const si = this.silicon[b] === 1;
    this.skin[b] = skinGroundShift(si, this.diet[b], this.hue[b], this.accent[b], this.groundHex >= 0 ? this.groundHex : undefined);
    this.hard[b] = creatureHard(si, this.diet[b], this.hue[b], this.accent[b], this.worldHardHex, this.skin[b]);
  }
}

// ---- what the world drew, for other views of the same animal (the bestiary sprite) ----------------------------------
// fauna.ts records each animal's species look (colourway, pattern, proportions) under a key made from its birth plan's
// numbers. The UI unpacks the same births buffer, so its copy of the plan has the same key and finds the same look.
// A fixed ring of SEEN_MAX records (oldest out); records are float arrays, so recording allocates nothing.
const SEEN_MAX = 16384;
const SEEN_STRIDE = 7 + NT; // hue, accent, colour diet, bands, spots, hard (hex as float32, exact below 2^24; −1 none), skin shift, then every TRAIT as drawn
const seenVals = new Float32Array(SEEN_MAX * SEEN_STRIDE);
const seenKeys = new Float64Array(SEEN_MAX).fill(-1);
const seenAt = new Map<number, number>();
let seenNext = 0;
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
let h1 = 0, h2 = 0;
function mixHash(v: number): void {
  f32[0] = v;
  const x = u32[0];
  h1 = Math.imul(h1 ^ x, 0x01000193) >>> 0;
  h2 = Math.imul(h2 ^ ((x >>> 16) | (x << 16)), 0x0100019d) >>> 0;
}

/** 52-bit identity of a plan from the float32 bits of its numbers (two FNV-1a lanes). */
function planHash(p: BodyPlan): number {
  h1 = 0x811c9dc5; h2 = 0x5ad19cd4;
  for (const v of [p.scale, p.mass, p.bodyDensity, p.hue, p.accent, p.diet, p.girth, p.flatten, p.headScale, p.limbLength,
    p.hornLength, p.plateCover, p.eyeArea, p.defence, p.segmentCount, p.tiers, p.symmetry]) mixHash(v);
  return (h1 & 0xfffff) * 0x100000000 + h2;
}

/** fauna.ts: remember how the world draws the animal whose birth plan is `raw` (`drawn` = attract(raw), `look` its colourway). */
export function rememberLook(raw: BodyPlan, drawn: BodyPlan, look: SpeciesLook): void {
  const key = planHash(raw);
  let slot = seenAt.get(key);
  if (slot === undefined) {
    slot = seenNext; seenNext = (seenNext + 1) % SEEN_MAX;
    if (seenKeys[slot] >= 0) seenAt.delete(seenKeys[slot]);
    seenKeys[slot] = key; seenAt.set(key, slot);
  }
  const o = slot * SEEN_STRIDE, v = seenVals;
  v[o] = look.hue; v[o + 1] = look.accent; v[o + 2] = look.diet; v[o + 3] = drawn.bands; v[o + 4] = drawn.spots;
  v[o + 5] = look.hard ?? -1; v[o + 6] = look.skin ?? 0;
  for (let t = 0; t < NT; t++) v[o + 7 + t] = TRAITS[t].get(drawn);
}

export interface FaunaLook {
  /** The plan as the world draws it: the species' pattern and proportions (counts and kinds are the animal's own). */
  plan: BodyPlan;
  /** The species colourway, for creatureColour; `hard` its mineral armour (undefined: none stamped). */
  hue: number; accent: number; diet: number; hard?: number; skin?: number;
}

/**
 * How the world draws the animal with this birth plan: its species colourway, pattern and proportions, once fauna has
 * drawn it. Otherwise (not seen yet, e.g. off-world, or long gone from the ring) the plan's own, deterministically.
 */
export function faunaLook(raw: BodyPlan): FaunaLook {
  const slot = seenAt.get(planHash(raw));
  if (slot === undefined) return { plan: raw, hue: raw.hue, accent: raw.accent, diet: raw.diet };
  const o = slot * SEEN_STRIDE, v = seenVals;
  const plan: BodyPlan = {
    ...raw, tierRadii: raw.tierRadii.slice(), arms: raw.arms.map((a) => ({ ...a })),
    limbJointAngles: raw.limbJointAngles.slice(), modeCosts: { ...raw.modeCosts },
    hue: v[o], accent: v[o + 1], bands: v[o + 3], spots: v[o + 4],
  };
  for (let t = 0; t < NT; t++) TRAITS[t].set(plan, v[o + 7 + t]);
  return { plan, hue: v[o], accent: v[o + 1], diet: v[o + 2], hard: v[o + 5] >= 0 ? v[o + 5] : undefined, skin: v[o + 6] };
}
