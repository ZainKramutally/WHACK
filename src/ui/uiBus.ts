import type { BusEvents } from '../worlds/types';

/** The slice of src/bus.ts the UI needs. Handlers are removed by reference. */
export interface UiBus {
  on<K extends keyof BusEvents>(event: K, fn: (payload: BusEvents[K]) => void): void;
  off<K extends keyof BusEvents>(event: K, fn: (payload: BusEvents[K]) => void): void;
  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void;
}

/** Subscribe and get back an unsubscribe function, so modules can collect cleanups. */
export function listen<K extends keyof BusEvents>(bus: UiBus, event: K, fn: (p: BusEvents[K]) => void): () => void {
  bus.on(event, fn);
  return () => bus.off(event, fn);
}
