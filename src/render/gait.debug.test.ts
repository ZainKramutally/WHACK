// Headless gait harness (debug/gait). Drives the pure gait pieces exactly as fauna.ts uses them today and measures what
// the eye sees: rest-spine curvature, world-space foot slip during stance, cadence against speed, duty factor and step
// pattern. The "today" helpers mirror fauna.ts (they live inside a closure there, so they cannot be imported):
//   cadence  fauna.ts:1199-1201   e.gait += dt · min(3, 1.2 + 6·speed/drawnLength)
//   amp      fauna.ts:412/435     moving = min(1, speed / (0.12·drawnLength)); stride = lay.stride·amp, lift = 0.35·len1·amp
//   speed    fauna.ts:1189-1190   e.speed += (sp − e.speed)·0.5 per 20 Hz snapshot
//   foot     fauna.ts:438-443     fx = hip.x + gaitFoot(gait + limbPhaseOffset(pair, side)).dx, world = body + fx·s0
// The "recipe" helpers are the proposed fix, kept here as a reference so the fix agent can lift them.
// Tests marked BUG fail today on purpose.
import { describe, expect, it } from 'vitest';
import { develop, type DevelopInputs } from '../sim/develop';
import { makeFounders, type AnimalGenome, type BodyGenes } from '../sim/genome';
import { beadLayout, type BeadLayout } from './creatureLayout';
import { STANCE, gaitFoot, limbPhaseOffset } from './motion';
import { drawnFactor, drawnLength } from './faunaLib/growth';

const water: DevelopInputs = {
  solvent: { rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] },
  airDensity: 0.1,
  tissueDensity: { C: 1.05, Si: 2.2 },
  gravity: 1,
};
const day = { light: 1, heatBand: 0.5 };
const founder = makeFounders(1, 1, { c: 0.85, si: 0, o: 0.15 })[0]!; // carbon.ts composition
const genome = (body: Partial<BodyGenes>, si = false): AnimalGenome => ({
  ...founder, body: { ...founder.body, ...body }, comp: si ? { c: 0.05, si: 0.9, o: 0.05 } : founder.comp,
});

const WALKERS = {
  biped: genome({ size: 0.3, segments: 0.4, limbPairs: 0.25, limbLen: 0.6, plates: 0.4, diet: 0.6 }),
  quadruped: genome({ size: 0.4, segments: 0.4, limbPairs: 0.5, limbLen: 0.6, plates: 0.3, eyes: 0.5, diet: 0.1 }),
  hexapod: genome({ size: 0.7, segments: 0.6, limbPairs: 0.75, limbLen: 0.3, horns: 0.6, gape: 0.8, diet: 0.9 }),
  worm: genome({ size: 0.05, segments: 0.5, limbPairs: 0, limbLen: 0 }),
};
const siWalker = genome({ size: 0.4, segments: 0.7, limbPairs: 0.25, limbLen: 0.6, plates: 0.5 }, true);

// --- today's model (mirrors fauna.ts) ---------------------------------------------------------------------------------
const todayRate = (speed: number, L: number) => Math.min(3, 1.2 + 6 * (speed / L));
const todayAmp = (speed: number, L: number) => Math.min(1, speed / (0.12 * L));

// --- proposed recipe -----------------------------------------------------------------------------------------------------
const G0 = 9.81;
/** Below this many drawn body lengths per second the feet stop stepping and ease to neutral. */
const IDLE_BL = 0.03;
/**
 * Half stride in DRAWN WORLD metres for a walker at world speed v: Alexander (1976) λ/h = 2.3·Fr^0.3 with Fr = v²/(g·h),
 * h = drawn hip height; a foot sweeps STANCE·λ/2 each side of neutral. Clamped to what the leg can reach (0.4·reach).
 */
function recipeHalfStride(lay: BeadLayout, s0: number, v: number, gravity = 1): number {
  const rig = lay.limbs[0]!;
  const hip = rig.hip.y * s0;                         // drawn hip height, metres
  const reach = (rig.len1 + rig.len2) * s0;
  const fr = (v * v) / (G0 * gravity * Math.max(hip, 1e-3));
  const lambda = 2.3 * hip * Math.pow(fr, 0.3);       // full cycle (one foot, two steps) in metres
  return Math.min(0.5 * STANCE * lambda, 0.4 * reach);
}
/** Distance-integrated phase: one cycle per 2·halfStride/STANCE metres travelled along the heading. */
function recipeDPhase(dist: number, halfStrideWorld: number): number {
  return halfStrideWorld > 1e-6 ? (STANCE * dist) / (2 * halfStrideWorld) : 0;
}

// --- harness -------------------------------------------------------------------------------------------------------------
interface GaitStats { cadenceHz: number; slip: number; duty: number; steps: number[] }

/**
 * Walk a creature in a straight line at `bl` drawn body lengths per second for 3 s at 60 fps with 20 Hz snapshots, and
 * measure the world-space foot speed during stance as a fraction of the body speed (0 = planted, 1 = foot carried along).
 */
function walk(lay: BeadLayout, scale: number, bl: number, model: 'today' | 'recipe'): GaitStats {
  const L = drawnLength(scale, 1), s0 = drawnFactor(scale, 1), v = bl * L;
  const dt = 1 / 60;
  let speed = 0, gait = 0, x = 0;
  const rig = lay.limbs[0]!;
  const off = limbPhaseOffset(rig.pair, rig.side);
  let slipSum = 0, slipN = 0, stanceN = 0, totalN = 0, prevFoot = NaN, cycles = 0;
  const frames = 180;
  for (let f = 0; f < frames; f++) {
    if (f % 3 === 0) speed += (v - speed) * 0.5;        // snapshot speed smoothing
    const xPrev = x;
    x += v * dt;
    let dx: number, dy: number, dPhase: number;
    if (model === 'today') {
      dPhase = dt * todayRate(speed, L);
      gait += dPhase;
      const amp = todayAmp(speed, L);
      ({ dx, dy } = gaitFoot(gait + off, lay.stride * amp, 0.35 * rig.len1 * amp));
      dx *= s0; dy *= s0;
    } else {
      const h = recipeHalfStride(lay, s0, speed);
      dPhase = speed / L < IDLE_BL ? 0 : recipeDPhase(x - xPrev, h);
      gait += dPhase;
      const g = gaitFoot(gait + off, 1, 0.35 * rig.len1 * s0);
      dx = g.dx * h; dy = g.dy;
    }
    const footW = x + rig.hip.x * s0 + dx;
    if (f >= 60) {                                      // after the speed estimate settles
      totalN++; cycles += dPhase;
      if (dy === 0) {
        stanceN++;
        if (!Number.isNaN(prevFoot)) { slipSum += Math.abs(footW - prevFoot) / (v * dt); slipN++; }
        prevFoot = footW;
      } else prevFoot = NaN;
    }
  }
  const steps = lay.limbs.map((r) => limbPhaseOffset(r.pair, r.side));
  return { cadenceHz: cycles / (totalN * dt), slip: slipN ? slipSum / slipN : 0, duty: stanceN / totalN, steps };
}

const planOf = (g: AnimalGenome) => develop(g, day, water);

describe('gait harness (debug/gait)', () => {
  it('report: rest spine, cadence, slip and step pattern (always passes; read the table)', () => {
    const rows: string[] = [];
    for (const [name, g] of Object.entries(WALKERS)) {
      const p = planOf(g), lay = beadLayout(p);
      const N = p.segmentCount + p.tailSegments;
      const spine = lay.beads.slice(0, N);
      const zs = spine.map((b) => b.z), xs = spine.map((b) => b.x);
      const lat = (Math.max(...zs) - Math.min(...zs)) / (Math.max(...xs) - Math.min(...xs));
      const turn = (p.curl * (N - 1) * 180) / Math.PI;
      rows.push(`${name}: scale ${p.scale.toFixed(2)} m, drawn ${drawnLength(p.scale, 1).toFixed(1)} m, legs ${p.legPairs} pairs (${p.limbKind}), curl ${p.curl.toFixed(3)} rad/joint × ${N - 1} = ${turn.toFixed(0)}° arc, lateral sag ${(100 * lat).toFixed(0)}% of length`);
      if (!lay.limbs.length) continue;
      const s0 = drawnFactor(p.scale, 1);
      rows.push(`   half stride today ${(lay.stride * s0).toFixed(2)} m drawn; hip ${(lay.limbs[0].hip.y * s0).toFixed(2)} m; steps [${lay.limbs.map((r) => `p${r.pair}${r.side > 0 ? 'L' : 'R'}=${limbPhaseOffset(r.pair, r.side)}`).join(' ')}]`);
      for (const bl of [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2]) {
        const a = walk(lay, p.scale, bl, 'today'), b = walk(lay, p.scale, bl, 'recipe');
        rows.push(`   ${bl.toFixed(2)} BL/s (${(bl * drawnLength(p.scale, 1)).toFixed(1)} m/s): today ${a.cadenceHz.toFixed(2)} Hz slip ${(100 * a.slip).toFixed(0)}% duty ${a.duty.toFixed(2)} | recipe ${b.cadenceHz.toFixed(2)} Hz slip ${(100 * b.slip).toFixed(0)}% half-stride ${recipeHalfStride(lay, s0, bl * drawnLength(p.scale, 1)).toFixed(2)} m`);
      }
    }
    const ps = planOf(siWalker), ls = beadLayout(ps);
    const zs = ls.beads.slice(0, ps.segmentCount + ps.tailSegments).map((b) => b.z);
    rows.push(`silicon armoured walker: architecture ${ps.architecture}, curl ${ps.curl.toFixed(3)}, lateral span ${(Math.max(...zs) - Math.min(...zs)).toFixed(4)} m`);
    console.log(rows.join('\n'));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('BUG: a walker at rest has a straight spine (no sideways arc)', () => {
    for (const [name, g] of Object.entries(WALKERS)) {
      const p = planOf(g), lay = beadLayout(p);
      const spine = lay.beads.slice(0, p.segmentCount + p.tailSegments);
      const zs = spine.map((b) => b.z), yaws = spine.map((b) => b.yaw ?? 0);
      expect({ name, lateral: Math.max(...zs) - Math.min(...zs) }).toEqual({ name, lateral: 0 });
      expect({ name, yaw: Math.max(...yaws.map(Math.abs)) }).toEqual({ name, yaw: 0 });
    }
  });

  it('BUG: feet stay planted during stance at every walking speed (world slip < 5% of body speed)', () => {
    for (const name of ['biped', 'quadruped', 'hexapod'] as const) {
      const p = planOf(WALKERS[name]), lay = beadLayout(p);
      for (const bl of [0.05, 0.25, 1, 2]) {
        const s = walk(lay, p.scale, bl, 'today');
        expect.soft(s.slip, `${name} at ${bl} BL/s slips ${(100 * s.slip).toFixed(0)}% of body speed`).toBeLessThan(0.05);
      }
    }
  });

  it('BUG: at near-zero speed the feet do not keep stepping (cadence → 0 as speed → 0)', () => {
    const p = planOf(WALKERS.quadruped), lay = beadLayout(p);
    const s = walk(lay, p.scale, 0.02, 'today');
    expect(s.cadenceHz, 'today steps at the 1.2 Hz floor while barely moving').toBeLessThan(0.3);
  });

  it('BUG: cadence matches the no-slip cadence STANCE·v/(2·halfStride) at walking and fast speeds', () => {
    const p = planOf(WALKERS.biped), lay = beadLayout(p), L = drawnLength(p.scale, 1), s0 = drawnFactor(p.scale, 1);
    for (const bl of [0.25, 2]) {
      const need = (STANCE * bl * L) / (2 * lay.stride * s0); // amp is saturated (1) above 0.12 BL/s
      const got = walk(lay, p.scale, bl, 'today').cadenceHz;
      expect.soft(got / need, `at ${bl} BL/s today ${got.toFixed(2)} Hz, planted feet need ${need.toFixed(2)} Hz`).toBeCloseTo(1, 1);
    }
  });

  it('recipe: distance-integrated phase keeps feet planted, grows stride with speed, and freezes when idle', () => {
    for (const name of ['biped', 'quadruped', 'hexapod'] as const) {
      const p = planOf(WALKERS[name]), lay = beadLayout(p), s0 = drawnFactor(p.scale, 1), L = drawnLength(p.scale, 1);
      for (const bl of [0.05, 0.25, 1, 2]) expect(walk(lay, p.scale, bl, 'recipe').slip).toBeLessThan(0.05);
      expect(walk(lay, p.scale, 0.01, 'recipe').cadenceHz).toBe(0);
      expect(recipeHalfStride(lay, s0, 1 * L)).toBeGreaterThanOrEqual(recipeHalfStride(lay, s0, 0.25 * L));
    }
  });

  it('report: duty factor and step pattern (trot couplets today)', () => {
    const p = planOf(WALKERS.quadruped), lay = beadLayout(p);
    // pair 0 sits near the tail (hind), pair 1 near the head (fore). Today: LH=0, RH=.5, LF=.5, RF=0 → diagonal couplets
    // (a trot) at every speed, duty factor fixed at STANCE = 0.6.
    const pat = lay.limbs.map((r) => [r.pair, r.side, limbPhaseOffset(r.pair, r.side)]);
    expect(pat).toEqual([[0, 1, 0], [0, -1, 0.5], [1, 1, 0.5], [1, -1, 0]]);
    expect(walk(lay, p.scale, 0.5, 'today').duty).toBeCloseTo(STANCE, 1);
  });
});
