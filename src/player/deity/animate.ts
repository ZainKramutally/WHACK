// Procedural animation for the deity rig (docs/features/deity.md, "Motion rules"). Pure function of the PlayerState
// sequence and dt: no Math.random (seeded streams), no per-frame allocation, never writes rig.root.
// All proportions come from rig.dims; rest transforms are captured at creation and offset every frame.
import type { PlayerState } from '../controller';
import { angleDelta, approach, clamp } from '../logic';
import type { DeityRig } from './rig';

export interface DeityAnimOptions {
  /** Head turns round to the camera after a few idle seconds (default true). */
  lookBack?: boolean;
  /** [min, max] idle seconds before the first look-back. Later ones come every 6-10 s. */
  lookBackDelay?: [number, number];
  seed?: number;
}

export interface DeityAnimator {
  update(state: PlayerState, dt: number): void;
  /** World point the head looks at during a look-back (the camera). null = "behind the heading". */
  setLookTarget(p: { x: number; y: number; z: number } | null): void;
  /** Both hands rise as if shaping the world. */
  cast(): void;
  /** Gait phase in cycles; advances with distance travelled. */
  readonly gaitPhase: number;
}

/** Metres of travel per gait cycle (two skips). */
export function strideLength(speed: number): number {
  return clamp(0.9 + 0.3 * speed, 1.1, 3.6);
}

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth01 = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
function makeRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pose channels (blended across states by weight).
const PY = 0, PZ = 1, RX = 2, RZ = 3, BSY = 4, BSX = 5, L0X = 6, L1X = 7, L0Z = 8, L1Z = 9;
const HX = 10, HY = 11, HZ = 12, HRX = 13, H0X = 14, H0Y = 15, H0Z = 16, H1X = 17, H1Y = 18, H1Z = 19, NP = 20;
// Hand x offsets are "outward" for both hands.

// Spring channels.
const S_HX = 0, S_HY = 1, S_HZ = 2, S_PITCH = 3, S_YAW = 4;
const S_H0X = 5, S_H0Y = 6, S_H0Z = 7, S_H1X = 8, S_H1Y = 9, S_H1Z = 10, S_SQ = 11, S_ST = 12, NS = 13;
const HMAX = 1 / 120;
const BLINK_DUR = 0.16;

function resetPose(p: Float64Array) {
  p.fill(0);
  p[BSY] = 1;
  p[BSX] = 1;
}

export function createDeityAnimator(rig: DeityRig, opts: DeityAnimOptions = {}): DeityAnimator {
  const d = rig.dims;
  // Variant D carries its eyes on the body: the head turn would show nothing, so skip the look-back there.
  const lookBackOn = opts.lookBack !== false && rig.eyes[0].parent === rig.head;
  // Short legs (variant C) can't carry the bounce: the body squash and hop do more of the work.
  const squashK = 1 + clamp((0.25 - rig.dims.legLength) / 0.15, 0, 1);
  const seed = opts.seed ?? 0xde17;
  const rLook = makeRand(seed);
  const rBlink = makeRand(seed ^ 0x9e3779b9);
  const centre = d.height * 0.4; // swim pitch pivots about the body centre, not the feet

  // Rest transforms.
  const rPose = { x: rig.pose.position.x, y: rig.pose.position.y, z: rig.pose.position.z, rx: rig.pose.rotation.x, rz: rig.pose.rotation.z };
  const rBody = { x: rig.body.scale.x, y: rig.body.scale.y, z: rig.body.scale.z };
  const rLegs = rig.legs.map((l) => ({ rx: l.rotation.x, rz: l.rotation.z }));
  const rHead = { x: rig.head.position.x, y: rig.head.position.y, z: rig.head.position.z, rx: rig.head.rotation.x, ry: rig.head.rotation.y };
  const rHands = rig.hands.map((h) => ({ x: h.position.x, y: h.position.y, z: h.position.z }));
  const rEyes = rig.eyes.map((e) => ({ x: e.position.x, y: e.position.y, sy: e.scale.y }));
  const rExtras = rig.extras.map((e) => ({ ry: e.rotation.y, rz: e.rotation.z, y: e.position.y, motion: (e.userData?.motion as string | undefined) ?? 'sway' }));

  // Springs: [omega, zeta].
  const sx = new Float64Array(NS), sv = new Float64Array(NS), st = new Float64Array(NS);
  const sw = new Float64Array(NS), sz = new Float64Array(NS);
  const setSpring = (i: number, w: number, z: number) => { sw[i] = w; sz[i] = z; };
  for (const i of [S_HX, S_HY, S_HZ]) setSpring(i, 14, 0.42);
  setSpring(S_PITCH, 14, 0.6);
  setSpring(S_YAW, 15, 0.8);
  for (const i of [S_H0X, S_H0Y, S_H0Z, S_H1X, S_H1Y, S_H1Z]) setSpring(i, 11, 0.5);
  setSpring(S_SQ, 22, 0.35);
  setSpring(S_ST, 22, 0.4);
  const stepSprings = (dt: number) => {
    const n = Math.max(1, Math.ceil(dt / HMAX));
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < NS; i++) {
        const a = -sw[i] * sw[i] * (sx[i] - st[i]) - 2 * sz[i] * sw[i] * sv[i];
        sv[i] += a * h;
        sx[i] += sv[i] * h;
      }
    }
  };

  const pose = new Float64Array(NP), acc = new Float64Array(NP);
  const W = { idle: 1, gait: 0, air: 0, swim: 0, tread: 0 };

  let t = 0, gait = 0, runK = 0, swimPh = 0, treadPh = 0, turnS = 0;
  let prevHeading = 0, prevSpeed = 0, prevPy = 0, prevVpy = 0, first = true;
  // Idle behaviour.
  let idleT = 0, nextLookBack = lookBackDelayPick(), lbState = 0, lbT = 0, lbBlinked = false, lbSign = 1;
  let lookT = 0, lookNext = 1.5, lookYaw = 0, lookPitch = 0;
  let nextBlink = 2 + 4 * rBlink(), blinkT = -1;
  let castT = -1, castK = 0;
  let target: { x: number; y: number; z: number } | null = null;
  let gaitOut = 0;

  function lookBackDelayPick(): number {
    const [a, b] = opts.lookBackDelay ?? [4, 7];
    return a + (b - a) * rLook();
  }

  // ---- state poses -------------------------------------------------------------------------------------------
  function idlePose(p: Float64Array) {
    const br = Math.sin(TAU * 0.3 * t);
    p[BSY] = 1 + 0.022 * br;
    p[BSX] = 1 - 0.012 * br;
    p[HY] = 0.03 * Math.sin(TAU * 0.4 * t);
    p[H0Y] = p[H1Y] = 0.015 * Math.sin(TAU * 0.4 * t - 0.9);
    p[H0X] = p[H1X] = 0.01 * br;
  }

  function gaitPose(p: Float64Array, speed: number) {
    const sk = Math.min(1, speed / 5);
    const A = lerp(0.55, 0.9, runK) * (0.4 + 0.6 * sk);
    const s = Math.sin(TAU * gait), c4 = Math.cos(2 * TAU * gait);
    const hop = lerp(0.05, 0.14, runK) * sk * (1 + 0.5 * (squashK - 1));
    p[PY] = -d.legLength * (1 - Math.cos(A)) * 0.8 + hop * (0.5 + 0.5 * c4);
    p[RX] = -lerp(0.07, 0.22, runK) * sk;
    p[RZ] = 0.04 * s * (1 - runK) * sk;
    p[BSY] = 1 + 0.06 * squashK * c4 * sk;
    p[BSX] = 1 - 0.03 * squashK * c4 * sk;
    p[L0X] = A * s;
    p[L1X] = -A * s;
    p[L0Z] = -0.08;
    p[L1Z] = 0.08;
    p[HY] = 0.04 * Math.cos(2 * TAU * gait - 1.0) * sk;
    p[HZ] = lerp(0.03, 0.14, runK) * sk;
    p[HRX] = lerp(0.05, 0.18, runK) * sk;
    const sw2 = 0.2 * (1 - runK * 0.5) * s;
    const trail = runK * 0.2 * sk;
    const pump = (0.04 * Math.cos(2 * TAU * gait) + runK * 0.08) * sk;
    p[H1Z] = -sw2 + trail;
    p[H0Z] = sw2 + trail;
    p[H0Y] = p[H1Y] = pump;
    p[H0X] = p[H1X] = 0.04;
  }

  function airPose(p: Float64Array, vy: number) {
    const ku = smooth01(0.5, 3, vy), kd = smooth01(0.5, 3, -vy);
    const ap = 1 - Math.max(ku, kd);
    p[RX] = -0.12;
    p[BSY] = 1 + 0.08 * ku - 0.04 * kd;
    p[BSX] = 1 - 0.04 * ku + 0.02 * kd;
    const base = 0.9 * ku + 0.15 * ap + 0.2 * kd;
    p[L0X] = base + 0.25 * ap;
    p[L1X] = base - 0.2 * ap;
    const spread = 0.15 * ap + 0.5 * kd;
    p[L0Z] = -spread;
    p[L1Z] = spread;
    p[HY] = -0.06 * ku + 0.05 * kd;
    p[HZ] = 0.04;
    p[HRX] = 0.1;
    p[H0Y] = p[H1Y] = 0.18 * ku + 0.08 * ap + 0.3 * kd;
    p[H0X] = p[H1X] = 0.05 * ku + 0.18 * ap + 0.22 * kd;
  }

  function swimPose(p: Float64Array, swimPitch: number) {
    const phi = clamp(1.3 + swimPitch, 0.2, 2.9);
    p[RX] = -phi;
    p[PY] = centre * (1 - Math.cos(phi));
    p[PZ] = centre * Math.sin(phi);
    const u = TAU * swimPh, q = Math.sin(u);
    const sp = 0.2 + 0.35 * (0.5 + 0.5 * q);
    p[L0Z] = -sp;
    p[L1Z] = sp;
    p[L0X] = p[L1X] = 0.25 + 0.5 * Math.max(0, -q);
    p[HRX] = 0.55 * phi;
    p[HZ] = -0.02;
    const hx = 0.1 + 0.2 * (0.5 - 0.5 * Math.cos(u));
    const hy = 0.25 * Math.cos(u) + 0.1;
    p[H0X] = p[H1X] = hx;
    p[H0Y] = p[H1Y] = hy;
  }

  function treadPose(p: Float64Array) {
    const u = TAU * treadPh;
    p[RX] = 0.05;
    p[PY] = 0.04 * Math.sin(TAU * 0.7 * t);
    const s = Math.sin(u);
    p[L0X] = 0.5 * s;
    p[L1X] = -0.5 * s;
    p[L0Z] = -0.12;
    p[L1Z] = 0.12;
    p[HY] = 0.03 * Math.sin(u * 0.5);
    p[H0X] = p[H1X] = 0.1 + 0.05 * Math.sin(u + 0.6);
    p[H0Y] = p[H1Y] = -0.05 + 0.06 * Math.sin(u + 1.3);
    p[BSY] = 1 + 0.015 * Math.sin(u * 0.5);
  }

  function addPose(w: number) {
    for (let i = 0; i < NP; i++) acc[i] += w * pose[i];
  }

  // ---- update ------------------------------------------------------------------------------------------------
  function update(s: PlayerState, dtRaw: number) {
    if (!(dtRaw > 0)) return;
    const dt = Math.min(dtRaw, 0.1);
    t += dt;
    if (first) {
      first = false;
      prevHeading = s.heading;
      prevSpeed = s.speed;
    }

    // Events.
    if (s.jumped) {
      sx[S_ST] = 0.22;
      sv[S_ST] = 0;
      sv[S_HY] -= 2;
      sv[S_H0Y] -= 1.5;
      sv[S_H1Y] -= 1.5;
    }
    if (s.landed > 0) {
      sx[S_SQ] = Math.max(sx[S_SQ], 0.6 * s.landed);
      sx[S_HY] -= 0.06 * s.landed;
      sv[S_HY] -= 3 * s.landed;
      sv[S_H0Y] -= 2 * s.landed;
      sv[S_H1Y] -= 2 * s.landed;
    }

    // State weights.
    const swim = s.mode === 'swim';
    const grounded = !swim && s.grounded;
    const mg = smooth01(0.2, 1.5, s.speed);
    const ms = smooth01(0.3, 1.2, s.speed);
    const tw = 0.07;
    W.idle = approach(W.idle, grounded ? 1 - mg : 0, tw, dt);
    W.gait = approach(W.gait, grounded ? mg : 0, tw, dt);
    W.air = approach(W.air, !swim && !s.grounded ? 1 : 0, tw, dt);
    W.swim = approach(W.swim, swim ? ms : 0, tw, dt);
    W.tread = approach(W.tread, swim ? 1 - ms : 0, tw, dt);
    runK = approach(runK, s.sprinting && grounded ? 1 : 0, 0.12, dt);

    // Phases: gait advances with distance travelled.
    if (grounded && s.speed > 0.05) gait = (gait + (s.speed * dt) / strideLength(s.speed)) % 1000;
    if (swim) swimPh += dt * (0.7 + s.speed * 0.45);
    treadPh += dt * 1.1;

    // Turning.
    const dh = angleDelta(prevHeading, s.heading) / dt;
    prevHeading = s.heading;
    turnS = approach(turnS, clamp(dh, -12, 12), 0.1, dt);
    const bank = clamp(turnS * s.speed * 0.025, -0.35, 0.35);

    // Idle behaviours.
    const idleish = (grounded && s.speed < 0.3) || (swim && s.speed < 0.3);
    if (idleish) idleT += dt;
    else {
      idleT = 0;
      lbState = 0;
      nextLookBack = lookBackDelayPick();
    }
    let yawT = 0, pitchT = 0, gazeX = 0, gazeY = 0, forceBlink = false;
    if (idleish) {
      lookT += dt;
      if (lookT >= lookNext) {
        lookT = 0;
        lookNext = 1.8 + 2.7 * rLook();
        const r = rLook();
        lookYaw = r < 0.3 ? 0 : (rLook() * 2 - 1) * 0.6;
        lookPitch = r < 0.3 ? 0 : -0.1 + rLook() * 0.3;
      }
      yawT = lookYaw;
      pitchT = lookPitch;
      if (lookBackOn && lbState === 0 && idleT >= nextLookBack) {
        lbState = 1;
        lbT = 0;
        lbBlinked = false;
        lbSign = rLook() < 0.5 ? -1 : 1;
      }
      if (lbState === 1) {
        lbT += dt;
        if (target) {
          const a = Math.atan2(-(target.x - s.x), -(target.z - s.z));
          yawT = angleDelta(s.heading, a);
        } else yawT = lbSign * Math.PI;
        pitchT = 0.05;
        if (!lbBlinked && lbT >= 0.7) {
          lbBlinked = true;
          forceBlink = true;
        }
        if (lbT >= 2.7) {
          lbState = 0;
          nextLookBack = idleT + 6 + 4 * rLook();
        }
      }
      const err = yawT - sx[S_YAW];
      gazeX = clamp(-err * 0.6, -1, 1) * d.eyeLook;
      gazeY = clamp((pitchT - sx[S_PITCH]) * 0.6, -1, 1) * d.eyeLook;
      if (lbState === 1) gazeX = gazeY = 0;
    } else {
      lookT = 0;
      yawT = clamp(turnS * 0.08, -0.5, 0.5);
    }

    // Blink.
    if (forceBlink && blinkT < 0) nextBlink = t;
    let blink = 0;
    if (blinkT < 0) {
      if (t >= nextBlink) blinkT = 0;
    } else {
      blinkT += dt;
      if (blinkT >= BLINK_DUR) {
        blinkT = -1;
        nextBlink = t + 2 + 4 * rBlink();
      } else blink = Math.sin((Math.PI * blinkT) / BLINK_DUR);
    }

    // Cast.
    if (castT >= 0) {
      castT += dt;
      if (castT > 1.6) castT = -1;
    }
    castK = approach(castK, castT >= 0 ? Math.sin(Math.PI * Math.min(1, castT / 1.6)) : 0, 0.05, dt);

    // Blend poses.
    acc.fill(0);
    let wsum = W.idle + W.gait + W.air + W.swim + W.tread;
    if (wsum < 1e-4) { W.idle = wsum = 1; }
    if (W.idle > 1e-4) { resetPose(pose); idlePose(pose); addPose(W.idle / wsum); }
    if (W.gait > 1e-4) { resetPose(pose); gaitPose(pose, s.speed); addPose(W.gait / wsum); }
    if (W.air > 1e-4) { resetPose(pose); airPose(pose, s.vy); addPose(W.air / wsum); }
    if (W.swim > 1e-4) { resetPose(pose); swimPose(pose, s.swimPitch); addPose(W.swim / wsum); }
    if (W.tread > 1e-4) { resetPose(pose); treadPose(pose); addPose(W.tread / wsum); }
    const moving = (W.gait + W.air + W.swim) / wsum;
    acc[RZ] += bank * moving;

    // Inertial lag: the detached head and hands feel the body's accelerations.
    const dSpeed = clamp(s.speed - prevSpeed, -1.5, 1.5);
    prevSpeed = s.speed;
    sv[S_HZ] += dSpeed * 0.35;
    sv[S_H0Z] += dSpeed * 0.25;
    sv[S_H1Z] += dSpeed * 0.25;
    const vpy = (acc[PY] - prevPy) / dt;
    const dv = clamp(vpy - prevVpy, -6, 6);
    prevPy = acc[PY];
    prevVpy = vpy;
    sv[S_HY] -= dv * 0.5;
    sv[S_H0Y] -= dv * 0.3;
    sv[S_H1Y] -= dv * 0.3;

    // Spring targets.
    const sq = sx[S_SQ];
    st[S_HX] = acc[HX];
    st[S_HY] = acc[HY] - 0.1 * sq + 0.1 * castK;
    st[S_HZ] = acc[HZ];
    st[S_PITCH] = acc[HRX] + pitchT + 0.35 * castK;
    // Yaw spring runs on an unwrapped angle: aim at the nearest equivalent of the target.
    st[S_YAW] = yawT;
    st[S_H0X] = -(acc[H0X]) + 0.1 * castK;
    st[S_H1X] = acc[H1X] - 0.1 * castK;
    st[S_H0Y] = acc[H0Y] + 0.55 * castK;
    st[S_H1Y] = acc[H1Y] + 0.55 * castK;
    st[S_H0Z] = acc[H0Z] - 0.25 * castK;
    st[S_H1Z] = acc[H1Z] - 0.25 * castK;
    st[S_SQ] = 0;
    st[S_ST] = 0;
    stepSprings(dt);

    // Apply.
    const P = rig.pose;
    const stretch = sx[S_ST];
    const squash = sx[S_SQ];
    P.position.set(rPose.x, rPose.y + acc[PY] - 0.06 * squash, rPose.z + acc[PZ]);
    P.rotation.x = rPose.rx + acc[RX];
    P.rotation.z = rPose.rz + acc[RZ];
    const bsy = acc[BSY] * (1 + stretch) * (1 - 0.5 * squash);
    const bsx = acc[BSX] * (1 - 0.5 * stretch) * (1 + 0.35 * squash);
    rig.body.scale.set(rBody.x * bsx, rBody.y * bsy, rBody.z * bsx);
    rig.legs[0].rotation.x = rLegs[0].rx + acc[L0X];
    rig.legs[1].rotation.x = rLegs[1].rx + acc[L1X];
    rig.legs[0].rotation.z = rLegs[0].rz + acc[L0Z] - 0.5 * squash;
    rig.legs[1].rotation.z = rLegs[1].rz + acc[L1Z] + 0.5 * squash;
    rig.head.position.set(rHead.x + sx[S_HX], rHead.y + sx[S_HY], rHead.z + sx[S_HZ]);
    rig.head.rotation.x = rHead.rx + sx[S_PITCH];
    rig.head.rotation.y = rHead.ry + sx[S_YAW];
    rig.hands[0].position.set(rHands[0].x + sx[S_H0X], rHands[0].y + sx[S_H0Y], rHands[0].z + sx[S_H0Z]);
    rig.hands[1].position.set(rHands[1].x + sx[S_H1X], rHands[1].y + sx[S_H1Y], rHands[1].z + sx[S_H1Z]);
    for (let i = 0; i < 2; i++) {
      const e = rig.eyes[i];
      e.scale.y = rEyes[i].sy * (1 - blink);
      e.position.x = rEyes[i].x + gazeX;
      e.position.y = rEyes[i].y + gazeY;
    }
    for (let i = 0; i < rig.extras.length; i++) {
      const ex = rig.extras[i], r = rExtras[i];
      if (r.motion === 'orbit') ex.rotation.y = r.ry + 1.4 * t;
      else if (r.motion === 'sway') {
        ex.rotation.z = r.rz + 0.05 * Math.sin(TAU * 0.5 * t + i);
        ex.position.y = r.y + 0.01 * Math.sin(TAU * 0.4 * t + 1 + i);
      }
    }
    gaitOut = gait;
  }

  return {
    update,
    setLookTarget(p) {
      target = p;
    },
    cast() {
      castT = 0;
    },
    get gaitPhase() {
      return gaitOut;
    },
  };
}
