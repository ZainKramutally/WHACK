import { describe, it, expect } from 'vitest';
import { moveVector, clampPitch, PITCH_MIN, PITCH_MAX, resolveCircles, clampDisc, edgeSlow, angleDelta, marchBoom, insideCircles } from './math';
import { CircleGrid, LandGrid, plantColliders } from './colliders';

const close = (a: [number, number], b: [number, number]) => { expect(a[0]).toBeCloseTo(b[0], 9); expect(a[1]).toBeCloseTo(b[1], 9); };

describe('moveVector (camera-relative)', () => {
  it('yaw 0 (hero direction): W is -Z, D is +X', () => {
    close(moveVector(1, 0, 0), [0, -1]);
    close(moveVector(0, 1, 0), [1, 0]);
  });
  it('turned 90° left: W is -X', () => close(moveVector(1, 0, Math.PI / 2), [-1, 0]));
  it('diagonals are unit length, no input is zero', () => {
    const [x, z] = moveVector(1, 1, 0.7);
    expect(Math.hypot(x, z)).toBeCloseTo(1, 9);
    expect(moveVector(0, 0, 1)).toEqual([0, 0]);
  });
});

describe('clampPitch', () => {
  it('clamps both ends and passes values in range', () => {
    expect(clampPitch(5)).toBe(PITCH_MAX);
    expect(clampPitch(-5)).toBe(PITCH_MIN);
    expect(clampPitch(0.3)).toBe(0.3);
    expect(PITCH_MAX).toBeLessThan(Math.PI / 2);
  });
});

describe('resolveCircles', () => {
  const trunk = { x: 0, z: 0, r: 2, top: 50 };
  it('pushes a point out to r + player radius along the contact normal', () => {
    const [x, z] = resolveCircles(1, 0, 0.5, 0, [trunk]);
    expect(x).toBeCloseTo(2.5, 9); expect(z).toBe(0);
  });
  it('leaves points that do not overlap', () => expect(resolveCircles(3, 0, 0.5, 0, [trunk])).toEqual([3, 0]));
  it('ignores a trunk when flying above its top', () => expect(resolveCircles(1, 0, 0.5, 60, [trunk])).toEqual([1, 0]));
  it('resolves a point at the exact centre without NaN', () => {
    const [x, z] = resolveCircles(0, 0, 0.5, 0, [trunk]);
    expect(Math.hypot(x, z)).toBeCloseTo(2.5, 9);
  });
  it('ends outside both of two overlapping trunks', () => {
    const cs = [trunk, { x: 3, z: 0, r: 2, top: 50 }];
    const [x, z] = resolveCircles(1.5, 0.2, 0.5, 0, cs, 4);
    for (const c of cs) expect(Math.hypot(x - c.x, z - c.z)).toBeGreaterThanOrEqual(c.r + 0.5 - 1e-6);
  });
});

describe('world boundary', () => {
  const disc = { x: 0, z: -500, r: 1000 };
  it('clampDisc keeps inside points and projects outside points onto the edge', () => {
    expect(clampDisc(0, 0, disc)).toEqual([0, 0]);
    close(clampDisc(2000, -500, disc), [1000, -500]);
  });
  it('edgeSlow removes the outward part at the edge but keeps tangential and inward motion', () => {
    close(edgeSlow(1000, -500, 1, 0, disc, 80), [0, 0]);
    expect(edgeSlow(960, -500, 1, 0, disc, 80)[0]).toBeCloseTo(0.5, 9);
    close(edgeSlow(1000, -500, 0, 1, disc, 80), [0, 1]);
    close(edgeSlow(1000, -500, -1, 0, disc, 80), [-1, 0]);
    close(edgeSlow(0, -500, 1, 0, disc, 80), [1, 0]);
  });
});

describe('angleDelta', () => {
  it('takes the short way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6, 9);
    expect(angleDelta(0, 1)).toBeCloseTo(1, 9);
  });
});

describe('colliders', () => {
  it('plant trunks scale with instance height; species without trunks are skipped', () => {
    const cs = plantColliders([
      { species: 'parasolTitan', variant: 0, position: [10, 0, 5], yaw: 0, scale: 2 },
      { species: 'groundCover', variant: 0, position: [0, 0, 0], yaw: 0, scale: 1 },
    ], () => 50, () => 1);
    expect(cs).toHaveLength(1);
    expect(cs[0].r).toBeCloseTo(0.045 * 100, 9);
    expect(cs[0].top).toBeCloseTo(1 + 85, 9);
  });
  it('CircleGrid finds a trunk from the neighbouring cell within the margin', () => {
    const c = { x: 39.5, z: 10, r: 1, top: 10 };
    const g = new CircleGrid([c], 40, 1);
    expect(g.near(40.9, 10)).toContain(c);
  });
  it('LandGrid: solid column blocks walking, a high overhang leaves a passage, a top can be stood on', () => {
    const g = new LandGrid(0, 0, 40, 2);
    // a horizontal square slab at y=30..31 over x,z in [0, 20] (two triangles each face)
    const quad = (y: number) => [0, y, 0, 20, y, 0, 0, y, 20, 20, y, 0, 20, y, 20, 0, y, 20];
    g.addTriangles([...quad(30), ...quad(31)]);
    expect(g.blocked(5, 5, 0, 1.8)).toBe(false);   // walk under the overhang
    expect(g.blocked(5, 5, 29.5, 1.8)).toBe(true); // head in the slab
    expect(g.topNear(5, 5, 30.5, 2)).toBeCloseTo(31, 6);
    expect(g.blocked(30, 30, 30.5, 1.8)).toBe(false);
    // a butte: base below ground, top at 20
    const b = new LandGrid(0, 0, 40, 2);
    b.addTriangles([...quad(-6), ...quad(20)]);
    expect(b.blocked(5, 5, 0, 1.8)).toBe(true);
    expect(b.blocked(5, 5, 20, 1.8)).toBe(false);
  });
});

describe('camera boom pull-in', () => {
  const trunk = { x: 0, z: 5, r: 1, top: 30 };
  const hit = (x: number, y: number, z: number) => insideCircles(x, z, y, 0.35, [trunk]);
  it('keeps the full boom when the segment is clear', () => {
    expect(marchBoom(10, 1.4, 0, 0, 0, 1, 9, hit)).toBe(9);
  });
  it('shortens in front of a trunk between focus and camera', () => {
    const b = marchBoom(0, 1.4, 0, 0, 0, 1, 9, hit);
    expect(b).toBeLessThan(5 - 1.35);
    expect(b).toBeGreaterThanOrEqual(1.2);
  });
  it('a camera above the trunk top is not pulled in', () => {
    expect(marchBoom(0, 31, 0, 0, 0, 1, 9, hit)).toBe(9);
  });
  it('tests the far end even when the boom is not a multiple of the step', () => {
    const wall = (_x: number, _y: number, z: number) => z > 9.1;
    expect(marchBoom(0, 0, 0, 0, 0, 1, 9.2, wall, 0.5, 0.6, 1)).toBeCloseTo(8.6, 9);
  });
  it('never returns less than the minimum', () => {
    expect(marchBoom(0, 0, 0, 0, 0, 1, 9, () => true)).toBe(1.2);
  });
});
