import { describe, expect, it } from 'vitest';
import { createLru } from './lruCache';

describe('createLru', () => {
  it('evicts the least recently used entry', () => {
    const ev: string[] = [];
    const c = createLru<number>(2, (_v, k) => ev.push(k));
    c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3);
    expect(ev).toEqual(['b']);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
    expect(c.size).toBe(2);
  });
});
