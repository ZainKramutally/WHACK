// Assembles VisualInputs (CLAUDE.md "Logic → art interface") from the latest SimSnapshot + WorldConfig + a terrain sampler.
// Pure: no DOM, no three.js. The art layer only ever reads the VisualInputs shape.
import { gasDensity } from '../sim/models';
import type { MineralDef, SimSnapshot, VisualInputs, WorldConfig } from '../worlds/types';

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
  /** gen/terrain.ts Terrain.crustWeights: mineral weights at (x, z) in crust config order (absent on flat ground). */
  crustWeights?(x: number, z: number): number[];
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

/**
 * Last terrain state seen. While the sampler object, patchSize, rise, heatSolvent and every progress entry are
 * unchanged, `terrain.height` is a pure function of (x, z), so the VisualInputs `terrain` object (and its `height`
 * identity, which floraForm's ground cache keys on) is reused, as are the lazily sampled cell-centre heights.
 */
interface TerrainMemo {
  sampler: TerrainSampler;
  patchSize: number;
  state: TerrainState; // private copy for comparison and for the height closure
  terrain: VisualInputs['terrain'];
  ground: Float64Array; // NaN = not sampled yet
}
let memo: TerrainMemo | null = null;
const CRUST = new WeakMap<TerrainSampler, NonNullable<VisualInputs['terrain']['crust']>>();

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Same own-key set, primitives ===, nested plain objects compared the same way (so any future TerrainState field is covered). */
function sameValue(a: unknown, b: unknown): boolean {
  if (!isObj(a) || !isObj(b)) return a === b;
  if (a === b) return true;
  const la = a as unknown as ArrayLike<unknown>, lb = b as unknown as ArrayLike<unknown>;
  const arrA = Array.isArray(a) || ArrayBuffer.isView(a), arrB = Array.isArray(b) || ArrayBuffer.isView(b);
  if (arrA || arrB) {
    if (!arrA || !arrB || la.length !== lb.length) return false;
    for (let i = 0; i < la.length; i++) if (!sameValue(la[i], lb[i])) return false;
    return true;
  }
  let n = 0;
  for (const k in b) {
    if (!has(b, k)) continue;
    if (!has(a, k) || !sameValue(a[k], b[k])) return false;
    n++;
  }
  for (const k in a) if (has(a, k)) n--;
  return n === 0;
}

function copyValue<T>(v: T): T {
  if (!isObj(v)) return v;
  if (Array.isArray(v)) return v.map(copyValue) as T;
  if (ArrayBuffer.isView(v)) return (v as unknown as { slice(): T }).slice();
  const out: Record<string, unknown> = {};
  for (const k in v) if (has(v, k)) out[k] = copyValue(v[k]);
  return out as T;
}

function terrainMemo(sampler: TerrainSampler, state: TerrainState, minerals?: readonly MineralDef[]): TerrainMemo {
  // the crust map is static per sampler (one world, one seed): one object per sampler, so its identity keys the flora
  // mineral grid (floraLib/place.ts) across rebuilds and frames
  const crustOf = () => {
    if (!minerals?.length || !sampler.crustWeights) return undefined;
    let c = CRUST.get(sampler);
    if (!c) { c = { minerals, weights: (x: number, z: number) => sampler.crustWeights!(x, z) }; CRUST.set(sampler, c); }
    return c;
  };
  if (memo && memo.sampler === sampler && memo.patchSize === sampler.patchSize && sameValue(memo.state, state)) {
    if (minerals && !memo.terrain.crust) memo.terrain.crust = crustOf();   // a memo first built by lifeOnLand (no world to hand)
    return memo;
  }
  const frozen = copyValue(state); // closure must not see later mutation of the caller's state
  const crust = crustOf();
  memo = {
    sampler,
    patchSize: sampler.patchSize,
    state: copyValue(state),
    terrain: { rise: state.rise, progress: state.progress, height: (x, z) => sampler.height(x, z, frozen), patchSize: sampler.patchSize, crust,
      crustWeights: sampler.crustWeights ? (x, z) => sampler.crustWeights!(x, z) : undefined },
    ground: new Float64Array(GRID * GRID).fill(NaN),
  };
  return memo;
}

/** The run's crust for the art layer: realised shares by argmax over the 64² cell centres (the same rule as gen/crust.ts crustMap). Built once per sampler and world. */
const crustCache = new WeakMap<object, { minerals: unknown; crust: NonNullable<VisualInputs['world']['crust']> }>();
function crustOf(world: WorldConfig, sampler: TerrainSampler): VisualInputs['world']['crust'] {
  const minerals = world.terrain.crust?.minerals;
  if (!minerals || !sampler.crustWeights) return undefined;
  const hit = crustCache.get(sampler);
  if (hit && hit.minerals === minerals) return hit.crust;
  const S = sampler.patchSize, counts = new Array<number>(minerals.length).fill(0);
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const w = sampler.crustWeights(((col + 0.5) / GRID - 0.5) * S, ((row + 0.5) / GRID - 0.5) * S);
      let best = 0;
      for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
      counts[best]++;
    }
  }
  const crust = { ids: minerals.map((m) => m.id), oxidises: minerals.map((m) => m.oxidises), shares: counts.map((c) => c / (GRID * GRID)), elevation: minerals.map((m) => m.elevation) };
  crustCache.set(sampler, { minerals, crust });
  return crust;
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
  const m = terrainMemo(terrain, state);
  const ground = m.ground;
  for (let cell = 0; cell < GRID * GRID; cell++) {
    let biomass = 0;
    for (let k = 0; k < stride; k++) biomass += flora[cell * stride + k];
    if (!(biomass > 0)) continue;
    let h = ground[cell];
    if (h !== h) {
      const i = cell % GRID;
      const j = (cell - i) / GRID;
      h = terrain.height(((i + 0.5) / GRID - 0.5) * S, ((j + 0.5) / GRID - 0.5) * S, state);
      ground[cell] = h;
    }
    if (h > seaLevel) return true;
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
      rustOxygen: world.terrain.crust?.rustOxygen,
      composition: world.life.composition,
      crust: crustOf(world, terrain),
    },
    stats,
    seaLevel,
    frozen: t < world.solvent.freezeC,
    heatBand: heatBand(snapshot),
    heatSolvent: state.heatSolvent,
    light: stats.light ?? 1,
    airDensity: world.life.inputs.airDensity.scale * gasDensity(stats.pressure, t, world.life.inputs.airDensity.molarMass),
    buildProgress: snapshot.buildProgress,
    terrain: terrainMemo(terrain, state, world.terrain.crust?.minerals).terrain,
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
    airDensity: 0.06,   // VisualInputs units: Earth's 1.2 kg/m³ × the shared airDensity.scale 0.05 (not raw kg/m³)
    buildProgress: 1,
    terrain: { rise: 1, progress: {}, height: () => 0 },
    organisms: new Float32Array(0),
    births: [],
    flora: new Float32Array(0),
    lifeOnLand: false,
  };
}
