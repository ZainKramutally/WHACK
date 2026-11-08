// Per-mineral macro rock structures (owner request, 2026-11-08): every mineral gets its own big structure family, placed only
// where that mineral dominates the local crust (weight >= WEIGHT_MIN). Art-layer decoration, a pure function of
// (terrain, crust, seed) on its own named RNG stream ('rockForms:*'); the sim never reads it and it consumes no sim stream.
//   basalt, reducedLava: lava tubes (inland) and sea stacks (offshore)
//   ironstone:           flat-topped mesas and buttes with banded sides
//   granite:             bornhardt domes, stacked tors, balancing boulders
//   silicide:            dark rounded mounds and big pitted boulders
//   nitride:             giant hexagonal crystal clusters
//   waterIce:            none here (the relic ice arches and spires are gen/landmarks.ts)
// Seated on the ground at the end of the build (`plainHeight`, the relic piers removed) and kept out of the spawn clearing.
import { makeRng } from '../sim/rng';
import { sampleHeights, seaLevelFromHeights, spawnPoint, type Terrain, type TerrainState } from './terrain';
import type { Circle, LandmarkSet } from './landmarks';
import { buildForm, lavaTubeSoup, newSoup, noise3, plainLook, ROLE, type Look, type Soup } from './rockFormMesh';

export type RockFormKind = 'lavaTube' | 'fanCliff' | 'seaStack' | 'mesa' | 'dome' | 'torStack' | 'balancer' | 'silicideMound' | 'pitBoulder' | 'crystalCluster';
/** One draw call per family. */
export type RockFamily = 'lava' | 'iron' | 'granite' | 'silicide' | 'nitride';

export interface RockForm {
  id: number;
  kind: RockFormKind;
  family: RockFamily;
  mineral: string;            // crust mineral id it stands on
  x: number; z: number;       // centre (tube: middle of the span)
  y: number;                  // ground height at the centre at the end of the build
  weight: number;             // the mineral's crust weight at (x, z)
  angle: number;
  size: number;               // main radius (tube: tunnel radius), m
  height: number;
  length?: number;            // tubes only, m
  variant: number;
  seed: number;
}

export interface FamilyMesh {
  family: RockFamily;
  matIds: string[];           // mineral ids, indexed by `mat`
  positions: Float32Array;    // world metres, triangle soup
  role: Uint8Array;           // per vertex: ROLE.* (0 = the mineral's own colour)
  shade: Float32Array;        // per vertex colour multiplier
  mat: Uint8Array;            // per vertex: index into matIds
  lichen: Float32Array;       // per vertex: 0..1 suitability for lichen (up-facing, patchy); the render part applies it to basalt only
  triangles: number;
  top: number;                // highest vertex (m): sinking the family by this much hides all of it
}

export interface RockFormSet {
  forms: RockForm[];
  families: FamilyMesh[];
  footprints(f: RockForm): Circle[];
  /** Moves (x, z) out of any grown structure's footprint (plus `margin`); null if already clear. */
  pushOut(x: number, z: number, state: TerrainState, margin?: number): { x: number; z: number } | null;
  /** 0..1: the terrain rise (structures rise with the build). */
  growth(state: TerrainState): number;
}

export interface RockFormOpts { seaCover: number }

/** A structure stands only where its mineral's crust weight is at least this. */
export const WEIGHT_MIN = 0.6;
/** Tube ends and quarter points need at least this weight (a tube is long, so a little lower). */
const PATH_WEIGHT_MIN = 0.45;   // checked at both ends and the middle of a tube
export const MAX_FORMS = 20;
const SPAWN_CLEAR = 70;       // m: nothing within this of the spawn, so the walk to the shore stays open
const SOLID_FROM = 0.2;

const FAMILY_OF: Record<string, RockFamily> = { basalt: 'lava', reducedLava: 'lava', ironstone: 'iron', granite: 'granite', silicide: 'silicide', nitride: 'nitride' };

interface PlanEntry { kind: RockFormKind; count: number; size: [number, number]; height: [number, number]; length?: [number, number]; where: 'inland' | 'land' | 'offshore' | 'cliff'; variants: number }
const PLAN: Record<string, PlanEntry[]> = {
  basalt: [
    { kind: 'lavaTube', count: 2, size: [5, 8], height: [0, 0], length: [60, 110], where: 'inland', variants: 3 },
    { kind: 'fanCliff', count: 2, size: [1.7, 2.4], height: [14, 26], length: [28, 40], where: 'cliff', variants: 2 },
    { kind: 'seaStack', count: 3, size: [3.5, 6], height: [10, 22], where: 'offshore', variants: 1 },
  ],
  ironstone: [{ kind: 'mesa', count: 5, size: [18, 32], height: [14, 26], where: 'land', variants: 3 }],
  granite: [
    { kind: 'dome', count: 2, size: [20, 32], height: [12, 22], where: 'land', variants: 1 },
    { kind: 'torStack', count: 2, size: [6, 9], height: [10, 18], where: 'land', variants: 2 },
    { kind: 'balancer', count: 1, size: [5, 7], height: [10, 14], where: 'land', variants: 1 },
  ],
  silicide: [
    { kind: 'silicideMound', count: 3, size: [12, 20], height: [5, 9], where: 'land', variants: 2 },
    { kind: 'pitBoulder', count: 3, size: [6, 10], height: [6, 10], where: 'land', variants: 1 },
  ],
  nitride: [{ kind: 'crystalCluster', count: 4, size: [8, 12], height: [18, 34], where: 'land', variants: 2 }],
};
PLAN.reducedLava = PLAN.basalt;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const FULL: TerrainState = { rise: 1, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 }, heatSolvent: 0.5 };

function lookFor(f: RockForm): Look {
  if (f.family === 'iron') {
    // banded ironstone (Hamersley-style): red jasper and hematite bands by height, light tops
    const bands = [ROLE.RED, ROLE.CRIMSON, ROLE.RED, ROLE.MAROON, ROLE.CRIMSON];
    return (c, n) => {
      if (n[1] > 0.7) return { role: ROLE.REDLIGHT, shade: 1.04 + 0.1 * noise3(c[0] * 0.2, 0, c[2] * 0.2, f.seed) };
      const b = Math.floor(c[1] / 3 + 1.4 * noise3(c[0] * 0.03, c[1] * 0.02, c[2] * 0.03, f.seed) + 40);
      return { role: bands[b % bands.length], shade: 0.92 + 0.14 * ((b * 7919) % 5) / 4 };
    };
  }
  if (f.family === 'silicide') {
    const base = plainLook(f.seed);
    return (c, n, aux) => { const o = base(c, n, aux); return { role: o.role, shade: o.shade * (1 - 0.35 * aux) }; };   // pits read darker
  }
  if (f.family === 'lava') {
    // warm grey columns with lighter, stepped, broken tops
    const base = plainLook(f.seed);
    return (c, n, aux) => { const o = base(c, n, aux); return { role: o.role, shade: o.shade * (n[1] > 0.7 ? 1.22 : 1) }; };
  }
  return plainLook(f.seed);
}

export function createRockForms(terrain: Terrain, landmarks: LandmarkSet, opts: RockFormOpts): RockFormSet {
  const S = terrain.patchSize;
  const minerals = terrain.config.crust.minerals;
  const rng = makeRng(terrain.seed);
  const ground = (x: number, z: number) => landmarks.plainHeight(x, z, FULL);
  const sea = seaLevelFromHeights(sampleHeights(terrain, FULL, 64), Math.min(0.999, Math.max(0.001, opts.seaCover)));
  const spawn = spawnPoint(terrain, FULL, sea);
  const lim = 0.44 * S;
  const step = 10;

  // sample once: ground and the crust weights at every candidate
  interface Cell { x: number; z: number; gh: number; w: number[]; vis: number }
  const cells: Cell[] = [];
  for (let z = -lim; z <= lim; z += step) {
    for (let x = -lim; x <= lim; x += step) {
      const dx = x - spawn.x, dz = z - spawn.z, d = Math.hypot(dx, dz) || 1;
      const dist = smoothstep(25, 70, d) * (1 - smoothstep(170, 260, d));
      const cone = clamp01((-dz / d + 0.25) / 1.0);
      cells.push({ x, z, gh: ground(x, z), w: terrain.crustWeights(x, z), vis: dist * (0.25 + 0.75 * cone) });
    }
  }

  /** Ground gradient magnitude and the downhill heading (rad) at a point, over +-5 m. */
  const slopeAt = (x: number, z: number) => {
    const gx = (ground(x + 5, z) - ground(x - 5, z)) / 10, gz = (ground(x, z + 5) - ground(x, z - 5)) / 10;
    return { g: Math.hypot(gx, gz), down: Math.atan2(-gz, -gx) };
  };

  const taken: Circle[] = landmarks.landmarks.flatMap((lm) => landmarks.footprints(lm));
  const free = (x: number, z: number, r: number) => taken.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + r + 6);
  const farFromSpawn = (x: number, z: number, r: number) => Math.hypot(x - spawn.x, z - spawn.z) > SPAWN_CLEAR + r;

  // scale the planned counts so the total stays within budget, and so a mineral with little ground gets fewer
  const present = minerals.map((m, i) => ({ m, i, cells: cells.filter((c) => c.w[i] >= WEIGHT_MIN).length })).filter((e) => e.cells > 0 && PLAN[e.m.id]);
  const planned = present.reduce((n, e) => n + PLAN[e.m.id].reduce((k, p) => k + p.count, 0), 0);
  const scale = Math.min(1, MAX_FORMS / Math.max(1, planned));
  const total = cells.length;

  const forms: RockForm[] = [];
  for (const { m, i, cells: nc } of present) {
    const r = rng(`rockForms:${m.id}`);
    const between = (a: number, b: number) => a + (b - a) * r();
    // a mineral covering a lot of the patch gets a few more structures, a sliver of one a few fewer
    const share = nc / total, boost = Math.min(1.6, Math.max(0.8, Math.sqrt(share / 0.2)));
    for (const p of PLAN[m.id]) {
      const want = Math.max(1, Math.round(p.count * scale * boost));
      const ranked = cells
        .filter((c) => c.w[i] >= WEIGHT_MIN && farFromSpawn(c.x, c.z, 0))
        .filter((c) => (p.where === 'offshore' ? c.gh < sea - 1.5 && c.gh > sea - 7 : p.where === 'inland' ? c.gh > sea + 2.5 : p.where === 'cliff' ? c.gh > sea + 1 && c.gh < sea + 30 && slopeAt(c.x, c.z).g >= 0.3 : c.gh > sea + 3))
        .map((c) => ({ c, v: (0.2 + c.vis) * (0.7 + 0.6 * r()) + (p.where === 'inland' ? clamp01((c.gh - sea) / 20) : 0) }))
        .sort((a, b) => b.v - a.v);
      let got = 0;
      for (const { c } of ranked) {
        if (got >= want) break;
        const k = got;
        const size = between(p.size[0], p.size[1]);
        const form: RockForm = {
          id: forms.length, kind: p.kind, family: FAMILY_OF[m.id], mineral: m.id, x: c.x, z: c.z, y: c.gh, weight: c.w[i],
          angle: r() * Math.PI * 2, size, height: between(p.height[0], p.height[1]), variant: k % p.variants, seed: Math.floor(r() * 4294967296) >>> 0,
        };
        if (p.kind === 'lavaTube') {
          // try twelve headings; every sampled point of the path must stay on this rock, inland, clear of the spawn and of other structures
          form.length = between(p.length![0], p.length![1]);
          let ok = false;
          for (let t = 0; t < 12 && !ok; t++) {
            form.angle = r() * Math.PI * 2;
            ok = true;
            for (let s = 0; s <= 8 && ok; s++) {
              const along = (s / 8 - 0.5) * form.length;
              const x = c.x + Math.cos(form.angle) * along, z = c.z + Math.sin(form.angle) * along;
              if (Math.abs(x) > 0.46 * S || Math.abs(z) > 0.46 * S) { ok = false; break; }
              const w = terrain.crustWeights(x, z)[i];
              ok = (s % 4 !== 0 || w >= PATH_WEIGHT_MIN) && ground(x, z) > sea + 2 && farFromSpawn(x, z, size) && free(x, z, size);
            }
          }
          if (!ok) continue;
          for (let s = 0; s <= 4; s++) {
            const along = (s / 4 - 0.5) * form.length;
            taken.push({ x: c.x + Math.cos(form.angle) * along, z: c.z + Math.sin(form.angle) * along, r: size * 1.5 });
          }
        } else if (p.kind === 'fanCliff') {
          // faces downhill; the bundle spans `length` along the slope, so keep the whole front clear
          form.length = between(p.length![0], p.length![1]);
          form.angle = slopeAt(c.x, c.z).down;
          const lx = -Math.sin(form.angle), lz = Math.cos(form.angle);
          let ok = true;
          for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) {
            const x = c.x + lx * u * form.length, z = c.z + lz * u * form.length;
            ok = ok && Math.abs(x) < 0.46 * S && Math.abs(z) < 0.46 * S && farFromSpawn(x, z, 6) && free(x, z, form.length / 8 + size);
          }
          if (!ok) continue;
          for (const u of [-0.375, -0.125, 0.125, 0.375]) taken.push({ x: c.x + lx * u * form.length, z: c.z + lz * u * form.length, r: form.length / 8 + size * 2 });
        } else {
          const foot = size * (p.kind === 'mesa' ? 1.5 : p.kind === 'crystalCluster' ? 1.6 : 1.3);
          if (!free(c.x, c.z, foot)) continue;
          // not on a steep or broken site: the ground across the footprint must not span more than the structure is tall
          const gs = [ground(c.x + size, c.z), ground(c.x - size, c.z), ground(c.x, c.z + size), ground(c.x, c.z - size)];
          if (p.where !== 'offshore' && Math.max(...gs) - Math.min(...gs) > Math.max(10, form.height * 0.8)) continue;
          taken.push({ x: c.x, z: c.z, r: foot });
        }
        forms.push(form);
        got++;
      }
    }
  }
  forms.sort((a, b) => a.id - b.id);

  // ----- meshes: one merged soup per family, in world coordinates -----
  const soups = new Map<RockFamily, { soup: Soup; matIds: string[] }>();
  const circles = new Map<number, Circle[]>();
  for (const f of forms) {
    let e = soups.get(f.family);
    if (!e) { e = { soup: newSoup(), matIds: [] }; soups.set(f.family, e); }
    let mi = e.matIds.indexOf(f.mineral);
    if (mi < 0) { mi = e.matIds.length; e.matIds.push(f.mineral); }
    const local = newSoup();
    const g = (dx: number, dz: number) => ground(f.x + dx, f.z + dz) - f.y;
    const look = lookFor(f);
    const fc: Circle[] = [];
    if (f.kind === 'lavaTube') {
      const t = lavaTubeSoup(local, f, g, look, mi);
      const skip = new Set<number>();
      for (const [g0, g1] of t.gaps) for (let k = g0; k <= g1; k++) skip.add(k);
      t.path.forEach((p, k) => {
        if (k % 2 || skip.has(k)) return;
        if (p[1] - t.radii[k] - g(p[0], p[2]) < 2.5) fc.push({ x: f.x + p[0], z: f.z + p[2], r: t.radii[k] * 0.9 });   // low enough to block; higher spans can be walked under
      });
    } else if (f.kind === 'fanCliff') {
      buildForm(local, f, g, look, mi);
      const lx = -Math.sin(f.angle), lz = Math.cos(f.angle);
      for (const u of [-0.375, -0.125, 0.125, 0.375]) fc.push({ x: f.x + lx * u * f.length!, z: f.z + lz * u * f.length!, r: f.length! / 8 + f.size });
    } else {
      buildForm(local, f, g, look, mi);
      const r = f.kind === 'mesa' ? f.size * 1.1 : f.kind === 'crystalCluster' ? f.size * 1.1 : f.kind === 'seaStack' ? f.size * 1.2 : f.size * 0.95;
      fc.push({ x: f.x, z: f.z, r });
      if (f.kind === 'mesa' && f.variant === 2) fc.push({ x: f.x + Math.cos(f.angle) * f.size * 1.9, z: f.z + Math.sin(f.angle) * f.size * 1.9, r: f.size * 0.5 });
    }
    circles.set(f.id, fc);
    const p = local.pos;
    for (let k = 0; k < p.length; k += 3) e.soup.pos.push(p[k] + f.x, p[k + 1] + f.y, p[k + 2] + f.z);
    e.soup.role.push(...local.role); e.soup.shade.push(...local.shade); e.soup.mat.push(...local.mat); e.soup.lichen.push(...local.lichen);
    e.soup.top = Math.max(e.soup.top, local.top + f.y);
  }
  const families: FamilyMesh[] = [...soups.entries()].map(([family, { soup, matIds }]) => ({
    family, matIds, positions: new Float32Array(soup.pos), role: Uint8Array.from(soup.role), shade: Float32Array.from(soup.shade), mat: Uint8Array.from(soup.mat), lichen: Float32Array.from(soup.lichen),
    triangles: soup.pos.length / 9, top: soup.top,
  }));

  const growth = (st: TerrainState) => clamp01(st.rise);
  return {
    forms, families,
    footprints: (f) => circles.get(f.id) ?? [],
    growth,
    pushOut(x, z, st, margin = 0.7) {
      if (growth(st) < SOLID_FROM) return null;
      let moved = false;
      for (let pass = 0; pass < 2; pass++) {
        for (const cs of circles.values()) {
          for (const c of cs) {
            const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + margin;
            if (d >= min) continue;
            const k = d > 1e-6 ? min / d : 0;
            x = d > 1e-6 ? c.x + dx * k : c.x + min;
            z = d > 1e-6 ? c.z + dz * k : c.z;
            moved = true;
          }
        }
      }
      return moved ? { x, z } : null;
    },
  };
}
