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
    rig.hands[1].position.set(0.5, 0.9, -0.4); // an animated, far-reaching mitt
    rig.hands[0].position.set(-0.3, 0.3, 0.1);
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

  it('disposes without throwing', () => {
    expect(() => rig.dispose()).not.toThrow();
  });
});
