// Creatures from the organisms buffer, as bead bodies: one instanced sphere per bead, laid out from each organism's
// BodyPlan (births give plans by id; cached by id). Silicon is faceted (icosahedra, flat shaded) with rod limbs and
// 15° joints; carbon is round. Glowing creatures go in an unlit HDR mesh. Read-only: nothing here writes sim state.
//
// Motion (render-only): poses are interpolated between 20 Hz snapshots by id (with a short extrapolation cap), births
// and deaths fade over 0.3 s, and nearby creatures animate by locomotion mode: swimmers get a travelling spine wave,
// walkers an analytic 2-bone IK gait with planted feet, hover bodies a pulsing bell, sessile ones a gentle sway.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { ORGANISM_STRIDE, OrganismField, geneField, organismCount } from '../sim/organismLayout';
import { unpackBodyPlan } from '../sim/plan';
import { LOCOMOTION } from '../sim/develop';
import {
  beadLayout, capsuleLayout, displayFactor, displayLength, limbChain, nearestSphere, patchToWorld, type BeadLayout, type Vec3,
} from './layout';
import {
  bellPulse, fadeScale, gaitFoot, interpPose, limbPhaseOffset, swayOffset, swimWave,
} from './motion';
import { creatureColour, type Tone } from './palette';

const CAP = 65536;                // beads per mesh
const GLOW_MIN = 0.12;            // plan.glow above this goes to the glow mesh
const FORGET_FRAMES = 300;        // drop cached plans for organisms never seen this long
const FADE_SEC = 0.3;
const ANIM_RADIUS = 90;           // creatures within this many metres of the camera animate
const ANIM_MAX = 160;             // ... at most this many per frame (the rest hold their rest pose)

interface Entry {
  layout: BeadLayout;
  lastSeen: number;
  glow: number; silicon: boolean; scale: number;
  /** Rest pose, per bead x, y, z, r, tone-index (stride 5), built once. */
  flat: Float32Array;
  /** Linear RGB per tone (5 × 3), built once from chemistry and diet. */
  rgb: Float32Array;
  // body extents for the motion maths
  xmin: number; xspan: number; ymax: number;
  // snapshot interpolation: previous rendered pose → newest target, over dtSnap seconds from snapT
  init: boolean;
  px: number; pz: number; ph: number;
  cx: number; cz: number; ch: number;
  snapT: number; dtSnap: number;
  /** Rendered pose this frame. */
  x: number; z: number; h: number;
  /** Smoothed ground speed in m/s and the accumulated gait cycles. */
  speed: number; gait: number;
  /** True when the layout comes from a real BodyPlan (not the capsule fallback). */
  planned: boolean;
  seen: boolean; stamp: number; born: number; dieT: number; mode: number; id: number; diet: number;
}

const tmpColour = new THREE.Color();
function bake(layout: BeadLayout, silicon: boolean, diet: number): { flat: Float32Array; rgb: Float32Array; xmin: number; xspan: number; ymax: number } {
  const flat = new Float32Array(layout.beads.length * 5);
  let xmin = Infinity, xmax = -Infinity, ymax = 1e-6;
  layout.beads.forEach((b, i) => {
    flat[i * 5] = b.x; flat[i * 5 + 1] = b.y; flat[i * 5 + 2] = b.z; flat[i * 5 + 3] = b.r; flat[i * 5 + 4] = b.tone;
    if (i < layout.nBody) { xmin = Math.min(xmin, b.x); xmax = Math.max(xmax, b.x); }
    ymax = Math.max(ymax, b.y + b.r);
  });
  const rgb = new Float32Array(15);
  for (let tone = 0; tone < 5; tone++) {
    tmpColour.setHex(creatureColour(silicon, diet, tone as Tone));
    rgb[tone * 3] = tmpColour.r; rgb[tone * 3 + 1] = tmpColour.g; rgb[tone * 3 + 2] = tmpColour.b;
  }
  return { flat, rgb, xmin, xspan: Math.max(1e-6, xmax - xmin), ymax };
}

export interface FaunaPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Nearest organism under a ray (world space, normalised direction), or null. */
  hit(origin: Vec3, dir: Vec3): { id: number; dist: number } | null;
  /** Cached bead layout, chemistry and diet of an organism by id (from its BodyPlan), if known. */
  layoutOf(id: number): { layout: BeadLayout; silicon: boolean; diet: number } | null;
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
  const dying: Entry[] = [];
  let lastBirths: unknown = null;
  let frame = 0;
  let lastBuf: Float32Array | null = null, snapId = 0, lastSnapT = -1;
  const counts = [0, 0, 0]; // round, faceted, glow
  const scratch = new Float32Array(64 * 5);  // animated bead pose, same layout as Entry.flat
  const limbOut: number[] = [];
  const camPos = app.camera.position;

  // Pick data, rebuilt every update.
  let pid = new Float64Array(1024), px = new Float32Array(1024), py = new Float32Array(1024), pz = new Float32Array(1024), pr = new Float32Array(1024);
  let pn = 0;

  function makeEntry(layout: BeadLayout, silicon: boolean, diet: number, glow: number, scale: number, id: number, planned = false): Entry {
    return {
      layout, lastSeen: frame, glow, silicon, scale, ...bake(layout, silicon, diet),
      init: false, px: 0, pz: 0, ph: 0, cx: 0, cz: 0, ch: 0, snapT: 0, dtSnap: 0.05, x: 0, z: 0, h: 0,
      speed: 0, gait: 0, planned, seen: false, stamp: 0, born: 0, dieT: -1, mode: 0, id, diet,
    };
  }

  /** Fill `out` (stride 5) with this creature's animated pose; returns the bead count. */
  function animate(
    e: Entry, t: number, s: number, mode: number, heightAt: (x: number, z: number) => number,
    y0: number, cosH: number, sinH: number,
  ): number {
    const lay = e.layout, src = e.flat, nb = lay.beads.length, nBody = lay.nBody;
    const out = scratch;
    const moving = Math.min(1, e.speed / (0.12 * displayLength(e.scale))); // 0 idle … 1 at 0.12 body lengths per second
    // Body beads: copy, then bend by locomotion mode.
    for (let i = 0; i < nBody; i++) {
      const f = i * 5;
      let x = src[f], y = src[f + 1], z = src[f + 2], r = src[f + 3];
      if (mode === LOCOMOTION.swim) {
        const xn = (x - e.xmin) / e.xspan;
        z += swimWave(xn, t, 0.1 * e.xspan * (0.35 + 0.65 * moving));
      } else if (mode === LOCOMOTION.hover) {
        const p = bellPulse(t, e.id);
        const q = 1 + (p - 1) * 0.6;
        x *= q; z *= q; r *= p;
        y = y * (2 - p);
      } else if (mode === LOCOMOTION.sessile) {
        const hn = Math.min(1, y / e.ymax);
        const off = swayOffset(hn, t, e.id, 0.08 * e.xspan);
        z += off;
      }
      out[f] = x; out[f + 1] = y; out[f + 2] = z; out[f + 3] = r; out[f + 4] = src[f + 4];
    }
    // Limbs.
    if (lay.limbs.length > 0) {
      const walking = mode === LOCOMOTION.walk;
      const amp = walking ? moving : 0;
      for (const rig of lay.limbs) {
        let fx = rig.hip.x, fy = rig.r, fz = rig.hip.z + rig.side * rig.restOut;
        if (walking) {
          const g = gaitFoot(e.gait + limbPhaseOffset(rig.pair, rig.side), lay.stride * amp, 0.35 * rig.len1 * amp);
          fx += g.dx;
          // Plant the foot on the terrain under its world position.
          const wx = e.x + (fx * cosH - fz * sinH) * s, wz = e.z + (fx * sinH + fz * cosH) * s;
          fy = rig.r + g.dy + (heightAt(wx, wz) - y0) / s;
        }
        limbOut.length = 0;
        limbChain(rig, fx, fy, fz, limbOut);
        let q = rig.first * 5;
        for (let k = 0; k < limbOut.length; k += 4, q += 5) {
          out[q] = limbOut[k]; out[q + 1] = limbOut[k + 1]; out[q + 2] = limbOut[k + 2]; out[q + 3] = limbOut[k + 3]; out[q + 4] = 3;
        }
      }
    }
    return nb;
  }

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
            entries.set(b.id, makeEntry(beadLayout(plan), plan.chemistry === 'silicon', plan.diet, plan.glow, plan.scale, b.id, true));
          } catch { /* malformed plan: fall back to a capsule when the organism shows up */ }
        }
      }
      if (frame % 60 === 0) {
        for (const [id, e] of entries) if (!e.seen && frame - e.lastSeen > FORGET_FRAMES) entries.delete(id);
      }

      const buf = inputs.organisms;
      const snapshot = buf !== lastBuf;
      let dtSnap = 0.05;
      if (snapshot) {
        lastBuf = buf; snapId++;
        if (lastSnapT >= 0) dtSnap = Math.min(0.25, Math.max(0.03, t - lastSnapT));
        lastSnapT = t;
      }
      const n = organismCount(buf);
      if (px.length < n) {
        const m = Math.max(n, px.length * 2);
        pid = new Float64Array(m); px = new Float32Array(m); py = new Float32Array(m); pz = new Float32Array(m); pr = new Float32Array(m);
      }
      pn = 0;
      const boost = part.scaleBoost;
      const sea = inputs.seaLevel;
      const seaThere = (inputs.stats.seaCover ?? 1) > 0.005;
      const heightAt = inputs.terrain.height;
      counts[0] = counts[1] = counts[2] = 0;
      let animated = 0;

      function draw(e: Entry, alpha: number, mode: number, live: boolean) {
        const ground = heightAt(e.x, e.z);
        const s = boost * displayFactor(e.scale) * alpha;
        if (s <= 0) return;
        let y0 = ground;
        if (mode === LOCOMOTION.hover) y0 = ground + displayLength(e.scale) * boost * (0.9 + 0.25 * Math.sin(t * 1.3 + e.id)) * alpha;
        else if (mode === LOCOMOTION.swim && seaThere && ground < sea) y0 = ground + (sea - ground) * 0.35;

        const useGlow = e.glow > GLOW_MIN;
        const mi = useGlow ? 2 : e.silicon ? 1 : 0;
        const lay = e.layout;
        if (counts[mi] + lay.beads.length > CAP) return;
        const mesh = MESHES[mi];
        const arr = mesh.instanceMatrix.array as Float32Array;
        const carr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
        const glowK = useGlow ? 1 + 1.5 * e.glow : 1;
        const cosH = Math.cos(e.h), sinH = Math.sin(e.h);
        let flat = e.flat;
        const dx = camPos.x - e.x, dz = camPos.z - e.z;
        if (animated < ANIM_MAX && dx * dx + dz * dz < ANIM_RADIUS * ANIM_RADIUS) {
          animated++;
          animate(e, t, boost * displayFactor(e.scale), mode, heightAt, y0, cosH, sinH);
          flat = scratch;
        }
        const rgb = e.rgb, nb = lay.beads.length;
        for (let j = 0; j < nb; j++) {
          const f = j * 5;
          const lx = flat[f] * s, lz = flat[f + 2] * s;
          const r = flat[f + 3] * s;
          const idx = counts[mi]++;
          const m = idx * 16;
          arr[m] = r; arr[m + 5] = r; arr[m + 10] = r;
          // Body x is forward; heading is measured in the patch (x, y) plane, and patch y is world z.
          arr[m + 12] = e.x + lx * cosH - lz * sinH; arr[m + 13] = y0 + flat[f + 1] * s; arr[m + 14] = e.z + lx * sinH + lz * cosH;
          const c3 = idx * 3, t3 = flat[f + 4] * 3;
          carr[c3] = rgb[t3] * glowK; carr[c3 + 1] = rgb[t3 + 1] * glowK; carr[c3 + 2] = rgb[t3 + 2] * glowK;
        }
        if (live) {
          pid[pn] = e.id; px[pn] = e.x; py[pn] = y0 + lay.centreY * s; pz[pn] = e.z; pr[pn] = Math.max(lay.radius * s, 0.5);
          pn++;
        }
      }

      for (let i = 0; i < n; i++) {
        const o = i * ORGANISM_STRIDE;
        if (buf[o + OrganismField.role] < 0.5) continue; // producers are drawn by flora.ts
        const id = buf[o + OrganismField.id];
        let e = entries.get(id);
        if (!e) {
          const size = buf[o + OrganismField.size] || 1;
          const siFrac = buf[o + OrganismField.compSi];
          e = makeEntry(capsuleLayout(0.15 * size * 2), siFrac > 0.5, buf[o + geneField('diet')], 0, 0.3 * size, id);
          entries.set(id, e);
        }
        e.lastSeen = frame; e.stamp = snapId; e.dieT = -1;
        if (!e.seen) { e.seen = true; e.born = t; }
        const mode = buf[o + OrganismField.mode];
        e.mode = mode;
        if (snapshot) {
          const tx = patchToWorld(buf[o + OrganismField.x], patch), tz = patchToWorld(buf[o + OrganismField.y], patch);
          const th = buf[o + OrganismField.heading];
          if (!e.init) {
            e.init = true; e.px = e.cx = e.x = tx; e.pz = e.cz = e.z = tz; e.ph = e.ch = e.h = th;
          } else {
            // Continue from where the creature is drawn now, so a new snapshot never pops.
            const sp = Math.hypot(tx - e.cx, tz - e.cz) / dtSnap;
            e.speed += (sp - e.speed) * 0.5;
            e.px = e.x; e.pz = e.z; e.ph = e.h;
            e.cx = tx; e.cz = tz; e.ch = th;
          }
          e.snapT = t; e.dtSnap = dtSnap;
        }
        const pose = interpPose({ x: e.px, z: e.pz, h: e.ph }, { x: e.cx, z: e.cz, h: e.ch }, (t - e.snapT) / e.dtSnap);
        e.x = pose.x; e.z = pose.z; e.h = pose.h;
        // Gait advances with distance: cadence follows speed relative to body length.
        const rel = e.speed / displayLength(e.scale);
        e.gait += dt * Math.min(3, 1.2 + 6 * rel);
        draw(e, fadeScale(t - e.born, FADE_SEC), mode, true);
      }

      // Deaths: anything seen before that is missing from the newest snapshot fades out where it stood.
      if (snapshot) {
        for (const e of entries.values()) {
          if (e.seen && e.stamp !== snapId && e.dieT < 0) { e.dieT = t; dying.push(e); }
        }
      }
      for (let i = dying.length - 1; i >= 0; i--) {
        const e = dying[i];
        if (e.dieT < 0) { dying.splice(i, 1); continue; } // came back (should not happen: ids are never reused)
        const a = 1 - fadeScale(t - e.dieT, FADE_SEC);
        if (a <= 0) { dying.splice(i, 1); entries.delete(e.id); continue; }
        draw(e, a, e.mode, false);
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
    layoutOf(id) {
      const e = entries.get(id);
      return e && e.planned ? { layout: e.layout, silicon: e.silicon, diet: e.diet } : null;
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
