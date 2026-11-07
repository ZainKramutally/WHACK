// RenderPipeline. Pixel: scene renders at ~360 px internal height, nearest upscale, 1 px ink outline from depth
// discontinuities (fades out in the background so far planes stay soft), bloom threshold 1 for HDR emissives only.
import * as THREE from 'three/webgpu';
import { Fn, pass, vec2, vec3, vec4, screenUV, screenSize, perspectiveDepthToViewZ, cameraNear, cameraFar, smoothstep, max, mix, float, uniform } from 'three/tsl';
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
  const z = (uv: any) => perspectiveDepthToViewZ(depth.sample(uv).r, cameraNear, cameraFar).negate();
  const b = bloom(color, 0.55, 0.35, 1.0);
  pipeline.outputNode = Fn(() => {
  const c = color.sample(screenUV).rgb.toVar();
  if (PIXEL) {
    const zc = z(screenUV);
    let edge: any = float(0);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const zn = z(screenUV.add(vec2(dx, dy).mul(texel)));
      edge = max(edge, zn.greaterThan(zc.mul(1.07).add(0.6)).select(float(1), float(0)));
    }
    const fade = float(1).sub(smoothstep(220, 1500, zc));
    const ink = new THREE.Color(PALETTE.ink);
    c.assign(mix(c, vec3(ink.r, ink.g, ink.b), edge.mul(fade).mul(0.92)));
  }
  return vec4(c.add(b.rgb), 1);
  })();

  function resize(h: number) {
    if (!PIXEL) return;
    const kk = Math.max(1, Math.round(h / INTERNAL_H));
    k.value = kk;
    scenePass.setResolutionScale(1 / kk + 1e-6);
  }
  return { pipeline, resize, render: () => pipeline.render() };
}
