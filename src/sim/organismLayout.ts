// Layout of SimSnapshot.organisms: one record per living organism, ORGANISM_STRIDE floats each.
// The renderer reads creatures and plants from this buffer, so change it only by agreement.
export const OrganismField = {
  x: 0, // position in the terrain patch, 0..1
  y: 1, // position in the terrain patch, 0..1
  role: 2, // 0 producer, 1 consumer
  size: 3, // relative body size (1 = typical)
  prefTemp: 4, // preferred temperature, °C
  tolerance: 5, // temperature tolerance width, °C
  chem: 6, // 0..1: oxygen need (carbon) or cold stability (silicon)
  energy: 7, // stored energy relative to the organism's reproduction threshold (1 = ready to copy)
  id: 8, // stable id for the organism's whole life, never reused; inspect cards follow it
  generation: 9, // how many copies separate it from the founders
} as const;

export const ORGANISM_STRIDE = 10;
