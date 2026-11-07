// Scene fog: height fog + distance haze. Colour goes fogColor (near/low) → haze (far/high) so far
// landforms melt into the same colour the sky ends in (aerial perspective sells scale).
import { Fn, float, mix, saturate, positionWorld, cameraPosition, fog, exp, max } from 'three/tsl';
import type { WorldUniforms } from '../contracts';

export function createFogNode(u: WorldUniforms, density: any) {
  const dist = Fn(() => positionWorld.sub(cameraPosition).length());
  const color = Fn(() => {
    const k = saturate(dist().div(450).add(positionWorld.y.div(260)));
    return mix(u.fogColor, u.haze, k.sqrt());
  });
  const factor = Fn(() => {
    const ground = exp(max(positionWorld.y, 0).mul(-0.02)); // 1 at ground → 0 high up
    const d = max(dist().sub(35), 0); // first ~35 m stay crisp
    const dd = density.mul(float(0.4).add(ground.mul(0.9))); // thicker near the ground
    return saturate(float(1).sub(exp(d.mul(dd).negate())));
  });
  return fog(color(), factor());
}
