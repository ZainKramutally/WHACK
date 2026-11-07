// Macro landforms: buttes/mesas, one colossal natural arch, layered mountain ranges. Flat-shaded, vertex-coloured.
import * as THREE from 'three/webgpu';
import { PALETTE } from './contracts';
import { fbm, ridged, smoothstep } from './rng';
import { heightAt } from './field';
import { paint, tube, merge, lerpHex } from './geo';
import { worldMaterial } from './material';
import { ARCH2, RIBS } from './layout';

function strata(y: number, h: number, seed: number): [number, number, number] {
  const band = Math.floor((y / h) * 9 + fbm(y * 0.02, seed, 2, seed) * 1.5);
  const dark = band % 3 === 0 ? 0.65 : band % 3 === 1 ? 0.2 : 0.4;
  return lerpHex(PALETTE.red, PALETTE.crimson, dark);
}

/** Butte/mesa: noisy extruded column with stepped ledges, a talus flare at the foot and a flat top. */
export function butte(x: number, z: number, r: number, h: number, seed: number, topTaper = 0.82): any {
  const g = new THREE.CylinderGeometry(r * topTaper, r * 1.35, h, 40, 14, false);
  const p = g.attributes.position, v = new THREE.Vector3();
  const base = heightAt(x, z) - 6;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const yN = (v.y + h / 2) / h; // 0 foot → 1 top
    const ang = Math.atan2(v.z, v.x);
    const rr = Math.hypot(v.x, v.z);
    if (rr > 1e-3) {
      const ledge = Math.floor(yN * 6) / 6;
      const n = 1 + 0.22 * fbm(Math.cos(ang) * 2.2 + seed, Math.sin(ang) * 2.2 + ledge * 1.7, 4, seed)
        + 0.05 * Math.sin(ledge * 23 + seed);
      const flare = 1 + 0.45 * (1 - smoothstep(0, 0.22, yN));
      const s = (n * flare * (yN < 0.02 ? 1.3 : 1)) / 1;
      v.x *= s; v.z *= s;
    }
    v.y = base + yN * h + (yN > 0.99 ? fbm(v.x * 0.01, v.z * 0.01, 2, seed) * 4 : 0);
    v.x += x; v.z += z;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return paint(g, (pp, n) => (n.y > 0.7 ? lerpHex(PALETTE.redLight, PALETTE.blush, 0.25) : strata(pp.y - base, h, seed)));
}

/** A colossal natural arch: thick noisy tube from foot A over to foot B, feet sunk into the ground. */
export function arch(cx: number, cz: number, span: number, height: number, thick: number, seed: number): any {
  const pts: any[] = [], radii: number[] = [];
  const N = 90;
  const base = heightAt(cx, cz);
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = Math.PI * t;
    const x = cx - Math.cos(a) * span * 0.5 + fbm(t * 3, seed, 2, seed) * span * 0.05;
    const y = base - 40 + Math.pow(Math.sin(a), 0.75) * height;
    const zz = cz + Math.sin(a * 2) * span * 0.04;
    pts.push(new THREE.Vector3(x, y, zz));
    radii.push(thick * (0.62 + 0.75 * Math.pow(1 - Math.sin(a), 2.2)));
  }
  const g = tube(pts, radii, 22, (i, j) => 1 + 0.18 * fbm(i * 0.18, j * 0.6, 3, seed), true);
  return paint(g, (pp, n) => (n.y > 0.75 ? lerpHex(PALETTE.redLight, PALETTE.blush, 0.3) : strata(pp.y - base, height, seed)));
}

/** Mountain range: an arc-shaped ridge strip at distance R spanning angles [a0, a1] (radians from -Z, + = left). */
export function range(R: number, depth: number, a0: number, a1: number, H: number, seed: number, col: number): any {
  const NA = Math.round((240 * (a1 - a0)) / 2.6), NR = 7, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NA; i++) {
    const a = a0 + ((a1 - a0) * i) / NA;
    const cr = (aa: number) => H * (0.25 + 0.95 * ridged(aa * 5.5 + seed, seed * 0.1, 5, seed)) * (0.6 + 0.4 * fbm(aa * 1.3, seed, 2, seed + 4) + 0.4);
    // full rings: cross-fade into the wrapped angle near +π so the seam behind the camera is continuous
    const crest = a > Math.PI - 0.5 ? cr(a) + (cr(a - 2 * Math.PI) - cr(a)) * smoothstep(Math.PI - 0.5, Math.PI, a) : cr(a);
    for (let j = 0; j <= NR; j++) {
      const u = -1 + (2 * j) / NR;
      const r = R + u * depth;
      const prof = Math.max(0, 1 - u * u) ** 0.8;
      const x = -Math.sin(a) * r, z = -Math.cos(a) * r;
      pos.push(x, heightAt(x, z) - 30 + crest * prof + fbm(i * 0.2, j, 2, seed) * H * 0.04, z);
    }
  }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + 1, c = a + NR + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return paint(g, (_p, n) => (n.y > 0.8 ? lerpHex(col, PALETTE.blush, 0.35) : col));
}

export function buildLandforms(): any {
  const group = new THREE.Group();
  const mat = worldMaterial({ bounce: true });
  const add = (geo: any, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    group.add(m);
    return m;
  };
  // buttes & mesas: left cluster, right mesa, a tall spire, far table
  add(merge([
    butte(-620, -1250, 140, 170, 1),
    butte(-1400, -2300, 200, 380, 2, 0.7),
    butte(1050, -1600, 240, 210, 4),
    butte(560, -2300, 120, 330, 3, 0.75),
    butte(1500, -2600, 420, 360, 5),
    butte(-1700, -3100, 520, 430, 6),
    // ring of buttes in every other direction so no view of the walkable disc ends empty
    butte(2600, -900, 280, 380, 21),
    butte(2300, 500, 250, 290, 22, 0.75),
    butte(1500, 2300, 330, 330, 23),
    butte(-600, 2700, 380, 300, 24),
    butte(-2100, 1300, 300, 360, 25, 0.7),
    butte(-2800, -300, 340, 310, 26),
    butte(-2300, -1900, 260, 420, 27, 0.72),
    butte(3000, -2400, 360, 300, 28),
  ]));
  // second arch, south: the south riverbed leads to it
  add(arch(ARCH2.x, ARCH2.z, ARCH2.span, ARCH2.height, ARCH2.thick, 31));
  // fossil rib ridge, north-west: a row of narrowing arches like the ribs of something colossal
  const ribs: any[] = [];
  for (let i = 0; i < RIBS.count; i++) {
    const t = i / (RIBS.count - 1);
    ribs.push(arch(RIBS.x + Math.sin(t * 2.4) * 60, RIBS.z0 + (RIBS.z1 - RIBS.z0) * t, 330 - 140 * t, 360 - 150 * t, 24 - 8 * t, 40 + i));
  }
  add(merge(ribs));
  // the arch: behind the hero, its opening frames the hero cap against the sky
  add(arch(-880, -2700, 1300, 700, 80, 9));
  // ranges, each paler by distance (fog does the rest)
  for (const [R, D, a0, a1, H, s, c] of [
    // full rings: the front arc (±1.2 rad) is what the hero camera sees; the rest closes every other view
    [3400, 380, -Math.PI, Math.PI, 420, 11, PALETTE.red],
    [4900, 600, -Math.PI, Math.PI, 760, 12, PALETTE.crimson],
    [6800, 800, -Math.PI, Math.PI, 1150, 13, PALETTE.red],
    [8600, 900, -Math.PI, Math.PI, 1500, 14, PALETTE.crimson],
  ] as [number, number, number, number, number, number, number][]) add(range(R, D, a0, a1, H, s, c), false);
  return group;
}
