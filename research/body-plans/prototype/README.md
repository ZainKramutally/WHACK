# F time-to-trait prototype

A small headless Python + numpy toy of design F's genome → `develop()` → ecology/selection loop (`docs/emergence/F-body-plan-first.md` §3.2–3.4). It measures how long a worm founder takes to evolve legs, horns, plates, eyes, buoyancy, long bodies and a hunter tier. Findings are in `../notes/04-time-to-trait.md`.

This is a toy, not F. The coefficients are mine, and every one of them is in the `C` dict at the top of `f_ecology.py`.

## Run

Needs Python 3.10+ and numpy.

```bash
cd research/body-plans/prototype
# one run, printing the timeline
python3 f_ecology.py --one --preset rhino --cap 1000 --T 600 --seed 0
python3 f_ecology.py --one --preset dusk --cap 3000 --T 400 --guided --pull 0.25
python3 f_ecology.py --one --preset dusk --cap 1000 --T 400 --mut 2.5 --cheats
# the full sweep (255 runs, ~8 min on 13 cores), then the aggregate
python3 f_ecology.py --sweep --T 2400 --procs 13 --out ../data/raw-sweep.json
python3 summarize.py ../data/raw-sweep.json ../data/time-to-trait.json   # the committed raw file is gzipped: gunzip -k ../data/raw-sweep.json.gz first
```

Presets are `earth`, `silicon`, `dusk` (Hunter's dusk), `frozen` (Frozen cathedral) and `rhino` (the fauna-02 dials: Si, Water, mild, medium Hunger).

Flags:
- `--mut 2.5` keeps F's stress mutagenesis on for the whole run.
- `--nodup` turns off segment duplication and deletion.
- `--cheats` turns on F's declared midwives: the Hox ×5 burst if there are no limbs by 30 s, and "a grazer tasted meat" at 40 s if Hunger > 0.6.
- `--guided --pull k` switches to template-guided mode.
- `--dt` sets the tick length (default 0.25 s).

## What's modelled

- **Genome:** 32 genes in F's layout plus an integer segment count. Segment duplication (p 0.03) and deletion (p 0.01). Hox domain shift (p 0.05). Point mutation p 0.3, σ 0.05 (× `--mut`).
- **Composition:** `lerp(parent, Recipe, 0.35) + N(0, 0.03)`.
- **`develop()`, vectorised:**
  - size `0.15·2^(6 g1)·TSR(heat)·(1 + 0.6 ρ_air buoy)`
  - Hox limb domain → limb pairs (max 4)
  - plates = `round(cover·segN)`
  - horns `0.6·g21`
  - eye area `g19·(1.5 − light)`, with Si 3/4/6 dot clusters vs C 1–2 eyes
  - gape, diet `t`, buoyancy → body density
- **Ledger (per mass, Kleiber-scaled by M^−0.25):**
  - basal × rate(heat) × (1 + 0.8 o)
  - eye cost
  - Si dissolution `∝ atk_si(sea)·si·(1 − cover)`
  - heat stress
  - locomotion: the cheapest of walk/crawl, swim (liquid cells only) and float. Walk cost falls with √limbs·limbLen, crawl is ×3, swimming gets a C-undulation discount, hover costs `max(0, ρ_body − ρ_air)`.
  - mass from plates, horns and limbs (Si rods ×0.5)
  - plate build cost `/(0.2 + si)` at birth
- **Producers:** a 32² grid of plant biomass on a 64 m torus that regrows with Light. Corpses recycle into it.
- **Grazing:** `(1 − t)^1.5 × (1 − 0.6·Hunger)`. Hunger counts as Spark scarcity, per DESIGN §4.
- **Predation:**
  - Animals with t > 0.25 search their 3×3 cell neighbourhood.
  - Win probability = attack/(attack + defence) × the speed and detection race.
  - Gape limit, horns ×(1 + 2·horn), plates +1.5·cover, Si hardness, prey-horn counter-damage.
  - Floaters can only be caught by floaters. Meat pays `t·(0.3 + 0.6 H)`. Carnivores don't eat carnivores.
- **Life cycle:** reproduction at E > 1.5 M after maturity, litter from the r/K gene, and a hard population cap (F's SoA size). Lifespan `30 s·S^0.25/rate` with a senescence spread.
- **Guided mode:** 9 body-plan templates (`TEMPLATES`), each a set of target genes plus a segment count, with a chemistry affinity function.
  - It starts from `cap/2` founder worms spread over the whole dish.
  - At every birth, the template genes move `pull × affinity` of the way towards the lineage's template, and the segment count steps towards its target. Mutation and selection still run on top.
  - A lineage switches template with p 0.01.
  - Each agent runs a 4-state FSM (roam/patrol, feed/stalk-chase, flee, rest/digest). Its transitions depend on energy and on whether a hunter shares the cell.

## Not modelled

L-system flora, sociality and shoals, frills, glow, builders and terrain, sessile growth, sexual crossover, and real steering or vision geometry. The 2 m cell is the interaction radius.
