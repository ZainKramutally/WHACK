// Easter egg (worlds/lead.ts): every animal is drawn as one fixed tardigrade, whatever the sim's genes say. Render-only.
import { LOCOMOTION, type BodyPlan } from '../sim/develop';

export function tardigradePlan(p: BodyPlan): BodyPlan {
  const scale = 2;   // metres drawn: the same for every animal, as in the founders' display size
  return {
    ...p,
    scale, chemistry: 'carbon', architecture: 'axial', symmetry: 2, segmentCount: 5, sides: 12, flatShaded: false, profile: 'smooth',
    tiers: 0, hubRadius: 0, tierHeight: 0, tierRadii: [], arms: [], curl: 0.05, bodyJointMaxDeg: 15, jointSnapDeg: 0,
    legPairs: 4, limbKind: 'leg', limbLength: scale * 0.18, limbSegments: 2, limbJointAngles: [25, -25],
    shellCover: 0, plateCover: 0, hornCount: 0, hornLength: 0, hornKind: 'none', dorsal: 'rods', gapeSize: scale * 0.1,
    girth: 1.5, flatten: 1, headScale: 0.9, gradient: 0, carapace: 0, crest: 0, jaw: 0, tailKind: 'none', tailSegments: 0, finSpan: 0, wingSpan: 0, liftSpan: 0,
    hue: 0.1, accent: 0, bands: 0, spots: 0, eyeKind: 'none', eyeCount: 0, glow: 0, mode: LOCOMOTION.walk,
  };
}

// ---- Dedicated tardigrade body (replaces the generic lofted pipeline while the lead egg is on). Render-only. ----
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SKIN: [number, number, number] = [0.93, 0.72, 0.62];
const CREASE: [number, number, number] = [0.74, 0.5, 0.45];
const MOUTH: [number, number, number] = [0.78, 0.35, 0.55];
const CLAW: [number, number, number] = [0.85, 0.78, 0.66];
const EYE: [number, number, number] = [0.12, 0.08, 0.1];

function coloured(g: THREE.BufferGeometry, c: [number, number, number]): THREE.BufferGeometry {
  const n = g.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** Body, 1 unit long along +X (head leads), belly down. 5 plump segments, creases, mouth ring, eye spots. */
function bodyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const segs = [ // x centre, x half-length, radius
    { x: 0.39, hx: 0.12, r: 0.17 }, { x: 0.18, hx: 0.13, r: 0.2 }, { x: -0.04, hx: 0.13, r: 0.21 },
    { x: -0.25, hx: 0.13, r: 0.19 }, { x: -0.42, hx: 0.11, r: 0.15 },
  ];
  for (const s of segs) parts.push(coloured(new THREE.SphereGeometry(1, 14, 10).scale(s.hx, s.r, s.r).translate(s.x, 0, 0), SKIN));
  for (let i = 0; i < segs.length - 1; i++) {
    const x = 0.5 * (segs[i].x - segs[i].hx + segs[i + 1].x + segs[i + 1].hx), r = 0.5 * (segs[i].r + segs[i + 1].r) * 0.86;
    parts.push(coloured(new THREE.TorusGeometry(r, 0.02, 6, 16).rotateY(Math.PI / 2).translate(x, 0, 0), CREASE));
  }
  parts.push(coloured(new THREE.TorusGeometry(0.055, 0.02, 6, 14).rotateY(Math.PI / 2).translate(0.505, -0.01, 0), MOUTH));
  parts.push(coloured(new THREE.CircleGeometry(0.04, 10).rotateY(Math.PI / 2).translate(0.499, -0.01, 0), [0.35, 0.12, 0.25]));
  for (const z of [-1, 1]) parts.push(coloured(new THREE.SphereGeometry(0.014, 6, 4).translate(0.43, 0.09, z * 0.1), EYE));
  const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }), false);
  for (const p of parts) p.dispose();
  return g;
}

/** One pair of stubby legs, pivot at the hip (origin), hanging down; `back` swings the pair to point rearward. */
function legPairGeometry(back: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const z of [-1, 1]) {
    const leg: THREE.BufferGeometry[] = [
      coloured(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8).translate(0, -0.1, 0), SKIN),
      coloured(new THREE.SphereGeometry(0.065, 8, 6).translate(0, -0.21, 0), SKIN),
    ];
    for (let k = -1; k <= 1; k++) leg.push(coloured(new THREE.ConeGeometry(0.012, 0.06, 4).rotateX(k * 0.45).translate(0, -0.27, k * 0.03), CLAW));
    const m = mergeGeometries(leg.map((p) => { p.deleteAttribute('uv'); return p; }), false);
    for (const p of leg) p.dispose();
    m.translate(0, 0, z * 0.07).rotateX(z * 0.3); // splay outward a little
    parts.push(m);
  }
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return g.rotateZ(back);
}

// hip positions (x, y, z-offset handled in geometry), 3 pairs under the belly + the 4th at the rear pointing back
const HIPS = [{ x: 0.22, back: 0 }, { x: 0.02, back: 0 }, { x: -0.18, back: 0 }, { x: -0.4, back: -1.2 }];

export const TARDI_SIZE = 0.25;   // drawn length factor: 2 m founders -> 0.5 m

/** Feet level of a floating tardigrade: 1.5-12 m above the ground or sea surface by id hash, with a slow bob. Shared by the draw and the pick. */
export function floatY(id: number, t: number, surface: number): number {
  const h = Math.abs(Math.sin(id * 12.9898 + 4.1414) * 43758.5453) % 1;
  return surface + 1.5 + h * 10.5 + 0.5 * Math.sin(t * 1.8 + id * 2.3);
}

export interface TardigradeSwarm {
  meshes: THREE.InstancedMesh[];
  begin(): void;
  /** One animal: world position of its feet level (y0), heading rad, pitch rad, drawn length in metres, id, time s. */
  add(x: number, y0: number, z: number, heading: number, pitch: number, len: number, id: number, t: number): void;
  end(): void;
  dispose(): void;
}

export function createTardigrades(mat: THREE.Material, cap: number, attachGlow: (m: THREE.InstancedMesh, cap: number) => void): TardigradeSwarm {
  const geos = [bodyGeometry(), ...HIPS.map((h) => legPairGeometry(h.back))];
  const meshes = geos.map((g) => {
    const m = new THREE.InstancedMesh(g, mat, cap);
    m.frustumCulled = false; m.count = 0;
    attachGlow(m, cap);
    return m;
  });
  let n = 0;
  const base = new THREE.Matrix4(), tmp = new THREE.Matrix4(), leg = new THREE.Matrix4(), rz = new THREE.Matrix4();
  return {
    meshes,
    begin() { n = 0; },
    add(x, y0, z, heading, pitch, len, id, t) {
      if (n >= cap) return;
      const ph = id * 1.7, bob = 0.015 * len * Math.sin(t * 2.2 + ph), roll = 0.18 * Math.sin(t * 0.9 + ph);
      base.makeRotationY(-heading).setPosition(x, y0 + 0.3 * len + bob, z);
      tmp.makeRotationZ(pitch + 0.08 * Math.sin(t * 0.7 + ph * 1.3)); base.multiply(tmp);
      tmp.makeRotationX(roll); base.multiply(tmp);
      tmp.makeScale(len, len, len); base.multiply(tmp);
      meshes[0].setMatrixAt(n, base);
      for (let p = 0; p < HIPS.length; p++) {
        const ang = 0.55 * Math.sin(t * 3 + ph + (p & 1) * Math.PI + (p >> 1) * 1.3);
        rz.makeRotationZ(ang).setPosition(HIPS[p].x, -0.1, 0);
        leg.multiplyMatrices(base, rz);
        meshes[p + 1].setMatrixAt(n, leg);
      }
      n++;
    },
    end() { for (const m of meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = n > 0; } },
    dispose() { for (const m of meshes) { m.geometry.dispose(); m.dispose(); } },
  };
}
