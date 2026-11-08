// The astronaut (qodo's variant K) as a mesh rig implementing the DeityRig contract, a trial alternative to the deity.
// Proportions come from K's layout() (figure units, 1 tall), scaled to 1.5 m and turned to face -z (qodo faces +z).
// Primitives only: no shader port. One worldMaterial with vertex colours (cel shading and fog like the world), unlit eyes.
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldMaterial } from '../../render/material';
import { LOOK_PALETTES, mixHex } from '../../render/palette';
import type { DeityDims, DeityRig } from './rig';

// K's parameters (qodo astronaut.js), figure units.
const K = {
  headFrac: 0.57, helmetSink: 0.05, legShare: 0.535, torsoW: 0.16, torsoD: 0.121, torsoCorner: 0.65,
  armLen: 0.19, armR: 0.058, elbowBend: 0.6, legR: 0.07, legTaper: 0.92, hipX: 0.09,
  mittR: 0.063, bootW: 0.065, bootH: 0.045, bootL: 0.09, ringT: 0.018,
  packW: 0.184, packH: 0.137, packD: 0.079, packRound: 0.53,
};
const S = 1.5; // metres per figure unit

const PALC = LOOK_PALETTES.carbon;
const SUIT = PALC.bone;
const PACK = mixHex(PALC.bone, PALC.maroon, 0.22);
const GEAR = PALC.maroon;
const INK = PALC.ink;

/** Give a geometry a flat vertex colour (sRGB hex → linear, as worldMaterial's palette does). */
function paint(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p)); // RoundedBoxGeometry is non-indexed
  const g = mergeGeometries(flat)!;
  parts.forEach((p) => p.dispose());
  flat.forEach((p) => p.dispose());
  return g;
}
/** A ring (torus) of major radius r about `axis`, centred at c. */
function ring(c: THREE.Vector3, axis: THREE.Vector3, r: number, hex: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, K.ringT * S * 0.75, 12, 36);
  g.applyMatrix4(new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize()), new THREE.Vector3(1, 1, 1)));
  return paint(g, hex);
}

export function buildAstronaut(_opts: Record<string, never> = {}): DeityRig {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const keepG = <T extends THREE.BufferGeometry>(g: T): T => { geos.push(g); return g; };
  const keepM = <T extends THREE.Material>(m: T): T => { mats.push(m); return m; };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suitMat = keepM(worldMaterial({ kind: 'fauna', vertexColors: true }) as any as THREE.Material);
  const eyeMat = keepM(new THREE.MeshBasicNodeMaterial({ color: 0xffffff }));

  // ---- layout (metres) ----
  const headR = (K.headFrac / 2) * S;
  const headRestY = S - headR;
  const bodyTop = (1 - K.headFrac + K.helmetSink) * S;
  const hipHeight = K.legShare * bodyTop; // pelvis pivot = leg top, so feet sit at y = 0
  const bodyHeight = bodyTop - hipHeight;
  const tw = K.torsoW * S, td = K.torsoD * S, th = bodyHeight / 2;
  const armR = K.armR * S, legR = K.legR * S, mittR = K.mittR * S;
  const hipHalfWidth = Math.min(K.hipX, K.torsoW - 0.35 * K.legR) * S;
  const shoulderX = tw + 0.4 * armR, shoulderY = bodyHeight - 0.7 * armR; // pelvis space

  // ---- body: torso, shoulder and hip collars, neck seal, backpack (pelvis space, merged) ----
  const bp: THREE.BufferGeometry[] = [];
  const torso = new RoundedBoxGeometry(tw * 2, th * 2, td * 2, 7, Math.min(tw, th, td) * 0.97); // nearly a pill
  torso.translate(0, th, 0);
  bp.push(paint(torso, SUIT));
  const packC = new THREE.Vector3(0, th * 1.1, td + 0.75 * K.packD * S);
  const pack = new RoundedBoxGeometry(K.packW * S * 2, K.packH * S * 2, K.packD * S * 2, 6, 0.9 * Math.min(K.packW, K.packH, K.packD) * S);
  pack.translate(packC.x, packC.y, packC.z);
  bp.push(paint(pack, PACK));
  for (const s of [-1, 1]) {
    const u = new THREE.Vector3(s * Math.sin(0.785) * Math.cos(0.3), -Math.cos(0.785) * Math.cos(0.3), Math.sin(0.3));
    bp.push(ring(new THREE.Vector3(s * shoulderX, shoulderY, 0).addScaledVector(u, 0.3 * armR), u, armR + 0.25 * K.ringT * S, GEAR));
    bp.push(ring(new THREE.Vector3(s * hipHalfWidth, 0.02, 0), new THREE.Vector3(0, 1, 0), legR + 0.2 * K.ringT * S, GEAR));
  }
  const neckY = bodyHeight - 0.03;
  const dy = (neckY + hipHeight - headRestY) / headR;
  const neck = ring(new THREE.Vector3(0, neckY, 0), new THREE.Vector3(0, 1, 0), headR * Math.sqrt(Math.max(0.02, 1 - dy * dy)) + 0.2 * K.ringT * S, INK);
  bp.push(neck);
  const body = new THREE.Mesh(keepG(merge(bp)), suitMat);

  const root = new THREE.Group();
  const pose = new THREE.Group();
  root.add(pose);
  const pelvis = new THREE.Group();
  pelvis.position.set(0, hipHeight, 0);
  pose.add(pelvis);
  pelvis.add(body);
  const shoulders = [-1, 1].map((s) => {
    const o = new THREE.Object3D();
    o.position.set(s * shoulderX, shoulderY, 0);
    body.add(o);
    return o;
  });

  // ---- legs: thigh (hip → knee) and shin + boot (knee → sole); the knee pivot sits a little below halfway ----
  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const L = hipHeight, kneeY = -0.55 * L, bootRy = 0.07;
  const sphereAt = (r: number, y: number, hex: number) => paint(new THREE.SphereGeometry(r, 20, 14).translate(0, y, 0), hex);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * hipHalfWidth, 0, 0);
    const kneeR = legR * 0.96;
    const thigh = new THREE.CylinderGeometry(legR, kneeR, -kneeY, 16, 1);
    thigh.translate(0, kneeY / 2, 0);
    leg.add(new THREE.Mesh(keepG(merge([paint(thigh, SUIT), sphereAt(kneeR, kneeY, SUIT)])), suitMat));
    const knee = new THREE.Group();
    knee.position.set(0, kneeY, 0);
    leg.add(knee);
    const shinLen = L + kneeY - bootRy * 0.8; // knee → ankle
    const shin = new THREE.CylinderGeometry(kneeR, legR * K.legTaper, shinLen, 16, 1);
    shin.translate(0, -shinLen / 2, 0);
    const boot = new THREE.SphereGeometry(1, 24, 16);
    boot.scale(legR * 1.4, bootRy, K.bootL * S * 1.55);
    boot.translate(0, -(L + kneeY) + bootRy, -K.bootL * S * 0.55);
    const cuff = ring(new THREE.Vector3(0, -shinLen, 0), new THREE.Vector3(0, 1, 0), legR * K.legTaper * 1.12, GEAR);
    knee.add(new THREE.Mesh(keepG(merge([paint(shin, SUIT), paint(boot, INK), cuff])), suitMat));
    pelvis.add(leg);
    legs.push(leg);
    knees.push(knee);
  }

  // ---- head: helmet sphere + ink visor, child of pose (attached to the body by the animator) ----
  const head = new THREE.Group();
  head.position.set(0, headRestY, 0);
  pose.add(head);
  // Visor: a big ink ellipsoid shell wrapped over ~80% of the helmet's front, just proud of the surface.
  const visorRx = headR * 0.9, visorRy = headR * 0.74, visorRz = headR * 0.6, visorCz = -headR * 0.44, visorCy = headR * 0.04;
  const visor = new THREE.SphereGeometry(1, 48, 32);
  visor.scale(visorRx, visorRy, visorRz);
  visor.translate(0, visorCy, visorCz);
  head.add(new THREE.Mesh(keepG(merge([paint(new THREE.SphereGeometry(headR, 56, 40), SUIT), paint(visor, INK)])), suitMat));
  head.userData.visor = { rx: visorRx, ry: visorRy, cy: visorCy };

  // Eyes: big round white discs (each ~32% of the visor width), low-set and apart, tilted to the visor normal.
  const eyes: THREE.Object3D[] = [];
  const eyeR = visorRx * 2 * 0.16, eyeX = visorRx * 0.42, eyeY = visorCy - visorRy * 0.16;
  const sq = Math.sqrt(Math.max(0.01, 1 - (eyeX / visorRx) ** 2 - ((eyeY - visorCy) / visorRy) ** 2));
  const eyeZ = visorCz - visorRz * sq;
  for (const s of [-1, 1]) {
    const g = keepG(new THREE.SphereGeometry(eyeR, 28, 20));
    g.scale(1, 1, 0.4); // a dome on the visor curve
    const e = new THREE.Mesh(g, eyeMat);
    const n = new THREE.Vector3(s * eyeX / (visorRx * visorRx), (eyeY - visorCy) / (visorRy * visorRy), (eyeZ - visorCz) / (visorRz * visorRz)).normalize();
    e.position.set(s * eyeX, eyeY, eyeZ).addScaledVector(n, -eyeR * 0.14);
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), n);
    head.add(e);
    eyes.push(e);
  }

  // ---- mitts: sphere + wrist cuff, children of pose ----
  const handRest: [number, number, number] = [shoulderX + 0.05, hipHeight + shoulderY - K.armLen * S * 0.95, -0.03];
  const hands: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Group();
    h.position.set(s * handRest[0], handRest[1], handRest[2]);
    const mitt = new THREE.SphereGeometry(mittR, 32, 22);
    const cuff = ring(new THREE.Vector3(0, mittR * 0.72, 0), new THREE.Vector3(0, 1, 0), mittR * 0.82, GEAR);
    h.add(new THREE.Mesh(keepG(merge([paint(mitt, SUIT), cuff])), suitMat));
    pose.add(h);
    hands.push(h);
  }

  // ---- arms: two tubes per side (shoulder → elbow → mitt), refit by update() ----
  const armGeo = keepG(paint(new THREE.CylinderGeometry(1, 1, 1, 12, 1).translate(0, 0.5, 0), SUIT));
  const L1 = (K.armLen * S) * 0.51, L2 = (K.armLen * S) * 0.49, reach = L1 + L2;
  const tubes = [0, 1].map(() => [new THREE.Mesh(armGeo, suitMat), new THREE.Mesh(armGeo, suitMat)] as const);
  for (const [a, b] of tubes) { a.scale.set(armR, 1, armR); b.scale.set(armR * 0.93, 1, armR * 0.93); pose.add(a, b); }
  const sh = new THREE.Vector3(), hd = new THREE.Vector3(), el = new THREE.Vector3(), end = new THREE.Vector3(), d = new THREE.Vector3(), pole = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  const fit = (m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, r: number) => {
    d.subVectors(to, from);
    const len = Math.max(d.length(), 1e-4);
    m.position.copy(from);
    m.quaternion.copy(q.setFromUnitVectors(up, d.multiplyScalar(1 / len)));
    m.scale.set(r, len, r);
  };
  const update = () => {
    pose.updateWorldMatrix(true, true);
    [0, 1].forEach((i) => {
      const s = i === 0 ? -1 : 1;
      shoulders[i].getWorldPosition(sh); pose.worldToLocal(sh);
      hands[i].getWorldPosition(hd); pose.worldToLocal(hd);
      d.subVectors(hd, sh);
      const dist = d.length();
      d.multiplyScalar(1 / Math.max(dist, 1e-4));
      // two-bone IK with fixed bone lengths: past reach the tube end is clamped (the mitt detaches), never stretched
      const dc = Math.min(Math.max(dist, 0.02), reach);
      const a = (L1 * L1 - L2 * L2 + dc * dc) / (2 * dc);
      const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
      pole.set(s * 0.35, 0, 1); pole.addScaledVector(d, -pole.dot(d)); // elbow back and a little outward
      if (pole.lengthSq() < 1e-6) pole.set(0, 0, 1);
      pole.normalize();
      el.copy(sh).addScaledVector(d, a).addScaledVector(pole, h);
      end.copy(sh).addScaledVector(d, dc);
      fit(tubes[i][0], sh, el, armR);
      fit(tubes[i][1], el, end, armR * 0.93);
    });
  };

  const dims: DeityDims = {
    height: S, hipHeight, hipHalfWidth, legLength: hipHeight, bodyHeight, bodyRadius: tw, headRadius: headR,
    headGap: headRestY - headR - bodyTop, headRestY, handRest, handRadius: mittR, eyeLook: 0.04,
    shoulder: [shoulderX, hipHeight + shoulderY, 0], armReach: reach,
  };
  update();

  return {
    root, pose, pelvis, body,
    legs: [legs[0], legs[1]], knees: [knees[0], knees[1]], head, eyes: [eyes[0], eyes[1]], hands: [hands[0], hands[1]],
    extras: [], dims, headAttached: true, update,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      geos.length = 0; mats.length = 0;
    },
  };
}
