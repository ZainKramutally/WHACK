# Life Is ▢ Based

> A speculative-life browser experience for WHACK 26 / Marshall Wace's **New Worlds** challenge.

What if life had been built from a different element?

Choose carbon or silicon, set a planet's starting conditions, and watch a world form and evolve over a compressed geological history. The experience is a third-person three.js world: terrain rises, seas settle, life appears, and living populations feed back into the atmosphere and landscape.

Carbon is life as we know it. Silicon is our best-reasoned guess at life as we do not.

## The idea

The player completes the sentence **“Life is ▢ based”** by choosing an element from group 14.

- **Carbon — known.** A water world whose photosynthetic life gradually changes its atmosphere: oxygen rises only after geological sinks weaken, while carbon dioxide falls through weathering and biology.
- **Silicon — speculative.** A cold, oxygen-free world with liquid-nitrogen seas. It treats silicon's weak chains and strong affinity for oxygen as constraints, not hand-waves. Its caveat is part of the experience: current chemistry does not consider silicon-based life likely.

Three controls—temperature, nitrogen and oxygen—let a player test conditions. A world never enters a condition where its life cannot survive: the same config-driven limits power both the sliders and the simulation.

## Design principles

- **Grounded speculation.** Each world fact comes with a plain-language reason and source, or is marked as an explicit assumption.
- **Life changes the planet.** Conditions select organisms; organisms in turn alter gases, sea cover and available habitat.
- **Deterministic runs.** Named seeded random streams and fixed simulation steps make the default demo repeatable across frame rates.
- **Emergence over scripts.** The ecology uses one shared behaviour loop and relationships derived from body traits and local conditions—not authored species behavior.
- **Rendering is read-only.** Visual richness—body grammar, pose, glow, flora forms and field-guide names—never changes simulation fitness or outcomes.
- **No spectacle cheats.** There are no impacts, eruptions, storms, day/night cycles, rescue logic or preset-specific behavior in the core simulation.

## Creative direction

The ecology follows a deliberately small rule set:

- a 64×64 world grid holding carbon, silicon and oxygen nutrients, light, flora biomass, stone, liquid depth and derived risk;
- a 12-gene genome plus inherited `{ c, si, o }` body composition;
- one shared utility loop for foraging, hunting, fleeing, returning home, resting and budding;
- body-derived food-web relationships, locomotion and roles;
- fixed 20 Hz simulation steps, up to 3,000 agents, and a tightly capped constants budget.

That constraint is intentional. New rules belong only if a headless A/B run improves the ecosystem's variety or readability without destabilising it. Deferred ideas live in [`docs/NOT_NOW.md`](docs/NOT_NOW.md).

## Current status

The repository currently contains the tested deterministic simulation foundation:

- seeded random streams shared with the visual-world prototype;
- a climate-aware producer/consumer population model;
- Arrhenius-compressed life pace, oxygen-linked consumer size, cold-stability selection and stable organism IDs;
- a packed organism buffer designed for worker-to-renderer transfer.

The Vite/three.js app, world configuration, physical atmosphere/sea models, spatial ecology, worker, UI, terrain integration and renderer are the active build work. The plan for that work is in [`docs/superpowers/plans/2026-11-07-backend-mvp.md`](docs/superpowers/plans/2026-11-07-backend-mvp.md).

## Getting started

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run typecheck
npm test
```

At present, the root package exposes TypeScript checks and unit tests only. The browser development/build commands will be added with the Vite application scaffold.

## Repository guide

| Path | Purpose |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Product specification and source of truth for world chemistry, experience, data contract and demo constraints. |
| [`src/sim/`](src/sim) | Deterministic simulation primitives and their tests. |
| [`mockups/worlds/`](mockups/worlds) | Caden's visual-world prototype: terrain, palette, fog, sky and materials to port into the app. |
| [`docs/emergence/`](docs/emergence) | Creature/ecology research and the adopted simplicity guardrails. |
| [`research/silicon-life/`](research/silicon-life) | Evidence base and caveats for the silicon world. |
| [`research/body-plans/`](research/body-plans) | Headless ecology experiments and time-to-trait research. |
| [`research/world-forms/`](research/world-forms) | Terrain and visual-world research. |
| [`docs/superpowers/plans/`](docs/superpowers/plans) | Executable engineering plans. |

## Development rules

1. Put every scientific number, threshold and rate in world config with a reason and source; mark unsupported values as assumptions.
2. Keep randomness seeded and simulation steps fixed.
3. Keep the slider UI and simulation on the same viability functions so they cannot disagree.
4. Keep renderer output one-way: render state may read simulation state, never write it.
5. Before expanding the ecosystem, prove the addition earns its complexity with the agreed headless metrics.

For full requirements, open [`AGENTS.md`](AGENTS.md). For the ecosystem rules and rejected features, see [`docs/emergence/DECISIONS.md`](docs/emergence/DECISIONS.md) and [`docs/NOT_NOW.md`](docs/NOT_NOW.md).
