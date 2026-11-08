import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildDeity, DEITY_VARIANTS } from './model';

describe.each(DEITY_VARIANTS.map((v) => v.id))('deity variant %s', (id) => {
  const rig = buildDeity(id);
  rig.root.updateMatrixWorld(true);
  const { dims } = rig;

  it('stands on y = 0 with the head top at dims.height', () => {
    for (const leg of rig.legs) expect(new THREE.Box3().setFromObject(leg).min.y).toBeCloseTo(0, 2);
    const headTop = rig.head.getWorldPosition(new THREE.Vector3()).y + dims.headRadius;
    expect(headTop).toBeCloseTo(dims.height, 3);
  });

  it('has a readable head gap and chibi height', () => {
    expect(dims.headGap).toBeGreaterThanOrEqual(0.1);
    const bodyTop = dims.hipHeight + dims.bodyHeight;
    expect(dims.headRestY - dims.headRadius - bodyTop).toBeCloseTo(dims.headGap, 3);
    const bb = new THREE.Box3().setFromObject(rig.body);
    expect(bb.max.y).toBeCloseTo(bodyTop, 2);
    expect(dims.height).toBeGreaterThanOrEqual(1.3);
    expect(dims.height).toBeLessThanOrEqual(1.6);
  });

  it('follows the contract hierarchy', () => {
    expect(rig.head.parent).toBe(rig.pose);
    expect(rig.pelvis.parent).toBe(rig.pose);
    for (const h of rig.hands) expect(h.parent).toBe(rig.pose);
    for (const l of rig.legs) expect(l.parent).toBe(rig.pelvis);
    expect(rig.pelvis.position.y).toBeCloseTo(dims.hipHeight, 6);
    let p: THREE.Object3D | null = rig.head.parent;
    while (p) { expect(p).not.toBe(rig.pelvis); p = p.parent; }
  });

  it('disposes without throwing, with and without rim', () => {
    expect(() => rig.dispose()).not.toThrow();
    expect(() => buildDeity(id, { rim: true, voidMode: 'ink' }).dispose()).not.toThrow();
  });
});
