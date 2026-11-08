// The one pixel post pass (art layer, owner ruling 2026-11-07). Ported from mockups/red-world/src/post.ts.
// Pixel (default; PIXEL from material.ts): the scene renders at ~360 px internal height and is upscaled nearest-neighbour; a 1 internal-px ink
// outline marks depth discontinuities (near side of silhouettes), fading out with distance relative to the 400 m patch
// and 1000 m far plane; bloom (threshold 1, HDR emissives only) runs at internal resolution with 2 mips, sampled at
// internal pixel centres and quantised to quarter steps, so glows read as crisp cores with a stepped 1-2 px halo.
// Smooth (?style=smooth): full resolution, no outline, soft bloom.
// Underwater overlay, only while LOOK.underwater > 0 (sky.ts: liquid seas, from just above the surface down; the branch
// is skipped otherwise, so it costs nothing above water): a waterline across the view while the camera is within the
// lens of the surface (underwater.ts), and on the wet side a row-shift refraction wobble, world-space caustics on
// surfaces under the water, a grade toward the liquid's tint that deepens with depth, faint light shafts fanning from
// the star's side, a stepped vignette and an ink outline that dissolves into the water. Screen patterns run per
// internal pixel and are stepped, so the pixels stay crisp; smooth mode runs them unstepped on the same ~360 px grid.
// The inspect card's live view is NOT drawn here: the app draws its overlays after `render()`, straight to the canvas.
import * as THREE from 'three/webgpu';
import {
  Fn, If, pass, vec2, vec3, vec4, screenUV, screenSize, perspectiveDepthToViewZ, getViewPosition, smoothstep, max, min, mix, float, uniform,
  floor, round, sin, fract, dot, length, exp, texture,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { VisualInputs } from '../worlds/types';
import { LOOK, PAL, PAL_LIT, PIXEL } from './material';
import { waterlineNdc } from './underwater';

export { PIXEL };
// Pixel mode evaluates the output node once per INTERNAL pixel into a small RT, then blits it nearest-neighbour to the
// canvas (≈k² less fragment work). `?postfull` restores the old path (output node per canvas pixel) for A/B.
const INTERNAL = PIXEL && !(typeof location !== 'undefined' && /[?&]postfull(?:[=&]|$)/.test(location.search));
export const INTERNAL_H = 360;
// Outline colour: the palette's `ink` role (PAL.ink, set per world by updateLook). Outline fade, patch-relative: full
// strength in the fore/midground (under 0.3 patch, LOOK.patch = 400 m), gone by 0.6 of the camera far plane (1000 m),
// so the far field reads as haze rather than line noise.
const FADE_FROM_PATCH = 0.3;
const FADE_TO_FAR = 0.6;
// Ink fades out as setPixelScale rises (Generate transition): full at <= 1.25, gone by 3, so chunky pixels stay clean.
const INK_SCALE_FULL = 1.25;
const INK_SCALE_GONE = 3;

// Underwater look. Screen units are internal (art) pixels, world units metres.
const WOBBLE_PX = 1.1;          // row-shift refraction: two sines, rounded, so rows move by 1-2 internal px
const CAUSTIC_CELL = 2.2;       // m, caustic net cell size on surfaces under the water
const CAUSTIC_GAIN = 0.45;      // caustic light added at full strength (× the star's light colour)
const SHAFT_GAIN = 0.1;         // light shafts: low strength
const LUMA_W = [0.2126, 0.7152, 0.0722] as const;

// TSL typing is loose in @types/three for node chains; keep it pragmatic.
type N = any;

/** Hash without sine (Dave Hoskins, MIT): vec2 → vec2 in [0, 1). */
const hash22 = (p: N): N => {
  const p3: N = fract(vec3(p.x, p.y, p.x).mul(vec3(0.1031, 0.103, 0.0973))).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.xx.add(p3.yz).mul(p3.zy));
};

/** F2 - F1 of a 3×3 voronoi whose points orbit slowly in their cells: ~0 on the cell borders (the caustic net). */
const voronoiEdge = (p: N, t: N): N => {
  const cell: N = floor(p);
  const f: N = p.sub(cell);
  const d1: N = float(8).toVar();
  const d2: N = float(8).toVar();
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const o = vec2(i, j);
      const h: N = hash22(cell.add(o));
      const pt: N = o.add(sin(h.mul(6.2831).add(vec2(t.mul(0.83), t.mul(0.61)))).mul(0.38)).add(0.5);
      const d: N = length(pt.sub(f));
      d2.assign(min(d2, max(d1, d)));
      d1.assign(min(d1, d));
    }
  }
  return d2.sub(d1);
};

/** Pixel mode quantises a 0..1 value into n steps; smooth mode leaves it. */
const steps = (x: N, n: number): N => (PIXEL ? floor(x.mul(n).add(0.5)).div(n) : x);
/** 1 for rows with a <= rel < b (in art px); smooth mode antialiases the edges. */
const band = (rel: N, a: number, b: number): N =>
  PIXEL
    ? rel.greaterThanEqual(a).and(rel.lessThan(b)).select(float(1), float(0))
    : smoothstep(a - 0.5, a + 0.5, rel).mul(float(1).sub(smoothstep(b - 0.5, b + 0.5, rel)));

export interface Post {
  /** Render the scene through the pipeline to the canvas. */
  render(): void;
  /** Call on canvas resize with the CSS height (pixel mode picks the integer upscale factor from it). */
  resize(cssHeight: number): void;
  /** Once per frame, before render: tracks the scene camera (planes, matrices) and the sea level for the sea mask. */
  update(inputs?: VisualInputs): void;
  /** Compile the scene's materials for the pass's own render target (its formats differ from the canvas). */
  compile(scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Scene): Promise<void>;
  /**
   * Pixel-size multiplier on top of the ~360 px base (default 1; 4 = four times chunkier). Cheap to tween every frame:
   * the effective canvas-px-per-pixel is rounded to an integer, so the pass targets only resize when that integer
   * changes. The ink outline fades out from scale 1.25 to 3. No-op under ?style=smooth.
   */
  setPixelScale(scale: number): void;
}

export function createPost(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  const pipeline = new THREE.RenderPipeline(renderer);
  // INTERNAL path: stage A renders the output node (linear, untransformed) into outRT; stage B (`pipeline`) blits it to the
  // canvas, where the pipeline's own output transform (tone mapping + sRGB) is applied exactly once, as before.
  const outRT = new THREE.RenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  });
  const matA = new THREE.NodeMaterial();
  const quadA = new THREE.QuadMesh(matA);
  quadA.name = 'Post internal';
  const scenePass: N = pass(scene, camera);
  const color: N = scenePass.getTextureNode('output');
  const depth: N = scenePass.getTextureNode('depth');
  const rt = scenePass.renderTarget as THREE.RenderTarget;
  if (PIXEL) for (const t of [rt.texture, rt.depthTexture]) if (t) t.minFilter = t.magFilter = THREE.NearestFilter;

  const k = uniform(PIXEL ? 3 : 1); // canvas px per internal px
  // INTERNAL: the output node runs with the internal RT bound, so screenSize IS the internal size (1:1 with the scene RT
  // texels) and k no longer enters the maths; otherwise screenSize is the canvas and k converts.
  const texel = INTERNAL ? vec2(1, 1).div(screenSize) : vec2(k, k).div(screenSize);
  const b: N = PIXEL ? bloom(color, 0.9, 0.05, 1.0) : bloom(color, 0.55, 0.35, 1.0);
  if (PIXEL) b._nMips = 2;
  const bloomTex: N = b.getTextureNode();
  // The output quad has its own camera, so cameraNear/cameraFar there are the quad's; use the scene camera's planes.
  const cam = camera as THREE.PerspectiveCamera;
  const nearU = uniform(cam.near);
  const farU = uniform(cam.far);
  const z = (uv: N): N => perspectiveDepthToViewZ(depth.sample(uv).r, nearU, farU).negate();
  // Sea mask: the sea plane doesn't write depth, so from above the outline would trace the seabed through the water.
  // Skip ink where this pixel's world height is under the sea surface while the camera is above it.
  const projInvU = uniform(new THREE.Matrix4());
  const camWorldU = uniform(new THREE.Matrix4());
  const seaU = uniform(-1e9);
  const camYU = uniform(0);
  const inkScaleU = uniform(1); // 1 - smoothstep(INK_SCALE_FULL, INK_SCALE_GONE, pixelScale)
  // Underwater overlay, from the scene camera each frame (update): the waterline's screen y (NDC, underwater.ts), the
  // shaft fan's origin x (NDC, on the star's side) and the shafts' strength (shallow and looking up = strongest).
  const lineU = uniform(-1e3);
  const sunXU = uniform(0);
  const shaftU = uniform(0);
  // The art-pixel grid: the internal pixels in pixel mode; smooth mode uses the same ~360 px grid, unquantised.
  const grid: N = INTERNAL ? screenSize : PIXEL ? screenSize.div(k) : screenSize.mul(float(INTERNAL_H).div(screenSize.y));
  const LUMA: N = vec3(...LUMA_W);

  /**
   * The wet side's look, in place on `c`. ip: art-pixel coordinate (top-left origin); wet: 0..1 (× the eased gate);
   * rel: art px below the waterline (0 = the surface row); wp: world position of the pixel's surface; zc: its view depth.
   */
  const overlay = (c: N, ip: N, wet: N, rel: N, wp: N, zc: N) => {
    const t: N = LOOK.time;
    const clear: N = LOOK.waterClear;
    const dep: N = LOOK.waterDepth;
    const tint: N = vec3(LOOK.waterTint);
    const hue: N = tint.div(max(tint.r, max(tint.g, tint.b)).max(1e-4)); // the liquid's hue, brightest channel 1
    const light: N = vec3(LOOK.lightColor);                              // the star's light (dimmed and tinted)

    // (b) caustics: a drifting voronoi net projected straight down onto surfaces under the water. Brightest just under
    // the surface, gone within a few metres in water (tens in clear nitrogen), and lost in the water's fog with distance.
    const dSurf: N = seaU.sub(wp.y);
    const near: N = exp(max(zc.sub(LOOK.fogStart), 0).div(LOOK.fogDist).negate());
    const cs: N = exp(max(dSurf, 0).div(mix(4, 12, clear)).negate()).mul(near).mul(wet)
      .mul(dSurf.greaterThan(0).select(float(1), float(0))).toVar();
    If(cs.greaterThan(0.01), () => {
      const p: N = wp.xz.div(CAUSTIC_CELL);
      const pw: N = p.add(sin(p.yx.mul(1.7).add(t.mul(0.5))).mul(0.18));
      const net: N = float(1).sub(smoothstep(0.02, 0.11, voronoiEdge(pw, t)));
      c.addAssign(light.mul(steps(net, 3)).mul(cs).mul(CAUSTIC_GAIN));
    });

    // (a) grade toward the liquid: a hue filter, darker and more saturated with depth (down to a readable floor), and
    // a lift toward the tint. Clear liquid nitrogen gets a light cool filter, little darkening and a pale lift.
    const filt: N = mix(vec3(1), hue, mix(0.5, 0.15, clear).mul(dep.mul(0.3).add(0.7)));
    const g: N = c.mul(filt).mul(mix(float(1), mix(0.68, 0.92, clear), dep)).toVar();
    g.assign(mix(g, tint, mix(0.1, 0.16, clear).add(dep.mul(0.12).mul(clear.oneMinus()))));
    g.assign(max(mix(vec3(dot(g, LUMA)), g, dep.mul(0.3).mul(clear.oneMinus()).add(1)), 0));
    c.assign(mix(c, g, wet));

    // (e) light shafts: faint stepped streaks fanning down from above the top edge, on the star's side
    const aspect: N = grid.x.div(grid.y);
    const q: N = ip.div(grid);
    const sx: N = q.x.mul(2).sub(1).mul(aspect);
    const sy: N = float(1).sub(q.y.mul(2));
    // Skipped when shaftU is 0 (looking down, or deep): the term is multiplied by shaftU, so it adds exactly 0.
    If(shaftU.greaterThan(0), () => {
      const fan: N = sx.sub(sunXU.mul(aspect).mul(0.8)).div(max(float(1.6).sub(sy), 0.05));
      const st: N = sin(fan.mul(9).add(t.mul(0.31))).mul(0.6).add(sin(fan.mul(23).sub(t.mul(0.19))).mul(0.4));
      const shaft: N = smoothstep(0.3, 0.85, st).mul(smoothstep(-0.7, 1, sy));
      c.addAssign(light.mul(mix(hue, vec3(1), 0.65)).mul(steps(shaft, 3)).mul(shaftU).mul(wet));
    });

    // (d) vignette: a stepped darker rim in the liquid's hue
    const vig: N = steps(smoothstep(0.5, 1, length(vec2(sx, sy)).div(length(vec2(aspect, 1)))), 4);
    c.assign(mix(c, c.mul(hue).mul(0.35), vig.mul(mix(0.6, 0.35, clear)).mul(wet)));

    // (f) the waterline: a faint glint row above, the bright surface row, and a darker row under it
    const u: N = LOOK.underwater;
    c.assign(mix(c, vec3(PAL_LIT.bone), band(rel, -1, 0).mul(0.3).mul(u)));
    c.assign(mix(c, vec3(PAL_LIT.bone), band(rel, 0, 1).mul(0.75).mul(u)));
    c.assign(mix(c, tint.mul(0.45), band(rel, 1, 2).mul(0.5).mul(u)));
  };

  const outputNode: N = Fn(() => {
    // Underwater: which art pixels are in the water (under the waterline, with a gentle integer-row wave across x),
    // and the refraction wobble, which shifts whole wet rows by integer art pixels so it never smears.
    // (declared at the top so every branch below reads the same values)
    const ipRaw: N = screenUV.mul(grid);
    const ip: N = (PIXEL ? floor(ipRaw).add(0.5) : ipRaw).toVar(); // art-pixel centre
    const uv: N = screenUV.toVar();
    const wet: N = float(0).toVar();
    const rel: N = float(-1e4).toVar();
    If(LOOK.underwater.greaterThan(0), () => {
      const t: N = LOOK.time;
      const rowLine: N = float(1).sub(lineU).mul(0.5).mul(grid.y);
      const wave: N = sin(ip.x.mul(0.09).add(t.mul(1.4))).mul(0.9).add(sin(ip.x.mul(0.031).sub(t.mul(0.8))).mul(0.6));
      rel.assign(ip.y.sub(rowLine).sub(PIXEL ? round(wave) : wave));
      wet.assign((PIXEL ? rel.greaterThanEqual(0).select(float(1), float(0)) : smoothstep(-0.5, 0.5, rel)).mul(LOOK.underwater));
      const wob: N = sin(ip.y.mul(0.21).add(t.mul(1.6))).mul(WOBBLE_PX).add(sin(ip.y.mul(0.067).sub(t.mul(0.7))).mul(0.6)).mul(wet);
      uv.assign(ip.add(vec2(PIXEL ? round(wob) : wob, 0)).div(grid));
    });

    const c: N = color.sample(uv).rgb.toVar();
    if (!PIXEL) {
      If(LOOK.underwater.greaterThan(0), () => {
        const d: N = depth.sample(uv).r;
        const wp: N = camWorldU.mul(vec4(getViewPosition(uv, d, projInvU), 1)).xyz;
        overlay(c, ip, wet, rel, wp, perspectiveDepthToViewZ(d, nearU, farU).negate());
      });
      return vec4(c.add(bloomTex.sample(uv).rgb), 1);
    }
    // Ink on the near side of silhouettes: a neighbour clearly farther than this pixel.
    const zc: N = z(uv);
    let edge: N = float(0);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const zn: N = z(uv.add(vec2(dx, dy).mul(texel)));
      edge = max(edge, zn.greaterThan(zc.mul(1.05).add(0.4)).select(float(1), float(0)));
    }
    const wp: N = camWorldU.mul(vec4(getViewPosition(uv, depth.sample(uv).r, projInvU), 1)).xyz;
    const underSea: N = wp.y.lessThan(seaU.sub(1.0)).and(camYU.greaterThan(seaU)); // the top 1 m keeps ink: shallow creatures, shore edges
    // and the mirror case: from under the surface the sea hides what stands above it
    const overSea: N = wp.y.greaterThan(seaU.add(0.05)).and(camYU.lessThan(seaU));
    // In the water the ink takes the liquid's tint with depth and dissolves into it with distance.
    const inkCol: N = mix(vec3(PAL.ink), vec3(LOOK.waterTint).mul(0.4), wet.mul(LOOK.waterDepth.mul(0.6).add(0.25)));
    const inkFar: N = float(1).sub(wet.mul(smoothstep(LOOK.fogDist.mul(0.5), LOOK.fogDist.mul(2.5), zc)));
    const fade: N = float(1).sub(smoothstep(LOOK.patch.mul(FADE_FROM_PATCH), farU.mul(FADE_TO_FAR), zc)).mul(underSea.or(overSea).select(float(0), float(1))).mul(inkScaleU).mul(inkFar);
    c.assign(mix(c, inkCol, edge.mul(fade)));
    If(LOOK.underwater.greaterThan(0), () => {
      overlay(c, ip, wet, rel, wp, zc);
    });
    // Stepped pixel bloom: sample at the internal pixel centre, quantise magnitude to quarter steps.
    const isz: N = INTERNAL ? screenSize : screenSize.div(k);
    const snap: N = floor(uv.mul(isz)).add(0.5).div(isz);
    const bl: N = bloomTex.sample(snap).rgb;
    const mag: N = max(bl.r, max(bl.g, bl.b));
    const q: N = floor(mag.mul(4).add(0.15)).div(4);
    return vec4(c.add(bl.mul(q.div(mag.max(1e-4)))), 1);
  })();

  if (INTERNAL) {
    matA.fragmentNode = outputNode;
    pipeline.outputNode = vec4(texture(outRT.texture, screenUV).rgb, 1);
  } else {
    pipeline.outputNode = outputNode;
  }
  const sizeV = new THREE.Vector2();
  // Match the scene RT's texels 1:1 (same formula as PassNode.setSize with resolutionScale 1/k + 1e-6). Only on change.
  const syncOutRT = () => {
    renderer.getDrawingBufferSize(sizeV);
    const sc = 1 / Math.max(1, appliedK) + 1e-6;
    const w = Math.max(1, Math.floor(sizeV.x * sc));
    const h = Math.max(1, Math.floor(sizeV.y * sc));
    if (outRT.width !== w || outRT.height !== h) outRT.setSize(w, h);
  };
  const renderInternal = () => {
    syncOutRT();
    const tm = renderer.toneMapping;
    const cs = renderer.outputColorSpace;
    const prev = renderer.getRenderTarget();
    try {
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.outputColorSpace = THREE.ColorManagement.workingColorSpace;
      renderer.setRenderTarget(outRT);
      quadA.render(renderer);
      renderer.setRenderTarget(prev);
      renderer.toneMapping = tm;
      renderer.outputColorSpace = cs;
      pipeline.render();
    } finally {
      renderer.setRenderTarget(prev);
      renderer.toneMapping = tm;
      renderer.outputColorSpace = cs;
    }
  };
  let warmed = false;

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
    render: () => (INTERNAL ? renderInternal() : pipeline.render()),
    resize(h) {
      if (!PIXEL) return;
      baseK = Math.max(1, Math.round(h / INTERNAL_H));
      applyK();
    },
    setPixelScale(scale) {
      if (!PIXEL || !(scale > 0)) return;
      pixelScale = scale;
      const t = Math.min(1, Math.max(0, (scale - INK_SCALE_FULL) / (INK_SCALE_GONE - INK_SCALE_FULL)));
      inkScaleU.value = 1 - t * t * (3 - 2 * t);
      applyK();
    },
    update(inputs) {
      nearU.value = cam.near;
      farU.value = cam.far;
      cam.updateMatrixWorld();
      projInvU.value.copy(cam.projectionMatrixInverse);
      camWorldU.value.copy(cam.matrixWorld);
      camYU.value = cam.position.y;
      seaU.value = inputs?.seaLevel ?? -1e9;
      // Underwater overlay: where the surface crosses the lens (camera basis from matrixWorld: right = col 0,
      // up = col 1, forward = -col 2), which side the star is on, and how strong the shafts are.
      const e = cam.matrixWorld.elements;
      const depthC = seaU.value - cam.position.y;
      lineU.value = waterlineNdc(depthC, e[5]);
      const ld = LOOK.lightDir.value as THREE.Vector3;
      const ll = ld.length() || 1;
      sunXU.value = Math.max(-1, Math.min(1, ((ld.x * e[0] + ld.y * e[1] + ld.z * e[2]) / ll) * 1.2));
      const up = Math.min(1, Math.max(0, (-e[9] + 0.8) / 1.1)); // looking up (forward.y 0.3) = 1, down (-0.8) = 0
      const clear = LOOK.waterClear.value as number;
      shaftU.value = SHAFT_GAIN * Math.exp(-Math.max(0, depthC) / (6 + 12 * clear)) * up * up * (3 - 2 * up);
    },
    async compile(s, c, targetScene) {
      const prev = renderer.getRenderTarget();
      rt.samples = renderer.samples; // what the pass will use (PassNode sets it at first render)
      renderer.setRenderTarget(rt);
      try {
        await renderer.compileAsync(s, c, targetScene);
      } finally {
        renderer.setRenderTarget(prev);
      }
      // Warm the RT pass + blit pipelines once (they don't depend on the compiled scene): one throwaway frame, drawn to
      // the canvas (target forced to null in case an overlapping compile left the scene pass rt bound).
      if (INTERNAL && !warmed) {
        warmed = true;
        const held = renderer.getRenderTarget();
        renderer.setRenderTarget(null);
        try { renderInternal(); } catch (err) { console.warn('post warm-up failed', err); } finally { renderer.setRenderTarget(held); }
      }
    },
  };
}
