// Pure physical models (CLAUDE.md "Data contract" → DerivedStat). Equation forms only:
// every coefficient arrives through the WorldConfig params, never from here.
import type { Solvent } from '../worlds/types';

export const R_GAS = 8.314462618; // J/(mol·K), universal constant
export const STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m²·K⁴), universal constant
const KELVIN = 273.15;

/** Piecewise-linear lookup on a table sorted by x. Clamps beyond the ends. */
export function interp(table: readonly (readonly [number, number])[], x: number): number {
  if (table.length === 0) throw new Error('interp: empty table');
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/** Like interp but linear in log(y), the right form for vapour pressure. Extrapolates the end segments. */
export function interpLog(table: readonly (readonly [number, number])[], x: number): number {
  if (table.length < 2) throw new Error('interpLog: need two points');
  let i = 1;
  while (i < table.length - 1 && x > table[i][0]) i++;
  const [x0, y0] = table[i - 1];
  const [x1, y1] = table[i];
  const t = (x - x0) / (x1 - x0);
  return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
}

/** Solvent vapour pressure in bar. Held at the critical-point value above criticalC (no liquid exists there). */
export function vapourPressure(solvent: Solvent, tC: number): number {
  return interpLog(solvent.vapourPressure, Math.min(tC, solvent.criticalC));
}

/** Real gas density in kg/m³ from P·M/(R·T). Pressure in bar, molar mass in kg/mol. */
export function gasDensity(pressureBar: number, tC: number, molarMassKgPerMol: number): number {
  return (pressureBar * 1e5 * molarMassKgPerMol) / (R_GAS * (tC + KELVIN));
}

// --- radiativeBalance: temperature from orbit/starlight -------------------------------------------------
export interface RadiativeParams {
  solarConstant: number;      // W/m² at 1 AU from a Sun-like star
  luminosity: number;         // star luminosity relative to the Sun
  albedo: number;
  greenhouseK: number;        // baseline greenhouse warming, K
  greenhousePerLnN?: number;  // extra K per ln(nitrogen / nitrogenRef): thicker air strengthens the CO₂ greenhouse
  nitrogenRef?: number;       // × Earth, defaults to 1
}

/** Starlight at the surface relative to a Sun-like star at 1 AU. */
export function starlight(p: Pick<RadiativeParams, 'luminosity'>, distanceAU: number): number {
  return p.luminosity / (distanceAU * distanceAU);
}

/** Warming from nitrogen inventory `n` relative to inventory `ref`, K. Zero when the world has no coefficient. */
export function nitrogenWarming(p: RadiativeParams, n: number, ref: number = p.nitrogenRef ?? 1): number {
  return (p.greenhousePerLnN ?? 0) * Math.log(n / ref);
}

/** Mean surface temperature in °C at an orbital distance (AU) with nitrogen inventory `nitrogen` (× Earth). */
export function radiativeBalance(p: RadiativeParams, distanceAU: number, nitrogen: number): number {
  const flux = (p.solarConstant * starlight(p, distanceAU) * (1 - p.albedo)) / 4;
  const tEff = Math.pow(flux / STEFAN_BOLTZMANN, 0.25);
  return tEff + p.greenhouseK + nitrogenWarming(p, nitrogen) - KELVIN;
}

/** Inverse of radiativeBalance: the orbital distance (AU) that gives surface temperature `tC`. */
export function orbitForTemperature(p: RadiativeParams, tC: number, nitrogen: number): number {
  const tEff = tC + KELVIN - p.greenhouseK - nitrogenWarming(p, nitrogen);
  const flux = STEFAN_BOLTZMANN * Math.pow(tEff, 4);
  const surfaceFlux = (p.solarConstant * p.luminosity * (1 - p.albedo)) / 4;
  return Math.sqrt(surfaceFlux / flux);
}

// --- partialPressures: carbon world surface pressure ---------------------------------------------------
export interface PartialPressureParams {
  earthN2Bar: number;        // nitrogen partial pressure on Earth at 1 × nitrogen and 1 g
  barPerPercentO2: number;   // oxygen partial pressure per % at 1 g
  co2Bar: number;            // carbon dioxide partial pressure at 1 g
}

/** Surface pressure in bar: dry gases scale with gravity (column mass × g), plus the solvent's vapour pressure. */
export function partialPressures(
  p: PartialPressureParams,
  solvent: Solvent,
  s: { nitrogen: number; oxygenPct: number; tC: number; gravity: number },
): number {
  const dry = (s.nitrogen * p.earthN2Bar + s.oxygenPct * p.barPerPercentO2 + p.co2Bar) * s.gravity;
  return dry + vapourPressure(solvent, s.tC);
}

// --- seaVolume / seaCover: nitrogen sea world ---------------------------------------------------------
export interface SeaParams {
  earthN2Bar: number;   // converts bar of N₂ at 1 g to × Earth's nitrogen per m²
  halfVolume: number;   // sea volume (× Earth N₂) at which sea cover reaches half its maximum
  maxCover: number;     // cover approached as the seas deepen, 0..1
}

/** Nitrogen the air holds in equilibrium with the seas (× Earth), at the solvent's vapour pressure. */
export function airHeldNitrogen(sea: SeaParams, solvent: Solvent, tC: number, gravity: number): number {
  return vapourPressure(solvent, tC) / (gravity * sea.earthN2Bar);
}

/** Liquid inventory (× Earth N₂): total minus what the air holds. Zero at or above the critical point. */
export function seaVolume(sea: SeaParams, solvent: Solvent, nitrogen: number, tC: number, gravity: number): number {
  if (tC >= solvent.criticalC) return 0;
  return Math.max(0, nitrogen - airHeldNitrogen(sea, solvent, tC, gravity));
}

/** Fraction of the surface under liquid, rising from 0 with volume. */
export function seaCover(sea: SeaParams, volume: number): number {
  return (sea.maxCover * volume) / (volume + sea.halfVolume);
}
