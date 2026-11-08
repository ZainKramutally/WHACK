// Plants from the per-cell flora grid ([mat, canopy] per cell, 64² cells). A cell with no biomass draws nothing, so
// nothing appears before life. Shapes come from the Red World archetype library (floraLib/, built once at startup);
// which archetype, how big and how many is a pure function of floraForm(cell, inputs), the biomass and the camera
// position (floraLib/place.ts). Drawn as one InstancedMesh per archetype × LOD × value step (floraLib/buckets.ts), not
// chunked and not frustum-culled: from inside the patch every chunk is partly in view, so chunks only multiplied draw
// calls. Rebuilt a few times a second during the build, about once a second live, and when the camera has moved.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { buildFloraLibrary, paint, type Archetype, type FloraPalette } from './floraLib';
import { worldMaterial } from './material';
import { LOOK_PALETTES, lookKind } from './palette';
import { makeHeightCache, makePlantList, placePlants, resetHeightCache, type Clearing } from './floraLib/place';
import { BUCKET_IDS, bucketDefs, bucketId } from './floraLib/buckets';
import { rayPlants } from './floraHit';
import { cellAt, type Vec3 } from './layout';

const LIB_SEED = 0x5eed_f10a;
const REBUILD_EVERY = 0.25; // s while the world builds
const REBUILD_EVERY_LIVE = 1; // s afterwards: biomass drifts slowly
const CAMERA_MOVE = 6; // m of camera travel that forces a rebuild (foreground density and LOD follow the camera)
const UP = new THREE.Vector3(0, 1, 0);
/** Radius (m) of the spawn clearing: ground cover only, so the spawn frame opens onto groves and giants. */
const CLEARING_R = 25;
/** Fallback until setClearing is wired: latch the clearing where the camera looks once the character has spawned. */
const LATCH_AT_PROGRESS = 0.35, LATCH_AHEAD = 8;

export interface FloraPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Number of plants drawn at the last rebuild. */
  plants: number;
  /** Triangles submitted at the last rebuild (buckets are not culled: every one in use is drawn). */
  triangles: number;
  /** ms spent in the last rebuild. */
  rebuildMs: number;
  /** Plants placed but not drawn at the last rebuild because their bucket was full. */
  dropped: number;
  /** Keep a disc free of mid and giant plants (the spawn point; radius default 25 m). null: back to the fallback. */
  setClearing(x: number, z: number, r?: number): void;
  /** Nearest drawn plant under a ray (world space, normalised direction): its flora cell, distance and bounds. Read-only. */
  hit(origin: Vec3, dir: Vec3): { cell: number; dist: number; x: number; y: number; z: number; height: number; radius: number } | null;
  dispose(): void;
}

/** A painted geometry: one archetype × LOD × value step, shared by every chunk mesh that draws it. */
interface Look {
  arch: Archetype;
  lod: 0 | 1;
  dark: boolean;
  geometry: THREE.BufferGeometry;
  painted: { pal: FloraPalette | null; glow: number };
}

interface Bucket {
  mesh: THREE.InstancedMesh;
  /** Fixed instance capacity (allocated once). */
  cap: number;
}

export function createFlora(app: App): FloraPart {
  const lib = buildFloraLibrary(LIB_SEED);
  // The world material for every plant (cel terminator, translucency, fog, sway from aSway, HDR glow from aGlow).
  // Two-sided: rib-fan webs, sieve plates and parasol discs are open sheets. Near-LOD mid and giant plants carry the
  // focus cut-out (they dither out on the camera→player line); ground cover (≤ 2 m) and far-LOD plants (beyond 40 m
  // for mids, 90 m for giants) can't hide the player, so they skip it: its discard costs early-z on every fragment.
  const FLORA_MAT = { kind: 'flora', vertexColors: true, glowAttr: 'aGlow', swayAttr: 'aSway', translucent: true, side: THREE.DoubleSide } as const;
  const material = worldMaterial({ ...FLORA_MAT, cutout: true });
  const materialNoCut = worldMaterial({ ...FLORA_MAT, cutout: false });
  const materialFor = (role: string, lod: number) => (role !== 'ground' && lod === 0 ? material : materialNoCut);
  // Vertex colours are the unmodulated look palette; the material applies the star (palette.ts LOOK_PALETTES).
  const PALETTES: Record<'carbon' | 'silicon', FloraPalette> = { carbon: LOOK_PALETTES.carbon, silicon: LOOK_PALETTES.silicon };
  const group = new THREE.Group();
  group.name = 'flora';
  app.scene.add(group);

  const looks: Look[] = [];
  const lookOf = (arch: number, lod: number, dark: number): Look => {
    const id = bucketId(arch, lod, dark);
    let L = looks[id];
    if (!L) {
      const a = lib.archetypes[arch];
      const built = a.lod[lod];
      // the dark (foreground) step needs its own colour array; everything else is shared
      const geometry = dark ? built.geometry.clone() : built.geometry;
      L = looks[id] = { arch: a, lod: lod as 0 | 1, dark: !!dark, geometry, painted: { pal: null, glow: -1 } };
    }
    return L;
  };

  // Every bucket (archetype × LOD × value step, floraLib/buckets.ts) is created here, once, with a fixed capacity by
  // role, so a rebuild only writes instance buffers: it never creates a mesh or triggers a compile. Overflow is dropped
  // (and counted). A bucket is one draw call while it has plants; it is never culled (it spans the camera's surroundings).
  const buckets = new Map<number, Bucket>();
  for (const d of bucketDefs()) {
    const L = lookOf(d.arch, d.lod, d.dark);
    const mesh = new THREE.InstancedMesh(L.geometry, materialFor(d.role, d.lod), d.cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.name = `${L.arch.key}/L${d.lod}${d.dark ? 'd' : ''}`;
    group.add(mesh);
    buckets.set(d.id, { mesh, cap: d.cap });
  }

  // Warm-up: a carbon and a silicon mesh per material, a single invisible-sized instance far below ground, so
  // world.ts's compileAsync builds the flora pipelines before Generate. Hidden at the first rebuild that draws plants.
  const warm: THREE.InstancedMesh[] = [];
  for (const chem of ['carbon', 'silicon'] as const) for (const mat of [material, materialNoCut]) {
    const ai = lib.archetypes.findIndex((a) => a.chem === chem);
    const L = lookOf(ai, 0, 0);
    paint(L.arch.lod[0], PALETTES[chem], 0);
    L.painted = { pal: PALETTES[chem], glow: 0 };
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(L.geometry.attributes)) g.setAttribute(name, attr);
    g.setIndex(L.geometry.index);
    const w = new THREE.InstancedMesh(g, mat, 1);
    w.setMatrixAt(0, new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4).setPosition(0, -500, 0));
    w.frustumCulled = false;
    group.add(w);
    warm.push(w);
  }

  const radiusPerHeight = lib.archetypes.map((a) => a.radius / a.size);
  const list = makePlantList();
  const heights = makeHeightCache();
  const lookIds = new Int32Array(list.arch.length);
  const counts = new Int32Array(BUCKET_IDS);
  const fill = new Int32Array(counts.length);
  const lookGlow = new Float32Array(BUCKET_IDS);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let lastBuf: Float32Array | null = null, lastRise = -1, lastWorld = '', lastAt = -1, lastPatch = 0;
  let lastCam = { x: 1e9, z: 1e9 }, lastLand = false, lastSea = NaN, warmHidden = false;
  let clearing: Clearing | null = null, clearingSet = false, clearingDirty = false;
  const fwd = new THREE.Vector3();

  const part: FloraPart = {
    plants: 0,
    triangles: 0,
    rebuildMs: 0,
    dropped: 0,
    setClearing(x, z, r = CLEARING_R) {
      clearing = { x, z, r }; clearingSet = true; clearingDirty = true;
    },
    hit(origin, dir) {
      const h = rayPlants(list, radiusPerHeight, origin, dir, lastPatch * 1.5);
      if (!h) return null;
      const i = h.index;
      const cell = cellAt(list.x[i], list.z[i], lastPatch);
      if (cell < 0) return null;
      return { cell, dist: h.dist, x: list.x[i], y: list.y[i], z: list.z[i], height: list.h[i], radius: list.h[i] * radiusPerHeight[list.arch[i]] };
    },
    update(_dt, t, inputs, patch) {
      const cam = app.camera.position;
      if (inputs.world.id !== lastWorld && !clearingSet) clearing = null;
      if (!clearing && inputs.buildProgress >= LATCH_AT_PROGRESS && inputs.buildProgress < 1) {
        app.camera.getWorldDirection(fwd);
        const f = Math.hypot(fwd.x, fwd.z) || 1;
        clearing = { x: cam.x + (fwd.x / f) * LATCH_AHEAD, z: cam.z + (fwd.z / f) * LATCH_AHEAD, r: CLEARING_R };
        clearingDirty = true;
      }
      const moved = Math.hypot(cam.x - lastCam.x, cam.z - lastCam.z) > CAMERA_MOVE;
      const needs =
        inputs.flora !== lastBuf || Math.abs(inputs.terrain.rise - lastRise) > 0.02 || inputs.world.id !== lastWorld ||
        patch !== lastPatch || moved || clearingDirty || inputs.lifeOnLand !== lastLand || !(Math.abs(inputs.seaLevel - lastSea) < 0.3);
      const every = inputs.buildProgress < 1 || moved ? REBUILD_EVERY : REBUILD_EVERY_LIVE;
      if (!needs || t - lastAt < every) return;
      const t0 = performance.now();
      if (inputs.world.id !== lastWorld || patch !== lastPatch) resetHeightCache(heights);
      lastBuf = inputs.flora; lastRise = inputs.terrain.rise; lastWorld = inputs.world.id; lastAt = t; lastPatch = patch;
      clearingDirty = false;
      lastCam = { x: cam.x, z: cam.z }; lastLand = inputs.lifeOnLand; lastSea = inputs.seaLevel;

      placePlants(inputs, patch, { x: cam.x, z: cam.z }, list, heights, clearing);
      const pal = PALETTES[lookKind(inputs.world.composition)];
      counts.fill(0); lookGlow.fill(0);
      for (let i = 0; i < list.n; i++) {
        const look = bucketId(list.arch[i], list.lod[i], list.dark[i]);
        lookIds[i] = look;
        counts[look]++;
        if (list.glow[i] > lookGlow[look]) lookGlow[look] = list.glow[i];
      }
      // hide every mesh; the ones in use are shown below
      for (const b of buckets.values()) { b.mesh.count = 0; b.mesh.visible = false; }
      let tris = 0, dropped = 0;
      for (let id = 0; id < counts.length; id++) {
        fill[id] = 0;
        if (!counts[id]) continue;
        const b = buckets.get(id);
        if (!b) continue; // a look with no bucket (place.ts never places one: dark is near ground only, silicon ground is near)
        const L = lookOf(id >> 2, (id >> 1) & 1, id & 1);
        if (L.painted.pal !== pal || Math.abs(L.painted.glow - lookGlow[id]) > 0.01) {
          paint({ ...L.arch.lod[L.lod], geometry: L.geometry }, pal, lookGlow[id], L.dark);
          L.painted = { pal, glow: lookGlow[id] };
        }
        if (counts[id] > b.cap) { dropped += counts[id] - b.cap; counts[id] = b.cap; }
        b.mesh.visible = true;
        tris += counts[id] * L.arch.lod[L.lod].triangles;
      }
      const arr = new Map<number, Float32Array>();
      for (let i = 0; i < list.n; i++) {
        const id = lookIds[i];
        const b = buckets.get(id);
        if (!b || fill[id] >= b.cap) continue;
        const k = fill[id]++;
        const a = lib.archetypes[list.arch[i]];
        const s = list.h[i] / a.size;
        q.setFromAxisAngle(UP, list.yaw[i]);
        p.set(list.x[i], list.y[i] - 0.03 * list.h[i], list.z[i]);
        sc.set(s, s, s);
        m4.compose(p, q, sc);
        let ma = arr.get(id);
        if (!ma) { ma = b.mesh.instanceMatrix.array as Float32Array; arr.set(id, ma); }
        m4.toArray(ma, k * 16);
      }
      for (const [id, b] of buckets) {
        const n = fill[id] ?? 0;
        if (!n) continue;
        b.mesh.count = n;
        b.mesh.instanceMatrix.clearUpdateRanges();
        b.mesh.instanceMatrix.addUpdateRange(0, n * 16); // upload only the used part of the fixed-size buffer
        b.mesh.instanceMatrix.needsUpdate = true;
      }
      if (!warmHidden && list.n > 0) { for (const w of warm) w.visible = false; warmHidden = true; }
      part.plants = list.n - dropped;
      part.dropped = dropped;
      part.triangles = tris;
      part.rebuildMs = performance.now() - t0;
    },
    dispose() {
      app.scene.remove(group);
      for (const b of buckets.values()) b.mesh.dispose(); // geometry is the look's, disposed below
      for (const w of warm) { w.geometry.dispose(); w.dispose(); }
      for (const L of looks) L?.geometry.dispose();
      material.dispose();
      materialNoCut.dispose();
    },
  };
  group.userData.flora = part; // debug/profiling: scene.getObjectByName('flora').userData.flora
  return part;
}
