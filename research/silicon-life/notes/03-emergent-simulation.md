# 03 · Emergent simulation: which ALife models can show "element rules → life → ecosystem" in a 3-minute browser demo

Axis: which artificial-chemistry (AC) and artificial-life (ALife) models can make element-level rule changes produce visible emergent life and an ecosystem, in WebGPU/TSL, inside a 24h build and a 3-minute demo.
Method: OpenAlex lookups to verify DOIs, the GitHub search API (sorted by stars), and READMEs/blog posts fetched for benchmark numbers (2026-11-07). Time box was about 12 min, so this is a scoping pass, not a systematic review.
Evidence tags follow `../README.md`: `[PEER]` `[REVIEW]` `[PREPRINT]` `[BOOK]` `[POP]` (blogs, READMEs, games) `[INFERRED]` (our reasoning).

---

## TL;DR

1. **No single published model does all four layers (chemistry → protocell → organism → ecosystem) fast enough for a 3-min demo.** The real-chemistry models (Hutton, squirm3, AlChemy) are slow, and they usually start from a seeded replicator rather than producing one. The fast, good-looking models (Particle Life, PPS, Lenia) have no chemistry semantics. **Consensus within ALife:** open-ended spontaneous emergence of replicators is still an open problem. Kruszewski & Mikolov 2021 and Mathis et al. 2024 are recent attempts, and both need many steps. `[PEER]`
2. **Recommended approach: a hybrid.** Layer 1 is a GPU particle sim where each particle is an *atom of an element group*. Its pair forces and bond rules are derived from the player's group knobs (valence, electronegativity, bond energy, solvent, temperature). Bonding and bond breaking use Hutton/squirm3-style typed bonds with a Boltzmann break probability. Higher layers are **promotions**: when a pattern crosses a detectable threshold (a chain of length ≥ N, a closed ring, a templated copy), it gets promoted to an agent with a genome *read from its own atoms*. That agent then lives in a Tidemote/Life-Engine-style energy ecology. `[INFERRED]`
3. **Closest prior art is Tidemote** (tidemote.com, 2025–26). It is a WebGPU browser biosphere with millions of particles, bonds, minerals, photosynthesisers, grazers, hunters and scavengers. It already covers the "ecosystem in the browser on GPU" half of our pitch, so our differentiator has to be the **element/periodic-table knob layer plus a carbon-vs-silicon side-by-side**. `[POP]`

---

## 1. Artificial chemistry & origin-of-life models

| Model | Core mechanic | What emerges | Relevance to us |
|---|---|---|---|
| **Hutton 2002** "Evolvable Self-Replicating Molecules in an Artificial Chemistry", *Artificial Life* 8(4). doi:10.1162/106454602321202417 `[PEER]` | Atoms have a **type** (a–f) and an integer **state**. Atoms move randomly on a 2D grid. A small rule table such as `e8 + e0 → e4e3` changes states and makes or breaks bonds. | With ~8 rules, any linear chain acts as a template and gets copied, so replicators evolve. A seeded replicator is required. | **The best fit for "element behaviours are rules".** Type maps to element group, state maps to oxidation/activation, and the rule table is the chemistry. Bonds are local and GPU-friendly. |
| **Hutton 2007** "Evolvable Self-Reproducing Cells in a Two-Dimensional Artificial Chemistry", *Artificial Life* 13(1):11–30. doi:10.1162/artl.2007.13.1.11 `[PEER]` | Same AC, with membranes made of bonded atom loops that enclose a genome strand. | Cells copy their genome and divide. Selection acts on the genome. | Gives a *mechanistic* "first membrane" milestone. In the paper, division takes many thousands of steps, so we would have to accelerate it or seed it. `[INFERRED]` |
| **squirm3** (Hutton, OSS; live demo https://timhutton.github.io/squirm3) and **Living Physics** (Hutton's "artificial chemistry game", https://github.com/timhutton/livingphysics) `[POP]` | Browser/C++ implementations of the AC above. | Replicating chains in a browser. | A **reference implementation** to crib the rule format from. Living Physics is also prior art for "chemistry as a game". |
| **Fontana & Buss 1994** AlChemy, "What would be conserved if 'the tape were played twice'?", *PNAS* 91:757. doi:10.1073/pnas.91.2.757 `[PEER]`; revisited by Mathis et al. 2024 *Chaos* doi:10.1063/5.0207358 `[PEER]` | Molecules are λ-calculus terms, and a collision means function application. | Self-maintaining "organisations" (L0/L1/L2). | Conceptually lovely but invisible: there is no spatial picture. Use it for narrative only. |
| **Dittrich, Ziegler & Banzhaf 2001** "Artificial Chemistries—A Review", *Artificial Life* 7(3). doi:10.1162/106454601753238636 `[REVIEW]` | Formalises an AC as the triple (S molecules, R reactions, A algorithm). | n/a | Our design vocabulary: S = atoms and chains, R = the group-derived rule table, A = a GPU spatial particle sim. |
| **Kauffman autocatalytic sets** (Kauffman 1986, *J. Theor. Biol.* 119:1) and **RAF theory** (Hordijk & Steel 2004, *J. Theor. Biol.* doi:10.1016/j.jtbi.2003.11.020; Hordijk, Steel & Dittrich 2018 *New J. Phys.* doi:10.1088/1367-2630/aa9fcd) `[PEER]` | In a random catalysed reaction network, an autocatalytic set appears once the catalysis probability per molecule exceeds a threshold, with roughly linear growth in reactions per molecule. | A phase transition to self-sustaining sets. | Gives us **a knob with a dramatic threshold.** The "reactivity" slider can cross a RAF threshold, and the HUD can show "autocatalytic set detected" (computed on CPU from a sampled reaction log). |
| **Eigen & Schuster hypercycles** (Eigen 1971; Eigen & Schuster 1977 *Naturwissenschaften* doi:10.1007/BF00450633) `[PEER]` | Cyclic mutual catalysis of replicators. In space it produces spiral waves, which also resist parasites (Boerlijst & Hogeweg 1991). | Spirals. | Spatial hypercycles look like reaction-diffusion spirals. A cheap visual for the "cooperation" milestone. |
| **Gray-Scott reaction-diffusion** (Pearson 1993 *Science* 261:189, doi:10.1126/science.261.5118.189) `[PEER]` | Two-species PDE with feed and kill rates. | Spots that self-replicate by splitting, worms, mitosis-like division. | **Extremely cheap in TSL** (one compute pass on a texture). It makes a good **background "solvent/food field"** layer, and its spot-splitting looks like "protocell division". |
| **Chemical organisation theory** (Dittrich & Speroni di Fenizio 2007, *Bull. Math. Biol.* doi:10.1007/s11538-006-9130-8) `[PEER]` | Closed and self-maintaining sets of species. | n/a | Could provide the HUD's "organisation detected" label. Not visual. |
| **Gánti chemoton** (Gánti, *Chemoton Theory*, 2003 `[BOOK]` doi:10.1007/978-1-4419-8903-1) | Three coupled autocatalytic subsystems: metabolism, template, membrane. | Minimal-life criteria. | **Use it as the milestone checklist.** "Life" = metabolism + template + membrane all present together. This also gives the pitch a scientific spine. |
| **Kruszewski & Mikolov 2021** "Emergence of Self-Reproducing Metabolisms as Recursive Algorithms in an AC", *Artificial Life* doi:10.1162/artl_a_00355 `[PEER]` | Combinatory logic AC. | Spontaneous self-reproducing metabolisms. | Evidence that *spontaneous* emergence is possible but takes many reactions. It is not a 3-min visual. |

## 2. Particle and continuous ALife (the "looks great" family)

| Model | Mechanic | Emergence speed | Notes |
|---|---|---|---|
| **Particle Life / Clusters.** Jeffrey Ventrella's *Clusters* (ventrella.com, ~2000s–2017); CodeParade "Particle Life" (HackerPoet, 372★); Hunar Ahmad (hunar4321/particle-life, 3.4k★, 2022); Tom Mohr (particle-life.com, particle-life-app 1k★) `[POP]` | N types; asymmetric attraction matrix `A[i][j]`; force profile = short-range repulsion, then a linear attraction/repulsion "tent" out to r_max; friction. | **Seconds.** Membranes, cells, chasers and "worms" form almost immediately. `[INFERRED from demos]` | **The best match for "change group behaviour → see a different world"**: the matrix *is* the knob surface. Not mass-conserving or chemical, though. Nothing replicates or evolves by itself. |
| **Primordial Particle Systems** (Schmickl, Stefanec & Crailsheim 2016, *Sci. Rep.* 6:37969, doi:10.1038/srep37969) `[PEER]` | One rule: `dφ/dt = α + β·N·sign(R−L)`, where N is the number of neighbours in radius r and R and L are the neighbour counts on each side (α≈180°, β≈17°). | Fast. Spores grow into cells, cells grow and divide. Paper figures show this within hundreds to thousands of steps. | Gives "cell division" from a single rule with 2 knobs. Visually it reads as "life", but it has no element semantics. |
| **Lenia** (Chan 2019, *Complex Systems* 28(3), doi:10.25088/complexsystems.28.3.251 `[PEER]`; Expanded Universe ALIFE 2020 doi:10.1162/isal_a_00297) | Continuous CA: kernel convolution → growth function. | Instant, if you seed known creatures. Random soups mostly die or explode. | Gorgeous, but you have to seed curated species and the parameters are very sensitive. Convolution-heavy (FFT or a big kernel). |
| **Flow-Lenia** (Plantec et al., arXiv 2212.07906 `[PREPRINT]`; *Artificial Life* 2025, doi:10.1162/artl_a_00471 `[PEER]`) | Lenia plus **mass conservation** (reintegration tracking), with **parameters carried and mixed with the mass**. | Minutes to hours for evolution. Creatures appear fast. | **The only model with "multi-species + evolution in one rule-space" built in.** The rendering suits us (matter is conserved, so atoms are never created from nothing). Reintegration tracking in TSL is an M–L effort, and evolution is too slow for 3 min. |
| **Particle Lenia** (Mordvintsev, Niklasson & Randazzo 2022, Google, https://google-research.github.io/self-organising-systems/particle-lenia/) `[POP]` | Particles descend an energy E = R − G (repulsion minus Lenia growth). | Rotors and gliders appear after ~10k Euler steps. | Only uses 200–800 particles. Beautiful but small. Useful as an *energy-based* force law. |
| **Neural CA** (Mordvintsev et al. 2020, *Distill*, doi:10.23915/distill.00023) `[PEER]` | Learned CA rule that grows and regenerates a target. | Instant growth. | Needs pretrained weights, and it is "designed" rather than emergent. A possible organism-body renderer, nothing more. Skip. |
| **SmoothLife** (Rafler 2011, arXiv 1111.1567) `[PREPRINT]` | Continuous Game of Life. | Gliders. | A Lenia precursor. No advantage over Lenia for us. |
| **Swarm Chemistry** (Sayama 2009, *Artificial Life*; https://bingweb.binghamton.edu/~sayama/SwarmChemistry/) `[PEER]` | Heterogeneous boids "recipes". | Seconds. | Mentioned because the name sounds close to our idea, but it is behavioural, not chemical. |

## 3. Open-ended evolution & ecosystems: how producers, consumers and predators appear

| System | How trophic structure appears | Notes |
|---|---|---|
| **Tierra** (Ray 1991, *Artificial Life II* pp. 371–408 `[BOOK]`) | Self-copying programs compete for CPU and memory. **Parasites, then hyperparasites** evolve within hours of runtime. | The canonical "ecology emerges" story. Not visual. |
| **Avida** (Ofria & Wilke 2004, *Artificial Life* 10(2), doi:10.1162/106454604773563612 `[PEER]`; Lenski et al. 2003 *Nature* doi:10.1038/nature01568) | Rewards for computing logic functions lead to complex features through stepping-stones. | Shows that *resource-gated rewards* drive complexity. |
| **Polyworld** (Yaeger 1994, *ALife III*) `[BOOK]` | Neural agents with vision, food and energy. Herding, predation and cannibalism appeared. | Energy budgets plus a "predation costs energy, gives energy" rule are enough. |
| **Karl Sims 1994** (*Artificial Life* doi:10.1162/artl.1994.1.353, ~900 cites) `[PEER]` | Competition for a cube produced evolved body plans. | A visual-evolution precedent, but the evolution happens offline. |
| **ALIEN** (Heinemann, chrxh/alien, 5.6k★, CUDA) `[POP]` | Particles + bonds + programmable cell functions (sensor, muscle, constructor, attacker). Self-replicating creatures, with predators coexisting with prey. | **The best visual precedent for "bonded particles become organisms".** It is CUDA desktop software, not a browser app, and runs "millions of particles". |
| **The Life Engine** (Max Robinson, thelifeengine.net, browser JS, 2020) `[POP]` | Grid organisms built from cell types: producer, mouth, killer, armor, eye, mover. Food comes from producers. Predators evolve in minutes. | **The simplest reliable producer→consumer→predator recipe.** Our organism layer should copy its cell-type grammar. |
| **Biogenesis** (Java, Joan Queralt, ~2006) `[POP]` | Segmented 2D organisms whose segment colour defines a function: green = photosynthesis, red = attack. | Same lesson: *colour-coded function genes* make the ecology legible. |
| **Tidemote** (thallada/tidemote, WebGPU, 2025–26) `[POP]` | Photosynthesisers driven by moving light; grazers; hunters; scavengers turn the dead into silt, and children are built from silt. 96 founding species, local rules, mutating genomes. | **The closest prior art** (see §6). It proves that the full ecology runs in-browser at 60 fps. |
| **Thrive** (Revolutionary Games, Godot), **Species: ALRE** (Quasar, Unity), **Spore cell stage** (Maxis 2008) `[POP]` | Designed or partly evolved creatures. Spore's progression is scripted. | The audience will know Spore, so pre-empt the comparison: "Spore with real chemistry". |

**Common recipe across all of these** `[INFERRED]`:
1. A conserved energy currency (light → producer biomass → consumer).
2. Reproduction costs energy, and children mutate.
3. Interaction is local.
4. A predator gene ("mouth/killer") that only pays off when prey density is high, which gives Lotka–Volterra oscillations.

Producers show up first, then grazers within minutes, then predators. Life Engine and Tidemote both show this in under ~5 min of wall time when the world is seeded with a little life.

## 4. Mapping chemistry → rules (the novel part)

**Prior work found:** nothing that maps real periodic-table group properties into a particle-life matrix or AC rule table for an origin-of-life game. Habitat Sim (matt-bat, browser, 2025–26) models planet chemistry → origin of life → ecology, but as an aggregate deterministic model with no particle visuals. "Non-Carbon-Based-Life-Simulation" (GitHub, 0★) is trivial. **So the gap is real.** Confidence is moderate, because the search was short. `[POP]`/`[INFERRED]`

Proposed mapping. Each "element group" is a particle type; the player edits a group's properties, and the GPU uniforms are derived from them. Every row is `[INFERRED]` design, and the real values are textbook ones (CRC/Pauling; cross-check against notes 01/02):

| Player knob (per group) | Real-world anchor | Sim parameter |
|---|---|---|
| **Valence** (max bonds) | C 4, Si 4, N 3, O 2, H 1 | `maxBonds[type]` = bond slots per particle (≤ 4 fits in one `uvec4`). Valence 1 makes chain terminators, 2 makes chains/rings, 3–4 makes branches and networks. |
| **Bond strength** | C–C ≈ 346, Si–Si ≈ 222, Si–O ≈ 452, C–H ≈ 411, Si–H ≈ 318 kJ/mol | `E[i][j]`. Per step, a bond breaks with probability `p = k0·exp(−E/kT)` (Boltzmann/Arrhenius). This is the core temperature-tolerance mechanic: weak Si–Si chains fall apart where C–C survives. |
| **Electronegativity** (Pauling: C 2.55, Si 1.90, O 3.44, N 3.04, H 2.20) | Polarity = ΔEN | Particle-life attraction `A[i][j] ∝ f(ΔEN)` (strong attraction between unlike groups, mild between like groups). Bond-formation probability rises with ΔEN. Also sets the *solvent affinity* (hydrophilic vs hydrophobic) used to form membranes. |
| **Solvent** (water / ammonia / liquid methane / molten silicate) | Si–Si and Si–H bonds hydrolyse in water; Si does better in cold non-polar solvents | Solvent particles (or a background field) attack polar bonds: `p_hydrolysis[i][j] = h_solvent·polarity(i,j)`. A water world eats silanes, and a methane world lets them live. **The headline silicon-vs-carbon difference.** |
| **Temperature** | Solvent liquid range | Global `kT` sets the Brownian jitter amplitude and the bond-break rate. Clamp to the solvent's liquid range: outside it the solvent freezes (no motion) or boils (everything dissociates). |
| **Abundance** | Cosmic/crustal abundance (Si ≫ C in rock) | Spawn rate / initial fraction per type. |
| **Reactivity / catalysis** | Autocatalysis | Probability that a bonded chain catalyses a state change in a neighbour (Hutton rule firing rate), i.e. the RAF threshold knob. |

The "silicon world" preset: high Si abundance, Si–Si weaker than C–C, Si–O very strong (rock-like, it locks up). Water as solvent destroys chains, while cryogenic methane/N₂ preserves them but slows motion (low kT). The player should *see* that a naive silicon world in water never gets past "first chain", and then fix it by choosing a different solvent and temperature. **That failure→fix arc is the demo story.** `[INFERRED]`

## 5. Browser/GPU feasibility

| Project | Tech | Particles | FPS | HW | Source |
|---|---|---|---|---|---|
| lisyarus WebGPU particle life | WebGPU compute | 65,536 | real-time (not stated); binning+prefix sum ≈ 0.1 ms | GTX 1060 | blog `[POP]` |
| programmingattack "millions of particles with WebGPU" | WebGPU, uniform grid + sort | ~1M / 4M | ~30 / ~5 | MacBook (unspecified) | blog `[POP]` |
| Tidemote | WebGPU, counting sort + prefix scan, 3×3 bins, ≤64 neighbours | "up to millions", auto-sized to a ~10 ms GPU frame | 60 target | any WebGPU GPU | README `[POP]` |
| ALIEN | CUDA | millions | real-time | RTX 20+ | README `[POP]` |
| Primordia (physarum) | Rust+wgpu native | 3–5M agents | real-time | 1080p desktop | README `[POP]` |
| realtime-flowlenia | PyTorch MPS | 512² grid | 30+ | Apple Silicon | README `[POP]` |
| Particle Lenia | JS/WebGL | 200–800 | real-time | — | Google page `[POP]` |
| dominikvytisk/life-simulation | browser CPU worker | ~1,800 organisms | ~9–10 ms/tick | — | README `[POP]` |

**Implications for TSL (r187)** `[INFERRED]`:
- **Budget 32k–131k atoms** on a laptop iGPU, with 4 bond slots each, a uniform grid built by counting sort + prefix sum (3 passes: atomics count, scan, scatter), and a 3×3 neighbour search. This is well within the lisyarus and programmingattack numbers. Run 2–8 substeps per frame for speed-up.
- **Bond formation race:** two atoms can claim the same slot. Fix it with `atomicCompareExchange` on a per-atom "lock" word, or with a two-phase propose/accept pass using even/odd parity (deterministic, no atomics on bonds).
- **Milestone detection** belongs on the CPU from an async readback every ~0.5 s of a *sample* (bond list for ~4k atoms). Chain length, ring detection, and a template-copy check (two chains with the same type sequence) are cheap in JS.
- **Emergence times we can expect, with a tuned preset:** clusters in 1–3 s (particle-life forces); chains in about 10–30 s once bonding is enabled; replication only if templating is a *rule* (Hutton style), because spontaneous emergence won't happen in 3 min; PPS-like division in about 30 s. For the ecosystem, plan on seeding the organism layer, as Tidemote seeds 2% life.

## 6. Ranked candidate models (for our build)

Scores run from 1 to 5. Effort is for 24h with 3–4 devs.

| Rank | Model | Visual appeal | Emergence speed | Element-knob controllability | GPU/TSL feasibility | Effort | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **Particle Life (force matrix)** | 5 | seconds | 4 (matrix derived from EN/valence) | high (well-trodden WebGPU) | S | Layer-1 motion substrate |
| 2 | **Hutton/squirm3 typed-bond AC** | 3 (4 with good render) | 10s–minutes; needs templating rules | 5 (rules *are* chemistry) | medium (bond slots + race handling) | M | Layer-1 bonding/replication |
| 3 | **Life Engine / Biogenesis organism grammar** | 4 | minutes | 3 (via what atoms the organism is made of) | high (agents ≤ 2k, could even be CPU) | M | Layer 3–4 ecology |
| 4 | **Gray-Scott RD field** | 4 | seconds | 3 (feed = abundance, kill = solvent hostility) | very high (one texture pass) | S | Background food/energy field + "protocell spots" |
| 5 | **Primordial Particle Systems** | 4 | ~30 s | 2 | very high | S | Optional "protocell" motion rule for promoted clusters |
| 6 | **Flow-Lenia** | 5 | creatures fast, evolution slow | 3 | medium-low (reintegration tracking) | L | Too risky for 24h; cite as inspiration |
| 7 | **Lenia** | 5 | instant if seeded | 2 | medium (convolution) | M | Eye-candy only |
| 8 | **Particle Lenia** | 4 | ~10k steps | 2 | high but small N | M | Skip |
| 9 | **RAF / autocatalytic sets** | 1 (abstract) | instant to compute | 5 | CPU | S | HUD analytic: "autocatalytic set formed" |
| 10 | **AlChemy / Tierra / Avida** | 1 | slow | 1 | n/a | L | Narrative citations only |
| 11 | **Neural CA** | 4 | instant | 1 | medium | L | Skip |

## 7. Recommended hybrid architecture

```
L0 Solvent/energy field   (texture, Gray-Scott-ish)    : light/heat/food; solvent attacks bonds
L1 Atoms                  (GPU particles, 32k–131k)    : particle-life forces + typed bond slots
L2 Molecules & protocells (GPU bonds + CPU sampler)    : chains, rings, templated copies, membranes
L3 Organisms              (promoted agents, ≤ 2k)      : genome = own atom sequence; energy; mutation
L4 Ecosystem              (emergent from L3 + L0)      : producers / grazers / predators / decomposers
```

**L0 · Environment.** A 2D field texture (one TSL compute pass) holding *free energy* (light or geothermal vents) and the *solvent* state. Gray-Scott-style feed/kill with feed = abundance and kill = solvent hostility. Dead organisms deposit atoms back into it (the decomposer loop, à la Tidemote's silt).
- Knobs: solvent (water/ammonia/methane/silicate melt), temperature, energy source (star / vents).

**L1 · Atoms.** Each particle stores: position, velocity, `type` (element group), `state` (Hutton-style 0–9), `bonds: uvec4` (partner indices or −1).
- Forces: particle-life matrix `A[i][j]` derived from the group knobs, plus spring forces along bonds, plus `kT` jitter.
- Bond formation: neighbours within r_bond with free slots, probability ∝ f(ΔEN, state rule).
- Bond breaking: probability `k0·exp(−E_ij/kT) + hydrolysis(solvent, polarity)`.
- Knobs per group: valence, bond strength, electronegativity, abundance, solvent affinity. All are **derived from real data by default**, which the player can push.

**L2 · Molecules & protocells.** Hutton templating rules give the replicator milestone: a chain touching free atoms of matching type copies itself, with a small mutation rate (wrong type). Rings of solvent-phobic chains become **membranes**, which look like particle-life "cells" for free.
- The CPU sampler (async readback every ~0.5 s) detects milestones and labels them on screen.

**L3 · Organisms (promotion).** When the sampler finds a **closed membrane enclosing a replicating chain** (Gánti's chemoton criteria: membrane + template + metabolism, where metabolism = it is consuming L0 energy), it promotes that cluster to an agent.
- The agent's genome is literally its chain's type sequence. Each codon (2–3 atoms) maps to a Life-Engine cell function: producer / mouth / mover / armor / eye.
- So **element knobs keep mattering after promotion.** An organism built from weak bonds decays faster at high T (its HP is derived from the bond energies). Organisms built from groups with high solvent affinity dissolve in the wrong solvent.
- Agents are rendered as their actual atoms (keep the particles, constrain them as a rigid body) so the camera transition is seamless.

**L4 · Ecosystem.** Energy is conserved: producers take energy from L0, mouths take it from contact with other agents, and reproduction costs energy and mutates the genome. Lotka–Volterra cycles emerge.
- The HUD shows a trophic-level count and a population chart.

**Witnessable milestones (the 3-min demo script).** Timings are targets with tuned presets.

| t | Milestone | Detected by |
|---|---|---|
| 0:05 | First bond / first cluster | bond count > 0 |
| 0:20 | First chain (length ≥ 6) | CPU graph walk on sample |
| 0:40 | First ring / first membrane | cycle detection, solvent-phobic ring |
| 0:55 | First replicator (template copy) | two chains with the same type sequence where one was born from the other |
| 1:10 | Autocatalytic set | RAF check on the logged reaction graph |
| 1:30 | First protocell → first organism (promotion) | chemoton criteria |
| 2:00 | First producer bloom | agents with producer genes > 20 |
| 2:20 | First grazer, then first predator | mouth / killer genes with positive energy balance |
| 2:45 | Three trophic levels plus a population oscillation | population chart |

The demo arc: run "Carbon in water" (works) next to "naive silicon in water" (stalls at the chain milestone because hydrolysis wins). Then switch silicon's solvent to liquid methane, lower T, and raise the Si–Si bond-strength slider. Silicon life emerges, and it looks *different* because a different valence and EN profile gives different shapes. `[INFERRED]`

**Shortcuts to keep it within 24h** `[INFERRED]`:
- Seed the world with a few replicator chains (Hutton seeded too). Honest framing: "we seed a spark; everything after is emergent."
- A time-warp button with ×8 substeps.
- Make promotion thresholds tunable for the demo. Pre-bake 3 presets.

## 8. Seen-before risk & how we differ

| Prior art | Similarity (1–5) | How we differ |
|---|---|---|
| **Tidemote** (tidemote.com) | **5** | Same tech and ecology vibe. Tidemote's chemistry is fixed and abstract ("silt", "minerals"). Ours is **player-edited periodic-table groups with real bond energies, solvents and temperatures**, set up as a carbon-vs-silicon A/B. Theirs is a microscope you observe; ours is a chemistry lab where you *author the laws*. Look at it before the pitch so we don't look derivative. |
| **ALIEN** (chrxh) | 4 | CUDA desktop, with designed or evolved creatures. We run in the browser, and our creatures are *built from element rules the player sets*. |
| **Particle Life apps** (Mohr, Ahmad, SandboxScience) | 3 | Their matrices are random or abstract, with no replication or ecology. Our matrix is derived from chemistry, and it is only the bottom layer. |
| **The Life Engine / Biogenesis** | 3 | Their organisms come pre-made from cell types. Ours have to arise from chemistry first. |
| **squirm3 / Living Physics** (Hutton) | 3 | The AC is the same idea, but theirs has abstract types and no ecosystem or presentation. |
| **Habitat Sim** (matt-bat) | 3 | Planet → origin-of-life → ecology, but aggregate numeric, not a particle spectacle. |
| **Spore cell stage / Thrive / Species ALRE** | 2 | Scripted or designed creatures. We are "Spore if the periodic table were the level editor." |
| **Lenia / Flow-Lenia playgrounds** (e.g. lenia-life-lab) | 2 | No chemistry semantics. |

**Our unique claim:** "Change the rules of a periodic-table group, and watch whether life can exist at all, and what it looks like." Nobody found here exposes **valence / electronegativity / bond energy / solvent** as the control surface, and nobody found runs carbon and silicon side by side. `[INFERRED, moderate confidence]`

## Sources

See `../data/alife-models.json → sources` for the full list. Key DOIs:
10.1162/106454602321202417 · 10.1162/artl.2007.13.1.11 · 10.1162/106454601753238636 · 10.1073/pnas.91.2.757 · 10.1063/5.0207358 · 10.1016/j.jtbi.2003.11.020 · 10.1088/1367-2630/aa9fcd · 10.1007/BF00450633 · 10.1126/science.261.5118.189 · 10.1007/s11538-006-9130-8 · 10.1007/978-1-4419-8903-1 · 10.1162/artl_a_00355 · 10.1038/srep37969 · 10.25088/complexsystems.28.3.251 · 10.1162/artl_a_00471 · 10.23915/distill.00023 · 10.1162/106454604773563612 · 10.1038/nature01568 · 10.1162/artl.1994.1.353

Caveats: Bond-energy and EN values are textbook figures quoted from memory, so cross-check them against notes 01/02. The emergence timings in §5/§7 are design targets `[INFERRED]`, not measurements. Ventrella's Clusters date and Sayama's DOI were not verified.
