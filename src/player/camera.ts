// Spring follow camera with orbit. Pure numbers; index.ts copies the result onto the three.js camera.
// Yaw/pitch follow the controller's convention: yaw 0 looks down -z; pitch + = camera above, looking down.
import { clamp, smoothDamp } from './logic';

export interface CameraTuning {
  distance: number;      // m behind the target
  swimDistance: number;
  targetHeight: number;  // m above the feet that the camera looks at
  smoothTime: number;    // s, position spring
  lookSmoothTime: number;
  walkPitch: [number, number];
  swimPitch: [number, number];
  minClearance: number;  // m above terrain (or ice)
}

export const DEFAULT_CAMERA_TUNING: CameraTuning = {
  distance: 5.5,
  swimDistance: 6.5,
  targetHeight: 1.4,
  smoothTime: 0.12,
  lookSmoothTime: 0.06,
  walkPitch: [-0.25, 1.25],
  swimPitch: [-1.3, 1.3],
  minClearance: 0.6,
};

export interface CameraEnv {
  /** Height the camera must stay above at (x, z): terrain, or the ice on a frozen sea. */
  floorAt(x: number, z: number): number;
}

export interface FollowCamera {
  yaw: number;
  pitch: number;
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  orbit(dYaw: number, dPitch: number): void;
  update(dt: number, target: { x: number; y: number; z: number }, swimming: boolean): void;
  snap(target: { x: number; y: number; z: number }, swimming: boolean): void;
}

export function createFollowCamera(env: CameraEnv, tuning: Partial<CameraTuning> = {}): FollowCamera {
  const t: CameraTuning = { ...DEFAULT_CAMERA_TUNING, ...tuning };
  const vel = { x: 0, y: 0, z: 0 };
  const lookVel = { x: 0, y: 0, z: 0 };
  let dist = t.distance;
  let distVel = 0;

  function desired(target: { x: number; y: number; z: number }, d: number) {
    const cp = Math.cos(cam.pitch);
    const tx = target.x;
    const ty = target.y + t.targetHeight;
    const tz = target.z;
    return {
      look: { x: tx, y: ty, z: tz },
      pos: {
        x: tx + Math.sin(cam.yaw) * cp * d,
        y: ty + Math.sin(cam.pitch) * d,
        z: tz + Math.cos(cam.yaw) * cp * d,
      },
    };
  }

  const cam: FollowCamera = {
    yaw: 0,
    pitch: 0.35,
    position: { x: 0, y: 0, z: 0 },
    lookAt: { x: 0, y: 0, z: 0 },
    orbit(dYaw, dPitch) {
      cam.yaw += dYaw;
      cam.pitch += dPitch;
    },
    update(dt, target, swimming) {
      dt = Math.min(dt, 0.1);
      const [lo, hi] = swimming ? t.swimPitch : t.walkPitch;
      cam.pitch = clamp(cam.pitch, lo, hi);
      [dist, distVel] = smoothDamp(dist, swimming ? t.swimDistance : t.distance, distVel, 0.4, dt);
      const d = desired(target, dist);
      const p = cam.position;
      [p.x, vel.x] = smoothDamp(p.x, d.pos.x, vel.x, t.smoothTime, dt);
      [p.y, vel.y] = smoothDamp(p.y, d.pos.y, vel.y, t.smoothTime, dt);
      [p.z, vel.z] = smoothDamp(p.z, d.pos.z, vel.z, t.smoothTime, dt);
      const l = cam.lookAt;
      [l.x, lookVel.x] = smoothDamp(l.x, d.look.x, lookVel.x, t.lookSmoothTime, dt);
      [l.y, lookVel.y] = smoothDamp(l.y, d.look.y, lookVel.y, t.lookSmoothTime, dt);
      [l.z, lookVel.z] = smoothDamp(l.z, d.look.z, lookVel.z, t.lookSmoothTime, dt);
      // Never below the ground. Applied after the spring so the clamp is exact, and the spring state follows it.
      const minY = env.floorAt(p.x, p.z) + t.minClearance;
      if (p.y < minY) {
        p.y = minY;
        vel.y = Math.max(0, vel.y);
      }
    },
    snap(target, swimming) {
      dist = swimming ? t.swimDistance : t.distance;
      distVel = 0;
      const d = desired(target, dist);
      Object.assign(cam.position, d.pos);
      Object.assign(cam.lookAt, d.look);
      vel.x = vel.y = vel.z = lookVel.x = lookVel.y = lookVel.z = 0;
      cam.position.y = Math.max(cam.position.y, env.floorAt(cam.position.x, cam.position.z) + t.minClearance);
    },
  };
  return cam;
}
