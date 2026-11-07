// Sparse drifting particles: frost dust (snow), pink glitter near glow flora, spores (life), ash (heat).
import * as THREE from 'three/webgpu';
import { attribute, float, vec2, vec3, uniform, sin, cos, smoothstep, length, uv, mix, saturate, color } from 'three/tsl';
import type { WorldContext } from '../contracts';

interface Kind {
  name: string; n: number; box: [number, number, number]; drift: [number, number, number]; size: number;
  hue: any; hdr: number; additive: boolean; flicker?: number; gate: (c: WorldContext) => number; forward: number;
}

const KINDS: Kind[] = [
  { name: 'frost', n: 380, box: [90, 24, 110], drift: [0.35, -0.5, 0.2], size: 0.07, hue: [0.9, 0.97, 1.0], hdr: 0.9, additive: true, forward: 0.4, gate: (c) => c.derived.snow },
  { name: 'spark', n: 240, box: [44, 6, 56], drift: [0.1, 0.25, 0.05], size: 0.09, hue: [1.0, 0.25, 0.55], hdr: 2.2, additive: true, flicker: 1, forward: 0.45, gate: (c) => c.derived.niches.lanternCups },
  { name: 'spore', n: 200, box: [60, 8, 70], drift: [0.1, 0.25, 0.08], size: 0.1, hue: [0.85, 1.0, 0.7], hdr: 1.4, additive: true, flicker: 0.5, forward: 0.4, gate: (c) => c.derived.life * (1 - c.derived.snow) * 0.22 },
  { name: 'ash', n: 220, box: [110, 14, 130], drift: [1.4, -0.25, 0.5], size: 0.1, hue: [0.2, 0.22, 0.22], hdr: 1, additive: false, forward: 0.4, gate: (c) => THREE.MathUtils.smoothstep(c.uniforms.heat.value, 0.55, 0.95) },
];

export function buildMotes(ctx: WorldContext) {
  const q = ctx.quality === 'low' ? 0.5 : 1;
  const out: { mesh: any; kind: Kind; n: number; origin: any; box: any }[] = [];
  const rng = ctx.rng('flora:motes');
  for (const k of KINDS) {
    const n = Math.round(k.n * q);
    const geo = new THREE.PlaneGeometry(1, 1);
    const seed = new Float32Array(n * 3), seed2 = new Float32Array(n * 3);
    for (let i = 0; i < seed.length; i++) { seed[i] = rng(); seed2[i] = rng(); }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3));
    geo.setAttribute('aSeed2', new THREE.InstancedBufferAttribute(seed2, 3));
    const origin = uniform(new THREE.Vector3());
    const box = new THREE.Vector3(...k.box);
    const s1 = attribute('aSeed', 'vec3'), s2 = attribute('aSeed2', 'vec3');
    const t = ctx.uniforms.time;
    const raw = s1.mul(vec3(...k.box)).add(vec3(...k.drift).mul(s2.x.mul(0.8).add(0.6)).mul(t));
    const wrapped = raw.mod(vec3(...k.box));
    const wob = vec3(sin(t.mul(0.6).add(s2.y.mul(30))), sin(t.mul(0.45).add(s2.z.mul(30))).mul(0.4), cos(t.mul(0.5).add(s2.x.mul(30)))).mul(0.5);
    const centre = origin.add(wrapped).sub(vec3(k.box[0] / 2, 0, k.box[2] / 2)).add(wob);
    const nrm = wrapped.div(vec3(...k.box));
    const edge = smoothstep(0, 0.1, nrm.x).mul(smoothstep(1, 0.9, nrm.x)).mul(smoothstep(0, 0.12, nrm.y)).mul(smoothstep(1, 0.88, nrm.y)).mul(smoothstep(0, 0.1, nrm.z)).mul(smoothstep(1, 0.9, nrm.z));
    const disc = smoothstep(0.5, 0.15, length(uv().sub(0.5)));
    const flick = k.flicker ? float(1).sub(float(k.flicker).mul(0.5)).add(sin(t.mul(3).add(s2.x.mul(100))).mul(0.5).add(0.5).mul(k.flicker * 0.5)) : float(1);
    const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
    mat.positionNode = centre;
    mat.scaleNode = vec2(k.size * (0.6 + 0.8 * 1)).mul(s2.y.mul(0.9).add(0.6));
    mat.colorNode = vec3(...k.hue).mul(k.hdr).mul(flick);
    mat.opacityNode = disc.mul(edge).mul(k.additive ? 0.9 : 0.75);
    if (k.additive) mat.blending = THREE.AdditiveBlending;
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false; mesh.count = 0; mesh.name = `flora:motes:${k.name}`; mesh.renderOrder = 5;
    ctx.scene.add(mesh);
    out.push({ mesh, kind: k, n, origin, box });
  }
  const fwd = new THREE.Vector3();
  return {
    update(c: WorldContext) {
      c.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      for (const m of out) {
        const g = THREE.MathUtils.clamp(m.kind.gate(c), 0, 1);
        m.mesh.count = Math.ceil(m.n * g);
        m.mesh.visible = m.mesh.count > 0;
        m.origin.value.set(c.camera.position.x + fwd.x * m.box.z * m.kind.forward, 0, c.camera.position.z + fwd.z * m.box.z * m.kind.forward);
      }
    },
    meshes: out.map((m) => m.mesh),
    n: out.reduce((a, m) => a + m.n, 0),
  };
}
void saturate; void mix; void color;
