import { describe, expect, it } from 'vitest';
import { SlotPool, TrailPath } from './trail';

describe('TrailPath (a swimmer follows its own recent path)', () => {
  it('straight: the old straight path, head at headX', () => {
    const p = new TrailPath(8).straightOn(0.5);
    const a = p.at(-0.3);
    expect([...a.p, ...a.t]).toEqual([0.2, 0, 0, 1, 0, 0]);
  });

  it('a head with no history goes straight back along +x', () => {
    const p = new TrailPath(8).begin(0.5, 0);
    const a = p.at(-1);
    expect(a.p[0]).toBeCloseTo(-0.5, 9); expect(a.p[2]).toBe(0); expect(a.t[0]).toBe(1);
  });

  it('follows a recorded circular trail by arc length, tangents pointing the way it travelled', () => {
    // the head moved counter-clockwise on a unit circle (toward +z); record it newest to oldest
    const R = 1, n = 40, dth = 0.05;
    const p = new TrailPath(64).begin(R, 0);
    for (let k = 1; k <= n; k++) p.push(R * Math.cos(-k * dth), R * Math.sin(-k * dth));
    const s = -10 * R * dth; // ten steps back along the arc (chords ≈ arcs at this spacing)
    const a = p.at(s), th = Math.atan2(a.p[2], a.p[0]);
    expect(Math.hypot(a.p[0], a.p[2])).toBeCloseTo(R, 3);
    expect(th).toBeCloseTo(-10 * dth, 3);
    expect(a.t[0] * -Math.sin(th) + a.t[2] * Math.cos(th)).toBeCloseTo(1, 2); // tangent along +θ (the direction of travel)
    const far = p.at(-100); // past the oldest point: straight on, finite
    expect(far.p.every(Number.isFinite)).toBe(true);
  });

  it('ahead of the head it curves at the turn curvature, so the builder banks; two results can be held at once', () => {
    const p = new TrailPath(8).begin(0, 0.5);
    p.push(-1, 0);
    const a = p.at(0), b = p.at(1);
    expect(a).not.toBe(b);
    expect(a.t).toEqual([1, 0, 0]);
    expect(Math.atan2(b.t[2], b.t[0])).toBeCloseTo(0.5, 9); // turned by κ·s toward +z
    const flat = new TrailPath(8).begin(0, 0);
    flat.push(-1, 0);
    expect(Math.atan2(flat.at(1).t[2], flat.at(1).t[0])).toBeCloseTo(0, 9);
  });
});

describe('SlotPool (swimmer trail slots)', () => {
  it('acquires until empty, takes releases back, and reset frees every slot (a new run)', () => {
    const p = new SlotPool(3);
    expect([p.acquire(), p.acquire(), p.acquire(), p.acquire()]).toEqual([0, 1, 2, -1]);
    p.release(1);
    expect(p.acquire()).toBe(1);
    p.reset(); // entries cleared without releasing: every slot is free again
    expect(p.available).toBe(3);
    expect([p.acquire(), p.acquire(), p.acquire()]).toEqual([0, 1, 2]);
  });
});
