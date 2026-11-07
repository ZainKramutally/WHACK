// The silicon world (status: speculative). The reasoning chain and caveat are verbatim from CLAUDE.md.
// The N₂ vapour-pressure table is approximate (issue #9); terrain numbers track issue #14, life input scalings issue #7.
import type { WorldConfig } from './types';

export const silicon: WorldConfig = {
  id: 'silicon',
  displayName: 'Silicon',
  status: 'speculative',
  demoSeed: 2611,   // pinned demo seed (placeholder until the headless tuner picks one)
  reasoning: [
    {
      text: "Silicon is everywhere, yet life chose carbon. Earth's crust is about 28% silicon and 0.02% carbon, but living things are about 18% carbon. Something stops silicon.",
      sources: ['petkowski2020'],
    },
    {
      text: 'Silicon bonds to itself weakly. Si–Si is roughly 220 kJ/mol against roughly 350 for C–C, so silicon chains fall apart more easily. Cold slows that down.',
      sources: ['petkowski2020'],
    },
    {
      text: 'Silicon bonds to oxygen extremely strongly. That is why the crust is silica rock. Free oxygen or liquid water would lock silicon away as rock, so this world must have neither. Water can exist only as frozen bedrock.',
      sources: ['petkowski2020'],
    },
    {
      text: "Silicon's hydrogen compounds (silanes) burn on contact with oxygen and break down in water, which reinforces step 3.",
      sources: ['petkowski2020'],
    },
    {
      text: 'So the solvent must be cold and unreactive. The best-discussed candidate is liquid nitrogen (Bains 2004). Nothing in it attacks silicon bonds.',
      sources: ['bains2004', 'petkowski2020'],
    },
    {
      text: "In the cold, silicon's weakness becomes its strength. At −183 °C, carbon chemistry is all but frozen. Silicon's weaker, more reactive bonds can keep reacting, and silicon compounds may dissolve in liquid nitrogen better than carbon compounds do (Petkowski 2020, Appendix C; NRC 2007). This is why this world runs on silicon rather than carbon.",
      sources: ['petkowski2020', 'nrc2007'],
    },
    {
      text: "The seas set the air. Nitrogen is only liquid between about −210 °C and −147 °C (its critical point). Because the seas and the air are both nitrogen, the seas evaporate or condense until the air pressure matches nitrogen's vapour pressure at that temperature. Around −183 °C that is about 3 to 4 bar, so this world has thick air, fixed by its temperature. Titan, at Saturn's distance from the Sun, is a real cold world with a thick nitrogen atmosphere and surface seas (of methane and ethane, not nitrogen).",
      sources: [],
      assumption: true,   // NIST nitrogen phase data and Titan figures still to verify (issue #9)
    },
  ],
  caveat:
    'Most chemists doubt this: almost nothing dissolves in liquid nitrogen, and chemistry there is extremely slow. Petkowski, Bains and Seager (2020) conclude that no environment makes silicon-based life plausible. This world is our best-reasoned guess, not a prediction.',
  ranges: {
    gravity: [0.5, 1.0],
  },
  startDefaults: { temperature: -183, nitrogen: 30, oxygen: 0 },
  targets: {
    temperature: [-185, -165],
    pressure: [3, 9],
    gravity: [0.5, 1.0],
    oxygen: [0, 0.01],
    nitrogen: [15, 40],
    seaCover: [25, 65],
    light: [0.005, 0.02],
    pace: [1e-16, 1e-10],   // the uncompressed Arrhenius estimate with Ea 32 kJ/mol, around 1e-13
  },
  solvent: {
    name: 'Liquid nitrogen',
    freezeC: -210,     // triple point, about 63 K
    criticalC: -147,   // critical point, about 126 K
    solidSinks: true,  // solid nitrogen is denser than the liquid
    // Saturation vapour pressure of N₂, [°C, bar]. APPROXIMATE values entered from memory (about 3.6 bar at −183 °C);
    // replace with NIST WebBook data (issue #9). The assumption flag sits on the derived pressure stat.
    vapourPressure: [
      [-210, 0.125], [-203.15, 0.386], [-198.15, 0.76], [-195.8, 1.013], [-193.15, 1.37],
      [-188.15, 2.29], [-183.15, 3.6], [-178.15, 5.4], [-173.15, 7.78], [-168.15, 10.8],
      [-163.15, 14.7], [-158.15, 19.4], [-153.15, 25.1], [-148.15, 31.9], [-147, 33.9],
    ],
    sources: ['bains2004', 'petkowski2020', 'nrc2007'],
  },
  stats: [
    { id: 'temperature', label: 'Surface temperature', unit: '°C', earthValue: 15, why: 'Cold keeps weak silicon bonds intact and the nitrogen seas liquid; the distant star sets it.', sources: ['petkowski2020'], assumption: true },
    { id: 'pressure', label: 'Surface pressure', unit: 'bar', earthValue: 1, why: "While nitrogen seas exist, they hold the air at nitrogen's vapour pressure at this temperature.", sources: [], assumption: true },
    { id: 'gravity', label: 'Gravity', unit: 'g', earthValue: 1, why: 'Cold gas escapes slowly, so even modest gravity holds thick air; Titan holds 1.5 bar at 0.14 g.', sources: [], assumption: true },
    { id: 'oxygen', label: 'Oxygen', unit: '%', earthValue: 21, why: 'Any free oxygen would turn silicon into rock, so this world has none.', sources: ['petkowski2020'] },
    { id: 'nitrogen', label: 'Nitrogen', unit: '× Earth', earthValue: 1, why: 'Set by the Nitrogen slider; most of it sits in the seas, because the air can only hold what the sea pressure allows.', sources: [], assumption: true },
    { id: 'seaCover', label: 'Sea cover', unit: '%', earthValue: 71, why: 'The seas hold whatever nitrogen the air cannot, so they shrink when life locks nitrogen into bodies or warming moves more into the air.', sources: [], assumption: true },
    { id: 'light', label: 'Starlight', unit: '× Earth', earthValue: 1, why: 'A Sun-like star about 10 times farther away than the Sun is from Earth gives about 1% of Earth\'s sunlight.', sources: [], assumption: true },
    { id: 'pace', label: 'Pace of chemistry', unit: '× Earth', earthValue: 1, why: 'Reactions slow sharply in the cold, an Arrhenius estimate of around 10⁻¹³ × Earth (activation energy 32 kJ/mol, lower than the 50 of carbon because Si–Si bonds are weaker); compressed in the time-lapse so evolution is visible.', sources: [], assumption: true },
  ],
  facts: [
    { id: 'mainGas', label: 'Main gas', value: 'Nitrogen', earthValue: 'Nitrogen', why: 'Bulk atmosphere, in balance with the nitrogen seas.', sources: [], assumption: true },
    { id: 'solvent', label: 'Solvent', value: 'Liquid nitrogen', earthValue: 'Water', why: 'Cold, unreactive and does not attack silicon compounds.', sources: ['bains2004', 'petkowski2020'] },
    { id: 'star', label: 'Star', value: 'Sun-like, about 10× farther away', earthValue: 'The Sun', why: "Explains the cold; at Saturn's distance, Titan's surface is about −180 °C.", sources: [], assumption: true },
    { id: 'bodyChemistry', label: 'Body chemistry', value: 'Silicon–nitrogen compounds, with silicon-nitride ceramic plates', earthValue: 'Carbon chains with some oxygen', why: 'With no oxygen, silicon bodies are built from silicon–nitrogen compounds, and silicon nitride is a real, very hard ceramic.', sources: [], assumption: true },
    { id: 'feedstock', label: 'Silicon feedstock', value: 'Reduced silicon nitride and silicide minerals, powered by dim starlight', earthValue: 'Carbon dioxide fixed by sunlight', why: 'Silicon nitride (nierite) occurs in reduced enstatite chondrites, so a reduced world can hold it as rock; making silanes from silica would cost far more energy than this world has. Caveat: breaking the N≡N bond to fix nitrogen is energetically costly, which the model folds into upkeep.', sources: ['lee1995'], assumption: true },
    { id: 'rock', label: 'Ground', value: 'Water-ice bedrock with silicon-nitride crusts', earthValue: 'Silicate rock with limestone built by life', why: 'Water exists here only as frozen bedrock; the ice arches and spires are left over from formation.', sources: [], assumption: true },
  ],
  features: {
    organism: {
      name: 'Silicon animal',
      description: 'A creature built from silicon–nitrogen compounds, with hexagonal faceted segments, straight rod limbs and ceramic plates.',
      statIds: ['temperature', 'oxygen'],
      factIds: ['bodyChemistry'],
      why: "Silicon's stiff, weak bonds only hold together in the cold, so its bodies grow faceted and rod-like (speculative).",
      sources: ['petkowski2020'],
      assumption: true,
    },
    producer: {
      name: 'Crystalline crust',
      description: 'A crust of silicon-nitride crystals growing along the sea margin, left as dead bands when the sea retreats.',
      statIds: ['nitrogen', 'light'],
      factIds: ['bodyChemistry'],
      why: 'Crystals precipitate where the nitrogen sea meets the shore, so the crust follows the sea level (speculative).',
      sources: [],
      assumption: true,
    },
    sea: {
      name: 'Liquid nitrogen sea',
      description: 'A clear, colourless sea of liquid nitrogen that holds the air at its vapour pressure; it freezes solid below −210 °C.',
      statIds: ['temperature', 'seaCover', 'pressure'],
      factIds: ['solvent'],
      why: 'Cold and unreactive, nitrogen does not attack silicon compounds, which is why this world runs on silicon.',
      sources: ['bains2004', 'petkowski2020'],
    },
    ground: {
      name: 'Ice bedrock',
      description: 'Frozen water forms the bedrock, with relic ice arches and spires left over from formation.',
      statIds: ['gravity'],
      factIds: ['rock'],
      why: 'Water locks silicon into rock, so this world must have none as liquid; it exists only as frozen bedrock (speculative).',
      sources: ['petkowski2020'],
      assumption: true,
    },
    sky: {
      name: 'Distant star and thick nitrogen air',
      description: 'A faint, distant star shines through thick nitrogen air at several bar.',
      statIds: ['pressure', 'light'],
      factIds: ['star', 'mainGas'],
      why: "The seas hold the air at nitrogen's vapour pressure, so cold means thick air, as on Titan.",
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
    yearsShown: 6e9,
    captions: { start: 'A silicon world forms (speculative)', life: 'Something stirs in the liquid nitrogen' },
    why: 'A fast build for the demo: the timings are showtime targets, and the years counter is illustrative.',
    sources: [],
    assumption: true,
  },
  feedbacks: [
    // Change in the stat per unit driver per ecology second, scaled to the Ecology's biomass units (producerBiomass ≈ 3,700,
    // consumerBiomass ≈ 1,000, animal deaths ≈ 6 mass/s at the end of the build): lock-up balances decay once the population is steady.
    // Speculative; labelled so in the UI.
    // 'deadBiomass' is biomass of organisms that died per ecology second; the sim must expose it as a driver.
    { id: 'producerNitrogenLock', statId: 'nitrogen', driver: 'producerBiomass', rate: -3e-6, why: 'Bodies are built from silicon–nitrogen compounds, so a growing population locks nitrogen away.', sources: [], assumption: true },
    { id: 'consumerNitrogenLock', statId: 'nitrogen', driver: 'consumerBiomass', rate: -3e-6, why: 'Animals lock nitrogen into their bodies the same way.', sources: [], assumption: true },
    { id: 'decayNitrogenReturn', statId: 'nitrogen', driver: 'deadBiomass', rate: 2.5e-3, why: 'When organisms die, their bodies return the nitrogen.', sources: [], assumption: true },
  ],
  derived: [
    {
      statId: 'temperature',
      model: 'radiativeBalance',
      inputs: ['light'],
      params: {
        solarConstant: 1361,        // W/m² at 1 AU from a Sun-like star
        luminosity: 1,              // star luminosity relative to the Sun
        albedo: 0.3,
        greenhouseK: 0,
        greenhousePerLnN: 0,
        nitrogenRef: 1,
      },
      why: 'Absorbed starlight balances the heat the planet radiates; the starlight is fixed by the orbit, so the temperature moves only with the Temperature slider.',
      sources: [],
      assumption: true,
    },
    {
      statId: 'pressure',
      model: 'vapourPressure',
      inputs: ['temperature'],
      params: {},   // reads the solvent's vapourPressure table (approximate, issue #9)
      why: "While the seas exist, the air pressure equals nitrogen's vapour pressure at the surface temperature.",
      sources: [],
      assumption: true,
    },
    {
      statId: 'seaCover',
      model: 'seaVolume',
      inputs: ['nitrogen', 'temperature', 'gravity'],
      params: {
        earthN2Bar: 0.78,   // bar of N₂ at 1× Earth nitrogen and 1 g
        halfVolume: 20,     // sea volume (× Earth N₂) at which cover reaches half its maximum; the saturating form is invented
        maxCover: 0.9,      // cover approached as the seas deepen (a fraction, 0..1)
      },
      why: 'Sea cover follows the nitrogen the air cannot hold: whatever is left over lies in the seas, and it saturates as the seas deepen.',
      sources: [],
      assumption: true,
    },
  ],
  limits: [
    {
      id: 'seasFreeze',
      statId: 'temperature',
      side: 'below',
      model: 'solventFreezes',
      params: { offset: 0 },
      reason: 'Too cold: the nitrogen seas freeze solid (speculative)',
      boxEffect: 'freeze',
      why: 'Below nitrogen\'s freezing point the solvent locks solid; nitrogen ice sinks, so unlike water ice it gives no insulating lid.',
      sources: ['bains2004'],
      assumption: true,
    },
    {
      id: 'beyondCritical',
      statId: 'temperature',
      side: 'above',
      model: 'solventCritical',
      params: { offset: 0 },
      reason: "Too warm: past nitrogen's critical point (speculative)",
      boxEffect: 'dryUp',
      why: 'Above its critical point nitrogen cannot be a liquid at any pressure.',
      sources: [],
      assumption: true,
    },
    {
      id: 'seasGone',
      statId: 'seaCover',
      side: 'below',
      model: 'seasEmpty',
      params: { minCover: 0 },
      reason: 'Too little nitrogen for seas (speculative)',
      boxEffect: 'dryUp',
      why: 'A nitrogen sea can only exist if the planet has more nitrogen than its air can hold at this temperature; a smaller inventory boils away completely at a lower temperature.',
      sources: [],
      assumption: true,
    },
    {
      id: 'oxygenRusts',
      statId: 'oxygen',
      side: 'above',
      model: 'fixed',
      params: { value: 0.01 },   // %, a trace
      reason: 'Free oxygen turns silicon into rock (speculative)',
      boxEffect: 'rust',
      why: 'Silicon bonds to oxygen extremely strongly, so any more than a trace locks it away as rock.',
      sources: ['petkowski2020'],
      assumption: true,   // the exact trace threshold is ours
    },
  ],
  life: {
    rules: {
      maxOrganisms: 1024,
      producerCapacity: 300,
      timeScale: 1,
      // The same compression exponent as carbon, so the two paces compare fairly. Silicon's activation energy is scaled
      // from carbon's 50 kJ/mol by the bond-strength ratio Si–Si/C–C = 222/346 → 32 kJ/mol (Bell–Evans–Polanyi: weaker
      // bonds, lower barriers; reasoning step 6). assumption: true (issue #1). Uncompressed pace at −183 °C ≈ 2e-13 × Earth.
      metabolism: { activationEnergyKJ: 32, referenceC: 15, compression: 0.03 },
      producer: { lightGain: 1, upkeep: 0.3 },
      consumer: { biteRate: 10, biteSize: 0.12, assimilation: 0.7, upkeep: 0.15, halfFood: 40, interference: 4, grazeShare: 0.6 },
      reproduction: { energyThreshold: 1, childShare: 0.5, maturityAge: 0.3 },
      lifespan: 40,   // ecology seconds at M = 1 (scales with M^0.25); 6 was the old population.ts value and starves the new ecology's generation time
      toleranceCost: 0.02,
      stressDeath: 1.5,
      edgeStressWeight: 1,
      mutation: { size: 0.075, prefTemp: 0.6, tolerance: 0.3, chem: 0.075, roleFlip: 0 },
      bounds: { size: [0.2, 5], tolerance: [1, 30] },
      chemTrait: { kind: 'coldStability', warmRelief: 0.5, cost: 0.2 },
    },
    composition: { c: 0.1, si: 0.9, o: 0.0 },
    // Ecology scalings (issue #19, all assumption: true). Tuned on the demo seed so legs, plates and hunters appear together by ~340 ecology-s.
    ledger: {
      massUnit: 1, // kg of develop() mass per matter unit (unit conversion)
      floraLightGain: 100, // assumption: crystalline flora is adapted to ~1% starlight, so it still grows; eyes and glow still see the real light
      upkeepScale: 0.02, // converts B0·M^0.75 into matter per ecology second; sets generation time near 25 s
      cellMass: 40, // matter in a cell fully covered by flora
      shadeK: 1.2, // Beer–Lambert canopy shading of ground mats
      waterAttn: 0.3, // light lost per metre of liquid depth, so flora lives in the shallows
      canopyRate: 0.3, // canopy growth relative to mat growth
      floraDecay: 0.02, // share of flora lost per ecology second; returned as nutrients
      spread: 0.5, // how strongly neighbouring mats seed an empty cell, so flora colonises land from the shore
      seedMat: 0.3, // flora biomass planted in the shallows when life appears
      shallowMax: 2, // liquid depth (m) that counts as shallows, where life starts
      deepLiquid: 6, // liquid depth (m) that gives full shelter
      wadeDepth: 0.5, // deepest liquid (m) a walker can cross
      intake: 3, // assumption: raised so slow-pace silicon grazers still bud within their lifespan
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
      supplyC: 5, // starting carbon nutrient per cell, in matter units
      supplySi: 40, // starting silicon nutrient per cell, in matter units
      supplyO: 0, // no free oxygen: it would turn silicon into rock
    },
    inputs: {
      solvent: {
        rho: 0.81, mu: 0.16, epsilonR: 1.43, liquidBandC: [-210, -147],   // g/cm³, mPa·s, –, °C (liquid N₂ near 77 K)
        why: "Liquid nitrogen's density, viscosity and permittivity near its boiling point, and its liquid range between freezing and the critical point.",
        sources: [],
        assumption: true,
      },
      airDensity: {
        molarMass: 0.028,   // kg/mol: the main gas is nitrogen (N₂ 28.0134 g/mol, standard)
        scale: 0.05,   // INFERRED, issue #7: Earth air (1.2 kg/m³) → 0.06, this world's air (about 13 kg/m³ at 3.6 bar and −183 °C) → 0.67
        why: "Real gas density P·M/(R·T) times this scale lands in develop()'s range, so this world's thick air gives floaters a physical reason to appear.",
        sources: [],
        assumption: true,
      },
      tissueDensity: {
        C: 1.05, Si: 2.2,   // g/cm³
        why: 'Carbon tissue is about as dense as water; silicon-based tissue is much denser.',
        sources: [],
        assumption: true,
      },
      scalings: {
        lightFull: 1,
        hungerPerScarcity: 1,
      },
    },
  },
  terrain: {
    patchSize: 400,
    base: { amplitude: 24, frequency: 0.006, octaves: 5, lacunarity: 2, gain: 0.5, warpAmp: 30, warpFreq: 0.0045, exponent: 1.2, rampRange: 0.75, rampDetail: 0.25 },
    spawn: { shoreDistance: 60 },
    heatSolventSpan: 40,   // −230..−190 °C maps to 0..1, so −210 °C (freezing) sits at 0.5
    machines: [
      { id: 'M2', rate: 0.01, params: { rimHeight: 3, bandCenter: 0.2, bandWidth: 0.25, patchFreq: 0.05, threshold: 0.45 } },   // silicon-nitride crusts at the sea margin
      { id: 'M4', rate: 0.01, params: { depth: 10, widthWet: 35, widthDry: 20, steepWet: 1.35, steepDry: 3.2, dryStart: 0.55, dryEnd: 0.95, meanderAmp: 35, meanderFreq: 0.01, offsetFrac: 0.25 } },   // canyons
      { id: 'M5', rate: 0.01, params: { bandH: 6, sharpness: 0.6, strength: 0.6 } },                                            // strata terraces
    ],
    relics: [
      { kind: 'iceArch', count: 3, params: { height: 18, radius: 5, span: 24 } },
      { kind: 'iceSpire', count: 5, params: { height: 25, radius: 6 } },
    ],
    why: 'Placeholder terrain numbers, to be tuned by eye and by the spawn-shore test; the ice relics are seeded, not grown.',
    sources: [],
    assumption: true,
  },
  starType: 'G-type',
};
