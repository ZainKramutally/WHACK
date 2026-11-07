# 02 — Alternative biochemistries (non-silicon)

Round 1 notes. Axis: other backbones, solvents, energy sources, information polymers, and frameworks for "life as we don't know it". Silicon is covered in a separate note.

Tags: `[PEER]` `[REVIEW]` `[PREPRINT]` `[BOOK]` `[POP]` `[INFERRED]`. Status: **consensus** / **plausible/theorised** / **disputed** / **refuted**.
DOIs marked ✓ were resolved against Crossref on 2026-11-07, with title and first author checked. Abstracts were read via OpenAlex where available. Claims marked *(abstract not read)* come from the cited paper's known content and still need a full-text check.

---

## 0. Anchor reviews

- Bains 2004, "Many chemistries could be used to build living systems", *Astrobiology* — 10.1089/153110704323175124 ✓ `[REVIEW]`. A survey of non-carbon scaffolds and non-water solvents. Argues that the chemistry can be non-terran, provided the solvent and temperature suit the bond energies. **plausible/theorised**
- National Research Council 2007, *The Limits of Organic Life in Planetary Systems* — 10.17226/11919 ✓ `[BOOK]`. The NASA-commissioned "weird life" report, which covers solvents, polymers and energy sources. **consensus that alternatives are worth searching for; no consensus on which**
- Benner, Ricardo & Carrigan 2004, "Is there a common chemical model for life in the universe?", *Curr Opin Chem Biol* — 10.1016/j.cbpa.2004.10.003 ✓ `[REVIEW]`. Argues that a genetic polymer needs a repeating-charge ("polyelectrolyte") backbone so it can do Darwinian evolution. This is the source of the "polyelectrolyte theory of the gene". **plausible/theorised**

## 1. Alternative backbone / structural elements

| Candidate | Core idea | Main problem | Status | Source |
|---|---|---|---|---|
| **Boron (boranes, B–N)** | B–N is isoelectronic with C–C, and boranes form cage and chain compounds | Boranes burn in O₂ and are unstable in water. Boron is cosmically rare. Might suit reducing, water-poor worlds | **plausible/theorised** (weak) | Bains 2004 `[REVIEW]`; Wikipedia summary `[POP]` |
| **Nitrogen–phosphorus** | P–N chains (phosphazenes) can form long backbones | Reactive. No known natural route to long chains | **plausible/theorised** (weak) | Bains 2004 `[REVIEW]` |
| **Sulfur** | S–S chains (catenation) | Tends to form unbranched rings or chains, with little branching or functional diversity. Too reactive | **plausible/theorised** (weak) | Bains 2004 `[REVIEW]` |
| **Arsenic replacing phosphorus** | Use arsenate (AsO₄³⁻) instead of phosphate in the DNA backbone | Arsenate esters hydrolyse far faster than phosphate esters (Westheimer 1987, 10.1126/science.2434996 ✓ `[PEER]`) | **refuted** (GFAJ-1; see controversies) | below |
| **Germanium** | Same group as C and Si | Bonds weaker than Si, and Ge is far rarer. Sagan mentions it only in passing | **plausible/theorised** (very weak) | Sagan via Wikipedia `[POP]`; `[INFERRED]` |
| **Inorganic cells / polyoxometalates (Cronin iCHELLs)** | Metal-oxide clusters (polyoxometalates) form membrane-bound "cells" with redox-active walls, like compartments | Lab compartments only. No replication or evolution shown | **plausible/theorised** (experimental proof-of-concept of compartments) | Cooper et al. 2011, *Angew Chem Int Ed* — 10.1002/anie.201105068 ✓ `[PEER]` |
| **Plasma-dust helices** | In simulations, charged dust in plasma self-organises into helical strings that show "bifurcations that serve as memory marks, self-duplication, metabolic rates" (abstract) | Simulation only. No heredity with variation shown experimentally | **plausible/theorised** (speculative) | Tsytovich et al. 2007, *New J Phys* — 10.1088/1367-2630/9/8/263 ✓ `[PEER]` |
| **Nuclear-matter life (neutron stars)** | Life built from nuclear interactions on a neutron-star crust, running about a million times faster | No mechanism worked out | **plausible/theorised** (pure speculation) | Feinberg & Shapiro 1980, *Life Beyond Earth* `[BOOK]`, which surveys exotic "plasmobes" and similar ideas. Popularised in Forward's novel *Dragon's Egg* (1980) `[POP]` |
| **Interstellar cloud intelligence** | A whole molecular cloud as one organism | Fiction | n/a | Hoyle 1957, *The Black Cloud* `[POP]` (pop reference only) |

## 2. Alternative solvents

Values are at 1 atm unless noted. Melting and boiling points are standard CRC Handbook values `[BOOK]`. Dielectric constants (ε) come from the Engineering Toolbox liquid-dielectric table `[POP]` (it compiles CRC values), with the measurement temperature noted. The ammonia value at its boiling point and the sulfuric-acid ε are from memory of CRC/Gillespie and still need verification.

| Solvent | mp (K) | bp (K) | ε (T) | Where it occurs | Status as life solvent |
|---|---|---|---|---|---|
| Water H₂O (reference) | 273.15 | 373.12 | 80.1 (293 K) | Earth, Europa/Enceladus oceans | **consensus** (the only known one) |
| Ammonia NH₃ | 195.4 | 239.8 | 16.6 (293 K, pressurised); ~22 near bp (verify) | Ammonia–water oceans inside icy moons, giant-planet clouds | **plausible/theorised** |
| Methane CH₄ | 90.7 | 111.7 | 1.68 (91 K) | Titan's lakes and rain | **plausible/theorised** (disputed for membranes) |
| Ethane C₂H₆ | 90.4 | 184.6 | 1.94 (95 K) | Titan's seas (Ontario Lacus is ethane-rich) | **plausible/theorised** |
| Hydrogen fluoride HF | 189.8 | 292.7 | 83.6 (273 K) | No known natural reservoir. Fluorine is cosmically rare | **plausible/theorised** (weak) |
| Sulfuric acid H₂SO₄ (conc.) | 283.5 | ~610 (decomposes above ~573) | ~100 (298 K, verify) | Venus cloud droplets at 48–60 km | **plausible/theorised** (active research) |
| Formamide HCONH₂ | 275.7 | ~483 (decomposes) | 111 (293 K) | Detected in the ISM and comets. A proposed prebiotic solvent (Saladino et al. 2012, 10.1016/j.plrev.2011.12.002 ✓ `[REVIEW]`) | **plausible/theorised** |
| Hydrogen cyanide HCN | 259.9 | 298.8 | 114.9 (293 K) | Titan's atmosphere, comets | **plausible/theorised** (weak: polymerises) |
| Hydrogen sulfide H₂S | 187.7 | 213.6 | 5.93 (283 K) | Volcanic gases. Narrow liquid range | **plausible/theorised** (weak) |
| Liquid nitrogen N₂ | 63.15 | 77.36 | 1.47 (63 K) | Triton surface and plumes, possibly Pluto | **plausible/theorised** (very weak: too cold) |
| Supercritical CO₂ | triple 216.6 K / 5.18 bar; sublimes 194.7 K at 1 atm | critical 304.1 K / 7.38 MPa | ~1.1–1.6 (density-dependent) | Lower atmosphere of Venus (~740 K, 92 bar), possibly some exoplanets | **plausible/theorised** — Budisa & Schulze-Makuch 2014, *Life* — 10.3390/life4030331 ✓ `[PEER]`. The abstract notes enzymes are "even more stable" in scCO₂ |

**Pattern** `[INFERRED]`: polar, high-ε solvents (H₂O, HF, H₂SO₄, formamide, HCN) dissolve ions and support charged, water-like biochemistry. Non-polar, low-ε cryogenic solvents (CH₄, C₂H₆, N₂) need "inside-out" chemistry: polar groups facing inward and slow reactions.

### Titan membranes: azotosomes and their rebuttal
- Stevenson, Lunine & Clancy 2015, *Science Advances* — 10.1126/sciadv.1400067 ✓ `[PEER]`. Molecular-dynamics simulations showed that an acrylonitrile "azotosome" (a polarity-inverted membrane) is stable and flexible in liquid methane at ~94 K.
- Palmer et al. 2017, *Science Advances* — 10.1126/sciadv.1700022 ✓ `[PEER]`. ALMA detected acrylonitrile (vinyl cyanide) on Titan.
- Sandström & Rahm 2020, *Science Advances* — 10.1126/sciadv.aax0272 ✓ `[PEER]`. Quantum-mechanical calculations predict that "azotosomes are not viable candidates for self-assembly" (abstract). The authors suggest that membranes "may be unnecessary" for Titan life. **Status of azotosomes: disputed, leaning refuted (thermodynamics).**

### Venus: sulfuric-acid biochemistry
- Seager et al. 2023, *PNAS* — 10.1073/pnas.2220007120 ✓ `[PEER]`. Nucleic-acid bases are stable in concentrated H₂SO₄ (81–98%). The abstract notes that Venus's clouds at 48–60 km offer suitable temperatures, sunlight and a liquid solvent.
- Seager et al. 2024, *Astrobiology* — 10.1089/ast.2023.0082 ✓ `[PEER]`. Stability tests of the 20 biogenic amino acids in concentrated H₂SO₄ *(abstract not read; per title)*.
- Bains et al. 2021, *PNAS* — 10.1073/pnas.2110889118 ✓ `[PEER]`. Proposes that ammonia produced by life would neutralise the droplets and explain cloud-chemistry anomalies. **Status: plausible/theorised.** Note: the "Seager/Petkowski 2021 PNAS" in the brief appears to be this Bains-led paper. Seager's own sulfuric-acid stability paper is the 2023 PNAS one.
- The phosphine dispute is in the controversies section below.

## 3. Alternative information and chirality systems

- **XNA**: Pinheiro et al. 2012, *Science* — 10.1126/science.1217622 ✓ `[PEER]`. Six synthetic genetic polymers (XNAs, including HNA, CeNA, LNA, ANA, FANA and TNA) stored and passed on information using engineered polymerases. XNA aptamers were evolved. The abstract concludes that heredity and evolution are "likely to be emergent properties of polymers capable of information storage". **consensus (lab demonstration)**
- **Hachimoji DNA/RNA**: Hoshika et al. 2019, *Science* — 10.1126/science.aat0971 ✓ `[PEER]`. An eight-letter alphabet (four orthogonal base pairs) that meets the structural requirements for Darwinian evolution. It was transcribed to RNA to make a working fluorescent aptamer. **consensus (lab demonstration)**
- **PNA**: Nielsen et al. 1991, *Science* — 10.1126/science.1962210 ✓ `[PEER]`. A peptide backbone with no sugar-phosphate and no charge. That bears on Benner's argument that a backbone needs repeated charges. **consensus (exists); plausible/theorised as a proto-genome**
- **TNA**: Schöning et al. 2000, *Science* — 10.1126/science.290.5495.1347 ✓ `[PEER]`. A threose-sugar backbone that pairs with RNA and DNA, and so is a candidate pre-RNA polymer. **plausible/theorised (as precursor)**
- **Expanded alphabet in a living cell**: Malyshev et al. 2014, *Nature* — 10.1038/nature13314 ✓ `[PEER]`. *E. coli* replicated an unnatural base pair (d5SICS–dNaM). **consensus**
- **Mirror life**: Adamala et al. 2024, *Science* policy forum — 10.1126/science.ads9158 ✓ `[PEER]`. Many authors (including synthetic biologists who had worked towards it) warn that mirror-image bacteria could evade immune systems and predators. They recommend not creating them. **Status: risk assessment; consensus among the signatories, not a field-wide consensus.**

## 4. Energy sources for alternative life

| Source | Earth precedent | Alt-world use | Status | Source |
|---|---|---|---|---|
| Chemosynthesis (redox couples) | Vent and deep-crust microbes | Any world with redox disequilibrium | **consensus** (on Earth) | NRC 2007 `[BOOK]` |
| Radiolysis (radiation splits water → H₂ + oxidants) | *Desulforudis audaxviator*, a single-species ecosystem 2.8 km down, powered by radiolytic H₂ | Subsurface oceans; cosmic-ray-driven life on rogue or airless bodies | **consensus** (Earth); **plausible/theorised** (cosmic-ray version) | Lin et al. 2006, 10.1126/science.1127376 ✓; Chivian et al. 2008, 10.1126/science.1155495 ✓; Atri 2016, *J R Soc Interface*, 10.1098/rsif.2016.0459 ✓ `[PEER]` |
| Thermal gradients ("thermosynthesis") | None confirmed | Vent-like temperature cycling | **plausible/theorised** (weak) | NRC 2007 `[BOOK]` |
| UV / sunlight | Photosynthesis | Venus cloud tops, Titan haze photochemistry | **consensus** (Earth) | NRC 2007; Seager 2023 |
| **Titan acetylene + H₂ → methane** | Analogue of methanogenesis | Life breathing H₂ and eating C₂H₂ in liquid methane. Predicted near-surface H₂ depletion | **plausible/theorised** | McKay & Smith 2005, *Icarus*, 10.1016/j.icarus.2005.05.018 ✓ `[PEER]`. The reaction C₂H₂ + 3H₂ → 2CH₄ releases ~334 kJ/mol *(abstract not read; value from the paper)* |
| Titan H₂ downward flux | n/a | Implies a surface H₂ sink, which fits McKay & Smith but has abiotic explanations too | **disputed** | Strobel 2010, *Icarus*, 10.1016/j.icarus.2010.03.003 ✓ `[PEER]` |

## 5. Frameworks for "life as we don't know it"

- **NASA working definition**: "Life is a self-sustaining chemical system capable of Darwinian evolution." Joyce 1994, foreword to Deamer & Fleischaker (eds.), *Origins of Life: The Central Concepts* (Jones & Bartlett) `[BOOK]`. **consensus as a working definition, but contested philosophically**. It is substrate-neutral, which matters for this game.
- **Assembly theory (AT)**: Sharma et al. 2023, *Nature* — 10.1038/s41586-023-06600-9 ✓ `[PEER]`. Objects are measured by their "assembly index", the minimum number of joining steps needed to build them. A high index combined with many copies indicates selection. Marshall et al. 2021, *Nat Commun* — 10.1038/s41467-021-23258-x ✓ `[PEER]`, proposes a molecular assembly threshold of about 15 as a mass-spectrometry biosignature *(threshold from paper body; verify)*.
  - Critiques: Uthamacumaran et al. 2024, *npj Syst Biol Appl* — 10.1038/s41540-024-00403-y ✓ `[PEER]`, argue that AT is a weaker form of existing compression and complexity measures. Jaeger 2024, *J Mol Evol* — 10.1007/s00239-024-10163-2 ✓ `[PEER]`, gives a "what it does and does not do" critique. Ozelim et al. 2026, *npj Complexity* — 10.1038/s44260-026-00088-w ✓ `[PEER]`, argue it "collapses to dictionary compression". **Status: disputed.**
- **Agnostic biosignatures**: Johnson et al. 2018, *Astrobiology* — 10.1089/ast.2017.1712 ✓ `[PEER]`, "Fingerprinting Non-Terran Biosignatures". Cleaves et al. 2023, *PNAS* — 10.1073/pnas.2307149120 ✓ `[PEER]`, trained a machine-learning model on pyrolysis-GC-MS data that separates biotic from abiotic samples without knowing the specific molecules. **plausible/theorised (method under development)**
- **Bains & Seager chemical space**: Seager, Bains & Petkowski 2016, *Astrobiology* — 10.1089/ast.2015.1404 ✓ `[PEER]`. This is the "All Small Molecules" (ASM) database of volatile molecules with up to 6 non-H atoms, used to screen potential biosignature gases. The exact counts (~14k molecules, ~2.5k biogenic) were not seen in the abstract excerpt; verify before quoting. Related: Petkowski, Bains & Seager 2020, *Life* — 10.3390/life10060084 ✓ (silicon; deferred to the silicon note).

## 6. Controversies

1. **Arsenic life (GFAJ-1)**: Wolfe-Simon et al. claimed it in *Science* (online Dec 2010; issue 2011) — 10.1126/science.1197258 ✓. Rebutted by Reaves et al. 2012, 10.1126/science.1219861 ✓ (no detectable arsenate in DNA), and Erb et al. 2012, 10.1126/science.1218455 ✓ (GFAJ-1 is "arsenate-resistant, phosphate-dependent"). Science issued an expression of concern on 2011-06-03 and **retracted the paper on 2025-07-24** (notice 10.1126/science.adu5488 ✓). **refuted**
2. **Venus phosphine**: Greaves et al. 2020, *Nat Astron* — 10.1038/s41550-020-1174-4 ✓ — reported ~20 ppb PH₃ from JCMT and ALMA. Re-analyses: Snellen et al. 2020, 10.1051/0004-6361/202039717 ✓; Akins et al. 2021, 10.3847/2041-8213/abd56a ✓; Villanueva et al. 2021, 10.1038/s41550-021-01422-z ✓ ("no evidence"). Cordiner et al. 2022, *GRL*, 10.1029/2022GL101055 ✓, set a strict SOFIA upper limit. Greaves et al. 2023 replied with a comment, 10.1029/2023GL103539 ✓. After ALMA recalibration the Greaves team revised the figure down to a few ppb. **disputed (unresolved)**
3. **Azotosomes on Titan**: proposed 2015 (Stevenson), countered 2020 (Sandström & Rahm). **disputed, leaning refuted**
4. **Assembly theory as a life detector**: 2021/2023, with critiques 2024–2026. **disputed**

## 7. Comparison table — candidate biochemistries

| Biochemistry | Backbone | Solvent | Temp range (K) | Environment | Status |
|---|---|---|---|---|---|
| Terran (reference) | C (+ P–O–sugar genetics) | H₂O | 273–395 (known extremes ~250–395) | Earth | **consensus** |
| Ammonia world | C (or N-rich) | NH₃ / NH₃–H₂O | 195–240 (1 atm); wider under pressure | Icy-moon oceans, cold super-Earths | **plausible/theorised** |
| Titan hydrocarbon life | C with N-heads (azotosome-like) | CH₄ / C₂H₆ | 90–185 | Titan | **plausible/theorised**; membranes **disputed** |
| Venus acid-cloud life | C (acid-stable subset) | Conc. H₂SO₄ | ~260–340 (cloud layer) | Venus clouds, 48–60 km | **plausible/theorised** |
| Supercritical-CO₂ life | C (dehydrated-enzyme-like) | scCO₂ | >304 (and >7.4 MPa) | Venus-like deep atmospheres | **plausible/theorised** |
| Fluoride world | C/Si with F | HF | 190–293 | No known body | **plausible/theorised** (weak) |
| Formamide world | C | HCONH₂ | 276–483 | Prebiotic scenarios | **plausible/theorised** |
| Boron/B–N | B–N, boranes | NH₃ / non-oxidising | Cold, reducing | Hypothetical | **plausible/theorised** (weak) |
| Sulfur chains | S–S | H₂S / H₂SO₄ | Varies | Hypothetical | **plausible/theorised** (weak) |
| Arsenic DNA | C with As–O backbone | H₂O | 273–373 | Mono Lake claim | **refuted** |
| Inorganic POM cells | Metal-oxide clusters | H₂O | Lab | Lab | **plausible/theorised** (compartments only) |
| Plasma-dust helices | Charged dust strings | Plasma | Plasma (10³–10⁴ K electrons) | Nebulae, rings | **plausible/theorised** (speculative) |
| Neutron-star nuclear life | Nuclear matter | None | ~10⁶ | Neutron-star crust | speculation `[BOOK]/[POP]` |
| XNA / hachimoji genetics | Synthetic sugars or bases | H₂O | 273–373 | Lab | **consensus** (heredity in vitro); not standalone life |
| Mirror life | Mirror C (D-sugars, L→D amino acids) | H₂O | Terran | Could be built in a lab | **plausible** (feasible); recommended against |

## Facts we can put on a slide (verified)

1. Six synthetic "XNA" genetic polymers can store and pass on information, and they have been evolved in the lab (Pinheiro et al. 2012, *Science*).
2. Scientists built DNA with **8 letters** instead of 4 ("hachimoji"), and it works like DNA (Hoshika et al. 2019, *Science*).
3. The 2010 "arsenic life" bacterium turned out to need phosphate, and *Science* **retracted the paper in July 2025** (Erb 2012; Reaves 2012; retraction 10.1126/science.adu5488).
4. Titan has lakes of liquid methane and ethane at about 94 K (−179 °C). Simulated "azotosome" membranes looked stable there, but later quantum-mechanical calculations say they would not self-assemble (Stevenson 2015; Sandström & Rahm 2020).
5. DNA bases survive in concentrated sulfuric acid, the liquid in Venus's clouds (Seager et al. 2023, *PNAS*).
6. A microbe that lives 2.8 km underground runs on hydrogen made by radioactivity splitting water (Chivian et al. 2008; Lin et al. 2006).
7. In 2024, leading synthetic biologists publicly warned against building **mirror-image bacteria** (Adamala et al. 2024, *Science*).
8. NASA's working definition of life names no element and no solvent: "a self-sustaining chemical system capable of Darwinian evolution" (Joyce 1994).

## Implications for the simulation `[INFERRED]`

The Joyce definition is substrate-neutral, so the game can claim scientific grounding for any world that has (a) a solvent, (b) a backbone that forms chains, (c) an energy gradient and (d) heredity with variation. Each "world" can be a preset of four rule parameters: **temperature/reaction rate**, **bond stability**, **solvent polarity**, and **energy source**.

| Selectable world | Rule changes implied |
|---|---|
| **Earth (water/carbon)**, the baseline | Medium reaction rate, strong and diverse bonds, polar solvent (charged polymers allowed), light plus chemical energy |
| **Titan (methane/ethane, 94 K)** | Very slow tick rate (cold means slow kinetics), so organisms are long-lived and evolve slowly. Non-polar solvent means no ion-based chemistry and "inside-out" membranes, or no membranes at all, with life as free-floating polymers (follows Sandström & Rahm). Energy comes from C₂H₂ + H₂ "food" particles that drift down from the sky (McKay & Smith) |
| **Venus clouds (H₂SO₄ droplets)** | Life is confined to floating droplets, so populations are spatially fragmented and droplet splitting is reproduction. High solvent aggression gives a high decay rate for anything not acid-stable, a strong selection pressure. Sunlight energy |
| **Ammonia ocean (~200–240 K)** | Slower than Earth but faster than Titan. Polar enough for charged chemistry. Narrow liquid band, so a temperature slider can freeze or boil the world |
| **Supercritical CO₂ (deep Venus-like)** | No phase boundaries (no surfaces or droplets), so organisms diffuse freely. Fast diffusion. Rigid "enzymes" give mutation-resistant but low-plasticity organisms |
| **Arsenic world**, a "refuted" easter egg | Backbone bonds hydrolyse fast, so polymers fall apart before they replicate, a teachable failure. Good for showing why phosphate won |
| **Mirror world** | Identical rules but opposite chirality. If mirror and normal life share a map, they cannot eat each other, so you get two non-interacting food webs. A nice emergent demo of why mirror life is a biosafety worry |
| **Plasma-dust nebula** (wildcard) | Helical strings that split and bifurcate. "Memory marks" become heritable traits. Clearly labelled as speculative |

Mechanic suggestions:
- A **genetic alphabet size** knob (2, 4, 8 letters, following hachimoji). More letters mean more information per unit length but higher mismatch error.
- A **"Darwin meter"** that shows whether the system has crossed the Joyce threshold: self-sustaining plus heritable variation plus selection.
- An **assembly-index readout** for "how life-like is this blob?" Present it as a contested metric, which is an honest teaching moment.

## Open questions for round 2

1. Verify the dielectric constants of ammonia at its boiling point and of 100% H₂SO₄, using CRC or primary sources. Get Titan's actual surface temperature and pressure range (93.7 K, 1.5 bar) from Huygens literature.
2. Is there quantitative kinetic data (rate scaling with temperature) we can use to set per-world tick rates in a defensible way, for example Arrhenius factors in cryogenic solvents?
3. Phosphine status after 2023 (JCMT-Venus results, any newer *Nature Astronomy* or *GRL* papers), and whether the Joyce quote's page reference and wording need correcting.
