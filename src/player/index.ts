// Third-person player: input → controller → follow camera → character mesh.
// Decoupled from the scene: it needs a scene to add the mesh to, the camera to drive, the canvas for input,
// and a PlayerEnv (terrain / sea samplers). Call update(dt) once per frame.
import * as THREE from 'three/webgpu';
import { createFollowCamera, type CameraTuning } from './camera';
import { createCharacter, tuningFor } from './character';
import { createPlayer, type PlayerEnv, type PlayerState, type PlayerTuning } from './controller';
import { createInput, type InputCallbacks, type InputKind, type InputOptions } from './input';
import { approach, easeSprintFov, walkFloor } from './logic';
import { createFreeCam, dirFromAngles, type PathKey, type Vec3 } from './freeCam';

export type { PlayerEnv, PlayerState, PlayerTuning, CameraTuning, InputCallbacks, InputKind };

export interface AttachedPlayer {
  update(dt: number): void;
  dispose(): void;
  readonly state: PlayerState;
  /** Last device used: drives the controls hint and the gamepad reticle. */
  readonly lastUsed: InputKind;
  /** Show the centre reticle (gamepad is the last-used input). */
  readonly reticleVisible: boolean;
  /** Move the player (e.g. to the spawn point once the ground is solid) and snap the camera. */
  respawn(x: number, z: number, fromCamera?: boolean): void;
  setVisible(v: boolean): void;
  /** Grow the character in from its feet: 0 hides it, 1 is full size (the spawn ramp). */
  setAppear(k: number): void;
  /** The free (cinematic) camera: detached from the character, scriptable (see player/freeCam.ts). */
  readonly free: {
    readonly active: boolean;
    enter(): void;
    /** Ease back to the follow camera (about 0.6 s). */
    exit(): void;
    toggle(): void;
    set(pose: { pos: Vec3; look: Vec3; fov?: number }): void;
    path(keys: PathKey[], opts?: { loop?: boolean }): Promise<void>;
    stop(): void;
    state(): { active: boolean; playing: boolean; pos: Vec3; look: Vec3; fov: number; speed: number };
  };
}

export interface AttachOptions {
  callbacks?: InputCallbacks;
  input?: InputOptions;
  player?: Partial<PlayerTuning>;
  camera?: Partial<CameraTuning>;
  /** Degrees the FOV widens while sprinting (render-only). */
  sprintFovDeg?: number;
}

export function attachPlayer(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  env: PlayerEnv,
  opts: AttachOptions = {},
): AttachedPlayer {
  const input = createInput(domElement, opts.callbacks, opts.input);
  // The character sets the tuning that depends on its size (explicit options still win).
  const character = createCharacter();
  const tuning = tuningFor(character.dims);
  const player = createPlayer(env, { ...tuning.player, ...opts.player });
  const follow = createFollowCamera(
    { floorAt: (x, z) => walkFloor(env.heightAt(x, z), env.seaLevel(), env.frozen()) },
    { ...tuning.camera, ...opts.camera },
  );
  scene.add(character.root);

  const s = player.state;
  const baseFov = camera.fov;
  const sprintFovDeg = opts.sprintFovDeg ?? 6;
  let fovExtra = 0;
  const camTarget = { x: s.x, y: s.y, z: s.z }; // y eases while airborne so jumps don't yank the camera
  follow.snap(camTarget, s.mode === 'swim');
  camera.position.set(follow.position.x, follow.position.y, follow.position.z);
  camera.lookAt(follow.lookAt.x, follow.lookAt.y, follow.lookAt.z);

  // Free camera: floor is the terrain (or the ice on a frozen sea); the sea itself is not a floor, so it can go underwater.
  const freeCam = createFreeCam({ floorAt: (x, z) => (env.frozen() ? Math.max(env.heightAt(x, z), env.seaLevel()) : env.heightAt(x, z)) });
  const idle = { moveX: 0, moveZ: 0, rise: 0, jump: false, sprint: false };
  const applyFree = () => {
    const d = dirFromAngles(freeCam.yaw, freeCam.pitch);
    camera.position.set(freeCam.pos.x, freeCam.pos.y, freeCam.pos.z);
    camera.lookAt(freeCam.pos.x + d[0], freeCam.pos.y + d[1], freeCam.pos.z + d[2]);
    if (camera.fov !== freeCam.fov) { camera.fov = freeCam.fov; camera.updateProjectionMatrix(); }
  };
  const enterFree = () => {
    if (freeCam.active) return;
    camera.updateMatrixWorld();
    const dir = camera.getWorldDirection(new THREE.Vector3());
    freeCam.begin(camera.position, dir, camera.fov);
    input.setFree(true);
  };
  const exitFree = () => {
    if (!freeCam.active) return;
    const pos = { x: freeCam.pos.x, y: freeCam.pos.y, z: freeCam.pos.z };
    const aim = freeCam.aim();
    freeCam.end();
    input.setFree(false);
    camTarget.y = s.y;
    follow.setFromPose(pos, { x: aim[0], y: aim[1], z: aim[2] }, camTarget, s.mode === 'swim');
    fovExtra = 0;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  };
  const free: AttachedPlayer['free'] = {
    get active() { return freeCam.active; },
    enter: enterFree,
    exit: exitFree,
    toggle() { if (freeCam.active) exitFree(); else enterFree(); },
    set({ pos, look, fov }) { enterFree(); freeCam.set(pos, look, fov); applyFree(); },
    path(keys, o = {}) { enterFree(); return freeCam.play(keys, !!o.loop); },
    stop() { freeCam.stop(); },
    state() {
      const d = dirFromAngles(freeCam.yaw, freeCam.pitch);
      const p: Vec3 = freeCam.active ? [freeCam.pos.x, freeCam.pos.y, freeCam.pos.z] : [camera.position.x, camera.position.y, camera.position.z];
      return { active: freeCam.active, playing: freeCam.playing, pos: p, look: [p[0] + d[0], p[1] + d[1], p[2] + d[2]], fov: camera.fov, speed: freeCam.speed };
    },
  };

  return {
    free,
    state: s,
    get lastUsed() {
      return input.lastUsed;
    },
    get reticleVisible() {
      return input.lastUsed === 'gamepad';
    },
    update(dt) {
      const it = input.poll(dt);
      if (freeCam.active) {
        // Detached: the character idles (the sim and its own animation carry on) and the intents fly the camera.
        freeCam.update(dt, it);
        applyFree();
        player.update(dt, { ...idle, camYaw: follow.yaw, camPitch: follow.pitch });
        character.update(s, dt);
        return;
      }
      follow.orbit(it.orbitYaw, it.orbitPitch);
      if (it.zoom) follow.zoom(it.zoom);
      player.update(dt, {
        moveX: it.moveX,
        moveZ: it.moveZ,
        rise: it.rise,
        jump: it.jump,
        sprint: it.sprint,
        camYaw: follow.yaw,
        camPitch: follow.pitch,
      });
      camTarget.x = s.x;
      camTarget.z = s.z;
      camTarget.y = s.mode === 'walk' && !s.grounded ? approach(camTarget.y, s.y, 0.3, dt) : s.y;
      follow.update(dt, camTarget, s.mode === 'swim');
      camera.position.set(follow.position.x, follow.position.y, follow.position.z);
      camera.lookAt(follow.lookAt.x, follow.lookAt.y, follow.lookAt.z);
      character.setLookTarget?.(camera.position);
      character.update(s, dt);
      fovExtra = easeSprintFov(fovExtra, s.sprinting, sprintFovDeg, dt);
      const fov = baseFov + (fovExtra < 0.005 ? 0 : fovExtra);
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
    respawn(x, z, fromCamera = false) {
      // Hand-off from another camera (the Generate transition): read its pose before anything moves.
      let pose: { p: { x: number; y: number; z: number }; aim: { x: number; y: number; z: number } } | null = null;
      if (fromCamera) {
        camera.updateMatrixWorld();
        const dir = camera.getWorldDirection(new THREE.Vector3());
        const p = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        pose = { p, aim: { x: p.x + dir.x * 8, y: p.y + dir.y * 8, z: p.z + dir.z * 8 } };
      }
      player.teleport(x, z);
      camTarget.y = s.y;
      if (pose) follow.setFromPose(pose.p, pose.aim, camTarget, s.mode === 'swim');
      else follow.snap(camTarget, s.mode === 'swim');
    },
    setVisible(v) {
      character.root.visible = v;
      if (v) character.root.scale.setScalar(1);
    },
    setAppear(k) {
      character.root.visible = k > 0;
      character.root.scale.setScalar(Math.max(k, 0.001));
    },
    dispose() {
      input.dispose();
      scene.remove(character.root);
      character.dispose();
    },
  };
}
