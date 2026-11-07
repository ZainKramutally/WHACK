// Creatures from the organisms buffer, as bead bodies: one instanced sphere per bead, laid out from each organism's
// BodyPlan (births give plans by id; cached by id, dropped after the organism disappears). Silicon is faceted
// (icosahedra, flat shaded) with rod limbs; carbon is round. Glowing creatures go in an unlit HDR mesh.
// Read-only: nothing here writes sim state.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { ORGANISM_STRIDE, OrganismField, geneField, organismCount } from '../sim/organismLayout';
import { unpackBodyPlan } from '../sim/plan';
import { LOCOMOTION } from '../sim/develop';
import {
  beadLayout, capsuleLayout, nearestSphere, patchToWorld, type BeadLayout, type Vec3,
} from './layout';
import { creatureColour, type Tone } from './palette';

const CAP = 40000;                // beads per mesh
const GLOW_MIN = 0.12;            // plan.glow above this goes to the glow mesh
const FORGET_FRAMES = 180;        // drop cached plans for organisms unseen this long

interface Entry {
  layout: BeadLayout;
  lastSeen: number;
  // smoothed pose (snapshots arrive at 20 Hz)
  x: number; z: number; heading: number; init: boolean;
  glow: number; silicon: boolean; scale: number;
}

export interface FaunaPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Nearest organism under a ray (world space, normalised direction), or null. */
  hit(origin: Vec3, dir: Vec3): { id: number; dist: number } | null;
  /** World position and bounding radius of an organism by id, if drawn. */
  locate(id: number): { x: number; y: number; z: number; radius: number } | null;
  /** Visual scale multiplier on body size (readability illustration; default 3). */
  scaleBoost: number;
  count: number;
  dispose(): void;
}

function makeMesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, CAP);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

export function createFauna(app: App): FaunaPart {
  const round = makeMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }));
  const faceted = makeMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.1, flatShading: true }),
  );
  const glowMesh = makeMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicNodeMaterial({ fog: true }));
  app.scene.add(round, faceted, glowMesh);

  const entries = new Map<number, Entry>();
  let lastBirths: unknown = null;
  let frame = 0;

  // Pick data, rebuilt every update.
  let pid = new Float64Array(1024), px = new Float32Array(1024), py = new Float32Array(1024), pz = new Float32Array(1024), pr = new Float32Array(1024);
  let pn = 0;

  const part: FaunaPart = {
    scaleBoost: 3,
    count: 0,
    update(dt, t, inputs, patch) {
      frame++;
      // Births: plans arrive once per snapshot; cache by id.
      if (inputs.births !== lastBirths) {
        lastBirths = inputs.births;
        for (const b of inputs.births) {
          if (entries.has(b.id)) continue;
          try {
            const plan = unpackBodyPlan(b.plan);
            entries.set(b.id, {
              layout: beadLayout(plan), lastSeen: frame, x: 0, z: 0, heading: 0, init: false,
              glow: plan.glow, silicon: plan.chemistry === 'silicon', scale: plan.scale,
            });
          } catch { /* malformed plan: fall back to a capsule when the organism shows up */ }
        }
      }

      const buf = inputs.organisms;
      const n = organismCount(buf);
      if (px.length < n) {
        const m = Math.max(n, px.length * 2);
        pid = new Float64Array(m); px = new Float32Array(m); py = new Float32Array(m); pz = new Float32Array(m); pr = new Float32Array(m);
      }
      pn = 0;
      const k = 1 - Math.exp(-12 * dt);
      const boost = part.scaleBoost;
      const sea = inputs.seaLevel;
      const seaThere = (inputs.stats.seaCover ?? 1) > 0.005;
      const counts = [0, 0, 0]; // round, faceted, glow
      const meshes = [round, faceted, glowMesh];
      const col = new THREE.Color();

      for (let i = 0; i < n; i++) {
        const o = i * ORGANISM_STRIDE;
        if (buf[o + OrganismField.role] < 0.5) continue; // producers are drawn by flora.ts
        const id = buf[o + OrganismField.id];
        let e = entries.get(id);
        if (!e) {
          const size = buf[o + OrganismField.size] || 1;
          const siFrac = buf[o + OrganismField.compSi];
          e = {
            layout: capsuleLayout(0.15 * size * 2), lastSeen: frame, x: 0, z: 0, heading: 0, init: false,
            glow: 0, silicon: siFrac > 0.5, scale: 0.3 * size,
          };
          entries.set(id, e);
        }
        e.lastSeen = frame;
        const tx = patchToWorld(buf[o + OrganismField.x], patch);
        const tz = patchToWorld(buf[o + OrganismField.y], patch);
        const th = buf[o + OrganismField.heading];
        if (!e.init) { e.x = tx; e.z = tz; e.heading = th; e.init = true; }
        else {
          e.x += (tx - e.x) * k; e.z += (tz - e.z) * k;
          let dh = th - e.heading;
          dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          e.heading += dh * k;
        }

        const mode = buf[o + OrganismField.mode];
        const diet = buf[o + geneField('diet')];
        const ground = inputs.terrain.height(e.x, e.z);
        const s = boost;
        let y0 = ground;
        if (mode === LOCOMOTION.hover) y0 = ground + e.scale * s * (0.9 + 0.25 * Math.sin(t * 1.3 + id));
        else if (mode === LOCOMOTION.swim && seaThere && ground < sea) y0 = ground + (sea - ground) * 0.35;

        const useGlow = e.glow > GLOW_MIN;
        const mi = useGlow ? 2 : e.silicon ? 1 : 0;
        const mesh = meshes[mi];
        const cosH = Math.cos(e.heading), sinH = Math.sin(e.heading);
        const lay = e.layout;
        if (counts[mi] + lay.beads.length > CAP) continue;
        const arr = mesh.instanceMatrix.array as Float32Array;
        const carr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
        const glowK = useGlow ? 1 + 1.5 * e.glow : 1;
        for (const b of lay.beads) {
          const lx = b.x * s, lz = b.z * s;
          // Body x is forward; heading is measured in the patch (x, y) plane, and patch y is world z.
          const wx = e.x + lx * cosH - lz * sinH;
          const wz = e.z + lx * sinH + lz * cosH;
          const r = b.r * s;
          const idx = counts[mi]++;
          const m = idx * 16;
          arr[m] = r; arr[m + 1] = 0; arr[m + 2] = 0; arr[m + 3] = 0;
          arr[m + 4] = 0; arr[m + 5] = r; arr[m + 6] = 0; arr[m + 7] = 0;
          arr[m + 8] = 0; arr[m + 9] = 0; arr[m + 10] = r; arr[m + 11] = 0;
          arr[m + 12] = wx; arr[m + 13] = y0 + b.y * s; arr[m + 14] = wz; arr[m + 15] = 1;
          col.setHex(creatureColour(e.silicon, diet, b.tone as Tone));
          const c3 = idx * 3;
          carr[c3] = col.r * glowK; carr[c3 + 1] = col.g * glowK; carr[c3 + 2] = col.b * glowK;
        }
        pid[pn] = id; px[pn] = e.x; py[pn] = y0 + lay.centreY * s; pz[pn] = e.z; pr[pn] = Math.max(lay.radius * s, 0.5);
        pn++;
      }
      for (let m = 0; m < 3; m++) {
        meshes[m].count = counts[m];
        meshes[m].instanceMatrix.needsUpdate = true;
        (meshes[m].instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
      part.count = pn;

      if (frame % 60 === 0) {
        for (const [id, e] of entries) if (frame - e.lastSeen > FORGET_FRAMES) entries.delete(id);
      }
    },
    hit(origin, dir) {
      return nearestSphere(origin, dir, pid, px, py, pz, pr, pn);
    },
    locate(id) {
      for (let i = 0; i < pn; i++) if (pid[i] === id) return { x: px[i], y: py[i], z: pz[i], radius: pr[i] };
      return null;
    },
    dispose() {
      app.scene.remove(round, faceted, glowMesh);
      for (const m of [round, faceted, glowMesh]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
      entries.clear();
    },
  };
  return part;
}
