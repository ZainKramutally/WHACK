// The spatial ecology: DECISIONS §3's 12 rules on the one 64² grid, grown from population.ts (it reuses
// LifeRules, Environment, pace() and mutateClimate). One utility loop for every animal, relationships derived
// from bodies, flora as per-cell biomass (not agents), fixed 20 Hz ticks, deterministic per seed.
// No preset code, no cheats, no rendering fields. Matter is conserved (see matterTotal()).
//
// Rule map:  R1 stepFlora · R2 nutrients (Liebig) + dissolve() · R3 upkeep · R4 eatsIntensity + ε · R5 decide()
// R6 relationships.ts + inducible plates · R7 shelter()/home/builders · R8 bud() · R9 develop() at birth
// R10 bestMode() + moveCost · R11 returnMatter() · R12 nothing here reads rendering.
import { CONSTANTS } from './constants';
import { flightCeiling, climbRate } from './flight';
import { develop, LOCOMOTION, type BodyPlan, type DevelopInputs } from './develop';
import { makeFounders, mutate, type AnimalGenome, type ClimateGenes, type Composition } from './genome';
import { CELLS, FLORA_STRIDE, GRID, cellOf, type Grid } from './grid';
import { ORGANISM_STRIDE, packOrganism } from './organismLayout';
import { pace, type Environment, type LifeRules } from './population';
import { eatsIntensity, kinStrength } from './relationships';
import { makeRng, gaussian, type Rng } from './rng';

export const TICK_HZ = 20;
export const CAP = 1024;

/** The sim's inputs for one step: population.ts's Environment plus the living-band heat for develop(). */
export interface EcologyEnv extends Environment { heatBand: number; /** real surface air density, kg/m³ (default: the founders' inputs) */ airDensity?: number; /** body-gene mutation σ for births this tick (default SIGMA) */ mutationSigma?: number }

/**
 * World-config `life.ledger`: scalings that turn the rules into numbers (units: matter = animal mass = energy).
 * Every value needs a `why` in the world config; these defaults are test fixtures only.
 */
export interface EcologyLedger {
  massUnit: number; // kg of develop() mass per matter unit
  floraLightGain: number; // flora light efficiency: effective light = min(1, light × this), so dim-star flora can still grow
  upkeepScale: number; // converts B0·M^0.75 into matter per ecology second
  cellMass: number; // matter in a cell fully covered by flora (biomass 1)
  shadeK: number; // Beer–Lambert: light under canopy = light·exp(−shadeK·canopy)
  waterAttn: number; // light lost per unit of liquid depth
  canopyRate: number; // canopy growth relative to mat growth
  floraDecay: number; // share of flora lost per ecology second (returned as nutrients)
  spread: number; // how strongly neighbouring mats seed an empty cell
  seedMat: number; // flora biomass planted in the shallows when life appears
  shallowMax: number; // liquid depth that still counts as shallows
  deepLiquid: number; // liquid depth that gives full shelter
  wadeDepth: number; // deepest liquid a walker can cross
  intake: number; // matter per second per unit M^0.75 at full appetite
  speed: number; // cells per ecology second
  moveCost: number; // matter per unit M^0.75 per cell moved, × the mode's cost
  catchRate: number; // catch attempts per ecology second when in reach
  buildRate: number; // stone matter per unit M^0.75 per ecology second while resting at home
  senseBase: number; // cells
  senseGain: number; // extra cells at full eyes in full light
  lureWeight: number; // how strongly grazers are drawn to glow
  glowCost: number; // extra upkeep share at full glow
  sizeRef: number; // body length (m) that counts as size 1 for the oxygen cap
  hungerTime: number; // seconds of standing flora counted as one second of supply
  founders: number; // seeded capsule worms when life appears (≥ 24)
  canopyReach: number; // metres of limb a body needs to reach canopy biomass (fliers always reach it); small bodies graze the mat only
  deepScale: number; // body length (m) a swimmer needs to feed in water deeper than the shallows (shallowMax); smaller swimmers feed only in the shallows
  meatAssim: number; // share of a kill's whole body (tissue + energy) a hunter keeps; 0 = use the plant transfer ε. Eating a whole animal is far more efficient than grazing a thin mat
  grazeReach: number; // metres of body length per extra cell of grazing radius (0 = grazers feed only in their own cell): big bodies feed over a footprint, so their intake does not saturate at one cell
  growRate: number; // share of its body mass a juvenile converts from energy to body per ecology second (0 = born adult). Lets a large mutant be born small and grow
  cohesion: number; // share of the distance to the kin centroid (cells) an animal closes per decision, times its sociality gene: herds and packs form; low-sociality hunters stay solitary
  intakeExp: number; // body-mass exponent of the food an animal can take in (upkeep scales as KLEIBER = 0.75); above it big bodies out-eat their upkeep
}

export const DEFAULT_LEDGER: EcologyLedger = {
  massUnit: 1, floraLightGain: 1, upkeepScale: 0.02, cellMass: 40, shadeK: 1.2, waterAttn: 0.3, canopyRate: 0.3, floraDecay: 0.02, spread: 0.5,
  seedMat: 0.3, shallowMax: 2, deepLiquid: 6, wadeDepth: 0.5, intake: 1.5, speed: 1.5, moveCost: 0.01,
  catchRate: 1, buildRate: 0.05, senseBase: 0.7, senseGain: 0.8, lureWeight: 0.5, glowCost: 0.3, sizeRef: 1,
  hungerTime: 10, founders: 24, canopyReach: 0, deepScale: 0, meatAssim: 0, grazeReach: 0, growRate: 0, cohesion: 1, intakeExp: 0.75,
};

export interface EcologyOptions {
  seed: number;
  grid: Grid;
  rules: LifeRules;
  inputs: DevelopInputs; // airDensity already scaled
  composition: Composition; // the world's flora and body recipe
  founderClimate: ClimateGenes;
  ledger?: Partial<EcologyLedger>;
}

// implementation constant (DECISIONS §G.2 exempt)
// implementation constant (DECISIONS §G.2 exempt)
const ACT = { rest: 0, forage: 1, hunt: 2, flee: 3, home: 4, bud: 5 } as const;
const DECIDE_EVERY = 4; // implementation constant (DECISIONS §G.2 exempt): an animal re-decides every 4th tick (staggered by index); it moves and eats every tick
const RISK_EVERY = 40; // implementation constant (DECISIONS §G.2 exempt): derived fields (risk, hunger) refresh every 2 s
const FLORA_EVERY = 4; // implementation constant (DECISIONS §G.2 exempt): flora (slow) updates every 4th tick with 4× the step
const SCAN = 12; // implementation constant (DECISIONS §G.2 exempt): an animal looks at no more than this many neighbours per cell (bounds crowded cells)
const FLORA_SEED = 1e-3; // implementation constant (DECISIONS §G.2 exempt): mat that survives lethal stress, from which flora regrows
const STRAND_SCAN = 6; // implementation constant (DECISIONS §G.2 exempt): cells a stranded animal looks around for ground that suits it
const SPORE_ENERGY = 1.9; // implementation constant (DECISIONS §G.2 exempt): a germinating spore's energy as a share of its body mass (a bud needs 2)
const SLOT_RADIUS = 2; // implementation constant (DECISIONS §G.2 exempt): cells within which a full world's ready parent can displace the weakest animal
const SLOT_MARGIN = 0.25; // implementation constant (DECISIONS §G.2 exempt): a victim must have less than this share of the parent's energy per unit mass
const DEEP_FLOOR = 0.3; // implementation constant (DECISIONS §G.2 exempt): the share of deep-water food the smallest swimmer can still use
const DIGEST_FLOOR = 0.25; // implementation constant (DECISIONS §G.2 exempt): the share of a kill's assimilation a diet-0 animal keeps; a full carnivore keeps all of it
const MATURE = 0.9; // implementation constant (DECISIONS §G.2 exempt): share of its adult mass an animal needs before it can bud
const SPORE_BANK = 24; // implementation constant (DECISIONS §G.2 exempt): dormant genomes kept (issue #6)
const SPORES_PER_TICK = 8; // implementation constant (DECISIONS §G.2 exempt): at most this many germinate in one tick

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Ecology {
  readonly grid: Grid;
  readonly L: EcologyLedger;
  readonly rules: LifeRules;
  readonly comp: Composition;
  tick = 0;
  hunger = 0;
  /** Matter added from outside (founders, first flora): matterTotal() − injected is constant. */
  injected = 0;
  // animals, structure of arrays (index = slot; slots are reused, ids never are)
  readonly alive = new Uint8Array(CAP);
  readonly id = new Float64Array(CAP);
  readonly gen = new Int32Array(CAP);
  readonly x = new Float64Array(CAP);
  readonly y = new Float64Array(CAP);
  readonly energy = new Float64Array(CAP);
  readonly age = new Float64Array(CAP);
  readonly struct = new Float64Array(CAP); // body matter M
  readonly adult = new Float64Array(CAP); // the adult body matter this animal grows toward (struct < adult while it is a juvenile)
  readonly genome: AnimalGenome[] = new Array(CAP);
  readonly plan: BodyPlan[] = new Array(CAP);
  readonly mode = new Uint8Array(CAP); // locomotion mode at the last move
  readonly heading = new Float64Array(CAP); // radians, direction of the last move
  readonly alt = new Float64Array(CAP); // metres above the ground; climbs and sinks with what the animal is doing (flight.ts), 0 unless flying
  private readonly ceil = new Float64Array(CAP); // flight ceiling in metres, refreshed when the animal re-decides
  private readonly home = new Int32Array(CAP);
  private readonly act = new Uint8Array(CAP);
  private readonly wandering = new Uint8Array(CAP); // 1 while an animal grazes on the move (no better food within reach)
  private readonly tgt = new Int32Array(CAP).fill(-1);
  private readonly tgtId = new Float64Array(CAP);
  private readonly tx = new Float64Array(CAP);
  private readonly ty = new Float64Array(CAP);
  private readonly afraidSeen = new Float64Array(CAP);
  private readonly free: number[] = [];
  private living = 0;
  private nextId = 1;
  private readonly cellStart = new Int32Array(CELLS + 1);
  private readonly cellItems = new Int32Array(CAP);
  private readonly births: { id: number; plan: BodyPlan }[] = [];
  private readonly pendingBuds: number[] = [];
  private readonly rnd: Rng;
  private readonly inputs: DevelopInputs;
  private readonly founderClimate: ClimateGenes;
  private readonly seed: number;
  private env: EcologyEnv = { temperature: 15, oxygen: 21, light: 1, habitat: 1, edgeStress: 0, heatBand: 0.5 };
  private dt = 0;
  /** Spore bank (owner ruling, issue #6): genomes of animals that died recently, best climate fit first to be kept. */
  private readonly spores: AnimalGenome[] = [];
  /** Shallow cells where life was seeded (nearest the spawn, if a hint was given); spores germinate here. */
  private founderPool: number[] = [];
  /** Cells where swimmers (sea) and walkers/hoverers (land and shore) are placed when they appear without a parent. */
  private seaPool: number[] = [];
  private landPool: number[] = [];

  constructor(o: EcologyOptions) {
    this.grid = o.grid;
    this.rules = o.rules;
    this.comp = o.composition;
    this.inputs = o.inputs;
    this.founderClimate = o.founderClimate;
    this.seed = o.seed;
    this.L = { ...DEFAULT_LEDGER, ...o.ledger };
    this.rnd = makeRng(o.seed)('ecology');
    for (let i = CAP - 1; i >= 0; i--) this.free.push(i);
  }

  get animals(): number { return this.living; }

  /** Dormant spores held (they do not eat, move or count as population). */
  get sporeCount(): number { return this.spores.length; }

  /**
   * The founders appear in the shallows with a first patch of flora (build.lifeSec). Seeded; same seed, same worms.
   * `near` (patch coordinates 0..1, e.g. the player's spawn) puts the founders in the shallows closest to it, so life
   * can be seen from the spawn shore; without it they are spread over every shallow cell.
   */
  seedLife(env: EcologyEnv, near?: { x: number; y: number }): void {
    const g = this.grid;
    const L = this.L;
    const shallows: number[] = [];
    for (let i = 0; i < CELLS; i++) if (g.liquid[i] > 0 && g.liquid[i] <= L.shallowMax) shallows.push(i);
    const wet: number[] = [];
    if (shallows.length === 0) for (let i = 0; i < CELLS; i++) if (g.liquid[i] > 0) wet.push(i);
    const spots = shallows.length ? shallows : wet;
    for (const i of spots) this.plant(i, L.seedMat);
    let pool = spots.length ? spots : Array.from({ length: CELLS }, (_, i) => i);
    if (!spots.length) for (const i of pool) this.plant(i, 0.05);
    // Nearest first (ties by cell index, so it is deterministic); with a spawn hint founders use only the closest FOUNDER_CELLS cells.
    const nearest = (cells: number[]) => {
      if (!near) return cells;
      const d2 = (c: number) => ((c % GRID) + 0.5 - near.x * GRID) ** 2 + (Math.floor(c / GRID) + 0.5 - near.y * GRID) ** 2;
      return [...cells].sort((a, b) => d2(a) - d2(b) || a - b).slice(0, CONSTANTS.FOUNDER_CELLS.value);
    };
    pool = nearest(pool);
    // Founders are placed by what their bodies are: swimmers in the sea (deep enough to swim), walkers and hoverers on the
    // shore and land nearest the spawn (habitat lock). Both niches exist from the first second.
    const sea: number[] = [];
    const land: number[] = [];
    for (let i = 0; i < CELLS; i++) (g.liquid[i] > L.wadeDepth ? sea : land).push(i);
    const seaPool = nearest(sea);
    const landPool = nearest(land);
    for (const i of seaPool) this.plant(i, L.seedMat);
    for (const i of landPool) this.plant(i, L.seedMat);
    this.seaPool = seaPool;
    this.landPool = landPool.length ? landPool : pool;
    this.founderPool = seaPool.length ? [...this.landPool, ...seaPool] : this.landPool;
    const founders = makeFounders(this.seed, Math.max(24, L.founders), this.comp, this.founderClimate);
    founders.forEach((gen, k) => {
      const from = k % 2 === 1 && seaPool.length > 0 ? seaPool : pool;   // spawn() re-places a founder whose body does not suit the cell
      const cell = from[Math.floor(this.rnd() * from.length)];
      const px = (cell % GRID) + this.rnd();
      const py = Math.floor(cell / GRID) + this.rnd();
      this.spawn(gen, px, py, 0, null, env);
    });
  }

  private plant(cell: number, mat: number): void {
    const add = mat - this.grid.mat[cell];
    if (add <= 0) return;
    this.grid.mat[cell] = mat;
    this.injected += add * this.L.cellMass;
  }

  /** Advance one tick of dtSec demo seconds (normally 1/20). */
  step(env: EcologyEnv, dtSec: number): void {
    this.dt = dtSec * this.rules.timeScale * pace(env.temperature, this.rules.metabolism);
    if (!(this.dt > 0)) return;
    this.env = env;
    this.tick++;
    if (this.living < CONSTANTS.SPORE_BELOW.value && this.spores.length > 0) this.germinate();
    if (this.tick % RISK_EVERY === 1) this.refreshDerived();
    if (this.tick % FLORA_EVERY === 0) this.stepFlora(this.dt * FLORA_EVERY);
    this.dissolve();
    this.buildBuckets();
    this.pendingBuds.length = 0;
    for (let i = 0; i < CAP; i++) if (this.alive[i]) this.actAnimal(i);
    for (const p of this.pendingBuds) this.bud(p);
  }

  // ---- R1 + R2: flora grows where light and nutrients meet, limited by the scarcest of C/Si/O -------------
  private stepFlora(dt: number): void {
    const { grid: g, L } = this;
    const P0 = CONSTANTS.P0.value;
    const hab = clamp01(this.env.habitat);
    // The lethal limits stress producers like animals: the same edge stress that kills animals (stressDeath·s²) strips flora
    // and stops its growth at the edge of the living band, and is negligible inside it (cubic ramp).
    const edge = clamp01(this.env.edgeStress);
    const decay = Math.min(1, L.floraDecay * dt + this.rules.stressDeath * edge * edge * dt);
    const vigour = 1 - edge;
    const sun = Math.min(1, this.env.light * L.floraLightGain);
    const cm = L.cellMass;
    for (let i = 0; i < CELLS; i++) {
      // decay returns nutrients
      let b = g.mat[i];
      let can = g.canopy[i];
      if (decay > 0 && (b > 0 || can > 0)) {
        // Under lethal stress a seed bank of mat survives (so the flora can regrow when conditions return); canopy does not.
        const floor = edge > 0 ? Math.min(b, FLORA_SEED) : 0;
        const bLoss = Math.min(b * decay, b - floor);
        const cLoss = can * decay;
        this.returnMatter(i, (bLoss + cLoss) * cm, 0);
        b -= bLoss;
        can -= cLoss;
      }
      const wet = g.liquid[i] > 0;
      const light = sun * Math.exp(-L.shadeK * can - L.waterAttn * g.liquid[i]);
      g.light[i] = light;
      const x = i % GRID;
      const y = (i / GRID) | 0;
      let nb = 0;
      let nn = 0;
      if (x > 0) { nb += g.mat[i - 1]; nn++; }
      if (x < GRID - 1) { nb += g.mat[i + 1]; nn++; }
      if (y > 0) { nb += g.mat[i - GRID]; nn++; }
      if (y < GRID - 1) { nb += g.mat[i + GRID]; nn++; }
      let grow = vigour * P0 * dt * hab * light * (b + L.spread * (nb / nn)) * (1 - b);
      grow = this.limit(i, grow, 1 - b);
      b += grow;
      let growC = 0;
      if (!wet) {
        growC = vigour * P0 * dt * hab * sun * L.canopyRate * b * (1 - can);
        growC = this.limit(i, growC, 1 - can);
        can += growC;
      }
      g.mat[i] = b;
      g.canopy[i] = can;
    }
  }

  /** Liebig: the most flora (biomass units) the cell's scarcest nutrient allows; consumes the nutrients. */
  private limit(i: number, want: number, room: number): number {
    if (want <= 0) return 0;
    const g = this.grid;
    const cp = this.comp;
    const cm = this.L.cellMass;
    let a = Math.min(want, room);
    if (cp.c > 0) a = Math.min(a, g.c[i] / (cp.c * cm));
    if (cp.si > 0) a = Math.min(a, g.si[i] / (cp.si * cm));
    if (cp.o > 0) a = Math.min(a, g.o[i] / (cp.o * cm));
    if (a <= 0) return 0;
    g.c[i] -= a * cp.c * cm;
    g.si[i] -= a * cp.si * cm;
    g.o[i] -= a * cp.o * cm;
    return a;
  }

  /** R2: the solvent dissolves stone back into Si and O, in proportion to its polarity ε_r. */
  private dissolve(): void {
    const g = this.grid;
    const k = Math.min(1, (CONSTANTS.DISSOLVE.value * this.inputs.solvent.epsilonR / 80) * this.dt);
    if (k <= 0) return;
    for (let i = 0; i < CELLS; i++) {
      if (g.stone[i] > 0 && g.liquid[i] > 0) {
        const s = g.stone[i] * k;
        g.stone[i] -= s;
        const sp = this.comp.si + this.comp.o;
        if (sp > 0) { g.si[i] += s * this.comp.si / sp; g.o[i] += s * this.comp.o / sp; } else g.si[i] += s;
      }
    }
  }

  /**
   * R11: matter goes back to the cell. C always returns as nutrient; the Si+O share of a corpse becomes stone in
   * proportion to its `plateShare` (the hard parts), the rest returns as nutrients.
   */
  private returnMatter(cell: number, amount: number, plateShare: number): void {
    if (amount <= 0) return;
    const g = this.grid;
    const cp = this.comp;
    g.c[cell] += amount * cp.c;
    const si = amount * cp.si;
    const o = amount * cp.o;
    const toStone = cp.si > 0 && cp.o > 0 ? clamp01(plateShare) : 0;
    g.stone[cell] += (si + o) * toStone;
    g.si[cell] += si * (1 - toStone);
    g.o[cell] += o * (1 - toStone);
  }

  /** Stone, canopy and deep liquid are shelter (R7). */
  /** Comfort-band fit 0..1 of a climate genome at a temperature, with shelter `sh` pulling the animal toward mild (R7). */
  private climateMatch(cl: ClimateGenes, temperature: number, sh: number): number {
    let dev = (temperature - cl.prefTemp) * (1 - CONSTANTS.REFUGE.value * sh);
    const ct = this.rules.chemTrait;
    if (ct.kind === 'coldStability' && dev > 0) dev *= 1 - ct.warmRelief * cl.chem;
    const z = dev / cl.tolerance;
    return Math.exp(-0.5 * z * z);
  }

  /**
   * Effective climate fit: the comfort-band match lifted by CLIMATE_FLOOR, so a mismatched animal inside the living band
   * eats less and is stressed but does not die of mismatch alone. Death at the band's edge comes from env.edgeStress.
   */
  private climateFit(cl: ClimateGenes, temperature: number, sh: number): number {
    const f = CONSTANTS.CLIMATE_FLOOR.value;
    return f + (1 - f) * this.climateMatch(cl, temperature, sh);
  }

  /** Banks the genome of an animal that is dying, keeping the best fit to the conditions right now (ties go to the newest). */
  private bankSpore(i: number): void {
    const g = this.genome[i];
    const fit = this.climateMatch(g.climate, this.env.temperature, 0);
    if (this.spores.length < SPORE_BANK) { this.spores.push(g); return; }
    let worst = 0;
    let worstFit = Infinity;
    for (let k = 0; k < this.spores.length; k++) {
      const f = this.climateMatch(this.spores[k].climate, this.env.temperature, 0);
      if (f < worstFit) { worstFit = f; worst = k; }
    }
    if (fit >= worstFit) this.spores[worst] = g;
  }

  /** With (almost) no animals left, spores whose fit at their shallow cell is viable germinate as founders, with mutation. */
  private germinate(): void {
    const pool = this.founderPool;
    if (pool.length === 0) return;
    let n = 0;
    for (let k = 0; k < this.spores.length && n < SPORES_PER_TICK; ) {
      const cell = pool[Math.floor(this.rnd() * pool.length)];
      const fit = this.climateMatch(this.spores[k].climate, this.env.temperature, this.shelter(cell));
      if (fit < CONSTANTS.SPORE_VIABILITY.value) { k++; continue; }
      const child = mutate(this.spores[k], this.rnd, this.rules, this.env.mutationSigma);
      this.spores.splice(k, 1);
      if (this.spawn(child, (cell % GRID) + this.rnd(), Math.floor(cell / GRID) + this.rnd(), 0, null, this.env, SPORE_ENERGY)) n++;   // a spore carries reserves: it can bud almost at once
    }
  }

  private shelter(cell: number): number {
    const g = this.grid;
    return Math.max(clamp01(g.stone[cell]), clamp01(g.canopy[cell]), clamp01(g.liquid[cell] / this.L.deepLiquid));
  }

  // ---- derived fields: risk (landscape of fear) and Hunger (plant scarcity) ---------------------------------
  private refreshDerived(): void {
    const g = this.grid;
    g.risk.fill(0);
    let demand = 0;
    for (let i = 0; i < CAP; i++) {
      if (!this.alive[i]) continue;
      const p = this.plan[i];
      const threat = p.meatGain;
      if (threat > 0.01) {
        const c = cellOf(this.x[i], this.y[i]);
        const cx = c % GRID;
        const cy = (c / GRID) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
            g.risk[ny * GRID + nx] += threat * (dx === 0 && dy === 0 ? 1 : 0.4);
          }
        }
      }
      demand += this.L.intake * this.struct[i] ** this.L.intakeExp * p.plantGain;
    }
    for (let i = 0; i < CELLS; i++) g.risk[i] = 1 - Math.exp(-g.risk[i]);
    let standing = 0;
    for (let i = 0; i < CELLS; i++) standing += g.mat[i] + g.canopy[i];
    const supply = (standing * this.L.cellMass) / this.L.hungerTime;
    this.hunger = demand > 0 ? clamp01(demand / (demand + supply)) : 0;
  }

  private buildBuckets(): void {
    const cs = this.cellStart;
    cs.fill(0);
    for (let i = 0; i < CAP; i++) if (this.alive[i]) cs[cellOf(this.x[i], this.y[i]) + 1]++;
    for (let c = 0; c < CELLS; c++) cs[c + 1] += cs[c];
    const cursor = this.cursor;
    cursor.set(cs.subarray(0, CELLS));
    for (let i = 0; i < CAP; i++) if (this.alive[i]) this.cellItems[cursor[cellOf(this.x[i], this.y[i])]++] = i;
  }
  private readonly cursor = new Int32Array(CELLS);

  // ---- R10: the cheapest locomotion the medium allows -----------------------------------------------------------
  /** Habitat lock: a swimmer lives in the sea (any liquid), a walker or hoverer where it can stand or fly (liquid up to wadeDepth). */
  /** R4 niche: canopy biomass is reachable only by bodies with long enough limbs (or fliers). */
  private canopyAccess(p: BodyPlan): number {
    if (p.mode === LOCOMOTION.hover) return 1;
    if (p.legPairs === 0) return 0;
    const r = this.L.canopyReach > 0 ? p.limbLength / this.L.canopyReach : 1;
    return r >= 1 ? 1 : r;   // reach grows with limb length up to the full canopy height
  }
  /** R4 niche: food in deep water is reachable only by large bodies; the shallows feed everyone. */
  private deepOk(p: BodyPlan, liquid: number): number {
    if (liquid <= this.L.shallowMax || this.L.deepScale <= 0) return 1;
    const r = p.scale / this.L.deepScale;
    return r >= 1 ? 1 : DEEP_FLOOR + (1 - DEEP_FLOOR) * r;   // small swimmers get a floor share of deep-water food; it grows with length up to deepScale
  }
  private habitable(p: Pick<BodyPlan, 'mode'>, liquid: number): boolean {
    if (p.mode === LOCOMOTION.swim) return liquid > 0;
    if (p.mode === LOCOMOTION.sessile) return true;
    return liquid <= this.L.wadeDepth;
  }

  /** Cheapest mode for entering a cell; sessile means the animal cannot go there. A stranded animal (its own cell is wrong for its body, e.g. the sea rose under it) moves in its own mode wherever it must to get home. */
  private bestMode(p: BodyPlan, liquid: number, stranded = false): number {
    if (stranded) return p.mode;   // struggling home in its own mode, at that mode's cost
    if (!this.habitable(p, liquid)) return LOCOMOTION.sessile;
    const mc = p.modeCosts;
    let mode: number = LOCOMOTION.sessile;
    let best = mc.sessile;
    if (liquid <= this.L.wadeDepth && mc.walk < best) { best = mc.walk; mode = LOCOMOTION.walk; }
    if (liquid > 0 && mc.swim < best) { best = mc.swim; mode = LOCOMOTION.swim; }
    if (liquid <= this.L.wadeDepth && mc.hover < best) { mode = LOCOMOTION.hover; } // hover is flight: over land and the shore, never over the sea
    return mode;
  }
  private modeCost(p: BodyPlan, mode: number): number {
    const mc = p.modeCosts;
    return mode === LOCOMOTION.walk ? mc.walk : mode === LOCOMOTION.swim ? mc.swim : mode === LOCOMOTION.hover ? mc.hover : mc.sessile;
  }

  /** Flight ceiling (m) of a body under the live conditions (flight.ts). 0 without flight coefficients or a lift surface. */
  private ceilingOf(p: BodyPlan): number {
    const fp = this.inputs.flight;
    if (!fp || !p.liftSpan) return 0;
    return flightCeiling(p as Required<Pick<BodyPlan, 'mass' | 'liftSpan' | 'bodyDensity' | 'chemistry'>>, this.flightEnv(), fp, this.inputs.tissueDensity.C);
  }
  private flightEnv() {
    const fp = this.inputs.flight!;
    return {
      gravity: this.inputs.gravity,
      temperatureC: this.env.temperature,
      oxygenPct: this.env.oxygen,
      airKgM3: this.env.airDensity ?? this.inputs.airDensity / fp.airScale,
    };
  }

  /** Altitude state: a flier forages low, climbs toward a cruise height (a share of its ceiling) when travelling or fleeing, and lands to rest. */
  private stepAltitude(i: number, act: number): void {
    const fp = this.inputs.flight;
    const p = this.plan[i];
    const h = this.alt[i];
    if (!fp) return;
    if (this.mode[i] !== LOCOMOTION.hover) {
      if (h > 0) this.alt[i] = Math.max(0, h - fp.sinkRate * this.dt);
      return;
    }
    const ceil = this.ceil[i];
    const low = Math.min(ceil, fp.forageLengths * p.scale);
    let target = low;
    if (act === ACT.rest || act === ACT.bud) target = 0;
    else if (act === ACT.flee || act === ACT.home || (act === ACT.forage && this.wandering[i])) target = fp.cruiseFrac * ceil;
    if (target > h) {
      const up = p.liftSpan ? climbRate(p as Required<Pick<BodyPlan, 'mass' | 'liftSpan' | 'chemistry'>>, this.flightEnv(), fp, h) : 0;
      // A body with no powered excess (a gas-bag floater) still rises by its own lightness, at buoyRise.
      this.alt[i] = Math.min(target, h + Math.max(up, fp.buoyRise) * this.dt);
    } else {
      this.alt[i] = Math.max(target, h - fp.sinkRate * this.dt);
    }
  }

  // ---- R5: one utility loop for every animal -----------------------------------------------------------------------
  private decide(i: number): void {
    const { grid: g, L } = this;
    const p = this.plan[i];
    const m = this.struct[i];
    const E = this.energy[i];
    const cell = cellOf(this.x[i], this.y[i]);
    const cx = cell % GRID;
    const cy = (cell / GRID) | 0;
    const px = this.x[i];
    const py = this.y[i];
    this.ceil[i] = this.mode[i] === LOCOMOTION.hover ? this.ceilingOf(p) : 0;
    if (E > 2 * m && m >= MATURE * this.adult[i]) { this.act[i] = ACT.bud; return; }   // a satiated animal buds; with no free slot it displaces the weakest neighbour (bud())
    const hungerFrac = clamp01(1 - E / (2 * m));
    const drive = 0.1 + hungerFrac * (1 + this.hunger);
    const sense = Math.min(1.5, L.senseBase + L.senseGain * (p.eyeArea / 1.5) * this.env.light);
    const sense2 = sense * sense;
    const risk = g.risk[cell];
    const bold = p.defence + risk > 0 ? p.defence / (p.defence + risk) : 1;
    const REF = CONSTANTS.REFUGE.value;
    const soc = this.genome[i].body.sociality;

    // one pass over the 3×3 neighbourhood: kin, threats, prey
    let nKin = 0;
    let kinDx = 0, kinDy = 0, kinN = 0;   // offset to the centroid of kin in the 3×3 block (herd cohesion)
    let fleeV = 0, fleeJ = -1, huntV = 0, huntJ = -1;
    let afraid = 0;
    const x0 = Math.max(0, cx - 1), x1 = Math.min(GRID - 1, cx + 1);
    const y0 = Math.max(0, cy - 1), y1 = Math.min(GRID - 1, cy + 1);
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const c = yy * GRID + xx;
        const k0 = this.cellStart[c];
        const nIn = this.cellStart[c + 1] - k0;
        const off = nIn > SCAN ? (this.tick + i) % nIn : 0;
        for (let q = 0; q < Math.min(nIn, SCAN); q++) {
          const j = this.cellItems[k0 + ((q + off) % nIn)];
          if (j === i || !this.alive[j]) continue;
          const dx = this.x[j] - px;
          const dy = this.y[j] - py;
          const d2 = dx * dx + dy * dy;
          if (this.genome[j].lineage === this.genome[i].lineage) { kinDx += dx; kinDy += dy; kinN++; }
          if (d2 > sense2) continue;
          const d = Math.sqrt(d2);
          const pj = this.plan[j];
          if (this.genome[j].lineage === this.genome[i].lineage) nKin += kinStrength({ plan: p, lineage: 0, sociality: soc }, { plan: pj, lineage: 0, sociality: this.genome[j].body.sociality });
          const eats = eatsIntensity(p, pj);
          if (eats > 0) {
            // A kill is worth the whole prey body: its energy for the hunter, in units of one cell's transfer at plant ε, so big prey pays more.
            const worth = L.meatAssim > 0 ? 1 + ((this.struct[j] + this.energy[j]) * L.meatAssim * (DIGEST_FLOOR + (1 - DIGEST_FLOOR) * p.meatGain)) / (L.cellMass * CONSTANTS.EPS0.value) : 1;
            const v = (drive * eats * worth * (1 - REF * this.shelter(cellOf(this.x[j], this.y[j])))) / (1 + d);
            if (v > huntV) { huntV = v; huntJ = j; }
          }
          const a = eatsIntensity(pj, p);
          if (a > 0) {
            if (a > afraid) afraid = a;
            const v = (a * (1 - REF * this.shelter(cell))) / (1 + d);
            if (v > fleeV) { fleeV = v; fleeJ = j; }
          }
        }
      }
    }
    this.afraidSeen[i] = afraid;

    // forage: best neighbouring cell by food + glow lure − risk·(1 − boldness)·(1 − shelter), diluted by kin
    let foodV = 0, fx = px, fy = py;
    const access = this.canopyAccess(p);
    const dark = 1 - this.env.light;
    const strandedHere = !this.habitable(p, g.liquid[cell]);
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const c = yy * GRID + xx;
        if (!this.habitable(p, g.liquid[c])) { if (!strandedHere) continue; }   // the habitat lock: not a place this body can go (unless it is stranded: then all cells count, and the habitable ones win below)
        const homeBonus = strandedHere && this.habitable(p, g.liquid[c]) ? 3 : 1;   // a stranded animal heads for ground that suits it
        let food = this.deepOk(p, g.liquid[c]) * p.plantGain * (g.mat[c] + access * g.canopy[c]);
        if (p.plantGain > 0.25 && dark > 0) {
          const k0 = this.cellStart[c];
          const nIn = Math.min(SCAN, this.cellStart[c + 1] - k0);
          for (let q = 0; q < nIn; q++) food += L.lureWeight * dark * this.plan[this.cellItems[k0 + q]].glow;
        }
        const cost = (g.risk[c] * (1 - bold) * (1 - REF * this.shelter(c))) / (1 + nKin);
        const ddx = xx + 0.5 - px, ddy = yy + 0.5 - py;
        const v = homeBonus * (drive * food - cost) / (1 + Math.sqrt(ddx * ddx + ddy * ddy));
        if (v > foodV) { foodV = v; fx = xx + 0.5; fy = yy + 0.5; }
      }
    }

    const homeX = (this.home[i] % GRID) + 0.5, homeY = ((this.home[i] / GRID) | 0) + 0.5;
    const hd = Math.hypot(homeX - px, homeY - py);
    const homeV = hd > 0.6 ? (risk * (1 - bold)) / (1 + hd) : 0;
    const restV = 0.01;

    let best = restV, a: number = ACT.rest;
    if (foodV > best) { best = foodV; a = ACT.forage; }
    if (huntV > best) { best = huntV; a = ACT.hunt; }
    if (fleeV > best) { best = fleeV; a = ACT.flee; }
    if (homeV > best) { a = ACT.home; }
    let strandTx = NaN, strandTy = NaN;
    if (strandedHere && a !== ACT.flee) {
      // Stranded (the sea rose or fell under it): head for the nearest ground that suits this body, within sight of the grid.
      let bestC = -1, bestD = Infinity;
      for (let dy = -STRAND_SCAN; dy <= STRAND_SCAN; dy++) {
        for (let dx = -STRAND_SCAN; dx <= STRAND_SCAN; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID || !this.habitable(p, g.liquid[ny * GRID + nx])) continue;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; bestC = ny * GRID + nx; }
        }
      }
      if (bestC >= 0) { a = ACT.home; strandTx = (bestC % GRID) + 0.5; strandTy = Math.floor(bestC / GRID) + 0.5; }
    }
    this.act[i] = a;
    this.wandering[i] = 0;
    if (a === ACT.forage) {
      this.tgt[i] = -1;
      if (Math.hypot(fx - px, fy - py) < 0.75) {
        // The best food is right here: keep grazing on the move. A correlated random walk (it keeps its heading, turning
        // a little each decision) at WANDER of the patch per ecology second carries it on to the next patch of food.
        let h = this.heading[i] + 0.6 * gaussian(this.rnd);
        if (px < 1.5 || px > GRID - 1.5 || py < 1.5 || py > GRID - 1.5) h = Math.atan2(GRID / 2 - py, GRID / 2 - px) + 0.5 * gaussian(this.rnd);
        this.tx[i] = px + 2 * Math.cos(h);
        this.ty[i] = py + 2 * Math.sin(h);
        this.wandering[i] = 1;
      } else { this.tx[i] = fx; this.ty[i] = fy; }
      if (kinN > 0) { const pull = (L.cohesion * soc) / kinN; this.tx[i] += pull * kinDx; this.ty[i] += pull * kinDy; }   // herd cohesion: drift toward kin
    }
    else if (a === ACT.hunt) { this.tgt[i] = huntJ; this.tgtId[i] = this.id[huntJ]; }
    else if (a === ACT.flee) { this.tgt[i] = fleeJ; this.tgtId[i] = this.id[fleeJ]; }
    else if (a === ACT.home) { this.tx[i] = homeX; this.ty[i] = homeY; this.tgt[i] = -1; }
    if (strandTx === strandTx) { this.tx[i] = strandTx; this.ty[i] = strandTy; }   // a stranded animal's way home overrides
  }

  private actAnimal(i: number): void {
    const { grid: g, L, dt, env } = this;
    const rules = this.rules;
    const p = this.plan[i];
    const m = this.struct[i];
    const mm = m ** 0.75;
    if ((this.tick + i) % DECIDE_EVERY === 0 || (this.tgt[i] >= 0 && (!this.alive[this.tgt[i]] || this.id[this.tgt[i]] !== this.tgtId[i]))) this.decide(i);
    this.age[i] += dt;
    const cell = cellOf(this.x[i], this.y[i]);
    const act = this.act[i];

    // climate fit (as in population.ts): comfort band, shelter pulls toward mild, oxygen and cold-stability traits
    const cl = this.genome[i].climate;
    const sh = this.shelter(cell);
    const ct = rules.chemTrait;
    const match = this.climateFit(cl, env.temperature, sh);
    let stress = 1 - match + rules.edgeStressWeight * clamp01(env.edgeStress);
    let efficiency = 1;
    if (ct.kind === 'oxygenNeed') {
      const o2 = Math.max(0, env.oxygen);
      efficiency = 1 - cl.chem + cl.chem * (1 + ct.aerobicBonus) * (o2 / (o2 + ct.halfSaturation));
      const maxSize = ct.baseMaxSize + ct.maxSizePerPercent * o2;
      const size = p.scale / L.sizeRef;
      if (size > maxSize) stress += size / maxSize - 1;
    }

    // movement (R10): toward the action's target, paying the medium's cost
    if (act === ACT.hunt || act === ACT.flee || act === ACT.forage || act === ACT.home) {
      let tx = this.tx[i], ty = this.ty[i];
      const j = this.tgt[i];
      if (j >= 0 && this.alive[j]) { tx = this.x[j]; ty = this.y[j]; if (act === ACT.flee) { tx = this.x[i] * 2 - tx; ty = this.y[i] * 2 - ty; } }
      const dx = tx - this.x[i], dy = ty - this.y[i];
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        const vmax = this.wandering[i] && act === ACT.forage ? CONSTANTS.WANDER.value * GRID : L.speed;
        const step = Math.min(dist, vmax * dt * (act === ACT.flee ? 1.5 : 1));
        const nx = Math.min(GRID - 1e-6, Math.max(0, this.x[i] + (dx / dist) * step));
        const ny = Math.min(GRID - 1e-6, Math.max(0, this.y[i] + (dy / dist) * step));
        const mode = this.bestMode(p, g.liquid[cellOf(nx, ny)], !this.habitable(p, g.liquid[cell]));
        if (mode === LOCOMOTION.sessile && this.wandering[i]) this.heading[i] += (this.rnd() < 0.5 ? 1 : -1) * 1.2;   // turned back at the edge of its habitat
        if (mode !== LOCOMOTION.sessile) {
          this.heading[i] = Math.atan2(ny - this.y[i], nx - this.x[i]);
          this.x[i] = nx; this.y[i] = ny; this.mode[i] = mode;
          const cost = Math.min(this.energy[i], L.moveCost * this.modeCost(p, mode) * mm * step);
          this.energy[i] -= cost;
          this.returnMatter(cell, cost, 0);
        }
      }
    }
    this.stepAltitude(i, act);
    const here = cellOf(this.x[i], this.y[i]);

    // eat (R1/R4): graze the cell; ε = EPS0·(1 + 2·Hunger) of what is eaten becomes energy, the rest goes back
    const eps = Math.min(1, CONSTANTS.EPS0.value * (1 + 2 * this.hunger) * efficiency);
    if (act === ACT.forage && p.plantGain > 0 && this.energy[i] < 3 * m) {
      // A grazer feeds over a footprint that grows with its length (grazeReach): own cell first, then the ring around it.
      const R = L.grazeReach > 0 ? Math.min(2, Math.floor(p.scale / L.grazeReach)) : 0;
      let want = (L.intake * m ** L.intakeExp * p.plantGain * match * dt) / L.cellMass;
      const hx = here % GRID, hy = (here / GRID) | 0;
      for (let ring = 0; ring <= R && want > 1e-12; ring++) {
        for (let dy = -ring; dy <= ring && want > 1e-12; dy++) {
          for (let dx = -ring; dx <= ring && want > 1e-12; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const nx = hx + dx, ny = hy + dy;
            if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
            const c = ny * GRID + nx;
            if (!this.habitable(p, g.liquid[c])) continue;
            const avail = this.deepOk(p, g.liquid[c]) * (g.mat[c] + this.canopyAccess(p) * g.canopy[c]);
            const bite = Math.min(avail * rules.consumer.grazeShare, want);
            if (bite <= 0) continue;
            want -= bite;
            const fromMat = Math.min(bite, g.mat[c]);
            g.mat[c] -= fromMat;
            g.canopy[c] -= bite - fromMat;
            const matter = bite * L.cellMass;
            this.returnMatter(c, matter * (1 - eps), 0);
            this.gain(i, matter * eps, c);
          }
        }
      }
    } else if (act === ACT.hunt && this.tgt[i] >= 0) {
      const j = this.tgt[i];
      if (this.alive[j] && this.id[j] === this.tgtId[i] && Math.hypot(this.x[j] - this.x[i], this.y[j] - this.y[i]) <= CONSTANTS.REACH.value) {
        const pCatch = 1 - CONSTANTS.REFUGE.value * this.shelter(cellOf(this.x[j], this.y[j]));
        if (this.rnd() < Math.min(1, L.catchRate * dt) * pCatch) {
          const matter = this.struct[j] + this.energy[j];
          const jc = cellOf(this.x[j], this.y[j]);
          this.kill(j);
          const epsMeat = L.meatAssim > 0 ? Math.min(1, L.meatAssim * efficiency * (DIGEST_FLOOR + (1 - DIGEST_FLOOR) * p.meatGain)) : eps;   // a gut built for meat keeps more of a kill
          this.returnMatter(jc, matter * (1 - epsMeat), 0);
          this.gain(i, matter * epsMeat, jc);
        }
      }
    } else if (act === ACT.rest && cell === this.home[i] && this.comp.o > 0 && this.comp.si > 0) {
      // builders (R7): a body with both Si and O turns the cell's excess into stone (zero when o = 0, e.g. silicon)
      const want = L.buildRate * mm * dt * Math.min(this.genome[i].comp.si, this.genome[i].comp.o) * 2;
      const take = Math.min(want / 2, g.si[here], g.o[here]);
      if (take > 0 && this.energy[i] > m) {
        g.si[here] -= take; g.o[here] -= take; g.stone[here] += 2 * take;
      }
    }

    // upkeep (R3): B0·M^0.75 scaled by pace, plus eyes, glow, tolerance and the chemistry trait; R2 dissolution of bare Si
    const gc = this.genome[i].comp;
    let up = CONSTANTS.B0.value * L.upkeepScale * mm * dt * (1 + p.eyeUpkeep + L.glowCost * p.glow) * (1 + rules.toleranceCost * cl.tolerance);
    if (ct.kind === 'coldStability') up *= 1 + ct.cost * cl.chem;
    if (g.liquid[here] > 0) {
      const attack = (CONSTANTS.DISSOLVE.value * this.inputs.solvent.epsilonR) / 80;
      up += attack * gc.si * (1 - clamp01(p.plateCover)) * mm * dt;
    }
    up = Math.min(up, this.energy[i]);
    this.energy[i] -= up;
    this.returnMatter(here, up, 0);

    const s = clamp01(stress);
    if (
      this.energy[i] <= 1e-9 ||
      this.age[i] > rules.lifespan * m ** CONSTANTS.GEN_EXP.value ||
      this.rnd() < rules.stressDeath * s * s * dt
    ) {
      const e = Math.max(0, this.energy[i]);
      this.kill(i);
      this.returnMatter(here, m + e, clamp01(p.plateCover));
      return;
    }
    // juvenile growth: surplus energy becomes body until the adult mass is reached
    if (m < this.adult[i] && this.energy[i] > m) {
      const dm = Math.min(this.adult[i] - m, L.growRate * m * dt, this.energy[i] - m);
      this.struct[i] += dm;
      this.energy[i] -= dm;
    }

    if (act === ACT.bud) { this.pendingBuds.push(i); this.act[i] = ACT.rest; } // one bud per decide window (act stays 'bud' for DECIDE_EVERY ticks otherwise)
  }

  /** Energy gain with food sharing: kin in the cell take a share of it, scaled by sociality. */
  private gain(i: number, e: number, cell: number): void {
    const soc = this.genome[i].body.sociality;
    const k0 = this.cellStart[cell];
    const nIn = Math.min(SCAN, this.cellStart[cell + 1] - k0);
    let n = 0;
    for (let q = 0; q < nIn; q++) {
      const j = this.cellItems[k0 + q];
      if (j !== i && this.alive[j] && this.genome[j].lineage === this.genome[i].lineage) n++;
    }
    const share = n > 0 ? (soc * n) / (1 + n) : 0;
    this.energy[i] += e * (1 - share);
    if (n === 0) return;
    for (let q = 0; q < nIn; q++) {
      const j = this.cellItems[k0 + q];
      if (j !== i && this.alive[j] && this.genome[j].lineage === this.genome[i].lineage) this.energy[j] += (e * share) / n;
    }
  }

  // ---- R8: bud with mutation; R6: newborn plates thicken by INDUCE·Hunger·Afraid ---------------------------------
  private bud(p: number): void {
    if (!this.alive[p] || this.energy[p] <= 2 * this.struct[p] || this.struct[p] < MATURE * this.adult[p]) return;
    if (this.free.length === 0 && !this.displace(p)) return;
    const child = mutate(this.genome[p], this.rnd, this.rules, this.env.mutationSigma);
    this.spawn(child, this.x[p] + 0.3 * gaussian(this.rnd), this.y[p] + 0.3 * gaussian(this.rnd), this.gen[p] + 1, p, this.env);
  }

  /**
   * Slot competition (R8): when the world is full, a ready parent's offspring takes the place of the weakest animal within
   * SLOT_RADIUS cells: the one with the least energy for its needs (energy ÷ mass), never a parent's kin if any other will do, and
   * only one that is poorer than the parent and past its first moments. Better feeders win slots, so size and hunting get selected.
   */
  private displace(p: number): boolean {
    const cx = Math.floor(this.x[p]), cy = Math.floor(this.y[p]);
    const pr = this.energy[p] / this.struct[p];
    let victim = -1, worst = Infinity;
    for (let yy = Math.max(0, cy - SLOT_RADIUS); yy <= Math.min(GRID - 1, cy + SLOT_RADIUS); yy++) {
      for (let xx = Math.max(0, cx - SLOT_RADIUS); xx <= Math.min(GRID - 1, cx + SLOT_RADIUS); xx++) {
        const c = yy * GRID + xx;
        for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) {
          const j = this.cellItems[k];
          if (j === p || !this.alive[j] || this.age[j] < 1 || cellOf(this.x[j], this.y[j]) !== c) continue;
          const r = this.energy[j] / this.struct[j];
          const score = r + (this.genome[j].lineage === this.genome[p].lineage ? 100 : 0);
          if (score < worst && r < pr * SLOT_MARGIN) { worst = score; victim = j; }
        }
      }
    }
    if (victim < 0) return false;
    const here = cellOf(this.x[victim], this.y[victim]);
    const e = Math.max(0, this.energy[victim]);
    this.kill(victim);
    this.returnMatter(here, this.struct[victim] + e, clamp01(this.plan[victim].plateCover));
    return true;
  }

  /** Creates an animal (develop() at birth, R9). A bud pays 1.5 × the child's body from the parent; a founder is injected. */
  private spawn(genome: AnimalGenome, px: number, py: number, gen: number, parent: number | null, env: EcologyEnv, energyShare = 0.5): boolean {
    const slot = this.free.pop();
    if (slot === undefined) return false;
    const plan = develop(genome, { light: env.light, heatBand: env.heatBand, oxygen: env.oxygen }, this.inputs);
    if (!this.habitable(plan, this.grid.liquid[cellOf(px, py)])) {
      // A newborn stays with its parent; a founder or spore is placed in a cell that suits its body.
      if (parent !== null) {
        // A newborn whose body does not suit its parent's cell (a mutant swimmer born on the shore) is born in the nearest cell that does, within 2 cells; if none, it is not born.
        const cx = Math.floor(this.x[parent]), cy = Math.floor(this.y[parent]);
        let best = -1, bestD = Infinity;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const c = ny * GRID + nx;
          const d = dx * dx + dy * dy;
          if (d < bestD && this.habitable(plan, this.grid.liquid[c])) { bestD = d; best = c; }
        }
        if (best < 0) { this.free.push(slot); return false; }
        px = (best % GRID) + 0.5; py = Math.floor(best / GRID) + 0.5;
      }
      else {
        const pool = plan.mode === LOCOMOTION.swim ? this.seaPool : this.landPool;
        if (pool.length > 0) { const c = pool[Math.floor(this.rnd() * pool.length)]; px = (c % GRID) + this.rnd(); py = Math.floor(c / GRID) + this.rnd(); }
      }
    }
    const Madult = Math.max(1e-6, plan.mass / this.L.massUnit);
    // A newborn is never larger than its parent (growRate > 0): a big mutant is born small and grows up on its own food.
    const M = parent !== null && this.L.growRate > 0 ? Math.min(Madult, this.struct[parent]) : Madult;
    if (parent !== null) {
      if (this.energy[parent] < 1.5 * M) { this.free.push(slot); return false; }
      this.energy[parent] -= 1.5 * M;
      plan.defence += CONSTANTS.INDUCE.value * this.hunger * this.afraidSeen[parent];
    } else this.injected += (1 + energyShare) * M;
    this.alive[slot] = 1;
    this.id[slot] = this.nextId++;
    this.gen[slot] = gen;
    this.x[slot] = Math.min(GRID - 1e-6, Math.max(0, px));
    this.y[slot] = Math.min(GRID - 1e-6, Math.max(0, py));
    this.struct[slot] = M;
    this.adult[slot] = Madult;
    this.energy[slot] = energyShare * M;
    this.age[slot] = 0;
    this.genome[slot] = genome;
    this.plan[slot] = plan;
    this.mode[slot] = plan.mode;
    this.alt[slot] = 0;
    this.ceil[slot] = 0;
    this.heading[slot] = this.rnd() * 2 * Math.PI - Math.PI;   // founders and newborns face a random way, so they do not all drift together
    this.wandering[slot] = 0;
    this.home[slot] = cellOf(this.x[slot], this.y[slot]);
    this.act[slot] = ACT.rest;
    this.tgt[slot] = -1;
    this.afraidSeen[slot] = 0;
    this.living++;
    this.births.push({ id: this.id[slot], plan });
    return true;
  }

  private kill(i: number): void {
    this.bankSpore(i);
    this.alive[i] = 0;
    this.living--;
    this.free.push(i);
  }

  // ---- outputs ----------------------------------------------------------------------------------------------------------
  /** develop() plans of animals born since the last call (SimSnapshot.births). */
  drainBirths(): { id: number; plan: BodyPlan }[] {
    return this.births.splice(0, this.births.length);
  }

  /** Per-cell flora biomass, interleaved [mat, canopy] per cell, FLORA_STRIDE floats each (SimSnapshot.flora). */
  floraSnapshot(out = new Float32Array(FLORA_STRIDE * CELLS)): Float32Array {
    for (let i = 0; i < CELLS; i++) { out[FLORA_STRIDE * i] = this.grid.mat[i]; out[FLORA_STRIDE * i + 1] = this.grid.canopy[i]; }
    return out;
  }

  /** Living animals as the SimSnapshot.organisms buffer (layout v2, positions 0..1 over the patch). */
  packOrganisms(): { data: Float32Array; count: number } {
    const data = new Float32Array(this.living * ORGANISM_STRIDE);
    let n = 0;
    for (let i = 0; i < CAP; i++) {
      if (!this.alive[i]) continue;
      const g = this.genome[i];
      packOrganism(data, n++, {
        x: this.x[i] / GRID, y: this.y[i] / GRID, role: 1, size: this.plan[i].scale / this.L.sizeRef,
        prefTemp: g.climate.prefTemp, tolerance: g.climate.tolerance, chem: g.climate.chem,
        energy: this.energy[i] / (2 * this.struct[i]), id: this.id[i], generation: this.gen[i],
        heading: this.heading[i], mode: this.mode[i] as 0 | 1 | 2 | 3, altitude: this.alt[i], grown: Math.min(1, this.struct[i] / this.adult[i]), body: g.body, comp: g.comp, lineage: g.lineage,
      });
    }
    return { data, count: n };
  }

  /** Feedback drivers (Feedback.driver): producerBiomass is Σ flora biomass in cell units, consumerBiomass is Σ M. */
  biomass(): { producerBiomass: number; consumerBiomass: number } {
    let pb = 0;
    for (let i = 0; i < CELLS; i++) pb += this.grid.mat[i] + this.grid.canopy[i];
    let cb = 0;
    for (let i = 0; i < CAP; i++) if (this.alive[i]) cb += this.struct[i];
    return { producerBiomass: pb, consumerBiomass: cb };
  }

  /** Every unit of matter in the world. Constant over steps once `injected` is subtracted. */
  matterTotal(): number {
    const g = this.grid;
    let m = 0;
    for (let i = 0; i < CELLS; i++) m += g.c[i] + g.si[i] + g.o[i] + g.stone[i] + (g.mat[i] + g.canopy[i]) * this.L.cellMass;
    for (let i = 0; i < CAP; i++) if (this.alive[i]) m += this.struct[i] + this.energy[i];
    return m;
  }

  /** Means for SimSnapshot.traitAverages and generation. */
  stats(): { animals: number; generation: number; traitAverages: Record<string, number> } {
    let n = 0, gen = 0, pt = 0, tol = 0, size = 0, chem = 0;
    for (let i = 0; i < CAP; i++) {
      if (!this.alive[i]) continue;
      n++; gen += this.gen[i]; pt += this.genome[i].climate.prefTemp; tol += this.genome[i].climate.tolerance;
      size += this.plan[i].scale; chem += this.genome[i].climate.chem;
    }
    const d = n || 1;
    return {
      animals: n, generation: gen / d,
      traitAverages: { prefTemp: pt / d, tolerance: tol / d, size: size / d, chem: chem / d, consumerSize: size / d, consumerChem: chem / d },
    };
  }
}
