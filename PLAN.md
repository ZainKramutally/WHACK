# PLAN: Red World handoff (2026-11-07, about 21:15)

Read this, then `docs/ART_DIRECTION.md`, `docs/features/red-world.md` and the tail of `JOURNAL.md`.

## Where things are
- **Branch:** `session/red-world`, rebased onto `main` 5afb26c (the full app logic from session/logic) and pushed to origin.
  - Worktree: `.sandboxes/session-red-world`.
  - Pre-rebase backup branch: `backup/red-world-pre-rebase` (local only).
- **Merge to main:** NOT done. It needs Caden's approval. On merge:
  - `CLAUDE.md` comes from main (issue #22).
  - The merge removes `mockups/worlds`, the old art docs and the old design stills. Caden confirmed this.
- **App:** `mockups/red-world/` is a standalone Vite + three r187 WebGPU app that shares no code with the root app.
  - Run it with `cd mockups/red-world && npm run dev`, on 127.0.0.1:5183. A dev server may still be running from the session worktree.
  - World: `/`.
    - Switches: `?hero` (locked hero shot), `#capture`, `#tour`, `?free`, `?style=smooth`, `?fog=current|lilac|teal|apricot|ash|sulfur`.
    - Click or press a key to explore. WASD to walk, Shift to run, drag to look, wheel to zoom, F to fly (Space/C for up/down).
  - Fauna lab: `/fauna.html?view=lineup|one&i=N|strip&i=N|sky&i=N`, with a free camera (orbit, WASD/QE, 1–0 to jump to a creature, F to follow) and `?facet=1` for the old faceted look.
  - Flora lab: `/flora.html?view=lineup|grid&cam=low|top`.
- **Checks:** run `npx tsc --noEmit`, `npx vitest run` (98 tests) and `npx vite build`. Captures: `python3 scripts/capture.py` (hero, plus fps), `scripts/views.py` (360° sheet), `scripts/fog_ab.py`, `scripts/fauna_capture.py`, `scripts/flora_capture.py`. The root app runs 325 tests, which also pass on this branch.
- **Critique:** the `render-critique` skill is in `.claude/skills/render-critique`. The last critique scored 29/40 (`design/critique/2026-11-07-1900-red-world/CRITIQUE.md`), and its fixes are already merged.
- **Perf:** 60 fps at 1080p pixel mode when the machine is quiet. 30 fps readings came from endpoint-security agents (Ava Reveal, FortiDLP) loading the laptop, not from our code.

## What's built
- **World:** a 2.4 km 360° walkable terrain with riverbeds. Landmarks: two arches, a titan forest, a pod hollow and a fossil-rib ridge.
  - The groves and clearings are filled by scatter that is culled by sector.
  - Lilac haze, violet-oxblood shadows (`#5a1040`) and two pale moons, with no particles.
  - Height-aware fog.
- **Look:** a Bruno Simon-style world material and pixel post, with bloom at threshold 1 and a 1 px ink outline.
- **Flora:** `src/flora` has 6 species × 4 variants, generated once from a seed and instanced, about 90k triangles.
- **Player:** `src/player` handles third-person walk, run and fly, trunk and landform colliders, camera pull-in and shadow follow.
- **Fauna:** `src/fauna`.
  - Creatures come from the sim's 12 BodyGenes plus comp (mirrors root `src/sim/genome.ts`). `develop()` follows DECISIONS G.1 and F §3.3.
  - Motion: IK gaits from leg count (no foot sliding), heads that lead, and weight shift.
  - Colour: one body colour plus one gene-chosen accent; smooth by default.
  - Variants: the 8 walkers and floaters, plus the Bellwhale (adolescent ~22 m and juvenile 2.6 m from one genome, from the user's reference `/tmp/rw-ref/sky-whale-ref.png`).
  - Lab only: creatures are NOT in the world scene yet.

## Open decisions (ask Caden)
1. Dark walkers (maroon or ink bodies) read as flat silhouettes. Give them a lighter crimson body or a rim light?
2. The explorer's cyan lamp pool reads as a puddle. Soften it into stepped bands?
3. Any more Bellwhale feedback?
4. Merge `session/red-world` into main?
5. Next big step: wire the Red World art layer into the root app's render layer, driven by the sim (issue #23, now unblocked).
   - `SimSnapshot.flora` is interleaved [mat, canopy] per cell on a 64² grid; cell = row·64 + col, with col along world x and the patch centred on the origin.
   - Organisms use layout v2 (`src/sim/organismLayout.ts`, stride 28).
   - Plant forms live in `src/render/floraForm.ts`.

## Coordination
- **Other sessions:**
  - whack-2026-a1 does logic and CLAUDE.md, and tracks issues on GitHub (ZainKramutally/WHACK; ours are #23 and #28).
  - whack-2026-89 does art-lead and critique and owns session/art-direction.
- New open items go in as GitHub issues.
- **Gotchas:**
  - Agent messages often cross mid-task, so re-check before re-sending.
  - Agents' branches drift from session, so I cherry-pick their commits.
  - `JOURNAL.md merge=union` is set in `.git/info/attributes` (local).
  - Capture scripts must kill their vite process group; `flora_capture.py` is fixed.
