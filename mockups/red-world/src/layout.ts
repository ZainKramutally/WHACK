// Composition constants for the hero frame. Camera looks down -Z. Metres, Y-up.
// Hero sits on the right-thirds line; the dry riverbed S-curves from the bottom edge to its base.

export const CAMERA = {
  pos: [0, 0, 0] as [number, number, number], // y is set from terrain + EYE
  eye: 2.8,
  fov: 38,
  yaw: 0,       // radians, + = turn left
  pitch: 0.05, // radians, slight downward look keeps sky ~40%
};

export const HERO = { x: 95, z: -470, height: 155 };
export const EXPLORER = { x: -14.5, z: -70 };

/** Dry riverbed centreline, camera → hero base. */
export const RIVER: [number, number][] = [
  [-9, 30], [-6, -6], [-10, -38], [-15, -72], [-9, -112], [10, -158], [34, -212], [50, -268], [64, -330], [80, -400], [90, -450], [93, -462],
];
export const RIVER_HALF_WIDTH = 6.5;

/** Basin between camera rise and the hero plateau: makes the riverbed read from a low eye. */
export const BASIN = { x: 12, z: -190, radius: 260, depth: 9 };

/** Ground data texture covers this XZ window (metres). */
export const DATA_RECT = { x0: -700, x1: 700, z0: -1300, z1: 100 };
