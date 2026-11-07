// The 1.8 m explorer: an ink silhouette with a backpack, a tall staff and a single cyan lamp pixel.
import * as THREE from 'three/webgpu';
import { PALETTE } from './contracts';
import { paint, merge } from './geo';
import { worldMaterial } from './material';
import { heightAt } from './field';

export function buildExplorer(x: number, z: number, yaw: number): any {
  const parts: any[] = [];
  const body = new THREE.CapsuleGeometry(0.24, 0.85, 3, 8); body.translate(0, 0.78, 0);
  const head = new THREE.IcosahedronGeometry(0.17, 1); head.translate(0, 1.62, 0.02);
  const pack = new THREE.BoxGeometry(0.42, 0.62, 0.3); pack.translate(0, 1.12, 0.26);
  const staff = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 4); staff.translate(0.36, 1.15, -0.05);
  for (const g of [body, head, pack, staff]) parts.push(paint(g, () => PALETTE.ink));
  const lamp = new THREE.IcosahedronGeometry(0.11, 0); lamp.translate(0.36, 2.32, -0.05);
  parts.push(paint(lamp, () => PALETTE.glow, () => 1));
  const m = new THREE.Mesh(merge(parts), worldMaterial({ glow: true, bounce: false }));
  m.position.set(x, heightAt(x, z) - 0.05, z);
  m.rotation.y = yaw;
  m.castShadow = true;
  return m;
}
