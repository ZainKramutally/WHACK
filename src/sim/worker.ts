// Web Worker entry: the simulation runs here so rendering never stutters. All logic is in SimHost.
import { SimHost } from './simHost';
import type { FromWorker } from './workerProtocol';

const PUMP_MS = 8; // timer period; SimHost decides how many ticks are due from the wall clock

const host = new SimHost({
  post: (msg: FromWorker, transfer: Transferable[]) => (self as unknown as Worker).postMessage(msg, transfer),
  now: () => performance.now(),
});

self.onmessage = (ev: MessageEvent) => host.handle(ev.data);
setInterval(() => host.pump(), PUMP_MS);
