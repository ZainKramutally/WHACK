# World forms: how the ground answers the controls (synthesis)

Question (README): how do rock structures, terrain, water, sky and ground change with each control (Recipe C·Si·O, Sea, Heat, Light, Hunger, Time), so that `mockups/worlds` produces geology that is chemically motivated, varied and readable?

Machine-readable matrix: [`data/response-matrix.json`](data/response-matrix.json) (23 control settings, 15 interactions, stain proposal, lava option, 3 decisions). Short version: [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md).

**Tags.** [sci] real science (simplified), [game] our world logic, [INFERRED] reasoned but unsourced. Source tags `[PEER]` `[REVIEW]` `[BOOK]` `[POP]` and status labels (**consensus**, **plausible/theorised**, **disputed**) are carried over from the notes. Method costs are [est] from notes/03.

---

## 1. Method

This is a synthesis pass. No new research was done. Inputs:

- `notes/01` + `data/landforms.json`: 20 Earth landforms, 34 sources.
- `notes/02` + `data/alien-geology.json`: 7 planetary analogues, 12 silica and life-built structures, 46 sources.
- `notes/03` + `data/methods.json`: 20 procedural methods, 5 pin gaps, a ranked add-next list. Partly read against code on 2026-11-07.
- Context: `docs/WORLD_ATLAS.md` (R1–R12, §5 controls, §5.3 pin settings), `docs/features/world-generator.md`, `docs/ART_DIRECTION.md`, `docs/ART_DIRECTION_PIXEL.md`.

How I built it: each control setting was traced to the machine(s) it drives (§2). The landforms come from those machines, the real or planetary analogue backs them, and notes/03 supplies the method that renders them. Where the notes disagreed with each other or with the docs, I judged the conflict and flagged it (§8). I also spot-checked `mockups/worlds/src/derive.ts` and `landforms/terrain.ts` to confirm two code facts: the stain table, and the heat→wall rule.

---

## 2. The machines: five that carve, one that builds

Every landform on the board comes from one of five abiotic machines, plus life. **Pick the machine first and the landform falls out.**

| # | Machine | What it does | Main control | Landforms |
|---|---|---|---|---|
| M1 | **Dissolve** | The sea eats soluble rock along cracks | Sea (+Heat, Time) | karst towers, caves, Titan labyrinth, acid pitting |
| M2 | **Precipitate** | Stone comes back out of the liquid when it degasses, cools, mixes or evaporates | Sea + a Heat gradient | sinter, travertine, tufa, speleothems, salt/sulfur crusts, varnish (disputed) |
| M3 | **Crack-and-pry** | Ice, salt or thermal contraction splits joints | Heat crossing a phase change | hoodoos, fins → arches, tafoni, polygons, columnar jointing |
| M4 | **Abrade** | Moving liquid, sand or waves grind rock, strongest at the ground or waterline | Sea (waves, floods) + dryness | slot canyons, sea stacks, mushroom rocks, dunes, rivers |
| M5 | **Stack-and-strip** | Lay layers down, lift them, cut down through them | Time (+Recipe/Sea for colour) | mesa → butte → spire, rainbow strata, canyon walls |
| M6 | **Life-built** | Life templates, builds or bores stone | Hunger + Light (+Recipe) | sinter mats, stromatolites, reefs, phytokarst pits, diatom honeycomb, R12 arches |

**One shape grammar.** A hard cap on soft rock gives a pedestal at three scales: mushroom rock, hoodoo, butte. Joints split rock into slabs, which become fins, then arches, then pillars. That reduces most pins to one parametric family: cap hardness × joint spacing × erosion depth `[INFERRED]`. Arches are self-selecting. Loaded grains lock together, so erosion carves *toward* arch shapes (Bruthans 2014 `[PEER]`, **consensus**).

**M6 is R12's real anchor.** Sinter grows on microbial filaments (Konhauser 2001). Borers and grazers make sponge-pitted phytokarst (Folk 1973). Diatoms and radiolarians build real silica honeycomb (Tréguer 2013). All three are **consensus**. Glowing pores are **[game]**.

---

## 3. Per-Sea world geology

| Sea | Analogue | Landforms that appear | What it cannot do | Stain / colour | Tag |
|---|---|---|---|---|---|
| **Water** | Earth; Mars (old, dried); Enceladus/Europa (cold) | The full set: frost-wedge hoodoos, fins, arches, karst, travertine, sinter, sea stacks, rivers, red beds | — | Iron red if O is high, green/grey if O is low | [sci] |
| **Ammonia** | Icy moons; Triton; alkaline Mono Lake | Cryolava domes and flows (Kargel 1992, **plausible**); tufa-like towers; silica dissolved and redeposited | **Frost wedging**: ammonia contracts when it freezes | Plum/violet is [game]; Triton pink is the nearest real colour | [INFERRED] chemistry, [game] colour |
| **Methane** | Titan | Organic dunes (Lorenz 2006), labyrinth and organic karst (Malaska 2020, Cornet 2015, **plausible**), calm lakes, dendritic rivers, rounded ice cobbles (Tomasko 2005), contraction polygons | Silicate dissolution (R5 spares silicon); wave-cut stacks (calm seas); frost wedging | **Light-gated**: bright gives tholin orange, dim gives pale frost (Hörst 2017) | [sci] Titan; silicate bedrock is [game] |
| **Acid** | Venus *cloud deck* (~300–350 K at 50–55 km); Dallol acid brines | Sulfur-yellow crusts, rough pitting, fast karst of any carbonate, porous silica spires (R5) | Travertine, tufa, carbonate reefs | Sulfur yellow when fresh → tan/orange with age [INFERRED] | [sci] analogue. **Venus has acid clouds, not seas** |
| *(Lava)* | 55 Cnc e (Demory 2016, **plausible**); Venus surface; Giant's Causeway | Magma lakes, columnar jointing on cooling, lava tubes and bridges, obsidian, pancake domes (Pavri 1992) | Every solvent landform; all life | Incandescent orange; black glass | See §6 decision b |

**Recommendation (decision b): Lava is the Heat extreme, not a fifth sea.** Lava is the Recipe melted: Si+O at the far end of Heat. A Lava swatch would make "Lava at cold Heat" a reachable nonsense state, so Sea and Heat would stop being independent. It would also break the four-swatch Sea UI and ART_DIRECTION's sea table. As a Heat extreme it costs no UI. It also gives the Venus surface a home and adds a payoff as you pull Heat back down: hexagonal columns crack out as the melt cools.

---

## 4. Per-control effects (the matrix)

↑ grows · ↓ erodes or vanishes. Methods use notes/03 names; **L** = morphs live, **B** = debounced re-bake (most have a live fake).

| Control | Setting | Appears / grows ↑ | Erodes / vanishes ↓ | Colours | Machines | Analogue | Tag | Render (live?, effort) |
|---|---|---|---|---|---|---|---|---|
| Recipe | **C corner** | Soft living towers, haze. With Water+life: carbonate reefs (decision a). With Methane+Light: organic dunes and karst | Permanent stone in other seas | Coral; char black when hot+bright+old | M6 (+M2) | Coral, Shark Bay; Titan dunes | [sci] R2 + carbonate exception | lathe L·S; tufa B·M |
| Recipe | **Si corner** | Glassy life, glass sand | Rust stains (little O) | Bone → clear | M4, M6 | Quartz dune seas | [game] | dunes L·S |
| Recipe | **O corner** | Rust rims, red beds, varnish | Green/grey strata | Hematite red, goethite yellow, Mn black | M2, M5 | Red beds; varnish | [sci] oxidation | strata L·S; epochs L·S |
| Recipe | **Si+O** | Fins, arches, spires, slot canyons, sinter, columns, chert/jasper, glass-sponge and diatom honeycomb | Carbonate forms | Bone → sea stain; jasper red | M2–M6 | Arches NP; El Tatio; BIF; BC sponge reefs | [sci] rock types | tube arch L·S; fin arch B·M; tafoni L·S; rimstone B·M |
| Recipe | **C+O** | Gas by default. With Water+life: limestone family (reefs, travertine, tufa, karst) | Silica forms | Cream carbonate | M1, M2, M6 | Guilin; Mono Lake; Lost City | [sci] / [game] gate | karst L·S; tufa B·M |
| Recipe | **C+Si** | Si stone stacks with carbon caps | — | Bone stacks, coral caps | M4, M6 | Silicified stromatolites | [game] split | lathe L·S |
| Recipe | **Centre** | Every machine at moderate rate; most variety | — | Patchwork (R9) | all | Earth | [game] | lathe, strata |
| Heat | **Low** (always frozen) | Polygons, drifts, giant slow forms (R6) | Liquids; freeze-thaw (it never thaws) | Pale, little stain | M3 contraction | Titan, Triton, permafrost | [sci] | polygons L·S; thermal L·S |
| Heat | **Mid** (crosses freezing) | Hoodoos, fins → arches (**Water only**), sorted circles, life peak | Fins along joints | Bryce reds, pinks, purples | M3, M1, M6 | Bryce; Arches NP | [sci] | strata L·S; fin arch B·M |
| Heat | **High** (hot, dry) | Tafoni, dunes, mushroom rocks, salt flats, varnish, red beds; **steeper** walls; talus | Freeze-thaw forms; most life | Red, orange, black, white salt, pink brine | M2–M5 | Colorado Plateau; salars | [sci]; hot Mars is [game] | dunes L·S; thermal L·S; strata L·S |
| Heat | **Volcanic gradient** | Sinter (Si+O), travertine (C+O), columns, tuff chimneys; terraces grow mm–cm/yr | — | Temperature-banded mats: green, yellow, orange; opal white | M2, M3, M6 | Grand Prismatic; Mammoth | [sci] | rimstone B·M; columns L·S |
| Light | **Low** | Caves/speleothem mood, glowing pores, tall stalks | Photosynthetic boring; tholin | Pale Methane; amber pores | M6 (dark) | Lost City pores (no glow) | [game] glow | tafoni L·S |
| Light | **High** | Phytokarst, mat colours, caps (R7), tholin orange in Methane, varnish (if microbial) | Glow | Orange tholin; black phytokarst | M6, photochemistry | Cayman phytokarst; Titan haze | [sci] via life/photolysis | tafoni L·S; rimstone B·M |
| Time | **Young** | Chemical-garden tubes (seconds), fresh sinter and tufa, fresh columns | Deep stain, karst, buttes | Bone white (R3) | M2, M3 | Silicate gardens | [sci] | tufa B·M; columns L·S |
| Time | **Mid** | Hoodoos, fins, arches, sea arch → stack | — | Partial bands | M3, M4 | Bryce; Twelve Apostles `[POP]` | [sci] | fin arch; lathe L·S |
| Time | **Old** | Karst towers, mesa → butte → spire, banded strata, deep varnish, red dunes, lone pillars, stack stumps, living-arch rings | Arches past peak; stacks → stumps | Full stain; varnish black; rainbow bands | M1, M5, M2, M6 | Zhangye; Mars layers | [sci] timescales | strata, epochs L·S; pipe B·L; thermal L·S |
| Hunger | **Low** | Undisturbed mats → stromatolites and reefs | Bioerosion | Mat colours | M6 build | Shark Bay | [sci] analogue | lathe L·S |
| Hunger | **High** | Rasped and bored rock, grazer sand | Mats, stromatolites | Darker pits | M6 bore | Phytokarst grazers | [sci] analogue | tafoni L·S |

Hunger has no dial in the generator yet (world-generator.md scope), so the Hunger rows are spec only.

---

## 5. Interaction surprises (the "…but then" layer)

These are the rules where two controls together give something neither gives alone. They are the best material for the atlas's "you'd predict… but then" column.

| # | When | Result | Otherwise | Why | Tag |
|---|---|---|---|---|---|
| X1 | **Water** + Heat crossing freezing | Frost-wedge hoodoos and fins → arches | Methane/Ammonia at the same Heat: **no hoodoos**, only contraction polygons | Water expands ~9% when it freezes; methane and ammonia contract | [sci] water; [INFERRED] non-transfer |
| X2 | **Methane + bright** | Orange tholin stain, organic dunes | Methane + dim: pale frost | Tholins are made from methane by UV | [sci] Hörst 2017 |
| X3 | Water + **O high** | Red beds | Water + O low: green/grey strata | Iron's oxidation state sets layer colour | [sci] |
| X4 | **Acid + C** | No lasting carbonate, fast karst, sulfur crust | Acid + Si+O: silica survives and builders thrive (R5) | Acid dissolves carbonate; silica resists it | [sci] carbonate; [INFERRED] silica residue |
| X5 | Si+O + Water + **hot source over cool surface** (+Light for mats) | Sinter terraces with temperature-banded colours | — | Silica dissolves hot and precipitates as it cools | [sci] **consensus** |
| X6 | **Old + Hot + Si+O + liquid history** | Deep, steep, banded canyon (M5 + M4 floods) | No incision: open plain with relic spires (eco-01) | Time deepens, dryness keeps walls steep, layers band | [sci] mechanism, [game] rule |
| X7 | **C + Methane + Light** | Carbon *does* build land: organic dunes and karst | — | In a hydrocarbon sea, photochemical organics are the sediment | [sci] Titan |
| X8 | C + **Water + life** + low Hunger | Carbonate reefs, stromatolites, tufa | — | Life and water lock C+O into shell | [sci], gated by decision a |
| X9 | Life + bright + Hunger | Bio-pitted honeycomb (phytokarst) | — | Photosynthetic borers + grazers | [sci] Folk 1973 |
| X10 | Builders + dark | Glowing pores | — | R8 | [game] glow, [sci] shape |
| X11 | **Heat max + Si+O** (+Water to quench) | Lava, then columnar jointing; faster quench gives thinner columns | — | Contraction cracks order into hexagons | [sci] Goehring 2009 |
| X12 | Sea changed mid-game + Time | Striped cliffs recording each era | — | Each era lays a band in its sea's stain | [game] on a [sci] basis |
| X13 | Very old + any sea | Dark old stone (varnish-like) | — | Needed for eco-15: dim-methane stain is pale | [game]; varnish origin **disputed** |
| X14 | Liquid + wind + Time | Cave → arch → stack → stump | Calm Methane: few stacks | Waves exploit joints | [sci]; Titan calm [INFERRED] |
| X15 | Life high | Dunes vanish | — | Life pins sand | [sci] |

**Correction to the brief.** "Acid + Si → sinter terraces" is not supported by the notes. Sinter needs a **heat gradient in near-neutral water** (X5, El Tatio, Yellowstone). Acid + Si gives a silica residue under a sulfur-yellow crust (Dallol-like) [INFERRED]. Either drop the claim or tag it [game].

---

## 6. Decisions the team must make (options + recommendation)

**(a) Should C+O make lasting stone in water worlds?**
- *Option 1, keep R2 strict.* eco-03's pillars are living tissue, which the atlas text already says ("its towers are living tissue"). Build them as a living-stack flora. Cheapest, and R2 stays clean.
- *Option 2, an R2 exception.* "Carbon rusts to air, **unless life in water turns it into shell**." Add `reefs = life·water·smoothstep(.4,.7,c)` [game], dissolved by Acid (X4). This is real (limestone, coral, stromatolites, tufa, Lost City). It fixes eco-03 and eco-06 and adds a "…but then".
- *Option 3.* Pillars are stone built by minority-Si builders. This fits the current formula but contradicts "C heavy".
- **Recommend option 2**, scoped to Water + life. A geologist judge would challenge "C+O only makes gas", and the exception is itself a readable rule. Caveat for the slide: real carbonate needs calcium or magnesium, which the Recipe does not model, so say "shell", not "chemistry".

**(b) Lava: fifth Sea or Heat extreme?** Recommend the **Heat extreme** (§3).

**(c) Is the eco-01/eco-10 canyon a rule outcome or preset framing?** Their dials are nearly identical (Si+O, Water, Hot, Bright, Old).
- *Option 1, preset framing only* (`valleyWidth`).
- *Option 2, a rule:* `canyonDepth ∝ age·liquidHistory`, steepness ∝ heat. This needs sediment-epoch state.
- *Option 3, hybrid.*
- **Recommend the hybrid.** Use framing for the demo, but **fix the inverted rule now**. `terrain.ts:66` multiplies `wallH` by `mix(1, 0.3, hot)`, so heat *lowers* walls, which fights eco-10. Real dry heat keeps walls steep. Add liquid history when sediment epochs land.

---

## 7. Pin by pin: how each atlas ecosystem's landforms arise

Settings are from WORLD_ATLAS §5.3. "Blocks" lists generator gaps from notes/03 and this synthesis.

| Pin | Settings | Landforms → machine → rule | Analogue | Blocks (effort) |
|---|---|---|---|---|
| **eco-01** Vermilion Eclipse | Si+O · Water · Hot · Bright · Fierce · Old | Flat plain + thin relic spires: the end of mesa → butte → spire (M5) plus R12 colonies; red from X3 | Colorado Plateau, Mars | Built. Optional: strata bands on spires (S) |
| **eco-02** Violet Sun Hollow | Si+O · Acid · Warm · Bright · Medium · Mid | Cratered rock = acid pitting (M1) + **grazer bioerosion** (X9, the beetles!) | Phytokarst; Dallol crust | No preset; nested multi-scale tafoni pits; sulfur stain (S) |
| **eco-03** Sindha pillars | C · Water · Mild · Bright · Gentle · Mid | Stacked pillars = life-built (M6), carbonate if decision a (X8) | Stromatolites, coral, tiered stacks | **builders≈0 for C**; no sea plane; tiered lathe; top-down camera (M) |
| **eco-04** Frost Arches | Si+O · Methane · Cold · Dim · Gentle · Old | Arches are **builder-made, not frost-made** (X1: methane can't wedge); they survive because methane dissolves nothing (R5); pale stone (X2 dim) | Titan karst bridges [INFERRED] | Built; terrain shape is baked (M, GPU heightfield) |
| **eco-05** Parasol Giants | C · Methane · Cold · Bright · Gentle · Old | Organic plains and dunes (X7); orange tholin stain (X2) | Titan | **Stain ignores Light**: methane stain is slate in code (S) |
| **eco-06** Capped Sea Stacks | C+Si · Water · Mild · Bright · Gentle · Mid | Sea arch → stack at mid Time (M4, X14); Si stacks + carbon caps | Twelve Apostles | Sea plane; tiered lathe with waterline notch; waterfalls (M) |
| **eco-07** Two Suns Spire | Centre · Water · Mild · Bright · Low · Old | Fluted totem spire = hoodoo profile from hard/soft bands (M3+M5) + R12 colony; pink stain from O-life [game] | Bryce, Cappadocia | Strata/flute lathe; life-sourced stain (S–M) |
| **eco-08** Coral Forest | C · Methane · Cold · Medium · Gentle · Old | Frosted rolling ground; contraction polygons (M3) | Titan, permafrost | Patterned ground (S, optional) |
| **eco-09** Violet Hunter | Si+O · Ammonia · Cool · Dim · Fierce · Mid | Mostly flora; honeycomb caps echo diatoms (M6); Hunger → pitted surfaces [game] | Radiolarians | No Hunger dial; ammonia anchor (S) |
| **eco-10** Red Canyon | Si+O · Water · Hot · Bright · Low · Very old | Steep banded canyon (X6: M5 + M4 + talus M3); full iron stain | Colorado Plateau, Zhangye, BIF, Mars layers | **Inverted heat→wall rule**; strata; talus; streambed; parasol tower; sky anchor; preset (M) |
| **eco-11** Kelp Shoal | C · Water · Mild · Medium · Medium · Mid | A lone rock; nearly no landform | — | Sea/haze only (S) |
| **eco-12** Glow Garden | Si-leaning · Water · Mild · Very dim · Gentle · Mid | Enclosed grove, cave mood (R8 dark pairing) | Speleothem caves | Built |
| **eco-13** Living Arch | Si+O · Ammonia · Cool · Medium · Gentle · Very old | The arch *is* life (M6); rust rings = one stain band per era (X12) | Stromatolite laminae, BIF stripes | Arch rings, crystals, on-arch flora, ammonia anchor, preset (M) |
| **eco-14** Bone Reef | Si+O · Acid · Warm · Dim · Low · Old | Porous spires = builders (M6) + acid pitting (M1); silica survives acid (X4); glow (X10) | Lost City, diatoms, phytokarst | Built. Upgrade: nested pits (S) |
| **eco-15** Lantern River | O+Si · Methane · Cold · Dim · Gentle · Old | Builder arches persist (R5); methane-rain river channel (M4); **dark arches need age darkening** (X13) | Titan rivers | **No liquid**, no channel carve; dark stain; white river is [game] (S) |

**What the pass shows.** Five pins are already reachable (01, 04, 12, 14, plus 11 needing little). Four more open up from three S-effort items: the liquid surface, stain v2 and strata. The remaining pins need M-effort packs. Only eco-03 depends on a rule decision (a).

---

## 8. Conflicts found while reconciling

| Topic | Atlas | Generator spec | Code (`derive.ts`) | Judgment |
|---|---|---|---|---|
| Methane stain | `#AD603B` tholin orange (§6) | `#C3C4D4` barely stains | `0x6a95b3` blue-slate | All three are half right. **Make it Light-gated** (X2): slate when dim, tholin when bright |
| Acid stain | `#E2CF95` sulfur (R3, §6) | `#A47C68` tan | `0xa47c68` tan | Sulfur when young → tan when old [INFERRED]; pixel ramp already spans both |
| Water stain | rust | `#F94B1E` | same | Gate by Recipe O (X3); low O gives green/grey |
| Terrain | — | "GPU-displaced plane" | CPU bake | Spec drift (notes/03); terrain shape does not morph |
| Builders | R2: Si **and** O | `smoothstep(.45,.8,si+o)·age` | same | The pure-Si corner gets full builders; consider weighting by O (open question) |
| eco-15 dark arches | "very old stone stained dark" | — | dim methane stain is pale | Needs an age-darkening term (X13) |

---

## 9. Recommended generator additions, ranked by impact ÷ effort

This re-ranks notes/03 §5 with the geology rules folded in. Items 2 and 4 are new from this synthesis.

| Rank | Addition | Unlocks | Effort | Live? |
|---|---|---|---|---|
| 1 | **Liquid surface**: sea plane + river ribbon, depth tint, foam, caustics | eco-15, 03, 06, 11 | S | yes |
| 2 | **Stain v2** `stain(sea, light, o, age)`: tholin by Light, red/green by O, sulfur → tan, varnish darkening | eco-05, 15, 01/10 colour honesty; reconciles three docs | S | yes (uniforms) |
| 3 | **Strata bands + hardness terracing** (epoch palette) | eco-10, 03, 13, 07 | S | yes |
| 4 | **Geology terms in `derive.ts`** with Tier 0 tests: `liquid(sea,heat)`, `frostWedge = water·bump(heat)`, `dissolve(sea,recipe)`, `reefs`, `canyon`; **flip heat→wall** | eco-10, 03; makes X1/X4/X6 testable | S | yes |
| 5 | GPU heightfield (terrain morphs) | all, core promise | M | yes |
| 6 | eco-10 pack: canyon term, talus, parasol tower, preset | eco-10 | M | mostly |
| 7 | eco-03 pack: tiered lathe, reefs, preset (after decision a) | eco-03, 06, 07 | M | yes |
| 8 | eco-13 pack: arch rings, crystals, on-arch flora | eco-13, 15 | M | yes |
| 9 | Thermal erosion compute (talus) | realism | S after 5 | yes |
| 10 | Analytic dunes, polygons, **columnar jointing** (the Heat-extreme readout) | Lava end, eco-08 | S | yes |
| 11 | Pipe-model hydraulic erosion (iterations = age) | best canyon | L | re-bake |
| 12 | Growth sims (Werner, rimstone, tufa/DLA) | off-board worlds | M | re-bake |

---

## 10. Open questions

1. **Ammonia + silica.** Silica solubility rising at high pH is consensus, but whether cold liquid ammonia behaves like alkaline water is not established. Keep this off slides until a chemistry check.
2. **Is Heat relative to each sea?** "Crossing freezing" (X1) only makes sense if Heat 0.5 means "liquid band of this sea". The atlas implies it does. The spec should say so.
3. **Builders at the Si corner without O** (§8): fix it, or accept it as [game]?
4. **Time scrubbing backwards** with simulated erosion: keyframe caches, or analytic-only below some age? (notes/03)
5. **Hunger** is absent from the generator. Do the M6 bore/build rows wait for fauna?
6. **eco-07 pink stain** comes from life, not sea. Should stain take a life term, or is that a preset tint?
7. Unsourced in this pass: slot-canyon primary paper, Kansas concretion caps, collapse dates for the Twelve Apostles and London Arch, glass-sponge growth rates (`[POP]`), and grazer exclusion at Shark Bay.

---

## 11. Consolidated references

Full lists with DOIs are in `data/landforms.json` (S1–S34) and `data/alien-geology.json` (46 keys). These are the ones cited above.

**Earth landforms.** Bruthans et al. 2014 *Nat. Geosci.* 10.1038/ngeo2209 · NPS Arches (S2) and Bryce (S3) `[POP]` · Mustoe 1982 10.1130/0016-7606(1982)93<108:TOOHW>2.0.CO;2 · Rodriguez-Navarro 1999 10.1130/0016-7606(1999)111<1250:OOHWTR>2.3.CO;2 · Folk 1973 10.1130/0016-7606(1973)84<2351:BPFHCI>2.0.CO;2 · Sunamura 1992 / Trenhaile 2010 10.1016/j.geomorph.2009.02.003 · Hammer 2007 10.1016/j.epsl.2007.01.033 · Konhauser 2001 10.1046/j.1365-3091.2001.00372.x · Council & Bennett 1993 10.1130/0091-7613(1993)021<0971:GOIFAM>2.3.CO;2 · Ford & Williams 2007 10.1002/9781118684986 · Goehring 2009 *PNAS* 10.1073/pnas.0805132106 · Wasson & Hyde 1983 10.1038/304337a0 · Kessler & Werner 2003 10.1126/science.1077309 · Lachenbruch 1962 10.1130/SPE70-p1 · Dorn & Oberlander 1981 10.1126/science.213.4513.1245 · Liu & Broecker 2000 10.1130/0091-7613(2000)028<0183:HFDRVG>2.3.CO;2 · Lingappa 2021 10.1073/pnas.2025188118 · Peng 2020 10.1007/978-981-13-5959-0_1 · Lasser 2023 10.1103/PhysRevX.13.011025.

**Planetary.** Stofan 2007 10.1038/nature05438 · Tomasko 2005 10.1038/nature04126 · Lorenz 2006 10.1126/science.1123257 · Malaska 2020 10.1016/j.icarus.2020.113764 · Cornet 2015 10.1002/2014JE004738 · Hörst 2017 10.1002/2016JE005240 · Pavri 1992 10.1029/92JE01162 · Schaefer & Fegley 2004 10.1016/j.icarus.2003.11.023 · Kargel 1992 10.1016/0019-1035(92)90118-Q · Soderblom 1990 10.1126/science.250.4979.410 · Hsu 2015 10.1038/nature14262 · Malin & Edgett 2000 10.1126/science.290.5498.1927 · Ruff & Farmer 2016 10.1038/ncomms13554 · Demory 2016 10.1038/nature17169.

**Silica and life-built.** Campbell 2015 10.1016/j.earscirev.2015.05.009 · Nicolau 2014 10.1016/j.jvolgeores.2014.06.012 · Konhauser 2017 10.1016/j.earscirev.2017.06.012 · Tréguer & De La Rocha 2013 10.1146/annurev-marine-121211-172346 · Krautter 2001 10.1007/BF02668178 · Maldonado 1999 10.1038/44560 · Suosaari 2016 10.1038/srep20557 · Allwood 2006 10.1038/nature04764 · Barge 2015 10.1021/acs.chemrev.5b00014 · García-Ruiz 2003 10.1126/science.1090163 · Kelley 2005 10.1126/science.1102556.

**Methods** (notes/03). Mei, Decaudin & Hu 2007 10.1109/PG.2007.15 · Musgrave, Kolb & Mace 1989 10.1145/74334.74337 · Werner 1995 10.1130/0091-7613(1995)023<1107:EDCSAA>2.3.CO;2 · Veysey & Goldenfeld 2008 10.1038/nphys911 · Cordonnier 2016 10.1111/cgf.12820 · Paris 2019 10.1111/cgf.13815.
