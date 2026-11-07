import { describe, expect, it } from 'vitest';
import { controls } from '../worlds/controls';
import { IDLE_ADOPT_MS, newTarget, nudgedValue, setTarget, syncLive } from './sliderTarget';

const temp = controls.temperature; // −250..150 °C linear: one 1% step is 4 °C
const STEP = 0.01;

describe('slider target', () => {
  it('rapid nudges add up even while the live value lags (3 presses = +12 °C, not +5.9)', () => {
    const st = newTarget(15);
    let live = 15; // the sim eases: it has not moved yet
    let t = 0;
    for (let i = 0; i < 3; i++) {
      setTarget(st, nudgedValue(st, +1, temp, STEP), live, t);
      t += 50;
      live += (st.target - live) * 0.3; // a snapshot arrives: live eases toward the target
      expect(syncLive(st, live, t)).toBe(false); // ...and must not overwrite the target
    }
    expect(st.target).toBeCloseTo(27, 6);
  });

  it('nudges down as well, from the target', () => {
    const st = newTarget(0);
    setTarget(st, nudgedValue(st, -1, temp, STEP), 0, 0);
    setTarget(st, nudgedValue(st, -1, temp, STEP), 0, 10);
    expect(st.target).toBeCloseTo(-8, 6);
  });

  it('log sliders step multiplicatively from the target', () => {
    const n = controls.nitrogen;
    const st = newTarget(1);
    setTarget(st, nudgedValue(st, +1, n, STEP), 1, 0);
    const once = st.target;
    setTarget(st, nudgedValue(st, +1, n, STEP), 1, 1);
    expect(st.target / once).toBeCloseTo(once / 1, 4);
  });

  it('keeps the target while live eases toward it', () => {
    const st = newTarget(15);
    setTarget(st, 40, 15, 0);
    for (const [live, now] of [[20, 100], [30, 200], [38, 400]] as const) expect(syncLive(st, live, now)).toBe(false);
    expect(st.target).toBe(40);
    expect(syncLive(st, 40, 600)).toBe(false);
  });

  it('adopts the live value when the sim moves the setting away from the target (drift)', () => {
    const st = newTarget(15);
    setTarget(st, 15, 15, 0);
    expect(syncLive(st, 15, 100)).toBe(false);
    expect(syncLive(st, 12, 1000)).toBe(true); // moved away on its own, long after the last input
    expect(st.target).toBe(12);
  });

  it('does not treat the first snapshot after a nudge as drift', () => {
    const st = newTarget(15);
    setTarget(st, 19, 15, 1000); // live is still 15
    expect(syncLive(st, 15, 1020)).toBe(false);
    expect(st.target).toBe(19);
  });

  it('adopts the live value once the player has been idle (a request the sim clamped never arrives)', () => {
    const st = newTarget(15);
    setTarget(st, 40, 15, 0);
    expect(syncLive(st, 30, IDLE_ADOPT_MS - 10)).toBe(false);
    expect(syncLive(st, 30, IDLE_ADOPT_MS + 10)).toBe(true);
    expect(st.target).toBe(30);
  });
});
