// Shared TSL pieces for flora: instance attributes, niche gate, sway.
import {
  attribute, float, vec3, sin, cos, smoothstep, positionGeometry, positionLocal, mix, saturate, dot, luminance,
} from 'three/tsl';
import type { SpeciesId, WorldContext } from '../contracts';

/** Per-instance attributes (see build.ts): aRand 0..1, aBase world xyz at the ground, aPar = (scale, yaw, phase), aAux per vertex. */
export const aRand = () => attribute('aRand', 'float');
export const aBase = () => attribute('aBase', 'vec3');
export const aPar = () => attribute('aPar', 'vec3');
export const aAux = () => attribute('aAux', 'vec4');

/** Emergence: instance is visible when aRand < niche; scale eases in over a smoothstep band. */
export function gateNode(ctx: WorldContext, id: SpeciesId): any {
  return smoothstep(0, 1, saturate(ctx.uniforms.niches[id].mul(1.1).sub(aRand()).mul(10)));
}

export interface PosOpts {
  /** Local-space (unit-frame) delta added to each vertex, scaled by instance scale and yawed. */
  deform?: (g: any, aux: any) => any;
  /** Sway: metres of tip displacement per metre of height. Zero = stiff. */
  sway?: number;
  swayHz?: number;
  swayPow?: number;   // height falloff exponent (higher = base stays put)
  swayAxisY?: number; // vertical coordinate used as height (default geometry y)
  /** Extra y-stretch multiplier node about the base (e.g. stalkHeight). */
  stretchY?: any;
  /** Gentle breathing scale (fraction), per instance phase. */
  breathe?: number;
}

/** positionNode for an instanced species. NB: runs AFTER instancing, so positionLocal is already world space. */
export function floraPosition(ctx: WorldContext, id: SpeciesId, o: PosOpts = {}): any {
  const { time, wind } = ctx.uniforms;
  const base = aBase(), par = aPar();
  const scale = par.x, yaw = par.y, phase = par.z;
  const g = positionGeometry;
  const gate = gateNode(ctx, id);
  let p = positionLocal;
  if (o.deform) {
    const d = o.deform(g, aAux());
    const c = cos(yaw), s = sin(yaw);
    p = p.add(vec3(c.mul(d.x).add(s.mul(d.z)), d.y, c.mul(d.z).sub(s.mul(d.x))).mul(scale));
  }
  if (o.stretchY) p = vec3(p.x, base.y.add(p.y.sub(base.y).mul(o.stretchY)), p.z);
  if (o.breathe) {
    const b = float(1).add(sin(time.mul(0.9).add(phase.mul(6.283))).mul(o.breathe));
    p = base.add(p.sub(base).mul(vec3(b, 1, b)));
  }
  p = base.add(p.sub(base).mul(gate));
  if (o.sway) {
    const h = saturate(g.y).pow(o.swayPow ?? 2);
    const t = time.mul(o.swayHz ?? 0.35).add(phase.mul(6.283));
    const amp = scale.mul(o.sway).mul(h).mul(wind.mul(0.7).add(0.3)).mul(gate);
    const sx = sin(t).add(sin(t.mul(2.3).add(1.7)).mul(0.35));
    const sz = cos(t.mul(0.83).add(0.6)).add(sin(t.mul(1.9).add(4.1)).mul(0.3));
    p = p.add(vec3(sx.mul(amp), 0, sz.mul(amp).mul(0.8)));
  }
  return p;
}

/** Saturation boost so washed-out derived glow hues still read as bold colour. */
export const boost = (c: any, k = 2.2) => { const l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(l), c, k).max(0); };
export { luminance };
