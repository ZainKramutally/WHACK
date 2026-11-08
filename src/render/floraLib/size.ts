// Plant size levels and emergent giants (docs/features/flora-traits.md §2d). Pure, no three.js.
// Each plant draws a seeded size class from a truncated power law, so every role holds many plants near its floor and a
// few large ones (size–frequency scaling, [sci] exponent, [art] truncation). The ground under it and the world's stats
// set the score g (−1..1): fertile ground, more nitrogen, wet ground, warmth and oxygen raise the cap of the power law,
// the mean a little, and the rate of emergent giants standing over groves and ground cover.
import type { FloraRole } from './index';
import type { CellEnv } from './traits';

/** Widened height bands (m) the size classes may reach; place.ts clamps every plant into [FLOOR × lo, hi]. */
export const SIZE_BAND: Record<FloraRole, [number, number]> = { ground: [0.2, 3], mid: [3, 20], giant: [14, 45] };
/** Seedlings: biomass grows plants from ~30% of their full height (plantHeight), so the floor is 30% of the band's. */
export const SIZE_FLOOR = 0.3;

/** Height exponent: N ∝ D^−2 per unit diameter and H ∝ D^(2/3) give N ∝ H^−2.5 per unit height, a Pareto of α 1.5. */
export const SIZE_ALPHA = 1.5;
/** Largest size class ÷ smallest at g = 0, and how far g moves it (× (1 ± SIZE_CAP_G)). */
const CAP0 = 2.5, SIZE_CAP_G = 0.3;
/** How far g moves the mean height directly (× (1 ± SIZE_MEAN_G)). */
const SIZE_MEAN_G = 0.06;

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
/** Mean of a truncated Pareto (α, on [1, R]). */
const paretoMean = (a: number, R: number) => (a / (a - 1)) * (1 - R ** (1 - a)) / (1 - R ** -a);
const MEAN0 = paretoMean(SIZE_ALPHA, CAP0);

/** Weights of the score's terms (each −1..1, wet 0..1). */
export const SIZE_WEIGHTS = { fertility: 0.45, nitrogen: 0.25, wet: 0.15, warm: 0.1, oxygen: 0.1 } as const;
/** The silicon world's default nitrogen (× Earth, silicon.ts startDefaults): its nitrogen term is relative to it. */
const SI_N0 = 30;

/** The size score g (−1..1) of a plant's environment (traits.ts plantEnv filled). */
export function sizeScore(e: CellEnv): number {
  const W = SIZE_WEIGHTS;
  const fert = clamp((e.supply - 1) / 0.4, -1, 1); // basalt 1.4 → +1, granite 0.6 and ironstone 0.5 → −1
  const n = clamp(Math.log(Math.max(1e-3, e.nitrogen) / (e.carbon ? 1 : SI_N0)) / Math.log(4), -1, 1); // ×4 → +1
  const warm = e.carbon ? clamp((e.temperature - 15) / 25, -1, 1) : clamp((e.heatBand - 0.5) / 0.35, -1, 1);
  const o2 = e.carbon ? clamp((e.oxygen - 21) / 10, -1, 1) : 0;
  return clamp(W.fertility * fert + W.nitrogen * n + W.wet * e.wet + W.warm * warm + W.oxygen * o2, -1, 1);
}

/** A plant's size multiplier from its seeded uniform `u` (0..1) and score `g`: a truncated Pareto on [1, R(g)],
 * divided by the g = 0 mean so a neutral world keeps today's mean. Monotone in u and in g. */
export function sizeClass(u: number, g: number): number {
  const R = CAP0 * (1 + SIZE_CAP_G * g);
  const s = (1 - clamp(u, 0, 0.999999) * (1 - R ** -SIZE_ALPHA)) ** (-1 / SIZE_ALPHA);
  return (s / MEAN0) * (1 + SIZE_MEAN_G * g);
}

/** Above KNEE × the band's top, heights ease towards it (never reach it), so the tallest plants stay distinct. */
const KNEE = 0.8;
/** Fit a height into the role's widened band: floored at SIZE_FLOOR × its bottom, eased under its top. Monotone. */
export function inBand(role: FloraRole, h: number): number {
  const [lo, hi] = SIZE_BAND[role], k = KNEE * hi;
  const v = h <= k ? h : k + (hi - k) * Math.tanh((h - k) / (hi - k));
  return Math.max(SIZE_FLOOR * lo, v);
}

/** Chance (per 5×5 superblock) of one emergent giant standing over its groves or ground cover. */
export function emergentChance(g: number): number {
  return clamp(0.2 * (1 + g), 0.04, 0.36);
}
