// The sea: a plane at seaLevel in the world material (kind 'sea'), liquid or frozen exactly per inputs.frozen.
//   carbon water: a dark violet-oxblood body (the palette's shadow) that turns into a pale lilac mirror of the sky at
//     grazing angles, with slow pale glint lines;
//   liquid nitrogen: clear and pale (low alpha), barely tinted, so life in it stays visible;
//   frozen: opaque pale ice (bone/haze) with faint polygonal cracks, lying still.
// Hidden when there is no sea. The underwater tint lives in sky.ts.
import * as THREE from 'three/webgpu';
import { Fn, vec3, vec4, mix, pow, smoothstep, normalize, positionWorld, cameraPosition, mx_noise_float, mx_worley_noise_vec2, uniform, float } from 'three/tsl';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { seaStyle } from './palette';
import { crustSeaTint } from './crustLook';
import { worldMaterial, LOOK, PAL } from './material';

export interface SeaPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  readonly mesh: THREE.Mesh;
  dispose(): void;
}

export function createSea(app: App): SeaPart {
  const uDeep: any = uniform(new THREE.Color()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const uSky: any = uniform(new THREE.Color()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const uAlpha = uniform(0.8);        // looking straight down
  const uAlphaGraze = uniform(0.95);  // at grazing angles (more reflection)
  const uGlint = uniform(1);

  // Two colour graphs, swapped when the sea freezes or thaws (the material recompiles then anyway): the liquid path
  // carries only the glint noise, and the worley crack noise runs only on the frozen path.
  const seaColour = (ice: boolean) => Fn(() => {
    const p = positionWorld;
    const v = normalize(cameraPosition.sub(p));
    const fres = pow(float(1).sub(v.y.abs().clamp(0, 1)), 5).mul(0.85);
    const col = mix(vec3(uDeep), vec3(uSky), fres).toVar();
    if (ice) {
      // ice: faint polygonal cracks
      const w = mx_worley_noise_vec2(p.xz.mul(0.12));
      col.assign(mix(col, vec3(PAL.blush), smoothstep(0.08, 0.02, w.y.sub(w.x)).mul(0.35)));
    } else {
      // liquid: slow pale glint lines, stretched across the view like pixel-art water
      const g = mx_noise_float(vec3(p.x.mul(0.035), LOOK.time.mul(0.12), p.z.mul(0.35)));
      col.assign(mix(col, vec3(uSky), smoothstep(0.55, 0.7, g).mul(uGlint).mul(0.5)));
    }
    return vec4(col, mix(uAlpha, uAlphaGraze, fres));
  })();
  const liquidColour = seaColour(false);
  const iceColour = seaColour(true);
  const colorNode = liquidColour;

  const mat = worldMaterial({ kind: 'sea', colorNode, side: THREE.DoubleSide });
  mat.transparent = true;
  mat.depthWrite = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1; // after opaque terrain and creatures
  mesh.frustumCulled = false;
  app.scene.add(mesh);

  const tint = new THREE.Color();
  let key = '';
  return {
    mesh,
    update(_dt, t, inputs, patch) {
      const hasSea = (inputs.stats.seaCover ?? 1) > 0.005;
      mesh.visible = hasSea;
      if (!hasSea) return;
      // Frozen seas lie still; liquid ones bob a few millimetres so reflections shimmer.
      const bob = inputs.frozen ? 0 : Math.sin(t * 0.8) * 0.01;
      mesh.position.y = inputs.seaLevel + bob;
      mesh.scale.set(patch * 6.5, patch * 6.5, 1); // out under the terrain skirt; fog hides the rim

      const nitrogen = /nitrogen/i.test(inputs.world.solvent.name);
      // colours every frame (PAL follows the active world); material rebuild only when the depth-write mode changes
      // opacity follows seaStyle (liquid nitrogen clear, water translucent, ice opaque); colours from the palette roles
      const shallows = crustSeaTint(inputs);
      const s = seaStyle(inputs.world.solvent.name, inputs.frozen, inputs.world.solvent.solidSinks, shallows);
      const deep = uDeep.value as THREE.Color, sky = uSky.value as THREE.Color;
      if (inputs.frozen) {
        deep.copy(PAL.bone.value).lerp(PAL.haze.value, 0.35);
        sky.copy(PAL.skyHorizon.value);
        uAlpha.value = 1; uAlphaGraze.value = 1; uGlint.value = 0;
      } else if (nitrogen) {
        deep.copy(PAL.bone.value).lerp(PAL.blush.value, 0.4);
        sky.copy(PAL.skyHorizon.value);
        uAlpha.value = s.opacity; uAlphaGraze.value = Math.min(1, s.opacity + 0.45); uGlint.value = 0.6;
      } else {
        deep.copy(PAL.shadow.value).lerp(PAL.maroon.value, 0.3);
        if (shallows !== undefined) deep.lerp(tint.setHex(shallows), 0.6);   // the seabed's shallows
        sky.copy(PAL.haze.value).lerp(PAL.skyHorizon.value, 0.4);
        // seaStyle's opacity (0.62) looking down, a gentle fresnel rise to 0.85 at grazing: founders in the shallows stay visible
        uAlpha.value = s.opacity; uAlphaGraze.value = Math.max(s.opacity, 0.85); uGlint.value = 1;
      }
      const k = `${inputs.frozen}`;
      if (k !== key) {
        key = k;
        mat.depthWrite = inputs.frozen;
        mat.colorNode = inputs.frozen ? iceColour : liquidColour;
        mat.needsUpdate = true;
      }
    },
    dispose() {
      app.scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
