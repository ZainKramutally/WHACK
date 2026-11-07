// Plants from the per-cell flora grid ([mat, canopy] per cell, 64² cells). Density and height follow biomass; a cell
// with no biomass draws nothing (so nothing appears before life). Carbon: curling stems with caps. Silicon: crystal
// spikes with side branches at 60°. Chemistry comes from the world's body composition. Rebuilt a few times a second.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { FLORA_GRID, cellCentre, floraAt, floraShape, hash01 } from './layout';
import { floraColours } from './palette';
import { floraForm } from './floraForm';

const STEM_CAP = 30000, CAP_CAP = 12000, SPIKE_CAP = 40000, CUP_CAP = 12000, DOME_CAP = 12000, LAMP_CAP = 20000, MAX_PLANTS = 10000;
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
  // Lantern cups: open-topped hemispheres. Domes: translucent jellyshroom half-spheres. Lamps: small unlit HDR spheres
  // for glow (from darkness), inside cups and domes and at silicon tips.
  const cups = inst(
    new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardNodeMaterial({ roughness: 0.5, side: THREE.DoubleSide }),
    CUP_CAP,
  );
  const domeMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.15, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  domeMat.depthWrite = false;
  const domes = inst(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, DOME_CAP);
  const lamps = inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicNodeMaterial({ fog: true }), LAMP_CAP);
  app.scene.add(stems, caps, spikes, cups, domes, lamps);
  const ALL = [stems, caps, spikes, cups, domes, lamps];

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
  function pushBall(mesh: THREE.InstancedMesh, at: THREE.Vector3, rad: number, hex: number, squash = 1, hdr = 1) {
    const i = mesh.count;
    if (i >= mesh.instanceMatrix.count) return;
    m4.makeScale(rad, rad * squash, rad).setPosition(at);
    m4.toArray(mesh.instanceMatrix.array as Float32Array, i * 16);
    colour.setHex(hex).multiplyScalar(hdr).toArray((mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array, i * 3);
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

      for (const m of ALL) m.count = 0;
      let plants = 0;
      const silicon = inputs.world.composition.si > 0.5;
      const cell = patch / FLORA_GRID;
      const n = Math.min(inputs.flora.length / 2, FLORA_GRID * FLORA_GRID);
      for (let c = 0; c < n && plants < MAX_PLANTS; c++) {
        const { mat, canopy } = floraAt(inputs.flora, c);
        const shape = floraShape(mat, canopy);
        const form = shape.count === 0 ? null : floraForm(c, inputs);
        if (!form) continue;
        const cc = cellCentre(c, patch);
        const cols = floraColours(silicon, canopy);
        const glowHex = silicon ? 0xbfe8ff : 0xfff2a0;
        const hdr = 1 + 2.5 * form.glow;
        for (let k = 0; k < shape.count && plants < MAX_PLANTS; k++) {
          const x = cc.x + (hash01(c, k, 1) - 0.5) * cell * 0.9;
          const z = cc.z + (hash01(c, k, 2) - 0.5) * cell * 0.9;
          const h = shape.height * form.heightScale * (0.7 + 0.6 * hash01(c, k, 3));
          const az = hash01(c, k, 4) * Math.PI * 2;
          p.set(x, inputs.terrain.height(x, z), z);
          plants++;
          switch (form.species) {
            case 'spire': {
              // Straight trunk; branches leave it at form.branchDeg.
              dir.set(Math.sin(0.12) * Math.cos(az), Math.cos(0.12), Math.sin(0.12) * Math.sin(az)).normalize();
              push(spikes, p, dir, h, 0.07 * h + 0.02, cols.stem);
              const tilt = (form.branchDeg * Math.PI) / 180;
              const trunk = dir.clone();
              const at = p.clone().addScaledVector(trunk, h * 0.45);
              for (let b = 0; b < form.branches; b++) {
                const a2 = az + (b * 2 * Math.PI) / form.branches + 0.5 * (hash01(c, k, 5) - 0.5);
                dir.set(Math.sin(tilt) * Math.cos(a2), Math.cos(tilt), Math.sin(tilt) * Math.sin(a2));
                push(spikes, at, dir, h * 0.55, 0.05 * h + 0.015, cols.tip);
                if (form.glow > 0) pushBall(lamps, at.clone().addScaledVector(dir, h * 0.55), 0.04 * h + 0.03, glowHex, 1, hdr);
              }
              if (form.glow > 0) pushBall(lamps, at.clone().addScaledVector(trunk, h * 0.55), 0.05 * h + 0.03, glowHex, 1, hdr);
              break;
            }
            case 'crust': {
              // Low faceted fans: wide, short crystals lying close to the ground.
              for (let b = 0; b < 3; b++) {
                const a2 = az + (b * 2 * Math.PI) / 3;
                dir.set(Math.sin(1.0) * Math.cos(a2), Math.cos(1.0), Math.sin(1.0) * Math.sin(a2)).normalize();
                push(spikes, p, dir, h * 0.5, 0.09 * h + 0.03, b === 0 ? cols.stem : cols.tip);
              }
              if (form.glow > 0) pushBall(lamps, p.clone().setY(p.y + 0.1 * h), 0.04 * h + 0.03, glowHex, 1, hdr);
              break;
            }
            case 'dome': {
              // Translucent jellyshroom dome sitting on the ground.
              const r = form.capScale * h + 0.3;
              pushBall(domes, p, r, cols.tip, 0.8);
              if (form.glow > 0) pushBall(lamps, p.clone().setY(p.y + 0.25 * r), 0.3 * r, glowHex, 1, hdr);
              break;
            }
            default: {
              // Carbon stems curl by form.curl per segment (tuft: short and capless).
              const stemH = form.species === 'tuft' ? h * 0.6 : h;
              const seg = stemH / 3, curl = form.curl * (0.7 + 0.6 * hash01(c, k, 6));
              const cur = p.clone();
              let phi = 0.05;
              for (let j = 0; j < 3; j++) {
                dir.set(Math.sin(phi) * Math.cos(az), Math.cos(phi), Math.sin(phi) * Math.sin(az)).normalize();
                push(stems, cur, dir, seg, 0.06 * stemH * (1 - 0.25 * j) + 0.015, cols.stem);
                cur.addScaledVector(dir, seg);
                phi += curl;
              }
              const r = form.capScale * stemH + 0.25 * shape.cap + 0.04;
              if (form.species === 'capped') pushBall(caps, cur, r, cols.tip);
              else if (form.species === 'cup') {
                pushBall(cups, cur, r * 1.3, cols.tip);
                if (form.glow > 0) pushBall(lamps, cur.clone().setY(cur.y + 0.15 * r), 0.45 * r, glowHex, 1, hdr);
              }
            }
          }
        }
      }
      part.plants = plants;
      for (const m of ALL) {
        m.instanceMatrix.needsUpdate = true;
        (m.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
    },
    dispose() {
      app.scene.remove(...ALL);
      for (const m of ALL) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
    },
  };
  return part;
}
