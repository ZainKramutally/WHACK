# Life Is ▢ Based — Backend MVP Implementation Plan

> **Synced to CLAUDE.md on 2026-11-07, with Caden's rulings, by the session/logic team lead.**
> - `CLAUDE.md` is the spec. There is no `CLAUDE.md`.
> - The genome has 15 genes: 12 body genes plus the 3 climate genes already in `population.ts`.
> - The animal cap is 1,024 (never fewer than 1,000).
> - Terrain is one analytic height function with a formation `rise` (CLAUDE.md "Terrain and landforms"), not a stored heightmap.
> - World configs carry no visual metadata, only `starType` and `terrain`. The look lives in the art layer, behind CLAUDE.md "Logic → art interface".
> - **Task 5 is split.** Caden's session builds `genome.ts`, `develop.ts`, `constants.ts` and `guide.ts`. The engineering lead keeps `grid.ts`, `ecology.ts`, `relationships.ts` and `metrics.ts`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, config-driven simulation backend and worker API that powers both carbon and speculative silicon worlds, with Caden's minimal, spatial, body-plan ecology at its core.

**Architecture:** Keep all world-specific facts in `src/worlds/` and make simulation models pure where possible. A `WorldSimulation` owns seeded state, timeline progression, atmosphere/sea/life feedback, a 64² ecosystem grid and control clamping; a Web Worker only paces that engine and transfers snapshots. The ecosystem uses Caden's one shared utility loop, derived relationships and 15-gene body plan (12 body + 3 climate); the renderer is read-only and consumes snapshots without duplicating physics.

**Tech Stack:** TypeScript strict mode, Vitest, Vite, browser Web Worker, three.js r187 (renderer integration owned by Caden).

**Spec:** `CLAUDE.md` for world chemistry, phases, controls and data contract; `docs/emergence/DECISIONS.md` for the agreed ecosystem direction; `docs/NOT_NOW.md`; `research/silicon-life/REPORT.md`.

## Global Constraints

- All chemistry, climate, life and rate constants live in world config with `why`, `sources`, or `assumption: true`; no world facts are hardcoded in simulation or rendering.
- Carbon is `known`; silicon is visibly and programmatically `speculative`, with its caveat and every assumption retained.
- Every random draw comes from a named stream produced by `makeRng(seed)`; fixed simulation steps make the default runs reproducible across frame rates.
- No impacts, eruptions, flares, random disasters, preset-specific branches, or rendering-to-simulation feedback.
- Carbon and silicon use the same slider ranges; the worker clamps every running-world control to its computed living band.
- Default timeline reaches its present phase at 130 demo seconds and continues as a stable state.
- Caden's ecology direction is binding for this plan: 15 genes (12 body genes from DECISIONS G.1 plus the 3 climate genes from `population.ts`), one 64² grid, fixed 20 Hz ticks, ≤1,024 animals (never fewer than 1,000 in the demo), ≤12 ecological rules and ≤25 constants. The initial 18 constants are the set in `DECISIONS.md` §G.2.
- Derive roles, relationships, locomotion, litter size, body-detail and look-attractor identity; do not author species, named basin behavior, per-role state machines or preset branches.
- No storms, day/night, seasons, tides, global cycles, seeded lineages, midwives, rescue logic or pre-evolved menagerie in the normal demo path. Respect `docs/NOT_NOW.md`.
- Rendering is read-only: gait, IK, L-system flora shapes, glow, field-guide look-attractors and discovery classification must not affect simulation state.
- Amend the shared `WorldConfig`, `SimSnapshot`, organism-buffer and bus contract before implementation to reflect this direction, then hand the versioned contract to Caden.
- UI, DOM controls, Three.js scene, particle rendering, player controller, cards, and visual materials are out of scope for this plan.

## Review Focus

- Silicon at `-183 °C`, `1×` nitrogen is non-viable, but becomes viable only after nitrogen inventory crosses the sea-equilibrium threshold; Task 4 pins this.
- A slider can never leave the viable region through direct input or a coupled condition; Task 4 and Task 8 pin this.
- A long tab suspension or slow device never changes the fixed-step state sequence; Task 8 pins elapsed-time catch-up separately from state advancement.
- A new mutation must acquire food, predator and refuge relationships solely from its body and local grid state; Task 5 pins this.
- Carbon oxygen must remain near zero while its configured sink is active, then rise only from configured feedbacks; Task 6 pins the present target and phase behavior.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/worlds/types.ts` | Shared sourced data, world config, controls, limits, phases and snapshot contract. |
| `src/worlds/sources.ts` | Stable source IDs and citation metadata referenced by configs. |
| `src/worlds/controls.ts` | The three shared slider ranges/defaults and display-unit helpers. |
| `src/worlds/carbon.ts`, `src/worlds/silicon.ts` | Complete data-only world definitions, targets, phases, limits, rules, `terrain` and `starType`. No visual metadata: the look lives in the art layer. |
| `src/worlds/index.ts` | World registry and `worldFor(id)` lookup. |
| `src/sim/models.ts` | Pure equations: interpolation, radiative balance, partial pressure, nitrogen vapour pressure, sea volume and gas density. |
| `src/sim/limits.ts` | Pure viability, band-search and world-start correction functions shared by selection UI and worker. |
| `src/sim/timeline.ts` | Fixed-step phase lookup, phase transition detection and history-year interpolation. |
| `src/sim/simulation.ts` | Seeded authoritative state, configured processes/feedbacks and snapshot creation. |
| `src/sim/workerProtocol.ts` | Strict messages exchanged by main thread and sim worker. |
| `src/sim/worker.ts` | Wall-clock pacing, catch-up, control messages and transferable snapshot posting. |
| `src/sim/constants.ts` | **Caden's session.** The 18 initial ecology constants, tagged as game/science and guarded by a constant-budget test. |
| `src/sim/genome.ts`, `src/sim/develop.ts` | **Caden's session.** The 15-gene genome (12 body + 3 climate) plus inherited composition, and the pure chemistry-to-body-plan grammar. |
| `src/sim/grid.ts` | One 64² grid of C/Si/O nutrients, light, flora mat/canopy biomass, stone, liquid depth and derived risk. |
| `src/sim/ecology.ts`, `src/sim/relationships.ts` | Shared utility loop, body-derived food-web relationships, births/deaths, nutrient cycling and movement costs. |
| `src/sim/metrics.ts` | Food-web and diversity measures. It imports OTU clusters from `guide.ts`. |
| `src/sim/guide.ts` | **Caden's session.** OTU clustering (DECISIONS §A: radius 0.25, ≥ 4 live animals), `guide:newForm` detection and the trait-based name generator. |
| `src/sim/organismLayout.ts` | Versioned packed organism snapshot layout, extended only after the genome decision. |
| `src/gen/terrain.ts` | One analytic `height(x, z, progress)` with a formation `rise`, written as a TSL node and as a CPU sampler with the same maths. Also the spawn-shore guarantee and `seaLevelForCover()` (CLAUDE.md "Terrain and landforms"). |
| `src/bus.ts` | Typed event map and browser event bus shared with Caden's UI/render code. |

## Task 0: Align the shared contract to Caden's ecology direction

**Files:**
- Modify: `CLAUDE.md` and `docs/emergence/DECISIONS.md` only to record the agreed contract
- Reference: `docs/emergence/DECISIONS.md`, `docs/NOT_NOW.md`

**Interfaces:**
- Produces: an agreed 15-gene `Genome`, inherited `Composition`, `EcologyConstants`, 64² `GridState`, a 1,024 animal cap, flora-as-grid-biomass model, and versioned `SimSnapshot`/packed-organism contract.

- [ ] **Step 1: Replace the obsolete F-specific backend contract**

Record Caden's 12 genes (`size`, `segments`, `limbPairs`, `limbLen`, `plates`, `horns`, `gape`, `diet`, `eyes`, `buoy`, `glow`, `sociality`), inherited `{ c, si, o }` composition, grid state and cap in the source-of-truth architecture section.

- [ ] **Step 2: Record the non-negotiable guardrails**

State explicitly that the 12 rules in `DECISIONS.md` §3 are the ecology's full behavior budget; renderer-side body detail and look attractors are read-only; and every rejected feature remains in `NOT_NOW`.

- [ ] **Step 3: Commit the decision document separately**

```bash
git add AGENTS.md docs/emergence/DECISIONS.md
git commit -m "docs: reconcile ecology contract"
```

**Status:** done in `CLAUDE.md` (the session/logic logic pass). Caden's session defines `Genome`, `Composition` and `EcologyConstants` in `genome.ts` and `constants.ts`, and the grid and ecology build against those.

### Task 1: Establish the shared backend contract and source registry

**Files:**
- Create: `src/worlds/types.ts`, `src/worlds/sources.ts`, `src/worlds/controls.ts`, `src/worlds/index.ts`, `src/worlds/types.test.ts`
- Create: `src/bus.ts`, `src/bus.test.ts`
- Modify: `package.json` (add Vite/three scripts and dependencies only if Caden has not already done this)

**Interfaces:**
- Produces: `WorldConfig`, `Conditions`, `LivingBand`, `SimSnapshot`, `InspectTarget`, `ControlDef`, `WorldId`, `worldFor(id)`, `CONTROLS`, and typed event methods `on`, `emit`, `off`.
- Consumed by: every later backend task and Caden's selection, Conditions, cards and renderer.

- [ ] **Step 1: Write contract tests**

Add tests that `CONTROLS` has exactly `temperature`, `nitrogen`, `oxygen`; their ranges are `[-250, 150]`, `[0.01, 1000]`, `[0, 40]`; temperature/oxygen are linear, nitrogen is log; and source IDs referenced by a minimal sourced config resolve.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/worlds/types.test.ts src/bus.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Define the contract in `src/worlds/types.ts`**

Use the interfaces in `CLAUDE.md` as names and field ownership. Add `WorldId = 'carbon' | 'silicon'`; keep `stats`, `controls`, `bands`, `organisms`, `births`, and inspect fields represented exactly once.

- [ ] **Step 4: Implement source lookup, shared controls, world registry, and the typed bus**

`sourceFor(id)` throws for an unknown ID. The event map includes every event listed in `CLAUDE.md`; `off` removes precisely the supplied listener.

- [ ] **Step 5: Run the focused suite**

Run: `npx vitest run src/worlds/types.test.ts src/bus.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/worlds src/bus.ts src/bus.test.ts
git commit -m "feat: add shared world simulation contract"
```

### Task 2: Encode both world definitions as sourced data

**Files:**
- Create: `src/worlds/carbon.ts`, `src/worlds/silicon.ts`, `src/worlds/worlds.test.ts`
- Modify: `src/worlds/index.ts`, `src/worlds/sources.ts`

**Interfaces:**
- Consumes: `WorldConfig`, `CONTROLS`, source registry from Task 1.
- Produces: `carbonWorld`, `siliconWorld`, `WORLDS`, configured targets/limits/phases/life rules.
- Consumed by: models, limits, simulation and Caden's static copy.

- [ ] **Step 1: Write config-integrity tests**

Test that every stat/process/feedback/limit/reasoning item has at least one source or `assumption: true`; every referenced phase process exists; silicon has `status: 'speculative'` and a caveat; both worlds supply all three start defaults; and all controls use the shared definitions rather than per-world ranges.

- [ ] **Step 2: Run the config test to verify it fails**

Run: `npx vitest run src/worlds/worlds.test.ts`

Expected: FAIL because world modules do not exist.

- [ ] **Step 3: Add `carbonWorld` as data only**

Encode its 0/10/25/50/90/130-second phases, year anchors, oxygen sink/photosynthesis/respiration/weathering processes, target ranges, water solvent data, and life rules. Put every numerical coefficient in this module, not a model.

- [ ] **Step 4: Add `siliconWorld` as data only**

Encode liquid-nitrogen solvent and vapour-pressure lookup data, oxygen trace limit, nitrogen-sea inventory/feedback, phase anchors, speculative labels, caveat, targets and compressed metabolism assumptions.

- [ ] **Step 5: Add every cited ID to `sources.ts` and label unresolved quantities**

Use `assumption: true` for every number identified as open in `CLAUDE.md`; do not convert an unresolved claim into a citation placeholder.

- [ ] **Step 6: Run the focused suite and commit**

Run: `npx vitest run src/worlds/worlds.test.ts`

Expected: PASS.

```bash
git add src/worlds
git commit -m "feat: define sourced carbon and silicon worlds"
```

### Task 3: Implement pure physical models

**Files:**
- Create: `src/sim/models.ts`, `src/sim/models.test.ts`

**Interfaces:**
- Consumes: solvent and derived-stat configuration.
- Produces: `interpolateTable`, `vapourPressureBar`, `seaVolume`, `partialPressureBar`, `radiativeTemperatureC`, `gasDensityKgM3`, `derivedStats`.
- Consumed by: limits, simulation, terrain and UI stats.

- [ ] **Step 1: Write model tests from world config**

Assert lookup interpolation returns exact table endpoints; silicon's configured default temperature produces its configured pressure target; extra silicon nitrogen increases sea volume rather than atmospheric pressure while seas remain; and gas density is positive and rises with pressure at fixed temperature.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/sim/models.test.ts`

Expected: FAIL because the model module does not exist.

- [ ] **Step 3: Implement model forms only**

Each function accepts coefficients via config parameters. Clamp only where the selected model explicitly defines a physical domain, and return an explicit no-liquid result above a solvent critical point rather than silently fabricating a sea.

- [ ] **Step 4: Run the focused suite and commit**

Run: `npx vitest run src/sim/models.test.ts`

Expected: PASS.

```bash
git add src/sim/models.ts src/sim/models.test.ts
git commit -m "feat: add config-driven atmosphere and sea models"
```

### Task 4: Make viability and slider bands a single source of truth

**Files:**
- Create: `src/sim/limits.ts`, `src/sim/limits.test.ts`

**Interfaces:**
- Consumes: `WorldConfig`, `Conditions`, `CONTROLS`, model functions.
- Produces: `canLive(world, conditions)`, `livingBands(world, conditions)`, `startingConditions(world, requested)`, `clampToBands(world, conditions, changedControl)`.
- Consumed by: selection screen (Caden), simulation and worker.

- [ ] **Step 1: Write the required viability tests**

Cover: carbon and silicon are non-viable at `-183 °C, 1× N₂`; silicon becomes viable only after sufficient nitrogen; silicon's temperature high edge falls when nitrogen inventory falls and never exceeds `-147 °C`; carbon's high edge remains `122 °C`; silicon oxygen is pinned at zero; an empty band occurs for silicon nitrogen at `15 °C`.

- [ ] **Step 2: Add start-correction and coupling tests**

Assert `startingConditions` retains valid requested values; untouched silicon corrects temperature before nitrogen and reports each limit; changing any one control cannot return invalid coupled settings; `canLive` agrees with each computed band edge.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/sim/limits.test.ts`

Expected: FAIL because the limits module does not exist.

- [ ] **Step 4: Implement the pure limit evaluator and numeric band search**

Evaluate every configured `LethalLimit` through the relevant model, then numerically search each shared control track with all other physical settings held fixed. Return the responsible `limitId` at each boundary and use fixed correction order: temperature, nitrogen, oxygen.

- [ ] **Step 5: Run the focused suite and commit**

Run: `npx vitest run src/sim/limits.test.ts`

Expected: PASS.

```bash
git add src/sim/limits.ts src/sim/limits.test.ts
git commit -m "feat: add shared viability limits and slider bands"
```

### Task 5: Build Caden's minimal spatial ecosystem

**Files:**
- **Split:** Caden's session creates `src/sim/constants.ts`, `src/sim/genome.ts`, `src/sim/develop.ts` and `src/sim/guide.ts` with their tests (Steps 2 constants half, 3 genome/develop half, and 6 guide half). The engineering lead creates `src/sim/grid.ts`, `src/sim/relationships.ts`, `src/sim/ecology.ts` and `src/sim/metrics.ts`, and builds against those exports.
- Modify: `src/sim/population.ts`, `src/sim/population.test.ts`, `src/sim/organismLayout.ts`

**Interfaces:**
- Consumes: the 15-gene contract from `genome.ts`, `EcologyConstants`, `Environment`, seeded RNG and world chemistry.
- Produces: `createGrid()`, `Genome`, pure `develop(genome, composition, conditions)`, `relationship(a, b, context)`, `Ecology.step(environment, dt)`, organism birth plans, grid summaries, variety metrics and renderer-only guide discoveries.
- Consumed by: `WorldSimulation`, worker and Caden's fauna/field-guide renderer.

- [ ] **Step 1: Preserve the current deterministic-core tests before extending it**

Run: `npx vitest run src/sim/population.test.ts`

Expected: PASS before edits; retain tests for determinism, warming adaptation, oxygen-linked consumer size, cold pace, stable IDs and packed records.

- [ ] **Step 2: Write constants/grid contract tests**

Assert exactly the 18 initial named constants from `DECISIONS.md` §G.2, a 64×64 grid, and no mutable world field beyond C/Si/O, light, flora mat/canopy, stone, liquid depth and derived risk. The test must fail if a preset ID, basin ID, species name, or renderer-owned field appears in simulation state.

- [ ] **Step 3: Write pure genome/development and relationship tests**

Use fixed 15-gene genomes to assert `develop()` is referentially transparent; carbon outputs curved/curl-capable plans; silicon outputs faceted segments and 15°-quantized joints. Assert a new mutant's Eats, Afraid, Rival and Kin relations come only from size/gape/defence, diet, lineage and sociality; no species name or role input is accepted.

- [ ] **Step 4: Write grid-ecology and variety tests**

Test the 12 rules through their observable effects: limiting C/Si/O constrains growth by the scarcest nutrient; unplated silicon is penalised only by configured solvent polarity; bodies select their cheapest locomotion mode; death returns C or creates Si+O stone; and the same seed yields identical grid/agent snapshots. Add metric tests for OTU clustering, dominant-share, body-mass spread, trophic links and Bray–Curtis comparison.

- [ ] **Step 5: Implement one 20 Hz ecology, not a second climate model**

Extend the existing deterministic population or replace it only behind the same stable-ID/packing API. Implement one shared utility loop (`forage`, `hunt`, `flee`, `home`, `rest`, `bud`) for every animal, derive all relationships, and apply the 12 rules from `DECISIONS.md` §3. Flora remains grid biomass; renderer L-systems derive from that biomass and never become simulation agents.

- [ ] **Step 6: Version the packed organism layout and guide payload once**

Append only agreed genome/locomotion/grid-reference fields; never reorder the existing `x` through `generation` fields. Send a discovery only when an animal first meets a renderer-owned look-attractor classification; no look-attractor participates in fitness.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx vitest run src/sim/population.test.ts src/sim/constants.test.ts src/sim/grid.test.ts src/sim/relationships.test.ts src/sim/genome.test.ts src/sim/develop.test.ts src/sim/ecology.test.ts src/sim/metrics.test.ts src/sim/guide.test.ts`

Expected: PASS.

```bash
git add src/sim/constants.ts src/sim/grid.ts src/sim/relationships.ts src/sim/genome.ts src/sim/develop.ts src/sim/ecology.ts src/sim/metrics.ts src/sim/guide.ts src/sim/population.ts src/sim/organismLayout.ts src/sim/*.test.ts
git commit -m "feat: add Caden's minimal spatial ecology"
```

### Task 6: Implement timeline and authoritative world simulation

**Files:**
- Create: `src/sim/timeline.ts`, `src/sim/timeline.test.ts`, `src/sim/simulation.ts`, `src/sim/simulation.test.ts`

**Interfaces:**
- Consumes: world config, limits, models, ecology and terrain-facing sea-cover calculation.
- Produces: `new WorldSimulation(world, requestedConditions)`, `step(dtSec)`, `setControl(controlId, value)`, `snapshot()`, `drainEvents()`.
- Consumed by: the worker in Task 8.

- [ ] **Step 1: Write timeline tests**

Assert phase transition boundaries at 0, 10, 25, 50, 90 and 130 seconds; history interpolation uses the configured anchors; `run:complete` fires exactly once at present; and present state does not advance into a new phase.

- [ ] **Step 2: Write world coupling and feature-gate tests**

Assert carbon oxygen remains constrained while the sink process is active, then rises under configured producer feedback; carbon CO₂/weathering follows the configured direction; silicon population nitrogen lock-up lowers sea cover while warming increases vapour pressure; all snapshots contain valid bands and controls. Add headless A/B hooks so a new rule, gene or constant is rejected unless it raises a declared variety/readability metric by 10% without breaking stability.

- [ ] **Step 3: Write target, determinism and no-cheat tests**

For both demo seeds/default starts, step exactly 130 seconds and assert each configured target range. Run a second identical simulation and require snapshot equality at fixed checkpoints; alter only the seed and require a different organism sequence. Assert no normal simulation branch reads a preset/species/basin name or invokes a rescue/menagerie path.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/sim/timeline.test.ts src/sim/simulation.test.ts`

Expected: FAIL because the timeline and simulation modules do not exist.

- [ ] **Step 5: Implement fixed-step integration**

Activate only each phase's configured processes and feedbacks, convert ecology biomass to feedback drivers, re-evaluate derived stats and bands, and ease drifted controls back into the legal region while emitting `control:blocked` with its limit ID.

- [ ] **Step 6: Run the focused suite and commit**

Run: `npx vitest run src/sim/timeline.test.ts src/sim/simulation.test.ts`

Expected: PASS.

```bash
git add src/sim/timeline.ts src/sim/timeline.test.ts src/sim/simulation.ts src/sim/simulation.test.ts
git commit -m "feat: add deterministic world timeline simulation"
```

### Task 7: Add deterministic terrain data for the rendering handoff

**Files:**
- Create: `src/gen/terrain.ts`, `src/gen/terrain.test.ts`

**Interfaces:**
- Consumes: demo seed, the world's `TerrainConfig` (CLAUDE.md), `seaCover` and formation `rise`.
- Produces: an analytic `height(x, z, progress)` (TSL node plus CPU sampler, same maths), `seaLevelForCover(cover)` computed numerically from the sampler, and `spawnPointNearShore(seaLevel)`.
- Consumed by: Caden's terrain, sea, player and Generate-transition render code.

- [ ] **Step 1: Write terrain contract tests**

Test a fixed seed produces identical height samples; different seeds differ; `seaLevelForCover` makes the below-level fraction match cover within one height-cell tolerance; and both world seeds have a spawn point within the configured shoreline distance.

- [ ] **Step 2: Run the terrain tests to verify they fail**

Run: `npx vitest run src/gen/terrain.test.ts`

Expected: FAIL because the terrain module does not exist.

- [ ] **Step 3: Implement the analytic height function**

Use a named terrain RNG stream and the `TerrainConfig` parameters. The CPU sampler is pure and renderer-independent. The TSL node uses the same formula, and a test checks the two agree. Silicon's relic ice arches and spires are seeded features of this function.

- [ ] **Step 4: Run the focused suite and commit**

Run: `npx vitest run src/gen/terrain.test.ts`

Expected: PASS.

```bash
git add src/gen/terrain.ts src/gen/terrain.test.ts
git commit -m "feat: add deterministic terrain simulation data"
```

### Task 8: Put the simulation behind a paced worker API

**Files:**
- Create: `src/sim/workerProtocol.ts`, `src/sim/worker.ts`, `src/sim/workerProtocol.test.ts`
- Modify: `src/bus.ts` only if event payloads need the already-agreed worker transport types

**Interfaces:**
- Consumes: `WorldSimulation`, `SimSnapshot` and shared event types.
- Produces: main-to-worker `init`, `start`, `pause`, `control:set`, `dispose` messages; worker-to-main `ready`, `snapshot`, `phase:changed`, `control:blocked`, `guide:newForm`, `run:complete`, `error` messages.
- Consumed by: Caden's application bootstrap and UI controller.

- [ ] **Step 1: Write protocol serialization tests**

Assert every message is discriminated by `type`; a snapshot's organism buffer can be transferred without changing count/stride metadata; unknown control IDs and malformed messages produce an `error` response rather than mutating state.

- [ ] **Step 2: Write pacing tests against an injectable clock**

Assert 1 second of wall time advances the configured fixed steps, delayed callbacks catch up only to the configured maximum batch, and equal accumulated simulation time produces equal snapshots regardless of callback cadence.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/sim/workerProtocol.test.ts`

Expected: FAIL because worker modules do not exist.

- [ ] **Step 4: Implement the worker loop**

Post snapshots at 20 Hz, transfer a freshly packed organism buffer, and apply `setControl` only through `WorldSimulation.setControl`. Never use frame time as a simulation delta.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run src/sim/workerProtocol.test.ts`

Expected: PASS.

```bash
git add src/sim/workerProtocol.ts src/sim/worker.ts src/sim/workerProtocol.test.ts src/bus.ts
git commit -m "feat: run deterministic simulation in a worker"
```

### Task 9: Publish the integration handoff and prove the backend end-to-end

**Files:**
- Create: `docs/backend-handoff.md`, `src/sim/demo.test.ts`
- Modify: `README.md` (commands and current implementation status)

**Interfaces:**
- Consumes: all prior task contracts.
- Produces: Caden-facing message/event table, lifecycle sequence and reproducible demo verification.

- [ ] **Step 1: Write the two-world end-to-end test**

For each world: call `startingConditions` from untouched selection values, instantiate the simulation, advance fixed steps through 130 seconds, assert non-empty snapshots after first life, legal controls/bands throughout, one `run:complete`, and all target stats in range. For the ecology benchmark, run the declared 3-seed headless harness and emit OTU, dominance, mass-spread, locomotion, trophic-link and stability metrics for Caden's review.

- [ ] **Step 2: Run the test to verify it fails before completing missing wiring**

Run: `npx vitest run src/sim/demo.test.ts`

Expected: FAIL until every integration seam is connected.

- [ ] **Step 3: Write `docs/backend-handoff.md`**

Document import paths, initialization sequence, every worker message/event, transfer ownership of `organisms.buffer`, reset/dispose behavior, and the guarantee that Caden can call `canLive`/`livingBands` on the selection screen without a worker.

- [ ] **Step 4: Run Tier 1 verification**

Run: `npm run typecheck && npm test`

Expected: PASS. Record elapsed time; any default test exceeding two seconds is moved or optimized.

- [ ] **Step 5: Commit**

```bash
git add docs/backend-handoff.md README.md src/sim/demo.test.ts
git commit -m "docs: hand off simulation backend integration"
```

## Sequencing and Ownership

1. You can start Tasks 1–4 immediately; send Caden the types/limits exports as soon as Task 4 lands so the selection screen can use the real green/red logic.
2. Complete Task 0 before Task 5 so the backend and Caden's renderer use the same 15-gene snapshot payload.
3. Tasks 5–6 are the critical path to a real demo. The ecosystem is accepted only when its headless A/B results meet Caden's feature gate; Task 7 can run in parallel only after its terrain configuration boundary is agreed with Caden.
4. Task 8 comes after Task 6; Caden can initially render a manually stepped simulation, then swap to the worker without changing UI semantics.
5. Do not start polish, new dials, extra worlds, day/night cycles, storms, or a rescue menagerie. Follow `docs/NOT_NOW.md`.

## Self-review

- **Spec coverage:** Tasks 1–4 cover data ownership, sliders and physical models; Task 5 covers Caden's 12-rule, 15-gene spatial ecology and feature gate; Task 6 covers climate feedback and the timeline; Tasks 7–8 cover deterministic generation and performance isolation; Task 9 covers the demo and UI integration boundary.
- **Known gap intentionally outside scope:** DOM UI, WebGPU/WebGL rendering, character movement, particles, materials and inspect-card visuals remain Caden's work. This plan supplies their data and events.
- **Contract consistency:** The selection UI and worker share `canLive`, `livingBands`, `startingConditions`, `Conditions`, `SimSnapshot`, and event payloads; only `WorldSimulation` mutates world state.
- **Risk coverage:** Every Review Focus item is pinned by Tasks 0, 4, 6, or 8 before the demo handoff.
- **Proportion:** Each task ends in a testable backend deliverable and a small commit; no task adds a feature that lacks a specified interface or behavioral check.
