// Messages between the main thread and the sim worker. Every message is discriminated by `type`.
// Main → worker: init, selectWorld, controlSet, dispose. Worker → main: ready, snapshot, event, error.
import type { Conditions, ControlId, CrustPickId, LifeMilestoneEvent, NewFormEvent, SimSnapshot, WorldId } from '../worlds/types';

export type ToWorker =
  | { type: 'init' }
  | { type: 'selectWorld'; worldId: WorldId; requested: Conditions; seed?: number; crust?: CrustPickId; egg?: 'lead' }
  | { type: 'controlSet'; controlId: ControlId; value: number }
  | { type: 'timeSet'; factor: number }
  | { type: 'dispose' };

/** Bus events the worker raises (they carry the same payloads the bus does). */
export type WorkerEvent =
  | { name: 'build:life'; payload: { worldId: WorldId } }
  | { name: 'build:complete'; payload: { worldId: WorldId } }
  | { name: 'control:blocked'; payload: { controlId: ControlId; limitId: string; start?: true } }
  | { name: 'guide:newForm'; payload: NewFormEvent }
  | { name: 'life:milestone'; payload: LifeMilestoneEvent };

export type FromWorker =
  | { type: 'ready' }
  | { type: 'snapshot'; snapshot: SimSnapshot }
  | { type: 'event'; event: WorkerEvent }
  | { type: 'error'; message: string };

const WORLD_IDS: readonly string[] = ['carbon', 'silicon'];
const CONTROL_IDS: readonly string[] = ['temperature', 'nitrogen', 'oxygen'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseConditions(v: unknown): Conditions | undefined {
  if (!isObj(v)) return undefined;
  const { temperature, nitrogen, oxygen } = v;
  return isNum(temperature) && isNum(nitrogen) && isNum(oxygen) ? { temperature, nitrogen, oxygen } : undefined;
}

/** Strict parse of an incoming message. Returns the typed message, or an error string (never throws). */
export function parseToWorker(data: unknown): { ok: true; msg: ToWorker } | { ok: false; error: string } {
  if (!isObj(data) || typeof data.type !== 'string') return { ok: false, error: 'message must be an object with a string type' };
  switch (data.type) {
    case 'init':
      return { ok: true, msg: { type: 'init' } };
    case 'dispose':
      return { ok: true, msg: { type: 'dispose' } };
    case 'timeSet':
      if (!isNum(data.factor)) return { ok: false, error: 'timeSet: factor must be a finite number' };
      return { ok: true, msg: { type: 'timeSet', factor: data.factor } };
    case 'selectWorld': {
      if (typeof data.worldId !== 'string' || !WORLD_IDS.includes(data.worldId)) return { ok: false, error: `unknown world '${String(data.worldId)}'` };
      const requested = parseConditions(data.requested);
      if (!requested) return { ok: false, error: 'selectWorld: requested must be {temperature, nitrogen, oxygen} numbers' };
      if (data.seed !== undefined && !isNum(data.seed)) return { ok: false, error: 'selectWorld: seed must be a number' };
      if (data.crust !== undefined && typeof data.crust !== 'string') return { ok: false, error: 'selectWorld: crust must be a string' };
      return { ok: true, msg: { type: 'selectWorld', worldId: data.worldId as WorldId, requested, seed: data.seed as number | undefined, ...(data.crust !== undefined ? { crust: data.crust as CrustPickId } : {}), ...(data.egg === 'lead' ? { egg: 'lead' as const } : {}) } };
    }
    case 'controlSet':
      if (typeof data.controlId !== 'string' || !CONTROL_IDS.includes(data.controlId)) return { ok: false, error: `unknown control '${String(data.controlId)}'` };
      if (!isNum(data.value)) return { ok: false, error: 'controlSet: value must be a finite number' };
      return { ok: true, msg: { type: 'controlSet', controlId: data.controlId as ControlId, value: data.value } };
    default:
      return { ok: false, error: `unknown message type '${data.type}'` };
  }
}

/** Buffers to hand to postMessage's transfer list: the organism and flora buffers and every birth plan. */
export function snapshotTransferables(s: SimSnapshot): ArrayBuffer[] {
  return [s.organisms.buffer, s.flora.buffer, ...s.births.map((b) => b.plan.buffer)] as ArrayBuffer[];
}
