// Pixel RenderPipeline: low-res scene pass (colour + emissive MRT) → stepped depth bands toward the sky-horizon colour
// → emissive unlit + pixel halo / pore rim → palette lock (nearest of ≤32 scene colours) → despeckle.
// No AA, bloom, grain, or DOF.
import * as THREE from 'three/webgpu';
import {
  pass, mrt, output, emissive, float, vec2, vec3, vec4, max, min, mix, pow, dot, abs, smoothstep, screenSize, screenUV, uniform,
  convertToTexture, getViewPosition, cameraWorldMatrix, cameraProjectionMatrixInverse,
} from 'three/tsl';
import type { PixelState } from './state';
import {
  CHROMA_FADE, CHROMA_GAIN, SKY_ONLY_BIAS, DEPTH_EDGES, DEPTH_MIX, EMISSIVE_CARBON_BIAS, HALO_HDR2, LAB_W, STAIN_HIGH_BIAS, STAIN_HIGH_Y, SURFACE_GAIN,
} from './palette';

const SKY_Z = 3500; // view distances beyond this are background (far plane is 4000)

export function createPixelPost(renderer: any, scene: any, camera: any, st: PixelState) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const colorTex = scenePass.getTextureNode('output');
  const emTex = scenePass.getTextureNode('emissive');
  const depthTex = scenePass.getTextureNode('depth');
  const dist = scenePass.getViewZNode().negate();

  const glowThr = uniform(1.0); // emissive peak above this (HDR) reads as a lit pixel; below is surface colour
  const texel = vec2(1).div(screenSize);
  const peak = (c: any) => max(max(c.r, c.g), c.b);
  const lum = (c: any) => dot(c, vec3(0.2126, 0.7152, 0.0722));

  // ---- stepped depth bands (per pixel) toward the sky-horizon colour
  const mixAmt = dist.lessThan(DEPTH_EDGES[0]).select(float(DEPTH_MIX[0]),
    dist.lessThan(DEPTH_EDGES[1]).select(float(DEPTH_MIX[1]),
      dist.lessThan(DEPTH_EDGES[2]).select(float(DEPTH_MIX[2]), float(DEPTH_MIX[3])))).mul(st.hazeK);
  const isSky = dist.greaterThan(SKY_Z);
  // near-black silhouettes (eco-01's ink figures) keep their ink at any distance
  const inkKeep = smoothstep(0.004, 0.04, lum(colorTex.rgb));
  let col: any = mix(colorTex.rgb.mul(isSky.select(float(1), float(SURFACE_GAIN))), st.sky[3], isSky.select(float(0), mixAmt.mul(inkKeep)));

  // ---- emissive pixels: unlit, hue at full brightness
  const e0 = emTex.rgb;
  const p0 = peak(e0);
  const isEm = p0.greaterThan(glowThr);
  const eHue = e0.div(max(p0, 1e-4));
  const pale = smoothstep(0.0, 0.3, eHue.b.sub(eHue.r)).mul(0.45); // cool glows read pale cyan-lilac, warm ones stay saturated
  col = isEm.select(mix(eHue, vec3(1), pale).mul(0.95), col);

  // ---- pixel halo. Normal glow: 1 px ring, only over darker pixels. HDR > 2 (pores, flashes): the glow sits in a dark rim:
  //      1 px mid-hue ring (always) then a 1 px step-0 rim (always), so it stays readable on pale bone.
  let ring1: any = vec3(0), hot1: any = float(0), hot2: any = float(0);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (dx === 0 && dy === 0) continue;
    const cheb = Math.max(Math.abs(dx), Math.abs(dy));
    if (cheb === 2 && Math.abs(dx) === 2 && Math.abs(dy) === 2) continue; // round the corners
    const e = emTex.sample(screenUV.add(vec2(dx, dy).mul(texel))).rgb;
    const p = peak(e);
    if (cheb === 1) {
      ring1 = p.greaterThan(glowThr).select(e.div(max(p, 1e-4)), ring1);
      hot1 = p.greaterThan(HALO_HDR2).select(float(1), hot1);
    } else hot2 = p.greaterThan(HALO_HDR2).select(float(1), hot2);
  }
  const mid = ring1.mul(0.6);
  const has1 = peak(ring1).greaterThan(0);
  const notEm = isEm.not();
  const softRing = notEm.and(has1).and(hot1.lessThan(0.5)).and(lum(col).lessThan(lum(mid)));
  const hotRing = notEm.and(hot1.greaterThan(0.5));
  const rim = notEm.and(hot1.lessThan(0.5)).and(hot2.greaterThan(0.5));
  const exempt = isEm.or(softRing).or(hotRing).or(rim);
  col = softRing.or(hotRing).select(mid, col);
  col = rim.select(st.field[0], col);

  // ---- world height (for stone: bone on high/young, stain low) from depth + camera matrices
  const dep = depthTex.sample(screenUV).r;
  const worldY = cameraWorldMatrix.mul(vec4(getViewPosition(screenUV, dep, cameraProjectionMatrixInverse), 1)).y;
  const highK = smoothstep(STAIN_HIGH_Y[0], STAIN_HIGH_Y[1], worldY).mul(st.stainK);

  // ---- palette lock: nearest scene-palette colour in Oklab (+ per-entry biases)
  const c = max(col, 0);
  const l_ = pow(max(dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)), 1e-9), 1 / 3);
  const m_ = pow(max(dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)), 1e-9), 1 / 3);
  const s_ = pow(max(dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)), 1e-9), 1 / 3);
  const L = l_.mul(0.2104542553).add(m_.mul(0.793617785)).sub(s_.mul(0.0040720468));
  const gain = isSky.or(isEm).select(float(1), mix(float(CHROMA_GAIN), float(1), smoothstep(CHROMA_FADE[0], CHROMA_FADE[1], L)));
  const lab = vec3(
    L,
    l_.mul(1.9779984951).sub(m_.mul(2.428592205)).add(s_.mul(0.4505937099)).mul(gain),
    l_.mul(0.0259040371).add(m_.mul(0.7827717662)).sub(s_.mul(0.808675766)).mul(gain),
  );
  const w = vec3(...LAB_W);
  const emF = isEm.select(float(1), float(0));
  let best: any = vec3(st.palette[0]), bestD: any = float(1e9);
  st.palette.forEach((p: any, i: number) => {
    const pl = st.paletteLab[i];
    const kind = st.paletteKind[i];
    const diff = lab.sub(pl.xyz);
    const extra = kind.mod(2).greaterThan(0.5).select(emF.mul(EMISSIVE_CARBON_BIAS), float(0))
      .add(abs(kind.sub(2)).lessThan(0.5).select(highK.mul(STAIN_HIGH_BIAS), float(0)))
      .add(abs(kind.sub(4)).lessThan(0.5).select(isSky.select(float(0), float(SKY_ONLY_BIAS)), float(0)));
    const d = dot(diff.mul(diff), w).add(pl.w).add(extra);
    best = d.lessThan(bestD).select(p, best);
    bestD = min(d, bestD);
  });

  // ---- despeckle: a non-exempt pixel with ≤2 same-colour neighbours (of 8) while ≥4 neighbours agree on another colour takes the most common colour of its non-exempt neighbours.
  //      Lines ≥ 2 px long (stalks, eyes) keep their body; glow / halo pixels never change and never vote.
  const locked = convertToTexture(vec4(best, exempt.select(float(1), float(0))));
  const ctr = locked.sample(screenUV);
  const nb: any[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    nb.push(locked.sample(screenUV.add(vec2(dx, dy).mul(texel))));
  }
  const eq = (a: any, b: any) => dot(abs(a.rgb.sub(b.rgb)), vec3(1)).lessThan(0.004);
  const valid = nb.map((n) => n.a.lessThan(0.5));
  const cnt = nb.map((n, i) => nb.reduce((acc: any, m: any, j: number) => (i === j ? acc : acc.add(eq(n, m).and(valid[j]).select(float(1), float(0)))), float(0)).mul(valid[i].select(float(1), float(0))));
  let pick: any = ctr.rgb, pickN: any = float(-1);
  nb.forEach((n, i) => { const better = cnt[i].greaterThan(pickN); pick = better.select(n.rgb, pick); pickN = better.select(cnt[i], pickN); });
  const same = nb.reduce((acc: any, n: any) => acc.add(eq(n, ctr).select(float(1), float(0))), float(0));
  const speckle = ctr.a.lessThan(0.5).and(same.lessThan(2.5)).and(pickN.greaterThan(3.5));
  pipeline.outputNode = vec4(speckle.select(pick, ctr.rgb), 1.0);

  return {
    pipeline,
    setPalette(_lum: number) { /* palette comes from the sea ramps, not the pin-calibrated sky */ },
    setGrainTime(_t: number) { /* no grain in pixel mode */ },
    render() { pipeline.render(); },
  };
}
