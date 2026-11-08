// Juveniles draw smaller (render-only, read from OrganismField.grown = current ÷ adult mass). Pure, no three.js.
// Mass → length is a cube root, and it enters the display-size curve (layout.ts displayLength) as the juvenile's real
// length, so a juvenile is drawn as its own size would be, not as a shrunken copy of its adult's drawn size.
import { displayLength } from '../layout';

/** Smallest drawn length fraction: newborns stay visible and clickable. */
export const GROWN_FLOOR = 0.35;

/** Length fraction of adult for a mass fraction `grown` (cube root, floored). Missing, 0, NaN or ≥ 1 → 1 (adult). */
export function growthLength(grown: number | undefined): number {
  if (grown === undefined || !(grown > 0) || grown >= 1) return 1;
  return Math.max(GROWN_FLOOR, Math.cbrt(grown));
}

/** Drawn length (m) of an animal whose adult plan is `scale` long and whose length fraction is `g` (growthLength). */
export function drawnLength(scale: number, g: number): number {
  return displayLength(scale * g);
}

/** Factor from the adult layout's coordinates (plan metres) to drawn metres for a juvenile of length fraction `g`. */
export function drawnFactor(scale: number, g: number): number {
  return displayLength(scale * g) / Math.max(scale, 0.01);
}
