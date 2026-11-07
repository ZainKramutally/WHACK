import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { SPECIES } from './contracts';
import type { SpeciesId } from './contracts';
import { derive, hexToHsl, normalizeRecipe, normalizeSea, paletteField } from './derive';

const byId = (id: string) => PRESETS.find((p) => p.id === id)!;

const ACCEPT: Record<string, { hi: SpeciesId[]; lo: SpeciesId[] }> = {
  eco01: { hi: ['blackMonoliths', 'ashScrub'], lo: ['lanternCups', 'glowStalks', 'poreDwellers'] },
  eco04: { hi: ['lanternCups', 'frostFans'], lo: ['blackMonoliths', 'glowStalks'] },
  eco12: { hi: ['glowStalks', 'mossDomes', 'shadeRibbons'], lo: ['lanternCups', 'blackMonoliths'] },
  eco14: { hi: ['poreDwellers', 'glassWhiskers'], lo: ['blackMonoliths', 'glowStalks'] },
};

describe('niches acceptance (spec §7)', () => {
  for (const [id, { hi, lo }] of Object.entries(ACCEPT)) {
    it(id, () => {
      const d = derive(byId(id).dials, PRESETS);
      for (const s of hi) expect(d.niches[s], `${id} ${s}`).toBeGreaterThanOrEqual(0.8);
      for (const s of lo) expect(d.niches[s], `${id} ${s}`).toBeLessThanOrEqual(0.15);
    });
  }
});

describe('palette field', () => {
  for (const p of PRESETS) {
    it(`exact at anchor ${p.id}`, () => {
      expect(derive(p.dials, PRESETS).palette).toEqual(p.pinPalette);
    });
  }
  it('is smooth near an anchor and bounded away from it', () => {
    const p = byId('eco04');
    const a = paletteField(p.dials.sea, p.dials.heat, p.dials.light, PRESETS);
    const b = paletteField(p.dials.sea, p.dials.heat + 0.01, p.dials.light, PRESETS);
    const dr = Math.abs(((a.skyTop >> 16) & 255) - ((b.skyTop >> 16) & 255));
    expect(dr).toBeLessThan(10);
  });
});

describe('normalisation + clamping', () => {
  it('recipe sums to 1', () => {
    const r = normalizeRecipe({ c: 2, si: 1, o: 1 });
    expect(r.c + r.si + r.o).toBeCloseTo(1);
    expect(r.c).toBeCloseTo(0.5);
    expect(normalizeRecipe({ c: 0, si: 0, o: 0 }).c).toBeCloseTo(1 / 3);
  });
  it('sea sums to 1', () => {
    const s = normalizeSea({ water: 1, ammonia: 1, methane: 0, acid: 2 });
    expect(s.water + s.ammonia + s.methane + s.acid).toBeCloseTo(1);
  });
  it('outputs stay in 0..1 even for out-of-range dials', () => {
    for (const dials of [
      { ...byId('eco01').dials, heat: 3, light: -2, age: 9 },
      { ...byId('eco04').dials, heat: -1, light: 5, age: -3 },
    ]) {
      const d = derive(dials, PRESETS);
      for (const k of ['stainAmount', 'builders', 'erosion', 'pores', 'arches', 'snow', 'life', 'glow', 'capWidth', 'stalkHeight', 'char'] as const) {
        expect(d[k], k).toBeGreaterThanOrEqual(0);
        expect(d[k], k).toBeLessThanOrEqual(1);
      }
      for (const s of SPECIES) { expect(d.niches[s]).toBeGreaterThanOrEqual(0); expect(d.niches[s]).toBeLessThanOrEqual(1); }
      expect(d.fogDensity).toBeGreaterThan(0);
      for (const v of Object.values(d.palette)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(0xffffff); }
    }
  });
});

describe('glowHue (dominant family, not a beige average)', () => {
  const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  for (const p of PRESETS) {
    it(`${p.id} is saturated`, () => {
      expect(hexToHsl(derive(p.dials, PRESETS).glowHue)[1]).toBeGreaterThanOrEqual(0.6);
    });
  }
  it('eco04 is hot pink (pin #DA1B58)', () => {
    expect(hueDist(hexToHsl(derive(byId('eco04').dials, PRESETS).glowHue)[0], hexToHsl(0xda1b58)[0])).toBeLessThan(20);
  });
  it('eco12 is cyan (pin #27AAA6 / #5CB8B4)', () => {
    const h = hexToHsl(derive(byId('eco12').dials, PRESETS).glowHue)[0];
    expect(hueDist(h, hexToHsl(0x27aaa6)[0])).toBeLessThan(20);
    expect(hueDist(h, hexToHsl(0x5cb8b4)[0])).toBeLessThan(20);
  });
});
