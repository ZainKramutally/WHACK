# Red World: concept-art pass

A standalone three.js scene, `mockups/red-world/`, built to answer one question: how good a single frame can we make? It doesn't share code with `mockups/worlds/`, and it doesn't take its look from the earlier art-direction docs.

**Target:** one frame that could pass for a painted concept artwork of a vibrant, eerie alien ecosystem. It renders in real time and is pixel-rendered. The ground is red, the sky is white, and huge procedural alien plants are generated once and then scattered across the map. Composition matters more than anything else.

## 1. Pillars

1. **Two colours own the frame.** The ground is a saturated **red** (vermilion to crimson). The sky is **white** (warm paper-white near the horizon, very slightly cool at the zenith). Every other colour is either a shade of one of those two or a small accent.
2. **Scale is the eeriness.** The plants are vast: parasols the height of skyscrapers and stalks that go up into the haze. The landforms are bigger still. A tiny 1.8 m explorer figure makes the scale obvious. Nothing moves fast. The mood is quiet and silent.
3. **Depth through value.** Atmospheric perspective goes toward **white**, not blue. The foreground is darkest and most saturated, the midground holds the hero contrast, and the background dissolves into the sky. Each plane gets its own value band (§3).
4. **One accent, used sparingly.** The accent is bioluminescent **cyan/teal** (`#3ff5e0` family), red's complement, and it covers under 5% of the pixels. It shows up as pod cores, pores and a few drifting spores. Near-black maroon (`ink`) is the graphic dark.
5. **Pixel-rendered and crisp.** The scene renders at a low internal resolution, upscales with nearest filtering, uses stepped palette bands, and draws a 1 px dark outline on silhouettes. It should look like hand-placed pixel concept art, not a blurry downscale.

## 2. Rendering pipeline: Bruno Simon folio-2025 approach

The code is MIT, © 2025 Bruno Simon. Port the **techniques** and never copy assets. The source is cloned at `/tmp/whack-src/bruno-simon` (key files: `sources/Game/Materials/MeshDefaultMaterial.js`, `sources/Game/Rendering.js`, `sources/Game/Passes/cheapDOF.js`, `sources/Game/Ligthing.js`, `sources/Game/Fog.js`, `sources/Game/Terrain.js`, `sources/Game/World/Foliage.js`). Our teardown is `research/sites/bruno-simon/BREAKDOWN.md` §3 and §12.

- `WebGPURenderer` (`three/webgpu`) with TSL only, `RenderPipeline`/post nodes as in `Rendering.js`.
- **One world material** (a `MeshLambertNodeMaterial` with a custom `outputNode`), as in `MeshDefaultMaterial.js`. It does five things:
  - Takes base colour from vertex colour or palette.
  - Adds a **ground-bounce** term: down-facing normals pick up the red of the ground, which ties the plants into the ground.
  - Applies a **cel core-shadow terminator** (`smoothstep` on N·L).
  - Captures the **cast shadow** from the shadow map and uses it as a mask.
  - Tints shadow areas with a **saturated shadow colour** instead of darkening them (deep crimson-magenta on red, never grey), then mixes in **range fog toward the sky white**.
- A single `DirectionalLight` exists only to produce the shadow map. The shading reads a direction uniform.
- **Bloom** uses threshold 1. Only emissives with HDR > 1 bloom, and the emissive colour is luminance-normalised (`col / luminance(col) * k`).
- The sky is `scene.backgroundNode` with a gradient: zenith slightly cool white, horizon warm white, plus one huge pale disc. That could be a giant pale planet or a ringed moon, very low contrast, white on white.
- **Pixel pass:** render at about 360 px internal height, nearest-upscale, and quantise into per-material ramp steps. Optionally add an ordered dither *only* inside the sky/fog gradient. Draw the depth/normal edge outline in `ink`. `?style=smooth` turns pixelation off for comparison.
- Adapt Bruno's tilt-shift `cheapDOF` toward depth: soften only the extreme foreground framing elements, or drop it if it fights the pixels.

## 3. Composition (the frame)

Use a 16:9 hero frame (1920×1080 capture) with a cinematic **low** camera at 1.6 to 6 m eye height and a fov of 35 to 45°. Don't use Bruno's high diorama angle.

| Plane | Distance | Value | Content |
|---|---|---|---|
| **Foreground** | 0 to 40 m | darkest, most saturated (`ink` and deep `crimson`) | Cropped plant silhouettes that frame the image: an overhanging parasol cap or drooping tendrils in a top corner, spiky ground cover and pods along the bottom edge. Breaking the frame edge creates depth. Some accent glow sits here. |
| **Midground** | 40 to 600 m | full red, strongest light/shadow contrast | The **focal point**: one colossal hero plant or a natural arch with a plant growing through it, placed on a rule-of-thirds line. A dry riverbed or crack forms an S-curve leading line from the bottom of the frame to the focal point. The tiny explorer stands on the line. Hero groves of giant plants repeat with diminishing size to show depth. |
| **Background** | 600 m to 8 km | lifted toward white, low contrast | **Macro structures**: colossal mesas/buttes, a giant natural arch or rib-like ridges, mountain silhouettes, and far plant forests that read as texture. Each band gets paler. The farthest one is barely a tint against the sky. |

Composition rules:
- Overlap creates depth: every plane partially occludes the one behind it.
- Group values: the foreground is dark, the midground mid, the background light. Don't let a background element be darker than the midground.
- Use a strong silhouette against the sky. The hero plant's cap should read as a shape against white.
- Use asymmetry. The sky takes about 35 to 50% of the frame and the horizon isn't centred.
- Drifting spores, motes and haze layers give the air depth (light sparse particles; a few cyan ones glow).
- Movement is slow and subtle: plants sway (weighted by the `aSway` attribute) and spores drift. The default camera is the hero shot with a tiny drift. `?free` gives orbit controls.

## 4. Flora: procedural, generated once, instanced

Each species generator is seeded. It builds a small number of variants (3 or 4) once at startup into merged `BufferGeometry` objects. These are placed as `InstancedMesh` with per-instance scale, yaw and tilt jitter. The contract is in `mockups/red-world/src/contracts.ts`.

The flora should be alien and not Earth-like. Use non-terrestrial body plans: radial symmetry, spirals, bulbs, discs, ribs and translucent pods. Sizes should be extreme, and the silhouettes should read at thumbnail size. Suggested species (the flora agent may replace or add to them):
- **Parasol titan** (hero, 60 to 180 m): a tapered segmented stalk with collar rings and 1 to 4 stacked, slightly cupped discs with gill ribbing underneath. The cap tops are pale/bone, the undersides crimson.
- **Coil spire** (30 to 120 m): a helical corkscrew stalk that tapers to a bulb or a fan of filaments.
- **Lantern pod cluster** (5 to 25 m): bulbous pods on thin curved stems with cyan emissive cores (an accent carrier).
- **Weeper** (15 to 60 m): an arching spine with long drooping filaments, good for foreground framing.
- **Fan coral / rib fan** (10 to 40 m): a flat branching fan, generated with an L-system or space colonisation.
- **Ground cover** (0.3 to 3 m): urchin spikes, polyp nubs and crimson bristle tufts, dense near the camera.

Colour comes from the shared `PALETTE` only, through vertex colours. `aGlow` (0 to 1) marks emissive parts and `aSway` (0 to 1, 0 at the base) is the wind weight.

## 5. Done when

- `npm run dev` in `mockups/red-world` shows the hero frame at 60 fps on this Mac in pixel mode, and `?style=smooth` works.
- `npm run capture` (or `python3 scripts/capture.py`) writes `design/iteration/{stamp}-red-world/hero.png` (pixel), `hero-smooth.png` and a fps line.
- The frame meets §1 and §3: red and white dominate, the accent stays under 5%, there are three readable depth planes, there's one clear focal point, there's a leading line, the explorer is visible, and foreground plants break the frame edge.
- Typecheck and unit tests pass. Tests cover the pure logic only: seeded RNG determinism, placement/Poisson spacing, and geometry attribute invariants.
