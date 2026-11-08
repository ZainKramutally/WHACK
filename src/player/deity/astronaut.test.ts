import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildAstronaut } from './astronaut';

describe('astronaut rig', () => {
  const rig = buildAstronaut();
  rig.root.updateMatrixWorld(true);

  it('stands on y = 0 and is 1.4-1.6 m tall', () => {
    for (const leg of rig.legs) expect(new THREE.Box3().setFromObject(leg).min.y).toBeCloseTo(0, 2);
    const top = rig.head.getWorldPosition(new THREE.Vector3()).y + rig.dims.headRadius;
    expect(top).toBeCloseTo(rig.dims.height, 3);
    expect(top).toBeGreaterThanOrEqual(1.4);
    expect(top).toBeLessThanOrEqual(1.6);
  });

  it('follows the contract hierarchy and is head-attached', () => {
    expect(rig.headAttached).toBe(true);
    expect(rig.head.parent).toBe(rig.pose);
    expect(rig.pelvis.parent).toBe(rig.pose);
    expect(rig.body.parent).toBe(rig.pelvis);
    for (const h of rig.hands) expect(h.parent).toBe(rig.pose);
    for (const l of rig.legs) expect(l.parent).toBe(rig.pelvis);
    for (const e of rig.eyes) expect(e.parent).toBe(rig.head);
    expect(rig.legs[0].position.x).toBeLessThan(0);
    expect(rig.hands[0].position.x).toBeLessThan(0);
  });

  it('update() fits the arm tubes between shoulder and mitt', () => {
    rig.hands[1].position.set(0.4, 0.75, -0.15); // animated mitts, within reach
    rig.hands[0].position.set(-0.3, 0.45, 0.1);
    rig.update!();
    rig.root.updateMatrixWorld(true);
    const tubes = rig.pose.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.parent === rig.pose && c !== undefined && !rig.hands.includes(c as never) && (c as THREE.Mesh).scale.y !== 1 || false);
    expect(tubes.length).toBe(4);
    const end = (m: THREE.Mesh) => new THREE.Vector3(0, 1, 0).applyMatrix4(m.matrix);
    for (const [i, s, h] of [[0, 0, 0], [1, 2, 1]] as const) {
      const upper = tubes[s], fore = tubes[s + 1];
      void i;
      const shoulder = rig.body.children[h].getWorldPosition(new THREE.Vector3());
      rig.pose.worldToLocal(shoulder);
      expect(upper.position.distanceTo(shoulder)).toBeLessThan(0.01);
      expect(end(fore).distanceTo(rig.hands[h].position)).toBeLessThan(0.01);
      expect(end(upper).distanceTo(fore.position)).toBeLessThan(0.01);
    }
  });

  it('has knees under the legs, and the shin carries the boot to y = 0', () => {
    expect(rig.knees).toBeDefined();
    rig.knees!.forEach((k, i) => {
      expect(k.parent).toBe(rig.legs[i]);
      expect(k.position.y).toBeLessThan(-rig.dims.legLength / 2);
    });
    rig.root.updateMatrixWorld(true);
    for (const k of rig.knees!) expect(new THREE.Box3().setFromObject(k).min.y).toBeCloseTo(0, 2);
  });

  it('shoulder and armReach match the geometry; past reach the tube end clamps', () => {
    const { shoulder, armReach } = rig.dims;
    const sh = new THREE.Vector3(...shoulder!);
    const w = rig.body.children[1].getWorldPosition(new THREE.Vector3());
    rig.pose.worldToLocal(w);
    expect(w.distanceTo(sh)).toBeLessThan(0.01);
    rig.hands[1].position.copy(sh).add(new THREE.Vector3(0, -armReach!, 0)); // fully stretched, straight down
    rig.update!();
    rig.root.updateMatrixWorld(true);
    const tubes = rig.pose.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.scale.y !== 1);
    const fore = tubes[3];
    const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(fore.matrix);
    expect(tip.distanceTo(rig.hands[1].position)).toBeLessThan(0.01);
    rig.hands[1].position.y -= 0.5; // beyond reach
    rig.update!();
    expect(new THREE.Vector3(0, 1, 0).applyMatrix4(fore.matrix).distanceTo(sh)).toBeCloseTo(armReach!, 2);
  });

  it('keeps each eye (with gaze offset) inside the visor', () => {
    const v = rig.head.userData.visor as { rx: number; ry: number; cy: number };
    for (const e of rig.eyes) {
      const r = (e as THREE.Mesh).geometry.boundingBox ?? ((e as THREE.Mesh).geometry.computeBoundingBox(), (e as THREE.Mesh).geometry.boundingBox!);
      const er = r.max.x; // disc radius
      const look = rig.dims.eyeLook;
      expect((Math.abs(e.position.x) + er + look) / v.rx).toBeLessThan(1);
      expect((Math.abs(e.position.y - v.cy) + er + look) / v.ry).toBeLessThan(1);
      expect(er).toBeGreaterThan(0.25 * v.rx); // big eyes
    }
  });

  it('disposes without throwing', () => {
    expect(() => rig.dispose()).not.toThrow();
  });
});
