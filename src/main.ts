// App wiring: one runnable flow. Boots straight into a world (carbon by default, ?world=silicon) until the
// selection screen lands. Order matters: build and subscribe everything, THEN emit world:selected.
import { bus } from './bus';
import { createTerrain, spawnPoint, type Terrain } from './gen/terrain';
import { attachPlayer } from './player';
import { createApp } from './render/app';
import { createWorldView } from './render/world';
import { buildVisualInputs, drainBirths, flatTerrain, terrainState, type TerrainSampler } from './render/visualInputs';
import { pickSeed } from './seed';
import { startSim } from './sim/client';
import { mountWorldUI } from './ui';
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
  const p = spawnPoint(terrain, terrainState(snapshot, world), snapshot.stats.seaLevel ?? 0);
  return { x: p.x, z: p.z };
}

// ---- boot ----

async function boot() {
  const worldId: WorldId = new URLSearchParams(location.search).get('world') === 'silicon' ? 'silicon' : 'carbon';
  const world = worldFor(worldId);
  const otherWorld = worldFor(worldId === 'carbon' ? 'silicon' : 'carbon');
  const requested: Conditions = Object.fromEntries(controlList.map((c) => [c.id, c.default])) as Conditions;

  const app = await createApp();
  // The run's seed drives everything: terrain here, and the sim (founders, spores, terrain in the worker) via world:selected.
  const { seed } = pickSeed(location.search, world.demoSeed);
  const terrain = createTerrainSampler(world, seed);
  const view = createWorldView(app);
  if ('relics' in terrain) view.setTerrainSampler(terrain);
  // The view precompiles its terrain, sea, sky, fauna, flora and counterpart materials (serialised with the app's own compile).
  await view.ready;

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
  const ui = mountWorldUI(app.ui, bus, world, { controls: controlList, otherWorld, externalInput: true, seed });

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
          const r = pick(at);
          if (r) bus.emit('inspect:open', r);
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
  });


  // Console handles for debugging and headless smoke tests, behind ?debug (like the fps readout).
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { app, player, view, seed, bus });

  // Everything is subscribed: start the sim, then select the world.
  startSim(bus);
  bus.emit('world:selected', { worldId, requested, seed });
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0">${String(e)}</pre>`);
});
