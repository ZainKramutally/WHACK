// The one shared world look: cel-stepped diffuse, coloured shadows, stained stone, frost, glass rim.
// Lighting = MeshToonNodeMaterial (gradient steps) + hemisphere fill light + shadow-tinted receivedShadowNode.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec3, color, mix, smoothstep, saturate, positionWorld, normalWorld, normalView,
  positionViewDirection, positionView, mx_fractal_noise_float,
} from 'three/tsl';
import type { MaterialFactory, WorldMaterialOptions, WorldUniforms } from '../contracts';

/** 3-step cel ramp (shadow core / mid / lit). NearestFilter keeps the steps hard. */
function celRamp(): any {
  // 16 texels over n·l: <0.06 core shadow (sun contributes nothing, only the tinted fill) · 0.06–0.25 mid · >0.25 lit.
  const v = [0, 150, 150, 150, ...Array(12).fill(255)];
  const data = new Uint8Array(v.flatMap((x) => [x, x, x, 255]));
  const t = new THREE.DataTexture(data, v.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function createMaterialFactory(u: WorldUniforms): MaterialFactory {
  const ramp = celRamp();
  const white = vec3(1, 1, 1);
  // flat facets: face normal from screen-space derivatives
  const flatNormal = positionView.dFdx().cross(positionView.dFdy()).normalize();

  // Shadows are never grey/black: lit = 1, shadowed = shadow hue lifted so albedo × it keeps its colour.
  const shadowTint = Fn(([s]: any[]) => mix(u.shadowColor.mul(0.4), white, s.x ?? s));

  return {
    create(opts: WorldMaterialOptions = {}) {
      const mat = new THREE.MeshToonNodeMaterial({ gradientMap: ramp });
      if (opts.flatShading) mat.normalNode = flatNormal;
      mat.receivedShadowNode = shadowTint;

      // WorldMaterialOptions.color: a number/node is the base albedo; with `stone` a TSL node is a multiplier
      // tint on the stained stone albedo (landforms uses it to darken pores).
      let base: any = typeof opts.color === 'number' ? color(opts.color) : (opts.color ?? u.ground);

      if (opts.stone) {
        const p = positionWorld;
        // vertical streaks: noise stretched along y
        const streak = mx_fractal_noise_float(vec3(p.x.mul(0.1), p.y.mul(0.02), p.z.mul(0.1)), 2, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
        // low = older = more stained, fading to bone by ~55 m. Fully-stained worlds (iron, slate) keep it to the tips.
        const lowProfile = float(1).sub(smoothstep(3, 55, p.y));
        const tipStain = smoothstep(0.6, 0.85, u.stainAmount);
        const prof = mix(lowProfile, float(1), tipStain);
        const t = saturate(prof.mul(1.05).add(streak.sub(0.5).mul(0.55)));
        const stone = mix(color(0xece4d6), u.stoneColor, t);
        base = opts.color !== undefined && typeof opts.color !== 'number' ? stone.mul(opts.color) : stone;
      }
      if (opts.snowCover) {
        const up = smoothstep(0.6, 0.85, normalWorld.y); // up-facing only; walls stay stone
        const n = mx_fractal_noise_float(positionWorld.mul(0.8), 2, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
        const frost = up.mul(u.snow).mul(float(0.7).add(n.mul(0.5))).mul(1.4);
        base = mix(base, mix(u.haze, white, 0.55), saturate(frost));
      }
      if (opts.glass) {
        const rim = float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(3);
        base = mix(base, color(0xd2f8ff), rim.mul(0.85));
        mat.normalNode = flatNormal;
      }
      mat.colorNode = base;
      if (opts.emissive) mat.emissiveNode = opts.emissive;
      if (opts.positionNode) mat.positionNode = opts.positionNode;
      if (opts.opacity !== undefined) {
        mat.opacityNode = typeof opts.opacity === 'number' ? float(opts.opacity) : opts.opacity;
        mat.transparent = true;
      }
      return mat;
    },
  };
}
