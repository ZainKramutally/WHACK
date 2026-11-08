// App wiring: the selection screen first; Generate builds the chosen world on the already-compiled renderer.
// Dev deep link: ?world=carbon|silicon skips the selection screen and starts that world with the control defaults.
// Order matters when starting a world: build and subscribe everything, THEN emit world:selected.
import { bus } from './bus';
import { createTerrain, seaLevelForCover, spawnPoint, type Terrain } from './gen/terrain';
import { createLandmarks } from './gen/landmarks';
import { attachPlayer } from './player';
import { createApp } from './render/app';
import { createWorldView } from './render/world';
import { buildVisualInputs, drainBirths, flatTerrain, terrainState, type TerrainSampler } from './render/visualInputs';
import { cellSubmerged } from './render/floraForm';
import { pickSeed } from './seed';
import { startSim } from './sim/client';
import { mountWorldUI } from './ui';
import { mountSelectionScreen } from './ui/selection/screen';
import { controlList, worldFor } from './worlds';
import type { Conditions, SimSnapshot, VisualInputs, WorldConfig, WorldId } from './worlds/types';

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

// ---- boot ----

/** World-agnostic setup, done while the selection screen is up: renderer, scene and every world's materials compile here. */
async function prepare() {
  const app = await createApp();
  const view = createWorldView(app);
  // The view precompiles its terrain, sea, sky, fauna, flora and counterpart materials (serialised with the app's own compile).
  await view.ready;
  return { app, view };
}

async function start(
  { app, view }: Awaited<ReturnType<typeof prepare>>,
  worldId: WorldId,
  requested: Conditions,
) {
  const world = worldFor(worldId);
  const otherWorld = worldFor(worldId === 'carbon' ? 'silicon' : 'carbon');
  // The run's seed drives everything: terrain here, and the sim (founders, spores, terrain in the worker) via world:selected.
  const { seed } = pickSeed(location.search, world.demoSeed);
  const terrain = createTerrainSampler(world, seed);
  const landmarks = 'relics' in terrain
    ? createLandmarks(terrain, { chemistry: world.life.composition.si > 0.5 ? 'silicon' : 'carbon', seaCover: (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200 })
    : null;
  if ('relics' in terrain) view.setTerrainSampler(terrain);
  view.setLandmarks(landmarks);

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
        visualFor = latest;
        visual = buildVisualInputs(latest, world, terrain, births);
      }
    }
    return visual ?? app.inputs;
  });

  // In-world UI. The player's input owns Tab/Esc/gamepad, so the UI skips its own.
  const ui = mountWorldUI(app.ui, bus, world, { controls: controlList, otherWorld, externalInput: true, seed, floraSubmerged: (cell) => cellSubmerged(cell, app.inputs) });

  // Player.
  const pick = view.pick;
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
      spawn: { x: 0, z: 0 },
    },
    {
      callbacks: {
        onInspect(at) {
          // Only life opens a card (creatures and producers). The sea, ground and sky act as "clicking elsewhere"
          // and close any open card, for the gamepad reticle too (owner ruling, 2026-11-07).
          const r = pick(at);
          if (r.target.kind === 'organism' || r.target.kind === 'producer') bus.emit('inspect:open', r);
          else bus.emit('inspect:close', {});
        },
        onToggleConditions: () => ui.toggleConditions(),
        onClose: () => ui.close(),
        onSliderSelect: (i) => ui.selectSlider(i),
        onSliderNudge: (i, d) => ui.nudgeSlider(i, d),
        onLastUsedChange: (k) => ui.setInputKind(k),
      },
    },
  );
  player.setVisible(false);

  // The character spawns once the ground is solid (build.spawnSec); before that the player is frozen and hidden.
  let spawned = false;
  bus.on('world:selected', () => { spawned = false; player.setVisible(false); });
  app.registerFrameHook((dt) => {
    if (!spawned) {
      if (!latest || latest.timeSec < world.build.spawnSec) return;
      const p = spawnFor(terrain, latest, world);
      player.respawn(p.x, p.z);
      player.setVisible(true);
      spawned = true;
    }
    player.update(dt);
    // Structures are solid: slide the character out of any footprint (heightAt alone would lift it onto a pillar).
    if (landmarks && latest) {
      const s = player.state;
      const out = landmarks.pushOut(s.x, s.z, terrainState(latest, world));
      if (out) { s.x = out.x; s.z = out.z; }
    }
  });


  // Console handles for debugging and headless smoke tests, behind ?debug (like the fps readout).
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { app, player, view, seed, bus, landmarks });

  // Everything is subscribed: start the sim, then select the world.
  startSim(bus);
  bus.emit('world:selected', { worldId, requested, seed });
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
    onGenerate: ({ worldId, requested }) => {
      prepared
        .then((p) => start(p, worldId, requested))
        .then(() => screen.worldStarted())
        .catch(fail);
    },
  });
}

function fail(e: unknown) {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0;z-index:9999">${String(e)}</pre>`);
}

boot().catch(fail);
