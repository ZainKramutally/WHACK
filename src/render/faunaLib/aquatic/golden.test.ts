// Golden test for the allocation-free pose: every swimmer kind and branch, posed by build.ts and by the frozen
// pre-rewrite copy (golden/buildV1.ts), must emit the same sink calls in the same order with the same numbers (1e-6).
import { describe, expect, it } from 'vitest';
import { develop, type DevelopInputs } from '../../../sim/develop';
import { makeFounders, type AnimalGenome, type BodyGenes } from '../../../sim/genome';
import { buildSwimmer, type SwimSink } from './build';
import { buildSwimmer as buildV1 } from './golden/buildV1';
import { swimmerParamsFromPlan } from './fromPlan';
import { DEFAULT_PARAMS, mergeParams, normaliseParams, type DeepPartial, type SwimmerParams } from './params';
import type { Path, V3 } from './v3';

const water: DevelopInputs = {
  solvent: { rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] }, airDensity: 0.1, tissueDensity: { C: 1.05, Si: 2.2 }, gravity: 1,
};
const founder = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
const fromGenes = (body: Partial<BodyGenes>, si = false) => {
  const g: AnimalGenome = { ...founder, body: { ...founder.body, ...body }, comp: si ? { c: 0.05, si: 0.9, o: 0.05 } : founder.comp };
  return swimmerParamsFromPlan(develop(g, { light: 1, heatBand: 0.5 }, water));
};
const mk = (over: DeepPartial<SwimmerParams>) => normaliseParams(mergeParams(DEFAULT_PARAMS, over));

/** Every plan, and every optional branch of the pose at least once. */
const KINDS: Record<string, SwimmerParams> = {
  'fusiform keel, stalked up-eyes, jaw, photophores, plates, crest': mk({
    plan: 'fusiform', fins: { dorsal: 0.08, ventral: 0.2, lateral: 1 }, tail: 'fork', photophores: 6, lateralLine: 0.5, plates: 0.5, glow: 0.6,
    head: { eyes: 2, stalks: 0.1, mouth: 'jaw', crest: 2 },
  }),
  'ribbon oars, whip tail, median eye, cone mouth': mk({ plan: 'ribbon', fins: { dorsal: 0.2, lateral: 2 }, tail: 'whip', lateralLine: 1, glow: 0.4, head: { eyes: 3, mouth: 'cone', crest: 3 } }),
  'segmented lobes, fan tail, feelers, proboscis': mk({ plan: 'segmented', fins: { lateral: 5, fringe: 0.6 }, tail: 'fan', plates: 1, head: { eyes: 5, stalks: 0.2, feelers: 2, mouth: 'proboscis' } }),
  'disc, lunate tail, one feeler': mk({ plan: 'disc', aspect: 0.6, depth: 0.5, fins: { lateral: 2 }, tail: 'lunate', head: { eyes: 2, feelers: 1 } }),
  plesiosaur: mk({ plan: 'plesiosaur', fins: { lateral: 2, lateralSize: 0.3 }, neck: 0.3, tailLen: 0.2, tail: 'taper' }),
  'radial rower, spikes, trail, feelers': mk({ chemistry: 'silicon', plan: 'radial', radial: { symmetry: 6, tiers: 3, spikes: 0.5, trail: 1 }, head: { eyes: 3, feelers: 2 }, glow: 0.5, translucency: 0.7 }),
  'radial rower, 5-fold, one eye': mk({ chemistry: 'silicon', plan: 'radial', radial: { symmetry: 5, tiers: 2 }, head: { eyes: 1 } }),
  'bell chain with trail': mk({ chemistry: 'silicon', plan: 'bell', radial: { chain: 3, trail: 1 }, head: { eyes: 1 }, glow: 0.8 }),
  'lone bell, no eyes': mk({ chemistry: 'silicon', plan: 'bell', radial: { chain: 1 }, head: { eyes: 0 } }),
  'develop: carbon eel': fromGenes({ segments: 0.9, limbPairs: 0, size: 0.4, buoy: 0.5 }),
  'develop: carbon plated': fromGenes({ segments: 0.4, plates: 0.8, limbPairs: 0.5, horns: 0.5, diet: 0.8 }),
  'develop: carbon plesiosaur': fromGenes({ limbPairs: 0.6, limbLen: 0.8, segments: 0.4, size: 0.4 }),
  'develop: carbon long-neck': fromGenes({ limbPairs: 0.6, limbLen: 0.8, segments: 1, size: 0.4, gape: 0, eyes: 0, diet: 0.1 }),
  'develop: silicon rower': fromGenes({ limbPairs: 0.5, limbLen: 0.6, size: 0.4 }, true),
};

const norm = (x: number, y: number, z: number): V3 => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const PATHS: Record<string, Path> = {
  straight: { length: Infinity, at: (s) => ({ p: [s, 2, 0], t: [1, 0, 0] }) },
  // a climbing curve: banking, and frames off the horizontal
  curve: { length: Infinity, at: (s) => ({ p: [20 * Math.sin(s / 20), 2 + 0.1 * s, 20 - 20 * Math.cos(s / 20)], t: norm(Math.cos(s / 20), 0.1, Math.sin(s / 20)) }) },
  // nearly vertical: frameOf's fallback reference axis
  vertical: { length: Infinity, at: (s) => ({ p: [0.1 * s, 0.995 * s, 0], t: norm(0.1, 0.995, 0) }) },
};
const INSTS = [{ s0: 0, phase: 0.3, off: [0, 0] as [number, number], k: 0 }, { s0: -2, phase: 0.71, off: [0.5, -0.3] as [number, number], k: 3 }];
const TIMES = [0, 0.41, 2.2, 7.3];

type Call = { what: string; nums: number[] };
/** Every sink call with its numbers copied at call time (the rewrite reuses its arrays between calls). */
function record(pose: (sink: SwimSink) => { centre: V3; forward: V3 }): Call[] {
  const out: Call[] = [];
  const vs = (a: V3[]) => a.flatMap((v) => [v[0], v[1], v[2]]);
  const sink: SwimSink = {
    tube: (i, c, U, R, rw, rh, top) => out.push({ what: `tube ${i} ${c.length} top ${top ?? 'none'}`, nums: [...vs(c), ...vs(U), ...vs(R), ...rw, ...rh] }),
    sheet: (i, a, b) => out.push({ what: `sheet ${i} ${a.length}`, nums: [...vs(a), ...vs(b)] }),
    part: (type, o, x, y, z, a, b, glow, tr) => out.push({ what: `part ${type} ${a} ${b} ${tr}`, nums: [...o, ...x, ...y, ...z, glow] }),
  };
  const r = pose(sink);
  out.push({ what: 'return', nums: [...r.centre, ...r.forward] });
  return out;
}

describe('allocation-free swimmer pose matches the pre-rewrite pose (golden)', () => {
  it.each(Object.keys(KINDS))('%s', (name) => {
    const p = KINDS[name];
    for (const seed of [1, 7]) {
      const now = buildSwimmer(p, seed), ref = buildV1(p, seed);
      expect(now.L).toBe(ref.L);
      expect(now.tubes).toEqual(ref.tubes);
      expect(now.sheets).toEqual(ref.sheets);
      for (const [pn, path] of Object.entries(PATHS)) for (const inst of INSTS) for (const t of TIMES) {
        // pose twice first: scratch reuse must not leak state from one pose into the next
        record((s) => now.pose(t + 1.3, path, inst, s));
        const a = record((s) => now.pose(t, path, inst, s)), b = record((s) => ref.pose(t, path, inst, s));
        const tag = `${name} seed ${seed} ${pn} k${inst.k} t ${t}`;
        expect(a.map((c) => c.what), tag).toEqual(b.map((c) => c.what));
        let worst = 0;
        for (let i = 0; i < a.length; i++) {
          expect(a[i].nums.length, `${tag} call ${i}`).toBe(b[i].nums.length);
          for (let j = 0; j < a[i].nums.length; j++) worst = Math.max(worst, Math.abs(a[i].nums[j] - b[i].nums[j]));
        }
        expect(worst, tag).toBeLessThanOrEqual(1e-6);
      }
    }
  });
});
