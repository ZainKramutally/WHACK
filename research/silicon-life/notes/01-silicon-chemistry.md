# 01 — Silicon as a basis for life: chemistry, evidence, environments

Round 1, axis 1. Researcher notes, not prose for the final report.
Tags: `[PEER]` `[REVIEW]` `[PREPRINT]` `[BOOK]` `[POP]` `[INFERRED]`. Status: **consensus** / **plausible/theorised** / **disputed** / **refuted**.
I checked every DOI below against Crossref on 2026-11-07. Structured data is in `../data/silicon.json`.

**Bottom line.** The most thorough review to date, Petkowski, Bains & Seager 2020 (doi:10.3390/life10060084), concludes: *"In no environment is a life based primarily around silicon chemistry a plausible option."* The most it allows is silicon as a **heteroatom**, used sparingly in water or more widely in concentrated sulfuric acid. Fully silicon-backboned chemistry is only stable in cold aprotic solvents, and almost nothing dissolves in those. **[REVIEW] consensus** (in the sense that no peer-reviewed work since says otherwise).

---

## 1. Si vs C chemistry

### 1.1 Bond energies (kJ/mol, mean bond enthalpies unless noted)

Primary column: Petkowski et al. 2020, Table 1 (doi:10.3390/life10060084), taken from the full text on PMC7345352. The "range" column holds other values found in standard tables. Sources disagree by roughly 5–10%, so treat these as relative.

| Bond | Petkowski 2020 | Range / other sources | Note |
|---|---|---|---|
| C–C | 346 (154 pm) | 346–348; alkane BDEs 347–377 (Wikipedia BDE page, citing Blanksby & Ellison 2003) | carbon backbone |
| Si–Si | **222** (233 pm) | 222–226 | **~64% of C–C** |
| C–H | 411 (109 pm) | 411–414 (CH4 average 414) | |
| Si–H | **318** (148 pm) | 318–323 | bond polarity reversed: Si(δ+)–H(δ−). Hydrolyses within hours at physiological pH |
| C–O | 358 (143 pm) | 358–360 | |
| Si–O | **452** (163 pm) | 452–466 | **stronger than any C single bond to a heteroatom; the "oxygen sink"** |
| C–N | 305 (147 pm) | 305 | |
| Si–N | 355 | 355 | hydrolyses (fastest in acid) |
| C–S | 272 (182 pm) | 272 | |
| Si–S | 293 (200 pm) | 293 | hydrolyses |
| Si–C | 318 (185 pm) | ~290–318 | **stable in water**; the one bond that makes a Si–C hybrid biochemistry possible |
| C=C | — | ~602–614 (mean); H2C=CH2 BDE ~710 | π part ≈ 260–270 [BOOK, textbook value, not re-verified this round] |
| Si=Si | — | π part ≈ 100–125 [BOOK, not re-verified this round] | **flag for round 2** |
| C=O | — | ~745–805; formaldehyde 748; CO2 (first BDE) 532 | |
| Si=O | — | no stable molecular Si=O under normal conditions. Diatomic SiO D0 ≈ 800 [BOOK, Luo handbook value, not re-verified] | silica polymerises into Si–O–Si nets instead |
| C–Cl | — | ~327–339 | CCl4 survives years in water |
| Si–Cl | — | ~380–400 [BOOK] | SiCl4 hydrolyses "almost instantly" (Petkowski 2020) |
| C–F | — | ~485 | |
| Si–F | — | ~565–580 (mean); H3Si–F BDE 636 (152 kcal/mol); F3Si–F 695 (166 kcal/mol) (Wikipedia BDE page) | strongest single bond to Si |

How to read the table: Si forms **weaker** bonds than C to itself, to H, to N and to S, and **stronger** bonds to O and F. So oxygen and water pull silicon out of any chain it is part of. **[REVIEW] consensus**

### 1.2 Key chemical differences (all from Petkowski 2020 Table 1 / §3 unless noted)
- **Size.** Covalent radius is 117 pm for Si vs 77 pm for C, so bonds are longer and the atom is easier to attack. **[REVIEW] consensus**
- **Electronegativity.** Si is 1.8 vs C 2.5 (Pauling). Si sits at the δ+ end of almost every bond, which makes it a target for nucleophiles (OH⁻, H2O, NH3). That is the root cause of hydrolysis. **[REVIEW] consensus**
- **Hydrolysis in water.** *"Almost all Si–X bonds, including Si–Si bonds, are readily attacked and hydrolyzed in water."* Silanes (SiH4, Si2H6) keep for years as pure chemicals but are very sensitive to water. Si–H turns into Si–OH within hours at physiological conditions. **[REVIEW] consensus**
- **Thermodynamics.** The free energy of formation from XO2 + H2O (+H2) is strongly positive for silanes and strongly negative for alkanes:

  | Compound | ΔG (kJ/mol) | Carbon analogue | ΔG (kJ/mol) |
  |---|---|---|---|
  | SiH4 | **+434** | CH4 | **−142** |
  | Si2H6 | +881 | C2H6 | −213 |
  | Si3H8 | +1316 | C3H8 | −295 |

  These are Petkowski 2020 Table 2, standard state. Building a silane out of silica is uphill, while building an alkane out of CO2 + H2 is downhill. **[REVIEW] consensus**
- **π bonds.** C=C, C≡C and aromatic rings are stable in water. Si=Si and Si≡Si exist in only *"few examples… highly reactive and unstable in aqueous solution."* Si=C is "very unstable under almost all conditions". Only one stable Si aromatic system is known (Petkowski Table 1). **[REVIEW] consensus**
  - The first stable disilene was **tetramesityldisilene**, made by West, Fink & Michl 1981 (doi:10.1126/science.214.4527.1343). It is a yellow-orange solid that is stable at room temperature *in the absence of air*. It needs bulky mesityl groups to shield the Si=Si bond kinetically. **[PEER] consensus**
- **Hypervalency.** Stable compounds have Si at coordination 3–6 vs C at 1–4. Penta- and hexacoordinate Si is "well known and stable (in some cases even in aqueous solution)". Penta-coordinate intermediates open more reaction paths than carbon has. They also make hydrolysis easy, because OH⁻ attack goes through a stable 5-coordinate intermediate. Stable 5- and 6-coordinate Si is called *"super-chiral"*. **[REVIEW] consensus** (that it is a double-edged sword is **[INFERRED]**)
- **Chirality.** Tetrahedral Si can be a stereocentre. Chiral oligosilanes with up to 26 Si–Si bonds have been synthesised. **[REVIEW] consensus**
- **Polymers.** Polysilanes with up to ~500 consecutive Si–Si bonds are known, and silicone production is about 2 Mt/yr (Petkowski 2020). Silicones (–Si–O–Si– backbone with organic side groups) are the robust Si polymers, but their diversity comes from the **carbon** side chains. **[REVIEW] consensus**
- **SiO2 vs CO2 (the waste problem).** CO2 is a monomeric gas that dissolves and diffuses away. Si cannot form stable Si=O π bonds, so "SiO2" polymerises into a 3D Si–O–Si network solid (quartz, silica). An oxidising silicon metabolism would excrete sand. Petkowski 2020: *"the great majority of the available silicon is almost exclusively bonded to oxygen"* and sits locked in insoluble rocks, and mobilising it has a "tremendous energetic cost". **[REVIEW] consensus**. The "respiration exhales sand" framing is **[INFERRED]**.
- **Interstellar chemistry.** Wikipedia reports that by 1998 astronomers had found 84 C-bearing molecules in the interstellar medium vs 8 Si-bearing ones (half of those also contain C). **[POP]** Treat as a dated, approximate figure that needs an up-to-date census.
- **Catalysis.** No natural enzyme makes Si–C bonds or breaks Si–O bonds (Petkowski 2020). Arnold's lab evolved a *Rhodothermus marinus* cytochrome c that forms Si–C bonds by carbene insertion into Si–H, works in vivo, is enantioselective, and gives more than 15× the turnover of the best synthetic catalysts. Kan, Lewis, Chen & Arnold 2016, Science (doi:10.1126/science.aah6219). **[PEER] consensus.** Caveat from Petkowski: the substrate is a synthetic silane (PhMe2SiH), so these are "contrived conditions". **[REVIEW]**. The C–B follow-up is Kan et al. 2017, Nature (doi:10.1038/nature24996). **[PEER]**

### 1.3 How life on Earth actually uses Si (biosilicification)
- The only biological Si chemistry is **silicic acid → silica** (biosilica). Petkowski 2020. **[REVIEW] consensus**
- **Sponges.** Silicatein α is a cathepsin-L-like protein found in sponge spicules. Shimizu, Cha, Stucky & Morse 1998, PNAS (doi:10.1073/pnas.95.11.6234). Silicatein filaments direct silica polymerisation. Cha et al. 1999, PNAS (doi:10.1073/pnas.96.2.361). **[PEER] consensus**
- **Diatoms.** Polycationic peptides (silaffins) direct the formation of silica nanospheres. Kröger, Deutzmann & Sumper 1999, Science (doi:10.1126/science.286.5442.1129). **[PEER] consensus**
- **Oceans.** The silica cycle is tightly coupled to the C and N cycles and to marine primary production. Tréguer & De La Rocha 2013, Annu. Rev. Mar. Sci. (doi:10.1146/annurev-marine-121211-172346). **[REVIEW] consensus**
- **Plants.** Si is not an essential plant nutrient, and its claimed roles are disputed. Coskun et al. 2019, New Phytologist (doi:10.1111/nph.15343; OpenAlex lists 2018 online). **[REVIEW] disputed**
- The point for the pitch: Earth life uses Si **structurally (as glass armour)** and never as an information or metabolic backbone. **[INFERRED]**

### 1.4 Clay / crystal genes (Cairns-Smith)
- Cairns-Smith proposed that the first "genes" were self-replicating defect patterns in clay crystals (aluminosilicates). Organic life later took over in a "genetic takeover". Sources: *Genetic Takeover and the Mineral Origins of Life* (Cambridge UP, 1982) and *Seven Clues to the Origin of Life* (Cambridge UP, 1985). **[BOOK] plausible/theorised, minority view.** There is no experimental demonstration of clay-crystal heredity. Clays are widely accepted as **catalysts and scaffolds**, though. Kloprogge & Hartman 2022, Life (doi:10.3390/life12020259). **[REVIEW]** A geochemical critique: "Potential misassumptions on the clay hypothesis…", Front. Astron. Space Sci. 2025 (doi:10.3389/fspas.2025.1678046). **[PEER]** I read the title only.
- This is the closest thing to *real* silicon "life" in the literature, and it is a great story for the sim: silicate templates first, carbon takeover later. **[INFERRED]**

### 1.5 Other sources
- Pace 2001, PNAS (doi:10.1073/pnas.98.3.805). Argues biochemistry is probably universal: carbon-based, built from the same kinds of elements, and in water. **[PEER] widely cited view, but disputed by the Bains school**
- Bains 2004, Astrobiology (doi:10.1089/153110704323175124). *"It is the nature of the liquid in which life evolves that defines the most appropriate chemistry."* Speculates about a "silicon biochemistry in liquid nitrogen". **[PEER] plausible/theorised.** Bains later co-authored the 2020 review, which is much more negative.
- NRC 2007, *The Limits of Organic Life in Planetary Systems* (doi:10.17226/11919). This is the US National Academies report on "weird life". **[BOOK/REVIEW]** I verified the DOI but did not read the text this round.
- Benner, Ricardo & Carrigan 2004, Curr. Opin. Chem. Biol. (doi:10.1016/j.cbpa.2004.10.003), "Is there a common chemical model for life in the universe?" **[REVIEW]** Abstract not read.
- Schulze-Makuch & Irwin 2006, Naturwissenschaften (doi:10.1007/s00114-005-0078-6), "exotic forms on other worlds". Also their book *Life in the Universe: Expectations and Constraints* (3rd ed. Springer 2018, doi:10.1007/978-3-319-97658-7) and Irwin & Schulze-Makuch 2020, Universe (doi:10.3390/universe6090130). These are the sympathetic "keep an open mind" camp. **[BOOK]/[REVIEW] plausible/theorised**
- Julius Scheiner first proposed silicon life in 1891 (cited in Petkowski 2020). **[REVIEW] consensus (historical)**
- Feinberg & Shapiro's planet "Thermia", a silicate-melt world, appears in *Life Beyond Earth* (1980). Petkowski 2020 notes CoRoT-7b as a real analogue but argues heat would break Si–O bonds "on a millisecond timescale". **[REVIEW] plausible→refuted for complex chemistry**
- **"Rampelotto 2010, 'Why silicon? Why carbon?'"**: **NOT FOUND** in OpenAlex. The only Rampelotto 2010 papers I found are about extremophiles and astrobiology. **Do not cite** unless someone produces a DOI.
- Journal *Silicon* (Springer) has two short pieces: Peng 2014, "Silicon-Based Life in the Solar System" (doi:10.1007/s12633-014-9254-7), and Jacob 2015, "There is no Silicon-based Life in the Solar System" (doi:10.1007/s12633-014-9270-7). They are opinion pieces with no abstracts. **[PEER, low weight]**
- Newer work on alternative solvents and polymers:
  - Bains, Petkowski, Zhan & Seager 2021, Life (doi:10.3390/life11050400). Most terrestrial biochemicals have half-lives under a second in Venus's clouds, but some synthetic chemical families survive days to weeks at ~60 km altitude. **[PEER] plausible/theorised**
  - Madan et al. 2025, QRB Discovery (doi:10.1017/qrd.2025.10012). Computational model of carbon-free S/P-oxide heteropolymers on Venus. **[PEER] plausible/theorised**
  - A 2026 ChemRxiv preprint on silane bilayers in liquid ammonia (doi:10.33774/coe-2026-k1tk0). Title only. **[PREPRINT]**

---

## 2. Environments where Si-life is argued to do better

| Environment | Argument for | Argument against | Status |
|---|---|---|---|
| **Water (Earth-like)** | Si is everywhere | Silica sink. Nearly all Si–X bonds hydrolyse, so Si is at most a rare heteroatom (Petkowski 2020) | **refuted** as a main backbone. Si as heteroatom: plausible |
| **Cold aprotic cryosolvents** (liquid N2 ~77 K, liquid CH4/C2H6 ~90–110 K; Titan) | No H⁺/OH⁻ to attack Si, so "almost any chemistry is stable", and "the majority of silicon chemical space is available" there (Petkowski 2020). Bains 2004 suggests Si biochemistry in liquid N2 | Solubility is extremely low. Of the few thousand core-metabolism chemicals, *"probably only a dozen or so are soluble in liquid N2 at >ppm level; none… with an –OH group or a molecular weight over 100."* Reactions are also slow at those temperatures | **plausible/theorised, but disfavoured** |
| **Titan specifically** | Liquid methane/ethane seas. McKay 2016, Life (doi:10.3390/life6010008). Azotosome membranes proposed: Stevenson, Lunine & Clancy 2015, Sci. Adv. (doi:10.1126/sciadv.1400067) | Azotosomes are unlikely to self-assemble: Sandström & Rahm 2020, Sci. Adv. (doi:10.1126/sciadv.aax0272). These are carbon-chemistry papers and say nothing specific about Si | azotosome **disputed/refuted** |
| **Concentrated sulfuric acid** (Venus cloud deck, 48–60 km) | Electrophilic chemistry dominates, and the electron-poor Si is a poor target. Chlorosilanes take hours to days to hydrolyse in 100% H2SO4 vs "instantly" in water. Si–Si is *more* stable than Si–C there. Silicon adds more diversity in acid than in water (Petkowski 2020; Bains et al. 2021) | Still an organic-plus-Si hybrid rather than Si-based. Abiotic origin pathways look unlikely in this acid (Bains 2021) | **plausible/theorised** (the surprise finding) |
| **Liquid ammonia** (some icy moons, giant-planet interiors) | Another solvent besides water | Basic, so ammonolysis attacks Si just as water does. Si chemistry in NH3 is essentially unstudied (Petkowski 2020) | **theorised, untested** |
| **Silicate melt / lava worlds** ("Thermia"; CoRoT-7b; often 55 Cnc e, K2-141b in press) | Si–O is the dominant chemistry and is everywhere | At those temperatures Si–O bonds break and reform on millisecond timescales, so no information can be stored (Petkowski 2020) | **refuted** for molecular life |
| **High pressure** | — | I found no specific peer-reviewed Si-life argument | gap, round 2 |
| **Carbon planets (C/O > 1)** | Petkowski Appendix: C ends up in SiC and SiOC. Some O-poor chemistry | Water is rare there | theorised |

---

## 3. Element abundance

Sources: solar system values are Anders & Grevesse 1989 (doi:10.1016/0016-7037(89)90286-X), atoms per 10⁶ Si. Crust values are mass ppm from the CRC Handbook column on Wikipedia's "Abundances of the elements (data page)" **[POP aggregator of BOOK data]**. Round 2 could swap in Lodders 2003 (doi:10.1086/375492) / Asplund 2009 (doi:10.1146/annurev.astro.46.060407.145222) and Rudnick & Gao 2003 (doi:10.1016/B0-08-043751-6/03016-4). I verified those DOIs but did not take values from them.

| El | Solar system (atoms / 10⁶ Si) | Earth crust (ppm by mass, CRC) |
|---|---|---|
| H | 2.79 × 10¹⁰ | 1,400 |
| He | 2.72 × 10⁹ | 0.008 |
| O | 2.38 × 10⁷ | 461,000 |
| C | 1.01 × 10⁷ | 200 |
| N | 3.13 × 10⁶ | 19 |
| Mg | 1.074 × 10⁶ | 23,300 |
| **Si** | **1.00 × 10⁶** | **282,000** |
| Fe | 9.00 × 10⁵ | 56,300 |
| S | 5.15 × 10⁵ | 350 |
| Al | 8.49 × 10⁴ | 82,300 |
| P | 1.04 × 10⁴ | 1,050 |
| B | 21.2 | 10 |

- **C is ~10× more abundant than Si cosmically. Si is ~1,400× more abundant than C in the crust** (282,000 / 200). Another source column on the same data page lists crust C as 3,760 ppm, which gives a ratio of ~75×. Wikipedia quotes "~925×". The crust C figure varies a lot by source, so **quote "roughly 100 to 1,000+ times" and name the source**. **[INFERRED from BOOK data]**
- O outnumbers Si ~24:1 cosmically, which is why Si ends up as silicate. This backs Petkowski's "oxygen sink" point. **[INFERRED]**

---

## 4. Verdict matrix

| # | Side | Claim | Status | Source |
|---|---|---|---|---|
| F1 | for | Si is tetravalent like C and forms chains, rings and chiral centres | consensus | Petkowski 2020 |
| F2 | for | Si is far more abundant than C in rocky-planet crusts | consensus | CRC; Petkowski 2020 |
| F3 | for | Hypervalent (5/6-coordinate) Si gives reaction paths carbon lacks | consensus (chem) / theorised (bio) | Petkowski 2020 |
| F4 | for | Long polysilanes (~500 Si) and silicones exist, so Si can make polymers | consensus | Petkowski 2020 |
| F5 | for | Directed evolution made enzymes that form Si–C bonds, so biology *can* learn Si chemistry | consensus (result) / disputed (relevance) | Kan 2016; Petkowski 2020 |
| F6 | for | In concentrated H2SO4 silicon adds real chemical diversity | plausible/theorised | Petkowski 2020; Bains 2021 |
| F7 | for | In cold aprotic solvents most Si chemistry is stable | plausible/theorised | Petkowski 2020; Bains 2004 |
| F8 | for | Silicate clays may have been the first genetic material | plausible/theorised (minority) | Cairns-Smith 1982/1985 |
| A1 | against | Si–Si (222) is much weaker than C–C (346), while Si–O (452) is stronger, so oxygen wins | consensus | Petkowski 2020 |
| A2 | against | Almost all Si–X bonds hydrolyse in water | consensus | Petkowski 2020 |
| A3 | against | SiO2 is an insoluble polymeric solid, so there is no CO2-like gaseous waste or carbon-cycle analogue | consensus | Petkowski 2020; [INFERRED] |
| A4 | against | Few stable Si=Si/Si=O/Si=C π bonds, so far less structural diversity (no aromatic or carbonyl chemistry) | consensus | Petkowski 2020; West 1981 |
| A5 | against | Silanes are thermodynamically uphill from silica (+434 kJ/mol for SiH4) | consensus | Petkowski 2020 Table 2 |
| A6 | against | C is ~10× more abundant than Si cosmically, and C molecules dominate interstellar chemistry | consensus | Anders & Grevesse 1989; [POP] ISM count |
| A7 | against | Cryosolvents dissolve almost nothing (>ppm only for ~a dozen small molecules) | plausible (modelled) | Petkowski 2020 Fig. 7 |
| A8 | against | Lava worlds break Si–O bonds on millisecond timescales, so no stable information | plausible/theorised | Petkowski 2020 |
| A9 | against | No natural enzyme makes Si–C or breaks Si–O, so Earth life never took the Si route despite plenty of Si | consensus | Petkowski 2020 |
| V | verdict | Si-*based* life: implausible in all assessed solvents. Si as heteroatom or hybrid: plausible, mainly in H2SO4 | consensus (single major review) | Petkowski 2020 |

---

## Facts we can put on a slide (verified)
1. "A silicon–silicon bond is only about two-thirds as strong as a carbon–carbon bond (222 vs 346 kJ/mol), but silicon grabs oxygen harder than carbon does (452 vs 358 kJ/mol)." (Petkowski 2020)
2. "Silicon makes up ~28% of Earth's crust by mass; carbon is 0.02%. Yet every living thing is built on carbon." (CRC; Petkowski 2020)
3. "In space it's the other way round: there are ~10 carbon atoms for every silicon atom." (Anders & Grevesse 1989)
4. "Breathe out carbon and you exhale a gas (CO2). Breathe out silicon and you'd exhale sand (SiO2)." ([INFERRED] from consensus chemistry)
5. "Making methane from CO2 releases energy; making silane (SiH4) from sand costs about 434 kJ/mol." (Petkowski 2020 Table 2, ΔG +434 vs −142)
6. "The first stable silicon double bond wasn't made until 1981, and it only survives with no air around." (West, Fink & Michl 1981)
7. "In 2016 scientists evolved a bacterial enzyme to forge carbon–silicon bonds, something no natural organism does, and it beat the best synthetic catalysts 15-fold." (Kan et al. 2016)
8. "The most thorough review to date concludes: 'In no environment is a life based primarily around silicon chemistry a plausible option.'" (Petkowski, Bains & Seager 2020)

---

## Implications for the simulation (rules and knobs)
All of these are **[INFERRED]** design translations of the chemistry above.

1. **Bond-strength table as the core rule set.** Each element pair gets a bond energy. A bond survives when `E_bond > k·T + solvent_attack`. Slider: **Si–Si strength** (realistic 222 ↔ "carbon-like" 346). Pushing it up shows the "what if" become viable.
2. **Temperature knob.** Low T means weak Si–Si bonds survive but everything moves slowly (lower reaction rate and diffusion/solubility). High T means Si–O network melt, no persistent structures. Expect a "Goldilocks band" that shifts with solvent.
3. **Solvent selector** (water / sulfuric acid / liquid N2-methane / ammonia / magma). It sets three parameters: (a) **attack rate on δ+ Si** (high in water and NH3, low in H2SO4 and N2); (b) **solubility / mobility** (very low in N2/CH4, high in water); (c) **oxygen availability**. This is the cleanest way to show the real result: water kills Si, cryosolvents freeze it, acid partly allows it.
4. **Oxygen sink mechanic.** Any Si atom next to free O has a high chance per tick of turning irreversibly into an inert silica block. This creates the "sand waste" problem and lets players see creatures entomb themselves. An oxygen-abundance slider follows from this (default O:Si ≈ 24:1 cosmic).
5. **π-bond availability → diversity.** Allow double bonds (branching and rigid motifs) for C, and make them rare or unstable for Si (Si=Si only with "bulky shield" neighbours, after West 1981). Measurable outcome: count of distinct stable motifs per run. Expect carbon worlds to diversify faster.
6. **Hypervalency.** Si may hold 5–6 bonds transiently. That speeds reactions (catalysis bonus) but also speeds hydrolysis (attack bonus), so it is a trade-off knob.
7. **Waste-phase rule.** C + O gives a gas that diffuses away, so the environment stays clean. Si + O gives a solid that accumulates, so the environment fills up. This is a strong visual: silicon ecosystems build reefs/shells (like diatoms and sponges) and may get "buried".
8. **Hybrid mode.** A Si–C bond (318, water-stable) is allowed as a "heteroatom" option. This mirrors the actual scientific conclusion (Si as a specialised heteroatom) and makes a satisfying "best of both" end state.
9. **Clay-template mode** (Cairns-Smith). Silicate crystal-defect patterns copy themselves imperfectly and can later be "taken over" by carbon polymers. It is a plausible story mode for emergence without inventing new physics.
10. **Abundance presets.** "Cosmic" (C:Si 10:1) vs "Rocky crust" (Si:C ~1,000:1) vs "Carbon planet" (C/O > 1). This lets the demo show why abundance alone doesn't decide which element life is built on.

---

## Open questions / round 2
- Verify the **π-bond energies** for Si=Si (and Si=C, Si=O) from a primary or handbook source, e.g. Luo *Comprehensive Handbook of Chemical Bond Energies* or a computational review. The current ~100–125 kJ/mol is a textbook value I did not re-verify.
- Read **NRC 2007** chapters on silicon and "weird life", and Schulze-Makuch & Irwin 2018 for the pro-Si arguments (e.g. Si chemistry at high pressure or low T, silanols in liquid N2).
- Get a **rate model**: hydrolysis half-lives of Si–H, Si–Si, Si–O–C vs pH and T. That would turn knob 3 into real numbers. Petkowski's refs [60], [81], [100]–[102] are the leads.
