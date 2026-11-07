// Minimal carbon-like and silicon-like WorldConfigs for sim tests. Only what models/limits read is realistic;
// the rest satisfies the type. Real configs live in src/worlds/.
import type { Conditions, FeatureDef, LethalLimit, Solvent, Sourced, WorldConfig } from '../../worlds/types';
import type { LifeRules } from '../population';

const sourced: Sourced = { why: 'test fixture', sources: [], assumption: true };
const feature: FeatureDef = { ...sourced, name: 'x', description: 'x', statIds: [], factIds: [] };

const water: Solvent = {
  name: 'Water',
  freezeC: 0,
  criticalC: 374,
  solidSinks: false,
  vapourPressure: [[0, 0.006], [25, 0.032], [50, 0.1235], [100, 1.013], [200, 15.5], [374, 220.6]],
  sources: [],
};

// NIST saturation curve for N₂ (K → °C): triple point 63.15 K, boiling 77.35 K, critical 126.2 K.
const liquidN2: Solvent = {
  name: 'Liquid nitrogen',
  freezeC: -210,
  criticalC: -147,
  solidSinks: true,
  vapourPressure: [
    [-210, 0.125], [-203.15, 0.386], [-195.8, 1.013], [-193.15, 1.37], [-183.15, 3.6],
    [-173.15, 7.78], [-163.15, 14.67], [-153.15, 25.1], [-147, 33.9],
  ],
  sources: [],
};

function limit(l: Omit<LethalLimit, 'why' | 'sources' | 'assumption'>): LethalLimit {
  return { ...sourced, ...l };
}

function base(id: 'carbon' | 'silicon'): Omit<WorldConfig, 'solvent' | 'limits' | 'derived' | 'startDefaults' | 'ranges' | 'status' | 'id'> {
  return {
    displayName: id,
    demoSeed: 1,
    reasoning: [],
    targets: {},
    stats: [],
    facts: [],
    features: { organism: feature, producer: feature, sea: feature, ground: feature, sky: feature },
    build: { ...sourced, durationSec: 20, spawnSec: 6, seasSec: [2, 8], lifeSec: 10, ecologySec: 340, yearsShown: 4.5e9, captions: { start: '', life: '' } },
    feedbacks: [],
    life: {
      rules: {} as LifeRules,
      composition: id === 'carbon' ? { c: 1, si: 0, o: 0.2 } : { c: 0, si: 1, o: 0 },
      founders: { ...sourced, prefTemp: id === 'carbon' ? 15 : -183, tolerance: 8, chem: 0.5 },
      ledger: {},
      inputs: {
        solvent: { ...sourced, rho: 1, mu: 1, epsilonR: 1, liquidBandC: [0, 100] },
        airDensity: { ...sourced, scale: 1, molarMass: 0.028 },
        tissueDensity: { ...sourced, C: 1, Si: 1 },
        scalings: {},
      },
    },
    terrain: { ...sourced, patchSize: 300, base: {}, spawn: { shoreDistance: 40 }, heatSolventSpan: 100, machines: [] },
    starType: 'G-type',
    caveat: id === 'silicon' ? 'Most chemists doubt this.' : undefined,
  };
}

export const carbonFixture: WorldConfig = {
  ...base('carbon'),
  id: 'carbon',
  status: 'known',
  ranges: { gravity: [0.8, 1.3] },
  startDefaults: { temperature: 15, nitrogen: 1, oxygen: 21 },
  solvent: water,
  derived: [
    {
      ...sourced, statId: 'temperature', model: 'radiativeBalance', inputs: ['nitrogen'],
      params: { solarConstant: 1361, luminosity: 1, albedo: 0.3, greenhouseK: 33, greenhousePerLnN: 2 },
    },
    {
      ...sourced, statId: 'pressure', model: 'partialPressures', inputs: ['nitrogen', 'oxygen', 'temperature'],
      params: { earthN2Bar: 0.78, barPerPercentO2: 0.01, co2Bar: 0.0004 },
    },
  ],
  limits: [
    limit({ id: 'tooCold', statId: 'temperature', side: 'below', model: 'fixed', params: { value: -50 }, reason: 'Too cold for surface life', boxEffect: 'freeze' }),
    limit({ id: 'tooHot', statId: 'temperature', side: 'above', model: 'fixed', params: { value: 122 }, reason: 'Hotter than any known organism', boxEffect: 'shakeApart' }),
    limit({ id: 'tooLittleN', statId: 'nitrogen', side: 'below', model: 'fixed', params: { value: 0.05 }, reason: 'Not enough nitrogen to build cells', boxEffect: 'starve' }),
  ],
};

export const siliconFixture: WorldConfig = {
  ...base('silicon'),
  id: 'silicon',
  status: 'speculative',
  ranges: { gravity: [0.5, 1.0] },
  startDefaults: { temperature: -183, nitrogen: 30, oxygen: 0 },
  solvent: liquidN2,
  derived: [
    {
      ...sourced, statId: 'seaCover', model: 'seaVolume', inputs: ['nitrogen', 'temperature'],
      params: { earthN2Bar: 0.78, halfVolume: 20, maxCover: 0.9 },
    },
  ],
  limits: [
    limit({ id: 'seasFrozen', statId: 'temperature', side: 'below', model: 'solventFreezes', params: {}, reason: 'Seas freeze solid', boxEffect: 'freeze' }),
    limit({ id: 'pastCritical', statId: 'temperature', side: 'above', model: 'solventCritical', params: {}, reason: 'Above nitrogen\'s critical point', boxEffect: 'dryUp' }),
    limit({ id: 'seasGone', statId: 'seaCover', side: 'below', model: 'seasEmpty', params: { minCover: 0 }, reason: 'Too little nitrogen for seas', boxEffect: 'dryUp' }),
    limit({ id: 'oxygenRusts', statId: 'oxygen', side: 'above', model: 'fixed', params: { value: 0.1 }, reason: 'Free oxygen turns silicon to rock', boxEffect: 'rust' }),
  ],
};

export const earth: Conditions = { temperature: 15, nitrogen: 1, oxygen: 21 };
