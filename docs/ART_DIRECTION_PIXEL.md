# Art direction, pixel variant: "Pixel Diorama" (candidate v2)

> **Status: candidate.** This runs *alongside* `ART_DIRECTION.md` (v1, "Colour is alive") as an alternative look, switchable in the mockup (`?style=pixel`). The team picks one after comparing renders side by side. Format and rendering discipline come from our qodo-2026 art direction (`../qodo-2026/docs/design/art-direction.md`, "pixel honesty"). The worlds, rules and palette meanings come from `WORLD_ATLAS.md` and `ART_DIRECTION.md`.

**North star:** *a toy world rendered on a tiny screen.* Real 3D, drawn small and blown up. Flat, vibrant colour fields, flat vibrant light, and every pixel a real pixel.

---

## 1. Pillars

1. **Pixel honesty.** Everything is live 3D, rendered to a low-resolution target and upscaled with nearest-neighbour. No sprites, no fake pixel art, no sub-pixel smoothing, no anti-aliasing. (qodo §1, §3)
2. **Flat and vibrant.** Every surface is **3 flat bands: shadow · base · light**, each a saturated colour from a fixed ramp. No grey ambient, no soft gradients on surfaces. Light is a *colour*, not a brightness.
3. **Colour is still alive.** v1's core rule survives: saturated = alive, bone = dead stone, field = the sea. In pixel form, life takes the **most saturated ramp steps** and the field takes the mid-saturation steps.
4. **Readable at 216 px tall.** Every creature, eye, pore and landmark must read at the internal resolution: features at least 2 px, eyes as single bright pixels with a ring, and clear value steps between neighbours.
5. **Gradients only where depth needs them.** The one sanctioned non-band effect is **depth banding** (§5), plus stepped sky bands. Glow is the other exception (§6).

## 2. Influences

| Influence | Take | Don't take |
|---|---|---|
| **qodo-2026 "Commet"** (our own) | The low-res live-3D pipeline, nearest upscale, quantised bands, no outlines or dither, deterministic pixels, crisp bitmap UI drawn *outside* the pixel pass | Its muted near-black space and the lit-terminator realism. We go flatter and brighter. |
| ***A Short Hike*** (Robinson-Yu) | "Big crunchy pixels" on a 3D world, a low camera on a landscape | Soft outlines |
| ***Planetarium*** (Linssen) | Flat shading and few colours per scene, still mesmerising | Its pastels: our fields are saturated |
| **Moebius / the board's flat pins** (eco-07, eco-09, eco-02) | Flat poster colour with hard colour shapes and banded skies | Ink linework |
| **Our mood board** (`WORLD_ATLAS.md`) | "One field, one fire" per world, glow seated in shadow, giant life over a tiny observer | The photoreal AI-render surfaces |

## 3. Rendering format

| Setting | Value |
|---|---|
| Internal resolution | **384×216** default (×5 → 1920×1080, ×4 → 1536×864). Live slider 160–360 px tall. Below ~180 px creatures lose their eyes. |
| Upscale | Largest integer factor that fits, nearest-neighbour. The canvas is letterboxed and never stretched by a fractional factor. |
| Shading | Lighting is computed per fragment, then **snapped to 3 bands** (shadow / base / light) by `N·L` thresholds at **0.15 / 0.55**. Each band maps to a palette step, not a brightness multiplier. |
| Palette lock | A final pass maps every pixel to the **nearest colour in the active scene palette** (≤ 32 colours: the field ramp + family ramps + stone ramp + glow + ink). This guarantees flatness even where the shading misses. |
| Anti-aliasing / dither / outlines | **None.** Shapes come from colour bands and silhouette. |
| Bloom, tilt-shift, film grain | **Off** in pixel mode. Replaced by the pixel halo (§6) and depth bands (§5). |
| UI and labels | Native resolution, outside the pixel pass, in a bitmap pixel font. The specimen-plate cards use the same font. |
| Determinism | Same seed + time → same pixels. No `Math.random` in render code. |

## 4. Palettes

All ramps run dark → light. Bands pick from them: **shadow = step 1, base = step 2 or 3, light = step 4**. Step 0 is reserved for the deepest pockets (pores, caves, eye sockets). Step 5 is reserved for highlights and the lit rims of glass.

### 4.1 Seas (the field: sky, ground, fog, far landforms)

| Sea | 0 deep | 1 shadow | 2 base | 3 base-lit | 4 light | 5 highlight | Key-light tint | Feel |
|---|---|---|---|---|---|---|---|---|
| **Water** | `#04202B` | `#0A4C5E` | `#0F7A8A` | `#1BA8AE` | `#5DDCCF` | `#C4FFEE` | `#FFF2D6` warm | Deep teal pond, Earth-ish |
| **Ammonia** | `#12073A` | `#2D1585` | `#4F27C2` | `#7B4BEB` | `#B48CFF` | `#EADBFF` | `#FFC2E8` pink | Violet dusk |
| **Methane** | `#1E2C66` | `#34549E` | `#5C86CF` | `#8FB6EC` | `#CFE6FF` | `#FFFFFF` | `#FFFFFF` white | Frost, still, slow |
| **Acid** | `#4A1745` | `#8A2F62` | `#D8723E` | `#F2B13A` | `#FFE14A` | `#FFF8C2` | `#FFFFFF` white | Lemon-sulfur haze over a plum shadow |

**Sky** = 4 flat horizontal bands from field steps 1 → 4 (top dark, horizon light), with no gradient. Suns and moons are flat discs: the sun in step 5 plus a 1 px halo ring; moons in step 3 or 4 of the field.

### 4.2 Families (fixed across every sea: learn them once)

| Family | 1 shadow | 2 base | 3 lit | 4 light | Rim / glint |
|---|---|---|---|---|---|
| **Carbon** (soft) | `#7A1622` | `#D2332A` | `#FF6A3D` | `#FFB08A` | — |
| **Silicon** (glass) | `#0B3A78` | `#1B8FD6` | `#3FE3F2` | `#BFF8FF` | 1 px rim in `#FFFFFF` on lit silhouette edges |
| **Oxygen** (reactive) | `#5C0E4E` | `#BE1F86` | `#FF4FB0` | `#FFC0E6` | — |
| **Spark** (energy) | emissive only: `#FF7A00` · `#FFB300` · `#FFF2A0` core | | | | halo ring (§6) |
| **Ink** (eyes, UI) | `#120D1C` | glint `#FFFFFF` | | | |

**Per-atom confetti** (v1's ±5° hue jitter): in pixel mode each atom instance shifts **±1 ramp step**, seeded by its id. A living chain reads as patchwork without leaving the palette.

### 4.3 Stone (dead silicon) and stains

| Ramp | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **Bone** (fresh) | `#A8957C` | `#D8CBB4` | `#EFE6D4` | `#FFFAEE` |
| **Water stain** (iron) | `#5E0F08` | `#B3260F` | `#F2592A` | `#FF9A62` |
| **Acid stain** (sulfur-tan) | `#5A3424` | `#A86A3C` | `#E0A458` | `#FFD98A` |
| **Ammonia stain** (plum) | `#2A1238` | `#5A2F6A` | `#8E5A98` | `#C79BD0` |
| **Methane stain** (slate, faint) | `#3A4466` | `#6A7AA6` | `#A3B2D6` | `#DCE4F6` |

Staining happens **per band, not as a blend**: a stone pixel is either bone or stain, chosen by `age × height-falloff` against a stepped threshold with 2 levels. Old low stone is stained; young or high stone stays bone. This gives the posterised strata look (eco-01, eco-10) and lets design A's sediment epochs read as hard colour stripes.

**Carbon's dead matter** (gas) is 1 px rings in field step 5, rising and popping.

## 5. Depth (flat poster layers)

- **Stepped, not smooth.** By default there are three depth bands at **25 / 70 / 160 m**. Each band shifts every pixel's colour **one step towards the field's sky-horizon colour** (step 4). Far landforms become flat silhouettes in 1–2 field colours, giving the layered-card parallax of eco-06, 07 and 08.
- **Per pixel.** Each fragment picks its band from its own distance, so a spire straddling a threshold steps visibly up its height. (qodo §5 per-pixel rule.)
- **Glow ignores depth** for one band, so far pores and cups still pop.
- An optional `depth=smooth` debug mode does a continuous blend, for comparison only (qodo's sanctioned gradient). The default stays stepped for flatness.

## 6. Light and glow

- **Flat key light, saturated shadows.** One directional key per sea, tinted (§4.1). Shadows are **never grey**: the shadow band is step 1 of the surface's own ramp. Cast shadows are a single hard band in the field's step 1.
- **No ambient occlusion and no soft shadows.** Contact shadows appear only as a 1 px darker band under objects.
- **Pixel halo instead of bloom.** An emissive pixel (Spark, pore dwellers, lantern cups, eyes) is drawn unlit in its glow ramp, plus a **1 px ring** in the glow's mid step. Above HDR 2 (the discovery flash, the sun) it gets a **2 px ring**: the inner ring is mid, the outer ring is the darkest glow step at 50% (snapped to the nearest palette colour). No blur.
- **Glow sits in shadow** (v1 rule 3): halos are only drawn over pixels in a darker band than the glow, so they never wash out pale fields.

## 7. Creatures and flora at 216 px

- **Silhouette first.** Every species must be recognisable as a solid shape at 24 px tall. Carbon bodies are round-stepped, silicon bodies hard-cornered (facets become hard pixel steps).
- **Eyes:** a carbon eye is a 1 px white pupil ringed by ink (3×3 total). A silicon dot-eye cluster is 1 px Spark-amber pixels in groups of 3–6 (emissive, with no halo at that size). A big glossy hunter eye is a 4×4 ink block with a 1 px glint.
- **Motion:** silicon moves in whole-pixel ticks (snap to the pixel grid, with no sub-pixel drift). Carbon moves sub-pixel, so it *wobbles* between pixels. That shows the R1 stiffness difference in motion, for free.
- **Scale shots:** for the discovery shot (v1 §6), keep the giant creature at full pixel size and drop a tiny 6 px-tall human silhouette in field step 1 at its foot.
- **Flora caps and stalks:** stalks at least 2 px wide. Caps are flat 3-band ellipses. Lantern cups are 1 dark step plus an emissive rim.

## 8. Motion and loops

The sim isn't a loop, but **ambient layers are loop-locked** (qodo §7): flora sway, glow breathing, mote drift and water shimmer each complete a whole number of cycles per **12 s**, so idle scenes never visibly reset. Spark twinkle steps between 2 sizes, never scales smoothly.

## 9. The atlas in pixels

How each world reads in this style. "Field" = the sea ramp, "fire" = which family ramp dominates, and "pixel note" = what must survive the low resolution.

| Pin | Field | Fire | Pixel note |
|---|---|---|---|
| eco-01 Vermilion Eclipse | Water ramp pushed pale (steps 3–5) | Water-stain stone fills the ground. The figures are ink. | A 2-colour poster: stain ramp ground, pale sky bands, a **flat black eclipse disc with a 2 px white halo**. Ink figures ≥ 20 px tall. |
| eco-02 Violet Sun Hollow | Acid (steps 3–5 for sky) | Silicon + Oxygen mix (violet confetti) | The sun is a step-5 disc with a 2 px halo. Cratered rock = bone with step-0 pore pits. |
| eco-03 Sindha pillars | Water | Carbon | Top-down view. Pillars as stacked 3-band discs. Fliers are 3 px white chevrons. |
| eco-04 Frost Arches | Methane | Oxygen glow | Arches in bone, depth-banded into blue. Cups are a magenta base + emissive rim, sitting on step-1 shadow snow. |
| eco-05 Parasol Giants | Methane + acid stain (orange haze) | Carbon | Giant caps as flat ellipses with 1 px gill lines (step 1). The moon is a flat step-4 disc. |
| eco-06 Capped Sea Stacks | Water | Carbon caps on bone stacks | The turquoise lagoon is field step 4 with step-5 shimmer pixels on the loop. |
| eco-07 Two Suns Spire | Water pushed bright | All families (peak variety) | Two flat sun discs. The spire is ammonia-stain bone. The most colours of any world, so the ≤ 32 palette cap matters here. |
| eco-08 Coral Forest | Methane at night (steps 0–2 sky) | Carbon | Cap spots = bone pixels. The two moons are step-4 discs. |
| eco-09 Violet Hunter | Ammonia | Silicon (cyan beast) | The beast's feathers are hard-stepped cyan rods with the white rim. Honeycomb caps use step-0 pits. |
| eco-10 Red Canyon | Water sky (steps 4–5) | Water stain (full) | A mono-stain world plus one sky ramp. The canyon walls are depth-banded stain steps. |
| eco-11 Kelp Shoal | Water | Carbon fish | Fish are 4–6 px coral sprites from real meshes. Trunks are depth-banded teal columns. |
| eco-12 Glow Garden | Water at very dim (steps 0–2) | Silicon glow + Spark | Green comes from **teal field + amber halo pixels** sitting next to each other (an optical mix, like pointillism) rather than a new green ramp. Check this reads. |
| eco-13 Living Arch | Ammonia | Silicon body, oxygen shrubs | Stain rings are hard ammonia-stain stripes on the cyan body. |
| eco-14 Bone Reef | Acid | Spark in pores | Bone spires with step-0 pores, each with an amber emissive centre and a 1 px ring. The signature pixel shot. |
| eco-15 Lantern River | Methane at dusk | Oxygen glow | The river is a flat step-5 ribbon with loop-locked shimmer pixels. Arches are depth-banded ammonia stain. |

## 10. What changes from v1 (if this variant wins)

| v1 rule | Pixel variant |
|---|---|
| Bloom, threshold 1 | Pixel halo rings (§6) |
| Tilt-shift DOF | Stepped depth bands (§5) |
| Fog gradient, haze | Stepped depth bands + 4-band sky |
| Colour jitter ±5° hue | ±1 ramp step per atom |
| Soft cel step + fresnel rim | 3 hard bands + 1 px white rim on silicon |
| Field palettes per sea (v1 §3) | The same hues, re-cut as 6-step vibrant ramps (§4.1) |
| Stone bone → stain lerp | 2-level stepped stain (§4.3) |
| Fraunces / DM Sans UI | A bitmap pixel font for UI. Fraunces stays for the specimen plate's title only, if it reads. |

**Unchanged:** the families and their meanings, "colour = alive, bone = dead", the seas as fields, glow seated in shadow, the discovery shot, and the world rules R1–R12.

## 11. Open questions

1. **Resolution:** 384×216 (proposed) vs qodo's 320×180. Landscapes need more pixels than a single planet. Test both on eco-14 and eco-09.
2. **Does the palette lock hurt eco-07** (peak variety)? If 32 colours are too few, allow 40 there.
3. **Eco-12's green optical mix:** does it read, or do we need a "dim water" ramp shifted green?
4. Should **pixel mode be the sim view** and v1 the discovery-plate view, or one style throughout?
