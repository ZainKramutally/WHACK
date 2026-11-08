# Flora traits: plants that follow the chemistry

Status: design, 2026-11-08. Owner: Caden (art layer). Designer agent `flora-traits`. No code here.
Reads: `CLAUDE.md` ("Logic → art interface", "Visuals are stylised but never contradict the stats", "Plants"),
`docs/features/art-layer.md` (decision 3), `docs/ART_DIRECTION.md`, `docs/features/crust.md`, and the stage code at
9436106 → 42a9865 (`src/render/floraForm.ts`, `floraLib/**`, `flora.ts`, `palette.ts`, `material.ts`).

**Team-lead note (03:10).** `session/crust` (another session, waiting on the owner's merge) already ships the mineral
crust map (CPU and TSL crust weights, `crustMap`), ground colour per mineral, the rust ratchet and a world-wide
`floraPigment` in `flora.ts`. So **WP-C is superseded**: don't build `substrate.ts` or a terrain DataTexture. WP-A reads
session/crust's CPU crust weights directly (no `VisualInputs.crust` contract change), falling back to the height-rank
proxy until that branch is on main. Per-plant tints compose with `floraPigment`; they don't replace it. The C2 `pickAlong`
moves to WP-B, because the new archetypes need its draw savings.

**The ask (Caden):** more plants, each feature justified by a characteristic (mineral → colour, leaf shape → something),
so the flora visibly changes with mineral, temperature, oxygen, nitrogen and CO₂.

**The answer in one line:** every drawn plant feature is the value a *real, published trait–environment relationship*
predicts for the plant's cell and the world's live stats. Plants don't evolve in the sim, so this is honestly
**environmental filtering drawn as an instant equilibrium**, the same simplification the sim already declares for CO₂
warming. Traits shift live as the sliders and life's feedbacks move the stats.

## 0. Ground rules

1. **Pure.** `traits = f(VisualInputs, cell, per-plant hash)`. No state, except the rust ratchet that `crust.md` already
   declares (rock doesn't un-rust).
2. **Honest tags.** [sci]: real, checkable mechanism, used for what the source says. [analogue]: real Earth mechanism
   applied by analogy to our alien plants. [speculative]: silicon chemistry. [art]: stylised, no claim. DOIs below were
   checked against Crossref on 2026-11-08 (title, first author, year). **The supporting facts and numbers are recalled
   from the literature, not re-read**; any number marked [unverified] must not appear on a card until checked.
3. **Base hue is [art].** Red World plants are bone, blush and crimson by art direction, not by a pigment model.
   Kiang et al. 2007 [sci] says pigment colour depends on the star and air, and Earth's red algae really do reflect
   red (phycoerythrin absorbs green), so red plants are defensible, but we never claim the sim computed the hue.
   Traits *modulate* the base hue within its family.
4. **Colour rules.** No trait tint may enter the accent band (hue 165–200°): cyan stays "glow from darkness" only.
   Value still inverts with height (ink/maroon bases, pale tops): tints are multipliers ≤ 1 on dark tissue, so bases
   stay dark. Carbon tints stay in hue 340–40°; silicon tints stay in 230–300°.
5. **Three channels, cheapest first.**
   - **C1, continuous per plant** (instance matrix, `instanceColor`, flora-unique's deformation attribute, read
     against the baked part weights `aPart` of §7 WP-B): height,
     girth, cap size, droop, lean, tint, margin teeth, pale coat. Free in draw calls.
   - **C2, variant along a trait axis** (which prebuilt variant of a species is drawn): rib/pore density, crystal habit.
     **Only world-wide stats may drive C2** (temperature, O₂, CO₂, N₂, light, air density), so each species shows at
     most two adjacent variants patch-wide. Per-cell conditions never pick topology on carbon (§0.6).
   - **C3, gated archetype substitution:** a new species replaces a named entry of an existing pick list when its gate
     holds. The library grows; the active set doesn't.
6. **Budget (from `floraLib.test.ts`).** Carbon's worst case already sits **at the 33-draw cap** (bright capped form:
   ground 3 kinds × near/dark/far = 9, mid 6 × 2 LODs = 12, giant 6 × 2 = 12). Silicon's worst case is **18**, so it
   has 15 draws of headroom. Therefore: carbon pays for new archetypes by narrowing C2 picks (6 mid kinds → 4, 6 giant
   kinds → 4: −8 draws) and allows at most **two gated mids and one gated giant at once** (+6), so its worst case is 31.
   Silicon may use per-cell C2 (supply-driven branching) and ends at 22. Units: every variant is its own archetype,
   so its own bucket; carbon mid/giant and **silicon mid/giant cost 2 draws per kind** (the near LOD carries the cut-out
   material), ground costs near + dark (+ far on carbon). Triangles stay < 4.5M (§9 lists costs).
7. **Readability test.** A trait earns a place only if it reads from the follow camera at 360 px internal height in at
   least one depth plane: **far** (silhouette and value against white/violet sky), **mid** (colour mass, cap size,
   grove shape), **near** (rims, ribs, pores, nodules, bladders). Near-only traits are cheap extras, never demo beats.

## 1. Trait table

`hb` = `heatBand` (0..1 in the living band), `L` = `light` (× Earth), `T` = `stats.temperature` (°C),
`wet` = waterlogging (§3), `elev` = cell height above `seaLevel` (m), `rank` = cell height rank in the patch (0..1),
`P` = photorespiration index `(O₂/CO₂) ÷ 525` (Earth today 21/0.04 = 525; our carbon default ≈ 21/0.25 → 0.16),
`supply` = mineral supply multiplier of the cell (`crust.md`), `B` = cell biomass (mat + canopy).

| # | Trait | Visible effect | Driver(s) | Rule (monotone, direction, range) | Science + source | Tag | Ch. / plane |
|---|---|---|---|---|---|---|---|
| T1 | Stress pigment (anthocyanin) | pale tops blush → crimson, chroma up | cold `hb<0.3`, high light `L>1.5`, N-poor `N<0.5×`, poor mineral (granite), drought (high `rank` and `hb>0.6`) | `A = max(stressors)`, tint top tissue toward crimson by up to 35% | Anthocyanins accumulate under cold, high light, drought and N/P deficiency: Chalker-Scott 1999, *Photochem. Photobiol.* 10.1111/j.1751-1097.1999.tb01944.x | [sci] mechanism, [analogue] on alien plants | C1 tint / mid, far |
| T2 | Photoprotective pigment (carotenoid) | tops shift bone → apricot/peach (hue 20–35°) | `L` | `0` at `L≤1`, rising to 25% tint at `L=3` | Xanthophyll-cycle carotenoids rise in high light: Demmig-Adams & Adams 1996, *Trends Plant Sci.* 10.1016/s1360-1385(96)80019-7 | [sci]/[analogue] | C1 tint / mid |
| T3 | Shade pigment | darker, denser tissue; glow sites pop | `L<0.4` | value × (0.75 + 0.25·L/0.4) on mid tones | Shade leaves pack more pigment per mass; dim stars favour darker, broader absorbers: Kiang et al. 2007, *Astrobiology* 10.1089/ast.2006.0108 | [analogue] | C1 tint / mid |
| T4 | Nutrient status from mineral | basalt: full chroma; granite: purpled (via T1) + small thick caps; gley shore: bronze flecks on tips | cell mineral (`crust.md`), `wet` | per §3.3 | P-deficiency reddening (Chalker-Scott 1999); sclerophylly on poor soils: Loveless 1961, *Ann. Bot.* 10.1093/oxfordjournals.aob.a083740; Fe²⁺ toxicity "bronzing" on waterlogged soil: Becker & Asch 2005, *J. Plant Nutr. Soil Sci.* 10.1002/jpln.200520504 | [sci] mechanisms, [analogue] | C1 tint / near, mid |
| T5 | Leaf/cap size | parasol discs, fan webs and blades bigger or smaller | `hb`, `wet` | peak at warm–wet (`hb` 0.5–0.8, `wet>0.5`): ×1.3; cold (`hb<0.25`): ×0.7; hot–dry–bright: ×0.75 | Leaf size rises with temperature × moisture; small leaves where nights chill or days overheat: Wright et al. 2017, *Science* 10.1126/science.aal4760 | [sci]/[analogue] | C1 scale / far, mid |
| T6 | Leaf margin (teeth) | smooth vs jagged cap rims against the sky | `T` | share of plants with smooth rims = clamp((T − 1.14)/0.306 %, 0, 100) → ~45% at 15 °C, all smooth ≥ 32 °C, all toothed ≤ 1 °C | Leaf-margin analysis: entire margins rise with mean annual temperature: Wolfe 1979, USGS PP 1106, 10.3133/pp1106; Wilf 1997, *Paleobiology* 10.1017/s0094837300019746; formula Wing & Greenwood 1993, 10.1098/rstb.1993.0109 (coefficients [unverified]) | [sci] | C1 deform / far (giant rims), near |
| T7 | Leaf thickness (LMA) → stiffness | thick, stiff, upright caps vs thin, drooping ones | `L`, poor mineral, CO₂ | `LMA = 0.4·sat(L) + 0.3·poor + 0.3·CO₂ high`; droop = 1 − LMA | LMA rises with light, low nutrients and elevated CO₂: Poorter et al. 2009, *New Phytol.* 10.1111/j.1469-8137.2009.02830.x | [sci]/[analogue] | C1 droop / mid |
| T8 | Pale coat (hair or wax) | upper surfaces lift toward bone/white, chroma down | hot–dry–bright (`hb>0.6`, `wet<0.3`, `L>1`) or cold–high–bright (`hb<0.3`, `rank>0.7`) | coat 0..1, lerp tops ≤ 30% toward bone | Leaf hairs cut absorptance in a desert shrub: Ehleringer et al. 1976, *Science* 10.1126/science.192.4237.376; pubescence rises with altitude in an Andean giant rosette: Meinzer et al. 1985, *Oecologia* 10.1007/bf00379230; waxes rise under stress: Shepherd & Griffiths 2006, 10.1111/j.1469-8137.2006.01826.x | [sci]/[analogue] | C1 tint / mid, far |
| T9 | Gas-exchange density (ribs + pores) | rib/pleat count on caps and fans; gill spacing under parasols; sieve plates vs solid webs | `P` (world-wide) | sparse build below `P` = 0.45, dense above (a hard switch, so one build per species at a time) | Stomatal density falls as CO₂ rises: Woodward 1987, *Nature* 10.1038/327617a0. Vein density rose as CO₂ fell (early angiosperms): Brodribb & Feild 2010, *Ecol. Lett.* 10.1111/j.1461-0248.2009.01410.x. High O₂/CO₂ drives photorespiration and C₄ (dense-vein Kranz) anatomy: Sage 2004, *New Phytol.* 10.1111/j.1469-8137.2004.00974.x; Ehleringer et al. 1997, 10.1007/s004420050311 | [sci] direction, [art] variant axis | C2 / near (gills), mid (pleats) |
| T10 | Height | band position (existing) | `hb` (cold → tall), `L` | existing `heightScale` × etiolation `1 + 0.15·(1 − L/0.4)` when `L<0.4` | Cold → tall is the **owner's rule, mirrored from creatures**; on Earth plant height *falls* with cold (Moles et al. 2009, *J. Ecol.* 10.1111/j.1365-2745.2009.01526.x). Etiolation in low light is real shade avoidance: Franklin 2008, *New Phytol.* 10.1111/j.1469-8137.2008.02507.x | cold-tall [art]; etiolation [analogue] | C1 scale / far |
| T11 | Girth (stoutness) | trunks thicker in high gravity and when taller | `stats.gravity` (seeded: carbon 0.8–1.3 g, silicon 0.5–1.0 g), drawn height | horizontal scale × `√(g)` × `√(heightScale)` | Elastic similarity: columns avoid buckling with d ∝ H^1.5 and need d ∝ √(ρg) at fixed H: McMahon 1973, *Science* 10.1126/science.179.4079.1201 | [sci] | C1 scale / far, mid |
| T12 | Bladders (buoyancy) | gas floats on kelp stipes (water) and tethered floats in thick air | submerged + depth; `airDensity` | air floats only at `airDensity ≥ 5 ×` Earth's (VisualInputs units: Earth ≈ 0.06, silicon ≈ 0.65 with the shared 0.05 scale) | Kelp pneumatocysts float fronds toward light (textbook, e.g. Hurd 2000, *J. Phycol.* 10.1046/j.1529-8817.2000.99139.x, [unverified] for floats specifically). Net lift per m³ = ρ_air − ρ_gas: 3.6 bar N₂ at −183 °C is ≈ 13.5 kg/m³, ≈ 11 × Earth's air (physics) | physics [sci]; floats in air [speculative] | C3 / far |
| T13 | Trap leaves (carnivory) | pitcher urns on bright wet shores | `N<0.3×`, `L≥0.4`, `wet>0.6` | gate (§2 A1) | Carnivory is restricted to sunny, wet, nutrient-poor habitats: Givnish et al. 1984, *Am. Nat.* 10.1086/284289; Ellison & Gotelli 2001, *TREE* 10.1016/s0169-5347(01)02269-8 | [sci] niche, [analogue] | C3 / mid |
| T14 | Root nodules (N-poor) | coral base band (needs the optional luma-weighted tint of WP-A; cut otherwise) | `N<0.5×` | base-band tint 0 → 1 over N 0.5 → 0.1× | Legume nodules form where fixed nitrogen is scarce, and nitrate suppresses them: Streeter 1988, *Crit. Rev. Plant Sci.* 10.1080/07352688809382257. Active nodules are pink from leghaemoglobin (textbook) | [analogue] | C1 tint / near only (cheap extra) |
| T15 | Crystal habit (silicon) | columns ↔ hex plates; compact prisms ↔ 60° dendrites | `hb` (world-wide), `supply × B` (per cell) | cold → columnar, warm → plate (prismTitan/shardTree variant axis); high supply → branched variants and frost ferns | Snow-crystal habit switches with temperature and supersaturation (Nakaya diagram): Libbrecht 2005, *Rep. Prog. Phys.* 10.1088/0034-4885/68/4/R03. High supersaturation makes branching (Mullins–Sekerka instability): Mullins & Sekerka 1964, *J. Appl. Phys.* 10.1063/1.1713333. β-Si₃N₄ grows as elongated hexagonal prisms (materials textbook, [unverified] here) | mechanism [sci]; on silicon life [speculative] | C2 (per cell allowed on silicon) / far, mid |
| T16 | Film colour (silicon) | crusts and caps go violet → blue → silver-ice as they thicken | `B` (thickness proxy), age via `buildProgress` | thickness `t = B·(0.4 + 0.6·buildProgress)` → interference hue ramp clamped to 230–300° plus silver | Thin silicon-nitride films show thickness-dependent interference colours (standard colour charts): Henrie et al. 2004, *Opt. Express* 10.1364/OPEX.12.001464 | optics [sci]; living films [speculative] | C1 tint / mid |
| T17 | Dopant tint (silicon) | silicide cells: smoky, darker crystals; nitride: clear, pale; ice: nothing grows | cell mineral | silicide value × 0.8, chroma × 0.7; nitride +10% value | Transition-metal impurities colour or darken crystals (gemmology textbook, [unverified] source); minerals from `crust.md` (nierite: Lee 1995, 10.1111/j.1945-5100.1995.tb01142.x) | [analogue]/[speculative] | C1 tint / mid |
| T18 | Vitality | sparse cells: lower chroma, slight grey; lush: full chroma | `B` | chroma × (0.7 + 0.3·sat(B/0.9)) | Senescing/starved tissue loses pigment (textbook) | [art] mostly | C1 tint / mid |

Dropped after critique (§11): wind-driven stoutness from air density (wind speed on dense cold worlds is unknown, so
the direction isn't grounded), phototropic lean toward the star (trees grow vertical; slope tilt already ships in
4c1afa3), and nickel-blue latex (our crusts model no nickel or ultramafic rock; Jaffré et al. 1976 stays a pitch aside).

## 2. New archetypes (8)

Each archetype **substitutes** for a named pick-list entry when its gate holds (C3), takes that entry's instance slots
(so instance counts and triangles barely move), and is built once into two LODs like the rest of `floraLib`.
Gates read world-wide stats plus per-cell `wet`, `elev`, `rank`, `depth` (`seaLevel − ground`), mineral and biomass.
Exclusions keep at most two gated mids and one gated giant alive on carbon at once (§9.2).

| id | World, role, band | Gate (all must hold) | Substitutes for | Exclusive with |
|---|---|---|---|---|
| A1 `pitcherUrn` | carbon, mid, 5–12 m | row: `N < 0.3×`, `L ≥ 0.4`, canopy ≥ `MID_CANOPY`, cell touches the shore. Plant: own ground 0.2–3 m above the sea (dry ground beside the water) | `ribFan`/`lanternPods` entries in that cell's mid list | A3 (pitcher wins when N is low) |
| A2 `woollyRosette` | carbon, giant, 20–30 m | land, `T < 8 °C`, `rank > 0.7`, `L ≥ 0.4`, canopy ≥ `GIANT_CANOPY` | `parasolTitan`/`coilSpire` in that cell | A3 (temperature gates don't overlap: < 8 vs ≥ 10 °C) |
| A3 `stiltMangrove` | carbon, mid, 6–12 m | row: `T ≥ 10 °C` (frost limit), `N ≥ 0.3×`, canopy ≥ `MID_CANOPY`, cell touches the shore. Plant: own ground 0.2–3 m above the sea | `weeper#3`/`ribFan` in shore cells | A1, A2 |
| A4 `cushionMound` | carbon, ground, 0.3–1.2 m | `T < 0 °C` (world-wide) | `groundCover#2` in every carbon ground list | none (net 0 draws) |
| A5 `bladderKelp` | carbon, mid, height = water depth + 0.5 m (5–15 m) | water niche: submerged, water solvent, not frozen, depth 2–15 m, `B ≥ 0.3`. Air niche: land, `airDensity ≥ 5 ×` Earth's | water: a new aquatic mid slot (1 per cell max); air: `weeper` entries | none |
| A6 `airKelpFloat` | silicon, giant, 20–35 m | row: `airDensity ≥ 5 ×` Earth's (silicon default ≈ 11 ×), canopy ≥ `GIANT_CANOPY`. Plant: the giant checks in place.ts, plus the mid/giant sink rule for its tether foot | `prismTitan#2` (candelabra), patch-wide because the gate is world-wide: net 0 draws | none |
| A7 `frostFern` | silicon, ground, 0.4–1.5 m | `supply(si) × B > 1.2` (silicide margins, lush) | `crystalGround#2` (needle tuft) in that cell | none |
| A8 `whiskerReef` | silicon, mid, height = depth − 0.5 m (3–10 m) | submerged, not frozen, depth 1–12 m, `B ≥ 0.3` | a new aquatic mid slot (1 per cell max) | none |

**Gates are a `MAP` row plus a per-plant predicate** (flora-audit). The row (a suffixed `MAP` id such as
`carbon:capped:pitcher`, chosen by `gates.ts` from world-wide stats and the cell) decides which list a cell draws from.
The predicate runs in `place.ts` after the plant's own ground height `y` is known, alongside the existing per-plant
checks (side of the sea, tilt and sink from 4c1afa3). If it fails, the plant takes the base row's pick, so plant
counts never change:
- **A1, A3 (shore plants on dry ground beside the water):** `seaLevel + 0.2 ≤ y ≤ seaLevel + 3`, measured at the plant,
  never at the cell centre.
- **A5 water, A8 (aquatic):** `y ≤ seaLevel − 1`, with depth `seaLevel − y` inside the window. These are the only
  mids allowed on the sea side.
- **A5 air, A6 (tethered floats):** the mid/giant sink rule applies to the tether foot (sink ≤ 15% of drawn height,
  else the plant is skipped like any mid), and the float string stays upright (no ground tilt).
- **A2, A4, A7:** land checks as now; A7 also needs its cell's silicide supply.

### A1 Pitcher urn (carbon): "nitrogen-poor, bright and wet ground grows traps"
- **Why:** carnivory pays only where light and water are plentiful and nutrients scarce (Givnish et al. 1984; Ellison
  & Gotelli 2001) [sci niche, analogue on our plants]. Our cue is the Nitrogen slider, the one control that starves
  plants of nitrogen. Card text must say it is the Earth pattern, not a sim result (the sim has no plant N limit).
- **Silhouette.** Near: a tall urn with a flared, ribbed lip (peristome), a hooded lid, crimson veins on bone, maroon
  foot, and an ink mouth. In dim light the lip is a glow site. Mid: 2–4 bottles per grove leaning off one root knot.
  Far: hooded capsules, the only "bottle" outline in the library.
- **Depth planes:** a midground hero on the spawn shore (the spawn clearing keeps it ≥ 25 m away, so it frames the
  first look out to sea). **Cost:** near ≈ 320 tris (12 sides × 12 rings + lid sheet), far ≈ 110.

### A2 Woolly rosette giant (carbon): "the cold, bright heights grow giant rosettes"
- **Why:** tropical-alpine giant rosettes (Espeletia, Dendrosenecio) keep a skirt of dead leaves that insulates the
  stem and a hairy crown that reflects light and holds heat (Smith & Young 1987, *Annu. Rev. Ecol. Syst.*
  10.1146/annurev.es.18.110187.001033; Meinzer et al. 1985) [sci]. It is the **one real Earth case where cold goes with
  a tall plant form**, so it gives the owner's cold → tall rule its best analogue.
- **Silhouette.** Far: a column with a shaggy skirt and a ball crown (lollipop-with-skirt), unlike any disc or coil.
  Mid: a silver-pale crown (T8 coat) over a maroon skirt. Near: banded hanging dead leaves and rosette tips.
- **Planes:** background ridge silhouettes. **Cost:** near ≈ 450 (trunk 96, skirt sheet 128, 24 leaves × 8), far ≈ 160.

### A3 Stilt-root mangrove (carbon): "waterlogged shores grow breathing roots"
- **Why:** prop roots and pneumatophores ventilate roots in anoxic waterlogged mud (Scholander et al. 1955,
  *Am. J. Bot.* 10.1002/j.1537-2197.1955.tb11097.x) [sci]; mangroves are frost-limited at their poleward edge
  (Osland et al. 2013, *Glob. Change Biol.* 10.1111/gcb.12126) [sci], hence a mean-temperature floor of 10 °C (a
  proxy for "no hard frosts", [art] threshold). Real thresholds are in °C, so carbon gates use `T`, not `hb`
  (15 °C is only `hb` 0.38).
- **Silhouette.** Carbon curl grammar: a cap on 5–7 arching, curling prop roots. Mid: rows of arches along the
  shoreline make a **leading line toward the sea** (ART_DIRECTION rule 6). Near: knees and gley-bronzed tips (T4).
- **Planes:** midground, every carbon run (the spawn is always on a shore). **Cost:** near ≈ 380, far ≈ 140.

### A4 Cushion mound (carbon): "cold flattens the ground cover into cushions"
- **Why:** cushion and mat forms stay close to the warm ground and out of the wind in cold places (alpine plant
  ecology, e.g. Körner's *Alpine Plant Life*, [unverified] for any number) [sci growth form].
- **Silhouette.** Domed hummocks with dimpled rosettes. Near: dimples. Mid: pale clumps (T8 coat in the cold).
  Far: thinned like all ground cover. **Cost:** near ≈ 120, far ≈ 48 (cheaper than the tuft it replaces: 195).

### A5 Bladder kelp (carbon): "gas floats lift fronds to the light, in water or in thick air"
- **Why:** pneumatocysts float kelp fronds toward light [sci, textbook]; lift per volume is ρ_fluid − ρ_gas, so in air
  over ~5 × Earth's density the same float lifts the same as a small water float does. That is DESIGN.md R11 ("thick
  air is a sea") [physics sci; in air speculative]. On carbon the air niche opens only when the Nitrogen slider thickens
  the air. One archetype serves both niches.
- **Silhouette.** A curling stipe with round bladders at blade bases, top bladder largest. **In water its height is the
  water depth + 0.5 m, so the top floats sit on the surface**: from the shore, a bead mat on the sea that reads at mid
  distance and tracks sea level. In air: swaying vertical bead strings. **Cost:** near ≈ 300, far ≈ 110.

### A6 Air-kelp float (silicon): "thick nitrogen air holds crystal floats aloft"
- **Why:** 3.6 bar of N₂ at −183 °C is ≈ 13.5 kg/m³ (P·M/RT), ≈ 11 × Earth's air, so a gas float gives ≈ 11 × the lift
  [sci physics]. The lifting gas (H₂ on a reduced world) and the living floats are [speculative]; CLAUDE.md already
  declares compressed lift for animal floaters, and the same declaration covers this plant.
- **Silhouette.** Straight hex tether, faceted hex-bipyramid floats at 60° nodes, top float largest, stiff sway (a
  third of carbon's). Far: vertical bead strings against the violet sky, the only vertical "dotted line" giant.
  Mid: float cores are glow sites (glow from darkness). **Cost:** ≈ 260 (silicon far LOD = near).

### A7 Frost fern (silicon): "rich supply branches the crystals"
- **Why:** fast growth at high supersaturation destabilises flat faces into 60° dendrites (Mullins & Sekerka 1964;
  Libbrecht 2005 for ice) [sci mechanism, speculative on silicon]. Our supersaturation proxy is mineral silicon supply ×
  biomass, so ferns gather on silicide margins.
- **Silhouette.** Three vertical sector-plate blades at 120°, each a spine with 60° side branches. Near: feathery
  frost on glass. Mid: white-violet hedges along the shore. **Cost:** ≈ 140.

### A8 Whisker reef (silicon): "clear liquid nitrogen shows the first crystal life from the shore"
- **Why:** life starts in the shallows and must read from the shore (CLAUDE.md "Generation sequence"); liquid
  nitrogen is clear. Elongated hexagonal whiskers echo β-Si₃N₄ grain habit ([unverified], [speculative] as life).
- **Silhouette.** A bristle of long hex needles leaning out in 15° steps, tipped with glow pods. Height = depth − 0.5 m,
  so it never breaks the surface (crystals don't float). Mid: a violet thicket under the clear sea. **Cost:** ≈ 180.

## 3. Substrate colour field (ground and what plants take from it)

### 3.1 Derivation (pure, per 64² cell, CPU)
`substrate(cell)` returns five numbers, all from VisualInputs plus the crust map:

| Field | Rule | Science | Tag |
|---|---|---|---|
| `mineral` | from `crustMap(world, seed)` (`crust.md`, `src/gen/crust.ts`) when available; fallback by height `rank`: carbon basalt below 0.55, granite above; silicon silicide < 0.4, nitride < 0.8, water ice above | isostasy (granite rides high, basalt floors lowlands): `rudnick2003` in crust.md | [sci] (crust.md) |
| `rust` | `rustRatchet × oxidises`; ratchet = max O₂ seen this run ÷ `rustOxygen` (1 %), clamped 0..1 | red beds follow the Great Oxidation (`holland2006`, `rye1998` in crust.md) | [sci] |
| `wet` | 1 below sea level; on land `1 − smoothstep(0.5, 4, elev)`; × `(1 − frozen)` | waterlogged soils are anoxic | [sci] |
| `gley` | `wet × oxidises-capable rock` (any iron-bearing mineral), independent of air O₂ | waterlogging reduces Fe³⁺ to grey/blue-green Fe²⁺: Schwertmann 1993, *SSSA Spec. Publ.* 31, 10.2136/sssaspecpub31.c4 | [sci] |
| `ochre` | goethite share `= (1 − hb) × (0.4 + 0.6·wet)` on rusted ground | goethite (yellow-brown) favoured cool and moist, hematite (red) warm and dry: Kämpf & Schwertmann 1983, *Geoderma* 10.1016/0016-7061(83)90028-9 | [sci] |
| `humus` | `smoothstep(0.3, 1, mat)` on land | organic matter darkens topsoil (textbook) | [sci] |

The ratchet is the only state; it resets on world change and depends only on the input sequence, so it stays
deterministic. Silicon's O₂ is pinned at 0, so silicide never "rusts" to silica in the world (the box still shows it).

### 3.2 Colours (Red World families only; terrain colorNode, WP3 owns `terrainNode.ts`)

| World | State | Colour (palette role) | Reads as |
|---|---|---|---|
| Carbon | basalt, unrusted (O₂ < 1 % from the start) | `ink` → `maroon` mix, low chroma | dark volcanic rock |
| Carbon | basalt, rusted, warm/dry (hematite) | `red` → `crimson` | the Red World ground |
| Carbon | basalt, rusted, cool/moist (goethite) | toward `redLight` (vermilion-orange end, hue ≤ 25°) | ochre-leaning red |
| Carbon | granite (never rusts) | `blush` → `bone`, low chroma | pale pink highland (K-feldspar granite is pink) |
| Carbon | gley shore band | `shadow` (violet-oxblood) at −40 % chroma | grey, waterlogged mud |
| Carbon | humus under dense mats | existing `GROUND.life` maroon darkening | living soil |
| Silicon | silicide | `maroon` → `crimson` (indigo-violet) at −30 % chroma | dark metallic grains |
| Silicon | nitride | `red` role (pale lilac stone, the current base) | pale ceramic rock |
| Silicon | water ice | `bone` with `blush` (ice-blue) shading | relic ice bedrock |
| Silicon | margin crust | existing M2 rims, tinted by T16 film colour | crystal crust bands |

At the default 21 % O₂ the ratchet is 1 from the first frame, so the default carbon run is red in the lowlands and pale
pink on granite highlands: still "two colours own the frame". The dark-basalt start appears only when the player sets
Oxygen below 1 % before Generate, and the land reddens live as photosynthesis lifts O₂ past 1 % (crust.md's story).

### 3.3 How plants take it up (nutrient status, not "plants coloured like rocks")
Real plants rarely take a rock's colour; they show **nutrient status**. So uptake is T1/T4/T7/T17 driven by the cell's
substrate, blended by root depth: ground cover 40 %, mid 25 %, giants 15 % ("small plants show their soil, big plants
show their climate", [art]).

| Substrate | Plant response | Source | Tag |
|---|---|---|---|
| basalt (fertile, `supply` 1.4) | full chroma, larger caps (T5 × 1.1) | crust.md `dessert2003` (fast weathering feeds life) | [analogue] |
| granite (poor, `supply` 0.6) | anthocyanin purpling (T1 +0.3), small thick stiff caps (T5 × 0.85, T7 +0.3) | Chalker-Scott 1999; Loveless 1961 | [sci]/[analogue] |
| gley shore | bronze-orange flecks on tips and leaf edges (hue 20–30°, glow-free) | Becker & Asch 2005 (Fe²⁺ toxicity bronzing) | [sci]/[analogue] |
| silicide (Si supply 1.6) | smoky, darker crystals (T17); frost ferns (A7) | crust.md minerals | [speculative] |
| nitride | clear, pale crystals | crust.md | [speculative] |
| water ice (supply 0) | nothing grows, so nothing is drawn | crust.md | [sci] (no supply) |

## 4. Demo moments (what the plants do when a slider moves)

Sliders ease over 1 s and flora rebuilds once a second after the build (`REBUILD_EVERY_LIVE`), so every first effect
below lands within about 2–3 s. Carbon `hb` = (T + 50) ÷ 172, so 15 °C is `hb` 0.38; light follows orbit,
roughly (T_K ÷ 288)⁴ (≈ 0.36 at −50 °C, ≈ 3.5 at 122 °C, ignoring greenhouse changes, [unverified] exact values).

### Carbon
| Move | First effect (≤ 3 s) | Then | Traits |
|---|---|---|---|
| Temperature 15 → 80 °C | tops warm to apricot under the brighter star; jagged rims smooth out (all smooth above ~32 °C) | plants shorten; dry ridges go pale and hairy; caps shrink on ridges but stay big on wet shores; ground deepens to hematite red | T2, T6, T10, T8, T5, §3 |
| Temperature 15 → −30 °C | parasol rims turn jagged against the sky (all toothed below ~1 °C); tops blush crimson | woolly rosettes stand on the ridges (< 8 °C); mangroves leave the shore (< 10 °C); tufts become cushions (< 0 °C); the sea freezes (existing); ground slides toward vermilion-ochre | T6, T1, A2, A3, A4, §3 |
| Temperature → −45 °C | light falls below 0.4: lantern cups and glow (existing) | rosettes give way (they need bright light); shade pigment darkens tissue | T3, existing |
| Nitrogen 1 → 0.1 × | groves blush (N-deficiency reddening); coral nodule bands at stem bases | pitcher urns replace the shore mangroves below 0.3 × | T1, T14, A1 |
| Nitrogen 1 → ×10 or more | none at first | once the air passes 5 × Earth's density, bladder-kelp floats rise among the weepers on land ("thick air is a sea") | A5 (air) |
| Oxygen 21 → 40 % | ribs and gill pleats step denser (more photorespiration pressure), most visible on low-CO₂ seeds | none | T9 |
| Oxygen to 0 % | ribs sparse; **the ground stays red** (rock doesn't un-rust: the ratchet) | animals shrink (sim) | T9, §3 |
| Oxygen below 1 % before Generate | the world starts on dark basalt | the lowlands redden live as photosynthesis lifts O₂ past 1 % (the strongest oxygen beat, and it's crust.md's) | §3 |
| CO₂ during the build | **small**: config photosynthesis (−2.5e-7) and decay (+2.21e-7) nearly cancel, so at most one rib/pore step | across seeds, the start CO₂ (0.1–0.35 %) changes `P` 3.5 ×, so worlds differ visibly | T9 |

### Silicon
| Move | First effect | Then | Traits |
|---|---|---|---|
| Temperature −183 → −160 °C | prism titans flatten from columns into stacked hex plates | plants shorten; seas shrink into the air, margin crusts above the new shore die (existing M2 bands), whisker reefs left dry vanish with their biomass | T15, T10, A8 |
| Temperature −183 → −205 °C | columns and needles; taller | seas rise toward the freeze edge at −210 °C | T15, T10 |
| Nitrogen down | shoreline retreats; reefs and margin ferns follow it out | **air kelp stays**: the seas hold the pressure, so less nitrogen doesn't thin this air | A8, A7, A6 |
| Nitrogen up | seas rise and drown margin crusts (they glow and sit low, existing) | reefs grow in the new shallows as biomass follows | A8 |
| Oxygen | pinned at 0, nothing changes (the point) | none | none |
| The build itself | crust film colour walks violet → blue → silver-ice as crusts thicken | frost ferns gather on silicide margins | T16, A7 |

## 5. Card "why" lines (proposal for the logic lead)

Per CLAUDE.md, science text lives in world config. **Proposal:** `features.producer.traits?: FloraTraitNote[]`, where
`FloraTraitNote extends Sourced { id: string; label: string }`. The art layer's `plantTraits()` returns the clicked
cell's active trait ids ranked by strength; the producer card shows up to two notes under its existing `why`. Until the
contract change is agreed, the card shows nothing new (no text in render code). New source ids for `sources.ts`:
`wright2017, wolfe1979, wilf1997, woodward1987, brodribb2010, sage2004, givnish1984, ellison2001, ehleringer1976,
meinzer1985, chalkerScott1999, demmigAdams1996, poorter2009, loveless1961, becker2005, schwertmann1993, kampf1983,
smith1987, scholander1955, osland2013, mcmahon1973, libbrecht2005, mullins1964, henrie2004, kiang2007`.

| id | Draft line (one sentence) | Sources | `assumption` |
|---|---|---|---|
| `pitcherUrn` | Nitrogen is scarce here but light and water aren't; on Earth, plants in such places trap animals for nitrogen. | givnish1984, ellison2001 | false (Earth pattern, stated as such) |
| `woollyRosette` | On cold, bright heights a skirt of dead leaves keeps the stem warm and hairs shield the crown, as on Andean frailejones. | smith1987, meinzer1985 | false |
| `stiltMangrove` | Waterlogged mud has no oxygen, so these roots arch into the air to breathe, like mangrove roots. | scholander1955, osland2013 | false |
| `cushionMound` | Below freezing, ground cover hugs the warm ground as low cushions, out of the wind. | none yet | true |
| `bladderKelp` | Gas floats hold the fronds up toward the light, as kelp bladders do (in air only when it is several times denser than Earth's). | hurd2000 [unverified] | true |
| `margin` | Warm climates grow smooth-edged leaves and cold ones toothed; fossil botanists read past temperatures this way. | wolfe1979, wilf1997 | false |
| `anthocyanin` | Red pigment builds up in stressed leaves (cold, strong light, poor soil), as in autumn leaves. | chalkerScott1999 | false |
| `carotenoid` | Under strong starlight, extra yellow pigment protects the leaves. | demmigAdams1996 | false |
| `gasExchange` | With several times Earth's CO₂, leaves need few pores and veins, like the first flowering plants in the CO₂-rich Cretaceous. | woodward1987, brodribb2010 | false |
| `leafSize` | Big leaves where it is warm and wet, small where it is cold or dry: the global pattern on Earth. | wright2017 | false |
| `girth` | Stronger gravity needs thicker trunks to stand this tall without buckling. | mcmahon1973 | false |
| `granite` | Granite feeds life poorly, so plants here grow small, tough, reddish leaves. | loveless1961, chalkerScott1999 | true (our rock-to-plant link) |
| `gley` | Waterlogged mud releases dissolved iron, which bronzes leaf tips, as in flooded rice fields. | becker2005, schwertmann1993 | false |
| `airKelpFloat` | This air is about 11 times denser than Earth's, so gas floats can lift crystal fronds (speculative). | physics only | true |
| `frostFern` | Rich silicon supply makes crystals grow too fast to stay flat, so they branch at 60°, like frost on glass (speculative). | mullins1964, libbrecht2005 | true |
| `whiskerReef` | Liquid nitrogen is clear, so these crystal needles in the shallows show from the shore (speculative). | none | true |
| `habit` | Snow crystals grow as columns or plates depending on temperature; these crystals follow a similar rule (speculative). | libbrecht2005 | true |
| `film` | Thin silicon-nitride films change colour with thickness; these crusts colour as they grow (speculative). | henrie2004 | true |

Never on a card: "cold makes plants tall" (T10 is [art]), any rib/pore count, any interference-colour thickness in nm.

## 6. Appendix: what real, heritable plant evolution would need

Today's traits are plasticity plus environmental filtering, drawn as an instant equilibrium. Real evolution would make
traits **lag** the climate and differ by lineage. It would need:

1. **A flora genome per cell** in the sim's 64² grid, for example 4 genes (cap size, height, pigment, margin).
2. **Inheritance and mutation:** biomass spreading into neighbour cells carries the genome with mutation σ, a dispersal
   cellular automaton.
3. **Selection:** trait costs and payoffs inside the producer rule (DECISIONS Rule 1), e.g. big caps gain light but pay
   in the cold (Wright 2017), and smooth margins are cheaper when warm.
4. **Guardrail rulings:** the rule cap (≤ 12, one in one out), "one of every system" (a second genome), and the gene
   budget (15, full). All three need the owner.
5. **Contract change:** `SimSnapshot.flora` stride 2 → 6 per cell (64² × 6 floats ≈ 98 KB per snapshot; fine as a
   transferable at 20 Hz).
6. **The A/B gate:** DECISIONS §A metrics measure animal variety, so a plant genome may not raise any of them, and it
   could fail its own ship gate.
7. **Retuning:** the pinned demo targets (O₂, CO₂ and biomass at build end) would move.

Cost: about 6–10 h of sim work plus 2 h of art, with the demo seeds at risk. **Recommendation: against, before the 10:00
freeze.** Ship the trait layer, labelled honestly. After the hackathon, the genome version draws traits from per-cell
genome means instead of conditions, so the player would watch plants *adapt over a minute* after a slider move rather
than switch at once. That lag is the visible difference between evolution and plasticity, and it would make a strong
second demo.

## 7. Implementation work packages

All pure functions are tested with `npx vitest related --run` at the end of each package (CLAUDE.md testing rules;
no browser runs). Rendering is checked by the owner by eye.

### WP-A: trait parameters into flora-unique's per-plant function (C1, C2)
- **Files:** `src/render/floraLib/traits.ts` (new, pure): `cellEnv(cell, inputs, substrate) → CellEnv` and
  `plantTraits(env, hash) → PlantTraits` with named look constants, each with its source in a comment. Wire it into
  flora-unique's per-plant parameter function (height, crown, girth, lean, bend, twist, droop, colour shift; not landed
  on stage at 42a9865, so match its names when it does): T10 → height, T11 → girth, T5 → crown/cap scale, T7 → droop
  and bend, T1–T4/T8/T14/T16–T18 → colour shift. **Lean stays theirs:** slope tilt already ships (4c1afa3).
  New per-plant outputs: `teeth` (T6, one float) and `tint` (rgb). `place.ts` `PlantList` gains `tint` (Uint8 × 3)
  and `teeth` (Uint8). C2: `pickAlong(list, t, hash)` replaces the uniform pick for carbon mid and giant lists: each
  species shows the two body variants nearest the world-wide `hb` (dithered by ±0.45 of a step, so a window never spans three variants; an [art] climate cline),
  and the T9 density build is a hard switch at `P` = 0.45.
- **GPU path, no shader edit:** tint goes in `InstancedMesh.instanceColor` (material.ts already multiplies it in).
  Lightening (T8 pale coat) can't be a multiply, so `paint()` writes vertex colours at value ÷ 0.9 (clamped to 1) and
  the default instance colour is 0.9; a coat lifts it to 1.0. No colour ever exceeds 1, so nothing new blooms.
  `teeth` and droop ride in flora-unique's deformation attribute, weighted per vertex by the baked part weights
  `aPart` (rim, cap) from WP-B. Whole-plant tints need no weight: ink and maroon bases are so dark that a multiply
  ≤ 1 shows mostly on the pale tops. **Optional, with the WP1 owner's OK:** a luma-weighted tint in the flora material
  (top weight = smoothstep(0.3, 0.7, luma(vertex colour)), so the existing palette key decides top vs base) gives
  true top-only T1/T2 and the T14 base band; without it, T14 is cut.
- **Perf:** ~40 flops per plant, ≈ 0.3 ms per rebuild at 16k plants. Instance colour adds 12 B × cap per bucket;
  upload only the used range (`addUpdateRange`), as matrices do. **Create `instanceColor` on every bucket at startup**,
  because a first `setColorAt` mid-demo switches the pipeline variant and compiles during the run.
- **Tests:** each trait's direction (e.g. smooth-rim share rises with T, and is 0 at ≤ 1 °C and 1 at ≥ 32 °C; cap scale
  peaks warm–wet; girth rises with g); no tint hue in 165–200°; every tint channel ≤ 1; base tissue × tint stays darker
  than top tissue × tint (value inversion); the same inputs give identical arrays; a stat change changes the traits;
  `pickAlong` never returns more than two variants for one `t`; the worst-case draw test still holds.

### WP-B: new species geometry and gates (C3)
- **Files:** `species/pitcher.ts`, `species/rosette.ts`, `species/stilt.ts`, `species/kelp.ts` (carbon);
  `species/ground.ts` variant 4 (cushion); `species/crystal.ts`: `airKelpFloat`, `frostFern`, `whiskerReef`;
  T9 dense/sparse builds of `parasolTitan` and `ribFan` (pleat and gill count as a build parameter, +8 archetypes);
  `index.ts` SPECIES and MAP rows; `floraLib/gates.ts` (new, pure): `gatesFor(env, inputs)` → a gate set that
  `archetypesFor` uses to substitute named entries; `place.ts`: **one aquatic mid slot** on submerged cells inside the
  depth window and the grove field, with kelp height = depth + 0.5 m and reef height = depth − 0.5 m.
- **Part weights (`aPart`, vec2: rim, cap).** `mesh.ts` `MeshBuilder` gains a per-vertex part weight, default (0, 0);
  builders bake rim weight on cap and fan rims (teeth) and cap weight on discs and blades (droop). Tops and bases need
  no channel: they come from the palette key, through vertex colour. **Every flora geometry and every material that
  reads `aPart` must stay in step, because a missing attribute renders black:** all species builders, both
  `flora.ts` materials and their warm-up meshes, and the producer card's live view (its own materials, 1a8429a). The
  asset audit (42a9865) asserts `aPart` (itemSize 2, one per vertex) on every archetype × LOD.
- **Grammar:** carbon builders use `curl`/`bezier`/`sweep`; silicon builders only `rod` hex prisms, 60° branches,
  `build({ flat: true })`. Silicon far LOD = near.
- **Perf:** each new archetype ≤ 450 near tris (§9.1); they take existing slots, except the aquatic mid slot (≤ 1 per
  submerged cell, thinned with distance like mids). Library build +60–100 ms at startup (before Generate).
  Extra buckets are allocated at startup (≈ +40 InstancedMeshes, ≈ 2 MB of instance buffers), so a rebuild never
  creates a mesh or compiles.
- **Tests:** every new archetype builds both LODs with a foot ring and a bounded triangle count; silicon archetypes
  are flat-shaded with no curl (extend the 42a9865 asset audit); A1/A3 and A2/A3 gates are exclusive over a grid of
  inputs; new draw cases: carbon cold + low N + bright + kelp shallows ≤ 33, carbon warm shore + kelp ≤ 33, silicon
  thick air + submerged reefs + silicide ferns ≤ 33, all < 4.5M tris with nothing dropped; kelp tops within 0.5 m of
  sea level and reef tops below it; no mid on submerged cells except aquatic archetypes; the air niche is off below 5 ×
  Earth's air density; nothing on land before `lifeOnLand` (existing).

### WP-C: the substrate colour field
- **Files:** `src/render/substrate.ts` (new, pure): `substrateGrid(inputs, crust, ratchet) → Float32Array(64² × 5)`
  and `createRustRatchet()` (max O₂ this run, reset on world change); `terrainNode.ts` colorNode samples it as a 64²
  RGBA8 `DataTexture` with linear filtering, which smooths cell edges as crust.md asks (WP3 / art-world owns the file);
  `traits.ts` reads the same grid on the CPU for uptake; `visualInputs.ts` and `worlds/types.ts` for the contract (§8).
- **Perf:** 4,096 cells, recomputed at the flora rebuild cadence (4 Hz in the build, ≤ 1 Hz live); a 16 KB texture
  upload; one texture fetch and about six mixes in the ground colorNode.
- **Tests:** rust is 0 below `rustOxygen` and monotone; granite never rusts; the ratchet never decreases and resets on
  world change; gley is 1 under the sea and 0 above 4 m; ochre rises as `heatBand` falls; the rank fallback is used
  when `crust` is absent; ice cells give no uptake tint.

## 8. Contract changes to flag (logic lead + Caden)

1. `VisualInputs.crust?: { mineral: Uint8Array; minerals: { id: string; oxidises: boolean; supply: { c: number; si: number; o: number } }[]; rustOxygen: number }`,
   assembled once per world in `visualInputs.ts` from `crustMap(world, seed)` (`src/gen/crust.ts`). Optional, so WP-C
   falls back to the height-rank proxy until it lands.
2. `WorldConfig.features.producer.traits?: FloraTraitNote[]` for the card lines in §5.
3. Nothing in `SimSnapshot` and no sim change. Gravity is read from `stats.gravity` (the jump already uses it; 1 if
   absent).

## 9. Budget

### 9.1 Cost per new archetype (triangles; substitution keeps instance counts)
| Archetype | Role | Near | Far | Instances |
|---|---|---|---|---|
| A1 pitcher urn | mid | ≈ 320 | ≈ 110 | replaces ribFan/lantern slots |
| A2 woolly rosette | giant | ≈ 450 | ≈ 160 | replaces a giant (≤ 1 per 5 × 5 superblock, as now) |
| A3 stilt mangrove | mid | ≈ 380 | ≈ 140 | replaces weeper/ribFan slots |
| A4 cushion mound | ground | ≈ 120 | ≈ 48 | replaces bristle tufts (195 / ≈ 70): net saving |
| A5 bladder kelp | mid | ≈ 300 | ≈ 110 | water: new aquatic slot, ≤ 1 per cell (≈ 250–400 on carbon, ≈ 0.1M tris); air: replaces weepers |
| A6 air-kelp float | giant | ≈ 260 | = near | replaces candelabra |
| A7 frost fern | ground | ≈ 140 | = near | replaces needle tufts |
| A8 whisker reef | mid | ≈ 180 | = near | new aquatic slot, ≤ 1 per cell |
| T9 dense builds | as base | as base | as base | swap with the sparse build (world-wide) |

### 9.2 Worst-case draw calls (the cap is 33)
| World | Today | After | How |
|---|---|---|---|
| Carbon | 33 (ground 9, mid 12, giant 12) | **31** (ground 9, mid 8 + 4 gated, giant 8 + 2 gated) | the dither always shows two body variants per species, and that is what is counted: weeper {0,1,3} → 2, ribFan {0,1,2} → 2, parasolTitan {0–3} → 2, coilSpire {0,2} → 2, so mid kinds 6 → 4 and giant 6 → 4, each × 2 draws; the T9 density build is a hard switch at `P` = 0.45 (one build at a time; pure, because `P` moves smoothly); at most two gated mids (A1 or A3, plus A5) and one gated giant (A2) |
| Silicon | 18 (ground 4 kinds × near+dark = 8, shardTree 3 × 2 = 6, prismTitan 2 × 2 = 4) | **22** (ground 8 + frost fern 2, mid 6 + reef 2, giant 4) | air kelp replaces the candelabra patch-wide (world-wide gate): 0 net; per-cell supply picks stay inside the dim list's 3 shardTree kinds: 0 net; frost fern is per cell, so it adds its near + dark (2); the reef adds 2. If supply branching also pulls in shardTree#0: 24 |

Triangles: substitution changes per-instance cost by ≤ ±25%, and the new aquatic slots add ≈ 0.1M, so the worst case
stays well under 4.5M. The test in `floraLib.test.ts` gains the new cases from WP-B.

## 10. Honesty box

- **Render-only (all of it):** every trait, archetype and substrate colour here. The sim has only per-cell mat and
  canopy biomass; nothing is read back.
- **Earth patterns, said as such:** pitchers (the sim has no plant nitrogen limit), gley bronzing, granite poverty (the
  crust's supply multiplier reaches the sim only if crust-core's A/B passes; otherwise it is look-only and the card's
  `granite` note must drop "feeds life poorly").
- **[art]:** base hues, cold → tall (owner rule; Earth runs the other way), the climate cline that orders body
  variants, the root-depth blend, the vitality chroma, and every threshold not tied to a source.
- **Speculative:** every silicon trait and archetype, and gas floats in air on both worlds.
- **State:** the rust ratchet (declared in crust.md); everything else is a pure function of the current inputs.
- **Unverified:** cushion-plant source, kelp-float source, β-Si₃N₄ habit, dopant-colour source, the margin-formula
  coefficients, the light-versus-temperature numbers, and the Nitrogen setting at which carbon air reaches 5 ×
  Earth's density. DOIs were checked for bibliography only.

## 11. Iteration log (condensed)

**Round 1: proposal.** Eighteen traits, all per cell; nine archetypes, including nickel-blue latex and wind-stout trees;
the ground field; uniform variant picks.
**Critique:**
- Grounding: cold → tall contradicts Moles 2009; wind stoutness from air density has no grounded direction (wind speed
  on cold dense worlds is unknown); the nickel latex invented an ultramafic rock the crust doesn't model.
- Readability: rib and pore density read only near.
- Budget: carbon is already at 33 draws, so per-cell topology traits and new archetypes would blow it.
- Contradiction: pitchers imply a sim nitrogen limit that doesn't exist; un-rusting ground would contradict crust.md's
  ratchet; interference blues drift into the cyan accent band.

Scores (1–5): grounding 3, readability 3, budget 2, never-contradict 3.
**Revision:** tagged cold → tall [art] and banned it from cards; dropped wind stoutness and nickel; added the
world-wide-only C2 rule, exclusive gates and substitution; card copy for Earth patterns; the ratchet; the hue-band rule.

**Round 2: critique.**
- Gates in `heatBand` meant mangroves never appeared at the default 15 °C (`hb` 0.38). Carbon gates now use °C.
- Submerged kelp mids could add thousands of instances. Now ≤ 1 per cell, inside a depth window, with a test.
- A late `instanceColor` switches the pipeline mid-demo. It is now created on every bucket at startup.
- Pale coats can't be a multiply. They now use headroom paint (÷ 0.9).
- A dithered density build doubled buckets. It is now a hard switch.
- The oxygen lever on plants is weak. Stated plainly; the strong oxygen beat is the below-1 % dark-basalt start.

**Round 3: flora-audit's constraints.**
- A ±0.6-step dither window could span three variants. It is now ±0.45.
- Every variant is its own draw, so draws are now counted per kind per LOD. The air-kelp substitution is patch-wide,
  so it adds nothing, and silicon's worst case falls from 26 to 22.
- Shore and aquatic gates now test the plant's own ground height, not the cell centre. Tethered floats take the
  mid/giant sink rule.
- Per-vertex deforms read the baked `aPart` weights, and the audit asserts them. The T14 base band depends on the
  optional luma-weighted tint.

Final scores (after rounds 2 and 3): grounding 4, readability 4, budget 4, never-contradict 5. Still below 5: grounding (several [art] axes and
unverified sources remain) and readability (T6, T9 and T14 are near-only and are never demo beats).
