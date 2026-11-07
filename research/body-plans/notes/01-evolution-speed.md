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
6. **Direction update (§7):** the templated-species idea works if the archetypes are **developmental attractors** (Waddington canalization, κ ≤ 0.5, look parameters only), never fitness targets. Then it's honest, and it cuts "first readable archetype" from about 40 to about 12–15 gens (≈3×). Behaviour: one shared FSM with utility-scored, gene-weighted transitions and boids inside states.

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

## 7. Direction update: template-attracted species from tiny capsules (with state-machine behaviour)

> Proposal (coordinator, 2026-11-07): "tons of tiny capsule/worm-like creatures slowly moulding larger into a variety of procedural species, templated from our fauna categories (drifter, swimmer, spinner, grazer, hunter, builder, strider, rhino-lizard, sky whale); each species' behaviour controlled by a state machine."

### 7.1 Verdict

**Good idea, if the templates live in development and not in fitness.** Template archetypes should be **attractors in `develop()`**: a declared developmental bias, Waddington-style. Selection still decides which basin each lineage falls into. Templates must never be targets that selection pulls toward, and never something the dials pick directly.
- Done this way, it is honest (it's the same kind of authored rule as the Hox layout already in the honesty box). It's also legible, and it fixes the slowest part of the problem: the *unselected* "look" traits that otherwise drift for hundreds of generations.
- Done the other way (fitness = distance to template, or `if dial > x → rhino-lizard`), it is the thing the critique marked C down for: "morphology decided by `if` statements, not by the field" (README §2.1). Target-based evolution is also known to work *worse* (§7.3).
- **Speed gain** `[INFERRED]`, to be measured in `prototype/`:
  - about **1.5–2×** on selected traits
  - about **10×+** on unselected aesthetic traits
  - about **3×** overall on "first readable rhino-lizard/strider" (≈40 → ≈12–15 gens)
- It does **not** shorten the ecological critical path (prey → hunters → horns). That still needs §5.

### 7.2 Precedents: archetype-based procedural creatures

| System | How templates work | Real evolution? | Lesson for F | Tag |
|---|---|---|---|---|
| **Spore** (Maxis 2008) | Free part placement on a spine. Animation is *retargeted* at runtime to any user morphology (Hecker et al. 2008 *ACM TOG* 10.1145/1360612.1360626). Archetypes are implicit in the part catalogue | No: the player designs it (the Cell → Creature stage is editor-driven) | Procedural gait for arbitrary bodies is solved and published. Spore is "seen-before", so F must *show* selection doing the work | `[PEER]` (animation) / `[POP]` (design) |
| **No Man's Sky** (Hello Games 2016→) | Hand-authored skeleton **archetypes** (quadruped, hexapod, biped, flyer, swimmer, etc.), each with swappable part variants and procedural bone scaling. Animation is authored per archetype (GDC 2017 talk, "Continuous World Generation in No Man's Sky", and press) | No: seeded sampling | A small set of rigs plus parameterised parts is enough for apparent variety at scale. Variety *within* an archetype is what players notice | `[POP]` |
| **Species: ALRE** (Quasar) | One procedural skeleton template with continuous parameters (legs, neck, torso, head) | **Yes**: real selection, time-accelerated | The closest precedent to "templates plus real evolution". It shows a single template still reads as many species once proportions diverge. Novelty takes tens of minutes, because there are no basins and every look trait drifts | `[POP]` |
| **Sims 1994 / Framsticks** | Open graphs with no templates | Yes | Open-ended, but slow (hours) and often illegible | `[PEER]`/`[BOOK]` |
| **MAP-Elites niches** (Mouret & Clune 2015) | A grid of behaviour/morphology bins, one elite per bin | Yes (QD search) | The guide bins can act as basins, but in QD they're *archive cells*, not attractors. Good for the bestiary and menagerie, not for shaping bodies | `[PREPRINT]` |

### 7.3 Directed evolution toward targets: what the evidence says

- **Target-based fitness is deceptive and slow.** Woolley & Stanley (GECCO 2011) took images that Picbreeder users had found interactively, such as a skull, and tried to evolve them directly as targets from scratch. It failed: the representations that fitness-pressure produced were worse, and the target was not reached `[PEER]` (DOI not verified) **consensus** within the novelty-search literature. Lehman & Stanley 2011 make the same point in general.
  - Implication: don't add "distance to rhino-lizard" to the ledger.
- **Changing goals speeds evolution.** Kashtan, Noor & Alon 2007 *PNAS* (10.1073/pnas.0611630104) found that modularly varying goals greatly speed evolution compared with a fixed goal. Kashtan & Alon 2005 *PNAS* (10.1073/pnas.0503610102) found that varying goals also produce modular structure `[PEER]` **plausible** (shown in model systems).
  - Implication: the presenter's dial moves are an accelerator, not just a spectacle. This argues for **several basins tied to the environment** rather than one target.
- **Interpolation in morphospace.** One option is a genome of barycentric weights over the 9 archetypes. It's very fast (a 9-simplex) but produces chimeras, and it reads as a blend slider, i.e. a character creator. `[INFERRED]`: don't use it as the *only* encoding. Basins with soft capture (below) give the same speed, keep a free residual, and keep "unclassified" forms.

### 7.4 Scientific framing: templates as attractors (canalization, convergence)

| Idea | Source | What it licenses | Tag / status |
|---|---|---|---|
| **Canalization / epigenetic landscape** | Waddington 1942 *Nature* 10.1038/150563a0; Waddington 1957 *The Strategy of the Genes* `[BOOK]` | Development funnels genetic variation into a few robust end states (valleys). A soft snap in `develop()` *is* a canalized landscape | `[PEER]` consensus (canalization exists) |
| **Developmental bias** | Uller, Moczek, Watson, Brakefield & Laland 2018 *Genetics* 10.1534/genetics.118.300995 | The genotype → phenotype map makes some forms far more likely than others, which shapes evolution's direction | `[REVIEW]` plausible (its relative importance is debated) |
| **Evolution "learns" attractors** | Watson & Szathmáry 2016 *TREE* 10.1016/j.tree.2015.11.009; Parter, Kashtan & Alon 2008 *PLoS Comput Biol* 10.1371/journal.pcbi.1000206 | Past selection biases development towards phenotypes that were useful before (facilitated variation). Archetypes can be framed as "what this rule-set's ancestors already learned" | `[REVIEW]`/`[PEER]` plausible |
| **Convergent evolution / limited forms** | McGhee 2011 *Convergent Evolution: Limited Forms Most Beautiful* (MIT Press, 10.7551/mitpress/9780262016421.001.0001) `[BOOK]`; Conway Morris 2003 *Life's Solution* `[BOOK]` | Functional and developmental constraints mean the same few forms evolve again and again (fusiform swimmers, crabs, sabre-teeth). "The same 9 kinds keep appearing across seeds" becomes a *scientific claim*, not an admission | consensus (convergence is common) / disputed (how predictable evolution is) |
| **Carcinisation** | Wolfe, Luque & Bracken-Grissom 2021 *BioEssays* 10.1002/bies.202100020 (≥5 independent origins in decapods, plus "decarcinisation"); Keiler, Wirkner & Richter 2017 *Biol J Linn Soc* 10.1093/biolinnean/blw031 | A crisp slide example of an attractor body plan, reached repeatedly *and lost again* | `[REVIEW]`/`[PEER]` consensus |
| **Empty morphospace** | Raup 1966 *J Paleontol* 40:1178 (no DOI) | Most theoretically possible shell shapes are never occupied, so real morphospace is clustered | `[PEER]` consensus |
| **Homeotic switches** | Lewis 1978; Antennapedia (legs replacing antennae) | Small genetic change → a whole module swaps identity. This justifies a *snap* at the basin edge rather than only a smooth creep | `[PEER]` consensus |
| **Growth from small juveniles** | allometry/heterochrony (textbook); Bongard 2011 *PNAS* (morphology change during life speeds evolution) | "Capsules moulding larger" = ontogeny: a juvenile capsule morphs into the adult basin form over the juvenile period | `[PEER]` plausible |

### 7.5 How to build it (recommended)

1. **Morphospace coordinates.** Compute 5 derived axes from the 32 genes:
   - elongation · limb index (pairs × length) · armour (plateCover × size) · buoyancy · radial symmetry
   - plus diet t, which acts as a *role* axis, not a body axis
2. **Basins = body archetypes on the body axes only:** worm/serpent, swimmer, strider, rhino-lizard (heavy plated quadruped), spinner (radial), drifter/bell, sky whale.
   - **Roles** (grazer, hunter, builder, filter-feeder) are *not* body templates. They come from diet t, gape and the Si·O builder flag, and can combine with any body (plated hunter-strider, builder-worm).
   - The 9 categories mix two axes, so splitting them avoids "every hunter looks the same" and keeps contingency.
3. **Soft capture in `develop()`:**
   - `x' = x + κ·w(d)·(a* − x)` on the look parameters, where `a*` is the nearest basin centre in normalised morphospace, `d` is the distance to it, `w(d) = smoothstep(r, 0.5r, d)`, the capture radius `r` ≈ 0.35, and **κ ≤ 0.5**.
   - Outside `r`, there is no snap: unclassified forms exist and are labelled "unnamed form".
   - The ledger uses the *developed* (snapped) phenotype, so the snap is real physiology, not a render fake.
4. **What may be canalized:**
   - *look/proportion* parameters: neck/head proportion, limb taper, plate tiling, silhouette radius profile, gait style
   - *never* the cost-bearing quantities that decide fitness directly: plateCover, size, limb length, hornLen, diet. Those stay raw-genome and selected.
   - About 60 % of the visible shape is canalized and 100 % of fitness is selected.
5. **Ontogeny.** Newborns are capsules (segN-long, radius from comp). Over the juvenile period `3 s·S^0.25`, the body morphs capsule → adult with an ease-out. Tiny capsules everywhere, slowly maturing into species, is a strong visual. It's also cheap: juveniles share one LOD mesh.
6. **Honesty instruments:**
   - **Neutral control run.** Run the headless sim with the ledger flattened (all traits free). Basin occupancy should then track basin volume. With dials on, it should diverge from that. A Vitest assertion should check this.
   - The guide shows a "% unnamed forms" counter.
   - Honesty box addition: "*designed developmental attractors (7 body basins, κ ≤ 0.5, look parameters only); which basin a lineage reaches is selected*".
7. **Counts ("tons of tiny").** At 0.3 ms per 1k agents per tick (F's estimate), 2,000 agents at ×3 is about 36 ms per real second, which is fine. Above 2k, neighbour queries dominate, so move steering to a Worker or GPU. Most of the "tons" can be juveniles with a cheaper 5 Hz behaviour tick.

### 7.6 Speed gain (arithmetic, `[INFERRED]`)

- A readable archetype needs about 4–6 traits past threshold. Take a rhino-lizard: 2 limb pairs, plates, size, a stocky profile and a short neck.
- **Selected components** (plates in Water, limbs vs crawl cost) creep at Δz ≈ 0.04/gen (§3). Each needs about 10 gens, mostly in parallel.
  - With capture at 50–60 % of the way (κ = 0.5, r = 0.35), they read as finished after about 5–6 gens: **≈1.5–2×**.
- **Unselected components** (profile, neck, taper) only drift. Drift time to move Δ ≈ 0.4 at per-gen σ_eff ≈ 0.03 is about (Δ/σ)² ≈ **180 gens**, longer than the whole demo. That's why open-ended sims look like blobs for so long.
  - Canalization fills them in as soon as the selected axes enter the basin: **≈10×+**.
- **Overall:** first readable strider/rhino-lizard at about 12–15 gens instead of about 40+. On the §5 clock (≈0.75 gen/s), that's about 0:55–1:00 instead of about 1:30+.
- **Not shortened:** hunters needing prey, and horns needing hunters. Sky whales still need size and buoyancy creep, so they still need ⏩.

### 7.7 Behaviour: FSM vs behaviour tree vs utility for about 1–2k agents

| Approach | Fit for F | Precedent | Tag |
|---|---|---|---|
| **Finite state machine** (Wander/Forage/Flee/Chase/Rest/Bud/Build/Drift) | **Yes, as the skeleton.** One `Uint8` state per agent in SoA, a switch per tick, cache- and GPU-friendly, trivially debuggable (colour by state in `#debug`) | GPU crowd FSMs for thousands of agents: "March of the Froblins" (Shopf, Barczak, Oat & Tatarchuk 2008, SIGGRAPH course, 10.1145/1404435.1404439) | `[PEER]`-ish (course notes) |
| **Utility scoring for transitions** | **Yes.** Each state's score = gene weight × context (e.g. Flee = Hunger·threat·(1 − boldness)). The highest score wins, with hysteresis. This is F's existing weighted-steering sum made discrete, and the gene weights let **behaviour evolve too** | Mark 2009 *Behavioral Mathematics for Game AI* `[BOOK]`; Rain World creatures use per-creature AI modules with threat/relationship tracking feeding procedural animation (Jakobsson, GDC talks) `[POP]` | `[BOOK]`/`[POP]` |
| **Behaviour trees** | **No** for the crowd. They suit a few rich NPCs; per-agent tree traversal is branchy and costs authoring time | Isla 2005, Halo 2 AI (GDC) | `[POP]` |
| **GOAP / planners** | No: too costly for 1k agents per tick | Orkin 2006, F.E.A.R. (GDC) | `[POP]` |
| **Boids steering inside states** | **Yes.** Each state sets the steering weights (cohesion and alignment from sociality) | Reynolds 1987 (10.1145/37402.37406) | `[PEER]` consensus |

**Recommendation:** **one shared FSM**, with states unlocked by morphology (Drift only if buoyant, Build only if Si·O, Chase only if t > 0.4 and gape > 0). Transitions are **utility-scored from genes and context**. Steering inside states is boids. Behaviour then emerges from the same genome, and nobody authors a "rhino-lizard AI".
- **Per-species FSMs** (one hand-written machine per template) would be faster to tune but are *authored behaviour per category*. That would need a line in the honesty box and weakens the emergence claim. Use them only as a fallback for the two discovery-plate species.

### 7.8 How much template vs open-ended

| Layer | Template-attracted | Open-ended / selected |
|---|---|---|
| Fitness / ledger | **0 %** (no distance-to-template term, ever) | 100 % |
| Which basin a lineage reaches | 0 % (selection plus contingency) | 100 % |
| Cost-bearing traits (size, plates, limb length, horns, diet, buoyancy) | 0 % | 100 % |
| Look/proportion parameters inside a basin | **≤ 50 % (κ ≤ 0.5)**, only within capture radius | the remainder, plus all colour/pattern/eye/frill genes |
| Bodies outside every basin | 0 % (no snap) | shown as "unnamed forms" (target 15–30 % of animals) |
| Behaviour | shared FSM *structure* (authored, declared) | utility weights are genes |

**Honesty check:** if you can't say "a different seed under the same dials could have filled a different basin, and a flattened ledger fills basins only by their volume", the templates have become targets. The neutral-control test in 7.5.6 makes that sentence true and testable.

## 8. Open questions / next round

1. **Does F's 0.3 ms/tick hold?** The whole recipe assumes ×3 on the main thread and ×40 in a Worker. Measure it in `prototype/` first.
2. **Real s values in the ledger.** The arithmetic needs s ≥ 0.3 per target trait. Nobody has measured the authored coefficients yet. The tuner should report time-to-trait distributions over seeds, not single runs.
3. **Does ×3 baseline speed read as frantic?** If it does, compress lifespans and juvenile time (generation compression) instead of tick rate. That gives the same generation count with ×1 motion.
4. **Contingency vs reliability.** Standing variation and smooth gradients make results reliable, but they may erase the "different seed, different apex" story (Polyworld-style contingency) that F sells. Measure apex-body diversity across 10 seeds.
5. Run parameters marked *(recalled)* in §2, especially Sims' 300/100/3 h, Cheney's 30/1,000 and Lenski's 3,600/16,000, need checking against the PDFs before they go on a slide.

## Sources

See `data/evolution-speed.json` → `sources` for the full list with DOIs (Crossref-verified 2026-11-07).
