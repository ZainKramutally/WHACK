// Footstep and landing dust: ONE instanced mesh over a fixed pool, built-in node material, never pickable. Render-only.
import * as THREE from 'three/webgpu';
import type { VisualInputs } from '../worlds/types';
import { crustGround } from './crustLook';
import { createDustPool, dustSurface, type DustPlayer } from './dustSim';

export interface Dust {
  readonly mesh: THREE.InstancedMesh;
  update(dt: number, p: DustPlayer, gravityG: number, inputs: VisualInputs): void;
  setVisible(v: boolean): void;
}

const ICE = new THREE.Color(0xe6f4ff);
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function createDust(scene: THREE.Scene): Dust {
  const pool = createDustPool();
  const geo = new THREE.OctahedronGeometry(1, 0);
  const mat = new THREE.MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, pool.size);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.raycast = () => {};            // never pickable (picking is analytic, this is belt and braces)
  mesh.visible = false;
  for (let i = 0; i < pool.size; i++) mesh.setMatrixAt(i, ZERO);
  mesh.setColorAt(0, _c.set(0xffffff));   // allocates instanceColor so the first draw compiles with it
  const group = new THREE.Group();
  group.name = 'dust';   // main.ts warmFeatures compiles it by name
  group.add(mesh);
  scene.add(group);

  let visible = false;
  let tintKey = -2, tint = { r: 0.6, g: 0.55, b: 0.47 };
  const arr = mesh.instanceMatrix.array as Float32Array;
  const col = mesh.instanceColor!.array as Float32Array;

  return {
    mesh,
    setVisible(v) { visible = v; mesh.visible = v; },
    update(dt, p, gravityG, inputs) {
      if (!visible) return;
      const surface = dustSurface(p);
      let t = tint;
      if (surface === 'ice') t = { r: ICE.r, g: ICE.g, b: ICE.b };
      else {
        const hex = crustGround(inputs);
        const key = hex ?? (inputs.world.composition.si > 0.5 ? -1 : -3);
        if (key !== tintKey) {
          tintKey = key;
          if (hex !== undefined) _c.set(hex).lerp(_c.clone().set(0xffffff), 0.15);
          else _c.set(key === -1 ? 0x8f949e : 0x9a8466);
          tint = { r: _c.r, g: _c.g, b: _c.b };
        }
        t = tint;
      }
      pool.update(dt, p, surface, gravityG, t);
      for (let i = 0; i < pool.size; i++) {
        const o = i * 16;
        const l = pool.life[i];
        if (l <= 0) { arr[o] = arr[o + 5] = arr[o + 10] = 0; arr[o + 12] = arr[o + 13] = arr[o + 14] = 0; continue; }
        const k = l / pool.maxLife[i];
        const s = pool.size0[i] * (0.5 + 0.9 * (1 - k)) * Math.min(1, k * 3); // puffs grow, then shrink out
        arr[o] = arr[o + 5] = arr[o + 10] = s; arr[o + 15] = 1;
        arr[o + 12] = pool.px[i]; arr[o + 13] = pool.py[i]; arr[o + 14] = pool.pz[i];
        col[i * 3] = pool.r[i]; col[i * 3 + 1] = pool.g[i]; col[i * 3 + 2] = pool.b[i];
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    },
  };
}
