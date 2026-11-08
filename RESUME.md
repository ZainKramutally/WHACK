# RESUME: art-layer team lead (written 2026-11-08 ~00:55)

**Start the new session with:**
> Read `/Users/ylcheong/Documents/Coding/whack-2026/.sandboxes/session-art-layer/RESUME.md` and resume as team lead.

Then follow the steps below in order.

## 0. Ground truth
- **Session branch:** `session/art-layer`, worktree `.sandboxes/session-art-layer`, pushed to origin.
  - It's rebased on main f9320a9. Head is `265b234`, or later if a journal commit landed.
- **Main merge is APPROVED by Caden** (and owner priority #53). It's blocked only by one failing test:
  - `src/render/floraLib/floraLib.test.ts:183`: the worst case gives `n.mid` 1613, but the test needs < 1600. Fix the code, not the test (art-flora's job).
- **Merge gate:** `npx tsc --noEmit`, then `npx vitest related --run --maxWorkers=2 <changed src/render files>`, then `npm run build`.
  - **OWNER RULING (2026-11-08, in CLAUDE.md): NO browser tests.** That means no Playwright, smoke, headless Chrome, screenshots, fps captures or art_capture.py. They burned ~150% CPU.
  - `npm test` is banned too.
  - Caden checks visuals himself, so tell every agent the same.
- **Then merge:** `git fetch && git rebase origin/main`, rerun the gate, `git push origin session/art-layer:main`. That fast-forward only; if it's rejected, rebase again.
- **After merging:**
  - Ping whack-2026-a1 (logic) and whack-2026-56 (transition; it wants the sha to switch to `app.post.setPixelScale` + `app.compile`).
  - Close GitHub #53, and comment on #50.

## 1. Check each sandbox, then respawn or resume agents
Agents may not survive the restart. For each one:
- `git -C .sandboxes/<name> log -3 --oneline` and `git -C .sandboxes/<name> status --short`. They were told to commit WIP as `wip:` commits.
- If the agent is gone, respawn it: `feature-agent`, model opus, `run_in_background`, same name. The prompt is "Your working directory is .sandboxes/<name> … read docs/features/art-layer.md + RESUME.md §1 row + your branch's last commits and uncommitted diff, then continue".

| Agent | Sandbox / branch | State at save | Next |
|---|---|---|---|
| art-flora | `.sandboxes/art-flora` `feature/art-flora` | Merged: library, clearing, test-bin fix (a018ddb), all on session. Dirty WIP. | (1) **code fix**: worst-case mid < 1600. (2) **Silicon draw calls**: 93 vs main's 14 (~25 crystalGround L0 buckets), giving silicon −6.5 fps. Collapse the buckets and lower the tri count. (3) Pass `cutout:false` on far/ground buckets once art-look's focus cut-out merges. |
| art-look | `.sandboxes/art-look` `feature/art-look` | **Ready, NOT merged: 650e295** (was bcd964b). It has the silicon creatureColour inversion, the `rim` option, LOOK.focus/focusR flora dither cut-out (`cutout` opt), view.setFocus/setSpawn, and the 2 main.ts calls. | Merge it after art-flora's cut-out opt-outs, because the cut-out costs ~4 fps on silicon through the discard. Then stand by. |
| art-world | `.sandboxes/art-world` `feature/art-world` | WP3 merged. WIP: sea worley-crack gating, frozen path only. | Commit it, I merge it, it stands by. |
| art-post | `.sandboxes/art-post` `feature/art-post` | Done and merged: post, setPixelScale, sea mask, ink fade. | Stand by. It can shut down. |
| art-fauna | `.sandboxes/art-fauna` `feature/art-fauna` | WP5 creature reskin in progress, no commits yet. Dirty. | Continue. Its brief is in its spawn prompt; see art-layer.md WP5 and §3 below. |
| rw-fish | `.sandboxes/rw-fish` `feature/rw-fish` | Aquatic procedural fish lab in mockups/red-world (5 variants, `swimmerParamsFromPlan`, `?view=aquatic`, docs/features/aquatic-life.md). In progress. | Continue, then report. |
| rw-envs | `.sandboxes/rw-envs` `feature/rw-envs` | **Done, merged** (265b234): environmentFrom(soup), 7 environments, docs/features/environments.md. | Shut down. Caden needs to pick the cryo accent (gold vs cyan). |

## 2. Decisions waiting on Caden
1. Cryo/silicon glow accent: gold (rw-envs) or ice-cyan (the app's LOOK_PALETTES.silicon)?
2. Port `environmentFrom` into the app's `lookPalette`? It needs data-contract agreement for sheen, banding, sea and flora bias.
3. Which environments to keep. The weak ones are deepair and hothouse at eye level.

## 3. Phase 2 fauna brief (art-fauna), the essentials
- Re-skin the app creatures in the Red World style: smooth lofts, one body colour plus one accent, bone-catchlight eyes, bells for floaters. Drive it from BodyPlan v3 births plus organism records. Port the mesh side of `mockups/red-world/src/fauna/**`, never its develop().
- Silicon stays radial/lattice, carbon bilateral/axial.
- Keep the FaunaPart API used by pick.ts and counterpart.ts.
- LOD within ANIM_RADIUS/ANIM_MAX.
- ≥1000 animals at ≤2 fps cost.
- Silicon contrast: violet bodies on the pale-lilac ground, a pale rim, cyan arm-tip glow (palette + rim come in art-look's 650e295).
- Later: integrate rw-fish's `swimmerParamsFromPlan` for mode=swim.

## 4. Coordination notes
- whack-2026-a1 does logic, main.ts and CLAUDE.md. Its landmarks agent (#52) will add a small hook to world.ts and main.ts.
- whack-2026-56 does the Generate transition (src/render/generate.ts).
- Track work in GitHub issues: #50 (art layer, "in development") and #53 (flora variety).
- Machine load from other sessions runs to 100–550 load average. Take fps best of 3, and A/B main vs session back to back.
- **Gotcha:** always `cd` into `.sandboxes/session-art-layer` with an absolute path in the same command before running git. One cherry-pick once ran in the main checkout (session/art-direction). It was aborted cleanly.
- **Docs:** docs/features/art-layer.md (the plan), docs/ART_DIRECTION.md, docs/features/environments.md and docs/features/aquatic-life.md. JOURNAL.md has the timeline.
