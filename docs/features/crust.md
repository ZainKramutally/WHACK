# Crust and minerals

Status: built on `session/crust` (2026-11-08). Unverified values and citations are tracked in GitHub issue #82. Owner: Caden (asked for it). The contract change is in `src/worlds/types.ts` (`MineralDef`, `CrustConfig`, `TerrainConfig.crust`).

## Why

The carbon world is red all the time, which contradicts its own history. Before Earth's Great Oxidation Event the surface was dark basalt and grey-green rock, because its iron was unoxidised. Red beds only appear once free oxygen exists. On this world the rock should start dark and redden as life oxygenates the air. That way colour, oxygen and life all come from the same numbers.

Minerals also decide where life does well. Basalt weathers several times faster than granite and releases the nutrients life needs, so lowland basalt is fertile and granite highlands are poor. On the silicon world, the feedstock is reduced silicon in the crust: silicides and nitride (nierite, Si₃N₄, found in enstatite chondrites; `lee1995`). Water-ice bedrock holds no silicon. Rule 2 (Liebig, per-cell C/Si/O supply) already exists. Today every cell gets the same supply. The crust map makes it vary.

**The player makes no new decision.** The crust is seeded per world, and the demo seed is pinned. The player's lever is the Oxygen slider: oxygen rusts the rock.

## The model

- Each world's `terrain.crust` lists 2–3 minerals. Each one has:
  - a share range, sampled from the seed
  - an `elevation` preference (granite rides high as continents and basalt floors the lowlands, which is isostasy)
  - a per-element `supply` multiplier
  - `oxidises`
- `crustMap(world, seed)` assigns one mineral to every cell of the 64² grid. The assignment comes from the cell's height rank plus seeded noise at `patchCells` scale, and it fills each mineral's realised share. The function is pure and deterministic, with no reads of the world RNG stream. Heights come from `createTerrain` + `sampleHeights` at one fixed state, so the map doesn't change during the build.
- `cellSupply(world, map)` gives each cell's starting nutrients. Each cell gets base ledger supply × its mineral's multiplier, and each element is then renormalised so the patch mean equals the base. **The crust redistributes nutrients and doesn't add any**, so world totals and current tuning hold. Elements with base 0 stay 0.
- `rust(world, oxygenPct)` = clamp(oxygen ÷ `rustOxygen`, 0, 1). The art layer applies it as a ratchet on the maximum oxygen seen this run, because rock doesn't un-rust. The selection box applies it directly, because the box is a what-if.

Proposed minerals. Agents may tune the numbers, and every value needs `why` plus `sources`, or `assumption: true`.

| World | Mineral | Elevation | Share | Supply (c, si, o) | Oxidises | One line |
|---|---|---|---|---|---|---|
| Carbon | Basalt | 0.25 | 0.45–0.65 | 1.4, 1.4, 1.4 | yes (iron-rich, rusts red) | Dark volcanic rock rich in iron; it weathers fast and feeds life |
| Carbon | Granite | 0.75 | 0.35–0.55 | 0.6, 0.6, 0.6 | no | Pale, silica-rich rock that rides high as continents and weathers slowly |
| Silicon | Silicide | 0.25 | 0.30–0.50 | 1, 1.6, 1 | yes (turns to silica) | Metallic grains of silicon-bearing iron, as in the most oxygen-poor meteorites |
| Silicon | Nitride (nierite) | 0.5 | 0.25–0.40 | 1, 1.2, 1 | no | Hard silicon-nitride rock, found in oxygen-poor meteorites |
| Silicon | Water ice | 0.9 | 0.15–0.30 | 0, 0, 0 | no | Water ice, hard as rock at −183 °C; it holds no silicon, so nothing grows on it |

Carbon `rustOxygen` is 10% (`assumption: true`). Rust begins with the first oxygen: `rye1998` has paleosols keeping their iron above about 0.01–0.02 PAL, roughly 0.2–0.4% absolute. The world is drawn fully rusted by about 10%, half of today's level, a declared look choice so the rust and the flora's purple-to-green shift play out across the oxygen rise. Silicon's value hardly matters, because its oxygen is pinned at 0, but the box uses it.

## API (`src/gen/crust.ts`)

```ts
export interface CrustMap { mineral: Uint8Array; shares: number[] }   // mineral: CELLS entries (row·64 + col), index into crust.minerals; shares sum to 1
export function crustMap(world: WorldConfig, seed: number): CrustMap;
export function cellSupply(world: WorldConfig, map: CrustMap): { c: Float64Array; si: Float64Array; o: Float64Array };
export function mineralAt(world: WorldConfig, map: CrustMap, x: number, z: number): MineralDef;   // world metres, patch centred on the origin (grid.ts conventions)
export function rust(world: WorldConfig, oxygenPct: number): number;   // 0..1
```

## Tasks

1. **crust-core** (feature agent):
   - configs and sources
   - `gen/crust.ts` with tests
   - sim wiring: `createGrid` takes per-cell supply, plus the `lifeModel.ts` call site and the `__fixtures__` call site
   - the headless A/B
   - making `TerrainConfig.crust` required
2. **box-crust** (feature agent): the particle box's floor becomes a bed of mineral grains (below).
3. **sources** (scout): verify the citations listed under "Sources to verify".
4. **Art and inspect** (later, art-layer owner):
   - Terrain colour per mineral id comes from `crustMap`, smoothed across cell edges, with the rust ratchet on oxidising minerals.
   - Carbon starts dark basalt and pale granite, then reddens as oxygen rises. M6 shell stone is unchanged.
   - The ground inspect card was not shipped: the owner ruling of 2026-11-07 keeps ground clicks closed. The minerals are named in the Conditions panel's Ground fact row instead.
   - Optional: plates take a tint from the home cell's mineral, as decoration only.
   - The Generate transition needs no change: the particles already take on the ground's colours.

**A/B gate (DECISIONS §G):**
- The sim wiring ships only if a headless A/B (uniform supply vs crust supply, both worlds, at least 8 seeds) raises at least one §A metric from `src/sim/metrics.ts`, and every pinned demo test still passes.
- If it fails, the crust ships as look and box only, and the A/B result gets recorded here.

## Particle box: the bed

- The bottom rows of the box become a packed bed of mineral grains, drawn as pixel sprites like `ROCK_SPRITE`. The liquid and gas sit above it.
- The grain mix follows the world's `crustMap(world, world.demoSeed).shares`. Grain colours go in `BOX_PAL`, keyed by mineral id.
- **Oxygen.** While O₂ is present, grains of a mineral with `oxidises` change by `rust(world, oxygen)`. Carbon basalt goes from dark to rust red. Silicon silicide goes from metallic to grey-white silica, which matches the existing `rust` effect on silicon atoms.
- **The rock feeds life.** While `canLive` passes and the solvent is liquid, grains now and then release an atom of the world's element into the liquid. The rate follows the mineral's supply multiplier for that element, so ice never releases anything.
  - `freeze`: nothing is released.
  - `dryUp`: the bed lies exposed and dry.
- **Purity.** `boxState()` gains a pure `bed` field (grain shares and rust per mineral) and stays tested. The box keeps its own RNG stream.
- **Label.** The bed gets a region label, like `liquidTag`, for example "basalt · granite".

## Landforms per mineral (owner ruling 2026-11-08: build all of it)

Each mineral brings its own rock features. Every landform is a machine in the one height function (`heightCore` in `src/gen/terrain.ts`, mirrored in TSL in `src/render/terrainNode.ts`). Each is gated by the local share of its minerals, through the new `machines[].minerals` field in the config. No landform is grown by hand.

| World | Mineral | Machine | Landform | Mechanism |
|---|---|---|---|---|
| Carbon | Basalt (lowlands, coast, spawn) | M7 columns (new) | Stepped hexagonal columns in shore cliffs and coastal platforms | Thick lava cracks into mostly hexagonal columns as it cools (Giant's Causeway; Goehring et al. 2009, to verify) |
| Carbon | Ironstone (new, mid-slopes) | M5 strata + M4 walls, gated to ironstone | Banded red-and-black canyon walls | Banded iron formations form where dissolved iron meets oxygen (Karijini, Hamersley; to verify) |
| Carbon | Granite (highlands) | M8 tors (new) | Pale domes and stacked-boulder tors | Granite weathers along its joints into tors, and unloading peels it into domes (Dartmoor, Yosemite; to verify) |
| Silicon | Silicide (shore) | none | Dark metallic pebble flats, where life feeds | n/a |
| Silicon | Nitride (mid) | M9 crystals (new) | Hexagonal crystal spikes and outcrops, a crystal echo of carbon's basalt columns | Silicon nitride crystallises in the hexagonal crystal family |
| Silicon | Water ice (highlands) | relics, with `minerals: ['waterIce']` | The existing relic arches and spires, now standing only on ice | Already seeded |

**Canyons (M4) stay wherever water ran.** Canyons come from water, not iron. Ironstone only gives their walls bands.

**Column, tor and crystal sizes are stylised**, because the terrain mesh is about 2 m per vertex, so columns are at least 6 m wide. This is declared as an illustration, like creature display size.

**Shared crust weights.** The mineral weights have to be identical on CPU and GPU, and the sim's cell mineral has to equal what the look shows at that cell centre. Suggested approach:
- `crustMap` becomes the argmax of a closed-form weight function: a score mixing base height and seeded noise, with quantile thresholds computed once on the CPU and baked into the node as constants.
- That function is evaluated in `heightCore` (CPU) and in TSL.
- Mineral borders blend smoothly by `smoothstep` across each threshold.

**Third carbon mineral: ironstone.** Elevation 0.5, share 0.15–0.30, supply 0.5 (poor soil), `oxidises: true`. Basalt is rebalanced to 0.40–0.55 at elevation 0.2, and granite to 0.25–0.40 at elevation 0.8.

## The look (art layer)

- **Ground colour per mineral** comes from the same TSL weights:
  - basalt: charcoal, green-black
  - ironstone: red jasper and black hematite bands by height
  - granite: pale pink-grey
  - silicide: dark metallic
  - nitride: pale cream with facet glints
  - ice: white-blue
- **Rust ratchet.** Oxidising minerals blend towards rust by `rust(world, maxOxygenSeen)`.
- **Carbon flora is purple, then green.** Under a Sun-like star, photosynthesis is expected to be Earth-like and green (Kiang et al. 2007, to verify). The "Purple Earth" hypothesis (DasSarma and Schwieterman 2018, to verify) says early life used purple retinal pigments before chlorophyll.
  - Flora blends from purple to green on the same ratchet that rusts the rock, because both come from oxygenic photosynthesis taking over.
  - This needs a carbon `facts` row, "Plant colour", with its why, its sources, and `assumption: true` for the hypothesis.
  - Lushness needs nothing extra: flora already follows per-cell biomass, which the fertile basalt raises.
- **Silicon flora** is unchanged.
- **Ground inspect card (not shipped).** `InspectTarget` `ground` carries an optional `point: { x, z }`, and the card code can show `mineralAt` there. But the owner ruling of 2026-11-07 says clicking the sea, ground or sky opens nothing (`main.ts` onInspect), so this path can't be reached. The Ground fact row in the Conditions panel names the minerals instead. Lifting the ruling is a one-line change in `main.ts`.
- **Stretch: plate tint.** Creature plates take a slight tint from the home cell's mineral, as decoration only.

## Rock chips on the selection screen (owner ruling 2026-11-08)

Under the particle box sits one optional row of rock chips. This first version had per-world chips; it was replaced by the shared mineral chips below.
- **Default.** No chip is picked, which gives the natural seeded mix, so the rehearsed demo is unchanged.
- **What a pick does.** The picked mineral takes `crust.favour` of the patch, and the other minerals share the rest in proportion to the midpoints of their share bounds. The bed, the terrain landforms, the ground colours, the palette, fertility and the box all follow, because they all read the same crust.
- **Picking again** deselects the chip.
- **Data.** Chips come from `MineralDef.pick` (label and hint) in config. They are only on minerals that feed life: water ice can't be picked, because founders start in the shallows and an icy shore would starve them.
- **Mechanism: a derived world.** `withCrustChoice(world, mineralId?)` is pure and memoised per (world, choice). It returns the same object when no rock is picked, and otherwise a WorldConfig with adjusted share bounds. Every part of a run uses that derived world: terrain, the sim worker, VisualInputs, the box and the caches. Object identity keeps the caches correct.
- **Bus.** `selection:changed` and `world:selected` carry `crust?: string`.
- **Not a condition slider.** The crust is the planet's starting rock and doesn't change during a run, so the three-slider rule stands.

## Palette per mineral (owner rulings 2026-11-08)

The whole look follows the rock, not only the ground. The families live in `src/render/crustLook.ts` and are blended by crust shares in OKLab.
- **Rock and air.** Rock ramp, shadow, haze and fog, horizon, bounce light and the foreground tint all follow the blend.
- **Local haze.** Haze leans 60% towards the rock within about 40 m of the camera, easing over roughly 2 s.
- **Plants.** Flora uses squared weights, so the dominant soil sets the plant colour. Caden's per-plant trait tints (from each plant's own cell mineral) multiply on top.
- **Water is blue by its own physics** (Braun and Smirnov 1993). Minerals tint only the shallows, where the seabed shows through and the tint fades with depth. They nudge the open sea by at most 12%.
- **Iron makes everything red.** Rusted ironstone is the Red World: its reds, oxblood shadow `0x5a1040`, rose iron-dust haze, crimson plants and a red-orange shore stain. The plants are red because iron oxides bind phosphate and phosphate-starved plants make anthocyanins. This is recalled, not verified, and is tracked in #82.
- **Basalt stays green.** Rusted basalt is only a mild brown-grey, so the Basalt chip stays a lush, green, Earth-like world after oxygen arrives.
- **Basalt hexagons.** These are cooling cracks, not crystals. Basalt ground shows dark hexagonal joint lines everywhere. M7 adds low pavement steps inland, the tall columns stay on the coast, and the box draws basalt grains as hexagons.

## Every mineral is a chip, the same on every world (owner rulings 2026-11-08)

Like the sliders, both worlds show the same chips: `Rock: [Basalt] [Granite] [Ironstone] [Silicide] [Nitride]`. These replaced the earlier Volcanic / Continental / Iron-rich categories.
- **Chip ids.** The chip id is the mineral id: `CrustPickId` and `CRUST_PICKS` in `src/worlds/controls.ts`. Each world's `MineralDef.pick` holds only a world-specific hint. `MineralDef.favour` optionally overrides `CrustConfig.favour` (0.75) for one mineral.
- **Every world carries all five.** Foreign minerals have share bounds [0, 0]: absent from the natural map, with weight exactly 0 on CPU and GPU, appearing only when picked.
  - carbon: silicide and nitride
  - silicon: basalt, granite and ironstone
- **Natural mixes are unchanged.** Carbon is basalt, ironstone and granite. Silicon is reducedLava, silicide, nitride and water ice.
- **No chip** for reducedLava (silicon's native lava) or water ice (it would starve the founders).
- **Terrain capacity.** It supports up to 8 minerals per world: TSL weights are `[vec4, vec4]` in config order, and absent minerals emit no band. Silicon has 7.
- **Landforms follow the picked rock on both worlds:**
  - M7 columns on basalt (and reducedLava)
  - M8 domes on granite
  - M5 bands on ironstone
  - M9 crystal spikes on nitride
- **Silicate on silicon is hard going.** Basalt and granite feed silicon life poorly (si 0.3), because silicate locks silicon away (reasoning step 3). Ironstone on silicon is "iron oxide from an earlier, wetter age" (speculative). The headless safety check still found life alive at build end for all 12 world-and-pick combinations.
- **Bus.** `crust` on `selection:changed` and `world:selected` is the chip (mineral) id. A pick persists across element switches.

## Honesty box additions

- **Seeded:** the crust map.
- **Designed:** the elevation rule and the renormalisation (the crust redistributes nutrients and adds none), and the mineral-to-landform mapping.
- **Illustration:** the column, tor and crystal sizes, and plant colour (purple then green, from a hypothesis).
- **Speculative:** the silicon minerals as this world's feedstock.

## Sources (scout, 2026-11-08)

The scout verified the bibliographic data and DOIs. It did not verify the supporting facts, which it recalled from memory. Every value they support therefore stays `assumption: true`, and the why sentences stay qualitative.

- `dessert2003` (10.1016/j.chemgeo.2002.10.001): basalt weathers faster than granite. The exact ratio is unverified.
- `rudnick2003` (10.1016/b978-0-08-095975-7.00301-6): continents are felsic, and ocean floors are basaltic.
- `holland2006` (10.1098/rstb.2006.1838): red beds appear after the Great Oxidation Event.
- `rye1998` (10.2475/ajs.298.8.621): the order of magnitude for `rustOxygen`.
- `keil1968` (10.1029/jb073i022p06945): enstatite chondrites contain silicon-bearing metal and nitrides. `lee1995` covers nierite. The scout found no source for the names perryite or suessite, so we don't use them.
- `goehring2009` (10.1073/pnas.0805132106; abstract read): cooling lava cracks into columns. It gives no column width, and "mostly hexagonal" is unsourced.
- `bekker2010` (10.2113/gsecongeo.105.3.467; abstract not read): iron formations.
- `linton1955` (10.2307/1791756; abstract not read): tors.
- `kiang2007` (10.1089/ast.2006.0108; abstract read): pigment colour follows the star's light. It says nothing direct about G stars.
- `dassarma2018` (10.1017/S1473550418000423; abstract read): retinal pigments may have come before chlorophyll ("Purple Earth").
- The silicon-nitride crystal family and the Karijini and Hamersley gorges are unsourced, so they stay out of UI text.
- Magnetism (rejected below): there is no source in config. It's textbook rock magnetism (Dunlop and Özdemir 1997).

## Rejected

- **Magnetism and magnetoreception.** Red iron (hematite) is only weakly magnetic; the strongly magnetic mineral is magnetite. Navigation needs a planetary field, plus a new rule. That breaks the 12-rule cap, and judges can't see it.
- **Calcium or iron as body elements.** That would grow composition from three elements to four across the genome, `develop()` and the ledger.
