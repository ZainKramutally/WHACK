// Seeded plant placement: hand-placed hero plants for composition + Poisson-disk scatter with density masks.
// Pure (no three.js). Output scale = target height / archetype height (heightOf).
import type { PlantInstance, SpeciesId } from './contracts';
import { mulberry32, fbm, smoothstep } from './rng';
import { riverDist, riverHalfWidth } from './field';
import { HERO, EXPLORER } from './layout';

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

type Spec = { species: SpeciesId; rect: Rect; minDist: number; h: [number, number]; mask: (x: number, z: number, d: number) => number; variants: number };

const angOf = (x: number, z: number) => Math.atan2(-x, -z);
const HERO_ANG = angOf(HERO.x, HERO.z), EXP_ANG = angOf(EXPLORER.x, EXPLORER.z);

/** Keep sight-lines to the hero and the explorer clear, stay inside a wide view wedge, stay off the riverbed. */
function clear(x: number, z: number, tall: boolean, pad: number): boolean {
  const a = angOf(x, z), d = Math.hypot(x, z);
  if (Math.abs(a) > 0.95) return false;
  const rv = riverDist(x, z);
  if (rv.d < riverHalfWidth(rv.t) * 1.1 + pad) return false;
  if (tall && Math.abs(a - HERO_ANG) < 0.1 && d < 420) return false;
  if (tall && Math.abs(a - EXP_ANG) < 0.08 && d < 110) return false;
  if (Math.hypot(x - HERO.x, z - HERO.z) < 45) return false;
  return true;
}

const SPECS: Spec[] = [
  { species: 'groundCover', rect: { x0: -90, x1: 90, z0: -170, z1: 6 }, minDist: 2.1, h: [0.7, 2.4], variants: 3,
    mask: (x, z, d) => (1 - smoothstep(25, 170, d)) * (0.55 + 0.45 * smoothstep(-0.2, 0.3, fbm(x / 18, z / 18, 2, 5))) },
  { species: 'lanternPods', rect: { x0: -320, x1: 320, z0: -520, z1: -12 }, minDist: 45, h: [7, 18], variants: 3,
    mask: (x, z) => 0.6 * smoothstep(0.2, 0.45, fbm(x / 90, z / 90, 2, 8)) },
  { species: 'ribFan', rect: { x0: -420, x1: 420, z0: -720, z1: -30 }, minDist: 60, h: [12, 30], variants: 3,
    mask: (x, z) => 0.35 * smoothstep(0.1, 0.35, fbm(x / 140, z / 140, 2, 9)) },
  { species: 'weeper', rect: { x0: -600, x1: 600, z0: -900, z1: -70 }, minDist: 70, h: [22, 48], variants: 3,
    mask: (x, z) => 0.5 * smoothstep(0, 0.3, fbm(x / 200, z / 200, 2, 10)) },
  { species: 'coilSpire', rect: { x0: -1400, x1: 1400, z0: -2200, z1: -260 }, minDist: 80, h: [40, 115], variants: 3,
    mask: (x, z) => 0.7 * smoothstep(-0.05, 0.25, fbm(x / 300, z / 300, 2, 11)) },
  { species: 'parasolTitan', rect: { x0: -2600, x1: 2600, z0: -3400, z1: -620 }, minDist: 150, h: [40, 105], variants: 3,
    mask: (x, z) => smoothstep(0.0, 0.25, fbm(x / 420, z / 420, 3, 12)) },
];

/** Hand-placed composition plants: hero, its grove (repeating, diminishing), and foreground framing. */
export const HAND: { species: SpeciesId; variant: number; x: number; z: number; h: number; yaw: number; tilt?: [number, number] }[] = [
  { species: 'parasolTitan', variant: 1, x: HERO.x, z: HERO.z, h: HERO.height, yaw: 0.4, tilt: [0.02, -0.03] },
  // left grove, repeating and diminishing
  { species: 'parasolTitan', variant: 0, x: -150, z: -300, h: 72, yaw: 1.1 },
  { species: 'parasolTitan', variant: 2, x: -245, z: -480, h: 96, yaw: 2.0 },
  { species: 'parasolTitan', variant: 0, x: -110, z: -600, h: 58, yaw: 0.2 },
  { species: 'coilSpire', variant: 0, x: -62, z: -335, h: 74, yaw: 0.6 },
  { species: 'coilSpire', variant: 2, x: -190, z: -235, h: 46, yaw: 2.4 },
  // right of hero
  { species: 'parasolTitan', variant: 0, x: 215, z: -640, h: 84, yaw: 2.9 },
  { species: 'coilSpire', variant: 1, x: 150, z: -300, h: 60, yaw: 1.7 },
  { species: 'coilSpire', variant: 0, x: 168, z: -480, h: 92, yaw: 0.3 },
  // foreground framing: weeper arching over the top-left corner, pods + fans on the bottom corners
  { species: 'weeper', variant: 2, x: -19, z: -24, h: 34, yaw: -0.25, tilt: [0, -0.06] },
  { species: 'lanternPods', variant: 2, x: -7.5, z: -10.5, h: 5.5, yaw: 0.8 },
  { species: 'lanternPods', variant: 1, x: 10.5, z: -14, h: 7, yaw: 2.2 },
  { species: 'ribFan', variant: 1, x: 15, z: -21, h: 10, yaw: -0.4 },
  { species: 'ribFan', variant: 0, x: -24, z: -52, h: 13, yaw: 0.9 },
];

export function placePlants(seed: number, heightOf: (s: SpeciesId, variant: number) => number): PlantInstance[] {
  const rng = mulberry32(seed);
  const out: PlantInstance[] = [];
  for (const p of HAND) out.push({ species: p.species, variant: p.variant, position: [p.x, 0, p.z], yaw: p.yaw, scale: p.h / heightOf(p.species, p.variant), tilt: p.tilt });
  const taken = HAND.map((p) => [p.x, p.z, p.h] as const);
  for (const s of SPECS) {
    const tall = s.species !== 'groundCover';
    const pad = tall ? s.minDist * 0.25 : 0.5;
    const pts = poissonDisk(rng, s.rect, s.minDist, (x, z) => (clear(x, z, tall, pad) ? s.mask(x, z, Math.hypot(x, z)) : 0));
    for (const [x, z] of pts) {
      if (tall && taken.some(([tx, tz, th]) => Math.hypot(tx - x, tz - z) < Math.max(s.minDist, th * 0.5))) continue;
      const variant = Math.floor(rng() * s.variants);
      const h = s.h[0] + (s.h[1] - s.h[0]) * Math.pow(rng(), 1.4);
      out.push({ species: s.species, variant, position: [x, 0, z], yaw: rng() * Math.PI * 2, scale: h / heightOf(s.species, variant), tilt: [(rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12] });
    }
  }
  return out;
}
