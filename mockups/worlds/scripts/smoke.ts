// r187 smoke test (open /smoke.html?sway=0|1&t=<n>): InstancedMesh shadow casting + positionNode sway in the shadow pass.
// Ground plane + 5 instanced boxes lit by a directional light. Python reads the pixels (scripts/smoke.py).
import * as THREE from 'three/webgpu';
import { uniform, positionLocal, vec3, float, instanceIndex } from 'three/tsl';

const q = new URLSearchParams(location.search);
const sway = q.get('sway') === '1';
const r = new THREE.WebGPURenderer({ antialias: false });
await r.init();
r.setSize(400, 400);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
cam.position.set(0, 40, 0.01); cam.lookAt(0, 0, 0); // top-down
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(10, 20, 0); sun.castShadow = true;
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xffffff, 0.3));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshToonNodeMaterial({ color: 0xcccccc }));
ground.receiveShadow = true;
scene.add(ground);

const t = uniform(Number(q.get('t') ?? 0));
const mat = new THREE.MeshToonNodeMaterial({ color: 0x336699 });
if (sway) mat.positionNode = positionLocal.add(vec3(t.mul(1.0), 0, 0)); // after instancing: shifts every instance by t metres in x
const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 6, 1), mat, 5);
const m = new THREE.Matrix4();
for (let i = 0; i < 5; i++) { m.setPosition(-8 + i * 4, 3, 0); mesh.setMatrixAt(i, m); }
mesh.castShadow = true;
scene.add(mesh);
void float; void instanceIndex;
for (let i = 0; i < 4; i++) r.render(scene, cam);
(window as any).__ready = true;
