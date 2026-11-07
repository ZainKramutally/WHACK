// Plants from the per-cell flora grid ([mat, canopy] per cell, 64² cells). A cell with no biomass draws nothing, so
// nothing appears before life. Shapes come from the Red World archetype library (floraLib/, built once at startup);
// which archetype, how big and how many is a pure function of floraForm(cell, inputs), the biomass and the camera
// position (floraLib/place.ts). Drawn as one InstancedMesh per (archetype × LOD × value × 100 m chunk), so far chunks
// frustum-cull. Rebuilt a few times a second during the build, about once a second live, and when the camera has moved.
import * as THREE from 'three/webgpu';
import { attribute, float } from 'three/tsl';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { buildFloraLibrary, paint, type Archetype, type FloraPalette } from './floraLib';
import { makeHeightCache, makePlantList, placePlants, resetHeightCache } from './floraLib/place';

const LIB_SEED = 0x5eed_f10a;
const REBUILD_EVERY = 0.25; // s while the world builds
const REBUILD_EVERY_LIVE = 1; // s afterwards: biomass drifts slowly
const CAMERA_MOVE = 6; // m of camera travel that forces a rebuild (foreground density and LOD follow the camera)
const CHUNKS = 4; // per side of the patch
const UP = new THREE.Vector3(0, 1, 0);

// TODO(art-look): replace with LOOK_PALETTES[lookKind(...)] from palette.ts once WP1's palette lands (same values).
const PALETTES: Record<'carbon' | 'silicon', FloraPalette> = {
  carbon: { ink: 0x22060f, maroon: 0x5c0a1e, crimson: 0xa8122a, blush: 0xf2a2a0, bone: 0xf4e6dc, glow: 0x3ff5e0, glowDeep: 0x0f8f9a },
  silicon: { ink: 0x0e0822, maroon: 0x34245e, crimson: 0x7660a8, blush: 0xa8c4f0, bone: 0xf4f6fc, glow: 0x7af2ff, glowDeep: 0x3a6ee0 },
};

export interface FloraPart {
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  /** Number of plants drawn at the last rebuild. */
  plants: number;
  /** Triangles submitted at the last rebuild (before frustum culling). */
  triangles: number;
  /** ms spent in the last rebuild. */
  rebuildMs: number;
  dispose(): void;
}

// TODO(art-look): swap for worldMaterial({ kind: 'flora', vertexColors: true, glowAttr: 'aGlow', swayAttr: 'aSway',
// translucent: true }) from ./material once WP1's stub lands. Until then: vertex colour + HDR glow from aGlow.
function floraMaterial(): THREE.Material {
  const m = new THREE.MeshLambertNodeMaterial({ side: THREE.DoubleSide });
  const c = attribute('color', 'vec3');
  m.colorNode = c;
  m.emissiveNode = c.mul(attribute('aGlow', 'float').mul(float(3)));
  return m;
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
  scale: THREE.InstancedBufferAttribute;
  cap: number;
}

export function createFlora(app: App): FloraPart {
  const lib = buildFloraLibrary(LIB_SEED);
  const material = floraMaterial();
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

  const buckets = new Map<number, Bucket>();
  function bucket(look: Look, lookId: number, chunk: number, need: number): Bucket {
    const id = lookId * CHUNKS * CHUNKS + chunk;
    let b = buckets.get(id);
    if (b && b.cap >= need) return b;
    const cap = Math.max(16, 1 << Math.ceil(Math.log2(need)));
    // per-mesh geometry that shares every vertex attribute with the look, plus its own instanced aScale
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(look.geometry.attributes)) g.setAttribute(name, attr);
    g.setIndex(look.geometry.index);
    const scale = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    scale.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aScale', scale);
    const mesh = new THREE.InstancedMesh(g, material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.name = `${look.arch.key}/L${look.lod}${look.dark ? 'd' : ''}@${chunk}`;
    if (b) group.remove(b.mesh); // its geometry shares the look's buffers: never dispose it here
    group.add(mesh);
    b = { mesh, scale, cap };
    buckets.set(id, b);
    return b;
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
    g.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array([1e-4]), 1));
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

  const part: FloraPart = {
    plants: 0,
    triangles: 0,
    rebuildMs: 0,
    update(_dt, t, inputs, patch) {
      const cam = app.camera.position;
      const moved = Math.hypot(cam.x - lastCam.x, cam.z - lastCam.z) > CAMERA_MOVE;
      const needs =
        inputs.flora !== lastBuf || Math.abs(inputs.terrain.rise - lastRise) > 0.02 || inputs.world.id !== lastWorld ||
        patch !== lastPatch || moved || inputs.lifeOnLand !== lastLand || !(Math.abs(inputs.seaLevel - lastSea) < 0.3);
      const every = inputs.buildProgress < 1 || moved ? REBUILD_EVERY : REBUILD_EVERY_LIVE;
      if (!needs || t - lastAt < every) return;
      const t0 = performance.now();
      if (inputs.world.id !== lastWorld || patch !== lastPatch) resetHeightCache(heights);
      lastBuf = inputs.flora; lastRise = inputs.terrain.rise; lastWorld = inputs.world.id; lastAt = t; lastPatch = patch;
      lastCam = { x: cam.x, z: cam.z }; lastLand = inputs.lifeOnLand; lastSea = inputs.seaLevel;

      placePlants(inputs, patch, { x: cam.x, z: cam.z }, list, heights);
      const pal = PALETTES[inputs.world.composition.si > 0.5 ? 'silicon' : 'carbon'];
      counts.fill(0); maxH.fill(0); lookGlow.fill(0);
      const half = patch / 2, chunkW = patch / CHUNKS;
      for (let i = 0; i < list.n; i++) {
        const look = (list.arch[i] * 2 + list.lod[i]) * 2 + list.dark[i];
        const cx = Math.min(CHUNKS - 1, Math.max(0, Math.floor((list.x[i] + half) / chunkW)));
        const cz = Math.min(CHUNKS - 1, Math.max(0, Math.floor((list.z[i] + half) / chunkW)));
        const chunk = cz * CHUNKS + cx;
        lookIds[i] = look; chunkOf[i] = chunk;
        const id = look * CHUNKS * CHUNKS + chunk;
        counts[id]++;
        if (list.h[i] > maxH[id]) maxH[id] = list.h[i];
        if (list.glow[i] > lookGlow[look]) lookGlow[look] = list.glow[i];
      }
      // hide every mesh; the ones in use are shown below
      for (const b of buckets.values()) { b.mesh.count = 0; b.mesh.visible = false; }
      let tris = 0;
      for (let id = 0; id < counts.length; id++) {
        fill[id] = 0;
        if (!counts[id]) continue;
        const look = Math.floor(id / (CHUNKS * CHUNKS)), chunk = id % (CHUNKS * CHUNKS);
        const L = lookOf(look >> 2, (look >> 1) & 1, look & 1);
        if (L.painted.pal !== pal || Math.abs(L.painted.glow - lookGlow[look]) > 0.01) {
          paint({ ...L.arch.lod[L.lod], geometry: L.geometry }, pal, lookGlow[look], L.dark);
          L.painted = { pal, glow: lookGlow[look] };
        }
        const b = bucket(L, look, chunk, counts[id]);
        b.mesh.visible = true;
        b.mesh.frustumCulled = true;
        // chunk bounds: the 100 m square plus the tallest plant (and a sway margin)
        const ccx = -half + ((chunk % CHUNKS) + 0.5) * chunkW, ccz = -half + (Math.floor(chunk / CHUNKS) + 0.5) * chunkW;
        const r = Math.hypot(chunkW / 2 + maxH[id] * 0.6, chunkW / 2 + maxH[id] * 0.6, maxH[id]);
        b.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(ccx, inputs.terrain.height(ccx, ccz) + maxH[id] * 0.5, ccz), r + 4);
        tris += counts[id] * L.arch.lod[L.lod].triangles;
      }
      const arr = new Map<number, Float32Array>();
      for (let i = 0; i < list.n; i++) {
        const id = lookIds[i] * CHUNKS * CHUNKS + chunkOf[i];
        const b = buckets.get(id)!;
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
        (b.scale.array as Float32Array)[k] = s;
      }
      for (const [id, b] of buckets) {
        const n = fill[id] ?? 0;
        if (!n) continue;
        b.mesh.count = n;
        b.mesh.instanceMatrix.needsUpdate = true;
        b.scale.needsUpdate = true;
      }
      if (!warmHidden && list.n > 0) { for (const w of warm) w.visible = false; warmHidden = true; }
      part.plants = list.n;
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
