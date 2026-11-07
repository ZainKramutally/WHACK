// Terrain mesh (warped grid: ~2 m cells at the camera, ~100 m at 9 km) + ground data texture.
import * as THREE from 'three/webgpu';
import { positionWorld } from 'three/tsl';
import { heightAt, groundData } from './field';
import { DATA_RECT } from './layout';
import { worldMaterial, groundColor, setGroundTexture } from './material';

export function buildGroundTexture(size = 1024): any {
  const data = new Uint8Array(size * size * 4);
  const { x0, x1, z0, z1 } = DATA_RECT;
  for (let j = 0; j < size; j++) {
    const z = z0 + ((j + 0.5) / size) * (z1 - z0);
    for (let i = 0; i < size; i++) {
      const x = x0 + ((i + 0.5) / size) * (x1 - x0);
      const [r, g, b] = groundData(x, z);
      const k = (j * size + i) * 4;
      data[k] = r * 255; data[k + 1] = g * 255; data[k + 2] = b * 255; data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  setGroundTexture(t);
  return t;
}

const warp = (t: number, a = 0.05) => a * t + (1 - a) * t * t * t;

export function buildTerrain(): any {
  const NX = 520, NZ = 560;
  const XS = 9000, ZF = 9500, ZB = 700;
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3);
  // z: t in [-1, 1] → far (-ZF) .. back (+ZB), split at z=0 so cells are densest at the camera
  const zAt = (t: number) => (t < 0 ? -ZF * warp(-t, 0.035) : ZB * warp(t, 0.2));
  let k = 0;
  for (let j = 0; j <= NZ; j++) {
    const z = zAt(-1 + (2 * j) / NZ);
    for (let i = 0; i <= NX; i++) {
      const x = XS * Math.sign(-1 + (2 * i) / NX) * warp(Math.abs(-1 + (2 * i) / NX), 0.035);
      pos[k++] = x; pos[k++] = heightAt(x, z); pos[k++] = z;
    }
  }
  const idx = new Uint32Array(NX * NZ * 6);
  k = 0;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, worldMaterial({ colorNode: groundColor(positionWorld.xz), bounce: false }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
