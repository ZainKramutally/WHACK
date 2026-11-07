import { describe, expect, it } from 'vitest';
import { WorldSimulation } from '../sim/simulation';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { statsAtStart } from './otherWorld';

describe('statsAtStart (the other world in the comparison column)', () => {
  it('silicon: the real derived values at −183 °C, not target midpoints', () => {
    const s = statsAtStart(silicon);
    expect(s.temperature).toBeCloseTo(-183, 3);
    expect(s.nitrogen).toBe(30);
    expect(s.oxygen).toBe(0);
    expect(s.pressure).toBeGreaterThan(3.4);
    expect(s.pressure).toBeLessThan(3.9); // nitrogen vapour pressure at −183 °C, not the 6 bar target midpoint
    expect(s.light).toBeCloseTo(0.016, 2); // not the 0.013 target midpoint
    expect(s.seaCover).toBeGreaterThan(0);
    expect(s.pace).toBeLessThan(1e-6);
  });

  it('carbon: Earth-like start values', () => {
    const s = statsAtStart(carbon);
    expect(s.temperature).toBeCloseTo(15, 3);
    expect(s.oxygen).toBe(21);
    expect(s.nitrogen).toBe(1);
    expect(s.pressure).toBeGreaterThan(0.9);
    expect(s.pressure).toBeLessThan(1.5);
    expect(s.co2).toBeCloseTo((carbon.ranges.co2[0] + carbon.ranges.co2[1]) / 2, 6);
    expect(s.seaCover).toBeCloseTo((carbon.ranges.seaCover[0] + carbon.ranges.seaCover[1]) / 2, 6);
  });

  for (const w of [carbon, silicon]) {
    it(`${w.id}: matches the live sim at t = 0 for the stats that are not sampled`, () => {
      const sim = new WorldSimulation(w, w.startDefaults, { seed: 1 }).snapshot().stats;
      const s = statsAtStart(w);
      for (const id of ['temperature', 'nitrogen', 'oxygen', 'light', 'pace']) {
        // light depends on the sampled CO₂ greenhouse on carbon, so allow a fraction of a percent there
        if (id in sim) expect(s[id], `${w.id} ${id}`).toBeCloseTo(sim[id], id === 'light' ? 2 : Math.abs(sim[id]) < 1e-3 ? 12 : 3);
      }
      if (w.id === 'silicon') {
        // pressure and sea cover depend on the (sampled) gravity: within a few % of the sim for the range midpoint
        expect(s.pressure).toBeCloseTo(sim.pressure, 1);
      }
    });
  }
});
