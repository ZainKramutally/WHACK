# Body plans (design F): executive summary

2026-11-07. Details are in `REPORT.md`. The numbers come from a headless toy `[sim]` whose coefficients I authored and haven't calibrated. Treat the structure of the results as solid and the exact figures as rough.

## Answer

- **Ground fauna: conditional GO.** The round-2 hybrid evolves legs, horns and plates (each ≥ 20%) by about 133–139 demo-s on the ×1 → ×40 schedule. One-body rhino-lizards (legs + horns + plates) reach ≥ 5%. Bestiaries differ by preset, and the run stays stable at 3,000 animals.
- **Sky whales and drifters as specified: NO-GO.** Body size is never selected upwards, and the buoyancy gate is a fitness valley. Neither appeared in 105 runs.
- **F as written fails.** A generation takes about 13 sim-s, so at ×1 the demo gets 6–12 generations.

## Recipe (tested)

- σ ×2.5, always on.
- Cap 3,000 animals: 300 goes extinct, and 1,000 is fragile at high Hunger.
- Plate ledger: build cost 0.05, mass 0.15, Water dissolution 0.15.
- 7 body basins with a look-only snap at κ 0.5, activated by occupancy.
- Five niche pools: ground, liquid, aerial, canopy and stone dens.
- Time: about 340 sim-s for the trait set, 600–860 sim-s for all three traits in one body.
- Drop the Hox midwife and "grazer tasted meat": neither had any effect.

## Templates as basins

- Templates are **declared developmental attractors** (Waddington canalization), never fitness targets.
- Only look genes snap. Everything that costs energy is selected.
- The snap doesn't speed up evolution. It makes the bodies selection built **readable 5–10× sooner**.
- Convergent evolution justifies a short template list `[sci]`. The snap itself is `[game]`.

## Biology rules to change

- Eyes regress in the dark.
- Armour is inducible.
- Horns are prey defence, not something Hunger grows.
- TSR scales by medium.
- Oxygen raises body size.
- Floating needs gas bags.
- Flora glow needs oxygen.

## Still broken

- **Strider monoculture:** 1,010–2,280 of 3,000 animals.
- **No size selection.**
- **Hunters collapse at medium Hunger.**
- **Rhino-lizard only partial:** it reads as "formed" in 1 of 5 presets.

## Recommended round 3: niche-table generator

- **A niche table computed from the dials.** Channels (Air, Canopy, Ground, Water, Stone-dens) × trophic level, each with a Light/Sea/Heat energy budget.
  - **Levels:** Lindeman's ~10% transfer and a ~10× predator mass step, clipped to 2–4, so only rich, hungry worlds get an apex.
  - **Abundance:** Damuth, N ∝ M^-0.75.
- **The table sizes resource pools. Access to each pool is an evolved body trait,** so capsule lineages speciate into empty slots on their own.
- **Succession follows energy:** mats/worms → grazers → hunters → apex. Dial moves reshape the table and trigger crashes and radiations. Every slot that fills is a named discovery beat.
- **Worked example:** Earth-ish has 10 slots and no apex. Hunter's dusk has 11 plus a land apex, but Damuth allows only about 1 apex animal in 3,000.

## Slide facts (verified)

1. Crustaceans became crabs at least 5 separate times.
2. A glass shell costs a diatom about 2% of its energy.
3. A young cavefish's eyes cost it 15% of its resting energy.
4. 3 in 4 deep-water animals make their own light.
5. Warmth shrinks water animals about 5% per °C, 10× more than land animals.
6. Grazed grasses grow more glass.

## Top risks

- The toy coefficients won't transfer to TS, so everything needs re-tuning in Vitest.
- The niche table could drift into authored species. Guard against it with a neutral-control test.
- An apex tier of 1–3 animals is fragile.
- Small fliers need a flight-cost term that hasn't been built.
- The ×40 Worker cost is unmeasured in JS.
