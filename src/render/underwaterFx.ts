// Underwater look (render-only, art layer): slanted light shafts, marine snow and the depth-darkened haze colour.
// Two draws, both gated by the eased submersion (LOOK.underwater): one mesh of slanted shaft strips, one mesh of snow
// quads. Both are world-anchored and wrapped around the camera in the vertex shader (no per-frame buffers); nothing is
// visible, and no uniform work is done, above water. Liquid nitrogen is clear, so its shafts and snow are faint.
import * as THREE from 'three/webgpu';
import { Fn, float, vec3, vec4, mix, smoothstep, normalize, cross, length, distance, mod, fract, sin, cos, abs, pow, clamp, attribute, uv, uniform, mx_noise_float } from 'three/tsl';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { waterAtDepth } from './palette';
import { LOOK, PAL_LIT } from './material';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Snow specks (one draw) and shaft strips (one draw). */
export const UNDERWATER_FX_ROOT = 'underwaterFx';
export const SNOW_COUNT = 2400;
export const SHAFT_COUNT = 7;
const SNOW_BOX = 44;       // m: specks live in a cube this wide around the camera
const SHAFT_SPAN = 90;     // m: shafts are world-anchored and wrap in a square this wide around the camera
const SHAFT_LEN = 110;     // m of slanted strip below the surface

export interface FxState { on: boolean; shaft: number; snow: number }

/**
 * Strengths for this frame. `submersion` is the eased gate, `depth` metres of the camera below the surface,
 * `light` the surface starlight (1 = Earth), `floraDensity` 0..1 producer biomass in the water around the camera.
 */
export function fxState(a: { submersion: number; nitrogen: boolean; light: number; depth: number; floraDensity: number }): FxState {
  const s = a.submersion < 0 ? 0 : a.submersion > 1 ? 1 : a.submersion;
  if (s <= 0) return { on: false, shaft: 0, snow: 0 };
  const lit = Math.pow(Math.min(1, Math.max(0, a.light)), 0.4);   // silicon's ~1% light → 0.16
  const clear = a.nitrogen ? 0.6 : 1;
  const shaft = 0.45 * s * lit * clear * Math.exp(-Math.max(0, a.depth) / 45);
  const snow = s * (a.nitrogen ? 0.25 : 1) * (0.45 + 0.55 * Math.min(1, Math.max(0, a.floraDensity)));
  return { on: true, shaft, snow };
}

/** Haze colour of liquid water at `depth`: the sea's underwater tint sinking toward the ramp's deep navy-blue. Writes `out`. */
export function waterHaze(out: THREE.Color, base: THREE.Color, depth: number, nudge?: number): THREE.Color {
  const deep = tmpDeep.setHex(waterAtDepth(60, undefined, nudge)).multiplyScalar(0.8);
  return out.copy(base).lerp(deep, 1 - Math.exp(-Math.max(0, depth) / 40));
}
const tmpDeep = new THREE.Color();

/** Producer biomass (mat + canopy, saturating) of the 64² flora cell under (x, z). */
export function floraDensityAt(flora: Float32Array, x: number, z: number, patch: number): number {
  const i = Math.floor((x / patch + 0.5) * 64), j = Math.floor((z / patch + 0.5) * 64);
  if (i < 0 || j < 0 || i > 63 || j > 63) return 0;
  const c = j * 64 + i;
  const b = (flora[c * 2] ?? 0) + (flora[c * 2 + 1] ?? 0);
  return b / (b + 0.5);
}

/** `n` quads, each with a per-quad random vec4 (aSeed) and a uv. */
function quadGeometry(n: number, seeds: (k: number) => [number, number, number, number], uvs: [number, number][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(n * 16), uvA = new Float32Array(n * 8), pos = new Float32Array(n * 12), idx = new Uint32Array(n * 6);
  for (let k = 0; k < n; k++) {
    const s = seeds(k);
    for (let v = 0; v < 4; v++) { seed.set(s, (k * 4 + v) * 4); uvA.set(uvs[v], (k * 4 + v) * 2); }
    idx.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));   // unused: positionNode places every vertex
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
const QUAD_UV: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

export interface UnderwaterFxPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  readonly meshes: THREE.Mesh[];
  dispose(): void;
}

export function createUnderwaterFx(app: App): UnderwaterFxPart {
  const { camera, scene } = app;
  const uCam: N = uniform(new THREE.Vector3());
  const uRight: N = uniform(new THREE.Vector3(1, 0, 0));
  const uUp: N = uniform(new THREE.Vector3(0, 1, 0));
  const uDir: N = uniform(new THREE.Vector3(0, -1, 0));
  const uSea = uniform(0);
  const uTime = uniform(0);
  const uShaft = uniform(0);
  const uSnow = uniform(0);
  const uShaftCol: N = uniform(new THREE.Color(0xbfeee8));
  const uSnowCol: N = uniform(new THREE.Color(0xd8f2ee));

  // deterministic scatter (a tiny LCG: render-only, no sim RNG)
  let r = 12345;
  const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);

  // ---- marine snow: camera-facing quads, drifting down, wrapped in a box around the camera
  const snowGeo = quadGeometry(SNOW_COUNT, () => [rnd(), rnd(), rnd(), rnd()], QUAD_UV);
  const snowMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const snowRel = () => {
    const seed = attribute('aSeed', 'vec4') as N;
    const moved = seed.xyz.mul(SNOW_BOX).add((vec3 as N)(sin(uTime.mul(0.2).add(seed.w.mul(40))).mul(0.8), uTime.mul(seed.w.mul(0.05).add(0.04)).negate(), cos(uTime.mul(0.17).add(seed.w.mul(25))).mul(0.8)));
    return mod(moved.sub(uCam).add(SNOW_BOX / 2), SNOW_BOX).sub(SNOW_BOX / 2);
  };
  snowMat.positionNode = Fn(() => {
    const seed = attribute('aSeed', 'vec4') as N;
    const c = uv().sub(0.5).mul(2);
    const size = fract(seed.w.mul(17.3)).mul(0.07).add(0.035);
    return uCam.add(snowRel()).add(uRight.mul(c.x.mul(size))).add(uUp.mul(c.y.mul(size)));
  })();
  snowMat.colorNode = vec3(uSnowCol);
  snowMat.opacityNode = Fn(() => {
    const rel = snowRel() as N;
    const d = smoothstep(float(SNOW_BOX / 2), float(SNOW_BOX * 0.12), length(rel));      // fade with distance
    const round = smoothstep(1.0, 0.4, length(uv().sub(0.5).mul(2)));
    const wet = smoothstep(0.0, -0.6, uCam.y.add(rel.y).sub(uSea));                       // only below the surface
    return d.mul(round).mul(wet).mul(uSnow).mul(0.7);
  })();
  const snow = new THREE.Mesh(snowGeo, snowMat);

  // ---- shafts: slanted strips from the surface along uDir, turned to face the camera about their own axis
  const shaftGeo = quadGeometry(SHAFT_COUNT, () => [rnd(), rnd(), rnd(), rnd()], QUAD_UV);
  const shaftMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const shaftTop = () => {
    const seed = attribute('aSeed', 'vec4') as N;
    const x = mod(seed.x.mul(SHAFT_SPAN).sub(uCam.x).add(SHAFT_SPAN / 2), SHAFT_SPAN).sub(SHAFT_SPAN / 2);
    const z = mod(seed.y.mul(SHAFT_SPAN).sub(uCam.z).add(SHAFT_SPAN / 2), SHAFT_SPAN).sub(SHAFT_SPAN / 2);
    return { x, z, top: (vec3 as N)(uCam.x.add(x), uSea, uCam.z.add(z)) };
  };
  const shaftDir = () => {
    const seed = attribute('aSeed', 'vec4') as N;
    const sway = (vec3 as N)(sin(uTime.mul(0.3).add(seed.w.mul(6.28))), 0, cos(uTime.mul(0.23).add(seed.w.mul(9)))).mul(0.05);
    return normalize(uDir.add(sway));
  };
  shaftMat.positionNode = Fn(() => {
    const seed = attribute('aSeed', 'vec4') as N;
    const u = uv() as N;
    const s = u.y, { top } = shaftTop(), dir = shaftDir();
    const along = top.add(dir.mul(s.mul(SHAFT_LEN)));
    const w = normalize((cross as N)(dir, uCam.sub(top)));
    const width = seed.z.mul(5).add(3).mul(s.mul(0.8).add(0.6));
    return along.add(w.mul(u.x.sub(0.5).mul(width)));
  })();
  shaftMat.colorNode = vec3(uShaftCol);
  shaftMat.opacityNode = Fn(() => {
    const seed = attribute('aSeed', 'vec4') as N;
    const u = uv() as N;
    const s = u.y, { x, z, top } = shaftTop(), dir = shaftDir();
    const across = pow(float(1).sub(abs(u.x.mul(2).sub(1))), 2);
    const alongF = smoothstep(0.0, 0.06, s).mul(pow(float(1).sub(s), 1.4));
    const n = mx_noise_float(vec3(seed.x.mul(13), s.mul(2.5), uTime.mul(0.12))).mul(0.45).add(0.55);
    const near = smoothstep(2.0, 10.0, distance(top.add(dir.mul(s.mul(SHAFT_LEN))), uCam));
    const edge = smoothstep(SHAFT_SPAN / 2, SHAFT_SPAN * 0.3, length(vec3(x, 0, z)));
    return clamp(across.mul(alongF).mul(n).mul(near).mul(edge).mul(uShaft), 0, 1);
  })();
  const shafts = new THREE.Mesh(shaftGeo, shaftMat);

  // One named root so main.ts warmFeatures can find it and pre-compile the pipelines before the first dive.
  const root = new THREE.Group();
  root.name = UNDERWATER_FX_ROOT;
  for (const m of [snow, shafts]) { m.frustumCulled = false; m.renderOrder = 3; m.visible = false; root.add(m); }
  scene.add(root);

  const lightDir = new THREE.Vector3();
  const base = new THREE.Color(), tint = new THREE.Color();
  let flora = 0, floraAt = -10;
  return {
    meshes: [snow, shafts],
    update(dt, t, inputs, patch) {
      const sub = LOOK.underwater.value as number;
      if (sub <= 0) { snow.visible = shafts.visible = false; return; }   // above water: nothing runs
      const depth = inputs.seaLevel - camera.position.y;
      if (t - floraAt > 0.5) { floraAt = t; flora = floraDensityAt(inputs.flora, camera.position.x, camera.position.z, patch); }
      const nitrogen = /nitrogen/i.test(inputs.world.solvent.name);
      const st = fxState({ submersion: sub, nitrogen, light: inputs.light, depth, floraDensity: flora });
      snow.visible = shafts.visible = st.on;
      uShaft.value = st.shaft; uSnow.value = st.snow;
      uTime.value = t; uSea.value = inputs.seaLevel;
      (uCam.value as THREE.Vector3).copy(camera.position);
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements;
      (uRight.value as THREE.Vector3).set(e[0], e[1], e[2]);
      (uUp.value as THREE.Vector3).set(e[4], e[5], e[6]);
      // sunlight refracted toward the vertical: horizontal part of the star direction ×0.75, never flatter than ~64° from horizontal
      lightDir.copy(LOOK.lightDir.value).normalize();
      (uDir.value as THREE.Vector3).set(-lightDir.x * 0.75, -Math.max(lightDir.y, 0.45), -lightDir.z * 0.75).normalize();
      // colours: the haze's pale side (water tint lifted toward the bone/haze roles)
      base.copy(LOOK.waterTint.value);
      tint.copy(base).lerp(PAL_LIT.bone.value, 0.55);
      uShaftCol.value.copy(tint);
      uSnowCol.value.copy(base).lerp(PAL_LIT.bone.value, 0.7);
      void dt;
    },
    dispose() {
      scene.remove(snow, shafts);
      snowGeo.dispose(); shaftGeo.dispose(); snowMat.dispose(); shaftMat.dispose();
    },
  };
}
