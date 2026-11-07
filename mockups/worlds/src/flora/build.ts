// Turn instance lists + MeshData into a niche-gated InstancedMesh.
import * as THREE from 'three/webgpu';
import type { SpeciesId, WorldContext } from '../contracts';
import type { MeshData } from './meshdata';
export { visibleCount } from './placement';

export interface Inst {
  x: number; z: number;
  scale: number;
  yaw: number;
  rand: number;       // niche threshold: visible when rand < niche
  yOff?: number;      // metres above terrain (negative sinks)
  group?: number;
  y?: number;         // absolute override (otherwise terrain + yOff)
}

export interface FloraMesh {
  id: SpeciesId;
  mesh: any;
  rands: Float32Array; // sorted ascending
  n: number;
  tris: number;
}

export function toGeometry(m: MeshData): any {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3));
  g.setAttribute('aAux', new THREE.Float32BufferAttribute(m.aux, 4));
  g.setIndex(m.index);
  return g;
}

export function buildInstanced(ctx: WorldContext, id: SpeciesId, data: MeshData, material: any, insts: Inst[], extra: { castShadow?: boolean; order?: number } = {}): FloraMesh {
  const list = insts.slice().sort((a, b) => a.rand - b.rand);
  const n = Math.max(1, list.length);
  const geo = toGeometry(data);
  const rand = new Float32Array(n), base = new Float32Array(n * 3), par = new Float32Array(n * 3);
  const mesh = new THREE.InstancedMesh(geo, material, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const prng = ctx.rng(`flora:phase:${id}`);
  list.forEach((it, i) => {
    const y = it.y ?? ctx.terrainHeight(it.x, it.z) + (it.yOff ?? 0);
    rand[i] = it.rand;
    base.set([it.x, y, it.z], i * 3);
    par.set([it.scale, it.yaw, prng()], i * 3);
    q.setFromAxisAngle(up, it.yaw); s.setScalar(it.scale); t.set(it.x, y, it.z);
    m.compose(t, q, s);
    mesh.setMatrixAt(i, m);
  });
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
  geo.setAttribute('aPar', new THREE.InstancedBufferAttribute(par, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false; // gating/sway move vertices off the baked bounds
  mesh.castShadow = extra.castShadow ?? false;
  mesh.receiveShadow = false;
  mesh.renderOrder = extra.order ?? 0;
  mesh.name = `flora:${id}`;
  mesh.count = list.length ? n : 0;
  ctx.scene.add(mesh);
  return { id, mesh, rands: rand, n: list.length, tris: (data.index.length / 3) * n };
}
