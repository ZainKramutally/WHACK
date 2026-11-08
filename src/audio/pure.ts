// Pure audio rules (no Web Audio): speed of sound, creature playback rate and the ambience state machine.
// Physics constants are allowed in code (docs/features/audio.md); world facts come in as arguments.

const R_GAS = 8.314462618;   // J/(mol·K)
const GAMMA_DIATOMIC = 1.4;
const C_EARTH = 343;         // m/s, Earth's air at 20 °C

/** c = √(γRT/M), M in kg/mol, T in °C. */
export function speedOfSound(tempC: number, molarMass: number): number {
  return Math.sqrt((GAMMA_DIATOMIC * R_GAS * Math.max(1, tempC + 273.15)) / Math.max(1e-3, molarMass));
}

/** Playback rate of a creature call: pitch ∝ 1 ÷ body length, times the speed-of-sound factor c ÷ 343. */
export function callRate(lengthM: number, tempC: number, molarMass: number): number {
  const sizeK = Math.min(2, Math.max(0.5, 1 / Math.max(0.05, lengthM)));
  return sizeK * (speedOfSound(tempC, molarMass) / C_EARTH);
}

export interface AmbienceInputs {
  scene: 'select' | 'world';
  worldId: 'carbon' | 'silicon';
  spawned: boolean;
  buildProgress: number;   // 0..1
  seasFilled: boolean;     // timeSec >= build.seasSec[0]
  lifeStarted: boolean;    // build:life fired
  frozen: boolean;         // temperature < solvent.freezeC
  underwater: boolean;     // player swimming
  shoreK: number;          // 0..1 closeness to the shoreline
}

/** Target gain (0..1) of each bed. Beds absent from the result are 0. */
export function ambienceTargets(i: AmbienceInputs): Record<string, number> {
  if (i.scene === 'select') return { 'amb.select': 1 };
  const out: Record<string, number> = {};
  if (i.buildProgress < 1) out['amb.build.rise'] = 1;
  if (!i.spawned) return out;
  const w = i.worldId;
  if (i.underwater && i.seasFilled && !i.frozen) {
    out[`amb.${w}.under`] = 1;
    return out;
  }
  const shore = i.seasFilled && !i.frozen ? Math.min(1, Math.max(0, i.shoreK)) : 0;
  const ice = i.seasFilled && i.frozen ? 0.8 : 0;
  const landId = w === 'silicon' ? 'amb.silicon.land' : i.lifeStarted ? 'amb.carbon.land' : 'amb.carbon.barren';
  out[landId] = (i.buildProgress < 1 ? 0.5 : 1) * (1 - 0.5 * shore);
  if (shore > 0.02) out[`amb.${w}.shore`] = shore;
  if (ice > 0) out['amb.frozen'] = ice;
  return out;
}
