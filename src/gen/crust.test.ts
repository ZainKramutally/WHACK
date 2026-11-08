import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { CELLS, GRID } from '../sim/grid';
import { cellSupply, crustMap, mineralAt, rust } from './crust';
import { createTerrain, sampleHeights } from './terrain';

describe.each([carbon, silicon])('crust %s', (w) => {
  const seed = w.demoSeed;
  const map = crustMap(w, seed);
  const minerals = w.terrain.crust!.minerals;

  it('is deterministic and varies with seed', () => {
    expect(Array.from(crustMap(w, seed).mineral)).toEqual(Array.from(map.mineral));
    expect(Array.from(crustMap(w, seed + 1).mineral)).not.toEqual(Array.from(map.mineral));
  });

  it('shares sum to 1 and lie in bounds', () => {
    expect(map.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    minerals.forEach((m, i) => {
      expect(map.shares[i]).toBeGreaterThanOrEqual(m.share[0]);
      expect(map.shares[i]).toBeLessThanOrEqual(m.share[1]);
    });
  });

  it('low-elevation minerals sit on lower ground', () => {
    const heights = sampleHeights(createTerrain(w.terrain, seed), { rise: 1, progress: {}, heatSolvent: 0.5 });
    const mean = (mi: number) => { let s = 0, n = 0; for (let i = 0; i < CELLS; i++) if (map.mineral[i] === mi) { s += heights[i]; n++; } return s / n; };
    const order = minerals.map((m, i) => i).sort((a, b) => minerals[a].elevation - minerals[b].elevation);
    expect(mean(order[0])).toBeLessThan(mean(order[order.length - 1]));
  });

  it('is patchy', () => {
    let same = 0, total = 0;
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID - 1; c++) { total++; if (map.mineral[r * GRID + c] === map.mineral[r * GRID + c + 1]) same++; }
    expect(same / total).toBeGreaterThan(0.7);
  });

  it('supply keeps the patch mean at base; zero stays zero; ice gets none', () => {
    const s = cellSupply(w, map);
    const led = w.life.ledger;
    const base = { c: led.supplyC ?? 0, si: led.supplySi ?? 0, o: led.supplyO ?? 0 };
    for (const el of ['c', 'si', 'o'] as const) {
      const mean = s[el].reduce((a, b) => a + b, 0) / CELLS;
      expect(mean).toBeCloseTo(base[el], 8);
      if (base[el] === 0) expect(s[el].every((v) => v === 0)).toBe(true);
    }
    minerals.forEach((m, mi) => {
      if (m.supply.si === 0 && m.supply.c === 0) for (let i = 0; i < CELLS; i++) if (map.mineral[i] === mi) expect(s.si[i] + s.c[i] + s.o[i]).toBe(0);
    });
  });

  it('mineralAt agrees with the map', () => {
    const S = w.terrain.patchSize;
    for (const [r, c] of [[0, 0], [10, 50], [63, 63], [32, 7]]) {
      const x = ((c + 0.5) / GRID - 0.5) * S, z = ((r + 0.5) / GRID - 0.5) * S;
      expect(mineralAt(w, map, x, z)).toBe(minerals[map.mineral[r * GRID + c]]);
    }
  });

  it('rust ramps 0..1', () => {
    expect(rust(w, 0)).toBe(0);
    expect(rust(w, w.terrain.crust!.rustOxygen)).toBe(1);
    expect(rust(w, 100)).toBe(1);
  });
});
