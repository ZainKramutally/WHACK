# Feature: selection screen (the landing page)

> **Draft for the design partner,** who owns the UI (`CLAUDE.md`, "Owners"). It covers everything before the world exists: choosing carbon or silicon, the three condition sliders, the particle box and the Generate button. Nothing here is built yet.
> **Inputs:**
> - `CLAUDE.md`: "The experience", "Condition sliders", "The particle box and the Generate transition", the data contract and the demo script
> - `docs/ART_DIRECTION.md`: §2 rules, §3 palette, §8 UI and type
> - `docs/ART_DIRECTION_PIXEL.md`: §3 UI outside the pixel pass
> - `docs/TRACK.md`: the 15-second hook
>
> Where this file and `CLAUDE.md` disagree, `CLAUDE.md` wins.

Tags: **[spec]** taken from `CLAUDE.md` · **[proposed]** a design choice made here, open to change · **[copy]** draft wording.

---

## 1. What this screen has to do

It is the first 15 seconds of the pitch. A judge with no context must:

1. **Get the question:** "Life is ▢ based. You choose." The sentence is the hook. **[spec]**
2. **See that chemistry decides where life can live.** The red zones and the live green/red element cells teach this without words. **[spec]**
3. **See the chemistry move** in the particle box as they touch anything. **[spec]**
4. **Start a world in one click,** which is never blocked. **[spec]**

The rehearsed demo leaves every control at its default and clicks Generate at 0:15. So the default state must already read well on its own: carbon selected, chains wiggling in water, and every carbon slider inside its living band.

---

## 2. Layout

The target is the demo laptop at **1920×1080**, scaling proportionally to 1440×900, with a minimum of 1280×720. No mobile layout. **[proposed]**

- **Grid:** 12 columns, 64 px outer margins, 24 px gutters.
- **Canvas:** one full-bleed three.js canvas behind everything. It shows the selected world's **field** (sky gradient, haze and drifting air motes) and the **particle box**. All other elements are a DOM overlay. **[spec]**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Life is ┌───┐ based                                     (field: the sea's   │
│          │ C │                                            sky gradient,      │
│          └───┘                                            air motes)         │
│  Known · Life as we know it, in water at Earth-like temperatures.            │
│                                                                              │
│  ┌────────┐   ┌─────────────────────┐                                        │
│  │ 6    C │   │ Starting conditions │       ╔═══════════════════════╗        │
│  │ Carbon │   │                     │       ║  gas: N₂ · O₂         ║        │
│  │ Known ●│   │ Temperature  15 °C  │       ║                       ║        │
│  ├────────┤   │ ▨▨━━━━━━━●━━━━━▨▨▨  │       ║~~~~~~~~~~~~~~~~~~~~~~~║        │
│  │ 14  Si │   │       ⊕ Earth       │       ║  liquid: chains of    ║        │
│  │Silicon │   │ Nitrogen   1 × Earth│       ║  atoms in the solvent ║        │
│  │Specul. │   │ ▨━━━━━━●━━━━━━━━━━  │       ╚═══════════════════════╝        │
│  ├────────┤   │ Oxygen         0 %  │        Carbon in water                 │
│  │ 32  Ge │   │ ●━━━━━━━━━━━━━━━━━  │        Illustration, not to scale      │
│  │ greyed │   │                     │                                        │
│  ├ Sn · Pb · Fl (greyed) ┤          │                                        │
│  └────────┘   │ [    Generate     ] │                                        │
│               └─────────────────────┘                                        │
│  Tab to move · ← → to adjust · Enter to generate                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

The controls sit next to the element column, so choosing an element and setting its conditions happen in one place, reading left to right. The particle box sits on the right as the result, on the side of the screen where `CLAUDE.md` puts it. **[proposed]**

| Zone | Columns, approximate size at 1920×1080 | Holds |
|---|---|---|
| Sentence | cols 1–7, top 64–200 px | The headline and one status line under it |
| Element column | cols 1–2, from y 260 | Six periodic-table cells stacked: C, Si, Ge, Sn, Pb, Fl |
| Conditions card | cols 3–6, from y 260 | Three sliders, then the Generate button |
| Particle box | cols 7–12, centred near (1340, 560), about 560×560 px on screen | The 3D box in the canvas, with a paper label strip under it |
| Controls hint | bottom-left, 14 px | Keyboard or gamepad hints, whichever was used last |

---

## 3. The parts

### 3.1 The sentence

- **The headline** reads "Life is ▢ based", set in **Fraunces**, about 96 px, directly on the field, not on a card. **[spec]** for the words, **[proposed]** for the treatment.
  - Text colour follows the field: paper `#F6F2EA` on the dark Water field, ink `#15111C` on the pale nitrogen field. It changes colour as the field changes.
- **The ▢ slot** is a rounded square with a 2 px ink or paper outline, holding the selected element's symbol in its family colour: carbon `#F2552C`, silicon `#3FD8E6`.
  - On select, the old symbol drops out and the new one pops in (`back.out(1.7)`, 0.4 s).
- **The status line,** in DM Sans 20 px under the headline:
  - Carbon: "**Known** · Life as we know it, in water at Earth-like temperatures." **[copy]**
  - Silicon: "**Speculative** · A cold world with liquid-nitrogen seas. Most chemists doubt it. *Why?*" **[copy]**
  - "Why?" opens a paper card with the silicon reasoning chain and its caveat (`WorldConfig.reasoning`, `caveat`). Close it with Esc or a click outside. This keeps the honesty rule visible before the world even starts. **[proposed]**

### 3.2 The element column

These are six periodic-table cells drawn as **paper cards** in the specimen-plate style: paper `#F6F2EA`, ink `#15111C`, and a soft shadow in the current sea's shadow hue. **[spec]** for the cells, **[proposed]** for the details.

**Every cell** has:
- the atomic number at top left (DM Sans 14)
- the symbol in the centre (Fraunces 56)
- the name below (DM Sans 16)
- a status chip at the bottom

**Carbon and silicon** are selectable. They also show **live viability**, from `canLive(world, conditions)`:

| State | Look | Words |
|---|---|---|
| Life can live here | A 6 px rim in the family colour, softly lit (its light rim colour, `#FF9A6B` or `#D2F8FF`) | "Life can live here" |
| Life can't live here | The card fades towards bone `#ECE4D6`, and the rim becomes the lethal hatch (§4) | The failing limit's `reason`, for example "Too cold for surface life" |
| Selected | 2 px ink border, a deeper shadow, raised 4 px | Its symbol fills the ▢ slot |

**Germanium, tin, lead and flerovium** are greyed: 40% opacity, not selectable, with one reason line in italic. **[copy]**, with the first and last taken from `CLAUDE.md`:

| Cell | Reason line |
|---|---|
| 32 Ge | "Bonds even weaker than silicon's" **[spec]** |
| 50 Sn | "A metal: its bonds are too weak to hold a chain" **[copy]** |
| 82 Pb | "A heavy metal that barely bonds to itself" **[copy]** |
| 114 Fl | "Made in a lab; atoms last only seconds" **[spec]** |

Clicking a greyed cell gives it a small shake (6 px, 0.25 s) and shows its reason. Nothing else happens.

### 3.3 The particle box

Its behaviour is fully specified in `CLAUDE.md`. This section covers only its framing. **[spec]** for behaviour, **[proposed]** for the look.

- **The box:** a glass vitrine in the canvas, with no outline, a fresnel rim in silicon's glass-rim colour `#D2F8FF`, and a slow idle sway of ±8° around the vertical.
  - The camera looks slightly down on it at a narrow lens (FOV about 30), matching `world-style`.
- **Inside:** liquid at the bottom in the field's near-fog colour, and gas above in the haze colour.
  - Atoms: carbon coral, silicon cyan, oxygen magenta `#FF4FA3`.
  - Solvent and N₂ molecules are small, pale and unsaturated, because they are not alive (ART_DIRECTION rule 1).
  - Silicon turned to rock is bone `#ECE4D6` and sinks.
- **The label strip under the box:** a small paper card, like a museum label.
  - Line 1: the world, "Carbon in water" or "Silicon in liquid nitrogen". **[copy]**
  - Line 2: "Illustration, not to scale". **[spec]**
  - On silicon, a "Speculative" chip. **[spec]**
  - When a limit fails, a third line names it, with the lethal hatch as its bullet, for example "Too warm for liquid nitrogen". This echoes the box's `boxEffect` in words. **[proposed]**

### 3.4 The Conditions card

This is a paper card titled "Starting conditions" (Fraunces 24). It holds three sliders, then the Generate button. **[spec]**

**Each slider block,** from top to bottom:

1. **The label** (DM Sans 18 semibold) on the left, and a **live readout** on the right (DM Sans 18, tabular figures):
   - Temperature: a whole number of °C, for example "−183 °C".
   - Nitrogen: two significant figures, for example "0.05 × Earth", "46 × Earth". The track is on a log scale.
   - Oxygen: a whole percentage, for example "21 %".
2. **The track:** 10 px tall and the full card width, covering the control's full range (identical in every world). Its parts:
   - **Living band:** the family colour at 30%.
   - **Red zones:** the lethal hatch (§4). On this screen they are a **preview**, drawn at 50% strength. **[spec]**
   - **Empty band** (`LivingBand.empty`): the whole track is hatched, with the blocking reason underneath.
   - **Earth marker:** a small ⊕ in ink on the track at Earth's value (15 °C, 1 ×, 21 %), labelled "Earth" in 12 px underneath. **[spec]**
   - **Ticks:** Temperature at −250, −150, −50, 50 and 150 °C. Nitrogen at 0.01, 1, 100 and 1,000 ×. Oxygen at 0, 20 and 40 %.
3. **The thumb:** a 24 px disc in the selected family's colour with a 2 px ink ring. **[spec]**
   - On this screen the thumb moves freely across the full range. **[spec]**
   - Over a preview red zone, its ring turns lethal, and the zone's `reason` appears inline under the track, for example "Too little nitrogen for seas". Inline, because tooltips hide under a dragging finger or cursor.
4. **The hint line,** from `ControlDef.hint`, in italic DM Sans 14 at 70% ink. **[copy]**
   - Temperature: "Moves the planet closer to or farther from its star."
   - Nitrogen: "How much nitrogen the planet has, in its air and seas."
   - Oxygen: "Free oxygen in the air. A young planet has none."

**The Generate button:** full card width, 64 px tall, filled with the selected family's colour, and the label "Generate" in ink (DM Sans 20 semibold). **[spec]** for the label, **[proposed]** for the style.
- **Never disabled.** **[spec]**
- **Advance notice:** if `startingConditions()` would move any slider, one line shows above the button before the click. For example: "Silicon life can't live here yet. Generate will set Temperature to −183 °C." The glide then doesn't surprise anyone. **[proposed]**

---

## 4. Visual tokens

These build on `ART_DIRECTION.md` §3 and §8. **New** marks additions this screen needs.

| Token | Value | Use |
|---|---|---|
| `paper` | `#F6F2EA` | Cards and chips |
| `ink` | `#15111C` | Text, outlines, Earth marker |
| `carbon` / `carbon-rim` | `#F2552C` / `#FF9A6B` | Carbon cell, thumbs, slot, Generate |
| `silicon` / `silicon-rim` | `#3FD8E6` / `#D2F8FF` | Silicon equivalents, box glass rim |
| `oxygen` | `#FF4FA3` | O₂ atoms in the box |
| `bone` | `#ECE4D6` | "Can't live here" cells, rock in the box |
| **New** `lethal` | `#B3202E`, with 45° ink hatching: 2 px lines every 6 px | Red zones, failing-limit bullets, the thumb ring over a red zone |
| Water field | sky `#0B2F38`, near fog `#1F7689`, haze `#44AEB7`, shadow `#062A3A` | Background when carbon is selected |
| Liquid-nitrogen field | sky `#EEF2F6`, near fog `#A9BACD`, haze `#FFFFFF`, shadow `#5A7C9C` (ART_DIRECTION's frost palette, relabelled, per `CLAUDE.md`) | Background when silicon is selected |

**Why the lethal red is hatched:**
- **The user brief says "redded out",** so the zones stay red.
- **It sits next to carbon's coral.** The darker value plus the hatch keeps the two from being confused.
- **Colour never carries meaning alone** (red–green colour blindness). The hatch and the reason text carry it too.

**Type:** display **Fraunces**, body **DM Sans**, one weight per role (ART_DIRECTION §8).

**Cards:** 8 px radius. Shadow `0 8px 24px` in the current sea's shadow hue at 35%. On the pale nitrogen field, cards also get a 1 px ink border at 15%, so paper doesn't vanish into frost. **[proposed]**

**Numbers are shown.** ART_DIRECTION §8's old "no numbers" rule comes from the previous concept's DESIGN.md. `CLAUDE.md`'s sliders and stats carry units, and the story needs "−183 °C" said out loud.

---

## 5. Behaviour

| Action | Response | Timing |
|---|---|---|
| Page loads | Carbon is selected. The Water field fades in, the box starts with carbon chains wiggling, and the cards rise in (`back.out(1.7)`, staggered 60 ms). Renderer, worker and world materials compile in the background without blocking. **[spec]** | about 1 s |
| Click carbon or silicon | Selection moves. The field lerps to the new sea (1.5 s, `power1.inOut`, ART_DIRECTION §3), the box swaps atoms and solvent (0.5 s, **[spec]**), red-zone previews and thumb colours update, Generate recolours, and the slot symbol swaps. `selection:changed` fires. | 0.4–1.5 s |
| Hover a carbon or silicon cell | Shows its viability line, or its failing reason. It does **not** preview another world's red zones: previews follow the selected element only, so nothing flickers. **[spec]** | instant |
| Drag a slider | The readout, box, cell viability and red-zone edges all update live. `selection:changed` fires (throttled to animation frames). Red-zone edges ease to their new positions over 150 ms, so coupled moves are visible. | live |
| Thumb enters a preview red zone | Its ring turns lethal and the reason appears inline. The selected world's cell may turn red. | instant |
| Click Generate | 1. `world:selected` fires. 2. Any slider `startingConditions` moved glides to its new value (0.8 s, `power1.inOut`), with a caption on a dark translucent bar, bottom centre, italic Fraunces (world-style), for example "Silicon life can't survive at 15 °C, so this world starts at −183 °C." **[spec]** 3. The overlay fades out (0.6–1.2 s) as the camera pushes into the box. The transition then continues as in `CLAUDE.md`. | 0–6 s |

---

## 6. Keyboard, gamepad and accessibility

- **Keyboard:**
  - Tab moves through the cells (C, Si), then the three sliders, then Generate.
  - The arrow keys change the selected cell or adjust the focused slider. Shift + arrow takes a big step: 10 °C, ×10 nitrogen, or 5 % oxygen.
  - Enter or Space activates the focused control.
  - Esc closes the "Why?" card.
- **Gamepad,** matching the in-world mapping in `CLAUDE.md`:
  - D-pad up and down move focus through cells, sliders and Generate.
  - D-pad left and right change the selection or adjust the slider.
  - A selects or generates; B closes the "Why?" card.
- **Focus ring:** 3 px ink with a 2 px offset, visible on both fields.
- **Screen readers:** each slider is `role="slider"`, with `aria-valuetext` giving the value, the unit and the zone, for example "−183 degrees Celsius, inside silicon's living band". Cells announce their status and viability.
- **Reduced motion:** the field lerp becomes a 200 ms crossfade, and card entrances and the cell shake are dropped.

---

## 7. Data it binds to (from `CLAUDE.md`'s contract)

| UI part | Reads |
|---|---|
| Status line, "Why?" card | `WorldConfig.status`, `displayName`, `reasoning`, `caveat` |
| Cell viability | `canLive(world, conditions)` → `ok`, or `limit.reason` |
| Slider tracks | `ControlDef` (label, unit, min, max, scale, hint, default) and `livingBands(selectedWorld, conditions)` (low, high, empty and limit ids → `LethalLimit.reason`) |
| Earth marker | Earth values: 15 °C, 1 ×, 21 % (`StatDef.earthValue`) |
| Particle box | `boxState(world, conditions)`, `Solvent.solidSinks` |
| Generate notice and glides | `startingConditions(world, requested)` → `moved` |
| Events out | `selection:changed` on every change, `world:selected` on Generate |

Greyed-cell reasons (Ge, Sn, Pb, Fl) are facts too. Under "science lives in data", they belong in a small config with sources, not in UI code (see open questions).

---

## 8. Pixel-mode variant (if the team picks `ART_DIRECTION_PIXEL.md`)

- **The canvas** (field and box) renders through the pixel pass. **The overlay stays at native resolution**, outside it. (ART_DIRECTION_PIXEL §3)
- **UI text** switches to the pixel direction's bitmap font. The headline can stay in Fraunces if it reads, as the pixel doc allows for plate titles.
- **The lethal hatch** becomes a 2 px checker in `lethal` and ink. Card shadows become a hard 2 px offset in the sea's shadow hue. Radii go to 0.
- **Colours** snap to the nearest step of the active scene palette.

---

## 9. Done when

- [ ] A fresh viewer can say what the screen asks within 15 s (Test 3 in `docs/TRACK.md`).
- [ ] The default state matches the rehearsal: carbon selected, every carbon slider in its band, carbon chains wiggling.
- [ ] The silicon puzzle works by hand:
  1. Select silicon: its pool boils off at 15 °C.
  2. Set −183 °C: carbon turns red.
  3. Raise Nitrogen: silicon turns green and its chains form.
  4. Raise Oxygen: silicon rusts.
- [ ] Red zones are never colour-only: hatch plus reason text, checked with a colour-blindness simulator.
- [ ] The box and the cells never disagree. Both come from `canLive`.
- [ ] 60 fps on the demo laptop while dragging sliders with the box running.
- [ ] Keyboard-only and gamepad-only runs can select silicon, set the sliders and generate.

---

## 10. Open questions

1. **Art direction:** v1 "Colour is alive" or the pixel candidate. This spec works for both (§8).
2. **The `lethal` token:** crimson plus hatch against carbon's coral. Check it on both fields and in pixel mode before locking it.
3. **Greyed-cell reasons:** move them into a small config with sources (for example `src/worlds/elements.ts`). That's a contract addition, so agree it with Caden.
4. **The "Why?" card:** the full seven-step reasoning chain, or just the caveat plus a link to the in-world Conditions panel? The full chain is more honest; the short version is faster in a 3-minute pitch.
5. **The Generate notice line:** keep it, or let the glide caption explain everything after the click?
