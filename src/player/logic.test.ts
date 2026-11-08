import { describe, expect, it } from 'vitest';
import {
  STAND_DEPTH, WADE_DEPTH, angleDelta, applyDeadZone, decideMode, easeSprintFov, nextPadSprint, dragEnd, dragMove, dragStart, walkFloor,
  jumpApex, stepJump, takeoffSpeedFor,
} from './logic';
import { createPlayer, type PlayerIntents } from './controller';
import { createFollowCamera } from './camera';

const idle: PlayerIntents = { moveX: 0, moveZ: 0, rise: 0, camYaw: 0, camPitch: 0.3 };

describe('dead zone', () => {
  it('zeroes small deflections', () => {
    expect(applyDeadZone(0.1, 0.1)).toEqual([0, 0]);
    expect(applyDeadZone(0, 0)).toEqual([0, 0]);
  });
  it('rescales so output ramps from 0 and reaches 1 at full deflection', () => {
    const [x] = applyDeadZone(1, 0);
    expect(x).toBeCloseTo(1);
    const [a] = applyDeadZone(0.19, 0, 0.18);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(0.05);
  });
  it('clamps beyond unit length and keeps direction', () => {
    const [x, y] = applyDeadZone(2, 2);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(x).toBeCloseTo(y);
  });
});

describe('click vs drag', () => {
  it('small jitter is a click', () => {
    const s = dragStart(100, 100);
    expect(dragEnd(dragMove(s, 102, 101), 102, 101)).toBe('click');
  });
  it('travel past the threshold is a drag, even if the pointer returns', () => {
    let s = dragStart(100, 100);
    s = dragMove(s, 140, 100);
    expect(s.dragging).toBe(true);
    expect(dragEnd(s, 100, 100)).toBe('drag');
  });
  it('release far from the start without moves is a drag', () => {
    expect(dragEnd(dragStart(0, 0), 30, 0)).toBe('drag');
  });
});

describe('walk / swim mode', () => {
  const base = { mode: 'walk' as const, seaLevel: 0, frozen: false };
  it('walks on land and in the shallows', () => {
    expect(decideMode({ ...base, ground: 3 })).toBe('walk');
    expect(decideMode({ ...base, ground: -(WADE_DEPTH - 0.1) })).toBe('walk');
  });
  it('swims in deep liquid water', () => {
    expect(decideMode({ ...base, ground: -(WADE_DEPTH + 0.1) })).toBe('swim');
  });
  it('has hysteresis: a swimmer keeps swimming until it is shallow enough to stand', () => {
    const g = -(STAND_DEPTH + 0.1);
    expect(decideMode({ ...base, mode: 'swim', ground: g })).toBe('swim');
    expect(decideMode({ ...base, mode: 'walk', ground: g })).toBe('walk');
    expect(decideMode({ ...base, mode: 'swim', ground: -(STAND_DEPTH - 0.1) })).toBe('walk');
  });
  it('frozen seas are solid: always walk, standing on the ice', () => {
    expect(decideMode({ ...base, frozen: true, ground: -50 })).toBe('walk');
    expect(decideMode({ ...base, mode: 'swim', frozen: true, ground: -50 })).toBe('walk');
    expect(walkFloor(-50, 2, true)).toBe(2);
    expect(walkFloor(-50, 2, false)).toBe(-50);
    expect(walkFloor(5, 2, true)).toBe(5);
  });
});

describe('player controller', () => {
  const mk = (over: { ground?: number; frozen?: boolean } = {}) => {
    const env = { ground: over.ground ?? -20, frozen: over.frozen ?? false, sea: 0 };
    const p = createPlayer({
      heightAt: () => env.ground,
      seaLevel: () => env.sea,
      frozen: () => env.frozen,
      spawn: { x: 0, z: 0 },
    });
    return { env, p };
  };

  it('spawns on land, walking on the terrain', () => {
    const { p } = mk({ ground: 4 });
    expect(p.state.mode).toBe('walk');
    expect(p.state.y).toBe(4);
  });

  it('melt → swim: standing on ice, the sea melts and the player starts swimming', () => {
    const { env, p } = mk({ frozen: true });
    expect(p.state.mode).toBe('walk');
    expect(p.state.y).toBe(0); // on the ice surface
    expect(p.state.onIce).toBe(true);
    p.update(0.05, idle);
    expect(p.state.mode).toBe('walk');
    env.frozen = false;
    p.update(0.05, idle);
    expect(p.state.mode).toBe('swim');
    expect(p.state.switchedFrom).toBe('walk');
  });

  it('freezing under a swimmer pops them onto the ice', () => {
    const { env, p } = mk();
    expect(p.state.mode).toBe('swim');
    p.update(0.05, { ...idle, rise: -1 });
    env.frozen = true;
    p.update(0.05, idle);
    expect(p.state.mode).toBe('walk');
    expect(p.state.y).toBeGreaterThanOrEqual(0);
  });

  it('swimmers stay below the surface and above the sea floor', () => {
    const { p } = mk({ ground: -20 });
    for (let i = 0; i < 400; i++) p.update(0.02, { ...idle, rise: 1 });
    expect(p.state.y).toBeLessThanOrEqual(0 - 1.3 + 1e-9);
    for (let i = 0; i < 1500; i++) p.update(0.02, { ...idle, rise: -1 });
    expect(p.state.y).toBeGreaterThanOrEqual(-20 + 0.3 - 1e-9);
  });

  it('swims along the view direction: looking down and pushing forward dives', () => {
    const { p } = mk({ ground: -50 });
    const y0 = p.state.y;
    for (let i = 0; i < 50; i++) p.update(0.02, { ...idle, moveZ: 1, camPitch: 0.8 });
    expect(p.state.y).toBeLessThan(y0);
    // forward at yaw 0 is -z
    expect(p.state.z).toBeLessThan(0);
  });

  it('caps walking speed and stays on terrain height', () => {
    let slope = 0;
    const p = createPlayer({ heightAt: (x) => x * 0.1, seaLevel: () => -100, frozen: () => false, spawn: { x: 0, z: 0 } });
    for (let i = 0; i < 200; i++) {
      p.update(0.02, { ...idle, moveX: 1 });
      slope = Math.max(slope, Math.hypot(p.state.vx, p.state.vz));
    }
    expect(slope).toBeLessThanOrEqual(5 + 1e-6);
    expect(p.state.mode).toBe('walk');
    expect(p.state.y).toBeGreaterThanOrEqual(p.state.x * 0.1 - 1e-6);
  });
});

describe('follow camera', () => {
  it('stays above the ground and clamps pitch', () => {
    const cam = createFollowCamera({ floorAt: () => 10 });
    const target = { x: 0, y: 0, z: 0 }; // target far below the "floor"
    cam.orbit(0, -5);
    for (let i = 0; i < 100; i++) cam.update(0.016, target, false);
    expect(cam.position.y).toBeGreaterThanOrEqual(10 + 0.6 - 1e-9);
    expect(cam.pitch).toBeCloseTo(-1.55); // walk pitch now spans almost straight down to straight up
  });
  it('sits behind the target for yaw 0 (camera on +z, looking toward -z)', () => {
    const cam = createFollowCamera({ floorAt: () => -100 });
    cam.snap({ x: 0, y: 0, z: 0 }, false);
    expect(cam.position.z).toBeGreaterThan(0);
  });
});

describe('angleDelta', () => {
  it('takes the short way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });
});

describe('sprint', () => {
  const run = (sprint: boolean, ground = 0, sea = -5) => {
    const p = createPlayer({ heightAt: () => ground, seaLevel: () => sea, frozen: () => false, spawn: { x: 0, z: 0 } });
    for (let k = 0; k < 120; k++) p.update(1 / 60, { ...idle, moveZ: 1, sprint });
    return p.state;
  };
  it('sprints at about 1.8x walk on land, within the cap', () => {
    const w = run(false).speed;
    const s = run(true);
    expect(s.speed / w).toBeCloseTo(1.8, 1);
    expect(s.speed).toBeLessThanOrEqual(9.5);
    expect(s.sprinting).toBe(true);
    expect(w).toBeLessThanOrEqual(8);
  });
  it('does not sprint without move input, and eases back on release', () => {
    const p = createPlayer({ heightAt: () => 0, seaLevel: () => -5, frozen: () => false, spawn: { x: 0, z: 0 } });
    p.update(0.1, { ...idle, sprint: true });
    expect(p.state.sprinting).toBe(false);
    for (let k = 0; k < 120; k++) p.update(1 / 60, { ...idle, moveZ: 1, sprint: true });
    p.update(1 / 60, { ...idle, moveZ: 1, sprint: false });
    expect(p.state.speed).toBeGreaterThan(5);
    for (let k = 0; k < 120; k++) p.update(1 / 60, { ...idle, moveZ: 1, sprint: false });
    expect(p.state.speed).toBeCloseTo(5, 1);
  });
  it('gives no speed boost while swimming', () => {
    const swim = (sprint: boolean) => {
      const p = createPlayer({ heightAt: () => 0, seaLevel: () => 10, frozen: () => false, spawn: { x: 0, z: 0 } });
      for (let k = 0; k < 240; k++) p.update(1 / 60, { ...idle, moveZ: 1, camPitch: 0, sprint });
      return p.state;
    };
    expect(swim(true).mode).toBe('swim');
    expect(swim(true).sprinting).toBe(false);
    expect(swim(true).speed).toBeCloseTo(swim(false).speed, 5);
  });
  it('L3 toggles on, toggles off, and clears when the stick is released', () => {
    expect(nextPadSprint(false, true, true)).toBe(true);
    expect(nextPadSprint(true, true, true)).toBe(false);
    expect(nextPadSprint(true, false, true)).toBe(true);
    expect(nextPadSprint(true, false, false)).toBe(false);
    expect(nextPadSprint(false, true, false)).toBe(false);
  });
  it('FOV widens toward the target and relaxes back', () => {
    let e = 0;
    for (let k = 0; k < 120; k++) e = easeSprintFov(e, true, 6, 1 / 60);
    expect(e).toBeCloseTo(6, 1);
    for (let k = 0; k < 120; k++) e = easeSprintFov(e, false, 6, 1 / 60);
    expect(e).toBeLessThan(0.1);
  });
});

describe('jump', () => {
  it('apex follows v²/2g: 1.2 m at 1 g, twice that at 0.5 g', () => {
    const v = takeoffSpeedFor(1.2, 1);
    expect(jumpApex(v, 1)).toBeCloseTo(1.2);
    expect(jumpApex(v, 0.5)).toBeCloseTo(2.4);
  });
  it('fires on the ground, not twice, and honours coyote time and the buffer', () => {
    const z = { coyote: 0, buffer: 0 };
    expect(stepJump(z, true, true, 0.016).fire).toBe(true);
    // just left a ledge: still within coyote time
    const left = stepJump({ coyote: 0.1, buffer: 0 }, false, true, 0.05);
    expect(left.fire).toBe(true);
    // airborne after firing: no double jump
    expect(stepJump(left.timers, false, true, 0.016).fire).toBe(false);
    // pressed 0.05 s before landing fires on touchdown; 0.2 s before does not
    const early = stepJump(z, false, true, 0.016);
    expect(stepJump(early.timers, true, false, 0.05).fire).toBe(true);
    const stale = stepJump(early.timers, false, false, 0.2);
    expect(stepJump(stale.timers, true, false, 0.016).fire).toBe(false);
  });
});

describe('jumping', () => {
  const mk = (g: number) =>
    createPlayer({ heightAt: () => 0, seaLevel: () => -100, frozen: () => false, gravity: () => g, spawn: { x: 0, z: 0 } });
  const apexOf = (g: number) => {
    const p = mk(g);
    p.update(0.016, { ...idle, jump: true });
    let max = 0;
    for (let n = 0; n < 400; n++) {
      p.update(0.01, idle);
      max = Math.max(max, p.state.y);
    }
    expect(p.state.grounded).toBe(true);
    expect(p.state.y).toBe(0);
    return max;
  };
  it('apex is about 1.2 m at 1 g and about double at 0.5 g', () => {
    expect(apexOf(1)).toBeGreaterThan(1.1);
    expect(apexOf(1)).toBeLessThan(1.3);
    expect(apexOf(0.5)).toBeGreaterThan(2.2);
  });
  it('falls off a ledge without jitter and lands on the ground', () => {
    let h = 5;
    const p = createPlayer({ heightAt: () => h, seaLevel: () => -100, frozen: () => false, spawn: { x: 0, z: 0 } });
    h = 0;
    for (let n = 0; n < 200; n++) p.update(0.016, idle);
    expect(p.state.grounded).toBe(true);
    expect(p.state.y).toBe(0);
  });
});
