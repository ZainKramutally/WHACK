# 02 · Alien and silica geology: other solvents, other temperatures, life-built rock

Axis: which landforms appear under each of our **Sea** presets (Water · Ammonia · Methane · Acid), what drives them, what colours they take, and which silica or life-built structures can stand in for the board's arches, spires, honeycomb and terraces.
Data: [`../data/alien-geology.json`](../data/alien-geology.json). Tags and status labels follow `research/silicon-life/README.md`. DOIs were checked against Crossref on 2026-11-07. Growth rates tagged `[POP]` were not checked against a primary source.

---

## A. Planetary analogues per Sea preset

### Methane → TITAN (94 K, 1.5 bar, methane–ethane liquids)

| Landform | Driver | Colour | Evidence |
|---|---|---|---|
| Polar seas and lakes (Kraken, Ligeia) | Methane cycle: rain, runoff, ponding | Radar-black; the liquid is colourless | Stofan 2007 doi:10.1038/nature05438 `[PEER]`; Hayes 2016 doi:10.1146/annurev-earth-060115-012247 `[REVIEW]` **consensus** |
| Branching river channels, rounded ice cobbles | Methane rain eroding water-ice bedrock | Dim orange-brown ground | Tomasko 2005 (Huygens) doi:10.1038/nature04126 `[PEER]` **consensus** |
| Linear dunes ~100 m high, equatorial sand seas | Wind piling organic (tholin-derived) sand | Dark | Lorenz 2006 doi:10.1126/science.1123257 `[PEER]` **consensus** |
| **Labyrinth terrain**: dissected plateaus cut by deep valleys | Dissolution plus erosion of organic-rich uplands | Radar-bright plateaus, dark valleys | Malaska 2020 doi:10.1016/j.icarus.2020.113764 `[PEER]` **plausible/theorised** (mechanism) |
| Sharp-edged lake depressions (karst-like) | Organics dissolving in liquid hydrocarbons. At Titan timescales this behaves like salt or carbonate karst on Earth | n/a | Cornet 2015 doi:10.1002/2014JE004738 `[PEER]` **plausible/theorised** |
| Cryovolcano candidates (Sotra Patera, Doom Mons) | Possibly ammonia–water extrusion | n/a | Lopes 2013 doi:10.1002/jgre.20062 `[PEER]` **disputed** |
| Orange haze sky | UV and charged-particle photolysis of CH₄ + N₂ makes tholins | Orange-brown | Hörst 2017 doi:10.1002/2016JE005240 `[REVIEW]` **consensus** |

**Control map.** Sea=Methane, Heat=Cold. **Light is the real driver of tholin stain:** photolysis needs UV, so a bright methane world goes orange (eco-05) and a dim one stays frost-pale (eco-04, eco-15). R3 and R4 already say this, and it can be tagged **[sci]** `[INFERRED]` from Hörst 2017. Time controls karst depth, how dissected the labyrinth is, and how far the dunes spread. Recipe: Titan's "rock" is water ice and organics, not silicate, so silicon bedrock there is **[game]**.
**Note on white rivers.** Liquid methane is transparent. Titan's rivers would look dark or glassy under an orange sky. A white river reads as frost or methane **[game]**, while the rivers themselves are **[sci]**.

### Acid → VENUS (737 K surface, 92 bar; H₂SO₄ clouds at ~48–70 km)

| Landform | Driver | Colour | Evidence |
|---|---|---|---|
| **Tesserae**: folded, faulted highland plateaus | Crustal deformation. Low IR emissivity hints at felsic (silica-richer) rock | n/a | Ivanov & Head 2011 doi:10.1016/j.pss.2011.07.008 **consensus**; Gilmore 2015 doi:10.1016/j.icarus.2015.04.008 **plausible/theorised** (felsic) |
| **Pancake domes**: 145 found, mean 23.8 km wide, ~700 m high | Viscous lava, single eruptions | n/a | Pavri 1992 doi:10.1029/92JE01162 `[PEER]` **consensus** |
| **Coronae**: ring uplifts with concentric fractures | Mantle plumes, then sagging | n/a | Stofan 1992 doi:10.1029/92JE01314 `[PEER]` **consensus** |
| **Highland "metal snow"**: radar-bright caps above a set altitude | Volatile metal compounds condense in cooler highlands. Pb and Bi sulfides proposed | Bright (radar) | Schaefer & Fegley 2004 doi:10.1016/j.icarus.2003.11.023 `[PEER]` **plausible/theorised** |
| Chemically weathered crust | CO₂/SO₂ gas–rock reactions at 737 K | Dark grey basalt under orange-filtered light | Gilmore 2017 doi:10.1007/s11214-017-0370-8 `[REVIEW]` **consensus** (process); details **disputed** |
| Cloud deck | Sulfuric-acid droplets plus an unknown UV absorber | Pale lemon-cream | NASA fact sheet `[POP]` **consensus** |

**Control map.** Sea=Acid. **There is no acid sea on the surface.** Our Acid world is the cloud deck (~300–350 K at 50–55 km), and the surface is the Heat-max extreme. That is the honest framing. Light: bright and diffuse, so shadows are soft. Time: frost caps and weathering rind. Recipe Si+O-heavy maps to felsic tesserae. Sulfur-yellow crusts (R3) are best supported by Earth's acid-sulfate fumaroles. On Venus itself the yellow is the clouds.

### Ammonia → ICY MOONS (Triton 38 K; ammonia–water eutectic ~176 K)

| Landform | Driver | Colour | Evidence |
|---|---|---|---|
| Ammonia–water cryolava flows and domes | NH₃ lowers water's melting point by ~100 K, and the melt is viscous | n/a | Kargel 1992 doi:10.1016/0019-1035(92)90118-Q `[PEER]` **plausible/theorised** |
| Triton geyser plumes (~8 km) with dark wind streaks | Solar-heated subsurface N₂ venting | Pinkish N₂/CH₄ ice, dark streaks | Soderblom 1990 doi:10.1126/science.250.4979.410 `[PEER]` **consensus** (plumes) |
| Europa **chaos terrain**: ice rafts in a jumbled matrix | Shallow melt lenses collapse the shell | Cream ice, red-brown lineae | Schmidt 2011 doi:10.1038/nature10608 `[PEER]` **plausible/theorised** |
| Enceladus tiger stripes and plumes | Tidal heating venting the ocean | Brilliant white, blue-green stripes in enhanced colour | Porco 2006 doi:10.1126/science.1123013 `[PEER]` **consensus** |
| **Enceladus silica nanoparticles**: hot seafloor water–rock reaction (>90 °C, alkaline) | Silica dissolves in hot water and precipitates as it cools | n/a | Hsu 2015 doi:10.1038/nature14262 `[PEER]` **consensus**; H₂ evidence Waite 2017 doi:10.1126/science.aai8703 |

**Control map.** Sea=Ammonia (cryolava). Enceladus and Europa also fit Water at Cold. Heat=Cool; Light=Dim. The violet and plum palette is **[game]**, since no ammonia world has been seen with it. Triton's pink is the closest real colour.

### Water (old, iron-rich, dried) → MARS (~210 K mean)

| Landform | Driver | Colour | Evidence |
|---|---|---|---|
| Layered sedimentary rock (crater fills, canyon walls) | Ancient water deposition, then wind erosion | Rust and ochre bands | Malin & Edgett 2000 doi:10.1126/science.290.5498.1927 `[PEER]` **consensus** |
| Opaline silica nodules and digitate "cauliflower" (Home Plate) | Volcanic hydrothermal silica (hot spring or fumarole) | White | Squyres 2008 doi:10.1126/science.1155429 **consensus**; Ruff & Farmer 2016 doi:10.1038/ncomms13554 **plausible/theorised** (biosignature-like) |
| Recurring slope lineae | Seasonal dark streaks. Now mostly dry granular flow | Dark streaks | McEwen 2011 doi:10.1126/science.1204816; Dundas 2017 doi:10.1038/s41561-017-0012-5 **disputed** (water) |
| Dust and dunes | Iron-oxide dust | Red-orange ground, butterscotch sky, blue sunsets | NASA `[POP]` **consensus** |

**Control map.** Sea=Water, Time=Very old. Red stain plus layered walls gives eco-01 and eco-10. Our "Hot" dial on eco-10 is **[game]**, because real Mars is cold. Recipe Si+O maps to silica deposits.

### No preset → LAVA WORLDS (55 Cnc e dayside ~2700 K, nightside ~1400 K)

| Landform | Driver | Colour | Evidence |
|---|---|---|---|
| Dayside magma lakes or ocean | Tidal lock plus extreme irradiation | Incandescent orange-yellow | Demory 2016 doi:10.1038/nature17169 `[PEER]` **plausible/theorised** |
| Outgassed secondary atmosphere (CO/CO₂) | Volcanic outgassing from the magma | n/a | Hu 2024 doi:10.1038/s41586-024-07432-x `[PEER]` **plausible/theorised** |
| By Earth analogy: lava tubes, skylights, natural bridges, obsidian, pumice | Crusting over flowing lava. Quenching makes glass | Black glass, grey-black rock | `[INFERRED]` |
| CoRoT-7b, first rocky super-Earth with a measured radius | Close-in, so likely molten | n/a | Léger 2009 doi:10.1051/0004-6361/200911933 `[PEER]` |

**Control map.** Heat at maximum, where Sea stops mattering because the "sea" is molten silicate. This is the most literal "silicon world" (Si+O melt). We could ship it as an easter egg at the far end of the Heat dial.

---

## B. Silica-specific and life-built structures

| Structure | Mechanism | Growth rate | Shapes | Colours | Status |
|---|---|---|---|---|---|
| **Sinter and geyserite terraces** (Yellowstone, El Tatio) | Silica-saturated water cools and evaporates, leaving opal-A. Microbial mats template it | **≤2.5 kg/m²/yr** at El Tatio (Nicolau 2014 doi:10.1016/j.jvolgeores.2014.06.012) | Terraces, aprons, spicules, knobby "cauliflower", digitate fingers | White and grey opal. Orange, yellow and green mats banded by temperature | **consensus** (Campbell 2015 doi:10.1016/j.earscirev.2015.05.009 `[REVIEW]`) |
| **Opal** | Ordered silica spheres diffract light | Slow; timescale **disputed** | Veins, nodules, pseudomorphs of shell and bone | Milky white with iridescent flashes | **consensus** (Sanders 1964 doi:10.1038/2041151a0) |
| **Chert / jasper** | Biogenic or chemical silica recrystallises to microquartz | Myr | Nodules, ribbon beds | Grey and black. **Red when hematite-stained (jasper)** | **consensus** |
| **Banded iron formations** | Fe oxides alternate with chert in silica-saturated Archaean seas as O₂ rose | Mainly 2.8–1.85 Ga; rate **disputed** | mm-to-m stripes, gorge walls | **Red jasper and silver-black hematite** | **consensus** (Konhauser 2017 doi:10.1016/j.earscirev.2017.06.012 `[REVIEW]`) |
| **Diatomite / radiolarite** | Plankton build opal shells, which rain down as ooze and lithify | ~mm–cm/kyr; ~240 Tmol Si/yr biogenic production | **Perforated honeycomb discs, lattice spheres, spiked cages** | White diatomite, red-brown radiolarite | **consensus** (Tréguer & De La Rocha 2013 doi:10.1146/annurev-marine-121211-172346) |
| **Glass-sponge reefs** (British Columbia) | Fused opal skeletal lattices. Larvae settle on dead skeletons | ~cm/yr per sponge `[POP]`; reefs ~9 kyr, up to ~20 m `[POP]` | Vase and finger lattices, glassy mounds | Translucent cream | **consensus** (Krautter 2001 doi:10.1007/BF02668178) |
| **Silica reefs vs coral reefs** | Siliceous sponge reefs declined after the Mesozoic as diatoms drew down seawater silica | n/a | n/a | n/a | **plausible/theorised**, well cited (Maldonado 1999 doi:10.1038/44560) |
| **Stromatolites** (Shark Bay) | Mats trap and bind sediment and precipitate micrite | ~0.3–0.5 mm/yr `[POP]` | Domes, columns, clubs, laminated pillars | Grey-brown, dark mat tops | **consensus** (Suosaari 2016 doi:10.1038/srep20557; Reid 2000 doi:10.1038/35023158; 3.43 Ga Allwood 2006 doi:10.1038/nature04764) |
| **Chemical (silicate) gardens** | A metal-salt seed in water-glass grows a semipermeable membrane. Osmotic bursts extrude hollow tubes | **Seconds to minutes** | Hollow tubes, branching spires, bulbs | **The metal's colour**: Cu blue, Fe orange, Ni green, Ca/Zn white | **consensus** (Barge 2015 doi:10.1021/acs.chemrev.5b00014 `[REVIEW]`) |
| **Silica–carbonate biomorphs** | Ba/Sr carbonate co-precipitates with silica at high pH | Hours | Helices, twisted ribbons, worms, coral-like sheets | White | **consensus**. A caution against reading shape as life (García-Ruiz 2003 doi:10.1126/science.1090163) |
| **Lost City chimneys** | Serpentinization fluid (40–90 °C, pH 9–11) meets seawater and precipitates carbonate | Built over ~tens of kyr | **Towers 30–60 m**, porous flanges. **Microbes live in the warm porous interiors** | White and cream | **consensus** (Kelley 2001 doi:10.1038/35084000; 2005 doi:10.1126/science.1102556) |
| **Black smokers** | ~350 °C sulfide fluid quenches | Tens of cm/day `[POP]` | Hollow chimneys, spires | Black and rust | **consensus** (Spiess 1980 doi:10.1126/science.207.4438.1421) |
| **Phytolith soils** | Plants deposit opal in their cells, and it persists after the plant rots | Plant lifecycle | Microscopic glass cells | Colourless | **consensus** (Alexandre 1997 doi:10.1016/S0016-7037(97)00001-X) |

**Generator takeaways** `[INFERRED]`:
1. Heat sets sinter colour bands, because mats zone by temperature.
2. Time sets reef and stromatolite height (mm/yr) and BIF stripe count.
3. Recipe toward Si+O switches carbonate reefs (C+O) to glass-lattice reefs (Si+O). Maldonado 1999 is the real-world precedent: silica supply decides whether silica reefs exist.
4. Chemical gardens are the fast end (seconds), so they can be a "first stone" animation.

---

## C. Board shapes → most credible real analogue

| Board shape (pins) | Best real analogue | Strength |
|---|---|---|
| **Porous bone spires** (eco-14, eco-07) | Lost City carbonate towers (30–60 m, porous, inhabited); radiolarian and glass-sponge lattices | Strong |
| **Honeycomb** (eco-09 caps, eco-14) | Diatom frustules and radiolarian skeletons, which are real silica honeycomb | Strong |
| **Lantern-lit pores** (eco-12, eco-14) | Microbes do live inside chimney pores, but they don't glow there. The glow is **[game]** | Shape strong, glow invented |
| **Red canyons / rust rings** (eco-01, eco-10, eco-13) | BIF and jasper (iron-stained silica stripes); Mars layered deposits | Strong |
| **Terraces** | Sinter and geyserite terraces | Strong |
| **Frost arches** (eco-04) | Titan karst and labyrinth dissolution, by analogy to Earth karst bridges; lava-tube natural bridges | Moderate (`[INFERRED]`; no arch imaged on Titan) |
| **White rivers** (eco-15) | Titan's methane rivers are real, but the liquid is clear and the white is **[game]** | River strong, colour invented |
| **Tubes / towers growing fast** | Silicate chemical gardens | Strong |
| **Sulfur-yellow acid crusts** | Venus clouds are yellow. Surface crusts come from Earth's acid fumaroles, not from Venus | Moderate |
| **Snow-capped highlands** | Venus metal frost | Moderate (plausible) |

### Say this on a slide (≤8)

1. "Titan has rain, rivers, lakes and dunes. The rain is methane and the sand is organic smog." (Tomasko 2005, Lorenz 2006, Stofan 2007)
2. "On a methane world, sunlight paints the ground orange. Titan's haze is made from methane by light." (Hörst 2017)
3. "Venus's mountains are capped with metal frost: a 'snow' of lead and bismuth compounds is the leading idea." (Schaefer & Fegley 2004, *proposed*)
4. "Saturn's moon Enceladus sprays silica grains that point to hot water reacting with rock under its ice right now." (Hsu 2015)
5. "Mars has white opal-silica fingers that look just like hot-spring structures in Chile's Atacama." (Ruff & Farmer 2016)
6. "Lost City's white towers stand 60 m tall, and microbes live inside their warm pores." (Kelley 2005)
7. "Earth's red-striped canyons are silica stained by iron as the planet first got oxygen." (Konhauser 2017)
8. "Glass-sponge reefs still grow off Canada. Silica reefs once ruled the seas until diatoms used up the silicon." (Krautter 2001, Maldonado 1999)

**Avoid on slides:** "acid seas on Venus" (they're clouds), "Titan's white rivers", "glowing pores are real", any cryovolcano as confirmed, any RSL "flowing water".
