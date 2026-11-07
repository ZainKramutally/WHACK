// Tiny explorer silhouette for scale: capsule body, head, backpack. Flat, in the shadow hue.
import * as THREE from 'three/webgpu';
import { mix, color } from 'three/tsl';
import type { WorldContext } from '../contracts';

export function createFigure(ctx: WorldContext) {
  const f = ctx.preset.composition.figure;
  if (!f) return null;
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.colorNode = mix(ctx.uniforms.shadowColor, color(0x000000), 0.35);
  const h = f.height;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.13, h * 0.5, 2, 6), mat);
  body.position.y = h * 0.52;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.075, 0), mat);
  head.position.y = h * 0.9;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(h * 0.2, h * 0.3, h * 0.12), mat);
  pack.position.set(0, h * 0.62, h * 0.15); // on the back (+z, towards the camera)
  g.add(body, head, pack);
  g.position.set(f.pos[0], 0, f.pos[1]);
  ctx.scene.add(g);
  return {
    update() { g.position.y = ctx.terrainHeight(f.pos[0], f.pos[1]); },
    dispose() { ctx.scene.remove(g); g.traverse((o: any) => o.geometry?.dispose()); mat.dispose(); },
  };
}
