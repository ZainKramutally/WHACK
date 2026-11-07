// Seeded deterministic streams: makeRng(seed)('name')() → [0, 1).
// Same algorithm as mockups/worlds/src/core/rng.ts, so both projects agree on seeds.
export type Rng = () => number;

const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export function makeRng(seed: number): (stream: string) => Rng {
  return (stream: string) => {
    let a = (hashStr(stream) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
}

/** Standard normal sample (Box–Muller), drawing two values from rng. */
export function gaussian(rng: Rng): number {
  const u1 = 1 - rng(); // (0, 1], so log never sees 0
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
