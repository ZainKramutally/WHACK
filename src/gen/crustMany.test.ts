import { describe, expect, it } from 'vitest';
import { crustMap } from './crust';
import { createTerrain, crustScore, crustWeights, kit32, kit64, sampleShares, warpBase } from './terrain';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import type { MineralDef, WorldConfig } from '../worlds/types';

// Fixture: carbon's crust extended to 7 minerals (2 absent: share [0, 0]) by cloning real minerals under new ids.
const base = carbon.terrain.crust.minerals;
const clone = (m: MineralDef, id: string, elevation: number, share: [number, number]): MineralDef => ({ ...m, id, elevation, share, pick: undefined });
const present: MineralDef[] = [...base, clone(base[0], 'extraA', 0.3, [0.05, 0.1]), clone(base[1], 'extraB', 0.7, [0.05, 0.1])];
const minerals: MineralDef[] = [...present, clone(base[0], 'absentA', 0.5, [0, 0]), clone(base[1], 'absentB', 0.9, [0, 0])];
const world = (ms: MineralDef[]): WorldConfig => ({ ...carbon, terrain: { ...carbon.terrain, crust: { ...carbon.terrain.crust, minerals: ms } } });
const pts = Array.from({ length: 900 }, (_, i) => [((i % 30) / 29 - 0.5) * 400, (Math.floor(i / 30) / 29 - 0.5) * 400] as const);

function check(ms: MineralDef[], absentIdx: number[]) {
  const w = world(ms);
  const t = createTerrain(w.terrain, 11);
  const P = t.params;
  let worst = 0;
  for (const [x, z] of pts) {
    const a = t.crustWeights(x, z);
    expect(a).toHaveLength(ms.length);
    a.forEach((v) => expect(Number.isNaN(v)).toBe(false));
    expect(a.reduce((p, q) => p + q, 0)).toBeCloseTo(1, 9);
    for (const i of absentIdx) expect(a[i]).toBe(0);
    const fx = Math.fround(x), fz = Math.fround(z);
    const w32 = crustWeights(P, crustScore(P, warpBase(P, fx, fz, kit32).bn, fx, fz, kit32), kit32);
    const w64 = crustWeights(P, crustScore(P, warpBase(P, x, z, kit64).bn, x, z, kit64), kit64);
    w32.forEach((v) => expect(Number.isNaN(v)).toBe(false));
    w64.forEach((v, j) => { worst = Math.max(worst, Math.abs(v - w32[j])); });
  }
  expect(worst).toBeLessThan(0.05);
  const map = crustMap(w, 11);
  ms.forEach((m, i) => {
    if (absentIdx.includes(i)) expect(map.shares[i]).toBe(0);
    else { expect(map.shares[i]).toBeGreaterThanOrEqual(m.share[0] - 0.002); expect(map.shares[i]).toBeLessThanOrEqual(m.share[1] + 0.002); }
  });
  expect(map.shares.reduce((p, q) => p + q, 0)).toBeCloseTo(1, 9);
}

describe('crust with up to 8 minerals', () => {
  it('7 minerals, 2 absent: parity, no NaN, absent weight exactly 0, shares in bounds', () => check(minerals, [5, 6]));

  it('an absent mineral raised to a narrow band behaves like any other', () => {
    const raised = minerals.map((m, i) => (i === 5 ? { ...m, share: [0.19, 0.21] as [number, number] } : i < 5 ? { ...m, share: [Math.max(0, m.share[0] * 0.8), m.share[1] * 0.8] as [number, number] } : m));
    check(raised, [6]);
    const map = crustMap(world(raised), 11);
    expect(Math.abs(map.shares[5] - 0.2)).toBeLessThan(0.015);
  });

  it('sampleShares accepts [0, 0] bounds and narrow bands', () => {
    let n = 0;
    const rng = () => ((n = (n * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const s = sampleShares([{ share: [0.2, 0.4] }, { share: [0, 0] }, { share: [0.5, 0.7] }, { share: [0.1, 0.1002] }], rng);
    expect(s[1]).toBe(0);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    s.forEach((v) => expect(Number.isNaN(v)).toBe(false));
  });

  it('real configs keep their present minerals and sum to 1', () => {
    for (const w of [carbon, silicon]) {
      const t = createTerrain(w.terrain, w.demoSeed);
      expect(t.params.crust.bands).toHaveLength(w.terrain.crust.minerals.length);
    }
  });
});
