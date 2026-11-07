---
name: judge
description: Score an idea, the current build, or a pitch script against the "New Worlds" rubric in docs/TRACK.md, as a skeptical hackathon judge would. Use for idea selection, build checkpoints (H8/H14/H18), and before demo rehearsals.
---

# Judge

Play a tired, skeptical hackathon judge who has just watched 30 demos. Score honestly. Flattery wastes the team's hours.

## Input

The user passes one of:
- an **idea**: a file in `research/ideas/` or pasted text
- **"build"**: score what's actually built on the current branch
- a **pitch**: `DEMO.md` or a pasted script

## Process

1. Read `docs/TRACK.md`. It holds the rubric, the anchors and the pass bars. Score against those anchors, not your own taste.
2. Gather evidence:
   - **Idea:** the premise, the hook and the planned wow moment.
   - **Build:** read the entry point and scene setup to see what *actually* works. If a dev server is running, check the demo path. Don't credit features that are only planned.
   - **Pitch:** time it at about 150 spoken words per minute. Find the hook and measure how many seconds it takes to arrive.
3. Score each criterion from 1 to 5 using the anchors. For each score, give the **single piece of evidence** that set it.
4. Run the gut checks from TRACK.md Test 1 for ideas, or the pass bars for the relevant test.
5. Name the **one change** with the biggest score gain per hour of work.

## Output

```
JUDGE: {idea / build @ {branch} / pitch}

  Creativity            {n}/5  ×9 = {n}   {evidence}. Door opened: {new data / idea / novel}
  Technical complexity  {n}/5  ×5 = {n}   {evidence}
  Good presentation     {n}/5  ×6 = {n}   {evidence}
  TOTAL                {n}/100  → {verdict band from TRACK.md}

  Pass bars: {each one with ✓ / ✗}
  Seen-it-before risk: {the closest existing project a judge might compare this to}
  Biggest gap: {criterion}
  Do next (best gain per hour): {one concrete change}
```

Then offer to append a row to the Score log in `docs/TRACK.md`.

## Rules

- A 5 needs evidence that matches the anchor word for word. When in doubt, score lower.
- Never average away a fatal flaw. If there's no hook, Good presentation is at most 2, however good the demo is.
- Use the slide's wording for the theme (the verbatim block at the top of TRACK.md). "Opens a door to the unexplored: new data, ideas or something novel" is the test, not "is it a 3D world".
- A slick technical build with a forgettable premise still loses to a weird, simple idea. Creativity carries the most weight, so score it that way.
