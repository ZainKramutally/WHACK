import { describe, expect, it } from 'vitest';
import { pickSeed, randomSeed, replayUrl, SEED_MAX } from './seed';

describe('pickSeed', () => {
  it('?seed=N pins the seed', () => {
    expect(pickSeed('?world=silicon&seed=48213', 7)).toEqual({ seed: 48213, source: 'url' });
  });
  it('?seed wins over ?demo', () => {
    expect(pickSeed('?demo&seed=5', 7)).toEqual({ seed: 5, source: 'url' });
  });
  it('?demo uses the rehearsed demo seed', () => {
    expect(pickSeed('?demo', 7)).toEqual({ seed: 7, source: 'demo' });
    expect(pickSeed('?world=carbon&demo=1', 12345)).toEqual({ seed: 12345, source: 'demo' });
  });
  it('defaults to a fresh random seed, different loads differ', () => {
    const a = pickSeed('', 7, () => 0.1);
    const b = pickSeed('', 7, () => 0.9);
    expect(a.source).toBe('random');
    expect(a.seed).not.toBe(b.seed);
  });
  it('ignores malformed or out-of-range seeds', () => {
    for (const bad of ['?seed=abc', '?seed=', '?seed=-3', '?seed=1.5', '?seed=99999999999']) {
      expect(pickSeed(bad, 7, () => 0.5).source).toBe('random');
    }
  });
});

describe('randomSeed', () => {
  it('stays inside 1..SEED_MAX', () => {
    expect(randomSeed(() => 0)).toBe(1);
    expect(randomSeed(() => 0.999999999)).toBe(SEED_MAX);
    for (let i = 0; i < 50; i++) { const s = randomSeed(); expect(s).toBeGreaterThanOrEqual(1); expect(s).toBeLessThanOrEqual(SEED_MAX); }
  });
});

describe('replayUrl', () => {
  it('keeps the origin and path, replaces the query', () => {
    expect(replayUrl('http://127.0.0.1:5173/play/?debug&seed=1#x', 'silicon', 48213)).toBe('http://127.0.0.1:5173/play/?world=silicon&seed=48213');
  });
});
