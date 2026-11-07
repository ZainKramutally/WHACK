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

/** A dry river: centreline, half-width at start/end, and the bed-brightness fraction range (0 dark near camera → 1 bone). */
export interface River { pts: [number, number][]; w0: number; w1: number; t0: number; t1: number }

/** Branches leave the hero frame immediately and lead to the other set pieces (walkable 360°). */
export const RIVERS: River[] = [
  { pts: RIVER, w0: RIVER_HALF_WIDTH * 1.25, w1: RIVER_HALF_WIDTH * 0.7, t0: 0, t1: 1 },
  // east → titan forest
  { pts: [[-6, -6], [40, 8], [140, 0], [300, -40], [520, -110], [780, -170], [1050, -210], [1300, -230]], w0: 5, w1: 4, t0: 0.05, t1: 0.8 },
  // west → pod-lantern hollow
  { pts: [[-9, 30], [-80, 80], [-260, 150], [-500, 210], [-760, 250], [-950, 260]], w0: 5, w1: 4.5, t0: 0.05, t1: 0.85 },
  // south → second arch
  { pts: [[-9, 30], [-20, 200], [60, 450], [150, 800], [260, 1150], [300, 1420]], w0: 6, w1: 4.5, t0: 0.05, t1: 0.85 },
];

/** Basin between camera rise and the hero plateau: makes the riverbed read from a low eye. */
export const BASIN = { x: 12, z: -190, radius: 260, depth: 9 };

// ---- other set pieces around the walkable disc (all outside the hero camera's view wedge)
export const HOLLOW = { x: -950, z: 250, radius: 240, depth: 14 };      // pod-lantern hollow (west)
export const TITAN_FOREST = { x: 1350, z: -250, radius: 430 };          // titan forest (east)
export const ARCH2 = { x: 300, z: 1560, span: 900, height: 520, thick: 60 }; // second arch (south)
export const RIBS = { x: -1500, z0: -700, z1: -1400, count: 6 };          // fossil rib ridge (north-west)
export const WALK_RADIUS = 2000;
/** The overhanging framing cap in the hero frame's top-left corner (placement + material lift). */
export const CORNER_CAP = { x: -36, z: -44 };                                         // walkable disc, around the origin/hero

/** Ground data texture covers this XZ window (metres). */
export const DATA_RECT = { x0: -2400, x1: 2400, z0: -2900, z1: 1900 };

/** The single shadow map covers this square (centre xz, half-size m) around the hero frame. */
export const SHADOW_CENTER: [number, number] = [40, -330];
export const SHADOW_HALF = 560;
