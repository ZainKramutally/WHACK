# Render critique: Red World hero + fauna lab (2026-11-07 19:00)

Captures:
- `still.png`, `board.jpg`, `metrics.json` and `frames/` (48 @ 12 fps), hero view `?hero`
- `../2026-11-07-1900-red-world-fauna/`, fauna lineup, mid-walk
- Brief: `docs/ART_DIRECTION.md` (Red World)

## 1. Gut read
The world reads in under a second: a dark crimson parasol against white air, standing on red. My eye goes to the hero cap, slides down its stalk and lands on the bright riverbed at its foot. The first thing that bothers me is the ground band. From the left foreground to the right midground it's an even sprinkle of identical dark dots, and that confetti takes the image's most detailed real estate away from the hero. Second, the big flat maroon wedge at the bottom right reads as a hole, not a shadow.

## 2. Verdict
Strong, poster-worthy value design whose middle is cluttered. Cut the confetti, give the shadows a temperature, and it becomes a cover. **29 / 40.**

## 3. The big idea
"Silence at enormous scale": a single colossal organism in a white void, with a tiny human on a pale path. Two colours, one accent and a lot of air. It mostly gets there. The sky half is already Moebius-grade calm. The ground half hasn't decided to be calm yet.

## 4. Notes by lens

### Value and contrast
- **Notan:** excellent. The 2-value panel is a clean three-mass design:
  - a white sky taking about 45% of the frame
  - a black ground
  - the black hero shape crossing the boundary
  The hero is the only big dark mass that breaks into the light. This is the image's spine. Protect it.
- **Where the contrast sits:** the hero cap has the highest contrast in the frame against the sky, which is correct. But the top-left overhanging cap has equal value contrast, and it adds the most saturated pixels in the image (cyan beads). The eye splits.
  - **Paintover:** lift that corner cap one value step toward blush and kill or dim its bead row. It should be a frame, not a second subject.
- **The ground band:** in the 3-value study, the band between 380 and 560 px is mid-dark speckle with no passages. The darks never join into shapes.
  - **Paintover:** group the ground cover into 3–4 clumps with clear gaps of plain red between them, so darks connect to darks.
- **Dead space:** the bottom-right wedge (about 15% of the frame) is one flat dark value. The fold helped, but at this size it still reads as dead space, not breathing space. Give it a gradient (lighter toward the river edge) or a cast-shadow shape with an edge.

### Colour
- **Scheme:** a monochrome red family plus white, with a cyan complement as the accent. The palette k8 is about 55% red family and about 45% white/blush. That's the right scheme for the brief.
- **60-30-10:** it's actually about 55/45/0.1. The accent share measures 0.001, so cyan is almost absent. At that size it isn't an accent, it's noise. Either commit (a cyan pool at the explorer's feet, the hero's neck ring reading clearly) or remove the stray cyan specks in the midground. Right now the only strong cyan is in the wrong place, the top-left corner.
- **Temperature:** this is the biggest colour miss. Light is warm red and shadow is warm crimson-magenta (`PALETTE.shadow #8a0f3c`), so light and shadow share a temperature and the ground reads a little plastic. Gurney: warm light wants cooler shadows.
  - **Paintover:** push the shadow tint toward violet-oxblood (e.g. `#5a1040`) and let cast shadows carry a slightly cooler hue than the lit red. The two-tone stays intact, but the planes start to turn.
- **Saturation hierarchy:** the saturation panel shows the *ground* as the most saturated area, the foreground especially, while the hero is muted. Saturation should spotlight the focal area. Desaturate the near foreground one notch (it's the fgPush zone) and let the full vermilion live in the lit midground around the hero's base.
- **Glow:** the cyan beads sit on a pale cap with a pale sky behind them, and their neighbours don't catch any spill, so they look painted on (taste §2, glow on a light field). They only read as light against the maroon underside.

### Shape language
- **Dominant family:** spiky triangles (zigzag cap rims, peaks, ground spikes) against big circles (the moons and caps) and one great curve (the arch). It's alien and right, a Moebius vocabulary.
- **Big-medium-small:**
  - **Big:** the upper half has three big shapes of similar weight: the arch, the large moon and the hero. The moon sits in the arch's shoulder at almost the same scale as the hero's cap, so the three compete.
    - **Paintover:** shrink the large moon about 25%, or move it right so it overlaps the hero's upper-right sky as a halo, not a third subject.
  - **Medium:** the coils are good.
  - **Small:** the ground cover is equal-sized and evenly spread, which reads as polka dots.
- **Tangents:**
  - The big moon's left edge nearly kisses the arch's right leg.
  - The hero's stalk runs into the butte behind it, the same-value pink block, so the stalk silhouette goes soft where it should be crisp.
  Darken or shift that butte so the stalk keeps its edge.

### Composition
- **Placement and line:**
  - The hero sits on the right third, which is good.
  - The riverbed is a fine leading line from the bottom left. It enters, curves and terminates at the hero's foot, the brightest ribbon pointing at the focal point. Lovely.
  - The explorer sits on that line but is about 8 px, so the human scale beat is invisible at thumbnail size.
- **Focus concentration is 0.30 (low):** the detail map puts the most detail in the left-centre ground, not at the hero.
- **Flip test:** it holds, because the mirrored image still balances on the parasol. The left half is heavier (arch, butte, ground clutter), which the hero's dark weight counters. It's fine.
- **Depth planes:** the planes read with 5 depth steps, and the aerial fade to white is beautiful. The foreground plane is too busy compared with its value job.

### Edges and detail
- **Hard edges:** the pixel outline and hard silhouettes are well spent on the hero and coils.
- **Detail budget:** spent wrongly. Ground cover at 380–560 px is the busiest region, and speckle sits at 1.86%, just under the limit. Remove about 40% of ground-cover instances within 150 m, keeping clumps, and the image instantly gets calmer and bigger.

### Light
- **One light idea:** a soft upper-left key, coloured shadows and fog to white.
- **What's missing:** the glow sources don't light anything. The hero's cyan neck ring doesn't tint its own cap underside, so the "living light" idea is weak. A tiny cyan spill on the nearest underside band would sell it.
- **Riverbed:** it acts as a light shape, which is great.

### Motion
- **Energy and stability:** motion energy is 0.0016 (calm idle) and flicker is 0.04% (clean). Calm-but-alive, close to dead air.
- **Where motion lives:** the jitter map puts the most motion in the bottom-left foreground (0.0045) and almost none at the hero. The motion hierarchy is inverted. Give the hero's caps a slow 6–8 s breath or sway with tip lag, and damp the foreground sway.
- **Loop:** the loop seam ratio is 9.5, so it doesn't loop. That's irrelevant unless we cut a GIF.

### Fauna lineup (mid-walk)
- The walkers read as maroon silhouettes on red ground, which is close in value. They need **value separation from the ground**: pale backs or a bone rim on the sun side, so their silhouettes read like the hero's.
- The Bellwhales and the Leviathan read well against the white sky. That's the strongest fauna moment: big dark shapes on white again. The juvenile bell, with its blocky spot checkerboard, reads as noise at a distance. Cluster the spots into 3–5 larger blotches.
- **Capture bug:** the capture includes the free-camera key hint at the bottom. Hide the hint in capture mode.

## 5. The paintover, ranked

### 1. Group the ground cover into clumps and cut about 40% of near instances
- **Where:** the ground band, 380–560 px, left to centre.
- **Why:** big-medium-small and detail budget. Uniform scatter is the number-one cause of "messy", and it steals focus.
- **How:** in `placement.ts`, raise the clumpiness of near groundCover (multiply by a low-frequency mask with a 0.35 threshold) and drop near density by about 40%. Leave plain red gaps 20–40 m wide.
- **After:** quiet red plains with a few dark islands. The hero and riverbed become the only busy story.
- **Reference:** Kazuo Oga's grass in *Totoro*, massed clumps and painted rest areas, never even confetti.

### 2. Give the shadows a cool temperature
- **Where:** all cast and core shadows.
- **Why:** Gurney's warm-light/cool-shadow split. Right now light and shadow share a temperature, so forms don't turn.
- **How:** move `PALETTE.shadow` from `#8a0f3c` toward a violet-oxblood (`#5a1040`), and maybe lower `shadowMix` slightly in `material.ts` so it still reads as red.
- **After:** the ground planes turn, the dunes gain volume, and the red looks hotter by simultaneous contrast.
- **Reference:** Syd Mead's desert plates, hot ground with cool violet cast shadows. Bruno Simon's own violet-on-warm scheme.

### 3. Make the corner cap a frame, not a second subject
- **Where:** the top-left overhanging cap.
- **Why:** focal hierarchy. It has hero-level contrast and the image's most saturated accent.
- **How:**
  - Lift that one instance's colour one value step (or tint it toward haze), since it's hand-placed in `placement.ts` / `layout.ts`.
  - Remove or `glowDeep` its bead row, which is flora aGlow on titan v0. The cheapest lever is a per-instance flag, or swapping to variant v1, which has no fringe beads.
- **After:** the eye goes straight to the hero, and the corner just frames the sky.
- **Reference:** Ghibli repoussoir foliage, darker but quieter than the subject, and never the most saturated thing.

### 4. Resolve the three big shapes competing in the sky
- **Where:** the arch, the large moon and the hero cap.
- **Why:** big-medium-small, tangents.
- **How:**
  - In `sky.ts`, shrink the large moon's radius from 4.6° to about 3.4°, or move it right so it sits behind and above the hero cap as a pale halo.
  - Clear the near-tangent with the arch leg.
- **After:** one big dark (the hero), one big pale curve (the arch), one medium pale circle. That's a hierarchy.
- **Reference:** Moebius's *Arzach* covers, one big subject and one celestial accent.

### 5. Put the cyan where the story is
- **Where:** the explorer, and the hero's neck ring and underside.
- **Why:** the 60-30-10 accent at 0.1% is too small to be an accent. Glow should light its neighbours.
- **How:**
  - Add a faint cyan ground pool under the explorer's lamp (an emissive decal or a ground-data tint).
  - Add a little cyan spill into the hero's nearest underside band near the neck ring (a material term weighted by distance to the glow).
  - Remove the stray midground cyan specks.
- **After:** two cyan notes that matter, the human and the giant, linked by the river.
- **Reference:** *Journey*, one warm accent the eye always finds. *Subnautica*, glow that tints its surroundings.

## 6. Protect list
- The notan: a white sky, a red-dark ground, and one dark giant crossing the line.
- The riverbed as a leading line that brightens toward the hero.
- The aerial fade to white across 5 depth steps, the layered mesas and the arch.
- The hero's zigzag cap rims against the sky, the best shape in the image.
- The calm motion and the near-zero flicker.

## 7. Scores
| Criterion | Score | Why | Key metric |
|---|---|---|---|
| Value | 4/5 | The three-mass notan is superb, but the ground band is spotty | L5/50/95 0.14/0.48/0.97 |
| Colour | 3/5 | The scheme is right, but shadow temperature matches the light and the accent is effectively absent | accent_share 0.001 |
| Shape | 4/5 | A strong alien vocabulary, but the big shapes compete and the small ones are polka dots | — |
| Composition | 4/5 | The thirds placement and leading line are lovely, but focus is diluted | focus_concentration 0.30 |
| Edges/detail | 3/5 | The detail budget is spent in the ground, not at the hero | speckle 1.86% |
| Light | 3/5 | One clear idea, but the glow lights nothing | glow_share 0.118 (mostly sky white) |
| Motion | 3/5 | Calm and clean, but the hierarchy is inverted (the foreground moves most) | jitter bottom-left 0.0045 |
| Fit to brief | 5/5 | Red and white own the frame, it's colossal and eerie, and the pixel render is crisp | field_share 0.998 |
| **Total** | **29/40** | | |

## 8. Change since last critique
This is the first critique of Red World.
