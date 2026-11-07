import { describe, expect, it } from 'vitest';
import { formatStat, formatValue } from './format';

describe('formatStat', () => {
  it('shows a trace of oxygen (0 < v ≤ 0.01 %) as "0% (trace)"', () => {
    expect(formatStat('oxygen', 0.005, '%')).toBe('0% (trace)');
    expect(formatStat('oxygen', 0.01, '%')).toBe('0% (trace)');
  });
  it('leaves real oxygen, zero and other stats alone', () => {
    expect(formatStat('oxygen', 0, '%')).toBe('0%');
    expect(formatStat('oxygen', 0.02, '%')).toBe(formatValue(0.02, '%'));
    expect(formatStat('oxygen', 21, '%')).toBe('21.0%');
    expect(formatStat('co2', 0.005, '%')).toBe(formatValue(0.005, '%'));
  });
});
