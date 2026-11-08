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
import { crystalGround, prismTitan, shardTree } from './species/crystal';

export type { FloraKey } from './mesh';
export type FloraRole = 'ground' | 'mid' | 'giant';
export type FloraPalette = Record<FloraKey, number>;

type Gen = (rng: Rng, variant: number) => BuiltPlant;

interface SpeciesDef { id: string; chem: 'carbon' | 'silicon'; role: FloraRole; gen: Gen; variants: number[] }
const SPECIES: SpeciesDef[] = [
  { id: 'groundCover', chem: 'carbon', role: 'ground', gen: groundCover, variants: [0, 1, 2, 3] },
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
  SPECIES.forEach((sp, si) => {
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
