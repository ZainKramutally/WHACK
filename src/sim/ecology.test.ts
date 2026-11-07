import { describe, expect, it } from 'vitest';
import { CAP, Ecology, type EcologyEnv, type EcologyLedger } from './ecology';
import { CELLS, FLORA_STRIDE, GRID, createGrid, liquidFromHeights } from './grid';
import { ORGANISM_STRIDE, readOrganism } from './organismLayout';
import type { LifeRules } from './population';
import { worlds } from '../worlds';
import { ecologyFromWorld } from './__fixtures__/ecologyFromWorld';

// Fixtures only: the real values live in each world's config (life.rules, life.ledger, life.inputs).
const rules: LifeRules = {
  maxOrganisms: 400, producerCapacity: 300, timeScale: 1,
  metabolism: { activationEnergyKJ: 50, referenceC: 15, compression: 0.03 },
  producer: { lightGain: 1, upkeep: 0.3 },
  consumer: { biteRate: 10, biteSize: 0.12, assimilation: 0.7, upkeep: 0.15, halfFood: 40, interference: 4, grazeShare: 0.6 },
  reproduction: { energyThreshold: 1, childShare: 0.5, maturityAge: 0.3 },
  lifespan: 40, toleranceCost: 0.02, stressDeath: 1.5, edgeStressWeight: 1,
  mutation: { size: 0.05, prefTemp: 0.6, tolerance: 0.3, chem: 0.05, roleFlip: 0 },
  bounds: { size: [0.2, 5], tolerance: [1, 30] },
  chemTrait: { kind: 'oxygenNeed', halfSaturation: 2, aerobicBonus: 1, baseMaxSize: 0.5, maxSizePerPercent: 0.1 },
};
const carbonComp = { c: 0.8, si: 0.05, o: 0.15 };
const siliconComp = { c: 0.05, si: 0.9, o: 0.05 };
const env: EcologyEnv = { temperature: 15, oxygen: 21, light: 1, habitat: 1, edgeStress: 0, heatBand: 0.5 };
const DT = 1 / 20;

function shoreLiquid(): Float64Array {
  const l = new Float64Array(CELLS);
  for (let i = 0; i < CELLS; i++) { const x = i % GRID; l[i] = x < 20 ? 3 - x * 0.15 : 0; }
  return l;
}

function make(o: { seed?: number; comp?: typeof carbonComp; liquid?: Float64Array; supply?: { c: number; si: number; o: number };
  epsilonR?: number; ledger?: Partial<EcologyLedger> } = {}) {
  const grid = createGrid({ liquid: o.liquid ?? shoreLiquid(), supply: o.supply ?? { c: 40, si: 0.4, o: 10 } });
  const eco = new Ecology({
    seed: o.seed ?? 1, grid, rules, composition: o.comp ?? carbonComp,
    founderClimate: { prefTemp: 15, tolerance: 8, chem: 0.5 },
    inputs: { solvent: { rho: 1, mu: 0.89, epsilonR: o.epsilonR ?? 80, liquidBandC: [0, 100] }, airDensity: 0.1, tissueDensity: { C: 1.05, Si: 2.2 } },
    ledger: o.ledger,
  });
  return { eco, grid };
}
const run = (eco: Ecology, ticks: number) => { for (let t = 0; t < ticks; t++) eco.step(env, DT); };
const living = (eco: Ecology) => Array.from({ length: CAP }, (_, i) => i).filter((i) => eco.alive[i]);

describe('Ecology: contract', () => {
  it('holds no preset, species, basin, role or render fields', () => {
    const { eco } = make();
    const keys = Object.getOwnPropertyNames(eco).join(' ').toLowerCase();
    for (const bad of ['preset', 'species', 'basin', 'role', 'mesh', 'color', 'colour']) expect(keys).not.toContain(bad);
  });
  it('starts empty and seeds at least 24 founders in the shallows', () => {
    const { eco, grid } = make();
    expect(eco.animals).toBe(0);
    eco.seedLife(env);
    expect(eco.animals).toBeGreaterThanOrEqual(24);
    for (const i of living(eco)) expect(grid.liquid[Math.floor(eco.y[i]) * GRID + Math.floor(eco.x[i])]).toBeGreaterThan(0);
    expect(eco.drainBirths().length).toBe(eco.animals);
    expect(eco.drainBirths()).toHaveLength(0);
  });
});

describe('Ecology: buffers and conventions', () => {
  it('packs animals in layout v2 with positions in 0..1 and flora as interleaved [mat, canopy]', () => {
    const { eco, grid } = make();
    eco.seedLife(env);
    run(eco, 400);
    const { data, count } = eco.packOrganisms();
    expect(count).toBe(eco.animals);
    expect(data).toHaveLength(count * ORGANISM_STRIDE);
    for (let k = 0; k < count; k++) {
      const r = readOrganism(data, k);
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x).toBeLessThan(1);
      expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y).toBeLessThan(1);
      expect(r.role).toBe(1);
      expect(r.comp.c).toBeCloseTo(carbonComp.c);
    }
    const flora = eco.floraSnapshot();
    expect(FLORA_STRIDE).toBe(2);
    expect(flora).toHaveLength(8192);
    const cell = 5 * GRID + 3; // row 5 (world z), col 3 (world x)
    expect(flora[cell * FLORA_STRIDE]).toBeCloseTo(grid.mat[cell]);
    expect(flora[cell * FLORA_STRIDE + 1]).toBeCloseTo(grid.canopy[cell]);
  });
  it('derives liquid depth from a height function at cell centres: col along x, row along y', () => {
    const l = liquidFromHeights((x, y) => x * 10 + y, 5);
    expect(l[0]).toBeCloseTo(5 - (0.5 / 64 * 10 + 0.5 / 64));
    expect(l[63]).toBe(0); // col 63 is high ground at row 0
    expect(l[63 * GRID]).toBeGreaterThan(0); // row 63, col 0: x small, y≈1 → height ≈ 1 → wet
  });
});

describe('Ecology: flora (R1, R2)', () => {
  // Isolated cell: every other cell has no nutrients, so only cell 0 can grow.
  function isolated(nut: { c: number; si: number; o: number }) {
    const { eco, grid } = make({ liquid: new Float64Array(CELLS), supply: { c: 0, si: 0, o: 0 }, ledger: { floraDecay: 0 } });
    grid.c[0] = nut.c; grid.si[0] = nut.si; grid.o[0] = nut.o;
    grid.mat[0] = 0.01;
    run(eco, 400);
    return { grid, eco };
  }
  it('is limited by the scarcest nutrient and uses it up', () => {
    const a = isolated({ c: 1000, si: 0.1, o: 1000 }); // Si-limited: 0.1 / (0.05·40) = 0.05 biomass on top of the 0.01 seed
    expect(a.grid.mat[0] + a.grid.canopy[0]).toBeLessThanOrEqual(0.06 + 1e-9);
    expect(a.grid.mat[0] + a.grid.canopy[0]).toBeGreaterThan(0.055);
    expect(a.grid.si[0]).toBeLessThan(0.01);
    expect(a.grid.c[0]).toBeGreaterThan(900);
    const b = isolated({ c: 1000, si: 1000, o: 0.3 }); // O-limited: 0.3 / (0.15·40) = 0.05 (+ seed)
    expect(b.grid.mat[0] + b.grid.canopy[0]).toBeLessThanOrEqual(0.06 + 1e-9);
    expect(b.grid.o[0]).toBeLessThan(0.01);
  });
  it('grows more when the scarce nutrient is plentiful', () => {
    const lo = isolated({ c: 1000, si: 0.1, o: 1000 });
    const hi = isolated({ c: 1000, si: 5, o: 1000 });
    expect(hi.grid.mat[0] + hi.grid.canopy[0]).toBeGreaterThan(5 * (lo.grid.mat[0] + lo.grid.canopy[0]));
  });
  it('keeps canopy off the sea and spreads onto land only from neighbours', () => {
    const { eco, grid } = make();
    eco.seedLife(env);
    expect(grid.canopy.slice(0, 20).every((v) => v === 0)).toBe(true); // x < 20 is sea in row 0
    run(eco, 1200);
    expect(grid.mat[30]).toBeGreaterThan(0); // reached land, no seed there
  });
});

describe('Ecology: determinism and conservation', () => {
  const fingerprint = (eco: Ecology) => living(eco).map((i) => [eco.id[i], eco.x[i], eco.y[i], eco.energy[i]]);
  it('same seed gives identical state after N steps; another seed differs', () => {
    const a = make({ seed: 5 }); const b = make({ seed: 5 }); const c = make({ seed: 6 });
    for (const e of [a.eco, b.eco, c.eco]) { e.seedLife(env); run(e, 600); }
    expect(fingerprint(a.eco)).toEqual(fingerprint(b.eco));
    expect(Array.from(a.grid.mat)).toEqual(Array.from(b.grid.mat));
    expect(fingerprint(a.eco)).not.toEqual(fingerprint(c.eco));
  });
  it('conserves matter: nutrients + flora + stone + bodies + energy − injected is constant', () => {
    const { eco } = make({ ledger: { floraDecay: 0.05 } });
    eco.seedLife(env);
    const base = eco.matterTotal() - eco.injected;
    for (let k = 0; k < 6; k++) {
      run(eco, 400);
      expect(eco.matterTotal() - eco.injected).toBeCloseTo(base, 3);
    }
    expect(eco.animals).toBeGreaterThan(0);
  });
  it('is frame-independent: it only knows ticks, so a different dt chunking of the same ticks matches', () => {
    const a = make({ seed: 2 }); const b = make({ seed: 2 });
    a.eco.seedLife(env); b.eco.seedLife(env);
    run(a.eco, 200);
    for (let t = 0; t < 10; t++) run(b.eco, 20);
    expect(fingerprint(a.eco)).toEqual(fingerprint(b.eco));
  });
});

describe('Ecology: headless carbon-like run', () => {
  it('keeps animals alive, grows flora and the population, and stays under the cap', () => {
    const { eco, grid } = make();
    eco.seedLife(env);
    const flora0 = eco.biomass().producerBiomass;
    run(eco, 1200); // 60 ecology seconds
    expect(eco.animals).toBeGreaterThan(24);
    expect(eco.animals).toBeLessThanOrEqual(CAP);
    expect(eco.biomass().producerBiomass).toBeGreaterThan(flora0);
    expect(eco.biomass().consumerBiomass).toBeGreaterThan(0);
    expect(eco.stats().generation).toBeGreaterThan(0);
    expect(eco.floraSnapshot()).toHaveLength(2 * CELLS);
    expect(grid.risk.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(eco.drainBirths().length).toBeGreaterThan(24);
  });
  const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
  it.skipIf(!slow)('carbon demo seed, real config: legs, plates and hunters together by 340 ecology-s (SLOW)', () => {
    const { eco, env: e } = ecologyFromWorld(worlds.carbon);
    eco.seedLife(e);
    const t0 = performance.now();
    let hunterSamples = 0;
    for (let t = 1; t <= 6800; t++) {
      eco.step(e, DT);
      if (t > 5100 && t % 170 === 0) hunterSamples += hunters(eco) > 0 ? 1 : 0; // last 85 s, every 8.5 s
    }
    const ms = performance.now() - t0;
    const legged = living(eco).filter((i) => eco.plan[i].legPairs > 0).length;
    const plated = living(eco).filter((i) => eco.genome[i].body.plates > 0.3).length;
    console.log(`SLOW 6800 ticks: ${ms.toFixed(0)} ms, animals ${eco.animals}, legged ${legged}, plated ${plated}, hunters ${hunters(eco)} (present in ${hunterSamples}/10 late samples), gen ${eco.stats().generation.toFixed(1)}`);
    expect(eco.animals).toBeLessThanOrEqual(CAP);
    expect(legged).toBeGreaterThan(0);
    expect(plated).toBeGreaterThan(0);
    expect(hunters(eco)).toBeGreaterThan(0);
  }, 60000);
});
const hunters = (eco: Ecology) => living(eco).filter((i) => eco.plan[i].meatGain > 0.25 && eco.plan[i].gapeSize > 0.3 * eco.plan[i].scale).length;

describe('Ecology: silicon rules', () => {
  const allSea = new Float64Array(CELLS).fill(1);
  /** Founders in a sea with no food: any energy difference between runs comes from the one thing varied. */
  function starve(epsilonR: number, plated: boolean) {
    const { eco, grid } = make({ comp: siliconComp, liquid: allSea, epsilonR, supply: { c: 0, si: 0, o: 0 } });
    eco.seedLife(env);
    grid.mat.fill(0);
    if (plated) for (const i of living(eco)) eco.plan[i].plateCover = 1;
    run(eco, 20);
    return living(eco).reduce((s, i) => s + eco.energy[i], 0);
  }
  it('unplated silicon is penalised only through solvent polarity ε_r', () => {
    const water = starve(80, false);
    const nitrogen = starve(1.4, false);
    const none = starve(0, false);
    expect(water).toBeLessThan(nitrogen);
    expect(nitrogen).toBeLessThan(none);
    expect(starve(80, true)).toBeCloseTo(none, 9); // plates block it; nothing else depends on ε_r
  });
  it('builders make no stone without oxygen in the body', () => {
    const { eco, grid } = make({ comp: { c: 0.1, si: 0.9, o: 0 } });
    eco.seedLife(env);
    run(eco, 1500);
    expect(grid.stone.every((v) => v === 0)).toBe(true);
  });
});

describe('Ecology from the real world configs', () => {
  for (const id of ['carbon', 'silicon'] as const) {
    it(`${id}: constructs from its config, seeds life and survives 200 ticks`, () => {
      const { eco, env: e } = ecologyFromWorld(worlds[id]);
      eco.seedLife(e);
      const founders = eco.animals;
      expect(founders).toBeGreaterThanOrEqual(24);
      run2(eco, e, 200);
      expect(eco.animals).toBeGreaterThan(0);
      expect(Number.isFinite(eco.matterTotal())).toBe(true);
      expect(eco.biomass().producerBiomass).toBeGreaterThan(0);
      if (id === 'silicon') expect(eco.grid.stone.every((v) => v === 0)).toBe(true); // o = 0: no builders, no ceramic-free stone
    });
  }
});
function run2(eco: Ecology, e: EcologyEnv, ticks: number) { for (let t = 0; t < ticks; t++) eco.step(e, DT); }
