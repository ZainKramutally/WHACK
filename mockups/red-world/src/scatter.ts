// PlantInstance[] → InstancedMeshes per archetype (species × variant), split into spatial groups so the camera and shadow
// frusta can cull them (the walkable world is 360°): a core disc around the hero camera + 8 sectors × 2 distance rings.
// Everything casts; the shadow camera follows the player (src/player) and its frustum culls the far groups.
import * as THREE from 'three/webgpu';
import type { FloraLibrary, PlantInstance } from './contracts';
import { heightAt } from './field';
import { worldMaterial } from './material';

function groupKey(x: number, z: number): string {
  const d = Math.hypot(x, z);
  if (d < 350) return 'core';
  const sector = Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * 8) % 8;
  return `${sector}:${d < 1200 ? 'n' : 'f'}`;
}

export function buildInstances(lib: FloraLibrary, plants: PlantInstance[]): any {
  const group = new THREE.Group();
  const mat = worldMaterial({ glow: true, sway: true, instanced: true, translucent: true, side: THREE.DoubleSide });
  mat.shadowSide = THREE.FrontSide;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const a of lib.archetypes) {
    const groups = new Map<string, PlantInstance[]>();
    for (const pl of plants) {
      if (pl.species !== a.species || pl.variant !== a.variant) continue;
      const k = groupKey(pl.position[0], pl.position[2]);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(pl);
    }
    for (const [key, list] of groups) {
      const geo = a.geometry.clone();
      const scales = new Float32Array(list.length);
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((pl, i) => {
        const [x, , z] = pl.position;
        p.set(x, heightAt(x, z) - 0.15 * pl.scale, z);
        e.set(pl.tilt?.[0] ?? 0, pl.yaw, pl.tilt?.[1] ?? 0, 'YXZ');
        q.setFromEuler(e);
        s.setScalar(pl.scale);
        mesh.setMatrixAt(i, m4.compose(p, q, s));
        scales[i] = pl.scale;
      });
      geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 2; // sway headroom
      mesh.frustumCulled = !location.search.includes('nocull');
      mesh.name = `${a.species}-${a.variant}@${key}`;
      group.add(mesh);
    }
  }
  return group;
}
