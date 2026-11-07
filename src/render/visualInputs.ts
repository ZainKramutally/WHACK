// Assembles VisualInputs (CLAUDE.md "Logic → art interface") from the latest SimSnapshot + WorldConfig + a terrain sampler.
// Pure: no DOM, no three.js. The art layer only ever reads the VisualInputs shape.
import { gasDensity } from '../sim/models';
import type { SimSnapshot, VisualInputs, WorldConfig } from '../worlds/types';

/** Inputs that move the terrain (same shape as gen/terrain.ts TerrainState). */
export interface TerrainState {
  rise: number;
  progress: Record<string, number>;
  heatSolvent: number;
}

/** What buildVisualInputs needs from a terrain. Structurally satisfied by gen/terrain.ts `Terrain`. */
export interface TerrainSampler {
  patchSize: number;
  height(x: number, z: number, state: TerrainState): number;
}

/** Flat ground placeholder until src/gen/terrain.ts is wired in (see main.ts `createTerrainSampler`). */
export const flatTerrain: TerrainSampler = { patchSize: 400, height: () => 0 };

/** The world grid is 64² (CLAUDE.md "One 64² world grid"). */
export const GRID = 64;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Temperature position inside the living band: 0 = lower edge, 1 = upper edge. 0.5 if the band is unusable. */
export function heatBand(snapshot: SimSnapshot): number {
  const band = snapshot.bands.temperature;
  const t = snapshot.stats.temperature;
  if (!band || band.empty || !(band.high > band.low)) return 0.5;
  return clamp01((t - band.low) / (band.high - band.low));
}

/** Temperature normalised so 0.5 sits at the solvent's freezing point, `span` °C spanning 0..1. */
export function heatSolvent(tempC: number, freezeC: number, span: number): number {
  return clamp01(0.5 + (tempC - freezeC) / span);
}

/** Terrain state during/after the build: rise and every machine's progress follow buildProgress (CLAUDE.md "The build"). */
export function terrainState(snapshot: SimSnapshot, world: WorldConfig): TerrainState {
  const p = snapshot.buildProgress;
  const progress: Record<string, number> = {};
  for (const m of world.terrain.machines) progress[m.id] = p;
  return {
    rise: p,
    progress,
    heatSolvent: heatSolvent(snapshot.stats.temperature, world.solvent.freezeC, world.terrain.heatSolventSpan),
  };
}

/** True once any land cell (ground above sea level) has flora biomass. Grid is row-major, z outer, centred on the patch. */
export function lifeOnLand(
  flora: Float32Array,
  seaLevel: number,
  terrain: TerrainSampler,
  state: TerrainState,
): boolean {
  const stride = Math.floor(flora.length / (GRID * GRID)); // 1 (biomass) or 2 (mat, canopy) per cell
  if (stride < 1) return false;
  const S = terrain.patchSize;
  for (let cell = 0; cell < GRID * GRID; cell++) {
    let biomass = 0;
    for (let k = 0; k < stride; k++) biomass += flora[cell * stride + k];
    if (!(biomass > 0)) continue;
    const i = cell % GRID;
    const j = (cell - i) / GRID;
    const x = ((i + 0.5) / GRID - 0.5) * S;
    const z = ((j + 0.5) / GRID - 0.5) * S;
    if (terrain.height(x, z, state) > seaLevel) return true;
  }
  return false;
}

/** Births queued from snapshots that arrived between frames; drained once so no creature misses its body plan. */
export function drainBirths(queue: SimSnapshot['births']): SimSnapshot['births'] {
  return queue.splice(0, queue.length);
}

/** `births` overrides the snapshot's own (pass the drained queue so births from skipped snapshots are not lost). */
export function buildVisualInputs(
  snapshot: SimSnapshot,
  world: WorldConfig,
  terrain: TerrainSampler,
  births: SimSnapshot['births'] = snapshot.births,
): VisualInputs {
  const stats = snapshot.stats;
  const state = terrainState(snapshot, world);
  const seaLevel = stats.seaLevel ?? 0;
  const t = stats.temperature;
  return {
    world: {
      id: world.id,
      status: world.status,
      starType: world.starType,
      solvent: world.solvent,
      composition: world.life.composition,
    },
    stats,
    seaLevel,
    frozen: t < world.solvent.freezeC,
    heatBand: heatBand(snapshot),
    heatSolvent: state.heatSolvent,
    light: stats.light ?? 1,
    airDensity: world.life.inputs.airDensity.scale * gasDensity(stats.pressure, t, world.life.inputs.airDensity.molarMass),
    buildProgress: snapshot.buildProgress,
    terrain: { rise: state.rise, progress: state.progress, height: (x, z) => terrain.height(x, z, state) },
    organisms: snapshot.organisms,
    births,
    flora: snapshot.flora,
    lifeOnLand: lifeOnLand(snapshot.flora, seaLevel, terrain, state),
  };
}

/** Placeholder source used before the first snapshot arrives. */
export function makeStubVisualInputs(): VisualInputs {
  return {
    world: {
      id: 'carbon',
      status: 'known',
      starType: 'G-type',
      solvent: { name: 'Water', freezeC: 0, criticalC: 374, solidSinks: false, vapourPressure: [[0, 0.006], [100, 1.013]], sources: [] },
      composition: { c: 0.8, si: 0.0, o: 0.2 },
    },
    stats: { temperature: 15, pressure: 1, oxygen: 21, nitrogen: 1, seaCover: 70, seaLevel: 0 },
    seaLevel: 0,
    frozen: false,
    heatBand: 0.5,
    heatSolvent: 0.65,
    light: 1,
    airDensity: 1.2,
    buildProgress: 1,
    terrain: { rise: 1, progress: {}, height: () => 0 },
    organisms: new Float32Array(0),
    births: [],
    flora: new Float32Array(0),
    lifeOnLand: false,
  };
}
