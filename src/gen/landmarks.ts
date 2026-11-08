// Landmark structures (issue #52): the big rock and ice features the player can see from spawn. Pure logic, no three.js.
//
// Every structure is a drawn-larger, more legible version of something the terrain logic already produces; nothing is invented:
//   - silicon relic ice arches and spires: the seeded `terrain.relics` list (the heightfield can only make the piers; the
//     lintel and the faceted tiers are drawn by src/render/landmarks.ts)
//   - silicon crystal-column clusters: M2 crust rims at the sea margin (sites where the M2 field peaks)
//   - carbon shell-stone reef pillars and stromatolite towers: M6 mounds in the shallows (sites where the M6 field peaks)
//   - carbon hoodoo field: M3 frost fins; weathered rock stacks and horizon buttes: M5 strata
// Placement is a pure function of (terrain, seaCover): sites are scored on the machines' own height contributions.
// Growth follows the same progress values the terrain reads, so structures rise during the build and follow live state.
import { heightCore, kit64, sampleHeights, seaLevelFromHeights, spawnPoint, TWO_PI, type MachineId, type Terrain, type TerrainState } from './terrain';
import { makeRng } from '../sim/rng';
import { cellAt, floraAt } from '../render/layout';

export type LandmarkKind = 'iceArch' | 'iceSpire' | 'crystalCluster' | 'reefPillar' | 'stromatolite' | 'hoodoo' | 'rockStack' | 'butte';

export interface Landmark {
  id: number;
  kind: LandmarkKind;
  x: number; z: number;               // base centre (arch: centre of the span)
  height: number; radius: number;     // metres at full growth (arch: pier height and pier radius)
  span: number; angle: number;        // arch only: pier separation and its direction (rad, as terrain Relic.angle); 0 otherwise
  seed: number;                       // u32, for the mesh's noise
  gate: MachineId | 'rise';           // the progress value that grows it ('rise' = relics, which ride the terrain rise)
  heat: boolean;                      // hoodoos: growth also follows the frost-wedging gate (heatSolvent near freezing)
  biomass: boolean;                   // reefs and crusts: height and thickness follow the producer biomass around them
}

export interface Circle { x: number; z: number; r: number }

export interface LandmarkOpts {
  chemistry: 'carbon' | 'silicon';
  /** Sea cover (0..1) at the end of the build; only used to find the shallows when placing reefs and crusts. */
  seaCover: number;
}

export interface LandmarkSet {
  landmarks: Landmark[];
  /** Ground height with the relic piers removed: what a structure stands on. */
  plainHeight(x: number, z: number, state: TerrainState): number;
  /** 0..1: how far it has grown. Rises with the build and follows the live state. */
  growth(lm: Landmark, state: TerrainState): number;
  /** Solid ground-level footprints. */
  footprints(lm: Landmark): Circle[];
  /** Moves (x, z) out of any grown structure's footprint (plus `margin` metres); null if it is already clear. */
  pushOut(x: number, z: number, state: TerrainState, margin?: number): { x: number; z: number } | null;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const { smoothstep } = kit64;
const SOLID_FROM = 0.2;                 // a structure blocks the player once it has grown this much

/** Producer biomass (mat + canopy, mean of the 3×3 flora cells) around a point; 0 if there is no flora buffer. */
export function biomassAround(flora: Float32Array, x: number, z: number, patch: number): number {
  if (!flora.length) return 0;
  let sum = 0, n = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = cellAt(x + dx * (patch / 64), z + dz * (patch / 64), patch);
    if (c < 0) continue;
    const f = floraAt(flora, c);
    sum += f.mat + f.canopy;
    n++;
  }
  return n ? sum / n : 0;
}

/** Height and thickness factors of a biomass-driven structure (1 = the config size) from the producer biomass around it. */
export function biomassFactors(biomass: number): { tall: number; thick: number } {
  const b = clamp01(biomass / 0.9);                 // 0.9 is where the flora form calls a cell lush
  return { tall: 0.55 + 0.45 * b, thick: 0.8 + 0.3 * b };
}

export function createLandmarks(terrain: Terrain, opts: LandmarkOpts): LandmarkSet {
  const P = terrain.params;
  const plainP = { ...P, piers: [] as typeof P.piers };
  const S = terrain.patchSize;
  const silicon = opts.chemistry === 'silicon';
  const m3 = P.machines.M3!;

  const plainHeight = (x: number, z: number, st: TerrainState) => {
    const pr = st.progress;
    return heightCore(plainP, st.rise, st.heatSolvent, pr.M2 ?? 0, pr.M3 ?? 0, pr.M4 ?? 0, pr.M5 ?? 0, pr.M6 ?? 0, x, z);
  };

  const growth = (lm: Landmark, st: TerrainState) => {
    const gate = lm.gate === 'rise' ? 1 : st.progress[lm.gate] ?? 0;
    const frost = lm.heat ? 0.45 + 0.55 * (1 - smoothstep(0, m3.halfWidth, Math.abs(st.heatSolvent - 0.5))) : 1;
    return clamp01(st.rise * gate * frost);
  };

  const footprints = (lm: Landmark): Circle[] => {
    switch (lm.kind) {
      case 'iceArch': {
        const c = Math.cos(lm.angle) * lm.span / 2, s = Math.sin(lm.angle) * lm.span / 2;
        return [{ x: lm.x - c, z: lm.z - s, r: lm.radius * 1.1 }, { x: lm.x + c, z: lm.z + s, r: lm.radius * 1.1 }];
      }
      case 'iceSpire': return [{ x: lm.x, z: lm.z, r: lm.radius * 1.05 }];
      case 'crystalCluster': return [{ x: lm.x, z: lm.z, r: lm.radius * 0.7 }];
      case 'hoodoo': return [{ x: lm.x, z: lm.z, r: lm.radius * 0.9 }];
      case 'butte': return [{ x: lm.x, z: lm.z, r: lm.radius * 0.95 }];
      default: return [{ x: lm.x, z: lm.z, r: lm.radius * 0.85 }];
    }
  };

  const landmarks = place(terrain, opts, plainHeight);

  const pushOut = (x: number, z: number, st: TerrainState, margin = 0.7) => {
    let moved = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const lm of landmarks) {
        if (growth(lm, st) < SOLID_FROM) continue;
        for (const c of footprints(lm)) {
          const dx = x - c.x, dz = z - c.z;
          const d = Math.hypot(dx, dz), min = c.r + margin;
          if (d >= min) continue;
          const k = d > 1e-6 ? min / d : 0;
          x = d > 1e-6 ? c.x + dx * k : c.x + min;
          z = d > 1e-6 ? c.z + dz * k : c.z;
          moved = true;
        }
      }
    }
    return moved ? { x, z } : null;
  };

  void S; void silicon;
  return { landmarks, plainHeight, growth, footprints, pushOut };
}

// ---------- placement ----------

interface Sample { x: number; z: number; gh: number; c2: number; c6: number; vis: number }

function place(terrain: Terrain, opts: LandmarkOpts, plainHeight: LandmarkSet['plainHeight']): Landmark[] {
  const P = terrain.params;
  const S = terrain.patchSize;
  const silicon = opts.chemistry === 'silicon';
  const rng = makeRng(terrain.seed)('landmarks');
  const u32 = () => Math.floor(rng() * 4294967296) >>> 0;
  const between = (a: number, b: number) => a + (b - a) * rng();
  const out: Landmark[] = [];
  let nextId = 0;
  const add = (kind: LandmarkKind, x: number, z: number, height: number, radius: number, gate: Landmark['gate'], extra: Partial<Landmark> = {}) => {
    out.push({ id: nextId++, kind, x, z, height, radius, span: 0, angle: 0, seed: u32(), gate, heat: false, biomass: false, ...extra });
    if (kind === 'stromatolite' || kind === 'rockStack' || kind === 'butte') taken.push({ x, z, r: radius });
  };

  // relics first: they are the terrain's own list, seeded and already positioned
  for (const r of terrain.relics) {
    add(r.kind, r.position[0], r.position[1], r.params.height, r.params.radius, 'rise', { span: r.params.span, angle: r.params.angle });
  }
  const taken: Circle[] = out.map((l) => ({ x: l.x, z: l.z, r: l.radius + l.span / 2 }));

  // sea level and spawn at the end of the build, to bias sites toward what the opening camera sees
  const full: TerrainState = { rise: 1, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1 }, heatSolvent: 0.5 };
  const sea = seaLevelFromHeights(sampleHeights(terrain, full, 64), Math.min(0.999, Math.max(0.001, opts.seaCover)));
  const spawn = spawnPoint(terrain, full, sea);

  const vis = (x: number, z: number) => {
    const dx = x - spawn.x, dz = z - spawn.z, d = Math.hypot(dx, dz) || 1;
    const dist = smoothstep(25, 70, d) * (1 - smoothstep(170, 260, d));
    const cone = clamp01((-dz / d + 0.25) / 1.0);       // camera yaw 0 looks down −z
    return dist * (0.25 + 0.75 * cone);
  };

  // candidate grid: ground at the end of the build and the machines' own contributions
  const step = 10;
  const lim = 0.45 * S;
  const m6 = P.machines.M6!, m2 = P.machines.M2!;
  const plainP = { ...P, piers: [] as typeof P.piers };
  const at = (x: number, z: number, p2: number, p6: number) => heightCore(plainP, 1, 0.5, p2, 0, 0, 0, p6, x, z);
  const samples: Sample[] = [];
  for (let z = -lim; z <= lim; z += step) {
    for (let x = -lim; x <= lim; x += step) {
      const gh = plainHeight(x, z, full);
      const base = at(x, z, 0, 0);
      samples.push({
        x, z, gh,
        c2: silicon && m2.rimHeight > 0 ? (at(x, z, 1, 0) - base) / m2.rimHeight : 0,
        c6: !silicon && m6.moundHeight > 0 ? (at(x, z, 0, 1) - base) / m6.moundHeight : 0,
        vis: vis(x, z),
      });
    }
  }

  const free = (x: number, z: number, sep: number) => taken.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + sep);
  /** Greedy best-first picks of `count` sites by score, each at least `sep` m (plus footprints) from everything placed. */
  const pick = (count: number, sep: number, score: (s: Sample) => number, min = 0.05): Sample[] => {
    const ranked = samples.map((s) => ({ s, v: score(s) })).filter((e) => e.v > min).sort((a, b) => b.v - a.v);
    const got: Sample[] = [];
    for (const { s } of ranked) {
      if (got.length >= count) break;
      if (!free(s.x, s.z, sep)) continue;
      got.push(s);
      taken.push({ x: s.x, z: s.z, r: 0 });
    }
    return got;
  };
  const inShallows = (gh: number) => (gh > sea - 7 && gh < sea + 2.5 ? 1 : 0.2);

  if (silicon) {
    // crystal columns where the M2 crust field peaks, at the sea margin
    for (const s of pick(5, 38, (e) => e.c2 * e.vis * inShallows(e.gh), 0.03)) {
      add('crystalCluster', s.x, s.z, between(14, 22), between(7, 10), 'M2', { biomass: true });
    }
  } else {
    // shell-stone reefs where the M6 mound field peaks, in the shallows: a small group of pillars (and every other site a stromatolite)
    const sites = pick(4, 34, (e) => e.c6 * e.vis * inShallows(e.gh), 0.03);
    sites.forEach((s, i) => {
      const n = 3;
      for (let k = 0; k < n; k++) {
        const a = rng() * TWO_PI, d = k === 0 ? 0 : between(6, 11);
        add('reefPillar', s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, between(16, 30) * (k === 0 ? 1.15 : 1), between(2.4, 3.8), 'M6', { biomass: true });
      }
      if (i % 2 === 0) {
        const a = rng() * TWO_PI;
        add('stromatolite', s.x + Math.cos(a) * 14, s.z + Math.sin(a) * 14, between(9, 14), between(5.5, 8.5), 'M6', { biomass: true });
      }
    });

    // hoodoo field: a cluster on the best upland site, then scattered around it
    const up = (e: Sample) => clamp01((e.gh - sea - 4) / 14);
    const centre = pick(1, 30, (e) => up(e) * e.vis * (0.3 + 0.7 * smoothstep(45, 90, Math.hypot(e.x - spawn.x, e.z - spawn.z))), 0.02)[0];
    if (centre) {
      for (let k = 0, tries = 0; k < 10 && tries < 60; tries++) {
        const a = rng() * TWO_PI, d = Math.sqrt(rng()) * 30;
        const x = centre.x + Math.cos(a) * d, z = centre.z + Math.sin(a) * d;
        if (Math.abs(x) > lim || Math.abs(z) > lim || !free(x, z, 6)) continue;
        add('hoodoo', x, z, between(14, 30), between(2.2, 3.6), 'M3', { heat: true });
        taken.push({ x, z, r: 3 });
        k++;
      }
    }

    // weathered stacks from the M5 strata, which show at any temperature
    for (const s of pick(5, 30, (e) => up(e) * e.vis, 0.02)) {
      add('rockStack', s.x, s.z, between(12, 22), between(4.2, 6.5), 'M5');
    }
  }

  // buttes on the horizon (carbon only): M5 strata, standing near the patch rim ahead of the spawn
  if (!silicon) {
    const base = -Math.PI / 2;
    [-0.75, 0.05, 0.8].forEach((off, i) => {
      const radius = between(22, 34), height = between(52, 78) * (i === 1 ? 1.1 : 1);
      let x = 0, z = 0;
      for (let t = 0; t < 24; t++) {                    // re-roll until clear of what is already placed
        const a = base + off + (rng() - 0.5) * (0.25 + 0.04 * t), d = between(0.37, 0.44) * S;
        x = Math.cos(a) * d; z = Math.sin(a) * d;
        if (free(x, z, radius + 4)) break;
      }
      add('butte', x, z, height, radius, 'M5');
    });
  }
  return out;
}
