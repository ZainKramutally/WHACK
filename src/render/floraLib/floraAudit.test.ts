// Flora asset audit (headless): every archetype × LOD × world palette must be visible, on the ground, lit the right
// way and coloured; and plants must sit on the terrain the GPU draws (same height and rise, slopes, the sea).
// The audits take ~1.6 s, so they run with SLOW=1 (CLAUDE.md: tests over 1 s); the default run keeps the cheap check
// that place.ts samples the same triangles the terrain mesh draws. FLORA_AUDIT=1 also prints the tables.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildFloraLibrary, paint, archetypesFor, type FloraLibrary, type FloraPalette } from './index';
import { LOOK_PALETTES } from '../palette';
import { makeStubVisualInputs } from '../visualInputs';
import { createTerrain, seaLevelForCover, spawnPoint, type Terrain, type TerrainState } from '../../gen/terrain';
import { carbon } from '../../worlds/carbon';
import { silicon } from '../../worlds/silicon';
import type { VisualInputs, WorldConfig } from '../../worlds/types';
import { TERRAIN_SEGMENTS, makeHeightCache, makePlantList, placePlants } from './place';
import { createTerrainMesh, createTerrainUniforms } from '../terrainNode';
import { floraBin, formForBin } from '../floraForm';
import { FLORA_GRID } from '../layout';
import { createFlora } from '../flora';
import { GATES } from './gates';
import type { App } from '../app';

const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const SLOW = !!ENV?.SLOW;
/** FLORA_AUDIT=1 prints the per-archetype tables. */
const VERBOSE = !!ENV?.FLORA_AUDIT;
const PALS: Record<'carbon' | 'silicon', FloraPalette> = { carbon: LOOK_PALETTES.carbon, silicon: LOOK_PALETTES.silicon };
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

let lib: FloraLibrary;
const loadLib = () => { lib ??= buildFloraLibrary(0x5eed_f10a); };

interface GeoStats {
  verts: number; tris: number; badPos: number; badNor: number; degenerate: number; agree: number; volume: number; front: number;
  minY: number; maxY: number; footR: number;
}

function geoStats(g: THREE.BufferGeometry): GeoStats {
  const pos = g.getAttribute('position').array as Float32Array;
  const nor = g.getAttribute('normal').array as Float32Array;
  const idx = g.index ? (g.index.array as ArrayLike<number>) : null;
  const nv = pos.length / 3, nt = idx ? idx.length / 3 : nv / 3;
  let badPos = 0, badNor = 0, minY = Infinity, maxY = -Infinity;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (!Number.isFinite(x + y + z)) badPos++;
    const l = Math.hypot(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
    if (!(Math.abs(l - 1) < 0.02)) badNor++;
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const H = maxY - minY;
  let footR = 0;
  for (let v = 0; v < nv; v++) if (pos[v * 3 + 1] - minY < 0.03 * H) footR = Math.max(footR, Math.hypot(pos[v * 3], pos[v * 3 + 2]));
  let degenerate = 0, agreeA = 0, areaA = 0, vol = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let t = 0; t < nt; t++) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3); c.fromArray(pos, i2 * 3);
    e1.subVectors(b, a); e2.subVectors(c, a);
    const fn = new THREE.Vector3().crossVectors(e1, e2);
    const area = fn.length() / 2;
    vol += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    if (area < 1e-9 * H * H) { degenerate++; continue; }
    n.fromArray(nor, i0 * 3).add(e1.fromArray(nor, i1 * 3)).add(e2.fromArray(nor, i2 * 3));
    areaA += area;
    if (fn.dot(n) > 0) agreeA += area;
  }
  return { verts: nv, tris: nt, badPos, badNor, degenerate, agree: areaA > 0 ? agreeA / areaA : 0, volume: vol, minY, maxY, footR, front: frontShare(pos, idx, nt) };
}

/** Share of first hits that land on a front face (winding normal toward the viewer), for rays from four sides and
 * the top. A part built inside out shows its back faces first. */
function frontShare(pos: Float32Array, idx: ArrayLike<number> | null, nt: number): number {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < pos.length; v++) { lo[v % 3] = Math.min(lo[v % 3], pos[v]); hi[v % 3] = Math.max(hi[v % 3], pos[v]); }
  const vi = (t: number, k: number) => (idx ? idx[t * 3 + k] : t * 3 + k) * 3;
  let hits = 0, front = 0;
  const N = 5;
  for (const [ax, sgn] of [[0, 1], [0, -1], [2, 1], [2, -1], [1, -1]] as const) {
    const [u, w] = ax === 1 ? [0, 2] : ax === 0 ? [1, 2] : [0, 1];
    for (let a = 0; a < N; a++) for (let c = 0; c < N; c++) {
      const o = [0, 0, 0], d = [0, 0, 0];
      o[u] = lo[u] + ((a + 0.5) / N) * (hi[u] - lo[u]); o[w] = lo[w] + ((c + 0.5) / N) * (hi[w] - lo[w]);
      o[ax] = sgn > 0 ? lo[ax] - 1 : hi[ax] + 1; d[ax] = sgn;
      let best = Infinity, bestDot = 0;
      for (let t = 0; t < nt; t++) {
        const i0 = vi(t, 0), i1 = vi(t, 1), i2 = vi(t, 2);
        const e1 = [pos[i1] - pos[i0], pos[i1 + 1] - pos[i0 + 1], pos[i1 + 2] - pos[i0 + 2]];
        const e2 = [pos[i2] - pos[i0], pos[i2 + 1] - pos[i0 + 1], pos[i2 + 2] - pos[i0 + 2]];
        const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
        const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
        if (Math.abs(det) < 1e-12) continue;
        const tv = [o[0] - pos[i0], o[1] - pos[i0 + 1], o[2] - pos[i0 + 2]];
        const uu = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det;
        if (uu < 0 || uu > 1) continue;
        const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
        const vv = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
        if (vv < 0 || uu + vv > 1) continue;
        const dist = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
        if (dist > 0 && dist < best) { best = dist; bestDot = -det; } // −det = (e1 × e2)·d: < 0 when the face looks at the ray
      }
      if (best < Infinity) { hits++; if (bestDot < 0) front++; }
    }
  }
  return hits ? front / hits : 1;
}

/** Area-weighted luminance of the painted colours: whole plant, upper half, and the share of near-black (ink) area. */
function colourStats(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position').array as Float32Array;
  const col = g.getAttribute('color').array as Float32Array;
  const idx = g.index ? (g.index.array as ArrayLike<number>) : null;
  const nt = idx ? idx.length / 3 : pos.length / 9;
  let maxY = 0;
  for (let v = 1; v < pos.length; v += 3) maxY = Math.max(maxY, pos[v]);
  let A = 0, L = 0, Atop = 0, Ltop = 0, black = 0;
  const p = [0, 0, 0].map(() => new THREE.Vector3());
  for (let t = 0; t < nt; t++) {
    const ii = [0, 1, 2].map((k) => (idx ? idx[t * 3 + k] : t * 3 + k));
    ii.forEach((v, k) => p[k].fromArray(pos, v * 3));
    const area = new THREE.Vector3().crossVectors(p[1].clone().sub(p[0]), p[2].clone().sub(p[0])).length() / 2;
    const l = ii.reduce((s, v) => s + lum(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]), 0) / 3;
    A += area; L += area * l;
    if (l < 0.012) black += area;
    if ((p[0].y + p[1].y + p[2].y) / 3 > 0.5 * maxY) { Atop += area; Ltop += area * l; }
  }
  return { mean: L / A, top: Atop > 0 ? Ltop / Atop : L / A, black: black / A };
}

describe.skipIf(!SLOW)('flora asset audit: geometry (SLOW)', () => {
  beforeAll(loadLib);
  it('every archetype × LOD is non-empty, finite, unit-normalled, wound with its normals, outward and grounded', () => {
    const rows: string[] = [], fails: string[] = [];
    for (const a of lib.archetypes) for (const lod of [0, 1] as const) {
      const s = geoStats(a.lod[lod].geometry);
      const check = (cond: boolean, what: string) => { if (!cond) fails.push(`${a.key} L${lod}: ${what}`); };
      const ok = s.verts > 0 && s.tris > 0 && s.badPos === 0 && s.badNor === 0 && s.degenerate < 0.5 * s.tris && s.agree > 0.97 && s.front > 0.85 && Math.abs(s.minY) < 1e-4 && s.maxY > 0.9 * a.height;
      rows.push(`${a.key.padEnd(16)} L${lod} v${String(s.verts).padStart(5)} t${String(s.tris).padStart(5)} badN ${s.badNor} degen ${s.degenerate} agree ${s.agree.toFixed(3)} front ${(100 * s.front).toFixed(0)}% minY ${s.minY.toFixed(4)} h ${a.height.toFixed(2)} foot ${(s.footR / a.size).toFixed(3)}·size ${ok ? 'OK' : 'FAIL'}`);
      check(s.verts > 0 && s.tris > 0, 'empty');
      check(s.badPos === 0, `${s.badPos} non-finite positions`);
      check(s.badNor === 0, `${s.badNor} zero or non-unit normals`);
      check(s.degenerate < 0.5 * s.tris, `${s.degenerate}/${s.tris} degenerate triangles`);
      check(s.agree > 0.97, `winding agrees with normals on only ${(100 * s.agree).toFixed(1)}% of the area`);
      check(s.front > 0.85, `inside-out: only ${(100 * s.front).toFixed(0)}% of first hits are front faces`);
      check(Math.abs(s.minY) < 1e-4, `base at y ${s.minY}`);
    }
    if (VERBOSE) console.log(rows.join('\n'));
    expect(fails).toEqual([]);
  });

  it('paints visible colour in both palettes (dark foreground step darker, never black); glow and sway in 0..1', () => {
    const rows: string[] = [], fails: string[] = [];
    for (const a of lib.archetypes) for (const lod of [0, 1] as const) for (const chem of ['carbon', 'silicon'] as const) for (const dark of [false, true]) {
      if (dark && (a.role !== 'ground' || lod === 1)) continue;
      const built = a.lod[lod];
      const g = built.geometry.clone();
      paint({ ...built, geometry: g }, PALS[chem], 1, dark);
      const c = colourStats(g);
      const glow = g.getAttribute('aGlow').array as Float32Array, sway = g.getAttribute('aSway').array as Float32Array;
      expect(g.getAttribute('color').count, a.key).toBe(g.getAttribute('position').count);
      expect(glow.length, a.key).toBe(g.getAttribute('position').count);
      expect(sway.length, a.key).toBe(g.getAttribute('position').count);
      expect(Math.min(...glow) >= 0 && Math.max(...glow) <= 1, `${a.key} aGlow range`).toBe(true);
      expect(Math.min(...sway) >= 0 && Math.max(...sway) <= 1, `${a.key} aSway range`).toBe(true);
      rows.push(`${a.key.padEnd(16)} L${lod} ${chem.padEnd(7)} ${dark ? 'dark' : '    '} mean ${c.mean.toFixed(3)} top ${c.top.toFixed(3)} ink-area ${(100 * c.black).toFixed(0)}%`);
      // floors: a plant reads as a form, not a black blob, at least in its upper half (value inverts with height)
      const tag = `${a.key} L${lod} ${chem}${dark ? ' dark' : ''}`;
      if (!(c.mean > (dark ? 0.02 : 0.04))) fails.push(`${tag}: mean luminance ${c.mean.toFixed(3)}`);
      if (!(c.top > (dark ? 0.025 : 0.05))) fails.push(`${tag}: top luminance ${c.top.toFixed(3)}`);
      if (!(c.black < (dark ? 0.6 : 0.5))) fails.push(`${tag}: ${(100 * c.black).toFixed(0)}% of the area is ink`);
      g.dispose();
    }
    if (VERBOSE) console.log(rows.join('\n'));
    expect(fails).toEqual([]);
  });
});

// ---- placement on the real terrain ---------------------------------------------------------------------------------

const PATCH = 400;

interface WorldCase { world: WorldConfig; terrain: Terrain; state: (p: number) => TerrainState; sea: number; tempC: number; light: number }
function worldCase(world: WorldConfig): WorldCase {
  const terrain = createTerrain(world.terrain, world.demoSeed);
  const tempC = world.startDefaults.temperature;
  const hs = Math.min(1, Math.max(0, 0.5 + (tempC - world.solvent.freezeC) / world.terrain.heatSolventSpan));
  const state = (p: number): TerrainState => ({ rise: p, heatSolvent: hs, progress: Object.fromEntries(world.terrain.machines.map((m) => [m.id, p])) });
  const cover = (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200;
  return { world, terrain, state, sea: seaLevelForCover(terrain, state(1), cover), tempC, light: world.id === 'silicon' ? 0.016 : 1 };
}

function inputsFor(w: WorldCase, p: number, flora: Float32Array, sea = w.sea * p): VisualInputs {
  const stub = makeStubVisualInputs();
  const st = w.state(p);
  return {
    ...stub,
    world: { ...stub.world, id: w.world.id, solvent: w.world.solvent, composition: w.world.life.composition },
    light: w.light, heatSolvent: st.heatSolvent, buildProgress: p, seaLevel: sea,
    stats: { ...stub.stats, temperature: w.tempC, seaLevel: sea },
    terrain: { rise: p, progress: st.progress as Record<string, number>, height: (x, z) => w.terrain.height(x, z, st), patchSize: PATCH },
    flora, lifeOnLand: true,
  };
}

/** Flora everywhere: a checkerboard of mat-dominant cells (tufts, domes, crusts) and mixed cells (groves, giants). */
const floraGrid = () => {
  const f = new Float32Array(FLORA_GRID * FLORA_GRID * 2);
  for (let c = 0; c < FLORA_GRID * FLORA_GRID; c++) {
    const mixed = ((c % FLORA_GRID) + Math.floor(c / FLORA_GRID)) % 2 === 0;
    f[c * 2] = mixed ? 0.7 : 1; f[c * 2 + 1] = mixed ? 0.5 : 0.05;
  }
  return f;
};

/** The GPU terrain mesh's surface: heights at its (TERRAIN_SEGMENTS + 1)² vertices, linear on its (a,b,d), (b,c,d) triangles. */
function drawnGround(H: (x: number, z: number) => number) {
  const S = TERRAIN_SEGMENTS, e = PATCH / S, n = S + 1, v = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) v[j * n + i] = H(i * e - PATCH / 2, j * e - PATCH / 2);
  return (x: number, z: number) => {
    const fi = (x + PATCH / 2) / e, fj = (z + PATCH / 2) / e;
    const i = Math.min(S - 1, Math.max(0, Math.floor(fi))), j = Math.min(S - 1, Math.max(0, Math.floor(fj)));
    const fx = fi - i, fz = fj - j, ha = v[j * n + i], hb = v[(j + 1) * n + i], hc = v[(j + 1) * n + i + 1], hd = v[j * n + i + 1];
    return fx + fz <= 1 ? ha + fx * (hd - ha) + fz * (hb - ha) : hc + (1 - fx) * (hb - hc) + (1 - fz) * (hd - hc);
  };
}

const pct = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

interface Gaps { float: number[]; buried: number[]; n: number }
/** For every drawn instance: the worst float of its contact ring above the drawn ground, and how deep its centre sits
 * below it, both as a share of the instance's height. */
function measure(group: THREE.Object3D, ground: (x: number, z: number) => number): Record<string, Gaps> {
  group.updateMatrixWorld(true);
  const out: Record<string, Gaps> = { ground: { float: [], buried: [], n: 0 }, mid: { float: [], buried: [], n: 0 }, giant: { float: [], buried: [], n: 0 } };
  const m = new THREE.Matrix4(), v = new THREE.Vector3(), o = new THREE.Vector3(), top = new THREE.Vector3();
  for (const obj of group.children) {
    const mesh = obj as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh || !mesh.visible || !mesh.count || mesh.position.y < -100) continue;
    const a = lib.byKey.get(mesh.name.split('/')[0]);
    if (!a) continue;
    const pos = mesh.geometry.getAttribute('position').array as Float32Array;
    const ring: number[] = [];
    let maxY = 0;
    for (let k = 1; k < pos.length; k += 3) maxY = Math.max(maxY, pos[k]);
    for (let k = 0; k < pos.length; k += 3) if (pos[k + 1] < 0.03 * maxY) ring.push(k);
    for (let k = 0; k < mesh.count; k++) {
      mesh.getMatrixAt(k, m);
      m.premultiply(group.matrixWorld);
      o.set(0, 0, 0).applyMatrix4(m); top.set(0, maxY, 0).applyMatrix4(m);
      const h = top.distanceTo(o);
      let worst = -Infinity;
      for (const r of ring) { v.fromArray(pos, r).applyMatrix4(m); worst = Math.max(worst, -(ground(v.x, v.z) - v.y)); }
      const g = out[a.role];
      g.n++;
      g.float.push(Math.max(0, worst) / h);
      g.buried.push((ground(o.x, o.z) - o.y) / h);
    }
  }
  return out;
}

function fakeApp(x: number, y: number, z: number): App {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  camera.position.set(x, y, z);
  camera.lookAt(x, y, z - 10);
  return { scene: new THREE.Scene(), camera } as unknown as App;
}

/** Mids built for the sea (flora-traits A5, A8): the only ones allowed below it. */
const AQUATIC = new Set(['bladderKelp#0', 'whiskerReef#0']);
const caseMemo = new Map<string, WorldCase>();
const caseOf = (world: WorldConfig) => { let c = caseMemo.get(world.id); if (!c) caseMemo.set(world.id, (c = worldCase(world))); return c; };
const WORLDS = [carbon, silicon].map((w) => [w.id, w] as const);

describe('flora asset audit: placement and wiring', () => {
  it('TERRAIN_SEGMENTS matches the terrain mesh flora stands on', () => {
    const mesh = createTerrainMesh(createTerrain(carbon.terrain, carbon.demoSeed), createTerrainUniforms());
    expect(mesh.geometry.getAttribute('position').count).toBe((TERRAIN_SEGMENTS + 1) ** 2);
  });
});

describe.skipIf(!SLOW)('flora asset audit: placement and wiring (SLOW)', () => {
  beforeAll(loadLib);
  const shown = (r: Record<string, Gaps>) => Object.entries(r).map(([k, v]) => `${k}: n ${v.n} float p90 ${pct(v.float, 0.9).toFixed(3)} p99 ${pct(v.float, 0.99).toFixed(3)} max ${pct(v.float, 1).toFixed(3)}; buried p90 ${pct(v.buried, 0.9).toFixed(3)} max ${pct(v.buried, 1).toFixed(3)} (× height)`).join('\n  ');

  it.each(WORLDS)('%s: every drawn plant meets the drawn ground (slopes, mesh facets), and the stale-rise stretch keeps it there', (_id, world) => {
    const w = caseOf(world);
    const sp = spawnPoint(w.terrain, w.state(1), w.sea);
    const app = fakeApp(sp.x, sp.height + 3, sp.z + 6);
    const flora = createFlora(app);
    const group = app.scene.getObjectByName('flora')!;
    const grid = floraGrid();
    expect(group.scale.y).toBe(1);
    // built world
    const inp = inputsFor(w, 1, grid);
    flora.update(0, 1, inp, PATCH);
    const done = measure(group, drawnGround(inp.terrain.height));
    flora.dispose();
    // mid-build (20 s build: rise 0.0125 per 0.25 s rebuild): rebuilds from life (0.45) to 0.6, then a frame 0.2 s on,
    // before the next rebuild, while the terrain keeps rising
    const app2 = fakeApp(sp.x, sp.height + 3, sp.z + 6);
    const flora2 = createFlora(app2);
    let t = 10, p = 0.45;
    for (; p <= 0.6; p += 0.0125, t += 0.25) flora2.update(0, t, inputsFor(w, p, grid), PATCH);
    const later = inputsFor(w, p - 0.0125 + 0.01, grid);
    flora2.update(0, t - 0.25 + 0.2, later, PATCH);
    const mid = measure(app2.scene.getObjectByName('flora')!, drawnGround(later.terrain.height));
    if (VERBOSE) console.log(`${w.world.id} plants ${flora.plants} dropped ${flora.dropped}\n  built:\n  ${shown(done)}\n  mid-build, between rebuilds:\n  ${shown(mid)}`);
    expect(flora.dropped).toBe(0);
    for (const r of [done, mid]) for (const [role, v] of Object.entries(r)) {
      expect(v.n, role).toBeGreaterThan(0);
      expect(pct(v.float, 0.9), `${role} p90 float`).toBeLessThan(0.03);
      expect(pct(v.float, 0.99), `${role} p99 float`).toBeLessThan(0.12);
      expect(pct(v.buried, 0.9), `${role} p90 buried`).toBeLessThan(0.2);
      expect(pct(v.buried, 1), `${role} max buried`).toBeLessThan(0.45);
    }
    flora2.dispose();
  });

  it.each(WORLDS)('%s: every bucket the flora draws carries the attributes its material reads, painted', (_id, world) => {
    const w = caseOf(world);
    const sp = spawnPoint(w.terrain, w.state(1), w.sea);
    const app = fakeApp(sp.x, sp.height + 3, sp.z + 6);
    const flora = createFlora(app);
    flora.update(0, 1, inputsFor(w, 1, floraGrid()), PATCH);
    const fails: string[] = [];
    for (const obj of app.scene.getObjectByName('flora')!.children) {
      const mesh = obj as THREE.InstancedMesh;
      const g = mesh.geometry, mat = mesh.material as THREE.Material & { vertexColors: boolean };
      const n = g.getAttribute('position').count;
      // (aPart is source data off the drawn geometry until a material reads it: floraLibrary() keeps it in BuiltPlant.part)
      for (const [name, size] of [['color', 3], ['aGlow', 1], ['aSway', 1], ['normal', 3]] as const) {
        const at = g.getAttribute(name);
        if (!at || at.itemSize !== size || at.count !== n) fails.push(`${mesh.name}: attribute ${name}`);
      }
      if (!mat.vertexColors) fails.push(`${mesh.name}: material ignores vertex colours`);
      if (mat.side !== THREE.DoubleSide) fails.push(`${mesh.name}: single-sided`);
      if (mesh.visible && mesh.count && mesh.position.y > -100) {
        const c = g.getAttribute('color').array as Float32Array;
        let L = 0;
        for (let k = 0; k < c.length; k += 3) L += lum(c[k], c[k + 1], c[k + 2]);
        if (!(L / n > 0.01)) fails.push(`${mesh.name}: drawn unpainted (black), mean luminance ${(L / n).toFixed(4)}`);
      }
    }
    expect(fails).toEqual([]);
    flora.dispose();
  });

  it.each(WORLDS)('%s: ground cover keeps to its side of the sea; no land plant stands in it', (_id, world) => {
    const w = caseOf(world);
    const inp = inputsFor(w, 1, floraGrid());
    const sp = spawnPoint(w.terrain, w.state(1), w.sea);
    const list = placePlants(inp, PATCH, { x: sp.x, z: sp.z }, makePlantList());
    let wrong = 0, landUnder = 0, ground = 0, under = 0;
    for (let i = 0; i < list.n; i++) {
      const a = lib.archetypes[list.arch[i]];
      const wet = list.y[i] < w.sea;
      if (a.role !== 'ground') { if (wet && !AQUATIC.has(a.key)) landUnder++; continue; }
      ground++; if (wet) under++;
      const c = Math.floor((list.z[i] / PATCH + 0.5) * FLORA_GRID) * FLORA_GRID + Math.floor((list.x[i] / PATCH + 0.5) * FLORA_GRID);
      const bin = floraBin(inp.flora[c * 2], inp.flora[c * 2 + 1], inp, wet);
      const row = archetypesFor(formForBin(bin), 'ground', bin.light === 2);
      // a gated archetype (gates.ts) stands in for an entry of the row it replaces
      if (!row.includes(a.key) && !GATES.some((g) => g.by === a.key && row.some((k) => g.replaces.test(k)))) wrong++;
    }
    if (VERBOSE) console.log(`${w.world.id} ground ${ground} (${under} under the sea), off their side ${wrong}`);
    expect(under).toBeGreaterThan(0);
    expect(landUnder).toBe(0);
    expect(wrong).toBe(0);
  });

  it.each(WORLDS)('%s: cached heights follow the rising terrain during the build', (_id, world) => {
    const w = caseOf(world);
    const flora = floraGrid();
    const cache = makeHeightCache();
    const list = makePlantList();
    let p = 0.5;
    for (; p <= 0.7; p += 0.0125) placePlants(inputsFor(w, p, flora), PATCH, { x: 0, z: 0 }, list, cache);
    const inp = inputsFor(w, p, flora);
    placePlants(inp, PATCH, { x: 0, z: 0 }, list, cache);
    const ground = drawnGround(inp.terrain.height);
    let worst = 0;
    for (let i = 0; i < list.n; i++) worst = Math.max(worst, Math.abs(list.y[i] - ground(list.x[i], list.z[i])));
    if (VERBOSE) console.log(`${w.world.id} cache drift max ${worst.toFixed(4)} m`);
    expect(worst).toBeLessThan(0.01);
  });
});
