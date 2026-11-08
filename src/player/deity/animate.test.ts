import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../controller';
import { createDeityAnimator, strideLength } from './animate';
import { buildStandinRig } from './standin';

const mk = (o: Partial<PlayerState> = {}): PlayerState => ({
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mode: 'walk', heading: 0, swimPitch: 0, speed: 0, sprinting: false,
  onIce: false, grounded: true, jumped: false, landed: 0, switchedFrom: null, ...o,
});

function snapshot(rig: ReturnType<typeof buildStandinRig>): number[] {
  const out: number[] = [];
  const add = (o: { position: { toArray(): number[] }; rotation: { toArray(): unknown[] }; scale: { toArray(): number[] } }) => {
    out.push(...o.position.toArray(), ...(o.rotation.toArray().slice(0, 3) as number[]), ...o.scale.toArray());
  };
  [rig.pose, rig.body, rig.head, ...rig.legs, ...rig.hands, ...rig.eyes].forEach(add);
  return out;
}

describe('deity animator', () => {
  it('gait phase advances with distance, not frame rate', () => {
    const run = (dt: number) => {
      const rig = buildStandinRig();
      const a = createDeityAnimator(rig);
      const s = mk({ speed: 5 });
      for (let t = 0; t < 4 - 1e-9; t += dt) a.update(s, dt); // 20 m
      return a.gaitPhase;
    };
    const p60 = run(1 / 60), p20 = run(1 / 20);
    expect(p60).toBeCloseTo(20 / strideLength(5), 1);
    expect(p20).toBeCloseTo(p60, 1);
  });

  it('springs settle and stay finite at dt = 1/20 and 1/240', () => {
    for (const dt of [1 / 20, 1 / 240]) {
      const rig = buildStandinRig();
      const a = createDeityAnimator(rig, { lookBack: false });
      const rest = rig.head.position.clone();
      a.update(mk({ jumped: true, vy: 4.85, grounded: false }), dt);
      for (let t = 0; t < 0.6; t += dt) a.update(mk({ vy: 1, grounded: false }), dt);
      a.update(mk({ landed: 1 }), dt);
      for (let t = 0; t < 6; t += dt) a.update(mk(), dt);
      const snap = snapshot(rig);
      expect(snap.every(Number.isFinite)).toBe(true);
      expect(rig.head.position.distanceTo(rest)).toBeLessThan(0.08);
    }
  });

  it('blink schedule is deterministic and every 2-6 s', () => {
    const times = (seed: number) => {
      const rig = buildStandinRig();
      const a = createDeityAnimator(rig, { seed, lookBack: false });
      const out: number[] = [];
      const sy0 = rig.eyes[0].scale.y;
      let prev = 1;
      for (let i = 1; i <= 60 * 20; i++) {
        a.update(mk(), 1 / 60);
        const v = rig.eyes[0].scale.y / sy0;
        if (prev >= 0.99 && v < 0.99) out.push(i / 60);
        prev = v;
      }
      return out;
    };
    const a = times(1), b = times(1);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a[0]).toBeGreaterThanOrEqual(1.9);
    expect(a[0]).toBeLessThanOrEqual(6.3);
    for (let i = 1; i < a.length; i++) expect(a[i] - a[i - 1]).toBeLessThan(6.5);
    expect(times(2)).not.toEqual(a);
  });

  it('long idle (no look-back) stays near rest', () => {
    const rig = buildStandinRig();
    const rest = { head: rig.head.position.clone(), hand: rig.hands[1].position.clone() };
    const a = createDeityAnimator(rig, { lookBack: false });
    for (let i = 0; i < 60 * 15; i++) a.update(mk(), 1 / 60);
    expect(rig.head.position.distanceTo(rest.head)).toBeLessThan(0.06);
    expect(rig.hands[1].position.distanceTo(rest.hand)).toBeLessThan(0.06);
    expect(Math.abs(rig.legs[0].rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.pose.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.body.scale.y - 1)).toBeLessThan(0.05);
  });

  it('look-back turns the head round, then forward again', () => {
    const rig = buildStandinRig();
    const a = createDeityAnimator(rig, { lookBackDelay: [1, 1] });
    let maxYaw = 0;
    for (let i = 0; i < 60 * 8; i++) {
      a.update(mk(), 1 / 60);
      maxYaw = Math.max(maxYaw, Math.abs(rig.head.rotation.y));
    }
    expect(maxYaw).toBeGreaterThan(2.8);
  });

  it('never writes root, and is deterministic for the same inputs', () => {
    const run = () => {
      const rig = buildStandinRig();
      rig.root.position.set(1, 2, 3);
      rig.root.rotation.y = 0.5;
      rig.root.scale.setScalar(0.7);
      const a = createDeityAnimator(rig);
      const seq = [mk({ speed: 5 }), mk({ speed: 9, sprinting: true, heading: 0.3 }), mk({ vy: 3, grounded: false, jumped: true }),
        mk({ mode: 'swim', speed: 3, swimPitch: 0.4 }), mk({ mode: 'swim' }), mk()];
      for (let i = 0; i < 600; i++) a.update(seq[Math.floor(i / 100)], 1 / 60);
      expect([rig.root.position.toArray(), rig.root.rotation.y, rig.root.scale.x]).toEqual([[1, 2, 3], 0.5, 0.7]);
      return snapshot(rig);
    };
    const x = run();
    expect(x.every(Number.isFinite)).toBe(true);
    expect(run()).toEqual(x);
  });
});
