// Third-person player: input → controller → follow camera → character mesh.
// Decoupled from the scene: it needs a scene to add the mesh to, the camera to drive, the canvas for input,
// and a PlayerEnv (terrain / sea samplers). Call update(dt) once per frame.
import * as THREE from 'three/webgpu';
import { createFollowCamera, type CameraTuning } from './camera';
import { createCharacter, tuningFor } from './character';
import { createPlayer, type PlayerEnv, type PlayerState, type PlayerTuning } from './controller';
import { createInput, type InputCallbacks, type InputKind, type InputOptions } from './input';
import { approach, easeSprintFov, walkFloor } from './logic';

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

  return {
    state: s,
    get lastUsed() {
      return input.lastUsed;
    },
    get reticleVisible() {
      return input.lastUsed === 'gamepad';
    },
    update(dt) {
      const it = input.poll(dt);
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
