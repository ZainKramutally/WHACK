# Terrain plan: geology you can watch happen

> **2026-11-07 update:** `mockups/worlds`, `docs/features/world-generator.md` and the old art-direction docs were removed. The art direction is now `docs/ART_DIRECTION.md` (Red World), and the reference build is `mockups/red-world/` (world material, pixel post, terrain, procedural flora). Where this doc says "reuse `mockups/worlds`" or cites old `ART_DIRECTION §n` rules, read it as "reuse `mockups/red-world`" and "follow the current art direction". The generation logic here still stands.

> **Proposal to the art lead.** `mockups/worlds` is owned by the art-direction session. Nothing here has been built, and §9 lists every proposed code change. Inputs: `research/world-forms/` (REPORT, response matrix, methods, notes 01–03), `docs/WORLD_ATLAS.md` (R1–R12, §7 decisions), `docs/features/world-generator.md`, and generator code read at `session/art-direction` 303da71 (contracts with `medium`/`surfaceY`/`submerged`/`ramp`, `atmos/caustics.ts`).
> **Final scores** (§10.2): Science 4 · Live morph 4 · Spectacle 4 · Performance 4 · Integration 4 · Buildability 4.

Tags: **[sci]** real mechanism, simplified · **[game]** our rule · **[INFERRED]** reasoned, no source · **[est]** engineering estimate, not measured · **[verify]** check before it goes on a slide.

---

## 1. Summary and architecture

**One log clock, six machines, three layers.** Time runs on a single shared **logarithmic** geological clock that goes from about 3 seconds to 10 million years (τ = log₁₀ years, −7 to +7). Each machine (M1 dissolve, M2 precipitate, M3 crack-and-pry, M4 abrade, M5 stack-and-strip, M6 life-built, plus lava cooling) turns clock years into its **own progress** using its real rate in m/yr. Rates are fixed relative to each other, so when you press ▶ the landforms appear in their true order. Chemical-garden tubes shoot up in the first seconds. Lava crusts over and cracks into columns within years. Dunes crawl and travertine rims rise over decades. Tafoni and phytokarst pits deepen over centuries. Hoodoos, then arches, form over 10⁴–10⁶ yr. Karst towers, canyons and mesa → butte → spire take 10⁶–10⁷ yr. **The order is science. Only the overall speed is compressed.**

The terrain is drawn in three layers. All three read one GPU state grid:

| Layer | What | Morphs live? | Cost |
|---|---|---|---|
| **L0 analytic base** | A TSL port of `makeTerrainHeight` (valley, walls, far ridges) plus **progress fields**: closed-form functions of (x, z, progress Pᵢ, joint field, strata). These cover mesa retreat, karst lowering, polygons, columns, rim terraces and dune sawtooth. | **Yes**, every frame, both directions | <0.4 ms vertex [est] |
| **L1 simulated delta** | GPU compute on a 384² grid: thermal talus (Musgrave 1989), **stain age**, wetness history, optional pipe-model hydraulics (Mei 2007) and rimstone CA (Veysey & Goldenfeld 2008) | Forward-integrated. Backwards = snapshot blend | 0.3–2.5 ms compute, only while the machine is "hot" |
| **L2 primitives** | Existing spires, arch tubes and walls (CPU-built once), plus new instanced **chemical-garden tubes**, **column prisms** and **talus blocks**. Their shapes deform through uniforms (window radius, notch, cap) and SDF discards. | **Yes** | ≤3 draw calls each |

```
 Dials (recipe, sea, heat, light, age/τ, hunger?) ──► Morph (3 s tween, core/morph.ts)
        │                                                     │
        ▼                                                     ▼
 derive.ts  ── NEW geo terms (pure, Tier 0) ─────────►  Derived.geo
 liquid(sea,heat) frostWedge dissolve precip reefs canyon uplift stain v2
        │                                                     │
        ▼  CPU, per frame, ~20 scalars                        │
 geology/clock.ts  τ → years → per-machine progress Pᵢ, dPᵢ, "hot" flags; epoch ring (strata bands)
        │ uniforms                                            │
        ▼                                                     ▼
 GPU  ┌──────────────── geology compute (only hot machines dispatch) ───────────────┐
      │ geoA vec4 [rock h, loose s, liquid w, built m]   geoB vec4 [hard, stainAge,  │
      │ wet, crack]   flux vec4, vel vec4 (pipe model)   L0 is sampled, never stored │
      └───────────────────────────────────────┬──────────────────────────────────────┘
                                              ▼ read-only storage in vertex stage
 landforms: GPU grid ring0 positionNode = L0(x,z,P) + geoA.h+s+m   ·   outer rings = L0 only
            stone/terrain colour = strata band(y) × stain(sea,light,o,stainAge) → pixel ramp index
 flora/spires: positionNode += geoDelta(x,z) (bilinear, 4 reads)    atmos: caustics on up-faces
                                              ▼
                       pixel RenderPipeline (384×216, ramp bands, no outlines)
```

**CPU vs GPU.** The CPU does the pure math (derive, clock, progress integration, epoch ring, snapshots bookkeeping) and **builds geometry once** at preset load. The GPU does every per-cell operation (compute) and every per-vertex/per-fragment operation (TSL). **There is no readback on the demo path.** Flora placement keeps the CPU base height, and the GPU adds the delta.

**The best idea:** a log clock with a **per-machine progress budget**. At any τ only about two decades are "hot", so only 1–3 machines dispatch compute in any frame. The clock is honest because relative rates are true, and it is cheap because idle machines cost zero.

---

## 2. State representation

### 2.1 GPU grid (L1)

Centred on the composition focus (camera target projected onto the ground, snapped to a cell). It covers ring0 and most of ring1 (`terrain.ts` ringSpecs: ring0 half 56 m, ring1 half 150 m).

| Tier | Cells | Cell size | Footprint |
|---|---|---|---|
| high | 384² = 147,456 | 0.75 m | 288 m square |
| low | 256² = 65,536 | 1.125 m | 288 m square |

At 216 px tall and about 50° vFOV, one pixel is about 0.004 rad, which is 0.4 m at 100 m. A 0.75 m cell is therefore sub-pixel beyond about 190 m, so finer grids buy nothing in pixel mode.

| Buffer (`instancedArray`) | Layout | Bytes (high) | Written by |
|---|---|---|---|
| `geoA` | vec4 f32: **h** rock delta (m, vs L0), **s** loose sediment/talus/sand (m), **w** surface liquid depth (m), **m** built/precipitated mass (sinter, travertine, reef, ooze) (m) | 2.36 MB | M1–M6 |
| `geoB` | vec4 f32: **hard** surface erodibility 0..1 (strata at the current surface y), **stainAge** log₁₀ yr since exposure, **wet** liquid-history integral (0..1, decays at 10⁵ yr), **crack** joint damage 0..1 | 2.36 MB | M3, stain pass |
| `flux` | vec4 outflow L/R/T/B (pipe model) | 2.36 MB | M4 only |
| `vel` | vec4: vx, vz, suspended sediment, temp (vent temperature for M2) | 2.36 MB | M4, M2 |
| `geoA2` | ping-pong copy for gather passes (thermal, rimstone) | 2.36 MB | — |
| `sandI` | i32 fixed point (×1000) for the Werner slab scatter (atomics are integer only) | 0.6 MB | M4 dunes (stretch) |
| `strata` | uniform array of 32 vec4 (y0, thickness, hardness, epochIndex), from the **epoch ring** (§4.3) | 0.5 KB | CPU |
| snapshots | ring of ≤10 copies of `geoA` + `geoB.y` (stainAge) | ≤ 30 MB | `copyBufferToBuffer`-style compute copy |
| **Total** | | **≈ 42 MB** high, 19 MB low | |

Why storage buffers and not `StorageTexture` r32float: r32float is not filterable without the `float32-filterable` feature, and the terrain grid samples at its vertices anyway. **The ring0 mesh is rebuilt as a 384² grid aligned 1:1 with the cells**, so the vertex shader reads `geoA.element(vertexIndex)` directly. That is exactly the three.js `webgpu_compute_water` pattern (an `instancedArray` height buffer updated by compute and read in `positionNode` by `vertexIndex`). [verify at H0: that buffers bound in a material are emitted as `read` storage, because WebGPU forbids `read_write` storage in the vertex stage. The example uses `.toReadOnly()`.] Normals come from 4 neighbour reads in the vertex stage (central differences). Off-grid consumers (flora, spire feet, arch feet) bilinear-sample with 4 reads (`geoSample(x,z)` helper in `geology/nodes.ts`).

**L0 is never stored.** It is a pure TSL function of uniforms, so it morphs and runs backwards for free. The rendered height is `L0(x,z,P) + h + s + m`. Outer rings render L0 only, and a 12 m edge fade blends the grid delta to zero so there is no seam (the outer ring already sinks 0.15 m under ring0, `terrain.ts:142`).

### 2.2 Strata, hardness and colour (shared by sim and shading)

`band(y) = floor((y + warp(x,z)·A_w + tilt·x) / bandH)`, looked up in the `strata` array. It returns hardness and epoch index. **One function serves three purposes:**

1. **Erodibility** in M3/M4/M5 kernels, `k_eff = k·(1 − 0.85·hard)`. Hard caps undercut soft layers (Št'ava 2008 layered erosion). [sci mechanism]
2. **Risers** in L0: the height goes through `terrace(h, hard)`, so hard bands make vertical cliffs and soft bands make slopes. Live.
3. **Colour**: each epoch stores the stain colour of the sea and O level that laid it down (X3, X12). Bands are 3–8 m thick, which is ≥ 3 px at 100 m, so they read as **hard pixel stripes** (§7).

### 2.3 Detail on top of the heightfield (L2)

A heightfield cannot overhang, so arches, tafoni, spires and tubes are not displacement:

| Feature | Representation | Live control |
|---|---|---|
| Spires, hoodoos, totems | Existing `addTube` lathe. **New:** radius profile `r(y)·(0.45 + 0.55·hard(y))` from the same strata function gives fluted hoodoo profiles (eco-07), and a cap disc gets a hard top band | `capRetreat`, `spireHeight` uniforms |
| Fins → arches | Existing wall slab, plus **one SDF ellipsoid window per fin** evaluated in the fragment stage (discard plus a 1-step-darker inner rim), with vertex push-in near the window | `windowR`, `windowY` (Bruthans lifecycle §3.3) |
| Tafoni, honeycomb, bio-pits | Existing baked Worley pore textures (3 layers with cell hash `t`). **New:** threshold from M3/M6 progress, nested by layer (small pits appear on the rims of big ones as P rises) | `pores` driven by P_tafoni, P_bore |
| Chemical-garden tubes | **New:** instanced capsule chain, 1 draw call, ≤ 2,048 segments, positions from a compute "tip" pass | grows in seconds |
| Columns | **New:** L0 hex-Voronoi prisms on terrain (top height per cell) plus optional instanced hex prisms for cliff faces (≤ 1,500) | cooling progress |
| Talus blocks | **New:** instanced boulders at wall feet, count = f(`s` at the foot), gated by `aRand < density` like flora | thermal progress |

---

## 3. The machines

### 3.0 Rate table (the one source of truth: `geology/rates.ts`, pure, Tier 0 tested)

`T` is the characteristic time to change a **visible display scale L** (the scale is our choice [game]; the rate is from the research). τ\* = log₁₀ T is where the machine is "hot" on the clock.

| Machine / form | Real rate (source) | L | T | τ\* |
|---|---|---|---|---|
| M2 chemical-garden tubes | 0.1–1 mm/s tube growth, seconds–minutes (Barge 2015 [order of magnitude]) | 1 tube | ~10 s | −6.5 |
| Lava crust / columns | crust thickness ≈ 2λ√(κt), κ ≈ 10⁻⁶ m²/s → ~5 m in year 1 (Stefan cooling; Turcotte & Schubert *Geodynamics* lava-lake problem) [sci]; columns "form in years–decades" (notes/01) | 5 m | ~1 yr | −0.5…1 |
| M4 dunes migrate | barchans 1–10s m/yr, speed ∝ 1/height (notes/01 S22; Hersen 2004 doi:10.1103/PhysRevE.69.011304) | 30 m | 1–30 yr | 0.5–1.5 |
| M2 travertine rims | mm–cm/yr (Hammer 2007) | 0.2 m | ~20 yr | 1.3 |
| M2 sinter | ≤ 2.5 kg/m²/yr ≈ 1 mm/yr opal (Nicolau 2014) | 0.5 m | ~500 yr | 2.7 |
| M3 tafoni | visible pits in decades, large in centuries (notes/01) | 0.5 m | ~300 yr | 2.5 |
| M6 phytokarst bio-pits | ~mm/yr lowering (Folk 1973; landforms.json) | 0.3 m | ~300 yr | 2.5 |
| M3 contraction polygons | crack every winter, mature in centuries (Kessler & Werner 2003) | groove 0.5 m | ~500 yr | 2.7 |
| M6 stromatolite / reef | 0.3–0.5 mm/yr stromatolites (Suosaari 2016 [POP rate]); glass-sponge ~cm/yr [POP] | 2 m | ~5 kyr | 3.7 |
| M4 sea cave → stack | cm/yr cliff retreat; collapses seen in decades (London Arch 1990) | 20 m | ~2 kyr | 3.3 |
| M3 hoodoo (Water frost) | ~0.3 m per few decades rim retreat [POP]; field lives 10⁴–10⁵ yr | 10 m | ~30 kyr | 4.5 |
| Stain: varnish | 1–40 µm/kyr (Liu & Broecker 2000) | "dark" | 10⁴–10⁵ yr | 4.5 |
| M3 fins → arches | fins over 10⁵–10⁶ yr, arches persist 10⁴–10⁵ (notes/01; Bruthans 2014) | 30 m window | ~300 kyr | 5.5 |
| M1 karst towers | tens of mm/kyr denudation (Ford & Williams 2007) | 50 m | 1–10 Myr | 6.3 |
| M4 canyon incision | ~50–400 m/Myr [verify: Karlstrom 2008 doi:10.1130/G25032A.1] | 200 m | 1–4 Myr | 6.3 |
| M5 mesa → butte → spire | 10⁶–10⁷ yr (notes/01) | 100 m retreat | ~5 Myr | 6.7 |

**Dial modulation.** Every rate is `r = r₀ · gate(dials)`, where the gate comes from `Derived.geo` (§5). A zero gate means the machine never runs (frost wedging in Methane). A larger gate shifts τ\* left: an Acid world karsts about 1.5 decades earlier than a Water world [est].

**Progress.** For each machine, the CPU integrates `dP/dt = (1 − P)·r/L` (saturating forms) or a phase `φ = log₁₀(t·r/L)` (lifecycle forms such as arches or stacks: born → peak → collapse). It is one scalar per machine per frame, stored in snapshots, so it can be scrubbed exactly.

### 3.1 M1 Dissolve: karst towers, Titan labyrinth, acid pitting

- **Mechanism [sci].** Solvent removes soluble rock fastest along joints. Depressions merge, then cones, then towers (Ford & Williams 2007). Titan analogue: organics dissolve in hydrocarbons (Cornet 2015, Malaska 2020, *plausible*). R5: Methane spares silicate. Acid destroys carbonate and spares silica (X4).
- **Solubility gate (pure, `derive.ts`).** `dissolve = liquid(sea,heat) · (water·(0.3·carb + 0.02·si) + acid·(1.0·carb + 0.05·si) + methane·0.6·organic + ammonia·0.15·si)` [game weights; the ordering is sci]. Here `carb` = shell stone (`reefs`, decision a) or `c·o`, and `organic` = `c` (Titan organics). **Methane has no silicate term (R5).**
- **Live fake (L0, demo path).** Joint field `J(x,z)` = Worley F2−F1 at 18–40 m cells (seeded). Lowering `D = P_karst·Dmax`, and height `−= D·(1 − smoothstep(0, jw, J))^0.6`. Cell cores stay as towers and joints become corridors. A water-table undercut notch at `seaLevel ± 1 m` (`kNotch·P`) gives tower feet. **Acid pitting** is the same function at 0.5–2 m cells on stone fragments (pore threshold) plus a ridged micro-roughness on the terrain.
- **Simulated (stretch).** `geoA.h −= k_d·dt·wet·(1 + 3·(1−J))·(1 − hard)`, 1 pass, gather-free. Dissolved mass goes to `vel.z` as solute, which M2 can re-precipitate downstream (travertine). That loop is a real karst → travertine system [sci].
- **On screen.** With ▶ at τ 5.5–7, the plain splits along a net of corridors, which deepen into a tower forest. Drag Recipe toward C in Acid and the towers dissolve 30× faster (X4 surprise). Drag toward Si+O and they stop dead.
- **Cost.** Fake <0.1 ms. Sim 0.06 ms/iteration [est].

### 3.2 M2 Precipitate: sinter, travertine, tufa, chemical gardens, crusts

- **Mechanism [sci].** Stone comes back out of the liquid when it cools (sinter: silica soluble hot, opal-A precipitates as it cools; Nicolau 2014, Konhauser 2001), degasses CO₂ (travertine; Hammer 2007), mixes (tufa) or evaporates (salt/sulfur crust). **Terraces self-organise.** Deposition is fastest where the film thins and speeds up at convex lips, so lips grow into dams and pools pond behind them (Veysey & Goldenfeld 2008 doi:10.1038/nphys911).
- **Gate.** `precip = liquid·heatGradient·(sinter: smoothstep(.5,.8,si+o)·(water+.5·ammonia)·(1−acid) | travertine: carb·water·(1−acid))`. The report's correction holds: **Acid + Si does not make sinter.** It makes a sulfur-yellow residue crust [INFERRED]. Vents come from `Composition.vents?: Vec2[]`, which is **declared preset framing**. With no vents, the CPU picks the lowest valley-floor point (deterministic).
- **Live fake (L0).** Around each vent, Worley cells in a radial falloff. `rim = P·Hrim·smoothstep(0.85,1,F2−F1)` raises lips, and the floors stay flat. **Pool liquid** = the shared liquid shader at `floorY + 0.8·rim` per cell (reads `cellId`), so pools step down the slope. Mat colour by distance-from-vent temperature: green → yellow → orange carotenoid bands, opal white at the vent [sci] (Grand Prismatic).
- **Simulated (stretch, the "rim by rim" beat).** A rimstone CA on the grid. (1) A source adds `w` at the vent. (2) The pipe model's flux and velocity passes are reused. (3) `m += k_p·dt·|v|·max(0, Csat(T) − C)` with `T` cooling with travel (`vel.w`). (4) `C` advects. Rims nucleate from noise and sharpen. 200–1,000 iterations [notes/03] spread at 4 per frame while P is hot (τ 1–3). **Only the near vent (64² sub-window) runs it.** The rest uses the fake.
- **Chemical gardens (the opening beat, demo path).** At τ −7 to −5 with any liquid and `si+o > .6` [game gate; real gardens need metal salts in water-glass]. A compute pass moves up to 64 **tips**: buoyant rise `v = v₀·(0.6 + 0.4·noise)`, lateral wander, and a rupture event (Poisson, ~1/s) that spawns a branch and a radius pulse (Barge 2015: osmotic burst, re-seal). Each step appends a capsule segment to an `instancedArray` ring (≤ 2,048). Colour = **the metal's colour** [sci]: Fe orange in high-O water, otherwise white. **Scale is [game]: real tubes are cm. We show 1–6 m.**
- **Crusts.** Acid + evaporation → a sulfur crust band on low ground: `m += P_crust·0.3 m`, colour sulfur `#E2CF95` young → tan with stainAge.
- **Cost.** Fake <0.1 ms. Tubes: 1 compute pass (64 threads) + 1 instanced draw, ~0.05 ms. Rimstone 64² ≈ 0.02 ms/iteration.

### 3.3 M3 Crack-and-pry: hoodoos, fins → arches, tafoni, polygons

- **Mechanism [sci].** Water expands about 9% on freezing and wedges joints open (Bryce has >170 freeze-thaw nights/yr, NPS). Methane and ammonia contract, so they **cannot wedge** (X1). Salt crystallises in hollows, and wind speeds evaporation, so pits feed back into deeper pits (tafoni; Rodriguez-Navarro 1999). Thermal contraction makes polygon nets in any frozen ground (Lachenbruch 1962, Kessler & Werner 2003). **Arches self-select:** under load, grains lock together, so erosion carves toward stable arch shapes (Bruthans 2014 doi:10.1038/ngeo2209, *consensus*).
- **Gates (pure).** `frostWedge = water · bump(heat, μ=0.5, σ=0.13) · liquidHistory`. Here Heat 0.5 means "this sea's freezing point", which answers REPORT open question 2: **Heat is relative to each sea's liquid band** [game, declared]. `saltWeather = (water+acid)·smoothstep(.55,.8,heat)·dryCycle`. `contract = smoothstep(.35,.1,heat)` for any sea.
- **Fins (L0 + `geoB.crack`).** A joint field `J` of parallel sets (two Worley-warped sine families at 8–15 m spacing, seed-rotated). Frost raises `crack` along joints, and cracked cells shed rock to `s`: `h −= k_f·crack·(1−hard)`. Rock between joints stands up as fins. The live fake is the same function driven by `P_frost`.
- **Arch lifecycle (L2 SDF, demo path).** Each wall/fin landmark gets a window `windowR(φ)` from the phase φ = log₁₀(t·r_frost/L):

  | φ | Stage | Shader |
  |---|---|---|
  | < −0.6 | fin | none |
  | −0.6…0 | alcove at the base (spall where the stress is low) | ellipsoid SDF, centre at 0.25·H, radius grows, discard inside + inner rim one ramp step darker |
  | 0…0.5 | arch: window climbs, lintel thins toward the stress-locked catenary (Bruthans) | the window rises to 0.45·H, `lintel = finT − windowR` |
  | > 0.5 | collapse: when `lintel < 0.12·finT`, the lintel drops into `s` (talus burst, §3.4 instances) | the lintel is discarded, leaving **two pillars** |
  | > 1 | pillars → stumps | the existing `archSurvive` dissolve |

  Builder arches (R12, eco-04/15) skip this. They come from `arches = builders·(1−heat)²` and **never collapse in Methane** because nothing dissolves silicon (R5). In Water + mid Heat they **do** frost-crack. That contrast is the beat.
- **Hoodoos.** Hoodoos grow from fins via `crack` plus hard caps. The lathe radius is `r(y) = r₀·(0.45 + 0.55·hard(y))·(1 − 0.4·P_frost·(1−hard(y)))`, so soft bands neck in and hard bands flare, giving the fluted totem. A **cap survives while the hard band above it remains.** When `capRetreat > capR`, the cap falls and the pillar rounds off (`erosion` uniform).
- **Tafoni.** The existing pore threshold becomes `pores_eff = pores·P_tafoni`, with layers revealed coarse-to-fine: layer 3 (small) appears only on the rims of layer 1 (big) once `P > 0.6`. That is the nested multi-scale upgrade (REPORT §7, eco-02/14). Faces in shadow and facing down get +0.2, where salt lingers [sci, Rodriguez-Navarro].
- **Polygons.** L0 Worley F2−F1 at 6–20 m (larger when colder) and groove `−= P_poly·0.6 m·(1 − smoothstep(0, 0.08, F2−F1))`. Snow fills the grooves in Methane (frost on up-facing normals is already in materials.ts).
- **Cost.** All live fakes <0.15 ms. The `crack` pass (stretch) 0.05 ms/iteration.

### 3.4 M4 Abrade: canyons, rivers, sea stacks, dunes, talus

- **Mechanism [sci].** Moving fluid erodes when it carries less than its capacity, and deposits when it carries more. Capacity ∝ slope × speed (Mei, Decaudin & Hu 2007 doi:10.1109/PG.2007.15). Slope failure past the angle of repose sheds talus (Musgrave, Kolb & Mace 1989 doi:10.1145/74334.74337). Waves exploit joints: cave → arch → stack → stump (Trenhaile 2010). Dunes: Werner 1995 slab CA (doi:10.1130/0091-7613(1995)023<1107:EDCSAA>2.3.CO;2). **Dry heat keeps walls steep** (no slumping in moisture), which is why `terrain.ts:66` is backwards (§9).
- **Canyon term (pure, X6).** `canyon = smoothstep(.55,.95,age)·liquidHistory·smoothstep(.5,.9,si+o)`, `wallSteep = mix(1.35, 3.2, smoothstep(.55,.95,heat))`. `liquidHistory` is the wet integral and the current `liquid(sea,heat)`, ×0.4 if the world is dry now (Mars: canyons outlive the rivers) [sci analogue].
- **Hero channel (L0, demo path).** Carve along the valley spline: `h −= depth(P_incise)·(1 − smoothstep(0, wC, d))^wallSteep`. Here `depth = min(Dmax, r_inc·t)` and `wC` narrows with dryness (slot canyons). It meanders with `noise(along)·A`. The liquid ribbon follows it at `bed + w`. Strata bands are exposed on the walls automatically, because colour = `band(y)`.
- **Thermal erosion (L1, demo path; runs continuously).** A gather form, 1 pass: for each cell, sum the excess over 4 neighbours where `Δh > tan(θ)·cell`, `θ = 70° − 45°·(1−heat)·wetness` [game constant from doc A §4.6], and move 0.25·excess into `s`. It is run with dt scaled by `ΔP_thermal`. **When Heat changes, the angle of repose changes, so slopes visibly slump or stiffen within 1–2 s.** That is the always-visible Heat response.
- **Pipe model (L1, gated; off on the demo path by default).** 5 passes per iteration: (1) rain/source `w += R·liquid`, (2) flux `f = max(0, f·k + dt·A·g·Δ(h+w)/l)` scaled to avoid negative volume, (3) water + velocity, (4) erosion/deposition with `C = Kc·sinα·|v|·(1 − 0.85·hard)`, (5) semi-Lagrangian advection of `vel.z`, then evaporation `w *= 1 − Ke(heat)·dt`. At 384²: about 0.15 ms/pass → 0.75 ms/iteration [est]. **Budget: 2 iterations per frame while τ ∈ [4.5, 7] and the hero channel is active**, so it adds tributary gullies and alluvial fans to the analytic channel instead of replacing it.
- **Sea stacks (L2).** Tiered lathe with a waterline notch `r·(1 − notch·bump(y − seaY, 1.5 m))`, `notch = P_wave·waveEnergy(sea)`. Methane is calm (×0.2, [INFERRED] Titan). Headland → stack uses the arch lifecycle (§3.3) with phase from `r_wave`.
- **Dunes.** Live fake: sawtooth `ridge = fract((x·ŵ − c·t)/λ + warp)` with a skewed profile (stoss 10°, lee 32°). Migration speed `c = Q/H` (∝ 1/height, Bagnold scaling) with `t` in clock years, so **dunes crawl visibly at τ 0.5–2 and blur into a static sand sea later** (the pixel motion is stepped at 7 fps like caustics). Gates: `dunes = dry·sandSupply·(1 − life)` (X15: life pins sand). Methane + C + Light = organic dunes (X7). Werner CA with i32 atomics is a stretch goal (0.5–2 s to settle).
- **Talus blocks.** Instanced boulders at wall feet, density = `s` sampled at instance xz, `aRand < density`. They burst outward on an arch collapse (a 0.6 s gsap `back.out`, scripted [declared]).

### 3.5 M5 Stack-and-strip: strata, mesa → butte → spire

- **Mechanism [sci].** Layers are laid down, lifted, then cut through. Hard caprock protects soft layers until undercut, and the cliff retreats. A plateau is cut into mesas, then buttes, then spires, then nothing. Layer colour records the iron oxidation state when it was deposited (red beds vs green/grey; X3).
- **Deposition (L1, cheap).** While liquid is present, low ground gains sediment: `s += r_dep·dt·liquid·(1 − slope)`. Uplift is a [game] constant `U·t` added to L0 so incision has something to cut. **The strata stack is the epoch ring** (§4.3): each band records `(sea, o, heat)` at the time it was laid.
- **Retreat (L0, demo path).** Caprock map `Cap(x,z)` = smoothed Voronoi plateau cells (seeded, 60–200 m). The cap stands where `distToCellEdge > retreat(P_strip)`, with `retreat = r_ret·t` (cliff retreat ~0.1–1 m/kyr [INFERRED, order of magnitude]). Under the cap, the height is the mesa top. Outside it, `terrace()` steps down through `hard(y)`. **Shrinking `retreat` back (scrub) regrows mesas exactly.** At a cell centre the last thing standing is a spire, and the hero spires (R12) sit there by construction. That makes eco-01's "relic spires" read as the end of a sequence the player can watch. [The spire positions are preset landmarks: declared framing.]
- **On screen.** ▶ at τ 5.5–7: a flat-topped plateau breaks into buttes, then a field of thin red pillars, and the plain lowers around them.
- **Cost.** <0.1 ms vertex (one Voronoi plus terrace).

### 3.6 M6 Life-built: reefs, stromatolites, sinter mats, bio-pits, builder colonies

- **Mechanism [sci].** Mats trap sediment and precipitate (stromatolites, 0.3–0.5 mm/yr; Suosaari 2016). Coral and shell lock C+O into stone in water (**decision a: R2 exception, Water + life only, dissolved by Acid**). Sinter grows on microbial filaments (Konhauser 2001). Borers and grazers make phytokarst sponge (Folk 1973 doi:10.1130/0016-7606(1973)84<2351:BPFHCI>2.0.CO;2). Diatom and radiolarian ooze builds silica honeycomb (Tréguer & De La Rocha 2013). R12 builder colonies are [game] on that [sci] base.
- **Gates (pure).** `reefs = life·water·smoothstep(.4,.7,c)·(1 − 0.8·hunger)·(0.5 + 0.5·light)·(1 − acid)` (X8). `bore = life·light·hunger·(soluble rock)` (X9). `ooze = life·liquid·si` (marine-snow drape; eco-12). `builders` unchanged (derive.ts:170), now **× P_build**.
- **Reef accretion (L1, demo path in water worlds).** `m += r_reef·dt·reefs·exposure`, where `exposure = up-facing · (y < seaY)`, faster near the surface when lit. Stacked domes come from a radius-pulsed lathe (tiers = epochs). Acid dissolves `m` at 30× (X4). **Drag Sea → Acid and a reef visibly melts in about 2 s.**
- **Bio-pits.** `pores_eff += bore·P_bore` on soluble stone, darker pit floors (black microbes [sci]). Hunger is not a generator dial yet. Use `hunger ?? 0.3` until fauna lands.
- **Builder growth.** Spire `scale.y` follows `spireHeight·P_build`, so towers rise with ▶. Filler spires appear in `aRand` order (existing). **Living-arch rings (eco-13)** come from the epoch ring mapped onto the arch tube's `aT` coordinate, one stain band per epoch (X12).
- **Cost.** Reef pass 0.03 ms. Pores are threshold uniforms only.

### 3.7 Lava: the Heat extreme with cooling columns (decision b)

- **Mechanism [sci].** At max Heat the Recipe melts (Si+O → silicate melt). Cooling contracts the melt and cracks it, and successive crack fronts order into near-hexagons. **Faster cooling gives thinner columns** (Goehring, Mahadevan & Morris 2009 doi:10.1073/pnas.0805132106). The crust thickens as √t.
- **Melt.** `melt = smoothstep(.9,.97,heat)·smoothstep(.4,.7,si+o)`. L0 flattens toward a lake level `hLake` (min-filtered L0 + 4 m) and the surface becomes incandescent (the glow ramp, rule 3: the crack network glows, not the whole field). L2 primitives sink by `melt·0.3·H` and fade to the glow ramp.
- **Cooling (the gesture).** When Heat falls below 0.9, the clock starts `tCool` (clock years). The crust is `z_c = 2λ√(κ·tCool)`. **The cooling rate is read from the dial:** `q = |dHeat/dt_wall|` captured over the drag (plus +2× if water is present to quench). Column width `a = clamp(a₀/q, 0.4, 3 m)` [game mapping of Goehring's inverse law]. **Yank Heat down and you get pencil-thin columns. Ease it down and you get Giant's Causeway.**
- **Render (L0, demo path).** Hex Voronoi (jittered axial grid at `a`). Each cell top `+= hash·0.3·a`. The cracks are F2−F1 < 0.06·a, emissive while `tCool < T_glow`, then fading to black basalt with stain. Instanced hex prisms (≤ 1,500) on the lake edge give the cliff-face colonnade.
- **Cost.** <0.15 ms. No compute.

### 3.8 Stains spread with age (R3, stain v2)

- **Mechanism [sci].** Fresh rock is pale. Exposed surfaces take on iron oxides (red if O is high, green/grey if low; X3), tholin in bright Methane (Hörst 2017; X2), sulfur that ages to tan in Acid [INFERRED], and varnish darkening over 10⁴–10⁵ yr (Liu & Broecker 2000; X13).
- **Stain-age pass (L1, demo path, 1 pass, 0.03 ms).** Each cell keeps `stainAge` = log₁₀(years exposed). Where `|Δ(h+s+m)| > 2 cm` this frame (an erosion cut, fresh talus or a new deposit), it resets to the current τ_birth. **Freshly cut canyon walls and new talus are bone, and old plateau tops are fully stained.** This emerges from the sim and matches real outcrops.
- **Colour (pure + TSL).** `stain(sea, light, o, a)`. Water: `mix(green-grey #6E7F6A, iron #F94B1E, smoothstep(.25,.45,o))`. Methane: `mix(pale frost #C3C4D4, tholin #AD603B, smoothstep(.3,.7,light))`. Acid: `mix(sulfur #E2CF95, tan #A47C68, smoothstep(3,6,a))`. Ammonia: plum `#5A3B52` [game]. All of them darken toward Mn-black by `smoothstep(4.5,6.5,a)·0.5` (X13; eco-15 dark arches). Amount `= smoothstep(τ_birth+1, τ_birth+4, τ)`. L2 primitives use a per-object τ_birth (set when grown).

---

## 4. Time model

### 4.1 One clock

`τ ∈ [−7, 7]` (log₁₀ years: 3 s → 10 Myr). The existing `age` dial **is** τ, normalised: `age = (τ + 7)/14`. **`derive.ts` keeps reading `age` unchanged**, so every preset and niche test stays green. New: `Derived.geo.years = 10^(14·age − 7)`.

| Preset | age | τ | Clock reads |
|---|---|---|---|
| eco-12 | 0.50 | 0 | ~1 yr |
| eco-14 | 0.80 | 4.2 | ~16 kyr (Lost City towers: tens of kyr ✓) |
| eco-04 | 0.85 | 4.9 | ~80 kyr |
| eco-01 | 0.95 | 6.3 | ~2 Myr (butte → spire end ✓) |

**Play speeds.** ▶ = 0.25 decades/s (56 s for the full sweep). ⏩ = 1 decade/s (14 s). The demo uses ⏩ from τ −7 → 7 with a slow-down to ▶ at three beats (§6). The clock writes `Morph.current.age` directly (it bypasses the 3 s tween), so all of derive (stain, niches, spire height) follows the clock.

**Per-frame step.** `Δyears = years·ln10·(dτ/ds)·dt`. Each machine's `ΔPᵢ = f(Pᵢ, rᵢ·Δyears/Lᵢ)`. A machine is **hot** when `ΔPᵢ > 10⁻⁴`. Only hot machines dispatch compute: iterations `nᵢ = min(capᵢ, ceil(ΔPᵢ/δᵢ))` with `δ` = the kernel's stable step. Because each decade is ×10 years, a machine is hot for about 2–3 decades, and **at any τ at most 3 of the 7 are hot** [est from §3.0 τ\*]. This bounds the compute.

### 4.2 Dials during time

| Situation | Behaviour | Why |
|---|---|---|
| **Paused, dial dragged** | **Rewrite history**: every Pᵢ is recomputed as if the dials had always been this way (closed form `1 − exp(−t·r/L)` or the phase φ). L0 and L2 morph over the existing 3 s tween. L1 thermal re-settles live to the new angle of repose. L1 hydraulic (if on) cross-fades to a 120-iteration rebake spread over 1 s. | Matches the existing "Rewrite" contract (world.ts:144). Visible in ≤ 3 s. |
| **Playing, dial dragged** | **Climate change now**: the Pᵢ keep integrating with the new rates, and a **new epoch band** starts (§4.3). | X12: the cliff records the history. |

### 4.3 Epoch ring (strata as history)

On each dial release while playing (or at every integer τ when nothing changed), the CPU pushes `{τ, seaWeights, o, heat, light, stain(...)}` into a 32-entry ring. Band thickness is `r_dep × duration`, clamped to [3, 12] m at display scale. The `strata` uniform array is rewritten (≤ 0.5 KB), so it is **free**. A world that went Water → Methane → Water shows red · pale · red stripes in its canyon wall.

### 4.4 Scrubbing backwards

- **L0 and L2 are exact**: they are pure functions of the Pᵢ, and the Pᵢ are scalars stored per frame in a 512-entry CPU history (one record per 0.05 decade).
- **L1 is irreversible** (erosion destroys information). A snapshot is taken at every integer τ crossed while playing forward: a GPU compute copy of `geoA` + `stainAge`, 2.95 MB each, ≤ 10 kept (only decades where L1 was hot). Scrubbing back blends `lerp(snap[k], snap[k+1], frac)`, and from that point forward play resumes from `snap[k]`. **Declared:** backwards L1 is an interpolation, not a reverse simulation.
- Scrubbing below the first snapshot: L1 = 0 (the analytic world).

---

## 5. Dial → terrain response (from `response-matrix.json`, with the first visible effect)

"First effect" is what the player sees **within 3 s** of the drag (paused). All of it is L0/L2 uniforms or the thermal pass, so there is no re-bake.

| Dial move | First effect (≤ 3 s) | Slower consequence (with ▶) | Machines | Tag |
|---|---|---|---|---|
| Recipe → **Si+O** | Stone stops being soft: hardness contrast ↑, so strata risers sharpen and spires/fins rise (`builders`) | Fins → arches, sinter at vents, columns if hot | M3–M6 | [sci] rock types |
| Recipe → **C** | Stone thins out. In Water + life: reef domes bulge (decision a). In Acid: karst corridors deepen | Reefs/stromatolites stack, or fast karst | M1, M6 | [sci] + decision a |
| Recipe → **O** | Water stain flips green/grey → **iron red** (X3) | Red beds band into new epochs | stain, M5 | [sci] |
| Sea → **Water** | Rivers/pools appear (`liquid`), stain = iron/green | Frost wedging becomes possible (X1), reefs | all | [sci] |
| Sea → **Methane** | Frost drifts. Stain = pale frost, or tholin if bright (X2). Frost-cracked fins **stop** cracking | Organic dunes and labyrinth karst if C (X7). Builder arches persist forever (R5) | M1, M3 contraction, M4 | [sci] Titan |
| Sea → **Acid** | Sulfur crust bands on low ground. **Any reef/carbonate melts** in about 2 s (X4) | Silica spires survive and get pitted (eco-14) | M1, M2 crust | [sci] analogue |
| Sea → **Ammonia** | Plum stain [game]. No frost wedging | Cryolava domes (stretch), tufa-like towers | M2 | [INFERRED] |
| Heat ↓ (cold) | Talus angle steepens (thermal), snow on up-faces, polygons groove | Slow giants: everything's T ×10 (R6) | M3 contraction | [sci] rates; [game] scale |
| Heat → **mid**, Water | `frostWedge` peaks: fin joints darken and crack | Hoodoos, fins → arches (X1) | M3 | [sci] |
| Heat ↑ (hot, dry) | **Walls steepen** (fixed rule), dunes form on sand, stain intensifies | Tafoni, varnish, slot canyon if liquid history (X6) | M3 salt, M4 | [sci] |
| Heat → **max** | The Recipe melts: the lava lake floods the floor and the cracks glow | Pull it back: the crust grows as √t and columns crack out; drag speed sets the width (X11) | lava | [sci] Goehring |
| Light ↑ | Methane stain → tholin orange. Sinter mats colour-band. Phytokarst darkens | Bio-pits deepen (with Hunger) | M6 | [sci] |
| Light ↓ | Liquid worlds: caustics off (atmos). Pores glow (R8) | Ooze drape (dim deep) | M6 | [game] glow |
| **Time ▶** | The clock ticks: whichever machines are hot visibly advance (§3.0 order) | The whole sequence | all | [sci] order |
| Hunger ↑ (spec only) | Pits on soluble stone, reefs thin | Phytokarst fields | M6 | [sci] analogue |

**Interaction surprises, as tests** (Tier 0, `geology/terms.test.ts`, pure):

| # | Assertion |
|---|---|
| X1 | `frostWedge(water, heat .5) > .8`. `frostWedge(methane, any) == 0`. `frostWedge(ammonia, any) == 0`. `frostWedge(water, heat .1) < .1` (never thaws) |
| X2 | `stain(methane, light .9)` hue within 20° of `#AD603B`. At `light .1`, L > 0.75 (pale) |
| X3 | `stain(water, o .5)` red. `stain(water, o .1)` green/grey |
| X4 | `dissolve(acid, c-heavy) > 10 × dissolve(acid, si+o)`. `reefs(acid) == 0` |
| X6 | `canyon(eco10 dials) > .7`. `wallSteep(hot) > wallSteep(cold)` (**guards the terrain.ts:66 flip**) |
| X11 | `columnWidth(fast cooling) < columnWidth(slow)` |
| X15 | `dunes(life .9) < .2·dunes(life 0)` |
| order | the τ\* table is monotone in the §3.0 order (tubes < lava < dunes < … < mesas) |

---

## 6. Pin plans

### 6.1 eco-01 Vermilion Eclipse (air) · Si+O · Water · Heat .9 · Light .85 · age .95 (τ 6.3)

- **What the geology says.** It's the end of M5. Strata, then mesas, then buttes, then relic spires, on a dry plain lowered by ages of abrasion. Iron stain is full (O .35 → red, X3). Varnish blackens the spire tips at τ > 5 (the pin's dark accents). Liquid history is low now, so `canyon` is low, which correctly gives no canyon (vs eco-10).
- **Terrain.** `valleyWidth` > 200 keeps the plain open (preset framing). L0 adds the **retreat field**: plateau cells whose caps have retreated to nothing except at the hero spire positions. Hot dune ripples (existing) become the sawtooth driven by `c = Q/H`, frozen-looking at τ 6.3 (static sand sea).
- **Beat ("the plain is what's left").** Scrub ◀ to τ 4.5: mesas regrow around the spires and the horizon fills with flat-topped red tables. ▶: they break into buttes, then pillars, over 8 s. Bands stay red because every epoch was Water + high O.
- **Pixel.** It's the bar: 2–3 colours. Strata bands use **only** iron ramp steps 1–3 (`#7D2A16 #C3361A #F94B1E`), no new hues. Fresh cuts (stainAge reset) go one step lighter (`#FF7A45`). Keep band count ≤ 4 on screen.
- **Risk.** The retreat field must not change the composition at the preset age. Test: at age .95, `|L0_new − L0_v1| < 0.5 m` inside ring0 except within 30 m of the spires.

### 6.2 eco-04 Frost Arches (air) · Si+O · Methane · Heat .1 · Light .25 · age .85 (τ 4.9)

- **What the geology says.** Arches are **builder-made, not frost-made** (X1: methane contracts). They survive because methane dissolves no silicon (R5). The ground is contraction polygons under drifts (M3 contraction, centuries). Stain is pale frost (X2: dim). C .15 is too low for organic dunes.
- **Terrain.** Polygon grooves (10–16 m cells at Heat .1), snow-filled. Thermal: θ steep (cold, so the overhanging walls hold). Walls get hard strata from the epoch ring, but all epochs are Methane, so bands are value steps of the frost ramp only (`#577C99 #8BADC5`).
- **Beats (dial surprises).**
  1. **Sea → Water at Heat .1**: the arches stay put (always frozen, no thaw cycles), and the stain turns iron. *"You'd predict ice breaks rock…"*
  2. **…then Heat → .5**: `frostWedge` peaks. With ▶, fin joints crack, a window opens in the side wall, and the left arch's lintel thins and **collapses into talus** (arch lifecycle, about 6 s at ⏩ around τ 5). *"…but only water does it."*
  3. **Back to Methane**: cracking stops instantly (rate 0). The arches that survived are permanent.
- **Pixel.** Far arches sit in the silhouette band (fog / fog−1). The window rim uses one ramp step darker. No outline.

### 6.3 eco-12 Jellyshroom Garden (liquid, deep, dark) · Si-leaning · Water · Heat .5 · Light .08 · age .5 (τ 0)

- **What the geology says.** It's young (≈ 1 yr) and deep. Almost nothing carves. The honest geology is **marine snow settling into a silica ooze drape** (M6 `ooze`, mm–cm/kyr; Tréguer 2013) that softens and pales the floor with age, plus a quiet sediment fan. This pin is about calm, and the terrain must stay quiet (the user loved the v1 composition).
- **Terrain.** L1 deposition only: `m += r_ooze·dt` on up-faces, which rounds hollows (diffusion of `m`, 1 pass). No pipe model (submerged world: `liquid` is the medium, not surface water, so rain/rivers are disabled when `medium = 'liquid'`). Thermal stays on (very soft).
- **Beats.** ▶ to τ 4: the floor drapes into soft pale mounds and stalk feet sink 0.3–1 m into ooze (flora delta lift). Light ↑: shallow, so caustics switch on (atmos) on the drape's up-faces, and ooze slows (life shifts to the surface; [game]).
- **Pixel.** The floor stays field ramp steps 1–2 (indigo `#100A2A #211650`). Ooze = **+1 field step on up-faces only**, chosen per cell from the `m > 0.2` threshold (regions, not per pixel). Lime stays ≤ 1%.
- **Risk.** Ooze must not become noise. Its threshold uses a 4 m low-pass of `m` (computed in the diffusion pass), so it reads as big shapes.

### 6.4 eco-14 Bone Reef (liquid, shallow) · Si+O · **Acid** · Heat .6 · Light .3 · age .8 (τ 4.2)

- **What the geology says.** It's a silica city in acid. Builders' spires (M6/R12) survive acid (X4), are pitted by acid and borers (M1 + M3 tafoni, nested pits), and carry a sulfur crust on the low path edges (M2 evaporite analogue, Dallol-like [INFERRED]). **No carbonate, no reefs.** This is the X4 teaching world.
- **Conflict to flag.** The v2 palette paints eco-14 as **teal water** (`ART_DIRECTION_V2 §4`), but its dials say `acid: 1`. Geology follows the dials (acid behaviour), and colour follows the art lead. Either is fine, but the slide must not say "water" for eco-14 while the rules run acid. **Decision needed** (§10.1).
- **Terrain.** Nested tafoni threshold `P_tafoni` at τ 4.2 ≈ 0.85: big pits plus small rim pits (closes REPORT gap "nested pits"). Crust lumps (existing instanced) get `m`-driven height and stainAge (sulfur → tan). Caustics on bone tops and sand (atmos node already exists, consumes `normalWorld.y`).
- **Beats.**
  1. ▶ from τ 2 → 4.5: pits open coarse-to-fine across the spires, and the orange pore-dwellers fill them (existing niche glow gate × pore threshold).
  2. **Recipe → C**: a reef shelf would be carbonate, so in Acid it never forms. Switch **Sea → Water**: reef domes start bulging on the path edges within 2 s (X8). Switch back → they melt (X4). *"Acid spares silica and eats shell."*
- **Pixel.** Bone `#A8957C #D8CBB4 #EFE6D4` as silhouette on teal. Pits = bone step 0 + glow core. Dot-chain pores ≥ 2 px spacing (the pore texture layer 3 is culled when its projected size is < 2 px: `fwidth`-based gate).

### 6.5 The other eleven (brief)

| Pin | Machines → terrain | Status |
|---|---|---|
| eco-02 Violet Sun Hollow | Acid pitting (M1) + **grazer bio-pits** (M6 bore, Hunger) + sulfur crust; nested tafoni | Reached once a preset exists; Hunger defaults to .5 |
| eco-03 Sindha pillars | Reef stacks (decision a, M6), tiered lathe, sea plane | Needs the tiered lathe + top-down camera (M) |
| eco-05 Parasol Giants | Organic dunes (X7) + tholin stain (X2, stain v2) | Reached with stain v2 + dune fake |
| eco-06 Capped Sea Stacks | Waterline notch + stack lifecycle (M4, τ 3.3) | Needs the sea plane in air worlds (atmos owns it) |
| eco-07 Two Suns Spire | Fluted hoodoo from `hard(y)` lathe (M3 + M5); pink stain from life is [game] | Reached by the profile formula |
| eco-08 Coral Forest | Contraction polygons (M3), frost drifts | Reached (polygons) |
| eco-09 Violet Hunter | Mostly flora. Ammonia: no frost wedge | Partial (ammonia palette anchor) |
| eco-10 Red Canyon | **X6 hero channel** + strata walls + talus + stainAge-bone fresh cuts | Reached via L0 canyon. Pipe model adds gullies (stretch) |
| eco-11 Kelp Shoal | Lone rock. Liquid only | Trivial |
| eco-13 Living Arch | Epoch-ring rust rings on the arch tube (X12) | Partial (crystals and on-arch flora are flora work) |
| eco-15 Lantern River | Builder arches (R5) + methane river channel (M4 hero channel with liquid = methane) + varnish darkening (X13) | Reached with stain v2 darkening + channel |

---

## 7. Pixel pipeline and submerged worlds

**Banding at the source (ART_DIRECTION_V2 §2).** Terrain and stone materials set `ramp: 'stone'` (stone, strata) or `'field'` (ground, ooze). Each outputs a **ramp index** (0–4) from N·L thresholds plus these geology shifts, all **chosen per region, never per pixel**:

| Signal | Index shift | Region it's constant over |
|---|---|---|
| Strata band `epochIndex` | ±1 by the band's hardness parity (hard = lighter) | one band (3–12 m thick, ≥ 3 px at 100 m) |
| Stain amount | toward the stain ramp (a ramp switch, not a blend) at threshold 0.5 | stainAge cell neighbourhood, low-passed 4 m |
| Fresh cut (stainAge reset) | +1 (bone) | the cut region |
| Pore / pit floor | → 0 | the Worley cell |
| Lava crack / glow | reserved glow entries | the crack network (≥ 2 px wide: crack width clamped to `2·pixAngle·dist`) |

**Anti-speckle rules.** Band boundaries are warped only by noise with wavelength ≥ 20 m. Every pattern feature is clamped to ≥ 2 px with `fwidth` (the same trick as `atmos/caustics.ts`'s `minCellPx`). Dune ripples and polygon grooves fade out when their projected period is < 6 px. Pattern animation (dunes crawling, crack glow pulse, tube growth "pops") steps at 7 fps on `atmosState.stepT`. **Geometry motion stays smooth.** Measure speckle with the existing capture script: ≤ 4% isolated pixels per still.

**No outlines.** Arch windows, column cracks and pit rims read by a one-step value drop inside the shape, never by a drawn edge.

**Submerged worlds (`medium: 'liquid'`, eco-12/14).**
- `liquid(sea, heat)` still gates chemistry, but **surface hydrology is off** (no rain, no pipe model, no river ribbon). Abrasion becomes a slow current term in thermal (θ −10°).
- Caustics: the terrain material adds `causticsNode(u)` on up-facing cells. A shallowness mask already exists (`light × (1 − depth)`). Ooze and reef up-faces are where caustics land, so they move with the geology.
- The liquid surface at `surfaceY` (140 / 230 m) is far above every landform, so there is no terrain–surface intersection to handle. Air worlds with pools/rivers use the shared liquid shader at `bed + w` and hand off to atmos's surface module when it lands (one function `liquidSurfaceY(x,z)` exported from geology).
- Absorption fog shifts warm ramps one step per depth band (atmos). Strata colour is therefore already "underwater-correct" without geology doing anything.

---

## 8. Phased build plan (16 h, 2 people + art-lead review)

**Owners.** **G** = new `geology` feature agent (`src/geology/**`, new files only). **L** = landforms owner (consumes `ctx.geo` in `src/landforms/**`). **Art lead** approves contracts/derive/materials changes (§9) and merges.

| Hour | Who | Deliverable (demo path first) | Exit test |
|---|---|---|---|
| H0–1 | G | **Spike:** 384² `instancedArray` written by a trivial compute (sine bump), read in a 384² grid `positionNode` by `vertexIndex`. Timestamp the compute with `trackTimestamp: true`. **Kill-switch `#nogeo`** = v1 CPU rings. | bump visible, fps ≥ 58 at 1080p internal 384×216, compute < 0.1 ms |
| H1–3 | G | `geology/rates.ts`, `clock.ts`, `terms.ts` (pure): τ ↔ age, ΔPᵢ, hot flags, gates (frostWedge, dissolve, precip, reefs, canyon, stain v2, columnWidth). **Tier 0 tests** (§5 X-table, order test, preset ages). | vitest < 2 s |
| H3–6 | G+L | **L0 in TSL**: port `makeTerrainHeight` (valley, walls with the **flipped heat rule**, far ridges) + strata `band(y)` + stain v2 colour + epoch ring. Ring0 → GPU grid. Outer rings keep the CPU mesh but colour by the same nodes. Flora/spires `+ geoDelta`. | presets match v1 stills within 0.5 m (capture diff); dial drags morph the terrain shape |
| H6–9 | G | **Live fakes**: mesa retreat (M5), karst corridors (M1), polygons + arch lifecycle + hoodoo profile (M3), hero channel + dune sawtooth + sea notch (M4), lava + columns, chemical-garden tubes (compute tips + instanced capsules). Time ▶/⏩ UI in the debug pane. | each beat in §6 visible in ≤ 3 s; τ sweep runs end to end |
| H9–12 | G | **L1 sims**: thermal (continuous), stainAge, reef/ooze accretion, snapshots + ◀ blend. Hot-machine dispatch. | ◀ from τ 7 → 2 → ▶ shows no pop > 1 m; compute ≤ 2.5 ms |
| H12–14 | G+L | **Pins**: tune eco-01/04/12/14 per §6, beats scripted as dial sequences in `presets.ts` (art lead) | 4 captures pass the art lead's eye + speckle ≤ 4% |
| H14–16 | G | Perf pass, `low` tier (256² grid, no rimstone), kill-switches, docs. **Stretch only if green:** pipe model (canyon gullies), rimstone CA at one vent, Werner dunes. | ≥ 50 fps low-tier laptop; Tier 1 green |

**Cheapest demo-path version (if only 8 h):** H0–6 + the chemical-garden tubes + lava columns + mesa retreat + stainAge. That alone gives the opening "first stone in seconds", the Heat-extreme payoff, the 10 Myr ending, and the honest-stain wall. All of it is L0/L2 except the 1-pass stain and thermal.

**Perf budget (frame 20 ms at 50 fps; demo Mac + laptop low tier) [est until H0 measures]:**

| Item | High | Low |
|---|---|---|
| L0 vertex (ring0 295k tris + outer rings, ×2 with the shadow pass) | 1.2 ms | 0.6 ms |
| Thermal (1–2 iterations) + stainAge + accretion | 0.35 ms | 0.15 ms |
| Hot sims (pipe 2 iterations or rimstone 4) **stretch** | ≤ 1.6 ms | off |
| Tubes + column prisms + talus (3 instanced draws) | 0.3 ms | 0.2 ms |
| Snapshot copy (only on an integer-τ crossing, ≤ 1 per 1–4 s) | 0.4 ms spike | 0.2 ms |
| **Geology total** | **≤ 3.5 ms** | **≤ 1.2 ms** |

**Kill-switches (URL hash):** `#nogeo` (v1 terrain), `#geo=fake` (L0/L2 only, no compute), `#geo=nohydro`, `#geo=norim`, per-machine `#m3=0` etc. Auto: if the 1 s rolling frame time is > 22 ms for 3 s, drop sims (stretch → off, then thermal at ½ rate). Quality tier `low` picks 256² automatically.

**Tests.** Tier 0: pure `rates/clock/terms` (the §5 table plus monotone order and preset-age mapping), `band(y)` determinism, ring/grid index maths. **Not tested:** shaders, compute kernels (smoke-check by capture script stills + a `#probe` overlay that prints Pᵢ, hot machines and per-pass ms).

---

## 9. Proposed changes to existing code (for the art lead)

| # | File:line | Change | Why |
|---|---|---|---|
| 1 | `landforms/terrain.ts:66` | `wallH = clamp(vw·.45, 7, 40)·(1 + 0.6·canyon)·(1 + 1.1·life)`. Drop `mix(1, .3, hot)`. Line 101 `pow(side, 1.35)` → `pow(side, wallSteep)` | Heat currently **lowers** walls, the opposite of X6. eco-01 stays open via `valleyWidth > 200`. Guarded by the X6 test |
| 2 | `landforms/terrain.ts:105` | Keep `mix(1, .22, hot)` on far ridges but gate it by `1 − canyon` | Hot open plains keep a flat horizon. Hot canyons keep their rims |
| 3 | `derive.ts:83–84, 166–168` | Replace `STAIN` lookup with `stain(sea, light, o, age)` (§3.8); add `Derived.geo = geoTerms(d)` from `geology/terms.ts` | X2/X3 fixes; three-doc stain conflict (REPORT §8) |
| 4 | `derive.ts:170` | Optional: `builders = smoothstep(.45,.8,si+o)·sat(o·4)·age` | Pure-Si corner currently gets full builders (REPORT open question 3); needs a decision |
| 5 | `contracts.ts` | `Derived.geo: GeoTerms`; `WorldContext.geo?: GeoHandle` (buffers, `sample(x,z)` node, `liquidSurfaceY`); `Dials.hunger?: number`; `Composition.vents?: Vec2[]` | Minimal additive changes; all optional so nothing breaks |
| 6 | `core/world.ts:112` (`:113` on 303da71) | `modules = [geology(), landforms(), flora(), atmos()]`; call `geology.tick(dt)` before `morph.update` so the clock can drive `age` | Geology owns the clock |
| 7 | `core/morph.ts` | `setAge(a)` that bypasses the tween (the clock writes age every frame); emit `onSettle` at tween end | Clock-driven age; epoch ring push |
| 8 | `landforms/index.ts:69–82` | If `ctx.geo`: replace ring0 with the 384² grid mesh (`positionNode` from geology); rings 1–3 unchanged | Smallest possible surgery; `#nogeo` keeps v1 |
| 9 | `landforms/index.ts:65` | `uCrust` is created but never updated: write it in `update()` from `derived` | Bug: acid crust doesn't morph (notes/03 §1) |
| 10 | `landforms/nodes.ts` `poreNodes` | `dens = u.pores·porousMul·P_tafoni` with coarse-to-fine layer reveal | Pores grow with time (nested pits) |
| 11 | `landforms/geo.ts` `spireProfile` | Optional `hard(y)` multiplier hook | Fluted hoodoo profiles from strata |
| 12 | `core/materials.ts` | Stone/terrain: accept a `strataNode` returning `{epochIndex, hard}` → ramp index shift; `ramp: 'stone'` default | Strata as hard pixel stripes |
| 13 | `flora/*` positionNode | `+ vec3(0, ctx.geo.sample(instanceXZ), 0)` when present | Feet follow eroding/depositing ground without CPU readback |
| 14 | `docs/features/world-generator.md` §3 | Terrain row: "L0 TSL + L1 GPU grid (this plan)" | Spec drift (notes/03 §1) |

---

## 10. Honesty box and iteration log

### 10.1 Honesty box

**Seeds and framing (declared).**
- Joint fields, Voronoi plateau cells, vent positions (`Composition.vents`, else the lowest floor point), valley spline, hero landmark positions and `valleyWidth` are **preset framing or seeded layout**, not emergent. The machines decide *what happens to them*.
- Uplift `U·t` is a [game] constant so incision has something to cut.
- Arch-collapse talus "burst" is a scripted 0.6 s animation, triggered by the emergent lintel threshold.
- The demo's slow-downs at beats are scripted dial sequences in `presets.ts`.

**Fakes (render-only or closed form, not simulated).**
- Mesa retreat, karst corridors, polygons, column cracks, rim terraces, dune sawtooth and the hero canyon are **closed-form progress fields**. They encode the mechanism's *outcome and rate*, not its dynamics. Only thermal talus, stain age, accretion/ooze and (stretch) pipe model / rimstone / Werner are simulated.
- Arches are SDF windows on a slab following Bruthans' outcome. The stress field is not computed.
- Chemical-garden tubes are shown at **metre scale**. Real tubes are centimetres, and need metal salts the Recipe doesn't model.
- Column width from drag speed is a [game] mapping of Goehring's inverse law. The real constant isn't used.
- Backwards scrub of L1 is **interpolation between snapshots**, not reverse simulation.

**Science caveats.**
- Rates are order-of-magnitude (notes/01 was a 12-minute pass). `[POP]` rates: hoodoo rim retreat, stromatolite growth, glass sponge. `[verify]`: the canyon incision figure (Karlstrom 2008), chemical-garden tube speed.
- Display scales `L` per machine are our choice. **The order of appearance is real. The exact τ at which each "pops" depends on L.**
- Heat-relative-to-sea (0.5 = this sea's freezing point) is a [game] convention that the atlas implies but doesn't state.
- Shell stone needs Ca/Mg that the Recipe doesn't model: say "shell", not "chemistry" (decision a).
- Ammonia frost: contraction is [INFERRED]. Ammonia + silica chemistry is unverified (REPORT open question 1).

**Unknowns / risks.**
- r187 read-only storage binding in `positionNode` (H0 spike; fallback: `StorageTexture` + `textureStore`, sampled with `textureLoad` in the vertex stage).
- **The art-direction branch (303da71) does not contain WORLD_ATLAS §7 or the R2 "unless" clause.** They live on `research/body-plans`. This plan assumes those decisions merge.
- **eco-14 palette vs dials**: the v2 teal-water field vs `sea: acid`. The art lead must decide whether eco-14 becomes Water (and then reefs **would** grow, X8) or stays Acid with a teal-looking field [game].
- Perf numbers are estimates until H0. The low-tier laptop is unmeasured.
- Hunger has no dial in the generator. M6 bore uses a default.

### 10.2 Iteration log

**Round 1: "Simulate everything."** A 1024² grid with pipe-model hydraulics, Werner dunes, rimstone CA, a frost-crack CA and DLA tufa all running live. Time = iteration count.
| Science | Live | Spectacle | Perf | Integration | Build |
|---|---|---|---|---|---|
| 4 | 2 | 4 | 2 | 2 | 1 |
- Science 4: real dynamics, but iteration-count-as-time gives **no common clock**, so relative rates are meaningless.
- Live 2: every dial change needs a 300–800-iteration re-bake (60–250 ms + spread). Backwards is impossible.
- Perf 2: 1024² pipe = ~3 ms/iteration [est]. Five sims at once blow the 20 ms frame.
- Integration 2: replaces terrain.ts wholesale and needs CPU readback for flora.
- Build 1: five GPU sims in 16 h with a 2-person team is fantasy.
- **Fix the lowest (Build, Live):** move outcomes to closed form, keep simulation only where feedback is the point.

**Round 2: "Analytic everything."** Every landform is a closed-form field in the vertex shader, driven by a linear age.
| Science | Live | Spectacle | Perf | Integration | Build |
|---|---|---|---|---|---|
| 2 | 5 | 3 | 5 | 4 | 4 |
- Science 2: linear age compresses chemical gardens (seconds) and canyons (Myr) onto one axis, so either the tubes never show or the canyon appears in seconds. **No real relative rates.** No feedback (rims don't self-organise, fresh cuts don't show as bone).
- Spectacle 3: everything morphs smoothly but nothing *happens*. No collapse, no "it decided".
- **Fix the lowest (Science):** introduce the **log clock** (τ = log₁₀ yr) with per-machine rates and display scales. Add lifecycle phases (arch, stack, mesa) so forms are born and die. Add the stainAge reset so fresh cuts are bone (an emergent, true detail).

**Round 3: "Hybrid on a log clock."** L0 progress fields + L1 thermal/stain/accretion + pipe model + rimstone + Werner, 512² grid, snapshots.
| Science | Live | Spectacle | Perf | Integration | Build |
|---|---|---|---|---|---|
| 4 | 4 | 4 | 3 | 3 | 3 |
- Perf 3: 512² pipe + rimstone + Werner together exceeds 4 ms whenever τ ∈ [4, 7].
- Integration 3: proposed a new terrain module that owns all rings. Too invasive for the art lead's branch.
- Build 3: three heavy sims on the critical path.
- **Fixes:** (a) **hot-machine dispatch**. Only machines with ΔP > 10⁻⁴ dispatch, which caps concurrency at ≤ 3 by the log clock's own structure. (b) Grid down to 384² (sub-pixel beyond 190 m at 216 px anyway). (c) Pipe/rimstone/Werner become **stretch** layers over analytic outcomes. (d) Only ring0 is replaced. Rings 1–3, `ctx.terrainHeight`, flora placement and `#nogeo` stay. (e) Paused drag = "rewrite history" (closed form) instead of a re-bake.

**Round 4: "Demo path first" (final).** As round 3 plus the fixes, plus two cheap spectacle beats on the demo path: chemical-garden tubes (compute tips, about 0.05 ms) and lava → columns with drag-speed width.
| Science | Live | Spectacle | Perf | Integration | Build |
|---|---|---|---|---|---|
| **4** | **4** | **4** | **4** | **4** | **4** |
- Science 4, not 5: rates are order-of-magnitude, with several `[POP]`/`[verify]`, and display scales are chosen. Most forms are outcome fields, not dynamics.
- Live 4, not 5: L1 can't run backwards exactly (snapshot blend), and the hydraulic stretch needs a 1 s cross-fade.
- Spectacle 4, not 5: the strongest beats (rim-by-rim terraces, true dune CA) are stretch. Demo-path spectacle relies on tubes, columns, mesa retreat, arch collapse and the 14 s τ sweep.
- Perf 4, not 5: estimates are unmeasured until H0. The shadow pass doubles the 295k-tri ring0.
- Integration 4, not 5: it needs 5 additive contract fields and a morph hook on art-lead-owned files.
- Build 4, not 5: H6–9 packs eight live fakes into 3 h, so it depends on shared helpers (`joint`, `voronoi`, `band`, `lifecycle`).
- **Stopped:** every criterion ≥ 4.

**References not already in REPORT §11:** Hersen 2004 *Phys. Rev. E* doi:10.1103/PhysRevE.69.011304 (barchan scaling). Karlstrom et al. 2008 *Geology* doi:10.1130/G25032A.1 (Grand Canyon incision; rate [verify]). Turcotte & Schubert, *Geodynamics* (Stefan solidification, lava lakes). Št'ava et al. 2008 SCA (layered hydraulic erosion). three.js `webgpu_compute_water` example (storage-buffer heightfield read in `positionNode`).
