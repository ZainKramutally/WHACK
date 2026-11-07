import { describe, expect, it } from 'vitest';
import { clampToBand, fracToValue, pinTraceOxygen, redSegments, valueToFrac } from './sliderMath';
import { formatValue, formatYears } from './format';

const temp = { min: -250, max: 150, scale: 'linear' as const };
const nitro = { min: 0.01, max: 1000, scale: 'log' as const };

describe('value <-> position', () => {
  it('maps linear ends and midpoint', () => {
    expect(valueToFrac(-250, temp)).toBe(0);
    expect(valueToFrac(150, temp)).toBe(1);
    expect(valueToFrac(-50, temp)).toBeCloseTo(0.5);
    expect(fracToValue(0.5, temp)).toBeCloseTo(-50);
  });
  it('maps log scale: 1 × Earth sits 40% along 0.01..1000', () => {
    expect(valueToFrac(1, nitro)).toBeCloseTo(0.4);
    expect(fracToValue(0.4, nitro)).toBeCloseTo(1);
    expect(fracToValue(0, nitro)).toBeCloseTo(0.01);
  });
  it('clamps out-of-range input', () => {
    expect(valueToFrac(999, temp)).toBe(1);
    expect(fracToValue(-3, temp)).toBe(-250);
  });
  it('round-trips', () => {
    for (const f of [0.1, 0.37, 0.9]) expect(valueToFrac(fracToValue(f, nitro), nitro)).toBeCloseTo(f);
  });
});

describe('clampToBand', () => {
  const band = { low: -210, high: -147, lowLimitId: 'frozen', highLimitId: 'critical' };
  it('passes values inside', () => expect(clampToBand(-180, band)).toEqual({ value: -180, blocked: null }));
  it('stops at the low edge with its limit', () =>
    expect(clampToBand(-240, band)).toEqual({ value: -210, blocked: 'low', limitId: 'frozen' }));
  it('stops at the high edge with its limit', () =>
    expect(clampToBand(20, band)).toEqual({ value: -147, blocked: 'high', limitId: 'critical' }));
  it('leaves the thumb alone when the band is empty', () =>
    expect(clampToBand(15, { low: 0, high: 0, empty: true, blockingLimitId: 'x' })).toEqual({ value: 15, blocked: null }));
});

describe('redSegments', () => {
  it('draws both sides', () => {
    const segs = redSegments({ low: -50, high: 122, lowLimitId: 'cold', highLimitId: 'hot' }, temp);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ side: 'low', from: 0, limitId: 'cold' });
    expect(segs[0].to).toBeCloseTo(0.5);
    expect(segs[1]).toMatchObject({ side: 'high', to: 1, limitId: 'hot' });
    expect(segs[1].from).toBeCloseTo(0.93);
  });
  it('draws nothing where the band reaches the track end', () => {
    expect(redSegments({ low: 0.01, high: 1000 }, nitro)).toEqual([]);
    const only = redSegments({ low: 0.05, high: 1000, lowLimitId: 'n' }, nitro);
    expect(only).toHaveLength(1);
    expect(only[0].side).toBe('low');
  });
  it('whole track red when empty', () =>
    expect(redSegments({ low: 0, high: 0, empty: true, blockingLimitId: 'seas' }, nitro)).toEqual([
      { side: 'all', from: 0, to: 1, limitId: 'seas' },
    ]));
});

describe('format', () => {
  it('formats values', () => {
    expect(formatValue(-183, '°C')).toBe('−183 °C');
    expect(formatValue(21, '%')).toBe('21.0%');
    expect(formatValue(0.05, '× Earth')).toBe('0.050 × Earth');
  });
  it('formats years', () => expect(formatYears(4.5e9)).toBe('4.50 billion years'));
});

describe('pinTraceOxygen', () => {
  const trace = { low: 0, high: 0.01 };
  it('pins a positive value to 0 when the whole band is a trace', () => {
    expect(pinTraceOxygen('oxygen', trace, 0.01, 0.01)).toBe(0);
    expect(pinTraceOxygen('oxygen', trace, 0.003, 0.01)).toBe(0);
    expect(pinTraceOxygen('oxygen', trace, 0, 0.01)).toBe(0);
  });
  it('leaves wider bands, other sliders and empty bands alone', () => {
    expect(pinTraceOxygen('oxygen', { low: 0, high: 40 }, 21, 0.01)).toBe(21);
    expect(pinTraceOxygen('nitrogen', trace, 0.005, 0.01)).toBe(0.005);
    expect(pinTraceOxygen('oxygen', { low: 0, high: 0, empty: true }, 5, 0.01)).toBe(5);
    expect(pinTraceOxygen('oxygen', null, 5, 0.01)).toBe(5);
  });
});
