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
      text: 'Photosynthesis raises oxygen and draws down carbon dioxide, and consumers do the reverse. We treat net production as a stand-in for organic carbon burial, which really took billions of years (Berner and Canfield 1989).',
      sources: ['berner1989'],
      assumption: true,
    },
  ],
  ranges: {
    gravity: [0.8, 1.3],
    co2: [0.1, 0.35],      // % at world start: still several times today's 0.04%, and life nudges it from here
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
    // Saturation vapour pressure of water, [°C, bar]. Checked against the NIST WebBook on 2026-11-07: 10 to 374 °C agree within 0.3%
    // (the 100 °C entry is 1 atm, NIST gives 1.0142 bar). The entries below 0 °C are ice sublimation, not checked.
    vapourPressure: [
      [-50, 0.00004], [-20, 0.00103], [0, 0.00611], [10, 0.01228], [20, 0.02339], [30, 0.04247],
      [40, 0.07384], [50, 0.1235], [60, 0.1995], [70, 0.3119], [80, 0.4739], [90, 0.7014],
      [100, 1.0132], [110, 1.4338], [120, 1.985], [150, 4.76], [200, 15.55], [250, 39.7],
      [300, 85.8], [374, 220.6],
    ],
    sources: ['nistH2O'],
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
    // Rates are change in the stat per unit biomass per ecology second, scaled to the Ecology's biomass units
    // (producerBiomass ≈ 3,960 flat (deeper water carries flora), consumerBiomass ≈ 960 with real, massive bodies); placeholders for the headless tuner (issues #31, #11).
    { id: 'photosynthesisOxygen', statId: 'oxygen', driver: 'producerBiomass', rate: 2.5e-6, why: 'Photosynthesis releases oxygen.', sources: [], assumption: true },
    { id: 'respirationOxygen', statId: 'oxygen', driver: 'consumerBiomass', rate: -2.4e-6, why: 'Consumers breathe oxygen, pulling it back down.', sources: [], assumption: true },
    { id: 'photosynthesisCo2', statId: 'co2', driver: 'producerBiomass', rate: -2.5e-7, why: 'Photosynthesis draws carbon dioxide out of the air.', sources: [], assumption: true },
    // Decomposition: plant respiration and litter decay turn part of what photosynthesis fixed back into CO₂, using oxygen.
    // Sized so photosynthesis and decay nearly cancel at the ecology's steady state (producers ≈ 3,960, consumers ≈ 960), so the air holds still
    // when idle and moves when the population shifts (issue #31).
    { id: 'decayOxygen', statId: 'oxygen', driver: 'producerBiomass', rate: -1.91e-6, why: 'Plants and the litter they shed are respired and decay, using oxygen.', sources: [], assumption: true },
    { id: 'decayCo2', statId: 'co2', driver: 'producerBiomass', rate: 2.21e-7, why: 'Plants and the litter they shed are respired and decay, returning carbon dioxide.', sources: [], assumption: true },
    { id: 'respirationCo2', statId: 'co2', driver: 'consumerBiomass', rate: 1.2e-7, why: 'Consumers breathe out carbon dioxide.', sources: [], assumption: true },
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
        greenhousePerLnN: 1.44,     // K per ln(nitrogen): about 1 K per doubling (Goldblatt 2009, sourced only for about 0.5–2×). Beyond that it is a log extrapolation: +10 K at 1,000× and −7 K at 0.01×, assumption: true
        nitrogenRef: 1,             // × Earth
        referenceCo2: 0.04,         // %, the CO₂ the baseline greenhouse already includes (Earth today)
        co2PerDoublingK: 3,         // K of extra warming per doubling of CO₂ (Myhre 1998 forcing; Sherwood 2020 sensitivity about 3.1 K)
      },
      why: 'Absorbed starlight balances the heat the planet radiates, with a greenhouse that thicker air and more CO₂ strengthen (about 3 K per doubling).',
      sources: ['goldblatt2009', 'myhre1998', 'sherwood2020'],
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
      why: 'Surface life survived the Snowball Earth glaciations, which were the coldest conditions Earth is known to have had, and our model follows surface life only; the edge is a round figure chosen below them, not a measured limit.',
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
      why: 'The highest temperature at which any known organism grows is 122 °C (under deep-sea pressure; 116 °C at low pressure); the oceans themselves do not boil away below that.',
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
      // 0.05 × Earth is about 0.04 bar of N₂ at 1 g: under a quarter of Som 2016's central estimate for the whole 2.7 Ga atmosphere
      // (0.23 bar, upper bound 0.5 bar), and still above the pressure at which water would boil at 15 °C (0.017 bar).
      why: 'Life needs nitrogen for proteins and DNA, and it thrived on early Earth with under half of today\'s air pressure; the edge sits at about 0.04 bar of N₂, well below that, yet still thick enough to keep water liquid at 15 °C (our choice, not a measured limit).',
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
      lifespan: 40,   // ecology seconds at M = 1 (scales with M^0.25); 6 was the old population.ts value and starves the new ecology's generation time
      toleranceCost: 0.02,
      stressDeath: 1.5,
      edgeStressWeight: 1,
      mutation: { size: 0.075, prefTemp: 0.6, tolerance: 0.3, chem: 0.075, roleFlip: 0 },
      bounds: { size: [0.2, 5], tolerance: [1, 30] },
      chemTrait: { kind: 'oxygenNeed', halfSaturation: 2, aerobicBonus: 1, baseMaxSize: 0.5, maxSizePerPercent: 0.1 },
    },
    composition: { c: 0.85, si: 0.0, o: 0.15 },
    founders: {
      prefTemp: 15, // °C: Earth's mean, the Temperature slider's default
      tolerance: 8, // °C either side of prefTemp; wide enough that founders survive the whole living band, narrow enough for climate genes to matter
      chem: 0.5, // oxygen need, 0..1: half-aerobic founders, so the oxygen cap on size bites but does not starve them
      why: 'Founders start adapted to the starting climate with a moderate tolerance and oxygen need; mutation does the rest.',
      sources: [],
      assumption: true,
    },
    // Ecology scalings (issue #19, all assumption: true). Tuned on the demo seed so legs, plates and hunters appear together by ~340 ecology-s.
    ledger: {
      massUnit: 1, // kg of develop() mass per matter unit (unit conversion)
      floraLightGain: 1, // flora light efficiency: effective light = min(1, light × this)
      upkeepScale: 0.02, // converts B0·M^0.75 into matter per ecology second; sets generation time near 25 s
      cellMass: 40, // matter in a cell fully covered by flora
      shadeK: 1.2, // Beer–Lambert canopy shading of ground mats
      waterAttn: 0.1, // light lost per metre of liquid depth. assumption: true (issue #31): 0.3 left deep cells at about half the food of the shallows and only 11–28% of animals in the sea; 0.1 gives 55% in water (41% deep) and 69% of swimmers in water on silicon with population and OTU unchanged
      canopyRate: 0.3, // canopy growth relative to mat growth
      floraDecay: 0.02, // share of flora lost per ecology second; returned as nutrients
      spread: 0.5, // how strongly neighbouring mats seed an empty cell, so flora colonises land from the shore
      seedMat: 0.3, // flora biomass planted in the shallows when life appears
      shallowMax: 2, // liquid depth (m) that counts as shallows, where life starts
      deepLiquid: 6, // liquid depth (m) that gives full shelter
      wadeDepth: 0.5, // deepest liquid (m) a walker can cross
      intake: 2, // matter per second per M^0.75 at full appetite; raised from 1.2 so a collapsed population regrows in about 90 s at live speed
      speed: 1.5, // cells per ecology second
      moveCost: 0.01, // matter per M^0.75 per cell moved, times the locomotion mode's cost
      catchRate: 0.4, // catch attempts per ecology second when a prey is in reach; tuned so hunters persist
      buildRate: 0.05, // stone matter per M^0.75 per ecology second while a builder rests at home
      senseBase: 0.7, // cells an animal sees with no eyes
      senseGain: 0.8, // extra cells seen at full eyes in full light
      lureWeight: 0.5, // how strongly grazers are drawn to glow in the dark
      glowCost: 0.3, // extra upkeep share at full glow
      sizeRef: 1, // body length (m) that counts as size 1 for the oxygen cap
      hungerTime: 10, // seconds of standing flora counted as one second of supply, for Hunger
      founders: 24, // seeded capsule worms when life appears (at least 24)
      supplyC: 40, // starting carbon nutrient per cell, in matter units
      supplySi: 0, // carbon bodies and flora hold no silicon, so none is supplied
      supplyO: 10, // starting oxygen nutrient per cell, in matter units
    },
    inputs: {
      solvent: {
        rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100],   // g/cm³, mPa·s, –, °C (water at 20 °C)
        why: 'Water\'s density, viscosity and permittivity at 20 °C, and its liquid range at 1 bar.',
        sources: [],
        assumption: true,
      },
      airDensity: {
        molarMass: 0.028,   // kg/mol: the main gas is nitrogen (N₂ 28.0134 g/mol, standard)
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
    base: { amplitude: 80, frequency: 0.009, octaves: 5, lacunarity: 2, gain: 0.5, warpAmp: 30, warpFreq: 0.0045, exponent: 1.0, rampRange: 0.18, rampDetail: 0.2 },
    spawn: { shoreDistance: 36 },
    heatSolventSpan: 120,   // −60..60 °C maps to 0..1, so 0 °C (freezing) sits at 0.5
    machines: [
      { id: 'M3', rate: 0.01, params: { halfWidth: 0.25, finHeight: 14, finSpacing: 14, finWarp: 10, finSharp: 6, breakup: 0.35, uplandMin: 0.1 } },   // frost fins, hoodoos (water only, heatSolvent near 0.5)
      { id: 'M4', rate: 0.01, params: { depth: 18, widthWet: 35, widthDry: 20, steepWet: 1.35, steepDry: 3.2, dryStart: 0.55, dryEnd: 0.95, meanderAmp: 35, meanderFreq: 0.01, offsetFrac: 0.25 } },   // canyons (progress = age × past liquid)
      { id: 'M5', rate: 0.01, params: { bandH: 6, sharpness: 0.7, strength: 0.8 } },                                                              // strata terraces
      { id: 'M6', rate: 0.01, params: { moundHeight: 4, bandCenter: 0.1, bandWidth: 0.25, moundFreq: 0.03, threshold: 0.5 } },                  // shell stone in the shallows
    ],
    why: 'About 30 m of relief on a 400 m patch reads as coastal hills and shallows like a rocky coast on Earth; every value is a tuned-by-eye placeholder.',
    sources: [],
    assumption: true,
  },
  starType: 'G-type',
};
