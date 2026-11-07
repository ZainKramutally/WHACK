// Sky: gradient skyTop → skyHorizon → haze band, sun disc, eclipse (black disc + spiky corona) or moons.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec3, mix, smoothstep, saturate, positionWorldDirection, dot, cross, normalize,
  atan, sin, cos, fract, floor, abs, max, min, exp, acos, uniform,
} from 'three/tsl';
import type { Composition, WorldUniforms } from '../contracts';

const TAU = Math.PI * 2;
const hash1 = (x: any) => fract(sin(x.mul(127.1).add(311.7)).mul(43758.5453));

export function createSkyNode(u: WorldUniforms, comp: Composition) {
  const sd = new THREE.Vector3(...comp.sunDir).normalize();
  const sunDir = uniform(sd);
  // basis perpendicular to the sun direction (for corona azimuth)
  const upRef = Math.abs(sd.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const bx = new THREE.Vector3().crossVectors(upRef, sd).normalize();
  const by = new THREE.Vector3().crossVectors(sd, bx).normalize();
  const basisX = uniform(bx), basisY = uniform(by);

  return Fn(() => {
    const d = normalize(positionWorldDirection);
    const e = d.y;
    // base gradient
    const t = saturate(e.mul(1.15)).pow(0.65);
    let col: any = mix(u.skyHorizon, u.skyTop, t);
    // haze band hugging the horizon (and everything below it) so the sky meets the far fog exactly
    const band = exp(max(e, 0).mul(-7.0));
    col = mix(col, u.haze, saturate(band.mul(0.85).add(e.lessThan(0).select(1.0, 0.0))));

    const s = dot(d, sunDir);
    const ang = acos(s.clamp(-1, 1)); // angular distance to the sun/eclipse centre

    if (comp.skyEvent === 'eclipse') {
      const R = float(0.052); // disc angular radius (rad)
      // azimuth around the sun axis
      const az = atan(dot(d, basisY), dot(d, basisX)); // -π..π
      const x = az.div(TAU).add(0.5);
      const r = ang.sub(R).max(0).div(R); // radial distance in disc radii (0 at the limb)
      // two interleaved ray sets with per-ray length and slow shimmer
      const rays = (n: number, seed: number, lenBase: number, lenVar: number, wBase: number) => {
        const xi = x.mul(n);
        const id = floor(xi).add(seed);
        const f = fract(xi).sub(0.5).abs().mul(2); // 0 centre → 1 gap
        const len = float(lenBase).add(hash1(id).mul(lenVar)).mul(float(1).add(sin(u.time.mul(0.35).add(id.mul(2.3))).mul(0.18)));
        const k = saturate(float(1).sub(r.div(len))); // fade along length
        const w = float(wBase).mul(k.add(0.04)); // taper: rays get sharper towards the tip
        return saturate(float(1).sub(f.div(w.max(0.001)))).mul(k.pow(0.8));
      };
      const rayA = rays(11, 3.0, 1.8, 3.4, 0.55);
      const rayB = rays(7, 19.0, 1.2, 2.2, 0.4);
      const glow = exp(r.mul(-2.2)).mul(0.55);
      const corona = saturate(max(rayA, rayB.mul(0.8)).add(glow)).mul(smoothstep(-0.01, 0.0, ang.sub(R)));
      const ring = smoothstep(0.075, 0.0, abs(ang.sub(R.mul(1.06))).div(R)).mul(0.95);
      const white = vec3(1.0, 0.99, 0.96);
      col = mix(col, white, saturate(corona.add(ring)));
      col = mix(col, vec3(0.045, 0.038, 0.034), smoothstep(R.add(0.002), R.sub(0.002), ang));
    } else {
      // sun disc (HDR a touch above 1 so only it blooms)
      const sunCol = mix(u.haze, vec3(1, 0.97, 0.9), 0.7);
      const disc = smoothstep(0.034, 0.028, ang);
      const halo = exp(ang.mul(-9.0)).mul(0.22);
      col = col.add(sunCol.mul(halo));
      col = mix(col, sunCol.mul(1.6), disc);
      if (comp.skyEvent === 'moons') {
        const m2 = normalize(sunDir.add(basisX.mul(0.55)).add(basisY.mul(0.12)));
        const a2 = acos(dot(d, m2).clamp(-1, 1));
        col = mix(col, mix(u.skyHorizon, vec3(1), 0.7), smoothstep(0.05, 0.045, a2).mul(0.9));
        col = mix(col, mix(u.skyHorizon, vec3(1), 0.55), smoothstep(0.034, 0.03, ang).mul(0.9));
      }
    }
    return col;
  })();
}
