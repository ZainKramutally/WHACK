// Which seed a run uses. This is the ONE place randomness is allowed: the sim, terrain, founders and spores are all
// deterministic functions of the seed picked here. ?seed=N pins a seed, ?demo uses the world's rehearsed demoSeed,
// and otherwise every load gets a fresh random one.

/** Readable seeds: 1..999999, plenty of variety and short enough to share. */
export const SEED_MAX = 999999;

export function randomSeed(random: () => number = defaultRandom): number {
  return 1 + Math.floor(random() * SEED_MAX);
}

function defaultRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

export function pickSeed(search: string, demoSeed: number, random?: () => number): { seed: number; source: 'url' | 'demo' | 'random' } {
  const q = new URLSearchParams(search);
  const raw = q.get('seed');
  if (raw !== null && /^\d+$/.test(raw.trim())) {
    const n = Number(raw);
    if (Number.isSafeInteger(n) && n <= 0xffffffff) return { seed: n, source: 'url' };
  }
  if (q.has('demo')) return { seed: demoSeed, source: 'demo' };
  return { seed: randomSeed(random), source: 'random' };
}

/** A link that replays this run. */
export function replayUrl(base: string, worldId: string, seed: number): string {
  const u = new URL(base);
  u.search = '';
  u.hash = '';
  u.searchParams.set('world', worldId);
  u.searchParams.set('seed', String(seed));
  return u.toString();
}
