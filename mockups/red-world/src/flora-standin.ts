// TEMPORARY stand-in flora (rw-scene). Replaced automatically by src/flora/index.ts (rw-flora) once it exists.
// Same contract: merged geometry, origin at base centre, attributes position/normal/color/aGlow/aSway.
import * as THREE from 'three/webgpu';
import type { BuildFloraLibrary, PlantArchetype, SpeciesId } from './contracts';
import { PALETTE } from './contracts';
import { mulberry32 } from './rng';
import { paint, tube, merge, lerpHex } from './geo';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function finish(species: SpeciesId, variant: number, geo: any): PlantArchetype {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  return {
    species, variant, geometry: geo,
    height: bb.max.y, radius: Math.max(bb.max.x, -bb.min.x, bb.max.z, -bb.min.z),
    triangles: geo.attributes.position.count / 3,
  };
}

function parasol(rng: () => number, v: number): PlantArchetype {
  const H = 100, parts: any[] = [];
  const pts: any[] = [], radii: number[] = [];
  const lean = (rng() - 0.5) * 6;
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(V(Math.sin(t * 2.5) * lean * t, t * H, 0)); radii.push(4.2 - 2.4 * t + (i % 4 === 0 ? 0.7 : 0)); }
  parts.push(paint(tube(pts, radii, 10), (p) => lerpHex(PALETTE.crimson, PALETTE.blush, p.y / H * 0.6), () => 0, (p) => p.y / H));
  const caps = 1 + (v % 3);
  for (let c = 0; c < caps; c++) {
    const cy = H * (1 - c * 0.2), cr = 46 * (1 - c * 0.3) * (0.9 + rng() * 0.2);
    const prof: any[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(t * cr, cr * 0.18 * (1 - t * t) + 1.5)); }
    for (let i = 10; i >= 0; i--) { const t = i / 10; prof.push(new THREE.Vector2(t * cr * 0.98, cr * 0.18 * (1 - t * t) - 1.2 - (1 - t) * 3)); }
    const lathe = new THREE.LatheGeometry(prof, 36);
    lathe.translate(pts[24].x * (cy / H), cy, 0);
    parts.push(paint(lathe,
      (p) => { const t = Math.min(1, Math.hypot(p.x - pts[24].x * (cy / H), p.z) / cr); return p.y > cy + cr * 0.18 * (1 - t * t) + 0.2 ? PALETTE.bone : PALETTE.crimson; },
      (p) => (p.y < cy && Math.sin(Math.atan2(p.z, p.x) * 18) > 0.96 && Math.hypot(p.x, p.z) < cr * 0.5 ? 0.6 : 0),
      (p) => 0.85 + 0.15 * Math.hypot(p.x, p.z) / cr));
  }
  return finish('parasolTitan', v, merge(parts));
}

function coil(rng: () => number, v: number): PlantArchetype {
  const H = 80, pts: any[] = [], radii: number[] = [];
  const turns = 3 + v + rng();
  for (let i = 0; i <= 90; i++) { const t = i / 90; const r = 6 * (1 - t) + 1; pts.push(V(Math.cos(t * turns * 6.28) * r, t * H, Math.sin(t * turns * 6.28) * r)); radii.push(2.4 * (1 - t) + 0.4); }
  const parts = [paint(tube(pts, radii, 8), (p) => lerpHex(PALETTE.crimson, PALETTE.redLight, p.y / H), () => 0, (p) => p.y / H)];
  const bulb = new THREE.IcosahedronGeometry(4.5, 1); bulb.scale(1, 1.4, 1); bulb.translate(pts[90].x, H + 3, pts[90].z);
  parts.push(paint(bulb, () => PALETTE.blush, (_p, n) => (n.y > 0.6 ? 1 : 0), () => 1));
  return finish('coilSpire', v, merge(parts));
}

function lantern(rng: () => number, v: number): PlantArchetype {
  const parts: any[] = [];
  const n = 3 + v * 2;
  for (let k = 0; k < n; k++) {
    const a = rng() * 6.28, h = 6 + rng() * 12, bend = 2 + rng() * 5;
    const pts: any[] = [], radii: number[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(V(Math.cos(a) * bend * t * t, t * h, Math.sin(a) * bend * t * t)); radii.push(0.35 * (1 - t) + 0.12); }
    parts.push(paint(tube(pts, radii, 6), () => PALETTE.maroon, () => 0, (p) => p.y / 18));
    const pod = new THREE.IcosahedronGeometry(1.4 + rng() * 1.2, 1); pod.scale(1, 1.35, 1);
    const tip = pts[12];
    pod.translate(tip.x, tip.y + 1.2, tip.z);
    parts.push(paint(pod, (_p, nn) => (nn.y > 0.8 ? PALETTE.glow : PALETTE.crimson), (_p, nn) => (nn.y > 0.8 ? 1 : 0), () => 1));
  }
  return finish('lanternPods', v, merge(parts));
}

function weeper(rng: () => number, v: number): PlantArchetype {
  const H = 40, parts: any[] = [];
  const pts: any[] = [], radii: number[] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; const a = t * Math.PI * 0.95; pts.push(V(Math.sin(a) * 22 * t, Math.sin(Math.min(a * 1.3, Math.PI * 0.62)) * H, 0)); radii.push(1.8 * (1 - t) + 0.35); }
  parts.push(paint(tube(pts, radii, 8), () => PALETTE.maroon, () => 0, (p) => Math.min(1, p.y / H + p.x / 30)));
  for (let k = 0; k < 26 + v * 6; k++) {
    const s = pts[12 + Math.floor(rng() * 28)], len = 8 + rng() * 22;
    const fp: any[] = [], fr: number[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; fp.push(V(s.x + (rng() - 0.5) * 0.4, Math.max(0.5, s.y - t * len), s.z + (rng() - 0.5) * 2 * t)); fr.push(0.22 * (1 - t) + 0.06); }
    parts.push(paint(tube(fp, fr, 4, undefined, false), () => PALETTE.crimson, () => 0, () => 1));
  }
  return finish('weeper', v, merge(parts));
}

function ribFan(rng: () => number, v: number): PlantArchetype {
  // planar coral fan: a short trunk splitting into many curved ribs that fan out in one plane, webbed by thin cross-ribs
  const parts: any[] = [];
  const H = 20, ribs = 9 + v * 3;
  parts.push(paint(tube([V(0, 0, 0), V(0, 2.5, 0), V(0, 4, 0)], [1.1, 0.9, 0.8], 6), () => PALETTE.maroon));
  const tips: any[] = [];
  for (let k = 0; k < ribs; k++) {
    const a = -1.1 + (2.2 * k) / (ribs - 1) + (rng() - 0.5) * 0.08;
    const pts: any[] = [], radii: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, r = t * H * (0.85 + 0.15 * Math.cos(a * 2));
      pts.push(V(Math.sin(a * (0.6 + 0.6 * t)) * r, 4 + Math.cos(a * (0.6 + 0.6 * t)) * r, Math.sin(t * 3 + k) * 0.6));
      radii.push(0.55 * (1 - t) + 0.15);
    }
    tips.push(pts);
    parts.push(paint(tube(pts, radii, 5), (p) => lerpHex(PALETTE.maroon, PALETTE.crimson, Math.min(1, p.y / H)), (p) => (p.y > H * 0.95 && k % 3 === 0 ? 0.7 : 0), (p) => Math.min(1, p.y / H)));
  }
  for (const ring of [5, 9, 12]) for (let k = 0; k < ribs - 1; k++)
    parts.push(paint(tube([tips[k][ring], tips[k + 1][ring]], [0.12, 0.12], 3, undefined, false), () => PALETTE.crimson, () => 0, () => 0.6));
  return finish('ribFan', v, merge(parts));
}

function groundCover(rng: () => number, v: number): PlantArchetype {
  const parts: any[] = [];
  const n = 9 + v * 4;
  for (let k = 0; k < n; k++) {
    const h = 0.6 + rng() * 1.6, cone = new THREE.ConeGeometry(0.09 + rng() * 0.08, h, 4);
    cone.translate(0, h / 2, 0);
    cone.rotateZ((rng() - 0.5) * 1.3); cone.rotateY(rng() * 6.28);
    cone.translate((rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6);
    parts.push(paint(cone, (p) => (p.y > 1.2 ? PALETTE.redLight : p.y > 0.6 ? PALETTE.crimson : PALETTE.maroon), () => 0, (p) => Math.min(1, p.y / 2)));
  }
  const nub = new THREE.IcosahedronGeometry(0.35, 0); nub.translate(0, 0.15, 0);
  parts.push(paint(nub, () => PALETTE.crimson));
  return finish('groundCover', v, merge(parts));
}

export const buildFloraLibrary: BuildFloraLibrary = (seed) => {
  const rng = mulberry32(seed);
  const archetypes: PlantArchetype[] = [];
  for (let v = 0; v < 3; v++) {
    archetypes.push(parasol(rng, v), coil(rng, v), lantern(rng, v), weeper(rng, v), ribFan(rng, v), groundCover(rng, v));
  }
  return { archetypes, bySpecies: (s) => archetypes.filter((a) => a.species === s) };
};
