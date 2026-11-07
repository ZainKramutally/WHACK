# Life Is ▢ Based (working title)

Hackathon project for WHACK 26, targeting the Marshall Wace "New Worlds" challenge. This file is the source of truth for what we are building, the rules the science must follow, and how the code is organised. Read it fully before making changes.

## What we are building

A browser experience built with three.js. The player completes the sentence "Life is ▢ based" by choosing an element from group 14 of the periodic table. A world that suits that chemistry is then generated procedurally around them while they walk through it in third person. Over a little more than two minutes, billions of years of that planet's history play out as a time-lapse: terrain forms, seas fill, an atmosphere settles, life appears, and life and planet change each other over time. A stats panel compares every condition with Earth and explains, in one plain sentence, why it is the way it is.

The project is speculative by design. Our interpretation of "New Worlds" is imagining what new forms of life would look like if life were built on different chemistry. The speculation is the point, but it is disciplined: every world is built outward from real chemistry and physics, so judges can follow the reasoning from "silicon bonds are weaker" all the way to "so this world is frozen and has no oxygen".

The MVP has two worlds. Carbon gives a living world we recognise. Silicon gives a strange, cold, slow, speculative one.

## Context and constraints

The Marshall Wace brief asks for a project that "opens a door to the unexplored", judged on creativity, technical complexity and good presentation (our scoring rubric is in `docs/TRACK.md`). Judging is a strict three-minute slot with the sponsor, presented on our own laptop. Devpost submissions close at 11:00 on Sunday 8 November 2026, and judging starts at 12:30. Unsubmitted projects are ineligible, so submit something by 10:30 even if it is unfinished.

Owners:
- **Engineering lead:** generation (including terrain logic in `src/gen/`), simulation, character and integration.
- **Caden** (creatures and design partner): the creatures (design F logic), the UI (selection screen, panels, cards), and the **art layer**, which sits on top of this logic and only reads it (see "Logic → art interface").

This file covers the logic only. Look decisions (palettes, render style, materials, post-processing) belong to the art layer's own docs. Claude Code assists everyone. Changes that affect the data contract in this file must be agreed with Caden and the design partner first.

## Non-negotiable rules

**Grounded speculation.** Every stat, rate of change and causal explanation starts from known chemistry and physics. Where a world goes beyond what is known, which the silicon world does by design, the reasoning must still follow logically from real properties, and the UI labels it as speculative. Carbon is "known"; silicon is "speculative". Never present speculation as established fact. A speculative world also states the strongest case against it (its `caveat`), so we are never caught out by a judge who knows the literature. The UI marks every `assumption: true` value as an assumption on every world, including the "known" carbon world.

**Science lives in data, not in rendering code.** Every number that describes a world (temperatures, pressures, gas fractions, rates, thresholds, coefficients) lives in that world's config file with a `why` sentence and a `sources` reference. Code may contain the *form* of an equation (for example, a radiative balance or a vapour-pressure lookup), but every coefficient it uses comes from config. Rendering and simulation code never hardcodes a world fact. If a value cannot be sourced, set `assumption: true` on it and open or link a GitHub issue for it (see "Open questions").

**No natural disasters.** Conditions change only through slow, physically sensible processes: stellar brightening, rock weathering, gradual atmospheric escape, and life itself changing the atmosphere (see "Life changes the planet"). No eruptions, impacts, flares or random events.

**Visuals are stylised but never contradict the stats.** The look can be vibrant and art-directed; it does not have to be photoreal. But anything that carries meaning must match the simulation: seas freeze only when the stats say the solvent is below its freezing point, sea level follows the sea-volume stat, forests appear only when life has reached land, and lighting gets warmer or dimmer in step with the star. If a visual and a stat disagree, fix the visual.

**Deterministic demo.** All randomness comes from a seeded generator. Each world has a pinned demo seed, so with the sliders left at their defaults the live run matches rehearsal exactly. The simulation advances in fixed steps of simulated time. The worker paces those steps against the wall clock so the time-lapse plays in real time, running extra steps to catch up when it falls behind. The sequence of states therefore depends only on the seed and the slider input, never on frame rate, so a dropped frame cannot change the outcome.

**Performance.** 60 fps on the demo laptop at the resolution we present at. If it drops, reduce creature or plant counts before cutting features.

## The experience

**Selection screen.** The sentence "Life is ▢ based" with group 14 shown as a column of the periodic table. Carbon and silicon are selectable and show their status labels. The rest of the column (germanium, tin, lead, flerovium) appears greyed out for visual completeness with a one-line reason, for example "Bonds even weaker than silicon's" for germanium, or "Made in a lab; atoms last only seconds" for flerovium. These are not selectable in the MVP. Clicking carbon or silicon selects it (carbon is selected by default). The three condition sliders sit beside the column, and the carbon and silicon cells show live whether their life could survive at the current settings. On the side of the screen, a **particle box** shows the selected element's chemistry as atoms and molecules, reacting live to every change (see "The particle box and the Generate transition"). Clicking **Generate** zooms into the box, and its particles multiply into the new world's ground. There is no loading screen.

**Generation and exploration.** The world builds itself in phases (below). The player character spawns as soon as the particles have become solid ground, about six seconds in, and can walk and look around for the rest of the run. The screen shows only the world. Stats, sliders and explanations live in a Conditions panel and in inspect cards that open on click (see "In the world: a clean screen, and click to inspect"). Each phase change shows a one-line caption that fades.

**Condition sliders.** Temperature, Nitrogen and Oxygen sliders are available the whole time, from the selection screen to the end of the run. On the selection screen they are on screen and set the planet's starting conditions. In the world they live in the Conditions panel, which is closed by default; there they change conditions live, and the player watches life respond. Each slider shows the same full range in every world, with red zones where that world's life would die. Once a world is running, the thumb cannot enter them (see "Condition sliders" below).

**End state.** When the timeline reaches the start of the present phase (130 s), `run:complete` fires and a summary card shows the world's final stats beside Earth's, plus the dominant life form's traits. The player can close it. The world keeps running in a stable state behind it.

## Worlds

Each world is procedurally generated from its seed. The three sliders set the starting temperature, nitrogen and oxygen. Everything else (gravity, terrain, initial CO₂ and so on) is sampled from ranges that keep the world consistent with its chemistry, and later values come from the simulation. The tables describe each world with the sliders at their defaults, and give the reasoning the UI should surface. The sliders can move conditions anywhere inside the living bands, including outside these tables.

### Carbon (status: known)

| Stat | Range or trajectory | Earth today | Why |
|---|---|---|---|
| Mean surface temperature | 5 to 25 °C at present | about 15 °C | Water must be liquid; carbon chemistry in water works well in this band. Set by star brightness and the CO₂ greenhouse. |
| Surface pressure | About 1 bar by default; derived from the gases and gravity | about 1 bar | At 1 bar, water is liquid between 0 and 100 °C. |
| Gravity | 0.8 to 1.3 g | 1 g | Enough to hold an atmosphere; within the range of rocky planets. |
| Oxygen | 0%, rising to 15 to 25% | 21% | Starts near zero; produced by photosynthetic life, but only accumulates once rocks and volcanic gases stop soaking it up. |
| Nitrogen | 1 × Earth's by default | 1 × | Set by the Nitrogen slider. Life needs it for proteins and DNA. |
| Main gas | Nitrogen | Nitrogen | Unreactive bulk gas that persists over billions of years. |
| Carbon dioxide | High, falling to low | about 0.04% | Drawn down by rock weathering (faster when warm, which steadies the climate) and by photosynthesis. |
| Solvent | Water | Water | Liquid over a wide temperature range and dissolves many carbon compounds. |
| Star | Sun-like, slowly brightening | The Sun | Sun-like stars brighten slowly over billions of years; the young Sun was about 30% dimmer. |
| Pace of chemistry | 1 × Earth | 1 | The reference. |

### Silicon (status: speculative)

The reasoning chain the UI tells, one step at a time:

1. **Silicon is everywhere, yet life chose carbon.** Earth's crust is about 28% silicon and 0.02% carbon, but living things are about 18% carbon. Something stops silicon.
2. **Silicon bonds to itself weakly.** Si–Si is roughly 220 kJ/mol against roughly 350 for C–C, so silicon chains fall apart more easily. Cold slows that down.
3. **Silicon bonds to oxygen extremely strongly.** That is why the crust is silica rock. Free oxygen or liquid water would lock silicon away as rock, so this world must have neither. Water can exist only as frozen bedrock.
4. **Silicon's hydrogen compounds (silanes) burn on contact with oxygen and break down in water**, which reinforces step 3.
5. **So the solvent must be cold and unreactive.** The best-discussed candidate is liquid nitrogen (Bains 2004). Nothing in it attacks silicon bonds.
6. **In the cold, silicon's weakness becomes its strength.** At −183 °C, carbon chemistry is all but frozen. Silicon's weaker, more reactive bonds can keep reacting, and silicon compounds may dissolve in liquid nitrogen better than carbon compounds do (Petkowski 2020, Appendix C; NRC 2007). This is why this world runs on silicon rather than carbon.
7. **The seas set the air.** Nitrogen is only liquid between about −210 °C and −147 °C (its critical point). Because the seas and the air are both nitrogen, the seas evaporate or condense until the air pressure matches nitrogen's vapour pressure at that temperature. Around −183 °C that is about 3 to 4 bar, so this world has thick air, fixed by its temperature. Titan, at Saturn's distance from the Sun, is a real cold world with a thick nitrogen atmosphere and surface seas (of methane and ethane, not nitrogen).

**Caveat (shown in the UI):** "Most chemists doubt this: almost nothing dissolves in liquid nitrogen, and chemistry there is extremely slow. Petkowski, Bains and Seager (2020) conclude that no environment makes silicon-based life plausible. This world is our best-reasoned guess, not a prediction."

| Stat | Range or trajectory | Earth today | Why |
|---|---|---|---|
| Mean surface temperature | −183 °C at start by default; the default run stays below −165 °C | about 15 °C | The solvent must be liquid, and cold keeps weak silicon bonds intact. Set by the distant star. |
| Surface pressure | Derived: nitrogen vapour pressure at the surface temperature (about 3.6 bar at −183 °C) | about 1 bar | While nitrogen seas exist, they hold the air at their vapour pressure. |
| Gravity | 0.5 to 1.0 g | 1 g | Cold gas escapes slowly, so even modest gravity holds thick air; Titan holds 1.5 bar at 0.14 g. |
| Oxygen | 0% throughout | 21% | Any free oxygen would turn silicon into rock. |
| Nitrogen | Tens of × Earth's by default, most of it in the seas (pinned from the sea depth) | 1 × | Set by the Nitrogen slider. The seas exist only while there is more nitrogen than the air holds. |
| Main gas | Nitrogen | Nitrogen | Bulk atmosphere, and in balance with the seas. |
| Sea cover | Derived from nitrogen inventory minus what the air holds | about 71% | Seas shrink when life locks nitrogen into bodies, when gas escapes to space, or when warming moves more nitrogen into the air. |
| Solvent | Liquid nitrogen | Water | Cold, unreactive and does not attack silicon compounds. |
| Star | Sun-like star about 10 times farther away than the Sun is from Earth, slowly brightening | The Sun | Explains the cold; at Saturn's distance, Titan's surface is about −180 °C. |
| Pace of chemistry | Shown as the Arrhenius estimate from the config's activation energy (around 10⁻²⁰ × Earth with a typical activation energy), labelled "compressed in the time-lapse" | 1 | Reactions slow sharply in the cold. The sim compresses this so evolution is visible, and says so. |
| Pace of life (shown as the generation count, not a panel stat) | Slower than carbon life, fewer generations in the same time | n/a | Comes from the metabolism rule in config, not a hardcoded speed. |

We assume an oxygen-poor (reduced) planet where silicon is available in forms life can use (`assumption: true`). Making silanes from silica rock costs a lot of energy, so where this world's silicon feedstock and energy come from is an open question.

## Life changes the planet

Conditions and life are coupled in both directions. The stats shape which organisms survive, and the population in turn shifts the stats. This two-way loop is the main source of change after the formation phases, and it is what makes the world feel alive rather than scripted.

On the carbon world, photosynthetic organisms produce oxygen and draw down carbon dioxide. Early on, that oxygen is soaked up by iron in the seas and by volcanic gases (an oxygen sink that weakens over time), so oxygen only starts to accumulate once the sink is used up. That delay is real, and it is why Earth's Great Oxidation Event came hundreds of millions of years after photosynthesis began. Consumers breathe oxygen and release carbon dioxide, so a booming animal population pulls oxygen back down. Rising oxygen makes larger body sizes viable. Falling carbon dioxide weakens the greenhouse effect and cools the climate, which favours cold-tolerant traits, while weathering slows in the cold and steadies the temperature. This is a simplification: on the real Earth, oxygen accumulates mainly because some organic carbon gets buried instead of decomposing, not simply because a lot is alive. The model treats net production as a stand-in for that, and the config marks it `assumption: true`.

On the silicon world, any feedback is speculative and labelled so. Organisms build their bodies from silicon–nitrogen compounds, so a growing population locks nitrogen away. Because the air is held at the seas' vapour pressure, the nitrogen comes out of the seas: sea level falls and the shallow, habitable margins shrink, which limits the population that caused it. When organisms die, their nitrogen slowly returns (`assumption: true`). Growth against decay gives a self-limiting cycle that follows from the world's own chemistry. Meanwhile the slowly brightening star warms the world a few degrees, which moves more nitrogen from the seas into the air: the seas shrink further and the air thickens. The config's targets keep the temperature well below nitrogen's critical point, so the seas never vanish in the demo.

Every process and feedback rate lives in the world config with its reasoning, like any other stat.

## How conditions change over time

The timeline compresses the world's history into 130 seconds; after that the present phase holds steady. Each world defines phases, and each phase defines which processes are active. Changes are smooth and continuous. Each phase also carries a `startYears` anchor, and the history readout interpolates between anchors. Time is not spread evenly, so the dates in captions match the readout.

| Phase | Carbon world (years since formation) | Silicon world (years since formation, `assumption: true`) |
|---|---|---|
| Formation (0–10 s) | 0. Rock surface rises from flat; thick CO₂ and nitrogen atmosphere; dim young star. The CO₂ greenhouse keeps it warm. | 0. Rock surface rises; thick nitrogen atmosphere; cold from the distant star. |
| Seas (10–25 s) | 0.1 billion. Water vapour condenses into oceans in the lowlands. | 0.1 billion. Nitrogen condenses into seas in the lowlands, and the air settles at the seas' vapour pressure. |
| First life (25–50 s) | 0.7 billion. Microbial mats in shallow water. | 1.5 billion (later, because chemistry is slower). Speculative silicon–nitrogen chemistry in the shallows; first slow crystalline organisms. |
| Life reshapes the air (50–90 s) | 1.9 billion. Photosynthesis begins; iron and volcanic gases soak up the oxygen at first, then oxygen rises (Earth's Great Oxidation Event was about 2.4 billion years ago, 2.1 billion years after formation); carbon dioxide falls and the climate cools. | 3 billion. The population locks nitrogen into bodies and sea level falls; the star slowly brightens and the air thickens. |
| Complex life (90–130 s) | 3.9 billion. Oxygen climbs towards modern levels; land plants spread; animals diversify and start pulling oxygen back towards balance. | 4.5 billion. Shrinking seas and slow atmospheric escape squeeze the shallows. Some lineages retreat deeper; others take to the thick air or colonise the shore (speculative). |
| Present (130 s onward) | 4.5 billion (today). Plants and animals hold oxygen near a stable level. | 6 billion. A stable but marginal balance between the population and its seas. |

Population traits respond continuously to every change. The phase timings and year anchors are targets for the demo and live in config. Captions describe processes rather than outcomes the sliders can change, so they hold anywhere inside the living bands. Where the seas could be frozen, the phase has a frozen variant (`captionFrozen`).

## Life: creatures and plants

Our controls and our two worlds stay as described above. **Creatures come from Caden's design F, as cut down by the simplicity guardrails**:
- **The rules that govern the sim:** `docs/emergence/DECISIONS.md` (rev 2). §G holds the guardrails, the 12 body genes and the constants. §3 holds the 12 rules, §A the variety metrics, and §B the science → body table. Those sections are the reference. This file links to them rather than copying them.
- **Design F** (`docs/emergence/F-body-plan-first.md`, chosen in `docs/emergence/README.md`) is the reference for the `develop()` chemistry grammar and for rendering bodies. Where F and DECISIONS disagree, DECISIONS wins (for example, F's midwife cheats and 32-gene genome are cut).
- **The evolution recipe Caden measured:** `research/body-plans/`, notes 01 and 04.

F and DECISIONS were written for the old controls (Recipe, Sea, Heat, Light, Hunger, Time), so this section wires them to ours. On creature mechanics, DECISIONS is the reference. On inputs, this file wins.

**Simplicity guardrails (non-negotiable, DECISIONS §G):**
- ≤ 12 sim rules, one in and one out.
- One of every system: one utility loop, one `develop()`, one ledger, and no per-species code.
- 15 genes: the 12 body genes (DECISIONS G.1) plus the 3 climate genes already built in `population.ts`. A new gene costs a removal.
- ≤ 25 sim constants, all in `src/sim/constants.ts`.
- One 64² world grid, ticking at a fixed 20 Hz.
- No cheats and no preset code.
- Rendering is read-only.
- A new rule or feature ships only if a headless A/B raises a §A variety or readability metric.
- Parked ideas go to `docs/NOT_NOW.md`.

**What life is**
- **Animals:** up to 1,024 agents, never fewer than 1,000 in the demo, because smaller populations went extinct in Caden's tests. There is no lower quality tier for the population. Protect 60 fps by cutting render detail instead.
  - Each animal carries the 12 genes of DECISIONS G.1: size, segments, limbPairs, limbLen, plates, horns, gape, diet, eyes, buoy, glow and sociality. It also inherits its body composition {c, si, o}, which is not a gene.
  - It also carries our three climate genes from `population.ts`, used as built: preferred temperature, tolerance, and oxygen need (carbon) or cold stability (silicon). The genome is 15 genes in total.
- **Plants:** **per-cell flora biomass** on the 64² grid (mat and canopy), not individual agents. These are the producers. Plant shapes (L-system twigs and caps, and forms such as lantern cups or jellyshroom domes) are drawn by the art layer as a pure function of each cell's biomass, composition and conditions.
- **Development:** a pure `develop()` turns the genes plus body composition plus conditions into a body plan. It is the only place genes become traits. Chemistry is the grammar:
  - Silicon bodies grow hexagonal faceted segments, straight rod limbs with joints snapped to 15°, and clusters of dot eyes.
  - Carbon bodies grow round, curling, many-jointed shapes with ring eyes.
  - The traits derived from these (radius profile, symmetry, eye and horn count, and so on) are listed in DECISIONS G.1.
- **Ecology:** DECISIONS §3, the 12 rules. One utility loop (forage, hunt, flee, home, rest, bud) runs over relationships derived from bodies (eats, afraid, rival, kin). There's one trait ledger, where every gene pays somewhere and earns somewhere.
- **Glow comes from darkness, on both worlds.** The `glow` gene pays for itself as a lure only when light is scarce, so the dim silicon world evolves glow without any oxygen. On silicon the chemistry behind it is non-oxygen chemiluminescence, marked `assumption: true`. This replaces F's and DECISIONS' "glow ∝ oxygen".
- **Evolution recipe** (from Caden's measurements; without it, legs, plates, horns and hunters don't appear inside a demo):
  - **Always-on mutation** at `SIGMA` 0.075 (about ×1.5), declared as "a stressed young world".
  - **No developmental pull in the sim.** Body templates become anonymous look attractors in the art layer, applied read-only (DECISIONS §G.3, G.9).
  - **The plate-ledger fix**, so plates are cheap enough to spread.
- **Founders:** at the first-life phase, a seeded group of at least 24 tiny capsule worms appears in the shallows, drawn from the world's seed. They carry standing variation: σ 0.12 on the listed genes, and about 15% start with tiny limb buds (`research/body-plans/notes/01-evolution-speed.md` §5). Complexity has to be earned.
  - F's atom prelude and copier are not used. The particle box plays that role before Generate, and seeding founders from the box would break the deterministic demo.

**How F's inputs come from our worlds** (every scaling lives in config):

| F input | Comes from | Notes |
|---|---|---|
| Recipe (body composition c, si, o) | Fixed per world: carbon is carbon-rich with some oxygen; silicon is silicon-rich with no oxygen | Not a player control. Composition is still inherited and rebuilt at each birth, as in F. |
| Sea | The world's solvent: water or liquid nitrogen | F's "water dissolves bare silicon" lever doesn't arise in either world, so plates pay only as defence against hunters. |
| Heat | `heatBand`: temperature normalised within the world's living band (0 = lower edge, 1 = upper edge) | Drives F's temperature–size rule (cold makes giants) and heat stress. |
| rate(heat) | Our pace rule ("Metabolism" below) | One pace rule for everything alive. |
| Air density | Real gas density, P·M/(R·T), scaled into F's range | Earth's air is about 1.2 kg/m³. The silicon world's 3.6 bar at −183 °C is about 13 kg/m³, so F's floaters (bells, sky whales) have a physical reason to appear there. Titan's air is about 4× denser than Earth's. On carbon, the Nitrogen slider changes it. |
| Light | Starlight at the surface (star brightness and orbital distance) | The silicon world gets about 1% of Earth's sunlight, so F's rules give it big eyes and glow. |
| Hunger | Derived, not a control: plant scarcity (demand ÷ supply) | A declared game rule; Caden's tests needed it for hunters to exist. Cold, dim light, low nitrogen or a population boom all raise it. |
| Time | The phase timeline and the ecology clock (below) | |
| Air oxygen (new, ours) | The Oxygen stat and slider | Aerobic metabolism, and the largest body that can breathe (the rule already in `population.ts`). Pinned at 0 on silicon. |

**Silicon-world specifics** (speculative, labelled as such):
- **Plates are silicon-nitride ceramic**, not silica stone, because there's no oxygen. Silicon nitride is a real, very hard ceramic. `assumption: true`.
- **No builders.** F's builders need silicon plus oxygen to lay stone, and this world has no oxygen. The builder pathway is hard-off on silicon (it's gated on `o`, not on preset code), so life raises no spires and no glowing pores here.
- **Relic ice landmarks.** The silicon world's arches and spires are **water-ice bedrock** left over from formation. Water exists on this world only as frozen bedrock (reasoning step 3). They are part of the seeded starting terrain, not grown by any process, and are marked `assumption: true` (see "Terrain and landforms").
- **Leaving the sea.** Life starts in the shallows. As the seas shrink in the complex-life phase, some lineages go deeper, some take to the thick air, and some colonise the shore. Ceramic skins hold their internal nitrogen in, as waxy skins hold water. `assumption: true`.

**What is already built.** `src/sim/population.ts` is the climate core that F's ecology grows from: extend it, don't start a second model. It already has:
- the three climate genes and the pace rule
- oxygen's cap on body size
- two ecology stabilisers: grazing takes only a share of a plant, and consumers interfere with each other's feeding. Without them, consumers ate every producer within seconds.
- stable ids and a deterministic RNG

Its tests show the comfort band following a warming climate, oxygen-rich air evolving bigger aerobic consumers, silicon life surviving slow warming, and fewer generations in the cold. Each step it takes an `Environment` (temperature, oxygen, light, habitat share, edge stress) and returns producer and consumer biomass as the drivers for the feedbacks.

**The ecology clock.** Caden measured that F needs about 340 sim-seconds for legs, plates, horns and hunters. So the ecology runs about ×4 faster than demo time, set by `timeScale` in config and the same for both worlds. At a quarter of carbon's pace, silicon gets about a quarter of that. In the default run, silicon creatures therefore stay simpler: capsule worms, and perhaps legs and floaters. See open questions.

**Presentation, under the clean-screen rule.**
- **No camera pull-out:** the camera follows the player.
- **New forms:** when a body plan first fills a field-guide bin, its generated name shows as a one-line caption ("New form: Glass Strider"). Clicking the creature opens its inspect card, which serves as the specimen plate.
- **Field guide tab:** next to Conditions, closed by default. It lists the forms found so far.
- **What counts as a form:** the DECISIONS §A definition. A form is a cluster on the 12 genes plus composition (c, si), at radius 0.25, with at least 4 live animals, labelled by functional type (look attractor × trophic role × locomotion mode). `guide:newForm` fires when a cluster first reaches 4 live animals. Names come from a trait-based name generator.

**Metabolism (pace of life).** Each world's `life.rules.metabolism` holds an activation energy, a reference temperature and a compression exponent. With a typical activation energy (about 50 kJ/mol), the real Arrhenius factor at −183 °C is around 10⁻²⁰ of Earth's, which would mean no generations at all in a demo. The sim raises that factor to the compression exponent, roughly 0.03, to land near a quarter of carbon's pace. The same exponent applies to both worlds, so their paces compare fairly. It also stops carbon running away when the Temperature slider is pushed hot. The silicon activation energy may be set lower than carbon's to reflect step 6 of the reasoning chain. Both the exponent and any lowered activation energy are `assumption: true`, and the pace stat shows the uncompressed estimate with the label "compressed in the time-lapse". Silicon's slower generations come out of these rules, never from a hardcoded speed.

The simulation runs in a Web Worker so rendering never stutters. It posts snapshots at 20 Hz, with the organism buffer as a transferable, and posts each new body plan once, at birth.

## Condition sliders

Three sliders, and only these three, let the player change the conditions life depends on: **Temperature**, **Nitrogen** and **Oxygen**. They are available the whole time: on the selection screen, through every generation phase, and for the rest of the run. In the world they sit in the Conditions panel, closed by default. A slider change is the player asking "what if?", not a natural event, and the UI labels it that way.

**On the selection screen (before a world exists):**
- **Starting positions.** The thumbs start at 15 °C, 1 × Earth's nitrogen and 0% oxygen. A young planet has no free oxygen until life makes it.
- **The settings are the planet's starting conditions.**
  - Temperature: the sim solves for the orbital distance that gives that starting temperature.
  - Nitrogen: sets the planet's nitrogen inventory.
  - Oxygen: sets the initial free oxygen. On the carbon world, any starting oxygen is soaked up by the early oxygen sink, which is what really happened on Earth.
- **The thumbs move freely across the full range.** There is no world yet, so there is nothing to protect.
- **The red zones are a preview** for the selected element, drawn lighter than in a running world. Hovering a red cell shows its reason.
- **The carbon and silicon cells show live whether their life could survive at the current settings.** A cell lights up when it can. It turns red, with the reason on hover, when it can't. This is a small puzzle with real physics behind it:
  1. Drag Temperature down to −183 °C, and carbon goes red ("Too cold for surface life").
  2. Silicon stays red ("Too little nitrogen for seas") until Nitrogen goes up, because a nitrogen sea can only exist if the planet has more nitrogen than its air can hold.
- **Generate is never blocked.** When Generate is clicked, any slider sitting in the selected world's red zone glides to that world's default starting value, and a caption says why, for example "Silicon life can't survive at 15 °C, so this world starts at −183 °C". Sliders already inside the band keep the player's value. With untouched sliders, both worlds start from fixed values, so both demo runs stay deterministic.

**Once a world is running**, from the first second of formation, the rules below apply. Before life appears, a red zone means "life could never start here".

**Every world shows the same full range.** That way the player sees how narrow silicon's window is, and where it sits, compared with carbon's. Each track shows:
- the full range, identical in every world
- the **living band**, where this world's life can survive
- **red zones** outside the band, each labelled with why life dies there (for example "Too little nitrogen for seas"); on the silicon world these labels are marked speculative
- a small Earth marker at Earth's value
- the thumb at the live value

**The thumb cannot enter a red zone.** Dragging into one stops the thumb at the edge, pulses the zone and shows its reason. Approaching an edge, life is visibly stressed: the population falls, because the fitness rules read the same limits. The edge is exactly where the sim's kill condition sits. The slider and the sim read one list of limits from config, so they can never disagree.

**Red zones move.** The physics couples the conditions, so every band is recomputed in the worker each snapshot.
- **How a band is found:** it is the range of positions where no limit fails, holding the other sliders' physical settings (orbital distance, nitrogen and oxygen inventories) still. Its edges are found numerically through the derived-stat models, so couplings show up without special cases.
- **Example:** on the silicon world, a smaller nitrogen inventory evaporates completely at a lower temperature. So lowering Nitrogen slides the Temperature slider's upper red zone down.
- **Coupled drags:** a drag on one slider that would push a coupled condition into its red zone stops there too, and shows that limit's reason.
- **Slow drift:** if the world's own slow processes move a band edge onto the player's setting, the worker eases the setting back inside the band and shows the reason.

The world never enters a red zone.

| Slider | Full range | What it physically changes | Carbon living band | Silicon living band (speculative) |
|---|---|---|---|---|
| **Temperature** | −250 to 150 °C | The planet's distance from its star, so starlight changes with it | **Lower edge: "Too cold for surface life".** About −50 °C (`assumption: true`), set below "Snowball Earth" conditions, which surface life survived. Life could persist in seas under thick ice, as may happen on Europa, but our model follows only surface life. **Upper edge: 122 °C**, the highest temperature at which any known organism grows. The oceans themselves don't boil away below that: water vapour adds to the air and raises the pressure. | **Lower edge: −210 °C**, where the seas freeze solid. Nitrogen ice sinks, so unlike water ice it gives no insulating lid. **Upper edge:** −147 °C (nitrogen's critical point), or the temperature at which the seas have fully evaporated into the air, whichever is lower. |
| **Nitrogen** | 0.01 to 1,000 × Earth's nitrogen per square metre of surface, log scale | How much nitrogen the planet has, in its air and (on silicon) its seas | **Lower edge: "Not enough nitrogen to build cells".** Placeholder about 0.05 × (`assumption: true`). Life needs nitrogen for proteins and DNA, and it thrived on the early Earth with perhaps half of today's air pressure. **No upper edge of its own:** high pressure alone doesn't kill, and life thrives at over 1,000 bar in the deep sea. More nitrogen does warm the planet a little, because thicker air strengthens the CO₂ greenhouse. So near the Temperature slider's upper edge, raising Nitrogen can stop at "too hot". | **Lower edge: "Too little nitrogen for seas".** Red below the amount the air must hold at the current temperature, because then the seas are gone. Adding nitrogen does not thicken this air: the seas hold the pressure, so extra nitrogen rains into the sea and sea level rises. Most of this world's nitrogen is in its seas, so the thumb sits far above Earth's marker. |
| **Oxygen** | 0 to 40% | Free oxygen in the air | No red zone: Earth's life lived for more than a billion years without oxygen in the air. Animals suffer at low oxygen, and the population shows that. | Red above a trace (value in config, `assumption: true`): free oxygen turns silicon into rock. The thumb is pinned at zero, which is the point. |

Temperature here is the mean surface temperature. On the carbon world, slider changes reach the population through the fitness rules and reach the atmosphere through the existing processes. For example, warming speeds up weathering, which draws down CO₂.

## The particle box and the Generate transition

On the selection screen, a box beside the periodic table and sliders shows the selected element's chemistry in miniature, as atoms and molecules. It reacts live to every element and slider change. It is a cross-section of a tiny sea, with liquid solvent at the bottom and gas above. It exists only on the selection screen: on Generate, its particles become the world. It is labelled "Illustration, not to scale", and on silicon it also carries the speculative label.

- **Rendered in the three.js scene**, not the DOM, so the camera can fly into it. The DOM overlay (periodic table, sliders and the Generate button) sits beside it. The design partner owns its framing and colours; engineering owns the particles.
- **About 600 particles**, simulated on the main thread with simple rules: jitter scaled by temperature, a liquid layer that damps motion, and springs for bonds. They are drawn as instanced meshes.
- **Its own random stream**, separate from the world's seed, so playing with the box never changes the demo run.

| Particles | Carbon | Silicon |
|---|---|---|
| Element atoms | Carbon atoms, linking into chains in the water | Silicon atoms, linking into chains in the liquid nitrogen |
| Solvent | Water molecules forming the liquid layer | Nitrogen molecules forming the liquid layer; its depth follows the sea-volume model |
| Nitrogen gas | N₂ molecules above the liquid; their count follows the Nitrogen slider (log scale) | N₂ molecules above the pool, at the seas' vapour pressure |
| Oxygen | O₂ molecules; their count follows the Oxygen slider. Harmless to carbon. | Any O₂ that touches silicon turns it into grey rock that sinks |

| Change | What the box shows |
|---|---|
| Temperature | Every particle moves faster as it warms. The solvent's phase comes from the world's solvent data. Below freezing, the liquid locks into a lattice: water ice floats to the top, and nitrogen ice sinks to the floor. Both are real. |
| Life could live here (`canLive` passes) | Chains link up and wiggle, and now and then one splits into two copies: a hint of life. |
| A limit fails | The box plays that limit's `boxEffect`: `freeze` (everything locks still), `shakeApart` (chains rattle into single atoms), `dryUp` (the liquid boils off and the atoms rattle on a dry floor), `starve` (chains start but stay short and fall apart) or `rust` (silicon grabs oxygen and sinks as grey rock). |
| Switching element | Atoms recolour and reshape, and the solvent swaps, over about half a second. |

The box's state comes from a pure function, `boxState(world, conditions)`, built on `canLive` and the derived-stat models. The box can therefore never show living chains while the element's cell is red.

**Clicking Generate** (all of it happens inside the formation phase, so phase timings and the demo script don't move):
1. `world:selected` fires. If `startingConditions` moves any slider, it glides first, and the box shows the fix happen. For example, silicon's nitrogen pool condenses as the temperature drops.
2. **0–1.5 s:** the camera pushes into the box and its walls fade.
3. **1.5–5 s:** the particles duplicate, doubling repeatedly up to a budget of about 30,000. They spread outward and downward, settle onto the ground surface as it stands at that moment of formation, and take on the ground's colours. They are drawn as points with one buffer update per frame; lower the budget if the frame rate drops below 60 fps.
4. **5–6 s:** the terrain mesh fades in under the particles, they dissolve, and the character spawns. The terrain keeps rising until formation ends at 10 s.

Both worlds' heightmaps come only from their demo seeds, so they are generated while the selection screen is up. The particles then know where to land the moment Generate is clicked.

## In the world: a clean screen, and click to inspect

**Clean by default.** Once the character spawns, the screen shows only the world, plus the small Conditions icon. Just these appear on their own, and none of them are diagrams:
- **Phase captions:** one short line, bottom centre, like a film subtitle. It fades after about 4 s.
- **"Why it moved" lines:** when a slider glides or is blocked, the reason shows as the same kind of brief line.
- **A controls hint** for whichever input was used last, which fades after a few seconds, and a small centre reticle while the gamepad is in use.
- **The summary card** at the present phase, which the player can close.

Everything else waits until the player asks for it.

**The Conditions tab.** A small icon in a corner opens the Conditions panel. Tab or the gamepad's Y button toggles it, and using the D-pad sliders opens it too. It is closed by default, and the world keeps running while it's open. It holds:
- the three condition sliders (still available the whole run, as in "Condition sliders")
- the stats panel: every stat beside Earth's, with its "why", and assumptions marked
- the history readout (years since formation) and the current phase
- on silicon, the reasoning chain and the caveat

**Click to inspect.** These can be clicked:
- creatures
- producers: a patch of flora biomass (plants on carbon, crystalline crusts on silicon), inspected by grid cell
- the sea
- the ground
- the sky and star

Clicking one opens an inspect card beside it, never full screen. The card has:
1. What it is, in one line.
2. Its details in plain words.
   - An organism: its body plan in words (limbs, plates, horns, eyes, how it moves), its role (plant, grazer or hunter), size, preferred temperature and tolerance, oxygen need or cold stability, its field-guide name, and which generation it is.
   - The sea: solvent, temperature, liquid or frozen, sea cover.
   - The ground: what the rock is.
   - The sky and star: star type, brightness, air pressure and main gas.
3. Why it is like this: one sentence, from config like every other world fact.
4. **The comparison: "This world" beside "A carbon world"** (on the carbon world, "A silicon world"). It is rows of plain facts, with Earth's value where there is one, plus a small live 3D render of the counterpart turning slowly. No charts.
   - For an organism, the counterpart is **the same genome built with the other world's chemistry and look**: its genome run through `develop()` with the other world's composition. It is labelled "If this were built from carbon (illustration)".
   - For the sea, ground and sky, it is a small patch of the other world's version.
   - The other world's numbers come from its `targets` (its default run at the present phase), labelled "today".

The card updates live while it is open. If the organism dies, the card says so and stays until closed. Only one card is open at a time; clicking elsewhere, Esc or the gamepad's B button closes it.

The counterpart render is drawn in a scissored viewport of the main canvas, behind a transparent window in the card. It runs only while a card is open, at low resolution. Both worlds' creature and material builders are compiled while the selection screen is up, so opening a card never stalls.

## Stack

- three.js r187 from npm with `WebGPURenderer` (`three/webgpu`, which falls back to WebGL2). Custom TSL is limited to what the creature pipeline needs (F's GPU pose passes and storage-driven body skinning, F §3.5–3.6) and the terrain heights. Everything else uses the built-in node materials, because custom shaders are where a WebGPU build loses hours. Caden's r187 smoke test found that `positionNode` runs after instancing (`docs/features/world-generator.md`), so storage-driven instances use identity instance matrices. See the `world-style` skill for rendering construction rules.
- No loading stalls: the renderer, the sim worker and the world's materials are initialised and compiled (`renderer.compileAsync`) while the selection screen is up, so clicking Generate starts instantly.
- No physics engine. Ground height is sampled from the terrain heightmap.
- Vite + TypeScript. Vitest for unit tests.
- The UI is a DOM overlay on top of the canvas, so the design partner can build it independently.

Where `world-style` disagrees with this file, this file wins. Specifically, ignore its Rapier, vehicle and Blender-collider rules, its "instructions only in the world, no DOM overlays" rule, and its toy-diorama camera.

## Architecture

```
src/
  main.ts              entry, wires everything together
  worlds/              one config per world: carbon.ts, silicon.ts
  worlds/sources.ts    citation list referenced by id from configs
  worlds/types.ts      the data contract below
  worlds/controls.ts   the three slider definitions, shared by every world so ranges match
  sim/                 worker, timeline/phase engine, population model, atmosphere and sea models, seeded RNG
  sim/population.ts    the climate core of the ecology (built, tested); LifeRules is its slice of the world config
  sim/genome.ts        the 12 animal genes (DECISIONS G.1), mutation at SIGMA, founders with standing variation
  sim/develop.ts       pure develop(): genome + composition → body plan (chemistry is the grammar)
  sim/ecology.ts       the 12 rules (DECISIONS §3): agents, 64² grid with per-cell flora biomass, utility loop, ledger; grown from population.ts
  sim/guide.ts         field-guide bins (MAP-Elites) and generated names
  sim/organismLayout.ts  the SimSnapshot.organisms buffer layout (built)
  sim/rng.ts           seeded random streams, same algorithm as mockups/worlds (built)
  sim/models.ts        equation forms (radiative balance, vapour-pressure lookup, sea volume); coefficients come from config
  sim/limits.ts        pure functions: living bands, element viability and starting conditions; used by the worker and the selection screen
  sim/constants.ts     every sim tunable, ≤ 25 (DECISIONS G.2)
  gen/terrain.ts       L0 analytic height: TSL node + CPU sampler (same maths), rise, seaLevel from seaCover, spawn shore, landform machines
  gen/                 creature mesh builders
  render/              scene, lighting from star type, sky, materials, generation animations
  render/particleBox.ts  the selection-screen particle box and boxState()
  render/generate.ts   the zoom-and-duplicate transition from the box into the terrain
  render/pose.ts       GPU spine, IK legs and bell pulses (F §3.5)
  render/fauna.ts      lofted bodies, limbs, plates and eyes (F §3.6)
  render/flora.ts      plant shapes drawn from the per-cell flora grid (art layer)
  render/pick.ts       raycast picking for click-to-inspect (organisms by id, sea, ground, sky)
  render/counterpart.ts  the inspect card's live render of the other world's counterpart
  player/              third-person character controller and camera, keyboard/mouse and gamepad input
  ui/                  selection screen, Conditions panel, field guide, captions, inspect cards, summary card (design partner)
  bus.ts               typed event bus between sim, render and UI
```

`render/` is the art layer. It reads only `VisualInputs` (see "Logic → art interface") and follows the active art-direction doc. Mockups are references: port from them, but never import across projects.

### Data contract (agree changes with Caden and the design partner)

```ts
type WorldStatus = 'known' | 'speculative';

interface Sourced {
  why: string;             // one plain sentence shown in the UI
  sources: string[];       // ids into sources.ts; may be empty only if assumption is true
  assumption?: boolean;    // true if not directly sourced; also listed under open questions
}

interface StatDef extends Sourced {
  id: string;              // e.g. 'temperature', 'pressure', 'oxygen', 'nitrogen', 'seaCover', 'pace'
  label: string;           // sentence case, e.g. 'Surface temperature'
  unit: string;            // '°C', 'bar', '%', 'g', '× Earth'
  earthValue: number;
}

interface FactDef extends Sourced {       // non-numeric panel rows: main gas, solvent, star
  id: string;
  label: string;           // e.g. 'Main gas'
  value: string;           // e.g. 'Nitrogen'
  earthValue: string;      // e.g. 'Nitrogen'
}

interface FeatureDef extends Sourced {   // what an inspect card says about a kind of thing in the world
  name: string;            // e.g. 'Liquid nitrogen sea'
  description: string;     // one plain sentence
  statIds: string[];       // stats shown on the card, each beside the other world's value
  factIds: string[];       // text facts shown the same way (e.g. body chemistry on the organism card)
}

type InspectTarget =
  | { kind: 'organism'; organismId: number }   // OrganismField.id
  | { kind: 'producer'; cell: number }         // index into the 64² world grid
  | { kind: 'sea' | 'ground' | 'sky' };

interface Phase {
  id: string;
  label: string;           // e.g. 'Seas form'
  startSec: number;        // demo seconds since Generate was clicked
  startYears: number;      // simulated years since formation at startSec; the readout interpolates between phases
  caption: string;         // shown on phase change; describes processes, so it holds anywhere inside the living bands
  captionFrozen?: string;  // used instead when the seas are frozen (e.g. 'Water vapour condenses and freezes into ice sheets')
  processes: string[];     // ids of the SlowProcesses and Feedbacks active in this phase
}

interface SlowProcess extends Sourced {   // non-living change: stellar brightening, weathering, escape, oxygen sinks
  id: string;
  statId: string;          // stat it changes
  driver: string;          // 'time', or a stat id (e.g. weathering is driven by 'temperature')
  rate: number;            // change in stat per unit driver per billion simulated years
}

interface Feedback extends Sourced {      // change driven by life
  id: string;              // e.g. 'photosynthesis'
  statId: string;          // stat it changes
  driver: string;          // population quantity, e.g. 'producerBiomass'
  rate: number;            // change in stat per unit driver per billion simulated years
}

interface DerivedStat extends Sourced {   // recomputed every tick from other stats, never integrated
  statId: string;          // e.g. 'temperature', or 'pressure'
  model: 'radiativeBalance' | 'vapourPressure' | 'partialPressures' | 'seaVolume';   // equation form in sim/models.ts; carbon pressure is 'partialPressures' (gases × gravity + water vapour), silicon pressure is 'vapourPressure'
  inputs: string[];        // stat ids it reads
  params: Record<string, number>;   // every coefficient the model uses
}

interface Solvent {
  name: string;            // 'Water', 'Liquid nitrogen'
  freezeC: number;         // renderer freezes seas when stats.temperature < freezeC
  criticalC: number;       // above this the liquid cannot exist at any pressure
  solidSinks: boolean;     // water ice floats (false); nitrogen ice sinks (true). Used by the particle box and the frozen-seas look
  vapourPressure: [number, number][];   // [°C, bar] table, interpolated (NIST)
  sources: string[];
}

interface ControlDef {             // in worlds/controls.ts, shared by every world
  id: 'temperature' | 'nitrogen' | 'oxygen';
  label: string;                   // 'Temperature', 'Nitrogen', 'Oxygen'
  unit: string;                    // '°C', '× Earth' (nitrogen per square metre of surface, relative to Earth's), '%'
  min: number;                     // full range, identical in every world
  max: number;
  scale: 'linear' | 'log';
  moves: string;                   // what dragging changes: 'orbitDistance', 'nitrogenInventory', 'oxygenInventory'
  hint: string;                    // one line under the slider on what dragging does physically
  default: number;                 // thumb position when the selection screen opens: 15, 1, 0
}

interface LethalLimit extends Sourced {   // per world; one list read by the sliders and by the sim's kill conditions
  id: string;
  statId: string;                  // the condition it tests, e.g. 'temperature', 'nitrogen', 'oxygen', 'seaCover'
  side: 'below' | 'above';         // life dies below or above the edge
  model: 'fixed' | 'solventFreezes' | 'solventCritical' | 'seasEmpty';   // test form in sim/limits.ts; 'seasEmpty' means seas could not exist at equilibrium, so it holds before the seas phase too
  params: Record<string, number>;  // every coefficient, e.g. { value: 122 } for a fixed edge
  reason: string;                  // short label on the red zone, e.g. 'Too little nitrogen for seas'
  boxEffect: 'freeze' | 'shakeApart' | 'dryUp' | 'starve' | 'rust';   // what the particle box plays when this limit fails
}

interface LivingBand {             // computed by sim/limits.ts: every snapshot in the worker, and live on the selection screen
  low: number;                     // red below this (equals the control's min if there is no lower limit)
  high: number;                    // red above this (equals the control's max if there is no upper limit)
  lowLimitId?: string;             // which limit sets each edge, for the reason label
  highLimitId?: string;
  empty?: boolean;                 // true when no position works with the other sliders as they are: the whole track is red.
                                   // Only possible on the selection screen; low/high are then ignored and blockingLimitId names the reason
  blockingLimitId?: string;
}

interface WorldConfig {
  id: 'carbon' | 'silicon';
  displayName: string;
  status: WorldStatus;
  demoSeed: number;
  reasoning: { text: string; sources: string[]; assumption?: boolean }[];   // the chain the UI tells, step by step
  caveat?: string;         // required when status is 'speculative': the strongest case against, one sentence
  ranges: Record<string, [number, number]>;    // sampling bounds for starting values the sliders don't set (e.g. gravity)
  startDefaults: Record<ControlDef['id'], number>;   // where a slider glides at world start if the player's setting is in this world's red zone
  targets: Record<string, [number, number]>;   // where stats must sit at the present phase with the demo seed; tested
  solvent: Solvent;
  stats: StatDef[];
  facts: FactDef[];
  features: Record<'organism' | 'producer' | 'sea' | 'ground' | 'sky', FeatureDef>;   // inspect-card content
  phases: Phase[];
  processes: SlowProcess[];
  feedbacks: Feedback[];
  derived: DerivedStat[];
  limits: LethalLimit[];
  life: {
    rules: LifeRules;      // climate and metabolism rules (type in src/sim/population.ts)
    composition: { c: number; si: number; o: number };   // the world's fixed body recipe, F's Recipe
    ledger: unknown;       // F's trait-ledger coefficients for this world (typed when sim/ecology.ts lands)
    inputs: {              // world facts the ecology reads (DECISIONS §G.2 moved them out of sim/constants.ts); each needs why + sources, or assumption: true
      solvent: { rho: number; mu: number; epsilonR: number; liquidBandC: [number, number] } & Sourced;   // density, viscosity, permittivity, liquid range
      airDensity: Sourced & { scale: number };       // multiplies the live P·M/(R·T) into develop()'s scale, where unbuoyed carbon tissue = 1
      tissueDensity: Sourced & { C: number; Si: number };   // relative tissue density by chemistry
      scalings: unknown;   // remaining scalings from our stats into F's heat, light and hunger ranges
    };
  };
  terrain: TerrainConfig;  // see "Terrain and landforms"
  starType: string;        // a world fact (e.g. 'G-type'); every look decision lives in the art layer, not here
}

interface SimSnapshot {          // emitted on the bus at 20 Hz
  worldId: string;
  phaseId: string;
  timeSec: number;
  historyYears: number;          // e.g. 2.4e9, for the timeline readout
  stats: Record<string, number>; // every StatDef id (including 'seaCover'), plus 'seaLevel' in metres for the renderer
  population: { producers: number; consumers: number };
  generation: number;
  traitAverages: Record<string, number>;   // prefTemp, tolerance, size, chem, consumerSize, consumerChem
  organisms: Float32Array;       // one record per living animal (position, heading, locomotion mode, role, climate genes, the 12 genes,
                                 // stable id, generation); layout in sim/organismLayout.ts, which must be extended to match (it has none of heading, mode or genes yet)
  flora: Float32Array;           // per-cell flora biomass (mat, canopy) on the 64² grid; plants are not agents
  births: { id: number; plan: Float32Array }[];   // develop() output for organisms born since the last snapshot
  controls: Record<ControlDef['id'], number>;      // live value under each slider thumb
  bands: Record<ControlDef['id'], LivingBand>;     // live living band for each slider
}

type Conditions = Record<ControlDef['id'], number>;

// sim/limits.ts: pure, no side effects; the worker and the selection screen both call these.
// On the selection screen they evaluate each world at its demo seed (for gravity and other sampled values).
declare function canLive(world: WorldConfig, conditions: Conditions): { ok: true } | { ok: false; limit: LethalLimit };   // drives the element cells
declare function livingBands(world: WorldConfig, conditions: Conditions): Record<ControlDef['id'], LivingBand>;   // edges found by searching canLive along each slider
declare function startingConditions(world: WorldConfig, requested: Conditions): {
  start: Conditions;                                        // requested values; if canLive fails, sliders are replaced by startDefaults
                                                            // in a fixed order (temperature, nitrogen, oxygen), re-checking canLive after each
  moved: { controlId: ControlDef['id']; limitId: string }[];   // for the "why it moved" captions
};
```

Bus events: `selection:changed` (UI to render: `{ worldId, conditions }`, on every element click and slider move on the selection screen; drives the particle box), `world:selected` (`{ worldId, requested: Conditions }`, fired when Generate is clicked, with the slider settings at that moment), `phase:changed` (with the phase object), `sim:snapshot`, `run:complete` (fires when the present phase begins), `control:set` (UI to sim: `{ controlId, value }`, with value in display units: °C, × Earth's or %; the worker clamps it to the living band), `control:blocked` (sim to UI: `{ controlId, limitId }`, fired when a drag or slow drift hits a red zone, and at world start for each slider `startingConditions` moved), `guide:newForm` (sim to UI: `{ binId, name, organismId }`, when a body plan first fills a field-guide bin), `inspect:open` (render to UI: `{ target: InspectTarget, at: { x, y } }`, the screen position to place the card), `inspect:window` (UI to render: the card's counterpart window as `{ x, y, width, height }` in CSS pixels, or `null`), and `inspect:close` (UI to render).

**Changes from the first draft of this contract, pending the design partner's OK:**
- Added `startYears` to `Phase`.
- Added `SlowProcess`, `DerivedStat` and `Solvent`, so non-living processes, derived stats and phase data have a home in config instead of in code.
- Added `sources` to `Feedback`, and defined rate units as per billion simulated years.
- Added `reasoning`, `caveat`, `targets` and `facts` (with `FactDef`, for text rows such as main gas and star) to `WorldConfig`.
- Added `captionFrozen` to `Phase`, and the `partialPressures` model to `DerivedStat`.
- Added `organisms` to `SimSnapshot`, so creature meshes can show individual genomes.
- Added the condition sliders:
  - types: `ControlDef` (with `default`), `LethalLimit` (keyed by the stat it tests), `LivingBand` (with `empty`), `Conditions`
  - config: `WorldConfig.limits` and `WorldConfig.startDefaults`
  - snapshot: the `controls` and `bands` fields on `SimSnapshot`
  - functions: the pure `sim/limits.ts` functions the selection screen uses
  - events: the `requested` payload on `world:selected`, and the `control:set` and `control:blocked` bus events
- Added the particle box: `LethalLimit.boxEffect`, `Solvent.solidSinks`, and the `selection:changed` bus event.
- Typed `life.rules` as `LifeRules` (from `src/sim/population.ts`), and named the `traitAverages` keys.
- Added click-to-inspect: `FeatureDef`, `InspectTarget`, `WorldConfig.features`, the stable `id` and `generation` fields in the organism buffer, and the `inspect:open`, `inspect:window` and `inspect:close` bus events.
- Added Caden's creatures (design F): `life.composition`, `life.ledger`, `life.templates` and `life.inputs` on `WorldConfig`, `births` on `SimSnapshot`, and the `guide:newForm` bus event.
- 2026-11-07 logic pass (agreed with Caden):
  - Removed `life.templates`: the developmental pull leaves the sim.
  - Replaced `visuals` with `starType` plus the new `terrain: TerrainConfig`.
  - Added `SimSnapshot.flora` (per-cell biomass) and the `producer` inspect target.
  - The organism buffer now carries the 12 genes, heading and locomotion mode.
  - The snapshot rate is 20 Hz.
  - Typed `life.inputs`: `solvent`, `airDensity` and `tissueDensity` are world-config facts, not sim constants (DECISIONS G.2 now has 15 constants).

## Third-person player

Third person is part of the MVP. A stylised explorer character with a smooth follow camera on a spring. It supports keyboard and mouse, and a gamepad through the browser Gamepad API.
- **Keyboard and mouse:** WASD moves. Dragging the mouse orbits the camera. A click without dragging inspects what is under the cursor. Tab toggles the Conditions panel, and Esc closes a card or the panel.
- **Gamepad:** the left stick moves and the right stick orbits. While the gamepad is in use, a small reticle sits at screen centre. A inspects what is under the reticle, B closes, and Y toggles the Conditions panel.

Both work at the same time so control can pass between people without switching modes. Handle gamepads connecting or disconnecting mid-run, apply a dead zone to the sticks, and show a small controls hint for whichever input was used last, which fades after a few seconds. Ground height is sampled from the terrain each frame so the character and camera stay on and above the surface. **The character can dive.** Below sea level the controller switches to swimming: full 3D movement, with the left stick or WASD moving relative to the camera and a rise/sink input (Space and Shift; gamepad bumpers). The camera follows underwater. Frozen seas are solid and can be walked on. If a frozen sea melts under the character, they start swimming. The character's suit is a declared illustration: no stat models the player. On the gamepad, the D-pad also works the condition sliders: up and down pick a slider, and left and right move it. Using it opens the Conditions panel if it is closed. A judge holding the controller can then use them without the mouse. A terrain patch of a few hundred metres with distance fog at the edges is the recommended setup because it keeps the controller and camera simple, but the engineering lead can choose another layout if it stays within the performance budget. The character spawns when the particles from the box have become solid ground (about 6 s in), and movement keeps working through every phase.

## Generation sequence (what the judges watch)

The particles from the box settle into the ground (see "The particle box and the Generate transition"), and the terrain then rises to its full heights by the end of formation. The terrain generator must put a shoreline near the spawn point in both worlds, or silicon life is never seen. Seas rise during the seas phase, liquid or frozen according to the current temperature and the solvent's freezing point, and then follow the sea stats for the rest of the run. The terrain patch stands in for the whole planet: `seaLevel` is the height at which the fraction of the patch lying below it equals `seaCover`. Plants are drawn by the art layer from the per-cell flora biomass, and they reach land only when the simulation says life has (the grid cell's biomass is zero until then). Creatures are F's lofted bodies, built from each genome's `develop()` plan and animated on the GPU (spines, IK legs, pulsing bells), so the population visibly changes as it evolves. Sky and light follow the star and atmosphere, art-directed to look vibrant. Each phase change triggers the caption in the UI. Generation is part of the show, so it should be smooth and legible, not hidden behind a loader.

Silicon life starts in the shallows, so at first it must read from the shore, or close up when the player dives. Liquid nitrogen is clear and colourless, so organisms are visible through it. Crystalline flora grows along the sea margins, and as the seas shrink it leaves bands of dead crust behind, showing the feedback loop on screen. Later, floaters drift in the thick air, and some lineages walk the shore (speculative, see "Life: creatures and plants").

## Terrain and landforms

The terrain is logic: the player, the sea level and the flora grid all read it. It lives in `src/gen/terrain.ts`, owned by the engineering lead. Every coefficient is in the world's `terrain` config (`TerrainConfig`), with `why` and `sources` or `assumption: true`.

- **One height function, two backends.** `height(x, z, progress)` is a closed-form analytic function: base fBm, domain warp, and closed-form landform progress fields. It's written once as a TSL node for the GPU mesh and once as a pure TypeScript sampler that the player, flora and tests use. Tests check the two agree. This is the L0 layer of `docs/features/terrain-plan.md`. Its L1 simulated layer (erosion, talus, rimstone) stays in `docs/NOT_NOW.md`.
- **Formation rise.** A `rise` input goes from 0 to 1 across the formation phase (0–10 s) and scales relief up from flat. The particles from the box land on `height(·, rise)` as it stands at that moment.
- **Sea level from sea cover.** The patch stands in for the planet. `seaLevel` is the height at which the fraction of the patch below it equals `seaCover`. The worker finds it numerically from the CPU sampler each snapshot.
- **A shore near spawn.** The spawn point is on land, within `spawn.shoreDistance` metres of the shoreline at the seas-phase sea level. The height function carves a gentle shore ramp there, so it holds for every slider setting inside the living bands. This is tested for both worlds.
- **The terrain clock.** Each landform machine turns `historyYears` into its own progress, using a rate per billion years from config. The phase `startYears` anchors set the order, so landforms appear in their real relative order. Only the overall speed is compressed.
- **Landform heat.** Landform gates read `heatSolvent`, which is temperature normalised so that 0.5 sits at the solvent's freezing point (span in config). F's `Heat` input keeps the living-band normalisation ("How F's inputs come from our worlds").

**Landforms per world** (machines and gates from `research/world-forms/`, rules 1–6):

| World | Landform | Machine | Gate (all from state, no preset code) | Tag |
|---|---|---|---|---|
| Both | Strata and banded walls | M5 stack-and-strip | age | [sci] |
| Both | Canyons | M4 abrade | depth ∝ age × past liquid. Steepness rises with dry heat (fixes the inverted heat→wall rule) | [sci] mechanism, [game] rule |
| Carbon | Hoodoos, frost fins, and the arches they become | M3 crack-and-pry | Water only, with `heatSolvent` near 0.5 (freeze–thaw). Water is the only solvent that expands on freezing | [sci] |
| Carbon | Shell stone: reefs, stromatolites, limestone pillars | M6 life-built | water + producer biomass in the shallows + age. The R2 exception: "carbon rusts to air, unless life in water makes shell". Say "shell" on slides: real carbonate needs calcium, which isn't modelled | [sci] analogue |
| Silicon | Relic water-ice bedrock arches and spires | none: seeded | part of the seeded starting terrain, rising with `rise`. No process grows them | `assumption: true` |
| Silicon | Silicon-nitride crystal crusts and dead crust bands | M2 precipitate | producer biomass at the sea margin. Crusts left above a falling sea level become dead bands | speculative |
| Silicon | none of: frost wedging, dissolving, builder spires | n/a | N₂ contracts on freezing, liquid N₂ dissolves almost nothing, and builders need oxygen | [sci] |

```ts
interface TerrainConfig extends Sourced {
  patchSize: number;                 // metres; a few hundred, with fog at the edges
  base: Record<string, number>;      // fBm amplitude, octaves, warp and so on
  spawn: { shoreDistance: number };  // metres from spawn to the seas-phase shoreline
  heatSolventSpan: number;           // °C span mapped onto heatSolvent 0..1
  machines: { id: 'M2' | 'M3' | 'M4' | 'M5' | 'M6'; rate: number; params: Record<string, number> }[];   // rate per billion simulated years
  relics?: { kind: 'iceArch' | 'iceSpire'; count: number; params: Record<string, number> }[];   // silicon only; seeded
}
```

## Logic → art interface

The art layer sits on top of this logic and only reads it. It never writes sim state, and nothing visual is read back (DECISIONS §G.9). This file doesn't choose a look or name a mockup. The active art-direction doc is set by Caden.

**What the art layer reads (`VisualInputs`, assembled each frame from the latest `SimSnapshot` and the `WorldConfig`):**
- **World facts:** `worldId`, `status`, `starType`, `solvent` (name, freezeC, solidSinks), `life.composition`.
- **Live stats:** temperature, pressure, oxygen, nitrogen, seaCover, `seaLevel`, and frozen (temperature < `solvent.freezeC`).
- **Normalised drivers:** `heatBand` (living band 0..1), `heatSolvent` (0.5 = freezing), light at the surface, air density, and `age` (`historyYears` ÷ the present phase's `startYears`).
- **Terrain:** the TSL height node and the CPU sampler, the `rise` value, and the per-machine progress values.
- **Life:** the `organisms` buffer, the `births` plans (`develop()` output), the per-cell `flora` grid, a `lifeOnLand` flag (true once any land cell has flora biomass), and `phaseId`.

**Rules for the art layer:**
- Everything that carries meaning must follow these inputs (see "Visuals are stylised but never contradict the stats").
- Decoration is allowed, but only as a pure function of these inputs. For example, plant shapes come from flora biomass, composition and conditions, and body templates are look attractors applied to `develop()` output.
- The only messages from art back to logic are the `inspect:*` bus events.

## Honesty box (say it if asked)

- **Emergent:** which body plans appear and which traits spread, population sizes, and how the air and seas change as life feeds back on them.
- **Seeded:** the founders (at least 24 capsule worms at first life, with standing variation), the RNG seed, and the starting terrain, including silicon's relic ice arches and spires.
- **Designed, not emergent:**
  - `develop()` and its chemistry rules, the 12-gene layout, the trait-ledger coefficients and the locomotion costs
  - the 12 rules and the shared utility loop's structure
  - the form definition (DECISIONS §A) and the name generator
  - every process and feedback rate
- **Tuning cheats:**
  - always-on raised mutation (`SIGMA` 0.075, about ×1.5)
  - the compressed pace rule
  - the ×4 ecology clock
  - Hunger as plant scarcity
  - grazing that takes only a share
  - consumer interference
- **Speculative (silicon):** the chemistry itself, silicon–nitrogen bodies and ceramic plates, glow from non-oxygen chemiluminescence, the crystal crusts, life leaving the sea, and the nitrogen feedback loop.
- **Illustrations (render-only):** the particle box, the counterpart render in inspect cards, sky and fog, plant shapes (the sim has only per-cell biomass), body-template look attractors, IK feet (in the sim, agents are points), and the player's diving suit.

## Demo script (three minutes, strict)

Generate is clicked at about 0:15, so the zoom into the box happens at 0:15–0:20, the character spawns at about 0:21, and phase starts land at: seas 0:25, first life 0:40, life reshapes the air 1:05, complex life 1:45, present and summary card 2:25.

| Time | On screen | Talk track |
|---|---|---|
| 0:00–0:15 | Selection screen, sliders at their defaults (leave them untouched for the rehearsed run). The particle box shows carbon chains wiggling in water. Click Generate at 0:15. | "Every living thing on Earth is built on carbon. Carbon has siblings. You choose: life is what-based?" |
| 0:15–0:40 | Zoom into the box, and the particles multiply into the ground. Formation and seas; the judge starts walking at about 0:21. | Explain that the world is generated outward from a chemistry, and every condition has a reason. Click the sea: the card shows water at 15 °C beside a silicon world's liquid nitrogen at −183 °C, with a small render of each. |
| 0:40–1:45 | First life: tiny capsule worms in the shallows. The first legs appear at about 1:00 (a tuning target). The atmosphere starts changing. | Explain the two-way loop: conditions select which life survives, and that life changes the air. No disasters, just slow processes. Open Conditions to show oxygen staying flat at first, then rising. Click a creature: its traits, and what it would look like built from silicon. |
| 1:45–2:25 | Complex life: legged grazers, hunters and plated prey (tuning targets). The judge opens Conditions (Tab, or Y on the controller) and moves the Temperature slider (mouse, or D-pad). | Point out evolution happening live: push Temperature up and traits shift towards heat tolerance, then the thumb stops at 122 °C, the hottest any known life grows. Bring it back down so the population recovers before the summary card. Mention the genome-based model running in the background. |
| 2:25–3:00 | Summary card beside Earth | Close on the idea: "Carbon is life as we know it. Silicon is our best-reasoned guess at life as we don't." |

A judge takes the controller (or keyboard) from the start and walks while we talk. If they stall, get lost or the clock gets tight, one of us takes over smoothly, ideally with the second input device so there is no handover fumble, and steers towards whatever the next talking point needs on screen. Rehearse both the judge-led run and the takeover.

Rehearse silicon as well, so we can switch to it if the judges ask "what about silicon?" Know the caveat line by heart. On silicon, the sliders are the fastest answer, and it can start on the selection screen:
1. Select silicon. At 15 °C the box shows its nitrogen pool boiling off.
2. Drag Temperature down to −183 °C, and carbon's cell goes red.
3. Silicon stays red until you raise Nitrogen, because its seas need enough nitrogen to exist. When the pool condenses in the box, silicon chains start to form.
4. Push Oxygen up, and the silicon rusts into grey rock in the box.
5. Pull Oxygen back to zero and click Generate.
6. In the running world, click a crystalline crust: what it is, and what it would look like built from carbon.
7. Open Conditions. The same Temperature track shows a narrow living band at the cold end, and the Oxygen thumb won't move off zero.
8. Lower Nitrogen and the Temperature red wall slides down, because a smaller sea evaporates completely at a lower temperature.

## Scope and priorities

| Priority | Work |
|---|---|
| P0 (MVP) | Selection screen. Carbon world fully working end to end: generation phases, stats panel, captions, life–atmosphere feedback, population evolving, third-person walking. Silicon world with its own phases, stats, reasoning, caveat and feedback. Temperature, Nitrogen and Oxygen sliders with live red zones in both worlds. The particle box on the selection screen and the zoom-and-duplicate Generate transition. A clean in-world screen: the Conditions panel (closed by default), brief fading captions, and click-to-inspect cards with the side-by-side comparison and a live 3D render of the counterpart. Caden's creatures and plants: genome, `develop()`, the ecology with its state machine, lofted bodies with IK legs, L-system flora, and the field guide tab. Summary card beside Earth. Deterministic demo seeds. 60 fps. Recorded backup video. Devpost submission. |
| P1 | Nothing yet. Creature inspection became click-to-inspect, which is now P0. |
| P2 | Animated creature locomotion. Sound design that shifts per world. Procedural variation across non-demo seeds. Extra lighting and sky polish. |

Do not start P1 work until every P0 item works on the demo laptop.

**Build order.** Build pure logic first, so the UI and rendering can build against real functions straight away. Three tracks run in parallel.
- **Simulation (engineering lead):**
  - **Done:** the climate core, `src/sim/population.ts`.
  - Next:
    1. Scaffold Vite and three.js, with a plain placeholder render that reads `VisualInputs` (the art layer replaces it).
    2. `worlds/types.ts`, `worlds/controls.ts`, and the carbon config (unpinned values marked `assumption: true`).
    3. `sim/models.ts` and `sim/limits.ts`, with tests.
    4. The worker: timeline, processes and feedbacks.
    5. A headless test that the carbon demo seed lands inside its targets.
- **Creatures (Caden):**
  1. `sim/genome.ts` (15 genes), `sim/develop.ts` and `sim/constants.ts`, with a test per genome.
  2. `sim/guide.ts`: OTU clustering, `guide:newForm` and the name generator.
  - The engineering lead builds `sim/grid.ts`, `sim/ecology.ts` (grown from `population.ts`: the 12 rules, the 64² grid and per-cell flora biomass), `sim/relationships.ts` and `sim/metrics.ts` against these exports. See `docs/superpowers/plans/2026-11-07-backend-mvp.md` Task 5.
  3. Bodies rendered as beads first (one instanced sphere per joint).
  4. Then the GPU pose passes, lofted bodies and IK legs.
  5. Then plant shapes from the flora grid (art layer).
- **World and UI (design partner and engineering lead):**
  1. `gen/terrain.ts` (heights, rise, seaLevel, spawn shore) with tests, then seas (level and frozen state), and sky and light from the star.
  2. The character and camera, including swimming: keyboard first, then gamepad.
  3. The particle box and `boxState()` (this needs only `sim/limits.ts`).
  4. The selection screen, the Conditions panel, the field guide tab, captions and the summary card.

**Checkpoint, about 01:00:** the carbon world runs end to end. The sliders work, and bead-bodied worms graze and evolve. If it doesn't, cut now, using the list below.

Then, in order:
1. The Generate transition.
2. The silicon config and its look.
3. Click-to-inspect, with counterpart renders. These need both worlds' looks and `develop()`.
4. Rehearse, record the backup video, and submit to Devpost by 10:30.

If time runs short, cut in this order:
1. Gamepad support (keyboard handover still works).
2. F's verlet tentacles, then FABRIK (keep 2-bone IK legs), then frills (dorsal rods only).
3. A bespoke silicon look (palette-swap carbon's).
4. Field-guide thumbnails (keep the names).
5. Lofted skinning, falling back to bead bodies.

Never cut the sliders, the particle box, the Generate transition, the Conditions panel, the inspect cards and their counterpart renders, the summary card, silicon's faceted development, or IK legs.

## Commands

TypeScript and Vitest are set up at the repo root for `src/`, and Vitest only looks in `src/`, so it ignores `mockups/`. Vite and three.js arrive with build step 1; add the `dev` and `build` scripts then, and update this section.

- `npm run dev`: start the dev server (from build step 1)
- `npm run build`: production build (slow; Tier 2 only; from build step 1)
- `npm run typecheck`: typecheck
- `npm test`: full unit suite
- `npx vitest related --run <files>`: tests for changed files only

## Testing (fast tiers)

Speed is the point. Run the cheapest tier that answers the question.

| Tier | When | Runs | Budget |
|---|---|---|---|
| **0** | Every edit loop | typecheck + related tests for the files you touched | < 15s |
| **1** | Once, before reporting a feature done | typecheck + full unit suite | < 60s |
| **2** | Once per merge to `main` | Tier 1 + build + run the demo path once by hand | < 3 min |

- **Test** the sim: the seeded RNG, the phase and year mapping, the derived-stat models (vapour pressure, sea volume, radiative balance), feedback integration, and that each world's demo seed lands inside its `targets` at the present phase. Also test that the same seed gives the same snapshot sequence, and every bug you fix (failing test first).
- **Test the sliders' logic:**
  - Living bands match the physics:
    - On silicon, lowering nitrogen lowers the upper temperature edge, and that edge never exceeds −147 °C.
    - On carbon, the upper temperature edge stays at 122 °C whatever the nitrogen.
  - No sequence of `control:set` messages can put the world inside a red zone.
  - The sim's kill conditions sit exactly at the band edges.
  - `canLive` agrees with `livingBands`. For example, at −183 °C and 1 × nitrogen, both carbon and silicon are red, and silicon turns green once nitrogen is high enough.
  - `startingConditions` keeps in-band values, replaces failing ones with `startDefaults` in the fixed order and reports each move. For example, untouched sliders on silicon move Temperature first, then Nitrogen.
  - `livingBands` returns `empty` when no position works. For example, silicon's Nitrogen track at 15 °C.
- **Test `boxState`:**
  - It never shows living chains when `canLive` fails, and it plays the failing limit's `boxEffect`.
  - Water ice floats and nitrogen ice sinks (from `solidSinks`).
- **Test determinism:** the default slider values give the same snapshot sequence on every run, for both worlds.
- **Test the creatures (F):**
  - `develop()` is pure and gives the expected plan for each test genome. Silicon gives facets and 15° joints; carbon gives curves.
  - The headless ecology runs each world's default seed and reaches its tuning targets (for example legs on carbon by about 1:00).
  - The DECISIONS §A variety metrics on headless runs. A new rule ships only if its A/B raises one.
  - Guardrails as tests: `sim/constants.ts` has ≤ 25 entries, and the builder output is zero on silicon.
- **Test the terrain:** the CPU sampler matches the height formula; `seaLevel` gives the requested `seaCover`; spawn is within `shoreDistance` of the shore in both worlds at the default seeds; `rise` 0 is flat.
- **Config checks as tests:** every stat, process, feedback, limit and reasoning step has `sources` or `assumption: true`; every id referenced by a phase exists; speculative worlds have a `caveat`.
- **Don't test** rendering, UI, the character controller or styling. Check them by hand.
- A test slower than 2s gets fixed or moved out of the default run. Fix the code, not the tests.

## Working conventions for Claude Code

- Keep all world facts and rates in `src/worlds/` with `why` and `sources`, and never hardcode them elsewhere. When adding a stat, rule, process or feedback, add its source to `sources.ts` or mark it `assumption: true` and open or link a GitHub issue for it.
- Keep the simulation deterministic for a given seed. Do not add random events or disasters.
- Do not change the data contract without flagging it, because the UI depends on it.
- Prefer instanced meshes for anything repeated. Profile before optimising.
- Read files before editing. Match existing patterns, and don't refactor adjacent code. No features beyond what was asked.
- Commit small and often with clear messages, staging by path, because two people are working in parallel. Never `git stash`.

## Docs and research in this repo

| Path | Status |
|---|---|
| `docs/TRACK.md` | Still applies: the challenge text and our scoring rubric (`/judge`). The fps bar here (60) overrides its 50. |
| `research/silicon-life/` | The evidence base for the silicon world. `REPORT.md` §3 and §10 have verified DOIs for Petkowski 2020, Bains 2004, NRC 2007 and Kan 2016. Its "off-limits" claims list applies to captions and the pitch. |
| Art-direction docs and mockups | **The art layer**, separate from this file. It reads the logic through "Logic → art interface" and never adds logic. Caden sets which art doc is active. |
| `docs/DESIGN.md`, `docs/WORLD_ATLAS.md` | The previous concept. Its controls and four-sea worlds are replaced by this file. Its creature rules (R1 stiff silicon bones, R9 life is the colour, R10 hunger makes hunters, R11 thick air is a sea) live on through F's development rules. |
| `docs/emergence/DECISIONS.md` | **The creature rules** (rev 2): guardrails §G, the 12 genes, constants, 12 rules §3, metrics §A, science → body §B. It matches this file on glow (from darkness), the 1,024 cap and the 15-gene budget. |
| `docs/emergence/F-body-plan-first.md`, `docs/emergence/README.md`, `research/body-plans/` | **The creatures** (Caden). The reference for `develop()`'s chemistry grammar and body rendering. DECISIONS wins where they differ. "Life: creatures and plants" wires them to our controls. |
| `docs/features/terrain-plan.md` | L0 (analytic heights and progress fields) is adopted in "Terrain and landforms". L1 and L2 stay parked. |
| `.claude/skills/world-style` | Rendering and TSL guidance still applies, with the exceptions listed under Stack. |
| `HACKATHON.md` | Generic playbook; its timeline assumes four people. Use the dates in this file. |
| `research/world-forms/` | The landform machines and gates used in "Terrain and landforms". |

Agents in `.claude/agents/` (feature-agent, debugger, scout, bar-raiser, explorer, test-runner, team-lead) and the skills `/verify`, `/fix`, `/ship`, `/judge` and `/demo` are available.

## Open questions

Open questions and follow-ups live in **GitHub issues**: https://github.com/ZainKramutally/WHACK/issues. Items that need an owner ruling carry the `decision` label. Area labels: `sim`, `worlds`, `terrain`, `player`, `ui`, `art-layer`, `coordination`, `eng-lead`.
- **New items:** open an issue, not a bullet here. When you mark a value `assumption: true`, open or link an issue for it.
- **Resolved items:** write the answer into the relevant section of this file, then close the issue with a link to the commit. This file stays the design's source of truth, and issues hold only what's still open.

Considered and rejected: a dim red dwarf for the silicon world. Petkowski 2020 does say nitrogen oceans can last billions of years around one, but red dwarfs barely brighten over that time (so there is no slow warming to drive change) and they flare, which conflicts with the no-disasters rule.

## Sources to verify before citing in the demo

Already verified, with DOIs in `research/silicon-life/REPORT.md`: Bains, W. (2004), "Many chemistries could be used to build living systems", *Astrobiology*. Petkowski, J. J., Bains, W. and Seager, S. (2020), "On the potential of silicon as a building block for life", *Life* (including Appendix C on silicon chemistry in cryosolvents, and the solubility limits in liquid nitrogen). National Research Council (2007), *The Limits of Organic Life in Planetary Systems*. Kan, S. B. J. et al. (2016), "Directed evolution of cytochrome c for carbon–silicon bond formation", *Science*, as a real-world aside on biology and silicon. Crust and body composition (28% Si, 0.02% C; body 18% C).

Still to verify: NIST Chemistry WebBook for nitrogen phase data (triple point, vapour-pressure curve, critical point). A standard bond-energy table (for example the CRC Handbook) for C–C, Si–Si, Si–O and Si–H. Sagan and Mullen (1972) on the faint young Sun. Reviews of the Great Oxidation Event, the oxygen sinks that delayed it, and organic carbon burial as the source of atmospheric oxygen. Walker, Hays and Kasting (1981) on weathering as a climate thermostat. Takai, K. et al. (2008), *PNAS*, on growth at 122 °C (*Methanopyrus kandleri* strain 116). Snowball Earth reviews (for example Hoffman et al. 2017, *Science Advances*) for the carbon lower temperature bound. NIST densities of solid and liquid nitrogen (solid sinks). Goldblatt, C. et al. (2009), *Nature Geoscience*, on nitrogen-enhanced greenhouse warming. Som, S. M. et al. (2016), *Nature Geoscience*, on the early Earth's air pressure being under half of today's. NASA and ESA Cassini–Huygens material on Titan's surface temperature, pressure and seas.
