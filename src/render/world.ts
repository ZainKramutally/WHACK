// Functional world view: sky + lights, ground, sea, creatures, flora, click-to-inspect picking and the card's
// counterpart viewport. Driven only by VisualInputs (read-only). The final art look replaces materials, not wiring.
//
//   const view = createWorldView(app);
//   view.setTerrainSampler(terrain);   // builds the GPU mesh; until then a flat placeholder ground is drawn
//   player onInspect → const r = view.pick(at); bus.emit('inspect:open', r)
//
// By default it registers one frame hook on the app, so you do not need to call update() yourself.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import { bus as defaultBus, type Bus } from '../bus';
import { worldFor as defaultWorldFor } from '../worlds';
import type { InspectTarget, VisualInputs, WorldConfig, WorldId } from '../worlds/types';
import { createSky } from './sky';
import { createSea } from './sea';
import { createBackdrop } from './backdrop';
import { createFauna } from './fauna';
import { createFlora } from './flora';
import { createPicker } from './pick';
import { createCounterpart } from './counterpart';
import { createLandmarksPart } from './landmarks';
import type { LandmarkSet } from '../gen/landmarks';
import { LOOK, PAL, updateLook, worldMaterial } from './material';
import { mix, normalWorld, smoothstep, vec3 } from 'three/tsl';
import { createTerrainMesh, createTerrainUniforms, updateGround } from './terrainNode';
import type { Terrain } from '../gen/terrain';

type U = { value: number };
/** What the terrain mesh's uniforms look like (createTerrainUniforms() in render/terrainNode.ts satisfies it). */
export interface TerrainUniformsLike { rise?: U; heatSolvent?: U; progress?: Record<string, U> }

export interface WorldViewOptions {
  bus?: Bus;
  worldFor?: (id: WorldId) => WorldConfig;
  /** Patch size in metres; default: the world's `terrain.patchSize`. */
  patchSize?: number;
  /** Register a frame hook on the app (default true). */
  autoHook?: boolean;
}

export interface WorldView {
  /** Draw one frame from these inputs. Not needed when autoHook is on. */
  update(inputs: VisualInputs): void;
  /** Use this terrain mesh (replaces the flat placeholder). Its uniforms are driven from VisualInputs.terrain. */
  setTerrain(mesh: THREE.Mesh, uniforms?: TerrainUniformsLike): void;
  /** Build the GPU terrain mesh for this sampler (render/terrainNode.ts) and use it. */
  setTerrainSampler(terrain: Terrain, opts?: { segments?: number }): void;
  /** Draw these landmark structures (gen/landmarks.ts); null clears. */
  setLandmarks(set: LandmarkSet | null): void;
  setPatchSize(metres: number): void;
  readonly patchSize: number;
  /**
   * What is under client pixels (or the screen centre for the gamepad reticle). Does NOT emit: main.ts emits
   * `inspect:open` with the returned `{ target, at }` (matches its PickFn).
   */
  pick(at: { x: number; y: number } | 'reticle'): { target: InspectTarget; at: { x: number; y: number } };
  /** Visual scale multiplier for creature bodies (default 3; readability only). */
  setCreatureScale(k: number): void;
  /** Where the player is (world metres): plants on the camera→focus line dither out. Call every frame; until it is
   *  called (or if it stops for 0.5 s) the focus falls back to 5.5 m in front of the camera. */
  setFocus(x: number, y: number, z: number): void;
  /** Spawn point: the flora keeps a clearing there. */
  setSpawn(x: number, z: number): void;
  /** Resolves when every material in the scene (including the card swatches) is compiled. Await this instead of calling compileAsync yourself. Never rejects. */
  readonly ready: Promise<void>;
  /** World position and pick radius of a drawn creature by id (debugging / tests). */
  locate(id: number): { x: number; y: number; z: number; radius: number } | null;
  readonly counts: { creatures: number; plants: number };
  /** Per-part CPU ms accumulated since creation (for profiling; reset fields to 0 to restart). */
  readonly prof: Record<'frames' | 'total' | 'terrain' | 'sky' | 'sea' | 'fauna' | 'flora' | 'landmarks' | 'counterpart', number>;
  dispose(): void;
}

export function createWorldView(app: App, opts: WorldViewOptions = {}): WorldView {
  const bus = opts.bus ?? defaultBus;
  const worldFor = opts.worldFor ?? defaultWorldFor;
  let patchOverride = opts.patchSize;
  let patch = patchOverride ?? 300;
  let latest: VisualInputs = app.inputs;

  // Drop app.ts's placeholder ground and marker; sky.ts drops its lights.
  for (const c of [...app.scene.children]) {
    const m = c as THREE.Mesh;
    if (!m.isMesh) continue;
    const g = m.geometry as THREE.BufferGeometry & { parameters?: { width?: number } };
    if (g.type === 'PlaneGeometry' && g.parameters?.width === 600) app.scene.remove(m);
    if (g.type === 'BoxGeometry' && g.parameters?.width === 2) app.scene.remove(m);
  }

  /** The Red World ground: the terrain colorNode if one is set (art-world), else base ground with crimson slopes. */
  const groundMaterial = (from?: THREE.Material) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = from as any;
    const colorNode = f?.colorNode ?? mix(vec3(PAL.red), vec3(PAL.crimson), smoothstep(0.6, 0.92, normalWorld.y).oneMinus());
    const m = worldMaterial({ kind: 'ground', colorNode });
    if (f?.positionNode) m.positionNode = f.positionNode;
    if (f?.normalNode) m.normalNode = f.normalNode;
    return m;
  };
  /** Re-skin a part's lit meshes with the world material (unlit/basic materials, e.g. glow lamps, are kept). */
  const reskin = (objs: THREE.Object3D[], kind: 'flora' | 'prop') => {
    for (const o of objs) {
      const mesh = o as THREE.Mesh;
      const old = mesh.material as THREE.Material & { flatShading?: boolean; isMeshStandardNodeMaterial?: boolean; userData: Record<string, unknown> };
      if (!mesh.isMesh || !old || Array.isArray(old) || !old.isMeshStandardNodeMaterial || old.userData.look) continue;
      const m = worldMaterial({ kind, side: old.side, flat: old.flatShading === true });
      m.transparent = old.transparent;
      m.opacity = old.opacity;
      m.depthWrite = old.depthWrite;
      mesh.material = m;
      old.dispose();
    }
  };

  const placeholderMat = groundMaterial();
  const placeholder = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), placeholderMat);
  placeholder.rotation.x = -Math.PI / 2;
  app.scene.add(placeholder);

  let terrain: THREE.Mesh | null = null;
  let uniforms: TerrainUniformsLike | undefined;

  const sky = createSky(app);
  const sea = createSea(app);
  const backdrop = createBackdrop(app);
  const fauna = createFauna(app);
  const beforeFlora = new Set(app.scene.children);
  const flora = createFlora(app);
  reskin(app.scene.children.filter((c) => !beforeFlora.has(c)), 'flora');
  const landmarks = createLandmarksPart(app);
  const counterpart = createCounterpart({ app, bus, worldFor, getInputs: () => latest, layoutOf: (id) => fauna.layoutOf(id) });
  const picker = createPicker({ app, bus, fauna, getInputs: () => latest, getPatch: () => patch });

  /** Accumulated ms per part (profiling aid; reset by the caller). */
  const prof = { frames: 0, total: 0, terrain: 0, sky: 0, sea: 0, fauna: 0, flora: 0, landmarks: 0, counterpart: 0 };
  let lastMs = performance.now();
  let focusAt = -Infinity;
  const fwd = new THREE.Vector3();
  function step(dt: number, t: number, inputs: VisualInputs) {
    const tStart = performance.now();
    latest = inputs;
    if (patchOverride === undefined) patch = worldFor(inputs.world.id).terrain.patchSize;
    updateLook(inputs, app.camera, dt, patch);
    if (performance.now() - focusAt > 500) {
      // fallback focus: the follow distance in front of the camera
      app.camera.getWorldDirection(fwd);
      (LOOK.focus.value as THREE.Vector3).copy(app.camera.position).addScaledVector(fwd, 5.5);
    }
    updateGround(inputs, dt);   // after updateLook, before sky.update (sky overrides LOOK fog underwater)

    if (terrain) {
      if (uniforms) {
        if (uniforms.rise) uniforms.rise.value = inputs.terrain.rise;
        if (uniforms.heatSolvent) uniforms.heatSolvent.value = inputs.heatSolvent;
        if (uniforms.progress) for (const k in uniforms.progress) uniforms.progress[k].value = inputs.terrain.progress[k] ?? 0;
      }
    } else {
      placeholder.scale.set(patch, patch, 1);
      placeholder.position.y = 0;
    }

    const t0 = performance.now();
    sky.update(dt, inputs, patch);
    const t1 = performance.now();
    sea.update(dt, t, inputs, patch);
    backdrop.update(dt, t, inputs, patch);
    const t2 = performance.now();
    fauna.update(dt, t, inputs, patch);
    const t3 = performance.now();
    flora.update(dt, t, inputs, patch);
    const t4 = performance.now();
    landmarks.update(dt, t, inputs, patch);
    const t4b = performance.now();
    counterpart.update(dt, t, inputs);
    const t5 = performance.now();
    prof.frames++; prof.total += t5 - t0 + (t0 - tStart);
    prof.terrain += t0 - tStart; prof.sky += t1 - t0; prof.sea += t2 - t1; prof.fauna += t3 - t2; prof.flora += t4 - t3; prof.landmarks += t4b - t4; prof.counterpart += t5 - t4b;
  }

  // Warm-up: swatches first, then the main scene (terrain/sea/creatures/flora), one compile at a time.
  const ready: Promise<void> = counterpart.ready
    .then(() => app.compile())
    .catch((e) => { console.error(e); });

  const unhook = opts.autoHook === false ? () => {} : app.registerFrameHook(step);

  return {
    setFocus(x, y, z) {
      (LOOK.focus.value as THREE.Vector3).set(x, y, z);
      focusAt = performance.now();
    },
    setSpawn(x, z) {
      // setClearing is art-flora's (optional until its branch lands)
      (flora as typeof flora & { setClearing?: (x: number, z: number) => void }).setClearing?.(x, z);
    },
    update(inputs) {
      const now = performance.now();
      const dt = Math.min((now - lastMs) / 1000, 0.1);
      lastMs = now;
      step(dt, now / 1000, inputs);
    },
    setTerrain(mesh, u) {
      if (terrain) app.scene.remove(terrain);
      if (!(mesh.material as THREE.Material).userData.look) {
        const old = mesh.material as THREE.Material;
        mesh.material = groundMaterial(old);
        old.dispose();
      }
      terrain = mesh;
      uniforms = u;
      app.scene.add(mesh);
      placeholder.visible = false;
    },
    setTerrainSampler(t, o) {
      const u = createTerrainUniforms();
      this.setTerrain(createTerrainMesh(t, u, o), u);
      patchOverride = t.patchSize;
      patch = t.patchSize;
    },
    setLandmarks(s) {
      landmarks.setSet(s);
    },
    setPatchSize(m) {
      patchOverride = m;
      patch = m;
    },
    get patchSize() {
      return patch;
    },
    pick: (at) => picker.resolve(at),
    locate: (id) => fauna.locate(id),
    setCreatureScale(k) {
      fauna.scaleBoost = k;
    },
    prof,
    ready,
    get counts() {
      return { creatures: fauna.count, plants: flora.plants };
    },
    dispose() {
      unhook();
      counterpart.dispose();
      fauna.dispose();
      flora.dispose();
      landmarks.dispose();
      sea.dispose();
      backdrop.dispose();
      sky.dispose();
      app.scene.remove(placeholder);
      placeholder.geometry.dispose();
      placeholderMat.dispose();
      if (terrain) app.scene.remove(terrain);
    },
  };
}
