# Emergence decisions: answering the open questions (Rain World lens)

> **Proxy decisions by an agent acting for the owner. Override any line.**
> 2026-11-07. **Revised the same day after an owner override: no Storm, and no global or periodic cycle of any kind** (no day/night, no seasons-as-rule). The jobs the Storm did are now done by space, chemistry and predation.
>
> **Third revision (owner rulings relayed 2026-11-07, see `CLAUDE.md`):** glow comes from darkness on both worlds, not oxygen (silicon glow is chemiluminescence, `assumption: true`). The animal cap is **1,024**. Terrain L0 is un-parked. **Gene budget (owner ruling):** 15 genes = 12 body + the 3 climate genes in `population.ts`.
>
> **Second revision, same day: the owner's 10 simplicity guardrails are applied throughout (§G).** Limits: 12 rules, 12 genes, ≤ 25 sim constants in `sim/constants.ts`, no preset code, read-only render, and a `→ NOT_NOW` parking lot at the end of §4.
>
> Goal (the owner's words): *"as emergent as possible, so simple rules create very complex ecosystems, a bit like how Rain World's ecosystems work."* Where options tie, the more emergent one wins, as long as it stays buildable in 24 h and honest (seeded or authored things are declared). Nothing here has been built or run. Every constant is `[game]` until a headless run says otherwise.

Inputs: `research/body-plans/REPORT.md` §9–10, `EXECUTIVE_SUMMARY.md`, `notes/04-time-to-trait.md` (round 2), `docs/emergence/README.md` §5–6, `F-body-plan-first.md` §7 and §10, `WORLD_ATLAS.md` §7, `DESIGN.md` §1. Source tags:
- `[verified]`: has a DOI in `research/body-plans/data/biology.json`
- `[recalled]`: from memory, unverified. All recalled sources go on Q7's list.

---

## 0. The answer in five lines

1. **Relationships, not roles.** Who eats, fears, ignores or contests whom is *computed from bodies* (size × gape vs defence). It is never written per species or per niche slot, so a mutant joins the food web the tick it is born.
2. **Chemistry is food.** C, Si and O are separate limiting nutrients in every cell of one 64² grid. Bodies need them in different ratios: Si for plates and spicules, C for soft tissue, O for metabolism. Under Tilman's resource-ratio rule (R*), different body chemistries win at different supply ratios, so they coexist instead of one winning.
3. **Place, not clock.** Encounters concentrate at food hotspots and refuges: the watering-hole effect plus a landscape of fear. Stone dens are worth having because they are predator refuges and microclimates.
4. **The niche table sizes food, nothing else.** The apex is honest rarity and emergent: 1–3 animals, which can die out and re-evolve.
5. **Same rules everywhere.** Off-camera animals and ⏩ run the same sim with rendering skipped. A pre-evolved menagerie is only a declared kill switch.

---

## 1. Rain World: what it does, and the principles we adopt

### 1.1 Research summary (≤ 5 min; sources in §1.3)

- **Creatures live for themselves.**
  - Jakobsson: creatures "exist there for themselves", and each is built to "find food and move around and get back to its home before the night comes" [RW1].
  - Therrien: "outside of your frame they're all still alive … hunting food, … getting into territorial fights" [RW1].
  - The aim: "the rat in Manhattan", with predators that are "hungry animals" [RW7].
- **A relationship table with graded intensities.**
  - Lizards *eat* scavengers, centipedes and eggbugs, *fear* vultures and leviathans, are *uncomfortable* with leeches, and *territorial* to other lizards at a low value [RW4].
  - Scavengers fear Daddy Long Legs at 1.0, King Vulture 0.95, Vulture 0.75 and Lizard 0.5, ignore batflies at ≤ 0.1, and treat their own kind as pack at 0.5 [RW5].
  - The type enum (Eats, Afraid, Ignores, Uncomfortable, StayOutOfWay, Attacks, Rivals, AggressiveRival, Pack, SocialDependent, PlaysWith, Antagonizes) is `[recalled]` from the modding community.
- **Dynamic relationships.**
  - Lizard opinion moves with feeding and rescue, then drifts back toward 0 [RW4].
  - Scavenger reputation runs from −100 to 100, changes by at most ±50 per cycle, and losses are multiplied by the number of witnesses [RW5].
  - Lizard rivalry starts with a hiss, and a fight ends when one leaves, dies, dens, or gets distracted [RW4].
- **Personality from ID**: aggression, bravery, dominance, energy, nervousness and sympathy. Dominance picks the pack leader [RW6].
- **Dens.**
  - Most creatures have an assigned den, which is both spawn and retreat. Dens refill after a death [RW3].
  - Lizards drag prey home and share creature-only tunnels [RW4]. Places and chokepoints concentrate encounters.
- **The rain cycle** is Rain World's global pressure: random 6.5–13 min cycles ending in lethal rain, with creatures retreating to dens [RW2]. **We studied it and the owner rejected it** (P3).
- **Off-screen simulation.** Creatures stay alive outside the frame [RW1]. Scavengers behave differently "while abstracted" [RW5]. `AbstractCreature`/`AbstractRoom` is `[recalled]`.
- **Procedural animation** is "a bunch of points in space … connected at certain distances" [RW1]. It was necessary for a believable ecosystem, and it gave predators unscripted "frustration" [RW7, RW8].
- **Chaos is the point.** "We wanted to maintain the chaos of the game." A region was run 15–20× to tune it. Outcomes were "dice rolls" [RW1].

### 1.2 Principles adopted

| # | Principle | How Rain World does it | How it maps to our sim | Decides |
|---|---|---|---|---|
| P1 | **Every creature is hungry and afraid** | Find food, get home [RW1]. Hungry predators [RW7] | One shared utility loop for all animals. The Hunger dial is the gain on the hunger drive. No niche-specific states | Hunter collapse; cut §9.6 roles |
| P2 | **Relationships, not scripts** | Per-species Eats/Afraid/Ignore/Rival/Pack with 0–1 intensities [RW4, RW5] | **Derived from bodies** per lineage pair, cached every 2 s. Unauthored species get relationships for free | Q1, Q4, hunters |
| P3 | ~~A global cycle forces collisions~~ **REJECTED by owner, 2026-11-07** | Lethal rain cycle drives everything to dens [RW2, RW3] | **Not adopted.** No storm, day/night or seasonal rule. Its jobs moved to P3′, Rule 2 and Rule 4 | — |
| P3′ | **Place forces collisions** | Fixed dens, shared tunnels and chokepoints concentrate encounters [RW3, RW4] | Food hotspots (light gaps, liquid edges, rich nutrient cells) and refuges (stone, canopy, deep liquid). The watering-hole effect plus a landscape of fear | Hunter persistence, size, monoculture |
| P4 | **Home is a place, and places are contested** | Assigned dens, prey carried home [RW3, RW4] | A home cell per animal. Builders' stone *creates* refuges, so stone is real estate | Den channel, builders, terrain feedback |
| P5 | **Relationships move** | Opinion and reputation shift, then decay [RW4, RW5] | Only **fear memory**: surviving an attack doubles fear of that lineage for one generation (derived, no constant). No reputation, because the player has no body | Cut reputation |
| P6 | **Individuals differ** | Personality from ID [RW6] | One behaviour gene (sociality). Boldness is *derived* (own defence vs threat), and so is range (from leg length and cost of transport) | Shoals and packs emerge |
| P7 | **The sim continues where you aren't looking** | Abstracted creatures [RW1, RW5] | All agents tick in a Worker. Off-camera agents skip pose. ⏩ = everyone off-camera. The menagerie = the same sim run earlier | Q6, OQ1, C7 |
| P8 | **Behaviour beats graphics** | Procedural "frustration" [RW7] | Spend render on intent tells (head tracks target, stalking crouch, flee sprint, huddling at refuges) before skin detail | Cut order |
| P9 | **Chaos is a feature; tune by re-running** | 15–20 runs per region [RW1] | Many headless seeds. Pinned seeds only for the demo. No midwives | Q5, OQ4, §4 |

### 1.3 Sources

- **[RW1]** C. Priestman, "Crafting the complex, chaotic ecosystem of *Rain World*", Gamasutra / Game Developer, 27 Mar 2017. Fetched; quotes verified.
- **[RW2]–[RW6]** Rain World Wiki (Miraheze) pages "Rain", "Creatures", "Lizards", "Scavenger" and "Personality". Fetched 2026-11-07.
- **[RW7]** Wikipedia, "Rain World" (citing Priestman 2017; Lemon, GamesRadar+ 2016; Waypoint 2017). Fetched.
- **[RW8]** Jakobsson & Therrien, "Animation Bootcamp: *Rain World* Animation Process", GDC 2016. Title verified, talk not watched. The TIGSource devlog returned 403.
- **Ecology `[verified]`** (biology.json): Kleiber 1932, Gillooly et al. 2001, Brown et al. 2004, Atkinson 1994, Forster, Hirst & Atkinson 2012, Verberk & Atkinson 2013, Chapelle & Peck 1999, Pontzer 2007, Goldbogen et al. 2017, Agrawal et al. 1999, Tollrian 1995, Raven 1983, Massey & Hartley 2009, Moran et al. 2015, Nilsson et al. 2012, Warrant & Locket 2004, Martini & Haddock 2017, Vermeij 1977.
- **Ecology `[recalled]`:**
  - resources and stoichiometry: Tilman 1977/1982 (resource ratio, R*), Sterner & Elser 2002 (ecological stoichiometry)
  - fear and refuges: Laundré et al. 2001 (landscape of fear), Brown 1988 (giving-up density)
  - predation: Paine 1976 (size refuge), Murdoch 1969 (prey switching), Thingstad & Lignell 1997 (kill the winner)
  - size and movement: Jarman 1974 / Bell 1971, Lindstedt & Boyce 1985 (fasting endurance ∝ M^0.25), Taylor et al. 1982 (cost of transport ∝ M^−0.3), Purcell 1977 (low Reynolds number)
  - food webs and diversity metrics: Dunne et al. 2002 (connectance), Laliberté & Legendre 2010 (FDis)
  - solvent properties in §B (CRC-style handbook values)

---

## 2. Answers

Format for each: **Decision**, then Why, Cost (S < 2 h, M 2–5 h, L > 5 h of one dev), Honest declaration, Test, and Fallback.

### Q1 (§10.1). Does the niche table break the strider monoculture without exclusion inside a slot?

- **Decision:** adopt the table's **producer half only**. The dials set P and ε (§9.3 items 1, 3). Channel shares *emerge* from the grid (Rule 1: light, canopy shading, liquid cells, ρ_air, stone cells). These size each channel's finite, exclusive pools. Levels, `massScale`, `targetN`, apex pooling and `role` become a displayed *forecast*, not inputs. Exclusion inside a slot is resisted by three mechanisms:
  - **(a) resource-ratio competition** (Rule 2): Si-heavy and C-heavy bodies have different R* on the same pool `[recalled]` Tilman.
  - **(b) predator-mediated coexistence, kill-the-winner:** relationship-driven hunters hit the commonest edible body most `[recalled]` Murdoch, Thingstad.
  - **(c) spatial partitioning:** hotspots and refuges are patchy, so one body can't be best everywhere.
- **Why:** round 2's monoculture came from one oversized pool (canopy 0.6 K). Canopy shading (Beer–Lambert) makes the canopy's share track Light, as §9.3's .28 / .105 shares do, and fixes the sizing with physics and no constant. Keeping levels emergent keeps P2.
- **Cost:** S for the producer equations, M for the forecast overlay.
- **Declare:** "Your dials decided how much food there is, and where. Evolution decided who eats it."
- **Test:** M1, M2, M7 and §A.
- **Fallback:** canopy 0.3 K by hand (round 2's untested fix). This costs a constant, so one other must go (one-in-one-out, §G).

### Q2 (§10.2). Can size payoffs beat the M^0.25 generation penalty in 1,300 sim-s?

- **Decision:** five size payoffs. None is a cycle, and each comes from a rule we need anyway:
  1. **Jarman–Bell bulk forage.** Silica-rich flora is tough forage. Silica lowers digestibility (`[verified]` Massey & Hartley 2009). Net digestion of tough forage ∝ retention time ∝ M^0.25 `[recalled]` Jarman–Bell. The bulk share is *derived* from flora Si, so it needs no constant.
  2. **Filter-feeding scaling** in liquid and thick air. Engulfment capacity outscales metabolism `[verified]` Goldbogen 2017. Access function on Water and Air.
  3. **Gape-limited predation → size refuge.** Prey bigger than a hunter's gape are safe `[recalled]` Paine 1976. Under Hunger this selects prey upward and hunters upward after them (escalation, `[verified]` Vermeij 1977). Already Rule 4.
  4. **Patch travel.** Food is patchy because flora depletes locally and light gaps and liquid edges are uneven. Cost of transport per kg ∝ M^−0.3 `[recalled]` Taylor 1982, and per stride ∝ 1/leg length `[verified]` Pontzer 2007. Reserves last ∝ M^0.25 `[recalled]` Lindstedt & Boyce. So big, long-legged bodies cross gaps that starve small ones. This is strongest in dim and sparse worlds.
  5. **Plasticity that selection can amplify:**
     - temperature–size rule by medium (`[verified]` Atkinson 1994, Forster 2012)
     - oxygen–size (`[verified]` Verberk & Atkinson 2013, Chapelle & Peck 1999)
  - Drop the lifespan × heat bonus. Litter size is derived (bud energy ÷ offspring mass), with no r/K gene.
- **Why:** P3′. Size pays where space and predation make it pay, so mass spectra differ by preset (§A).
- **Cost:** S for 1–2, S for 3 (exists), M for 4 (patchiness has to emerge from flora depletion + producer hotspots), S for 5 (exists).
- **Declare:** none new. Coefficients are `[game]`.
- **Test:** M3 (median mass ≥ 2× round 2 in ≥ 3 presets; log10(M95/M5) ≥ 1.5).
- **Fallback:** none in code. If M3 fails, the size beats move to NOT_NOW.

### Q3 (§10.3). Small fliers need a flight cost

- **Decision:** one smooth locomotion ledger, **driven by the medium's physics** (§B):
  - **walk** ∝ M^0.75·(1 − leg efficiency)
  - **swim:** buoyancy ∝ |ρ_body − ρ_liq| plus drag that depends on Reynolds number, set by solvent density and viscosity
  - **fly** `k_fly·(1 − ρ_air)·S^0.5`
  - **hover** `FLY_K·max(0, ρ_body − ρ_air)` (the same constant)
  - This replaces the hard `buoy ≥ 0.6` gate, a fitness valley.
  - Fliers get the patch-hopping payoff: Q2 item 4 favours whoever crosses gaps cheapest.
- **Why:** smooth costs let selection walk instead of jump. The Sea dial becomes physics (density, viscosity), not a flag.
- **Cost:** S (M with the solvent terms).
- **Declare:** coefficients `[game]`, solvent values `[recalled]`.
- **Test:** M12.
- **Fallback:** accept no drifters. Seeding a buoyant lineage would be preset code (guardrail 8), so it goes to NOT_NOW.

### Q4 (§10.4 and §9.4). Apex at N ≈ 1: rarity, a 3× ratio, a bigger cap, or a refuge?

- **Decision:** **honest rarity, and the apex is emergent.**
  - No authored mass step: gape-limited predation lets the ratio evolve (Brose 2006, `[recalled]`).
  - No refuge. Cap stays 1,024 (owner ruling: never fewer than 1,000, no lower tier).
  - "Apex" is a label for a lineage that Eats a lineage that Eats animals.
  - Lifespan ∝ M^0.25 makes it K-selected. When it dies, its food goes unclaimed until something re-evolves to eat it.
- **Why:** Rain World's top predators are rare and dramatic. Protecting N ≥ 4 would be steering. "The last violet hunter died; 6 generations later a new one rose" is free drama.
- **Cost:** S.
- **Declare:** "1–3 apex animals is what this much food can feed."
- **Test:** M6.
- **Fallback:** no apex, and say so. Guardrail 6 fixes the cap at 1,024.

### Q5 (§10.5). Generation compression (~4 sim-s generations)?

- **Decision:** **adopt** as declared time compression ("a young world lives fast").
  - There's no generation-time constant. Generation time emerges from intake (bud at E > 2·M), so compression = scaling `P0` and `B0` together.
  - Guardrail 6 fixes the tick at 20 Hz, so ⏩ ×40 would be 800 ticks/s. Compression lets ⏩ drop to **×15–20** for the same number of generations.
  - Try `SIGMA` 0.075, about ×1.5 instead of ×2.5.
- **Why:** more generations per demo second means more of the rules' consequences reach the screen. Lower σ keeps lineages readable.
- **Cost:** S.
- **Declare:** in the honesty box with σ.
- **Test:** M9 (one-body legs + horns + plates ≥ 5% by ≤ 400 sim-s), with M10 stable.
- **Fallback:** ×40 alone + ×5 constant before 2:00.

### Q6 (§10.6). Is 0.3 µs per agent-tick real in JS?

- **Decision:** **measure first** with an H1–2 microbench. It covers:
  - the SoA loop, the 64² grid, and the per-cell fields (C, Si, O, light, flora, stone: 6 × 4,096 floats)
  - the lineage-pair relationship cache (≤ 40 lineages → ≤ 1,600 pairs, every 2 s)
  - utility argmax over ≤ 8 neighbours with a per-cell risk lookup
  - P7 LOD: off-frustum agents skip pose, IK and uploads. ⏩ writes only a census and an event stream every 0.5 s.
- **Why:** relationships, nutrients and the fear term add per-tick work. The cap decides Q4 and the monoculture fix.
- **Cost:** S.
- **Test:** at 20 Hz, ⏩ ×20 = 400 ticks/s × 3k agents = 1.2M agent-ticks/s. **Pass is ≤ 0.5 µs per agent-tick (≤ 60% of one Worker core).**
- **Fallback:** the declared menagerie. The cap does not move (1,024).

### Q7 (§10.7). Verify recalled sources before slides

- **Decision:** **no slide cites a `[recalled]` source.** A scout spends 30–45 min on Crossref for REPORT's list plus this doc's `[recalled]` items (§1.3), and the solvent constants against a handbook. Rain World quotes on slides use [RW1] only.
- **Cost:** S.
- **Fallback:** "ecologists observe…" with no citation.

### Round-2 failure: hunters vanish at medium Hunger

- **Decision:**
  - Hunt utility = `Eats × p(catch) / distance`. Hungrier hunters accept riskier prey (P1).
  - The gape gene spans 0–2× body size, so the weapon needs no constant (it replaces round 2's `0.5 + 1.5·gape`).
  - Inducible armour stays **proportional** (`INDUCE`·Hunger·local Afraid intensity, `[verified]` Agrawal 1999, Tollrian 1995), with no `H > 0.6` gate.
  - Encounter rate comes from **place**:
    - **(a) watering-hole effect.** Prey concentrate on producer hotspots (light gaps, liquid edges, rich nutrient cells), so hunters patrolling them meet prey above the mean rate.
    - **(b) landscape of fear** (`[recalled]` Laundré 2001, Brown 1988). Prey trade food for safety: their cell utility subtracts risk × (1 − refuge). They over-graze near refuges and under-use open hotspots. That leaves open-ground food for bold or armoured bodies, and hunters at refuge edges.
    - **(c) kill-the-winner** keeps hunters fed by switching prey.
- **Why:** P3′ + P2. Hunting pays because of *where prey must be*, not because of a tuned bonus.
- **Cost:** M (shared with Rule 5).
- **Test:** M4, M5, M13.
- **Fallback:** none. An `if` gate breaks guardrails 1 and 8, so the H > 0.6 armour gate goes to NOT_NOW.

### Round-2 failure: rhino-lizard formed in 1/5 presets

- **Decision:** don't tune for it. In Si-rich Water worlds four things now push the same way:
  - Si supply is high, so Si-plated bodies have a low R* for Si.
  - Water dissolves *unplated* Si (ledger 0.15).
  - Bulk forage pays big bodies.
  - Induced armour plus horns as defence pay under Hunger.
- **Test:** formed in ≥ 2/5 presets.
- **Fallback:** discovery plate #2 shows the largest real animal.

### Emergence README §5 conflicts and §6 team questions

| Item | Decision (proxy) | Why / principle | Cost | Fallback |
|---|---|---|---|---|
| C1 world-gen niche species vs genome flora | **Accept** additive `MeasuredState`, backdrop-only niche flora | Emergent foreground. Backdrop declared render-only | M | World-gen flora in the foreground at low density |
| C2 stain colours | **Accept** world-gen constants + methane tholin mix. Update Atlas §6 | Built, calibrated. Not an emergence question | S | — |
| C3 2D vs 3D sim | **Accept** 2D sim, render-only altitude | Nutrient, refuge and risk fields are 64² grids | — | — |
| C4 "nothing walks" | **Accept** "walk on land, swim in liquid, float in thick air, chosen by the ledger" | Mode is selected by medium physics (Q3) | S | — |
| C5 atoms | **Accept** CPU 3–4k. GPU bonding stretch | — | — | — |
| C6 the pixel | **Accept** the player clicks a Spark atom | — | — | — |
| C7 ⏩ | **Accept, strongly:** more real ticks. Geologic gain on deposition only, declared | P7 | — | Menagerie |
| C8 eco-01 | **Accept** small horned walkers + monolith flora | Don't bend R6 | S | — |
| C9 tilt-shift | **Accept** | — | — | — |
| OQ1 menagerie | **Kill switch only.** "Evolved offline by these same rules under your dials" whenever it loads. It's a saved state that the director loads, with zero sim code (guardrail 8). **Owner may cut it as a "rescue"** | P7. Not the default path | M | — |
| OQ2 / OQ3 | = C1, C4, C2 | | | |
| OQ4 demo mode | **Presenter dial moves on a pinned seed**, rehearsed 15–20 runs per seed (P9). Auto-pull off | Dial moves are the disturbance that shows the two-step surprise | S | Pinned autoplay + narration |
| OQ5 who is D1 | **Caden owns D1 (Life)** + the relationship cache + the nutrient field. **Owner's call; the agent only recommends** | D1 is where emergence lives | — | Most sim-minded dev; Caden reviews round-3 numbers |
| OQ6 Hunger dial | **Keep.** Gain on every hunger drive (P1), scales ε (§9.3) and plant intake | The only 1-tick behavioural read. Merging with Light loses "gentle dark worlds" | — | — |

---

## G. Simplicity guardrails (owner, applied)

| # | Guardrail | How this doc applies it |
|---|---|---|
| 1 | **Rule budget:** ≤ 12 rules, one-in-one-out; each ≤ 2 sentences and ≤ 1 tunable | §3 is audited to 12 rules. Each has ≤ 2 sentences and ≤ 1 free `[game]` tunable. `[sci]` constants have a source and are not free. The removed microclimate, hump, canopy, scarcity and fear-time constants were folded into existing rules or derived |
| 2 | **One of everything** | One utility loop (R5), one relationship function (R6), one `develop()` (R9) and one ledger (R3). No per-species FSM, no basin special cases in the sim |
| 3 | **Derive, don't author** | Roles, relationships, niches, channel shares, bulk forage, boldness, range and litter size are all *derived*. The 7 named basins leave the sim: they become **anonymous look attractors in the renderer**, and names come from a trait-based name generator |
| 4 | **Small genome** | **15 genes: 12 body genes (below) + the 3 climate genes already built in `src/sim/population.ts`** (preferred temperature, tolerance width, and oxygen need on carbon / cold stability on silicon). Owner ruling 2026-11-07. Down from F's 32; the other 20 become derived look or behaviour, or go to NOT_NOW. A new gene costs a removal |
| 5 | **Tunables cap** | 15 sim constants in `sim/constants.ts` (below): 9 `[game]`, 6 `[sci]`. That leaves 10 slots of headroom, and every addition costs one removal. Per-world facts (solvent, air and tissue density) live in each world's config (`life.inputs`), per `CLAUDE.md`'s "science lives in data" rule, and don't count here |
| 6 | **Minimal world state** | One 64² grid. Per-cell fields: C, Si, O nutrient, light energy, flora biomass (mat + canopy), stone, liquid depth (static), derived risk. Fixed 20 Hz tick. **1,024 animals** (owner ruling; never fewer than 1,000, no 512 tier). ⏩ = more 20 Hz ticks per frame |
| 7 | **Feature gate** | A rule or feature ships only if a headless A/B raises a §A variety metric or the readability metric (§5 acceptance rule) |
| 8 | **No cheats, no preset code** | No midwives, no rescues, no `if preset ==`, no seeded lineages. Presets = dial values only. Fallbacks that broke this were removed (Q3, Q4, hunters). The menagerie is flagged for the owner |
| 9 | **Render is read-only** | Eyes drawn, gait/IK, glow shading, flora L-system shapes (from per-cell biomass + comp), basin look-snap, plate age stain, pore glow and the discovery classifier are pure functions of sim state. Nothing visual is read back |
| 10 | **Parking lot** | Every cut or deferred idea is in the `→ NOT_NOW` list at the end of §4. Revisit after H8 |

### G.1 The 12 body genes (all f32 in [0, 1] plus inherited comp {c, si, o}, which is not a gene)

Plus the **3 climate genes** from `population.ts`, used as built: `prefTemp`, `tolerance` (generalists pay upkeep per °C of range), and O need (carbon) / cold stability (silicon). You SEE them as each species' comfort range and visible stress near the slider red zones.

| # | Gene | From F §3.3 | Pays (ledger / R) | Earns | You SEE |
|---|---|---|---|---|---|
| 1 | `size` (log) | g1 | upkeep M^0.75 (R3), slower generations (R8) | size refuge (R4), filter and bulk forage (R4), patch travel | body scale |
| 2 | `segments` | g0 + g5 | mass | high-Re swim efficiency (R10) | worm ↔ serpent length |
| 3 | `limbPairs` (float in [0, 1]; pairs = round(4·g), with a smooth limb-bud gradient below one pair) | g9–g11 | limb mass (R3) | walk cost ↓ (R10) | buds, then legs appear |
| 4 | `limbLen` | g12 | mass ∝ len² | canopy access (R4), cost per stride ∝ 1/len (R10) | stilts, striders |
| 5 | `plates` | g14 (+ g15) | Si and O built at the Rule 2 price, `PLATE_MASS` | bite defence (R4), blocks dissolution (R2) | stone plates |
| 6 | `horns` | g21 (+ g22) | mass | prey defence (R4) | horns (count/curve from comp) |
| 7 | `gape` | g23 | head mass | prey up to 2·gape·S (R4) | jaw size |
| 8 | `diet` t | g24 | plant gain ∝ (1 − t)² | meat gain ∝ t² (convex trade-off) | claws, mouth colour (render) |
| 9 | `eyes` | g19 | `EYE_FRAC` of upkeep at full eyes | vision ∝ light (R5) | eye size; eyeless in the dark |
| 10 | `buoy` | g25 | volume ↑, defence ↓ | body density ↓ → swim/hover cost ↓ (R10) | gas bells, bloated drifters |
| 11 | `glow` | g26 | energy at the B0 price | lure that pays only when light is scarce (R5: grazers seek glow), on **both** worlds. On silicon it's chemiluminescence, `assumption: true` | glow ∝ glow·(1 − light) |
| 12 | `sociality` | g27 | food sharing among kin | risk ÷ (1 + n_kin) (dilution, Hamilton 1971) | shoals, packs |

**Derived, not genes** (render-only unless noted):
- radius profile, symmetry (radial when si high and limbPairs 0), axis, head length/width, joint bias, dorsal rods vs frills (from comp), low-Re cilia fringe (from Re), tail type, eye count (from the `eyes` gene; F §3.3's `eyeCountBias` gene no longer exists), horn count, skin pattern
- in the sim: boldness = defence/(defence + threat), range (from cost of transport), litter size (bud energy ÷ offspring mass), sessile mode (the cheapest mode when moving costs more than filtering)

### G.2 `sim/constants.ts`: all 15

| # | Constant | Default | Tag | Rule |
|---|---|---|---|---|
| 1 | `P0` primary production per cell | 1.0 (scaled to the round-2 K) | [game] | R1 |
| 2 | `DISSOLVE` attack at ε_r = 80 (attack = DISSOLVE·ε_r/80) | 0.15 (tested) | [game]; [sci] direction | R2 |
| 3 | `B0` basal upkeep | round 2's b0 | [game] | R3 |
| 4 | `PLATE_MASS` | 0.15 (tested) | [game] | R4 |
| 5 | `INDUCE` inducible armour | 0.4 | [game]; [sci] Agrawal 1999 `[verified]` | R6 |
| 6 | `REFUGE` shelter strength (catchability and heat buffering) | 0.8 | [game] | R7 |
| 7 | `SIGMA` mutation σ, all genes, every birth | 0.075 | [game] | R8 |
| 8 | `TSR` temperature–size magnitude | 0.6 | [game]; [sci] direction Atkinson 1994 `[verified]` | R9 |
| 9 | `FLY_K` flight/hover scale | tune | [game] | R10 |
| 10 | `KLEIBER` | 0.75 | [sci] Kleiber 1932 `[verified]` | R3 |
| 11 | `Q10` (rate log-compressed) | 2.5 | [sci] Gillooly 2001 `[verified]` | R3 |
| 12 | `EYE_FRAC` | 0.15 | [sci] Moran 2015 `[verified]` | R3 |
| 13 | `EPS0` (ε = EPS0·(1 + 2·Hunger), 6–18%) | 0.06 | [sci] Lindeman 1942 `[recalled]` | R4 |
| 14 | `GEN_EXP` | 0.25 | [sci] Brown 2004 `[verified]` | R8 |
| 15 | `TSR_LAND` | 0.1 | [sci] Forster 2012 `[verified]` | R9 |

**World facts, not sim constants** (moved to each world's config, `life.inputs`, each with a `why` and `sources`, per `CLAUDE.md`): `solvent` {ρ, μ, ε_r, liquid band} ([sci] handbook `[recalled]`; R2, R10), `airDensity` ([sci] `[INFERRED]`, P·M/(R·T); R1, R10; `develop()` already takes it as an input), `tissueDensity` {C 1.05, Si 2.2} ([sci] `[recalled]`; R10).

**Structure, not tunable (guardrail 6):** `GRID 64`, `TICK 20 Hz`, `CAP 1024`. Render constants (κ 0.5 look-snap, discovery thresholds) live in the renderer and can't touch the sim.

---

## 3. The minimal rule set (12, no cycles; ≤ 2 sentences, ≤ 1 `[game]` tunable each)

The bold text is the rule's name. The ≤ 2 sentences follow it. `[sci]` constants (G.2) don't count against the one-tunable limit.

| # | Rule | Tunable | One step → two steps | Source |
|---|---|---|---|---|
| 1 | **Food grows where light and nutrients meet.** Each cell's flora grows at `P0`·light·rate(heat), limited by its C/Si/O, and canopy shades ground mats (Beer–Lambert). Air Spark ∝ ρ_air·light and liquid cells feed swimmers, so channel shares and hotspots *emerge* | `P0` | Brighter → more plants. Then: grazed-out patches force long trips and long legs win | §9.3, Beer–Lambert [sci] |
| 2 | **Chemistry is food.** Growth is limited by the scarcest of C, Si and O relative to the body's comp (Liebig), and the excess goes back to the cell. Stone locks Si+O away, and dissolution (∝ ε_r) returns Si (Water) or C (Acid) | `DISSOLVE` | Si-rich Recipe → plated bodies. Then: stone locks Si, soft bodies take over, dissolution returns Si | Tilman, Sterner & Elser `[recalled]` |
| 3 | **Everyone pays to live.** Upkeep = `B0`·M^0.75·rate(heat) plus the mass of every structure. Eyes cost up to `EYE_FRAC`, and energy 0 = death | `B0` | Hot → hungry faster. Then: hot worlds run small and dark | Kleiber, Gillooly, Moran `[verified]` |
| 4 | **What you can eat is your body.** Pools need traits (swim, limb reach, buoy, bulk M for tough Si-forage, filter M), and prey is edible iff `2·gape·S > S_prey·(1 + plates + horns)`. Energy moves up at ε | `PLATE_MASS` | Long legs → canopy. Then: prey outgrow gapes, hunters escalate | Paine `[recalled]`, Vermeij, Massey & Hartley `[verified]` |
| 5 | **Hungry and afraid.** Each tick an animal picks the best of forage cell, hunt j, flee j, go home, rest or bud, by drive × intensity / distance. A cell's value is food − risk·(1 − shelter), and the Hunger dial multiplies the hunger drive | — | Hunger ↑ → chases within 1 tick. Then: prey crowd refuge edges, and bold armoured bodies take the open food | P1, Laundré `[recalled]` |
| 6 | **Relationships come from bodies.** Per lineage pair: Eats, Afraid (×2 for one generation after a survived attack), Rival (shared pools), Kin (same lineage × sociality), else Ignore, cached every 2 s. Newborn plates thicken by `INDUCE`·Hunger·Afraid | `INDUCE` | A new armoured mutant is ignored. Then: hunters switch to the next commonest prey, and shoals form | P2, Murdoch `[recalled]`, Agrawal `[verified]` |
| 7 | **Stone, canopy and deep liquid are shelter.** Shelter cuts catchability and pulls heat toward mild, both by `REFUGE`·shelter. Every animal keeps a home cell, and builders' excess Si+O becomes stone | `REFUGE` | Builders make stone. Then: refuges get contested, more builders, spires rise | P3′, P4 |
| 8 | **Bud with mutation.** Bud at E > 2·M, so generation time ∝ M^0.25 and litter size emerge from intake. Every gene mutates by `SIGMA` | `SIGMA` | More food → more babies. Then: drift opens new bodies | Brown 2004 `[verified]` |
| 9 | **Bodies grow from 12 genes + comp + conditions.** `develop()` applies the chemistry grammar and the §B reaction norms (TSR by medium, eye cost in the dark, glow ∝ darkness). It is the only place genes become traits | `TSR` | Recipe → Si: cyan hex newborns in 2 s. Then: Si in Water dissolves unless plated | F §3.3, Atkinson, Forster `[verified]` |
| 10 | **Move by the medium's physics.** Each animal uses the cheapest of walk, swim, fly, hover or sessile. Swim cost depends on \|ρ_body − ρ_liq\| and Re, and fly/hover cost on ρ_air | `FLY_K` | Methane: swimmers sink. Then: lakebed walkers and drifting bells | Purcell `[recalled]`, Pontzer `[verified]` |
| 11 | **Death becomes ground.** Si+O corpses become stone (terrain, shelter). C returns to the cell | — | Many deaths → reefs. Then: reefs become refuges | F §7 |
| 12 | **Same rules everywhere.** Off-camera agents and ⏩ run identical ticks with render skipped. The render reads the sim and never writes it | — | Nothing pauses. Then: you return to a changed world | P7, guardrail 9 |

Free `[game]` tunables used by rules: 9 of 12 slots.

**Why this should be complex:** four feedback loops, all spatial or chemical, none timed.
- **Refuge loop (7, 11):** builders → stone → refuges → prey cluster at edges → hunters patrol edges → prey near stone survive → more builders.
- **Chemistry loop (2):** Si locked in stone → Si scarcity → C-bodies win → fewer builders → Si returns through dissolution.
- **Predation loop (6):** common prey → targeted → rare → hunters switch.
- **Size loop (4):** prey outgrow gapes → bigger hunters → fewer of them (Damuth).

Each dial gives a predictable first effect and an unpredictable second one.

---

## A. Ecosystemic variety: targets and metrics

**Species unit:** an OTU, a cluster on the 12 genes + comp (c, si) at radius 0.25, with ≥ 4 live animals. **Functional type:** look-attractor (the renderer's read-only classifier) × trophic role × locomotion mode, comparable across runs. All bars are at 1,300 sim-s unless noted. Medians over 3 seeds.

| Scope | Metric | Pass bar | Driven by rules | Round 2 |
|---|---|---|---|---|
| Per preset | OTU richness S | ≥ 8 in all presets; ≥ 12 in ≥ 2 | 1, 2, 4, 6 | ~3–5 basins |
| Per preset | Shannon H′ / Pielou J | H′ ≥ 1.8 (≈ 6 effective species), J ≥ 0.55 | 2, 6 (coexistence) | low (strider ≥ 34%) |
| Per preset | Dominance (largest OTU share) | ≤ 40% | 2, 6, 7 | 34–76% |
| Per preset | Body-mass spread log10(M95/M5) | ≥ 1.5; ≥ 2.0 in frozen or one thick-air preset | 4, 1 (patches), 9 (TSR, O₂) | ≈ 0.3 (median 0.17–0.20 m) |
| Per preset | Locomotion modes (≥ 2% of animals) | ≥ 2 everywhere; ≥ 3 in frozen | 10 | 1–2 |
| Per preset | Trophic levels present (≥ 4 animals each) | ≥ 2 everywhere; ≥ 3 when Hunger ≥ 0.5 | 4, 5, 6 | 1 in 3/5 presets |
| Per preset | Channels occupied (≥ 4 animals feeding there) | ≥ 4 of 5 | 1, 4 | 3–4 |
| Per preset | Functional dispersion FDis (12 genes) | ≥ 1.5 × round 2 | all | baseline |
| Per preset | Chemistry coexistence: ≥ 2 OTUs with Δsi ≥ 0.2 coexisting ≥ 600 sim-s | in ≥ 3/5 presets | 2 | not modelled |
| Per preset | Food-web connectance L/S² / max chain length | 0.05–0.3 / ≥ 3 when Hunger ≥ 0.5 | 4, 6 | — |
| Across presets | Beta diversity (Bray–Curtis on the functional-type census) | ≥ 0.6 between presets, ≤ 0.4 within seeds | all dials via §B | 0.59–0.63 / 0.18–0.22 |
| Across presets | Signature fauna: each preset has ≥ 1 functional type absent from ≥ 3 others | 5/5 | 2, 9, 10 | — |
| Over time | Temporal turnover BC(t, t+200 sim-s) | mean 0.15–0.5 (neither frozen nor chaos) | 2, 6, 8 | — |
| Over time | Originations / extinctions of OTUs reaching ≥ 2% | ≥ 3 / ≥ 1 per run | 6, 8 | — |
| Readability (guardrail 7) | Animals inside a look-attractor's capture radius ("formed") / unnamed forms | ≥ 30% formed and 5–25% unnamed in every preset | 9 + render | κ 0.5: 34–76% (mostly strider) |
| Dial response | Light −0.4 at 650 sim-s | BC ≥ 0.3 within 200 sim-s; richness ≥ 70% of before within 400 sim-s | 1, 2 | — |

---

## B. Science → body: every quantity

Status:
- **LIVE**: feeds the sim in round 2 or the F design
- **NEW**: proposed here; it must reach `develop()` or the ledger
- **FLAG**: feeds nothing yet

Solvent values are `[recalled]` handbook figures at the liquid's typical temperature.

**Budget check (guardrails 4–5):** every row uses only the 12 genes (G.1) and the 18 constants (G.2). Derived quantities are fine. Rows that would have needed a new gene or constant are marked **→ NOT_NOW** or **render-only**.

| Quantity (source in model) | Equation / direction | Tag | Feeds (genes · constants) | What you SEE | Status |
|---|---|---|---|---|---|
| **C fraction** (comp c) | C need per unit of growth (R2). Grammar: 12-sided smooth loft, curl, tentacle limbs, ring eyes, frills | [game] grammar; [sci] direction (flexible organics) | develop, R2 · — | coral curling soft bodies | LIVE + NEW (stoichiometry) |
| **Si fraction** (comp si) | Si need (R2). Joint stiffness, hex facets, 15° joints, rod limbs. Body density via the world's `tissueDensity` | [game] grammar; [sci] silica skeletons (diatom glass ≈ 2% of energy, Raven 1983 `[verified]`) | develop, R2, R10 · `tissueDensity` (world) | cyan hex ticking bodies, glass plates | LIVE |
| **O fraction / availability** (comp o, cell O) | O need scales with upkeep (R2). Oxygen–size: adult scale × (1 + o). Glow does **not** depend on O (owner ruling: glow comes from darkness on both worlds) | [sci] Verberk & Atkinson 2013, Chapelle & Peck 1999 `[verified]` | develop, R2 | bigger, more active animals in O-rich worlds | LIVE (speed × O dropped → NOT_NOW) |
| **C, Si, O supply per cell** (Recipe × Sea × history) | Liebig `min` over the three. R* differs by comp, so the winner tracks the supply ratio | [sci] Tilman, Sterner & Elser `[recalled]` | R1, R2 · `P0` | plated forms on Si-rich ground, soft forms on C-rich ground; shifts as stone locks Si | NEW |
| **Solvent density ρ_liq** (Water 1.00, NH₃ 0.68, CH₄ 0.42, H₂SO₄ 1.83 g/cm³) | swim cost ∝ \|ρ_body − ρ_liq\|. ρ_body = (1 − `buoy`)·(comp-weighted `tissueDensity` + plate mass) | [sci] `[recalled]` | R10 · `buoy`, `plates`, `solvent` (world), `tissueDensity` (world) | methane: swimmers sink, giving lakebed walkers and gas bells. Acid: plated bodies still bob | NEW |
| **Solvent viscosity μ** (0.89, 0.25, 0.12, ≈ 25 mPa·s) → Re = ρ·v·S/μ (vs Water ×2.4, ×3.1, ×3.1, ×0.065) | the weight on form drag rises with log Re, anchored to Water. At high Re, `segments` (elongation) cuts swim cost; at low Re, drag ∝ surface favours compact bodies | [sci] Purcell 1977 `[recalled]` | R10 · `segments`, `size`, `solvent` (world) | methane/ammonia: torpedo eels. Acid: compact swimmers with a cilia fringe (fringe is **render-only**, from Re) | NEW |
| **Solvent polarity ε_r** (80, 22, 1.7, ≈ 100) | attack = `DISSOLVE`·ε_r/80 on unplated Si (Water, NH₃) or C shell/stone (Acid). Methane ≈ 0. Dissolved matter returns to cells (R2) | [sci] direction (sea silica mostly dissolves, Tréguer 1995 `[verified]` fact); [game] scale | R2 · `plates`, `DISSOLVE`, `solvent` (world) | plated forms in Water; bare Si in Methane | LIVE (Water, Acid), NEW (ε_r scaling) |
| **Liquid temperature range** (0–100, −78 to −33, −182 to −162, 10–337 °C) | Heat = position inside the solvent's liquid band. Absolute T is unused | [game], declared (real Arrhenius at 90 K would freeze methane life) | — | — | **FLAG** feeds nothing → NOT_NOW (ℓ from band edges, frost fringe) |
| **Temperature** (Heat) | rate(heat) via `Q10` → upkeep, speed, tempo, generation time. Adult scale × (1 + `TSR`·(1 − 2·heat)), ×`TSR_LAND` for walkers. Lifespan ∝ M^0.25/rate | [sci] Gillooly 2001, Atkinson 1994, Forster 2012 `[verified]`; [game] magnitude | R3, R9 · `Q10`, `TSR`, `TSR_LAND`, `GEN_EXP` | everything speeds up when hot; big slow swimmers in cold seas | LIVE |
| **Microclimate** (shelter) | heat pulled toward mild by `REFUGE`·shelter | [sci] direction (burrow buffering); [game] | R7 · `REFUGE` (shared) | in extreme-heat worlds the big and slow cluster in dens | NEW (no new constant) |
| **Light intensity** (Light) | flora ∝ light (R1). Eye benefit = vision ∝ light vs cost `EYE_FRAC`, so eyes regress in the dark *without a rule*. Glow lures pay when dim, on both worlds: glow output = `glow`·(1 − light). On carbon it's luciferase-style bioluminescence; on silicon, chemiluminescence (`assumption: true`) | [sci] Moran 2015, Nilsson 2012, Warrant & Locket 2004, Martini & Haddock 2017 `[verified]` | R1, R3, R5, R9 · `eyes`, `glow`, `EYE_FRAC` | big eyes at dusk, eyeless den-dwellers, glow lures; caps vs glow bulbs | LIVE (the `o > 0.3` threshold dropped) |
| **Light spectrum** (tholin orange) | sky/stain colour; skin hue tinted by ambient spectrum | [game] | render only | orange-tinted skins | **FLAG** no sim effect (render-only, allowed by guardrail 9) |
| **Pigment / UV** (bright light) | dorsal darkening ∝ Light | [game] | render only | darker backs in bright worlds | **FLAG** no sim effect (render-only). A pigment gene → NOT_NOW |
| **Atmospheric density ρ_air** (world config `airDensity`; methane ≈ 4× Earth `[INFERRED]`) | fly cost = `FLY_K`·(1 − ρ_air)·S^0.5. Hover cost = `FLY_K`·max(0, ρ_body − ρ_air). Air food ∝ ρ_air·light. Wing area drawn ∝ M/ρ_air | [sci] direction; [game] scale | R1, R10 · `buoy`, `FLY_K`, `airDensity` (world) | big wings in thin air; gas bells in thick air | LIVE (share), NEW (smooth costs) |
| **Gravity** | fixed at 1 g | [game], declared | — | — | **FLAG** by design: "all worlds share one gravity" (Titan's 0.14 g → NOT_NOW) |
| **Dissolved Si per cell** | plate cost = plate mass × the local Si price (R2 scarcity). Grazed cells grow Si-rich, tough flora | [sci] Massey & Hartley 2009 `[verified]` | R2, R4 · `plates`, `PLATE_MASS` | spiny glassy grass where grazers crowd; cheap plates on Si-rich ground | LIVE (flora), NEW (price) |
| **Predator density** (local Afraid) | newborn plates + `INDUCE`·Hunger·Afraid. Horns = prey defence. Eyes pay more where risk is high because vision buys escape (derived) | [sci] Agrawal 1999, Tollrian 1995 `[verified]` | R5, R6 · `plates`, `horns`, `eyes`, `INDUCE` | thicker plates near hunters; big-eyed prey at refuge edges | LIVE (vigilance constant dropped) |
| **Hunger** (dial) | hunger drive × (1 + H). ε = `EPS0`·(1 + 2H) | [game]; [sci] ε range Lindeman `[recalled]` | R4, R5 · `EPS0` | chase/flee within 1 tick | LIVE (intake × (1 − 0.6·H) dropped) |
| **Food patchiness** (emergent: depletion, light gaps, liquid edges) | cost per stride ∝ 1/`limbLen` (Pontzer 2007 `[verified]`). Cost of transport per kg ∝ M^−0.3 (Taylor 1982 `[recalled]`). Reserves ∝ M, upkeep M^`KLEIBER` | [sci] | R3, R5, R10 · `size`, `limbLen` | long-legged wanderers in sparse worlds; homebodies in lush ones | NEW (measured patchiness index for M3; no constant) |
| **Liquid fraction ℓ** | fixed by the basin geometry | [game] | R1 (liquid cells) | sea area | **FLAG** fixed → NOT_NOW |
| **Age / Time τ** | lineage depth, stone accumulation, generation count. The den share emerges from the stone cells | [game] | R7, R11 · — | spires, strata, named old lineages | LIVE |
| **Stone / den availability** | shelter (R7). Builder payoff emerges: bodies with excess Si+O deposit stone and get refuge | [sci] direction | R7, R11 · `REFUGE` | builders ringing dens, worms in stone, pores glowing by occupancy (render) | LIVE (the `si·o > 0.12` flag is now derived) |
| **Body mass M** (derived hub) | Kleiber upkeep, generation time ∝ M^0.25, gape reach, Damuth forecast, reserves | [sci] Kleiber, Brown 2004 `[verified]` | R3, R4, R8 · `size`, `KLEIBER`, `GEN_EXP` | the size spectrum | LIVE |

**Still feeding nothing in the sim:**
- liquid temperature range (absolute T)
- gravity (fixed by design, declared)
- liquid fraction (fixed)
- light spectrum and UV pigment (render-only, allowed by guardrail 9)

None needs a new gene or constant to stay as it is. Anything more goes to NOT_NOW.

---

## 4. What to cut

| Cut | From | Why it adds rules without emergence | Replaced by |
|---|---|---|---|
| **Any global or periodic cycle** (storm, rain, day/night, seasons, tides as a rule) | earlier draft of this doc | **Owner decision 2026-11-07** | Space (Rules 1, 5, 7) + chemistry (Rule 2) + predation (Rules 4, 6) |
| Hox midwife, "grazer tasted meat" | F §7, §10 | Tested, no effect | — |
| Stress mutagenesis bursts after dial moves | F §10 | A second mutation rule | Rule 8 + Q5 |
| Trophic levels, `massScale`, `targetN`, apex pooling *as inputs* | REPORT §9.2–9.3 | They steer and invite authored species | Rules 4 and 6. The table becomes a forecast |
| `role` field and per-role FSM unlocks | REPORT §9.6 | Authored per-niche behaviour | Rule 5. Role is *read* from diet over 60 s |
| Apex refuge; cap change just for the apex | §9.4 options | Steering | Honest rarity (Q4) |
| Hard gates: `buoy ≥ 0.6`, `Hunger > 0.6` armour | round 2 | Valleys; they hide dial ranges | Smooth costs (Q3, §B) |
| Separate "pore refuge" rule | F §7 | Duplicates shelter | Rule 7 |
| Seeded buoyant founder lineage | round 2 recipe 5a | A seed / preset code (guardrail 8) | — (NOT_NOW) |
| Litter ∝ S, lifespan × heat bonus | round 2 recipe 5c | Extra size rules | Jarman–Bell + filter + gape refuge + patch travel (Q2). Litter is derived |
| 20 of F's 32 genes (profile, symmetry, axis, head, limb domain/period/joint bias, plate size, dorsal mix/density, tail, eye/horn count, boldness, r/K, skin pattern, headWidth, motility) | F §3.3 | Each adds a gene with no unique sim payoff | 12 genes (G.1); the rest is derived look or behaviour |
| Per-trait ledger prices (plate build 0.05, glow 0.3, eye 0.2, hover k, intake scarcity 0.6, speed × O, vigilance 0.2, microclimate 30%, `si·o > 0.12` builder flag, `o > 0.3` glow-eye gate, g(heat) hump, canopy/air/den share coefficients, Hox p, segment-dup p) | F §3.4, REPORT §9.3, earlier draft | Constants that steer without new behaviour | Structures cost their mass at the R2 element price. Shares emerge from the grid. 18 constants (G.2) |
| Named basins in the sim | round 2 `BASINS` | A table that names species (guardrail 3) | Anonymous look attractors in the renderer (guardrail 9) |
| L-system flora as sim agents | F §5 | Second agent type | Per-cell flora biomass. L-system shapes are render-only |
| Basins by authored affinity | round 2 | Failed and steers | By occupancy |
| Reputation systems | Rain World | No player body | Fear memory |
| Per-species flocking or pack code | Atlas R10 wording | Should emerge | Sociality gene + fear |

Keep, though authored: the `develop()` grammar, the ledger, render-side look attractors and the discovery classifier, and geologic gain under ⏩ (declared, render/terrain only).

### → NOT_NOW (for the team lead to move into `docs/NOT_NOW.md`; revisit after H8)

1. Any global or periodic cycle: storm, rain, day/night, seasons, tides (owner: no).
2. Midwives: Hox shift, "grazer tasted meat"; stress-mutagenesis bursts.
3. Seeded buoyant founder lineage for thick-air worlds.
4. `Hunger > 0.6` inducible-armour gate; `buoy ≥ 0.6` gas-bag gate.
5. Apex refuge; any animal cap other than 1,024.
6. Trophic levels, `massScale`, `targetN`, apex realm pooling as sim inputs (kept as forecast only); per-role FSM unlocks (§9.6).
7. Canopy pool hand-set to 0.3 K (Q1 fallback; costs a constant).
8. Litter ∝ S as a rule; lifespan × (1 + (1 − heat)) bonus.
9. Reputation / opinion systems; per-species flocking or pack code.
10. The 20 dropped genes (§4 row), including an r/K gene, a motility gene and a pigment gene.
11. Speed × O; vigilance eye bonus; separate microclimate constant; intake scarcity × (1 − 0.6·H).
12. Liquid fraction ℓ from the solvent's liquid band; frost/boil fringe; absolute temperature for rates.
13. Gravity per world (Titan-like 0.14 g for methane).
14. Spectrum-tuned eye pigments as a gene (render tint stays).
15. Pre-evolved menagerie, if the owner rules it a "rescue" (guardrail 8).
16. Generation-time constant `GEN0` and fear-memory duration `FEAR_T` (both replaced by derived values).

---

## 5. Next experiment: round 3 headless spec

**Where:** add an `r3=True` path to `research/body-plans/prototype/f_ecology.py` (Python toy), and port to TS/Vitest only on a pass. Budget about 3 h of build and 1 h of sweeps. Runs: 5 presets × 3 seeds × T = 1,300 sim-s, cap 1,024.

| Config | Contents | Purpose |
|---|---|---|
| `r2b` | round-2 baseline | control |
| `+food` | Rule 1 producer pools from §9.3, with patchy local regrowth | Q1 sizing |
| `+chem` | `+food` + Rule 2 (C/Si cell nutrients, Liebig growth, stone lock, dissolution return) | coexistence by R* |
| `+rel` | `+chem` + Rules 5–6 (utility, relationships, fear memory, sociality gene) | hunters, kill-the-winner |
| `+place` | `+rel` + Rule 7 (shelter field incl. heat buffering, home) + Q2 access functions | size, encounter rate |
| `full` | `+place` + Rule 10 solvent/air physics (§B NEW rows) + Q5 compression | the proposed set |
| ablations | `full` minus each of Rules 2, 5, 6, 7 and 10 | each rule must earn its place |
| ratio sweep | `rhino` preset, Si:C supply at 5 steps (0.25–4×) | Tilman crossover |
| honesty | flattened ledger (look attractors fill by volume); shuffled access functions (different attractors fill) | §9.8 guards |
| guardrail audit | grep the sim for `preset`, species names and basin ids; count rules, genes and constants | must be 0 / 0 / 0 hits; ≤ 12 / 12 / ≤ 25 |

All configs use the 12-gene genome and the 18 constants (G.1–G.2), on one 64² grid at a fixed 20 Hz tick (dt 0.05). The toy's dt 0.25 is replaced.

**Pass bars:**
- `full` must pass M1–M14 and the per-preset §A bars in ≥ 4/5 presets.
- Each ablation must fail at least one bar, or that rule is cut.

**Acceptance rule (guardrail 7, the feature gate).** A rule, gene, constant or feature enters the build only if a headless A/B (3 seeds × 5 presets, with vs without it) does both of these:
- raises at least one §A variety metric, or the readability metric, by ≥ 10% relative or across its pass bar
- breaks no other bar, and M10 (stability) in particular

Anything else goes to NOT_NOW, including features after H8.

| # | Measure | Pass bar | Round 2 |
|---|---|---|---|
| M1 | Largest OTU share | ≤ 40% in 5/5 | 34–76% |
| M2 | OTUs with ≥ 5% | ≥ 4 in ≥ 4/5 | 2–3 |
| M3 | Size: median mass vs `r2b` / log10(M95/M5) | ≥ 2× in ≥ 3 presets / ≥ 1.5 | 1× / ≈ 0.3 |
| M4 | Hunter tier 5–35% of animals | ≥ 50% of sim-time in ≥ 4/5, incl. rhino (H .55) | dusk + frozen only |
| M5 | Watering-hole index: predations per area at hotspots (top 10% producer cells + refuge edges) vs mean | ≥ 2× | n/a |
| M6 | Apex in dusk | present ≥ 30% of time; ≥ 1 re-emergence in 3 seeds | ≈ 1 animal forecast |
| M7 | Forecast vs emergent channel abundance | Spearman 0.6 ≤ ρ ≤ 0.95 (must be able to surprise) | n/a |
| M8 | Beta diversity (functional-type Bray–Curtis) | ≥ 0.6 between, ≤ 0.4 within | 0.59–0.63 / 0.18–0.22 |
| M9 | One-body legs + horns + plates ≥ 5% | ≤ 400 sim-s in ≥ 2 presets | 601–863 |
| M10 | Stability | no extinction; N ∈ [700, 1,024] after 100 sim-s | stable |
| M11 | Kill-the-winner: corr(prey OTU share, per-capita predation) | > 0.3 | n/a |
| M12 | Drifters (frozen) / small fliers (thin air) / low-Re fringed swimmers (acid) | ≥ 50 / ≥ 5% / ≥ 1 OTU | ≤ 13 / — / — |
| M13 | Landscape of fear: slope of prey foraging rate vs distance to refuge | < 0 when H ≥ 0.5; ≈ 0 with predators removed | n/a |
| M14 | Tilman crossover (ratio sweep): dominant OTU's si vs Si:C supply | Spearman ≥ 0.7; ≥ 2 chem-OTUs coexist at the middle ratios | n/a |
| M15 | Readability: "formed" share / unnamed share (render classifier) | ≥ 30% / 5–25% in every preset | κ 0.5, strider-dominated |

**JS bench (parallel, Q6):**
- 1,024 agents in a Worker, all 12 rules, fixed 20 Hz tick.
- Pass: ≤ 0.5 µs per agent-tick (⏩ ×20 = 400 ticks/s fits in ≤ 60% of a core), cache refresh ≤ 1 ms.

**Report back:**
- One table of bars × configs.
- The ablation verdict per rule.
- Census plus §A metrics per preset.
- Three named emergent events from the logs (e.g. "den siege", "silicon famine", "apex re-rise"). These are the demo's discovery beats.

**Decision rule:**

| Outcome | Then |
|---|---|
| `full` passes M1, M3, M4, M10 and the §A per-preset bars in ≥ 4/5 | Rules 2, 5, 6, 7 and 10 go into the D1 plan at H4–8 |
| M14 fails and ablating Rule 2 changes no bar | Cut Rule 2 (chemistry stays look plus ledger only) |
| Any ablation changes no bar | Cut that rule, freeing a slot (one-in-one-out) |
| Neither `+rel` nor `full` passes M1 and M4 | Fall back to round 2 with the guardrail-compliant genome; menagerie only if the owner allows it |
