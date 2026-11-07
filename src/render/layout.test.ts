import { describe, expect, it } from 'vitest';
import { develop } from '../sim/develop';
import { worlds } from '../worlds';
import { developInputsFor } from './counterpart';
import {
  beadLayout, capsuleLayout, cellAt, cellCentre, floraShape, hash01, marchRay, nearestSphere, patchToWorld,
  worldToPatch, FLORA_GRID, MAX_BEADS_PER_ORGANISM,
} from './layout';
import type { AnimalGenome } from '../sim/genome';

const body = { size: 0.3, segments: 0.5, limbPairs: 0.5, limbLen: 0.5, plates: 0.4, horns: 0.6, gape: 0.3, diet: 0.5, eyes: 0.6, buoy: 0.1, glow: 0.3, sociality: 0.2 };
const genome = (c: number, si: number): AnimalGenome => ({ body, climate: { prefTemp: 15, tolerance: 10, chem: 0.5 }, comp: { c, si, o: 1 - c - si }, lineage: 1 });
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
      expect(l.beads.length).toBeGreaterThan(2);
      expect(l.beads.length).toBeLessThanOrEqual(MAX_BEADS_PER_ORGANISM);
      expect(Math.min(...l.beads.map((b) => b.y - b.r))).toBeCloseTo(0, 5);
      expect(JSON.stringify(beadLayout(plan(w)))).toBe(JSON.stringify(l));
    }
  });
  it('carbon spine curls, silicon spine is straight', () => {
    const spineZ = (w: 'carbon' | 'silicon') => {
      const p = plan(w);
      return beadLayout(p).beads.slice(0, p.segmentCount).map((b) => b.z);
    };
    const spread = (zs: number[]) => Math.max(...zs) - Math.min(...zs);
    expect(spread(spineZ('silicon'))).toBeLessThan(1e-9);
    expect(spread(spineZ('carbon'))).toBeGreaterThan(1e-4);
  });
  it('capsule fallback is a short worm', () => {
    expect(capsuleLayout(0.3).beads).toHaveLength(5);
  });
});
