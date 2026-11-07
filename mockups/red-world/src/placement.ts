// Seeded plant placement: hand-placed hero plants for composition + Poisson-disk scatter with density masks.
// Pure (no three.js). Output scale = target height / archetype height (heightOf).
import type { PlantInstance, SpeciesId } from './contracts';
import { mulberry32, fbm, smoothstep } from './rng';
import { riverDist, heightAt } from './field';
import { HERO, EXPLORER, HOLLOW, TITAN_FOREST, ARCH2 } from './layout';

export interface Rect { x0: number; x1: number; z0: number; z1: number }

/** Bridson Poisson-disk sampling in a rectangle; `accept` is a density mask in [0, 1] tested with the rng. */
export function poissonDisk(rng: () => number, rect: Rect, minDist: number, accept: (x: number, z: number) => number = () => 1, k = 20): [number, number][] {
  const cell = minDist / Math.SQRT2;
  const gw = Math.ceil((rect.x1 - rect.x0) / cell), gh = Math.ceil((rect.z1 - rect.z0) / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const pts: [number, number][] = [], active: number[] = [];
  const gi = (x: number, z: number) => Math.floor((z - rect.z0) / cell) * gw + Math.floor((x - rect.x0) / cell);
  const fits = (x: number, z: number) => {
    if (x < rect.x0 || x >= rect.x1 || z < rect.z0 || z >= rect.z1) return false;
    const cx = Math.floor((x - rect.x0) / cell), cz = Math.floor((z - rect.z0) / cell);
    for (let j = Math.max(0, cz - 2); j <= Math.min(gh - 1, cz + 2); j++)
      for (let i = Math.max(0, cx - 2); i <= Math.min(gw - 1, cx + 2); i++) {
        const p = grid[j * gw + i];
        if (p >= 0 && Math.hypot(pts[p][0] - x, pts[p][1] - z) < minDist) return false;
      }
    return true;
  };
  const push = (x: number, z: number) => { grid[gi(x, z)] = pts.length; active.push(pts.length); pts.push([x, z]); };
  push(rect.x0 + rng() * (rect.x1 - rect.x0), rect.z0 + rng() * (rect.z1 - rect.z0));
  while (active.length) {
    const ai = Math.floor(rng() * active.length), [px, pz] = pts[active[ai]];
    let found = false;
    for (let t = 0; t < k; t++) {
      const a = rng() * Math.PI * 2, r = minDist * (1 + rng());
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (fits(x, z)) { push(x, z); found = true; break; }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts.filter(([x, z]) => rng() < accept(x, z));
}

type Spec = { species: SpeciesId; rect: Rect; minDist: number; h: [number, number]; absScale?: boolean; mask: (x: number, z: number, d: number) => number; variants: number };

const angOf = (x: number, z: number) => Math.atan2(-x, -z);
const HERO_ANG = angOf(HERO.x, HERO.z), EXP_ANG = angOf(EXPLORER.x, EXPLORER.z);

/** Keep sight-lines to the hero and the explorer clear, stay inside a wide view wedge, stay off the riverbed. */
function clear(x: number, z: number, tall: boolean, pad: number, species?: SpeciesId): boolean {
  const a = angOf(x, z), d = Math.hypot(x, z);
  // no second titan silhouette near the middle of the hero frame
  if (species === 'parasolTitan' && Math.abs(a) < 0.3 && d < 1300) return false;
  if (Math.abs(a) > 0.95) return false;
  const rv = riverDist(x, z);
  if (rv.d < rv.w * 1.1 + pad) return false;
  if (tall && Math.abs(a - HERO_ANG) < 0.1 && d < 420) return false;
  if (tall && Math.abs(a - EXP_ANG) < 0.08 && d < 110) return false;
  if (Math.hypot(x - HERO.x, z - HERO.z) < 45) return false;
  return true;
}

const SPECS: Spec[] = [
  { species: 'groundCover', rect: { x0: -90, x1: 90, z0: -170, z1: 6 }, minDist: 2.1, h: [0.8, 1.7], absScale: true, variants: 3,
    mask: (x, z, d) => (1 - smoothstep(25, 170, d)) * (0.55 + 0.45 * smoothstep(-0.2, 0.3, fbm(x / 18, z / 18, 2, 5))) },
  { species: 'lanternPods', rect: { x0: -320, x1: 320, z0: -520, z1: -12 }, minDist: 45, h: [7, 18], variants: 3,
    mask: (x, z) => 0.6 * smoothstep(0.2, 0.45, fbm(x / 90, z / 90, 2, 8)) },
  { species: 'ribFan', rect: { x0: -420, x1: 420, z0: -720, z1: -30 }, minDist: 60, h: [12, 30], variants: 3,
    mask: (x, z) => 0.35 * smoothstep(0.1, 0.35, fbm(x / 140, z / 140, 2, 9)) },
  { species: 'weeper', rect: { x0: -600, x1: 600, z0: -900, z1: -70 }, minDist: 70, h: [22, 48], variants: 3,
    mask: (x, z) => 0.5 * smoothstep(0, 0.3, fbm(x / 200, z / 200, 2, 10)) },
  { species: 'coilSpire', rect: { x0: -1400, x1: 1400, z0: -2200, z1: -260 }, minDist: 80, h: [40, 115], variants: 3,
    mask: (x, z) => 0.9 * smoothstep(0.2, 0.34, fbm(x / 260, z / 260, 2, 11)) },
  { species: 'parasolTitan', rect: { x0: -2600, x1: 2600, z0: -3400, z1: -620 }, minDist: 150, h: [40, 105], variants: 3,
    mask: (x, z) => smoothstep(0.1, 0.3, fbm(x / 380, z / 380, 3, 12)) },
];

// ---- the rest of the walkable world (360°). These never touch the hero camera's view wedge (|angle| < 0.75 rad),
// except small species far beyond the crest, so the hero frame is unchanged; they run after SPECS so its rng sequence is too.
const WEDGE = 0.75;
const inRect = (x: number, z: number, r: Rect) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
const radial = (cx: number, cz: number, r0: number, r1: number) => (x: number, z: number) => 1 - smoothstep(r0, r1, Math.hypot(x - cx, z - cz));
const around = (cx: number, cz: number, r: number): Rect => ({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r });
const DISC: Rect = { x0: -2300, x1: 2300, z0: -2700, z1: 1800 };
const clump = (x: number, z: number, s: number, seed: number, lo = 0.05, hi = 0.3) => smoothstep(lo, hi, fbm(x / s, z / s, 2, seed));

/** Low-frequency grove field for the 360° world: 0 in open clearings, 1 in groves (tall species only). */
const grove = (x: number, z: number) => smoothstep(0.02, 0.22, fbm(x / 520, z / 520, 2, 61));

type WorldSpec = Spec & { inWedgeBeyond?: number; variant?: number; thin?: boolean };

/** Scatter variant pick: spike crowns (groundCover#3) and the 11k-triangle lantern (lanternPods#2) are hand-placed / own-spec only. */
function pickVariant(species: SpeciesId, r: number, count: number): number {
  if (species === 'groundCover' && count > 3) return Math.floor(r * 3);
  if (species === 'lanternPods' && count > 3) return [0, 1, 3][Math.floor(r * 3)];
  return Math.floor(r * count);
}
/** Far forest thinning (~30%) for the tall species beyond the hero midground. */
const thinFar = (species: SpeciesId, d: number) => ((species === 'coilSpire' || species === 'parasolTitan') && d > 600 ? 0.7 : 1);
const WORLD: WorldSpec[] = [
  // ground-cover patches at the set pieces
  ...([[HOLLOW.x, HOLLOW.z, 150], [TITAN_FOREST.x, TITAN_FOREST.z, 170], [ARCH2.x, ARCH2.z - 220, 130], [-420, 520, 110], [620, 380, 110]] as [number, number, number][])
    .map(([cx, cz, r]): WorldSpec => ({ species: 'groundCover', rect: around(cx, cz, r), minDist: 2.6, h: [0.8, 1.8], absScale: true, variants: 3,
      mask: (x, z) => radial(cx, cz, r * 0.4, r)(x, z) * (0.5 + 0.5 * clump(x, z, 20, 41, -0.2, 0.3)) })),
  // dune dressing off the riverbed in the basin (tiny from the hero camera, reads when walking)
  { species: 'groundCover', rect: { x0: -220, x1: 260, z0: -320, z1: -110 }, minDist: 3.4, h: [0.9, 1.9], absScale: true, variants: 3, inWedgeBeyond: 0,
    mask: (x, z) => 0.55 * clump(x, z, 30, 47, -0.1, 0.3) },
  // spike crowns (groundCover#3, 3.5 m thistles): sparse silhouettes in clumps, never as filler
  { species: 'groundCover', variant: 3, rect: DISC, minDist: 28, h: [0.8, 1.2], absScale: true, variants: 4, inWedgeBeyond: 700,
    mask: (x, z, d) => (d > 40 ? 0.35 * clump(x, z, 90, 48, 0.15, 0.35) : 0) },
  // the dunes behind the start camera (toward +Z/-X): ground cover, pods and fans so the first turn-around isn't bare
  { species: 'groundCover', rect: around(-70, 10, 150), minDist: 2.8, h: [0.8, 1.8], absScale: true, variants: 3,
    mask: (x, z) => radial(-70, 10, 50, 150)(x, z) * (0.45 + 0.55 * clump(x, z, 22, 49, -0.2, 0.3)) },
  { species: 'lanternPods', rect: around(-70, 10, 170), minDist: 26, h: [5, 14], variants: 4, mask: radial(-70, 10, 60, 170) },
  { species: 'ribFan', rect: around(-70, 10, 170), minDist: 38, h: [10, 24], variants: 4, mask: (x, z) => 0.7 * radial(-70, 10, 70, 170)(x, z) },
  // pod-lantern hollow: the glow set piece
  { species: 'lanternPods', rect: around(HOLLOW.x, HOLLOW.z, 230), minDist: 17, h: [6, 22], variants: 4, mask: radial(HOLLOW.x, HOLLOW.z, 80, 230) },
  { species: 'lanternPods', rect: DISC, minDist: 90, h: [7, 18], variants: 4, inWedgeBeyond: 1100, mask: (x, z) => 0.5 * clump(x, z, 120, 42, 0.15, 0.4) },
  { species: 'ribFan', rect: DISC, minDist: 85, h: [12, 34], variants: 4, inWedgeBeyond: 1100, mask: (x, z) => 0.45 * clump(x, z, 150, 43) },
  { species: 'weeper', rect: DISC, minDist: 95, h: [20, 50], variants: 4, inWedgeBeyond: 1100, mask: (x, z) => 0.25 + 0.5 * clump(x, z, 200, 44) },
  { species: 'coilSpire', rect: { x0: -3000, x1: 3000, z0: -3200, z1: 2800 }, minDist: 105, h: [40, 115], variants: 4,
    mask: (x, z, d) => (d > 200 ? 0.35 + 0.5 * clump(x, z, 260, 45, 0.15, 0.32) : 0) },
  // titan forest (east) and scattered titans everywhere else, a clearing kept around the hero camera
  { species: 'parasolTitan', rect: around(TITAN_FOREST.x, TITAN_FOREST.z, TITAN_FOREST.radius), minDist: 62, h: [90, 175], variants: 4,
    mask: radial(TITAN_FOREST.x, TITAN_FOREST.z, TITAN_FOREST.radius * 0.55, TITAN_FOREST.radius) },
  { species: 'parasolTitan', rect: { x0: -3300, x1: 3300, z0: -3600, z1: 3300 }, minDist: 165, h: [50, 140], variants: 4,
    mask: (x, z, d) => (d > 260 && Math.hypot(x - TITAN_FOREST.x, z - TITAN_FOREST.z) > TITAN_FOREST.radius ? 0.3 + 0.7 * clump(x, z, 380, 46, 0.05, 0.25) : 0) },
];

/** Hand-placed composition plants: hero, its grove (repeating, diminishing), and foreground framing. */
export const HAND: { species: SpeciesId; variant: number; x: number; z: number; h: number; yaw: number; tilt?: [number, number] }[] = [
  { species: 'parasolTitan', variant: 1, x: HERO.x, z: HERO.z, h: HERO.height, yaw: 0.4, tilt: [0.02, -0.03] },
  // left grove: demoted (smaller, further back, paler) so nothing competes with the hero
  { species: 'parasolTitan', variant: 0, x: -260, z: -760, h: 70, yaw: 1.1 },
  { species: 'parasolTitan', variant: 2, x: -430, z: -980, h: 85, yaw: 2.0 },
  { species: 'parasolTitan', variant: 0, x: -170, z: -880, h: 48, yaw: 0.2 },
  { species: 'coilSpire', variant: 0, x: -90, z: -420, h: 55, yaw: 0.6 },
  { species: 'coilSpire', variant: 2, x: -200, z: -330, h: 38, yaw: 2.4 },
  // right of hero
  { species: 'parasolTitan', variant: 0, x: 300, z: -900, h: 70, yaw: 2.9 },
  { species: 'coilSpire', variant: 1, x: 150, z: -300, h: 48, yaw: 1.7 },
  { species: 'coilSpire', variant: 0, x: 240, z: -760, h: 70, yaw: 0.3 },
  // far giants: hazy repeats of the hero shape for depth
  { species: 'parasolTitan', variant: 3, x: -1050, z: -1900, h: 300, yaw: 0.8 },
  { species: 'parasolTitan', variant: 0, x: 1100, z: -2600, h: 330, yaw: 2.2 },
  // foreground framing: a cropped, overhanging young titan cap in the top-left corner; pods + fan tips on the bottom corners
  { species: 'parasolTitan', variant: 0, x: -36, z: -44, h: 28, yaw: 0.3, tilt: [0, -0.4] },
  { species: 'lanternPods', variant: 2, x: -7.5, z: -10.5, h: 5.5, yaw: 0.8 },
  // spike-crown silhouettes rising from the bottom edge
  { species: 'groundCover', variant: 3, x: 4.6, z: -8.5, h: 2.3, yaw: 0.7 },
  { species: 'groundCover', variant: 3, x: 6.8, z: -10.5, h: 2.7, yaw: 2.1 },
  { species: 'groundCover', variant: 3, x: -4.6, z: -8, h: 2.6, yaw: 1.4 },
  // a small glowing pair beside the explorer: the accent sits on the story beat
  { species: 'lanternPods', variant: 0, x: -26, z: -76, h: 6.5, yaw: 1.3 },
  { species: 'lanternPods', variant: 2, x: -3.5, z: -88, h: 5, yaw: 0.4 },
  { species: 'lanternPods', variant: 0, x: 11, z: -13, h: 5, yaw: 2.2 },
  { species: 'ribFan', variant: 1, x: 19, z: -15, h: 9, yaw: -0.9 },
  { species: 'ribFan', variant: 0, x: -30, z: -46, h: 9, yaw: 0.9 },
];

export function placePlants(seed: number, heightOf: (s: SpeciesId, variant: number) => number, variantsOf?: (s: SpeciesId) => number): PlantInstance[] {
  const rng = mulberry32(seed);
  const out: PlantInstance[] = [];
  for (const p of HAND) out.push({ species: p.species, variant: p.variant, position: [p.x, 0, p.z], yaw: p.yaw, scale: p.h / heightOf(p.species, p.variant), tilt: p.tilt });
  const taken = HAND.map((p) => [p.x, p.z, p.h] as const);
  for (const s of SPECS) {
    const tall = s.species !== 'groundCover';
    const pad = tall ? s.minDist * 0.25 : 0.5;
    const pts = poissonDisk(rng, s.rect, s.minDist, (x, z) => (clear(x, z, tall, pad, s.species) ? s.mask(x, z, Math.hypot(x, z)) * thinFar(s.species, Math.hypot(x, z)) : 0));
    for (const [x, z] of pts) {
      if (tall && taken.some(([tx, tz, th]) => Math.hypot(tx - x, tz - z) < Math.max(s.minDist, th * 0.5))) continue;
      const variant = pickVariant(s.species, rng(), variantsOf?.(s.species) ?? s.variants);
      const h = s.h[0] + (s.h[1] - s.h[0]) * Math.pow(rng(), 1.4);
      out.push({ species: s.species, variant, position: [x, 0, z], yaw: rng() * Math.PI * 2, scale: s.absScale ? h : h / heightOf(s.species, variant), tilt: [(rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12] });
    }
  }
  // the 360° world
  const oldRect = new Map(SPECS.map((s) => [s.species, s.rect]));
  for (const s of WORLD) {
    const tall = s.species !== 'groundCover';
    const pad = tall ? s.minDist * 0.25 : 0.5;
    const own = oldRect.get(s.species)!;
    const accept = (x: number, z: number) => {
      const a = Math.abs(angOf(x, z)), d = Math.hypot(x, z);
      const inWedge = a < WEDGE && !(s.inWedgeBeyond !== undefined && d > s.inWedgeBeyond);
      if (inWedge || (a <= 0.95 && inRect(x, z, own))) return 0; // hero frame keeps exactly what SPECS put there
      const rv = riverDist(x, z);
      if (rv.d < rv.w * 1.1 + pad) return 0;
      return s.mask(x, z, d) * thinFar(s.species, d) * (tall && s.species !== 'lanternPods' && !s.variant ? grove(x, z) : 1);
    };
    const pts = poissonDisk(rng, s.rect, s.minDist, accept);
    for (const [x, z] of pts) {
      if (tall && taken.some(([tx, tz, th]) => Math.hypot(tx - x, tz - z) < Math.max(s.minDist, th * 0.5))) continue;
      const variant = s.variant ?? pickVariant(s.species, rng(), variantsOf?.(s.species) ?? 3);
      const h = s.h[0] + (s.h[1] - s.h[0]) * Math.pow(rng(), 1.4);
      out.push({ species: s.species, variant, position: [x, 0, z], yaw: rng() * Math.PI * 2, scale: s.absScale ? h : h / heightOf(s.species, variant), tilt: [(rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12] });
    }
  }
  placed = out.map((p) => {
    const height = s_height(p, heightOf);
    return { ...p, position: [p.position[0], heightAt(p.position[0], p.position[2]), p.position[2]] as [number, number, number], height, trunkRadius: TRUNK_RADIUS[p.species] * height };
  });
  return out;
}

// ---- read-only export for colliders (rw-move): every placed plant with its ground height, real height and trunk radius
/** Trunk radius at the base as a fraction of the instance's height, per species (0 = walk-through). */
export const TRUNK_RADIUS: Readonly<Record<SpeciesId, number>> = {
  parasolTitan: 0.028, coilSpire: 0.04, lanternPods: 0.035, weeper: 0.03, ribFan: 0.035, groundCover: 0,
};
export interface PlacedPlant extends PlantInstance { height: number; trunkRadius: number }
let placed: readonly PlacedPlant[] = [];
/** Plants from the last placePlants() call; position[1] is the terrain height at the base. */
export const getPlacedPlants = (): readonly PlacedPlant[] => placed;
const s_height = (p: PlantInstance, heightOf: (s: SpeciesId, v: number) => number) => p.scale * heightOf(p.species, p.variant);
