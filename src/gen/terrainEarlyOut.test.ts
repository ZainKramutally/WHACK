import { describe, expect, it } from 'vitest';
import { withCrustChoice } from './crust';
import { createTerrain, crustScore, heightCore, kit64, pillarCell, warpBase, crustWeights, type TerrainParams } from './terrain';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';

// Reference: the pre-optimisation M7 block (full pillarCell, then the point gate), on top of heightCore with p7 = 0.
function oracle(P: TerrainParams, rise: number, hs: number, p: number[], x: number, z: number): number {
  const [p2, p3, p4, p5, p6, p7, p8, p9] = p;
  const base = heightCore(P, rise, hs, p2, p3, p4, p5, p6, x, z, kit64, 0, p8, p9);
  if (P.active.M7 && p7 > 0) {
    const m7 = P.machines.M7!;
    const hx = kit64.hexCell(x / m7.size, z / m7.size);
    const pc = pillarCell(P, hx.ix, hx.iz, hs, p2, p3, p4, p5, p6, p8, p9, kit64);
    const g = P.gates.M7;
    const cw = g ? crustWeights(P, crustScore(P, warpBase(P, x, z, kit64).bn, x, z, kit64), kit64) : [];
    const gate = g ? g.reduce((a, c, j) => a + c * (cw[j] ?? 0), 0) : 1;
    if (pc.present && gate > 0.5) return rise * (pc.ground + p7 * pc.step);
  }
  return base;
}

describe('heightCore early-outs are bit-identical', () => {
  it('matches the reference over picks, worlds and states', () => {
    const states: [number, number, number[]][] = [
      [1, 0.5, [1, 1, 1, 1, 1, 1, 1, 1]],
      [0.6, 0.2, [0.5, 0.3, 0, 0.7, 0.4, 0.8, 0.2, 0.9]],
      [0.3, 0.9, [0, 0, 0, 0, 0, 0.1, 0, 0]],
      [1, 0.5, [1, 1, 0, 1, 1, 0, 1, 1]],
    ];
    const cases: [typeof carbon, string | undefined][] = [
      [carbon, undefined], [carbon, 'basalt'], [carbon, 'granite'], [silicon, undefined], [silicon, 'nitride'],
    ];
    for (const [w, pick] of cases) {
      const world = withCrustChoice(w, pick as never);
      const P = createTerrain(world.terrain, world.demoSeed).params;
      for (const [rise, hs, p] of states) {
        for (let i = 0; i < 400; i++) {
          const x = ((i % 20) / 19 - 0.5) * 380 + 0.37, z = (Math.floor(i / 20) / 19 - 0.5) * 380 + 0.11;
          const a = heightCore(P, rise, hs, p[0], p[1], p[2], p[3], p[4], x, z, kit64, p[5], p[6], p[7]);
          const b = oracle(P, rise, hs, p, x, z);
          expect(a === b || Object.is(a, b)).toBe(true);
        }
      }
    }
  });
});
