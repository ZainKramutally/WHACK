import { describe, expect, it } from 'vitest';
import { Color } from 'three/webgpu';
import { makeStubVisualInputs } from '../visualInputs';
import { LOOK_PALETTES } from '../palette';
import type { VisualInputs } from '../../worlds/types';
import { ARCHETYPE_META } from './index';
import { TINTS, TRAITS, heightRank, heightSample, makeEnv, mineralAt, plantEnv, traitTint, traited, worldEnv, type CellEnv } from './traits';
import { varyPlant } from './vary';
import { lookW } from './instance';

/** A carbon or silicon world's environment with some stats overridden, and a plant in a cell. */
function env(over: Partial<CellEnv> = {}, cell: { mat?: number; canopy?: number; y?: number; rank?: number; role?: 'ground' | 'mid' | 'giant' } = {}): CellEnv {
  const e = Object.assign(worldEnv(makeStubVisualInputs(), makeEnv()), { co2: 0.25 }, over);
  return plantEnv(e, cell.mat ?? 0.6, cell.canopy ?? 0.6, cell.y ?? 2, 0, cell.rank ?? 0.3, cell.role ?? 'mid');
}
const hueOf = (r: number, g: number, b: number) => {
  const c = new Color(r, g, b), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return { h: hsl.h * 360, s: hsl.s, l: hsl.l };
};

describe('plant traits (traits.ts, flora-traits.md §1)', () => {
  it('T5: caps peak warm and wet, shrink in the cold and when hot, dry and bright; T4: basalt beats granite', () => {
    const cap = (o: Partial<CellEnv>, y = 2, rank = 0.3) => traited('crown', 'carbon', env(o, { y, rank }), 1);
    const warmWet = cap({ heatBand: 0.65 }, -1); // under the sea: wet
    expect(warmWet).toBeGreaterThan(cap({ heatBand: 0.65 }, 10)); // the same warmth on dry ground
    expect(warmWet).toBeGreaterThan(cap({ heatBand: 0.1 }, -1));
    expect(cap({ heatBand: 0.1 }, 10)).toBeLessThan(cap({ heatBand: 0.5 }, 10));
    expect(cap({ heatBand: 0.97, light: 2 }, 10)).toBeLessThan(cap({ heatBand: 0.6, light: 2 }, 10));
    expect(cap({}, 10, 0.3)).toBeGreaterThan(cap({}, 10, 0.9)); // basalt lowland vs granite highland
  });

  it('T11: girth rises with gravity and with height (cold); T10: dim light stretches plants; silicon keeps its girth', () => {
    expect(traited('girth', 'carbon', env({ gravity: 1.3 }), 1)).toBeGreaterThan(traited('girth', 'carbon', env({ gravity: 0.8 }), 1));
    expect(traited('girth', 'carbon', env({ heatBand: 0 }), 1)).toBeGreaterThan(traited('girth', 'carbon', env({ heatBand: 1 }), 1));
    expect(traited('girth', 'silicon', env({ gravity: 0.5, carbon: false }), 1)).toBe(1);
    expect(traited('size', 'carbon', env({ light: 0.1 }), 1)).toBeGreaterThan(traited('size', 'carbon', env({ light: 1 }), 1));
  });

  it('T7: thick leaves (bright light, poor ground, high CO₂) droop and bend less', () => {
    const droop = (o: Partial<CellEnv>, rank = 0.3) => traited('droop', 'carbon', env(o, { rank }), 1);
    expect(droop({ light: 3 })).toBeLessThan(droop({ light: 0.3 }));
    expect(droop({ co2: 0.6 })).toBeLessThan(droop({ co2: 0.04 }));
    expect(droop({}, 0.9)).toBeLessThan(droop({}, 0.3)); // granite
    expect(traited('bend', 'carbon', env({ light: 3 }), 1)).toBeLessThan(traited('bend', 'carbon', env({ light: 0.3 }), 1));
  });

  it('tints: never cyan, carbon stays red-family and silicon violet, value still inverts with height, deterministic', () => {
    const tissues = (chem: 'carbon' | 'silicon') => (['maroon', 'crimson', 'blush', 'bone'] as const).map((k) => new Color().setHex(LOOK_PALETTES[chem][k]));
    let checked = 0;
    for (const chem of ['carbon', 'silicon'] as const) for (const heatBand of [0, 0.5, 1]) for (const light of chem === 'carbon' ? [0.2, 1, 3] : [0.016, 0.3])
      for (const nitrogen of [0.2, 1]) for (const y of [-1, 1, 10]) for (const rank of [0.1, 0.5, 0.9]) for (const B of [0.1, 1.2]) {
        const e = env({ heatBand, light, nitrogen, carbon: chem === 'carbon' }, { y, rank, mat: B / 2, canopy: B / 2, role: 'ground' });
        const t = traitTint(chem, e);
        const again = traitTint(chem, e);
        expect(again).toEqual(t);
        for (const ch of t) { expect(ch).toBeGreaterThan(0.59); expect(ch).toBeLessThan(1.2); }
        const [maroon, , , bone] = tissues(chem);
        const lum = (c: Color) => 0.2126 * c.r * t[0] + 0.7152 * c.g * t[1] + 0.0722 * c.b * t[2];
        expect(lum(maroon)).toBeLessThan(lum(bone)); // bases stay darker than tops
        for (const c of tissues(chem)) {
          const { h, s } = hueOf(c.r * t[0], c.g * t[1], c.b * t[2]);
          if (s < 0.12) continue; // near-grey: no hue to speak of
          expect(h >= 165 && h <= 200, `${chem} tint hue ${h.toFixed(0)}`).toBe(false);
          checked++;
        }
      }
    expect(checked).toBeGreaterThan(500);
  });

  it('T6: toothed margins in the cold, smooth in the warm (leaf-margin analysis), carbon only; packed with glow in aLook.w', () => {
    const arch = ARCHETYPE_META.findIndex((m) => m.chem === 'carbon' && m.role === 'mid');
    const si = ARCHETYPE_META.findIndex((m) => m.chem === 'silicon' && m.role === 'mid');
    const toothed = (temperature: number, a = arch) => {
      let n = 0;
      for (let c = 0; c < 2000; c++) n += varyPlant(a, c, c % 3, false, env({ temperature, carbon: a === arch })).teeth;
      return n / 2000;
    };
    expect(toothed(0)).toBe(1);
    expect(toothed(35)).toBe(0);
    expect(toothed(15)).toBeGreaterThan(0.48); // Wolfe: ~45% smooth at 15 °C, so ~55% toothed
    expect(toothed(15)).toBeLessThan(0.62);
    expect(toothed(5)).toBeGreaterThan(toothed(25));
    expect(toothed(-20, si)).toBe(0);
    // the material decodes teeth = step(1.5, w) and glow = w − 2 · teeth, with margin for interpolation error
    for (const g of [0, 0.3, 1]) for (const t of [0, 1]) for (const eps of [-1e-4, 0, 1e-4]) {
      const w = lookW(g, t) + eps, tt = w >= 1.5 ? 1 : 0;
      expect(tt).toBe(t);
      expect(Math.min(1, Math.max(0, w - 2 * tt))).toBeCloseTo(g, 3);
    }
  });

  it('every final plant tint is ≤ 1, and a stat change changes the look', () => {
    const arch = ARCHETYPE_META.findIndex((m) => m.chem === 'carbon' && m.role === 'mid');
    const base = varyPlant(arch, 700, 1, false, env());
    for (const o of [{ light: 3 }, { heatBand: 0.05 }, { nitrogen: 0.2 }, { co2: 0.6 }, { gravity: 1.3 }] as Partial<CellEnv>[]) {
      const v = varyPlant(arch, 700, 1, false, env(o));
      for (const ch of [v.r, v.g, v.b]) expect(ch).toBeLessThanOrEqual(1);
      expect([v.r, v.g, v.b, v.crown, v.girth, v.droop, v.size], JSON.stringify(o)).not.toEqual([base.r, base.g, base.b, base.crown, base.girth, base.droop, base.size]);
    }
  });

  it('the environment: wetness from the sea, mineral from height rank (crust proxy), and every row is sourced and unique', () => {
    expect(env({}, { y: -1 }).wet).toBe(1);
    expect(env({}, { y: 10 }).wet).toBe(0);
    expect(env({ frozen: true }, { y: -1 }).wet).toBe(0);
    expect([mineralAt(true, 0.2), mineralAt(true, 0.8), mineralAt(false, 0.2), mineralAt(false, 0.6), mineralAt(false, 0.9)]).toEqual(['basalt', 'granite', 'silicide', 'nitride', 'ice']);
    const sorted = heightSample((x) => x, 400);
    expect(heightRank(sorted, -1000)).toBe(0);
    expect(heightRank(sorted, 1000)).toBe(1);
    expect(heightRank(sorted, 0)).toBeCloseTo(0.5, 1);
    const ids = [...TRAITS.map((t) => t.id), ...TINTS.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of [...TRAITS, ...TINTS]) expect(t.why.length, t.id).toBeGreaterThan(10);
    const inp: VisualInputs = { ...makeStubVisualInputs(), stats: { temperature: 15, oxygen: 21, co2: 0.04 } };
    expect(worldEnv(inp, makeEnv()).photoresp).toBeCloseTo(1, 5); // Earth's O₂/CO₂ today
  });
});
