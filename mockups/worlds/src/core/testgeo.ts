// #testgeo: stand-in ground + landmark columns so the shared look can be judged before real modules land.
import * as THREE from 'three/webgpu';
import type { WorldContext } from '../contracts';

export function createTestGeo(ctx: WorldContext) {
  const grp = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1).rotateX(-Math.PI / 2), ctx.materials.create({ snowCover: true }));
  ground.receiveShadow = true;
  grp.add(ground);
  const stone = ctx.materials.create({ stone: true, snowCover: true });
  for (const l of ctx.preset.composition.landmarks) {
    let m: any = null;
    if (l.kind === 'spire') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(l.radius * 0.35, l.radius, l.height, 14, 12, true), stone);
      m.position.set(l.pos[0], l.height / 2, l.pos[1]);
    } else if (l.kind === 'wall') {
      m = new THREE.Mesh(new THREE.BoxGeometry(l.width, l.height, l.depth), stone);
      m.position.set(l.pos[0], l.height / 2, l.pos[1]);
    } else if (l.kind === 'monolith') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(l.height * 0.04, l.height * 0.08, l.height, 8), ctx.materials.create({ color: 0x15111c }));
      m.position.set(l.pos[0], l.height / 2, l.pos[1]);
    } else if (l.kind === 'dome') {
      m = new THREE.Mesh(new THREE.SphereGeometry(l.radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), ctx.materials.create({ color: 0x2d7a5a }));
      m.position.set(l.pos[0], 0, l.pos[1]);
    }
    if (m) { m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  }
  ctx.scene.add(grp);
  return { dispose() { ctx.scene.remove(grp); grp.traverse((o: any) => o.geometry?.dispose()); } };
}
