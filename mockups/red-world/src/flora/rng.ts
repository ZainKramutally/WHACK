// Seeded RNG for flora. mulberry32: tiny, fast, deterministic across JS engines.
export type Rng = {
  (): number;                                // [0, 1)
  range(a: number, b: number): number;       // [a, b)
  int(a: number, b: number): number;         // integer in [a, b]
  pick<T>(xs: readonly T[]): T;
  sign(): number;                            // -1 | 1
};

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => a + Math.floor(next() * (b - a + 1));
  next.pick = (xs) => xs[Math.floor(next() * xs.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

/** Mix a seed with small integers into a new 32-bit seed (species, variant). */
export function subSeed(seed: number, ...ks: number[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const k of ks) {
    h = Math.imul(h ^ (k + 0x7f4a7c15), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return h;
}
