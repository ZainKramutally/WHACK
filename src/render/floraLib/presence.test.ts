import { describe, expect, it } from 'vitest';
import { Presence, plantKey } from './presence';

const place = (p: Presence, keys: number[], die: (o: number, s: number) => boolean = () => true) => {
  keys.forEach((k, i) => { p.nextKeys[i] = k; });
  p.sync(keys.length, () => true, die);
};

describe('Presence', () => {
  it('grows a new key from 0 to 1', () => {
    const p = new Presence(8, 4, 2, 1);
    place(p, [1]);
    expect(p.growScale(0)).toBe(0);
    p.tick(1);
    expect(p.growScale(0)).toBeGreaterThan(0.3);
    p.tick(1.5);
    expect(p.growScale(0)).toBe(1);
    expect(p.active).toBe(0);
  });
  it('does not restart growth for a key that stays', () => {
    const p = new Presence(8, 4, 2, 1);
    place(p, [1]); p.tick(3);
    place(p, [2, 1]); // 1 moved to index 1
    expect(p.growScale(1)).toBe(1);
    expect(p.growScale(0)).toBe(0);
  });
  it('shrinks a removed key to 0 then frees its slot', () => {
    const p = new Presence(8, 4, 2, 1);
    place(p, [1]); p.tick(3);
    const took: number[] = [];
    place(p, [], (o, s) => { took.push(o, s); return true; });
    expect(took).toEqual([0, 0]);
    expect(p.dieScale(0)).toBe(1);
    p.tick(0.5);
    expect(p.dieScale(0)).toBeLessThan(1);
    p.tick(0.6);
    expect(p.dAge[0]).toBe(-1);
    expect(p.active).toBe(0);
  });
  it('caps the dying pool and drops the overflow', () => {
    const p = new Presence(8, 2, 2, 1);
    place(p, [1, 2, 3, 4], () => true);
    let taken = 0;
    place(p, [], () => { taken++; return true; });
    expect(taken).toBe(2);
  });
  it('keys differ by archetype so a species swap is a die plus a grow', () => {
    expect(plantKey(5, 1, 2, 0)).not.toBe(plantKey(5, 1, 3, 0));
  });
});
