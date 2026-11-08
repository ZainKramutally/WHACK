// Plants from the per-cell flora grid ([mat, canopy] per cell, 64² cells). A cell with no biomass draws nothing, so
// nothing appears before life. Shapes come from the Red World archetype library (floraLib/, built once at startup);
// which archetype, how big and how many is a pure function of floraForm(cell, inputs), the biomass and the camera
// position (floraLib/place.ts). Drawn as one InstancedMesh per archetype × LOD × value step (floraLib/buckets.ts), not
// chunked and not frustum-culled: from inside the patch every chunk is partly in view, so chunks only multiplied draw
// calls. Rebuilt a few times a second during the build, about once a second live, and when the camera has moved.
// Every plant is its own (floraLib/vary.ts): per-instance girth and lean in its matrix, crown, twist, droop and bend in
// the `aPlant` attribute the flora material bends it by, and its tint and own glow in `aLook`. All static buffers, written per
// rebuild, so the extra look costs no draw call and nothing per frame.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { floraLibrary, paintSites, type Archetype, type FloraPalette, type FloraRole } from './floraLib';
import { worldMaterial } from './material';
import { LOOK_PALETTES, lookKind } from './palette';
import { makeHeightCache, makePlantList, placePlants, resetHeightCache, type Clearing, type PlantList } from './floraLib/place';
import { BUCKET_IDS, bucketDefs, bucketId } from './floraLib/buckets';
import { rayPlants } from './floraHit';
import { cellAt, type Vec3 } from './layout';
import { VTX_CAP, VTX_GLOW, VTX_RIM, VTX_SWAY, lookGeometry, plantLook, plantMatrix, plantRadius, plantShape, plantTint } from './floraLib/instance';

/** Per-instance shape terms (floraLib/instance.ts plantShape) the flora material bends each plant by. */
const PLANT_ATTR = 'aPlant';
/** Per-instance tint and glow (floraLib/instance.ts plantLook): each plant lights its own glow sites. */
const LOOK_ATTR = 'aLook';
/** WebGPU's default vertex-buffer limit, and the most three r187 shares one build across meshes with. */
export const MAX_VERTEX_BUFFERS = 8;
/** Vertex buffers an instanced mesh binds: its geometry attributes, the instance matrix and any instance colour. */
export const vertexBuffers = (mesh: THREE.InstancedMesh): number => Object.keys(mesh.geometry.attributes).length + 1 + (mesh.instanceColor ? 1 : 0);
const REBUILD_EVERY = 0.25; // s while the world builds
const REBUILD_EVERY_LIVE = 1; // s afterwards: biomass drifts slowly
const CAMERA_MOVE = 6; // m of camera travel that forces a rebuild (foreground density and LOD follow the camera)
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
  /** The plants drawn at the last rebuild (read-only): base x/y/z, size h, yaw, cell and slot, and each one's look
   * (vary.ts fields). Valid until the next update. */
  placed(): Readonly<PlantList>;
  /** The plants the world drew in a flora cell at its last rebuild, exactly as drawn: after the spawn clearing and the
   * camera's distance thinning, with their LOD, value step, glow and look. Records are fresh copies. */
  plantsIn(cell: number): PlacedPlant[];
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
  /** The palette its colours and glow sites are painted in (paintSites: glow is per plant, in aLook). */
  painted: FloraPalette | null;
}

/** One plant as the world drew it at the last rebuild (FloraPart.plantsIn). */
export interface PlacedPlant {
  /** Index into placed(), the last rebuild's plant list. */
  index: number;
  /** Archetype index into floraLibrary().archetypes, its key (e.g. 'parasolTitan#2') and role. */
  arch: number; key: string; role: FloraRole;
  /** Its LOD bucket (0 near, 1 far) and whether it is the darker foreground value step. */
  lod: 0 | 1; dark: boolean;
  /** Emissive amount 0..1 of its glow sites (form.glow of its cell). */
  glow: number;
  /** 1: toothed cap and fan rims (T6; a material with lookAttr and rimAttr draws them from lookW(glow, teeth)). */
  teeth: number;
  /** Instance matrix as drawn (size, girth, yaw, slope tilt and lean, base sink), in the flora group's frame: the
   * world applies group.matrixWorld on top, a vertical stretch of a few % between rebuilds while the terrain rises. */
  matrix: THREE.Matrix4;
  /** The same plant upright on flat ground at height 0 at its own x, z: size, girth, yaw and lean, without the slope
   * tilt and sink (the inspect card's plate). */
  flat: THREE.Matrix4;
  /** Its centre on the ground (m): x, z and the drawn ground height there. */
  x: number; z: number; ground: number;
  /** Drawn height above its base and crown radius (m). */
  height: number; radius: number;
  cell: number; slot: number;
  /** Tint (linear rgb multiplier on the painted colours; the world's aLook.rgb) and the shape terms a material with plantAttr bends
   * it by (crown, twist, droop, bend: floraLib/instance.ts plantShape). */
  tint: [number, number, number];
  shape: [number, number, number, number];
}

interface Bucket {
  mesh: THREE.InstancedMesh;
  /** Fixed instance capacity (allocated once). */
  cap: number;
  /** Per-instance shape terms and look (tint, glow), both vec4, on the bucket's own geometry. */
  shape: THREE.InstancedBufferAttribute;
  look: THREE.InstancedBufferAttribute;
}

export function createFlora(app: App): FloraPart {
  const lib = floraLibrary(); // shared with the producer card: read-only here (every look has its own geometry)
  // The world material for every plant (cel terminator, translucency, fog, sway and HDR glow from the look's packed aVtx).
  // Two-sided: rib-fan webs, sieve plates and parasol discs are open sheets. Near-LOD mid and giant plants carry the
  // focus cut-out (they dither out on the camera→player line); ground cover (≤ 2 m) and far-LOD plants (beyond 40 m
  // for mids, 90 m for giants) can't hide the player, so they skip it: its discard costs early-z on every fragment.
  const FLORA_MAT = { kind: 'flora', vertexColors: true, glowAttr: VTX_GLOW, swayAttr: VTX_SWAY, rimAttr: VTX_RIM, capAttr: VTX_CAP, plantAttr: PLANT_ATTR, lookAttr: LOOK_ATTR, translucent: true, side: THREE.DoubleSide } as const;
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
      // Its own geometry over the shared library one: position, normal, sway and index are shared; colour and glow are
      // its own (paintSites writes them per palette and value step), as are the per-instance buffers added below.
      const geometry = lookGeometry(built);
      L = looks[id] = { arch: a, lod: lod as 0 | 1, dark: !!dark, geometry, painted: null };
    }
    return L;
  };

  // Every bucket (archetype × LOD × value step, floraLib/buckets.ts) is created here, once, with a fixed capacity by
  // role, so a rebuild only writes instance buffers: it never creates a mesh or triggers a compile. Overflow is dropped
  // (and counted). A bucket is one draw call while it has plants; it is never culled (it spans the camera's surroundings).
  // Instance matrices keep the default static usage: in three r187 a DynamicDraw attribute is re-uploaded whole on every
  // render (Attributes.update), while a static one uploads only after needsUpdate, and then only its update range.
  // The per-plant look buffers follow the same rule. With aPlant and aLook a bucket binds 8 vertex buffers
  // at most (position, normal, color, aVtx, aPlant, aLook and the matrix: 7 since aVtx packs sway, glow, rim and cap):
  // WebGPU's default limit is 8, the most
  // three r187 shares one build across meshes with (Instance.js canReferenceInstanceData). Add none without removing one.
  const buckets = new Map<number, Bucket>();
  for (const d of bucketDefs()) {
    const L = lookOf(d.arch, d.lod, d.dark);
    const shape = new THREE.InstancedBufferAttribute(new Float32Array(d.cap * 4), 4);
    L.geometry.setAttribute(PLANT_ATTR, shape); // each bucket has its own look geometry (lookOf), so this is its own
    const mesh = new THREE.InstancedMesh(L.geometry, materialFor(d.role, d.lod), d.cap);
    const look = new THREE.InstancedBufferAttribute(new Float32Array(d.cap * 4), 4);
    L.geometry.setAttribute(LOOK_ATTR, look);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.name = `${L.arch.key}/L${d.lod}${d.dark ? 'd' : ''}`;
    if (vertexBuffers(mesh) > MAX_VERTEX_BUFFERS) console.error(`flora: ${mesh.name} counts ${vertexBuffers(mesh)} toward three's shared-build limit (${MAX_VERTEX_BUFFERS}): free a slot before adding one`);
    group.add(mesh);
    buckets.set(d.id, { mesh, cap: d.cap, shape, look });
  }

  // Warm-up: a carbon and a silicon mesh per material, a single invisible-sized instance far below ground, so
  // world.ts's compileAsync builds the flora pipelines before Generate. Hidden at the first rebuild that draws plants.
  const warm: THREE.InstancedMesh[] = [];
  for (const chem of ['carbon', 'silicon'] as const) for (const mat of [material, materialNoCut]) {
    const ai = lib.archetypes.findIndex((a) => a.chem === chem);
    const L = lookOf(ai, 0, 0);
    paintSites({ ...L.arch.lod[0], geometry: L.geometry }, PALETTES[chem]);
    L.painted = PALETTES[chem];
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(L.geometry.attributes)) g.setAttribute(name, attr);
    g.setAttribute(PLANT_ATTR, new THREE.InstancedBufferAttribute(new Float32Array(4), 4)); // its own: native shape
    g.setAttribute(LOOK_ATTR, new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1, 0]), 4)); // white, unlit
    g.setIndex(L.geometry.index);
    const w = new THREE.InstancedMesh(g, mat, 1);
    w.setMatrixAt(0, new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4).setPosition(0, -500, 0));
    w.frustumCulled = false;
    group.add(w);
    warm.push(w);
  }

  const radiusPerHeight = lib.archetypes.map((a) => a.radius / a.size);
  const list = makePlantList();
  /** Contact-ring radius and drawn height ÷ native size per archetype: place.ts tilts and sinks plants onto the ground. */
  const shapes = { foot: Float32Array.from(lib.archetypes, (a) => a.foot / a.size), height: Float32Array.from(lib.archetypes, (a) => a.height / a.size) };
  const heights = makeHeightCache();
  const lookIds = new Int32Array(list.arch.length);
  /** 1 for every list plant drawn at the last rebuild (0: dropped because its bucket was full). */
  const drawn = new Uint8Array(list.arch.length);
  const counts = new Int32Array(BUCKET_IDS);
  const fill = new Int32Array(counts.length);
  const m4 = new THREE.Matrix4();
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
    placed: () => list,
    plantsIn(cell) {
      const out: PlacedPlant[] = [];
      const tint = new Float32Array(3), shape = new Float32Array(4);
      for (let i = 0; i < list.n; i++) {
        if (list.cell[i] !== cell || !drawn[i]) continue;
        const a = lib.archetypes[list.arch[i]];
        plantTint(list, i, tint, 0);
        plantShape(list, i, a, shape, 0);
        out.push({
          index: i, arch: list.arch[i], key: a.key, role: a.role, lod: list.lod[i] ? 1 : 0, dark: list.dark[i] === 1, glow: list.glow[i], teeth: list.teeth[i],
          matrix: plantMatrix(list, i, a, new THREE.Matrix4()), flat: plantMatrix(list, i, a, new THREE.Matrix4(), true), x: list.x[i], z: list.z[i], ground: list.y[i],
          height: (a.height / a.size) * list.h[i], radius: plantRadius(list, i, radiusPerHeight[list.arch[i]]), cell, slot: list.slot[i],
          tint: [tint[0], tint[1], tint[2]], shape: [shape[0], shape[1], shape[2], shape[3]],
        });
      }
      return out;
    },
    hit(origin, dir) {
      const k = group.scale.y; // the vertical stretch that keeps bases on the rising terrain between rebuilds
      const h = rayPlants(list, radiusPerHeight, origin, dir, lastPatch * 1.5, 0.03, k, shapes.height);
      if (!h) return null;
      const i = h.index;
      const cell = cellAt(list.x[i], list.z[i], lastPatch);
      if (cell < 0) return null;
      // bounds from the ground at the plant's centre to its drawn top (archetype height ÷ size × h above its base, which
      // is sunk 3% plus its slope sink), with its own crown radius
      return { cell, dist: h.dist, x: list.x[i], y: list.y[i] * k, z: list.z[i], height: (shapes.height[list.arch[i]] * list.h[i] - 0.03 * list.h[i] - list.sink[i]) * k, radius: plantRadius(list, i, radiusPerHeight[list.arch[i]]) };
    },
    update(_dt, t, inputs, patch) {
      const cam = app.camera.position;
      // Between rebuilds the terrain keeps rising (height = rise × h): stretch the flora vertically with it so every base
      // stays on the ground. Plant heights stretch by the same ≤ 3% while everything grows; a rebuild resets it to 1.
      const rise = inputs.terrain.rise;
      group.scale.y = lastRise > 1e-3 && rise > 1e-3 ? Math.min(2, Math.max(0.5, rise / lastRise)) : 1;
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
      group.scale.y = 1;
      clearingDirty = false;
      lastCam = { x: cam.x, z: cam.z }; lastLand = inputs.lifeOnLand; lastSea = inputs.seaLevel;

      placePlants(inputs, patch, { x: cam.x, z: cam.z }, list, heights, clearing, shapes);
      const pal = PALETTES[lookKind(inputs.world.composition)];
      counts.fill(0);
      for (let i = 0; i < list.n; i++) {
        const look = bucketId(list.arch[i], list.lod[i], list.dark[i]);
        lookIds[i] = look;
        counts[look]++;
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
        if (L.painted !== pal) {
          paintSites({ ...L.arch.lod[L.lod], geometry: L.geometry }, pal, L.dark);
          L.painted = pal;
        }
        if (counts[id] > b.cap) { dropped += counts[id] - b.cap; counts[id] = b.cap; }
        b.mesh.visible = true;
        tris += counts[id] * L.arch.lod[L.lod].triangles;
      }
      for (let i = 0; i < list.n; i++) {
        const id = lookIds[i];
        const b = buckets.get(id);
        drawn[i] = 0;
        if (!b || fill[id] >= b.cap) continue;
        drawn[i] = 1;
        const k = fill[id]++;
        const a = lib.archetypes[list.arch[i]];
        // its size, girth, yaw, slope tilt and lean, and the sink that puts its contact ring on the ground (place.ts);
        // its crown, twist, droop and bend for the material; its tint and own glow
        plantMatrix(list, i, a, m4).toArray(b.mesh.instanceMatrix.array as Float32Array, k * 16);
        plantShape(list, i, a, b.shape.array as Float32Array, k * 4);
        plantLook(list, i, b.look.array as Float32Array, k * 4);
      }
      // upload only the used part of each fixed-size buffer
      const upload = (at: THREE.BufferAttribute, n: number) => { at.clearUpdateRanges(); at.addUpdateRange(0, n * at.itemSize); at.needsUpdate = true; };
      for (const [id, b] of buckets) {
        const n = fill[id] ?? 0;
        if (!n) continue;
        b.mesh.count = n;
        upload(b.mesh.instanceMatrix, n);
        upload(b.shape, n);
        upload(b.look, n);
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
