import { describe, expect, it } from 'vitest';
import {
  PALETTE_SIZE, SEA_RAMPS, STAINS, buildPalette, depthBand, dominantSea, hexToLin, integerScale, nearestIndex, paletteBias, shadeBand, skyBand, skyBands, PALE_NEUTRAL, DIM_WATER, useDimWater, fieldRamp,
} from './palette';

const sea = (o: Partial<Record<'water' | 'ammonia' | 'methane' | 'acid', number>>) => ({ water: 0, ammonia: 0, methane: 0, acid: 0, ...o });

describe('palette', () => {
  it('has exactly 32 unique-or-padded colours and uses the dominant sea', () => {
    for (const k of ['water', 'ammonia', 'methane', 'acid'] as const) {
      const p = buildPalette(sea({ [k]: 1 }));
      expect(p).toHaveLength(PALETTE_SIZE);
      for (const c of SEA_RAMPS[k]) expect(p).toContain(c);
      for (const c of STAINS[k]) expect(p).toContain(c);
    }
    expect(dominantSea(sea({ water: 0.3, acid: 0.7 }))).toBe('acid');
    expect(buildPalette(sea({ water: 0.4, methane: 0.6 }))).toContain(SEA_RAMPS.methane[3]);
    expect(buildPalette(sea({ water: 0.4, methane: 0.6 }))).not.toContain(SEA_RAMPS.water[3]);
  });

  it('maps a palette colour to itself and a near colour to its neighbour', () => {
    const p = buildPalette(sea({ water: 1 }));
    // biased colours (bone, families) may yield to a near unbiased one by design
    p.filter((hex) => paletteBias(hex) === 0).forEach((hex) => expect(p[nearestIndex(hexToLin(hex), p)]).toBe(hex));
    const [r, g, b] = hexToLin(SEA_RAMPS.water[2]);
    expect(p[nearestIndex([r * 1.03, g * 0.97, b], p)]).toBe(SEA_RAMPS.water[2]);
  });

  it('prefers a saturated ramp over fresh bone for a pale cool tint', () => {
    const p = buildPalette(sea({ methane: 1 }));
    const [r, g, b] = hexToLin(0xb8c4e0); // pale periwinkle
    expect([...SEA_RAMPS.methane, ...STAINS.methane]).toContain(p[nearestIndex([r, g, b], p)]);
  });

  it('snaps shading to 3 bands at N·L 0.15 / 0.55', () => {
    expect([-1, 0, 0.149].map(shadeBand)).toEqual([0, 0, 0]);
    expect([0.15, 0.3, 0.549].map(shadeBand)).toEqual([1, 1, 1]);
    expect([0.55, 1].map(shadeBand)).toEqual([2, 2]);
  });

  it('steps depth at 25 / 70 / 160 m', () => {
    expect([0, 24.9, 25, 69.9, 70, 159.9, 160, 900].map(depthBand)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('sky bands run top (0) → horizon (3) and come from field steps 1–5 + the pale neutral ramp', () => {
    expect([0.9, 0.2, 0.1, 0, -0.5].map(skyBand)).toEqual([0, 1, 2, 3, 3]);
    const w = sea({ water: 1 });
    const allowed = [...SEA_RAMPS.water.slice(1), ...PALE_NEUTRAL.water];
    for (const [top, haze] of [[0x04202b, 0xc4ffee], [0xaab4ac, 0xc9d1c4], [0x0a4c5e, 0x5ddccf]]) {
      const s = skyBands(top, haze, w);
      expect(s).toHaveLength(4);
      s.forEach((c) => expect(allowed).toContain(c));
    }
    // a flat pale sage sky stays neutral (not field cyan) at the horizon and still gets 2 stepped tones
    const flat = skyBands(0xb4bcb0, 0xb8c0b4, w);
    expect(PALE_NEUTRAL.water).toContain(flat[3]);
    expect(new Set(flat).size).toBeGreaterThanOrEqual(2);
  });

  it('palette keeps sky bands, field and ink within 32, and drops highlights first', () => {
    const w = sea({ acid: 1 });
    const bands = skyBands(0xc4cdb4, 0xe8ecd0, w);
    const p = buildPalette(w, 1, bands);
    expect(p).toHaveLength(PALETTE_SIZE);
    for (const c of [...bands, ...SEA_RAMPS.acid]) expect(p).toContain(c);
  });

  it('uses the green-shifted dim water ramp only for dark water worlds', () => {
    expect(useDimWater(sea({ water: 1 }), 0.08)).toBe(true);
    expect(useDimWater(sea({ water: 1 }), 0.85)).toBe(false);
    expect(useDimWater(sea({ acid: 1 }), 0.05)).toBe(false);
    expect(fieldRamp(sea({ water: 1 }), 0.08)).toBe(DIM_WATER);
  });

  it('integer upscale never goes below 1 and never exceeds the fit', () => {
    expect(integerScale(384, 216, 1920, 1080)).toBe(5);
    expect(integerScale(384, 216, 1536, 864)).toBe(4);
    expect(integerScale(384, 216, 1700, 1000)).toBe(4);
    expect(integerScale(384, 216, 100, 100)).toBe(1);
  });
});
