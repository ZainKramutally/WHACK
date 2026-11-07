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
import { createFauna } from './fauna';
import { createFlora } from './flora';
import { createPicker } from './pick';
import { createCounterpart } from './counterpart';
import { groundColour } from './palette';
import { createTerrainMesh, createTerrainUniforms } from './terrainNode';
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
  setPatchSize(metres: number): void;
  readonly patchSize: number;
  /**
   * What is under client pixels (or the screen centre for the gamepad reticle). Does NOT emit: main.ts emits
   * `inspect:open` with the returned `{ target, at }` (matches its PickFn).
   */
  pick(at: { x: number; y: number } | 'reticle'): { target: InspectTarget; at: { x: number; y: number } };
  /** Visual scale multiplier for creature bodies (default 3; readability only). */
  setCreatureScale(k: number): void;
  /** Resolves when every material in the scene (including the card swatches) is compiled. Await this instead of calling compileAsync yourself. Never rejects. */
  readonly ready: Promise<void>;
  readonly counts: { creatures: number; plants: number };
  /** Per-part CPU ms accumulated since creation (for profiling; reset fields to 0 to restart). */
  readonly prof: Record<'frames' | 'total' | 'terrain' | 'sky' | 'sea' | 'fauna' | 'flora' | 'counterpart', number>;
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

  const placeholderMat = new THREE.MeshStandardNodeMaterial({ color: 0x8a7960, roughness: 0.95 });
  const placeholder = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), placeholderMat);
  placeholder.rotation.x = -Math.PI / 2;
  app.scene.add(placeholder);

  let terrain: THREE.Mesh | null = null;
  let uniforms: TerrainUniformsLike | undefined;
  let lifeBlend = 0;

  const sky = createSky(app);
  const sea = createSea(app);
  const fauna = createFauna(app);
  const flora = createFlora(app);
  const counterpart = createCounterpart({ app, bus, worldFor, getInputs: () => latest, layoutOf: (id) => fauna.layoutOf(id) });
  const picker = createPicker({ app, bus, fauna, getInputs: () => latest, getPatch: () => patch });

  /** Accumulated ms per part (profiling aid; reset by the caller). */
  const prof = { frames: 0, total: 0, terrain: 0, sky: 0, sea: 0, fauna: 0, flora: 0, counterpart: 0 };
  let lastMs = performance.now();
  function step(dt: number, t: number, inputs: VisualInputs) {
    const tStart = performance.now();
    latest = inputs;
    if (patchOverride === undefined) patch = worldFor(inputs.world.id).terrain.patchSize;

    lifeBlend += ((inputs.lifeOnLand ? 1 : 0) - lifeBlend) * (1 - Math.exp(-dt / 3));
    const ground = groundColour(inputs.world.composition, lifeBlend);
    if (terrain) {
      (terrain.material as THREE.MeshStandardNodeMaterial).color.setHex(ground);
      if (uniforms) {
        if (uniforms.rise) uniforms.rise.value = inputs.terrain.rise;
        if (uniforms.heatSolvent) uniforms.heatSolvent.value = inputs.heatSolvent;
        if (uniforms.progress) for (const k in uniforms.progress) uniforms.progress[k].value = inputs.terrain.progress[k] ?? 0;
      }
    } else {
      placeholder.scale.set(patch, patch, 1);
      placeholder.position.y = 0;
      placeholderMat.color.setHex(ground);
    }

    const t0 = performance.now();
    sky.update(dt, inputs, patch);
    const t1 = performance.now();
    sea.update(dt, t, inputs, patch);
    const t2 = performance.now();
    fauna.update(dt, t, inputs, patch);
    const t3 = performance.now();
    flora.update(dt, t, inputs, patch);
    const t4 = performance.now();
    counterpart.update(dt, t, inputs);
    const t5 = performance.now();
    prof.frames++; prof.total += t5 - t0 + (t0 - tStart);
    prof.terrain += t0 - tStart; prof.sky += t1 - t0; prof.sea += t2 - t1; prof.fauna += t3 - t2; prof.flora += t4 - t3; prof.counterpart += t5 - t4;
  }

  // Warm-up: swatches first, then the main scene (terrain/sea/creatures/flora), one compile at a time.
  const ready: Promise<void> = counterpart.ready
    .then(() => app.renderer.compileAsync(app.scene, app.camera))
    .catch((e) => { console.error(e); });

  const unhook = opts.autoHook === false ? () => {} : app.registerFrameHook(step);

  return {
    update(inputs) {
      const now = performance.now();
      const dt = Math.min((now - lastMs) / 1000, 0.1);
      lastMs = now;
      step(dt, now / 1000, inputs);
    },
    setTerrain(mesh, u) {
      if (terrain) app.scene.remove(terrain);
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
    setPatchSize(m) {
      patchOverride = m;
      patch = m;
    },
    get patchSize() {
      return patch;
    },
    pick: (at) => picker.resolve(at),
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
      sea.dispose();
      sky.dispose();
      app.scene.remove(placeholder);
      placeholder.geometry.dispose();
      placeholderMat.dispose();
      if (terrain) app.scene.remove(terrain);
    },
  };
}
