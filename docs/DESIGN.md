# Design: the rules of life (v0.1, draft)

> **Hook:** *What if life was silicon-based?*
> **Player goal:** make silicon-based life, then watch what it becomes.
> **What judges remember:** the creatures. Weird, varied, alive, and *made by the player's rules*.

This document defines the simulation the player plays with. Science is **one** input. It gives us the rules' *direction* and our best puzzle. It does not set the rules' *complexity*. When realism and fun disagree, fun wins and we note what we bent (see §6).

---

## 1. The design rule

**Easy to predict one step ahead. Hard to predict two.**

Every control has an obvious first effect the player can call before they touch it. The interesting part is what happens *after*, when that effect meets everything else. That gap between "I knew that would happen" and "I did *not* expect that" is the game.

| Test | Pass when |
|---|---|
| **Predict** | A new player can say what a control will do before they try it, and is mostly right |
| **Surprise** | After about 30 seconds, something happens that they didn't predict but can explain afterwards |
| **See** | Every change shows on screen within 3 seconds |
| **Few** | No more than 7 controls visible at once. No numbers in the UI, only words, icons and sliders. |

The model is Conway's Game of Life and Particle Life: tiny rules, huge variety. **If a rule doesn't make creatures more varied or more readable, cut it.**

---

## 2. The model in one screen

> **Revised controls proposed** in [`WORLD_ATLAS.md` §5](WORLD_ATLAS.md#5-working-backwards-the-controls): **Recipe** (C·Si·O triangle) · **Sea** · **Heat** · **Light** · **Hunger**, plus a **Time** clock. They're derived backwards from the mood board. The per-family dials below become hidden presets and an expert Lab drawer.

Everything is **atoms in a pond**. Atoms belong to a few **families**. Atoms bond into shapes, shapes come alive, and living shapes eat, move and copy.

### Families (4)

| Family | Role | Looks like |
|---|---|---|
| **Carbon** | The builder we know. The reference to beat. | Soft, warm colour |
| **Silicon** | The challenger. The player's goal. | Crystalline, cool colour |
| **Oxygen** | The *rust*. Reactive, and locks things into stone or gas. | Bright, small |
| **Spark** | Energy. Food and light, absorbed when bonds form. | Glowing motes |

That's the whole periodic table. Hydrogen, nitrogen and the rest are folded into how these four behave.

### Atom controls (per family, 4 dials)

| Dial | Plain meaning | Predictable first effect | Where it gets surprising |
|---|---|---|---|
| **Hands** (1–4) | How many bonds an atom can hold | 1 → pairs · 2 → chains and loops · 3–4 → nets and blobs | Loops close into *cells*. Too many hands and everything clumps into one blob. |
| **Grip** (loose ↔ tight) | How long bonds last | Loose → soup · tight → stiff, long structures | Tight grip makes shapes that can't copy or move. Life needs bonds that *let go*. |
| **Rust** (low ↔ high) | How eagerly it locks with oxygen into dead stone (Si) or gas (C) | High → atoms disappear into sand or bubbles | Silicon's sand piles up into **shells, reefs and walls** that shape the whole ecosystem |
| **Pull** (who it chases or avoids) | Attraction or repulsion towards each family | "Silicon likes carbon" → they clump | **Lopsided pulls** (A chases B, B flees A) make shapes **swim**. This is where movement and hunting come from. |

### World controls (3)

| Dial | Plain meaning | Predictable first effect | Where it gets surprising |
|---|---|---|---|
| **Heat** | Shakes everything | Hot → bonds break, fast chaos · cold → still and frozen | There's a **Goldilocks band**: life only appears in the middle, and the band is different for silicon and carbon |
| **Sea** | What the pond is made of: Water · Ammonia · Methane · Acid | Changes the backdrop and mood | Each sea **dissolves different families**. Water eats silicon. Methane spares it but slows everything. Acid is the sweet spot for a silicon–carbon mix. |
| **Light** | How much Spark rains in | More light → more energy → more activity | Too much light means fast, short-lived life. Scarce light means competition, so **predators appear**. |

**Total: 4 atom dials (shown for the selected family) + 3 world dials = 7 visible controls.**

---

## 3. The goal: "make silicon life"

The default world is Earth-like: a warm water sea. The player's first move is obvious ("add silicon") and it fails in a way they can *see*. Each fix is guessable, and each one reveals the next problem. Every lock below comes from the research. The player re-discovers in minutes what took chemistry a century.

| # | What the player sees | Their obvious guess | What actually works | Science behind it |
|---|---|---|---|---|
| 1 | Silicon chains form, then **crumble into sand** | "Make silicon grip tighter" | **Doesn't help**: the sea is dissolving it. Change the **Sea**. | Water attacks silicon bonds through polarity, not weakness. A stronger Si–Si bond did nothing in our prototype. |
| 2 | In methane, silicon survives but **nothing moves** | "Turn up heat" | Heat helps up to a point, then shatters everything. Find the band. Or try **Acid**. | Cryogenic seas are ~10⁻¹⁹× slower; Venus-like acid is the strongest real case for silicon chemistry |
| 3 | Silicon keeps **rusting into stone** | "Remove oxygen" | Lower **Rust**, or *use* the stone. Silicon life that builds shells. | Si–O is silicon's strongest bond, and it's the dead end. Diatoms use exactly this to build glass shells. |
| 4 | Silicon shapes hold but **don't copy** | "More hands" | Medium grip, 2–3 hands and a closed loop, so bonds can let go and re-form | Life needs reversible bonds. This is our Goldilocks finding (E/kT ≈ 3.5–4.5). |

**Win moment:** *"Silicon-based life discovered."* The first silicon shape that copies itself gets a name and a field-guide card. Then the real game opens: a sandbox to grow an ecosystem from it.

Locks 1–4 are a **soft order**. Players can solve them in any sequence, and nothing is gated by UI. Hints only appear if the player is stuck for more than 45 seconds ("The sea looks hungry…").

---

## 4. The creatures (where the fun is)

The life ladder the player watches climb, every step on screen:

**bond → chain → loop (cell) → copier → mover → eater → ecosystem**

How the variety arises from the dials above, with no scripted species:

| Creature type | Arises from | Behaviour | Silicon version | Carbon version |
|---|---|---|---|---|
| **Drifters** | Small loops, symmetric pull | Float and slowly copy | Glassy, faceted | Soft blobs |
| **Swimmers** | Lopsided pull inside one shape | Self-propel, turn and wander | Stiff zig-zag darts | Wiggling eels |
| **Spinners** | Lopsided pull around a loop | Rotate and orbit | Crystal wheels | Spirals |
| **Grazers** | Shapes that break Spark-rich bonds | Seek light, eat motes | Slow, armoured | Fast, fragile |
| **Hunters** | A chases B, B flees A, plus eating | Chase and engulf other shapes | Sand-armoured ambushers | Fast pursuers |
| **Builders** *(silicon only)* | High rust leaves stone behind | Leave shells, reefs, burrows | **Reef cities, glass shells** (diatom homage) | — (carbon leaves bubbles, which drift away) |

**Variety knobs we get for free:**
- **Mutation on copy.** A copy occasionally swaps one atom, so lineages drift.
- **Energy.** Spark scarcity pushes shapes towards eating each other.
- **Space.** Silicon's stone creates walls and niches, so silicon worlds look structurally different from carbon worlds.

**Field guide.** When a new shape-signature survives long enough, it's named automatically (e.g. *"Glass Darter"*, *"Reef Weaver"*), with a card showing its family mix and the rules that made it. This gives exploration a collection goal, and a demo payoff: *"here's what YOUR rules made."*

**Carbon vs silicon, side by side.** A split view runs the same rules in both. It's the visual answer to the hook.

---

## 5. Inspirations (science is one of them)

| Source | What we take | What we leave |
|---|---|---|
| **Alternative-biochemistry research** (`research/silicon-life/`) | The *direction* of every rule: water eats silicon, oxygen locks silicon into stone, the Goldilocks heat band, sea choice matters more than grip, acid as the best silicon world, shells as diatom homage. The hook and its credibility. | Real numbers in the UI, 12 elements, hypervalency, π-bonds, exact timescales |
| **Particle Life** (Ventrella; Mohr; Ahmad) | Lopsided attraction → motion, chasing and cells. Our **Pull** dial *is* this. | A random matrix with no meaning: ours is labelled and chemistry-flavoured |
| **Conway's Life / Lenia** | Tiny rules giving huge variety. Creatures as *patterns*, not scripted objects. | Grid cells. We use particles and bonds. |
| **Hutton's artificial chemistry** | Typed atoms with bonds that copy. Seed one spark and let the rest emerge. | Its abstract rule tables |
| **Breath of the Wild "chemistry engine"** (Nintendo, GDC 2017) | Few rules that multiply: each element reacts with each other in readable ways | Hand-authored per-object reactions |
| **Noita / The Powder Toy / falling-sand games** | Instantly readable material behaviour: you *see* sand pile and gas rise | Pixel grids, destruction focus |
| **Spore (cell stage), The Life Engine** | Delight in creatures, and naming and collecting them | Scripted progression, pre-made parts |
| **Baba Is You** | Rules as the toy. Puzzles solved by changing the rules, not the player. | Text rules |
| **"Low floor, high ceiling, wide walls"** (Papert; Resnick) | Anyone can start, experts can go deep, many different paths | — |
| **Bruno Simon's worlds** (`research/sites/`) | The toy-diorama feel, a reveal intro, sound on every interaction (see `world-style`) | His colours and subject |
| **Tidemote** (prior art) | The bar for polish | Observe-only play. Ours lets you **rewrite the laws**. |

---

## 6. What we bent, and why it's OK

Say this out loud in the pitch if asked: *"Every rule points the way real chemistry does. We sped up time and simplified the parts so you can see it."*

| Real science | Our version | Why |
|---|---|---|
| ~118 elements, 12 relevant | 4 families | Readability. Creatures need a few clear actors. |
| Bond energies in kJ/mol | Grip: loose ↔ tight | Players feel it, they don't calculate it |
| Real solvent chemistry | 4 seas, each dissolving families differently | One choice per world, big visible effect |
| Titan chemistry ~10⁻¹⁹× slower | "Slow world": still moves, just lazily | A frozen screen teaches nothing |
| Replicators take ages to arise (if ever) | We seed one copier spark per run | Honest, and standard in artificial life (Hutton) |
| Silicon life probably can't exist | In our worlds it can, if you find the conditions | That's the "what if". The fun is finding *why it's hard*. |

---

## 7. Tuning notes (hidden from players)

From the prototype (`research/silicon-life/notes/07-prototype-findings.md`):
- **Grip ↔ Heat sweet spot:** bond-strength ÷ heat ≈ 3.5–4.5. Centre each family's Grip dial on its own sweet spot, so "medium grip" always means "alive" at default heat.
- **Water vs silicon:** use ~3% of the raw attack rate, so silicon visibly grows *then* crumbles (half-life about ⅓ of a 60s run). Instant death reads as a bug.
- **Anti-blob:** cap Hands' effect, and add a frozen-world alarm (largest shape > 30% of atoms → hint "everything's stuck together").
- **Live health checks:** largest shape 10–200 atoms, species count rising, bonds still breaking, dead (stone) fraction < 50%.

GPU scheme and architecture: `research/silicon-life/REPORT.md` §6.4–6.5.

---

## 8. Open decisions

| Decision | Options | Leaning |
|---|---|---|
| View | Flat pond (2D physics, 3D diorama render) vs full 3D | **2D sim in a 3D diorama**: readable creatures, Bruno-style presentation |
| Families | 4 (above) vs 5 (add Nitrogen as a "flex" family) | 4. Add only if creature variety is thin. |
| Pull editing | Matrix grid vs "likes / fears" verb picker | **Verb picker** ("Silicon *chases* Carbon"), with a matrix for experts |
| Spark seeding | Auto per run vs player drops it | Player drops it. It's a satisfying "first touch" in the demo. |
| Creature detection | Shape-signature hashing (cheap) vs behaviour clustering | Signature hashing first |

Next: score this with `/judge` (idea mode), then `/spec` to turn §2–4 into tasks.
