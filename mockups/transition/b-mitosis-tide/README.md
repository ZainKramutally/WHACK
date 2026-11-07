# Transition B: Mitosis Tide

Standalone mockup of the Generate transition (0 → spawn, 6 s). Not integrated; imports `src/` read-only.

Run from the repo root: `npx vite --host 127.0.0.1 --port 5492 --strictPort`, then open
`/mockups/transition/b-mitosis-tide/` (`?world=silicon` for the nitrogen world, `?t=3.2` to freeze a moment, `?hud` for a timecode, `R` replays).

## What it does

- Frame 0 is a screenshot of the real selection screen (`assets/sheet-*.png`) with the real `box.ts` box running live on top.
- The box's 196 dots (`box.seeds()`) divide on a steady pulse: 196 → 392 → … → 25,088 (7 doublings, 0.5 s apart, from 0.85 s).
  Each pulse is a front sweeping outward by ground distance; daughters appear at their parent, flash, and arc to their landing spot.
- Landing spots are the real carbon/silicon terrain (`gen/terrain.ts`, demo seed): rays through a stratified lattice of the END frame hit the
  analytic height field, so the grains land exactly on the pixels the spawn view will show. Their y follows the live `rise` (TSL height node).
- Each grain's final colour is read back from a render of the end frame (dry and with sea), so the grains literally are the end frame's pixels.
  They grow 1 → 3 px (2×2/plus clumps), fuse, and are dithered out as the real terrain mesh, sea and character dither in.
- The look is block-averaged pixelation + dithered posterize; the pixel size resolves 4 → 1 over the last second so the handoff to the app's native render has no step.
- Camera: Hermite path through push-in (box fills at 1.25 s) → pull-back/tilt (3.3 s) → the app's exact spawn pose (offset (0, 3.22, 5.17), pitch 20°).
- Pure function of `t` (seeded RNG, GPU-analytic motion), so stills, video and replay agree.

Reference numbers (`REF` in `main.ts`) were captured from the real app at spawn (`/?world=…&demo`).
