// The seam between WorldSimulation (conditions, feedbacks, build clock, snapshots) and the ecology.
// WorldSimulation talks only to LifeModel. PopulationLife below adapts the built climate core (population.ts);
// the ecology agent's Ecology class gets a second adapter later (it needs seedFounders, step, drivers, summary,
// floraBuffer and animals, nothing else).
import type { WorldConfig } from '../worlds/types';
import { makeFounders, type AnimalGenome } from './genome';
import { LOCOMOTION, type LocomotionMode } from './develop';
import { OrganismField, ORGANISM_STRIDE } from './organismLayout';
import { CONSUMER, PRODUCER, Population, type Environment } from './population';
import { makeRng } from './rng';

/** What the ecology feels each tick: population.ts's Environment plus the extra inputs the full ecology reads. */
export interface LifeEnv extends Environment {
  starlight: number;   // × Earth, absolute (Environment.light is relative to the world's reference)
  heatBand: number;    // 0..1 temperature within the living band
  nitrogen: number;    // × Earth
  pressure: number;    // bar
  airDensity: number;  // kg/m³, real P·M/(R·T)
}

/** Quantities feedbacks read. `deadBiomass` is biomass that died per ecology second during the last step. */
export interface LifeDrivers { producerBiomass: number; consumerBiomass: number; deadBiomass: number }

export interface LifeSummary {
  producers: number;
  consumers: number;
  generation: number;
  traitAverages: Record<string, number>;
}

/** One living animal. Positions are 0..1 across the terrain patch. */
export interface LifeAnimal {
  id: number;
  genome: AnimalGenome;
  x: number;
  y: number;
  heading: number;
  mode: LocomotionMode;
  role: number;
  size: number;
  energy: number;   // relative to the reproduction threshold (1 = ready to copy)
  generation: number;
}

export interface LifeModel {
  /** Called once, when life appears (build.lifeSec), with the conditions at that moment. */
  seedFounders(env: LifeEnv): void;
  /** Advance by `dtEcologySec` ecology seconds under `env`. */
  step(env: LifeEnv, dtEcologySec: number): void;
  /** Valid after step(). */
  drivers(): LifeDrivers;
  summary(): LifeSummary;
  /** Per-cell flora biomass on the 64² grid, interleaved [mat, canopy] per cell. A fresh copy each call. */
  floraBuffer(): Float32Array;
  /** Living animals in ascending id order. */
  animals(): LifeAnimal[];
}

export const FLORA_GRID = 64;
export const FLORA_FIELDS = 2; // mat, canopy

// Stand-in founder numbers for the population.ts adapter; the Ecology adapter brings its own.
const PRODUCER_FOUNDER_SHARE = 0.4;   // of the habitat's producer capacity, so founders never start above it
const MIN_PRODUCER_FOUNDERS = 24;
const CONSUMER_FOUNDERS = 24;
const CONSUMER_DELAY_SEC = 10;   // producers settle first, then the animals arrive (as in population.test.ts)
const FOUNDER_TOLERANCE = 8;
const FOUNDER_CHEM = 0.3;
const FOUNDER_SPREAD = { size: 0.1, prefTemp: 3, tolerance: 1, chem: 0.1 };

/**
 * Climate-core stand-in: producers are agents binned onto the flora grid; consumers are the animals, with the body
 * genes of a founder worm whose `size` gene follows the climate-core size. No heading or locomotion (all swim).
 */
export class PopulationLife implements LifeModel {
  private readonly pop: Population;
  private readonly template: AnimalGenome;
  private ecoSec = 0;
  private consumersSeeded = false;
  private dead = 0;
  private lastDt = 1;

  constructor(
    private readonly world: WorldConfig,
    seed: number,
    private readonly founderTemperature: number,
  ) {
    this.pop = new Population(world.life.rules, makeRng(seed)('population'));
    this.template = makeFounders(seed, 1, world.life.composition, {
      prefTemp: founderTemperature, tolerance: FOUNDER_TOLERANCE, chem: FOUNDER_CHEM,
    })[0];
  }

  seedFounders(env: LifeEnv): void {
    const capacity = this.world.life.rules.producerCapacity * Math.min(1, Math.max(0, env.habitat));
    this.pop.seed(
      Math.max(MIN_PRODUCER_FOUNDERS, Math.round(PRODUCER_FOUNDER_SHARE * capacity)),
      { role: PRODUCER, size: 1, prefTemp: this.founderTemperature, tolerance: FOUNDER_TOLERANCE, chem: 0 },
      FOUNDER_SPREAD,
    );
  }

  step(env: LifeEnv, dt: number): void {
    this.ecoSec += dt;
    if (!this.consumersSeeded && this.ecoSec >= CONSUMER_DELAY_SEC) {
      this.consumersSeeded = true;
      this.pop.seed(
        CONSUMER_FOUNDERS,
        { role: CONSUMER, size: 0.5, prefTemp: this.founderTemperature, tolerance: FOUNDER_TOLERANCE, chem: FOUNDER_CHEM },
        FOUNDER_SPREAD,
      );
    }
    this.pop.step(env, dt);
    this.dead = this.pop.takeDeadBiomass();
    this.lastDt = dt;
  }

  drivers(): LifeDrivers {
    const s = this.pop.stats();
    return { producerBiomass: s.producerBiomass, consumerBiomass: s.consumerBiomass, deadBiomass: this.dead / this.lastDt };
  }

  summary(): LifeSummary {
    const s = this.pop.stats();
    return { producers: s.producers, consumers: s.consumers, generation: s.generation, traitAverages: s.traitAverages };
  }

  floraBuffer(): Float32Array {
    const out = new Float32Array(FLORA_GRID * FLORA_GRID * FLORA_FIELDS);
    const { data, count } = this.pop.pack();
    for (let i = 0; i < count; i++) {
      const o = i * ORGANISM_STRIDE;
      if (data[o + OrganismField.role] !== PRODUCER) continue;
      const cx = Math.min(FLORA_GRID - 1, Math.floor(data[o + OrganismField.x] * FLORA_GRID));
      const cy = Math.min(FLORA_GRID - 1, Math.floor(data[o + OrganismField.y] * FLORA_GRID));
      const size = data[o + OrganismField.size];
      const c = (cy * FLORA_GRID + cx) * FLORA_FIELDS;
      out[c] += size;                      // mat: all producers
      out[c + 1] += Math.max(0, size - 1); // canopy: only the big ones
    }
    return out;
  }

  animals(): LifeAnimal[] {
    const { data, count } = this.pop.pack();
    const out: LifeAnimal[] = [];
    const [sLo, sHi] = this.world.life.rules.bounds.size;
    for (let i = 0; i < count; i++) {
      const o = i * ORGANISM_STRIDE;
      if (data[o + OrganismField.role] !== CONSUMER) continue;
      const id = data[o + OrganismField.id];
      const size = data[o + OrganismField.size];
      out.push({
        id,
        genome: {
          body: { ...this.template.body, size: Math.min(1, Math.max(0, (size - sLo) / (sHi - sLo))) },
          climate: {
            prefTemp: data[o + OrganismField.prefTemp],
            tolerance: data[o + OrganismField.tolerance],
            chem: data[o + OrganismField.chem],
          },
          comp: { ...this.world.life.composition },
          lineage: id,
        },
        x: data[o + OrganismField.x],
        y: data[o + OrganismField.y],
        heading: 0,
        mode: LOCOMOTION.swim,
        role: CONSUMER,
        size,
        energy: data[o + OrganismField.energy],
        generation: data[o + OrganismField.generation],
      });
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }
}
