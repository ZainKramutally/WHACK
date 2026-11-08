// Sky, star, lights and fog from the stats, in the Red World look: a white zenith over a lilac horizon (the active
// palette, dimmed and tinted by the star through PAL_LIT/LOOK), two pale moons (decoration, lit by the same star, never
// over the star disc), and the real star disc along LOOK.lightDir, coloured by its spectral class and sized by `light`.
// Underwater (camera below the sea surface) the sky, the scene fog and the world material's air all take the sea's
// tint and a short fog. It also writes the underwater overlay's state for post.ts (LOOK.underwater, waterTint, waterClear,
// waterDepth): an eased gate that is on only over a liquid sea, from just above the surface (the waterline window) down.
import * as THREE from 'three/webgpu';
import { Fn, float, vec3, mix, smoothstep, positionWorldDirection, dot, normalize, floor, clamp, length, max, mx_noise_float, uniform } from 'three/tsl';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { seaStyle, skyStyle } from './palette';
import { LOOK, PAL_LIT, PIXEL, bayer4 } from './material';
import { easeSubmersion, stepSubmersion, submersionTarget } from './underwater';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

export interface SkyPart {
  update(dt: number, inputs: VisualInputs, patch: number): void;
  /** Star disc, for picking the sky/star. */
  readonly starMesh: THREE.Mesh;
  /** Is the camera currently under the sea surface? */
  readonly underwater: boolean;
  dispose(): void;
}

// The moons are declared decoration: no world config or source models them (render-only illustration, like the sky and fog in CLAUDE.md's honesty box).
/** Fixed moon directions (world space), each well clear of the star (LOOK.lightDir), so a moon never covers it. */
const MOONS: { dir: [number, number, number]; radiusDeg: number; seed: number; strength: number }[] = [
  { dir: [0.255, 0.174, -0.951], radiusDeg: 5, seed: 3.1, strength: 0.78 },   // ~10° up: in frame at walking pitch
  { dir: [0.79, 0.276, -0.553], radiusDeg: 2.4, seed: 7.7, strength: 0.82 },
];
/** The overlay grade reaches full depth at this fraction of the solvent's underwater fog distance (water 14 m, N₂ 36 m). */
const GRADE_DEPTH_FRAC = 0.4;

/** Composite one moon over `sky`: a lit sphere with a stepped terminator toward the star, maria and a horizon fade. */
function moon(d: N, sky: N, under: N, m: (typeof MOONS)[number]): N {
  const P = new THREE.Vector3(...m.dir).normalize();
  const sinR = Math.sin((m.radiusDeg * Math.PI) / 180);
  const Pn = vec3(P.x, P.y, P.z);
  const cosA = dot(d, Pn);
  const off = d.sub(Pn.mul(cosA));
  const r = length(off).div(sinR);                                    // 0 centre → 1 limb
  const front = cosA.greaterThan(0).select(float(1), float(0));
  const inDisc = PIXEL ? r.lessThan(1).select(float(1), float(0)).mul(front) : smoothstep(1.0, 0.985, r).mul(front);
  const z = max(float(1).sub(r.mul(r)), 0).sqrt();
  const n = normalize(off.div(sinR).sub(Pn.mul(z)));                  // visible hemisphere faces the viewer
  let lit: N = smoothstep(-0.12, 0.3, dot(n, LOOK.lightDir));         // lit by the same star as the land
  if (PIXEL) lit = floor(lit.mul(4).add(0.5)).div(4);
  let maria: N = smoothstep(0.05, 0.35, mx_noise_float(n.mul(2.3).add(m.seed)).add(mx_noise_float(n.mul(5.1).add(m.seed * 3)).mul(0.35)));
  if (PIXEL) maria = floor(maria.mul(2).add(0.5)).div(2);
  const limb = mix(0.86, 1.0, z.pow(0.6));
  const bright = mix(vec3(PAL_LIT.bone), vec3(PAL_LIT.blush), maria.mul(0.28)).mul(limb);
  const dark = mix(vec3(PAL_LIT.skyZenith), vec3(PAL_LIT.blush), 0.35).mul(0.84);
  const body = mix(dark, bright, lit);
  const fade = smoothstep(-0.01, 0.3, d.y).mul(m.strength).mul(float(1).sub(under));
  return mix(sky, body, inDisc.mul(fade));
}

export function createSky(app: App): SkyPart {
  const { scene, camera } = app;
  // Remove app.ts's placeholder lights and fog; this module owns them now.
  for (const c of [...scene.children]) if ((c as THREE.Light).isLight) scene.remove(c);
  scene.background = null;

  const uZenith: N = uniform(new THREE.Color(0xeef0f4));
  const uHorizon: N = uniform(new THREE.Color(0xf3eef8));
  const uHaze: N = uniform(new THREE.Color(0xe4daef));
  const uUnder = uniform(0);
  scene.backgroundNode = Fn(() => {
    const d = normalize(positionWorldDirection);
    let t: N = smoothstep(-0.02, 0.55, d.y);
    if (PIXEL) t = floor(t.mul(14).add(bayer4())).div(14);           // dither only in the sky
    const col = mix(vec3(uHaze), vec3(uHorizon), smoothstep(0, 0.12, t)).toVar();
    col.assign(mix(col, vec3(uZenith), smoothstep(0.1, 1, t)));
    for (const m of MOONS) col.assign(moon(d, col, uUnder, m));
    return clamp(col, 0, 2);
  })();

  const fog = new THREE.Fog(0xe4daef, 60, 300);                      // for any non-world material (world material does its own air)
  scene.fog = fog;

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  const hemi = new THREE.HemisphereLight(0xeef0f4, 0x5c0a1e, 0.6);
  scene.add(sun, sun.target, hemi);

  // The star as a flat disc far away along the key light; it follows the camera so it never gets closer.
  const starMat = new THREE.MeshBasicNodeMaterial({ color: 0xffffff, fog: false, depthWrite: false });
  const starMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 32), starMat);
  starMesh.frustumCulled = false;
  starMesh.renderOrder = -1;
  scene.add(starMesh);

  const STAR_DIST = 700;
  const sunDir = new THREE.Vector3();
  const tmp = new THREE.Color();
  let underwater = false;
  let submersion = 0; // the overlay's linear ramp (underwater.ts); LOOK.underwater is its eased value

  return {
    starMesh,
    get underwater() {
      return underwater;
    },
    update(dt, inputs, patch) {
      const st = skyStyle(inputs.world.starType, inputs.light, inputs.stats.pressure ?? 1, inputs.stats.temperature ?? 15);
      const hasSea = (inputs.stats.seaCover ?? 1) > 0.005;
      underwater = camera.position.y < inputs.seaLevel && hasSea;
      sunDir.copy(LOOK.lightDir.value).normalize();

      const sea = seaStyle(inputs.world.solvent.name, inputs.frozen, inputs.world.solvent.solidSinks);
      const nitrogen = /nitrogen/i.test(inputs.world.solvent.name);
      // the tint in the look's palette (as sea.ts colours the surface): ice pale, nitrogen pale-clear, water violet-oxblood
      if (inputs.frozen) tmp.copy(PAL_LIT.bone.value).multiplyScalar(0.55);
      else if (nitrogen) tmp.copy(PAL_LIT.blush.value).lerp(PAL_LIT.shadow.value, 0.45);
      else tmp.copy(PAL_LIT.shadow.value).lerp(PAL_LIT.crimson.value, 0.3);

      // Overlay state for post.ts. Liquid only: a frozen sea is walkable ice, so the gate drops to 0 at once.
      const depth = inputs.seaLevel - camera.position.y;
      const liquid = hasSea && !inputs.frozen;
      submersion = liquid ? stepSubmersion(submersion, submersionTarget(depth, liquid), dt) : 0;
      LOOK.underwater.value = easeSubmersion(submersion);
      // water grades toward the fog's violet-oxblood; liquid nitrogen toward a paler, clear icy lilac
      LOOK.waterTint.value.copy(tmp);
      if (nitrogen) LOOK.waterTint.value.lerp(PAL_LIT.haze.value, 0.5).lerp(PAL_LIT.bone.value, 0.3);
      LOOK.waterClear.value = nitrogen ? 1 : 0;
      LOOK.waterDepth.value = Math.min(1, Math.max(0, depth / (sea.underwaterFar * GRADE_DEPTH_FRAC)));

      if (underwater) {
        uZenith.value.copy(tmp);
        uHorizon.value.copy(tmp);
        uHaze.value.copy(tmp);
        uUnder.value = 1;
        fog.color.copy(tmp);
        fog.near = 0.5;
        fog.far = sea.underwaterFar;
        // The world material's air (updateLook ran first this frame): short, tinted, ~95% at underwaterFar.
        LOOK.fogColor.value.copy(tmp);
        LOOK.fogStart.value = 0.5;
        LOOK.fogDist.value = sea.underwaterFar / 3;
        LOOK.hazeAmount.value = 0;
      } else {
        uZenith.value.copy(LOOK.skyZenith.value);
        uHorizon.value.copy(LOOK.skyHorizon.value);
        uHaze.value.copy(PAL_LIT.haze.value);
        uUnder.value = 0;
        fog.color.copy(LOOK.fogColor.value);
        // linear fog for the Standard materials (fauna), matched to the world material's exp air: starts where it
        // starts and is ~92% by fogStart + 2.5 e-folds
        fog.near = LOOK.fogStart.value;
        fog.far = LOOK.fogStart.value + 2.5 * LOOK.fogDist.value;
        LOOK.hazeAmount.value = 0.42;
      }
      sun.color.setHex(st.starColour);
      sun.intensity = st.sunIntensity;
      hemi.color.copy(LOOK.skyHorizon.value);
      hemi.groundColor.copy(PAL_LIT.crimson.value);
      hemi.intensity = st.ambientIntensity;
      sun.position.copy(camera.position).addScaledVector(sunDir, 100);
      sun.target.position.copy(camera.position);

      starMesh.visible = !underwater;
      starMesh.position.copy(camera.position).addScaledVector(sunDir, STAR_DIST);
      starMesh.quaternion.copy(camera.quaternion);
      starMesh.scale.setScalar(STAR_DIST * 0.045 * st.starSize);
      starMat.color.setHex(st.starColour).multiplyScalar(1 + 1.5 * st.brightness);
    },
    dispose() {
      scene.remove(sun, sun.target, hemi, starMesh);
      starMesh.geometry.dispose();
      starMat.dispose();
      scene.backgroundNode = null;
    },
  };
}
