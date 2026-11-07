import * as THREE from 'three/webgpu';
import { PRESETS, presetById } from './presets';
import type { Preset, WorldContext, WorldModule } from './contracts';
import { derive } from './derive';
import { createUniforms, applyDerived } from './core/uniforms';
import { createMaterialFactory } from './core/materials';
import { makeRng } from './core/rng';
import landforms from './landforms';
import flora from './flora';

const params = new URLSearchParams(location.search);
const hash = location.hash;
const presetId = (params.get('preset') ?? 'eco14') as Preset['id'];
const quality: 'low' | 'high' = params.get('q') === 'low' ? 'low' : 'high';

const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();
stage.appendChild(renderer.domElement);

const preset = presetById(presetId);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(preset.composition.camera.fov, preset.composition.aspect, 0.1, 3000);
camera.position.set(...preset.composition.camera.position);
camera.lookAt(...preset.composition.camera.target);

const uniforms = createUniforms();
const derived = derive(preset.dials, PRESETS);
applyDerived(uniforms, derived, preset.dials);

const ctx: WorldContext = {
  scene, camera, renderer, preset, derived, uniforms,
  materials: createMaterialFactory(uniforms),
  quality,
  terrainHeight: () => 0,
  rng: makeRng(preset.dials.seed),
};

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(...preset.composition.sunDir).multiplyScalar(200);
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x888888, 1));
scene.background = uniforms.skyHorizon.value;

const modules: WorldModule[] = [landforms(), flora()];
for (const m of modules) await m.build(ctx);

function resize() {
  const w = innerWidth, h = innerHeight, a = preset.composition.aspect;
  const cw = Math.min(w, h * a), ch = cw / a;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(cw, ch);
  camera.aspect = a; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  uniforms.time.value += dt;
  for (const m of modules) m.update?.(ctx, dt);
  renderer.render(scene, camera);
});
void hash; void PRESETS;
setTimeout(() => ((window as any).__ready = true), 1000);
