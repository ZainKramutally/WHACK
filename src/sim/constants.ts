// The sim's tunables: DECISIONS.md §G.2, exactly the 18 initial constants. Budget: ≤ 25 (guardrail 5).
// Every addition costs a removal. Structure (GRID 64, TICK 20 Hz, CAP 1024) is not tunable and lives elsewhere.
// Each entry: default value + tag. 'game' = a declared game-balance knob; 'sci' = sourced from the literature.
// Placeholders (marked "tune") are for the headless tuner; change the value here, never inline.

export type ConstantTag = 'game' | 'sci';
export type SolventKey = 'water' | 'liquidNitrogen';

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
  /** R3: Q10 of the (log-compressed) rate(heat), Gillooly 2001. */
  Q10: c(2.5, 'sci'),
  /** R3: share of upkeep that full eyes cost (Moran 2015). */
  EYE_FRAC: c(0.15, 'sci'),
  /** R4: trophic transfer ε = EPS0·(1 + 2·Hunger), 6–18% (Lindeman 1942, recalled). */
  EPS0: c(0.06, 'sci'),
  /** R8: generation time ∝ M^GEN_EXP (Brown 2004). */
  GEN_EXP: c(0.25, 'sci'),
  /** R9: temperature–size magnitude for walkers (Forster 2012). */
  TSR_LAND: c(0.1, 'sci'),
  /** R2, R10: solvent properties. ρ g/cm³, μ mPa·s, ε_r relative permittivity, band °C of the liquid. Handbook, recalled. */
  SOLVENT: c(
    {
      water: { rho: 1.0, mu: 0.89, epsR: 80, band: [0, 100] },
      liquidNitrogen: { rho: 0.81, mu: 0.16, epsR: 1.43, band: [-210, -147] },
    } as Record<SolventKey, { rho: number; mu: number; epsR: number; band: [number, number] }>,
    'sci',
  ),
  /**
   * R1, R10: air density in develop()'s scale (a body of unbuoyed carbon tissue = 1), per world solvent.
   * Earth's air (1.2 kg/m³) is the low value; the silicon world's 3.6 bar at −183 °C (about 13 kg/m³) is
   * about 10× denser, scaled and compressed into F's range. [INFERRED]
   */
  AIR_RHO: c({ water: 0.1, liquidNitrogen: 0.4 } as Record<SolventKey, number>, 'sci'),
  /** R10: tissue density, g/cm³. Carbon tissue about water; silicon bodies are mineral-dense. Recalled. */
  TISSUE_RHO: c({ C: 1.05, Si: 2.2 }, 'sci'),
});

export type ConstantName = keyof typeof CONSTANTS;
