# Aquatic life: procedural swimmers

Owner: Caden (art layer). Reference build: `mockups/red-world/src/fauna/aquatic/`, viewed in the fauna lab. It is a mockup, so the app never imports from it: copy and adapt the code (see §6).

A swimmer is generated from one parameter object, `SwimmerParams`, and a seed. The app's `develop()` BodyPlan (v3, `src/sim/develop.ts`) maps onto those params through `swimmerParamsFromPlan()`, so every swimming organism (mode = 1) gets a body without per-species code. Chemistry picks the architecture, as it does on land:
- **Carbon: bilateral and axial.** A head-to-tail body with a travelling body wave, fins, a tail and paired ring eyes.
- **Silicon: radial and lattice.** No head or tail. Either a faceted crystal hub that rows on rod arms in stepped 15° beats, or faceted glass bells (alone, or a colony chain) that jet-pulse. Dot eyes sit at the tips, and glow comes from darkness.

## 1. Files and API

| File | What it holds |
|---|---|
| `params.ts` | `SwimmerParams`, `DEFAULT_PARAMS`, `mergeParams`, `normaliseParams` (clamps every number and enforces the chemistry grammar), `parseSet` (the URL `&set=` reader) |
| `build.ts` | `buildSwimmer(params, seed)` → `Swimmer`, and `schoolOffsets(swimmer, n, seed)` |
| `motion.ts` | Closed-form kinematics: `kinematics`, `bodyWave`, `finRipple`, `advance`, `armAngle`, `bellPulse` |
| `fromPlan.ts` | `swimmerParamsFromPlan(plan, genes?)`, the BodyPlan bridge |
| `variants.ts` | The five review swimmers |
| `render.ts` | `buildAquarium(entries)`: batches any number of swimmers into at most 15 draw calls |
| `material.ts`, `palette.ts` | Lab-only underwater shading, the two waters, and the silicon palette copy |
| `lab.ts` | The lab views |
| `aquatic.test.ts` | Tier 0 tests |

- **`buildSwimmer(params, seed)`** is pure. The seed only jitters proportions (length and width ±4%), so members of a species look alike. It returns:
  - `kin`: the kinematics
  - `L`, `extent` and `frameR`: sizes for spacing and framing
  - `tubes` and `sheets`: the fixed geometry template (lofted bodies and bells, fin membranes)
  - `pose(t, path, instance, sink)`: fills the template for time `t` and emits instanced parts (eyes, glow dots, rods, blades, plates, crystals, rings) into the sink. The same `(params, seed, t, path, instance)` always gives the same pose.
- **`SwimInstance`** is `{ s0, phase, off: [across, up], k }`: the start distance along the path, a time phase, a school offset in metres and the member index. Any `Path` (`{ at(s) → { p, t }, length }`) works. The swimmer's head is at `s0 + advance(t)` and its body follows the path behind it.
- **Part bases must be right-handed.** The material flips back-facing normals for its double-sided surfaces, so a mirrored instance matrix would shade inside-out. A test checks this.

## 2. Parameters

Lengths are in metres, or are fractions of body length (`÷ L`). `normaliseParams` clamps every value to the range below.

| Param | Range | Meaning |
|---|---|---|
| `chemistry` | `carbon` \| `silicon` | Picks the grammar. Silicon is always radial and carbon is always axial, whatever `plan` says. |
| `plan` | carbon: `fusiform` `ribbon` `disc` `segmented` `plesiosaur` (app only); silicon: `radial` `bell` | Body plan |
| `length` | 0.05–40 | Nose to tail (axial), hub tip to tip along the travel axis (radial), or one bell's height (bell) |
| `aspect` | 0.02–1.6 | Widest width ÷ length; for a bell, rim diameter ÷ height |
| `depth` | 0.25–4 | Cross-section height ÷ width: above 1 is compressed (oarfish, hatchetfish), below 1 is flattened (anomalocarid) |
| `peak` | 0.1–0.8 | Where the girth peaks along the body (0.25 gives a blunt head and a long taper) |
| `undulation` | 0–1 | 0 is carangiform (the rear third beats); 1 is anguilliform (the whole body waves) |
| `neck`, `tailLen` | 0.06–0.45, 0.1–0.4 | Plesiosaur only (app): skull to front girdle, and hind girdle to tail tip, each ÷ L. The torso between the girdles is at least 0.3 L. |
| `fins.lateral` | 0–14 | Lateral fin pairs: 1–2 are pectoral paddles, 3 or more are a lobe fringe that ripples metachronally |
| `fins.lateralSize`, `fins.dorsal`, `fins.ventral` | 0–0.6, 0–0.4, 0–0.5 | Fin size, dorsal sail height and ventral keel depth (the hatchet blade), each ÷ L |
| `fins.fringe` | 0–1 | Share of thrust from fin ripple instead of the body wave (high: the body stays straight and the fins row) |
| `tail`, `tailSize` | `none` `taper` `fork` `lunate` `fan` `whip`; 0–0.8 | Tail fin shape and span ÷ L |
| `head.eyes`, `head.eyeSize`, `head.stalks` | 0–6, 0.005–0.15, 0–0.5 | Axial: eye pairs plus a median eye when odd. Radial: dot eyes per arm tip. Size and stalk length ÷ L |
| `head.feelers`, `head.feelerLen` | 0–4, 0.05–1.2 | Grasping frontal claws (axial) or arm-tip feelers (radial) |
| `head.mouth`, `head.crest` | `none` `jaw` `cone` `proboscis`; 0–8 | Mouth and head crest rays |
| `lateralLine`, `photophores` | 0–1, 0–24 | Glow dots along the flank, and the ventral counter-illumination row |
| `plates` | 0–1 | Dorsal tergites. Axial only: silicon armour shows as facet spikes (`radial.spikes`). |
| `translucency` | 0–1 | Fins go see-through above 0.35, and radial hubs above 0.5. Bells are always glass. |
| `glow` | 0–1 | Expressed glow (`BodyPlan.glow`, which is the glow gene × darkness). Scales every glow accent. |
| `colour.body`, `colour.accent` | palette roles | One body colour and one accent, named as roles. The chemistry picks the hex: carbon uses `PALETTE`, silicon uses `SI_PALETTE`, a copy of the app's `LOOK_PALETTES.silicon`. |
| `radial.symmetry` | 3, 4, 5, 6, 8 | Arm count (rower) or facet order (bell) |
| `radial.armLen`, `radial.tiers`, `radial.chain` | 0.1–2.5, 1–5, 1–6 | Arm length ÷ L, stepped facet tiers, and bells in the colony chain |
| `radial.spikes`, `radial.trail` | 0–1, 0–4 | Crystal spikes on the facets (geode), and trailing lattice length ÷ L |
| `school` | 1–64 | Individuals that travel together (lab only; in the app the sim's agents are the school) |

### Motion (derived in `motion.ts`, never set by hand)

- **Body wave (carbon).** The lateral offset is `L·A(u)·sin(2π(f·t − u/λ))`, with the crest running nose to tail at `c = λ·L·f`.
  - The frequency is `f = 1.5·L^−0.45·(1 − 0.3·fringe)` Hz, clamped to 0.25–4.
  - The wavelength λ runs from 1.05 down to 0.65 body lengths as `undulation` goes from 0 to 1. The tail amplitude runs from 0.17 L to 0.10 L, reduced by fringe.
  - The animal travels at `V = slip·c`, with slip from 0.78 down to 0.66, as in real fish (0.6–0.8). Distance along the path is `V·t`, so speed and wave can never disagree, and the body never slides.
  - Fin ripples (the dorsal sail and lobe fringes) travel backwards at the same speed `c`.
- **Rowing (silicon hub).**
  - **Power stroke** (first half of the cycle): the arms sweep from 45° to 135° off the travel axis in six 15° beats, with a quick snap at the end of each beat. The paddles are face-on.
  - **Recovery:** the arms fold at the knee, the paddles feather by 90°, and the arms swing forward in 30° beats.
  - The hub advances `stroke = 0.55·armLen·L·(cos 45° − cos 135°)` per cycle, 80% of it during the power stroke, and coasts through recovery. The frequency is `0.95·L^−0.4` Hz.
- **Jet (silicon bell).** The rim contracts to 0.72 of its width in the first 30% of the cycle and refills slowly, while the bell stretches as it contracts. Each pulse moves the bell `0.32·L` (more in a chain), 82% of it during the contraction. The bells in a chain pulse 1/n of a cycle apart, so the colony glides.
- **Banking and bob.** Bodies roll into turns from the path's curvature, at up to about 43°. A slow bob and pitch run separately from the stroke. Radial hubs roll slowly about their travel axis.
- **Schooling.** `schoolOffsets` places members in a staggered golden-angle lens behind and around the leader, each with its own phase and a slow wander.

## 3. BodyPlan → params (`swimmerParamsFromPlan`)

`AppBodyPlan` is a structural subset of the app's `BodyPlan`, so `unpackBodyPlan(births[i].plan)` passes as is. The optional second argument takes the organism's `sociality` gene. Shared by both chemistries:
- `glow` = `plan.glow`, clamped to 0..1 (glow from darkness is already in it)
- `school` = 1 + round(sociality² · 28 · small), where small is 1 below 0.6 m, 0.35 below 1.5 m and 0.1 above
- `eyeBig` = eyeArea ÷ 1.5

**Silicon (`chemistry` is silicon, or `architecture` is radial):**

| Param | From |
|---|---|
| `plan` | `bell` if `flare > 0.25` or `armKind = whip`, else `radial` (the hub rower) |
| `length` | `scale` (rower); 0.5·`scale` per bell |
| `aspect` | rower: 2·`hubRadius` ÷ `scale` × 0.9 (0.3–1); bell: 0.9 + 0.6·flare |
| `radial.symmetry` | `symmetry` (3, 4, 5, 6 or 8) |
| `radial.armLen` | arm length ÷ scale × 1.1 (0.3–2) |
| `radial.tiers` | `tiers` |
| `radial.chain` | bells: `tiers` − 1 (1–5). The facet tiers that accrete as it grows bud the colony. |
| `radial.spikes` | `tileLength` (0 flat tiles … 1 geode spikes) |
| `radial.trail` | bell: 1.5 + arm ÷ scale for whip arms, else 0.8; rower: 0.4 for branch arms, else 0 |
| `head.eyes` | `eyeCount` ÷ `symmetry` (dot eyes per arm tip, at least 1 unless `eyeKind = none`) |
| `head.eyeSize` | 0.025 + 0.025·eyeBig |
| `head.feelers` | 2 for branch arms |
| `translucency` | bell 0.75; rower 0.35 + 0.3·glow |
| `colour` | rower: violet body (`crimson` role) with an ice accent (`bone`, or `blush` when `accent ≥ 0.5`). Hunters (diet > 0.6) get an indigo body (`maroon`). Bell: pale-lilac glass (`red` role) with violet rims and stems (`crimson`, or `maroon` for hunters). |
| always | no fins, no tail, no crest, no mouth, no lateral line or photophores |

**Carbon:**

| Param | From |
|---|---|
| `plan` | `ribbon` if segmentCount ≥ 11 and girth < 0.6; `segmented` if plateCover ≥ 0.45, legPairs ≥ 2 or carapace ≥ 0.4; `disc` if flatten < 0.65 and girth ≥ 0.9; otherwise `fusiform` |
| `length` | `scale` |
| section | 0.45·(girth ÷ n)^0.6, clamped to 0.03–0.4: the trunk's cross-section ÷ L, where n = max(3, segmentCount) |
| `depth` | ribbon 2.6·flatten (1.5–4); segmented 0.45·flatten (0.25–0.7); disc 0.5; fusiform 0.7 + 2.2·((flatten − 0.45) ÷ 0.85)^1.2 + 0.4·crest (0.6–3.4) |
| `aspect` | section ÷ √depth (for a disc, 2.2·section ÷ √depth) |
| `peak` | 0.45 − 0.4·gradient |
| `undulation` | (n − 4) ÷ 10: more segments swim more like an eel |
| `fins.lateral` | segmented: n − 2 lobe pairs (4–13); otherwise legPairs (max 2), or 1 pectoral pair if finSpan > 0 |
| `fins.lateralSize` | segmented 0.12 + 0.12·finSpan; otherwise 0.08 + 0.2·finSpan |
| `fins.dorsal` | crest × 0.12 (ribbon) or × 0.1, plus 0.02 for frills |
| `fins.ventral` | fusiform: 0.2·(flatten − 0.8)·(1 − plateCover), a keel on deep bodies |
| `fins.fringe` | segmented 0.85; ribbon 0.2 + 0.6·crest; otherwise 0 |
| `tail` | segmented `fan`; otherwise none → `taper`, taper → `fork` if finSpan > 0.3, whip → `whip`, fluke → `lunate`, club → `fan` |
| `tailSize` | 0.15 + 0.3·finSpan |
| `head.eyes` | `eyeCount` (0 if `eyeKind = none`) |
| `head.eyeSize` | (0.22 + 0.3·eyeBig) × section ÷ 2, so eyes scale with the head and grow in the dark |
| `head.stalks` | (eyeArea − 0.8)·0.25, up to 0.2 (×1.5 when segmented) |
| `head.feelers`, `feelerLen` | hunters (diet > 0.55) with horns: 2 claws for a pair or tusks, else the horn count (max 4). Length is hornLength ÷ scale × 1.5 + 0.15. |
| `head.mouth` | `jaw` if jaw > 0.5; `cone` if diet > 0.6 |
| `head.crest` | round(6·crest) rays |
| `lateralLine` | 0.8·glow, once glow > 0.2 |
| `photophores` | glow > 0.3: round(16·glow·(1 − n ÷ 20)) pairs, drawn only if that makes at least 3 |
| `plates` | max(plateCover, carapace) (× 0.6 unless segmented) |
| `translucency` | 0.15 + 0.4·glow − 0.5·plateCover (0–0.7) |
| `colour` | body: hunters (diet > 0.6) `red`; grazers (diet < 0.3) `bone` or `blush` by hue; the rest `redLight`. Accent from `accent`: crimson, maroon, blush or bone, never the body colour. |

## 4. The five variants

Each starts from a BodyPlan-like input and genes, then goes through `swimmerParamsFromPlan`. A small override shows the generator is configurable (see `variants.ts`). The names are for review only.

| # | Name | Inspiration | Built | Motion (seed 1) | Why |
|---|---|---|---|---|---|
| 0 | Crested Oarwyrm | oarfish, lancelet | carbon ribbon, 6.8 m | wave 0.49 Hz, travels 1.44 m/s under a 2.18 m/s wave | Sixteen thin segments make a 7 m ribbon that swims anguilliform, rippling one long dorsal sail under a crown of crest rays. |
| 1 | Five-eyed Lobeclaw | Anomalocaris, Opabinia | carbon segmented, 2.3 m | wave plus lobe fringe, 0.78 Hz, 0.94 m/s | A plated hunter: its segments become nine pairs of lobes rowing in a metachronal wave, and its horns two grasping claws. |
| 2 | Lantern Hatchet | hatchetfish, lanternfish | carbon fusiform, 0.27 m, school of 32 | wave 2.7 Hz, 0.60 m/s | Tiny, deep-bodied and social, it schools in dozens; glow .85 in the dark lights a photophore row along its keel. |
| 3 | Glass Oarstar | radiolarian, nauplius, sea angel | silicon radial, 1.1 m, school of 10 | row 0.91 Hz, 0.53 m per stroke | Silicon is radial: a six-fold crystal hub rows on rod arms in stepped 15° beats, with cyan dot eyes at every arm tip. |
| 4 | Prism Lanternchain | siphonophore, ctenophore, pyrosome | silicon bell chain, four 0.77 m bells | jet 0.82 Hz, 0.39 m per pulse | A flared, buoyant silicon hub carries its tissue as faceted glass bells; five tiers bud a four-bell colony that jet-pulses in turn. |

## 5. The lab

Run `npx vite` in `mockups/red-world`, then open `http://127.0.0.1:5183/fauna.html?view=…`. `fauna.html` routes every `view=aquatic…` to `src/fauna/aquatic/lab.ts`; every other view is the land lab, unchanged.

| URL | What it shows |
|---|---|
| `?view=aquatic` | All five in one tank (about 50 swimmers), with the free camera. Keys 1–5 jump to a variant. `&water=nitrogen` swaps the dark carbon water for pale liquid nitrogen. |
| `?view=aquatic&i=N` | Close-up of variant N, followed by the camera. Its own water, a param panel (top right) and a re-roll-seed button. Edits are written back to the URL as `&set=`. |
| `?view=aquatic-strip&i=N` | Six frames over one stroke or pulse cycle from a fixed camera, for judging the body wave against the travel |
| `?view=aquatic-sheet&i=N` | The same swimmer under six param settings |

Other options:
- `&seed=N` re-rolls proportions.
- `&set=key:value,fins.lateral:9` overrides any param.
- `&t=SEC` freezes time.
- `&crowd=N` multiplies the tank's school sizes.
- `&style=smooth` turns the pixel pass off.

The free camera (`labcam.ts`) works as in the land lab: drag to orbit, wheel to zoom, WASD and Q/E to move, F to follow.

**The two waters (lab only).**
- **Carbon water** is dark violet-oxblood. The rim light is blush, so silhouettes read pale on dark.
- **Liquid nitrogen** is pale, clear and faintly ice-lilac, with long visibility. The rim turns indigo, so silhouettes read dark on pale.

Depth attenuation darkens bodies toward the floor. Glow is luminance-normalised HDR above 1, so only the cyan accents bloom.

## 5a. In the app (src/render/faunaLib/aquatic, 2026-11-08)

The port follows the tables above with these owner-feedback changes. The code is the reference where they differ.

- **Fish-like by default.** No round paddle pads anywhere. A carbon swimmer has a small swept-back dorsal fin, one small pectoral pair just behind the head and a caudal fin from `tailKind`, all rooted on the body and drawn with the swept, tapered `fin` part. Silicon paddles are rod oars. The bead layout has no paddle beads, so far proxies, the bestiary sprite and the card's bead fallback are pad-free too, and the fluke bead stands upright.
- **Plesiosaur.** `axialKind` returns `plesiosaur` first when `legPairs ≥ 2` and (`limbLength ≥ scale` or `finSpan ≥ 0.7`).
  - Body: a small skull, a slim neck, a barrel torso between the girdles and a tapering tail. `fringe` 0.85 keeps the body almost still.
  - Flippers: four long cambered hydrofoils (the `fin` part at chord-scaled thickness, the left one mirrored so both arch up). The fore root chord starts at the front girdle and the hind one ends at the hind girdle, inset inside the flank along the whole chord.
  - Motion: each flipper flaps ±0.6 rad with a pitch twist a quarter cycle ahead (leading edge down on the downstroke). Left and right beat together; the hind pair lags the fore pair by 0.3 cycle (a design choice, not a cited measurement). One stroke per stroke cycle, so the rate follows the sim speed through the integrated phase.
- **Necks and tails** (`fromPlan.ts`, pure and monotone):
  - `neckFrac` = 0.06 + 0.39·seg·(1 − 0.55·head)·(1 − 0.45·gape), where seg = (segmentCount − 3) ÷ 13, head = (headScale − 0.75) ÷ 1.25 and gape = gapeSize ÷ (2·scale), each clamped to 0–1.
  - `tailFrac` = base + 0.03·tailSegments (0.1–0.4), with base 0.2 for whip, 0.12 for fluke and 0.14 otherwise. On fish it moves the widest point forward: `peak` −0.8·(tailFrac − 0.2).
  - fauna.ts passes the species book's attracted plan; `gapeSize` is an attracted proportion, so a species shares its neck.
- **Level of detail.** The nearest `SWIM_MAX` (12) lofted swimmers pose with this builder, ranked by camera distance with the loft's hysteresis and in view first. The rest use the bead loft. A pose that throws is rolled back and that creature keeps the bead loft. Silicon axial (armoured walker) plans never use this builder.

## 6. Porting notes for `src/render`

1. **Where it goes.** Make it a swim path inside `src/render/fauna.ts` for `mode === LOCOMOTION.swim`, replacing the bead spine wave and the radial roll. A sibling `src/render/swimmers.ts` driven by fauna.ts also works. Either way, keep the `FaunaPart` API (`hit`, `layoutOf`, `locate`) covering swimmers, because `pick.ts` and `counterpart.ts` rely on it.
2. **Code to copy.** Copy `params.ts`, `motion.ts`, `build.ts` and `fromPlan.ts`. They are pure apart from the `V3` helpers. Never import from `mockups/`. Feed `unpackBodyPlan(births[i].plan)` (cached by id, as fauna.ts already does) and `geneField('sociality')` from the organism record, then call `buildSwimmer(params, organismId)`, so each animal keeps its ±4% jitter for life.
3. **Size.** Set `params.length = displayLength(plan.scale)` (`render/layout.ts`) before building, so swimmers follow the same display-size rule as walkers.
4. **Paths from the sim.** The app has no paths. Give each animal a trail: a ring buffer of its interpolated world positions, sampled about every L ÷ 20 of travel.
   - `Path.at(s)` walks the trail back from the head, and `s0 + advance(t)` becomes 0 at the head.
   - Newborns extend the trail straight back along their `heading`.
   - The trail is what makes bodies follow their own turns and bank.
5. **Speed drives the beat, so nothing slides.** The lab fixes the frequency and derives speed; the app has to do the reverse, because the sim owns speed (`e.speed`, already measured in fauna.ts).
   - Body waves: `f = V ÷ (slip·λ·L)`. Rowers and bells: `f = V ÷ stroke`.
   - Clamp to the lab ranges, with an idle floor of about 0.3 Hz so a resting animal still breathes its fins.
   - Integrate the phase per animal (`φ += f·dt`), never `f·t`, so a speed change can't jump the pose.
6. **Level of detail.** Pose fully within `ANIM_RADIUS`/`ANIM_MAX`. Beyond that, hold the rest pose (a straight spine and open bells) and drop the dot parts. Lab budget on a loaded machine: a 49-swimmer tank costs about 2.4 ms per frame to pose plus 1 ms to fill the tube batch (about 30,000 vertices). One pose costs about 100–140 µs for an axial swimmer or a bell chain, and about 30 µs for a radial hub.
7. **The GPU path for hundreds.** Every motion function is closed form (sin, smoothstep, floor), so the body wave can move into a TSL `positionNode` on a per-species template, driven by per-instance attributes (phase, frequency, length, bank). Use identity instance matrices, because in r187 `positionNode` runs after instancing (CLAUDE.md "Stack"). The CPU path stays the reference.
8. **Batching.** Put every swimmer into one opaque and one translucent dynamic tube/sheet batch, plus one `InstancedMesh` per part type (9 types, and 4 of them also have a translucent twin). That is at most 15 draw calls whatever the count, and no per-creature materials. Part caps scale with the swimmer count.
9. **Material.** CLAUDE.md allows one custom world material, so port the shading as options of `src/render/material.ts`, not as a new material:
   - fresnel alpha for translucent fins and bells
   - caustics on up-facing lit surfaces below `seaLevel`
   - the back-scatter rim (art-look adds a `rim` option)
   - HDR glow from `aGlow`

   The lab's water background, fog and `WATERS` table are lab-only. In the app, the sea (`src/render/sea.ts`) and the look palette own the water.
10. **Colour.** The palette role keys match `LOOK_PALETTES`, so `{ body, accent }` resolves through the look palette (carbon or silicon by composition, never by world id). Silicon dot eyes take the `glow` role.
11. **Watch for:**
    - instance bases must be right-handed (§1)
    - translucent batches don't write depth, so the post pass draws no ink outline around bells; their silhouette comes from the rim and their dark accents
    - bell rims and ribbon tails are open tubes, so the material must stay double-sided
