import { describe, expect, it } from 'vitest';
import { fitInstanceData } from './generatePlan';

describe('fitInstanceData', () => {
  it('copies in place when it fits', () => {
    const dst = new Float32Array(8);
    const r = fitInstanceData(dst, new Float32Array([1, 2, 3, 4]));
    expect(r.reused).toBe(true);
    expect(r.array).toBe(dst);
    expect(Array.from(dst.slice(0, 4))).toEqual([1, 2, 3, 4]);
  });
  it('hands back the new buffer when it grows', () => {
    const src = new Float32Array(12);
    const r = fitInstanceData(new Float32Array(8), src);
    expect(r.reused).toBe(false);
    expect(r.array).toBe(src);
  });
});
