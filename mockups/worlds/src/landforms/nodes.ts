// TSL node builders: Worley pores (fake depth + vertex push-in + breathing glow), arch dissolve, terrain colour.
import {
  atan, float, vec2, vec3, uniform, color, saturate, attribute, mix, smoothstep, step, sin, fract, max, clamp, texture,
  positionGeometry, normalGeometry, positionWorld, normalWorld, normalView, positionViewDirection,
  mx_fractal_noise_float,
} from 'three/tsl';
import type { TSLNode, WorldUniforms } from '../contracts';

export interface PoreOpts {
  tex1: any; tex2: any;   // baked pore textures (pores.ts)
  maxD: number;           // metres encoded in the displacement channel
  H: number; bury: number;
  dens: [number, number, number]; // per-layer density factors, same as used in the bake
  porousMul: number;      // 1 for porous heroes, <1 otherwise
  vertex: boolean;        // real push-in (reads the baked displacement)
  glow?: boolean;         // pores glow (default true)
  darken?: number;        // albedo multiplier (dark outcrops)
  warm?: boolean;         // tan sponge tint (crust lumps)
  capTop?: boolean;       // frosty white heads above 62-86% of H
}

/** Returns { tint, emissive, position } to hand to the world material factory. Two texture reads, no search loops. */
export function poreNodes(u: WorldUniforms, o: PoreOpts) {
  const p = positionGeometry;
  const uvN = vec2(atan(p.z, p.x).div(6.28318).add(0.5), p.y.add(o.bury).div(o.H + o.bury).clamp(0, 1));
  const s1 = texture(o.tex1, uvN), s2 = texture(o.tex2, uvN);
  const dens = clamp(u.pores.mul(o.porousMul), 0, 1);

  const layer = (dnRaw: TSLNode, t: TSLNode, k: number) => {
    const dn = dnRaw.mul(1.6);
    const exists = step(t, dens.mul(k));
    return {
      t,
      band: sin(dn.mul(15)).mul(0.5).add(0.5), // concentric carved banding on the inner wall
      inside: float(1).sub(smoothstep(0.8, 1.0, dn)).mul(exists),
      depth: float(1).sub(dn.mul(dn)).max(0).pow(0.8).mul(exists),
      rim: smoothstep(0.85, 1.05, dn).mul(float(1).sub(smoothstep(1.05, 1.55, dn))).mul(exists),
      halo: smoothstep(1.0, 1.08, dn).mul(float(1).sub(smoothstep(1.08, 1.5, dn))).mul(exists),
    };
  };
  const layers = [layer(s1.r, s1.g, o.dens[0]), layer(s1.b, s1.a, o.dens[1]), layer(s2.r, s2.g, o.dens[2])];

  let dark = float(0), lip = float(0), halo = float(0);
  for (const l of layers) {
    dark = max(dark, l.inside.mul(float(0.55).add(l.depth.mul(0.45))).mul(float(0.8).add(l.band.mul(0.2))));
    lip = max(lip, l.rim);
    halo = max(halo, l.halo);
  }
  const surface = float(1).add(lip.mul(0.2)).sub(halo.mul(0.28)).sub(s2.a.mul(0.4));
  // pull the factory's bone→stone gradient further toward the stain where age/heat have stained hard
  const boost = mix(vec3(1, 1, 1), u.stoneColor.div(vec3(0.925, 0.894, 0.839)), u.stainAmount.mul(0.75));
  const frost = float(1).add(u.snow.mul(0.4)).mul(o.darken ?? 1).mul(float(1).sub(u.snow.mul(float(0.45).mul(float(1).sub(smoothstep(2, 24, positionWorld.y))))));
  let body: TSLNode = boost.mul(surface).mul(frost);
  if (o.warm) body = body.mul(vec3(1.22, 1.08, 0.95));
  if (o.capTop) body = mix(body, vec3(1.7, 1.75, 1.8), smoothstep(0.62, 0.86, p.y.div(o.H)).mul(clamp(u.snow.mul(1.6), 0, 1)).mul(0.85));
  const tint = mix(body, u.shadowColor.mul(0.3), dark.mul(0.92));

  // emissive: glow seated in the deepest pores, each cell breathing on its own 4-9 s clock
  const gate = u.niches.poreDwellers.mul(float(0.5).add(u.glow.mul(0.5)));
  let glow = float(0), wall = float(0);
  layers.forEach((l, i) => {
    const period = mix(float(4), float(9), fract(l.t.mul(37.31)));
    const phase = fract(l.t.mul(91.7)).mul(6.2832);
    const breathe = float(0.62).add(sin(u.time.mul(6.2832).div(period).add(phase)).mul(0.38));
    const shape = float(0.04).add(l.depth.pow(1.3).mul(0.96)).mul(float(0.76).add(l.band.mul(0.24)));
    const lit = i < 2 ? float(1) : step(0.55, fract(l.t.mul(53.9))).mul(0.55);
    glow = max(glow, l.inside.mul(shape).mul(breathe).mul(lit).mul(i === 0 ? 1.2 : 1));
    wall = max(wall, l.depth);
  });
  const glowCol = mix(u.poreGlowColor.mul(vec3(0.8, 0.32, 0.22)), u.poreGlowColor.mul(vec3(1.0, 1.12, 1.0)), wall.pow(0.7));
  const emissive = glowCol.mul(glow.mul(gate).mul(o.glow === false ? 0 : 4.2));

  let position: TSLNode;
  if (o.vertex) {
    const d = texture(o.tex2, uvN).level(float(0)).b.sub(0.5).mul(2 * o.maxD);
    position = positionGeometry.add(normalGeometry.mul(d));
  }
  return { tint, emissive, position };
}

/** Arch: thinning + crumble driven by a CPU-written survival uniform (derived.arches remapped to 0..1). */
export function archNodes(u: WorldUniforms, survive: TSLNode, radiusM: number) {
  const crown = sin(attribute('aT', 'float').mul(3.14159));
  const n = mx_fractal_noise_float(positionGeometry.div(radiusM * 1.6), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  const d = n.mul(0.6).add(crown.mul(0.4));
  const opacity = step(0, survive.mul(1.15).sub(d));
  const thin = float(1).sub(survive).mul(radiusM * 0.55).mul(float(0.6).add(crown));
  const position = positionGeometry.sub(normalGeometry.mul(thin));
  const rim = float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(2.5);
  const streak = mx_fractal_noise_float(vec3(positionWorld.x.mul(0.5), positionWorld.y.mul(0.05), positionWorld.z.mul(0.5)), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  const line = smoothstep(0.7, 0.82, mx_fractal_noise_float(vec3(positionWorld.x.mul(1.6), positionWorld.y.mul(0.04), positionWorld.z.mul(1.6)), 2, 2.0, 0.5, 1.0).mul(0.5).add(0.5));
  const ice = mix(mix(color(0x3a73a0), color(0x9cc9e2), smoothstep(0.3, 0.7, streak)), color(0xf2fbff), line.mul(0.75));
  const tone = mix(u.stoneColor, ice, saturate(u.snow.mul(1.8)));
  return { opacity, position, rim, streak, tone: mix(tone, color(0xeaf5fb), rim.mul(0.55)) };
}

/** Terrain albedo from the ground uniform, with brush streaks, stone on slopes, and an acid-crust path split. */
export function terrainColor(u: WorldUniforms, crust: TSLNode, rock: TSLNode) {
  const aU = attribute('aU', 'float');
  const aC = attribute('aCrust', 'float');
  const wp = positionWorld;
  const stripe = mx_fractal_noise_float(vec3(wp.x.mul(0.22), wp.y.mul(0.3), wp.z.mul(0.03)), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  let base = u.ground.mul(mix(float(0.68), float(1.2), smoothstep(0.28, 0.72, stripe)));
  const hotness = smoothstep(0.6, 0.9, u.heat);
  const band = smoothstep(0.35, 0.65, mx_fractal_noise_float(vec3(wp.x.mul(0.05), wp.y.mul(0.2), wp.z.mul(0.35)), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5));
  base = mix(base, mix(color(0xd93a19), color(0xbf5f39), band), band.mul(0.55).mul(hotness));
  const slope = float(1).sub(normalWorld.y);
  base = mix(base, u.stoneColor.mul(0.92), smoothstep(0.28, 0.6, slope).mul(0.85).mul(rock));
  // acid world: pale path in the middle, darker rough crust outside
  const outside = smoothstep(0.35, 0.85, aU).mul(crust);
  base = mix(base, u.stoneColor.mul(float(0.62).add(aC.mul(0.5))), outside.mul(0.9));
  return base;
}

export const makeUniformF = (v: number) => uniform(v);
