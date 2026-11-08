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

describe('creatureColour (silicon, #50)', () => {
  it('silicon bodies are deep violet against the pale ground, hunters darker, rims pale, eyes glow', async () => {
    const { creatureColour } = await import('./palette');
    const s = LOOK_PALETTES.silicon;
    const grazer = creatureColour(true, 0, 0), hunter = creatureColour(true, 1, 0);
    expect(lum(s.red) - lum(grazer)).toBeGreaterThan(80);
    expect(lum(hunter)).toBeLessThan(lum(grazer));
    expect(lum(creatureColour(true, 0.5, 5, 0.5, 1))).toBeGreaterThan(lum(creatureColour(true, 0.5, 0)) + 60);
    expect(creatureColour(true, 0.5, 1)).toBe(s.glow);
    expect(creatureColour(true, 0.3, 0, 0.2)).not.toBe(creatureColour(true, 0.3, 0, 0.8)); // lineage hue still layers
  });
});

describe('creatureColour (#57: colour is a strong species axis)', () => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  /** OKLab L and hue (degrees) of a hex. */
  const ok = (hex: number) => {
    const r = lin(((hex >> 16) & 255) / 255), g = lin(((hex >> 8) & 255) / 255), b = lin((hex & 255) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
  };
  const hues = Array.from({ length: 9 }, (_, i) => i / 8);
  const arc = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

  it('spreads species over a wide, saturated hue range', async () => {
    const { creatureColour } = await import('./palette');
    for (const si of [false, true]) {
      const hs = hues.map((h) => ok(creatureColour(si, 0.1, 0, h)).h);
      let span = 0;
      for (const a of hs) for (const b of hs) span = Math.max(span, arc(a, b));
      expect(span).toBeGreaterThan(si ? 70 : 150);
      for (const h of hues) expect(ok(creatureColour(si, 0.1, 0, h)).C).toBeGreaterThan(si ? 0.08 : 0.03); // carbon's slate–sage pewter is muted on purpose
    }
  });

  it('carbon bodies hold value against the red ground and the white sky, and are never ground red or glow cyan', async () => {
    const { creatureColour } = await import('./palette');
    const c = LOOK_PALETTES.carbon, ground = ok(c.red), sky = ok(c.skyZenith), glow = ok(c.glow);
    for (const h of hues) {
      const grazer = ok(creatureColour(false, 0.05, 0, h)), hunter = ok(creatureColour(false, 0.95, 0, h));
      expect(grazer.L).toBeGreaterThan(ground.L + 0.06);
      expect(grazer.L).toBeLessThan(sky.L - 0.1);
      expect(hunter.L).toBeLessThan(ground.L - 0.03);
      for (const body of [grazer, hunter, ok(creatureColour(false, 0.5, 0, h))]) {
        expect(body.C < 0.06 || arc(body.h, ground.h) > 18).toBe(true);
        expect(body.C < 0.06 || arc(body.h, glow.h) > 15).toBe(true);
      }
    }
  });

  it('silicon bodies sit dark against the pale-lilac ground; eyes are ink on carbon and the cyan glow on silicon', async () => {
    const { creatureColour } = await import('./palette');
    const s = LOOK_PALETTES.silicon;
    for (const h of hues) for (const diet of [0.05, 0.5, 0.95]) expect(ok(creatureColour(true, diet, 0, h)).L).toBeLessThan(ok(s.red).L - 0.25);
    expect(creatureColour(true, 0.3, 1, 0.2)).toBe(s.glow);
    expect(creatureColour(false, 0.3, 1, 0.2)).toBe(LOOK_PALETTES.carbon.ink);
  });

  it('the one accent always reads against its body (value contrast in every family, role and chemistry)', async () => {
    const { creatureColour } = await import('./palette');
    for (const si of [false, true]) for (const diet of [0.05, 0.5, 0.95]) for (const h of hues) for (const a of [0.15, 0.5, 0.85]) {
      const body = ok(creatureColour(si, diet, 0, h, a)), acc = ok(creatureColour(si, diet, 5, h, a));
      expect(Math.abs(acc.L - body.L)).toBeGreaterThan(0.12);
      expect(creatureColour(si, diet, 6, h, a)).toBe(creatureColour(si, diet, 5, h, a)); // spots wear the accent
    }
  });

  it('degrades to a valid colour on NaN inputs (a bad gene never throws)', async () => {
    const { creatureColour } = await import('./palette');
    for (const si of [false, true]) for (const tone of [0, 1, 2, 3, 4, 5, 6] as const) {
      const c = creatureColour(si, NaN, tone, NaN, NaN);
      expect(Number.isInteger(c) && c >= 0 && c <= 0xffffff).toBe(true);
    }
  });

  it('is a pure function of its inputs', async () => {
    const { creatureColour } = await import('./palette');
    expect(creatureColour(false, 0.4, 0, 0.3, 0.7)).toBe(creatureColour(false, 0.4, 0, 0.3, 0.7));
    expect(creatureColour(false, 0.4, 0, 0.3)).not.toBe(creatureColour(false, 0.4, 0, 0.8));
  });
});
