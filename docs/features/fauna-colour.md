# Fauna colour reskin: chemistry sets the skin, the rock chip sets the armour, and every colour has a reason

> **Owner asks (Caden):**
> - "We want to do a colour reskin for the creatures, should it be informed also by the minerals in the world available + their life form base?"
> - "There are 5 chips: basalt, granite, ironstone, silicide and nitride, so for the recolours we can account for those."
> - "They can be different colours from these, right, but if the creature is this colour we can say why."
>
> **Answer.** Yes. The design is organised **per rock chip**: one hard-part (biomineral) family per mineral, five in all, plus the natural mix as a sixth case, on both worlds.
> - **Life-form base sets the skin.** Species keep their own ring colour, so the chips *influence* creatures and don't dictate them.
> - **The chip sets the armour.** Plates, horns, teeth, and silicon's ceramic tiles and shell take their tint from it.
> - **Every drawn colour has a cause.** A pure `colourReasons()` returns them, and the reason text lives in world config (§5, a contract proposal).
>
> Art layer only. Reads `VisualInputs`, writes nothing back. Code owner: art-fauna (`palette.ts`, `crustLook.ts`, `faunaLib/species.ts`, `faunaLib/adapter.ts`, `fauna.ts`, `sprite.ts`, `counterpart.ts`). Baseline: `session/art-layer` at `ded5b4c`. Every hex here was computed with that branch's `creatureColour` and `mineralFamily` (OKLab), not eyeballed.

**Facts this design rests on** (checked in code):
- **Chips.** `CRUST_PICKS` (`worlds/controls.ts`) is the same five chips on both worlds. Each world carries all five minerals; foreign ones have share [0, 0] unless picked. A pick takes `favour` 0.75 of the patch (`withCrustChoice`). Silicon also has `reducedLava` and `waterIce`, which have no chip and are background only.
- **Oxygen default.** The carbon Oxygen default is now **21%**. The rust ratchet (max O₂ seen ÷ `rustOxygen` 10%) is therefore at 1 from the first second unless the player starts low. On silicon oxygen is pinned at a trace, so rust is ≈ 0.
- **Sky and silicon look.** The sky is Rayleigh blue on both worlds, and silicon is cool grey, not violet (`66aec17`).
- **Glow.** The glow hue is OKLab ≈ 183°, and the 165–200° band stays reserved for it.

**Tags:**
- **[sci]**: sourced real science
- **[analogue]**: a real Earth case used by analogy
- **[speculative]**: the silicon world's own reasoning
- **[art]**: a look choice, stated as such
- **[unverified]**: recalled, not checked this session

---

## 1. Decision

| Layer | Verdict | Why |
|---|---|---|
| **Skin = chemistry (life-form base)** | **Keep the species ring as the skin. Fix the silicon ring.** The chip changes skin only through a readability guard on carbon (§3). | **Carbon ring:** carotenoid yellows and oranges, structural blues and violets [sci: Prum & Torres 2003], melanin-dark hunters. It's defensible as is.<br>**Silicon ring, current version:**<br>• It has an anchor at 185°, inside the glow band; 9 of 65 samples fall there.<br>• Its last anchor folds back, so two of the 9 hue candidates are ΔE 0.008 apart and two species can share a colour (#57).<br>**Fix:** a 7-anchor ring (§2.1), with 0 samples in the band and no purple. |
| **Armour = rock chip (biomineralisation)** | **Keep. This is the reskin.** | Real anchors:<br>• the scaly-foot snail's iron-sulphide sclerites [sci: Warén et al. 2003]<br>• chiton teeth capped in black magnetite [sci: Lowenstam 1962]<br>• limpet teeth of goethite [sci: Barber et al. 2015]<br>• orange iron-rich rodent enamel [sci: Gordon et al. 2015]<br>Soft = pigment (the species), hard = mineral (the ground). That maps onto the existing one body colour + one accent. |
| Armour source: **world's dominant mineral** (patch-wide shares, once per world) | **Base.** | Deterministic per (world, seed, chip). It needs no positions, so the sprite and the 3D view reproduce it exactly. |
| Armour source: per-species **home habitat** | **Refinement, P2.** | 1. Founders all start in the shallows, which sit on the lowest mineral, so home ≈ the same mineral for most species.<br>2. First-seen position depends on frame pacing.<br>3. The off-world sprite can't recompute it. |
| Oxidation state of the armour | **Keep, stamped per species at colouring** (carbon). | Reduced iron biominerals are black and oxidised ones are ochre or brown (same sources). At the 21% default every species is oxidised. Start a world at low O₂ and later species can differ from early ones. Old lineages keeping black armour is real: chitons make magnetite in today's oxygenated seas. |
| Diet uptake (carotenoids from plants) | **Cut.** | It pulls grazers toward one colour, which fights #57. It drifts with the flora ratchet. Carotenoids are carbon-only. The mechanism is real [sci: Hill 2002], but the cost is too high. |
| Background-matching skin (melanism on dark rock) | **Measured and rejected.** | Real [sci: Nachman et al. 2003, rock pocket mice dark on lava]. But it is camouflage: in the per-chip run it drove skin-to-ground ΔL down to 0.00 on carbon's silicide chip. It's the opposite of "creatures must read". |
| "Dim light → darker body", countershading | **No new rule.** | `lookPalette` already dims the scene. Silicon skins are already dark (L ≤ 0.50), which the deep-sea case supports [sci: Johnsen 2005]. Countershading flattens form under top light [sci: Cuthill et al. 2016], so it fights the cel shading. |

---

## 2. Per-chip palettes

### 2.1 Skin (soft tissue): chemistry family

- **Carbon:** `RING.carbon` is unchanged.
- **Silicon:** replace `RING.silicon` with these OKLCH anchors:
  `[0.52,0.12,78] gold · [0.50,0.11,108] olive · [0.50,0.12,140] green · [0.47,0.035,205] pewter · [0.47,0.12,232] steel blue · [0.43,0.15,258] deep blue · [0.38,0.06,262] gunmetal-blue`
  - Low-chroma pewter where the ring crosses cyan, which is carbon's own trick.
  - The world's first species (hue 0.5, ring position 0.4) is green `#406C48`, not muted.
- **The chip does not change hue.** It changes skin lightness only through the carbon readability guard in §3.

### 2.2 Armour: one family per mineral

There's one new role per mineral, `hard`, carried in `crustLook.ts` `Family`.

**Carbon life** builds armour **from** the rock's mineral.

**Silicon life** always builds **silicon-nitride** armour (CLAUDE.md: "plates are silicon-nitride ceramic"). The chip mineral **stains** it:
- `hardSi = labMix(porcelain #D2D7DC, carbonHard(mineral, rust), 0.6)`
- nitride is the porcelain itself

So the two chemistries never wear the same armour on the same chip.

| Chip | Carbon armour, 0% O₂ → 21%+ (`rust` 0 → 1) | Silicon armour (O₂ ≈ 0) | Why (carbon / silicon) | Tag |
|---|---|---|---|---|
| **Basalt** | `#2C3634` green-charcoal → `#5C3C2C` umber | `#6B7474` slate-stained porcelain | Fe(II)-rich rock; reduced iron biominerals are black [Warén 2003] and oxidise to brown / tiles stained by the basalt's iron | [sci] mech., [art] hex / [speculative] |
| **Granite** | `#E6DDCC` ivory | `#DDDAD2` pale porcelain | Silica-rich and pale; biogenic silica (opal) is white [unverified]. Say "pale mineral armour", **not shell**: calcium isn't modelled / tiles barely stained | [analogue] / [speculative] |
| **Ironstone** | `#1E1C22` magnetite black → `#B27C2C` goethite ochre | `#616268` iron-darkened porcelain | Chiton teeth are magnetite [Lowenstam 1962]; limpet teeth are goethite [Barber 2015]. **Ochre, not hematite red**, so it never vanishes on the red ground (hue 70° vs 30°) / iron stains the nitride dark [unverified] | [sci] / [speculative] |
| **Silicide** | `#5C6678` gunmetal → `#C9B48E` rust-stained silica | `#8B93A0` metal-grey porcelain | Fe–Si metal grains (occurrence: keil1968); oxygen turns them to silica plus iron oxide / nitride tiles flecked with silicide metal | [analogue] / [speculative] |
| **Nitride** | `#D2D7DC` pale grey-white | `#D0D5DA` porcelain | Si₃N₄ (nierite, lee1995) is a grey-white ceramic [unverified]. On carbon, glassy silica armour from weathered nitride [speculative] | [speculative] |
| *reducedLava* (silicon, no chip) | `#C2BDB4` | stain of `#C2BDB4` | Enstatite, near-white [unverified] | [speculative] |
| *waterIce* (silicon, no chip) | weight 0 | weight 0 | "It holds no silicon, so nothing grows on it" (config) | config |

**World armour per case** (what's drawn: squared-share blend, ice excluded, chip at favour 0.75):

| World | Natural | Basalt | Granite | Ironstone | Silicide | Nitride |
|---|---|---|---|---|---|---|
| Carbon, 21% O₂ (default) | `#8C6F59` | `#634332` | `#DED3C2` | `#B07B30` | `#C7B18C` | `#CFD3D7` |
| Carbon, started at 0% O₂ | `#5C605B` | `#323C39` | `#D9D2C2` | `#212025` | `#5C6677` | `#CDD2D7` |
| Silicon | `#AEB3BB` | `#6B7474` | `#DDDAD2` | `#616268` | `#8B93A0` | `#D0D5DA` |

**How a species gets its armour**, stamped once in `SpeciesBook.colour()`:

```
r       = quantise(crustRatchet level, {0, 0.5, 1})        // carbon; silicon ≈ 0
h       = labMix(worldHard(chemistry, crust, r), speciesAccent, 0.25)   // 25% of the species' accent: two species' armour still differ
guard   | L(h) − L(skin) | ≥ 0.14, pushed on the side the mineral already sits; hue never in (165°, 200°) at chroma ≥ 0.04
```

### 2.3 Chip id: derive or add a contract field?

**Recommendation: derive it now; propose the field as optional.**

- **Derive** `dominant = argmax(world.crust.shares)` and `picked = maxShare ≥ 0.65`. This is exact today, because the share bounds are disjoint:
  - natural maxima: carbon basalt 0.55, silicon silicide 0.40
  - picks: 0.75 ± 0.01
  - realised shares land inside their bounds (`createTerrain` bakes the thresholds)

  It needs no logic-lead work before the freeze. Add a test that asserts the gap holds for both worlds' configs.
- **Optional field:** `VisualInputs.world.crustPick?: CrustPickId`, passed straight from `world:selected.crust`. It's cleaner, because it survives a future change to `favour` or the share bounds. It costs one line in `buildVisualInputs` plus a types change, which needs Caden and the logic lead to agree.
- **Neither is needed for the colour itself.** The armour uses the continuous mix, so the chip id only picks the reason text (§5).

---

## 3. Species stay distinct under every chip

**What moves with the chip**
- the armour (`hard`)
- carbon skin lightness, only where the **readability guard** fires: |L(skin) − L(chip ground)| ≥ 0.10, pushed on the side the skin already sits. It's stamped per species and is the same for every member.

**What never moves**
- skin hue and ring position
- the accent
- the pattern
- the book's binning (`SETTLE`, `SEPARATE`, `KAPPA`)
- `colour()`'s farthest-hue search
- **Silicon skins aren't guarded.** The pale fresnel rim and the pale armour carry the silhouette. Guarding them on dark foreign chips collapsed species (ΔE 0.022 on basalt).

**Rules**
1. `hard` and the guard shift belong to the colourway, as `bands` and `spots` do. Wearer bins show the worn species' values.
2. Nothing depends on position, frame or camera. No per-cell colour: walking from basalt onto granite changes nothing.
3. The inputs are a pure function of (world, seed, chip) plus the deterministic oxygen history.

**Measured, 5 example species (§4) and the book's 9 grazer hue candidates, under every case:**

| World / case | Natural | Basalt | Granite | Ironstone | Silicide | Nitride |
|---|---|---|---|---|---|---|
| Carbon: min ΔE between the 5 skins | 0.077 | 0.077 | 0.076 | 0.077 | 0.076 | 0.077 |
| Carbon: min ΔE between adjacent hue candidates | 0.040 | 0.040 | 0.036 | 0.040 | 0.037 | 0.040 |
| Carbon: min skin-to-ground ΔL | 0.10 | 0.10 | 0.10 | 0.10 | 0.10 | 0.15 |
| Silicon: min ΔE between the 5 skins (unguarded) | 0.060 | 0.060 | 0.060 | 0.060 | 0.060 | 0.060 |
| Silicon: min skin-to-ground ΔL | 0.20 | **0.03** | 0.31 | **0.05** | **0.01** | 0.38 |
| Both: min |ΔL armour − skin| | 0.14 | 0.14 | 0.14 | 0.14 | 0.14 | 0.14 |

**Known weakness, flagged.** Silicon on dark ground (Basalt, Ironstone, and its own Silicide chip) puts dark skins on dark rock. The rim and the armour (ΔL ≥ 0.15 vs the skin) carry readability there. That's untested by eye, so check it in the owner's browser. The existing art-branch fix (pale `reducedLava` shore) helps only the natural mix.

**Determinism caveat (pre-existing).** Which bin becomes a colourway already depends on first-seen order in the renderer, and the armour inherits exactly that stability. The rust step is coarse (3 levels), so stamps differ only if a species is coloured within one frame of a step change.

---

## 4. Thumbnail palettes with reasons

Each cell is `skin / armour`. Accents don't change with the chip.

### Carbon, 21% O₂ (default)

| Species (diet, hue, accent) | Accent | Natural | Basalt | Granite | Ironstone | Silicide | Nitride |
|---|---|---|---|---|---|---|---|
| A periwinkle grazer (0.05, 0.5, 0.15) | `#314D71` | `#80A5D6`/`#766761` | `#80A5D6`/`#584744` | `#7CA0D1`/`#CACAC8` | `#80A5D6`/`#90714B` | `#6C90C0`/`#C0B8A8` | `#80A5D6`/`#C5D0DD` |
| B orchid grazer (0.1, 0.25, 0.5) | `#6C293F` | `#A994E7`/`#855E53` | `#A994E7`/`#663D36` | `#A38EE1`/`#DFC3BA` | `#A994E7`/`#9F6739` | `#937ECF`/`#D5B19A` | `#A994E7`/`#DCCBD2` |
| C pewter-sage grazer (0.15, 0.75, 0.85) | `#A15D14` | `#91B6AE`/`#926B4C` | `#91B6AE`/`#724A2E` | `#82A79F`/`#E0C5A9` | `#91B6AE`/`#AC742A` | `#B0D6CE`/`#BC9A6F` | `#91B6AE`/`#E6D6CA` |
| D olive-maize hunter (0.9, 0.625, 0.5) | `#E0D1B4` | `#6E611C`/`#A1876F` | `#8E7E25`/`#6B4F3B` | `#847417`/`#DFD3BF` | `#726521`/`#BC9055` | `#847417`/`#CDB996` | `#847417`/`#D3D3CE` |
| E dark-teal hunter (0.95, 0.125, 0.85) | `#D88225` | `#3C615E`/`#A27754` | `#284D4A`/`#8E6041` | `#3C615E`/`#DEBFA0` | `#3C615E`/`#BA7D2E` | `#3C615E`/`#CCA677` | `#3C615E`/`#D4C0B0` |

**Ironstone chip started at 0% O₂** (black iron):

| Species | Skin / armour |
|---|---|
| A | `#80A5D6`/`#262B37` |
| B | `#A994E7`/`#34242B` |
| C | `#91B6AE`/`#3F2F28` |
| D | `#94842C`/`#4B4745` |
| E | `#2E524F`/`#342218` |

### Silicon

Skins are the same under every chip: A `#406C48`, B `#626A15`, C `#1B637E`, D `#0C4868`, E `#325911`.

| Species (diet, hue, accent) | Accent | Natural | Basalt | Granite | Ironstone | Silicide | Nitride |
|---|---|---|---|---|---|---|---|
| A green grazer (0.05, 0.5, 0.15) | `#E4F0FC` | `#BBC2CB` | `#889194` | `#DFE0DC` | `#80838B` | `#A0A9B6` | `#D5DCE2` |
| B olive-gold grazer (0.1, 0.25, 0.5) | `#B9DCF6` | `#B1BDCA` | `#7E8D93` | `#D4DBDB` | `#78818B` | `#96A5B5` | `#CBD7E1` |
| C steel-blue grazer (0.15, 0.75, 0.85) | `#E1E4CC` | `#BABFBF` | `#878F89` | `#DEDDD1` | `#7F8180` | `#A0A7AB` | `#D4D9D7` |
| D deep-blue hunter (0.9, 0.625, 0.5) | `#B9DCF6` | `#B1BDCA` | `#7E8D93` | `#D4DBDB` | `#767F89` | `#96A5B5` | `#CBD7E1` |
| E moss hunter (0.95, 0.125, 0.85) | `#E1E4CC` | `#BABFBF` | `#878F89` | `#DEDDD1` | `#7F8180` | `#A0A7AB` | `#D4D9D7` |

Armour columns are hard-part hexes.

### Reasons for the drawn colours

What `colourReasons` returns, here for the **Ironstone** chip:

| Species | Skin reason | Armour reason | Other parts |
|---|---|---|---|
| A (carbon) | "Blue body: its species' own colour. On Earth, blues like this are structural, not pigment" [art + sci] | "Ochre plates: iron oxide (goethite) from the ironstone crust, like limpet teeth" [sci analogue] | "Dark eyes: melanin" [sci] |
| D (carbon) | "Olive-gold body: its species' own colour, a carotenoid-type yellow, drawn darker as a hunter" [art + sci] | same ochre reason | |
| D (carbon, Basalt chip) | Adds "drawn a shade lighter so it reads against the dark basalt" [art] | "Umber plates: rusted iron from the basalt" [sci analogue] | |
| A (silicon) | "Green body: its species' own colour; an impurity tint in silicon ceramic" [speculative, art] | "Dark grey tiles: silicon nitride stained by iron from the ironstone" [speculative] | "Cyan eye clusters: light organs; starlight here is about 1% of Earth's" [speculative] |
| E (silicon, Nitride chip) | as A | "Pale porcelain tiles: silicon nitride, the same mineral as the rock" [speculative] | Glow, if lit: "Cyan glow: a lure in the dark" |

---

## 5. Explainable colour: `colourReasons()`

### Function sketch

It's pure and deterministic, and it uses the same hex code path as `bake()`.

```ts
type ColourPart = 'skin' | 'pattern' | 'armour' | 'eyes' | 'glow';
type ColourCause =
  | 'speciesHue'                                   // the book's identity hue [art], always present for skin
  | 'pigment.carotenoid' | 'pigment.structural'    // carbon cover reason by skin OKLab hue: 50–105° carotenoid, 200–315° structural,
  | 'pigment.green' | 'pigment.pink' | 'pigment.melanin'   //   105–160° green, 315–50° pink, chroma < 0.06 melanin grey
  | 'ceramic.gold' | 'ceramic.green' | 'ceramic.blue' | 'ceramic.grey'   // silicon cover reason by hue [speculative]
  | 'hunterDark' | 'readability'                   // [art] value rules (diet slide; ground guard, only if it fired)
  | 'pattern'                                      // the species' pattern colour [art]
  | `mineral.${string}`                            // armour: the dominant mineral id (with .reduced / .oxidised on carbon)
  | 'eyeInk' | 'eyeGlow' | 'glowLure';
interface ColourReason { part: ColourPart; colour: number; cause: ColourCause; params?: Record<string, number>; tag: 'sci' | 'analogue' | 'speculative' | 'art' }

/** Exactly what is drawn: colours come from the same creaturePalette(look, silicon, diet) that bake() uses. */
declare function colourReasons(plan: BodyPlan, look: SpeciesLook, inputs: Pick<VisualInputs, 'world' | 'light'>): ColourReason[];
```

**Which parts appear**
- **skin** always: `speciesHue` plus one cover cause, plus `hunterDark` or `readability` when they apply
- **pattern** when `bands` or `spots` are present
- **armour** when `plateCover`, `shellCover`, `hornCount` or `jaw` is above 0. Its cause is `mineral.<dominant>.<state>`.
- **eyes**
- **glow** when `plan.glow > GLOW_MIN`, with `params.light` as a % of Earth's

**Honesty rule.** The skin's cover cause names a real pigment class that *could* make that colour. The text always leads with "its species' own colour", because the hue was chosen for distinctness, not by chemistry.

### Where it shows: the organism inspect card

At most two lines, under the body plan:

- Line 1 is the armour, which is the world-tied reason: *"Ochre plates: iron oxide from the ironstone crust, like limpet teeth."*
- Line 2 is the glow if the creature is lit, otherwise the skin: *"Blue body: its species' own colour; blues like this are structural on Earth."*
- A creature with no armour shows skin and eyes instead.

### Contract proposal (for the logic lead and Caden; not assumed)

CLAUDE.md puts explanatory text in world config, so the strings go there, and the art layer only chooses which ones apply.

```ts
interface MineralDef {   // + one optional field
  biomineral?: Sourced & { carbon: string; silicon: string };
  // e.g. ironstone.carbon: 'Iron oxide (goethite) from the ironstone, like limpet teeth' (sources: barber2015, lowenstam1962)
  //      ironstone.silicon: 'Silicon nitride stained by iron from the ironstone' (assumption: true)
  // carbon oxidising minerals get two variants: { carbonReduced, carbonOxidised } or a {state} placeholder
}
interface WorldConfig['life'] {   // + one optional map
  colourReasons?: Record<Exclude<ColourCause, `mineral.${string}`>, Sourced & { text: string }>;
  // e.g. 'pigment.structural': { text: 'blues like this are structural on Earth, not pigment', sources: ['prum2003'] }
  //      'readability': { text: 'drawn a shade {lighter|darker} so it reads against the ground', assumption: true }   // [art], declared
  //      'glowLure': { text: 'a lure in the dark: starlight here is {light}% of Earth\'s', sources: [] , assumption: true }
}
```

**New sources to add to `sources.ts`:** warén2003, lowenstam1962, barber2015, gordon2015, prum2003, johnsen2005 and hill2002.

**Until it lands:** the card shows no colour lines. Colours still render, and the reasons exist in tests. Don't hardcode the strings in `render/`.

---

## 6. Demo moments

1. **Same species, different armour.** Same seed, pick *Basalt*, then *Ironstone*, then *Granite*. The plated grazers keep their skins (A stays periwinkle `#80A5D6`) and swap armour: umber `#584744`, ochre `#90714B`, ivory `#CACAC8`.
   - Talk track: "Its skin is its chemistry; its armour is made of the ground, like the deep-sea snail that armours itself in iron."
2. **Black iron.** On the selection screen, drag Oxygen to 0, pick *Ironstone* and generate. The armour is magnetite black (`#262B37` on A). Push Oxygen up in the running world: species that get their colours after that wear ochre, and the old lineages stay black, as chitons do today. It's slider-driven, with no event.
3. **Silicon.** *Nitride* gives porcelain tiles; *Silicide* gives metal-grey ones on the same dark skins. The cyan glow is the only cyan on screen.
4. **Click and ask why.** The card says why the plates are ochre, and the reason holds up to a geologist.
5. **The bestiary matches the world.** The tile sprite, the turning 3D specimen (`bestiary:window`) and the card's live view all show the same hexes, because they share the `SEEN` record.

---

## 7. Implementation plan (art-fauna)

Estimate: about 220 lines including tests, roughly 2.5 hours.

| File | Change | Lines |
|---|---|---|
| `render/crustLook.ts` | `Family.hard` with the §2.2 hexes in every `MINERAL_LOOK` entry and in `NEUTRAL_FAMILY`.<br>`blendFamilies` routes `hard` through `fw` (squared × floraWeight), falling back to `rw` if every weight is 0.<br>`crustHard(inputs, rustStep, silicon)`, memoised; silicon stains porcelain at 0.6.<br>`dominantMineral(world.crust)` returns `{ id, picked }`. | ~40 |
| `render/palette.ts` | The new `RING.silicon`.<br>`creatureHard()` and `skinGuard()` (carbon only).<br>`creaturePalette(look, silicon, diet)` returns slot hexes, shared by `bake`, the sprite, the counterpart and `colourReasons`.<br>`creatureColour(..., hard?)`: tones 2 and 4 return the armour.<br>`WORLD_TONE` becomes `[0, 1, 2, 0, 2, 5, 5]`. | ~45 |
| `render/faunaLib/species.ts` | `SpeciesLook.hard` and `.skinShift`. `setWorld(hardHex, groundL)`. `colour()` stamps both. `lookOf` and wearers carry them. `SEEN_STRIDE += 2`; float32 holds 24-bit hex exactly. `FaunaLook.hard`. | ~30 |
| `render/faunaLib/adapter.ts` | `SLOT.hard = 5`, `SLOTS = 6`. `PLATE` (l.133), `plateSi` (l.203, not spots), `HORN` (l.170–171) and `hornSi` (l.137, 199) move to `SLOT.hard`. This also ends today's split, where plate beads wear the body and flap plates wear the accent. | ~8 |
| `render/fauna.ts` | `TONE_SLOT[2] = TONE_SLOT[4] = SLOT.hard`. `bake` uses `creaturePalette`. Each frame: `book.setWorld(...)`, memoised on the rust step. | ~10 |
| `render/sprite.ts`, `render/counterpart.ts` | Pass `look.hard` and the skin shift. Never-seen plans use the current world's values, or today's look if absent. | ~12 |
| `render/colourReasons.ts` (new, pure) | The §5 function. | ~40 |

**Tests** (`palette.test.ts`, `crustLook.test.ts`, `faunaLib.test.ts`). Per the owner's rules, run them once at the end with `npx vitest related --run <files>`. No browser or smoke runs.

1. **Every case, both chemistries** (6 cases × rust {0, 0.5, 1} × the `hues` grid × diets {0.05, 0.5, 0.95} × accents {0.15, 0.5, 0.85}):
   - |ΔL armour − skin| ≥ 0.14
   - nothing in the glow band at chroma ≥ 0.06
   - carbon |ΔL skin − ground| ≥ 0.10
2. **Distinctness under every chip:** min ΔE between the 9 hue candidates ≥ 0.03 on both rings, for every case. The silicon ring fails this today (0.008), so the test goes in red first.
3. **Stamp:** members of a bin get the same armour wherever they stand. A bin coloured at rust 0 keeps it after rust reaches 1, and a bin coloured afterwards gets the oxidised armour. Wearers show the worn bin's armour.
4. **Chip derivation:** in both world configs, the natural max share is below 0.65 and each pick's share is above it. `dominantMineral` gives the chip under `withCrustChoice` for every chip on both worlds. Water ice never tints.
5. **Reasons match pixels:** `colourReasons(...)[i].colour` equals the entry's slot hex for the same plan. Every cause has a config string once §5 lands (a config test).
6. **Sprite match:** after fauna draws a plan, `faunaLook(raw).hard` equals the entry's armour hex.
7. **Existing tests stay green** without edits: carbon skin, accent contrast, NaN safety and purity. The only exception is the silicon ring assertions that test 2 replaces.

**Order** (the freeze is 10:00):
1. The ring fix with test 2 (a #57 bug fix, allowed after the freeze).
2. The armour slot and per-chip families, with tests 1, 3, 4 and 6.
3. `colourReasons` and test 5.
4. The card lines, only once the config contract is agreed.

**Cut line:** step 1, then step 2.

**P2 (`docs/NOT_NOW.md`):**
- Home-habitat refinement, from the sim's `crustMap` cell, only if `births` ever carries a birth cell.
- Thin-film interference shimmer on nitride armour.

---

## 8. Iteration log (condensed)

**Round 1. Proposal:** the team lead's three layers. The armour follows each species' home habitat (argmax of crust weights at the founder); grazer accents pull toward the flora colour; dim light darkens bodies.

**Critique:**
- The home habitat depends on frame pacing and collapses to the shore mineral.
- The diet pull converges grazers.
- The dim-light rule double-counts `lookPalette`.
- The silicon ring is already broken: a glow-band anchor, and a ΔE 0.008 candidate pair.
- Plates are split across the body and accent slots.

**Round 2. Revision:**
- The world mix replaces the home habitat.
- Oxidation is stamped at colouring.
- Diet and light cut; countershading rejected.
- A 7-anchor silicon ring.
- `SLOT.hard`, with 25% of the species accent and a ΔL guard. Measured: the first guard pushed granite ivory down to grey, so it now pushes on the mineral's side.

**Round 3 (owner input: per chip, colours free but explainable):**
- The design is reorganised around the 5 chips, on both worlds. Every world carries every mineral, so silicon can pick basalt.
- Silicon armour is always nitride, stained by the chip, so the two chemistries never wear the same armour.
- I tried background-matching melanism for a per-chip skin and measured it. It cut skin-to-ground contrast to 0.00, so it's replaced by a readability guard (carbon only).
- A silicon guard collapsed species on dark grounds (ΔE 0.022), so silicon is unguarded and its dark-ground readability is flagged.
- Found: the Oxygen default of 21% means carbon armour is oxidised at defaults. The black-iron moment needs a 0% O₂ start.
- Added `colourReasons` and the config contract proposal.

**Still below bar:** silicon readability on the dark chips (Basalt, Ironstone, Silicide; skin-to-ground ΔL 0.01–0.05) has to be checked by eye. The mineral colours on the silicon side are [unverified].

**Sources.** DOIs checked against Crossref on 2026-11-08:
- Warén et al. 2003, *Science*, 10.1126/science.1087696
- Lowenstam 1962, *GSA Bull.*, 10.1130/0016-7606(1962)73[435:MIDCIR]2.0.CO;2
- Barber, Lu and Pugno 2015, *J. R. Soc. Interface*, 10.1098/rsif.2014.1326
- Gordon et al. 2015, *Science*, 10.1126/science.1258950
- Johnsen 2005, *Integr. Comp. Biol.*, 10.1093/icb/45.2.234
- Cuthill et al. 2016, *PNAS*, 10.1073/pnas.1611589113
- Prum and Torres 2003, *J. Exp. Biol.*, 10.1242/jeb.00431
- Nachman, Hoekstra and D'Agostino 2003, *PNAS*, 10.1073/pnas.0431157100
- Hill 2002, *A Red Bird in a Brown Bag*, Oxford UP
- Mineral occurrence only: keil1968 and lee1995 (already in `sources.ts`).

[unverified]: the colours of silicide, Si₃N₄ ceramic and enstatite; iron staining of nitride; SiC impurity colours; biogenic opal being white; the hue-to-pigment-class cover reasons beyond carotenoid and structural.
