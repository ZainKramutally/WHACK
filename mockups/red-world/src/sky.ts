// Sky: white-family gradient on scene.backgroundNode + one huge, low-contrast pale ringed planet (white on white).
import * as THREE from 'three/webgpu';
import { Fn, float, vec2, vec3, mix, smoothstep, positionWorldDirection, dot, normalize, cross, floor, clamp, length, max } from 'three/tsl';
import { PALETTE } from './contracts';
import { PIXEL, bayer4 } from './material';

const c3 = (hex: number) => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };

function dirFrom(azDeg: number, elDeg: number) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

export function skyNode(): any {
  const P = dirFrom(7, 17); // planet centre: upper-left, away from the hero
  const R = (6 * Math.PI) / 180;
  const T1 = new THREE.Vector3().crossVectors(P, new THREE.Vector3(0, 1, 0)).normalize();
  const T2 = new THREE.Vector3().crossVectors(T1, P).normalize();
  const tilt = 0.32;
  const r1 = T1.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(T2, Math.sin(tilt));
  const r2 = T2.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(T1, -Math.sin(tilt));
  const L = new THREE.Vector3(-0.62, 0.5, -0.6).normalize();

  return Fn(() => {
    const d = normalize(positionWorldDirection);
    const y = d.y;
    let t: any = smoothstep(-0.02, 0.55, y);
    if (PIXEL) t = floor(t.mul(14).add(bayer4())).div(14);
    const col = mix(c3(PALETTE.haze), c3(PALETTE.skyHorizon), smoothstep(0, 0.12, t)).toVar();
    col.assign(mix(col, c3(PALETTE.skyZenith), smoothstep(0.1, 1, t)));

    // planet: tangent-plane coords around P (angular radians, small-angle)
    const Pn = vec3(P.x, P.y, P.z);
    const cosA = dot(d, Pn);
    const off = d.sub(Pn.mul(cosA));
    const u = dot(off, vec3(r1.x, r1.y, r1.z)), w = dot(off, vec3(r2.x, r2.y, r2.z));
    const rad = length(vec2(dot(off, vec3(T1.x, T1.y, T1.z)), dot(off, vec3(T2.x, T2.y, T2.z))));
    const inDisc = smoothstep(Math.sin(R) + 0.002, Math.sin(R) - 0.002, rad).mul(cosA.greaterThan(0));
    // sphere normal for a soft terminator
    const z = max(float(Math.sin(R)).mul(Math.sin(R)).sub(rad.mul(rad)), 0).sqrt().div(Math.sin(R));
    const nx = off.div(Math.sin(R));
    const sn = normalize(nx.add(Pn.mul(z)));
    const lamb = clamp(dot(sn, vec3(L.x, L.y, L.z)).mul(0.5).add(0.5), 0, 1);
    let lit: any = lamb;
    if (PIXEL) lit = floor(lamb.mul(4)).div(4);
    const planet = mix(c3(PALETTE.skyZenith).mul(0.86), c3(PALETTE.skyHorizon).mul(1.0), lit);
    // thin ring: an ellipse in the tilted frame; the back half hides behind the disc
    const er = length(vec2(u, w.div(0.2)));
    const band = smoothstep(Math.sin(R) * 1.42, Math.sin(R) * 1.47, er).mul(smoothstep(Math.sin(R) * 1.78, Math.sin(R) * 1.7, er))
      .sub(smoothstep(Math.sin(R) * 1.56, Math.sin(R) * 1.58, er).mul(smoothstep(Math.sin(R) * 1.62, Math.sin(R) * 1.6, er)).mul(0.7));
    const behind = inDisc.mul(w.greaterThan(0));
    const ring = clamp(band, 0, 1).mul(cosA.greaterThan(0)).mul(behind.oneMinus());
    col.assign(mix(col, planet, inDisc));
    col.assign(mix(col, col.mul(vec3(0.89, 0.88, 0.91)), ring));
    return col;
  })();
}

