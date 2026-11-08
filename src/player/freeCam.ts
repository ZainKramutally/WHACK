// Free (cinematic) camera: detached from the character, toggled with C (gamepad View/Back). Pure numbers, no three.js:
// player/index.ts copies the pose onto the real camera. Also scriptable through window.lifeCam (wired in main.ts).
//
//   window.lifeCam = {
//     enter(), exit(),                          // enter the free camera from the current pose / ease back to the follow camera
//     set({ pos:[x,y,z], look:[x,y,z], fov? }), // jump to a pose (enters free cam if needed); stops any path
//     path(keys, { loop? }),                    // keys: [{ t, pos, look, fov? }], t in seconds from the start (ascending).
//                                               // Catmull-Rom through pos and look on the render clock; fov interpolates linearly.
//                                               // Returns a Promise that resolves when the path ends (never, when looping, until stop()).
//     stop(),                                   // stop a path where it is (the promise resolves)
//     hideUI(b),                                // hide or show the in-world UI (hidden by default in free cam)
//     state(),                                  // { active, playing, pos, look, fov, speed, uiHidden }
//   }
//   Keys: C toggles (View/Back on a gamepad), H toggles the UI inside free cam, WASD fly, Space/Shift up/down, Ctrl or Alt slow,
//   mouse drag looks, wheel changes fly speed. URL flag ?cinematic starts in free cam with the UI hidden once the character spawns.
import { clamp } from './logic';

export type Vec3 = [number, number, number];
export interface PathKey { t: number; pos: Vec3; look: Vec3; fov?: number }

const PITCH_LIMIT = 1.55;
const MIN_SPEED = 0.5, MAX_SPEED = 400, DEFAULT_SPEED = 8;
const SLOW = 0.2;
const ACCEL_TAU = 0.2; // s: velocity approaches the target with this time constant (smooth, cinematic starts and stops)
export const FLOOR_CLEARANCE = 0.5;

/** Camera never goes below the terrain (it may go under the sea). Pure. */
export function clampAboveFloor(y: number, floor: number, clearance = FLOOR_CLEARANCE): number {
  return Math.max(y, floor + clearance);
}

/** Catmull-Rom point between p1 and p2 at u in 0..1 (uniform). */
export function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, u: number): Vec3 {
  const u2 = u * u, u3 = u2 * u;
  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] = 0.5 * (2 * p1[i]! + (-p0[i]! + p2[i]!) * u + (2 * p0[i]! - 5 * p1[i]! + 4 * p2[i]! - p3[i]!) * u2 + (-p0[i]! + 3 * p1[i]! - 3 * p2[i]! + p3[i]!) * u3);
  }
  return out;
}

export interface PathSample { pos: Vec3; look: Vec3; fov?: number }

/** Pose at time t along the keys (clamped to the ends; with `loop`, wrapped over the total duration). Pure. */
export function samplePath(keys: readonly PathKey[], t: number, loop = false): PathSample {
  const n = keys.length;
  if (n === 0) throw new Error('samplePath: no keys');
  if (n === 1) return { pos: keys[0]!.pos, look: keys[0]!.look, fov: keys[0]!.fov };
  const total = keys[n - 1]!.t - keys[0]!.t;
  let tt = t;
  if (loop && total > 0) tt = keys[0]!.t + (((t - keys[0]!.t) % total) + total) % total;
  tt = clamp(tt, keys[0]!.t, keys[n - 1]!.t);
  let i = 0;
  while (i < n - 2 && tt > keys[i + 1]!.t) i++;
  const a = keys[i]!, b = keys[i + 1]!;
  const span = Math.max(1e-9, b.t - a.t);
  const u = clamp((tt - a.t) / span, 0, 1);
  const prev = keys[i - 1] ?? a, next = keys[i + 2] ?? b;
  const fov = a.fov !== undefined && b.fov !== undefined ? a.fov + (b.fov - a.fov) * u : a.fov ?? b.fov;
  return { pos: catmullRom(prev.pos, a.pos, b.pos, next.pos, u), look: catmullRom(prev.look, a.look, b.look, next.look, u), fov };
}

/** Yaw and pitch (the follow camera's convention: yaw 0 looks down −z, pitch + looks down) for a look direction. */
export function anglesFromDir(dx: number, dy: number, dz: number): { yaw: number; pitch: number } {
  const h = Math.hypot(dx, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: clamp(-Math.atan2(dy, h), -PITCH_LIMIT, PITCH_LIMIT) };
}

/** Look direction of a yaw and pitch. */
export function dirFromAngles(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, -Math.sin(pitch), -Math.cos(yaw) * cp];
}

export interface FreeIntents { moveX: number; moveZ: number; rise: number; orbitYaw: number; orbitPitch: number; zoom: number; slow: boolean }

export interface FreeCam {
  active: boolean;
  readonly pos: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  fov: number;
  speed: number;
  readonly playing: boolean;
  /** Start from this pose (no jump). */
  begin(pos: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, fov: number): void;
  end(): void;
  update(dt: number, it: FreeIntents): void;
  set(pos: Vec3, look: Vec3, fov?: number): void;
  play(keys: PathKey[], loop: boolean): Promise<void>;
  stop(): void;
  /** The point 8 m ahead of the camera: the look target for the hand-off back to the follow camera. */
  aim(): Vec3;
}

export function createFreeCam(env: { floorAt(x: number, z: number): number }): FreeCam {
  const vel = [0, 0, 0];
  let path: { keys: PathKey[]; loop: boolean; t: number; done: () => void } | null = null;
  const c: FreeCam = {
    active: false,
    pos: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    fov: 60,
    speed: DEFAULT_SPEED,
    get playing() { return path !== null; },
    begin(pos, dir, fov) {
      c.active = true;
      Object.assign(c.pos, pos);
      const a = anglesFromDir(dir.x, dir.y, dir.z);
      c.yaw = a.yaw; c.pitch = a.pitch; c.fov = fov;
      vel[0] = vel[1] = vel[2] = 0;
    },
    end() { c.stop(); c.active = false; },
    set(pos, look, fov) {
      c.stop();
      c.pos.x = pos[0]; c.pos.y = pos[1]; c.pos.z = pos[2];
      const a = anglesFromDir(look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]);
      c.yaw = a.yaw; c.pitch = a.pitch;
      if (fov !== undefined) c.fov = fov;
      vel[0] = vel[1] = vel[2] = 0;
    },
    play(keys, loop) {
      c.stop();
      return new Promise<void>((resolve) => {
        path = { keys, loop, t: keys[0]?.t ?? 0, done: resolve };
        if (keys.length) { const s = samplePath(keys, path.t, loop); apply(s); }
      });
    },
    stop() {
      if (!path) return;
      const p = path;
      path = null;
      p.done();
    },
    aim() {
      const d = dirFromAngles(c.yaw, c.pitch);
      return [c.pos.x + d[0] * 8, c.pos.y + d[1] * 8, c.pos.z + d[2] * 8];
    },
    update(dt, it) {
      dt = Math.min(dt, 0.1);
      if (path) {
        path.t += dt;
        const end = path.keys[path.keys.length - 1]?.t ?? 0;
        apply(samplePath(path.keys, path.t, path.loop));
        if (!path.loop && path.t >= end) c.stop();
        return;
      }
      c.yaw += it.orbitYaw;
      c.pitch = clamp(c.pitch + it.orbitPitch, -PITCH_LIMIT, PITCH_LIMIT);
      if (it.zoom) c.speed = clamp(c.speed * Math.exp(-it.zoom * 2), MIN_SPEED, MAX_SPEED);
      const f = dirFromAngles(c.yaw, c.pitch);
      const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
      const sp = c.speed * (it.slow ? SLOW : 1);
      const target = [
        (f[0] * it.moveZ + rx * it.moveX) * sp,
        (f[1] * it.moveZ + it.rise) * sp,
        (f[2] * it.moveZ + rz * it.moveX) * sp,
      ];
      const k = 1 - Math.exp(-dt / ACCEL_TAU);
      for (let i = 0; i < 3; i++) vel[i]! += (target[i]! - vel[i]!) * k;
      c.pos.x += vel[0]! * dt; c.pos.y += vel[1]! * dt; c.pos.z += vel[2]! * dt;
      c.pos.y = clampAboveFloor(c.pos.y, env.floorAt(c.pos.x, c.pos.z));
    },
  };
  function apply(s: PathSample) {
    c.pos.x = s.pos[0]; c.pos.y = clampAboveFloor(s.pos[1], env.floorAt(s.pos[0], s.pos[2])); c.pos.z = s.pos[2];
    const a = anglesFromDir(s.look[0] - s.pos[0], s.look[1] - c.pos.y, s.look[2] - s.pos[2]);
    c.yaw = a.yaw; c.pitch = a.pitch;
    if (s.fov !== undefined) c.fov = s.fov;
  }
  return c;
}
