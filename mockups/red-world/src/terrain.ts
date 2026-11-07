// Terrain mesh (2.5 m cells at the hero camera, 10 m at the edge of the 2.4 km walkable square, coarse beyond) + ground data texture.
import * as THREE from 'three/webgpu';
import { positionWorld } from 'three/tsl';
import { heightAt, groundData } from './field';
import { DATA_RECT } from './layout';
import { worldMaterial, groundColor, setGroundTexture } from './material';

export function buildGroundTexture(size = 2048): any {
  const data = new Uint8Array(size * size * 4);
  const { x0, x1, z0, z1 } = DATA_RECT;
  for (let j = 0; j < size; j++) {
    const z = z0 + ((j + 0.5) / size) * (z1 - z0);
    for (let i = 0; i < size; i++) {
      const x = x0 + ((i + 0.5) / size) * (x1 - x0);
      const [r, g, b, a] = groundData(x, z);
      const k = (j * size + i) * 4;
      data[k] = r * 255; data[k + 1] = g * 255; data[k + 2] = b * 255; data[k + 3] = a * 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  setGroundTexture(t);
  return t;
}

/** Axis coordinates: 2.5 m cells at the origin, 10 m at the edge of the walkable disc, then fast growth out to 9.5 km. */
function axis(extent = 9500): number[] {
  const half: number[] = [0];
  let x = 0;
  while (x < extent) {
    const s = x < 60 ? 2.5 : x < 2400 ? 2.5 + (7.5 * (x - 60)) / 2340 : 10 + (x - 2400) * 0.09;
    x = Math.min(extent, x + s); half.push(x);
  }
  return [...half.slice(1).reverse().map((v) => -v), ...half];
}

export function buildTerrain(): any {
  const xs = axis(), zs = axis();
  const NX = xs.length - 1, NZ = zs.length - 1;
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3);
  let k = 0;
  for (let j = 0; j <= NZ; j++) {
    const z = zs[j];
    for (let i = 0; i <= NX; i++) {
      const x = xs[i];
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
  const mesh = new THREE.Mesh(g, worldMaterial({ colorNode: groundColor(positionWorld.xz), bounce: false, lampPool: true }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
