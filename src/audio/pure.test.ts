import { describe, expect, it } from 'vitest';
import { ambienceTargets, callRate, speedOfSound, type AmbienceInputs } from './pure';

const base: AmbienceInputs = { scene: 'world', worldId: 'carbon', spawned: true, buildProgress: 1, seasFilled: true, lifeStarted: true, frozen: false, underwater: false, shoreK: 0 };

describe('speed of sound', () => {
  it('is ~343 m/s in Earth air and ~190 m/s in cold nitrogen', () => {
    expect(speedOfSound(20, 0.0288)).toBeGreaterThan(340);
    expect(speedOfSound(20, 0.0288)).toBeLessThan(348);
    const c = speedOfSound(-183, 0.028);
    expect(c).toBeGreaterThan(185); expect(c).toBeLessThan(205);
  });
  it('lowers call pitch in cold air and for big bodies, clamped', () => {
    expect(callRate(1, -183, 0.028)).toBeLessThan(callRate(1, 15, 0.0288));
    expect(callRate(100, 15, 0.0288)).toBeCloseTo(0.5 * speedOfSound(15, 0.0288) / 343);
  });
});

describe('ambience', () => {
  it('selection plays only the select bed', () => expect(ambienceTargets({ ...base, scene: 'select' })).toEqual({ 'amb.select': 1 }));
  it('no sea sounds before the seas fill, no living bed before life', () => {
    const t = ambienceTargets({ ...base, seasFilled: false, lifeStarted: false, shoreK: 1 });
    expect(t['amb.carbon.shore']).toBeUndefined();
    expect(t['amb.carbon.barren']).toBeGreaterThan(0);
    expect(t['amb.carbon.land']).toBeUndefined();
  });
  it('frozen replaces shore lapping', () => {
    const t = ambienceTargets({ ...base, frozen: true, shoreK: 1 });
    expect(t['amb.carbon.shore']).toBeUndefined();
    expect(t['amb.frozen']).toBeGreaterThan(0);
  });
  it('underwater swaps to the under bed', () => expect(ambienceTargets({ ...base, worldId: 'silicon', underwater: true })).toEqual({ 'amb.silicon.under': 1 }));
  it('build rise plays until the build completes', () => expect(ambienceTargets({ ...base, buildProgress: 0.4 })['amb.build.rise']).toBe(1));
});
