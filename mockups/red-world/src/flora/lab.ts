// Flora review page (flora.html). ?view=lineup (true scale, default) | grid (one cell per archetype)
// &sil=1 (flat ink silhouettes) &seed=N. Sets window.__ready when drawn.
import * as THREE from 'three/webgpu';
import { Fn, attribute, color, float, mix, normalWorld, smoothstep, vec3, max } from 'three/tsl';
import { PALETTE } from '../contracts';
import { buildFloraLibrary, SPECIES } from './index';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'lineup';
const sil = q.get('sil') === '1';
const seed = Number(q.get('seed') ?? 1234);

const t0 = performance.now();
const lib = buildFloraLibrary(seed);
const genMs = performance.now() - t0;

const L = vec3(0.45, 0.8, 0.4).normalize();
const plantMat = new THREE.MeshBasicNodeMaterial();
plantMat.colorNode = sil
  ? color(PALETTE.ink)
  : Fn(() => {
    const base = attribute('color', 'vec3');
    const g = attribute('aGlow', 'float');
    const n = normalWorld;
    const lit = smoothstep(-0.05, 0.3, n.dot(L));
    const shade = mix(base.mul(color(PALETTE.shadow)).mul(1.6), base, lit);
    const bounce = color(PALETTE.red).mul(max(n.y.negate(), float(0)).mul(0.25));
    const c = shade.add(bounce.mul(base.add(0.2)));
    return mix(c, color(PALETTE.glow).mul(1.4), g);
  })();
const groundMat = new THREE.MeshBasicNodeMaterial();
groundMat.colorNode = color(PALETTE.red);
const figMat = new THREE.MeshBasicNodeMaterial();
figMat.colorNode = color(PALETTE.ink);

function figure() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.45, 8), figMat);
  body.position.y = 0.725;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), figMat);
  head.position.y = 1.62;
  g.add(body, head);
  return g;
}

function makeScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0xffffff);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  s.add(ground);
  return s;
}

const info = document.getElementById('info')!;
const tris = lib.archetypes.reduce((s, a) => s + a.triangles, 0);
info.textContent = `seed ${seed} · ${lib.archetypes.length} archetypes · ${tris.toLocaleString()} tris · gen ${genMs.toFixed(0)} ms`;

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(1);
await renderer.init();

if (view === 'grid') {
  // one cell per archetype: rows = variants, cols = species
  const cw = 320, ch = 360, cols = SPECIES.length, rows = 4;
  renderer.setSize(cw, ch);
  const out = document.createElement('canvas');
  out.width = cw * cols; out.height = ch * rows;
  document.body.appendChild(out);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
  const scene = makeScene();
  const fig = figure();
  scene.add(fig);
  const cam = new THREE.PerspectiveCamera(32, cw / ch, 0.05, 50000);
  for (const a of lib.archetypes) {
    const col = SPECIES.findIndex((s) => s.id === a.species), row = a.variant;
    const mesh = new THREE.Mesh(a.geometry, plantMat);
    scene.add(mesh);
    const h = a.height, r = Math.max(a.radius, h * 0.3);
    const fit = Math.max(h * 1.3, r * 2.4 * (ch / cw)) / 2 / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(0, h * 0.18, fit * 1.0);
    cam.lookAt(0, h * 0.55, 0);
    fig.position.set(Math.max(r * 0.9, 1.2), 0, r * 0.4);
    renderer.render(scene, cam);
    ctx.drawImage(renderer.domElement, col * cw, row * ch);
    ctx.fillStyle = '#22060f'; ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(`${a.species}#${a.variant}  ${a.height.toFixed(1)}m  ${a.triangles}t`, col * cw + 6, row * ch + 16);
    scene.remove(mesh);
  }
  ctx.strokeStyle = '#ccc';
  for (let c = 1; c < cols; c++) ctx.strokeRect(c * cw, 0, 0, out.height);
  for (let r = 1; r < rows; r++) ctx.strokeRect(0, r * ch, out.width, 0);
  (window as any).__ready = true;
} else {
  // true-scale lineup, left -> right in species order, a figure at the foot of each plant
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  const scene = makeScene();
  let x = 0;
  const gap = 6;
  for (const a of lib.archetypes) {
    const r = Math.max(a.radius, 0.6);
    x += r;
    const m = new THREE.Mesh(a.geometry, plantMat);
    m.position.x = x;
    scene.add(m);
    const f = figure();
    f.position.set(x + r * 0.7 + 0.5, 0, r * 0.6 + 1);
    scene.add(f);
    x += r + gap;
  }
  const cam = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 1, 60000);
  const cx = x / 2;
  const dist = (x * 1.04) / 2 / Math.tan((cam.fov * Math.PI) / 360) / cam.aspect;
  cam.position.set(cx, 12, dist);
  cam.lookAt(cx, 75, 0);
  renderer.render(scene, cam);
  renderer.setAnimationLoop(() => renderer.render(scene, cam));
  (window as any).__ready = true;
}
