import { withCrustChoice } from './crust';
import { describe, expect, it } from 'vitest';
import { createTerrain, crustScore, crustWeights, heightCore, kit32, kit64, warpBase, sampleHeights, seaLevelForCover, seaLevelFromHeights, spawnPoint, type TerrainState, type Terrain } from './terrain';
import { carbonLike, siliconLike } from './terrainFixtures';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';

const full = (hs = 0.5): TerrainState => ({ rise: 1, heatSolvent: hs, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 } });
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
    for (const cfg of [carbonLike, siliconLike, carbon.terrain, silicon.terrain]) {
      const t = createTerrain(cfg, 31);
      const P = t.params;
      const errs: number[] = [];
      for (const [x, z] of grid(40, 400)) {
        // the GPU mesh leaves the M7 pillar term out (drawn as prisms), so it mirrors the CPU height with M7 progress 0
        const a = t.height(x, z, { ...full(0.5), progress: { ...full().progress, M7: 0 } });
        const b = heightCore(P, 1, 0.5, 1, 1, 1, 1, 1, Math.fround(x), Math.fround(z), kit32, 0, 1, 1);
        errs.push(Math.abs(a - b));
      }
      errs.sort((p, q) => p - q);
      expect(errs[errs.length - 1]).toBeLessThan(0.05);
    }
  });

  it('crust weights: f32 emulation agrees with f64, sum to 1, and pick the same mineral', () => {
    for (const w of [carbon, silicon]) {
      const t = createTerrain(w.terrain, w.demoSeed);
      const P = t.params;
      let worst = 0;
      for (const [x, z] of grid(30, 400)) {
        const a = t.crustWeights(x, z);
        expect(a.reduce((p, q) => p + q, 0)).toBeCloseTo(1, 9);
        const fx = Math.fround(x), fz = Math.fround(z);
        const w32 = crustWeights(P, crustScore(P, warpBase(P, fx, fz, kit32).bn, fx, fz, kit32), kit32);
        const w64 = crustWeights(P, crustScore(P, warpBase(P, x, z, kit64).bn, x, z, kit64), kit64);
        w64.forEach((v, j) => { worst = Math.max(worst, Math.abs(v - w32[j])); });
      }
      expect(worst).toBeLessThan(0.05);
    }
  });

  it.each([['carbon', carbon, ['M4', 'M5', 'M7', 'M8']], ['silicon', withCrustChoice(silicon, 'ironstone'), ['M4', 'M5']], ['silicon', withCrustChoice(silicon, 'nitride'), ['M9']]] as const)('%s landform machines: 0 at progress 0, 0 where their minerals are absent, something elsewhere', (_n, w, ids) => {
    const t = createTerrain(w.terrain, w.demoSeed);
    const minerals = w.terrain.crust.minerals.map((m) => m.id);
    for (const id of ids) {
      const gate = w.terrain.machines.find((m) => m.id === id)!.minerals!.map((m) => minerals.indexOf(m));
      const off: TerrainState = { ...full(), progress: { ...full().progress, [id]: 0 } };
      let moved = 0;
      for (const [x, z] of grid(80, 400)) {
        const weight = t.crustWeights(x, z).reduce((a, v, j) => a + (gate.includes(j) ? v : 0), 0);
        const d = Math.abs(t.height(x, z, full()) - t.height(x, z, off));
        // a pillar is flat across its hex at the cell-centre ground, which includes every other machine at the centre, so inside a pillar only M7's own absence check is pointwise
        const inPillar = id !== 'M7' && t.height(x, z, full()) !== t.height(x, z, { ...full(), progress: { ...full().progress, M7: 0 } });
        if (weight < 1e-9 && !inPillar) expect(d).toBe(0);
        if (d > 0.01) moved++;
      }
      expect(moved, id).toBeGreaterThan(20);
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

describe('real world configs', () => {
  const state = (rise = 1): TerrainState => ({ rise, heatSolvent: 0.5, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 } });
  it.each([['carbon', carbon], ['silicon', silicon]] as const)('%s demo seed: builds, hits default sea cover, finds a shore', (_n, w) => {
    const t = createTerrain(w.terrain, w.demoSeed);
    const [lo, hi] = w.targets.seaCover;
    const cover = (lo + hi) / 200;
    const ref = sampleHeights(t, state(), 200);
    for (const c of [cover, 0.3, 0.8]) {
      const lvl = seaLevelForCover(t, state(), c);
      expect(Math.abs(ref.filter((h) => h < lvl).length / ref.length - c)).toBeLessThan(0.01);
    }
    const lvl = seaLevelForCover(t, state(), cover);
    const sp = spawnPoint(t, state(), lvl);
    expect(sp.shoreFound).toBe(true);
    expect(sp.height).toBeGreaterThan(lvl);
    expect(distToShore(t, state(), lvl, sp.x, sp.z)).toBeLessThanOrEqual(w.terrain.spawn.shoreDistance);
  });
});

describe('real world configs across seeds', () => {
  const state: TerrainState = { rise: 1, heatSolvent: 0.5, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 } };
  // 10 spread-out seeds per world (the integration's ?seed=N picks arbitrary ones)
  const seeds = [1, 2, 3, 7, 42, 99, 314, 1234, 31337, 987654];
  it.each([['carbon', carbon], ['silicon', silicon]] as const)('%s: spawnPoint finds a shore and a reachable sea on every seed', (_n, w) => {
    const [lo, hi] = w.targets.seaCover;
    for (const seed of seeds) {
      const t = createTerrain(w.terrain, seed);
      for (const cover of [(lo + hi) / 200, 0.4]) {
        const lvl = seaLevelForCover(t, state, cover);
        const sp = spawnPoint(t, state, lvl);
        expect(sp.shoreFound, `seed ${seed} cover ${cover}`).toBe(true);
        expect(sp.height).toBeGreaterThan(lvl);
        expect(distToShore(t, state, lvl, sp.x, sp.z)).toBeLessThanOrEqual(w.terrain.spawn.shoreDistance);
        // the sea is reachable: walking from the spawn towards the sea along the ramp axis, every 1 m step is gentle (< 40°)
        const R = t.params.ramp;
        let prev = sp.height, reached = false;
        for (let d = 1; d < 4 * w.terrain.spawn.shoreDistance && !reached; d++) {
          const h = t.height(sp.x - R.ux * d, sp.z - R.uz * d, state);
          expect(Math.abs(h - prev), `seed ${seed} step ${d}`).toBeLessThan(0.84);
          reached = h < lvl;
          prev = h;
        }
        expect(reached, `seed ${seed}`).toBe(true);
      }
    }
  });
  it('silicon: relics stand near the spawn, ahead of the default camera (it looks down -z), on every seed', () => {
    for (const seed of seeds) {
      const t = createTerrain(silicon.terrain, seed);
      const lvl = seaLevelForCover(t, state, 0.45);
      const sp = spawnPoint(t, state, lvl);
      const near = t.relics.filter((r) => Math.hypot(r.position[0] - sp.x, r.position[1] - sp.z) < 140);
      expect(near.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      const ahead = near.filter((r) => { const dx = r.position[0] - sp.x, dz = r.position[1] - sp.z; return dz < 0 && Math.abs(dx) < -dz * Math.tan(40 * Math.PI / 180); });
      expect(ahead.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('skipping unlisted machines is bit-exact against evaluating all eight', () => {
    const ids = ['M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'] as const;
    const states = [0, 0.3, 1].flatMap((rise) => [0.2, 0.5, 0.9].map((hs) => ({ rise, hs, p: rise })));
    for (const [name, world] of [['carbon', carbon], ['silicon', silicon]] as const) {
      const t = createTerrain(world.terrain, world.demoSeed);
      const all = { ...t.params, active: Object.fromEntries(ids.map((id) => [id, true])) as typeof t.params.active };
      expect(ids.filter((id) => !t.params.active[id]), name).toEqual(name === 'carbon' ? ['M2'] : ['M3', 'M6']);
      for (const { rise, hs, p } of states) for (const [x, z] of grid(9, 400)) {
        // progress is nonzero for every machine, including the unlisted ones, to prove they still contribute exactly 0
        const a = heightCore(t.params, rise, hs, p, p, p, p, p, x, z, kit64, p, p, p);
        const b = heightCore(all, rise, hs, p, p, p, p, p, x, z, kit64, p, p, p);
        expect(Object.is(a, b) || (a === 0 && b === 0), `${name} ${x},${z} rise ${rise}`).toBe(true);
      }
    }
  });
});

describe('canyons and strata are ironstone-only', () => {
  it('silicon with no ironstone has no M4 or M5 relief at all', () => {
    const t = createTerrain(silicon.terrain, silicon.demoSeed);
    const none = (id: 'M4' | 'M5'): TerrainState => ({ ...full(), progress: { ...full().progress, [id]: 0 } });
    for (const id of ['M4', 'M5'] as const) for (const [x, z] of grid(40, 400)) expect(t.height(x, z, full())).toBe(t.height(x, z, none(id)));
  });
});
