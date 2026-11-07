// Sky, star, lights and fog from the stats: dim and cold when starlight is low, warm when it is high.
// Underwater (camera below the sea surface) the whole scene takes the sea's tint and a short fog.
import * as THREE from 'three/webgpu';
import { uniform, mix, pow, clamp, positionWorldDirection } from 'three/tsl';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { seaStyle, skyStyle } from './palette';

export interface SkyPart {
  update(dt: number, inputs: VisualInputs, patch: number): void;
  /** Star disc, for picking the sky/star. */
  readonly starMesh: THREE.Mesh;
  /** Is the camera currently under the sea surface? */
  readonly underwater: boolean;
  dispose(): void;
}

export function createSky(app: App): SkyPart {
  const { scene, camera } = app;
  // Remove app.ts's placeholder lights and fog; this module owns them now.
  for (const c of [...scene.children]) if ((c as THREE.Light).isLight) scene.remove(c);
  scene.background = null;

  const uZenith = uniform(new THREE.Color(0x4f94d8));
  const uHorizon = uniform(new THREE.Color(0xcfe6ef));
  const up = clamp(positionWorldDirection.y, 0, 1);
  scene.backgroundNode = mix(uHorizon, uZenith, pow(up, 0.5));

  const fog = new THREE.Fog(0xcfe6ef, 60, 300);
  scene.fog = fog;

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(0.55, 0.7, 0.45).multiplyScalar(100);
  const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x554433, 0.6);
  scene.add(sun, sun.target, hemi);

  // The star as a flat disc far away; it follows the camera so it never gets closer.
  const starMat = new THREE.MeshBasicNodeMaterial({ color: 0xffffff, fog: false, depthWrite: false });
  const starMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 32), starMat);
  starMesh.frustumCulled = false;
  starMesh.renderOrder = -1;
  scene.add(starMesh);

  const STAR_DIST = 700;
  const sunDir = new THREE.Vector3(0.55, 0.7, 0.45).normalize();
  const tmp = new THREE.Color();
  let underwater = false;

  return {
    starMesh,
    get underwater() {
      return underwater;
    },
    update(_dt, inputs, patch) {
      const st = skyStyle(inputs.world.starType, inputs.light, inputs.stats.pressure ?? 1, inputs.stats.temperature ?? 15);
      underwater = camera.position.y < inputs.seaLevel && (inputs.stats.seaCover ?? 1) > 0.005;

      if (underwater) {
        const sea = seaStyle(inputs.world.solvent.name, inputs.frozen, inputs.world.solvent.solidSinks);
        tmp.setHex(sea.underwater);
        // Dim with the star so a dark world stays dark below the surface too.
        tmp.multiplyScalar(0.3 + 0.7 * st.brightness);
        uZenith.value.copy(tmp);
        uHorizon.value.copy(tmp);
        fog.color.copy(tmp);
        fog.near = 0.5;
        fog.far = sea.underwaterFar;
      } else {
        uZenith.value.setHex(st.zenith);
        uHorizon.value.setHex(st.horizon);
        fog.color.setHex(st.fog);
        fog.near = patch * st.fogNearFrac;
        fog.far = patch * st.fogFarFrac;
      }
      sun.color.setHex(st.starColour);
      sun.intensity = st.sunIntensity;
      hemi.color.setHex(st.zenith === 0 ? 0x888899 : st.horizon);
      hemi.groundColor.setHex(0x443c36);
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
