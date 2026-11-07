# 04: Time-to-trait. Can F's ecology grow legs, horns, plates and hunters from worms inside the demo?

Status: **measured in a toy** `[sim]`. Prototype: `../prototype/f_ecology.py` (run instructions in `../prototype/README.md`). Data: `../data/time-to-trait.json`, which holds 85 configs × 3 seeds = 255 runs, plus a dt check and a ledger-variant test. Raw runs are in `../data/raw-sweep.json.gz`.

## Headline

- **F as written does not get there.** Settings: σ ×1, the founders F specifies, F's ledger shape and my coefficients.
  - Over 2,400 sim-s, legs (≥2 pairs at 20%) take 260–1,300 sim-s.
  - Horns, plates and a hunter tier essentially never reach 20%.
  - At ×1 the demo gives the ecology only about 125 sim-s, which is **6–12 generations**. Generation time is ≈ 13 sim-s (mild), 10.5 (warm), 19 (cool) and 29 (cold). This confirms the critique in the emergence README §4.7.
- **Three changes get the whole set (legs + horns + plates + hunters) by about 340 sim-s:**
  1. Stress mutagenesis ×2.5 kept on permanently.
  2. Population ≥ 1,000 (3,000 better).
  3. A plate ledger that actually pays: build cost ÷5, mass ÷2.7, Water dissolution ×3.

  That's **126 demo-s** on the hybrid timeline (×1 until 2:00, then ×40), or 110 demo-s at a constant ×4.
- **No single run in the main sweep reached all four.** Open-ended runs never spread plates. Template-guided runs never spread horns.
- The template-guided mode (the new direction) is **faster for legs and plates and gives much more distinct bestiaries per preset**. But competitive exclusion collapses its 9 templates to 2–4 per world. Rhino-lizard, strider, sky whale, jelly and builder templates never form.

## Method (toy, not F)

- **Genome.** 2D torus 64 m, 32² producer grid, agents as points. F's 32-gene genome, integer segment count, `develop()` and ledger, all vectorised in numpy. Every coefficient is in `C` at the top of the script. All are mine, tagged `[game]`, and none are calibrated against F's code (F has no code yet).
- **Founders.** 24 near-identical worms from one copier sequence (L = 4–6), as in F §3.2.
- **Mutation.** p 0.3, σ 0.05, segment duplication 0.03, deletion 0.01, Hox shift 0.05.
- **Sweep.** Population cap 300/1,000/3,000 × σ ×1/×2.5 × segment duplication on/off × 5 presets × 3 seeds, at T = 2,400 sim-s.
  - The presets: Earth-ish, Silicon city and Hunter's dusk from WORLD_ATLAS §5.3, plus Frozen cathedral (the only thick-air world, needed for buoyancy) and "rhino" (fauna-02 dials: Si, Water, mild, medium light, medium Hunger).
  - Plus F's declared cheats (Hox midwife, "a grazer tasted meat") at cap 1,000, σ ×2.5.
  - Plus guided mode at cap 1,000/3,000 × pull 0.1/0.25, T = 900.
- **Trait thresholds.**
  - legs ≥ 2 pairs; horns ≥ 0.3 body length; plates ≥ 3 plated segments and cover ≥ 0.35
  - eyes: ≥ 4 dots with A ≥ 0.3, or A ≥ 0.6
  - buoyant = float mode; buoyant giant = float mode and S ≥ 1.5 m
  - long = segN ≥ 8
  - hunter tier = t ≥ 0.6 for ≥ 5% of animals, sustained 10 s
- **Reporting.** Times are medians over seeds. "–" means reached in ≤ 1 of 3 seeds.
- **Demo seconds.** demo-s = 25 (ecology starts, F §2) + sim-s / speed. F ticks at 20 Hz, so ×K = 20K ticks per real second. The hybrid schedule is ×1 until demo 2:00, then ×40. That gives **1,295 sim-s by demo 150 s**.
- **dt.** The toy ticks at dt 0.25 s. A dt 0.05 check (F's 20 Hz) gives the same generations per sim-s (46.5 vs 46.5 at 600 s) and trait times within seed noise (`dt_check` in the JSON). The prototype numbers are per sim-second, not per tick.

## Results (20% prevalence, sim-s; hunter = ≥5% tier)

| Config (cap 3,000 unless noted) | legs ≥2 | horns | plates ≥3 | hunters | eyes | long ≥8 | stable |
|---|---|---|---|---|---|---|---|
| open, σ×1, rhino | 419–624 | – | – | – | – | – | 3/3 |
| open, σ×1, earth | 408–1,319 | – | – | – | – | – | 3/3 |
| open, σ×2.5, rhino | 167–197 | 379–451 | – | 35–37 | 71–78 | – | 3/3 |
| open, σ×2.5, earth | 140–172 | 231–245 | – | 26–29 | – | – | 3/3 |
| open, σ×2.5, silicon | 116–126 | 353–564 | – | 30–48 | 35 | – | 3/3 |
| open, σ×2.5, dusk | 274–292 | 448 | – | 41–47 | 52–98 | – | 0–3/3 |
| open, σ×2.5, frozen | 529 | 461–474 | – | 58–103 | 87–102 | – | 3/3 |
| open, σ×2.5, cap 1,000 (all presets) | 134–1,447 | 364–1,580 | – | 38–279 | 48–1,681 | – | dusk 0/3 |
| open, cap 300 | – | – | – | – | – | – | **extinct** (except earth) |
| guided pull .25, rhino | 64 | – | 144 | 34 | 164 | 39 | 3/3 |
| guided pull .25, dusk | – | – | 94 | 21 | 74 | 29 | 0/3 (crashes) |
| guided pull .25, silicon | 70 | – | 207 | – | 123 | – | 3/3 |
| guided pull .25, earth | 858 | – | 416 | – | – | 33 | 3/3 |
| **open σ×2.5 + plate ledger fix, rhino (2 seeds)** | 186–220 | 308–342 | 209–316 | 70–82 | | | 2/2 |

Buoyant giants: **never, in any config.** In Frozen cathedral every newborn floats from birth: ρ_air 1.08 > ρ_body, which is plasticity and not selection. But body size is never selected up, so floaters stay ≈ 0.2 m.

### Findings

- **Generation time is the bottleneck.** Lifespan `30 s·S^0.25` caps generations at about 1 per 13 sim-s. In this toy, legs need roughly 10–20 generations of directional selection, and horns 20–35.
- **Stress mutagenesis is the only cheat that matters.**
  - σ ×2.5 cuts legs about 3× and turns horns and hunters from "never" into 30–600 sim-s.
  - Hunters come mostly from drift of `t` under high σ, then selection once the tier exists.
  - The Hox midwife and "grazer tasted meat" gave no measurable gain: runs with and without them are identical or within noise.
  - F applies ×2.5 only for 12 s after a dial move. The demo needs it **always on** (declared).
- **Population.** cap 300 goes extinct from 24 founders (demographic noise). 3,000 beats 1,000 by about 1.5–2× on legs, horns and hunters. ≥ 1,000 is the floor.
- **Segment duplication** made no consistent difference. Length ≥ 8 never spread in open mode, because the toy's swim discount is too weak to select for length. Serpents and eels need a stronger length payoff.
- **Plates are a ledger problem, not a time problem.** Plated mutants appear by 8–50 sim-s but never spread. With build cost /(0.2 + si) and mass +0.4·cover, their bite defence doesn't pay, and Water dissolution at k 0.05 is too gentle. Cheap plates + 3× dissolution gets plates to 20% by 209–316 sim-s in Water. Acid gets them in 1 of 2 seeds: correct per R5, since acid doesn't punish bare silicon.
- **Stability.**
  - Hunter's dusk (H = 0.9) is the fragile preset. Open runs dip below 10% of cap, and guided pull .25 at cap 1,000 went extinct (hunter overshoot, F §7).
  - Hunters needed two declared game rules to exist at all: carnivores don't eat carnivores, and Hunger = plant scarcity (DESIGN §4). Without them, hunters either never paid or turned into a cannibal monoculture.
- **Species counts.** About 40 genome clusters at σ ×1, but only 3–10 at σ ×2.5. This is a metric artefact: high σ spreads genomes into clusters smaller than 3. Use body-plan bins for the field guide, not raw clusters.

## Open-ended vs template-guided

The guided mode follows the user direction. It starts with cap/2 tiny worms over the whole dish. 9 templates come from DESIGN §4 + WORLD_ATLAS fauna, each with a chemistry affinity. Each birth moves the template genes `pull × affinity` of the way towards the lineage's template. Mutation and selection stay on, and a 4-state FSM per agent covers roam, feed/chase, flee and rest/digest.

| | Open-ended (F) | Template-guided |
|---|---|---|
| Legs ≥ 2 at 20% (rhino, cap 3k) | 167–197 s (σ×2.5) | **64 s** (σ×1) |
| Plates | never (needs ledger fix) | **94–416 s** |
| Horns | 231–564 s (σ×2.5) | never: horned templates lose |
| Hunter tier | 26–103 s (σ×2.5) | 21–360 s; overshoots at H 0.9 |
| Templates reaching ≥ 20% formed | n/a (none) | plated hopper (4/5 presets, 170–415 s), spinner (160–620 s), swimmer eel (earth 96 s), frilled serpent (rhino 135 s, dusk 283 s). **Never:** rhino-lizard, strider, sky whale, drifter/jelly, builder |
| Bestiary L1, between presets / within preset (F §8 target > 0.6 / < 0.4) | 0.72 / 0.48 (**fails** within; earth vs rhino only 0.41) | **1.24–1.33 / 0.42–0.45** (nearly passes) |
| Emergence honesty | high | lower: templates are authored attractors, and selection only picks among them |

The guided failures come from **competitive exclusion**. All templates graze the same grid, so the cheapest form (the 1-pair plated hopper, or the short-legged spinner) wins every world. Multi-trait plans that pay several costs at once (rhino-lizard: plates + horns + 2 pairs + size) are out-competed before they form.

**Recommendation:** use the **open-ended engine with the guided pull layered on as a declared "developmental bias"**, and fix the ledger rather than relying on templates alone.
- Keep σ ×2.5, cap ≥ 1,000.
- Add pull ≈ 0.25 only towards the 2–3 templates with the highest affinity per world. This gives fast legs and plates, and distinct bestiaries.
- Give each template a **niche**, so the forms can coexist:
  - floaters graze aerial Spark
  - swimmers use liquid cells only
  - striders take tall flora
  - builders get den refuges
- Treat the FSM as behaviour and readability. It isn't needed for speed, but resting after a meal does damp the hunter boom.

## Tuning recipe for F (minimum settings that reached legs + horns + plates + hunters by demo 150 s)

1. **Always-on stress mutagenesis σ ×2.5.** Declare it as "a stressed young world". It's needed for horns and hunters.
2. **Animal cap ≥ 1,000**, 3,000 if the JS budget allows. Don't go below 1,000. Seed ≥ 24 founders.
3. **Plate ledger:**
   - build cost `0.05·cover/(0.2 + si)·M` (not 0.25)
   - mass `+0.15·cover` (not 0.4)
   - Water dissolution of bare silicon about 3× this toy's 0.05
   - Otherwise plates never spread.
4. **Hunters:** Hunger must cut plant yield (×(1 − 0.6 H)), carnivores must not eat carnivores, and hunters need a neighbourhood search with prey-seeking steering. "A grazer tasted meat" is unnecessary once σ ×2.5 is on.
5. **Time.** About 340 sim-s is needed, which means a constant ≥ 2.7× (340/125). Any of these works:
   - ×4 from the start of the ecology (80 ticks/s at 20 Hz; legs+horns+plates+hunters by ≈ 110 demo-s)
   - the hybrid ×1 → ×40 at 2:00 (≈ 126 demo-s)
   - ⏩ starting at about 1:30
6. **Cheats not needed:** the Hox midwife (no effect) and "grazer tasted meat" (σ does its job).
7. **Buoyant giants need a size payoff, or a founder-buoyant lineage (F's own fallback).** Floating itself is instant in thick air.

## JS budget estimate (not measured in JS)

- **Numpy (overhead-bound, not predictive):** 1.5 ms/tick at 1,000 agents and dt 0.05. 10–17 ms per sim-s at 1,000–3,000 agents and dt 0.25.
- **JS, using F's own 0.3 µs per agent per tick** (F §3.4, also unmeasured):

| Agents | Speed / tick rate | CPU | Where it fits |
|---|---|---|---|
| 1,000 | ×4 at 20 Hz | 24 ms/s (0.4 ms/frame) | main thread |
| 3,000 | ×4 at 20 Hz | 72 ms/s (1.2 ms/frame) | main thread |
| 1,000 | ×40 at 20 Hz (800 ticks/s) | 240 ms/s (4 ms/frame) | worker |
| 3,000 | ×40 at 20 Hz | 720 ms/s | too much |
| 3,000 | ×40 at 4 Hz (dt 0.25, shown dt-insensitive here) | 144 ms/s | worker |

**Recommendation:** ×4 at 20 Hz on the main thread for 1,000 agents. Deep time ×40 runs in a worker at dt 0.25.

## Atlas fauna reachability (in this toy)

| Pin | Verdict |
|---|---|
| fauna-02 rhino-lizard | **traits reachable** (legs, horns, plates and hunters all ≥ 20% in Water with the ledger fix by about 340 s). Co-occurrence in one body was not measured. |
| fauna-05 frilled serpent | hunter tier yes, length no (open). Guided serpent forms in rhino/dusk at cap 3k. |
| fauna-06 plated hopper | **reached** (guided, everywhere). Open needs the plate fix. |
| fauna-08 eels | guided earth 96 s. Open: length never selected. |
| eco-09 feathered hunter | hunters in dusk yes, but it's the least stable preset. Dorsal rods not measured. |
| fauna-01/07 striders | **not reached** (the strider template is out-competed) |
| fauna-03 jellies | **not reached** |
| fauna-09 sky whales | **not reached** (no size selection) |
| eco-13 Living Arch | not modelled |

## Caveats

- This is a toy written in an afternoon. The coefficients are mine. A different ledger moves every number. **The robust result is the structure:** generations/sim-s ≈ 1/13, the need for always-on mutagenesis plus ≥ 1k agents, and the fact that plates and size need payoffs, not time.
- **No** flora L-systems, sociality, frills, glow, builders, terrain or sessile growth. The 2 m grid cell is the interaction radius.
- Prevalence is measured per trait, not per combined body plan.
- Guided-mode results depend on my template targets, affinities and the 0.01 switch rate.

---

## Round 2: the hybrid engine (open-ended F + body basins + niches + biology fixes)

Data: `../data/time-to-trait.json` holds two blocks.
- `round2`: 25 configs × 3 seeds, basins activated by affinity, strict "formed" thresholds.
- `round2b`: 10 configs × 3 seeds, the final version, basins activated by occupancy, looser thresholds.

Raw runs are in `../data/raw-r2.json.gz` and `../data/raw-r2b.json.gz`. Run with `python3 f_ecology.py --r2sweep [--r2b] --T 1300 --out ...`, then `summarize_r2.py`. T = 1,300 sim-s is exactly demo 150 s on the hybrid schedule.

### What was built (all in `f_ecology.py`, `r2=True`)

- **Engine.** The open-ended F engine with σ ×2.5 always on and the round-1 ledger fix (`R2_OVERRIDES`: plate build 0.05, plate mass 0.15, Water dissolution 0.15).
  - It starts from cap/4 tiny worms spread over the dish.
  - Growth within life: the look snap ramps from 0 to full over the juvenile period, so newborns read as capsules. On average **11%** of animals on screen (8–23%) are capsules moulding into adults.
- **7 body basins** (worm, swimmer, strider, rhino-lizard, spinner, drifter, sky whale), defined on cost-bearing body axes: elongation, limb pairs, limb length, armour, buoyancy, size, radial symmetry, horn.
  - **Canalization:** only *look* genes (profile, head, joints, tail, plate size, stilt axis) are snapped, by κ·w(d)·growth with κ ≤ 0.5, inside capture radius 0.25. Size, plates, limbs, horns, diet and buoyancy are never snapped. Grazer, hunter and builder are roles any body can take.
  - **round2:** the active basins are the top-3 by chemistry affinity.
  - **round2b:** the active basins are the top-3 by *occupancy*, the non-worm basins selection is actually filling, refreshed every 10 s.
- **Niches.** Every resource pool is depletable, so frequency-dependence applies:
  - ground grazing
  - liquid cells (only swimming bodies graze there)
  - aerial Spark, floaters only: pool = 0.6 K·min(1, ρ_air/0.6), with filter area growing with size
  - a canopy pool, 0.6 K on land, reached in proportion to `(S·limbLen·(1 + stilt) − 0.3)/0.5`
  - stone den cells, 10% of land, where builders (si·o > 0.12) are only 0.2× as catchable
- **Biology (notes/02 §2):**
  - Horns are prey defence (+1.5·horn to defence) and gape is the hunter's weapon.
  - Inducible armour: newborn cover gets +0.4·Hunger·local hunter density.
  - Eyes regress in total dark unless o > 0.3.
  - TSR is full for limbless bodies and 1/10 for walkers.
  - Size ×(1 + 0.5 o).
  - Floating requires buoy ≥ 0.6 and pays a gas-bag upkeep.
  - Big bodies save up to 30% basal in cold, O-rich worlds.

### Results (cap 3,000, κ 0.5, round2b; sim-s; medians over 3 seeds; "–" = ≤ 1 of 3 seeds)

| Preset | legs ≥2 | horns | plates ≥3 | hunter tier | legs+horns+plates in ONE body: first / ≥5% / ≥20% | strider ≥5% of pop formed | other basins formed (≥20% of captured) | unnamed | stable |
|---|---|---|---|---|---|---|---|---|---|
| rhino (Si, Water, med H) | 321 | 542 | 309 | – | 166 / **601** / – | **341** | spinner 967 | 14–23% | 3/3 |
| dusk (Si, Ammonia, fierce) | 258 | 541 | 227 | 202 | 221 / **863** / – | **289** | swimmer 133, spinner 422 | 8–13% | 3/3 (min N 400–590) |
| silicon (Si+O, Acid) | 210 | 820 | – | – | 106 / – / – | **208** | swimmer 359, rhino-lizard **960** (2/3), spinner 268, drifter 286 (2/3) | 6–8% | 3/3 |
| earth (C, Water) | 199 | 388 | – | – | 131 / – / – | 622 | swimmer 559, spinner 150, drifter 801 | 9–12% | 3/3 |
| frozen (Si+O, Methane, cold) | 219 | 587 | 798 | 135 | 175 / – / – | – | drifter 625 (2/3) | 10–16% | 3/3 |

**Final census (out of 3,000):**

| Preset | strider | worm | rhino-lizard | spinner | swimmer | drifter | sky whale |
|---|---|---|---|---|---|---|---|
| rhino | 1,870 | 107 | 330 | | | | 0 |
| dusk | 2,280 | | 258 | | | | 0 |
| frozen | 1,500 | 820 | 177 | | | | 0 |
| earth | 1,010 | 1,350 | | 170 | | | 0 |
| silicon | 1,590 | 1,080 | | | | | 0 |

Drifters number ≤ 13 in every world, and sky whales are 0 everywhere.

**Demo-time conversions:**

| Event | sim-s | Hybrid schedule (×1 → ×40 at 2:00) | Constant ×3 |
|---|---|---|---|
| strider ≥ 5% formed | 208–341 | 123–126 demo-s | 94–139 demo-s |
| one-body legs+horns+plates ≥ 5% | 601–863 | 133–139 demo-s | 225–313 demo-s (too late) |

×3 constant gives 375 sim-s by demo 150, so on that schedule only legs, plates, strider and spinner arrive in time.

**κ = 0 vs κ = 0.5:**
- **κ = 0:** identical dynamics, because the snap only touches look genes. *No* strider, spinner or rhino-lizard ever reads as "formed".
- **κ = 0.5:** strider at 208–622, spinner at 150–967, rhino-lizard at 960 in silicon.

So canalization doesn't speed up evolution. It makes the bodies selection already built *readable* about 5–10× sooner, which matches notes/01 §7.6 for look traits.

**Basins activated by affinity (round2) vs by occupancy (round2b):**
- **By affinity:** almost nothing forms except the founder worm. Selection fills the **strider** basin in every world (about 50–75% of bodies sit within capture radius). The affinity table never picks it for rhino, dusk, silicon or earth, so those bodies never get canalized.
- **By occupancy:** the canalized basins follow selection. This is also the honest version: selection chooses, development tidies.

**Niches:**
- The canopy pool made long legs pay everywhere: a strider monoculture plus worms and a few rhino-lizards.
- Niche-off control (round2, cap 1,000): bestiary divergence between presets drops from 0.61 to 0.50.
- **Bestiary distance** (basin census, cap 3,000): 0.59–0.63 between presets vs 0.18–0.22 within. That passes F §8's "within < 0.4" well, and sits right at the "> 0.6 between" threshold.

**Trophic levels:**
- Hunters persist only in dusk (H 0.9) and frozen, where hunters are in the F 5–35% band 33–62% of the time.
- In rhino, earth and silicon there is **no hunter tier**. Horns-as-defence plus inducible armour took away the predation payoff at medium Hunger. Round 1 had hunters there at 26–48 s.
- Cap 1,000 is fragile: dusk went extinct in 2 of 3 round-2 configs.

**Never reached in any config (75 + 30 runs):**
- **sky whale:** median body size stays 0.17–0.20 m
- drifter beyond a handful
- buoyancy: float fraction ≈ 0 even in Methane
- one-body legs+horns+plates at ≥ 20%

The causes:
1. **Size is selected against by generation time.** Reproduction time scales with M^0.25, and under a full-cap, turnover-limited ecology, fast breeders win. The cold + O basal bonus (≤ 30%) and the gape refuge don't outweigh that.
2. **The gas-bag gate (buoy ≥ 0.6) is a fitness valley.** buoy 0.2 → 0.6 is unselected drift that costs upkeep, so nothing crosses it.

### Atlas fauna under the hybrid

| Pin | Verdict |
|---|---|
| fauna-01/07 striders | **reached everywhere** (too much: it's the dominant form) |
| fauna-02 rhino-lizard | 180–330 bodies per world in the basin, and the one-body legs+horns+plates combination is ≥ 5% by 601–863 sim-s (rhino, dusk). But it reads as "formed" in only 1 preset (silicon, 960 s). **Partial.** |
| spinner (DESIGN §4) | reached (κ 0.5) |
| fauna-08 eels / swimmers | reached as a minority (swimmer basin formed 133–559 s) |
| fauna-06 plated hopper | absorbed into the strider and rhino-lizard basins. There is no hopper basin in this round. |
| fauna-05 frilled serpent, eco-09 hunter | only in dusk |
| fauna-03 jellybots / drifters | **not reached** (single digits) |
| fauna-09 sky whales | **not reached** |

### Verdict: conditional GO for the hybrid

The hybrid meets the brief for **ground body plans**. By demo 150 s on the ×1 → ×40 schedule it delivers:
- legs, horns and plates, each ≥ 20%
- legs+horns+plates in one body ≥ 5%, in Water and Ammonia worlds
- readable striders and spinners
- distinct bestiaries per preset
- 5–23% unnamed forms
- stable populations at cap 3,000

It is **NO-GO for buoyant giants and drifters** as specified, and its **hunters vanish at medium Hunger**. Both need the fixes below before the sky-whale or hunter demo beats are promised.

### Exact recipe (tested values, with the untested fixes marked)

1. **Engine:** σ ×2.5 always on, animal cap **3,000** (1,000 is unstable at high Hunger), cap/4 founder worms across the dish, ledger fix `plate_build 0.05, plate_mass 0.15, k_dis 0.15`.
2. **Basins:** 7 body basins (`BASINS` in the script), capture RMS 0.25, look-only snap with **κ 0.5** ramped by growth.
   - **Activate the top-3 non-worm basins by occupancy every 10 s, not by authored affinity.**
   - "Formed" thresholds: body RMS < 0.15, look RMS < 0.20.
   - Show "unnamed form" outside the capture radius.
3. **Niches:** ground / liquid / aerial (0.6 K) / canopy / stone dens, as above.
   - **Untested:** cut the canopy pool to about 0.3 K so striders stop being a monoculture.
4. **Biology:** horns as defence, gape as weapon, eye regression in the dark, TSR by medium, and size ×(1 + 0.5 o), all as built.
   - **Untested:** gate inducible armour to Hunger > 0.6 and raise the gape weapon (0.5 + 1.5·gape) so medium-Hunger worlds keep a hunter tier.
5. **Giants and floaters (untested, required):**
   - (a) In thick-air worlds, seed one buoyant founder lineage (buoy 0.7, F's own fallback).
   - (b) Replace the hard gas-bag gate with a smooth hover cost.
   - (c) Give size a payoff that beats the M^0.25 generation penalty: litter size ∝ S, or lifespan × (1 + (1 − heat)).
6. **Schedule:** ×1 until 2:00, then ×40 in a Worker at dt 0.25 (160 ticks/s, about 2.4 ms/frame at 3k agents, by F's per-agent estimate).
   - ×3 constant is not enough for the one-body rhino-lizard. It needs about ×5 (601/125).

**Caveats:**
- It's still a toy with my coefficients.
- Basin centres and thresholds are authored, and the strider dominance is partly my canopy coefficient.
- "Formed" depends on the thresholds. Strict thresholds (round2) gave almost nothing; round2b's looser ones gave the table above.
