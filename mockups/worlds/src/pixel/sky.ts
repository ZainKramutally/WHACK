// Pixel sky (§4.1): 4 flat horizontal bands from field steps 1 → 4, flat sun / moon discs with a 2 px halo ring,
// flat black eclipse disc with a 2 px white halo. No gradients, no corona rays.
import * as THREE from 'three/webgpu';
import { Fn, float, vec3, uniform, positionWorldDirection, normalize, dot, acos } from 'three/tsl';
import type { Composition } from '../contracts';
import type { PixelState } from './state';
import { INK, SKY_EDGES, WHITE } from './palette';

export function createPixelSky(st: PixelState, comp: Composition) {
  const sd = new THREE.Vector3(...comp.sunDir).normalize();
  const sunDir = uniform(sd);
  const upRef = Math.abs(sd.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const bx = new THREE.Vector3().crossVectors(upRef, sd).normalize();
  const by = new THREE.Vector3().crossVectors(sd, bx).normalize();
  const basisX = uniform(bx), basisY = uniform(by);
  const lit = (hex: number) => vec3(...new THREE.Color().setHex(hex, THREE.SRGBColorSpace).toArray());
  const f = st.field;

  return Fn(() => {
    const d = normalize(positionWorldDirection);
    const e = d.y;
    const sk = st.sky;
    let col: any = sk[0];
    col = e.lessThan(SKY_EDGES[2]).select(sk[1], col);
    col = e.lessThan(SKY_EDGES[1]).select(sk[2], col);
    col = e.lessThan(SKY_EDGES[0]).select(sk[3], col);

    const ang = acos(dot(d, sunDir).clamp(-1, 1));
    const px = st.pixAngle;
    // disc + 2 px ring helper: ring first, disc over it
    const disc = (a: any, r: any, inner: any, ring: any, base: any) => {
      let c = a.lessThan(r.add(px.mul(2))).select(ring, base);
      c = a.lessThan(r).select(inner, c);
      return c;
    };
    if (comp.skyEvent === 'eclipse') {
      col = disc(ang, float(0.088), lit(INK), lit(WHITE), col);
    } else {
      col = disc(ang, float(0.031), f[5], sk[3], col);
      if (comp.skyEvent === 'moons') {
        const m2 = normalize(sunDir.add(basisX.mul(0.55)).add(basisY.mul(0.12)));
        const a2 = acos(dot(d, m2).clamp(-1, 1));
        col = disc(a2, float(0.05), f[4], sk[2], col);
      }
    }
    return col;
  })();
}
