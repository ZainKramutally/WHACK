# Life Is ▢ Based

Hackathon project for WHACK 26, targeting the Marshall Wace "New Worlds" challenge. This file is the source of truth for what we are building, the rules the science must follow, and how the code is organised. Read it fully before making changes.

## What we are building

A browser experience built with three.js. The player completes the sentence "Life is ▢ based" by choosing an element from group 14 of the periodic table. A world that suits that chemistry is then generated procedurally around them while they walk through it in third person. The world builds itself in about 20 seconds: terrain rises, seas fill, an atmosphere settles, and life grows from tiny worms to complex forms, all together. Then it lives: the ecology keeps running and evolving, and life and planet keep changing each other. A stats panel compares every condition with Earth and explains, in one plain sentence, why it is the way it is.

The project is speculative by design. Our interpretation of "New Worlds" is imagining what new forms of life would look like if life were built on different chemistry. The speculation is the point, but it is disciplined: every world is built outward from real chemistry and physics, so judges can follow the reasoning from "silicon bonds are weaker" all the way to "so this world is frozen and has no oxygen".

The MVP has two worlds. Carbon gives a living world we recognise. Silicon gives a strange, cold, slow, speculative one.

## Context and constraints

The Marshall Wace brief asks for a project that "opens a door to the unexplored", judged on creativity, technical complexity and good presentation (our scoring rubric is in `docs/TRACK.md`). Judging is a strict three-minute slot with the sponsor, presented on our own laptop. **Feature freeze: 10:00 on Sunday 8 November (owner).** After that, only demo-path bug fixes. Devpost submissions close at 11:00 on Sunday 8 November 2026, and judging starts at 12:30. Unsubmitted projects are ineligible, so submit something by 10:30 even if it is unfinished.

Owners:
- **Engineering lead:** generation (including terrain logic in `src/gen/`), simulation, character and integration.
- **Caden** (creatures and design partner): the creatures (design F logic), the UI (selection screen, panels, cards), and the **art layer**, which sits on top of this logic and only reads it (see "Logic → art interface").

This file covers the logic only. Look decisions (palettes, render style, materials, post-processing) belong to the art layer's own docs. Claude Code assists everyone. Changes that affect the data contract in this file must be agreed with Caden and the design partner first.

## Non-negotiable rules

**Grounded speculation.** Every stat, rate of change and causal explanation starts from known chemistry and physics. Where a world goes beyond what is known, which the silicon world does by design, the reasoning must still follow logically from real properties, and the UI labels it as speculative. Carbon is "known"; silicon is "speculative". Never present speculation as established fact. A speculative world also states the strongest case against it (its `caveat`), so we are never caught out by a judge who knows the literature. The UI marks every `assumption: true` value as an assumption on every world, including the "known" carbon world.

**Science lives in data, not in rendering code.** Every number that describes a world (temperatures, pressures, gas fractions, rates, thresholds, coefficients) lives in that world's config file with a `why` sentence and a `sources` reference. Code may contain the *form* of an equation (for example, a radiative balance or a vapour-pressure lookup), but every coefficient it uses comes from config. Rendering and simulation code never hardcodes a world fact. If a value cannot be sourced, set `assumption: true` on it and open or link a GitHub issue for it (see "Open questions").

**No natural disasters.** Conditions change only through life itself changing the air and seas (see "Life changes the planet") and through the player's sliders. No eruptions, impacts, flares or random events.

**Visuals are stylised but never contradict the stats.** The look can be vibrant and art-directed; it does not have to be photoreal. But anything that carries meaning must match the simulation: seas freeze only when the stats say the solvent is below its freezing point, sea level follows the sea-volume stat, forests appear only when life has reached land, and lighting gets warmer or dimmer in step with the star. If a visual and a stat disagree, fix the visual.

**Deterministic demo.** All randomness comes from a seeded generator. Each load picks a fresh seed (in `main.ts`, the only place a random seed is drawn), so every run grows a different world; `?seed=N` replays a run, and `?demo` uses the world's pinned demo seed, so with the sliders at their defaults the live run matches rehearsal exactly. The Conditions panel shows the seed with a copy-link. The simulation advances in fixed 20 Hz ticks. During the build, the worker runs a fixed tick schedule that depends only on build time, many ticks per frame (see "The ecology clock"). After the build, it paces ticks against the wall clock at the live `timeScale`, running extra ticks to catch up when it falls behind. The sequence of states therefore depends only on the seed and the slider input, never on frame rate, so a dropped frame cannot change the outcome.

**Performance.** 60 fps on the demo laptop at the resolution we present at. If it drops, reduce creature or plant counts before cutting features.

## The experience

**Selection screen.** The sentence "Life is ▢ based" with group 14 shown as a column of the periodic table. Carbon and silicon are selectable and show their status labels. The rest of the column (germanium, tin, lead, flerovium) appears greyed out for visual completeness with a one-line reason, for example "Bonds even weaker than silicon's" for germanium, or "Made in a lab; atoms last only seconds" for flerovium. These are not selectable in the MVP. Clicking carbon or silicon selects it (carbon is selected by default). The three condition sliders sit beside the column, and the carbon and silicon cells show live whether their life could survive at the current settings. On the side of the screen, a **particle box** shows the selected element's chemistry as atoms and molecules, reacting live to every change (see "The particle box and the Generate transition"). Clicking **Generate** zooms into the box, and its particles multiply into the new world's ground. There is no loading screen.

**Generation and exploration.** The world builds itself in one fast run of about 20 s (see "The build (one fast run)"). The player character spawns as soon as the particles have become solid ground, about six seconds in, and can walk and look around from then on. The screen shows only the world. Stats, sliders and explanations live in a Conditions panel and in inspect cards that open on click (see "In the world: a clean screen, and click to inspect"). A one-line caption fades in at the start of the build, and another when life appears.

**Condition sliders.** Temperature, Nitrogen and Oxygen sliders are available the whole time, from the selection screen for as long as the world runs. On the selection screen they are on screen and set the planet's starting conditions. In the world they live in the Conditions panel, which is closed by default; there they change conditions live, and the player watches life respond. Each slider shows the same full range in every world, with red zones where that world's life would die. Once a world is running, the thumb cannot enter them (see "Condition sliders" below).

**After the build.** When the build finishes, `build:complete` fires and the world keeps living: the ecology keeps running and evolving live, and the sliders still make life respond. A summary card shows the world's current stats beside Earth's, plus the dominant life form's traits. It opens from the Conditions panel at any time and never pops up on its own. The player can close it, and the world keeps running behind it.

## Worlds

Each world is procedurally generated from its seed. The three sliders set the starting temperature, nitrogen and oxygen. Everything else (gravity, terrain, initial CO₂ and so on) is sampled from ranges that keep the world consistent with its chemistry, and later values come from the simulation. The tables describe each world with the sliders at their defaults, and give the reasoning the UI should surface. The sliders can move conditions anywhere inside the living bands, including outside these tables.

### Carbon (status: known)

| Stat | Range or trajectory | Earth today | Why |
|---|---|---|---|
| Mean surface temperature | 5 to 25 °C at the end of the build | about 15 °C | Water must be liquid; carbon chemistry in water works well in this band. Set by star brightness and the CO₂ greenhouse. |
| Surface pressure | About 1 bar by default; derived from the gases and gravity | about 1 bar | At 1 bar, water is liquid between 0 and 100 °C. |
| Gravity | 0.8 to 1.3 g | 1 g | Enough to hold an atmosphere; within the range of rocky planets. |
| Oxygen | 21% by default, nudged by life (the default is `assumption: true`) | 21% | Set by the Oxygen slider. Photosynthesis raises it, and consumers pull it back down. The start is Earth's value; at 0% bodies would sit at the oxygen size cap, with nothing in the build to raise it. |
| Nitrogen | 1 × Earth's by default | 1 × | Set by the Nitrogen slider. Life needs it for proteins and DNA. |
| Main gas | Nitrogen | Nitrogen | Unreactive bulk gas that persists over billions of years. |
| Carbon dioxide | Starts about 0.25%, rises slightly during the build, then holds steady | about 0.04% | Drawn down by photosynthesis, returned by consumers and by plant respiration and decay, which nearly cancel once life settles (`assumption: true`). |
| Solvent | Water | Water | Liquid over a wide temperature range and dissolves many carbon compounds. |
| Star | Sun-like | The Sun | The reference. |
| Pace of chemistry | 1 × Earth | 1 | The reference. |

### Silicon (status: speculative)

The reasoning chain the UI tells, one step at a time:

1. **Silicon is everywhere, yet life chose carbon.** Earth's crust is about 28% silicon and 0.02% carbon, but living things are about 18% carbon. Something stops silicon.
2. **Silicon bonds to itself weakly.** Si–Si is roughly 220 kJ/mol against roughly 350 for C–C, so silicon chains fall apart more easily. Cold slows that down.
3. **Silicon bonds to oxygen extremely strongly.** That is why the crust is silica rock. Free oxygen or liquid water would lock silicon away as rock, so this world must have neither. Water can exist only as frozen bedrock.
4. **Silicon's hydrogen compounds (silanes) burn on contact with oxygen and break down in water**, which reinforces step 3.
5. **So the solvent must be cold and unreactive.** The best-discussed candidate is liquid nitrogen (Bains 2004). Nothing in it attacks silicon bonds.
6. **In the cold, silicon's weakness becomes its strength.** At −183 °C, carbon chemistry is all but frozen. Silicon's weaker, more reactive bonds can keep reacting, and silicon compounds may dissolve in liquid nitrogen better than carbon compounds do (NRC 2007; `assumption: true`). Petkowski 2020 cautions that solubility of all molecules in cryosolvents, organosilicons included, is extremely low, which is part of the caveat below. This is why this world runs on silicon rather than carbon.
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
| Sea cover | Derived from nitrogen inventory minus what the air holds | about 71% | Seas shrink when life locks nitrogen into bodies, or when warming moves more nitrogen into the air. |
| Solvent | Liquid nitrogen | Water | Cold, unreactive and does not attack silicon compounds. |
| Star | Sun-like star about 10 times farther away than the Sun is from Earth | The Sun | Explains the cold; at Saturn's distance, Titan's surface is about −180 °C. |
| Pace of chemistry | Shown as the Arrhenius estimate from the config's activation energy (32 kJ/mol, so around 10⁻¹³ × Earth), labelled "compressed in the time-lapse"; in the sim about 0.42 of carbon's pace | 1 | Reactions slow sharply in the cold. Weaker Si–Si bonds lower the barrier. The sim compresses this so evolution is visible, and says so. |
| Pace of life (shown as the generation count, not a panel stat) | Slower than carbon life, fewer generations in the same time | n/a | Comes from the metabolism rule in config, not a hardcoded speed. |

We assume an oxygen-poor (reduced) planet where silicon is available in forms life can use (`assumption: true`). Making silanes from silica rock costs a lot of energy, so life does not start from silica. Its feedstock is reduced silicon already in the crust and shallows, as silicon-nitride and silicide minerals, which form on oxygen-poor bodies: nierite (Si₃N₄) occurs naturally in enstatite chondrites (Lee 1995). In the sim this is the per-cell silicon supply. Its energy is the dim starlight, through the same producer rule as carbon's (DECISIONS Rule 1). Both are `assumption: true`, shown as a feedstock fact. Caveat: turning N₂ into body nitrogen is costly (Earth's nitrogenase spends about 16 ATP per N₂; Burgess and Lowe 1996), and the sim folds that cost into upkeep.

## Life changes the planet

Conditions and life are coupled in both directions. The stats shape which organisms survive, and the population in turn shifts the stats. This two-way loop runs during the build and keeps running live after it. Apart from the sliders, it is the only source of change, and it is what makes the world feel alive rather than scripted. These feedbacks are light nudges, not slow geological processes: there is no deep time to run those over.

On the carbon world, photosynthetic organisms produce oxygen and draw down carbon dioxide. Consumers breathe oxygen and release carbon dioxide, so a booming animal population pulls oxygen back down. Oxygen starts at the slider value (21% by default) and moves from there. Rising oxygen makes larger body sizes viable. Falling carbon dioxide weakens the greenhouse effect and cools the climate, which favours cold-tolerant traits. Carbon's radiative balance carries this as about 3 K of cooling per halving of CO₂ from a reference of 0.04% (`referenceCo2` 0.04, `co2PerDoublingK` 3; Myhre 1998, Sherwood 2020). The real response takes centuries; the sim applies it at once, as an instant equilibrium, and marks that `assumption: true`. This is a simplification: on the real Earth, oxygen accumulates mainly because some organic carbon gets buried instead of decomposing, not simply because a lot is alive, and it took billions of years. The model treats net production as a stand-in for that, at rates set per ecology second, and the config marks it `assumption: true`.

On the silicon world, any feedback is speculative and labelled so. Organisms build their bodies from silicon–nitrogen compounds, so a growing population locks nitrogen away. Because the air is held at the seas' vapour pressure, the nitrogen comes out of the seas: sea level falls and the shallow, habitable margins shrink, which limits the population that caused it. When organisms die, their bodies return the nitrogen (`assumption: true`). Growth against decay gives a self-limiting cycle that follows from the world's own chemistry. The config's targets keep the temperature well below nitrogen's critical point, so the seas never vanish in the demo.

Every feedback rate lives in the world config with its reasoning, like any other stat, as a change per ecology second.

## The build (one fast run)

After Generate, the world goes from nothing to a living world in one fast build of about 20 s (`build.durationSec`). It is one continuous run, with no stages to wait through. Everything happens together: terrain rises, seas fill, the air settles, and life grows from capsule worms to complex forms. `buildProgress` goes from 0 to 1 across the build. When it reaches 1, `build:complete` fires, and the world keeps living: the ecology runs and evolves live at `timeScale`, life keeps nudging the air and seas, and the sliders still make life respond.

| Build time | What happens | Config |
|---|---|---|
| 0 to about 6 s | The Generate transition: the camera pushes into the box, the particles settle into the ground, the terrain fades in, and the character spawns | `spawnSec` |
| Whole build | Terrain `rise` and every landform machine's progress go from 0 to 1 | `durationSec` |
| Seas window | Seas fill in the lowlands, liquid or frozen according to the temperature, and the air settles (on silicon, at the seas' vapour pressure) | `seasSec` |
| Life appears | The founders appear in the shallows, and `build:life` fires | `lifeSec` |
| Whole build | The ecology fast-forwards on a fixed tick schedule, reaching about 340 ecology-seconds on carbon (see "The ecology clock") | `ecologySec` |
| After the build | The ecology runs live at `timeScale`, and the feedbacks keep going | |

**The years counter is flavour.** During the build, a compressed "years since formation" counter runs from 0 to `build.yearsShown`: about 4.5 billion on carbon and about 6 billion on silicon. It follows `buildProgress`, nothing in the sim reads it, and the UI labels it illustrative.

**Captions.** One when the build starts (`build.captions.start`, for example "A carbon world forms") and one when life appears (`build.captions.life`), plus the existing "why it moved" slider lines. Captions describe processes rather than outcomes the sliders can change, so they hold anywhere inside the living bands.

Population traits respond continuously to every change. The build timings are demo targets and live in config.

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
- ≤ 25 sim **tunables**, all in `src/sim/constants.ts`. A tunable is any value where ×0.5–×2 moves a pass-bar metric beyond seed noise. Implementation constants (cadences, caps, search resolution, refresh triggers, physics constants, field-guide label thresholds) are exempt but listed in DECISIONS §G.2. World facts go in world config, not here.
- One 64² world grid, ticking at a fixed 20 Hz.
- No cheats and no preset code. One declared exception, by owner ruling (issue #6): **spores**. A dormant bank of up to 24 recent-survivor genomes germinates when conditions become viable again after a population crash.
- Rendering is read-only.
- A new rule or feature ships only if a headless A/B raises a §A variety or readability metric.
- Parked ideas go to `docs/NOT_NOW.md`.

**What life is**
- **Animals:** up to 1,024 agents, never fewer than 1,000 in the demo, because smaller populations went extinct in Caden's tests. There is no lower quality tier for the population. Protect 60 fps by cutting render detail instead.
  - Each animal carries the 12 genes of DECISIONS G.1: size, segments, limbPairs, limbLen, plates, horns, gape, diet, eyes, buoy, glow and sociality. It also inherits its body composition {c, si, o}, which is not a gene.
  - It also carries our three climate genes from `population.ts`, used as built: preferred temperature, tolerance, and oxygen need (carbon) or cold stability (silicon). The genome is 15 genes in total.
- **Plants:** **per-cell flora biomass** on the 64² grid (mat and canopy), not individual agents. These are the producers. Plant shapes (L-system twigs and caps, and forms such as lantern cups or jellyshroom domes) are drawn by the art layer as a pure function of each cell's composition, light, `heatBand` and mat/canopy biomass (see "Logic → art interface"). There is no flora genome: plants do not evolve as agents, and the gene budget is full.
- **Development:** a pure `develop()` turns the genes plus body composition plus conditions into a body plan. It is the only place genes become traits. **Chemistry picks the body architecture, not just the skin**, so carbon and silicon life are fundamentally different and never mirror each other (owner ruling, 2026-11-07). **Extension (owner ruling, 2026-11-08, built):** silicon also grows an armoured bilateral walker, a biped or quadruped that walks with carbon's leg gait but in silicon's look: faceted segments, a silicon-nitride ceramic shell (the `plates` gene sets coverage), spikes for horns, angular rod legs and dot-eye clusters at the front. It appears where directed walking favours a front end (cephalisation; Holló 2015, to verify; `assumption: true`). The gate is genetic and heritable: a silicon body is bilateral when its `segments` gene is at least 0.55 and it has one or two leg pairs, so selection can move a lineage across it. Plan v4 adds `shellCover` (0..1, the share of segments under the shell; 0 for every other body), with `architecture: 'axial'` and `chemistry: 'silicon'`. Names use Bastion, Strider, Sentry or Plodder. In 5 headless silicon seeds, armoured walkers made up 1–19% of animals in every run, mostly bipeds, with radial forms still dominant. It still never mirrors a carbon body, and the radial forms remain. The same 12 genes are read through a different grammar on each world:
  - **Carbon: bilateral and axial.** A head-to-tail chain of soft, round, curling segments, paired limbs hanging from segments, a tail, and paired ring eyes at the head. Flexible, many-jointed and continuous.
  - **Silicon: radial and lattice.** No head or tail. A faceted crystal hub with 3-, 4- or 6-fold symmetry, straight rod arms radiating from it (joints snapped to 15°), facet tiers that accrete as it grows, ceramic tiles on facets, and dot-eye clusters at the arm tips. It moves by tripod-stepping on its arms, rowing with its arms with the hub level, drifting as a bell, or staying rooted as a crystal colony.
  - So a silicon genome and a carbon genome with the same numbers build unrelated bodies. For example, `segments` is spine length on carbon but facet tiers on silicon, and `limbPairs` is leg pairs on carbon but arm count (by symmetry order) on silicon.
  - The traits derived from these (radius profile, symmetry, eye and horn count, and so on) are listed in DECISIONS G.1.
- **Ecology:** DECISIONS §3, the 12 rules. One utility loop (forage, hunt, flee, home, rest, bud) runs over relationships derived from bodies (eats, afraid, rival, kin). There's one trait ledger, where every gene pays somewhere and earns somewhere.
- **Conditions shape bodies** (owner request, 2026-11-08, issue #66). Physical terms in the one trait ledger do it, found by selection, never by templates. All coefficients are in world config, `assumption: true`, and they are neutral at Earth-like defaults (21% O₂, 15 °C, 1× N).
  - **Oxygen** sets aerobic scope: sustained power ∝ O₂ (Fick; Sperling 2013, Harrison 2010, Graham 1995). Low scope slows movement, makes big bodies costlier to move and cuts a hunter's catch rate. The one size cap also shrinks for hunters. So 30% O₂ grows larger bodies than 5%: across 5 carbon seeds the largest was 1.87 m against 0.86 m. It is off on silicon, so O₂ = 0 there is neutral.
  - **Temperature** drives a heat balance on skin area per M^0.75 (Bergmann, Allen; Atkinson 1994). In the cold, skin loses heat, favouring compact, large bodies with short limbs. In the heat, heat must be radiated, favouring slender, long-limbed ones. F's temperature–size rule stays as is. Across 5 seeds, cold bodies were 47% bigger at −20 °C than at 35 °C, and the limb-to-length ratio was 6× higher in the heat.
  - **Gravity** loads limbs by the square-cube law (above).
  - **Nitrogen** is a producer nutrient on carbon, so low Nitrogen slows flora (−22% at 0.12×) and shrinks animals (−15% mass).
  - **On silicon, retreating seas strand swimmers.** They lose energy (`strandDrain`) and die unless they reach liquid, so the swimmer count follows the sea area. When the sea returns, habitat-aware slots (R8) let swimmers recover.
- **Glow comes from darkness, on both worlds.** The `glow` gene pays for itself as a lure only when light is scarce, so the dim silicon world evolves glow without any oxygen. On silicon the chemistry behind it is non-oxygen chemiluminescence, marked `assumption: true`. This replaces F's and DECISIONS' "glow ∝ oxygen".
- **Evolution recipe** (from Caden's measurements; without it, legs, plates, horns and hunters don't appear inside a demo):
  - **Gentle mutation, scheduled:** `SIGMA_BUILD` 0.02 for the build's fast-forward, easing to `SIGMA` 0.015 after `build:complete`, so species stay recognisable for minutes (the intended experience). The size gene steps 2× further (`life.rules.mutation.sizeBoost`, world config) so size can diverge.
  - **Rare big jumps (owner ruling, punctuated equilibrium; Gould and Eldredge 1972):** about 1.2% of births (`life.rules.mutation.jumpRate` 0.012, world config, `assumption: true`) take a large step (`jumpScale` 0.4) on 1–3 random body genes, so new forms can appear suddenly while species stay stable in between.
  - **Juveniles grow (R3, R8):** a newborn is never larger than its parent. It turns surplus energy into body at ledger `growRate` (0.05, `assumption: true`) until it reaches its adult mass, and it buds only at 90% of adult mass. Without this, a parent paying for a bigger child's whole body capped size growth at about 0.05 on the gene per generation, so giants could never arise. Matter is conserved.
  - **Opportunistic predation and pleiotropic jaws** (#48): see "Hunters now establish" below. In config: `dietBoost` 8 (the diet gene steps 8× further), `catchRate` 1.0, `meatAssim` 0.6. In develop(): `G.jawPleiotropy` 0.6 (designed, `assumption: true`).
  - **R8 displacement per M^0.75**: in a full world, the weakest animal is judged by energy per M^0.75, not per M.
  - **Lifespan follows adult mass** (#49): a growing juvenile ages on its adult clock (lifespan ∝ adult M^0.25), so a jump-born giant can live long enough to mature.
  - **Gentler diet payoff:** plant gain = (1 − diet)^p and meat gain = diet^p with `DIET_EXP` p = 1.15 (owner ruling #48; it was 2), so part-carnivores already gain from meat.
  - **Megafauna payoff:** food intake scales as M^`intakeExp` (ledger, 0.9 in both worlds, `assumption: true`; 0.75 would be Kleiber), so big bodies out-eat their upkeep.
  - **Herds:** grazers drift toward nearby kin in proportion to their `sociality` gene (ledger `cohesion`), so herds move together and low-sociality animals stay solitary.
  - **Competition for space (R8):** in a full world, a parent ready to bud displaces the weakest non-kin animal within 2 cells (lowest energy per unit mass), so better feeders win slots and selection works at the population cap. **Habitat-aware slots** (#80): if a locomotion mode's share of the animals has fallen below 90% of its own slowly decaying recent peak, a parent of that mode may instead displace the weakest of 12 sampled animals of other modes anywhere. This lets swimmers win back the sea after it returns, and walkers the land, without other lineages keeping the freed slots for good. In steady state, nothing fires. In the Nitrogen halve-and-restore test, swimmers recovered to 0.78–0.90 of a control run within 180 s, up from 0.51–0.87.
  - **Size niches (R4):** canopy food is reachable only in proportion to limb reach (ledger `canopyReach`), and deep-water food scales with swimmer length (ledger `deepScale`), so tall and large bodies open food that small ones can't fully use.
  - **No developmental pull in the sim.** Body templates become anonymous look attractors in the art layer, applied read-only (DECISIONS §G.3, G.9).
  - **The plate-ledger fix**, so plates are cheap enough to spread.
- **Founders:** when life appears in the build (`build.lifeSec`), a seeded group of at least 24 tiny capsule worms appears in the shallows, drawn from the world's seed. They carry standing variation: σ 0.12 on the listed genes, and about 15% start with tiny limb buds (`research/body-plans/notes/01-evolution-speed.md` §5). Complexity has to be earned.
  - **Every run starts from a different lineage** (owner ruling, 2026-11-08, issue #76). The run seed draws the founders' mean latent genes (diet, buoy, eyes, glow, sociality, gape, plates, horns, segments, limbLen, the limb-bud share and how far buds go, `budMax`, so some runs start as two-leg-pair worms) within per-world bounds (`life.founders.latent`, `assumption: true`). They are still small capsule worms, but evolution takes a different path each run. This is historical contingency (Gould 1989; Blount, Borland and Lenski 2008). With gravity, CO₂ and sea cover also sampled per seed, runs differ: between-run Bray–Curtis on a mode × size × diet histogram rose from 0.07 to about 0.38 on carbon and from 0.09 to about 0.27 on silicon (5 seeds, +2 min). Small swimmers still dominate most runs.
  - F's atom prelude and copier are not used. The particle box plays that role before Generate, and seeding founders from the box would break the deterministic demo.

**How F's inputs come from our worlds** (every scaling lives in config):

| F input | Comes from | Notes |
|---|---|---|
| Recipe (body composition c, si, o) | Fixed per world: carbon is carbon-rich with some oxygen; silicon is silicon-rich with no oxygen | Not a player control. Composition is still inherited and rebuilt at each birth, as in F. |
| Sea | The world's solvent: water or liquid nitrogen | F's "water dissolves bare silicon" lever doesn't arise in either world, so plates pay only as defence against hunters. |
| Heat | `heatBand`: temperature normalised within the world's living band (0 = lower edge, 1 = upper edge) | Drives F's temperature–size rule (cold makes giants) and heat stress. |
| rate(heat) | Our pace rule ("Metabolism" below) | One pace rule for everything alive. |
| Air density | Real gas density, P·M/(R·T), with M the **live mean molar mass** of the mix (Σ xᵢMᵢ over N₂, O₂, CO₂ and water vapour on carbon; pure N₂ on silicon; #84). It is scaled into F's range by `airDensity.scale` 0.05, the same on both worlds | Earth's air is about 1.2 kg/m³. The silicon world's 3.6 bar at −183 °C is about 13 kg/m³, so F's floaters (bells, sky whales) have a physical reason to appear there. Titan's air is about 4× denser than Earth's. On carbon, the Nitrogen slider changes it. One shared scale keeps the real 11× ratio between the worlds. Lift is compressed so gas bags can be built (real ones need about 99% gas by volume), and that is declared, `assumption: true`. |
| Light | Starlight at the surface (star brightness and orbital distance) | The silicon world gets about 1% of Earth's sunlight, so F's rules give it big eyes and glow. |
| Hunger | Derived, not a control: plant scarcity (demand ÷ supply) | A declared game rule; Caden's tests needed it for hunters to exist. Cold, dim light, low nitrogen or a population boom all raise it. |
| Time | The build's fast-forward and the ecology clock (below) | |
| Air oxygen (new, ours) | The Oxygen stat and slider | Aerobic scope (Fick): sustained power ∝ O₂ ÷ 21%, which sets top speed, movement cost and a hunter's catch rate. It also sets the largest body that can breathe (the one size cap in `population.ts`, smaller for hunters). Pinned at 0 on silicon, where the aerobic terms are off. |
| Gravity (new, ours) | `stats.gravity`, sampled per seed from `ranges` | Square-cube support load on walking and standing; flight power (m·g)^1.5; scale height RT/(Mg) |
| Nitrogen (new, ours) | The Nitrogen stat and slider | Carbon: a producer nutrient, growth × n/(n+k)·(1+k) (Vitousek and Howarth 1991; scaling `assumption: true`). Silicon: the sea volume, so swimmers in cells the seas leave are stranded |

Other world quantities: the solvent's liquid band already feeds the sim, through `heatBand`, and absolute temperature drives the pace rule. The liquid fraction is live too: sea cover sets sea level, and the liquid grid follows it. The light spectrum is render-only, because both stars are Sun-like and only the intensity differs. **Gravity enters flight through physics, not a multiplier** (owner request, 2026-11-08; `src/sim/flight.ts`, coefficients in `life.inputs.flight`, all `assumption: true`). Powered flight needs induced power (m·g)^1.5 ÷ √(2ρ·wing area) (Pennycuick 2008; Ellington 1984), against available power ∝ muscle mass × aerobic scope (O₂ ÷ 21% on carbon; a constant on silicon, whose metabolism isn't aerobic). develop()'s hover cost is the cheaper of that powered-flight cost and the older buoyant-floater term, so g, air density and wing area decide which bodies fly. Air thins with height over the scale height H = RT/(Mg), so each flier has a ceiling where available power meets required power: h* = (2H/3)·ln(P_avail/P_req) on carbon (2H·ln on silicon). Fliers forage at about 3 body lengths, climb to 80% of their ceiling to travel or flee, and land to rest or bud. They stay over land and the shore (the habitat lock is unchanged). **Flight is rare at Earth-like defaults** (owner ruling, 2026-11-08, #85). Muscle `specificPower` is 75 W/kg, a little below the 100–250 W/kg bird range. At defaults, airborne animals are about 0% on both worlds (the carbon demo seed had a 40% flock before). Fliers still take over where the physics favours them: 27–37% on the carbon demo seed at 0.8 g with ×3 nitrogen, and about 2% on silicon at 0.5 g. Whether a flying lineage arises depends on the seed. **Gravity and the air decide it together** (#84). On carbon, pressure scales with gravity times the gas inventory: at the demo seed, 0.81, 1.2 and 1.31 bar at 0.8, 1.18 and 1.3 g. On silicon the seas pin it (3.65 bar whatever g is). On the carbon demo seed, the airborne share at +2 min is 0.7% at defaults, 0% at 1.3 g, 8% with ×3 nitrogen, 12% at 0.8 g, 20% at 35% O₂ (more aerobic power) and 50% at 0.8 g with ×3 nitrogen. Silicon's Nitrogen slider can't change its air, so only temperature and seeded gravity move its fliers. A flier's card shows its ceiling ("Up to N m: the ceiling set by gravity and air density"). An earlier uniform × g on walk and hover cost failed its A/B, because it changed no shape's relative cost. **Walking is also loaded by gravity, differentially** (#66): the support load on limbs is g × body length × (drag + limb length²) (McMahon 1973; Biewener 1990). Long limbs on big bodies therefore cost more to walk on and to stand on at high g, and the population's limb-to-size ratio is lower on heavy worlds (a noisy 30% in the A/B).

**Silicon-world specifics** (speculative, labelled as such):
- **Plates are silicon-nitride ceramic**, not silica stone, because there's no oxygen. Silicon nitride is a real, very hard ceramic. `assumption: true`.
- **No builders.** F's builders need silicon plus oxygen to lay stone, and this world has no oxygen. The builder pathway is hard-off on silicon (it's gated on `o`, not on preset code), so life raises no spires and no glowing pores here.
- **Relic ice landmarks.** The silicon world's arches and spires are **water-ice bedrock** left over from formation. Water exists on this world only as frozen bedrock (reasoning step 3). They are part of the seeded starting terrain, not grown by any process, and are marked `assumption: true` (see "Terrain and landforms").
- **Producers saturate at 1% sunlight.** The world gets about 1% of Earth's sunlight, so silicon flora sees light × `floraLightGain` 100, capped at 1: its light curve saturates at 1% of Earth's (gain = 1 ÷ saturation). Saturating light curves are standard (Jassby and Platt 1976), and real phototrophs live far below 1% of surface light (Manske 2005). Eyes and glow still read the real light. Real low-light phototrophs grow slowly, and ours grow at full rate once saturated, so say so. `assumption: true`.
- **Leaving the sea.** Life starts in the shallows. As the seas shrink, some lineages go deeper, some take to the thick air, and some colonise the shore. Ceramic skins hold their internal nitrogen in, as waxy skins hold water. `assumption: true`.

**What is already built.** `src/sim/population.ts` is the climate core that F's ecology grows from: extend it, don't start a second model. It already has:
- the three climate genes and the pace rule
- oxygen's cap on body size
- two ecology stabilisers: grazing takes only a share of a plant, and consumers interfere with each other's feeding. Without them, consumers ate every producer within seconds.
- stable ids and a deterministic RNG

Its tests show the comfort band following a warming climate, oxygen-rich air evolving bigger aerobic consumers, silicon life surviving slow warming, and fewer generations in the cold. Each step it takes an `Environment` (temperature, oxygen, light, habitat share, edge stress) and returns producer and consumer biomass as the drivers for the feedbacks.

**The intended experience of life (owner ruling, 2026-11-08). Evolution is tuned backwards from this.**
- **At spawn (end of the build):** the player sees **4–5 species**, each clearly a different kind of animal, with many members each. Herbivores move in **packs or herds**. An **apex predator** is rare, large and **solitary**.
- **Over the next few minutes:** the player **discovers about 5 more species**, one every ~30–40 s, as new forms split off live and appear in the bestiary as locked kinds for the player to find. That makes about **8–10 species in total**, never a cloud of dozens.
- **Each species looks really distinct and unique.** Members of a species look alike, while different species look nothing like each other.
- **Founders start small.** Size and complexity are earned, with big bodies (megafauna) and the apex predator arriving as evolution goes on.
- **Mutation is gentle** enough that species stay recognisable for minutes. New species come from niche splits (habitat: land, sea or air; diet: grazer or hunter; size), not from noise.
- **Hunters now establish; giants don't yet** (2026-11-08, #48, #49).
  - **What made hunters work:**
    - Opportunistic predation: a hunt is worth the kill (prey mass × `meatAssim` × digestion), so any animal that can catch prey weighs it against grazing. Diet no longer has to rise first.
    - Pleiotropic jaws: effective gape = gape + 0.6 × diet, so meat-eating lineages get the mouth with the same mutation.
    - R8 displacement by energy per M^0.75 (metabolic scaling), so big animals aren't automatically the weakest.
  - **Results:** at +3 min, carbon seeds 1–4 had 39, 7, 2 and 0 hunters (diet > 0.65), with 6, 7, 2 and 0 in the top size decile.
  - **Solitary apex:** herd cohesion now scales with plant gain (herding is a grazer's anti-predator habit), so meat-eaters don't drift towards kin. At +3 min, carbon seeds 1–4 had 2, 6, 1 and 29 hunters, with 1, 3, 1 and 1 apex (top size decile), and mean hunter sociality 0.2–0.5.
  - **Giants:** animals ≥ 2 m stay at 0–1 per seed. Jump-born giants appear singly, and a juvenile giant has no surplus energy to grow: at the 1,024 cap it competes with every small animal for the same plants. Faster growth laws, longer lifespan, parental care and bigger newborns didn't change this (West et al. 2001 growth was tried and reverted). Fixing it would need food that big bodies can reach and small ones can't, which is a niche change.
  - **Say so if asked.**
- Targets the sim is tuned and tested against: 4–5 forms with ≥ 40 members each at build end; 8–10 forms by about +3 min; never more than ~10 at once; grazer packs of ~5–20 that move together; ≤ 3 apex hunters, each solitary.

**The ecology clock.** Caden measured that about 340 sim-seconds of ecology produce legs, plates, horns and hunters. So during the build the worker fast-forwards the ecology: it runs many fixed 20 Hz ticks per frame, on a fixed tick schedule that depends only on build time, never on frame rate, so the run stays deterministic. On carbon the schedule reaches about 340 ecology-seconds (`build.ecologySec`) by the end of the build. After the build, the ecology drops to the live `timeScale` in config, the same for both worlds, and keeps evolving. If CPU is tight during the fast-forward, reduce render detail, not the tick schedule. Silicon still gets fewer generations through its pace rule, so in the default run its creatures stay simpler: capsule worms, and perhaps legs and floaters. We accept that as honest: slow chemistry means slow evolution. The only help is silicon's lower activation energy (about 1.6× more generations; see "Metabolism"). There is no silicon-only clock, and no silicon founders seeded further along.

**Presentation, under the clean-screen rule.**
- **No camera pull-out:** the camera follows the player.
- **Bestiary tab** (replaces the field guide; owner ruling, 2026-11-08): next to Conditions, closed by default, badge "found/total". Logic in `ui/bestiary.ts`, drawn by `ui/bestiaryPanel.ts`.
  - **Discovery is the player's job.** Living kinds show as locked "?" tiles with their live count until the player clicks one of their animals; that click files the kind as found (a rare kind below 4 animals counts too) and shows the caption "New entry: Glass Strider". Names are never announced before they are found, so there is no "New form" caption.
  - **Extinction is filed automatically.** A kind with no live animals for `EXTINCT_AFTER_SEC` (5 s on the snapshot clock, so a dip to zero doesn't flicker) moves to "Died out" with an EXTINCT stamp, found or not. If the name comes back, it returns to the living.
  - Clicking a found or extinct tile opens its specimen page, a paper card: status, when it was found and first recorded, the most alive at once, the specimen's generation, and its body plan in words.
  - Each tile shows a pixel sprite drawn from the kind's real body plan (`render/sprite.ts`, read-only): the clicked specimen's plan once found, otherwise a typical member's. The specimen page shows a **live, turning 3D model** of the specimen in its species colours instead (#81, owner ruling). It is drawn from the plan, so extinct kinds work too, and falls back to beads and then to the sprite.
  - The bestiary is per run: a new world starts empty.
- **What counts as a kind (form):** the DECISIONS §A definition. A form is a cluster on the 12 genes plus composition (c, si), at radius 0.25, with at least 4 live animals, labelled by functional type (look attractor × trophic role × locomotion mode). Names come from a trait-based name generator, and the bestiary keys kinds by name. **A name's movement word says how the species actually moves** (owner ruling, 2026-11-08), chosen from several per mode by body traits:
  - swim: Eel, Paddler, Drifter, Darter; Rower or Sculler for silicon's radial swimmers, which row with their rod arms, hub level
  - fly: Floater (Bell on silicon), Glider, Flitter, Soarer, Flier
  - walk: Strider, Stomper, Skitter, Walker; Crawler (carbon) or Lattice (silicon) when legless; Spoke or Tripod for legged silicon
  - sessile: Frond or Anchor (carbon), Spire (silicon)
  - Diver, when at least 25% of members swim and at least 25% fly

  The name is a seeded **genus word** plus the movement word, for example "Vouheth Eel" or "Trikrix Lattice". The genus is a pronounceable word from the run seed and the species, with soft syllables on carbon and hard ones on silicon, and it is redrawn on a collision. Names therefore never repeat within a run and essentially never across runs. A species records its announcing animal's mode, and an animal takes a species' name only if it moves the same way and has the same body layout, bilateral or radial (Divers take both modes). The sim announces a **species** (`guide:newForm`) when a cluster of at least 20 members holds for 20 ecology seconds and matches no species already announced. **Pacing** (#54, for the intended experience): during the build only clusters holding at least 8% of all animals are announced, so 4–5 species stand at spawn. Clusters still pending at build end are forgotten, and afterwards species are announced one at a time, at least 25 ecology seconds apart, as they pass the bar. In 3 seeds per world this gave 3–5 at build end and 1–7 live over 3 minutes; names are distinct, with a trait qualifier on a collision. The UI's bestiary files a species only when the sim's `guide:newForm` arrives, under the sim's name (the sim is the single source of truth for what a species is). The UI's own clustering distance is used only to map live animals to the nearest announced species within 1.8 × the form radius (so animals in clusters too small to announce still read their parent kind), for "alive now" counts, the creature card's form name and the bestiary list; an animal that matches no announced species reads "(not yet a recognised species)" and never creates a kind.

**Metabolism (pace of life).** Each world's `life.rules.metabolism` holds an activation energy, a reference temperature and a compression exponent. With a typical activation energy (about 50 kJ/mol), the real Arrhenius factor at −183 °C is around 10⁻²⁰ of Earth's, which would mean no generations at all in a demo. The sim raises that factor to the compression exponent, 0.03. The same exponent applies to both worlds, so their paces compare fairly. It also stops carbon running away when the Temperature slider is pushed hot (about 1.2× at 122 °C). Silicon's activation energy is lower than carbon's, to reflect steps 2 and 6 of the reasoning chain: 32 kJ/mol, which is 50 × Si–Si ÷ C–C (222 ÷ 346), on the idea that weaker bonds have lower barriers (Bell–Evans–Polanyi). That puts silicon's pace at −183 °C at about 0.42 of carbon's, and its uncompressed estimate at around 10⁻¹³. Bell–Evans–Polanyi holds within one reaction family, so applying it across elements is our extrapolation. Both the exponent and the lowered activation energy are `assumption: true`, and the pace stat shows the uncompressed estimate with the label "compressed in the time-lapse". Silicon's slower generations come out of these rules, never from a hardcoded speed.

The simulation runs in a Web Worker so rendering never stutters. It posts snapshots at 20 Hz, with the organism buffer as a transferable, and posts each new body plan once, at birth.

## Condition sliders

Three sliders, and only these three, let the player change the conditions life depends on: **Temperature**, **Nitrogen** and **Oxygen**. **No gravity slider** (owner ruling, 2026-11-08): gravity is sampled per seed from the world's range and shown in the Conditions panel, beside air density. They are available the whole time: on the selection screen, through the build, and for as long as the world runs. In the world they sit in the Conditions panel, closed by default. A slider change is the player asking "what if?", not a natural event, and the UI labels it that way.

**On the selection screen (before a world exists):**
- **Starting positions.** The thumbs start at 15 °C, 1 × Earth's nitrogen and 21% oxygen, Earth's values.
- **The settings are the planet's starting conditions.**
  - Temperature: the sim solves for the orbital distance that gives that starting temperature.
  - Nitrogen: sets the planet's nitrogen inventory.
  - Oxygen: sets the initial free oxygen. Life then nudges it from there. On silicon, anything above a trace is in the red zone, so it glides to 0 on Generate.
- **The thumbs move freely across the full range.** There is no world yet, so there is nothing to protect.
- **The red zones are a preview** for the selected element, drawn lighter than in a running world. Hovering a red cell shows its reason.
- **The carbon and silicon cells show live whether their life could survive at the current settings.** A cell lights up when it can. It turns red, with the reason on hover, when it can't. This is a small puzzle with real physics behind it:
  1. Drag Temperature down to −183 °C, and carbon goes red ("Too cold for surface life").
  2. Silicon stays red ("Seas boil away: too little nitrogen to hold them") until Nitrogen goes up, because a nitrogen sea can only exist if the planet has more nitrogen than its air can hold. It then stays red for oxygen until Oxygen comes down to a trace.
- **Generate is never blocked.** When Generate is clicked, any slider sitting in the selected world's red zone glides to that world's default starting value (`startDefaults`), not to the nearest in-band value: the nearest value sits right at the edge, where life is stressed and the founders would die. A caption says why, for example "Silicon life can't survive at 15 °C, so this world starts at −183 °C". Sliders already inside the band keep the player's value. With untouched sliders, both worlds start from fixed values, so both demo runs stay deterministic.

**Once a world is running**, from the first second of the build, the rules below apply. Before life appears, a red zone means "life could never start here".

**Every world shows the same full range.** That way the player sees how narrow silicon's window is, and where it sits, compared with carbon's. Each track shows:
- the full range, identical in every world
- the **living band**, where this world's life can survive
- **red zones** outside the band, each labelled with why life dies there (for example "Seas boil away: too little nitrogen to hold them"); on the silicon world these labels are marked speculative
- a small Earth marker at Earth's value
- the thumb at the live value

**Changes ease in.** In a running world, the sim does not jump to a new slider value. It eases there linearly over 1 s on the demo clock, between in-band values (`CONTROL_EASE_SEC`, an implementation constant in DECISIONS §G.2). The ease is deterministic, so the demo run stays reproducible.

**The thumb cannot enter a red zone.** Dragging into one stops the thumb at the edge, pulses the zone and shows its reason. Approaching an edge, life is visibly stressed: the population falls, because the fitness rules read the same limits. The edge is exactly where the sim's kill condition sits. The slider and the sim read one list of limits from config, so they can never disagree.

**Red zones move.** The physics couples the conditions, so every band is recomputed in the worker each snapshot.
- **How a band is found:** it is the range of positions where no limit fails, holding the other sliders' physical settings (orbital distance, nitrogen and oxygen inventories) still. Its edges are found numerically through the derived-stat models, so couplings show up without special cases.
- **Example:** on the silicon world, a smaller nitrogen inventory evaporates completely at a lower temperature. So lowering Nitrogen slides the Temperature slider's upper red zone down.
- **Coupled drags:** a drag on one slider that would push a coupled condition into its red zone stops there too, and shows that limit's reason.
- **Drift:** if life's feedbacks move a band edge onto the player's setting, the worker eases the setting back inside the band and shows the reason.

The world never enters a red zone.

| Slider | Full range | What it physically changes | Carbon living band | Silicon living band (speculative) |
|---|---|---|---|---|
| **Temperature** | −250 to 150 °C | The planet's distance from its star, so starlight changes with it | **Lower edge: "Too cold for surface life".** About −50 °C (`assumption: true`), set below "Snowball Earth" conditions, which surface life survived. Life could persist in seas under thick ice, as may happen on Europa, but our model follows only surface life. **Upper edge: 122 °C**, the highest temperature at which any known organism grows (Takai 2008: 122 °C at 20 MPa, deep-sea pressure; 116 °C at 0.4 MPa). The oceans themselves don't boil away below that: water vapour adds to the air and raises the pressure. | **Lower edge: −210 °C**, where the seas freeze solid. Nitrogen ice sinks, so unlike water ice it gives no insulating lid. **Upper edge:** −147 °C (nitrogen's critical point), or the temperature at which the seas have fully evaporated into the air, whichever is lower. |
| **Nitrogen** | 0.01 to 1,000 × Earth's nitrogen per square metre of surface, log scale | How much nitrogen the planet has, in its air and (on silicon) its seas | **Lower edge: "Not enough nitrogen to build cells".** Placeholder about 0.05 × (`assumption: true`). Life needs nitrogen for proteins and DNA, and it thrived on the early Earth with perhaps half of today's air pressure. **No upper edge of its own:** high pressure alone doesn't kill, and life thrives at over 1,000 bar in the deep sea. More nitrogen does warm the planet a little, because thicker air strengthens the CO₂ greenhouse. So near the Temperature slider's upper edge, raising Nitrogen can stop at "too hot". | **Lower edge: "Seas boil away: too little nitrogen to hold them".** Red below the amount the air must hold at the current temperature, because then the seas are gone. Adding nitrogen does not thicken this air: the seas hold the pressure, so extra nitrogen rains into the sea and sea level rises. Most of this world's nitrogen is in its seas, so the thumb sits far above Earth's marker. |
| **Oxygen** | 0 to 40% | Free oxygen in the air | No red zone: Earth's life lived for more than a billion years without oxygen in the air. Animals suffer at low oxygen, and the population shows that. | Red above a trace (value in config, `assumption: true`): free oxygen turns silicon into rock. The thumb is pinned at zero, which is the point. |

Temperature here is the mean surface temperature. On the carbon world, slider changes reach the population through the fitness rules, and reach the atmosphere through life's feedbacks as the population responds.

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
| Mineral bed | A floor of basalt, ironstone and granite grains in the world's crust shares. Oxygen rusts basalt red, and grains release carbon atoms into the water while life could live | Silicide, nitride and ice grains. Oxygen turns silicide to silica; silicide and nitride release silicon atoms; ice releases none |

| Change | What the box shows |
|---|---|
| Temperature | Every particle moves faster as it warms. The solvent's phase comes from the world's solvent data. Below freezing, the liquid locks into a lattice: water ice floats to the top, and nitrogen ice sinks to the floor. Both are real. |
| Life could live here (`canLive` passes) | Chains link up and wiggle, and now and then one splits into two copies: a hint of life. |
| A limit fails | The box plays that limit's `boxEffect`: `freeze` (everything locks still), `shakeApart` (chains rattle into single atoms), `dryUp` (the liquid boils off and the atoms rattle on a dry floor), `starve` (chains start but stay short and fall apart) or `rust` (silicon grabs oxygen and sinks as grey rock). |
| Switching element | Atoms recolour and reshape, and the solvent swaps, over about half a second. |

The box's state comes from a pure function, `boxState(world, conditions)`, built on `canLive` and the derived-stat models. The box can therefore never show living chains while the element's cell is red.

**Clicking Generate** (compressed into the start of the build, while the terrain is rising):
1. `world:selected` fires. If `startingConditions` moves any slider, it glides first, and the box shows the fix happen. For example, silicon's nitrogen pool condenses as the temperature drops.
2. **0–1.5 s:** the camera pushes into the box and its walls fade.
3. **1.5–5 s:** the particles duplicate, doubling repeatedly up to a budget of about 30,000. They spread outward and downward, settle onto the ground surface as it stands at that moment of the build, and take on the ground's colours. They are drawn as points with one buffer update per frame; lower the budget if the frame rate drops below 60 fps.
4. **5–6 s:** the terrain mesh fades in under the particles, they dissolve, and the character spawns at about 6 s (`build.spawnSec`). The terrain keeps rising until the build ends.

Both worlds' heightmaps come only from their demo seeds, so they are generated while the selection screen is up. The particles then know where to land the moment Generate is clicked.

## In the world: a clean screen, and click to inspect

**Clean by default.** Once the character spawns, the screen shows only the world, plus the small Conditions icon. Just these appear on their own, and none of them are diagrams:
- **Build captions:** one when the build starts and one when life appears. Each is one short line, bottom centre, like a film subtitle, and fades after about 4 s.
- **"Why it moved" lines:** when a slider glides or is blocked, the reason shows as the same kind of brief line.
- **A controls hint** for whichever input was used last, which fades after a few seconds, and a small centre reticle while the gamepad is in use.

Everything else waits until the player asks for it, including the summary card.

**Look of the in-world UI** (owner ruling, 2026-11-08; `src/ui/ui.css`): the selection screen's pixel style carried into the world. The tabs, the Conditions and Bestiary drawers, the captions (cream text with a hard ink outline, like game subtitles) and the hints are a dark ink HUD with a cream pixel border. Every card (inspect, summary, bestiary specimen page) is cream paper with an ink border, like a specimen plate. Pixelify Sans for text, VT323 for numbers, and no rounded corners: corners are square or stepped.

**The Conditions tab.** A small icon in a corner opens the Conditions panel. Tab or the gamepad's Y button toggles it, and using the D-pad sliders opens it too. It is closed by default, and the world keeps running while it's open. It holds:
- the three condition sliders (still available the whole run, as in "Condition sliders")
- the stats panel: every stat beside Earth's, with its "why", and assumptions marked
- the years counter (years since formation, labelled illustrative)
- a button that opens the summary card, at any time
- on silicon, the reasoning chain and the caveat

**Click to inspect.** Only life can be clicked (owner ruling, 2026-11-07):
- creatures
- producers: a patch of flora biomass (plants on carbon, crystalline crusts on silicon), inspected by grid cell

Clicking the sea, the ground or the sky opens nothing. It counts as clicking elsewhere and closes any open card. Their stats live in the Conditions panel.

**Scanner lock before the click** (owner request, 2026-11-08). When the cursor or the gamepad reticle rests on a creature or a plant, pixel corner brackets snap onto it with a short label and follow it as it moves. The lock is sticky: it holds while the pointer stays on the creature's rect and clears only after a short grace, so it doesn't flicker on small or moving bodies. For a creature, the label is its kind's name only if the player has already found that kind in the bestiary. Otherwise, if the sim has announced the kind, the lock is loud: thick gold brackets on an ink backing, a stepped 2 Hz pulse, a one-shot ping, and the label **NEW SPECIES · CLICK TO SCAN** (owner rulings, 2026-11-08). Names are never given away before discovery. An animal that matches no announced species reads UNCLASSIFIED in thin, dim brackets, because clicking it can't file a kind. A plant shows its name in thin, dim brackets. With `prefers-reduced-motion`, the pulse and ping are off. The cursor becomes a pointer. The sea, the ground and the sky never get a lock. Plants are picked by their drawn shape (a capsule per placed plant), so the canopy of a giant opens that plant's card. **Animals win** (owner ruling, 2026-11-08): when the ray meets several things, a creature beats every plant and the sea, as long as it isn't behind solid ground. Otherwise the nearest plant wins, then the terrain cell.

Clicking a creature or a producer opens an inspect card beside it, never full screen. The card has:
1. What it is, in one line.
2. Its details in plain words.
   - An organism: its body plan in words (limbs, plates, horns, eyes, how it moves), its role (plant, grazer or hunter), size, preferred temperature and tolerance, oxygen need or cold stability, its kind's name (clicking it files the kind in the bestiary), and which generation it is.
3. Why it is like this: one sentence, from config like every other world fact.
4. **The comparison: "This world" beside "A carbon world"** (on the carbon world, "A silicon world"). It is rows of plain facts, with Earth's value where there is one. No charts.
   - Beside it, a small live 3D view of **the clicked thing itself**, turning: the creature in its own chemistry, or the clicked plant drawn with the world's own flora assets.
   - **No creature counterparts.** Carbon and silicon life are fundamentally different body architectures (see "Development"), so a creature has no "same genome in the other chemistry" twin, and the card never shows one. **No plant counterparts either** (owner ruling, 2026-11-08): a plant card shows only that plant, with no other-world toggle.
   - The other world's numbers come from its `targets` (its default run at the end of its build), labelled "today".

The card updates live while it is open. If the organism dies, the card says so and stays until closed. Only one card is open at a time; clicking elsewhere, Esc or the gamepad's B button closes it.

The live view is drawn in a scissored viewport of the main canvas, behind a transparent window in the card. It runs only while a card is open, at low resolution. Both worlds' creature and material builders are compiled while the selection screen is up, so opening a card never stalls.

## Stack

- three.js r187 from npm with `WebGPURenderer` (`three/webgpu`, which falls back to WebGL2). Custom TSL is limited to what the creature pipeline needs (F's GPU pose passes and storage-driven body skinning, F §3.5–3.6) and the terrain heights. The art layer may also use one custom world material (`src/render/material.ts`: cel terminator, tinted shadow, ground bounce, fog) and one pixel post pass, each in a single module (owner ruling, 2026-11-07, for the Red World look). Everything else uses the built-in node materials, because custom shaders are where a WebGPU build loses hours. Caden's r187 smoke test found that `positionNode` runs after instancing (`docs/features/world-generator.md`), so storage-driven instances use identity instance matrices. See the `world-style` skill for rendering construction rules.
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
  sim/                 worker, build clock and fast-forward tick schedule, population model, atmosphere and sea models, seeded RNG
  sim/population.ts    the climate core of the ecology (built, tested); LifeRules is its slice of the world config
  sim/genome.ts        the 12 animal genes (DECISIONS G.1), mutation at SIGMA_BUILD → SIGMA, founders with standing variation
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
  render/pick.ts       raycast picking for click-to-inspect (organisms by id, producers by cell; the sea, ground and sky are hit but open no card)
  render/counterpart.ts  the inspect card's live view of the clicked thing (no creature counterparts)
  player/              third-person character controller and camera, keyboard/mouse and gamepad input
  ui/                  selection screen, Conditions panel, bestiary, captions, inspect cards, summary card (design partner)
  render/sprite.ts     the bestiary's pixel sprite of a body plan (pure, read-only)
  bus.ts               typed event bus between sim, render and UI
```

`render/` is the art layer. It reads only `VisualInputs` (see "Logic → art interface") and follows the active art-direction doc. Mockups are references: port from them, but never import across projects.

### Data contract (agree changes with Caden and the design partner)

```ts
type WorldStatus = 'known' | 'speculative';

interface Sourced {
  why: string;             // one plain sentence shown in the UI
  sources: string[];       // ids into sources.ts; may be empty only if assumption is true
  assumption?: boolean;    // true if not directly sourced; tracked in a GitHub issue
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
  | { kind: 'ground'; point?: { x: number; z: number } }   // world metres of the clicked spot. Unused while the owner ruling keeps ground clicks closed; the card code can name the mineral there if that ruling is lifted
  | { kind: 'sea' | 'sky' };

interface BuildConfig extends Sourced {
  durationSec: number;        // about 20: Generate → living world
  spawnSec: number;           // about 6: ground is solid, the character spawns
  seasSec: [number, number];  // when seas fill, as build seconds
  lifeSec: number;            // when the founders appear
  ecologySec: number;         // ecology-seconds reached by the end of the build (about 340 on carbon); the worker's fixed tick schedule hits it
  yearsShown: number;         // the illustrative years-counter end value
  captions: { start: string; life: string };
}

interface Feedback extends Sourced {      // change driven by life, during the build and live after it
  id: string;              // e.g. 'photosynthesis'
  statId: string;          // stat it changes
  driver: string;          // population quantity, e.g. 'producerBiomass'
  rate: number;            // change in stat per unit driver per ecology second
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
  default: number;                 // thumb position when the selection screen opens: 15, 1, 21
}

interface LethalLimit extends Sourced {   // per world; one list read by the sliders and by the sim's kill conditions
  id: string;
  statId: string;                  // the condition it tests, e.g. 'temperature', 'nitrogen', 'oxygen', 'seaCover'
  side: 'below' | 'above';         // life dies below or above the edge
  model: 'fixed' | 'solventFreezes' | 'solventCritical' | 'seasEmpty';   // test form in sim/limits.ts; 'seasEmpty' means seas could not exist at equilibrium, so it holds before the seas fill too
  params: Record<string, number>;  // every coefficient, e.g. { value: 122 } for a fixed edge
  reason: string;                  // short label on the red zone, e.g. 'Seas boil away: too little nitrogen to hold them'
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
  targets: Record<string, [number, number]>;   // where stats sit at the end of the build with the demo seed; tested
  solvent: Solvent;
  stats: StatDef[];
  facts: FactDef[];
  features: Record<'organism' | 'producer' | 'sea' | 'ground' | 'sky', FeatureDef>;   // inspect-card content
  build: BuildConfig;
  feedbacks: Feedback[];
  derived: DerivedStat[];
  limits: LethalLimit[];
  life: {
    rules: LifeRules;      // climate and metabolism rules (type in src/sim/population.ts)
    composition: { c: number; si: number; o: number };   // the world's fixed body recipe, F's Recipe
    ledger: unknown;       // F's trait-ledger coefficients for this world (typed when sim/ecology.ts lands)
    founders: Sourced & { prefTemp: number; tolerance: number; chem: number };   // founder climate genes (world facts, assumption: true)
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
  timeSec: number;
  buildProgress: number;         // 0..1 across the build; 1 from build:complete onwards
  yearsShown: number;            // illustrative years-since-formation counter, 0 → build.yearsShown
  stats: Record<string, number>; // every StatDef id (including 'seaCover'), plus 'seaLevel' in metres for the renderer
  population: { producers: number; consumers: number };
  generation: number;
  traitAverages: Record<string, number>;   // prefTemp, tolerance, size, chem, consumerSize, consumerChem
  organisms: Float32Array;       // one record per living animal (position, heading, locomotion mode, role, climate genes, the 12 genes, altitude in metres above the ground, grown 0..1 (current ÷ adult mass),
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

Bus events: `selection:changed` (UI to render: `{ worldId, conditions, crust? }`, on every element click and slider move on the selection screen; drives the particle box), `world:selected` (`{ worldId, requested: Conditions, crust? }`, fired when Generate is clicked, with the slider settings at that moment), `sim:snapshot`, `build:life` (sim to UI: when the founders appear), `build:complete` (sim to UI: when `buildProgress` reaches 1), `control:set` (UI to sim: `{ controlId, value }`, with value in display units: °C, × Earth's or %; the worker clamps it to the living band), `control:blocked` (sim to UI: `{ controlId, limitId }`, fired when a drag or a drift from life's feedbacks hits a red zone, and at world start for each slider `startingConditions` moved), `guide:newForm` (sim to UI: `{ binId, name, organismId }`, when a body plan first fills a field-guide bin; no longer shown, since the bestiary files kinds on discovery), `inspect:open` (render to UI: `{ target: InspectTarget, at: { x, y } }`, the screen position to place the card), `inspect:window` (UI to render: the card's counterpart window as `{ x, y, width, height }` in CSS pixels, or `null`), `inspect:close` (UI to render), and `inspect:hover` (render to UI: `{ target: organism or producer InspectTarget, rect: { x, y, width, height } }` in CSS pixels, or `null`; the scanner lock under the cursor or reticle, re-emitted each frame with `rect` updated while the same target stays locked)), and `bestiary:window` (UI to render: `{ rect: { x, y, width, height }; plan: BodyPlan }` or `null`; the bestiary specimen page's live 3D window, drawn from the kind's plan so extinct kinds work too, #81).

**Changes from the first draft of this contract, pending the design partner's OK:**
- Added `DerivedStat` and `Solvent`, so derived stats and solvent data have a home in config instead of in code.
- Added `sources` to `Feedback`.
- Added `reasoning`, `caveat`, `targets` and `facts` (with `FactDef`, for text rows such as main gas and star) to `WorldConfig`.
- Added the `partialPressures` model to `DerivedStat`.
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
- 2026-11-08 rock chips (Caden): one chip per mineral, the same on both worlds (`CRUST_PICKS`: basalt, granite, ironstone, silicide, nitride). `MineralDef.pick { hint }`, `MineralDef.favour?`, `CrustConfig.favour` (0.75), and `crust?: CrustPickId` (the picked mineral id) on `selection:changed` and `world:selected`. Each world carries all five minerals; foreign ones have share [0, 0] (absent unless picked). The terrain supports up to 8 minerals. The run uses `withCrustChoice(world, crust)` everywhere.
- 2026-11-08 crust (Caden): `TerrainConfig.crust` (`CrustConfig`, `MineralDef`), `machines[].minerals`, `relics[].minerals`, machines M7–M9, the ground `point` on `InspectTarget`, and `VisualInputs.world.rustOxygen`.
- 2026-11-07 logic pass (agreed with Caden):
  - Removed `life.templates`: the developmental pull leaves the sim.
  - Replaced `visuals` with `starType` plus the new `terrain: TerrainConfig`.
  - Added `SimSnapshot.flora` (per-cell biomass) and the `producer` inspect target.
  - The organism buffer now carries the 12 genes, heading and locomotion mode.
  - The snapshot rate is 20 Hz.
  - Typed `life.inputs`: `solvent`, `airDensity` and `tissueDensity` are world-config facts, not sim constants (DECISIONS G.2 now has 15 constants).
- 2026-11-07 one fast build (Caden's ruling):
  - Deleted the `Phase` and `SlowProcess` interfaces, and `WorldConfig.phases` and `WorldConfig.processes`.
  - Added `BuildConfig` and `WorldConfig.build`.
  - `Feedback.rate` is now a change in stat per unit driver per ecology second.
  - `SimSnapshot`: removed `phaseId` and `historyYears`; added `buildProgress` (0..1) and `yearsShown` (the illustrative counter).
  - Bus events: removed `phase:changed` and `run:complete`; added `build:life` and `build:complete`.
  - `targets` now means where stats sit at the end of the build with the demo seed.
  - The Oxygen control's `default` is now 21.
  - `VisualInputs`: `buildProgress` replaces `age` and `phaseId`.
  - `TerrainConfig`: machine `rate` is no longer per billion years (see "Terrain and landforms"), and the spawn shore is measured once the seas have filled.
- 2026-11-08 owner-requested additions:
  - Bus events: `inspect:hover` (the scanner lock) and `bestiary:window { rect; plan } | null` (the 3D specimen page; it replaces `bestiary:specimen`). `inspect:window` lost its `mode` (no plant counterparts).
  - Organism buffer layout v3, stride 30: `altitude` (metres above the ground) and `grown` (current ÷ adult mass).
  - Body plan v4: `shellCover` (the silicon walkers' ceramic shell). v5 appends `liftSpan`, the wing span the flight model uses, so the card can show a flier's ceiling.
  - Stat `airDensity` (kg/m³) on both worlds, shown beside gravity. It comes from the live gas mix (see "How F's inputs come from our worlds").
  - `life.inputs.flight`, `life.inputs.economics` and `life.founders.latent` in world config.
  - `VisualInputs.terrain.crust?: { minerals (id, supply, oxidises), weights(x, z) }`, optional and read-only. Plant gates read the per-cell mineral, the argmax at the cell centre, matching the sim's crustMap.

## Third-person player

Third person is part of the MVP. A stylised explorer character with a smooth follow camera on a spring. It supports keyboard and mouse, and a gamepad through the browser Gamepad API.
- **Keyboard and mouse:** WASD moves. Dragging the mouse orbits the camera, and the scroll wheel zooms from 1.2 m to 150 m (owner request, 2026-11-08). The camera can look almost straight up or down (±1.55 rad). When the ground stops it, the view keeps turning up into the sky. A click without dragging inspects what is under the cursor. Space jumps on land and on frozen seas, and Shift sprints. Tab toggles the Conditions panel, and Esc closes a card or the panel.
- **Gamepad:** the left stick moves and the right stick orbits. While the gamepad is in use, a small reticle sits at screen centre. A inspects what is under the reticle, B closes, Y toggles the Conditions panel, X or RB jumps, clicking the left stick sprints, and LT/RT zoom out and in.

Both work at the same time so control can pass between people without switching modes. Handle gamepads connecting or disconnecting mid-run, apply a dead zone to the sticks, and show a small controls hint for whichever input was used last, which fades after a few seconds. Ground height is sampled from the terrain each frame so the character and camera stay on and above the surface. **The character can dive.** Below sea level the controller switches to swimming: full 3D movement, with the left stick or WASD moving relative to the camera and a rise/sink input (Space and Shift; gamepad bumpers). The camera follows underwater. **The character can jump** (owner request, 2026-11-08): a ballistic jump under the world's own gravity (`stats.gravity`), with a fixed takeoff speed giving about 1.2 m at 1 g, so it jumps about twice as high at 0.5 g. It has coyote time and a jump buffer of 0.1 s, no double jump, and it carries horizontal speed through the air. The rise input (Space or RB) jumps on land and rises in water. Frozen seas are solid and can be walked on. If a frozen sea melts under the character, they start swimming. The character's suit is a declared illustration: no stat models the player. On the gamepad, the D-pad also works the condition sliders: up and down pick a slider, and left and right move it. Using it opens the Conditions panel if it is closed. A judge holding the controller can then use them without the mouse. A terrain patch of a few hundred metres with distance fog at the edges is the recommended setup because it keeps the controller and camera simple, but the engineering lead can choose another layout if it stays within the performance budget. The character spawns when the particles from the box have become solid ground (about 6 s in), and movement keeps working through the rest of the build and after it.

## Generation sequence (what the judges watch)

It all happens in one fast build of about 20 s (see "The build (one fast run)"). The particles from the box settle into the ground (see "The particle box and the Generate transition"), and the terrain then rises to its full heights by the end of the build. The terrain generator must put a shoreline near the spawn point in both worlds, or silicon life is never seen. Seas fill during the build's seas window (`build.seasSec`), liquid or frozen according to the current temperature and the solvent's freezing point, and then follow the sea stats for the rest of the run. The terrain patch stands in for the whole planet: `seaLevel` is the height at which the fraction of the patch lying below it equals `seaCover`. Plants are drawn by the art layer from the per-cell flora biomass, and they reach land only when the simulation says life has (the grid cell's biomass is zero until then). Creatures are F's lofted bodies, built from each genome's `develop()` plan and animated on the GPU (spines, IK legs, pulsing bells), so the population visibly changes as it evolves, on carbon from capsule worms to legged, plated and horned forms within the build, and on after it. Sky and light follow the star and atmosphere, art-directed to look vibrant. The UI shows a caption when the build starts and another when life appears. Generation is part of the show, so it should be smooth and legible, not hidden behind a loader.

Silicon life starts in the shallows, so at first it must read from the shore, or close up when the player dives. Liquid nitrogen is clear and colourless, so organisms are visible through it. Crystalline flora grows along the sea margins, and as the seas shrink it leaves bands of dead crust behind, showing the feedback loop on screen. Later, floaters drift in the thick air, and some lineages walk the shore (speculative, see "Life: creatures and plants").

## Terrain and landforms

The terrain is logic: the player, the sea level and the flora grid all read it. It lives in `src/gen/terrain.ts`, owned by the engineering lead. Every coefficient is in the world's `terrain` config (`TerrainConfig`), with `why` and `sources` or `assumption: true`.

- **One height function, two backends.** `height(x, z, progress)` is a closed-form analytic function: base fBm, domain warp, and closed-form landform progress fields. It's written once as a TSL node for the GPU mesh and once as a pure TypeScript sampler that the player, flora and tests use. Tests check the two agree. This is the L0 layer of `docs/features/terrain-plan.md`. Its L1 simulated layer (erosion, talus, rimstone) stays in `docs/NOT_NOW.md`.
- **Build rise.** A `rise` input goes from 0 to 1 across the build and scales relief up from flat. The particles from the box land on `height(·, rise)` as it stands at that moment.
- **Sea level from sea cover.** The patch stands in for the planet. `seaLevel` is the height at which the fraction of the patch below it equals `seaCover`. The worker finds it numerically from the CPU sampler each snapshot.
- **A shore near spawn.** The spawn point is on land, within `spawn.shoreDistance` metres of the shoreline once the seas have filled. The height function carves a gentle shore ramp there, so it holds for every slider setting inside the living bands. This is tested for both worlds.
- **Landforms grow in the build.** Terrain `rise` and every landform machine's progress go from 0 to 1 over the build, then follow live state. For example, carbon shell stone tracks producer biomass, and silicon crust bands track sea level. Where a gate below reads age, it reads `buildProgress`.
- **Crust and minerals** (`docs/features/crust.md`). Each world's `terrain.crust` lists its minerals:
  - carbon: basalt in the lowlands, banded ironstone on mid-slopes, granite in the highlands
  - silicon: silicide at the shore, nitride (nierite) mid-ground, water ice in the highlands
  - **One mineral map.** A closed-form weight function (base height plus seeded noise, with quantile thresholds baked per seed) gives each mineral's local weight. It is used by `heightCore`, by the TSL node (`crustWeightsNode`) and by `crustMap` (argmax at cell centres), so the sim's cell mineral always matches what the look shows.
  - **Fertility.** Each cell's starting nutrient supply is the ledger base × its mineral's `supply`, renormalised so the patch mean stays at base: the crust redistributes and adds nothing. Fertile basalt grows more flora; water ice grows none. A headless A/B (8 seeds) passed the §G gate: on carbon, links rose from 37 to 51 and the longest chain from 3.0 to 3.75.
  - **Rust.** Oxidising minerals rust as `rust(world, maxOxygenSeen)`. Rock doesn't un-rust, so the art layer ratchets the maximum.
  - **Landforms.** Landform machines can be gated by mineral through `machines[].minerals`; there are no mineral ids in code. The player makes no new choice: the crust is seeded, and the Oxygen slider rusts it.
- **Landform heat.** Landform gates read `heatSolvent`, which is temperature normalised so that 0.5 sits at the solvent's freezing point (span in config). F's `Heat` input keeps the living-band normalisation ("How F's inputs come from our worlds").

**Landforms per world** (machines and gates from `research/world-forms/`, rules 1–6):

| World | Landform | Machine | Gate (all from state, no preset code) | Tag |
|---|---|---|---|---|
| Both | Strata and banded walls | M5 stack-and-strip | age. On carbon it is full strength on ironstone and 35% elsewhere (`offMineral`); ironstone walls carry red jasper and black hematite bands (`bekker2010`) | [sci] |
| Both | Canyons | M4 abrade | depth ∝ age × past liquid. Steepness rises with dry heat (fixes the inverted heat→wall rule) | [sci] mechanism, [game] rule |
| Carbon | Hoodoos, frost fins, and the arches they become | M3 crack-and-pry | Water only, with `heatSolvent` near 0.5 (freeze–thaw). Water is the only solvent that expands on freezing | [sci] |
| Carbon | Shell stone: reefs, stromatolites, limestone pillars | M6 life-built | water + producer biomass in the shallows + age. The R2 exception: "carbon rusts to air, unless life in water makes shell". Say "shell" on slides: real carbonate needs calcium, which isn't modelled | [sci] analogue |
| Carbon | Basalt columns: tall on coastal platforms, low pavement inland, dark hexagonal joint lines in the ground colour | M7 columns | basalt weight; coastal band for the tall columns. Held to 15% on the spawn ramp so the sea stays reachable | [sci] mechanism (`goehring2009`), stylised size |
| Carbon | Granite domes and stacked-boulder tors | M8 tors | granite weight, highlands | [sci] mechanism (`linton1955`), stylised size |
| Silicon | Hexagonal nitride crystal spikes | M9 crystals | nitride weight, sparse | speculative, stylised size |
| Silicon | Relic water-ice bedrock arches and spires | none: seeded | part of the seeded starting terrain, rising with `rise`. No process grows them. They stand on water-ice ground where the seeded search finds it (`relics[].minerals`), and otherwise on the best clear spot near spawn | `assumption: true` |
| Silicon | Silicon-nitride crystal crusts and dead crust bands | M2 precipitate | producer biomass at the sea margin. Crusts left above a falling sea level become dead bands | speculative |
| Silicon | none of: frost wedging, dissolving, builder spires | n/a | N₂ contracts on freezing, liquid N₂ dissolves almost nothing, and builders need oxygen | [sci] |

```ts
interface TerrainConfig extends Sourced {
  patchSize: number;                 // metres; a few hundred, with fog at the edges
  base: Record<string, number>;      // fBm amplitude, octaves, warp and so on
  spawn: { shoreDistance: number };  // metres from spawn to the shoreline once the seas have filled
  heatSolventSpan: number;           // °C span mapped onto heatSolvent 0..1
  machines: { id: 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9'; rate: number; params: Record<string, number>; minerals?: string[] }[];   // progress goes 0 → 1 over the build; rate is how fast it then follows live state, per ecology second; minerals gate it by their local weight
  relics?: { kind: 'iceArch' | 'iceSpire'; count: number; params: Record<string, number>; minerals?: string[] }[];   // silicon only; seeded
  crust: CrustConfig;
}

interface MineralDef extends Sourced {   // colours are art-layer decisions, keyed by id
  id: string; label: string; description: string;   // description: one plain line about the rock
  share: [number, number];                           // bounds on its share of the patch; sampled from the seed
  elevation: number;                                 // 0..1 by height rank: 0 = lowest ground
  supply: { c: number; si: number; o: number };      // nutrient multiplier per cell (renormalised to the base mean)
  oxidises: boolean;
}

interface CrustConfig extends Sourced { minerals: MineralDef[]; patchCells: number; rustOxygen: number }   // rustOxygen: oxygen % at which oxidising rock is fully rusted
```

## Logic → art interface

The art layer sits on top of this logic and only reads it. It never writes sim state, and nothing visual is read back (DECISIONS §G.9). This file doesn't choose a look or name a mockup. The active art-direction doc is set by Caden.

**What the art layer reads (`VisualInputs`, assembled each frame from the latest `SimSnapshot` and the `WorldConfig`):**
- **World facts:** `worldId`, `status`, `starType`, `solvent` (name, freezeC, solidSinks), `life.composition`, and `rustOxygen` (from `terrain.crust`).
- **Live stats:** temperature, pressure, oxygen, nitrogen, seaCover, `seaLevel`, and frozen (temperature < `solvent.freezeC`).
- **Normalised drivers:** `heatBand` (living band 0..1), `heatSolvent` (0.5 = freezing), light at the surface, air density, and `buildProgress` (0..1 across the build).
- **Terrain:** the TSL height node and the CPU sampler, the crust weights (`crustWeightsNode(terrain)` in TSL, with `terrain.crustWeights(x, z)` as its CPU twin), the optional `terrain.crust` (minerals and `weights(x, z)`, so plant gates read the same per-cell mineral as the sim), the `rise` value, the per-machine progress values, and `patchSize` (metres, used to map a grid cell to world x/z).
- **Life:** the `organisms` buffer (layout v3, stride 30: `altitude` is physical metres above the ground for fliers, and `grown` is current ÷ adult mass, so juveniles can draw smaller), the `births` plans (`develop()` output), the per-cell `flora` grid, and a `lifeOnLand` flag (true once any land cell has flora biomass). Build stage comes from `buildProgress` above.

**Rules for the art layer:**
- Everything that carries meaning must follow these inputs (see "Visuals are stylised but never contradict the stats").
- Decoration is allowed, but only as a pure function of these inputs. For example, plant shapes come from flora biomass, composition and conditions, and body templates are look attractors applied to `develop()` output.
- **Plant form is `floraForm(cell, VisualInputs)`**, a pure render function. **Every plant is unique and its traits follow conditions** (owner rulings, 2026-11-08; art layer, `docs/features/flora-traits.md`, its §1 has the condition → trait table). Each placed plant draws its own girth, crown, lean, curl, tint and glow from its cell's conditions plus a per-plant hash. Its features are the values that published trait–environment relationships predict for the cell and the world's live stats. This is environmental filtering drawn as an instant equilibrium: plants don't evolve in the sim, and there is still no flora genome. Thirteen further archetypes are gated by conditions: pitcher, cushion, kelp, reef, frost fern, woolly rosette, mangrove and air-kelp, plus five silicon-only ones tagged [speculative]. The silicon five are nitride crown (ground, dry sea margin), lace fan and air-plankton (thick air), glass kelp (submerged, 4–12 m) and lantern bulb (ground, dark land). Ground cover's submerged flag is per plant. There is no flora genome; the seed picks only variant and jitter. Per-cell inputs: the mat/canopy mix, whether the cell is submerged (cell height against sea level), and biomass magnitude (sparse, normal, lush); light and heat are world-wide.
  - Composition: si gives straight stems, 60° branching and faceted caps; c gives curl.
  - Light: bright light gives wide caps; dim light gives lantern pods and glow.
  - `heatBand` sets maximum height (cold makes tall, as for creatures).
  - Mat against canopy biomass picks ground cover or a tall species, and sets size and density.
  - Shapes are cached per quantised input bin and rebuilt when a bin changes.
- **Ground and plant colour follow the crust** (`src/render/crustLook.ts`):
  - Ground blends each mineral's colour by its crust weight, and oxidising minerals rust on the ratchet.
  - Carbon flora goes from purple (retinal pigments, the "Purple Earth" hypothesis, `dassarma2018`) to green (chlorophyll; pigment colour follows the star, `kiang2007`) on that same ratchet, because both follow oxygenic photosynthesis.
  - Silicon flora is unchanged.
- The only messages from art back to logic are the `inspect:*` bus events.

## Honesty box (say it if asked)

- **Emergent:** which body plans appear and which traits spread, population sizes, and how the air and seas change as life feeds back on them. On carbon, hunters rise and crash in predator–prey cycles; that is real and emergent (Huffaker 1958), so no rule steadies them. Which body shapes the oxygen, temperature, gravity and nitrogen terms select is also emergent; the terms are small and the signal across seeds is modest.
- **Seeded:** the founders (at least 24 capsule worms when life appears, with standing variation, and a per-run starting lean in their latent genes), the species' genus names, the RNG seed, and the starting terrain, including silicon's relic ice arches and spires and each world's crust map (mineral shares and placement).
- **Designed, not emergent:**
  - `develop()` and its chemistry rules, the 12-gene layout, the trait-ledger coefficients and the locomotion costs
  - the 12 rules and the shared utility loop's structure
  - the form definition (DECISIONS §A) and the name generator
  - every feedback rate
  - the mineral list, the mineral-to-landform mapping, and the crust's renormalisation (it redistributes nutrients and adds none)
  - the build timings, and the years counter, which is illustrative
- **Tuning cheats:**
  - scheduled mutation (`SIGMA_BUILD` 0.02 → `SIGMA` 0.015, size gene ×2), rare big jumps (`jumpRate` 0.012, `jumpScale` 0.4), juvenile growth (`growRate` 0.05), the gentler diet payoff (`DIET_EXP` 1.15), the megafauna intake exponent (`intakeExp` 0.9) and kin cohesion
  - the compressed pace rule, and silicon's lowered activation energy (32 kJ/mol)
  - a base lifespan of 40 ecology-seconds (scaling with mass^0.25), raised from 6 so generations turn over
  - silicon producers that saturate at 1% sunlight (`floraLightGain` 100), and then grow at full rate
  - the build fast-forward (about 340 ecology-seconds in 20 s) and the live timeScale
  - Hunger as plant scarcity
  - grazing that takes only a share
  - consumer interference
  - the diet gene's 8× mutation step (`dietBoost`) and jaws that grow with diet (`jawPleiotropy` 0.6), so hunters can arise within minutes (#48)
  - flight muscle power at 75 W/kg, below the bird range, so flight is rare at defaults (#85)
  - the announcement pacing: only clusters with at least 8% of animals during the build, then one new species per 25 ecology seconds. The kinds are real; only when they are listed is paced.
  - spores: a dormant bank of recent survivors that germinates after a crash (owner override of the no-rescue guardrail, `assumption: true`)
  - in the condition terms (#66):
    - `aerobicFloor` 0.4, standing for anaerobic burst power
    - the `supportRef` offset: typical support load is treated as already paid for in upkeep
    - the 0.5–3 clamp on the heat multiplier
    - `strandDrain` 200
    - the forms of these terms (aerobic scope, skin area per M^0.75, square-cube load, saturating N limit, stranding drain) are designed
    - crests and frills are not selected as radiators: limbs and body length carry the heat balance
- **Speculative (silicon):** the chemistry itself, silicon–nitrogen bodies and ceramic plates, glow from non-oxygen chemiluminescence, the crystal crusts, life leaving the sea, and the nitrogen feedback loop.
- **Illustrations (render-only):** the particle box (including its mineral bed), the sizes of basalt columns, granite tors and nitride crystals (at least 6 m, because the mesh is about 2 m per vertex), the purple-to-green plant pigment (a hypothesis, keyed to oxygen), the live view in inspect cards, sky and fog, the moons in the sky (decoration only; no stat models them), plant shapes (the sim has only per-cell biomass), body-template look attractors, IK feet (in the sim, agents are points), the player's diving suit, **flight altitude display**: altitude is physical (power balance, thinning air, gravity) but is drawn at 150 m · tanh(h ÷ 1.5 km), because the patch is a few hundred metres across. All flight coefficients are typical-bird orders of magnitude, `assumption: true`. And **creature display size**: drawn length = 60 m · tanh(2 m · (size ÷ 0.15)^0.8 ÷ 60 m), so a founder worm draws 2 m and a 9.6 m giant about 43 m; size order is kept and the real ~64× range shows as ~25×.

## Demo script

The three-minute script for the 20 s build is in `DEMO.md` (issue #29): the timed talk track, the pre-demo checklist, the rehearsal checks, the fragile points and the Q&A lines. The world is alive about 20 s after Generate, so the talk track fits around a living world rather than a slow time-lapse.

Rehearse silicon as well, so we can switch to it if the judges ask "what about silicon?" Know the caveat line by heart. On silicon, the sliders are the fastest answer, and it can start on the selection screen:
1. Select silicon. At 15 °C the box shows its nitrogen pool boiling off.
2. Drag Temperature down to −183 °C, and carbon's cell goes red.
3. Silicon stays red until you raise Nitrogen, because its seas need enough nitrogen to exist. When the pool condenses in the box, the silicon rusts into grey rock, because Oxygen is still at its 21% default.
4. Pull Oxygen down to zero, and silicon chains start to form.
5. Click Generate.
6. In the running world, click a crystalline crust: what it is and why. There are no counterparts. Then hover an armoured walker (NEW SPECIES lock).
7. Open Conditions. The same Temperature track shows a narrow living band at the cold end, and the Oxygen thumb won't move off zero.
8. Lower Nitrogen and the Temperature red wall slides down, because a smaller sea evaporates completely at a lower temperature.

## Scope and priorities

| Priority | Work |
|---|---|
| P0 (MVP) | Selection screen. Carbon world fully working end to end: the 20 s build, stats panel, captions, life–atmosphere feedback, population evolving during the build and live after it, third-person walking. Silicon world with its own build, stats, reasoning, caveat and feedback. Temperature, Nitrogen and Oxygen sliders with live red zones in both worlds. The particle box on the selection screen and the zoom-and-duplicate Generate transition. A clean in-world screen: the Conditions panel (closed by default), brief fading captions, and click-to-inspect cards with the side-by-side comparison and a live 3D render of the counterpart. Caden's creatures and plants: genome, `develop()`, the ecology with its state machine, lofted bodies with IK legs, L-system flora, and the bestiary tab. Summary card beside Earth, opened from the Conditions panel. Deterministic demo seeds. 60 fps. Recorded backup video. Devpost submission. |
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
    4. The worker: the build clock, the fixed fast-forward tick schedule, and feedbacks.
    5. A headless test that the carbon demo seed lands inside its targets.
- **Creatures (Caden):**
  1. `sim/genome.ts` (15 genes), `sim/develop.ts` and `sim/constants.ts`, with a test per genome.
  2. `sim/guide.ts`: OTU clustering, `guide:newForm` and the name generator.
  - `sim/grid.ts`, `sim/ecology.ts` (grown from `population.ts`: the 12 rules, the 64² grid and per-cell flora biomass), `sim/relationships.ts` and `sim/metrics.ts` (built: OTUs, mass spread, `trophicWeb`, FDis, Bray–Curtis) build against these exports. See `docs/superpowers/plans/2026-11-07-backend-mvp.md` Task 5.
  3. Bodies rendered as beads first (one instanced sphere per joint).
  4. Then the GPU pose passes, lofted bodies and IK legs.
  5. Then plant shapes from the flora grid (art layer).
- **World and UI (design partner and engineering lead):**
  1. `gen/terrain.ts` (heights, rise, seaLevel, spawn shore) with tests, then seas (level and frozen state), and sky and light from the star.
  2. The character and camera, including swimming: keyboard first, then gamepad.
  3. The particle box and `boxState()` (this needs only `sim/limits.ts`).
  4. The selection screen, the Conditions panel, the bestiary tab, captions and the summary card.

**Checkpoint, about 01:00:** the carbon world runs end to end. The sliders work, and bead-bodied worms graze and evolve. If it doesn't, cut now, using the list below.

Then, in order:
1. The Generate transition.
2. The silicon config and its look.
3. Click-to-inspect, with the live view of the clicked thing.
4. Rehearse, record the backup video, and submit to Devpost by 10:30.

If time runs short, cut in this order:
1. Gamepad support (keyboard handover still works).
2. F's verlet tentacles, then FABRIK (keep 2-bone IK legs), then frills (dorsal rods only).
3. A bespoke silicon look (palette-swap carbon's).
4. Bestiary sprites (keep the names and tiles).
5. Lofted skinning, falling back to bead bodies.

Never cut the sliders, the particle box, the Generate transition, the Conditions panel, the inspect cards and their live views, the summary card, silicon's faceted development, or IK legs.

## Commands

TypeScript and Vitest are set up at the repo root for `src/`, and Vitest only looks in `src/`, so it ignores `mockups/`. Vite and three.js (r187, `~0.187.0`) are installed. Append `?debug` to the page URL for an fps readout.

- `npm run dev`: Vite dev server on 127.0.0.1 (default port 5173)
- `npm run build`: typecheck, then production build to `dist/` (slow; Tier 2 only)
- `npm run preview`: serve the production build on 127.0.0.1 (port 4173)
- `npm run typecheck`: typecheck
- `npm test`: full unit suite
- `npx vitest related --run <files>`: tests for changed files only
- `npm run smoke [carbon|silicon]`: headless real-GPU smoke of the whole app (`scripts/smoke.mjs`; dev-only, not part of any tier). It starts its own dev server, or reuses `SMOKE_URL`. It reports fps, console errors, creature counts and checks a creature click, the slider red zones and swimming. Screenshots go to `/tmp/{card,slider,swim}-{world}.png`. Playwright is not a dependency: it uses `playwright` if installed, else `PLAYWRIGHT_PATH=/abs/path/to/playwright/index.mjs`, and exits 2 with a message if neither is found. Exits 1 on any error or failed check

## Testing (fast tiers)

Speed is the point. Run the cheapest tier that answers the question.

| Tier | When | Runs | Budget |
|---|---|---|---|
| **0** | Every edit loop | typecheck + related tests for the files you touched | < 15s |
| **1** | Once, before reporting a feature done | typecheck + `npx vitest related --run <every file you changed>` + `npm run build` | < 60s |
| **2** | Once per merge to `main` (team lead) | Tier 1 on the merged diff + `npm run smoke` | < 3 min |

- **Test** the sim: the seeded RNG, the derived-stat models (vapour pressure, sea volume, radiative balance), feedback integration, and that each world's demo seed lands inside its `targets` at the end of the build. Test that the build's tick schedule is frame-independent: the same build time gives the same ticks at any frame rate. Also test that the same seed gives the same snapshot sequence, and every bug you fix (failing test first).
- **Test the sliders' logic:**
  - Living bands match the physics:
    - On silicon, lowering nitrogen lowers the upper temperature edge, and that edge never exceeds −147 °C.
    - On carbon, the upper temperature edge stays at 122 °C whatever the nitrogen.
  - No sequence of `control:set` messages can put the world inside a red zone.
  - The sim's kill conditions sit exactly at the band edges.
  - `canLive` agrees with `livingBands`. For example, at −183 °C and 1 × nitrogen, both carbon and silicon are red, and silicon turns green once nitrogen is high enough.
  - `startingConditions` keeps in-band values, replaces failing ones with `startDefaults` in the fixed order and reports each move. For example, untouched sliders on silicon move Temperature first, then Nitrogen, then Oxygen.
  - `livingBands` returns `empty` when no position works. For example, silicon's Nitrogen track at 15 °C.
- **Test `boxState`:**
  - It never shows living chains when `canLive` fails, and it plays the failing limit's `boxEffect`.
  - Water ice floats and nitrogen ice sinks (from `solidSinks`).
- **Test determinism:** the default slider values give the same snapshot sequence on every run, for both worlds.
- **Test the creatures (F):**
  - `develop()` is pure and gives the expected plan for each test genome. Silicon gives facets and 15° joints; carbon gives curves.
  - The headless ecology runs each world's default seed and reaches its tuning targets. The carbon demo seed shows legs by the end of the build.
  - The DECISIONS §A variety metrics on headless runs. A new rule ships only if its A/B raises one.
  - Guardrails as tests: `sim/constants.ts` has ≤ 25 entries, and the builder output is zero on silicon.
- **Test the terrain:** the CPU sampler matches the height formula; `seaLevel` gives the requested `seaCover`; spawn is within `shoreDistance` of the shore in both worlds at the default seeds; `rise` 0 is flat.
- **Config checks as tests:** every stat, feedback, limit, build config and reasoning step has `sources` or `assumption: true`; speculative worlds have a `caveat`.
- **Don't test** rendering, UI, the character controller or styling. Check them by hand.
- **No browser tests (owner ruling, 2026-11-08):** don't launch Playwright, headless Chrome or `npm run smoke`, and don't take screenshots or measure fps. They used ~150% CPU. Verify with typecheck, build and related tests only; the owner checks visuals in his own browser.
- **No test runs until the FINAL step of a task (owner ruling):** don't run `npx vitest run`, `vitest related` or any test with raised timeouts while iterating. Iterate with typecheck only. Run tests once, as the last step before reporting.
- **Banned (owner ruling):** `npm test` (the full suite) and `npm run test:slow`. Run only `npx vitest related --run <files>`. Any test slower than 1 s goes behind `it.skipIf(!process.env.SLOW)` and isn't part of any tier. Fix the code, not the tests.

## Working conventions for Claude Code

- Keep all world facts and rates in `src/worlds/` with `why` and `sources`, and never hardcode them elsewhere. When adding a stat, rule or feedback, add its source to `sources.ts` or mark it `assumption: true` and open or link a GitHub issue for it.
- Keep the simulation deterministic for a given seed. The build's tick schedule depends only on build time, never on frame rate; if the fast-forward is slow, cut render detail, not ticks. Do not add random events, disasters or slow processes.
- Do not change the data contract without flagging it, because the UI depends on it.
- Prefer instanced meshes for anything repeated. Profile before optimising.
- Read files before editing. Match existing patterns, and don't refactor adjacent code. No features beyond what was asked.
- Commit small and often with clear messages, staging by path, because two people are working in parallel. Never `git stash`.

## Docs and research in this repo

| Path | Status |
|---|---|
| `docs/features/selection-screen.md`, `mockups/selection-screen/index.html` | The selection screen's design spec (draft, for the design partner) and its working mockup. Visual direction: a pixel-art research paper in Caden's pixel style (`docs/ART_DIRECTION_PIXEL.md`): element table, axes for the sliders, the particle box as a low-resolution pixel figure, a live bounds equation and a footnoted caveat. The zoom into the world keeps the same pixels. |
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

Already verified, with DOIs in `research/silicon-life/REPORT.md`: Bains, W. (2004), "Many chemistries could be used to build living systems", *Astrobiology*. Petkowski, J. J., Bains, W. and Seager, S. (2020), "On the potential of silicon as a building block for life", *Life* (including Appendix C on silicon chemistry in cryosolvents, and the solubility limits in liquid nitrogen). National Research Council (2007), *The Limits of Organic Life in Planetary Systems*. Kan, S. B. J. et al. (2016), "Directed evolution of cytochrome c for carbon–silicon bond formation", *Science*, as a real-world aside on biology and silicon. Crust and body composition (28% Si, 0.02% C; body 18% C). Also checked against Crossref on 2026-11-07 (title, authors, year and DOI match; details and the claim each supports in `research/sources-verified.md`): Pace (2001), *PNAS*; Takai, K. et al. (2008), *PNAS*, growth at 122 °C (under 20 MPa; 116 °C at 0.4 MPa); Hoffman et al. (2017), *Science Advances*, Snowball Earth; Goldblatt, C. et al. (2009), *Nature Geoscience*; Som, S. M. et al. (2016), *Nature Geoscience*; Berner and Canfield (1989), *American Journal of Science*, organic carbon burial and oxygen; Fulchignoni, M. et al. (2005), *Nature*, Huygens on Titan; Stofan, E. R. et al. (2007), *Nature*, Titan's lakes. NIST Chemistry WebBook nitrogen data (triple point, vapour-pressure curve, critical point, liquid density) is in `silicon.ts`, and the water vapour-pressure table was checked against NIST.

Still to verify: A standard bond-energy table (for example the CRC Handbook) for C–C, Si–Si, Si–O and Si–H; the figures now come from Petkowski 2020 Table 1 via `research/silicon-life/REPORT.md`. NIST has no density for solid nitrogen, so "solid sinks" (Scott 1976 is the lead) is unchecked. The size of the nitrogen greenhouse effect in Goldblatt (2009): config uses about 1 K per doubling, and the abstract was not retrievable. Whether Petkowski 2020's cryosolvent appendix supports any silicon-in-liquid-nitrogen solubility claim (its abstract says solubility is extremely low).
