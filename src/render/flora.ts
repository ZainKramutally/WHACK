// Plants from the per-cell flora grid ([mat, canopy] per cell, 64² cells). A cell with no biomass draws nothing, so
// nothing appears before life. Shapes come from the Red World archetype library (floraLib/, built once at startup);
// which archetype, how big and how many is a pure function of floraForm(cell, inputs), the biomass and the camera
// position (floraLib/place.ts). Drawn as one InstancedMesh per (archetype × LOD × value × 100 m chunk), so far chunks
// frustum-cull. Rebuilt a few times a second during the build, about once a second live, and when the camera has moved.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { buildFloraLibrary, paint, type Archetype, type FloraPalette } from './floraLib';
import { worldMaterial } from './material';
import { LOOK_PALETTES, lookKind } from './palette';
import { makeHeightCache, makePlantList, placePlants, resetHeightCache, type Clearing } from './floraLib/place';

const LIB_SEED = 0x5eed_f10a;
const REBUILD_EVERY = 0.25; // s while the world builds
const REBUILD_EVERY_LIVE = 1; // s afterwards: biomass drifts slowly
const CAMERA_MOVE = 6; // m of camera travel that forces a rebuild (foreground density and LOD follow the camera)
const CHUNKS = 4; // per side of the patch, for mid and giant plants (spread over the whole patch: culling pays)
// Ground cover lives within ~150 m of the camera, so fine chunks would only multiply draw calls: 2 × 2 for ground.
const CHUNKS_GROUND = 2;
const UP = new THREE.Vector3(0, 1, 0);
/** Radius (m) of the spawn clearing: ground cover only, so the spawn frame opens onto groves and giants. */
const CLEARING_R = 25;
/** Fallback until setClearing is wired: latch the clearing where the camera looks once the character has spawned. */
const LATCH_AT_PROGRESS = 0.35, LATCH_AHEAD = 8;

export interface FloraPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Number of plants drawn at the last rebuild. */
  plants: number;
  /** Triangles submitted at the last rebuild (before frustum culling). */
  triangles: number;
  /** ms spent in the last rebuild. */
  rebuildMs: number;
  /** Plants placed but not drawn at the last rebuild because their bucket was full. */
  dropped: number;
  /** Keep a disc free of mid and giant plants (the spawn point; radius default 25 m). null: back to the fallback. */
  setClearing(x: number, z: number, r?: number): void;
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
  // One world material for every plant (cel terminator, translucency, fog, sway from aSway, HDR glow from aGlow).
  // Two-sided: rib-fan webs, sieve plates and parasol discs are open sheets.
  const material = worldMaterial({ kind: 'flora', vertexColors: true, glowAttr: 'aGlow', swayAttr: 'aSway', translucent: true, side: THREE.DoubleSide });
  // Vertex colours are the unmodulated look palette; the material applies the star (palette.ts LOOK_PALETTES).
  const PALETTES: Record<'carbon' | 'silicon', FloraPalette> = { carbon: LOOK_PALETTES.carbon, silicon: LOOK_PALETTES.silicon };
  const group = new THREE.Group();
  group.name = 'flora';
  app.scene.add(group);

  const nA = lib.archetypes.length;
  const looks: Look[] = [];
  const lookOf = (arch: number, lod: number, dark: number): Look => {
    const id = (arch * 2 + lod) * 2 + dark;
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

  // Every bucket (archetype × LOD × value × chunk) is created here, once, with a fixed capacity by role, so a rebuild
  // only writes instance buffers: it never creates a mesh or triggers a compile. Overflow is dropped (and counted).
  // Ground cover is always near-LOD; only ground cover has the dark foreground step.
  const buckets = new Map<number, Bucket>();
  const CAP: Record<string, number> = { ground: 2048, groundDark: 768, mid: 160, giant: 16 };
  for (let ai = 0; ai < nA; ai++) {
    const role = lib.archetypes[ai].role;
    for (let lod = 0; lod < 2; lod++) for (let dark = 0; dark < 2; dark++) {
      if (role === 'ground' ? lod === 1 : dark === 1) continue;
      const lookId = (ai * 2 + lod) * 2 + dark;
      const L = lookOf(ai, lod, dark);
      const cap = role === 'ground' ? (dark ? CAP.groundDark : CAP.ground) : CAP[role];
      const nC = role === 'ground' ? CHUNKS_GROUND : CHUNKS;
      for (let chunk = 0; chunk < nC * nC; chunk++) {
        // per-mesh geometry that shares every vertex attribute (and the index) with the look
        const g = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(L.geometry.attributes)) g.setAttribute(name, attr);
        g.setIndex(L.geometry.index);
        const mesh = new THREE.InstancedMesh(g, material, cap);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count = 0;
        mesh.visible = false;
        mesh.name = `${L.arch.key}/L${lod}${dark ? 'd' : ''}@${chunk}`;
        group.add(mesh);
        buckets.set(lookId * CHUNKS * CHUNKS + chunk, { mesh, cap });
      }
    }
  }

  // Warm-up: one carbon and one silicon mesh, a single invisible-sized instance far below ground, so world.ts's
  // compileAsync builds the flora pipelines before Generate. Hidden at the first rebuild that draws plants.
  const warm: THREE.InstancedMesh[] = [];
  for (const chem of ['carbon', 'silicon'] as const) {
    const ai = lib.archetypes.findIndex((a) => a.chem === chem);
    const L = lookOf(ai, 0, 0);
    paint(L.arch.lod[0], PALETTES[chem], 0);
    L.painted = { pal: PALETTES[chem], glow: 0 };
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(L.geometry.attributes)) g.setAttribute(name, attr);
    g.setIndex(L.geometry.index);
    const w = new THREE.InstancedMesh(g, material, 1);
    w.setMatrixAt(0, new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4).setPosition(0, -500, 0));
    w.frustumCulled = false;
    group.add(w);
    warm.push(w);
  }

  const list = makePlantList();
  const heights = makeHeightCache();
  const lookIds = new Int32Array(list.arch.length);
  const chunkOf = new Uint8Array(list.arch.length);
  const counts = new Int32Array(nA * 4 * CHUNKS * CHUNKS);
  const fill = new Int32Array(counts.length);
  const maxH = new Float32Array(counts.length);
  const lookGlow = new Float32Array(nA * 4);
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
      counts.fill(0); maxH.fill(0); lookGlow.fill(0);
      const half = patch / 2;
      const groundRole = lib.archetypes.map((a) => a.role === 'ground');
      for (let i = 0; i < list.n; i++) {
        const look = (list.arch[i] * 2 + list.lod[i]) * 2 + list.dark[i];
        const nC = groundRole[list.arch[i]] ? CHUNKS_GROUND : CHUNKS, w = patch / nC;
        const cx = Math.min(nC - 1, Math.max(0, Math.floor((list.x[i] + half) / w)));
        const cz = Math.min(nC - 1, Math.max(0, Math.floor((list.z[i] + half) / w)));
        const chunk = cz * nC + cx;
        lookIds[i] = look; chunkOf[i] = chunk;
        const id = look * CHUNKS * CHUNKS + chunk;
        counts[id]++;
        if (list.h[i] > maxH[id]) maxH[id] = list.h[i];
        if (list.glow[i] > lookGlow[look]) lookGlow[look] = list.glow[i];
      }
      // hide every mesh; the ones in use are shown below
      for (const b of buckets.values()) { b.mesh.count = 0; b.mesh.visible = false; }
      let tris = 0, dropped = 0;
      for (let id = 0; id < counts.length; id++) {
        fill[id] = 0;
        if (!counts[id]) continue;
        const look = Math.floor(id / (CHUNKS * CHUNKS)), chunk = id % (CHUNKS * CHUNKS);
        const L = lookOf(look >> 2, (look >> 1) & 1, look & 1);
        if (L.painted.pal !== pal || Math.abs(L.painted.glow - lookGlow[look]) > 0.01) {
          paint({ ...L.arch.lod[L.lod], geometry: L.geometry }, pal, lookGlow[look], L.dark);
          L.painted = { pal, glow: lookGlow[look] };
        }
        const b = buckets.get(id);
        if (!b) continue; // a look with no bucket (never placed by place.ts: ground is near-LOD, only ground is dark)
        if (counts[id] > b.cap) { dropped += counts[id] - b.cap; counts[id] = b.cap; }
        b.mesh.visible = true;
        b.mesh.frustumCulled = true;
        // chunk bounds: the 100 m square plus the tallest plant (and a sway margin)
        const nC = groundRole[look >> 2] ? CHUNKS_GROUND : CHUNKS, chunkW = patch / nC;
        const ccx = -half + ((chunk % nC) + 0.5) * chunkW, ccz = -half + (Math.floor(chunk / nC) + 0.5) * chunkW;
        const r = Math.hypot(chunkW / 2 + maxH[id] * 0.6, chunkW / 2 + maxH[id] * 0.6, maxH[id]);
        b.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(ccx, inputs.terrain.height(ccx, ccz) + maxH[id] * 0.5, ccz), r + 4);
        tris += counts[id] * L.arch.lod[L.lod].triangles;
      }
      const arr = new Map<number, Float32Array>();
      for (let i = 0; i < list.n; i++) {
        const id = lookIds[i] * CHUNKS * CHUNKS + chunkOf[i];
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
      for (const b of buckets.values()) { b.mesh.geometry.dispose(); b.mesh.dispose(); }
      for (const L of looks) L?.geometry.dispose();
      material.dispose();
    },
  };
  group.userData.flora = part; // debug/profiling: scene.getObjectByName('flora').userData.flora
  return part;
}
