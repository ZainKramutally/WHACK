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
  armRods, beadLayout, capsuleLayout, displayFactor, displayLength, limbJoints, raySphere, raySphereEntry, patchToWorld, type BeadLayout, type Vec3,
} from './layout';
import {
  armStance, bellPulse, fadeScale, gaitFoot, interpPose, limbPhaseOffset, rollAngle, swayOffset, swimWave,
} from './motion';
import { LOOK_PALETTES, creatureColour } from './palette';
import { MAX_BEADS_PER_ORGANISM, MAX_RODS_PER_ORGANISM, ROD_STRIDE, TONES } from './creatureLayout';
import { worldMaterial } from './material';
import {
  AX_RINGS, AX_SIDES, BELL_RINGS, BELL_SIDES, GLOW_MIN, PART, RAD_RINGS, RAD_SIDES, SLOT, SLOTS, TENDRILS, TENDRIL_LINKS, describe,
  type AxialDesc, type FaunaDesc, type PartDesc, type PartType, type RadialDesc,
} from './faunaLib/adapter';
import { RING_STRIDE, circleSection, gridIndex, ngonSection, setRing, writeRings, type Section } from './faunaLib/loft';
import { PartBatch, partBatches } from './faunaLib/parts';
import { SpeciesBook, rememberLook, type SpeciesLook } from './faunaLib/species';

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
const PART_CAPS: Partial<Record<PartType, number>> = { rodSi: 6144 }; // silicon arms (8 × up to 6 rods) + lattice tendrils
const RIM_SI = 0.45;              // silicon's pale fresnel rim on violet bodies (#50)
const RIM_BELL = 0.5;             // gas bells read translucent at grazing angles
const GENE0 = geneField('size');  // the 12 body genes, then comp c and si: the field guide's clustering space
const PENDING_SNAPS = 20;         // a birth plan waits this many snapshots for its organism to show up
const D15 = Math.PI / 12;
// Loft caps: positions along the end tangent (× cap length) and radius factors. Tail tip first; head base first.
const TAIL_F = [1.0, 0.82, 0.45], TAIL_K = [0.06, 0.6, 0.9];
const HEAD_F = [0.45, 0.8, 1.0], HEAD_K = [0.9, 0.62, 0.08];
// Gas bell egg profile: height from the rim (× bell height) and radius factor, closed underneath.
const BELL_Y = [0.06, 0.02, 0, 0.1, 0.24, 0.4, 0.56, 0.7, 0.82, 0.92, 0.98, 1.0];
const BELL_R = [0.04, 0.42, 0.66, 0.86, 0.98, 1.0, 0.96, 0.86, 0.7, 0.48, 0.24, 0.04];
const SPW = new Float32Array(64 * 5); // posed spine in world space, per frame per creature

interface Entry {
  layout: BeadLayout;
  /** The plan as drawn (after the species attractor), kept so the loft description is built only once it's needed. */
  plan: BodyPlan | null;
  desc: FaunaDesc | null;
  /** Species bin and its recycle stamp (SpeciesBook), −1 for capsules. */
  bin: number; binStamp: number;
  /** LOD: ranked camera distance this frame, and the tier it was last drawn at (2 loft, 1 posed proxy, 0 rest proxy). */
  rank: number; tier: number;
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
  /** Accumulated roll angle (radians) of a rolling radial body. */
  roll: number;
  // body extents for the motion maths
  xmin: number; xspan: number; ymax: number;
  // snapshot interpolation: previous rendered pose → newest target, over dtSnap seconds from snapT
  init: boolean;
  px: number; pz: number; ph: number;
  cx: number; cz: number; ch: number;
  snapT: number; dtSnap: number;
  /** Rendered pose this frame. */
  x: number; z: number; h: number;
  /** Smoothed ground speed in m/s and the accumulated gait cycles. */
  speed: number; gait: number;
  /** True when the layout comes from a real BodyPlan (not the capsule fallback). */
  planned: boolean;
  /** Radial bodies: arms are walking arms (the plan has leg pairs); otherwise they are short spikes. */
  legged: boolean;
  seen: boolean; stamp: number; born: number; dieT: number; mode: number; id: number; diet: number;
}

const tmpColour = new THREE.Color();
/** Proxy bead/rod tone → fauna slot, so proxies wear the loft's one body colour + one accent: body, eye, plate, limb, horn, accent, spot. */
const TONE_SLOT = [SLOT.body, SLOT.eye, SLOT.body, SLOT.body, SLOT.accent, SLOT.accent, SLOT.accent];
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
  const { hue, accent, diet } = look;
  const pal = LOOK_PALETTES[silicon ? 'silicon' : 'carbon'];
  const slotHex = [
    creatureColour(silicon, diet, 0, hue, accent), creatureColour(silicon, diet, 5, hue, accent),
    creatureColour(silicon, diet, 1, hue, accent), pal.bone, pal.glow,
  ];
  const slotRgb = new Float32Array(SLOTS * 3);
  slotHex.forEach((hex, i) => { tmpColour.setHex(hex); slotRgb[i * 3] = tmpColour.r; slotRgb[i * 3 + 1] = tmpColour.g; slotRgb[i * 3 + 2] = tmpColour.b; });
  const lit = glow > GLOW_MIN ? glow : 0;
  const slotGlow = new Float32Array(SLOTS);
  slotGlow[SLOT.glow] = lit;
  if (silicon) slotGlow[SLOT.eye] = lit; // silicon's cyan arm-tip eyes are its light organs; carbon's ink eyes never glow
  const rgb = new Float32Array(TONES * 3);
  for (let tone = 0; tone < TONES; tone++) {
    const sl = tone === 6 && lit > 0 ? SLOT.glow : TONE_SLOT[tone];
    rgb[tone * 3] = slotRgb[sl * 3]; rgb[tone * 3 + 1] = slotRgb[sl * 3 + 1]; rgb[tone * 3 + 2] = slotRgb[sl * 3 + 2];
  }
  return { flat, shape, flap, rgb, slotRgb, slotGlow, rods, rodTone, hue, accent, xmin, xspan: Math.max(1e-6, xmax - xmin), ymax };
}

export interface FaunaPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Nearest organism under a ray (world space, normalised direction), or null. */
  hit(origin: Vec3, dir: Vec3): { id: number; dist: number } | null;
  /** Cached bead layout, chemistry and diet of an organism by id (from its BodyPlan), if known. */
  layoutOf(id: number): { layout: BeadLayout; silicon: boolean; diet: number; hue: number; accent: number } | null;
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
  constructor(readonly rings: number, readonly sides: number, readonly slots: number, mat: THREE.Material) {
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
  const MATS = [matC, proxySi, partSi, loftC, loftSi, loftBell];

  // Far and mid proxies: carbon beads and limb bones; silicon faceted beads, hub prisms per symmetry, hex prisms.
  const round = makeMesh(new THREE.SphereGeometry(1, 8, 6), matC);
  const faceted = makeMesh(new THREE.IcosahedronGeometry(1, 0), proxySi);
  const hubs = HUB_SIDES.map((n) => makeRodMesh(n, HUB_CAP, proxySi));
  const hex = makeRodMesh(6, HEX_CAP, proxySi);
  const bones = makeRodMesh(8, BONE_CAP, matC, 0.72);
  const MESHES = [round, faceted, ...hubs, hex, bones];
  const GLOWS = MESHES.map((m) => withGlow(m, (m.instanceMatrix.array as Float32Array).length / 16));
  const BONES = MESHES.length - 1, HEX = BONES - 1; // indexes of the bone and hex-prism meshes in MESHES

  // Near: lofts (carbon bodies, carbon gas bells, silicon hubs) and the shared part batches.
  const axLoft = new LoftBatch(AX_RINGS, AX_SIDES, LOFT_MAX, loftC);
  const bellLoft = new LoftBatch(BELL_RINGS, BELL_SIDES, LOFT_MAX, loftBell);
  const hubLoft = new LoftBatch(RAD_RINGS, RAD_SIDES, LOFT_MAX, loftSi);
  const LOFTS = [axLoft, bellLoft, hubLoft];
  const parts: PartBatch[] = partBatches((t) => (t.endsWith('Si') ? partSi : matC), PART_CAPS, PART_CAP);
  app.scene.add(...MESHES, ...LOFTS.map((l) => l.mesh), ...parts.map((p) => p.mesh));

  const AX_SEC = circleSection(AX_SIDES), BELL_SEC = circleSection(BELL_SIDES);
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
      layout, plan, desc: null, bin: -1, binStamp: 0, rank: Infinity, tier: 0,
      lastSeen: frame, glow, silicon, scale, roll: 0, ...bake(layout, silicon, lk, glow),
      init: false, px: 0, pz: 0, ph: 0, cx: 0, cz: 0, ch: 0, snapT: 0, dtSnap: 0.05, x: 0, z: 0, h: 0,
      speed: 0, gait: 0, planned, legged: false, seen: false, stamp: 0, born: 0, dieT: -1, mode: 0, id, diet: lk.diet,
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
        rememberLook(p.plan, drawn, look); // so the bestiary sprite draws this animal as the world does
        const e = makeEntry(beadLayout(drawn), drawn, p.plan.chemistry === 'silicon', p.plan.glow, p.plan.scale, id, look, true);
        e.bin = bin; e.binStamp = book.stampOf(bin); e.legged = p.plan.legPairs > 0;
        return e;
      } catch { /* a plan the layout can't build: draw it as a capsule */ }
    }
    // No plan (born before the renderer was listening): a plain capsule in the species-neutral colourway.
    const size = buf[o + OrganismField.size] || 1;
    look.hue = 0.5; look.accent = 0.55; look.diet = buf[o + geneField('diet')]; look.bands = 0; look.spots = 0;
    return makeEntry(capsuleLayout(0.15 * size * 2), null, buf[o + OrganismField.compSi] > 0.5, 0, 0.3 * size, id, look);
  }

  function forget(e: Entry): void {
    book.release(e.bin, e.binStamp);
    entries.delete(e.id);
  }

  /** Fill `scratch` (stride 5) and the limb bones in rodScratch with this creature's animated pose; returns the bead count. */
  function animate(
    e: Entry, t: number, s: number, mode: number, heightAt: (x: number, z: number) => number,
    y0: number, cosH: number, sinH: number,
  ): number {
    const lay = e.layout, src = e.flat, nb = lay.beads.length, nBody = lay.nBody;
    const out = scratch;
    const moving = Math.min(1, e.speed / (0.12 * displayLength(e.scale))); // 0 idle … 1 at 0.12 body lengths per second
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
      }
      const fl = e.flap[i];
      if (fl > 0) y += Math.abs(z) * 0.55 * fl * Math.sin(2 * Math.PI * 1.3 * t + e.id) * (mode === LOCOMOTION.hover ? 1 : 0.5 + moving);
      out[f] = x; out[f + 1] = y; out[f + 2] = z; out[f + 3] = r; out[f + 4] = src[f + 4];
    }
    // Limbs.
    if (lay.limbs.length > 0) {
      const walking = mode === LOCOMOTION.walk;
      const amp = walking ? moving : 0;
      for (const rig of lay.limbs) {
        let fx = rig.hip.x, fy = rig.r, fz = rig.hip.z + rig.side * rig.restOut;
        if (walking) {
          const g = gaitFoot(e.gait + limbPhaseOffset(rig.pair, rig.side), lay.stride * amp, 0.35 * rig.len1 * amp);
          fx += g.dx;
          // Plant the foot on the terrain under its world position.
          const wx = e.x + (fx * cosH - fz * sinH) * s, wz = e.z + (fx * sinH + fz * cosH) * s;
          fy = rig.r + g.dy + (heightAt(wx, wz) - y0) / s;
        } else if (mode === LOCOMOTION.hover) {
          fy = rig.hip.y - 0.8 * (rig.len1 + rig.len2); fz = rig.hip.z + rig.side * 0.3 * rig.restOut; // legs hang
        }
        limbOut.length = 0;
        limbJoints(rig, fx, fy, fz, limbOut);
        const q = rig.first * 5;
        const kneeR = src[q + 3], footR = src[q + 8];
        out[q] = limbOut[0]; out[q + 1] = limbOut[1]; out[q + 2] = limbOut[2]; out[q + 3] = kneeR; out[q + 4] = 3;
        out[q + 5] = limbOut[3]; out[q + 6] = limbOut[4]; out[q + 7] = limbOut[5]; out[q + 8] = footR; out[q + 9] = 3;
        // The two bones follow: hip → knee, knee → foot. Limb k's beads start at nBody + 2k, its rods at 2k.
        const rk = (rig.first - nBody) * ROD_STRIDE;
        const R = e.rods;
        rodScratch[rk] = rig.hip.x; rodScratch[rk + 1] = rig.hip.y; rodScratch[rk + 2] = rig.hip.z;
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
    const moving = Math.min(1, e.speed / (0.12 * displayLength(e.scale)));
    const pulse = mode === LOCOMOTION.hover ? bellPulse(t, e.id) : 1;
    for (let i = 0; i < R.nHubRods * ROD_STRIDE; i++) out[i] = src[i];
    if (pulse !== 1) for (let i = 0; i < R.nTiers; i++) out[i * ROD_STRIDE + 6] *= pulse;
    const stance = mode === LOCOMOTION.hover ? 'bell' : mode === LOCOMOTION.sessile ? 'crystal' : 'spoke';
    for (const rig of R.arms) {
      let fx: number, fy: number, fz: number;
      if (mode === LOCOMOTION.walk && e.legged) {
        const g = gaitFoot(e.gait + rig.phase, lay.stride * moving, 0.35 * rig.len1 * moving);
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
    if (mode === LOCOMOTION.swim && e.roll !== 0) {
      // A rolling hub turns like a wheel about its lateral axis, top moving forward.
      const c = Math.cos(e.roll), sn = Math.sin(e.roll), py = R.pivotY;
      const rot = (a: Float32Array, i: number) => {
        const x = a[i], y = a[i + 1] - py;
        a[i] = x * c + y * sn; a[i + 1] = py - x * sn + y * c;
      };
      for (let r = 0; r < R.rods.length; r++) { rot(out, r * ROD_STRIDE); rot(out, r * ROD_STRIDE + 3); }
      for (let k = 0; k < lay.beads.length; k++) rot(eyes, k * 5);
    }
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
    if (axLoft.n >= LOFT_MAX) return false;
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
      if (d.mids && k < ns - 1) {
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
    writeRings(ringBuf, nr, AX_RINGS, AX_SEC, axLoft.pos, axLoft.nor, axLoft.col, axLoft.glow, axLoft.n * axLoft.per, e.slotRgb, e.slotGlow);
    axLoft.n++;

    // ---- static parts on the posed beads ------------------------------------------------------------------------
    for (const p of d.parts) emitDescPart(p, beads, rodScratch);

    // ---- legs: thigh, knee, shin, foot pad and claws (jointed) or a tapering tentacle --------------------------
    for (const L of d.legs) {
      const rk = L.rig * 2 * ROD_STRIDE;
      const r0 = rodScratch[rk + 6] * S;
      toW(rodScratch[rk], rodScratch[rk + 1], rodScratch[rk + 2]); const hx = W[0], hy = W[1], hz = W[2];
      toW(rodScratch[rk + 3], rodScratch[rk + 4], rodScratch[rk + 5]); const kx = W[0], ky = W[1], kz = W[2];
      toW(rodScratch[rk + 12], rodScratch[rk + 13], rodScratch[rk + 14]); const fx = W[0], fy = W[1], fz = W[2];
      if (L.jointed) {
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
    if (mode === LOCOMOTION.hover && bellLoft.n < LOFT_MAX) {
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
    const lag = 0.18 + Math.min(1, e.speed / Math.max(0.1, displayLength(e.scale) * 0.12)) * 0.5;
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
  function hubRing(rods: Float32Array, nr: number, i: number, f: number, k: number, Tx: number, Ty: number, Tz: number, slot: number): number {
    const o = i * ROD_STRIDE;
    toW(rods[o] + (rods[o + 3] - rods[o]) * f, rods[o + 1] + (rods[o + 4] - rods[o + 1]) * f, rods[o + 2] + (rods[o + 5] - rods[o + 2]) * f);
    const r = rods[o + 6] * S * k;
    setRing(ringBuf, nr, W[0], W[1], W[2], Tx, Ty, Tz, CH, 0, SH, r, r, slot);
    return nr + 1;
  }
  const slotOfRod = (e: Entry, i: number) => (e.rodTone[i] === 5 ? SLOT.accent : SLOT.body);

  function drawRadialNear(e: Entry, d: RadialDesc, t: number, mode: number): boolean {
    if (hubLoft.n >= LOFT_MAX) return false;
    const R = e.layout.radial!, rods = rodScratch, eyes = scratch;
    // ---- hub loft: stepped tiers up the (possibly rolled) hub axis, a rounded n-gon cross-section ---------------
    const o0 = 0, oT = (R.nTiers - 1) * ROD_STRIDE;
    toW(rods[o0], rods[o0 + 1], rods[o0 + 2]); const ax = W[0], ay = W[1], az = W[2];
    toW(rods[oT + 3], rods[oT + 4], rods[oT + 5]);
    let Tx = W[0] - ax, Ty = W[1] - ay, Tz = W[2] - az;
    const tl = len3(Tx, Ty, Tz) || 1; Tx /= tl; Ty /= tl; Tz /= tl;
    const h = (rods[4] - rods[1]) * S; // one tier's height
    let nr = 0;
    // underside: apex, shoulder
    toW(rods[o0], rods[o0 + 1], rods[o0 + 2]);
    const r0 = rods[6] * S;
    setRing(ringBuf, nr++, W[0] - Tx * h * 0.22, W[1] - Ty * h * 0.22, W[2] - Tz * h * 0.22, Tx, Ty, Tz, CH, 0, SH, r0 * 0.06, r0 * 0.06, slotOfRod(e, 0));
    setRing(ringBuf, nr++, W[0] - Tx * h * 0.12, W[1] - Ty * h * 0.12, W[2] - Tz * h * 0.12, Tx, Ty, Tz, CH, 0, SH, r0 * 0.55, r0 * 0.55, slotOfRod(e, 0));
    for (let i = 0; i < R.nTiers; i++) {
      nr = hubRing(rods, nr, i, 0, 0.8, Tx, Ty, Tz, slotOfRod(e, i));
      nr = hubRing(rods, nr, i, 0.2, 1, Tx, Ty, Tz, slotOfRod(e, i));
      nr = hubRing(rods, nr, i, 0.8, 1, Tx, Ty, Tz, slotOfRod(e, i));
      if (i === R.nTiers - 1) nr = hubRing(rods, nr, i, 1, 0.8, Tx, Ty, Tz, slotOfRod(e, i));
    }
    // crown: shoulder and apex
    toW(rods[oT + 3], rods[oT + 4], rods[oT + 5]);
    const rt = rods[oT + 6] * S;
    setRing(ringBuf, nr++, W[0] + Tx * h * 0.14, W[1] + Ty * h * 0.14, W[2] + Tz * h * 0.14, Tx, Ty, Tz, CH, 0, SH, rt * 0.5, rt * 0.5, slotOfRod(e, R.nTiers - 1));
    setRing(ringBuf, nr++, W[0] + Tx * h * 0.22, W[1] + Ty * h * 0.22, W[2] + Tz * h * 0.22, Tx, Ty, Tz, CH, 0, SH, rt * 0.06, rt * 0.06, slotOfRod(e, R.nTiers - 1));
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

  // Per-frame draw state, set at the top of update() (draw() and drawFar() live out here so a frame allocates no closures).
  let ft = 0, fBoost = 1, fSea = 0, fSeaThere = false, fPosed = 0;
  const P0 = { x: 0, z: 0, h: 0 }, P1 = { x: 0, z: 0, h: 0 }; // interpPose inputs, reused
  let fHeight: (x: number, z: number) => number = () => 0;

  /**
   * Draw one creature. tier 2: the full loft and parts (falls back to posed proxies if the batches are full);
   * 1: posed proxies; 0: proxies at rest pose.
   */
  function draw(e: Entry, alpha: number, mode: number, live: boolean, tier: number) {
    e.tier = 0;
    const ground = fHeight(e.x, e.z);
    const s = fBoost * displayFactor(e.scale) * alpha;
    if (s <= 0) return;
    let y0 = ground;
    if (mode === LOCOMOTION.hover) y0 = ground + displayLength(e.scale) * fBoost * (0.9 + 0.25 * Math.sin(ft * 1.3 + e.id)) * alpha;
    else if (mode === LOCOMOTION.swim && fSeaThere && ground < fSea) y0 = ground + (fSea - ground) * 0.35;

    const lay = e.layout;
    const cosH = Math.cos(e.h), sinH = Math.sin(e.h);
    if (live) {
      pid[pn] = e.id; px[pn] = e.x; py[pn] = y0 + lay.centreY * s; pz[pn] = e.z; pr[pn] = Math.max(lay.radius * s * 0.85, 0.3); // tight: 85% of the bead bounds, at least 30 cm
      pe[pn] = e; pS[pn] = s; pY0[pn] = y0;
      pn++;
    }
    if (tier === 0) { drawFar(e, s, y0, cosH, sinH, e.flat, e.rods); return; }
    fPosed++;
    e.tier = 1;
    const s0 = fBoost * displayFactor(e.scale);
    if (lay.radial) animateRadial(e, ft, s0, mode, fHeight, y0, cosH, sinH);
    else animate(e, ft, s0, mode, fHeight, y0, cosH, sinH);
    if (tier === 2) {
      if (!e.desc && e.plan) {
        try { e.desc = describe(e.plan, lay); } catch { e.plan = null; } // never retried: it stays a posed proxy
      }
      if (e.desc) {
        S = s; EX = e.x; EY = y0; EZ = e.z; CH = cosH; SH = sinH; ENT = e;
        const ok = e.desc.kind === 'radial' ? drawRadialNear(e, e.desc, ft, mode) : drawAxialNear(e, e.desc, ft, mode);
        if (ok) { e.tier = 2; return; }
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
      if (counts[BONES] + lr.length > BONE_CAP) return;
      for (let i = 0; i < lr.length; i++) emitRod(bones, GLOWS[BONES], counts[BONES]++, rods, i, s, e.x, y0, e.z, cosH, sinH, e.rgb, e.rodTone[i], 0);
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


  const part: FaunaPart = {
    scaleBoost: 1,
    count: 0,
    update(dt, t, inputs, patch) {
      frame++;
      // A new run (another world, or the build restarting) starts a new book: ids and species don't carry over.
      if (inputs.world.id !== lastWorld || inputs.buildProgress + 0.25 < lastBuild) {
        if (lastWorld !== '') { entries.clear(); dying.length = 0; pending.clear(); book.reset(); }
        lastWorld = inputs.world.id;
      }
      lastBuild = inputs.buildProgress;
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
      fHeight = inputs.terrain.height; fPosed = 0;
      counts.fill(0);
      for (const l of LOFTS) l.n = 0;
      for (const b of parts) b.n = 0;

      // Live creatures: advance their pose, then rank them by camera distance for the LOD tiers.
      let nLive = 0;
      const R2 = ANIM_RADIUS * ANIM_RADIUS;
      for (let i = 0; i < n; i++) {
        const o = i * ORGANISM_STRIDE;
        if (buf[o + OrganismField.role] < 0.5) continue; // producers are drawn by flora.ts
        hadLife = true;
        const id = buf[o + OrganismField.id];
        let e = entries.get(id);
        if (!e) { e = entryFor(id, buf, o); entries.set(id, e); }
        e.lastSeen = frame; e.stamp = snapId; e.dieT = -1;
        if (!e.seen) { e.seen = true; e.born = t; }
        const mode = buf[o + OrganismField.mode];
        e.mode = mode;
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
        e.x = pose.x; e.z = pose.z; e.h = pose.h;
        // Gait advances with distance: cadence follows speed relative to body length.
        const rel = e.speed / displayLength(e.scale);
        e.gait += dt * Math.min(3, 1.2 + 6 * rel);
        if (mode === LOCOMOTION.swim && e.layout.radial) {
          e.roll = (e.roll + rollAngle(e.speed * dt / (boost * displayFactor(e.scale)), e.layout.radial.rollRadius)) % (2 * Math.PI);
        }
        const ddx = camPos.x - e.x, ddz = camPos.z - e.z, d2 = ddx * ddx + ddz * ddz;
        e.rank = d2 < R2 ? d2 * (e.tier === 2 ? LOFT_STICK : 1) : Infinity;
        liveE[nLive++] = e;
      }
      // The two cuts: the LOFT_MAX nearest planned creatures get the loft, the ANIM_MAX nearest are posed.
      let nc = 0;
      for (let i = 0; i < nLive; i++) if (liveE[i].plan && liveE[i].rank < Infinity) sel[nc++] = liveE[i].rank;
      const loftCut = nc <= LOFT_MAX ? Infinity : kth(sel, nc, LOFT_MAX - 1);
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
        for (const b of e.layout.beads) test(b.x, b.y, b.z, b.r * Math.max(b.sx ?? 1, b.sz ?? 1, b.sy ?? 1) * 0.8);
        for (const r of e.layout.radial?.rods ?? e.layout.limbRods ?? []) {
          for (const f of [0, 0.33, 0.67, 1]) test(r.ax + (r.bx - r.ax) * f, r.ay + (r.by - r.ay) * f, r.az + (r.bz - r.az) * f, r.r);
        }
        if (t > 0 && (!best || t < best.dist)) best = { id: pid[i], dist: t };
      }
      return best;
    },
    layoutOf(id) {
      // diet, hue and accent are the species colourway (what creatureColour needs to draw it as it looks in the world)
      const e = entries.get(id);
      return e && e.planned ? { layout: e.layout, silicon: e.silicon, diet: e.diet, hue: e.hue, accent: e.accent } : null;
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
