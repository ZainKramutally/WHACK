// Character controller: walk on the sampled terrain, swim in liquid seas, stand on frozen ones.
// Pure numbers; no three.js. Convention: camera yaw 0 looks down -z; forward = (-sin yaw, -cos yaw).
import { angleDelta, approach, clamp, decideMode, walkFloor, type PlayerMode } from './logic';

export interface PlayerEnv {
  heightAt(x: number, z: number): number;
  seaLevel(): number;
  frozen(): boolean;
  spawn: { x: number; z: number };
}

export interface PlayerTuning {
  walkSpeed: number;      // m/s
  swimSpeed: number;      // m/s, horizontal and along the view direction
  riseSpeed: number;      // m/s, Space / Shift / bumpers
  waterDrag: number;      // 0..1 speed lost wading in the shallows
  walkAccelTime: number;  // s, SmoothDamp time for ground velocity
  swimAccelTime: number;  // s, water is thicker
  groundFollow: number;   // 1/s, how fast y tracks the terrain
  turnRate: number;       // rad/s, how fast the body turns to face travel
  swimSurfaceOffset: number; // feet sit this far below the surface when floating
  swimClearance: number;  // minimum height above the sea floor
  sprintMul: number;      // walkSpeed multiplier while sprinting on land
  maxSpeed: number;       // hard cap on speed in the water
  sprintMaxSpeed: number; // hard cap on land, raised so sprint (walkSpeed * sprintMul) fits
  /** Hard bound on the playable patch (± metres from origin); 0 disables. */
  bound: number;
}

export const DEFAULT_PLAYER_TUNING: PlayerTuning = {
  walkSpeed: 5,
  swimSpeed: 3.5,
  riseSpeed: 2.5,
  waterDrag: 0.35,
  walkAccelTime: 0.09,
  swimAccelTime: 0.35,
  groundFollow: 18,
  turnRate: 9,
  swimSurfaceOffset: 1.3,
  swimClearance: 0.3,
  sprintMul: 1.8,
  maxSpeed: 8,
  sprintMaxSpeed: 9.5,
  bound: 0,
};

export interface PlayerIntents {
  moveX: number;   // right +
  moveZ: number;   // forward +
  rise: number;    // up +
  sprint?: boolean; // walking on land only; ignored while swimming
  camYaw: number;
  camPitch: number; // + = camera above target (looking down)
}

export interface PlayerState {
  x: number;
  y: number;  // feet
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mode: PlayerMode;
  heading: number;   // body yaw, same convention as camera yaw
  swimPitch: number; // body lean while swimming (radians, + = head down)
  speed: number;     // current speed, m/s (for animation)
  sprinting: boolean; // sprint is active (land, moving)
  onIce: boolean;    // standing on a frozen sea
  /** Set for one update when the mode flipped, with the previous mode. */
  switchedFrom: PlayerMode | null;
}

export interface Player {
  state: PlayerState;
  update(dt: number, intents: PlayerIntents): void;
  teleport(x: number, z: number): void;
}

export function createPlayer(env: PlayerEnv, tuning: Partial<PlayerTuning> = {}): Player {
  const t: PlayerTuning = { ...DEFAULT_PLAYER_TUNING, ...tuning };
  const state: PlayerState = {
    x: env.spawn.x,
    y: 0,
    z: env.spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    mode: 'walk',
    heading: 0,
    swimPitch: 0,
    speed: 0,
    sprinting: false,
    onIce: false,
    switchedFrom: null,
  };

  const place = (x: number, z: number) => {
    state.x = x;
    state.z = z;
    state.vx = state.vy = state.vz = 0;
    const ground = env.heightAt(x, z);
    const sea = env.seaLevel();
    const frozen = env.frozen();
    state.mode = decideMode({ mode: 'walk', ground, seaLevel: sea, frozen });
    state.y = state.mode === 'walk' ? walkFloor(ground, sea, frozen) : sea - t.swimSurfaceOffset;
    state.onIce = frozen && sea > ground;
  };
  place(env.spawn.x, env.spawn.z);

  function update(dt: number, i: PlayerIntents): void {
    dt = Math.min(dt, 0.1); // a hitch must not teleport the player
    const s = state;
    const ground = env.heightAt(s.x, s.z);
    const sea = env.seaLevel();
    const frozen = env.frozen();

    const prevMode = s.mode;
    s.mode = decideMode({ mode: prevMode, ground, seaLevel: sea, frozen });
    s.switchedFrom = s.mode !== prevMode ? prevMode : null;

    // Camera-relative basis.
    const sy = Math.sin(i.camYaw);
    const cy = Math.cos(i.camYaw);
    const fx = -sy;
    const fz = -cy;
    const rx = cy;
    const rz = -sy;
    const mag = Math.min(1, Math.hypot(i.moveX, i.moveZ));
    const ix = i.moveX;
    const iz = i.moveZ;

    if (s.mode === 'walk') {
      const depth = Math.max(0, sea - ground);
      const wade = frozen ? 0 : clamp(depth / 1.3, 0, 1);
      s.sprinting = !!i.sprint && mag > 0.1;
      const speed = t.walkSpeed * (s.sprinting ? t.sprintMul : 1) * (1 - t.waterDrag * wade);
      const dx = (rx * ix + fx * iz) * speed;
      const dz = (rz * ix + fz * iz) * speed;
      s.vx = approach(s.vx, dx, t.walkAccelTime, dt);
      s.vz = approach(s.vz, dz, t.walkAccelTime, dt);
      s.vy = 0;
      integrate(dt);
      const floor = walkFloor(env.heightAt(s.x, s.z), sea, frozen);
      if (s.y < floor) s.y = floor; // popped onto ice or shore
      s.y = s.y < floor ? floor : s.y + (floor - s.y) * Math.min(1, t.groundFollow * dt);
      s.swimPitch += (0 - s.swimPitch) * Math.min(1, 8 * dt);
    } else {
      s.sprinting = false;
      // Full 3D relative to the view: forward follows the camera's pitch.
      const cp = Math.cos(i.camPitch);
      const sp = Math.sin(i.camPitch);
      const f3x = fx * cp;
      const f3y = -sp;
      const f3z = fz * cp;
      const tx = (rx * ix + f3x * iz) * t.swimSpeed;
      const tz = (rz * ix + f3z * iz) * t.swimSpeed;
      const ty = f3y * iz * t.swimSpeed + i.rise * t.riseSpeed;
      s.vx = approach(s.vx, tx, t.swimAccelTime, dt);
      s.vy = approach(s.vy, ty, t.swimAccelTime, dt);
      s.vz = approach(s.vz, tz, t.swimAccelTime, dt);
      integrate(dt);
      s.y += s.vy * dt;
      const gNow = env.heightAt(s.x, s.z);
      s.y = Math.min(s.y, sea - t.swimSurfaceOffset); // can't leave the water upward
      s.y = Math.max(s.y, gNow + t.swimClearance);    // or dig into the sea floor
      const horiz = Math.hypot(s.vx, s.vz);
      const targetPitch = clamp(Math.atan2(-s.vy, Math.max(0.5, horiz)), -1.2, 1.2) * Math.min(1, horiz + Math.abs(s.vy));
      s.swimPitch += (targetPitch - s.swimPitch) * Math.min(1, 6 * dt);
    }

    // Cap speed (diagonals, hitches).
    const v3 = Math.hypot(s.vx, s.vy, s.vz);
    const cap = s.mode === 'walk' ? t.sprintMaxSpeed : t.maxSpeed;
    if (v3 > cap) {
      const k = cap / v3;
      s.vx *= k;
      s.vy *= k;
      s.vz *= k;
    }
    s.speed = Math.hypot(s.vx, s.vy, s.vz);
    s.onIce = frozen && s.mode === 'walk' && sea > env.heightAt(s.x, s.z);

    // Face travel direction (or the move intent when starting up).
    const hs = Math.hypot(s.vx, s.vz);
    if (hs > 0.3 || mag > 0.1) {
      const faceX = hs > 0.3 ? s.vx : rx * ix + fx * iz;
      const faceZ = hs > 0.3 ? s.vz : rz * ix + fz * iz;
      const target = Math.atan2(-faceX, -faceZ); // same convention as camera yaw
      s.heading += angleDelta(s.heading, target) * Math.min(1, t.turnRate * dt);
    }
  }

  function integrate(dt: number): void {
    state.x += state.vx * dt;
    state.z += state.vz * dt;
    if (t.bound > 0) {
      state.x = clamp(state.x, -t.bound, t.bound);
      state.z = clamp(state.z, -t.bound, t.bound);
    }
  }

  return { state, update, teleport: place };
}
