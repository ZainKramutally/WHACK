// Underwater materials for the aquatic lab (lab-only; the app ports the shading into src/render/material.ts, see
// docs/features/aquatic-life.md). Four shared materials in total (opaque/translucent × vertex-coloured/instanced), plus
// the water background and the tank floor. Shading: cel terminator → coloured shadow (toward the water's shadow) →
// caustics on up-facing lit surfaces → back-scatter rim (silhouettes read on dark water) → HDR cyan glow (blooms) →
// depth fog toward the water colour at that height. Translucent: fresnel alpha (edges dense, centres see-through).
import * as THREE from 'three/webgpu';
import {
  Fn, attribute, float, vec2, vec3, vec4, mix, max, abs, dot, exp, floor, clamp, smoothstep, normalWorld, positionWorld,
  cameraPosition, frontFacing, If, uniform, mx_worley_noise_vec2, mx_noise_float, positionWorldDirection, normalize, atan, sin,
} from 'three/tsl';
import { PALETTE } from '../../contracts';
import { PIXEL, bayer4 } from '../../material';
import { WATERS, type WaterKind } from './palette';

const col = (hex: number) => new THREE.Color(hex);
export const W = {
  lightDir: uniform(new THREE.Vector3(0.32, 0.88, 0.34).normalize()),
  sun: uniform(col(0xffffff)),
  shadowTint: uniform(col(PALETTE.shadow)),
  shadowMix: uniform(0.62),
  shadowGain: uniform(0.72),
  rim: uniform(0.42),
  rimColor: uniform(col(PALETTE.blush)),
  deep: uniform(col(WATERS.carbon.deep)),
  mid: uniform(col(WATERS.carbon.mid)),
  surface: uniform(col(WATERS.carbon.surface)),
  surfaceY: uniform(14),
  floorY: uniform(-6),
  fogStart: uniform(4),
  fogDist: uniform(34),
  caustic: uniform(0.5),
  time: uniform(0),
  glowK: uniform(2.1),
  glowColor: uniform(col(PALETTE.glow)),
};

/** Point the shared uniforms at one water (carbon: dark violet-oxblood; nitrogen: pale clear ice-lilac). */
export function setWater(kind: WaterKind) {
  const w = WATERS[kind];
  W.deep.value.setHex(w.deep); W.mid.value.setHex(w.mid); W.surface.value.setHex(w.surface);
  W.shadowTint.value.setHex(w.shadow); W.rimColor.value.setHex(w.rim); W.sun.value.setHex(w.sun);
  W.fogStart.value = w.fogStart; W.fogDist.value = w.fogDist; W.caustic.value = w.caustic;
  W.rim.value = kind === 'carbon' ? 0.4 : 0.3; // nitrogen: an indigo rim (pale water needs dark silhouettes)
  W.shadowMix.value = kind === 'carbon' ? 0.62 : 0.5;
}

/** Water colour seen along view direction d (unit): deep below → mid at the horizon → bright surface above. The
 *  background and the fog share it, so far objects dissolve into exactly the water behind them. */
const waterDir = (y: any) => {
  const c = mix(vec3(W.deep), vec3(W.mid), smoothstep(-0.75, 0.05, y));
  return mix(c, vec3(W.surface), smoothstep(0.08, 0.95, y).pow(1.4));
};

/** Animated caustic lines (two Worley layers' cell borders), 0..1. */
export const caustic = (p: any) => {
  const t = W.time;
  const w1 = mx_worley_noise_vec2(vec3(p.x.mul(0.42), p.z.mul(0.42).add(p.y.mul(0.08)), t.mul(0.33)));
  const w2 = mx_worley_noise_vec2(vec3(p.x.mul(0.77).add(3.1), p.z.mul(0.77), t.mul(0.47)));
  const l1 = float(1).sub(smoothstep(0.0, 0.14, w1.y.sub(w1.x)));
  const l2 = float(1).sub(smoothstep(0.0, 0.1, w2.y.sub(w2.x)));
  return max(l1, l2.mul(0.6));
};

export interface AquaMatOpts { instanced?: boolean; translucent?: boolean; colorNode?: any; causticGain?: number; glow?: boolean }

export function aquaMaterial(o: AquaMatOpts = {}): any {
  const m = new THREE.MeshLambertNodeMaterial();
  m.side = THREE.DoubleSide;
  if (o.translucent) { m.transparent = true; m.depthWrite = false; }
  const base = o.colorNode ?? (o.instanced ? mix(attribute('iColA', 'vec3'), attribute('iColB', 'vec3'), attribute('aBand', 'float')) : attribute('color', 'vec3'));
  const glowW = o.glow === false ? float(0) : attribute('aGlow', 'float');
  m.outputNode = Fn(() => {
    const b = vec3(base).toVar();
    const N = normalWorld.toVar();
    If(frontFacing.not(), () => { N.mulAssign(-1); });
    const P = positionWorld;
    const ndl = dot(N, W.lightDir);
    const lit = smoothstep(-0.15, 0.45, ndl).toVar();
    if (PIXEL) lit.assign(floor(lit.mul(2).add(0.5)).div(2));
    const att = mix(0.55, 1.0, smoothstep(W.floorY, W.surfaceY, P.y));
    const c = caustic(P).toVar();
    if (PIXEL) c.assign(floor(c.mul(3).add(0.3)).div(3));
    const cTerm = c.mul(clamp(N.y, 0, 1)).mul(W.caustic).mul(lit).mul(o.causticGain ?? 1);
    const litCol = b.mul(W.sun).mul(att).mul(cTerm.add(1));
    const shadowCol = mix(b, vec3(W.shadowTint), W.shadowMix).mul(W.shadowGain).mul(att);
    const out = mix(shadowCol, litCol, lit).toVar();
    const V = cameraPosition.sub(P).normalize();
    const fres = float(1).sub(abs(dot(N, V))).pow(3).toVar();
    if (PIXEL) fres.assign(floor(fres.mul(3).add(0.5)).div(3));
    out.assign(mix(out, vec3(W.rimColor), fres.mul(W.rim)));
    const g = vec3(W.glowColor);
    const hdr = g.div(dot(g, vec3(0.2126, 0.7152, 0.0722))).mul(W.glowK);
    const gw = clamp(glowW, 0, 1);
    out.assign(mix(out, hdr, gw));
    const dist = P.sub(cameraPosition).length();
    const f = clamp(float(1).sub(exp(max(dist.sub(W.fogStart), 0).div(W.fogDist).negate())), 0, 1).toVar();
    if (PIXEL) f.assign(floor(f.mul(16).add(0.5)).div(16));
    out.assign(mix(out, waterDir(P.sub(cameraPosition).normalize().y), f.mul(float(1).sub(gw.mul(0.6)))));
    const a = o.translucent ? max(mix(0.36, 0.94, fres), gw).mul(float(1).sub(f.mul(0.5))) : float(1);
    return vec4(out, a);
  })();
  return m;
}

/** Background: water gradient by view direction (deep below, bright surface above) with slow light shafts. */
export function waterBackground(): any {
  return Fn(() => {
    const d = normalize(positionWorldDirection);
    let y: any = d.y;
    if (PIXEL) y = floor(y.mul(18).add(bayer4())).div(18);
    const c = waterDir(y).toVar();
    const a = atan(d.x, d.z);
    const n = mx_noise_float(vec2(a.mul(5), W.time.mul(0.05))).add(mx_noise_float(vec2(a.mul(13).add(2), W.time.mul(0.08))).mul(0.5));
    let shaft: any = smoothstep(0.25, 0.65, n).mul(smoothstep(-0.25, 0.55, d.y)).mul(float(1).sub(smoothstep(0.8, 1, d.y))).mul(0.32);
    if (PIXEL) shaft = floor(shaft.mul(6).add(bayer4().mul(0.8))).div(6);
    c.assign(mix(c, vec3(W.surface), shaft));
    return c;
  })();
}

/** Tank floor: sand ripples between two floor tones (water preset), caustics strongest here. */
export function floorMaterial(floorHex: number, lightHex: number): any {
  const a = new THREE.Color(floorHex), b = new THREE.Color(lightHex);
  const colorNode = Fn(() => {
    const p = positionWorld.xz;
    const n = mx_noise_float(p.mul(0.12));
    const rip = sin(p.x.mul(1.3).add(p.y.mul(0.4)).add(n.mul(5)));
    const m = smoothstep(0.35, 0.95, rip).mul(0.55).add(smoothstep(0.2, 0.7, mx_noise_float(p.mul(0.05))).mul(0.35));
    return mix(vec3(a.r, a.g, a.b), vec3(b.r, b.g, b.b), m);
  })();
  return aquaMaterial({ colorNode, causticGain: 1.3, glow: false });
}
