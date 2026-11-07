// The sea: a plane at seaLevel. Liquid is translucent (water blue-teal, liquid nitrogen clear and nearly
// colourless); frozen is opaque ice. Hidden when there is no sea. The underwater tint lives in sky.ts.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { seaStyle } from './palette';

export interface SeaPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  readonly mesh: THREE.Mesh;
  dispose(): void;
}

export function createSea(app: App): SeaPart {
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0x2a86a0, transparent: true, opacity: 0.6, roughness: 0.1, side: THREE.DoubleSide });
  mat.depthWrite = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1; // after opaque terrain and creatures
  mesh.frustumCulled = false;
  app.scene.add(mesh);

  let wasFrozen: boolean | null = null;
  let lastSolvent = '';
  return {
    mesh,
    update(_dt, t, inputs, patch) {
      const hasSea = (inputs.stats.seaCover ?? 1) > 0.005;
      mesh.visible = hasSea;
      if (!hasSea) return;
      // Frozen seas lie still; liquid ones bob a few millimetres so reflections shimmer.
      const bob = inputs.frozen ? 0 : Math.sin(t * 0.8) * 0.01;
      mesh.position.y = inputs.seaLevel + bob;
      mesh.scale.set(patch * 3, patch * 3, 1); // wider than the patch; fog hides the rim
      if (wasFrozen !== inputs.frozen || lastSolvent !== inputs.world.solvent.name) {
        wasFrozen = inputs.frozen;
        lastSolvent = inputs.world.solvent.name;
        const s = seaStyle(inputs.world.solvent.name, inputs.frozen, inputs.world.solvent.solidSinks);
        mat.color.setHex(s.colour);
        mat.opacity = s.opacity;
        mat.transparent = s.opacity < 1;
        mat.roughness = s.roughness;
        mat.depthWrite = s.opacity >= 1;
        mat.needsUpdate = true;
      }
    },
    dispose() {
      app.scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
