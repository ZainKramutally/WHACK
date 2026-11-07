// Recursive planar branching coral-fan generator (silicon R1: straight segments, angled forks). Pure.
import type { Rng } from './placement';

export interface FanSeg { x0: number; y0: number; x1: number; y1: number; w0: number; w1: number; level: number }

export interface FanOpts {
  levels: number;        // 4..6
  maxSegments?: number;  // hard cap (breadth-first)
  spread?: number;       // total fork angle (rad)
  baseLen?: number;
  baseWidth?: number;
  lenDecay?: number;
  prune?: number;        // chance a non-first child is dropped (levels >= 2)
}

/** Grow a fan in the x-y plane from the origin. The first child of every fork is never pruned,
 * so the segment count is always in [levels, maxSegments] and the deepest level is levels-1. */
export function growFan(rng: Rng, o: FanOpts): FanSeg[] {
  const levels = Math.max(1, Math.round(o.levels));
  const cap = o.maxSegments ?? 200;
  const spread = o.spread ?? 1.15;
  const decay = o.lenDecay ?? 0.78;
  const prune = o.prune ?? 0.12;
  const out: FanSeg[] = [];
  type Tip = { x: number; y: number; ang: number; len: number; w: number; level: number };
  let frontier: Tip[] = [{ x: 0, y: 0, ang: Math.PI / 2, len: o.baseLen ?? 1, w: o.baseWidth ?? 0.09, level: 0 }];
  while (frontier.length && out.length < cap) {
    const next: Tip[] = [];
    for (const t of frontier) {
      if (out.length >= cap) break;
      const x1 = t.x + Math.cos(t.ang) * t.len, y1 = t.y + Math.sin(t.ang) * t.len;
      const w1 = t.w * 0.62;
      out.push({ x0: t.x, y0: t.y, x1, y1, w0: t.w, w1, level: t.level });
      if (t.level >= levels - 1) continue;
      const n = rng() < 0.45 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        if (k > 0 && t.level >= 1 && rng() < prune) continue;
        const f = k / (n - 1);
        const ang = t.ang + (f - 0.5) * spread + (rng() - 0.5) * 0.14;
        next.push({ x: x1, y: y1, ang, len: t.len * decay * (0.85 + rng() * 0.3), w: w1, level: t.level + 1 });
      }
    }
    frontier = next;
  }
  return out;
}
