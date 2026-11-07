import { describe, expect, it } from 'vitest';
import { backdropLayout, visibleGiants } from './backdrop';

const PATCH = 400;
const outside = (x: number, z: number, foot: number) => Math.max(Math.abs(x), Math.abs(z)) - foot > PATCH / 2;

describe('backdrop placement', () => {
  it.each(['carbon', 'silicon'] as const)('is seeded and deterministic (%s)', (k) => {
    expect(backdropLayout(k, PATCH)).toEqual(backdropLayout(k, PATCH));
  });

  it('differs between the two chemistries', () => {
    expect(backdropLayout('carbon', PATCH).mesas[0]).not.toEqual(backdropLayout('silicon', PATCH).mesas[0]);
  });

  it.each(['carbon', 'silicon'] as const)('keeps every footprint outside the patch (%s)', (k) => {
    const l = backdropLayout(k, PATCH);
    expect(l.mesas.length).toBeGreaterThan(10);
    for (const m of l.mesas) expect(outside(m.x, m.z, m.r * 2.4)).toBe(true);
    for (const g of l.giants) expect(outside(g.x, g.z, 0)).toBe(true);
    for (const r of l.ridges) expect(r.R - r.depth).toBeGreaterThan((PATCH / 2) * Math.SQRT2);
  });

  it('draws giants only when life is on land, and only above the sea', () => {
    const l = backdropLayout('carbon', PATCH);
    const flat = () => 0;
    expect(visibleGiants(l, false, flat, -5)).toEqual([]);
    expect(visibleGiants(l, true, flat, -5)).toHaveLength(l.giants.length);
    expect(visibleGiants(l, true, flat, 5)).toEqual([]);           // all feet under water
    const half = visibleGiants(l, true, (x) => (x > 0 ? 3 : -3), 0);
    expect(half.every((g) => g.x > 0)).toBe(true);
  });
});
