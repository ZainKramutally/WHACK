import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../controller';
import { createDeityAnimator, strideLength } from './animate';
import { buildDeity } from './model';
import { buildStandinRig } from './standin';
import * as THREE from 'three/webgpu';

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

  // Pose-space metrics over 2 s of steady motion on variant C (after 1.5 s warm-up).
  const gaitMetrics = (speed: number, sprinting: boolean, turn = 0) => {
    const rig = buildDeity('C');
    const a = createDeityAnimator(rig);
    const dt = 1 / 60;
    let heading = 0;
    const m = { yMin: 1e9, yMax: -1e9, sMin: 1e9, sMax: -1e9, rxMin: 1e9, rxMax: -1e9, rzMax: 0 };
    const restY = rig.pose.position.y;
    for (let i = 0; i < 210; i++) {
      heading += turn * dt;
      a.update(mk({ speed, sprinting, heading }), dt);
      if (i < 90) continue;
      const y = rig.pose.position.y - restY;
      m.yMin = Math.min(m.yMin, y); m.yMax = Math.max(m.yMax, y);
      m.sMin = Math.min(m.sMin, rig.body.scale.y); m.sMax = Math.max(m.sMax, rig.body.scale.y);
      m.rxMin = Math.min(m.rxMin, rig.pose.rotation.x); m.rxMax = Math.max(m.rxMax, rig.pose.rotation.x);
      m.rzMax = Math.max(m.rzMax, Math.abs(rig.pose.rotation.z));
    }
    return { m, rig };
  };

  it('C stays inside the bounce caps (walk and run)', () => {
    const w = gaitMetrics(5, false).m, r = gaitMetrics(9, true).m;
    expect(w.yMax - w.yMin).toBeLessThanOrEqual(0.045);
    expect(w.sMax - w.sMin).toBeLessThanOrEqual(0.065);
    expect(Math.abs(w.rxMin)).toBeLessThanOrEqual(0.075);
    expect(w.rzMax).toBeLessThanOrEqual(0.04);
    expect(r.yMax - r.yMin).toBeLessThanOrEqual(0.075);
    expect(r.sMax - r.sMin).toBeLessThanOrEqual(0.105);
    expect(r.rxMin).toBeGreaterThan(-0.15);
    expect(r.rxMax).toBeLessThan(-0.08); // always leaning forward
  });

  it('leans forward when running and banks into a left turn', () => {
    const { rig } = gaitMetrics(9, true);
    rig.root.updateMatrixWorld(true);
    const top = rig.body.localToWorld(new THREE.Vector3(0, rig.dims.bodyHeight, 0));
    const foot = rig.legs[0].localToWorld(new THREE.Vector3(0, -rig.dims.legLength, 0));
    expect(top.z).toBeLessThan(foot.z - 0.03); // forward is -z
    const t = gaitMetrics(5, false, 2); // heading increasing = turning left (toward -x)
    t.rig.root.updateMatrixWorld(true);
    const tt = t.rig.body.localToWorld(new THREE.Vector3(0, t.rig.dims.bodyHeight, 0));
    expect(tt.x).toBeLessThan(-0.01);
    expect(t.m.rzMax).toBeLessThanOrEqual(0.105 + 0.035); // bank cap 6 deg + walk sway 2 deg
  });

  it('C keeps 2 cm between the head and the body top through walk, run, jump and landing', () => {
    const rig = buildDeity('C');
    const a = createDeityAnimator(rig);
    const { hipHeight, bodyHeight, headRadius } = rig.dims;
    let minClear = 1e9;
    const step = (st: PlayerState) => {
      a.update(st, 1 / 60);
      const clear = rig.head.position.y - headRadius - (hipHeight + bodyHeight * rig.body.scale.y);
      minClear = Math.min(minClear, clear);
    };
    for (let i = 0; i < 120; i++) step(mk({ speed: 5 }));
    for (let i = 0; i < 120; i++) step(mk({ speed: 9, sprinting: true }));
    step(mk({ speed: 5, jumped: true, vy: 4.85, grounded: false }));
    for (let i = 0; i < 20; i++) step(mk({ speed: 5, vy: 4.85 - i * 0.5, grounded: false }));
    for (let i = 0; i < 20; i++) step(mk({ speed: 5, vy: -i * 0.4, grounded: false }));
    step(mk({ speed: 5, landed: 1 }));
    for (let i = 0; i < 120; i++) step(mk());
    expect(minClear).toBeGreaterThanOrEqual(0.02 - 1e-6);
  });

  it('headAttached: head rides the body, no dip, yaw limited to a glance', () => {
    const rig = buildStandinRig();
    rig.headAttached = true;
    const a = createDeityAnimator(rig, { lookBackDelay: [1, 1] });
    const restY = rig.head.position.y;
    let maxYaw = 0, maxDip = 0;
    const seq = [mk({ speed: 5 }), mk({ speed: 5, jumped: true, vy: 4.8, grounded: false }), mk({ landed: 1 }), mk()];
    for (let i = 0; i < 480; i++) {
      a.update(seq[i < 100 ? 0 : i === 100 ? 1 : i === 101 ? 2 : 3], 1 / 60);
      maxYaw = Math.max(maxYaw, Math.abs(rig.head.rotation.y));
      maxDip = Math.max(maxDip, Math.abs(rig.head.position.y - restY - rig.dims.bodyHeight * (rig.body.scale.y - 1)));
      expect(Math.abs(rig.head.position.x)).toBeLessThan(1e-9);
    }
    expect(maxYaw).toBeLessThanOrEqual(1.25 + 1e-9);
    expect(maxYaw).toBeGreaterThan(0.5); // it does glance
    expect(maxDip).toBeLessThan(1e-9);
  });
});
