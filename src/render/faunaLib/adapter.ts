// Pure adapter (no three.js): a BodyPlan (through its BeadLayout from creatureLayout.ts) becomes a Red World fauna
// description: a smooth lofted body plus sculpted parts, every one anchored to the layout's beads or rods so the
// existing motion (swim wave, bell pulse, sway, IK legs, tripod arms, rolling) drives the new look unchanged.
//   axial (carbon): a loft through the spine beads, tail cap to head dome; shields, crest frills, paddle fins, membrane
//     wings, a muzzle or tapered lower jaw, horns, spots, paired ring eyes with a bone catchlight; jointed or tentacle legs (posed per frame).
//   radial (silicon): a lofted crystal hub (rounded n-gon cross-section, one stepped band per tier); hex ceramic tiles,
//     spire crown, straight rod arms with 15° joints and cyan dot eyes at the arm tips. Never bilateral: no head, no pairs.
// One body colour + one accent (Red World rule): every part takes `body` or `accent`, plus ink/bone eyes and glow.
import type { BodyPlan } from '../../sim/develop';
import {
  BEAD_ACCENT, BEAD_BODY, BEAD_EYE, BEAD_HORN, BEAD_PLATE, BEAD_SPOT, beadLayout, mouthBite, type BeadLayout,
} from '../creatureLayout';

/** Shared instanced part geometries (render/faunaLib/parts.ts builds one mesh per type). Types ending in Si are silicon's
 *  (their material carries the pale rim); `knob` is carbon's sphere (eyes, knees, tips) and `knobSi` silicon's. */
export const PART_TYPES = ['thighC', 'rodC', 'thighSi', 'rodSi', 'plateC', 'plateSi', 'hornC', 'hornSi', 'frill', 'knob', 'ring', 'knobSi', 'fin'] as const;
export type PartType = (typeof PART_TYPES)[number];
export const PART = Object.fromEntries(PART_TYPES.map((t, i) => [t, i])) as Record<PartType, number>;

/** Colour slots per creature: body + accent (from creatureColour), eye (ink on carbon, cyan on silicon), bone, glow. */
/** `hard`: plates, horns, teeth and ceramic tiles, coloured by the world's minerals (fauna-colour §2.2; creatureHard). */
export const SLOT = { body: 0, accent: 1, eye: 2, bone: 3, glow: 4, hard: 5 } as const;
export const SLOTS = 6;

/** Loft caps. Axial: rings along the spine (10 sides). Radial: rings up the hub axis (24 sides, so 3-, 4-, 6-, 8-fold
 *  divide; at most 2 + 3·5 + 1 + 2 = 20 rings for 5 tiers). Gas bells: 12 rings of 16 sides. */
export const AX_RINGS = 40, AX_SIDES = 10;
export const RAD_RINGS = 20, RAD_SIDES = 24;
export const BELL_RINGS = 12, BELL_SIDES = 16;
/** Static parts per creature (legs, arms, bells and tendrils are posed per frame and capped separately). */
export const MAX_STATIC_PARTS = 64;
export const TENDRILS = 6, TENDRIL_LINKS = 6;

/**
 * A part anchored to the layout. b < 0: placed in bead a's yaw frame (x forward, y up, z lateral) at offset (ox, oy, oz)
 * with axis scales (sx, sy, sz), all in units of bead a's radius. b ≥ 0: a span along a→b (beads, or rods when
 * `rod`), from fraction t0 to t1, with radius r × the radius of bead/rod `rRef` (and `flat` squashing the second axis).
 */
export interface PartDesc {
  type: number; slot: number; glow: number;
  a: number; b: number; rod: boolean;
  ox: number; oy: number; oz: number; sx: number; sy: number; sz: number;
  t0: number; t1: number; r: number; rRef: number; flat: number;
}

export interface LoftRing { bead: number; slot: number }

export interface AxialDesc {
  kind: 'axial';
  /** Spine beads the loft runs through, tail end first, and their colour slot (bands). */
  spine: LoftRing[];
  /** Mid rings between consecutive spine beads (1 when the ring budget allows, else 0). */
  mids: number;
  /** Silicon bilateral walkers: hexagonal flat-shaded segments, stepped (a waist ring between segments), Si parts. */
  faceted: boolean;
  /** Head and tail cap lengths in units of the end bead's radius. */
  headCap: number; tailCap: number;
  parts: PartDesc[];
  /** Legs: one per LimbRig, posed per frame. Pairs share `pair`; sides are ±1. */
  legs: { rig: number; side: 1 | -1; pair: number; jointed: boolean }[];
  /** Bead indices that are eyes (for picking/tests) and the head bead. */
  eyes: number[]; head: number;
  /** Floater bell (used while the creature hovers): radius and height in body metres, and the spine bead it rides over. */
  bell: { r: number; h: number; over: number };
}

export interface RadialDesc {
  kind: 'radial';
  /** n-fold symmetry of the hub cross-section (= arm count). */
  sides: number;
  tiers: number;
  /** Corner rounding of the n-gon cross-section, 0 round … 1 sharp. */
  facet: number;
  parts: PartDesc[];
  /** One per arm, posed per frame from the arm rods: first rod, rod count, kind. */
  arms: { firstRod: number; nRods: number; tipRod: number; kind: string; eyeFirst: number; eyeN: number }[];
  eyes: number[];
  bell: { r: number; h: number; over: number };
}

export type FaunaDesc = AxialDesc | RadialDesc;

function part(p: Partial<PartDesc> & { type: number; a: number }): PartDesc {
  return {
    slot: SLOT.body, glow: 0, b: -1, rod: false, ox: 0, oy: 0, oz: 0, sx: 1, sy: 1, sz: 1, t0: 0, t1: 1, r: 1, rRef: p.a, flat: 1, ...p,
  };
}

/** Number of spine beads axialLayout puts first in `beads` (tail tip → head). Mirrors creatureLayout's axial grammar. */
export function spineCount(plan: BodyPlan): number {
  const n = Math.max(3, Math.round(plan.segmentCount));
  const tail = Math.max(0, Math.round(plan.tailSegments));
  const nt = plan.tailKind === 'whip' ? tail : plan.tailKind === 'fluke' ? 1 + Math.max(0, tail - 1) : plan.tailKind === 'club' ? 2 : tail;
  return nt + n;
}

/** Expressed glow above this lights up (the inspect card names glow above 0.1). */
export const GLOW_MIN = 0.1;

function axialDesc(plan: BodyPlan, lay: BeadLayout): AxialDesc {
  const N = spineCount(plan), beads = lay.beads, head = N - 1;
  const parts: PartDesc[] = [];
  // Silicon's axial grammar (armoured walkers, plan v4): the same body plan as carbon's, built angular. Hex segments,
  // silicon-nitride shell tiles where carbon has domed shields (the layout's plates follow plateCover = shellCover),
  // straight spikes for horns and crest, faceted dot eyes, and the silicon part material (pale rim).
  const si = plan.chemistry === 'silicon';
  const KNOB = si ? PART.knobSi : PART.knob, PLATE = si ? PART.plateSi : PART.plateC, HORN = si ? PART.hornSi : PART.hornC;
  const glowing = plan.glow > GLOW_MIN;
  // Loft beads: the whole spine, except a fluke or club at the tail tip (drawn as parts).
  const skipTip = plan.tailKind === 'fluke' || plan.tailKind === 'club';
  const spine: LoftRing[] = [];
  for (let j = skipTip ? 1 : 0; j < N; j++) spine.push({ bead: j, slot: beads[j].tone === BEAD_ACCENT ? SLOT.accent : SLOT.body });
  // fluke: an upright two-lobed caudal fin of fin parts rooted on the tail tip and swept back, as the near LOD's lunate
  // tail (no flat pad). Chord back, span up or down, thickness flipped to keep each basis right-handed.
  if (plan.tailKind === 'fluke') for (const up of [1, -1]) parts.push(part({ type: PART.fin, a: 0, slot: SLOT.accent, ox: 0.35, sx: -1.1, sy: 1.0 * up, sz: -0.4 * up }));
  if (plan.tailKind === 'club') parts.push(part({ type: KNOB, a: 0, slot: SLOT.hard, sx: 1.05, sy: 0.95, sz: 1.05 })); // a bony club
  const mids = 2 * spine.length - 1 + 6 <= AX_RINGS ? 1 : 0;

  // Extras, in the order axialLayout emits them; classified by tone and shape.
  const nBody = lay.nBody;
  const horns: number[] = [];
  const eyes: number[] = [];
  // the mouth (creatureLayout): a body-tone muzzle bead is the only body-tone extra; a jaw is a hinge + tip bead pair
  const bite = mouthBite(plan);
  let muzzle = -1;
  const teeth: PartDesc[] = [];
  for (let i = N; i < nBody; i++) if (beads[i].tone === BEAD_BODY) { muzzle = i; break; }
  for (let i = N; i < nBody; i++) {
    const b = beads[i];
    if (b.tone === BEAD_PLATE) {
      // shield: a domed plate shingled over the back (silicon: a flat hexagonal ceramic shell tile)
      if (si) parts.push(part({ type: PART.plateSi, a: i, slot: SLOT.hard, sx: 1.0 * (b.sx ?? 1), sy: 0.42 * (b.sy ?? 1), sz: 1.0 * (b.sz ?? 1), oy: -0.25 }));
      else parts.push(part({ type: PART.plateC, a: i, slot: SLOT.hard, sx: 0.95 * (b.sx ?? 1), sy: 0.55 * (b.sy ?? 1), sz: 0.95 * (b.sz ?? 1), oy: -0.3 }));
    } else if (b.tone === BEAD_SPOT) {
      parts.push(part({ type: KNOB, a: i, slot: glowing ? SLOT.glow : SLOT.accent, glow: glowing ? plan.glow : 0, sx: 0.9, sy: 0.9, sz: 0.5 }));
    } else if (b.tone === BEAD_ACCENT && (b.flap ?? 0) > 0) {
      // membrane wings on hoverers (flap 1): thin discs, accent. Swimmers have no flapping beads (creatureLayout: their
      // fins are the near LOD's, faunaLib/aquatic), so no pad is ever drawn on a swimmer.
      if ((b.flap ?? 0) >= 0.9) parts.push(part({ type: PLATE, a: i, slot: SLOT.accent, sx: 0.95 * (b.sx ?? 1), sy: 0.9 * (b.sy ?? 1), sz: 1.0 * (b.sz ?? 1) }));
    } else if (b.tone === BEAD_ACCENT && si) {
      // dorsal crest → a straight spike rod standing on the back (silicon's dorsal is rods), from the back surface up
      const h = b.sy ?? 1;
      parts.push(part({ type: PART.hornSi, a: i, slot: SLOT.accent, oy: -0.9 * h, sx: 0.28, sy: 1.9 * h, sz: 0.28 }));
    } else if (b.tone === BEAD_ACCENT) {
      // dorsal crest blade → a scalloped frill standing on the back (x backward along the body, y up)
      parts.push(part({ type: PART.frill, a: i, slot: SLOT.accent, ox: 0.9, oy: -0.45 * (b.sy ?? 1), sx: -1.9, sy: 1.0 * (b.sy ?? 1), sz: 0.7 }));
    } else if (b.tone === BEAD_EYE && si) {
      // silicon dot eyes: a faceted bead in the eye slot (cyan), no ring or catchlight
      eyes.push(i);
      parts.push(part({ type: PART.knobSi, a: i, slot: SLOT.eye, sx: 0.8, sy: 0.8, sz: 0.8 }));
    } else if (b.tone === BEAD_EYE) {
      eyes.push(i);
      // eyeball (ink), a bone ring rim around it, and a bone catchlight up-forward-out
      parts.push(part({ type: PART.knob, a: i, slot: SLOT.eye }));
      parts.push(part({ type: PART.ring, a: head, b: i, t0: 1, t1: 1.12, r: 1.02, rRef: i }));
      const side = b.z >= beads[head].z ? 1 : -1;
      parts.push(part({ type: PART.knob, a: i, slot: SLOT.bone, ox: 0.35, oy: 0.45, oz: side * 0.6, sx: 0.3, sy: 0.3, sz: 0.3 }));
    } else if (b.tone === BEAD_BODY && i === muzzle) {
      // grazer's muzzle: a body-tone swelling at the front-bottom of the head, so the snout is blunt and turned down
      parts.push(part({ type: KNOB, a: i, sx: b.sx ?? 1, sy: b.sy ?? 1, sz: b.sz ?? 1 }));
    } else if (b.tone === BEAD_HORN && b.sx !== undefined && i + 1 < nBody && beads[i + 1].sx !== undefined) {
      // lower jaw: a tapered wedge from the hinge bead (i) to the tip bead (i + 1), wider than deep, tucked under the
      // snout (thighC tapers to 0.4 at its tip; silicon's hexagonal thighSi makes a faceted mandible)
      const JAW = si ? PART.thighSi : PART.thighC, JAW_SLOT = SLOT.hard; // jaws are hard parts: they wear the world's mineral (fauna-colour.md)
      parts.push(part({ type: JAW, slot: JAW_SLOT, a: i, b: i + 1, t0: -0.15, t1: 1.3, r: 0.75, rRef: i, flat: 1.45 }));
      if (!si && plan.gapeSize > 1.6 * plan.scale && bite > 0.5) {
        // big gape: two small bone teeth per side standing on the jaw's rim, on the hinge bead's frame (added last, so
        // the part cap drops them before any horn)
        const span = (beads[i + 1].x - b.x) / b.r;
        for (const f of [0.55, 0.9]) for (const side of [1, -1]) {
          teeth.push(part({ type: PART.knob, a: i, slot: SLOT.bone, ox: span * f, oy: 0.35 - 0.15 * f, oz: side * (0.95 - 0.35 * f), sx: 0.13, sy: 0.24, sz: 0.13 }));
        }
      }
      i++; // the tip bead is part of the same jaw
    } else if (b.tone === BEAD_HORN) {
      horns.push(i);
    }
  }
  // Horns: chains of beads by kind → one tapered horn per chain (accent).
  const chains: number[][] = [];
  const take = (k: number) => { if (horns.length) chains.push(horns.splice(0, Math.min(k, horns.length))); };
  if (plan.hornKind === 'antler') {
    const branches = Math.max(1, Math.min(3, plan.hornCount - 3));
    for (let side = 0; side < 2 && horns.length; side++) { take(3); for (let b = 0; b < branches; b++) take(1); }
  }
  const per = plan.hornKind === 'tusk' ? 3 : 2;
  while (horns.length) take(per);
  for (const c of chains) {
    const a = c[0], z = c[c.length - 1];
    if (c.length === 1) parts.push(part({ type: HORN, slot: SLOT.hard, a: head, b: a, t0: 0.55, t1: 1.25, r: 1.2, rRef: a }));
    else parts.push(part({ type: HORN, slot: SLOT.hard, a, b: z, t0: -0.45, t1: 1.15, r: 1.35, rRef: a }));
  }
  // Glow from darkness: photophores along the flanks when the plan glows and has no spots to carry it.
  if (glowing && !parts.some((p) => p.slot === SLOT.glow)) {
    const k = 2 + 2 * Math.round(2 * plan.glow);
    for (let q = 0; q < k; q++) {
      const j = spine[Math.min(spine.length - 1, Math.floor(((q >> 1) + 0.5) * spine.length / (k / 2)))].bead;
      const side = q & 1 ? 1 : -1;
      parts.push(part({ type: KNOB, a: j, slot: SLOT.glow, glow: plan.glow, oy: 0.35, oz: side * 0.85, sx: 0.16, sy: 0.16, sz: 0.16 }));
    }
  }
  parts.push(...teeth);
  const legs = lay.limbs.map((rig, k) => ({ rig: k, side: rig.side, pair: rig.pair, jointed: plan.limbKind === 'leg' }));
  let rMax = 0, over = head;
  for (const s of spine) if (beads[s.bead].r > rMax) { rMax = beads[s.bead].r; over = s.bead; }
  // head cap: hunters taper to a wedge snout over the jaw; grazers stay blunt
  return {
    kind: 'axial', spine, mids, faceted: si, headCap: si ? 0.8 + 0.3 * bite : 0.92 + 0.6 * bite, tailCap: plan.tailKind === 'whip' ? 1.6 : 1.1,
    parts: parts.slice(0, MAX_STATIC_PARTS), legs, eyes, head,
    bell: { r: rMax * (2.2 + 0.8 * plan.wingSpan), h: rMax * (3.2 + 1.0 * plan.wingSpan), over },
  };
}

function radialDesc(plan: BodyPlan, lay: BeadLayout): RadialDesc {
  const R = lay.radial!;
  const parts: PartDesc[] = [];
  // Tiles (flush ceramic hexes, or crystal spikes when long) and spires (pairs of rods: thick base, thin tip).
  for (let i = R.nTiers; i < R.nHubRods; i++) {
    const rd = R.rods[i];
    if (rd.tone === BEAD_HORN) {
      parts.push(part({ type: PART.hornSi, rod: true, a: i, b: i + 1, t0: 0, t1: 1, r: 1.25, rRef: i, slot: SLOT.hard }));
      i++; // the tip rod is part of the same spire
    } else {
      const spike = plan.tileLength > 0.5;
      parts.push(part({ type: spike ? PART.hornSi : PART.plateSi, rod: true, a: i, b: i, t0: spike ? 0 : -0.15, t1: spike ? 1.2 : 0.5, r: spike ? 1.1 : 1.15, rRef: i, slot: rd.tone === BEAD_SPOT ? SLOT.accent : SLOT.hard }));
    }
  }
  const eyes = lay.beads.map((_, i) => i);
  const arms = R.arms.map((a) => ({ firstRod: a.firstRod, nRods: a.nRods, tipRod: a.tipRod, kind: a.kind, eyeFirst: a.eyeFirst, eyeN: a.eyeN }));
  const topR = R.rods[R.nTiers - 1].r, top = R.rods[R.nTiers - 1].by;
  return {
    kind: 'radial', sides: R.hubSides, tiers: R.nTiers, facet: 0.55, parts: parts.slice(0, MAX_STATIC_PARTS), arms, eyes,
    bell: { r: Math.max(topR, R.rods[0].r) * 1.5, h: Math.max(topR, R.rods[0].r) * 1.9, over: top },
  };
}

/** BodyPlan → its bead layout (for picking and the inspect view) and its Red World fauna description. Pure. */
export function faunaFor(plan: BodyPlan): { layout: BeadLayout; desc: FaunaDesc } {
  const layout = beadLayout(plan);
  return { layout, desc: describe(plan, layout) };
}

export function describe(plan: BodyPlan, layout: BeadLayout): FaunaDesc {
  return layout.radial ? radialDesc(plan, layout) : axialDesc(plan, layout);
}

/** Posed parts per creature at most (legs: thigh, knee, shin, pad, 3 claws; arms: up to 6 rods + knee + tip; tendrils). */
export function posedPartsCap(desc: FaunaDesc): number {
  const tendrils = TENDRILS * (TENDRIL_LINKS + 2);
  if (desc.kind === 'axial') return desc.legs.length * 7 + tendrils;
  return desc.arms.reduce((s, a) => s + a.nRods + 2 + a.eyeN, 0) + tendrils;
}

/** A sphere in body units (x forward, y up, z lateral), for picking. */
export interface BodySphere { x: number; y: number; z: number; r: number }

/**
 * The gas bell a carbon floater rides under (fauna.ts draws it over spine bead `bell.over`, from 0.55 of that bead's
 * radius above its centre, `bell.h` tall and `bell.r` wide at its widest), as one sphere at rest pose. Pure.
 */
export function bellSphere(d: AxialDesc, lay: BeadLayout): BodySphere {
  const b = lay.beads[d.bell.over];
  const base = b.y + b.r * 0.55;
  return { x: b.x, y: base + 0.5 * d.bell.h, z: b.z, r: Math.max(d.bell.r, 0.5 * d.bell.h) };
}

/**
 * Broad-phase pick bounds (centre height and radius, body units, about the body's vertical axis) of a layout, grown
 * to hold its bell when it carries one, so a click on the bell reaches the narrow phase. Pure.
 */
export function pickBounds(lay: BeadLayout, bell: BodySphere | null): { cy: number; r: number } {
  if (!bell) return { cy: lay.centreY, r: lay.radius };
  const lo = Math.min(lay.centreY - lay.radius, bell.y - bell.r), hi = Math.max(lay.centreY + lay.radius, bell.y + bell.r);
  const cy = (lo + hi) / 2;
  // the farthest point of either sphere from (0, cy, 0)
  const reach = (x: number, y: number, z: number, r: number) => Math.sqrt(x * x + (y - cy) * (y - cy) + z * z) + r;
  return { cy, r: Math.max(reach(0, lay.centreY, 0, lay.radius), reach(bell.x, bell.y, bell.z, bell.r)) };
}
