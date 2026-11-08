# Demo Script: Life Is ▢ Based

The 3-minute talk track for the 20 s build (issue #29). It uses only what works on `main` at `b62ddc9`, checked against the code. Nothing here was run in a browser, because of the 2026-11-08 no-browser-tests ruling, so do the **rehearsal checks** below in your own browser before the first run-through.

The story turns on one idea: carbon is the familiar world, and silicon is the door nobody has walked through. The judge watches a world build itself and then breaks its own physics on purpose.

## Pitch (3:00)

### Opening (0:00–0:15): hook on the selection screen

**Screen:** tab 1, the selection screen. Carbon is selected and the sliders are untouched (15 °C, 1 × nitrogen, 21% oxygen).

**Say:** "Earth's crust is 28% silicon and 0.02% carbon. You are 18% carbon. Life had all that silicon to work with and chose carbon anyway. So we built a planet generator that asks one question." *(Point at the sentence.)* "Life is… what based?"

**Do:** click **Generate world** at about 0:12.

### The build (0:15–0:40): talk over the world forming

| Build time | What judges see | Say |
|---|---|---|
| 0–6 s | The box zooms in, and its particles multiply and settle into ground. Caption: *A carbon world forms* | "None of this is pre-made. Terrain, seas, air and life all grow from one seed, and every number comes from real chemistry." |
| about 6 s | The character spawns on land near the shore | *(Press W and walk towards the water.)* |
| about 9 s | Caption: *Life stirs in the shallows* | "Those are the founders: two dozen tiny worms. Nobody designed what comes next." |
| 9–20 s | The terrain keeps rising and life spreads | "About a thousand animals, each carrying 15 genes, mutating and competing. Legs, plates and eyes have to be earned." |

### Explore (0:40–1:10): click a creature

**Do:** walk up to a creature and click it (a click without dragging). Click creatures or plant patches only: clicking the sea, ground or sky closes the card by design.

**Judges see:** the inspect card. It describes the body plan in words, its role, size and generation. It has a slowly turning live 3D view, and a comparison table with the columns **This world**, **A silicon world (at start)** and **Earth**. A caption *New entry: (name)* adds it to the Bestiary.

**Say:** "One function grows every body from its genes, and the world's chemistry sets the grammar. This one is generation *(read the number)*. Next to it is the same table for a silicon world: minus 183 degrees, air at three and a half bar, seas of liquid nitrogen. Finding it put it in our bestiary."

### What-if (1:10–1:35): life follows the physics

**Do:** press **Tab** to open Conditions. Drag Temperature down to about −5 °C, hold for about 3 s, then drag it back to 15 °C. **Never touch a red wall** (see "Known fragile points").

**Judges see:** the stats beside Earth's, each with a one-sentence why, and the years counter marked *illustrative*. The sea freezes into ice and thaws again.

**Say:** "Dragging Temperature moves the planet farther from its star. The sea just froze because the temperature stat crossed water's freezing point, not because an animator flipped a switch. The red zone at minus 50 is where surface life dies, and the slider can't enter it, because the slider and the simulation read the same limits."

### The turn: silicon (1:35–2:35)

**Do:** switch to tab 2 (Cmd+2), which is on the selection screen. Click **Silicon**.

**Say:** "Carbon was the easy one. Silicon is the door nobody has walked through, and the physics fights you."

| Step | Do (exact keys reproduce the rehearsed run) | Judges see | Say |
|---|---|---|---|
| 1 | Temperature: click the axis, press **Home**, **PageUp ×7**, **↓ ×3** (−183 °C) | Carbon's cell goes red: *Too cold for surface life* | "Silicon chains fall apart easily, so we go cold. Too cold for carbon." |
| 2 | (no action) | Silicon is red: *Seas boil away: too little nitrogen to hold them (speculative)*. The box has no liquid | "At this cold the only liquid that works is liquid nitrogen, and the planet doesn't have enough of it." |
| 3 | Nitrogen: click the axis, press **Home**, **PageUp ×3**, **↑ ×10** (about 32 ×) | The pool condenses, then silicon turns to grey rock and sinks: *Free oxygen turns silicon into rock (speculative)* | "Silicon grabs oxygen so hard it turns to stone. That's why Earth's crust is rock." |
| 4 | Oxygen: click the axis, press **Home** (0%) | Chains link and copy, and silicon's cell lights up: *Life can persist* | "No oxygen, no water, nitrogen seas. Now silicon can live." |
| 5 | Press **Enter** or click **Generate world** (about 2:15) | Caption: *A silicon world forms (speculative)* | "Its star is ten times farther away than our Sun. The air is three and a half bar, held by the nitrogen seas, a bit like Titan's thick air." |
| 6 | (about 2:24) | Caption: *Something stirs in the liquid nitrogen* | **Caveat, word for word:** "Most chemists doubt this. Almost nothing dissolves in liquid nitrogen, and chemistry there is extremely slow. Petkowski, Bains and Seager concluded in 2020 that no environment makes silicon life plausible. This world is our best-reasoned guess, not a prediction, and the app labels it that way everywhere." |

### Close (2:35–3:00)

**Say:** "Three.js on WebGPU. A deterministic ecology in a Web Worker: the same seed always grows the same world. About a thousand animals with 15 genes each. Every number lives in a config file with a source, or is flagged as an assumption on screen. Life on Earth is carbon based. Here, you get to choose. Thank you."

**If you're over time, cut in this order:** the bestiary line, then the what-if (just open Conditions and say the "same limits" sentence), then silicon steps 2 and 3 (say them while doing steps 1 and 4).

## Pre-demo checklist

- [ ] Pull `main`, then `npm run build && npm run preview`, and serve at http://127.0.0.1:4173. Use the production build, not the dev server.
- [ ] **Tab 1:** `http://127.0.0.1:4173/?demo`, carbon selected, sliders untouched. `?demo` pins carbon's seed (1108), so it matches rehearsal.
- [ ] **Tab 2:** `http://127.0.0.1:4173/?demo`, left on the selection screen for the silicon turn. `?demo` pins silicon's seed (2611) too.
- [ ] **Fonts:** #41 is open, so the fonts still load from Google. Load both tabs on the venue network first. Offline, the selection screen falls back to monospace.
- [ ] **Machine load:** the journal recorded fps halving from background agents (load average 18). Quit other apps, plug in the charger, and check Activity Monitor.
- [ ] **fps:** watch `?demo&debug` during rehearsal (it shows the fps readout). The bar is 60.
- [ ] Browser in full screen (Ctrl+Cmd+F), at the resolution you'll present at.
- [ ] **Backup video:** record the full path at the demo resolution. Save it locally and on a phone.
- [ ] Caveat line learned by heart.
- [ ] **Gamepad (optional):** plug it in before loading. Left stick moves, A inspects, B closes, Y opens Conditions, and the D-pad works the sliders.

## Rehearsal checks (not verifiable here: no-browser ruling)

1. Carbon `?demo`: life appears at about 9 s, and a creature with legs is reachable from spawn before about 0:45.
2. The what-if at −5 °C: the sea turns to ice within about 1 s, the population doesn't crash, and the sea thaws on return. If animals visibly drop off, shorten the hold to about 1 s, or cut the beat.
3. Tab 2 is still live after about 2 minutes in the background (no lost WebGPU context, and Generate starts instantly).
4. The silicon keys give exactly the messages in the table, in that order.
5. A full run takes ≤ 3:00, three runs in a row without a reload. Then give it to an outsider cold (`docs/TRACK.md`, Test 3).

## Known fragile points

- **Red walls (#39, #47): don't drag Temperature into one.** After carbon's 122 °C wall, life takes about 60 s to climb back to a few hundred animals. On silicon the world looks dead for over a minute. If a judge does it, say "That's the edge: no known organism grows above 122 °C. Life dies there and comes back from spores", then move to the next beat or switch tabs.
- **No hunters yet (#48).** Don't say "predators" or "predator–prey cycles". The honesty box in `CLAUDE.md` still claims hunters cycle, which isn't currently true. If asked: grazers and omnivores evolve, but a stable hunter tier doesn't, because meat pays `diet²` (`src/sim/develop.ts:360`), so half-carnivores earn too little. It's a known issue and being worked on.
- **Generate transition (#40).** The live version is still the 2D stand-in (`src/ui/selection/launch.ts`). The three.js "mitosis tide" version is in development. The narration fits both.
- **Silicon creatures (#50, #51).** They're low contrast, and Roller cards say "Moves: Swims", so the silicon path doesn't click any creatures.
- **fps after the art layer (#50).** Its last status reported about 9 fps lost on carbon. Re-check fps once it lands on `main`.
- **Demo seeds are placeholders** (`demoSeed` in `src/worlds/carbon.ts` and `src/worlds/silicon.ts`). If either changes, rehearse again.
- **Silicon run after the puzzle.** It matches rehearsal only if the slider values match exactly, so use the key presses, not free dragging.

## Talking points if asked

- **Tech stack:** three.js r187 with `WebGPURenderer` and TSL. A fixed 20 Hz sim in a Web Worker. The build fast-forwards about 340 ecology-seconds in 20 s on a schedule that depends only on build time, never on frame rate. One analytic height function runs on both GPU and CPU. The living bands are found numerically from the same limits the sim kills by.
- **Determinism:** a fresh seed on every load. The seed shows in Conditions with a copy-link, `?seed=N` replays a run, and `?demo` replays the rehearsed one.
- **Science discipline:** every world fact has a `why` and `sources`, or is marked `assumption: true` and shown as an assumption. Citations are checked on Crossref (`research/sources-verified.md`).
- **Why carbon and silicon bodies look different:** chemistry picks the body architecture. Carbon is head-to-tail with paired limbs. Silicon is a radial, faceted hub with straight arms. The same genes give unrelated bodies.
- **What is tuned (be honest):** raised mutation, a compressed pace of chemistry (silicon at about 0.42 × carbon's in the sim, about 10⁻¹³ uncompressed), and a spore bank that regrows life after a crash. The full list is the honesty box in `CLAUDE.md`.
- **Gravity:** it doesn't change creature costs. That rule failed its headless A/B, so we left it out.
- **The full silicon reasoning chain:** in Conditions on the silicon world, and in the selection screen's Appendix A.
- **Team split:** engineering lead: generation, simulation, character and integration. Caden: creatures, UI and the art layer.
- **What next:** germanium, the next element down ("bonds even weaker than silicon's"), and sound that changes per world.

## Update this script when these land

| Issue | Change |
|---|---|
| #40 three.js transition | Describe the mitosis-tide moment in the 0–6 s row |
| #48 hunters | If hunters evolve, add one line on predators. If not, fix the `CLAUDE.md` honesty box |
| #54 species experience | If 4–5 species are visible at spawn, point at them in the explore beat |
| #39, #47 recovery | If wall-and-back recovers within about 20 s, the red wall can become a deliberate beat |
