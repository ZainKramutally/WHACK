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

## The idea

The player completes **“Life is ▢ based”** by choosing an element from group 14.

- **Carbon — known chemistry, simplified biology.** A water world where photosynthetic producers change atmospheric oxygen and carbon dioxide while consumers feed through a shared ecology.
- **Silicon — speculative chemistry and biology.** Cold and oxygen-free conditions avoid some of silicon’s chemical constraints. The model uses liquid nitrogen as a solvent, while clearly flagging that the feasibility of this life is disputed and highly uncertain.

The sliders and the simulation use the same viability limits, so the interface cannot offer a starting condition that the configured life model considers uninhabitable.

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
