// The authoritative world simulation (CLAUDE.md "The build", "Life changes the planet", "Condition sliders").
// Pure and deterministic: no clocks, no Math.random. Time enters only through advance(dtSec), which moves a build
// clock; the number of ecology ticks that has to have run is a pure function of that clock (ticksDueAt), so frame
// rate can change WHEN a state arrives but never WHAT the state is.
import type {
  BuildConfig, Conditions, ControlId, LivingBand, SimSnapshot, WorldConfig,
} from '../worlds/types';
import { controlList, controls } from '../worlds/controls';
import { develop, type DevelopConditions, type DevelopInputs } from './develop';
import { FormTracker, type NewForm } from './guide';
import {
  CONTROL_ORDER, applyControl, canLive, equilibriumSeaCover, livingBands, startingConditions,
  type LimitsEnv,
} from './limits';
import type { LifeEnv, LifeModel } from './lifeModel';
import { PopulationLife } from './lifeModel';
import {
  gasDensity, orbitForTemperature, partialPressures, radiativeBalance, starlight, vapourPressure,
  type PartialPressureParams, type RadiativeParams,
} from './models';
import { packOrganism, ORGANISM_STRIDE } from './organismLayout';
import { packBodyPlan } from './plan';
import { arrheniusFactor } from './population';
import { makeRng } from './rng';

/** The fixed simulation rate (CLAUDE.md: "fixed 20 Hz ticks"). One tick is 1/20 ecology second. */
export const TICK_HZ = 20;
export const TICK_DT = 1 / TICK_HZ;

const BAND_EVERY = 10;        // ticks between band refreshes used for edge stress (0.5 ecology s)
const EDGE_ZONE = 0.1;        // share of a living band, next to a lethal limit, over which edge stress ramps 0 → 1
const BLOCKED_REPEAT = 20;    // ticks before the same control may report "blocked" again while pinned at an edge
const EPS = 1e-6;             // slack so float sums of frame times never lose a tick
const EDGE_INSET = 1e-6;      // a setting held at a band edge sits this far (relative) inside it, so rounding never tips it over
const MOLAR_MASS_AIR = 0.028; // kg/mol, N₂ is the main gas on both worlds

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

export type SimEvent =
  | { type: 'build:life' }
  | { type: 'build:complete' }
  | { type: 'control:blocked'; controlId: ControlId; limitId: string }
  | ({ type: 'guide:newForm' } & NewForm);

export interface SimOptions {
  /** Defaults to world.demoSeed. */
  seed?: number;
  /** Defaults to the population.ts adapter. */
  life?: LifeModel;
  /** Sea level in metres for a sea cover (0..1); the terrain agent's seaLevelForCover. Defaults to 0 until wired in. */
  seaLevelFn?: (cover: number) => number;
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
  private readonly lightRef: number;
  private readonly limitsEnv: LimitsEnv;
  private readonly radBase: RadiativeParams & Record<string, number>;
  private readonly buildTicks: number;
  private readonly seaLimited: boolean;
  private tickBands: Record<ControlId, LivingBand>;
  private readonly life: LifeModel;
  private readonly tracker = new FormTracker();
  private seenAnimals = new Set<number>();
  private seaLevelFn: (cover: number) => number;

  constructor(world: WorldConfig, requested: Conditions, opts: SimOptions = {}) {
    this.world = world;
    this.seed = opts.seed ?? world.demoSeed;
    this.seaLevelFn = opts.seaLevelFn ?? (() => 0);

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
    for (const m of moved) this.events.push({ type: 'control:blocked', controlId: m.controlId, limitId: m.limitId });
    this.stats.nitrogen = start.nitrogen;
    this.stats.oxygen = start.oxygen;
    this.orbitAU = orbitForTemperature(this.radNow(), start.temperature, start.nitrogen);
    this.refreshDerived();

    // The world's own reference starlight (its startDefaults orbit), so the climate core's light is relative to it.
    const d = world.startDefaults;
    this.lightRef = starlight(this.radBase, orbitForTemperature(this.radBase, d.temperature, d.nitrogen));

    this.tickBands = livingBands(world, this.conditions(), this.limitsEnv);
    this.life = opts.life ?? new PopulationLife(world, this.seed, start.temperature);
  }

  // ---- public API ---------------------------------------------------------------------------------------

  get elapsedSec(): number { return this.elapsed; }
  get tickCount(): number { return this.ticks; }
  get buildComplete(): boolean { return this.complete; }

  setSeaLevelFn(fn: (cover: number) => number): void { this.seaLevelFn = fn; }

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
    this.setControlValue(controlId, this.insideBand(controlId, band, r.conditions[controlId]));
    this.tickBands = livingBands(this.world, this.conditions(), this.limitsEnv);
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
    const animals = this.life.animals();
    const summary = this.life.summary();
    const b = w.build;

    const light = clamp01(this.stats.light / (w.life.inputs.scalings.lightFull || 1));
    const dev: DevelopConditions = { light, heatBand: this.heatBand(bands.temperature) };
    const inputs: DevelopInputs = {
      solvent: w.life.inputs.solvent,
      airDensity: this.airDensity() * w.life.inputs.airDensity.scale,
      tissueDensity: w.life.inputs.tissueDensity,
    };

    const organisms = new Float32Array(animals.length * ORGANISM_STRIDE);
    const births: SimSnapshot['births'] = [];
    const seen = new Set<number>();
    animals.forEach((a, i) => {
      seen.add(a.id);
      if (!this.seenAnimals.has(a.id)) births.push({ id: a.id, plan: packBodyPlan(develop(a.genome, dev, inputs)) });
      packOrganism(organisms, i, {
        x: a.x, y: a.y, role: a.role, size: a.size,
        prefTemp: a.genome.climate.prefTemp, tolerance: a.genome.climate.tolerance, chem: a.genome.climate.chem,
        energy: a.energy, id: a.id, generation: a.generation, heading: a.heading, mode: a.mode,
        body: a.genome.body, comp: a.genome.comp, lineage: a.genome.lineage,
      });
    });
    this.seenAnimals = seen;

    for (const f of this.tracker.update(animals.map((a) => ({ id: a.id, genome: a.genome })))) {
      this.events.push({ type: 'guide:newForm', ...f });
    }

    // Seas fill in over the seas window: the reported cover and the sea level rise together, so a stat never
    // disagrees with the picture. The equilibrium cover that life and the limits read is unaffected.
    const fill = smoothstep(b.seasSec[0], b.seasSec[1], this.elapsed);
    const cover = this.stats.seaCover * fill;
    const stats = { ...this.stats, seaCover: cover, seaLevel: this.seaLevelFn(cover / 100) };

    const progress = this.complete ? 1 : Math.min(this.elapsed / b.durationSec, 1 - EPS);
    return {
      worldId: w.id,
      timeSec: this.elapsed,
      buildProgress: progress,
      yearsShown: b.yearsShown * smoothstep(0, 1, progress),
      stats,
      population: { producers: summary.producers, consumers: summary.consumers },
      generation: summary.generation,
      traitAverages: summary.traitAverages,
      organisms,
      flora: this.life.floraBuffer(),
      births,
      controls: conds,
      bands,
    };
  }

  // ---- ticking ------------------------------------------------------------------------------------------

  private runDue(maxTicks: number): number {
    const b = this.world.build;
    if (!this.lifeStarted && this.elapsed >= b.lifeSec) {
      this.lifeStarted = true;
      this.life.seedFounders(this.lifeEnv());
      this.events.push({ type: 'build:life' });
    }
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
    this.life.step(this.lifeEnv(), TICK_DT);

    // Life changes the planet: each feedback moves its stat by rate × driver per ecology second.
    const drivers = this.life.drivers();
    for (const fb of this.world.feedbacks) {
      if (!(fb.statId in this.stats)) continue;
      this.stats[fb.statId] += fb.rate * drivers[fb.driver as keyof typeof drivers] * TICK_DT;
    }
    this.clampStats();
    this.refreshDerived();

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
    for (const id of CONTROL_ORDER) {
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

  /** Radiative parameters now: the CO₂ greenhouse (from config) and the star's slow brightening over the build. */
  private radNow(): RadiativeParams {
    const p = this.radBase;
    const ref = p.referenceCo2;
    const perDoubling = p.co2PerDoublingK;
    const co2 = this.stats.co2;
    const co2K = ref && perDoubling && co2 !== undefined ? perDoubling * Math.log2(Math.max(co2, 1e-6) / ref) : 0;
    const progress = this.buildTicks > 0 ? Math.min(1, this.ticks / this.buildTicks) : 1;
    return {
      ...p,
      greenhouseK: p.greenhouseK + co2K,
      luminosity: p.luminosity * (1 + (p.luminosityRiseTotal ?? 0) * progress),
    };
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

  private airDensity(): number {
    return gasDensity(this.stats.pressure, this.stats.temperature, MOLAR_MASS_AIR);
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
      light: s.light / this.lightRef,
      habitat: this.seaLimited ? clamp01(s.seaCover / 100) : 1,
      edgeStress: this.edgeStress(),
      starlight: s.light,
      heatBand: this.heatBand(this.tickBands.temperature),
      nitrogen: s.nitrogen,
      pressure: s.pressure,
      airDensity: this.airDensity(),
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
      if (b.lowLimitId) stress = Math.max(stress, 1 - pos / EDGE_ZONE);
      if (b.highLimitId) stress = Math.max(stress, 1 - (1 - pos) / EDGE_ZONE);
    }
    return clamp01(stress);
  }
}
