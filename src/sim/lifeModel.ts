// The seam between WorldSimulation (conditions, feedbacks, build clock, snapshots) and the ecology.
// WorldSimulation talks only to LifeModel; EcologyLife adapts the spatial ecology (ecology.ts).
import type { WorldConfig } from '../worlds/types';
import type { BodyPlan } from './develop';
import { CAP, Ecology, type EcologyLedger } from './ecology';
import type { AnimalGenome } from './genome';
import { CELLS, FLORA_STRIDE, createGrid } from './grid';
import type { GuideAnimal } from './guide';
import type { Environment } from './population';
import { packBodyPlan } from './plan';

/** What the ecology feels each tick: population.ts's Environment plus the extra inputs the full ecology reads. */
export interface LifeEnv extends Environment {
  heatBand: number;    // 0..1 temperature within the living band
  starlight: number;   // × Earth, absolute (Environment.light is starlight ÷ the world's lightFull, clamped 0..1)
  nitrogen: number;    // × Earth
  pressure: number;    // bar
  airDensity: number;  // kg/m³, real P·M/(R·T)
}

/** Quantities feedbacks read. `deadBiomass` is biomass that died per ecology second during the last step. */
export interface LifeDrivers { producerBiomass: number; consumerBiomass: number; deadBiomass: number }

export interface LifeSummary {
  producers: number;   // cells carrying flora
  consumers: number;   // living animals
  generation: number;
  traitAverages: Record<string, number>;
}

export interface LifeModel {
  /** Called once, when life appears (build.lifeSec), with the conditions at that moment and the player's spawn in patch coordinates (0..1). */
  seedFounders(env: LifeEnv, near?: { x: number; y: number }): void;
  /** Advance by `dtEcologySec` ecology seconds under `env`. */
  step(env: LifeEnv, dtEcologySec: number): void;
  /** Valid after step(). */
  drivers(): LifeDrivers;
  summary(): LifeSummary;
  /** Per-cell flora biomass on the 64² grid, interleaved [mat, canopy] per cell (FLORA_STRIDE). A fresh copy each call. */
  floraBuffer(): Float32Array;
  /** Living animals as the SimSnapshot.organisms buffer (layout in organismLayout.ts). A fresh buffer each call. */
  packOrganisms(): Float32Array;
  /** Living animals for the field guide. */
  guideAnimals(): GuideAnimal[];
  /** Packed develop() plans (plan.ts) of animals born since the last call. */
  drainBirths(): { id: number; plan: Float32Array }[];
  /** New static liquid depth per cell (the sea moved or the terrain rose). Optional. */
  setLiquid?(liquid: ArrayLike<number>): void;
}

// Fallback nutrient supply per cell until the world configs carry it (read from life.ledger supplyC/supplySi/supplyO).
const FALLBACK_SUPPLY = { c: 40, si: 0.4, o: 10 };

export interface EcologyLifeContext {
  /** Static liquid depth per cell at the moment life appears. */
  liquid(): ArrayLike<number>;
}

const EMPTY: LifeDrivers = { producerBiomass: 0, consumerBiomass: 0, deadBiomass: 0 };

/** Adapter over Ecology. Everything before seedFounders() reads as an empty world. */
export class EcologyLife implements LifeModel {
  private eco: Ecology | undefined;
  private drv: LifeDrivers = EMPTY;
  // slot snapshots to find animals that died during a step
  private readonly prevAlive = new Uint8Array(CAP);
  private readonly prevId = new Float64Array(CAP);
  private readonly prevMass = new Float64Array(CAP);

  constructor(
    private readonly world: WorldConfig,
    private readonly seed: number,
    private readonly ctx: EcologyLifeContext,
  ) {}

  seedFounders(env: LifeEnv, near?: { x: number; y: number }): void {
    const w = this.world;
    const led = w.life.ledger;
    const supply = {
      c: led.supplyC ?? FALLBACK_SUPPLY.c,
      si: led.supplySi ?? FALLBACK_SUPPLY.si,
      o: led.supplyO ?? FALLBACK_SUPPLY.o,
    };
    const fixed = w.life.inputs;
    this.eco = new Ecology({
      seed: this.seed,
      grid: createGrid({ liquid: this.ctx.liquid(), supply }),
      rules: w.life.rules,
      inputs: {
        solvent: fixed.solvent,
        airDensity: env.airDensity * fixed.airDensity.scale,
        tissueDensity: fixed.tissueDensity,
      },
      composition: w.life.composition,
      founderClimate: { prefTemp: w.life.founders.prefTemp, tolerance: w.life.founders.tolerance, chem: w.life.founders.chem },
      ledger: led as Partial<EcologyLedger>,
    });
    this.eco.seedLife(env, near);
    this.remember();
  }

  step(env: LifeEnv, dt: number): void {
    const eco = this.eco;
    if (!eco) return;
    eco.step(env, dt);
    let dead = 0;
    for (let i = 0; i < CAP; i++) {
      if (this.prevAlive[i] && (!eco.alive[i] || eco.id[i] !== this.prevId[i])) dead += this.prevMass[i];
    }
    this.remember();
    const b = eco.biomass();
    this.drv = { producerBiomass: b.producerBiomass, consumerBiomass: b.consumerBiomass, deadBiomass: dead / dt };
  }

  drivers(): LifeDrivers { return this.drv; }

  summary(): LifeSummary {
    const eco = this.eco;
    if (!eco) return { producers: 0, consumers: 0, generation: 0, traitAverages: {} };
    const s = eco.stats();
    let cells = 0;
    for (let i = 0; i < CELLS; i++) if (eco.grid.mat[i] + eco.grid.canopy[i] > 0.01) cells++;
    return { producers: cells, consumers: s.animals, generation: s.generation, traitAverages: s.traitAverages };
  }

  floraBuffer(): Float32Array { return this.eco ? this.eco.floraSnapshot() : new Float32Array(FLORA_STRIDE * CELLS); }

  packOrganisms(): Float32Array { return this.eco ? this.eco.packOrganisms().data : new Float32Array(0); }

  guideAnimals(): GuideAnimal[] {
    const eco = this.eco;
    if (!eco) return [];
    const out: GuideAnimal[] = [];
    for (let i = 0; i < CAP; i++) if (eco.alive[i]) out.push({ id: eco.id[i], genome: eco.genome[i] as AnimalGenome, mode: eco.plan[i].mode });
    return out;
  }

  drainBirths(): { id: number; plan: Float32Array }[] {
    return this.eco ? this.eco.drainBirths().map((b: { id: number; plan: BodyPlan }) => ({ id: b.id, plan: packBodyPlan(b.plan) })) : [];
  }

  setLiquid(liquid: ArrayLike<number>): void {
    if (!this.eco) return;
    const g = this.eco.grid.liquid;
    for (let i = 0; i < CELLS; i++) g[i] = Math.max(0, liquid[i]);
  }

  private remember(): void {
    const eco = this.eco!;
    this.prevAlive.set(eco.alive);
    for (let i = 0; i < CAP; i++) { this.prevId[i] = eco.id[i]; this.prevMass[i] = eco.struct[i]; }
  }
}
