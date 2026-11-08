import { describe, expect, it } from 'vitest';
import { chooseHit } from './pickRule';

describe('chooseHit', () => {
  it('a creature behind a plant wins', () => expect(chooseHit(40, 10, 60, 60)).toBe('organism'));
  it('a creature behind a hill loses to the plant or ground in front', () => {
    expect(chooseHit(80, 10, 30, 30)).toBe('plant');
    expect(chooseHit(80, null, 30, 30)).toBe('world');
  });
  it('a creature beyond the sea surface wins when the seafloor is not in front of it', () => expect(chooseHit(50, null, 20, 70)).toBe('organism'));
  it('a creature sunk a little into a bump still wins', () => expect(chooseHit(31, null, 30, 30)).toBe('organism'));
  it('no creature: nearest plant, else the world', () => {
    expect(chooseHit(null, 10, 30, 30)).toBe('plant');
    expect(chooseHit(null, 40, 30, 30)).toBe('world');
  });
});
