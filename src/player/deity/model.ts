// The void deity's shapes: four chibi variants behind one builder, implementing the rig contract in rig.ts.
// Brief: docs/features/deity.md. Space: metres, +y up, faces -z, feet at y = 0. The model sets rest transforms once;
// animation (animate.ts) offsets from them. Built-in node materials only (plus worldMaterial for the 'ink' void mode).
import * as THREE from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, worldMaterial } from '../../render/material';
import type { DeityDims, DeityRig } from './rig';

export type DeityVariantId = 'A' | 'B' | 'C' | 'D';
export const DEITY_VARIANTS: readonly { id: DeityVariantId; name: string }[] = [
  { id: 'A', name: 'Reference' },
  { id: 'B', name: 'Void' },
  { id: 'C', name: 'Deity' },
  { id: 'D', name: 'Inverse' },
];
export const DEFAULT_VARIANT: DeityVariantId = 'C';

export interface DeityOpts {
  /** Inverted-hull rim shell around every black part (default off). */
  rim?: boolean;
  /** 'unlit' = pure black MeshBasic (default); 'ink' = palette ink through worldMaterial (lit, fogged like the world). */
  voidMode?: 'unlit' | 'ink';
}

const RIM_COLOUR = 0xc9b8f0; // haze lilac
const RIM_THICK = 0.03;

interface Spec {
  legLength: number;
  hipHalfWidth: number;
  bodyHeight: number;
  bodyRadius: number;
  headRadius: number;
  headGap: number;
  handRadius: number;
}

const SPECS: Record<DeityVariantId, Spec> = {
  A: { legLength: 0.36, hipHalfWidth: 0.1, bodyHeight: 0.4, bodyRadius: 0.25, headRadius: 0.32, headGap: 0.12, handRadius: 0.085 },
  B: { legLength: 0.2, hipHalfWidth: 0.13, bodyHeight: 0.5, bodyRadius: 0.3, headRadius: 0.31, headGap: 0.12, handRadius: 0.09 },
  C: { legLength: 0.1, hipHalfWidth: 0.1, bodyHeight: 0.7, bodyRadius: 0.34, headRadius: 0.3, headGap: 0.14, handRadius: 0.085 },
  D: { legLength: 0.2, hipHalfWidth: 0.13, bodyHeight: 0.6, bodyRadius: 0.32, headRadius: 0.3, headGap: 0.12, handRadius: 0.09 },
};

const EYE_LOOK = 0.04;

/** A unit-sphere-based ellipsoid with the given radii, centred at (0, cy, 0). */
function ellipsoid(rx: number, ry: number, rz: number, cy = 0, seg: [number, number] = [22, 14]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg[0], seg[1]);
  g.scale(rx, ry, rz);
  g.translate(0, cy, 0);
  return g;
}

/** A rod from a to b with radius r (6-sided: chunky, cheap). */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, 6, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Push every vertex out along its normal (smooth shapes): the inverted-hull rim shell. */
function inflate(g: THREE.BufferGeometry, d: number): THREE.BufferGeometry {
  const s = g.clone();
  const p = s.getAttribute('position');
  const n = s.getAttribute('normal');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
  p.needsUpdate = true;
  return s;
}

export function buildDeity(variant: DeityVariantId = DEFAULT_VARIANT, opts: DeityOpts = {}): DeityRig {
  const s = SPECS[variant];
  const rim = opts.rim === true;
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const keepG = <T extends THREE.BufferGeometry>(g: T): T => { geos.push(g); return g; };
  const keepM = <T extends THREE.Material>(m: T): T => { mats.push(m); return m; };

  // Materials: black (unlit or ink), white eyes (always unlit), optional rim shell.
  let black: THREE.Material;
  if (opts.voidMode === 'ink') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    black = worldMaterial({ kind: 'fauna', colorNode: vec3(PAL.ink) as any }) as THREE.Material;
  } else {
    black = new THREE.MeshBasicNodeMaterial({ color: 0x000000 });
  }
  keepM(black);
  const white = keepM(new THREE.MeshBasicNodeMaterial({ color: 0xffffff }));
  const rimMat = rim ? keepM(new THREE.MeshBasicNodeMaterial({ color: RIM_COLOUR, side: THREE.BackSide })) : null;

  const blackMesh = (g: THREE.BufferGeometry): THREE.Mesh => {
    const m = new THREE.Mesh(keepG(g), black);
    if (rimMat) m.add(new THREE.Mesh(keepG(inflate(g, RIM_THICK)), rimMat));
    return m;
  };
  const whiteMesh = (g: THREE.BufferGeometry): THREE.Mesh => new THREE.Mesh(keepG(g), white);

  const hipHeight = s.legLength;
  const headRestY = hipHeight + s.bodyHeight + s.headGap + s.headRadius;
  const height = headRestY + s.headRadius;

  const root = new THREE.Group();
  const pose = new THREE.Group();
  root.add(pose);
  const pelvis = new THREE.Group();
  pelvis.position.set(0, hipHeight, 0);
  pose.add(pelvis);

  // ---- body (pivot at the pelvis; the shape stands on it) ----
  let bodyGeo: THREE.BufferGeometry;
  let bodyRz = s.bodyRadius;
  if (variant === 'C') {
    // bell-shaped cloak: a lathe flaring to the hem, with a soft shoulder
    const pts = [[0.0, 0], [0.34, 0], [0.335, 0.04], [0.29, 0.2], [0.21, 0.42], [0.15, 0.58], [0.12, 0.66], [0.07, 0.69], [0, 0.7]]
      .map(([x, y]) => new THREE.Vector2(x * (s.bodyRadius / 0.34), y * (s.bodyHeight / 0.7)));
    bodyGeo = new THREE.LatheGeometry(pts, 22);
  } else if (variant === 'A') {
    bodyGeo = ellipsoid(s.bodyRadius, s.bodyHeight / 2, s.bodyRadius * 0.92, s.bodyHeight / 2); // egg
    bodyGeo.translate(0, 0, 0);
    bodyRz = s.bodyRadius * 0.92;
  } else {
    bodyGeo = ellipsoid(s.bodyRadius, s.bodyHeight / 2, s.bodyRadius, s.bodyHeight / 2); // bean
  }
  const body = blackMesh(bodyGeo);
  pelvis.add(body);

  // ---- legs: hang along -y from (+-hipHalfWidth, 0, 0) in pelvis space ----
  const legs: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * s.hipHalfWidth, 0, 0);
    const L = s.legLength;
    let g: THREE.BufferGeometry;
    if (variant === 'A') {
      // thin-but-readable stick (7 cm) and a flat foot
      const stick = new THREE.CylinderGeometry(0.035, 0.035, L - 0.04, 6, 1);
      stick.translate(0, -(L - 0.04) / 2, 0);
      const foot = ellipsoid(0.085, 0.045, 0.12, -L + 0.045, [12, 8]);
      foot.translate(0, 0, -0.03);
      g = mergeGeometries([stick, foot])!;
      stick.dispose(); foot.dispose();
    } else if (variant === 'C') {
      g = ellipsoid(0.08, L / 2, 0.11, -L / 2, [12, 8]); // tiny feet peeking under the hem
      g.translate(0, 0, -0.04);
    } else {
      g = ellipsoid(0.1, L / 2, 0.12, -L / 2, [12, 8]); // stubby leg
      g.translate(0, 0, -0.01);
    }
    const m = blackMesh(g);
    leg.add(m);
    pelvis.add(leg);
    legs.push(leg);
  }

  // ---- head: child of pose, floating above the body ----
  const head = new THREE.Group();
  head.position.set(0, headRestY, 0);
  pose.add(head);
  head.add(blackMesh(new THREE.SphereGeometry(s.headRadius, 24, 16)));

  // ---- eyes ----
  const eyes: THREE.Object3D[] = [];
  const surfaceZ = (r: number, x: number, y: number) => Math.sqrt(Math.max(r * r - x * x - y * y, 0.0001));
  const makeEye = (sx: number): THREE.Object3D => {
    const eye = new THREE.Group();
    let g: THREE.BufferGeometry;
    if (variant === 'A') {
      const ring = new THREE.TorusGeometry(0.07, 0.022, 8, 20);
      const dot = new THREE.SphereGeometry(0.02, 8, 6);
      dot.translate(0.025 * sx * -1, 0.03, 0.0);
      g = mergeGeometries([ring, dot])!;
      ring.dispose(); dot.dispose();
    } else if (variant === 'B') {
      g = ellipsoid(0.085, 0.11, 0.03, 0, [14, 10]);
    } else if (variant === 'C') {
      g = new THREE.CapsuleGeometry(0.04, 0.1, 4, 10);
      g.scale(1, 1, 0.5);
    } else {
      g = ellipsoid(0.095, 0.125, 0.035, 0, [14, 10]);
    }
    eye.add(whiteMesh(g));
    return eye;
  };
  if (variant === 'D') {
    // the inverse: the orb is a featureless moon, the body carries the eyes (parented to the body, which squashes with it)
    const cy = s.bodyHeight * 0.58;
    for (const sx of [-1, 1]) {
      const e = makeEye(sx);
      const x = sx * 0.13;
      const rzB = s.bodyRadius;
      const z = -rzB * Math.sqrt(Math.max(1 - (x / s.bodyRadius) ** 2 - ((cy - s.bodyHeight / 2) / (s.bodyHeight / 2)) ** 2, 0.01));
      e.position.set(x, cy, z + 0.005);
      body.add(e);
      eyes.push(e);
    }
  } else {
    const ex = variant === 'A' ? 0.135 : variant === 'B' ? 0.12 : 0.1;
    const ey = variant === 'A' ? 0.03 : 0.02;
    for (const sx of [-1, 1]) {
      const e = makeEye(sx);
      const x = sx * ex;
      e.position.set(x, ey, -surfaceZ(s.headRadius, x, ey) + 0.002);
      head.add(e);
      eyes.push(e);
    }
  }

  // ---- hands: detached floating mitts, children of pose ----
  const handRest: [number, number, number] = [s.bodyRadius + 0.22, hipHeight + s.bodyHeight * 0.45, -0.05];
  const hands: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const h = new THREE.Group();
    h.position.set(sx * handRest[0], handRest[1], handRest[2]);
    const r = s.handRadius;
    const palm = ellipsoid(r, r * 0.95, r * 0.85, 0, [14, 10]);
    const thumb = ellipsoid(r * 0.5, r * 0.45, r * 0.45, 0, [8, 6]);
    thumb.translate(sx * -r * 0.3, r * 0.65, -r * 0.35);
    const mitt = mergeGeometries([palm, thumb])!;
    palm.dispose(); thumb.dispose();
    h.add(blackMesh(mitt));
    pose.add(h);
    hands.push(h);
  }

  // ---- extras (head space) ----
  const extras: THREE.Object3D[] = [];
  const R = s.headRadius;
  if (variant === 'A') {
    // twig antlers: a main stem curving out and up, with two tines each side
    const parts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      const p = (x: number, y: number, z = 0) => new THREE.Vector3(sx * x, y, z);
      const base = p(0.1, R * 0.88);
      const m1 = p(0.2, R + 0.14, 0.01);
      const m2 = p(0.27, R + 0.3, 0.0);
      const tip = p(0.2, R + 0.46, -0.01);
      parts.push(rod(base, m1, 0.032), rod(m1, m2, 0.028), rod(m2, tip, 0.024));
      parts.push(rod(m1, p(0.38, R + 0.24, 0.02), 0.022), rod(m2, p(0.42, R + 0.42, 0.0), 0.02));
      parts.push(rod(m2, p(0.35, R + 0.5, 0.03), 0.018));
    }
    const merged = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    const antlers = blackMesh(merged);
    head.add(antlers);
    extras.push(antlers);
  } else if (variant === 'C') {
    // thin white halo (flat ring above the head) and one orbiting mote (a building block)
    const halo = whiteMesh(new THREE.TorusGeometry(R * 0.78, 0.022, 6, 28));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = R + 0.14;
    head.add(halo);
    extras.push(halo);
    const orbit = new THREE.Group(); // pivot at the head centre: animation spins it
    const mote = whiteMesh(new THREE.BoxGeometry(0.075, 0.075, 0.075));
    mote.position.set(R + 0.2, 0.05, 0);
    mote.rotation.set(0.5, 0.4, 0.2);
    orbit.add(mote);
    head.add(orbit);
    extras.push(orbit);
  }

  const dims: DeityDims = {
    height,
    hipHeight,
    hipHalfWidth: s.hipHalfWidth,
    legLength: s.legLength,
    bodyHeight: s.bodyHeight,
    bodyRadius: s.bodyRadius,
    headRadius: s.headRadius,
    headGap: s.headGap,
    headRestY,
    handRest,
    handRadius: s.handRadius,
    eyeLook: EYE_LOOK,
  };
  void bodyRz;

  return {
    root,
    pose,
    pelvis,
    body,
    legs: [legs[0], legs[1]],
    head,
    eyes: [eyes[0], eyes[1]],
    hands: [hands[0], hands[1]],
    extras,
    dims,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      geos.length = 0;
      mats.length = 0;
    },
  };
}
