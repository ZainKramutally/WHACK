import { describe, expect, it } from 'vitest';
import { inLock } from './lockHit';

const r = { x: 100, y: 100, width: 40, height: 30 };
describe('inLock', () => {
  it('inside and on the margin', () => {
    expect(inLock(120, 110, r, 0)).toBe(true);
    expect(inLock(92, 100, r, 8)).toBe(true);
  });
  it('outside the margin', () => {
    expect(inLock(91, 100, r, 8)).toBe(false);
    expect(inLock(120, 200, r, 12)).toBe(false);
  });
});
