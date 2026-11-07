// Stub VisualInputs source until the sim worker + world configs land. The real source assembles this each frame
// from the latest SimSnapshot and the WorldConfig; consumers should only ever read the VisualInputs shape.
import type { VisualInputs } from '../worlds/types';

export function makeStubVisualInputs(): VisualInputs {
  return {
    world: {
      id: 'carbon',
      status: 'known',
      starType: 'G-type',
      solvent: { name: 'Water', freezeC: 0, criticalC: 374, solidSinks: false, vapourPressure: [[0, 0.006], [100, 1.013]], sources: [] },
      composition: { c: 0.8, si: 0.0, o: 0.2 },
    },
    stats: { temperature: 15, pressure: 1, oxygen: 21, nitrogen: 1, seaCover: 0.7, seaLevel: 0 },
    seaLevel: 0,
    frozen: false,
    heatBand: 0.5,
    heatSolvent: 0.65,
    light: 1,
    airDensity: 1.2,
    buildProgress: 1,
    terrain: { rise: 1, progress: {}, height: () => 0 },
    organisms: new Float32Array(0),
    births: [],
    flora: new Float32Array(0),
    lifeOnLand: false,
  };
}
