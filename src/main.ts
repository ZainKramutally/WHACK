// App wiring: the selection screen first; Generate builds the chosen world on the already-compiled renderer.
// Dev deep link: ?world=carbon|silicon skips the selection screen and starts that world with the control defaults.
// Order matters when starting a world: build and subscribe everything, THEN emit world:selected.
import { bus } from './bus';
import { createTerrain, seaLevelForCover, spawnPoint, type Terrain } from './gen/terrain';
import { withCrustChoice } from './gen/crust';
import { createLandmarks } from './gen/landmarks';
import { createRockForms } from './gen/rockForms';
import { attachPlayer } from './player';
import { createApp } from './render/app';
import { createGenerate, type LaunchHandle } from './render/generate';
import { createScanHover } from './render/scanHover';
import { createWorldView } from './render/world';
import { createTerrainMesh, createTerrainUniforms } from './render/terrainNode';
import { buildVisualInputs, drainBirths, flatTerrain, terrainState, type TerrainSampler } from './render/visualInputs';
import { cellSubmerged } from './render/floraForm';
import { pickSeed } from './seed';
import { startSim } from './sim/client';
import { mountWorldUI } from './ui';
import { mountSelectionScreen } from './ui/selection/screen';
import { controlList, worldFor } from './worlds';
import type { Conditions, CrustPickId, SimSnapshot, VisualInputs, WorldConfig, WorldId } from './worlds/types';

// ---- injection points ----

/** Terrain: the real analytic sampler (gen/terrain.ts); falls back to flat ground if its config is rejected. */
function createTerrainSampler(world: WorldConfig, seed: number): TerrainSampler | Terrain {
  try {
    return createTerrain(world.terrain, seed);
  } catch (e) {
    console.warn('terrain config rejected, using flat ground:', e);
    return flatTerrain;
  }
}
function spawnFor(terrain: TerrainSampler | Terrain, snapshot: SimSnapshot, world: WorldConfig): { x: number; z: number } {
  if (!('relics' in terrain)) return { x: 0, z: 0 };
  // The seas keep filling after spawnSec, so find the shore on the finished terrain at the final cover (same as the sim's
  // spawnPointM): the character then stands on land at the end of the build, not only at spawnSec.
  const [s0, s1] = world.build.seasSec;
  const u = Math.min(1, Math.max(0, (snapshot.timeSec - s0) / (s1 - s0)));
  const fill = u * u * (3 - 2 * u);
  const state = terrainState({ ...snapshot, buildProgress: 1 }, world);
  const cover = fill > 0 ? snapshot.stats.seaCover / 100 / fill : snapshot.stats.seaCover / 100;
  const p = spawnPoint(terrain, state, seaLevelForCover(terrain, state, cover));
  return { x: p.x, z: p.z };
}

/** One seed and one terrain per world for the whole page load: the transition plans against the same terrain the run then uses. */
const runSeeds = new Map<WorldId, number>();
const terrains = new Map<string, TerrainSampler | Terrain>();
/** The world a run uses: the config with the picked rock chip applied (the config itself when nothing is picked). */
const runWorld = (worldId: WorldId, crust?: CrustPickId) => withCrustChoice(worldFor(worldId), crust);
/** Cache key for per-world terrain state: a rock pick changes the terrain, so it is part of the key. */
const keyOf = (worldId: WorldId, crust?: CrustPickId) => `${worldId}|${crust ?? ''}`;
function seedFor(worldId: WorldId): number {
  let seed = runSeeds.get(worldId);
  if (seed === undefined) { seed = pickSeed(location.search, worldFor(worldId).demoSeed).seed; runSeeds.set(worldId, seed); }
  return seed;
}
function terrainFor(worldId: WorldId, crust?: CrustPickId): TerrainSampler | Terrain {
  const k = keyOf(worldId, crust);
  let t = terrains.get(k);
  if (!t) { t = createTerrainSampler(runWorld(worldId, crust), seedFor(worldId)); terrains.set(k, t); }
  return t;
}

/** The sim worker and the world's terrain mesh are set up while the selection screen is up, so Generate does not stall on them. */
let simStarted = false;
function ensureSim() { if (!simStarted) { simStarted = true; startSim(bus); } }
/** Each world's terrain mesh is built once per page load and swapped in on demand; reports whether the selected mesh is new. */
const meshes = new Map<string, { mesh: ReturnType<typeof createTerrainMesh>; uniforms: ReturnType<typeof createTerrainUniforms> }>();
let meshFor: string | null = null;
function ensureTerrainMesh(
  view: ReturnType<typeof createWorldView>, worldId: WorldId, crust?: CrustPickId,
): { mesh: ReturnType<typeof createTerrainMesh> | null; needsCompile: boolean } {
  const t = terrainFor(worldId, crust);
  const key = keyOf(worldId, crust);
  if (!('relics' in t)) return { mesh: null, needsCompile: false };
  if (meshFor === key) return { mesh: meshes.get(key)?.mesh ?? null, needsCompile: false };
  let entry = meshes.get(key);
  const isNew = !entry;
  if (!entry) {
    const uniforms = createTerrainUniforms();
    entry = { mesh: createTerrainMesh(t, uniforms), uniforms };
    meshes.set(key, entry);
  }
  view.setTerrain(entry.mesh, entry.uniforms);
  view.setPatchSize(t.patchSize);
  meshFor = key;
  return { mesh: entry.mesh, needsCompile: isNew };
}

// ---- boot ----

/** World-agnostic setup, done while the selection screen is up: renderer, scene and every world's materials compile here. */
async function prepare() {
  const app = await createApp();
  const view = createWorldView(app);
  const gen = createGenerate(app);
  // The view precompiles its terrain, sea, sky, fauna, flora and counterpart materials (serialised with the app's own compile).
  await view.ready;
  return { app, view, gen };
}

async function start(
  { app, view, gen }: Awaited<ReturnType<typeof prepare>>,
  worldId: WorldId,
  requested: Conditions,
  handle?: LaunchHandle,
  crust?: CrustPickId,
) {
  app.setSuspended(false);   // the selection screen is gone (or never shown): render from the first transition frame
  const world = runWorld(worldId, crust);
  const otherWorld = worldFor(worldId === 'carbon' ? 'silicon' : 'carbon');
  // The run's seed drives everything: terrain here, and the sim (founders, spores, terrain in the worker) via world:selected.
  const seed = seedFor(worldId);
  const terrain = terrainFor(worldId, crust);
  const landmarks = 'relics' in terrain
    ? createLandmarks(terrain, { chemistry: world.life.composition.si > 0.5 ? 'silicon' : 'carbon', seaCover: (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200 })
    : null;
  const rockForms = landmarks && 'relics' in terrain
    ? createRockForms(terrain, landmarks, { seaCover: (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200 })
    : null;
  const myKey = keyOf(worldId, crust);
  ensureTerrainMesh(view, worldId, crust);
  // One world per page load: free the other worlds' cached terrain meshes (setTerrain already took them out of the scene).
  for (const [id, e] of meshes) {
    if (id === myKey) continue;
    e.mesh.traverse((o) => { const m = o as import('three/webgpu').Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as import('three/webgpu').Material).dispose(); } });
    meshes.delete(id);
  }
  view.setLandmarks(landmarks);
  view.setRockForms(rockForms);

  // Latest snapshot, shared by VisualInputs and the player's samplers.
  let latest: SimSnapshot | null = null;
  const pendingBirths: SimSnapshot['births'] = [];
  bus.on('sim:snapshot', (s) => {
    latest = s;
    if (s.births.length) pendingBirths.push(...s.births);
  });

  // VisualInputs: rebuilt once per snapshot (20 Hz), not per frame.
  let visual: VisualInputs | null = null;
  let visualFor: SimSnapshot | null = null;
  app.setVisualInputsSource(() => {
    if (latest) {
      // Births from every snapshot since the last frame are delivered exactly once, even if frames were skipped.
      const births = drainBirths(pendingBirths);
      if (latest !== visualFor || births.length || (visual && visual.births.length)) {
        let built: VisualInputs;
        try {
          built = buildVisualInputs(latest, world, terrain, births);
        } catch (e) {
          pendingBirths.unshift(...births); // keep the drained births for the next frame; app.ts warns once
          throw e;
        }
        visualFor = latest;
        visual = built;
      }
    }
    return visual ?? app.inputs;
  });

  // The Generate transition (before the player's hook: it drives the camera until the character spawns, then lets go).
  if (handle && 'relics' in terrain) {
    gen.start({
      worldId, requested, seed, terrain, handle, crust,
      snapshot: () => latest,
      spawnFor: (s) => spawnFor(terrain, s, world),
      groundAt: (x, z) => (latest ? terrain.height(x, z, terrainState(latest, world)) : 0),
      seaLevelNow: () => latest?.stats.seaLevel ?? -1000,
      frozenNow: () => (latest ? latest.stats.temperature < world.solvent.freezeC : false),
      // The UI's first caption ran while the HUD was still hidden by the transition: say it again as the HUD fades in
      // (unless a later caption, e.g. a start-condition reason, is already on screen).
      onReveal: () => { if (!document.querySelector('.wu-caption.wu-on')) uiRef?.showCaption(world.build.captions.start); },
    });
  } else handle?.dispose();

  let uiRef: ReturnType<typeof mountWorldUI> | null = null;
  // In-world UI. The player's input owns Tab/Esc/gamepad, so the UI skips its own.
  const ui = mountWorldUI(app.ui, bus, world, { controls: controlList, otherWorld, externalInput: true, seed, floraSubmerged: (cell) => cellSubmerged(cell, app.inputs) });
  uiRef = ui;

  // Player.
  const pick = view.pick;
  const scan = createScanHover(app, bus, pick, view.locate);
  const groundHeight = (x: number, z: number) =>
    latest ? terrain.height(x, z, terrainState(latest, world)) : 0;
  const player = attachPlayer(
    app.scene,
    app.camera,
    app.renderer.domElement,
    {
      heightAt: groundHeight,
      seaLevel: () => latest?.stats.seaLevel ?? -1000,
      frozen: () => (latest ? latest.stats.temperature < world.solvent.freezeC : false),
      gravity: () => latest?.stats.gravity ?? 1,
      spawn: { x: 0, z: 0 },
    },
    {
      callbacks: {
        onInspect(at) {
          // Only life opens a card (creatures and producers). The sea, ground and sky act as "clicking elsewhere"
          // and close any open card, for the gamepad reticle too (owner ruling, 2026-11-07).
          // A click on a locked creature opens THAT creature even if the ray misses it (fast movers).
          const r = scan.lockedCreatureAt(at) ?? pick(at);
          if (r.target.kind === 'organism' || r.target.kind === 'producer') bus.emit('inspect:open', r);
          else bus.emit('inspect:close', {});
        },
        onToggleConditions: () => ui.toggleConditions(),
        onClose: () => ui.close(),
        onSliderSelect: (i) => ui.selectSlider(i),
        onSliderNudge: (i, d) => ui.nudgeSlider(i, d),
        onLastUsedChange: (k) => { ui.setInputKind(k); scan.setInputKind(k); },
      },
    },
  );
  player.setVisible(false);

  // The character spawns once the ground is solid (build.spawnSec); before that the player is frozen and hidden.
  let spawned = false;
  let appear = 1;   // the character grows in over APPEAR_SEC after it spawns (smoothstep), instead of popping
  const APPEAR_SEC = 0.35;
  bus.on('world:selected', () => { spawned = false; player.setVisible(false); });
  app.registerFrameHook((dt) => {
    if (!spawned) {
      if (!latest || latest.timeSec < world.build.spawnSec) return;
      const p = spawnFor(terrain, latest, world);
      player.respawn(p.x, p.z);
      view.setSpawn(p.x, p.z);
      appear = 0;
      player.setAppear(0);
      spawned = true;
    }
    if (appear < 1) {
      appear = Math.min(1, appear + dt / APPEAR_SEC);
      player.setAppear(appear * appear * (3 - 2 * appear));
    }
    player.update(dt);
    // Structures are solid: slide the character out of any footprint (heightAt alone would lift it onto a pillar).
    if (landmarks && latest) {
      const s = player.state;
      const out = landmarks.pushOut(s.x, s.z, terrainState(latest, world));
      if (out) { s.x = out.x; s.z = out.z; }
    }
    if (rockForms && latest) {
      const s = player.state;
      const out = rockForms.pushOut(s.x, s.z, terrainState(latest, world));
      if (out) { s.x = out.x; s.z = out.z; }
    }
    view.setFocus(player.state.x, player.state.y + 1, player.state.z);
  });


  // Console handles for debugging and headless smoke tests, behind ?debug (like the fps readout).
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { app, player, view, seed, bus, landmarks });

  // Everything is subscribed: start the sim, then select the world.
  ensureSim();
  bus.emit('world:selected', { worldId, requested, seed, ...(crust ? { crust } : {}) });
}

async function boot() {
  const link = new URLSearchParams(location.search).get('world');
  const prepared = prepare();
  if (link === 'carbon' || link === 'silicon') {
    const requested = Object.fromEntries(controlList.map((c) => [c.id, c.default])) as Conditions;
    await start(await prepared, link, requested);
    return;
  }
  // If the renderer fails to come up, surface it; the selection screen is DOM only and must not be left covering the error.
  prepared.catch(fail);
  const screen = mountSelectionScreen(document.getElementById('ui') ?? document.body, bus, {
    onGenerate: ({ worldId, requested, crust }, handle) => {
      prepared.then((p) => start(p, worldId, requested, handle, crust)).catch(fail);
    },
  });
  // The opaque selection screen covers the canvas: skip the world's GPU work until start() resumes it.
  prepared.then((p) => p.app.setSuspended(true)).catch(() => {});
  // While the selection screen is up, plan the Generate transition for the selected world (debounced, in idle slices).
  const prime = (worldId: WorldId, conditions: Conditions, crust?: CrustPickId) => {
    prepared.then(async ({ app, view, gen }) => {
      ensureSim();
      const t = terrainFor(worldId, crust);
      if (!('relics' in t)) return;
      const preparedTerrain = ensureTerrainMesh(view, worldId, crust);
      if (preparedTerrain.needsCompile && preparedTerrain.mesh) {
        // The other world materials were compiled at startup; warm only this new terrain variant, not the whole scene.
        await app.compile(preparedTerrain.mesh);
      }
      gen.prime(worldId, t, seedFor(worldId), conditions, screen.handle, crust);
    }).catch(() => {});
  };
  bus.on('selection:changed', ({ worldId, conditions, crust }) => prime(worldId, conditions, crust));
  prime('carbon', Object.fromEntries(controlList.map((c) => [c.id, c.default])) as Conditions, worldFor('carbon').terrain.crust.defaultPick);
}

function fail(e: unknown) {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0;z-index:9999">${String(e)}</pre>`);
}

boot().catch(fail);
