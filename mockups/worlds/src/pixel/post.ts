// Pixel RenderPipeline: low-res scene pass (colour + emissive MRT) → stepped depth bands toward the horizon colour
// → emissive unlit + 1/2 px pixel halo → palette lock (nearest of ≤32 scene colours). No AA, bloom, grain, or DOF.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive, float, vec2, vec3, vec4, max, min, mix, pow, dot, screenSize, screenUV, uniform } from 'three/tsl';
import type { PixelState } from './state';
import { DEPTH_EDGES, DEPTH_MIX, HALO_HDR2, LAB_W, SURFACE_GAIN } from './palette';

const SKY_Z = 3500; // view distances beyond this are background (far plane is 4000)

export function createPixelPost(renderer: any, scene: any, camera: any, st: PixelState) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const colorTex = scenePass.getTextureNode('output');
  const emTex = scenePass.getTextureNode('emissive');
  const dist = scenePass.getViewZNode().negate();

  const glowThr = uniform(1.0); // emissive peak above this (HDR) reads as a lit pixel; below is surface colour
  const texel = vec2(1).div(screenSize);
  const peak = (c: any) => max(max(c.r, c.g), c.b);
  const lum = (c: any) => dot(c, vec3(0.2126, 0.7152, 0.0722));

  // ---- stepped depth bands (per pixel) toward the field's horizon colour (= sky horizon band)
  const mixAmt = dist.lessThan(DEPTH_EDGES[0]).select(float(DEPTH_MIX[0]),
    dist.lessThan(DEPTH_EDGES[1]).select(float(DEPTH_MIX[1]),
      dist.lessThan(DEPTH_EDGES[2]).select(float(DEPTH_MIX[2]), float(DEPTH_MIX[3]))));
  const isSky = dist.greaterThan(SKY_Z);
  let col: any = mix(colorTex.rgb.mul(isSky.select(float(1), float(SURFACE_GAIN))), st.sky[3], isSky.select(float(0), mixAmt));

  // ---- emissive pixels: unlit, hue at full brightness
  const e0 = emTex.rgb;
  const p0 = peak(e0);
  const isEm = p0.greaterThan(glowThr);
  col = isEm.select(e0.div(max(p0, 1e-4)).mul(0.95), col);

  // ---- pixel halo: 1 px ring around any glow pixel, 2 px around HDR > 2; only over darker pixels
  let ring1: any = vec3(0), ring2: any = vec3(0);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (dx === 0 && dy === 0) continue;
    const cheb = Math.max(Math.abs(dx), Math.abs(dy));
    if (cheb === 2 && Math.abs(dx) === 2 && Math.abs(dy) === 2) continue; // round the corners
    const e = emTex.sample(screenUV.add(vec2(dx, dy).mul(texel))).rgb;
    const p = peak(e);
    const hue = e.div(max(p, 1e-4));
    if (cheb === 1) ring1 = p.greaterThan(glowThr).select(hue, ring1);
    else ring2 = p.greaterThan(HALO_HDR2).select(hue, ring2);
  }
  const c1 = ring1.mul(0.6), c2 = ring2.mul(0.3);
  const has1 = peak(ring1).greaterThan(0), has2 = peak(ring2).greaterThan(0);
  const ringCol = has1.select(c1, c2);
  const drawRing = isEm.not().and(has1.or(has2)).and(lum(col).lessThan(lum(ringCol)));
  col = drawRing.select(ringCol, col);

  // ---- palette lock: nearest scene-palette colour in Oklab
  const c = max(col, 0);
  const l_ = pow(max(dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)), 1e-9), 1 / 3);
  const m_ = pow(max(dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)), 1e-9), 1 / 3);
  const s_ = pow(max(dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)), 1e-9), 1 / 3);
  const lab = vec3(
    l_.mul(0.2104542553).add(m_.mul(0.793617785)).sub(s_.mul(0.0040720468)),
    l_.mul(1.9779984951).sub(m_.mul(2.428592205)).add(s_.mul(0.4505937099)),
    l_.mul(0.0259040371).add(m_.mul(0.7827717662)).sub(s_.mul(0.808675766)),
  );
  const w = vec3(...LAB_W);
  let best: any = vec3(st.palette[0]), bestD: any = float(1e9);
  st.palette.forEach((p: any, i: number) => {
    const pl = st.paletteLab[i];
    const diff = lab.sub(pl.xyz);
    const d = dot(diff.mul(diff), w).add(pl.w);
    best = d.lessThan(bestD).select(p, best);
    bestD = min(d, bestD);
  });
  pipeline.outputNode = vec4(best, 1.0);

  return {
    pipeline,
    setPalette(_lum: number) { /* palette comes from the sea ramps, not the pin-calibrated sky */ },
    setGrainTime(_t: number) { /* no grain in pixel mode */ },
    render() { pipeline.render(); },
  };
}
