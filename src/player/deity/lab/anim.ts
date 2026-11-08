// Dev-only deity animation playground (not part of the game, tests or the production build):
//   /scripts/deity/anim.html          WASD move, Shift sprint, Space jump (rise in water), mouse drag orbit, T slow motion, R reset
//   /scripts/deity/anim.html?auto     scripted loop: idle + look-back, walk, run, two jumps, swim, tread water, swim back
// Real controller, input and follow camera on flat stub ground with a pool, rendered through the real look.
import * as THREE from 'three/webgpu';
import { createApp } from '../../../render/app';
import { createFollowCamera } from '../../camera';
import { createCharacter } from '../../character';
import { createPlayer, type PlayerEnv, type PlayerIntents } from '../../controller';
import { createInput } from '../../input';
import { approach, walkFloor } from '../../logic';

const auto = new URLSearchParams(location.search).has('auto');
const POOL = { x: 0, z: -30, r: 10, depth: 3.2 };
const SPAWN = { x: 0, z: 8 };
const SEA = -0.4;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const heightAt = (x: number, z: number) => -POOL.depth * (1 - smooth(POOL.r * 0.6, POOL.r, Math.hypot(x - POOL.x, z - POOL.z)));
const env: PlayerEnv = { heightAt, seaLevel: () => SEA, frozen: () => false, spawn: SPAWN };

const app = await createApp();
for (const o of [...app.scene.children]) {
  if (o instanceof THREE.Mesh && (o.geometry instanceof THREE.PlaneGeometry || o.geometry instanceof THREE.BoxGeometry)) app.scene.remove(o);
}
const gGeo = new THREE.PlaneGeometry(160, 160, 160, 160);
gGeo.rotateX(-Math.PI / 2);
const pos = gGeo.attributes.position;
for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
gGeo.computeVertexNormals();
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardNodeMaterial({ color: 0x8a4a3c, roughness: 1 }));
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
  new THREE.MeshStandardNodeMaterial({ color: 0x3a7bd5, transparent: true, opacity: 0.55 }),
);
water.position.set(POOL.x, SEA, POOL.z);
app.scene.add(ground, water);

const player = createPlayer(env);
const s = player.state;
const follow = createFollowCamera({ floorAt: (x, z) => walkFloor(heightAt(x, z), SEA, false) });
const character = createCharacter(auto ? { lookBackDelay: [1.5, 1.5] } : undefined);
app.scene.add(character.root);
const input = createInput(app.renderer.domElement);
const camTarget = { x: s.x, y: s.y, z: s.z };
follow.snap(camTarget, false);

// Scripted intents for ?auto: [start, end, moveZ, sprint]; jumps are pulses at fixed times.
const SCRIPT: [number, number, number, boolean][] = [
  [5, 7.5, 1, false], [7.5, 9, 1, true], [13, 17, 1, false], [22, 27, -1, false], [27, 29, 1, false],
];
const JUMPS = [10, 11.2];
const LOOP = 34;
let clock = 0;
const idleIntents: PlayerIntents = { moveX: 0, moveZ: 0, rise: 0, jump: false, sprint: false, camYaw: 0, camPitch: 0 };

let slow = false;
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;left:8px;bottom:8px;font:12px monospace;color:#fff;background:#0009;padding:4px 8px;pointer-events:none';
hud.textContent = auto ? 'auto loop | T slow-mo, R reset' : 'WASD move | Shift sprint | Space jump / rise | drag orbit | T slow-mo | R reset | pool ahead (-z)';
app.ui.appendChild(hud);
function reset() {
  player.teleport(SPAWN.x, SPAWN.z);
  s.heading = 0;
  follow.yaw = 0;
  camTarget.y = s.y;
  follow.snap(camTarget, false);
  clock = 0;
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyT') slow = !slow;
  if (e.code === 'KeyR') reset();
});

app.registerFrameHook((dtReal) => {
  const dt = dtReal * (slow ? 0.25 : 1);
  const it = input.poll(dt);
  follow.orbit(it.orbitYaw, it.orbitPitch);
  let intents: PlayerIntents;
  if (auto) {
    clock += dt;
    if (clock > LOOP) reset();
    const seg = SCRIPT.find(([a, b]) => clock >= a && clock < b);
    idleIntents.moveZ = seg ? seg[2] : 0;
    idleIntents.sprint = !!seg && seg[3];
    idleIntents.jump = JUMPS.some((j) => clock >= j && clock < j + 0.15);
    idleIntents.camYaw = follow.yaw;
    idleIntents.camPitch = follow.pitch;
    intents = idleIntents;
  } else {
    intents = { moveX: it.moveX, moveZ: it.moveZ, rise: it.rise, jump: it.jump, sprint: it.sprint, camYaw: follow.yaw, camPitch: follow.pitch };
  }
  player.update(dt, intents);
  camTarget.x = s.x;
  camTarget.z = s.z;
  camTarget.y = s.mode === 'walk' && !s.grounded ? approach(camTarget.y, s.y, 0.3, dt) : s.y;
  follow.update(dt, camTarget, s.mode === 'swim');
  app.camera.position.set(follow.position.x, follow.position.y, follow.position.z);
  app.camera.lookAt(follow.lookAt.x, follow.lookAt.y, follow.lookAt.z);
  character.setLookTarget?.(app.camera.position);
  character.update(s, dt);
});
(window as unknown as { __ready: boolean }).__ready = true;
