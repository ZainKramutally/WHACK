# Research & Inspiration

Drop anything that inspires the build here: visual or technical, half-formed or polished. If it made someone go "oh, we could do that", it goes in.

| Folder | What goes in it | Example |
|---|---|---|
| `visual/` | Screenshots, screen recordings, moodboards, palettes, type, art you like the *feel* of | `visual/2026-11-07-bruno-car-dusk.png` |
| `technical/` | Techniques, articles, repos, shaders, CodePens, talks: anything about *how* | `technical/baked-lighting-blender.md` |
| `sites/` | One folder per reverse-engineered website, with the breakdown and captures | `sites/bruno-simon-2019/BREAKDOWN.md` |
| `ideas/` | Concept pitches for the "New Worlds" theme, each scored against `docs/TRACK.md` | `ideas/03-world-inside-a-snowglobe.md` |

## Rules (keep it fast)

1. **Name files** `YYYY-MM-DD-short-slug.ext`. No spaces.
2. **Every reference gets one line in the index below.** A file nobody can find doesn't exist.
3. **Say why.** One sentence on what to steal: the colour, the camera move, the interaction, the shader.
4. **Big files** (videos over 20 MB, `.glb` over 10 MB): put a link in the index and leave the file out of git.
5. **Credit sources.** We borrow techniques, not assets. Note the licence if we might use code.

## Reference card (for `technical/` and longer notes)

```markdown
# {Title}
- Source: {URL / repo / person}
- Type: visual | technical | interaction | audio | narrative
- Steal: {the one thing we'd take}
- Effort to reproduce: S (<1h) | M (1-4h) | L (>4h)
- Fits the style? {yes / no / with tweaks — see .claude/skills/world-style}
- Notes:
```

## Index

| Date | Who | Type | Ref | Steal this |
|---|---|---|---|---|
| 2026-11-07 | team | site | [Bruno Simon 2019](sites/bruno-simon-2019/BREAKDOWN.md) | Loader becomes the START pad, radial world rise, matcaps + fake offset shadows (no real lights), diegetic floor UI, velocity-pitched SFX |
| 2026-11-07 | team | site | [Bruno Simon 2025](sites/bruno-simon/BREAKDOWN.md) | Same stack as ours (WebGPU + TSL + Rapier). Circle-reveal intro, one palette material, violet coloured shadows, bloom threshold 1, tilt-shift DOF, real-clock day/season cycles, Blender-named colliders |
| 2026-11-07 | team | technical | [Silicon life deep research](silicon-life/EXECUTIVE_SUMMARY.md) | Exec summary, full report, visual report (`silicon-life/report.html`), element rules table, bonding prototype |
| 2026-11-07 | Caden | visual | [Pinterest "Silicon" board](visual/pinterest-silicon/README.md) | 25 pins (fauna/flora/ecosystem). One muted field + one saturated accent per world, giant life over a tiny observer, parasols/arches/glowing pores. Became [`docs/ART_DIRECTION.md`](../docs/ART_DIRECTION.md) |
