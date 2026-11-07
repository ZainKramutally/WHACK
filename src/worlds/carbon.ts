// The carbon world (status: known). Every number a world fact: why + sources, or assumption: true.
// Placeholders awaiting the headless tuner are assumption: true; terrain values track issue #14,
// life input scalings issue #7.
import type { WorldConfig } from './types';

export const carbon: WorldConfig = {
  id: 'carbon',
  displayName: 'Carbon',
  status: 'known',
  demoSeed: 1108,   // pinned demo seed (placeholder until the headless tuner picks one)
  reasoning: [
    {
      text: 'Carbon bonds to itself strongly (C–C is about 346 kJ/mol) and forms stable double bonds, so it builds long, varied chains that survive in water.',
      sources: ['petkowski2020', 'pace2001'],
    },
    {
      text: 'Water is liquid across a wide temperature range and dissolves many carbon compounds, so carbon chemistry in water works well between roughly 0 and 100 °C at 1 bar.',
      sources: ['pace2001'],
    },
    {
      text: 'Nitrogen is the unreactive bulk gas, and life needs it for proteins and DNA; the early Earth thrived on perhaps half of today\'s air pressure.',
      sources: ['som2016', 'goldblatt2009'],
    },
    {
      text: 'Photosynthesis raises oxygen and draws down carbon dioxide, and consumers do the reverse. We treat net production as a stand-in for organic carbon burial, which really took billions of years.',
      sources: [],
      assumption: true,
    },
  ],
  ranges: {
    gravity: [0.8, 1.3],
    co2: [0.2, 0.6],       // % at world start; falls as life grows
    seaCover: [60, 75],    // %
  },
  startDefaults: { temperature: 15, nitrogen: 1, oxygen: 21 },
  targets: {
    temperature: [5, 25],
    pressure: [0.8, 1.4],
    gravity: [0.8, 1.3],
    oxygen: [18, 26],
    nitrogen: [0.9, 1.1],
    co2: [0.04, 0.4],
    seaCover: [55, 75],
    pace: [0.85, 1.15],
  },
  solvent: {
    name: 'Water',
    freezeC: 0,
    criticalC: 374,
    solidSinks: false,   // water ice floats
    // Saturation vapour pressure of water, [°C, bar]. Approximate textbook values, interpolated; verify against NIST/IAPWS.
    vapourPressure: [
      [-50, 0.00004], [-20, 0.00103], [0, 0.00611], [10, 0.01228], [20, 0.02339], [30, 0.04247],
      [40, 0.07384], [50, 0.1235], [60, 0.1995], [70, 0.3119], [80, 0.4739], [90, 0.7014],
      [100, 1.0132], [110, 1.4338], [120, 1.985], [150, 4.76], [200, 15.55], [250, 39.7],
      [300, 85.8], [374, 220.6],
    ],
    sources: [],
  },
  stats: [
    { id: 'temperature', label: 'Surface temperature', unit: '°C', earthValue: 15, why: 'Water must stay liquid, and the star plus the CO₂ greenhouse set where the temperature sits.', sources: ['hoffman2017'] },
    { id: 'pressure', label: 'Surface pressure', unit: 'bar', earthValue: 1, why: 'The weight of the air: nitrogen, oxygen and CO₂ pulled down by gravity, plus water vapour.', sources: [], assumption: true },
    { id: 'gravity', label: 'Gravity', unit: 'g', earthValue: 1, why: 'Strong enough to hold an atmosphere, within the range of rocky planets.', sources: [], assumption: true },
    { id: 'oxygen', label: 'Oxygen', unit: '%', earthValue: 21, why: 'Set by the Oxygen slider, then nudged by life: photosynthesis adds it and consumers breathe it back down.', sources: [], assumption: true },
    { id: 'nitrogen', label: 'Nitrogen', unit: '× Earth', earthValue: 1, why: 'Set by the Nitrogen slider; life needs nitrogen for proteins and DNA.', sources: ['som2016'] },
    { id: 'co2', label: 'Carbon dioxide', unit: '%', earthValue: 0.04, why: 'Starts high and falls as photosynthesis draws it down; consumers return some.', sources: [], assumption: true },
    { id: 'seaCover', label: 'Sea cover', unit: '%', earthValue: 71, why: 'Water covers most of a planet with this much water; the patch sea level is set so this share lies below it.', sources: [], assumption: true },
    { id: 'light', label: 'Starlight', unit: '× Earth', earthValue: 1, why: 'Set by the planet\'s distance from its star, which the Temperature slider moves.', sources: [], assumption: true },
    { id: 'pace', label: 'Pace of chemistry', unit: '× Earth', earthValue: 1, why: 'Earth is the reference: reactions run at their normal speed in this warm water.', sources: [] , assumption: true },
  ],
  facts: [
    { id: 'mainGas', label: 'Main gas', value: 'Nitrogen', earthValue: 'Nitrogen', why: 'An unreactive bulk gas that persists for billions of years.', sources: [], assumption: true },
    { id: 'solvent', label: 'Solvent', value: 'Water', earthValue: 'Water', why: 'Liquid over a wide temperature range and dissolves many carbon compounds.', sources: ['pace2001'] },
    { id: 'star', label: 'Star', value: 'Sun-like', earthValue: 'The Sun', why: 'The reference star, at a distance the Temperature slider adjusts.', sources: [], assumption: true },
    { id: 'bodyChemistry', label: 'Body chemistry', value: 'Carbon chains with some oxygen', earthValue: 'Carbon chains with some oxygen', why: 'Carbon builds strong, flexible backbones that work in water.', sources: ['petkowski2020'] },
    { id: 'rock', label: 'Ground', value: 'Silicate rock with shell stone built by life', earthValue: 'Silicate rock with limestone built by life', why: 'Rock is mostly silicates; life in water builds shell stone in the shallows (carbonate itself is not modelled).', sources: [], assumption: true },
  ],
  features: {
    organism: {
      name: 'Carbon animal',
      description: 'A grazer or hunter whose body is built from carbon chains, shaped by its genes and by the air and sea around it.',
      statIds: ['temperature', 'oxygen'],
      factIds: ['bodyChemistry'],
      why: 'Carbon bonds to itself strongly, so its bodies grow round, curling and many-jointed in water.',
      sources: ['petkowski2020'],
    },
    producer: {
      name: 'Plant',
      description: 'Photosynthetic growth that turns starlight and carbon dioxide into food and releases oxygen.',
      statIds: ['light', 'co2'],
      factIds: ['bodyChemistry'],
      why: 'Plants are the producers; they feed the animals and push oxygen up and carbon dioxide down.',
      sources: [],
      assumption: true,
    },
    sea: {
      name: 'Water sea',
      description: 'Liquid water, frozen only when the surface falls below 0 °C.',
      statIds: ['temperature', 'seaCover'],
      factIds: ['solvent'],
      why: 'Water is liquid over a wide band and is the solvent carbon chemistry works best in.',
      sources: ['pace2001'],
    },
    ground: {
      name: 'Rock',
      description: 'Silicate rock, with shell stone growing in the shallows where life has built it.',
      statIds: ['gravity'],
      factIds: ['rock'],
      why: 'Carbon in the air would rust away, but life in water locks some of it into shell stone.',
      sources: [],
      assumption: true,
    },
    sky: {
      name: 'Sun-like star and nitrogen air',
      description: 'A steady star shining through a nitrogen-and-oxygen sky.',
      statIds: ['pressure', 'light'],
      factIds: ['star', 'mainGas'],
      why: 'Starlight and the weight of the air set how warm the world is.',
      sources: [],
      assumption: true,
    },
  },
  build: {
    durationSec: 20,
    spawnSec: 6,
    seasSec: [3, 8],
    lifeSec: 9,
    ecologySec: 340,
    yearsShown: 4.5e9,
    captions: { start: 'A carbon world forms', life: 'Life stirs in the shallows' },
    why: 'A fast build for the demo: the timings are showtime targets, and the years counter is illustrative.',
    sources: [],
    assumption: true,
  },
  feedbacks: [
    // Rates are change in the stat per unit biomass per ecology second; placeholders for the headless tuner.
    { id: 'photosynthesisOxygen', statId: 'oxygen', driver: 'producerBiomass', rate: 2e-5, why: 'Photosynthesis releases oxygen.', sources: [], assumption: true },
    { id: 'respirationOxygen', statId: 'oxygen', driver: 'consumerBiomass', rate: -6e-5, why: 'Consumers breathe oxygen, pulling it back down.', sources: [], assumption: true },
    { id: 'photosynthesisCo2', statId: 'co2', driver: 'producerBiomass', rate: -2e-6, why: 'Photosynthesis draws carbon dioxide out of the air.', sources: [], assumption: true },
    { id: 'respirationCo2', statId: 'co2', driver: 'consumerBiomass', rate: 1e-6, why: 'Consumers breathe out carbon dioxide.', sources: [], assumption: true },
  ],
  derived: [
    {
      statId: 'temperature',
      model: 'radiativeBalance',
      inputs: ['light', 'co2', 'nitrogen'],
      params: {
        solarConstant: 1361,        // W/m² at 1 AU from a Sun-like star
        luminosity: 1,              // star luminosity relative to the Sun
        albedo: 0.3,
        greenhouseK: 33,            // baseline greenhouse warming with the reference air (1× nitrogen, 0.04% CO₂)
        greenhousePerLnN: 1.44,     // K per ln(nitrogen): about 1 K per doubling (Goldblatt 2009)
        nitrogenRef: 1,             // × Earth
      },
      why: 'Absorbed starlight balances the heat the planet radiates, with a greenhouse that thicker air strengthens a little.',
      sources: ['goldblatt2009'],
      assumption: true,
    },
    {
      statId: 'pressure',
      model: 'partialPressures',
      inputs: ['nitrogen', 'oxygen', 'co2', 'gravity', 'temperature'],
      params: {
        earthN2Bar: 0.78,           // bar of N₂ at 1× Earth nitrogen and 1 g
        barPerPercentO2: 0.01,      // bar of O₂ per % at 1 g
        co2Bar: 0.0004,             // CO₂ partial pressure at 1 g (the 0.04% reference)
      },
      why: 'Each gas weighs on the ground in proportion to how much there is and how hard gravity pulls, plus water vapour.',
      sources: [],
      assumption: true,
    },
  ],
  limits: [
    {
      id: 'tooCold',
      statId: 'temperature',
      side: 'below',
      model: 'fixed',
      params: { value: -50 },
      reason: 'Too cold for surface life',
      boxEffect: 'freeze',
      why: 'Surface life survived Snowball Earth conditions; our model follows surface life only, and the edge sits well below them.',
      sources: ['hoffman2017'],
      assumption: true,
    },
    {
      id: 'tooHot',
      statId: 'temperature',
      side: 'above',
      model: 'fixed',
      params: { value: 122 },
      reason: 'Too hot: proteins and DNA break down',
      boxEffect: 'shakeApart',
      why: 'The highest temperature at which any known organism grows is 122 °C; the oceans themselves do not boil away below that.',
      sources: ['takai2008'],
    },
    {
      id: 'tooLittleNitrogen',
      statId: 'nitrogen',
      side: 'below',
      model: 'fixed',
      params: { value: 0.05 },
      reason: 'Not enough nitrogen to build cells',
      boxEffect: 'starve',
      why: 'Life needs nitrogen for proteins and DNA, and it thrived on early Earth with perhaps half of today\'s air pressure; the exact edge is a placeholder.',
      sources: ['som2016'],
      assumption: true,
    },
  ],
  life: {
    rules: {
      maxOrganisms: 1024,
      producerCapacity: 300,
      timeScale: 1,
      metabolism: { activationEnergyKJ: 50, referenceC: 15, compression: 0.03 },
      producer: { lightGain: 1, upkeep: 0.3 },
      consumer: { biteRate: 10, biteSize: 0.12, assimilation: 0.7, upkeep: 0.15, halfFood: 40, interference: 4, grazeShare: 0.6 },
      reproduction: { energyThreshold: 1, childShare: 0.5, maturityAge: 0.3 },
      lifespan: 6,
      toleranceCost: 0.02,
      stressDeath: 1.5,
      edgeStressWeight: 1,
      mutation: { size: 0.075, prefTemp: 0.6, tolerance: 0.3, chem: 0.075, roleFlip: 0 },
      bounds: { size: [0.2, 5], tolerance: [1, 30] },
      chemTrait: { kind: 'oxygenNeed', halfSaturation: 2, aerobicBonus: 1, baseMaxSize: 0.5, maxSizePerPercent: 0.1 },
    },
    composition: { c: 0.85, si: 0.0, o: 0.15 },
    ledger: {},   // typed when sim/ecology.ts lands
    inputs: {
      solvent: {
        rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100],   // g/cm³, mPa·s, –, °C (water at 20 °C)
        why: 'Water\'s density, viscosity and permittivity at 20 °C, and its liquid range at 1 bar.',
        sources: [],
        assumption: true,
      },
      airDensity: {
        scale: 0.05,   // INFERRED, issue #7: Earth air (1.2 kg/m³) → 0.06, silicon air (about 13 kg/m³) → 0.67 on a scale where unbuoyed carbon tissue = 1
        why: 'Real gas density P·M/(R·T) times this scale lands in develop()\'s range, so thick air lets floaters evolve and thin air does not.',
        sources: [],
        assumption: true,
      },
      tissueDensity: {
        C: 1.05, Si: 2.2,   // g/cm³
        why: 'Carbon tissue is about as dense as water; silicon-based tissue is much denser.',
        sources: [],
        assumption: true,
      },
      scalings: {   // issue #7: our stats → F's heat, light and hunger ranges
        lightFull: 1,         // starlight (× Earth) at which F's light input saturates
        hungerPerScarcity: 1, // Hunger = plant scarcity (demand ÷ supply) × this
      },
    },
  },
  terrain: {
    patchSize: 400,
    base: { amplitude: 30, octaves: 5, frequency: 0.004, lacunarity: 2, gain: 0.5, warp: 40 },
    spawn: { shoreDistance: 60 },
    heatSolventSpan: 120,   // −60..60 °C maps to 0..1, so 0 °C (freezing) sits at 0.5
    machines: [
      { id: 'M3', rate: 0.01, params: { heatPeak: 0.5, heatWidth: 0.2, finHeight: 6 } },       // frost fins, hoodoos
      { id: 'M4', rate: 0.01, params: { depth: 10, steepnessPerDryHeat: 1.5 } },               // canyons
      { id: 'M5', rate: 0.01, params: { bands: 6, bandThickness: 0.3 } },                      // strata
      { id: 'M6', rate: 0.01, params: { shallowDepth: 4, height: 5 } },                        // shell stone
    ],
    why: 'Placeholder terrain numbers, to be tuned by eye and by the spawn-shore test.',
    sources: [],
    assumption: true,
  },
  starType: 'G-type',
};
