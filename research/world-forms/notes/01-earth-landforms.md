# 01 · Earth landforms: what builds them, and which variable drives them

Axis: for each landform family on the mood board, the real A → B mechanism, the driving variables, timescales, colour sources, and how our controls (Recipe C·Si·O, Sea, Heat, Light, Time, Hunger; `docs/WORLD_ATLAS.md` §5) would push a world toward or away from it.

Data: `../data/landforms.json` (20 landforms, 34 sources, Wikimedia image links with licences).
Tags: `[PEER]` `[REVIEW]` `[BOOK]` `[POP]` `[INFERRED]`. Status: **consensus** · **plausible/theorised** · **disputed**. Control mappings are **[game]** extrapolation unless marked [sci].
Method: DOIs checked against Crossref, NPS pages fetched, image licences read from the Wikimedia Commons API. This was a 12-minute pass, so the timescale figures are order-of-magnitude.

---

## 1. Only five machines build every landform

Most mood-board landforms come from a handful of mechanisms. This is the most useful finding for the generator: **pick the machine first, then the landform falls out.**

| Machine | What it does | Main control | Landforms |
|---|---|---|---|
| **M1 Dissolve** | The sea eats soluble rock along cracks | **Sea** (+ Heat, Time) | karst towers, caves, hoodoo rounding, phytokarst |
| **M2 Precipitate** | Dissolved stone comes back out when water degasses, cools, mixes or evaporates | **Sea + Heat gradient** | travertine, sinter, tufa towers, speleothems, salt flats, varnish |
| **M3 Crack-and-pry** | Freeze-thaw, salt crystals or thermal contraction split rock along joints | **Heat** (crossing a phase change) | hoodoos, fins → arches, tafoni, patterned ground, columnar jointing |
| **M4 Abrade** | Moving water/sand/waves grind rock away, strongest near the ground or waterline | **Sea** (waves, floods) + dryness | slot canyons, sea stacks, mushroom rocks, dunes |
| **M5 Stack-and-strip** | Lay layers down, lift them up, erode down through them | **Time** (+ Recipe for layer colour) | mesas → buttes → spires, rainbow strata, fairy chimneys |

The **shape grammar is shared**. A hard cap over soft rock gives a pedestal at three scales: mushroom rock, hoodoo, butte. Joints set into thin slabs give fins, then arches, then pillars. That gives one parametric family (cap hardness × joint spacing × erosion depth) that can produce several mood-board pins. `[INFERRED]`

**Life machine (M6, Hunger/Light).** On Earth, life builds or sculpts rock in four ways. Borers and grazers make sponge-like pitted rock (phytokarst) and parrotfish make sand. Microbial mats template travertine and sinter. Cyanobacteria may drive manganese varnish. Mats also colour hot springs. `[PEER]` S8, S15, S29. This is the real-science anchor for R12 ("builders make arches").

---

## 2. Summary table

Abbreviations: ↑ = pushes toward, ↓ = pushes away. Hu = Hunger. Mapping column = [game] unless marked.

| Landform | Mechanism (short) | Main driver | Timescale | Colour source | Recipe | Sea | Heat | Light | Time | Hu | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Natural arch | salt dome → joints → fins → hole; stress locks grains, so the shape self-stabilises (S1) | M3 freeze-thaw + stress feedback | fins 10⁵–10⁶ yr | hematite red; bleach white; varnish black | Si+O ↑ | Water ↑, Acid ↑, Methane ↓ | freeze-crossing ↑ | – | mid-old ↑ | – | consensus |
| Hoodoo / spire | fins → frost wedging → columns; rain dissolves CaCO₃ cement (S3) | M3 frost (+M1) | >170 freeze-thaw nights/yr at Bryce | hematite red/pink, limonite orange, Mn purple | C+O or layered Si+O | Water ↑↑ | straddle freezing ↑ | – | mid ↑ | – | consensus |
| Fairy chimney | soft tuff under a hard cap; rain cuts cones | M4/M5 rain + cap | 10⁴–10⁵ yr | cream ash, pink bands | Si+O ↑ | Water ↑ | hot (ash) then mild | – | mid | – | consensus |
| Tafoni / honeycomb | salt crystallises in hollows; wind speeds evaporation; positive feedback (S6, S7) | M3 salt + wind | decades–centuries | host rock + Fe-crust rims | Si+O ↑, O ↑ rims | Water/Acid ↑, Methane ↓ | warm wet-dry ↑ | weak | young-mid | [game] R12 glow | plausible |
| Bio-pitted (phytokarst) | microbes bore, grazers rasp (S8) | M6 life | centuries | black microbes | C+O (soluble) | Water/Acid ↑ | warm ↑ | bright ↑ [sci] | mid-old | **↑↑ [sci]** | consensus |
| Slot canyon | flash floods abrade one joint in massive sandstone | M4 floods | 10⁴–10⁶ yr | Fe-coated grains | Si+O ↑ | Water/Acid ↑ | hot-dry ↑ | – | mid-old | – | consensus |
| Mesa → butte → spire | caprock undercut, cliff retreats | M5 uplift + time | 10⁶–10⁷ yr | red beds, varnish | Si+O, O→red | flowing sea ↑ | arid ↑ | – | **the clock** | – | consensus |
| Sea arch → stack | waves exploit joints in a headland: cave → arch → stack → stump | M4 waves | cm/yr retreat; collapses observed | host rock | any (carbonate fastest) | any wavy sea ↑; methane calm ↓ | liquid needed | – | young cliff → old stump | weak ↑ | consensus |
| Travertine terraces | CO₂ degasses, calcite grows fastest at rims, rims become dams (S12) | M2 degassing | mm–cm/yr | white + mat colours | C+O ↑ | Water ↑, Acid ↓ | warm ↑ | weak | young | – | consensus |
| **Silica sinter** | hot fluid cools/evaporates, opal-A precipitates on microbes (S15, S16) | M2 cooling | ~mm/yr | opal white + mat yellow/orange/green | **Si+O ↑↑ [sci]** | Water ↑; Ammonia ↑ [INFERRED] | hot source + cool surface | mats ↑ | young | – | consensus |
| Tufa tower | Ca-spring water mixes with carbonate lake; lake drops (S17) | M2 mixing | decades–centuries | cream calcite | C+O (Si variant [game]) | alkaline ↑ (Ammonia fit), Acid ↓ | cool-mild | weak | mid + drawdown | – | consensus |
| Karst towers | CO₂-water dissolves joints → cones → towers (S19, S20) | M1 dissolve | 10⁶–10⁷ yr | grey + green caps | C+O ↑ | **Acid ↑↑**, Water ↑ | warm-wet ↑ | indirect | old ↑ | indirect ↑ | consensus |
| Speleothems | dripwater degasses in a cave | M2 degassing | 0.01–1 mm/yr | white, Fe orange, humic tan | C+O | Water ↑ | mild | dark (R8 pairing) | old | – | consensus |
| Columnar jointing | cooling lava contracts; cracks order into hexagons; faster cooling gives thinner columns (S21) | M3 thermal contraction | forms in years | black basalt | **Si+O ↑↑** | Water (quench) ↑ | **hot then cooled** | – | young form, old expose | – | consensus |
| Dunes | wind + sand supply; dune type set by wind directions (S22, S23) | M4 wind | m/yr migration | quartz buff → hematite red with age | Si+O sand ↑ | dry/Methane ↑ (Titan) | hot or cold dry | – | old = redder | **↓ (life pins sand)** | consensus |
| Patterned ground | thermal-contraction cracks + freeze-thaw sorting (S25, S26) | M3 frost | centuries | stone/fines contrast | – | Water (any freezing volatile) | cold with seasons ↑ | – | mid | – | consensus |
| Desert varnish | dust + Mn/Fe oxides, maybe microbial (S27–S29) | M2 + M6? | 1–40 µm per kyr | Mn black, Fe brown | O ↑ | arid ↑ | hot-dry ↑ | bright ↑ (if microbial) | **↑↑ age stain** | – | **disputed** |
| Coloured strata | each layer's iron state records its climate; tilted and eroded (S30, S31) | M5 + O state | 10⁶–10⁷ yr | hematite red, goethite yellow, chlorite green, Mn purple | **O ↑ red / low-O green** | R3 stain map [game] | arid → red | – | **↑↑ bands** | – | consensus |
| Salt flat / sulfur crust | evaporation; convection cells give salt polygons (S32, S33) | M2 evaporation | weeks (polygons) | halite white, archaea pink, sulfur yellow | O+S for sulfur | Water evap ↑, **Acid → yellow** | hot ↑ | bright ↑ | young | pink brines (R9) | consensus |
| Mushroom rock | low-level sand abrasion and/or damp base + hard cap | M4 wind / M3 | 10³–10⁵ yr | chalk white, Fe caps | Si+O sand | dry ↑ | hot-dry ↑ | – | mid | – | **disputed** (wind vs base) |

---

## 3. Per family: chains, drivers and colour

### 3.1 Arches, fins and bridges (eco-04, eco-13, eco-15)
- **Chain:** porous Entrada Sandstone over a salt layer → salt flows and domes it → parallel joints → fins → water and frost erode the fin sides → a hole breaks through → arch → collapse. `[POP]` NPS (S2): Arches NP has **over 2,000 documented arches**.
- **Why arches and not rubble:** Bruthans et al. 2014 `[PEER]` (S1) found that **vertical load locks grains together**. Unloaded grains fall first, so erosion carves rock *toward* the stable arch and pillar shapes and then slows. This is a negative feedback, and a good game hook: arches are the shapes left standing because they carry their own weight.
- **Colour:** hematite grain coatings give red. Fluids that removed iron leave white bleach `[PEER]` (S31). Varnish streaks give black.

### 3.2 Hoodoos, spires and fairy chimneys (eco-01, eco-07)
- **Bryce:** frost wedging on **>170 freeze-thaw nights a year**, with ice expanding ~9%, plus slightly acidic rain dissolving the CaCO₃ cement `[POP]` NPS (S3). Hard bands make the lumpy "totem" profile.
- **Cappadocia:** soft welded ash under a harder cap, cut by rain `[POP]` (S5).
- **Driver = Heat crossing a freezing point.** Neither the coldest nor the hottest world makes hoodoos. The middle does. `[INFERRED]`

### 3.3 Porous and honeycomb rock (eco-14 Bone Reef, eco-04 walls, R12)
- **Abiotic tafoni:** salt crystallises in pores and pries grains out (Mustoe 1982 `[PEER]`, S6). Wind sweeping the hollow speeds evaporation *inside* it, so the hollow deepens faster than the rim (Rodriguez-Navarro et al. 1999 `[PEER]`, S7). Positive feedback gives cells of even size. Status: **plausible**. The salt + wind model is best supported, but the relative roles are still argued.
- **Biotic pitting (phytokarst):** cyanobacteria and algae bore into limestone and grazers rasp it, leaving black, jagged, sponge-like fields (Folk et al. 1973 `[PEER]`, S8). **This is the strongest Earth case for "life makes the pitted rock".** It needs Light (photosynthetic borers) and grows with Hunger (grazers).
- For eco-14, both routes give similar geometry. Our R12 glowing pores can claim the biotic route as [sci]-adjacent.

### 3.4 Slot canyons, mesas and buttes (eco-10 Red Canyon)
- **Slot canyons:** rare, violent floods carrying sand concentrate on one joint in massive sandstone. A dry climate keeps the walls from widening. `[INFERRED]` (standard; no primary source pulled.)
- **Mesa → butte → spire** is a pure **Time sequence** on one stack of layers. It gives the Time control a readable landform readout: young plateau → old needles. `[BOOK]` (S4, S10)

### 3.5 Sea stacks and sea arches (eco-03 Sindha, eco-06 Capped Sea Stacks)
- **Chain:** headland → caves → arch → stack → stump. Waves exploit joints `[BOOK]` (S11). Collapses happen on human timescales: London Arch (Victoria, 1990) and one Twelve Apostles stack (2005) `[POP]`.
- **Control hook:** needs a liquid sea with waves. `[INFERRED]` Titan's seas are very calm, so a methane world should have fewer stacks.

### 3.6 Precipitated landforms: travertine, sinter, tufa, speleothems, salt (eco-02, eco-14, eco-15)
- **One rule covers all of them: the solvent carried stone in, then lost the ability to hold it.** It loses that ability by degassing CO₂ (travertine, speleothems), cooling or evaporating (sinter, salt), or mixing with a second water (tufa).
- **Travertine terraces self-organise:** precipitation is fastest where flow is thin and fast, at the rims, so rims grow into dams (Hammer et al. 2007 `[PEER]`, S12; review S13). Rates run mm to cm per year, so these change **visibly in a demo**.
- **Silica sinter is our flagship:** silica dissolves in hot fluid at depth and precipitates as opal-A when the fluid cools or evaporates at the surface, templated on microbes (S15, S16). It is **the only common Earth landform that is literally "silicon + oxygen life-assisted stone"**. Mat colours change with temperature band: carotenoid yellow/orange and cyanobacterial green (Grand Prismatic).
- **Tufa towers:** calcium-rich springs meet an alkaline carbonate lake (Council & Bennett 1993 `[PEER]`, S17; algae contribute, S18). They are exposed when the lake drops. **Alkaline-lake chemistry fits our Ammonia sea** [game].
- **Salt flats:** salty groundwater convects beneath the crust and raises **polygon ridges ~1–2 m across** (Lasser et al. 2023 `[PEER]`, S33). Halite is white, halophilic archaea in brines turn pools **pink**, and Dallol's acid brines give **sulfur yellow**. That makes Dallol a real analogue for R3's "acid → sulfur-yellow crusts".

### 3.7 Karst towers and caves
- Carbonic acid dissolves limestone along joints. Depressions merge, leaving cones and then towers (Ford & Williams 2007 `[BOOK]`, S19; Guilin, S20). This takes millions of years and is strongest where it is warm, wet and vegetated (soil CO₂).
- **Control hook:** karst = "rock the sea can dissolve". In water/acid worlds that means carbonate. `[INFERRED]` In methane worlds it means organic sediments (Titan's labyrinth terrain; see notes/02).

### 3.8 Columnar jointing
- Cooling lava contracts and cracks. Successive cracking fronts reorder into near-hexagons, and **column width falls as cooling rate rises** (Goehring et al. 2009 `[PEER]`, S21; the same physics appears in drying starch). Giant's Causeway, Devils Tower.
- **Control hook:** Heat high + Si+O → hexagon fields. It is the one geometric Earth landform that reads instantly as "silicon is stiff" (R1 echo). [game]

### 3.9 Dunes
- Dune type depends on **sand supply × wind-direction variability** (Wasson & Hyde 1983 `[PEER]`, S22): barchan = little sand, one wind; transverse = lots of sand, one wind; linear = two winds; star = many winds. There are two growth modes, bed instability or elongation from a fixed source (S23). Dunes **redden with age** as hematite coats the grains.
- Life (plants, crusts) pins sand, so **Hunger/life pushes away from dunes**. Titan's huge linear organic dunes show a methane world can have dunes.

### 3.10 Patterned ground and ice polygons
- Thermal-contraction cracks fill with ice each winter, making 10–30 m polygons (Lachenbruch 1962 `[PEER]`, S26). Freeze-thaw also self-sorts stones into circles on flats and stripes on slopes (Kessler & Werner 2003 `[PEER]`, S25). Driver: cold with seasonal crossings. Any freezing volatile could plausibly do this (Mars, Pluto) `[INFERRED]`.

### 3.11 Desert varnish and coloured strata (the Time stains, R3)
- **Varnish:** clay plus Mn/Fe oxides, <200 µm thick, Mn enriched ~50–100× (Dorn & Oberlander 1981 `[PEER]`, S27). It grows **1–40 µm per 1000 years** (Liu & Broecker 2000 `[PEER]`, S28). A 2021 hypothesis has cyanobacteria hoarding Mn as an antioxidant (Lingappa et al. `[PEER]`, S29). Status **disputed** (biotic vs abiotic). Either way, varnish darkness is an age signal, which backs eco-15's "dark arches = very old stone".
- **Rainbow strata:** each layer's colour records the oxidation state when it was laid down. Hematite gives red, goethite yellow, chlorite or reduced iron green/grey, manganese purple. Mountain-building then tilts the stack (Zhangye Danxia, Cretaceous red beds `[BOOK]`, S30; Vinicunca). **[game] idea:** each Time era lays one band in the current Sea's stain colour, so changing the Sea mid-game leaves a striped history in the cliffs.

### 3.12 Mushroom and pedestal rocks
- Saltating sand stays within ~1–2 m of the ground, so abrasion undercuts low (Bagnold `[BOOK]`, S24). In many cases a damp base or a hard cap (Kansas concretions) does more of the work. Status **disputed** on the relative roles. Visual pun: abiotic "parasol rocks" on dead worlds echo R7 caps.

---

## 4. Control → landform response (generator-facing digest)

| Control | Pushes toward | Pushes away | Basis |
|---|---|---|---|
| **Recipe: Si+O** | sandstone arches, fins, slot canyons, dunes (quartz sand), columnar jointing, **sinter** | carbonate karst, travertine | [sci] Earth rock types; [game] mapping |
| **Recipe: C+O** | karst, travertine, tufa, speleothems, phytokarst | durable sand dunes | [sci] *carbonate is C+O stone*; see open question 1 |
| **Recipe: O-heavy** | red/orange/black stains: red beds, varnish, rust rims | green/grey strata | [sci] iron and manganese oxidation |
| **Sea: Water** | the full Earth set: freeze-thaw, karst, terraces, stacks | – | [sci] |
| **Sea: Acid** | fast karst, rough pitting, **sulfur-yellow crusts** (Dallol) | carbonate precipitates (travertine, tufa) | [sci] analogue |
| **Sea: Ammonia** (alkaline) | silica dissolution and redeposition (sinter, silica chimneys), tufa-like towers | – | [INFERRED]: silica solubility rises at high pH |
| **Sea: Methane** | dunes, organic karst, calm shores | carbonate/silica dissolution, wave stacks | [INFERRED] from Titan (notes/02) |
| **Heat: cold + crossings** | hoodoos, patterned ground, frost-split fins | – | [sci] |
| **Heat: hot-dry** | tafoni, dunes, mushroom rocks, varnish, salt flats, red beds | freeze-thaw forms | [sci] |
| **Heat: volcanic** | columnar jointing, sinter, fairy-chimney tuff, travertine | – | [sci] |
| **Light** | weak abiotically; bright → microbial landforms (phytokarst, mat colours, maybe varnish) | – | [sci] via life |
| **Hunger** | bioerosion pits, parrotfish sand | dunes (life pins sand) | [sci] analogue; [game] scaling |
| **Time** | young: precipitates, tafoni. Mid: hoodoos, arches, stacks. Old: karst towers, buttes → spires, deep varnish, red dunes, banded strata | – | [sci] timescales |

---

## 5. Facts for a slide (all consensus, sourced)

1. Arches National Park has **over 2,000** documented natural arches. Rock under load locks its grains together, so erosion carves stone *toward* arch shapes. (NPS; Bruthans et al. 2014, *Nature Geoscience*)
2. Bryce Canyon's hoodoos are carved by frost: the temperature crosses freezing on **more than 170 nights a year**, and ice expands **9%**. (NPS)
3. Desert varnish grows **1–40 micrometres per thousand years**. Its black colour is manganese, concentrated **50–100×** above normal rock. (Liu & Broecker 2000; Dorn & Oberlander 1981)
4. The Giant's Causeway hexagons come from cooling lava cracking, and **faster cooling gives thinner columns**. Drying cornflour makes the same pattern. (Goehring et al. 2009, *PNAS*)
5. Hot-spring silica (sinter) grows on microbial filaments. It is Earth's clearest case of **life helping silicon and oxygen become stone**. (Konhauser et al. 2001)
6. Salt-flat hexagons are **1–2 m** across and are set by salty water convecting *underground*. (Lasser et al. 2023, *Phys. Rev. X*)
7. Dune shape is set by just two things, sand supply and how many directions the wind blows: one direction gives crescents, several give stars. (Wasson & Hyde 1983, *Nature*)
8. Rainbow mountains are a rust record: red hematite, yellow goethite and green chlorite each mark the conditions when that layer was laid down. (Danxia literature; iron mineralogy)

---

## 6. Open questions
1. **R2 tension:** on Earth, carbon + oxygen *does* make lasting stone as **carbonate** (limestone, travertine, tufa, karst). "Carbon rusts to air" holds only without calcium or magnesium. Should C+O worlds grow carbonate landforms (a strong, real story), or keep R2 simple?
2. **Ammonia + silica:** silica solubility rising at high pH is consensus chemistry. Whether cold liquid ammonia behaves like alkaline water toward silica is not established. That needs a chemistry check before it goes on a slide (see silicon-life notes).
3. **Freeze-thaw under non-water seas:** frost wedging relies on water's unusual ~9% expansion on freezing. Methane and ammonia shrink when they freeze, so hoodoo/fin-making by frost may *not* transfer. Thermal-contraction polygons would still work.

Not sourced in this pass: slot-canyon primary paper, Kansas concretion caps, and the Twelve Apostles/London Arch collapse dates (all [POP]/[INFERRED]). No Wikimedia image was pulled for phytokarst or Carlsbad.
