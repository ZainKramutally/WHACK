// RenderPipeline. Pixel: scene renders at ~360 px internal height, nearest upscale, 1 internal-px ink outline from depth
// discontinuities (strong in fg/mg, fading by ~3 km), bloom threshold 1 for HDR emissives only. In pixel mode the bloom
// runs at internal resolution with 2 mips and is sampled at internal pixel centres and quantised into steps, so glows read
// as crisp cores with a 1-2 px stepped halo instead of soft discs.
import * as THREE from 'three/webgpu';
import { Fn, pass, vec2, vec3, vec4, screenUV, screenSize, perspectiveDepthToViewZ, cameraNear, cameraFar, smoothstep, max, mix, float, uniform, floor } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { PALETTE } from './contracts';
import { PIXEL } from './material';

export const INTERNAL_H = 360;

export function createPost(renderer: any, scene: any, camera: any) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const depth = scenePass.getTextureNode('depth');
  const rt = scenePass.renderTarget;
  if (PIXEL) for (const t of [rt.texture, rt.depthTexture]) if (t) t.minFilter = t.magFilter = THREE.NearestFilter;

  const k = uniform(3); // canvas px per internal px
  const texel = vec2(k).div(screenSize);
  const b = PIXEL ? bloom(color, 0.9, 0.05, 1.0) : bloom(color, 0.55, 0.35, 1.0);
  if (PIXEL) b._nMips = 2;
  const bloomTex = b.getTextureNode();
  const z = (uv: any) => perspectiveDepthToViewZ(depth.sample(uv).r, cameraNear, cameraFar).negate();

  pipeline.outputNode = Fn(() => {
    const c = color.sample(screenUV).rgb.toVar();
    if (!PIXEL) return vec4(c.add(bloomTex.sample(screenUV).rgb), 1);
    // ink outline on the near side of silhouettes
    const zc = z(screenUV);
    let edge: any = float(0);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const zn = z(screenUV.add(vec2(dx, dy).mul(texel)));
      edge = max(edge, zn.greaterThan(zc.mul(1.05).add(0.4)).select(float(1), float(0)));
    }
    const fade = float(1).sub(smoothstep(900, 3200, zc));
    const ink = new THREE.Color(PALETTE.ink);
    c.assign(mix(c, vec3(ink.r, ink.g, ink.b), edge.mul(fade)));
    // stepped pixel bloom: sample at the internal pixel centre, quantise magnitude to quarter steps
    const isz = screenSize.div(k);
    const snap = floor(screenUV.mul(isz)).add(0.5).div(isz);
    const bl = bloomTex.sample(snap).rgb;
    const mag = max(bl.r, max(bl.g, bl.b));
    const q = floor(mag.mul(4).add(0.15)).div(4);
    return vec4(c.add(bl.mul(q.div(mag.max(1e-4)))), 1);
  })();

  function resize(h: number) {
    if (!PIXEL) return;
    const kk = Math.max(1, Math.round(h / INTERNAL_H));
    k.value = kk;
    scenePass.setResolutionScale(1 / kk + 1e-6);
    b.setResolutionScale(1 / kk);
  }
  return { pipeline, resize, render: () => pipeline.render() };
}
