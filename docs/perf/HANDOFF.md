# Performance hand-off (session/perf, 2026-11-08)

These perf findings sit in files other agents were actively editing, so session/perf did not touch them. They come from code reading and Node microbenchmarks; browsers were banned. Each one says how to check it in the browser first (`?debug`).

## Terrain (src/render/terrainNode.ts): owner session/crust (terrain-forms)
1. **Five full height evaluations per terrain vertex, every frame** (terrainNode.ts:262-271): `h` plus four central-difference taps for the normal.
   - Cost: ~49k vertices (patch 193² plus the skirt) × 5 ≈ 250k fBm evaluations per frame. Estimated 0.5–1.5 ms on an iGPU [INFERRED].
   - Fix A (LOW risk): forward differences (`h`, `hR`, `hU`), 3 evaluations instead of 5. The normal shifts by half a cell, which should be imperceptible.
   - Fix B (MED-HIGH risk): bake height and normal into a texture, refreshed only when rise/progress/heatSolvent change. No gain during the build.
   - Check first: stand still and look at the sky, then at the terrain. If fps is the same, skip this.
2. **The skirt pays the full 5× height cost for fogged far ground** (terrainNode.ts:285-312, about 12k vertices). Use a straight-up normal beyond ring ~8. That is ~25% of item 1. Far shading changes slightly, under fog.

## Fauna (src/render/fauna.ts): owner art layer
3. **PARTLY DONE on main (c5aa792, art layer): loft/swimmer/pose slots go to creatures in view first.** Bead instances behind the camera are still drawn. Original item: **No frustum test on creature instances** (`frustumCulled = false`, fauna.ts:210, 224, 271). `draw()` (~L1019) ranks by distance only, so about half the beads and lofts are behind the camera, and the 64 loft/anim slots get spent on animals the player can't see.
   - Fix: a conservative sphere-vs-frustum test (margin about fov × 1.3) in `draw()`, also fed into the loftCut/animCut ranking.
   - Estimated 0.2–0.5 ms on an iGPU [INFERRED].
   - Check first: compare fps looking at a herd versus looking away.
4. **DONE on main (72cd777, art layer).** Original item: **Ground height is sampled per creature per frame** (fauna.ts:868, plus the IK feet at :424 and :467). That is ~1,000+ `terrain.height` calls at 0.5 µs, about 1 ms/frame on the CPU. Fix: cache ground y per entry, and recompute only after the creature moves more than 0.25 m or rise changes.

## Flora (src/render/flora.ts, floraLib/place.ts): owner art layer
5. **Buckets are `frustumCulled = false`** (flora.ts:101), and placement fills all directions around the camera.
   - Fix: split into ~4 angular sector InstancedMeshes with real bounds (MED risk). Don't cull at fill time, because a rotation doesn't trigger a rebuild, so plants would pop in.
   - Check first: `scene.getObjectByName('flora').userData.flora.triangles`. Ignore this item if it's under ~300k.
6. **The flora rebuild never skips unchanged data** (flora.ts:162-166): the worker sends a fresh buffer every snapshot.
   - A signature skip would save ~3.5 ms per rebuild, but it delays small biomass drift, so it isn't strictly exact. Do it only if the spike is still visible.
   - The terrain-height part (2 ms) is already fixed on session/perf: the floraForm cache plus the stable `terrain.height` in visualInputs.

## Inspect card (src/ui/inspectCard.ts): owner art layer / session/crust
7. **DONE on main (5b9fe6d, logic team): the card rebuilt its DOM and forced layout at 20 Hz while open** (inspectCard.ts).
   - Fix: build a row signature string, and skip `replaceChildren`/`place()`/`reportWindow()` when it hasn't changed.
   - Estimated 1–2 ms of layout per snapshot while a card is open [INFERRED].

## Sim (src/sim/*): owners logic (16) and climate-evo
8. **`FormTracker.update` clusters on every snapshot** (guide.ts:235): 1.07 ms of the ~1.8 ms snapshot, worker only. Throttling it to one run per ecology-second shifts announcement timing by up to 1 s, so it needs an owner OK.
9. **`EcologyLife.step` wrapper scans** (lifeModel.ts:108-118), 0.07 ms per tick. Accumulate dead mass in `kill()`, and biomass in the existing flora loop.
10. **`snapshot()` recomputes `livingBands`** (simulation.ts:251) although `tickBands` is cached. 0.2 ms per snapshot.
11. **simulation.ts:358** filters `env.controls` to get one band. `limits.ts` now exports nothing new, but `oneBand` exists internally, and could be exported if wanted.

## Material (src/render/material.ts): owner art layer
12. **`worldMaterial` is Lambert plus an `outputNode` override** (material.ts:164-231). The lighting path may still be emitted. Check the WGSL before switching it to `MeshBasicNodeMaterial`. Under 0.1 ms at 360p either way.

## Post output at internal resolution (src/render/post.ts): owner call
13. **The post output runs per canvas pixel**, so at k = 3 it is 9× redundant above water. Estimated 0.3–1 ms on an iGPU.
   - This is not done, because the output isn't constant per internal pixel when canvas W or H isn't a multiple of k (window resize, the Generate setPixelScale tween).
   - Recipe: snap `uv` to the scene RT's texel centre (`(floor(screenUV*texSize)+0.5)/texSize`), render into a nearest internal-resolution RT (NoColorSpace, no tone mapping), then nearest-blit to the canvas.
   - This changes edge placement at non-multiple sizes, so it's a visual call for the owner.

## Boot-time compiles while the selection screen is up: owner art layer (world.ts)
14. **`view.ready` compiles every material in one go** (`counterpart.ready → app.compile()`), plus Generate's prime compile, while the player is already on the selection screen. Node building is synchronous, so the particle box may hitch in the first seconds.
   - Check first: watch the box for 3 s after load.
   - If it hitches, compile top-level groups one at a time with a frame yield between them.

## Regression found by the main watch (2026-11-08 ~05:10): owner art layer
15. **FIXED by the art layer on integrate/stage d1cc845 (crust object stable per sampler + place.ts keyed on it).** Original: **floraLib/place.ts `mineralIx` (1c63df8) cached per placePlants call** (`MIN_AT[c] !== call`), so every flora rebuild (up to 4×/s) re-samples `crust.weights` plus the argmax for every planted cell. Measured: 1.4–1.5 ms per 4,096-cell pass.
   - Fix: key CELL_MIN on the `crust` (or `crust.weights`) identity.
   - Optionally, visualInputs.ts hands out one crust object per sampler (WeakMap), so the identity is stable during the build too.
16. **Nit, selection box (box.ts, d34b1f5):** `columnMinerals(world)` builds a new Set (filter + flatMap) on every draw frame, at 60 Hz. Memoise it per world in a WeakMap. Tiny, but it puts a per-frame allocation back into a loop that was allocation-free.
