# Sources verified (issues #9 and #26)

Checked 2026-11-07. Method: every DOI was fetched from the Crossref API (`api.crossref.org/works/<doi>`) and the title, authors, year, journal, volume and pages compared with `src/worlds/sources.ts`. Claims were then spot-checked against the abstract where Crossref returns one. Nitrogen and water data come from the NIST Chemistry WebBook (`webbook.nist.gov`). No other sites were used, so **full texts were not read**.

Status:
- **verified**: the reference resolves and matches, and the claim we use is consistent with the abstract or the data.
- **verified (metadata)**: the reference resolves and matches, but Crossref returns no abstract, so the claim is checked only against the title and our reading of the paper (see REPORT.md).
- **wrong**: metadata or claim is wrong. Fixed in the repo unless stated.
- **unverifiable**: could not be checked with the allowed endpoints. The claim is `assumption: true` in config.

## Entries in `src/worlds/sources.ts`

| id | Status | What we found | Claims it supports |
|---|---|---|---|
| `bains2004` | verified (metadata) | Astrobiology 4:137–167, matches. No abstract from Crossref. | Liquid nitrogen is a discussed candidate solvent (silicon step 5); seas freeze limit. |
| `petkowski2020` | verified | Life 10:84, matches. Abstract: "In no environment is a life based primarily around silicon chemistry a plausible option"; silica formation limits silicon in water; "Cryosolvents (e.g., liquid N2) provide extremely low solubility of all molecules, including organosilicons". | The caveat; steps 1, 3, 4 (silica, hydrolysis); Si–Si and C–C bond energies (Table 1, read earlier for REPORT.md, not re-read here). **Does not** support "silicon dissolves better in liquid nitrogen": that was a misattribution in step 6, fixed (see below). |
| `nrc2007` | verified (metadata) | doi 10.17226/11919 resolves, 2007, corporate author (no personal authors in Crossref). | Silicon species "might have greater solubility in dinitrogen" (REPORT.md quote from the book, not re-checked here). Step 6 is now sourced to NRC only and marked `assumption: true`. |
| `kan2016` | verified | Science 354:1048, matches (Crossref subtitle "Bringing silicon to life"). Abstract: heme proteins form C–Si bonds. | Real-world aside only. Not used in config. |
| `pace2001` | verified (metadata) | PNAS 98:805–808, matches. | Carbon in water as the likely universal biochemistry (carbon step 2, solvent). |
| `takai2008` | verified | PNAS 105:10949, matches. Abstract: temperature maximum rises "from 116 °C at 0.4 MPa to 122 °C at 20 MPa". | Carbon upper limit 122 °C. **Qualifier added to config**: 122 °C needs deep-sea pressure; 116 °C at low pressure. |
| `hoffman2017` | verified | Science Advances 3, matches. Abstract is one line ("dynamics of Cryogenian global glaciation and their biological consequences"). | Surface life survived Snowball conditions (carbon cold edge, which is also `assumption: true` because −50 °C is ours). |
| `goldblatt2009` | verified (metadata); coefficient **unverifiable** | Nature Geoscience 2:891–896, matches. No abstract. | Nitrogen warms the planet through the greenhouse (direction). The carbon config uses `greenhousePerLnN` 1.44 K (about 1 K per doubling) and cites this paper; we could not confirm that figure. My recollection is that the paper reports a larger warming per doubling, but I could not check it. The derived stat stays `assumption: true`. See the open item below. |
| `lee1995` | verified | Meteoritics 30:387–398, matches. Abstract: nierite (Si₃N₄) found in three ordinary chondrites and the enstatite chondrite Indarch (EH4), grains about 2 × 0.4 µm. | Silicon nitride occurs naturally in reduced meteorites. "Plausible planetary feedstock" is our inference (`assumption: true`, as in config). Also found in ordinary chondrites, not only enstatite. |
| `myhre1998` | verified | GRL 25:2715–2718, matches. Abstract gives forcing numbers and "simple forcing-concentration relationships"; the log form itself is in the paper body, not the abstract. | CO₂ warming scales with the log of concentration. |
| `sherwood2020` | verified | Reviews of Geophysics 58, matches. Abstract: 66% range 2.6–3.9 K per doubling. The "central 3.1 K" in our note is not in the abstract (it is in the paper body). | About 3 K per CO₂ doubling (`co2PerDoublingK` 3). |
| `som2016` | verified (metadata) | Nature Geoscience 9:448–451, matches; title says air pressure under half of modern levels at 2.7 Ga. | Nitrogen lower edge reasoning. The paper gives an upper bound on pressure; "life thrived" is our reading. |

## Added in this change

| id | Status | What it is | Claims it supports |
|---|---|---|---|
| `nistN2` | verified | NIST WebBook fluid data, nitrogen. Saturation table at 5 °C steps −210 to −147 °C; triple point 63.14 K (−210.01 °C), 0.1252 bar; critical point 126.2 K (−146.95 °C), 33.96 bar; liquid density at the triple point 867.2 kg/m³. | The whole `silicon.solvent.vapourPressure` table (e.g. 3.6511 bar at −183 °C, 1.0127 bar at the boiling point); `freezeC`, `criticalC`; the `beyondCritical` limit; the silicon pressure stat and its derived model. |
| `nistH2O` | verified | NIST WebBook fluid data, water. | `carbon.solvent.vapourPressure`: 10 to 374 °C match NIST within 0.3% (100 °C entry is 1 atm = 1.0132; NIST saturation is 1.0142). Entries below 0 °C (ice sublimation) were not checked. |
| `edejer1967` | verified | Crossref match (J Chem Eng Data 12:206). Cited by NIST for the same data. | Independent measurement of N₂ vapour pressure between the triple and critical points. |
| `fulchignoni2005` | verified (metadata) | Nature 438:785, Huygens probe in situ measurements. | Titan surface about 94 K (−179 °C) and about 1.5 bar (from my knowledge of the paper; no abstract from Crossref). Used for the star and Titan lines. The **0.14 g** figure is not in this source and stays an assumption. |
| `stofan2007` | verified (metadata) | Nature 445:61, "The lakes of Titan". | Titan's surface liquids are methane and ethane, not nitrogen (step 7). |
| `berner1989` | verified (metadata) | Am J Sci 289:333–361. | Oxygen follows organic-carbon burial, not just the amount of life (carbon reasoning step 4; the rate stays `assumption: true`). Also checked: Hayes and Waldbauer 2006, Phil Trans R Soc B 361:931 (doi 10.1098/rstb.2006.1840), same topic; not added. |
| `burgess1996` | verified (metadata) | Chem Rev 96:2983–3012. | Nitrogenase spends about 16 ATP per N₂ (CLAUDE.md silicon caveat; the cost is folded into upkeep). Not cited in config. |
| `jassby1976` | verified | Limnol Oceanogr 21:540–547. | Saturating light curve (silicon `floraLightGain`). Not cited in config. |
| `manske2005` | verified | Appl Environ Microbiol 71:8049–8060. | Phototrophs at very low light. Not cited in config. |
| `huffaker1958` | verified | Hilgardia 27:343–383, "predator-prey oscillations". | Emergent predator–prey cycles (honesty box). Not cited in config. |
| `bell1936`, `evans1938` | verified | Bell, Proc R Soc A 154:414; Evans and Polanyi, Trans Faraday Soc 34:11. | Bell–Evans–Polanyi (weaker bonds, lower barriers) behind silicon's 32 kJ/mol; the extrapolation across elements is ours (`assumption: true`). Not cited in config. |
| `scott1976` | verified (existence only) | Phys Rep 27:89, "Solid and liquid nitrogen". Figures not read. | Cited for "solid nitrogen is denser than the liquid". NIST has no solid-phase density. |

A wrong DOI was caught while doing this: I first guessed 10.1098/rspa.1936.0029 for Bell 1936, and Crossref showed it is a different paper (Massey and Burhop). The correct DOI is 10.1098/rspa.1936.0060. Nothing in the repo used the wrong one.

## Claims in the CLAUDE.md worlds tables

| Claim | Source | Result |
|---|---|---|
| Si–Si about 220 vs C–C about 350 kJ/mol | Petkowski 2020 Table 1 (REPORT.md l.198: 222 and 346) | Taken from REPORT.md. The CRC Handbook / Table 1 were not re-read here. **Still to verify.** |
| Silicon hydrolyses / is attacked in water, silica forms | Petkowski 2020 | Supported by the abstract. |
| Silicon compounds may dissolve in liquid N₂ better than carbon compounds | was Petkowski 2020 App. C and NRC 2007 | **Wrong attribution.** Petkowski 2020 says the opposite (extremely low solubility of everything). Only NRC 2007 says "might have greater solubility". Config and CLAUDE.md step 6 now cite NRC 2007 and are `assumption: true`, with Petkowski's caution kept. |
| N₂ liquid between −210 and −147 °C | NIST | Verified: triple −210.01 °C, critical −146.95 °C. |
| About 3.6 bar at −183 °C | NIST | Verified: 3.6511 bar. The earlier table was within 3% everywhere but is replaced. |
| Titan: thick N₂ air, seas of methane and ethane, surface about −180 °C, 1.5 bar | Huygens 2005, Cassini 2007 | Consistent (metadata level). "0.14 g" unsupported by these sources. |
| Nitrogen ice sinks | NIST has no solid density; Scott 1976 exists | **Unverifiable here.** `seasFreeze` limit stays `assumption: true`. |
| Highest known growth temperature 122 °C | Takai 2008 | Verified, with the pressure qualifier (20 MPa). |
| About 3 K per CO₂ doubling | Myhre 1998, Sherwood 2020 | Consistent with Sherwood's 2.6–3.9 K likely range. |
| About 1 K per doubling of N₂ (Goldblatt) | Goldblatt 2009 | **Unverifiable here.** See below. |
| Early Earth air pressure under half of today's | Som 2016 | Consistent with the title. |

## Open items

1. **Goldblatt 2009 coefficient.** `carbon.derived.temperature.params.greenhousePerLnN` is 1.44 K per ln(nitrogen) and its comment says "about 1 K per doubling (Goldblatt 2009)". Crossref gives no abstract. Someone with the paper should confirm the figure; it is already under `assumption: true`.
2. **Bond energies.** Need one look at Petkowski 2020 Table 1 or the CRC Handbook to close the last "Still to verify" item.
3. **Solid N₂ density.** NIST does not publish it. A source such as Scott 1976 needs reading; until then "nitrogen ice sinks" is an assumption.
4. **Silicon "sky" card** says "cold means thick air". The vapour pressure of N₂ falls as it gets colder, so within this world colder means *thinner* air; it is thick only compared with Earth. Wording to fix when the card text is next edited (not changed here).
