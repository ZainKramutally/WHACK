// Gas-bell floater pose (the sky whale): an egg-shaped gas bell that breathes (slow inflate, quicker deflate), banks into
// turns as it drifts, a small body tucked under its lower rim that bobs a beat behind the bell, grip arms wrapped up the
// bell's meridians, and long ribbon tendrils that trail with lag and a travelling wave, ending in fluttering fronds.
// Pure: a function of (plan, t, path, instance).
import { add, cross, norm, rotate, scl, sub, type V3 } from '../flora/mesh';
import type { FaunaPlan } from './develop';
import type { Path } from './path';
import { bone, type Instance, type PoseOut, type Sink, type Spine } from './rig';

const UP: V3 = [0, 1, 0];
/** Key light used for the bell's soft highlight (matches the lab light; the world can pass its own). */
export const KEY_LIGHT: V3 = norm([-0.5, 0.62, 0.6]);

function ortho(axis: V3): [V3, V3] {
  const e1 = norm(cross(axis, Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]));
  return [e1, cross(axis, e1)];
}

/** Ribbon link: a flattened rodC (wide across `wide`, thin across the other axis). */
function ribbon(sink: Sink, a: V3, b: V3, w: number, wide: V3, ca: any, cb: any, glow = 0) {
  const y = sub(b, a);
  const yn = norm(y);
  let x = sub(wide, scl(yn, wide[0] * yn[0] + wide[1] * yn[1] + wide[2] * yn[2]));
  x = norm(x);
  const z = cross(x, yn);
  sink.part('rodC', a, scl(x, w), y, scl(z, w * 0.3), ca, cb, glow);
}

export function poseBell(plan: FaunaPlan, t: number, path: Path, inst: Instance, sink: Sink): PoseOut {
  const tt = t + inst.phase;
  const H = plan.scale, R = plan.bellR, n = plan.segments;
  const s = inst.s0 + plan.speed * t;
  const here = path.at(s), ahead = path.at(s + 0.15 * H);
  const fwd = here.t;
  // banking: lean into the turn in proportion to curvature × speed², plus a slight nose-down drift pitch
  const turn = Math.atan2(cross(fwd, ahead.t)[1], fwd[0] * ahead.t[0] + fwd[2] * ahead.t[2]) / (0.15 * H);
  const bank = Math.max(-0.35, Math.min(0.35, -turn * plan.speed * plan.speed * 6));
  const pitch = 0.07 + 0.03 * Math.sin(0.23 * tt);
  let axis = rotate(UP, fwd, bank);
  axis = rotate(axis, norm(cross(fwd, UP)), -pitch);
  const [e1, e2] = ortho(axis);

  // breathing: inflate slowly, deflate a little quicker (phase-warped sine); the bell widens as it shortens
  const w = 2 * Math.PI * plan.breathHz * 0.6;
  const ph = w * tt;
  const breath = Math.sin(ph - 0.45 * Math.sin(ph));
  const alt = 2 + 4 * H + 0.03 * H * Math.sin(0.17 * tt);
  const C: V3 = [here.p[0], alt + 0.02 * H * breath, here.p[2]];
  const rs = 1 + 0.06 * breath, hs = 1 - 0.03 * breath;

  // ---- bell spine (joint 0 = bottom rim, n = crown) ----------------------------------------------------------------
  const P: V3[] = [], T: V3[] = [], U: V3[] = [], Rr: V3[] = [], r: number[] = [];
  for (let j = 0; j <= n; j++) {
    const u = j / n;
    P.push(add(C, scl(axis, (u - 0.5) * H * hs)));
    T.push(scl(axis, -1)); U.push(e1); Rr.push(cross(scl(axis, -1), e1));
    r.push(plan.radii[j] * rs * (1 + 0.025 * Math.sin(1.3 * tt - u * 5)));
  }
  const spine: Spine = { P, T, U, R: Rr, r };
  const rAt = (u: number) => { const x = u * n, i = Math.min(n - 1, Math.floor(x)), f = x - i; return r[i] + (r[i + 1] - r[i]) * f; };
  const surf = (u: number, dir: V3, lift = 0): V3 => add(add(C, scl(axis, (u - 0.5) * H * hs)), scl(dir, rAt(u) + lift));

  // ---- body: a small creature clinging under the bell's FRONT lower rim, head forward, body curving down and back
  // under the bell to the tail where the tendrils hang. It bobs a beat after the bell's breath.
  const back = scl(fwd, -1);
  const flat = (v: V3) => norm(sub(v, scl(axis, v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2])));
  const front = flat(fwd);
  const down = scl(axis, -1);
  const bob = 0.04 * H * Math.sin(ph - 1.1);
  const L = plan.bodyLen;
  const br = L * 0.34;
  const swayB = 0.05 * H * Math.sin(0.9 * tt);
  const lat = norm(cross(axis, front));
  const headP = add(add(surf(0.1, front, br * 1.1), scl(down, bob)), scl(lat, swayB * 0.3));
  const ctl = add(add(surf(0.0, front, 0), scl(down, 0.1 * H + bob)), scl(lat, swayB * 0.6));
  const tailP = add(add(C, scl(down, 0.5 * H * hs + 0.16 * H + bob * 1.4)), add(scl(front, -0.05 * H), scl(lat, swayB)));
  const curve = (u: number): V3 => add(add(scl(headP, (1 - u) ** 2), scl(ctl, 2 * u * (1 - u))), scl(tailP, u * u));
  const nB = 4;
  for (let k = 0; k < nB; k++) {
    const u0 = k / nB, u1 = (k + 1) / nB;
    bone(sink, 'rodC', curve(u0), curve(u1), br * (1.05 - 0.55 * u0), lat, plan.belly, k < 2 ? plan.belly : plan.limbLo);
  }
  // head bulb, slightly larger, looking forward
  const hd = norm(sub(curve(0), curve(0.15)));
  bone(sink, 'rodC', add(headP, scl(hd, -br * 0.4)), add(headP, scl(hd, br * 0.9)), br * 1.3, lat, plan.belly, plan.belly);
  const blinkPer = 3.5, bt = (tt + 1.3) % blinkPer;
  const blink = bt < 0.15 ? Math.sin((Math.PI * bt) / 0.15) : 0;
  const er = plan.eyeRadius;
  for (const e of [-1, 1]) {
    const dir = norm(add(add(scl(hd, 0.75), scl(lat, e * 0.6)), scl(down, 0.1)));
    const o = add(add(headP, scl(hd, br * 0.55)), add(scl(lat, e * br * 0.75), scl(axis, br * 0.25)));
    const z = dir, x = norm(cross(axis, z)), y = cross(z, x);
    sink.part('eyeRing', o, scl(x, er), scl(y, er * (1 - 0.85 * blink)), scl(z, er), 'ink', 'bone', 0);
  }
  const mid = tailP;

  // ---- grip arms: from the shoulders out over the rim, then wrapped up the bell's meridians ------------------------
  const nA = plan.gripArms;
  const shoulder = curve(0.2);
  for (let a = 0; a < nA; a++) {
    const off = (a / Math.max(1, nA - 1) - 0.5) * 1.5 + 0.06 * Math.sin(0.7 * tt + a);
    const dir = norm(add(scl(front, Math.cos(off)), scl(lat, Math.sin(off))));
    const uEnd = 0.32 + 0.35 * (plan.armLen / Math.max(1e-3, plan.scale)) + 0.04 * Math.sin(ph + a);
    const ar = br * 0.34;
    let prev = add(shoulder, scl(lat, (a / Math.max(1, nA - 1) - 0.5) * br * 1.2));
    const M = 7;
    for (let k = 1; k <= M; k++) {
      const u = 0.04 + (uEnd - 0.04) * (k / M);
      const q = surf(u, dir, ar * 1.1);
      bone(sink, 'rodC', prev, q, ar * (1 - 0.5 * (k / M)), dir, plan.limbHi, plan.limbHi);
      prev = q;
    }
    const tip = add(prev, scl(norm(add(axis, scl(dir, -0.7))), ar * 3));
    bone(sink, 'rodC', prev, tip, ar * 0.5, dir, plan.limbHi, plan.limbLo); // curled fingertip
  }

  // ---- trailing ribbon tendrils: lag behind the drift, travelling wave, fronds at the ends ---------------------------
  const N = plan.tendrils, M = 10, seg = plan.tendrilLen / M;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * 2 * Math.PI + 0.4;
    const spread = add(scl(e1, Math.cos(ang)), scl(e2, Math.sin(ang)));
    let p = add(add(mid, scl(spread, br * 1.1)), scl(down, br * 0.3));
    const len = 0.7 + 0.3 * ((i * 7) % 5) / 4;
    const sl = seg * len;
    for (let k = 1; k <= M; k++) {
      const kk = k / M;
      const wave = Math.sin(1.1 * tt - k * 0.55 + i * 1.9);
      const latW = scl(norm(cross(down, fwd)), wave * 0.3 * sl * kk * 2.2);
      const lag = scl(back, sl * (0.12 + 0.22 * kk));               // trails behind the drift, more at the tips
      const fan = scl(spread, sl * 0.7 * (1 - kk * 0.6));
      const q = add(add(add(add(p, scl(down, sl * 0.9)), lag), latW), fan);
      const wide = norm(cross(sub(q, p), fwd));
      ribbon(sink, p, q, Math.max(0.01, br * 0.55 * (1 - 0.4 * kk)), wide, plan.belly, plan.belly);
      // fronds: feathery fins along the last links, fluttering
      if (k >= M - 3) {
        const d = norm(sub(q, p));
        for (const sd of [-1, 1]) {
          const flut = 0.5 * Math.sin(4.2 * tt + k * 1.3 + i + sd);
          const out = norm(add(scl(wide, sd), scl(fwd, 0.3 * flut)));
          const fl = sl * (1.3 - 0.2 * (M - k));
          sink.part('frill', p, scl(d, sl * 1.15), scl(out, fl * 0.8), scl(cross(d, out), fl * 0.8), plan.back, plan.back, 0);
        }
      }
      if (k === M - 3 && plan.accentOn === 'glow' && i % 2 === 0) {
        const gr = Math.max(0.008, 0.004 * H);
        sink.part('eyeDot', q, [gr, 0, 0], [0, gr, 0], [0, 0, gr], 'glow', 'glow', 1);
      }
      p = q;
    }
  }
  return { spine, blink };
}
