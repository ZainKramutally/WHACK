// PlantInstance[] → one InstancedMesh per archetype (species × variant), sitting on the terrain.
import * as THREE from 'three/webgpu';
import type { FloraLibrary, PlantInstance } from './contracts';
import { heightAt } from './field';
import { worldMaterial } from './material';

export function buildInstances(lib: FloraLibrary, plants: PlantInstance[]): any {
  const group = new THREE.Group();
  const mat = worldMaterial({ glow: true, sway: true, instanced: true, side: THREE.DoubleSide });
  mat.shadowSide = THREE.FrontSide;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const a of lib.archetypes) {
    const list = plants.filter((x) => x.species === a.species && x.variant === a.variant);
    if (!list.length) continue;
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
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = `${a.species}-${a.variant}`;
    group.add(mesh);
  }
  return group;
}
