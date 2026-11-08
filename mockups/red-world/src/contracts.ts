// Shared contracts for mockups/red-world. Owner: team lead. Change only by agreement.
// Brief: docs/features/red-world.md. Units: metres, Y-up.
import type { BufferGeometry } from 'three';

/**
 * sRGB hex. The whole frame is built from these. The values come from the active environment (src/env/active.ts →
 * environmentFrom(soup)); with no ?env/?soup they are the Red World (src/env/palette.ts RED_WORLD). Keys are colour
 * roles named after the Red World: on other worlds `red` is still "the base ground" and `glow` still "the accent".
 */
import { ENV } from './env/active';
import type { PaletteKey, Palette } from './env/palette';
export type { PaletteKey };
export const PALETTE: Readonly<Palette> = ENV.palette;

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
