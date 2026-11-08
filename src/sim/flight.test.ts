import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { develop } from './develop';
import { aerobicScope, climbRate, flightCeiling, flightModeCost, flightParamsFor, powerRatio, scaleHeight, type FlightBody, type FlightEnv } from './flight';
import { makeFounders } from './genome';

const P = flightParamsFor(carbon.life.inputs);
const earth: FlightEnv = { gravity: 1, temperatureC: 15, oxygenPct: 21, airKgM3: 1.2 };
const bird = (mass: number): FlightBody => ({ mass, liftSpan: 0.8 * mass ** (1 / 3) * 2.2, bodyDensity: 1.05, chemistry: 'carbon' });
const ceil = (b: FlightBody, e: Partial<FlightEnv> = {}) => flightCeiling(b, { ...earth, ...e }, P, 1.05);

describe('flightCeiling', () => {
  it('a light, big-winged body flies km high on Earth-like air', () => {
    expect(ceil(bird(0.3))).toBeGreaterThan(1000);
  });
  it('lower gravity gives a higher ceiling', () => {
    expect(ceil(bird(0.5), { gravity: 0.8 })).toBeGreaterThan(ceil(bird(0.5)));
  });
  it('thicker air gives a higher ceiling', () => {
    expect(ceil(bird(0.5), { airKgM3: 3.6 })).toBeGreaterThan(ceil(bird(0.5)));
  });
  it('a heavier body has a lower ceiling, and past a mass limit it cannot leave the ground', () => {
    expect(ceil(bird(0.5))).toBeGreaterThan(ceil(bird(2)));
    expect(ceil(bird(2000))).toBe(0);
  });
  it('scale height grows with temperature and falls with gravity', () => {
    expect(scaleHeight({ temperatureC: 15, gravity: 0.8 }, P)).toBeGreaterThan(scaleHeight({ temperatureC: 15, gravity: 1 }, P));
    expect(scaleHeight({ temperatureC: 40, gravity: 1 }, P)).toBeGreaterThan(scaleHeight({ temperatureC: 15, gravity: 1 }, P));
  });
  it('a gas-bag body lighter than the air rises on buoyancy alone', () => {
    const floater: FlightBody = { mass: 500, liftSpan: 0.5, bodyDensity: 0.05, chemistry: 'carbon' };
    expect(ceil(floater, { airKgM3: 10 })).toBeGreaterThan(0);
  });
  it('silicon flight is not oxygen-limited; carbon flight is', () => {
    expect(aerobicScope('silicon', 0, P)).toBe(P.siliconScope);
    expect(aerobicScope('carbon', 5, P)).toBeLessThan(aerobicScope('carbon', 21, P));
    expect(ceil(bird(0.5), { oxygenPct: 5 })).toBeLessThan(ceil(bird(0.5)));
  });
});

describe('flight cost', () => {
  const walkLegless = 6; // develop(): 1 + crawlBase for a legless crawler
  it('past a mass limit flight costs more than walking', () => {
    const heavy = bird(2000);
    const r = powerRatio(heavy, earth, P);
    expect(r).toBeGreaterThan(1);
    expect(flightModeCost(r, P)).toBeGreaterThan(walkLegless);
  });
  it('a light flier pays less than a crawler', () => {
    expect(flightModeCost(powerRatio(bird(0.3), earth, P), P)).toBeLessThan(walkLegless);
  });
  it('develop(): lower gravity and thicker air make hovering cheaper for the same genome', () => {
    const g = makeFounders(7, 1, carbon.life.composition)[0]!;
    g.body.limbLen = 0.9; g.body.limbPairs = 0; g.body.size = 0.1;
    const inputs = (gravity: number, air: number) => ({
      solvent: carbon.life.inputs.solvent, airDensity: air * P.airScale, tissueDensity: carbon.life.inputs.tissueDensity, gravity, flight: P,
    });
    const hover = (gv: number, air: number) => develop(g, { light: 1, heatBand: 0.5 }, inputs(gv, air)).modeCosts.hover;
    expect(hover(0.8, 1.2)).toBeLessThan(hover(1.3, 1.2));
    expect(hover(1, 3.6)).toBeLessThan(hover(1, 1.2));
  });
  it('climb rate is positive below the ceiling and zero above it', () => {
    const b = bird(0.3), c = ceil(b);
    expect(climbRate(b, earth, P, 0)).toBeGreaterThan(0);
    expect(climbRate(b, earth, P, c * 1.5)).toBe(0);
  });
  it('silicon config carries the same flight keys', () => {
    expect(Object.keys(silicon.life.inputs.flight).sort()).toEqual(Object.keys(carbon.life.inputs.flight).sort());
  });
});
