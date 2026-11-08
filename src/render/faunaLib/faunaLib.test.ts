import { describe, expect, it } from 'vitest';
import { develop, type DevelopInputs } from '../../sim/develop';
import { BODY_GENES, makeFounders, type AnimalGenome, type BodyGenes } from '../../sim/genome';
import { OrganismField, geneField } from '../../sim/organismLayout';
import { BEAD_EYE, beadLayout } from '../creatureLayout';
import { PART, bellSphere, describe as describeFauna, pickBounds } from './adapter';
import { RING_STRIDE, circleSection, setRing, writeRings } from './loft';
import { SETTLE, SPECIES_DIM, SpeciesBook, faunaLook, rememberLook, type SpeciesLook } from './species';
import { packBodyPlan, unpackBodyPlan } from '../../sim/plan';
import { GROWN_FLOOR, drawnFactor, drawnLength, growthLength } from './growth';
import { displayLength } from '../layout';
import { creatureRing } from '../palette';

const water: DevelopInputs = {
  solvent: { rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] },
  airDensity: 0.1,
  tissueDensity: { C: 1.05, Si: 2.2 },
  gravity: 1,
};
const day = { light: 1, heatBand: 0.5 };
const founder = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
const genome = (body: Partial<BodyGenes>, si = false): AnimalGenome => ({
  ...founder, body: { ...founder.body, ...body }, comp: si ? { c: 0.05, si: 0.9, o: 0.05 } : founder.comp,
});
/** The classifier's input, as the organism buffer lays it out (12 genes, then comp c and si). */
const vec = (g: AnimalGenome) => Float32Array.from([...BODY_GENES.map((k) => g.body[k]), g.comp.c, g.comp.si]);
const look = (): SpeciesLook => ({ hue: 0, accent: 0, diet: 0, bands: 0, spots: 0 });

const grazer = genome({ size: 0.4, segments: 0.4, limbPairs: 0.5, limbLen: 0.6, plates: 0.3, eyes: 0.5, diet: 0.1 });
const hunter = genome({ size: 0.7, segments: 0.6, limbPairs: 0.75, limbLen: 0.3, horns: 0.6, gape: 0.8, diet: 0.9 });
const jitter = (g: AnimalGenome, k: number): AnimalGenome => {
  const body = { ...g.body };
  BODY_GENES.forEach((key, i) => { body[key] = Math.min(1, Math.max(0, body[key] + 0.02 * Math.sin(1.7 * k + i))); });
  return { ...g, body };
};

describe('SpeciesBook (render look attractor)', () => {
  it('reads the field guide space straight from the organism buffer (12 genes, then comp c and si)', () => {
    expect(geneField('size') + 12).toBe(OrganismField.compC);
    expect(geneField('size') + 13).toBe(OrganismField.compSi);
    expect(SPECIES_DIM).toBe(14);
  });

  it('members of a species share one colourway; a far new species wears its neighbour’s until it settles, then sits apart', () => {
    const book = new SpeciesBook();
    const looks: SpeciesLook[] = [];
    let binA = -1;
    for (let k = 0; k < 10; k++) {
      const g = jitter(grazer, k);
      const b = book.assign(vec(g), 0, develop(g, day, water));
      if (k === 0) binA = b;
      expect(b).toBe(binA);
      looks.push(book.lookOf(b, look()));
    }
    for (const l of looks) expect(l).toEqual(looks[0]);

    const first = book.assign(vec(hunter), 0, develop(hunter, day, water));
    expect(first).not.toBe(binA);
    expect(book.lookOf(first, look())).toEqual(looks[0]); // one lone mutant never shows a colour of its own
    for (let k = 1; k < SETTLE; k++) {
      const g = jitter(hunter, k);
      expect(book.assign(vec(g), 0, develop(g, day, water))).toBe(first);
    }
    const settled = book.lookOf(first, look());
    expect(Math.abs(settled.hue - looks[0].hue) + Math.abs(settled.accent - looks[0].accent)).toBeGreaterThan(0.25);
    expect(settled.diet).toBeGreaterThan(looks[0].diet); // value follows the founder's diet: hunters darker
    expect(book.colourways()).toBe(2);
  });

  it('the periphery of a species (a bin under SEPARATE from it) keeps the species colourway however big it grows', () => {
    const book = new SpeciesBook();
    const a = book.assign(vec(grazer), 0, develop(grazer, day, water));
    const near = genome({ ...grazer.body, diet: grazer.body.diet + 0.35 }); // 0.35 away: its own bin, the same colour
    let b = -1;
    for (let k = 0; k < 3 * SETTLE; k++) b = book.assign(vec(near), 0, develop(near, day, water));
    expect(b).not.toBe(a);
    expect(book.lookOf(b, look())).toEqual(book.lookOf(a, look()));
    expect(book.colourways()).toBe(1);
  });

  it('attract keeps counts and kinds, takes the species pattern, and pulls proportions toward the mean', () => {
    const book = new SpeciesBook();
    const plans = [0, 1, 2, 3, 4, 5].map((k) => develop(jitter(grazer, k), day, water));
    let bin = -1;
    plans.forEach((p, k) => { bin = book.assign(vec(jitter(grazer, k)), 0, p); });
    const odd = { ...plans[2], girth: plans[2].girth + 0.5, bands: 3, spots: 1 };
    const l = book.lookOf(bin, look());
    const drawn = book.attract(odd, bin, l);
    for (const k of ['legPairs', 'limbKind', 'hornCount', 'hornKind', 'eyeCount', 'eyeKind', 'plateCover', 'segmentCount', 'tailKind', 'mode', 'scale'] as const) {
      expect(drawn[k]).toEqual(odd[k]);
    }
    expect(drawn.girth).toBeLessThan(odd.girth);
    expect(drawn.girth).toBeGreaterThan(plans[0].girth - 0.2);
    expect([drawn.hue, drawn.accent, drawn.bands, drawn.spots]).toEqual([l.hue, l.accent, l.bands, l.spots]);
    expect(odd.girth).toBe(plans[2].girth + 0.5); // the input plan is untouched
  });

  it('gives every species exactly one pattern, bands or spots, in its accent', () => {
    for (const g of [grazer, hunter]) {
      for (const [bands, spots] of [[0, 0], [2, 0.8], [3, 0.1], [0, 0.2]] as const) {
        const book = new SpeciesBook(); // the founder's plan decides its species' pattern
        const b = book.assign(vec(g), 0, { ...develop(g, day, water), bands, spots });
        const l = book.lookOf(b, look());
        expect((l.bands > 0) !== (l.spots > 0)).toBe(true);
        expect(l.bands > 0).toBe(bands > 0 && spots < 0.5);
      }
    }
  });

  it('never grows a feature an animal lacks (a fin-less member stays fin-less)', () => {
    const book = new SpeciesBook();
    const p = develop(grazer, day, water);
    const finned = { ...p, finSpan: 0.8 };
    const b = book.assign(vec(grazer), 0, finned);
    const drawn = book.attract({ ...p, finSpan: 0 }, b, book.lookOf(b, look()));
    expect(drawn.finSpan).toBe(0);
  });

  it('spreads species colourways along the real colour ring; silicon keeps its own chemistry apart', () => {
    const book = new SpeciesBook();
    const rings: number[] = [];
    for (let s = 0; s < 4; s++) {
      let b = -1;
      for (let k = 0; k < SETTLE; k++) {
        const g = jitter(genome({ size: 0.05 + 0.3 * s, limbPairs: 0.05 + 0.3 * s, diet: 0.05 + 0.3 * s, horns: 0.05 + 0.3 * s }), k);
        b = book.assign(vec(g), 0, develop(g, day, water));
      }
      const l = book.lookOf(b, look());
      rings.push(creatureRing(false, l.diet, l.hue));
    }
    expect(book.colourways()).toBe(4);
    rings.sort((x, y) => x - y);
    for (let i = 1; i < rings.length; i++) expect(rings[i] - rings[i - 1]).toBeGreaterThan(0.08);
    const si = genome({ size: 0.15, limbPairs: 0.15, diet: 0.0 }, true);
    const b = book.assign(vec(si), 0, develop(si, day, water));
    expect(b).toBeGreaterThanOrEqual(0);
    // the first silicon species colours at once in its own chemistry (no carbon neighbour to borrow from)
    expect(book.lookOf(b, look()).hue).toBe(0.5);
  });

  it('releases members, ignores stale stamps, and recycles empty bins', () => {
    const book = new SpeciesBook(2);
    const a = book.assign(vec(grazer), 0, develop(grazer, day, water));
    const sa = book.stampOf(a);
    const b = book.assign(vec(hunter), 0, develop(hunter, day, water));
    expect(book.liveBins()).toBe(2);
    book.release(a, sa);
    expect(book.liveBins()).toBe(1);
    const third = genome({ size: 1, segments: 1, buoy: 1, glow: 1 });
    const c = book.assign(vec(third), 0, develop(third, day, water));
    expect(c).toBe(a); // the empty bin is reused
    book.release(a, sa); // stale: the bin belongs to the new species now
    expect(book.liveBins()).toBe(2);
    expect(b).not.toBe(c);
  });
});

describe('loft writer', () => {
  it('pads a slot with the last ring’s positions (zero-area quads) and writes unit normals', () => {
    const sec = circleSection(8);
    const rings = new Float32Array(4 * RING_STRIDE);
    setRing(rings, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.1, 0.1, 0);
    setRing(rings, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0.3, 0);
    setRing(rings, 2, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0.2, 0.2, 1);
    const max = 5, nv = max * sec.n;
    const pos = new Float32Array(nv * 3).fill(9), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), glow = new Float32Array(nv);
    const rgb = Float32Array.from([1, 0, 0, 0, 1, 0]), gw = Float32Array.from([0, 0.5]);
    writeRings(rings, 3, max, sec, pos, nor, col, glow, 0, rgb, gw);
    const lastRing = pos.slice(2 * sec.n * 3, 3 * sec.n * 3);
    for (let i = 3; i < max; i++) expect(Array.from(pos.slice(i * sec.n * 3, (i + 1) * sec.n * 3))).toEqual(Array.from(lastRing));
    for (let v = 0; v < 3 * sec.n; v++) expect(Math.hypot(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2])).toBeCloseTo(1, 5);
    expect(glow[2 * sec.n]).toBe(0.5); // ring 2 takes slot 1's glow weight
    // the second ring is an ellipse: 0.5 across (z), 0.3 up (y)
    let zMax = 0, yMax = 0;
    for (let j = 0; j < sec.n; j++) { const k = (sec.n + j) * 3; zMax = Math.max(zMax, Math.abs(pos[k + 2])); yMax = Math.max(yMax, Math.abs(pos[k + 1])); }
    expect(zMax).toBeCloseTo(0.5, 5);
    expect(yMax).toBeCloseTo(0.3, 5);
  });
});

describe('fauna adapter', () => {
  it('carbon: a spine loft and parts anchored to real beads, legs on the layout’s rigs, ring eyes', () => {
    const plan = develop(hunter, day, water);
    const lay = beadLayout(plan);
    const d = describeFauna(plan, lay);
    expect(d.kind).toBe('axial');
    if (d.kind !== 'axial') return;
    for (const s of d.spine) expect(s.bead).toBeLessThan(lay.nBody);
    for (const p of d.parts) {
      expect(p.a).toBeLessThan(lay.beads.length);
      expect(p.b).toBeLessThan(lay.beads.length);
      expect(p.rRef).toBeLessThan(lay.beads.length);
    }
    expect(d.legs).toHaveLength(lay.limbs.length);
    expect(d.eyes.length).toBe(plan.eyeCount);
    for (const i of d.eyes) expect(lay.beads[i].tone).toBe(BEAD_EYE);
  });

  it('silicon: radial, every part on a hub or arm rod, arms as the layout has them, no head parts', () => {
    const si = genome({ size: 0.4, limbPairs: 0.5, limbLen: 0.6, plates: 0.9, horns: 0.6, eyes: 0.6 }, true);
    const plan = develop(si, day, water);
    const lay = beadLayout(plan);
    const d = describeFauna(plan, lay);
    expect(d.kind).toBe('radial');
    if (d.kind !== 'radial') return;
    expect(d.arms).toHaveLength(plan.symmetry);
    const nRods = lay.radial!.rods.length;
    for (const p of d.parts) {
      expect(p.rod).toBe(true);
      expect(p.b).toBeLessThan(nRods);
      expect([PART.ring, PART.frill, PART.hornC, PART.plateC, PART.knob]).not.toContain(p.type);
    }
    for (const a of d.arms) expect(a.tipRod).toBeLessThan(a.nRods);
  });
});

describe('faunaLook (the bestiary sprite draws what the world draws)', () => {
  it('finds the world look for another unpack of the same birth plan, and falls back to the plan otherwise', () => {
    const packed = packBodyPlan(develop(hunter, day, water));
    const worlds = unpackBodyPlan(packed), uis = unpackBodyPlan(packed); // fauna's copy and the UI's copy of one birth
    const book = new SpeciesBook();
    const bin = book.assign(vec(hunter), 0, worlds);
    const l = book.lookOf(bin, look());
    const drawn = book.attract({ ...worlds, girth: worlds.girth + 0.3 }, bin, l);
    rememberLook(worlds, drawn, l);
    const seen = faunaLook(uis);
    expect(seen.hue).toBeCloseTo(l.hue, 6);
    expect(seen.accent).toBeCloseTo(l.accent, 6);
    expect(seen.diet).toBeCloseTo(l.diet, 6);
    expect(seen.plan.bands).toBe(drawn.bands);
    expect(seen.plan.spots).toBeCloseTo(drawn.spots, 6);
    expect(seen.plan.girth).toBeCloseTo(drawn.girth, 5); // the world's proportions, not the UI copy's own
    expect([seen.plan.legPairs, seen.plan.hornCount, seen.plan.eyeCount]).toEqual([uis.legPairs, uis.hornCount, uis.eyeCount]);
    const stranger = unpackBodyPlan(packBodyPlan(develop(grazer, day, water)));
    const fb = faunaLook(stranger);
    expect(fb.plan).toBe(stranger);
    expect([fb.hue, fb.accent, fb.diet]).toEqual([stranger.hue, stranger.accent, stranger.diet]);
  });
});

describe('picking a carbon floater', () => {
  it('one bell sphere holds the drawn gas bell, and the broad-phase bounds hold both the body and the bell', () => {
    const plan = develop(genome({ buoy: 1, size: 0.5, segments: 0.2, limbPairs: 0, diet: 0.1 }), day, water);
    const lay = beadLayout(plan);
    const d = describeFauna(plan, lay);
    expect(d.kind).toBe('axial');
    if (d.kind !== 'axial') return;
    const b = bellSphere(d, lay);
    const over = lay.beads[d.bell.over], base = over.y + over.r * 0.55;
    const pad = 1.02; // hit() tests the bell at 0.85 × its radius, padded 1.2×
    // the drawn bell: its crown (base + h, over the bead) and its widest ring (r at 0.4 h) are inside the tested sphere
    expect(Math.abs(base + d.bell.h - b.y)).toBeLessThanOrEqual(b.r * pad);
    expect(Math.hypot(d.bell.r, base + 0.4 * d.bell.h - b.y)).toBeLessThanOrEqual(b.r * pad);
    expect(b.y - b.r).toBeGreaterThan(lay.centreY - lay.radius); // it sits up over the body, not inside it
    const pb = pickBounds(lay, b);
    expect(pb.r + 1e-9).toBeGreaterThanOrEqual(Math.abs(lay.centreY - pb.cy) + lay.radius);
    expect(pb.r + 1e-9).toBeGreaterThanOrEqual(Math.hypot(b.x, b.y - pb.cy, b.z) + b.r);
    expect(pickBounds(lay, null)).toEqual({ cy: lay.centreY, r: lay.radius });
  });
});

describe('juveniles draw smaller (OrganismField.grown)', () => {
  it('maps mass to length by a cube root, floored and monotone; missing, 0, NaN or full-grown is adult size', () => {
    expect(growthLength(1)).toBe(1);
    expect(growthLength(0.125)).toBeCloseTo(0.5, 9);
    expect(growthLength(1e-6)).toBe(GROWN_FLOOR);
    for (const bad of [undefined, 0, NaN, -1, 2]) expect(growthLength(bad)).toBe(1);
    let prev = 0;
    for (let m = 0.001; m <= 1; m += 0.01) { const g = growthLength(m); expect(g).toBeGreaterThanOrEqual(prev); prev = g; }
  });

  it('enters the display-size curve as the juvenile’s real length, smaller than its adult', () => {
    expect(drawnLength(2, 0.5)).toBe(displayLength(1));
    expect(drawnFactor(2, 0.5) * 2).toBeCloseTo(displayLength(1), 9);
    expect(drawnFactor(2, 0.5)).toBeLessThan(drawnFactor(2, 1));
    expect(drawnFactor(2, 1)).toBeCloseTo(displayLength(2) / 2, 9); // adults are drawn exactly as before
  });
});
