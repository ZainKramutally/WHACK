// Sky: white-family gradient on scene.backgroundNode + two pale moons (one large, one ~2.5× smaller), white on white.
// Each moon is a lit sphere: soft stepped terminator toward the sun, low-frequency maria, faint limb darkening, and an
// atmospheric fade toward the horizon haze. Pixel mode quantises the terminator and maria into bands.
import * as THREE from 'three/webgpu';
import { Fn, float, vec3, mix, smoothstep, positionWorldDirection, dot, normalize, floor, clamp, length, max, mx_noise_float } from 'three/tsl';
import { PALETTE } from './contracts';
import { PIXEL, bayer4, FOG } from './material';

const MOON_SUN = vec3(-0.62, 0.42, 0.66).normalize();
const c3 = (hex: number) => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };

function dirFrom(azDeg: number, elDeg: number) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

/** Composite one moon over `sky`. az/el in degrees from the hero camera's -Z, radius in degrees. */
function moon(d: any, sky: any, azDeg: number, elDeg: number, radiusDeg: number, seed: number, strength: number) {
  const P = dirFrom(azDeg, elDeg), sinR = Math.sin((radiusDeg * Math.PI) / 180);
  const Pn = vec3(P.x, P.y, P.z);
  const cosA = dot(d, Pn);
  const off = d.sub(Pn.mul(cosA));
  const r = length(off).div(sinR);                                   // 0 centre → 1 limb
  const inDisc = PIXEL ? r.lessThan(1).and(cosA.greaterThan(0)).select(float(1), float(0))
    : smoothstep(1.0, 0.985, r).mul(cosA.greaterThan(0).select(float(1), float(0)));
  const z = max(float(1).sub(r.mul(r)), 0).sqrt();
  const n = normalize(off.div(sinR).sub(Pn.mul(z)));                // visible hemisphere faces the viewer
  // terminator: the sun is off to the upper left (same side as the scene key), slightly behind the viewer, so the moons
  // read gibbous: maria on the lit face, a soft dark crescent on the right
  let lit: any = smoothstep(-0.12, 0.3, dot(n, MOON_SUN));
  if (PIXEL) lit = floor(lit.mul(4).add(0.5)).div(4);
  // maria: low-frequency noise on the sphere
  let maria: any = smoothstep(0.05, 0.35, mx_noise_float(n.mul(2.3).add(seed)).add(mx_noise_float(n.mul(5.1).add(seed * 3)).mul(0.35)));
  if (PIXEL) maria = floor(maria.mul(2).add(0.5)).div(2);
  const limb = mix(0.86, 1.0, z.pow(0.6));
  const bright = mix(c3(PALETTE.bone), c3(PALETTE.blush), maria.mul(0.28)).mul(limb);
  const dark = mix(c3(PALETTE.skyZenith), c3(PALETTE.blush), 0.35).mul(0.84);
  const body = mix(dark, bright, lit);
  // atmospheric fade: low moons sink into the haze
  const fade = smoothstep(-0.01, 0.3, d.y).mul(strength);
  return mix(sky, body, inDisc.mul(fade));
}

export function skyNode(): any {
  return Fn(() => {
    const d = normalize(positionWorldDirection);
    const y = d.y;
    let t: any = smoothstep(-0.02, 0.55, y);
    if (PIXEL) t = floor(t.mul(14).add(bayer4())).div(14);
    const col = mix(c3(FOG.haze), c3(FOG.horizon), smoothstep(0, 0.12, t)).toVar();
    col.assign(mix(col, c3(PALETTE.skyZenith), smoothstep(0.1, 1, t)));
    // large moon centre-top between the arch and the hero; small moon high right, clear of the hero cap
    col.assign(moon(d, col, 2.5, 17.5, 3.4, 3.1, 0.78));
    col.assign(moon(d, col, -29, 15.5, 1.8, 7.7, 0.82));
    return clamp(col, 0, 2);
  })();
}
