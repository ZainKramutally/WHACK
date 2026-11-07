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

export const PROBE_COLORS = [0xf94b1e, 0xece4d6, 0x8badc5, 0x093f1b, 0x27aaa6, 0xda1b58, 0x303b51, 0xa47c68];

/** #probe: two rows of flat patches on the camera. Top = unlit basic (pipeline colour fidelity), bottom = world material, lit. */
export function createProbe(ctx: WorldContext) {
  const grp = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1);
  PROBE_COLORS.forEach((c, i) => {
    const x = (i - (PROBE_COLORS.length - 1) / 2) * 1.05;
    const top = new THREE.Mesh(geo, new THREE.MeshBasicNodeMaterial({ color: c }));
    top.position.set(x, 0.6, -8);
    const bot = new THREE.Mesh(geo, ctx.materials.create({ color: c }));
    bot.position.set(x, -0.6, -8);
    grp.add(top, bot);
  });
  ctx.camera.add(grp);
  ctx.scene.add(ctx.camera);
  return { dispose() { ctx.camera.remove(grp); } };
}
