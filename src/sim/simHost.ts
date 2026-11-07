// The worker's brain, with the clock and the message channel injected so it can be tested without a Worker.
// Pacing: sim time follows the wall clock. A late callback (dropped frame, suspended tab) just means more ticks
// are due at once; they run in time-boxed slices and never change the state sequence, only when it arrives.
import { worldFor } from '../worlds';
import { WorldSimulation, type SimEvent } from './simulation';
import { parseToWorker, snapshotTransferables, type FromWorker, type WorkerEvent } from './workerProtocol';

export const SNAPSHOT_HZ = 20;
const SLICE_TICKS = 64; // implementation constant (DECISIONS §G.2 exempt): ticks between clock checks while catching up
const BUDGET_MS = 12; // implementation constant (DECISIONS §G.2 exempt): wall time one timer callback may spend ticking

export interface SimHostOptions {
  post(msg: FromWorker, transfer: Transferable[]): void;
  /** Milliseconds, monotonic (performance.now). */
  now(): number;
  snapshotHz?: number;
  budgetMs?: number;
}

export class SimHost {
  private sim: WorldSimulation | undefined;
  private last = 0;
  private lastSnapshot = -Infinity;
  private readonly period: number;
  private readonly budget: number;

  constructor(private readonly o: SimHostOptions) {
    this.period = 1000 / (o.snapshotHz ?? SNAPSHOT_HZ);
    this.budget = o.budgetMs ?? BUDGET_MS;
  }

  /** Feed one incoming message. Bad messages produce an `error` reply and change nothing. */
  handle(data: unknown): void {
    const p = parseToWorker(data);
    if (!p.ok) return this.error(p.error);
    const msg = p.msg;
    try {
      switch (msg.type) {
        case 'init':
          this.o.post({ type: 'ready' }, []);
          break;
        case 'selectWorld':
          this.sim = new WorldSimulation(worldFor(msg.worldId), msg.requested, { seed: msg.seed });
          this.last = this.o.now();
          this.lastSnapshot = -Infinity;
          this.flush(); // control:blocked for sliders startingConditions moved
          this.postSnapshot();
          break;
        case 'controlSet':
          if (!this.sim) return this.error('controlSet before selectWorld');
          this.sim.setControl(msg.controlId, msg.value);
          this.flush();
          break;
        case 'dispose':
          this.sim = undefined;
          break;
      }
    } catch (e) {
      this.error(e instanceof Error ? e.message : String(e));
    }
  }

  /** Call from a timer, often (e.g. every 8–16 ms). */
  pump(): void {
    const sim = this.sim;
    if (!sim) return;
    try {
      const t0 = this.o.now();
      sim.advance(Math.max(0, (t0 - this.last) / 1000), SLICE_TICKS);
      this.last = t0;
      while (sim.behind && this.o.now() - t0 < this.budget) sim.advance(0, SLICE_TICKS);
      if (t0 - this.lastSnapshot >= this.period) this.postSnapshot();
      else this.flush();
    } catch (e) {
      this.error(e instanceof Error ? e.message : String(e));
    }
  }

  private postSnapshot(): void {
    if (!this.sim) return;
    const snapshot = this.sim.snapshot();
    this.lastSnapshot = this.o.now();
    this.flush(); // events first (build:complete, guide:newForm), then the snapshot they belong to
    this.o.post({ type: 'snapshot', snapshot }, snapshotTransferables(snapshot));
  }

  private flush(): void {
    if (!this.sim) return;
    const worldId = this.sim.world.id;
    for (const e of this.sim.drainEvents()) this.o.post({ type: 'event', event: toWorkerEvent(e, worldId) }, []);
  }

  private error(message: string): void {
    this.o.post({ type: 'error', message }, []);
  }
}

function toWorkerEvent(e: SimEvent, worldId: 'carbon' | 'silicon'): WorkerEvent {
  switch (e.type) {
    case 'build:life':
    case 'build:complete':
      return { name: e.type, payload: { worldId } };
    case 'control:blocked':
      return { name: e.type, payload: e.start ? { controlId: e.controlId, limitId: e.limitId, start: true } : { controlId: e.controlId, limitId: e.limitId } };
    case 'guide:newForm':
      return { name: e.type, payload: { binId: e.binId, name: e.name, organismId: e.organismId } };
  }
}
