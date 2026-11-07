# Art direction: Red World

The art direction for the project, adopted 2026-11-07. It replaces every earlier art-direction doc ("Colour is alive", v2 and pixel), which have been removed. The reference build is `mockups/red-world/`, its brief is `docs/features/red-world.md`, and the stills are in `design/iteration/*-red-world*` and `*-red-flora*`.

**One line:** a vast, silent alien desert with red ground, white sky and colossal procedural plants, pixel-rendered like hand-placed concept art.

## 1. Rules

1. **Two colours own the frame.** The ground is red (vermilion to crimson). The sky is white (warm at the horizon, faintly cool at the zenith). Everything else is a shade of those two, plus ink.
2. **One accent.** Cyan bioluminescence (`glow #3ff5e0`, `glowDeep #0f8f9a`) covers under 5% of the pixels; the reference frame measures 0.25%. Glow sits on pods, cores, gill lines and spores, and it pulls toward the focal point.
3. **Distance fades to white.** Atmospheric perspective lifts toward the sky colour, never toward blue. Each depth plane gets a value band: the **foreground** is darkest (ink, maroon), the **midground** is full red with the strongest contrast, and the **background** dissolves into white.
4. **Plant value inverts with height.** Bases are ink/maroon so they separate from the red ground. Tops are crimson, blush or bone so they read against the white sky.
5. **Scale is the eeriness.** Plants are 60–180 m tall and landforms are kilometres across. A 1.8 m explorer makes the scale obvious. Motion is slow: sway, drifting spores, a tiny camera drift.
6. **Composition.** Each frame has one focal point on a thirds line, with the strongest dark-vs-white contrast in the image. A leading line brightens toward the focal point. Foreground silhouettes break the frame edge. The sky takes 35–50% of the frame, and the planes overlap.

## 2. Palette

`PALETTE` in `mockups/red-world/src/contracts.ts` is the single source. All colour comes from it.

| Role | Keys |
|---|---|
| Sky and air | `skyZenith #eef0f4`, `skyHorizon #fff6ee`, `haze #fde9e2` |
| Ground | `redLight #ff5a36`, `red #e8331f`, `crimson #a8122a`, `maroon #5c0a1e` |
| Ink and outline | `ink #22060f` |
| Plant highlights | `bone #f4e6dc`, `blush #f2a2a0` |
| Shadow tint | `shadow #8a0f3c` (coloured shadow, never grey) |
| Accent | `glow #3ff5e0`, `glowDeep #0f8f9a` |

## 3. Rendering (Bruno Simon folio-2025 techniques, MIT)

- **One world material.** `MeshLambertNodeMaterial` with a custom `outputNode`. Shading order: vertex colour, then ground bounce from the terrain field, then a cel core-shadow terminator, then the captured cast shadow tinted toward `shadow`, then range fog toward the haze.
- **Glow and sky.** Bloom threshold is 1. Only luminance-normalised emissives with HDR above 1 bloom. The sky is a `backgroundNode` gradient plus one huge low-contrast ringed planet.
- **Pixel pass.** Render at about 360 px internal height and upscale with nearest-neighbour. Quantise shading into steps. Draw a 1 px ink outline from depth. Dither only in the sky. `?style=smooth` is the comparison view.
- **Not used:** tilt-shift DOF (it fights the pixels), high diorama camera angles, photo textures.

## 4. Flora

The flora is seeded and procedural. Every species is generated once into merged-geometry archetypes and instanced across the map (`mockups/red-world/src/flora/`). The current species are:

- parasol titans: stacked cupped discs with gill undersides banded crimson to bone
- coil spires
- lantern pods
- crozier weepers
- rib fans and crinoids
- ground cover

The body plans are alien: radial symmetry, spirals, bulbs, discs and ribs. Silhouettes have to read at thumbnail size.
