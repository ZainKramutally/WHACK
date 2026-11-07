// The nine species: placement (landmark clusters + Thomas scatter weighted by niche) and materials.
import * as THREE from 'three/webgpu';
import {
  float, vec3, vec2, color, mix, smoothstep, sin, cos, pow, step, fract, positionGeometry, normalWorld, normalView,
  positionViewDirection, mx_worley_noise_vec2, mx_fractal_noise_float, saturate,
} from 'three/tsl';
import type { Landmark, SpeciesId, Vec2, WorldContext } from '../contracts';
import * as S from './shapes';
import type { MeshData } from './meshdata';
import { Inst, FloraMesh, buildInstanced } from './build';
import { Rng, Valley, distToValley, gauss, makeValley, powerLaw, thomas, valleyPoint } from './placement';
import { aAux, aPar, aRand, floraPosition } from './nodes';

export interface Env { ctx: WorldContext; rng: Rng; valley: Valley; q: number; lm: Landmark[]; vw: number; ownUniforms: { capWidth: any; stalkHeight: any } }

const TAU = Math.PI * 2;
const n0 = (n: number, env: Env) => Math.max(1, Math.round(n * env.q));

interface ScatterOpts {
  n: number; parents: number; sMin: number; sMax: number; sPow?: number;
  latMin: number; latSpread: number; sigma: number;
  size: (rng: Rng, x: number, z: number) => number;
  anchors?: Vec2[]; anchorJitter?: number;
  clearHalf?: number; clearP?: number;
  randMax?: number; yOff?: (s: number) => number; group0?: number;
  alpha?: number; wMax?: number;
}

function scatter(env: Env, o: ScatterOpts): Inst[] {
  const { rng, valley } = env;
  const sMax = Math.min(o.sMax, valley.length), sMin = Math.min(o.sMin, sMax);
  const anchors = o.anchors ?? [];
  const parents = Math.max(o.parents, anchors.length);
  const pts = thomas(rng, {
    total: n0(o.n, env), parents, sigma: o.sigma, alpha: o.alpha, wMax: o.wMax,
    parentAt: (r, i) => {
      if (i < anchors.length) { const j = o.anchorJitter ?? 3; return [anchors[i][0] + gauss(r) * j, anchors[i][1] + gauss(r) * j]; }
      const s = sMin + (sMax - sMin) * Math.pow(r(), o.sPow ?? 1);
      const side = r() < 0.5 ? -1 : 1;
      return valleyPoint(valley, s, side * (o.latMin + Math.abs(gauss(r)) * o.latSpread));
    },
  });
  const out: Inst[] = [];
  for (const p of pts) {
    if (o.clearHalf) {
      let d = Infinity;
      for (let i = 1; i < valley.pts.length; i++) {
        const [ax, az] = valley.pts[i - 1], [bx, bz] = valley.pts[i];
        const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const t = Math.min(1, Math.max(0, ((p.x - ax) * dx + (p.z - az) * dz) / l2));
        d = Math.min(d, Math.hypot(p.x - ax - dx * t, p.z - az - dz * t));
      }
      if (d < o.clearHalf && rng() < (o.clearP ?? 0.85)) continue;
    }
    out.push({ x: p.x, z: p.z, scale: o.size(rng, p.x, p.z), yaw: rng() * TAU, rand: rng() * (o.randMax ?? 1), group: (o.group0 ?? 0) + p.parent, yOff: o.yOff?.(p.z) });
  }
  return out;
}

/** Hero `cluster` landmarks for one species: always present, but persist longer as the niche shrinks (rand ≤ 0.6). */
function clusters(env: Env, id: SpeciesId, size: (rng: Rng, mul: number) => number, group0 = 100, clearHalf = 0): Inst[] {
  const out: Inst[] = [];
  env.lm.forEach((l, li) => {
    if (l.kind !== 'cluster' || l.species !== id) return;
    const pts = thomas(env.rng, {
      total: n0(l.count, env), parents: Math.max(2, Math.ceil(l.count / 30)), sigma: l.radius * 0.14,
      parentAt: (r) => { const a = r() * TAU, d = Math.sqrt(r()) * l.radius * 0.75; return [l.pos[0] + Math.cos(a) * d, l.pos[1] + Math.sin(a) * d]; },
    });
    for (const p of pts) if (!clearHalf || distToValley(env.valley, p.x, p.z) > clearHalf || env.rng() < 0.15) out.push({ x: p.x, z: p.z, scale: size(env.rng, l.scale ?? 1), yaw: env.rng() * TAU, rand: env.rng() * 0.6, group: group0 + li * 40 + p.parent });
  });
  return out;
}

const lmOf = <K extends Landmark['kind']>(env: Env, k: K) => env.lm.filter((l) => l.kind === k) as Extract<Landmark, { kind: K }>[];

// ================================================================== species

export interface SpeciesBuild { id: SpeciesId; geo: MeshData; mat: any; insts: Inst[]; shadow?: boolean; side?: any; extra?: (env: Env, parts: SpeciesBuild, built: FloraMesh) => FloraMesh[] }


export function lanternCups(env: Env): SpeciesBuild {
  const { ctx } = env, u = ctx.uniforms;
  const size = (r: Rng, mul: number) => Math.min(3, powerLaw(r, 0.18, 2.0, 3.0) * Math.min(mul, 1.25));
  let insts = [
    ...clusters(env, 'lanternCups', size, 100, 1.1),
    ...scatter(env, {
      n: 600, parents: 36, sMin: 0, sMax: 90, sPow: 1.4, latMin: 2.2, latSpread: Math.max(4, env.vw * 0.18), sigma: 1.0, wMax: 40,
      size: (r) => size(r, 1), clearHalf: 2.0, clearP: 0.95, yOff: () => -0.04,
    }),
  ];
  const cam = ctx.camera.position; // keep cups out of the lens
  insts = insts.filter((i) => { const d = Math.hypot(i.x - cam.x, i.z - cam.z); return !(i.scale * 0.5 > d * 0.38 || d < 1.6); });
  // hero glowing-dome cups, framed bottom-right / left of the camera (works for any pin camera)
  const tgt = ctx.preset.composition.camera.target;
  let fx = tgt[0] - cam.x, fz = tgt[2] - cam.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const at = (f: number, r: number, scale: number, rand: number): Inst => ({ x: cam.x + fx * f - fz * r, z: cam.z + fz * f + fx * r, scale, yaw: env.rng() * TAU, rand, yOff: -0.04, group: 90 });
  const domes: Inst[] = [at(3.3, 1.05, 1.5, 0.1), at(5.6, -2.0, 1.1, 0.14), at(7.5, 2.8, 0.9, 0.2)];
  const cups: Inst[] = [];
  for (const i of insts) (i.scale > 0.6 && env.rng() < 0.16 ? domes : cups).push(i);
  // coral-red spiky tufts among the cups (the pin's fine red undergrowth)
  const tufts: Inst[] = [];
  for (const i of [...cups, ...domes]) {
    const k = i.scale > 0.5 ? 3 : 1;
    for (let j = 0; j < k; j++) {
      if (env.rng() < 0.5) continue;
      const a = env.rng() * TAU, d = (0.25 + env.rng() * 0.9) * Math.max(0.5, i.scale);
      const tx = i.x + Math.cos(a) * d, tz = i.z + Math.sin(a) * d;
      if (Math.hypot(tx - cam.x, tz - cam.z) < 4 || distToValley(env.valley, tx, tz) < 1.4) continue;
      tufts.push({ x: tx, z: tz, scale: 0.25 + env.rng() * 0.45, yaw: env.rng() * TAU, rand: Math.min(1, i.rand + 0.02), yOff: -0.03, group: i.group });
    }
  }
  const time = u.time;
  const p = positionGeometry.mul(26);
  const w = mx_worley_noise_vec2(p, 1.0);
  const edge = w.y.sub(w.x);
  const vein = smoothstep(0.17, 0.0, edge);
  const aux = aAux();
  const inside = smoothstep(0.7, 1.0, aux.w);
  const rim = smoothstep(0.3, 0.5, aux.w).mul(float(1).sub(inside));
  const phase = fract(aRand().mul(17.31));
  const breath = float(0.8).add(sin(time.mul(0.9).add(phase.mul(TAU))).mul(0.2));
  const gk = mix(0.6, 1.0, saturate(u.glow.mul(1.5)));
  const hue = u.glowColor;
  const hueTop = mix(hue, vec3(1.0, 0.78, 0.86), smoothstep(0.55, 1.0, positionGeometry.y).mul(0.5));
  const bodyMask = smoothstep(0.3, 0.62, positionGeometry.y); // stalk dimmer than cup
  const e = mix(0.6, 2.7, vein).mul(mix(1.0, 1.55, inside)).mul(mix(0.25, 1.0, bodyMask)).add(rim.mul(1.6));
  const emissive = hueTop.mul(e).mul(breath).mul(gk);
  const col = mix(hue.mul(0.35), hue.mul(0.7), bodyMask.mul(0.6).add(inside.mul(0.4)));
  const mat = ctx.materials.create({
    color: col, emissive,
    positionNode: floraPosition(ctx, 'lanternCups', { sway: 0.025, swayHz: 0.3, swayPow: 2.2, breathe: 0.03, stretchY: fract(aRand().mul(13.7)).mul(1.1).add(0.8) }),
  });
  // domes keep their natural proportions (no random stretch)
  const mat2 = ctx.materials.create({
    color: col, emissive: emissive.mul(1.15).add(hueTop.mul(inside).mul(0.9)),
    positionNode: floraPosition(ctx, 'lanternCups', { sway: 0.02, swayHz: 0.3, swayPow: 2.2, breathe: 0.03 }),
  });
  const extra = (e2: Env): FloraMesh[] => {
    const coral = mix(u.glowColor, vec3(1.0, 0.32, 0.28), 0.3);
    const tm = e2.ctx.materials.create({ color: coral.mul(0.8), emissive: coral.mul(0.3), positionNode: floraPosition(e2.ctx, 'lanternCups', { sway: 0.05, swayHz: 0.8, swayPow: 1.4 }) });
    tm.side = THREE.DoubleSide;
    return [
      buildInstanced(e2.ctx, 'lanternCups', S.lanternDome(), mat2, domes),
      buildInstanced(e2.ctx, 'lanternCups', S.glassWhiskers(7, 9, 3), tm, tufts),
    ];
  };
  return { id: 'lanternCups', geo: S.lanternCup(), mat, insts: cups, extra };
}

export function frostFans(env: Env): SpeciesBuild {
  const { ctx } = env, u = ctx.uniforms;
  const walls = lmOf(env, 'wall'), arches = lmOf(env, 'arch');
  const anchors: Vec2[] = [];
  for (const w of walls) { anchors.push([w.pos[0], w.pos[1] + w.depth * 0.45], [w.pos[0] + (w.pos[0] < 0 ? 1 : -1) * w.width * 0.5, w.pos[1]]); }
  for (const a of arches) anchors.push(a.a, a.b);
  const hasAnchors = anchors.length > 0;
  const insts = scatter(env, {
    n: 60, parents: hasAnchors ? anchors.length + 4 : 10, sMin: 4, sMax: 200, sPow: 1.2, latMin: env.vw * 0.35, latSpread: 6, sigma: 3.2, anchors, anchorJitter: 4,
    size: (r) => Math.min(3.5, powerLaw(r, 0.8, 3.5, 2.3)), yOff: () => -0.05,
  });
  const tip = aAux().w;
  const shimmer = pow(sin(u.time.mul(1.6).add(positionGeometry.x.add(positionGeometry.z).mul(37.0)).add(aRand().mul(90))).mul(0.5).add(0.5), 14).mul(0.7);
  const col = mix(color(0xa9cfe6), color(0xeaf6ff), saturate(tip.mul(2)));
  const emissive = vec3(0.35, 0.6, 0.8).mul(0.35).add(vec3(0.7, 0.9, 1.0).mul(shimmer).mul(tip.add(0.3)));
  const mat = ctx.materials.create({ color: col, emissive, glass: true, positionNode: floraPosition(ctx, 'frostFans', {}) });
  mat.side = THREE.DoubleSide;
  return { id: 'frostFans', geo: S.frostFan(), mat, insts };
}

export function glowStalks(env: Env): SpeciesBuild {
  const { ctx, ownUniforms } = env, u = ctx.uniforms;
  const size = (r: Rng, mul: number) => { const u = r(); return (u < 0.24 ? 0.6 + r() * 1.9 : u < 0.86 ? powerLaw(r, 3, 12, 1.2) : 12 + r() * 8) * Math.min(1.2, mul); };
  const insts = [
    ...clusters(env, 'glowStalks', size, 200, 1.5),
    ...scatter(env, {
      n: 260, parents: 11, sMin: 6, sMax: 100, sPow: 1.3, latMin: 2, latSpread: Math.max(7, env.vw * 0.35), sigma: 2.4, group0: 300,
      size: (r) => size(r, 1), clearHalf: 2.5, clearP: 0.7, yOff: () => -0.05,
    }),
  ];
  for (const i of insts) if (i.scale > 3 && Math.hypot(i.x - ctx.camera.position.x, i.z - ctx.camera.position.z) < 26) i.scale = 0.8 + env.rng() * 2.4;
  const aux = aAux();
  const capMask = smoothstep(0.2, 0.5, aux.w), under = smoothstep(0.75, 1.0, aux.w);
  const v = fract(aRand().mul(37.3));
  const pale = mix(u.glowColor, vec3(1), 0.12);
  const small = smoothstep(3.0, 1.0, aPar().x);
  const variant = mix(mix(pale, mix(pale, vec3(0.95, 0.9, 0.35), 0.4), step(v, 0.16)), mix(pale, vec3(0.7, 0.62, 1.0), 0.45), step(0.84, v).max(small.mul(0.7)));
  const warm = vec3(0.8, 0.8, 0.41);
  const lowTint = smoothstep(0.35, 0.0, positionGeometry.y);
  const hue = mix(variant, warm, lowTint.mul(0.5));
  const breath = float(0.85).add(sin(u.time.mul(0.6).add(aRand().mul(40))).mul(0.15));
  const e = mix(0.5, 0.7, positionGeometry.y).mul(float(1).sub(capMask)).add(capMask.mul(mix(0.9, 2.0, under)));
  const gk = mix(0.75, 1.0, saturate(u.glow));
  const emissive = hue.mul(e).mul(breath).mul(gk);
  const mat = ctx.materials.create({
    color: hue.mul(0.35), emissive,
    positionNode: floraPosition(ctx, 'glowStalks', {
      sway: 0.075, swayHz: 0.22, swayPow: 1.6, stretchY: float(0.8).add(ownUniforms.stalkHeight.mul(0.5)),
      deform: (g: any, a: any) => vec3(a.x, 0, a.z).mul(a.w.greaterThan(0.2).select(float(0.9).add(ownUniforms.capWidth.mul(1.4)).sub(1), 0)).add(vec3(g.y.mul(g.y).mul(fract(aRand().mul(7.7)).sub(0.5).mul(0.4)), 0, g.y.mul(g.y).mul(fract(aRand().mul(3.3)).sub(0.5).mul(0.3)))),
    }),
  });
  // pooled light decals under each cluster
  const extra = (e2: Env, sb: SpeciesBuild): FloraMesh[] => {
    const groups = new Map<number, Inst[]>();
    sb.insts.forEach((i) => { const g = i.group ?? 0; (groups.get(g) ?? groups.set(g, []).get(g)!).push(i); });
    const pools: Inst[] = [];
    groups.forEach((list) => {
      if (list.length < 6) return;
      const cx = list.reduce((a, i) => a + i.x, 0) / list.length, cz = list.reduce((a, i) => a + i.z, 0) / list.length;
      const rms = Math.sqrt(list.reduce((a, i) => a + (i.x - cx) ** 2 + (i.z - cz) ** 2, 0) / list.length);
      const big = Math.max(...list.map((i) => i.scale));
      const R = Math.max(5, rms * 3.0 + big * 0.2), cam = e2.ctx.camera.position, dx = cam.x - cx, dz = cam.z - cz, dl = Math.hypot(dx, dz) || 1;
      pools.push({ x: cx + (dx / dl) * R * 0.45, z: cz + (dz / dl) * R * 0.45, scale: R, yaw: 0, rand: Math.min(...list.map((i) => i.rand)), yOff: 0.06 });
    });
    const rr = pow(float(1).sub(aAux().w), 1.8);
    const poolHue = mix(vec3(1.0, 0.62, 0.1), vec3(0.85, 0.9, 0.3), pow(rr, 0.5));
    const pm = e2.ctx.materials.create({
      color: color(0x000000), emissive: poolHue.mul(0.85), opacity: pow(rr, 1.6).mul(0.75),
      positionNode: floraPosition(e2.ctx, 'glowStalks', {}),
    });
    pm.blending = THREE.AdditiveBlending; pm.depthWrite = false; pm.side = THREE.DoubleSide;
    pm.polygonOffset = true; pm.polygonOffsetFactor = -2;
    return [buildInstanced(e2.ctx, 'glowStalks', S.lightPool(), pm, pools, { order: -1 })];
  };
  return { id: 'glowStalks', geo: S.glowStalk(), mat, insts, extra };
}

export function mossDomes(env: Env): SpeciesBuild {
  const { ctx } = env, u = ctx.uniforms, rng = env.rng;
  const insts: Inst[] = [];
  let gid = 400;
  for (const d of lmOf(env, 'dome')) {
    const g = gid++, r0 = rng() * 0.4;
    insts.push({ x: d.pos[0], z: d.pos[1], scale: d.radius, yaw: rng() * TAU, rand: r0, yOff: -d.radius * 0.18, group: g });
    let top = d.radius * 0.7, rad = d.radius;
    for (let k = 1; k < (d.stack ?? 1); k++) {
      rad *= 0.62;
      insts.push({
        x: d.pos[0] + (rng() - 0.5) * d.radius * 0.5, z: d.pos[1] + (rng() - 0.5) * d.radius * 0.4, scale: rad, yaw: rng() * TAU,
        rand: r0 + 0.012 * k, yOff: top - rad * 0.3, group: g,
      });
      top += rad * 0.9;
    }
  }
  // filler domes flank the valley, big and far
  const filler = scatter(env, {
    n: 22, parents: 9, sMin: 18, sMax: 150, sPow: 1.1, latMin: env.vw * 0.5 + 8, latSpread: 30, sigma: 7,
    size: (r) => powerLaw(r, 6, 26, 1.6), yOff: () => -3, group0: 500,
  });
  for (const f of filler) { f.yOff = -f.scale * 0.2; insts.push(f); }
  const nrm = normalWorld.y.mul(0.5).add(0.5);
  const streak = mx_fractal_noise_float(positionGeometry.mul(vec3(2.4, 8.0, 2.4)).add(aRand().mul(30)), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  const base = mix(color(0x0a4a45), color(0x27aaa6), smoothstep(0.25, 0.95, nrm));
  const olive = smoothstep(0.58, 0.8, streak).mul(float(1).sub(nrm)).mul(smoothstep(0.55, 0.2, positionGeometry.y.mul(0.5).add(0.5)));
  const soft = smoothstep(0.3, 0.7, streak);
  const col = mix(mix(base, base.mul(1.18).add(0.03), soft.mul(0.5)), color(0x7fa84a), olive.mul(0.35));
  const emissive = col.mul(0.22).mul(mix(0.6, 1.0, saturate(u.glow)));
  const mat = ctx.materials.create({ color: col, emissive, positionNode: floraPosition(ctx, 'mossDomes', { breathe: 0.01 }) });
  return { id: 'mossDomes', geo: S.mossDome(2), mat, insts };
}

export function shadeRibbons(env: Env): SpeciesBuild {
  const { ctx } = env, u = ctx.uniforms;
  const size = (r: Rng, mul: number) => powerLaw(r, 30, 70, 1.3) * mul;
  const far = (i: Inst) => Math.hypot(i.x - env.ctx.camera.position.x, i.z - env.ctx.camera.position.z) > 75;
  const insts = [
    ...clusters(env, 'shadeRibbons', size, 600).filter(far),
    ...scatter(env, {
      n: 110, parents: 16, sMin: 60, sMax: 220, sPow: 0.8, latMin: env.vw * 0.35, latSpread: 45, sigma: 9, group0: 700,
      size: (r) => size(r, 1), yOff: () => -1,
    }).filter(far),
  ];
  const t = aAux().w;
  const streak = mx_fractal_noise_float(vec3(positionGeometry.x.mul(40), positionGeometry.y.mul(3), aRand().mul(50)), 2, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  const col = mix(mix(color(0x05301a), color(0x0c5a34), streak), color(0x1b8a50), smoothstep(0.55, 1.0, t).mul(streak).mul(0.6));
  const emissive = col.mul(0.35).mul(mix(0.5, 1, saturate(u.glow)));
  const mat = ctx.materials.create({
    color: col, emissive,
    positionNode: floraPosition(ctx, 'shadeRibbons', { sway: 0.14, swayHz: 0.12, swayPow: 1.4 }),
  });
  mat.side = THREE.DoubleSide;
  return { id: 'shadeRibbons', geo: S.shadeRibbon(4), mat, insts };
}

export function glassWhiskers(env: Env): SpeciesBuild {
  const { ctx } = env, u = ctx.uniforms;
  const spires = lmOf(env, 'spire'), walls = lmOf(env, 'wall');
  const anchors: Vec2[] = [];
  for (const s of spires) for (let k = 0; k < 3; k++) { const a = env.rng() * TAU; anchors.push([s.pos[0] + Math.cos(a) * s.radius * 1.5, s.pos[1] + Math.sin(a) * s.radius * 1.5]); }
  for (const w of walls) if (w.height < 12) anchors.push([w.pos[0], w.pos[1]]);
  const insts = scatter(env, {
    n: 560, parents: anchors.length + 6, sMin: 3, sMax: 160, sPow: 1.2, latMin: 2, latSpread: Math.max(5, env.vw * 0.3), sigma: 2.4, anchors, anchorJitter: 3,
    size: (r) => Math.min(3, powerLaw(r, 0.5, 3, 2.1)), clearHalf: 1.2, clearP: 0.8, yOff: () => -0.05,
  });
  const t = aAux().w;
  const col = mix(color(0xe9e3d3), color(0xffffff), t);
  const tipHue = mix(vec3(1, 1, 0.95), u.poreGlowColor, 0.55);
  const glint = pow(sin(u.time.mul(1.3).add(aRand().mul(70)).add(t.mul(5))).mul(0.5).add(0.5), 8).mul(0.35);
  const emissive = tipHue.mul(pow(t, 2.0).mul(0.6).add(glint.mul(t)));
  const mat = ctx.materials.create({ color: col, emissive, glass: true, positionNode: floraPosition(ctx, 'glassWhiskers', { sway: 0.012, swayHz: 1.4, swayPow: 1.5 }) });
  mat.side = THREE.DoubleSide;
  return { id: 'glassWhiskers', geo: S.glassWhiskers(2), mat, insts };
}

export function blackMonoliths(env: Env): SpeciesBuild {
  const { ctx } = env, u = ctx.uniforms, rng = env.rng;
  const insts: Inst[] = lmOf(env, 'monolith').map((m) => ({ x: m.pos[0], z: m.pos[1], scale: m.height, yaw: (rng() - 0.5) * 0.5, rand: rng() * 0.35, yOff: 0 }));
  // distant filler by niche
  for (let i = 0; i < n0(9, env); i++) {
    const s = 40 + rng() * Math.min(260, env.valley.length - 40), lat = (rng() < 0.5 ? -1 : 1) * (8 + rng() * env.vw * 0.35);
    const p = valleyPoint(env.valley, s, lat);
    insts.push({ x: p[0], z: p[1], scale: 6 + rng() * 9, yaw: (rng() - 0.5) * 0.6, rand: 0.3 + rng() * 0.7, yOff: 0 });
  }
  const eye = smoothstep(0.8, 1.0, aAux().w);
  const fres = float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(2.5);
  const rimHue = mix(u.ground, u.haze, 0.35);
  const emissive = rimHue.mul(fres.mul(0.2)).add(vec3(0.95, 0.95, 0.9).mul(eye));
  const mat = ctx.materials.create({
    color: mix(color(0x0a0706), color(0xf4f1e4), eye), emissive,
    positionNode: floraPosition(ctx, 'blackMonoliths', {}),
  });
  return { id: 'blackMonoliths', geo: S.blackMonolith(3), mat, insts, shadow: true };
}

export function ashScrub(env: Env): SpeciesBuild {
  const { ctx } = env;
  const insts = [...clusters(env, 'ashScrub', (r, mul) => Math.min(60, powerLaw(r, 2, 8, 1.7) * mul), 800), ...scatter(env, {
    n: 150, parents: 20, sMin: 12, sMax: 230, sPow: 1.5, latMin: 0, latSpread: Math.min(env.vw * 0.3, 70), sigma: 5,
    size: (r, x, z) => Math.min(60, powerLaw(r, 2, 8, 1.7) * (0.6 + Math.abs(z) * 0.035)), yOff: () => -0.02,
  })];
  for (const i of insts) i.yOff = 0.08;
  const t = aAux().w;
  const n = mx_fractal_noise_float(vec3(positionGeometry.x.mul(3.5), positionGeometry.y.mul(4), positionGeometry.z.mul(40)).add(aRand().mul(20)), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  const col = mix(mix(mix(color(0x2a4440), color(0x6b8a82), n), color(0x5c5a3a), smoothstep(0.62, 0.8, n).mul(0.6)), color(0x1c2a2a), smoothstep(0.6, 1.0, t));
  const mat = ctx.materials.create({ color: col, flatShading: true, opacity: smoothstep(1.0, 0.72, t), positionNode: floraPosition(ctx, 'ashScrub', {}) });
  mat.depthWrite = false;
  return { id: 'ashScrub', geo: S.ashMat(5), mat, insts };
}

export const BUILDERS: ((env: Env) => SpeciesBuild)[] = [
  mossDomes, shadeRibbons, glowStalks, lanternCups, frostFans, glassWhiskers, ashScrub, blackMonoliths,
];
export { makeValley };
