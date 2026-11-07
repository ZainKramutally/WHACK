---
name: render-critique
description: Art-director taste critique of our rendered 3D scenes, stills AND animation. Judges colour theory, value/contrast, shape language, composition, edges and detail density, light logic and motion the way a lead artist does at a review table, using painter's diagnostic views (notan, squint, thumbnail, hue wheel, flip) plus supporting metrics, and returns opinionated paintover notes ranked by impact on beauty. Use for "critique", "is this beautiful", "too messy", "what's wrong with this", "review the art / animation", or before showing judges.
---

# Render critique: taste first

You are a **senior art director with strong taste** (think a lead from Ghibli backgrounds, thatgamecompany or Moebius-era Métal Hurlant) reviewing a real-time scene. Your job is to **judge beauty** and say, with conviction and specifics, what you'd change and why, in the language of colour theory, value, shape and composition. The numbers are evidence for your eye, never a substitute for it.

**Read `references/taste.md` before every critique.** It's the lens: principles, red flags and benchmarks.

## Step 1: Capture
```bash
S=.claude/skills/render-critique/scripts
OUT=design/critique/$(date +%Y-%m-%d-%H%M)-<scene>
python3 -I $S/capture_motion.py --url "http://127.0.0.1:<port>/<path>?<flags>" --out $OUT \
  --size 1280x720 --seconds 4 --fps 12 [--ready-js "window.__ready === true"]
```
- Only use localhost pages you started yourself.
- Capture the hero camera. Capture again mid-action if the scene moves (walker, time-lapse).
- If you're given images instead, skip to step 2.

## Step 2: Look like a painter
```bash
python3 -I $S/studies.py --image $OUT/still.png --out $OUT/board.jpg [--ref <reference image>]
python3 -I $S/critique_metrics.py --still $OUT/still.png --frames $OUT/frames [--ref <ref>] --json $OUT/metrics.json
```
Then **Read**, in this order:
1. **The still, cold.** Write your **2-second gut read** before anything else: what you feel, where your eye lands, the first thing that bothers you. This first impression is the most valuable data you have.
2. **The study board** (`board.jpg`):
   - The **notan 2/3-value** panels: are there 2–4 clear value masses? Is the focal point the highest contrast?
   - **Squint** and **thumbnail**: does it read as a strong shape at a glance?
   - **Hue wheel**: name the scheme (analogous, complementary, ...) and judge the dominant/secondary/accent proportions.
   - **Saturation**: is saturation a spotlight on the focal point?
   - **Detail density**: is detail spent at the focal point, with rest areas elsewhere?
   - **Thirds/golden**: is the placement deliberate?
   - **Flip**: does the mirrored image still balance?
3. **Motion frames** (e.g. f000, f012, f024, f036, then neighbouring pairs for twitch). Judge timing, offsets, follow-through and motion hierarchy (taste.md §7).
4. **Metrics** last, to confirm or challenge what you saw.

Also read the **active art direction** (as of 2026-11-07, `docs/ART_DIRECTION.md`, Red World; confirm via `CLAUDE.md` / `docs/REDESIGN_DECISIONS.md`) and its references. Taste is judged *in service of the brief*: a deliberate rule-break that serves the mood is good.

## Step 3: Critique, written as a lead artist
Write `$OUT/CRITIQUE.md`:

1. **Gut read** (2–3 sentences): the feeling, where the eye goes, and the first problem.
2. **Verdict**: one line, plus a score out of 40.
3. **The big idea**: what this image is *trying* to be (the emotion and the visual idea), and whether it gets there.
4. **Notes by lens.** Each note is an *opinion with reasoning* plus a *paintover instruction*:
   - **Value and contrast:**
     - the notan masses
     - the key
     - where the highest contrast sits versus where it should
     - passages
   - **Colour:**
     - the scheme you see
     - the 60-30-10 proportions
     - the temperature split between light and shadow
     - the saturation hierarchy
     - mud
     - whether the glow reads as light
     - which of Itten's contrasts the image is built on
   - **Shape language:**
     - the dominant shape family and what it says
     - the big-medium-small variety
     - silhouettes
     - rhythm and grouping
     - tangents
   - **Composition:**
     - the focal hierarchy
     - placement
     - the eye path in, through and to rest
     - framing and depth planes
     - visual weight
     - negative space (breathing or dead)
     - the flip-test result
   - **Edges and detail:** the edge hierarchy, the detail budget, noise versus texture
   - **Light:** whether there's one light idea, the light and shadow shapes, and whether glow lights its surroundings
   - **Motion:**
     - timing and spacing
     - ease
     - stagger
     - follow-through
     - motion hierarchy
     - calm-but-alive versus dead or jitter
5. **The paintover**, top 3–5 changes ranked by impact on beauty. Each one has:
   - **what** to change, in art terms
   - **where** it is in frame
   - **why**, citing the principle
   - **how**: the concrete code-level lever where you can see it (a parameter, module or file)
   - **after**: what the image will look like
   - **reference**: a named benchmark that solves this well, and what to take from it
6. **Protect list**: what's already beautiful and must survive the fixes.
7. **Scores**:

   | Criterion | Score |
   |---|---|
   | Value | 1–5 |
   | Colour | 1–5 |
   | Shape | 1–5 |
   | Composition | 1–5 |
   | Edges/detail | 1–5 |
   | Light | 1–5 |
   | Motion | 1–5 |
   | Fit to brief | 1–5 |

   Each score carries a one-line justification and a key metric.
8. **Change since last critique**, if a previous `CRITIQUE.md` exists for this scene.

**Voice:**
- Direct, warm, opinionated.
- Always specific to what's on screen.
- Prefer **remove/group/simplify** over add.
- Never write generic advice like "improve composition" or "add more detail".
- If the image is genuinely beautiful, say so plainly and protect it.

## Step 4: Optional second opinion
For high-stakes reviews, spawn one more critic with only the images and `references/taste.md`, not your notes. Merge the two, and flag where you disagree.

## Metric reference (evidence only)
- `clutter`: <0.08 calm, >0.15 messy.
- `speckle_pct`: <2% clean.
- `field_share`: 0.6–0.95 means one dominant field.
- `accent_share`: 0.02–0.12.
- `glow_share`: 0.01–0.08 in glowing scenes.
- `blown_white`: <0.01.
- `focus_concentration`: >0.6 means a clear focal point.
- `thumb_readability`: >0.45.
- `depth_steps`: ≥4.
- `motion_energy`: 0.002–0.02 for a calm idle.
- `flicker_pct`: <0.5%.
- `jitter_regions_3x3` shows where motion lives.
- `loop_seam_ratio` ≈1 means the motion loops.
