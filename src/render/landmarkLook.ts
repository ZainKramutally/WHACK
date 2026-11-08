// Rock landmark colours from the crust (hoodoos, rock stacks, buttes): the mineral under the landmark sets the palette.
// Ironstone keeps the fixed Red World palette (undefined = mesh default), so only iron pillars are red. Decoration only.
import { mineralColour, RED_WORLD_GROUND_IDS } from './crustLook';
import { mixHex } from './palette';

/** Role order matches gen/landmarkMesh ROCK (0 pale … 5), 6 = deepest butte band, 7 = hematite-style dark ledge. */
export function rockPalette(id: string): number[] | undefined {
  if (RED_WORLD_GROUND_IDS.includes(id)) return undefined;
  const b = mineralColour(id, 0);
  const lit = (t: number) => mixHex(b, 0xffffff, t), dim = (t: number) => mixHex(b, 0x000000, t);
  return [lit(0.35), b, dim(0.3), lit(0.2), dim(0.5), lit(0.1), dim(0.65), dim(0.55)];
}

/** Argmax mineral id at (x, z), as crustMap picks it. */
export function mineralIdAt(crust: { minerals: readonly { id: string }[]; weights(x: number, z: number): number[] }, x: number, z: number): string {
  const w = crust.weights(x, z);
  let best = 0;
  for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
  return crust.minerals[best]?.id ?? '';
}
