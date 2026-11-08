// Gated archetypes (flora-traits §2, C3) and the T9 density switch: pure functions of VisualInputs, the cell and the
// plant. A gate is a substitution row: when it holds, a new species replaces named entries of a cell's pick list (the
// library grows, the active set doesn't). Each gate has three parts:
//   world   world-wide stats, once per rebuild (worldEnv)
//   cell    the cell's conditions (canopy, shore, height rank, mineral supply), once per cell
//   plant   checks at the plant's own ground height y, after place.ts has it (dry ground beside the water, depth, land)
// If any part fails the plant keeps its base pick, so plant counts never change. Gates that substitute the same entries
// are exclusive by their thresholds (pitcher N < 0.3 vs mangrove N ≥ 0.3; rosette T < 8 °C vs mangrove T ≥ 10 °C).
// Thresholds are Earth patterns used as look gates ([sci] niche, [analogue] on these plants); sources in the doc.
import type { VisualInputs } from '../../worlds/types';

/** Air density of Earth's air in VisualInputs units: 1.2 kg/m³ × the shared `airDensity.scale` 0.05 (CLAUDE.md). */
export const AIR_EARTH = 0.06;
/** T9: dense ribs, pleats and gills from photorespiration index P = (O₂/CO₂) ÷ 525 (Earth today 21/0.04) at 0.45,
 * a hard switch, so one build shows at a time (Woodward 1987; Sage 2004). */
export const DENSE_P = 0.45;

export interface WorldEnv {
  carbon: boolean; water: boolean; frozen: boolean;
  /** °C, × Earth's nitrogen, × Earth's light, × Earth's air density. */
  T: number; N: number; L: number; air: number;
  /** Photorespiration index (0 when CO₂ is unknown). */
  P: number;
  dense: boolean;
}

export function worldEnv(i: VisualInputs): WorldEnv {
  const co2 = i.stats.co2 ?? 0, o2 = i.stats.oxygen ?? 0;
  const P = co2 > 0 ? o2 / co2 / 525 : 0;
  return {
    carbon: i.world.composition.si <= 0.5, water: /water/i.test(i.world.solvent.name), frozen: i.frozen,
    T: i.stats.temperature ?? 15, N: i.stats.nitrogen ?? 1, L: i.light, air: i.airDensity / AIR_EARTH,
    P, dense: i.world.composition.si <= 0.5 && P >= DENSE_P,
  };
}
