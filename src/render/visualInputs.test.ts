import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { controls } from '../worlds/controls';
import { livingBands } from '../sim/limits';
import type { SimSnapshot, WorldConfig } from '../worlds/types';
import { buildVisualInputs, flatTerrain, GRID, heatSolvent, lifeOnLand, terrainState, type TerrainSampler } from './visualInputs';

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
