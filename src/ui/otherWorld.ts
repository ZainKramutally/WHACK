// The other world's numbers for the inspect card's comparison column: its stats at its own starting conditions,
// worked out from its derived models (sim/models.ts) and config, not from the end-of-build target midpoints.
// Pure. Stats a world only samples once (gravity, carbon CO₂ and sea cover) use the middle of their config range.
import { equilibriumSeaCover } from '../sim/limits';
import {
  orbitForTemperature, partialPressures, surfaceAir, radiativeBalance, starlight, vapourPressure,
  type PartialPressureParams, type RadiativeParams,
} from '../sim/models';
import { arrheniusFactor } from '../sim/population';
import { controlList } from '../worlds/controls';
import type { WorldConfig } from '../worlds/types';

export function statsAtStart(world: WorldConfig): Record<string, number> {
  const s: Record<string, number> = {};
  for (const def of world.stats) {
    const r = world.ranges[def.id];
    s[def.id] = r ? (r[0] + r[1]) / 2 : 0;
  }
  const c = world.startDefaults;
  s.nitrogen = c.nitrogen;
  s.oxygen = c.oxygen;
  const gravity = s.gravity ?? 1;

  const radDef = world.derived.find((d) => d.model === 'radiativeBalance' && d.statId === 'temperature');
  if (radDef) {
    const base = radDef.params as RadiativeParams & Record<string, number>;
    // Optional CO₂ greenhouse (same form as the sim's): absent from the config means it adds nothing.
    const ref = base.referenceCo2;
    const co2K = ref && base.co2PerDoublingK && 'co2' in s ? base.co2PerDoublingK * Math.log2(Math.max(s.co2, 1e-6) / ref) : 0;
    const rad: RadiativeParams = { ...base, greenhouseK: base.greenhouseK + co2K };
    const orbit = orbitForTemperature(rad, c.temperature, c.nitrogen);
    s.temperature = radiativeBalance(rad, orbit, c.nitrogen);
    if ('light' in s) s.light = starlight(rad, orbit);
  } else {
    s.temperature = c.temperature;
  }
  if ('pace' in s) s.pace = arrheniusFactor(s.temperature, world.life.rules.metabolism);

  for (const d of world.derived) {
    if (d.model === 'partialPressures') {
      const p = d.params as unknown as PartialPressureParams;
      const ref = (radDef?.params as Record<string, number> | undefined)?.referenceCo2;
      const co2Bar = ref && 'co2' in s ? p.co2Bar * (s.co2 / ref) : p.co2Bar;
      s[d.statId] = partialPressures({ ...p, co2Bar }, world.solvent, { nitrogen: s.nitrogen, oxygenPct: s.oxygen, tC: s.temperature, gravity });
    } else if (d.model === 'vapourPressure') {
      s[d.statId] = vapourPressure(world.solvent, s.temperature);
    } else if (d.model === 'seaVolume') {
      s[d.statId] = 100 * equilibriumSeaCover(world, { temperature: s.temperature, nitrogen: s.nitrogen, oxygen: s.oxygen }, { gravity, controls: controlList });
    }
  }
  if ('airDensity' in s && 'pressure' in s) {
    const radBase = (radDef?.params as Record<string, number> | undefined)?.referenceCo2;
    s.airDensity = surfaceAir(world.derived, world.solvent, world.life.inputs.airDensity.molarMass, s, gravity, radBase).density;
  }
  return s;
}
