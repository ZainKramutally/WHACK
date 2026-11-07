# Body plans (design F): research report

2026-11-07. Synthesis of `notes/01-evolution-speed.md`, `notes/02-biology-grounding.md`, `notes/04-time-to-trait.md` (rounds 1 and 2) and `data/*.json`. Design context: `docs/emergence/F-body-plan-first.md`, `docs/emergence/README.md` §4, `docs/WORLD_ATLAS.md`, `docs/DESIGN.md`.

**Tags** follow `research/silicon-life/README.md`: `[PEER]` `[REVIEW]` `[PREPRINT]` `[BOOK]` `[POP]` `[INFERRED]`, plus `[sim]` (measured in our toy), `[sci]` (real phenomenon, same direction) and `[game]` (ours). **Status labels:** consensus / plausible / disputed / refuted.

**Honesty note.** Every prototype number comes from a headless Python toy (`prototype/f_ecology.py`) that one person wrote in an afternoon. Its coefficients are authored and uncalibrated, and every one of them is in the `C` dict, so a different ledger moves every number. What generalises is the *structure*:
- generations per sim-second
- which levers matter
- which traits need payoffs rather than time

The round-3 proposal in §9 hasn't been built or run.

---

## 1. Question and method

**Question (F's risk #1, emergence README §4.7):** can worm founders evolve legs, horns, plates and buoyant giants inside a ~3-minute demo, and what population size, mutation rate and time acceleration does that need? A user direction refined the question: *"tons of tiny capsule/worm creatures slowly moulding larger into a variety of procedural species, templated from our fauna categories… species controlled by state machines."* The next goal is a diverse ecosystem (small fliers, large herbivores, apex predators, varied plants) generated simply from the initial dials.

**Method:**
1. **Literature** on evolution speed and ALife/game precedents (notes/01; DOIs Crossref-checked; run parameters marked *recalled* are unverified).
2. **Biology grounding**: F's rules checked against evo-devo and ecology (notes/02; 34 rules).
3. **Headless prototype**, round 1: 255 runs over 85 configs. Round 2: 105 runs of a hybrid engine (notes/04). Times are medians over 3 seeds. "–" means reached in ≤ 1 of 3 seeds. T = 1,300 sim-s equals demo 150 s on the hybrid schedule (×1 until 2:00, then ×40).

---

## 2. Literature: evolution speed and precedents

| Finding | Evidence | Tag / status |
|---|---|---|
| Generation count, not population size, is the binding constraint. Sweep time ≈ ln(f·N)/s, so N only enters through ln N | Haldane 1927; Gerrish & Lenski 1998 | `[PEER]` consensus |
| Visible local patches (f_local ≈ 20%) take about 5–8 generations at s = 0.3, while full fixation takes about 45 | arithmetic (notes/01 §3) | `[INFERRED]` plausible |
| Horns sit on a critical path: diet shift → hunters → horns, two back-to-back sweeps of about 15–20 generations | notes/01 §3 | `[INFERRED]` |
| The co-adaptation of body and controller is *the* brake in Sims-style systems. F has no controller | Cheney et al. 2018; Gupta et al. 2021 | `[PEER]` plausible |
| Rewarding stepping stones is required for complex innovations | Lenski et al. 2003 (Avida EQU) | `[PEER]` consensus |
| Standing variation plus strong selection is fast: stickleback plates went from 100% to 11% complete morph in about 11 generations | Bell et al. 2004; Barrett & Schluter 2008 | `[PEER]`/`[REVIEW]` consensus |
| Arms races accelerate complexity | Zaman et al. 2014; Dawkins & Krebs 1979 | `[PEER]` plausible (escalation itself is consensus) |
| Target-based fitness is deceptive and slow | Woolley & Stanley 2011; Lehman & Stanley 2011 | `[PEER]` consensus within novelty-search work |
| Goals that change speed up evolution | Kashtan, Noor & Alon 2007 | `[PEER]` plausible |

**Precedents** (notes/01 §4, mostly `[POP]`): every system that shows body novelty *within minutes* uses at least one of these:
- a **fixed part vocabulary** (Species: ALRE, Biogenesis, Spore-likes)
- **the player as selector** (Darwin's Demons, Galactic Arms Race, Picbreeder)
- **heavy time acceleration** (Species, The Bibites, Gene Pool)

Open-ended body + brain systems (Sims, Framsticks, Cheney) take hours. F has the vocabulary and no controller, and it can add acceleration, which puts it in the right quadrant. Its evaluation budget (about 80k births) matches what Sims and Cheney used (about 30k) `[INFERRED]` plausible.

---

## 3. Templates as canalization (the user direction)

**Verdict (notes/01 §7, notes/02 §4):** the templated-species idea is honest **only if templates live in development, never in fitness**.

| Principle | What it licenses | Source | Tag / status |
|---|---|---|---|
| Canalization (Waddington's epigenetic landscape) | A soft snap in `develop()` is a canalized landscape | Waddington 1942 | `[PEER]` consensus (concept) |
| Developmental bias | The genotype→phenotype map makes some forms likelier | Uller et al. 2018 | `[REVIEW]` plausible |
| Convergence / limited forms | "The same 9 kinds recur across seeds" is a scientific claim, not an admission | McGhee 2011; Conway Morris 2003 | `[BOOK]` consensus / disputed (predictability) |
| Carcinisation | Attractor body plans are gained ≥ 5 times and lost again | Wolfe et al. 2021 | `[REVIEW]` consensus |
| Trochophore larva, allometry | "Everyone starts as the same tiny capsule" and grows into the template by power laws | Nielsen 2004; Huxley 1932 | `[REVIEW]`/`[BOOK]` consensus |

**Rules:**
- **0% template in fitness.** There's no distance-to-template term, ever.
- The snap is ≤ 50% (κ ≤ 0.5) and applies only to look genes, inside the capture radius.
- Bodies outside every basin are shown as "unnamed form".
- **Roles** (grazer, hunter, builder, filter-feeder) are not body templates. They come from diet `t`, gape and the Si·O flag.
- **Behaviour:** one shared FSM. Morphology unlocks states, and transitions are utility-scored with gene weights. Boids steering runs inside each state.
- **Neutral control (honesty instrument):** with the ledger flattened, basin occupancy must track basin volume.
- **Measured** `[sim]`: κ = 0 vs κ = 0.5 gives identical dynamics, but at κ = 0 *nothing ever reads as formed*. The snap makes bodies readable 5–10× sooner. It doesn't make evolution faster.

---

## 4. Biology grounding

The rule → phenomenon table, condensed from notes/02 §1 (34 rules: 27 primarily `[sci]`, 7 `[game]`). Every coefficient is `[game]`, even on `[sci]` rows.

| F rule | Real phenomenon | Source | Status | Tag |
|---|---|---|---|---|
| Cold → bigger newborns (TSR) | Temperature–size rule: −5%/°C in aquatic animals, −0.5%/°C on land | Atkinson 1994; Forster et al. 2012 | consensus (mechanism disputed) | sci |
| "Cold slows reactions → giant" | The leading explanation is oxygen supply vs demand | Verberk & Atkinson 2013 | disputed | game (mechanism) |
| Si plates are cheap | A diatom's silicification costs about 2% of its energy budget | Raven 1983 | consensus | sci |
| Armour from available minerals | Iron sulfide sclerites on the scaly-foot snail | Warén et al. 2003 | consensus | sci |
| Hunger → plates | Escalation (the Mesozoic marine revolution) | Vermeij 1977 | consensus | sci |
| *(missing)* Hunger → plastic armour | *Daphnia* helmets; grass silica | Agrawal et al. 1999; McNaughton & Tarrants 1983 | consensus | sci |
| Gape limit, spines | Stickleback spines beat the predator's gape | Hoogland et al. 1956 | consensus | sci |
| Hunger → horns | Horns are sexually selected weapons | Emlen 2008 | **refuted** as causal | game |
| Water dissolves Si | Only about 3% of biogenic silica is preserved | Tréguer et al. 1995 | consensus | sci (direction) |
| Darker → bigger eyes | Dim light → bigger eyes, **total dark → eye loss** | Warrant & Locket 2004; Moran et al. 2015 | consensus | sci (shape must be a hump) |
| Glow needs O | Luciferase is an oxidation | Rees et al. 1998 | consensus | sci |
| Dark → glow | 76% of deep-water animals off California glow | Martini & Haddock 2017 | consensus | sci |
| Thick air → floating | Titan's air ≈ 4× Earth's density but still ~200× thinner than flesh, so floating needs gas bags | Fulchignoni et al. 2005 | consensus (numbers) | sci (direction), game (threshold) |
| Walk cost ∝ 1/limb length | Effective limb length explains 98% of walking cost | Pontzer 2007 | consensus | sci |
| Segment duplication → serpents | Segmentation clock | Gomez et al. 2008 | consensus | sci |
| Hox limb domains | Ubx suppresses abdominal legs | Ronshaugen et al. 2002 | consensus | sci |
| Basal cost ∝ M^0.75 | Kleiber; metabolic theory | Kleiber 1932; Gillooly et al. 2001 | consensus (exponent disputed) | sci |
| Stress mutagenesis | Shown in microbes only | Galhardo et al. 2007 | plausible (microbes) | game |

**Changes to make** (notes/02 §2; round 2 built the first five):
1. Hump-shaped eyes: they regress below light 0.15 unless glow is nearby.
2. Inducible armour.
3. Horns become prey defence, and gape becomes the hunter's weapon.
4. TSR scaled by medium.
5. Size × (1 + k·o), and floating gated on gas-bag volume.
6. Flora glow needs O.
7. Re-word R6: say "cold water holds more oxygen (debated)", not "slow reactions".
8. Keep stress mutagenesis off slides.

---

## 5. Prototype round 1 (open-ended F vs template-guided)

**Setup:**
- 64 m torus with a 32² producer grid that regrows with Light.
- F's 32 genes, integer segment count, vectorised `develop()`, Kleiber-scaled ledger.
- 24 worm founders.
- Sweep: cap 300/1k/3k × σ ×1/×2.5 × segment duplication on/off × 5 presets × 3 seeds, T = 2,400.
- Plus F's cheats, and a guided mode (9 templates, pull 0.1/0.25, 4-state FSM).
- dt 0.25 vs 0.05 gave the same 46.5 generations per 600 s `[sim]`.

| Config (cap 3k) | legs ≥2 | horns | plates ≥3 | hunters | stable |
|---|---|---|---|---|---|
| open σ×1 (rhino/earth) | 408–1,319 | – | – | – | 3/3 |
| open σ×2.5, rhino | 167–197 | 379–451 | – | 35–37 | 3/3 |
| open σ×2.5, earth | 140–172 | 231–245 | – | 26–29 | 3/3 |
| open σ×2.5, dusk | 274–292 | 448 | – | 41–47 | 0–3/3 |
| open, cap 300 | – | – | – | – | extinct (except earth) |
| guided pull .25, rhino | 64 | – | 144 | 34 | 3/3 |
| open σ×2.5 + plate fix, rhino (2 seeds) | 186–220 | 308–342 | 209–316 | 70–82 | 2/2 |

**Findings** `[sim]`:
- **Generation time is the bottleneck.** About 1 generation per 13 sim-s. Legs need roughly 10–20 generations and horns 20–35.
- **σ ×2.5 is the only cheat that matters.** It cuts the time to legs about 3× and turns horns and hunters from "never" into 30–600 s. The Hox midwife and "grazer tasted meat" did nothing measurable.
- **Cap ≥ 1,000; 3,000 is 1.5–2× faster.** This contradicts notes/01's "N barely matters". The difference is demographic noise at low N, which the sweep arithmetic ignores.
- **Plates are a ledger problem:** plated mutants appear by 8–50 s but never spread until the ledger pays.
- **Guided mode** is faster for legs and plates and gives distinct bestiaries (L1 between presets 1.24–1.33, within 0.42–0.45). But competitive exclusion collapses its 9 templates to 2–4. Rhino-lizard, strider, sky whale, jelly and builder never formed.
- **Buoyant giants: never.** Floating is instant in thick air, as plasticity, but size is never selected, so floaters stay about 0.2 m.

---

## 6. Prototype round 2 (hybrid: open-ended + basins + niches + biology fixes)

**Engine:**
- σ ×2.5 always on, plus the plate ledger fix.
- cap/4 founder capsules, with growth ramping the look snap over the juvenile period: 8–23% of animals on screen are capsules.
- 7 basins on cost-bearing axes, with a look-only snap at κ 0.5 and capture radius 0.25.
- Depletable niches:
  - ground
  - liquid (swimmers only)
  - aerial Spark (floaters)
  - canopy (reach ∝ S·limbLen)
  - stone dens (builders 0.2× catchable)
- The notes/02 biology changes.

Basins were activated two ways:
- **By affinity (round2):** almost nothing formed, because selection filled the strider basin and the affinity table never picked it.
- **By occupancy (round2b, final):** selection chooses and development tidies, which is also the honest version.

| Preset (round2b, cap 3k) | legs | horns | plates | hunter tier | one-body L+H+P first / ≥5% | strider formed | other basins formed | unnamed | stable |
|---|---|---|---|---|---|---|---|---|---|
| rhino (Si, Water, H .55) | 321 | 542 | 309 | – | 166 / **601** | 341 | spinner 967 | 14–23% | 3/3 |
| dusk (Si, Ammonia, H .9) | 258 | 541 | 227 | 202 | 221 / **863** | 289 | swimmer 133, spinner 422 | 8–13% | 3/3 |
| silicon (Si+O, Acid) | 210 | 820 | – | – | 106 / – | 208 | swimmer, rhino-lizard 960 (2/3), spinner, drifter (2/3) | 6–8% | 3/3 |
| earth (C, Water) | 199 | 388 | – | – | 131 / – | 622 | swimmer, spinner, drifter | 9–12% | 3/3 |
| frozen (Si+O, Methane, cold) | 219 | 587 | 798 | 135 | 175 / – | – | drifter 625 (2/3) | 10–16% | 3/3 |

**Final census:**
- Striders: 1,010–2,280 of 3,000.
- Rhino-lizard basin: 177–330.
- Drifters: ≤ 13.
- Sky whales: 0 everywhere.

**Bestiary distance:** 0.59–0.63 between presets and 0.18–0.22 within. That passes F §8's "within < 0.4" and sits at the "> 0.6 between" threshold.

**What broke:**
1. **Strider monoculture.** The canopy pool (0.6 K) made long legs pay everywhere. This is partly my coefficient.
2. **No size selection.** Generation time scales as M^0.25, and under a full cap fast breeders win. The cold + O basal bonus (≤ 30%) doesn't compensate.
3. **The gas-bag gate (buoy ≥ 0.6) is an unselected valley.**
4. **No hunter tier at medium Hunger** (rhino, earth, silicon). Horns-as-defence plus inducible armour removed the payoff for predation.
5. **The rhino-lizard is partial.** It reads as formed only in silicon.

**Verdict: conditional GO for ground body plans, NO-GO for buoyant giants and drifters as specified.**

---

## 7. The recipe

| Lever | Value | Status |
|---|---|---|
| Mutation | σ ×2.5 always on (declared "stressed young world") | tested |
| Population | cap 3,000 (1,000 fragile at H 0.9), cap/4 founders | tested |
| Plate ledger | build 0.05·cover/(0.2+si)·M, mass +0.15·cover, Water dissolution 0.15 | tested |
| Basins | 7, look-only snap κ 0.5, capture RMS 0.25, top-3 by occupancy every 10 s; formed = body RMS < 0.15, look < 0.20 | tested |
| Niches | ground / liquid / aerial 0.6 K / canopy / dens; **canopy ≈ 0.3 K** | canopy cut untested |
| Hunters | gate inducible armour to H > 0.6, gape weapon 0.5 + 1.5·gape | untested |
| Giants and floaters | buoyant founder lineage in thick air; smooth hover cost; size payoff (litter ∝ S, or lifespan × (1 + (1 − heat))) | untested, required |
| Schedule | ×1 → ×40 at 2:00 in a Worker at dt 0.25; constant ×3 is too slow for one-body rhino-lizards (needs ×5) | tested in toy; JS cost unmeasured |
| Cheats | drop the Hox midwife and "grazer tasted meat" | tested (no effect) |
| Untested from notes/01 | generation compression (about 4 sim-s generations), per-parent stress σ, 10% Cauchy tail, limb-pair duplication, smooth limb-bud gradient | candidates for cutting the speed requirement about 3× |

---

## 8. Atlas fauna reachability

| Pin | Round 1 | Round 2 (hybrid) | Round 3 slot that should host it |
|---|---|---|---|
| fauna-01/07 striders | not reached | **reached everywhere (too much)** | Canopy × grazer |
| fauna-02 rhino-lizard | traits reachable separately | **partial**: 177–330 in basin, one-body ≥ 5% by 601–863 s, formed in 1/5 presets | Ground × bulk grazer |
| fauna-03 jellybots / drifters | not reached | not reached (≤ 13) | Air × grazer (thick air) |
| fauna-05 frilled serpent | hunter yes, length no | dusk only | Water × hunter |
| fauna-06 plated hopper | reached (guided) | absorbed into strider/rhino basins | Ground × small grazer |
| fauna-08 eels | guided earth 96 s | swimmer minority, 133–559 s | Water × grazer |
| fauna-09 sky whales | not reached | **not reached** | Air × bulk filter (thick air) |
| eco-09 feathered hunter | dusk, unstable | dusk only | Land × apex |
| spinner (DESIGN §4) | guided | reached | Ground × small grazer |
| eco-13 Living Arch | not modelled | not modelled | Dens × detritivore (very old) |
| *(new)* small fliers | — | not modelled: no flight-cost term | Air × grazer (thin air) |

---

## 9. Recommended round 3: a niche-table ecosystem generator

> **Status:** proposed by the team lead and specified here. **None of it has been built or run.** Every constant is `[game]`. The laws it uses are real ecology (tags below), but applying them to an 11-slot table is a simplification.

### 9.1 Idea

The dials compute a **niche table**: channels × trophic levels, each cell with an energy budget, a body-mass scale and a target abundance.

**The table sizes resource pools. It never spawns or steers species.** Each pool is reachable only through a body trait (an access function, as in round 2's niches). Lineages from the capsule pool speciate into an empty slot when a mutant gains access, and the basins then make the new form readable.

This keeps notes/01 §7's rule (0% template in fitness), and it fixes round 2's monoculture, because pools are exclusive and finite.

### 9.2 Schema

```ts
type Channel = 'Air' | 'Canopy' | 'Ground' | 'Water' | 'Dens';
interface NicheSlot {
  channel: Channel;
  level: 2 | 3 | 4;                // 2 grazer/filter/detritivore, 3 hunter, 4 apex (realm-pooled)
  guild?: 'small' | 'bulk';        // level-2 Ground/Air split: shoots vs bulk forage / filter
  energy: number;                  // E_slot, energy per sim-s
  massScale: number;               // M_slot, relative to the founder worm
  targetN: number;                 // Damuth abundance, scaled to the cap
  access: (plan: Plan) => number;  // 0..1 trait gate: buoy, limbLen*S, swim, si*o, gape > prey S
  basins: BasinId[];               // candidate look-basins (canalization only)
  role: 'graze' | 'filter' | 'detritus' | 'hunt' | 'apex';  // FSM state unlocks + utility priors
  occupancy: number;               // live N / targetN, drives discovery beats and crash detection
}
```

### 9.3 Equations (all `[game]` constants)

1. **Primary production:** `P = 5000 · (0.2 + Light) · g(Heat)`, where `g(h) = clip(1 − 3(h − 0.5)², 0.3, 1)`. This is a Goldilocks hump, the same Light term as the prototype's regrowth, and P is in units of the minimum viable level-2 flux.
2. **Channel shares** (they sum to 1):
   - Water `s_W = ℓ` (liquid fraction, 0.3)
   - Air `s_A = 0.1 · (0.5 + ρ_air)` (thick seas such as methane give more aerial Spark)
   - Canopy `s_K = (1 − ℓ)(0.15 + 0.25 · smoothstep(0.3, 0.8, Light))` (caps when bright, shade-reach when dim)
   - Dens `s_D = 0.1 · min(1, 4 · si · o) · τ` (detritus plus stone, grows with Time τ)
   - Ground `s_G` = the remainder
3. **Transfer efficiency:** `ε = 0.06 + 0.12 · Hunger`, giving 6–18%, inside the real 5–20% spread around Lindeman's ~10% `[PEER]` (Lindeman 1942) consensus as an average.
4. **Levels.** Each level up multiplies body mass by ~10, so the minimum viable flux grows by 10^0.75 ≈ 5.6 (Kleiber), while available energy shrinks by ε. That gives `step = 5.6/ε`.
   - Consumer levels per channel: `n_c = 1 + floor(log10(P·s_c) / log10(step))`, clipped to 2.
   - **Apex** (level 4) is pooled per realm (Land = Ground + Canopy + Dens, Water, Air). It exists only if `P·s_realm ≥ step²`. Top predators coupling energy channels is real (Rooney et al. 2006 `[PEER]`, recalled).
5. **Body mass:** level-2 bases are Air 0.3, Ground/Water 3, Canopy 10 and Dens 1. Level 3 is ×10, apex is ×10 of its prey (×300). TSR applies at full strength to swimmers and floaters and at 1/10 to walkers.
   - The ~10× predator/prey ratio is a simplification. Real ratios span orders of magnitude and are often < 1 for pack hunters (Brose et al. 2006 `[PEER]`, recalled) disputed as a constant.
6. **Abundance (Damuth):** `N_slot ∝ E_slot / M_slot^0.75`, where `E_slot = P · s_c · ε^(level−2) · guildShare`, normalised to the cap.
   - Damuth's N ∝ M^-0.75 (Damuth 1981 `[PEER]`, recalled) consensus as a cross-species trend.
   - Here it *follows* from Kleiber plus equal energy per slot, so it isn't an extra rule.
7. **Size payoffs (the fix for "no size selection"):**
   - **Ground bulk guild** gets 40% of ground energy as low-quality forage. Net digestion is ∝ retention time ∝ M^0.25, so only large bodies profit. This is the Jarman–Bell principle (Bell 1971, Jarman 1974 `[PEER]`, recalled) consensus.
   - **Air bulk-filter guild** in thick air: engulfment capacity outscales metabolism (Goldbogen et al. 2019 `[PEER]`, recalled) plausible.
   - These are access functions, not caps.
8. **Viability (ecosystem size):** a slot is shown only if `targetN ≥ N_min` (4). Food-chain length in real lakes tracks ecosystem size more than productivity (Post et al. 2000 `[PEER]`, recalled) disputed vs the productivity hypothesis. Here the animal cap *is* ecosystem size.

### 9.4 Worked example (computed with the equations above; τ = 1, cap 3,000)

| | **Earth-ish** (C · Water · Heat .5 · Light .85 · Hunger .2) | **Hunter's dusk** (Si · Ammonia · Heat .35 · Light .3 · Hunger .9) |
|---|---|---|
| P, ε, step, apex threshold | 5,250 · 0.084 · 67 · 4,482 | 2,331 · 0.168 · 33.5 · 1,120 |
| Air (share, P·s, levels) | .085 · 446 · 2 | .110 · 256 · 2 |
| Canopy | .280 · 1,470 · 2 | .105 · 245 · 2 |
| Ground | .326 · 1,712 · 2 | .443 · 1,033 · 2 |
| Water | .300 · 1,575 · 2 | .300 · 699 · 2 |
| Dens | .009 · 47 · **1** (no den hunter) | .042 · 98 · 2 |
| Land apex? | 3,229 < 4,482: **no** | 1,375 ≥ 1,120: **yes** |
| Tiny fliers (Air grazer) | 1,263 | 1,344 |
| Air hunters | 19 | 40 |
| Canopy browsers / hunters | 300 / 4–5 | 93 / 3 |
| Ground small grazers / bulk grazers / hunters | 517 / 25 / 13 | 578 / 28 / 29 |
| Water grazers / hunters | 793 / 12 | 652 / 20 |
| Den detritivores (worms, builders) / den hunters | 54 / – | 208 / 6 |
| Land apex | – | **≈ 1** (fails N_min 4) |
| Slots | 10, no apex: a gentle, bright world of fliers, browsers and swimmers | 11 + apex: dim and fierce, with more dens (Si·O), double the hunter share, and one feathered hunter |

**Reading it:**
- Damuth gives the user's picture for free: swarms of tiny fliers, a few hundred grazers, about 25 large herbivores, and a handful of hunters.
- It also exposes a real tension. **At cap 3,000 an apex tier rounds to about 1 animal.** The options are:
  - accept 1–3 long-lived apex animals as a K-selected, honest rarity
  - relax the apex mass ratio to ~3× (the big-cat-on-ungulate pattern)
  - raise the cap
  - declare an apex refuge

  Without one of these the apex is demographically fragile. That is Post 2000's point, reproduced.
- Frozen cathedral (Methane, Heat .15) comes out with P = 1,581, no apex, the largest Air share (.14) and the largest den share (.077). An Air bulk-filter guild (40% of Air energy, M 300) gives about 5 sky whales per 3,000. That's the right rarity, but it still needs the size payoff in item 7 to evolve at all.

### 9.5 How plants fit

Producers *are* the channels. Each channel's energy is grown by an L-system flora form (F §5), chosen by the same dials:

| Channel | Producer form (F §5 grammar) |
|---|---|
| Canopy | cap trees and stacked domes (bright) or shade-reaching glow stalks (dim, `[sci]` shade avoidance) |
| Ground | mats and grasses with Si spine rods (`[sci]` silica phytoliths) |
| Water | kelp and mats |
| Air | drifting Spark motes and spores |
| Dens | encrusting lichens on stone |

- Recipe sets the style: hexagonal 60° Si, curling C, O cups and glow.
- Grazing pressure feeds back through spine rods, and corpses refill soil nutrient.
- **Varied plants come from varied channel shares, not authored species.**

### 9.6 FSM roles

**One shared FSM** (notes/01 §7.7). The slot's `role` unlocks states and sets utility priors, and genes weight the transitions:

| Role | States |
|---|---|
| graze | Forage, Flee, Rest, Bud |
| filter | Drift, Filter, Rise/Sink |
| detritus | Burrow, Deposit, Den |
| hunt | Patrol, Stalk, Chase, Eat, Digest |
| apex | Territory, Ambush, long Rest |

Resting after a meal damps hunter booms `[sim]`. A per-species FSM would be authored behaviour, so it belongs in the honesty box.

### 9.7 Time, succession and dial changes

- **Succession emerges from the energy dependence:** a level-n+1 slot's energy is ε × the *live* biomass of level n, not the table's target. So the order is mats/worms → grazers → hunters → apex. Dens open as stone accumulates (τ).
  - Round 1 saw hunters arise by drift before legs (26–48 s). The live-biomass gate prevents hunters from overshooting before prey exist.
- **Dial moves recompute the table:**
  - Light ↓ shrinks Canopy, so browsers and then their hunters crash.
  - Sea → Methane enlarges Air, causing a flier radiation.
  - Heat to an extreme lowers g(h) and removes the apex level first. Top predators going first is the expected pattern `[INFERRED]`.
- **Discovery beat:** when a slot's occupancy first crosses 5% of target with a basin-captured lineage, fire a named card, e.g. "*Glass Strider* filled the Canopy grazer niche, 3 generations after the canopy opened." The names come from basin + chemistry adjective.

### 9.8 Honesty guards

- The neutral-control test (ledger flattened → basins fill by volume) still applies.
- Add: with access functions randomised, slots must fill with *different* basins.
- The table is ecology, and the on-screen line is: "your dials decided how much food there is, and where; evolution decided who eats it".

---

## 10. Open questions

1. **Does the niche table break the strider monoculture** without re-introducing competitive exclusion within each slot? Run it headless first.
2. **Can the Jarman–Bell and filter-scaling payoffs beat the M^0.25 generation penalty** within 1,300 sim-s?
3. **Small fliers need a flight cost** (e.g. `k_fly·(1 − ρ_air)·S^0.5`). Untested.
4. **Apex at N ≈ 1:** do we accept honest rarity or relax the mass ratio?
5. **Generation compression** (about 4 sim-s generations) could cut the speed requirement about 3×. Untested.
6. **Is 0.3 µs per agent per tick real in JS** (×40 Worker at 3k agents)?
7. Verify the *recalled* sources (Lindeman, Damuth, Brose, Post, Rooney, Jarman–Bell, Goldbogen, and the Sims/Cheney/Lenski run parameters) before any slide uses them.

---

## References

**Verified in rounds 1–2** (DOIs on Crossref; full lists in `data/evolution-speed.json` and `data/biology.json`):
- Agrawal, Laforsch & Tollrian 1999, doi:10.1038/43425
- Atkinson 1994, doi:10.1016/S0065-2504(08)60212-3
- Barrett & Schluter 2008, *TREE*
- Bell, Aguirre & Buck 2004, *Evolution*
- Cheney et al. 2018, *J R Soc Interface*
- Emlen 2008, doi:10.1146/annurev.ecolsys.39.110707.173502
- Forster, Hirst & Atkinson 2012, doi:10.1073/pnas.1210460109
- Fulchignoni et al. 2005, doi:10.1038/nature04314
- Galhardo et al. 2007, *Crit Rev Biochem Mol Biol*
- Gillooly et al. 2001, doi:10.1126/science.1061967
- Gomez et al. 2008, doi:10.1038/nature07020
- Hoogland, Morris & Tinbergen 1956, doi:10.1163/156853956x00156
- Kashtan, Noor & Alon 2007, doi:10.1073/pnas.0611630104
- Kleiber 1932, doi:10.3733/hilg.v06n11p315
- Lenski et al. 2003, *Nature*
- Martini & Haddock 2017, doi:10.1038/srep45750
- McGhee 2011, doi:10.7551/mitpress/9780262016421.001.0001
- McNaughton & Tarrants 1983, doi:10.1073/pnas.80.3.790
- Moran, Softley & Warrant 2015, doi:10.1126/sciadv.1500363
- Nielsen 2004, doi:10.1002/jez.b.20001
- Pontzer 2007, doi:10.1242/jeb.002246
- Raven 1983, doi:10.1111/j.1469-185X.1983.tb00385.x
- Rees et al. 1998, doi:10.1242/jeb.201.8.1211
- Ronshaugen et al. 2002, doi:10.1038/nature716
- Tréguer et al. 1995, doi:10.1126/science.268.5209.375
- Uller et al. 2018, doi:10.1534/genetics.118.300995
- Verberk & Atkinson 2013, doi:10.1111/1365-2435.12152
- Vermeij 1977, doi:10.1017/S0094837300005352
- Waddington 1942, doi:10.1038/150563a0
- Warén et al. 2003, doi:10.1126/science.1087696
- Wolfe, Luque & Bracken-Grissom 2021, doi:10.1002/bies.202100020

**Recalled, not verified this round** (used only in the §9 proposal; check before slides):
- Bell 1971 and Jarman 1974 (Jarman–Bell principle)
- Brose et al. 2006, *Ecology* (consumer–resource body-size ratios)
- Damuth 1981, *Nature* (population density vs body mass)
- Goldbogen et al. 2019, *Science* (why whales are big but not bigger)
- Lindeman 1942, *Ecology* (trophic-dynamic aspect)
- Post, Pace & Hairston 2000, *Nature* (ecosystem size and food-chain length)
- Rooney et al. 2006, *Nature* (asymmetric energy channels, coupled by top predators)
- Woolley & Stanley 2011, GECCO (DOI unverified in notes/01)
