// Shared contract between the deity's model (model.ts: shapes, materials, variants) and its procedural
// animation (animate.ts). Team-lead owned: change it only by agreement with both owners. Brief: docs/features/deity.md.
//
// Space: metres, +y up. The character faces -z (the controller's heading convention), so its right is +x
// and its left is -x. At rest the feet touch y = 0.
//
// Who writes which transform:
//   root    character.ts sets position and heading. The game (src/player/index.ts) sets visible and scale for the
//           fade-in. Nothing else writes it.
//   pose    animation only: whole-body offsets (bank, swim pitch, hover). The model leaves it at identity.
//   others  the model sets each part's rest transform once. The animation captures those rest transforms at creation,
//           offsets from them every frame, and can always return to them.
import type * as THREE from 'three/webgpu';

export interface DeityDims {
  height: number;        // top of the head at rest
  hipHeight: number;     // pelvis pivot height at rest (= legLength, so the feet sit at y = 0)
  hipHalfWidth: number;  // the legs hang from (-hipHalfWidth, 0, 0) and (+hipHalfWidth, 0, 0) in pelvis space
  legLength: number;
  bodyHeight: number;    // pelvis pivot to the top of the body
  bodyRadius: number;    // widest body radius
  headRadius: number;
  headGap: number;       // empty space between the top of the body and the bottom of the head at rest
  headRestY: number;     // head centre at rest, in pose space
  handRest: [number, number, number]; // the right hand's rest position in pose space; the left hand mirrors x
  handRadius: number;
  eyeLook: number;       // largest gaze offset of an eye in head space
}

export interface DeityRig {
  root: THREE.Group;
  pose: THREE.Group;                       // child of root
  pelvis: THREE.Group;                     // child of pose, at (0, hipHeight, 0)
  body: THREE.Object3D;                    // child of pelvis; squash and stretch through scale
  legs: [THREE.Group, THREE.Group];        // [left, right], children of pelvis; each hangs along -y for legLength;
                                           // rotation.x swings it (+ moves the foot forward, toward -z)
  head: THREE.Group;                       // child of pose, NOT of the pelvis, so it can float, lag and spring on its own
  eyes: [THREE.Object3D, THREE.Object3D];  // [left, right], children of head; scale.y 1 -> 0 is the blink;
                                           // position offsets of up to eyeLook are the gaze
  hands: [THREE.Group, THREE.Group];       // [left, right], children of pose: detached floating mitts
  extras: THREE.Object3D[];                // optional head decoration (antlers, halo, orbiting mote). Each one's userData.motion
                                           // tells the animation what to do with it: 'orbit' spins it about its own y (an orbit pivot),
                                           // 'sway' gives it a small tilt and bob (the default when unset), 'still' leaves it alone
  dims: DeityDims;
  /** Optional. The head belongs on the body (the astronaut's helmet). Animation then follows it stiffly,
   *  never opens or enforces a gap (headGap may be 0 or negative), and limits head yaw to about ±70°
   *  (a glance, not the full look-back turn). */
  headAttached?: boolean;
  /** Optional. The character calls it after the animation every frame, so a model with connecting parts
   *  (the astronaut's arm tubes from shoulder to mitt) can re-fit them to the animated anchors. It never moves
   *  the anchors themselves. */
  update?(): void;
  dispose(): void;
}
