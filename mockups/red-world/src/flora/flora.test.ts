import { describe, expect, it } from 'vitest';
import type { PaletteKey, SpeciesId } from '../contracts';
import { buildFloraLibrary } from './index';
import { LINEAR } from './mesh';

const lib = buildFloraLibrary(1234);
const ALL: SpeciesId[] = ['parasolTitan', 'coilSpire', 'lanternPods', 'weeper', 'ribFan', 'groundCover'];
const GLOW_KEYS: PaletteKey[] = ['glow', 'glowDeep'];
const SIZE: Record<SpeciesId, [number, number]> = {
  parasolTitan: [60, 180 * 1.06], coilSpire: [30, 120 * 1.06], lanternPods: [5, 25 * 1.07],
  weeper: [15, 60 * 1.06], ribFan: [10, 40 * 1.06], groundCover: [0.3, 3],
};
const keyOf = (c: ArrayLike<number>, i: number): PaletteKey | undefined =>
  (Object.keys(LINEAR) as PaletteKey[]).find((k) => LINEAR[k].every((x, q) => Math.abs(x - c[i * 3 + q]) < 1e-6));

describe('flora library', () => {
  it('has every species with 3-4 variants', () => {
    for (const s of ALL) {
      const v = lib.bySpecies(s);
      expect(v.length).toBeGreaterThanOrEqual(3);
      expect(v.length).toBeLessThanOrEqual(4);
      expect(v.map((a) => a.variant)).toEqual(v.map((_, i) => i));
    }
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = buildFloraLibrary(1234), c = buildFloraLibrary(99);
    a.archetypes.forEach((arch, i) => {
      const p0 = lib.archetypes[i].geometry.attributes.position.array;
      expect(Array.from(arch.geometry.attributes.position.array)).toEqual(Array.from(p0));
      expect(Array.from(arch.geometry.index.array)).toEqual(Array.from(lib.archetypes[i].geometry.index.array));
    });
    const p0 = lib.archetypes[0].geometry.attributes.position.array;
    expect(Array.from(c.archetypes[0].geometry.attributes.position.array)).not.toEqual(Array.from(p0));
  });

  it('meets triangle budgets', () => {
    const total = lib.archetypes.reduce((s, a) => s + a.triangles, 0);
    expect(total).toBeLessThanOrEqual(400_000);
    for (const a of lib.bySpecies('groundCover')) expect(a.triangles).toBeLessThanOrEqual(300);
    for (const a of lib.archetypes) expect(a.triangles).toBe(a.geometry.index.count / 3);
  });

  for (const arch of buildFloraLibrary(7).archetypes) {
    it(`attribute invariants: ${arch.species}#${arch.variant}`, () => {
      const g = arch.geometry;
      const pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array;
      const glow = g.attributes.aGlow.array, sway = g.attributes.aSway.array;
      const n = pos.length / 3;
      expect(nor.length).toBe(n * 3);
      expect(col.length).toBe(n * 3);
      expect(glow.length).toBe(n);
      expect(sway.length).toBe(n);
      let minY = Infinity, maxY = -Infinity, rad = 0;
      const bad: string[] = [];
      for (let i = 0; i < n; i++) {
        const y = pos[i * 3 + 1];
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        rad = Math.max(rad, Math.hypot(pos[i * 3], pos[i * 3 + 2]));
        if (!Number.isFinite(y)) bad.push(`${i}: non-finite position`);
        if (Math.abs(Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) - 1) > 1e-3) bad.push(`${i}: normal not unit`);
        const k = keyOf(col, i);
        if (!k) bad.push(`${i}: colour not in palette`);
        if (!(sway[i] >= 0 && sway[i] <= 1)) bad.push(`${i}: sway ${sway[i]} out of [0,1]`);
        // glow only on glow-coloured parts (pods/cores/pores); glow-coloured parts always glow
        if ((glow[i] > 0) !== GLOW_KEYS.includes(k!)) bad.push(`${i}: glow ${glow[i]} on ${k}`);
        // sway ~0 at the ground
        if (y < arch.height * 0.01 && sway[i] >= 0.1) bad.push(`${i}: sway ${sway[i]} at ground`);
        if (bad.length > 5) break;
      }
      expect(bad).toEqual([]);
      expect(Math.abs(minY)).toBeLessThan(1e-4);
      expect(arch.height).toBeCloseTo(maxY, 3);
      expect(arch.radius).toBeCloseTo(rad, 3);
      expect(arch.height).toBeGreaterThanOrEqual(SIZE[arch.species][0]);
      expect(arch.height).toBeLessThanOrEqual(SIZE[arch.species][1]);
      // accent stays a small share of surface area
      const idx = g.index.array;
      let area = 0, glowArea = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
        expect(Math.max(a, b, c)).toBeLessThan(n);
        const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
        const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
        const ar = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
        area += ar;
        if (glow[a] > 0 && glow[b] > 0 && glow[c] > 0) glowArea += ar;
      }
      expect(glowArea / area).toBeLessThan(0.08);
    });
  }
});
