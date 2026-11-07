# Art direction: "Colour is alive" (v1)

> **North star:** a muted, hazy world where only *life* is allowed to be loud. Every saturated pixel on screen is something alive, or something life made.

Built from the team's Pinterest board (`research/visual/pinterest-silicon/`, 25 pins, indexed with "steal this" notes), checked against `docs/DESIGN.md` (the sim) and `.claude/skills/world-style` (the stack). Palette contrast was tested in `design/concept/2026-11-07-palette-test.jpg`.

This file owns **colour, shape, mood and creature look**. `world-style` still owns the **construction rules** (one material, palette texture, coloured shadows, bloom threshold 1, tilt-shift, fog). Where they disagree, see §9.

---

## 1. What the board is telling us

Five patterns repeat across the 25 pins. These are the brief.

| # | Pattern | Seen in | What it becomes for us |
|---|---|---|---|
| 1 | **One field, one fire.** Each world is a single muted field hue with one saturated complementary accent, and almost no third colour. | eco-01 (vermilion/grey), eco-03 + eco-11 (coral/teal), eco-08 (coral/night/frost), eco-09 (cyan/violet), eco-04 + eco-15 (pink glow/pale) | Each **Sea** is a field. The **families** are the fire. |
| 2 | **Giant life, tiny observer.** A small human looking up at something enormous. It's in about 10 of 25 pins. | fauna-01, fauna-09, eco-05, eco-08, eco-09, eco-11, eco-13 | The **discovery shot** (§6), our signature move |
| 3 | **Parasol, arch and pore.** Caps on stalks, arches, and porous stone with light inside. | eco-04, 05, 06, 08, 10, 14, 15, flora-01 | Silicon **builders** make arches and porous reefs. Backdrop flora is parasols. |
| 4 | **Glow sits in shadow.** Bioluminescence reads because it's seated in a dark pocket or a haze. | eco-14 (orange pores), eco-04/15 (pink cups), fauna-03 | Glow only on Spark and inhabited reef pores |
| 5 | **Air is a sea.** Whales, fish and jellies float through the sky. | fauna-03, fauna-09, eco-11, eco-03 | Creatures drift and swim in volume. Nothing walks. |

Creature design patterns from the Fauna section: **dot-cluster or ring eyes** (fauna-01, 08), **one glossy big eye** (fauna-06), **patchwork confetti skin** (fauna-08), **plates on a soft body** (fauna-02, 06), **banded limbs and frill fins** (fauna-05), **translucent bell and tendrils** (fauna-03), and **extreme vertical silhouettes** (fauna-07).

**Not taking:** the photoreal AI-render look (eco-04, 08, 14, 15). We take their *colour logic*, not their surface. No ink outlines (eco-09, 13): too costly and against world-style. No drab naturalism (fauna-02, 06 browns). No poster text.

**Style in one line:** *Moebius-flat shapes in a hazy atmosphere.* Flat cel colour with two value steps. Heavy depth fog towards the field colour. Saturation only on life.

---

## 2. The three rules

1. **Colour = alive. Bone = dead.** Living atoms are saturated. Dead matter (silica stone, sand, shells) is bone white. Carbon's dead matter (gas) is faint white rings that rise and pop. The player can read the ecosystem's health at a glance: a world going white is dying, and a world full of colour is thriving. This makes the DESIGN.md health check ("dead fraction < 50%") *visible*.
2. **The sea is the field, life is the fire.** The background, fog, ground, sky and shadow hue all come from the selected Sea. The family colours **never change** between seas, so a player learns them once.
3. **Glow must be earned and seated.** Only HDR > 1 blooms: Spark motes, inhabited reef pores, and the discovery flash. Glow always sits against something darker (a shadow pocket or a pore) or inside haze.

---

## 3. Palette

### Families (fixed in every sea)

| Family | Core | Light / rim | Shape | Board source |
|---|---|---|---|---|
| **Carbon** | `#F2552C` vermilion-coral | `#FF9A6B` | Soft round beads | eco-01, 03, 08, 11 |
| **Silicon** | `#3FD8E6` electric cyan | `#D2F8FF` glass rim | Faceted beads + thin rigid rods | fauna-03, eco-06, eco-09 |
| **Oxygen** | `#FF4FA3` hot magenta | `#FFB3D6` | Small, bright, fast | eco-04, eco-15 |
| **Spark** | `#FFA41B` amber, emissive ×3 | `#FFF3C4` white-hot centre | Point mote with a halo | eco-14 pores, eco-02 sun |
| **Stone** (dead Si) | `#ECE4D6` bone | pores take the sea's shadow hue | Porous, arched, rough | eco-14, eco-04 |
| **Gas** (dead C) | `#FFFFFF` at 35% | — | Hollow rings, rising | — |
| **Ink** (eyes, UI text) | `#15111C` | glint `#FFFFFF` | — | fauna-06, 08 |

Per-atom **colour jitter**: ±5° hue and ±8% lightness per atom instance (seeded by atom id). This is the fauna-08 confetti-skin effect: chains read as living tissue, not as plastic beads. It costs one hash in the shader.

### Seas (the field)

| Sea | Mood | Sky / far fog | Near fog | Ground | **Shadow** | Haze | Refs |
|---|---|---|---|---|---|---|---|
| **Water** (default) | Deep teal pond, Earth-like | `#0B2F38` | `#1F7689` | `#14444C` | `#062A3A` | `#44AEB7` | eco-11, eco-03 |
| **Ammonia** | Violet dusk | `#1E0E5C` | `#4A2A8C` | `#3A2163` | `#120840` | `#9A68B4` | eco-09, eco-13 |
| **Methane** | Frost, still, slow | `#EEF2F6` | `#A9BACD` | `#CBD7E3` | `#5A7C9C` | `#FFFFFF` | eco-04, eco-08 |
| **Acid** (Venus) | Lemon-sulfur haze | `#FBF6DC` | `#EAD99A` | `#E2CF95` | `#7A3E5C` plum | `#FFFBEA` | eco-01, eco-10, eco-14 |

**Narrative in the palette.** Silicon cyan is weakest against Water's teal and strongest against Acid's lemon (its complement). The world that's chemically best for silicon is also the one where silicon looks most heroic. The palette tells the player where silicon belongs before the sim does. Say this in the pitch.

**Tested** (`design/concept/2026-11-07-palette-test.jpg`): carbon, silicon and oxygen read in all four seas. A pale-gold Spark vanished on the pale seas, so we switched it to saturated amber with a white-hot centre. An apricot Acid field killed the Spark, so it's lemon-sulfur. Bone stone is low-contrast on Methane and Acid by design, and the cel shadow step in the sea's shadow hue gives it form.

**Bloom strength per sea:** 0.25 on Water and Ammonia, **0.15** on Methane and Acid (pale fields wash out).

**Sea switch:** lerp every field value over 1.5s `power1.inOut` through the `Cycles` module. Families don't change, so the life "stays" while the world changes around it.

---

## 4. Atoms and bonds (what the sim draws)

The sim is particles and bonds, so creature look = how atoms and bonds render, plus a thin layer added when a cluster is promoted to an organism.

| | Carbon | Silicon |
|---|---|---|
| Atom mesh | Low-poly sphere (smooth-shaded), radius 1.0 | Icosahedron detail 0, **flat-shaded facets**, radius 0.9 |
| Bond | Fat capsule in the atom colour (60% of atom radius), so chains merge into one soft body | Thin bright rod in the rim colour (20% of radius), so structures read as **lattice / radiolarian** |
| Surface | world material, soft cel step | world material + fresnel rim in `#D2F8FF` (see §9) |
| Motion feel | Wobbly, follow-through, squash on bond | **Stiff and ticking**: no squash, small snaps on bond, like clockwork |
| Sound (suggested) | soft squelch / pop | glass tick / chime |

Oxygen: small sphere, radius 0.6, no bonds drawn when it's free. Spark: an instanced billboard with an amber core and white centre, emissive ×3, gentle twinkle (±15% scale at 2–4 Hz, per-mote phase).

**Dead matter:** when Si + O locks to stone, the atoms swap to bone colour and stop jittering, then settle and stack into piles. Carbon gas becomes rising rings that fade over 2s.

---

## 5. Creatures (the bestiary)

When the sim promotes a cluster to an organism, add **eyes** first. They're the cheapest, highest-charm upgrade we have: one instanced dot mesh.

**Eyes:**
- Carbon organisms: **2 ink eyes with a white ring** (fauna-08), on the leading atom, facing the velocity.
- Silicon organisms: a **cluster of 3–6 small amber dot-eyes** (fauna-01). They glow faintly (emissive 1.2): *silicon sees by light.*
- Blink: scale Y to 0 for 80ms, every 3–6s (random per organism).
- Big hunters get **one oversized glossy eye** (fauna-06).

| DESIGN.md type | Board reference | Silicon version | Carbon version |
|---|---|---|---|
| **Drifter** | fauna-03 Jellybots | Faceted glass bell, cyan with a lilac falloff, rods trailing as tendrils | Soft coral blob, 2 ring eyes, wobble |
| **Swimmer** | fauna-08 confetti eel | Zig-zag lattice dart, snaps direction | Long jittered-colour chain, sinuous S-wave |
| **Spinner** | eco-02 relief patterns | Crystal wheel: a hex loop with rod spokes | Spiral coil |
| **Grazer** | fauna-06, fauna-02 plates | Bone-armoured: stone plates stuck to a cyan core | Fast, fragile, small |
| **Hunter** | fauna-05 frilled serpent | Sand-armoured ambusher, one big eye | Coral pursuer with **banded** atoms (alternate light/core every other atom) |
| **Builder** (Si only) | eco-14, eco-04, eco-13 | Leaves **bone reefs: arches and porous spires**. Pores glow amber when an organism is inside. | — (leaves gas rings) |

**Mutation is visible:** a mutated copy shifts its jitter seed, so a lineage gets a slightly different confetti pattern (fauna-02's three colourways).

---

## 6. Signature moment: the discovery shot

Pattern #2 from the board, and our "wow" for the demo.

When a new species is named (DESIGN.md §4 field guide):
1. **0.0s**: time scale eases to 0.2, and the camera pushes in on the organism (1.2s `power1.inOut`). A cyan or coral rim pulses with HDR emissive 2 for one beat.
2. **1.2s**: **scale flip.** Cut to a full-screen **specimen plate**. The organism (rendered to a render target) stands *enormous* against its sea's sky gradient. The horizon sits in the lower 20%. At its foot is a **tiny human silhouette** (with a dog, a nod to fauna-09) in the sea's shadow hue. Haze is layered between them.
3. **Plate layout** (fauna-04 Exobiotica): common name in the display face (*"Glass Darter"*), a Latin binomial in italics (*Vitreodromus silicis*), 2–3 leader-line labels ("rods: rigid", "eyes: light-seeing"), and the rules that made it as icons (sea, heat, hands). No numbers.
4. **Dismiss** on click: `back.in` and the camera returns. The card joins the field guide.

Why it lands: the sim is microscopic, and the plate says *"this is what your rules made, and it's huge."* The scale shift is shown, not told (`docs/TRACK.md`, "a world inside something small"). For a cheap first version, skip the render target and use a flat 2D card with a screenshot of the organism, then upgrade later.

---

## 7. World dressing (around the pond)

- The pond is a **shallow dish** in the ground colour. Around it are **2–3 depth layers of flat silhouette cards** (parasol flora, arches, spires) in field colours, fading into the far fog. This is cheap parallax and very board-like (eco-06, eco-07, eco-08).
- Silhouette library (draw once, re-tint per sea): parasol on stalk (eco-05, 08), spotted cap (eco-08), arch (eco-04, 15), porous spire (eco-14), stacked domes (flora-01 #3).
- **Air motes:** slow drifting spores in the haze colour at 20% alpha (eco-07). They make the volume feel like a sea (pattern #5).
- Two suns or moons in the sky per sea, as flat discs (eco-07, eco-08). This is a "not Earth" cue that costs nothing. On Water use one sun.

---

## 8. UI and type

- **Paper, not glass.** UI cards look like the fauna sheets: off-white `#F6F2EA` paper, ink `#15111C`, and a soft shadow in the current sea's shadow hue. Specimen-plate style.
- **Type:** display **Fraunces** (soft serif; italic for Latin names), body **DM Sans**. Both are OFL and on Google Fonts. Use one weight per role.
- **7 controls max, words and icons, no numbers** (DESIGN.md §1). Slider thumbs use the selected family's colour.
- Hints ("The sea looks hungry…") appear in italic Fraunces on a dark translucent bar, as world-style specifies.

---

## 9. Changes to `world-style`

| world-style says | Art direction | Status |
|---|---|---|
| Bruno palette is a draft, replace it | Replaced by §3 | **Done**, this file |
| One shared material, ask before adding one | Silicon needs a **fresnel rim + flat facets**. Proposal: an `isGlass` attribute on the *same* world material (adds a rim term and flat normals), not a second material. | **Needs agreement** with whoever owns the material |
| Bloom strength ~0.25 | Per-sea: 0.25 dark seas, 0.15 pale seas | Proposed |
| Coloured shadows | Per-sea shadow hue, §3 | Aligned |
| Tilt-shift DOF | Keep it. It sells "a world in a dish". | Aligned |
| Chunky, rounded, no outlines | Carbon rounded, silicon faceted, no outlines | Aligned (faceting is a silicon-only exception) |

---

## 10. Art build order (demo path first)

| # | Task | Cost | Why this order |
|---|---|---|---|
| 1 | Palette module: family colours + 4 sea presets + 1.5s lerp | S | Every other task reads from it |
| 2 | Atom look: carbon beads/capsules, silicon facets/rods, oxygen, amber Spark, per-atom jitter | M | This is what judges look at for 3 minutes |
| 3 | Per-sea fog, coloured shadows, bloom strength | S | Makes Sea switching a visible "whoa" |
| 4 | Eyes + blink on promoted organisms | S | Biggest charm per hour of work |
| 5 | Dead matter: bone stone piles, gas rings | M | Rule #1, health you can see |
| 6 | Discovery shot + specimen plate (2D card version first) | M | Our wow moment |
| 7 | Backdrop silhouette cards + air motes + suns | S–M | Frames the world |
| 8 | Builder reefs with glowing pores | M | Silicon's visual payoff |
| 9 | Glass bells and membranes on drifters | L | Stretch goal |

Steps 1–4 are the H8 checkpoint target for art.
