/** Tiny LRU keyed cache: get() refreshes recency, set() evicts the oldest beyond `max` (reporting evicted values). */
export function createLru<V>(max: number, onEvict?: (v: V, key: string) => void) {
  const m = new Map<string, V>();
  return {
    get(k: string): V | undefined {
      const v = m.get(k);
      if (v !== undefined) { m.delete(k); m.set(k, v); }
      return v;
    },
    set(k: string, v: V) {
      m.delete(k); m.set(k, v);
      while (m.size > max) { const [ok, ov] = m.entries().next().value as [string, V]; m.delete(ok); onEvict?.(ov, ok); }
    },
    get size() { return m.size; },
  };
}
