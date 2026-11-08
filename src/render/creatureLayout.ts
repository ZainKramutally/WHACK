// Pure creature layouts (no three.js): a BodyPlan becomes parts in body space (x forward, y up, z lateral, metres, resting
// on y = 0). The two chemistries are different architectures:
//   axial (carbon): a head-to-tail chain of ellipsoid beads (trunk, tail, head, jaw), shields, crests, horns, paddle fins,
//     membrane wings, and IK limbs (soft tentacles or jointed legs);
//   radial (silicon): a faceted n-gon hub of stacked tiers, prism arms (rod, branching, fan, whip) with 15° joints, ceramic
//     tiles or crystal spikes, a spire crown, and dot-eye clusters at the arm tips.
// Every shape is a continuous or thresholded blend of the plan's derived traits, so mutation walks between forms.
import type { BodyPlan } from '../sim/develop';
import { SNAP_DEG, armPhase, solveTwoBone } from './motion';

export const BEAD_BODY = 0, BEAD_EYE = 1, BEAD_PLATE = 2, BEAD_LIMB = 3, BEAD_HORN = 4, BEAD_ACCENT = 5, BEAD_SPOT = 6;
export type BeadTone = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const TONES = 7;

/**
 * One ellipsoid of a creature. sx, sy, sz scale the radius along its own axes (x along the bead's yaw, y up, z across);
 * `flap` > 0 marks paddles and wings that swing with the body.
 */
export interface Bead { x: number; y: number; z: number; r: number; tone: BeadTone; sx?: number; sy?: number; sz?: number; yaw?: number; flap?: number }

/** A leg for 2-bone IK: hip in body space (resting on y = 0 ground), two bones, and the beads it is drawn with. */
export interface LimbRig {
  hip: { x: number; y: number; z: number };
  side: 1 | -1;
  pair: number;
  len1: number;
  len2: number;
  /** Bead radius at the hip; tentacles taper toward the foot. */
  r: number;
  taper: boolean;
  /** Beads per bone. */
  perBone: number;
  /** Index of this limb's first bead in BeadLayout.beads. */
  first: number;
  /** Joint snap in degrees (0 for carbon). */
  snap: number;
  /** Horizontal distance from the hip to the foot at rest. */
  restOut: number;
}

/**
 * A prism from a to b with radius r (silicon's straight, faceted parts), in body space, metres. `flat` < 1 squashes the
 * cross-section into a plate; `up` orients the wide side horizontally (blades) instead of along the body's forward axis.
 */
export interface Rod { ax: number; ay: number; az: number; bx: number; by: number; bz: number; r: number; tone: BeadTone; flat?: number; up?: boolean }
export const ROD_STRIDE = 9;

/** A radial body's arm: a rod chain from a hub facet, stepped with IK; dot eyes sit at its tip. */
export interface ArmRig {
  index: number;
  kind: 'rod' | 'branch' | 'fan' | 'whip';
  hip: { x: number; y: number; z: number };
  /** Outward unit direction in the ground plane (azimuth around the hub). */
  dirX: number; dirZ: number;
  len1: number; len2: number;
  r: number;
  snap: number;
  /** Horizontal hip→foot distance at rest, and the foot's rest height. */
  restOut: number; restFootY: number;
  /** Gait phase offset (tripod groups). */
  phase: number;
  /** Index of this arm's first rod in RadialLayout.rods, how many it has, and which one carries the eyes at its far end. */
  firstRod: number; nRods: number; tipRod: number;
  /** Fork the tip (branching arms, up to 6-fold only). */
  fork: boolean;
  /** Eye dots at the tip: first bead index, count, radius and offsets from the tip in the ground plane. */
  eyeFirst: number; eyeN: number; eyeR: number; eyeDX: number[]; eyeDZ: number[];
}

/** The prism parts of a radial (silicon) body. For these, BeadLayout.beads holds only the arm-tip eye dots. */
export interface RadialLayout {
  /** Hub tiers first (nTiers of them), then tiles and spires (up to nHubRods), then the arms' rods. */
  rods: Rod[];
  nTiers: number;
  /** Hub prism sides (3, 4, 5, 6 or 8) of the first nTiers rods. */
  hubSides: number;
  /** Count of rods before the arm rods (hub + tiles + spires). */
  nHubRods: number;
  arms: ArmRig[];
  /** Height of the hub's centre of rotation (for rolling), above the ground. */
  pivotY: number;
  /** Largest arm reach from the hub axis, for the roll radius. */
  rollRadius: number;
}

export interface BeadLayout {
  /** Axial bodies' limb bones as round tapered rods (two per limb: hip→knee, knee→foot), at their rest pose. */
  limbRods?: Rod[];
  /** Present for radial (silicon) bodies; axial (carbon) bodies are beads and limbs only. */
  radial?: RadialLayout;
  /** Body beads first (nBody of them), then limb beads at their rest pose. */
  beads: Bead[];
  nBody: number;
  limbs: LimbRig[];
  /** Half stride of the gait, in layout units. */
  stride: number;
  /** Bounding radius around the layout's centre, for picking. */
  radius: number;
  /** Height of the layout's centre above the ground. */
  centreY: number;
}

export const MAX_BEADS_PER_ORGANISM = 112;
export const MAX_RODS_PER_ORGANISM = 96;

/** A plain 5-bead worm for organisms whose plan hasn't arrived (sizes in metres). */
export function capsuleLayout(length: number): BeadLayout {
  const n = 5, s = length / n, r = Math.min(s * 0.7, length * 0.17);
  const beads: Bead[] = [];
  for (let i = 0; i < n; i++) beads.push({ x: (i - (n - 1) / 2) * s, y: r, z: 0, r, tone: BEAD_BODY });
  return { beads, nBody: beads.length, limbs: [], stride: 0, radius: length * 0.6, centreY: r };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Deterministic hash → [0, 1) for pattern placement. */
function h01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- axial layout (carbon) ---------------------------------------------------------------------------------------------
interface SpineBead { x: number; z: number; r: number; yaw: number; sx: number; sy: number; sz: number; y: number }

function axialLayout(plan: BodyPlan): BeadLayout {
  const n = Math.max(3, Math.round(plan.segmentCount));
  const tail = Math.max(0, Math.round(plan.tailSegments));
  const L = plan.scale;
  const s = L / (n + 0.6 * tail);
  const girth = plan.girth || 0.8, flatten = plan.flatten || 1;
  const rBase = Math.min(0.3 * L, 1.375 * s * girth);
  const nLegs = plan.legPairs > 0 && plan.limbLength > 0 ? plan.legPairs * 2 : 0;
  const reach = plan.limbLength * 0.55; // drawn shorter than the plan's reach so long-legged forms read as striders, not stilts
  const lift = nLegs > 0 ? 0.75 * reach : 0;

  // Radii along the trunk, tail end (i = 0) to head (i = n − 1).
  const trunkR: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let prof = 0.55 + 0.45 * Math.sin(Math.PI * (0.1 + 0.8 * t));
    prof *= 1 + plan.gradient * (t - 0.5) * 1.6;
    prof *= 1 + 0.3 * plan.carapace * Math.sin(Math.PI * t); // beetles broaden amidships
    if (i === n - 1) prof *= plan.headScale || 1;
    else if (i === n - 2) prof *= 1 + ((plan.headScale || 1) - 1) * 0.3;
    if (i === 0 && tail === 0) prof *= 0.6;
    trunkR.push(rBase * prof);
  }
  const rTail = trunkR[0];

  // Tail beads, tip first. The tail shape comes from tailKind.
  const tailBeads: { r: number; sx: number; sy: number; sz: number; tone: BeadTone }[] = [];
  if (plan.tailKind === 'whip') {
    for (let k = 0; k < tail; k++) {
      const f = (k + 1) / tail;
      tailBeads.push({ r: rTail * (0.12 + 0.5 * f * f), sx: 1.8, sy: 1, sz: 1, tone: BEAD_BODY });
    }
  } else if (plan.tailKind === 'fluke') {
    // an upright caudal fin (thin across), as the near LOD's lunate tail (faunaLib/aquatic), not a flat pad. Its height
    // is about the tail's depth and it is centred on the body axis (spine loop below): sy 2.4 standing on the ground
    // made far fish carry a fin taller than they are long, spiking out of shallow water.
    tailBeads.push({ r: rTail * 1.35, sx: 0.45, sy: 0.85, sz: 0.22, tone: BEAD_ACCENT });
    for (let k = 1; k < tail; k++) tailBeads.push({ r: rTail * 0.55, sx: 1, sy: 1, sz: 1, tone: BEAD_BODY });
  } else if (plan.tailKind === 'club') {
    tailBeads.push({ r: rTail * 1.35, sx: 1, sy: 1, sz: 1, tone: BEAD_PLATE });
    tailBeads.push({ r: rTail * 0.45, sx: 1.4, sy: 1, sz: 1, tone: BEAD_BODY });
  } else {
    for (let k = 0; k < tail; k++) tailBeads.push({ r: rTail * (0.3 + 0.3 * (k + 1) / tail), sx: 1.2, sy: 1, sz: 1, tone: BEAD_BODY });
  }
  // tailBeads is tip → base; the spine is built tip first as well.
  const N = tailBeads.length + n;
  const spine: SpineBead[] = [];
  // The rest spine is straight for every body (owner ruling): plan.curl is motion only (fauna.ts: lateral flexion while
  // walking, bending into turns), never a static sideways arc.
  let hx = 0;
  const stripe = Math.max(1, Math.round(n / (2 * (plan.bands + 1))));
  for (let j = 0; j < N; j++) {
    const isTail = j < tailBeads.length;
    const i = j - tailBeads.length; // trunk index
    const r = isTail ? tailBeads[j].r : trunkR[i];
    const sx = isTail ? tailBeads[j].sx : Math.max(1, 0.62 * s / Math.max(r, 1e-6));
    const sy = isTail ? tailBeads[j].sy : flatten;
    const sz = isTail ? tailBeads[j].sz : 1 + 0.25 * (1 - flatten);
    // legless beads rest on the ground (y = r·sy); a fluke's fin is centred on its neighbour's axis instead
    const finAxis = plan.tailKind === 'fluke' && j === 0
      ? (tailBeads.length > 1 ? tailBeads[1].r * tailBeads[1].sy : trunkR[0] * flatten) : -1;
    spine.push({ x: hx, z: 0, r, yaw: 0, sx, sy, sz, y: nLegs > 0 ? lift : finAxis >= 0 ? finAxis : r * sy });
    hx += s;
  }
  // Centre the chain on the origin and rotate so the head faces +x.
  const last = spine[N - 1];
  const cx = (spine[0].x + last.x) / 2, cz = (spine[0].z + last.z) / 2;
  const headDir = Math.atan2(last.z - spine[0].z, last.x - spine[0].x);
  const cosR = Math.cos(-headDir), sinR = Math.sin(-headDir);
  for (const p of spine) {
    const dx = p.x - cx, dz = p.z - cz;
    p.x = dx * cosR - dz * sinR;
    p.z = dx * sinR + dz * cosR;
    p.yaw -= headDir;
  }

  const body: Bead[] = [];
  const tone = (j: number): BeadTone => {
    const isTail = j < tailBeads.length;
    if (isTail) return tailBeads[j].tone;
    const i = j - tailBeads.length;
    return plan.bands > 0 && Math.floor(i / stripe) % 2 === 1 ? BEAD_ACCENT : BEAD_BODY;
  };
  for (let j = 0; j < N; j++) {
    const p = spine[j];
    body.push({ x: p.x, y: p.y, z: p.z, r: p.r, tone: tone(j), sx: p.sx, sy: p.sy, sz: p.sz, yaw: p.yaw });
  }
  const extras: Bead[] = [];
  const t0 = tailBeads.length;
  const head = spine[N - 1];

  // Shields: flat plates draped over the back, head end first; they grow into a carapace as it deepens. A silicon walker's
  // ceramic shell covers its shellCover share of the segments (plan v4; equal to plateCover in develop()).
  const nPlates = Math.min(n, Math.round((plan.shellCover > 0 ? plan.shellCover : plan.plateCover) * n));
  const shield = 0.5 + 0.55 * plan.carapace;
  for (let k = 0; k < nPlates; k++) {
    const p = spine[N - 1 - k];
    const sy = 0.35 + 0.5 * (1 - plan.carapace);
    extras.push({ x: p.x, y: p.y + p.r * p.sy * (0.78 + 0.2 * (1 - plan.carapace)), z: p.z, r: p.r * shield, tone: BEAD_PLATE, sx: 1.25, sy, sz: 1.1, yaw: p.yaw });
  }
  // Spots: small dots on the flanks, spread by a hash so the same plan always looks the same.
  const nSpots = Math.round(plan.spots * 6);
  for (let k = 0; k < nSpots; k++) {
    const i = Math.floor(h01(k, 7) * n);
    const p = spine[t0 + i];
    const side = h01(k, 3) < 0.5 ? 1 : -1;
    extras.push({ x: p.x, y: p.y + p.r * p.sy * 0.55, z: p.z + side * p.r * 0.8, r: p.r * 0.3, tone: BEAD_SPOT, sx: 1, sy: 1, sz: 0.5, yaw: p.yaw });
  }
  // Dorsal crest: upright blades along the spine, taller with `crest`.
  const nCrest = Math.min(12, Math.round(plan.crest * n));
  for (let k = 0; k < nCrest; k++) {
    const p = spine[t0 + Math.floor((k + 0.5) * n / Math.max(1, nCrest))];
    const h = 0.7 + 1.5 * plan.crest;
    extras.push({ x: p.x, y: p.y + p.r * p.sy * 0.95 + p.r * 0.45 * h, z: p.z, r: p.r * 0.5, tone: BEAD_ACCENT, sx: 0.25, sy: h, sz: 0.75, yaw: p.yaw });
  }

  // Head: eyes in pairs, a protruding jaw, and the horn layout.
  const hr = head.r;
  const nEyePairs = Math.min(3, Math.floor(plan.eyeCount / 2));
  const eyeR = Math.max(hr * 0.3, 0.01 * L);
  for (let k = 0; k < nEyePairs; k++) {
    for (const side of [1, -1]) {
      extras.push({ x: head.x + hr * (0.55 - 0.3 * k), y: head.y + hr * head.sy * (0.35 + 0.3 * k), z: head.z + side * hr * (0.65 - 0.05 * k), r: eyeR * (1 - 0.15 * k), tone: BEAD_EYE });
    }
  }
  if (plan.jaw > 0.05) {
    extras.push({ x: head.x + hr * (0.8 + 0.5 * plan.jaw), y: head.y - hr * head.sy * 0.35, z: head.z, r: hr * (0.55 + 0.35 * plan.jaw), tone: BEAD_HORN, sx: 1.3, sy: 0.35, sz: 0.9, yaw: head.yaw });
  }
  const hl = plan.hornLength;
  const hornR = (j: number) => Math.max(hr * 0.3 * (1 - 0.3 * j), 0.008 * L);
  if (plan.hornKind === 'pair') {
    for (const side of [1, -1]) {
      for (let j = 1; j <= 2; j++) extras.push({ x: head.x + hr * 0.4 + hl * 0.45 * j, y: head.y + hr * 0.5 + hl * 0.3 * j, z: head.z + side * hr * 0.5 * (1 + 0.1 * j), r: hornR(j), tone: BEAD_HORN });
    }
  } else if (plan.hornKind === 'tusk') {
    for (const side of [1, -1]) {
      for (let j = 1; j <= 3; j++) extras.push({ x: head.x + hr * (0.8 + 0.4 * j), y: head.y - hr * 0.3 + hl * 0.12 * j * j, z: head.z + side * hr * 0.5, r: hornR(j - 1) * 0.9, tone: BEAD_HORN });
    }
  } else if (plan.hornKind === 'crown') {
    const m = Math.max(2, plan.hornCount);
    for (let k = 0; k < m; k++) {
      const a = (-0.5 + k / (m - 1)) * 2.2; // arc over the head
      for (let j = 1; j <= 2; j++) extras.push({ x: head.x - hr * 0.1, y: head.y + hr * Math.cos(a) * (0.7 + 0.5 * j * 0.5) + hl * 0.25 * j, z: head.z + hr * Math.sin(a) * (0.7 + 0.5 * j * 0.5) * 1.1, r: hornR(j), tone: BEAD_HORN });
    }
  } else if (plan.hornKind === 'antler') {
    const branches = Math.max(1, Math.min(3, plan.hornCount - 3));
    for (const side of [1, -1]) {
      for (let j = 1; j <= 3; j++) extras.push({ x: head.x - hr * 0.1 - hl * 0.1 * j, y: head.y + hr * 0.5 + hl * 0.4 * j, z: head.z + side * (hr * 0.5 + hl * 0.28 * j), r: hornR(j - 1), tone: BEAD_HORN });
      for (let b = 0; b < branches; b++) {
        extras.push({ x: head.x + hl * 0.25 * (b + 1), y: head.y + hr * 0.5 + hl * (0.35 + 0.35 * b), z: head.z + side * (hr * 0.5 + hl * (0.2 + 0.28 * b) + hl * 0.2), r: hornR(2) * 0.8, tone: BEAD_HORN });
      }
    }
  }

  // Swimmers carry no paddle beads (owner feedback: flat pads read as round and detached). Their fins are drawn only by
  // the near LOD (faunaLib/aquatic: small rooted fins, or a plesiosaur's flippers); the tail fin comes from the tail kind.
  // Membrane wings on hoverers: two broad flat sails per side that flap.
  if (plan.wingSpan > 0.01) {
    const p = spine[t0 + Math.floor(0.7 * (n - 1))];
    const wr = p.r * (1.2 + 2.2 * plan.wingSpan);
    for (const side of [1, -1]) {
      extras.push({ x: p.x, y: p.y + p.r * p.sy * 0.6, z: p.z + side * (p.r * 0.7 + wr * 0.75), r: wr, tone: BEAD_ACCENT, sx: 0.85, sy: 0.09, sz: 1.0, yaw: p.yaw, flap: 1 });
      extras.push({ x: p.x - wr * 0.5, y: p.y + p.r * p.sy * 0.5, z: p.z + side * (p.r * 0.7 + wr * 1.6), r: wr * 0.6, tone: BEAD_ACCENT, sx: 0.8, sy: 0.07, sz: 1.0, yaw: p.yaw, flap: 1 });
    }
  }

  // Limbs: legPairs along the front two-thirds of the trunk as 2-bone rigs. Jointed legs are thin and untapered; tentacles
  // are fat and taper to the tip. Hips sit at body-centre height, and the body is lifted so a slightly bent leg reaches ground.
  const rigs: LimbRig[] = [];
  const bodyAll = [...body, ...extras];
  const bodyBeads = bodyAll.slice(0, MAX_BEADS_PER_ORGANISM - 2 * nLegs);
  const jointed = plan.limbKind === 'leg';
  if (nLegs > 0) {
    const perBone = 1;
    const rl = jointed ? Math.max(0.03 * L, rBase * 0.3, 0.04 * reach) : Math.max(0.04 * L, rBase * 0.5, 0.05 * reach);
    const restOut = Math.sqrt(Math.max(1e-6, (0.9 * reach) ** 2 - lift * lift));
    let first = bodyBeads.length;
    for (let pair = 0; pair < plan.legPairs; pair++) {
      const idx = t0 + Math.min(n - 1, Math.round((n - 1) * (0.2 + 0.75 * (plan.legPairs === 1 ? 0.5 : pair / (plan.legPairs - 1)))));
      const p = spine[idx];
      for (const side of [1, -1] as const) {
        rigs.push({
          hip: { x: p.x, y: lift, z: p.z + side * p.r * 0.7 }, side, pair,
          len1: reach / 2, len2: reach / 2, r: rl, taper: !jointed, perBone, first, snap: 0, restOut,
        });
        first += 2;
      }
    }
  }
  const all: Bead[] = bodyBeads.slice();
  const limbRods: Rod[] = [];
  for (const rig of rigs) {
    const j: number[] = [];
    limbJoints(rig, rig.hip.x, rig.r, rig.hip.z + rig.side * rig.restOut, j);
    // Two round tapered bones with a joint bead at the knee and a foot pad (jointed legs) or a tip bead (tentacles) at the end.
    limbRods.push(
      { ax: rig.hip.x, ay: rig.hip.y, az: rig.hip.z, bx: j[0], by: j[1], bz: j[2], r: rig.r, tone: BEAD_LIMB },
      { ax: j[0], ay: j[1], az: j[2], bx: j[3], by: j[4], bz: j[5], r: rig.r * 0.72, tone: BEAD_LIMB },
    );
    all.push({ x: j[0], y: j[1], z: j[2], r: rig.r * 0.95, tone: BEAD_LIMB });
    all.push(jointed
      ? { x: j[3], y: j[4], z: j[5], r: rig.r * 1.5, tone: BEAD_LIMB, sx: 1.5, sy: 0.5, sz: 1.2 }
      : { x: j[3], y: j[4], z: j[5], r: rig.r * 0.55, tone: BEAD_LIMB });
  }
  let maxY = -Infinity;
  for (const b of all) maxY = Math.max(maxY, b.y + b.r * (b.sy ?? 1));
  let rad = 0;
  for (const b of all) rad = Math.max(rad, Math.hypot(b.x, b.y - maxY / 2, b.z) + b.r * Math.max(b.sx ?? 1, b.sz ?? 1));
  return { beads: all, nBody: bodyBeads.length, limbs: rigs, limbRods, stride: 0.3 * reach, radius: rad, centreY: maxY / 2 };
}

// --- radial layout (silicon) ---------------------------------------------------------------------------------------
const MAX_TILES = 20;
const D15 = Math.PI / 12;

function radialLayout(plan: BodyPlan): BeadLayout {
  const N = plan.symmetry, tiers = Math.max(1, plan.tiers), L = plan.scale;
  const tierH = plan.tierHeight;
  const reach = plan.limbLength;
  const legged = plan.legPairs > 0;
  const kind = plan.armKind === 'none' ? 'rod' : plan.armKind;
  const lift = legged ? Math.max(tierH / 2, 0.75 * reach) : tierH / 2;
  const radii = plan.tierRadii.length === tiers ? plan.tierRadii : Array.from({ length: tiers }, () => plan.hubRadius);
  const rods: Rod[] = [], beads: Bead[] = [];
  const stripe = Math.max(1, Math.round(tiers / (plan.bands + 1)));

  // Hub tiers, bottom to top; stripes alternate the accent tone.
  for (let i = 0; i < tiers; i++) {
    const yc = lift + i * tierH;
    rods.push({ ax: 0, ay: yc - tierH / 2, az: 0, bx: 0, by: yc + tierH / 2, bz: 0, r: radii[i], tone: plan.bands > 0 && Math.floor(i / stripe) % 2 === 1 ? BEAD_ACCENT : BEAD_BODY });
  }
  const topY = lift + (tiers - 1) * tierH + tierH / 2;

  // Ceramic tiles flush on facets (top tier first); long ones are crystal spikes (a geode).
  const facets = tiers * N;
  const nTiles = Math.min(MAX_TILES, Math.round(plan.plateCover * facets));
  const tileT = tierH * (0.14 + 1.6 * plan.tileLength), tileR = 0.32 * tierH * (1 - 0.45 * plan.tileLength);
  for (let k = 0; k < nTiles; k++) {
    const tier = tiers - 1 - Math.floor(k / N), j = k % N;
    const az = ((j + 0.5) * 2 * Math.PI) / N;
    const ap = radii[tier] * Math.cos(Math.PI / N) - 0.3 * tileT, yc = lift + tier * tierH;
    const cx = Math.cos(az), cz = Math.sin(az);
    const spot = plan.spots > 0 && h01(k, 11) < plan.spots * 0.5;
    rods.push({ ax: cx * ap, ay: yc, az: cz * ap, bx: cx * (ap + tileT * 1.3), by: yc, bz: cz * (ap + tileT * 1.3), r: tileR, tone: spot ? BEAD_SPOT : BEAD_PLATE });
  }

  // Spire crown: a central spire and a ring of shorter ones tilted 15° outward. Two rods each (thick base, thin tip).
  const topR = radii[tiers - 1];
  const spireR = Math.max(0.12 * topR, 0.01 * L);
  const len = Math.max(plan.hornLength, 0.15 * L);
  const nSpires = Math.min(7, plan.hornCount);
  for (let k = 0; k < nSpires; k++) {
    const centre = k === 0;
    const ring = Math.max(1, nSpires - 1);
    const az = centre ? 0 : ((k - 1) * 2 * Math.PI) / ring + Math.PI / 6;
    const tilt = centre ? 0 : D15;
    const f = centre ? 1 : k % 2 === 1 ? 0.75 : 0.55;
    const dx = Math.sin(tilt) * Math.cos(az), dy = Math.cos(tilt), dz = Math.sin(tilt) * Math.sin(az);
    const ox = centre ? 0 : Math.cos(az) * 0.5 * topR, oz = centre ? 0 : Math.sin(az) * 0.5 * topR;
    const y0 = topY - 0.05 * tierH, sl = len * f;
    rods.push({ ax: ox, ay: y0, az: oz, bx: ox + dx * 0.6 * sl, by: y0 + dy * 0.6 * sl, bz: oz + dz * 0.6 * sl, r: spireR, tone: BEAD_HORN });
    rods.push({ ax: ox + dx * 0.55 * sl, ay: y0 + dy * 0.55 * sl, az: oz + dz * 0.55 * sl, bx: ox + dx * sl, by: y0 + dy * sl, bz: oz + dz * sl, r: spireR * 0.5, tone: BEAD_HORN });
  }
  const nHubRods = rods.length;

  // Arms from the lowest tier's vertices, plus eye dots at the tips.
  const arms: ArmRig[] = [];
  const armR = Math.max(0.04 * L, 0.16 * radii[0]);
  const restOut = legged ? Math.sqrt(Math.max(1e-6, (0.9 * reach) ** 2 - lift * lift)) : 0.9 * reach;
  const restFootY = legged ? armR : Math.max(armR, lift - 0.2 * reach);
  const eyesPerArm = plan.eyeKind === 'none' || plan.eyeCount === 0 ? 0 : Math.max(1, Math.round(plan.eyeCount / N));
  const eyeR = Math.max(1.1 * armR, 0.012 * L);
  const fork = kind === 'branch' && N <= 6;
  const nRods = kind === 'rod' ? 2 : kind === 'branch' ? (fork ? 6 : 4) : kind === 'fan' ? 3 : 4;
  const tipRod = kind === 'whip' ? 3 : 1;
  for (let k = 0; k < N; k++) {
    const az = (plan.arms[k]?.azimuthDeg ?? (360 / N) * k) * (Math.PI / 180);
    const dirX = Math.cos(az), dirZ = Math.sin(az);
    const rig: ArmRig = {
      index: k, kind, hip: { x: dirX * radii[0], y: lift, z: dirZ * radii[0] }, dirX, dirZ,
      len1: reach / 2, len2: reach / 2, r: armR, snap: SNAP_DEG, restOut, restFootY,
      phase: armPhase(k, N), firstRod: rods.length, nRods, tipRod, fork, eyeFirst: 0, eyeN: eyesPerArm, eyeR, eyeDX: [], eyeDZ: [],
    };
    const out: number[] = [];
    armRods(rig, rig.hip.x + dirX * restOut, restFootY, rig.hip.z + dirZ * restOut, out);
    const armTone: BeadTone = plan.bands > 1 && k % 2 === 1 ? BEAD_ACCENT : BEAD_LIMB;
    for (let i = 0; i < out.length; i += ROD_STRIDE) {
      rods.push({ ax: out[i], ay: out[i + 1], az: out[i + 2], bx: out[i + 3], by: out[i + 4], bz: out[i + 5], r: out[i + 6], tone: armTone, flat: out[i + 7] < 1 ? out[i + 7] : undefined, up: out[i + 8] > 0 ? true : undefined });
    }
    rig.eyeFirst = beads.length;
    for (let e = 0; e < eyesPerArm; e++) {
      const a = (2 * Math.PI * e) / Math.max(1, eyesPerArm);
      const ring = eyesPerArm === 1 ? 0 : 1.5 * eyeR;
      rig.eyeDX.push(Math.cos(a) * ring); rig.eyeDZ.push(Math.sin(a) * ring);
    }
    const tip = rods[rig.firstRod + tipRod];
    for (let e = 0; e < eyesPerArm; e++) beads.push({ x: tip.bx + rig.eyeDX[e], y: tip.by + eyeR * 0.6, z: tip.bz + rig.eyeDZ[e], r: eyeR, tone: BEAD_EYE });
    arms.push(rig);
  }

  let maxY = topY, rad = 0, maxOut = radii.reduce((m, r) => Math.max(m, r), 0);
  for (const r of rods) { maxY = Math.max(maxY, r.ay + r.r, r.by + r.r); maxOut = Math.max(maxOut, Math.hypot(r.bx, r.bz), Math.hypot(r.ax, r.az)); }
  const cy = maxY / 2;
  for (const r of rods) rad = Math.max(rad, Math.hypot(r.ax, r.ay - cy, r.az) + r.r, Math.hypot(r.bx, r.by - cy, r.bz) + r.r);
  for (const b of beads) rad = Math.max(rad, Math.hypot(b.x, b.y - cy, b.z) + b.r);
  return {
    beads, nBody: 0, limbs: [], stride: 0.3 * reach, radius: rad, centreY: cy,
    radial: { rods, nTiers: tiers, hubSides: N, nHubRods, arms, pivotY: lift + ((tiers - 1) * tierH) / 2, rollRadius: Math.max(maxOut, radii[0]) },
  };
}

/**
 * Rods of an arm for a foot at (fx, fy, fz) in body space (fy is the foot-centre height): the 2-bone IK in the vertical
 * plane through hip and foot, joints snapped to 15°, then the kind's extras: branching twigs at the knee (and the tip),
 * a flat fan blade at the foot, or two thinning whip segments that keep curving down. Appends ROD_STRIDE floats per rod
 * (ax, ay, az, bx, by, bz, r, flat, up) to `out`.
 */
export function armRods(rig: ArmRig, fx: number, fy: number, fz: number, out: number[]): void {
  const dx = fx - rig.hip.x, dz = fz - rig.hip.z;
  const u = Math.hypot(dx, dz) || 1e-6;
  const ex = dx / u, ez = dz / u;
  const sol = solveTwoBone(u, fy - rig.hip.y, rig.len1, rig.len2, rig.snap);
  const pt = (uu: number, vv: number) => [rig.hip.x + ex * uu, rig.hip.y + vv, rig.hip.z + ez * uu] as const;
  const [kx, ky, kz] = pt(sol.kneeU, sol.kneeV);
  const [px, py, pz] = pt(sol.footU, sol.footV);
  out.push(rig.hip.x, rig.hip.y, rig.hip.z, kx, ky, kz, rig.r, 1, 0);
  const r2 = rig.kind === 'whip' ? rig.r * 0.7 : rig.r * 0.8;
  out.push(kx, ky, kz, px, py, pz, r2, 1, 0);
  const d2 = [px - kx, py - ky, pz - kz];
  const l2 = Math.hypot(d2[0], d2[1], d2[2]) || 1e-6;
  // A direction rotated about the vertical by `phi`, of the second bone, scaled.
  const twig = (bx: number, by: number, bz: number, phi: number, len: number, r: number) => {
    const c = Math.cos(phi), s = Math.sin(phi);
    const tx = (d2[0] * c - d2[2] * s) / l2, tz = (d2[0] * s + d2[2] * c) / l2, ty = d2[1] / l2;
    out.push(bx, by, bz, bx + tx * len, by + ty * len, bz + tz * len, r, 1, 0);
  };
  if (rig.kind === 'branch') {
    twig(kx, ky, kz, Math.PI / 4, 0.7 * rig.len2, rig.r * 0.6);
    twig(kx, ky, kz, -Math.PI / 4, 0.7 * rig.len2, rig.r * 0.6);
    if (rig.fork) {
      twig(px, py, pz, Math.PI / 4, 0.4 * rig.len2, rig.r * 0.5);
      twig(px, py, pz, -Math.PI / 4, 0.4 * rig.len2, rig.r * 0.5);
    }
  } else if (rig.kind === 'fan') {
    // A flat blade continuing the arm: wide horizontally, thin vertically.
    out.push(px, py, pz, px + (d2[0] / l2) * 0.55 * rig.len2, py + (d2[1] / l2) * 0.55 * rig.len2, pz + (d2[2] / l2) * 0.55 * rig.len2, 0.85 * rig.len2, 0.12, 1);
  } else if (rig.kind === 'whip') {
    // Two more segments, each turning 30° further down in the arm's vertical plane (multiples of 15°).
    let th = sol.th2;
    let sx = px, sy = py, sz = pz, rr = r2;
    for (let k = 0; k < 2; k++) {
      th -= Math.PI / 6;
      rr *= 0.7;
      const l = rig.len2 * (k === 0 ? 0.75 : 0.55);
      const nx = sx + ex * Math.cos(th) * l, ny = sy + Math.sin(th) * l, nz = sz + ez * Math.cos(th) * l;
      out.push(sx, sy, sz, nx, ny, nz, rr, 1, 0);
      sx = nx; sy = ny; sz = nz;
    }
  }
}

/**
 * Turns a BodyPlan into a creature layout: ellipsoid beads for axial (carbon) bodies, prisms for radial (silicon) ones.
 * The architecture comes from the plan; the two share nothing but the BeadLayout envelope.
 */
export function beadLayout(plan: BodyPlan): BeadLayout {
  return plan.architecture === 'radial' ? radialLayout(plan) : axialLayout(plan);
}

/** Knee and foot positions (x, y, z each) of a limb for a foot at (fx, fy, fz): the IK solution without the bead chain. */
export function limbJoints(rig: LimbRig, fx: number, fy: number, fz: number, out: number[]): void {
  const dx = fx - rig.hip.x, dz = fz - rig.hip.z;
  const u = Math.hypot(dx, dz) || 1e-6;
  const ex = dx / u, ez = dz / u;
  const sol = solveTwoBone(u, fy - rig.hip.y, rig.len1, rig.len2, rig.snap);
  out.push(rig.hip.x + ex * sol.kneeU, rig.hip.y + sol.kneeV, rig.hip.z + ez * sol.kneeU);
  out.push(rig.hip.x + ex * sol.footU, rig.hip.y + sol.footV, rig.hip.z + ez * sol.footU);
}

/**
 * Bead positions of a limb for a foot at (fx, fy, fz) in body space (fy is the foot-centre height). Solves the 2-bone
 * IK in the vertical plane through hip and foot. Appends x, y, z, r for each bead to `out`.
 */
export function limbChain(rig: LimbRig, fx: number, fy: number, fz: number, out: number[]): void {
  const dx = fx - rig.hip.x, dz = fz - rig.hip.z;
  const u = Math.hypot(dx, dz) || 1e-6;
  const ex = dx / u, ez = dz / u;
  const sol = solveTwoBone(u, fy - rig.hip.y, rig.len1, rig.len2, rig.snap);
  const total = rig.perBone * 2;
  for (let bone = 0; bone < 2; bone++) {
    const u0 = bone === 0 ? 0 : sol.kneeU, v0 = bone === 0 ? 0 : sol.kneeV;
    const u1 = bone === 0 ? sol.kneeU : sol.footU, v1 = bone === 0 ? sol.kneeV : sol.footV;
    for (let k = 1; k <= rig.perBone; k++) {
      const f = k / rig.perBone, idx = bone * rig.perBone + k;
      const uu = u0 + (u1 - u0) * f, vv = v0 + (v1 - v0) * f;
      const r = rig.taper ? rig.r * (1 - 0.5 * (idx / total)) : rig.r;
      out.push(rig.hip.x + ex * uu, rig.hip.y + vv, rig.hip.z + ez * uu, r);
    }
  }
}
