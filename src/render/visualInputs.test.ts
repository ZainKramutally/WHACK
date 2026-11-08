import { describe, expect, it, vi } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { controls } from '../worlds/controls';
import { livingBands } from '../sim/limits';
import type { SimSnapshot, WorldConfig } from '../worlds/types';
import { buildVisualInputs, drainBirths, flatTerrain, GRID, heatSolvent, lifeOnLand, terrainState, type TerrainSampler, type TerrainState } from './visualInputs';

function snap(world: WorldConfig, over: Partial<SimSnapshot> & { stats?: Record<string, number> } = {}): SimSnapshot {
  const cond = { temperature: world.id === 'carbon' ? 15 : -183, nitrogen: world.id === 'carbon' ? 1 : 30, oxygen: world.id === 'carbon' ? 21 : 0 };
  return {
    worldId: world.id,
    timeSec: 10,
    buildProgress: 0.5,
    yearsShown: 0,
    stats: { temperature: cond.temperature, pressure: world.id === 'carbon' ? 1 : 3.6, light: 1, seaLevel: 2, ...over.stats },
    population: { producers: 0, consumers: 0 },
    generation: 0,
    traitAverages: {},
    organisms: new Float32Array(0),
    flora: new Float32Array(0),
    births: [],
    kills: [],
    controls: cond,
    bands: livingBands(world, cond, { controls: Object.values(controls) }),
    ...over,
  } as SimSnapshot;
}

describe('buildVisualInputs', () => {
  it('derives frozen, heatSolvent and rise/progress from the snapshot', () => {
    const v = buildVisualInputs(snap(carbon, { buildProgress: 0.4, stats: { temperature: -5, pressure: 1 } }), carbon, flatTerrain);
    expect(v.frozen).toBe(true);
    expect(v.heatSolvent).toBeCloseTo(0.5 - 5 / carbon.terrain.heatSolventSpan);
    expect(v.terrain.rise).toBe(0.4);
    for (const m of carbon.terrain.machines) expect(v.terrain.progress[m.id]).toBe(0.4);
    expect(v.buildProgress).toBe(0.4);
  });

  it('puts heatSolvent at 0.5 exactly at the solvent freezing point, for both worlds', () => {
    expect(heatSolvent(0, 0, 120)).toBe(0.5);
    expect(heatSolvent(silicon.solvent.freezeC, silicon.solvent.freezeC, silicon.terrain.heatSolventSpan)).toBe(0.5);
    expect(heatSolvent(1e6, 0, 120)).toBe(1);
    expect(heatSolvent(-1e6, 0, 120)).toBe(0);
  });

  it('normalises heatBand inside the living band', () => {
    const s = snap(carbon);
    const b = s.bands.temperature;
    const v = buildVisualInputs({ ...s, stats: { ...s.stats, temperature: b.low } }, carbon, flatTerrain);
    expect(v.heatBand).toBe(0);
    expect(buildVisualInputs({ ...s, stats: { ...s.stats, temperature: b.high } }, carbon, flatTerrain).heatBand).toBe(1);
    expect(buildVisualInputs({ ...s, stats: { ...s.stats, temperature: (b.low + b.high) / 2 } }, carbon, flatTerrain).heatBand).toBeCloseTo(0.5);
  });

  it('heatBand falls back to 0.5 for an empty band', () => {
    const s = snap(carbon);
    s.bands.temperature = { low: 0, high: 0, empty: true };
    expect(buildVisualInputs(s, carbon, flatTerrain).heatBand).toBe(0.5);
  });

  it('scales real gas density: silicon air is much denser than carbon air', () => {
    const c = buildVisualInputs(snap(carbon), carbon, flatTerrain).airDensity;
    const s = buildVisualInputs(snap(silicon), silicon, flatTerrain).airDensity;
    expect(c).toBeCloseTo(carbon.life.inputs.airDensity.scale * 1.18, 1);
    expect(s / silicon.life.inputs.airDensity.scale).toBeGreaterThan(10);
    expect(s).toBeGreaterThan(c);
  });

  it('light defaults to 1 and seaLevel to 0 if the snapshot lacks them', () => {
    const s = snap(carbon);
    delete s.stats.light;
    delete s.stats.seaLevel;
    const v = buildVisualInputs(s, carbon, flatTerrain);
    expect(v.light).toBe(1);
    expect(v.seaLevel).toBe(0);
  });

  it('terrain.height closes over the build state', () => {
    const t: TerrainSampler = { patchSize: 400, height: (_x, _z, st) => 10 * st.rise };
    const v = buildVisualInputs(snap(carbon, { buildProgress: 0.3 }), carbon, t);
    expect(v.terrain.height(5, 5)).toBeCloseTo(3);
  });
});

describe('lifeOnLand', () => {
  const state = terrainState(snap(carbon), carbon);
  // Left half of the patch (x < 0) is land at height 5, right half is seabed at -5.
  const split: TerrainSampler = { patchSize: 400, height: (x) => (x < 0 ? 5 : -5) };
  const cellAt = (i: number, j: number) => j * GRID + i;

  it('is false with no flora', () => {
    expect(lifeOnLand(new Float32Array(GRID * GRID * 2), 0, split, state)).toBe(false);
    expect(lifeOnLand(new Float32Array(0), 0, split, state)).toBe(false);
  });
  it('is false when flora is only underwater', () => {
    const f = new Float32Array(GRID * GRID * 2);
    f[cellAt(60, 10) * 2] = 1;
    expect(lifeOnLand(f, 0, split, state)).toBe(false);
  });
  it('is true once a land cell has biomass (mat or canopy)', () => {
    const f = new Float32Array(GRID * GRID * 2);
    f[cellAt(3, 10) * 2 + 1] = 0.2;
    expect(lifeOnLand(f, 0, split, state)).toBe(true);
  });
  it('works with one value per cell', () => {
    const f = new Float32Array(GRID * GRID);
    f[cellAt(3, 10)] = 1;
    expect(lifeOnLand(f, 0, split, state)).toBe(true);
  });
});

describe('births queue', () => {
  const b = (id: number) => ({ id, plan: new Float32Array(1) });

  it('drainBirths returns everything queued across snapshots, once', () => {
    const q = [b(1), b(2), b(3)]; // births from three snapshots that arrived between two frames
    expect(drainBirths(q).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(q).toHaveLength(0);
    expect(drainBirths(q)).toEqual([]);
  });

  it('buildVisualInputs uses the drained births, not just the latest snapshot\'s', () => {
    const s = snap(carbon);
    s.births = [b(9)];
    expect(buildVisualInputs(s, carbon, flatTerrain).births.map((x) => x.id)).toEqual([9]);
    expect(buildVisualInputs(s, carbon, flatTerrain, [b(1), b(2), b(9)]).births.map((x) => x.id)).toEqual([1, 2, 9]);
    expect(buildVisualInputs(s, carbon, flatTerrain, []).births).toEqual([]);
  });
});

describe('terrain memo', () => {
  const mk = (): TerrainSampler => ({ patchSize: 400, height: (x, z, s) => Math.sin(x * 0.05 + s.rise) + Math.cos(z * 0.04) * (s.progress.M2 ?? 1) + s.heatSolvent });
  const run = (sampler: TerrainSampler, over: Partial<SimSnapshot> & { stats?: Record<string, number> } = {}) =>
    buildVisualInputs(snap(carbon, { buildProgress: 0.5, ...over }), carbon, sampler);

  it('keeps height identity while terrain state is unchanged, with identical values', () => {
    const s = mk();
    const a = run(s), b = run(s);
    expect(b.terrain).toBe(a.terrain);
    expect(b.terrain.height).toBe(a.terrain.height);
    expect(b.terrain.height(10, 20)).toBe(s.height(10, 20, terrainState(snap(carbon, { buildProgress: 0.5 }), carbon)));
  });

  it('carries the sampler\'s crustWeights (fresh per sampler) and builds the crust once per sampler', () => {
    const n = carbon.terrain.crust!.minerals.length;
    const withW = (k: number): TerrainSampler => ({ ...mk(), crustWeights: () => Array.from({ length: n }, (_, i) => (i === k ? 1 : 0)) });
    const s = withW(1);
    const a = run(s), b = run(s);
    expect(a.terrain.crustWeights).toBeDefined();
    expect(b.terrain).toBe(a.terrain);
    expect(b.world.crust).toBe(a.world.crust);   // stable identity: palette memos key on it
    expect(a.world.crust!.shares[1]).toBe(1);
    const c = run(withW(2));
    expect(c.terrain.crustWeights).not.toBe(a.terrain.crustWeights);
    expect(c.world.crust!.shares[2]).toBe(1);   // a new sampler never reuses stale weights
    expect(run(mk()).world.crust).toBeUndefined();
  });

  it('changes identity when rise, heatSolvent, or the sampler changes', () => {
    const s = mk();
    const a = run(s);
    expect(run(s, { buildProgress: 0.6 }).terrain.height).not.toBe(a.terrain.height);
    expect(run(s, { stats: { temperature: 30 } }).terrain.height).not.toBe(run(s).terrain.height);
    expect(run(mk()).terrain.height).not.toBe(run(s).terrain.height);
  });

  it('changes identity when a progress value or key set changes', () => {
    const s = mk();
    const call = (ids: string[], p: number) => {
      const w = { ...carbon, terrain: { ...carbon.terrain, machines: ids.map((id) => ({ ...carbon.terrain.machines[0], id: id as never })) } } as WorldConfig;
      return buildVisualInputs(snap(w, { buildProgress: p }), w, s).terrain.height;
    };
    const h0 = call(['M2'], 0.5);
    expect(call(['M2'], 0.5)).toBe(h0);
    expect(call(['M2'], 0.5 + 1e-9)).not.toBe(h0); // value (rise moves too, so also check below)
    expect(call(['M2', 'M9'], 0.5)).not.toBe(call(['M2'], 0.5));
    expect(call(['M9'], 0.5)).not.toBe(call(['M2'], 0.5));
  });

  it('lifeOnLand matches a direct-sampling oracle across a sweep, incl. all-underwater and moving seaLevel', () => {
    const s: TerrainSampler = { patchSize: 400, height: (x, z) => (x + z) / 100 };
    const st = terrainState(snap(carbon), carbon);
    const oracle = (f: Float32Array, sea: number) => {
      for (let c = 0; c < GRID * GRID; c++) {
        if (!(f[c * 2] + f[c * 2 + 1] > 0)) continue;
        const x = (((c % GRID) + 0.5) / GRID - 0.5) * 400, z = ((Math.floor(c / GRID) + 0.5) / GRID - 0.5) * 400;
        if (s.height(x, z, st) > sea) return true;
      }
      return false;
    };
    for (const cells of [[0], [5, 70], [GRID * GRID - 1], [GRID * 32 + 32], []]) {
      const f = new Float32Array(GRID * GRID * 2);
      for (const c of cells) f[c * 2] = 1;
      for (let sea = -6; sea <= 6; sea += 0.37) expect(lifeOnLand(f, sea, s, st)).toBe(oracle(f, sea));
    }
  });

  it('repeat lifeOnLand with unchanged state makes no height calls', () => {
    const s = mk();
    const spy = vi.spyOn(s, 'height');
    const f = new Float32Array(GRID * GRID * 2).fill(1);
    const first = lifeOnLand(f, 1e9, s, terrainState(snap(carbon), carbon)); // all underwater: scans every cell
    expect(spy.mock.calls.length).toBe(GRID * GRID);
    expect(lifeOnLand(f, 1e9, s, terrainState(snap(carbon), carbon))).toBe(first);
    expect(spy.mock.calls.length).toBe(GRID * GRID);
  });

  it('re-samples when an unknown extra top-level state field changes (memo is keyed generically)', () => {
    const s = mk();
    const st = (extra: number) => ({ ...terrainState(snap(carbon), carbon), extra }) as TerrainState & { extra: number };
    const f = new Float32Array(GRID * GRID * 2).fill(1);
    const spy = vi.spyOn(s, 'height');
    lifeOnLand(f, 1e9, s, st(1));
    lifeOnLand(f, 1e9, s, st(1));
    expect(spy.mock.calls.length).toBe(GRID * GRID);
    lifeOnLand(f, 1e9, s, st(2));
    expect(spy.mock.calls.length).toBe(2 * GRID * GRID);
  });

  it('compares array and typed-array state fields by length and elements', () => {
    const s = mk();
    const st = (a: number[], t: Float32Array) => ({ ...terrainState(snap(carbon), carbon), a, t }) as TerrainState;
    const f = new Float32Array(GRID * GRID * 2).fill(1);
    const spy = vi.spyOn(s, 'height');
    lifeOnLand(f, 1e9, s, st([1, 2], new Float32Array([1])));
    lifeOnLand(f, 1e9, s, st([1, 2], new Float32Array([1])));
    expect(spy.mock.calls.length).toBe(GRID * GRID);
    lifeOnLand(f, 1e9, s, st([1, 2, 3], new Float32Array([1])));
    lifeOnLand(f, 1e9, s, st([1, 2, 3], new Float32Array([2])));
    expect(spy.mock.calls.length).toBe(3 * GRID * GRID);
  });
});

describe('crust map in VisualInputs', () => {
  const W = (x: number) => [x > 0 ? 1 : 0, x > 0 ? 0 : 1, 0];
  const crusty = (): TerrainSampler => ({ patchSize: 400, height: () => 0, crustWeights: (x) => W(x) });

  it('carries the world crust minerals and the sampler weights; absent on flat ground', () => {
    const v = buildVisualInputs(snap(silicon), silicon, crusty());
    expect(v.terrain.crust?.minerals.map((m) => m.id)).toEqual(silicon.terrain.crust.minerals.map((m) => m.id));
    expect(v.terrain.crust?.weights(5, 0)).toEqual([1, 0, 0]);
    expect(buildVisualInputs(snap(silicon), silicon, flatTerrain).terrain.crust).toBeUndefined();
  });

  it('a memo first built by lifeOnLand still gets the crust', () => {
    const s = crusty(), sn = snap(silicon);
    lifeOnLand(new Float32Array(GRID * GRID * 2), 0, s, terrainState(sn, silicon));
    expect(buildVisualInputs(sn, silicon, s).terrain.crust?.weights(-5, 0)).toEqual([0, 1, 0]);
  });

  it('keeps one crust object per sampler across terrain rebuilds (it keys the flora mineral grid)', () => {
    const s = crusty();
    const a = buildVisualInputs(snap(silicon, { buildProgress: 0.3 }), silicon, s).terrain;
    const b = buildVisualInputs(snap(silicon, { buildProgress: 0.6 }), silicon, s).terrain;
    expect(b).not.toBe(a);
    expect(b.crust).toBe(a.crust);
    expect(buildVisualInputs(snap(silicon), silicon, crusty()).terrain.crust).not.toBe(a.crust);
  });
});
