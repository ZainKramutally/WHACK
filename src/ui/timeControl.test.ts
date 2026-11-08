import { describe, expect, it } from 'vitest';
import { stepFactor } from './timeControl';

describe('stepFactor', () => {
  it('steps through the allowed factors and clamps at the ends', () => {
    expect(stepFactor(1, 1)).toBe(2);
    expect(stepFactor(8, 1)).toBe(16);
    expect(stepFactor(16, 1)).toBe(16);
    expect(stepFactor(4, -1)).toBe(2);
    expect(stepFactor(1, -1)).toBe(1);
  });
});
