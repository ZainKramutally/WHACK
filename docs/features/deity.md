# The player: a void deity (character brief)

Owner: Caden (look). Team lead: session `session/character`. Contract: `src/player/deity/rig.ts`.

**Concept (Caden, 2026-11-08).** The player is a small deity who shapes worlds out of chemistry's building blocks, then walks among what it made. It is a chibi void creature: an all-black orb head floating detached above a deep-black body, with big white eyes. The reference is a flat illustration Caden shared (`/tmp/deity-reference.png`, not committed; it isn't ours). It shows a black orb head with twig antlers and white ring eyes with tiny highlight dots, a fluffy collar, mitten hands and thin stick legs. Take its proportions and charm, not its coat.

It replaces the placeholder explorer in `src/player/character.ts` and keeps the `Character` interface. Like the old suit, it is a declared illustration: no stat models the player.

## How it is seen
- The follow camera sits 5.5 m behind with a 60° field of view and aims 1.4 m above the feet (`src/player/camera.ts`, the eng lead's file). The character fills about a quarter of the frame height, which is roughly 100 px in the pixel pass, where 1 px is about 2 cm.
- **You mostly see its back,** so the eyes are hidden most of the time. The back silhouette has to carry the identity on its own: the orb, the gap under it, the body shape and any head extras. The gap must read from behind, so make it at least 10 cm.
- **The detached head can turn further than a neck would.** Use that to show the eyes. After a few seconds idle, the head turns all the way round to look back at the camera, blinks, holds, then turns forward again while the body keeps facing away.

## Look rules
- Proportions are chibi: the head's diameter is about the body's height or more. Total height is 1.3–1.6 m. Shapes are chunky, because anything under about 4 cm is under 2 px.
- **Colour.** The body and head are deep black. Try unlit pure black and palette `ink #22060f` through `worldMaterial`, and compare them. The eyes are white and unlit (a built-in `MeshBasicNodeMaterial`), so they still read in silicon's 1% light. They are never cyan, because cyan means life.
- Black reads on both worlds: about 4.5:1 against carbon's red ground, 16:1 against the white sky, and strongly against silicon's pale ground. Its weak spot is the dark foreground ground cover. An optional thin rim shell (an inverted hull: built-in material, `side: BackSide`, in haze lilac or white) can separate it there. It is a toggle, not the default.
- **Materials.** Use built-in node materials, or `worldMaterial` from `src/render/material.ts`. Write no new custom TSL: custom node code lives only in `material.ts` and `post.ts` (art-layer rule).
- It's one character, but keep it lean: about 12 draw calls or fewer, and no per-frame allocations.

## Variants to mock up (the look is chosen from these)
| | Eyes | Body | Head extras |
|---|---|---|---|
| A, reference | white rings with a highlight dot | egg body, stick legs, floating mitts | twig antlers |
| B, void | big solid white ovals | round bean, stubby legs; head about 1.25 × the body | none |
| C, deity | tall white pills | bell-shaped cloak with tiny feet, floating mitts | thin white halo and one small orbiting mote (a building block) |
| D, inverse (wild card) | none on the orb: the orb is a featureless black moon | the body carries the big white eyes | none |

## Motion rules
- **Appeal comes from the head and hands floating.** Each spring-follows its anchor with a little lag and overshoot, so it is never rigidly attached. The body squashes and stretches.
- **Idle:** breathing, a slow head bob (about ±3 cm at about 0.4 Hz), blinks every 2–6 s from a seeded sequence (never `Math.random`), small look-arounds, and the look-back above.
- **Walk:** the controller walks at 5 m/s, which is fast for chibi legs. Use a bouncy skip or hop rather than a literal 7-steps-per-second walk. Feet that touch the ground must not skate: the gait phase advances with the distance travelled.
- **Run** (`sprinting`, about 9 m/s): a longer bound or a floaty dash, leaning 10–15°, with hands pumping or trailing and the head streaming behind.
- **Jump:** stretch on `jumped`. In the air, the pose follows `vy`: tucked while rising, floating at the apex, spread while falling. On `landed` (0..1), squash by the impact, and let the detached head keep dropping towards the body, then spring back.
- **Swim** (`mode === 'swim'`): the body pitches with `swimPitch` and lies flat when moving, with a frog kick and breaststroke paddles. When still, it treads water.
- **Blending:** crossfade states with damped weights over 0.15–0.25 s, with no pops, and bank into turns. Everything is a pure function of the `PlayerState` sequence and `dt`, stable at dt up to 1/20 s.
- **Optional, after the five:** a `cast()` gesture, both hands rising as if shaping the world. Later it could be wired to slider moves, but that needs `src/player/index.ts` (the eng lead's file).

## Where to see it
There are no screenshots or headless browsers (owner ruling in CLAUDE.md), so Caden reviews in his own browser with `npm run dev`:
- `/scripts/deity/index.html`: the variant lineup in the real Red World look, with turntable, front, back and game-camera views, and a carbon/silicon toggle.
- `/scripts/deity/anim.html`: an animation playground. Drive it with WASD, Shift and Space through the real controller on flat stub ground with a pool, or use autoplay to cycle through idle, walk, run, jump and swim.

Lab code lives in `src/player/deity/lab/` so `npm run typecheck` covers it. Only the two HTML shells live in `scripts/deity/`, and neither ships in the build.

## Owned by others: report, don't edit
- `src/player/camera.ts` (`targetHeight` 1.4 m): recommend a value for the new height.
- `src/player/controller.ts` (`walkSpeed` 5, `swimSurfaceOffset` 1.3 m): recommend values if the chibi needs them.
- `src/player/index.ts`: it sets `root.visible` and `root.scale` for the fade-in, so nothing else may write those.
