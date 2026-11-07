// RenderPipeline: scene pass → bloom (threshold 1: only HDR emissives glow) → dither/grain to kill sky banding.
import * as THREE from 'three/webgpu';
import { pass, uniform, vec2, vec3, vec4, screenCoordinate, fract, sin, dot } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export function createPost(renderer: any, scene: any, camera: any) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const strength = uniform(0.2);
  const grainSeed = uniform(0);
  const bloomPass = bloom(color, 0.2, 0.55, 1.0);
  bloomPass.strength = strength;

  const n = fract(sin(dot(screenCoordinate.xy.add(grainSeed), vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
  const lit = color.rgb.add(bloomPass.rgb);
  pipeline.outputNode = vec4(lit.add(vec3(n.mul(0.010))), 1.0);

  return {
    pipeline,
    /** 0.25 on dark palettes, 0.15 on pale ones (by sky-horizon luminance 0..1). */
    setPalette(lum: number) {
      const t = Math.min(1, Math.max(0, (lum - 0.3) / 0.35));
      strength.value = 0.25 + (0.15 - 0.25) * t;
    },
    setGrainTime(t: number) { grainSeed.value = (t * 60) % 997; },
    render() { pipeline.render(); },
  };
}
