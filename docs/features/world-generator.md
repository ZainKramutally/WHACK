# Feature: world generator (environment mockups v1)

> **One generator, many worlds.** The world is a *continuous function of the dials*. Four presets reproduce four pins (ecosystem 01, 04, 12, 14) from fixed camera angles. Dragging a dial morphs the place you're standing in, live. This proves the WORLD_ATLAS claim that every pin is reachable with a few dials.

Status: **approved, building.** Inputs: `docs/WORLD_ATLAS.md` (rules R1–R12, dial table §5.3), `docs/ART_DIRECTION.md` (unified look), `.claude/skills/world-style` (stack). Pins: `research/visual/pinterest-silicon/ecosystem/`.

Scope: **environments and flora only.** No fauna and no Hunger dial yet.

---

## 1. Dials (inputs)

| Dial | Type | Range | Notes |
|---|---|---|---|
| `recipe` | `{c, si, o}` | barycentric, sums to 1 | Atlas Recipe triangle |
| `sea` | weights `{water, ammonia, methane, acid}` | sums to 1 | A blend, not an enum, so the sea can morph |
| `heat` | float | 0 cryo · 0.5 Goldilocks · 1 scorching | |
| `light` | float | 0 dark · 1 blazing | |
| `age` | float | 0 young · 1 ancient | Atlas "Time". Fast-forward = scrub this. |
| `seed` | int | | Layout randomness only |

## 2. Derived parameters (the emergence layer)

Each output is a pure function of the dials, implemented in one file (`derive.ts`) with a Tier 0 test per preset. Everything downstream reads **only** these values (as TSL uniforms where possible), so dial changes morph the world continuously.

| Output | Rule | Formula sketch | Atlas |
|---|---|---|---|
| **Field palette** (sky top, horizon, fog, ground, shadow, haze) | The sea paints the sky; heat bleaches it; dark deepens it | **Calibrated palette field**: inverse-distance blend over anchors in (sea, heat, light). The anchors are the 4 pins (measured, §4) plus ART_DIRECTION's sea palettes at heat 0.5 / light 0.6. Exact at the anchors, smooth between them. | R4 |
| `stoneColor` | Stone takes stains | `mix(bone #ECE4D6, stain(sea), sat(age·(0.3+heat)·1.4))`. Applied per fragment with **height falloff** (low = older = more stained, tips stay paler) and noise streaks, so stone always shows a bone→stain gradient. Stains: water `#F94B1E` iron, acid `#A47C68` tan, methane `#C3C4D4` (barely stains), ammonia `#5A3B52` plum | R3 |
| `builders` | Silicon rusts to stone; old colonies become spires | `smoothstep(0.45, 0.8, si+o) · age` | R2, R12 |
| `spireHeight` | Cold is slow is giant | `(0.4+0.6·age)·(1.3−0.6·heat)`, × 80–220 m | R6 |
| `erosion` | Heat over time wears pores shut and sharpens spires | `heat·age` → fewer pores, thinner, more jagged | R3, R6 |
| `pores` | Builders leave homes | `sat(si·o·5)·(1−erosion²)` | R12 |
| `arches` | Spires that lean together fuse; only cold keeps them standing | `builders·(1−heat)²` | R12, R6 |
| `snow` | Methane cold frosts the ground | `sea.methane·(1−heat)²` | R4 |
| `life` | Life peaks in the Goldilocks band | `exp(−((heat−0.5)/0.28)²)` | DESIGN §2 |
| `glow` | Dark makes glow | `life·(1−light)^1.5` | R8 |
| `glowHue` | Life is the colour | recipe-weighted: C amber `#FFA41B`, Si cyan `#27AAA6`, O magenta `#DA1B58`. Pores always glow Spark amber/orange. | R9 |
| `capWidth` / `stalkHeight` | Light makes caps; dark makes tall reachers | `capWidth = light`, `stalkHeight = (1−light)·(1−heat)` | R7, R8 |
| `fog` | Methane is thick, heat is clear and bleached | density per sea × `(1.2−heat)`. Height fog plus distance fog. | R4 |
| `char` | Hot, bright, old: carbon survivors go black | `sat(heat·light·age·c·6)` | R6 |

### Species niches (how the flora emerges)

Every species is instanced in every world. Its **density = its niche function** over the dials. Each instance stores a random `r ∈ [0,1)` and is visible when `r < density`, with its scale easing in or out, so morphing dials grows or withers flora smoothly. Which flora appears is *emergent from the dials*, not chosen per preset.

| Species | Pin | Niche (where density is high) | Look | Rule |
|---|---|---|---|---|
| **Lantern cups** | 04 | O-rich life, dim, cold–mild | Goblet on a short stalk, Voronoi-veined membrane, hot-pink glow, colony clusters on the valley floor | R8, R9 |
| **Frost fans** *(new)* | 04 | Si life, cold, any light | Planar branching coral-fans on cliff walls, white-blue with glass rim, stiff (no sway) | R1, R6 |
| **Glow stalks** | 12 | Si life, very dim, mild | Clusters of thin pale stalks with small flat caps, cyan-white emissive, varied heights, pooled amber light at the base | R7, R8 |
| **Moss domes** | 12 | C life, mild, dim–medium | Huge soft round mounds, stacked, teal-green cel shading | R1 |
| **Shade ribbons** *(new)* | 12 | C life, dim | Tall dark-green blade fronds forming the backdrop, slow curling sway | R1, R8 |
| **Pore dwellers** | 14 | Builders + dim | Not geometry: emissive orange seated deep in spire pores, breathing pulse | R8, R12 |
| **Glass whiskers** *(new)* | 14 | Si, warm, acid | Hair-thin straight glass cilia tufts on pore rims, catch the light with fresnel, stiff micro-sway | R1, R5 |
| **Black monoliths** | 01 | `char` high | Tall charred-black obelisk plants with two curved horn tips, drip skirts at the base. Replace the pin's figures. | R6 |
| **Ash-scrub mats** *(new)* | 01 | Hot, bright, any recipe | Low dark grey-teal mats sprawled flat across the desert (the pin's smears) | R6 |

## 3. Landforms (huge, dramatic, macro)

Scale is metres, with eye height at 1.7 m. Landforms run **80–220 m**, so the near flora (0.3–4 m) gives scale against the giants. Sources of drama: low camera, landforms that run out of frame, aerial haze in layers.

| Landform | Generation | Driven by |
|---|---|---|
| **Terrain** | GPU-displaced plane (TSL `positionNode`). Base fBm + domain warp. A **valley path** spline runs along the view axis and walls rise with distance from it. Style weights: terraced plain + dune ripples (hot), smooth drifts (snow), hummocks (life, mild). | heat, snow, life, preset path |
| **Spires** | Lathe-style tapered column with high segment count, displaced by stacked lumps (3D noise) and taper `r(h)`. Jagged when eroded, fused lumps when cold. Optional horn branches near the tip (eco-01 right spire). | builders, spireHeight, erosion |
| **Pores** | In the spire material: Worley F1 threshold carves dark holes with fake depth (darken by `(1−F1/r)²`, vertex push-in where the mesh is dense). Inner glow = pore dwellers. | pores, glow |
| **Arches** | Tube along a raised curve between two spire feet, radius tapering to the crown, noise-displaced, frost-smoothed | arches |
| **Cliffs / walls** | Large displaced slabs framing the valley, sharing the spire material | builders, preset framing |
| **Sky** | `backgroundNode` gradient (top → horizon → haze band) + sun disc. **Eclipse** variant: black disc + white spiky corona with slow ray shimmer. Optional second moon. | palette, preset sky event |
| **Haze** | Distance + height fog in the world material, in palette colours. Layered depth sells the scale. | fog |
| **Motes** | Sparse drifting particles (spores, frost dust, ash) | life, snow, heat |

## 4. Presets (dials + camera + composition)

The colours are measured from each pin (`median-cut`, region means). A preset = dials + seed + camera + composition anchors (valley path, hero landmark positions, sky event). **The generator decides what grows. The preset decides where we stand and where the hero landmarks go.**

| | eco-01 Vermilion Eclipse | eco-04 Frost Arches | eco-12 Glow Garden | eco-14 Bone Reef |
|---|---|---|---|---|
| Recipe C·Si·O | .20 · .45 · .35 | .15 · .40 · .45 | .30 · .55 · .15 | .10 · .50 · .40 |
| Sea | water | methane | water | acid |
| Heat / Light / Age | .90 / .85 / .95 | .10 / .25 / .85 | .50 / .08 / .50 | .60 / .30 / .80 |
| Aspect | 0.716 (portrait) | 0.561 | 1.0 | 0.578 |
| Camera | Low on the plain, slight up-tilt; horizon at y≈0.58 | Eye level on the valley floor, wide (~60° vFOV), vanishing point centre, y≈0.55 | Eye level, close, cluster mid-right, enclosed (no horizon), floor band y 0.8–0.95 | Low on the path, looking slightly up, spires out of frame top-left and top-right, haze spires centre |
| Sky / horizon | `#B5C9C2` sage, `#C2D1C9` | `#E7E9ED`, `#F0F4F7` | `#093F1B` deep green | `#E0F0E7` mint haze |
| Ground | `#F94B1E` vermilion, `#D93A19`, `#F96C32` | `#D1DFE9` snow, `#8BADC5` | `#4D5E42`, light pool `#CBCC68` | sand path `#D6E2D9`, stone `#BAB7AD` |
| Shadow | `#201913` | `#303B51` | `#08532E` | `#524842` |
| Accent | spires vermilion; black `#201913` | glow `#DA1B58`, `#8D4468` | glow `#27AAA6`, `#5CB8B4` | pore glow `#EC5401`, `#A95734` |
| Hero landmarks | 2 tall thin spires (left tall, right with horn arms), eclipse at (0.6, 0.33), 2 monoliths (left foreground large, centre mid) | 2 interlocking arches centre, overhanging walls at the top corners, cup carpet in the foreground | Stalk cluster centre-right, domes behind, ribbons as backdrop | 2 porous spires framing the frame, 3–4 haze spires centre, crust lumps bottom-left |

## 5. Interaction

- **Pin view** (default): camera locked to the preset, canvas letterboxed to the pin's aspect.
- **Orbit** toggle for exploring.
- **Travel**: switching preset flies or crossfades to a new place.
- **Rewrite**: drag the dials at the current place. The palette, stains, snow, glow and flora morph over about 3s and the layout stays.
- Debug panel (`#debug`, tweakpane): all dials plus derived readouts. `#stats` fps.
- Still capture: a script renders each preset to `design/concept/worlds/eco-XX.png` at the pin's aspect, next to the pin, for side-by-side comparison.

## 6. Budget

≥ 50 fps on the demo Mac (Apple Silicon, Chrome, WebGPU) at 1080p-ish. Instanced flora, one shadow-casting directional light, bloom only (threshold 1). Quality tier `low` halves instance counts and spire segments.

## 7. Niche functions (exact)

`g(x, μ, σ) = exp(−((x−μ)/σ)²)`. Sea weights from `dials.sea`.

| Species | Niche |
|---|---|
| lanternCups | g(o,.45,.15)·g(light,.2,.2)·g(heat,.15,.3) |
| frostFans | g(si,.45,.2)·g(heat,.05,.2)·(.4+.6·methane) |
| glowStalks | g(si,.55,.15)·g(light,.05,.15)·g(heat,.5,.2) |
| mossDomes | g(c,.3,.15)·g(heat,.5,.2)·g(light,.2,.3) |
| shadeRibbons | g(c,.3,.2)·g(light,.1,.2)·g(heat,.5,.25) |
| poreDwellers | g(si+o,.9,.15)·g(light,.3,.2)·g(heat,.6,.25) |
| glassWhiskers | g(si,.5,.15)·g(heat,.6,.2)·(.3+.7·acid) |
| blackMonoliths | g(heat,.9,.12)·g(light,.85,.2)·g(age,.95,.25) |
| ashScrub | g(heat,.9,.15)·g(light,.8,.25) |

**Acceptance (Tier 0 test in `derive.test.ts`), checked numerically on 2026-11-07:**

| Preset | Must be ≥ 0.8 | Must be ≤ 0.15 |
|---|---|---|
| eco01 | blackMonoliths, ashScrub | lanternCups, glowStalks, poreDwellers |
| eco04 | lanternCups, frostFans | blackMonoliths, glowStalks |
| eco12 | glowStalks, mossDomes, shadeRibbons | lanternCups, blackMonoliths |
| eco14 | poreDwellers, glassWhiskers | blackMonoliths, glowStalks |

Hero landmarks in a preset are always built. Their *look* (stain, pores, snow, glow) still follows the dials. Procedural filler (extra spires, cups, scrub) follows the niche and `builders` densities.

## 8. Decisions (mid-way, 2026-11-07)

| Question | Decision |
|---|---|
| Tilt-shift | **Dropped** for environments. Scale comes from layered aerial haze, a low eye-level camera, landforms running out of frame, and tiny near-camera flora. Tilt-shift stays for the pond/sim view only (world-style updated). |
| Scale figure | **Yes**: one tiny explorer silhouette per scene in the shadow hue, toggleable (`#nofigure`) |
| Palette | **Calibrated field**: exact pin colours at the preset points, blending towards ART_DIRECTION sea palettes away from them |
| Render style | **One unified look** (ART_DIRECTION: flat cel shapes in haze). No per-pin post styles. |
| Code location | **Standalone** `mockups/worlds/` Vite project. Keeps the app scaffold free. |
| Team | 3 feature agents in parallel worktrees: **core**, **landforms**, **flora** |
| Motion | Living: sway, glow breathing, motes, haze drift, corona shimmer. Dial changes morph over ~3s. |
| Perf | ≥ 50 fps, demo Mac (Apple Silicon, Chrome, WebGPU) |

## 9. Ownership

| Area | Agent | Files |
|---|---|---|
| Contracts + presets | team lead | `src/contracts.ts`, `src/presets.ts` |
| Scaffold, renderer, RenderPipeline + bloom, sky (gradient, sun, eclipse + corona, moons), fogNode (height + distance), world material factory, `derive.ts` + palette field + tests, uniforms + morph, camera/letterbox/orbit, tweakpane, scale figure, capture script | **core** | `package.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/core/**`, `src/derive.ts`, `scripts/capture.py` |
| Terrain + `terrainHeight`, valley, spires (pores, horns, stain), arches, walls/cliffs/crust | **landforms** | `src/landforms/**` |
| All 9 species, niche thresholds, sway/glow, motes | **flora** | `src/flora/**` |

Modules register in `src/main.ts` through one line each: `modules = [landforms(), flora()]`. Core creates that line with stubs, and the other agents fill in their own module.

## 10. Verified r187 API notes (scout, 2026-11-07)

- Post: `RenderPipeline` (not `PostProcessing`), `pass()`, `bloom()` from `three/addons/tsl/display/BloomNode.js`. Call `.render()`.
- Fog: `scene.fogNode = fog(colorNode, exponentialHeightFogFactor(density, height))`. Combine it with a range/density factor for distance haze. It applies to node materials only, not the background.
- Sky: assign a node to `scene.background`. Use `positionWorldDirection`.
- Noise: `mx_worley_noise_float(p, jitter, style)`, `mx_fractal_noise_float(p, octaves, lacunarity, diminish, amplitude)`, `hash(instanceIndex)`.
- Coloured shadows: `material.receivedShadowNode = Fn(([s]) => s.mix(shadowColor, 1))`. `PCFSoftShadowMap` is removed, so use `PCFShadowMap`.
- `await renderer.init()` before `render()`. `forceWebGL: true` is the fallback.
- Fresnel: `float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(3)`.
- **Verified by core (r187):** `material.positionNode` runs **after** instancing, so `positionLocal` is already instance-transformed. Sway = `positionLocal.add(offset)`. Use `instanceIndex` for per-instance hashes.
- **Unverified, smoke-test first:** InstancedMesh shadow casting, `positionNode` sway in the shadow pass, fog vs background.
- Capture: Python Playwright `chromium.launch(headless=True, channel="chromium")` gives real Metal. Plain headless shell gives a null adapter. Use `device_scale_factor=1` and wait for `window.__ready`.
