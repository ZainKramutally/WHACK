// Underwater overlay state (render-only, art layer): the eased submersion gate sky.ts writes into LOOK.underwater, and
// where the sea surface crosses the view for post.ts's waterline. Pure numbers, no three.js.
//
// The waterline uses a virtual lens: a flat window of half-height LENS_HALF metres centred on the camera, in its image
// plane. A screen row is in the water when its point on that window is below the sea surface, so the surface shows as a
// horizontal line while the camera is within LENS_HALF·upY of it (the follow camera never rolls), and the whole view is
// on one side otherwise.

/** Half-height (m) of the camera's virtual lens: the waterline is on screen while the camera is this close to the surface. */
export const LENS_HALF = 0.6;
/** Seconds the overlay takes to fade in or out. */
export const SUBMERSION_SEC = 0.25;
/** Beyond this the waterline is off screen and the result is clamped (keeps the uniform finite). */
const NDC_CLAMP = 1e3;

/**
 * Screen y in NDC (+1 top, -1 bottom) of the waterline: rows below it are in the water.
 * `depth` = seaLevel - camera y (positive below the surface); `upY` = the world y of the camera's up vector (cos pitch).
 * Above +1 the whole view is wet; below -1 it is dry. A lens lying flat (upY ≈ 0) is all on one side.
 */
export function waterlineNdc(depth: number, upY: number, lensHalf = LENS_HALF): number {
  if (!Number.isFinite(depth)) return depth > 0 ? NDC_CLAMP : -NDC_CLAMP;
  if (!(upY > 1e-3)) return depth > 0 ? NDC_CLAMP : -NDC_CLAMP;
  const y = depth / (lensHalf * upY);
  return y > NDC_CLAMP ? NDC_CLAMP : y < -NDC_CLAMP ? -NDC_CLAMP : y;
}

/** 1 when the overlay should be on: the sea is liquid and the camera is under the surface or within the lens of it. */
export function submersionTarget(depth: number, liquid: boolean, lensHalf = LENS_HALF): 0 | 1 {
  return liquid && depth > -lensHalf ? 1 : 0;
}

/** Linear ramp toward `target` over `sec`. Lands on exactly 0 and 1, so post.ts can skip the overlay branch. */
export function stepSubmersion(prev: number, target: number, dt: number, sec = SUBMERSION_SEC): number {
  const step = dt > 0 ? dt / sec : 0;
  const s = target > prev ? Math.min(target, prev + step) : Math.max(target, prev - step);
  return s < 0 ? 0 : s > 1 ? 1 : s;
}

/** Smoothstep shaping of the ramp (0 and 1 stay exact). */
export function easeSubmersion(s: number): number {
  const t = s < 0 ? 0 : s > 1 ? 1 : s;
  return t * t * (3 - 2 * t);
}
