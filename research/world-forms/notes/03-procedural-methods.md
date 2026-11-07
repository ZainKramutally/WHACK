# 03 · Procedural methods: generating each landform live on r187 WebGPU/TSL

Question: how can we generate each landform on the mood board procedurally, live, on three.js r187 WebGPU/TSL, and controlled by our dials? What does `mockups/worlds` already do, and what should we add next?

Machine-readable version: `../data/methods.json` (20 methods, 5 gaps, ranked add-next list).

**Evidence tags.** **[code]** = read in this repo on 2026-11-07. **[paper]** = a published source (DOI resolved on Crossref where it says "verified"). **[est]** = my engineering estimate for an Apple Silicon Mac in Chrome WebGPU. These are not measurements, so profile before relying on them.

---

## 1. What the generator actually does today [code]

| Layer | How it is built | What follows a dragged dial |
|---|---|---|
| Terrain | `makeTerrainHeight` (CPU) runs once at build time from `preset.dials.heat`, `derived.snow/life` and `sea.acid`. The result is baked into 4 concentric ring meshes as vertex positions and normals. | **Colour only.** `uRock` updates in `update()`. `uCrust = uniform(tp.acid)` is created but never updated. The ground's shape does not change. |
| Spires | Swept tubes (`geo.ts addTube`) built once per preset | `scale.y` follows `spireHeight`. Filler spires grow in and out with `builders`. |
| Pores | 3D Worley F1 baked into two RGBA8 textures in (angle, height) space. Each cell stores a hash `t`. | Live: a pore exists when `uniforms.pores > t`. The baked push-in is fixed. |
| Arches | A tube along a raised curve between two feet | `archSurvive` thins and crumbles it as `arches` drops |
| Walls | Displaced slabs that share the spire material | Stain and colour |
| Water | **None.** There is no sea, river or pool surface anywhere. | — |

**Doc/code drift.** `docs/features/world-generator.md` §3 says terrain is a "GPU-displaced plane (TSL `positionNode`)". In the code it is a CPU bake. The generator's core promise ("dragging a dial morphs the place") holds for palette, stain, snow, glow, flora and spire height, but **not for landform shape**. Today a hot world built from the eco-04 layout would keep eco-04's cold walls.

**Inverted rule for canyons.** `wallH = clamp(valleyWidth·0.45, 7, 40) · mix(1, 0.3, hot) · …`, so **heat lowers the valley walls**. That suits eco-01's open plain, but eco-10 (hot, very old) is a deep canyon.

**No stone for carbon worlds.** `builders = smoothstep(0.45, 0.8, si+o)·age`. eco-03 (C heavy) gets builders ≈ 0, so no pillars grow.

## 2. Architecture first: move height onto the GPU

Nearly every technique below assumes the height lives on the GPU. Here is the minimum change:

1. **Height texture.** A 1024² `r32float` storage texture covers the central ~512 m at 0.5 m per cell. **Layer 0** is a TSL port of `makeTerrainHeight` that reads uniforms, so it morphs live. **Layer 1** is an erosion/deposit delta written by compute passes. The far rings stay analytic.
2. **Vertex sampling.** Terrain `positionNode` samples `base + delta`, with normals from central differences in the vertex stage. Flora and spire feet sample the same texture in their own `positionNode` from the instance's xz. That removes the CPU `ctx.terrainHeight` dependency, so there is no readback.
3. **Morph-then-settle.** Analytic layers morph every frame. Simulated layers re-run on a ~150 ms debounce after a dial stops, spread at 4–8 iterations per frame, and cross-fade old → new delta with a uniform. **Tie the iteration count to `age`.** Then scrubbing Time literally runs erosion, which is the atlas's "fast-forward = ten thousand years of the same rules". Scrubbing Time backwards needs cached keyframe deltas, for example at age 0, .25, .5, .75 and 1, blended.
4. **API check [code].** r187's `three.tsl.js` exports `storageTexture`, `textureStore`, `instancedArray`, `attributeArray`, `workgroupArray` and the atomics. WGSL atomics are integer only, so any scatter kernel (droplets, dune slabs) accumulates in fixed point. This is the same trick as design A's `h0` buffer. Gather kernels (pipe model, thermal, Werner avalanche) need no atomics.

## 3. Techniques, landform by landform

| Landform | Method | GPU/CPU | Cost [est] | Dials | Live? |
|---|---|---|---|---|---|
| **Canyons, gullies** | **Pipe-model hydraulic erosion** (Mei, Decaudin & Hu 2007, doi:10.1109/PG.2007.15). Flux → water/velocity → erode/deposit with capacity `Kc·sinα·|v|` → semi-Lagrangian sediment advection → evaporation. Layered hardness (Št'ava et al. 2008 SCA) gives stepped walls and caprocks. Jákó & Tóth 2011 run hydraulic and thermal in one GPU loop. Schott et al. 2023 (doi:10.1145/3592787) cover large-scale interactive authoring. | GPU, 5–6 passes per iteration | 512²: ~0.15–0.3 ms per iteration. 300–800 iterations, so a 60–250 ms bake spread over frames. | age = iterations; liquid(sea, heat) = rain; heat = evaporation; si+o = hardness | Re-bake (cross-faded) |
| Gully detail | **Droplet erosion** (Lague 2019 github.com/SebLague/Hydraulic-Erosion; Beyer 2015) with u32 atomics | GPU (atomics) | 100–300k drops, ~10–40 ms | same | Re-bake |
| **Scree, talus, slumped mesas** | **Thermal erosion** (Musgrave, Kolb & Mace 1989, doi:10.1145/74334.74337), gather form. Talus angle `70° − 45°·heat` (doc A §4.6). | GPU, 1 pass | ~0.05–0.1 ms per iteration | heat, age, snow | **Yes**, runs continuously |
| Eroded ridges (cheap) | IQ derivative-damped fBm (iquilezles.org/articles/morenoise) | GPU vertex | ~0.3–0.6 ms | erosion, age | **Yes** |
| **Mesas, caprocks, hoodoos, canyon walls, tiers** | **Strata hardness** `H(y) = hash(floor((y+warp)/bandH))` plus hard cap bands. (a) Terrace height through H, giving vertical risers at hard bands, **live**. (b) Feed H as erodibility into the hydraulic and thermal kernels, so soft layers undercut caps, **bake**. (c) Colour bands from an epoch palette, **live**. | GPU | <0.1 ms live | si+o (contrast), age (bands), sea (stains), seed | **Yes** (a, c) |
| **Tiered pillars, sea stacks** | `addTube` with a terraced radius `r(t)·(1 − notch·bump(fract(t·tiers)))` and a waterline undercut. Store the radial direction as an attribute so tiers and notch can deform live in the vertex stage. | CPU once + GPU | ms once | age (tiers), water·heat (undercut), c vs si (round vs sharp) | **Yes** |
| **Arches in walls / fins** | SDF slab minus an ellipsoid or capsule, joined with smooth-min (IQ distfunctions, smin). Physical basis: arches survive where low stress allows erosion and the load path stabilises them (Bruthans et al. 2014, doi:10.1038/ngeo2209). Peytavie et al. 2009 (doi:10.1111/j.1467-8659.2009.01385.x) and Paris et al. 2019 cover volumetric terrain. Mesh with marching cubes in a worker, or **fake it live** with a fragment discard and a dark rim on the existing slab. | CPU worker / GPU fake | 30–150 ms per fin; fake ~0.05 ms | arches, erosion | Fake yes, mesh re-bake |
| **Living arch (eco-13)** | Extend the existing tube: rust rings from the `aT` attribute × ringCount(age), instanced violet crystal studs on the tube's vertices, and flora placed on arch tops (normal.y > .6) | CPU once + GPU | <0.2 ms | arches, age, recipe.o, life | **Yes** |
| **Tafoni, honeycomb** | Existing Worley bake. Upgrades: nested multi-scale pits (small pits on the rims of big ones), F2−F1 ridges, bias to shaded and lower faces | CPU bake + GPU threshold | as now | pores, erosion | **Yes** (threshold) |
| **Dune fields** | **Werner 1995 slab CA** (doi:10.1130/0091-7613(1995)023<1107:EDCSAA>2.3.CO;2): lift a slab, hop L cells, deposit with p_sand/p_bare, a 15° shadow zone always sticks, then avalanche. Desertscape (Paris et al. 2019, doi:10.1111/cgf.13815) adds vegetation and bedrock. **Live fake:** a warped skewed sawtooth along the wind axis. | GPU (atomics) / vertex fake | CA 0.5–2 s; fake <0.1 ms | heat > .7, age, seed (wind) | Fake yes, CA no |
| **Sinter / travertine terraces** | Rimstone feedback: deposition is fastest where the film speeds up at convex lips, so rims grow and pools pond behind them (Veysey & Goldenfeld 2008, doi:10.1038/nphys911; Hammer et al. 2007). **Live fake:** Worley cells with raised F2−F1 rims, flat floors and a water plane per pool. | GPU compute / vertex fake | 200–1000 iterations; fake <0.1 ms | si (sinter) or c (travertine), heat, age, acid | Fake yes |
| **Tufa towers, chemical-garden tubes** | DLA (Witten & Sander 1981, doi:10.1103/PhysRevLett.47.1400) with an upward bias, or cheaper, a guided tube skeleton along a noisy buoyant plume with radius pulses for rupture and re-seal (Barge et al. 2015, doi:10.1021/acs.chemrev.5b00014) | CPU worker | 5–50 ms per tower | si+o, heat, age, sea | Re-bake (grow-in can be animated) |
| **Karst towers** | Dissolution along a Voronoi joint network: lower by `dissolve·(1 − cellCentreness)`, so cell cores stay as towers and joints become corridors, with an undercut at the water table | GPU vertex fake / CA | <0.2 ms / 50–200 ms | water+acid, age, recipe.c | Fake yes |
| **Patterned ground** | Worley F2−F1 polygons and circles (fragment shader plus a small vertex dip). Physical basis: Kessler & Werner 2003 (doi:10.1126/science.1077309). Gray-Scott reaction-diffusion if labyrinths are wanted. | GPU | <0.1 ms | snow, heat (salt or mud cracks), age | **Yes** |
| **Columnar jointing** | Hex-jittered Voronoi prisms: per-cell top height. Width follows cooling rate (Goehring, Mahadevan & Morris 2009, doi:10.1073/pnas.0805132106). | GPU / instanced | <0.2 ms | heat (width), si (glassy), age | **Yes** |
| **Rivers, streambeds** | (a) **Hero river:** carve along the existing valley spline `h −= depth·(1 − smoothstep(0, w, dist))`, plus a liquid ribbon mesh. (b) **Network:** priority-flood (Barnes 2014) → D8 → flow accumulation → stream power `K·A^m·S^n` (Cordonnier et al. 2016, doi:10.1111/cgf.12820), or a river graph first (Génevaux et al. 2013, doi:10.1145/2461912.2461996). | (a) GPU, (b) CPU worker | (a) <0.1 ms; (b) 50–500 ms | liquid(sea, heat), age (incision), sea (colour) | (a) **yes** |
| **Sea / liquid surface** | A plane at seaLevel in the world material with a depth tint from the height texture, a foam band and Voronoi caustics on the bed | GPU | <0.3 ms, 1 draw | sea, heat (is it liquid?), light | **Yes** |
| **Sediment epochs** (doc A §4.3) | Stateless: a seeded epoch palette around the current stain, band count = f(age). Stateful: a 16-entry ring of (sea, heat) snapshots taken on dial release, indexed by `floor(worldY/bandH)`. Changing Sea leaves a band. | GPU fragment | <0.05 ms | sea, age, heat | **Yes** |

**Pattern.** Every simulated method has a cheap analytic look-alike that morphs live. The pragmatic recipe is to **ship the analytic version first**, then layer the simulation on top as a debounced, cross-faded, age-driven delta where it adds visible value. Hydraulic erosion for canyons is the main case.

## 4. Gap analysis for the four target pins

| Pin | What exists | What is faked or wrong | What is missing | Fix | Effort |
|---|---|---|---|---|---|
| **eco-10 Red Canyon** | Valley spline with rising walls, hot terraces, iron stain, cap flora (`capWidth`) | Heat *shrinks* walls (`mix(1, .3, hot)`). Terraces are on the plain, not the walls. | Near-vertical banded walls, talus blocks at wall feet, a dry winding streambed, the parasol tower, a clear sky-blue anchor, a preset | Canyon term (wallH ∝ age·liquid history); hardness terracing + strata colour; instanced talus (density = erosion); spline streambed carve; parasol = spire tube + lathe disc cap (radius from light); eco-10 preset at valleyWidth ~40 | M |
| **eco-15 Lantern River** | Valley, arches, cold methane palette, glow flora | — | **Any liquid**, a channel carve, bank-aware flora | River ribbon with white methane, flow-scrolled noise and mist; bed carve; flora density peak at dist ≈ w; eco-15 preset | S |
| **eco-13 Living Arch** | Tube arches, survival thinning, stain field | Arches exist only as `builders·(1−heat)²` between spire feet | Rust ring banding, violet crystals, shrubs *on* the arch, a gnarled thick variant with flaring root feet, an ammonia palette anchor | `aT` rings × epoch palette; instanced crystals; surface-sampled flora placement; eco-13 preset | M |
| **eco-03 Sindha pillars** | Tube spires, stain | — | A sea plane, caustics, tiered profiles, agate-like bands, **any stone at all in a carbon-heavy world**, a top-down camera | New `reefs` derived value (e.g. `life·water·smoothstep(.4, .7, c)`, tagged [game]); tiered lathe; high-frequency warped bands; sea plane; preset | M |
| **All pins** | Live palette, stains, flora, spire height | Terrain shape and pore geometry are fixed per preset. The spec claims GPU displacement. | Live landform morph | GPU heightfield (§2); update the spec | M |

## 5. Ranked "add next" (atlas impact ÷ effort)

1. **Liquid surface** (sea plane + river ribbon, depth tint, foam, caustics). **S.** Unlocks eco-15, eco-03, eco-06 and eco-11. Nothing with water can be shown today.
2. **Strata bands + hardness terracing** (live colour and risers, epoch palette). **S.** Gives canyon walls, tiered pillars and rust rings from one function.
3. **Terrain height on GPU** (TSL `positionNode` or storage texture, uniforms updated in `update()`). **M.** Fixes the core promise.
4. **eco-10 pack:** canyon term, talus boulders, parasol tower, preset. **M.**
5. **eco-03 pack:** `reefs` value, tiered lathe, preset. **M.**
6. **eco-13 pack:** arch rings, crystals, on-arch flora, preset. **M.**
7. **Thermal erosion compute** (continuous, heat-driven talus). **S** once item 3 exists.
8. **Pipe-model hydraulic erosion** (debounced, cross-faded, iterations = age). **L.** The best canyon realism and the highest risk.
9. Analytic dunes, patterned ground, columnar jointing. **S.** Ground texture; no pin needs them.
10. Werner CA, sinter growth, tufa/DLA, karst CA. **M.** Off-board world types; only if time remains.

## 6. Open questions

1. **Canyon vs plain is not a dial difference.** eco-01 and eco-10 have nearly the same dials (Si+O, water, hot, bright, old). Do we accept the canyon as preset framing (valleyWidth), or add a rule? For example, canyon depth ∝ age × *past* liquid, which would need sediment-epoch state.
2. **Should carbon build stone?** eco-03 needs pillars in a C-heavy world, but R2 says "carbon rusts to air". A carbon reef (carbonate, as on Earth) would be a new [game]/[sci] rule.
3. **Time scrubbing backwards with simulated erosion:** keyframe caches (memory, a few 4 MB textures) or analytic-only below some age?
