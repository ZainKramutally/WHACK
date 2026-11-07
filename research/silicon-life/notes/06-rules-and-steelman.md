# 06 — Round 2: verified numbers, the steelman for silicon, and the sim rule table

Round 2 notes. Structured data: `../data/rules.json`. Tags and status labels as in the README.
I resolved DOIs via OpenAlex/Crossref on 2026-11-07 and read abstracts unless noted. "Not re-verified" means the value comes from standard textbook tables and I did not check it against a primary source this round.

---

## A. Verifying the open numbers

### A1. π-bond energies
| Bond | π energy | Source | Status |
|---|---|---|---|
| C=C (ethene) | **65.4 kcal/mol ≈ 274 kJ/mol** | Wang & Poirier 1998, Can J Chem, doi:10.1139/cjc-76-4-477 (GVB ab initio rotation barrier, abstract) `[PEER]` | verified (computed) |
| Si=Si (disilene H2Si=SiH2) | **23.2 kcal/mol ≈ 97 kJ/mol** (≈ 0.35 × C=C) | same | verified (computed). Round 1's "100–125" is roughly right but slightly high |
| Si=C (silaethene) | 31.6 kcal/mol ≈ 132 kJ/mol | same | verified (computed) |
| Si=O, C=O | **not verified.** The canonical table is Schmidt, Truong & Gordon 1987, JACS 109:5217 (doi:10.1021/ja00251a029, DOI verified). It is paywalled and I did not read it. Qualitatively, the Si=O π bond is weak and Si^δ+–O^δ− is strongly polarised, so silanones oligomerise to siloxanes. Only a handful of isolable silanones exist (Filippou 2014, doi:10.1002/anie.201308433; Kobayashi 2019, doi:10.1002/anie.201905198), via Wikipedia "Silanone" `[POP→PEER]` | **open** |

Petkowski 2020 gives no π energies. It says only that Si=C is "very unstable under almost all conditions" (Table 1). For the sim, `pi_bond_ability` = π(X=X)/π(C=C): C 1.0, Si 0.35. The other elements are scored `[INFERRED]`.

### A2. Dielectric constants
- **Liquid NH3: ε ≈ 22 at 239 K**, from Wikipedia "Ammonia (data page)" `[POP]`. The entry is unsourced, but it matches the round-1 recollection. The primary measurement is Baldwin & Gill 1970, Phys Chem Liq (doi:10.1080/00319107008084075), which covers −35 to −70 °C. I verified the title but did not read the values. ε rises on cooling, so expect about 22–25 at 220 K `[INFERRED]`. **Partially verified.**
- **100% H2SO4: ε ≈ 100 (25 °C).** The primary source is Gillespie & Cole 1956, Trans Faraday Soc 52:1325 (doi:10.1039/TF9565201325). I verified the title, but the abstract is unavailable, so **the value itself is not verified.**
- Water 80.1 (293 K) and CH4 1.68 (91 K) are carried over from note 02 (CRC).

### A3. Pauling electronegativity and common valence
EN values are from the Wikipedia data page, WEL column, which matches the CRC and Lange columns (Allred 1961; Huheey 1993) `[POP aggregator of BOOK]`. All of them are verified.

| | H | B | C | N | O | Si | P | S | Ge | As | F | Cl |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EN | 2.20 | 2.04 | 2.55 | 3.04 | 3.44 | **1.90** | 2.19 | 2.58 | 2.01 | 2.18 | 3.98 | 3.16 |
| valence (max coord.) | 1 | 3 (4) | 4 | 3 (4⁺) | 2 (3⁺) | 4 (**5–6**) | 3/5 | 2/4/6 | 4 (6) | 3/5 | 1 | 1 |

**Correction to note 01:** note 01 §1.2 gives Si EN as **1.8**. That is the old Pauling value. The current tabulated value is **1.90**. ΔEN(Si–O) = 1.54 vs ΔEN(C–O) = 0.89, so the conclusion (Si is the δ+ target) is unchanged.

### A4. Hydrolysis / solvolysis kinetics (what quantitative data exists)
I found no clean rate-constant table for Si–Si, Si–H, Si–C or Si–O in water vs other solvents. Here is the best available set, all qualitative timescales:

| Bond / compound | Water | Conc. H2SO4 | Source |
|---|---|---|---|
| Si–Cl (SiCl4, chlorosilanes) | "almost instantly" | **hours–days** in 100% H2SO4 at 20 °C | Petkowski 2020 §3.1, §4.3 [ref 101] |
| Si–Si | "many… hydrolyse almost instantaneously" | **more stable than Si–C** | Petkowski 2020 §4.1, §4.3 [103] |
| Si–H | → Si–OH "in a few hours" at physiological conditions. Stable in pure water, but trace alkali catalyses rapid hydrolysis | "allowed" (stable) | Petkowski 2020 §4.1 [81 = Tacke & Linoh 1989], §4.3 [25 = Stock 1933], App. E.1 |
| Si–C | stable (the hybrid route) | alternating Si–C polymers stable in 98% H2SO4 at 90 °C | Petkowski 2020 §4.3 [111] |
| alkyl–SiF3 | "almost instantly" | stable | Petkowski 2020 §4.3 [100] |
| Si–O–C (alkoxysilanes) | rate depends on substituent, solvent, catalyst and pH (Taft relation) | — | Issa et al. 2019, Sci Rep (doi:10.1038/s41598-019-54095-0) `[PEER]`. Abstract only, no numbers extracted |
| Si–O–Si (methylsiloxanes) | "fast degradation (hydrolysis…)" in the environment, but they persist in sediment | — | Xiang et al. 2021, Ecotox Env Saf (doi:10.1016/j.ecoenv.2021.112631) `[REVIEW]` |
| hexacoordinate Si complexes | some are "surprisingly stable against hydrolysis in water" | — | Petkowski 2020 App. C |
| ammonia | **no data**: "Si compound chemistry has not been studied in liquid ammonia" | | Petkowski 2020 §4.2 |

These ordinal timescales anchor the `solvent_attack_0to1` scores in rules.json. The scores themselves are `[INFERRED]`.

### A5. Arrhenius reasoning: rate factor vs 300 K
k(T)/k(300 K) = exp[−(Ea/R)(1/T − 1/300)]. This is my own calculation `[INFERRED]`.

| T | world | Ea = 30 kJ/mol | **Ea = 50** | Ea = 80 |
|---|---|---|---|---|
| 94 K | Titan | 4 × 10⁻¹² | **8 × 10⁻²⁰** | 3 × 10⁻³¹ |
| 220 K | NH3 ocean | 1.3 × 10⁻² | **7 × 10⁻⁴** | 9 × 10⁻⁶ |
| 300 K | water | 1 | **1** | 1 |
| 330 K | Venus clouds | 3.0 | **6.2** | 18 |
| 1500 K | magma | 1.5 × 10⁴ | **9 × 10⁶** | 1.4 × 10¹¹ |

Cross-check: Petkowski 2020 §4.4 [116] gives "2–3× slower per 10 °C". Applied from 300 to 94 K, that rule gives only 10⁶–10¹⁰ slower, because the rule assumes a constant Q10, which under-predicts the slowdown at cryogenic T. Either way, **Titan chemistry with ordinary activation barriers is effectively frozen.** Only very low-barrier reactions (radicals, unsaturated Si, which "can do very fast reactions at… liquid O2" temperatures, [117]) or tunnelling stay fast. The sim needs a **log-compressed** rate (`rate_log10` in rules.json). If it used the raw rate, Titan would just look dead.

### A6. Venus phosphine after 2023: still **disputed / unresolved**
- **Clements 2024** (IAU Proc., doi:10.1017/S1743921324001509) `[PEER, discovery team]`. Claims the detection "has survived all challenges", has independent support from archival Pioneer Venus mass-spec data, and that known abiotic sources are ruled out. It introduces **JCMT-Venus** as a long-term monitoring programme.
- **Bains, Seager, Clements, Greaves et al. 2024** (Front Astron Space Sci, doi:10.3389/fspas.2024.1372057) `[REVIEW, discovery team]`. Calls it a "tentative detection… remains controversial". Finds no known pathway that explains the abundance. The options it offers are unknown geo- or photochemistry, or an aerial biosphere.
- **Mràzikovà et al. 2024** (Astrobiology, doi:10.1089/ast.2023.0046) `[PEER]`. A DFT model of an abiotic photochemical route over acidic dust (·PO + HC·O). It argues phosphine **need not be biological**.
- **Tang, Clements, Greaves, Richards et al. 2026** (EPSC abstract, doi:10.5194/epsc2026-1119) `[PREPRINT/abstract]`. JCMT-Venus has completed four multi-week campaigns, with a fifth approved for July 2026. The programme has broadened into general monitoring of the 90–110 km mesosphere (HDO, SO2, SO, H2SO4, OCS, HCO+). The abstract **does not report a new PH3 confirmation.**
- I found **no independent peer-reviewed confirmation** from 2024–2026. The 2022 SOFIA upper limit (Cordiner) still stands against the claim. Verdict: **disputed**. Slide wording: *"Claimed in 2020, still contested in 2026."*

---

## B. Steelman: the strongest serious case for silicon

What sympathetic serious sources concede:
- NRC 2007 ch. 6 "Why Water? Toward More Exotic Habitats" `[BOOK]`: *"There is little question that polymeric diversity is possible using silicon, rather than carbon, as a scaffolding."* Also: *"silicon-based species might have greater solubility in dinitrogen than carbon-based species."* Liquid N2 "may be a bulk solvent on Triton". Silanes are "unworkable… on today's Earth, because water reacts with many silanes."
- Bains 2004 `[PEER]`: the solvent decides the chemistry. He proposes Si biochemistry in liquid N2.
- Petkowski 2020 Appendix C is titled *"Unsaturated silicon chemistry as a crucial component of silicon biochemistry in cryosolvents."* So even the sceptics worked out what Si life would need. They add that N2 oceans can last "for billions of years" on planets beyond ~1 AU from an M5 star.
- Irwin & Schulze-Makuch 2020 (Universe, doi:10.3390/universe6090130) `[REVIEW]`: keep "organic forms with novel biochemistries, dynamic inorganic matter" open, and rank worlds by their history (cold hydrocarbon worlds, dense-cloud worlds, rogue planets). Schulze-Makuch & Irwin 2006 (doi:10.1007/s00114-005-0078-6): no abstract available, so I did not read it.

**Best three "it could work if…" scenarios**

1. **Venus-type sulfuric-acid hybrid (C + Si co-backbone).** *If* the solvent is 81–98% H2SO4 at below 100 °C, then Si–Si, Si–H and Si–C bonds are kinetically protected. Chlorosilanes last hours–days instead of an instant. Si–Si there is *more* stable than Si–C, and Si–C polymers survive 98% acid at 90 °C. Silicon becomes a *common* heteroatom. Nucleobases (Seager 2023) and most amino acids (Seager 2024) are stable, but dipeptides solvolyse within weeks (Petkowski 2024, doi:10.1038/s41598-024-67342-w). So acid life would need a peptide-bond substitute, and a Si-containing linkage is a natural candidate for the sim `[INFERRED]`. **Status: plausible/theorised, and the strongest case.**
2. **Cryogenic N2/CH4 world running mostly on silicon.** *If* the solvent is aprotic (Triton N2 at 63–77 K, Titan CH4/C2H6 at ~94 K), almost no Si bond is attacked, and most of silicon's chemical space is open (Petkowski 2020). Silanes dissolve better than carbon species in N2 (NRC 2007). Low-barrier unsaturated Si chemistry could beat the 10⁻¹⁹ Arrhenius penalty. The case is killed by solubility: SiH4 reaches only ~ppt and glycine-sized molecules less than ppm, and "any biochemistry [is] implausible in cryogenic solvents". **Status: plausible/theorised, disfavoured.**
3. **Carbon life that recruits silicon.** *If* you accept "silicon-rich" instead of "silicon-based", Earth already does it. Diatom silaffins and sponge silicatein build glass skeletons on a planetary scale (Kröger 1999; Shimizu 1998). One directed-evolution campaign gave cytochrome c Si–C bond-forming activity 15× better than synthetic catalysts (Kan et al. 2016). Cairns-Smith's silicate-clay genes offer a mineral first stage before carbon takes over. **Status: consensus (biosilica, lab Si–C enzymes) / plausible-minority (clay genes).**

**Rejected: "high pressure makes silicon carbon-like".** I found no peer-reviewed support. Pressure pushes Si to *higher* coordination (6-coordinate networks such as stishovite, standard mineralogy `[BOOK]`). It also turns **carbon** silicon-like: CO2 becomes a quartz-like extended solid above 40 GPa / 1800 K (Iota, Yoo & Cynn 1999, Science, doi:10.1126/science.283.5407.1510) `[PEER]`. That is the reverse of what the idea needs. The best reading is that pressure gives you more rock, not more biochemistry `[INFERRED]`. Hypercoordinate Si is real, and some 6-coordinate complexes are water-stable (Petkowski App. C). It is a good "bonus valence" mechanic, but it is not a habitat.

---

## C. Sim rule table

Normalisation (also in `rules.json.meta`): bond 0–1 = kJ/500 capped at 1; abundance 0–1 = log10(value)/log10(max); `oxygen_hunger` = bond_to_O / self_bond.

### C1. Element parameters
| El | val (max) | EN | self-bond kJ (0–1) | bond to O kJ (0–1) | O-hunger | π ability | cosmic / crust abundance 0–1 |
|---|---|---|---|---|---|---|---|
| H | 1 | 2.20 | 436* (0.87) | 463* (0.93) | 1.06 | 0 | 1.00 / 0.56 |
| B | 3 (4) | 2.04 | 293* (0.59) | 536* (1.0) | 1.83 | 0.4 | 0.13 / 0.18 |
| **C** | 4 | 2.55 | **346** (0.69) | **358** (0.72) | **1.03** | **1.0** | 0.67 / 0.41 |
| N | 3 | 3.04 | 167* (0.33) | 201* (0.40) | 1.20 | 1.0 | 0.62 / 0.23 |
| O | 2 | 3.44 | 142* (0.28) | 142* | 1.00 | 1.0 | 0.71 / 1.00 |
| **Si** | 4 (**6**) | 1.90 | **222** (0.44) | **452** (0.90) | **2.04** | **0.35** | 0.57 / 0.96 |
| P | 3/5 | 2.19 | 201* (0.40) | 335* (0.67) | 1.67 | 0.4 | 0.38 / 0.53 |
| S | 2/6 | 2.58 | 226* (0.45) | 265* (0.53) | 1.17 | 0.6 | 0.55 / 0.45 |

C–C, Si–Si, C–O and Si–O are Petkowski 2020 Table 1. \* = textbook mean, **not re-verified**. Ge, As, F and Cl are in the JSON.

### C2. Worlds
| World | solvent | T K | ε | rate ×(Ea 50) | mobility 0–1 |
|---|---|---|---|---|---|
| water | H2O | 300 | 80 | 1 | 1.0 |
| ammonia | NH3 | 220 | ~22 | 7e-4 | 0.7 |
| titan | CH4/C2H6/N2 | 94 | 1.7 | 8e-20 | 0.02 |
| venus_clouds | 81–98% H2SO4 | 330 | ~100† | 6.2 | 0.6 |
| magma | silicate melt | 1500 | — | 9e6 | 0.3 |

† not verified. Mobility is `[INFERRED]` from the Petkowski solubility statements.

### C3. Solvent attack (0–1) per element backbone; all scores `[INFERRED]`, anchored on §A4
| | water | NH3 | Titan | H2SO4 | magma |
|---|---|---|---|---|---|
| C | 0.02 | 0.02 | 0.01 | 0.5 | 1.0 |
| **Si** | **0.9** | **0.75** (untested) | **0.03** | **0.3** | **0.95** |
| B | 0.9 | 0.4 | 0.05 | 0.6 | 0.95 |
| N | 0.5 | 0.2 | 0.03 | 0.3 | 1.0 |
| O | 0.6 | 0.5 | 0.05 | 0.5 | 0.9 |
| P | 0.35 | 0.3 | 0.05 | 0.4 | 0.95 |
| S | 0.2 | 0.25 | 0.05 | 0.15 | 0.95 |

`bond_lifetime_rel` = (1 − attack + 0.01)/rate_factor, normalised to C-in-water = 1. Examples: Si in water 0.11, Si in H2SO4 0.12 vs C in H2SO4 0.08, Si on Titan ~10¹⁹. Lifetime is **not** fitness on its own. Titan bonds last forever because nothing happens there. The sim should score viability as roughly `formation_rate × mobility × lifetime`, which produces the Goldilocks band `[INFERRED]`.

### C4. Player knobs
1. **Group 14 backbone slider (C ↔ Si ↔ Ge).** Sets self-bond (346 → 222 → ~188\*), π (274 → 97), bond to O (358 → 452 → ~363\*) and EN. *Emergent effect:* the carbon end gets long chains, rings and rigid double-bond motifs, so motif diversity is high. The silicon end gets short-lived chains, few unsaturated motifs, and silica waste. `[INFERRED]`, numbers from Petkowski 2020 and Wang & Poirier 1998.
2. **Bond count (valence 1–6 + hypervalency toggle).** Valence 1 terminates, 2 gives chains and rings, 3–4 gives branching and catalytic sets. Allowing Si 5–6 speeds up catalysis *and* hydrolysis, because both go through the same 5-coordinate intermediate (Petkowski 2020). That makes it a trade-off knob `[INFERRED]`.
3. **Oxygen hunger** (bond to O / self-bond: C 1.03, Si 2.04). Sets the chance that a backbone atom next to O turns irreversibly into an oxide. High hunger means solid waste piles up and entombs organisms. Behind it: SiH4 from silica costs +434 kJ/mol, while CH4 from CO2 releases 142 (Petkowski Table 2). Low hunger gives gaseous waste that diffuses away.
4. **Solvent.** Sets per-element attack, ε and mobility (C2/C3). *Emergent effect:* water makes a Si world stall at "first chain". Titan lets Si chains survive, but they never meet. H2SO4 gives the best Si world, a Si–C hybrid. That is the real literature result (Petkowski 2020; NRC 2007; Bains 2021).
5. **Temperature.** kT drives an Arrhenius factor on both making and breaking bonds (log-compressed), clamped to the solvent's liquid range. Too cold gives a frozen museum, too hot a soup that never holds structure. Weak backbones need colder worlds `[INFERRED]`, from §A5.
6. **Energy source** (UV / redox vents / thermal cycling / radiolysis). Sets where and how fast bond-forming energy is injected. Vents give patchy, competitive ecosystems, and diffuse UV gives surface mats `[INFERRED]`. Precedents: the radiolytic single-species biome (Lin 2006), Titan's C2H2 + 3H2 → 2CH4 (McKay & Smith 2005), NRC 2007.

Abundance is best as a **preset**, not a knob: cosmic (C:Si ≈ 10:1), rocky crust (Si ≫ C) or carbon planet (no water, SiC insoluble, Petkowski App. D).

---

## Still unverified
- Si=O and C=O π energies (Schmidt 1987 is paywalled). Diatomic SiO D0 ≈ 800 kJ/mol (Luo) is still unverified from round 1.
- ε of 100% H2SO4 (~100) and the primary source for NH3 ε (~22 at 239 K).
- Bond enthalpies for B, N, O, P, S, Ge, As, F and Cl bonds (textbook means).
- Real rate constants or half-lives for Si–Si, Si–H and Si–O–Si hydrolysis vs pH and T. Only ordinal timescales exist in what I read.
- Schulze-Makuch & Irwin 2006 / 2018 book text (not read).
