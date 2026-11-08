// Player-controlled time speed after the build (a playback control, not a condition: the three-sliders rule still holds).
export const TIME_FACTORS = [1, 2, 4, 8, 16] as const;
export type TimeFactor = (typeof TIME_FACTORS)[number];
/** Snap any number to the nearest allowed factor. */
export function nearestTimeFactor(f: number): TimeFactor {
  let best: TimeFactor = 1;
  for (const t of TIME_FACTORS) if (Math.abs(t - f) < Math.abs(best - f)) best = t;
  return best;
}
