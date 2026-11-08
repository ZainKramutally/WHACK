import { describe, expect, it } from 'vitest';
import { hexToLab, seaStyle, waterAtDepth, waterBody } from './palette';
import { MINERAL_LOOK, blendFamilies, crustWaterNudge } from './crustLook';
import { carbon } from '../worlds/carbon';

const hue = (hex: number) => { const [, a, b] = hexToLab(hex); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
const blue = (h: number) => h >= 195 && h <= 270;
const ids = ['basalt', 'ironstone', 'granite'];
const mk = (shares: number[], oxygen: number) => ({
  world: { ...carbon, composition: carbon.life.composition, crust: { ids, oxidises: [true, true, false], elevation: [0, 0.4, 0.8], shares } },
  stats: { oxygen }, buildProgress: 1,
}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const mixes = [[0.34, 0.33, 0.33], [0.9, 0.05, 0.05], [0.05, 0.9, 0.05], [0.05, 0.05, 0.9]];

describe('liquid water colour', () => {
  it('open sea is blue under every crust mix, rusted or not', () => {
    for (const sh of mixes) for (const ox of [0, 40]) {
      const n = crustWaterNudge(mk(sh, ox));
      for (const d of [14, 60]) expect(blue(hue(waterAtDepth(d, undefined, n)))).toBe(true);
      expect(blue(hue(waterBody(n)))).toBe(true);
    }
    expect(blue(hue(waterBody()))).toBe(true);
  });
  it('shallows move towards the seabed tint as depth falls', () => {
    const bed = MINERAL_LOOK.ironstone[1]!.sea;
    const dist = (a: number, b: number) => { const x = hexToLab(a), y = hexToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    const ds = [4, 3, 2, 1, 0].map((d) => dist(waterAtDepth(d, bed), bed));
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeLessThan(ds[i - 1]);
  });
  it('underwater tint is blue for liquid water; ice and nitrogen unchanged', () => {
    expect(blue(hue(seaStyle('Water', false, false, 0x7a4a3a, crustWaterNudge(mk(mixes[2], 40))).underwater))).toBe(true);
    expect(seaStyle('Water', true, false)).toMatchObject({ colour: 0xdcf0f8, underwater: 0xdcf0f8 });
    expect(seaStyle('Liquid nitrogen', false, true)).toMatchObject({ colour: 0xd8eaf4, opacity: 0.16, underwater: 0x6a8aa8 });
  });
  it('blendFamilies still exposes seabed weights', () => {
    expect(blendFamilies(mk(mixes[0], 0).world.crust, mixes[0], 0).seaWeights.length).toBe(3);
  });
});
