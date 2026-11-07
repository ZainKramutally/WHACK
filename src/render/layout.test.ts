import { describe, expect, it } from 'vitest';
import { develop } from '../sim/develop';
import { worlds } from '../worlds';
import { developInputsFor } from './counterpart';
import {
  armRods, beadLayout, capsuleLayout, cellAt, cellCentre, floraShape, hash01, marchRay, nearestSphere, patchToWorld,
  worldToPatch, FLORA_GRID, displayLength, displayFactor, MAX_BEADS_PER_ORGANISM, MAX_RODS_PER_ORGANISM, ROD_STRIDE,
} from './layout';
import { BODY_GENES, type AnimalGenome } from '../sim/genome';
import { makeRng } from '../sim/rng';

const genomeBody = { size: 0.3, segments: 0.5, limbPairs: 0.5, limbLen: 0.5, plates: 0.4, horns: 0.6, gape: 0.3, diet: 0.5, eyes: 0.6, buoy: 0.1, glow: 0.3, sociality: 0.2 };
const genome = (c: number, si: number): AnimalGenome => ({ body: genomeBody, climate: { prefTemp: 15, tolerance: 10, chem: 0.5 }, comp: { c, si, o: 1 - c - si }, lineage: 1 });
const plan = (w: 'carbon' | 'silicon') => {
  const cfg = worlds[w];
  return develop(genome(cfg.life.composition.c, cfg.life.composition.si), { light: 0.5, heatBand: 0.5 }, developInputsFor(cfg));
};

describe('grid ↔ world', () => {
  it('round-trips cells through their centre', () => {
    for (const cell of [0, 1, 63, 64, 2000, 4095]) {
      const c = cellCentre(cell, 300);
      expect(cellAt(c.x, c.z, 300)).toBe(cell);
    }
  });
  it('maps patch coordinates around the origin and rejects outside points', () => {
    expect(patchToWorld(0.5, 300)).toBe(0);
    expect(worldToPatch(patchToWorld(0.25, 400), 400)).toBeCloseTo(0.25);
    expect(cellAt(-151, 0, 300)).toBe(-1);
    expect(cellAt(0, 150, 300)).toBe(-1);
    expect(FLORA_GRID).toBe(64);
  });
});

describe('floraShape', () => {
  it('draws nothing at zero biomass and more with more biomass', () => {
    expect(floraShape(0, 0).count).toBe(0);
    const a = floraShape(0.05, 0), b = floraShape(2, 1);
    expect(a.count).toBeGreaterThan(0);
    expect(b.count).toBeGreaterThanOrEqual(a.count);
    expect(b.height).toBeGreaterThan(a.height);
  });
  it('hash01 is deterministic and in range', () => {
    expect(hash01(5, 2, 1)).toBe(hash01(5, 2, 1));
    for (let i = 0; i < 100; i++) { const v = hash01(i, 3, 4); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('nearestSphere', () => {
  it('returns the closest organism id along the ray', () => {
    const ids = [7, 9], xs = [0, 0], ys = [0, 0], zs = [10, 5], rs = [1, 1];
    const hit = nearestSphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, ids, xs, ys, zs, rs, 2);
    expect(hit?.id).toBe(9);
    expect(hit?.dist).toBeCloseTo(4);
    expect(nearestSphere({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, ids, xs, ys, zs, rs, 2)).toBeNull();
  });
  const O = { x: 0, y: 0, z: 0 }, FWD = { x: 0, y: 0, z: 1 };
  it('a ray starting inside a sphere is not a hit (the camera can sit inside a big creature)', () => {
    expect(nearestSphere(O, FWD, [1], [0], [0], [2], [5], 1)).toBeNull();
    // ...but another sphere further ahead (outside the one we are in) is hit.
    expect(nearestSphere(O, FWD, [1, 2], [0, 0], [0, 0], [2, 12], [5, 1], 2)?.id).toBe(2);
  });
  it('spheres behind the origin are ignored', () => {
    expect(nearestSphere(O, FWD, [1], [0], [0], [-6], [1], 1)).toBeNull();
  });
  it('a grazing ray still hits, a near-miss does not', () => {
    expect(nearestSphere({ x: 1, y: 0, z: 0 }, FWD, [1], [0], [0], [5], [1], 1)?.dist).toBeCloseTo(5);
    expect(nearestSphere({ x: 1.01, y: 0, z: 0 }, FWD, [1], [0], [0], [5], [1], 1)).toBeNull();
  });
});

describe('marchRay', () => {
  const flat = (h: number) => (_x: number, _z: number) => h;
  const base = { maxDist: 400, step: 1, patch: 300, seaVisible: true, flora: new Float32Array(FLORA_GRID * FLORA_GRID * 2) };
  it('looking up gives sky; looking down gives ground', () => {
    const o = { x: 0, y: 5, z: 0 };
    expect(marchRay(o, { x: 0, y: 1, z: 0 }, { ...base, heightAt: flat(0), seaLevel: -50 }).target.kind).toBe('sky');
    expect(marchRay(o, { x: 0, y: -0.7071, z: 0.7071 }, { ...base, heightAt: flat(0), seaLevel: -50 }).target.kind).toBe('ground');
  });
  it('hits the sea when the ground under the crossing is below sea level', () => {
    const r = marchRay({ x: 0, y: 5, z: 0 }, { x: 0, y: -0.7071, z: 0.7071 }, { ...base, heightAt: flat(-20), seaLevel: 0 });
    expect(r.target.kind).toBe('sea');
  });
  it('reports the producer cell when the hit cell has flora, and ground when it is empty', () => {
    const flora = new Float32Array(FLORA_GRID * FLORA_GRID * 2);
    const o = { x: 0, y: 5, z: 0 }, d = { x: 0, y: -1, z: 0 };
    const cell = cellAt(0, 0, 300);
    expect(marchRay(o, d, { ...base, flora, heightAt: flat(0), seaLevel: -50 }).target.kind).toBe('ground');
    flora[cell * 2] = 0.5;
    const t = marchRay(o, d, { ...base, flora, heightAt: flat(0), seaLevel: -50 }).target;
    expect(t).toEqual({ kind: 'producer', cell });
  });
});

describe('beadLayout', () => {
  it('rests on the ground, stays under the per-organism cap and is deterministic', () => {
    for (const w of ['carbon', 'silicon'] as const) {
      const l = beadLayout(plan(w));
      const rods = l.radial?.rods ?? [];
      expect(l.beads.length + rods.length).toBeGreaterThan(2);
      expect(l.beads.length).toBeLessThanOrEqual(MAX_BEADS_PER_ORGANISM);
      // Legless bodies rest exactly on the ground; legged ones within a snapped joint's error of it.
      const low = Math.min(...l.beads.map((b) => b.y - b.r), ...rods.flatMap((r) => [r.ay - r.r, r.by - r.r]));
      expect(Math.abs(low)).toBeLessThan(0.08 * plan(w).scale);
      expect(JSON.stringify(beadLayout(plan(w)))).toBe(JSON.stringify(l));
    }
  });
  it('carbon is an axial ellipsoid chain that curls, with paired eyes; silicon is a radial prism lattice with no spine', () => {
    const p = plan('carbon');
    const c = beadLayout(p), s = beadLayout(plan('silicon'));
    expect(c.radial).toBeUndefined();
    expect(s.radial).toBeDefined();
    const trunk = c.beads.slice(0, p.segmentCount + p.tailSegments);
    const zs = trunk.map((b) => b.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1e-4);
    // Eyes are mirrored pairs about the body axis.
    const eyes = c.beads.filter((b) => b.tone === 1);
    expect(eyes.length).toBe(p.eyeCount);
    const sumZ = eyes.reduce((a, b) => a + b.z, 0);
    const headZ = trunk[trunk.length - 1].z;
    expect(Math.abs(sumZ - headZ * eyes.length)).toBeLessThan(1e-9);
    expect(s.nBody).toBe(0);
    expect(s.limbs).toHaveLength(0);
  });
  it('silicon: n-fold hub tiers, one arm per vertex, eyes at the tips', () => {
    const p = plan('silicon'), l = beadLayout(p), R = l.radial!;
    expect(R.nTiers).toBe(p.tiers);
    expect(R.hubSides).toBe(p.symmetry);
    expect(R.arms).toHaveLength(p.symmetry);
    expect(R.rods.length).toBeGreaterThanOrEqual(R.nHubRods + 2 * p.symmetry);
    for (const a of R.arms) {
      expect(a.snap).toBe(15);
      expect(a.nRods).toBeGreaterThanOrEqual(2);
      expect(a.tipRod).toBeLessThan(a.nRods);
    }
    // Tiers are stacked prisms about the vertical axis.
    for (let i = 0; i < R.nTiers; i++) { expect(R.rods[i].ax).toBe(0); expect(R.rods[i].az).toBe(0); expect(R.rods[i].by).toBeGreaterThan(R.rods[i].ay); }
    expect(l.beads.length).toBe(p.eyeCount);
    for (const b of l.beads) expect(b.tone).toBe(1);
  });
  it('silicon arms: IK keeps both bones joined and the right number of rods per kind', () => {
    for (const kind of ['rod', 'branch', 'fan', 'whip'] as const) {
      const p = { ...plan('silicon'), armKind: kind };
      const R = beadLayout(p).radial!;
      for (const rig of R.arms) {
        expect(rig.kind).toBe(kind);
        for (const [fx, fy] of [[0.6, 0.02], [0.3, 0.5], [0.2, -0.4]]) {
          const out: number[] = [];
          armRods(rig, rig.hip.x + rig.dirX * fx * rig.restOut, fy, rig.hip.z + rig.dirZ * fx * rig.restOut, out);
          expect(out).toHaveLength(rig.nRods * ROD_STRIDE);
          expect(out.slice(3, 6)).toEqual(out.slice(9, 12)); // knee shared
          expect(Math.hypot(out[3] - out[0], out[4] - out[1], out[5] - out[2])).toBeCloseTo(rig.len1);
          expect(Math.hypot(out[12] - out[9], out[13] - out[10], out[14] - out[11])).toBeCloseTo(rig.len2);
          expect(out.every(Number.isFinite)).toBe(true);
        }
      }
    }
  });
  it('every random plan lays out within the bead and rod budgets with finite parts, in both architectures', () => {
    const rng = makeRng(5)('layout-budget');
    for (const w of ['carbon', 'silicon'] as const) {
      const cfg = worlds[w];
      for (let n = 0; n < 80; n++) {
        const body = {} as typeof genomeBody;
        for (const g of BODY_GENES) body[g] = rng();
        const g: AnimalGenome = { body, climate: { prefTemp: 15, tolerance: 10, chem: 0.5 }, comp: { ...cfg.life.composition }, lineage: 1 };
        const p = develop(g, { light: rng(), heatBand: rng() }, developInputsFor(cfg));
        const l = beadLayout(p);
        expect(l.beads.length).toBeLessThanOrEqual(MAX_BEADS_PER_ORGANISM);
        expect((l.radial?.rods.length ?? 0) + (l.limbRods?.length ?? 0)).toBeLessThanOrEqual(MAX_RODS_PER_ORGANISM);
        for (const b of l.beads) expect([b.x, b.y, b.z, b.r].every(Number.isFinite)).toBe(true);
        for (const r of l.radial?.rods ?? l.limbRods ?? []) expect([r.ax, r.ay, r.az, r.bx, r.by, r.bz, r.r].every(Number.isFinite)).toBe(true);
        expect(Number.isFinite(l.radius) && l.radius > 0).toBe(true);
        if (l.radial) expect(l.radial.arms).toHaveLength(p.symmetry);
        else expect(l.limbRods?.length ?? 0).toBe(2 * l.limbs.length);
      }
    }
  });
  it('layouts differ by form: different plans from one world give different part lists', () => {
    const base = plan('carbon');
    const a = beadLayout({ ...base, tailKind: 'whip', tailSegments: 5 }), b = beadLayout({ ...base, tailKind: 'fluke', tailSegments: 1 });
    expect(a.beads.length).not.toBe(b.beads.length);
    const w = beadLayout({ ...base, wingSpan: 1, finSpan: 0 }).beads.filter((x) => (x.flap ?? 0) > 0);
    expect(w.length).toBeGreaterThanOrEqual(2);
    const sBase = plan('silicon');
    const kinds = (['rod', 'branch', 'fan', 'whip'] as const).map((k) => beadLayout({ ...sBase, armKind: k }).radial!.rods.length);
    expect(new Set(kinds).size).toBeGreaterThan(2);
  });
  it('capsule fallback is a short worm', () => {
    expect(capsuleLayout(0.3).beads).toHaveLength(5);
  });
});

describe('display scale', () => {
  it('is strictly monotonic, draws a founder worm 2 m, and spreads the real range ~20×+', () => {
    expect(displayLength(0.15)).toBeCloseTo(2, 1);
    let prev = 0;
    for (const s of [0.05, 0.1, 0.15, 0.3, 0.5, 1, 1.5, 3, 5, 10, 20]) { const d = displayLength(s); expect(d).toBeGreaterThan(prev); prev = d; }
    expect(displayLength(9.6) / displayLength(0.1)).toBeGreaterThan(20);
    expect(displayLength(9.6)).toBeGreaterThan(30);
    expect(displayLength(9.6)).toBeLessThan(60);
    expect(displayLength(0.1)).toBeLessThan(displayLength(0.15) * 0.8);
    expect(displayFactor(0.15) * 0.15).toBeCloseTo(displayLength(0.15));
  });
});

describe('limb rigs', () => {
  it('carbon: each leg gets a rig with a knee bead, a foot bead and two bones at its rest pose', () => {
    const p = plan('carbon'), l = beadLayout(p);
    expect(l.limbs.length).toBe(p.legPairs * 2);
    expect(l.nBody + 2 * l.limbs.length).toBe(l.beads.length);
    expect(l.limbRods).toHaveLength(2 * l.limbs.length);
    for (const r of l.limbs) { expect(r.snap).toBe(0); expect(r.taper).toBe(p.limbKind !== 'leg'); }
  });
});
