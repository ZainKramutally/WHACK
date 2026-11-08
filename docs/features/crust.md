# Crust and minerals

Status: in build on `session/crust` (2026-11-08). Owner: Caden (asked for it). The contract change is in `src/worlds/types.ts` (`MineralDef`, `CrustConfig`, `TerrainConfig.crust`).

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

Carbon `rustOxygen` is 1% (`assumption: true`). Its order of magnitude comes from `rye1998`: paleosols keep their iron above about 0.01–0.02 PAL, roughly 0.2–0.4% absolute. Silicon's value hardly matters, because its oxygen is pinned at 0, but the box uses it.

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
   - The ground inspect card shows `mineralAt` under the click: its label, description and why.
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

## Honesty box additions

- **Seeded:** the crust map.
- **Designed:** the elevation rule and the renormalisation (the crust redistributes nutrients and adds none).
- **Speculative:** the silicon minerals as this world's feedstock.

## Sources (scout, 2026-11-08)

The scout verified the bibliographic data and DOIs. It did not verify the supporting facts, which it recalled from memory. Every value they support therefore stays `assumption: true`, and the why sentences stay qualitative.

- `dessert2003` (10.1016/j.chemgeo.2002.10.001): basalt weathers faster than granite. The exact ratio is unverified.
- `rudnick2003` (10.1016/b978-0-08-095975-7.00301-6): continents are felsic, and ocean floors are basaltic.
- `holland2006` (10.1098/rstb.2006.1838): red beds appear after the Great Oxidation Event.
- `rye1998` (10.2475/ajs.298.8.621): the order of magnitude for `rustOxygen`.
- `keil1968` (10.1029/jb073i022p06945): enstatite chondrites contain silicon-bearing metal and nitrides. `lee1995` covers nierite. The scout found no source for the names perryite or suessite, so we don't use them.
- Magnetism (rejected below): there is no source in config. It's textbook rock magnetism (Dunlop and Özdemir 1997).

## Rejected

- **Magnetism and magnetoreception.** Red iron (hematite) is only weakly magnetic; the strongly magnetic mineral is magnetite. Navigation needs a planetary field, plus a new rule. That breaks the 12-rule cap, and judges can't see it.
- **Calcium or iron as body elements.** That would grow composition from three elements to four across the genome, `develop()` and the ledger.
