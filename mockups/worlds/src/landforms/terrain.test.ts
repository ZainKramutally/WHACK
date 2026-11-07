import { describe, expect, it } from 'vitest';
import { PRESETS } from '../presets';
import { makeTerrainHeight, terrainParams } from './terrain';

const build = (id: string) => {
  const p = PRESETS.find((x) => x.id === id)!;
  const c = p.composition, d = p.dials;
  const heat = d.heat;
  return { p, h: makeTerrainHeight(terrainParams(c.valley, c.valleyWidth, heat, d.sea.methane * (1 - heat) ** 2, Math.exp(-(((heat - 0.5) / 0.28) ** 2)), d.sea.acid, d.seed)) };
};

describe('terrainHeight', () => {
  it('is deterministic', () => {
    const a = build('eco04').h, b = build('eco04').h;
    for (const [x, z] of [[0, 0], [13.7, -42.1], [-200, 90]]) expect(a(x, z)).toBe(b(x, z));
  });

  it.each(PRESETS.map((p) => p.id))('%s: valley floor is walkable (slope < 0.35) along the path', (id) => {
    const { p, h } = build(id);
    const path = p.composition.valley;
    let maxSlope = 0;
    for (let z = 0; z > -60; z -= 0.5) {
      const x = path[0][0];
      maxSlope = Math.max(maxSlope, Math.abs(h(x, z) - h(x, z - 0.5)) / 0.5, Math.abs(h(x, z) - h(x + 0.5, z)) / 0.5);
    }
    expect(maxSlope).toBeLessThan(0.35);
  });

  it.each(PRESETS.map((p) => p.id))('%s: sides rise above the floor', (id) => {
    const { p, h } = build(id);
    const w = p.composition.valleyWidth;
    const floor = h(0, -20);
    expect(h(w * 1.4, -20)).toBeGreaterThan(floor + 3);
  });
});
