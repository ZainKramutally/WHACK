// Creatures from the organisms buffer, in the Red World fauna style (ported from mockups/red-world/src/fauna, never
// imported). Each organism's BodyPlan (births give plans by id; cached by id) becomes a BeadLayout (creatureLayout.ts:
// picking, the inspect view, the motion rig) and a fauna description (faunaLib/adapter.ts: loft + sculpted parts).
// The two chemistries are different ARCHITECTURES. Carbon (axial): a smooth loft down a curling head-to-tail spine,
// shields, crest frills, fins, horns, paired ring eyes with bone catchlights, and jointed or tentacle legs. Silicon
// (radial): a lofted crystal hub with an n-gon cross-section and stepped tiers, hex tiles, a spire crown, straight rod
// arms with 15° joints and cyan dot eyes at the arm tips. Never mirrored.
//
// Species look alike (faunaLib/species.ts, the render-side look attractor): each animal is binned once, when first seen,
// on the field guide's clustering space; its species' colourway (hue, accent, value), pattern and mean proportions are
// applied to its plan before layout, so members of a species match and species sit apart. Counts stay its own.
//
// LOD, by rank of camera distance (lofted creatures rank at LOFT_STICK of theirs, so the cut doesn't flicker): the
// nearest LOFT_MAX within ANIM_RADIUS get the full loft and parts; the rest of the nearest ANIM_MAX are posed bead and
// prism proxies; everything further is the same proxies at rest pose. Proxies share the palette and the material, so the
// LOD steps change detail, never colour. Everything goes through the one world material (kind 'fauna'), so cel shading,
// fog, star dimming and glow (glow from darkness: plan.glow) match the world; silicon parts and gas bells add its pale
// fresnel rim. One body colour + one accent per creature (palette.ts creatureColour). Read-only.
//
// Motion (render-only): poses are interpolated between 20 Hz snapshots by id (with a short extrapolation cap), births
// and deaths fade over 0.3 s. Axial: swimmers get a travelling spine wave, walkers an analytic 2-bone IK gait with
// planted feet, hoverers ride under a breathing gas bell trailing tendrils with lag, sessile ones sway. Radial: walkers
// tripod-step on their arms (planted feet), swimmers roll like a wheel, hoverers pulse as a bell with arms hanging and
// trailing rod tendrils, sessile ones stay rooted as a still crystal colony with prongs raised.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { ORGANISM_STRIDE, OrganismField, geneField, organismCount } from '../sim/organismLayout';
import { unpackBodyPlan } from '../sim/plan';
import { LOCOMOTION, type BodyPlan } from '../sim/develop';
import {
  armRods, beadLayout, capsuleLayout, limbJoints, raySphere, raySphereEntry, patchToWorld, type BeadLayout, type Vec3,
} from './layout';
import {
  armStance, bellPulse, fadeScale, gaitFoot, gaitStep, interpPose, layAlongTravel, limbPhaseOffset, slewAngle, swayOffset, swimWave,
  turnRateMax,
} from './motion';
import { LOOK_PALETTES, creatureColour } from './palette';
import { MAX_BEADS_PER_ORGANISM, MAX_RODS_PER_ORGANISM, ROD_STRIDE, TONES } from './creatureLayout';
import { worldMaterial } from './material';
import {
  AX_RINGS, AX_SIDES, BELL_RINGS, BELL_SIDES, GLOW_MIN, PART, RAD_RINGS, RAD_SIDES, SLOT, SLOTS, TENDRILS, TENDRIL_LINKS, bellSphere,
  describe, pickBounds, type AxialDesc, type BodySphere, type FaunaDesc, type PartDesc, type PartType, type RadialDesc,
} from './faunaLib/adapter';
import { RING_STRIDE, circleSection, gridIndex, ngonSection, setRing, writeRings, type Section } from './faunaLib/loft';
import { PartBatch, partBatches } from './faunaLib/parts';
import { SpeciesBook, faunaLook, rememberLook, type SpeciesLook } from './faunaLib/species';
import { crustGround, crustHard } from './crustLook';
import { drawnFactor, drawnLength, growthLength } from './faunaLib/growth';
import { buildSwimmer, type SwimPart, type SwimSink, type Swimmer } from './faunaLib/aquatic/build';
import { swimmerParamsFromPlan } from './faunaLib/aquatic/fromPlan';
import { advance } from './faunaLib/aquatic/motion';
import { SlotPool, TrailPath } from './faunaLib/trail';
import type { V3 } from './faunaLib/aquatic/v3';
import type { LookKey } from './palette';

const len2 = (x: number, y: number) => Math.sqrt(x * x + y * y);
const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);

const CAP = 98304;                // far proxy beads per mesh
const HUB_CAP = 8192;             // far proxy hub tiers per symmetry mesh
const HEX_CAP = 49152;            // far proxy arm, tile and spire prisms
const HUB_SIDES = [3, 4, 5, 6, 8]; // one hub mesh per symmetry order
const BONE_CAP = 16384;           // far proxy carbon limb bones
const FORGET_FRAMES = 300;        // drop cached plans for organisms never seen this long
const FADE_SEC = 0.3;
const ANIM_RADIUS = 90;           // creatures within this many metres of the camera are posed (gait, IK, waves)
const ANIM_MAX = 160;             // ... at most this many per frame (the rest hold their rest pose)
const LOFT_MAX = 64;              // ... and the nearest of them get the full loft and parts (the rest are posed proxies)
const LOFT_STICK = 0.7;           // a lofted creature ranks at this share of its squared distance (LOD hysteresis)
const PART_CAP = 4096;            // posed parts per type (64 lofted creatures × at most ~45 of the busiest type)
// Swimmers emit more of some types: the posed SWIM_MAX at their worst (a 6-bell chain's comb dots 265 knobSi; a ribbon's
// dots 106 knob and rods 97 rodC) plus the other lofted creatures at ~45 each.
const PART_CAPS: Partial<Record<PartType, number>> = { rodSi: 6144, knob: 4608, rodC: 4608, knobSi: 8192 }; // rodSi: silicon arms (8 × up to 6 rods) + lattice tendrils
const RIM_SI = 0.45;              // silicon's pale fresnel rim on violet bodies (#50)
const RIM_BELL = 0.5;             // gas bells read translucent at grazing angles
const GENE0 = geneField('size');  // the 12 body genes, then comp c and si: the field guide's clustering space
const PENDING_SNAPS = 20;         // a birth plan waits this many snapshots for its organism to show up
const SWIM_MAX = 24;              // lofted swimmers posed as aquatic bodies per frame (a pose costs 5–20 µs and allocates no arrays); the rest keep the bead loft
// Stroke frequency range by motion kind (aquatic-life.md §6.5): idle floor so a resting swimmer still breathes its fins.
const SWIM_F: Record<'wave' | 'row' | 'jet', [number, number]> = { wave: [0.3, 4], row: [0.3, 2.2], jet: [0.3, 1.4] };
const D15 = Math.PI / 12;
// Loft caps: positions along the end tangent (× cap length) and radius factors. Tail tip first; head base first.
const TAIL_F = [1.0, 0.82, 0.45], TAIL_K = [0.06, 0.6, 0.9];
const HEAD_F = [0.45, 0.8, 1.0], HEAD_K = [0.9, 0.62, 0.08];
// Gas bell egg profile: height from the rim (× bell height) and radius factor, closed underneath.
const BELL_Y = [0.06, 0.02, 0, 0.1, 0.24, 0.4, 0.56, 0.7, 0.82, 0.92, 0.98, 1.0];
const BELL_R = [0.04, 0.42, 0.66, 0.86, 0.98, 1.0, 0.96, 0.86, 0.7, 0.48, 0.24, 0.04];
const PITCH_MAX = 0.6, PITCH_EASE = 0.3; // walkers' slope pitch cap (rad) and easing time (s)
const G_MOVE = 0.25; // m a creature moves before its cached ground height is resampled
const VIEW_PAD = 2; // m added to a creature's bounding sphere for the view test, so it is lofted before it enters
const SI_SIDES = 12; // silicon walker loft: a hexagon sampled twice per face
const SPW = new Float32Array(64 * 5); // posed spine in world space, per frame per creature

/**
 * Declared illustration: flight altitude. The sim's ceilings are kilometres (flight.ts); the patch is a few hundred metres with fog.
 * Displayed height = ALT_MAX_M · tanh(h / ALT_H0_M): near-linear low down (1 km shows as about 90 m), topping out at 150 m,
 * above the 20–40 m giant plants and inside the fog.
 */
const ALT_MAX_M = 150;
const ALT_H0_M = 1500;

interface Entry {
  alt?: number; // physical altitude (m), eased toward the snapshot value so a climb never pops
  /** Drawn length as a fraction of adult (faunaLib/growth: grown^(1/3), floored), eased so growth never pops. */
  g: number;
  /** Aquatic body (faunaLib/aquatic, built once at adult drawn length when it first swims near), the stroke phase
   *  integrated from its sim speed (cycles), and its sociality gene (school size, swimmerParamsFromPlan). */
  sw: Swimmer | null; swTried: boolean; swPhase: number; soc: number;
  /** Swimmer LOD: ranked camera distance (sticky while it is drawn as a swimmer) and whether it was last frame. */
  swRank: number; swOn: boolean;
  /** Ground under it when last drawn (the view test's sphere height). */
  yDrawn: number;
  /** Cached ground: the last sample (height, slope, where, terrain stamp); resampled after 0.25 m or a terrain change. */
  gH: number; gSx: number; gSz: number; gX: number; gZ: number; gStamp: number;
  layout: BeadLayout;
  /** The plan as drawn (after the species attractor), kept so the loft description is built only once it's needed. */
  plan: BodyPlan | null;
  desc: FaunaDesc | null;
  /** Species bin and its recycle stamp (SpeciesBook), −1 for capsules. */
  bin: number; binStamp: number;
  /** LOD: ranked camera distance this frame, and the tier it was last drawn at (2 loft, 1 posed proxy, 0 rest proxy). */
  rank: number; tier: number;
  /** Carbon floaters: the gas bell as a body-space sphere (with desc), and whether it was drawn this frame (picking). */
  bellS: BodySphere | null; bell: boolean;
  lastSeen: number;
  glow: number; silicon: boolean; scale: number;
  /** Rest pose, per bead x, y, z, r, tone-index (stride 5), built once. */
  flat: Float32Array;
  /** Per bead sx, sy, sz, yaw (stride 4) and its flap weight, built once. */
  shape: Float32Array; flap: Float32Array;
  /** Linear RGB per tone (TONES × 3) for the proxies: each tone takes its fauna slot's colour (TONE_SLOT). */
  rgb: Float32Array;
  /** Linear RGB per fauna colour slot (SLOTS × 3) and the glow weight per slot, for the loft and parts. */
  slotRgb: Float32Array; slotGlow: Float32Array;
  /** Radial bodies: rest rods (ROD_STRIDE floats: ax, ay, az, bx, by, bz, r, flat, up) and their tones. */
  rods: Float32Array; rodTone: Uint8Array;
  hue: number; accent: number;
  /** The species' stamped mineral armour hex (undefined: the hard tone is the body a little deeper) and skin shift. */
  hard: number | undefined; skin: number;
  // body extents for the motion maths
  xmin: number; xspan: number; ymax: number;
  // snapshot interpolation: previous rendered pose → newest target, over dtSnap seconds from snapT
  init: boolean;
  px: number; pz: number; ph: number;
  cx: number; cz: number; ch: number;
  snapT: number; dtSnap: number;
  /** Rendered pose this frame. */
  x: number; z: number; h: number;
  /** Smoothed ground speed in m/s and the accumulated gait cycles (distance-integrated: motion.ts gaitStep). */
  speed: number; gait: number;
  /** Walk weight (0 standing … 1 walking, eased), half stride in drawn world metres, smoothed turn rate (rad/s), and the
   *  plan's curl (rad per joint), which is motion only: lateral flexion while walking. */
  walkW: number; hW: number; turn: number; curl: number;
  /** Walkers: body pitch (rad, eased) and the cached ground under head and tail (resampled like gH). */
  pitch: number; gHead: number; gTail: number; pX: number; pZ: number; pH: number; pStamp: number;
  /** Swimmers drawn as swimmers: their trail slot in the shared ring buffers (−1 none). */
  trail: number;
  /** Radial swimmers: the rest pose laid along the travel axis (laidRest), built on first need. */
  laid?: { rods: Float32Array; flat: Float32Array };
  /** True when the layout comes from a real BodyPlan (not the capsule fallback). */
  planned: boolean;
  /** Radial bodies: arms are walking arms (the plan has leg pairs); otherwise they are short spikes. */
  legged: boolean;
  seen: boolean; stamp: number; born: number; dieT: number; mode: number; id: number; diet: number;
}

const tmpColour = new THREE.Color();
/** Proxy bead/rod tone → fauna slot, so proxies wear the loft's one body colour + one accent: body, eye, plate, limb, horn, accent, spot. */
const TONE_SLOT = [SLOT.body, SLOT.eye, SLOT.hard, SLOT.body, SLOT.hard, SLOT.accent, SLOT.accent]; // plates and horns: mineral armour
function bake(layout: BeadLayout, silicon: boolean, look: SpeciesLook, glow: number) {
  const rl = layout.radial?.rods ?? layout.limbRods ?? [];
  const rods = new Float32Array(rl.length * ROD_STRIDE), rodTone = new Uint8Array(rl.length);
  rl.forEach((r, i) => {
    rods.set([r.ax, r.ay, r.az, r.bx, r.by, r.bz, r.r, r.flat ?? 1, r.up ? 1 : 0], i * ROD_STRIDE); rodTone[i] = r.tone;
  });
  const nb = layout.beads.length;
  const flat = new Float32Array(nb * 5), shape = new Float32Array(nb * 4), flap = new Float32Array(nb);
  let xmin = Infinity, xmax = -Infinity, ymax = 1e-6;
  layout.beads.forEach((b, i) => {
    flat[i * 5] = b.x; flat[i * 5 + 1] = b.y; flat[i * 5 + 2] = b.z; flat[i * 5 + 3] = b.r; flat[i * 5 + 4] = b.tone;
    shape[i * 4] = b.sx ?? 1; shape[i * 4 + 1] = b.sy ?? 1; shape[i * 4 + 2] = b.sz ?? 1; shape[i * 4 + 3] = b.yaw ?? 0;
    flap[i] = b.flap ?? 0;
    if (i < layout.nBody) { xmin = Math.min(xmin, b.x); xmax = Math.max(xmax, b.x); }
    ymax = Math.max(ymax, b.y + b.r * (b.sy ?? 1));
  });
  for (const r of rl) ymax = Math.max(ymax, r.ay + r.r, r.by + r.r);
  // Fauna slots: the species' one body colour and one accent (Red World), the eye (ink / cyan), bone catchlights, glow.
  const { hue, accent, diet, hard } = look, skin = look.skin ?? 0; // skin: the species' readability shift off its ground
  const pal = LOOK_PALETTES[silicon ? 'silicon' : 'carbon'];
  const slotHex = [
    creatureColour(silicon, diet, 0, hue, accent, hard, skin), creatureColour(silicon, diet, 5, hue, accent, hard, skin),
    creatureColour(silicon, diet, 1, hue, accent), pal.bone, pal.glow,
    creatureColour(silicon, diet, 2, hue, accent, hard, skin), // hard parts: the species' stamped mineral armour, else the body deeper
  ];
  const slotRgb = new Float32Array(SLOTS * 3);
  slotHex.forEach((hex, i) => { tmpColour.setHex(hex); slotRgb[i * 3] = tmpColour.r; slotRgb[i * 3 + 1] = tmpColour.g; slotRgb[i * 3 + 2] = tmpColour.b; });
  const lit = glow > GLOW_MIN ? glow : 0;
  const slotGlow = new Float32Array(SLOTS);
  slotGlow[SLOT.glow] = lit;
  if (silicon) slotGlow[SLOT.eye] = lit; // silicon's cyan arm-tip eyes are its light organs; carbon's ink eyes never glow
  const rgb = new Float32Array(TONES * 3);
  for (let tone = 0; tone < TONES; tone++) {
    // radial bodies: tone 2 is their shell tiles, which keep the species skin (only spires, tone 4, are armour)
    const sl = tone === 6 && lit > 0 ? SLOT.glow : tone === 2 && layout.radial ? SLOT.body : TONE_SLOT[tone];
    rgb[tone * 3] = slotRgb[sl * 3]; rgb[tone * 3 + 1] = slotRgb[sl * 3 + 1]; rgb[tone * 3 + 2] = slotRgb[sl * 3 + 2];
  }
  return { flat, shape, flap, rgb, slotRgb, slotGlow, rods, rodTone, hue, accent, hard, skin, xmin, xspan: Math.max(1e-6, xmax - xmin), ymax };
}

/** One creature's near-LOD geometry at rest pose in body space (layout units), copied out of the live batches. */
export interface BakedCreature {
  /** Loft slots (body, gas bell or crystal hub): rings × sides vertices each; index with faunaLib/loft gridIndex.
   *  `flat`: drawn flat-shaded (a silicon walker's faceted segments). */
  lofts: { pos: Float32Array; nor: Float32Array; col: Float32Array; rings: number; sides: number; flat: boolean }[];
  /** Sculpted parts by PART type: instance matrices (16 floats each) and linear colours (3 each). */
  parts: { type: number; m: Float32Array; col: Float32Array; n: number }[];
}

export interface FaunaPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Nearest organism under a ray (world space, normalised direction), or null. */
  hit(origin: Vec3, dir: Vec3): { id: number; dist: number } | null;
  /** Cached bead layout, chemistry and diet of an organism by id (from its BodyPlan), if known. */
  layoutOf(id: number): {
    layout: BeadLayout; silicon: boolean; diet: number; hue: number; accent: number; hard?: number; skin?: number;
    /** The creature as the near LOD draws it (loft and parts), at rest pose in body space, for the inspect live view. */
    bake?: () => BakedCreature | null;
  } | null;
  /**
   * A body plan as the near LOD draws it (loft and parts, rest pose, body space), with no live organism: the bestiary's
   * specimen view, so extinct kinds work too. Drawn in the plan's species look (faunaLook); swimmers through the aquatic
   * builder on a straight path, silicon walkers faceted. Null if it can't be built. Cached per plan object once it is
   * in the species look.
   */
  bakePlan(plan: BodyPlan): BakedCreature | null;
  /** World position and bounding radius of an organism by id, if drawn. */
  locate(id: number): { x: number; y: number; z: number; radius: number } | null;
  /** Extra multiplier on top of the display-scale rule in layout.ts (default 1). Render-only illustration. */
  scaleBoost: number;
  count: number;
  dispose(): void;
}

// Every per-frame buffer here keeps the default static usage and goes through upload(): in three r187 a DynamicDraw
// attribute is re-uploaded whole on every render (Attributes.update), even while its mesh draws 0 instances (the warm
// meshes before life), whereas a static one uploads only after needsUpdate, and then only its update range.
function withGlow(m: THREE.InstancedMesh, cap: number): Float32Array {
  const g = new Float32Array(cap);
  const a = new THREE.InstancedBufferAttribute(g, 1);
  m.geometry.setAttribute('aGlow', a);
  return g;
}

function makeMesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, CAP);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  m.frustumCulled = false;
  m.count = 0;
  // Every column but the last is rewritten per bead (ellipsoid scale and yaw); the bottom row is constant.
  const a = m.instanceMatrix.array as Float32Array;
  for (let i = 0; i < CAP; i++) a[i * 16 + 15] = 1;
  return m;
}

function makeRodMesh(sides: number, cap: number, mat: THREE.Material, radiusTop = 1): THREE.InstancedMesh {
  // Cylinder axis is Y; rotate the prism so a vertex points along local +X (arms radiate from the vertices).
  const geo = new THREE.CylinderGeometry(radiusTop, 1, 1, sides, 1);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  m.frustumCulled = false;
  m.count = 0;
  const a = m.instanceMatrix.array as Float32Array;
  for (let i = 0; i < cap; i++) a[i * 16 + 15] = 1;
  return m;
}

/** Mark the first `n` floats of an attribute for upload (the rest of the preallocated buffer stays put). */
function upload(a: THREE.BufferAttribute, n: number): void {
  a.clearUpdateRanges();
  a.addUpdateRange(0, n);
  a.needsUpdate = true;
}

/** k-th smallest (0-based) of a[0..n), by quickselect in place. */
function kth(a: Float32Array, n: number, k: number): number {
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const piv = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < piv) i++;
      while (a[j] > piv) j--;
      if (i <= j) { const tmp = a[i]; a[i] = a[j]; a[j] = tmp; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return a[k];
  }
  return a[k];
}

/** One shared loft mesh: `slots` fixed-size slots of rings × sides vertices, drawn up to the used slot count. */
class LoftBatch {
  mesh: THREE.Mesh; pos: Float32Array; nor: Float32Array; col: Float32Array; glow: Float32Array;
  n = 0; readonly per: number; readonly perIdx: number;
  private attrs: THREE.BufferAttribute[];
  constructor(readonly rings: number, readonly sides: number, readonly slots: number, mat: THREE.Material, readonly reserve = 1) {
    this.per = rings * sides; this.perIdx = (rings - 1) * sides * 6;
    const nv = this.per * slots;
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3); this.col = new Float32Array(nv * 3); this.glow = new Float32Array(nv);
    const g = new THREE.BufferGeometry();
    const aP = new THREE.BufferAttribute(this.pos, 3), aN = new THREE.BufferAttribute(this.nor, 3);
    const aC = new THREE.BufferAttribute(this.col, 3), aG = new THREE.BufferAttribute(this.glow, 1);
    this.attrs = [aP, aN, aC, aG]; // static usage: flush() uploads only the used slots (see upload())
    g.setAttribute('position', aP); g.setAttribute('normal', aN); g.setAttribute('color', aC); g.setAttribute('aGlow', aG);
    g.setIndex(new THREE.BufferAttribute(gridIndex(rings, sides, slots), 1));
    g.setDrawRange(0, this.perIdx); // one slot of zeroed (degenerate) triangles until the first flush: compiled, never seen
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
  }
  /** `warm` (before any life): stay visible with one slot of zeroed, degenerate triangles, so the selection screen's
   *  compile includes this pipeline. Otherwise hidden when empty (an empty draw warns on WebGPU). */
  flush(warm = false): void {
    const g = this.mesh.geometry;
    g.setDrawRange(0, Math.max(this.n, warm ? 1 : 0) * this.perIdx);
    this.mesh.visible = this.n > 0 || warm;
    if (this.n === 0) return;
    for (const a of this.attrs) upload(a, this.n * this.per * a.itemSize);
  }
}

export function createFauna(app: App): FaunaPart {
  // Materials: one set per chemistry (only one is ever non-empty in a world; both are compiled up front). Silicon's
  // carry the pale rim (#50), and gas bells their own. No per-creature materials.
  const matC = worldMaterial({ kind: 'fauna', glowAttr: 'aGlow' });                          // carbon proxies + parts
  const proxySi = worldMaterial({ kind: 'fauna', glowAttr: 'aGlow', flat: true, rim: RIM_SI }); // silicon proxies (faceted)
  const partSi = worldMaterial({ kind: 'fauna', glowAttr: 'aGlow', rim: RIM_SI });
  const loftC = worldMaterial({ kind: 'fauna', vertexColors: true, glowAttr: 'aGlow' });
  const loftSi = worldMaterial({ kind: 'fauna', vertexColors: true, glowAttr: 'aGlow', rim: RIM_SI });
  const loftBell = worldMaterial({ kind: 'fauna', vertexColors: true, glowAttr: 'aGlow', rim: RIM_BELL });
  const loftSiFlat = worldMaterial({ kind: 'fauna', vertexColors: true, glowAttr: 'aGlow', flat: true, rim: RIM_SI }); // silicon walkers
  const MATS = [matC, proxySi, partSi, loftC, loftSi, loftBell, loftSiFlat];

  // Far and mid proxies: carbon beads and limb bones; silicon faceted beads, hub prisms per symmetry, hex prisms.
  const round = makeMesh(new THREE.SphereGeometry(1, 8, 6), matC);
  const faceted = makeMesh(new THREE.IcosahedronGeometry(1, 0), proxySi);
  const hubs = HUB_SIDES.map((n) => makeRodMesh(n, HUB_CAP, proxySi));
  const hex = makeRodMesh(6, HEX_CAP, proxySi);
  const bones = makeRodMesh(8, BONE_CAP, matC, 0.72);
  const MESHES = [round, faceted, ...hubs, hex, bones];
  const GLOWS = MESHES.map((m) => withGlow(m, (m.instanceMatrix.array as Float32Array).length / 16));
  const BONES = MESHES.length - 1, HEX = BONES - 1; // indexes of the bone and hex-prism meshes in MESHES

  // Near: lofts (carbon bodies and swimmers' fin strips, carbon gas bells, silicon hubs and glass bells) and the shared
  // part batches. Swimmers use several slots (body, whip, dorsal and ventral fins; up to 6 bells), so the axial and hub
  // batches have room for SWIM_MAX of them. The last `reserve` slots of each are written only by bake() (never drawn:
  // flush() draws the first n slots).
  const axLoft = new LoftBatch(AX_RINGS, AX_SIDES, LOFT_MAX + 3 * SWIM_MAX + 4, loftC, 4);
  const bellLoft = new LoftBatch(BELL_RINGS, BELL_SIDES, LOFT_MAX + 1, loftBell, 1);
  const hubLoft = new LoftBatch(RAD_RINGS, RAD_SIDES, LOFT_MAX + 5 * SWIM_MAX + 6, loftSi, 6);
  // silicon bilateral walkers: hexagonal segments (12 samples, 2 per hex face), flat-shaded
  const siLoft = new LoftBatch(AX_RINGS, SI_SIDES, LOFT_MAX + 1, loftSiFlat, 1);
  let baking = false;
  /** A free slot for a near-LOD loft (bake() may also use the reserve). */
  const room = (b: LoftBatch) => b.n < b.slots - (baking ? 0 : b.reserve);
  const LOFTS = [axLoft, bellLoft, hubLoft, siLoft];
  const parts: PartBatch[] = partBatches((t) => (t.endsWith('Si') ? partSi : matC), PART_CAPS, PART_CAP);
  app.scene.add(...MESHES, ...LOFTS.map((l) => l.mesh), ...parts.map((p) => p.mesh));

  const AX_SEC = circleSection(AX_SIDES), BELL_SEC = circleSection(BELL_SIDES);
  const SI_SEC = ngonSection(SI_SIDES, 6, 1, 0); // a true hexagon: corners at the flanks, flat top and belly
  const HUB_SEC = new Map<number, Section>();
  const hubSection = (n: number) => {
    let s = HUB_SEC.get(n);
    if (!s) { s = ngonSection(RAD_SIDES, n, 0.55, Math.PI / 2); HUB_SEC.set(n, s); }
    return s;
  };
  const ringBuf = new Float32Array(Math.max(AX_RINGS, RAD_RINGS, BELL_RINGS) * RING_STRIDE);

  const entries = new Map<number, Entry>();
  const dying: Entry[] = [];
  // Birth plans waiting for their organism's first appearance in the buffer (where its genes and species are read).
  const pending = new Map<number, { plan: BodyPlan; snap: number }>();
  const book = new SpeciesBook();
  const look: SpeciesLook = { hue: 0.5, accent: 0.55, diet: 0, bands: 0, spots: 0 };
  let lastBirths: unknown = null;
  let frame = 0;
  let lastBuf: Float32Array | null = null, snapId = 0, lastSnapT = -1;
  let lastWorld = '', lastBuild = 0;
  let hadLife = false; // until the first animal, keep every batch visible so the up-front compile covers it
  const counts = new Array(MESHES.length).fill(0);
  const scratch = new Float32Array(MAX_BEADS_PER_ORGANISM * 5);  // animated bead pose, same layout as Entry.flat
  const rodScratch = new Float32Array(MAX_RODS_PER_ORGANISM * ROD_STRIDE); // animated rods (radial bodies, carbon limb bones)
  const armOut: number[] = [];
  const limbOut: number[] = [];
  const camPos = app.camera.position;
  // Live creatures this frame (reused) and scratch for the two LOD cuts.
  const liveE: Entry[] = [];
  let sel = new Float32Array(1024);

  // Pick data, rebuilt every update.
  let pid = new Float64Array(1024), px = new Float32Array(1024), py = new Float32Array(1024), pz = new Float32Array(1024), pr = new Float32Array(1024);
  let pn = 0;
  // Per live creature for the precise pick: the entry, its draw scale and ground base.
  let pe: Entry[] = [], pS = new Float32Array(1024), pY0 = new Float32Array(1024);

  function makeEntry(layout: BeadLayout, plan: BodyPlan | null, silicon: boolean, glow: number, scale: number, id: number, lk: SpeciesLook, planned = false): Entry {
    return {
      layout, plan, desc: null, bin: -1, binStamp: 0, rank: Infinity, tier: 0, bellS: null, bell: false, g: 1,
      sw: null, swTried: false, swPhase: 0, soc: 0.2, swRank: Infinity, swOn: false, yDrawn: 0, gH: 0, gSx: 0, gSz: 0, gX: 0, gZ: 0, gStamp: -1,
      lastSeen: frame, glow, silicon, scale, ...bake(layout, silicon, lk, glow),
      init: false, px: 0, pz: 0, ph: 0, cx: 0, cz: 0, ch: 0, snapT: 0, dtSnap: 0.05, x: 0, z: 0, h: 0,
      speed: 0, gait: 0, walkW: 0, hW: 0, turn: 0, curl: plan?.curl ?? 0,
      pitch: 0, gHead: 0, gTail: 0, pX: 0, pZ: 0, pH: 0, pStamp: -1, trail: -1, planned, legged: false, seen: false, stamp: 0, born: 0, dieT: -1, mode: 0, id, diet: lk.diet,
    };
  }

  /** First sighting: bin the animal by its genes (buffer record at `o`), draw its plan in its species' look. */
  function entryFor(id: number, buf: Float32Array, o: number): Entry {
    const p = pending.get(id);
    if (p) {
      pending.delete(id);
      try {
        const bin = book.assign(buf, o + GENE0, p.plan);
        book.lookOf(bin, look);
        const drawn = book.attract(p.plan, bin, look);
        const e = makeEntry(beadLayout(drawn), drawn, p.plan.chemistry === 'silicon', p.plan.glow, p.plan.scale, id, look, true);
        e.bin = bin; e.binStamp = book.stampOf(bin); e.legged = p.plan.legPairs > 0;
        rememberLook(p.plan, drawn, look); // only once the layout built: the bestiary sprite redraws this same plan
        return e;
      } catch { /* a plan the layout can't build: draw it as a capsule */ }
    }
    // No plan (born before the renderer was listening): a plain capsule in the species-neutral colourway.
    const size = buf[o + OrganismField.size] || 1;
    look.hue = 0.5; look.accent = 0.55; look.diet = buf[o + geneField('diet')]; look.bands = 0; look.spots = 0;
    return makeEntry(capsuleLayout(0.15 * size * 2), null, buf[o + OrganismField.compSi] > 0.5, 0, 0.3 * size, id, look);
  }

  function forget(e: Entry): void {
    releaseTrail(e);
    book.release(e.bin, e.binStamp);
    entries.delete(e.id);
  }

  /** Walking bends into turns along the path's curvature κ = turn rate ÷ speed (layout units, ends ≤ 12% of the length
   *  off the chord), toward the side it turns to. `s`: layout → world scale. */
  function turnKap(e: Entry, s: number): number {
    const kMax = 0.96 / Math.max(e.xspan, 1e-6);
    return Math.max(-kMax, Math.min(kMax, (e.turn * s) / Math.max(e.speed, 0.3)));
  }
  /** A walker's lateral bend at layout x: carbon's curl as motion (flexion with the stride, strongest at head and tail;
   *  the rest pose stays straight) plus the bend into a turn. Shared by the pose and picking, so a click follows it. */
  function walkBendZ(e: Entry, x: number, kap: number): number {
    const xn = (x - e.xmin) / e.xspan, c = 2 * xn - 1, dx = x - (e.xmin + 0.5 * e.xspan);
    return e.curl * 0.5 * e.xspan * e.walkW * c * c * Math.sin(2 * Math.PI * e.gait + Math.PI * xn) + 0.5 * kap * dx * dx;
  }

  /** Fill `scratch` (stride 5) and the limb bones in rodScratch with this creature's animated pose; returns the bead count. */
  function animate(
    e: Entry, t: number, s: number, mode: number, heightAt: (x: number, z: number) => number,
    y0: number, cosH: number, sinH: number,
  ): number {
    const lay = e.layout, src = e.flat, nb = lay.beads.length, nBody = lay.nBody;
    const out = scratch;
    const moving = Math.min(1, e.speed / (0.12 * drawnLength(e.scale, e.g))); // 0 idle … 1 at 0.12 body lengths per second
    const kap = mode === LOCOMOTION.walk ? turnKap(e, s) : 0;
    const xc = e.xmin + 0.5 * e.xspan;
    const kp = mode === LOCOMOTION.walk ? Math.tan(e.pitch) : 0; // slope pitch, as a shear along the body
    // Body beads: copy, then bend by locomotion mode. (Hoverers ride under a bell: the body only breathes a little.)
    for (let i = 0; i < nBody; i++) {
      const f = i * 5;
      let x = src[f], y = src[f + 1], z = src[f + 2];
      const r = src[f + 3];
      if (mode === LOCOMOTION.swim) {
        const xn = (x - e.xmin) / e.xspan;
        z += swimWave(xn, t, 0.1 * e.xspan * (0.35 + 0.65 * moving));
      } else if (mode === LOCOMOTION.hover) {
        const xn = (x - e.xmin) / e.xspan;
        z += swimWave(xn, t * 0.6, 0.04 * e.xspan);
      } else if (mode === LOCOMOTION.sessile) {
        const hn = Math.min(1, y / e.ymax);
        z += swayOffset(hn, t, e.id, 0.08 * e.xspan);
      } else if (mode === LOCOMOTION.walk) {
        z += walkBendZ(e, x, kap);
        y += kp * (x - xc);
      }
      const fl = e.flap[i];
      if (fl > 0) y += Math.abs(z) * 0.55 * fl * Math.sin(2 * Math.PI * 1.3 * t + e.id) * (mode === LOCOMOTION.hover ? 1 : 0.5 + moving);
      out[f] = x; out[f + 1] = y; out[f + 2] = z; out[f + 3] = r; out[f + 4] = src[f + 4];
    }
    // Limbs.
    if (lay.limbs.length > 0) {
      const walking = mode === LOCOMOTION.walk;
      const amp = walking ? e.walkW : 0, stride = (e.hW / Math.max(s, 1e-6)) * amp, pairs = lay.limbs.length >> 1;
      for (const rig of lay.limbs) {
        let fx = rig.hip.x, fy = rig.r, fz = rig.hip.z + rig.side * rig.restOut;
        if (walking) {
          const g = gaitFoot(e.gait + limbPhaseOffset(rig.pair, rig.side, pairs), stride, 0.35 * rig.len1 * amp);
          fx += g.dx;
          // Plant the foot on the terrain under its world position.
          const wx = e.x + (fx * cosH - fz * sinH) * s, wz = e.z + (fx * sinH + fz * cosH) * s;
          fy = rig.r + g.dy + (heightAt(wx, wz) - y0) / s;
        } else if (mode === LOCOMOTION.hover) {
          fy = rig.hip.y - 0.8 * (rig.len1 + rig.len2); fz = rig.hip.z + rig.side * 0.3 * rig.restOut; // legs hang
        }
        // the pitched body lifts this hip by dy: solve the leg from the rest hip to the target less dy, then lift it all
        const dyHip = kp * (rig.hip.x - xc);
        limbOut.length = 0;
        limbJoints(rig, fx, fy - dyHip, fz, limbOut);
        limbOut[1] += dyHip; limbOut[4] += dyHip;
        const q = rig.first * 5;
        const kneeR = src[q + 3], footR = src[q + 8];
        out[q] = limbOut[0]; out[q + 1] = limbOut[1]; out[q + 2] = limbOut[2]; out[q + 3] = kneeR; out[q + 4] = 3;
        out[q + 5] = limbOut[3]; out[q + 6] = limbOut[4]; out[q + 7] = limbOut[5]; out[q + 8] = footR; out[q + 9] = 3;
        // The two bones follow: hip → knee, knee → foot. Limb k's beads start at nBody + 2k, its rods at 2k.
        const rk = (rig.first - nBody) * ROD_STRIDE;
        const R = e.rods;
        rodScratch[rk] = rig.hip.x; rodScratch[rk + 1] = rig.hip.y + dyHip; rodScratch[rk + 2] = rig.hip.z;
        rodScratch[rk + 3] = limbOut[0]; rodScratch[rk + 4] = limbOut[1]; rodScratch[rk + 5] = limbOut[2];
        rodScratch[rk + 6] = R[rk + 6]; rodScratch[rk + 7] = 1; rodScratch[rk + 8] = 0;
        rodScratch[rk + 9] = limbOut[0]; rodScratch[rk + 10] = limbOut[1]; rodScratch[rk + 11] = limbOut[2];
        rodScratch[rk + 12] = limbOut[3]; rodScratch[rk + 13] = limbOut[4]; rodScratch[rk + 14] = limbOut[5];
        rodScratch[rk + 15] = R[rk + 15]; rodScratch[rk + 16] = 1; rodScratch[rk + 17] = 0;
      }
    }
    return nb;
  }

  /** Radial bodies: fill rodScratch (ROD_STRIDE floats a rod) and the arm-tip eye beads in `scratch` for this pose. */
  function animateRadial(
    e: Entry, t: number, s: number, mode: number, heightAt: (x: number, z: number) => number,
    y0: number, cosH: number, sinH: number,
  ): void {
    const lay = e.layout, R = lay.radial!;
    const src = e.rods, out = rodScratch, eyes = scratch;
    const pulse = mode === LOCOMOTION.hover ? bellPulse(t, e.id) : 1;
    for (let i = 0; i < R.nHubRods * ROD_STRIDE; i++) out[i] = src[i];
    if (pulse !== 1) for (let i = 0; i < R.nTiers; i++) out[i * ROD_STRIDE + 6] *= pulse;
    const stance = mode === LOCOMOTION.hover ? 'bell' : mode === LOCOMOTION.sessile ? 'crystal' : 'spoke';
    for (const rig of R.arms) {
      let fx: number, fy: number, fz: number;
      if (mode === LOCOMOTION.walk && e.legged) {
        const g = gaitFoot(e.gait + rig.phase, (e.hW / Math.max(s, 1e-6)) * e.walkW, 0.35 * rig.len1 * e.walkW);
        fx = rig.hip.x + rig.dirX * rig.restOut + g.dx;
        fz = rig.hip.z + rig.dirZ * rig.restOut;
        const wx = e.x + (fx * cosH - fz * sinH) * s, wz = e.z + (fx * sinH + fz * cosH) * s;
        fy = rig.r + g.dy + (heightAt(wx, wz) - y0) / s;
      } else if (stance === 'spoke') {
        fx = rig.hip.x + rig.dirX * rig.restOut; fz = rig.hip.z + rig.dirZ * rig.restOut; fy = rig.restFootY;
      } else {
        const st = armStance(stance, rig.len1 + rig.len2, t, e.id);
        fx = rig.hip.x + rig.dirX * st.out; fz = rig.hip.z + rig.dirZ * st.out; fy = rig.hip.y + st.up;
      }
      armOut.length = 0;
      armRods(rig, fx, fy, fz, armOut);
      const o = rig.firstRod * ROD_STRIDE;
      for (let k = 0; k < rig.nRods * ROD_STRIDE; k++) out[o + k] = armOut[k];
      const tb = rig.tipRod * ROD_STRIDE;
      const tx = armOut[tb + 3], ty = armOut[tb + 4], tz = armOut[tb + 5];
      for (let k = 0; k < rig.eyeN; k++) {
        const q = (rig.eyeFirst + k) * 5;
        eyes[q] = tx + rig.eyeDX[k]; eyes[q + 1] = ty + rig.eyeR * 0.6; eyes[q + 2] = tz + rig.eyeDZ[k]; eyes[q + 3] = rig.eyeR; eyes[q + 4] = 1;
      }
    }
    // A radial swimmer lies along its travel axis, hub top forward, as the near LOD's rower (faunaLib/aquatic) swims;
    // its rest layout is a standing tower, which far away read as a fish spiking up out of the water.
    if (mode === LOCOMOTION.swim) layRadial(out, R.rods.length, eyes, lay.beads.length, R.pivotY);
  }

  const layRadial = (rods: Float32Array, nRods: number, eyes: Float32Array, nEyes: number, py: number) =>
    layAlongTravel(rods, nRods, ROD_STRIDE, eyes, nEyes, 5, py);
  /** A radial swimmer's rest pose lying along its travel axis (far tier and picking), built once per entry. */
  function laidRest(e: Entry): { rods: Float32Array; flat: Float32Array } {
    if (!e.laid) {
      const R = e.layout.radial!;
      const rods = e.rods.slice(), flat = e.flat.slice();
      layRadial(rods, R.rods.length, flat, e.layout.beads.length, R.pivotY);
      e.laid = { rods, flat };
    }
    return e.laid;
  }

  function emitRod(
    mesh: THREE.InstancedMesh, glowArr: Float32Array, idx: number, rs: Float32Array, i: number, s: number, ex: number, ey: number, ez: number,
    cosH: number, sinH: number, rgb: Float32Array, tone: number, glow: number,
  ): void {
    const o = i * ROD_STRIDE;
    const ax = rs[o] * s, ay = rs[o + 1] * s, az = rs[o + 2] * s, bx = rs[o + 3] * s, by = rs[o + 4] * s, bz = rs[o + 5] * s;
    const r = rs[o + 6] * s, flat = rs[o + 7], up = rs[o + 8] > 0;
    // World positions: body x is forward; heading rotates it about the vertical axis.
    const Ax = ex + ax * cosH - az * sinH, Ay = ey + ay, Az = ez + ax * sinH + az * cosH;
    const Bx = ex + bx * cosH - bz * sinH, By = ey + by, Bz = ez + bx * sinH + bz * cosH;
    let dx = Bx - Ax, dy = By - Ay, dz = Bz - Az;
    let len = len3(dx, dy, dz);
    if (len < 1e-5) { dx = 0; dy = 1; dz = 0; len = 1e-5; } else { dx /= len; dy /= len; dz /= len; }
    const ext = tone === 3 || tone === 5 ? 0.35 * r * flat : 0; // arm bones overlap a little at the joints
    // Perpendicular frame. Prisms: the body's forward axis made orthogonal to the rod axis (so n-gon hubs turn with the
    // heading). Blades (`up`): the horizontal direction across the rod, so the wide side lies flat.
    let px: number, py: number, pz: number;
    if (up) { px = -dz; py = 0; pz = dx; } // axis × up
    else { px = cosH - cosH * dx * dx - sinH * dz * dx; py = -(cosH * dx + sinH * dz) * dy; pz = sinH - cosH * dx * dz - sinH * dz * dz; }
    let pl = len3(px, py, pz);
    if (pl < 1e-4) { px = 0; py = 0; pz = 1; pl = 1; }
    px /= pl; py /= pl; pz /= pl;
    const qx = py * dz - pz * dy, qy = pz * dx - px * dz, qz = px * dy - py * dx; // p × axis
    const arr = mesh.instanceMatrix.array as Float32Array;
    const m = idx * 16, L = len + 2 * ext, rq = r * flat;
    arr[m] = px * r; arr[m + 1] = py * r; arr[m + 2] = pz * r;
    arr[m + 4] = dx * L; arr[m + 5] = dy * L; arr[m + 6] = dz * L;
    arr[m + 8] = qx * rq; arr[m + 9] = qy * rq; arr[m + 10] = qz * rq;
    arr[m + 12] = (Ax + Bx) / 2; arr[m + 13] = (Ay + By) / 2; arr[m + 14] = (Az + Bz) / 2;
    const carr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    const c3 = idx * 3, t3 = tone * 3;
    carr[c3] = rgb[t3]; carr[c3 + 1] = rgb[t3 + 1]; carr[c3 + 2] = rgb[t3 + 2];
    glowArr[idx] = glow;
  }

  // ---- near LOD: loft + sculpted parts ---------------------------------------------------------------------------
  // Per-creature draw state (set by drawNear before the helpers run; no closures per frame).
  let S = 1, EX = 0, EY = 0, EZ = 0, CH = 1, SH = 0, ENT: Entry;
  const W = new Float32Array(3); // world point out
  /** Body-space point → world, into W. */
  const toW = (x: number, y: number, z: number) => {
    W[0] = EX + (x * CH - z * SH) * S; W[1] = EY + y * S; W[2] = EZ + (x * SH + z * CH) * S;
  };
  const colOf = (slot: number) => slot * 3;

  /** Push a span part from world A to world B with radius r (and r·flat on the second axis); hint (hx, hy, hz). */
  function span(
    b: PartBatch, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, flat: number,
    slot: number, glow: number, hx = 0, hy = 1, hz = 0,
  ): void {
    const yx = bx - ax, yy = by - ay, yz = bz - az;
    const L = len3(yx, yy, yz) || 1e-6;
    const nx = yx / L, ny = yy / L, nz = yz / L;
    let d = hx * nx + hy * ny + hz * nz;
    let xx = hx - nx * d, xy = hy - ny * d, xz = hz - nz * d;
    let xl = len3(xx, xy, xz);
    if (xl < 1e-4) { hx = CH; hy = 0; hz = SH; d = hx * nx + hz * nz; xx = hx - nx * d; xy = -ny * d; xz = hz - nz * d; xl = len3(xx, xy, xz) || 1; }
    xx /= xl; xy /= xl; xz /= xl;
    const zx = xy * nz - xz * ny, zy = xz * nx - xx * nz, zz = xx * ny - xy * nx; // x × y
    const c = colOf(slot), rgb = ENT.slotRgb;
    b.push(ax, ay, az, xx * r, xy * r, xz * r, yx, yy, yz, zx * r * flat, zy * r * flat, zz * r * flat, rgb[c], rgb[c + 1], rgb[c + 2], glow);
  }

  /** A static part from the description, on the animated beads (axial) or rods (radial). */
  function emitDescPart(p: PartDesc, beads: Float32Array, rods: Float32Array): void {
    const batch = parts[p.type];
    const glow = p.slot === SLOT.glow ? ENT.slotGlow[SLOT.glow] : p.slot === SLOT.eye ? ENT.slotGlow[SLOT.eye] : p.glow;
    if (p.rod) {
      const oa = p.a * ROD_STRIDE, ob = p.b * ROD_STRIDE;
      const ax = rods[oa], ay = rods[oa + 1], az = rods[oa + 2], bx = rods[ob + 3], by = rods[ob + 4], bz = rods[ob + 5];
      toW(ax + (bx - ax) * p.t0, ay + (by - ay) * p.t0, az + (bz - az) * p.t0);
      const Ax = W[0], Ay = W[1], Az = W[2];
      toW(ax + (bx - ax) * p.t1, ay + (by - ay) * p.t1, az + (bz - az) * p.t1);
      span(batch, Ax, Ay, Az, W[0], W[1], W[2], rods[p.rRef * ROD_STRIDE + 6] * p.r * S, p.flat, p.slot, glow);
      return;
    }
    const fa = p.a * 5;
    if (p.b >= 0) {
      const fb = p.b * 5;
      const ax = beads[fa], ay = beads[fa + 1], az = beads[fa + 2], dx = beads[fb] - ax, dy = beads[fb + 1] - ay, dz = beads[fb + 2] - az;
      toW(ax + dx * p.t0, ay + dy * p.t0, az + dz * p.t0);
      const Ax = W[0], Ay = W[1], Az = W[2];
      toW(ax + dx * p.t1, ay + dy * p.t1, az + dz * p.t1);
      span(batch, Ax, Ay, Az, W[0], W[1], W[2], beads[p.rRef * 5 + 3] * p.r * S, p.flat, p.slot, glow, CH, 0.4, SH);
      return;
    }
    // In bead a's yaw frame: F forward, U up, L lateral (world), scaled by the bead radius.
    const ya = Math.atan2(SH, CH) + ENT.shape[p.a * 4 + 3];
    const fx = Math.cos(ya), fz = Math.sin(ya);
    const rw = beads[fa + 3] * S;
    toW(beads[fa], beads[fa + 1], beads[fa + 2]);
    const ox = W[0] + (fx * p.ox - fz * p.oz) * rw, oy = W[1] + p.oy * rw, oz = W[2] + (fz * p.ox + fx * p.oz) * rw;
    const c = colOf(p.slot), rgb = ENT.slotRgb;
    batch.push(ox, oy, oz, fx * p.sx * rw, 0, fz * p.sx * rw, 0, p.sy * rw, 0, -fz * p.sz * rw, 0, fx * p.sz * rw, rgb[c], rgb[c + 1], rgb[c + 2], glow);
  }

  /** A small sphere (knee, catchlight, tip) at world W-point with radius r: smooth on carbon, faceted (and rimmed) on silicon. */
  function knob(x: number, y: number, z: number, r: number, slot: number, glow: number): void {
    const c = colOf(slot), rgb = ENT.slotRgb;
    parts[ENT.silicon ? PART.knobSi : PART.knob].push(x, y, z, r, 0, 0, 0, r, 0, 0, 0, r, rgb[c], rgb[c + 1], rgb[c + 2], glow);
  }

  function drawAxialNear(e: Entry, d: AxialDesc, t: number, mode: number): boolean {
    const lb = d.faceted ? siLoft : axLoft;
    if (!room(lb)) return false;
    const beads = scratch, sh = e.shape;
    // ---- loft rings through the posed spine, tail cap → head dome ----------------------------------------------
    const sp = d.spine, ns = sp.length;
    let nr = 0;
    // world spine points and radii, once (SPW: x, y, z, a, b per spine bead)
    for (let k = 0; k < ns; k++) {
      const bi = sp[k].bead, f = bi * 5, o = k * 5;
      toW(beads[f], beads[f + 1], beads[f + 2]);
      SPW[o] = W[0]; SPW[o + 1] = W[1]; SPW[o + 2] = W[2];
      SPW[o + 3] = beads[f + 3] * sh[bi * 4 + 2] * S; SPW[o + 4] = beads[f + 3] * sh[bi * 4 + 1] * S;
    }
    for (let k = 0; k < ns; k++) {
      const o = k * 5, n1 = (k < ns - 1 ? k + 1 : k) * 5, p1 = (k > 0 ? k - 1 : k) * 5;
      const tx = SPW[n1] - SPW[p1], ty = SPW[n1 + 1] - SPW[p1 + 1], tz = SPW[n1 + 2] - SPW[p1 + 2];
      if (k === 0) {
        // tail cap, extrapolated back along the end tangent
        const l = len3(tx, ty, tz) || 1, ux = tx / l, uy = ty / l, uz = tz / l;
        const cap = d.tailCap * Math.max(SPW[3], SPW[4]);
        for (let q = 0; q < 3; q++) {
          const f = TAIL_F[q] * cap, kk = TAIL_K[q];
          setRing(ringBuf, nr++, SPW[0] - ux * f, SPW[1] - uy * f, SPW[2] - uz * f, ux, uy, uz, 0, 1, 0, SPW[3] * kk, SPW[4] * kk, sp[0].slot);
        }
      }
      setRing(ringBuf, nr++, SPW[o], SPW[o + 1], SPW[o + 2], tx, ty, tz, 0, 1, 0, SPW[o + 3], SPW[o + 4], sp[k].slot);
      if (d.faceted && d.mids && k < ns - 1) {
        // stepped (when the ring budget allows; else straight hex segments): a narrower waist ring halfway to the next segment, straight between (each segment reads as a unit)
        const q1 = (k + 1) * 5;
        setRing(ringBuf, nr++, (SPW[o] + SPW[q1]) / 2, (SPW[o + 1] + SPW[q1 + 1]) / 2, (SPW[o + 2] + SPW[q1 + 2]) / 2,
          SPW[q1] - SPW[o], SPW[q1 + 1] - SPW[o + 1], SPW[q1 + 2] - SPW[o + 2], 0, 1, 0,
          0.4 * (SPW[o + 3] + SPW[q1 + 3]), 0.4 * (SPW[o + 4] + SPW[q1 + 4]), sp[k + 1].slot);
      } else if (d.mids && k < ns - 1) {
        // Catmull–Rom midpoint between k and k+1
        const q2 = (k + 2 < ns ? k + 2 : ns - 1) * 5, q1 = (k + 1) * 5;
        const mx = (-SPW[p1] + 9 * SPW[o] + 9 * SPW[q1] - SPW[q2]) / 16;
        const my = (-SPW[p1 + 1] + 9 * SPW[o + 1] + 9 * SPW[q1 + 1] - SPW[q2 + 1]) / 16;
        const mz = (-SPW[p1 + 2] + 9 * SPW[o + 2] + 9 * SPW[q1 + 2] - SPW[q2 + 2]) / 16;
        setRing(ringBuf, nr++, mx, my, mz, SPW[q1] - SPW[o], SPW[q1 + 1] - SPW[o + 1], SPW[q1 + 2] - SPW[o + 2], 0, 1, 0,
          (SPW[o + 3] + SPW[q1 + 3]) / 2, (SPW[o + 4] + SPW[q1 + 4]) / 2, sp[k + 1].slot);
      }
      if (k === ns - 1) {
        // head dome
        const l = len3(tx, ty, tz) || 1, ux = tx / l, uy = ty / l, uz = tz / l;
        const cap = d.headCap * Math.max(SPW[o + 3], SPW[o + 4]);
        for (let q = 0; q < 3; q++) {
          const f = HEAD_F[q] * cap, kk = HEAD_K[q];
          setRing(ringBuf, nr++, SPW[o] + ux * f, SPW[o + 1] + uy * f, SPW[o + 2] + uz * f, ux, uy, uz, 0, 1, 0, SPW[o + 3] * kk, SPW[o + 4] * kk, sp[k].slot);
        }
      }
    }
    writeRings(ringBuf, nr, AX_RINGS, d.faceted ? SI_SEC : AX_SEC, lb.pos, lb.nor, lb.col, lb.glow, lb.n * lb.per, e.slotRgb, e.slotGlow);
    lb.n++;

    // ---- static parts on the posed beads ------------------------------------------------------------------------
    for (const p of d.parts) emitDescPart(p, beads, rodScratch);

    // ---- legs: thigh, knee, shin, foot pad and claws (jointed) or a tapering tentacle --------------------------
    for (const L of d.legs) {
      const rk = L.rig * 2 * ROD_STRIDE;
      const r0 = rodScratch[rk + 6] * S;
      toW(rodScratch[rk], rodScratch[rk + 1], rodScratch[rk + 2]); const hx = W[0], hy = W[1], hz = W[2];
      toW(rodScratch[rk + 3], rodScratch[rk + 4], rodScratch[rk + 5]); const kx = W[0], ky = W[1], kz = W[2];
      toW(rodScratch[rk + 12], rodScratch[rk + 13], rodScratch[rk + 14]); const fx = W[0], fy = W[1], fz = W[2];
      if (e.silicon) {
        // straight hexagonal rods meeting at a faceted knee, a flat hex foot plate (the same planted-foot IK gait)
        span(parts[PART.thighSi], hx, hy, hz, kx, ky, kz, r0 * 1.2, 1, SLOT.body, 0, CH, 0, SH);
        knob(kx, ky, kz, r0 * 0.7, SLOT.accent, 0);
        span(parts[PART.rodSi], kx, ky, kz, fx, fy, fz, r0 * 0.62, 1, SLOT.body, 0, CH, 0, SH);
        const c = colOf(SLOT.accent), rgb = e.slotRgb, pr = r0 * 1.2;
        parts[PART.plateSi].push(fx, fy - r0 * 0.45, fz, CH * pr, 0, SH * pr, 0, r0 * 0.4, 0, -SH * pr, 0, CH * pr, rgb[c], rgb[c + 1], rgb[c + 2], 0);
      } else if (L.jointed) {
        span(parts[PART.thighC], hx, hy, hz, kx, ky, kz, r0 * 1.35, 1, SLOT.body, 0, CH, 0, SH);
        knob(kx, ky, kz, r0 * 0.62, SLOT.body, 0);
        span(parts[PART.rodC], kx, ky, kz, fx, fy, fz, r0 * 0.62, 1, SLOT.body, 0, CH, 0, SH);
        // pad flat on the ground, claws forward
        const c = colOf(SLOT.body), rgb = e.slotRgb, pr = r0 * 1.15;
        parts[PART.plateC].push(fx, fy - r0 * 0.5, fz, CH * pr, 0, SH * pr, 0, r0 * 0.35, 0, -SH * pr, 0, CH * pr, rgb[c], rgb[c + 1], rgb[c + 2], 0);
        for (let q = -1; q <= 1; q += 2) {
          const a = Math.atan2(SH, CH) + q * 0.35;
          const cl = r0 * 1.6;
          span(parts[PART.hornC], fx, fy - r0 * 0.3, fz, fx + Math.cos(a) * cl, fy - r0 * 0.6, fz + Math.sin(a) * cl, r0 * 0.3, 1, SLOT.accent, 0, 0, 1, 0);
        }
      } else {
        span(parts[PART.rodC], hx, hy, hz, kx, ky, kz, r0 * 1.05, 1, SLOT.body, 0, CH, 0, SH);
        span(parts[PART.rodC], kx, ky, kz, fx, fy, fz, r0 * 0.75, 1, SLOT.body, 0, CH, 0, SH);
        knob(fx, fy, fz, r0 * 0.5, SLOT.accent, 0);
      }
    }

    // ---- floaters: a breathing gas bell over the body, tendrils trailing with lag, fronds at the tips ----------
    if (mode === LOCOMOTION.hover && room(bellLoft)) {
      e.bell = true;
      const ob = d.bell.over * 5;
      toW(beads[ob], beads[ob + 1] + beads[ob + 3] * 0.55, beads[ob + 2]);
      const bx = W[0], by = W[1], bz = W[2];
      const ph = 2 * Math.PI * 0.35 * t + e.id;
      const breath = Math.sin(ph - 0.45 * Math.sin(ph));                     // inflate slowly, deflate quicker
      const R = d.bell.r * S * (1 + 0.07 * breath), H = d.bell.h * S * (1 - 0.04 * breath);
      // egg profile (y up from the rim, radius factor), closed underneath
      let nb = 0;
      for (let q = 0; q < BELL_Y.length; q++) {
        const rr = R * BELL_R[q] * (1 + 0.02 * Math.sin(1.3 * t - q * 0.6));
        setRing(ringBuf, nb++, bx, by + H * BELL_Y[q], bz, 0, 1, 0, CH, 0, SH, rr, rr, q === 2 || q === 3 ? SLOT.accent : SLOT.body);
      }
      writeRings(ringBuf, nb, BELL_RINGS, BELL_SEC, bellLoft.pos, bellLoft.nor, bellLoft.col, bellLoft.glow, bellLoft.n * bellLoft.per, e.slotRgb, e.slotGlow);
      bellLoft.n++;
      tendrils(bx, by, bz, R * 0.62, H * 1.6, t, false, 0);
    }
    return true;
  }

  /** Tendrils hanging from a ring of radius rr around (cx, cy, cz), trailing behind the heading with speed. */
  function tendrils(cx: number, cy: number, cz: number, rr: number, len: number, t: number, lattice: boolean, armR: number): void {
    const e = ENT;
    const lag = 0.18 + Math.min(1, e.speed / Math.max(0.1, drawnLength(e.scale, e.g) * 0.12)) * 0.5;
    const sl = len / TENDRIL_LINKS;
    const glowing = e.slotGlow[SLOT.glow] > 0;
    for (let i = 0; i < TENDRILS; i++) {
      const ang = (i / TENDRILS) * 2 * Math.PI + 0.4;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      // spread direction in the ground plane (heading frame)
      const sx = CH * ca - SH * sa, sz = SH * ca + CH * sa;
      let x = cx + sx * rr, y = cy, z = cz + sz * rr;
      const w0 = lattice ? armR : rr * 0.11;
      for (let k = 1; k <= TENDRIL_LINKS; k++) {
        const kk = k / TENDRIL_LINKS;
        let wave = Math.sin(1.1 * t - k * 0.55 + i * 1.9 + e.id) * 0.32;
        if (lattice) wave = Math.round(wave / D15) * D15; // silicon: the sway steps in 15°
        const back = sl * (lag * (0.4 + kk));
        const nx = x - CH * back + (-SH) * Math.sin(wave) * sl + sx * sl * 0.25 * (1 - kk);
        const nz = z - SH * back + CH * Math.sin(wave) * sl + sz * sl * 0.25 * (1 - kk);
        const ny = y - sl * Math.cos(wave) * 0.92;
        const w = w0 * (1 - 0.55 * kk);
        if (lattice) span(parts[PART.rodSi], x, y, z, nx, ny, nz, w, 1, k === 1 ? SLOT.body : SLOT.accent, 0);
        else span(parts[PART.rodC], x, y, z, nx, ny, nz, w, 0.35, SLOT.body, 0, -sz, 0, sx);
        if (!lattice && k >= TENDRIL_LINKS - 1) {
          // fronds: feathery fins on the last links, fluttering
          const fl = Math.sin(4.2 * t + k * 1.3 + i) * 0.5;
          const ox = -sz + CH * 0.3 * fl, oz = sx + SH * 0.3 * fl;
          const L = sl * 0.9, c = colOf(SLOT.accent), rgb = e.slotRgb;
          const dx = nx - x, dy = ny - y, dz = nz - z;
          parts[PART.frill].push(x, y, z, dx, dy, dz, ox * L * 0.7, 0.15 * L, oz * L * 0.7, 0, 0.02 * L, 0, rgb[c], rgb[c + 1], rgb[c + 2], 0);
        }
        x = nx; y = ny; z = nz;
      }
      if (glowing && i % 2 === 0) knob(x, y, z, w0 * 0.9, SLOT.glow, e.slotGlow[SLOT.glow]);
    }
  }

  /** One hub ring at fraction f up tier rod i, radius × k. Returns the next ring index. */
  let HX = 0, HY = 0, HZ = 1; // hub ring up hint (drawRadialNear)
  function hubRing(rods: Float32Array, nr: number, i: number, f: number, k: number, Tx: number, Ty: number, Tz: number, slot: number): number {
    const o = i * ROD_STRIDE;
    toW(rods[o] + (rods[o + 3] - rods[o]) * f, rods[o + 1] + (rods[o + 4] - rods[o + 1]) * f, rods[o + 2] + (rods[o + 5] - rods[o + 2]) * f);
    const r = rods[o + 6] * S * k;
    setRing(ringBuf, nr, W[0], W[1], W[2], Tx, Ty, Tz, HX, HY, HZ, r, r, slot);
    return nr + 1;
  }
  const slotOfRod = (e: Entry, i: number) => (e.rodTone[i] === 5 ? SLOT.accent : SLOT.body);

  function drawRadialNear(e: Entry, d: RadialDesc, t: number, mode: number): boolean {
    if (!room(hubLoft)) return false;
    const R = e.layout.radial!, rods = rodScratch, eyes = scratch;
    // ---- hub loft: stepped tiers up the (possibly rolled) hub axis, a rounded n-gon cross-section ---------------
    const o0 = 0, oT = (R.nTiers - 1) * ROD_STRIDE;
    toW(rods[o0], rods[o0 + 1], rods[o0 + 2]); const ax = W[0], ay = W[1], az = W[2];
    toW(rods[oT + 3], rods[oT + 4], rods[oT + 5]);
    let Tx = W[0] - ax, Ty = W[1] - ay, Tz = W[2] - az;
    const tl = len3(Tx, Ty, Tz) || 1; Tx /= tl; Ty /= tl; Tz /= tl;
    // one tier's height, along the hub axis whichever way it points (a swimmer's hub lies along its travel axis)
    const h = len3(rods[3] - rods[0], rods[4] - rods[1], rods[5] - rods[2]) * S;
    // the rings' up hint: forward for a standing hub; world up for a laid one (forward would be its own axis)
    if (Math.abs(Ty) < 0.7) { HX = 0; HY = 1; HZ = 0; } else { HX = CH; HY = 0; HZ = SH; }
    let nr = 0;
    // underside: apex, shoulder
    toW(rods[o0], rods[o0 + 1], rods[o0 + 2]);
    const r0 = rods[6] * S;
    setRing(ringBuf, nr++, W[0] - Tx * h * 0.22, W[1] - Ty * h * 0.22, W[2] - Tz * h * 0.22, Tx, Ty, Tz, HX, HY, HZ, r0 * 0.06, r0 * 0.06, slotOfRod(e, 0));
    setRing(ringBuf, nr++, W[0] - Tx * h * 0.12, W[1] - Ty * h * 0.12, W[2] - Tz * h * 0.12, Tx, Ty, Tz, HX, HY, HZ, r0 * 0.55, r0 * 0.55, slotOfRod(e, 0));
    for (let i = 0; i < R.nTiers; i++) {
      nr = hubRing(rods, nr, i, 0, 0.8, Tx, Ty, Tz, slotOfRod(e, i));
      nr = hubRing(rods, nr, i, 0.2, 1, Tx, Ty, Tz, slotOfRod(e, i));
      nr = hubRing(rods, nr, i, 0.8, 1, Tx, Ty, Tz, slotOfRod(e, i));
      if (i === R.nTiers - 1) nr = hubRing(rods, nr, i, 1, 0.8, Tx, Ty, Tz, slotOfRod(e, i));
    }
    // crown: shoulder and apex
    toW(rods[oT + 3], rods[oT + 4], rods[oT + 5]);
    const rt = rods[oT + 6] * S;
    setRing(ringBuf, nr++, W[0] + Tx * h * 0.14, W[1] + Ty * h * 0.14, W[2] + Tz * h * 0.14, Tx, Ty, Tz, HX, HY, HZ, rt * 0.5, rt * 0.5, slotOfRod(e, R.nTiers - 1));
    setRing(ringBuf, nr++, W[0] + Tx * h * 0.22, W[1] + Ty * h * 0.22, W[2] + Tz * h * 0.22, Tx, Ty, Tz, HX, HY, HZ, rt * 0.06, rt * 0.06, slotOfRod(e, R.nTiers - 1));
    writeRings(ringBuf, nr, RAD_RINGS, hubSection(d.sides), hubLoft.pos, hubLoft.nor, hubLoft.col, hubLoft.glow, hubLoft.n * hubLoft.per, e.slotRgb, e.slotGlow);
    hubLoft.n++;

    // ---- tiles and spires -------------------------------------------------------------------------------------------
    for (const p of d.parts) emitDescPart(p, eyes, rods);

    // ---- arms: thick hexagonal thigh, straight shin, knee knob, twigs/blades; cyan dot eyes (or a tip) at the end ----
    const eyeGlow = e.slotGlow[SLOT.eye];
    for (const arm of d.arms) {
      for (let k = 0; k < arm.nRods; k++) {
        const o = (arm.firstRod + k) * ROD_STRIDE;
        toW(rods[o], rods[o + 1], rods[o + 2]); const x0 = W[0], y0 = W[1], z0 = W[2];
        toW(rods[o + 3], rods[o + 4], rods[o + 5]);
        const r = rods[o + 6] * S, flat = rods[o + 7];
        const slot = e.rodTone[arm.firstRod + k] === 5 ? SLOT.accent : SLOT.body;
        if (flat < 1) {
          // fan blade: a flat hex plate continuing the arm
          span(parts[PART.plateSi], x0, y0, z0, W[0], W[1], W[2], r * 0.55, flat * 4, slot, 0, 0, 1, 0);
        } else {
          span(parts[k === 0 ? PART.thighSi : PART.rodSi], x0, y0, z0, W[0], W[1], W[2], r * (k === 0 ? 1.3 : 1.05), 1, slot, 0);
          if (k === 0) knob(W[0], W[1], W[2], r * 0.72, slot, 0);
        }
      }
      if (arm.eyeN === 0) {
        // eyeless: a plain accent tip (no cyan dot, so the body never shows an eye the inspect card doesn't list)
        const o = (arm.firstRod + Math.min(arm.tipRod, arm.nRods - 1)) * ROD_STRIDE;
        toW(rods[o + 3], rods[o + 4], rods[o + 5]);
        knob(W[0], W[1], W[2], rods[o + 6] * S * 0.7, SLOT.accent, 0);
      }
      for (let q = 0; q < arm.eyeN; q++) {
        const f = (arm.eyeFirst + q) * 5;
        toW(eyes[f], eyes[f + 1], eyes[f + 2]);
        knob(W[0], W[1], W[2], eyes[f + 3] * S, SLOT.eye, eyeGlow);
      }
    }

    // ---- floaters: the pulsing hub trails stepped rod tendrils from under its rim ---------------------------------
    if (mode === LOCOMOTION.hover) {
      toW(rods[o0], rods[o0 + 1], rods[o0 + 2]);
      tendrils(W[0], W[1] - h * 0.1, W[2], r0 * 0.7, (R.pivotY + h / S) * S * 2.2, t, true, r0 * 0.07);
    }
    return true;
  }

  // ---- swimmers (mode = swim): aquatic bodies (faunaLib/aquatic, aquatic-life.md) in the same loft and part batches --
  // The swimmer is posed in body space (metres at its adult drawn length, +x forward, head forward of the centre) on a
  // straight path, then carried to the world like the rest of the near LOD: heading, position, and SW_S (growth × fade).
  // Its stroke phase is integrated from the sim's speed (swPhase), so the body never treadmills; the wave runs nose → tail.
  let SW_S = 1;
  const D = new Float32Array(3);
  /** Body-space point → world, into W (the swimmer's scale). */
  const swW = (x: number, y: number, z: number) => {
    W[0] = EX + (x * CH - z * SH) * SW_S; W[1] = EY + y * SW_S; W[2] = EZ + (x * SH + z * CH) * SW_S;
  };
  /** Body-space direction → world (rotation only), into D. */
  const swD = (x: number, y: number, z: number) => { D[0] = x * CH - z * SH; D[1] = y; D[2] = x * SH + z * CH; };

  /** The creature's aquatic body, built once at its adult drawn length the first time it swims near (null if it can't be). */
  function swimmerOf(e: Entry): Swimmer | null {
    if (e.sw || e.swTried || !e.plan) return e.sw;
    e.swTried = true;
    if (e.plan.chemistry === 'silicon' && e.plan.architecture === 'axial') return null; // an armoured walker that swims keeps its faceted body
    try {
      const params = swimmerParamsFromPlan(e.plan, { sociality: e.soc });
      params.length = drawnLength(e.scale, 1); // the display-size rule, as for walkers (aquatic-life.md §6.3)
      e.sw = buildSwimmer(params, e.id);
    } catch { e.sw = null; }
    return e.sw;
  }

  /** Swimmer palette role → this creature's fauna slot: its species body and accent, ink/bone eyes, the glow. */
  function slotOfRole(sw: Swimmer, k: LookKey): number {
    if (k === 'glow' || k === 'glowDeep') return SLOT.glow;
    if (k === sw.params.colour.accent) return SLOT.accent;
    if (k === 'ink') return SLOT.eye;
    if (k === 'bone') return SLOT.bone;
    return SLOT.body;
  }

  /** Write one swimmer tube or fin strip (rings in body space, resampled to the batch's ring count) as a loft slot. */
  function swimLoft(L: LoftBatch, sec: Section, n: number, ring: (j: number, k: number) => void): void {
    const nr = Math.min(n, L.rings);
    for (let k = 0; k < nr; k++) ring(nr === n ? k : Math.round((k * (n - 1)) / (nr - 1)), k);
    writeRings(ringBuf, nr, L.rings, sec, L.pos, L.nor, L.col, L.glow, L.n * L.per, ENT.slotRgb, ENT.slotGlow);
    L.n++;
  }

  const OAR_X: V3 = [0, 0, 0], OAR_Z: V3 = [0, 0, 0]; // the bladeSi oar basis (the part push copies it)
  const SINK: SwimSink = {
    tube(i, c, U, R, rw, rh, top = 1) {
      void R;
      const sw = ENT.sw!, spec = sw.tubes[i];
      const L = spec.flat ? hubLoft : axLoft; // silicon tubes are faceted hubs and bells; carbon tubes are round bodies
      if (!room(L)) return;
      const slot = slotOfRole(sw, spec.colour), n = c.length;
      swimLoft(L, spec.flat ? hubSection(spec.sides) : AX_SEC, n, (j, k) => {
        // a flat back over a deep belly (top < 1): the ring spans −rh … +rh·top, so its centre rises by rh·(top − 1)/2
        const off = (rh[j] * (top - 1)) / 2;
        swW(c[j][0] + U[j][0] * off, c[j][1] + U[j][1] * off, c[j][2] + U[j][2] * off);
        const cx = W[0], cy = W[1], cz = W[2];
        const jp = Math.max(0, j - 1), jn = Math.min(n - 1, j + 1);
        swD(c[jn][0] - c[jp][0], c[jn][1] - c[jp][1], c[jn][2] - c[jp][2]);
        const tx = D[0], ty = D[1], tz = D[2];
        swD(U[j][0], U[j][1], U[j][2]);
        setRing(ringBuf, k, cx, cy, cz, tx, ty, tz, D[0], D[1], D[2], rw[j] * SW_S, (rh[j] * (1 + top) * SW_S) / 2, slot);
      });
    },
    sheet(i, a, b) {
      // a fin membrane as a thin lofted strip: one flat ellipse per column, from its base line to its tip line
      if (!room(axLoft)) return;
      const sw = ENT.sw!, slot = slotOfRole(sw, sw.sheets[i].colour), n = a.length;
      swimLoft(axLoft, AX_SEC, n, (j, k) => {
        const hx = b[j][0] - a[j][0], hy = b[j][1] - a[j][1], hz = b[j][2] - a[j][2], h = len3(hx, hy, hz);
        swW((a[j][0] + b[j][0]) / 2, (a[j][1] + b[j][1]) / 2, (a[j][2] + b[j][2]) / 2);
        const cx = W[0], cy = W[1], cz = W[2];
        const jp = Math.max(0, j - 1), jn = Math.min(n - 1, j + 1);
        swD(a[jn][0] - a[jp][0], a[jn][1] - a[jp][1], a[jn][2] - a[jp][2]);
        const tx = D[0], ty = D[1], tz = D[2];
        swD(hx, hy, hz);
        setRing(ringBuf, k, cx, cy, cz, tx, ty, tz, D[0], D[1], D[2], Math.max(0.004, 0.035 * h) * SW_S, (h / 2) * SW_S, slot);
      });
    },
    part(type: SwimPart, o: V3, x: V3, y: V3, z: V3, ca: LookKey, _cb: LookKey, glow: number) {
      const sw = ENT.sw!, slot = slotOfRole(sw, ca), c = slot * 3, rgb = ENT.slotRgb;
      let P: number = PART.knob, ox = o[0], oy = o[1], oz = o[2], X = x, Y = y, Z = z;
      switch (type) {
        case 'eye': case 'dot': P = ENT.silicon ? PART.knobSi : PART.knob; break;
        case 'rod': P = PART.rodC; break;
        case 'rodSi': P = PART.rodSi; break;
        case 'plate': P = PART.plateC; break;
        case 'ring': P = PART.ring; break;
        case 'crystal': P = PART.hornSi; ox -= y[0] / 2; oy -= y[1] / 2; oz -= y[2] / 2; break; // a spike centred on o
        case 'blade': P = PART.fin; break; // a swept, tapered fin rooted at o: x chord (back), y span, z = x × y, as the fin geometry
        case 'bladeSi': {
          // silicon paddles are rod oars, never pads: a rod from o along the blade, a little thicker than its chord share
          P = PART.rodSi;
          const r = 0.18 * Math.hypot(x[0], x[1], x[2]);
          const xl = Math.hypot(x[0], x[1], x[2]) || 1, zl = Math.hypot(z[0], z[1], z[2]) || 1;
          X = OAR_X; Y = y; Z = OAR_Z;
          X[0] = (x[0] / xl) * r; X[1] = (x[1] / xl) * r; X[2] = (x[2] / xl) * r;
          Z[0] = (z[0] / zl) * r; Z[1] = (z[1] / zl) * r; Z[2] = (z[2] / zl) * r;
          break;
        }
      }
      swW(ox, oy, oz);
      const px = W[0], py = W[1], pz = W[2];
      swD(X[0], X[1], X[2]); const x0 = D[0] * SW_S, x1 = D[1] * SW_S, x2 = D[2] * SW_S;
      swD(Y[0], Y[1], Y[2]); const y0 = D[0] * SW_S, y1 = D[1] * SW_S, y2 = D[2] * SW_S;
      swD(Z[0], Z[1], Z[2]);
      parts[P].push(px, py, pz, x0, x1, x2, y0, y1, y2, D[0] * SW_S, D[1] * SW_S, D[2] * SW_S, rgb[c], rgb[c + 1], rgb[c + 2], glow);
    },
  };

  // One instance for every swimmer pose (the path is TRAIL_PATH, pooled): nothing is allocated per pose.
  let swimHeadX = 0;
  const swimInst = { s0: 0, phase: 0, off: [0, 0] as [number, number], k: 0 };
  // ---- swimmer trails: the head's recent world positions, so a body curves through its own turns and banks ----------
  // One ring of TRAIL_N head points per swimmer slot (SWIM_MAX + slack for the one-frame release lag), all preallocated.
  // Each pose converts its swimmer's trail to body space once (TB, TS: points head first and their arc lengths), and
  // TRAIL_PATH walks it; ahead of the head it continues on an arc of the swimmer's turn curvature (the builder's bank).
  const TRAIL_N = 64, TRAILS = SWIM_MAX + 4;
  const trailXZ = new Float32Array(TRAILS * TRAIL_N * 2), trailAt = new Int32Array(TRAILS), trailCount = new Int32Array(TRAILS);
  const trailPool = new SlotPool(TRAILS);
  function releaseTrail(e: Entry): void {
    if (e.trail >= 0) { trailPool.release(e.trail); e.trail = -1; }
  }
  const TRAIL_PATH = new TrailPath(TRAIL_N);
  /** Record the swimmer's head (world) into its trail, and lay the trail out in body space for this pose. */
  function trailFor(e: Entry, sw: Swimmer, headX: number): void {
    TRAIL_PATH.straightOn(headX);
    if (e.trail < 0) { const k = trailPool.acquire(); if (k < 0) return; e.trail = k; trailCount[k] = 0; trailAt[k] = 0; }
    const k = e.trail, base = k * TRAIL_N * 2, Lw = sw.L * SW_S, step = Math.max(0.05, Lw / 20);
    swW(headX, 0, 0);
    const hx = W[0], hz = W[2];
    let record = trailCount[k] === 0;
    if (!record) {
      const j = base + ((trailAt[k] + TRAIL_N - 1) % TRAIL_N) * 2, dx = hx - trailXZ[j], dz = hz - trailXZ[j + 1], d2 = dx * dx + dz * dz;
      if (d2 > 16 * Lw * Lw) { trailCount[k] = 0; record = true; } // a jump (respawn): start again
      else record = d2 >= step * step;
    }
    if (record) {
      const j = base + trailAt[k] * 2;
      trailXZ[j] = hx; trailXZ[j + 1] = hz;
      trailAt[k] = (trailAt[k] + 1) % TRAIL_N;
      trailCount[k] = Math.min(TRAIL_N, trailCount[k] + 1);
    }
    // curvature ahead from the turn rate (world 1/m → body units), capped at two radians a body length
    const kw = e.turn / Math.max(e.speed, 0.2);
    TRAIL_PATH.begin(headX, Math.max(-2 / sw.L, Math.min(2 / sw.L, kw * SW_S)));
    // body space, head first: the live head, then the stored points newest to oldest (the newest only once it is a
    // quarter step from the head, so the head's tangent is never taken from a sliver)
    const inv = 1 / Math.max(SW_S, 1e-6);
    for (let c = 0, j = trailAt[k]; c < trailCount[k]; c++) {
      j = (j + TRAIL_N - 1) % TRAIL_N;
      const dx = (trailXZ[base + j * 2] - EX) * inv, dz = (trailXZ[base + j * 2 + 1] - EZ) * inv;
      TRAIL_PATH.push(dx * CH + dz * SH, -dx * SH + dz * CH, c === 0 ? 0.25 * step * inv : 1e-4);
    }
  }

  /** Pose the creature's swimmer at its integrated stroke phase into the near batches. True when its body was drawn. */
  function drawSwimmerNear(e: Entry, sw: Swimmer, live = true): boolean {
    const kin = sw.kin;
    const bells = sw.params.plan === 'bell' ? sw.params.radial.chain : 1;
    const tau = e.swPhase / kin.freq; // the pose's time: its stroke phase is the integrated phase
    // the head starts the path at 0 (s0 cancels the pose's own advance); the body centres on the animal's position
    swimInst.s0 = -advance(kin, tau, 0, bells);
    swimHeadX = sw.params.chemistry === 'carbon' ? 0.5 * sw.L
      : sw.params.plan === 'bell' ? 0.5 * ((bells > 1 ? 0.55 : 0) + 1.08 * bells) * sw.L : 0;
    if (live) trailFor(e, sw, swimHeadX); else TRAIL_PATH.straightOn(swimHeadX); // the card bake poses straight
    const nAx = axLoft.n, nHub = hubLoft.n;
    sw.pose(tau, TRAIL_PATH, swimInst, SINK);
    return axLoft.n > nAx || hubLoft.n > nHub;
  }

  /**
   * The inspect live view's copy of a creature: run the same near-LOD emitters once, at rest pose (speed 0, t 0, flat
   * ground, heading 0, scale 1), into the batches' spare slots and the parts' free tail, copy that out, then put the
   * counts back. Called on card open, between frames; the next update() rewrites the batches from 0 anyway.
   */
  function bakeNear(e: Entry): BakedCreature | null {
    if (!e.plan) return null;
    if (!e.desc) {
      try { e.desc = describe(e.plan, e.layout); e.bellS = e.desc.kind === 'axial' ? bellSphere(e.desc, e.layout) : null; } catch { return null; }
    }
    const L0 = LOFTS.map((l) => l.n), P0 = parts.map((b) => b.n);
    const speed = e.speed, flat0 = () => 0;
    e.speed = 0;
    baking = true;
    for (const l of LOFTS) l.n = Math.min(l.n, l.slots - l.reserve); // write into the reserve
    const L1 = LOFTS.map((l) => l.n);
    let ok = false;
    try {
      S = 1; EX = 0; EY = 0; EZ = 0; CH = 1; SH = 0; ENT = e;
      const sw = e.mode === LOCOMOTION.swim ? swimmerOf(e) : null;
      if (sw) { SW_S = 1; ok = drawSwimmerNear(e, sw, false); }
      else if (e.desc.kind === 'radial') { animateRadial(e, 0, 1, e.mode, flat0, 0, 1, 0); ok = drawRadialNear(e, e.desc, 0, e.mode); }
      else { animate(e, 0, 1, e.mode, flat0, 0, 1, 0); ok = drawAxialNear(e, e.desc, 0, e.mode); }
    } catch { ok = false; }
    const out: BakedCreature = { lofts: [], parts: [] };
    if (ok) {
      LOFTS.forEach((l, i) => {
        for (let slot = L1[i]; slot < l.n; slot++) {
          const v0 = slot * l.per, v1 = v0 + l.per;
          out.lofts.push({ pos: l.pos.slice(v0 * 3, v1 * 3), nor: l.nor.slice(v0 * 3, v1 * 3), col: l.col.slice(v0 * 3, v1 * 3), rings: l.rings, sides: l.sides, flat: l === siLoft });
        }
      });
      parts.forEach((b, i) => {
        const n = b.n - P0[i];
        if (n > 0) out.parts.push({ type: i, m: b.m.slice(P0[i] * 16, b.n * 16), col: b.col.slice(P0[i] * 3, b.n * 3), n });
      });
    }
    LOFTS.forEach((l, i) => { l.n = L0[i]; });
    parts.forEach((b, i) => { b.n = P0[i]; });
    baking = false; e.speed = speed;
    return ok ? out : null;
  }

  // Per-frame draw state, set at the top of update() (draw() and drawFar() live out here so a frame allocates no closures).
  let fGravity = 1, fDt = 1 / 60, warnedNear = false;
  let ft = 0, fBoost = 1, fSea = 0, fSeaThere = false, fPosed = 0, fSwim = 0, fSwimCut = Infinity;
  const frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
  // Ground cache: about 1k height samples a frame (one per creature, plus posed feet) became a resample only after a
  // creature moves 0.25 m or the terrain changes, with the slope kept so the cached plane is exact to first order.
  let terrainStamp = 0, sigRise = NaN, sigForm = NaN;
  function groundOf(e: Entry): number {
    const dx = e.x - e.gX, dz = e.z - e.gZ;
    if (e.gStamp !== terrainStamp || dx * dx + dz * dz > G_MOVE * G_MOVE) {
      const h = fHeight(e.x, e.z);
      e.gSx = (fHeight(e.x + G_MOVE, e.z) - h) / G_MOVE; e.gSz = (fHeight(e.x, e.z + G_MOVE) - h) / G_MOVE;
      e.gH = h; e.gX = e.x; e.gZ = e.z; e.gStamp = terrainStamp;
      return h;
    }
    return e.gH + e.gSx * dx + e.gSz * dz;
  }
  // Posed proxies (tier 1) plant their feet on the cached plane; lofted ones (tier 2) sample the terrain.
  let PL_H = 0, PL_SX = 0, PL_SZ = 0, PL_X = 0, PL_Z = 0;
  const planeAt = (x: number, z: number) => PL_H + PL_SX * (x - PL_X) + PL_SZ * (z - PL_Z);
  /** Conservative: the sphere is inside or on all four side planes of the camera frustum. */
  function inView(x: number, y: number, z: number, r: number): boolean {
    const P = frustum.planes;
    for (let i = 0; i < 4; i++) { const n = P[i].normal; if (n.x * x + n.y * y + n.z * z + P[i].constant < -r) return false; }
    return true;
  }
  // batch counts before a swimmer pose, so one that throws is rolled back (no allocation per frame)
  const saveL = new Int32Array(LOFTS.length), saveP = new Int32Array(parts.length);
  const P0 = { x: 0, z: 0, h: 0 }, P1 = { x: 0, z: 0, h: 0 }; // interpPose inputs, reused
  let fHeight: (x: number, z: number) => number = () => 0;

  /**
   * Draw one creature. tier 2: the full loft and parts (falls back to posed proxies if the batches are full);
   * 1: posed proxies; 0: proxies at rest pose.
   */
  function draw(e: Entry, alpha: number, mode: number, live: boolean, tier: number) {
    e.tier = 0; e.bell = false;
    const wasSwim = e.swOn;
    e.swOn = false;
    if (!wasSwim && e.trail >= 0) releaseTrail(e); // not drawn as a swimmer last frame: its trail slot goes back
    const ground = groundOf(e);
    const s = fBoost * drawnFactor(e.scale, e.g) * alpha;
    if (s <= 0) return;
    let y0 = ground;
    e.yDrawn = ground; // for next frame's view test
    // Walkers on slopes: pitch the body from the ground under head and tail and stand it on whichever is higher, the
    // centre ground or the head–tail line, so long bodies neither clip into a hill nor leave downhill feet hanging.
    if (mode === LOCOMOTION.walk && !e.layout.radial && tier >= 1) {
      const hx = (e.xmin + e.xspan) * s, tx = e.xmin * s, c = Math.cos(e.h), sn = Math.sin(e.h);
      const ddx = e.x - e.pX, ddz = e.z - e.pZ;
      if (e.pStamp !== terrainStamp || ddx * ddx + ddz * ddz > G_MOVE * G_MOVE || Math.abs(e.h - e.pH) > 0.05) {
        e.gHead = fHeight(e.x + c * hx, e.z + sn * hx); e.gTail = fHeight(e.x + c * tx, e.z + sn * tx);
        e.pX = e.x; e.pZ = e.z; e.pH = e.h; e.pStamp = terrainStamp;
      }
      const target = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, Math.atan2(e.gHead - e.gTail, Math.max(1e-3, hx - tx))));
      e.pitch += (target - e.pitch) * Math.min(1, fDt / PITCH_EASE);
      y0 = Math.max(ground, 0.5 * (e.gHead + e.gTail) - 0.02 * (hx - tx));
    } else if (e.pitch !== 0) e.pitch += (0 - e.pitch) * Math.min(1, fDt / PITCH_EASE);
    if (mode === LOCOMOTION.hover) y0 = ground + (ALT_MAX_M * Math.tanh((e.alt ?? 0) / ALT_H0_M) + drawnLength(e.scale, e.g) * fBoost * Math.min(1, (e.alt ?? 0) / (3 * e.scale)) * (0.9 + 0.25 * Math.sin(ft * 1.3 + e.id))) * alpha;
    else if (mode === LOCOMOTION.swim && fSeaThere && ground < fSea) y0 = ground + (fSea - ground) * 0.35;

    const lay = e.layout;
    const cosH = Math.cos(e.h), sinH = Math.sin(e.h);
    if (live) {
      pid[pn] = e.id; px[pn] = e.x; py[pn] = y0 + lay.centreY * s; pz[pn] = e.z; pr[pn] = Math.max(lay.radius * s * 0.85, 0.3); // tight: 85% of the bead bounds, at least 30 cm
      if (mode === LOCOMOTION.walk && !lay.radial) { // a walking body swings its head and tail off the axis
        const h = 0.5 * e.xspan;
        pr[pn] += (Math.abs(e.curl) * h * e.walkW + 0.5 * Math.abs(turnKap(e, s)) * h * h) * s;
      }
      pe[pn] = e; pS[pn] = s; pY0[pn] = y0;
      pn++;
    }
    if (tier === 0) {
      if (mode === LOCOMOTION.swim && lay.radial) { const L = laidRest(e); drawFar(e, s, y0, cosH, sinH, L.flat, L.rods); }
      else drawFar(e, s, y0, cosH, sinH, e.flat, e.rods);
      return;
    }
    fPosed++;
    e.tier = 1;
    const s0 = fBoost * drawnFactor(e.scale, e.g);
    PL_H = e.gH; PL_SX = e.gSx; PL_SZ = e.gSz; PL_X = e.gX; PL_Z = e.gZ;
    const feetOn = tier === 2 ? fHeight : planeAt;
    if (lay.radial) animateRadial(e, ft, s0, mode, feetOn, y0, cosH, sinH);
    else animate(e, ft, s0, mode, feetOn, y0, cosH, sinH);
    if (tier === 2) {
      if (!e.desc && e.plan) {
        try {
          e.desc = describe(e.plan, lay);
          e.bellS = e.desc.kind === 'axial' ? bellSphere(e.desc, lay) : null;
        } catch { e.plan = null; } // never retried: it stays a posed proxy
      }
      // the nearest SWIM_MAX lofted swimmers (update's swim cut; a dying one keeps the look it had)
      if (mode === LOCOMOTION.swim && fSwim < SWIM_MAX && (live ? e.swRank <= fSwimCut : wasSwim)) {
        const sw = swimmerOf(e);
        if (sw) {
          S = s; EX = e.x; EY = y0 + lay.centreY * s; EZ = e.z; CH = cosH; SH = sinH; ENT = e;
          SW_S = (drawnLength(e.scale, e.g) / drawnLength(e.scale, 1)) * alpha * fBoost;
          for (let i = 0; i < LOFTS.length; i++) saveL[i] = LOFTS[i].n;
          for (let i = 0; i < parts.length; i++) saveP[i] = parts[i].n;
          try {
            if (drawSwimmerNear(e, sw)) { fSwim++; e.tier = 2; e.swOn = true; return; }
          } catch {
            // a pose that throws never stops the frame: undo what it wrote, and this creature keeps the bead loft
            for (let i = 0; i < LOFTS.length; i++) LOFTS[i].n = saveL[i];
            for (let i = 0; i < parts.length; i++) parts[i].n = saveP[i];
            e.sw = null; // swTried stays set: never rebuilt
          }
        }
      }
      if (e.desc) {
        S = s; EX = e.x; EY = y0; EZ = e.z; CH = cosH; SH = sinH; ENT = e;
        for (let i = 0; i < LOFTS.length; i++) saveL[i] = LOFTS[i].n;
        for (let i = 0; i < parts.length; i++) saveP[i] = parts[i].n;
        let ok = false;
        try {
          ok = e.desc.kind === 'radial' ? drawRadialNear(e, e.desc, ft, mode) : drawAxialNear(e, e.desc, ft, mode);
        } catch (err) {
          // a near draw that throws never stops the frame: undo what it wrote; this creature stays a posed proxy for good
          for (let i = 0; i < LOFTS.length; i++) LOFTS[i].n = saveL[i];
          for (let i = 0; i < parts.length; i++) parts[i].n = saveP[i];
          e.desc = null; e.plan = null; e.sw = null; e.swTried = true;
          if (!warnedNear) { warnedNear = true; console.warn('fauna: near-LOD draw failed; that creature stays a proxy', err); }
        }
        if (ok) {
          e.tier = 2;
          if (live && e.bell && e.bellS) {
            // the bell sits well above the body: grow the broad-phase sphere to hold it (hit() tests the bell itself)
            const pb = pickBounds(lay, e.bellS), i = pn - 1;
            py[i] = y0 + pb.cy * s; pr[i] = Math.max(pb.r * s, 0.3);
          }
          return;
        }
      }
    }
    drawFar(e, s, y0, cosH, sinH, scratch, rodScratch);
  }

  /** Proxies: ellipsoid beads (and round limb bones), or prisms for radial bodies, from rest or posed arrays. */
  function drawFar(e: Entry, s: number, y0: number, cosH: number, sinH: number, beads: Float32Array, rods: Float32Array) {
    const lay = e.layout, rad = lay.radial;
    const mi = e.silicon || rad ? 1 : 0;
    if (counts[mi] + lay.beads.length > CAP) return;
    let hubMesh = 0, nHex = 0;
    if (rad) {
      hubMesh = 2 + Math.max(0, HUB_SIDES.indexOf(rad.hubSides));
      nHex = rad.rods.length - rad.nTiers;
      if (counts[hubMesh] + rad.nTiers > HUB_CAP || counts[HEX] + nHex > HEX_CAP) return;
    }
    const glow = e.glow > GLOW_MIN ? e.glow : 0;
    const lr = lay.limbRods;
    if (lr && lr.length > 0) {
      // limb bones: round on carbon, hex prisms on silicon walkers
      const bm = e.silicon ? HEX : BONES;
      if (counts[bm] + lr.length > (e.silicon ? HEX_CAP : BONE_CAP)) return;
      for (let i = 0; i < lr.length; i++) emitRod(MESHES[bm], GLOWS[bm], counts[bm]++, rods, i, s, e.x, y0, e.z, cosH, sinH, e.rgb, e.rodTone[i], 0);
    }
    if (rad) {
      for (let i = 0; i < rad.rods.length; i++) {
        const mesh = i < rad.nTiers ? hubMesh : HEX;
        emitRod(MESHES[mesh], GLOWS[mesh], counts[mesh]++, rods, i, s, e.x, y0, e.z, cosH, sinH, e.rgb, e.rodTone[i], 0);
      }
    }
    const mesh = MESHES[mi], garr = GLOWS[mi];
    const arr = mesh.instanceMatrix.array as Float32Array;
    const carr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    const rgb = e.rgb, nb = lay.beads.length, shape = e.shape;
    for (let j = 0; j < nb; j++) {
      const f = j * 5, g = j * 4;
      const lx = beads[f] * s, lz = beads[f + 2] * s;
      const r = beads[f + 3] * s;
      const idx = counts[mi]++;
      const m = idx * 16;
      // Ellipsoid: local x along the bead's yaw (spine tangent), y up, z across; the heading turns the whole body.
      const ya = e.h + shape[g + 3], cy = Math.cos(ya), sy = Math.sin(ya);
      const ax = r * shape[g], ay = r * shape[g + 1], az = r * shape[g + 2];
      arr[m] = ax * cy; arr[m + 1] = 0; arr[m + 2] = ax * sy;
      arr[m + 4] = 0; arr[m + 5] = ay; arr[m + 6] = 0;
      arr[m + 8] = -az * sy; arr[m + 9] = 0; arr[m + 10] = az * cy;
      // Body x is forward; heading is measured in the patch (x, y) plane, and patch y is world z.
      arr[m + 12] = e.x + lx * cosH - lz * sinH; arr[m + 13] = y0 + beads[f + 1] * s; arr[m + 14] = e.z + lx * sinH + lz * cosH;
      const tone = e.flat[f + 4], c3 = idx * 3, t3 = tone * 3;
      carr[c3] = rgb[t3]; carr[c3 + 1] = rgb[t3 + 1]; carr[c3 + 2] = rgb[t3 + 2];
      garr[idx] = tone === 1 && e.silicon ? glow : tone === 6 ? glow : 0;
    }
  }


  const planBakes = new WeakMap<BodyPlan, BakedCreature | null>(); // bakePlan, per plan object
  const part: FaunaPart = {
    scaleBoost: 1,
    count: 0,
    update(dt, t, inputs, patch) {
      frame++;
      // A new run (another world, or the build restarting) starts a new book: ids and species don't carry over.
      if (inputs.world.id !== lastWorld || inputs.buildProgress + 0.25 < lastBuild) {
        if (lastWorld !== '') { entries.clear(); dying.length = 0; pending.clear(); book.reset(); trailPool.reset(); } // the cleared entries held trail slots
        lastWorld = inputs.world.id;
      }
      lastBuild = inputs.buildProgress;
      // the world's mineral armour now (crust mix at the ratchet's armour step); species stamp it as they are coloured
      book.setWorldHard(crustHard(inputs), crustGround(inputs));
      // Births: plans arrive once per snapshot; they wait for their organism's first appearance in the buffer.
      if (inputs.births !== lastBirths) {
        lastBirths = inputs.births;
        for (const b of inputs.births) {
          if (entries.has(b.id) || pending.has(b.id)) continue;
          try {
            pending.set(b.id, { plan: unpackBodyPlan(b.plan), snap: snapId });
          } catch { /* malformed plan: fall back to a capsule when the organism shows up */ }
        }
      }
      if (frame % 60 === 0) {
        for (const e of entries.values()) if (!e.seen && frame - e.lastSeen > FORGET_FRAMES) forget(e);
      }

      const buf = inputs.organisms;
      const snapshot = buf !== lastBuf;
      let dtSnap = 0.05;
      if (snapshot) {
        lastBuf = buf; snapId++;
        if (lastSnapT >= 0) dtSnap = Math.min(0.25, Math.max(0.03, t - lastSnapT));
        lastSnapT = t;
      }
      const n = organismCount(buf);
      if (px.length < n) {
        const m = Math.max(n, px.length * 2);
        pS = new Float32Array(m); pY0 = new Float32Array(m); pid = new Float64Array(m); px = new Float32Array(m); py = new Float32Array(m); pz = new Float32Array(m); pr = new Float32Array(m);
      }
      if (sel.length < n) sel = new Float32Array(n * 2);
      pn = 0;
      const boost = part.scaleBoost;
      ft = t; fBoost = boost; fSea = inputs.seaLevel; fSeaThere = (inputs.stats.seaCover ?? 1) > 0.005;
      fHeight = inputs.terrain.height; fPosed = 0; fSwim = 0; fGravity = inputs.stats.gravity ?? 1; fDt = dt;
      // the terrain changed enough to move the ground (formation rise, landform growth): resample every cached ground
      let form = 0;
      for (const k in inputs.terrain.progress) form += inputs.terrain.progress[k];
      if (!(Math.abs(inputs.terrain.rise - sigRise) < 0.002 && Math.abs(form - sigForm) < 0.005)) {
        terrainStamp++; sigRise = inputs.terrain.rise; sigForm = form;
      }
      counts.fill(0);
      for (const l of LOFTS) l.n = 0;
      for (const b of parts) b.n = 0;

      // Live creatures: advance their pose, then rank them by camera distance for the LOD tiers.
      let nLive = 0;
      const R2 = ANIM_RADIUS * ANIM_RADIUS;
      // In view first: the loft, swimmer and pose slots go to creatures whose (generous) bounding sphere touches the
      // camera's side planes; the rest rank after every one in view (R2 + d²), so slots never go behind the camera
      // while one in front wants them. Side planes only (they hold for either depth convention), apex at the camera.
      const cam = app.camera;
      projView.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projView, cam.coordinateSystem);
      for (let i = 0; i < n; i++) {
        const o = i * ORGANISM_STRIDE;
        if (buf[o + OrganismField.role] < 0.5) continue; // producers are drawn by flora.ts
        hadLife = true;
        const id = buf[o + OrganismField.id];
        let e = entries.get(id);
        if (!e) { e = entryFor(id, buf, o); entries.set(id, e); }
        e.lastSeen = frame; e.stamp = snapId; e.dieT = -1;
        if (!e.seen) { e.seen = true; e.born = t; e.soc = buf[o + geneField('sociality')] || 0.2; }
        const mode = buf[o + OrganismField.mode];
        e.mode = mode;
        const altNow = buf[o + OrganismField.altitude];
        e.alt = e.alt === undefined ? altNow : e.alt + (altNow - e.alt) * 0.1;
        const gNow = growthLength(buf[o + OrganismField.grown]);
        e.g = e.born === t ? gNow : e.g + (gNow - e.g) * 0.1;
        if (mode === LOCOMOTION.swim && e.sw) {
          // stroke rate from the sim's speed: a cycle carries the body slip·λ·L (wave) or one stroke (row, jet)
          const k = e.sw.kin, r = drawnLength(e.scale, e.g) / drawnLength(e.scale, 1);
          const perCycle = (k.kind === 'wave' ? k.slip * k.lambda * e.sw.L : k.stroke) * r * boost;
          const [lo, hi] = SWIM_F[k.kind];
          e.swPhase += Math.min(hi, Math.max(lo, e.speed / Math.max(1e-3, perCycle))) * dt;
        }
        if (snapshot) {
          const tx = patchToWorld(buf[o + OrganismField.x], patch), tz = patchToWorld(buf[o + OrganismField.y], patch);
          const th = buf[o + OrganismField.heading];
          if (!e.init) {
            e.init = true; e.px = e.cx = e.x = tx; e.pz = e.cz = e.z = tz; e.ph = e.ch = e.h = th;
          } else {
            // Continue from where the creature is drawn now, so a new snapshot never pops.
            const sp = len2(tx - e.cx, tz - e.cz) / dtSnap;
            e.speed += (sp - e.speed) * 0.5;
            e.px = e.x; e.pz = e.z; e.ph = e.h;
            e.cx = tx; e.cz = tz; e.ch = th;
          }
          e.snapT = t; e.dtSnap = dtSnap;
        }
        P0.x = e.px; P0.z = e.pz; P0.h = e.ph; P1.x = e.cx; P1.z = e.cz; P1.h = e.ch;
        const pose = interpPose(P0, P1, (t - e.snapT) / e.dtSnap);
        const ox = e.x, oz = e.z, oh = e.h, Lw = boost * drawnLength(e.scale, e.g);
        e.x = pose.x; e.z = pose.z;
        // The sim can turn ±1.2 rad in one 50 ms tick: the drawn body turns at most turnRateMax(L), so it never spins
        // and its planted feet never skate.
        e.h = slewAngle(oh, pose.h, turnRateMax(Lw) * dt);
        const dh = Math.atan2(Math.sin(e.h - oh), Math.cos(e.h - oh));
        if (dt > 0) e.turn += (dh / dt - e.turn) * Math.min(1, dt / 0.2);
        // Gait from the distance the body is drawn moving (plus the sweep of a turn), so the feet stay planted.
        const lay = e.layout, rig = lay.radial ? (e.legged ? lay.radial.arms[0] : undefined) : lay.limbs[0];
        if (rig) {
          const s0 = boost * drawnFactor(e.scale, e.g);
          const dist = Math.hypot(e.x - ox, e.z - oz) + 0.5 * Lw * Math.abs(dh);
          e.hW = gaitStep(e, dist, e.speed, Lw, rig.hip.y * s0, (rig.len1 + rig.len2) * s0, dt, fGravity);
        }
        const ddx = camPos.x - e.x, ddz = camPos.z - e.z, d2 = ddx * ddx + ddz * ddz;
        if (d2 < R2) {
          const sv = boost * drawnFactor(e.scale, e.g);
          const back = inView(e.x, e.yDrawn + lay.centreY * sv, e.z, lay.radius * sv * 1.3 + VIEW_PAD) ? 0 : R2;
          e.rank = back + d2 * (e.tier === 2 ? LOFT_STICK : 1);
          e.swRank = back + d2 * (e.swOn ? LOFT_STICK : 1);
        } else { e.rank = Infinity; e.swRank = Infinity; }
        liveE[nLive++] = e;
      }
      // The two cuts: the LOFT_MAX nearest planned creatures get the loft, the ANIM_MAX nearest are posed.
      let nc = 0;
      for (let i = 0; i < nLive; i++) if (liveE[i].plan && liveE[i].rank < Infinity) sel[nc++] = liveE[i].rank;
      const loftCut = nc <= LOFT_MAX ? Infinity : kth(sel, nc, LOFT_MAX - 1);
      // Of those, the SWIM_MAX nearest swimmers pose as real swimmers, sticky like the loft (not buffer order: births
      // and deaths reorder it, and the fish in front of the camera must not be the finless one).
      nc = 0;
      for (let i = 0; i < nLive; i++) {
        const e = liveE[i];
        if (e.plan && e.mode === LOCOMOTION.swim && e.rank < Infinity && e.rank <= loftCut) sel[nc++] = e.swRank;
      }
      fSwimCut = nc <= SWIM_MAX ? Infinity : kth(sel, nc, SWIM_MAX - 1);
      nc = 0;
      for (let i = 0; i < nLive; i++) if (liveE[i].rank < Infinity) sel[nc++] = liveE[i].rank;
      const animCut = nc <= ANIM_MAX ? Infinity : kth(sel, nc, ANIM_MAX - 1);
      let lofted = 0;
      for (let i = 0; i < nLive; i++) {
        const e = liveE[i], r = e.rank;
        const tier = r === Infinity ? 0
          : e.plan && r <= loftCut && lofted < LOFT_MAX ? 2
          : r <= animCut && fPosed < ANIM_MAX ? 1 : 0;
        if (tier === 2) lofted++;
        draw(e, fadeScale(t - e.born, FADE_SEC), e.mode, true, tier);
      }

      // Deaths: anything seen before that is missing from the newest snapshot fades out where it stood, at the tier it was
      // last drawn (while there are slots), so a death near the player never pops to a proxy or its rest pose.
      if (snapshot) {
        for (const e of entries.values()) {
          if (e.seen && e.stamp !== snapId && e.dieT < 0) { e.dieT = t; dying.push(e); }
        }
        for (const [id, p] of pending) if (snapId - p.snap > PENDING_SNAPS) pending.delete(id);
      }
      for (let i = dying.length - 1; i >= 0; i--) {
        const e = dying[i];
        if (e.dieT < 0) { dying.splice(i, 1); continue; } // came back (should not happen: ids are never reused)
        const a = 1 - fadeScale(t - e.dieT, FADE_SEC);
        if (a <= 0) { dying.splice(i, 1); forget(e); continue; }
        draw(e, a, e.mode, false, e.tier);
      }

      const warm = !hadLife;
      for (let m = 0; m < MESHES.length; m++) {
        const k = counts[m];
        MESHES[m].count = k;
        MESHES[m].visible = k > 0 || warm;
        if (k > 0) {
          upload(MESHES[m].instanceMatrix, k * 16);
          upload(MESHES[m].instanceColor as THREE.InstancedBufferAttribute, k * 3);
          upload(MESHES[m].geometry.getAttribute('aGlow') as THREE.InstancedBufferAttribute, k);
        }
      }
      for (const l of LOFTS) l.flush(warm);
      for (const b of parts) b.flush(warm);
      part.count = pn;
    },
    hit(origin, dir) {
      // Broad phase: the loose bounding sphere (either side, so a camera inside one still tests the body).
      // Narrow phase: the creature's drawn parts (beads, and sample points along rods), at rest pose, a little padded.
      let best: { id: number; dist: number } | null = null;
      const c = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < pn; i++) {
        if (raySphere(origin, dir, { x: px[i], y: py[i], z: pz[i] }, pr[i]) <= 0) continue;
        const e = pe[i], s = pS[i], y0 = pY0[i];
        const cosH = Math.cos(e.h), sinH = Math.sin(e.h);
        let t = -1;
        const test = (lx: number, ly: number, lz: number, r: number) => {
          c.x = e.x + (lx * s) * cosH - (lz * s) * sinH; c.y = y0 + ly * s; c.z = e.z + (lx * s) * sinH + (lz * s) * cosH;
          const d = raySphereEntry(origin, dir, c, r * s * 1.2 + 0.05);
          if (d > 0 && (t < 0 || d < t)) t = d;
        };
        // body beads where the walking pose puts them (bend and slope pitch, as animate()); the rest at rest pose
        const walk = e.mode === LOCOMOTION.walk && !e.layout.radial, nBody = e.layout.nBody;
        const kap = walk ? turnKap(e, s) : 0, kp = walk ? Math.tan(e.pitch) : 0, xc = e.xmin + 0.5 * e.xspan;
        e.layout.beads.forEach((b, j) => {
          const bend = walk && j < nBody;
          test(b.x, b.y + (bend ? kp * (b.x - xc) : 0), b.z + (bend ? walkBendZ(e, b.x, kap) : 0), b.r * Math.max(b.sx ?? 1, b.sz ?? 1, b.sy ?? 1) * 0.8);
        });
        if (e.layout.radial && e.mode === LOCOMOTION.swim) {
          // a radial swimmer lies along its travel axis (laidRest), as it is drawn
          const L = laidRest(e).rods;
          for (let q = 0; q < e.layout.radial.rods.length; q++) {
            const o = q * ROD_STRIDE;
            for (const f of [0, 0.33, 0.67, 1]) test(L[o] + (L[o + 3] - L[o]) * f, L[o + 1] + (L[o + 4] - L[o + 1]) * f, L[o + 2] + (L[o + 5] - L[o + 2]) * f, L[o + 6]);
          }
        } else for (const r of e.layout.radial?.rods ?? e.layout.limbRods ?? []) {
          for (const f of [0, 0.33, 0.67, 1]) test(r.ax + (r.bx - r.ax) * f, r.ay + (r.by - r.ay) * f, r.az + (r.bz - r.az) * f, r.r);
        }
        if (e.bell && e.bellS) test(e.bellS.x, e.bellS.y, e.bellS.z, e.bellS.r * 0.85); // a carbon floater's gas bell
        if (t > 0 && (!best || t < best.dist)) best = { id: pid[i], dist: t };
      }
      return best;
    },
    layoutOf(id) {
      // diet, hue and accent are the species colourway (what creatureColour needs to draw it as it looks in the world)
      const e = entries.get(id);
      return e && e.planned ? { layout: e.layout, silicon: e.silicon, diet: e.diet, hue: e.hue, accent: e.accent, hard: e.hard, skin: e.skin, bake: () => bakeNear(e) } : null;
    },
    bakePlan(raw) {
      if (planBakes.has(raw)) return planBakes.get(raw) ?? null;
      let out: BakedCreature | null = null, fromBook = false;
      try {
        // a stand-alone entry (never added to `entries`): the species look's colours and proportions, adult, at rest
        const look = faunaLook(raw), drawn = look.plan;
        fromBook = drawn !== raw; // faunaLook hands back the raw plan itself when the world hasn't drawn this one
        const lk: SpeciesLook = { hue: look.hue, accent: look.accent, diet: look.diet, bands: drawn.bands, spots: drawn.spots, hard: look.hard, skin: look.skin };
        const e = makeEntry(beadLayout(drawn), drawn, drawn.chemistry === 'silicon', drawn.glow, drawn.scale, -1, lk, true);
        e.mode = drawn.mode; e.legged = drawn.legPairs > 0;
        out = bakeNear(e);
      } catch { out = null; }
      // cache only a bake in the species look: one in the plan's own fallback colours is redone on the next open, so
      // the view picks up the species colourway once the world has drawn the kind
      if (fromBook) planBakes.set(raw, out);
      return out;
    },
    locate(id) {
      for (let i = 0; i < pn; i++) if (pid[i] === id) return { x: px[i], y: py[i], z: pz[i], radius: pr[i] };
      return null;
    },
    dispose() {
      const all = [...MESHES, ...LOFTS.map((l) => l.mesh), ...parts.map((p) => p.mesh)];
      app.scene.remove(...all);
      for (const m of all) m.geometry.dispose();
      for (const m of MESHES) m.dispose();
      for (const p of parts) p.mesh.dispose();
      for (const m of MATS) m.dispose();
      entries.clear(); pending.clear();
    },
  };
  return part;
}
