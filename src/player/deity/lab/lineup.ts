// Dev-only deity lineup: all four variants on flat Red World ground in the real look.
//   /scripts/deity/index.html?world=carbon|silicon&view=turntable|front|back|side|game&rim&void=ink
// Keys: T/F/B/S/G views, P or Space pause the turntable, R rim, V void mode (unlit/ink), W world, ←/→ variant in game view.
// Not part of the game build or any test tier.
import * as THREE from 'three/webgpu';
import { createApp } from '../../../render/app';
import { createWorldView } from '../../../render/world';
import { makeStubVisualInputs } from '../../../render/visualInputs';
import { worlds } from '../../../worlds';
import type { VisualInputs } from '../../../worlds/types';
import { buildDeity, DEITY_VARIANTS } from '../model';
import type { DeityRig } from '../rig';

type View = 'turntable' | 'front' | 'back' | 'side' | 'game';
const q = new URLSearchParams(location.search);
let worldId: 'carbon' | 'silicon' = q.get('world') === 'silicon' ? 'silicon' : 'carbon';
let view: View = (['turntable', 'front', 'back', 'side', 'game'] as const).find((v) => v === q.get('view')) ?? 'turntable';
let rim = q.has('rim') && q.get('rim') !== '0';
let voidMode: 'unlit' | 'ink' = q.get('void') === 'ink' ? 'ink' : 'unlit';
let paused = false;
let gameIdx = Math.max(0, DEITY_VARIANTS.findIndex((v) => v.id === (q.get('variant') ?? 'C')));

const app = await createApp();
const stub = makeStubVisualInputs();
function inputsFor(id: 'carbon' | 'silicon'): VisualInputs {
  const w = worlds[id];
  const si = id === 'silicon';
  return {
    ...stub,
    world: { id, status: w.status, starType: w.starType, solvent: w.solvent, composition: w.life.composition },
    stats: { ...stub.stats, temperature: si ? -183 : 15, pressure: si ? 3.6 : 1, oxygen: si ? 0 : 21, seaCover: 0 },
    frozen: false,
    light: si ? 0.01 : 1,
    seaLevel: -1000,
    terrain: { rise: 1, progress: {}, height: () => 0 },
  };
}
let inputs = inputsFor(worldId);
app.setVisualInputsSource(() => inputs);
const wv = createWorldView(app);
wv.setPatchSize(120);

// ---- rigs ----
const SPACING = 2.2;
const rigs: DeityRig[] = [];
const labels: HTMLElement[] = [];
const scene = app.scene;
const human = new THREE.Group();
{
  const mat = new THREE.MeshBasicNodeMaterial({ color: 0x15101c });
  const bodyG = new THREE.CapsuleGeometry(0.22, 1.2, 4, 12);
  const b = new THREE.Mesh(bodyG, mat);
  b.position.y = 0.8;
  const headG = new THREE.SphereGeometry(0.12, 14, 10);
  const h = new THREE.Mesh(headG, mat);
  h.position.y = 1.68;
  human.add(b, h);
  human.position.set(4.8, 0, 0);
}
scene.add(human);

function rebuild() {
  for (const r of rigs) { scene.remove(r.root); r.dispose(); }
  rigs.length = 0;
  DEITY_VARIANTS.forEach((v, i) => {
    const r = buildDeity(v.id, { rim, voidMode });
    r.root.position.set((i - 2) * SPACING, 0, 0);
    scene.add(r.root);
    rigs.push(r);
  });
  void app.compile();
  layoutHud();
}

const ui = app.ui;
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;top:8px;left:8px;font:12px monospace;color:#222;background:#fffc;padding:4px 8px;white-space:pre';
ui.appendChild(hud);
const humanLabel = document.createElement('div');
const mkLabel = (text: string) => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;font:13px monospace;color:#111;background:#fffd;padding:1px 6px;transform:translate(-50%,0);white-space:nowrap';
  d.textContent = text;
  ui.appendChild(d);
  return d;
};
DEITY_VARIANTS.forEach((v) => labels.push(mkLabel(`${v.id} · ${v.name}`)));
humanLabel.replaceWith(mkLabel('1.8 m human'));
const humanEl = ui.lastElementChild as HTMLElement;

function layoutHud() {
  hud.textContent = `world ${worldId} · view ${view}${view === 'game' ? ' ' + DEITY_VARIANTS[gameIdx].id : ''} · rim ${rim ? 'on' : 'off'} · void ${voidMode}${paused ? ' · paused' : ''}\n` +
    'T turntable  F front  B back  S side  G game  P pause  R rim  V void  W world  ←/→ variant (game)';
}

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 't') view = 'turntable';
  else if (k === 'f') view = 'front';
  else if (k === 'b') view = 'back';
  else if (k === 's') view = 'side';
  else if (k === 'g') view = 'game';
  else if (k === 'p' || k === ' ') { paused = !paused; e.preventDefault(); }
  else if (k === 'r') { rim = !rim; rebuild(); }
  else if (k === 'v') { voidMode = voidMode === 'unlit' ? 'ink' : 'unlit'; rebuild(); }
  else if (k === 'w') { worldId = worldId === 'carbon' ? 'silicon' : 'carbon'; inputs = inputsFor(worldId); }
  else if (k === 'arrowright') gameIdx = (gameIdx + 1) % DEITY_VARIANTS.length;
  else if (k === 'arrowleft') gameIdx = (gameIdx + DEITY_VARIANTS.length - 1) % DEITY_VARIANTS.length;
  layoutHud();
});

rebuild();

const CX = 0.2;
const v3 = new THREE.Vector3();
let yaw = 0;
app.registerFrameHook((dt) => {
  const game = view === 'game';
  if (view === 'turntable' && !paused) yaw += dt * 0.6;
  const yawFor = view === 'turntable' ? yaw : view === 'side' ? Math.PI / 2 : view === 'back' ? Math.PI : 0;
  // The character faces -z; 'back' turns the rigs round so the camera (always at -z) sees their backs.
  rigs.forEach((r, i) => {
    r.root.visible = !game || i === gameIdx;
    r.root.rotation.y = yawFor;
    r.root.position.x = game ? 0 : (i - 2) * SPACING;
  });
  human.visible = !game;
  const cam = app.camera;
  if (game) {
    // the in-game follow camera (src/player/camera.ts): 5.5 m behind, pitch 0.35, aimed 1.4 m above the feet, 60° vertical
    const pitch = 0.35, d = 5.5, ty = 1.4;
    rigs[gameIdx].root.rotation.y = 0;
    cam.fov = 60;
    cam.position.set(0, ty + Math.sin(pitch) * d, Math.cos(pitch) * d);
    cam.lookAt(0, ty, 0);
  } else {
    cam.fov = 50;
    cam.position.set(CX, 1.6, -10);
    cam.lookAt(CX, 0.8, 0);
  }
  cam.updateProjectionMatrix();
  // DOM labels
  const place = (el: HTMLElement, x: number, show: boolean) => {
    el.style.display = show ? '' : 'none';
    if (!show) return;
    v3.set(x, -0.15, 0).project(cam);
    el.style.left = `${(v3.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v3.y * 0.5 + 0.5) * innerHeight}px`;
  };
  labels.forEach((el, i) => place(el, (i - 2) * SPACING, !game));
  place(humanEl, 4.8, !game);
  if (game) {
    labels[gameIdx].style.display = '';
    labels[gameIdx].style.left = '50%';
    labels[gameIdx].style.top = '92%';
  }
});
Object.assign(window, { deityLab: { rigs, app } });
(window as unknown as { __ready: boolean }).__ready = true;
