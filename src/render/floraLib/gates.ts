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
import { DARK_BELOW } from '../floraForm';

/** Air density of Earth's air in VisualInputs units: 1.2 kg/m³ × the shared `airDensity.scale` 0.05 (CLAUDE.md). */
export const AIR_EARTH = 0.06;
/** T9: dense ribs, pleats and gills from photorespiration index P = (O₂/CO₂) ÷ 525 (Earth today 21/0.04) at 0.28,
 * a hard switch, so one build shows at a time (Woodward 1987; Sage 2004). 0.28 [art] puts the design's demo beat on
 * the default carbon seed: CO₂ 0.25% gives P 0.16 at 21% O₂ (sparse) and 0.30 at 40% (dense). */
export const DENSE_P = 0.28;

export interface WorldEnv {
  carbon: boolean; water: boolean; frozen: boolean;
  /** °C, × Earth's nitrogen, × Earth's light, × Earth's air density. */
  T: number; N: number; L: number; air: number;
  /** Photorespiration index (0 when CO₂ is unknown). */
  P: number;
  dense: boolean;
  /** Oxygen, %. */
  O: number;
  /** Realised patch share of each crust mineral by id (absent without crust data): a picked rock chip reaches ~0.75. */
  shares: Record<string, number>;
}

/** 0 at a, 1 at b, smooth between (Hermite). */
export const ramp = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function worldEnv(i: VisualInputs): WorldEnv {
  const co2 = i.stats.co2 ?? 0, o2 = i.stats.oxygen ?? 0;
  const P = co2 > 0 ? o2 / co2 / 525 : 0;
  return {
    carbon: i.world.composition.si <= 0.5, water: /water/i.test(i.world.solvent.name), frozen: i.frozen,
    T: i.stats.temperature ?? 15, N: i.stats.nitrogen ?? 1, L: i.light, air: i.airDensity / AIR_EARTH,
    P, dense: i.world.composition.si <= 0.5 && P >= DENSE_P, O: o2,
    shares: Object.fromEntries((i.world.crust?.ids ?? []).map((id, k) => [id, i.world.crust!.shares[k] ?? 0])),
  };
}

/**
 * Fallback only, for a world without `terrain.crust` (VisualInputs.terrain.crust absent): the cell's mineral and its
 * silicon supply by height rank (flora-traits §3.1 proxy). Silicon: silicide in the lowest 40% (Si supply 1.6), nitride up
 * to 80% (1.2), water-ice bedrock above (0: it holds no silicon); carbon: basalt below 0.55, granite above. The real map
 * (gen/crust.ts, the same minerals and multipliers in silicon.ts) replaces both whenever the world has one.
 */
export function supplySi(rank: number): number {
  return rank < 0.4 ? 1.6 : rank < 0.8 ? 1.2 : 0;
}
export function mineralByRank(carbon: boolean, rank: number): string {
  return carbon ? (rank < 0.55 ? 'basalt' : 'granite') : rank < 0.4 ? 'silicide' : rank < 0.8 ? 'nitride' : 'waterIce';
}

/** Gas floats lift in air at least this many times Earth's density (A5 air niche, A6). */
export const AIR_FLOAT = 5;
/** The aquatic mid slot (A5 water, A8): at most one per cell with biomass B ≥ AQUATIC_B, inside a depth window. */
export const AQUATIC_B = 0.3;
export interface Aquatic {
  key: string; depth: readonly [number, number]; /** drawn top relative to the sea (m) */ top: number;
  /** A second species for deeper water (its own window), when the plant's depth is past this one's. */
  deep?: Aquatic;
}
/** This world's aquatic mid, or null (frozen seas grow none). Kelp tops float at the surface; reefs and glass kelp stay
 * under it. Silicon: whisker reefs in the shallows, S4 glass kelp in deeper water (the clear liquid nitrogen lets light
 * down, so tall crystal blades can reach up [speculative]). */
export function aquaticFor(e: WorldEnv): Aquatic | null {
  if (e.frozen) return null;
  if (e.carbon) return e.water ? { key: 'bladderKelp#0', depth: [2, 15], top: 0.3 } : null;
  return { key: 'whiskerReef#0', depth: [1, 4], top: -0.5, deep: { key: 'glassKelp#0', depth: [4, 12], top: -0.5 } };
}

/** Shore plants (A1, A3) stand on dry ground beside the water: their own ground this far above the sea (m). */
export const SHORE_BAND: readonly [number, number] = [0.2, 3];
/** S1's sea margin: dry ground from the waterline to this height above it (m), where evaporating liquid nitrogen
 * leaves the nitride crust bands (the M2 rims) [speculative]. */
export const MARGIN_BAND: readonly [number, number] = [0, 2.5];

/** What a gate may ask about a cell; place.ts answers lazily (each cell at most once per rebuild). */
export interface CellProbe {
  /** The shoreline passes through the cell's 3 × 3 neighbourhood (cell-centre heights on both sides of the sea). */
  shore(c: number): boolean;
  /** Height rank of the cell in the patch, 0 (lowest) .. 1. */
  rank(c: number): number;
  /** The cell's crust mineral id: the crust map's argmax at the cell centre, as gen/crust crustMap gives the sim (rank fallback). */
  mineral(c: number): string;
  /** The cell's silicon supply multiplier (its mineral's `supply.si`; 1 = the world's base supply). */
  si(c: number): number;
  /** Cell biomass B = mat + canopy. */
  total(c: number): number;
}

export type GateId = 'pitcher' | 'mangrove' | 'cushion' | 'kelpAir' | 'rosette' | 'fern' | 'airFloat' | 'crown' | 'lantern' | 'lace' | 'plankton'
  | 'barrel' | 'thorn' | 'nitro' | 'lycopod' | 'heath' | 'reeds';

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
  /** Like `shore`, with its own band above the sea (m). */
  band?: readonly [number, number];
  /** Only this share of the matching plants (by a per-plant hash), so the base kind stays beside the new one. */
  share?: number;
  /** 0..1 from the world (smoothstep past a threshold): the share of matching plants the new kind takes, so dragging a
   * slider grows it in progressively. The gate is off at 0. Multiplies `share`. */
  ramp?: (e: WorldEnv) => number;
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
  // A3 stilt-root mangrove: prop roots ventilate roots in waterlogged mud (Scholander et al. 1955), frost-limited
  // (Osland et al. 2013): a 10 °C mean-temperature floor ([art] threshold). Before the air kelp, so a shore weeper#3
  // becomes a mangrove. Exclusive with A1 by N and with A2 by T.
  { id: 'mangrove', chem: 'carbon', role: 'mid', replaces: /^(weeper#3|ribFan#|ribFanDense#)/, by: 'stiltMangrove#0', world: (e) => e.T >= 10 && e.N >= 0.3, shore: true },
  // A5 bladder kelp, air niche: gas floats lift as well in air over ~5 × Earth's density (ρ_air − ρ_gas; DESIGN R11,
  // speculative in air). On carbon the Nitrogen slider thickens the air. A tethered float: upright, mid sink rule.
  { id: 'kelpAir', chem: 'carbon', role: 'mid', replaces: /^weeper#/, by: 'bladderKelp#0', world: (e) => e.air >= AIR_FLOAT, land: true },
  // A2 woolly rosette: tropical-alpine giant rosettes on cold, bright heights (Smith & Young 1987). Exclusive with A3
  // by temperature (< 8 °C here, ≥ 10 °C there).
  { id: 'rosette', chem: 'carbon', role: 'giant', replaces: /^(parasolTitan|parasolTitanDense|coilSpire)#/, by: 'woollyRosette#0', world: (e) => e.T < 8 && e.L >= 0.4, cell: (c, p) => p.rank(c) > 0.7 },
  // A7 frost fern: rich silicon supply × biomass (a supersaturation proxy) branches crystals into 60° dendrites
  // (Mullins & Sekerka 1964), so ferns gather on silicide margins.
  { id: 'fern', chem: 'silicon', role: 'ground', replaces: /^crystalGround#2$/, by: 'frostFern#0', world: () => true, cell: (c, p) => p.si(c) * p.total(c) > 1.2, land: true },
  // A6 air-kelp float: gas floats in air ≥ 5 × Earth's density (silicon ≈ 11 ×). World-wide, so it replaces the
  // candelabra patch-wide (net 0 draws). A tethered float: upright, giant sink rule.
  { id: 'airFloat', chem: 'silicon', role: 'giant', replaces: /^prismTitan#2$/, by: 'airKelpFloat#0', world: (e) => e.air >= AIR_FLOAT },
  // §2b silicon-only, all [speculative] (species/silicon.ts):
  // S1 nitride crown: on the dry sea margin, where evaporating liquid N₂ leaves the nitride crust bands (M2), on nitride
  // (nierite) crust, which is the rock the crown grows from
  { id: 'crown', chem: 'silicon', role: 'ground', replaces: /^crystalGround#0$/, by: 'nitrideCrown#0', world: () => true, band: MARGIN_BAND, cell: (c, p) => p.mineral(c) === 'nitride' },
  // S5 lantern bulbs: glow pays as a lure only where light is scarce (glow from darkness, CLAUDE.md); half the land
  // tile crusts in the dark, so the crusts stay
  { id: 'lantern', chem: 'silicon', role: 'ground', replaces: /^crystalGround#1$/, by: 'lanternBulb#0', world: (e) => e.L < DARK_BELOW, land: true, share: 0.5 },
  // S2 lace fan: a 60° lattice that filters the dense air, on the sea-fan analogy; it takes the basalt columns' place
  { id: 'lace', chem: 'silicon', role: 'mid', replaces: /^shardTree#2$/, by: 'laceFan#0', world: (e) => e.air >= AIR_FLOAT },
  // S3 air-plankton raft: gas bladders lift in air ≥ 5 × Earth's density; half the pod shards, so the pods stay
  { id: 'plankton', chem: 'silicon', role: 'mid', replaces: /^shardTree#1$/, by: 'airPlankton#0', world: (e) => e.air >= AIR_FLOAT, share: 0.5 },
  // A4 cushion mound: cold flattens ground cover into cushions (alpine growth form; Körner, Alpine Plant Life)
  { id: 'cushion', chem: 'carbon', role: 'ground', replaces: /^groundCover#2$/, by: 'groundCover#4', world: (e) => e.T < 0, land: true },
  // §2c carbon niche kinds: each ramps in over a normal slider move (or a picked rock), after the edge gates above.
  // H1 barrel succulent: CAM succulents dominate hot, dry ground (thick, ribbed, leafless) [analogue]; 30 → 50 °C
  { id: 'barrel', chem: 'carbon', role: 'mid', replaces: /^weeper#/, by: 'barrelSucculent#0', world: () => true, ramp: (e) => ramp(30, 50, e.T), land: true },
  // H2 thorn shrub: leaf size falls with heat and drought (Wright et al. 2017) [sci]; 30 → 50 °C
  { id: 'thorn', chem: 'carbon', role: 'ground', replaces: /^groundCover#[01]$/, by: 'thornShrub#0', world: () => true, ramp: (e) => ramp(30, 50, e.T), land: true },
  // N1 nitrophile grove: nitrogen loading favours big leaves and fast growth [analogue]; 2 → 5 × Earth's nitrogen
  { id: 'nitro', chem: 'carbon', role: 'mid', replaces: /^(ribFan|ribFanDense|lanternPods)#/, by: 'nitroGrove#0', world: () => true, ramp: (e) => ramp(2, 5, e.N), land: true },
  // O1 lycopod giant: Carboniferous giant scale trees grew under 30–35% O₂ [analogue]; 28 → 35% O₂
  { id: 'lycopod', chem: 'carbon', role: 'giant', replaces: /^(parasolTitan|parasolTitanDense|coilSpire)#/, by: 'lycopodGiant#0', world: () => true, ramp: (e) => ramp(28, 35, e.O), land: true },
  // R1 granite heath: heaths hold poor acid ground [analogue]; on granite cells, ramped by granite's patch share (its
  // natural mix ≤ 0.40, a picked chip ~0.75), so the natural mix is unchanged
  { id: 'heath', chem: 'carbon', role: 'ground', replaces: /^groundCover#[02]$/, by: 'heathShrub#0', world: () => true, ramp: (e) => ramp(0.42, 0.7, e.shares.granite ?? 0), land: true, cell: (c, p) => p.mineral(c) === 'granite' },
  // R2 ironstone reeds: metal-tolerant reeds on iron-rich ground (metallophytes) [analogue]; natural mix ≤ 0.30
  { id: 'reeds', chem: 'carbon', role: 'ground', replaces: /^groundCover#[12]$/, by: 'ironReeds#0', world: () => true, ramp: (e) => ramp(0.42, 0.7, e.shares.ironstone ?? 0), land: true, cell: (c, p) => p.mineral(c) === 'ironstone' },
];

/** A gate's target share of its matching plants in this world, 0..1: 0 when its world half fails, else
 * ramp(e) × share (each defaults to 1). The one rule for every consumer (activeGates here, succession easing in flora). */
export function gateShare(g: GateSpec, e: WorldEnv): number {
  if (!g.world(e)) return 0;
  return (g.ramp ? g.ramp(e) : 1) * (g.share ?? 1);
}

/** The gates whose world-wide half holds now, by role (once per rebuild). */
export function activeGates(e: WorldEnv): Record<GateSpec['role'], GateSpec[]> {
  const out: Record<GateSpec['role'], GateSpec[]> = { ground: [], mid: [], giant: [] };
  const chem = e.carbon ? 'carbon' : 'silicon';
  for (const g of GATES) {
    if (g.chem !== chem) continue;
    if (!g.ramp) { if (g.world(e)) out[g.role].push(g); continue; }
    const s = gateShare(g, e);
    if (s > 0) out[g.role].push({ ...g, share: s });
  }
  return out;
}

/** The archetype a plant draws: its base pick, or the first active gate's archetype if every part of that gate holds
 * for this plant (own ground `y`, the sea level, its cell). Otherwise the base pick, so counts never change. */
export function gateKey(key: string, gates: readonly GateSpec[], c: number, y: number, sea: number, probe: CellProbe, h = 0): string {
  for (const g of gates) {
    if (!g.replaces.test(key)) continue;
    if (g.share !== undefined && h >= g.share) continue;
    if (g.land && y < sea) continue;
    if (g.shore && (y < sea + SHORE_BAND[0] || y > sea + SHORE_BAND[1] || !probe.shore(c))) continue;
    if (g.band && (y < sea + g.band[0] || y > sea + g.band[1] || !probe.shore(c))) continue;
    if (g.cell && !g.cell(c, probe)) continue;
    return g.by;
  }
  return key;
}
