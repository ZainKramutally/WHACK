// The one pixel post pass (art layer, owner ruling 2026-11-07). Ported from mockups/red-world/src/post.ts.
// Pixel (default): the scene renders at ~360 px internal height and is upscaled nearest-neighbour; a 1 internal-px ink
// outline marks depth discontinuities (near side of silhouettes), fading out with distance relative to the 400 m patch
// and 1000 m far plane; bloom (threshold 1, HDR emissives only) runs at internal resolution with 2 mips, sampled at
// internal pixel centres and quantised to quarter steps, so glows read as crisp cores with a stepped 1-2 px halo.
// Smooth (?style=smooth): full resolution, no outline, soft bloom.
// The inspect card's live view is NOT drawn here: the app draws its overlays after `render()`, straight to the canvas.
import * as THREE from 'three/webgpu';
import { Fn, pass, vec2, vec3, vec4, screenUV, screenSize, perspectiveDepthToViewZ, smoothstep, max, mix, float, uniform, floor } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { VisualInputs } from '../worlds/types';

/** Pixel look unless the URL asks for ?style=smooth. Read once at load; the single source for the style switch. */
export const PIXEL = typeof location === 'undefined' || new URLSearchParams(location.search).get('style') !== 'smooth';
export const INTERNAL_H = 360;

// Ink per world. Local fallback until WP1's palette exposes an ink colour: Red World's oxblood ink on carbon, a deep
// violet on silicon so outlines sit in the cool palette.
const INK: Record<string, number> = { carbon: 0x22060f, silicon: 0x120c26 };
// Outline fade, patch-relative: full strength in the fore/midground (under ~0.3 of the 400 m patch), gone by 0.6 of the
// 1000 m far plane, so the far field reads as haze rather than line noise.
const PATCH_M = 400;
const FAR_M = 1000;
const FADE_FROM = PATCH_M * 0.3;
const FADE_TO = FAR_M * 0.6;

// TSL typing is loose in @types/three for node chains; keep it pragmatic.
type N = any;

export interface Post {
  /** Render the scene through the pipeline to the canvas. */
  render(): void;
  /** Call on canvas resize with the CSS height (pixel mode picks the integer upscale factor from it). */
  resize(cssHeight: number): void;
  /** Once per frame, before render: per-world ink colour. */
  update(inputs: VisualInputs): void;
  /** Compile the scene's materials for the pass's own render target (its formats differ from the canvas). */
  compile(scene: THREE.Object3D, camera: THREE.Camera): Promise<void>;
}

export function createPost(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass: N = pass(scene, camera);
  const color: N = scenePass.getTextureNode('output');
  const depth: N = scenePass.getTextureNode('depth');
  const rt = scenePass.renderTarget as THREE.RenderTarget;
  if (PIXEL) for (const t of [rt.texture, rt.depthTexture]) if (t) t.minFilter = t.magFilter = THREE.NearestFilter;

  const k = uniform(PIXEL ? 3 : 1); // canvas px per internal px
  const texel = vec2(k, k).div(screenSize);
  const b: N = PIXEL ? bloom(color, 0.9, 0.05, 1.0) : bloom(color, 0.55, 0.35, 1.0);
  if (PIXEL) b._nMips = 2;
  const bloomTex: N = b.getTextureNode();
  const ink = new THREE.Color(INK.carbon);
  const inkU = uniform(new THREE.Vector3(ink.r, ink.g, ink.b));
  // The output quad has its own camera, so cameraNear/cameraFar there are the quad's; use the scene camera's planes.
  const cam = camera as THREE.PerspectiveCamera;
  const nearU = uniform(cam.near);
  const farU = uniform(cam.far);
  const z = (uv: N): N => perspectiveDepthToViewZ(depth.sample(uv).r, nearU, farU).negate();

  pipeline.outputNode = Fn(() => {
    const c: N = color.sample(screenUV).rgb.toVar();
    if (!PIXEL) return vec4(c.add(bloomTex.sample(screenUV).rgb), 1);
    // Ink on the near side of silhouettes: a neighbour clearly farther than this pixel.
    const zc: N = z(screenUV);
    let edge: N = float(0);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const zn: N = z(screenUV.add(vec2(dx, dy).mul(texel)));
      edge = max(edge, zn.greaterThan(zc.mul(1.05).add(0.4)).select(float(1), float(0)));
    }
    const fade: N = float(1).sub(smoothstep(FADE_FROM, FADE_TO, zc));
    c.assign(mix(c, vec3(inkU), edge.mul(fade)));
    // Stepped pixel bloom: sample at the internal pixel centre, quantise magnitude to quarter steps.
    const isz: N = screenSize.div(k);
    const snap: N = floor(screenUV.mul(isz)).add(0.5).div(isz);
    const bl: N = bloomTex.sample(snap).rgb;
    const mag: N = max(bl.r, max(bl.g, bl.b));
    const q: N = floor(mag.mul(4).add(0.15)).div(4);
    return vec4(c.add(bl.mul(q.div(mag.max(1e-4)))), 1);
  })();

  let inkFor = '';
  return {
    render: () => pipeline.render(),
    resize(h) {
      if (!PIXEL) return;
      const kk = Math.max(1, Math.round(h / INTERNAL_H));
      k.value = kk;
      scenePass.setResolutionScale(1 / kk + 1e-6);
      b.setResolutionScale(1 / kk);
    },
    update(inputs) {
      nearU.value = cam.near;
      farU.value = cam.far;
      const id = inputs.world.id;
      if (id === inkFor) return;
      inkFor = id;
      ink.setHex(INK[id] ?? INK.carbon);
      inkU.value.set(ink.r, ink.g, ink.b);
    },
    async compile(s, c) {
      const prev = renderer.getRenderTarget();
      rt.samples = renderer.samples; // what the pass will use (PassNode sets it at first render)
      renderer.setRenderTarget(rt);
      try {
        await renderer.compileAsync(s, c);
      } finally {
        renderer.setRenderTarget(prev);
      }
    },
  };
}
