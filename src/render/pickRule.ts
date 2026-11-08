// Which hit wins when a pick ray crosses several things. Animals first: a creature beats every plant and the sea, at
// any distance, unless solid ground is in front of it (within a small tolerance for bodies partly sunk into bumps).
// Otherwise the nearest plant, then whatever the terrain march found. Pure.
export const GROUND_TOLERANCE = 2; // m

export function chooseHit(
  organismDist: number | null,
  plantDist: number | null,
  worldDist: number,
  /** Distance to solid ground along the ray (the seafloor counts); equals worldDist unless the march stopped at the sea surface. */
  groundDist: number,
): 'organism' | 'plant' | 'world' {
  if (organismDist !== null && organismDist <= groundDist + GROUND_TOLERANCE) return 'organism';
  if (plantDist !== null && plantDist <= worldDist) return 'plant';
  return 'world';
}
