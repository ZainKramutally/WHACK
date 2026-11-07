// Shared contracts for mockups/red-world. Owner: team lead. Change only by agreement.
// Brief: docs/features/red-world.md. Units: metres, Y-up.
import type { BufferGeometry } from 'three';

/** sRGB hex. The whole frame is built from these. Agents may tune values, not add keys, without agreement. */
export const PALETTE = {
  // sky / air (white family)
  skyZenith: 0xeef0f4,
  skyHorizon: 0xfff6ee,
  haze: 0xfde9e2,      // far fog: white with a breath of red
  // ground (red family)
  redLight: 0xff5a36,  // sunlit ground
  red: 0xe8331f,       // base ground
  crimson: 0xa8122a,   // shadowed ground / plant undersides
  maroon: 0x5c0a1e,    // deep crevices, foreground silhouettes
  ink: 0x22060f,       // graphic dark + outline
  // plant bodies
  bone: 0xf4e6dc,      // pale caps, stalk highlights
  blush: 0xf2a2a0,     // pale-red transitional
  // shadow tint (Bruno-style coloured shadow, never grey)
  shadow: 0x8a0f3c,
  // accent: under 5% of pixels
  glow: 0x3ff5e0,
  glowDeep: 0x0f8f9a,
} as const;
export type PaletteKey = keyof typeof PALETTE;

export type SpeciesId =
  | 'parasolTitan'
  | 'coilSpire'
  | 'lanternPods'
  | 'weeper'
  | 'ribFan'
  | 'groundCover';

/**
 * One pre-generated plant variant. Geometry is merged, non-indexed or indexed, origin at the base centre on y=0,
 * and has these attributes:
 *   position, normal (vec3)
 *   color  (vec3, LINEAR rgb, from PALETTE only)
 *   aGlow  (float 0..1: emissive weight; scene multiplies PALETTE.glow to HDR > 1 where aGlow > 0)
 *   aSway  (float 0..1: wind weight, 0 at the base rising toward tips)
 */
export interface PlantArchetype {
  species: SpeciesId;
  variant: number;
  geometry: BufferGeometry;
  height: number;   // metres, unscaled bounding height
  radius: number;   // metres, unscaled footprint radius (for placement spacing)
  triangles: number;
}

export interface FloraLibrary {
  archetypes: PlantArchetype[];
  bySpecies(species: SpeciesId): PlantArchetype[];
}

/** Implemented in src/flora/index.ts. Deterministic for a given seed. Called once at startup. */
export type BuildFloraLibrary = (seed: number) => FloraLibrary;

/** A placed instance (scene side). Scale multiplies the archetype's unscaled size. */
export interface PlantInstance {
  species: SpeciesId;
  variant: number;
  position: [number, number, number];
  yaw: number;
  scale: number;
  tilt?: [number, number]; // small lean, radians (x, z)
}
