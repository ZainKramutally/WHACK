import { describe, expect, it } from 'vitest';
import { LENS_HALF, easeSubmersion, stepSubmersion, submersionTarget, waterlineNdc } from './underwater';

describe('waterlineNdc', () => {
  it('crosses the centre with the camera at the surface and moves up as it sinks', () => {
    expect(waterlineNdc(0, 1)).toBe(0);
    expect(waterlineNdc(0.3, 1)).toBeCloseTo(0.5);    // 0.3 m under: the line sits in the upper half
    expect(waterlineNdc(-0.3, 1)).toBeCloseTo(-0.5);  // 0.3 m above: only the bottom quarter is wet
  });

  it('is off screen beyond the lens, and a pitched camera has a narrower window', () => {
    expect(waterlineNdc(LENS_HALF + 0.1, 1)).toBeGreaterThan(1);
    expect(waterlineNdc(-LENS_HALF - 0.1, 1)).toBeLessThan(-1);
    expect(waterlineNdc(0.3, 0.5)).toBeCloseTo(1);
  });

  it('stays finite when the lens lies flat or the depth is not finite', () => {
    expect(waterlineNdc(0.01, 0)).toBe(1e3);
    expect(waterlineNdc(-0.01, 0)).toBe(-1e3);
    expect(waterlineNdc(-Infinity, 1)).toBe(-1e3);
    expect(waterlineNdc(1e9, 1)).toBe(1e3);
  });
});

describe('submersion gate', () => {
  it('is on under a liquid sea or within the lens above it, never on a frozen one', () => {
    expect(submersionTarget(2, true)).toBe(1);
    expect(submersionTarget(-0.5, true)).toBe(1);
    expect(submersionTarget(-0.7, true)).toBe(0);
    expect(submersionTarget(5, false)).toBe(0);
  });

  it('ramps over 0.25 s and lands exactly on 1 and back on 0', () => {
    let s = stepSubmersion(0, 1, 0.125);
    expect(s).toBeCloseTo(0.5);
    s = stepSubmersion(s, 1, 0.2);
    expect(s).toBe(1);
    s = stepSubmersion(s, 0, 1);
    expect(s).toBe(0);
    expect(stepSubmersion(0.4, 1, 0)).toBe(0.4);
    expect(easeSubmersion(0)).toBe(0);
    expect(easeSubmersion(1)).toBe(1);
    expect(easeSubmersion(0.5)).toBeCloseTo(0.5);
  });
});
