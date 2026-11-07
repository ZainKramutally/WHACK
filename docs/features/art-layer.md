# Art layer: Red World in the app (issue #23 + fauna)

Owner: Caden (art layer). Team lead: whack-2026-b0. Branch: `session/art-layer` (from main f65f357).

This ports the look and the procedural flora/fauna of `mockups/red-world` (the reference) into `src/render/`. Port the code by copying and adapting it. **Never import from `mockups/`.**

Read first:
- `docs/ART_DIRECTION.md`
- `CLAUDE.md`: "Stack" (one custom material, one post module), "Logic → art interface", "Visuals are stylised but never contradict the stats", "Performance", "Testing"
- the scout map below

## Decisions (Caden, 2026-11-07)
1. **The custom TSL waiver is approved.** It allows one custom world material, `src/render/material.ts`, and one pixel post pass, `src/render/post.ts`. All custom node code for the look lives in those two modules, except the terrain colorNode, which calls helpers from material.ts.
2. **Two palettes.**
   - **Carbon** is Red World: red ground, white sky, lilac haze, violet-oxblood shadow, bone/blush plants, cyan accent.
   - **Silicon** gets its own cool variant in the same style, e.g. a bone/pale-stone ground under a violet-lilac sky, with cyan or violet glow. WP1 designs it, and it must be distinct at thumbnail size.
   - Both are then modulated by the existing star lighting (`skyStyle`: brightness = light^0.22, star colour from the spectral class). Silicon gets about 1% light, so it is dim and glow dominates. That is honest and intended.
3. **Plants are big and dense.**
   - Canopy-dominant cells grow 20–40 m giants, with cold (heatBand) making them taller.
   - Mid species are 5–15 m. Ground cover is 0.3–2 m and dense.
   - **Composition counts**, the same as in the mockup: dense dark ground cover in the foreground near the camera, groves in the midground, and giant silhouettes in the background fading into haze.
   - Beyond the 400 m patch, decorative backdrop rings (landforms and distant giant silhouettes) close every view. The giants appear only when `lifeOnLand` is true.
4. **Sim growth speed** (plants grow and turn over faster) is a logic change. It has been requested from whack-2026-a1 and the eng lead. Art does not touch `src/sim`.
5. **Shadow maps stay off in phase 1.** The cel N·L terminator does the form work. Revisit only if fps allows.

## Hard rules
- Art reads only `VisualInputs` and never writes sim state. Every decoration is a pure function of the inputs plus a seeded hash.
- Never contradict the stats:
  - sea plane at `seaLevel`
  - frozen ⇒ ice
  - the underwater path stays
  - light dims and warms with the star (`skyStyle`)
  - plants only where flora biomass exists, and land plants only when `lifeOnLand`
- **60 fps at 1080p with ≥1000 animals and the full flora.** Cut render detail, never counts.
- `npm test` is banned. Use `npx vitest related --run <files>`, `npx tsc --noEmit`, `npx vite build` and `npm run smoke` (Playwright via `PLAYWRIGHT_PATH` if it isn't resolvable). Keep every existing `src/render/*.test.ts` green.
- **Phase 2 only (don't touch now):** `fauna.ts`, `layout.ts`, `motion.ts`, `pick.ts`. Other sessions are editing them, and `src/sim/plan.ts` (BodyPlan) is changing. The FaunaPart API (`hit`, `locate`, `layoutOf`→BeadLayout, `count`, `scaleBoost`) must survive phase 2.
- Real `@types/three` ~0.187 applies here, unlike the reference's loose typings. Keep TSL typing pragmatic (`any` aliases are fine) and keep `tsc` clean.

## Shared contract: `src/render/material.ts` (WP1 owns it; others code against this)
```ts
export type LookKind = 'ground' | 'flora' | 'fauna' | 'sea' | 'prop' | 'backdrop';
export interface WorldMaterialOpts {
  kind: LookKind;
  colorNode?: any;          // overrides vertex colour (e.g. terrain field)
  vertexColors?: boolean;   // read attribute `color` (linear rgb)
  glowAttr?: string | null; // float attribute, 0..1 emissive weight, multiplied by LOOK glow colour -> HDR > 1
  swayAttr?: string | null; // float attribute, 0..1 wind weight
  translucent?: boolean;    // flora underside translucency term
  flat?: boolean;           // faceted normals
  side?: number;
}
export function worldMaterial(opts: WorldMaterialOpts): any; // MeshLambertNodeMaterial with custom outputNode
export const LOOK: Record<string, any>;  // shared uniforms: fogColor, fogStart, fogDist, hazeColor, shadowTint, lightDir, lightColor, ambient, bounce, glowColor, wind, time, camPos, patch
export function updateLook(inputs: VisualInputs, camera: any, dt: number): void; // once per frame, first in world.ts step
```
- Every distance is **patch-relative**: the patch is 400 m and the camera far plane is 1000 m. Nothing is hardcoded from the reference's km-scale scene, and the HERO, EXPLORER, CORNER_CAP, DATA_RECT and river code are stripped.
- `palette.ts` stays the single colour source. It gains the Red World palettes for carbon and silicon, with `lookPalette(inputs)` returning the modulated set.

## Work packages and file ownership
| WP | Agent | Owns | Delivers |
|---|---|---|---|
| WP1 Look core | art-look | `material.ts` (new), `palette.ts`, `world.ts` | worldMaterial + LOOK + updateLook, both palettes, a stub ready within ~20 min so others can rebase, then the full port |
| WP2 Post + capture | art-post | `post.ts` (new), `app.ts` (render override), `counterpart.ts` (render hook only), `scripts/art_capture.py` (new) | pixel pipeline (~360 px internal, nearest upscale, ink depth outline, bloom threshold 1, `?style=smooth`); counterpart drawn after the pipeline at full res; shared capture script for both worlds (still + fps) |
| WP3 Ground, sky, sea, backdrop | art-world | `terrainNode.ts` (colorNode only, never the height mirror), `sky.ts`, `sea.ts`, `backdrop.ts` (new) | red/silicon ground field from height, slope, heatSolvent and lifeOnLand; Red World sky gradient and two moons dimmed by light; the real star kept; sea and ice in the look; backdrop rings outside the patch |
| WP4 Flora | art-flora | `flora.ts`, `src/render/floraLib/**` (new) | the reference flora generator ported and scaled; FloraForm.species × variant → archetypes; big and dense with fg/mg/bg composition; ≤ budget at 60 fps; floraForm.ts and its tests untouched |
| WP5 Fauna (phase 2) | later | `fauna.ts`, `render/faunaLib/**` | BodyPlan → loft adapter, near-LOD loft and far-LOD beads, FaunaPart API kept |

`main.ts`, `src/player`, `src/sim`, `src/ui` and `CLAUDE.md` are not ours. Ask the team lead if you need them.

## Done when (phase 1)
For both worlds after the build, on the default demo seed:
- the frame reads as Red World (carbon) and as its silicon variant
- three depth planes read
- 60 fps holds
- `npm run smoke` passes
- related tests and tsc are clean
- click-to-inspect still works

Then the bar-raiser reviews it before the human merges to main.
