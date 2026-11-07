// The one pixel post pass (art layer, owner ruling 2026-11-07). Ported from mockups/red-world/src/post.ts.
// Pixel (default; PIXEL from material.ts): the scene renders at ~360 px internal height and is upscaled nearest-neighbour; a 1 internal-px ink
// outline marks depth discontinuities (near side of silhouettes), fading out with distance relative to the 400 m patch
// and 1000 m far plane; bloom (threshold 1, HDR emissives only) runs at internal resolution with 2 mips, sampled at
// internal pixel centres and quantised to quarter steps, so glows read as crisp cores with a stepped 1-2 px halo.
// Smooth (?style=smooth): full resolution, no outline, soft bloom.
// The inspect card's live view is NOT drawn here: the app draws its overlays after `render()`, straight to the canvas.
import * as THREE from 'three/webgpu';
import { Fn, pass, vec2, vec3, vec4, screenUV, screenSize, perspectiveDepthToViewZ, smoothstep, max, mix, float, uniform, floor } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { VisualInputs } from '../worlds/types';
import { LOOK, PAL, PIXEL } from './material';

export { PIXEL };
export const INTERNAL_H = 360;
// Outline colour: the palette's `ink` role (PAL.ink, set per world by updateLook). Outline fade, patch-relative: full
// strength in the fore/midground (under 0.3 patch, LOOK.patch = 400 m), gone by 0.6 of the camera far plane (1000 m),
// so the far field reads as haze rather than line noise.
const FADE_FROM_PATCH = 0.3;
const FADE_TO_FAR = 0.6;

// TSL typing is loose in @types/three for node chains; keep it pragmatic.
type N = any;

export interface Post {
  /** Render the scene through the pipeline to the canvas. */
  render(): void;
  /** Call on canvas resize with the CSS height (pixel mode picks the integer upscale factor from it). */
  resize(cssHeight: number): void;
  /** Once per frame, before render: tracks the scene camera's near/far planes. */
  update(inputs?: VisualInputs): void;
  /** Compile the scene's materials for the pass's own render target (its formats differ from the canvas). */
  compile(scene: THREE.Object3D, camera: THREE.Camera): Promise<void>;
  /**
   * Pixel-size multiplier on top of the ~360 px base (default 1; 4 = four times chunkier). Cheap to tween every frame:
   * the effective canvas-px-per-pixel is rounded to an integer, so the pass targets only resize when that integer
   * changes. No-op under ?style=smooth.
   */
  setPixelScale(scale: number): void;
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
    const fade: N = float(1).sub(smoothstep(LOOK.patch.mul(FADE_FROM_PATCH), farU.mul(FADE_TO_FAR), zc));
    c.assign(mix(c, vec3(PAL.ink), edge.mul(fade)));
    // Stepped pixel bloom: sample at the internal pixel centre, quantise magnitude to quarter steps.
    const isz: N = screenSize.div(k);
    const snap: N = floor(screenUV.mul(isz)).add(0.5).div(isz);
    const bl: N = bloomTex.sample(snap).rgb;
    const mag: N = max(bl.r, max(bl.g, bl.b));
    const q: N = floor(mag.mul(4).add(0.15)).div(4);
    return vec4(c.add(bl.mul(q.div(mag.max(1e-4)))), 1);
  })();

  let baseK = 3; // from the canvas height
  let pixelScale = 1;
  let appliedK = 0;
  const applyK = () => {
    const kk = Math.max(1, Math.round(baseK * pixelScale));
    if (kk === appliedK) return;
    appliedK = kk;
    k.value = kk;
    scenePass.setResolutionScale(1 / kk + 1e-6);
    b.setResolutionScale(1 / kk);
  };

  return {
    render: () => pipeline.render(),
    resize(h) {
      if (!PIXEL) return;
      baseK = Math.max(1, Math.round(h / INTERNAL_H));
      applyK();
    },
    setPixelScale(scale) {
      if (!PIXEL || !(scale > 0)) return;
      pixelScale = scale;
      applyK();
    },
    update() {
      nearU.value = cam.near;
      farU.value = cam.far;
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
