# Fauna colour reskin: chemistry sets the skin, the ground sets the armour

> Owner ask (Caden): "We want to do a colour reskin for the creatures, should it be informed also by the minerals in the world available + their life form base?"
> Answer: **yes, in two layers, not three.** Life-form base sets the skin palette (it mostly does already; two silicon bugs to fix). World minerals set the **hard parts** (plates, horns, teeth, ceramic tiles) through biomineralisation, stamped once per species. Diet uptake is cut.
> Art layer only. Reads `VisualInputs`, writes nothing back. Owner of the code: art-fauna (`palette.ts`, `faunaLib/species.ts`, `faunaLib/adapter.ts`, `fauna.ts`, `sprite.ts`, `counterpart.ts`).
> Baseline: `session/art-layer` at `ded5b4c`. Hex values below were computed with that branch's `palette.ts` (`creatureColour`, OKLab), not eyeballed.

**Stale items in the brief.** On `session/art-layer` the sky is now Rayleigh blue on both worlds and the silicon look is cool grey, not violet (`66aec17`, "de-purple the silicon look"). The silicon ground is `#B0BCC8` (OKLab L 0.79); the carbon ground is still `#E8331F` (L 0.61, hue 30°). The glow is `#3FF5E0` / `#6FF4FF` at OKLab hue ≈ 183°. A fourth silicon mineral, `reducedLava` (pale enstatite), is in the art branch's crust look. Its config arrives on another branch. This doc covers it.

Tags: **[sci]** sourced real science · **[analogue]** a real Earth case used by analogy · **[speculative]** the silicon world's own reasoning · **[art]** a look choice · **[unverified]** a claim I recalled but didn't check against a source this session.

---

## 1. Decision and rationale

### What stays, what changes, what's cut

| Layer (brief) | Verdict | Why |
|---|---|---|
| 1. Chemistry sets the palette family | **Keep, and fix it rather than reskin it.** The carbon ring is already a defensible pigment-plus-structural ring. The silicon ring has two real bugs. | **Carbon ring:** orchid → violet → periwinkle → slate → pewter → sage → leaf → maize → amber → orange. It already reads as animal colour: carotenoid yellows and oranges, melanin darks on hunters, and violet and blue as structural colour [sci: Prum & Torres 2003]. Re-hueing it would churn every species test for no gain.<br>**Silicon ring (`RING.silicon` on the art branch):** (a) it has an anchor at hue 185°, inside the glow band; 9 of 65 ring samples sit within ±15° of the glow at chroma ≥ 0.06. (b) Its last anchor folds back from 258° to 240°, so two of the book's 9 hue candidates are only **ΔE 0.008** apart. Two species can get the same colour, which breaks the #57 guarantee. |
| 2. Minerals tint hard parts | **Keep. This is the reskin.** | The anchor is real and vivid:<br>• the scaly-foot snail's iron-sulphide sclerites [sci: Warén et al. 2003]<br>• chiton teeth capped in black magnetite [sci: Lowenstam 1962]<br>• limpet teeth of goethite [sci: Barber et al. 2015]<br>• rodent incisors orange from iron-rich enamel [sci: Gordon et al. 2015]<br>It splits the body cleanly into soft = pigment (species) and hard = mineral (world). It gives the rock chips on the selection screen a creature-level consequence. |
| 2a. ...from the species' **home habitat** | **Cut to P2.** Use the **world's mineral mix** (squared shares, as the ground already does) instead. | 1. Life starts in the shallows, which sit on the lowest mineral (basalt on carbon at elevation 0.2, reduced lava or silicide on silicon). Almost every early species would get the same "home", so the variety gain is small.<br>2. `SpeciesBook` bins an animal at the snapshot where the renderer **first sees** it. That depends on frame pacing, so the founder's position can land on either side of a patch border, and rehearsal ≠ live.<br>3. The bestiary sprite's off-world fallback has no position to recompute it from.<br>4. The world mix plus the rock chip is the bigger, *controllable* demo lever. |
| 2b. Oxidation state | **Keep, stamped per species at founding**, carbon only. | Reduced iron biominerals are black (magnetite, greigite) and oxidised ones are brown or ochre (goethite) [sci, same sources]. Stamping at founding keeps "members alike" and adds a free distinctness axis: **old lineages wear black iron, lineages founded after the oxygen rise wear ochre**.<br>It never contradicts the stats. Chitons still make black magnetite in today's oxygenated seas, so an old lineage keeping black armour is real biology. |
| 3. Diet uptake (carotenoid-style) | **Cut.** | 1. The ring already slides by diet (grazers light and cool, hunters dark and warm).<br>2. Pulling every grazer toward the flora colour **converges** grazers, and grazers are most species early on. That fights #57.<br>3. The flora colour moves over the run (purple → green ratchet), so grazers would either change colour mid-run or split by era for a reason no one can see.<br>4. Carotenoids are carbon chemistry; silicon has no analogue.<br>The real effect is diet-derived carotenoid ornament [sci: Hill 2002], but it doesn't pay here. |
| Light: dim → darker bodies | **No new rule.** | `lookPalette` already dims the whole scene by `light^0.22`, and silicon bodies already sit at L 0.37–0.52. The deep-sea case (animals go black or red where the only light is blue bioluminescence) [sci: Johnsen 2005] *supports* the existing dark silicon ring; it doesn't need a second mechanism.<br>Glow stays as `develop()` makes it (`glow × (1 − light)`). |
| Light: countershading | **Rejected.** | Countershading exists to flatten an animal's 3D form under top light [sci: Cuthill et al. 2016]. Under our cel shading it would erase exactly the form cue we want judges to read. |

### Why the minerals tint only the hard parts

- **Distinctness.** The species book's body colour stays the species axis, untouched. Hard parts are a small area, and the world shares their colour, so they read as "this world's armour", not as a competing species signal.
- **Honesty.** Biomineral colour really comes from the mineral. Soft-tissue colour on Earth comes from pigment, not from the rock underfoot.
- **Budget.** It costs one more colour slot in a CPU-side array (`SLOTS` 5 → 6). The loft reads a per-ring slot index (`loft.ts:82`), so there are no new draw calls, vertex buffers or materials.

---

## 2. Mapping table

All colours are OKLab mixes (`labMix`). **Monotone** means that as the input rises, the output moves one way only.

### 2.1 Skin (soft tissue): chemistry family. Mostly unchanged.

| Input | Rule | Range | Science and source | Tag |
|---|---|---|---|---|
| `plan.chemistry` (from `world.composition`) | Picks the ring: carbon `RING.carbon` (10 anchors, unchanged); silicon the **new 7-anchor ring** below | — | Carbon: carotenoids give yellow, orange and red; melanins give brown and black; violet and blue are structural [sci: Prum & Torres 2003]. Silicon: metal and ceramic tones tinted by impurities. The hues themselves are art. | carbon [sci]/[art]; silicon [speculative]/[art] |
| species `hue` (book) | Place on the ring, `creatureRing` (unchanged) | 0..1 | — | [art] |
| `diet` | Monotone: hunters darker and richer (unchanged) | carbon ΔL +0.04 → −0.24; silicon 0 → −0.08 | Predators darker: [art] (readability), not claimed as science | [art] |
| `accent` | Pattern, fins and crests (unchanged). **No longer colours horns and plates** (they move to hard). | 3 families | — | [art] |

**New silicon ring.** OKLCH anchors in order; this replaces `RING.silicon`:

`[0.52,0.12,78] gold · [0.50,0.11,108] olive · [0.50,0.12,140] green · [0.47,0.035,205] pewter · [0.47,0.12,232] steel blue · [0.43,0.15,258] deep blue · [0.38,0.06,262] gunmetal-blue`

- Measured: **0 of 65** samples in the glow band at chroma ≥ 0.06 (was 9). The minimum ΔE between the 9 hue candidates is **0.040** (was 0.008).
- The world's first species (hue 0.5, grazer, ring position 0.4) lands between green and pewter, at `#406C48`. That's saturated, not muted.
- It reuses carbon's trick: a low-chroma pewter anchor where the ring crosses cyan.
- It stays de-purpled, as the owner ruled.
- Rationale (all [analogue], [unverified]):
  - gold ← titanium-nitride-like coatings
  - green ← nitrogen-doped silicon carbide
  - steel blue ← the lustre of crystalline silicon
  - deep blue ← thin-film interference on nitride

### 2.2 Hard parts: minerals by biomineralisation (new)

There's one new role per mineral, `hard: [fresh, oxidised]`, carried in `crustLook.ts` `Family` beside the existing flora roles.

| World | Mineral (`terrain.crust`) | Hard tint fresh → oxidised | Science | Tag |
|---|---|---|---|---|
| Carbon | `basalt` | `#2C3634` green-charcoal → `#5C3C2C` umber | Fe(II)-rich rock. Reduced iron biominerals are black (iron sulphides in scaly-foot sclerites [Warén 2003]). Fe(III) oxyhydroxides are brown. | [sci] mechanism, [art] hex |
| Carbon | `ironstone` | `#1E1C22` magnetite black → `#B27C2C` goethite ochre | Chiton teeth are magnetite, black [Lowenstam 1962]; limpet teeth are goethite, yellow-brown [Barber 2015]. **Ochre, not hematite red**, so oxidised armour never melts into the red ground (hue 70° vs the ground's 30°). | [sci], [art] |
| Carbon | `granite` | `#E6DDCC` ivory (doesn't oxidise) | Silica-rich and pale. Biogenic silica (opal: diatoms, glass sponges) is colourless to white [unverified]. Say "pale mineral armour", **not shell**: real white shell is calcium carbonate, and calcium isn't modelled (same rule as M6). | [analogue], [art] |
| Silicon | `silicide` | `#5C6678` gunmetal → `#D6D2CA` silica (never reached: oxygen is pinned at a trace) | Metallic Fe–Si grains, as in enstatite chondrites [keil1968: occurrence]; metallic grey [unverified]. Organisms building from it: speculative. | [speculative] |
| Silicon | `nitride` | `#D2D7DC` porcelain grey-white | Si₃N₄ (nierite) [lee1995: occurrence]; the ceramic is grey-white [unverified]. This matches CLAUDE.md's "plates are silicon-nitride ceramic". | [speculative] |
| Silicon | `reducedLava` | `#C2BDB4` warm pale grey → `#E8E6E0` | Enstatite (MgSiO₃), near-white as in aubrites [unverified]. | [speculative] |
| Silicon | `waterIce` | **weight 0**, contributes nothing | Config: "it holds no silicon, so nothing grows on it". Same as its `floraWeight: 0`. | from config |

**World hard tint** (one per world and rust step):
- `worldHard = labMean(hard_i(rust), weight_i)`.
- `weight_i ∝ (share_i · floraWeight_i)²`, normalised. That's `blendFamilies`' existing `fw` weights: squared, so the dominant rock sets the armour, and ice is excluded.
- If every weight is 0, fall back to the rock weights `rw`.

**Species hard tint** (stamped once, when the species gets its colourway in `SpeciesBook.colour()`):

```
r      = quantise(crustRatchet level, {0, 0.5, 1})            // carbon: max O₂ seen ÷ rustOxygen (10%); silicon ≈ 0 always
h      = labMix(worldHard(r), speciesAccent, 0.25)            // 25% of the species accent keeps two species' armour apart
if |L(h) − L(body)| < 0.14: push L(h) to body ± 0.14 on the side the mineral already sits (flip if past 0.95 / 0.12)
if C(h) ≥ 0.04 and hue(h) ∈ (165°, 200°): rotate hue to the nearer band edge   // the glow band stays reserved
```

| Input | Rule | Monotone in |
|---|---|---|
| oxygen (via `crustRatchet`, carbon) | Iron minerals: fresh → oxidised | max O₂ seen, at the species' founding |
| rock chip (`withCrustChoice`, favour 0.75) | The picked mineral dominates `worldHard` | the picked share |
| light, temperature, pressure | **No effect** on hard parts | — |

---

## 3. How species distinctness is preserved (#57)

**What moves**
- **The silicon ring's anchors.** Their spacing *improves*: the minimum candidate ΔE goes from 0.008 to 0.040.
- **The plate, horn and tooth colour.** It moves from body or accent to a new `hard` slot.

**What stays**
- the book's binning, `SETTLE`, `SEPARATE`, `KAPPA`
- `colour()`'s farthest-hue search
- the carbon ring
- `creatureRing` and the diet slide
- the accent families
- one pattern per species

**Rules**
1. `hard` is part of the **colourway**, like `bands` and `spots`. A bin that wears another species' colourway also wears its armour, so lone mutants and the edge of a species' gene cloud never show armour of their own.
2. `hard` is stamped in `colour()` and never recomputed. It doesn't depend on where the animal stands, the frame, or the camera. Its inputs are:
   - the crust mix, a pure function of the world, the seed and the rock chip (`visualInputs.crustOf`)
   - the ratchet step at that moment, a pure function of the deterministic oxygen history
3. **No per-cell colour anywhere.** Walking from basalt onto granite changes nothing on the animal.
4. Members of a species have the same skin and the same armour. Species are told apart by skin hue first (unchanged), then accent, then the 25% accent share in the armour and the founding era.
5. The guarantees become tests (§6):
   - the silicon ring's minimum candidate ΔE ≥ 0.03
   - existing carbon tests unchanged

**Known determinism caveat (pre-existing, not new).** Which bin becomes a colourway already depends on first-seen order in the renderer. The armour inherits exactly that stability, no worse. The ratchet step is coarse (3 levels), so a stamp only differs between runs if a species is coloured within a frame of a step boundary.

---

## 4. Thumbnail palettes

Computed with the art branch's `creatureColour` and the rules above. "Natural" uses mid shares: carbon basalt 0.47, granite 0.33, ironstone 0.20. Rock chips use favour 0.75. Silicon bodies use the new ring.

### Carbon

World hard tints:

| Crust | Fresh (pre-oxygen) | Oxidised |
|---|---|---|
| Natural | `#5C605B` | `#8C6F59` |
| Volcanic | `#323B39` | `#624332` |
| Iron-rich | `#232127` | `#B17D32` |
| Continental | `#DAD2C3` | `#E0D5C3` |

| Species (diet, hue, accent) | Skin | Accent | Hard, natural (pre-O₂) | Hard, iron-rich (pre-O₂) | Hard, iron-rich (oxic) | Hard, continental |
|---|---|---|---|---|---|---|
| Periwinkle grazer (0.05, 0.5, 0.15) | `#80A5D6` | `#314D71` | `#515C61` | `#272C38` | `#90724C` | `#CFCFCC` |
| Orchid grazer (0.1, 0.25, 0.5) | `#A994E7` | `#6C293F` | `#635354` | `#35242D` | `#A0683A` | `#E6C9C0` |
| Slate omnivore (0.5, 0.375, 0.15) | `#638590` | `#163039` | `#4A5452` | `#21252B` | `#C5A373` | `#ABAAA0` |
| Olive-maize hunter (0.9, 0.625, 0.5) | `#847417` | `#E0D1B4` | `#4D4D43` | `#4D4847` | `#C09559` | `#E0D4BF` |
| Pewter-teal hunter (0.95, 0.125, 0.85) | `#3C615E` | `#D88225` | `#907E69` | `#422F25` | `#BB7E2F` | `#E0C1A0` |

Against the carbon ground (`#E8331F`), every hard tint has hue ≥ 40° or chroma < 0.06, so none is ground-red. Iron-rich pre-oxygen armour is near-black (L 0.26–0.41), the strongest silhouette accent on red.

### Silicon

World hard tints:

| Crust | Hard tint |
|---|---|
| Natural (silicide 0.35, nitride 0.30, ice 0.15, lava 0.20) | `#949AA4` |
| Metal-rich | `#5F697A` |
| Nitride | `#D0D5DA` |
| Reduced lava | `#C0BCB3` |

| Species (diet, hue, accent) | Skin (new ring) | Accent | Hard, natural | Hard, metal-rich | Hard, nitride |
|---|---|---|---|---|---|
| Green grazer (0.05, 0.5, 0.15) | `#406C48` | `#E4F0FC` | `#A7AFB9` | `#7F8A9A` | `#D5DCE2` |
| Olive-gold grazer (0.1, 0.25, 0.5) | `#626A15` | `#B9DCF6` | `#9DAAB8` | `#7F8EA1` | `#CBD7E1` |
| Steel-blue grazer (0.15, 0.75, 0.85) | `#1B637E` | `#E1E4CC` | `#A7ACAE` | `#7E868E` | `#D4D9D7` |
| Deep-blue hunter (0.9, 0.625, 0.5) | `#0C4868` | `#B9DCF6` | `#9DAAB8` | `#758497` | `#CBD7E1` |
| Moss hunter (0.95, 0.125, 0.85) | `#325911` | `#E1E4CC` | `#A7ACAE` | `#7E868E` | `#D4D9D7` |

- Silicon hard tints are near-neutral (chroma ≤ 0.03), which is honest for ceramics and metals. The silicon world signature is **value**: gunmetal armour vs porcelain armour on dark skins.
- Every skin is L ≤ 0.50 against the L 0.79 ground; the existing test needs < 0.54.
- **Trade-off, accepted:** on a nitride world the armour and the pale ice accent are both near-white, so they merge. Readability against the ground is unaffected, because the body carries the silhouette.

---

## 5. Demo moments

1. **The rock chip changes the armour.** On the selection screen, same seed, pick *Volcanic*, then *Iron-rich*, then *Continental*. The founders' later plated descendants wear charcoal, black-iron and ivory armour. Their skins are identical across the three, because the species book is unchanged.
   - Talk track: "Their skin is their chemistry; their armour is made of the ground they live on, like the snail at deep-sea vents that armours itself in iron."
2. **Read a lineage's age from its armour.** On an iron-rich carbon run, species founded before the oxygen rise keep black magnetite armour. Species founded after it wear ochre goethite. Both live side by side in the complex-life phase.
   - Talk track: "chitons still make black iron teeth in today's oxygen seas".
   - This is a slow process with no event, and it follows the oxygen stat through `crustRatchet`.
3. **Silicon, Metal-rich vs Nitride.** Gunmetal plates vs porcelain plates on dark green and blue skins. The cyan glow stays the only cyan on screen, now that the teal ring anchor is gone.
4. **The bestiary matches the world.** Open a bestiary entry: the tile sprite, the specimen page's turning 3D model (`bestiary:window`) and the inspect card's live view all show the same armour hex as the animal in the world (§6, test 5). Extinct kinds keep the armour they were drawn with, because it's in the `SEEN` record.

---

## 6. Implementation plan (art-fauna)

Estimate: about 160 lines including tests, roughly 2 hours. No sim, config or contract changes.

| File | Change | Lines |
|---|---|---|
| `render/crustLook.ts` | Add `hard: number` to `Family`, with `[fresh, oxidised]` hexes from §2.2 in each `MINERAL_LOOK` entry and in `NEUTRAL_FAMILY`.<br>`blendFamilies`: route `'hard'` through `fw` (squared × floraWeight), falling back to `rw` when every `fw` is 0.<br>Export `crustHard(inputs, rustStep): number \| undefined`, memoised like `crustGlobal`. | ~25 |
| `render/palette.ts` | 1. Replace `RING.silicon` with the 7 anchors.<br>2. Add `creatureHard(silicon, body, accent, worldHard): number` with the mix, value guard and band guard from §2.2.<br>3. `creatureColour(..., hard?)`: tones 2 (plate) and 4 (horn) return `hard` when it's given, or `L−0.08` body otherwise (today's plate tone).<br>4. `WORLD_TONE` becomes `[0, 1, 2, 0, 2, 5, 5]`: plates, horns and jaws now share one tone everywhere. | ~35 |
| `render/faunaLib/species.ts` | 1. `SpeciesLook.hard`; `SpeciesBook.setWorldHard(hex)` (fauna calls it when the quantised rust step or crust changes); `colour()` stamps `hard[b] = creatureHard(...)`; `lookOf` returns the worn bin's `hard`; `reset()` clears it.<br>2. `SEEN_STRIDE += 1`, storing the hex as a float32. It's exact, because 0xFFFFFF < 2²⁴.<br>3. `FaunaLook.hard`. | ~25 |
| `render/faunaLib/adapter.ts` | `SLOT.hard = 5`, `SLOTS = 6`. Move these parts to `SLOT.hard`:<br>• `PLATE` (l.133)<br>• `plateSi` (l.203, unless it's a spot)<br>• `HORN` (l.170–171)<br>• `hornSi` (l.137, l.199)<br>This also fixes today's split, where plate beads wear the body and flap plates wear the accent. | ~8 |
| `render/fauna.ts` | 1. `TONE_SLOT[2] = TONE_SLOT[4] = SLOT.hard`; `bake()` adds the hard hex to `slotHex`.<br>2. Each frame, `book.setWorldHard(crustHard(vi, step))`.<br>3. The jaw bead (`creatureLayout` l.252, tone 4) becomes hard automatically: teeth are biomineral. | ~10 |
| `render/sprite.ts`, `render/counterpart.ts` | Pass `look.hard` to `creatureColour`.<br>Off-world or never-seen plans: `creatureHard` of the current world's `crustHard`, or undefined, which keeps today's look.<br>`counterpart.ts` is now the live view of the clicked creature itself (there are no creature counterparts, per CLAUDE.md), and the bestiary's 3D specimen goes through the same path. Both take `hard` from `faunaLook`. | ~12 |

**Tests** (`palette.test.ts`, `faunaLib.test.ts`, `crustLook.test.ts`), Tier 0 related runs:
1. **Hard reads against its body.** For both chemistries, every hue in `hues`, diets {0.05, 0.5, 0.95}, accents {0.15, 0.5, 0.85}, each mineral alone and the natural mix, and rust {0, 0.5, 1}: |ΔL(hard, body)| ≥ 0.14.
2. **The glow band stays reserved.** No hard tint and no silicon skin has chroma ≥ 0.06 within ±15° of the glow hue. This mirrors the existing carbon skin test.
3. **Ring spacing.** On both rings, the minimum OKLab ΔE between `colour()`'s 9 hue candidates is ≥ 0.03. The silicon ring fails this today at 0.008, so the test goes in red first.
4. **Species stamp.**
   - Two members of one bin get equal `hard`, whatever their position.
   - A bin coloured at rust 0 keeps its hard after the ratchet reaches 1, while a bin coloured after that gets the oxidised hard.
   - A wearer bin shows the worn bin's hard.
5. **Sprite match.** After fauna draws a plan, `faunaLook(raw).hard` equals the entry's slot hex.
6. **Crust.**
   - A waterIce-only weight vector doesn't produce the ice tint.
   - The Iron-rich chip gives a darker pre-oxygen `worldHard` than Continental (ΔL ≥ 0.4).
   - The same world, seed and chip give the same hex.
7. **Existing tests stay green without edits** (carbon skin, accent contrast, NaN safety, purity), except the silicon ring assertions that test 3 replaces.

**Order:**
1. Ring fix and tests 2–3. This ships alone, as a #57 bug fix.
2. The hard slot plumbing, then tests 1, 4 and 6.
3. The sprite and counterpart, then test 5.

**Cut line:** if time runs out, ship step 1 only. The feature freeze is 10:00 on Sunday; after that, only step 1 qualifies, as a #57 bug fix. Per the owner's rulings, run only `npx vitest related --run <files>`, once, at the end. No browser or smoke runs.

**P2 (parked for `docs/NOT_NOW.md`):**
- Home-habitat override from the sim's `crustMap` cell, if `births` ever carries the birth cell. It would use a 3×3 majority vote and apply only when the local share is ≥ 0.75.
- Thin-film interference shimmer on silicon nitride armour (species hue → film thickness → colour, skipping the cyan order). [speculative]/[art]
- An inspect-card line, "Armour: goethite, from the ironstone". It needs a `MineralDef` field with `why`/`sources`, which is a contract change for Caden.

---

## 7. Iteration log (condensed)

**Round 1. Proposal:** the team lead's three layers as written. Hard parts take the **home-habitat** mineral (argmax of `terrain.crust.weights` at the founder's position); grazer accents pull toward the flora blush; dim light darkens bodies.

**Critique:**
- (a) The home habitat is frame-dependent at first sighting and collapses to the shore mineral for early species. The sprite fallback can't reproduce it.
- (b) The diet pull converges grazers (a #57 risk) and drifts with the flora ratchet.
- (c) Dim-light darkening double-counts `lookPalette` dimming.
- (d) Measuring the silicon ring found a glow-band anchor and a near-duplicate candidate pair (ΔE 0.008), so the existing distinctness guarantee is already broken on silicon.
- (e) Plates and horns are split across the body and accent slots today, so "hard = mineral" needs its own slot.

**Round 2. Revision:**
- The world mix with squared `fw` weights replaces the home habitat.
- Oxidation is stamped at colourway time: a free era axis, and a truthful one (chitons).
- Diet and light layers cut; countershading rejected.
- The silicon ring is rebuilt with 7 anchors and a pewter cross-over (0 band hits, ΔE 0.040).
- A `SLOT.hard` that unifies plates, horns and teeth.
- 25% of the species accent goes into the armour, with a ΔL ≥ 0.14 guard. Measured: the first draft pushed continental ivory *down* to grey on light grazers, so the guard now pushes on the mineral's side.

**Critique of round 2:**
- On silicon, nitride armour and the ice accent merge (accepted, §4).
- Silicon hard tints are near-neutral, so silicon's mineral signal is value only (accepted as honest).
- Remaining unknowns: the colours of silicide, nierite and enstatite, and the silicon ring's impurity rationale, are [unverified].

**Sources** (DOIs checked against Crossref on 2026-11-08):
- Warén, A. et al. (2003), "A hot-vent gastropod with iron sulfide dermal sclerites", *Science*, 10.1126/science.1087696
- Lowenstam, H. A. (1962), "Magnetite in denticle capping in recent chitons", *GSA Bulletin* 73:435, 10.1130/0016-7606(1962)73[435:MIDCIR]2.0.CO;2
- Barber, A. H., Lu, D. and Pugno, N. M. (2015), "Extreme strength observed in limpet teeth", *J. R. Soc. Interface*, 10.1098/rsif.2014.1326
- Gordon, L. M. et al. (2015), "Amorphous intergranular phases control the properties of rodent tooth enamel", *Science*, 10.1126/science.1258950
- Johnsen, S. (2005), "The red and the black: bioluminescence and the color of animals in the deep sea", *Integr. Comp. Biol.*, 10.1093/icb/45.2.234
- Cuthill, I. C. et al. (2016), "Optimizing countershading camouflage", *PNAS*, 10.1073/pnas.1611589113
- Prum, R. O. and Torres, R. H. (2003), "Structural colouration of avian skin", *J. Exp. Biol.*, 10.1242/jeb.00431
- Hill, G. E. (2002), *A Red Bird in a Brown Bag*, Oxford UP, 10.1093/acprof:oso/9780195148480.001.0001
- Already in `sources.ts`: keil1968 and lee1995, for mineral occurrence only, not colour.
- [unverified]: the colours of silicide, Si₃N₄ ceramic and enstatite; the doping colours of SiC; TiN gold; biogenic opal being white.
