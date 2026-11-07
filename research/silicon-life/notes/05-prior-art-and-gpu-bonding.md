# 05 · Prior art (Tidemote and neighbours) and race-free GPU bonding in TSL r187

Round 2, targeted follow-up to `03-emergent-simulation.md`. Method: fetched tidemote.com, its GitHub repo (README, `package.json`, `src/shaders.js`), and the GitHub API for neighbour repos. Read three.js **r187** source from raw.githubusercontent (`src/nodes/gpgpu/AtomicFunctionNode.js`, `src/nodes/accessors/StorageBufferNode.js`, `examples/jsm/gpgpu/CountingSort.js`, `examples/webgpu_compute_*.html`) and ran a GitHub code search over `mrdoob/three.js`. Verified DOIs via OpenAlex. Date: 2026-11-07, time box about 10 min. Tags follow `../README.md`. Downloaded code was read only and never run.

---

## TL;DR

- **Q1.** Tidemote is a sealed 2D microscope biosphere. Genome-carrying cells evolve and the player *observes and nudges*: light, heat, needle, pipette. **The player cannot edit any rule or chemistry knob.** Its "abiogenesis" spawns a random genome from silt. Life does not come out of bonding chemistry. Our gap is still open: a player-authored periodic table, chemistry-first emergence, and carbon vs silicon side by side.
- **Q2.** TSL r187 exposes `atomicLoad/Store/Add/Sub/Max/Min/And/Or/Xor` only. It has **no `atomicCompareExchange` or `atomicExchange`**. We don't need them. Use **fixed-capacity bucket binning** (`atomicAdd` slot claim) for neighbours. Bonds use **per-particle-owned slots** with a **propose → mutual-best commit** pass: zero atomics, deterministic, race-free. Breaking uses a **symmetric hash roll**, so both ends agree without talking to each other.

---

## Q1 · Prior art

### Tidemote (tidemote.com, github.com/thallada/tidemote)

| Aspect | Finding | Tag |
|---|---|---|
| What | "A simulated emergent ecology of particles and mutating organisms". It is a 2D torus seen "through a microscope". Author Tyler Hallada, GPL-3.0. Repo created **2026-10-01** and still pushed daily (last push 2026-11-07). | `[POP]` site + repo metadata |
| Tech | **Raw WebGPU + hand-written WGSL** (`src/shaders.js` ≈ 546 KB, `src/engine.js`), bundled by esbuild into a single HTML file. **Not three.js.** It auto-sizes the particle count to about 10 ms of GPU time per frame ("hundreds of thousands to millions"). The sound is a SuperCollider port where each species sings its genome. | `[POP]` README, package.json |
| Per-frame passes | Resolve claims → **bin (counting sort + prefix scan, 3×3 cells)** → matter (silt and husks on currents) → contact → life (particle-life forces from **8-D surface/receptor genome signatures**, up to **2 same-species bonds**, photosynthesis, upkeep, food/silt claims) → heat field. | `[POP]` README "How the simulation works" |
| How organisms arise | **Seeded.** A world starts with "96 species, every core niche founded at least twice", placed as 2% of particles in 48 colonies. Predators "wak[e] from cysts". "Abiogenesis": "Silt in the light sparks into a random new lineage about once every 30 simulated seconds". That is a random *genome*, not something assembled from chemistry. Multicellularity is bonded same-species cells (filaments, fronds, tissue, beating tails). | `[POP]` README |
| Player controls | Pan/zoom, time ×¼…×512, click to inspect, ride and steer a cell (WASD), auto camera, 30 s film capture, Field Lab census/lineage/charts, an AI-ish "chronicler" log, species trading cards with QR genomes. Eight bench tools: touch, lamp, shade, warm, cold, needle (cuts bonds), pipette (moves organisms). **"Each does only what the world could do itself"**, which rules out rule editing. | `[POP]` README, site |
| Element/chemistry knobs | **None.** The matter is abstract ("silt", "husks", "framboids"), and every constant lives in `DEFAULT_K` in code. The climate has eras of light, heat waves, cold snaps and tides on a 10–18 min cycle. | `[POP]` README |
| Bonding implementation (useful for Q2) | Each cell owns ≤ 2 bond slots, and a bond is double-buffered (`bondsNow`). **A bond "pulls only once both ends hold it"** (`holdsBack(n, i)`), so it is formed one-sidedly and takes effect only when reciprocal. Slots close triangles only within a body. Bonds break on stretch > `bondBreak × linkR` (1.25×), on death, or on a change of kind. Claims for food and silt use **`atomicCompareExchangeWeak`** (8 uses), which is available to them because they write raw WGSL. | `[POP]` `src/shaders.js` L1100–1110, L2759–2800, L3344+ |
| Visual style | Microscope optics: bloom, focal-plane mud, grain, eyepiece dust, a loupe with barrel distortion. Cell outlines come in 12 protist-like families (desmids, frustules, etc.) that resolve with zoom. | `[POP]` README |

**Verdict:** Tidemote gets very close to the **"emergent ecosystem in the browser on GPU"** half of our pitch, and its production polish is extreme. It does not cover the **chemistry → life** half, nor **"the player changes the laws"**. `[INFERRED, high confidence]`

### Neighbours (quick pass)

| Project | What it is | Player controls laws? | Life from chemistry? | Browser? | Tag |
|---|---|---|---|---|---|
| **Tidemote** | 2D GPU biosphere of genome cells, microscope look | No, environment nudges only | No: seeded species plus random-genome sparks | Yes, raw WebGPU | `[POP]` |
| **ALIEN** (chrxh/alien, ★5.6k, C++/CUDA) | Particle-and-bond "cells" with programmable cell functions. Creatures are designed in an editor or evolved. | Sim parameters only, no periodic table | Partly: bonds are physical, but creatures are authored or seeded | No, NVIDIA desktop | `[POP]` GitHub |
| **Particle Life** (SandboxScience ★206; silvernio/gpu-life ★105; kajukabla/3d-life-sim ★31) | Attraction matrix between colour types, which gives cells and worms | Yes, but the matrix is an **abstract random** one | No replication, genome or ecology | Yes, WebGPU | `[POP]` GitHub |
| **The Life Engine** (★576, JS) / **Biogenesis** | Grid or segment organisms built from coloured cell types; evolution and ecology | No (world sliders) | No, organisms are pre-built from cell types | Yes / Java | `[POP]` |
| **Sandspiel** (★3.2k) / **The Powder Toy** (★5.4k) | Falling-sand cellular automata with element reactions | Partly (Sandspiel Studio lets you script elements) | No life or evolution | Sandspiel: yes | `[POP]` GitHub |
| **squirm3** (Hutton, ★27) | Typed-atom artificial chemistry with replicating chains | Rule table, but with abstract types | Yes, seeded replicators | Old C++ (a browser port exists) | `[POP]`/`[PEER]` (see 03) |
| **matt-bat/habitat-sim** (★1) | "Build a planet, test origins-of-life scenarios" | Planet parameters | Aggregate numbers, no particles | Yes | `[POP]` |

GitHub searches for "silicon life simulation", "alien biochemistry simulator" and "artificial chemistry webgpu" returned **nothing relevant**. The silicon hits were Silicon-Valley career games and one 0-star toy script. An itch.io search for "artificial chemistry life" also found nothing relevant. `[POP]` search results, 2026-11-07

### Three "how we're different" lines for judges

1. **"Tidemote lets you watch a world; we let you rewrite its physics."** The control surface is the periodic table: valence, electronegativity, bond energy, solvent, temperature. Every other neighbour exposes either environment sliders or an abstract random matrix.
2. **"Life isn't seeded here; it has to be chemically possible."** Organisms are promoted *from* bonded atom chains, and their bodies stay made of those atoms. If the bonds can't hold, there is no life. Tidemote, Life Engine and ALIEN all start from cells or genomes.
3. **"It's a controlled experiment on the hook: carbon vs silicon side by side."** Naive silicon in water stalls, and tuned silicon in cold methane comes alive and looks different. No project we found frames the question as an A/B you can play.

---

## Q2 · Race-free bond formation and breaking in TSL r187

### What r187 TSL actually exposes (verified from source)

- `AtomicFunctionNode.js` at tag `r187` exports **`atomicLoad, atomicStore, atomicAdd, atomicSub, atomicMax, atomicMin, atomicAnd, atomicOr, atomicXor`** (plus a generic `atomicFunc`). It has **no compare-exchange and no exchange**, and a code search for `atomicCompareExchange`/`atomicExchange` in `mrdoob/three.js` returns 0 hits. `[POP]` source
- An atomic call returns its old value when used as an expression, so `atomicAdd(...).toVar()` gives a slot index. The `CountingSort` scatter does exactly this. Atomics **error in the vertex stage**. Types are u32/i32 only, as WGSL requires. `[POP]` source
- To declare atomics, call `storage(attr,'uint',n).toAtomic()` (as `CountingSort.js` does) or `StorageBufferNode.setAtomic()`, or put struct fields `{ type:'int', atomic:true }` (as `webgpu_compute_particles_fluid.html` does). Float accumulation uses **fixed-point `int` atomicAdd** (`fixedPointMultiplier = 1e7` in the fluid example). `[POP]`
- `workgroupArray`, `workgroupBarrier`, `storageBarrier` exist. `webgpu_compute_reduce.html` shows workgroup-shared reductions and scans. `[POP]`

### Reference files in three r187

| File | Why it matters |
|---|---|
| `examples/jsm/gpgpu/CountingSort.js` | A ready-made GPU counting sort with reset → histogram (`atomicAdd`) → prefix → scatter (`atomicAdd` returns the slot). **Caveat: the prefix pass is single-threaded** (`compute(1)` looping over `binCount`, default 4096). |
| `examples/webgpu_compute_particles_fluid.html` | MLS-MPM. Shows atomic structs, fixed-point float atomics, and a clear → scatter → grid → gather multi-kernel sequence. |
| `examples/webgpu_compute_cloth.html` | **Springs as data**: `springVertexIdBuffer` (`uvec2`) plus per-vertex spring lists, computed in two passes (spring forces, then a per-vertex gather). This is the closest template for bond springs. |
| `examples/jsm/gpgpu/BitonicSort.js` + `webgpu_compute_sort_bitonic.html` | Exact sort. It is O(n log² n) and needs many dispatches, so it is overkill here. |
| `examples/webgpu_compute_reduce.html` | Workgroup scan/reduce, if a parallel prefix sum is ever needed. |

**Binning evidence outside three:** silvernio/gpu-life (WebGPU particle life, ★105) implements N², **atomic linked lists**, counting sort, and counting sort with a parallel prefix. Its README says the serial prefix sum became the bottleneck "in simulations with tens of thousands of cells", and the parallel one cut it from **~100 ms to ~0.3 ms**. `[POP]` README. Tidemote also bins with a counting sort plus prefix scan. `[POP]`

→ Implication `[INFERRED]`: three's `CountingSort` is fine at ≤ 4096 bins (a 64×64 grid). At 128² or more bins, its serial prefix may cost milliseconds. And the linked-list variant needs `atomicExchange`, which TSL doesn't have.

### The standard pattern, and its theory

"Each particle proposes its best partner; mutual-best pairs bond" is the **locally-dominant-edge** parallel matching (a ½-approximation to maximum-weight matching). The GPU version is the **handshake** matching of Fagginger Auer & Bisseling, "A GPU Algorithm for Greedy Graph Matching", LNCS 7174 (2012), doi:10.1007/978-3-642-30397-5_10 `[PEER]`. The generalisation to b slots per vertex, which is our *valence*, is **b-Suitor**: Khan, Pothen, Patwary et al., *SIAM J. Sci. Comput.* (2016), doi:10.1137/15m1026304 `[PEER]`. Random symmetry-breaking follows Luby's parallel MIS (STOC 1985), doi:10.1145/22145.22146 `[PEER]`. OpenAlex verified it; the 1986 SIAM journal version was not checked.

Key property: if scores are **symmetric** (s(i,j) = s(j,i)) and ties break by index, the globally best candidate edge is always mutually best. So every round makes progress and there is no deadlock. `[INFERRED from the cited algorithms]`

### Recommended scheme for a 24h build (simplest correct)

**Buffers:** `pos`, `vel` (vec2, or vec3 for 3D), `type`/`state` (uint), `valence[type]` (uniform LUT). `bond[i*B+k]` (uint, `NONE=0xFFFFFFFF`, B=4) is **owned by particle i; only thread i ever writes row i**. `prop[i]` (uint). `cellCount[c]` (atomic uint) and `cellItems[c*CAP+s]` (uint).

**Binning: fixed-capacity buckets instead of a sort.** It needs only `atomicAdd`, has no prefix pass, and takes two kernels.
```
P0 clear  (numCells):  atomicStore(cellCount[c], 0)
P1 insert (N):         c = cellOf(pos[i]); s = atomicAdd(cellCount[c], 1)
                       if s < CAP: cellItems[c*CAP + s] = i      // overflow silently dropped
```
Use cell size = interaction radius and CAP = 16–32. Short-range repulsion bounds density, so overflow is rare. Memory: 128²×32×4 B ≈ 2 MB. Reading the count means `min(atomicLoad(cellCount[c]), CAP)`. `[INFERRED]` If profiling later demands it, swap in `CountingSort` for cache locality. **Never physically reorder particles**, because bond slots store particle IDs. Iterate via the order/bucket indirection instead.

**Physics substep** (gather only, so no atomics):
```
F1 forces (N):  for j in 3×3 (or 3×3×3) cells: f += particleLife(type_i,type_j,d) + repulse(d)
                for k<B: j=bond[i*B+k]; if j!=NONE && holds(j,i): f += spring(d, rest(type_i,type_j))
                velNext[i] = damp(vel[i] + f*dt)
F2 integrate (N): pos[i] += velNext[i]*dt ; vel[i] = velNext[i]
```
`holds(j,i)` scans j's B slots. A bond pulls only if it is reciprocal, which is Tidemote's rule. That makes any transient one-sided slot harmless. Because F1 writes `velNext` and F2 writes `pos`, no kernel reads a buffer that the same kernel writes. Separate dispatches in one `renderer.compute([...])` call are ordered, and the writes are visible to the next dispatch. `[INFERRED from WebGPU dispatch semantics]`

**Bond step** (every 2–4 substeps):
```
B1 break (N):   for k<B: j=bond[i*B+k]; if j==NONE continue
                  E = bondEnergy(type_i,type_j, solvent); r = hash(min(i,j), max(i,j), tick)
                  if !holds(j,i) || d > breakLen || r < exp(-E/kT)*dtBond: bond[i*B+k]=NONE
                // the roll is keyed on the unordered pair → both ends decide identically, no communication
B2 propose (N): free_i = valence[type_i] - countBonds(i); prop[i]=NONE
                if free_i>0: best over neighbours j with free_j>0, j not already bonded to i, d<formR:
                  s = bondAffinity(type_i,type_j)·g(d) + ε·hash(min,max,tick)   // symmetric score + jitter
                  tie-break on min(i,j)
                prop[i] = argmax_j s
B3 commit (N):  j=prop[i]; if j!=NONE && prop[j]==i: bond[i*B + firstFree(i)] = j
                // j runs the same test and writes its own row → bond appears on both ends in one pass
                // optional Hutton rule: state_i' = rule(type_i,state_i,type_j,state_j) (read old, write new buffer)
```
- **Zero atomics in bonding.** Correctness rests on single-writer rows plus the mutual condition plus the symmetric break roll.
- Each particle gains at most one bond per bond step. At 60 fps × 2 bond steps per frame, a tetravalent atom fills up in under 0.1 s. That is fine.
- `free_j` in B2 is read from j's row as it stood before B2. A partner whose free count changes during the step can't conflict, because commits only happen between mutual pairs, and each side has at least one free slot.
- **Upgrade only if the mutual-best match rate is too low** (long preference chains): add an `atomicMax(offer[j], (quantScore<<17) | i)` handshake. With 17 bits for the ID (≤131,072 particles), 15 bits remain for the score. Split roles by `hash(i,tick)&1` (proposers/acceptors, Luby-style): acceptor j bonds the packed winner, and the proposer confirms by reading `offer[prop[i]]`. This is still CAS-free. `[INFERRED]`
- **Stats and milestones:** count bonds/chains with `atomicAdd` into a small stats buffer, then `renderer.getArrayBufferAsync` every ~0.5 s. Chain/ring detection runs on the CPU over a sampled readback, as note 03 planned.
- **Rendering bonds:** draw one instanced line per slot (N×B), with the vertex shader reading `pos[i]` and `pos[bond[i*B+k]]`. Collapse it to zero length if the slot is NONE, if i > j, or if the bond is not reciprocal.

**If CAS is truly needed later:** it is not reachable through TSL's atomic nodes in r187. The options are a raw-WGSL compute kernel via `wgslFn` (unverified whether storage-atomic pointer params work there) or restructuring around `atomicMax`/`atomicMin` packing as above. `[INFERRED, unverified]`

### Budget sanity check `[INFERRED]`
At 131k particles, 9 cells × ≤32 candidates, and B=4, the per-substep work matches the Particle Life WebGPU repos cited in 03 that run 100k+ at interactive rates. The bonding passes are 3 × N light kernels. Start at 32k and scale up.

---

## Sources
- tidemote.com; github.com/thallada/tidemote: README, package.json, src/shaders.js (fetched 2026-11-07) `[POP]`
- three.js r187: `src/nodes/gpgpu/AtomicFunctionNode.js`, `src/nodes/accessors/StorageBufferNode.js`, `examples/jsm/gpgpu/CountingSort.js`, `examples/jsm/gpgpu/BitonicSort.js`, `examples/webgpu_compute_particles_fluid.html`, `webgpu_compute_cloth.html`, `webgpu_compute_reduce.html`, `webgpu_compute_sort_bitonic.html` `[POP]`
- github.com/silvernio/gpu-life README (binning variants, prefix-sum timings) `[POP]`
- GitHub API metadata: chrxh/alien, MaxRobinsonTheGreat/LifeEngine, MaxBittker/sandspiel, The-Powder-Toy, DicSo92/SandboxScience, kajukabla/3d-life-sim, timhutton/squirm3, matt-bat/habitat-sim `[POP]`
- Fagginger Auer & Bisseling 2012, doi:10.1007/978-3-642-30397-5_10 `[PEER]` · Khan et al. 2016 (b-Suitor), doi:10.1137/15m1026304 `[PEER]` · Luby 1985/86, doi:10.1145/22145.22146 `[PEER]`

Caveats: Tidemote's site content was truncated in the fetch, so the details come mainly from the README. Star counts are as of today. Neighbour rows other than Tidemote and gpu-life are based on descriptions, not code reads. The 2D-vs-3D choice is still open, and the scheme works for both (3×3 vs 3×3×3 cells).
