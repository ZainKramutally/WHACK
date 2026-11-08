// The silicon world (status: speculative). The reasoning chain and caveat are verbatim from CLAUDE.md.
// The N₂ vapour-pressure table is NIST WebBook data (issue #9); terrain numbers track issue #14, life input scalings issue #7.
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
      text: "In the cold, silicon's weakness becomes its strength. At −183 °C, carbon chemistry is all but frozen. Silicon's weaker, more reactive bonds can keep reacting, and silicon compounds may dissolve in liquid nitrogen better than carbon compounds do (NRC 2007; an assumption). Petkowski 2020 cautions that solubility of all molecules in cryosolvents, organosilicons included, is extremely low, which is part of the caveat below. This is why this world runs on silicon rather than carbon.",
      sources: ['nrc2007', 'petkowski2020'],
      assumption: true,   // NRC 2007 says silicon species "might have greater solubility" in N₂; Petkowski 2020 finds solubility extremely low for everything
    },
    {
      text: "The seas set the air. Nitrogen is only liquid between about −210 °C and −147 °C (its critical point). Because the seas and the air are both nitrogen, the seas evaporate or condense until the air pressure matches nitrogen's vapour pressure at that temperature. Around −183 °C that is about 3 to 4 bar, so this world has thick air, fixed by its temperature. Titan, at Saturn's distance from the Sun, is a real cold world with a thick nitrogen atmosphere and surface seas (of methane and ethane, not nitrogen).",
      sources: ['nistN2', 'fulchignoni2005', 'stofan2007'],   // NIST for the liquid range and vapour pressure; Huygens and Cassini for Titan
    },
  ],
  caveat:
    'Most chemists doubt this: almost nothing dissolves in liquid nitrogen, and chemistry there is extremely slow. Petkowski, Bains and Seager (2020) conclude that no environment makes silicon-based life plausible. This world is our best-reasoned guess, not a prediction.',
  ranges: {
    gravity: [0.5, 1.0],
  },
  // Nitrogen 30 × Earth's per m²: Titan's air alone holds about 14 × (1.47 bar at 1.35 m/s², Fulchignoni 2005), so tens of × is the
  // right order for a cold world. At −183 °C and 0.75 g the air holds about 6 ×, leaving about 24 × in the seas: roughly 240 m of liquid
  // N₂ spread over the whole surface, or about 500 m over the ~50% it covers, against Ligeia Mare's measured ≥160 m (Mastrogiuseppe 2014).
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
    freezeC: -210,     // triple point 63.14 K = −210.01 °C at 0.1252 bar (NIST)
    criticalC: -147,   // critical point 126.2 K = −146.95 °C at 33.96 bar (NIST)
    solidSinks: true,  // solid nitrogen is denser than the liquid (Scott 1976; NIST has no solid-phase density, so the figure is not in config)
    // Saturation vapour pressure of N₂, [°C, bar]: NIST Chemistry WebBook fluid saturation properties, retrieved 2026-11-07,
    // at 5 °C steps from the triple point to the critical point, plus the normal boiling point and −183 °C (the default start).
    vapourPressure: [
      [-210, 0.1252], [-205, 0.29159], [-200, 0.5985], [-195.8, 1.0127], [-195, 1.1118], [-190, 1.9069],
      [-185, 3.0663], [-183, 3.6511], [-180, 4.6771], [-175, 6.8303], [-170, 9.6204], [-165, 13.147],
      [-160, 17.517], [-155, 22.855], [-150, 29.331], [-147, 33.889],
    ],
    fixedPoints: { triplePressureBar: 0.1252, criticalPressureBar: 33.96, liquidDensityAtTripleKgM3: 867.2 },
    sources: ['bains2004', 'petkowski2020', 'nrc2007', 'nistN2', 'edejer1967', 'scott1976'],
  },
  stats: [
    { id: 'temperature', label: 'Surface temperature', unit: '°C', earthValue: 15, why: 'Cold keeps weak silicon bonds intact and the nitrogen seas liquid; the distant star sets it.', sources: ['petkowski2020'], assumption: true },
    { id: 'pressure', label: 'Surface pressure', unit: 'bar', earthValue: 1, why: "While nitrogen seas exist, they hold the air at nitrogen's vapour pressure at this temperature (NIST).", sources: ['nistN2'] },
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
    { id: 'star', label: 'Star', value: 'Sun-like, about 10× farther away', earthValue: 'The Sun', why: "Explains the cold; at Saturn's distance, Titan's surface is about −180 °C.", sources: ['fulchignoni2005'], assumption: true },
    { id: 'bodyChemistry', label: 'Body chemistry', value: 'Silicon–nitrogen compounds, with silicon-nitride ceramic plates', earthValue: 'Carbon chains with some oxygen', why: 'With no oxygen, silicon bodies are built from silicon–nitrogen compounds, and silicon nitride is a real, very hard ceramic.', sources: [], assumption: true },
    { id: 'feedstock', label: 'Silicon feedstock', value: 'Reduced silicon nitride and silicide minerals, powered by dim starlight', earthValue: 'Carbon dioxide fixed by sunlight', why: 'Silicon nitride (nierite) occurs in reduced enstatite chondrites, so a reduced world can hold it as rock; making silanes from silica would cost far more energy than this world has. Caveat: breaking the N≡N bond to fix nitrogen is energetically costly, which the model folds into upkeep.', sources: ['lee1995'], assumption: true },
    { id: 'rock', label: 'Ground', value: 'Silicide, nitride and water-ice bedrock, with silicon-nitride crusts', earthValue: 'Silicate rock with limestone built by life', why: 'Silicide lies at the shore, nitride (nierite) mid-ground and water ice in the highlands; water exists here only as frozen bedrock, and the ice arches and spires are left over from formation.', sources: ['keil1968', 'lee1995'], assumption: true },
  ],
  features: {
    organism: {
      name: 'Silicon animal',
      description: 'Radial faceted bodies are the model default; an explicit gene gate also allows a front-first walker, with shell coverage set separately by its plates gene (speculative).',
      statIds: ['temperature', 'oxygen'],
      factIds: ['bodyChemistry'],
      why: 'The model uses radial crystal bodies by default, with a gene-gated front-first walker exception; both silicon body grammars are explicit design assumptions.',
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
      why: "The air is thick compared with Earth's because the nitrogen seas hold it at their vapour pressure; it thins as the world cools. Titan's nitrogen air is thick too.",
      sources: ['nistN2', 'fulchignoni2005'],
      assumption: true,   // the star-distance part of this card is still ours
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
    { id: 'decayNitrogenReturn', statId: 'nitrogen', driver: 'deadBiomass', rate: 1.2e-3, why: 'When organisms die, their bodies return the nitrogen.', sources: [], assumption: true },
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
      params: {},   // reads the solvent's vapourPressure table (NIST WebBook)
      why: "While the seas exist, the air pressure equals nitrogen's vapour pressure at the surface temperature.",
      sources: ['nistN2', 'edejer1967'],
    },
    {
      statId: 'seaCover',
      model: 'seaVolume',
      inputs: ['nitrogen', 'temperature', 'gravity'],
      params: {
        earthN2Bar: 0.78,   // bar of N₂ at 1× Earth nitrogen and 1 g
        halfVolume: 20,     // sea volume (× Earth N₂) at which cover reaches half its maximum; the saturating form is invented. At the 30× default it gives about 50% cover and sea depth of hundreds of metres (Titan's Ligeia Mare: ≥160 m)
        maxCover: 0.9,      // cover approached as the seas deepen (a fraction, 0..1)
      },
      why: 'Sea cover follows the nitrogen the air cannot hold: whatever is left over lies in the seas, and it saturates as the seas deepen; sized so the default seas are hundreds of metres deep, as on Titan.',
      sources: ['mastrogiuseppe2014'],
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
      sources: ['bains2004', 'nistN2', 'scott1976'],
      assumption: true,   // the freezing point is NIST data; "nitrogen ice sinks" is not checked against a density source (NIST has none for the solid)
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
      sources: ['nistN2'],
    },
    {
      id: 'seasGone',
      statId: 'seaCover',
      side: 'below',
      model: 'seasEmpty',
      params: { minCover: 0 },
      reason: 'Seas boil away: too little nitrogen to hold them (speculative)',
      boxEffect: 'dryUp',
      why: 'A nitrogen sea can only exist if the planet has more nitrogen than its air can hold at this temperature; a smaller inventory boils away completely at a lower temperature.',
      sources: ['fulchignoni2005'],
      assumption: true,
    },
    {
      id: 'oxygenRusts',
      statId: 'oxygen',
      side: 'above',
      model: 'fixed',
      // %, a trace. Below 0.1% of the slider's 0–40% track, so the thumb reads as pinned at zero. The true threshold is likely far lower
      // (lab silicon grows a native oxide in air within hours), so this is a display choice, not a measurement.
      params: { value: 0.01 },
      reason: 'Free oxygen turns silicon into rock (speculative)',
      boxEffect: 'rust',
      why: 'Silicon bonds to oxygen extremely strongly, so any more than a trace locks it away as rock; the exact trace level is our choice.',
      sources: ['petkowski2020'],
      assumption: true,
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
      mutation: { size: 0.075, prefTemp: 0.6, tolerance: 0.3, chem: 0.075, roleFlip: 0, sizeBoost: 2, jumpRate: 0.012, jumpScale: 0.4 },   // assumption: true. Rare large jumps, as in punctuated equilibrium (Gould and Eldredge 1972): species stay stable, and occasional jumps found new ones
      bounds: { size: [0.2, 5], tolerance: [1, 30] },
      chemTrait: { kind: 'coldStability', warmRelief: 0.5, cost: 0.2 },
    },
    composition: { c: 0.1, si: 0.9, o: 0.0 },
    founders: {
      prefTemp: -183, // °C: liquid nitrogen at about 3.6 bar, the Temperature slider's silicon default
      tolerance: 8, // °C either side of prefTemp; the same spread as carbon, so the two worlds compare fairly
      chem: 0.5, // cold stability, 0..1: moderately robust Si–Si chains
      why: 'Founders start adapted to the starting climate with a moderate tolerance and cold stability; mutation does the rest.',
      sources: [],
      latent: {   // the run seed draws the founders' mean for each of these inside its bounds, so every run starts from a differently-leaning lineage (Gould 1989; Blount, Borland and Lenski 2008)
        diet: [0.02, 0.3], buoy: [0, 0.7], eyes: [0.05, 0.6], glow: [0, 0.35], sociality: [0.05, 0.85], gape: [0.1, 0.45],
        plates: [0, 0.35], horns: [0, 0.35], segments: [0.05, 0.7], limbLen: [0.1, 0.7], budShare: [0.3, 1], budMax: [0.1, 0.9],
      },
      assumption: true,
    },
    // Ecology scalings (issue #19, all assumption: true). Tuned on the demo seed so legs, plates and hunters appear together by ~340 ecology-s.
    ledger: {
      massUnit: 1, // kg of develop() mass per matter unit (unit conversion)
      floraLightGain: 100, // assumption: crystalline flora is adapted to ~1% starlight, so it still grows; eyes and glow still see the real light
      upkeepScale: 0.02, // converts B0·M^0.75 into matter per ecology second; sets generation time near 25 s
      cellMass: 40, // matter in a cell fully covered by flora
      shadeK: 4, // Beer–Lambert canopy shading of ground mats. assumption: true: raised from 1.2 so a dense canopy starves the mat under it and cells shift between mat- and canopy-dominant (flora tune)
      waterAttn: 0.1, // light lost per metre of liquid depth. assumption: true (issue #31): 0.3 left deep cells at about half the food of the shallows and only 11–28% of animals in the sea; 0.1 gives 55% in water (41% deep) and 69% of swimmers in water on silicon with population and OTU unchanged
      canopyRate: 0.45, // canopy growth relative to mat growth. assumption: true: raised from 0.3 with shadeK so 15–30% of flora cells are canopy-dominant (flora tune)
      floraDecay: 0.035, // share of flora lost per ecology second; returned as nutrients. assumption: true: raised from 0.02 for faster turnover, so mat and canopy keep trading places (flora tune)
      spread: 0.5, // how strongly neighbouring mats seed an empty cell, so flora colonises land from the shore
      seedMat: 0.3, // flora biomass planted in the shallows when life appears
      shallowMax: 2, // liquid depth (m) that counts as shallows, where life starts
      deepLiquid: 6, // liquid depth (m) that gives full shelter
      wadeDepth: 0.5, // deepest liquid (m) a walker can cross
      growRate: 0.05, // assumption: true. A juvenile turns surplus energy into body at 5% of its mass per ecology second, so a large mutant is born small (never larger than its parent) and grows up
      meatAssim: 0.5, // assumption: true. A hunter keeps about half of a whole kill (carnivore assimilation is high); grazing a thin mat returns only the 6-18% trophic transfer (owner ruling 2026-11-08)
      grazeReach: 1, // assumption: true. A grazer feeds one extra cell out per metre of body length, up to 2 cells
      canopyReach: 0.6, // assumption: true. Metres of limb a body needs to reach canopy biomass: tall bodies open food small ones cannot get (megafauna niche, owner ruling 2026-11-08)
      deepScale: 0.9, // assumption: true. Body length (m) a swimmer needs to feed below the shallows: only large swimmers use deep-water food
      intakeExp: 1.0, // assumption: true. Same megafauna rule as carbon (one exponent for both worlds, so the comparison is fair)
      intake: 15, // assumption: raised so slow-pace silicon grazers still bud within their lifespan, and so a collapsed population regrows visibly (about 40 s) after a heat wall
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
      // Conditions shape bodies (owner ruling 2026-11-08). No aerobic terms (aerobicRef 0): silicon life is not aerobic, so O₂ = 0 is neutral. No nitrogen-limited producers: the seas hold most of the nitrogen.
      thermalRefC: -183, // °C at which skin neither loses nor sheds heat: the world's default temperature; assumption: true
      thermalSpanC: 25, // °C from the reference to full heat or cold load, scaled to the narrow living band; assumption: true
      thermalK: 3, // assumption: true (same form as carbon)
      thermalSurfRef: 0.035, // m² per kg^0.75 of a typical founder-lineage body in this world (measured from develop())
      supportRef: 0.09, // limb load of a typical body in this world, already paid for in upkeepScale; assumption: true
      supportCost: 3, // assumption: true (square-cube, McMahon 1973)
      strandDrain: 200, // upkeep multiplier extra for a swimmer whose cell has dried: it loses energy fast unless it reaches liquid (GitHub #55); assumption: true
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
      flight: {
        spanPerLength: 6,   // body lengths of wing span at full wing gene (wingSpan 1.0)
        powerFactor: 1.2,   // ε: profile and parasite power on top of ideal induced power (Pennycuick's minimum-power speed carries roughly +20% to +50%)
        muscleFrac: 0.25,   // flight-muscle share of body mass (birds 15–35%)
        specificPower: 150,   // W per kg of flight muscle at 1 kg, full aerobic scope (mechanical output of bird flight muscle, order 100–250 W/kg)
        massRef: 1,   // kg
        powerExp: 0.33,   // specific power ∝ m^−1/3: wingbeat frequency falls with size, so big bodies have less power per kilo
        o2Ref: 21,   // % O₂ where scope = 1: Earth
        siliconScope: 0.5,   // silicon metabolism is not O₂-limited; a neutral scope
        costBase: 0.3,   // develop() cost of flight at zero power ratio: a little dearer than a swimmer's glide
        costSlope: 4,   // develop() cost per (P_req/P_av)²
        costInfeasible: 40,   // added cost when P_req ≥ P_av: such bodies cannot fly
        forageLengths: 3,   // fliers forage about three body lengths above the ground or canopy
        cruiseFrac: 0.8,   // cruise at 80% of the ceiling when travelling or fleeing
        altClock: 30,   // ecology seconds compress real flight: metres climbed per ecology second = climb speed (m/s) × this
        buoyRise: 5,   // a gas-bag body drifts up by its own lightness
        sinkRate: 20,   // m per ecology second when descending
        why: 'Flight needs power ∝ weight^1.5 over the square root of air density times wing area; the muscles supply power ∝ muscle mass times aerobic scope, so light, big-winged bodies in thick air and low gravity fly highest.',
        sources: ['pennycuick2008', 'ellington1984', 'marden1994'],
        assumption: true,   // every coefficient here is a typical-bird order of magnitude, not fitted
      },
      economics: {
        gravityWalk: 3, // assumption: true (same form as carbon)
        gravityScaleRef: 0.5, // assumption: true
        why: 'Weight rises with the cube of body length and limb strength with the square, so long limbs on big bodies cost more to walk on at high gravity.',
        sources: ['mcmahon1973', 'biewener1990'],
      },
      scalings: {
        lightFull: 1,
        hungerPerScarcity: 1,
      },
    },
  },
  terrain: {
    patchSize: 400,
    base: { amplitude: 30, frequency: 0.008, octaves: 5, lacunarity: 2, gain: 0.5, warpAmp: 30, warpFreq: 0.0045, exponent: 1.0, rampRange: 0.3, rampDetail: 0.3 },
    spawn: { shoreDistance: 30 },
    heatSolventSpan: 40,   // −230..−190 °C maps to 0..1, so −210 °C (freezing) sits at 0.5
    machines: [
      { id: 'M2', rate: 0.01, params: { rimHeight: 2.5, bandCenter: 0.08, bandWidth: 0.2, patchFreq: 0.05, threshold: 0.45 } },   // silicon-nitride crusts at the sea margin
      { id: 'M4', rate: 0.01, params: { depth: 8, widthWet: 35, widthDry: 20, steepWet: 1.35, steepDry: 3.2, dryStart: 0.55, dryEnd: 0.95, meanderAmp: 35, meanderFreq: 0.01, offsetFrac: 0.25 } },   // canyons
      { id: 'M5', rate: 0.01, params: { bandH: 4, sharpness: 0.6, strength: 0.5 } },                                              // strata terraces
      { id: 'M9', rate: 0.01, minerals: ['nitride'], params: { spikeHeight: 14, size: 10, density: 0.12, girth: 0.5, sharp: 1.6 } },   // sparse hexagonal nitride crystal spikes (stylised, declared illustration: 10 m cells so the 2 m mesh resolves them)
    ],
    relics: [
      { kind: 'iceArch', count: 3, minerals: ['waterIce'], params: { height: 28, radius: 5.5, span: 38 } },
      { kind: 'iceSpire', count: 4, minerals: ['waterIce'], params: { height: 50, radius: 6 } },
    ],
    why: 'Gentle relief (about 20 m) with 28 m relic ice arches (about 35 m to the top of the span) and 50 m spires on a 400 m patch, big enough to read from spawn: Titan seas are over 160 m deep, but a walkable patch needs far less. Placeholder values, tuned by eye. Nitride crystal spikes (M9) are stylised, declared illustration: 10 m cells because the terrain mesh is about 2 m per vertex.',
    sources: ['mastrogiuseppe2014'],
    assumption: true,
    crust: {
      minerals: [
        { id: 'silicide', label: 'Silicide', description: 'Metallic grains of silicon-bearing iron, as in the most oxygen-poor meteorites; they turn to silica if oxygen reaches them.', share: [0.30, 0.50], elevation: 0.25, supply: { c: 1, si: 1.6, o: 1 }, oxidises: true, pick: { label: 'Metal-rich', hint: 'Silicon-bearing metal: the richest feedstock' },
          why: 'Reduced silicon in metal-silicide form is a plausible rich feedstock on an oxygen-poor world, and oxygen would turn it to silica rock.', sources: ['keil1968'], assumption: true },
        { id: 'nitride', label: 'Nitride (nierite)', description: 'Hard silicon-nitride rock, found in oxygen-poor meteorites.', share: [0.25, 0.40], elevation: 0.5, supply: { c: 1, si: 1.2, o: 1 }, oxidises: false, pick: { label: 'Nitride', hint: 'Hard silicon-nitride rock: a steady feedstock' },
          why: 'Nierite (Si3N4) occurs naturally in enstatite chondrites, so reduced silicon nitride is a plausible feedstock here.', sources: ['lee1995'], assumption: true },
        { id: 'waterIce', label: 'Water ice', description: 'Water ice, hard as rock at −183 °C; it holds no silicon, so nothing grows on it.', share: [0.15, 0.30], elevation: 0.9, supply: { c: 0, si: 0, o: 0 }, oxidises: false,
          why: 'Water exists here only as frozen bedrock (the relic ice landmarks); it carries no usable silicon.', sources: [], assumption: true },
      ],
      patchCells: 12,
      rustOxygen: 2,
      favour: 0.65,   // assumption: as on carbon
      why: 'Three rock types sorted by height; the minerals, shares and multipliers are placeholders, and the silicon feedstock is speculative.',
      sources: [],
      assumption: true,
    },
  },
  starType: 'G-type',
};
