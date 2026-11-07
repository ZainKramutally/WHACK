import type { WorldConfig, WorldId } from './types';
import { carbon } from './carbon';
import { silicon } from './silicon';

export const worlds: Record<WorldId, WorldConfig> = { carbon, silicon };

export function worldFor(id: WorldId): WorldConfig {
  const w = worlds[id];
  if (!w) throw new Error(`Unknown world id: ${id}`);
  return w;
}

export { controls, controlList, controlIds } from './controls';
export { sources, sourceFor } from './sources';
