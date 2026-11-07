// Air: sparse drifting pale motes (1 internal px each) + a few cyan glowing spores (HDR → bloom).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, vec3, sin, cos, float, positionWorld, cameraPosition, exp, mix, dot } from 'three/tsl';
import { PALETTE } from './contracts';
import { mulberry32 } from './rng';
import { heightAt } from './field';
import { U } from './material';

function cloud(n: number, seed: number, box: [number, number, number, number, number, number], glow: boolean): any {
  const rng = mulberry32(seed);
  const pos = new Float32Array(n * 3), ph = new Float32Array(n);
  const [x0, x1, y0, y1, z0, z1] = box;
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * (x1 - x0), z = z0 + Math.pow(rng(), 1.6) * (z1 - z0);
    pos[i * 3] = x; pos[i * 3 + 1] = heightAt(x, z) + y0 + Math.pow(rng(), 2) * (y1 - y0); pos[i * 3 + 2] = z;
    ph[i] = rng() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.PointsNodeMaterial();
  const a = attribute('aPhase', 'float'), t = U.time.mul(0.12);
  m.positionNode = positionLocal.add(vec3(sin(t.add(a)).mul(3), sin(t.mul(0.7).add(a.mul(1.7))).mul(1.5).add(sin(t.mul(0.3)).mul(0.5)), cos(t.mul(0.8).add(a)).mul(3)));
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
  g.add(cloud(900, 31, [-110, 110, 0.5, 45, -260, 2], false));
  g.add(cloud(70, 32, [-60, 70, 1, 22, -160, -6], true));
  for (const o of g.children) o.frustumCulled = false;
  return g;
}
