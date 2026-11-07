// Shared contracts for the world generator mockups.
// Owner: team lead (art). Change only by agreement — every module builds against this file.
// Spec: docs/features/world-generator.md. Units: metres, Y-up, camera looks towards -Z.

// TSL nodes are loosely typed in @types/three; keep them as `any` aliases so nobody fights types at 3am.
export type TSLNode = any;
export type UniformNode<T = number> = TSLNode & { value: T };

// ---------------------------------------------------------------- dials (inputs)

export interface Recipe { c: number; si: number; o: number } // barycentric, sums to 1
export interface SeaWeights { water: number; ammonia: number; methane: number; acid: number } // sums to 1

export interface Dials {
  recipe: Recipe;
  sea: SeaWeights;
  heat: number;  // 0 cryo · 0.5 Goldilocks · 1 scorching
  light: number; // 0 dark · 1 blazing
  age: number;   // 0 young · 1 ancient
  seed: number;  // layout randomness only
}

// ---------------------------------------------------------------- derived (emergence layer)

export type SpeciesId =
  | 'lanternCups'    // eco-04 pin flora
  | 'frostFans'      // eco-04 new
  | 'glowStalks'     // eco-12 pin flora
  | 'mossDomes'      // eco-12 pin flora
  | 'shadeRibbons'   // eco-12 new
  | 'poreDwellers'   // eco-14 pin flora (emissive inside spire pores, not geometry)
  | 'glassWhiskers'  // eco-14 new
  | 'blackMonoliths' // eco-01 (replaces the pin's figures)
  | 'ashScrub';      // eco-01 new

export const SPECIES: SpeciesId[] = [
  'lanternCups', 'frostFans', 'glowStalks', 'mossDomes', 'shadeRibbons',
  'poreDwellers', 'glassWhiskers', 'blackMonoliths', 'ashScrub',
];

/** All colours are 0xRRGGBB numbers (sRGB). */
export interface Palette {
  skyTop: number;
  skyHorizon: number;
  haze: number;      // aerial-perspective colour far away
  fog: number;       // height-fog colour near the ground
  ground: number;    // base terrain colour (before snow/stain)
  shadow: number;    // coloured shadow hue (never grey/black)
  accent: number;    // the pin's "fire" colour
}

export interface Derived {
  palette: Palette;
  stoneColor: number;   // stained stone, see stainAmount
  stainAmount: number;  // 0 bone .. 1 fully stained
  builders: number;     // 0..1 how much built stone (spires, walls)
  spireHeight: number;  // multiplier on landmark spire heights (cold = giant)
  erosion: number;      // 0..1 jaggedness / pores closing
  pores: number;        // 0..1 pore density on stone
  arches: number;       // 0..1 arch survival
  snow: number;         // 0..1 frost cover on up-facing ground
  life: number;         // 0..1 Goldilocks band
  glow: number;         // 0..1 bioluminescence strength
  glowHue: number;      // flora glow colour from recipe
  poreGlowHue: number;  // Spark amber/orange inside pores
  capWidth: number;     // 0..1 flat caps (light)
  stalkHeight: number;  // 0..1 tall thin reachers (dark + cool)
  fogDensity: number;
  char: number;         // 0..1 carbon survivors go black
  niches: Record<SpeciesId, number>; // 0..1 density per species
}

// ---------------------------------------------------------------- composition (per preset)

export type Vec3 = [number, number, number];
export type Vec2 = [number, number]; // [x, z] on the ground plane

export type Landmark =
  | { kind: 'spire'; pos: Vec2; height: number; radius: number; porous?: boolean; horns?: boolean; lean?: Vec2 }
  | { kind: 'arch'; a: Vec2; b: Vec2; apex: number; radius: number }
  | { kind: 'wall'; pos: Vec2; height: number; width: number; depth: number; overhang?: boolean; yaw?: number }
  | { kind: 'monolith'; pos: Vec2; height: number }
  | { kind: 'dome'; pos: Vec2; radius: number; stack?: number }
  | { kind: 'cluster'; species: SpeciesId; pos: Vec2; radius: number; count: number; scale?: number };

export type SkyEvent = 'none' | 'eclipse' | 'moons';

export interface Composition {
  aspect: number;                 // width / height of the pin; canvas letterboxes to this in pin view
  camera: { position: Vec3; target: Vec3; fov: number }; // fov = vertical degrees
  sunDir: Vec3;                   // towards the sun (also the eclipse position in the sky)
  skyEvent: SkyEvent;
  valley: Vec2[];                 // path spline the walls/terrain open around, near → far
  valleyWidth: number;
  landmarks: Landmark[];          // hero placements; the generator adds procedural filler around them
  figure: { pos: Vec2; height: number } | null; // tiny explorer silhouette for scale
}

export interface Preset {
  id: 'eco01' | 'eco04' | 'eco12' | 'eco14';
  name: string;
  pin: string;                    // repo path to the reference image
  dials: Dials;
  composition: Composition;
  pinPalette: Palette;            // measured from the pin: the calibrated palette field's anchor
}

// ---------------------------------------------------------------- runtime

/** GPU-side uniforms, written every frame by the core morph system from `Derived`. Modules read, never write. */
export interface WorldUniforms {
  time: UniformNode;
  skyTop: UniformNode; skyHorizon: UniformNode; haze: UniformNode; fogColor: UniformNode;
  ground: UniformNode; shadowColor: UniformNode; accent: UniformNode;   // THREE.Color values
  stoneColor: UniformNode; glowColor: UniformNode; poreGlowColor: UniformNode;
  stainAmount: UniformNode; pores: UniformNode; erosion: UniformNode; snow: UniformNode;
  glow: UniformNode; char: UniformNode; heat: UniformNode; light: UniformNode; age: UniformNode;
  wind: UniformNode;                                                   // 0..1 sway strength
  niches: Record<SpeciesId, UniformNode>;                              // instance visible when rand < niche
}

export interface WorldMaterialOptions {
  color?: TSLNode | number;   // base albedo; default = ground
  stone?: boolean;            // use stoneColor + stain streaks (stain heavier low down)
  snowCover?: boolean;        // frost on up-facing normals by uniforms.snow
  emissive?: TSLNode;         // HDR > 1 blooms; < 1 never does
  glass?: boolean;            // fresnel rim + flat facets (silicon) — ART_DIRECTION §9
  flatShading?: boolean;
  positionNode?: TSLNode;     // e.g. wind sway; applied before instancing
  opacity?: TSLNode | number;
}

/** One shared look: cel-stepped diffuse, coloured shadows, palette fog. Provided by core. */
export interface MaterialFactory {
  create(opts?: WorldMaterialOptions): any; // returns a THREE node material
}

export interface WorldContext {
  scene: any; camera: any; renderer: any;
  preset: Preset;
  derived: Derived;              // current (morphing) derived values, CPU side
  uniforms: WorldUniforms;
  materials: MaterialFactory;
  quality: 'low' | 'high';
  /** CPU terrain height at (x, z). Provided by the landforms module; flat 0 until it builds. */
  terrainHeight: (x: number, z: number) => number;
  rng: (stream: string) => () => number; // seeded, deterministic per stream name
}

export interface WorldModule {
  id: string;
  build(ctx: WorldContext): void | Promise<void>;
  update?(ctx: WorldContext, dt: number): void;
  dispose(): void;
}
