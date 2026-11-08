# Environments: from primordial soup to palette

An art-layer exploration in `mockups/red-world/`. The player picks an element and sets Temperature, Nitrogen and Oxygen, and the look of the world follows from that chemistry. The Red World (`docs/ART_DIRECTION.md`) is one sample point: the **Rust World**, a high-iron, oxidised (hematite) world. This doc covers the rules, the seven named sample points, and notes on porting it to the app. Caden picks which ones to keep.

- **Code:** `mockups/red-world/src/env/derive.ts` (`environmentFrom(soup)`, pure, no three.js), `src/env/palette.ts` (roles, OKLab maths, `RED_WORLD`), `src/env/sealevel.ts`, `src/env/active.ts` (URL → environment).
- **Tests:** `src/env/derive.test.ts`. They cover determinism, every palette key present and valid, Rust = Red World, continuity along every slider, phase-only jumps, chemistry claims, `?soup` parsing and sea-level continuity.
- **View it:** `?env=<name>` (rust, archean, hothouse, snowball, deepair, cryo, critical), or `?soup=c,T,N,O[,light[,sea]]` for any soup (`c`/`s` for the element; with `?env` it overrides that sample point). Add `?label` for an on-screen soup and rationale line.
- **Captures:** `python3 scripts/env_sheet.py [--fps]` writes `design/iteration/{stamp}-red-env/sheet.png` (hero + 200 m fly view per environment, labelled) and `thumbs.png` (the thumbnail-distinctness check). `npx vite-node scripts/print-env.ts` prints the drivers, material weights and palette for each environment.

## 1. The rule: drivers → materials → roles

`Soup` mirrors the app's `VisualInputs`: `{ element, temperatureC, nitrogenX, oxygenPct, light, frozen, seaCover }`.

**1. Drivers.** The soup becomes continuous drivers, mostly 0..1 (`driversFrom`):

| Driver | From | Meaning |
|---|---|---|
| `ox` | O₂: carbon smoothstep 0.5→12 %; silicon 0.05→3 % | free-oxygen oxidation of the ground |
| `wet` | water vapour pressure (Magnus–Tetens) × sea cover, log scale (carbon only) | humidity |
| `heat` | carbon 35→105 °C | hot side |
| `frost` | carbon 6→−32 °C; silicon −200→−214 °C (N₂ ice) | ice cover |
| `pressureBar`, `thick` | carbon: 0.79·N + O₂ + H₂O partials; silicon: N₂ vapour pressure (Clausius–Clapeyron through the NIST boiling and critical points, 3.6 bar at −183 °C). `thick` = log(P) on a 1 → 60 bar scale | air thickness |
| `dim` | −log₁₀(light)/2 | 1 at 1 % sunlight |
| `crit` | silicon −172→−149 °C | approach to N₂'s critical point (−147 °C) |

**2. Materials.** Each palette role is an **OKLab-weighted mix of real materials**. The weights are products of the drivers, so nothing is looked up by world name:

- **Ground ramp** (`redLight`, `red`, `crimson`, `maroon`, `ink`, `shadow`) comes from minerals: hematite, goethite, ferrous (green rust/greenalite), wet basalt, snow, Si₃N₄/silicide, silica, opal-crust and N₂ frost.
- **Sky** (`skyZenith`, `skyHorizon`, `haze`) comes from the air: white aerosol, tholin haze, steam, cold clear air, deep air, 3.6 bar N₂ Rayleigh scattering, and critical opalescence.
- **Plant highlights** (`bone`, `blush`) plus a flora tint come from pigments: red pigments, retinal purple, snow algae, thermophile carotenoids, crystal tissue, and dark dim-light pigments.
- **Accent** (`glow`, `glowDeep`): each mineral carries its own complement (its hue rotated by the hematite → cyan offset, so hematite gives exactly `#3ff5e0`), and the accent is mixed with the same weights. The accent stays the ground's complement on every world, which keeps the family together.

**3. Non-colour outputs** come from the same drivers:

- **Fog:** density, haze and start distance rise with `thick`, steam and `crit`.
- **Moons:** each moon's strength is 1 − k·(optical depth), so thick air hides the small moon first. Moon tint takes on the sunlight colour.
- **Sun:** colour shifts amber in thick air and cool on silicon. Intensity falls with `dim`.
- **Ground character:**
  - `sheen`: specular hematite or silicide glints.
  - `banding`: BIFs, strongest through the oxidation transition.
  - `crust`: Si₃N₄ crystal clusters.
  - `deadBands`: shore crust rings.
  - `prismatic`: hot-spring pigment rings.
  - `ice` and `relicIce`.
  - `rock`: the bedrock under any frost, shown on steep faces.
- **Sea:** solvent colour (shallow and deep), clarity, frozen state and gloss.
- **Flora:** facet (silicon), height scale (cold makes tall), lantern bias (glow pays when dim) and sway (crystal and frozen tissue is stiff).
- **Glow strength:** ×1 → ×2.1 with `dim`.

**Continuity.** All weights are smooth functions of the sliders. The test sweeps O₂, T, N, sea cover, light and silicon's T and O₂ in 400 steps each, and asserts every palette step is < 0.03 OKLab and every scalar step < 0.08. There are only two hard jumps: `frozen` (the sea becomes ice) and the element choice. The rationale sentence names the dominant mineral and the dominant air, so it changes in discrete steps. It is text, not a stat.

**Rendering** (all in the mockup, all from the `Environment`):

- `PALETTE` (contracts.ts) *is* `ENV.palette`, so every vertex colour, sky and fog follows it.
- `material.ts` adds:
  - `surface: 'ground'`: metallic crust patches, noise-normal glints (HDR, so the brightest catch a 1 px stepped bloom), shore crust rings and hot-spring prismatic rings.
  - `surface: 'rock'`: BIF jasper/steel/chert bands on cliffs, and bedrock showing on steep snow faces.
  - A flora pigment colouriser.
  - `facet`: flat normals from screen derivatives, at no geometry cost.
- `sea.ts`: a flat level from `seaCover`. The bed shows through, depth absorbs, and the grazing sky mirror is broken into stepped ripple streaks (that is what makes water read in pixels). Frozen seas are cracked opaque ice.
- `crystals.ts`: instanced hexagonal-prism clusters on the shores and beds, capped at 1,800.
- `landforms.ts`: the arch and ribs become water-ice bedrock with layer bands on silicon.
- `sky.ts`: moon strength and tint.

## 2. Named environments (sample points only)

Hex swatches are the derived palette, in order: ground `redLight/red/crimson/maroon/ink`, shadow, sky `zenith/horizon/haze`, plants `bone/blush`, accent `glow`.

| Name (`?env=`) | Soup | Ground | Shadow | Sky | Plants | Glow |
|---|---|---|---|---|---|---|
| **Rust World** `rust` | carbon, 15 °C, N 1×, O₂ 21 %, light 1, sea 0 | `#ff5b36 #e8341f #a8132a #5c0a1e #22060f` | `#5a1040` | `#eef0f4 #f3eef8 #e4daef` | `#f4e6dc #f2a2a0` | `#3ff5e0` |
| **Archean Haze** `archean` | carbon, 22 °C, N 1.5×, O₂ 0.2 %, light 0.8, sea 0.3 | `#c2cc94 #8fa06c #5c7254 #2e3e36 #0e1612` | `#4a1a52` | `#e7ad7b #f8dab0 #f0bf90` | `#e7d9f2 #ba87d7` | `#bdceff` |
| **Hothouse** `hothouse` | carbon, 88 °C, N 1.6×, O₂ 12 %, light 1.2, sea 0.35 | `#c57c59 #9f533a #6e332c #3c1a1b #16080a` | `#3d1d41` | `#e6dbd3 #f4ebdf #eadccc` | `#f9ebd1 #f4b065` | `#33f2f5` |
| **Snowball** `snowball` | carbon, −38 °C, N 1×, O₂ 21 %, light 0.75, sea 0.3, frozen | `#fafcfe #dfe9f4 #9bb6da #4a68a4 #121c40` | `#3456a8` | `#c1d5ed #eef4fa #dce8f4` | `#f7eff2 #eb9cb7` | `#ffb687` |
| **Deep Air** `deepair` | carbon, 40 °C, N 60×, O₂ 18 %, light 1, sea 0.15 | `#fe6b38 #e5451f #a52127 #5a101c #21070d` | `#571342` | `#eaa38c #f5c8af #f2bba3` | `#f4e6dc #f2a29f` | `#3df4e6` |
| **Cryo Silicon** `cryo` | silicon, −183 °C, N 40×, O₂ 0, light 0.01, sea 0.3 | `#f4eefa #d8c8ee #7c5cc8 #3a2478 #100828` | `#2a2272` | `#2c1f6e #ac98e2 #9a86d6` | `#f6f8ff #9fcff2` | `#f1d75c` |
| **Critical Shore** `critical` | silicon, −152 °C, N 60×, O₂ 0, light 0.012, sea 0.12 | `#fdf2f4 #ebd4df #b288ab #5c3d70 #1c1028` | `#492c74` | `#b2a1d4 #e8d9ed #e5d5eb` | `#f6f8ff #9fcff2` | `#9fee96` |

**Rationale and honest tags:**

- **Rust World.**
  - Free O₂ rusts iron to hematite, so the ground is red [sci].
  - Specular hematite (specularite) has a metallic lustre, so dark steel crusts on the ground glint [sci mechanism].
  - Cliffs carry banded iron formations: jasper red, steel hematite/magnetite and pale chert, which on Earth formed as O₂ met ferrous iron, about 2.5–1.8 Ga [sci].
  - The white sky is fine bright aerosol, which scatters all wavelengths about equally (Mie) [sci mechanism; the white-sky choice is game].
  - The crimson and bone flora is game.
- **Archean Haze.**
  - With no free O₂, iron stays ferrous: green-grey green rust and greenalite [sci].
  - Methane photochemistry makes an orange organic haze (Archean "orange haze", Arney 2016) [sci].
  - The Fe(II)-rich sea reads green (Matsuo 2025) [sci].
  - Purple flora comes from retinal phototrophs ("Purple Earth", DasSarma 2018) [speculative].
  - The accent is the ground's complement, a pale periwinkle [game].
- **Hothouse.**
  - Wet heat darkens bare basalt and hydrates any rust to ochre goethite [sci].
  - A steam deck whitens the sky and thickens the fog, and the small moon fades [sci].
  - Hot pools carry **prismatic rings**: pigment bands set by temperature as the water cools away from the source, from turquoise water through cream and orange carotenoid mats to red-brown (Grand Prismatic Spring) [sci analogue].
  - Flora is tinted thermophile orange [sci analogue].
- **Snowball.**
  - Water ice and snow cover the ground. Ice absorbs red, so shadows and deep ice go blue [sci].
  - Steep faces show the oxidised bedrock under the snow, so the red cliffs keep the family [sci].
  - Dry cold air shows a thin blue sky [sci].
  - The frozen sea is cracked ice [sci].
  - Pink flora comes from "watermelon snow" astaxanthin algae [sci].
  - The amber accent is the complement of ice blue [game].
- **Deep Air.**
  - About 48 bar of air (N 60×) strips blue from the sunlight, as at the Venus surface, so the light is peach-amber [sci].
  - Heavy haze, no moons visible [sci].
  - Ground is still hematite [sci].
  - The thick-air greenhouse puts it at 40 °C [sci direction, game value].
- **Cryo Silicon** (the showcase; everything here is [speculative] unless tagged).
  - No oxygen, so silicon stays in nitride and silicide crusts. Silicides are metallic [sci], hence the sheen.
  - The 3.6 bar N₂ sky under a star at 1 % sunlight scatters violet [sci mechanism], pushed toward lilac to stay in the family [game]. The zenith goes deep indigo (value inversion: pale ground under a dark sky).
  - Arches and ribs are relic water-ice bedrock with layer bands (CLAUDE.md step 3).
  - Hexagonal Si₃N₄ crystal clusters sit at the sea margin (β-Si₃N₄ is hexagonal [sci]; the crusts are M2 precipitate).
  - The liquid N₂ sea is clear and colourless [sci], so it shows the bed and mirrors the violet sky in ripple streaks.
  - Flora is faceted, rigid and pigment-free.
  - Glow from darkness is ×2.1, with a gold accent (the complement of violet) [game rule from DECISIONS].
- **Critical Shore** [speculative].
  - Near N₂'s critical point (−147 °C), density fluctuations scatter all colours and the air turns milky (critical opalescence) [sci mechanism].
  - Pressure is about 27 bar, and both moons are hidden.
  - The seas have shrunk to pools ringed by pale dead crust bands (CLAUDE.md "dead crust bands") over opal-rose crusts. The crystal fields are denser.
  - The mint accent is the complement of rose [game].

**Thumbnail check** (`thumbs.png`, 240 px each): all seven are distinct.

- Rust: red under white.
- Archean: olive and purple under orange.
- Hothouse: turquoise pool, brown ground, beige sky.
- Snowball: white and blue, with red cliffs.
- Deep Air: red under peach.
- Cryo: mid-violet with gold sparks.
- Critical: milky rose-lilac.

Every frame keeps the same hero composition, pixel pass, ink outline, sky gradient and moons (where the air allows), and a one-accent rule.

**Art-director notes (still weak):**

- Deep Air reads as "Rust at dusk". Its water is olive. It needs its own landform cue, such as low haze layers.
- Hothouse is iconic from the air (the prismatic pool) but beige-brown from the hero eye.
- Cryo's relic ice arch dissolves into the fog at 2.7 km, so ice only reads in the fly and side views.
- Critical's hero is low-contrast by design, but a darker anchor would help.

## 3. Iteration log

- **r1:**
  - Water read as flat lawn everywhere.
  - Silicon crystals 8 m tall swamped the foreground.
  - Rust metal patches read as grey smears.
  - Critical was washed out (fog density 4.2).
- **r2:**
  - Water: darker body, sky mirror broken into stepped horizontal ripple streaks, bright shore line.
  - Crystals scale down near the camera, big clusters only beyond 160 m, paler lilac-white bodies.
  - Metal: finer, darker steel patches and lower glint thresholds.
  - New hot-spring prismatic rings.
  - Fog start depends less on thickness.
  - Label font supports ₂.
- **r3:**
  - Silicon zenith deepened.
  - Ferrous and oxic water more saturated.
  - Glints are now HDR.
  - BIF contrast up.
  - Critical's crystal density down.
- **perf:**
  - Silicon dropped to 40 fps.
  - Cause: flat-shading by de-indexing the flora (×3 vertices, plus the shadow pass) and 7.7k shadow-casting crystal clusters.
  - Fix: facets come from `dFdx/dFdy` in the shader, crystals are capped at the nearest 1,800 with simpler prisms and no shadow casting.
  - All seven environments now run at 60 fps best-of-3 at 1920×1080.

## 4. Porting notes (for `src/render/palette.ts` `lookPalette(inputs)`; don't port yet)

- `derive.ts` and `palette.ts` are pure TypeScript with no imports beyond each other, so copy them as they are. Map `VisualInputs` to `Soup`:
  - `element` = `lookKind(world.composition)`
  - `temperatureC` = `stats.temperature`
  - `nitrogenX` = `stats.nitrogen`
  - `oxygenPct` = `stats.oxygen`
  - `light`, `frozen` and `seaCover` from the inputs of the same names
- **Pressure.** The app has a real `stats.pressure`. Pass it and use it instead of the mockup's estimate in `driversFrom` (`pressureBar`). Same for silicon's vapour pressure, which the app already derives from `models.ts`. The mockup's estimates are there only so the mockup runs standalone.
- **Palette and star dimming.** `LOOK_PALETTES.carbon` = `environmentFrom(rust)` exactly. `LOOK_PALETTES.silicon` is close to the `cryo` ground and sky (same nitride ramp; the zenith here is deeper, and the glow is gold, not ice-cyan). That is a choice for Caden. `lookPalette` already dims by star brightness; `environmentFrom` handles dimness only through `dim` (zenith, intensity, glow). Don't apply both, or silicon double-darkens: drop the `dim` zenith and intensity terms, or `skyStyle`'s scaling.
- **Live slider changes.** `environmentFrom` is continuous, so the app can call it every snapshot and lerp uniforms. Vertex colours baked from `PALETTE` at build time (flora, landforms) would then need a per-role remap in the material, or a rebuild when a role drifts more than about 0.02 OKLab. The mockup only reads it at load.
- **Sea level.** `sealevel.ts` compresses `seaCover` ×0.5 and caps it below the hero camera [game, mockup only]. The app already has the real `seaLevel` from the terrain sampler, so use that.
- **Shader features** to port with the world material, each a uniform:
  - `sheen`, `banding`, `ice`, `deadBands`, `prismatic`, `seaLevel`, `floraTint`/`floraTintAmt`
  - the `facet` flag
  - the sea's ripple-streak mirror
- **Contract.** Palette keys are unchanged (`PALETTE_KEYS` = the app's `LookKey`). `Environment` adds non-palette fields that the app's `VisualInputs` → look path doesn't have yet. This needs the design partner's OK if it becomes part of the data contract.
