import type { WorldConfig, WorldId } from './types';
import { carbon } from './carbon';
import { silicon } from './silicon';
import { leadVariant, type Egg } from './lead';

export const worlds: Record<WorldId, WorldConfig> = { carbon, silicon };

let egg: Egg | undefined;
/** Easter egg switch (main thread on Generate; the worker via selectWorld). While on, carbon resolves to the lead variant. */
export function setEgg(e: Egg | undefined) { egg = e; leadCache = undefined; }
export const currentEgg = () => egg;
let leadCache: WorldConfig | undefined;

export function worldFor(id: WorldId): WorldConfig {
  if (egg === 'lead' && id === 'carbon') return (leadCache ??= leadVariant(carbon));
  const w = worlds[id];
  if (!w) throw new Error(`Unknown world id: ${id}`);
  return w;
}

export { controls, controlList, controlIds } from './controls';
export { sources, sourceFor } from './sources';
