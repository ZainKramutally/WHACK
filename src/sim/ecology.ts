// The spatial ecology: DECISIONS §3's 12 rules on the one 64² grid, grown from population.ts (it reuses
// LifeRules, Environment, pace() and mutateClimate). One utility loop for every animal, relationships derived
// from bodies, flora as per-cell biomass (not agents), fixed 20 Hz ticks, deterministic per seed.
// No preset code, no cheats, no rendering fields. Matter is conserved (see matterTotal()).
//
// Rule map:  R1 stepFlora · R2 nutrients (Liebig) + dissolve() · R3 upkeep · R4 eatsIntensity + ε · R5 decide()
// R6 relationships.ts + inducible plates · R7 shelter()/home/builders · R8 bud() · R9 develop() at birth
// R10 bestMode() + moveCost · R11 returnMatter() · R12 nothing here reads rendering.
import { CONSTANTS } from './constants';
import { develop, LOCOMOTION, type BodyPlan, type DevelopInputs } from './develop';
import { makeFounders, mutate, type AnimalGenome, type ClimateGenes, type Composition } from './genome';
import { CELLS, GRID, cellOf, type Grid } from './grid';
import { pace, type Environment, type LifeRules } from './population';
import { eatsIntensity, kinStrength } from './relationships';
import { makeRng, gaussian, type Rng } from './rng';

export const TICK_HZ = 20;
export const CAP = 1024;

/** The sim's inputs for one step: population.ts's Environment plus the living-band heat for develop(). */
export interface EcologyEnv extends Environment { heatBand: number }

/**
 * World-config `life.ledger`: scalings that turn the rules into numbers (units: matter = animal mass = energy).
 * Every value needs a `why` in the world config; these defaults are test fixtures only.
 */
export interface EcologyLedger {
  massUnit: number; // kg of develop() mass per matter unit
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
}

export const DEFAULT_LEDGER: EcologyLedger = {
  massUnit: 1, upkeepScale: 0.02, cellMass: 40, shadeK: 1.2, waterAttn: 0.3, canopyRate: 0.3, floraDecay: 0.02, spread: 0.5,
  seedMat: 0.3, shallowMax: 2, deepLiquid: 6, wadeDepth: 0.5, intake: 1.5, speed: 1.5, moveCost: 0.01,
  catchRate: 1, buildRate: 0.05, senseBase: 0.7, senseGain: 0.8, lureWeight: 0.5, glowCost: 0.3, sizeRef: 1,
  hungerTime: 10, founders: 24,
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

const ACT = { rest: 0, forage: 1, hunt: 2, flee: 3, home: 4, bud: 5 } as const;
const DECIDE_EVERY = 4; // an animal re-decides every 4th tick (staggered by index); it moves and eats every tick
const RISK_EVERY = 40; // derived fields (risk, hunger) refresh every 2 s
const FLORA_EVERY = 4; // flora (slow) updates every 4th tick with 4× the step
const SCAN = 12; // an animal looks at no more than this many neighbours per cell (bounds crowded cells)
const REACH = 1; // cells within which a hunter can strike

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
  readonly genome: AnimalGenome[] = new Array(CAP);
  readonly plan: BodyPlan[] = new Array(CAP);
  readonly mode = new Uint8Array(CAP); // locomotion mode at the last move
  private readonly home = new Int32Array(CAP);
  private readonly act = new Uint8Array(CAP);
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

  /** The founders appear in the shallows with a first patch of flora (build.lifeSec). Seeded; same seed, same worms. */
  seedLife(env: EcologyEnv): void {
    const g = this.grid;
    const L = this.L;
    const shallows: number[] = [];
    for (let i = 0; i < CELLS; i++) if (g.liquid[i] > 0 && g.liquid[i] <= L.shallowMax) shallows.push(i);
    const wet: number[] = [];
    if (shallows.length === 0) for (let i = 0; i < CELLS; i++) if (g.liquid[i] > 0) wet.push(i);
    const spots = shallows.length ? shallows : wet;
    for (const i of spots) this.plant(i, L.seedMat);
    const pool = spots.length ? spots : Array.from({ length: CELLS }, (_, i) => i);
    if (!spots.length) for (const i of pool) this.plant(i, 0.05);
    const founders = makeFounders(this.seed, Math.max(24, L.founders), this.comp, this.founderClimate);
    for (const gen of founders) {
      const cell = pool[Math.floor(this.rnd() * pool.length)];
      const px = (cell % GRID) + this.rnd();
      const py = Math.floor(cell / GRID) + this.rnd();
      this.spawn(gen, px, py, 0, null, env);
    }
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
    const decay = Math.min(1, L.floraDecay * dt);
    const cm = L.cellMass;
    for (let i = 0; i < CELLS; i++) {
      // decay returns nutrients
      let b = g.mat[i];
      let can = g.canopy[i];
      if (decay > 0 && (b > 0 || can > 0)) {
        this.returnMatter(i, (b + can) * decay * cm, 0);
        b -= b * decay;
        can -= can * decay;
      }
      const wet = g.liquid[i] > 0;
      const light = this.env.light * Math.exp(-L.shadeK * can - L.waterAttn * g.liquid[i]);
      g.light[i] = light;
      const x = i % GRID;
      const y = (i / GRID) | 0;
      let nb = 0;
      let nn = 0;
      if (x > 0) { nb += g.mat[i - 1]; nn++; }
      if (x < GRID - 1) { nb += g.mat[i + 1]; nn++; }
      if (y > 0) { nb += g.mat[i - GRID]; nn++; }
      if (y < GRID - 1) { nb += g.mat[i + GRID]; nn++; }
      let grow = P0 * dt * hab * light * (b + L.spread * (nb / nn)) * (1 - b);
      grow = this.limit(i, grow, 1 - b);
      b += grow;
      let growC = 0;
      if (!wet) {
        growC = P0 * dt * hab * this.env.light * L.canopyRate * b * (1 - can);
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
      demand += this.L.intake * this.struct[i] ** 0.75 * p.plantGain;
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
  private bestMode(p: BodyPlan, liquid: number): number {
    const mc = p.modeCosts;
    let mode: number = LOCOMOTION.sessile;
    let best = mc.sessile;
    if (liquid <= this.L.wadeDepth && mc.walk < best) { best = mc.walk; mode = LOCOMOTION.walk; }
    if (liquid > 0 && mc.swim < best) { best = mc.swim; mode = LOCOMOTION.swim; }
    if (mc.hover < best) { mode = LOCOMOTION.hover; }
    return mode;
  }
  private modeCost(p: BodyPlan, mode: number): number {
    const mc = p.modeCosts;
    return mode === LOCOMOTION.walk ? mc.walk : mode === LOCOMOTION.swim ? mc.swim : mode === LOCOMOTION.hover ? mc.hover : mc.sessile;
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
    if (E > 2 * m) { this.act[i] = ACT.bud; return; }
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
          if (d2 > sense2) continue;
          const d = Math.sqrt(d2);
          const pj = this.plan[j];
          if (this.genome[j].lineage === this.genome[i].lineage) nKin += kinStrength({ plan: p, lineage: 0, sociality: soc }, { plan: pj, lineage: 0, sociality: this.genome[j].body.sociality });
          const eats = eatsIntensity(p, pj);
          if (eats > 0) {
            const v = (drive * eats * (1 - REF * this.shelter(cellOf(this.x[j], this.y[j])))) / (1 + d);
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
    const access = p.legPairs > 0 || p.mode === LOCOMOTION.hover ? 1 : 0;
    const dark = 1 - this.env.light;
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const c = yy * GRID + xx;
        let food = p.plantGain * (g.mat[c] + access * g.canopy[c]);
        if (p.plantGain > 0.25 && dark > 0) {
          const k0 = this.cellStart[c];
          const nIn = Math.min(SCAN, this.cellStart[c + 1] - k0);
          for (let q = 0; q < nIn; q++) food += L.lureWeight * dark * this.plan[this.cellItems[k0 + q]].glow;
        }
        const cost = (g.risk[c] * (1 - bold) * (1 - REF * this.shelter(c))) / (1 + nKin);
        const ddx = xx + 0.5 - px, ddy = yy + 0.5 - py;
        const v = (drive * food - cost) / (1 + Math.sqrt(ddx * ddx + ddy * ddy));
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
    this.act[i] = a;
    if (a === ACT.forage) { this.tx[i] = fx; this.ty[i] = fy; this.tgt[i] = -1; }
    else if (a === ACT.hunt) { this.tgt[i] = huntJ; this.tgtId[i] = this.id[huntJ]; }
    else if (a === ACT.flee) { this.tgt[i] = fleeJ; this.tgtId[i] = this.id[fleeJ]; }
    else if (a === ACT.home) { this.tx[i] = homeX; this.ty[i] = homeY; this.tgt[i] = -1; }
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
    let dev = (env.temperature - cl.prefTemp) * (1 - CONSTANTS.REFUGE.value * sh);
    if (ct.kind === 'coldStability' && dev > 0) dev *= 1 - ct.warmRelief * cl.chem;
    const z = dev / cl.tolerance;
    const match = Math.exp(-0.5 * z * z);
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
        const step = Math.min(dist, L.speed * dt * (act === ACT.flee ? 1.5 : 1));
        const nx = Math.min(GRID - 1e-6, Math.max(0, this.x[i] + (dx / dist) * step));
        const ny = Math.min(GRID - 1e-6, Math.max(0, this.y[i] + (dy / dist) * step));
        const mode = this.bestMode(p, g.liquid[cellOf(nx, ny)]);
        if (mode !== LOCOMOTION.sessile) {
          this.x[i] = nx; this.y[i] = ny; this.mode[i] = mode;
          const cost = Math.min(this.energy[i], L.moveCost * this.modeCost(p, mode) * mm * step);
          this.energy[i] -= cost;
          this.returnMatter(cell, cost, 0);
        }
      }
    }
    const here = cellOf(this.x[i], this.y[i]);

    // eat (R1/R4): graze the cell; ε = EPS0·(1 + 2·Hunger) of what is eaten becomes energy, the rest goes back
    const eps = Math.min(1, CONSTANTS.EPS0.value * (1 + 2 * this.hunger) * efficiency);
    if (act === ACT.forage && p.plantGain > 0 && this.energy[i] < 3 * m) {
      const avail = g.mat[here] + ((p.legPairs > 0 || p.mode === LOCOMOTION.hover) ? g.canopy[here] : 0);
      const bite = Math.min(avail * rules.consumer.grazeShare, (L.intake * mm * p.plantGain * match * dt) / L.cellMass);
      if (bite > 0) {
        const fromMat = Math.min(bite, g.mat[here]);
        g.mat[here] -= fromMat;
        g.canopy[here] -= bite - fromMat;
        const matter = bite * L.cellMass;
        this.returnMatter(here, matter * (1 - eps), 0);
        this.gain(i, matter * eps, here);
      }
    } else if (act === ACT.hunt && this.tgt[i] >= 0) {
      const j = this.tgt[i];
      if (this.alive[j] && this.id[j] === this.tgtId[i] && Math.hypot(this.x[j] - this.x[i], this.y[j] - this.y[i]) <= REACH) {
        const pCatch = 1 - CONSTANTS.REFUGE.value * this.shelter(cellOf(this.x[j], this.y[j]));
        if (this.rnd() < Math.min(1, L.catchRate * dt) * pCatch) {
          const matter = this.struct[j] + this.energy[j];
          const jc = cellOf(this.x[j], this.y[j]);
          this.kill(j);
          this.returnMatter(jc, matter * (1 - eps), 0);
          this.gain(i, matter * eps, jc);
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
    if (act === ACT.bud) this.pendingBuds.push(i);
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
    if (!this.alive[p] || this.free.length === 0 || this.energy[p] <= 2 * this.struct[p]) return;
    const child = mutate(this.genome[p], this.rnd, this.rules);
    this.spawn(child, this.x[p] + 0.3 * gaussian(this.rnd), this.y[p] + 0.3 * gaussian(this.rnd), this.gen[p] + 1, p, this.env);
  }

  /** Creates an animal (develop() at birth, R9). A bud pays 1.5 × the child's body from the parent; a founder is injected. */
  private spawn(genome: AnimalGenome, px: number, py: number, gen: number, parent: number | null, env: EcologyEnv): boolean {
    const slot = this.free.pop();
    if (slot === undefined) return false;
    const plan = develop(genome, { light: env.light, heatBand: env.heatBand }, this.inputs);
    const M = Math.max(1e-6, plan.mass / this.L.massUnit);
    if (parent !== null) {
      if (this.energy[parent] < 1.5 * M) { this.free.push(slot); return false; }
      this.energy[parent] -= 1.5 * M;
      plan.defence += CONSTANTS.INDUCE.value * this.hunger * this.afraidSeen[parent];
    } else this.injected += 1.5 * M;
    this.alive[slot] = 1;
    this.id[slot] = this.nextId++;
    this.gen[slot] = gen;
    this.x[slot] = Math.min(GRID - 1e-6, Math.max(0, px));
    this.y[slot] = Math.min(GRID - 1e-6, Math.max(0, py));
    this.struct[slot] = M;
    this.energy[slot] = 0.5 * M;
    this.age[slot] = 0;
    this.genome[slot] = genome;
    this.plan[slot] = plan;
    this.mode[slot] = plan.mode;
    this.home[slot] = cellOf(this.x[slot], this.y[slot]);
    this.act[slot] = ACT.rest;
    this.tgt[slot] = -1;
    this.afraidSeen[slot] = 0;
    this.living++;
    this.births.push({ id: this.id[slot], plan });
    return true;
  }

  private kill(i: number): void {
    this.alive[i] = 0;
    this.living--;
    this.free.push(i);
  }

  // ---- outputs ----------------------------------------------------------------------------------------------------------
  /** develop() plans of animals born since the last call (SimSnapshot.births). */
  drainBirths(): { id: number; plan: BodyPlan }[] {
    return this.births.splice(0, this.births.length);
  }

  /** Per-cell flora biomass, interleaved [mat, canopy] per cell, row-major (SimSnapshot.flora). */
  floraSnapshot(out = new Float32Array(2 * CELLS)): Float32Array {
    for (let i = 0; i < CELLS; i++) { out[2 * i] = this.grid.mat[i]; out[2 * i + 1] = this.grid.canopy[i]; }
    return out;
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
