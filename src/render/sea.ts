// The sea: a plane at seaLevel in the world material (kind 'sea'), liquid or frozen exactly per inputs.frozen.
//   carbon water: blue by its own physics (palette WATER ramp, Braun & Smirnov 1993): navy → ocean blue → cyan with falling
//     depth, the seabed mineral's tint showing through where it is a few metres deep (crustSeaTint), a ≤ 12% crust nudge on
//     the open body, and a pale mirror of the sky at grazing angles, with slow pale glint lines. Depth comes from a baked
//     height texture of the patch (terrain.height), so it is the real water depth over the seabed;
//   liquid nitrogen: clear and pale (low alpha), barely tinted, so life in it stays visible;
//   frozen: opaque pale ice (bone/haze) with faint polygonal cracks, lying still.
// Hidden when there is no sea. The underwater tint lives in sky.ts.
import * as THREE from 'three/webgpu';
import { Fn, vec3, vec4, mix, pow, smoothstep, normalize, positionWorld, cameraPosition, mx_noise_float, mx_worley_noise_vec2, uniform, float, texture, vec2, exp, max } from 'three/tsl';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { seaStyle, waterAtDepth } from './palette';
import { crustSeaTint, crustWaterNudge } from './crustLook';
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
  // liquid-water depth ramp (colours per depth, set each frame) and the baked seabed heights
  const uShallow: any = uniform(new THREE.Color()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const uMid: any = uniform(new THREE.Color()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const uBed: any = uniform(new THREE.Color()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const uBedAmt = uniform(0);
  const uPatch = uniform(256);
  // half-float: filterable on every WebGPU/WebGL2 device (float32 linear filtering is an optional feature)
  const RES = 64;
  const heights = new Uint16Array(RES * RES);
  const heightTex = new THREE.DataTexture(heights, RES, RES, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;

  // Two colour graphs, swapped when the sea freezes or thaws (the material recompiles then anyway): the liquid path
  // carries only the glint noise, and the worley crack noise runs only on the frozen path.
  const seaColour = (ice: boolean) => Fn(() => {
    const p = positionWorld;
    const v = normalize(cameraPosition.sub(p));
    const fres = pow(float(1).sub(v.y.abs().clamp(0, 1)), 5).mul(0.85);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = vec3(uDeep);
    if (!ice) {
      // water depth under this pixel: plane height minus seabed height (open sea beyond the patch counts as deep)
      const q = p.xz.div(uPatch).add(0.5);
      const inside = smoothstep(0.0, 0.02, q.x).mul(smoothstep(1.0, 0.98, q.x)).mul(smoothstep(0.0, 0.02, q.y)).mul(smoothstep(1.0, 0.98, q.y));
      const bed = texture(heightTex, vec2(q.x, q.y)).r;
      const depth = mix(float(200), max(p.y.sub(bed), 0), inside);
      // cyan at the waterline → ocean blue → uDeep (navy-leaning) with depth, then the seabed tint through thin water
      const ramp = mix(vec3(uShallow), vec3(uMid), float(1).sub(exp(depth.negate().div(5))));
      const deeper = mix(ramp, vec3(uDeep), float(1).sub(exp(depth.negate().div(14))));
      body = mix(deeper, vec3(uBed), exp(depth.negate().div(2)).mul(uBedAmt));
    }
    const col = mix(body, vec3(uSky), fres).toVar();
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

  // Re-bake the seabed heights (64² cell centres) only when the VisualInputs terrain object changes (it is memoised while the
  // sampler and state are unchanged), at most every 0.5 s during the build and every 1 s after it.
  let bakedFor: unknown = null, bakedPatch = 0, bakeAt = -10;
  function bake(inputs: VisualInputs, patch: number, t: number) {
    const f = inputs.terrain.height;
    if (!f || (inputs.terrain === bakedFor && patch === bakedPatch)) return;
    if (t >= bakeAt && t - bakeAt < (inputs.buildProgress < 1 ? 0.5 : 1)) return;
    bakedFor = inputs.terrain; bakedPatch = patch; bakeAt = t;
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) heights[j * RES + i] = THREE.DataUtils.toHalfFloat(f(((i + 0.5) / RES - 0.5) * patch, ((j + 0.5) / RES - 0.5) * patch));
    heightTex.needsUpdate = true;
  }
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
      const s = seaStyle(inputs.world.solvent.name, inputs.frozen, inputs.world.solvent.solidSinks, shallows, crustWaterNudge(inputs));
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
        // blue by its own physics; minerals reach it as a ≤ 12% body nudge and as the seabed showing in the shallows
        const nudge = crustWaterNudge(inputs);
        deep.setHex(waterAtDepth(60, undefined, nudge));
        uShallow.value.setHex(waterAtDepth(0.5));
        uMid.value.setHex(waterAtDepth(14, undefined, nudge));
        uBed.value.setHex(shallows ?? 0);
        uBedAmt.value = shallows !== undefined ? 0.8 : 0;
        uPatch.value = patch;
        bake(inputs, patch, t);
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
      heightTex.dispose();
    },
  };
}
