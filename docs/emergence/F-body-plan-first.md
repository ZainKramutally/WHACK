# Emergence design F: Body Plans, Not Cells
> Starting philosophy: a short chemical prelude makes the first copier, then emergence moves up to the organism. Genomes grow body plans, chemistry sets the developmental rules, and selection in the ecosystem writes the bestiary.  ·  Final scores: E4 C5 A4 S4 F4 I4

> **Superseded detail (2026-11-07):** the genome is now the 12 body genes in `docs/emergence/DECISIONS.md` §G.1 (plus 3 climate genes). `eyeCountBias` no longer exists, and eye count derives from the `eyes` gene. F remains the reference for the `develop()` grammar and rendering.

## 1. The idea in one paragraph

Cell-level and atom-level emergence (A, C) can reach blobs, worms and rings in three minutes, but not a horned, plated rhino-lizard. So F spends only about 25 s at the atom level. One pixel boils into about 3k atoms. They bond, form chains, and **one chain is granted copying** (a declared seed). From there, **the copier's own atom sequence becomes the founder genome**: its length becomes the segment count, its element fractions become the body's composition, and its C/Si alternation becomes a band pattern. The copies open their eyes as tiny worms. After that, life is a population of **≤1,024 animal agents and ≤1,536 plant agents**. Each one carries a 32-gene genome that is interpreted by a **developmental program**: Hox-like segment domains, limb buds, plates, dorsal rods or frills, eyes, horns and skin. The key move is that **chemistry is not a gene the player sets on creatures. It is the rulebook development reads.** Silicon tissue *can only* grow 6-sided faceted segments, straight rod limbs with joints quantised to 15°, and dot-eye clusters. Carbon tissue grows round, curling, many-jointed bodies with paired ring eyes. Oxygen speeds metabolism and adds magenta glow. Si+O builds bone-white stone plates. Every control acts **twice**: once through *plasticity* on newborns and behaviour (fast and predictable, visible in about 1–3 s), and once through *selection* on genomes. Water dissolves unplated silicon, cold air is thick enough to float in, Hunger pays horns. That second effect is slow and surprising. Bodies are skinned as **lofted generalised cylinders** on one shared tube mesh and animated on the GPU: follow-the-leader spines, joint angles clamped and quantised by silicon content, analytic 2-bone IK legs, pulsing bells. Flora are **open L-systems** with the same chemistry-as-grammar idea. The field guide is a **MAP-Elites archive** of body-plan bins (Mouret & Clune 2015), so two players with different dials fill it with recognisably different bestiaries.

## 2. The bloom: pixel → world timeline

The default run is "Earth-ish" (C-leaning, Water, mild, bright, gentle), followed by the presenter's dial moves. Times are tuning targets, not measurements.

| t | What the player sees | What is actually simulated | Emergent / seeded / scripted |
|---|---|---|---|
| 0:00 | One amber point of light on a dark dish. Camera 2 m away, tilt-shift on. | Nothing yet: a single emissive sprite | **Seeded** (the pixel) |
| 0:02 | The point pulses and **boils**: atoms spray out in a ring, coral, cyan and magenta in the Recipe's ratio | 3,072 CPU atoms emitted over 4 s from the pixel. Type is drawn from Recipe. Spark motes (GPU, 16k) fade in with Light. | **Seeded emission** (declared). The mix comes from the dial. |
| 0:06 | Atoms jitter, collide and **snap into pairs** (bond flash). Si–O pairs turn bone white and sink. | Brownian motion + Particle-Life pull + mutual-best bonding, with break roll `exp(−E/kT_eff)` + hydrolysis(sea) | Emergent (R2 rust in the first 5 s) |
| 0:12 | Chains of 3–6 atoms wriggle. Carbon chains curl and silicon chains stay straight and zig-zag. Label: "first chain". | Graph walk at 4 Hz. Bond angle stiffness from R1. | Emergent. The label is a detector. |
| 0:17 | One chain **copies itself**: free atoms line up along it, then a twin peels away. Then 2, 4, 8. | **Copier spark**: the longest chain that has lived ≥ 2 s gains the template rule (Hutton-style). Copies mis-pair with p = 0.08. | **Seeded** (the copy rule, declared). Which chain gets it is emergent. |
| 0:24 | **Whoa #1: the molecule opens its eyes.** Each copy's atoms swell into body segments, and two ink eyes blink on. Some copies stay put and sprout a stalk. | Copy → organism: atom sequence → founder genome (§3.2). Copies born in Spark-rich spots root as producers, the rest become grazers. | **Designed founding rule**. The sequence → genome mapping is emergent from the prelude. |
| 0:25–0:50 | The camera pulls back about ×20 as worms graze, multiply and spread outward from the centre. Flora carpets the dish in rings. | Ecology at 20 Hz (CPU). Birth, mutation, death. Prelude atoms not in organisms fade into the soil. | Emergent. The camera distance follows the 90th-percentile body size (**scripted cinematography**). |
| 0:45 | **First legs.** A worm lineage's limb-domain gene opens, and little leg buds appear and start stepping. | A Hox domain mutation (`limbEnd > limbStart`) gives limb pairs. IK gait is picked from the morphology. | Emergent (mutation + selection: legs walk cheaper on ground) |
| 0:55 | (Demo) Recipe → Si. **Within about 2 s, newborns are cyan, hexagonal and stiff**, ticking like clockwork, and the new flora growth turns glassy. Old adults stay coral. | Newborn composition = lerp(parent, Recipe, 0.35). Development reads `si`. | Emergent plasticity (R1, R9) |
| 1:02 | In Water, silicon newborns **flicker and shed bone flakes**. Unplated ones die young. | Dissolution HP loss `∝ atk_si(sea)·si·(1−plateCover)` (R5) | Emergent |
| 1:10 | (Demo) Sea → Acid. The sky lerps to lemon over 1.5 s. Silicon lineages stop dying, dot-eye clusters spread, and 60° crystal flora branch out. | `atk_si` drops 0.9 → 0.3 (×0.03 game scale). Selection flips. | Emergent |
| 1:22 | (Demo) Hunger ↑. **At once**, some creatures turn and chase while others scatter. Over about 25 s, horned hunters and plated, shoaling prey appear. | Steering weights ∝ Hunger (immediate). Attack payoff ∝ Hunger → selection. Stress mutagenesis (§3.4). | Emergent. Behaviour is immediate and morphology is selected. |
| 1:45 | **Whoa #2: discovery shot.** "Silicon-based life discovered": the first Si-dominant lineage to survive 3 generations. Specimen plate: the creature enormous, a tiny human at its feet, leader-line labels read from its genome. | MAP-Elites bin detector + lineage depth ≥ 3 | **Scripted beat**, triggered by an emergent event |
| 2:05 | (Demo) Heat ↓ to cold, Time ⏩×4. Bodies **swell**. Long-legged cyan striders appear, builders raise bone spires with glowing pores, and plates rust with the sea's stain. | Temperature–size plasticity + slow-rate selection. Builder deposits → spires. Plate stain by individual age. | Emergent. Time compression is declared. |
| 2:30 | (Demo) "Frozen cathedral" preset (Methane, dim). **Thick air**: plated walkers lose their legs over generations, jellies and a whale-like giant lift off, and flora glows pink. | `ρ_air` up → hover cost below walk cost → aloft mode wins. Glow wins in the dark. | Emergent (R11, R8). Preset jump = 4 dial moves at once. |
| 2:50 | **Whoa #3: two bestiaries.** The field guide grid (body-plan bins) shows *this run* beside a saved run from another preset. The shapes are visibly different families. | MAP-Elites archive with thumbnails rendered by the same body renderer | Emergent content, scripted presentation |

## 3. Stages in detail

### 3.1 Stage 0: chemical prelude (CPU, 0:00–0:35, then switched off)

- **State:** 3,072 atoms `{x, z, vx, vz, type ∈ C|Si|O, bonds[3], age}` in a Float32Array SoA, plus Spark motes rendered on the GPU.
- **Rules (60 Hz, 2D, uniform spatial hash, cell = bond radius r_b):**
  - Brownian kick `σ = 0.6·rate(heat)`. Particle-Life pull matrix `P[a][b]` with the asymmetry scaled by **Hunger** (`P_ab − P_ba = 0.4·Hunger`). Atoms visibly chase each other at high Hunger: Hunger's first effect in the prelude.
  - **Bonding:** mutual-best partner within r_b (REPORT §6.5 handshake, done on the CPU), effective valence C 2, Si 2 (3 with p = 0.2), O 2 (H:X ≈ 2 anti-gel, REPORT §6.3 #6). Forming costs 1 Spark mote nearby: **Light** sets the bonding rate.
  - **Breaking:** roll `exp(−E/kT_eff)·dt + atk(sea, type)`, with `E/kT_eff = 4·(1.25 − 0.5·heat)` (sweet spot 3.5–4.5) and Si water attack ×0.03 (REPORT §6.3 #3).
  - **Rust (R2):** an Si–O bond is permanent and turns both atoms to bone `#ECE4D6`. They sink and pile into the **first stone**, a bone-sand ring at the dish centre that becomes the terrain seed (§4). C–O breaks and emits a gas ring.
  - **Stiffness (R1):** chain bond angles relax towards 180° with stiffness `k_θ = 0.2 + 1.6·si` per atom, plus a curl bias of `0.3·c` rad per carbon bond. Silicon chains read straight and zig-zag, and carbon chains curl.
- **Copier (seeded):** at t ≥ 15 s, the longest chain (≥ 4 atoms) that has existed for ≥ 2 s gains the **template rule** (Hutton 2002): a free atom of the matching type within 2·r_b of chain atom k bonds side-on. A full strand detaches, which makes a copy. Copies mis-pair with p = 0.08 per atom (the first mutation). In Water with pure Si the chain hydrolyses before 2 s, so **no copier forms**, and after 10 s the hint "the sea is eating your chains" appears. DESIGN §3 lock 1 survives at the atom level.
- **Hand-off:** the first 8 copies (cap 24 by 0:30) are promoted to organisms (§3.2). Leftover atoms fade (0.8 s) into soil nutrient and the CPU loop stops. A 3k-atom CPU sim costs about 1.5 ms per frame and needs no GPU bonding work. The GPU scheme in REPORT §6.5 is a stretch goal only.
- **R-rules:** R1, R2, R5 (hydrolysis), R6 (rate), R9 (colour = atom family).

### 3.2 Stage 1: founder genome from the copier (CPU, once per copy)

The sequence `s = [C, Si, Si, O, C, …]` (length L) maps to the genome like this (designed mapping, declared):

| From the sequence | Becomes |
|---|---|
| L | `segN` gene: `(L − 3)/13` (so 4–8 segments) |
| fractions of C, Si, O | composition `comp = {c, si, o}` (a body property, §3.3) |
| C/Si alternations ÷ (L − 1) | `pattern` gene: high alternation → **bands** (fauna-05's origin) |
| # O | `glow`, plus metabolism via `o` |
| `hash(s)` | all remaining genes in a narrow founder range: size small (0.1 m), `limbStart > limbEnd` (no limbs), `t = 0.1` (grazer), eyes small, `buoy = 0.2`, `motility = 0.6` |
| Spark at the birth site > θ | producer founder (plant genome F from the same hash) instead of animal |

So **the first animals are always worms**, and complexity has to be earned by mutation and selection. Two players start from different founders because their preludes ran on different chemistry.

### 3.3 Stage 2: genome → development → body plan (CPU, at each birth; pure TS function `develop()`)

**Genome G (32 genes, f32 in [0,1]) plus composition (c, si, o, barycentric).** Grouped like a Hox code (Lewis 1978; Carroll 2005): an axis, then domains along it, then identities per domain.

| # | Gene | # | Gene | # | Gene | # | Gene |
|---|---|---|---|---|---|---|---|
| 0 | segN | 8 | headLen | 16 | dorsalMix (rod↔frill) | 24 | diet t |
| 1 | size (log) | 9 | limbStart | 17 | dorsalDensity | 25 | buoyancy |
| 2–4 | radius profile head/mid/tail | 10 | limbEnd | 18 | tailType (taper/fin/fluke) | 26 | glow |
| 5 | elongation | 11 | limbPeriod | 19 | eyeBudget | 27 | sociality |
| 6 | symmetry | 12 | limbLen | 20 | eyeCountBias | 28 | boldness |
| 7 | axis (horiz↔vertical) | 13 | limbJointBias | 21 | hornLen | 29 | r/K (litter size) |
| | | 14 | plateCover | 22 | hornCountBias | 30 | skin pattern (spots↔bands↔patch) |
| | | 15 | plateSize | 23 | gape | 31 | headWidth |

**Composition is inherited and rebuilt.** `comp_child = normalise(lerp(comp_parent, Recipe, 0.35) + N(0, 0.03))`. Bodies are built from atoms available in the world, so a Recipe move shows on the very next births. This is "you are what you're built from", and it is the **plasticity path** for Recipe. Selection then acts on which compositions *survive* (dissolution, hardness, build costs), so lineage composition drifts away from the Recipe in a direction the sea and predators choose.

**Developmental rules (chemistry = the grammar).** This is where the morphospace is bent, in the style of Raup's (1966) theoretical morphospace: chemistry decides which region of shape space development can even reach.

| Output | Rule | Chemistry / env term | Atlas rule |
|---|---|---|---|
| Segment count | `3 + round(13·g0)`, cap 16. **Duplication mutation** (p = 0.03) copies one segment's identity, so bodies lengthen into serpents. | — | — |
| Adult scale S (m) | `0.15·2^(6·g1) · TSR(heat) · (1 + 0.6·ρ_air·buoy)` with `TSR = lerp(1.6, 0.65, heat)` | Heat (the temperature–size rule, Atkinson 1994), Sea via air density | R6, R11 |
| Cross-section | sides `n = si > 0.5 ? 6 : 12`. Flat normals if `si > 0.45` (dFdx/dFdy `normalNode`) | **Si → hexagonal prisms (facets)** | R1 |
| Radius profile | quadratic Bézier(g2, g3, g4). Quantised to 3 steps with weight `si` (stacked repeat units), smoothed with weight `c` | Si = stepped, C = smooth | R1 |
| Joint limits | `θmax = lerp(55°, 14°, si)`. Angles snapped to 15° steps when `si > 0.5` | **Si = rigid, fixed angles. C = sinuous.** | R1 |
| Symmetry | radial if `g6 > 0.75 − 0.25·si`. Order `k ∈ {3, 6}` if Si-leaning, `{4, 5, 8}` if C/O-leaning | Si biases towards radial crystal habit | R1 |
| Axis | vertical if radial or `g7 > 0.7` (stilt body raised on legs) | — | — |
| Hox domains | head = first `max(1, round(segN·0.5·g8))` segments. Limb domain `[segN·g9, segN·g10]` (empty if g10 ≤ g9). One limb pair every `1 + ⌊2.99·g11⌋` segments, max 4 pairs. | — | — |
| Limbs | length `S·(0.3 + 1.7·g12)`. Joints: Si → 2 straight rods. C → `2 + round(4·c·g13)` tapered, curving segments (tentacle-like). Limb tips grow **claws** if `t > 0.55` | Si = rods, C = tentacles | R1, R10 |
| Plates | cover the dorsal fraction g14 at size g15. **Made of stone**, so build cost `∝ 1/(0.2 + si)`, and colour bone that **stains with the individual's age** towards the sea's stain | Si+O cheap, C expensive | R2, R3, R5 |
| Dorsal row | `dorsalMix·c` vs `(1 − dorsalMix)·si` picks **frills/fins** (C) vs **rods/spikes/feathers** (Si). Count `round(2·segN·g17)` | — | R1 |
| Eyes | area budget `A = g19·(1.5 − light)` (dark → bigger eyes, plastic). Count: Si → cluster of 3/4/6 dots (by g20). C → 2 ring eyes, or 1 big glossy eye if g20 < 0.25. Glow eyes (emissive 1.2–2) if `o > 0.3 && light < 0.35`. Placed at ±headWidth (g31 → hammerhead). | Si sees by light (ART §5), Light | R8, R9 |
| Horns | length `g21·0.6·S`. Si: 1 or 3 straight. C: 2 curved. | — | R10 |
| Skin | each skin Voronoi cell (hash on the tube's UV) picks a family colour with probability = comp. Pattern g30: spots / bands (segment parity) / patchwork. **Mixed comp gives confetti automatically.** | Recipe | R9 |
| Glow patches | magenta emissive spots, density `o·g26` | O | R8, R9 |
| Builder flag | `si·o > 0.12`: excretes stone at its den (§4) | Si+O | R12 |

`develop()` is deterministic and pure, so it gets a Tier 0 test per atlas genome (§8). It outputs a `Plan` of 64 floats plus a part list of ≤ 40 parts (type, segment, angle around the section, length, radius, curl, colour id).

### 3.4 Stage 3: ecology and selection (CPU, 20 Hz fixed step, SoA, uniform grid of 64²)

**The trait ledger.** Every gene pays somewhere and earns somewhere. Nothing is free, so no trait spreads unless the world rewards it. This table is the emergence engine. All coefficients are designed and declared.

| Trait | Cost (energy/s or mass) | Benefit | Which controls tilt it |
|---|---|---|---|
| Size S | basal `b0·M^0.75·rate(heat)` (Kleiber; West et al. 1997). Heat stress `0.4·max(0, heat − 0.5)·S` | can't be eaten by gape < S/0.8. Longer life `L = 30 s·S^0.25/rate(heat)` | **Heat**: cold → giants, hot → small (R6) |
| Composition si | dissolution HP `atk_si(sea)·si·(1 − plateCover)·S²` | hardness `+0.5·si` defence. Rod limbs weigh ×0.5. Acid bonus `+20%` digest | **Sea**: Water kills it, Acid rewards it (R5) |
| Composition o | metabolism ×(1 + 0.8·o) | speed ×(1 + 0.4·o). Glow allowed. Stone plates cheap with si | Recipe (R2) |
| Plates | mass `+0.4·cover·size`, build cost `/(0.2 + si)` | bite defence `+1.5·cover`. Blocks dissolution | **Sea + Hunger** (R5, R10) |
| Limbs | mass `∝ nLimbs·len²·(1 − 0.5·si)` | walk cost per metre `∝ M/(√nLimbs·len)` (crawling is ×6) | Air density: thick air makes legs dead weight |
| Buoyancy | volume ↑ (hollow), defence −0.3 | hover cost `max(0, ρ_body − ρ_air)·M` | **Sea·Heat** → `ρ_air` (R11) |
| Body length / undulation | — | swim cost `∝ M^0.67/(1 + 0.6·c·min(segN, 12)/12)` | C swims well, so serpents (R1) |
| Eyes | `0.2·A²` (eyes are expensive: Niven & Laughlin 2008) | vision `6·A·S^0.3·(0.25 + light)` | **Light**: dark → big eyes or glow eyes |
| Dorsal rods | small mass | touch-sense range `+3` that ignores light. Defence `+0.3` | dim + fierce → feathers (eco-09) |
| Frills | drag `0.05·count` | turn rate `+40%`. Hunters catch agile prey | Hunger |
| Horns | mass `∝ len` | attack `×(1 + hornLen)`, and counter-damage to attackers | **Hunger** (R10) |
| Diet t, gape | plant gain `∝ (1 − t)^1.5`. Meat gain `∝ t·(0.3 + 0.6·Hunger)` | hunting pays only when Hunger is high | **Hunger** |
| Glow | `0.3·glow` | in the dark, grazers steer to glow (lure), and glowing flora gets its spores carried | Light (R8) |
| Sociality | food competition among neighbours | predation risk `/(1 + 0.15·n_nbr)` (dilution, Hamilton 1971). But at Hunger > 0.75 hunters "bait-ball" (one strike takes 1 + n/6 prey) | **mid Hunger → shoals** (eco-11) |
| Motility < 0.15 | no locomotion, so it can't flee | filter-feeds Spark `∝ dorsal area·light`. **Indeterminate growth**: +1 segment every `20 s/rate(heat)` (cap 24) | cold + old → the Living Arch |
| r/K | litter `n = 1 + ⌊3(1 − g29)⌋`, offspring energy `0.8·E_rep/n` | many small young vs few big ones | rate(heat) |

**Loop per tick:**
1. Neighbour query: radius = vision.
2. Steering, as a weighted sum of seek food, flee (weight `Hunger·threat`), chase (weight `Hunger·t`), boids cohesion and alignment (Reynolds 1987, weight `sociality`), wander and terrain avoid. The weights are read live, so behaviour changes on the next tick (the plasticity path for Hunger).
3. Locomotion mode: the cheapest feasible of {walk, swim (low band 0.5–3 m), float (5–25 m aloft), sessile}, re-evaluated at birth and every 5 s. **Floating emerges when `ρ_air` exceeds body density.**
4. Energy: eat, pay the ledger, take damage.
5. Reproduce when `E > 1.5·M` (asexual budding with mutation). Juveniles start at scale 0.35 and grow over `3 s·S^0.25/rate(heat)`.
6. Death: energy ≤ 0, HP ≤ 0, eaten, or past lifespan. Si+O corpses drop their plates as **bone** onto the terrain (bone reefs). C corpses emit gas rings.

**Mutation:** each gene mutates with p = 0.3 by N(0, 0.05). Segment duplication p = 0.03. Hox domain shift p = 0.05 (moves limbStart/limbEnd by ±1 segment).

**Stress mutagenesis (tuning cheat with a real analogue):** for 12 s after any dial move, the mutation σ is ×2.5 (cf. stress-induced mutagenesis, Galhardo et al. 2007). It lets horns appear in about 25 s instead of 2 minutes. On screen it reads as a shimmer on newborns.

**Why this isn't a character creator:** the player never touches G. Each body plan in the guide exists only because its ledger balanced under *these* dials. The same dials with a different seed diverge too: whether the top hunter is a serpent or a quadruped depends on which lineage opened its limb domain first (contingency, as in Polyworld; Yaeger 1994).

**Counts justified:** 1,024 animals × about 25 neighbours = 26k pair checks per tick. At 20 Hz that's about 0.3 ms per tick in JS. At ×4 time it's 4 ticks per frame, about 1.2 ms. Plants: 1,536 × 1 light query (64² canopy grid) per 0.5 s. All of it fits on the main thread. A Worker is a later option, not a requirement. The **whole ecology also runs headless in Vitest**: 180 s simulated in about 1 s. So the emergent claims in §8 are *tests*.

### 3.5 Stage 4: procedural animation (GPU compute, every frame)

All TSL `Fn().compute(n)`, with storage from `instancedArray`:

| Buffer | Layout | Written by |
|---|---|---|
| `agentCur`, `agentPrev` | 1,024 × 3 vec4: pos.xyz + scale, heading.xyz + speed, phase, gait, mode, alive | CPU at 20 Hz (48 KB) |
| `plan` | 1,024 × 16 vec4 (segN, profile, θmax, quant, sides, axis, limb table, eye/horn params, colours) | CPU at births (dirty flag, ≤ 4 Hz) |
| `joints` | 1,024 × 16 × 2 vec4 (pos + frame quaternion) | spine pass |
| `feet` | 1,024 × 8 vec4 (planted pos, lift phase) | IK pass |
| `limbPose` | 8,192 × 3 vec4 (hip, knee, foot) | IK pass |
| `partSpec` | 32,768 × 2 vec4 (creature, segment, angle, type, len, radius, curl, colour) | CPU at births |
| `terrainH` | 256² f32 storage texture | terrain pass (§4) |

- **Spine pass (1 thread per creature, 16-joint loop):** interpolate head = lerp(prev, cur, α). **Follow-the-leader**: each joint is pulled to distance segLen from its parent, then its bend is clamped to θmax and **quantised to 15° when Si**. Swimmers add a travelling wave `A·sin(ωt − 2πu·λ)`, with `A ∝ c`, lateral for low swimmers and vertical (fluke) for aloft giants. Bells (radial, vertical axis) instead pulse their radius profile, `r(u,t)·(1 + 0.18·sin ωt)`, with thrust on contraction. Silicon creatures with `si > 0.6` get **stepped heading updates** (a 100 ms hold): "stiff and ticking" (ART §4).
- **IK pass (1 thread per limb):** analytic 2-bone IK by the law of cosines (pole = body up), and FABRIK (Aristidou & Lasenby 2011) for 3–6-joint C limbs. A foot re-plants when `|foot − rest| > stride = 0.6·limbLen`, along a 0.15 s arc. **The gait is derived from morphology** (the Spore approach, Hecker et al. 2008): 1 rear pair = hop, 2 pairs = diagonal trot, 3+ pairs = a metachronal wave. `terrainH` is sampled for the foot height. Tentacles and aloft limbs trail as verlet chains instead (no IK).
- **Sessile:** feet stay locked. The spine is solved as an **inverted catenary** between the first and last limb pairs, so a long sessile body becomes an arch.
- Cost: 16k joints + 8k limbs, about 0.2 ms.

### 3.6 Stage 5: skinning and rendering (GPU render, 4 draw calls for all fauna)

Inspired by Spore's skinning of user creatures (Hecker et al. 2008), but cheaper. **No SDF raymarch and no marching cubes** (round 1 rejected both, §11).

1. **Loft** (bodies, bells, spires): one shared tube mesh, 16 rings × 12 sides + caps (about 220 vertices). The vertex shader reads `joints[creature][ring]` and the profile from `plan`, places the ring, and snaps the 12 sides to 6 when Si by merging vertex pairs. Bells render open-bottomed and double-sided with `isGlass`. This is Bloomenthal's (1985) generalised cylinder, done in a vertex shader.
2. **Twig** (limbs, horns, rods, claws, tentacle links, flora internodes): one tapered 4-ring × 6-side tube. Per instance it reads `partSpec` or `limbPose`.
3. **Tile** (plates, frills, fins, flora caps): one hex/disc mesh with a curl parameter. Frills wave in phase along the spine.
4. **Eye**: an icosphere (detail 1) with an ink pupil and a white ring (C), or an emissive dot (Si). Blink every 3–6 s.

Everything uses the **shared world material** (cel step, coloured shadows, fog) with `positionNode` and `normalNode` computed from storage. Instances get identity instance matrices, because r187 runs `positionNode` after instancing. Vertex count is about 225k (loft) + 190k (twig) + 85k (tile) + 340k (eye) ≈ 0.85M. Only the loft casts shadows.

## 4. Terrain and environment

The terrain is **not where F is strong**, so it is kept honest and cheap. All relief traces back to the prelude and to life:

- **Base:** a flat dish (radius 150 m) with a shallow basin. The liquid plane sits at `h_sea`. Both are **seeded**.
- **First stone:** the prelude's Si–O rust pile (§3.1) splats a bone ring at the centre of `terrainH`.
- **Builders (R12):** agents with `si·o > 0.12` keep a **den point** (first rest spot). While resting there, they deposit `0.02·si·o·S` m of stone per second in a **ring kernel** (radius 0.6·S) around the den. Rings stack, so the den becomes a **hollow spire**. Each colony is also recorded as a CPU list of `{den, layer radii[]}`, and spires are drawn with the **loft** mesh: the profile is the deposit history, like a tree-ring record. Dens with an occupant render as **pores glowing amber** (R8, ART rule 3). Cold spires lean towards a neighbour within `2·r` and, if `heat < 0.45`, **fuse into an arch** (a loft with its spine bent between two tops). That fusion is a designed rendering reading.
- **Skeleton reefs:** bone plates from dead Si creatures splat small mounds. Plated worlds slowly pave themselves in bone, which is the diatom-ooze homage.
- **Stain (R3):** `stoneAge` per texel → `mix(bone, stain(sea), sat(age/age_full))` with the world-generator's height falloff. The **same stain** colours living creatures' plates by the individual's age, so old rhino-lizards in Water are rust-plated.
- **Erosion (module M9, optional):** GPU hydraulic + thermal erosion on `terrainH` (Mei et al. 2007), scaled by heat·Time. It carves channels through mesas of fused reef, which gives canyons (eco-10) and riverbeds that the liquid plane fills (eco-15).
- **Sky, fog, suns, far landforms:** the calibrated palette field and backdrop landforms from `mockups/worlds` `derive.ts`. This is **render-only**, and declared.
- **Air density** `ρ_air = base(sea)·(1.3 − heat)`, with Methane 0.9, Ammonia 0.6, Acid 0.45, Water 0.35. It also drives the fog density, so **thick air looks thick**, and the player can see why things float.

## 5. Flora

**Plants are agents with a 12-gene genome F, grown by an open L-system turtle** (Prusinkiewicz & Lindenmayer 1990). Apices query the environment each growth step (Měch & Prusinkiewicz 1996).

- **Genes:** internodeLen, branchProb, branchAngle, apexBias (cap ↔ reach ↔ glow), capSize, tiers, curl, spineRods, sporeRange, maxHeight, glow, pattern. Composition is inherited and rebuilt from the Recipe, as for fauna.
- **Grammar (axiom `A`):** `A → I[+A][−A]` with probability branchProb, else `A → I A`. When `A` hits its terminal condition it becomes `K` (cap), `G` (glow bulb) or `T` (tier dome).
- **Chemistry rewrites the grammar:**
  - **Si:** branch angles snap to 60° in a plane, giving hexagonal crystal trees (eco-02, frost fans). Internodes are straight. `T` repeats (stacked domes, flora-01 #3). Caps are hexagonal and faceted. `spineRods` are cheap.
  - **C:** each internode adds `curl·c·0.4` rad of twist, giving spiral swirl trees (flora-01 #1). Caps are soft, gilled and ringed (eco-05).
  - **O:** caps invert into **cups**, and glow is pink/magenta (eco-04, eco-15 lantern cups).
- **Environment queries:**
  - **Light (R7):** apex light = Light × canopy transmittance (64² grid of max cap height; shaded if under a cap). If apex light > θ_cap(capSize), it forms a cap, widened as `capW ∝ light`.
  - **Dark (R8):** if apex light < 0.25, it forms a `G` glow bulb, and every glow emissive is live-scaled by `(1 − light)^1.5`. This is the first effect of Light within 1 s.
  - **Heat:** growth rate = rate(heat). `maxHeight·TSR(heat)` makes cold giants (eco-05, eco-08).
  - **Sea:** Si flora in Water gets a bone crust on its stems (flecks, as on eco-08's caps). Unencrusted Si internodes dissolve.
- **Selection:** energy = captured light − upkeep ∝ biomass. Taller plants shade shorter ones. Grazers remove internodes (spine rods cut grazing by 60%, so prickly crystal flora wins under heavy grazing). Spores travel by wind within sporeRange, **or are carried by grazers that ate glowing flora**. That carried-spore advantage makes glow win in the dark (cf. fungal glow attracting insects, Oliveira et al. 2015).
- **Epiphytes:** spores can root on terrain *or on the dorsal segments of sessile animals*, so the Living Arch carries shrubs.
- **Growth rings:** the internodes added after a Recipe move take the new composition, so a dial change shows as a colour band at every growing tip within 2 s.
- **Budget:** 1,536 plants × ≤ 40 internodes = 61k twig instances + 1,536 cap/cup/bulb tiles. The CPU turtle appends only new internodes, and the attribute is uploaded per 0.5 s via `addUpdateRange` (fallback: a full 2 MB upload, about 0.5 ms). Carbon flora sways with follow-through. Silicon flora doesn't sway.

## 6. Fauna

**Chemistry is legible in four channels at once.** A judge can tell the family from across the room:

| | Silicon | Carbon | Oxygen-rich | Mixed |
|---|---|---|---|---|
| Colour (R9) | cyan + glass rim | coral | magenta patches + glow | confetti / bands |
| Form (R1) | hexagonal faceted segments, stepped profile, straight rods, 15° joints | round, smooth, curling, many-jointed | — | alternating segment shapes |
| Eyes | dot clusters (3/4/6), lit | 2 ring eyes or 1 glossy eye | glow eyes in the dark | — |
| Motion | stiff, ticking, snapping | S-waves, wobble, follow-through | fast | — |

**Hunters vs grazers** are not types. They sit at the two ends of the `t` axis, and the ledger decides which end pays. At low Hunger, high-t mutants starve. At high Hunger, a **coevolution loop** runs: horns and frills (hunters) against plates, hardness, shoals and boldness (prey). Hunters need gape > prey S/0.8, so prey size also escalates.

**Atlas fauna and the genomes that reach them.** This is a reachability argument: the values shown are where selection settles in Vitest runs (target values, tuned at H10–12). They are not authored species.

| Pin | Dials | Comp c/si/o | Key genes after selection | Why selection lands there | Status |
|---|---|---|---|---|---|
| **fauna-02** Rhino-lizards | Si, Water, mild, medium Hunger | .15/.65/.20 | segN 7, limb pairs 2 (domain 2–5, period 2), limbLen .35, plateCover .8, hornLen .5 (Si → 1 or 3 straight), eyes 3-dot | Water dissolves unplated Si (plates pay). Medium Hunger pays horns as defence. Ground walking, because the air is thin. Three colourways = lineage drift in the skin hash and comp. | **reached** |
| **fauna-05** Frilled serpent | C+Si mixed, Water, mild, fierce | .45/.40/.15 | segN 14 (duplications), limb pairs 2 short (limbLen .15), claws (t .8), dorsalMix → frill, pattern = bands | C undulation makes long bodies swim cheaply. Frills raise turn rate, which hunters need. Alternating comp + band pattern gives banded segments and claws. | **reached** |
| **fauna-09** Sky whales | C, Methane, cold, bright, gentle | .80/.05/.15 | S ≈ 12–20 m (g1 .85 × TSR 1.5), buoy .8, limbs lost, tailType fluke, eyes 2 small | `ρ_air` 1.1 > body density makes hovering cheap, so limbs are dead weight and get selected out. Cold → giant, long life. Gentle → nothing to fear. | **reached** |
| **fauna-03** Jellybots | Si+O, Methane/Ammonia, cool, dim | .10/.55/.35 | symmetry radial k 6, axis vertical, buoy .9, 6 C-free trailing rods (tentacle twigs, verlet), glass bell, glow eyes | Si biases radial order 6, the hollow bell floats in thick air, and dim light gives glow (R8). The lilac rim is the O share of the skin hash. | **reached** |
| **fauna-01** Watercolour giants | Si, Methane, cold, medium light | .10/.80/.10 | axis vertical, segN 4, limb pairs 2, limbLen 1.6, S 6 m, eyes 6-dot cluster | Si rods halve limb mass, so long legs give cheap walking and high vision. Cold → giant. The 6-dot cluster is the Si eye rule. | **reached** |
| **fauna-07** Hammerhead strider | Si, Acid, mild | .25/.60/.15 | as fauna-01, headWidth .9 (eyes at the extremes), plateCover .4 stained ochre/tan | Wide eye spacing raises vision range (+20% when headWidth > .6, a designed bonus). Plates stain with acid over age (R3). | **reached** (ochre = acid stain colour) |
| **fauna-06** Plated hopper | C, Water, dim, fierce | .60/.25/.15 | 1 rear limb pair long (hop gait), plateCover .7, eyeCountBias .1 → 1 glossy eye, A large | Dim light makes eyes big, and C makes 1 eye. Fierce makes plates. One long rear pair gives a hop gait automatically. | **reached** |
| **fauna-08** Confetti eels | balanced, Water, mild, medium | .35/.33/.32 | segN 10, no limbs, pattern = patch, eyes 2 ring | Mixed comp + patch skin gives confetti. Swimming selects length. Medium Hunger selects sociality, so they swim in groups. *Black heads* need an "ink cap" head colour rule (g30 > .8, designed). | **reached** |
| eco-09 **Feathered cyan hunter** | Si+O, Ammonia, cool, dim, fierce | .15/.70/.15 | quadruped (2 pairs), dorsalDensity .9 rods (feathers), t .85, eyes 1 big or 3 glow dots, hornLen .1 | Dim light makes rods (touch sense) pay. Fierce makes a hunter. Si makes the dorsal row rods, not frills. | **reached** |
| eco-02 Violet lizard + beetles | Si+O, Acid, warm, bright, medium | .10/.55/.35 | lizard: segN 8, dorsal spikes, t .7. Beetles: radial k 3/6 short-axis grazers, plated | Si+O comp renders cyan + magenta patchwork, which reads violet. Grazers get plates. | **reached** |
| eco-13 **Living Arch** | Si+O, Ammonia, cool, gentle, very old | .15/.65/.20 | motility .05 (sessile), 2 limb pairs at the ends, segN grows to 24, plates as violet crystal buds, stained rust bands per segment age | Sessile filter-feeding pays when cold (tiny metabolism). Indeterminate growth + catenary pose gives an arch. Epiphyte shrubs root on its back. Rust rings = segment-age stain bands. | **reached** (slowest. Needs Time ⏩ and is a tuning risk) |

## 7. Ecosystem dynamics

- **Energy flow:**
  - Light → Spark rain → producers (L-system caps capture light) → grazers (low t) → hunters (high t).
  - Sessile filter-feeders tap Spark directly.
  - Upkeep is lost as heat. Si+O corpses lock mass into **stone** (the world whitens, ART rule 1). C corpses leave as **gas**.
  - The nutrient pool: plant regrowth is capped by a soil nutrient per grid cell, which corpses refill (detritus). This is a spatial Lotka–Volterra with recycling.
- **Succession (each stage needs the one before):**
  1. prelude stone
  2. founder worms + pioneer mats
  3. limbed grazers spreading outward from the centre
  4. tall flora and canopy competition
  5. hunters (needs Hunger, and enough prey biomass to pay for gape)
  6. builders → spires → dim pores → glow dwellers
  7. very old: sessile giants and arches
- **Oscillation:** hunter booms → grazer crash → flora rebound → grazer recovery. A population ribbon (3 lines) plots it from the CPU totals.
- **Collapse modes, all visible:**
  - **Rust-out:** O high + Si, so everything is a builder and stone smothers the light. The hint reads "your silicon is turning to stone".
  - **Dissolve-out:** Si in Water with low Hunger. Plates never pay as defence, so only dissolution selects them, and lineages may die first. The hint reads "the sea is eating your silicon".
  - **Burn-out:** heat > 0.85. Upkeep outruns intake, survivors are tiny and dark (eco-10).
  - **Freeze:** heat < 0.1, rate ≈ 0.35. A museum of slow giants.
  - **Hunter overshoot:** fierce Hunger without plates. Mitigated by refuges near spires (creatures inside a pore can't be attacked).
- **Monitors:**
  - animals 150–1,000
  - plants 300–1,536
  - ≥ 4 occupied guide bins by 2:00
  - hunters/grazers 0.05–0.35 when Hunger > 0.5
  - stone fraction of the dish < 0.5

  Red for 30 s → hint + `#debug` log.
- **Midwife cheats (declared):**
  - if no limb buds appear by 0:55, the Hox-shift mutation p is ×5 for 15 s
  - if no hunter exists 40 s after Hunger > 0.6, one grazer gets t = 0.75, and the game says so: "a grazer tasted meat"

### Control × stage matrix (immediate plasticity in bold, then selection)

| Control | Prelude | Development (newborns) | Behaviour | Selection (generations) | Terrain / flora |
|---|---|---|---|---|---|
| **Recipe** | **atom colours in the burst** | **cyan facets / coral curves / magenta glow on the next births (≤ 2 s)** | O speeds everyone | lineage comp drifts to what the sea allows | **new growth rings on flora tips**. Builders appear with Si+O. |
| **Sea** | Si chains hydrolyse in Water | `ρ_air` sets newborn scale | float vs walk choice | **plates** (Water), floaters (Methane), Si thrive (Acid) | **palette lerp 1.5 s**, stain colour, fog thickness |
| **Heat** | bond breaking | **newborn size ±60% (TSR)** | **every animation and move speeds up or slows (rate)** | giants (cold) vs small (hot) | growth speed, flora height, erosion |
| **Light** | bonding rate (Spark) | eye size, glow eyes | vision range | big eyes, rods, lure glow | **Spark rain density + flora glow ≤ 1 s**, caps vs bulbs |
| **Hunger** | **atoms chase (pull asymmetry)** | — | **chase/flee within 1 tick** | horns, frills, claws vs plates, shoals | grazing scars on flora |
| **Time** | — | — | ×1/×4 ticks | generations per minute | **stains deepen, spires stack, arches fuse** |

## 8. Atlas coverage

The settings are WORLD_ATLAS §5.3. "Reached" means the mechanism is in the 16 h plan (§9) and gets a headless Vitest assertion: after 180 s simulated, the stated descriptor is present.

| Pin | Status | Mechanism |
|---|---|---|
| eco-01 Vermilion Eclipse | **reached** | Si+O builders → spires on bone, water iron stain + Time. Hot → small, dark (low-light skin), plated, horned survivors, few in number. Gap: the pin's figures are *tall*, which R6 contradicts. We show small horned walkers. |
| eco-02 Violet Sun Hollow | **reached** | §6. Crystal tree = Si L-system at 60°. Cratered rock = builder pores. Three trophic levels (beetle grazers, lizard hunter) at medium Hunger. |
| eco-03 Sindha pillars | **reached** | C, Water, bright, gentle. Tall C flora with stacked tiers (pillars). Small buoyant C swimmers with paired fins drift between them. A top-down camera preset. |
| eco-04 Frost Arches | **reached** | Methane cold Si+O builders → spires → fused arches (heat < 0.45). Dim + O → pink glowing cup flora on the floor. |
| eco-05 Parasol Giants | **reached** | C flora, cold TSR giant caps (bright), gilled soft caps. Orange tholin = palette field. (The tiny mech = the discovery-shot figure.) |
| eco-06 Capped Sea Stacks | **reached** | C+Si: Si+O builders in Water (plated, so they survive) raise stacks. C flora wins on the tops, where light is unshaded. Turquoise liquid plane. |
| eco-07 Two Suns Spire | **reached** | A balanced recipe fills the most guide bins (Vitest asserts ≥ 8). Spire = builder colony stained pink by its O-rich inhabitants. Aloft fliers + spores. Variety per seed isn't guaranteed. |
| eco-08 Coral Forest | **reached** | C, Methane cold → TSR-giant spotted parasols (bone crust flecks). Small walkers. |
| eco-09 Violet Hunter | **reached** | §6. Dim Si flora reach tall with no caps (straight trunks). Honeycomb lilac caps = hexagonal Si+O caps. |
| eco-10 Red Canyon Parasol | **partial** | Hot + very old: iron-stained reef plateau, burn-out leaves one or a few tall flora on the highest stone. **The canyon walls need erosion (M9)**. Without it they come from the render-only backdrop. |
| eco-11 Kelp Shoal | **reached** | Medium light → tall C kelp-like flora (reach, no caps). Medium Hunger → the sociality gene is selected, so **real agent shoals** of small orange C swimmers (boids are the agents themselves, not a render fake). |
| eco-12 Glow Garden | **reached** | Very dim → glow-bulb Si-leaning stalks, plastic glow `(1−light)^1.5`. Green field = palette field. |
| eco-13 Living Arch | **reached** (tuning risk) | §6: sessile, indeterminate growth, catenary arch, epiphyte shrubs, age-band rust rings. Needs Time ⏩ for about 40 s. |
| eco-14 Bone Reef | **reached** | Si+O, Acid, dim. Dense builder colonies → porous spires, occupied pores glow amber. Bone skeleton mounds. The strongest case. |
| eco-15 Lantern River | **partial** | Methane, dim, O: pink glowing flora is reached. Arches are reached. **The white river** needs a channel (M9 erosion), else it's the liquid plane in the basin. |

**Ecosystems: 13 reached, 2 partial (both reach "reached" if M9 erosion lands), 0 not reached.**

**Fauna:** fauna-01, 02, 03, 05, 06, 07, 08 and 09 are reached (§6). fauna-04 (the specimen poster) is the field-guide plate format. **9/9 reached.**

**Two players, two bestiaries (the divergence test, Vitest):** run 180 s headless and compare the guide-bin histograms.

| Preset | Bestiary that emerges |
|---|---|
| "Earth-ish" (C, Water, mild, bright) | coral worms → limbed coral grazers, a few swimming serpents, swirl and parasol flora, no stone, no plates |
| "Silicon city" (Si+O, Acid, warm, dim) | cyan faceted quadrupeds with dot-eyes, plated beetles, builders and pore spires, crystal trees, glow bulbs |
| "Frozen cathedral" (Si+O, Methane, cold, dim) | tall rod-legged striders, jelly bells aloft, sessile giants, pink cups, arches |
| "Hunter's dusk" (Si, Ammonia, cool, dim, fierce) | feathered rod-backed hunters, plated hoppers, shoals, tall trunk flora |

The assertion: the L1 distance between any two presets' bin histograms is > 0.6, and two seeds of the same preset are < 0.4. Different worlds, same-world consistency.

## 9. Build plan

### Modules (three.js r187 `three/webgpu`, TSL compute, Vite. Reuse `mockups/worlds` core: palette field, fog, sky, world material, camera.)

| Module | Kind | Hours |
|---|---|---|
| M0 `prelude/atoms.ts`: 3k-atom CPU bonding, copier rule, instanced atoms + bond capsules | CPU + render | 2.5 |
| M1 `life/genome.ts` + `develop.ts`: genome, mutation, founder mapping, `develop()` → Plan + parts. **Tier 0 tests per atlas genome.** | CPU, pure | 2 |
| M2 `life/ecology.ts`: SoA agents, grid, steering, ledger, reproduction, death, headless runner. **Vitest preset assertions.** | CPU, pure | 3.5 |
| M3 `gpu/pose.ts`: spine, quantise, waves, bells, 2-bone IK, gait, verlet tentacles, catenary | GPU compute | 3 |
| M4 `render/fauna.ts`: loft/twig/tile/eye instanced meshes, storage-driven `positionNode`/`normalNode`, skin Voronoi + pattern, glass rim, plate stain | GPU render | 4 |
| M5 `life/flora.ts` + `render/flora.ts`: L-system turtle, canopy grid, chemistry rewrite, twig + cap instances | CPU + render | 3 |
| M6 `world/terrain.ts`: `terrainH` storage texture, deposit splats, stain, spires/arches as lofts | GPU + CPU | 2 |
| M7 `game/guide.ts`: MAP-Elites bins (locomotion 4 × family 4 × diet 3 × size 3 × armour 2 × symmetry 2 = 576 cells), names, thumbnails, discovery shot (2D card first) | CPU + render | 2.5 |
| M8 `ui/`: dials → uniforms + ecology params, hints, monitors, population ribbon | CPU | 1.5 |
| M9 `world/erosion.ts`: GPU hydraulic + thermal erosion (stretch) | GPU compute | 2 |

That's about 24 person-hours of core work (+2 stretch). With 3 people it's 8–9 h each, inside 16 h of wall clock with integration slack.

### Budgets (Apple Silicon laptop, Chrome WebGPU, 1080p)

- **CPU:** ecology 0.3 ms per tick × (1–4) + flora 0.2 ms + uploads (48 KB at 20 Hz, plan/parts at ≤ 4 Hz) ≈ ≤ 2 ms per frame. Prelude 1.5 ms (only before 0:35).
- **GPU compute:** pose 0.2 ms, Spark motes 16k + gas rings 4k + spores 8k = 28k particles 0.2 ms, terrain splats < 0.1 ms, erosion (M9) 0.5 ms.
- **Render:** about 0.85M fauna vertices + 61k twig instances (about 3M vertices worst case, at 48 vertices each) + terrain 65k. About 14 draw calls, one shadow light (lofts only), bloom. Target ≥ 55 fps.
- **Particle budget:** 28k GPU particles. That's at the brief's 32k floor, and below it on purpose. The heavy lifting is instances, not particles.
- **Quality tier `low`:** 512 animals, 768 plants, 12-side → 8-side loft, no loft shadows.

### 16-hour order (3 people; the cheapest demo path first)

| Hours | Life (CPU) | GPU / Render | Glue / Art |
|---|---|---|---|
| H0–2 | M1 genome + `develop()` + tests | M4 v0: **beads** (one instanced sphere per joint) placed by CPU | reuse mockups world, dials UI |
| H2–4 | M2 ecology core: grazers + flora stubs (discs), births/mutations, headless runner | M3 spine pass + follow-the-leader + Si quantise | M0 prelude atoms + copier (CPU) |
| H4–7 | M2 ledger (size, si dissolution, plates, Hunger), Vitest for 3 presets | M4 loft mesh with storage `positionNode`, facets, skin colours, eyes | founder hand-off, camera pull-out |
| **H8 checkpoint** | **must show: pixel → atoms → copier → worms open eyes → grazing → Recipe → Si makes cyan faceted newborns → Water dissolves them** | | |
| H8–11 | M5 flora L-system + canopy + chemistry rewrite | M3 IK legs + gait; M4 twig/tile parts (limbs, plates, horns, rods, frills) | M7 guide bins + 2D card discovery |
| H11–13 | buoyancy/aloft, sociality, sessile, builders | bells, verlet tentacles, fluke waves, glass rim, plate stain | M6 terrain splats, spires, pores |
| H13–15 | preset sweep: tune the ledger until the 11 genomes in §6 appear (Vitest) | flora render (twig/caps, sway, glow), arch fusion | hints, monitors, ribbon, audio |
| H15–16 | demo seeds pinned | M9 erosion if green, else cut | discovery-shot plate upgrade, rehearse |

**Cut order:**
1. M9 erosion
2. verlet tentacles (bells keep their rods static)
3. FABRIK (keep 2-bone only)
4. arch fusion
5. sessile Living Arch
6. frills (dorsal = rods only)

**Never cut:** the copier → worm hand-off, Si-facet development, Water dissolution + plates, IK legs, the field guide.

**Biggest technical risk:** the ledger may not produce the target body plans within 3 minutes. Selection is slow and the coefficients interact. **Mitigations:**
- The ecology is pure TS and runs headless at about 180× real time, so tuning is an automated sweep rather than eyeballing. Run a grid over 6 ledger coefficients × 4 presets overnight-style in about 10 min.
- Stress mutagenesis.
- Founders seeded with variance from the copier's mis-pairing.

**Second risk:** storage reads in `positionNode` for 4 instanced meshes on r187. Smoke-test at H2. Fallback: pack `joints` into a `DataTexture` (RGBA32F, 32 × 1,024) and sample with `textureLoad`.

## 10. Honesty box

**Seeds:**
- the pixel and its atom emission (3,072 atoms drawn from Recipe)
- Spark motes
- the flat dish + basin + liquid plane
- the **copier rule** granted to one emergent chain at t ≥ 15 s
- the RNG seed

**Designed (not emergent):**
- the founder mapping sequence → genome (§3.2)
- the developmental interpreter (`develop()` and all of its chemistry rules)
- the 32-gene layout and its Hox-like domains
- the trait ledger coefficients
- the locomotion-mode costs
- the producer/animal founding rule (Spark at the birth site)
- the hammerhead vision bonus
- the "ink cap" head colour
- builder deposit kernels
- the arch-fusion rule (heat < 0.45)
- the guide bins and the name generator

The *organisms* are emergent. The *physics of what pays* is authored, exactly as in Sims (1994), Polyworld (Yaeger 1994) and Gene Pool (Ventrella).

**Plasticity is authored reaction norms:** temperature–size, eye size vs light, glow vs light, and composition uptake. They are real biology (Atkinson 1994), but they are direct maps, and they make the first 3 s predictable *by design*.

**Tuning cheats:**
- stress mutagenesis ×2.5 for 12 s after dial moves
- the Hox-shift midwife at 0:55
- the "grazer tasted meat" hunter fallback (announced on screen)
- `atk_si` × 0.03
- log-compressed rate(heat)
- Time ⏩ raises ticks per frame

**Scripted:**
- the camera pull-out, driven by body size
- the discovery shot
- the presenter's dial moves
- the "Frozen cathedral" preset jump
- the two-bestiary comparison (the second run is a saved guide, not live)

**Render-only fakes:**
- sky, suns and backdrop landforms
- fog
- blink
- frill phase waves
- the bell pulse amplitude
- pore glow (it's tied to occupancy, but the glow itself is a shader)
- leg IK (the feet don't affect the sim; the agents are points)
- the 12 → 6 side snap (shading only)

**Science vs game:** R1, R2, R5, the temperature–size rule, Kleiber scaling, eye cost and dilution are [sci]-flavoured. Stains, glow pink, thick-air flight thresholds and every coefficient are [game].

**Unknowns:**
- whether horns appear in under 30 s even with mutagenesis
- whether sky whales lose their legs within 2 minutes (they may need to start from a buoyant lineage)
- Living Arch timing
- 61k twig instances plus 0.85M fauna vertices on the demo laptop (the low tier exists)
- `addUpdateRange` behaviour on the WebGPU backend in r187
- whether players read a stiff silicon ticking gait as "silicon" or as lag

## 11. Iteration log

### Round 1: Spore with a chemistry skin

**Propose.**
- A 10 s atom intro (pure particles, no bonds) cuts to a population of 200 creatures with a 20-gene direct encoding: genes map 1:1 to traits (legs, horns, plates and so on).
- Recipe biases *mutation*: Si raises the chance that "plates" or "rods" genes mutate upwards.
- Bodies are SDF capsules blended with smooth-min (Quilez), either raymarched per creature or baked per species by marching cubes in a worker.
- Fitness is a single energy number. Hunger raises the predator fraction directly.

**Critique.**

| | Score | Weakness |
|---|---|---|
| E | 2 | The intro is decoration with no hand-off. Mutation bias means Recipe effectively **chooses** traits, which is a character creator with extra steps. Hunger *sets* the predator fraction instead of making predation pay. |
| C | 3 | Recipe changes probabilities that take generations to show. Sea and Heat have no developmental effect, and a Si creature in Water looks the same as in Acid. |
| A | 3 | No terrain logic, so arches, reefs and spires are not reached. No floating mode (whales, jellies). No sessile path (Living Arch). |
| S | 3 | Creatures pop in fully formed at 0:10. There's no "first life" beat and no bloom from the pixel. |
| F | 2 | Raymarching 200 SDF creatures at 1080p is too slow. Marching cubes per species takes 30–80 ms each and breaks the per-individual variety. |
| I | 3 | Recipe and Hunger have no effect within 3 s. |

**Revise.**
1. *Emergence (lowest):* chemistry moves from mutation bias into a **developmental interpreter**. Composition becomes a body property rebuilt from the Recipe at birth. Every trait gets an entry in a **cost/benefit ledger**, so predation, plates and floating are paid for, not set.
2. *Feasibility:* SDFs are dropped for **lofted generalised cylinders** in a vertex shader (one shared mesh, per-instance profile).
3. The prelude gains bonds and a **copier → founder-genome hand-off**.

### Round 2: interpreter + ledger + lofts

**Propose.**
- Prelude: 3k CPU atoms → seeded copier → sequence-derived founder worms.
- 28-gene genome with Hox domains.
- `develop()` reads composition (Si facets, quantised joints, dot eyes; C curves).
- Ledger with size, dissolution, plates, horns and diet.
- Lofted bodies with bead limbs.
- Flora are fixed parametric parasols.
- No terrain beyond a flat dish.

**Critique.**

| | Score | Weakness |
|---|---|---|
| E | 3 | Selection is real, but about 10 generations in 2 minutes won't grow horns from zero. Flora are not evolved, and terrain doesn't come from life. |
| C | 4 | Recipe and Sea are legible, but Light only changes vision range (invisible), and Heat only changes metabolism (invisible). |
| A | 3 | No builders, so eco-04, 06, 14 and 15 fail. No floating mode, so fauna-03 and fauna-09 fail. No shoals, no Living Arch. 8/15. |
| S | 3 | The "worm opens its eyes" beat exists, but the scale jump from atoms to animals is abrupt. No third whoa. |
| F | 4 | Plausible. Beads for limbs look like caterpillars. |
| I | 3 | Hunger's first effect is invisible (it's only selection). Heat is invisible. |

**Revise.**
1. *Atlas / Intuitiveness (lowest):* the **dual pathway**. Every control now has an immediate **plasticity/behaviour** effect: TSR size and animation rate (Heat), eye size and live glow (Light), chase/flee weights (Hunger), atom chase in the prelude (Hunger), newborn composition (Recipe). The slow selection effect sits on top.
2. Added **air density** `ρ_air(sea, heat)` with four locomotion modes chosen by cost. Floaters emerge.
3. Added **builders** (Si·O dens → ring deposits → loft spires → pores → arch fusion) and **bone skeleton reefs**.
4. Added the **sessile** branch with indeterminate growth + catenary + epiphytes.
5. Added the **sociality** gene with dilution vs bait-balling.
6. Flora become **open L-systems with chemistry rewrites** and their own selection (shade, grazing, glow-carried spores).
7. **Stress mutagenesis** and copier mis-pairing to speed evolution.
8. The camera pull-out is tied to body size.

### Round 3: full pipeline

**Propose.** §2–§8 as written, but with five fauna draw paths (body, limbs, horns/rods, plates/frills, eyes) as separate geometries per type, sexual crossover, SDF-skinned flora, and a GPU agent sim to "be safe" on counts.

**Critique.**

| | Score | Weakness |
|---|---|---|
| E | 4 | Ledger coefficients and plasticity maps are authored, so they must be declared. The founding rule (producer vs animal) is designed. |
| C | 5 | Every control changes every stage in the predicted direction, and the matrix (§7) has a bold immediate effect in every row. |
| A | 4 | 13/15. eco-10's canyon and eco-15's river need carving, and only erosion gives them. |
| S | 4 | Three whoas (eyes open, discovery, two bestiaries). There's a risk the silicon tick reads as lag. |
| F | 3 | Too much: a GPU agent sim with branchy reproduction and genome copying in TSL (no compare-and-swap, variable allocation) is a hackathon trap. Crossover needs mate search. SDF flora is a second skinning system. Six geometries × separate pose code. |
| I | 4 | Clear, though four dial moves at once in "Frozen cathedral" blur cause and effect. |

**Revise.**
1. *Feasibility (lowest):* agents stay on the **CPU** (1,024 is about 0.3 ms per tick, justified), and the GPU does only pose and render.
2. Dropped crossover (asexual budding only).
3. Collapsed all geometry to **four shared meshes** (loft, twig, tile, eye). Flora internodes, limbs, horns, rods and claws are all twigs, and spires are lofts. That's 4 fauna draw calls.
4. Made `develop()` and the ecology **pure TS, testable headless at about 180×**, so tuning is a sweep and the atlas claims become Vitest assertions.
5. Added the bead v0 for the H8 checkpoint.
6. Moved erosion to an optional module M9 and marked eco-10/15 partial.
7. The demo does single dial moves first and only then the preset jump.

### Round 4: final (this document)

**Critique.**

| | Score | Weakness |
|---|---|---|
| E | 4 | The organisms and bestiaries are emergent and contingent. The rules of development and of what pays are authored (as in Sims / Polyworld). The copier is granted, and three midwife cheats exist. All are declared. Not a 5, because plasticity is a direct map by design. |
| C | 5 | Chemistry is legible in colour, form, eyes and motion (§6). Every control has an immediate effect plus a selection effect, both in the R-rule direction, and both are testable. |
| A | 4 | 13 reached, 2 partial, 9/9 fauna. On count alone that's a 5. We hold it at 4 because eco-13 (Living Arch) and the sky-whale leg loss are tuning risks, and eco-01 is reached with a stated gap (small figures, not tall ones). eco-10 and eco-15 depend on M9. |
| S | 4 | The pixel → atoms → copier → "the molecule opens its eyes" bloom, plus legs appearing, the discovery shot and two bestiaries. Terrain spectacle is weaker than C's field-first design, and the backdrop is render-only. |
| F | 4 | About 24 person-hours, a bead fallback at H8, and four shared meshes. Ledger tuning is the risk, and it's mitigated by the headless sweep. |
| I | 4 | Each control's first effect shows within 1–3 s. A stiff silicon gait may need a "clockwork tick" sound cue to read as intended. |

All criteria are at 4 or above, so the loop stops here. The one place this design is knowingly weaker than its siblings is **terrain**. A hybrid with C's field-driven stone would lift S and A.

### References

- Sims, K. (1994). Evolving virtual creatures. *SIGGRAPH '94*, doi:10.1145/192161.192167. Also "Evolving 3D morphology and behavior by competition", *ALife IV*.
- Hecker, C., Raabe, B., Enslow, R., DeWeese, J., Maynard, J., van Prooijen, K. (2008). Real-time motion retargeting to highly varied user-created morphologies. *ACM TOG 27(3)*, doi:10.1145/1399504.1360626.
- Yaeger, L. (1994). Computational genetics, physiology, metabolism, neural systems, learning, vision, and behavior, or PolyWorld. *ALife III*.
- Ventrella, J. *Gene Pool* (evolving swimbots; sexual selection on morphology).
- Prusinkiewicz, P. & Lindenmayer, A. (1990). *The Algorithmic Beauty of Plants*. Springer.
- Měch, R. & Prusinkiewicz, P. (1996). Visual models of plants interacting with their environment. *SIGGRAPH '96*, doi:10.1145/237170.237279.
- Runions, A., Lane, B., Prusinkiewicz, P. (2007). Modeling trees with a space colonization algorithm. *Eurographics NPH*. (Considered for canopies, and not used for budget.)
- Mouret, J.-B. & Clune, J. (2015). Illuminating search spaces by mapping elites. arXiv:1504.04909.
- Stanley, K. (2007). Compositional pattern producing networks. *GPEM 8*, doi:10.1007/s10710-007-9028-8. (Rejected: too opaque for legible chemistry.)
- Cheney, N., MacCurdy, R., Clune, J., Lipson, H. (2013). Unshackling evolution: evolving soft robots with multiple materials. *GECCO*, doi:10.1145/2463372.2463404. (Material identity shaping morphology, the analogue of composition-as-grammar.)
- Raup, D. (1966). Geometric analysis of shell coiling. *J. Paleontology 40*. (Theoretical morphospace.)
- Lewis, E. B. (1978). A gene complex controlling segmentation in *Drosophila*. *Nature 276*. Carroll, S. B. (2005). *Endless Forms Most Beautiful*.
- Atkinson, D. (1994). Temperature and organism size: a biological law for ectotherms? *Adv. Ecol. Res. 25*.
- West, G., Brown, J., Enquist, B. (1997). A general model for the origin of allometric scaling laws. *Science 276*.
- Niven, J. & Laughlin, S. (2008). Energy limitation as a selective pressure on the evolution of sensory systems. *J. Exp. Biol. 211*.
- Hamilton, W. D. (1971). Geometry for the selfish herd. *J. Theor. Biol. 31*.
- Reynolds, C. (1987). Flocks, herds and schools. *SIGGRAPH '87*, doi:10.1145/37402.37406.
- Aristidou, A. & Lasenby, J. (2011). FABRIK. *Graphical Models 73*, doi:10.1016/j.gmod.2011.05.003.
- Rosen, D. (2014). An indie approach to procedural animation. *GDC*.
- Bloomenthal, J. (1985). Modeling the mighty maple. *SIGGRAPH '85*. (Generalised cylinders.)
- Galhardo, R., Hastings, P., Rosenberg, S. (2007). Mutation as a stress response and the regulation of evolvability. *Crit. Rev. Biochem. Mol. Biol. 42*.
- Oliveira, A. et al. (2015). Circadian control sheds light on fungal bioluminescence. *Current Biology 25*.
- Mei, X., Decaudin, P., Hu, B.-G. (2007). Fast hydraulic erosion simulation and visualization on GPU. *Pacific Graphics*.
- Hutton, T. (2002). Evolvable self-replicating molecules in an artificial chemistry. *Artificial Life 8*. Also REPORT §6.4–6.5 in this repo.
