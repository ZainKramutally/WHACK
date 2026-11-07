# Emergence decisions: answering the open questions (Rain World lens)

> **Proxy decisions by an agent acting for the owner. Override any line.**
> 2026-11-07. Written for Caden by an agent. The goal it worked from is Caden's own: *"as emergent as possible, so simple rules create very complex ecosystems, a bit like how Rain World's ecosystems work."* Where options tied, the more emergent one won, as long as it stays buildable in 24 h and honest: anything seeded or authored is declared on screen or in the honesty box. Nothing here has been built or run. Every constant is `[game]` until a headless run says otherwise.

Inputs: `research/body-plans/REPORT.md` §9–10, `EXECUTIVE_SUMMARY.md`, `notes/04-time-to-trait.md` (round 2), `docs/emergence/README.md` §5–6, `F-body-plan-first.md` §7 and §10, `WORLD_ATLAS.md` §7, `DESIGN.md` §1.

---

## 0. The answer in five lines

1. **Relationships, not roles.** Who eats, fears, ignores or contests whom is *computed from bodies* (size × gape vs defence). It is never written per species or per niche slot. Every new mutant joins the food web the tick it is born.
2. **One global cycle: the Storm.** A periodic, Sea-flavoured storm forces every animal to shelter. It turns stone dens into contested real estate, puts hunters at den mouths, and selects for size through fasting endurance. It is the one new rule, and it fixes three round-2 failures at once.
3. **The niche table sizes food, nothing else.** The dials set producer pools per channel. Trophic levels, apex tiers and abundances become a *forecast* that we display and the sim is free to break.
4. **Apex = honest rarity, emergent.** No authored mass ratio, no refuge, no cap raise. If an apex exists it is 1–3 long-lived animals. When it dies, the empty food sits there until something re-evolves to eat it, and that is a story beat.
5. **Same rules everywhere.** Off-camera animals and ⏩ deep time run the identical sim with rendering skipped (Rain World's "abstract" world). A pre-evolved menagerie is acceptable only as a declared kill switch.

---

## 1. Rain World: what it does, and the principles we adopt

### 1.1 Research summary (≤ 5 min, sources in §1.3)

- **Creatures live for themselves.** Jakobsson: creatures "exist in their own right, they exist there for themselves", and each is designed to "find food and move around and get back to its home before the night comes" [RW1]. Therrien: "outside of your frame they're all still alive … hunting food, … getting into territorial fights" [RW1]. The design aim was "the rat in Manhattan", with predators that act "like hungry animals" so the player feels empathy [RW7].
- **A relationship table with graded intensities**, not scripted encounters. Lizards *eat* scavengers, centipedes, eggbugs and noodleflies, are *afraid of* vultures, king vultures, long legs and leviathans, are *uncomfortable* with leeches, and *territorial* toward other lizards at a low value [RW4]. Scavengers are afraid of Daddy Long Legs at 1.0, King Vulture 0.95, Vulture 0.75 and Lizard 0.5, ignore batflies at ≤ 0.1, and treat their own kind as pack at 0.5 [RW5]. The relationship-type enum in code (Eats, Afraid, Ignores, Uncomfortable, StayOutOfWay, Attacks, Rivals, AggressiveRival, Pack, SocialDependent, PlaysWith, Antagonizes) is `[recalled]` from the modding community and not verified.
- **Relationships are dynamic.** Lizard opinion of the player moves with feeding, rescues and hibernating together, and drifts back toward 0 each cycle [RW4]. Scavenger reputation runs from −100 to 100, changes by at most ±50 per cycle, and losses are multiplied by the number of witnesses [RW5]. Lizards settle rivalry by hissing first and fighting only if neither yields, and a fight ends when one leaves, dies, dens, or gets distracted by prey or a predator [RW4].
- **Individual personality** comes from a per-creature ID: aggression, bravery, dominance, energy, nervousness and sympathy, which feed into each other and into relationships. Dominance picks the pack leader, and low bravery means following the leader closely [RW6].
- **Dens and home.** "Most of the creatures have an assigned den", which is both their spawn and where they "retreat to when rain arrives". If a creature is killed, its den refills with some probability [RW3]. Lizards drag caught prey back to the den [RW4].
- **The rain cycle is the global pressure.** Each cycle has a random length (6.5–13 min). The background darkens about 1 min before the end, a rumble comes about 30 s before, then the rain is "lethal, either crushing or drowning all creatures". Creatures retreat to dens as rain intensifies [RW2]. Everything converges on shelter at the same time, so the world reliably produces collisions.
- **Off-screen simulation.** Creatures keep living outside the camera [RW1]. Scavengers behave differently "while abstracted" (high-energy ones stray from paths) [RW5], which confirms a cheaper off-screen mode. The `AbstractCreature`/`AbstractRoom` split, where off-screen creatures move along the room graph, is `[recalled]`.
- **Procedural animation as a believability tool.** Bodies are "a bunch of points in space … connected at certain distances" [RW1]. Therrien called procedural animation necessary for a "believable" ecosystem. It produced unscripted reads such as predators looking "frustrated" when they missed [RW7]. The GDC 2016 Animation Bootcamp talk by Jakobsson and Therrien covers this [RW8]; its title was verified, its content not read.
- **Chaos and luck are the point.** Therrien: "we wanted to maintain the chaos of the game". Too-strict creature paths would make it "a room obstacle". Tuning meant running a region 15–20 times. Player experience comes down to "dice rolls" [RW1]. Jakobsson: "an entity that is stupid enough can be difficult to outsmart" [RW1].

### 1.2 Principles adopted

| # | Principle | How Rain World does it | How it maps to our sim | Decides |
|---|---|---|---|---|
| P1 | **Every creature is hungry and afraid** | Creatures find food and get home before night [RW1]. Predators are "hungry animals" [RW7] | One shared utility loop for every animal: forage/hunt vs flee vs go home vs rest vs bud. The Hunger dial scales the hunger drive. No niche-specific state unlocks | Hunters vanishing; §9.6 FSM roles (cut) |
| P2 | **Relationships, not scripts** | Per-species table: Eats/Afraid/Ignores/Rival/Pack with intensities 0–1 [RW4, RW5] | **We derive the table from bodies** (size × gape vs plates + horns) per lineage pair, cached every 2 s. This goes one step past Rain World: unauthored species get relationships for free | Q1 monoculture, Q4 apex, the hunter tier |
| P3 | **A global cycle forces collisions** | Lethal rain at the end of each cycle drives everything to dens and shelters [RW2, RW3] | **The Storm**: a periodic, Sea-flavoured exposure hazard. Shelter = stone, canopy cover or liquid depth. Hunters ambush at shelter mouths, and fasting endurance selects for size | Q2 size selection, monoculture, hunters, Rule 7 |
| P4 | **Home is a place, and places are contested** | Assigned dens, prey carried home, refill on death [RW3, RW4] | Each animal remembers a home cell (its best shelter). Builders' stone *creates* dens, so stone becomes a resource worth fighting over | Den channel, builders, terrain feedback |
| P5 | **Relationships move** | Opinion and reputation shift with events and decay toward neutral [RW4, RW5] | One dynamic term only: **fear memory**. An animal that survives an attack fears that lineage ×2 for 30 sim-s. No player reputation, because the player has no body in the world | Cut reputation; cheap prey "learning" |
| P6 | **Individuals differ** | Personality from ID: bravery, aggression, dominance, energy, sociality [RW6] | 3 behaviour genes (boldness, sociality, wanderlust) weight the utility loop. They mutate, so selection acts on behaviour too. Shoals and packs emerge from sociality + fear | Shoals (Atlas R10) without authored flocking per species |
| P7 | **The sim continues where you aren't looking** | Off-screen creatures stay alive, in an "abstracted" mode [RW1, RW5] | All 3,000 agents tick in a Worker. Off-camera agents skip pose and IK. ⏩ = every agent off-camera. A pre-evolved menagerie is the same thing done before the demo | Q6 perf, team OQ1 (menagerie), conflict 7 (⏩) |
| P8 | **Behaviour beats graphics for perceived life** | Procedural animation made predators look "frustrated" without scripting [RW7] | Spend render budget on **intent tells** (head tracks target, crouch while stalking, sprint while fleeing, huddle in storms) before skin detail. Cut order: FABRIK → skin detail, never intent | README §4.7 risk 2 cut order |
| P9 | **Chaos is a feature; tune by re-running** | Region run 15–20× to find trouble spots; "dice rolls" [RW1] | Randomised storm period (±30%). Pinned seeds for the demo only. Tuning is many headless seeds, not hand-placed events. Cut every midwife | Q5, team OQ4 (demo mode), §5 cuts |

### 1.3 Sources

- [RW1] C. Priestman, "Crafting the complex, chaotic ecosystem of *Rain World*", Gamasutra / Game Developer, 27 Mar 2017. `gamedeveloper.com/design/crafting-the-complex-chaotic-ecosystem-of-i-rain-world-i-`. Quotes taken from a fetch on 2026-11-07.
- [RW2] Rain World Wiki (Miraheze), "Rain". `rainworld.miraheze.org/wiki/Rain`. Fetched.
- [RW3] Rain World Wiki, "Creatures" (dens, refill, relocation). Fetched.
- [RW4] Rain World Wiki, "Lizards" (relationships, rivalry, taming, packs). Fetched.
- [RW5] Rain World Wiki, "Scavenger" (relationship intensities, reputation, abstracted behaviour). Fetched.
- [RW6] Rain World Wiki, "Personality". Fetched.
- [RW7] Wikipedia, "Rain World" (citing Priestman 2017; Lemon, GamesRadar+ 2016; Waypoint 2017). Fetched.
- [RW8] J. Jakobsson & J. Therrien, "Animation Bootcamp: *Rain World* Animation Process", GDC 2016 (GDC Vault 1023475). Title verified, talk not watched.
- The TIGSource devlog (topic 25183) returned 403 and was not read. Code-level claims (relationship enum, `AbstractCreature`) are tagged `[recalled]`.
- Ecology additions in this doc, all `[PEER, recalled, unverified]`: Connell 1978 (intermediate disturbance, *disputed*), Lindstedt & Boyce 1985 (fasting endurance ∝ M^0.25), Murdoch 1969 (prey switching), Thingstad & Lignell 1997 ("kill the winner"). Add them to Q7's verification list.

---

## 2. Answers

Format for each: **Decision**, then Why, Cost (S < 2 h, M 2–5 h, L > 5 h of one dev), Honest declaration, Test, and Fallback.

### Q1 (§10.1). Does the niche table break the strider monoculture without competitive exclusion inside a slot?

- **Decision:** adopt the niche table's **producer half only**. The dials compute P, the channel shares and ε (§9.3 items 1–3), and these size each channel's finite, exclusive food pool. Levels, `massScale`, `targetN`, apex pooling and `role` are **no longer inputs**. They become a displayed *forecast* ("the ecologist expects 10 niches"). Exclusion inside a slot is handled by three emergent forces, not more table:
  - **(a) kill-the-winner:** predators are relationship-driven, so they hit the commonest edible body most often. This is prey switching.
  - **(b) the Storm** as periodic disturbance.
  - **(c) rival displacement** at shared shelters.
- **Why:** round 2's monoculture came from one oversized pool (canopy 0.6 K). The table's Light-dependent canopy share (.28 Earth-ish, .105 dusk) fixes the sizing with ecology, not with a hand-tuned number. Making levels emergent keeps P2: the table must never "know" a hunter slot exists.
- **Cost:** S for the producer equations, M for the forecast overlay and the comparison.
- **Declare:** "Your dials decided how much food there is, and where. Evolution decided who eats it" (§9.8, kept).
- **Test:** largest basin ≤ 40% of animals in 5/5 presets (round 2: 34–76%). Forecast vs emergent channel abundance, Spearman ρ ≥ 0.6. That is DESIGN §1's "easy to predict one step": roughly right, but not exactly.
- **Fallback:** cut canopy to 0.3 K by hand (round 2's untested fix) and keep the old pools.

### Q2 (§10.2). Can size payoffs beat the M^0.25 generation penalty in 1,300 sim-s?

- **Decision:** size gets two payoffs, both from rules we already need:
  - **(1) storm fasting endurance.** Reserve capacity ∝ M and upkeep ∝ M^0.75, so a big body survives a storm's no-feeding window longer (endurance ∝ M^0.25, Lindstedt & Boyce 1985 `[recalled]`).
  - **(2) the Jarman–Bell bulk-forage guild** as an access function on the Ground pool (§9.3 item 7).
  - Drop litter ∝ S and the lifespan × heat bonus (recipe 5c). Each adds a rule the Storm already gives us.
- **Why:** P3. One global rule creates size selection, and it scales with the dials: a longer or harsher storm means bigger animals. That gives Heat/Sea a two-step effect: storms → giants → giants need more den space → bigger dens.
- **Cost:** S (fasting is already the energy ledger, during storm ticks).
- **Declare:** none beyond the Storm itself (Rule 7).
- **Test:** median body mass with the storm on ≥ 2× storm off, in frozen and dusk by 1,300 sim-s (round 2 sat at 0.17–0.20 m everywhere). Storm severity ↔ median mass, Spearman ρ > 0.5 across a 5-step sweep.
- **Fallback:** add litter ∝ S (round-2 recipe 5c).

### Q3 (§10.3). Small fliers need a flight cost

- **Decision:** yes. One smooth locomotion ledger:
  - walk ∝ M^0.75·(1 − leg efficiency)
  - swim ∝ drag(liquid)
  - fly `k_fly·(1 − ρ_air)·S^0.5`
  - hover `k_hov·max(0, 1 − buoy·ρ_air)`
  - This **replaces** the hard `buoy ≥ 0.6` gas-bag gate, which round 2 showed is a fitness valley.
  - In a storm, fliers are fully exposed and must land under canopy or in a den. Their storm collisions are with ground predators.
- **Why:** smooth costs let selection walk instead of jump (no `if` gates; "if a rule doesn't make creatures more varied, cut it"). The storm grounding gives fliers a two-step story.
- **Cost:** S.
- **Declare:** coefficients are `[game]`.
- **Test:** float fraction > 0 in Methane, drifters ≥ 50 animals in frozen, small fliers ≥ 5% in a thin-air world.
- **Fallback:** seed one buoyant founder lineage in thick-air worlds (recipe 5a), with a seed note on the card.

### Q4 (§10.4 and §9.4). Apex at N ≈ 1: honest rarity, a ~3× mass ratio, a bigger cap, or a refuge?

- **Decision:** **honest rarity, and the apex is emergent.**
  - No authored 10× (or 3×) mass step, because predation is gape-limited, so the realised predator/prey ratio comes out of evolution. This matches Brose 2006: real ratios vary and are often < 1 for packs.
  - No refuge. Cap stays 3,000.
  - "Apex" is a *label*: a lineage that Eats a lineage that itself Eats animals.
  - Lifespan ∝ M^0.25 already makes a large hunter K-selected.
  - When the last apex dies, its food (hunters) goes unclaimed, and the empty niche re-opens.
- **Why:** Rain World's top predators are rare and dramatic, and rarity is the point. A refuge or a cap raise just to keep N ≥ 4 would be steering. The apex flickering in and out ("the last violet hunter died; 6 generations later a new one rose") is the most Rain-World-like beat in the whole sim, and it costs nothing.
- **Cost:** S (it's a classifier over the relationship cache).
- **Declare:** on the card: "1–3 apex animals is what this much food can feed."
- **Test:** in dusk, an apex is alive ≥ 30% of sim-time and re-emerges after an extinction at least once in 3 seeds. In Earth-ish, the apex absent ≥ 80% of the time matches the forecast.
- **Fallback:** if dusk never holds an apex, raise the cap to 5,000 *only if* Q6's bench allows. Otherwise ship without the apex and say so.

### Q5 (§10.5). Generation compression (~4 sim-s generations)?

- **Decision:** **adopt** as declared time compression ("a young world lives fast"). Keep ⏩ ×40 real ticks as well.
- **Why:** more generations per demo second means more of the rules' consequences actually play out on screen. It also makes the storm read as *seasons* under ⏩. It lets us drop σ ×2.5 toward ×1.5, so bodies are less noisy and lineages more readable.
- **Cost:** S (one constant on maturation and budding).
- **Declare:** in the honesty box next to σ ×2.5.
- **Test:** one-body legs + horns + plates at ≥ 5% by ≤ 400 sim-s (round 2: 601–863), with ≥ 1,500 animals throughout.
- **Fallback:** ×40 alone, plus ×5 constant before 2:00.

### Q6 (§10.6). Is 0.3 µs per agent-tick real in JS (×40 Worker, 3k agents)?

- **Decision:** **measure it first.** A JS microbench at H1–2: the SoA loop + 64² grid + lineage-pair relationship cache (≤ 40 lineages → ≤ 1,600 pairs, refreshed every 2 s) + utility argmax over ≤ 8 neighbours.
  - P7 LOD: agents outside the frustum skip pose, IK and skin uploads.
  - During ⏩ no per-agent render data is written at all. One census and event stream goes out every 0.5 s.
- **Why:** the Storm and the relationships add per-tick work. We need the number before we commit to cap 3,000, since the apex (Q4) and the monoculture fix depend on the cap.
- **Cost:** S.
- **Declare:** none.
- **Test:** pass ≤ 0.5 µs per agent-tick (2.4 ms per frame at ×40 / 3k), Chrome, M-series.
- **Fallback:** cap 2,000 + 2 lineages per relationship refresh slice + menagerie kill switch.

### Q7 (§10.7). Verify recalled sources before slides

- **Decision:** **no slide cites a `[recalled]` source.** A scout spends 30 min with Crossref DOIs on Lindeman, Damuth, Brose, Post, Rooney, Jarman–Bell, Goldbogen, the Sims/Cheney/Lenski parameters, and this doc's four (Connell, Lindstedt & Boyce, Murdoch, Thingstad). The Rain World quotes on slides use [RW1] only, which is verified.
- **Cost:** S.
- **Fallback:** slides say "ecologists observe…" without a citation.

### Round-2 failure: hunters vanish at medium Hunger

- **Decision:**
  - The hunt utility is `Eats intensity × p(catch) / distance`, with p(catch) from speed and size, minus Afraid of anything nearby.
  - The Hunger dial raises the hunger drive, so hungrier hunters accept riskier prey (P1).
  - Raise the gape weapon to `0.5 + 1.5·gape` (recipe 4).
  - Keep inducible armour **proportional** (0.4·Hunger·local hunter density). Do *not* add the `Hunger > 0.6` gate, which is an `if` that hides the dial's middle range.
  - The Storm supplies the missing encounter rate: prey crowd at shelters, and hunters learn nothing; they just score den mouths high because prey density is high there.
- **Why:** P3 + P2. Hunting becomes worth it because of *where everyone is*, not because of a tuned payoff.
- **Cost:** M (utility loop, shared with Rule 4).
- **Test:** a hunter tier of 5–35% of animals for ≥ 50% of sim-time in ≥ 4/5 presets, including rhino (H .55). Predation events within 2 cells of shelter ≥ 2× more frequent during storms than in calm.
- **Fallback:** add the H > 0.6 armour gate (recipe 4, untested).

### Round-2 failure: rhino-lizard is "formed" in 1/5 presets

- **Decision:** don't tune for it directly. With the storm, bulk forage and plates that resist acid storms, the rhino-lizard should *pay* in Water/Acid + medium Hunger. Basins keep the look-only κ 0.5, activated by occupancy.
- **Test:** formed in ≥ 2/5 presets.
- **Fallback:** discovery plate #2 shows the largest real animal (already the plan).

### Emergence README §5 conflicts (still awaiting sign-off) and §6 team questions

| Item | Decision (proxy) | Why / principle | Cost | Fallback |
|---|---|---|---|---|
| C1 world-gen niche species vs genome flora | **Accept** the additive `MeasuredState` and backdrop-only niche flora | Foreground must be emergent. Backdrop is declared render-only | M | Keep world-gen flora in the foreground at low density |
| C2 stain colours | **Accept** the world-gen constants + methane tholin mix. Update Atlas §6 | Already built and calibrated. Not an emergence question | S | — |
| C3 2D vs 3D sim | **Accept** a 2D sim with render-only altitude | The Storm and shelter fields are 64² grids. 3D adds cost, not rules | — | — |
| C4 "nothing walks" | **Accept** "walk on land, swim in liquid, float in thick air, chosen by the ledger" | The mode is selected, not authored (Q3) | S (ART edit) | — |
| C5 where atoms live | **Accept** CPU 3–4k. GPU bonding is stretch | Prelude rules stay small | — | — |
| C6 what the pixel is | **Accept** a Spark atom the player clicks to ignite | — | — | — |
| C7 what ⏩ means | **Accept, strongly:** ⏩ = more real ticks. Geologic gain on deposition only, declared | P7 | — | Menagerie |
| C8 eco-01 tall horned figures | **Accept** small horned walkers + monolith flora | Don't bend R6 for one pin | S | — |
| C9 tilt-shift | **Accept** as recommended | — | — | — |
| OQ1 pre-evolved menagerie | **Accept as kill switch only.** Wording: "Evolved offline by these same rules under your dials", shown whenever it loads | P7: it is the abstract sim run earlier. Not acceptable as the default path | M (bake per preset) | — |
| OQ2 / OQ3 | = C1, C4, C2 above | | | |
| OQ4 demo mode | **Presenter-driven dial moves on a pinned seed.** Rehearse 15–20 runs per seed (P9). Auto-pull off | Dial moves *are* the disturbance that shows two-step surprise. Autoplay hides the player's agency | S | Pinned autoplay with narration |
| OQ5 who is D1 | **Caden owns D1 (Life)**, plus the Storm and the relationship cache. **This is the owner's call; the agent only recommends** | D1 is where emergence lives, and the owner's goal is emergence | — | The most sim-minded dev, with Caden reviewing the round-3 numbers |
| OQ6 Hunger dial | **Keep it.** Hunger = the gain on every animal's hunger drive (P1), which also scales ε (§9.3) | It is the only dial with a 1-tick behavioural read (DESIGN "See"). Merging it into Light kills the "gentle dark world" | — | — |

---

## 3. The minimal rule set (12)

Each rule must produce a behaviour none of the others produce (DESIGN §1: "if a rule doesn't make creatures more varied or more readable, cut it"). Rows marked ★ are new relative to round 2.

| # | Rule | One step (predictable) → two steps (surprise) | Source |
|---|---|---|---|
| 1 | **Food from the dials.** P = f(Light, Heat). Channel shares (Water, Air, Canopy, Ground, Dens) from Sea, ρ_air, Light, Si·O and Time size finite producer pools, grown by L-system flora. Corpses refill soil nutrient | Brighter → more plants → more grazers. Then: grazers peak and crash, nutrient pulses come back as flora rings | REPORT §9.3 (Lindeman), F §7 |
| 2 | **Everyone pays to live.** Upkeep ∝ M^0.75 × rate(Heat) + the trait ledger (plates, horns, eyes, glow, gas). Energy 0 = death | Hot → hungry faster. Then: hot worlds run small and dark (burn-out) | Kleiber, F §3.4 |
| 3 | **What you can eat is your body.** Pool access = trait functions (swim, limbLen·S, buoy, si·o, bulk M). Animal prey edible if `gape·S > S_prey·(1 + plates + 1.5·horn)` | Long legs → canopy. Then: canopy browsers become the commonest prey | Round 2 niches, notes/02 |
| 4 | ★ **Hungry and afraid (one utility loop).** Each tick pick max over {forage, hunt j, flee j, go home, rest, bud}. Utility = drive × intensity / distance. Hunger dial = gain on the hunger drive. 3 behaviour genes (boldness, sociality, wanderlust) weight the terms | Hunger ↑ → chases within 1 tick. Then: hungry hunters attempt big prey and some get hurt | P1, P6 [RW1, RW6] |
| 5 | ★ **Relationships from bodies.** For each lineage pair: Eats = canEat·energy, Afraid = canBeEaten·(1 + fear memory), Rival = pool-access overlap × shared shelter, Kin = same lineage × sociality, else Ignore. Cached every 2 s. Fear memory ×2 for 30 sim-s after surviving an attack | A new armoured mutant is instantly "ignored" by hunters. Then: hunters switch to the next commonest prey (kill-the-winner), and shoals form around kin out of fear | P2, P5 [RW4, RW5], Murdoch 1969 |
| 6 | ★ **Home and shelter.** A per-cell shelter field = max(stone, canopy cover for bodies under canopy height, liquid depth for swimmers). Each animal keeps a home cell (best shelter near birth, re-picked if lost). Builders (si·o) deposit stone, and stone is shelter | Builders make stone. Then: stone becomes dens, dens get fought over, more builders, spires rise | P4 [RW3], F §4 |
| 7 | ★ **The Storm.** A global cycle with period ~45 sim-s ±30% (random, P9) and ~8 sim-s duration, scaled by rate(Heat). The sky darkens 5 sim-s before. During it: exposure damage ∝ (1 − shelter)·severity(Sea)·(1 − plates·resist(Sea)), and no foraging outside shelter. Sea flavour: Water floods low ground, Acid burns unplated Si, Methane is a cold snap (hits small bodies), Ammonia is dark (vision → 0) | Storm comes → everything runs home (readable in 3 s). Then: hunters wait at den mouths, big bodies outlast fasts (size selection), acid storms pay for plates, small fliers get grounded and eaten | P3 [RW2], Connell 1978, Lindstedt & Boyce 1985 |
| 8 | **Bud with mutation.** Bud when energy > threshold. Offspring cost ∝ M. Generation time ∝ M^0.25 (compressed, Q5). σ ×2.5 always on. Lineage id is inherited, and new species = basin/lineage split | More food → more babies. Then: drift opens new bodies | F §3.4, round 2, notes/01 |
| 9 | **Bodies grow from genes.** `develop(G, comp, dials)`: chemistry grammar (Si facets, C curls, O glow), plasticity (TSR by medium, eye regression in the dark), basins snap *look* genes only (κ 0.5, by occupancy) | Recipe → Si gives cyan hex newborns in 2 s. Then: Si in Water dissolves unless plated | F §3.3, round 2 |
| 10 | **Move by medium.** Smooth walk/swim/fly/hover costs (Q3). No gates | Thick cold air → hovering is cheap. Then: drifters, and maybe whales, through bulk filter | Q3, round 2 recipe 5b |
| 11 | **Death becomes ground.** Si+O corpses → stone deposits (terrain, shelter). C corpses → nutrient/gas | Many deaths → reefs. Then: reefs become shelter, shelter reshapes who survives storms | F §7, A §4.1 |
| 12 | ★ **Same rules everywhere.** Off-camera agents and ⏩ run identical ticks with render skipped. The menagerie is the same rules run before the demo, declared | Nothing pauses when you look away. Then: you return to a world that changed without you | P7 [RW1, RW5] |

**Why this should be complex:** rules 5–7 close two loops that round 2 lacked.
- **Space loop:** storm → shelter → builders → stone → more shelter.
- **Predation loop:** common prey → targeted → rare → hunters switch.

Both run off the dials, so each dial has a predictable first effect and an unpredictable second one: Light → food → grazers → hunters → den crowding.

---

## 4. What to cut

| Cut | From | Why it adds rules without emergence | Replaced by |
|---|---|---|---|
| Hox midwife, "grazer tasted meat" | F §7, §10 | Tested, no effect (round 2) | — |
| Stress mutagenesis bursts after dial moves | F §10 | σ ×2.5 always on already. Bursts are a second mutation rule | Rule 8 + Q5 |
| Trophic levels, `massScale`, `targetN`, apex realm pooling *as inputs* | REPORT §9.2–9.3 | They steer outcomes and invite authored species | Rules 3 and 5. The table becomes a forecast |
| `role` field and per-role FSM state unlocks | REPORT §9.6 | Per-niche behaviour is authored. Rain World's lesson is one motivation set per creature | Rule 4. Role is *read* from diet over the last 60 s |
| Apex refuge; cap raise just for the apex | §9.4 options | Steering to protect a tier | Honest rarity (Q4) |
| Hard gates: `buoy ≥ 0.6`, `Hunger > 0.6` armour, `heat < 0.45` arch fusion | round 2, F §10 | `if` thresholds create valleys and hide dial ranges | Smooth costs (Q3); keep the arch rule only as declared terrain |
| Hunter-overshoot "pore refuge" as a separate rule | F §7 | Duplicates shelter | Rule 6 (one shelter field) |
| Seeded buoyant founder lineage | round 2 recipe 5a | A seed | Fallback only |
| Litter ∝ S, lifespan × heat bonus | round 2 recipe 5c | Two size rules where one global pressure suffices | Rule 7 fasting |
| Basins activated by authored affinity | round 2 | Already shown to fail and to steer | By occupancy (kept) |
| Reputation / player-opinion systems | Rain World | No player body in our world | Fear memory only (Rule 5) |
| A separate day/night cycle | (tempting) | Two cycles muddy the read | One Storm. Light stays a level dial |
| Per-species flocking, shoaling or pack code | Atlas R10 wording | Should emerge | Sociality gene + fear (Rules 4–5) |

Keep, even though authored: `develop()` grammar, basins (look-only), the trait ledger, the discovery-plate classifier, geologic gain under ⏩ (declared). These give readability, not behaviour.

---

## 5. Next experiment: round 3 headless spec

**Where:** extend `research/body-plans/prototype/f_ecology.py` with an `r3=True` flag (Python toy, same as rounds 1–2), then port the rule set to a TS/Vitest skeleton only once it passes. Budget about 3 h of build and 1 h of sweeps.

**Configs (5 presets × 3 seeds × T = 1,300 sim-s, cap 3,000):**

| Config | Contents | Purpose |
|---|---|---|
| `r2b` | round-2 baseline | control |
| `+food` | Rule 1 producer pools from §9.3 replace the hand pools | Q1 alone |
| `+rel` | `+food` + Rules 4–5 (utility, body-derived relationships, fear memory, behaviour genes) | hunters, kill-the-winner |
| `+storm` | `+rel` + Rules 6–7 (shelter field, home, Storm) | size, collisions, monoculture |
| `full` | `+storm` + Q3 smooth locomotion + Q5 generation compression | the full proposed set |
| ablations | `full` minus each of Rules 4, 5, 6, 7 and 10 | every rule must earn its place |
| honesty | `full` with the ledger flattened (basins fill by volume), and with access functions shuffled (different basins fill) | §9.8 guards |

**Measures and pass bars (`full` must pass; each ablation should fail at least one bar, or that rule is cut):**

| # | Measure | Pass bar | Round-2 value |
|---|---|---|---|
| M1 | Largest basin share | ≤ 40% in 5/5 presets | 34–76% |
| M2 | Basins with ≥ 5% of animals | ≥ 4 in ≥ 4/5 presets | 2–3 |
| M3 | Median body mass, storm on/off (frozen, dusk) | ≥ 2× | 1× (no size selection) |
| M4 | Hunter tier 5–35% of animals | ≥ 50% of sim-time in ≥ 4/5 presets, incl. rhino | dusk + frozen only |
| M5 | Storm collision index: predations within 2 cells of shelter, storm vs calm | ≥ 2× | n/a |
| M6 | Apex present (dusk) | ≥ 30% of time, ≥ 1 re-emergence in 3 seeds | ≈ 1 animal (forecast) |
| M7 | Forecast vs emergent channel abundance | Spearman ρ ≥ 0.6, but ≤ 0.95 (the sim must be able to surprise the forecast) | n/a |
| M8 | Bestiary distance | between presets ≥ 0.6, within ≤ 0.4 | 0.59–0.63 / 0.18–0.22 |
| M9 | One-body legs + horns + plates ≥ 5% | ≤ 400 sim-s in ≥ 2 presets | 601–863 |
| M10 | Stability | no extinction; N ∈ [1,500, 3,000] after 100 sim-s | stable |
| M11 | Kill-the-winner signature | corr(prey basin share, its per-capita predation rate) > 0.3 | n/a |
| M12 | Drifters (frozen) / small fliers (thin-air world) | ≥ 50 / ≥ 5% | ≤ 13 / not modelled |
| M13 | Readability: storm onset → ≥ 60% of animals moving homeward within 3 sim-s | pass | n/a |

**JS bench (parallel, Q6):**
- 3,000 agents in a Worker, Rules 2–7 at dt 0.25.
- Pass: ≤ 0.5 µs per agent-tick, with the relationship cache refresh ≤ 1 ms.

**Report back:**
- One table: bars × configs.
- The ablation verdict per rule: keep or cut.
- The census per preset.
- Three named emergent events found in the logs (e.g. "den siege", "apex re-rise", "storm-grounded fliers"). These are the demo's discovery beats.

**Decision rule:** if `full` passes M1, M3, M4 and M10, Rules 4–7 go into the D1 build plan at H4–8. If only `+rel` passes, ship without the Storm and drop Rule 7. If neither does, fall back to round 2 plus canopy at 0.3 K, with the menagerie as kill switch.
