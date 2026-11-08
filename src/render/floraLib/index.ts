// Flora archetype library: the Red World generator (mockups/red-world/src/flora, copied and adapted) plus new silicon
// and jellyshroom species, built ONCE at startup into merged geometries (two LODs each) and instanced by flora.ts.
// Pure: the seed picks only variant and jitter; geometry shape never depends on the sim. Colour comes from the active
// palette at paint() time; glow = glow site × form.glow (darkness), never a fixed cyan term.
//
// FloraForm → archetype mapping (CLAUDE.md "Logic → art interface"; FloraForm from floraForm.ts, bin from floraBin):
//
//   chemistry  form.species (bin)          ground (0.3–2 m, dense)        mid (5–15 m, groves)                 giant (20–40 m, sparse)
//   ─────────  ─────────────────────────   ────────────────────────────   ──────────────────────────────────   ─────────────────────────────────────
//   carbon     tuft    (mat-dominant)      groundCover 0–3                —                                    —
//   carbon     dome    (mat, dark water)   jellyDome 0–1, groundCover 1   —                                    —
//   carbon     capped  (mixed/canopy,      groundCover 0–2                weeper 0,1,3 · ribFan fan/whorl/     parasolTitan 0–3 (wide caps) ·
//                       bright light)                                     sheaf                                coilSpire 0,2           [canopy only]
//   carbon     cup     (mixed/canopy,      groundCover 0–1 · jellyDome    lanternPods 0 · ribFan crinoid ·     lanternPods 3 chandelier, 1 onion ·
//                       dim/dark light)                                   weeper 3                             coilSpire 0,3           [canopy only]
//   silicon    crust   (mat-dominant)      crystalGround 0–3              —                                    —
//   silicon    spire   (mixed: 2 branches; crystalGround 0–3              shardTree 0,2,3 (bright) /           bright: prismTitan 0 plates, 3 pagoda
//                       canopy: 4)                                        1,2,3 (dim: glowing pods)            dim: prismTitan 1 lanterns, 2 candelabra
//
//   Which rows a cell uses (place.ts): its MAT pool draws the ground column of its own form (tuft / dome / crust, or
//   the ground column of capped / cup / spire); its CANOPY pool draws the mid and giant columns of the tall form for
//   the same light and heat (formForBin with the mix raised), sized and counted by canopy biomass. A canopy-dominant
//   bin makes a giant likelier. (On the demo seeds ~90% of land cells are mat-dominant, so gating tall plants on the
//   share bin alone would leave no giants at all.)
//
//   Silicon archetypes are straight hex prisms with 60° branches and flat (faceted) normals, never curled (no coil,
//   weeper, crinoid or bezier stems). Curl appears only on carbon. Bright light → wide caps (parasol titans, hex
//   plates); dim → lantern pods whose glow sites light up with form.glow. Height: heatBand via form.heightScale picks
//   where in its band a full-grown plant sits (cold → top of band); biomass scales it up from ~30% as it grows.
import { Color, type BufferGeometry } from 'three/webgpu';
import type { FloraForm } from '../floraForm';
import { FLORA_KEYS, setDetail, type BuiltPlant, type FloraKey } from './mesh';
import { makeRng, subSeed, type Rng } from './rng';
import { parasolTitan } from './species/parasol';
import { coilSpire } from './species/coil';
import { lanternPods } from './species/lantern';
import { weeper } from './species/weeper';
import { ribFan } from './species/ribfan';
import { groundCover } from './species/ground';
import { jellyDome } from './species/dome';
import { airKelpFloat, crystalGround, frostFern, prismTitan, shardTree, whiskerReef } from './species/crystal';
import { stiltMangrove } from './species/stilt';
import { woollyRosette } from './species/rosette';
import { bladderKelp } from './species/kelp';
import { pitcherUrn } from './species/pitcher';

export type { FloraKey } from './mesh';
export type FloraRole = 'ground' | 'mid' | 'giant';
export type FloraPalette = Record<FloraKey, number>;

type Gen = (rng: Rng, variant: number) => BuiltPlant;

/** `seedAs`: draw the jitter of that species, so a T9 dense build is the same plant with denser ribs. */
interface SpeciesDef { id: string; chem: 'carbon' | 'silicon'; role: FloraRole; gen: Gen; variants: number[]; seedAs?: string }
const SPECIES: SpeciesDef[] = [
  { id: 'groundCover', chem: 'carbon', role: 'ground', gen: groundCover, variants: [0, 1, 2, 3, 4] }, // 4: gated (cushion)
  { id: 'jellyDome', chem: 'carbon', role: 'ground', gen: jellyDome, variants: [0, 1] },
  { id: 'weeper', chem: 'carbon', role: 'mid', gen: weeper, variants: [0, 1, 3] },
  { id: 'ribFan', chem: 'carbon', role: 'mid', gen: ribFan, variants: [0, 1, 2, 3] },
  { id: 'lanternPods', chem: 'carbon', role: 'mid', gen: lanternPods, variants: [0] },
  { id: 'lanternGiant', chem: 'carbon', role: 'giant', gen: lanternPods, variants: [1, 3] },
  { id: 'parasolTitan', chem: 'carbon', role: 'giant', gen: parasolTitan, variants: [0, 1, 2, 3] },
  { id: 'coilSpire', chem: 'carbon', role: 'giant', gen: coilSpire, variants: [0, 2, 3] },
  { id: 'crystalGround', chem: 'silicon', role: 'ground', gen: crystalGround, variants: [0, 1, 2, 3] },
  { id: 'shardTree', chem: 'silicon', role: 'mid', gen: shardTree, variants: [0, 1, 2, 3] },
  { id: 'prismTitan', chem: 'silicon', role: 'giant', gen: prismTitan, variants: [0, 1, 2, 3] },
  // New species go last, so every existing archetype keeps its seed (subSeed by species index) and shape.
  // T9 (flora-traits): high-photorespiration builds, a hard switch at P = DENSE_P (gates.ts worldEnv)
  { id: 'parasolTitanDense', chem: 'carbon', role: 'giant', gen: (r, v) => parasolTitan(r, v, true), variants: [0, 1, 2, 3], seedAs: 'parasolTitan' },
  { id: 'ribFanDense', chem: 'carbon', role: 'mid', gen: (r, v) => ribFan(r, v, true), variants: [0, 1, 2, 3], seedAs: 'ribFan' },
  // gated archetypes (flora-traits §2, gates.ts): drawn only where a gate substitutes them into a pick list
  { id: 'pitcherUrn', chem: 'carbon', role: 'mid', gen: pitcherUrn, variants: [0] },
  { id: 'bladderKelp', chem: 'carbon', role: 'mid', gen: bladderKelp, variants: [0] },
  { id: 'whiskerReef', chem: 'silicon', role: 'mid', gen: whiskerReef, variants: [0] },
  { id: 'frostFern', chem: 'silicon', role: 'ground', gen: frostFern, variants: [0] },
  { id: 'woollyRosette', chem: 'carbon', role: 'giant', gen: woollyRosette, variants: [0] },
  { id: 'stiltMangrove', chem: 'carbon', role: 'mid', gen: stiltMangrove, variants: [0] },
  { id: 'airKelpFloat', chem: 'silicon', role: 'giant', gen: airKelpFloat, variants: [0] },
];

/** Every archetype key, in library index order (available without building geometry). */
export const ARCHETYPE_KEYS: readonly string[] = SPECIES.flatMap((sp) => sp.variants.map((v) => `${sp.id}#${v}`));
/** Archetype key → library index. */
export const ARCHETYPE_INDEX: ReadonlyMap<string, number> = new Map(ARCHETYPE_KEYS.map((key, i) => [key, i]));
/** Ring-segment scale of the far LOD. */
export const FAR_DETAIL = 0.35;
/** Far-LOD detail by chemistry: silicon facets are already cheap and must stay hexagonal, so its far LOD is the near one. */
const farDetailOf = (chem: 'carbon' | 'silicon') => (chem === 'silicon' ? 1 : FAR_DETAIL);

/** Chemistry and role of each archetype, by index. `farLod`: its far LOD is lighter than its near one. */
export const ARCHETYPE_META: readonly { chem: 'carbon' | 'silicon'; role: FloraRole; species: string; farLod: boolean }[] =
  SPECIES.flatMap((sp) => sp.variants.map(() => ({ chem: sp.chem, role: sp.role, species: sp.id, farLod: farDetailOf(sp.chem) < 1 })));

export interface Archetype {
  /** Stable index into FloraLibrary.archetypes. */
  index: number;
  /** e.g. 'parasolTitan#2'. */
  key: string;
  species: string;
  variant: number;
  chem: 'carbon' | 'silicon';
  role: FloraRole;
  /** Native height (m) of the near LOD. */
  height: number;
  /** Native size (m): max(height, 0.9 × radius). Instances scale by target size / this, so flat crusts don't balloon. */
  size: number;
  radius: number;
  /** Native contact radius of the near LOD (sloping ground: tilt or sink by slope × foot × scale). */
  foot: number;
  lod: [BuiltPlant, BuiltPlant];
}

export interface FloraLibrary {
  archetypes: Archetype[];
  byKey: Map<string, Archetype>;
}

/** Build every archetype (both LODs). Deterministic for a seed. ~100–300 ms; call once at startup. */
export function buildFloraLibrary(seed: number): FloraLibrary {
  const archetypes: Archetype[] = [];
  SPECIES.forEach((sp, i) => {
    const si = sp.seedAs ? SPECIES.findIndex((o) => o.id === sp.seedAs) : i;
    for (const v of sp.variants) {
      const lods: BuiltPlant[] = [];
      for (const detail of [1, farDetailOf(sp.chem)]) {
        setDetail(detail);
        lods.push(sp.gen(makeRng(subSeed(seed, si, v)), v));
      }
      setDetail(1);
      archetypes.push({
        index: archetypes.length, key: `${sp.id}#${v}`, species: sp.id, variant: v, chem: sp.chem, role: sp.role,
        height: lods[0].height, radius: lods[0].radius, foot: lods[0].foot, size: Math.max(lods[0].height, 0.9 * lods[0].radius), lod: [lods[0], lods[1]],
      });
    }
  });
  return { archetypes, byKey: new Map(archetypes.map((a) => [a.key, a])) };
}

/** The seed of the world's flora library: the world (flora.ts) and the producer card draw the same archetypes. */
export const LIB_SEED = 0x5eed_f10a;
const libraries = new Map<number, FloraLibrary>();
/**
 * The flora library for a seed, built on the first call (~100–300 ms) and shared after. Read-only: callers draw its
 * geometry through their own geometries (copies of colour and glow, shared position, normal, sway and index) and
 * never paint, extend or dispose it.
 */
export function floraLibrary(seed = LIB_SEED): FloraLibrary {
  let lib = libraries.get(seed);
  if (!lib) {
    lib = buildFloraLibrary(seed);
    // The drawn geometry carries only what a material reads: three r187 counts every geometry attribute toward its
    // shared-build limit (Instance.js canReferenceInstanceData: attributes + instance buffers ≤ 8), and over it every
    // instanced mesh gets its own build, compiled on first draw. The part weights (rim, cap) stay as source data in
    // `part` until a material packs them into an existing slot.
    for (const a of lib.archetypes) for (const l of a.lod) {
      const at = l.geometry.getAttribute('aPart');
      if (!at) continue;
      l.part = at.array as Float32Array;
      l.geometry.deleteAttribute('aPart');
    }
    libraries.set(seed, lib);
  }
  return lib;
}

// ---- mapping -----------------------------------------------------------------------------------------------------

const k = (species: string, ...vs: number[]) => vs.map((v) => `${species}#${v}`);
// list repeats weight the pick: spike crowns (groundCover#3) stay sparse silhouettes, as in the reference
const C_GROUND = k('groundCover', 0, 0, 1, 2, 2);
const MAP: Record<string, Partial<Record<FloraRole, string[]>>> = {
  'carbon:tuft': { ground: k('groundCover', 0, 0, 1, 2, 2, 0, 3) },
  'carbon:dome': { ground: [...k('jellyDome', 0, 1), ...k('groundCover', 1)] },
  'carbon:capped': { ground: C_GROUND, mid: [...k('weeper', 0, 0, 1, 3), ...k('ribFan', 0, 1, 1, 2)], giant: [...k('parasolTitan', 0, 1, 2, 3), ...k('coilSpire', 0, 2)] },
  'carbon:cup': { ground: [...k('groundCover', 0, 1), ...k('jellyDome', 0, 1)], mid: [...k('lanternPods', 0), ...k('ribFan', 3), ...k('weeper', 3)], giant: [...k('lanternGiant', 3, 1), ...k('coilSpire', 0, 3)] },
  'silicon:crust': { ground: k('crystalGround', 0, 1, 2, 3) },
  // submerged silicon crust sits low (FloraForm: "glows and sits low"): tile crusts and geode cups, no druse or needles
  'silicon:crust:sub': { ground: k('crystalGround', 1, 3, 1) },
  // submerged carbon mats under a dark sea are jellyshroom domes (species 'dome'); lit shallows keep low polyps and urchins
  'carbon:tuft:sub': { ground: k('groundCover', 0, 1, 1) },
  'silicon:spire:bright': { ground: k('crystalGround', 0, 1, 2, 3), mid: k('shardTree', 0, 3, 0, 2, 3), giant: k('prismTitan', 0, 3) },
  'silicon:spire:dim': { ground: k('crystalGround', 0, 1, 2, 3), mid: k('shardTree', 1, 3, 1, 2, 3), giant: k('prismTitan', 1, 2) },
};

/**
 * Archetype keys a form may draw in a role (empty: the role is absent for this form). `bright` = light bin 2.
 * Extending: a new FloraForm species is a new MAP row; a new per-cell axis is a suffixed row (`…:sub` today) that falls
 * back to the plain row. FloraForm.lush (biomass magnitude) scales density and size in place.ts, not the archetype.
 */
export function archetypesFor(form: FloraForm, role: FloraRole, bright: boolean): readonly string[] {
  const id = form.chemistry === 'silicon' && form.species === 'spire' ? `silicon:spire:${bright ? 'bright' : 'dim'}` : `${form.chemistry}:${form.species}`;
  // per-cell axes (FloraForm.submerged, optional until flora-tune lands everywhere) pick a suffixed row when one exists
  const sub = (form as { submerged?: boolean }).submerged ? MAP[`${id}:sub`]?.[role] : undefined;
  return sub ?? MAP[id]?.[role] ?? [];
}

/** Pick one archetype key for a form and role from a uniform 0..1 hash (null when the role is absent). */
export function pickArchetype(form: FloraForm, role: FloraRole, bright: boolean, r: number): string | null {
  const list = archetypesFor(form, role, bright);
  return list.length ? list[Math.min(list.length - 1, Math.floor(r * list.length))] : null;
}

// ---- C2: body variants along the climate (flora-traits §0.5, §9.2) ------------------------------------------------

/** Each carbon mid and giant species' variants in cline order, cold → hot heatBand: an [art] climate cline with the
 * tallest native build at the cold end (the owner's cold → tall rule). */
const CLINE: Readonly<Record<string, readonly number[]>> = {
  weeper: [2, 0, 1, 3], ribFan: [2, 0, 1, 3], lanternPods: [3, 1, 0, 2], lanternGiant: [3, 1, 0, 2],
  parasolTitan: [3, 1, 0, 2], coilSpire: [2, 0, 1, 3],
};
/** Dither half-width, in variant steps: under 0.5, so one heatBand never spans three variants. */
export const ALONG_DITHER = 0.45;
/** Base key → its T9 dense build. */
const DENSE: ReadonlyMap<string, string> = new Map(
  SPECIES.filter((sp) => sp.seedAs).flatMap((sp) => sp.variants.map((v) => [`${sp.seedAs}#${v}`, `${sp.id}#${v}`] as const)));
/** Per pick list: each entry → its species' entries in that list, distinct, in cline order (no allocation per plant). */
const alongMemo = new WeakMap<readonly string[], Map<string, readonly string[]>>();
function alongOf(list: readonly string[], key: string): readonly string[] {
  let m = alongMemo.get(list);
  if (!m) {
    m = new Map();
    for (const e of list) {
      if (m.has(e)) continue;
      const sp = e.split('#')[0], order = CLINE[sp];
      if (!order) { m.set(e, [e]); continue; }
      const same = [...new Set(list.filter((o) => o.split('#')[0] === sp))].sort((a, b) => order.indexOf(+a.split('#')[1]) - order.indexOf(+b.split('#')[1]));
      for (const o of same) m.set(o, same);
    }
    alongMemo.set(list, m);
  }
  return m.get(key)!;
}

/**
 * C2 pick from a list: the species is the list's pick at `r` (repeats weight it, as before); its body variant is the
 * one of that species' variants in the list nearest heatBand `t` along its cline, dithered per plant by ±ALONG_DITHER
 * of a step (`dither` 0..1), so the whole patch shows at most two adjacent variants of a species. Species without a
 * cline keep the list's own pick.
 */
export function pickAlong(list: readonly string[], r: number, t: number, dither: number): string | null {
  if (!list.length) return null;
  const key = list[Math.min(list.length - 1, Math.floor(r * list.length))];
  const vs = alongOf(list, key);
  if (vs.length < 2) return key;
  const at = Math.max(0, Math.min(1, t)) * (vs.length - 1) + (dither - 0.5) * 2 * ALONG_DITHER;
  return vs[Math.max(0, Math.min(vs.length - 1, Math.round(at)))];
}

/** A plant's archetype: the form's list pick, its C2 body variant on carbon mid and giant lists (heatBand `t`), and the
 * T9 dense build when `dense`. */
export function pickPlant(form: FloraForm, role: FloraRole, bright: boolean, r: number, t: number, dither: number, dense: boolean): string | null {
  const list = archetypesFor(form, role, bright);
  const key = form.chemistry === 'carbon' && role !== 'ground' ? pickAlong(list, r, t, dither) : list.length ? list[Math.min(list.length - 1, Math.floor(r * list.length))] : null;
  return key && dense ? DENSE.get(key) ?? key : key;
}

// ---- size --------------------------------------------------------------------------------------------------------

export const ROLE_BAND: Record<FloraRole, [number, number]> = { ground: [0.3, 2], mid: [5, 15], giant: [20, 40] };

/**
 * Target height (m). Full grown (biomass 1) it lies inside the role's band; heatBand (via form.heightScale, cold 1.4 →
 * hot 0.6) moves the band ceiling, and `jitter` (0..1, seeded) varies within it. Biomass grows it from ~30%.
 */
export function plantHeight(role: FloraRole, form: FloraForm, biomass: number, jitter: number): number {
  const [lo, hi] = ROLE_BAND[role];
  const cold = Math.max(0, Math.min(1, (form.heightScale - 0.6) / 0.8));
  const u = (0.25 + 0.75 * cold) * (0.7 + 0.3 * jitter);
  const full = lo + (hi - lo) * u;
  const grow = 0.3 + 0.7 * Math.sqrt(Math.max(0, Math.min(1, biomass)));
  return full * grow;
}

// ---- paint -------------------------------------------------------------------------------------------------------

/** One-step darker remap for foreground ground cover (value inversion kept: tops still lighter than bases). Maroon is
 * the floor: ink stays for feet and outlines only, so a dark plant reads as a dark form, never a black blob (maroon → ink
 * left polyps and tile crusts ~78% ink). */
const DARKER: Record<FloraKey, FloraKey> = { ink: 'ink', maroon: 'maroon', crimson: 'maroon', blush: 'crimson', bone: 'blush', glow: 'glow', glowDeep: 'glowDeep' };

const col = new Color();
function linear(pal: FloraPalette): Float32Array {
  const out = new Float32Array(FLORA_KEYS.length * 3);
  FLORA_KEYS.forEach((key, i) => { col.setHex(pal[key]); out[i * 3] = col.r; out[i * 3 + 1] = col.g; out[i * 3 + 2] = col.b; });
  return out;
}

/** The neutral per-plant tint: paintSites paints colours ÷ this, so a tint up to 1 ÷ it can lighten (the T8 pale coat)
 * and no drawn colour ever exceeds 1 (flora-traits.md §7). */
export const NEUTRAL_TINT = 0.9;

/**
 * Paint for glow per plant (flora.ts): colours as at glow 0, so glow sites show their tissue, and `aGlow` = each glow
 * site's weight, signed by its glow colour (+ glow, − glowDeep). The flora material (lookAttr) then lights a plant's
 * sites by its own glow, exactly as paint() would at that glow: site colour toward its glow colour by min(1, 1.5 g)
 * and emissive weight × g.
 */
export function paintSites(p: Pick<BuiltPlant, 'geometry' | 'keys' | 'glowKey' | 'site'>, pal: FloraPalette, dark = false): void {
  paint(p, pal, 0, dark);
  // headroom: colours ÷ NEUTRAL_TINT (≤ 1), drawn × the plant's tint (NEUTRAL_TINT when nothing shifts it)
  const c = (p.geometry as BufferGeometry).getAttribute('color').array as Float32Array;
  for (let i = 0; i < c.length; i++) c[i] = Math.min(1, c[i] / NEUTRAL_TINT);
  const a = (p.geometry as BufferGeometry).getAttribute('aGlow').array as Float32Array;
  const deep = FLORA_KEYS.indexOf('glowDeep');
  for (let i = 0; i < p.keys.length; i++) a[i] = p.glowKey[i] ? (p.glowKey[i] === deep ? -1 : 1) * p.site[i] : 0;
}

/**
 * Write the `color` (linear rgb) and `aGlow` attributes of a built plant from a palette and a glow amount (form.glow).
 * glow 0 → no emissive at all and glow sites show plain tissue. `dark` shifts every tissue one step darker.
 */
export function paint(p: Pick<BuiltPlant, 'geometry' | 'keys' | 'glowKey' | 'site'>, pal: FloraPalette, glow: number, dark = false): void {
  const L = linear(pal);
  const g = Math.max(0, Math.min(1, glow));
  const geo = p.geometry as BufferGeometry;
  const c = geo.getAttribute('color').array as Float32Array;
  const a = geo.getAttribute('aGlow').array as Float32Array;
  const n = p.keys.length;
  for (let i = 0; i < n; i++) {
    let ki = p.keys[i];
    if (dark) ki = FLORA_KEYS.indexOf(DARKER[FLORA_KEYS[ki]]);
    const gk = p.glowKey[i];
    const w = gk ? p.site[i] * g : 0;
    for (let ch = 0; ch < 3; ch++) c[i * 3 + ch] = L[ki * 3 + ch] + (gk ? (L[gk * 3 + ch] - L[ki * 3 + ch]) * Math.min(1, g * 1.5) * (p.site[i] > 0 ? 1 : 0) : 0);
    a[i] = w;
  }
  geo.getAttribute('color').needsUpdate = true;
  geo.getAttribute('aGlow').needsUpdate = true;
}
