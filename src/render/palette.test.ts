import { describe, expect, it } from 'vitest';
import { LOOK_PALETTES, hexToLab, lookPalette, rayleighZenith, skyStyle, type LookKey } from './palette';

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
    // carbon: dark red ground under a blue sky; silicon: pale cool-grey ground under a deeper blue sky
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

/** OKLab hue in degrees and chroma. */
const hueOf = (hex: number) => { const [, a, b] = hexToLab(hex); return { h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360, C: Math.hypot(a, b) }; };
const PURPLE = (h: number) => h >= 280 && h <= 330;

describe('Rayleigh sky (blue, never violet)', () => {
  it('silicon zenith is blue-hued, not violet, and deeper than carbon\'s', () => {
    const s = hueOf(skyStyle('G-type', 1, 3.6, -183).zenith), c = hueOf(skyStyle('G-type', 1, 1, 15).zenith);
    expect(s.h).toBeGreaterThan(220); expect(s.h).toBeLessThan(270);
    expect(PURPLE(s.h)).toBe(false);
    expect(s.C).toBeGreaterThan(c.C);   // more air saturates the blue
    expect(hexToLab(rayleighZenith(3.6))[0]).toBeLessThan(hexToLab(rayleighZenith(1))[0]);
    const si = lookPalette(inputs(0.9, 0.01, 'G-type', 3.6, -183));
    expect(hueOf(si.skyZenith).h).toBeGreaterThan(220); expect(hueOf(si.skyZenith).h).toBeLessThan(270);
  });
  it('carbon zenith is a clear blue, not near-white; thicker air whitens the horizon', () => {
    const z = skyStyle('G-type', 1, 1, 15).zenith, { h, C } = hueOf(z);
    expect(h).toBeGreaterThan(220); expect(h).toBeLessThan(270);
    expect(C).toBeGreaterThan(0.08);
    expect(lookPalette(inputs(0, 1)).skyZenith).toBe(LOOK_PALETTES.carbon.skyZenith);
    const thin = hexToLab(skyStyle('G-type', 1, 0.5, 15).horizon), thick = hexToLab(skyStyle('G-type', 1, 4, 15).horizon);
    expect(Math.hypot(thick[1], thick[2])).toBeLessThanOrEqual(Math.hypot(thin[1], thin[2]) + 0.02);
  });
  it('more gravity at the same pressure means a thinner column and a paler zenith', () => {
    expect(hexToLab(skyStyle('G-type', 1, 1, 15, undefined, 2).zenith)[0]).toBeGreaterThan(hexToLab(skyStyle('G-type', 1, 1, 15, undefined, 0.5).zenith)[0]);
  });
});

describe('silicon look has no purple', () => {
  it('LOOK roles are neutral or cold, never in the violet band', () => {
    const s = LOOK_PALETTES.silicon;
    for (const k of KEYS) {
      const { h, C } = hueOf(s[k]);
      if (C > 0.03) expect(PURPLE(h), `${k} hue ${h.toFixed(0)}`).toBe(false);
    }
  });
  it('the creature ring and accents avoid the purple band', async () => {
    const { creatureColour } = await import('./palette');
    for (let i = 0; i <= 20; i++) for (const diet of [0.05, 0.5, 0.95]) for (const tone of [0, 2, 3, 5] as const) {
      const { h, C } = hueOf(creatureColour(true, diet, tone, i / 20, i / 20));
      if (C > 0.03) expect(PURPLE(h), `tone ${tone} hue ${h.toFixed(0)}`).toBe(false);
    }
  });
});

describe('creatureColour (silicon, #50)', () => {
  it('silicon bodies are dark against the pale ground, hunters darker, rims pale, eyes glow', async () => {
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
      // both rings cross the glow's cyan through a muted pewter on purpose (fauna-colour §2.1), so the floor is the pewter's
      for (const h of hues) expect(ok(creatureColour(si, 0.1, 0, h)).C).toBeGreaterThan(0.03);
    }
  });

  it('carbon bodies hold value against the red ground and the pale horizon, and are never ground red or glow cyan', async () => {
    const { creatureColour } = await import('./palette');
    const c = LOOK_PALETTES.carbon, ground = ok(c.red), sky = ok(c.skyHorizon), glow = ok(c.glow);
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

  it('silicon bodies sit dark against the pale cool-grey ground; eyes are ink on carbon and the cyan glow on silicon', async () => {
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

  it('ring spacing: the 9 hue candidates stay apart on both rings (fauna-colour §6 test 3; silicon was ΔE 0.008)', async () => {
    const { creatureColour } = await import('./palette');
    for (const si of [false, true]) for (const diet of [0.05, 0.5, 0.95]) {
      const labs = hues.map((h) => hexToLab(creatureColour(si, diet, 0, h)));
      let min = Infinity;
      for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) {
        min = Math.min(min, Math.hypot(labs[i][0] - labs[j][0], labs[i][1] - labs[j][1], labs[i][2] - labs[j][2]));
      }
      expect(min, `${si ? 'silicon' : 'carbon'} diet ${diet}`).toBeGreaterThanOrEqual(0.03);
    }
  });

  it('the glow band stays reserved: no saturated silicon skin within 15 degrees of the glow hue (§6 test 2)', async () => {
    const { creatureColour } = await import('./palette');
    const glow = ok(LOOK_PALETTES.silicon.glow).h;
    for (let i = 0; i <= 64; i++) for (const diet of [0.05, 0.5, 0.95]) {
      const c = ok(creatureColour(true, diet, 0, i / 64));
      expect(c.C < 0.06 || arc(c.h, glow) > 15, `hue ${i / 64} diet ${diet}: C ${c.C.toFixed(3)} at ${c.h.toFixed(0)}°`).toBe(true);
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
