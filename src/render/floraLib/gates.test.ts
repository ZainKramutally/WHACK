import { beforeAll, describe, expect, it } from 'vitest';
import { makeStubVisualInputs } from '../visualInputs';
import type { VisualInputs } from '../../worlds/types';
import { ARCHETYPE_INDEX, ARCHETYPE_KEYS, ARCHETYPE_META, buildFloraLibrary, type FloraLibrary } from './index';
import { GATES, SHORE_BAND, activeGates, worldEnv } from './gates';
import { makePlantList, placePlants } from './place';

const PATCH = 400;
let lib: FloraLibrary;
beforeAll(() => { lib = buildFloraLibrary(7); });

/** A carbon shore: the ground climbs 6 cm per metre eastwards through the sea level at x = 0. */
function shore(stats: Record<string, number>, over: Partial<VisualInputs> = {}): VisualInputs {
  const stub = makeStubVisualInputs();
  const flora = new Float32Array(64 * 64 * 2);
  for (let c = 0; c < 4096; c++) { flora[c * 2] = c % 2 ? 1 : 0.6; flora[c * 2 + 1] = c % 2 ? 0.05 : 0.8; }
  return {
    ...stub, flora, seaLevel: 0, lifeOnLand: true, stats: { ...stub.stats, ...stats },
    terrain: { rise: 1, progress: {}, height: (x) => 0.06 * x, patchSize: PATCH }, ...over,
  };
}
const placed = (inp: VisualInputs) => placePlants(inp, PATCH, { x: 0, z: 0 }, makePlantList());
const keyOf = (l: ReturnType<typeof placed>, i: number) => ARCHETYPE_KEYS[l.arch[i]];

describe('gated archetypes', () => {
  it('every gate substitutes an archetype of its own role and chemistry, with a bounded, grounded build', () => {
    for (const g of GATES) {
      const i = ARCHETYPE_INDEX.get(g.by);
      expect(i, g.by).toBeDefined();
      expect(ARCHETYPE_META[i!].role, g.by).toBe(g.role);
      expect(ARCHETYPE_META[i!].chem, g.by).toBe(g.chem);
      const a = lib.archetypes[i!];
      expect(a.lod[0].triangles, g.by).toBeLessThanOrEqual(450);
      expect(a.lod[1].triangles, g.by).toBeLessThanOrEqual(a.lod[0].triangles);
      expect(a.foot, g.by).toBeGreaterThan(0);
      if (g.chem === 'silicon') expect(a.lod[0].geometry.index, g.by).toBeNull(); // flat facets
    }
  });

  it('A1 pitcher urns appear only at low nitrogen and bright light, on dry ground beside the water', () => {
    const low = placed(shore({ nitrogen: 0.2 }));
    let n = 0;
    for (let i = 0; i < low.n; i++) {
      if (keyOf(low, i) !== 'pitcherUrn#0') continue;
      n++;
      expect(low.y[i]).toBeGreaterThanOrEqual(SHORE_BAND[0]);
      expect(low.y[i]).toBeLessThanOrEqual(SHORE_BAND[1]);
    }
    expect(n).toBeGreaterThan(0);
    for (const inp of [shore({ nitrogen: 1 }), shore({ nitrogen: 0.2 }, { light: 0.2 })]) {
      const l = placed(inp);
      for (let i = 0; i < l.n; i++) expect(keyOf(l, i)).not.toBe('pitcherUrn#0');
    }
  });

  it('A4 cushion mounds replace bristle tufts on land below 0 °C only', () => {
    const cold = placed(shore({ temperature: -5 }));
    let cushions = 0;
    for (let i = 0; i < cold.n; i++) {
      const k = keyOf(cold, i);
      if (k === 'groundCover#4') { cushions++; expect(cold.y[i]).toBeGreaterThanOrEqual(0); }
      if (k === 'groundCover#2') expect(cold.y[i]).toBeLessThan(0);
    }
    expect(cushions).toBeGreaterThan(0);
    const warm = placed(shore({ temperature: 15 }));
    for (let i = 0; i < warm.n; i++) expect(keyOf(warm, i)).not.toBe('groundCover#4');
  });

  it('a gate only substitutes: plant counts and positions never change', () => {
    const base = placed(shore({ nitrogen: 1, temperature: 15 }));
    for (const stats of [{ nitrogen: 0.2 }, { temperature: -5 }, { nitrogen: 0.2, temperature: -5 }]) {
      const g = placed(shore({ nitrogen: 1, temperature: 15, ...stats }));
      expect(g.n).toBe(base.n);
      expect(Array.from(g.x.subarray(0, g.n))).toEqual(Array.from(base.x.subarray(0, base.n)));
    }
  });

  it('world-wide halves follow the stats', () => {
    const on = (stats: Record<string, number>) => Object.values(activeGates(worldEnv(shore(stats)))).flat().map((g) => g.id);
    expect(on({ nitrogen: 1, temperature: 15 })).toEqual([]);
    expect(on({ nitrogen: 0.2 })).toContain('pitcher');
    expect(on({ temperature: -1 })).toContain('cushion');
  });
});
