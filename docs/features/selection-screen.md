# Feature: selection screen (the landing page)

> **Draft for the design partner,** who owns the UI (`CLAUDE.md`, "Owners"). It covers everything before the world exists: choosing carbon or silicon, the three condition sliders, the particle box, and the Standardise and Generate buttons.
> **Visual direction (owner, 2026-11-07): a pixel-art research paper.** The screen reads like page 1 of a paper. The particle box is a figure, the element chooser a table, the sliders plot axes, and the bounds an equation.
> - **Drawn in Caden's pixel style** (`docs/ART_DIRECTION_PIXEL.md`): bitmap type, the pixel palette ramps, chunky rules, checkered hatching, and a low-resolution Figure 2 upscaled nearest-neighbour.
> - **Why:** Generate zooms into Figure 2 and the world is pixel-rendered, so the page, the zoom and the world share one look.
> **Working mockup:** `mockups/selection-screen/index.html`. Its logic mirrors `CLAUDE.md`'s limits, living bands and `startingConditions`, and was checked against the cases in §9.
> **Inputs:**
> - `CLAUDE.md`: "The experience", "Condition sliders", "The particle box and the Generate transition", the data contract and the demo script
> - `docs/ART_DIRECTION.md`: family colours and world palettes; its paper/ink tone carries over
> - `docs/TRACK.md`: the 15-second hook
>
> Where this file and `CLAUDE.md` disagree, `CLAUDE.md` wins.

Tags: **[spec]** taken from `CLAUDE.md` · **[proposed]** a design choice made here, open to change · **[copy]** draft wording.

---

## 1. What this screen has to do

It is the first 15 seconds of the pitch. A judge with no context must:

1. **Get the question:** "Life is ▢ based. You choose." The title is the hook. **[spec]**
2. **See that chemistry decides where life can live.** The hatched intervals on the axes and the live viability column in Table 1 teach this without explanation. **[spec]**
3. **See the chemistry move** in Figure 2 as they touch anything. **[spec]**
4. **Start a world in one click,** which is never blocked. **[spec]**

The paper look suits the project's thesis, grounded speculation: every claim on the page is labelled, numbered, cited or footnoted, the way a paper does it. **[proposed]**

The rehearsed demo leaves every control at its default and clicks Generate at 0:15. So the default state must already read well on its own: carbon selected, chains wiggling in water, and every carbon axis inside its living band.

---

## 2. Layout

The target is the demo laptop at **1920×1080**, scaling down to 1280×720. Below 900 px wide, the columns stack. **[proposed]**

- **One paper sheet** on a PDF-viewer grey desk: white, at most 1280 px wide, centred, with a soft page shadow.
- **A title block and abstract** span the sheet. Below them are **two columns**, as in a conference paper.
- **Left column:** element choice and starting conditions, so choosing and setting happen in one place.
- **Right column:** the particle box, the result, plus references.
- **The canvas:** only Figure 2 (and, after Generate, the launch transition) is a three.js canvas. The rest is DOM. **[spec]** for the canvas, **[proposed]** for the rest.

```
┌──────────────────────────── desk (grey) ─────────────────────────────┐
│ ┌──────────────────────────── sheet ───────────────────────────────┐ │
│ │                    Life Is [C] Based                              │ │
│ │            Choosing a chemistry for a new world                   │ │
│ │                     WHACK 26 Team                                 │ │
│ │                        Abstract                                   │ │
│ │      Every living thing on Earth is built on carbon. …            │ │
│ │                                                                   │ │
│ │ 1  Choose an element            │ 3  Observation                  │ │
│ │ Table 1: Group 14 …             │ Figure 2 is the chemistry …     │ │
│ │ ─────────────────────────────── │ ┌─────────────────────────────┐ │ │
│ │ ●  6 Carbon   Known  ■ persists │ │ gas    ∘∘   ∘∘              │ │ │
│ │ ○ 14 Silicon  Spec.† ▨ too warm │ │                             │ │ │
│ │   32 Germanium …  (greyed)      │ │~~~~~~~~~~~~~~~~~~~~~~~~~~~~~│ │ │
│ │ ─────────────────────────────── │ │ liquid water  ●─●─●  ●─●    │ │ │
│ │ 2  Starting conditions          │ └─────────────────────────────┘ │ │
│ │ T, temperature      T = 15 °C   │ Figure 2: Carbon atoms in water.│ │
│ │ ▨▨▨|░░░░░░●░░░░░░░░|▨▨▨         │ Illustration, not to scale.     │ │
│ │ −250   −150  ⊕  50   150        │                                 │ │
│ │ N, nitrogen (log)   N = 1 ×     │ References                      │ │
│ │ x_O₂, free oxygen   x = 0 %     │ [1] Bains 2004 …                │ │
│ │ Figure 1: Starting conditions…  │ [2] Petkowski et al. 2020 …     │ │
│ │  −50 °C ≤ T ≤ 122 °C, N ≥ 0.05  (1)                               │ │
│ │ [Standardise to optimum] [■ Generate world]                       │ │
│ │ ───────                                                           │ │
│ │ † Speculative. Most chemists doubt this … See Appendix A.         │ │
│ │                                1                                  │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. The parts

### 3.1 Title block and abstract

- **Title,** centred: "Life Is ▢ Based", where ▢ is a thin-ruled box holding the selected element's symbol in bold. Under the symbol is a 3 px underline in the family colour (carbon `#F2552C`, silicon `#3FD8E6`). The symbol swaps with a short rise (0.35 s). **[spec]** for the words, **[proposed]** for the treatment.
- **Subtitle:** "Choosing a chemistry for a new world." **[copy]**
- **Author line:** "WHACK 26 Team". **Affiliation:** Marshall Wace "New Worlds" challenge. **Date:** 8 November 2026. **[copy]**
- **Abstract:** a centred bold "Abstract" heading over a justified paragraph that changes with the selection. **[copy]**
  - Carbon: "…The chemistry selected here, carbon, is *known*: life as we know it, in water at Earth-like temperatures."
  - Silicon: "…silicon, is *speculative*: a cold world with liquid-nitrogen seas, which most chemists doubt.†" The dagger points to the footnote (§3.6).

### 3.2 §1 Choose an element: Table 1

- A **booktabs table:** heavy rules top and bottom, a light rule under the header, no vertical rules, and the caption above, as LaTeX does for tables. **[proposed]**
- **Columns:** radio · *Z* · Element · Status · Viability at current conditions.
- **Carbon and silicon rows** are selectable. The whole row is clickable, and the radio carries the keyboard focus (`role="radio"` inside a radiogroup). The selected row gets a faint tint.
- **The viability column** reads `canLive(world, conditions)`:
  - when life can live: a small square in the family colour, then "Life can persist"
  - when it can't: a red hatched square, then the failing limit's `reason` in red
- **Silicon's status** carries a dagger (†), which points to the footnote.
- **Greyed rows** (germanium, tin, lead, flerovium) are muted, with the status "Not in this version" and their reason in italics. Clicking one flashes it faint red and announces the reason. **[copy]**:

| Row | Reason |
|---|---|
| 32 Ge | "Bonds even weaker than silicon's" **[spec]** |
| 50 Sn | "A metal: its bonds are too weak to hold a chain" **[copy]** |
| 82 Pb | "A heavy metal that barely bonds to itself" **[copy]** |
| 114 Fl | "Made in a lab; atoms last only seconds" **[spec]** |

### 3.3 §2 Starting conditions: Figure 1, Eq. (1) and the buttons

**Figure 1** shows the three sliders drawn as plot axes, with the caption below, as LaTeX does for figures. **[proposed]** Each axis block, from top to bottom:

1. **Label and readout.** The label uses math italics with a name, for example "*T*, temperature", "*N*, nitrogen inventory (log scale)", "*x*<sub>O₂</sub>, free oxygen". The readout is a math-style equation, for example "*T* = −183 °C".
2. **The axis:** a 1.2 px ink baseline across the control's **full range**, identical in every world. **[spec]** On it:
   - **Living band:** the family colour at about 22% above the baseline.
   - **Lethal intervals:** red diagonal hatching, like a plotting library's `///`, over a faint red wash. On this screen they are a **preview**. **[spec]**
   - **Empty band:** the whole axis is hatched, with the blocking reason underneath.
   - **Earth:** a dashed vertical line labelled "⊕ Earth" (15 °C, 1 ×, 21 %). **[spec]**
   - **Ticks** with labels below, using a true minus sign. Temperature: −250, −150, −50, 50 and 150. Nitrogen: 0.01, 1, 100 and 1,000. Oxygen: 0, 20 and 40.
3. **The marker:** a filled circle in the family colour with an ink edge, sitting on the baseline.
   - On this screen it moves freely across the full range. **[spec]**
   - Inside a lethal interval, its edge turns red, and the reason appears in red italics under the axis.
4. **The hint line:** small italics in muted grey (`ControlDef.hint`). **[copy]**

**Equation (1)** shows the selected world's bounds, numbered on the right, with one live sentence under it. **[proposed]**
- **Carbon:** −50 °C ≤ *T* ≤ 122 °C, *N* ≥ 0.05 × Earth. Then: "where 122 °C is the highest temperature at which any known organism grows [3]. At present every bound holds." (or names the one that fails)
- **Silicon:** −210 °C ≤ *T* ≤ −147 °C, *N* ≥ *P*<sub>vap</sub>(*T*) ⁄ (*g* · 0.78 bar), *x*<sub>O₂</sub> ≤ 0.1 %. Then, for example: "At −183 °C, *P*<sub>vap</sub> = 3.65 bar, so the seas need *N* ≥ 6.2 × Earth; the planet has 40 × Earth."
- The equation shows the physics behind the hatching, so a judge can follow the reasoning on the page itself.

**The note line:** when `startingConditions()` would move any slider, an italic "*Note.*" line sits above the buttons. For example: "Silicon life cannot persist here yet. Generating will set *T* to −183 °C and *N* to 40 × Earth." **[proposed]**

**The buttons** are square-cornered, with small-caps labels and a 1.2 px ink border. **[proposed]**
- **"Standardise to optimum"** (outlined) glides all three sliders (0.6 s) to the selected world's **optimal starting conditions**: its `startDefaults`. **[spec]** for the values, **[proposed]** for the button.
  - A note confirms the values, for example: "Standardised to carbon's optimal starting conditions: *T* = 15 °C, *N* = 1 × Earth, *x*<sub>O₂</sub> = 0 %. Oxygen comes later, from life."
  - If the sliders are already there, it says so instead.
  - Standardising carbon gives exactly the rehearsed demo start. Standardising silicon gives the values Generate would glide to anyway.
- **"Generate world"** (ink fill, white text) is **never disabled**. **[spec]**

### 3.4 §3 Observation: Figure 2, the particle box

Its behaviour is fully specified in `CLAUDE.md`. This section covers only its framing. **[spec]** for behaviour, **[proposed]** for the look.

- **A square pixel figure** with a 4 px ink frame. It is simulated at full resolution, but drawn into a **150×150 px canvas** and upscaled with `image-rendering: pixelated`, so every pixel is a real pixel. The figure is palette-locked to Caden's ramps (ART_DIRECTION_PIXEL §4).
- **Inside the figure:**
  - The gas region is the world's sky as two flat bands (field steps 3 and 4).
  - The liquid has three flat bands (surface light, base, deep) and loop-locked shimmer pixels (12 s cycle).
  - Ice is 2×2 lattice blocks. Water ice floats under the surface; nitrogen ice sinks to the floor.
- **Atoms as sprites:**
  - carbon: a 4×4 three-band bead with 2 px bonds
  - silicon: a hard-cornered 5×5 facet with a white rim pixel and 1 px rods; silicon snaps to whole pixels, while carbon may wobble one pixel (ART_DIRECTION_PIXEL §7)
  - oxygen and nitrogen: two-pixel pairs
  - rock: a 3×3 bone sprite
  - copy events: a spark pixel with a 1 px halo ring, no blur (§6)
- **Region tags:** small bone labels with an ink border, in the page's pixel font, at the left edge: "gas", then "liquid water", "ice", "liquid nitrogen" or "solid nitrogen", whichever the state is.
- **Caption below:** "**Figure 2:** Carbon atoms in water. Illustration, not to scale." On silicon, the dagger follows "liquid nitrogen". When a limit fails, a red italic line follows, for example "Life cannot persist: too warm for liquid nitrogen."

### 3.5 References

These are numbered and cited inline as [1]–[4]. **[copy]**
1. W. Bains. Many chemistries could be used to build living systems. *Astrobiology*, 4(2):137–167, 2004.
2. J. J. Petkowski, W. Bains and S. Seager. On the potential of silicon as a building block for life. *Life*, 10(6):84, 2020.
3. K. Takai et al. Cell proliferation at 122 °C … *PNAS*, 105(31):10949–10954, 2008.
4. NIST Chemistry WebBook: nitrogen phase-change data.

References 3 and 4 are still on `CLAUDE.md`'s verify list. Check them before the demo.

### 3.6 Footnote and Appendix A

- **The footnote** sits at the foot of the sheet, under a short rule, as LaTeX does. It reads: "† Speculative. Most chemists doubt this: … Petkowski, Bains and Seager [2] conclude that no environment makes silicon-based life plausible. See Appendix A." **[spec]** for the caveat.
- **"Appendix A"** is a link. It opens a page-styled dialog with the seven-step silicon reasoning chain (`WorldConfig.reasoning`) and the caveat, set off by a red rule. Close it with Esc, the Close button or a click outside.
- **The page number** "1" sits centred at the bottom of the sheet.

---

## 4. Visual tokens

All colours come from `docs/ART_DIRECTION_PIXEL.md` §4. There are no gradients, no alpha blending on surfaces, no blur and no anti-aliasing. **[proposed]**

| Token | Value | Use |
|---|---|---|
| Sky bands | the selected sea's field steps 1–4. Water for carbon: `#0A4C5E`, `#0F7A8A`, `#1BA8AE`, `#5DDCCF`. Liquid nitrogen for silicon (the frost/methane ramp, relabelled): `#34549E`, `#5C86CF`, `#8FB6EC`, `#CFE6FF` | Four flat horizontal bands behind the sheet. On a world switch they change band by band, in hard colour steps (0.5 s). |
| Sheet | bone step 4 `#FFFAEE`, 4 px ink border, notched 8 px corners, hard 8 px shadow in field step 0 | The page |
| Bone 3 / bone 1 | `#EFE6D4` / `#A8957C` | Selected row, note boxes, dashed equation rules |
| `ink` | `#120D1C` | Text, rules (4 px heavy, 2 px light), axes, frames |
| `lethal` | `#B3260F` as a 2 px checker over bone | Lethal intervals, failing reasons, the marker in red |
| Carbon ramp | `#7A1622`, `#D2332A`, `#FF6A3D`, `#FFB08A` | ▢ underline, markers, living band (light step), Generate fill, Figure 2 |
| Silicon ramp | `#0B3A78`, `#1B8FD6`, `#3FE3F2`, `#BFF8FF`, rim `#FFFFFF` | The same parts on silicon |
| Oxygen / spark | `#BE1F86`, `#FF4FB0` / `#FF7A00`, `#FFB300`, `#FFF2A0` | O₂ pairs; copy-event halos |

**Type:**
- **Text:** a bitmap pixel font, **Pixelify Sans** (Google Fonts), for body, headings and buttons. This follows ART_DIRECTION_PIXEL §10: "a bitmap pixel font for UI".
- **Maths, readouts and table numbers:** **VT323**, a terminal-style monospace that stands in for LaTeX's typewriter and maths faces.
- **Rendering:** font smoothing is turned off, and sizes stay on whole pixels (body 16 px, headings 24 px, title 48 px). **[proposed]**
- The paper conventions stay: justified text, an indent on following paragraphs, captions above tables and below figures, numbered equations, a dagger footnote and numbered references.

**Buttons:** uppercase pixel text, a 4 px ink border, and a hard 6 px ink drop shadow that collapses to 2 px when pressed. Generate is filled with the family colour.

**Departure from `ART_DIRECTION.md`:** this screen uses the pixel direction's UI rules, not Fraunces/DM Sans and paper cards. It also commits this screen to the pixel look, which `ART_DIRECTION_PIXEL.md` still lists as a candidate.

**Numbers are shown.** The old "no numbers" rule came from the previous concept. Here the units are the content.

---

## 5. Behaviour

| Action | Response | Timing |
|---|---|---|
| Page loads | Carbon is selected and Figure 2 starts with carbon chains wiggling. Renderer, worker and world materials compile in the background without blocking. **[spec]** | instant |
| Select carbon or silicon | The radio moves and the row tint follows. The ▢ symbol swaps; the abstract, Eq. (1), Figure 2 and its caption, and the footnote all update; the axes' lethal intervals switch to the new world. `selection:changed` fires. | 0.35–0.5 s |
| Drag a marker, or press arrow keys on an axis | The readout, Figure 2, Table 1's viability column, Eq. (1)'s live sentence and the lethal-interval edges all update live. Edges ease over 150 ms, so coupled moves are visible: lowering *N* on silicon slides the *T* wall down. | live |
| Marker enters a lethal interval | Its edge turns red, and the reason shows under the axis. | instant |
| Click Standardise | The sliders glide to the selected world's `startDefaults` (0.6 s), then a note confirms the values. | 0.6 s |
| Click Generate | 1. `world:selected` fires. 2. Any slider `startingConditions` moved glides first (0.8 s), with a note. **[spec]** 3. The sheet fades out as the camera pushes into Figure 2, and the world's sea colours take over. The transition continues as in `CLAUDE.md`. | 0–6 s |

---

## 6. Keyboard, gamepad and accessibility

- **Keyboard:**
  - Tab moves to the radio of the selected row, then the three axes, then Standardise, then Generate.
  - Arrow keys switch rows or adjust the focused axis. Shift + arrow takes a big step: 10 °C, ×10 nitrogen, or 5 % oxygen.
  - Enter on an axis generates.
  - Esc closes Appendix A.
- **Gamepad,** as in `CLAUDE.md`'s in-world mapping:
  - D-pad up and down move focus through rows, axes and buttons.
  - D-pad left and right adjust the focused axis or switch rows.
  - A activates the focused control; B closes Appendix A.
- **Focus rings:** 2 px link-blue, with a 3 px offset.
- **Screen readers:** each axis is `role="slider"`, with `aria-valuetext` giving the value, the unit and whether it is in a lethal interval. The radios announce the element, and the viability column is plain text.
- **Reduced motion:** the symbol rise and the row flash are dropped, and glides become instant.

---

## 7. Data it binds to (from `CLAUDE.md`'s contract)

| UI part | Reads |
|---|---|
| Abstract, footnote, Appendix A | `WorldConfig.status`, `displayName`, `reasoning`, `caveat` |
| Table 1 viability column | `canLive(world, conditions)` → `ok`, or `limit.reason` |
| Figure 1 axes | `ControlDef` and `livingBands(selectedWorld, conditions)` (low, high, empty and limit ids → `LethalLimit.reason`) |
| Earth line | `StatDef.earthValue`: 15 °C, 1 ×, 21 % |
| Eq. (1) | The selected world's `limits`, plus `Solvent.vapourPressure` and gravity for silicon's live sentence |
| Figure 2 | `boxState(world, conditions)`, `Solvent.solidSinks` |
| Standardise | `WorldConfig.startDefaults` |
| Note line and Generate glides | `startingConditions(world, requested)` → `moved` |
| Events out | `selection:changed` on every change, `world:selected` on Generate |

Greyed-row reasons, the references and Eq. (1)'s text are facts too. Under "science lives in data", they belong in config with sources, not in UI code (see open questions).

---

## 8. The zoom into the pixel world

1. **The push-in:** Figure 2's 150 px canvas is scaled up with nearest-neighbour sampling, so its pixels visibly grow as the camera pushes in.
2. **The build:** the world builds at Caden's internal resolution, **384×216**: four sky bands, then particles multiplying and settling onto a terrain line, then flat ground and sea bands with a lit edge.
3. **The upscale:** the result is shown at the largest whole-number scale that fits, letterboxed in field step 0, as ART_DIRECTION_PIXEL §3 requires.

The page, the zoom and the world never change style.

---

## 9. Done when

- [ ] A fresh viewer can say what the page asks within 15 s (Test 3 in `docs/TRACK.md`).
- [ ] The default state matches the rehearsal: carbon selected, every carbon axis in its band, carbon chains wiggling. Standardise on carbon changes nothing.
- [ ] The logic matches `CLAUDE.md`. The mockup passes these checks:
  - Untouched silicon would move *T* to −183 °C, then *N* to 40 × Earth.
  - At −183 °C and 1 × nitrogen, both carbon and silicon fail.
  - Silicon turns viable at about 6.2 × nitrogen.
  - At 40 ×, silicon's *T* band is −210 to −155 °C. At 8 ×, the upper wall slides down to −181 °C.
  - At 15 °C, silicon's *N* axis is wholly hatched.
- [ ] The silicon puzzle works by hand:
  1. Select silicon: its pool boils off.
  2. Set −183 °C: carbon fails.
  3. Raise *N*: silicon persists and its chains form.
  4. Raise *x*<sub>O₂</sub>: silicon rusts.
- [ ] Lethal intervals are never colour-only: hatching plus reason text.
- [ ] Figure 2 and Table 1 never disagree. Both come from `canLive`.
- [ ] 60 fps on the demo laptop while dragging, with Figure 2 running.
- [ ] Keyboard-only and gamepad-only runs can choose silicon, standardise and generate.

---

## 10. Open questions

1. **Does the paper look extend into the world?** The Conditions panel could become a margin note and inspect cards figure captions, so the whole product reads as one paper. Today `CLAUDE.md`'s in-world UI follows `ART_DIRECTION.md`.
2. **Typeface:** Pixelify Sans and VT323 are stand-ins. Caden's pixel direction names no specific bitmap font yet, so pick one with Caden so this page, the in-world UI and the specimen plates match.
3. **The pixel direction is still a candidate** in `ART_DIRECTION_PIXEL.md`. This screen assumes it wins; confirm with Caden.
4. **Config for page facts:** greyed-row reasons, references and Eq. (1)'s text, perhaps in `src/worlds/elements.ts` and on `WorldConfig`. That's a contract addition, so agree it with Caden.
5. **Appendix A length:** the full seven-step chain, or just the caveat in a 3-minute pitch?
6. **The Generate note line:** keep it, or let the glide note explain after the click?
