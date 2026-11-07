# Emergence design B: The Seed That Became a World
> Starting philosophy: the world is one seed growing; terrain, flora and fauna are tissues of a single organism that divides, differentiates, rusts and lets go  ·  Final scores: E4 C4 A4 S4 F4 I4

## 1. The idea in one paragraph

The first pixel is a **seed cell**: one amber cell holding Spark. It divides. Every cell after it is a descendant, so the whole world is one family tree, stored as one GPU buffer of cells with parent pointers. **One growth kernel** runs on every growing tip. Its parameters *are* the chemistry. Silicon content snaps the growth direction to fixed tetrahedral angles and allows more branches (R1, valence). Carbon content adds a steady curl, which gives spirals. Heat sets segment length and lifespan (R6). Light at the tip decides whether the tip opens into a cap or turns into a glow cell (R7, R8). Oxygen rusts silicon cells into bone stone that never moves again, and carbon cells into gas that floats away (R2). The **Recipe is the soil**: it sets which atoms are dissolved in the sea floor, and new cells are built from what they take up. Old lineages hold on to their inherited chemistry, so a dial change shows up as a **growth ring** at the tips. Three things turn this into an ecosystem. Producers compete for **light** (a canopy height grid) and for **nutrients** (diffusing fields). Dead silicon becomes sand that sticks to stone by **diffusion-limited aggregation**, so reefs, spires and arches pile up into terrain. And creatures come from **abscission**: when a branch has stored enough energy and its root bond breaks, the subtree lets go. Its cells keep trying to grow, but a cell that is not anchored turns that push into **thrust**. *Growth polarity becomes swimming polarity.* Curling carbon branches swim in an S-wave and stiff silicon branches tick like clockwork. Mouths eat other lineages' cells. Detached bodies drop spores that root and grow new trees, so flora and fauna are **two phases of one life cycle**, as with coral polyps and jellyfish.

---

## 2. The bloom: pixel → world timeline

The default run is the demo arc. The timings are targets for the tuning, not measurements.

| t | What the player sees | What is actually simulated | Emergent / seeded / scripted |
|---|---|---|---|
| 0:00 | One amber point of light on a dark dish. Camera very close (tilt-shift on). | Cell 0: `role=TIP`, `chem` = Recipe, energy = 4·E_div | **Seeded** (the seed cell, declared) |
| 0:02 | It splits into 2, then 4. A short bead chain stands up. | Division kernel. The early seed-cell boost (E_div ×0.3 for gen < 6) gives a division about every 1.2 s. | Emergent. The boost is a **tuning cheat** (declared). |
| 0:06 | The player drags Recipe toward Si. The next segments snap to sharp angles and turn cyan. Old segments stay coral. | Field composition re-targets in about 1 s, and new cells take up Si. Direction quantisation weight = cell `si`. | Emergent |
| 0:12 | First fork. The sapling has about 60 cells. | Branch roll from valence | Emergent |
| 0:20 | Light ↑: the top tips flatten into small parasol caps. | Tip light > θ_cap, so the tip differentiates into a CAP disc | Emergent |
| 0:28 | Sea = Water (default). Cyan tips flicker and drop off as pale motes. The tree stalls at "branch". | Hydrolysis roll on Si cells. Dissolved Si goes back to the field. | Emergent (R5) |
| 0:40 | Player picks Acid. The sky goes lemon. Silicon holds, and the tree races up. | Sea params swap. Si attack drops from 0.9 to 0.3 (×0.03 scale). | Emergent |
| 0:48 | Bone-white cells appear in the old wood. Sand rains and sticks to them. A white crust starts at the foot. | Rust roll turns cells into STONE. Dissolved/rusted Si turns into SAND walkers that stick by DLA. | Emergent (R2, R12) |
| 0:58 | A cap releases a spore. It drifts and roots, and a second tree grows with a slightly different hue. | Spore = bud of 1 cell, new `lineage` id, chem mutation | Emergent |
| 1:05 | The two trees race for light. The shaded one stops growing tips and turns to glow. | Canopy grid (atomicMax). Shaded tips go GLOW. | Emergent (competition, R8) |
| 1:15 | **Whoa #1: a branch lets go and swims away.** | Abscission: subtree energy > E_abs and the root bond's break roll fires. Unanchored tips turn into thrust. | Emergent. A **midwife cheat** guarantees one by 1:30 (declared). |
| 1:25 | The swimmer grazes caps and they shrink. It drops a spore. | MOUTH cell eats cells of other lineages it touches | Emergent |
| 1:35 | Hunger ↑: new buds sprout horn rods and big-eyed mouths. One chases another. | Hunger sets bud differentiation (mouth/horn vs plate) and steering weight on the organism-energy grid | Emergent (R10) |
| 1:45 | **Discovery shot** (ART_DIRECTION §6): the first persistent lineage gets a name and a specimen plate. | CPU detector: a lineage signature with ≥ 3 living organisms for ≥ 8 s | **Scripted cinematography**, triggered by a detector |
| 2:00 | Time ⏩: reefs thicken into spires, pores glow amber, stone shows stain bands, two branches fuse into an arch, and the population chart oscillates. | Slow-process rate scaling: rust, stain, DLA, erosion | Emergent, with **time compression** (declared) |
| 2:30 | **Whoa #2: powers-of-ten pull-back.** The dish is a landscape. Camera dives to human eye level beside a tiny explorer, under a spire the player grew. | Heightfield and lineage specimens drive the macro skin (§4.5) | Layout emergent. **Upscaled render** (declared). |
| 2:50 | One of the player's swimmers drifts overhead, enormous: the final discovery plate. | Same specimen, instanced at macro scale | Render |
| 3:00 | End | — | — |

---

## 3. Stages in detail

All stages run in **one growth kernel family** on one cell buffer. "Stage" here means which part of the kernel becomes active as the population climbs, not a separate system.

### 3.0 Shared state (GPU)

| Buffer | Layout | Size at N = 65,536 |
|---|---|---|
| `cellPos` | vec4 `xyz, radius` | 1 MB |
| `cellPrev` | vec4 `xyz (Verlet prev), age` | 1 MB |
| `cellChem` | vec4 `c, si, o, energy` | 1 MB |
| `cellDir` | vec4 `growth dir xyz, curl phase` | 1 MB |
| `cellMeta` | uvec4 `role:4 · gen:6 · flags:6 · lineage:16`, `parent`, `org` (organism root id, or 0xFFFF if rooted), `birthTick` | 1 MB |
| `cellKids` | ivec4 children (−1 = empty). **Single writer**: only the parent thread writes it, at division time. | 1 MB |
| `alloc` | atomic u32 bump pointer, plus a free ring (stage C only) | — |
| `bins` | `cellCount[32768]` atomic + `cellItems[32768·16]` (REPORT §6.5 bucket scheme), 3D hash with cell size = 2·r_max | 2.2 MB |
| `field` | 256² × vec4 `C, Si, O, Spark` ping-pong, on the dish floor (xz) | 2 MB |
| `canopy` | 256² atomic u32: max tip height per column (fixed point) | 256 KB |
| `stoneH` | 512² atomic i32: stone deposited per column (fixed point) | 1 MB |
| `orgGrid` | 128² atomic i32: organism energy splat, plus lineage velocity (for shoaling) | 192 KB |
| `stats` | 64 atomic u32: role counts, deaths, eats, abscissions, breaks | — |

Roles (4 bits): `TIP, STALK, CAP, GLOW, BUD, MOUTH, HORN, PLATE, SPORE, STONE, SAND, GAS, DEAD`.

### 3.1 Stage 1: seed and division (t 0–0:20, cells 1 → ~300)

**Local rule (per TIP, per tick):**
1. **Uptake.** `e += k_up · field.Spark(p) · lightAt(p)` plus, for each element X, `chemDraw_X = k_x · field.X(p)`. The cell's `chem` moves toward the drawn blend with **heredity** h = 0.75: `chem_new = h·chem_parent + (1−h)·normalize(draw)`.
2. **Divide** when `e > E_div · (1 + 0.15·gen_penalty)` and the local hash bin holds fewer than 12 cells (crowding). The parent thread does the whole thing:
   - claims `j = atomicAdd(alloc, 1)` (if `j ≥ N`, it doesn't divide: this is the hard carrying capacity)
   - writes cell j's whole row (position, parent = i, chem, dir, `role=TIP`)
   - writes j into its own `cellKids` slot
   - becomes STALK if it has no tip slot left
3. **Direction of the new segment** (R1):
   - `d_cont = rotate(dir, axis = dir × up, angle = κ·c) · rotate(about dir, φ += ω_c·c)`. Carbon curls by κ ≈ 0.35 rad per segment and twists by a helical phase, so you get spirals and croziers.
   - `d_snap` = the nearest of the 12 icosahedral directions, plus the tetrahedral 109.5° child offsets for branches
   - `d = normalize(slerp(d_cont, d_snap, si²)) + τ_light·∇canopyGap + τ_food·∇field + 0.05·hashNoise`
   - si² keeps mixed recipes wavy, and only Si-dominant lineages go fully faceted.
4. **Branch.** The number of children per division is `1 + bernoulli(p_b)`, with `p_b = 0.08 + 0.30·si + 0.10·c` and at most 3 kids (Si valence 4: one bond to the parent and three out). Carbon, with π-bonds, spends valence on curling, not forking. **[game]** mapping of real valence and π ability (REPORT §6.1: Si π 0.35, C π 1.0).
5. **Segment length and thickness** (R6): `L = L0·(1.7 − 1.3·heat)`, `r = r0·(0.55 + 0.9·heat)`. Cold gives long and thin. Hot gives short and squat.
6. **Maintenance.** `e −= m0·(0.4 + heat)·dt`. If `e < 0` the cell dies (→ §3.4).

**Algorithm.** This is a field-guided **space-colonisation** variant (Runions, Lane & Prusinkiewicz 2007, *Modeling Trees with a Space Colonization Algorithm*, Eurographics NPH). The discrete attractor points are replaced by a continuous Spark field and canopy gap, and tips are agents rather than nodes in a CPU tree. **L-systems** (Prusinkiewicz & Lindenmayer 1990, *The Algorithmic Beauty of Plants*) give the turtle-geometry vocabulary (curl κ, twist, branch angle), but there's **no grammar**: no string rewriting and no authored productions.

**Hand-off:** at about 300 cells, tips start reaching Spark-poor or bright regions, which unlocks differentiation (3.2).

### 3.2 Stage 2: differentiation into producers (0:20–1:05, ~300 → 8k cells)

A TIP that cannot divide for 2 s (low energy, crowded, or at `gen_max`) **differentiates by its local state**. Nothing is chosen from a list.

| Local condition at the tip | Becomes | Look | Rule |
|---|---|---|---|
| `lightAt(p) > θ_cap(Light)` and `c + si > 0.5` | **CAP**: spawns a ring of `k = 2 + round(6·Light)` children at 90° to `dir`. Carbon caps add one more ring of 2k, curled down (gills). Silicon caps are flat hex discs. | parasol, shelf, umbrella | R7 |
| `lightAt(p) < θ_glow` | **GLOW**: stores Spark (energy cap ×4), emissive = e/E_glow. HDR > 1 only when it's full. | lantern cups (O-rich: the tip widens into a cup ring of 5), glow stalks (Si) | R8 |
| crowded and shaded but fed | **STALK** only (thickens: `r *= 1.02` per second up to 2.5×) | trunks, kelp | R7 weakened |
| `o > 0.35` and dim | GLOW cup with the magenta family colour | pink lanterns (eco-04, 15) | R8, R9 |

- **Stacked tiers.** A CAP whose centre cell is a tip and later gets energy again regrows through the cap, so you get stacked domes and sea-stack tiers (flora-01 #3, eco-03). Because cap rings repeat at a fixed spacing, silicon tiers come out evenly spaced and carbon tiers wobble.
- **Light competition.** Each tip does `atomicMax(canopy[col], y_fixed)` each tick. `lightAt(p) = Light · exp(−k_shade · max(0, canopy[col] − y)/L0)`, read from the previous frame. Tall lineages shade short ones, and shaded tips go GLOW or STALK. That gives a canopy race, then glow under the canopy.
- **Nutrient competition.** Uptake subtracts from `field`. The field diffuses (5-point Jacobi, D = 0.2 cells²/tick) and relaxes toward the Recipe at rate ρ = 0.02/tick. Dense stands starve their middles, so they grow ring-shaped, like fairy rings.
- **Spores.** A CAP or GLOW cell with `e > 3·E_div` emits a SPORE: a single cell with a new lineage id (16-bit counter via atomicAdd), chem mutated by ±0.06 per element, and the parent's genome bits. Spores drift through the thick air (R11: no gravity, weak downward bias 0.1) and root when they touch the floor or stone. Mutation shifts the colour-jitter seed (ART_DIRECTION §5).

**Hand-off:** energy pools in caps and glow, which feeds abscission (3.3) and rust (3.4).

### 3.3 Stage 3: abscission, giving birth to fauna (1:05 on, ≤ 512 organisms)

**Rule.** Any STALK or CAP cell i, once per second, sums `E_sub` = the energy of its subtree, using a bottom-up pass with a depth limit of 24 (each cell adds its energy to its parent via atomicAdd into `subE`, fixed point, over 24 hops spread across frames). If `E_sub > E_abs` and the **bond to its parent** fails its break roll `hash(i, parent, tick) < exp(−E_bond/kT_eff)·dt·A_abs`, then:
- `parent(i) = −1`
- the whole subtree's `org` is set to i (a flood-down pass, 24 hops)
- the subtree's TIPs adjacent to the old break become **MOUTH** with probability `p_mouth = 0.25 + 0.6·Hunger`. Otherwise they become a **BUD** sealing cell.

`E_bond = 346·c + 222·si` (kJ/mol, scaled so E/kT ≈ 4 at Goldilocks, REPORT §6.3), so **warm** and **silicon** worlds shed bodies more easily, and cold carbon trees hold on for ages and make giants (R6). Detached caps become **bells**, with their stalk cells hanging as tendrils: jellies (fauna-03). This is real biology: a jellyfish medusa buds off a rooted polyp (strobilation).

**Locomotion: growth becomes thrust.** An unanchored TIP or MOUTH still "wants" to divide. In place of a new cell, it spends `ΔE = 0.2·E_div` per second and applies an impulse `F = k_t·ΔE·d` along its growth direction d. The springs carry this through the body. Nobody writes a swim cycle:
- **Carbon:** d keeps curling, and the curl phase moves down the chain as `φ_i = φ_0 + λ·depth_i + ω·t`, so the body undulates in an **S-wave** (anguilliform).
- **Silicon:** d is snapped, so thrust jumps between lattice directions every `T_tick = 0.6 s`. You get **ticking zig-zag darts** (ART_DIRECTION: "stiff and ticking").
- **Asymmetric bodies spin.** A body whose tips sit on one side (DESIGN "spinner") rotates, so crystal wheels and spirals fall out of the growth record.
- **Steering is local.** Each MOUTH biases d by `∇food(p)`, where `food = (1−Hunger)·producerEnergy(field.Spark + glow splat) + Hunger·orgGrid`. Mouths lead, and the body follows on its springs.
- **Shoaling (eco-11).** Each organism cell adds `w_s·(lineageVel(orgGrid) − v)` with `w_s = g(Hunger, 0.5, 0.2)`. Medium Hunger makes same-lineage bodies align (R10). Separation comes free from cell repulsion.
- **Detached bodies keep growing slowly** (E_div ×3), so they gain horns and plates as they age.

**Eating.** A MOUTH touching (hash neighbour, d < r_i + r_j) a living cell j with `lineage_j ≠ lineage_i` takes `bite = b0·(1 + Hunger)·(1 − hard_j)` energy per tick, with 70% efficiency. `hard_j` = 0.9 for PLATE, 1.0 for STONE, and 0 otherwise. Eaten cells with e < 0 die (→ 3.4). A body with a mouth that eats moving bodies is a hunter. One that only reaches rooted cells is a grazer. **That difference is not a flag.** It falls out of speed, which comes from heat, carbon content and size, and from Hunger steering.

**Armour.** Surface cells of a detached Si body (fewer than 3 neighbours) rust preferentially (3.4). Rusted cells that are still bonded become **PLATE**. They're hard but heavy (mass ×3, no thrust). In water, armoured silicon survives and naked silicon dissolves, so **water worlds select for plated silicon** (R5, fauna-02).

**Reproduction.** An organism with `E_org > E_spore` (CPU-free: its MOUTH cells check the org root's `subE`) releases a SPORE that roots and grows a tree of its lineage. It's alternation of generations: **every creature is also a tree's parent.**

**Death and builders.** When a body's energy runs out, its cells die (3.4). A silicon body that rusts as it goes leaves a trail of stone. That's a **builder** (R12) with no builder flag.

### 3.4 Stage 4: death, rust and the mineral cycle (always on; dominant after 0:45)

| Event | Roll per tick | Result |
|---|---|---|
| **Rust (Si)** | `o_local · si · 2.04 · k_rust · rate(heat)`, where `o_local` = field.O and 2.04 = Si oxygen hunger (REPORT §6.1) | Cell → STONE: bone colour, mass ∞ (pinned), bonds kept as rigid. Writes `atomicAdd(stoneH[col], r)`. |
| **Rust (C)** | `o_local · c · 1.03 · k_rust · rate(heat)` | Cell → GAS: removed from sim, +C to the field 3 s later (it's a gas ring in render). **The carbon cycle closes.** |
| **Hydrolysis (living Si)** | `attack_Si(sea) · 0.03 · si · (1 − hard)` | Cell → SAND (a free walker, +Si to the field when it settles in the sea floor) |
| **Starvation** | `e < 0` | Si-dominant → STONE. C-dominant → GAS. Mixed: a per-cell hash against `si/(si+c)`, so mixed lineages leave **speckled** remains. |
| **Stone erosion** | `erode(sea) · heat · k_er` on exposed STONE (fewer than 4 stone neighbours) | Stone → SAND, +Si to the field. Acid erodes most, so **acid recycles silicon** (R5). Methane ≈ 0. |

**Sand and DLA reefs.** SAND cells random-walk (Brownian, σ ∝ sqrt(heat)) with gravity bias g_s. On touching STONE they stick with probability `p_stick = s0·(0.3 + rust·0.7)·(1 − 0.7·heat)` (Witten & Sander 1981, *Diffusion-limited aggregation*, PRL 47:1400). High stickiness gives branching coral-like aggregates with voids. Low stickiness lets sand roll further, so it packs into dunes and rounded mounds. A vertical sedimentation bias (sand arrives from above) makes aggregates **grow upward into spires**, the accretive-growth picture of corals and sponges (Kaandorp 1994, *Fractal Modelling: Growth and Form in Biology*). These references are from memory: re-verify the citation details before putting them on a slide.

**Pores and inhabited glow.** Any living cell whose hash neighbourhood is more than 55% STONE counts as **housed**. It takes the bite immunity of `hard = 0.6` and an emissive boost to Spark amber ×2.5. Glow in stone means someone is inside (R12, ART_DIRECTION rule 3). Hunters can't reach housed cells easily, so **reefs become refuges and homes**, which is the "hard to predict two steps" turn.

**Anastomosis → arches.** When two TIPs of the same lineage come within `1.2·(r_i + r_j)` and both have a free kid slot, they **fuse**: each writes the other into its own `cellKids` row (both are single-writer, and the bond is valid only if both hold it, REPORT §6.5 `holdsBack`). Two branches that lean together now form a loop. Once they rust it's a stone **arch**, and cold keeps it standing because erosion is low (R12, R6, eco-04). Physarum and coral networks fuse the same way.

---
### 3.5 Controls × stages (first effect in bold; it must show within 3 s)

| Control | Implemented as | Stage 1 seed/division | Stage 2 producers | Stage 3 fauna | Stage 4 stone |
|---|---|---|---|---|---|
| **Recipe** (C·Si·O) | Target composition of `field` (relaxation ρ, about 1 s to show at the tips). Old cells keep their inherited chem (h = 0.75). | **Next segments snap and go cyan (Si) or curl and go coral (C)**. Branching changes. | Cap shape: flat hex vs gilled dome | Swim style: S-wave vs ticking dart. Mixed lineages give confetti (R9). | O drives rust rate: **bone cells appear in old wood** |
| **Sea** (4 swatches) | Param block: attack_Si/C, erode, mobility, stain, palette (1.5 s lerp) | **Sky/field colour wipe**. In water, **Si tips flicker and drop off** | Water: Si producers only as Si–C mixes (Si–C is the stable exception) | Water picks plated Si bodies | Stain colour; acid recycles stone; methane freezes it |
| **Heat** | `rate(heat)` (Arrhenius-like, log-compressed for methane), `kT_eff`, L and r | **Segments get long and thin (cold) or short and fat (hot)**, and division speed changes | Lifespan; cold gives giants | Cold carbon holds its branches (giant, few bodies). Hot sheds small, fast bodies. | Hot erodes and rounds stone. Cold keeps arches. |
| **Light** | Spark rain rate into `field.Spark`, θ_cap and θ_glow | Growth speed | **Top tips open into caps (bright) or light up as glow (dark)** | Glow cells add to `food`, so **glow attracts hunters** | Pore glow reads only when dark |
| **Hunger** | `p_mouth`, horn fraction, bite, steering weight on `orgGrid`, shoaling g(H, .5) | — (honest: none) | Grazing pressure trims caps | **Next buds sprout horns and big mouths, and bodies veer toward each other** | More kills → more remains → more reef |
| **Time** | dt ×1 / ×4 / ×16. Above ×2, slow processes get **rate-scaled** instead of sub-stepped. | Faster | Faster succession | — | **Stain bands, spires and arches** |

Hunger can't act on a seedling because there's nothing to hunt yet. Its slider sits greyed out with a "nothing to hunt yet" hint until the first abscission. That's honest, and it teaches the life ladder.

---

## 4. Terrain and environment

### 4.1 Ground
The dish floor is a flat disc of radius 1 in the sea's ground colour, plus very low fBm (seeded, declared). **All relief beyond that is grown:** `terrainH(x,z) = base(x,z) + stoneH(x,z)·s_h + sandDrift(x,z)`. `stoneH` is atomic-added by every STONE and settled SAND cell, and a 5×5 blur pass every 0.5 s turns cell piles into a smooth heightfield mesh (256² verts, `positionNode` displacement). Individual stone cells are still drawn on top while the camera is close, then fade into the heightfield as it pulls back. That gives a **continuous LOD from cells to land**.

### 4.2 Stone forms (all from §3.4)
| Form | Mechanism | Controls |
|---|---|---|
| Crusts, mats | Rust in place on dead wood, flat | high O, any Si |
| Branching reef | DLA with high stickiness | O·Si high, heat low–mid |
| Spires | DLA with sedimentation bias on a tall dead trunk, which acts as a lightning-rod nucleus | Si+O, Time |
| Pores | The voids DLA leaves; erosion widens them (acid) or closes them (heat smooths) | sea, heat |
| Arches | Anastomosis, then rust (§3.4) | cold, Si, Time |
| Dunes, sand plains | Low stickiness, so sand settles as drifts | hot, water |
| Living arch (eco-13) | A giant, cold, slow detached body that **re-roots at both ends**. A drifting body whose MOUTH and tail both touch stone for 3 s re-anchors, and spores land on it. | Si, ammonia, cool, Time |

### 4.3 Stains as growth rings (R3)
Every STONE cell stores `birthTick` and the **sea id at birth**. Its colour is `mix(bone #ECE4D6, stain(seaAtBirth), sat((now − birth)·k_stain·(0.3 + heat)))`. Two things follow:
- Older, lower layers are more stained and tips stay pale, so the bone→stain gradient the world-generator fakes comes for free.
- **Every Sea change the player made is a band** in the stone, and every Recipe change is a band in the wood (inherited chem). The world *records its own history*. Fast-forward reveals the rings (eco-13 rust rings, eco-01 and eco-10 red).

### 4.4 Sky, water, air
- **Sky and fog: render-only** (ART_DIRECTION sea palettes, calibrated palette field from `docs/features/world-generator.md`), driven by Sea, Heat and Light.
- **Green fields** (eco-12): fog is tinted by the *measured* glow fraction (stats readback), `fogColor = mix(seaFog, glowHue, 0.4·glowFrac·(1−Light))`. Field green comes from life, which is true to the atlas's own explanation.
- **Water and rivers:** the sea is a translucent plane at a fixed level over the heightfield. Low ground floods. That's honest render, not hydrology.
- **Air** is a thick sea (R11): organisms have no gravity. Sand and dead stone fall. Motes = `field.Spark` sampled as drifting billboards (render, but density is read from the field).

### 4.5 The macro skin (the pull-back)
Cells live in a dish of radius 1 (≈ 25 mm at "real" scale). The atlas wants landforms of 80–220 m. Growth-first answers that with a **powers-of-ten pull-back**, not with more particles.
1. At about 2:30, the CPU reads back `stoneH` (512², 1 MB), the lineage table, and one **specimen** per living lineage (BFS subtree from its oldest root, ≤ 384 cells: positions, roles, chem).
2. The heightfield is re-rendered at ×8000 scale as the world-generator terrain. Specimens become **instanced macro-flora**: one merged mesh per lineage (spheres or icosahedra + capsules → `BufferGeometry` built once on the CPU, ~40 ms), scattered by Poisson-disc with density = that lineage's measured area share, at random scale 0.7–1.3.
3. Organism specimens become drifting macro-fauna (8–20 instances each) with procedural sway and swim. The S-wave or tick period comes from the recorded motion style.
4. The tiny explorer stands on the most-stained, tallest spire foot.

This is **render-upscaled, declared**. Every shape on screen is a real grown graph and every placement is a real measured density. The macro world doesn't keep simulating, though. If the player drags a dial in macro view, the camera dives back into the dish (2 s) and the sim continues.

---

## 5. Flora (producer forms)

All flora are **rooted lineages**. Form = growth kernel × local state. There is no species table. A lineage's *look* is the integral of its chem and its light history.

| Atlas form | Recipe | Arises from |
|---|---|---|
| Geometric tree / crystal tree (eco-02, flora-01 stacked) | Si ≥ 0.5 | Snapped tetrahedral branching, p_b high, straight segments |
| Swirl tree (flora-01) | C ≥ 0.6, bright | Curl κ plus a helical twist on every segment, CAP crown |
| Parasol / mushroom canopy (eco-05, 08) | C, bright, cold | Long thin stalk (cold L) with few branches (low p_b), a big CAP with gill ring |
| Spotted cap (eco-08) | C with a trace of Si (0.1–0.2) | Si cells in the cap rust first, giving **white flecks** |
| Stacked domes / sea-stack tiers (eco-03, 06) | C, bright, light competition | Repeated cap-through regrowth |
| Glow stalks (eco-12) | Si–C mix, very dim | Tips → GLOW. Heavy shade makes a dense cluster of thin stalks. |
| Lantern cups (eco-04, 15) | O ≥ 0.35, dim | GLOW cup ring, magenta |
| Frost fans (eco-04 walls) | Si, cold, on stone | Spores rooted on vertical stone grow along the canopy gap → planar fans |
| Kelp trunks (eco-11) | C, water, medium light | Crowded and shaded but fed → STALK thickening; tall, few caps |
| Honeycomb caps (eco-09) | Si+O, dim | CAP discs that rust while alive → porous stone caps with glow inside |
| Charred monoliths (eco-01) | C, hot, bright, old | Hot squat STALKs. Carbon cells above `char = heat·light·age` render near-black (shading-only). Partial, see §8. |

**Glow** is always seated: GLOW cells under the canopy (shade) or housed in stone. HDR > 1 only when e > 0.8·cap, so glow reads as "full of Spark".

**Motion on flora:** stalk springs + a slow global "current" field (curl noise, render+sim) give carbon sway. Silicon has spring stiffness ×6, so it stays stiff with a micro-tremble.

---

## 6. Fauna (creature bodies, eyes, motion, behaviour)

A creature is **a detached subtree**. Its body plan is the growth record of the branch it came from.

| DESIGN type | How it arises | Si version | C version |
|---|---|---|---|
| **Drifter** | A detached CAP (bell) with no MOUTH and few TIPs: weak thrust, it drifts | Faceted hex bell, rod tendrils (fauna-03 jellybot) | Soft coral blob |
| **Swimmer** | Detached chain-like branch, thrust from its tips | Zig-zag dart that ticks | S-wave eel (fauna-08 confetti if mixed) |
| **Spinner** | Lopsided tip distribution → net torque | Crystal wheel | Spiral coil |
| **Grazer** | Has a MOUTH. Slow (heavy plates or cold), so it only reaches rooted cells and its energy comes from producers. | Plated hopper (fauna-06), rhino-lizard (fauna-02) | Fast, fragile nibbler |
| **Hunter** | MOUTH + speed ≥ prey speed, Hunger steering toward `orgGrid` | Horned rod-feathered ambusher (eco-09 beast) | Banded frilled serpent (fauna-05: alternating C/Si cells from a mixed lineage) |
| **Builder** | Si body that rusts as it lives and leaves a stone trail | Reef weaver | — (carbon leaves gas rings) |
| **Giant / sky whale** | Cold carbon tree whose huge branch finally sheds | Watercolour strider (fauna-01: long thin Si segments) | Sky whale (fauna-09) |

**Horns and frills.** At Hunger > 0.5, the BUD tips next to a MOUTH differentiate into **HORN**. Horns are Si-snapped rods that point along the mouth direction and add +40% bite. In carbon they become curled **frill** fans. Plates (§3.3) are the prey answer. With high Hunger, prey lineages with more rusted surface survive, so **plates are selected for, not assigned**.

**Eyes (render-only, ART_DIRECTION §5).** At promotion (abscission), the CPU tags the MOUTH cell as head. Carbon heads get 2 ink eyes with a white ring, facing velocity. Silicon heads get a cluster of 3–6 amber dot-eyes. A MOUTH with ≥ 2 HORNs gets **one big glossy eye**. Blink every 3–6 s. ≤ 512 organisms, 1 instanced draw.

**Behaviour summary (all local):**
- seek `∇food`: grazers follow producer energy, and at high Hunger, everyone partly follows organism energy
- flee: cells read `−∇orgGrid_hunters`, where hunters splat a separate channel weighted by their horn count
- shoal: kin alignment, g(Hunger, .5)
- hide: housed cells (in pores) get bite immunity, so bodies that happen to stop in pores survive, and that behaviour is inherited only through *where spores land*. This is honest: there's no learning.

**Field-guide naming (CPU, every 0.5 s).** Signature = quantised (dominant family, mean |turn angle| bucket, role histogram {MOUTH, HORN, PLATE, CAP, GLOW} buckets, speed bucket). A new signature that holds ≥ 3 organisms for ≥ 8 s gets a name from word tables: prefix by family and form (*Glass/Coral/Rose*), suffix by type (*Darter/Bell/Weaver/Wheel*), and a Latin binomial from roots. This triggers the discovery shot.

---

## 7. Ecosystem dynamics

**Energy flow (conserved except light in and maintenance out).**
`Light → field.Spark → TIP/CAP/GLOW uptake → division (costs E_div) → stored e → bite (70% efficiency) → MOUTH bodies → death → STONE (energy lost) or GAS (C returns to the field)`.

| Trophic level | Who | Emerges because |
|---|---|---|
| 0 Producers | rooted lineages | They're the default state of every cell |
| 1 Grazers | slow detached bodies with mouths | Abscission plus a mouth, and they're too slow to catch bodies |
| 2 Hunters | fast bodies with mouths and horns | Hunger steering plus speed (warm, carbon, small) |
| Decomposers | **none as agents** (honest) | Gas → C field, erosion → Si field. The mineral cycle stands in for them. |

**Succession (default Acid / balanced run):**
1. Pioneer: one seed tree, fast doubling.
2. Canopy race: 3–8 lineages from spores. Shade turns understorey to glow.
3. Fauna: first abscissions. Grazers trim caps, so the canopy opens, light returns and new tips appear. This **negative feedback gives Lotka–Volterra-style oscillation**, with no equations written in.
4. Reef: dead matter accumulates. Pores give refuge, so prey persist and hunters are capped.
5. Old world: stone dominates. If `stoneFrac > 0.5`, the world whitens (ART_DIRECTION rule 1: health you can see).

**Collapse modes (each readable, each a lesson):**
| Mode | Cause | Looks like |
|---|---|---|
| **Dust** | Water + Si-heavy | Tips flicker away. Sand, no trees. (REPORT §6.3 "dust") |
| **Gel / frozen museum** | Methane + very cold | A huge still tree that never sheds. Alarm when the largest lineage holds more than 60% of cells. |
| **Tomb** | O-heavy | Everything rusts to stone: white reef, little life (R2). Lesson: pull the dot off the O corner. |
| **Overgrazing crash** | Hunger max + bright | A bloom of hunters, then producers gone, then mass death, then a reef boom |
| **Burnout** | Hot + bright + old | Short-lived squat life, red-stained plains (eco-01, 10) |

**Carrying capacity.** The bump allocator caps total cells at N. In the demo-path version (no recycling) a world fills up at about 2:20. After that only GAS removal (which frees slots in stage C) and death let new growth happen, and the TIME ⏩ beat leans on slow processes (stain, DLA, erosion) rather than new cells. In the full version, the free ring recycles GAS and eaten cells.

**Live monitors (CPU readback, every 0.5 s):** role counts, living lineages, organisms per trophic level, dead fraction, largest lineage share, eats/s, abscissions. They feed the population chart (render), the hints ("the sea looks hungry…"), and the midwife cheat.

---
## 8. Atlas coverage

Settings from WORLD_ATLAS §5.3. "Reached" means the defining features grow from §3 at those settings. The sky event (eclipse, two suns, moons) is a render preset everywhere, so it's not counted against any world.

| Pin | Status | Mechanism | Missing / caveat |
|---|---|---|---|
| eco-01 Vermilion Eclipse | **reached** | Si+O rust and water hydrolysis → sand plains. Water stain on old stone → vermilion. Hot → squat survivors. Fierce → horned hunters on a dead plain. | "Black monolith" char is shading-only |
| eco-02 Violet Sun Hollow | **reached** | Acid keeps Si alive. Si+O → violet patchwork. Snapped crystal tree. Bright → grazers, then medium Hunger → 1 hunter lineage. Porous crust from DLA. | The "lizard" swims along the rock; nothing walks (ART_DIRECTION) |
| eco-03 Sindha pillars | **reached** | C, water, bright → stacked cap-through tiers = coral pillars. Gentle → drifters between them. | Top-down camera is a preset |
| eco-04 Frost Arches | **reached** | Methane spares Si. Cold → long fused branches → anastomosis → rust → arches, erosion ≈ 0. Dim + O → pink cup glow carpet. | — |
| eco-05 Parasol Giants | **reached** | C, cold → long thin stalks, few branches, slow. Bright → big gilled caps. Methane + light → tholin-orange stain. | Scale "giant" comes from the macro skin |
| eco-06 Capped Sea Stacks | **reached** | C+Si: Si fraction dies and rusts into DLA stacks. Carbon spores root on stone tops, where the canopy grid gives the most light → coral shelf caps. | Waterfalls are not reached (render dressing or omit) |
| eco-07 Two Suns Spire | **reached** | Balanced centre + Goldilocks → most lineages and every body type. An old dead trunk becomes a DLA spire. Thick air full of spores. | The *pink* spire stain is approximated by housed-glow tint, not a bio-stain rule |
| eco-08 Coral Forest | **reached** | C in methane, cold, medium light → slow huge parasols. A trace of Si → **white cap spots** from rust. | — |
| eco-09 Violet Hunter | **reached** | Si+O in ammonia, dim → straight vertical snapped trunks, honeycomb caps (live rust), fierce → a rod-feathered cyan hunter | Hunter count is low (1–3), which is correct for the pin |
| eco-10 Red Canyon | **partial** | Very old, hot water Si+O → red sand and stained reef walls. The last surviving colony is a parasol tower. | The **canyon** is the negative space between deposits. Nothing carves it: no hydraulic erosion. |
| eco-11 Kelp Shoal | **reached** | C, water, medium light → crowded STALK trunks. Medium Hunger → kin alignment → **shoals** | — |
| eco-12 Glow Garden | **reached** | Si–C mix survives water. Very dim → GLOW stalk clusters. Fog tinted by measured glow fraction → **green field** | — |
| eco-13 Living Arch | **partial** | A cold Si giant body re-roots at both ends, epiphyte spores land on it, and growth rings give rust bands | Re-rooting into a clean arch is luck-dependent (about 1 in 3 seeds in testing is the target). The "creature that is a landscape" may need a curated seed. |
| eco-14 Bone Reef | **reached** (hero) | Si+O in acid: DLA spires with pores, acid recycles Si, dim → housed glow in pores | — |
| eco-15 Lantern River | **partial** | Methane cold dim O-rich → pink lantern cups along low ground; old dark-stained arches | The **river** is the sea plane flooding low heightfield, not flowing |

**Ecosystems: 12 reached, 3 partial, 0 not reached.**

| Fauna | Status | Mechanism |
|---|---|---|
| fauna-01 Watercolour giants | **partial** | Cold Si → long-segment detached striders with dot-eyes. They float; they don't stride. |
| fauna-02 Rhino-lizards | **reached** | Si in water: plated survivors, 3 colourways from spore mutation |
| fauna-03 Jellybots | **reached** | Detached CAP bell + stalk tendrils (strobilation) |
| fauna-05 Frilled serpent | **reached** | Mixed C/Si lineage hunter, alternating cells → banding, carbon frills |
| fauna-06 Plated hopper | **reached** | Plated grazer, big-eye rule |
| fauna-07 Hammerhead strider | **partial** | Cold → tall and thin, acid stain on plates. The hammer silhouette isn't targeted. |
| fauna-08 Confetti eels | **reached** | Mixed recipe + per-cell chem → patchwork S-wave swimmers |
| fauna-09 Sky whales | **partial** | Cold carbon giants shed big bodies. "Whale-size" exists only in the macro skin. |

---

## 9. Build plan

### 9.1 Modules
| Module | Where | What |
|---|---|---|
| `sim/cells.ts` | GPU (TSL compute) | Buffers §3.0, the kernel passes below |
| `sim/fields.ts` | GPU | field diffuse/relax/Spark rain, canopy clear, stoneH, orgGrid |
| `sim/params.ts` | CPU (pure, Tier 0 tests) | Controls → uniforms: `derive(recipe, sea, heat, light, hunger)` → {κ, p_b, L, r, rate, kT_eff, attack, erode, stick, θ_cap, θ_glow, p_mouth, …} |
| `sim/monitor.ts` | CPU | 0.5 s `getArrayBufferAsync` of `stats` (256 B) and a lineage table (≤ 4096 × 16 B); detectors, naming, midwife |
| `render/cells.ts` | GPU render | 3 instanced draws reading storage buffers directly: C spheres, Si icosahedra (flat, fresnel `isGlass`), bonds (child→parent capsules). Stone, sand and glow are role-tinted in the same draws. |
| `render/organisms.ts` | render | eyes + blink (≤ 512), gas rings, motes |
| `render/terrain.ts` | render | heightfield from blurred `stoneH`, stain material |
| `render/macro.ts` | CPU + render | specimen readback → merged meshes → instanced macro scene, reusing the world-generator's sky, fog and terrain material |
| `ui/` | DOM | Recipe triangle, Sea swatches, sliders, ▶/⏩, population chart, field-guide plates |

### 9.2 Compute passes per tick (one `renderer.compute` list)
1. `clearGrids` (bins, canopy, orgGrid, stats): 1 dispatch
2. `bin`: atomicAdd buckets, CAP 16 (REPORT §6.5)
3. `fieldStep`: 256² Jacobi diffuse + relax to Recipe + Spark rain + uptake deposits from the previous tick (uptake is written as negative deltas into an i32 delta grid by pass 4, so the field has no read-write race)
4. `metabolism`: uptake, maintenance, rust/hydrolysis/erosion/death rolls, role changes, `atomicMax(canopy)`, `atomicAdd(stoneH)`, organism splat to `orgGrid`
5. `growth`: divide/differentiate/spore (bump allocator), fusion proposals (mutual-best, §6.5) and **thrust** for unanchored tips
6. `forces`: springs to the parent and to the children (gather; no atomics), hash-neighbour repulsion, MOUTH bites (the bite is written by the *eater* into the victim's `damage` i32 via atomicAdd; the victim applies it next tick), sand sticking
7. `integrate`: Verlet, pinned STONE, damping per sea mobility
8. `subtree` (every 4th tick): one hop of the bottom-up `subE` sum and one hop of the top-down `org` flood

That's about 8 dispatches at 64k threads. For a rough guide, the REPORT bucket scheme with 16 neighbours per cell is ~1M neighbour checks per tick, and Apple-Silicon WebGPU should handle that in ~2–4 ms. **This is an estimate to smoke-test at H2, not a measurement.** Sim at 30 Hz, render at 60 with interpolation. Quality `low`: N = 32,768, field 128².

### 9.3 GPU / CPU / fake
- **GPU:** all cell physics, growth, chemistry rolls, fields, canopy, DLA, stone heightfield.
- **CPU:** `derive()` params, 0.5 s monitors, naming, discovery-shot triggers, the midwife, specimen BFS and macro-mesh build, camera.
- **Fake (render-only):** sky, suns, fog, motes, eyes, gas rings, char darkening, sea plane/rivers, macro skin motion, waterfalls if any.

### 9.4 Atomics note
TSL r187 atomics are integer only and have no compare-exchange (REPORT §6.5). Every float accumulation (`subE`, `stoneH`, `orgGrid`, `damage`, uptake deltas) is **fixed point i32** (×1024). Allocation uses only `atomicAdd`. Fusion uses the mutual-best handshake. Nothing needs CAS.

### 9.5 Sixteen-hour order (2–4 people), cheapest demo path first

| Hours | Person A (sim) | Person B (render) | Person C (UI/CPU) | Checkpoint |
|---|---|---|---|---|
| 0–2 | Buffers, bump allocator, seed cell, divide with straight growth | Instanced spheres/icos + bond capsules reading storage | `derive()` + tests, control panel shell | **The seed divides on screen** |
| 2–4 | Curl/snap direction, branching, L/r from heat, maintenance and death | Role tints, family palette, sea palette lerp | Recipe triangle → field relax | Recipe and Heat first effects visible |
| 4–6 | Field 256² + uptake, canopy grid → CAP/GLOW differentiation, spores | Glow HDR, bloom, cap discs | Monitor readback, stats overlay | **H6: producers compete** |
| 6–8 | Rust → STONE/GAS, hydrolysis, sea params | Stone bone + stain-by-age shader, gas rings | Silicon-puzzle hints | **H8 demo path: seed → forest → rust, water stalls Si, acid saves it** |
| 8–11 | **Abscission + thrust + MOUTH bites** (subtree passes) | Eyes, blink, organism tint | Naming + discovery-shot 2D card | **H11: something swims away and eats** |
| 11–13 | Hunger: horns/plates, steering, shoaling | Heightfield terrain from `stoneH` | Population chart, midwife cheat | |
| 13–15 | SAND walkers + DLA sticking, pores/housed glow | Macro skin v1: heightfield ×8000 + specimen instancing | Time ⏩ + rate scaling | **H14: full arc** |
| 15–16 | Anastomosis arches (stretch), tuning sweeps | Pull-back camera path | Presets for 5 atlas looks | Freeze |

**Cut order if behind:** anastomosis → re-rooting living arch → shoaling → macro-fauna (keep macro-flora) → DLA (fall back to sand dropping straight down, which gives mounds, not reefs). The **must-keep** set is seed → differentiation → rust → abscission → discovery shot.

**Tuning first (H2, before features):** a headless sweep page that runs 60 s of sim at 4 settings and logs the monitors. Pass bars: water+Si stalls below 400 cells; acid+Si+C reaches 20k cells by 1:30; at least 1 abscission by 1:20 in the default; dead fraction < 0.5 at 2:00 except O-heavy.

---

## 10. Honesty box

| Kind | Item |
|---|---|
| **Seed** | The single seed cell at t = 0, with chem = Recipe and 4·E_div of energy |
| **Seed** | The flat dish floor plus low fBm, and the fixed sea level |
| **Seed** | Spark rain is an ambient source (Light), not grown |
| **Tuning cheat** | Seed-cell division boost for gen < 6, so the first 3 s aren't dead air |
| **Tuning cheat** | **Midwife:** if no abscission by 1:20 in a viable world, `A_abs` is multiplied by 4 until one happens. It's logged on screen in `#debug`. |
| **Tuning cheat** | Hydrolysis ×0.03, log-compressed methane rate, per-backbone kT_eff (REPORT §6.3, `[INFERRED]`) |
| **Time compression** | Above ×2, slow processes (rust, stain, erosion, DLA) are rate-scaled, not sub-stepped. Stain bands at ⏩ are faster than real growth would allow. |
| **Scripted** | Discovery-shot cinematography (detector-triggered), pull-back camera path, hint timing |
| **Render-only** | Sky, suns, eclipse, fog, motes, eyes and blink, gas rings, char darkening, sea plane and "rivers", green-field fog tint (driven by a real measurement) |
| **Render-upscaled** | The macro skin: real heightfield and real grown specimens, but instanced at ×8000 and **not simulated** at that scale. Macro creatures loop a recorded motion style. |
| **[game] mappings** | Valence → branch count, π ability → curl, light → caps (R7), dark → glow (R8), Hunger as one global knob |
| **Unknown** | Whether 64k cells with abscission stay ≥ 50 fps with bites and DLA (smoke-test at H2). Whether oscillation actually shows within 60 s (it may be a single boom-bust). eco-13's arch odds. Whether spore lineages diverge visibly enough for 4+ names in 3 minutes. |
| **Unknown** | Citations (Runions 2007, Witten & Sander 1981, Kaandorp 1994, Prusinkiewicz & Lindenmayer 1990) are from memory. Live lookup failed (rate-limited). Verify before any slide. |
| **Not modelled** | Decomposers as agents, hydraulic erosion, walking, learning, sexual recombination |

---

## 11. Iteration log

### Round 1: "Three growth algorithms" — E3 C3 A2 S3 F2 I3
**Proposal.** One algorithm per kingdom. An **L-system grammar** per recipe for flora (Si: `F→F[+F][-F]` at 60°, C: curling productions). **DLA** for stone with stickiness = rust. **Cell division** for creatures, which bud off the world-organism on a timer. Stains as concentric rings on a radial age map.

**Critique.**
- *Emergence 3:* L-system productions are authored grammars, which makes them a species list with extra steps. Creatures budding on a timer is a scripted beat.
- *Chemistry 3:* the controls pick grammars instead of acting on a rule. Heat and Light have no lever except "pick a different string".
- *Atlas 2:* no fauna behaviour, no hunters, no shoals, no living arch. Ecosystems with competition (eco-02, 09, 11) are unreachable.
- *Spectacle 3:* the growth looks lovely but it's **static**: a diorama that grows, then stops. Where's the motion?
- *Feasibility 2:* three separate systems, and string rewriting on GPU is awkward (variable-length output, prefix sums). Three teams for three algorithms.
- *Intuitive 3:* "Recipe changes the grammar" is invisible until the next production fires.

**Revise (lowest first: Atlas and Feasibility).** Replaced all three with **one tip kernel**, field-guided space colonisation with no grammar, where curl and snap weights *are* C and Si. Roles come from local state. Added resource fields and a canopy grid, so lineages **compete**. Stone stays DLA, but it's fed by the same cells' deaths.

### Round 2: "One kernel, competing forests" — E4 C4 A3 S3 F3 I3
**Critique.**
- *Atlas 3:* fauna still missing. How does a creature *leave*? Budding is still hand-waved, so 6 of 15 pins (all the ones with hunters, shoals or fliers) are only partial.
- *Spectacle 3:* the dish is a microscope view. Nothing reaches the 80–220 m discovery scale the board is built on.
- *Intuitive 3:* Sea's first effect is only colour. Hunger has nothing to act on.
- *Feasibility 3:* spring forces computed by atomically scattering to parents need float atomics, which TSL doesn't have.
- *Chem 4:* old growth doesn't react to dial changes. Is that a bug or a feature?

**Revise.**
- **Abscission:** subtree energy plus the bond break roll from E_bond/kT. **Growth-as-thrust** gives locomotion with no swim code. **MOUTH bites** across lineages. **Spores**, so the life cycle alternates between tree and body.
- Sea first effect: visible hydrolysis of Si tips.
- Hunger acts on bud differentiation.
- Springs switched to **gather** (children are known to the parent through its single-writer `cellKids` row).
- Old growth keeping its chem became a feature: **growth rings**.

### Round 3: "The seed gives birth" — E4 C4 A4 S3 F3 I4
**Critique.**
- *Spectacle 3:* still microscopic. The 3-minute arc has one whoa (the first swimmer) and no landscape beat. Judges remember the giant-and-tiny-human shot, and we don't have one.
- *Feasibility 3:*
  - The free-list allocator with only atomicAdd is fiddly.
  - Subtree sums over 24 hops cost frames.
  - DLA walkers, anastomosis, the organism table and macro scenes add up to too much for 16 h.
- *Emergence 4:* the organism table (COM, rigid-body velocity) was being added for motion. That's a non-local crutch.
- *Atlas 4:* eco-10, 13 and 15 partial. Shoals need alignment.

**Revise.**
- **Powers-of-ten pull-back and macro skin:** read back the real heightfield and real grown specimens, instance them at ×8000, and dive to the explorer. Declared as render-upscaled.
- Dropped the organism rigid-body table: motion is purely per-cell thrust through springs.
- Kin alignment via `orgGrid` lineage velocity, weighted by g(Hunger, .5).
- Demo path uses the **bump allocator only**. The free ring moved to stretch.

### Round 4: "Seed to landscape" — E4 C4 A4 S4 F3 I4
**Critique.**
- *Feasibility 3:* the 16-hour plan had abscission at H12+, so the core whoa was at risk. The tuning sweep was absent, which is exactly the risk REPORT §6.3 warns about (gel or dust). There were race hazards in the field uptake (read and write of the same grid) and in bites (eater writing victim energy).
- *Intuitive 4:* Hunger before any creature exists is a dead slider. A first-time player drags it and nothing happens, which fails the 3-second rule.
- *Spectacle 4:* the discovery shot could fire on a boring lineage.

**Revise.**
- Moved abscission to H8–11 with the H11 checkpoint. Added an H2 headless **tuning sweep** with pass bars.
- Uptake now goes through an i32 delta grid (consumed next tick). Bites go through the victim's `damage` accumulator (consumed next tick).
- Hunger is **greyed with an in-world hint** until the first abscission. That's an honest teaching beat.
- The discovery shot needs ≥ 3 organisms for ≥ 8 s, which filters out flukes.
- Added the cut order and must-keep set.

### Round 5: final check — **E4 C4 A4 S4 F4 I4**
| Criterion | Score | Why not 5 |
|---|---|---|
| Emergence | 4 | The midwife cheat, seed boost and scripted camera are declared but real. The macro skin doesn't simulate. |
| Chemistry fidelity | 4 | Every control acts on every stage via R1–R12 (§3.5), except Hunger on seedlings (deliberately greyed). Recipe acts on new growth only, which is clear in principle but slow on old forests. |
| Atlas coverage | 4 | 12/15 reached, 3 partial (canyon carving, living-arch odds, river flow). Short of 13. |
| Spectacle | 4 | The seed bloom, first swimmer, ⏩ rings and pull-back are four strong beats. Polish risk: 64k beads may read as "particles" rather than "trees" until the bond capsules and cap discs are in. |
| Feasibility | 4 | One kernel family, no CAS, a cut list. The risk is concentrated in tuning (gel/dust) and the subtree passes. |
| Intuitiveness | 4 | First effects are local to the growing tips, so the player has to watch the tips. The tutorial camera starts on them. |

Every criterion is at least 4. Nothing is below 4. **Atlas stays at 4**: reaching 13 would need hydraulic erosion (eco-10 canyon, eco-15 river), and we judged that not worth 16-hour budget.
