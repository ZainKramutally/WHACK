// Conditions shape bodies: each physical term is a ledger or develop() cost, found by selection, never a template.
// Tier 0: pure terms and small ecology runs. The full-sim A/B numbers are in scripts/simAB.ts (AB=table).
import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { ecologyFromWorld } from './__fixtures__/ecologyFromWorld';
import { develop, skinArea, supportLoad, type DevelopInputs } from './develop';
import { CAP } from './ecology';
import { makeFounders, type AnimalGenome } from './genome';
import { CELLS } from './grid';
import { maxBodySize } from './population';

const base = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
const walker = (limbLen: number): AnimalGenome => ({ ...base, body: { ...base.body, size: 0.3, limbPairs: 0.5, limbLen, segments: 0.3 } });
const day = { light: 1, heatBand: 0.5 };
const econ = { gravityWalk: 3, gravityScaleRef: 0.5 };
const inputs = (gravity: number, economics: DevelopInputs['economics'] = econ): DevelopInputs => ({
  solvent: { rho: 1, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] }, airDensity: 0.1, tissueDensity: { C: 1.05, Si: 2.2 }, gravity, economics,
});

describe('gravity: square-cube support (McMahon 1973)', () => {
  it('the limb load grows with g and with limb length, and walking costs more for it', () => {
    const long = walker(0.9), short = walker(0.1);
    const lo = develop(long, day, inputs(0.5)), hi = develop(long, day, inputs(1.5));
    expect(supportLoad(hi, 1.5, 0.5)).toBeGreaterThan(supportLoad(lo, 0.5, 0.5) * 2.5);
    expect(hi.modeCosts.walk).toBeGreaterThan(lo.modeCosts.walk);
    expect(supportLoad(develop(long, day, inputs(1)), 1, 0.5)).toBeGreaterThan(supportLoad(develop(short, day, inputs(1)), 1, 0.5));
  });
  it('long limbs lose more than short limbs when gravity rises (so selection shortens them)', () => {
    const rise = (g: number) => (limbLen: number) => develop(walker(limbLen), day, inputs(g)).modeCosts.walk;
    const lo = rise(0.5), hi = rise(1.5);
    expect(hi(0.9) / lo(0.9)).toBeGreaterThan(hi(0.1) / lo(0.1));
  });
  it('creatures ignore gravity when the world declares no economics', () => {
    const none = (g: number) => ({ ...inputs(g), economics: undefined });
    const a = develop(walker(0.6), day, none(0.5)), b = develop(walker(0.6), day, none(2));
    expect(a.modeCosts).toEqual(b.modeCosts);
  });
});

describe('heat balance: skin area', () => {
  const skin = (g: AnimalGenome) => { const p = develop(g, day, inputs(1)); return skinArea(p) / p.mass ** 0.75; };
  it('long limbs and a long body add skin per unit of heat made (radiators)', () => {
    expect(skin(walker(0.9))).toBeGreaterThan(skin(walker(0.1)));
    const slender = { ...walker(0.5), body: { ...walker(0.5).body, segments: 0.9 } };
    expect(skin(slender)).toBeGreaterThan(skin(walker(0.5)));
  });
  it('big bodies have less skin per M^0.75 than small ones (Bergmann)', () => {
    const big = { ...walker(0.5), body: { ...walker(0.5).body, size: 0.6 } };
    expect(skin(big)).toBeLessThan(skin(walker(0.5)));
  });
});

describe('oxygen: aerobic scope extends the one size cap', () => {
  const ct = { baseMaxSize: 0.5, maxSizePerPercent: 0.1, huntPenalty: 1 };
  it('the cap rises with oxygen and falls for hunters', () => {
    expect(maxBodySize(ct, 30)).toBeGreaterThan(maxBodySize(ct, 5));
    expect(maxBodySize(ct, 21, 1)).toBeLessThan(maxBodySize(ct, 21, 0));
    expect(maxBodySize({ baseMaxSize: 0.5, maxSizePerPercent: 0.1 }, 21, 1)).toBe(maxBodySize(ct, 21, 0));
  });
  it('is neutral on silicon: oxygen 0 or 21 changes nothing (no aerobic metabolism)', () => {
    const run = (oxygen: number) => {
      const { eco, env } = ecologyFromWorld(silicon);
      eco.seedLife({ ...env, oxygen }, undefined);
      for (let t = 0; t < 200; t++) eco.step({ ...env, oxygen }, 1 / 20);
      return [eco.animals, eco.biomass().consumerBiomass];
    };
    expect(run(0)).toEqual(run(21));
    expect(run(0)[0]).toBeGreaterThan(0);
  });
});

describe('nitrogen: a nutrient for producers (carbon)', () => {
  it('flora grows slower at low nitrogen', () => {
    const flora = (nitrogen: number) => {
      const { eco, env } = ecologyFromWorld(carbon);
      const e = { ...env, nitrogen };
      eco.seedLife(e);
      for (let t = 0; t < 400; t++) eco.step(e, 1 / 20);
      return eco.biomass().producerBiomass;
    };
    expect(flora(0.1)).toBeLessThan(flora(1));
  });
});

describe('GitHub #55: silicon swimmers follow the sea', () => {
  const DT = 1 / 20;
  const mk = () => { const { eco, env } = ecologyFromWorld(silicon); eco.seedLife(env); return { eco, env }; };
  const swimmers = (eco: ReturnType<typeof mk>['eco']) => {
    let swim = 0, dry = 0;
    for (let i = 0; i < CAP; i++) {
      if (!eco.alive[i] || eco.plan[i].mode !== 1) continue;
      swim++;
      if (eco.grid.liquid[Math.floor(eco.y[i]) * 64 + Math.floor(eco.x[i])] <= 0) dry++;
    }
    return { swim, dry };
  };
  it('a retreating sea strands swimmers; those out of reach lose energy and die; they recover when the sea returns', () => {
    const A = mk(), B = mk();
    const run = (sec: number) => { for (let t = 0; t < sec / DT; t++) { A.eco.step(A.env, DT); B.eco.step(B.env, DT); } };
    run(25);
    const full = Float32Array.from(B.eco.grid.liquid);
    // Lowering Nitrogen shrinks the sea (seaVolume): here the sea retreats until about 70% of its cells are dry.
    for (let c = 0; c < CELLS; c++) B.eco.grid.liquid[c] = Math.max(0, full[c] - 4);
    expect(swimmers(B.eco).dry).toBeGreaterThan(0);
    let trough = Infinity;
    for (let s = 0; s < 30; s++) { run(1); trough = Math.min(trough, swimmers(B.eco).swim / swimmers(A.eco).swim); }
    expect(trough).toBeLessThanOrEqual(0.75);   // at least 25% of the swimmers lost within 30 s
    expect(swimmers(B.eco).dry).toBe(0);        // survivors reached liquid
    for (let c = 0; c < CELLS; c++) B.eco.grid.liquid[c] = full[c];   // Nitrogen raised again
    run(30);
    expect(swimmers(B.eco).swim / swimmers(A.eco).swim).toBeGreaterThan(0.9);
  });
});
