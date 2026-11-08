import { beforeAll, describe, expect, it } from 'vitest';
import { makeStubVisualInputs } from '../visualInputs';
import type { VisualInputs } from '../../worlds/types';
import { ARCHETYPE_INDEX, ARCHETYPE_KEYS, ARCHETYPE_META, buildFloraLibrary, type FloraLibrary } from './index';
import { AIR_EARTH, GATES, MARGIN_BAND, SHORE_BAND, activeGates, aquaticFor, gateShare, supplySi, worldEnv } from './gates';
import { makePlantList, placePlants, type PlantShapes } from './place';
import { countDraws } from './buckets';
import { createTerrain, seaLevelForCover, spawnPoint } from '../../gen/terrain';
import { crustMap, withCrustChoice } from '../../gen/crust';
import type { CrustPickId } from '../../worlds/types';
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
    ...stub, flora, seaLevel: 0, lifeOnLand: true, stats: { ...stub.stats, ...stats },   // the stub's air is Earth's
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

  it('A5 kelp tops float at the sea surface; A8 reef and S4 glass-kelp tops stay under it; no other mid stands in the sea', () => {
    const sh = shapesOf();
    for (const [inp, key, lo, hi] of [[shore({}), 'bladderKelp#0', -0.5, 0.5], [siShore(), 'whiskerReef#0', -Infinity, 0], [siShore(), 'glassKelp#0', -Infinity, 0]] as const) {
      const l = placed(inp, sh), aquatic = new Set(['bladderKelp#0', 'whiskerReef#0', 'glassKelp#0']);
      let n = 0;
      for (let i = 0; i < l.n; i++) {
        const k = keyOf(l, i), a = lib.archetypes[l.arch[i]];
        if (aquatic.has(k) && k !== key) continue;
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

  it('S1 nitride crowns replace druse clusters only on the dry sea margin (0–2.5 m above the sea, shoreline cells)', () => {
    const l = placed(siShore());
    let n = 0;
    for (let i = 0; i < l.n; i++) {
      const k = keyOf(l, i);
      if (k === 'nitrideCrown#0') { n++; expect(l.y[i]).toBeGreaterThanOrEqual(MARGIN_BAND[0]); expect(l.y[i]).toBeLessThanOrEqual(MARGIN_BAND[1]); }
    }
    expect(n).toBeGreaterThan(0);
    const c = placed(shore({}));
    for (let i = 0; i < c.n; i++) expect(keyOf(c, i)).not.toBe('nitrideCrown#0');   // silicon only
  });

  it('S5 lantern bulbs take half the land tile crusts only in the dark (light < DARK_BELOW)', () => {
    const count = (inp: VisualInputs) => { const l = placed(inp); let lan = 0, tile = 0; for (let i = 0; i < l.n; i++) { const k = keyOf(l, i); if (k === 'lanternBulb#0') { lan++; expect(l.y[i]).toBeGreaterThanOrEqual(inp.seaLevel); } if (k === 'crystalGround#1' && l.y[i] >= inp.seaLevel) tile++; } return { lan, tile }; };
    const dark = count(siShore()), lit = count(siShore({ light: 0.2 }));
    expect(dark.lan).toBeGreaterThan(0);
    expect(dark.tile).toBeGreaterThan(0);                // the share leaves the crusts beside them
    expect(lit.lan).toBe(0);
  });

  it('S2 lace fans and S3 air-plankton rafts take the shard mids only in air ≥ 5 × Earth density', () => {
    const mids = (air: number) => { const l = placed(siShore({ airDensity: air * AIR_EARTH, seaLevel: -9 })); const k: Record<string, number> = {}; for (let i = 0; i < l.n; i++) k[keyOf(l, i)] = (k[keyOf(l, i)] ?? 0) + 1; return k; };
    const thick = mids(10.8), thin = mids(4);
    expect(thick['laceFan#0']).toBeGreaterThan(0);
    expect(thick['airPlankton#0']).toBeGreaterThan(0);
    expect(thick['shardTree#2']).toBeUndefined();        // lace takes every basalt column
    expect(thick['shardTree#1']).toBeGreaterThan(0);     // plankton takes only half the pod shards
    expect(thin['laceFan#0']).toBeUndefined();
    expect(thin['airPlankton#0']).toBeUndefined();
  });

  it('S4 glass kelp grows only in silicon water 4–12 m deep; whisker reefs keep the 1–4 m shallows', () => {
    const l = placed(siShore());
    let g = 0, r = 0;
    for (let i = 0; i < l.n; i++) {
      const k = keyOf(l, i), d = -l.y[i];
      if (k === 'glassKelp#0') { g++; expect(d).toBeGreaterThanOrEqual(4); expect(d).toBeLessThanOrEqual(12.5); }
      if (k === 'whiskerReef#0') { r++; expect(d).toBeLessThanOrEqual(4.5); }
    }
    expect(g).toBeGreaterThan(0);
    expect(r).toBeGreaterThan(0);
    const frozen = placed(siShore({ frozen: true }));
    for (let i = 0; i < frozen.n; i++) expect(keyOf(frozen, i)).not.toBe('glassKelp#0');
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
    ['carbon half-hot, half-N-rich, half-O₂-rich (§2c kinds beside their base kinds)', () => uniform({ temperature: 40, nitrogen: 3.5, oxygen: 31 })],
    ['carbon hot, N-rich, O₂-rich in full', () => uniform({ temperature: 55, nitrogen: 6, oxygen: 36 })],
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

  it('draw budget: silicon thick air + reefs + glass kelp + supply ferns + every §2b archetype ≤ 33 draws, < 4.5M tris, nothing dropped', () => {
    const inp = siShore({ seaLevel: -1.5 }), f = inp.flora;   // the margin's rank (≈ 0.44–0.54) is nitride under the rank fallback
    for (let c = 0; c < 4096; c++) { f[c * 2] = 0.6; f[c * 2 + 1] = 1; }
    const l = placed(inp, shapesOf());
    const keys = new Set(Array.from(l.arch.subarray(0, l.n), (a) => ARCHETYPE_KEYS[a]));
    for (const k of ['airKelpFloat#0', 'whiskerReef#0', 'frostFern#0', ...SI_ONLY]) expect(keys.has(k), k).toBe(true);
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
    ['silicon (defaults: reef, glass kelp, fern, crown, lantern, lace, plankton, air float)', silicon, 0.016, 0.65, 0.6, {}],
    ['carbon half-hot, N-rich and O₂-rich (§2c beside base kinds)', carbon, 1, 0.06, 0.55, { temperature: 40, nitrogen: 3.5, oxygen: 31 }],
    ['carbon, granite picked (heath)', carbon, 1, 0.06, 0.38, {}, 'granite'],
    ['carbon, ironstone picked (reeds)', carbon, 1, 0.06, 0.38, {}, 'ironstone'],
  ] as [string, WorldConfig, number, number, number, Record<string, number>, CrustPickId?][])('draw ceiling: a mixed %s world on its demo terrain ≤ 45 draws, < 4.5M tris, nothing dropped', (_id, world, light, air, heatBand, over, pick) => {
    const l = demoWorld(world, light, air, heatBand, over, pick);
    const d = countDraws(l, (a, lod) => lib.archetypes[a].lod[lod].triangles);
    console.log(`${_id} mixed world: ${d.draws} draws`, JSON.stringify(Object.fromEntries(Object.entries(d.byRole).map(([r, v]) => [r, v.draws]))), `${(d.triangles / 1e6).toFixed(2)}M tris`);
    expect(d.draws).toBeLessThanOrEqual(45);
    expect(d.triangles).toBeLessThan(4.5e6);
    expect(d.dropped).toBe(0);
  });

  it('on the real crust map: nitride crowns stand only on nitride cells, frost ferns only where Si supply × B > 1.2 (never water ice)', () => {
    const l = demoWorld(silicon, 0.016, 0.65, 0.6, {});
    const minerals = silicon.terrain.crust.minerals;
    const cellMineral = (x: number, z: number) => {
      const col = Math.floor((x / PATCH + 0.5) * 64), row = Math.floor((z / PATCH + 0.5) * 64);
      const w = l.terrain.crustWeights(((col + 0.5) / 64 - 0.5) * PATCH, ((row + 0.5) / 64 - 0.5) * PATCH);
      return { m: minerals[w.indexOf(Math.max(...w))], c: row * 64 + col };
    };
    let crowns = 0, ferns = 0;
    for (let i = 0; i < l.n; i++) {
      const k = keyOf(l, i);
      if (k === 'nitrideCrown#0') { crowns++; expect(cellMineral(l.x[i], l.z[i]).m.id).toBe('nitride'); }
      if (k === 'frostFern#0') {
        ferns++;
        const { m, c } = cellMineral(l.x[i], l.z[i]);
        expect(m.id).not.toBe('waterIce');
        expect(m.supply.si * (l.inp.flora[c * 2] + l.inp.flora[c * 2 + 1])).toBeGreaterThan(1.2);
      }
    }
    console.log(`silicon demo seed on the crust map: ${crowns} crowns, ${ferns} ferns`);
    expect(ferns).toBeGreaterThan(0);
  });

  it('the crust mineral grid is computed once per crust map: a repeat rebuild makes no crustWeights calls, no cell is asked twice', () => {
    const seen = new Map<string, number>();
    const minerals = silicon.terrain.crust.minerals;
    const mk = () => ({ minerals, weights: (x: number, z: number) => { const k = `${x},${z}`; seen.set(k, (seen.get(k) ?? 0) + 1); return x > 0 ? [0, 1, 0] : [1, 0, 0]; } });
    const calls = () => [...seen.values()].reduce((a, b) => a + b, 0);
    const base = siShore(), inp = { ...base, terrain: { ...base.terrain, crust: mk() } };
    placed(inp);
    const first = calls();
    expect(first).toBeGreaterThan(0);
    placed(inp);
    expect(calls()).toBe(first);                         // the same rebuild again: nothing recomputed
    placed({ ...inp, seaLevel: -1 });                    // live stats moved: only cells never asked before are filled
    expect(Math.max(...seen.values())).toBe(1);
    seen.clear();
    placed({ ...inp, terrain: { ...inp.terrain, crust: mk() } });   // another world's map: recomputed
    expect(calls()).toBeGreaterThan(0);
  });

  it('gateShare is the one share rule: 0 off, ramp × share on; every niche gate is 0 at defaults', () => {
    const e = worldEnv(shore({ temperature: 15, nitrogen: 1, oxygen: 21 }));
    for (const g of GATES.filter((g) => g.ramp)) expect(gateShare(g, e), g.id).toBe(0);
    const hot = worldEnv(shore({ temperature: 40 }));
    const barrel = GATES.find((g) => g.id === 'barrel')!;
    expect(gateShare(barrel, hot)).toBeCloseTo(0.5, 5);
    expect(gateShare(GATES.find((g) => g.id === 'lantern')!, worldEnv(siShore()))).toBe(0.5);
    expect(gateShare(GATES.find((g) => g.id === 'mangrove')!, e)).toBe(1);
  });

  it('§2c: at defaults (15 °C, N 1, O₂ 21, the natural rock mix) the carbon flora is unchanged: no niche kind anywhere', () => {
    for (const l of [placed(shore({ temperature: 15, nitrogen: 1, oxygen: 21 })), demoWorld(carbon, 1, 0.06, 0.38, {})]) for (const k of NICHE) expect(countOf(l, k), k).toBe(0);
  });

  it.each([
    ['barrel succulents with heat', 'barrelSucculent#0', 'temperature', [15, 30, 35, 40, 45, 50, 60]],
    ['thorn shrubs with heat', 'thornShrub#0', 'temperature', [15, 30, 35, 40, 45, 50, 60]],
    ['nitrophile groves with nitrogen', 'nitroGrove#0', 'nitrogen', [1, 2, 2.75, 3.5, 4.25, 5, 8]],
    ['lycopod giants with oxygen', 'lycopodGiant#0', 'oxygen', [21, 28, 30, 31.5, 33, 35, 40]],
  ] as const)('§2c: %s: none at the base value, then a share that never falls as the slider moves, the new kind taking most of its slots', (_n, key, stat, xs) => {
    const counts = xs.map((x) => countOf(demoWorld(carbon, 1, 0.06, 0.38, { [stat]: x }), key));
    console.log(`${key} by ${stat}`, JSON.stringify(xs), JSON.stringify(counts));
    expect(counts[0]).toBe(0);
    for (let i = 1; i < counts.length; i++) expect(counts[i], `${stat} ${xs[i]}`).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(counts[counts.length - 1]).toBeGreaterThan(0);
    expect(counts[3]).toBeGreaterThan(0);                 // part-way through the ramp it is already visible
  });

  it.each([
    ['granite', 'heathShrub#0'],
    ['ironstone', 'ironReeds#0'],
  ] as const)('§2c: picking %s grows its rock plant on its own cells only (none at the natural mix)', (pick, key) => {
    const l = demoWorld(carbon, 1, 0.06, 0.38, {}, pick);
    let n = 0;
    for (let i = 0; i < l.n; i++) {
      if (keyOf(l, i) !== key) continue;
      n++;
      const col = Math.floor((l.x[i] / PATCH + 0.5) * 64), row = Math.floor((l.z[i] / PATCH + 0.5) * 64);
      const w = l.terrain.crustWeights(((col + 0.5) / 64 - 0.5) * PATCH, ((row + 0.5) / 64 - 0.5) * PATCH);
      expect(withCrustChoice(carbon, pick).terrain.crust.minerals[w.indexOf(Math.max(...w))].id).toBe(pick);
    }
    console.log(`${pick} picked: ${n} ${key}`);
    expect(n).toBeGreaterThan(0);
    expect(countOf(demoWorld(carbon, 1, 0.06, 0.38, {}), key)).toBe(0);
  });

  it('§2b: at least 2 silicon-only archetypes grow on the default silicon demo seed (−183 °C, default N, thick air, dim)', () => {
    const l = demoWorld(silicon, 0.016, 0.65, 0.6, {});
    const counts: Record<string, number> = {};
    for (let i = 0; i < l.n; i++) { const k = keyOf(l, i); if (SI_ONLY.includes(k)) counts[k] = (counts[k] ?? 0) + 1; }
    console.log('silicon demo seed, §2b archetypes:', JSON.stringify(counts));
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(2);
  });
});

const NICHE = ['barrelSucculent#0', 'thornShrub#0', 'nitroGrove#0', 'lycopodGiant#0', 'heathShrub#0', 'ironReeds#0'];
const countOf = (l: { n: number; arch: ArrayLike<number> }, key: string) => { let n = 0; for (let i = 0; i < l.n; i++) if (ARCHETYPE_KEYS[l.arch[i]] === key) n++; return n; };
const SI_ONLY = ['nitrideCrown#0', 'lanternBulb#0', 'laceFan#0', 'airPlankton#0', 'glassKelp#0'];

// A realistic mixed world (team-lead ruling): the demo terrain with its sea, a checkerboard of mat-dominant and mixed
// cells (tufts, domes and crusts beside groves and giants, on land, on the shore and under the sea), default stats.
// Three pick lists meet in one carbon world, so its ground cover alone takes 18 draws: the ceiling is 45, not 33.
function demoWorld(world0: WorldConfig, light: number, air: number, heatBand: number, over: Record<string, number>, pick?: CrustPickId) {
  const world = withCrustChoice(world0, pick);
  const terrain = createTerrain(world.terrain, world.demoSeed);
  const shares = crustMap(world, world.demoSeed).shares;
  const T = over.temperature ?? world.startDefaults.temperature;
  const hs = Math.min(1, Math.max(0, 0.5 + (T - world.solvent.freezeC) / world.terrain.heatSolventSpan));
  const st = { rise: 1, heatSolvent: hs, progress: Object.fromEntries(world.terrain.machines.map((m) => [m.id, 1])) };
  const sea = seaLevelForCover(terrain, st, (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200);
  const flora = new Float32Array(64 * 64 * 2);
  for (let c = 0; c < 4096; c++) { const mixed = ((c % 64) + Math.floor(c / 64)) % 2 === 0; flora[c * 2] = mixed ? 0.7 : 1; flora[c * 2 + 1] = mixed ? 0.5 : 0.05; }
  const stub = makeStubVisualInputs();
  const inp: VisualInputs = {
    ...stub, flora, lifeOnLand: true, light, airDensity: air, heatBand, heatSolvent: hs, seaLevel: sea,
    world: { ...stub.world, id: world.id, solvent: world.solvent, composition: world.life.composition,
      crust: { ids: world.terrain.crust.minerals.map((m) => m.id), oxidises: world.terrain.crust.minerals.map((m) => m.oxidises), shares, elevation: world.terrain.crust.minerals.map((m) => m.elevation) } },
    stats: { ...stub.stats, temperature: T, nitrogen: over.nitrogen ?? world.startDefaults.nitrogen, oxygen: over.oxygen ?? world.startDefaults.oxygen, co2: world.id === 'carbon' ? 0.25 : 0, seaLevel: sea },
    terrain: { rise: 1, progress: st.progress, height: (x, z) => terrain.height(x, z, st), patchSize: PATCH, crust: { minerals: world.terrain.crust.minerals, weights: (x, z) => terrain.crustWeights(x, z) } },
  };
  const sp = spawnPoint(terrain, st, sea);
  return Object.assign(placePlants(inp, PATCH, { x: sp.x, z: sp.z }, makePlantList(), undefined, null, shapesOf()), { inp, terrain, sea });
}
