// TSL node builders: Worley pores (fake depth + vertex push-in + breathing glow), arch dissolve, terrain colour.
import {
  Fn, If, float, vec3, vec4, uniform, attribute, mix, smoothstep, step, sin, fract, floor, dot, sqrt, max, clamp,
  positionGeometry, normalGeometry, positionWorld, normalWorld, normalView, positionViewDirection,
  mx_fractal_noise_float,
} from 'three/tsl';
import type { TSLNode, WorldUniforms } from '../contracts';

const hash13 = (c: TSLNode) => fract(sin(dot(c, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
const hash33 = (c: TSLNode) =>
  fract(sin(vec3(dot(c, vec3(127.1, 311.7, 74.7)), dot(c, vec3(269.5, 183.3, 246.1)), dot(c, vec3(113.5, 271.9, 124.6)))).mul(43758.5453));

/** 3D Worley with cell id: returns vec4(F1, cell.xyz). */
const worley = Fn(([p]: TSLNode[]) => {
  const ip = floor(p), fp = fract(p);
  const f1 = float(9).toVar();
  const cid = vec3(0).toVar();
  for (let z = -1; z <= 1; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    const o = vec3(x, y, z);
    const c = ip.add(o);
    const d = o.add(hash33(c).mul(0.85).add(0.075)).sub(fp);
    const dd = dot(d, d);
    If(dd.lessThan(f1), () => { f1.assign(dd); cid.assign(c); });
  }
  return vec4(sqrt(f1), cid);
});

interface Layer { inside: TSLNode; depth: TSLNode; rim: TSLNode; cid: TSLNode; metres: TSLNode }

function poreLayer(q: TSLNode, size: TSLNode, dens: TSLNode, rLo: number, rHi: number, off: number): Layer {
  const w = worley(q.div(size).add(off));
  const cid = w.yzw;
  const exists = step(hash13(cid), dens);
  const rad = mix(float(rLo), float(rHi), hash13(cid.add(vec3(17.3, 3.1, 9.7))));
  const dn = w.x.div(rad);
  return {
    inside: float(1).sub(smoothstep(0.8, 1.0, dn)).mul(exists),
    depth: float(1).sub(dn.mul(dn)).max(0).mul(exists),
    rim: smoothstep(0.78, 1.0, dn).mul(float(1).sub(smoothstep(1.0, 1.35, dn))).mul(exists),
    cid,
    metres: rad.mul(size),
  };
}

export interface PoreOpts {
  scale: TSLNode;      // uniform: spire radius / 14
  porousMul: number;   // 1 for porous heroes, <1 otherwise
  vertex: boolean;     // real push-in
  fine: boolean;       // add the small-pore layer
  fineSize?: number;   // metres per cell of the small layer
  glow?: boolean;      // pores glow (default true)
}

/** Returns { tint, emissive, position } to hand to the world material factory. */
export function poreNodes(u: WorldUniforms, o: PoreOpts) {
  const q = positionGeometry;
  const dens = clamp(u.pores.mul(o.porousMul), 0, 1);
  const A = poreLayer(q, o.scale.mul(18), dens.mul(0.7), 0.22, 0.36, 0);
  const B = poreLayer(q, o.scale.mul(5), dens.mul(0.8), 0.22, 0.38, 11.3);
  const layers: Layer[] = [A, B];
  if (o.fine) layers.push(poreLayer(q, o.scale.mul(o.fineSize ?? 1.8), dens, 0.2, 0.38, 27.1));

  // albedo: dark inside, slight lip, warty speckle
  let dark = float(0), lip = float(0);
  for (const l of layers) { dark = max(dark, l.inside.mul(float(0.55).add(l.depth.mul(0.45)))); lip = max(lip, l.rim); }
  const speck = mx_fractal_noise_float(q.div(o.scale.mul(0.9)), 3, 2.0, 0.5, 1.0);
  const tint = mix(vec3(1, 1, 1).mul(float(1).add(lip.mul(0.07)).sub(speck.abs().mul(0.14))), u.shadowColor.mul(0.3), dark.mul(0.92));

  // emissive: orange glow seated in the deepest pores, each cell breathing on its own 4-9s clock
  const gate = u.niches.poreDwellers.mul(float(0.5).add(u.glow.mul(0.5)));
  let glow = float(0);
  layers.forEach((l, i) => {
    const period = mix(float(4), float(9), hash13(l.cid.add(vec3(5.1, 8.3, 2.7))));
    const phase = hash13(l.cid.add(vec3(1.9, 4.4, 7.7))).mul(6.2832);
    const breathe = float(0.62).add(sin(u.time.mul(6.2832).div(period).add(phase)).mul(0.38));
    const shape = float(0.18).add(l.depth.pow(0.8).mul(0.82));
    const lit = i < 2 ? 1 : step(0.55, hash13(l.cid.add(vec3(3.3, 6.6, 9.9)))).mul(0.55);
    glow = max(glow, l.inside.mul(shape).mul(breathe).mul(lit));
  });
  const emissive = u.poreGlowColor.mul(glow.mul(gate).mul(o.glow === false ? 0 : 4.2));

  let position: TSLNode;
  if (o.vertex) {
    const push = A.depth.pow(0.7).mul(A.metres).add(B.depth.pow(0.7).mul(B.metres)).mul(0.75);
    const bump = A.rim.mul(A.metres).add(B.rim.mul(B.metres)).mul(0.12);
    position = positionGeometry.add(normalGeometry.mul(bump.sub(push)));
  }
  return { tint, emissive, position };
}

/** Arch: thinning + crumble driven by a CPU-written survival uniform (derived.arches remapped to 0..1). */
export function archNodes(survive: TSLNode, radiusM: number) {
  const crown = sin(attribute('aT', 'float').mul(3.14159));
  const n = mx_fractal_noise_float(positionGeometry.div(radiusM * 1.6), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  const d = n.mul(0.6).add(crown.mul(0.4));
  const opacity = step(0, survive.mul(1.15).sub(d));
  const thin = float(1).sub(survive).mul(radiusM * 0.55).mul(float(0.6).add(crown));
  const position = positionGeometry.sub(normalGeometry.mul(thin));
  const rim = float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(2.5);
  const streak = mx_fractal_noise_float(vec3(positionWorld.x.mul(0.5), positionWorld.y.mul(0.05), positionWorld.z.mul(0.5)), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  return { opacity, position, rim, streak };
}

/** Terrain albedo from the ground uniform, with brush streaks, stone on slopes, and an acid-crust path split. */
export function terrainColor(u: WorldUniforms, crust: TSLNode) {
  const aU = attribute('aU', 'float');
  const aC = attribute('aCrust', 'float');
  const wp = positionWorld;
  const stripe = mx_fractal_noise_float(vec3(wp.x.mul(0.22), wp.y.mul(0.7), wp.z.mul(0.03)), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  let base = u.ground.mul(float(0.82).add(stripe.mul(0.36)));
  const slope = float(1).sub(normalWorld.y);
  base = mix(base, u.stoneColor.mul(0.92), smoothstep(0.28, 0.6, slope).mul(0.85));
  // acid world: pale path in the middle, darker rough crust outside
  const outside = smoothstep(0.35, 0.85, aU).mul(crust);
  base = mix(base, u.stoneColor.mul(float(0.62).add(aC.mul(0.5))), outside.mul(0.9));
  return base;
}

export const makeUniformF = (v: number) => uniform(v);
