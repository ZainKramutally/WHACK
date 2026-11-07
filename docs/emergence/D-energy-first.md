# Emergence design D: Follow the Energy
> Starting philosophy: the single pixel is the first Spark, a mote of energy hitting a barren world; everything after is energy finding ways to flow and be stored, and chemistry sets the prices.  ·  Final scores: E4 C4 A4 S5 F4 I4

## 1. The idea in one paragraph

The world is one energy economy, and you can watch it. **Amber always means energy**, in every stage. The first frame is one amber pixel: a meteor of pure Spark falling on a dark, unlit, airless dust plain. Its impact wave **reveals the world by lighting it** (visibility = energy), throws the dust into a crater rim, and boils off the first gas that becomes the sky. Before any organism exists, energy and solvent make a **Gray-Scott "kindling" tissue** along the crater lake's shore: glowing spots that feed, divide and starve (Pearson 1993). Spots that hold out long enough are **promoted** into organisms, and the atoms under them become their genome. From there it is a Life-Engine-style economy on a hex grid. Every body is a chain of atom **codons** (the 6 element pairs C·C, Si·Si, C·Si, C·O, O·O, Si·O), and each pair's real chemistry sets its job and its price. C·C is a light-catching leaf, because conjugated π bonds absorb light. Si·O is a bone plate, because it is the strongest bond and stores nothing. Producers, grazers, hunters and decomposers are not types. They are **whichever genomes turn a profit** at the current prices: Light sets income, Sea sets leak, Heat sets turnover, Hunger sets how cheaply energy can be stolen, and Recipe sets what the ground can supply. Every energy transfer is drawn as a moving **amber thread**: from the sun into leaves, from leaf to grazer, from grazer to hunter, and from corpse to decomposer. The food web is literally visible. Terrain is the **waste heap** of this economy. Silicon dies to stone and carbon dies to gas, so silicon worlds pile up fossil stalks (spires), fused canopies (arches) and pitted reefs, while carbon worlds stay clean and hazy. Rain off the crater rim carves rivers, and age stains it all.

## 2. The bloom: pixel → world timeline

Demo preset "Earth-ish → Silicon city" (§9). Time is wall-clock at Time = ▶. The sim runs at 10 Hz in sim ticks.

| t | What the player sees | What is actually simulated | Emergent / seeded / scripted |
|---|---|---|---|
| 0:00 | Black screen with one amber pixel, pulsing at 1 Hz. Audio: low hum. | Nothing yet. 64k dust particles exist but are unlit (emission = 0). | **Seeded**: the Spark (E₀ = 10⁴ units) and the dust plain (64k atoms, C:Si:O = Recipe). The plain's base fBm height comes from the seed. |
| 0:02 | The pixel streaks down and hits. A white flash, then an **amber ring** races outwards. Wherever it passes, grey dust appears, *because it is lit*. | The GPU energy field `E` (512²) gets a delta pulse and spreads by damped wave + diffusion. Dust emission = smoothstep(E). Dust gets a radial impulse ∝ E gradient and comes to rest with friction. | **Emergent** reveal and crater rim (the dust piles up where the impulse dies out). **Scripted**: the impact moment. |
| 0:05 | A crater with a raised rim. Bone-white glints where the heat front passed through Si+O dust. White gas rings rise where it passed through C+O. | Dust with E > E_fuse reacts. Si+O becomes stone, splatted into the stone field `S`. C+O becomes gas, which adds to the global `C_gas`, and rising rings are spawned. | **Emergent** (R2, from the first second) |
| 0:08 | The sky goes from black to a faint sea tint as the gas column thickens. Drizzle falls on the rim and runs inwards. The crater floor fills with the sea's colour. | Sky colour = mix(black, sea palette, sat(C_gas + vapour)). An airless sky is black [sci]. Sea level = 40% of rim height. D8 flow accumulation on the 128² height grid gives river channels. | **Emergent** sky density and rivers. **Seeded**: the sea's liquid volume (it comes with the Sea choice). |
| 0:12 | **First dawn.** The sun rises, and amber light-motes start raining down. | `Light` income starts (a 3 s ramp). | **Scripted beat**: the planet turns. The sun is the Light control, not the pixel. |
| 0:15 | A **ring of glowing tissue** blooms along the wet shoreline: spots in the recipe's tint, round in carbon recipes and faceted in silicon ones. Some divide like cells. | Gray-Scott on 512² (GPU). The feed F comes from Light + the ember, the kill k from Sea leak + Heat. It needs both solvent (the wet mask) and energy. | **Emergent** (pattern formation). The control → (F, k) map is designed. |
| 0:25 | In hostile settings (Si in water), the spots grow and then fade, turning into bone specks. | Kill k is high, and dying spots deposit stone. | **Emergent** (the DESIGN §3 lock 1, shown before life even exists) |
| 0:35 | One spot "hardens": a short bead chain appears in it and starts drifting. A soft chime. | **Promotion**: a spot that persists ≥ 6 s with V̄ > 0.25 becomes an agent. Its genome = 4–8 atoms sampled from the dust under the spot. | **Scripted threshold** (a chemoton stand-in). The **genome is emergent** from local matter. Safety net: forced promotion at 0:45. |
| 0:45 | **Discovery shot #1**: "first life". The first organism's specimen plate. | Field-guide naming from the codon composition | Scripted presentation of an emergent organism |
| 0:50–1:15 | Producers multiply. Amber threads run from the sky into coral frills. Lineages drift in colour. Some stop swimming, **root, and grow upward**: stalks and caps. | CPU agents (10 Hz). Mutation on copy. Agents that lose their fins anchor and become plants. Plants spend surplus on cap (leaf) or height (rod), whichever returns more. | **Emergent** sessility and form (R1, R7) |
| 1:15 | **The first theft.** An amber thread jumps *from* a frill *into* a small mouthed drifter. HUD: "grazer". | A mouth cell (C·O) next to a foreign leaf takes energy × ε_m. The lineage ledger classifies trophic level. | **Emergent**. Mouths were in the gene pool from the start, and they pay once producer density crosses a threshold. |
| 1:45 | A banded, spiked, eyed thing chases grazers. Threads run grazer → hunter. Grazers bunch into shoals. | Spike (O·O) + mouth + fins. Prey-sensing within radius r. Boids flocking under threat, weighted by Hunger. | **Emergent**. Safety net: a directed O·O insertion at 1:50 if there is still no level-3 lineage (declared). |
| 2:05 | Corpses dim. Small mouth-only crawlers work them, and threads flow corpse → crawler. Stone heaps grow at the shore. | Death writes detritus `D` and stone `S`. Agents with only a mouth profit on `D`. | **Emergent** decomposers |
| 2:15 | The player switches Sea to Acid and drags Recipe to Si+O. The sky turns lemon in 1.5 s. Cyan rods grow and frills wither, and silicon life starts to win. | Leak table swap. The supply mechanic withers cells whose element is scarce. | **Emergent** (R5) |
| 2:25 | **⏩ Time.** Fossil stalks stand up as bone spires. Neighbouring canopies fuse into arches. Stone stains. Rivers cut channels. Pores light up amber where crawlers live. | Tick rate ×8, stream-power erosion, stain age, fossilisation on death | **Emergent** (R2, R3, R6, R12) |
| 2:45 | **Discovery shot #2**: the camera drops to eye level under a giant, with a tiny human and dog. The ledger shows 4 trophic levels. | Render-target specimen plate | Scripted presentation |

## 3. Stages in detail

### Stage 0: the Spark and the dust plain (0:00–0:08)

- **State.** `E` energy field, 512² `rgba16f` storage texture (r = E, g = dE/dt, b = wet mask, a = heat). `dust`: 64k particles, a `vec4 pos+type` and a `vec4 vel+lit` buffer. `S` stone field, 128² on the CPU and mirrored to the GPU.
- **Local rules.** (1) A damped wave in `E` (`E_tt = c²∇²E − γE_t`, 2 substeps per frame) gives a crisp expanding ring, then a diffusion tail. The residual at ground zero is the **ember**: a slowly decaying geothermal hotspot with half-life 120 s × Time. It is the only energy source in dark worlds. (2) Dust: `vel += κ·∇E·dt`, friction 0.9 per frame, and the particle sleeps when |vel| < ε. Sleeping particles splat into a height grid, so the **crater rim builds itself** where the impulse runs out. (3) Fusing: when the local E > E_fuse, Si+O pairs in a bin (atomicAdd bucket count, REPORT §6.5) become stone, and C+O pairs become gas. Only counts, no bonds.
- **Control hooks.** Recipe sets the dust mix. That decides the **first terrain**: an Si+O recipe gives a bone-glinting rim, a C+O recipe gives a gassy, hazy rim. Heat sets E_fuse (a hot world fuses more, so more early stone). Sea sets the liquid colour of the basin fill.
- **R-rules.** R2 (in second 3), R4 (the sky forms out of waste gas).
- **Hands off:** a wet shoreline mask, the ember, and an initial `C_gas` and `O_air`.

### Stage 1: Kindling, proto-metabolism before life (0:15–0:40)

- **State.** Gray-Scott `U` (free energy and substrate) and `V` (charged-chain density), 512² ping-pong storage textures, 8 iterations per frame.
- **Rules.** `U_t = D_u∇²U − UV² + F(1−U)` and `V_t = D_v∇²V + UV² − (F+k)V`, active only where wet > 0.
  - F = 0.018 + 0.03·Light_eff, where Light_eff = Light·dawn + ember.
  - k = 0.045 + 0.02·leak(Sea, Recipe) + 0.01·(Heat − 0.5).
  - This sweeps the classic regimes: holes and labyrinths at high F (bright, crowded), **self-replicating spots** near (0.037, 0.064) (Pearson's "mitosis"), and decay at high k (hostile sea).
- **Chemistry in the kernel.**
  - **Recipe sets anisotropy.** The Laplacian is a weighted 6-neighbour hex stencil. Silicon fraction raises the weight on 3 lattice axes (`w = 1 + 1.5·si` on the axes, 1 off them), so Si-rich kindling grows **faceted, straight-edged** spots. Carbon kindling is isotropic and stays round. That is R1, visible *before life*.
  - **Tint** = the recipe colour mix (R9). Emission = V·E_local, so the tissue only glows where energy flows.
- **Promotion (the hand-off).** Every 0.5 s a 32² max-reduce of V (one compute pass, `getArrayBufferAsync`) tracks blobs. A blob that keeps V̄ > 0.25 for ≥ 6 s, at ≤ 1 promotion per 2 s, spawns an agent. Its genome is 4–8 atoms drawn from the **dust composition under the spot**, so on the shore of an Si+O rim the first organisms are silicon-rich. The spot is then bleached (`V *= 0.2`) so it doesn't spawn again.
- **R-rules.** R1, R5 (the hostile sea kills the kindling), R9.

### Stage 2: Organisms, a hex-grid energy economy (0:35 onwards)

**World.** A 256² hex tile grid (1 tile = 1 m in render). `occ: Int32Array(65536)` holds a cell id or −1. Agents are capped at **1,024**, with **≤ 24 codons** each (~20k cells max). The CPU steps at 10 Hz (×8 under ⏩, with a 30 ms budget, and drops to ×4 if over).

**Genome.** A string of 4–48 atoms from {C, Si, O}. It is read as non-overlapping pairs, and each pair is one **cell**:

| Codon | Cell | Why (chemistry → economics) | Capacity (bond kJ/100) | Upkeep ×u₀ | Look |
|---|---|---|---|---|---|
| **C·C** | Leaf | Conjugated π C=C absorbs visible light [sci, carotenoids]. Income η = π-ability 1.0. | 3.46 | 1.0 | Soft coral frill, smooth spline |
| **Si·Si** | Rod | Weak, stiff and cheap. σ-conjugated polysilanes absorb UV [sci, Miller & Michl 1989], so η = 0.35 (π-ability, REPORT §6.1). Gives reach and height. | 2.22 | 0.4 | Thin bright cyan rod |
| **C·Si** | Fin | Si–C is the hydrolysis-stable hybrid bond (REPORT finding 2), so it is the durable muscle. Moves the agent 1 tile per tick. | 3.18\* | 1.5 + 0.02 per move | **Banded** coral/cyan joint. Eyes sit on the front-most fin. |
| **C·O** | Mouth | C–O burns to gas: digestion *is* combustion. Takes energy from an adjacent foreign cell. Each bite puffs a gas ring. | 3.58 | 1.2 | Open ring, coral rim |
| **O·O** | Spike | A reactive oxidiser (peroxide) that kills an adjacent foreign cell and turns it into detritus | 1.42 | 1.5 | Magenta horn |
| **Si·O** | Plate | The strongest bond (452). Forming it **dumps** its energy into stone. It can't be eaten or dissolved, and it shields its neighbours from leak. | 0 | 0.2 | Bone-white plate (dead stone on a living body) |

**Body layout (R1, in the body itself).** A turtle walks the hex lattice. Each **C atom turns +60°** (the same sign, so six carbons in a row close a hexagonal ring, benzene-like). **Si goes straight.** An **O atom puts its codon's cell on a side branch** (perpendicular, alternating up and down), so horns, mouths and plates stick out. Carbon-rich genomes become curls, rings and coils. Silicon-rich ones become straight rods, zig-zags and combs. Mixed ones become banded serpents. If a placement collides with the agent's own body, the turtle tries the next turn. Bodies are rigid, and they move and rotate as a unit with a collision test against `occ`. (This is the Life Engine's model, thelifeengine.net, ported.)

**Energy per tick** (k_T = 2^{4(Heat−0.5)}, from 0.25 to 4; u₀ = 0.004; L = Light, including dawn):
- **Income.** For each leaf/rod: `L·η·shade·fix + ember(x)·0.5`. `fix = C_gas/(C_gas+0.2)` for C·C only, because carbon fixation needs air. `shade` comes from the canopy map (Stage 3).
- **Upkeep.** `Σ u₀·w_role·k_T`. Heat taxes everything, which is why hot life is small.
- **Leak (Sea).** Each cell loses `0.03·attack[sea][el]·k_T·(1 − 0.8·shielded)` of its share per tick. When leak takes a cell's share to 0, the cell **dissolves** (a dust puff, and motes sinking into the sea). The attack table is REPORT §6.1, rescaled: water Si 0.9 / C 0.02 / O 0.6; ammonia Si 0.75 / C 0.02; methane Si 0.03 / C 0.01; acid Si 0.3 / C 0.05. *Silicon in water must sit behind plates or die*, so plating evolves (R5).
- **Rust (O_air).** Each Si-bearing cell becomes a Si·O plate with probability `0.002·O_air·k_T` per tick, *unless* the agent is above 50% capacity, in which case it pays 0.5 to repair. **Starving silicon visibly petrifies**, and well-fed silicon stays cyan. Each rust event moves energy to the "stone" pool (lost) and lowers `O_air`. Silicon worlds slowly de-oxygenate as their reefs grow.
- **Supply (Recipe).** Growth and repair consume an atom from the local dust supply, which is refilled towards Recipe (τ = 2 s). If an element is scarce, its cells **wither** (fade to dust) at 1% per tick. This is Recipe's 3-second effect.
- **Mouth.** `bite = min(target share, 0.3)·ε_m`, with **ε_m = 0.25 + 0.6·Hunger**. The remainder (1 − ε_m) is lost as heat. A mouth can't bite plates. On detritus tiles the bite is from `D` with the same ε_m.
- **Spike.** Destroys an adjacent foreign non-plate cell with probability `0.15·(0.5+Hunger)` per tick, and adds its energy to `D`.
- **Copy.** When E ≥ 0.9·capacity and age > 3 s: half the energy goes to a child placed in a free adjacent spot. Mutation per copy: point swap 0.12, insertion 0.04 (**the inserted atom is drawn from the local dust**, so Recipe keeps steering evolution), deletion 0.04, all × √k_T.
- **Death.** E ≤ 0, or age > 60 s/k_T. **Si atoms → stone** in `S` at the body's tiles, with the plate count deposited as extra height. **C atoms → gas** (`C_gas`, rising rings). Leftover energy → `D`.

**Behaviour** (only agents with ≥ 1 fin). Sense radius r = 3 + 2·fins. Steer up the gradient of what the lineage's mouth last profited from: light (no mouth), leaf, flesh, or `D`. Flee agents that carry spikes if the agent has no spikes. Under threat, cohesion and alignment with kin (genome hash within Hamming 2) gets weight `4·Hunger·(1−Hunger)`, which peaks at medium Hunger and gives **shoals** (R10, Hamilton's selfish herd 1971, boids after Reynolds 1987).

**Trophic level (emergent, never a type).** Each lineage keeps a 10 s income ledger split into light / ember / leaf / flesh / detritus. Its level = 1 + the income-weighted mean level of its food (light and ember = 0, detritus = 1, eaten agents = their level). The HUD labels producer (< 1.3), grazer (1.7–2.3), hunter (> 2.5) and decomposer (> 50% of income from `D`).

### Stage 3: Plants, sessility that falls out of the economy (0:50 onwards)

- An agent with **0 fins and ≥ 2 leaf/rod cells** that stays put for 5 s **roots**. Fins cost 1.5 upkeep, so lineages in calm, bright places shed them by deletion. The genome is unchanged, and the plant flag is phenotypic.
- **Canopy map.** On a 128² grid, each plant stamps a cap disc of radius r_cap at height `h = ground + stalk`. The top-most stamp per tile gets the light, and lower ones get `0.3·L` (or `0.1·L` under 2+ layers). Ground height counts, so **plants on stone stacks are rewarded** (eco-06).
- **Greedy growth** (heritable genome, somatic modules). A plant's surplus energy buys one module at a time: **leaf** (adds cap area: ∂income ≈ L·η·Δarea) or **rod** (adds height: ∂income ≈ shade gain + haze gain, where haze attenuates near the ground with fog density by Sea). Whichever is larger wins, with costs scaled by upkeep. A single comparison does the work:
  - Bright and open → caps (R7).
  - Dim or hazy → thin stalks reaching up (R8, world-generator `stalkHeight`).
  - Crowded → tall (canopy race).
  - Cold → low upkeep and a long life, so they get **huge** (R6).
- **Reproduction.** Spores: a child with fins stripped is released as a mote that drifts on a fixed curl-noise wind for 2–6 s, then lands and germinates where it is free. Mutation applies.
- **3D form.** See §5.

### Stage 4: Waste, terrain, and time (continuous, dominant under ⏩)

Stone `S`, stain age `A_s`, pores `P` (decomposer-seconds inside stone), detritus `D`, a rain flow-accumulation grid `Q`, and stream-power erosion `dh = −K·Q^0.5·slope·k_T`, every 0.5 s on 128² (Howard 1994; D8 routing after O'Callaghan & Mark 1984). This is the terrain stage, detailed in §4.

## 4. Terrain and environment (the waste heap)

The ground has no hand-made features. Each layer is a ledger entry: a place where matter or energy ended up.

| Layer | Where it comes from | Mechanism | Controls → look | R |
|---|---|---|---|---|
| **Base plain** | Seed | fBm + domain warp, 128² height grid, **invisible until lit** | — | — |
| **Crater + rim** | The Spark's impulse | Dust particles pushed by ∇E settle into a ring. Their splat density becomes height (`h += 0.02·count`). | Recipe tints the dust. Heat → E_fuse → how much of the rim turns to stone at once. | R2 |
| **Sea** | The Sea choice (seeded volume) | Fills the basin up to 40% of rim height. The shoreline = the wet mask, where kindling and life start. Its colour = the sea palette (ART_DIRECTION §3). | Sea: colour, leak, fog density | R4, R5 |
| **Rivers** | Rain on the rim | D8 flow accumulation `Q`. Tiles with Q > Q_river render as liquid in the sea colour. Methane gives a **white river** (eco-15). Stream-power erosion deepens channels with time, so old hot worlds get **canyons** (eco-10). | Heat (k_T) × Time → depth | R3, R6 |
| **Stone heaps / reefs** | Dead Si, plates, rust | `S += 1` per Si atom at death and per rust event. Stone adds to height. Mostly **plated silicon makes reefs**, and **carbon leaves nothing**. | Recipe Si+O ↑, Sea water/acid ↑ (more plating), Hunger ↑ (more armour) | R2, R12 |
| **Fossil spires** | A dead Si plant | When a plant with ≥ 3 rod modules dies, its stalk mesh is **kept**: the material switches to bone, sway stops, and it becomes a collider for the canopy map. Spires are petrified stalks, so their height comes from the plant's height (cold → tall). | Heat ↓ → taller. Light ↓ → thinner, taller. | R6, R12 |
| **Arches** | Two Si plants whose caps touched for ≥ 20 s | Their caps **fuse** (a tube along the raised curve between the two stalk tops). Fused pairs share income. When both die, the arch is fossilised. In heat, the erosion term snaps arches (`p_break ∝ heat·age`). | Cold + crowding + Si | R12, R6 |
| **Pores** | Decomposers inside stone | Each tick a decomposer spends on a stone tile adds `P += 1`. The spire/reef shader carves Worley holes with threshold ∝ P (world-generator §3 pores). **A pore glows when an agent is in it** (emission = its stored E). | Light ↓ → more glow contrast. Acid → more decomposers survive. | R8, R12 |
| **Stain** | Age × Sea | Each stone texel stores its birth tick, so stain = world-generator `stoneColor(age, sea, heat)`. Lower stone is older, so it is more stained: **stain banding by layer**, like tree rings (eco-13). Living plates stain too, since they are stone, so acid hunters go ochre (fauna-07). | Sea → hue. Time and Heat → depth. | R3 |
| **Gas and sky** | Dead C, bites, C+O fusing | Global `C_gas` sets the sky's opacity (black → sea field) and haze density. **Carbon worlds get hazy. Silicon worlds stay clear**, because their waste is solid. Methane + Light × time builds a **tholin haze** that tints the field orange-brown. Producers draw `C_gas` down (carbon fixation), so the haze breathes with the leaf biomass. | Recipe C ↑ → haze. Light × methane → orange. | R2, R3, R4 |
| **O_air** | Recipe O, minus rust, plus leaf release | Leaves release 0.5 O per C fixed. Rust locks O away. | Shown as the sky's magenta tint at 10% | R2 |

**Sky events** (render-only, declared): a second sun when Light > 0.85 (eco-07), two moons at night when Light < 0.3 and Sea = methane (eco-08), and an eclipse disc when Heat > 0.85 and Light > 0.8 (eco-01). Fog, coloured shadows and the palette field reuse `mockups/worlds` core (`derive.ts`, `fogNode`, sky `backgroundNode`).

## 5. Flora: how producer forms emerge

A plant is a rooted agent with a growth state of `{stalkModules[], capModules, anchors}`. Its form is a pure function of **genome + module counts + environment**, so two plants with different genomes look different, and that difference comes from chemistry:

| Feature | Rule | Driven by |
|---|---|---|
| **Stalk path** | The same hex turtle as the body, stood up in the vertical plane. Per rod module: **C atoms in the genome bend the stalk 12° each** (cumulative, so swirl trees and bent bonsai stalks). **Si atoms keep it straight** and add a node ring (stacked domes, ringed stalks). Sway amplitude ∝ C fraction. Si stalks don't sway (they tick). | R1 |
| **Cap** | One lathe profile with per-instance params: `radius = √capModules·0.6 m`, `dome = C fraction` (round parasol, gills) vs `1−dome` (flat, **faceted, 6-sided**, stepped tiers for Si). If the genome holds ≥ 2 plates, the cap gets **bone spots** (eco-08 spotted caps). | R1, R7, R2 |
| **Cups and lanterns** | When income per cap module < upkeep (dim), the greedy rule stops buying cap. The cap stays small and **curls up into a cup** (`dome > 1`). Stored energy fills it, and emission = E/capacity × (1 − L). | R8 |
| **Glow stalks** | Si·Si rods harvest at η 0.35, so in dim worlds the profitable Si plants are tall, many-rodded and capless. They glow with stored energy. Near the ember they cluster (eco-12). | R8, R1 |
| **Colour** | The beads keep their element colours (C coral, Si cyan, O magenta) with ±5° jitter per lineage (ART_DIRECTION §3). O-rich genomes read **pink/lilac**, and Si+O reads **violet** at distance. | R9 |
| **Giants** | Lifespan 60 s/k_T and cheap upkeep in the cold. Module count is uncapped up to 64, so cold, bright worlds grow **colossal parasols** (eco-05). Render scale per module = 1 + 0.8·(1−Heat), declared as an exaggeration. | R6 |
| **Epiphytes** | Spores can root on stone *and* on living plates. Plants on top of spires and arches get light. | eco-06, eco-13 |
| **Char** | Survivors in hot + bright + old worlds darken: `char = sat(heat·light·age·6)` multiplies the bead albedo. A render rule, declared. | eco-01 monoliths |

**Rendering.** There are two InstancedMeshes: **stalk segments** (capsule for C, hex prism for Si, 4k instances) and **caps** (lathe, 24 radial × 6 rings, with the profile computed in `positionNode` from per-instance `dome`, `facet` and `radius`, 1k instances). They are rebuilt only when a module is bought (CPU writes instance matrices). Fossils are the same instances with `isFossil = 1` (bone + stain + pores).

## 6. Fauna: how bodies, eyes, motion and behaviour emerge

**The body is the genome.** No body is designed. What you see is the hex turtle output from Stage 2, rendered in the **vertical plane of the heading** (side-on silhouettes, read from the low camera):

| Visible feature | Comes from | Example outcome |
|---|---|---|
| **Curled, round, soft** | C atoms turning +60°, smooth spline through cell centres, capsule bonds (ART_DIRECTION §4) | Carbon blobs, coils, rings |
| **Straight, faceted, zig-zag** | Si atoms going straight, icosahedron beads, thin rods | Glass darters, lattice combs |
| **Banded limbs** | C·Si fins alternating coral/cyan beads | **Frilled serpent** (fauna-05) when a hunter genome also carries C·C frills |
| **Horns, spines** | O·O spikes on O-placed side branches | Horned hunters, spiky backs (eco-02 lizard) |
| **Plates** | Si·O, selected for by Sea leak and Hunger, *and* grown by rust | **Rhino-lizards** (fauna-02), plated hoppers (fauna-06) |
| **Legs vs fins** | The same fin cells: drawn as legs when the agent is on land (height > sea), as fins in liquid, and as fins/tendrils when buoyant | Striders vs swimmers |
| **Tendrils** | Rods on agents without fins, sagging under render gravity | **Jellybots** (fauna-03) |
| **Eyes** | Placed on the **front-most fin** (render). Carbon-majority bodies get 2 ink ring-eyes. Si-majority bodies get 3–6 amber dot-eyes. Hunters (level > 2.5) get one big glossy eye. Blink every 3–6 s. | ART_DIRECTION §5 |
| **Size** | Genome length is capped by what the economy affords: in the cold, long genomes break even. | **Giants** (fauna-01) in Si + methane + cold |
| **Flight** | Render-only altitude `y = buoyancy·airDensity`, where `buoyancy = fins / cells` and airDensity is high when cold and with methane or ammonia. The interaction stays 2D. | **Sky whales** (fauna-09): big C bodies in cold, bright, gentle worlds. Shoals overhead (eco-11). |
| **Confetti skin** | Balanced recipes give all 6 codon kinds, and every bead keeps its element colour plus a per-lineage jitter | **Confetti eels** (fauna-08) |
| **Motion feel** | C-majority bodies get squash and follow-through. Si-majority bodies snap and tick (ART_DIRECTION §4). Speed ∝ fins/cells × k_T. | Heat = tempo |

**Hunters vs grazers emerge from the price of theft.**
- At **Hunger 0.1**, ε_m = 0.31. A mouth recovers less than its upkeep unless producers are dense, so there are few grazers and almost no hunters. The world is gentle.
- At **Hunger 0.9**, ε_m = 0.79 and spikes fire 2.8× more often. Eating a grazer (whose cells are full of energy the grazer already concentrated) beats eating leaves, so **level-3 lineages pay**. Prey that carry plates lose fewer cells (spikes and mouths skip plates), so there is an **armour race** (R10).
- In C-only worlds, plates are impossible (no Si). Prey there evolve **speed** (more fins) and shoaling instead. Same rule, different body.

## 7. Ecosystem dynamics

**Conservation.** Energy is a ledger with 4 sources and 5 sinks, all accounted per tick:

```
sources: Spark E0 (once) · Light→leaves · ember→leaves · (none other)
sinks:   upkeep→heat · rust→stone · leak→sea · bite inefficiency→heat · death residue→D (recyclable)
stores:  living cells (Σ capacity-bounded) · D field · ember
```

A **ledger bar** (a 5-segment ribbon at the screen edge: *alive · rotting · stone · sea · heat*) makes chemistry legible. In water, the "sea" segment balloons when you add silicon. With O, "stone" grows. With heat, "heat" dominates. It is a Sankey diagram reduced to one bar.

**The amber thread (signature visual).** Every transfer > 0.05 units emits a mote packet (GPU particles, 16k pool). Each packet runs along a quadratic Bézier from source to sink over 0.6 s, with a count ∝ amount:
- sky → leaf (rain)
- leaf → mouth
- flesh → mouth
- corpse/`D` → decomposer
- cell → sea (sinking and dimming)
- cell → stone (the mote dies into a bone glint)

The food web is something you watch happen, and a thicker thread means more energy.

**Trophic ladder timing.** Producers by 0:50, grazers by ~1:15, hunters by ~1:45, decomposers by ~2:05. These are design targets (§10), to be tuned in the headless runner (§9) with a fixed seed per preset. The order is forced by the economics: mouths only pay above a producer density ρ* ≈ upkeep/(ε_m·bite·encounter rate), and spikes only pay above a consumer density.

**Oscillation.** Producer–grazer–hunter numbers cycle Lotka–Volterra-style, with spatial waves because the encounter rate is local. Bright, hungry worlds boom and bust. Gentle worlds settle. The population chart in the field guide shows it.

**Succession (what Time ⏩ reveals).**
1. Pioneer leaf drifters.
2. Rooted plants take the lit shore.
3. Grazers.
4. Hunters.
5. In Si worlds, corpses and rust build **reefs**. Reefs raise the ground, so plants on reefs out-compete for light, which grows reef-top canopies (eco-06). Decomposers riddle the old reefs with glowing pores (eco-14).
6. As the ember decays and `O_air` drops, rust slows, so late silicon stays cyan longer. Late carbon worlds go hazy as gas accumulates, unless producers draw it down.

**Collapse modes (the readable failures).**

| Collapse | Cause | What it looks like | Hint |
|---|---|---|---|
| **Dissolution** | Si in water | Cells fizz into the sea and the "sea" bar grows | "The sea is drinking your silicon" |
| **Petrification** | O high + starving | Life turns bone white and stops moving | "Too much rust" |
| **Burnout** | Heat high | Tiny, fast, dark; generations churn and die | "Life is burning too fast" |
| **Overgrazing** | Hunger high, Light low | Producers vanish, then the grazers starve: a white ring where they died | — |
| **Gel** (DESIGN §7) | — | Not possible here. Bodies are capped at 24 codons and copying splits them. | — |

## 8. Atlas coverage

Settings from WORLD_ATLAS §5.3. **Reached** = the mechanism exists in this design and should produce the pin's key elements at those settings. **None of these are verified yet**: each needs a headless run (§9, H4) before we claim it.

| Pin | Status | Mechanism (what makes it, in this design) |
|---|---|---|
| eco-01 Vermilion Eclipse | **Reached** | Si+O + water: leak forces plating, and rust turns the starving to stone, so stone dominates. Heat (k_T 3.4) keeps life small and armoured. Fierce hunger gives spiked survivors. Water stain + age = vermilion. Thin spires = fossil stalks, eroded by heat. Char rule = black. The eclipse is a declared sky event. |
| eco-02 Violet Sun Hollow | **Reached** | Acid leaks Si only 0.3, so silicon thrives. Si+O beads read violet at distance. Bright light → grazers. Medium hunger → one spiked hunter lineage. A straight-branching Si rod plant = the crystal tree. Cratered rock = decomposer pores. |
| eco-03 Sindha pillars | **Reached** | C + water + bright + gentle → dense C plants. A crowded canopy race makes them tall, and alternating leaf/rod purchases stack cap tiers = **living coral pillars** (carbon leaves no stone). Low ε_m → fliers just drift. The camera is the top-down overview. |
| eco-04 Frost Arches | **Reached** | Methane leak ≈ 0 and cold give long-lived Si plants whose caps fuse into **arches**, which fossilise and never break (heat ≈ 0). Dim light → cups that glow. O-rich genomes → pink. The frost field comes from the palette and snow (world-generator `snow`). |
| eco-05 Parasol Giants | **Reached** (tint declared) | C + cold + bright → greedy cap growth with long lives = **colossal parasols**. Gills come from the C dome profile. The orange-brown is the tholin haze (methane × light × time) tinting the field and the dead caps. Living tissue stays coral, which is a small deviation from the pin. |
| eco-06 Capped Sea Stacks | **Reached** | C+Si + water: silicon dies to **stone stacks** (fossils + reefs). The canopy map rewards height, so **C caps colonise the stack tops**. The turquoise water is the sea palette. |
| eco-07 Two Suns Spire | **Reached** | Balanced + mild + bright + old → all 6 codons, all 4 trophic levels, spores in the air and fliers. The tallest fossil stalk = the spire. The second sun is a declared sky event (Light > 0.85). The pink spire needs an "inhabited stone takes the inhabitants' tint" rule (`stain += 0.2·O-life occupancy`): a small extension, listed in §10. |
| eco-08 Coral Forest | **Reached** | C + methane cold → slow, giant C parasols. A few Si·O codons → **bone-spotted caps**. Two moons at night: declared sky event. |
| eco-09 Violet Hunter | **Reached** | Ammonia (Si leak 0.75) → plating, and dim light → tall, capless Si rod trunks. Fierce hunger → a Si-rich hunter with rods (feather-like) + spikes + a big eye, cyan. Honeycomb caps = Si plants with plate-rich caps + pores. |
| eco-10 Red Canyon | **Reached** (if erosion ships) | Hot + very old + water. Stream-power erosion on rain-off-the-rim rivers cuts a **canyon** through stained stone. Burnout leaves one long-lived plant colony. **Partial** in the cheapest build (no erosion: a crater, not a canyon). |
| eco-11 Kelp Shoal | **Reached** | C + water + medium light → tall, thin C plants (height beats cap). Medium hunger maximises the shoal weight 4H(1−H) = 1 → **orange carbon shoals** at render altitude. |
| eco-12 Glow Garden | **Reached** | Very dim → only ember-fed and Si·Si rod plants profit. They cluster round the Spark's ember: **glowing pale stalks**. Teal field + amber glow → green field, per the atlas. Water leak means the survivors carry plates at the base. |
| eco-13 Living Arch | **Partial** | We get a giant ancient fused Si arch with stain bands per layer, violet crystal buds (Si+O codons), and plum epiphytes rooted on its plates. **Missing:** the arch is a fossil or a fused plant pair, not a single *creature*. Agents are capped at 24 codons, so nothing walks at landscape scale. |
| eco-14 Bone Reef | **Reached** | This is the system's natural product: Si+O + acid. Silicon thrives *and* rusts, so plates and corpses build **reefs**. Decomposers carve **pores**, and dim light makes inhabited pores glow amber (glow seated in shadow). |
| eco-15 Lantern River | **Reached** | Methane rain off the rim → a **white river** (flow accumulation). Old fossil arches on its banks; methane barely stains, so the "dark" comes from the dusk palette. Dim + O-rich → pink glowing cup plants along the wet bank, where the kindling first lived. |

**Total: 14 reached (one conditional on erosion) and 1 partial.**

**Key fauna:**
- fauna-01 giants: **reached**. Si + cold → long rod genomes, fins as legs, dot-eyes.
- fauna-02 rhino-lizards: **reached**. Water selects for plates, plus a spike horn. The three colourways are lineage jitter.
- fauna-03 jellybots: **reached**. Finless Si drifters with sagging rods, buoyant.
- fauna-05 frilled serpent: **reached**. C·Si banded fins + C·C frills + spikes.
- fauna-06 plated hopper: **reached**. A plated grazer. The big eye is a hunter rule, so a grazer with one big eye would need an extra rule, which makes it **partial**.
- fauna-07 hammerhead strider: **partial**. Tall and thin with acid-ochre plates is possible. The hammer head is not.
- fauna-08 confetti eels: **reached**.
- fauna-09 sky whales: **reached**, via render-only buoyancy.
- fauna-04 poster: this is the field-guide UI.

## 9. Build plan

### Modules

| Module | Where it runs | Contents | Reuses |
|---|---|---|---|
| `spark/` | **GPU compute** | `E` wave+diffusion 512² (2 substeps per frame), ember decay, 64k dust particles (impulse, friction, sleep, splat-to-height via atomicAdd into a 128² `u32` grid), fusing counts (bucket bins, REPORT §6.5) | — |
| `kindle/` | **GPU compute** | Gray-Scott 512², hex-anisotropic Laplacian, 8 iterations per frame, then a 32² max-reduce every 0.5 s → async readback → blob tracker (CPU) | — |
| `fields/` | **CPU** (Float32Array 128²), uploaded as `DataTexture` per tick | height, wet, `S`, stone birth tick, `P`, `D`, canopy, `Q`, erosion; globals `C_gas`, `O_air`, ledger | — |
| `life/` | **CPU**, 10 Hz, plain TS, **no DOM, runs in Node** | hex grid `occ`, agents (SoA typed arrays: genome Uint8 [1024×48], energy, age, pos, rot, flags), turtle builder, economy, behaviour, copy and mutation, death, lineage ledger + trophic level, plant growth | Life Engine model (port the ideas, not the code) |
| `director/` | CPU | milestone detectors, the 2 declared safety nets, hints, discovery-shot triggers, field-guide naming | ART_DIRECTION §6 |
| `render/beads` | GPU render | 3 InstancedMeshes (C sphere, Si icosahedron, O small sphere) at 20k each + a bond InstancedMesh (capsule vs rod) + eyes. Instance buffers are written by the CPU each tick, and the GPU lerps prev → cur by tick fraction. | shared world material + `isGlass` |
| `render/flora` | GPU render | stalk segment + cap lathe instancing, fossil flag, sway in `positionNode` | world-generator flora material |
| `render/motes` | **GPU compute + render** | 16k-particle pool. The CPU pushes ≤ 512 transfer events per tick (src, dst, amount) to a ring buffer, and the GPU animates the Bézier threads. Also light rain and spores. | Spark billboard (ART_DIRECTION §4) |
| `render/terrain` | GPU render | height-displaced plane from `fields`, stone stain/pores shader, sea and river surface, sky + fog + palette field | `mockups/worlds` core: `derive.ts`, fogNode, sky, spire/pore shader |
| `ui/` | DOM | Recipe triangle, Sea swatches, Heat/Light/Hunger sliders, Time ▶/⏩, ledger bar, field guide | ART_DIRECTION §8 |

### Budgets (demo Mac, 1080p, WebGPU)

| Item | High tier | Low tier |
|---|---|---|
| GPU particles: dust | 64k (asleep after 0:10, so compute is skipped for sleeping particles) | 32k |
| GPU particles: motes | 16k | 8k |
| Gray-Scott | 512² × 8 it/frame (~0.4 ms) | 256² × 8 |
| E field | 512² × 2 substeps | 256² |
| Agents / cells | 1,024 / ~20k | 512 / ~10k |
| CPU life tick | ≤ 6 ms at ×1 (≈ 20k cells × ~60 ops), ≤ 30 ms at ⏩ ×8 spread over frames | — |
| Plants / stalk segments / caps | 300 / 4k / 1k | 150 / 2k / 500 |
| Draw calls | ~14 | ~14 |
| Readbacks | one 32² reduce every 0.5 s (async) | same |

The total GPU particle count is 80k, inside the 32k–131k budget. The CPU sim is the main risk to frame time, so it runs in a **Web Worker** with SharedArrayBuffer instance arrays (needs COOP/COEP headers in the Vite config). The fallback is `postMessage` transferables.

### 16-hour order (cheapest demo path first)

| Hours | Deliverable | Demo-path check |
|---|---|---|
| **H0–2** | Contracts (`types.ts`: codon table, ledger, events). `life/` economy + turtle in Node with a **2D canvas debug view**. Reuse the world-generator scaffold. | A seeded producer population grows in Node |
| **H2–4** | **Headless tuner**: `node life/run.ts --preset earthish --ticks 1800` prints the time of the first grazer, hunter and decomposer. Tune u₀, ε_m and the mutation rates until all 4 levels appear by 2:10 in 5 of 5 seeds. Tier 0 tests per preset. | Trophic ladder < 3 min, headless |
| **H4–6** | `render/beads` + eyes + terrain plane + sea palette + sky. The agents are now in 3D. | **CHEAPEST DEMO PATH ✓**: agents seeded at the shore (no Spark, no kindling) |
| **H6–8** | `render/motes`: the amber threads + light rain. Ledger bar. Controls wired. **H8 checkpoint.** | Every control's first effect visible in 3 s |
| **H8–10** | `spark/`: pixel, impact wave reveal, dust rim, gas → sky, rain → rivers (D8 flow only) | 15-second hook |
| **H10–12** | `kindle/`: Gray-Scott + promotion → agents. Fallback: promote from E-field noise spots. | Life arises from the kindling |
| **H12–14** | `render/flora`: rooting, greedy growth, caps and stalks, fossil spires, arches. Stone, stain and pores. | Silicon city preset |
| **H14–15** | Director: discovery shots (2D card first), field-guide names, hints, safety nets | The 3-minute arc runs unattended |
| **H15–16** | ⏩ Time + stream-power erosion (**stretch**), quality tiers, presets: Earth-ish, Silicon city, Frozen cathedral, Dead red, Hunter's dusk | ≥ 50 fps, 3 runs in a row |

**Cut order if behind:** erosion (eco-10 drops to partial), then arches (eco-04 and eco-13 weaken), then kindling (promote from noise spots instead), then dust particles (the reveal becomes a radial shader mask). The amber threads and the codon table are **never cut**: they are the idea.

**Team of 3:** A owns `life/` + director (the critical path; tuning is the job). B owns `spark/`, `kindle/` and `motes` (GPU compute). C owns render beads/flora/terrain + UI.

**Field-guide naming.** Prefix from the dominant element (*Carbo-*, *Vitreo-* (Si), *Oxy-*, *Mixo-*). Suffix from trophic role (*-phyton* producer, *-phagus* grazer, *-raptor* hunter, *-lytes* decomposer). Epithet from the body (*spirale*, *rectum*, *cornutum* (spikes), *loricatum* (plates)). Common name from a word table (e.g. "Glass Darter", "Plated Grazer"). A species is a genome-hash cluster (Hamming ≤ 2) with ≥ 8 members alive for ≥ 20 s.

## 10. Honesty box

**Seeds (named).**
1. **The Spark**: one energy delta, E₀ = 10⁴, at a seeded position.
2. **The dust plain**: 64k atoms in the Recipe ratio, on fBm ground (unlit, so nobody sees it at first).
3. **The sea's liquid volume**: it arrives with the Sea choice and fills the basin. In the story it is volatiles out-gassed by the impact, but that is a story, not a simulation.
4. **The RNG seed** for layout and mutation.

**Scripted beats.**
- The impact moment at 0:02.
- **First dawn** at 0:12 (the sun is the Light control, not the pixel).
- **The promotion threshold** (spot → organism). It stands in for the chemoton criteria, and we do not simulate bonding chemistry into a replicator. The *genome* is emergent (sampled from local matter); the *act* of becoming alive is a rule.
- **Two safety nets**: forced promotion at 0:45, and one directed O·O insertion into a grazer at 1:50 if no level-3 lineage exists yet. The UI logs both, and the pitch says them out loud: "we nudge evolution twice; everything else is the economy."
- The discovery shots (presentation).

**Rules marked [game], not science.**
- Bonds *store* energy and capacity = bond energy/100. This is true for reduced carbon in a biosphere sense, but bond formation is generally exothermic.
- The codon → job table (only the *reasons* are real chemistry).
- The rust probability, the supply mechanic, the greedy plant growth rule, the shoaling weight 4H(1−H), and the "each C turns 60°" body rule (inspired by the benzene ring).
- The solvent attack numbers are `[INFERRED]` (REPORT §6.1) and rescaled ×0.03.

**Render-only fakes.**
- Visibility = energy during the reveal.
- Agent altitude / flight (buoyancy).
- Legs vs fins.
- The cold giant-scale multiplier on modules.
- The char darkening.
- Sky events (second sun, two moons, eclipse).
- The tholin haze tint on living tissue (eco-05).
- Eyes and blinks.
- The amber threads are *drawn* transfers. The amounts are real ledger values, but the motes are not simulated energy.

**Simplifications.**
- No atom-level bonding simulation after the dust stage. Atoms are counts and supply, and genomes are strings. The REPORT §6.5 mutual-best bonding is **not used**, a deliberate cut (round 3).
- The interaction is 2D. 3D is presentation.

**Unknowns / risks.**
- **(1, biggest)** Whether the four trophic levels arrive reliably by 2:10 at all 5 presets. Life-Engine-style ecologies often take minutes to evolve predators. This is why the headless tuner runs at H2 and the safety nets exist.
- (2) The CPU tick at ⏩ ×8 could blow the 30 ms worker budget. In that case ⏩ becomes ×4 + a stone/stain age-scrub fake (age uniform ×8).
- (3) The Gray-Scott parameter band where spots replicate is narrow. Controls far from the defaults may yield only labyrinths or nothing. That is fine, since it is a readable failure, but the promotion rate may stall, so the safety net matters.
- (4) Fossil stalks + arches + reefs may clutter the 256 m dish by 2:45. Cap fossils at 120 and let erosion remove the oldest.
- (5) The eco-07 pink spire needs the inhabitant-tint rule (not specced beyond one line).
- (6) SharedArrayBuffer needs COOP/COEP headers on the demo host.

## 11. Iteration log

### Round 1: "an energy economy with a seeded copier"
**Proposal.**
- The pixel is a Spark mote that seeds one copier genome on a pre-made plain.
- Agents are Life-Engine cells with a fixed role alphabet (producer, mouth, killer, mover, armour, eye) and random mutation.
- Chemistry only sets numbers: bond energy → HP, Sea → damage per tick, Light → producer income, Hunger → predator damage.
- Dead agents leave stone (Si) or vanish (C).
- The terrain is a world-generator backdrop.

**Scores.** E3 · C2 · A2 · S2 · F4 · I3
- **E3**: the copier and its genome are hand-picked, and nothing happens before it exists. The terrain is a backdrop, not a product of the economy.
- **C2**: chemistry changes *numbers*, not *bodies*. A silicon creature and a carbon creature look the same with different colours. Recipe barely matters after seeding.
- **A2**: no plants as forms (only cells), so no caps, stalks, arches, rivers or spires. That leaves about 5 pins.
- **S2**: the opening is a pixel, then a beaded worm. There is no "whoa" before 1:00, and energy (the core idea) is invisible.
- **F4**: it is a straight Life Engine port, but the backdrop integration is unclear.
- **I3**: Hunger and Sea effects take 10+ s to show. Recipe has no 3-second effect.

**Revise (lowest first: C, A, S).**
- **S**: the impact wave that reveals the world by lighting it, the dust crater rim, gas → sky, and first dawn. Gray-Scott **kindling** on the shoreline as the pre-life stage. **Amber threads** for every energy transfer.
- **A**: plants = rooted agents with greedy cap-vs-height growth and a canopy map. Fossil stalks become spires. Reefs.
- **C**: started on a chemistry-derived role table (next round).

### Round 2: "the Spark, the kindling, the waste heap"
**Scores.** E4 · C3 · A3 · S4 · F3 · I3
- **E4**: the kindling → promotion hand-off is a declared threshold, but the genome now comes from the dust under the spot. The crater, sky and stone are all emergent.
- **C3**: the role alphabet is still arbitrary ("why is a mouth a mouth?"), and bodies are still blobs on a grid. Recipe sets only the starting genomes.
- **A3**: no rivers (eco-15), no canyon (eco-10), and no arches (eco-04, eco-13). Spotted caps (eco-08) and glow stalks (eco-12) don't fall out of anything.
- **S4**: the first 40 s now have a reveal, a sky birth and breathing tissue. The amber threads make the food web visible. But the whole kindling stage looks the same for every recipe.
- **F3**: the scope has grown: atom bonding (mutual-best), kindling, CPU life, plants. That is too much for 16 h.
- **I3**: Recipe still has no 3-second effect during the life stage.

**Revise (lowest first: C, I, A).**
- **C**:
  - The **6 element-pair codons**, each with a chemistry reason. π-ability sets leaf efficiency (C·C 1.0 vs Si·Si 0.35), Si·O is a zero-capacity plate, and C·O mouths are combustion.
  - The **hex turtle**: C turns 60° and Si goes straight, so curls vs rods show up *in bodies and stalks*.
  - **Rust** turns starving Si cells into plates (petrification is visible).
  - **Leak shielding** by plates, so water selects for armour.
  - **Hex-anisotropic Gray-Scott**, so even the kindling is faceted in Si recipes.
- **I**: the **supply** mechanic. Atoms the ground lacks make cells wither within ~3 s, so dragging Recipe has an immediate, predictable effect. ε_m is directly Hunger, so the thread rate changes instantly.
- **A**: D8 rivers + stream-power erosion. Arches from fused caps. Plate-spotted caps. Ember-fed glow stalks (π-ability makes Si rods weak but viable in the dim, near the Spark's ember).

### Round 3: "chemistry in the bodies"
**Scores.** E4 · C4 · A4 · S4 · F3 · I4
- **C4**: every control now changes bodies or forms through a named rule. Remaining weakness: Heat mostly scales tempo and size, and its body effect (short genomes) is subtle.
- **A4**: 13 reached on paper. eco-13 is partial (no creature-landscape) and eco-05's colour is off.
- **F3**: still the same scope problem. The atom-level mutual-best bonding is the biggest unbudgeted item, and the trophic timing is unproven.
- **I4**: each control has a 3-second effect. Heat is the most predictable (tempo).

**Revise (lowest first: F).**
- **Cut atom bonding entirely.** Dust is counts + supply, and genomes are strings.
- Life is a **Node-runnable CPU module in a worker**.
- A **headless tuner at H2–4** to prove the ladder timing first.
- **Reuse the `mockups/worlds` core** for palette, fog, sky and the stone/pore shader.
- A **cut order** that keeps the threads and codons.
- **Two declared safety nets** for the trophic timing.
- The cheapest demo path (seeded shore agents, no kindling) by H6.

### Round 4: "build it in 16 hours"
**Scores.** E4 · C4 · A4 · S5 · F4 · I4
- **E4**: the remaining scripted items are honest but real: dawn, the promotion threshold, two safety nets. A 5 would need replicators to arise without the promotion rule, which is an open ALife problem (Kruszewski & Mikolov 2021).
- **C4**: strong on Recipe, Sea, Light and Hunger. Heat's body effect is indirect (lifespan → genome length → size), and the cold giant scale is partly a render multiplier.
- **A4**: 14 reached on paper, 1 partial. Held at 4 because none is verified, eco-10 depends on the stretch erosion module, and eco-07 needs the inhabitant-tint rule.
- **S5**: a pixel → impact reveal → sky birth → breathing tissue → first life → visible amber food web → ⏩ fossil city → giant discovery shot. Every beat is on-screen and energy-coloured.
- **F4**: about 16 h for 3 people with the cut order. The risk is concentrated in one module (`life/`) that can be tested headless from H2.
- **I4**: first effects are predictable (more Si = more cyan rods, more Light = more amber rain, more Hunger = more threads and chases). The *ledger bar* explains where the energy went.

**Stop.** Every criterion is ≥ 4. Not raised to 5:
- **Emergence**: promotion is a rule.
- **Chemistry**: Heat's body effect is indirect.
- **Atlas**: unverified, with one stretch dependency.
- **Feasibility**: CPU tick risk at ⏩.
- **Intuitiveness**: the two-step surprises (rust → reefs → reef-top canopies) need a hint or two.

**References used.**
- Pearson 1993, "Complex patterns in a simple system" (Science 261:189), for the Gray-Scott regimes.
- The Life Engine (thelifeengine.net) cell-grid ecology; Avida (Ofria & Wilke 2004) for genome-as-sequence.
- Reynolds 1987, boids; Hamilton 1971, selfish herd.
- O'Callaghan & Mark 1984, D8 flow; Howard 1994, stream-power erosion.
- Miller & Michl 1989 (Chem. Rev. 89:1359), polysilane σ-conjugation.
- REPORT §6.1 / §6.5 for bond energies, π-ability and attack rates; Kruszewski & Mikolov 2021 for spontaneous replicators being an open problem.
