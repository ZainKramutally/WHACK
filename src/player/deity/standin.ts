// Primitive stand-in for the deity rig (black orb head, egg body, stick legs, mitts, white eyes). It follows the rig
// contract exactly, so the animation and its tests run without the real model. Kept after the swap for tests.
import * as THREE from 'three/webgpu';
import type { DeityDims, DeityRig } from './rig';

export function buildStandinRig(): DeityRig {
  const legLength = 0.28, bodyHeight = 0.45, bodyRadius = 0.3, headRadius = 0.33, headGap = 0.1;
  const headRestY = legLength + bodyHeight + headGap + headRadius;
  const dims: DeityDims = {
    height: headRestY + headRadius,
    hipHeight: legLength,
    hipHalfWidth: 0.1,
    legLength,
    bodyHeight,
    bodyRadius,
    headRadius,
    headGap,
    headRestY,
    handRest: [0.4, 0.55, -0.02],
    handRadius: 0.09,
    eyeLook: 0.04,
  };

  const black = new THREE.MeshBasicNodeMaterial({ color: 0x05010a });
  const white = new THREE.MeshBasicNodeMaterial({ color: 0xffffff });
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const limb = new THREE.CylinderGeometry(0.035, 0.035, legLength, 6);

  const root = new THREE.Group();
  const pose = new THREE.Group();
  root.add(pose);
  const pelvis = new THREE.Group();
  pelvis.position.y = dims.hipHeight;
  pose.add(pelvis);

  const body = new THREE.Group();
  const bodyMesh = new THREE.Mesh(sphere, black);
  bodyMesh.scale.set(bodyRadius, bodyHeight / 2, bodyRadius);
  bodyMesh.position.y = bodyHeight / 2;
  body.add(bodyMesh);
  pelvis.add(body);

  const mkLeg = (sx: number) => {
    const g = new THREE.Group();
    g.position.set(sx * dims.hipHalfWidth, 0, 0);
    const m = new THREE.Mesh(limb, black);
    m.position.y = -legLength / 2;
    g.add(m);
    pelvis.add(g);
    return g;
  };
  const legs: DeityRig['legs'] = [mkLeg(-1), mkLeg(1)];

  const head = new THREE.Group();
  head.position.y = headRestY;
  const headMesh = new THREE.Mesh(sphere, black);
  headMesh.scale.setScalar(headRadius);
  head.add(headMesh);
  const mkEye = (sx: number) => {
    const e = new THREE.Mesh(sphere, white);
    e.scale.set(0.06, 0.09, 0.03);
    e.position.set(sx * 0.12, 0.02, -(headRadius - 0.04));
    head.add(e);
    return e;
  };
  const eyes: DeityRig['eyes'] = [mkEye(-1), mkEye(1)];
  pose.add(head);

  const mkHand = (sx: number) => {
    const h = new THREE.Mesh(sphere, black);
    h.scale.setScalar(dims.handRadius);
    h.position.set(sx * dims.handRest[0], dims.handRest[1], dims.handRest[2]);
    pose.add(h);
    // Contract wants a Group.
    const g = new THREE.Group();
    g.position.copy(h.position);
    h.position.set(0, 0, 0);
    g.add(h);
    pose.remove(h);
    pose.add(g);
    return g;
  };
  const hands: DeityRig['hands'] = [mkHand(-1), mkHand(1)];

  return {
    root, pose, pelvis, body, legs, head, eyes, hands, extras: [], dims,
    dispose() {
      black.dispose();
      white.dispose();
      sphere.dispose();
      limb.dispose();
    },
  };
}
