import { describe, expect, it } from 'vitest';
import { LOOK_PALETTES, lookPalette, type LookKey } from './palette';

const inputs = (si: number, light: number, starType = 'G-type', pressure = 1, temperature = 15) => ({
  world: { composition: { c: 1 - si, si, o: 0 }, starType } as never,
  light,
  stats: { pressure, temperature },
});
const lum = (hex: number) => 0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255);
const KEYS = Object.keys(LOOK_PALETTES.carbon) as LookKey[];

describe('lookPalette', () => {
  it('carbon under a G star at full light is the Red World palette exactly', () => {
    const p = lookPalette(inputs(0, 1));
    expect(p.kind).toBe('carbon');
    for (const k of KEYS) expect(p[k]).toBe(LOOK_PALETTES.carbon[k]);
    expect(p.skyHorizon).toBe(0xf3eef8);
    expect(p.haze).toBe(0xe4daef);
    expect(p.shadow).toBe(0x5a1040);
  });

  it('picks the palette from body chemistry and the two read apart (value order inverted)', () => {
    const c = LOOK_PALETTES.carbon, s = LOOK_PALETTES.silicon;
    expect(lookPalette(inputs(0.9, 1)).kind).toBe('silicon');
    // carbon: dark red ground under a near-white sky; silicon: pale ground under a darker violet sky
    expect(lum(c.red)).toBeLessThan(lum(c.skyZenith));
    expect(lum(s.red)).toBeGreaterThan(lum(s.skyZenith));
    expect(Math.abs(lum(c.red) - lum(s.red))).toBeGreaterThan(60);
  });

  it('dims with starlight but never to black, and glow is never dimmed', () => {
    const bright = lookPalette(inputs(0.9, 1));
    const dim = lookPalette(inputs(0.9, 0.015));
    expect(dim.brightness).toBeCloseTo(Math.pow(0.015, 0.22), 6);
    expect(lum(dim.red)).toBeLessThan(lum(bright.red));
    expect(lum(dim.skyHorizon)).toBeGreaterThan(60);           // legible, not crushed
    expect(dim.glow).toBe(LOOK_PALETTES.silicon.glow);
    expect(lookPalette(inputs(0.9, 1e-9)).dim).toBeGreaterThanOrEqual(0.12);
  });

  it('a cooler or warmer star tints the lit palette relative to a G star', () => {
    const k = lookPalette(inputs(0, 1, 'K-type'));
    expect(k.starTint & 255).toBeLessThan(255);              // K is warmer than G: blue drops
    expect(k.red).not.toBe(LOOK_PALETTES.carbon.red);
  });

  it('is deterministic', () => {
    expect(lookPalette(inputs(0.9, 0.02, 'G-type', 3.6, -183))).toEqual(lookPalette(inputs(0.9, 0.02, 'G-type', 3.6, -183)));
  });
});
