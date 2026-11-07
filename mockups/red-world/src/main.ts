// Red World. Opens on the hero frame; the first click/key flies into a third-person player (src/player).
// ?style=smooth disables pixelation, ?free gives OrbitControls, ?hero locks the hero shot, #capture freezes time on it,
// #tour runs a scripted walk + fly-up (fps measurement).
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SpeciesId } from './contracts';
import { CAMERA, HERO, EXPLORER } from './layout';
import { heightAt } from './field';
import { PIXEL, U } from './material';
import { buildGroundTexture, buildTerrain } from './terrain';
import { skyNode } from './sky';
import { createPost } from './post';
import { buildLandforms } from './landforms';
import { placePlants } from './placement';
import { buildInstances } from './scatter';
import { buildAtmos } from './atmos';
import { buildExplorer } from './explorer';
import { buildFloraLibrary } from './flora/index';
import { createPlayer } from './player/index';

const params = new URLSearchParams(location.search);
const FREE = params.has('free');
const CAPTURE = location.hash.includes('capture');
const HERO_LOCK = params.has('hero');
const SEED = Number(params.get('seed') ?? 2026);

const renderer = new THREE.WebGPURenderer({ antialias: !PIXEL, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
scene.backgroundNode = skyNode();

// light exists only for the shadow map; shading reads U.lightDir
const light = new THREE.DirectionalLight(0xffffff, 1);
light.castShadow = true;
light.shadow.mapSize.set(4096, 4096);
const sc = light.shadow.camera;
sc.left = -560; sc.right = 560; sc.top = 560; sc.bottom = -560; sc.near = 10; sc.far = 6000;
light.shadow.bias = -0.0004; light.shadow.normalBias = 0.6;
light.target.position.set(40, 0, -330);
light.position.copy(light.target.position).addScaledVector(U.lightDir.value, 2500);
scene.add(light, light.target);

buildGroundTexture();
scene.add(buildTerrain());
const landforms = buildLandforms();
scene.add(landforms);
const lib = buildFloraLibrary(SEED);
const avgH = new Map<string, number>();
for (const a of lib.archetypes) avgH.set(`${a.species}:${a.variant}`, a.height);
const heightOf = (s: SpeciesId, v: number) => avgH.get(`${s}:${v}`) ?? lib.bySpecies(s)[0]?.height ?? 1;
const plants = placePlants(SEED, heightOf, (s) => Math.max(1, lib.bySpecies(s).length));
const known = new Set(lib.archetypes.map((a) => `${a.species}:${a.variant}`));
scene.add(buildInstances(lib, plants.filter((p) => known.has(`${p.species}:${p.variant}`))));
const explorer = buildExplorer(EXPLORER.x, EXPLORER.z, 2.6);
scene.add(explorer);
scene.add(buildAtmos());

const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, 1, 14000);
const eyeY = heightAt(0, 0) + CAMERA.eye;
const base = new THREE.Vector3(0, eyeY, 0);
const look = (dx = 0, dy = 0) => {
  camera.rotation.set(CAMERA.pitch + dy, CAMERA.yaw + dx, 0, 'YXZ');
};
camera.position.copy(base); look();

let controls: any = null;
if (FREE) {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(HERO.x, heightAt(HERO.x, HERO.z) + 40, HERO.z);
  controls.update();
}

const player = FREE || CAPTURE || HERO_LOCK ? null
  : createPlayer({ dom: renderer.domElement, camera, light, explorer, landforms, plants, heightOf, tour: location.hash.includes('tour') });

const post = createPost(renderer, scene, camera);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.resize(innerHeight);
};
addEventListener('resize', resize);
resize();

const t0 = performance.now();
let frames = 0, last = t0;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = CAPTURE ? 12 : (now - t0) / 1000;
  U.time.value = t;
  if (controls) controls.update();
  else if (!player?.update(dt)) {
    // tiny drift: a slow breathing dolly + sub-degree yaw
    camera.position.set(base.x + Math.sin(t * 0.07) * 0.6, base.y + Math.sin(t * 0.11) * 0.12, base.z + Math.sin(t * 0.05) * 0.8);
    look(Math.sin(t * 0.045) * 0.004, Math.sin(t * 0.06) * 0.0015);
  }
  post.render();
  if (++frames === 4) (window as any).__ready = true;
});
(window as any).__scene = { scene, camera, plants: plants.length, player };
