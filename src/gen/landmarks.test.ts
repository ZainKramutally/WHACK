import { beforeAll, describe, expect, it } from 'vitest';
import { createTerrain, type TerrainState } from './terrain';
import { biomassAround, biomassFactors, createLandmarks, type LandmarkSet } from './landmarks';
import { bumpRadius, landmarkPieces, spireRings } from './landmarkMesh';
import { carbonLike, siliconLike } from './terrainFixtures';

const full: TerrainState = { rise: 1, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1 }, heatSolvent: 0.5 };
const none: TerrainState = { rise: 0, progress: {}, heatSolvent: 0.5 };

let si: LandmarkSet, ca: LandmarkSet;
let siTerrain: ReturnType<typeof createTerrain>;
beforeAll(() => {
  siTerrain = createTerrain(siliconLike, 7);
  si = createLandmarks(siTerrain, { chemistry: 'silicon', seaCover: 0.5 });
  ca = createLandmarks(createTerrain(carbonLike, 11), { chemistry: 'carbon', seaCover: 0.7 });
});

describe('placement', () => {
  it('silicon: every relic becomes an arch or spire, plus crystal clusters; all inside the patch', () => {
    const kinds = si.landmarks.map((l) => l.kind);
    expect(kinds.filter((k) => k === 'iceArch')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'iceSpire')).toHaveLength(6);
    expect(kinds).toContain('crystalCluster');
    for (const l of si.landmarks) expect(Math.max(Math.abs(l.x), Math.abs(l.z))).toBeLessThanOrEqual(0.5 * siTerrain.patchSize);
  });

  it('carbon: reefs, a hoodoo field, rock stacks and buttes, and no silicon structures', () => {
    const kinds = new Set(ca.landmarks.map((l) => l.kind));
    for (const k of ['reefPillar', 'hoodoo', 'rockStack', 'butte'] as const) expect(kinds.has(k)).toBe(true);
    expect(kinds.has('iceArch')).toBe(false);
    expect(kinds.has('crystalCluster')).toBe(false);
  });

  it('is deterministic for a seed', () => {
    const again = createLandmarks(createTerrain(carbonLike, 11), { chemistry: 'carbon', seaCover: 0.7 });
    expect(again.landmarks).toEqual(ca.landmarks);
  });

  it('keeps landmarks apart', () => {
    for (const set of [si, ca]) {
      const l = set.landmarks.filter((x) => x.kind !== 'hoodoo' && x.kind !== 'reefPillar');
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) expect(Math.hypot(l[i].x - l[j].x, l[i].z - l[j].z)).toBeGreaterThan(8);
    }
  });
});

describe('growth', () => {
  it('is 0 before the build and 1 at the end', () => {
    for (const l of ca.landmarks.filter((x) => x.kind !== 'hoodoo')) {
      expect(ca.growth(l, none)).toBe(0);
      expect(ca.growth(l, full)).toBe(1);
    }
  });

  it('hoodoos are tallest at the freezing point and still stand at any temperature', () => {
    const h = ca.landmarks.find((l) => l.kind === 'hoodoo')!;
    const at = (hs: number) => ca.growth(h, { ...full, heatSolvent: hs });
    const hw = createTerrain(carbonLike, 11).params.machines.M3!.halfWidth;
    expect(at(0.5)).toBe(1);
    expect(at(1)).toBeCloseTo(0.45, 5);
    expect(at(0.5 + hw / 2)).toBeGreaterThan(at(1));
  });

  it('relics ride the terrain rise whatever the machine progress', () => {
    const r = si.landmarks.find((l) => l.kind === 'iceSpire')!;
    expect(si.growth(r, { rise: 0.4, progress: {}, heatSolvent: 0.5 })).toBeCloseTo(0.4, 5);
  });

  it('biomass thickens reefs: more producers, taller and thicker, within bounds', () => {
    const a = biomassFactors(0), b = biomassFactors(0.45), c = biomassFactors(5);
    expect(a.tall).toBeLessThan(b.tall);
    expect(b.tall).toBeLessThan(c.tall);
    expect(c.tall).toBeCloseTo(1, 5);
    expect(a.thick).toBeLessThan(c.thick);
    const flora = new Float32Array(64 * 64 * 2).fill(0.5);
    expect(biomassAround(flora, 0, 0, 400)).toBeCloseTo(1, 5);
    expect(biomassAround(new Float32Array(0), 0, 0, 400)).toBe(0);
  });
});

describe('collision', () => {
  it('pushes a point out of a grown footprint and leaves clear points alone', () => {
    const l = ca.landmarks.find((x) => x.kind === 'butte')!;
    const c = ca.footprints(l)[0];
    const inside = ca.pushOut(c.x + c.r * 0.3, c.z, full);
    expect(inside).not.toBeNull();
    expect(Math.hypot(inside!.x - c.x, inside!.z - c.z)).toBeGreaterThanOrEqual(c.r);
    let clear: { x: number; z: number } | null = null;
    for (let x = -150; x <= 150 && !clear; x += 5) for (let z = -150; z <= 150 && !clear; z += 5) {
      if (ca.landmarks.every((m) => ca.footprints(m).every((f) => Math.hypot(x - f.x, z - f.z) > f.r + 3))) clear = { x, z };
    }
    expect(clear).not.toBeNull();
    expect(ca.pushOut(clear!.x, clear!.z, full)).toBeNull();
  });

  it('does not block before the structure has grown', () => {
    const l = ca.landmarks.find((x) => x.kind === 'butte')!;
    const c = ca.footprints(l)[0];
    expect(ca.pushOut(c.x, c.z, none)).toBeNull();
  });

  it('arches block at both piers but not between them', () => {
    const a = si.landmarks.find((l) => l.kind === 'iceArch')!;
    const [p0, p1] = si.footprints(a);
    expect(si.pushOut(p0.x, p0.z, full)).not.toBeNull();
    expect(si.pushOut(p1.x, p1.z, full)).not.toBeNull();
    expect(si.pushOut(a.x, a.z, full)).toBeNull();
  });
});

describe('meshes', () => {
  it('every kind builds finite, coloured triangle soup', () => {
    for (const set of [si, ca]) {
      const seen = new Set<string>();
      for (const l of set.landmarks) {
        if (seen.has(l.kind)) continue;
        seen.add(l.kind);
        const pieces = landmarkPieces(l);
        expect(pieces.length).toBe(l.kind === 'iceArch' ? 3 : 1);
        for (const p of pieces) {
          expect(p.mesh.positions.length % 9).toBe(0);
          expect(p.mesh.positions.length).toBeGreaterThan(0);
          expect(p.mesh.hex.length * 3).toBe(p.mesh.positions.length);
          expect(p.mesh.positions.every(Number.isFinite)).toBe(true);
          expect(p.mesh.top).toBeGreaterThan(0.5 * l.radius);
        }
      }
    }
  });

  it('a spire encloses the heightfield bump it stands on, at every ring height', () => {
    const H = 54, R = 6.5;
    for (const seed of [1, 2, 3, 99, 4242]) {
      const { rings, sides, jitter } = spireRings(H, R, seed);
      const inscribed = Math.cos(Math.PI / sides) * (1 - jitter);
      for (const g of rings) {
        if (g.y < 0 || g.y > H) continue;
        expect(g.r * inscribed).toBeGreaterThanOrEqual(bumpRadius(g.y, H, R) - 1e-6);
      }
    }
    expect(bumpRadius(0, H, R)).toBeCloseTo(R, 5);
    expect(bumpRadius(H, H, R)).toBeCloseTo(0, 5);
  });

  it('side faces point away from the axis (lathe) and away from the path (lintel tube)', () => {
    const outward = (positions: Float32Array, centre: (x: number, y: number, z: number) => [number, number, number]) => {
      let good = 0, total = 0;
      for (let i = 0; i < positions.length; i += 9) {
        const a = [positions[i], positions[i + 1], positions[i + 2]], b = [positions[i + 3], positions[i + 4], positions[i + 5]], c = [positions[i + 6], positions[i + 7], positions[i + 8]];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
        const o = centre(m[0], m[1], m[2]);
        const d = [m[0] - o[0], m[1] - o[1], m[2] - o[2]];
        const len = Math.hypot(n[0], n[1], n[2]);
        if (!(len > 1e-9) || Math.abs(n[1]) > 0.9 * len) continue;       // degenerate tip triangles, ledges and caps
        total++;
        if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] > 0) good++;
      }
      return good / total;
    };
    const spire = si.landmarks.find((l) => l.kind === 'iceSpire')!;
    expect(outward(landmarkPieces(spire)[0].mesh.positions, (_x, y) => [0, y, 0])).toBeGreaterThan(0.95);
    const arch = si.landmarks.find((l) => l.kind === 'iceArch')!;
    const lintel = landmarkPieces(arch)[2].mesh.positions;
    // centre of the tube at a vertex's x: average y of nearby vertices (the tube axis), z = 0
    const ys = new Map<number, number[]>();
    for (let i = 0; i < lintel.length; i += 3) { const k = Math.round(lintel[i] / 2); (ys.get(k) ?? ys.set(k, []).get(k)!).push(lintel[i + 1]); }
    const mean = (k: number) => { const a = ys.get(k) ?? [0]; return a.reduce((s, v) => s + v, 0) / a.length; };
    expect(outward(lintel, (x) => [x, mean(Math.round(x / 2)), 0])).toBeGreaterThan(0.9);
  });
});

// ---- geometry the owner's eye checks: assert it instead of screenshotting ----
import { silicon as siWorld } from '../worlds/silicon';
import { carbon as caWorld } from '../worlds/carbon';
import { seaLevelFromHeights, sampleHeights, spawnPoint } from './terrain';

const cases = [
  ['silicon', siWorld, [siWorld.demoSeed, 5, 77, 31337]],
  ['carbon', caWorld, [caWorld.demoSeed, 5, 77, 31337]],
] as const;

for (const [name, world, seeds] of cases) {
  describe(`${name} landmark geometry`, () => {
    for (const seed of seeds) {
      const terrain = createTerrain(world.terrain, seed);
      const cover = (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200;
      const opts = { chemistry: name, seaCover: cover } as const;
      const set = createLandmarks(terrain, opts);
      const sea = seaLevelFromHeights(sampleHeights(terrain, full, 64), cover);
      const spawn = spawnPoint(terrain, full, sea);

      it(`seed ${seed}: deterministic`, () => {
        expect(createLandmarks(createTerrain(world.terrain, seed), opts).landmarks).toEqual(set.landmarks);
      });

      it(`seed ${seed}: collision height covers the terrain inside each footprint`, () => {
        for (const l of set.landmarks) {
          for (const c of set.footprints(l)) {
            const base = set.plainHeight(c.x, c.z, full);
            for (let k = 0; k < 12; k++) {
              const a = (k / 12) * TWO;
              const h = set.plainHeight(c.x + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r, full);
              expect(h - base).toBeLessThanOrEqual(l.height);
            }
          }
        }
      });

      if (name === 'silicon') {
        it(`seed ${seed}: arch lintels join both piers at pier-top height`, () => {
          for (const l of set.landmarks.filter((x) => x.kind === 'iceArch')) {
            const [p0, p1] = landmarkPieces(l).filter((p) => p.kind === 'body');
            const lintel = landmarkPieces(l).find((p) => p.kind === 'lintel')!;
            expect(lintel.offset[1]).toBeCloseTo(0.9 * l.height, 5);
            expect(p0.offset[0]).toBeCloseTo(-l.span / 2, 5);
            expect(p1.offset[0]).toBeCloseTo(l.span / 2, 5);
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < lintel.mesh.positions.length; i += 3) { min = Math.min(min, lintel.mesh.positions[i]); max = Math.max(max, lintel.mesh.positions[i]); }
            expect(min).toBeLessThanOrEqual(l.radius * 0.5);            // starts inside pier 0
            expect(max).toBeGreaterThanOrEqual(l.span - l.radius * 0.5);  // reaches pier 1
          }
        });

        it(`seed ${seed}: >= 2 big landmarks (30-80 m) near spawn and ahead of the camera`, () => {
          const good = set.landmarks.filter((l) => {
            const tall = l.kind === 'iceArch' || l.kind === 'iceSpire' ? l.height : 0;
            const dx = l.x - spawn.x, dz = l.z - spawn.z;
            return tall >= 30 && tall <= 80 && Math.hypot(dx, dz) <= 150 && dz < 0;
          });
          expect(good.length).toBeGreaterThanOrEqual(2);
        });
      } else {
        it(`seed ${seed}: reef pillars stand in shallow water cells`, () => {
          const pillars = set.landmarks.filter((l) => l.kind === 'reefPillar');
          expect(pillars.length).toBeGreaterThan(0);
          const shallow = pillars.filter((l) => {
            const g = set.plainHeight(l.x, l.z, full);
            return g > sea - 12 && g < sea + 4;
          });
          expect(shallow.length / pillars.length).toBeGreaterThanOrEqual(0.5);
        });
      }
    }
  });
}
const TWO = Math.PI * 2;
