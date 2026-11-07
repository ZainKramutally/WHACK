import { describe, expect, it } from 'vitest';
import { createTerrain, heightCore, kit32, sampleHeights, seaLevelForCover, seaLevelFromHeights, spawnPoint, type TerrainState, type Terrain } from './terrain';
import { carbonLike, siliconLike } from './terrainFixtures';

const full = (hs = 0.5): TerrainState => ({ rise: 1, heatSolvent: hs, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1 } });
const grid = (n: number, S: number) => Array.from({ length: n * n }, (_, i) => [((i % n) / (n - 1) - 0.5) * S, ((Math.floor(i / n)) / (n - 1) - 0.5) * S] as const);

describe('terrain', () => {
  it('rise 0 is flat', () => {
    for (const cfg of [carbonLike, siliconLike]) {
      const t = createTerrain(cfg, 7);
      const s: TerrainState = { ...full(), rise: 0 };
      for (const [x, z] of grid(15, 400)) expect(Math.abs(t.height(x, z, s))).toBe(0);
    }
  });

  it('is deterministic per seed and differs between seeds', () => {
    const a = createTerrain(carbonLike, 42), b = createTerrain(carbonLike, 42), c = createTerrain(carbonLike, 43);
    let diff = 0;
    for (const [x, z] of grid(12, 400)) {
      expect(a.height(x, z, full())).toBe(b.height(x, z, full()));
      diff += Math.abs(a.height(x, z, full()) - c.height(x, z, full()));
    }
    expect(diff).toBeGreaterThan(10);
  });

  it('seaLevelForCover hits the requested cover within 1%', () => {
    for (const cfg of [carbonLike, siliconLike]) {
      const t = createTerrain(cfg, 1234);
      const ref = sampleHeights(t, full(), 200);
      for (const cover of [0.2, 0.5, 0.71, 0.9]) {
        const lvl = seaLevelForCover(t, full(), cover);
        const frac = ref.filter((h) => h < lvl).length / ref.length;
        expect(Math.abs(frac - cover)).toBeLessThan(0.01);
      }
    }
    expect(seaLevelFromHeights(new Float32Array([1, 2, 3, 4]), 0)).toBeLessThan(1);
  });

  it.each([['carbon-like', carbonLike, 0.71], ['silicon-like', siliconLike, 0.55]] as const)('spawn is on land within shoreDistance of the shore (%s)', (_n, cfg, cover) => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      const t = createTerrain(cfg, seed);
      for (const rise of [1, 0.6]) {
        const st: TerrainState = { ...full(), rise };
        const lvl = seaLevelForCover(t, st, cover);
        const sp = spawnPoint(t, st, lvl);
        expect(sp.shoreFound).toBe(true);
        expect(sp.height).toBeGreaterThan(lvl);
        expect(distToShore(t, st, lvl, sp.x, sp.z)).toBeLessThanOrEqual(cfg.spawn.shoreDistance);
      }
    }
  });

  it('M3 contributes 0 when heatSolvent is far from 0.5, and something near it', () => {
    const t = createTerrain(carbonLike, 5);
    const only3 = (hs: number): TerrainState => ({ rise: 1, heatSolvent: hs, progress: { M3: 1 } });
    const none = (hs: number): TerrainState => ({ rise: 1, heatSolvent: hs, progress: {} });
    let near = 0;
    for (const [x, z] of grid(20, 400)) {
      expect(t.height(x, z, only3(0.1))).toBe(t.height(x, z, none(0.1)));
      expect(t.height(x, z, only3(0.95))).toBe(t.height(x, z, none(0.95)));
      near += Math.abs(t.height(x, z, only3(0.5)) - t.height(x, z, none(0.5)));
    }
    expect(near).toBeGreaterThan(5);
  });

  it('M4 carves deeper with progress; dry heat steepens (narrower) walls', () => {
    const t = createTerrain(carbonLike, 5);
    const st = (p: number, hs: number): TerrainState => ({ rise: 1, heatSolvent: hs, progress: { M4: p } });
    const z = t.params.ramp.cz > 0 ? -150 : 150;   // outside the shore-ramp disc
    let maxCut = 0;
    for (let x = -200; x <= 200; x += 1) maxCut = Math.max(maxCut, t.height(x, z, st(0, 0.5)) - t.height(x, z, st(1, 0.5)));
    expect(maxCut).toBeGreaterThan(15);
    expect(maxCut).toBeLessThanOrEqual(18.001);
    const width = (hs: number) => { let n = 0; for (let x = -200; x <= 200; x += 1) if (t.height(x, z, st(0, hs)) - t.height(x, z, st(1, hs)) > 4) n++; return n; };
    expect(width(1)).toBeLessThan(width(0.2));
  });

  it('relics raise the ground at their positions (silicon) and are listed for the renderer', () => {
    const t = createTerrain(siliconLike, 8);
    expect(t.relics.filter((r) => r.kind === 'iceSpire')).toHaveLength(6);
    expect(t.relics.filter((r) => r.kind === 'iceArch')).toHaveLength(3);
    const noRelics = createTerrain({ ...siliconLike, relics: [] }, 8);
    const r = t.relics[0];
    const [x, z] = r.position;
    expect(t.height(x, z, full()) - noRelics.height(x, z, full())).toBeGreaterThan(r.params.height * 0.9);
    expect(createTerrain(carbonLike, 8).relics).toEqual([]);
  });

  it('throws on a missing config key', () => {
    expect(() => createTerrain({ ...carbonLike, base: { ...carbonLike.base, gain: undefined as unknown as number } }, 1)).toThrow(/base\.gain/);
  });

  it('f32 emulation of the GPU maths agrees with the f64 sampler', () => {
    for (const cfg of [carbonLike, siliconLike]) {
      const t = createTerrain(cfg, 31);
      const P = t.params;
      let worst = 0;
      for (const [x, z] of grid(40, 400)) {
        const a = t.height(x, z, full(0.5));
        const b = heightCore(P, 1, 0.5, 1, 1, 1, 1, 1, Math.fround(x), Math.fround(z), kit32);
        worst = Math.max(worst, Math.abs(a - b));
      }
      expect(worst).toBeLessThan(0.05);
    }
  });
});

/** Distance from (x,z) to the nearest shoreline cell: a grid cell where height crosses sea level. */
function distToShore(t: Terrain, st: TerrainState, lvl: number, x: number, z: number): number {
  const step = 2, R = 120;
  let best = Infinity;
  for (let dx = -R; dx <= R; dx += step) for (let dz = -R; dz <= R; dz += step) {
    const d = Math.hypot(dx, dz);
    if (d >= best) continue;
    const here = t.height(x + dx, z + dz, st) > lvl;
    const next = t.height(x + dx + step, z + dz, st) > lvl;
    if (here !== next) best = d;
  }
  return best;
}
