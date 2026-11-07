// The sim's tunables: DECISIONS.md §G.2, the 14 constants plus SPORE_VIABILITY (15). Budget: ≤ 25 (guardrail 5).
// Every addition costs a removal. Structure (GRID 64, TICK 20 Hz, CAP 1024) is not tunable and lives elsewhere.
// Each entry: default value + tag. 'game' = a declared game-balance knob; 'sci' = sourced from the literature.
// Solvent, air density and tissue density are world facts (WorldConfig.life.inputs), not constants.
// Placeholders (marked "tune") are for the headless tuner; change the value here, never inline.

export type ConstantTag = 'game' | 'sci';

interface Constant<T> { readonly value: T; readonly tag: ConstantTag }

const c = <T>(value: T, tag: ConstantTag): Constant<T> => ({ value, tag });

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

export const CONSTANTS = deepFreeze({
  /** R1: primary production per cell, scaled to the round-2 carrying capacity. */
  P0: c(1.0, 'game'),
  /** R2: dissolution attack at ε_r = 80 (attack = DISSOLVE·ε_r/80). */
  DISSOLVE: c(0.15, 'game'),
  /** R3: basal upkeep. Placeholder ("round 2's b0"): tune. */
  B0: c(1.0, 'game'),
  /** R4: mass of one unit of plate cover, as a share of body mass. */
  PLATE_MASS: c(0.15, 'game'),
  /** R6: inducible armour (Agrawal 1999). */
  INDUCE: c(0.4, 'game'),
  /** R7: shelter strength (catchability and heat buffering). */
  REFUGE: c(0.8, 'game'),
  /** R8: mutation σ, all genes, every birth ("a stressed young world"). */
  SIGMA: c(0.075, 'game'),
  /** R9: temperature–size magnitude (Atkinson 1994): adult scale × (1 + TSR·(1 − 2·heat)). */
  TSR: c(0.6, 'game'),
  /** R10: flight/hover scale. Placeholder: tune. */
  FLY_K: c(1.0, 'game'),
  /** R3: Kleiber exponent (1932). */
  KLEIBER: c(0.75, 'sci'),
  /** R3: share of upkeep that full eyes cost (Moran 2015). */
  EYE_FRAC: c(0.15, 'sci'),
  /** R4: trophic transfer ε = EPS0·(1 + 2·Hunger), 6–18% (Lindeman 1942, recalled). */
  EPS0: c(0.06, 'sci'),
  /** R8: generation time ∝ M^GEN_EXP (Brown 2004). */
  GEN_EXP: c(0.25, 'sci'),
  /** R9: temperature–size magnitude for walkers (Forster 2012). */
  TSR_LAND: c(0.1, 'sci'),
  /** Spores (owner ruling, issue #6; overrides the no-rescue guardrail): a dormant genome germinates only if its climate fit is at least this. */
  SPORE_VIABILITY: c(0.5, 'game'),
  /** Climate fit never drops below this inside the living band (CLAUDE.md "Condition sliders": stressed near an edge, dead only at it); prefTemp still selects who thrives. */
  CLIMATE_FLOOR: c(0.9, 'game'),
  /** R7/R5: cells within which a hunter can strike. */
  REACH: c(1, 'game'),
  /** Spores: they may germinate while fewer than this many animals live (issue #6). */
  SPORE_BELOW: c(4, 'game'),
  /** Founders start in this many shallow cells nearest the player's spawn. */
  FOUNDER_CELLS: c(24, 'game'),
  /** Share of a living band, next to a lethal limit, over which edge stress ramps 0 → 1. */
  EDGE_ZONE: c(0.1, 'game'),
  /** population.ts: how far from its parent a child appears, as a share of the patch. */
  SPAWN_SPREAD: c(0.03, 'game'),
  /** population.ts: how far a consumer drifts per reference-time unit, as a share of the patch. */
  WANDER: c(0.02, 'game'),
});

export type ConstantName = keyof typeof CONSTANTS;
