// Air: sparse drifting pale motes (1 internal px each) + a few cyan glowing spores (HDR → bloom).
// Each cloud is a box that wraps around the camera (mod in the vertex stage), so the air travels with the player anywhere
// in the walkable world; heights stay relative to the camera.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, vec3, sin, cos, float, positionWorld, cameraPosition, exp, mix, dot, mod } from 'three/tsl';
import { PALETTE } from './contracts';
import { mulberry32 } from './rng';
import { U } from './material';

/** lo: box corner relative to the camera; size: box extent (m). Points fill it with a bias toward the ground. */
function cloud(n: number, seed: number, lo: [number, number, number], size: [number, number, number], glow: boolean): any {
  const rng = mulberry32(seed);
  const pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rng() * size[0]; pos[i * 3 + 1] = Math.pow(rng(), 2) * size[1]; pos[i * 3 + 2] = rng() * size[2];
    ph[i] = rng() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.PointsNodeMaterial();
  const a = attribute('aPhase', 'float'), t = U.time.mul(0.12);
  const drift = vec3(sin(t.add(a)).mul(3), sin(t.mul(0.7).add(a.mul(1.7))).mul(1.5).add(sin(t.mul(0.3)).mul(0.5)), cos(t.mul(0.8).add(a)).mul(3));
  const L = vec3(...lo), S = vec3(...size);
  // wrap: world = camera + lo + mod(p - camera - lo, size)
  m.positionNode = cameraPosition.add(L).add(mod(positionLocal.add(drift).sub(cameraPosition).sub(L), S));
  const dist = positionWorld.sub(cameraPosition).length();
  const fog = float(1).sub(exp(dist.div(U.fogDist).negate().mul(3)));
  const c = new THREE.Color(glow ? PALETTE.glow : PALETTE.blush);
  let col: any = vec3(c.r, c.g, c.b);
  if (glow) col = col.div(dot(col, vec3(0.2126, 0.7152, 0.0722))).mul(U.glowK.mul(1.2));
  m.colorNode = mix(col, vec3(U.fogColor), fog);
  return new THREE.Points(g, m);
}

export function buildAtmos(): any {
  const g = new THREE.Group();
  g.add(cloud(2600, 31, [-130, -6, -135], [260, 50, 270], false));
  g.add(cloud(120, 32, [-70, -2, -80], [140, 24, 160], true));
  for (const o of g.children) o.frustumCulled = false;
  return g;
}
