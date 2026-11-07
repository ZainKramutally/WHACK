// Fauna review lab (fauna.html). ?view=lineup (default) | one&i=N (orbit close-up) | strip&i=N (6-frame walk strip)
// &seed=N re-rolls variation inside each genome. &style=smooth turns the pixel pass off. &t=SEC freezes time.
// Capture hooks: window.__ready, window.__info (variants + cadence), window.__fps.
import * as THREE from 'three/webgpu';
import { Fn, positionWorld, vec3, mix, smoothstep, mx_noise_float, float } from 'three/tsl';
import { PALETTE } from '../contracts';
import { U, worldMaterial, PIXEL } from '../material';
import { skyNode } from '../sky';
import { createPost } from '../post';
import { buildExplorer } from '../explorer';
import { develop, type FaunaPlan } from './develop';
import { VARIANTS } from './variants';
import { stadium, type Path } from './path';
import { buildHerd, type Individual } from './render';
import { spineAt } from './rig';
import { createLabCam } from './labcam';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'lineup';
const pick = Number(q.get('i') ?? 0);
const seed = Number(q.get('seed') ?? 1);
const fixedT = q.has('t') ? Number(q.get('t')) : null;

const plans = VARIANTS.map((v) => develop(v.genes, v.comp, seed, undefined, v.age ?? 1));

// ---- layout: each variant walks its own stadium loop (or roots / floats) ----------------------------------------
const ext = (p: FaunaPlan) => Math.max(p.scale, p.legLen * 1.2, p.armLen * 2);
// loops are wide enough that turning never folds the body (radius ≥ 1.3 body lengths)
const LOOSE = view !== 'lineup'; // close-ups and strips get wide loops; the lineup uses tighter ones so it fits
const loopA = (p: FaunaPlan) => (p.mode === 'hover' ? 1.2 * p.scale : Math.max((LOOSE ? 2 : 0.7) * p.scale, ext(p) * (LOOSE ? 1 : 0.4)));
const loopB = (p: FaunaPlan) => (p.mode === 'hover' ? 1.3 * p.scale : Math.max((LOOSE ? 1.3 : 0.9) * p.scale, 0.8 * p.legLen, LOOSE ? 1 : 0.5));
function loopFor(p: FaunaPlan, cx: number, cz: number): Path { return stadium(cx, cz, loopA(p), loopB(p)); }
function individualsFor(i: number, cx: number, cz: number): Individual[] {
  const p = plans[i];
  const out: Individual[] = [];
  for (let k = 0; k < p.social; k++) {
    const e = ext(p);
    const path = k === 0 ? loopFor(p, cx, cz) : stadium(cx, cz, loopA(p), loopB(p) + (k % 2 ? 1 : -1) * e * 0.35 * Math.ceil(k / 2));
    out.push({ plan: k === 0 ? p : develop(VARIANTS[i].genes, VARIANTS[i].comp, seed + k * 101, undefined, VARIANTS[i].age ?? 1), path, inst: { s0: -k * e * 0.9, phase: k * 1.37 } });
  }
  return out;
}

const individuals: Individual[] = [];
const lanes: { i: number; cx: number; cz: number }[] = [];
let explorerX = 0, explorerZ = 0;
const LINEUP_FOV = 34;
if (view === 'lineup') {
  // one row at a common depth, sorted by size, so true size differences read; the explorer stands in the row at its
  // own size rank (1.8 m), and the floaters drift overhead at the back
  const ground = plans.map((p, i) => ({ p, i })).filter((d) => d.p.mode !== 'hover').sort((a, b) => ext(a.p) - ext(b.p));
  const hf = Math.tan(((LINEUP_FOV / 2) * Math.PI) / 180) * (innerWidth / innerHeight);
  const w = ground.map((d) => 2 * loopA(d.p) + 1);
  const exW = 3, exAt = ground.findIndex((d) => ext(d.p) > 1.8);
  const total = w.reduce((x, y) => x + y, 0) + exW;
  const D = total / (2 * hf * 0.9);
  let x = -total / 2;
  ground.forEach((d, k) => {
    if (k === exAt) { explorerX = x + exW / 2; x += exW; }
    lanes.push({ i: d.i, cx: x + w[k] / 2, cz: -D }); x += w[k];
  });
  explorerZ = -D + 1.5;
  // floaters at the back, each at a depth where it sits in the sky band: leviathan mid, adolescent bellwhale far right
  // (~90 m up), juvenile low and near
  plans.forEach((p, i) => {
    if (p.mode !== 'hover') return;
    if (p.form !== 'bell') lanes.push({ i, cx: 40, cz: -150 });
    else if (p.age > 0.5) lanes.push({ i, cx: 150, cz: -360 });
    else lanes.push({ i, cx: -14, cz: -48 });
  });
  for (const l of lanes) individuals.push(...individualsFor(l.i, l.cx, l.cz));
} else {
  lanes.push({ i: pick, cx: 0, cz: 0 });
  individuals.push(...individualsFor(pick, 0, 0));
}
const herd = buildHerd(individuals);

// ---- scene ---------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGPURenderer({ antialias: !PIXEL });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
await renderer.init();

U.fgPush.value = 0;
U.lightDir.value.set(-0.5, 0.62, 0.6).normalize(); // lab: key light from the camera side (front-left 3/4) so forms read          // the lab views creatures close up; the scene's foreground ink push would blacken them
U.fogStart.value = 120; U.fogDist.value = 900; U.hazeAmount.value = 0.15;

const scene = new THREE.Scene();
scene.backgroundNode = skyNode();
const light = new THREE.DirectionalLight(0xffffff, 1);
light.castShadow = true;
light.shadow.mapSize.set(4096, 4096);
const SH = view === 'lineup' ? 60 : 30;
const sc = light.shadow.camera;
sc.left = -SH; sc.right = SH; sc.top = SH; sc.bottom = -SH; sc.near = 1; sc.far = 600;
light.shadow.bias = -0.0004; light.shadow.normalBias = 0.05;
light.position.copy(U.lightDir.value).multiplyScalar(250);
scene.add(light, light.target);

// red ground with pebble-scale variation (so planted feet can be judged against it)
const groundCol = Fn(() => {
  const p = positionWorld.xz;
  const n = mx_noise_float(p.mul(0.35)).add(mx_noise_float(p.mul(1.7)).mul(0.5));
  const c = mix(vec3(...rgb(PALETTE.red)), vec3(...rgb(PALETTE.redLight)), smoothstep(0.1, 0.6, n)).toVar();
  c.assign(mix(c, vec3(...rgb(PALETTE.crimson)), smoothstep(-0.25, -0.6, n).mul(0.8)));
  const peb = smoothstep(0.55, 0.62, mx_noise_float(p.mul(6.0)));
  c.assign(mix(c, vec3(...rgb(PALETTE.maroon)), peb.mul(float(0.6))));
  return c;
})();
function rgb(hex: number): [number, number, number] { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), worldMaterial({ colorNode: groundCol, bounce: false }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground, herd.group);

const explorers = (view === 'lineup' ? [null] : lanes).map((l) => {
  const m = buildExplorer(0, 0, 0.5);
  if (l) { const e = ext(plans[l.i]); m.position.set(l.cx + e * 1.6 + 0.8, -0.05, l.cz - e * 0.2); }
  else m.position.set(explorerX, -0.05, explorerZ);
  scene.add(m);
  return m;
});
const camera = new THREE.PerspectiveCamera(view === 'lineup' ? LINEUP_FOV : view === 'sky' ? 75 : 34, innerWidth / innerHeight, 0.05, 4000);

// ---- cameras -----------------------------------------------------------------------------------------------------
const P0 = plans[pick];
const height = (p: FaunaPlan) => (p.mode === 'hover' ? p.scale * 0.6 : p.mode === 'sessile' ? p.scale + p.armLen * 0.5 : Math.max(p.hipHeight + p.radii.reduce((a, b) => Math.max(a, b), 0) * 2, p.scale * 0.35));
const centreOf = (idx: number) => {
  const sp = herd.spines[idx];
  return sp ? spineAt(sp, sp.P.length / 2, true).p : [0, 0, 0];
};
if (view === 'lineup') {
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 2.6, explorerZ);
}
void explorers;
const post = createPost(renderer, scene, camera);
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post.resize(innerHeight); };
addEventListener('resize', resize);
resize();

const cycle = P0.cadence > 0 ? 1 / P0.cadence : P0.mode === 'crawl' ? (0.55 * P0.scale) / Math.max(1e-3, P0.speed) : P0.form === 'bell' ? 1 / (P0.breathHz * 0.6) : 4;
function placeCamera(t: number, mode: 'orbit' | 'side', tc = t) {
  placeCamera0(t, mode, tc);
  if (view !== 'sky') besideSubject();
}
// the explorer stands beside the subject, off to the side of the view and a little behind it: never between it and the camera
let explorerPlaced = false;
function besideSubject() {
  if (explorerPlaced || !explorers[0]) return;
  const c = centreOf(0) as number[];
  const e = Math.max(ext(P0), P0.mode === 'hover' ? 0 : height(P0));
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const side = P0.mode === 'hover' ? 0.6 * P0.scale : e * 0.75 + 1.2;
  explorers[0].position.set(c[0] + right.x * side + dir.x * e * 0.35, -0.05, c[2] + right.z * side + dir.z * e * 0.35);
  explorers[0].rotation.y = Math.atan2(-dir.x, -dir.z);
  explorerPlaced = true;
}
function placeCamera0(t: number, mode: 'orbit' | 'side', tc = t) {
  const c = centreOf(0) as number[];
  const e = Math.max(ext(P0), height(P0));
  const hh = height(P0);
  if (mode === 'orbit') {
    const a = 1.9 + 0.15 * (t - 7);
    if (P0.form === 'bell') {
      // orbit relative to the heading, starting at a front 3/4 view so the clinging body and its eyes read
      const H = P0.scale;
      const sp = herd.spines[0];
      const fw = sp ? [sp.P[0][0] - sp.P[sp.P.length - 1][0], 0, sp.P[0][2] - sp.P[sp.P.length - 1][2]] : [1, 0, 0];
      const hd0 = Math.atan2(individuals[0].path.at(individuals[0].inst.s0 + P0.speed * t).t[2], individuals[0].path.at(individuals[0].inst.s0 + P0.speed * t).t[0]);
      void fw;
      const Lx = U.lightDir.value.x, Lz = U.lightDir.value.z;
      const lit = (a0: number) => Math.cos(a0) * Lx + Math.sin(a0) * Lz;
      const ang = (lit(hd0 + 0.75) >= lit(hd0 - 0.75) ? hd0 + 0.75 : hd0 - 0.75) + 0.12 * (t - 7); // front 3/4, lit side
      camera.position.set(c[0] + Math.cos(ang) * H * 3.4, c[1] - 0.35 * H, c[2] + Math.sin(ang) * H * 3.4);
      camera.lookAt(c[0], c[1] - 0.45 * H, c[2]);
      return;
    }
    const hov = P0.mode === 'hover';
    camera.position.set(c[0] + Math.cos(a) * e * 1.9, hov ? c[1] * 0.35 : Math.max(0.4, hh * 0.55 + e * 0.35), c[2] + Math.sin(a) * e * 1.9);
    camera.lookAt(c[0], hov ? c[1] : Math.max(c[1] * 0.8, hh * 0.4), c[2]);
  } else {
    herd.update(tc);
    const sp = herd.spines[0];
    const f = spineAt(sp, sp.P.length / 2, true);
    const cc = f.p;
    const R = f.R[0] * U.lightDir.value.x + f.R[2] * U.lightDir.value.z < 0 ? [-f.R[0], 0, -f.R[2]] : f.R; // lit side
    const d = e * 1.7;
    if (P0.form === 'bell') {
      const H = P0.scale;
      camera.position.set(cc[0] + R[0] * H * 3.4, cc[1] - 0.35 * H, cc[2] + R[2] * H * 3.4);
      camera.lookAt(cc[0], cc[1] - 0.45 * H, cc[2]);
      return;
    }
    const hov = P0.mode === 'hover';
    camera.position.set(cc[0] + R[0] * d, hov ? cc[1] * 0.5 : Math.max(0.35, hh * 0.45), cc[2] + R[2] * d);
    camera.lookAt(cc[0], hov ? cc[1] : Math.max(cc[1] * 0.75, hh * 0.4), cc[2]);
  }
}

// sky view: standing on the ground beside the explorer, looking up at a floater against the white sky
let skyBase: number[] | null = null;
function skyCamera() {
  const c = centreOf(0) as number[];
  if (!skyBase) {
    const L = U.lightDir.value;
    const d = Math.max(10, c[1] * 0.55);
    skyBase = [c[0] + L.x * d, 0.5, c[2] + L.z * d];
    const ex = explorers[0];
    const tx = c[0] - skyBase[0], tz = c[2] - skyBase[2], tl = Math.hypot(tx, tz);
    ex.position.set(skyBase[0] + (tx / tl) * 5 - (tz / tl) * 1.6, -0.05, skyBase[2] + (tz / tl) * 5 + (tx / tl) * 1.6);
    ex.rotation.y = Math.atan2(tx, tz) + Math.PI;
  }
  camera.position.set(skyBase[0], skyBase[1], skyBase[2]);
  // look 26° up: the explorer stands at the bottom of the frame, the floater overhead
  const hd = Math.hypot(c[0] - skyBase[0], c[2] - skyBase[2]);
  camera.lookAt(skyBase[0] + (c[0] - skyBase[0]) / hd, skyBase[1] + Math.tan(0.66), skyBase[2] + (c[2] - skyBase[2]) / hd);
}

const info = document.getElementById('info')!;
(window as any).__info = { variants: VARIANTS.map((v, i) => ({ name: v.name, why: v.why, mode: plans[i].mode, gait: plans[i].gait, scale: plans[i].scale, cycle: plans[i].cadence ? 1 / plans[i].cadence : 4 })), stats: herd.stats() };

if (view === 'strip') {
  // 6 frames across one gait cycle from a fixed side camera, composed into a 3×2 sheet
  const cw = 640, ch = 400;
  renderer.setSize(cw, ch); camera.aspect = cw / ch; camera.updateProjectionMatrix(); post.resize(ch);
  const out = document.createElement('canvas');
  out.width = cw * 3; out.height = ch * 2;
  renderer.domElement.style.display = 'none';
  document.body.appendChild(out);
  const ctx = out.getContext('2d')!;
  const t0 = fixedT ?? (P0.speed > 0 ? Math.max(0, (loopA(P0) - 0.5 * P0.speed * cycle) / P0.speed) : 6);
  placeCamera(t0, 'side', t0 + cycle / 2);
  const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  for (let k = 0; k < 6; k++) {
    const t = t0 + (k / 6) * cycle;
    U.time.value = t;
    herd.update(t);
    post.render();
    await raf(); await raf();
    const bmp = await createImageBitmap(renderer.domElement);
    ctx.drawImage(bmp, (k % 3) * cw, Math.floor(k / 3) * ch);
    ctx.fillStyle = '#22060f'; ctx.font = '14px ui-monospace, monospace';
    ctx.fillText(`${VARIANTS[pick].name}  t+${(t - t0).toFixed(2)}s  (${P0.gait === 'none' ? P0.mode : P0.gait} cycle ${cycle.toFixed(2)}s)`, (k % 3) * cw + 8, Math.floor(k / 3) * ch + 18);
  }
  (window as any).__ready = true;
} else {
  // free camera for live views only; captures (fixed &t=, #capture, strips) keep the fixed framing
  const FREE = fixedT === null && !location.hash.includes('capture');
  let labcam: ReturnType<typeof createLabCam> | null = null;
  let lastNow = performance.now();
  const firstOf = (i: number) => individuals.findIndex((d) => d.plan === plans[i]);
  const centreOfVariant = (i: number) => { const k = firstOf(i); return k >= 0 && herd.spines[k] ? spineAt(herd.spines[k], herd.spines[k].P.length / 2, true).p : null; };
  const startLabCam = () => {
    // orbit target = the default framing's look-at point, at the distance of the subject
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const subj = view === 'lineup' ? [0, 2.6, explorerZ] : (centreOfVariant(pick) ?? [0, 0, 0]);
    const d = camera.position.distanceTo(new THREE.Vector3(subj[0], subj[1], subj[2]));
    const tgt = camera.position.clone().addScaledVector(dir, d);
    return createLabCam({
      camera, dom: renderer.domElement, target: [tgt.x, tgt.y, tgt.z], creatures: VARIANTS.length, centreOf: centreOfVariant,
      select: pick, follow: view === 'one', autoRotate: view === 'one' ? 0.12 : 0,
    });
  };
  const t0 = performance.now();
  let frames = 0, fpsT = t0, fps = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const t = fixedT ?? (now - t0) / 1000 + 4;
    U.time.value = t;
    herd.update(t);
    const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    if (labcam) labcam.update(dt);
    else {
      if (view === 'one') placeCamera(t, 'orbit');
      if (view === 'sky') skyCamera();
      if (FREE) labcam = startLabCam();
    }
    post.render();
    frames++;
    if (now - fpsT > 1000) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; (window as any).__fps = fps; }
    const st = herd.stats();
    info.textContent = `${view === 'one' ? VARIANTS[pick].name + ' · ' : ''}seed ${seed} · ${st.individuals} animals · ${st.drawCalls} fauna draws · ${fps.toFixed(0)} fps`;
    if (frames === 3 || (window as any).__ready) (window as any).__ready = true;
  });
}
