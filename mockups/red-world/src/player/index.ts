// Third-person player: hero shot → eased fly-in → follow camera behind the explorer. Walk, run, fly, collide.
// Camera follow is an exponential lerp of a focus point (Bruno Simon folio-2025 View.js technique, MIT); the shadow
// camera follows the focus (his Lighting.js), snapped to shadow texels in light space so shadows don't shimmer.
import * as THREE from 'three/webgpu';
import type { PlantInstance, SpeciesId } from '../contracts';
import { heightAt } from '../field';
import { U } from '../material';
import { poseExplorer } from '../explorer';
import { createInput, type InputState } from './input';
import { createHint } from './hint';
import { CircleGrid, LandGrid, plantColliders } from './colliders';
import { moveVector, clampPitch, resolveCircles, clampDisc, edgeSlow, damp, angleDelta, easeInOutCubic, insideCircles, marchBoom, type Disc } from './math';

/** Tunables (metres, seconds, radians). */
export const MOVE = {
  walk: 6, runK: 3, fly: 36, flyUp: 22, altMax: 400,
  radius: 0.45, bodyH: 1.8, step: 2,
  accelWalk: 10, accelFly: 2.6,
  focusRate: 12, zoomRate: 8, turnRate: 10,
  distDefault: 9, distMin: 3, distMax: 40, pitchDefault: 0.22,
  transition: 1.5, lookK: 0.0045,
  shadowAhead: 200, lightDist: 2500,
  boomIn: 25, boomOut: 2.5,          // pull-in when blocked (fast), ease back out (slow)
  yawLag: 14, rollK: 0.6, rollMax: 0.035,
  fovRun: 7, fovFly: 9, fovRate: 3,
  fgPlayer: 0.35,                     // foreground value push in player mode, × hero value
};
/** Walkable world: a disc around the composed area. rw-scene may move or grow it as the map fills. */
export const WORLD_DISC: Disc = { x: 0, z: -300, r: 1900 }; // rw-scene: matches the 360° world (fine terrain ±2.4 km)

export interface PlayerDeps {
  dom: HTMLElement;
  camera: any;
  light: any;
  explorer: any;
  landforms: any;
  plants: readonly PlantInstance[];
  heightOf: (s: SpeciesId, v: number) => number;
  tour?: boolean;
}

export function createPlayer(d: PlayerDeps) {
  const { camera, light, explorer } = d;
  const grid = new CircleGrid(plantColliders(d.plants, d.heightOf, heightAt), 40, MOVE.radius + 0.5);
  const land = buildLandGrid(d.landforms);
  const hint = createHint();

  let mode: 'hero' | 'transition' | 'follow' = 'hero';
  let trans = 0;
  const fromPos = new THREE.Vector3(), fromQuat = new THREE.Quaternion();
  const start = () => {
    if (mode !== 'hero') return;
    mode = 'transition'; trans = 0;
    fromPos.copy(camera.position); fromQuat.copy(camera.quaternion);
    camera.near = 0.3; camera.updateProjectionMatrix();
    hint.activate();
  };
  const fgHero = U.fgPush.value, fovBase = camera.fov;
  let fov = fovBase, yawS = 0, roll = 0, boom = MOVE.distDefault, dipT = Infinity, dipA = 0;
  const input = d.tour ? tourInput(start) : createInput(d.dom, start);

  // player body
  const p = { x: explorer.position.x, y: heightAt(explorer.position.x, explorer.position.z), z: explorer.position.z };
  const v = { x: 0, y: 0, z: 0 };
  let flying = false, grounded = true, facing = explorer.rotation.y, phase = 0, gait = 0;
  // camera rig
  let yaw = 0, pitch = MOVE.pitchDefault, dist = MOVE.distDefault, distS = dist;
  const focus = new THREE.Vector3(p.x, p.y + 1.4, p.z);
  const camPos = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  // light-space basis for texel snapping
  const lightRot = new THREE.Matrix4().lookAt(U.lightDir.value, new THREE.Vector3(), UP);
  const lightInv = lightRot.clone().invert();
  const sc = light.shadow.camera;
  const texel = (sc.right - sc.left) / light.shadow.mapSize.x;
  const tmp = new THREE.Vector3(), rollQ = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);

  const groundAt = (x: number, z: number, y: number) => Math.max(heightAt(x, z), land.topNear(x, z, y, MOVE.step));

  function step(dt: number, s: InputState) {
    // look + zoom
    yaw -= s.lookDX * MOVE.lookK;
    pitch = clampPitch(pitch + s.lookDY * MOVE.lookK);
    dist = Math.min(MOVE.distMax, Math.max(MOVE.distMin, dist * Math.pow(1.15, s.zoom)));
    distS += (dist - distS) * damp(MOVE.zoomRate, dt);
    for (let i = 0; i < s.flyToggles; i++) { flying = !flying; if (flying) { grounded = false; v.y = Math.max(v.y, 4); } }
    if (s.forward || s.right || s.up) hint.moved();

    // horizontal velocity: camera-relative, eased (snappy on foot, gliding in the air), soft at the world edge
    const run = s.run ? MOVE.runK : 1;
    let [mx, mz] = moveVector(s.forward, s.right, yaw);
    [mx, mz] = edgeSlow(p.x, p.z, mx, mz, WORLD_DISC, 80);
    const sp = (flying ? MOVE.fly : MOVE.walk) * run;
    const a = damp(flying ? MOVE.accelFly : MOVE.accelWalk, dt);
    v.x += (mx * sp - v.x) * a; v.z += (mz * sp - v.z) * a;

    // vertical: flight is eased; off, the player settles to the ground with an eased fall (fast high up, gentle at touchdown)
    const g0 = groundAt(p.x, p.z, p.y);
    if (flying) v.y += (s.up * MOVE.flyUp * run - v.y) * damp(MOVE.accelFly, dt);
    else if (!grounded) v.y += (-Math.min(80, 2.4 * (p.y - g0) + 3) - v.y) * damp(3, dt);

    // integrate + collide
    let nx = p.x + v.x * dt, nz = p.z + v.z * dt, ny = p.y + v.y * dt;
    [nx, nz] = resolveCircles(nx, nz, MOVE.radius, ny, grid.near(nx, nz));
    if (land.blocked(nx, nz, ny, MOVE.bodyH)) {
      if (!land.blocked(nx, p.z, ny, MOVE.bodyH)) nz = p.z;
      else if (!land.blocked(p.x, nz, ny, MOVE.bodyH)) nx = p.x;
      else { nx = p.x; nz = p.z; }
      if (land.blocked(nx, nz, ny, MOVE.bodyH)) { ny = p.y; v.y = 0; }
    }
    [nx, nz] = clampDisc(nx, nz, WORLD_DISC);
    const g = groundAt(nx, nz, ny);
    if (flying) {
      ny = Math.min(Math.max(ny, g), heightAt(nx, nz) + MOVE.altMax);
      if (ny <= g + 1e-3 && v.y < 0) v.y = 0;
    } else if (grounded ? ny - g < MOVE.step : ny <= g + 0.05) {
      if (!grounded && v.y < -2) { dipT = 0; dipA = Math.min(0.7, 0.2 + -v.y * 0.025); } // soft landing dip
      ny = g; v.y = 0; grounded = true;
    } else grounded = false;
    p.x = nx; p.y = ny; p.z = nz;

    // body: face the move direction, gait from ground speed
    const hs = Math.hypot(v.x, v.z);
    if (hs > 0.3) facing += angleDelta(facing, Math.atan2(-v.x, -v.z)) * damp(MOVE.turnRate, dt);
    gait += ((grounded && !flying ? Math.min(1, hs / MOVE.walk) : 0) - gait) * damp(8, dt);
    phase += (grounded ? hs / (1.1 + hs * 0.07) : 1.5) * dt * Math.PI * 0.5;
    poseExplorer(explorer, {
      x: p.x, y: p.y, z: p.z, yaw: facing, phase, gait,
      lean: flying ? Math.min(0.35, hs / MOVE.fly * 0.25) : Math.min(0.22, hs / (MOVE.walk * MOVE.runK) * 0.22), roll: 0, flying,
    });
  }

  const boomBlocked = (x: number, y: number, z: number) =>
    land.blocked(x, z, y - 0.3, 0.6) || insideCircles(x, z, y, 0.35, grid.near(x, z));

  function followPose(dt: number, snap: boolean) {
    tmp.set(p.x, p.y + 1.4, p.z);
    if (snap) { focus.copy(tmp); yawS = yaw; } else focus.lerp(tmp, damp(MOVE.focusRate, dt));
    // landing dip: quick drop, eased recovery
    dipT += dt;
    const dip = dipT < 0.1 ? dipA * (dipT / 0.1) : dipA * Math.exp(-(dipT - 0.1) * 5);
    // turn lag + roll (Bruno View.js feel): the boom yaw trails the input yaw, the lag tilts the horizon slightly
    const lagged = angleDelta(yawS, yaw);
    yawS += lagged * (snap ? 1 : damp(MOVE.yawLag, dt));
    roll += (Math.max(-MOVE.rollMax, Math.min(MOVE.rollMax, -angleDelta(yawS, yaw) * MOVE.rollK)) - roll) * damp(8, dt);
    const cp = Math.cos(pitch);
    const dx = Math.sin(yawS) * cp, dy = Math.sin(pitch), dz = Math.cos(yawS) * cp;
    // boom pull-in against trunks and landforms; snap in, ease back out
    const clear = marchBoom(focus.x, focus.y, focus.z, dx, dy, dz, distS, boomBlocked);
    boom = clear < boom || snap ? clear : boom + (clear - boom) * damp(MOVE.boomOut, dt);
    camPos.set(focus.x + dx * boom, focus.y + dy * boom - dip, focus.z + dz * boom);
    // terrain-avoid: keep the eye above the ground at the camera and halfway back to the focus
    const gy = Math.max(heightAt(camPos.x, camPos.z), heightAt((camPos.x + focus.x) / 2, (camPos.z + focus.z) / 2) - 0.4) + 0.7;
    if (camPos.y < gy) camPos.y = gy;
    tmp.set(focus.x, focus.y - dip, focus.z);
    m4.lookAt(camPos, tmp, UP);
    q.setFromRotationMatrix(m4);
    if (roll) q.multiply(rollQ.setFromAxisAngle(Z, roll));
  }

  function feel(dt: number, k: number) {
    // FOV widens with speed (running, flying); the foreground push lightens during the fly-in
    const hs = Math.hypot(v.x, v.z);
    const run = flying
      ? Math.min(1, hs / (MOVE.fly * MOVE.runK) + Math.abs(v.y) / (MOVE.flyUp * MOVE.runK) * 0.5)
      : Math.max(0, Math.min(1, (hs - MOVE.walk * 1.2) / (MOVE.walk * (MOVE.runK - 1.2))));
    const target = fovBase + k * run * (flying ? MOVE.fovFly : MOVE.fovRun);
    fov += (target - fov) * damp(MOVE.fovRate, dt);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    U.fgPush.value = fgHero * (1 - k * (1 - MOVE.fgPlayer));
  }

  function followShadow() {
    // centre the shadow box ahead of the focus (most of what is seen), snapped to texels in light space
    tmp.set(focus.x - Math.sin(yaw) * MOVE.shadowAhead, 0, focus.z - Math.cos(yaw) * MOVE.shadowAhead);
    tmp.y = heightAt(tmp.x, tmp.z);
    tmp.applyMatrix4(lightInv);
    tmp.x = Math.round(tmp.x / texel) * texel; tmp.y = Math.round(tmp.y / texel) * texel;
    tmp.applyMatrix4(lightRot);
    light.target.position.copy(tmp);
    light.position.copy(tmp).addScaledVector(U.lightDir.value, MOVE.lightDist);
  }

  return {
    /** Advance one frame. Returns false while the hero shot owns the camera. */
    update(dt: number): boolean {
      const s = input.poll();
      if (mode === 'hero') return false;
      step(dt, s);
      if (mode === 'transition') {
        followPose(dt, trans === 0);
        trans += dt;
        const k = easeInOutCubic(Math.min(1, trans / MOVE.transition));
        camera.position.lerpVectors(fromPos, camPos, k);
        camera.quaternion.slerpQuaternions(fromQuat, q, k);
        feel(dt, k);
        if (trans >= MOVE.transition) mode = 'follow';
      } else {
        followPose(dt, false);
        camera.position.copy(camPos);
        camera.quaternion.copy(q);
        feel(dt, 1);
      }
      followShadow();
      return true;
    },
    get state() { return { mode, flying, grounded, x: p.x, y: p.y, z: p.z, yaw, pitch, dist, boom, fov: camera.fov, roll, fgPush: U.fgPush.value }; },
    debug: { land, grid },
  };
}

/** Rasterise every landform mesh (world space) into the occupancy grid covering the walkable disc. */
function buildLandGrid(group: any): LandGrid {
  const r = WORLD_DISC.r + 40;
  const lg = new LandGrid(WORLD_DISC.x - r, WORLD_DISC.z - r, r * 2, 4);
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  group.traverse((o: any) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    lg.addTriangles(out);
  });
  return lg;
}

/** #tour: a scripted input path for fps measurement: fly-in, run up the riverbed, then fly up and look down. */
function tourInput(start: () => void) {
  const t0 = performance.now();
  let flew = false, started = false;
  return {
    poll(): InputState {
      const t = (performance.now() - t0) / 1000;
      const s: InputState = { forward: 0, right: 0, up: 0, run: false, lookDX: 0, lookDY: 0, zoom: 0, flyToggles: 0 };
      if (t > 0.5 && !started) { started = true; start(); }
      if (t > 2.2 && t < 12) { s.forward = 1; s.run = t > 4; s.lookDX = Math.sin(t * 0.6) * 1.5; }
      if (t > 12 && !flew) { flew = true; s.flyToggles = 1; }
      if (t > 12 && t < 22) { s.up = 1; s.forward = 0.6; s.run = true; }
      if (t > 20 && t < 23) s.lookDY = 4;
      if (t > 23 && t < 26) s.zoom = 0.4;
      return s;
    },
  };
}
