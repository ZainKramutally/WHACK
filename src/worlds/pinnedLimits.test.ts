// Issue #13: the placeholder limits are argued from real numbers, and these tests keep the arguments true.
import { describe, expect, it } from 'vitest';
import { airHeldNitrogen, nitrogenWarming, seaCover, seaVolume, vapourPressure, type RadiativeParams, type SeaParams } from '../sim/models';
import { carbon } from './carbon';
import { controls } from './controls';
import { silicon } from './silicon';
import { sources } from './sources';

const limit = (w: typeof carbon, id: string) => w.limits.find((l) => l.id === id)!;
const radiative = carbon.derived.find((d) => d.model === 'radiativeBalance')!.params as unknown as RadiativeParams;
const sea = silicon.derived.find((d) => d.model === 'seaVolume')!.params as unknown as SeaParams;
const EARTH_N2_KG_PER_M2 = (0.78 * 1e5) / 9.80665;   // mass of N₂ over a square metre of Earth
const LIQUID_N2_KG_PER_M3 = 780;                      // approximate density of liquid N₂ near −183 °C (NIST)

describe('carbon limits (#13)', () => {
  it('lower nitrogen edge keeps water liquid and sits under the early-Earth bound', () => {
    const edge = limit(carbon, 'tooLittleNitrogen').params.value;
    const n2Bar = edge * 0.78;   // 1 g
    const vapour = 0.017;        // water at 15 °C, bar
    expect(edge).toBe(0.05);
    expect(n2Bar).toBeGreaterThan(vapour);
    expect(n2Bar).toBeLessThan(0.23);   // Som 2016's central estimate for the whole 2.7 Ga atmosphere
    expect(limit(carbon, 'tooLittleNitrogen').sources).toContain('som2016');
  });

  it('lower temperature edge is a flagged assumption backed by the Snowball Earth source', () => {
    const l = limit(carbon, 'tooCold');
    expect(l.params.value).toBe(-50);
    expect(l.assumption).toBe(true);
    expect(l.sources).toContain('hoffman2017');
  });

  it('nitrogen warming is about 1 K per doubling in the sourced range and stays bounded at the slider ends', () => {
    expect(nitrogenWarming(radiative, 2)).toBeCloseTo(1, 0);
    expect(nitrogenWarming(radiative, controls.nitrogen.max)).toBeLessThan(11);
    expect(nitrogenWarming(radiative, controls.nitrogen.min)).toBeGreaterThan(-8);
  });
});

describe('silicon limits (#13)', () => {
  it('oxygen trace threshold is invisible on the slider track and flagged as ours', () => {
    const l = limit(silicon, 'oxygenRusts');
    expect(l.params.value / (controls.oxygen.max - controls.oxygen.min)).toBeLessThanOrEqual(0.001);
    expect(l.assumption).toBe(true);
  });

  it('default nitrogen is the Titan order of magnitude', () => {
    const titanAir = (1.47e5 / 1.35) / EARTH_N2_KG_PER_M2;   // Fulchignoni 2005: 1.47 bar at 1.35 m/s²
    const n = silicon.startDefaults.nitrogen;
    expect(titanAir).toBeGreaterThan(12);
    expect(titanAir).toBeLessThan(16);
    expect(n / titanAir).toBeGreaterThan(1);
    expect(n / titanAir).toBeLessThan(4);
    expect(silicon.derived.find((d) => d.model === 'seaVolume')!.sources).toContain('mastrogiuseppe2014');
  });

  it('default seas are hundreds of metres deep at every gravity, as Titan\'s are tens to hundreds', () => {
    for (const g of [0.5, 0.75, 1.0]) {
      const volume = seaVolume(sea, silicon.solvent, silicon.startDefaults.nitrogen, silicon.startDefaults.temperature, g);
      const cover = seaCover(sea, volume);
      const meanDepth = (volume * EARTH_N2_KG_PER_M2) / LIQUID_N2_KG_PER_M3 / cover;   // over the covered area
      expect(meanDepth).toBeGreaterThan(160);   // Ligeia Mare, Mastrogiuseppe 2014
      expect(meanDepth).toBeLessThan(1000);
      expect(cover).toBeGreaterThan(0.25);
      expect(cover).toBeLessThan(0.65);
    }
    expect(airHeldNitrogen(sea, silicon.solvent, -183, 0.75)).toBeCloseTo(vapourPressure(silicon.solvent, -183) / (0.75 * 0.78), 6);
  });
});

describe('new sources (#13)', () => {
  it('are verified entries with DOIs', () => {
    expect(sources.fulchignoni2005.doi).toBe('10.1038/nature04314');
    expect(sources.mastrogiuseppe2014.doi).toBe('10.1002/2013GL058618');
  });
});
