# Generate transition: pops found and fixed (2026-11-08)

Method: headless Chrome, 1280×720, `?demo&debug`, CDP screencast (~60 frames/s) plus a per-rAF DOM state log keyed to the transition clock T
(`window.__genT`, debug only). Frame differencing is the mean absolute luminance change per frame, over 9.5 s from the click.
Tools: `capture.mjs <carbon|silicon> <outdir> <port>`, `analyze.py <outdir>`. Strips: `<world>-before.jpg` / `<world>-after.jpg`.

| # | T | What | Frames 0→1 before | Cause | Status |
|---|---|---|---|---|---|
| 1 | 1.41 (silicon, and any run whose sliders glide at Generate) | Whole tide vanishes: grains and ghost slab cut, pale ground appears (mean luminance +41.6 in one frame, then no tide at all) | 1 | `render/generate.ts` `finish()`: a plan job for an intermediate slider value finishes during the run, does `primed?.dispose()` on the group being drawn | **Fixed**: a plan that finishes while the transition is active is discarded; `prime()` ignores calls while active. After: max luminance step 0.5 at T 1.2–1.7, tide runs to 5.3 |
| 2 | 5.755 | HUD tabs (Conditions, Bestiary) and hint appear hard | 1 | `generate.ts` `hideUi` (`visibility:hidden` removed at spawnSec−0.25) | **Fixed**: `--gen-ui` opacity ramp, smoothstep on T over 5.55–5.95 (~24 frames); pointer events stay off until done |
| 3 | 0–4.6 / 5.755 | Build-start caption ("A carbon world forms") shown and faded while the HUD was hidden, so never seen; on silicon the queued "starts at …" caption popped in with the HUD | never visible / 1 | UI mounts at Generate; `ui/captions.ts` timers run on wall clock | **Fixed**: `onReveal` (generate.ts → main.ts) replays the start caption as the HUD fades in, unless a caption is already showing (silicon). Captions keep their own stepped fade |
| 4 | 6.0–6.1 | Character appears fully formed | 1 | `main.ts` `setVisible(true)` at snapshot timeSec ≥ spawnSec | **Fixed**: `player.setAppear(k)` (new, 3 lines in `player/index.ts`); smoothstep grow from the feet over 0.35 s (~21 frames) |
| 5 | ≈9.1 (after the transition, lifeSec 9) | Every flora plant appears in one frame (mean Δ 16.5, luminance −15.6) with the "life" caption | 1 | `render/flora.ts` / `world.ts` (not mine): the whole grid is drawn the first frame biomass > 0 | **Out of scope.** Suggest: scale each plant by its cell biomass (or smoothstep a global `floraIn` over ~0.5 s from the first snapshot with flora) |
| 6 | 0.07, 0.35, 1.02 (carbon), 0.02, 0.71, 1.24 (silicon) | Frame hitches of 150–390 ms; T then jumps and the iris wipe leaps (luminance −70 in one frame at T 0.68) | 1–2 | Headless software GL; first frames of the mask-on-scaled-sheet compositing and first draws of the group. T re-anchors to the sim snapshot after a stall | **Not changed.** Check on the real GPU with `?debug` (`window.__genFrames`) |

Kept on purpose (stepped, pixel-art):
- Ghost slab and grain dissolve use the 4 px ordered dither (`dither ≥ vis/gone`): hard per-pixel steps, smooth in time.
- Box copy dissolves pixel by pixel (hash mask) over 0.4–0.85 s; the iris wipe edge is a hard 1 px edge on an 8 px stepped radius.
- Captions and hint fade with CSS `steps(4)`.
- `plainFade` fallback: six hard steps over 0.6 s.

Checked, no pop: sheet teardown at T 1.45 (the iris has fully opened by 1.35); box copy hand-off to gen-0 grains (0.35–0.85); sea ramp (3.0–5.2); ghost end (≈5.3–5.5); camera hand-off at 6.0 (max per-snapshot step 0.046 m, 0.0015 rad; fov constant 60).

Before / after (same captures, T in 1.5–6.2 s, excluding the iris):
- Carbon: max mean-luminance step 3.1 → 3.3 (unchanged). Silicon: whole-tide cut of +41.6 → none (T 1.2–1.7 max step 0.5).
- Silicon T 1.5–6.2 max mean frame difference 4.4 → 12.7 is the tide that was missing before; the grains landing, not a pop.
