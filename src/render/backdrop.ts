// Backdrop: decorative rings OUTSIDE the terrain patch so no view ends at an empty edge (the reference's background
// plane in a foreground / midground / background composition). Three draw calls:
//   1. landforms: two layers of strata-banded mesas and spires, plus two far mountain rings fading into the haze
//      (one merged mesh, rising with the terrain's `rise`, so it builds with the world);
//   2. giant plant silhouettes (instanced) that mirror the patch's own giants: none until land cells hold canopy that
//      can carry a giant, then as many as the patch's land canopy share and no taller than the flora's giants
//      (visibleGiants), only where their foot is above the sea;
//   (3. the terrain skirt itself lives in terrainNode.ts, on the real height function.)
// A pure, seeded function of the inputs: the layout depends only on the world's chemistry and the patch size, never on
// time. Never pickable. Colours are palette roles (PAL) through the world material, so star dimming and fog apply.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, float, mix, smoothstep, vec3, uniform, positionLocal } from 'three/tsl';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { makeRng, type Rng } from '../sim/rng';
import { worldMaterial, PAL } from './material';
import { lookKind } from './palette';
import { FLORA_GRID } from './layout';
import { cellSubmerged, floraBin, formForBin, type FloraForm } from './floraForm';
import { plantHeight } from './floraLib';
import { GIANT_CANOPY } from './floraLib/place';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

export interface Mesa { x: number; z: number; r: number; h: number; taper: number; seed: number }
export interface Ridge { R: number; depth: number; H: number; seed: number; tone: number }
/** `jitter` (0..1) varies the height inside the flora's giant band; `rank` (k / giants) is the land canopy share at
 * which this giant starts to grow, a seeded permutation so the ring fills evenly rather than one side first. */
export interface Giant { x: number; z: number; jitter: number; rank: number; seed: number }
export interface BackdropLayout { mesas: Mesa[]; ridges: Ridge[]; giants: Giant[] }
/** A giant to draw: its foot height `y` and its height `h` (m). */
export interface StandingGiant { x: number; z: number; y: number; h: number; seed: number }
/** The patch's land canopy (landCanopy): share of land cells that can hold a giant, and their mean canopy biomass. */
export interface LandCanopy { share: number; mean: number }
export const NO_CANOPY: LandCanopy = Object.freeze({ share: 0, mean: 0 });

/** Chebyshev distance from the patch centre: the patch is the square |x|, |z| ≤ patch/2. */
const cheb = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Distance from the patch centre (along the ray at `ang`) where a footprint of radius `foot` first clears the patch. */
function clearOut(ang: number, d: number, foot: number, half: number, margin: number): [number, number] {
  let x = Math.cos(ang) * d, z = Math.sin(ang) * d;
  while (cheb(x, z) - foot < half + margin) {
    d *= 1.06;
    x = Math.cos(ang) * d; z = Math.sin(ang) * d;
  }
  return [x, z];
}

/**
 * Seeded placement of every backdrop item, in metres around the patch centre. Pure: same chemistry + patch → same
 * layout. Every footprint lies outside the patch. Giants are placed always; visibleGiants() decides what is drawn.
 */
export function backdropLayout(kind: 'carbon' | 'silicon', patch: number): BackdropLayout {
  const rng = makeRng(kind === 'silicon' ? 2611 : 1108);
  const half = patch / 2;
  const margin = 0.03 * patch;
  const spireShare = kind === 'silicon' ? 0.4 : 0.15;   // silicon: relic-ice spires; carbon: the odd hoodoo stack
  const mesas: Mesa[] = [];
  const layer = (r: Rng, n: number, d0: number, d1: number, r0: number, r1: number, h0: number, h1: number) => {
    for (let i = 0; i < n; i++) {
      const ang = ((i + 0.15 + 0.7 * r()) / n) * Math.PI * 2;
      const spire = r() < spireShare;
      const rad = lerp(r0, r1, r()) * patch * (spire ? 0.45 : 1);
      const h = lerp(h0, h1, r()) * patch * (spire ? 1.25 : 1);
      const [x, z] = clearOut(ang, lerp(d0, d1, r()) * patch, rad * 2.5, half, margin);
      mesas.push({ x, z, r: rad, h, taper: spire ? 0.22 + 0.15 * r() : 0.72 + 0.15 * r(), seed: Math.floor(r() * 1e6) });
    }
  };
  layer(rng('backdrop:near'), 10, 0.78, 1.2, 0.04, 0.09, 0.18, 0.32);
  layer(rng('backdrop:far'), 13, 1.25, 1.9, 0.08, 0.16, 0.3, 0.55);
  const rr = rng('backdrop:ridges');
  const ridges: Ridge[] = [
    { R: 1.6 * patch, depth: 0.12 * patch, H: lerp(0.24, 0.3, rr()) * patch, seed: Math.floor(rr() * 1e6), tone: 0.55 },
    { R: 2.1 * patch, depth: 0.18 * patch, H: lerp(0.38, 0.46, rr()) * patch, seed: Math.floor(rr() * 1e6), tone: 0.4 },
  ];
  const rg = rng('backdrop:giants');
  const giants: Giant[] = [];
  const NG = 36;
  // growth order: a seeded permutation (own stream, so the positions below keep their draws)
  const order = Array.from({ length: NG }, (_, i) => i);
  const ro = rng('backdrop:giantOrder');
  for (let i = NG - 1; i > 0; i--) { const j = Math.floor(ro() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (let i = 0; i < NG; i++) {
    const ang = ((i + rg()) / NG) * Math.PI * 2;
    const jitter = rg();
    let [x, z] = clearOut(ang, lerp(0.62, 1.6, rg()) * patch, 0.02 * patch, half, 0.04 * patch);
    // keep clear of mesa footprints
    for (const m of mesas) {
      if (Math.hypot(x - m.x, z - m.z) < m.r * 1.8) [x, z] = clearOut(ang, Math.hypot(x, z) + m.r * 2.5, 0.02 * patch, half, 0.04 * patch);
    }
    giants.push({ x, z, jitter, rank: order[i] / NG, seed: Math.floor(rg() * 1e6) });
  }
  return { mesas, ridges, giants };
}

/**
 * Land mask over the flora grid: 1 where a cell is land, by the flora's own test (floraForm's cellSubmerged: the cell
 * centre against sea level), with cell centres on this patch. 4096 terrain samples: redo it only when the sea or the
 * relief moves.
 */
export function landMask(i: Pick<VisualInputs, 'terrain' | 'seaLevel'>, patch: number, out = new Uint8Array(FLORA_GRID * FLORA_GRID)): Uint8Array {
  const at = { terrain: { ...i.terrain, patchSize: patch }, seaLevel: i.seaLevel };
  for (let c = 0; c < out.length; c++) out[c] = cellSubmerged(c, at) ? 0 : 1;
  return out;
}

/**
 * The patch's land canopy from the flora grid ([mat, canopy] per cell): the share of land cells whose canopy can hold a
 * giant (≥ GIANT_CANOPY, the flora's own giant threshold), and the mean canopy of those cells. Pure; 0 with no land.
 */
export function landCanopy(flora: Float32Array, land: Uint8Array): LandCanopy {
  const cells = Math.min(flora.length >> 1, land.length);
  let nLand = 0, n = 0, sum = 0;
  for (let c = 0; c < cells; c++) {
    if (!land[c]) continue;
    nLand++;
    const canopy = flora[c * 2 + 1];
    if (canopy >= GIANT_CANOPY) { n++; sum += canopy; }
  }
  return n ? { share: n / nLand, mean: sum / n } : NO_CANOPY;
}

/**
 * The giants to draw, mirroring the patch's own giants (floraLib place.ts). None without land canopy (share 0, which
 * covers "no life on land"). Giant k of N starts to grow once the share passes its rank k / N and is full grown one
 * giant's share (1 / N) later, so the count (about share × N) and every height rise monotonically with the share. Full
 * height is the flora's giant height for the world's canopy form and the mean giant-cell canopy (plantHeight: inside
 * the giant band, cold → taller), so a backdrop giant never outgrows the patch's. Only feet above the sea.
 */
export function visibleGiants(
  layout: BackdropLayout, canopy: LandCanopy, form: FloraForm, heightAt: (x: number, z: number) => number, seaLevel: number,
): StandingGiant[] {
  if (!(canopy.share > 0)) return [];
  const N = layout.giants.length, out: StandingGiant[] = [];
  for (const g of layout.giants) {
    const ramp = Math.min(1, (canopy.share - g.rank) * N);
    if (ramp <= 0) continue;
    const y = heightAt(g.x, g.z);
    if (y <= seaLevel + 0.5) continue;
    // the same biomass a patch giant gets (place.ts: its cell's canopy × 2)
    out.push({ x: g.x, z: g.z, y, h: plantHeight('giant', form, canopy.mean * 2, g.jitter) * ramp, seed: g.seed });
  }
  return out;
}

// ---------------- geometry (aTone: 0 ink/maroon → 0.33 crimson → 0.66 red → 1 lit crest) ----------------

function hash(i: number, seed: number): number {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(seed | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise1(t: number, seed: number): number {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}
function fbm1(t: number, seed: number, oct = 4): number {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += noise1(t * f, seed + i * 17) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

/** Non-indexed, flat normals, with a per-vertex aTone from `toneOf`. */
function toned(g: THREE.BufferGeometry, toneOf: (p: THREE.Vector3, n: THREE.Vector3) => number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k);
  geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const tone = new Float32Array(pos.count);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    tone[i] = toneOf(p, n);
  }
  geo.setAttribute('aTone', new THREE.BufferAttribute(tone, 1));
  return geo;
}

/** Strata tone by height: three-band cycle with a little wobble (the reference's strata()). */
const strata = (y: number, h: number, seed: number) => {
  const b = Math.floor((y / h) * 9 + fbm1(y * 0.05, seed, 2) * 1.5);
  const k = ((b % 3) + 3) % 3;
  return k === 0 ? 0.4 : k === 1 ? 0.62 : 0.5;
};

/** Butte / mesa / spire: noisy column with stepped ledges, a talus flare at the foot and a flat top; base sunk. */
export function mesaGeometry(m: Mesa, sink: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(m.r * m.taper, m.r * 1.35, m.h, 28, 10, false);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const yN = (v.y + m.h / 2) / m.h;
    const rr = Math.hypot(v.x, v.z);
    if (rr > 1e-3) {
      const ang = Math.atan2(v.z, v.x);
      const ledge = Math.floor(yN * 6) / 6;
      const n = 1 + 0.22 * fbm1(ang * 2.2 + ledge * 5.7 + m.seed % 97, m.seed) + 0.05 * Math.sin(ledge * 23 + m.seed);
      const flare = 1 + 0.45 * (1 - Math.min(1, yN / 0.22) ** 2);
      v.x *= n * flare; v.z *= n * flare;
    }
    p.setXYZ(i, v.x + m.x, -sink + yN * m.h, v.z + m.z);
  }
  return toned(g, (pp, n) => (n.y > 0.7 ? 1 : strata(pp.y + sink, m.h, m.seed)));
}

/** A ring ridge at radius R around the patch: crest from ridged noise, sunk base, lit crests. */
export function ridgeGeometry(r: Ridge, sink: number): THREE.BufferGeometry {
  const NA = 200, NR = 6, pos: number[] = [], idx: number[] = [];
  const ridged = (t: number) => { const n = 1 - Math.abs(fbm1(t, r.seed, 5)); return n * n; };
  for (let i = 0; i <= NA; i++) {
    const a = (i / NA) * Math.PI * 2;
    const t = (i % NA) / NA * 40;             // wraps exactly at i = NA
    const crest = r.H * (0.3 + 0.9 * ridged(t)) * (0.7 + 0.3 * fbm1(t * 0.13 + 3, r.seed + 5, 2));
    for (let j = 0; j <= NR; j++) {
      const u = -1 + (2 * j) / NR;
      const R = r.R + u * r.depth;
      const prof = Math.max(0, 1 - u * u) ** 0.8;
      pos.push(Math.cos(a) * R, -sink + crest * prof, Math.sin(a) * R);
    }
  }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + 1, c = a + NR + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return toned(g, (_p, n) => (n.y > 0.85 ? 0.85 : r.tone));
}

/** One giant archetype at unit height, origin at the foot. Carbon: parasol titan; silicon: faceted crystal tower. */
export function giantGeometry(kind: 'carbon' | 'silicon'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, y: number, toneOf: (p: THREE.Vector3, n: THREE.Vector3) => number) => {
    g.translate(0, y, 0);
    parts.push(toned(g, toneOf));
  };
  // value inverts with height: ink/maroon foot, pale crests against the sky
  const stalkTone = (p: THREE.Vector3) => Math.min(0.5, p.y * 0.6);
  if (kind === 'silicon') {
    add(new THREE.CylinderGeometry(0.035, 0.06, 0.8, 6), 0.4, stalkTone);
    for (const [y, r, hh] of [[0.55, 0.16, 0.05], [0.72, 0.12, 0.05], [0.86, 0.08, 0.04]] as const) {
      add(new THREE.CylinderGeometry(r * 0.7, r, hh, 6), y, (_p, n) => (n.y > 0.5 ? 1 : n.y < -0.5 ? 0.33 : 0.66));
    }
    add(new THREE.ConeGeometry(0.03, 0.2, 6), 0.98, () => 1);
  } else {
    // slightly curved stalk from stacked frusta
    for (let i = 0; i < 6; i++) {
      const y0 = (i / 6) * 0.82;
      const g = new THREE.CylinderGeometry(0.03 - i * 0.002, 0.034 - i * 0.002, 0.82 / 6 + 0.002, 8);
      g.translate(Math.sin(i * 0.5) * 0.015, 0, 0);
      add(g, y0 + 0.82 / 12, stalkTone);
    }
    for (const [y, r] of [[0.66, 0.2], [0.78, 0.26], [0.9, 0.18]] as const) {
      // cupped disc: wide shallow frustum, crimson gill underside, bone top
      add(new THREE.CylinderGeometry(r, r * 0.35, 0.05, 14), y, (_p, n) => (n.y > 0.4 ? 1 : n.y < -0.4 ? 0.3 : 0.75));
    }
  }
  return mergeGeometries(parts, false);
}

// ---------------- the part ----------------

export interface BackdropPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  readonly giantsDrawn: number;
  dispose(): void;
}

export function createBackdrop(app: App): BackdropPart {
  const uRise = uniform(1);
  const tone = attribute('aTone', 'float');
  // tone ramp through the palette roles; crests lift toward blush like the reference
  const ramp: N = mix(
    mix(vec3(PAL.ink), vec3(PAL.maroon), smoothstep(0, 0.2, tone)),
    mix(mix(vec3(PAL.crimson), vec3(PAL.red), smoothstep(0.4, 0.62, tone)), mix(vec3(PAL.redLight), vec3(PAL.blush), 0.3), smoothstep(0.75, 1, tone)),
    smoothstep(0.15, 0.35, tone),
  );
  const landMat = worldMaterial({ kind: 'backdrop', colorNode: ramp, flat: true });
  // build: everything rises with the terrain; at rise 0 it sits just under the flat ground
  landMat.positionNode = vec3(positionLocal.x, positionLocal.y.mul(uRise).sub(float(1).sub(uRise).mul(3)), positionLocal.z);
  const giantMat = worldMaterial({ kind: 'backdrop', colorNode: ramp, flat: true });

  let land: THREE.Mesh | null = null;
  let giants: THREE.InstancedMesh | null = null;
  let layout: BackdropLayout | null = null;
  let builtKey = '';
  let landKey = '';
  const landCells = new Uint8Array(FLORA_GRID * FLORA_GRID);
  let lastFlora: Float32Array | null = null, lastLife = false;
  let grow = 0;
  let drawn: StandingGiant[] = [];
  let drawnCount = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  function rebuild(kind: 'carbon' | 'silicon', patch: number) {
    dispose();
    layout = backdropLayout(kind, patch);
    const sink = 0.08 * patch;
    const geos = [...layout.mesas.map((m) => mesaGeometry(m, sink)), ...layout.ridges.map((r) => ridgeGeometry(r, sink * 1.5))];
    land = new THREE.Mesh(mergeGeometries(geos, false), landMat);
    land.frustumCulled = false;
    land.raycast = () => {};
    land.name = 'backdrop';
    geos.forEach((g) => g.dispose());
    app.scene.add(land);
    giants = new THREE.InstancedMesh(giantGeometry(kind), giantMat, layout.giants.length);
    giants.frustumCulled = false;
    giants.raycast = () => {};
    giants.count = 0;
    giants.name = 'backdropGiants';
    app.scene.add(giants);
    landKey = ''; lastFlora = null; drawn = []; grow = 0;
  }

  function dispose() {
    if (land) { app.scene.remove(land); land.geometry.dispose(); land = null; }
    if (giants) { app.scene.remove(giants); giants.geometry.dispose(); giants.dispose(); giants = null; }
  }

  return {
    get giantsDrawn() { return drawnCount; },
    update(dt, _t, inputs, patch) {
      const kind = lookKind(inputs.world.composition);
      const key = `${kind}|${patch}`;
      if (key !== builtKey) { builtKey = key; rebuild(kind, patch); }
      uRise.value = inputs.terrain.rise;
      if (!giants || !layout) return;

      // Which giants stand, and how tall: from the patch's land canopy, re-evaluated only when the flora grid, life on
      // land, or the land under the grid (sea level, relief) changes, never per frame. The land mask is the costly
      // part (a terrain sample per cell), so it waits for the sea or the relief to move noticeably.
      let dirty = false;
      let landMoved = false;
      if (inputs.lifeOnLand) {
        const lk = `${Math.round(inputs.seaLevel * 4)}|${Math.round(inputs.terrain.rise * 50)}`;
        if (lk !== landKey) { landKey = lk; landMask(inputs, patch, landCells); landMoved = true; }
      }
      if (inputs.flora !== lastFlora || inputs.lifeOnLand !== lastLife || landMoved) {
        lastFlora = inputs.flora; lastLife = inputs.lifeOnLand;
        const canopy = inputs.lifeOnLand ? landCanopy(inputs.flora, landCells) : NO_CANOPY;
        // the world's canopy form: plantHeight reads only its heat-band height scale
        const next = canopy.share > 0 ? visibleGiants(layout, canopy, formForBin(floraBin(0, 1, inputs)), inputs.terrain.height, inputs.seaLevel) : [];
        if (next.length || drawn.length) dirty = true; // nothing to rewrite while no giant stands
        drawn = next;
        if (!inputs.lifeOnLand) grow = 0;
      }
      // grow in over ~3 s once life reaches land (render easing only)
      const target = drawn.length > 0 ? 1 : 0;
      if (grow !== target) {
        grow += (target - grow) * (1 - Math.exp(-dt / 1.2));
        if (Math.abs(grow - target) < 1e-3) grow = target;
        dirty = true;
      }
      if (!dirty) return;
      drawnCount = grow > 0 ? drawn.length : 0;
      giants.count = drawnCount;
      for (let i = 0; i < drawnCount; i++) {
        const g = drawn[i];
        p.set(g.x, g.y - 0.5, g.z);
        q.setFromAxisAngle(up, (g.seed % 628) / 100);
        s.setScalar(g.h * grow);
        giants.setMatrixAt(i, m4.compose(p, q, s));
      }
      giants.instanceMatrix.needsUpdate = true;
    },
    dispose,
  };
}
