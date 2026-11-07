# 07 · Bonding-model prototype: do real element values give non-degenerate worlds?

**Short answer: no, not as-is.** With the real bond energies, the toy model only ever ends up in one of two dead states: **gel** (everything fuses into one frozen blob) or **dust** (everything is hydrolysed into dead X–OH monomers). The *ordering* of the real numbers is exactly right. Carbon outlasts silicon in water, silicon survives in methane and partly in acid, and the oxygen sink is real. The *magnitudes* still need three rescalings before you get the "complex but not frozen" middle: an effective temperature per backbone, a ~30x slower water attack, and an H:X ratio near 2. The prototype finds a clear sweet spot: **E_backbone / kT_eff ≈ 3.5–4.5**.

Everything here is `[INFERRED]` from a toy model. None of it is chemistry.

## Method

Script: `research/silicon-life/prototype/bonding_model.py` (numpy only, ~7 s for everything).

```bash
python3 research/silicon-life/prototype/bonding_model.py          # 9 scenarios + S sweep + extras -> data/prototype-results.json
python3 research/silicon-life/prototype/bonding_model.py --quick  # scenarios only (~3 s)
```

- **Atoms:** N = 3000 (2000 for the sweeps), well-mixed with no space. Types are C or Si (valence 4), H (1) and O (2). The default mix is X 45%, H 45%, O 10%.
- **Formation:** each step there are about `0.08·N·kin` random encounters. A pair bonds if both atoms have free valence, the pair type is allowed (X–X, X–H, X–O, C–Si), and `rand < E_bond/500` (so affinity tracks how exothermic the bond is, which makes O win encounters). `kin = exp(−Ea/kT_eff + Ea/kT_eff(300 K))` with Ea = 40 kJ/mol is a single "reaction speed" factor. Cold means slow.
- **Breaking:** `p = exp(−E/kT_eff)·(0.05 if X–O) + attack[solvent][bond]·kin`. Energies come from Petkowski 2020 (`data/silicon.json`): C–C 346, Si–Si 222, C–Si 318, C–H 411, Si–H 318, C–O 358, Si–O 452.
- **Solvent attack** (toy per-step rates that only encode the qualitative ordering in notes 01/02):
  - water: Si–Si 1e-2, Si–H 6e-3, Si–C 2e-4, C bonds 0.
  - H2SO4: Si–Si 4e-4 (more stable than Si–C), Si–C 1.5e-3, Si–H 1.5e-3, C–C/C–H 1e-4.
  - methane: ~1e-6.

  In protic solvents, hydrolysis **caps each freed X valence with an O** (X–OH). That is the oxygen sink, and the 0.05 sink factor makes it near-permanent.
- **Effective temperature:** `kT_eff = R·T·S`, with one global S = 16 (300 K → 39.9 kJ/mol). Real kT at 300 K is 2.49 kJ/mol, so every bond is 90–180 kT deep and nothing breaks thermally on any timescale. Real chemistry moves through catalysed/solvent pathways whose barriers are far below the bond energy. S stands in for that, and it compresses the real contrast. The C–C : Si–Si break-rate ratio is ~4×10²¹ at real 300 K and ~22 at S = 16. The same S is used for every scenario, so 94 K vs 300 K vs 330 K stay in proportion.
- **Metrics** (every 30 steps):
  - largest molecule
  - **largest backbone** (X–X-connected component)
  - **species** (distinct molecules of ≥3 atoms with ≥1 X, keyed by composition + O caps + X–X bond count + X–X degree multiset, a crude 1-round WL)
  - **complex** (molecules with ≥3 X–X bonds)
  - **dead fraction** (X with ≥2 of 4 valences on O)
  - bond breaks per window (turnover)

## Results (S = 16, 3000 steps, seed 1)

"@20%" stands in for "what the player sees in the first ~60 s".

| Scenario | kT_eff | @20% backbone / species | Final backbone | Final species | Complex | Dead | Verdict |
|---|---|---|---|---|---|---|---|
| 1 C / water / 300 K | 39.9 | 1295 / 4 | 1292 (mol 2949) | 3 | 1 | 0.06 | **gel** (frozen percolated blob, ~13 breaks/30 steps) |
| 2 Si / water / 300 K | 39.9 | 2 / 19 | 1 | 7 | 0 | **1.00** | **dust**: all Si is Si(OH)n by step ~120 |
| 3 Si / methane / 94 K | 12.5 | 776 / 29 | 1259 | 5 | 1 | 0.07 | slow growth (kin 0.11), then gel, 0 breaks |
| 4 Si+C / H2SO4 / 330 K | 43.9 | 64 / **98** | 5 | 62 | 3 | 0.92 | richest early, then decays (the acid C-attack is set too high) |
| 5a Si / water, Si–Si +50% | 39.9 | 2 / 17 | 1 | 9 | 0 | 1.00 | **the knob does nothing in water** |
| 5b Si / no solvent, Si–Si +50% | 39.9 | 1305 / 5 | 1306 | 6 | 1 | 0.07 | becomes carbon-like, i.e. gel |
| 5c Si / methane / 94 K, +50% | 12.5 | 1067 / 16 | 1298 | 5 | 1 | 0.07 | gels faster |
| 6 C / water, O-free | 39.9 | 1312 / 6 | 1311 | 6 | 1 | 0.00 | gel (removing O changes nothing for C) |
| ctrl Si / no solvent / 300 K | 39.9 | 1029 / 11 | 1052 | 18 | 3 | 0.07 | gel with turnover (153 breaks): nearest to alive |

Final chain-length histograms are in `data/prototype-results.json`. In every gel run they are bimodal (dozens of monomers plus one 65+ blob), with nothing in between.

### Sweep over S (N = 2000, 1500 steps): where is the sweet spot?

| Scenario | gel at | sweet spot (backbone 10–200, species and complex peak) | E_backbone/kT there |
|---|---|---|---|
| C / water | S ≤ 26 | **S ≈ 34 (kT 85)**: chain 188, 25 species, 9 complex | **~4.1** |
| Si / no solvent | S ≤ 16 | **S ≈ 20–26 (kT 50–65)**: chain 12–138, up to 72 species, 30 complex | **~3.4–4.4** |
| Si / methane / 94 K | S ≥ 13 | S ≈ 10 (kT 7.8): 37 species, but only because kinetics are too slow to finish gelling (kin 0.03). This is a transient, not equilibrium | n/a (E/kT ≈ 28) |
| Si / water | — | none. Dead = 1.0 at every S | — |
| Si+C / H2SO4 | — | species 79–125 at every S, which makes it the most robust, but dead 0.44–0.89 | — |

### Extra levers (in `extras` in the JSON)

- **H:X ratio is the anti-gel lever.** At S = 16 with no solvent:

  | H fraction (X = 0.9 − H) | C result | Si result |
  |---|---|---|
  | 0.45 | gel (859) | gel (652) |
  | 0.60 (H:X ≈ 2) | **chain 121, 19 species** | chain 17, 35 species |
  | 0.70 | dust | dust |

  At H ≈ 0.6, carbon builds long chains and silicon builds a diverse soup of short ones, with the same rules and the same T. That is a **visible C-vs-Si difference with raw energies**.
- **Water-attack pacing:**

  | Attack scale | Si peak backbone (step) | 50% dead at step | Final |
  |---|---|---|---|
  | ×1 | 26 (90) | 120 | dust |
  | ×0.1 | 508 (180) | 570 | dust |
  | **×0.03** | **620 (240)** | **1920** | chain 11, dead 0.70 |
  | ×0.01 | 731 (450) | never | chain 207, dead 0.30 |

  At ×0.03 the player gets the demo arc: silicon grows, peaks, then visibly rusts into sand.

## Answer to the round-1 question

1. **Real values already give a visibly different, correctly ordered world.** Water kills Si and spares C. Methane spares Si. Acid is the Si+C middle ground. Si–O is the sink. You do not need to fudge any *ordering*.
2. **Real magnitudes are degenerate.** A raw Boltzmann factor at real T means nothing ever breaks. A single compressed T means one backbone gels while the other falls apart: the C/Si energy ratio of 1.56 is too wide for one kT to put both in the sweet spot. Raw attack rates kill silicon within the first ~2 seconds of a 60 s demo, which is too fast to read.
3. **The "stronger Si–Si" knob alone is a trap.** Hydrolysis is a polarity effect, not a strength effect, so +50% Si–Si does nothing in water and only makes dry and methane worlds gel faster. This matches the chemistry, and it is a good lesson for the player, but the UI should say so.

## Tuning recommendations for the GPU sim

- **Keep as-is (raw):** the bond-energy *table* as relative weights (it drives affinity and ordering), the solvent attack *ordering* (water ≫ acid > methane on Si; Si–C water-stable; Si–Si > Si–C stability in acid), valences, and the oxygen sink.
- **Rescale:**
  - **Temperature → kT_eff, normalised per backbone.** Set `kT_eff = E_backbone / 4` at the solvent's reference T, and scale with T/T_ref from there. Target **E/kT = 3.5–4.5** for the dominant backbone bond. Below 3 everything falls to monomers. Above ~5 (with mixing) the world gels.
  - **Use rate ratios, not raw exponents.** Present the player's T slider as moving E/kT within roughly 2–8.
  - **Water attack on Si:** about 0.03× the toy rate. Aim for half-life ≈ 1/3 of the demo length, so a ~60 s demo has Si peaking around 5 s and half-dead around 40 s (if 3000 steps = 60 s).
  - **Cold solvents:** do not let the kinetics factor fall to 0.03–0.1. Clamp `kin ≥ 0.3`, or tick cold worlds faster, and tell the player "slow world" in the UI. Otherwise methane runs look like nothing is happening.
  - **Acid attack on C:** drop it about 10× (1e-5). At the toy value the hybrid's dead fraction is 0.9.
- **Anti-gel structure (most important).** A well-mixed, valence-4, near-irreversible system gels (Flory–Stockmayer). The GPU sim needs at least one of these:
  - H:X ≈ 2 (cap-heavy feedstock)
  - spatial locality, so bonds only form within a radius. Real space will help a lot, since this model has none.
  - a max-degree-for-branching penalty
  - turnover set by E/kT ≈ 4

  Treat "largest molecule > 30% of atoms" as a frozen-world alarm.
- **Sweet-spot targets to monitor in-sim:**
  - largest backbone 10–200 atoms (of ~2k)
  - species count rising over time
  - ≥1 bond break per ~100 bonds per tick
  - dead fraction < 0.5 for a living world

## What the player should see differ within ~60 s

- **Carbon/water:** long, stable chains grow and keep growing. Few but large species. Almost no "sand".
- **Silicon/water:** a quick bloom of short Si chains, then a visible wave of dead white Si(OH)n "sand" by about 40 s. Diversity peaks early, then collapses.
- **Silicon/methane (cold):** slow, steady growth with almost no breaking (glassy, frozen-looking). Long-lived but static.
- **Silicon+carbon/acid:** the highest early diversity (98 vs 4 species for carbon/water at 20% of the run, same S), mostly from Si–C/Si–Si mixed small molecules. The most "interesting soup" preset.
- **Same rules, H:X ≈ 2:** carbon makes long chains and silicon makes a busy soup of short ones. Different shape, not just different survival.

## Caveats

- There is no space, diffusion, geometry, rings, π-bonds, hypervalency or catalysis, and only a single kinetic barrier.
- Attack rates, the 0.05 sink factor, Ea = 40 and S = 16 are hand-picked, not measured.
- The species metric is crude. In scenario 4 it counts many small capped fragments ("diversity of junk"), so read it alongside "complex".
- These are single-seed runs. The trends were stable across the S sweep, but there are no error bars.
- The "gel" verdict is partly an artefact of the well-mixed setup. Expect spatial locality in the GPU sim to widen the sweet spot.
