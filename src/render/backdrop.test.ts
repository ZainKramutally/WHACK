import { describe, expect, it } from 'vitest';
import { NO_CANOPY, backdropLayout, landCanopy, landMask, visibleGiants } from './backdrop';
import { FLORA_GRID } from './layout';
import { cellSubmerged, floraBin, formForBin } from './floraForm';
import { ROLE_BAND } from './floraLib';
import { makeStubVisualInputs } from './visualInputs';

const PATCH = 400;
const CELLS = FLORA_GRID * FLORA_GRID;
const outside = (x: number, z: number, foot: number) => Math.max(Math.abs(x), Math.abs(z)) - foot > PATCH / 2;
const STUB = makeStubVisualInputs();
/** The world's canopy form, as backdrop.ts builds it (plantHeight reads only its heat-band height scale). */
const formAt = (heatBand: number) => formForBin(floraBin(0, 1, { ...STUB, heatBand }));
const FORM = formAt(0.5);
const flat = () => 0;

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

  it('ranks the giants as a seeded permutation of k / N (the ring fills evenly)', () => {
    const g = backdropLayout('carbon', PATCH).giants;
    const ranks = g.map((x) => x.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(g.map((_, k) => k / g.length));
    expect(g.map((x) => x.rank)).not.toEqual(ranks); // not in ring (angle) order
  });
});

describe('backdrop giants follow the land canopy', () => {
  const l = backdropLayout('carbon', PATCH);
  const N = l.giants.length;
  const full = { share: 1, mean: 0.4 };

  it('draws no giants without land canopy, and only above the sea', () => {
    expect(visibleGiants(l, NO_CANOPY, FORM, flat, -5)).toEqual([]);
    expect(visibleGiants(l, { share: 0, mean: 0.6 }, FORM, flat, -5)).toEqual([]);
    expect(visibleGiants(l, full, FORM, flat, -5)).toHaveLength(N);
    expect(visibleGiants(l, full, FORM, flat, 5)).toEqual([]); // all feet under water
    const half = visibleGiants(l, full, FORM, (x) => (x > 0 ? 3 : -3), 0);
    expect(half.length).toBeGreaterThan(0);
    expect(half.every((g) => g.x > 0)).toBe(true);
  });

  it('stands about share × N giants', () => {
    for (const j of [0, 3, 10, 35]) expect(visibleGiants(l, { share: (j + 0.5) / N, mean: 0.4 }, FORM, flat, -5)).toHaveLength(j + 1);
  });

  it('grows count and every height monotonically with the share, never past the flora giant band', () => {
    let prev = new Map<string, number>();
    for (let s = 0; s <= 1 + 1e-9; s += 1 / 97) {
      const drawn = visibleGiants(l, { share: Math.min(1, s), mean: 0.4 }, FORM, flat, -5);
      expect(drawn.length).toBeGreaterThanOrEqual(prev.size);
      const now = new Map(drawn.map((g) => [`${g.x}|${g.z}`, g.h]));
      for (const [at, h] of prev) expect(now.get(at)).toBeGreaterThanOrEqual(h);
      for (const h of now.values()) { expect(h).toBeGreaterThan(0); expect(h).toBeLessThanOrEqual(ROLE_BAND.giant[1]); }
      prev = now;
    }
    expect(prev.size).toBe(N);
  });

  it('sizes giants like the flora: cold makes them taller, more canopy biomass makes them taller', () => {
    const tall = (heat: number, mean: number) => Math.max(...visibleGiants(l, { share: 1, mean }, formAt(heat), flat, -5).map((g) => g.h));
    expect(tall(0, 0.5)).toBeGreaterThan(tall(1, 0.5));
    expect(tall(0.5, 0.5)).toBeGreaterThan(tall(0.5, 0.2));
    expect(tall(0, 1)).toBeLessThanOrEqual(ROLE_BAND.giant[1]);
  });
});

describe('land canopy share', () => {
  const terrain = { rise: 1, progress: {}, height: (x: number) => x / 10, patchSize: PATCH };

  it('uses the flora land test (cellSubmerged) on every cell', () => {
    const mask = landMask({ terrain, seaLevel: 3 }, PATCH);
    let land = 0;
    for (let c = 0; c < CELLS; c++) {
      expect(mask[c]).toBe(cellSubmerged(c, { terrain, seaLevel: 3 }) ? 0 : 1);
      land += mask[c];
    }
    expect(land).toBeGreaterThan(0);
    expect(land).toBeLessThan(CELLS);
  });

  it('is the share of land cells whose canopy can hold a giant, and their mean canopy', () => {
    const land = new Uint8Array(CELLS);
    const flora = new Float32Array(CELLS * 2);
    for (let c = 0; c < CELLS; c++) {
      land[c] = c < CELLS / 2 ? 1 : 0;
      // land: every 4th cell has giant canopy (0.3), the rest too little (0.1); under the sea: lots (ignored)
      flora[c * 2] = 0.5;
      flora[c * 2 + 1] = land[c] ? (c % 4 === 0 ? 0.3 : 0.1) : 0.9;
    }
    const got = landCanopy(flora, land);
    expect(got.share).toBeCloseTo(0.25, 6);
    expect(got.mean).toBeCloseTo(0.3, 6);
    expect(landCanopy(new Float32Array(CELLS * 2), land)).toEqual(NO_CANOPY);
    expect(landCanopy(flora, new Uint8Array(CELLS))).toEqual(NO_CANOPY); // no land at all
  });
});
