// The authoritative world simulation (CLAUDE.md "The build", "Life changes the planet", "Condition sliders").
// Pure and deterministic: no clocks, no Math.random. Time enters only through advance(dtSec), which moves a build
// clock; the number of ecology ticks that has to have run is a pure function of that clock (ticksDueAt), so frame
// rate can change WHEN a state arrives but never WHAT the state is.
import type {
  BuildConfig, Conditions, ControlId, LivingBand, SimSnapshot, WorldConfig,
} from '../worlds/types';
import { controlList, controls } from '../worlds/controls';
import { CONSTANTS } from './constants';
import { createTerrain, seaLevelForCover, spawnPoint, type Terrain, type TerrainState } from '../gen/terrain';
import { CELLS, GRID, liquidFromHeights } from './grid';
import { FormTracker, type NewForm } from './guide';
import {
  CONTROL_ORDER, applyControl, canLive, equilibriumSeaCover, livingBands, startingConditions,
  type LimitsEnv,
} from './limits';
import { EcologyLife, type LifeEnv, type LifeModel } from './lifeModel';
import {
  gasDensity, orbitForTemperature, partialPressures, radiativeBalance, starlight, vapourPressure,
  type PartialPressureParams, type RadiativeParams,
} from './models';
import { arrheniusFactor } from './population';
import { makeRng } from './rng';

/** The fixed simulation rate (CLAUDE.md: "fixed 20 Hz ticks"). One tick is 1/20 ecology second. */
export const TICK_HZ = 20;
export const TICK_DT = 1 / TICK_HZ;

const BAND_EVERY = 10; // implementation constant (DECISIONS §G.2 exempt): ticks between band refreshes used for edge stress (0.5 ecology s)
const BLOCKED_REPEAT = 20; // implementation constant (DECISIONS §G.2 exempt): ticks before the same control may report "blocked" again while pinned at an edge
const EPS = 1e-6; // implementation constant (DECISIONS §G.2 exempt): slack so float sums of frame times never lose a tick
const EDGE_INSET = 1e-6; // implementation constant (DECISIONS §G.2 exempt): a setting held at a band edge sits this far (relative) inside it, so rounding never tips it over
const CONTROL_EASE_SEC = 1;  // implementation constant (DECISIONS §G.2 exempt): a slider change glides linearly over this much demo time
const SIGMA_EASE_START = 0.2; // implementation constant (DECISIONS §G.2 exempt): share of the build's ticks at which σ starts easing down from SIGMA_BUILD
const SIGMA_EASE_END = 0.6;   // implementation constant (DECISIONS §G.2 exempt): and the share at which it reaches SIGMA
const LIQUID_MOVE_M = 0.25; // implementation constant (DECISIONS §G.2 exempt): sea level change (m) that rebuilds the ecology's liquid grid
const LIQUID_PROGRESS = 0.05; // implementation constant (DECISIONS §G.2 exempt): or this much more terrain rise
const LIQUID_EVERY = 100; // implementation constant (DECISIONS §G.2 exempt): ticks between refreshes of the ecology's liquid-depth grid (5 ecology s)

/**
 * Cumulative ecology ticks that must have run `buildSec` seconds into the build. Pure and frame-independent.
 * Nothing lives before the founders appear (lifeSec), then the fast-forward runs linearly and reaches
 * `ecologySec × 20` ticks exactly at `durationSec`.
 */
export function ticksDueAt(buildSec: number, cfg: Pick<BuildConfig, 'durationSec' | 'lifeSec' | 'ecologySec'>): number {
  const t = Math.min(Math.max(buildSec, 0), cfg.durationSec);
  if (t <= cfg.lifeSec) return 0;
  const frac = (t - cfg.lifeSec) / (cfg.durationSec - cfg.lifeSec);
  return Math.floor(frac * cfg.ecologySec * TICK_HZ + EPS);
}

/** Ticks due `elapsedSec` after Generate: the build schedule, then the live 20 Hz pace. */
export function ticksDueAfter(elapsedSec: number, cfg: Pick<BuildConfig, 'durationSec' | 'lifeSec' | 'ecologySec'>): number {
  const build = ticksDueAt(cfg.durationSec, cfg);
  if (elapsedSec <= cfg.durationSec) return ticksDueAt(elapsedSec, cfg);
  return build + Math.floor((elapsedSec - cfg.durationSec) * TICK_HZ + EPS);
}

/** Build seconds the world has reached after `tick` ticks (inverse of ticksDueAt): the tick-time clock the ecology sees. */
export function buildSecOfTick(tick: number, cfg: Pick<BuildConfig, 'durationSec' | 'lifeSec' | 'ecologySec'>): number {
  const total = ticksDueAt(cfg.durationSec, cfg);
  if (total <= 0 || tick >= total) return cfg.durationSec;
  return cfg.lifeSec + (tick / total) * (cfg.durationSec - cfg.lifeSec);
}

/**
 * Body-gene mutation σ at tick `ticks` of a build that lasts `buildTicks`: SIGMA_BUILD for the first part of the build so variety
 * appears fast, easing down to SIGMA so forms can settle into clusters by the end, and SIGMA from then on. Keyed to the tick clock.
 */
export function mutationSigmaAt(ticks: number, buildTicks: number): number {
  const hi = CONSTANTS.SIGMA_BUILD.value;
  const lo = CONSTANTS.SIGMA.value;
  const f = buildTicks > 0 ? ticks / buildTicks : 1;
  if (f >= SIGMA_EASE_END) return lo;
  if (f <= SIGMA_EASE_START) return hi;
  return hi + (lo - hi) * ((f - SIGMA_EASE_START) / (SIGMA_EASE_END - SIGMA_EASE_START));
}

export type SimEvent =
  | { type: 'build:life' }
  | { type: 'build:complete' }
  | { type: 'control:blocked'; controlId: ControlId; limitId: string; start?: true }
  | ({ type: 'guide:newForm' } & NewForm);

export interface SimOptions {
  /** Defaults to world.demoSeed. */
  seed?: number;
  /** Defaults to the Ecology adapter. */
  life?: LifeModel;
  /** Overrides the terrain-derived sea level in metres, given (buildProgress, seaCover 0..1). Mostly a test seam. */
  seaLevelFn?: (buildProgress: number, cover: number) => number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export class WorldSimulation {
  readonly world: WorldConfig;
  readonly seed: number;

  private elapsed = 0;
  private ticks = 0;
  private lifeStarted = false;
  private complete = false;
  private events: SimEvent[] = [];
  private lastBlockedTick: Partial<Record<ControlId, number>> = {};

  private stats: Record<string, number> = {};
  private orbitAU = 1;
  private readonly gravity: number;
  private readonly limitsEnv: LimitsEnv;
  private readonly radBase: RadiativeParams & Record<string, number>;
  private readonly buildTicks: number;
  private readonly seaLimited: boolean;
  private tickBands: Record<ControlId, LivingBand>;
  private readonly life: LifeModel;
  private readonly tracker = new FormTracker();
  private readonly announcedForms = new Set<string>();
  private readonly terrain: Terrain | undefined;
  private seaLevelFn: ((buildProgress: number, cover: number) => number) | undefined;
  private readonly seaCache = new Map<string, number>();
  /** Slider glides in progress: from/to in display units, t0 on the sim clock (see simClock). */
  private readonly ease: Partial<Record<ControlId, { from: number; to: number; t0: number }>> = {};
  private liquidAt: { level: number; progress: number } | undefined;

  constructor(world: WorldConfig, requested: Conditions, opts: SimOptions = {}) {
    this.world = world;
    this.seed = opts.seed ?? world.demoSeed;
    this.seaLevelFn = opts.seaLevelFn;
    try {
      this.terrain = createTerrain(world.terrain, this.seed);
    } catch (e) {
      console.warn('sim: terrain config rejected, using flat sea level 0:', e);
    }

    const radDef = world.derived.find((d) => d.model === 'radiativeBalance' && d.statId === 'temperature');
    if (!radDef) throw new Error(`simulation: ${world.id} has no radiativeBalance temperature model`);
    this.radBase = radDef.params as RadiativeParams & Record<string, number>;
    this.seaLimited = world.derived.some((d) => d.model === 'seaVolume');
    this.buildTicks = ticksDueAt(world.build.durationSec, world.build);

    for (const fb of world.feedbacks) {
      if (!['producerBiomass', 'consumerBiomass', 'deadBiomass'].includes(fb.driver)) {
        throw new Error(`simulation: unknown feedback driver '${fb.driver}' (${fb.id})`);
      }
    }

    // Stats the world samples once from its ranges (gravity, and on carbon CO₂ and sea cover), in config order.
    const rnd = makeRng(this.seed)('world');
    for (const s of world.stats) {
      const r = world.ranges[s.id];
      this.stats[s.id] = r ? r[0] + (r[1] - r[0]) * rnd() : 0;
    }
    this.gravity = this.stats.gravity ?? 1;
    this.limitsEnv = { gravity: this.gravity, controls: controlList };

    const { start, moved } = startingConditions(world, requested, this.limitsEnv);
    for (const m of moved) this.events.push({ type: 'control:blocked', controlId: m.controlId, limitId: m.limitId, start: true });
    this.stats.nitrogen = start.nitrogen;
    this.stats.oxygen = start.oxygen;
    this.orbitAU = orbitForTemperature(this.radNow(), start.temperature, start.nitrogen);
    this.refreshDerived();

    this.tickBands = livingBands(world, this.conditions(), this.limitsEnv);
    this.life = opts.life ?? new EcologyLife(world, this.seed, { liquid: () => this.liquidNow() });
  }

  // ---- public API ---------------------------------------------------------------------------------------

  get elapsedSec(): number { return this.elapsed; }
  get tickCount(): number { return this.ticks; }
  get buildComplete(): boolean { return this.complete; }

  setSeaLevelFn(fn: (buildProgress: number, cover: number) => number): void { this.seaLevelFn = fn; }

  /** The live value under each slider thumb. */
  conditions(): Conditions {
    return { temperature: this.stats.temperature, nitrogen: this.stats.nitrogen, oxygen: this.stats.oxygen };
  }

  /**
   * Move the build clock forward and run every tick that is now due, at most `maxTicks` of them (the worker uses
   * this as a CPU budget: leftover ticks stay due and run on the next call, so the sequence never changes).
   * Returns the number of ticks run.
   */
  advance(dtSec: number, maxTicks = Infinity): number {
    if (!(dtSec >= 0)) return this.runDue(maxTicks);
    this.elapsed += dtSec;
    return this.runDue(maxTicks);
  }

  /** True while ticks are due that have not run yet. */
  get behind(): boolean { return this.ticks < ticksDueAfter(this.elapsed, this.world.build); }

  /** The `control:set` handler: clamp to the living band and report a block. Values are in display units. */
  setControl(controlId: ControlId, value: number): void {
    if (!(controlId in controls) || !Number.isFinite(value)) {
      throw new Error(`simulation: bad control:set ${String(controlId)}=${String(value)}`);
    }
    const r = applyControl(this.world, this.conditions(), controlId, value, this.limitsEnv);
    if (r.blockedBy) this.events.push({ type: 'control:blocked', controlId, limitId: r.blockedBy });
    const band = livingBands(this.world, this.conditions(), this.limitsEnv)[controlId];
    const to = this.insideBand(controlId, band, r.conditions[controlId]);
    const from = this.conditions()[controlId];
    if (to === from) delete this.ease[controlId];
    else this.ease[controlId] = { from, to, t0: this.simClock() };   // glides over CONTROL_EASE_SEC, stepped on the tick clock
    this.tickBands = livingBands(this.world, this.conditions(), this.limitsEnv);
  }

  /**
   * The simulation's own clock in seconds: build seconds at the tick reached (so a slider glide takes 1 s of demo time
   * even in the build's fast-forward), 20 ticks per second after it. Before the first tick it is the build clock, capped at
   * lifeSec, because nothing ticks while the world is still empty. A pure function of the ticks run, never of frame rate.
   */
  private simClock(): number {
    const b = this.world.build;
    if (this.ticks === 0) return Math.min(this.elapsed, b.lifeSec);
    if (this.ticks <= this.buildTicks) return buildSecOfTick(this.ticks, b);
    return b.durationSec + (this.ticks - this.buildTicks) * TICK_DT;
  }

  /** Move every gliding slider to its position at `clock` (linear in the thumb's own scale: log for nitrogen). */
  private stepEase(clock: number): void {
    for (const id of Object.keys(this.ease) as ControlId[]) {
      const e = this.ease[id]!;
      const p = clamp01((clock - e.t0) / CONTROL_EASE_SEC);
      const log = controls[id].scale === 'log';
      const v = p >= 1 ? e.to : log ? Math.exp(Math.log(e.from) + (Math.log(e.to) - Math.log(e.from)) * p) : e.from + (e.to - e.from) * p;
      this.setControlValue(id, v);
      if (p >= 1) delete this.ease[id];
    }
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /**
   * Everything the renderer and UI read (20 Hz content). Consumes `births` since the previous snapshot and may
   * queue `guide:newForm` events. Organisms and flora are fresh buffers, safe to transfer.
   */
  snapshot(): SimSnapshot {
    const w = this.world;
    const conds = this.conditions();
    const bands = livingBands(w, conds, this.limitsEnv);
    const summary = this.life.summary();
    const b = w.build;

    // A field-guide bin is a functional type (its generated name), so a form is announced once per name for the whole
    // run. The tracker alone also reports every new gene-space cluster of the same type as the population drifts.
    for (const f of this.tracker.update(this.life.guideAnimals())) {
      if (this.announcedForms.has(f.name)) continue;
      this.announcedForms.add(f.name);
      this.events.push({ type: 'guide:newForm', ...f });
    }

    // Seas fill in over the seas window: the reported cover and the sea level rise together, so a stat never
    // disagrees with the picture. The equilibrium cover that life and the limits read is unaffected.
    const fill = smoothstep(b.seasSec[0], b.seasSec[1], this.elapsed);
    const cover = this.stats.seaCover * fill;
    const progress = this.complete ? 1 : Math.min(this.elapsed / b.durationSec, 1 - EPS);
    const stats = { ...this.stats, seaCover: cover, seaLevel: this.seaLevel(progress, cover / 100) };
    return {
      worldId: w.id,
      timeSec: this.elapsed,
      buildProgress: progress,
      yearsShown: b.yearsShown * smoothstep(0, 1, progress),
      stats,
      population: { producers: summary.producers, consumers: summary.consumers },
      generation: summary.generation,
      traitAverages: summary.traitAverages,
      organisms: this.life.packOrganisms(),
      flora: this.life.floraBuffer(),
      births: this.life.drainBirths(),
      controls: conds,
      bands,
    };
  }

  // ---- ticking ------------------------------------------------------------------------------------------

  private runDue(maxTicks: number): number {
    const b = this.world.build;
    if (!this.lifeStarted && this.elapsed >= b.lifeSec) {
      this.lifeStarted = true;
      this.life.seedFounders(this.lifeEnv(), this.spawnHint());
      this.events.push({ type: 'build:life' });
    }
    if (this.ticks === 0) this.stepEase(this.simClock());   // gliding while the world is still empty
    const target = ticksDueAfter(this.elapsed, b);
    let n = 0;
    while (this.ticks < target && n < maxTicks) {
      this.tick();
      n++;
    }
    if (!this.complete && this.elapsed >= b.durationSec && this.ticks >= this.buildTicks) {
      this.complete = true;
      this.events.push({ type: 'build:complete' });
    }
    return n;
  }

  private tick(): void {
    this.ticks++;
    this.stepEase(this.simClock());
    this.life.step(this.lifeEnv(), TICK_DT);

    // Life changes the planet: each feedback moves its stat by rate × driver per ecology second.
    const drivers = this.life.drivers();
    for (const fb of this.world.feedbacks) {
      if (!(fb.statId in this.stats)) continue;
      this.stats[fb.statId] += fb.rate * drivers[fb.driver as keyof typeof drivers] * TICK_DT;
    }
    this.clampStats();
    this.refreshDerived();
    if (this.ticks % LIQUID_EVERY === 0) this.refreshLiquid();

    // The world never enters a red zone: the same limits the sliders show are the kill conditions.
    if (!canLive(this.world, this.conditions(), this.limitsEnv).ok) this.enforceBands();
    if (this.ticks % BAND_EVERY === 0) this.tickBands = livingBands(this.world, this.conditions(), this.limitsEnv);
  }

  private clampStats(): void {
    const s = this.stats;
    s.nitrogen = Math.min(controls.nitrogen.max, Math.max(controls.nitrogen.min, s.nitrogen));
    s.oxygen = Math.min(controls.oxygen.max, Math.max(controls.oxygen.min, s.oxygen));
    if ('co2' in s) s.co2 = Math.max(0, s.co2);
  }

  /** Drift: ease any setting that life's feedbacks pushed into a red zone back to the edge of its band. */
  private enforceBands(): void {
    // Fix what life moved first (the stats feedbacks write), so a nitrogen lock-up pins nitrogen instead of dragging temperature down.
    const moved = new Set(this.world.feedbacks.map((f) => f.statId));
    const order = [...CONTROL_ORDER.filter((id) => moved.has(id)), ...CONTROL_ORDER.filter((id) => !moved.has(id))];
    for (const id of order) {
      if (canLive(this.world, this.conditions(), this.limitsEnv).ok) return;
      const band = this.bandOf(id);
      if (band.empty) continue;
      const v = this.stats[id];
      const fixed = this.insideBand(id, band, v);
      if (fixed === v) continue;
      this.setControlValue(id, fixed);
      const limitId = v < fixed ? band.lowLimitId : band.highLimitId;
      const last = this.lastBlockedTick[id];
      if (limitId && (last === undefined || this.ticks - last >= BLOCKED_REPEAT)) {
        this.lastBlockedTick[id] = this.ticks;
        this.events.push({ type: 'control:blocked', controlId: id, limitId });
      }
    }
  }

  /** Living band of one slider only (a third of the cost of livingBands for all three). */
  private bandOf(id: ControlId): LivingBand {
    return livingBands(this.world, this.conditions(), { ...this.limitsEnv, controls: controlList.filter((c) => c.id === id) })[id];
  }

  /** `v` clamped into the band, held EDGE_INSET inside any edge that is a real limit (not a track's end). */
  private insideBand(id: ControlId, band: LivingBand, v: number): number {
    if (band.empty) return v;
    const log = controls[id].scale === 'log';
    const lo = band.lowLimitId ? (log ? band.low * (1 + EDGE_INSET) : band.low + EDGE_INSET * (band.high - band.low)) : band.low;
    const hi = band.highLimitId ? (log ? band.high * (1 - EDGE_INSET) : band.high - EDGE_INSET * (band.high - band.low)) : band.high;
    return lo > hi ? v : Math.min(hi, Math.max(lo, v));
  }

  // ---- derived conditions -------------------------------------------------------------------------------

  /** Radiative parameters now. The CO₂ greenhouse (issue #34) is optional: with no referenceCo2/co2PerDoublingK in the config it adds 0. */
  private radNow(): RadiativeParams {
    const p = this.radBase;
    const ref = p.referenceCo2;
    const perDoubling = p.co2PerDoublingK;
    const co2 = this.stats.co2;
    const co2K = ref && perDoubling && co2 !== undefined ? perDoubling * Math.log2(Math.max(co2, 1e-6) / ref) : 0;
    return { ...p, greenhouseK: p.greenhouseK + co2K };
  }

  /** Set one slider's physical quantity (orbit for temperature) and recompute everything derived from it. */
  private setControlValue(id: ControlId, value: number): void {
    if (id === 'temperature') this.orbitAU = orbitForTemperature(this.radNow(), value, this.stats.nitrogen);
    else this.stats[id] = value;
    this.refreshDerived();
  }

  /** Derived stats are recomputed from the others every tick, never integrated. */
  private refreshDerived(): void {
    const w = this.world;
    const s = this.stats;
    const rad = this.radNow();
    s.temperature = radiativeBalance(rad, this.orbitAU, s.nitrogen);
    if ('light' in s) s.light = starlight(rad, this.orbitAU);
    if ('pace' in s) s.pace = arrheniusFactor(s.temperature, w.life.rules.metabolism);
    for (const d of w.derived) {
      if (d.model === 'partialPressures') {
        const p = d.params as unknown as PartialPressureParams;
        const ref = this.radBase.referenceCo2;
        const co2Bar = ref && 'co2' in s ? p.co2Bar * (s.co2 / ref) : p.co2Bar;
        s[d.statId] = partialPressures({ ...p, co2Bar }, w.solvent, {
          nitrogen: s.nitrogen, oxygenPct: s.oxygen, tC: s.temperature, gravity: this.gravity,
        });
      } else if (d.model === 'vapourPressure') {
        s[d.statId] = vapourPressure(w.solvent, s.temperature);
      } else if (d.model === 'seaVolume') {
        s[d.statId] = 100 * equilibriumSeaCover(w, this.conditions(), this.limitsEnv);
      }
    }
  }

  // ---- terrain: sea level and the ecology's liquid grid ----------------------------------------------------------

  private terrainState(progress: number, tempC: number): TerrainState {
    const t = this.world.terrain;
    const rec: Record<string, number> = {};
    for (const m of t.machines) rec[m.id] = progress;
    const heat = clamp01(0.5 + (tempC - this.world.solvent.freezeC) / t.heatSolventSpan);
    return { rise: progress, progress: rec, heatSolvent: heat };
  }

  /** Sea level in metres. A pure function of (progress to 1%, cover to 0.5%, temperature to 1 °C), so it never depends on call timing. */
  private seaLevel(progress: number, cover01: number): number {
    if (this.seaLevelFn) return this.seaLevelFn(progress, cover01);
    if (!this.terrain) return 0;
    const pq = Math.round(progress * 100) / 100;
    const cq = Math.round(cover01 * 200) / 200;
    const tq = Math.round(this.stats.temperature);
    const key = `${pq}:${cq}:${tq}`;
    let level = this.seaCache.get(key);
    if (level === undefined) {
      level = seaLevelForCover(this.terrain, this.terrainState(pq, tq), cq);
      if (this.seaCache.size > 400) this.seaCache.clear();
      this.seaCache.set(key, level);
    }
    return level;
  }

  /** What the ecology's world looks like at the tick clock: progress and equilibrium cover after `ticks` ticks. */
  private tickTerrain(): { progress: number; cover: number } {
    const b = this.world.build;
    const sec = buildSecOfTick(this.ticks, b);
    return { progress: sec / b.durationSec, cover: (this.stats.seaCover / 100) * smoothstep(b.seasSec[0], b.seasSec[1], sec) };
  }

  /** Static liquid depth per cell (sea level − ground at each cell centre), on the tick clock so it never depends on frame rate. */
  private liquidNow(): ArrayLike<number> {
    const { progress, cover } = this.tickTerrain();
    if (!this.terrain) return Float32Array.from({ length: CELLS }, (_, i) => Math.max(0, 3 - (i % GRID) * 0.15)); // a rough shore
    const level = this.seaLevel(progress, cover);
    const S = this.terrain.patchSize;
    const pq = Math.round(progress * 100) / 100;
    const state = this.terrainState(pq, Math.round(this.stats.temperature));
    return liquidFromHeights((x, y) => this.terrain!.height((x - 0.5) * S, (y - 0.5) * S, state), level);
  }

  /** Rebuild the ecology's liquid grid when the sea moved by more than 0.25 m or the terrain rose another 5%. Tick-clock only. */
  private refreshLiquid(): void {
    if (!this.lifeStarted || !this.life.setLiquid) return;
    const { progress, cover } = this.tickTerrain();
    const level = this.seaLevel(progress, cover);
    if (this.liquidAt && Math.abs(level - this.liquidAt.level) <= LIQUID_MOVE_M && Math.abs(progress - this.liquidAt.progress) < LIQUID_PROGRESS) return;
    this.liquidAt = { level, progress };
    this.life.setLiquid(this.liquidNow());
  }

  /**
   * Where the character will stand (metres). The seas keep filling after the character spawns (seasSec ends after spawnSec),
   * so this is measured on the finished terrain at the final sea level: the spawn is then on land at the end of the build,
   * not just at spawnSec. A pure function of the world, so founders can be seeded next to it deterministically.
   */
  spawnPointM(): { x: number; z: number } {
    if (!this.terrain) return { x: 0, z: 0 };
    const state = this.terrainState(1, Math.round(this.stats.temperature));
    const p = spawnPoint(this.terrain, state, this.seaLevel(1, this.stats.seaCover / 100));
    return { x: p.x, z: p.z };
  }

  private spawnHint(): { x: number; y: number } | undefined {
    if (!this.terrain) return undefined;
    const p = this.spawnPointM();
    const S = this.terrain.patchSize;
    return { x: p.x / S + 0.5, y: p.z / S + 0.5 };
  }

  private airDensity(): number {
    return gasDensity(this.stats.pressure, this.stats.temperature, this.world.life.inputs.airDensity.molarMass);
  }

  /** Body-gene mutation σ on the tick clock (see mutationSigmaAt). */
  private mutationSigma(): number {
    return mutationSigmaAt(this.ticks, this.buildTicks);
  }

  private heatBand(band: LivingBand): number {
    const w = band.high - band.low;
    return band.empty || !(w > 0) ? 0.5 : clamp01((this.stats.temperature - band.low) / w);
  }

  private lifeEnv(): LifeEnv {
    const s = this.stats;
    return {
      temperature: s.temperature,
      oxygen: s.oxygen,
      light: clamp01(s.light / (this.world.life.inputs.scalings.lightFull || 1)),
      habitat: this.seaLimited ? clamp01(s.seaCover / 100) : 1,
      edgeStress: this.edgeStress(),
      starlight: s.light,
      heatBand: this.heatBand(this.tickBands.temperature),
      nitrogen: s.nitrogen,
      pressure: s.pressure,
      airDensity: this.airDensity(),
      mutationSigma: this.mutationSigma(),
    };
  }

  /** 0..1: how close the conditions sit to a lethal limit, from the last band refresh. Only real limits count, not a track's end. */
  private edgeStress(): number {
    const c = this.conditions();
    let stress = 0;
    for (const id of CONTROL_ORDER) {
      const b = this.tickBands[id];
      if (b.empty) return 1;
      const log = controls[id].scale === 'log';
      const f = (v: number) => (log ? Math.log(v) : v);
      const width = f(b.high) - f(b.low);
      if (!(width > 0)) continue;
      const pos = (f(c[id]) - f(b.low)) / width;
      // Cubed ramp: negligible until the last few per cent of the band, then a cliff at the edge itself.
      if (b.lowLimitId) stress = Math.max(stress, clamp01(1 - pos / CONSTANTS.EDGE_ZONE.value) ** CONSTANTS.EDGE_POWER.value);
      if (b.highLimitId) stress = Math.max(stress, clamp01(1 - (1 - pos) / CONSTANTS.EDGE_ZONE.value) ** CONSTANTS.EDGE_POWER.value);
    }
    return clamp01(stress);
  }
}
