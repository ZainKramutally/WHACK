// Population and evolution model (CLAUDE.md, "Life and evolution model").
//
// A few hundred organisms, each with a small genome. Every step, fitness comes from the
// current conditions; organisms gain energy, copy themselves with small mutations, and die
// from hunger, age or stress. Nothing about adaptation is scripted: the population shifts
// because selection acts on variation.
//
// Pure and deterministic: all randomness comes from the Rng passed in, organisms are visited
// in index order, and every coefficient comes from LifeRules (which live in each world's config).

import { CONSTANTS } from './constants';
import { gaussian, type Rng } from './rng';
import { ORGANISM_STRIDE, OrganismField } from './organismLayout';

export const PRODUCER = 0;
export const CONSUMER = 1;
export type Role = typeof PRODUCER | typeof CONSUMER;

export interface Genome {
  role: Role;
  size: number; // relative body size (1 = typical)
  prefTemp: number; // preferred temperature, °C
  tolerance: number; // temperature tolerance width (one standard deviation), °C
  chem: number; // 0..1: oxygen need (carbon) or cold stability (silicon)
}

/** The conditions the population feels this step. The worker builds it from the world's stats. */
export interface Environment {
  temperature: number; // mean surface temperature, °C
  oxygen: number; // free oxygen, % of the air
  light: number; // starlight relative to the world's reference (1 = reference)
  habitat: number; // 0..1 share of habitable space (e.g. sea cover on silicon, 1 on carbon)
  edgeStress: number; // 0..1, how close conditions are to a lethal limit (from sim/limits.ts)
}

/** Lives in each world's config as `life.rules`. Every number here is a world fact or a tuning value. */
export interface LifeRules {
  maxOrganisms: number;
  producerCapacity: number; // producers the habitat supports when habitat = 1
  timeScale: number; // reference-time units per demo second at pace 1
  metabolism: {
    activationEnergyKJ: number;
    referenceC: number;
    compression: number; // pace = arrhenius ^ compression (CLAUDE.md, "Metabolism")
  };
  producer: { lightGain: number; upkeep: number };
  consumer: {
    biteRate: number; // bite attempts per reference-time unit when food is plentiful
    biteSize: number; // energy taken per bite, per unit of body size
    assimilation: number; // share of a bite that becomes the consumer's energy
    upkeep: number;
    halfFood: number; // producer count at which bite attempts succeed half as often
    interference: number; // each consumer cuts the others' bite success as much as this many missing producers would
    grazeShare: number; // largest share of a producer's energy one bite can take, so grazing never wipes plants out
  };
  reproduction: {
    energyThreshold: number; // energy needed to copy, per unit of size^0.75
    childShare: number; // share of the parent's energy the child takes
    maturityAge: number; // reference-time units before an organism can copy
  };
  lifespan: number; // reference-time units, for size 1 (scales with size^0.25)
  toleranceCost: number; // extra upkeep per °C of tolerance: generalists pay for their range
  stressDeath: number; // death rate per reference-time unit at full stress
  edgeStressWeight: number; // how much nearness to a lethal limit adds to stress
  mutation: {
    size: number; // sd of the log-size step
    prefTemp: number; // sd, °C
    tolerance: number; // sd, °C
    chem: number; // sd
    roleFlip: number; // chance a child switches role
    jumpRate?: number; // ecology: share of births that make a large jump on 1-3 random body genes (default 0)
    jumpScale?: number; // and the jump's step size (default 0)
    dietBoost?: number; // ecology: the diet gene steps this many times further than the other body genes (default 1), so a lineage can cross from grazing to hunting
    sizeBoost?: number; // ecology: the body-size gene steps this many times further than the other body genes (default 1); size is the one trait that must travel a long way for megafauna to exist
  };
  bounds: { size: [number, number]; tolerance: [number, number] };
  chemTrait:
    | {
        kind: 'oxygenNeed'; // carbon: aerobic consumers get more from food, but need oxygen
        halfSaturation: number; // oxygen % at which aerobic metabolism runs at half its benefit
        aerobicBonus: number; // extra assimilation at full oxygen need and full oxygen
        baseMaxSize: number; // largest consumer body that can breathe with no oxygen
        maxSizePerPercent: number; // how much each % of oxygen raises that limit
        huntPenalty?: number; // the limit shrinks by 1 + huntPenalty × diet: active predators need more oxygen than grazers (Sperling et al. 2013); default 0
      }
    | {
        kind: 'coldStability'; // silicon: stiffer bonds resist warmth, at a cost
        warmRelief: number; // share of warm-side stress removed at full cold stability
        cost: number; // extra upkeep at full cold stability
      };
}

/** Largest body that can breathe at `o2` % oxygen (Fick diffusion; Graham 1995). `diet` 0 = grazer .. 1 = hunter. Shared by this model and ecology.ts. */
export function maxBodySize(ct: { baseMaxSize: number; maxSizePerPercent: number; huntPenalty?: number }, o2: number, diet = 0): number {
  return (ct.baseMaxSize + ct.maxSizePerPercent * Math.max(0, o2)) / (1 + (ct.huntPenalty ?? 0) * diet);
}

export interface PopulationStats {
  producers: number;
  consumers: number;
  producerBiomass: number; // Σ size of producers: the driver for photosynthesis-type feedbacks
  consumerBiomass: number; // Σ size of consumers: the driver for respiration-type feedbacks
  generation: number; // mean generation of living organisms
  traitAverages: Record<string, number>;
}

const GAS_CONSTANT = 8.314; // J/(mol·K), universal constant // implementation constant (DECISIONS §G.2 exempt)
const KELVIN = 273.15; // implementation constant (DECISIONS §G.2 exempt)

export function arrheniusFactor(tempC: number, m: LifeRules['metabolism']): number {
  const t = tempC + KELVIN;
  const tRef = m.referenceC + KELVIN;
  return Math.exp(-((m.activationEnergyKJ * 1000) / GAS_CONSTANT) * (1 / t - 1 / tRef));
}

/** Pace of life relative to the reference temperature, compressed so cold worlds still evolve visibly. */
export function pace(tempC: number, m: LifeRules['metabolism']): number {
  return arrheniusFactor(tempC, m) ** m.compression;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/** The three climate genes. Shared by Population births and the animal genome (genome.ts). */
export interface ClimateTraits { prefTemp: number; tolerance: number; chem: number }

/**
 * Climate-gene mutation: prefTemp + sd·N, tolerance + sd·N clamped to bounds, chem + sd·N clamped to [0, 1].
 * Draws in that order (3 gaussians). Used by Population.birth() and genome.ts mutate().
 */
export function mutateClimate(
  parent: ClimateTraits,
  rules: Pick<LifeRules, 'mutation' | 'bounds'>,
  rng: Rng,
): ClimateTraits {
  const m = rules.mutation;
  const [tLo, tHi] = rules.bounds.tolerance;
  return {
    prefTemp: parent.prefTemp + m.prefTemp * gaussian(rng),
    tolerance: clamp(parent.tolerance + m.tolerance * gaussian(rng), tLo, tHi),
    chem: clamp01(parent.chem + m.chem * gaussian(rng)),
  };
}
const wrap01 = (v: number) => v - Math.floor(v);

export class Population {
  readonly rules: LifeRules;
  private readonly rnd: Rng;
  private readonly cap: number;
  private readonly alive: Uint8Array;
  private readonly role: Uint8Array;
  private readonly size: Float64Array;
  private readonly prefTemp: Float64Array;
  private readonly tolerance: Float64Array;
  private readonly chem: Float64Array;
  private readonly energy: Float64Array;
  private readonly age: Float64Array;
  private readonly gen: Float64Array;
  private readonly id: Float64Array;
  private nextId = 1;
  private readonly x: Float64Array;
  private readonly y: Float64Array;
  private readonly prodList: Int32Array;
  private readonly free: number[] = [];
  private readonly births: number[] = [];
  private readonly birthEnergy: number[] = [];
  private living = 0;

  constructor(rules: LifeRules, rng: Rng) {
    this.rules = rules;
    this.rnd = rng;
    const n = (this.cap = rules.maxOrganisms);
    this.alive = new Uint8Array(n);
    this.role = new Uint8Array(n);
    this.size = new Float64Array(n);
    this.prefTemp = new Float64Array(n);
    this.tolerance = new Float64Array(n);
    this.chem = new Float64Array(n);
    this.energy = new Float64Array(n);
    this.age = new Float64Array(n);
    this.gen = new Float64Array(n);
    this.id = new Float64Array(n);
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.prodList = new Int32Array(n);
    for (let i = n - 1; i >= 0; i--) this.free.push(i); // pop() hands out 0, 1, 2…
  }

  get count(): number {
    return this.living;
  }

  /** Adds up to `count` founders around a genome. Returns how many were added. */
  seed(
    count: number,
    founder: Genome,
    spread: { size: number; prefTemp: number; tolerance: number; chem: number },
  ): number {
    const r = this.rules;
    let added = 0;
    for (let k = 0; k < count; k++) {
      const i = this.free.pop();
      if (i === undefined) break;
      this.alive[i] = 1;
      this.role[i] = founder.role;
      this.size[i] = clamp(founder.size * Math.exp(spread.size * this.g()), r.bounds.size[0], r.bounds.size[1]);
      this.prefTemp[i] = founder.prefTemp + spread.prefTemp * this.g();
      this.tolerance[i] = clamp(founder.tolerance + spread.tolerance * this.g(), r.bounds.tolerance[0], r.bounds.tolerance[1]);
      this.chem[i] = clamp01(founder.chem + spread.chem * this.g());
      this.energy[i] = 0.5 * r.reproduction.energyThreshold * this.size[i] ** 0.75;
      this.age[i] = 0;
      this.gen[i] = 0;
      this.id[i] = this.nextId++;
      this.x[i] = this.rnd();
      this.y[i] = this.rnd();
      this.living++;
      added++;
    }
    return added;
  }

  /** Advances the population by dtSec demo seconds under the given conditions. */
  step(env: Environment, dtSec: number): void {
    const r = this.rules;
    const dt = dtSec * r.timeScale * pace(env.temperature, r.metabolism);
    if (!(dt > 0)) return;

    // Producers available to graze this step, fixed before anyone acts.
    let nProd = 0;
    for (let i = 0; i < this.cap; i++) if (this.alive[i] && this.role[i] === PRODUCER) this.prodList[nProd++] = i;
    const nCons = this.living - nProd;

    const capacity = r.producerCapacity * clamp01(env.habitat);
    const crowd = capacity > 0 ? Math.max(0, 1 - nProd / capacity) : 0;
    // Beddington–DeAngelis: food gets harder to find with fewer producers and with more competing consumers.
    const foodChance = nProd / (nProd + r.consumer.halfFood + r.consumer.interference * nCons);
    const edge = r.edgeStressWeight * clamp01(env.edgeStress);
    const light = Math.max(0, env.light);
    const o2 = Math.max(0, env.oxygen);
    const ct = r.chemTrait;

    this.births.length = 0;
    this.birthEnergy.length = 0;

    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      const size = this.size[i];
      const sizeScale = size ** 0.75;
      const chem = this.chem[i];
      this.age[i] += dt;

      // How well this organism's comfort band fits the current temperature.
      let dev = env.temperature - this.prefTemp[i];
      if (ct.kind === 'coldStability' && dev > 0) dev *= 1 - ct.warmRelief * chem;
      const z = dev / this.tolerance[i];
      const match = Math.exp(-0.5 * z * z);
      let stress = 1 - match + edge;

      const isProducer = this.role[i] === PRODUCER;
      let upkeep = (isProducer ? r.producer.upkeep : r.consumer.upkeep) * sizeScale * (1 + r.toleranceCost * this.tolerance[i]);
      if (ct.kind === 'coldStability') upkeep *= 1 + ct.cost * chem;

      if (isProducer) {
        this.energy[i] += r.producer.lightGain * light * match * crowd * sizeScale * dt;
      } else {
        let efficiency = 1;
        if (ct.kind === 'oxygenNeed') {
          const avail = o2 / (o2 + ct.halfSaturation);
          efficiency = 1 - chem + chem * (1 + ct.aerobicBonus) * avail;
          const maxSize = maxBodySize(ct, o2);
          if (size > maxSize) stress += size / maxSize - 1;
        }
        if (nProd > 0 && this.rnd() < Math.min(1, r.consumer.biteRate * foodChance * dt)) {
          const j = this.prodList[Math.floor(this.rnd() * nProd)];
          if (this.alive[j]) {
            // A bite takes part of a plant, never all of it; heavily grazed plants can still starve on their own turn.
            const take = Math.min(r.consumer.grazeShare * this.energy[j], r.consumer.biteSize * size * match);
            this.energy[j] -= take;
            this.energy[i] += take * r.consumer.assimilation * efficiency;
          }
        }
      }

      this.energy[i] -= upkeep * dt;
      const s = clamp01(stress);
      if (this.energy[i] <= 0 || this.age[i] > r.lifespan * size ** 0.25 || this.rnd() < r.stressDeath * s * s * dt) {
        this.kill(i);
        continue;
      }

      if (this.age[i] >= r.reproduction.maturityAge && this.energy[i] >= r.reproduction.energyThreshold * sizeScale) {
        const childEnergy = this.energy[i] * r.reproduction.childShare;
        this.energy[i] -= childEnergy;
        this.births.push(i);
        this.birthEnergy.push(childEnergy);
      }
    }

    // Births land after everyone has acted, so newborns first act next step.
    for (let b = 0; b < this.births.length; b++) this.birth(this.births[b], this.birthEnergy[b]);

    const wander = CONSTANTS.WANDER.value * Math.min(1, dt);
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i] || this.role[i] !== CONSUMER) continue;
      this.x[i] = wrap01(this.x[i] + wander * this.g());
      this.y[i] = wrap01(this.y[i] + wander * this.g());
    }
  }

  stats(): PopulationStats {
    let producers = 0;
    let consumers = 0;
    let producerBiomass = 0;
    let consumerBiomass = 0;
    let gen = 0;
    let prefTemp = 0;
    let tolerance = 0;
    let size = 0;
    let chem = 0;
    let consumerSize = 0;
    let consumerChem = 0;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      gen += this.gen[i];
      prefTemp += this.prefTemp[i];
      tolerance += this.tolerance[i];
      size += this.size[i];
      chem += this.chem[i];
      if (this.role[i] === PRODUCER) {
        producers++;
        producerBiomass += this.size[i];
      } else {
        consumers++;
        consumerBiomass += this.size[i];
        consumerSize += this.size[i];
        consumerChem += this.chem[i];
      }
    }
    const n = this.living || 1;
    return {
      producers,
      consumers,
      producerBiomass,
      consumerBiomass,
      generation: gen / n,
      traitAverages: {
        prefTemp: prefTemp / n,
        tolerance: tolerance / n,
        size: size / n,
        chem: chem / n,
        consumerSize: consumers ? consumerSize / consumers : 0,
        consumerChem: consumers ? consumerChem / consumers : 0,
      },
    };
  }

  /** Packs living organisms into the snapshot buffer (layout in organismLayout.ts). */
  pack(): { data: Float32Array; count: number } {
    const data = new Float32Array(this.living * ORGANISM_STRIDE);
    const threshold = this.rules.reproduction.energyThreshold;
    let o = 0;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      data[o + OrganismField.x] = this.x[i];
      data[o + OrganismField.y] = this.y[i];
      data[o + OrganismField.role] = this.role[i];
      data[o + OrganismField.size] = this.size[i];
      data[o + OrganismField.prefTemp] = this.prefTemp[i];
      data[o + OrganismField.tolerance] = this.tolerance[i];
      data[o + OrganismField.chem] = this.chem[i];
      data[o + OrganismField.energy] = this.energy[i] / (threshold * this.size[i] ** 0.75);
      data[o + OrganismField.id] = this.id[i];
      data[o + OrganismField.generation] = this.gen[i];
      o += ORGANISM_STRIDE;
    }
    return { data, count: this.living };
  }

  private g(): number {
    return gaussian(this.rnd);
  }

  private kill(i: number): void {
    this.alive[i] = 0;
    this.living--;
    this.free.push(i);
  }

  private birth(p: number, energy: number): void {
    const i = this.free.pop();
    if (i === undefined) {
      if (this.alive[p]) this.energy[p] += energy; // no room: the parent keeps its energy
      return;
    }
    const r = this.rules;
    const m = r.mutation;
    this.alive[i] = 1;
    this.role[i] = this.rnd() < m.roleFlip ? 1 - this.role[p] : this.role[p];
    this.size[i] = clamp(this.size[p] * Math.exp(m.size * this.g()), r.bounds.size[0], r.bounds.size[1]);
    const cl = mutateClimate({ prefTemp: this.prefTemp[p], tolerance: this.tolerance[p], chem: this.chem[p] }, r, this.rnd);
    this.prefTemp[i] = cl.prefTemp;
    this.tolerance[i] = cl.tolerance;
    this.chem[i] = cl.chem;
    this.energy[i] = energy;
    this.age[i] = 0;
    this.gen[i] = this.gen[p] + 1;
    this.id[i] = this.nextId++;
    this.x[i] = wrap01(this.x[p] + CONSTANTS.SPAWN_SPREAD.value * this.g());
    this.y[i] = wrap01(this.y[p] + CONSTANTS.SPAWN_SPREAD.value * this.g());
    this.living++;
  }
}
