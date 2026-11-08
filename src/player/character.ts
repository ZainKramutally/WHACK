// The player's character: a rig (currently the primitive stand-in) driven by the procedural deity animator.
// It only reads PlayerState; nothing here feeds back into movement. index.ts owns root.visible / root.scale (fade-in).
import type * as THREE from 'three/webgpu';
import type { PlayerState } from './controller';
import { createDeityAnimator, type DeityAnimOptions } from './deity/animate';
import { buildStandinRig } from './deity/standin';

export interface Character {
  root: THREE.Group;
  update(state: PlayerState, dt: number): void;
  dispose(): void;
  /** World point the head looks back at when idle (the camera). null = behind the heading. */
  setLookTarget?(p: { x: number; y: number; z: number } | null): void;
  /** Both hands rise as if shaping the world. */
  cast?(): void;
}

export function createCharacter(animOpts?: DeityAnimOptions): Character {
  const rig = buildStandinRig();
  const anim = createDeityAnimator(rig, animOpts);
  return {
    root: rig.root,
    update(s, dt) {
      rig.root.position.set(s.x, s.y, s.z);
      rig.root.rotation.y = s.heading;
      anim.update(s, dt);
    },
    setLookTarget: (p) => anim.setLookTarget(p),
    cast: () => anim.cast(),
    dispose: () => rig.dispose(),
  };
}
