// Render shell: renderer, scene, camera, frame loop and the integration hooks other lanes plug into.
import * as THREE from 'three/webgpu';
import type { VisualInputs } from '../worlds/types';
import { makeStubVisualInputs } from './visualInputs';
import { createPost, PIXEL, type Post } from './post';

export type FrameHook = (dt: number, t: number, inputs: VisualInputs) => void;
/** Draws straight to the canvas after the frame's main render (e.g. the inspect card's scissored live view). */
export type OverlayDraw = (renderer: THREE.WebGPURenderer) => void;

export interface App {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** DOM overlay root (#ui). pointer-events: none on the root; set `auto` on your own children. */
  ui: HTMLElement;
  /** Called every frame before render, in registration order. Returns an unregister function. */
  registerFrameHook(fn: FrameHook): () => void;
  /** Swap the VisualInputs source (default: a stub). Called once per frame. */
  setVisualInputsSource(fn: () => VisualInputs): void;
  /** Latest VisualInputs read this frame. */
  readonly inputs: VisualInputs;
  /** 'pixel' (default) or 'smooth' (?style=smooth). */
  readonly style: 'pixel' | 'smooth';
  /** The post pipeline that owns the main frame (src/render/post.ts). */
  readonly post: Post;
  /** Replace the frame's main render step (default: post.render()). Pass null to restore the default. */
  setRender(fn: (() => void) | null): void;
  /** Draw after the main render each frame, in registration order, at full canvas resolution. Returns an unregister function. */
  registerOverlay(fn: OverlayDraw): () => void;
  /** Compile a scene's materials for both the post pass target and the canvas. Use instead of renderer.compileAsync. */
  compile(scene?: THREE.Object3D, camera?: THREE.Camera): Promise<void>;
}

export async function createApp(): Promise<App> {
  const host = document.getElementById('app');
  const ui = document.getElementById('ui');
  if (!host || !ui) throw new Error('index.html is missing #app or #ui');

  // Pixel mode renders at ~360 px internal height, so canvas DPR 1 and no MSAA; smooth keeps DPR <= 2 and MSAA.
  const renderer = new THREE.WebGPURenderer({ antialias: !PIXEL });
  renderer.setPixelRatio(PIXEL ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  host.appendChild(renderer.domElement);
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec8e8);
  scene.fog = new THREE.Fog(0x9ec8e8, 80, 300);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 1, 0);

  // Placeholder world: flat ground and one light. The real terrain/sky replace these.
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(30, 50, 20);
  scene.add(sun, new THREE.HemisphereLight(0xbfe0ff, 0x445533, 0.6));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0x5a8f4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xe8e0c0 }));
  marker.position.y = 1;
  scene.add(marker);

  const post = createPost(renderer, scene, camera);
  post.resize(window.innerHeight);
  const defaultRender = () => post.render();
  let renderStep = defaultRender;
  const overlays: OverlayDraw[] = [];
  const compile = async (s: THREE.Object3D = scene, c: THREE.Camera = camera) => {
    await post.compile(s, c);
    await renderer.compileAsync(s, c);
  };

  const hooks: FrameHook[] = [];
  /** Hooks that have thrown at least once (warned once each; they keep being called). */
  const failed = new WeakSet<FrameHook>();
  let source: () => VisualInputs = makeStubVisualInputs;
  let inputs = source();

  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    post.resize(window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // fps readout behind ?debug
  let fpsEl: HTMLElement | null = null;
  if (new URLSearchParams(location.search).has('debug')) {
    fpsEl = document.createElement('div');
    fpsEl.style.cssText = 'position:fixed;top:6px;left:6px;font:12px monospace;color:#fff;background:#0008;padding:2px 6px;pointer-events:none;z-index:10';
    document.body.appendChild(fpsEl);
  }
  let fpsFrames = 0;
  let fpsStart = performance.now();

  // Compile before the first visible frame.
  await compile();

  let last = performance.now();
  renderer.setAnimationLoop((now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    inputs = source();
    // A throwing hook must not stop the rest of the frame (later hooks, post, render) and freeze the picture: warn once
    // per hook and keep calling it, so one bad frame doesn't end the run.
    for (const h of hooks) {
      try {
        h(dt, now / 1000, inputs);
      } catch (err) {
        if (!failed.has(h)) { failed.add(h); console.warn('frame hook threw (warned once; it keeps running):', err); }
      }
    }
    post.update(inputs);
    // compile() may hold the post pass's target as the renderer's current target across awaits; frames draw to the canvas.
    const held = renderer.getRenderTarget();
    if (held) renderer.setRenderTarget(null);
    renderStep();
    for (const o of overlays) o(renderer);
    if (held) renderer.setRenderTarget(held);
    if (fpsEl && ++fpsFrames >= 30) {
      fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsStart))} fps`;
      fpsFrames = 0;
      fpsStart = now;
    }
  });

  return {
    renderer,
    scene,
    camera,
    ui,
    registerFrameHook(fn) {
      hooks.push(fn);
      return () => {
        const i = hooks.indexOf(fn);
        if (i >= 0) hooks.splice(i, 1);
      };
    },
    setVisualInputsSource(fn) {
      source = fn;
    },
    get inputs() {
      return inputs;
    },
    style: PIXEL ? 'pixel' : 'smooth',
    post,
    setRender(fn) {
      renderStep = fn ?? defaultRender;
    },
    registerOverlay(fn) {
      overlays.push(fn);
      return () => {
        const i = overlays.indexOf(fn);
        if (i >= 0) overlays.splice(i, 1);
      };
    },
    compile,
  };
}
