# Life Is ▢ Based

> A speculative-life browser experience for WHACK 26 / Marshall Wace’s **New Worlds** challenge.

Choose carbon or silicon, set a planet’s starting conditions, then watch a three.js world form and evolve. Terrain rises, seas settle, life appears, and organisms feed back into the atmosphere and landscape. Walk through the world, inspect its life, and compare its conditions with the other world and Earth.

Carbon is life as we know it. Silicon is a constrained thought experiment: its cold, oxygen-free, liquid-nitrogen world follows a chain of chemistry and physics assumptions, and the experience calls out the strongest caveat rather than presenting silicon life as established science.

## Run the experience

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Add `?demo` to replay a world’s pinned demo seed, or `?seed=2611` to replay a specific seed. Choose a world, adjust its conditions, and generate it. Click an organism to inspect its body plan, modeled traits, and comparisons.

Useful project commands:

```bash
npm run typecheck
npm run build
npm run test:all
```

`npm run build` type-checks and creates the production bundle in `dist/`. The `npm test` shortcut is intentionally disabled; use `npm run test:all` for the Vitest suite.

### URL flags

| Flag | What it does |
|---|---|
| `?world=carbon` or `?world=silicon` | Skips the selection screen and starts that world with its default conditions. |
| `?demo` | Uses the world's pinned demo seed, so with the sliders untouched the run matches our rehearsal. |
| `?seed=N` | Replays a specific run. Every load otherwise picks a fresh seed; the Conditions panel shows it with a copy-link. |
| `?debug` | Shows an fps readout. |

### Controls

| | Keyboard and mouse | Gamepad |
|---|---|---|
| Move | W A S D | Left stick |
| Look around | Drag the mouse | Right stick |
| Sprint | Hold Shift | Click the left stick (L3) to toggle |
| Jump | Space | X or RB |
| Swim up / down | Space / Shift | RB / LB |
| Inspect | Click (without dragging) | A, on the centre reticle |
| Close a card or panel | Esc | B |
| Conditions panel | Tab | Y |
| Move a slider | Arrow keys while Conditions is open | D-pad: up/down picks a slider, left/right moves it |

Keyboard and gamepad work at the same time, so control can pass between people mid-run.

## The idea

The player completes **“Life is ▢ based”** by choosing an element from group 14.

- **Carbon — known chemistry, simplified biology.** A water world where photosynthetic producers change atmospheric oxygen and carbon dioxide while consumers feed through a shared ecology.
- **Silicon — speculative chemistry and biology.** Cold and oxygen-free conditions avoid some of silicon’s chemical constraints. The model uses liquid nitrogen as a solvent, while clearly flagging that the feasibility of this life is disputed and highly uncertain.

The sliders and the simulation use the same viability limits, so the interface cannot offer a starting condition that the configured life model considers uninhabitable.

## Why each world is the way it is

Each world is built outward from real chemistry, one step at a time (the `reasoning` list in each world's config, shown in the app).

**Carbon (known):**
1. Carbon bonds to itself strongly (C–C is about 346 kJ/mol) and forms stable double bonds, so it builds long, varied chains that survive in water.
2. Water is liquid across a wide temperature range and dissolves many carbon compounds, so carbon chemistry works well between roughly 0 and 100 °C at 1 bar.
3. Nitrogen is the unreactive bulk gas, and life needs it for proteins and DNA.
4. Photosynthesis raises oxygen and draws down carbon dioxide, and consumers do the reverse. We treat net production as a stand-in for organic-carbon burial, which really took billions of years.

**Silicon (speculative):**
1. Silicon is everywhere, yet life chose carbon: Earth's crust is about 28% silicon and 0.02% carbon, but living things are about 18% carbon.
2. Silicon bonds to itself weakly (Si–Si about 220 kJ/mol against about 350 for C–C), so its chains fall apart more easily. Cold slows that down.
3. Silicon bonds to oxygen extremely strongly, which is why the crust is silica rock. Free oxygen or liquid water would lock silicon away, so this world has neither; water exists only as frozen bedrock.
4. Silanes burn on contact with oxygen and break down in water, which reinforces step 3.
5. So the solvent must be cold and unreactive. The best-discussed candidate is liquid nitrogen (Bains 2004).
6. In the cold, silicon's weakness becomes its strength: at −183 °C carbon chemistry is all but frozen, while silicon's weaker bonds can keep reacting.
7. The seas set the air. Nitrogen is liquid only between about −210 °C and −147 °C, and seas and air are both nitrogen, so the air sits at the seas' vapour pressure: about 3.6 bar at −183 °C, a thick cold atmosphere like Titan's.

**The caveat, as the app shows it:** "Most chemists doubt this: almost nothing dissolves in liquid nitrogen, and chemistry there is extremely slow. Petkowski, Bains and Seager (2020) conclude that no environment makes silicon-based life plausible. This world is our best-reasoned guess, not a prediction."

## How to explain a creature

An inspect card should answer two different questions:

1. **How did the model produce this feature?** The card reads the inspected creature’s body plan and genes. It explains the body-plan rule, which movement score is cheapest, how its diet genes weight plant and animal food, and what protection and climate traits do in the simulation.
2. **Why did this lineage spread?** That is a stronger causal claim. The model can show a trait’s programmed effects and trade-offs, but a single run does not prove which pressure caused a lineage to spread. The card says this directly instead of presenting a mechanism as a proven evolutionary history.

Silicon anatomy is an explicit assumption. Radial faceted bodies are the default; the model switches to a bilateral, front-first walker when the segment gene is at least `0.55` and the limb gene resolves to one or two leg pairs. A separate plates gene controls whether the walker has a ceramic shell. These are rules in our simulation, not claims about real silicon organisms. The inspect card explains the branch used by each specimen.

Some traits have modelled trade-offs: plates and horns add defense and mass, silicon plate coverage also slows modeled dissolution in liquid, and silicon cold stability reduces warm-side climate stress while increasing upkeep. Body colour and pattern are visual only; glow has an upkeep cost. The README and inspect card distinguish these implemented effects from evidence about real-world evolution.

## Design principles

- **Grounded speculation.** Each world fact has a plain-language reason and source, or is marked as an assumption.
- **Life changes the planet.** Conditions affect survival and growth; organisms then alter gases, sea cover, and habitat.
- **Deterministic runs.** Seeded random streams and fixed simulation steps make a chosen seed repeatable across frame rates.
- **One-way rendering.** Rendering reads simulation state. Some gene-derived body traits affect ecology; decorative rendering details do not write back into the simulation.
- **Small explicit model.** New rules should explain a meaningful ecological or presentation effect and carry an uncertainty label where evidence is incomplete.

## Current model at a glance

- A 64 × 64 world grid and a fixed 20 Hz simulation step.
- A 15-gene animal genome: 12 body genes and 3 climate genes, plus inherited body composition.
- One shared ecology for feeding, hunting, fleeing, movement, rest, death, and reproduction.
- A configured cap of 1,024 organisms; plants are tracked as grid biomass.
- A browser app built with Vite and three.js, with a worker-driven simulation, conditions panel, bestiary, and click-to-inspect cards.

## What is emergent and what is designed

- **Emergent:** which body plans appear and which traits spread, population sizes, and how the air and seas change as life feeds back on them.
- **Seeded:** the founders (at least 24 capsule worms when life appears), the random seed, and the starting terrain, including silicon's relic water-ice arches and spires.
- **Designed:** the body-plan rules (`develop()`), the 12-gene layout, the trait costs, the 12 ecology rules, the species definition and name generator, every feedback rate, and the build timings. The years counter is illustrative.
- **Tuning choices, declared:** raised mutation; a compressed pace of chemistry (and silicon's lowered activation energy) so evolution is visible in a demo; a longer base lifespan; silicon plants that saturate at 1% sunlight; the 20-second fast-forward of about 340 ecology-seconds; hunger as plant scarcity; grazing that takes only a share; consumer interference; and a spore bank that lets life regrow after a crash.
- **Speculative (silicon):** the chemistry itself, silicon–nitrogen bodies and ceramic plates, glow without oxygen, the crystal crusts, life leaving the sea, and the nitrogen feedback loop.
- **Illustration only:** the particle box, the live view in inspect cards, sky and fog, plant shapes (the simulation has only per-cell biomass), IK feet, the player's suit, and creature display size (a ~64× real size range is drawn as ~25×).
- **Not there yet:** hunting doesn't pay enough in our ecology for a stable hunter tier to evolve within a demo, so the worlds are grazers and a few omnivores.

## Sources

Every number that describes a world lives in its config file with a one-sentence reason and source ids, or is marked `assumption: true`, which the UI shows as an assumption.

- [`src/worlds/sources.ts`](src/worlds/sources.ts): every citation, each with a DOI or a database URL.
- [`research/sources-verified.md`](research/sources-verified.md): what each source was checked against (Crossref, NIST, abstracts) and exactly which claim it supports, including the ones we could not confirm.
- [`research/silicon-life/REPORT.md`](research/silicon-life/REPORT.md): the evidence base for the silicon world.

Key references: Bains (2004), *Astrobiology*; Petkowski, Bains and Seager (2020), *Life*; National Research Council (2007), *The Limits of Organic Life in Planetary Systems*; Takai et al. (2008), *PNAS* (growth at 122 °C); the NIST Chemistry WebBook (nitrogen and water phase data); Fulchignoni et al. (2005), *Nature* (Titan from Huygens).

## Repository guide

| Path | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Detailed product specification and source of truth for chemistry, simulation rules, data contracts, and demo constraints. |
| [`src/worlds/`](src/worlds) | Carbon and silicon world facts, assumptions, limits, and life settings. |
| [`src/sim/`](src/sim) | Deterministic simulation, organism development, ecology, and field-guide logic. |
| [`src/ui/`](src/ui) | Selection screen, conditions, bestiary, and inspect cards. |
| [`src/render/`](src/render) | three.js world, creatures, plants, lighting, and visual counterparts. |
| [`src/gen/`](src/gen) | Procedural terrain and landmarks. |
| [`docs/features/`](docs/features) | Feature specifications and design constraints. |
| [`docs/NOT_NOW.md`](docs/NOT_NOW.md) | Deferred ideas and features outside the current scope. |
| [`research/silicon-life/`](research/silicon-life) | Evidence, sources, and caveats for the speculative silicon world. |

## Development rules

1. Keep scientific values and thresholds in world configuration with a reason, sources, or an explicit assumption.
2. Keep randomness seeded and simulation steps fixed.
3. Keep the renderer read-only with respect to simulation state.
4. Explain a modeled effect separately from a claim about why a trait evolved.
5. Keep the silicon world’s caveat visible wherever its speculative life is presented.

For the full requirements and open questions, start with [`CLAUDE.md`](CLAUDE.md), then see [`docs/NOT_NOW.md`](docs/NOT_NOW.md) and the relevant feature specification.
