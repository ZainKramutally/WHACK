import { describe, expect, it } from 'vitest';
import * as S from './shapes';
import type { MeshData } from './meshdata';

const ok = (m: MeshData) => {
  expect(m.position.length % 3).toBe(0);
  expect(m.normal.length).toBe(m.position.length);
  expect(m.aux.length / 4).toBe(m.position.length / 3);
  expect(m.index.every((i) => i >= 0 && i < m.position.length / 3)).toBe(true);
  expect(m.position.every(Number.isFinite)).toBe(true);
  return m.index.length / 3;
};
const maxY = (m: MeshData) => Math.max(...m.position.filter((_, i) => i % 3 === 1));

describe('shapes', () => {
  it('build valid, bounded meshes', () => {
    expect(ok(S.lanternCup())).toBeLessThan(1500);
    expect(ok(S.frostFan())).toBeGreaterThan(30);
    expect(ok(S.glowStalk())).toBeLessThan(600);
    expect(ok(S.mossDome())).toBeLessThan(2500);
    expect(ok(S.shadeRibbon())).toBeLessThan(100);
    expect(ok(S.glassWhiskers())).toBeLessThan(200);
    expect(ok(S.blackMonolith())).toBeLessThan(1200);
    expect(ok(S.ashMat())).toBeLessThan(400);
    ok(S.lightPool());
  });
  it('unit-height species are ~1 tall', () => {
    for (const m of [S.lanternCup(), S.glowStalk(), S.shadeRibbon(), S.frostFan()]) {
      expect(maxY(m)).toBeGreaterThan(0.9); expect(maxY(m)).toBeLessThan(1.15);
    }
    expect(maxY(S.blackMonolith())).toBeGreaterThan(1.0); // horns poke above the hood
  });
});
