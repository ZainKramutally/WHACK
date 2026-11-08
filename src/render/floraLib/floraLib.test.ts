import { beforeAll, describe, expect, it } from 'vitest';
import { Color } from 'three/webgpu';
import { makeStubVisualInputs } from '../visualInputs';
import { formForBin, type FloraBin } from '../floraForm';
import type { VisualInputs } from '../../worlds/types';
import {
  ALONG_DITHER, ARCHETYPE_KEYS, ARCHETYPE_META, ROLE_BAND, archetypesFor, buildFloraLibrary, paint, pickAlong, plantHeight,
  type FloraLibrary, type FloraPalette, type FloraRole,
} from './index';
import { LOD_NEAR, makePlantList, placePlants } from './place';
import { countDraws } from './buckets';

const PAL: FloraPalette = { ink: 0x22060f, maroon: 0x5c0a1e, crimson: 0xa8122a, blush: 0xf2a2a0, bone: 0xf4e6dc, glow: 0x3ff5e0, glowDeep: 0x0f8f9a };
const lin = (hex: number) => { const c = new Color().setHex(hex); return [c.r, c.g, c.b]; };
const TISSUE = (['ink', 'maroon', 'crimson', 'blush', 'bone'] as const).map((k) => lin(PAL[k]));
const near = (a: number[], b: ArrayLike<number>, i: number) => Math.abs(a[0] - b[i]) + Math.abs(a[1] - b[i + 1]) + Math.abs(a[2] - b[i + 2]) < 1e-5;

let lib: FloraLibrary;
beforeAll(() => { lib = buildFloraLibrary(7); });

const bins = (silicon: boolean): FloraBin[] => {
  const out: FloraBin[] = [];
  for (const light of [0, 1, 2] as const) for (const mix of [0, 1, 2] as const) for (const water of [true, false])
    out.push({ silicon, water, sub: false, lush: 1, light, heat: 2, mix });
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

  it('carries color, aGlow, aSway and aPart (rim, cap in 0..1); sway is ~0 at the base', () => {
    for (const a of lib.archetypes) for (const L of a.lod) {
      const g = L.geometry;
      expect(g.getAttribute('color').itemSize).toBe(3);
      expect(g.getAttribute('aGlow').itemSize).toBe(1);
      const part = g.getAttribute('aPart');
      expect(part?.itemSize, a.key).toBe(2);
      expect(part.count, a.key).toBe(g.getAttribute('position').count);
      expect(Array.from(part.array as Float32Array).every((v) => v >= 0 && v <= 1), a.key).toBe(true);
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
    expect(archetypesFor(formForBin({ silicon: false, water: true, sub: false, lush: 1, light: 2, heat: 2, mix: 2 }), 'giant', true).some((k) => k.startsWith('parasolTitan'))).toBe(true);
    expect(archetypesFor(formForBin({ silicon: false, water: true, sub: false, lush: 1, light: 0, heat: 2, mix: 2 }), 'giant', false).some((k) => k.startsWith('lantern'))).toBe(true);
    expect(archetypesFor(formForBin({ silicon: true, water: false, sub: false, lush: 1, light: 0, heat: 2, mix: 2 }), 'giant', false)).toEqual(['prismTitan#1', 'prismTitan#2']);
  });

  it('a submerged form picks its low ":sub" row when there is one, else the plain row', () => {
    const crust = { ...formForBin({ silicon: true, water: false, sub: false, lush: 1, light: 0, heat: 2, mix: 0 }), submerged: true } as ReturnType<typeof formForBin>;
    expect(archetypesFor(crust, 'ground', false).every((k) => k === 'crystalGround#1' || k === 'crystalGround#3')).toBe(true);
    const spire = { ...formForBin({ silicon: true, water: false, sub: false, lush: 1, light: 0, heat: 2, mix: 2 }), submerged: true } as ReturnType<typeof formForBin>;
    expect(archetypesFor(spire, 'giant', false)).toEqual(['prismTitan#1', 'prismTitan#2']);
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
        const h = plantHeight(role, formForBin({ silicon: false, water: true, sub: false, lush: 1, light: 2, heat, mix: 2 }), 1, j);
        expect(h).toBeGreaterThanOrEqual(lo);
        expect(h).toBeLessThanOrEqual(hi);
      }
      const cold = formForBin({ silicon: true, water: false, sub: false, lush: 1, light: 0, heat: 0, mix: 2 });
      const hot = formForBin({ silicon: true, water: false, sub: false, lush: 1, light: 0, heat: 4, mix: 2 });
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
  /** Silicon world over the stub (dim light, liquid nitrogen). */
  const siliconOver = (): Partial<VisualInputs> => {
    const stub = makeStubVisualInputs();
    return {
      world: { ...stub.world, id: 'silicon', composition: { c: 0.1, si: 0.9, o: 0 }, solvent: { ...stub.world.solvent, name: 'Liquid nitrogen' } },
      light: 0.016,
    };
  };
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

  it('holds its budget when canopy covers the whole patch (worst case)', () => {
    const l = placePlants(inputs(() => [0.6, 1]), PATCH, { x: 0, z: 0 }, makePlantList());
    const n = roles(l);
    let tris = 0;
    const by: Record<string, number> = {};
    for (let i = 0; i < l.n; i++) {
      const a = lib.archetypes[l.arch[i]], t = a.lod[l.lod[i]].triangles;
      tris += t; by[a.role] = (by[a.role] ?? 0) + t;
    }
    console.log('worst case', JSON.stringify(n), 'tris', tris, JSON.stringify(by));
    expect(n.giant).toBeLessThanOrEqual(13 * 13);
    expect(n.mid).toBeLessThan(1600);
    expect(tris).toBeLessThan(4.5e6); // before frustum culling (~half is behind the camera)
  });

  it('draw calls: one per archetype × LOD × value step in use (no chunks), and no plant dropped for capacity', () => {
    const tri = (a: number, l: number) => lib.archetypes[a].lod[l].triangles;
    const si = siliconOver();
    const cases: [string, VisualInputs, number][] = [
      // carbon, bright: capped ground (3 kinds × near, dark near and far), 6 mid and 6 giant kinds × 2 LODs
      ['carbon worst case', inputs(() => [0.6, 1]), 33],
      // silicon, dim: crystal ground (4 × 2), shard trees (3 × 2), prism titans (2 × 2)
      ['silicon worst case', inputs(() => [0.6, 1], si), 18],
      // every cell under the sea: ground cover crowded into the low crust row (the fullest bucket), plus the aquatic
      // whisker reef (flora-traits A8: its near and far LOD)
      ['silicon submerged', inputs(() => [1, 0.2], { ...si, seaLevel: 5, terrain: { rise: 1, progress: {}, height: () => 0, patchSize: PATCH } }), 6],
    ];
    for (const [name, inp, budget] of cases) {
      const d = countDraws(placePlants(inp, PATCH, { x: 0, z: 0 }, makePlantList()), tri);
      expect(d.dropped, name).toBe(0);
      expect(d.draws, name).toBeLessThanOrEqual(budget);
      expect(d.draws, name).toBeGreaterThan(0);
    }
  });

  it('ground cover draws its far LOD beyond the LOD radius on carbon only; the dark foreground step is always near', () => {
    const lods = (inp: VisualInputs) => {
      const l = placePlants(inp, PATCH, { x: 0, z: 0 }, makePlantList());
      const n = { far: 0, nearOut: 0, farIn: 0, darkFar: 0 };
      for (let i = 0; i < l.n; i++) {
        if (ARCHETYPE_META[l.arch[i]].role !== 'ground') continue;
        const out = Math.hypot(l.x[i], l.z[i]) >= LOD_NEAR.ground;
        if (l.lod[i]) { n.far++; if (!out) n.farIn++; if (l.dark[i]) n.darkFar++; } else if (out) n.nearOut++;
      }
      return n;
    };
    const c = lods(inputs(() => [1, 0]));
    expect(c.far).toBeGreaterThan(1000);
    expect(c.nearOut + c.farIn + c.darkFar).toBe(0);
    // silicon's far LOD is its near one, so its ground cover stays in the near buckets
    expect(lods(inputs(() => [1, 0], siliconOver())).far).toBe(0);
  });

  it('keeps land plants off until lifeOnLand, and only ground cover and aquatic mids under the sea', () => {
    const dry = roles(placePlants(inputs(() => [1, 0.9], { lifeOnLand: false }), PATCH, { x: 0, z: 0 }, makePlantList()));
    expect(dry).toEqual({ ground: 0, mid: 0, giant: 0 });
    const l = placePlants(inputs(() => [1, 0.9], { seaLevel: 5, lifeOnLand: false }), PATCH, { x: 0, z: 0 }, makePlantList());
    const wet = roles(l);
    expect(wet.giant).toBe(0);
    expect(wet.ground).toBeGreaterThan(0);
    // the only mids in the sea are the aquatic ones (flora-traits A5 kelp on a water world)
    for (let i = 0; i < l.n; i++) if (ARCHETYPE_META[l.arch[i]].role === 'mid') expect(ARCHETYPE_KEYS[l.arch[i]]).toBe('bladderKelp#0');
  });

  it('keeps a spawn clearing: ground cover only, giants further out for their overhang', () => {
    const l = placePlants(inputs(() => [0.6, 1]), PATCH, { x: 0, z: 0 }, makePlantList(), undefined, { x: 30, z: -40, r: 25 });
    let ground = 0;
    for (let i = 0; i < l.n; i++) {
      const d = Math.hypot(l.x[i] - 30, l.z[i] + 40), role = ARCHETYPE_META[l.arch[i]].role;
      if (role === 'mid') expect(d).toBeGreaterThanOrEqual(25);
      if (role === 'giant') expect(d).toBeGreaterThanOrEqual(25 + 12);
      if (role === 'ground' && d < 25) ground++;
    }
    expect(ground).toBeGreaterThan(50);
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

describe('C2 body variants and the T9 density build', () => {
  const PATCH = 400;
  const grid = (m: number, k: number) => { const f = new Float32Array(64 * 64 * 2); for (let c = 0; c < 4096; c++) { f[c * 2] = m; f[c * 2 + 1] = k; } return f; };
  const carbonIn = (stats: Record<string, number> = {}, heatBand = 0.5): VisualInputs => {
    const stub = makeStubVisualInputs();
    return { ...stub, flora: grid(0.6, 1), seaLevel: -1, heatBand, stats: { ...stub.stats, co2: 0.25, ...stats }, terrain: { rise: 1, progress: {}, height: () => 0 }, lifeOnLand: true };
  };

  it('pickAlong shows at most two adjacent variants of a species for any heatBand', () => {
    expect(ALONG_DITHER).toBeLessThan(0.5);
    for (const light of [0, 1, 2] as const) for (const role of ['mid', 'giant'] as FloraRole[]) {
      const list = archetypesFor(formForBin({ silicon: false, water: true, sub: false, lush: 1, light, heat: 2, mix: 2 }), role, light === 2);
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const bySpecies = new Map<string, Set<string>>();
        for (let r = 0; r < 1; r += 0.01) for (let d = 0; d < 1; d += 0.05) {
          const key = pickAlong(list, r, t, d)!;
          const sp = key.split('#')[0];
          if (!bySpecies.has(sp)) bySpecies.set(sp, new Set());
          bySpecies.get(sp)!.add(key);
        }
        for (const [sp, set] of bySpecies) expect(set.size, `${sp} at t ${t.toFixed(2)}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('the patch shows two body variants per carbon mid and giant species (worst case drops to 25 draws)', () => {
    const tri = (a: number, l: number) => lib.archetypes[a].lod[l].triangles;
    const list = placePlants(carbonIn(), PATCH, { x: 0, z: 0 }, makePlantList());
    const kinds = new Map<string, Set<string>>();
    for (let i = 0; i < list.n; i++) {
      const m = ARCHETYPE_META[list.arch[i]];
      if (m.role === 'ground') continue;
      if (!kinds.has(m.species)) kinds.set(m.species, new Set());
      kinds.get(m.species)!.add(ARCHETYPE_KEYS[list.arch[i]]);
    }
    for (const [sp, set] of kinds) expect(set.size, sp).toBeLessThanOrEqual(2);
    const d = countDraws(list, tri);
    expect(d.draws).toBeLessThanOrEqual(25);
    expect(d.dropped).toBe(0);
  });

  it('T9: the dense build replaces the sparse one patch-wide at P = (O2/CO2)/525 ≥ 0.45, never both', () => {
    const tri = (a: number, l: number) => lib.archetypes[a].lod[l].triangles;
    const species = (inp: VisualInputs) => {
      const l = placePlants(inp, PATCH, { x: 0, z: 0 }, makePlantList());
      return { set: new Set(Array.from(l.arch.subarray(0, l.n), (a) => ARCHETYPE_META[a].species)), d: countDraws(l, tri) };
    };
    const sparse = species(carbonIn({ oxygen: 21, co2: 0.25 }));   // P 0.16 (carbon default)
    const dense = species(carbonIn({ oxygen: 21, co2: 0.04 }));    // P 1 (Earth today)
    expect(sparse.set.has('ribFanDense') || sparse.set.has('parasolTitanDense')).toBe(false);
    expect(dense.set.has('ribFan') || dense.set.has('parasolTitan')).toBe(false);
    expect(dense.set.has('ribFanDense') && dense.set.has('parasolTitanDense')).toBe(true);
    expect(dense.d.draws).toBe(sparse.d.draws);
    expect(dense.d.triangles).toBeLessThan(4.5e6);
    expect(dense.d.dropped).toBe(0);
    // the same plant, denser: a dense build keeps its sparse twin's size
    for (const v of [0, 1, 2, 3]) {
      const a = lib.byKey.get(`ribFan#${v}`)!, b = lib.byKey.get(`ribFanDense#${v}`)!;
      expect(b.lod[0].triangles).toBeGreaterThan(a.lod[0].triangles);
      expect(Math.abs(b.height / a.height - 1)).toBeLessThan(0.1);
    }
  });
});
