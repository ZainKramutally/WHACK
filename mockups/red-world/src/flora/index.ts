// Flora library: seeded procedural alien plants, generated once into merged BufferGeometry archetypes.
import type { BuildFloraLibrary, PlantArchetype, SpeciesId } from '../contracts';
import { makeRng, subSeed, type Rng } from './rng';
import { parasolTitan } from './species/parasol';
import { coilSpire } from './species/coil';
import { lanternPods } from './species/lantern';
import { weeper } from './species/weeper';
import { ribFan } from './species/ribfan';
import { groundCover } from './species/ground';

type Gen = (rng: Rng, variant: number) => { geometry: any; height: number; radius: number; triangles: number };

export const SPECIES: { id: SpeciesId; variants: number; gen: Gen }[] = [
  { id: 'parasolTitan', variants: 4, gen: parasolTitan },
  { id: 'coilSpire', variants: 4, gen: coilSpire },
  { id: 'lanternPods', variants: 4, gen: lanternPods },
  { id: 'weeper', variants: 4, gen: weeper },
  { id: 'ribFan', variants: 4, gen: ribFan },
  { id: 'groundCover', variants: 4, gen: groundCover },
];

export const buildFloraLibrary: BuildFloraLibrary = (seed) => {
  const archetypes: PlantArchetype[] = [];
  SPECIES.forEach((sp, si) => {
    for (let v = 0; v < sp.variants; v++) {
      const g = sp.gen(makeRng(subSeed(seed, si, v)), v);
      archetypes.push({ species: sp.id, variant: v, ...g });
    }
  });
  return {
    archetypes,
    bySpecies: (species) => archetypes.filter((a) => a.species === species),
  };
};
