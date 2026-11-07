// Creatures from the organisms buffer, laid out from each organism's BodyPlan (births give plans by id; cached by id).
// The two chemistries are different ARCHITECTURES, not skins. Carbon (axial) is bead bodies: one instanced round sphere
// per bead, a curling head-to-tail chain with tentacle legs. Silicon (radial) is prisms: an n-gon faceted hub of stacked
// tiers, straight two-bone rod arms with 15° joints, ceramic tiles, apex spires and dot eyes at the arm tips, drawn
// with instanced prisms (one mesh per hub symmetry plus a hex-prism mesh). Glowing creatures put their eyes in an
// unlit HDR mesh. Read-only: nothing here writes sim state.
//
// Motion (render-only): poses are interpolated between 20 Hz snapshots by id (with a short extrapolation cap), births
// and deaths fade over 0.3 s, and nearby creatures animate by locomotion mode. Axial: swimmers get a travelling spine
// wave, walkers an analytic 2-bone IK gait with planted feet, hover bodies a pulsing bell, sessile ones a gentle sway.
// Radial: walkers tripod-step on their arms (planted feet), swimmers roll like a wheel, hover bodies pulse as a bell
// with arms hanging down, and sessile ones stay rooted as a still crystal colony with prongs raised.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { ORGANISM_STRIDE, OrganismField, geneField, organismCount } from '../sim/organismLayout';
import { unpackBodyPlan } from '../sim/plan';
import { LOCOMOTION } from '../sim/develop';
import {
  armRods, beadLayout, capsuleLayout, displayFactor, displayLength, limbChain, raySphere, raySphereEntry, patchToWorld, type BeadLayout, type Vec3,
} from './layout';
import {
  armStance, bellPulse, fadeScale, gaitFoot, interpPose, limbPhaseOffset, rollAngle, swayOffset, swimWave,
} from './motion';
import { creatureColour, type Tone } from './palette';

const CAP = 65536;                // beads per mesh
const HUB_CAP = 8192;             // hub tiers per symmetry mesh
const HEX_CAP = 40960;            // arm, tile and spire prisms
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
  /** Radial bodies: rest rods (ax, ay, az, bx, by, bz, r; stride 7) and their tones. */
  rods: Float32Array; rodTone: Uint8Array;
  /** Accumulated roll angle (radians) of a rolling radial body. */
  roll: number;
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
  /** Radial bodies: arms are walking arms (the plan has leg pairs); otherwise they are short spikes. */
  legged: boolean;
  seen: boolean; stamp: number; born: number; dieT: number; mode: number; id: number; diet: number;
}

const tmpColour = new THREE.Color();
function bake(layout: BeadLayout, silicon: boolean, diet: number): { flat: Float32Array; rgb: Float32Array; rods: Float32Array; rodTone: Uint8Array; xmin: number; xspan: number; ymax: number } {
  const rl = layout.radial?.rods ?? [];
  const rods = new Float32Array(rl.length * 7), rodTone = new Uint8Array(rl.length);
  rl.forEach((r, i) => {
    rods.set([r.ax, r.ay, r.az, r.bx, r.by, r.bz, r.r], i * 7); rodTone[i] = r.tone;
  });
  const flat = new Float32Array(layout.beads.length * 5);
  let xmin = Infinity, xmax = -Infinity, ymax = 1e-6;
  layout.beads.forEach((b, i) => {
    flat[i * 5] = b.x; flat[i * 5 + 1] = b.y; flat[i * 5 + 2] = b.z; flat[i * 5 + 3] = b.r; flat[i * 5 + 4] = b.tone;
    if (i < layout.nBody) { xmin = Math.min(xmin, b.x); xmax = Math.max(xmax, b.x); }
    ymax = Math.max(ymax, b.y + b.r);
  });
  for (const r of rl) ymax = Math.max(ymax, r.ay + r.r, r.by + r.r);
  const rgb = new Float32Array(15);
  for (let tone = 0; tone < 5; tone++) {
    tmpColour.setHex(creatureColour(silicon, diet, tone as Tone));
    rgb[tone * 3] = tmpColour.r; rgb[tone * 3 + 1] = tmpColour.g; rgb[tone * 3 + 2] = tmpColour.b;
  }
  return { flat, rgb, rods, rodTone, xmin, xspan: Math.max(1e-6, xmax - xmin), ymax };
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

function makeRodMesh(sides: number, cap: number): THREE.InstancedMesh {
  // Cylinder axis is Y; rotate the prism so a vertex points along local +X (arms radiate from the vertices).
  const geo = new THREE.CylinderGeometry(1, 1, 1, sides, 1);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.15, flatShading: true }), cap);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  const a = m.instanceMatrix.array as Float32Array;
  for (let i = 0; i < cap; i++) a[i * 16 + 15] = 1;
  return m;
}

export function createFauna(app: App): FaunaPart {
  const round = makeMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }));
  const faceted = makeMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.1, flatShading: true }),
  );
  const glowMesh = makeMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicNodeMaterial({ fog: true }));
  const hub3 = makeRodMesh(3, HUB_CAP), hub4 = makeRodMesh(4, HUB_CAP), hub6 = makeRodMesh(6, HUB_CAP), hex = makeRodMesh(6, HEX_CAP);
  app.scene.add(round, faceted, glowMesh, hub3, hub4, hub6, hex);

  const entries = new Map<number, Entry>();
  const MESHES = [round, faceted, glowMesh, hub3, hub4, hub6, hex];
  const HEX = 6; // index of the hex-prism mesh in MESHES
  const dying: Entry[] = [];
  let lastBirths: unknown = null;
  let frame = 0;
  let lastBuf: Float32Array | null = null, snapId = 0, lastSnapT = -1;
  const counts = [0, 0, 0, 0, 0, 0, 0]; // round, faceted, glow, hub3, hub4, hub6, hex
  const scratch = new Float32Array(64 * 5);  // animated bead pose, same layout as Entry.flat
  const rodScratch = new Float32Array(48 * 7); // animated rods (radial bodies), stride 7
  const armOut: number[] = [];
  const limbOut: number[] = [];
  const camPos = app.camera.position;

  // Pick data, rebuilt every update.
  let pid = new Float64Array(1024), px = new Float32Array(1024), py = new Float32Array(1024), pz = new Float32Array(1024), pr = new Float32Array(1024);
  let pn = 0;
  // Per live creature for the precise pick: the entry, its draw scale and ground base.
  let pe: Entry[] = [], pS = new Float32Array(1024), pY0 = new Float32Array(1024);

  function makeEntry(layout: BeadLayout, silicon: boolean, diet: number, glow: number, scale: number, id: number, planned = false): Entry {
    return {
      layout, lastSeen: frame, glow, silicon, scale, roll: 0, ...bake(layout, silicon, diet),
      init: false, px: 0, pz: 0, ph: 0, cx: 0, cz: 0, ch: 0, snapT: 0, dtSnap: 0.05, x: 0, z: 0, h: 0,
      speed: 0, gait: 0, planned, legged: false, seen: false, stamp: 0, born: 0, dieT: -1, mode: 0, id, diet,
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

  /** Radial bodies: fill rodScratch (stride 7) and the arm-tip eye beads in `scratch` (stride 5) for this pose. */
  function animateRadial(
    e: Entry, t: number, s: number, mode: number, heightAt: (x: number, z: number) => number,
    y0: number, cosH: number, sinH: number,
  ): void {
    const lay = e.layout, R = lay.radial!;
    const src = e.rods, out = rodScratch, eyes = scratch;
    const moving = Math.min(1, e.speed / (0.12 * displayLength(e.scale)));
    const pulse = mode === LOCOMOTION.hover ? bellPulse(t, e.id) : 1;
    for (let i = 0; i < R.nHubRods * 7; i++) out[i] = src[i];
    if (pulse !== 1) for (let i = 0; i < R.nTiers; i++) out[i * 7 + 6] *= pulse;
    const stance = mode === LOCOMOTION.hover ? 'bell' : mode === LOCOMOTION.sessile ? 'crystal' : 'spoke';
    for (const rig of R.arms) {
      let fx: number, fy: number, fz: number;
      if (mode === LOCOMOTION.walk && e.legged) {
        const g = gaitFoot(e.gait + rig.phase, lay.stride * moving, 0.35 * rig.len1 * moving);
        fx = rig.hip.x + rig.dirX * rig.restOut + g.dx;
        fz = rig.hip.z + rig.dirZ * rig.restOut;
        const wx = e.x + (fx * cosH - fz * sinH) * s, wz = e.z + (fx * sinH + fz * cosH) * s;
        fy = rig.r + g.dy + (heightAt(wx, wz) - y0) / s;
      } else if (stance === 'spoke') {
        fx = rig.hip.x + rig.dirX * rig.restOut; fz = rig.hip.z + rig.dirZ * rig.restOut; fy = rig.restFootY;
      } else {
        const st = armStance(stance, rig.len1 + rig.len2, t, e.id);
        fx = rig.hip.x + rig.dirX * st.out; fz = rig.hip.z + rig.dirZ * st.out; fy = rig.hip.y + st.up;
      }
      armOut.length = 0;
      armRods(rig, fx, fy, fz, armOut);
      const o = rig.firstRod * 7;
      for (let k = 0; k < 14; k++) out[o + k] = armOut[k];
      const tx = armOut[10], ty = armOut[11], tz = armOut[12];
      for (let k = 0; k < rig.eyeN; k++) {
        const q = (rig.eyeFirst + k) * 5;
        eyes[q] = tx + rig.eyeDX[k]; eyes[q + 1] = ty + rig.eyeR * 0.6; eyes[q + 2] = tz + rig.eyeDZ[k]; eyes[q + 3] = rig.eyeR; eyes[q + 4] = 1;
      }
    }
    if (mode === LOCOMOTION.swim && e.roll !== 0) {
      // A rolling hub turns like a wheel about its lateral axis, top moving forward.
      const c = Math.cos(e.roll), sn = Math.sin(e.roll), py = R.pivotY;
      const rot = (a: Float32Array, i: number) => {
        const x = a[i], y = a[i + 1] - py;
        a[i] = x * c + y * sn; a[i + 1] = py - x * sn + y * c;
      };
      for (let r = 0; r < R.rods.length; r++) { rot(out, r * 7); rot(out, r * 7 + 3); }
      for (let k = 0; k < lay.beads.length; k++) rot(eyes, k * 5);
    }
  }

  function emitRod(
    mesh: THREE.InstancedMesh, idx: number, rs: Float32Array, i: number, s: number, ex: number, ey: number, ez: number,
    cosH: number, sinH: number, rgb: Float32Array, tone: number, k: number,
  ): void {
    const o = i * 7;
    const ax = rs[o] * s, ay = rs[o + 1] * s, az = rs[o + 2] * s, bx = rs[o + 3] * s, by = rs[o + 4] * s, bz = rs[o + 5] * s;
    const r = rs[o + 6] * s;
    // World positions: body x is forward; heading rotates it about the vertical axis.
    const Ax = ex + ax * cosH - az * sinH, Ay = ey + ay, Az = ez + ax * sinH + az * cosH;
    const Bx = ex + bx * cosH - bz * sinH, By = ey + by, Bz = ez + bx * sinH + bz * cosH;
    let dx = Bx - Ax, dy = By - Ay, dz = Bz - Az;
    let len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) { dx = 0; dy = 1; dz = 0; len = 1e-5; } else { dx /= len; dy /= len; dz /= len; }
    const ext = tone === 3 ? 0.35 * r : 0; // arm bones overlap a little at the joints
    // Perpendicular frame: the body's forward axis made orthogonal to the rod axis (so n-gon hubs turn with the heading).
    let px = cosH - cosH * dx * dx - sinH * dz * dx, py = -(cosH * dx + sinH * dz) * dy, pz = sinH - cosH * dx * dz - sinH * dz * dz;
    let pl = Math.hypot(px, py, pz);
    if (pl < 1e-4) { px = 0; py = 0; pz = 1; pl = 1; }
    px /= pl; py /= pl; pz /= pl;
    const qx = py * dz - pz * dy, qy = pz * dx - px * dz, qz = px * dy - py * dx; // p × axis
    const arr = mesh.instanceMatrix.array as Float32Array;
    const m = idx * 16, L = len + 2 * ext;
    arr[m] = px * r; arr[m + 1] = py * r; arr[m + 2] = pz * r;
    arr[m + 4] = dx * L; arr[m + 5] = dy * L; arr[m + 6] = dz * L;
    arr[m + 8] = qx * r; arr[m + 9] = qy * r; arr[m + 10] = qz * r;
    arr[m + 12] = (Ax + Bx) / 2; arr[m + 13] = (Ay + By) / 2; arr[m + 14] = (Az + Bz) / 2;
    const carr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    const c3 = idx * 3, t3 = tone * 3;
    carr[c3] = rgb[t3] * k; carr[c3 + 1] = rgb[t3 + 1] * k; carr[c3 + 2] = rgb[t3 + 2] * k;
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
            const entry = makeEntry(beadLayout(plan), plan.chemistry === 'silicon', plan.diet, plan.glow, plan.scale, b.id, true);
            entry.legged = plan.legPairs > 0;
            entries.set(b.id, entry);
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
        pS = new Float32Array(m); pY0 = new Float32Array(m); pid = new Float64Array(m); px = new Float32Array(m); py = new Float32Array(m); pz = new Float32Array(m); pr = new Float32Array(m);
      }
      pn = 0;
      const boost = part.scaleBoost;
      const sea = inputs.seaLevel;
      const seaThere = (inputs.stats.seaCover ?? 1) > 0.005;
      const heightAt = inputs.terrain.height;
      counts.fill(0);
      let animated = 0;

      function draw(e: Entry, alpha: number, mode: number, live: boolean) {
        const ground = heightAt(e.x, e.z);
        const s = boost * displayFactor(e.scale) * alpha;
        if (s <= 0) return;
        let y0 = ground;
        if (mode === LOCOMOTION.hover) y0 = ground + displayLength(e.scale) * boost * (0.9 + 0.25 * Math.sin(t * 1.3 + e.id)) * alpha;
        else if (mode === LOCOMOTION.swim && seaThere && ground < sea) y0 = ground + (sea - ground) * 0.35;

        const useGlow = e.glow > GLOW_MIN;
        const lay = e.layout;
        const rad = lay.radial;
        // Radial bodies' beads are only the arm-tip eye dots: faceted, or in the unlit mesh when glowing.
        const mi = useGlow ? 2 : e.silicon || rad ? 1 : 0;
        if (counts[mi] + lay.beads.length > CAP) return;
        let hubMesh = 0, nHex = 0;
        if (rad) {
          hubMesh = 3 + (rad.hubSides === 3 ? 0 : rad.hubSides === 4 ? 1 : 2);
          nHex = rad.rods.length - rad.nTiers;
          if (counts[hubMesh] + rad.nTiers > HUB_CAP || counts[HEX] + nHex > HEX_CAP) return;
        }
        const mesh = MESHES[mi];
        const arr = mesh.instanceMatrix.array as Float32Array;
        const carr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
        const glowK = useGlow ? 1 + 1.5 * e.glow : 1;
        const cosH = Math.cos(e.h), sinH = Math.sin(e.h);
        let flat = e.flat, rods = e.rods;
        const dx = camPos.x - e.x, dz = camPos.z - e.z;
        if (animated < ANIM_MAX && dx * dx + dz * dz < ANIM_RADIUS * ANIM_RADIUS) {
          animated++;
          if (rad) {
            animateRadial(e, t, boost * displayFactor(e.scale), mode, heightAt, y0, cosH, sinH);
            rods = rodScratch;
          } else animate(e, t, boost * displayFactor(e.scale), mode, heightAt, y0, cosH, sinH);
          flat = scratch;
        }
        if (rad) {
          const k = useGlow ? 1 + 0.6 * e.glow : 1;
          for (let i = 0; i < rad.rods.length; i++) {
            const mesh = i < rad.nTiers ? MESHES[hubMesh] : hex;
            const idx = counts[i < rad.nTiers ? hubMesh : HEX]++;
            emitRod(mesh, idx, rods, i, s, e.x, y0, e.z, cosH, sinH, e.rgb, e.rodTone[i], k);
          }
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
          pid[pn] = e.id; px[pn] = e.x; py[pn] = y0 + lay.centreY * s; pz[pn] = e.z; pr[pn] = Math.max(lay.radius * s * 0.85, 0.3); // tight: 85% of the bead bounds, at least 30 cm
          pe[pn] = e; pS[pn] = s; pY0[pn] = y0;
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
        if (mode === LOCOMOTION.swim && e.layout.radial) {
          e.roll = (e.roll + rollAngle(e.speed * dt / (boost * displayFactor(e.scale)), e.layout.radial.rollRadius)) % (2 * Math.PI);
        }
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

      for (let m = 0; m < MESHES.length; m++) {
        MESHES[m].count = counts[m];
        MESHES[m].instanceMatrix.needsUpdate = true;
        (MESHES[m].instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
      part.count = pn;
    },
    hit(origin, dir) {
      // Broad phase: the loose bounding sphere (either side, so a camera inside one still tests the body).
      // Narrow phase: the creature's drawn parts (beads, and sample points along rods), at rest pose, a little padded.
      let best: { id: number; dist: number } | null = null;
      const c = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < pn; i++) {
        if (raySphere(origin, dir, { x: px[i], y: py[i], z: pz[i] }, pr[i]) <= 0) continue;
        const e = pe[i], s = pS[i], y0 = pY0[i];
        const cosH = Math.cos(e.h), sinH = Math.sin(e.h);
        let t = -1;
        const test = (lx: number, ly: number, lz: number, r: number) => {
          c.x = e.x + (lx * s) * cosH - (lz * s) * sinH; c.y = y0 + ly * s; c.z = e.z + (lx * s) * sinH + (lz * s) * cosH;
          const d = raySphereEntry(origin, dir, c, r * s * 1.2 + 0.05);
          if (d > 0 && (t < 0 || d < t)) t = d;
        };
        for (const b of e.layout.beads) test(b.x, b.y, b.z, b.r);
        for (const r of e.layout.radial?.rods ?? []) {
          for (const f of [0, 0.33, 0.67, 1]) test(r.ax + (r.bx - r.ax) * f, r.ay + (r.by - r.ay) * f, r.az + (r.bz - r.az) * f, r.r);
        }
        if (t > 0 && (!best || t < best.dist)) best = { id: pid[i], dist: t };
      }
      return best;
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
      app.scene.remove(...MESHES);
      for (const m of MESHES) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
      entries.clear();
    },
  };
  return part;
}
