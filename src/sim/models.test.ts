import { describe, expect, it } from 'vitest';
import { carbonFixture, siliconFixture } from './__fixtures__/worlds';
import {
  airHeldNitrogen, gasDensity, interp, interpLog, orbitForTemperature, partialPressures, radiativeBalance,
  seaCover, seaVolume, vapourPressure, type PartialPressureParams, type RadiativeParams, type SeaParams,
} from './models';

const rad = carbonFixture.derived[0].params as unknown as RadiativeParams;
const pp = carbonFixture.derived[1].params as unknown as PartialPressureParams;
const sea = siliconFixture.derived[0].params as unknown as SeaParams;
const n2 = siliconFixture.solvent;

describe('interp', () => {
  it('interpolates linearly and clamps', () => {
    const t: [number, number][] = [[0, 0], [10, 100]];
    expect(interp(t, 5)).toBe(50);
    expect(interp(t, -5)).toBe(0);
    expect(interp(t, 50)).toBe(100);
  });
  it('log-interpolates and extrapolates', () => {
    const t: [number, number][] = [[0, 1], [1, 10]];
    expect(interpLog(t, 0.5)).toBeCloseTo(Math.sqrt(10), 9);
    expect(interpLog(t, 2)).toBeCloseTo(100, 6);
  });
  it('throws on bad tables', () => {
    expect(() => interp([], 0)).toThrow();
    expect(() => interpLog([[0, 1]], 0)).toThrow();
  });
});

describe('vapourPressure / gasDensity', () => {
  it('N₂ at 90 K is about 3.6 bar and at the boiling point 1 bar', () => {
    expect(vapourPressure(n2, -183.15)).toBeCloseTo(3.6, 6);
    expect(vapourPressure(n2, -195.8)).toBeCloseTo(1.013, 6);
  });
  it('stops at the critical value above the critical point', () => {
    expect(vapourPressure(n2, 100)).toBeCloseTo(33.9, 6);
  });
  it("matches Earth's air density and Titan-like thick N₂ air", () => {
    expect(gasDensity(1.013, 15, 0.0288)).toBeCloseTo(1.22, 1);
    expect(gasDensity(3.6, -183.15, 0.028)).toBeGreaterThan(10);
  });
});

describe('radiativeBalance', () => {
  it('gives about 15 °C at 1 AU with 1 × nitrogen and inverts exactly', () => {
    const t = radiativeBalance(rad, 1, 1);
    expect(t).toBeGreaterThan(10);
    expect(t).toBeLessThan(20);
    expect(orbitForTemperature(rad, t, 1)).toBeCloseTo(1, 9);
    expect(orbitForTemperature(rad, -100, 3)).toBeGreaterThan(1);
  });
  it('more nitrogen warms a world that has a greenhouse term', () => {
    expect(radiativeBalance(rad, 1, 10)).toBeGreaterThan(radiativeBalance(rad, 1, 1));
  });
});

describe('partialPressures', () => {
  it('is about 1 bar for Earth gases at 1 g', () => {
    const p = partialPressures(pp, carbonFixture.solvent, { nitrogen: 1, oxygenPct: 21, tC: 15, gravity: 1 });
    expect(p).toBeGreaterThan(0.98);
    expect(p).toBeLessThan(1.05);
  });
  it('scales dry gas with gravity', () => {
    const lo = partialPressures(pp, carbonFixture.solvent, { nitrogen: 1, oxygenPct: 21, tC: 15, gravity: 0.5 });
    expect(lo).toBeLessThan(0.6);
  });
});

describe('sea model', () => {
  it('seas hold the air at vapour pressure: air holds ~6 × Earth N₂ at −183 °C and 0.75 g', () => {
    expect(airHeldNitrogen(sea, n2, -183.15, 0.75)).toBeCloseTo(3.6 / (0.75 * 0.78), 6);
  });
  it('volume is inventory minus air, zero when short or past critical', () => {
    expect(seaVolume(sea, n2, 30, -183.15, 0.75)).toBeCloseTo(30 - 6.1538, 3);
    expect(seaVolume(sea, n2, 3, -183.15, 0.75)).toBe(0);
    expect(seaVolume(sea, n2, 1000, -100, 0.75)).toBe(0);
  });
  it('cover is 0 at no volume and rises monotonically toward maxCover', () => {
    expect(seaCover(sea, 0)).toBe(0);
    expect(seaCover(sea, 20)).toBeCloseTo(0.45, 9);
    expect(seaCover(sea, 1e6)).toBeLessThanOrEqual(0.9);
    expect(seaCover(sea, 50)).toBeGreaterThan(seaCover(sea, 10));
  });
});
