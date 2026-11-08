# Devpost write-up (draft for #68)

Paste each section into the matching Devpost field. Submit a first version by 10:30 (submissions close at 11:00), then edit. Fill the three placeholders marked **TODO**.

**Project name:** Life Is ▢ Based

**Tagline (one line):** Choose what life is built from, and watch a world that suits that chemistry build itself and evolve around you.

---

## Inspiration

Earth's crust is about 28% silicon and 0.02% carbon, yet every living thing is about 18% carbon. Life had all that silicon to hand and chose carbon anyway. Science fiction has long asked what silicon life would look like, but usually without the chemistry. We wanted to open that door properly: start from real bond energies, solvents and phase diagrams, and follow them all the way to a planet you can walk on, so you can see *why* a silicon world would be frozen, oxygen-free and slow.

## What it does

You complete the sentence "Life is ▢ based" by picking an element from group 14 of the periodic table, and set a young planet's temperature, nitrogen and oxygen. A small particle box shows the chemistry live: carbon chains linking in water, or silicon rusting into grey rock the moment there's free oxygen. The carbon and silicon cells tell you whether life could survive your settings, and why not.

Click **Generate** and the box's particles multiply into the ground of a new world. In about 20 seconds terrain rises, seas fill, the air settles, and life grows from a couple of dozen tiny worms into up to a thousand evolving animals that grow legs and find new ways of moving, all while you walk around it in third person. Then the world keeps living: the ecology keeps evolving, and life keeps changing the air and seas.

- **Carbon** is life as we know it, in water.
- **Silicon** is our best-reasoned speculation: a world at about −183 °C with liquid-nitrogen seas and thick nitrogen air (about 3.6 bar, set by the seas' vapour pressure, like Titan). Its bodies are built differently: radial, faceted crystal hubs instead of head-to-tail bodies.

Click any creature or plant patch for a card that explains it in plain words, compares it with the other world and Earth, and shows it turning in a live 3D view. The Conditions panel holds the sliders for the whole run: drag them and life responds, and red zones show exactly where life would die and why. Every number on screen has a source or is labelled as an assumption, and the silicon world always shows the strongest case against itself.

## How we built it

- **three.js r187 with the WebGPU renderer** (it falls back to WebGL2), TypeScript and Vite. Custom TSL only where it pays: terrain heights, the world material and a pixel post pass.
- **A deterministic simulation in a Web Worker** at a fixed 20 Hz on a 64 × 64 grid. During the 20-second build it fast-forwards about 340 ecology-seconds on a tick schedule that depends only on build time, never frame rate, so the same seed always grows the same world.
- **Up to 1,024 animals, each with 15 genes** (12 body genes and 3 climate genes). One `develop()` function turns genes plus the world's chemistry into a body plan. The chemistry is the grammar: carbon reads the genes as a bilateral, segmented body, silicon as a radial lattice, so the two worlds' life never mirrors each other.
- **One ecology** of 12 rules with a shared utility loop (forage, hunt, flee, rest, bud), a trait ledger where every gene costs something, and plants as per-cell biomass.
- **Science in data, not code.** Each world's config holds every fact with a one-sentence reason and sources: NIST vapour-pressure tables for water and nitrogen, a radiative balance with the CO₂ greenhouse (about 3 K per doubling), an Arrhenius pace of life, and lethal limits. The sliders' red zones are found numerically from the same limits the simulation kills by, so the interface and the simulation can never disagree.
- **Vitest** for the models, the limits, determinism and the ecology, including headless runs of each world's demo seed.

## Challenges we ran into

- **Making evolution visible in 20 seconds.** Our Arrhenius estimate puts silicon's chemistry at −183 °C about 10⁻¹³ times slower than Earth's. We compress the pace of life with a declared exponent, raise mutation, and fast-forward the ecology, and we say so on screen ("compressed in the time-lapse"). Silicon still gets fewer generations than carbon, because slow chemistry should mean slow evolution.
- **Determinism with a fast-forward.** Running many ticks per frame without letting frame rate change the outcome took a tick schedule driven only by build time, plus careful seeded random streams.
- **Keeping the science honest.** Checking every citation against Crossref, NIST and the abstracts caught a claim we had attributed to the wrong paper, and a nitrogen-greenhouse figure that was smaller than its source. We fixed or flagged both.
- **Life that ignored the sliders.** Early versions let stranded swimmers keep grazing dry land, so shrinking the sea did nothing. The habitat rules now apply to feeding too, and a headless test pins the response.
- **60 fps** with a thousand animated creatures, plants and a 25,000-grain transition, on a laptop.

## Accomplishments that we're proud of

- A judge can follow the chain from "silicon bonds are weaker" all the way to "so this world is frozen, oxygen-free and has thick air", one sourced step at a time.
- The selection screen is a small physics puzzle: drag the temperature down and carbon dies, then silicon needs more nitrogen to hold a sea, then it rusts until you remove the oxygen.
- Carbon and silicon life are built by different body grammars from the same genes.
- The silicon world argues against itself: its caveat is always on screen.

## What we learned

Disciplined speculation is harder and more interesting than free invention: each "what if" forced a real constraint, and the constraints made the world. We also learned how much an honest label ("assumption", "speculative", "illustrative") adds to trust rather than taking away from the wow.

## What's next

- Germanium, the next element down ("bonds even weaker than silicon's").
- More predators: hunters now evolve, but only a handful within a demo; we want stable predator–prey cycles and a rare, solitary apex hunter.
- Sound that changes with each world's air and solvent.
- Re-reading the last few unverified figures (listed in `research/sources-verified.md`).

## Built with

three.js, WebGPU, TSL, TypeScript, Vite, Vitest, Web Workers, NIST Chemistry WebBook

## Links and media

- **Try it out:** TODO: the public build link (#72), or the repo with `npm install && npm run dev`.
- **Video:** TODO: the backup demo video link (#69).
- **Screenshots:** TODO: the selection screen with the particle box, the carbon world mid-build, an inspect card, and the silicon world.
