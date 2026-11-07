// The real configs, run through sim/limits.ts, behave as CLAUDE.md "Condition sliders" says.
import { describe, expect, it } from 'vitest';
import { canLive, livingBands, startingConditions } from '../sim/limits';
import { controls } from './controls';
import { carbon } from './carbon';
import { silicon } from './silicon';
import type { Conditions } from './types';

const env = { controls: Object.values(controls) };
const c = (temperature: number, nitrogen: number, oxygen: number): Conditions => ({ temperature, nitrogen, oxygen });
const failing = (w: typeof carbon, x: Conditions) => {
  const r = canLive(w, x, env);
  return r.ok ? undefined : r.limit.id;
};

describe('carbon on real config', () => {
  it('lives at Earth conditions and at any oxygen', () => {
    expect(canLive(carbon, c(15, 1, 21), env).ok).toBe(true);
    expect(canLive(carbon, c(15, 1, 0), env).ok).toBe(true);
    expect(canLive(carbon, c(15, 1, 40), env).ok).toBe(true);
  });

  it('upper temperature edge is 122 whatever the nitrogen', () => {
    for (const n of [0.1, 1, 100]) {
      const t = livingBands(carbon, c(15, n, 21), env).temperature;
      expect(t.high).toBeCloseTo(122, 6);
      expect(t.highLimitId).toBe('tooHot');
      expect(t.low).toBeCloseTo(-50, 6);
    }
  });

  it('is red at -183 °C and at too little nitrogen', () => {
    expect(failing(carbon, c(-183, 1, 21))).toBe('tooCold');
    expect(failing(carbon, c(15, 0.01, 21))).toBe('tooLittleNitrogen');
  });

  it('keeps untouched sliders as they are', () => {
    expect(startingConditions(carbon, c(15, 1, 21), env)).toEqual({ start: c(15, 1, 21), moved: [] });
  });
});

describe('silicon on real config', () => {
  it('fails at -183 °C and 1 × nitrogen, passes with enough nitrogen and no oxygen', () => {
    expect(failing(silicon, c(-183, 1, 0))).toBe('seasGone');
    expect(canLive(silicon, c(-183, 30, 0), env).ok).toBe(true);
    expect(failing(silicon, c(-183, 30, 21))).toBe('oxygenRusts');
  });

  it('Nitrogen band is empty at 15 °C', () => {
    expect(livingBands(silicon, c(15, 30, 0), env).nitrogen.empty).toBe(true);
  });

  it('Oxygen band is pinned near zero', () => {
    const o = livingBands(silicon, c(-183, 30, 0), env).oxygen;
    expect(o.low).toBe(0);
    expect(o.high).toBeCloseTo(0.01, 6);
  });

  it('upper temperature edge never exceeds the critical point, and falls with nitrogen', () => {
    const edge = (n: number) => livingBands(silicon, c(-183, n, 0), env).temperature.high;
    expect(edge(30)).toBeLessThanOrEqual(-147);
    expect(edge(1000)).toBeLessThanOrEqual(-147);
    expect(edge(10)).toBeLessThan(edge(30));
    expect(edge(30)).toBeLessThan(edge(100));
    expect(livingBands(silicon, c(-183, 30, 0), env).temperature.low).toBeCloseTo(-210, 6);
  });

  it('untouched Earth sliders move temperature, then nitrogen, then oxygen', () => {
    const { start, moved } = startingConditions(silicon, c(15, 1, 21), env);
    expect(start).toEqual(c(-183, 30, 0));
    expect(moved.map((m) => m.controlId)).toEqual(['temperature', 'nitrogen', 'oxygen']);
    expect(canLive(silicon, start, env).ok).toBe(true);
  });

  it('keeps in-band values the player chose', () => {
    const { start, moved } = startingConditions(silicon, c(-190, 60, 0), env);
    expect(start).toEqual(c(-190, 60, 0));
    expect(moved).toEqual([]);
  });
});
