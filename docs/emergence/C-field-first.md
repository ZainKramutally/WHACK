# Emergence design C: The Living Field
> Starting philosophy: the world is a continuous field on the GPU. The pixel is a perturbation in a flat soup, and everything else is a pattern that organised itself.  ·  Final scores: E4 C4 A4 S4 F4 I4

## 1. The idea in one paragraph

The dish is a 256×256 grid of chemical concentrations: a nutrient soup **U**, two autocatalysts (carbon **Vc** and silicon **Vsi**), dissolved **O**, **Spark**, immobile **Stone**, and one mobile, mass-conserving **animal matter** channel **A** that carries a per-cell genome. Frame 1 is one lit cell. A two-species **Gray-Scott** reaction (Pearson 1993) makes that cell copy itself into a blooming front of splitting spots. Carbon draws **curling lines**: labyrinths, bent by a chirality flow term. Silicon draws **faceted dots**: hexagonal spots, squared off by a 6-fold Kobayashi anisotropy term. Silicon spots that meet oxygen **rust into Stone** where they sit, so the ground rises as needles in the cold and as mesas in the heat. Old spots struck by Spark **bud** animal matter. A **Flow-Lenia** layer (Plantec et al. 2023) condenses that matter into self-holding blobs that forage, flee, chase, merge and split. Each blob carries a genome that travels with its mass and is resampled with softmax weights when blobs meet, so lineages, patchwork skins and hunters arise by selection rather than from a list. The 3D diorama is a **reading of the field**. Stone becomes a heightfield. Stone-height topology (peaks and saddles) becomes spires and arches. Producer peaks become instanced parasols and stalks. Each animal blob becomes a creature whose body silhouette **is its live field patch**, with eyes placed on the leading edge of its own flow. The controls are field parameters. Recipe sets reaction rates, anisotropy and chirality. Sea sets kill and dissolution rates and mobility. Heat sets timestep, noise and kernel radius. Light sets feed rate and Spark rain. Hunger sets the predator coupling.

## 2. The bloom: pixel → world timeline

Times assume Time ×1, default "Earth-ish" dials (C-leaning recipe, Water, mild, bright, gentle), and then the scripted demo moves at 1:10 onwards. The timings are tuning targets, not measurements.

| t | What the player sees | What is actually simulated | Emergent / seeded / scripted |
|---|---|---|---|
| 0:00 | Black-teal dish. One amber point of light in the centre. | Cell (128,128): `V = 0.5` split by Recipe, `Spark = 1`. Everywhere else: `U = 1`, `V = 0`. | **Seeded** (the pixel) |
| 0:02 | The point pulses. A faint halo spreads as Spark diffuses. The first ring appears. | GS reaction ignites. Spark diffuses with D = 2. | Emergent |
| 0:05 | The dot **splits in two**. A "copier" label pops. | GS mitosis regime (k ≈ 0.064). This is the field's replicator. | Emergent. The label is a detector. |
| 0:05–0:35 | A front of splitting spots races outward. Coral ones stretch into curling worms, and cyan ones stay as crisp hex-facet dots. Amber Spark rain starts falling. | 12 GS substeps per frame on 256². Chirality (C) and anisotropy (Si) terms. 16k Spark particles are deposited into the field. | Emergent. **Scripted:** rain fades in from 0:03 so frame 1 stays a single point. |
| 0:20 | Bone-white flecks appear under the cyan dots, and the ground starts to rise. | `Vsi·O → Stone` (R2). Stone is immobile and accumulates. | Emergent |
| 0:35 | The dish is covered. The oldest central spots sprout stalks and caps (pop-in with `back.out`). | Producer-peak extraction → instanced flora. Spot age ≥ τ_flora. | Emergent placement. The plant **mesh grammar** is authored. |
| 0:45 | An old spot hit by a Spark mote **buds a blob that slides away**: the first mover. | Condensation `V → A` where `age > τ` and `Spark > θ`. Flow-Lenia condenses the mass. | Emergent, under a **designed abiogenesis rule** |
| 0:55 | The blobs **open eyes** and become creatures. They graze dark trails through the producer carpet. | Blob extraction (local maxima of blurred A) → creature instances. Grazing transfers P → A. | Emergent. Eyes are a render reading. |
| 1:10 | (Demo) Recipe → Si in Water. Cyan spots grow, then **crumble to bone sand** within ~15 s. | `k_si` rises past spot existence in Water (R5). Dying Vsi rusts or dissolves. | Emergent |
| 1:25 | (Demo) Sea → Acid. The palette lerps to lemon over 1.5 s, and silicon spots explode into hex fields. | `k_si` drops and `k_c` rises slightly (R5) | Emergent |
| 1:35 | Creatures split. Daughters drift in hue, and field-guide card #1 appears. | A Flow-Lenia blob over its stable mass divides. Mutation noise on the genome. | Emergent |
| 1:50 | (Demo) Hunger ↑. Within a second, blobs **turn away from** or **towards** each other. Big-bite blobs grow horns and prey grow plates. | Chase/flee affinity term ∝ Hunger. Softmax bite weight ∝ Hunger·t. | Emergent. **Scripted fallback:** if no blob has t > 0.6 by 2:00, the largest grazer's t is set to 0.8 and the game says so. |
| 2:10 | (Demo) Time ⏩×4. Stone stains with the sea's colour, spires rise, **arches resolve** between close peaks, and pores glow where creatures sit. | 4× substeps. Stone age channel. CPU persistence pairing → arch meshes. | Emergent field. Arches are a **render reading** of saddles. |
| 2:30 | **Discovery shot.** The first silicon-dominant species is named. The camera dives to eye level: a giant faceted creature, a tiny human, and a specimen plate. | Species = a genome bin persisting ≥ 10 s with ≥ 2 individuals. The camera move is scripted. | **Scripted beat**, triggered by an emergent event |
| 2:50 | Pull back to the diorama. The population ribbon shows producer, grazer and hunter waves out of phase. | Totals histogram from atomicAdd, read back every 0.5 s | Emergent |

## 3. Stages in detail

### 3.0 Shared data (GPU storage buffers, 256² = 65,536 cells, ping-pong where written)

| Buffer | Layout (vec4 f32 unless noted) | Written by |
|---|---|---|
| `chem` ×2 | `U, Vc, Vsi, O` | GS pass |
| `aux` ×2 | `Spark, Stone, stoneAge, poreMask` | GS pass, deposit pass |
| `spotAge` | f32: time a producer has stayed above 0.2 here (decays when below) | GS pass |
| `anim` ×2 | `A, t (bite), mu (growth centre), shell` | Flow-Lenia reintegration |
| `gene` ×2 | `famC, famSi, lineage (hash seed), buoy` | Flow-Lenia reintegration |
| `blurA/M/B/P` | half-res 128² f32 Gaussian stacks (σ = 0.35R, 0.6R, 2R) | blur passes |
| `sparkAccum` | u32 fixed-point (×2¹⁶), atomicAdd from particles | particle pass |
| `blobs` | 128 × 16 f32: pos, mass, vel, cov2, meanGene, |a₂..a₆| | blob stats |
| `blobPatch` | 128 × 32×32 f32 | blob stats |
| `floraPts` | 1024 × 8 f32 | flora extract |
| `stats` | 64 × u32 atomics: totals P, A by t-bin, species bins, dead fraction | reduce pass |

famO is `1 − famC − famSi`. The genome is two vec4s and is sampled **as a whole** at mixing (§3.3). That makes it one choice per cell, as in Flow-Lenia's Eq. 10.

### 3.1 Stage 1: chemistry bloom (Gray-Scott, two autocatalysts)

- **State:** `U, Vc, Vsi, O, Spark`.
- **Rules (per substep, 5-point Laplacian, Karl Sims form):**
  - `dU = Du·m·∇²U − U(rc·Vc² + rsi·Vsi²) + F(x)(1−U) + γ_det·(detritus)`
  - `dVx = Dv·m·∇²_θ Vx + rx·U·Vx²·(1+0.6·Spark) − (F(x)+kx)Vx − ρx·O·Vx − graze_x`
  - `dO = Do·∇²O + f_O·(o − O) − Σ ρx·O·Vx` (Do = 2: oxygen is "small, bright, fast")
- **Carbon curls (R1):** Vc gets an advective swirl `v = ω_C·rot90(∇Vc)`, with `ω_C = 0.35·c`. In the worm regime (k_c ≈ 0.060) the worms curl into spirals and meanders.
- **Silicon is stiff (R1):** Vsi diffuses anisotropically, `∇²_θ = (1 + ε·cos 6(θ−θ₀))·∇²`, where θ is the angle of ∇Vsi and `ε = 0.45·si`. This is the gradient-angle trick from Kobayashi's (1993) phase-field dendrites, done pointwise. In the spot regime (k_si ≈ 0.0645) spots become **hexagonal facets and pack on a hex lattice**. At high F they grow 6-fold dendrites (snowflake branching).
- **Parameter mapping:**
  - `F(x) = (0.018 + 0.030·light)·shore(x)`, with `shore = 0.6 + 0.4·wet(x)` (nutrient comes from the sea) and light attenuated under the liquid: `·exp(−depth/1.5 m)`.
  - `k_c = 0.0600 + 0.006(heat−0.5) + atk_c(sea)` and `k_si = 0.0645 + 0.006(heat−0.5) + atk_si(sea)`, where `atk_si`: Water +0.0035, Ammonia +0.0020, Methane −0.0005, Acid −0.0010, and `atk_c`: Acid +0.0012, others ≈ 0.
  - `rc = 0.6 + 0.8·c` and `rsi = 0.6 + 0.8·si`. `ρ_si = 0.02·2.04·o` and `ρ_c = 0.02·1.03·o` (the REPORT §6.1 O-hunger ratio).
  - Sea mobility `m`: Water 1, Ammonia 0.7, Acid 0.6, Methane 0.35.
  - Heat timestep `dt = 0.4 + 1.2·heat` (log-compressed Arrhenius, REPORT §6.3 #4). Heat noise `σ_n = 0.002·heat²` added to V.
- **Why it works as a "life band":** Pearson's (F,k) map has a frozen-spots region, a mitosis/soliton region and a uniform-dead region (Munafo's *xmorphia* atlas). Heat slides k across them, which gives the DESIGN §2 Goldilocks band: cold leaves frozen still spots (a museum), mild gives copying spots, hot fades to uniform.
- **Hand-off:** `spotAge` feeds flora (§5) and condensation (§3.3). `Vsi·O` feeds Stone (§3.2). `Vc·O` emits gas-ring particles.

### 3.2 Stage 2: rust, stone and stain (deposit pass, every substep, cheap)

- `Stone += ρ_si·O·Vsi·dt` (producers) `+ β·famSi·(1−famC−famSi)·A·dt` (builder animals, R12). Stone never moves.
- `poreMask = mix(poreMask, step(0.25, Vsi), w)`, with w = the share of this substep's deposit. The stone **remembers the spot pattern it was laid under**: rust laid under a spot is solid, and rust laid in the gaps is a pore (honeycomb, R12).
- `stoneAge += dt·[Stone > 0.05]`. Stain (R3) is computed in the shader as `mix(bone #ECE4D6, stain(sea), sat(age/age_full)) + 0.25·lifeTint(inhabitant)`. The life tint is what makes eco-07's spire pink.
- **Dissolution (R5):** in Water, dying Vsi first rusts (if O is present) or returns to U. Silicon "crumbles to sand" visibly because the Stone it leaves behind is bone.

### 3.3 Stage 3: animal matter (Flow-Lenia with localised genome)

- **Condensation (designed abiogenesis):** `ΔA = γ_b·Vx·Spark·[spotAge > τ_b]`, with τ_b = 8 s, taken from Vx so mass is conserved. The new genome is `famC:famSi:famO` from the local `Vc:Vsi:O`, plus `t = 0.1 + N(0, 0.05)`, `mu ~ U[0.15, 0.3]`, `shell = 0`, and `lineage = hash(cell, tick)`.
- **Kernel:** a **Gaussian-difference ring**. `K = a[G(σ₂) − (σ₁²/σ₂²)·G(σ₁)]` (unnormalised 2D Gaussians) is **exactly zero at the centre and non-negative everywhere**, so it is a true Lenia-style ring. It is separable, so it costs 2×2 blur passes at half resolution. `σ₁ = 0.35R`, `σ₂ = 0.6R`, and **R = lerp(18, 7, heat)** cells: cold makes giants, heat makes them small (R6).
- **Affinity:**
  - `Uaff = G(K*A; mu, 0.035)` (growth bump `2e^{−(u−μ)²/2σ²} − 1`)
  - `+ Hunger·κ·(t·M − B)` (chase/flee, below)
  - `+ φ·(1−t)·P̃` (forage up the blurred producer field)
  - `+ ζ(Hunger)·M` (cohesion, `ζ = 0.4·e^{−((H−0.5)/0.2)²}`, so moderate hunger makes shoals)
- **Chase/flee from one trait.** `M = K_c*A` and `B = K_c*(A·t)` with σ_c = 2R. For a cell with bite t, `t·M − B = Σ A_j (t − t_j)` (kernel-weighted). Its gradient points **towards lower-bite mass** for hunters and **away from higher-bite mass** for prey. Lopsided pull (DESIGN §2) comes from two blurs.
- **Flow (Plantec et al. Eq. 5):** `F = (1−α)∇Uaff − α∇A`, with `α = clip((A/θ_A)²)`, θ_A = 2, using Sobel gradients. Then:
  - **Carbon swims curved:** `F += ω_C·famC·rot90(∇Uaff)·0.5`.
  - **Silicon ticks:** blend F's direction towards the nearest of 6 lattice angles by `0.7·famSi`. Silicon creatures move in straight zig-zag segments and snap direction, which is the "stiff and ticking" motion of ART_DIRECTION §4, produced by the field and not by animation.
  - **Silicon facets:** growth is multiplied by `1 + 0.3·famSi·cos 6θ` (angle of ∇A), so silicon bodies have hexagonal outlines.
- **Transport:** gather-form **reintegration tracking** (Moroz 2020; Plantec et al. §3).
  - Each target cell loops over sources within ±3 cells. Source mass lands as a square of side 2s = 1.3 at `p + dt_L·F`, and the target takes its overlap area. Mass is conserved exactly. `dt_L = 0.2·(0.4 + 1.2·heat)`.
  - **Genome mixing is softmax sampling** (Plantec et al. Eq. 10, used for their multi-species runs), implemented as a single-pass weighted reservoir. Each incoming source j gets key `u_j^{1/w_j}`, with `u_j = hash(j, target, tick)` and **`w_j = m_j·(1 + Hunger·4·t_j)`**, and the target keeps the max key (Efraimidis & Spirakis 2006). There are no atomics.
  - When two blobs overlap, the high-bite genome takes the merged cells. **Engulfing is eating**, and Hunger sets how lopsided it is.
- **Reactions (after transport):**
  - Grazing `g·(1−t)·P·A`, moved from Vx into A. The incoming mass takes the local genome, `famC/famSi` nudged 5% towards what was eaten ("you are what you eat"), and mutation `N(0, 0.02)` on t, mu, shell and lineage.
  - Metabolism `m₀(1 + 0.5|F| + 0.8·shell)·A`, returned to U as detritus.
  - Dissolution `atk_si(sea)·famSi·(1−shell)·A·12`.
  - Rust deposit (§3.2).
  - `shell` also cuts loss in merges: `w_j` for a defender is ×(1 + 2·shell).
- **Reproduction and selection:** a Flow-Lenia blob above its stable mass elongates and **divides** (dividing patterns are reported in Plantec et al. §4). Daughters carry the genome. Selection is real: shells pay metabolism but resist water and bites, so plated lineages win in Water+Fierce worlds (R5, R10).

### 3.4 Stage 4: reading the field into objects (GPU extraction, CPU tracking)

- **Blob extract** (every 4 frames): local maxima of blurred A on the 128² grid (5×5 test, `A_blur > 0.15`) → atomicAdd into the `blobs` list (cap 128).
- **Blob stats** (one thread per blob): in a window of radius 1.6R, compute mass, centroid, covariance (heading and elongation), the mass-weighted mean genome, the **velocity as mass-weighted mean flow F** (so no tracking is needed for heading), and the angular Fourier magnitudes |a₂..a₆| of mass on a ring at 0.8R (its symmetry). It also resamples a 32×32 patch of A into `blobPatch`.
- **CPU** (every 0.25 s, 8 KB readback): greedy nearest-neighbour ID assignment for stable creature IDs, species binning, naming, and the discovery-shot trigger. **Rendering never waits on the CPU.** Instances read `blobs` and `blobPatch` directly by `instanceIndex`.

### 3.5 Stage 5: ecosystem

Three trophic roles come from one continuous trait, t, and two channels:
- producers: GS V
- grazers: low-t A
- hunters: high-t A

Energy enters as Light (F, Spark) and leaves as metabolism (back to U), Stone (locked away, R2) and gas (gone). See §7.

## 4. Terrain and environment

- **Floor:** a flat shallow dish (seeded: the world's floor). All relief is Stone.
- **Ground mesh:** a 256² vertex grid with `y = 0.45 m·Stone^0.8` (bilinear-sampled), plus a carpet bump of `0.15 m·(Vc + Vsi)`. One shared world material reads Stone, stoneAge, poreMask, Vc and Vsi as storage buffers.
- **Spires vs mesas (an emergent heat signature):**
  - In the cold, Si spots are frozen still, so rust stacks in one place: **needles and pillars** (eco-04, eco-15).
  - In the mild band, mitosis spots wander, so stone smears into **ridges and plateaus**.
  - In the heat, spots die young: low **canyons** of old stone. With age, these become eco-10's red canyon.
- **Pores (R12):** on slopes > 35°, a triplanar Worley pore pattern is masked by `poreMask`. A pore gets amber emissive 1.6 when `A_blur > 0.1` within 2 cells (inhabited) and light < 0.5. This is glow seated in shadow (ART rule 3).
- **Stain (R3):** as in §3.2. Water iron `#F94B1E`, Acid tan `#A47C68`, Methane barely `#C3C4D4`, Ammonia plum `#5A3B52` (world-generator constants). Hot, bright and old makes things char: `char = sat(heat·light·age·6)` darkens stone and carbon flora towards black (eco-01's black figures).
- **Arches (topology reading):** every 2 s the CPU reads Stone at 64² (16 KB) and runs 0-dimensional persistence with union-find over cells sorted by height (Edelsbrunner, Letscher & Zomorodian 2002, ~1 ms). Each merge of two peaks at a saddle s becomes an **arch candidate** when:
  - `s > 0.55·min(peakA, peakB)`
  - the peaks are 8–40 cells apart
  - `heat < 0.5` (only cold keeps them standing; the world-generator rule `arches = builders·(1−heat)²`)

  It is rendered as a swept tube from peak top to peak top, sagging to `s`, with a thickness of 0.3·(peak width). The heightfield ridge under the span is carved to the floor in the vertex shader (a ±3-cell capsule mask), so there is an opening. The arch is **where the field has a high saddle**, so it moves when the field moves. **Living arch (eco-13):** a slow giant builder lays a stone ridge along its path. When the ridge has two peaks it reads as an arch, with flora growing on top (producers on high stone get more light).
- **Liquid:** a plane at `h_sea = 0.6 m`, coloured by the sea, where stone is low. **Lagoons, rivers and sea stacks emerge** wherever stone does or doesn't rise. eco-15's white river is the methane plane in a channel between ridges. `wet(x)` and `depth(x)` feed back into F (§3.1).
- **Sky, fog and haze:** reuse `mockups/worlds` `derive.ts` (calibrated palette field) and the sky module. The sea paints sky, fog and shadow (R4). Two suns and moons are dressing.

## 5. Flora

**Placement is emergent. The mesh grammar is authored.** Flora extract (every 8 frames): local maxima of `Vc+Vsi` on 128², with `spotAge > τ_flora = 4 s`, cap 1024 instances. Each point stores its family mix, spot age, local Spark, light at the site (attenuated), spot radius (distance to the nearest neighbouring peak) and the local hex-mode strength. One instanced parametric plant per point:

| Parameter | Formula | Rule |
|---|---|---|
| Stalk height | `(0.3 + 0.7·sat(age/30 s))·(0.4 + 0.6(1−light))·(1.4 − heat)·2.5 m` | R6 cold is giant, R8 dark reaches |
| Cap width | `light·0.9·spotRadius` (zero in the dark) | R7 light makes caps |
| Cap outline | the Voronoi cell of neighbouring peaks (hex in Si fields, so honeycomb caps; round in C) | R1 |
| Tiers (stacked domes) | `floor(famSi·age/10 s)`, up to 4. Si stacks repeat units. | R1 (flora-01 #3) |
| Stalk curve | `famC·ω_C`: spiral bend. Si: straight segments with 1–2 angular kinks. | R1 |
| Branching | `|a₆|·famSi > 0.3` → a straight 6-way crystal tree (eco-02) | R1 |
| Glow | emissive `= 1 + 2·Spark·(1−light)^1.5`, in the life hue (O-rich gives pink cups) | R8, R9 |
| Colour | the family mix with ±5° jitter by lineage | R9 |
| Cap spots | flecks of bone where `Stone > 0` under the stalk (eco-08's "stone armour") | R2 |

The world-generator species meshes (lantern cups, frost fans, glow stalks, moss domes, shade ribbons, glass whiskers) are reused as **variants chosen by the same formulas**. For example, `capWidth < 0.1 && glow > 1.5 && famO > 0.4` selects lantern cups. Their *placement* is now field peaks, not random r < niche density. Labyrinth regions (C) also raise the carpet into low **coral walls** along worm ridges (the 0.15 m bump, increased to 0.6 m when `spotAge` is high), which reads as kelp rows and coral reef. Instances pop in with `back.out(1.7)` and wither (scale to 0) over 1 s when their peak vanishes.

Sway: carbon stalks sway with follow-through. Silicon stalks don't sway (stiff, R1).

## 6. Fauna

**The body is the patch.** Each creature instance is a 32×32 grid mesh centred on its blob centroid. The vertex shader samples `blobPatch[i]`:
- Silhouette: iso-contour at `a = 0.25·max`, with alpha-to-coverage below it.
- Top surface: `h = H·smoothstep(iso, max, a)^0.6`. Underside: the same shape mirrored at 0.4× height, so the body reads as a pebble or pod.
- `H = 0.5·R·(1.4 − heat)·cellSize`, so cold bodies are tall (R6).

The silhouette changes live with the field: the body squashes when it turns, buds when it divides, and two bodies fuse in an engulf.

| Feature | Driven by | Look |
|---|---|---|
| Faceting | `famSi > 0.4` | vertices snapped to a triangle lattice, flat normals, glass fresnel rim (`isGlass`) |
| Wobble | `famC` | smooth normals, ±4% squash along the velocity |
| Eyes | heading = blob velocity | **Carbon:** 2 ink ring-eyes on the leading edge. **Silicon:** a cluster of **m** amber dot-eyes, where m = the dominant angular mode (3–6). Blink every 3–6 s, phased by lineage. |
| Big eye | `t > 0.7` | one oversized glossy eye (hunter, fauna-06) |
| Horns | `t·Hunger > 0.35` | 2 forward rods (Si) or curved horns (C) at the front, length ∝ t (R10) |
| Plates | `shell > 0.3` | bone Voronoi plates over the top surface, count ∝ mass (R5, R10) |
| Dorsal rods / feathers | `famSi > 0.5`, top 5 local maxima of the patch | thin cyan rods, normal to the surface (eco-09 feathers, eco-02 spikes) |
| Frills | `famC > 0.5` and elongation > 2 | rim fins in the light colour, wave phase along the axis (fauna-05) |
| Banding / patchwork | per-cell genome inside the patch (softmax sampling keeps cells distinct) | colour sampled per vertex from `gene`. Mixed recipes give **confetti skins** (fauna-08). Alternating C/Si along a long body gives bands. |
| Legs | `famSi > 0.5`, altitude 0, `heat < 0.4` | m straight rods down to the ground: striders (fauna-01, fauna-07) |
| Altitude (R11) | `buoy = famC·(1−heat)·seaDensity·size` (Methane 1, Ammonia 0.7, Water 0.4, Acid 0.3) | 0–18 m above the ground. Big cold carbon blobs become **sky whales** (fauna-09). Small buoyant Si blobs render as an inverted bell with rim tendrils (**jellybots**, fauna-03). A ground shadow sells the height. |
| Shoal | `ζ(Hunger)` high, `famC > 0.5`, mass < 1.5× the median | rendered as 20–60 boid fish (particle detail) orbiting the blob footprint instead of one body (eco-11) |

- **Behaviour is the field's behaviour.** Grazers drift up the producer gradient, leaving dark eaten trails. Prey slide away from high-bite mass. Hunters close in and engulf. Everything divides when big.
- **Hunters vs grazers:** these are not two species types. They are the t axis plus selection under Hunger. Hunting pays off only when the merge weight `(1 + 4·Hunger·t)` beats prey shells. When Hunger is low, high-t mutants starve, because they can't graze.
- **Field guide:** a species is a bin of (dominant family, t tercile, size tercile from R·mass, symmetry m, shell>0.3, altitude>0). It is named when it persists for ≥ 10 s with ≥ 2 individuals. Names are compounded from the bin: root *Vitreo-/Carbo-/Oxy-/Mixo-*, suffix *-dromus* (fast) / *-phagus* (high t) / *-stasis* (slow) / *-nectes* (aloft). The common name is built the same way (*"Glass Darter"*, *"Plated Grazer"*). The plate lists the dials that made it, as icons.
- **Discovery shot:** ART_DIRECTION §6, with one upgrade. The plate background is the `mockups/worlds` eye-level environment, driven by the *current* dials and Stone stain, and the creature is rendered from its frozen patch at 6–20 m tall.

## 7. Ecosystem dynamics

- **Energy flow:** Light → F and Spark → producers (GS V, autocatalytic) → grazers (A with low t, grazing transfer) → hunters (A with high t, merge-capture) → metabolism back to the U soup (recycling). Si+O mass leaks into Stone (a permanent sink: the world whitens), and C+O leaks into gas (it leaves). Producer biomass is capped by F and U. Animal mass is bounded by grazing, which bounds hunters. This is a spatial Lotka–Volterra with a nutrient loop.
- **Succession** (each stage needs the one before):
  1. bare soup
  2. copying spots (pioneer mats)
  3. rust → stone relief → shore and light-gradient niches
  4. condensed grazers
  5. hunters, by mutation and selection
  6. old stone with pores, which shelters dim-light glowing flora and inhabited "cities" (eco-14)
- **Oscillation:** hunter booms eat grazers, then crash, and producers rebound. The `stats` histogram feeds a population ribbon (3 lines) for the 2:50 beat.
- **Collapse modes, all visible as "the world goes white" (ART rule 1):**
  - **Rust-out:** O too high, everything Si becomes Stone (dead fraction > 0.5 triggers the hint "Your silicon is turning to stone").
  - **Burn-out:** heat > 0.85, k past existence, producers fade and animals starve (eco-10's last survivors sit on the highest stone, where light is strongest and water attack weakest).
  - **Freeze:** heat < 0.1, the timestep is tiny, frozen spots and still giants (the "museum").
  - **Hunter overshoot:** high Hunger with low shell gives a crash. With high shell, a prey refuge.
- **Monitors (REPORT §6.3 #7, field version):**
  - largest blob ≤ 25% of A
  - blob count 8–100
  - at least 1 division per 20 s
  - dead (Stone + bone) fraction < 0.5
  - the GS front still moving

  Any red monitor shows a hint after 45 s and logs to `#debug`.

### Control × stage matrix (the first effect within 3 s is in bold)

| Control | Chemistry | Terrain | Flora | Fauna | Ecosystem |
|---|---|---|---|---|---|
| **Recipe** | **new growth shifts colour and shape: coral worms ↔ cyan hex dots ↔ magenta rust bursts** (rc, rsi, ε, ω, O feed) | O and Si raise stone | tiers, curl, glow hue | newly condensed mass takes the mix. Faceting and zig-zag vs wobble and curves. | O-heavy → rust-out |
| **Sea** | **palette lerps 1.5 s. Si spots shrink (Water) or bloom (Acid). Methane slows everything.** | stain colour, liquid colour | survivors by family | shells selected in Water, altitude by density | Water favours C, Acid favours Si+C |
| **Heat** | **motion speeds up and gets noisy, or slows and freezes** (dt, σ_n) | needles (cold) ↔ canyons (hot) | stalk height | **bodies swell (cold) or shrink (hot) within ~2 s** as R changes | the Goldilocks band, burn-out, freeze |
| **Light** | **Spark rain thickens or thins at once**. F rises, so spots densify. | — | caps widen (bright) ↔ glow (dark) | more food → more divisions | the energy ceiling |
| **Hunger** | — | — | trails deepen | **within ~1 s blobs veer towards or away**. Horns and plates follow within 10 s. | hunters, shoals at mid, crash at max |
| **Time** | ×1 / ×4 substeps | **stains deepen, spires rise, arches resolve** | flora ages into tiers | generations pass | succession |

## 8. Atlas coverage

| Pin | Status | Mechanism |
|---|---|---|
| eco-01 Vermilion Eclipse | **reached** | Si+O rust → heavy stone. Water iron stain with age. Hot means k is near existence, so life is sparse. Hot R is small, `char` turns survivors black, and fierce Hunger gives horns. Spires are old frozen-spot columns. The eclipse is sky dressing. Gap: the figures are small, not tall (heat makes them small, per R6). |
| eco-02 Violet Sun Hollow | **reached** | Acid lets Si thrive. Si+O mix means cyan and magenta patchwork that reads violet. Pores are honeycomb `poreMask`. The crystal tree is `|a₆|` branching. Mid Hunger gives grazer (beetle) and hunter (lizard) blobs. |
| eco-03 Sindha pillars | **reached** | C in Water gives no stone, so a lagoon. Long-lived C spots stack tall living towers (stalk height by spotAge, tiers off) above the liquid plane. Gentle hunger and buoyant C gives drifting fliers. A top-down camera preset is needed for the framing. |
| eco-04 Frost Arches | **reached** | Methane cold freezes Si spots, so pillars. Persistence saddles with heat < 0.5 give arches. Dim light plus O-rich producers gives pink glowing cups on the floor (lantern-cup variant). |
| eco-05 Parasol Giants | **reached** | Cold makes R and stalk height large. Bright gives wide caps. C gives curved gills (the cap mesh). The tholin orange is the calibrated palette field. |
| eco-06 Capped Sea Stacks | **reached** | Si rusts into stacks, and the Water plane fills between them. Light is attenuated under the liquid, so C producers win on the **tops** (the light gradient). Bright light gives shelf caps. |
| eco-07 Two Suns Spire | **reached** | A balanced recipe in the mild, bright band gives the most species bins. Old stone tinted by O-rich inhabitants is pink. Spores (particles) and C fliers fill the air. Variety is not guaranteed per seed. |
| eco-08 Coral Forest | **reached** | C, Methane cold → large, slow, long-lived spots → tall coral parasols. The cap stone flecks come from Stone under the stalks. |
| eco-09 Violet Hunter | **reached** | Ammonia violet field. Dim light gives tall straight Si stalks (trunks). High t with fierce Hunger gives a cyan hunter with dorsal rods (feathers) and a big eye. Honeycomb caps come from hex Voronoi cap outlines. |
| eco-10 Red Canyon Parasol | **reached** (soft) | Hot gives canyons. Very old means a deep iron stain. Burn-out leaves 1–4 surviving spots on the highest stone (light plus shore), with a parasol tower on top. "Exactly one" is not guaranteed. |
| eco-11 Kelp Shoal | **partial** | Tall C stalks under medium light, plus labyrinth coral walls (kelp rows), are reached. **The shoal is a render reading** (boid particles orbiting a cohesive blob), not field-resolved fish. |
| eco-12 Glow Garden | **reached** | Very dim gives glow emissive and tall stalks without caps. Si-leaning in Water: Si spots survive thinly against dissolution. The green field comes from the palette field (Water + dark + glow). |
| eco-13 Living Arch | **partial** | A slow cold Si+O builder blob lays a stone ridge, and two peaks with a high saddle read as an arch with flora on top (light at height). **Missing:** the arch is not itself a living body, and there are no rust "rings" per age band (stain bands could be added from stoneAge quantised, as a stretch goal). |
| eco-14 Bone Reef | **reached** | Si+O in Acid gives the most rust under hex spots, so porous honeycomb stone. Dim light means inhabited pores glow amber (A nearby). Strongest case. |
| eco-15 Lantern River | **reached** | Methane frozen ridges with a liquid plane in the channels give the white river. F is higher near the shore, so producers line the **banks**. Dim light plus O-rich gives pink glow. Spark motes act as pink sparks in the mist. |

**Ecosystems: 13 reached, 2 partial, 0 not reached.**

| Fauna | Status | Mechanism |
|---|---|---|
| fauna-01 Watercolour giants | reached | cold R18, Si legs, m dot-eyes |
| fauna-02 Rhino-lizards | reached | Water+medium Hunger selects shell plates. Horns. Lineage colourways. |
| fauna-03 Jellybots | reached | buoyant small Si gives an inverted bell with tendrils |
| fauna-04 Specimen poster | reached | field-guide plate format |
| fauna-05 Frilled serpent | partial | elongated dividing blobs plus frills and bands. Long snake bodies depend on tuning. |
| fauna-06 Plated hopper | reached | shell plates plus the big eye (high t) |
| fauna-07 Hammerhead strider | partial | cold tall Si on legs with an ochre stain on its plates. The "hammerhead" profile is not modelled. |
| fauna-08 Confetti eels | reached | softmax genome patchwork on mixed recipes |
| fauna-09 Sky whales | reached | big buoyant cold C at altitude |

## 9. Build plan

### Modules (vanilla three.js r187, `three/webgpu`, TSL compute, Vite; reuse `mockups/worlds` core)

| Module | GPU / CPU / fake | Owner | Hours |
|---|---|---|---|
| `field/gs.ts`: 2-species GS + O + Spark, anisotropy, chirality, deposit | GPU compute | Sim | 3 |
| `field/lenia.ts`: half-res Gaussian stacks, affinity, Sobel flow, reintegration gather + reservoir genome, reactions | GPU compute | Sim | 5 |
| `field/extract.ts`: blob maxima, stats, patches, flora peaks, stats atomics | GPU compute | Sim | 2 |
| `field/params.ts`: dials → uniforms (extends `derive.ts`), with Tier 0 tests for monotonic mappings | CPU | Glue | 1 |
| `render/ground.ts`: heightfield, stain, pores, liquid plane, carve mask | GPU render | Render | 2.5 |
| `render/creatures.ts`: patch body, eyes, horns, plates, rods, legs, altitude | GPU render | Render | 4 |
| `render/flora.ts`: parametric plant + reuse of world-gen variants | GPU render | Render | 2.5 |
| `render/arches.ts`: CPU persistence on 64², tube meshes | CPU + render | Glue | 2 |
| `particles.ts`: Spark rain (16k, atomicAdd deposit), gas rings (8k), spores (4k), shoal boids (4k) = 32k | GPU compute + render | Glue | 2 |
| `game/`: tracking, species bins, names, field guide, hints, monitors, discovery shot | CPU | Glue | 3 |

### Budgets (demo Mac, Apple Silicon, Chrome WebGPU)

**Per frame at ×1:**
- 12 GS substeps: 65k cells × ~40 flops, ≈ 0.3 ms.
- 4 Flow-Lenia substeps, each ≈ 25 M buffer reads:
  - blur stacks at 128²: 4 Gaussians × 2 passes × ≤ 31 taps
  - affinity/Sobel: 9 taps
  - reintegration: 49 taps × 2 vec4 genome reads

  Together ≈ 100 M reads, estimated 2–4 ms.
- Extraction: < 0.3 ms.

**Totals:**
- Compute ≤ 5 ms. About 45 dispatches per frame.
- Render: ground 65k vertices, flora ≤ 1024 × ~300 vertices, creatures ≤ 128 × 1089 vertices, 32k particle sprites, ≤ 24 arches. About 15 draw calls, one shadow light, bloom only.
- Target ≥ 50 fps at 1080p.
- Time ×4 doubles Flow-Lenia substeps (×2) and GS (×2), with ×2 dt inside the stability bound. Stated plainly: fast-forward also raises dt.

**Quality tier `low`:** a 192² field, 3 Lenia substeps, 512 flora.

**Readback** (`getArrayBufferAsync`): 8 KB per 0.25 s (blobs), 256 B per 0.5 s (stats), 16 KB per 2 s (Stone 64²).

### 16-hour order (3 people; the cheapest demo path first)

| Hours | Sim | Render | Glue |
|---|---|---|---|
| H0–2 | GS single-pixel bloom on 256², shown as a texture on the dish. **Demo path v0: the pixel splits and blooms.** | ground heightfield + palette field + liquid plane from a fake Stone buffer | dials UI → uniforms, `#debug` panel with live F/k map readout |
| H2–5 | anisotropy + chirality + rust/deposit. Tune C-worms vs Si-hex. | stain + pores + tilt-shift diorama camera | Spark rain particles with atomicAdd deposit |
| H5–9 | Flow-Lenia: ring stacks, flow, reintegration, reservoir genome. **Tune blob self-holding first.** | creature patch bodies + eyes from `blobs` | blob/flora extraction readback, tracking |
| **H8 checkpoint** | | **must show: pixel → bloom → stone → eyed blobs grazing** | |
| H9–12 | grazing/metabolism/dissolution/shell/bite. Monitors green on 3 presets. | flora instancer + world-gen variants | species bins, names, field guide card |
| H12–14 | chase/flee term, buoyancy, divide tuning | horns/plates/rods/legs/altitude/bells | persistence arches, gas rings, spores |
| H14–16 | preset sweep over the 15 atlas settings, capture stills | discovery shot (2D card first, then the eye-level env) | demo script beats, hunter fallback, audio |

**Cut order if behind:**
1. shoal boids
2. legs
3. bells
4. arches → fall back to "stone only"
5. the eye-level plate → fall back to the 2D card
6. chirality/anisotropy on animals (keep them on GS)

**Never cut:** the pixel bloom, Stone relief, eyed blobs, Sea dissolving silicon.

**Biggest technical risk and its mitigation:** the Gaussian-difference ring kernel plus our extra affinity terms may not produce self-holding blobs at every R. Mitigations:
- spend H5–7 on a tweakpane sweep of (μ, σ, θ_A, s) at R = 7, 12, 18 before writing any reactions
- the mass-conservation term `α∇A` alone guarantees blobs stay bounded (Plantec et al. §3)
- fallback: if motility fails, foraging alone moves the blobs

## 10. Honesty box

**Seeds:**
- the single lit cell (V = 0.5 by Recipe, Spark = 1)
- the uniform soup U = 1 and the dish floor
- `lineage = hash(cell, tick)` at condensation
- the RNG seed

**Designed (not emergent):**
- the reaction network itself: two GS autocatalysts, a rust sink, and the V → A abiogenesis rule
- the trophic *axis* t, and that hunters cannot graze
- the global ring kernel and its R(heat)
- the creature render grammar (eyes, horns, plates, rods, legs, bells) and the flora mesh grammar
- the name generator
- arches as an interpretation of persistence saddles, with the heat < 0.5 rule

**Scripted beats:**
- Spark rain fades in at 0:03
- the hunter fallback at 2:00 (announced on screen: "A grazer mutated a bite")
- the discovery camera dive and plate
- the 1:10–2:10 dial moves in the demo (the presenter does them)

**Render-only fakes:**
- shoal fish (boids around one blob)
- the sky, suns and moons
- the carved arch opening
- the char darkening
- jellybot tendrils
- creature height (the field is 2D; altitude is a read of `buoy`)
- frill waves and blinks

**Game, not science:**
- the k offsets per sea are `[INFERRED]` analogues of REPORT §6.1 attack scores, rescaled the way REPORT §6.3 rescales hydrolysis
- the anisotropy and chirality as R1 stand-ins
- stain colours

**Unknowns:**
- GS front speed and mitosis stability under anisotropy (to be tuned)
- whether Flow-Lenia blobs divide often enough in 3 minutes
- whether the 3–6 dot-eye count (from |a_m|) is stable or flickers (debounce: change only after 2 s of agreement)
- Lotka–Volterra stability on a 256² dish (small populations may go extinct, so the monitors and hint are the guard)
- r187 TSL storage-buffer reads in vertex shaders for 128 patches (smoke-test at H5; fallback: copy patches into a `DataArrayTexture`)
- whether eco-07's "peak variety" or eco-10's "exactly one survivor" actually happen

## 11. Iteration log

### Round 1: pure Gray-Scott classifier

**Propose.** One 512² two-species GS field. Pattern classes are classified per region by local statistics (temporal variance, spot count, centroid drift):
- stable spots → stone
- oscillating/branching → flora
- U-skate gliders (Munafo's F = 0.062, k ≈ 0.0609) → fauna

The 3D is a coloured, displaced carpet, with fauna as the glider blobs. Light → F, Sea → k and D, Heat → dt and noise, Recipe → the ratio of species, Hunger → nothing yet.

**Critique.**

| | Score | Weakness |
|---|---|---|
| E | 3 | Fauna exist only inside a sliver of (F,k). The classifier, not the field, decides what is "a creature". There is no trophic relation at all. |
| C | 2 | Hunger has nothing to act on. Recipe only changes a ratio, and carbon and silicon look the same apart from colour (R1 lost). R2, R10 and R12 have no mechanism. |
| A | 2 | No hunters, fliers, arches, shells or pores. About 4/15 reached (eco-03, 05, 08, 12 in a rough form). |
| S | 3 | The single-pixel mitosis bloom is gorgeous. After that it's a coloured rug from above, with no eyes and no discovery shot subject. |
| F | 4 | GS is trivial on the GPU. The classifier is fiddly. |
| I | 2 | Light → F is non-monotonic on Pearson's map: more light can *kill* the gliders. A first-time player can't predict it. |

**Revise** (the lowest first: C, A, I). Add a separate, mass-conserving **Flow-Lenia animal channel**. Creatures stop depending on a GS sweet spot, and Hunger gets a coupling term. GS is kept only for producers and chemistry, with an explicit Stone sink (R2). Light → F is clamped to a monotonic band, F ∈ [0.018, 0.048], with k chosen so that more F means more and denser spots. The classifier is dropped. Roles now come from *which channel* the mass is in.

### Round 2: GS producers + Flow-Lenia animals + heightfield

**Propose.** GS (U, Vc, Vsi, O) with a rust → Stone heightfield. Flow-Lenia A with a genome (t, μ, family) and FFT-free direct ring convolution on 512². Blob extraction → creature bodies as "puffed" patches with eyes. Flora as instanced plants at producer peaks. Hunger acts as chase/flee in the affinity.

**Critique.**

| | Score | Weakness |
|---|---|---|
| E | 4 | Animals are budded by a designed rule (declared). Hunters still need luck. |
| C | 3 | Carbon vs silicon differ only in colour and a k offset, so R1 ("stiff bones vs curls") is invisible in the field. Heat changes speed but not *size* (R6). |
| A | 3 | A heightfield can't make arches (eco-04, 13, 15). There are no fliers (R11, eco-03, fauna-03, fauna-09) and no shoals. About 8/15. |
| S | 3 | Puffed blobs read as jelly pancakes, all alike. The top-down field looks like a petri dish, and nothing gives "giant life, tiny observer". |
| F | 3 | A direct ring convolution at R = 13 on 512² is ~140 M taps per kernel per substep, which is over budget. Readback-driven creature rendering stalls the frame. |
| I | 3 | The Sea's effect is only the palette in the first 3 s. Heat's dt change also shifts the pattern class, so the "first effect" is muddy. |

**Revise** (C, S, A and F tied at 3; C first, because identity is the hook):
1. **R1 in the field:** Kobayashi-style 6-fold anisotropy on Vsi and on silicon animal growth. Chirality advection on Vc and on carbon animal flow. Lattice-snapped flow for silicon animals, which gives zig-zag motion.
2. **R6:** the kernel radius R depends on heat.
3. **S:** body features driven by genome and patch moments (m dot-eyes, horns, plates, rods, frills, legs), plus the eye-level discovery plate.
4. **A:** arches from persistence saddles of Stone, altitude from buoyancy, shoals as a render reading, and a liquid plane for rivers and stacks.
5. **F:** a 256² grid, the Gaussian-difference ring (separable, half-res), and GPU-side heading so rendering never waits on readback.
6. **I:** Sea now also shifts `k_si` immediately (visible dissolution in 2–3 s).

### Round 3: identity, topology, altitude

**Propose.** The design as in §3–§6, without the reuse and cut plan.

**Critique.**

| | Score | Weakness |
|---|---|---|
| E | 4 | Arches and shoals are readings, not field objects. Hunters may need the declared nudge. |
| C | 4 | Recipe's effect on *terrain* is indirect (via O and Si rust). Hunger doesn't touch terrain or chemistry. That's acceptable, because the atlas doesn't need it to. |
| A | 4 | 13 reached on paper. eco-11 and eco-13 partial. I don't give a 5: five of the reached rows (eco-07, 10, 12, 03 framing, fauna-05) depend on unverified tuning. |
| S | 4 | The bloom, the hex-vs-worm contrast, rising spires and the dive are strong. Risk: mid-game blobs may still look samey if the genome doesn't spread. |
| F | 3 | Ten modules, two novel sims, persistence, patch rendering and a discovery env is too much for 16 hours with 3 people. The flora grammar duplicates the world-generator work. |
| I | 4 | Heat now does three things at once (speed, noise, size). They all point the same way ("cold = slow, still, big"), so it still reads. |

**Revise** (F):
- Reuse `mockups/worlds` (palette field, `derive.ts`, sky, fog, world material, flora variant meshes, eye-level env for the plate).
- Fix the genome at 8 floats with one ring kernel (no per-cell kernel weights).
- Do big blurs at half resolution, and persistence at 64² on the CPU.
- Add an explicit H8 checkpoint, a cut order, and a protected core.
- Add the sweep-first risk plan for blob formation.
- **S, against sameness:** mutation σ 0.02 plus "you are what you eat" family drift, and lineage hue jitter carried in the field, so daughters diverge visibly.

### Round 4: final (this document)

**Critique.**

| | Score | Weakness (for every score under 5) |
|---|---|---|
| E | 4 | The reaction network and the V→A budding rule are designed. The hunter fallback, arches and shoals are declared non-field. Everything else arises locally. |
| C | 4 | Every control changes every stage in its predicted direction (§7 matrix), via R1–R12. Hunger → terrain is absent by design, and the sea k-offsets are game values. |
| A | 4 | 13 reached and 2 partial on paper, which meets the 5 bar. Held at 4 because the reachability of 5 pins is untested. |
| S | 4 | The pixel mitosis bloom, worms vs hex, spires rising under ⏩, and the eye-level discovery dive. Risk: the 0:35–0:55 stretch is "carpet before creatures", so keep the narration there. |
| F | 4 | The core (GS + Flow-Lenia + patch bodies) is about 9 hours of build. The rest is cuttable and ordered. Flow-Lenia tuning is the single schedule risk. |
| I | 4 | Every control has a bold first effect within 3 s (§7). Recipe's shape change shows only on *new* growth, so the old pattern lingers about 5 s. A brief colour pulse on new growth flags it. |

**All criteria are at least 4. Stopping at round 4.** Nothing stays below 4.

### References

- Pearson J.E. (1993) "Complex patterns in a simple system", *Science* 261:189.
- Munafo R., *xmorphia* Gray-Scott parameter atlas (mrob.com/pub/comp/xmorphia).
- Sims K., "Reaction-Diffusion Tutorial" (karlsims.com).
- Kobayashi R. (1993) "Modeling and numerical simulations of dendritic crystal growth", *Physica D* 63:410.
- Chan B.W.-C. (2019) "Lenia: biology of artificial life", *Complex Systems* 28:251.
- Plantec E. et al. (2023) "Flow-Lenia: towards open-ended evolution in cellular automata through mass conservation and parameter localization", arXiv:2212.07906. Verified: Eq. 5 (flow), reintegration tracking with s = 0.65, softmax-sampling mixing used for multi-species runs, and dividing/merging patterns from a random 40×40 patch.
- Moroz M. (2020) "Reintegration tracking" (Shadertoy and blog).
- Efraimidis P., Spirakis P. (2006) "Weighted random sampling with a reservoir", *Inf. Proc. Letters* 97:181.
- Edelsbrunner H., Letscher D., Zomorodian A. (2002) "Topological persistence and simplification", *DCG* 28:511.
