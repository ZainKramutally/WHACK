// Sea surface from the environment (environmentFrom → sea): a flat level from seaCover, coloured by solvent and
// chemistry. Shallow water shows the bed, depth absorbs toward the deep colour, grazing views reflect the horizon,
// ripples flash stepped sun glints. Frozen seas are opaque cracked ice. Only submerged cells are meshed.
import * as THREE from 'three/webgpu';
import {
  Fn, attribute, vec3, float, mix, exp, normalize, cameraPosition, positionWorld, pow, max, dot, step, smoothstep,
  mx_noise_vec3, mx_worley_noise_vec2, mx_noise_float, vec2, floor,
} from 'three/tsl';
import { PALETTE } from './contracts';
import { ENV } from './env/active';
import { seaLevelFor } from './env/sealevel';
import { heightAt } from './field';
import { worldMaterial, groundColor, U, PIXEL } from './material';
import { axis } from './terrain';

const c3 = (hex: number) => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };

export const SEA_LEVEL = seaLevelFor(ENV.sea.cover);

export function buildSea(): any | null {
  if (!Number.isFinite(SEA_LEVEL)) return null;
  const level = SEA_LEVEL;
  U.seaLevel.value = level;
  const xs = axis(4200), zs = axis(4200);
  const NX = xs.length, NZ = zs.length;
  const depth = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) depth[j * NX + i] = level - heightAt(xs[i], zs[j]);
  const pos: number[] = [], dep: number[] = [], idx: number[] = [], map = new Int32Array(NX * NZ).fill(-1);
  const vert = (i: number, j: number) => {
    const k = j * NX + i;
    if (map[k] < 0) { map[k] = pos.length / 3; pos.push(xs[i], level, zs[j]); dep.push(Math.max(0, depth[k])); }
    return map[k];
  };
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const k = j * NX + i;
    if (Math.max(depth[k], depth[k + 1], depth[k + NX], depth[k + NX + 1]) <= -0.5) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  g.setIndex(idx);

  const S = ENV.sea;
  const colorNode = Fn(() => {
    const P = positionWorld;
    const dpt = attribute('aDepth', 'float');
    const V = normalize(cameraPosition.sub(P));
    const fres = pow(float(1).sub(max(V.y, 0)), 5).mul(S.gloss);
    if (S.frozen) {
      // opaque sea ice: pale, with darker pressure cracks and a faint sky sheen at grazing angles
      const w = mx_worley_noise_vec2(P.xz.mul(0.09));
      const crack = smoothstep(0.08, 0.02, w.y.sub(w.x));
      const ice = mix(c3(PALETTE.bone), c3(PALETTE.skyHorizon), 0.35).toVar();
      ice.assign(mix(ice, c3(PALETTE.crimson), crack.mul(0.6)));
      return mix(ice, c3(PALETTE.haze), fres.mul(0.4));
    }
    const k = float(1).sub(exp(dpt.div(-S.clarityM)));
    const bed = groundColor(P.xz).mul(0.55);
    const body = mix(mix(bed, c3(S.shallow), 0.75), c3(S.deep), k.mul(0.85).add(0.15)).toVar();
    // the sky mirror is broken into horizontal ripple streaks (stretched noise): that is what makes water read in pixels
    const sn = mx_noise_float(vec2(P.x.mul(0.018), P.z.mul(0.32).add(U.time.mul(0.08)))).add(mx_noise_float(vec2(P.x.mul(0.06), P.z.mul(1.1))).mul(0.35));
    let streak: any = smoothstep(-0.15, 0.25, sn);
    if (PIXEL) streak = floor(streak.mul(2).add(0.5)).div(2);
    const refl = mix(c3(PALETTE.haze), c3(PALETTE.skyZenith), smoothstep(0.02, 0.35, V.y));
    body.assign(mix(body, refl, fres.mul(mix(0.25, 0.95, streak))));
    const edge = float(1).sub(smoothstep(0.04, 0.3, dpt));
    body.assign(mix(body, c3(PALETTE.bone), edge.mul(0.7)));
    // ripples: a slow noise normal; glints step on where the sun's half-vector lines up
    const n = mx_noise_vec3(vec3(P.x.mul(0.22), U.time.mul(0.25), P.z.mul(0.3)));
    const Np = normalize(vec3(n.x.mul(0.35), 1, n.z.mul(0.35)));
    const H = normalize(U.lightDir.add(V));
    const sp = pow(max(dot(Np, H), 0), 120);
    const near = float(1).sub(smoothstep(150, 1400, P.sub(cameraPosition).length()));
    return mix(body, vec3(1.8, 1.75, 1.7), step(0.5, sp).mul(near).mul(S.gloss));
  })();
  const m = new THREE.Mesh(g, worldMaterial({ colorNode, bounce: false }));
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.name = 'sea';
  return m;
}
