// Throwaway stand-in for the sim worker client, so the app runs end to end before src/sim/client.ts lands.
// Fixed 20 Hz ticks driven by a tick counter (not wall-clock deltas), emitting the same bus events the real sim does:
// control:blocked for slid sliders, sim:snapshot, build:life, build:complete. Delete once the real client is wired in main.ts.
import type { Bus } from './bus';
import { applyControl, livingBands, startingConditions } from './sim/limits';
import { controlList } from './worlds/controls';
import { worldFor } from './worlds';
import type { Conditions, SimSnapshot, WorldConfig } from './worlds/types';

const DT = 1 / 20;
const LIMITS_ENV = { controls: controlList };

export function startStubSim(bus: Bus): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let world: WorldConfig | undefined;
  let cond: Conditions;
  let ticks = 0;
  let lifeFired = false;
  let completeFired = false;

  function snapshot(): SimSnapshot {
    const w = world!;
    const p = Math.min(1, ticks * DT / w.build.durationSec);
    const stats: Record<string, number> = { seaLevel: 0 };
    for (const s of w.stats) {
      const t = w.targets[s.id];
      const start = s.id in cond ? cond[s.id as keyof Conditions] : s.earthValue;
      stats[s.id] = t ? start + ((t[0] + t[1]) / 2 - start) * p : s.earthValue;
    }
    // Sliders are the live conditions: temperature/nitrogen/oxygen read straight from them.
    Object.assign(stats, { temperature: cond.temperature, nitrogen: cond.nitrogen, oxygen: cond.oxygen });
    return {
      worldId: w.id,
      timeSec: ticks * DT,
      buildProgress: p,
      yearsShown: p * w.build.yearsShown,
      stats,
      population: { producers: 0, consumers: 0 },
      generation: 0,
      traitAverages: {},
      organisms: new Float32Array(0),
      flora: new Float32Array(0),
      births: [],
      controls: { ...cond },
      bands: livingBands(w, cond, LIMITS_ENV),
    };
  }

  function tick() {
    ticks++;
    const w = world!;
    const s = snapshot();
    bus.emit('sim:snapshot', s);
    if (!lifeFired && s.timeSec >= w.build.lifeSec) { lifeFired = true; bus.emit('build:life', { worldId: w.id }); }
    if (!completeFired && s.buildProgress >= 1) { completeFired = true; bus.emit('build:complete', { worldId: w.id }); }
  }

  bus.on('world:selected', ({ worldId, requested }) => {
    clearInterval(timer);
    world = worldFor(worldId);
    const start = startingConditions(world, requested, LIMITS_ENV);
    cond = start.start;
    ticks = 0;
    lifeFired = completeFired = false;
    for (const m of start.moved) bus.emit('control:blocked', m);
    tick();
    timer = setInterval(tick, DT * 1000);
  });

  bus.on('control:set', ({ controlId, value }) => {
    if (!world) return;
    const r = applyControl(world, cond, controlId, value, LIMITS_ENV);
    cond = r.conditions;
    if (r.blockedBy) bus.emit('control:blocked', { controlId, limitId: r.blockedBy });
  });

  return () => clearInterval(timer);
}

