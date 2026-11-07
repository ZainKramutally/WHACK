import { beforeAll, describe, expect, it } from 'vitest';
import { Color } from 'three/webgpu';
import { makeStubVisualInputs } from '../visualInputs';
import { formForBin, type FloraBin } from '../floraForm';
import type { VisualInputs } from '../../worlds/types';
import {
  ARCHETYPE_KEYS, ARCHETYPE_META, ROLE_BAND, archetypesFor, buildFloraLibrary, paint, plantHeight,
  type FloraLibrary, type FloraPalette, type FloraRole,
} from './index';
import { makePlantList, placePlants } from './place';

const PAL: FloraPalette = { ink: 0x22060f, maroon: 0x5c0a1e, crimson: 0xa8122a, blush: 0xf2a2a0, bone: 0xf4e6dc, glow: 0x3ff5e0, glowDeep: 0x0f8f9a };
const lin = (hex: number) => { const c = new Color().setHex(hex); return [c.r, c.g, c.b]; };
const TISSUE = (['ink', 'maroon', 'crimson', 'blush', 'bone'] as const).map((k) => lin(PAL[k]));
const near = (a: number[], b: ArrayLike<number>, i: number) => Math.abs(a[0] - b[i]) + Math.abs(a[1] - b[i + 1]) + Math.abs(a[2] - b[i + 2]) < 1e-5;

let lib: FloraLibrary;
beforeAll(() => { lib = buildFloraLibrary(7); });

const bins = (silicon: boolean): FloraBin[] => {
  const out: FloraBin[] = [];
  for (const light of [0, 1, 2] as const) for (const mix of [0, 1, 2] as const) for (const water of [true, false])
    out.push({ silicon, water, light, heat: 2, mix });
  return out;
};

describe('floraLib archetypes', () => {
  it('is deterministic for a seed', () => {
    const again = buildFloraLibrary(7);
    for (const i of [0, 7, 20, lib.archetypes.length - 1]) {
      const a = lib.archetypes[i].lod[0].geometry.getAttribute('position').array;
      const b = again.archetypes[i].lod[0].geometry.getAttribute('position').array;
      expect(Array.from(b)).toEqual(Array.from(a));
    }
    expect(lib.archetypes.map((a) => a.key)).toEqual([...ARCHETYPE_KEYS]);
  });

  it('carries color, aGlow and aSway; sway is ~0 at the base', () => {
    for (const a of lib.archetypes) for (const L of a.lod) {
      const g = L.geometry;
      expect(g.getAttribute('color').itemSize).toBe(3);
      expect(g.getAttribute('aGlow').itemSize).toBe(1);
      const pos = g.getAttribute('position').array, sway = g.getAttribute('aSway').array;
      let bad = 0;
      for (let v = 0; v < sway.length; v++) {
        if (sway[v] < 0 || sway[v] > 1) bad++;
        else if (pos[v * 3 + 1] < 0.02 * a.height && sway[v] >= 0.16) bad++;
      }
      expect(bad, a.key).toBe(0);
    }
  });

  it('paints only palette colours, and glow 0 leaves no emissive and no glow colour', () => {
    for (const a of lib.archetypes) {
      const L = a.lod[1];
      paint(L, PAL, 0);
      const c = L.geometry.getAttribute('color').array, g = L.geometry.getAttribute('aGlow').array;
      let bad = 0;
      for (let v = 0; v < g.length; v++) if (g[v] !== 0 || !TISSUE.some((t) => near(t, c, v * 3))) bad++;
      expect(bad, a.key).toBe(0);
    }
  });

  it('glow comes only from form.glow: aGlow ≤ the form glow, and lights up the glow sites', () => {
    const lantern = lib.byKey.get('lanternPods#0')!.lod[1];
    paint(lantern, PAL, 0.6);
    const g = Array.from(lantern.geometry.getAttribute('aGlow').array as Float32Array);
    expect(Math.max(...g)).toBeGreaterThan(0.3);
    expect(Math.max(...g)).toBeLessThanOrEqual(0.6 + 1e-6);
    paint(lantern, PAL, 0);
    expect(Math.max(...(lantern.geometry.getAttribute('aGlow').array as Float32Array))).toBe(0);
  });
});

describe('FloraForm → archetype mapping', () => {
  it('silicon forms draw only silicon archetypes (straight, faceted, never curled)', () => {
    for (const b of bins(true)) {
      const form = formForBin(b);
      for (const role of ['ground', 'mid', 'giant'] as FloraRole[]) for (const bright of [true, false])
        for (const key of archetypesFor(form, role, bright)) {
          const a = lib.byKey.get(key)!;
          expect(a.chem, key).toBe('silicon');
          expect(a.lod[0].geometry.index, key).toBeNull(); // de-indexed: flat facet normals
        }
    }
  });

  it('carbon forms draw only carbon archetypes; bright gives wide caps, dim gives lanterns', () => {
    for (const b of bins(false)) {
      const form = formForBin(b);
      for (const role of ['ground', 'mid', 'giant'] as FloraRole[])
        for (const key of archetypesFor(form, role, b.light === 2)) expect(lib.byKey.get(key)!.chem).toBe('carbon');
    }
    expect(archetypesFor(formForBin({ silicon: false, water: true, light: 2, heat: 2, mix: 2 }), 'giant', true).some((k) => k.startsWith('parasolTitan'))).toBe(true);
    expect(archetypesFor(formForBin({ silicon: false, water: true, light: 0, heat: 2, mix: 2 }), 'giant', false).some((k) => k.startsWith('lantern'))).toBe(true);
    expect(archetypesFor(formForBin({ silicon: true, water: false, light: 0, heat: 2, mix: 2 }), 'giant', false)).toEqual(['prismTitan#1', 'prismTitan#2']);
  });

  it('every mapped key exists and its role matches', () => {
    for (const s of [true, false]) for (const b of bins(s)) for (const role of ['ground', 'mid', 'giant'] as FloraRole[])
      for (const key of archetypesFor(formForBin(b), role, b.light === 2)) {
        const i = ARCHETYPE_KEYS.indexOf(key);
        expect(i, key).toBeGreaterThanOrEqual(0);
        expect(ARCHETYPE_META[i].role).toBe(role);
      }
  });
});

describe('plant size', () => {
  it('full-grown plants sit in their role band; cold is taller; biomass grows them', () => {
    for (const role of ['ground', 'mid', 'giant'] as FloraRole[]) {
      const [lo, hi] = ROLE_BAND[role];
      for (const heat of [0, 1, 2, 3, 4]) for (const j of [0, 0.5, 1]) {
        const h = plantHeight(role, formForBin({ silicon: false, water: true, light: 2, heat, mix: 2 }), 1, j);
        expect(h).toBeGreaterThanOrEqual(lo);
        expect(h).toBeLessThanOrEqual(hi);
      }
      const cold = formForBin({ silicon: true, water: false, light: 0, heat: 0, mix: 2 });
      const hot = formForBin({ silicon: true, water: false, light: 0, heat: 4, mix: 2 });
      expect(plantHeight(role, cold, 1, 0.5)).toBeGreaterThan(plantHeight(role, hot, 1, 0.5));
      expect(plantHeight(role, cold, 0.1, 0.5)).toBeLessThan(plantHeight(role, cold, 1, 0.5));
    }
  });
});

describe('placePlants', () => {
  const PATCH = 400;
  function inputs(fill: (c: number) => [number, number], over: Partial<VisualInputs> = {}): VisualInputs {
    const flora = new Float32Array(64 * 64 * 2);
    for (let c = 0; c < 4096; c++) { const [m, k] = fill(c); flora[c * 2] = m; flora[c * 2 + 1] = k; }
    return { ...makeStubVisualInputs(), flora, seaLevel: -1, terrain: { rise: 1, progress: {}, height: () => 0 }, lifeOnLand: true, ...over };
  }
  const roles = (l: ReturnType<typeof makePlantList>) => {
    const n = { ground: 0, mid: 0, giant: 0 };
    for (let i = 0; i < l.n; i++) n[ARCHETYPE_META[l.arch[i]].role]++;
    return n;
  };

  it('draws nothing without biomass', () => {
    expect(placePlants(inputs(() => [0, 0]), PATCH, { x: 0, z: 0 }, makePlantList()).n).toBe(0);
  });

  it('is deterministic, and every plant stands in a cell with biomass', () => {
    const inp = inputs((c) => (c % 3 === 0 ? [0.8, 0.5] : [0, 0]));
    const a = placePlants(inp, PATCH, { x: 10, z: -20 }, makePlantList());
    const b = placePlants(inp, PATCH, { x: 10, z: -20 }, makePlantList());
    expect(b.n).toBe(a.n);
    expect(Array.from(b.x.subarray(0, b.n))).toEqual(Array.from(a.x.subarray(0, a.n)));
    for (let i = 0; i < a.n; i++) {
      const col = Math.floor((a.x[i] / PATCH + 0.5) * 64), row = Math.floor((a.z[i] / PATCH + 0.5) * 64);
      expect((row * 64 + col) % 3).toBe(0);
    }
  });

  it('mat makes ground cover only; canopy adds mid groves and sparse giants', () => {
    const mat = roles(placePlants(inputs(() => [1, 0]), PATCH, { x: 0, z: 0 }, makePlantList()));
    expect(mat.mid + mat.giant).toBe(0);
    expect(mat.ground).toBeGreaterThan(1000);
    const can = roles(placePlants(inputs(() => [0.3, 0.9]), PATCH, { x: 0, z: 0 }, makePlantList()));
    expect(can.mid).toBeGreaterThan(100);
    expect(can.giant).toBeGreaterThan(50);
    expect(can.giant).toBeLessThanOrEqual(13 * 13); // at most one per 5×5-cell superblock
  });

  it('keeps land plants off until lifeOnLand, and only ground cover under the sea', () => {
    const dry = roles(placePlants(inputs(() => [1, 0.9], { lifeOnLand: false }), PATCH, { x: 0, z: 0 }, makePlantList()));
    expect(dry).toEqual({ ground: 0, mid: 0, giant: 0 });
    const wet = roles(placePlants(inputs(() => [1, 0.9], { seaLevel: 5, lifeOnLand: false }), PATCH, { x: 0, z: 0 }, makePlantList()));
    expect(wet.mid + wet.giant).toBe(0);
    expect(wet.ground).toBeGreaterThan(0);
  });

  it('the foreground near the camera is denser and darker', () => {
    const l = placePlants(inputs(() => [1, 0]), PATCH, { x: 0, z: 0 }, makePlantList());
    let nearN = 0, nearDark = 0, ringN = 0;
    for (let i = 0; i < l.n; i++) {
      const d = Math.hypot(l.x[i], l.z[i]);
      if (d < 15) { nearN++; nearDark += l.dark[i]; } else if (d > 40 && d < 42.72) ringN++; // same area as the 15 m disc
    }
    expect(nearN).toBeGreaterThan(ringN * 1.8);
    expect(nearDark).toBeGreaterThan(0);
  });
});
