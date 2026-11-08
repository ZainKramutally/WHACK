import { describe, expect, it } from 'vitest';
import { anglesFromDir, catmullRom, clampAboveFloor, createFreeCam, dirFromAngles, samplePath, type PathKey } from './freeCam';

const keys: PathKey[] = [
  { t: 0, pos: [0, 0, 0], look: [0, 0, -10], fov: 60 },
  { t: 2, pos: [10, 0, 0], look: [10, 0, -10], fov: 40 },
  { t: 4, pos: [20, 5, 0], look: [20, 0, -10], fov: 40 },
];
describe('samplePath', () => {
  it('hits the keyframes exactly and interpolates fov', () => {
    expect(samplePath(keys, 0).pos).toEqual([0, 0, 0]);
    expect(samplePath(keys, 2).pos[0]).toBeCloseTo(10);
    expect(samplePath(keys, 1).fov).toBeCloseTo(50);
  });
  it('clamps past the end, and wraps when looping', () => {
    expect(samplePath(keys, 99).pos[0]).toBeCloseTo(20);
    expect(samplePath(keys, 5, true).pos[0]).toBeCloseTo(samplePath(keys, 1).pos[0]);
  });
  it('catmullRom passes through p1 at 0 and p2 at 1', () => {
    expect(catmullRom([0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3], 0)).toEqual([1, 1, 1]);
    expect(catmullRom([0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3], 1)[0]).toBeCloseTo(2);
  });
});
describe('floor clamp and angles', () => {
  it('never goes below the floor plus clearance', () => {
    expect(clampAboveFloor(-5, 10)).toBe(10.5);
    expect(clampAboveFloor(20, 10)).toBe(20);
  });
  it('angles and directions round-trip', () => {
    const d = dirFromAngles(0.8, -0.3);
    const a = anglesFromDir(d[0], d[1], d[2]);
    expect(a.yaw).toBeCloseTo(0.8); expect(a.pitch).toBeCloseTo(-0.3);
  });
});
describe('createFreeCam', () => {
  it('flies forward, stays above the floor, and a path resolves when done', async () => {
    const cam = createFreeCam({ floorAt: () => 0 });
    cam.begin({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: -1 }, 60);
    for (let i = 0; i < 60; i++) cam.update(1 / 60, { moveX: 0, moveZ: 1, rise: -1, orbitYaw: 0, orbitPitch: 0, zoom: 0, slow: false });
    expect(cam.pos.z).toBeLessThan(-1);
    expect(cam.pos.y).toBeGreaterThanOrEqual(0.5);
    const done = cam.play(keys, false);
    for (let i = 0; i < 300; i++) cam.update(1 / 60, { moveX: 0, moveZ: 0, rise: 0, orbitYaw: 0, orbitPitch: 0, zoom: 0, slow: false });
    await done;
    expect(cam.playing).toBe(false);
    expect(cam.pos.x).toBeCloseTo(20, 0);
  });
});
