// Plants from the per-cell flora grid ([mat, canopy] per cell, 64² cells). Density and height follow biomass; a cell
// with no biomass draws nothing (so nothing appears before life). Carbon: curling stems with caps. Silicon: crystal
// spikes with side branches at 60°. Chemistry comes from the world's body composition. Rebuilt a few times a second.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { FLORA_GRID, cellCentre, floraAt, floraShape, hash01 } from './layout';
import { floraColours } from './palette';

const STEM_CAP = 30000, CAP_CAP = 12000, SPIKE_CAP = 40000, MAX_PLANTS = 10000;
const REBUILD_EVERY = 0.25; // s while the world builds
const REBUILD_EVERY_LIVE = 1; // s afterwards: biomass drifts slowly, and a rebuild is a ~10 ms spike
const UP = new THREE.Vector3(0, 1, 0);

export interface FloraPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Number of plants drawn at the last rebuild. */
  plants: number;
  dispose(): void;
}

function inst(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

export function createFlora(app: App): FloraPart {
  const stems = inst(new THREE.CylinderGeometry(0.55, 1, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardNodeMaterial({ roughness: 0.8 }), STEM_CAP);
  const caps = inst(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }), CAP_CAP);
  const spikes = inst(
    new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0),
    new THREE.MeshStandardNodeMaterial({ roughness: 0.25, metalness: 0.1, flatShading: true }),
    SPIKE_CAP,
  );
  app.scene.add(stems, caps, spikes);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), dir = new THREE.Vector3();
  const colour = new THREE.Color();
  let lastBuf: Float32Array | null = null, lastRise = -1, lastWorld = '', lastAt = -1, lastPatch = 0;

  function push(mesh: THREE.InstancedMesh, base: THREE.Vector3, d: THREE.Vector3, len: number, rad: number, hex: number) {
    const i = mesh.count;
    if (i >= (mesh.instanceMatrix.count)) return;
    q.setFromUnitVectors(UP, d);
    sc.set(rad, len, rad);
    m4.compose(base, q, sc);
    m4.toArray(mesh.instanceMatrix.array as Float32Array, i * 16);
    colour.setHex(hex).toArray((mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array, i * 3);
    mesh.count = i + 1;
  }
  function pushBall(mesh: THREE.InstancedMesh, at: THREE.Vector3, rad: number, hex: number) {
    const i = mesh.count;
    if (i >= mesh.instanceMatrix.count) return;
    m4.makeScale(rad, rad, rad).setPosition(at);
    m4.toArray(mesh.instanceMatrix.array as Float32Array, i * 16);
    colour.setHex(hex).toArray((mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array, i * 3);
    mesh.count = i + 1;
  }

  const part: FloraPart = {
    plants: 0,
    update(_dt, t, inputs, patch) {
      const needs =
        inputs.flora !== lastBuf || Math.abs(inputs.terrain.rise - lastRise) > 0.02 ||
        inputs.world.id !== lastWorld || patch !== lastPatch;
      if (!needs || t - lastAt < (inputs.buildProgress < 1 ? REBUILD_EVERY : REBUILD_EVERY_LIVE)) return;
      lastBuf = inputs.flora; lastRise = inputs.terrain.rise; lastWorld = inputs.world.id; lastAt = t; lastPatch = patch;

      stems.count = 0; caps.count = 0; spikes.count = 0;
      let plants = 0;
      const silicon = inputs.world.composition.si > 0.5;
      const cell = patch / FLORA_GRID;
      const n = Math.min(inputs.flora.length / 2, FLORA_GRID * FLORA_GRID);
      for (let c = 0; c < n && plants < MAX_PLANTS; c++) {
        const { mat, canopy } = floraAt(inputs.flora, c);
        const shape = floraShape(mat, canopy);
        if (shape.count === 0) continue;
        const cc = cellCentre(c, patch);
        const cols = floraColours(silicon, canopy);
        for (let k = 0; k < shape.count && plants < MAX_PLANTS; k++) {
          const x = cc.x + (hash01(c, k, 1) - 0.5) * cell * 0.9;
          const z = cc.z + (hash01(c, k, 2) - 0.5) * cell * 0.9;
          const h = shape.height * (0.7 + 0.6 * hash01(c, k, 3));
          const az = hash01(c, k, 4) * Math.PI * 2;
          p.set(x, inputs.terrain.height(x, z), z);
          plants++;
          if (silicon) {
            dir.set(Math.sin(0.12) * Math.cos(az), Math.cos(0.12), Math.sin(0.12) * Math.sin(az)).normalize();
            push(spikes, p, dir, h, 0.07 * h + 0.02, cols.stem);
            const tilt = Math.PI / 3; // branches leave the trunk at 60°
            const at = p.clone().addScaledVector(dir, h * 0.45);
            for (let b = 0; b < 2; b++) {
              const a2 = az + b * Math.PI + 0.5 * (hash01(c, k, 5) - 0.5);
              dir.set(Math.sin(tilt) * Math.cos(a2), Math.cos(tilt), Math.sin(tilt) * Math.sin(a2));
              push(spikes, at, dir, h * 0.55, 0.05 * h + 0.015, cols.tip);
            }
          } else {
            const seg = h / 3, curl = 0.3 + 0.3 * hash01(c, k, 6);
            const cur = p.clone();
            let phi = 0.05;
            for (let j = 0; j < 3; j++) {
              dir.set(Math.sin(phi) * Math.cos(az), Math.cos(phi), Math.sin(phi) * Math.sin(az)).normalize();
              push(stems, cur, dir, seg, 0.06 * h * (1 - 0.25 * j) + 0.015, cols.stem);
              cur.addScaledVector(dir, seg);
              phi += curl;
            }
            if (shape.cap > 0.02 || mat > 0.25) pushBall(caps, cur, 0.1 * h + 0.25 * shape.cap + 0.04, cols.tip);
          }
        }
      }
      part.plants = plants;
      for (const m of [stems, caps, spikes]) {
        m.instanceMatrix.needsUpdate = true;
        (m.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
    },
    dispose() {
      app.scene.remove(stems, caps, spikes);
      for (const m of [stems, caps, spikes]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
    },
  };
  return part;
}
