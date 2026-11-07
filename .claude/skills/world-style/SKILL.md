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
| Physics | **Rapier** (`@dimforge/rapier3d-compat`), fixed timestep, primitive colliders | cannon, ammo, colliders built from the visual meshes |
| Assets | Blender → glTF (`.glb`), meshopt or Draco, KTX2 textures | FBX/OBJ at runtime, PNG textures over 1k |
| Debug UI | `tweakpane` behind `#debug`, `stats-gl` | dat.gui |
| Audio | `howler` | raw WebAudio unless we need synthesis |
| Units | Metres, Y-up, 60 Hz physics step | — |

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

> **Status: DRAFT.** Filled in from the Bruno Simon breakdowns. The team confirms or replaces it once the idea is picked in `/spec`. Until then it's the default.

- **Art direction:** a toy-like miniature world. Chunky, readable silhouettes. It should feel like you could pick it up.
- **Shading:** stylised, not photoreal. Baked or matcap-style lighting, plus at most one real-time directional light for shadows. Colour comes from a **single shared palette** (a palette texture or a TSL uniform set), so every asset matches.
- **Palette:** 5–7 colours max, defined once in code (`src/style/palette.*`) and in the Blender palette image. No colour is hand-picked per object.
- **Camera:** a third-person follow camera with a slightly high, three-quarter angle. Damped (lerped) and never snapping. FOV between 35 and 50.
- **Motion:** springy and physical. Things squash, bounce and settle. Ease with gsap (`power2`/`back`). No linear tweens.
- **Fog / atmosphere:** height or distance fog in a palette colour, which hides the world's edge and sets the mood.
- **Type and UI:** minimal DOM overlay. One display face and one text face. The UI never covers the world for more than 2 seconds.
- **Sound:** soft, tactile, toy-like. Every interaction has a sound. Ambient bed loops.
- **First 15 seconds:** the world reveals itself (`docs/TRACK.md` → hook). It's playable before any text appears.

## Rules for agents

1. Import from `three/webgpu` and `three/tsl`. Never mix `three` and `three/webgpu` renderer imports.
2. Before shipping a material, check that it reads colours from the palette.
3. Physics colliders are primitives (box, sphere, capsule) authored separately from visual meshes.
4. Any new effect needs a quality-tier flag (`low` / `high`) so the demo laptop holds 50 fps or more.
5. If you need something this file doesn't cover, follow the owning skill above. If two skills disagree, ask the team lead and record the decision here.
