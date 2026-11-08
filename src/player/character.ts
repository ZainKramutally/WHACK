// The player's character: a rig (the deity model, default variant C) driven by the procedural deity animator.
// It only reads PlayerState; nothing here feeds back into movement. index.ts owns root.visible / root.scale (fade-in).
import type * as THREE from 'three/webgpu';
import type { PlayerState } from './controller';
import type { DeityDims } from './deity/rig';
import { createDeityAnimator, type DeityAnimOptions } from './deity/animate';
import { buildDeity, type DeityVariantId } from './deity/model';
import { buildAstronaut } from './deity/astronaut';
import { buildStandinRig } from './deity/standin';

export interface Character {
  root: THREE.Group;
  /** The rig's proportions: index.ts derives the camera target and the swim float height from them. */
  dims: DeityDims;
  update(state: PlayerState, dt: number): void;
  dispose(): void;
  /** World point the head looks back at when idle (the camera). null = behind the heading. */
  setLookTarget?(p: { x: number; y: number; z: number } | null): void;
  /** Both hands rise as if shaping the world. */
  cast?(): void;
}

/** Player and camera tuning that depends on the character's size. index.ts and the animation playground share it. */
export function tuningFor(dims: DeityDims) {
  return {
    player: { swimSurfaceOffset: dims.headRestY - 0.15 }, // head centre ~0.15 m above the water while treading
    camera: { targetHeight: 0.77 * dims.height },
  };
}

export function createCharacter(opts: DeityAnimOptions & { variant?: DeityVariantId | 'standin' | 'astronaut' } = {}): Character {
  const { variant = 'astronaut', ...animOpts } = opts;
  const rig = variant === 'standin' ? buildStandinRig() : variant === 'astronaut' ? buildAstronaut() : buildDeity(variant);
  const anim = createDeityAnimator(rig, animOpts);
  return {
    root: rig.root,
    dims: rig.dims,
    update(s, dt) {
      rig.root.position.set(s.x, s.y, s.z);
      rig.root.rotation.y = s.heading;
      anim.update(s, dt);
      rig.update?.();
    },
    setLookTarget: (p) => anim.setLookTarget(p),
    cast: () => anim.cast(),
    dispose: () => rig.dispose(),
  };
}
