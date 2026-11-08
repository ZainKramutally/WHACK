import { beforeAll, describe, expect, it } from 'vitest';
import { makeStubVisualInputs } from '../visualInputs';
import type { CrustPickId, VisualInputs, WorldConfig } from '../../worlds/types';
import { ARCHETYPE_META, buildFloraLibrary, type FloraLibrary, type FloraRole } from './index';
import { makePlantList, placePlants, type PlantList, type PlantShapes } from './place';
import { createTerrain, seaLevelForCover, spawnPoint } from '../../gen/terrain';
import { crustMap, withCrustChoice } from '../../gen/crust';
import { carbon } from '../../worlds/carbon';
import { emergentChance, sizeClass, sizeScore, SIZE_BAND } from './size';
import { makeEnv } from './traits';
import { rayPlants } from '../floraHit';
import { silicon } from '../../worlds/silicon';

const PATCH = 400;
let lib: FloraLibrary;
beforeAll(() => { lib = buildFloraLibrary(7); });
const shapesOf = (): PlantShapes => ({ foot: lib.archetypes.map((a) => a.foot / a.size), height: lib.archetypes.map((a) => a.height / a.size) });

/** gates.test.ts's demoWorld (the demo terrain, its crust map and sea, a checkerboard of mixed and mat cells). */
function demoWorld(world0: WorldConfig, light: number, air: number, heatBand: number, over: Record<string, number>, pick?: CrustPickId, clearing = false) {
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
  const clear = clearing ? { x: sp.x, z: sp.z, r: 25 } : null;
  return { list: placePlants(inp, PATCH, { x: sp.x, z: sp.z }, makePlantList(), undefined, clear, shapesOf()), sp, clear };
}

const meanBy = (l: PlantList) => {
  const s: Record<FloraRole, number> = { ground: 0, mid: 0, giant: 0 }, n: Record<FloraRole, number> = { ground: 0, mid: 0, giant: 0 };
  for (let i = 0; i < l.n; i++) { const r = ARCHETYPE_META[l.arch[i]].role; s[r] += l.h[i]; n[r]++; }
  return { mean: Object.fromEntries((['ground', 'mid', 'giant'] as const).map((r) => [r, n[r] ? s[r] / n[r] : 0])) as Record<FloraRole, number>, n };
};

const CARBON_DEF = () => demoWorld(carbon, 1, 0.06, 0.38, {});
const SILICON_DEF = () => demoWorld(silicon, 0.016, 0.65, 0.6, {});

/** Today's per-role mean heights on the default demo worlds, measured before size levels (d641af3). */
const TODAY = {
  carbon: { ground: 1.1904, mid: 9.7400, giant: 30.595 },
  silicon: { ground: 1.3613, mid: 7.8561, giant: 34.974 },
} as const;

describe('plant size levels (§2d)', () => {
  it('size classes follow a power law: many near the floor, few large, monotone in u and in g', () => {
    const N = 2000, s = Array.from({ length: N }, (_, i) => sizeClass((i + 0.5) / N, 0));
    const lo = s[0], hi = s[N - 1], third = (hi - lo) / 3;
    const small = s.filter((v) => v < lo + third).length, large = s.filter((v) => v > hi - third).length;
    expect(small / large).toBeGreaterThan(4);
    for (let i = 1; i < N; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
    const mean = s.reduce((a, b) => a + b, 0) / N;
    expect(mean).toBeCloseTo(1, 1); // g = 0 keeps today's mean
    for (const u of [0.1, 0.5, 0.95]) expect(sizeClass(u, 0.8)).toBeGreaterThan(sizeClass(u, -0.8));
  });

  it('fertile ground, more nitrogen, wet ground, warmth and oxygen raise the score and the emergent rate', () => {
    const base = () => Object.assign(makeEnv(), { supply: 1 });
    const g0 = sizeScore(base());
    expect(sizeScore(Object.assign(base(), { supply: 1.4 }))).toBeGreaterThan(sizeScore(Object.assign(base(), { supply: 0.6 })));
    expect(sizeScore(Object.assign(base(), { nitrogen: 4 }))).toBeGreaterThan(sizeScore(Object.assign(base(), { nitrogen: 0.25 })));
    expect(sizeScore(Object.assign(base(), { wet: 1 }))).toBeGreaterThan(g0);
    expect(sizeScore(Object.assign(base(), { temperature: 30 }))).toBeGreaterThan(g0);
    expect(sizeScore(Object.assign(base(), { oxygen: 31 }))).toBeGreaterThan(g0);
    expect(emergentChance(0.5)).toBeGreaterThan(emergentChance(-0.5));
  });

  it.each([['carbon', CARBON_DEF], ['silicon', SILICON_DEF]] as const)('%s defaults: mean heights per role within ±15%% of today', (id, make) => {
    const { mean, n } = meanBy(make().list);
    console.log(id, JSON.stringify(mean), JSON.stringify(n));
    for (const r of ['ground', 'mid', 'giant'] as const) {
      expect(mean[r] / TODAY[id][r], r).toBeGreaterThan(0.85);
      expect(mean[r] / TODAY[id][r], r).toBeLessThan(1.15);
    }
  });

  it('is deterministic, and every height stays inside its widened band', () => {
    const a = CARBON_DEF().list, b = CARBON_DEF().list;
    expect(a.n).toBe(b.n);
    expect(Array.from(a.h.subarray(0, a.n))).toEqual(Array.from(b.h.subarray(0, b.n)));
    for (const l of [a, SILICON_DEF().list]) for (let i = 0; i < l.n; i++) {
      const r = ARCHETYPE_META[l.arch[i]].role;
      expect(l.h[i]).toBeLessThanOrEqual(SIZE_BAND[r][1] + 1e-4);
      expect(l.h[i]).toBeGreaterThan(0);
    }
  });

  it('fertile basalt grows taller plants and more emergent giants than granite', () => {
    const ba = demoWorld(carbon, 1, 0.06, 0.38, {}, 'basalt').list, gr = demoWorld(carbon, 1, 0.06, 0.38, {}, 'granite').list;
    const mb = meanBy(ba), mg = meanBy(gr);
    console.log('basalt', JSON.stringify(mb), 'granite', JSON.stringify(mg));
    for (const r of ['ground', 'mid', 'giant'] as const) expect(mb.mean[r], r).toBeGreaterThan(mg.mean[r]);
    expect(mb.n.giant).toBeGreaterThan(mg.n.giant);
  });

  it('nitrogen-rich ground grows taller plants than nitrogen-poor', () => {
    const rich = meanBy(demoWorld(carbon, 1, 0.06, 0.38, { nitrogen: 4 }).list), poor = meanBy(demoWorld(carbon, 1, 0.06, 0.38, { nitrogen: 0.25 }).list);
    for (const r of ['ground', 'mid', 'giant'] as const) expect(rich.mean[r], r).toBeGreaterThan(poor.mean[r]);
  });

  it.each([['carbon', carbon, 1, 0.06, 0.38], ['silicon', silicon, 0.016, 0.65, 0.6]] as const)('%s: no mid or giant (emergents included) inside the spawn clearing', (_id, world, light, air, hb) => {
    const { list, clear } = demoWorld(world, light, air, hb, {}, undefined, true);
    for (let i = 0; i < list.n; i++) {
      const r = ARCHETYPE_META[list.arch[i]].role;
      if (r === 'ground') continue;
      const d = Math.hypot(list.x[i] - clear!.x, list.z[i] - clear!.z);
      expect(d).toBeGreaterThanOrEqual(clear!.r + (r === 'giant' ? 12 : 0));
    }
  });

  it('ground cover stays ≤ ~2.1 m inside the spawn clearing and within 8 m of the camera (no cut-out on ground buckets)', () => {
    for (const make of [() => demoWorld(carbon, 1, 0.06, 0.38, { nitrogen: 4, oxygen: 31 }, 'basalt', true), () => demoWorld(silicon, 0.016, 0.65, 0.6, {}, undefined, true)]) {
      const { list, sp, clear } = make();
      let near = 0;
      for (let i = 0; i < list.n; i++) {
        if (ARCHETYPE_META[list.arch[i]].role !== 'ground') continue;
        const d = Math.hypot(list.x[i] - sp.x, list.z[i] - sp.z);
        if (d < Math.max(8, clear!.r)) { near++; expect(list.h[i]).toBeLessThanOrEqual(2.1 + 1e-4); }
      }
      expect(near).toBeGreaterThan(20);
    }
  });

  it('click picking reads the scaled heights: a ray down onto the tallest giant hits it near its own top', () => {
    const l = CARBON_DEF().list, sh = shapesOf();
    let t = -1;
    for (let i = 0; i < l.n; i++) if (ARCHETYPE_META[l.arch[i]].role === 'giant' && (t < 0 || l.h[i] > l.h[t])) t = i;
    expect(t).toBeGreaterThanOrEqual(0);
    const rph = lib.archetypes.map((a) => a.radius / a.size);
    const hit = rayPlants(l, rph, { x: l.x[t], y: l.y[t] + 200, z: l.z[t] }, { x: 0, y: -1, z: 0 }, 400, 0.03, 1, sh.height);
    expect(hit).not.toBeNull();
    const top = l.y[t] - 0.03 * l.h[t] - l.sink[t] + l.h[t] * sh.height[l.arch[t]];
    expect(Math.abs(l.y[t] + 200 - hit!.dist - top)).toBeLessThan(0.15 * l.h[t]);
  });
});
