# Emergence design A: Sediment
> Starting philosophy: everything is atoms. The ground is what life leaves behind.  ·  Final scores: E4 C4 A4 S4 F4 I4

## 1. The idea in one paragraph

The first pixel is a **Spark atom**. On the first click it fissions into a spray of C, Si, O and Spark atoms in the Recipe's ratio (seed #1, declared). From then on there is **one ground truth: a 2D GPU atom sim** (particle-life forces + typed bonds, REPORT §6.5) on a 512 × 512 m disc. Every layer above it is the same atoms seen at a cheaper resolution. Bonded atoms form chains and rings. Rings that copy and eat get **promoted** to organisms whose genome *is their own atom string*. That string is read by a fixed turtle grammar into a body: Si is a straight segment, C is a curve, O is a plate or mouth, Spark is an eye or glow. Dead matter never vanishes. Si–O **stone** atoms random-walk until they touch older stone (diffusion-limited aggregation), then **retire into a sediment heightfield**, stamped with the sea's stain for that epoch. So reefs, spires, pores and strata are the fossil record of where life lived, and **C–O gas** retires upward into an atmosphere accumulator that thickens the haze, stains the sky orange (tholin) and, in methane cold, snows back down as frost. The sea is a flat level. Sediment that breaks its surface becomes land, which is how islands, sea stacks and white methane rivers appear. The 3-minute arc is a **reverse Powers of Ten**: the camera starts on one pixel, pulls back as the world spreads outward from it, and finally tilts down to eye level inside a landscape the player's chemistry laid down. The honest shortcuts are a representation change at each scale (atom → organism → instanced body, stone atom → heightfield cell, gas atom → scalar) and a declared **geologic gain** on Time.

## 2. The bloom: pixel → world timeline

Demo preset: Recipe .25·.45·.30, Sea Water → Acid at 0:40, Heat .5, Light .6, Hunger .4. Times are targets with milestone triggers. Each camera move fires on a milestone, with a time fallback (declared).

| t | What the player sees | What is actually simulated | Emergent / seeded / scripted |
|---|---|---|---|
| 0:00 | Black void, one amber pixel breathing (this is the loader, per world-style) | 1 Spark atom, HDR emissive 3 | **Seed #0** (the pixel) |
| 0:02 | Click. The pixel blows out into a coloured shell: coral, cyan, magenta and amber beads racing outward, cooling and slowing | Genesis kernel: 49k atoms emitted from the origin over 4 s, types drawn from Recipe, radial speed falling off with heat-driven drag | **Seed #1** (genesis spray, scripted rate) |
| 0:06 | Beads clump into wobbling knots. Silicon knots tick, carbon knots jiggle | Particle-life forces K = S + h·A (§3.1) | Emergent |
| 0:12 | Lace: lines snap between beads, chains wriggle | Mutual-best bonding (REPORT §6.5), activation paid by a touched Spark | Emergent |
| 0:20 | The first **bone-white specks** freeze and drift to the bottom (the screen darkens towards "below") | Si with 2 O bonds flips to Stone, then DLA walk | Emergent |
| 0:28 | Cyan chains in the teal sea **crumble into sand**. Carbon chains hold | Water hydrolysis on Si–Si (×0.03 tuning) | Emergent (puzzle lock 1, DESIGN §3) |
| 0:35 | White coral-branches lace the dish floor. The camera has eased back from a 30 m window to 90 m | Stone retires into heightfield `h0`. Camera framing follows the atom front radius | Emergent, camera rule |
| 0:40 | **Presenter switches Sea to Acid.** Sky goes lemon in 1.5 s. Cyan chains stop dying and lengthen | Hydrolysis matrix swap, palette lerp | Player |
| 0:50 | A cyan-and-coral ring closes around a chain. The chain copies. | Template rule (Hutton-style), CPU sampler sees parent + child with the same sequence | Emergent if it happens; **seed #2** (one copier ring dropped at the densest Si+C patch) if no replicator by 0:50 |
| 0:55 | **Eyes open** on the ring (amber dot cluster). Time eases to 0.2, a specimen plate: *"Glass Wheel, Vitreorota acidophila"* | Chemoton promotion (§3.3) | Emergent promotion, scripted shot |
| 1:10 | The wheels multiply. Some stop moving, sprout amber sails and turn towards the light rain. Others swim | Birth by claiming nearby free atoms. Genomes without C movers anchor and harvest | Emergent selection |
| 1:25 | **First land.** The white reef under the anchored colony breaks the sea surface. The sea shows its edge. Fresh crust is bone, older crust is already going yellow-tan | `h0 > seaLevel`. Stain accumulates per cell | Emergent |
| 1:45 | A swimmer with a magenta mouth bites a sail. Plated grazers appear. A long banded hunter (alternating cyan and coral segments) hunts | Mouth damage on bonds, energy gain, Hunger multipliers, mutation | Emergent |
| 2:00 | **The rise.** The player taps ⏩. Free atoms thin into drifting motes, organisms morph into solid bodies, the camera arcs up and over, then **tilts down to eye level**. Reefs extrude into porous spires with banded strata | Geologic gain G 1 → 40, LOD switch (§3.4), thermal erosion | Player + **scripted** camera path; the terrain itself is sediment |
| 2:20 | A tiny explorer silhouette at the foot of a pore-glowing bone spire. Sails are now parasol caps on stiff stalks. Shoals of coral swimmers drift through the haze | Instanced genome meshes, occupancy glow in pores, buoyancy lift (render) | Emergent shapes, render-only altitude |
| 2:40 | **Discovery shot.** The banded hunter, enormous, against a lemon sky. Plate lists its rules | ART_DIRECTION §6 | Scripted shot of an emergent creature |
| 2:55 | Pull back: the cliffs show a rust-red water-era band under a sulfur-tan acid-era band: *the moment you changed the sea* | Strata epoch stamps (§4.3) | Emergent |

## 3. Stages in detail

**One space, three resolutions.** The sim plane is x,z ∈ [−256, 256] m. Atoms are 1 m beads, which makes organisms 8–30 m and lets the macro view put a 1.7 m human at their feet with no rescaling. Height (y) is never simulated for atoms. It comes from the sediment under them (`h0`, or `h2` for bridging bodies, §4.2), plus a render-only lift for fliers.

| Level | Representation | Lives on | Count |
|---|---|---|---|
| L0 fields | Spark-rain mask, solvent hostility, atmosphere scalars | GPU texture 128² + 6 uniforms | — |
| L1 atoms | bead + 4 bond slots | GPU storage buffers | 49,152 (high) / 24,576 (low) |
| L2 molecules, protocells | the same atoms. Chains, rings and copies are *detected*, not stored | CPU sampler, 2 Hz | ~4k atom window |
| L3 organisms | atoms tagged `orgId` + one org record | GPU (atoms, org kernel) + CPU (promotion, births) | ≤ 2,048 orgs, ≤ 64 live species |
| L4 bodies (macro LOD) | one turtle-grown mesh per species, instanced per org | GPU render only | ≤ 64 draw calls |
| Dead matter | `h0`, `h2` heightfield cells + strata epochs; gas scalars | GPU storage 256² (2 m cells) | 65,536 cells |

### 3.1 L1: atoms (GPU compute)

**State, per atom (48 B, 2.4 MB at 49k):** `pos vec2`, `vel vec2`, `meta u32` (type 3 bits: C, Si, O, Spark, Stone, Gas, Free · stiff flag · jitter seed 8 bits · `orgId` 16 bits), `bond[4] u32` (partner index or `0xFFFFFFFF`), `energy f32`, `age f32`, `prop u32` (proposal), `claim u32` (birth claim counter, cleared each frame).

**Kernels, per substep (2 per frame, 4 under ⏩ at low N):**
1. `clearBins` → `bin`: `s = atomicAdd(cellCount[c],1); if s < 24 then cellItems[c*24+s] = i`. Cell 2 m, 256² cells, CAP 24 (6.3 MB). Overflow is counted. Particles are never reordered, because bonds store IDs.
2. `forces`: 3×3 cell gather. Pair force is the particle-life kernel (repel inside 0.8 m, then `K[a][b]` peak at 1.6 m, zero by 4 m) plus a spring for every **reciprocal** bond (Tidemote `holdsBack`). `K = S + h·A`: `S[a][b] = 0.2 + 0.8·E_ab/E_SiO` (Si–O is the strongest pull), `A[a][b] = 0.35·sign(EN_b − EN_a)` (the more electronegative atom chases), `h` = Hunger. Plus slope force `−g·∇h0` (things slide off reefs) and a sea drag `μ_sea` below sea level.
3. `integrate`: semi-implicit Euler, thermal jitter `σ = 0.6·heat·mobility_sea`. Stone atoms get σ × 0.2 and a fixed "downward" bias in screen space. Writes `pos`.
4. `propose`: each atom with a free slot proposes its best free neighbour within 1.4 m. The score is a symmetric hash jitter plus affinity, with an index tie-break. Valence: C 3 (capped from 4, per DESIGN §7 anti-blob), Si 4, O 2, Spark 0.
5. `commit`: bond if `prop[prop[i]] == i` **and** one side has `energy ≥ 1`. That energy came from touching a Spark atom, which is consumed (it flips to Free). **Light therefore sets the bonding rate**, which is visible within 2 s.
6. `breakRust`: per bond, `hash(min,max,tick) < exp(−E_ab/kT_eff)·dt + hyd_sea[a][b]·dt`. `kT_eff = E_backbone/4 · (0.5 + heat)` gives the E/kT 3.5–4.5 sweet spot at mid heat (REPORT §6.3). **Rust:** an Si holding ≥ 2 O bonds flips itself and those O to Stone and drops its other bonds. A C holding ≥ 2 O flips to Gas.
7. `deposit`: a Stone atom deposits when a neighbouring cell has `h0 ≥ h0_here + 0.5` (it touched the aggregate: DLA, Witten & Sander 1981), when it is bonded to a living org's body as a plate and that org dies, or when it is older than 4 s. The deposit is `atomicAdd(h0[c], q·G)` in fixed point (1/1024 m; WGSL atomics are integer-only), strata stamp (§4.3), and then the slot goes free: `freeList[atomicAdd(freeCount,1)] = i`. Gas atoms do `atomicAdd(gasTotal, 1)` and go free, rendered as a rising ring for 2 s.
8. `respawn` (once per frame): free slots are popped by two sources. **Spark rain** at rate `r_L = 40·light` per second, placed through the L0 mask. **Upwelling** in sea cells (`h0 < seaLevel`) at `r_U = 25`/s, with types drawn from the *current* Recipe, plus dissolution: water cells lose `h0` at `0.002·hyd_sea[Si]` m/s and spawn free Si. Atom count is constant. Mass is conserved except for the declared geologic gain.

**Hydrolysis matrix `hyd_sea`** (per-bond attack/s, from REPORT §6.1 with the tuning applied). Water: Si–Si .027, Si–H-ish (folded into Si–Si), Si–C .003, C–C .0006. Ammonia: Si–Si .022, C–C .0006. Methane: all ≤ .001, mobility 0.35 (clamped "slow world", not 0.02). Acid: Si–Si .009, C–C .0001 (÷10), Si–O stone dissolution 0.

**Controls on L1:** Recipe sets genesis and upwelling ratios. Sea sets `hyd_sea`, `μ_sea` and mobility. Heat sets jitter and `kT_eff`. Light sets Spark rain, and so bonding. Hunger sets the antisymmetric pull `h·A`, which makes clusters start to chase within a second. Time sets substeps.
**Rules:** R1 (Si stiff flag, angle springs at 109°/120° for Si, none for C), R2 (rust → Stone/Gas), R5 (`hyd_sea`).
**Hands off:** a bond graph to the L2 sampler, and Stone/Gas to dead matter.

### 3.2 L2: molecules and protocells (CPU sampler, 2 Hz)

Every 0.5 s, `getArrayBufferAsync` reads a **4,096-atom window** (round-robin tiles of the disc, plus every atom within 20 m of the camera centre), with types and bonds. JS does the following in < 3 ms:
- **Components** by union-find. Chain length, ring detection (a component with edges ≥ nodes), branching.
- **Template rule [game, Hutton 2002]:** a chain that is ≥ 4 long and inside a ring (all its atoms within the ring's hull) becomes a *template*. On the GPU, a template atom's `propose` prefers a free atom of its own type within 1.4 m and holds it in a side bond. When the whole side copy is bonded, it unzips (side bonds break with p = 0.5/s). This is the only rule that "knows" about copying, and it is declared.
- **Detectors** (REPORT §6.4 milestones): first bond, chain ≥ 6, ring, replicator (parent and child with the same sequence), chemoton (§3.3).
- **Monitors** (DESIGN §7): largest component 10–200 atoms, ≥ 1 break per 100 bonds per tick, dead fraction < 0.5. If the largest component exceeds 30%, show a hint ("everything's stuck together").
**Seed #2:** if no replicator exists by 0:50, write one 6-ring + 4-chain (types drawn from Recipe, at least 1 Spark) into free slots at the densest living patch. It shows in the honesty box and on the field-guide card ("seeded spark").

### 3.3 L3: organisms (GPU org kernel + CPU decisions)

**Promotion = Gánti chemoton**, checked on the sampler: a ring (membrane) + a copying template inside (information) + a net Spark intake of ≥ 2 Spark over the last 3 s (metabolism). The CPU writes `orgId` into those atoms through a small command buffer (`writeBuffer`, ≤ 256 commands/frame), and appends an org record.

**Org record (64 B, ≤ 2,048):** `centroidFx ivec2` (fixed-point atomic sums), `heading`, `energy`, `genome[3] u32` (≤ 24 symbols × 2 bits plus a length), `speciesId u16`, `atomCount`, `age`, `flags` (sessile, flier, builder).

**Genome = own atom string.** The template chain read from its first atom. Each symbol gives the atom a role (a Life-Engine-style cell grammar):

| Atom in body | Role | Effect |
|---|---|---|
| **C** | mover / muscle | Thrust along the body axis with a phase-offset sine (a CPG), producing an S-wave. Flexible joint, shape-matching stiffness 0.3 |
| **Si** | skeleton | Rigid, stiffness 0.9 (Müller et al. 2005 meshless shape matching, run per org on the GPU). Its thrust is a discrete snap, which reads as clockwork ticking (R1) |
| **O** next to Si | plate | Rusts to a bone stone plate on the body (still attached, zero damage taken through it). Armour, R5 + R10 |
| **O** free end | mouth | Breaks bonds of *other* orgs' atoms it touches with p = `0.6·Hunger`/s. The org gains `E_bond·0.5`. Cannot break stone plates |
| **Spark** | producer / eye | Harvests: each Spark-rain atom touching it gives +1 energy, × exposure (§5). Also an eye (sensing radius 6 m each) and stored glow (R8) |

**Org kernel (GPU, per atom, then per org):** atoms `atomicAdd` their fixed-point position into the org centroid. The per-org pass computes heading and shape-matching targets. Atoms are then pulled towards their goal positions. Steering, the one piece of agent logic (**declared [game]**): turn towards the strongest sensed food (Spark for producers' neighbours, living atoms for mouths), away from bigger mouths, and towards kin when `g(Hunger, .5, .2)` is high (shoals, R10).

**Energy and death:** upkeep `0.02·atomCount·(1 + Hunger·movers)`/s. When energy < 0, or bond HP (sum of remaining body bonds × E) drops below half, the org dies. Its atoms go back to L1 as Free/C/Si/O. Plates and any Si with 2 O become Stone and deposit where the body lay.

**Birth (GPU claim, CAS-free):** the CPU flags orgs with energy > `8·atomCount`. A per-org thread scans its 5×5 cells for free or unbonded atoms of each needed genome type, and claims each with `if atomicAdd(claim[j],1) == 0`. If every type is found within 10 m, the child is bonded in the next frame. If not, the birth fails, and the HUD shows *"no silicon nearby"*. **Recipe availability limits life:** silicon life cannot breed where water has dissolved the Si or oxygen has rusted it all. Mutation: 3% per symbol, swapping in a type drawn from the local free-atom mix. So the soup biases evolution, and a confetti skin is a literal record of it (fauna-08).
**Hands off:** species (by genome hash) to L4, plus stone deposits and occupancy (§4.4).

### 3.4 L4: bodies at the macro LOD (render only)

When camera height exceeds 45 m, or ⏩ is engaged, each species' genome is decoded **once on the CPU** (< 1 ms) by a turtle (Prusinkiewicz & Lindenmayer 1990) into merged low-poly geometry. It is drawn as one InstancedMesh per species at the org centroids, with heading. Atoms of an org dither-fade out over 0.8 s as its mesh fades in. Turtle grammar:

| Symbol | Turtle action |
|---|---|
| Si | Straight segment 1.2 m × scale. Turn ±60° (hex lattice angles). Flat-shaded faceted cross-section |
| C | Arc segment, 40° curvature, round cross-section 1.6× fatter. Sways in the vertex shader |
| O after Si | Bone plate (flattened icosahedron), bone colour |
| O at an end | Magenta frill or mouth cone |
| Spark | Movers: eye (Si: amber dot cluster; C: ink eye with white ring). Sessile: a cap rib (§5) |
| run of ≥ 3 same | Branch off as a limb or trunk. Si runs become dead-straight trunks (eco-09) |

Symmetry: movers mirror the genome bilaterally, sessile orgs use radial ×5. **Scale = (1.6 − heat) × (1 + 0.5·age_norm)** (R6, declared [game]). Colour per segment is the family colour with per-atom jitter (ART_DIRECTION §3), so mixed genomes are patchwork and C/Si alternation is banding (fauna-05).

**Fliers (render-only):** an org with `mass = Si·1.4 + C·1.0 + O·0.8` below `buoyancy = airDensity·(1.2 − heat)` is drawn at altitude `y = h0 + 8 + 20·(buoyancy − mass)/buoyancy`. It is still simulated in the plane. Air density comes from §4.5, so R11 "thick air is a sea" emerges only in cold, gassy worlds.

### 3.5 L0: fields

- **Spark-rain mask** (128² texture, 1 compute pass every 4 frames): a Gray-Scott field (Pearson 1993) with feed `0.03 + 0.03·light`. In bright worlds it saturates to nearly uniform. In dark worlds it breaks into drifting spots, so food arrives in **rare patches** (this drives R8, §5).
- **Atmosphere scalars:** `gasTotal`, `airDensity = base_sea + gasTotal/20k`, `tholin = sea.methane·light·airDensity` (R3), `frostRate = sea.methane·(1 − heat)²`.

**Control effects across stages (first effect ≤ 3 s in bold):**

| Control | L1 atoms | L3 orgs | Dead matter | L4 / field |
|---|---|---|---|---|
| Recipe | **a puff of new-ratio atoms from the origin source + upwelling** | genome mix, plates vs movers | stone vs gas balance | patchwork colour |
| Sea | **palette lerp 1.5 s; Si chains crumble or hold** | HP, mobility | stain colour, dissolution, frost | sky, fog |
| Heat | **jitter amplitude** | upkeep, scale | talus angle, overhang decay | giant vs squat |
| Light | **Spark rain density** | harvest, glow | tholin stain | caps vs stalks, brightness |
| Hunger | **clusters start chasing** | mouth damage, plates, shoals | more corpses, more stone | horns, frills, big eyes |
| Time | **sim speeds up** | generations per minute | geologic gain G | camera rise |

## 4. Terrain and environment

There is **no terrain generator**. The ground at t = 0 is a flat dish floor at y = 0 under a sea plane at `seaLevel = 4 m`. Everything above it was deposited by stone atoms.

### 4.1 Sediment buffers (GPU storage, 256² cells of 2 m)

| Buffer | Type | Meaning |
|---|---|---|
| `h0` | atomic u32, fixed point 1/1024 m | floor height |
| `h2lo`, `h2hi` | atomic u32 | one overhang slab (bottom, top). 0 = none |
| `occ` | atomic u32, decays ×0.9 per s | how many living atoms sat here recently, split into 2 × 16 bits: Spark-bearing, other |
| `lifeTint` | u32, packed RGB8 | running average of the occupants' family colour (eco-07 pink spire) |
| `strata` | u32 × 4 per cell (16 × u8 epoch ids) | one epoch stamp per 6 m band of height |

Total ≈ 1.8 MB. The terrain mesh is a 256² grid whose TSL `positionNode` reads `h0` by `vertexIndex` (no texture copy). Normals use central differences in the vertex stage. The sea is a flat plane in the field colour with a depth-tinted edge where `h0 ≈ seaLevel`.

**Land emerges** when `h0 > seaLevel`. Land cells are "dry": `hyd_sea × 0.2`, mobility × 0.6, and they get full light. So the first reef to break the surface becomes prime habitat for silicon in a water world. Low channels between reefs keep showing the sea as **rivers**, which are white in methane (eco-15).

### 4.2 Arches from stiff bodies (R1 + R6 + R12)

An org's altitude is `max(h0)` under its **Si** atoms if it is stiff (≥ 50% Si), otherwise `h0` under its centroid (carbon sags). A rigid silicon builder whose two ends rest on two spires therefore stays up while its middle hangs over a gap. Stone it sheds there goes into the slab `h2lo..h2hi` at its altitude, not into `h0`. Over generations, colonies that cross the same gap leave a bridge: **an arch is the fossil of a stiff body that kept crossing**. Slabs erode at `0.05·heat²` m/s from below, so they only survive in the cold (eco-04 Frost Arches). Render: a second 256² mesh with top and bottom faces where `h2hi > h2lo`, plus skirts (one extra draw).
**Fallback (declared cheat F1):** if the slab is late, a CPU pass finds pairs of `h0` peaks above 40 m within 30 m of each other, where `occ` is high on both and heat < .35, and lofts a tube arch between them. It is still driven by sediment and occupancy, but it is no longer bottom-up.

### 4.3 Stains and strata (R3)

- **Epochs:** a global epoch counter ticks every 10 s of sim time, and on every Sea change. `epochColor[256]` (uniform array) stores that epoch's stain colour: water iron `#C61807`, methane tholin `#AD603B` × `tholin`, acid sulfur-tan `#E2CF95`, ammonia plum `#5A3B52`.
- **Stamping:** in `deposit`, when the new `h0` crosses a 6 m band boundary, write the epoch id into that band's strata byte.
- **Weathering:** exposed surface stain in the fragment shader is `mix(bone #ECE4D6, epochColor[band], sat((now − bandEpoch)·k_sea·(0.3 + heat)))`. So fresh tips are bone, old bases are fully stained, and **switching Sea mid-run leaves a visible band** (eco-13 rust rings, eco-01 vermilion).
- Fragment cost: 1 storage read + 1 uniform lookup + noise streaks (`mx_fractal_noise_float`, 2 octaves).

### 4.4 Pores and the glow inside them (R8, R12)

Builders shed stone around their membrane ring, not under their centre. Deposits go to the cells under the org's *edge* atoms, while `occ` marks its centre. So an inhabited colony accretes walls with holes where the bodies were, which is honeycomb by construction. In the fragment shader, a cell with `occ_spark > 0` whose `h0` sits more than 2 m below its 8-neighbour mean is a **lit pore**: emissive `2.2 × Spark amber`, with a breathing pulse at each occupant's phase. A Worley term (`mx_worley_noise_float`) adds sub-cell detail inside high-`pores` cells so holes read below 2 m. Glow is always seated in a dark pit (ART_DIRECTION rule 3), for free.

### 4.5 Sky, haze, frost, gas (R2, R4, R11)

- Sky gradient, sun discs, fog colours: the calibrated **palette field from `world-generator` core** (`derive.ts`), with inputs (sea, heat, light). This is render-only (R4 is [game]).
- **Haze density** = `fogBase_sea·(1.2 − heat) + 0.4·airDensity`. Every carbon death literally thickens the air. Carbon worlds stay clean on the ground and hazy above (R2).
- **Tholin:** in methane worlds, `tholin` tints haze towards `#AD603B`, and that epoch's stain goes amber-brown (eco-05).
- **Frost:** `frostRate` deposits a white `snow` term on up-facing cells (normal.y > .7) in the shader, and adds `0.02·frostRate` m/s to `h0` (methane condensing). This is gas sediment falling back.

### 4.6 Erosion

- **Thermal (talus) erosion** (Musgrave, Kolb & Mace 1989) on `h0` every 4 frames, as a **gather** formulation (each cell computes its in/out flow from neighbours, single writer, no atomics). Talus angle = `70° − 45°·heat`. Cold keeps needles and spires. Heat slumps them into mesas and plains (eco-01, eco-10).
- **Dissolution:** water and ammonia sea cells lose `h0` (§3.1 respawn). Undercut stacks with a broad cap emerge at the waterline (eco-06).
- **Dunes (stretch):** Werner 1995 slab CA on dry cells when heat > .7, with fixed wind. Gives hot-desert ripples. Cut first if short of time.
- **Canyons:** *not built*. No hydraulic erosion. eco-10 is partial (§8).

### 4.7 Scale and the geologic gain (declared cheat C1)

At G = 1, a 49k-atom world holds roughly 20k stone deposits, about 0.3 m per cell on average. That is enough for white lace and islands by 1:25, **not** for 80–220 m spires. ⏩ raises G from 1 to 40, and adds a **population shed term**: every builder org deposits `0.01·Si·G` m/s at its edge cells without spending atoms. This breaks mass conservation, and we say so: *"fast-forward is ten thousand years of the same rules"*. Where the stone goes is still decided entirely by where life lived.

## 5. Flora (producers)

A producer is any org whose genome has no C movers in mover positions. It flags itself **sessile**, stops steering, and anchors (vel = 0). It earns energy by harvest:

`harvest = Σ_Spark-cells (sparkRainHits) × exposure`,  `exposure = 1 − shade`, where `shade` = the summed cap area of taller sessile orgs within 6 m (CPU, coarse 64² grid, 2 Hz).

- **Caps (R7):** a sessile org's L4 mesh draws its *terminal* Spark run as cap ribs. Cap radius = `1.2 m × ribs × scale`, and cap area counts against neighbours' exposure. Under bright, uniform rain, genomes ending in long Spark runs out-shade and out-breed the rest, so **parasols are selected, not drawn** (eco-05, 06, 08). The grammar is fixed, but which genome dominates is emergent.
- **Stalks:** height = `segments × 1.2 m × scale + 0.6·age`. Crowding adds a height bonus (taller wins light), so dense carbon colonies under bright light stack into **living pillars** (eco-03). Pure Si trunks are dead-straight (eco-09). C trunks curl (flora-01 swirl tree).
- **Glow (R8):** in dark worlds the Gray-Scott mask breaks rain into rare patches. Spark atoms in a body bank energy (each Spark cell stores up to 4). Orgs with many Spark cells survive the gaps. Banked energy renders as emissive `1 + 1.5·bank/4` on the Spark cells, so dark worlds fill with glowing cups and stalks (eco-04, 12, 15). Glow hue is the family colour of the Spark cell's bonded neighbour: pink for O, cyan for Si (R9).
- **Geometric vs curved:** Si-heavy producers come out as stacked hex domes, crystal trees and frost fans. C-heavy producers come out as curls, mushrooms and soft domes (R1). A cap's shape follows its rib atoms.
- **Spots:** Si inside a C producer's genome rusts in place and shows as bone flecks on coral caps (eco-08).

## 6. Fauna

Movers are orgs with ≥ 2 C mover cells (or Si snap cells). Everything below follows from the role table in §3.3 plus selection.

- **Grazers:** a mouth plus movers. They eat sessile atoms (cheap, unarmoured). At high Hunger, lineages with Si–O plates lose fewer atoms to hunters and win: **plated hoppers and rhino-lizards** (fauna-02, 06). Three colourways of one genome arise from mutation drift (fauna-02).
- **Hunters:** many movers, ≥ 2 mouths, and eyes in front. Sensing range is 6 m per Spark eye, so more eyes means better hunting. Selection grows the eyes, and the L4 grammar draws a cluster of 4 or more eye cells as **one big glossy eye** (fauna-06, ART_DIRECTION §5). O runs at body ends become **frills and horns** (R10). An alternating C–Si genome is banded (fauna-05).
- **Shoals:** the kin-pull term peaks at medium Hunger (`g(h, .5, .2)`). Same-species movers align and cluster (a boids alignment term in the org kernel, Reynolds 1987), giving orange carbon fish in teal water (eco-11).
- **Eyes:** Si orgs get amber dot clusters (emissive 1.2), C orgs get ink-and-white ring eyes on the leading atom. Blink is scale-y 0 for 80 ms every 3–6 s (render-only, ART_DIRECTION §5).
- **Motion:** C orgs ripple (CPG sine through the shape-matching goals). Si orgs tick (thrust in 0.15 s pulses, no squash). The difference is R1, visible in motion as well as shape.
- **Giants and fliers:** cold raises the scale (§3.4) and gas plus cold raises buoyancy. Light C-heavy bodies in thick cold air drift up as sky whales and jellies (fauna-03, 09). The altitude is render-only.
- **Black survivors:** in hot, bright, old worlds, C bodies darken with a char term `sat(heat·light·age·c·6)` in the shader (world-generator `char`), giving eco-01's horned black figures.

## 7. Ecosystem dynamics

**Energy is Spark, and Spark is atoms.** Light rains Spark atoms. Bonding spends them. Producers bank them. Mouths take bond energy from other bodies (an efficiency of 0.5 means each trophic step loses half). Upkeep returns spent Spark as Free slots for the next rain. There is no hidden food counter, so the HUD's Spark-in-flight count is an honest energy budget.

**Matter cycle:**

```
genesis / upwelling ──► free atoms ──bond──► chains ──template──► orgs ──die──► free atoms
                                │                          │
                         Si+2O  ▼                   C+2O   ▼
                      Stone ──DLA──► h0 / h2 (land, reef, arch) ──dissolve (water)──► free Si
                      Gas ───────► airDensity (haze, buoyancy) ──frost (methane, cold)──► h0
```

**Trophic levels:** producers (sessile + Spark cells), then grazers (mouth + movers on sessile prey), then hunters (mouths on movers). Decomposition is chemistry itself: dissolution and rust. A CPU population chart (per species role, 2 Hz) drives the field guide and the "3 trophic levels" milestone (REPORT §6.4, target 2:45).

**Succession, emergent with typical timing at mid settings:**
1. **Pioneer soup** (0:10–0:50): carbon chains in water, silicon chains in acid or methane.
2. **First copiers** (0:50–1:10): promotion. Their composition is whatever survived the sea.
3. **Builders** (1:00–1:40): Si+O orgs shed stone. Reefs rise where they live, and the first land appears.
4. **Colonisers of land** (1:25+): land cells are dry and bright, so producers anchor on reef tops (eco-06 caps on stacks).
5. **Consumers** (1:40+): grazers, then hunters at Hunger > .3. Plates and big eyes spread over about 6 generations (1 generation ≈ 8 s at G = 1).

**Collapse modes, all readable through ART_DIRECTION rule 1 (colour = alive):**
- **Rust-out** (O-heavy Recipe, high heat): every Si ends as stone. The world goes bone, then stains red. It's eco-01/10, the warning world, with the "dead fraction" visible as whiteness.
- **Gel** (low heat): bonds never break, everything fuses, and the anti-blob hint fires. This is a museum.
- **Dust** (Si in water): chains dissolve before promotion. The puzzle lock tells the player to change the Sea.
- **Overshoot** (Hunger high, light low): hunters eat the producers, crash, and the population chart oscillates. The corpses become reef, so even a crash builds terrain.

## 8. Atlas coverage

Settings from WORLD_ATLAS §5.3. "Reached" means the mechanism above produces the pin's defining features with no preset placement.

| Pin | Status | Mechanism |
|---|---|---|
| eco-01 Vermilion Eclipse | **reached** | Si+O + hot → rust-out; water-epoch iron strata; talus slump → flat plain with remnant spires; char survivors with O-end horns (fierce). Eclipse sky is render-only |
| eco-02 Violet Sun Hollow | **reached** | Acid keeps Si+O orgs alive; cyan+magenta patchwork reads violet (R9); Si producers decode as branching crystal trees; plated beetle grazers + spiked hunter (bright, medium Hunger); pores give the cratered rock |
| eco-03 Sindha pillars | **partial** | Carbon producer colonies stack into living pillars under crowding + bright light, in teal water. Missing: pillar *tiering* is only a height bonus, and fliers need cold air, so water-world "fliers" are swimmers drawn mid-water |
| eco-04 Frost Arches | **reached** | Stiff Si builders bridge → `h2` slabs survive in cold; methane frost on up-facing stone; O-pink glow cups in the dim. This is the signature mechanism |
| eco-05 Parasol Giants | **reached** | Cold scale × light-selected terminal Spark caps on C stalks; methane + light → tholin haze and amber-brown strata |
| eco-06 Capped Sea Stacks | **reached** | C+Si: Si rusts into reefs that break sea level, water undercuts them into stacks, C producers anchor on the dry bright tops. Waterfalls not reached |
| eco-07 Two Suns Spire | **reached** | Balanced recipe at Goldilocks gives the most species; tall spire from long-lived builder colony; `lifeTint` stains it pink from O-rich occupants; spores = free atoms as motes. Two suns are render-only |
| eco-08 Coral Forest | **reached** | C producers in methane cold → giant slow caps; Si in genome rusts to bone spots on caps; frost ground |
| eco-09 Violet Hunter | **reached** | Ammonia violet field; Si runs decode as straight trunks; Si hunter with many eyes + O-rod "feathers" at fierce Hunger; honeycomb caps from pores |
| eco-10 Red Canyon | **partial** | Hot + very old Si+O → stained plain, mesas and one surviving builder colony with a cap. Missing: the canyon (no hydraulic erosion) |
| eco-11 Kelp Shoal | **reached** | C producers at medium light → tall trunks with small caps; medium Hunger kin-pull → orange shoals |
| eco-12 Glow Garden | **reached** | Very dim → Gray-Scott patchy rain selects Spark-banking stalks that glow cyan; Si survives in water as Si–C hybrids (Si–C hydrolysis is low); green field is the palette field's dim-water anchor. Risk: Si-leaning orgs may still dust out, so tune `hyd[Si–C]` |
| eco-13 Living Arch | **partial** | Ammonia + very old: arch from bridging builders, rust-ring strata bands, plum O-rich shrubs living on it. Missing: it's terrain with residents, not one creature that *is* the landscape |
| eco-14 Bone Reef | **reached** | Si+O in acid: DLA reef walls around colonies, pores where bodies were, amber occupancy glow in dim light. This is the purest expression of the philosophy |
| eco-15 Lantern River | **reached** | Methane low channels between dark old reefs read as a white river; pink glowing O-rich producers on the banks; free O atoms drift as pink motes |

**Ecosystems: 12 reached, 3 partial, 0 not reached.**

| Fauna | Status | Mechanism |
|---|---|---|
| fauna-01 Giants | reached | Si + cold scale, straight limbs, amber dot eyes |
| fauna-02 Rhino-lizards | reached | Si–O plates selected at medium Hunger, mutation colourways |
| fauna-03 Jellybots | partial | Light Si drifter lifts in cold thick air. Bell membrane is the radial ×5 grammar, so tendrils are crude |
| fauna-05 Frilled serpent | reached | Alternating C–Si genome = banding; O ends = frills; hunter |
| fauna-06 Plated hopper | reached | Plates + eye cluster ≥ 4 → one big eye |
| fauna-07 Hammerhead strider | partial | Tall thin via cold scale. No T-head rule |
| fauna-08 Confetti eels | reached | Mixed genome; every segment keeps its family colour + jitter |
| fauna-09 Sky whales | partial | Buoyancy lift is render-only and C bodies are chains, not whale silhouettes |

## 9. Build plan

**Reuse from `mockups/worlds` core:** renderer bootstrap, `RenderPipeline` + bloom, palette field (`derive.ts`), sky, fog node, world material (+ `isGlass`), tweakpane. **Not reused:** landforms and niche-placed flora. They contradict this philosophy. The flora meshes could be emergency skins (cheat F2, §10).

### 9.1 Modules

| Module | Side | Contents |
|---|---|---|
| `sim/atoms.ts` | GPU | atom buffers, kernels 1–8 (§3.1), K/hyd matrices as uniforms |
| `sim/sediment.ts` | GPU | `h0 h2 occ lifeTint strata`, deposit, talus gather pass, dissolution, frost |
| `sim/fields.ts` | GPU | Gray-Scott 128² rain mask, atmosphere scalars (atomic counters read at 2 Hz) |
| `sim/orgs.ts` | GPU | centroid atomics, shape matching, CPG thrust, steering, mouths, birth claims |
| `cpu/sampler.ts` | CPU | 2 Hz readback, union-find, ring/template/replicator/chemoton detectors, monitors, promotion commands, seed #2 |
| `cpu/species.ts` | CPU | genome hash → species, turtle decode → merged `BufferGeometry`, Latin-ish names, field guide |
| `render/atoms.ts` | GPU render | 1 InstancedMesh (beads, Si faceted via `isGlass`) + bond capsules (N×4 instanced, hidden if empty) |
| `render/terrain.ts` | GPU render | 256² `h0` mesh, `h2` slab mesh, sea plane, strata/stain/pore/frost fragment |
| `render/bodies.ts` | GPU render | ≤ 64 species InstancedMeshes, eyes, blink, flier lift, dither LOD crossfade |
| `camera/powers.ts` | CPU | milestone-driven path: 30 m top-down → 90 m → 300 m → orbit-tilt to 1.7 m eye level |

### 9.2 Budgets (demo Mac, Apple Silicon, Chrome WebGPU)

| Item | High | Low tier |
|---|---|---|
| Atoms | 49,152 | 24,576 |
| Substeps per frame | 2 (⏩: 3) | 1 (⏩: 2) |
| GPU sim time | ≤ 6 ms (8 light kernels; forces dominate at 9 cells × ≤ 24) | ≤ 3 ms |
| Sediment passes | deposit per substep, talus every 4 frames, 256² | 128² |
| Orgs / species | 2,048 / 64 | 512 / 32 |
| Draw calls | atoms 2 + terrain 3 + bodies ≤ 64 + sky/sea 2 | bodies ≤ 32 |
| Readback | 4k atoms × 24 B + stats, every 0.5 s, async | same |
| Memory | ≈ 12 MB storage | ≈ 7 MB |

### 9.3 The 16-hour order (3 people: P1 sim, P2 terrain + render, P3 CPU + orgs)

| Hours | P1 (GPU sim) | P2 (terrain, render) | P3 (CPU, orgs) |
|---|---|---|---|
| 0–1 | Agree buffer layouts in `contracts.ts` (§3.1, §4.1). Bring the world-generator core into the app. | | |
| 1–3 | bin + forces + integrate at 24k; genesis spray | bead + bond render, pixel loader, palette per sea | sampler readback + union-find + monitor HUD (`#debug`) |
| 3–5 | propose/commit/break, Spark activation, rust, hydrolysis; tune to monitors | `h0` deposit + DLA rule, terrain mesh, sea plane | detectors (chain, ring, replicator), seed #2 |
| 5–7 | respawn (rain, upwelling), Gray-Scott mask | strata epochs + stain, talus erosion, camera path v1 | template side-bond rule on GPU with P1 |
| **7–8** | **H8 checkpoint: cheapest demo path** (below), 3 clean runs, ≥ 50 fps | | |
| 8–11 | org kernel: centroid atomics, shape matching, CPG, steering | pores from `occ`, lit-pore emissive, frost, haze from gas | chemoton promotion, org records, eyes on promoted rings, discovery plate (2D card) |
| 11–13 | mouths, upkeep, death → deposit; birth claims | `render/bodies.ts` + LOD crossfade | `species.ts` turtle decode, naming, field guide |
| 13–15 | Hunger terms, kin pull, sessile harvest + shade (with P3) | geologic gain G + population shed, camera rise polish | population chart, 3-trophic milestone |
| 15–16 | perf pass, low tier | discovery shot (render target version) | demo preset + timing fallbacks |
| stretch | `h2` arches (else fallback F1), Werner dunes | flier lift, char | sound hooks |

**Cheapest demo path (H8):** pixel → genesis → bonds → silicon crumbles in water → Sea to Acid → white DLA lace → islands break the sea → ⏩ rise to eye level over stained, banded, slumped or spiky sediment. No organisms yet, but it already proves *"the land is made of your chemistry"*. Everything after H8 adds life on top of a demo that already works.

**Fallback ladder:** (1) If the GPU org kernel slips, run ≤ 500 orgs on the CPU and write their atoms' target positions with `writeBuffer` (≈ 80 KB/frame). (2) If promotion doesn't fire reliably, lower the chemoton intake bar to 1 Spark/3 s and seed at 0:40. (3) If the turtle LOD slips, keep atoms visible at macro scale as beaded bodies with eyes, at 3× bead size.

## 10. Honesty box

**Seeds**
| # | What | Why |
|---|---|---|
| 0 | One Spark atom at the origin (the first pixel) | Hard constraint |
| 1 | Genesis spray: 49k atoms over 4 s, ratio = Recipe | Without it the pixel would need minutes to fill the dish |
| 2 | One copier ring + template, dropped at 0:50 only if none has emerged | Spontaneous replicators won't arise in 3 minutes (REPORT §6.4). Card says "seeded spark" |
| 3 | **The Source:** the origin stays a faint vent. On a Recipe change it puffs 600 atoms at the new ratio within 0.5 s | Makes Recipe visible within 3 s. Upwelling alone takes 10–20 s to read |

**Scripted beats:** the camera path (milestone-triggered: atom front > 40 m, first land, ⏩ pressed; with time fallbacks 0:35/1:30/2:00); discovery shots (time scale 0.2, plate); hint text after 45 s stuck; epoch tick every 10 s.

**Declared [game] rules (local, but invented):** template side-bond copying; org steering (turn to food, away from mouths, towards kin); kin pull peaking at medium Hunger; harvest × exposure shading; body scale `(1.6 − heat)`; altitude of stiff bodies = max under Si atoms (the arch rule); Spark-cell energy banking; the turtle grammar mapping symbols to shapes.

**Cheats**
- **C1 geologic gain.** ⏩ multiplies deposits up to ×40 and adds a population shed term that creates stone without spending atoms. Breaks mass conservation. Placement stays emergent.
- **C2 sampler window.** Promotion only sees ~4k atoms per 0.5 s, so a ring outside the window waits up to 6 s.
- **F1 arch fallback.** A CPU peak-pair detector lofts tube arches if the `h2` slab rule is cut.
- **F2 skin fallback.** If the turtle LOD fails, world-generator flora meshes could be used as skins keyed to genome class. That would be "species from a list" and **breaks hard constraint 2**. Use only to save the demo, and say so.

**Render-only fakes:** sky, sun discs, eclipse, palette field (R4 is [game]); flier altitude; eyes and blink; char darkening; glow emissive amounts; Worley pore micro-detail; frost shading; gas rings; motes are real free atoms but drawn as sprites at macro scale.

**Unknowns (test first)**
1. Will chemoton promotion fire before 0:55 without seed #2? Expect no in water and maybe in acid. Measure.
2. Bin overflow at genesis density: the spray starts at r = 0 m. Mitigation: spawn on a ring of radius 8 m expanding to 60 m, and count overflow.
3. Is DLA lace readable at 2 m cells? If it's blobby, deposit sub-cell into a 512² `h0` (4 MB) at high tier.
4. Selection speed: about 6 generations by 2:20. Caps or plates may not dominate in time. Mitigation: ⏩ also scales generations (fewer upkeep seconds per sim second). Do *not* bias mutation.
5. LOD crossfade continuity: turtle bodies won't match bead layouts exactly. A 0.8 s dither hides most of it.
6. `h2` slabs may read as floating plates rather than arches. Mitigation: skirts + talus on slab tops.
7. Unverified r187: `positionNode` reading a storage buffer by `vertexIndex` on the terrain mesh. Smoke-test in hour 1.

## 11. Iteration log

### Round 1: "Pure atoms"
**Proposal.** A full 3D atom sim (131k atoms). Stone atoms stack physically into reefs and spires as rigid particles. Organisms are only bonded clusters. No promotion, no meshes, no heightfield. The camera stays at microscope scale, and terrain is literally piled stone atoms. Controls act only on L1.

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 5 | 4 | 2 | 2 | 1 | 3 |

**Critique.**
- *Chemistry 4:* Light and Hunger barely reach the terrain, and nothing turns them into caps or glow.
- *Atlas 2:* 131k atoms of 1 m stack into at most a few 10 m mounds, so no 80–220 m spires, no giants, no sky. Arches need overhang physics. 3 reached at best (eco-14 lace, eco-01 dust, eco-06 islands).
- *Spectacle 2:* after 0:30 it's a bead soup, and dead stone eats the particle budget, so the world gets **less** alive as it ages. There's no eye-level wonder and no discovery shot scale.
- *Feasibility 1:* 3D bonding with stacking contact for 100k+ particles is beyond 16 hours and beyond 50 fps. Stone atoms never leave.
- *Intuitive 3:* after genesis, Recipe does nothing visible, and Time only speeds up a blur.

**Revise (lowest first: F, then A/S).** Drop to a **2D atom plane**, and **retire dead stone into a heightfield** so the budget recycles. Mass is conserved through upwelling. Add chemoton promotion so life gets bodies.

### Round 2: "Sediment heightfield + promotion"
**Proposal.** 2D sim. Stone retires through DLA into `h0`. Sea level gives land. Orgs are promoted (genome = atom string) and drawn as beads with eyes. Camera top-down throughout.

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 5 | 4 | 3 | 3 | 3 | 3 |

**Critique.**
- *Atlas 3:* a heightfield can't overhang, so no arches (eco-04, 13, 15). Beaded bodies have no caps, trunks or big eyes. About 7 reached.
- *Spectacle 3:* the top-down micro view looks like every particle-life demo (seen-before against Tidemote). At G = 1 the land is under a metre high at 3:00.
- *Chemistry 4:* stains are a single per-cell colour, so changing the Sea rewrites history instead of layering it. Light has no flora effect.
- *Feasibility 3:* fine as scoped, but organism ecology on GPU is undetailed (births? races?).
- *Intuitive 3:* Recipe after genesis is still invisible for 10–20 s. Time is unclear.

**Revise (A and S tie, then I).** Add a **turtle LOD** (genome → body mesh) and an **eye-level camera rise**. Add **geologic gain** C1 and the population shed term. Add **strata epochs**, so a Sea change leaves a band. Add **stiff-body arch slabs** `h2`. Add harvest × exposure (caps) and Spark banking in patchy rain (glow). Add the Source puff (seed #3) for Recipe. Add CAS-free birth claims.

### Round 3: "Powers of Ten"
**Proposal.** As §§2–8, plus Werner dunes, hydraulic river erosion, flier lift, and a 3D render-target discovery shot. Orgs fully on GPU.

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 4 | 5 | 4 | 4 | 2 | 4 |

**Critique.**
- *Emergence 4:* there are now 4 seeds, a scripted camera and a fixed turtle grammar. Each is local or declared, but the macro look leans on the grammar.
- *Atlas 4:* 12 reached. eco-10 canyon, eco-13 single creature and eco-03 tiering are partial.
- *Spectacle 4:* the risk is the 1:10–1:45 stretch (beaded orgs multiplying) reading slow. Also, LOD popping could break the rise.
- *Feasibility 2:* scope ballooned. Hydraulic erosion, dunes, `h2` slabs, GPU births, shape matching, turtle LOD, fliers and a render-target shot don't fit 16 hours for 3 people. There's no H8 demo without orgs.
- *Intuitive 4:* the Time ⏩ camera move surprises first-timers ("did I break it?").

**Revise (F).** Cut hydraulic erosion (accept eco-10 partial and use sea-level channels for rivers). Move dunes, `h2` and fliers to **stretch**, with fallback F1. Make the **H8 demo path org-free**. Add a fallback ladder (CPU orgs, earlier seed, beads at macro). Add 24k low tier. Add the hour-1 smoke test for `positionNode` storage reads. Time: label ⏩ "fast-forward ten thousand years" and keep the rise milestone-triggered so the presenter controls it.

### Round 4: "Sediment, scoped"
**Proposal.** The design as written (§§1–10).

| E | C | A | S | F | I |
|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 4 | 4 |

**Critique.**
- *Emergence 4:* seeds #1–#3 and the scripted camera remain, as do the [game] steering and grammar. Promotion probably needs seed #2 in most runs.
- *Chemistry 4 (down from 5):* with dunes on stretch, Heat's effect on hot terrain rests on talus slump alone. Light acts on terrain only through tholin (methane worlds). It's still visible on every *living* stage.
- *Atlas 4:* 12 reached + 3 partial, short of the 13 needed for a 5. If `h2` slips to the fallback, eco-04/13/15 arches become cheat-driven.
- *Spectacle 4:* genesis, first land, the rise and the strata reveal are four strong beats. The mid-arc remains the weak stretch. Mitigation: the first-organism discovery plate lands at 0:55, and predation starts by 1:45.
- *Feasibility 4:* the H8 path is about 7 person-hours of well-specified kernels on a proven scheme (REPORT §6.5). Orgs + LOD (H8–15) is the real risk, mitigated by the fallback ladder.
- *Intuitive 4:* every control has a first effect within 3 s (§3.5 table). The second step ("dead life becomes land") is surprising but explainable afterwards, which is the DESIGN §1 goal.

**Stop.** Every criterion is at 4. What stays short of 5: atlas coverage (canyon, single-creature landscape, tiered pillars) and chemistry fidelity on terrain for Light and Heat, if the stretch items are cut.

**Sources used:** Witten & Sander 1981 (DLA, *Phys. Rev. Lett.* 47:1400); Werner 1995 (slab dune model, *Geology* 23:1107); Musgrave, Kolb & Mace 1989 (thermal erosion, SIGGRAPH); Müller et al. 2005 (meshless shape matching, SIGGRAPH); Prusinkiewicz & Lindenmayer 1990 (*The Algorithmic Beauty of Plants*, turtle interpretation); Reynolds 1987 (boids); Pearson 1993 (Gray-Scott patterns, *Science* 261:189); Hutton 2002 (typed bonds, templating); Gánti 2003 (chemoton); The Life Engine (cell-role grammar); REPORT §6.1–6.5 (tuning, CAS-free bonding).
