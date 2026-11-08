// Crystal crusts (environmentFrom → ground.crust, silicon): clusters of hexagonal prisms (silicon-nitride crystals are
// hexagonal, β-Si₃N₄) precipitated at the sea margin and along the beds (CLAUDE.md landform M2 "precipitate").
// Generated once, instanced. Speculative: shown only on silicon.
import * as THREE from 'three/webgpu';
import { PALETTE } from './contracts';
import { ENV } from './env/active';
import { heightAt, riverDist } from './field';
import { paint, merge, lerpHex } from './geo';
import { worldMaterial } from './material';
import { mulberry32, hash2, fbm } from './rng';
import { EXPLORER, HERO } from './layout';
import { SEA_LEVEL } from './sea';

function cluster(seed: number): any {
  const r = mulberry32(seed), parts: any[] = [];
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rad = 0.08 + r() * 0.14, h = 0.4 + r() * (i === 0 ? 1.4 : 0.9);
    const prism = new THREE.CylinderGeometry(rad, rad * 1.05, h, 6, 1, true);
    const tip = new THREE.ConeGeometry(rad, rad * 2.2, 6, 1);
    tip.translate(0, h / 2 + rad * 1.1, 0);
    const g = merge([prism.toNonIndexed(), tip.toNonIndexed()]);
    g.translate(0, h / 2, 0);
    const e = new THREE.Euler((r() - 0.5) * 1.1, r() * Math.PI * 2, (r() - 0.5) * 1.1);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
    g.translate((r() - 0.5) * 0.5, -0.05, (r() - 0.5) * 0.5);
    parts.push(g);
  }
  const g = merge(parts);
  g.computeBoundingBox();
  const top = g.boundingBox!.max.y;
  return paint(g, (p, nn) => {
    const t = Math.max(0, p.y / top);
    const base = lerpHex(PALETTE.crimson, PALETTE.red, Math.min(1, t * 1.6));
    const lit = lerpHex(PALETTE.redLight, PALETTE.bone, 0.5);
    const k = t > 0.5 ? (t - 0.5) * 2 : 0;
    return nn.y > 0.5 && t > 0.6 ? lerpHex(PALETTE.bone, PALETTE.blush, 0.3) : [base[0] + (lit[0] - base[0]) * k, base[1] + (lit[1] - base[1]) * k, base[2] + (lit[2] - base[2]) * k];
  }, (p) => (p.y > top * 0.82 ? 0.55 : 0));
}

export function buildCrystals(): any | null {
  const amt = ENV.ground.crust * ENV.drivers.si * (1 - 0.45 * ENV.drivers.crit);
  if (amt < 0.05) return null;
  const variants = [cluster(11), cluster(23), cluster(37)];
  const lists: [number, number, number, number, number][][] = [[], [], []];
  const level = Number.isFinite(SEA_LEVEL) ? SEA_LEVEL : -1e9;
  const STEP = 5, MAX = 1800;
  for (let gx = -1200; gx <= 1200; gx += STEP) for (let gz = -1300; gz <= 700; gz += STEP) {
    const ix = gx / STEP, iz = gz / STEP;
    const x = gx + (hash2(ix, iz, 5) - 0.5) * STEP, z = gz + (hash2(ix, iz, 6) - 0.5) * STEP;
    const d0 = Math.hypot(x, z);
    if (d0 < 9 || Math.hypot(x - EXPLORER.x, z - EXPLORER.z) < 4 || Math.hypot(x - HERO.x, z - HERO.z) < 12) continue;
    const h = heightAt(x, z), above = h - level;
    const shore = above > -0.4 && above < 3.2 ? 1 - above / 4 : 0;
    const rv = riverDist(x, z);
    const bank = rv.d < rv.w * 1.8 ? 0.45 : 0;
    const patch = 0.5 + fbm(x / 40, z / 40, 2, 9) * 0.9;
    const p = amt * Math.max(shore, bank) * patch * (d0 < 120 ? 0.5 : 1);
    if (hash2(ix, iz, 7) > p * 0.8) continue;
    // small near the camera (the foreground stays the framing plants'), a few big clusters out on the shores
    const big = d0 > 160 && hash2(ix, iz, 8) > 0.92 ? 2.4 : 1;
    const nearK = 0.25 + 0.75 * Math.min(1, Math.max(0, (d0 - 15) / 140));
    lists[Math.floor(hash2(ix, iz, 9) * 3)].push([x, h, z, (0.9 + hash2(ix, iz, 10) * 2.2) * big * nearK, hash2(ix, iz, 11) * Math.PI * 2]);
  }
  const total = lists.reduce((a, l) => a + l.length, 0);
  if (total > MAX) {
    // keep the nearest MAX clusters (the hero shores), drop the far ones the fog eats anyway
    const r2 = lists.flat().map(([x, , z]) => x * x + z * z).sort((p, q) => p - q)[MAX - 1];
    lists.forEach((l, i) => { lists[i] = l.filter(([x, , z]) => x * x + z * z <= r2); });
  }
  const group = new THREE.Group();
  const mat = worldMaterial({ glow: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  lists.forEach((list, vi) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(variants[vi], mat, list.length);
    list.forEach(([x, y, z, sc, yaw], i) => mesh.setMatrixAt(i, m4.compose(p.set(x, y - 0.1 * sc, z), q.setFromAxisAngle(up, yaw), s.setScalar(sc))));
    mesh.castShadow = false; mesh.receiveShadow = true; // crusts are ankle-high: shadow casting cost more than it read
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = `crystals-${vi}`;
    group.add(mesh);
  });
  return group;
}
