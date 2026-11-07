# 01 · Time-to-complexity: how fast can body plans evolve, and what makes it fast?

Round 1 · 2026-11-07 · axis: F's risk #1 ("horns, legs and plates may not evolve from a worm founder inside a 3-minute demo", `docs/emergence/README.md` §4.7).
Tags follow `research/silicon-life/README.md`: `[PEER]` `[REVIEW]` `[PREPRINT]` `[BOOK]` `[POP]` `[INFERRED]`; status **consensus / plausible / disputed / refuted**.
DOIs were checked against Crossref on 2026-11-07. Abstracts came from OpenAlex. Run parameters marked *(recalled)* come from the paper bodies as I remember them, not from the abstracts. Check them before they go on a slide. The game rows are mostly `[POP]`/`[INFERRED]`: Steam and dev sites gave no usable text in the time box.

Structured data: `research/body-plans/data/evolution-speed.json`.

---

## 1. Bottom line

1. **The ceiling isn't the problem. The critical path is.** Plates and limbs can evolve in parallel. Horns can't: they need a hunter niche first. So the order is diet shift → hunters → horns, and each step is its own selective sweep. That's about 2 sweeps × 10–15 generations. `[INFERRED]` from sweep arithmetic (§3).
2. **Generation count matters. Population size barely does.** At ×1, F's generations last 10–20 s, so a 3-minute run gives about 10 generations. That's too few for two back-to-back sweeps. With N ≈ 800 and p = 0.3 per gene, mutation supply is never the limit. Sweep time depends on N only through ln N. `[INFERRED]`, consensus population genetics (Haldane 1927, Gerrish & Lenski 1998 `[PEER]`).
3. **F is structurally faster than Sims-style evolution.** F's agents are points, and the ledger maps morphology straight to locomotion cost. There's no neural controller that has to re-adapt after every body change. The co-adaptation drag that slowed Sims and every successor is therefore gone (Cheney et al. 2018 `[PEER]` name it as *the* obstacle). F's genome is 32 bounded floats, and every genome develops into a viable body. `[INFERRED]` **plausible**.
4. **Visible novelty doesn't need fixation.** Offspring are placed near their parents, so a new trait shows up as a local patch. Ten horned animals together read as "horns evolved" even at 1–2 % of the whole population. Getting to that level takes about ln(local cluster)/s ≈ 5–8 generations, not the 30–70 that full fixation needs. `[INFERRED]` **plausible**: this is what makes a 150 s window viable.
5. **Recommended recipe (§5):** N = 800 · generation time of about 4 sim-s for small bodies · baseline ×3 sim speed (60 ticks/s) · per-gene p = 0.3 with σ = 0.06 plus a 10 % Cauchy tail · segment duplication 0.03, Hox shift 0.05, new limb-pair duplication 0.02 · founders with standing variation, some of whom already straddle the limb threshold · strong ledger selection (s ≥ 0.3 in-niche) · stress mutagenesis made **per-parent** (triggered by starvation) instead of a global timer · ⏩ ×40 deep time for the giants. Expect legs by about 1:00, plates by about 1:10 (Water), horns by about 1:35, and buoyant giants only after deep time. Arches still need the pre-evolved menagerie.

---

## 2. Literature: how many generations did body-plan novelty take?

| Study | What evolved | Pop × gens | Wall clock | What made it work | Tag |
|---|---|---|---|---|---|
| Sims 1994a SIGGRAPH; 1994b *Artif Life* 1(4) | 3D morphology plus neural control (swim, walk, jump, follow; competition for a cube) | 300 × 50–100 gens, top 20 % survive *(recalled)* | about 3 h per run on a 32-processor CM-5 *(recalled)* | Directed-graph genome with **recursion**: one node can be expressed N times, which gives segments and limb series cheaply. That's a Hox analogue. Coevolution in 1994b produced "strategies and counter-strategies" | `[PEER]` consensus |
| Lipson & Pollack 2000 *Nature* | Bar-and-actuator robots (locomotion), then physically built | ~hundreds of gens *(recalled; not verified)* | days of CPU in 2000 | Simple fixed part vocabulary | `[PEER]` |
| Stanley 2007 *GPEM* (CPPN); Stanley et al. 2009 *Artif Life* (HyperNEAT) | Indirect "developmental" encodings that produce symmetry, repetition and repetition-with-variation | n/a (encoding papers) | — | **Regularity is cheap**: one gene change shifts a whole repeated pattern | `[PEER]` consensus |
| Cheney, MacCurdy, Clune & Lipson 2013 GECCO "Unshackling evolution" | Multi-material voxel soft robots (locomotion) | 30 × 1,000 gens *(recalled)* | hours (VoxCAD) | CPPN beat a direct encoding on speed and gave more natural forms. Cost functions changed diversity | `[PEER]` consensus |
| Cheney et al. 2018 *J R Soc Interface* | Morphology plus control co-optimisation | — | — | **Morphological innovation protection**: lower the selection on newly reshaped bodies so control can catch up. Shows that body–brain mismatch is the brake | `[PEER]` plausible |
| Lehman & Stanley 2011 *Evol Comput* (novelty search); 2011 GECCO (NS + local competition) | Diverse locomoting creatures in one run | not verified | — | Rewarding divergence, plus competing only with morphological neighbours, avoids convergence on one easy body. In nature (and in F), density-dependent competition is local competition | `[PEER]` consensus |
| Mouret & Clune 2015 (MAP-Elites, arXiv:1504.04909); Cully et al. 2015 *Nature* | Quality-diversity archives (one elite per behaviour/morphology bin) | thousands of gens | hours | Keeping a cell per niche keeps stepping stones alive. F's **guide bins** are a MAP-Elites grid by another name | `[PREPRINT]`/`[PEER]` consensus |
| Brant & Stanley 2017 GECCO (minimal criterion coevolution) | Open-ended maze/agent coevolution | — | — | Reproduction gated by a minimal criterion instead of a fitness rank. F's `E > 1.5·M` rule already is one | `[PEER]` plausible |
| Lenski, Ofria, Pennock & Adami 2003 *Nature* (Avida) | Complex logic function EQU, built from simpler functions | 50 pops × 3,600 orgs, 16,000 updates *(recalled)* | hours | EQU evolved in 23 of 50 populations, **only when the simpler stepping-stone functions were rewarded**. With no rewards for intermediates, it never evolved *(recalled)* | `[PEER]` consensus |
| Zaman et al. 2014 *PLoS Biol* (Avida) | Complexity under host–parasite coevolution | — | — | Coevolution "greatly increases organismal complexity" compared with no parasites. The arms race is an accelerator | `[PEER]` plausible |
| Auerbach & Bongard 2014 *PLoS Comput Biol* | Morphological complexity vs environment | — | — | Complex bodies evolve only where the environment rewards them. Flat worlds give simple bodies | `[PEER]` plausible |
| Bongard 2011 *PNAS* | Robots that change morphology during life | — | — | Ontogenetic body change sped up the evolution of robust gaits | `[PEER]` plausible |
| Gupta et al. 2021 *Nat Commun* (DERL / UNIMAL) | Morphologies plus RL controllers in complex terrain | about 4,000 morphologies trained | very large compute | Shows the cost when each body has to *learn* to move. F avoids it | `[PEER]` |
| **Contrasts from biology** | | | | | |
| Lenski LTEE: Blount et al. 2008 *PNAS* | Cit+ key innovation in *E. coli* | ~31,500 gens before Cit+ appeared | about 15 years | Historical contingency: potentiating mutations came first. Key innovations are slow without stepping stones | `[PEER]` consensus |
| Sniegowski et al. 1997 *Nature* | Mutator (high mutation rate) alleles in the LTEE | 3 of 12 pops within 10k gens *(recalled)* | years | Mutation rate itself evolves by hitchhiking | `[PEER]` consensus |
| Nilsson & Pelger 1994 *Proc R Soc B* | Camera eye from a light-sensitive patch | about 364k gens (deliberately pessimistic) *(recalled)* | <0.5 Myr | Many small steps, each favoured, with no valleys. At 1 gen/s that's still 4 days, so a demo can't do incremental eye evolution. F's eye is a plastic reaction norm, which is correct | `[PEER]` consensus |
| Bell, Aguirre & Buck 2004 *Evolution* (Loberg Lake stickleback) | Armour plates lost after colonising freshwater | wild pop, ~11 annual gens | 1990→2001: complete morph 100 % → 11 %, low morph 0 → 75 % | **Standing variation** (the Eda allele, Colosimo et al. 2005) plus strong selection. Plates are a textbook fast morphological trait | `[PEER]` consensus |
| Barrett & Schluter 2008 *TREE* | Review: adaptation from standing variation | — | — | Faster than waiting for new mutations: alleles are already present at higher frequency, and pre-tested | `[REVIEW]` consensus |
| Losos et al. 1997 *Nature* (Anolis islands) | Limb length matched to the new vegetation | ~10–14 years | — | Limb proportions respond within about 10 generations | `[PEER]` consensus |
| Gomez et al. 2008 *Nature* | Snake segment number (~300 vertebrae) | — | — | A faster segmentation clock relative to growth: **one parameter changes segment count a lot**. Grounds F's `segN` and segment duplication | `[PEER]` consensus |
| Lewis 1978 *Nature*; Kirschner & Gerhart 1998 *PNAS*; Wagner & Altenberg 1996 *Evolution* | Hox segment identity; evolvability; modularity | — | — | Modular, weakly linked, duplicated parts let variation arrive without breaking the body (facilitated variation) | `[PEER]` consensus (Hox), plausible (evolvability as selected) |
| Dawkins & Krebs 1979 *Proc R Soc B*; Van Valen 1973 (Red Queen) | Arms races | — | — | Predator–prey escalation sustains directional selection. Without it, selection stops at the first local optimum | `[PEER]` consensus (escalation exists), disputed (that it raises complexity in general) |

### What makes evolution fast (synthesis)

| Lever | Evidence | In F today? | Recommendation |
|---|---|---|---|
| **Short generations** | everything; time-to-trait scales with generation count | ×1: 10–20 s/gen | about 4 sim-s for small bodies, ×3 baseline (§5) |
| **Strong selection (big s)** | sweep time ≈ 2 ln N / s; stickleback, anoles | ledger coefficients untuned | tune so the target trait has s ≥ 0.3 in its niche (measured headless) |
| **Standing variation** | Barrett & Schluter 2008; Bell 2004; Colosimo 2005 | founder variance from copier mis-pairing is "narrow worm range" | founders spread on limb/plate/size genes, and about 15 % already have a non-empty limb domain |
| **No fitness valleys / reward intermediates** | Lenski 2003; Nilsson & Pelger 1994 | limbs gated by `g10 > g9`, so a threshold must be crossed by drift | make limb buds pay a little at any length, so crawl cost falls smoothly |
| **Modular / indirect encoding, repetition by duplication** | Sims 1994 recursion; Stanley 2007; Cheney 2013; Gomez 2008; Lewis 1978 | segment duplication 0.03, Hox shift 0.05 | add limb-pair duplication 0.02 |
| **No controller to re-learn** | Cheney 2018; Gupta 2021 (cost when there is one) | yes: procedural gait plus ledger | keep. It's F's biggest speed advantage over Sims |
| **Heavy-tailed mutations** | Yao, Liu & Lin 1999 *IEEE TEC* (Cauchy "fast EP" escapes plateaus faster) | Gaussian σ = 0.05 | 10 % of mutations Cauchy(0, 0.12), clamped to [0,1] |
| **Stress-elevated mutation** | Rosenberg 2001; Galhardo et al. 2007; Bjedov et al. 2003 (most of 787 natural *E. coli* isolates mutate more when aged/starved) | global ×2.5 for 12 s after a dial move | per-parent: offspring of energy-starved parents get σ ×2.5 (§6) |
| **Coevolution / arms race** | Sims 1994b; Zaman 2014; Dawkins & Krebs 1979 | hunters only after Hunger > 0.6 | allow low-level opportunistic predation from about 0:50, so the arms race starts earlier |
| **Local competition / niches** | Lehman & Stanley 2011; Mouret & Clune 2015 | density-dependent food on a 64² grid | keep. Births within about 2 m of the parent so novelty is spatially clustered |
| **Population size** | rate ∝ ln N (sweeps); N·μ ≫ 1 already | 1,024 cap | 800 is enough. Spend the CPU on more ticks, not more agents |

---

## 3. Arithmetic: how long does a sweep take in F?

All `[INFERRED]`. The numbers use standard haploid/asexual selection, which matches F's asexual budding.

- **Mutation supply.** With per-gene p = 0.3 and N = 800, every gene gets about 240 mutations per generation. A beneficial direction is sampled immediately, so arrival is never the bottleneck. Establishment probability is about 2s per favoured mutant (Haldane), so with s = 0.3 a new beneficial variant establishes about 60 % of the time.
- **Sweep (logistic).** Going from 1/N to frequency f takes `t ≈ ln(f·N)/s` generations.
  - N = 800, f = 10 %: 15 gens at s = 0.3, 9 at s = 0.5, 44 at s = 0.1.
  - Full fixation (`2 ln N / s`): 45 gens at s = 0.3.
  - **Local visibility.** About 10 related animals in a patch of ~50 is f_local ≈ 20 % from 1–2 founders, which takes about 5–8 gens at s = 0.3. That's what the camera sees.
- **Quantitative creep** (horn length, plate cover, size). Mean shift per gen is `Δz ≈ i·σ_g`.
  - Baseline: V_m = p·σ² = 0.3·0.05² = 7.5e-4/gen. After about 5–10 gens, σ_g ≈ 0.04–0.06. With intensity i ≈ 0.8, Δz ≈ 0.035–0.05/gen.
  - `hornLen` from 0 to a readable 0.4 (horn = 0.24·S): about 8–12 gens.
  - With stress σ ×2.5: about 4–5 gens.
  - So F's claim "horns in about 25 s instead of 2 min" is consistent *if* a generation is about 5–6 s **and** horns already pay (hunters exist).
- **The critical path for horns.**
  1. Diet t has to rise until hunting pays: about 10 gens, or 0 with the "tasted meat" fallback.
  2. Then horns creep: about 5–10 gens.
  3. Then prey plates respond: about 5–10 gens, in parallel with step 2.

  That's 15–20 gens from the Hunger dial move to visible horns. At ×1 with 15 s gens, that's 225–300 s and **fails the demo**. At ×3 with about 4 sim-s gens (≈0.75 gen per real second), it's 20–27 s and **fits**.
- **Giants and buoyancy.** Lifespan `30 s·S^0.25` and the juvenile period both grow with S, so the biggest lineages have the slowest generations. At S = 8 m, a generation is about 1.7× a worm's. Size is a log gene, so getting from 0.15 m worms to giants (g1 → 0.8) needs a creep of about 0.5. At Δz ≈ 0.04 that's about 12 gens of *consistent* cold selection, plus buoyancy (g25) creeping as well: about 25 gens total, partly sequential. That only fits inside ⏩ deep time.
- **CPU check.** F estimates 0.3 ms/tick for 1,024 agents (unmeasured).
  - ×3 = 60 ticks/s, about 18 ms per real second: fine on the main thread.
  - ×40 = 800 ticks/s, about 240 ms per real second: needs the Worker.
  - The headless claim of "180 s in about 1 s" (≈3,600 ticks/s) would allow pre-evolving 30 sim-min per preset in about 10 s at build time.

**Budget comparison.** N = 800 over about 100 generations is about 80k births. Sims got walking/swimming morphologies from 300 × 100 = 30k evaluations, and Cheney from 30 × 1,000 = 30k. F's demo budget is the same order of magnitude, in a search space that's far smaller (32 bounded floats vs open graphs) and has no controller. `[INFERRED]` **plausible**: in the literature's terms, F has enough evaluations.

---

## 4. Precedents in games and ALife sims with real body evolution

| Name | What evolves | Time to visible novelty | Pop | Tricks | Tag |
|---|---|---|---|---|---|
| **Karl Sims (1994)** (research, not a game) | body plus brain | hours (CM-5) | 300 | fitness function, recursive graph genome, coevolution | `[PEER]` |
| **Species: ALRE** (Quasar, 2018) | 3D bodies (limb length, torso, neck, head, colour) plus behaviour weights, in a fixed skeletal template | tens of minutes to hours of fast-forward before speciation is visible; ×N time acceleration is central *(recalled from dev blog; unverified)* | hundreds to about 1–2k | fixed body-part vocabulary (procedural skeleton plus params), time acceleration, player "intervention" tools (kill, feed, mutate), and species tracked by genetic distance | `[POP]` |
| **Thrive** (Revolutionary Games, OSS) | microbe organelles and membranes. The player species is designed by the player in an editor; AI species change via "auto-evo" between generations | each editor session (minutes), but it's player-authored | small | player selection/design, and auto-evo is a statistical model, not an agent sim | `[POP]` |
| **The Bibites** (Leo Caussan) | NN brain plus scalar genes (size, colour, diet, view angle/range, metabolism). The body is a fixed circular template | behaviour/diet niches in about 10–60 min at accelerated speed *(community reports; unverified)* | ~100–500 | time acceleration, fixed body, energy economy with herbivory/carnivory gene, pellet food | `[POP]` |
| **Gene Pool / Swimbots** (Jeffrey Ventrella) | 2D articulated swimbot bodies plus motor phase genes | coherent swimming in minutes to tens of minutes at fast speed *(recalled)* | ~hundreds | **sexual selection by mate choice** (colour preference), food-chasing; the physics is the fitness | `[POP]` |
| **Polyworld** (Yaeger 1994) | NN brains plus a few body genes (size, strength, colour); fixed polygon bodies | behavioural "species" over thousands of timesteps, hours | ~dozens to 300 | **seeding with a steady-state GA until the ecology is self-sustaining**: a midwife cheat with academic precedent | `[BOOK]` (ALife III proc.) |
| **Framsticks** (Komosinski & Ulatowski) | 3D stick bodies plus neurons, several genetic encodings | hours to days for complex forms | user-set | user-set fitness/mutation (Wikipedia: "primarily through artificial selection"), multiple encodings including developmental ones | `[BOOK]` (Springer chapter 10.1007/978-1-84882-285-6_5) |
| **Evolution** (Keiwan Donyagard) | NN controller only. **The player designs the body** | walkers in about 20–100 gens, at 10–30 s per gen with sim speed-up | 10–100 | the body is fixed by the player; batch simulation | `[POP]` |
| **Evolve 4.0** (Ken Stauffer) | 2D grid organisms with Forth-like code genomes (behaviour and growth) | hours | thousands of cells | very long runs; mostly code evolution | `[POP]` |
| **Biogenesis** (Joan Queralt) | 2D segment organisms (segment colour = function: green photosynthesise, red attack, etc.) | visible new segment shapes and predators in minutes to tens of minutes | ~hundreds | **fixed segment vocabulary**, energy economy, fast-forward | `[POP]` |
| **Darwin's Demons** (Soule et al., U. Idaho) | enemy sprites plus behaviour in a space shooter, evolved against the player | **every wave (seconds to a minute)** | ~tens per wave | the **player is the selection pressure** (survivors breed); 1 gen = 1 wave | `[POP]` |
| **Galactic Arms Race** (Hastings, Guha & Stanley 2009) | weapon particle systems (cgNEAT/CPPN) | new weapons each session, minutes | the players' collective usage | **player use = fitness**, CPPN encoding | `[PEER]` 10.1109/TCIAIG.2009.2038365 |
| **Picbreeder** (Secretan et al. 2011) | CPPN images | recognisable forms in about 10–100 user generations | 15 per screen | interactive selection, branching from others' results (stepping stones) | `[PEER]` 10.1162/EVCO_a_00030 |

**Pattern across precedents** `[INFERRED]`:
1. Every system that shows body novelty *in minutes* uses at least one of these:
   - a **fixed part vocabulary** (Species, Biogenesis, Spore-likes, and F)
   - **the player as selector** (Darwin's Demons, GAR, Picbreeder)
   - **heavy time acceleration** (Species, Bibites, Gene Pool)
2. Systems that evolve open-ended bodies *and* controllers (Sims, Framsticks, Cheney) take hours.
3. F already has the vocabulary, can add acceleration, and has the Hunger dial as an indirect player selector. That's the right quadrant.

---

## 5. Recommended evolution recipe for F

Each item says what it does and why. Numbers are starting points for the headless Vitest tuner (`prototype/`), not final values.

| Knob | Value | Why |
|---|---|---|
| Animals N | **800** (cap 1,024) | Supply is never limiting, and rate ∝ ln N. Spend the CPU on ticks |
| Generation time | **about 4 sim-s for founders** (juvenile 1.5 s, reproduce at `E > 1.2·M` for small S, and lifespan `12 s·S^0.25`) | ×1 at 10–20 s gives about 10 gens per demo, which is too few for 2 sequential sweeps |
| Sim speed | **20 Hz fixed step. Baseline ×3 (60 ticks/s) from founder birth. ⏩ ×40 in the Worker for 20 s at 2:00.** Optional ×1 "slow-mo" for close-ups | ×3 is about 0.75 gen/s real, about 100 gens by 2:50. ×40 deep time adds about 100–200 gens for giants |
| Per-gene mutation | p = 0.3. **σ = 0.06 Gaussian. 10 % of mutations Cauchy(0, 0.12)**, clamped | heavy tails jump plateaus (Yao et al. 1999) while keeping most children near the parent |
| Segment duplication | p = 0.03/birth (keep) | Hox/segmentation-clock analogue (Lewis 1978; Gomez 2008) |
| Hox domain shift | p = 0.05 (keep) | moves the limb domain one segment |
| **Limb-pair duplication (new)** | p = 0.02: copy an existing limb pair's identity to the next segment in the domain | Sims-style recursion. Gives 4-legged from 2-legged in one step |
| **Founder standing variation** | founders spread σ = 0.12 on g1, g9–g12, g14, g21, g24. About 15 % have `g10 > g9` (tiny buds) | standing variation is the fastest real route (Barrett & Schluter 2008; stickleback) |
| **Gradient everywhere** | limb buds of length > 0 reduce crawl cost smoothly (`crawl ×6 → ×(1 + 5·e^(−4·len/S))`). Horns of any length give a counter-damage share | no fitness valleys (Lenski 2003; Nilsson & Pelger 1994) |
| Selection strength | tune the ledger so the target trait has **s ≥ 0.3 in-niche**, measured headless as the reproductive-rate ratio | sweep to visible takes 5–15 gens only at s ≥ 0.3 |
| **Early arms race** | opportunistic predation allowed from about 0:50 (gape > prey size, t > 0.4) at low gain, so hunters have a gradient before Hunger is maxed | coevolution accelerates complexity (Zaman 2014; Sims 1994b) |
| Spatial births | offspring within 2 m of the parent. Food competition by grid cell | novelty clusters into readable patches, and local competition keeps diversity (Lehman & Stanley 2011) |
| Juvenile grace | newborns with a structural mutation (dup/shift) get 1 s of no-predation | morphological innovation protection (Cheney et al. 2018) |
| **Stress mutagenesis** | **per-parent:** if parent energy < 0.3·M at budding, child σ ×2.5. This auto-targets lineages a dial move just hurt. Keep the global 12 s ×2.5 shimmer only as a demo fallback | closer to SOS/RpoS biology (Rosenberg 2001), which is triggered by individual starvation |
| Midwives | Hox ×5 at 0:55 if no buds; "a grazer tasted meat" 40 s after Hunger > 0.6 (keep, declared) | analogues in §6 |
| Kill switch | pre-evolved menagerie per preset: 30 sim-min headless at build time (≈10 s each) | README §4.4.5 |

### Expected timeline (demo clock; founders at 0:35; Water + Si + cold-ish preset)

| Demo time | Gens since founder (≈0.75/s) | What should be visible | Driver |
|---|---|---|---|
| 0:35–0:38 | 0–2 | newborn size and facets change on Recipe/Heat moves | plasticity (not evolution) |
| 0:45 | ~8 | segment-count spread: serpents vs stubby worms | duplication plus standing variation |
| 0:55 | ~15 | **first limb-bud patch** near the origin | standing variation across the limb threshold plus smooth crawl gradient |
| 1:05–1:10 | ~22–26 | **plated Si lineages ≥ 25 % in Water**; legged grazers spreading outward | dissolution s ≥ 0.3 |
| 1:10 | — | presenter raises Hunger | — |
| 1:20 | ~34 | first hunters (or the "tasted meat" fallback at about 1:50 worst case) | diet t sweep, from early opportunism |
| 1:30–1:40 | ~41–49 | **horned/clawed hunter patch**; prey plates and shoals respond | arms race plus per-parent stress σ |
| 2:00–2:20 (⏩ ×40) | +100–200 | **size divergence; buoyant giants in cold, thick air**; 4+ guide bins | long-lifespan lineages need deep time |
| 2:35 | — | discovery plate picks the largest real organism | — |
| Living Arch | ≫ 200 | only via the menagerie (declared) | indeterminate growth is too slow |

**Pass criteria for the headless tuner** (suggested Vitest assertions, 10 seeds):
- ≥ 1 limbed lineage at ≥ 5 % by sim-gen 20 in ≥ 8/10 seeds
- plates ≥ 25 % in Water by gen 30
- horns `g21 > 0.35` in ≥ 10 hunters within 20 gens of Hunger > 0.6
- buoyant (`ρ_body < ρ_air`) lineage by gen 150 in the cold-methane preset

---

## 6. F's declared cheats: academic analogues

| Cheat | Real analogue | Strength of the analogy | Tag / status |
|---|---|---|---|
| **Stress mutagenesis** (σ ×2.5 after a dial move) | Bacterial stress-induced mutagenesis. The SOS response and RpoS up-regulate error-prone polymerases (Pol IV/DinB, Pol V) under starvation and DNA damage (Rosenberg 2001 *Nat Rev Genet* 10.1038/35080556; Galhardo, Hastings & Rosenberg 2007 *Crit Rev Biochem Mol Biol*). In 787 natural *E. coli* isolates, most mutate more under stress (Bjedov et al. 2003 *Science* 10.1126/science.1082240). In EC: self-adaptive mutation (evolution strategies) and heavy-tailed mutation (Yao 1999) | **Strong**: the mechanism exists. Whether it is an *adaptation* ("adaptive mutation") is **disputed**. Elevated mutation under stress is **consensus** in bacteria. Making it per-parent and starvation-triggered fits the biology better than a global timer | `[PEER]` consensus (mechanism) / disputed (adaptive) |
| **Hox midwife** (Hox-shift p ×5 if no limb buds by 0:55) | Hsp90 as a "capacitor" (Rutherford & Lindquist 1998 *Nature* 10.1038/24550): when Hsp90 is compromised, e.g. by heat stress, hidden variation shows up as **morphological** changes to *Drosophila* eyes, wings and legs, and selection then fixes them. Also mutator alleles rising when adaptation stalls (Sniegowski 1997) | **Medium**: real stress-released morphological variation. But F's trigger is "the designer saw no buds", not an organism's state. Reframe: trigger on *population stress* (mean energy low) rather than wall time, and call it a capacitor | `[PEER]` consensus (Hsp90 buffering exists) / disputed (how much it matters in nature) |
| **"A grazer tasted meat"** (one grazer set to t = 0.75) | Plasticity-first evolution: behaviour changes first, then genes follow (Levis & Pfennig 2016 *TREE* 10.1016/j.tree.2016.03.012; West-Eberhard 2003 `[BOOK]`). Natural opportunistic carnivory in herbivores is documented. Polyworld seeded with a GA until the ecology was self-sustaining (Yaeger 1994) | **Medium-weak**: a single hand-set individual is an *introduction/immigration* (EC: "random immigrants"), not plasticity. Better: let any grazer with gape > prey size and energy < 0.3·M opportunistically bite (a plastic behaviour), and let selection take t up from there. Then the fallback rarely fires | `[REVIEW]` plausible |
| Time ⏩ / deep time | Universal in ALife (Species, Bibites, Gene Pool). Real biology "runs" at generation time | n/a: presentation compression, honest if labelled | `[INFERRED]` |
| Pre-evolved menagerie | Picbreeder/Galactic Arms Race branch from archived results. MAP-Elites archives | Strong precedent for "evolved offline under the same rules" | `[PEER]` |

---

## 7. Open questions / next round

1. **Does F's 0.3 ms/tick hold?** The whole recipe assumes ×3 on the main thread and ×40 in a Worker. Measure it in `prototype/` first.
2. **Real s values in the ledger.** The arithmetic needs s ≥ 0.3 per target trait. Nobody has measured the authored coefficients yet. The tuner should report time-to-trait distributions over seeds, not single runs.
3. **Does ×3 baseline speed read as frantic?** If it does, compress lifespans and juvenile time (generation compression) instead of tick rate. That gives the same generation count with ×1 motion.
4. **Contingency vs reliability.** Standing variation and smooth gradients make results reliable, but they may erase the "different seed, different apex" story (Polyworld-style contingency) that F sells. Measure apex-body diversity across 10 seeds.
5. Run parameters marked *(recalled)* in §2, especially Sims' 300/100/3 h, Cheney's 30/1,000 and Lenski's 3,600/16,000, need checking against the PDFs before they go on a slide.

## Sources

See `data/evolution-speed.json` → `sources` for the full list with DOIs (Crossref-verified 2026-11-07).
