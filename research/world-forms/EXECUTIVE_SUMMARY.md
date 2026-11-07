# World forms: executive summary

**The answer.** Every landform on the board comes from **five machines plus life**. The controls choose which machines run, and the machine decides the landform. Build the machines as rules and the dramatic shapes follow, along with the surprises. Full detail is in [`REPORT.md`](REPORT.md) and [`data/response-matrix.json`](data/response-matrix.json).

| Machine | Main control |
|---|---|
| M1 **Dissolve** (karst, labyrinths, pitting) | Sea |
| M2 **Precipitate** (sinter, travertine, tufa, crusts) | Sea + a Heat gradient |
| M3 **Crack-and-pry** (hoodoos, fins → arches, polygons, columns) | Heat crossing a phase change |
| M4 **Abrade** (canyons, sea stacks, dunes, rivers) | Sea (waves, floods) + dryness |
| M5 **Stack-and-strip** (mesa → butte → spire, banded walls) | Time |
| M6 **Life-built** (sinter mats, reefs, honeycomb, bio-pits, R12 arches) | Hunger + Light |

## Six control → landform rules for the build

1. **Only Water frost-wedges.** Water expands about 9% when it freezes. Methane and ammonia contract. So hoodoos and frost fins need Water + Heat near freezing. In Methane, arches come from **builders**, and they last because nothing dissolves silicon (R5). [sci]
2. **Methane's stain depends on Light.** Bright gives orange tholin, dim gives pale frost. [sci] (Hörst 2017)
3. **Water's stain depends on Oxygen.** High O gives red beds, low O gives green or grey strata. [sci]
4. **Acid destroys carbonate and spares silica.** So acid + Si+O gives bone-white porous spires (eco-14), and acid + C gives fast karst with no reefs. [sci] analogue
5. **Time deepens; dry heat steepens.** Old + hot + Si+O + past liquid gives banded canyons. The code does the opposite today: heat *lowers* walls (`terrain.ts:66`). [sci] mechanism, [game] rule
6. **Heat max = lava.** The Recipe melts, and as Heat drops it cracks into hexagonal columns. Faster cooling makes thinner columns. [sci] (Goehring 2009)

## Slide facts (verified, consensus)

- Arches NP has over 2,000 arches. Rock under load locks its grains, so erosion carves *toward* arch shapes. (NPS; Bruthans 2014)
- Bryce's hoodoos come from more than 170 freeze-thaw nights a year. (NPS)
- Titan has methane rain, rivers, lakes and organic dunes. (Tomasko 2005; Stofan 2007; Lorenz 2006)
- Hot-spring silica (sinter) grows on microbes, which makes it Earth's clearest case of life turning Si+O into stone. (Konhauser 2001)
- Lost City's carbonate towers reach 60 m, and microbes live in their warm pores. (Kelley 2005)
- Desert varnish grows 1–40 µm per thousand years. (Liu & Broecker 2000)

## Corrections

- Venus has acid **clouds**, not seas. Our Acid world is the cloud deck, and the surface belongs to the Heat extreme.
- Liquid methane is clear. Titan's rivers are real, but **white rivers are [game]**.
- Pore *shapes* are real (diatoms, Lost City). **Glowing pores are [game]**.
- "Acid + Si → sinter" is unsupported. Sinter needs a heat gradient in near-neutral water.
- Stain colours conflict across the atlas, spec and code (methane: orange, grey or slate; acid: sulfur or tan). Fix: `stain(sea, light, o, age)`.

## Decisions for the team

| Decision | Options | Recommendation |
|---|---|---|
| **(a)** Should C+O make lasting stone in Water? | strict R2 (pillars are tissue) · exception · Si builders | Exception: "carbon rusts to air, *unless life in water makes shell*", dissolved by Acid. It is real, fixes eco-03 and eco-06, and adds a twist. |
| **(b)** Lava | 5th Sea · Heat extreme | Heat extreme. A 5th Sea would allow "cold lava" and break the 4-swatch UI. |
| **(c)** eco-01 vs eco-10 canyon | preset framing · rule (age × liquid history) · hybrid | Hybrid: frame it now, but flip the inverted heat→wall rule now. |

**Build next:** liquid surface (S), stain v2 (S), strata bands (S), geology terms in `derive.ts` (S), then the GPU heightfield (M).
