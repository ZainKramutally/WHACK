// Main-thread wrapper: bridges the sim worker to the bus.
//   bus 'world:selected' → worker selectWorld      bus 'control:set' → worker controlSet
//   worker snapshot → bus 'sim:snapshot'           worker events → bus 'build:life' / 'build:complete' / 'control:blocked' / 'guide:newForm'
// Drop-in for the stub: `startSim(bus)` returns a stop function.
import type { Bus } from '../bus';
import { currentEgg } from '../worlds';
import type { CrustPickId, SimSnapshot } from '../worlds/types';
import type { FromWorker, ToWorker } from './workerProtocol';

export interface SimClientOptions {
  /** Optional override of the snapshot's sea level; the worker already computes it from the terrain (gen/terrain.ts). */
  seaLevel?(buildProgress: number, stats: Record<string, number>): number;
  /** Test seam; defaults to the real sim worker. */
  createWorker?(): Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;
}

export function startSimClient(bus: Bus, opts: SimClientOptions = {}): () => void {
  const worker = opts.createWorker
    ? opts.createWorker()
    : new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const send = (m: ToWorker) => worker.postMessage(m);

  worker.onmessage = (ev: MessageEvent<FromWorker>) => {
    const m = ev.data;
    switch (m.type) {
      case 'snapshot': {
        const s: SimSnapshot = m.snapshot;
        if (opts.seaLevel) s.stats.seaLevel = opts.seaLevel(s.buildProgress, s.stats);
        bus.emit('sim:snapshot', s);
        break;
      }
      case 'event': {
        const e = m.event;
        // Each name maps to one bus event with the same payload.
        (bus.emit as (n: string, p: unknown) => void)(e.name, e.payload);
        break;
      }
      case 'error':
        console.error('[sim worker]', m.message);
        break;
      case 'ready':
        break;
    }
  };
  worker.onerror = (e) => console.error('[sim worker]', e);

  const onSelected = (p: { worldId: 'carbon' | 'silicon'; requested: { temperature: number; nitrogen: number; oxygen: number }; seed?: number; crust?: CrustPickId }) =>
    send({ type: 'selectWorld', worldId: p.worldId, requested: p.requested, seed: p.seed, ...(p.crust ? { crust: p.crust } : {}), ...(currentEgg() ? { egg: currentEgg() } : {}) });
  const onControl = (p: { controlId: 'temperature' | 'nitrogen' | 'oxygen'; value: number }) =>
    send({ type: 'controlSet', controlId: p.controlId, value: p.value });
  bus.on('world:selected', onSelected);
  bus.on('control:set', onControl);
  const onTime = (p: { factor: number }) => send({ type: 'timeSet', factor: p.factor });
  bus.on('time:set', onTime);
  send({ type: 'init' });

  return () => {
    bus.off('world:selected', onSelected);
    bus.off('control:set', onControl);
    bus.off('time:set', onTime);
    send({ type: 'dispose' });
    worker.terminate();
  };
}

/** Same name and shape as stubSim's startStubSim, so main.ts swaps with one line. */
export const startSim = startSimClient;
