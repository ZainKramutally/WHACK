// Tiny typed event bus over BusEvents. Listeners are called synchronously in registration order.
import type { BusEvents } from './worlds/types';

type Listener<K extends keyof BusEvents> = (payload: BusEvents[K]) => void;

export interface Bus {
  on<K extends keyof BusEvents>(type: K, fn: Listener<K>): void;
  off<K extends keyof BusEvents>(type: K, fn: Listener<K>): void;
  emit<K extends keyof BusEvents>(type: K, payload: BusEvents[K]): void;
}

export function createBus(): Bus {
  const map = new Map<keyof BusEvents, Set<(p: never) => void>>();
  return {
    on(type, fn) {
      let set = map.get(type);
      if (!set) map.set(type, (set = new Set()));
      set.add(fn as (p: never) => void);
    },
    off(type, fn) {
      map.get(type)?.delete(fn as (p: never) => void);
    },
    emit(type, payload) {
      const set = map.get(type);
      if (!set) return;
      // Copy so listeners may on/off during emit.
      for (const fn of [...set]) (fn as Listener<typeof type>)(payload);
    },
  };
}

/** The app-wide bus. */
export const bus: Bus = createBus();
