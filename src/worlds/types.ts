// Shared data contract (CLAUDE.md "Data contract"). Change only by agreement: sim, worlds, render, UI and player all build against it.
import type { LifeRules } from '../sim/population';
import type { AnimalGenome } from '../sim/genome';
import type { BodyPlan } from '../sim/develop';

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
  | { kind: 'ground'; point?: { x: number; z: number } }   // world metres of the clicked spot, so the card can name the mineral there
  | { kind: 'sea' | 'sky' };

/** One fast build: Generate → living world in ~20 s, then live. */
export interface BuildConfig extends Sourced {
  durationSec: number;          // ~20
  spawnSec: number;             // ~6: ground solid, character spawns
  seasSec: [number, number];    // when seas fill, in build seconds
  lifeSec: number;              // when founders appear
  ecologySec: number;           // ecology-seconds reached by build end (~340 on carbon); the worker's fixed tick schedule hits it
  yearsShown: number;           // illustrative years-counter end value
  liveYearsPerEcologySec: number; // illustrative: years the counter adds per ecology-second after the build, so it keeps rising
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
  model: 'radiativeBalance' | 'vapourPressure' | 'partialPressures' | 'seaVolume' | 'seaFreeboard';
  inputs: string[];
  params: Record<string, number>;
}

export interface Solvent {
  name: string;
  freezeC: number;
  criticalC: number;
  solidSinks: boolean;                  // water ice floats (false); nitrogen ice sinks (true)
  vapourPressure: [number, number][];   // [°C, bar], interpolated
  fixedPoints?: {                       // reference values for the UI and tests; not read by the sim
    triplePressureBar: number;
    criticalPressureBar: number;
    liquidDensityAtTripleKgM3: number;
  };
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

/** The rock chips every world shows (CRUST_PICKS in controls.ts); chip id = mineral id (every world has all five minerals; absent ones have share [0, 0] until picked). */
export type CrustPickId = 'basalt' | 'granite' | 'ironstone' | 'silicide' | 'nitride';

/** One kind of rock in a world's crust (docs/features/crust.md). Colours are art-layer decisions, keyed by `id`. */
export interface MineralDef extends Sourced {
  id: string;                                    // e.g. 'basalt', 'granite', 'silicide', 'nitride', 'waterIce'
  label: string;                                 // sentence case, e.g. 'Basalt'
  description: string;                           // one plain sentence for the ground inspect card
  share: [number, number];                       // bounds on its share of the patch; the realised share is sampled from the world seed
  elevation: number;                             // 0..1 by height rank in the patch: 0 = lowest ground, 1 = highest
  supply: { c: number; si: number; o: number };  // nutrient multiplier per cell (1 = the world's base life.ledger supply); the patch mean is renormalised to base
  oxidises: boolean;                             // reacts with free oxygen (iron-bearing rock rusts; silicide turns to silica)
  pick?: { hint: string };                       // selection-screen rock chip hint (the chip id is the mineral id); world-specific
  favour?: number;                               // overrides crust.favour when this mineral is picked (used where a pick at the default share would kill life)
}

export interface CrustConfig extends Sourced {
  minerals: MineralDef[];                        // at least one; ids unique
  patchCells: number;                            // typical mineral patch size, in grid cells (noise scale of the map)
  rustOxygen: number;                            // oxygen % at which oxidising rock is fully oxidised at the surface
  defaultPick?: CrustPickId;                     // rock chip selected on the selection screen until the player touches a chip
  favour: number;                               // share of the patch a picked rock takes (the other minerals share the rest by their midpoints)
}

export interface TerrainConfig extends Sourced {
  patchSize: number;                  // metres
  base: Record<string, number>;       // fBm amplitude, octaves, warp…
  spawn: { shoreDistance: number };   // metres from spawn to the build's shoreline
  heatSolventSpan: number;            // °C mapped onto heatSolvent 0..1 (0.5 = solvent freezing point)
  machines: { id: 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9'; rate: number; params: Record<string, number>; minerals?: string[] }[];   // minerals: crust ids the machine acts on, weighted by their local share (absent = everywhere)
  relics?: { kind: 'iceArch' | 'iceSpire'; count: number; params: Record<string, number>; minerals?: string[] }[];   // silicon only; seeded; minerals: crust ids they may stand on
  crust: CrustConfig;                 // seeded mineral map (src/gen/crust.ts)
}

import type { FlightParams } from '../sim/flight';

export interface LifeInputs {
  solvent: Sourced & { rho: number; mu: number; epsilonR: number; liquidBandC: [number, number] };
  airDensity: Sourced & { scale: number; molarMass: number };   // scale × live P·M/(R·T) into develop()'s scale (unbuoyed carbon tissue = 1); molarMass of the main gas, kg/mol
  tissueDensity: Sourced & { C: number; Si: number };
  flight: Sourced & Omit<FlightParams, 'airScale' | 'molarMass'>;   // powered-flight coefficients (sim/flight.ts); airScale is copied from airDensity.scale
  scalings: Record<string, number>;              // our stats → F's heat, light and hunger ranges
  economics?: Sourced & { gravityWalk: number; gravityScaleRef: number };   // square-cube support term in develop() (McMahon 1973); omitted = creatures ignore gravity
}

export interface WorldConfig {
  id: WorldId;
  /** Set only on the hidden lead easter-egg variant of carbon (worlds/lead.ts): zero mutation, tardigrades only, labelled not science. */
  easterEgg?: 'lead';
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
    /** The founders' climate genes when life appears (the 3 climate genes of the 15-gene genome). */
    founders: Sourced & { prefTemp: number; tolerance: number; chem: number; /** bounds for the run-seeded mean of the founders' latent genes (assumption: true); see makeFounders */ latent?: Partial<Record<string, [number, number]>>; /** founders prefer the starting temperature (rounded, inside the living band) instead of prefTemp (assumption: true) */ followStartTemperature?: boolean };
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
  /** Live time-speed factor (1 if absent). */
  timeFactor?: number;
  yearsShown: number;                   // illustrative counter
  stats: Record<string, number>;        // every StatDef id (incl. seaCover) plus 'seaLevel' in metres
  population: { producers: number; consumers: number };
  generation: number;
  traitAverages: Record<string, number>;
  organisms: Float32Array;              // layout in sim/organismLayout.ts
  flora: Float32Array;                  // per-cell flora biomass (mat, canopy) on the 64² grid
  births: { id: number; plan: Float32Array }[];
  /** Predation kills since the previous snapshot (not starvation, age or stress). x, z are the prey's last position in organism-buffer patch units (0..1). */
  kills: { hunterId: number; preyId: number; x: number; z: number; preyScale?: number }[];
  controls: Conditions;
  bands: Record<ControlId, LivingBand>;
}

/** `name` is the common name (e.g. "Night-glow Strider"): unique in a run and the bestiary's key. `scientific` is the binomial
 *  ("Carbopus noctiluca": Genus epithet, Greek/Latin roots for the body plan and the most distinctive trait); unique in a run too. */
export interface NewFormEvent { binId: number; name: string; scientific: string; organismId: number }

/** Typed bus events (CLAUDE.md "Bus events"). */
export interface BusEvents {
  'selection:changed': { worldId: WorldId; conditions: Conditions; crust?: CrustPickId };   // crust: rock chip id, absent = the natural mix
  'world:selected': { worldId: WorldId; requested: Conditions; seed?: number; crust?: CrustPickId };   // seed: this run's seed (default world.demoSeed); crust: rock chip id, absent = natural mix
  'build:life': { worldId: WorldId };
  'build:complete': { worldId: WorldId };
  'sim:snapshot': SimSnapshot;
  'control:set': { controlId: ControlId; value: number };
  /** UI → sim: live time speed after the build (1, 2, 4, 8 or 16; ignored during the build). */
  'time:set': { factor: number };
  'control:blocked': { controlId: ControlId; limitId: string; start?: true };   // start: moved by startingConditions at world start
  'guide:newForm': NewFormEvent;
  'inspect:open': { target: InspectTarget; at: { x: number; y: number } };
  'inspect:window': { x: number; y: number; width: number; height: number } | null;
  'inspect:close': Record<string, never>;
  /** UI → render: the bestiary specimen page's 3D window (CSS pixels) and the specimen's body plan, or null when the
   *  page closes. One live view at a time: the page and the inspect card never show together. */
  'bestiary:window': { rect: { x: number; y: number; width: number; height: number }; plan: BodyPlan } | null;
  /** Render → UI: the living thing under the pointer or gamepad reticle (a scanner lock), or null. Never sea, ground or sky.
   *  `rect` is its screen bounds in CSS pixels. While the same target stays locked, the render layer re-emits the SAME
   *  payload object each frame with `rect` updated in place, so the lock follows a moving target without allocating. */
  'inspect:hover': { target: Extract<InspectTarget, { kind: 'organism' | 'producer' }>; rect: { x: number; y: number; width: number; height: number } } | null;
}

/** Read-only inputs the art layer consumes each frame (CLAUDE.md "Logic → art interface"). */
export interface VisualInputs {
  world: Pick<WorldConfig, 'id' | 'status' | 'starType' | 'solvent'> & { composition: WorldConfig['life']['composition']; /** terrain.crust.rustOxygen: oxygen % at which oxidising rock is fully rusted (art layer only) */ rustOxygen?: number;
    /** Art layer only (optional): the run's crust, in terrain.crust.minerals order. `shares` are the realised patch shares (argmax of terrain.crustWeights over the 64² cell centres, as gen/crust.ts crustMap). Built once per terrain by visualInputs. */
    crust?: { ids: string[]; oxidises: boolean[]; shares: number[]; elevation: number[] } };
  stats: Record<string, number>;
  seaLevel: number;
  frozen: boolean;
  heatBand: number;
  heatSolvent: number;
  light: number;
  airDensity: number;
  buildProgress: number;
  terrain: {
    rise: number; progress: Record<string, number>; height: (x: number, z: number) => number; /** metres; lets the art layer map flora cells to world positions */ patchSize?: number;
    /** The crust map (gen/crust.ts): mineral weights at (x, z) in `minerals` (config) order, sum 1. Absent on a world without
     *  terrain.crust or on flat ground; the art layer then falls back to its height-rank proxy. Read-only. */
    crust?: { minerals: readonly Pick<MineralDef, 'id' | 'supply' | 'oxidises'>[]; weights: (x: number, z: number) => number[] };
    /** The same weights as crust.weights, as a bare sampler (used by crustLook's local haze). Optional: absent on stubs and flat terrains. */
    crustWeights?: (x: number, z: number) => number[];
  };
  organisms: Float32Array;
  births: SimSnapshot['births'];
  /** Predation kills from every snapshot since the last VisualInputs (render-only: the hunt and kill animations). */
  kills?: SimSnapshot['kills'];
  flora: Float32Array;
  lifeOnLand: boolean;
}

export type { AnimalGenome };
