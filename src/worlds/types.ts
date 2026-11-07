// Shared data contract (CLAUDE.md "Data contract"). Change only by agreement: sim, worlds, render, UI and player all build against it.
import type { LifeRules } from '../sim/population';
import type { AnimalGenome } from '../sim/genome';

export type WorldId = 'carbon' | 'silicon';
export type WorldStatus = 'known' | 'speculative';
export type ControlId = 'temperature' | 'nitrogen' | 'oxygen';

export interface Sourced {
  why: string;             // one plain sentence shown in the UI
  sources: string[];       // ids into sources.ts; may be empty only if assumption is true
  assumption?: boolean;    // true if not directly sourced; tracked in a GitHub issue
}

export interface StatDef extends Sourced { id: string; label: string; unit: string; earthValue: number }
export interface FactDef extends Sourced { id: string; label: string; value: string; earthValue: string }
export interface FeatureDef extends Sourced { name: string; description: string; statIds: string[]; factIds: string[] }

export type InspectKind = 'organism' | 'producer' | 'sea' | 'ground' | 'sky';
export type InspectTarget =
  | { kind: 'organism'; organismId: number }
  | { kind: 'producer'; cell: number }       // index into the 64² world grid
  | { kind: 'sea' | 'ground' | 'sky' };

/** One fast build: Generate → living world in ~20 s, then live. */
export interface BuildConfig extends Sourced {
  durationSec: number;          // ~20
  spawnSec: number;             // ~6: ground solid, character spawns
  seasSec: [number, number];    // when seas fill, in build seconds
  lifeSec: number;              // when founders appear
  ecologySec: number;           // ecology-seconds reached by build end (~340 on carbon); the worker's fixed tick schedule hits it
  yearsShown: number;           // illustrative years-counter end value
  captions: { start: string; life: string };
}

export interface Feedback extends Sourced {  // change driven by life
  id: string;
  statId: string;
  driver: string;             // population quantity, e.g. 'producerBiomass'
  rate: number;               // change in stat per unit driver per ecology second
}

export interface DerivedStat extends Sourced {  // recomputed every tick, never integrated
  statId: string;
  model: 'radiativeBalance' | 'vapourPressure' | 'partialPressures' | 'seaVolume';
  inputs: string[];
  params: Record<string, number>;
}

export interface Solvent {
  name: string;
  freezeC: number;
  criticalC: number;
  solidSinks: boolean;                  // water ice floats (false); nitrogen ice sinks (true)
  vapourPressure: [number, number][];   // [°C, bar], interpolated
  sources: string[];
}

export interface ControlDef {
  id: ControlId;
  label: string;
  unit: string;
  min: number;
  max: number;
  scale: 'linear' | 'log';
  moves: 'orbitDistance' | 'nitrogenInventory' | 'oxygenInventory';
  hint: string;
  default: number;            // 15 °C, 1 × Earth, 21 %
}

export type BoxEffect = 'freeze' | 'shakeApart' | 'dryUp' | 'starve' | 'rust';
export interface LethalLimit extends Sourced {
  id: string;
  statId: string;
  side: 'below' | 'above';
  model: 'fixed' | 'solventFreezes' | 'solventCritical' | 'seasEmpty';
  params: Record<string, number>;
  reason: string;
  boxEffect: BoxEffect;
}

export interface LivingBand {
  low: number;
  high: number;
  lowLimitId?: string;
  highLimitId?: string;
  empty?: boolean;
  blockingLimitId?: string;
}

export interface TerrainConfig extends Sourced {
  patchSize: number;                  // metres
  base: Record<string, number>;       // fBm amplitude, octaves, warp…
  spawn: { shoreDistance: number };   // metres from spawn to the build's shoreline
  heatSolventSpan: number;            // °C mapped onto heatSolvent 0..1 (0.5 = solvent freezing point)
  machines: { id: 'M2' | 'M3' | 'M4' | 'M5' | 'M6'; rate: number; params: Record<string, number> }[];
  relics?: { kind: 'iceArch' | 'iceSpire'; count: number; params: Record<string, number> }[];   // silicon only; seeded
}

export interface LifeInputs {
  solvent: Sourced & { rho: number; mu: number; epsilonR: number; liquidBandC: [number, number] };
  airDensity: Sourced & { scale: number };       // × live P·M/(R·T) into develop()'s scale (unbuoyed carbon tissue = 1)
  tissueDensity: Sourced & { C: number; Si: number };
  scalings: Record<string, number>;              // our stats → F's heat, light and hunger ranges
}

export interface WorldConfig {
  id: WorldId;
  displayName: string;
  status: WorldStatus;
  demoSeed: number;
  reasoning: { text: string; sources: string[]; assumption?: boolean }[];
  caveat?: string;
  ranges: Record<string, [number, number]>;
  startDefaults: Record<ControlId, number>;
  targets: Record<string, [number, number]>;   // stats at the end of the build with the demo seed; tested
  solvent: Solvent;
  stats: StatDef[];
  facts: FactDef[];
  features: Record<InspectKind, FeatureDef>;
  build: BuildConfig;
  feedbacks: Feedback[];
  derived: DerivedStat[];
  limits: LethalLimit[];
  life: {
    rules: LifeRules;
    composition: { c: number; si: number; o: number };
    ledger: Record<string, number>;
    inputs: LifeInputs;
  };
  terrain: TerrainConfig;
  starType: string;
}

export type Conditions = Record<ControlId, number>;

export interface SimSnapshot {          // 20 Hz
  worldId: WorldId;
  timeSec: number;                      // seconds since Generate
  buildProgress: number;                // 0..1
  yearsShown: number;                   // illustrative counter
  stats: Record<string, number>;        // every StatDef id (incl. seaCover) plus 'seaLevel' in metres
  population: { producers: number; consumers: number };
  generation: number;
  traitAverages: Record<string, number>;
  organisms: Float32Array;              // layout in sim/organismLayout.ts
  flora: Float32Array;                  // per-cell flora biomass (mat, canopy) on the 64² grid
  births: { id: number; plan: Float32Array }[];
  controls: Conditions;
  bands: Record<ControlId, LivingBand>;
}

export interface NewFormEvent { binId: number; name: string; organismId: number }

/** Typed bus events (CLAUDE.md "Bus events"). */
export interface BusEvents {
  'selection:changed': { worldId: WorldId; conditions: Conditions };
  'world:selected': { worldId: WorldId; requested: Conditions };
  'build:life': { worldId: WorldId };
  'build:complete': { worldId: WorldId };
  'sim:snapshot': SimSnapshot;
  'control:set': { controlId: ControlId; value: number };
  'control:blocked': { controlId: ControlId; limitId: string; start?: true };   // start: moved by startingConditions at world start
  'guide:newForm': NewFormEvent;
  'inspect:open': { target: InspectTarget; at: { x: number; y: number } };
  'inspect:window': { x: number; y: number; width: number; height: number } | null;
  'inspect:close': Record<string, never>;
}

/** Read-only inputs the art layer consumes each frame (CLAUDE.md "Logic → art interface"). */
export interface VisualInputs {
  world: Pick<WorldConfig, 'id' | 'status' | 'starType' | 'solvent'> & { composition: WorldConfig['life']['composition'] };
  stats: Record<string, number>;
  seaLevel: number;
  frozen: boolean;
  heatBand: number;
  heatSolvent: number;
  light: number;
  airDensity: number;
  buildProgress: number;
  terrain: { rise: number; progress: Record<string, number>; height: (x: number, z: number) => number };
  organisms: Float32Array;
  births: SimSnapshot['births'];
  flora: Float32Array;
  lifeOnLand: boolean;
}

export type { AnimalGenome };
