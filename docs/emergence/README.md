# Emergence designs A–F: adversarial review and recommended hybrid

> Reviewer's brief: read all six designs (A `chemistry-up`, B `growth-first`, C `field-first`, D `energy-first`, E `scale-zoom`, F `body-plan-first`) against `.claude/agents/designer.md`, `docs/WORLD_ATLAS.md`, `docs/DESIGN.md`, `docs/ART_DIRECTION.md`, `docs/TRACK.md`, `world-style`, and `docs/features/world-generator.md` (the built `mockups/worlds`). Re-score independently. **Weight fauna complexity heavily** (team concern: atom/cell-level life tops out at blobs, worms and rings).

## 1. Verdict

**Only F can make the mood-board animals. A–E all top out at bead chains, blobs or broken-off branches, so build on F.** The recommended direction: **F's genome → development → selection core** as the simulation, presented through **E's zoom spine** (pixel → molecule → "it opens its eyes" → eye-level giant). It sits on **A's sediment terrain with strata epochs**, uses **D's amber energy threads** to make the food web visible, gets its arches from **C's persistence-saddle reading** of the heightfield, and takes **B's abscission (cap → jelly bell)** as a stretch flora↔fauna cycle. C's continuous field is dropped as a sim. At most it becomes an optional ground-mat texture.

The six self-scores are nearly uniform (all 4s with one 5 each) and don't discriminate. Every design marks "reached" whenever *a mechanism exists on paper*. None of them has run. Where a pin's defining feature is a complex animal (eco-01's tall horned figures, eco-02's lizard, eco-09's feathered beast, eco-13's arch creature), I mark it **partial** unless the design can actually build that body.

---

## 2. Comparison matrix

My score first, the design's self-score in [brackets]. Atlas = my count of the 15 ecosystems (R = reached, P = partial; none "not reached"). Fauna ceiling has no self-score. "Fauna-weighted" = sum with the fauna ceiling ×3.

| | Emergence | Chemistry | Atlas | **Fauna ceiling** | Spectacle / hook | 24 h feasibility | Intuitive | Sum / Fauna-wtd | Biggest risk | Seeds / cheats declared |
|---|---|---|---|---|---|---|---|---|---|---|
| **A** Sediment | 4 [4] | 4 [4] | 3 [4] · 7R/8P | **3** | 4 [4] | 3 [4] | 4 [4] | 25 / 31 | GPU org kernel (shape matching, CAS-free births) + turtle LOD all land after H8; promotion probably needs seed #2 | 4 seeds (#0–#3) / 4 cheats (C1 geologic gain, C2 sampler window, F1 arch fallback, F2 skin fallback) |
| **B** Seed→World | 4 [4] | 4 [4] | 3 [4] · 7R/8P | **2** | 4 [4] | 3 [4] | 4 [4] | 24 / 28 | gel/dust tuning of a 64k-cell **3D** growth sim with 24-hop subtree passes; animals are tree fragments | 3 seeds / 5 (seed boost, midwife, hydrolysis scale, time compression, macro skin not simulated) |
| **C** Living Field | 3 [4] | 3 [4] | 3 [4] · 8R/7P | **2** | 3 [4] | 3 [4] | 3 [4] | 20 / 24 | Flow-Lenia self-holding blobs at every R; reintegration tracking in TSL | 4 seeds / 3 (rain fade-in, hunter fallback, persistence arches) + a designed V→A abiogenesis rule |
| **D** Follow the Energy | 4 [4] | 4 [4] | 4 [4] · 10R/5P | **2** | 4 [5] | 4 [4] | 4 [4] | 26 / 30 | trophic ladder by 2:10 in a Life-Engine economy; bodies look like Life Engine (seen-before) | 4 seeds / 5 (impact, first dawn, promotion threshold, 2 safety nets) |
| **E** Powers of Ten | 4 [4] | 4 [4] | 4 [4] · 10R/5P | **2** | 4 [5] | 3 [4] | 4 [4] | 25 / 29 | 5 scales = 4 sims + RT nesting + lens; S1 must hit 60 copiers in ≤30 s | 3 seeds / 5 (CPU-assisted copying, chemostat fudge, S4 impostors, auto-ripen, symbolic scale) |
| **F** Body Plans | 3 [4] | 4 [5] | 4 [4] · 11R/4P | **5** | 4 [4] | 4 [4] | 4 [4] | **28 / 38** | selection too slow to grow horns, legs and plates from worms within the demo; loft + IK pipeline on r187 | 5 seeds (pixel+emission, motes, dish/basin/liquid, copier rule, RNG) / 3 (stress mutagenesis, Hox midwife, "grazer tasted meat") |

### 2.1 Fauna complexity ceiling: the evidence

| | What a body *is* | Hard ceiling | Mood-board animals it can't build |
|---|---|---|---|
| A | Template atom string of ≤24 symbols, turtle-decoded once per species into one rigid instanced mesh at the org centroid (§3.4). Segments, plates, O-end frills, eye clusters; runs ≥3 branch as limbs | Rigid segmented statues that slide along a heading. No gait, no head/limb domains. A admits sky whales are "chains, not whale silhouettes" (§8) | rhino-lizard (no legs), strider (no stance), feathered hunter (no quadruped), whale |
| B | A detached subtree of a tree: "the body plan is the growth record of the branch it came from" (§6) | Broken branches and bells. Locomotion is tip thrust through springs | anything with a head, legs or a closed silhouette. Jellybots are B's one strong case |
| C | A 32×32 Flow-Lenia height patch, "pebble or pod" (§6). Horns, plates, rods and legs are **render thresholds** on scalars (`t·Hunger > 0.35` → horns, `famSi > 0.5 && heat < 0.4` → legs) | A blob with stickers. The morphology is decided by `if` statements, not by the field | every one. The features aren't emergent, they're a lookup |
| D | Life-Engine hex cell chain, ≤24 codons, rigid, side-on (§3 Stage 2). "Legs" are fins drawn as legs on land | Flat hex-cell clumps | the board's 3D animals. It also reads as the Life Engine (prior art) |
| E | `backbone: Uint8Array(≤12)` (§3.0), drawn as bead-and-rod: "a creature is its own molecule, drawn bigger" | 12-bead necklaces with parts | the giants at the discovery plate will look like enlarged molecules |
| F | 32-gene Hox-style plan: segN, radius profile, limb domain/period/length, plates, dorsal rods↔frills, eyes, horns, gape, buoyancy, symmetry (§3.3). Lofted generalised cylinders, 2-bone IK and FABRIK legs, morphology-derived gait, pulsing bells, catenary sessile arches (§3.5–3.6) | Spore-class creatures | none in principle. Hammerhead and ink caps are designed bonuses (declared). **The risk is time-to-ceiling, not the ceiling** |

### 2.2 Atlas, pin by pin (my reading)

R = reached, P = partial. A pin whose defining element is an animal counts as R only if the body is credible.

| Pin | A | B | C | D | E | F | Notes |
|---|---|---|---|---|---|---|---|
| 01 Vermilion | P | P | P | P | P | P | Tall horned figures vs R6 (hot = small). C and F flag the atlas contradiction. World-gen swaps them for black monoliths |
| 02 Violet Hollow | P | P | P | P | P | **R** | needs a lizard + beetles |
| 03 Sindha | P | R | R | R | R | R | |
| 04 Frost Arches | P | P | R | R | R | R | A's `h2` slabs are stretch (→ cheat F1). B's anastomosis is first on its cut list |
| 05 Parasol Giants | R | R | R | R | R | R | |
| 06 Sea Stacks | R | R | R | R | R | R | |
| 07 Two Suns | P | P | P | R | R | R | variety per seed is unproven everywhere |
| 08 Coral Forest | R | R | R | R | R | R | |
| 09 Violet Hunter | P | P | P | P | P | **R** | needs a feathered quadruped |
| 10 Red Canyon | P | P | P | P | P | P | canyon needs erosion. It's stretch or cut-first in D, E and F |
| 11 Kelp Shoal | R | R | P | R | R | R | C's shoal is render boids. F's shoal is real agents |
| 12 Glow Garden | R | R | R | R | R | R | |
| 13 Living Arch | P | P | P | P | P | P | F has the only *creature* mechanism (sessile + catenary + epiphytes), but it needs ⏩ and tuning |
| 14 Bone Reef | R | R | R | R | R | R | every design's natural product |
| 15 Lantern River | R | P | R | R | R | P | white river needs a channel. F has no rivers without M9 |
| **R / P** | 7/8 | 7/8 | 8/7 | 10/5 | 10/5 | **11/4** | |

### 2.3 Justifications for every score ≥1 below the self-score

- **A Atlas 3 [4]:** its own table relies on fallback F1 for eco-04 arches. Its 8–30 atom orgs can't carry eco-02's or eco-09's animals.
- **A Feasibility 3 [4]:** H8–16 asks for GPU centroid atomics, shape matching, CPG, mouths, CAS-free birth claims, the turtle decoder, LOD crossfade and the geologic gain, from 3 people. Its own fallback ladder admits this.
- **B Atlas 3 [4]:** a "reached" lizard or feathered beast from a detached branch is generous. Anastomosis arches are cut first.
- **B Feasibility 3 [4]:** it's the only **3D** sim (3D hash, Verlet, 24-hop bottom-up and top-down passes across frames). The 2–4 ms estimate is explicitly unmeasured (§9.2).
- **C Emergence 3 [4]:** creature morphology is threshold decoration (§6 table). Arches and shoals are readings. Abiogenesis is a designed V→A rule.
- **C Chemistry 3 [4]:** R1 lives in spot shape and a faceted outline on a 32×32 patch, which is invisible at diorama distance. Sea works by pushing GS `k` across Pearson regime boundaries, so it's non-monotonic (C's round 1 admits Light → F has the same issue).
- **C Atlas 3 [4]:** see 2.2. Terrain relief is `0.45 m·Stone^0.8`, which won't give 80–220 m landforms without an unstated gain.
- **C Spectacle 3 [4]:** Gray-Scott and Lenia are the most-seen ALife demos (TRACK: "novel is judged against the room"). Mid-game creatures are "jelly pancakes" (its own round 2).
- **C Feasibility 3 [4]:** Flow-Lenia tuning plus reintegration tracking plus reservoir genome sampling in TSL is two novel sims. Its own biggest-risk note admits blobs may not self-hold.
- **C Intuitive 3 [4]:** Heat moves dt, noise and R at once. Recipe shows only on new spots, and the old pattern lingers about 5 s.
- **D Spectacle 4 [5]:** the reveal, sky birth and amber threads are excellent. But "what judges remember: the creatures" (DESIGN header), and D's are Life-Engine hex clumps.
- **E Spectacle 4 [5]:** the spine is a 5. The payoff isn't: the S4 discovery giant is a 12-bead chain at 6–20 m.
- **E Feasibility 3 [4]:** Chem (GPU) + census (CPU) + Life kernel + Range metapopulation + world-gen bridge + RT nesting + lens + dish bend. That's four engines plus transitions. Its own unknowns list five untested load-bearing items.
- **F Emergence 3 [4]:** chemistry-level emergence ends at about 0:35. The prelude's atoms "fade into the soil" and contribute only 4 founder numbers. Development, the ledger and the founder mapping are all authored, and three midwife cheats are needed to hit timings.
- **F Chemistry 4 [5]:** R1 and R9 legibility is the best of the six. But after the prelude, chemistry is a barycentric `comp` plus tables (`atk_si`, `ρ_air`), and R12 builders are a flag (`si·o > 0.12`), not a process.

---

## 3. Best idea from each design (steal list)

| From | Steal | Where |
|---|---|---|
| **A** | **Strata epochs.** Every Sea change stamps a band into deposited stone, so the final pull-back shows "the moment you changed the sea" in the cliffs. Also: land is where sediment breaks the sea surface | A §4.3, §4.1 |
| **B** | **Abscission: growth polarity becomes swimming polarity.** A cap that lets go becomes a jelly bell with tendrils (strobilation), so flora and fauna are two phases of one life cycle | B §3.3 |
| **C** | **Persistence-saddle arches.** 0-dim persistence on a 64² heightfield (≈1 ms CPU) finds peak pairs with high saddles, and those are drawn as arches. It's an honest reading of real terrain. Runner-up: Kobayashi 6-fold anisotropy so Si is visibly faceted before life exists | C §4, §3.1 |
| **D** | **Amber energy threads.** Every transfer >0.05 emits motes along a Bézier from source to sink, so the food web is *visible*. Plus the 5-segment ledger bar | D §7 |
| **E** | **The zoom spine with the ledger rule:** each pull-back is detector-gated, and only real state crosses a zoom (a Tier 0 test asserts it). Also the chemistry lens: click a creature and dive into its molecule | E §3.0, §3.7 |
| **F** | **Chemistry is the developmental grammar, plus a trait ledger with a dual path** (immediate plasticity, then slow selection). Plus the 4-mesh renderer (loft, twig, tile, eye) and the MAP-Elites field guide | F §3.3–3.6, §7 matrix |

---

## 4. Recommended hybrid: "Body Plans, Powers of Ten"

### 4.1 The pipeline, pixel → world

```
[S0 pixel] ─click─▶ [S1 atom prelude, CPU 3–4k atoms]  ──copier──▶ founder genomes (F §3.2)
   E/F/A                 F §3.1 + A/E hydrolysis & rust                    │
                          │ Si–O bone sand ─────────────────────▶ stratum 0 of terrain (A)
                          ▼
[S2 organisms, CPU ecology 20 Hz, worker] ◀── develop(genome, comp, dials)  (F §3.3)
   F §3.4 ledger · F §5 L-system flora · B abscission bells (stretch)
      │ EcoEvents(src,dst,amount) ─────────▶ amber threads (D §7, GPU motes)
      │ deposits(x,z,amt,epoch) ──────────▶ sediment heightfield + strata + stain (A §4.1/4.3)
      │                                        └─▶ persistence arches (C §4) · pores (occupancy)
      ▼
[GPU pose + skin] spine/IK/bells (F §3.5) → loft/twig/tile/eye (F §3.6), shared world material
      ▼
[S3 eye-level landscape] same sim, camera at 1.7 m; world-gen sky/fog/backdrop via MeasuredState (E §3.5)
      ▼
[bookend] discovery plate · two bestiaries (F) · little-planet curl to one pixel (E, stretch)
```

**2D sim plane, 3D render.** Altitude for floaters, swim bands and walkers' legs is render-only (A, C, D and F all do this). Scale: dish radius 150 m (F §4), creatures 0.15–20 m, deposits giving 10–60 m spires under deep time, world-gen backdrop landforms at 80–220 m beyond the rim.

### 4.2 Timeline

| t | Player sees | Simulated | Source | E / S / Sc |
|---|---|---|---|---|
| 0:00 | One breathing amber pixel on black (it's the loader) | nothing: an emissive sprite | E, F, world-style | **Seeded** |
| 0:01 | Click: the pixel boils into a ring of coral, cyan and magenta beads. A world-style reveal-radius rim | 3–4k CPU atoms emitted over 3 s in the Recipe ratio | F §3.1, world-style | **Seeded emission** |
| 0:04 | Bonds snap. Si–O pairs go bone and sink. C–O pairs puff gas rings | mutual-best bonding on the CPU, break roll `exp(−E/kT)+atk(sea)` | F, A §3.1 | Emergent |
| 0:08 | Si chains stay straight and zig-zag, C chains curl | angle stiffness `0.2+1.6·si`, curl `0.3·c` | F, E | Emergent (R1) |
| 0:11 | In Water, cyan chains crumble. Presenter picks **Acid** and the sky lerps lemon in 1.5 s | hydrolysis ×0.03 | A, F, DESIGN §3 lock 1 | Emergent + presenter |
| 0:15 | **Hook line:** "What if life was silicon-based?" One chain copies itself, 1→2→4→8 | template rule granted to the longest chain alive ≥2 s | F §3.1 | **Seeded rule** (which chain gets it is emergent) |
| 0:22 | **Pull-back #1. Whoa: the molecule opens its eyes.** Copies swell into worm segments with blinking eyes. Leftover atoms fall as the first bone ring | sequence → founder genome. Prelude stone → stratum 0 | E spine, F §3.2, A | Designed mapping, scripted camera |
| 0:25–0:55 | Worms graze. L-system flora sprouts in rings. **Amber threads** run sky→cap→mouth | ecology 20 Hz, canopy grid, EcoEvents → motes | F §3.4, §5, D §7 | Emergent |
| 0:45 | First legs: a lineage opens its limb domain and starts stepping | Hox domain mutation, IK gait from morphology | F | Emergent (Hox midwife at 0:55 if needed) |
| 0:55 | Recipe → Si: **within 2 s newborns are cyan, hexagonal and ticking**. Flora tips grow a cyan ring | plasticity `lerp(comp, Recipe, .35)`, growth rings | F, B §4.3 | Emergent |
| 1:05 | Hunger ↑: chase and flee immediately. Threads now run grazer→hunter | steering weights, ledger | F, D | Emergent |
| 1:20 | Si+O builders ring their dens with stone. Pores glow where they sit. The first reef breaks the sea surface: land | den deposits → heightfield. `h > seaLevel` → land | F §4, A §4.1 | Emergent |
| 1:40 | **Discovery plate #1:** "Silicon-based life discovered", the creature huge with a tiny human | MAP-Elites bin + lineage depth ≥3 | F, ART §6 | Scripted on emergent |
| 2:00 | **⏩ Deep time:** "ten thousand years of the same rules". Bodies diversify, spires rise, strata band, arches resolve | ecology ×40 in the worker (**real ticks**), declared geologic gain on deposition only | F (headless speed), A §4.7, C §4 | Emergent + declared compression |
| 2:20 | **Pull-back #2:** the camera drops to 1.7 m beside a tiny explorer, under a spire the player's builders made. The cliffs show the 0:11 Water→Acid band | same sim. World-gen sky, fog, backdrop via MeasuredState | E spine, A strata, world-gen | Real state, render-only backdrop |
| 2:35 | **Discovery plate #2:** the run's largest creature (strider, whale or rhino-lizard) | cinematographer picks a real organism | E §2, F | Scripted on real |
| 2:50 | Two bestiaries side by side (this run vs a saved run). Stretch: the world curls into a little planet and shrinks to one pixel | saved guide (declared). Render bend | F §2, E §3.6 | Scripted presentation |

### 4.3 The 6 controls at each stage

| Control | Prelude (0:00–0:22) | Newborns, plasticity (≤3 s) | Behaviour (≤1 tick) | Selection (generations) | Terrain / flora |
|---|---|---|---|---|---|
| **Recipe** | burst colours, chain stiffness | **cyan facets / coral curves / magenta glow on the next births** | O speeds everyone | `comp` drifts to what Sea and predators allow | flora growth rings. Si+O → builders → stone |
| **Sea** | **Si chains hydrolyse (Water) or hold (Acid)** | `ρ_air` sets newborn scale | float vs walk | plates (Water), floaters (Methane), Si thrives (Acid) | **palette lerp 1.5 s**, strata epoch stamp, stain hue, fog thickness |
| **Heat** | jitter and break rate | **newborn size ±60% (TSR)** | **all animation tempo** | giants (cold) vs small (hot) | flora height, arch survival `(1−heat)²`, spire erosion |
| **Light** | **Spark mote density → bonding rate** | eye size, glow eyes | vision range | big eyes, dorsal rods, glow lures | **caps (bright) vs glow bulbs (dark) within 1 s** |
| **Hunger** | **atoms chase (pull asymmetry)** | — | **chase/flee, thread rate** | horns, frills, claws vs plates, shoals | grazing scars, more corpses → more reef |
| **Time** | substeps | — | ×1 / ×4 | **⏩ = ×40 real ecology ticks** | strata deepen, spires stack, arches fuse |

### 4.4 How complex fauna arises (genome → body plan)

1. **Founder:** the copier's atom sequence sets segN `(L−3)/13`, composition `{c, si, o}`, band pattern (C/Si alternation) and glow (#O). Everything else is a narrow worm range (F §3.2). The first animals are *always worms*.
2. **Development:** `develop(G, comp, dials)` is a pure TS function. Chemistry is the grammar: Si gives 6-sided faceted segments, 15°-quantised joints, rod limbs and dot-eye clusters. C gives 12-sided smooth curling bodies, tentacle limbs and ring eyes. Si+O gives cheap stone plates. O gives magenta glow (F §3.3).
3. **Selection:** the trait ledger (F §3.4) makes every gene pay. Water dissolves unplated Si, so plates pay. Thick cold air makes hovering cheaper than legs, so whales and bells appear. Hunger pays horns and gape, and prey answer with plates and shoals.
4. **Fixing the time problem (my main amendment to F).** At ×1, F's generations are about 10–20 s, so a 3-minute run gives about 10 generations. That's not enough to get from worm to rhino-lizard on σ = 0.05 mutations. F's own numbers fix it: the ecology runs at ≈180× headless (0.3 ms/tick × 1,024 agents). So **⏩ runs the real ecology at ×40 in the worker**: 20 s of wall clock = about 800 sim-seconds = 40–80 generations. Stress mutagenesis stays as a backup only.
5. **Kill switch (declared):** a *pre-evolved menagerie*. Run the same rules headless for 30 sim-minutes per preset at build time, save the population, and load it when the demo skips ahead. The genomes are real outputs of the same rules. The card says "evolved offline under your dials".

### 4.5 Cheapest H8 demo path

Pixel → click boil (3k CPU atoms as instanced beads) → bonds and the Si straight / C curl contrast → Water crumbles Si, Acid saves it → seeded copier copies → **worms open eyes** (F's bead v0: one sphere per joint, ring or dot eyes) → grazing on disc flora → Recipe → Si gives cyan, hex-stepped, ticking newborns → in Water they shed and die. World-gen core supplies sky, fog, palette lerp and a flat dish. **No** loft, IK, terrain deposits, threads or guide. That's F's own H8 bar plus the A/E hydrolysis beat.

### 4.6 Build order (≈16 h, 4 devs; for 3 devs, fold D4 into D1 and D3)

**Contracts (all, H0–1), in `src/contracts.ts`:** `Genome` (32 f32 + comp + lineage), `Plan` (64 f32 + ≤40 `Part`), the `AgentSoA` / `agentCur` / `agentPrev` layout (F §3.5), `EcoEvent {kind, src, dst, amount}`, `Deposit {x, z, amt, epoch}`, `MeasuredState` (E §3.5). Each dev then builds against fixtures: Bodies against `develop()` test Plans, World against a recorded deposit stream, Director against a recorded event log.

| Hours | **D1 Life** (CPU, pure TS) | **D2 Bodies** (GPU) | **D3 World** (prelude + terrain + flora) | **D4 Director** (camera, UI, presentation) |
|---|---|---|---|---|
| 0–1 | contracts | contracts + **r187 smoke test: storage reads in `positionNode`** (fallback: DataTexture) | contracts, pull in `mockups/worlds` core | contracts, dials UI shell |
| 1–4 | `genome.ts`, `develop.ts` + Tier 0 per atlas genome | bead v0 renderer + spine pass, Si quantise | prelude atoms (CPU) + instanced beads/bonds, copier rule | zoom camera v0 (prelude → dish), palette lerp |
| 4–8 | `ecology.ts` core: grazers, disc flora, births, ledger (size, si, plates, Hunger), headless runner | loft mesh with storage-driven profile, facets, skin Voronoi, eyes + blink | founder hand-off, prelude stone → stratum 0, flat heightfield | hints, monitors, `#debug`, H8 rehearsal |
| **H8** | **checkpoint: §4.5 runs 3× clean at ≥50 fps** | | | |
| 8–11 | Vitest preset sweeps (fauna-02, 05, 09, 03), buoyancy modes, sociality | twig/tile parts (limbs, horns, plates, rods, frills), 2-bone IK + gait | L-system flora + canopy grid (renders on D2's twig mesh) | amber threads (EcoEvent → 16k GPU motes), ledger bar |
| 11–14 | builders/dens → `Deposit`, **deep-time worker ×40** | bells, fluke waves, glass rim, plate stain by age | sediment heightfield + **strata epochs** + stain + land/sea + pores | MAP-Elites guide + discovery plate (2D card), pull-back #2 to eye level |
| **H14** | **checkpoint: full arc unattended** | | | |
| 14–16 | pin demo seeds, bake the pre-evolved menagerie per preset | perf tiers (512/768 agents, 8-side loft) | **persistence arches** (C), MeasuredState → `derive.ts` | rehearse, audio cues (Si glass tick), presets |
| stretch | B abscission bells (cap → founder bell genome) | FABRIK tentacles | D8 rivers + stream-power incision (eco-10, eco-15) | little-planet bookend (E), chemistry lens (E §3.7) |

The H18 feature freeze in TRACK still applies.

### 4.7 Top 5 risks

| # | Risk | Mitigation | Kill switch (what we cut first) |
|---|---|---|---|
| 1 | Selection doesn't reach legs, horns and plates in demo time | deep-time ×40 real ticks, founder variance from copier mis-pairing, stress mutagenesis, Vitest assertions on the target genomes from H8 | load the pre-evolved menagerie (declared) |
| 2 | r187 loft/IK pipeline: storage reads in vertex nodes, ≈0.85M fauna vertices + up to 61k twigs | H0–1 smoke test, DataTexture fallback, low tier | drop FABRIK, then IK (rigid legs swinging on a sine), then fall back to bead bodies at 3× size |
| 3 | The prelude reads as a generic particle demo, or no copier forms in time | keep it ≤22 s, show the Si/C contrast at 0:08 and the hydrolysis lock at 0:11, force the copier at 0:20 if none | skip bonding: boil → beads → copier directly |
| 4 | Terrain looks thin (F's admitted weakness): deposits too small at ×1 | geologic gain on deposition during ⏩ only (A C1, declared), world-gen spire/arch meshes render the emergent positions, backdrop landforms past the rim | cut persistence arches → spires only. Cut rivers |
| 5 | Scope and integration across 4 owners | frozen contracts at H1, fixture-driven parallel work, H8 and H14 checkpoints | cut order: rivers → B bells → lens → little planet → two-bestiaries (keep one) → threads' ledger bar (keep the threads) |

**Never cut:** pixel → copier → "opens its eyes", Si-facet development, Water dissolution + plates, amber threads, the discovery plate, the eye-level pull-back.

---

## 5. Conflicts to resolve

| # | Conflict | Where | Recommendation |
|---|---|---|---|
| 1 | **E replaces world-gen's 9 niche species with genome flora and changes the `derive.ts` contract.** A says landforms and niche flora "contradict the philosophy". C reuses them as variants | E §3.5, A §9, C §5 vs `docs/features/world-generator.md` §2 | Keep world-gen **unchanged as core plus backdrop**. Add one **additive** `MeasuredState` input (builders, pores, life, glow, glowHue) that overrides the dial-derived values when the sim is live. Foreground flora = F's L-system only. Niche species appear only beyond the dish rim as declared render-only backdrop. Landform meshes (spire, arch, pores) are *renderers* for emergent positions. Needs sign-off from the world-gen core/landforms/flora owners |
| 2 | **Stain colours.** Atlas §6: water `#C61807`, methane `#AD603B`, acid sulfur `#E2CF95`, ammonia `#5A3B52`. World-gen (built, Tier 0 calibrated): water `#F94B1E`, methane `#C3C4D4`, acid tan `#A47C68`, ammonia `#5A3B52`. A uses the atlas set, C/D/E the world-gen set | Atlas §6, world-generator §2, A §4.3, C §4 | Use the **world-gen constants** (implemented and pin-calibrated: eco-14's measured `#9B6E59` is near tan, not sulfur). Adopt E's methane fix `mix(#C3C4D4, #AD603B, light)` so eco-05 gets tholin orange. Update Atlas §6 to match |
| 3 | **2D vs 3D sim.** B simulates 3D cells. The rest use a 2D plane | B §3.0, DESIGN §8 | 2D sim plane, 3D render, render-only altitude (DESIGN's leaning) |
| 4 | **"Nothing walks"** (ART_DIRECTION §1 pattern 5) vs F's IK walkers and the board's striders and rhino-lizards | ART §1, F §3.5 | Amend ART: *walk on land, swim in liquid, float in thick air*, chosen by the ledger. Floating stays the R11 signature in cold, dense seas |
| 5 | **Where the atoms live.** GPU 32–49k with REPORT §6.5 bonding (A, E), CPU 3k (F), counts only (D) | A §3.1, E §3.2, F §3.1, D §10 | CPU 3–4k for the prelude. GPU bonding is stretch. The visible "hard thing" for Technical is the GPU pose/skin compute plus deep-time evolution, not atom count. F's 28k GPU particles is under the brief's 32k floor: add motes or threads, or accept it |
| 6 | **What the pixel is:** Spark atom (A, E, F), meteor + dawn (D), seed cell (B), field cell (C). DESIGN §8 says the player drops the Spark | all §2 | A Spark atom that the **player clicks to ignite**. D's impact ring becomes the world-style reveal-radius rim. No meteor, no scripted dawn |
| 7 | **What ⏩ means:** geologic gain that breaks mass conservation (A), rate scaling (B), more ticks (F), auto-ripen (E) | A §4.7, B §3.5, F §10, E §3.0 | ⏩ = more **real** ecology ticks in the worker. Geologic gain applies only to deposition, and is declared. No auto-ripen in presenter mode |
| 8 | **eco-01's tall horned figures vs R6** (hot makes things small). World-gen already replaces them with black monoliths | Atlas eco-01, C §8, F §8 | Accept small horned walkers plus monolith flora. Note it in Atlas rather than bend R6 |
| 9 | **Tilt-shift** in the dish vs eye level | world-style | On during the prelude and dish, eased off during pull-back #2 (world-style already says full-scale views drop it) |

---

## 6. Open questions for the team

1. **Is the pre-evolved menagerie an acceptable kill switch?** The genomes are real outputs of our rules, but not live. Who signs off on the on-screen wording?
2. **World-gen owners:** do you accept the additive `MeasuredState` input and backdrop-only niche flora (conflict 1) before H1?
3. **Art owner:** do you approve the walking amendment (conflict 4) and the world-gen stain set plus the methane tholin fix (conflict 2)?
4. **Demo mode:** presenter-driven dial moves (as in every design) or a pinned autoplay seed with the presenter narrating? This decides whether E's auto-pull ships.
5. **Ownership:** who is D1 (Life)? It's the critical path and tuning is the whole job (TRACK's "who is genuinely into this" gut check).
6. **Hunger:** keep it as a separate dial (Atlas §6 open question)? It's the only control whose immediate effect (chase/flee) is behavioural, so I'd keep it.
