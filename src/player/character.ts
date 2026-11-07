// Placeholder stylised explorer: capsule body, round head, visor, backpack. The art layer can replace it.
// It only reads PlayerState; nothing here feeds back into movement.
import * as THREE from 'three/webgpu';
import type { PlayerState } from './controller';

export interface Character {
  root: THREE.Group;
  update(state: PlayerState, dt: number): void;
  dispose(): void;
}

export function createCharacter(): Character {
  const root = new THREE.Group();
  const pose = new THREE.Group(); // bobbed / leaned, child of root
  root.add(pose);

  const suit = new THREE.MeshStandardNodeMaterial({ color: 0xe8a33d, roughness: 0.7 });
  const trim = new THREE.MeshStandardNodeMaterial({ color: 0x2c3a4a, roughness: 0.5 });
  const glass = new THREE.MeshStandardNodeMaterial({ color: 0x9fe8ff, roughness: 0.15, metalness: 0.2 });

  const geos = [
    new THREE.CapsuleGeometry(0.35, 0.8, 4, 10),
    new THREE.SphereGeometry(0.3, 14, 10),
    new THREE.SphereGeometry(0.2, 12, 8),
    new THREE.BoxGeometry(0.4, 0.55, 0.22),
  ];
  const body = new THREE.Mesh(geos[0], suit);
  body.position.y = 0.9; // feet at y = 0 (capsule half-height 0.4 + radius 0.35 = 0.75 + margin)
  const head = new THREE.Mesh(geos[1], suit);
  head.position.y = 1.72;
  const visor = new THREE.Mesh(geos[2], glass);
  visor.scale.set(1, 0.8, 0.6);
  visor.position.set(0, 1.74, -0.22); // faces -z, the heading convention's "forward"
  const pack = new THREE.Mesh(geos[3], trim);
  pack.position.set(0, 1.0, 0.33);
  pose.add(body, head, visor, pack);

  let phase = 0;
  return {
    root,
    update(s, dt) {
      root.position.set(s.x, s.y, s.z);
      root.rotation.y = s.heading;
      if (s.mode === 'walk') {
        phase += dt * (3 + s.speed * 1.6);
        const k = Math.min(1, s.speed / 3);
        pose.position.y = Math.abs(Math.sin(phase)) * 0.09 * k;
        pose.rotation.set(0.12 * k, 0, Math.sin(phase) * 0.06 * k);
      } else {
        // Swim: lean into the stroke, slow undulation. Floating character is centred on the body.
        phase += dt * (1.5 + s.speed);
        const k = Math.min(1, s.speed / 2);
        pose.position.y = Math.sin(phase * 0.8) * 0.05;
        pose.rotation.set(0.5 * k + s.swimPitch * 0.6, 0, Math.sin(phase) * 0.1 * k);
      }
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      [suit, trim, glass].forEach((m) => m.dispose());
    },
  };
}
