// A slider's target: what the player has asked for, as opposed to the eased live value the sim reports back.
// Nudges step from the target, so rapid presses add up even while the live value is still gliding.
import { fracToValue, valueToFrac } from './sliderMath';
import type { ControlDef } from '../worlds/types';

/** If the player has not touched the slider for this long, the live value wins again (the sim may have moved it). */
export const IDLE_ADOPT_MS = 5000;
/** A live value moving away from the target this soon after input still counts as the sim overriding it. */
const DRIFT_GRACE_MS = 300;

export interface SliderTarget {
  /** The value the player last asked for (display units). */
  target: number;
  /** |live − target| at the last sync, to tell easing toward the target from drifting away from it. */
  gap: number;
  lastInputAt: number;
}

export const newTarget = (value: number): SliderTarget => ({ target: value, gap: 0, lastInputAt: -Infinity });

/** The player asked for `value` (a drag position or a nudge result). */
export function setTarget(st: SliderTarget, value: number, live: number, now: number): void {
  st.target = value;
  st.gap = Math.abs(value - live);
  st.lastInputAt = now;
}

/** The value one nudge of `dir` (±1) steps from the current target, `step` being a fraction of the track. */
export function nudgedValue(st: SliderTarget, dir: number, def: Pick<ControlDef, 'min' | 'max' | 'scale'>, step: number): number {
  return fracToValue(valueToFrac(st.target, def) + dir * step, def);
}

/**
 * A snapshot reported `live`. Returns true if the target was replaced by it: the sim moved the setting itself
 * (drift easing it back into the band, or a blocked request) or the player has been idle for a while.
 * While the live value is simply easing toward the target, the target stays.
 */
export function syncLive(st: SliderTarget, live: number, now: number): boolean {
  const tol = 1e-6 * Math.max(1, Math.abs(st.target));
  const gap = Math.abs(live - st.target);
  if (gap <= tol) { st.gap = 0; return false; }
  const idle = now - st.lastInputAt;
  const drifting = gap > st.gap + tol && idle > DRIFT_GRACE_MS;
  if (drifting || idle > IDLE_ADOPT_MS) {
    st.target = live;
    st.gap = 0;
    return true;
  }
  st.gap = gap;
  return false;
}
