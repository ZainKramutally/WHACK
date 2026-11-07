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
  beadLayout, capsuleLayout, displayFactor, displayLength, nearestSphere, patchToWorld, type BeadLayout, type Vec3,
} from './layout';
import { creatureColour, type Tone } from './palette';

const CAP = 65536;                // beads per mesh
const GLOW_MIN = 0.12;            // plan.glow above this goes to the glow mesh
const FORGET_FRAMES = 180;        // drop cached plans for organisms unseen this long

interface Entry {
  layout: BeadLayout;
  lastSeen: number;
  // smoothed pose (snapshots arrive at 20 Hz)
  x: number; z: number; heading: number; init: boolean;
  glow: number; silicon: boolean; scale: number;
  /** Per-bead x, y, z, r, tone-index (stride 5), built once. */
  flat: Float32Array;
  /** Linear RGB per tone (5 × 3), built once from chemistry and diet. */
  rgb: Float32Array;
}

const tmpColour = new THREE.Color();
function bake(layout: BeadLayout, silicon: boolean, diet: number): { flat: Float32Array; rgb: Float32Array } {
  const flat = new Float32Array(layout.beads.length * 5);
  layout.beads.forEach((b, i) => { flat[i * 5] = b.x; flat[i * 5 + 1] = b.y; flat[i * 5 + 2] = b.z; flat[i * 5 + 3] = b.r; flat[i * 5 + 4] = b.tone; });
  const rgb = new Float32Array(15);
  for (let tone = 0; tone < 5; tone++) {
    tmpColour.setHex(creatureColour(silicon, diet, tone as Tone));
    rgb[tone * 3] = tmpColour.r; rgb[tone * 3 + 1] = tmpColour.g; rgb[tone * 3 + 2] = tmpColour.b;
  }
  return { flat, rgb };
}

export interface FaunaPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Nearest organism under a ray (world space, normalised direction), or null. */
  hit(origin: Vec3, dir: Vec3): { id: number; dist: number } | null;
  /** World position and bounding radius of an organism by id, if drawn. */
  locate(id: number): { x: number; y: number; z: number; radius: number } | null;
  /** Extra multiplier on top of the display-scale rule in layout.ts (default 1). Render-only illustration. */
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
  // Only radius (diagonal) and translation change per frame; the rest of each 4×4 is constant.
  const a = m.instanceMatrix.array as Float32Array;
  for (let i = 0; i < CAP; i++) a[i * 16 + 15] = 1;
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
  const MESHES = [round, faceted, glowMesh];
  let lastBirths: unknown = null;
  let frame = 0;
  // Skip the matrix rewrite once poses have settled: snapshots arrive at 20 Hz and smoothing converges in ~0.6 s.
  let lastBuf: Float32Array | null = null, lastRise = NaN, lastSea = NaN, lastBoost = NaN, settleUntil = 0, hasHover = false;
  const counts = [0, 0, 0]; // round, faceted, glow

  // Pick data, rebuilt every update.
  let pid = new Float64Array(1024), px = new Float32Array(1024), py = new Float32Array(1024), pz = new Float32Array(1024), pr = new Float32Array(1024);
  let pn = 0;

  const part: FaunaPart = {
    scaleBoost: 1,
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
            const layout = beadLayout(plan), silicon = plan.chemistry === 'silicon';
            entries.set(b.id, {
              layout, lastSeen: frame, x: 0, z: 0, heading: 0, init: false,
              glow: plan.glow, silicon, scale: plan.scale, ...bake(layout, silicon, plan.diet),
            });
          } catch { /* malformed plan: fall back to a capsule when the organism shows up */ }
        }
      }

      if (frame % 60 === 0) {
        for (const [id, e] of entries) if (frame - e.lastSeen > FORGET_FRAMES) entries.delete(id);
      }
      const buf = inputs.organisms;
      const changed =
        buf !== lastBuf || inputs.terrain.rise !== lastRise || inputs.seaLevel !== lastSea || part.scaleBoost !== lastBoost;
      if (changed) {
        lastBuf = buf; lastRise = inputs.terrain.rise; lastSea = inputs.seaLevel; lastBoost = part.scaleBoost;
        settleUntil = t + 0.7;
      } else if (t > settleUntil && !hasHover) {
        return;
      }
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
      counts[0] = counts[1] = counts[2] = 0;
      hasHover = false;

      for (let i = 0; i < n; i++) {
        const o = i * ORGANISM_STRIDE;
        if (buf[o + OrganismField.role] < 0.5) continue; // producers are drawn by flora.ts
        const id = buf[o + OrganismField.id];
        let e = entries.get(id);
        if (!e) {
          const size = buf[o + OrganismField.size] || 1;
          const siFrac = buf[o + OrganismField.compSi];
          const layout = capsuleLayout(0.15 * size * 2);
          e = {
            layout, lastSeen: frame, x: 0, z: 0, heading: 0, init: false,
            glow: 0, silicon: siFrac > 0.5, scale: 0.3 * size, ...bake(layout, siFrac > 0.5, buf[o + geneField('diet')]),
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
        const ground = inputs.terrain.height(e.x, e.z);
        const s = boost * displayFactor(e.scale);
        let y0 = ground;
        if (mode === LOCOMOTION.hover) hasHover = true;
        if (mode === LOCOMOTION.hover) y0 = ground + displayLength(e.scale) * boost * (0.9 + 0.25 * Math.sin(t * 1.3 + id));
        else if (mode === LOCOMOTION.swim && seaThere && ground < sea) y0 = ground + (sea - ground) * 0.35;

        const useGlow = e.glow > GLOW_MIN;
        const mi = useGlow ? 2 : e.silicon ? 1 : 0;
        const mesh = MESHES[mi];
        const cosH = Math.cos(e.heading), sinH = Math.sin(e.heading);
        const lay = e.layout;
        if (counts[mi] + lay.beads.length > CAP) continue;
        const arr = mesh.instanceMatrix.array as Float32Array;
        const carr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
        const glowK = useGlow ? 1 + 1.5 * e.glow : 1;
        const flat = e.flat, rgb = e.rgb, nb = lay.beads.length;
        for (let j = 0; j < nb; j++) {
          const f = j * 5;
          const lx = flat[f] * s, lz = flat[f + 2] * s;
          // Body x is forward; heading is measured in the patch (x, y) plane, and patch y is world z.
          const r = flat[f + 3] * s;
          const idx = counts[mi]++;
          const m = idx * 16;
          arr[m] = r; arr[m + 5] = r; arr[m + 10] = r;
          arr[m + 12] = e.x + lx * cosH - lz * sinH; arr[m + 13] = y0 + flat[f + 1] * s; arr[m + 14] = e.z + lx * sinH + lz * cosH;
          const c3 = idx * 3, t3 = flat[f + 4] * 3;
          carr[c3] = rgb[t3] * glowK; carr[c3 + 1] = rgb[t3 + 1] * glowK; carr[c3 + 2] = rgb[t3 + 2] * glowK;
        }
        pid[pn] = id; px[pn] = e.x; py[pn] = y0 + lay.centreY * s; pz[pn] = e.z; pr[pn] = Math.max(lay.radius * s, 0.5);
        pn++;
      }
      for (let m = 0; m < 3; m++) {
        MESHES[m].count = counts[m];
        MESHES[m].instanceMatrix.needsUpdate = true;
        (MESHES[m].instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
      part.count = pn;

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
