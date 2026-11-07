// Dial tween: current dials → target dials over ~3s (power1.inOut). The caller re-derives each frame.
import type { Dials } from '../contracts';
import { normalizeRecipe, normalizeSea } from '../derive';

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)); // power1.inOut
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const cloneDials = (d: Dials): Dials => ({ ...d, recipe: { ...d.recipe }, sea: { ...d.sea } });

export function lerpDials(a: Dials, b: Dials, t: number): Dials {
  return {
    recipe: { c: lerp(a.recipe.c, b.recipe.c, t), si: lerp(a.recipe.si, b.recipe.si, t), o: lerp(a.recipe.o, b.recipe.o, t) },
    sea: {
      water: lerp(a.sea.water, b.sea.water, t), ammonia: lerp(a.sea.ammonia, b.sea.ammonia, t),
      methane: lerp(a.sea.methane, b.sea.methane, t), acid: lerp(a.sea.acid, b.sea.acid, t),
    },
    heat: lerp(a.heat, b.heat, t), light: lerp(a.light, b.light, t), age: lerp(a.age, b.age, t),
    seed: b.seed,
  };
}

export class Morph {
  current: Dials;
  target: Dials;
  private from: Dials;
  private t = 1;
  private dur = 3;
  /** true while a tween is running (re-derive needed) */
  dirty = true;

  constructor(d: Dials) { this.current = cloneDials(d); this.target = cloneDials(d); this.from = cloneDials(d); }

  /** Snap to dials (used by Travel: the new place starts at its own dials). */
  reset(d: Dials) { this.current = cloneDials(d); this.target = cloneDials(d); this.from = cloneDials(d); this.t = 1; this.dirty = true; }

  setTarget(d: Dials, dur = 3) {
    this.from = cloneDials(this.current);
    this.target = { ...cloneDials(d), recipe: normalizeRecipe(d.recipe), sea: normalizeSea(d.sea) };
    this.t = 0; this.dur = dur; this.dirty = true;
  }

  update(dt: number): boolean {
    if (this.t >= 1) { const was = this.dirty; this.dirty = false; return was; }
    this.t = Math.min(1, this.t + dt / this.dur);
    this.current = lerpDials(this.from, this.target, ease(this.t));
    this.dirty = true;
    return true;
  }
}
