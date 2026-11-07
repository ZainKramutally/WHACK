# What if life was silicon-based? Research report

Visual summary: [`report.html`](report.html). One-page version: [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md). Raw notes: [`notes/`](notes/). Data behind every table: [`data/`](data/).

**Evidence tags:**
- `[PEER]` peer-reviewed (DOI)
- `[REVIEW]` review article
- `[PREPRINT]` preprint
- `[BOOK]` book
- `[POP]` popular or press source
- `[INFERRED]` our own reasoning

**Status labels:** **consensus**, **plausible/theorised**, **disputed**, **refuted**.

---

## 1. Question and method

**Question.** Could life be built on silicon instead of carbon? If not, what would have to change? And how do we turn the answer into a browser sim where the player edits the rules for groups of elements and watches life, or its absence, emerge? The theme is "New Worlds". Judging puts creativity above technical complexity, and presentation also counts (`docs/TRACK.md`).

**Method.** We ran two rounds of time-boxed desk research, then a numerical prototype, then this synthesis.

| Round | Notes | Axis |
|---|---|---|
| 1 | 01–04 | Silicon chemistry; other biochemistries; ALife models; history and hooks |
| 2 | 05–07 | Prior art and GPU bonding; verifying open numbers, steelman and rule table; toy bonding prototype (`prototype/bonding_model.py`) |
| Synthesis | this file | Reconciliation and judgment. No new sources |

**Sources and verification.**
- The notes and data files cite **106 unique DOIs**. Every note reports resolving its DOIs against Crossref or OpenAlex on 2026-11-07, checking title and first author.
- Resolving a DOI is not the same as reading the paper. Petkowski 2020 was read in full text (PMC7345352). Most other papers were read at abstract level. Some were checked by title only: NRC 2007, Gillespie & Cole 1956, Baldwin & Gill 1970, Schmidt 1987, the 2025 clay critique, and the 2026 ChemRxiv preprint.
- One DOI looks malformed. Sims 1994 is recorded as `10.1162/artl.1994.1.353`. Other *Artificial Life* DOIs in our set include the issue number (e.g. Hutton 2007, `10.1162/artl.2007.13.1.11`), so re-check this one before citing it.
- Non-DOI sources include READMEs, Wikipedia data pages that aggregate CRC tables, NASA pages and Wikimedia Commons. These are tagged `[POP]`.

### 1.1 Where the notes disagreed, and what we use

| Item | Values found | We use | Why |
|---|---|---|---|
| Si electronegativity (Pauling) | 1.8 (note 01) vs **1.90** (note 06) | **1.90** | Note 06 is the later value, checked against the WebElements/CRC/Lange columns. 1.8 is the old Pauling figure. ΔEN(Si–O) = 1.54 vs ΔEN(C–O) = 0.89, so the conclusion is unchanged |
| Si=Si π bond | 100–125 kJ/mol (note 01, textbook, unverified) vs **97** (note 06) | **97 kJ/mol** (≈0.35 × C=C) | Wang & Poirier 1998, doi:10.1139/cjc-76-4-477 (computed) |
| C=C π bond | 260–270 (note 01) vs **274** (note 06) | **274 kJ/mol** | Same source |
| Crust Si:C ratio by mass | ~1,400× (CRC, C = 200 ppm); ~925× (Wikipedia text); ~75× (alternate column, C = 3,760 ppm) | Quote **percentages** (Si ≈ 28%, C ≈ 0.02%, CRC). If a ratio is needed, say "hundreds to over a thousand times" | Crustal carbon varies a lot by source. The sim preset only needs "Si ≫ C" |
| Si share of crust | 28.2% (CRC) vs 27.7% (RSC) | "about 28%" | Within rounding |
| Petkowski 2020 verdict wording | "almost certainly impossible" (note 04 §5) vs "In no environment is a life based primarily around silicon chemistry a plausible option" (note 01, full text) | The second | It is the verified quote |
| Asimov "Not as We Know It" | 1962 (brief) vs Sept 1961 | **Sept 1961** | Note 04 |
| Diatom contribution | 20–50% of O₂ (older) vs ~20% of primary production | "about a fifth of global primary production" | Malviya et al. 2016, doi:10.1073/pnas.1509523113 |
| Venus cloud-layer temperature | ~260–340 K (note 02), 280–370 K (rules.json), "<100 °C" (Petkowski) | World preset **330 K**. Say "below 100 °C" | All three overlap. 330 K drives the rate factor |
| Acid attack on carbon (sim) | 0.5 (rules.json C3) vs "drop ~10×" (prototype) | **Lower value** | At 0.5 the hybrid world ends 90% dead. Nucleobases and most amino acids are acid-stable (Seager 2023; 2024), but dipeptides are not (Petkowski 2024), so attack stays above zero |
| Titan slowdown | ~10⁻¹⁹ (Arrhenius, Ea 50) vs 10⁻⁶–10⁻¹⁰ (Q10 rule of 2–3× per 10 °C) | Arrhenius, **log-compressed** in the sim | Both mean "frozen". A constant Q10 under-predicts the slowdown at cryogenic T |
| "Bains 2021" | Two different papers | Bains 2021a = *Life* 11:400 (sulfuric acid as solvent); Bains 2021b = *PNAS* (ammonia in Venus clouds) | The note-02 brief conflated them |
| Emergence timings (note 03) | Read as if measured | **Design targets** `[INFERRED]` | No spatial sim has been run yet |

---

## 2. Why carbon (the baseline)

Carbon is tetravalent and has a strong C–C bond (346 kJ/mol). It forms C=C, C≡C and aromatic π systems that are stable in water (π ≈ 274 kJ/mol). Its oxide, CO₂, is a monomeric gas that dissolves and diffuses away (Petkowski 2020) **consensus**. Making alkanes from CO₂ + H₂ is downhill: ΔG for CH₄ is −142 kJ/mol **consensus**. Carbon is also about 10× more abundant than Si in the cosmos (Anders & Grevesse 1989, doi:10.1016/0016-7037(89)90286-X). Carbon molecules dominate interstellar chemistry: by 1998, 84 C-bearing molecules were known vs 8 Si-bearing ones (`[POP]`, dated) **consensus**.

Pace 2001 (doi:10.1073/pnas.98.3.805) argues that biochemistry is probably universal: carbon in water `[PEER]`. The view is widely cited, but the "solvent decides the chemistry" school disputes it (Bains 2004, doi:10.1089/153110704323175124) **disputed**. NASA's working definition of life is "a self-sustaining chemical system capable of Darwinian evolution" (Joyce 1994 `[BOOK]`) **consensus as a working definition**. It names no element, which is what licenses a sim that tries other elements.

---

## 3. Silicon

### 3.1 Chemistry

| Bond | C (kJ/mol) | Si (kJ/mol) | Consequence |
|---|---|---|---|
| X–X | 346 | **222** (~64%) | Weak backbone |
| X–H | 411 | 318 | Si–H hydrolyses within hours at physiological pH |
| X–O | 358 | **452** | Oxygen sink |
| X=X π | 274 | **97** | Few stable unsaturated motifs |
| Si–C | — | 318 | Water-stable; this is the hybrid route |

Sources: Petkowski 2020 Table 1; Wang & Poirier 1998 for the π values. **consensus**. Si–F (~565–580) and Si–Cl (~380–400) come from textbook tables and were not re-verified.

- **Polarity.** Si (EN 1.90) is the δ+ end of nearly every bond, so nucleophiles (H₂O, OH⁻, NH₃) attack it. "Almost all Si–X bonds, including Si–Si bonds, are readily attacked and hydrolyzed in water" (Petkowski 2020) **consensus**.
- **Thermodynamics.** The ΔG of formation from oxide + water is +434 kJ/mol for SiH₄ vs −142 for CH₄. The gap widens with chain length: Si₃H₈ +1316 vs C₃H₈ −295 **consensus**.
- **Waste.** Silicon forms no stable Si=O, so SiO₂ forms a 3D network solid. An oxidising silicon metabolism would excrete sand. The chemistry is **consensus**; the "exhale sand" framing is `[INFERRED]`.
- **Oxygen sensitivity.** Disilane ignites in air at 0 °C, while ethane survives O₂ at 200 °C (Petkowski 2020) **consensus**.
- **What silicon does better.**
  - It holds 5–6 coordination stably. That opens reaction paths but also speeds hydrolysis. **consensus** for the chemistry; the trade-off is `[INFERRED]`.
  - Polysilanes reach about 500 Si–Si bonds.
  - Silicones are made industrially (~2 Mt/yr), but their diversity comes from carbon side chains **consensus**.
- **First stable Si=Si.** Tetramesityldisilene, made in 1981. It survives only without air and with bulky shielding groups (West, Fink & Michl 1981, doi:10.1126/science.214.4527.1343) **consensus**.

### 3.2 Evidence from Earth and the lab

- **Biosilicification** is the only biological silicon chemistry: silicic acid → silica (Petkowski 2020) **consensus**.
  - Sponge silicatein: Shimizu 1998, doi:10.1073/pnas.95.11.6234; Cha 1999, doi:10.1073/pnas.96.2.361.
  - Diatom silaffins: Kröger 1999, doi:10.1126/science.286.5442.1129.
  - The ocean silica cycle is coupled to the carbon cycle: Tréguer & De La Rocha 2013, doi:10.1146/annurev-marine-121211-172346 **consensus**.
  - Silicon's role in plants is **disputed** (Coskun 2019, doi:10.1111/nph.15343).
- **Lab Si–C enzymes.** An evolved *R. marinus* cytochrome c forms Si–C bonds in vivo, with more than 15× the turnover of the best synthetic catalysts (Kan et al. 2016, doi:10.1126/science.aah6219) **consensus** for the result. Its relevance to natural life is **disputed**: the substrate is a synthetic silane, which Petkowski calls "contrived conditions".
- **Clay genes.** Cairns-Smith (1982; 1985 `[BOOK]`) proposed self-copying defect patterns in aluminosilicate clays that carbon life later took over. **plausible/theorised, minority**. There is no experimental demonstration. Clays as catalysts and scaffolds are accepted (Kloprogge & Hartman 2022, doi:10.3390/life12020259).

### 3.3 Environments

| Environment | Case for Si | Case against | Status |
|---|---|---|---|
| Water | Si is everywhere | Hydrolysis plus the silica sink | **refuted** as a backbone; Si as a rare heteroatom is plausible |
| Liquid NH₃ | A second polar solvent | Basic, so ammonolysis is expected. Si chemistry in NH₃ is unstudied | **theorised, untested** |
| Cryosolvents (N₂ 63–77 K, CH₄/C₂H₆ ~94 K) | No H⁺/OH⁻ to attack Si; "the majority of silicon chemical space is available" | Only "a dozen or so" core metabolites exceed ppm solubility in N₂, and reactions run ~10⁻¹⁹× slower | **plausible/theorised, disfavoured** |
| Conc. H₂SO₄ (Venus, 48–60 km) | Si is a poor target for the acid's electrophilic chemistry. Chlorosilanes last hours to days, vs instantly in water. Si–Si is more stable than Si–C. Si–C polymers survive 98% acid at 90 °C | Still a carbon hybrid, and an abiotic origin there looks hard (Bains 2021a) | **plausible/theorised** (strongest case) |
| Silicate melt ("Thermia") | Si–O dominates | Si–O bonds break and reform on millisecond timescales | **refuted** for molecular life |
| High pressure | — | Pushes Si into 6-coordinate rock, and turns CO₂ quartz-like above 40 GPa (Iota et al. 1999, doi:10.1126/science.283.5407.1510) | **rejected** (no support found) |

Sources: Petkowski 2020; NRC 2007 (doi:10.17226/11919); Bains 2021a.

### 3.4 Steelman: the strongest serious case

Sympathetic sources concede a fair amount.
- NRC 2007 `[BOOK]`: "There is little question that polymeric diversity is possible using silicon, rather than carbon, as a scaffolding." It adds that silicon species "might have greater solubility in dinitrogen than carbon-based species".
- Bains 2004 proposes silicon biochemistry in liquid N₂.
- Even Petkowski 2020 has an appendix on unsaturated silicon chemistry in cryosolvents.
- Irwin & Schulze-Makuch 2020 (doi:10.3390/universe6090130) argue for keeping novel biochemistries in play.

The three best "it could work if…" scenarios:

1. **Sulfuric-acid C+Si hybrid** (81–98% H₂SO₄, below 100 °C). **plausible/theorised.**
   - Si–Si, Si–H and Si–C bonds are kinetically protected.
   - Nucleobases (Seager 2023, doi:10.1073/pnas.2220007120) and most amino acids (Seager 2024, doi:10.1089/ast.2023.0082) survive.
   - Dipeptides break down within weeks (Petkowski 2024, doi:10.1038/s41598-024-67342-w), so acid life needs a substitute for the peptide bond. A silicon-containing linkage is a natural candidate in the sim `[INFERRED]`.
2. **Cryogenic mostly-silicon world.** Bonds survive, but solubility and kinetics kill it: SiH₄ dissolves only to ~ppt in N₂. **plausible/theorised, disfavoured.**
3. **Carbon life that recruits silicon:** biosilica, lab Si–C enzymes, a clay-template origin. **consensus** for the first two; **plausible/theorised (minority)** for clay genes.

### 3.5 Verdict

Silicon-*based* life is implausible in every solvent assessed. Silicon as a heteroatom or co-backbone is plausible, mainly in concentrated sulfuric acid. This is **consensus** in the sense that no peer-reviewed work since 2020 says otherwise, but it rests on one major review (Petkowski 2020). The opinion pieces in the journal *Silicon* (Peng 2014, doi:10.1007/s12633-014-9254-7; Jacob 2015, doi:10.1007/s12633-014-9270-7) carry little weight either way.

---

## 4. Other building blocks

**Backbones.** All four of these are **plausible/theorised (weak)** (Bains 2004):
- Boranes and B–N. B–N is isoelectronic with C–C, but boranes burn in O₂, are unstable in water, and boron is rare.
- P–N phosphazenes are reactive, and there is no natural route to long chains.
- S–S chains barely branch.
- Germanium bonds are weaker than silicon's, and germanium is rarer.

Arsenate in place of phosphate is **refuted**, because arsenate esters hydrolyse far faster (Westheimer 1987, doi:10.1126/science.2434996).

**Solvents.**
- Polar, high-ε solvents support charged, water-like chemistry: H₂O (80.1), HF (83.6), formamide (111), H₂SO₄ (~100, unverified).
- Non-polar cryosolvents need "inside-out" chemistry `[INFERRED]`: CH₄ (1.68), C₂H₆ (1.94), N₂ (1.47).
- Supercritical CO₂ is a candidate (Budisa & Schulze-Makuch 2014, doi:10.3390/life4030331) **plausible/theorised**.

**Information polymers.** Heredity does not need DNA. All of these are **consensus** lab results:
- Six XNAs were evolved in the lab (Pinheiro 2012, doi:10.1126/science.1217622).
- Hachimoji DNA uses 8 letters (Hoshika 2019, doi:10.1126/science.aat0971).
- PNA has an uncharged backbone (Nielsen 1991, doi:10.1126/science.1962210).
- TNA (Schöning 2000, doi:10.1126/science.290.5495.1347).
- *E. coli* has replicated an unnatural base pair (Malyshev 2014, doi:10.1038/nature13314).

Benner 2004 (doi:10.1016/j.cbpa.2004.10.003) argues that a genetic polymer needs a repeating-charge backbone **plausible/theorised**.

**Energy.**
- Chemosynthesis and photosynthesis: **consensus** on Earth.
- Radiolysis powers a single-species ecosystem 2.8 km underground (Lin 2006, doi:10.1126/science.1127376; Chivian 2008, doi:10.1126/science.1155495) **consensus**.
- Radiolysis driven by cosmic rays (Atri 2016, doi:10.1098/rsif.2016.0459) **plausible/theorised**.
- Titan's C₂H₂ + 3H₂ → 2CH₄ (McKay & Smith 2005, doi:10.1016/j.icarus.2005.05.018) **plausible/theorised**. Its supporting H₂-sink evidence (Strobel 2010, doi:10.1016/j.icarus.2010.03.003) is **disputed**.

| Biochemistry | Backbone | Solvent | T (K) | Where | Status |
|---|---|---|---|---|---|
| Terran | C (+P–O sugar) | H₂O | ~250–395 | Earth | **consensus** |
| Ammonia world | C / N-rich | NH₃ | 195–240 (1 atm) | Icy-moon oceans | **plausible/theorised** |
| Titan hydrocarbon | C, N-headed | CH₄/C₂H₆ | 90–185 | Titan | **plausible/theorised**; membranes **disputed** |
| Venus acid cloud | C (+Si hybrid) | Conc. H₂SO₄ | below 100 °C | Venus, 48–60 km | **plausible/theorised** |
| Silicon (cryo) | Si | N₂ / CH₄ | 63–110 | Triton, Titan | **plausible/theorised, disfavoured** |
| Silicon (water) | Si | H₂O | 273–373 | — | **refuted** |
| Supercritical CO₂ | C | scCO₂ | >304, >7.4 MPa | Venus-like depths | **plausible/theorised** |
| Boron / B–N | B–N | NH₃, non-oxidising | cold | — | **plausible/theorised (weak)** |
| Inorganic POM cells | Metal-oxide clusters | H₂O | lab | lab | **plausible/theorised** (compartments only; Cooper 2011, doi:10.1002/anie.201105068) |
| Plasma-dust helices | Charged dust | Plasma | — | Nebulae | **plausible/theorised (speculative)** (Tsytovich 2007, doi:10.1088/1367-2630/9/8/263) |
| Arsenic DNA | As–O | H₂O | — | Mono Lake claim | **refuted** |
| XNA / hachimoji | Synthetic | H₂O | — | lab | **consensus** (in-vitro heredity) |
| Mirror life | Mirror C | H₂O | Terran | buildable | **plausible**; scientists recommend against it (Adamala 2024, doi:10.1126/science.ads9158) |

---

## 5. Controversies scoreboard

| Claim | Claimed | Rebuttal | Status, Nov 2026 |
|---|---|---|---|
| **Arsenic life (GFAJ-1)**: arsenate in place of phosphate in DNA | Wolfe-Simon et al., *Science*, online Dec 2010 (doi:10.1126/science.1197258) | No arsenate detectable in the DNA (Reaves 2012, doi:10.1126/science.1219861). The organism is "arsenate-resistant, phosphate-dependent" (Erb 2012, doi:10.1126/science.1218455). Paper retracted **24 Jul 2025** (doi:10.1126/science.adu5488) | **refuted** |
| **Azotosomes**: acrylonitrile membranes in Titan's methane | Stevenson, Lunine & Clancy 2015 (doi:10.1126/sciadv.1400067). Acrylonitrile was later detected on Titan (Palmer 2017, doi:10.1126/sciadv.1700022) | Quantum-mechanical calculations predict they will not self-assemble (Sandström & Rahm 2020, doi:10.1126/sciadv.aax0272) | **disputed, leaning refuted** |
| **Venus phosphine** (~20 ppb, later revised to a few ppb) | Greaves 2020 (doi:10.1038/s41550-020-1174-4) | Against: Snellen 2020 (doi:10.1051/0004-6361/202039717); Akins 2021 (doi:10.3847/2041-8213/abd56a); Villanueva 2021 (doi:10.1038/s41550-021-01422-z); SOFIA upper limit (Cordiner 2022, doi:10.1029/2022GL101055); a possible abiotic route (Mràzikovà 2024, doi:10.1089/ast.2023.0046). Discovery-team replies: Greaves 2023 (doi:10.1029/2023GL103539); Clements 2024 (doi:10.1017/S1743921324001509); Bains 2024 (doi:10.3389/fspas.2024.1372057). JCMT-Venus 2026 reports no new PH₃ confirmation (doi:10.5194/epsc2026-1119) | **disputed**. Slide wording: "Claimed in 2020, still contested in 2026" |
| **Assembly theory** as a life detector | Marshall 2021 (doi:10.1038/s41467-021-23258-x); Sharma 2023 (doi:10.1038/s41586-023-06600-9) | Uthamacumaran 2024 (doi:10.1038/s41540-024-00403-y); Jaeger 2024 (doi:10.1007/s00239-024-10163-2); Ozelim 2026, "collapses to dictionary compression" (doi:10.1038/s44260-026-00088-w) | **disputed** |

For the pitch: strange-chemistry claims get tested hard and are often wrong. That is why ours is framed as a what-if sandbox.

---

## 6. From science to simulation

### 6.1 Rule table (elements × worlds)

Element parameters come from `data/rules.json` (12 elements; the 8 core ones are shown). C–C, Si–Si, C–O and Si–O are from Petkowski 2020. \* = textbook mean, not re-verified.

| El | Valence (max) | EN | Self-bond kJ | Bond to O kJ | O-hunger | π ability |
|---|---|---|---|---|---|---|
| H | 1 | 2.20 | 436\* | 463\* | 1.06 | 0 |
| B | 3 (4) | 2.04 | 293\* | 536\* | 1.83 | 0.4 |
| **C** | 4 | 2.55 | **346** | **358** | **1.03** | **1.0** |
| N | 3 | 3.04 | 167\* | 201\* | 1.20 | 1.0 |
| O | 2 | 3.44 | 142\* | 142\* | 1.00 | 1.0 |
| **Si** | 4 (**6**) | **1.90** | **222** | **452** | **2.04** | **0.35** |
| P | 3/5 | 2.19 | 201\* | 335\* | 1.67 | 0.4 |
| S | 2/6 | 2.58 | 226\* | 265\* | 1.17 | 0.6 |

Below are the world parameters, with the solvent attack (0–1) on each backbone element. The attack scores are `[INFERRED]`, anchored on the qualitative timescales in Petkowski 2020. The rate factor is Arrhenius at Ea = 50 kJ/mol relative to 300 K.

| World | T (K) | ε | Rate × | Mobility | C attack | **Si attack** | B | N | O | P | S |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Water | 300 | 80 | 1 | 1.0 | 0.02 | **0.9** | 0.9 | 0.5 | 0.6 | 0.35 | 0.2 |
| Ammonia | 220 | ~22 | 7×10⁻⁴ | 0.7 | 0.02 | **0.75** (untested) | 0.4 | 0.2 | 0.5 | 0.3 | 0.25 |
| Titan | 94 | 1.7 | 8×10⁻²⁰ | 0.02 | 0.01 | **0.03** | 0.05 | 0.03 | 0.05 | 0.05 | 0.05 |
| Venus clouds | 330 | ~100† | 6.2 | 0.6 | 0.5 → use ~0.05 | **0.3** | 0.6 | 0.3 | 0.5 | 0.4 | 0.15 |
| Magma | 1500 | — | 9×10⁶ | 0.3 | 1.0 | **0.95** | 0.95 | 1.0 | 0.9 | 0.95 | 0.95 |

† not verified.

Bond lifetime is not the same as fitness: Titan bonds last ~10¹⁹× longer only because nothing happens there. Score viability as roughly `formation_rate × mobility × lifetime`, which produces a Goldilocks band `[INFERRED]`.

### 6.2 Player knobs

| Knob | Range | Real anchor | Expected emergent effect `[INFERRED]` |
|---|---|---|---|
| Group-14 backbone slider | C ↔ Si ↔ Ge | X–X 346 → 222 → ~188\*; π 274 → 97; X–O 358 → 452 | C: long chains, rings, rigid motifs. Si: short-lived chains and silica waste |
| Valence + hypervalency | 1–6 | Si can be 5–6-coordinate | 1 caps chains, 2 makes chains and rings, 3–4 branches. 5–6 speeds catalysis *and* decay |
| Oxygen hunger | C 1.03, Si 2.04 | SiH₄ +434 vs CH₄ −142 kJ/mol | High: solid waste piles up and entombs organisms. Low: gaseous waste diffuses away |
| Solvent | 5 worlds | §3.3 | Water stalls Si at "first chain". Titan: Si survives but molecules never meet. Acid: the best Si world |
| Temperature | moves E/kT between ~2 and 8 | Arrhenius | Too cold gives a frozen museum; too hot gives a soup that never holds structure |
| Energy source | UV / vents / thermal / radiolysis | Lin 2006; McKay & Smith 2005 | Vents give patchy competition; UV gives surface mats |
| Abundance | **preset**, not a knob | cosmic C:Si ≈ 10:1; crust Si ≫ C; carbon planet | Shows that abundance alone does not decide which element life uses |

**UI warning.** The "stronger Si–Si" slider does nothing in water, because hydrolysis comes from polarity, not bond strength. In the prototype it only made the dry and methane worlds freeze into a blob faster. Tell the player this.

### 6.3 Prototype findings (note 07, all `[INFERRED]`)

The prototype is a well-mixed stochastic bonding model: N = 3000 atoms of C or Si plus H and O, with real bond energies and toy solvent-attack rates. "Gel" means everything fused into one frozen blob; "dust" means everything was hydrolysed into dead monomers.

| Scenario (S = 16) | At 20% of run: backbone / species | Final | Verdict |
|---|---|---|---|
| C / water / 300 K | 1295 / 4 | one blob, 3 species | **gel** |
| Si / water / 300 K | 2 / 19 | dead = 1.00 by step ~120 | **dust** |
| Si / methane / 94 K | 776 / 29 | gel, 0 bond breaks | slow, then frozen |
| Si+C / H₂SO₄ / 330 K | 64 / **98** | dead 0.92 | richest early, then decays |
| Si / water, Si–Si +50% | 2 / 17 | dead 1.00 | knob does nothing |

The real **orderings** come out right without fudging:
- Water kills Si and spares C.
- Methane spares Si.
- Acid is the middle ground.
- Si–O is the sink.

The real **magnitudes** only ever give gel or dust:
- At real temperatures, no bond ever breaks.
- One shared compressed temperature turns one backbone to gel and the other to dust, because the C/Si bond-energy ratio of 1.56 is too wide.
- Raw water attack kills Si within about 2 s of a 60 s demo.

**Tuning recipe:**
1. **Sweet spot E_backbone / kT_eff ≈ 3.5–4.5.** C/water peaks at E/kT ≈ 4.1 (chain 188, 25 species). Si/dry peaks at ≈ 3.4–4.4 (up to 72 species). Below 3 the world falls apart into monomers; above ~5 it gels.
2. **Per-backbone temperature scaling.** Set `kT_eff = E_backbone / 4` at the solvent's reference temperature, then scale with T/T_ref. The player's temperature slider moves E/kT between about 2 and 8.
3. **Hydrolysis rescale.** Multiply water attack on Si by 0.03. At that rate the Si backbone peaks at 620 atoms at step 240 and is half dead at step 1920, so the player sees it grow and then rust into sand. Aim for a half-life of about ⅓ of the demo.
4. **Log-compressed rates for Titan.** Use `rate_log10` instead of raw Arrhenius. Clamp kin ≥ 0.3 (or tick cold worlds faster) and label it "slow world".
5. **Acid attack on C ÷10** (to about 1e-5 at the toy rate).
6. **Anti-gel structure.**
   - Use H:X ≈ 2. At H = 0.6, under the same rules, C forms 121-long chains and Si forms a 35-species soup.
   - Use spatial locality and a branching penalty.
   - Raise a frozen-world alarm when the largest molecule exceeds 30% of atoms.
7. **Live monitors:**
   - largest backbone 10–200 atoms (of ~2k)
   - species count rising
   - at least 1 break per ~100 bonds per tick
   - dead fraction below 0.5

Caveats:
- The model has no space, geometry, rings, π bonds or catalysis.
- All runs are single-seed.
- The gel result is partly an artefact of the well-mixed setup; spatial locality should widen the sweet spot.

### 6.4 Recommended architecture and emergence milestones

No published model covers chemistry → protocell → organism → ecosystem fast enough for a 3-minute demo. Spontaneous emergence of replicators is still an open problem (Kruszewski & Mikolov 2021, doi:10.1162/artl_a_00355) **consensus within ALife**. So we use a hybrid (note 03) `[INFERRED]`:

```
L0 Solvent/energy field   Gray-Scott-style texture (Pearson 1993): food, light, solvent hostility
L1 Atoms (32k–131k)       particle-life forces from EN/valence + typed bond slots (Hutton 2002)
L2 Molecules/protocells   chains, rings, templated copies, membranes; CPU sampler every ~0.5 s
L3 Organisms (≤2k)        promoted on Gánti chemoton criteria; genome = own atom sequence → Life-Engine cell types
L4 Ecosystem              energy-conserving producers / grazers / predators / decomposers
```

The element knobs keep mattering after promotion. An organism's HP comes from its bond energies, and its solvent affinity decides whether it dissolves. We seed a few replicator chains, as Hutton did, and say so: "we seed a spark; everything after is emergent."

| Target t | Milestone | Detector |
|---|---|---|
| 0:05 | first bond / cluster | bond count |
| 0:20 | chain of 6 or more | graph walk |
| 0:40 | ring / membrane | cycle detection |
| 0:55 | replicator | parent and child chains with the same sequence |
| 1:10 | autocatalytic set | RAF check (Hordijk & Steel 2004, doi:10.1016/j.jtbi.2003.11.020) |
| 1:30 | first organism | chemoton criteria (Gánti 2003, doi:10.1007/978-1-4419-8903-1) |
| 2:00 | producer bloom | more than 20 agents with producer genes |
| 2:20 | grazer, then predator | mouth/killer genes with a positive energy balance |
| 2:45 | 3 trophic levels + population oscillation | population chart |

These timings are targets, not measurements.

**Demo arc:**
1. Carbon in water works, while naive silicon in water stalls at "chain".
2. Move silicon to cold methane: it survives but sits still.
3. Switch to an acid world with a Si–C hybrid: silicon-rich life appears, and it looks different.

### 6.5 GPU bonding scheme (three.js TSL r187)

TSL r187 exposes only `atomicLoad/Store/Add/Sub/Max/Min/And/Or/Xor`. It has **no compare-exchange or exchange** (verified from source, note 05). We don't need them.

- **Binning: fixed-capacity buckets.**
  - Clear `cellCount`, then `s = atomicAdd(cellCount[c],1)`; if `s < CAP`, write `cellItems[c*CAP+s] = i`.
  - CAP 16–32; cell size = interaction radius. No prefix pass.
  - Three's `CountingSort` has a single-threaded prefix pass, which is fine at ≤4096 bins.
  - **Never reorder particles**, because bonds store particle IDs.
- **Bond storage.** Bonds live in rows `bond[i*4+k]`, and only thread i writes row i. A bond pulls only if both ends hold it (Tidemote's `holdsBack` rule).
- **Breaking.** Roll `hash(min(i,j), max(i,j), tick) < exp(−E/kT)·dt + hydrolysis`. Both ends get the same roll without communicating.
- **Forming.**
  - Each particle proposes its best free neighbour, using a symmetric score with hash jitter and an index tie-break.
  - The bond commits if the choice is mutual (`prop[prop[i]] == i`), and each side writes its own row.
  - This is locally-dominant (handshake) matching (Fagginger Auer & Bisseling 2012, doi:10.1007/978-3-642-30397-5_10). b-Suitor extends it to valence b (Khan et al. 2016, doi:10.1137/15m1026304).
- **Fallback.** If the match rate is too low, add an `atomicMax` handshake on packed `(score<<17)|id`. It supports up to 131,072 particles and still needs no compare-exchange.
- **Readback.** Collect stats with `atomicAdd` and read them with `getArrayBufferAsync` every ~0.5 s.
- **Rendering.** Draw bonds as N×4 instanced lines.

---

## 7. Prior art and differentiation

| Project | Overlap (1–5) | Player edits laws? | Life from chemistry? | How we differ |
|---|---|---|---|---|
| **Tidemote** (tidemote.com; WebGPU, repo created Oct 2026) | **5** | No. Its eight bench tools "only do what the world could do itself" | No. 96 seeded species; its "abiogenesis" sparks a random genome from silt | We expose the periodic table; life must be chemically possible; C vs Si A/B |
| ALIEN (chrxh, CUDA desktop) | 4 | Sim parameters only | Partly | Runs in the browser; creatures are built from element rules |
| Particle Life apps | 3 | Abstract random matrix | No replication | Our matrix comes from chemistry and is only layer 1 |
| Life Engine / Biogenesis | 3 | World sliders | Pre-built cell types | Our organisms have to arise from chemistry |
| squirm3 / Living Physics (Hutton) | 3 | Abstract rule table | Seeded replicators | Real elements, plus ecology and presentation |
| Habitat Sim (matt-bat) | 3 | Planet parameters | Aggregate numbers | Ours is a particle spectacle |
| Spore / Thrive | 2 | No | Scripted | "Spore if the periodic table were the level editor" |

GitHub and itch.io searches for silicon-life or alien-biochemistry simulators found nothing relevant `[POP]`. Given the short search, our confidence that the gap is real is moderate.

**Three judge lines (note 05):**
1. "Tidemote lets you watch a world; we let you rewrite its physics."
2. "Life isn't seeded here; it has to be chemically possible." Be honest that we do seed a replicator spark.
3. "It's a controlled experiment on the hook: carbon vs silicon side by side."

---

## 8. Presentation

**Timeline** (`data/timeline.json`):

| Year | Event | Status |
|---|---|---|
| 1891 | Scheiner credited with first proposing silicon life | secondary only (via Petkowski 2020) |
| 1894 | Wells, "Another Basis for Life" | title and year only; **quote unverified** |
| 1934 | Weinbaum, "A Martian Odyssey": a silicon creature whose bricks are its waste | `[POP]` plot summary |
| 1955 | Asimov, "The Talking Stone" (siliconies) | `[POP]` |
| 1961 | Asimov, "Not as We Know It" (Sept) | `[POP]`; contents unverified |
| 1967 | Star Trek, "The Devil in the Dark" (the Horta), 9 Mar | `[POP]` |
| 1973 | Sagan calls himself a "carbon chauvinist" | via Petkowski 2020 |
| 1982 | Cairns-Smith, *Genetic Takeover* | `[BOOK]` |
| 2007 | NRC "Weird Life" report | DOI verified |
| 2010 → 2025 | Arsenic life claimed, then retracted | **refuted** |
| 2016 | Kan et al.: an enzyme makes Si–C bonds | `[PEER]` |
| 2020 | Petkowski review; Venus phosphine claim | `[REVIEW]`; **disputed** |
| 2024 | Mirror-life warning in *Science* | `[PEER]` |
| NET Jul 2028 | NASA Dragonfly launches for Titan (arrival 2034) | NASA page |

**Relatable facts:**
- Earth's crust is about 28% Si and 0.02% C; the human body is 18% C and 0.002% Si (CRC; Wikipedia) **consensus**.
- Cosmic C:Si is about 10:1.
- Diatoms do about a fifth of global primary production (Malviya 2016).
- Disilane ignites at 0 °C, while ethane survives O₂ at 200 °C.
- Chips are refined from silica sand `[POP]` (not separately sourced).

**Strongest verified hook lines:**
1. **The flip.** Use the crust vs body percentages, and drop the "1,400 to 1" ratio (§1.1).
2. **The Horta.** "In 1967 Captain Kirk met a living rock and nearly killed it, because he assumed life had to look like him. We built a world where you decide what 'life' is made of."
3. **Venus.** "Fifty kilometres above Venus the clouds are sulfuric acid. A 2020 study found silicon chemistry does better there than in water. So what grows in acid clouds?" Say "below 100 °C", not "room temperature".

The "pocket" line ("Hold up your phone. That's sand we taught to think") lands well, but it rests on an unsourced `[POP]` fact. Use it as a closer, not as evidence.

**Off-limits:**
- the Wells quote
- the Reynolds 1893 address
- Asimov's "six alternative biochemistries"
- "almost certainly impossible" as a quote
- Arnold's 2018 Nobel (from memory, not re-checked)
- an unqualified "scientists believe silicon life is possible"

Open cold, with the sim already running (`docs/TRACK.md`).

**Images** (public domain; link by URL):
- Haeckel Diatomea: https://commons.wikimedia.org/wiki/File:Haeckel_Diatomea.jpg
- Haeckel Stephoidea: https://commons.wikimedia.org/wiki/File:Haeckel_Stephoidea.jpg
- NOAA diatoms: https://commons.wikimedia.org/wiki/File:Diatoms_through_the_microscope.jpg
- Huygens on Titan: https://commons.wikimedia.org/wiki/File:Huygens_surface_and_sky_of_Titan.jpg
- Pioneer Venus UV: https://commons.wikimedia.org/wiki/File:Venuspioneeruv.jpg

There is **no usable Horta image** (Paramount copyright). If we add a Horta-like creature, treat it as homage only.

---

## 9. Open questions and what we'd verify next

1. **Does the spatial GPU sim reach the sweet spot?** This is the biggest risk. Build the live monitors (§6.3) on day one and re-run the S, H:X and attack sweeps in the engine.
2. **Real hydrolysis rate constants.** We need half-lives for Si–Si, Si–H and Si–O–Si against pH and temperature. What we read gives only ordinal timescales. Leads: Petkowski 2020 refs [60], [81], [100]–[102]; Issa 2019 (doi:10.1038/s41598-019-54095-0).
3. **Unverified numbers:**
   - Si=O and C=O π energies (Schmidt 1987, doi:10.1021/ja00251a029, paywalled)
   - SiO D₀ ≈ 800 kJ/mol
   - ε of 100% H₂SO₄ (Gillespie & Cole 1956) and of liquid NH₃ (Baldwin & Gill 1970)
   - bond enthalpies for B, N, O, P, S, Ge, As, F and Cl (textbook values)
4. **Texts not read:** NRC 2007 in full; Schulze-Makuch & Irwin 2006 and 2018; Asimov 1961; the Wells 1894 essay; Seager 2024 beyond its title.
5. **Claims not re-checked:** Arnold's 2018 Nobel; the assembly-index threshold of ~15 in Marshall 2021; the ASM database counts (Seager 2016).
6. **The Sims 1994 DOI** (§1).
7. **Si chemistry in liquid ammonia** has not been studied (Petkowski 2020), so that world's Si attack score of 0.75 is a guess. A 2026 ChemRxiv preprint on silane bilayers in NH₃ (doi:10.33774/coe-2026-k1tk0) is worth reading.

---

## 10. References

De-duplicated across `notes/` and `data/`. All DOIs were resolved on 2026-11-07 unless noted. Tags as above.

**Silicon chemistry and biology**
- Petkowski JJ, Bains W, Seager S 2020. On the potential of silicon as a building block for life. *Life* 10:84. doi:10.3390/life10060084 `[REVIEW]`
- Bains W 2004. Many chemistries could be used to build living systems. *Astrobiology*. doi:10.1089/153110704323175124 `[PEER/REVIEW]`
- Bains W, Petkowski JJ, Zhan Z, Seager S 2021a. Evaluating alternatives to water as solvents for life: sulfuric acid. *Life* 11:400. doi:10.3390/life11050400 `[PEER]`
- National Research Council 2007. *The Limits of Organic Life in Planetary Systems*. doi:10.17226/11919 `[BOOK]`
- Pace NR 2001. The universal nature of biochemistry. *PNAS*. doi:10.1073/pnas.98.3.805 `[PEER]`
- Benner SA, Ricardo A, Carrigan MA 2004. *Curr Opin Chem Biol*. doi:10.1016/j.cbpa.2004.10.003 `[REVIEW]`
- Kan SBJ, Lewis RD, Chen K, Arnold FH 2016. *Science*. doi:10.1126/science.aah6219 `[PEER]`
- Kan SBJ et al. 2017. *Nature*. doi:10.1038/nature24996 `[PEER]`
- West R, Fink MJ, Michl J 1981. *Science*. doi:10.1126/science.214.4527.1343 `[PEER]`
- Shimizu K et al. 1998. *PNAS*. doi:10.1073/pnas.95.11.6234 `[PEER]`
- Cha JN et al. 1999. *PNAS*. doi:10.1073/pnas.96.2.361 `[PEER]`
- Kröger N, Deutzmann R, Sumper M 1999. *Science*. doi:10.1126/science.286.5442.1129 `[PEER]`
- Tréguer PJ, De La Rocha CL 2013. *Annu Rev Mar Sci*. doi:10.1146/annurev-marine-121211-172346 `[REVIEW]`
- Coskun D et al. 2019. *New Phytol*. doi:10.1111/nph.15343 `[REVIEW]`
- Malviya S et al. 2016. *PNAS*. doi:10.1073/pnas.1509523113 `[PEER]`
- Cairns-Smith AG 1982. *Genetic Takeover and the Mineral Origins of Life*. CUP `[BOOK]`
- Cairns-Smith AG 1985. *Seven Clues to the Origin of Life*. CUP `[BOOK]`
- Kloprogge JT, Hartman H 2022. *Life*. doi:10.3390/life12020259 `[REVIEW]`
- "Potential misassumptions on the clay hypothesis…" 2025. *Front Astron Space Sci*. doi:10.3389/fspas.2025.1678046 `[PEER]` (title only)
- Schulze-Makuch D, Irwin LN 2006. *Naturwissenschaften*. doi:10.1007/s00114-005-0078-6 `[PEER]` (not read)
- Schulze-Makuch D, Irwin LN 2018. *Life in the Universe*, 3rd ed. doi:10.1007/978-3-319-97658-7 `[BOOK]`
- Irwin LN, Schulze-Makuch D 2020. *Universe*. doi:10.3390/universe6090130 `[REVIEW]`
- Peng 2014. *Silicon*. doi:10.1007/s12633-014-9254-7 `[PEER, low weight]`
- Jacob 2015. *Silicon*. doi:10.1007/s12633-014-9270-7 `[PEER, low weight]`
- Madan et al. 2025. *QRB Discovery*. doi:10.1017/qrd.2025.10012 `[PEER]`
- Silane bilayers in liquid ammonia, 2026. ChemRxiv. doi:10.33774/coe-2026-k1tk0 `[PREPRINT]` (title only)
- Petkowski JJ, Seager MD, Bains W, Seager S 2024. *Sci Rep*. doi:10.1038/s41598-024-67342-w `[PEER]`
- Iota V, Yoo C-S, Cynn H 1999. *Science*. doi:10.1126/science.283.5407.1510 `[PEER]`
- Issa AA et al. 2019. *Sci Rep*. doi:10.1038/s41598-019-54095-0 `[PEER]`
- Xiang et al. 2021. *Ecotox Env Saf*. doi:10.1016/j.ecoenv.2021.112631 `[REVIEW]`

**Physical data**
- Wang Y, Poirier RA 1998. *Can J Chem*. doi:10.1139/cjc-76-4-477 `[PEER]`
- Schmidt MW, Truong PN, Gordon MS 1987. *JACS*. doi:10.1021/ja00251a029 `[PEER]` (not read)
- Filippou 2014. doi:10.1002/anie.201308433 `[PEER]` (via Wikipedia)
- Kobayashi 2019. doi:10.1002/anie.201905198 `[PEER]` (via Wikipedia)
- Anders E, Grevesse N 1989. *GCA*. doi:10.1016/0016-7037(89)90286-X `[PEER]`
- Lodders 2003. doi:10.1086/375492 (values not extracted)
- Asplund et al. 2009. doi:10.1146/annurev.astro.46.060407.145222 (values not extracted)
- Rudnick & Gao 2003. doi:10.1016/B0-08-043751-6/03016-4 (values not extracted)
- Baldwin J, Gill JB 1970. doi:10.1080/00319107008084075 `[PEER]` (values not read)
- Gillespie RJ, Cole RH 1956. doi:10.1039/TF9565201325 `[PEER]` (value not read)
- CRC Handbook `[BOOK]`
- Wikipedia data pages (abundances, electronegativities, BDE, ammonia) `[POP]`
- Engineering ToolBox dielectric table `[POP]`

**Other biochemistries, solvents and energy**
- Westheimer FH 1987. doi:10.1126/science.2434996 `[PEER]`
- Cooper GJT et al. 2011. doi:10.1002/anie.201105068 `[PEER]`
- Tsytovich VN et al. 2007. doi:10.1088/1367-2630/9/8/263 `[PEER]`
- Budisa N, Schulze-Makuch D 2014. doi:10.3390/life4030331 `[PEER]`
- Saladino R et al. 2012. doi:10.1016/j.plrev.2011.12.002 `[REVIEW]`
- McKay CP 2016. doi:10.3390/life6010008 `[REVIEW]`
- McKay CP, Smith HD 2005. doi:10.1016/j.icarus.2005.05.018 `[PEER]`
- Strobel DF 2010. doi:10.1016/j.icarus.2010.03.003 `[PEER]`
- Lin L-H et al. 2006. doi:10.1126/science.1127376 `[PEER]`
- Chivian D et al. 2008. doi:10.1126/science.1155495 `[PEER]`
- Atri D 2016. doi:10.1098/rsif.2016.0459 `[PEER]`
- Seager S et al. 2023. doi:10.1073/pnas.2220007120 `[PEER]`
- Seager S et al. 2024. doi:10.1089/ast.2023.0082 `[PEER]`
- Bains W et al. 2021b. *PNAS*. doi:10.1073/pnas.2110889118 `[PEER]`
- Pinheiro VB et al. 2012. doi:10.1126/science.1217622 `[PEER]`
- Hoshika S et al. 2019. doi:10.1126/science.aat0971 `[PEER]`
- Nielsen PE et al. 1991. doi:10.1126/science.1962210 `[PEER]`
- Schöning K-U et al. 2000. doi:10.1126/science.290.5495.1347 `[PEER]`
- Malyshev DA et al. 2014. doi:10.1038/nature13314 `[PEER]`
- Adamala KP et al. 2024. doi:10.1126/science.ads9158 `[PEER]`
- Joyce GF 1994. Foreword, *Origins of Life: The Central Concepts* `[BOOK]`
- Feinberg G, Shapiro R 1980. *Life Beyond Earth* `[BOOK]`
- Johnson SS et al. 2018. doi:10.1089/ast.2017.1712 `[PEER]`
- Cleaves HJ et al. 2023. doi:10.1073/pnas.2307149120 `[PEER]`
- Seager S, Bains W, Petkowski JJ 2016. doi:10.1089/ast.2015.1404 `[PEER]`

**Controversies** (all `[PEER]` unless noted)
- Wolfe-Simon F et al. 2011 (RETRACTED). doi:10.1126/science.1197258
- Reaves ML et al. 2012. doi:10.1126/science.1219861
- Erb TJ et al. 2012. doi:10.1126/science.1218455
- Retraction notice 2025. doi:10.1126/science.adu5488
- Stevenson J, Lunine J, Clancy P 2015. doi:10.1126/sciadv.1400067
- Palmer MY et al. 2017. doi:10.1126/sciadv.1700022
- Sandström H, Rahm M 2020. doi:10.1126/sciadv.aax0272
- Greaves JS et al. 2020. doi:10.1038/s41550-020-1174-4
- Snellen 2020. doi:10.1051/0004-6361/202039717
- Akins 2021. doi:10.3847/2041-8213/abd56a
- Villanueva 2021. doi:10.1038/s41550-021-01422-z
- Cordiner 2022. doi:10.1029/2022GL101055
- Greaves 2023. doi:10.1029/2023GL103539
- Clements 2024. doi:10.1017/S1743921324001509
- Mràzikovà 2024. doi:10.1089/ast.2023.0046
- Bains W et al. 2024. doi:10.3389/fspas.2024.1372057 `[REVIEW]`
- Tang W et al. 2026, EPSC abstract. doi:10.5194/epsc2026-1119 `[PREPRINT]`
- Marshall SM et al. 2021. doi:10.1038/s41467-021-23258-x
- Sharma A et al. 2023. doi:10.1038/s41586-023-06600-9
- Uthamacumaran A et al. 2024. doi:10.1038/s41540-024-00403-y
- Jaeger J 2024. doi:10.1007/s00239-024-10163-2
- Ozelim L et al. 2026. doi:10.1038/s44260-026-00088-w

**Artificial life and simulation** (all `[PEER]` unless noted)
- Hutton TJ 2002. doi:10.1162/106454602321202417
- Hutton TJ 2007. doi:10.1162/artl.2007.13.1.11
- Dittrich P, Ziegler J, Banzhaf W 2001. doi:10.1162/106454601753238636 `[REVIEW]`
- Fontana W, Buss LW 1994. doi:10.1073/pnas.91.2.757
- Mathis C et al. 2024. doi:10.1063/5.0207358
- Hordijk W, Steel M 2004. doi:10.1016/j.jtbi.2003.11.020
- Hordijk W, Steel M, Dittrich P 2018. doi:10.1088/1367-2630/aa9fcd
- Eigen M, Schuster P 1977. doi:10.1007/BF00450633
- Pearson JE 1993. doi:10.1126/science.261.5118.189
- Dittrich P, Speroni di Fenizio P 2007. doi:10.1007/s11538-006-9130-8
- Gánti T 2003. *Chemoton Theory*. doi:10.1007/978-1-4419-8903-1 `[BOOK]`
- Kruszewski G, Mikolov T 2021. doi:10.1162/artl_a_00355
- Schmickl T et al. 2016. doi:10.1038/srep37969
- Chan BW-C 2019. doi:10.25088/complexsystems.28.3.251
- Chan BW-C 2020. doi:10.1162/isal_a_00297
- Plantec E et al. 2025. doi:10.1162/artl_a_00471
- Mordvintsev A et al. 2020. doi:10.23915/distill.00023
- Ofria C, Wilke CO 2004. doi:10.1162/106454604773563612
- Lenski RE et al. 2003. doi:10.1038/nature01568
- Sims K 1994. doi:10.1162/artl.1994.1.353 (**DOI looks malformed; re-check**)
- Kauffman 1986, *J Theor Biol* 119:1 (no DOI recorded)
- Ray TS 1991, Tierra `[BOOK]`
- Yaeger 1994, Polyworld `[BOOK]`
- Sayama 2009, Swarm Chemistry (DOI not verified)
- Rafler 2011, https://arxiv.org/abs/1111.1567 `[PREPRINT]`
- Particle Lenia, https://google-research.github.io/self-organising-systems/particle-lenia/ `[POP]`
- Fagginger Auer BO, Bisseling RH 2012. doi:10.1007/978-3-642-30397-5_10
- Khan A et al. 2016. doi:10.1137/15m1026304
- Luby M 1985. doi:10.1145/22145.22146

**Software, prior art and press** `[POP]`
- Tidemote: https://tidemote.com · https://github.com/thallada/tidemote
- ALIEN: https://github.com/chrxh/alien
- squirm3: https://github.com/timhutton/squirm3
- Living Physics: https://github.com/timhutton/livingphysics
- Habitat Sim: https://github.com/matt-bat/habitat-sim
- Particle Life: https://github.com/hunar4321/particle-life · https://github.com/tom-mohr/particle-life-app
- gpu-life: https://github.com/silvernio/gpu-life
- lisyarus WebGPU particle-life blog; programmingattack WebGPU blog
- The Life Engine (thelifeengine.net)
- three.js r187 source (`AtomicFunctionNode.js`, `CountingSort.js`, compute examples)
- NASA Dragonfly: https://science.nasa.gov/mission/dragonfly/
- Wikipedia pages: Wells, Weinbaum, Asimov, "The Devil in the Dark", GFAJ-1, body and crust composition
- Wikimedia Commons images (§8)
