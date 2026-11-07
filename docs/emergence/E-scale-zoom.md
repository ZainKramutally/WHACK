# Emergence design E: Powers of Ten
> Starting philosophy: the first pixel is the camera fully zoomed into one atom; each scale that completes becomes the texture of the next, and only real state crosses each zoom  ·  Final scores: E4 C4 A4 S5 F4 I4

## 1. The idea in one paragraph

The camera starts on one lit atom and only ever pulls back. Five scales sit nested inside each other: **molecules → cells → organisms → landscape → planet-in-a-dish**. Each one runs its own cheap model, and each pull-back is gated by a detector on the scale below. The thing that crosses every zoom is a **genome**: the atom sequence and measured joint angles of a real copier chain from the molecule soup. Every higher scale reads that same string differently. At S2 it is a cell's inner chain. At S3 it is a body plan, because cells divide in genome order and bond with the same angle rule the atoms used (R1). At S4 it is a niche and a range. At S5 it is a colour on the planet. Waste follows the same route. Stone atoms from S1 become rubble at S3, builders' shells pile into spires at S4, and the sea stains them with age. So the tallest spire in the landscape stands where your builders actually lived. Organisms are drawn with the same bead-and-rod renderer as molecules, so **a creature is its own molecule, drawn bigger**. When you click one and dive back in, you land on that molecule, copying (or dissolving) live under the current dials. One chemistry table (`chem.ts`) is read at every scale, so the creature's fate at S3 and its molecule's fate at S1 always agree.

## 2. The bloom: pixel → world timeline

The demo arc runs 3:00. Times assume the default "Earth-ish" start (Recipe C-leaning, Water) and the presenter's moves shown.

| t | What the player sees | What is actually simulated | Emergent / seeded / scripted |
|---|---|---|---|
| 0:00 | A single amber pixel on black | Atom #0, a Spark, at the centre of a 32k-atom Chem pond. Every other atom exists but is drawn at 8% brightness, and only atoms that are bonded or carrying Spark are lit | **Seeded** (atom #0). Unlit atoms are a render choice |
| 0:02 | The pixel blooms. A second point flares as the first bond forms | GPU mutual-best bonding | Emergent |
| 0:03 | A short chain appears beside the pixel | **Seed copier**: 4 atoms sampled from the current Recipe, bonded as a template | **Seeded** (named, one per run) |
| 0:04 | The camera eases out half a decade. Dozens of lit beads appear under amber Spark rain | Chemostat inflow, Spark rain ∝ Light, bonding and breaking | Emergent. Camera scripted |
| 0:09 | The chain doubles with a copy flash ("it copied itself") | CPU-assisted templated recruitment of **real nearby free atoms** (§3.2) | Mechanism CPU-assisted, content emergent |
| 0:15 | Copies multiply. Cyan Si chains crumble into bone dust in water | Hydrolysis and Si–O → Stone reactions | Emergent |
| 0:15–0:40 | Presenter drags Recipe to Si (it fails), then picks Sea = Acid (it survives). A readiness ring breathes at the frame edge | S1 detector: ≥ 60 live copiers and ≥ 2 genomes with ≥ 8 copies, held 3 s | Emergent. Ring is UI |
| ~0:40 | **Pull back #1** (2.5 s). The soup shrinks under a membrane: we were inside the first cell | Census → protocell promotion at real copier-cluster centroids. The S1 render target becomes the origin cell's interior | **Real handoff**. Camera scripted |
| 0:45 | Cells bud and spread into the empty dish. Some lineages visibly dissolve | Life kernel: energy, budding, dissolution from `chem.ts` | Emergent |
| 0:55 | Colonies grow by division: curling coral chains, stiff cyan zig-zags, Spark caps | Development: each division adds the next genome type, bonded at the R1 joint rule | Emergent (the development rule is authored) |
| ~1:05 | **Pull back #2**. Membranes fuse into skins and creatures swim. Sessile colonies stand up out of the rubble as flora | Same Life state. Render reinterprets colonies (skin, 3D lift) | Real state. Skin and lift are render-only |
| 1:10 | **Discovery plate #1** (specimen card with the creature huge and a tiny human at its foot) | First lineage with a new role reaching 10 organisms | Scripted beat on a real organism |
| 1:15–1:45 | Hunger up: hunters chase and plated prey take over. Light down: caps fold into glowing cups within 3 s | Bite gain, selection, cap/glow uniforms | Emergent, plus an immediate render response |
| ~1:45 | **Pull back #3**. The arena becomes one tile of a bone-white landscape, and colour spreads outwards from it as a wave | Range engine seeded with the exact S3 census at the origin tile, Fisher–KPP spread | **Real handoff** |
| 1:55 | ⏩: spires rise where builders live, stone stains, rivers cut channels | Deposition, stream-power incision, stain(age) | Emergent |
| 2:10 | **Discovery plate #2**: a landscape giant (an elder or the largest drifter) with a human silhouette | Auto-cinematographer picks the largest real organism | Scripted beat on real state |
| 2:20 | Click a creature. The dive goes body → cells → **its molecule**, copying in a fresh pocket | 4k-atom Chem pocket seeded with that genome under the current dials | Real (a fresh sim seeded from the genome) |
| 2:45 | **Pull back #4**. The landscape curls into a little planet inside a glass dish (the S1 pond rim), then shrinks to a single pixel | Render-only bend on the live Range state | **Scripted** bookend |

## 3. Stages in detail

### 3.0 Shared pieces (built first, H0–H2)

| Piece | What it is | Why it matters |
|---|---|---|
| `genome.ts` | `Genome { id, backbone: Uint8Array(≤12) /*0 C,1 Si,2 O*/, caps: u16 /*Spark cap bitmask*/, angles: Int8Array /*measured joint angle ÷2, deg*/, parent, bornAt }`. Canonical key = backbone + caps. The name is deterministic from the key (Latin root per family + role suffix) | The only content that crosses scales |
| `chem.ts` | One table: grip `E[a][b]` normalised to C–C = 1 (Si–Si .64, C–Si .92, C–O 1.03, Si–O 1.31, O–O .41, Spark–X .5, from REPORT §6.1 and note 07). Solvent attack `hydro[sea][bond]` = REPORT §6.1 scores × 0.03, with acid on C ÷10. `kT_eff = E_backbone/4 · τ(heat)`, where τ maps heat 0 → E/kT 8, 0.5 → 4, 1 → 2. `stability(genome, sea, heat)` = mean bond lifetime | Every scale reads this. S3 survival and S1 dissolution are the same numbers |
| `handoff.ts` | `ChemHandoff`, `LifeHandoff`, `RangeHandoff` (below). Each scale exposes `init(handoff, dials, seed)` | The ledger rule: **init may use the seed only for layout jitter, never for content.** A Tier 0 test asserts that init is a pure function of (handoff, dials, seed) and that species lists match the handoff exactly |
| `zoom.ts` | Log camera `z = log10(view width)`. Each scale owns a z band, and a transition is a 0.4-decade crossfade. During a crossfade the outgoing scale renders into one 1024² RGBA16F target, which the incoming scale samples on the **origin instance** (the first cell, or the arena tile). At most two sims run at once | Makes "the previous scale becomes texture" literal |
| Readiness | Each scale has a detector. When it fires, a ring breathes at the frame edge and scroll-out unlocks. Before that, scroll-out rubber-bands and names the blocker ("Nothing copies yet. The sea looks hungry…") | Turns the zoom into a verb, not a timer |
| Auto-ripen | No input for 8 s and detector not fired → Time eases to ⏩×4. Demo mode also auto-pulls 2 s after ready | Declared pacing aid |

### 3.1 S0: the pixel

There is no separate sim. S0 is the Chem pond at maximum zoom (atom radius ≈ 0.6 px at t = 0, so atom #0 is literally one HDR pixel with bloom off for 0.5 s). The camera's first move is a 0.5-decade ease-out at t = 4 s. **Hands off:** nothing. It is the same buffers as S1.

### 3.2 S1: molecules (Chem engine, GPU)

**State** (N = 32,768 high, 16,384 low; 2D disc of radius 64 u, atom radius 0.5 u):
`pos vec2f[N]`, `vel vec2f[N]`, `type u32[N]` (0 C, 1 Si, 2 O, 3 Spark, 4 Stone, 5 Gas, 6 Spent), `lineage u32[N]` (genome id + 1), `bond u32[N*4]` (slots 0–1 backbone, 2 Spark cap, 3 stone/rung; `0xFFFFFFFF` = empty), `prop u32[N]`, bins `cellCount atomic<u32>[128²]` + `cellItems u32[128²*16]`, `cmd u32[N*2]` (CPU bond commands), `stats atomic<u32>[16]`. About 3 MB in total.

**Passes per substep** (2 substeps per frame, ×4 at ⏩):
1. `clearBins` → `bin` (atomicAdd bucket, CAP 16, never reorder: REPORT §6.5).
2. `forces`: short-range repulsion; a 4×4 particle-life matrix whose asymmetric part is scaled by **Hunger**; bond springs; angle stiffness by pair (Si–Si joints snap to the nearest of 180/120/60°, C–C joints are soft with a preferred ±25° curl, R1); Brownian jitter ∝ kT.
3. `break`: `hash(min,max,tick) < exp(−E/kT)·dt + hydro[sea][pair]` (symmetric roll, no communication).
4. `propose` / `commit`: mutual-best handshake (Fagginger Auer & Bisseling 2012). Valence is 2 backbone + 1 cap. A branching penalty and the 30% largest-molecule alarm (DESIGN §7) prevent gel.
5. `applyCmd`: each atom applies only commands addressed to itself (single writer).
6. `react`: Si with ≥ 2 O bonds → **Stone** (bone, sinks, never bonds again: R2). C with 2 O → **Gas** (rises out of plane and fades over 2 s, R2). Forming a bond consumes a Spark within 3 u → **Spent**.
7. `chemostat`: atoms at the rim are exchanged with an infinite reservoir in the Recipe ratio, and free interior atoms re-type towards the Recipe at 0.3/s. Spark rains in at `0.2 + 2·light` per frame per 1k atoms. Gas and Spent atoms respawn at the rim after 8 s.

**Replication** (CPU-assisted, honest). Every 250 ms, `getArrayBufferAsync` reads `pos/type/bond/lineage` (≈ 640 KB). The CPU extracts linear chains (degree ≤ 2 on backbone slots), groups them by canonical key, and tracks lineage. For each template chain (lineage ≠ 0, refractory `1.5 s / rate(heat)`), it builds a spatial hash and greedily matches every template atom to a **free atom of the same type within 3 u**. With probability `μ = 0.02 + 0.08·heat` per atom, or whenever no same-type atom is nearby, it takes whatever free atom *is* nearby. That is a mutation, so **the Recipe biases evolution through availability**. A copy also needs one free Spark within 4 u (the copy cost, so Light drives the copy rate). If ≥ 75% of the template matches, the CPU writes bond commands for the child, and the springs and angle rules pull the recruited atoms into shape (stiff Si joints visibly snap). A child is a new genome if any atom changed. Measured joint angles, averaged over all live copies, are stored in `Genome.angles`. Stretch goal: replace the CPU step with Hutton-style GPU rung rules (Hutton 2002).

**Controls:** Recipe = chemostat mix and mutation bias. Sea = `hydro` row and palette. Heat = kT (jitter, break rate, μ). Light = Spark rain, so copy and bond rate. Hunger = asymmetric pull, so atoms stream and chains collide more. Time = substeps.
**R-rules:** R1 (joint angles), R2 (Stone, Gas), R5 (hydro by sea), R9 (family colours, per-atom jitter).
**Detector:** ≥ 60 live copier chains and ≥ 2 genomes with ≥ 8 copies, held 3 s. Stall at 20 s with no persistent copier → hint.
**Hands off** (`ChemHandoff`): census (top ≤ 16 genomes with count, copyRate, halfLife, Spark use and cluster centroids), `stoneFrac`, `gasFrac`, Stone atom positions rasterised to 256², and the RT.

### 3.3 S2: cells (Life engine, GPU, same kernel code)

**Promotion.** Chains of the same genome within 6 u of each other, ≥ 3 of them, form a cluster, and each cluster becomes one **protocell** agent at its centroid (≤ 256 founders, membrane radius 2.5 u). This is the Gánti criterion reduced to template + membrane + Spark metabolism. The Life domain is the S1 disc extended to radius 256 u. The S1 soup stays as frozen texture in the middle, and new cells spread into the empty dish.

**State** (N_L = 4096 cells): `pos, vel vec2f`, `heading f32`, `energy f32`, `stored f32` (glow), `age f32`, `genome u32`, `seg u32` (index into the genome, 255 = founder), `org u32` (colony id), `bond u32[4]` (prev, next, cap, anchor), `flags u32` (anchored, dead, plastic tip type). The species table is a storage buffer of 256 × 16 f32: length, counts by type, rate, `stability(sea,heat)` (the CPU recomputes it on any dial change), rust, biteGain, armour, eyeRange, buoyancy and RGB. Grids (256², over the domain): `stone atomic<u32>` (fixed-point), `detritus atomic<u32>`, `shade` (cap count per cell).

**Rules** (the kernel is Chem's bin, spring and angle passes with new parameters, plus the following):
- **Energy:** producer cells (Spark caps) gain `light·caps·(1−shade)·rate(heat)`. Mouth cells (seg 0) eat detritus. Biter cells take energy from touched cells of other species: `bite = (0.2+0.8·hunger)·(1−armour_target)`. Metabolism cost ∝ length·rate. Dissolution damage = `1/stability(genome, sea, heat) − armour`.
- **Development by division:** a colony with energy above `cost(seg)` divides, and the daughter takes type `genome[seg+1]`. It bonds to its parent at the genome's measured joint angle (backbone) or as a side branch (Spark cap). Division speed ∝ rate(heat). The body is grown, not stamped.
- **Budding:** a complete colony with energy above `cost(L)·1.5` releases a founder cell. The CPU (4 Hz, via a ≤ 128-entry spawn buffer, single writer) mutates its genome with point, duplication (L+1, capped at 12) or deletion changes. Point mutations are drawn by **current Recipe availability**.
- **Death:** energy ≤ 0, age > lifespan(heat), or dissolution. Dead cells atomicAdd into `stone` (Si–O content: shells) and `detritus` (C content).
**Detector:** the first colony with ≥ 5 cells buds a colony that also completes. **Hands off:** the same buffers continue (S2 and S3 are one simulation seen at two zooms), plus the stone grid seeded from S1's rasterised Stone atoms.

### 3.4 S3: organisms (same Life engine, wider view)

**Genome → body grammar** (Life Engine cell types, mapped from chemistry):

| Genome atom (context) | Cell role | Body part rendered | Rule |
|---|---|---|---|
| C | mover | soft coral bead, fat capsule bond, flex joint. Thrust = `sin(ωt + k·φ)` along the local normal, so chains S-wave | R1 |
| Si | strut | faceted cyan bead, thin bright rod, rigid joint at the measured S1 angle | R1 |
| Si–O adjacent pair | plate | bone plate: armour 0.4, deposits a shell on death | R2, R5, R10 |
| C–O adjacent pair | biter | magenta frill (mid-body) or horn (seg 1–2) | R10 |
| Spark cap, sessile | light organ | **cap** (width ∝ light) or **glow cup** when light < 0.4 (emissive ∝ stored) | R7, R8 |
| Spark cap, motile, near head | eye | Si colonies: 3–6 amber dot-eyes. C colonies: 2 ring eyes. A single cap = one big glossy eye | ART_DIRECTION §5 |
| seg 0 | mouth | — | — |

**Roles emerge, they are not assigned.** No C cells means no thrust. A founder that lands on stone (s > 0.2) or has no movers anchors and becomes **sessile flora**. One that doesn't and has Spark caps holds gas, so it is **buoyant** and drifts (`cruise height ∝ caps·(1−heat)`, R11). Movers without biters are **grazers**. Movers with biters become **hunters** only if biting pays, which needs Hunger. Each lineage is classified every 2 s by its measured energy intake: light > 0.6 → producer, prey > 0.4 → hunter, otherwise grazer. Sessile with rust > 0.3 → builder.

**Sensing and motion:** eyes give a sensing radius `3 + 4·eyes` u, which steers the head towards food, prey or glow (glow lures hunters, as the atlas says) and away from threats. Chase and flee gains scale with Hunger. Grazer alignment is weighted by `1.2·g(hunger, .5, .2)`, so shoals form at medium Hunger (R10, a declared tuned rule, after Reynolds 1987). **Body scale:** segment length `ℓ = 0.2 m·(1.6 − 1.2·heat)` on new growth, so cold makes giants (R6).
**Plastic tips:** every `6 s/rate` each colony re-recruits its tail cell type from current availability. This changes the body but not the genome, so the Recipe shows on bodies in 3 s, but only offspring keep the change.
**Builders:** sessile Si–O colonies deposit a shell into `stone` every budding. Founders prefer to anchor on stone, so reefs accrete like DLA (Witten & Sander 1981, R12).
**Detector:** producer, grazer and hunter lineages each have ≥ 5 organisms for 8 s, or 40 s pass (thin worlds are allowed through, which is how eco-10 happens). **Hands off** (`LifeHandoff`): species list (genome, role, population, growth rate r, motility, buoyancy, rust, measured lifespan), a k×k predation matrix (bites counted on the GPU), the stone and detritus grids, `gasFrac`.

### 3.5 S4: landscape (Range engine, CPU) on the world generator

**Scale is metric from here.** 1 u = 8 cm, so the 512 u arena is one 40 m tile of a 64 × 64 tile, 2.56 km landscape. The origin tile in the centre holds the live Life agents (they keep running while the camera is within 2 tiles). Every other tile is a metapopulation.

**State** (Float32Array per tile): `h0` (fBm from the seed, layout only), `s` stone, `det`, `n[16]` (species densities), `A` (flow accumulation), `T` (`heat − 0.25·h/h_max`, so peaks are colder), `L` (`light·slopeShade·(1−canopy)`). About 360 KB.

**Update at 10 Hz** (Lotka–Volterra on a lattice with Fisher–KPP dispersal; Fisher 1937; Levins 1969):
`ṅ_k = r_k·f_k·n_k(1 − Σ c_kj n_j / K) − m_k n_k + D_k ∇²n_k − Σ_h a_hk n_h n_k + e·Σ_p a_kp n_p n_k`
- `f_k = stability_k(sea, T_i) · access_k`, where access is light for producers and detritus/prey for the rest. `r_k`, `a_hk` and lifespans are **measured at S3**, not invented.
- `D_k ∝ movers`. Buoyant drifters ×3 when cold (thick air, R11). Sessile ×0.2 (spores).
- The front speed is `2√(rD)`, so a player can predict that fast swimmers colonise first.
- **Initial state:** the origin tile = the exact S3 census. Every other tile = 0. Every tile gets an abiotic stone layer ∝ S1 `stoneFrac` (pre-life rust, R2). The landscape starts **bone white**, and colour spreads as life arrives (R9).

**Terrain from waste:** `s_i += Σ_k n_k·rust_k·0.02·dt_time`. `h_i = h0_i + 30 m·s_i`. Tiles that are a local maximum of s with s > 0.5 become spire landmarks (world-gen spire mesh, height = `spireHeight·s`). Pores ∝ builder occupancy, and inhabited dim pores glow (pore dwellers, R12). Two spires within 3 tiles with `(1−heat)² > 0.5` fuse into an arch. **Water:** D8 flow accumulation every 1 s (O'Callaghan & Mark 1984). Stream-power incision `dh = −K·A^0.5·S·dt` scaled by age-rate (Cordonnier et al. 2016), plus talus relaxation. Tiles below the 35th height percentile are sea, and tiles with A > A* are rivers, both in the Sea's liquid colour.

**Elders** (eco-13): a sessile builder species with L ≥ 10, `heat < 0.35`, `age > 0.85` and `hunger < 0.4` promotes its oldest individual to a landmark. The development function is re-run at ×40 scale. A chain longer than its support height droops, and if its tip touches ground it roots, which makes an arch. Epiphytes use the anchoring rule (founders anchor on any sessile body). Stain bands are laid down per age step, like rings.

**MeasuredState → world-gen `derive.ts`** (the contract extension, §9): `builders = mean s`, `pores = mean builder occupancy`, `life = mean Σn`, `glow = mean producer stored·(1−light)`, `glowHue = density-weighted family colour of producers`, `arches` gated by real spire pairs. Palette, stain (`stoneColor`), snow, fog and char keep their dial formulas. Added: a **life stain** that lerps stone towards the dominant species colour by `density·age·0.25` (the pink spire of eco-07). The 9 named niche species are **not used**. Their meshes become the parts library for §5.

**Detector:** ≥ 60% of habitable tiles colonised, or 45 s. **Hands off** (`RangeHandoff`): h, s, n, rivers, age, per-tile life colour.

### 3.6 S5: planet in a dish (render-only)

The terrain vertex shader blends flat → sphere with a `bend` uniform over 3 s (a little-planet stereographic warp). It is driven by the **live** Range textures, so the patchwork is the real range map. Rim haze uses the Sea palette. Cloud wisps ∝ total gas fraction (carbon worlds are hazy, R2), and ice caps ∝ snow. The planet sits in a glass dish that is the **S1 pond rim mesh**, scaled. Then it recedes to a 1-pixel HDR point at the screen position of frame 0. Stretch: a second dish showing the previous run's saved `RangeHandoff` (64² × 16 floats), as a carbon vs silicon A/B.

### 3.7 The chemistry lens (zoom back in)

Click any organism (a live S3 agent, or an S4 impostor, since its species is real). The camera dives: body → its cells (already its segments, with membranes faded back in) → **its molecule**. On arrival, Chem's second buffer set (4,096 atoms) starts a pocket seeded with 8 copies of the genome as templates plus chemostat atoms in the current Recipe, under the current Sea, Heat and Light. The pocket's measured halfLife and copyRate are written back to the species table, which tightens S3 and S4 fitness, so the lens is a real instrument. Change the Sea while inside, watch the molecule dissolve, pull back, and the creature's lineage is thinning.

### 3.8 Every control at every scale

| Control | S1 molecules | S2–S3 cells, organisms | S4 landscape | S5 | First effect ≤ 3 s (any scale) |
|---|---|---|---|---|---|
| **Recipe** | chemostat mix, mutation bias | budding mutations by availability; plastic tips | new sprouts; abiotic stone layer (O-rich → more) | colour mix (slow) | drifting motes recolour in 1.5 s; growing tips turn cyan and straight (Si) or coral and curled (C) |
| **Sea** | hydrolysis row | dissolution via `stability` | palette, stain target, river liquid, who survives | atmosphere | whole field palette lerps in 1.5 s |
| **Heat** | kT: jitter, breaks, μ | rate, lifespan, new-growth scale | lapse rate (snowline), char, erosion, elders | ice / scorch | everything shimmers or stills, and creatures speed up or slow down instantly |
| **Light** | Spark rain, so copy rate | producer income; cap width / glow | sun, caps vs cups, two suns at ≥ 0.85 (dressing) | terminator | Spark rain thickens or thins; caps widen or fold into cups |
| **Hunger** | asymmetric pull (streams) | bite gain, chase/flee, shoaling | predator coupling `e·a` | none (honest) | eye glints and chase streaks within 1 s |
| **Time** | substeps | substeps | `age` → stain, deposition, incision | rotation | everything speeds up; at S4 the stain visibly creeps |

## 4. Terrain and environment

- **Ground** is a record of the past. Layer 0 is abiotic stone from S1's `stoneFrac` (an Si+O-heavy recipe rusts before life even starts). Layer 1 is S3 rubble: real S1 Stone atoms rasterised into the 256² stone grid, plus shells from dead Si cells. Layer 2 is S4 deposition: `Σ density·rust` over time. Heights come only from h0 (seeded fBm, layout) plus 30 m·s, so **every spire is accumulated shells**.
- **Spires, pores, arches:** placed at real local maxima of s. Pores are carved by builder occupancy. Arches need cold and paired spires (world-gen `arches` term, gated). Erosion = `heat·age` sharpens spires and closes pores (world-gen `erosion`).
- **Stains** (R3): world-gen `stoneColor` (bone → sea stain by age, with height falloff), plus the life stain above. **Proposed change:** methane stain becomes `mix(#C3C4D4, tholin #AD603B, light)`, because the atlas wants tholin orange in bright methane (eco-05) and world-gen currently "barely stains" methane.
- **Water:** sea below the 35th percentile, rivers by D8 accumulation, canyons by stream-power incision. All of them use the Sea's liquid colour, so methane rivers are white (eco-15, Titan [sci]).
- **Sky** (R4): world-gen palette field (calibrated pins + sea palettes). Haze density per sea, and cloud wisps from gasFrac.
- **Colour budget** (ART_DIRECTION rule 1): barren tiles stay bone or stained. Saturation appears only where n > 0, so the S4 colour wave *is* the health readout.

## 5. Flora (producer forms)

Flora is **sessile lineages**, rendered from the genome with a parts library (world-gen's cup, cap, stalk, fan, dome, ribbon and whisker meshes, re-tasked as parts).

| Genome feature | Form | Rule |
|---|---|---|
| Si-rich backbone, 120°/60° measured joints | straight trunk with zig-zag or fan branching (frost fans, crystal trees); stiff, no sway | R1 |
| C-rich backbone, soft curl joints | swirl stalk, bending and swaying | R1 |
| Spark caps, light ≥ 0.4 | flat caps, width ∝ light (parasols, shelf caps) | R7 |
| Spark caps, light < 0.4 | glowing cups and lit pores, emissive ∝ stored energy | R8 |
| Si–O pairs on a C stalk | bone flecks on the cap (eco-08 spots) | R2 |
| High O fraction | magenta and pink tint (lantern cups) | R9 |
| Repeated identical segments | stacked domes or tiers | R1 |
| Anchored on another sessile of its own lineage, bright light | **stacking**: colonies bud upwards into pillars (eco-03) | R7 |
| Shade from neighbours' caps | the rendered stalk lengthens ×(1 + shade), so tall reachers appear in dense forests | R7/R8 |

The 2D chain is lifted into a vertical plane rotated by the organism's heading (render-only). Cold growth scale makes the giants.

## 6. Fauna (motile and buoyant lineages)

- **Bodies** are the genome itself: bead or rod per atom family, plates at Si–O, frills or horns at C–O, eyes from Spark caps near the head. Colour is per-family with a ±5° jitter seeded by genome id, so a mutation shifts the confetti pattern (fauna-02's three colourways).
- **Motion** emerges from the cell mix. C-rich chains undulate (eels, serpents). Si-rich chains with few movers glide stiffly (darts). Buoyant Spark-capped colonies drift at cruise height in cold air (jellies; sky whales when C-heavy and long).
- **Hunters vs grazers:** biters only profit when Hunger is high, so hunter lineages bloom at fierce Hunger and starve at gentle Hunger. Plates are then **selected**, not assigned (R10). Alternating C/Si genomes give banded hunters (fauna-05). One head cap gives the big glossy eye (fauna-06).
- **Behaviour:** eyes steer. Glow lures hunters in the dark. Shoals form at medium Hunger. Prey flee within eye range.
- **At S4** consumers beyond the origin tile are instanced impostors (≤ 1.5k bodies × ≤ 12 segment instances), with density ∝ n_k, cheap GPU boids inside each tile, and the real genome mesh.

## 7. Ecosystem dynamics

- **Energy flow:** Light → Spark caps (producers) → grazers (mouths on detritus and producer cells) → hunters (bites). Death → detritus (C) and stone (Si). Carbon waste leaves as gas, which feeds haze (R2). Energy is conserved per bite (efficiency e = 0.3), so stable hunter populations need prey ≥ ~3×.
- **Trophic levels:** measured at S3, and they carry the predation matrix into S4. Typical outcomes: gentle Hunger gives 2 levels with crowded producers; medium gives 3 levels with shoals; fierce gives oscillation (Lotka–Volterra cycles visible as colour pulsing across tiles).
- **Succession at S4:** pioneers (fast D) colonise first. Builders accrete stone, which raises tiles (colder, more light at the top) and opens new niches for capped producers on top (eco-06). Old stone stains.
- **Collapse:** heat high + age → erosion and short lifespans. Species drop out tile by tile and the world reverts to stained bone (eco-01, eco-10). The landscape going white is the warning (ART_DIRECTION rule 1).
- **Live monitors** (DESIGN §7 plus): largest S1 molecule 10–200 atoms, species count rising, ≥ 1 break per 100 bonds, dead fraction < 0.5, Life population 500–4000, Range Σn > 0.

## 8. Atlas coverage

Settings are taken from WORLD_ATLAS §5.3. "Reached" means the mechanism exists. It is **unverified** until the atlas harness (§9) passes.

| Pin | Status | Mechanism |
|---|---|---|
| eco-01 Vermilion Eclipse | **reached** | Si+O in water: Si chains hydrolyse and O rusts the rest, so stoneFrac is high and becomes a thick abiotic layer. Hot means short-lived life and char (black monoliths = charred C survivors). Fierce Hunger gives horned hunters. Old water stain turns stone vermilion. Eclipse = world-gen sky event (dressing) |
| eco-02 Violet Sun Hollow | **reached** | Acid spares Si. Si+O genomes give violet bodies (patchwork of cyan and magenta), with dorsal Si rods as spikes. Plated grazers plus one hunter lineage at medium Hunger. Crystal trees are Si sessiles. Cratered rock = builder pores |
| eco-03 Sindha pillars | **reached** | C sessiles stack into pillars in bright light. The water sea covers low tiles. Drifting buoyant fliers. Top-down camera chosen by the cinematographer |
| eco-04 Frost Arches | **reached** | Methane spares Si. Builders accrete spires, cold fuses them into arches, dim light means glow cups, O-rich producers are pink |
| eco-05 Parasol Giants | **reached** (needs the proposed tholin stain) | C in cold methane: stable but slow, cold growth scale makes giant caps, bright light gives wide caps |
| eco-06 Capped Sea Stacks | **reached** | C+Si in water: Si dies to stone, so stone stacks rise. C producers anchor on the elevated stone where light is best. Turquoise sea below |
| eco-07 Two Suns Spire | **reached** | A balanced recipe gives the most surviving lineages. A builder spire carries the life stain of O-rich residents. Buoyant fliers and spores. Two suns = dressing at light ≥ 0.85 |
| eco-08 Coral Forest | **reached** | C caps with Si–O flecks in cold methane, medium light |
| eco-09 Violet Hunter | **reached** | Ammonia partially spares Si. A Si hunter with rod "feathers" thrives at fierce Hunger. Tall straight Si trunks in dim light. Honeycomb = pores |
| eco-10 Red Canyon | **partial** | Canyon from stream-power incision in old hot water stone, with stain. *Missing:* reducing the world to a **single** survivor tower is stochastic; 2–3 lineages often persist |
| eco-11 Kelp Shoal | **reached** | Tall C stalks at medium light. Grazers shoal at medium Hunger, and orange C fish swim at cruise height (R11) |
| eco-12 Glow Garden | **reached** | Si–C genomes (Si–C is the stable bond in water [sci]) give pale cyan stalks. Very dim light means glow. World-gen's green field |
| eco-13 Living Arch | **partial** | The elder rule (droop and root) plus epiphyte anchoring plus stain rings. *Missing:* only appears with L ≥ 10 builders; the arch silhouette is a segmented polyline, not the pin's smooth vault |
| eco-14 Bone Reef | **reached** | Si+O builders in acid accrete DLA reefs. Dim light lights the pores amber |
| eco-15 Lantern River | **reached** | Methane, so the D8 river is white. Old stone arches stain dark. Pink glow cups from O-rich producers |
| fauna-01 Giants | reached | cold Si striders: cold growth scale plus amber dot-eyes |
| fauna-02 Rhino-lizards | reached | Si–O plates in water, three colourways from mutation jitter |
| fauna-03 Jellybots | reached | buoyant Si colonies, trailing rods as tendrils |
| fauna-05 Frilled serpent | reached | alternating C/Si hunter with C–O frills |
| fauna-06 Plated hopper | partial | plates and one big eye, but no hop gait |
| fauna-07 Hammerhead strider | partial | tall acid-stained armour; no flattened head form |
| fauna-08 Confetti eels | reached | mixed C/Si/O chain, per-atom family colour |
| fauna-09 Sky whales | reached | long buoyant C colonies, cold scale |

**Tally:** 13 reached, 2 partial on the ecosystems.

## 9. Build plan

**Modules and owners** (3 builders + lead):

| Module | Owner | GPU / CPU | Budget |
|---|---|---|---|
| `shared/` genome, chem, handoff, names | lead, H0–H1 | CPU | — |
| `chem/` kernel, chemostat, readback | A | GPU compute, 10 passes | 32k atoms (16k low), ≤ 4 ms/substep |
| `census/` chains, lineage, copy recruitment | A | CPU, 4 Hz | ≤ 3 ms per sample |
| `life/` (`chem/` kernel with new params), development, energy, spawn buffer | B | GPU + CPU 4 Hz | 4096 cells |
| `bodies/` bead/rod/plate/eye/cap instancing, sessile lift | B | render | ≤ 40k instances |
| `range/` metapopulation, deposition, D8, incision, elders | C | CPU 10 Hz | 64² × 16, ≤ 2 ms |
| world-gen bridge (`MeasuredState`, parts library) | C | — | flora ≤ 12k instances high / 6k low |
| `zoom/` log camera, RT nesting, readiness, auto-ripen, cinematographer | lead | render | one 1024² RT |
| `lens/` Chem pocket, write-back | B | GPU (second buffer set) | 4k atoms, only while diving |
| `dish/` bend, clouds, pixel loop | C | render | — |

**Frame budget (Apple Silicon, 1080p):** never more than 2 sims at once. S1 ≈ 8 ms (2 substeps plus 32k beads and 64k bond instances). S3 ≈ 4 ms. S4 render ≈ 9 ms (terrain 256² plus flora plus impostors) plus 2 ms of CPU. Transition peak ≈ 15 ms. Low tier halves atoms, instances and RT size.

**16-hour order** (the cheapest demo path first):
1. **H0–2** Contracts and `chem.ts` with Tier 0 tests (stability ordering: C > Si in water, Si survives in methane, acid in between, matching note 07).
2. **H2–6 v0 demo path:** Chem at 16k with the CPU copy; S3 as **rigid turtle bodies** (one agent per organism, body drawn from the genome, no division); Range plus world-gen with measured builders; plain crossfade transitions. *At H6, pixel → S1 → S3 → S4 runs end to end.*
3. **H6–9:** the Life kernel with development by division (S2 appears for free); RT nesting; deposition spires; the colour wave. **H8 checkpoint** (TRACK).
4. **H9–12:** discovery plates, the chemistry lens, auto-ripen, readiness ring, the dish bend and pixel loop.
5. **H12–14:** D8 rivers, incision, elders, life stain; **atlas harness** (Tier 0, < 2 s: a headless Range run on census surrogates scored from `chem.ts` for each §5.3 preset, asserting stone, rivers, glow, species count and char bands).
6. **H14–16:** tune the 5 presets, perf tiers, rehearse. Stretch: GPU Hutton replication, the A/B dish.

**Cut order if behind:** A/B dish → elders → incision → S2 view (keep rigid bodies) → lens write-back (keep the visual dive).

## 10. Honesty box

| Kind | Item |
|---|---|
| **Seeds** | Atom #0 (the Spark pixel). One 4-atom seed copier at t = 3 s, sampled from the Recipe. World seed integer (fBm h0, positions and jitter only) |
| **CPU-assisted mechanism** | S1 copying is done by CPU recruitment of real nearby atoms, not a GPU rule. Budding and mutation are applied by the CPU through a spawn buffer |
| **Authored rules** (local, declared) | Genome → cell-role grammar. Development-by-division order. Plastic tips. Shoal weight `g(hunger)`. Elder droop-and-root. Stacking on own lineage. Life stain. Detector thresholds |
| **Open-system fudge** | The chemostat re-types free atoms towards the Recipe (an infinite reservoir) |
| **Render-only** | Unlit-atom dimming at t = 0. Membranes fusing into skin. The sessile 2D→3D lift and buoyant cruise height. S4 impostor creatures outside the origin tile (real species and densities, fake individuals). Two suns, eclipse, scale figure, clouds. The little-planet bend. The final pixel |
| **Scripted** | Camera choreography and demo auto-pull. Auto-ripen ⏩. Discovery plates (the cinematographer picks real organisms). Names. The pixel loop at the end |
| **Symbolic scale** | S1–S3 share one coordinate system. "Atom", "cell" and "organism" are readings, and the cell → organism pull-back is about 1 decade, not the real ~5. The scale bar uses icons, not numbers. Sizes are metric from S4 |
| **Parts library** | Bead, rod, plate, frill, horn, eye, cap, cup, fan and dome meshes are authored. Their **assembly** comes only from genomes |
| **Science** | Chemistry orderings are [sci] (REPORT §6.1). The ×0.03 hydrolysis rescale, grip normalisation, cell-role mapping and every [game] rule are invented. Say so |
| **Unknowns** | Does S1 reach 60 copiers in ≤ 30 s at 32k atoms (untested; the prototype was well-mixed)? Do PBD colony bodies stay stable at 4 Hz spawn latency? Range parameters are untuned. `getArrayBufferAsync` latency at 640 KB × 4 Hz is untested. eco-10 and eco-13 are stochastic. Replacing world-gen's niche species needs a contract change agreed with the world-gen owners |

## 11. Iteration log

### Round 1: "A film with knobs"
**Proposal.** Six independent models on a 30 s timer: S1 particle life, S2 Gray-Scott spots as cells, S3 boids with random bodies parameterised by 3 inherited floats (rigidity, colour mix, copy rate), S4 world-gen `derive(dials)` directly, S5 a textured sphere. The camera pulls back on the timer.

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 2 | 3 | 3 | 4 | 3 | 3 |

- **E2:** Gray-Scott spots have nothing to do with the molecules. Three floats plus fresh RNG at each zoom means the creatures are new randomness. A timer zoom is a film, and a judge would call it pre-rendered.
- **C3:** at S2–S3 the dials only act through 3 floats. At S4, world-gen already responds to dials, so S1–S3 don't matter at all.
- **A3:** world-gen covers 4 pins. There is no mechanism for rivers, stacks, the living arch, shoals or hunters.
- **S4:** the zoom is gorgeous, but nothing makes the viewer feel the world is *theirs*.
- **F3:** five unrelated models means five codebases.
- **I3:** the player can't tell which scale listens to which dial.
**Revise (lowest E):** replace the 3 floats with a **genome** taken from real S1 chains. Gate zooms with detectors, not timers.

### Round 2: "One genome, five readings"
**Proposal.** The genome = atom sequence plus measured angles. One `chem.ts` read at every scale. A Life Engine–style cell grammar mapped from families (C mover, Si strut, Si–O plate, C–O biter, Spark light organ). Flora and fauna both come from genomes, replacing world-gen's 9 listed species. Detectors gate the zoom. S4 still uses world-gen terrain from dials, with populations placed by niche functions.

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 3 | 4 | 3 | 4 | 3 | 3 |

- **E3:** S4 throws away state. Terrain comes from dials, and populations are re-laid by niche functions, so "a species' waste becomes stone" is not kept. S1 replication is unspecified and will probably be faked.
- **C4:** Recipe has no visible effect after S1, because bodies are frozen once born.
- **A3:** no rivers, canyons, stacks or living arch. Only about 9 reached.
- **F3:** GPU template replication is a research problem. S2 and S3 as two engines is too much.
- **I3:** at S4 a Recipe drag does nothing for 20 s.
**Revise (lowest E, then F):** a **Range engine** seeded only by the S3 census at the origin tile, with deposition heights, D8 rivers, incision and elders. Rasterise S1 Stone atoms into the S3 ground. **CPU-assisted copying of real atoms**, with Recipe bias through availability. Merge S2 and S3 into one Life sim (cells → colonies by division). Add plastic tips so Recipe shows in 3 s.

### Round 3: "Waste becomes ground"
**Proposal.** As §3, but with a separate Life kernel, no readiness UI, no pacing aid, and no lens write-back.

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 3 | 3 |

- **E4:** the Range engine is a mean-field model, and the S4 individuals outside the origin tile are impostors. That is acceptable but has to be declared.
- **C4:** Hunger has no effect at S5. Recipe at S3 is phenotypic only.
- **A4:** 13 reached on paper. eco-10 and eco-13 are stochastic.
- **S4:** pacing risk. S1 could take 60 s, which leaves no time for S4. The spectacle of the lens dive is unplanned.
- **F3:** Chem + Life + Range + world-gen bridge + transitions + lens is a lot for 16 h with no fallback ladder.
- **I3:** scroll-out before a scale is ready does nothing and gives no reason. Hunger at S1 is invisible.
**Revise (lowest F, then I):** **one kernel, two buffer sets**: Life is Chem's bin, spring and angle code with new params, and the lens reuses Chem's second buffer set. A **v0 demo path** with rigid turtle bodies, crossfades and the H6 milestone. Cut order. Atlas harness as a Tier 0 test. A readiness ring plus rubber-band scroll that names the blocker. Hunger at S1 = visible streaming. **Auto-ripen** and the demo auto-pull fix the pacing. The lens writes back measured halfLife, which makes it an instrument, not a cutscene. Little-planet bend into the pond-rim dish, plus a pixel loop as the bookend.

### Round 4: "Powers of Ten" (final)
**Proposal.** This document.

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 4 | 4 | 4 | 5 | 4 | 4 |

- **E4:** S1 copying is CPU-assisted. The genome → role grammar and development order are authored. Camera beats are scripted. Everything that crosses a zoom is real state, enforced by the ledger test, but replication is not self-organised.
- **C4:** Hunger has no effect at S5. Recipe's effect at S3–S4 is plastic or slow (offspring), not immediate in lineages. The hydrolysis magnitudes are [game].
- **A4:** 13/15 reached on paper with 2 partial, which is the 5-bar on paper. It is held at 4 because none of it is measured yet and eco-10 and eco-13 depend on chance.
- **S5:** pixel → copy at 0:09 → "we were inside a cell" → colour wave over bone → curl into the dish → back to one pixel, with two discovery plates and the molecule rhyme. The risk is that the S1 soup reads as a generic particle demo for its first 15 s.
- **F4:** the v0 path is buildable by H6. The full set needs all 3 builders on schedule. Readback latency and PBD stability are untested.
- **I4:** six controls and the zoom, each with a scale-invariant tell. The genome grammar (why O makes horns) has to be learned from the lens.
**Stop:** every criterion is ≥ 4.

**Sources used:** Eames, *Powers of Ten* (1977) and Boeke, *Cosmic View* (1957) for the nesting idea. Hutton 2002/2007 (templated replication, cells). The Life Engine (cell-type grammar). Ventrella / Mohr particle life (asymmetric pull). Gánti 2003 (promotion criteria). Fagginger Auer & Bisseling 2012 (handshake matching). Müller et al. 2007 (position-based dynamics for colony bodies). Witten & Sander 1981 (DLA reefs). Reynolds 1987 (shoals). Fisher 1937 and Levins 1969 (range waves, metapopulations). O'Callaghan & Mark 1984 (D8). Cordonnier et al. 2016 (stream-power terrain). Prusinkiewicz & Lindenmayer 1990 (turtle development). REPORT §6 and note 07 (rates and tuning).
