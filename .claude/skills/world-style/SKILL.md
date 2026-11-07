---
name: world-style
description: The shared 3D stack and visual style for this project. Read before any three.js, shader, lighting, material, camera, physics or asset work, and before using any other threejs-* or webgpu-threejs-tsl skill. It decides which skill wins when they disagree.
---

# World Style

One world, one look, one stack. The other 3D skills are references. **This file is the contract.** When a skill's example contradicts this file, this file wins.

## Stack (locked)

| Concern | Decision | Not this |
|---|---|---|
| Library | Vanilla **three.js r187** (`three@^0.187`), ES modules, Vite | React Three Fiber, A-Frame, Babylon |
| Renderer | `WebGPURenderer` from `three/webgpu` (falls back to WebGL2 automatically) | `WebGLRenderer` |
| Shaders | **TSL** node materials (`three/tsl`) | GLSL `ShaderMaterial` / `onBeforeCompile` strings |
| Post-processing | `RenderPipeline` + TSL nodes (bloom, DOF) | `EffectComposer` from `three/addons/postprocessing` |
| Physics | **Rapier** (`@dimforge/rapier3d-compat`, no wasm plugin needed). Delta clamped to 1/30, vehicle step ≤ 1/60. Primitive colliders authored in Blender by name. Built-in raycast vehicle (`world.createVehicleController`). | cannon, ammo, colliders built from the visual meshes, a hand-rolled car |
| Assets | Blender → glTF (`.glb`), meshopt or Draco, KTX2 textures | FBX/OBJ at runtime, PNG textures over 1k |
| Debug UI | `tweakpane` behind `#debug`, `stats-gl` | dat.gui |
| Audio | `howler` | raw WebAudio unless we need synthesis |
| Units | Metres, **Y-up** (the 2019 site is Z-up, so convert anything ported from it) | — |
| Loop | One tick bus: `events.on('tick', fn, order)`. Inputs 0, physics 3, sync 4, camera 7, render 998. One `time.scale` drives the ticker, gsap and audio rate. | Several `requestAnimationFrame` loops |
| Debug flags | URL hash: `#debug` (tweakpane), `#stats`, `#skip` (fast intro) | Debug UI shipped to the demo |

Why: it matches Bruno Simon's 2025 portfolio (`research/sites/bruno-simon/BREAKDOWN.md`), so his techniques port directly. It's also what `webgpu-threejs-tsl` (Dan Greenheck, the author of threejsroadmap.com) teaches.

## Which skill owns what

| Need | Use | Ignore in it |
|---|---|---|
| Renderer setup, TSL, node materials, compute, post-processing | `webgpu-threejs-tsl` | — |
| Scene, camera, loop, resize, transforms | `threejs-fundamentals` | `WebGLRenderer` examples. Use its WebGPU/TSL section. |
| Loading glb/KTX2/HDR, progress, disposal | `threejs-loaders` | — |
| Lights, shadows, environment | `threejs-lighting` | GLSL snippets |
| Clips, skeletal, procedural motion | `threejs-animation` | — |
| Raycast, controls, pointer and touch | `threejs-interaction` | — |
| fps, draw calls, instancing, quality tiers | `threejs-performance` | — |
| Game loop, input, camera follow, Rapier, game feel | `threejs-gameplay-systems` (+ its `references/`) | Its scaffold and design-brief process. We use `SPEC.md`. |
| Learning from an inspiration site | `web-clone` | Pixel cloning |

Sibling skills these mention but we **didn't install** (`threejs-shaders`, `threejs-postprocessing`, `threejs-materials`, `threejs-textures`, `threejs-geometry`, `threejs-asset-pipeline`, `threejs-react-three-fiber`) have been replaced by `webgpu-threejs-tsl` and this file.

## Look and feel

> **Status: DRAFT.** Taken from the two Bruno Simon teardowns (`research/sites/*/BREAKDOWN.md`, which cite exact hex values and file:line). It's the default *family*, a **toy diorama**. Once `/spec` picks the idea, the team **replaces the palette and mood with our own**, because a straight copy of Bruno's orange-and-violet world will read as seen-before. Keep the *construction rules*. Change the *colours and subject*.

> **Palette, mood and creature look are now set by [`docs/ART_DIRECTION.md`](../../../docs/ART_DIRECTION.md)** ("Colour is alive"). It replaces the Bruno colours below. Its §9 lists the deltas to this file.

**Construction rules (keep):**
- **One material for the whole world.** A single shared TSL node material (Lambert-based with a custom `outputNode`) handles flat palette colour, ground-tinted bounce light, a cel-step core shadow, **coloured shadows**, fog and the reveal discard. New props never get bespoke materials.
- **Palette texture.** Props sample one small palette image (≤ 32 swatches, `NearestFilter`) by UV. Artists paint UVs onto swatches in Blender. Colour changes happen in one file.
- **Shadows and bounce are coloured, never grey or black.** Pick a saturated shadow hue that complements the key light (Bruno: warm key over violet shadows).
- **Glow only through HDR.** Bloom threshold 1.0 at low strength (~0.25). Only emissives above 1 glow. Nothing else blooms.
- **Tilt-shift DOF** blurs the top and bottom thirds and keeps the middle band sharp. This is what makes it read as a *miniature*. **Pond/sim view only.** Full-scale environments (`docs/features/world-generator.md`) drop it and sell scale with layered aerial haze, a low eye-level camera and landforms running out of frame.
- **Fog** in palette colours hides the edge of the world. The world ends in mood, not in a void.
- **Shape language:** chunky, rounded, low-poly, slightly oversized relative to the player. No outlines. No photo textures.
- **Colliders from Blender names:** nodes named `physical-fixed|dynamic`, children `cuboid*` / `ball*` / `hull*` / `trimesh*`. No code per prop.

**Camera:** a high three-quarter angle (about 45° yaw, looking down), **narrow lens (FOV 25–40)**, exponential follow (lerp ≈ 0.15 per frame-normalised step), slight roll and zoom-out with speed. The player sits just below the centre of the frame. The camera never snaps.

**Motion:** springy, with overshoot. gsap `back.out(1.7)` for things appearing, `back.in` for things leaving, `power1.inOut` for 2s camera transitions. Physics suspension squat and hop. Bounce on collision.

**First 15 seconds** (this is the hook, see `docs/TRACK.md`):
1. The loader *is* the first scene: a ring or shape whose fill shows load progress, on a dark void.
2. It collapses, then the world **bursts open in a circle** (a reveal-radius uniform driving a discard, with `back.out` overshoot and a glowing rim in a palette colour).
3. One click expands the reveal to fill the screen, unlocks audio and gives control. The world is playable with zero HUD.
4. Instructions live *in the world* (decals on the ground, keycap meshes), not in DOM overlays.

**Living world:** a `Cycles` module lerps light, shadow, fog and ambient sound between keyframes. Bruno uses the real clock. **For "New Worlds", drive it from our data or concept.**

**Type and UI:** one rounded display face and one body face. In-world labels on dark translucent bars. A DOM overlay only for things that truly need it, and never covering the world for more than 2s.

**Sound:** warm and tactile foley (wood, plastic, soft thuds). Every collision makes a sound scaled by impact force, with a randomised pitch of ±10%. An ambient bed changes with the cycle. Global volume 0.5.

## Rules for agents

0. r187 facts (verified in `mockups/worlds/scripts/smoke.py`): `material.positionNode` runs **after** instancing, so sway is `positionLocal.add(offset)`. The sky goes on `scene.backgroundNode`, not `scene.background`. `MeshToonNodeMaterial` has no `flatShading`, so use a dFdx/dFdy `normalNode`. `PCFSoftShadowMap` is gone.
1. Import from `three/webgpu` and `three/tsl`. Never mix `three` and `three/webgpu` renderer imports.
2. Use the shared world material and palette texture. If you think you need a new material, ask first.
3. Author physics colliders as named primitives in Blender (see the construction rules), separate from the visual meshes.
4. Any new effect needs a quality-tier flag (`low` / `high`) so the demo laptop holds 50 fps or more.
5. If you need something this file doesn't cover, follow the owning skill above. If two skills disagree, ask the team lead and record the decision here.
