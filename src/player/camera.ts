// Spring follow camera with orbit. Pure numbers; index.ts copies the result onto the three.js camera.
// Yaw/pitch follow the controller's convention: yaw 0 looks down -z; pitch + = camera above, looking down.
import { clamp, smoothDamp } from './logic';

export interface CameraTuning {
  distance: number;      // m behind the target
  swimDistance: number;
  targetHeight: number;  // m above the feet that the camera looks at
  smoothTime: number;    // s, position spring
  swimSmoothTime: number; // s, tighter spring while swimming at speed
  lookSmoothTime: number;
  walkPitch: [number, number];
  swimPitch: [number, number];
  minClearance: number;  // m above terrain (or ice)
  zoomRange: [number, number]; // m, min/max follow distance
}

export const DEFAULT_CAMERA_TUNING: CameraTuning = {
  distance: 5.5,
  swimDistance: 6.5,
  targetHeight: 1.4,
  smoothTime: 0.12,
  swimSmoothTime: 0.09,
  lookSmoothTime: 0.06,
  walkPitch: [-1.55, 1.55], // almost straight up/down; stops short of ±π/2 so lookAt can't flip
  swimPitch: [-1.55, 1.55],
  minClearance: 0.6,
  zoomRange: [1.2, 150],
};

/**
 * Orbit parameters (yaw, pitch, distance) that put the follow camera exactly at `pos` while it looks at `focus`
 * (the character's look point). Distance and pitch are clamped into the zoom and pitch ranges. Pure.
 */
export function poseToOrbit(
  pos: { x: number; y: number; z: number }, focus: { x: number; y: number; z: number },
  zoomRange: [number, number], pitchRange: [number, number],
): { yaw: number; pitch: number; dist: number } {
  const dx = pos.x - focus.x, dy = pos.y - focus.y, dz = pos.z - focus.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return { yaw: 0, pitch: 0.35, dist: clamp(DEFAULT_CAMERA_TUNING.distance, zoomRange[0], zoomRange[1]) };
  return {
    yaw: Math.atan2(dx, dz),
    pitch: clamp(Math.asin(clamp(dy / len, -1, 1)), pitchRange[0], pitchRange[1]),
    dist: clamp(len, zoomRange[0], zoomRange[1]),
  };
}

/** Seconds over which the look point eases from the hand-off aim to the character. */
const LOOK_EASE = 0.5;

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
  /** Exponential zoom: positive zooms out, negative in (log-distance units). Applies to the current mode. */
  zoom(logDelta: number): void;
  update(dt: number, target: { x: number; y: number; z: number }, swimming: boolean): void;
  snap(target: { x: number; y: number; z: number }, swimming: boolean): void;
  /**
   * Hand-off from another camera: start exactly at `position` looking at `aim`, with yaw, pitch and zoom derived from
   * that pose relative to `target`, so the first frame matches the last one. The look point then eases from `aim` to
   * the character over about 0.5 s. Spring velocities are zeroed; the zoom stays until the player changes it.
   */
  setFromPose(position: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, swimming: boolean): void;
}

export function createFollowCamera(env: CameraEnv, tuning: Partial<CameraTuning> = {}): FollowCamera {
  const t: CameraTuning = { ...DEFAULT_CAMERA_TUNING, ...tuning };
  const vel = { x: 0, y: 0, z: 0 };
  const lookVel = { x: 0, y: 0, z: 0 };
  let walkTarget = t.distance;
  let swimTarget = t.swimDistance;
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

  let lastSwim = false;
  let lookT = LOOK_EASE;
  const lookFrom = { x: 0, y: 0, z: 0 };
  const cam: FollowCamera = {
    yaw: 0,
    pitch: 0.35,
    position: { x: 0, y: 0, z: 0 },
    lookAt: { x: 0, y: 0, z: 0 },
    zoom(logDelta) {
      const [lo, hi] = t.zoomRange;
      if (lastSwim) swimTarget = clamp(swimTarget * Math.exp(logDelta), lo, hi);
      else walkTarget = clamp(walkTarget * Math.exp(logDelta), lo, hi);
    },
    orbit(dYaw, dPitch) {
      cam.yaw += dYaw;
      cam.pitch += dPitch;
    },
    update(dt, target, swimming) {
      dt = Math.min(dt, 0.1);
      lastSwim = swimming;
      const [lo, hi] = swimming ? t.swimPitch : t.walkPitch;
      cam.pitch = clamp(cam.pitch, lo, hi);
      [dist, distVel] = smoothDamp(dist, swimming ? swimTarget : walkTarget, distVel, 0.15, dt);
      const d = desired(target, dist);
      const st = swimming ? t.swimSmoothTime : t.smoothTime;
      const p = cam.position;
      [p.x, vel.x] = smoothDamp(p.x, d.pos.x, vel.x, st, dt);
      [p.y, vel.y] = smoothDamp(p.y, d.pos.y, vel.y, st, dt);
      [p.z, vel.z] = smoothDamp(p.z, d.pos.z, vel.z, st, dt);
      const l = cam.lookAt;
      if (lookT < LOOK_EASE) {
        lookT += dt;
        const u = clamp(lookT / LOOK_EASE, 0, 1), k = u * u * (3 - 2 * u);
        l.x = lookFrom.x + (d.look.x - lookFrom.x) * k;
        l.y = lookFrom.y + (d.look.y - lookFrom.y) * k;
        l.z = lookFrom.z + (d.look.z - lookFrom.z) * k;
        lookVel.x = lookVel.y = lookVel.z = 0;
      } else [l.x, lookVel.x] = smoothDamp(l.x, d.look.x, lookVel.x, t.lookSmoothTime, dt);
      if (lookT >= LOOK_EASE) {
        [l.y, lookVel.y] = smoothDamp(l.y, d.look.y, lookVel.y, t.lookSmoothTime, dt);
        [l.z, lookVel.z] = smoothDamp(l.z, d.look.z, lookVel.z, t.lookSmoothTime, dt);
      }
      // Never below the ground. Applied after the spring so the clamp is exact, and the spring state follows it.
      const minY = env.floorAt(p.x, p.z) + t.minClearance;
      if (p.y < minY) {
        // Lift the camera onto the clamp but shift the look point by the same amount, so the view
        // direction keeps following the orbit pitch (you can look up past the character).
        l.y += minY - p.y;
        p.y = minY;
        vel.y = Math.max(0, vel.y);
      }
    },
    setFromPose(position, aim, target, swimming) {
      lastSwim = swimming;
      const focus = { x: target.x, y: target.y + t.targetHeight, z: target.z };
      const o = poseToOrbit(position, focus, t.zoomRange, swimming ? t.swimPitch : t.walkPitch);
      cam.yaw = o.yaw; cam.pitch = o.pitch;
      dist = o.dist; distVel = 0;
      if (swimming) swimTarget = o.dist; else walkTarget = o.dist;
      Object.assign(cam.position, position);
      Object.assign(cam.lookAt, aim);
      Object.assign(lookFrom, aim);
      lookT = 0;
      vel.x = vel.y = vel.z = lookVel.x = lookVel.y = lookVel.z = 0;
    },
    snap(target, swimming) {
      lookT = LOOK_EASE;
      lastSwim = swimming;
      dist = swimming ? swimTarget : walkTarget;
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
