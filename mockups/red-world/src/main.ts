import * as THREE from 'three/webgpu';
import { PALETTE } from './contracts';

const renderer = new THREE.WebGPURenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyHorizon);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 12000);
camera.position.set(0, 3, 0);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

await renderer.init();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
(window as any).__ready = true;
