import { beforeAll, describe, expect, it } from 'vitest';
import { makeStubVisualInputs } from '../visualInputs';
import type { VisualInputs } from '../../worlds/types';
import { ARCHETYPE_INDEX, ARCHETYPE_KEYS, ARCHETYPE_META, buildFloraLibrary, type FloraLibrary } from './index';
import { AIR_EARTH, GATES, SHORE_BAND, activeGates, aquaticFor, supplySi, worldEnv } from './gates';
import { makePlantList, placePlants, type PlantShapes } from './place';
import { countDraws } from './buckets';
import { createTerrain, seaLevelForCover, spawnPoint } from '../../gen/terrain';
import { carbon } from '../../worlds/carbon';
import { silicon } from '../../worlds/silicon';
import type { WorldConfig } from '../../worlds/types';

const PATCH = 400;
let lib: FloraLibrary;
beforeAll(() => { lib = buildFloraLibrary(7); });

/** A carbon shore: the ground climbs 6 cm per metre eastwards through the sea level at x = 0. */
function shore(stats: Record<string, number>, over: Partial<VisualInputs> = {}): VisualInputs {
  const stub = makeStubVisualInputs();
  const flora = new Float32Array(64 * 64 * 2);
  for (let c = 0; c < 4096; c++) { flora[c * 2] = c % 2 ? 1 : 0.6; flora[c * 2 + 1] = c % 2 ? 0.05 : 0.8; }
  return {
    // airDensity in VisualInputs units: Earth's air
    ...stub, flora, seaLevel: 0, lifeOnLand: true, airDensity: AIR_EARTH, stats: { ...stub.stats, ...stats },
    terrain: { rise: 1, progress: {}, height: (x) => 0.06 * x, patchSize: PATCH }, ...over,
  };
}
const placed = (inp: VisualInputs, shapes?: PlantShapes) => placePlants(inp, PATCH, { x: 0, z: 0 }, makePlantList(), undefined, null, shapes);
const shapesOf = (): PlantShapes => ({ foot: lib.archetypes.map((a) => a.foot / a.size), height: lib.archetypes.map((a) => a.height / a.size) });
/** The same shore on the silicon world (liquid nitrogen, dim light). */
const siShore = (over: Partial<VisualInputs> = {}): VisualInputs => {
  const stub = makeStubVisualInputs(), base = shore({ temperature: -183, nitrogen: 30 });
  return { ...base, world: { ...stub.world, id: 'silicon', composition: { c: 0.1, si: 0.9, o: 0 }, solvent: { ...stub.world.solvent, name: 'Liquid nitrogen' } }, light: 0.016, airDensity: 0.65, ...over };
};
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
    expect(on({ nitrogen: 1, temperature: 15 })).toEqual(['mangrove']);   // the carbon default: every run's shore
    expect(on({ nitrogen: 0.2 })).toContain('pitcher');
    expect(on({ temperature: -1 })).toContain('cushion');
  });

  it('A5 kelp tops float at the sea surface and A8 reef tops stay under it; no other mid stands in the sea', () => {
    const sh = shapesOf();
    for (const [inp, key, lo, hi] of [[shore({}), 'bladderKelp#0', -0.5, 0.5], [siShore(), 'whiskerReef#0', -Infinity, 0]] as const) {
      const l = placed(inp, sh);
      let n = 0;
      for (let i = 0; i < l.n; i++) {
        const k = keyOf(l, i), a = lib.archetypes[l.arch[i]];
        if (k === key) {
          n++;
          const top = l.y[i] - 0.03 * l.h[i] - l.sink[i] + (a.height / a.size) * l.h[i];
          expect(top - inp.seaLevel, k).toBeGreaterThanOrEqual(lo);
          expect(top - inp.seaLevel, k).toBeLessThanOrEqual(hi);
          expect(l.y[i]).toBeLessThan(inp.seaLevel - 0.9);
        } else if (a.role !== 'ground') expect(l.y[i], k).toBeGreaterThanOrEqual(inp.seaLevel);
      }
      expect(n, key).toBeGreaterThan(0);
    }
  });

  it('frozen seas grow no aquatic mids', () => {
    expect(aquaticFor(worldEnv(shore({}, { frozen: true })))).toBeNull();
    const l = placed(shore({}, { frozen: true }));
    for (let i = 0; i < l.n; i++) expect(keyOf(l, i)).not.toBe('bladderKelp#0');
  });

  it('A5 air niche: kelp replaces weepers on land only at ≥ 5 × Earth air density', () => {
    const onLand = (air: number) => { const l = placed(shore({}, { airDensity: air * AIR_EARTH })); let k = 0, w = 0; for (let i = 0; i < l.n; i++) { if (l.y[i] < 0) continue; if (keyOf(l, i) === 'bladderKelp#0') k++; if (keyOf(l, i).startsWith('weeper')) w++; } return { k, w }; };
    const thin = onLand(4.9), thick = onLand(6);
    expect(thin.k).toBe(0);
    expect(thin.w).toBeGreaterThan(0);
    expect(thick.k).toBeGreaterThan(0);
    expect(thick.w).toBe(0);
  });

  // The doc's worst cases (flora-traits §9.2) on a uniform canopy-rich shore (capped/cup forms everywhere, sea and land)
  const uniform = (stats: Record<string, number>, over: Partial<VisualInputs> = {}) => {
    const inp = shore(stats, over), f = inp.flora;
    for (let c = 0; c < 4096; c++) { f[c * 2] = 0.6; f[c * 2 + 1] = 1; }
    return inp;
  };
  it.each([
    ['carbon cold + low N + bright + kelp shallows', () => uniform({ temperature: -5, nitrogen: 0.2 })],
    ['carbon warm shore + kelp', () => uniform({ temperature: 25, nitrogen: 1 })],
    ['carbon thick air (kelp in air and water)', () => uniform({ temperature: 15, nitrogen: 8 }, { airDensity: 6 * AIR_EARTH })],
  ] as const)('draw budget: %s ≤ 33 draws, < 4.5M tris, nothing dropped', (_name, make) => {
    const d = countDraws(placed(make(), shapesOf()), (a, l) => lib.archetypes[a].lod[l].triangles);
    expect(d.draws).toBeLessThanOrEqual(33);
    expect(d.triangles).toBeLessThan(4.5e6);
    expect(d.dropped).toBe(0);
  });

  it('A7 frost ferns replace needle tufts on land where silicon supply × biomass > 1.2, never on ice or in the sea', () => {
    const inp = siShore({ seaLevel: -9 }), l = placed(inp);
    let n = 0;
    for (let i = 0; i < l.n; i++) {
      if (keyOf(l, i) !== 'frostFern#0') continue;
      n++;
      expect(l.y[i]).toBeGreaterThanOrEqual(inp.seaLevel);
      const col = Math.floor((l.x[i] / PATCH + 0.5) * 64), c = Math.floor((l.z[i] / PATCH + 0.5) * 64) * 64 + col;
      const rank = (col + 0.5) / 64;                       // the shore climbs evenly eastwards
      expect(supplySi(rank - 0.05) * (inp.flora[c * 2] + inp.flora[c * 2 + 1])).toBeGreaterThan(1.2);
    }
    expect(n).toBeGreaterThan(0);
    const bare = placed(siShore({ seaLevel: -9, flora: new Float32Array(64 * 64 * 2).fill(0.3) }));
    for (let i = 0; i < bare.n; i++) expect(keyOf(bare, i)).not.toBe('frostFern#0');   // B 0.6: too little biomass
  });

  it('A2 woolly rosettes take the giant slot only on the cold, bright heights', () => {
    const cold = placed(shore({ temperature: 2 }));
    let n = 0;
    for (let i = 0; i < cold.n; i++) if (keyOf(cold, i) === 'woollyRosette#0') { n++; expect(cold.x[i]).toBeGreaterThan(0.7 * PATCH - PATCH / 2 - 20); }
    expect(n).toBeGreaterThan(0);
    for (const inp of [shore({ temperature: 15 }), shore({ temperature: 2 }, { light: 0.2 })]) {
      const l = placed(inp);
      for (let i = 0; i < l.n; i++) expect(keyOf(l, i)).not.toBe('woollyRosette#0');
    }
  });

  it('A3 stilt mangroves stand on warm shores at N ≥ 0.3, on dry ground beside the water', () => {
    const warm = placed(shore({ temperature: 15, nitrogen: 1 }));
    let n = 0;
    for (let i = 0; i < warm.n; i++) if (keyOf(warm, i) === 'stiltMangrove#0') {
      n++;
      expect(warm.y[i]).toBeGreaterThanOrEqual(SHORE_BAND[0]);
      expect(warm.y[i]).toBeLessThanOrEqual(SHORE_BAND[1]);
    }
    expect(n).toBeGreaterThan(0);
    for (const stats of [{ temperature: 5 }, { nitrogen: 0.2 }]) {
      const l = placed(shore({ temperature: 15, nitrogen: 1, ...stats }));
      for (let i = 0; i < l.n; i++) expect(keyOf(l, i)).not.toBe('stiltMangrove#0');
    }
  });

  it('A6 air-kelp floats replace the candelabra patch-wide in thick air only', () => {
    const giants = (air: number) => { const l = placed(siShore({ airDensity: air * AIR_EARTH })); const k = new Set<string>(); for (let i = 0; i < l.n; i++) if (ARCHETYPE_META[l.arch[i]].role === 'giant') k.add(keyOf(l, i)); return k; };
    const thick = giants(10.8), thin = giants(4);
    expect(thick.has('airKelpFloat#0')).toBe(true);
    expect(thick.has('prismTitan#2')).toBe(false);
    expect(thin.has('airKelpFloat#0')).toBe(false);
    expect(thin.has('prismTitan#2')).toBe(true);
  });

  it('A1/A3 and A2/A3 are never on together, over a grid of temperature, nitrogen and light', () => {
    for (let T = -45; T <= 120; T += 2.5) for (const N of [0.05, 0.1, 0.2, 0.29, 0.3, 0.31, 0.5, 1, 3, 30]) for (const L of [0.1, 0.4, 1, 2]) {
      const ids = new Set(Object.values(activeGates(worldEnv(shore({ temperature: T, nitrogen: N }, { light: L })))).flat().map((g) => g.id));
      expect(ids.has('pitcher') && ids.has('mangrove'), `T ${T} N ${N}`).toBe(false);
      expect(ids.has('rosette') && ids.has('mangrove'), `T ${T} N ${N}`).toBe(false);
    }
  });

  it('draw budget: silicon thick air + submerged reefs + supply ferns ≤ 33 draws, < 4.5M tris, nothing dropped', () => {
    const inp = siShore({ seaLevel: -3 }), f = inp.flora;
    for (let c = 0; c < 4096; c++) { f[c * 2] = 0.6; f[c * 2 + 1] = 1; }
    const l = placed(inp, shapesOf());
    const keys = new Set(Array.from(l.arch.subarray(0, l.n), (a) => ARCHETYPE_KEYS[a]));
    for (const k of ['airKelpFloat#0', 'whiskerReef#0', 'frostFern#0']) expect(keys.has(k), k).toBe(true);
    const d = countDraws(l, (a, lod) => lib.archetypes[a].lod[lod].triangles);
    expect(d.draws).toBeLessThanOrEqual(33);
    expect(d.triangles).toBeLessThan(4.5e6);
    expect(d.dropped).toBe(0);
  });

  // A realistic mixed world (team-lead ruling): the demo terrain with its sea, a checkerboard of mat-dominant and mixed
  // cells (tufts, domes and crusts beside groves and giants, on land, on the shore and under the sea), default stats.
  // Three pick lists meet in one carbon world, so its ground cover alone takes 18 draws: the ceiling is 45, not 33.
  it.each([
    ['carbon (defaults: mangrove, kelp)', carbon, 1, 0.06, 0.38, {}],
    ['carbon, cold and nitrogen-poor (pitcher, rosette, cushion, kelp)', carbon, 1, 0.06, 0.26, { temperature: -5, nitrogen: 0.2 }],
    ['silicon (defaults: reef, fern, air float)', silicon, 0.016, 0.65, 0.6, {}],
  ] as [string, WorldConfig, number, number, number, Record<string, number>][])('draw ceiling: a mixed %s world on its demo terrain ≤ 45 draws, < 4.5M tris, nothing dropped', (_id, world, light, air, heatBand, over) => {
    const terrain = createTerrain(world.terrain, world.demoSeed);
    const T = over.temperature ?? world.startDefaults.temperature;
    const hs = Math.min(1, Math.max(0, 0.5 + (T - world.solvent.freezeC) / world.terrain.heatSolventSpan));
    const st = { rise: 1, heatSolvent: hs, progress: Object.fromEntries(world.terrain.machines.map((m) => [m.id, 1])) };
    const sea = seaLevelForCover(terrain, st, (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200);
    const flora = new Float32Array(64 * 64 * 2);
    for (let c = 0; c < 4096; c++) { const mixed = ((c % 64) + Math.floor(c / 64)) % 2 === 0; flora[c * 2] = mixed ? 0.7 : 1; flora[c * 2 + 1] = mixed ? 0.5 : 0.05; }
    const stub = makeStubVisualInputs();
    const inp: VisualInputs = {
      ...stub, flora, lifeOnLand: true, light, airDensity: air, heatBand, heatSolvent: hs, seaLevel: sea,
      world: { ...stub.world, id: world.id, solvent: world.solvent, composition: world.life.composition },
      stats: { ...stub.stats, temperature: T, nitrogen: over.nitrogen ?? world.startDefaults.nitrogen, oxygen: world.startDefaults.oxygen, co2: world.id === 'carbon' ? 0.25 : 0, seaLevel: sea },
      terrain: { rise: 1, progress: st.progress, height: (x, z) => terrain.height(x, z, st), patchSize: PATCH },
    };
    const sp = spawnPoint(terrain, st, sea);
    const l = placePlants(inp, PATCH, { x: sp.x, z: sp.z }, makePlantList(), undefined, null, shapesOf());
    const d = countDraws(l, (a, lod) => lib.archetypes[a].lod[lod].triangles);
    console.log(`${_id} mixed world: ${d.draws} draws`, JSON.stringify(Object.fromEntries(Object.entries(d.byRole).map(([r, v]) => [r, v.draws]))), `${(d.triangles / 1e6).toFixed(2)}M tris`);
    expect(d.draws).toBeLessThanOrEqual(45);
    expect(d.triangles).toBeLessThan(4.5e6);
    expect(d.dropped).toBe(0);
  });
});
