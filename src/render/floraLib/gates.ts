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

/**
 * Silicon supply of a cell's crust, by height rank until session/crust's mineral map is on main (flora-traits §3.1
 * fallback): silicide in the lowest 40% (Si supply 1.6), nitride up to 80% (1.2), water-ice bedrock above (0: it holds
 * no silicon). Supplies from docs/features/crust.md (nierite: Lee 1995).
 */
export function supplySi(rank: number): number {
  return rank < 0.4 ? 1.6 : rank < 0.8 ? 1.2 : 0;
}

/** Gas floats lift in air at least this many times Earth's density (A5 air niche, A6). */
export const AIR_FLOAT = 5;
/** The aquatic mid slot (A5 water, A8): at most one per cell with biomass B ≥ AQUATIC_B, inside a depth window. */
export const AQUATIC_B = 0.3;
export interface Aquatic { key: string; depth: readonly [number, number]; /** drawn top relative to the sea (m) */ top: number }
/** This world's aquatic mid, or null (frozen seas grow none). Kelp tops float at the surface; reefs stay under it. */
export function aquaticFor(e: WorldEnv): Aquatic | null {
  if (e.frozen) return null;
  if (e.carbon) return e.water ? { key: 'bladderKelp#0', depth: [2, 15], top: 0.3 } : null;
  return { key: 'whiskerReef#0', depth: [1, 12], top: -0.5 };
}

/** Shore plants (A1, A3) stand on dry ground beside the water: their own ground this far above the sea (m). */
export const SHORE_BAND: readonly [number, number] = [0.2, 3];

/** What a gate may ask about a cell; place.ts answers lazily (each cell at most once per rebuild). */
export interface CellProbe {
  /** The shoreline passes through the cell's 3 × 3 neighbourhood (cell-centre heights on both sides of the sea). */
  shore(c: number): boolean;
  /** Height rank of the cell in the patch, 0 (lowest) .. 1. */
  rank(c: number): number;
  /** Cell biomass B = mat + canopy. */
  total(c: number): number;
}

export type GateId = 'pitcher' | 'cushion' | 'kelpAir' | 'rosette' | 'fern';

export interface GateSpec {
  id: GateId;
  chem: 'carbon' | 'silicon';
  role: 'ground' | 'mid' | 'giant';
  /** Entries of the base pick list this archetype takes the place of. */
  replaces: RegExp;
  by: string;
  /** World-wide half of the gate (once per rebuild). */
  world: (e: WorldEnv) => boolean;
  /** The plant's own ground lies in SHORE_BAND above the sea, in a cell the shoreline passes. */
  shore?: boolean;
  /** Only on land at the plant (y ≥ sea). */
  land?: boolean;
  /** Per-cell half of the gate. */
  cell?: (c: number, p: CellProbe) => boolean;
}

/** Every gate, in priority order: the first whose parts all hold substitutes. Gates on the same entries are exclusive
 * by threshold, so the order only matters for gates on different entries. */
export const GATES: readonly GateSpec[] = [
  // A1 pitcher urn: carnivory where light and water are plentiful and nitrogen scarce (Givnish et al. 1984; Ellison &
  // Gotelli 2001). Exclusive with A3 by N (< 0.3 here, ≥ 0.3 there).
  { id: 'pitcher', chem: 'carbon', role: 'mid', replaces: /^(ribFan|ribFanDense|lanternPods)#/, by: 'pitcherUrn#0', world: (e) => e.N < 0.3 && e.L >= 0.4, shore: true },
  // A5 bladder kelp, air niche: gas floats lift as well in air over ~5 × Earth's density (ρ_air − ρ_gas; DESIGN R11,
  // speculative in air). On carbon the Nitrogen slider thickens the air. A tethered float: upright, mid sink rule.
  { id: 'kelpAir', chem: 'carbon', role: 'mid', replaces: /^weeper#/, by: 'bladderKelp#0', world: (e) => e.air >= AIR_FLOAT, land: true },
  // A2 woolly rosette: tropical-alpine giant rosettes on cold, bright heights (Smith & Young 1987). Exclusive with A3
  // by temperature (< 8 °C here, ≥ 10 °C there).
  { id: 'rosette', chem: 'carbon', role: 'giant', replaces: /^(parasolTitan|parasolTitanDense|coilSpire)#/, by: 'woollyRosette#0', world: (e) => e.T < 8 && e.L >= 0.4, cell: (c, p) => p.rank(c) > 0.7 },
  // A7 frost fern: rich silicon supply × biomass (a supersaturation proxy) branches crystals into 60° dendrites
  // (Mullins & Sekerka 1964), so ferns gather on silicide margins.
  { id: 'fern', chem: 'silicon', role: 'ground', replaces: /^crystalGround#2$/, by: 'frostFern#0', world: () => true, cell: (c, p) => supplySi(p.rank(c)) * p.total(c) > 1.2, land: true },
  // A4 cushion mound: cold flattens ground cover into cushions (alpine growth form; Körner, Alpine Plant Life)
  { id: 'cushion', chem: 'carbon', role: 'ground', replaces: /^groundCover#2$/, by: 'groundCover#4', world: (e) => e.T < 0, land: true },
];

/** The gates whose world-wide half holds now, by role (once per rebuild). */
export function activeGates(e: WorldEnv): Record<GateSpec['role'], GateSpec[]> {
  const out: Record<GateSpec['role'], GateSpec[]> = { ground: [], mid: [], giant: [] };
  const chem = e.carbon ? 'carbon' : 'silicon';
  for (const g of GATES) if (g.chem === chem && g.world(e)) out[g.role].push(g);
  return out;
}

/** The archetype a plant draws: its base pick, or the first active gate's archetype if every part of that gate holds
 * for this plant (own ground `y`, the sea level, its cell). Otherwise the base pick, so counts never change. */
export function gateKey(key: string, gates: readonly GateSpec[], c: number, y: number, sea: number, probe: CellProbe): string {
  for (const g of gates) {
    if (!g.replaces.test(key)) continue;
    if (g.land && y < sea) continue;
    if (g.shore && (y < sea + SHORE_BAND[0] || y > sea + SHORE_BAND[1] || !probe.shore(c))) continue;
    if (g.cell && !g.cell(c, probe)) continue;
    return g.by;
  }
  return key;
}
