// Procedural pose: a pure function of (plan, time, path). Follow-the-leader spine along the path (F §3.5) with bend
// limits (15° snap for silicon), gait from leg count with distance-driven foot plants + 2-bone IK, body bob / sway /
// counter-rotation from the gait phase, breathing, saccadic head look, blinks, frill and tail follow-through.
// Parts are emitted through a Sink as basis matrices (render.ts turns them into instances of shared geometry).
import type { PaletteKey } from '../contracts';
import { add, cross, dot, len, norm, rotate, scl, sub, lerp3, type V3 } from '../flora/mesh';
import type { FaunaPlan } from './develop';
import { footAt, legPhase, plantDistance, twoBoneIK } from './ik';
import type { Path } from './path';
import { poseBell } from './bell';

export type PartType = 'rodSi' | 'rodC' | 'plateSi' | 'plateC' | 'hornSi' | 'hornC' | 'frill' | 'eyeRing' | 'eyeDot'
  | 'thighSi' | 'thighC' | 'skullSi' | 'skullC';
export const PART_TYPES: PartType[] = ['rodSi', 'rodC', 'plateSi', 'plateC', 'hornSi', 'hornC', 'frill', 'eyeRing', 'eyeDot', 'thighSi', 'thighC', 'skullSi', 'skullC'];

/** Receives one part: origin and three scaled basis axes (columns of the instance matrix), two palette colours, glow. */
export interface Sink { part(type: PartType, o: V3, x: V3, y: V3, z: V3, a: PaletteKey, b: PaletteKey, glow: number): void }

export interface Spine { P: V3[]; T: V3[]; U: V3[]; R: V3[]; r: number[] } // per joint: position, forward, up, right, radius

export interface Instance { s0: number; phase: number } // per individual: start distance along the path, time offset

const UP: V3 = [0, 1, 0];
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;
const snapA = (a: number, deg: number) => (deg > 0 ? Math.round(a / (deg * D2R)) * deg * D2R : a);
/** Deterministic hash → [0, 1). */
export function hash01(a: number, b: number): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Orthonormal frame from a forward vector (up is world up unless forward is near vertical). */
function frame(T: V3): { U: V3; R: V3 } {
  const ref: V3 = Math.abs(T[1]) > 0.95 ? [1, 0, 0] : UP;
  const U = norm(sub(ref, scl(T, dot(ref, T))));
  return { U, R: norm(cross(T, U)) };
}

/** Basis whose y axis runs from a to b (a bone), with radius r across. */
function boneBasis(a: V3, b: V3, r: number, hint: V3): { x: V3; y: V3; z: V3 } {
  const y = sub(b, a);
  const yn = norm(y);
  let x = sub(hint, scl(yn, dot(hint, yn)));
  if (len(x) < 1e-5) x = Math.abs(yn[1]) < 0.9 ? cross(yn, UP) : cross(yn, [1, 0, 0]);
  x = norm(x);
  const z = cross(x, yn);
  return { x: scl(x, r), y, z: scl(z, r) };
}

export function bone(sink: Sink, type: PartType, a: V3, b: V3, r: number, hint: V3, ca: PaletteKey, cb: PaletteKey, glow = 0) {
  const B = boneBasis(a, b, r, hint);
  sink.part(type, a, B.x, B.y, B.z, ca, cb, glow);
}

/** Sample the spine at fractional joint index x (Catmull–Rom for carbon, linear for silicon prisms). */
export function spineAt(sp: Spine, x: number, smooth: boolean): { p: V3; T: V3; U: V3; R: V3; r: number } {
  const n = sp.P.length - 1;
  const xc = Math.min(n, Math.max(0, x));
  const i = Math.min(n - 1, Math.floor(xc)), f = xc - i;
  let p: V3;
  if (smooth) {
    const p0 = sp.P[Math.max(0, i - 1)], p1 = sp.P[i], p2 = sp.P[i + 1], p3 = sp.P[Math.min(n, i + 2)];
    const f2 = f * f, f3 = f2 * f;
    p = [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3)) as V3;
  } else p = lerp3(sp.P[i], sp.P[i + 1], f);
  const T = norm(lerp3(sp.T[i], sp.T[i + 1], f));
  const fr = frame(T);
  // extrapolate past the ends along the end tangent (head and tail caps)
  if (x < 0) p = add(sp.P[0], scl(sp.T[0], -x * len(sub(sp.P[0], sp.P[1]))));
  if (x > n) p = sub(sp.P[n], scl(sp.T[n], (x - n) * len(sub(sp.P[n], sp.P[n - 1]))));
  return { p, T, U: fr.U, R: fr.R, r: sp.r[i] + (sp.r[i + 1] - sp.r[i]) * f };
}

export interface PoseOut { spine: Spine; blink: number }

/** Pose one individual at time t (seconds). Emits all limb/armour/sense parts into `sink` and returns the spine for the loft. */
export function pose(plan: FaunaPlan, t: number, path: Path, inst: Instance, sink: Sink): PoseOut {
  if (plan.form === 'bell') return poseBell(plan, t, path, inst, sink);
  const L = plan.scale, n = plan.segments, seg = L / n;
  const tt = t + inst.phase;
  const s = inst.s0 + plan.speed * t;
  const smooth = plan.chemistry === 'carbon';
  const tick = plan.tick;
  const P: V3[] = [];
  const legU = plan.legs.map((l) => l.u);
  const uF = legU.length ? Math.min(...legU) : plan.headLen, uB = legU.length ? Math.max(...legU) : 0.6;
  const gp = plan.stride > 0 ? s / plan.stride : 0; // gait phase (cycles)
  const cyc = 2 * Math.PI * gp;
  const hipH = plan.hipHeight;
  const rAt = (u: number) => plan.radii[Math.min(n, Math.round(u * n))];

  // ---- body bob and weight shift from the gait ---------------------------------------------------------------
  let bob = 0, sway = 0, counter = 0, pitch = 0;
  if (plan.gait === 'trot') { bob = -0.04 * hipH * Math.cos(2 * cyc); sway = 0.012 * L * Math.sin(cyc); counter = 0.05 * Math.sin(cyc); }
  else if (plan.gait === 'wave') { bob = -0.02 * hipH * Math.cos(2 * cyc); sway = 0.006 * L * Math.sin(cyc); counter = 0.03 * Math.sin(cyc); }
  // weight: each foot strike drops the body over that leg (hips sink on contact frames); the spine rocks in trot
  const legDip = (u0: number) => {
    let d = 0;
    plan.legs.forEach((leg, pi) => {
      const w = Math.exp(-(((u0 - leg.u) / 0.18) ** 2));
      for (const sd of [-1, 1] as const) {
        const ph0 = gp + legPhase(plan.gait, pi, plan.legPairs, sd);
        const f = ph0 - Math.floor(ph0);
        d += w * (Math.exp(-((f / 0.09) ** 2)) + Math.exp(-(((f - 1) / 0.09) ** 2)) + 0.5 * Math.exp(-(((f - 0.12) / 0.07) ** 2)));
      }
    });
    return d;
  };
  const rock = plan.gait === 'trot' ? 0.03 * hipH * Math.sin(cyc) : 0;
  const roll = plan.gait === 'trot' ? 0.06 * Math.sin(cyc) : plan.gait === 'wave' ? 0.03 * Math.sin(cyc) : 0;
  if (plan.gait === 'hop') {
    const phi = gp - Math.floor(gp);
    if (phi < plan.duty) { const c = Math.sin((Math.PI * phi) / plan.duty); bob = -0.12 * hipH * c; pitch = 0.08 * c; }
    else { const u = (phi - plan.duty) / (1 - plan.duty); bob = 0.45 * hipH * Math.sin(Math.PI * u); pitch = -0.12 * Math.sin(Math.PI * u); }
  }

  // ---- spine: follow the leader along the path -----------------------------------------------------------------
  const isSessile = plan.mode === 'sessile';
  const hoverAlt = plan.mode === 'hover' ? 8 + 0.7 * L + 0.04 * L * Math.sin(0.21 * tt) : 0;
  const lambda = 0.55 * L;
  for (let j = 0; j <= n; j++) {
    const u = j / n;
    if (isSessile) {
      const sw = 0.05 * L * u * u * Math.sin(0.7 * tt);
      const p = path.at(inst.s0).p;
      const lean = tick ? snapA(sw / L, 5) * L : sw;
      P.push([p[0] + lean, j * seg * 0.92, p[2] + 0.5 * lean]);
      continue;
    }
    const sj = s - u * L;
    const { p, t: tg } = path.at(sj);
    const right = cross(tg, UP);
    let lat = 0, y = 0;
    if (plan.mode === 'crawl') {
      lat = plan.undulate * L * Math.sin((2 * Math.PI * sj) / lambda) * sstep(0, 0.2, u) * (0.6 + 0.4 * u);
      y = rAt(u) * plan.aspect * 0.85 + 0.18 * L * (1 - sstep(0, 0.22, u)) * (0.85 + 0.15 * Math.sin(1.1 * tt));
    } else if (plan.mode === 'hover') {
      y = hoverAlt + 0.05 * L * Math.sin(1.1 * tt - 2 * Math.PI * u * 0.8) * (0.25 + u) ** 2;
      lat = 0.02 * L * Math.sin(0.6 * tt - u * 3);
    } else {
      // walkers: hips at hip height, head carried up, tail sloping to the ground with follow-through
      y = hipH + bob - (plan.gait === 'hop' ? 0 : 0.035 * hipH * legDip(u)) + rock * ((u - (uF + uB) / 2) / 0.5);
      if (u < uF) y += (uF - u) * L * (plan.gait === 'hop' ? 0.2 : smooth ? 0.22 : -0.06) + pitch * (uF - u) * L;
      if (u > uB) y = Math.max(rAt(u) * plan.aspect * 0.8, y - (u - uB) ** 1.3 * L * (plan.gait === 'hop' ? 0.15 : 0.7)); // hoppers hold the tail out as a counterweight
      if (plan.gait === 'hop' && u > uB) y += pitch * (u - uB) * L;
      lat = sway + counter * (u - (uF + uB) / 2) * L;
      lat += plan.undulate * L * Math.sin(2 * Math.PI * (sj / lambda) - 0.9 * tt) * u;
      if (u > uB) lat += 0.035 * L * (u - uB) * Math.sin(1.7 * tt - u * 4) * (smooth ? 1 : 0.5); // tail follow-through
    }
    P.push([p[0] + right[0] * lat, y, p[2] + right[2] * lat]);
  }

  // ---- bend limits: clamp each joint's yaw against its parent; silicon snaps to 15° ----------------------------
  if (!isSessile) {
    const maxA = plan.jointMaxDeg * D2R;
    for (let j = 2; j <= n; j++) {
      const a0 = sub(P[j - 1], P[j - 2]), a1 = sub(P[j], P[j - 1]);
      const h0 = Math.atan2(a0[2], a0[0]), h1 = Math.atan2(a1[2], a1[0]);
      let d = h1 - h0; d = Math.atan2(Math.sin(d), Math.cos(d));
      let dc = Math.max(-maxA, Math.min(maxA, d));
      if (plan.jointSnapDeg) dc = snapA(dc, plan.jointSnapDeg);
      if (Math.abs(dc - d) > 1e-6) {
        const hl = Math.hypot(a1[0], a1[2]), h = h0 + dc;
        P[j] = [P[j - 1][0] + Math.cos(h) * hl, P[j][1], P[j - 1][2] + Math.sin(h) * hl];
      }
    }
  }

  // ---- head look: saccades (fast move, hold), stepped for silicon -------------------------------------------------
  const per = 1.7 + 0.6 * hash01(plan.seed, 7);
  const k = Math.floor((tt + 13) / per), tk = (tt + 13) - k * per;
  const tgt = (i: number) => (hash01(plan.seed + i, 11) < 0.3 ? 0 : (hash01(plan.seed, i) - 0.5) * 1.1);
  let yaw = tgt(k - 1) + (tgt(k) - tgt(k - 1)) * (tick ? (tk > 0.05 ? 1 : 0) : sstep(0, 0.14, tk));
  let lookPitch = (hash01(plan.seed + k, 5) - 0.5) * 0.3;
  // the head leads: it turns toward where the path is going before the body does (anticipation)
  if (!isSessile && plan.mode !== 'hover') {
    const h0 = path.at(s).t, h1 = path.at(s + 0.8 * L).t;
    const turnA = Math.atan2(h0[0] * h1[2] - h0[2] * h1[0], h0[0] * h1[0] + h0[2] * h1[2]);
    yaw = 0.55 * yaw - 0.9 * Math.max(-0.6, Math.min(0.6, turnA));
  }
  if (tick) { yaw = snapA(yaw, 15); lookPitch = snapA(lookPitch, 15); }
  if (!isSessile && plan.mode !== 'hover') {
    const hd = sub(P[0], P[1]);
    P[0] = add(P[1], rotate(rotate(hd, UP, -yaw), norm(cross(hd, UP)), lookPitch));
  }
  const blinkPer = 3 + 3 * hash01(plan.seed, 3);
  const bt = (tt + 5 * hash01(plan.seed, 4)) % blinkPer;
  const blink = bt < 0.14 ? Math.sin((Math.PI * bt) / 0.14) : 0;

  // ---- frames and breathing radii ----------------------------------------------------------------------------
  const T: V3[] = [], U: V3[] = [], R: V3[] = [], r: number[] = [];
  const breath = Math.sin(2 * Math.PI * plan.breathHz * tt);
  for (let j = 0; j <= n; j++) {
    const Tj = norm(sub(P[Math.max(0, j - 1)], P[Math.min(n, j + 1)]));
    const fr = frame(Tj);
    const rl = roll * (1 - Math.abs(j / n - 0.5)); // roll toward the stance side, strongest mid-body
    T.push(Tj); U.push(rl ? rotate(fr.U, Tj, rl) : fr.U); R.push(rl ? rotate(fr.R, Tj, rl) : fr.R);
    const u = j / n;
    const w = Math.exp(-(((u - 0.38) / 0.22) ** 2));
    let rr = plan.radii[j] * (1 + (plan.mode === 'hover' ? 0.06 : 0.035) * breath * w);
    if (isSessile) rr *= 1 + 0.05 * Math.sin(1.3 * tt - u * 3);
    r.push(rr);
  }
  const spine: Spine = { P, T, U, R, r };
  const at = (u: number) => spineAt(spine, u * n, smooth);
  const humpAt = (u: number) => { const x = Math.min(n, Math.max(0, u * n)), i = Math.min(n - 1, Math.floor(x)); return 1 + plan.hump[i] + (plan.hump[i + 1] - plan.hump[i]) * (x - i); };

  // ---- legs ------------------------------------------------------------------------------------------------
  if (plan.legPairs > 0) {
    const rod = plan.limbKind === 'rod';
    const ua = plan.gait === 'hop' ? 0.42 : rod ? 0.47 : 0.5;
    const a = plan.legLen * ua, b = plan.legLen * (1 - ua);
    const lift = (plan.gait === 'hop' ? 0.4 : 0.2) * hipH;
    plan.legs.forEach((leg, pi) => {
      const ru = rAt(leg.u);
      for (const side of [-1, 1] as const) {
        const off = legPhase(plan.gait, pi, plan.legPairs, side);
        const b0 = at(leg.u);
        const hip = add(add(b0.p, scl(b0.R, side * ru * (plan.gait === 'hop' ? 0.85 : 0.7))), scl(b0.U, -ru * 0.3));
        const plant = (kk: number): V3 => {
          const sk = plantDistance(kk, plan.stride, plan.duty, off);
          const q = path.at(sk - leg.u * L);
          const rt = cross(q.t, UP);
          return [q.p[0] + rt[0] * side * (ru + plan.splay * plan.legLen), 0, q.p[2] + rt[2] * side * (ru + plan.splay * plan.legLen)];
        };
        const foot = footAt(gp + off, plan.duty, plant, lift).pos;
        const front = leg.u < 0.4 && plan.legPairs > 1;
        const pole: V3 = rod || plan.legPairs > 2
          ? add(add(scl(b0.U, 0.45), scl(b0.R, side * 1)), scl(b0.T, front ? 0.25 : -0.25)) // elbows out (sprawl)
          : add(add(scl(b0.T, front ? -0.8 : 0.8), scl(b0.R, side * 0.35)), scl(b0.U, 0.2));
        const rr = plan.legRadius;
        const thighT: PartType = rod ? 'thighSi' : 'thighC', shinT: PartType = rod ? 'rodSi' : 'rodC';
        const knob = (p: V3, r: number) => sink.part('eyeDot', p, [r, 0, 0], [0, r, 0], [0, 0, r], plan.limbHi, plan.limbHi, 0);
        const claws = (f: V3, dir: V3, n: number) => {
          const len = rr * (plan.diet > 0.55 ? 1.6 : 1.0);
          for (let i = 0; i < n; i++) {
            const d = norm(add(rotate(dir, UP, (i - (n - 1) / 2) * 0.5), [0, -0.25, 0]));
            const o: V3 = [f[0], rr * 0.22, f[2]];
            bone(sink, 'hornSi', o, add(o, scl(d, len)), rr * 0.24, UP, plan.limbLo, 'bone');
          }
        };
        const pad = (f: V3, r: number) => sink.part(rod ? 'plateSi' : 'plateC', [f[0], rr * 0.12, f[2]], scl(b0.T, r), [0, rr * 0.24, 0], scl(b0.R, r), plan.limbLo, plan.limbLo, 0);
        if (plan.gait === 'hop') {
          // jerboa leg: muscular thigh, shin, and a long foot flat on the ground (2-bone IK to the ankle)
          const fl = plan.legLen * 0.3;
          const toe = add(foot, scl(b0.T, fl * 0.5));
          const ankle: V3 = [foot[0] - b0.T[0] * fl * 0.5, foot[1] + rr * 0.8, foot[2] - b0.T[2] * fl * 0.5];
          const zk = twoBoneIK(hip, ankle, plan.legLen * 0.33, plan.legLen * 0.37, add(scl(b0.T, 1), scl(b0.R, side * 0.25)));
          bone(sink, 'thighC', hip, zk.knee, rr * 1.6, b0.T, plan.limbHi, plan.limbHi);
          knob(zk.knee, rr * 0.6);
          bone(sink, 'rodC', zk.knee, zk.foot, rr * 0.7, b0.T, plan.limbHi, plan.limbLo);
          knob(zk.foot, rr * 0.5);
          bone(sink, 'rodC', zk.foot, toe, rr * 0.55, UP, plan.limbLo, plan.limbLo);
          claws(toe, b0.T, 3);
          continue;
        }
        const quad = plan.legPairs <= 2;
        if (quad && !front) {
          // digitigrade hind leg: thigh (knee forward), shin back to a raised hock, metatarsus down to the toes
          const m = plan.legLen * 0.26;
          const ankle: V3 = [foot[0] - b0.T[0] * m * 0.4, foot[1] + m * 0.9, foot[2] - b0.T[2] * m * 0.4];
          const ik = twoBoneIK(hip, ankle, plan.legLen * 0.38, plan.legLen * 0.38, add(scl(b0.T, 1), scl(b0.R, side * 0.3)));
          bone(sink, thighT, hip, ik.knee, rr * 1.25, b0.T, plan.limbHi, plan.limbHi);
          knob(ik.knee, rr * 0.5);
          bone(sink, shinT, ik.knee, ik.foot, rr * 0.5, b0.T, plan.limbHi, plan.limbLo);
          knob(ik.foot, rr * 0.4);
          bone(sink, shinT, ik.foot, foot, rr * 0.4, b0.T, plan.limbLo, plan.limbLo);
          pad(foot, rr * 0.75);
          claws(foot, b0.T, rod ? 2 : 3);
        } else if (quad) {
          // front leg: upper arm, forearm (elbow back), short hand flat to the ground
          const wrist: V3 = [foot[0] - b0.T[0] * rr * 0.4, foot[1] + plan.legLen * 0.1, foot[2] - b0.T[2] * rr * 0.4];
          const ik = twoBoneIK(hip, wrist, plan.legLen * 0.47, plan.legLen * 0.43, add(scl(b0.T, -1), scl(b0.R, side * 0.25)));
          bone(sink, thighT, hip, ik.knee, rr * 1.1, b0.T, plan.limbHi, plan.limbHi);
          knob(ik.knee, rr * 0.48);
          bone(sink, shinT, ik.knee, ik.foot, rr * 0.5, b0.T, plan.limbHi, plan.limbLo);
          bone(sink, shinT, ik.foot, foot, rr * 0.42, b0.T, plan.limbLo, plan.limbLo);
          pad(foot, rr * 0.75);
          claws(foot, b0.T, rod ? 2 : 3);
        } else {
          // many-legged sprawl: thick femur up and out, thin tibia down, claw tip
          const ik = twoBoneIK(hip, foot, a, b, pole);
          bone(sink, thighT, hip, ik.knee, rr * 1.1, b0.T, plan.limbHi, plan.limbHi);
          knob(ik.knee, rr * 0.45);
          if (rod) bone(sink, 'rodSi', ik.knee, ik.foot, rr * 0.45, b0.T, plan.limbLo, plan.limbLo);
          else {
            const ctl = add(lerp3(ik.knee, ik.foot, 0.5), scl(sub(ik.knee, lerp3(hip, ik.foot, 0.5)), 0.25));
            const q = (u: number): V3 => add(add(scl(ik.knee, (1 - u) ** 2), scl(ctl, 2 * u * (1 - u))), scl(ik.foot, u * u));
            const m = Math.max(2, plan.legBones - 1);
            for (let i = 0; i < m; i++) bone(sink, 'rodC', q(i / m), q((i + 1) / m), rr * 0.5 * (1 - 0.4 * (i / m)), b0.T, plan.limbLo, plan.limbLo);
          }
          pad(foot, rr * 0.55);
          claws(foot, norm(add(b0.T, scl(b0.R, side * 0.5))), 2);
        }
      }
    });
  }

  // ---- armour --------------------------------------------------------------------------------------------------
  const pType: PartType = smooth ? 'plateC' : 'plateSi';
  for (const pl of plan.plates) {
    const f = at(pl.u);
    if (isSessile) {
      if (Math.round(pl.u * n) % 2) continue;
      for (let k2 = 0; k2 < plan.radialOrder; k2++) {
        const th = (2 * Math.PI * k2) / plan.radialOrder + pl.u * 4;
        const out = norm(add(scl(f.U, Math.cos(th)), scl(f.R, Math.sin(th))));
        const o = add(f.p, scl(out, f.r * 0.92));
        sink.part(pType, o, scl(f.T, seg * 0.5 * pl.size), scl(out, f.r * 0.14), scl(cross(f.T, out), f.r * 0.55 * pl.size), plan.plate, plan.belly, 0);
      }
      continue;
    }
    const y = norm(sub(f.U, scl(f.T, 0.35))); // shingled: each plate's back edge lifts over the next
    const o = add(f.p, scl(f.U, f.r * plan.aspect * 0.8 * humpAt(pl.u)));
    sink.part(pType, o, scl(f.T, seg * 0.7 * pl.size), scl(y, f.r * 0.1), scl(f.R, f.r * 0.62 * pl.size), plan.plate, plan.belly, 0);
  }

  // ---- glow: small cyan photophores in lines along the flanks (the accent stays small) -----------------------------
  if (plan.glowSpots > 0) {
    const nS = plan.glowSpots;
    for (let k2 = 0; k2 < nS; k2++) {
      const side = k2 % 2 ? 1 : -1;
      const u = isSessile ? 0.85 + 0.1 * hash01(plan.seed + k2, 2) : plan.headLen + 0.06 + (Math.floor(k2 / 2) / Math.max(1, Math.ceil(nS / 2))) * (0.8 - plan.headLen);
      const f = at(u);
      const th = isSessile ? (2 * Math.PI * k2) / nS : -0.25 + 0.2 * hash01(plan.seed + k2, 6);
      const out = isSessile ? norm(add(scl(f.U, Math.cos(th)), scl(f.R, Math.sin(th)))) : norm(add(scl(f.R, side * Math.cos(th)), scl(f.U, Math.sin(th) * plan.aspect)));
      const o = add(f.p, scl(out, f.r * (isSessile ? 1 : 0.98)));
      const gr = Math.max(0.004, Math.min(f.r * 0.075, 0.025 * Math.sqrt(L)));
      sink.part('eyeDot', o, [gr, 0, 0], [0, gr, 0], [0, 0, gr], 'glow', 'glow', 1);
    }
  }

  // ---- head: a sculpted skull (cranium, snout, jaw line), eyes in dark sockets under brow ridges, nostrils, horns -----
  if (!isSessile) {
    const F = norm(sub(P[0], P[1]));
    const fr = frame(F);
    const hr = plan.radii[0] / 0.75;
    const sculpt = plan.mode !== 'hover';
    const len = Math.max(hr * 2.4, L * plan.headLen * 0.9), hgt = hr * (smooth ? 1.6 : 1.45), wid = hr * 1.7;
    const SC = sculpt ? add(add(P[0], scl(F, len * 0.12)), scl(fr.U, hr * 0.1)) : lerp3(P[0], P[1], 0.35);
    const hx = sculpt ? len : hr * 2, hy = sculpt ? hgt / 2 : hr, hz = sculpt ? wid / 2 : hr;
    const hp = (fx: number, uy: number, rz: number): V3 => add(add(SC, scl(F, hx * fx)), add(scl(fr.U, hy * uy), scl(fr.R, hz * rz)));
    if (sculpt) sink.part(smooth ? 'skullC' : 'skullSi', SC, scl(F, len), scl(fr.U, hgt / 2), scl(fr.R, wid / 2), plan.belly, plan.back, 0);
    const spread = 1 + 2.2 * plan.headWidth;
    const er = plan.eyeRadius;
    const eye = (pos: V3, dir: V3, rad: number, kind: 'eyeRing' | 'eyeDot', glowE: boolean, brow: boolean) => {
      const z = norm(dir), x = norm(cross(fr.U, z)), y = cross(z, x);
      const sq = 1 - 0.85 * blink;
      if (sculpt && !glowE) sink.part('eyeDot', sub(pos, scl(z, rad * 0.3)), scl(x, rad * 1.32), scl(y, rad * 1.25), scl(z, rad * 1.1), 'ink', 'ink', 0); // socket
      sink.part(kind, pos, scl(x, rad), scl(y, rad * sq), scl(z, rad), glowE ? 'glow' : 'ink', glowE ? 'glow' : 'bone', glowE ? 1 : 0);
      if (sculpt && brow) {
        const bo = add(add(pos, scl(fr.U, rad * 1.15)), scl(z, -rad * 0.1));
        sink.part(smooth ? 'plateC' : 'plateSi', bo, scl(F, rad * 1.5), scl(norm(add(fr.U, scl(x, 0.2))), rad * 0.35), scl(x, rad * 1.2), plan.belly, plan.belly, 0);
      }
    };
    if (plan.eyeKind === 'rings') for (const e of [-1, 1]) {
      eye(sculpt ? hp(0.12, 0.32, e * 0.8 * spread) : add(add(SC, scl(F, hr * 0.42)), add(scl(fr.R, e * hr * 0.62 * spread), scl(fr.U, hr * 0.38))),
        add(add(scl(F, 0.45), scl(fr.R, e * 0.85)), scl(fr.U, 0.1)), er, 'eyeRing', false, true);
    } else if (plan.eyeKind === 'glossy') {
      eye(sculpt ? hp(0.16, 0.62, 0) : add(add(SC, scl(F, hr * 0.5)), scl(fr.U, hr * 0.42)), add(scl(F, 0.8), scl(fr.U, 0.45)), er, 'eyeRing', false, true);
    } else if (plan.eyeKind === 'dots' || plan.eyeKind === 'glowDots') {
      const g = plan.eyeKind === 'glowDots';
      const nE = plan.eyeCount;
      const clusters = nE === 6 ? [-1, 1] : [0];
      const per = nE / clusters.length;
      if (plan.headWidth > 0.3) bone(sink, 'rodSi', hp(0, 0.35, -0.75 * spread), hp(0, 0.35, 0.75 * spread), hr * 0.22, fr.U, plan.back, plan.back);
      for (const c of clusters) for (let i = 0; i < per; i++) {
        const a2 = per === 1 ? 0 : (i / (per - 1) - 0.5);
        const row = nE === 6 ? (i === 1 ? 1 : 0) : 0;
        const pz = (plan.headWidth > 0.3 ? c * 0.75 * spread : c * 0.55) + a2 * (nE === 6 ? 0.5 : 1.0);
        eye(hp(0.2 + 0.06 * row, 0.62 + 0.2 * row - 0.15 * Math.abs(a2), pz), add(scl(F, 0.8), add(scl(fr.U, 0.4), scl(fr.R, pz * 0.25))), er, 'eyeDot', g, false);
      }
      if (sculpt) sink.part('plateSi', hp(0.14, 0.86, 0), scl(F, hr * 0.5), scl(fr.U, hr * 0.12), scl(fr.R, hr * 0.8), plan.belly, plan.belly, 0); // brow shelf
    }
    if (sculpt) for (const e of [-1, 1]) { // nostrils
      const nr2 = hr * 0.07;
      sink.part('eyeDot', hp(0.5, 0.18, e * 0.16), [nr2, 0, 0], [0, nr2, 0], [0, 0, nr2], 'ink', 'ink', 0);
    }
    if (plan.hornCount > 0) {
      const hl = plan.hornLen;
      if (plan.hornCurved) for (const e of [-1, 1]) {
        const o = hp(-0.1, 0.72, e * 0.5);
        const y = norm(add(add(scl(fr.U, 0.75), scl(fr.R, e * 0.55)), scl(F, 0.25)));
        const z = norm(sub(scl(F, -1), scl(y, dot(scl(F, -1), y))));
        sink.part('hornC', o, scl(cross(y, z), hl * 0.16), scl(y, hl), scl(z, hl * 0.16), plan.belly, 'bone', 0);
      } else {
        const dirs: [V3, V3][] = [[hp(0.36, 0.6, 0), add(scl(F, 0.6), scl(fr.U, 0.8))]];
        if (plan.hornCount === 3) for (const e of [-1, 1]) dirs.push([hp(0.0, 0.8, e * 0.45), add(add(scl(F, 0.45), scl(fr.U, 0.8)), scl(fr.R, e * 0.35))]);
        dirs.forEach(([o, d], i) => bone(sink, 'hornSi', o, add(o, scl(norm(d), i === 0 ? hl : hl * 0.6)), hl * (i === 0 ? 0.17 : 0.13), F, plan.belly, 'bone'));
      }
    }
  }

  // ---- dorsal row: frills (carbon) wave in phase along the spine; rods (silicon) tick ------------------------------
  for (let k2 = 0; k2 < plan.dorsalCount; k2++) {
    const u = plan.headLen + ((k2 + 0.5) / plan.dorsalCount) * (0.92 - plan.headLen);
    const f = at(u);
    const o = add(f.p, scl(f.U, f.r * plan.aspect * 0.8 * humpAt(u)));
    const hgt = plan.dorsalHeight * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
    if (plan.dorsal === 'frills') {
      const wav = 0.35 * Math.sin(2.2 * tt - u * 9);
      const y = norm(add(f.U, scl(f.R, wav)));
      sink.part('frill', o, scl(f.T, -seg * 1.9), scl(y, hgt), scl(cross(f.T, y), hgt), plan.mark, plan.back, 0);
    } else {
      let a = 0.35 + 0.15 * Math.sin(1.4 * tt - u * 5);
      a = snapA(a, 15);
      const d = norm(add(scl(f.U, Math.cos(a)), scl(f.T, -Math.sin(a))));
      bone(sink, 'rodSi', o, add(o, scl(d, hgt)), f.r * 0.09, f.R, plan.belly, plan.mark);
    }
  }

  // ---- floaters: trailing tendrils, pectoral fins and flukes ------------------------------------------------------
  if (plan.mode === 'hover') {
    const N = plan.tendrils, M = 7, sl = plan.tendrilLen / M;
    for (let i = 0; i < N; i++) {
      const u = 0.28 + 0.42 * (i / Math.max(1, N - 1));
      const side = i % 2 ? 1 : -1;
      const f = at(u);
      let prev = add(add(f.p, scl(f.U, -f.r * plan.aspect * 0.85)), scl(f.R, side * f.r * 0.45));
      const y0 = prev[1];
      for (let k2 = 1; k2 <= M; k2++) {
        const q = path.at(s - u * L - k2 * sl * 0.55);
        const rt = cross(q.t, UP);
        const swy = Math.sin(1.3 * tt - k2 * 0.55 + i * 1.7) * k2 * sl * 0.22;
        const lateral = side * f.r * 0.45 + swy;
        const nxt: V3 = [q.p[0] + rt[0] * lateral, y0 - k2 * sl * 0.75, q.p[2] + rt[2] * lateral];
        const tip = k2 === M && i % 2 === 0 && plan.glow > 0.3;
        bone(sink, 'rodC', prev, nxt, f.r * 0.028 * (1 - 0.6 * (k2 / M)), f.T, k2 < 3 ? plan.belly : plan.mark, tip ? 'glow' : plan.mark, tip ? 1 : 0);
        prev = nxt;
      }
    }
    const flap = Math.sin(1.1 * tt - 2 * Math.PI * 0.8);
    for (const side of [-1, 1]) {
      const f = at(0.32);
      const out = norm(add(scl(f.R, side), scl(f.U, -0.35 + 0.2 * Math.sin(0.9 * tt))));
      const o = add(f.p, add(scl(f.R, side * f.r * 0.8), scl(f.U, -f.r * 0.25)));
      sink.part('frill', o, scl(f.T, -L * 0.14), scl(out, L * 0.17), scl(cross(f.T, out), L * 0.17), plan.belly, plan.back, 0);
      const ft = at(0.98);
      const outT = norm(add(scl(ft.R, side), scl(ft.U, 0.25 * flap)));
      sink.part('frill', ft.p, scl(ft.T, -L * 0.12), scl(outT, L * 0.13), scl(cross(ft.T, outT), L * 0.13), plan.belly, plan.mark, 0);
    }
  }

  // ---- sessile: radial feeding arms sweep (snapped 15° for silicon), glowing tips ----------------------------------
  if (isSessile) {
    const top = P[n];
    const rTop = r[n];
    const segA = plan.armLen / 2.6;
    for (let i = 0; i < plan.arms; i++) {
      const th = (2 * Math.PI * i) / plan.arms + (i % 2) * 0.2;
      const outD: V3 = [Math.cos(th), 0, Math.sin(th)];
      const inner = i % 2 === 1;
      const sweep = 0.5 + 0.5 * Math.sin(0.8 * tt + i * 0.9);
      let elev = (inner ? 70 : 48) * D2R - sweep * 20 * D2R;
      let p = add(top, add(scl(outD, rTop * (inner ? 0.5 : 0.9)), [0, -rTop * 0.1, 0]));
      const axis = norm(cross(outD, UP));
      for (let k2 = 0; k2 < 3; k2++) {
        const e = tick ? snapA(elev, 15) : elev;
        const d = rotate(outD, axis, -e);
        const q = add(p, scl(d, segA * (inner ? 0.8 : 1)));
        bone(sink, 'rodSi', p, q, rTop * 0.13 * (1 - 0.25 * k2), UP, k2 === 0 ? plan.belly : plan.back, k2 === 2 ? plan.mark : plan.back);
        p = q;
        elev -= (12 + 10 * sweep) * D2R;
      }
      if (plan.glow > 0.3 && !inner) sink.part('eyeDot', p, [rTop * 0.07, 0, 0], [0, rTop * 0.07, 0], [0, 0, rTop * 0.07], 'glow', 'glow', 1);
    }
  }

  return { spine, blink };
}
