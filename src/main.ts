// App wiring: one runnable flow. Boots straight into a world (carbon by default, ?world=silicon) until the
// selection screen lands. Order matters: build and subscribe everything, THEN emit world:selected.
import { bus, type Bus } from './bus';
import { createTerrain, spawnPoint, type Terrain } from './gen/terrain';
import { attachPlayer } from './player';
import { createApp } from './render/app';
import { buildVisualInputs, flatTerrain, terrainState, type TerrainSampler } from './render/visualInputs';
import { startStubSim } from './stubSim';
import { mountWorldUI } from './ui';
import { controlList, worldFor } from './worlds';
import type { Conditions, InspectTarget, SimSnapshot, VisualInputs, WorldConfig, WorldId } from './worlds/types';

// ---- injection points (swap each with one line) ----

/** Sim: replace with `import { startSim } from './sim/client'` when the real client lands. Must return a stop function. */
const startSim: (b: Bus) => () => void = startStubSim;

/** Terrain: the real analytic sampler (gen/terrain.ts); falls back to flat ground if its config is rejected. */
function createTerrainSampler(world: WorldConfig): TerrainSampler | Terrain {
  try {
    return createTerrain(world.terrain, world.demoSeed);
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

/**
 * Picker: replace with the render-world agent's src/render/pick.ts. Returns the clicked thing and where to put the
 * card, or null for nothing (the card closes). If the real picker emits inspect:open itself, return void.
 */
type PickResult = { target: InspectTarget; at: { x: number; y: number } } | null | void;
type PickFn = (at: { x: number; y: number } | 'reticle') => PickResult;
function createPicker(_app: Awaited<ReturnType<typeof createApp>>): PickFn {
  return () => null;
}

// ---- boot ----

async function boot() {
  const worldId: WorldId = new URLSearchParams(location.search).get('world') === 'silicon' ? 'silicon' : 'carbon';
  const world = worldFor(worldId);
  const otherWorld = worldFor(worldId === 'carbon' ? 'silicon' : 'carbon');
  const requested: Conditions = Object.fromEntries(controlList.map((c) => [c.id, c.default])) as Conditions;

  const app = await createApp();
  const terrain = createTerrainSampler(world);

  // Latest snapshot, shared by VisualInputs and the player's samplers.
  let latest: SimSnapshot | null = null;
  bus.on('sim:snapshot', (s) => { latest = s; });

  // VisualInputs: rebuilt once per snapshot (20 Hz), not per frame.
  let visual: VisualInputs | null = null;
  let visualFor: SimSnapshot | null = null;
  app.setVisualInputsSource(() => {
    if (latest && latest !== visualFor) {
      visualFor = latest;
      visual = buildVisualInputs(latest, world, terrain);
    }
    return visual ?? app.inputs;
  });

  // In-world UI. The player's input owns Tab/Esc/gamepad, so the UI skips its own.
  const ui = mountWorldUI(app.ui, bus, world, { controls: controlList, otherWorld, externalInput: true });

  // Player.
  const pick = createPicker(app);
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
          else if (r === null) bus.emit('inspect:close', {});
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


  // Exposed for other lanes and for debugging from the console.
  (window as unknown as { app: unknown; player: unknown }).app = app;
  (window as unknown as { player: unknown }).player = player;

  // Everything is subscribed: start the sim, then select the world.
  startSim(bus);
  bus.emit('world:selected', { worldId, requested });
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0">${String(e)}</pre>`);
});
