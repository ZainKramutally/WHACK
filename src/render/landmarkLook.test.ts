import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { withCrustChoice } from '../gen/crust';
import { createTerrain } from '../gen/terrain';
import { createLandmarks } from '../gen/landmarks';
import { landmarkPieces } from '../gen/landmarkMesh';
import { hexToLab } from './palette';
import { mineralIdAt, rockPalette } from './landmarkLook';

const red = (hex: number) => {
  const [, a, b] = hexToLab(hex), c = Math.hypot(a, b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return c > 0.08 && (h <= 40 || h >= 330);
};
const ROCK = new Set(['hoodoo', 'rockStack', 'butte']);

describe('rock landmark colours follow the mineral', () => {
  it('no red rock landmark on non-iron picks', () => {
    for (const [w, pick] of [[carbon, 'basalt'], [carbon, 'granite'], [silicon, 'silicide'], [silicon, 'nitride']] as const) {
      const world = withCrustChoice(w, pick);
      const t = createTerrain(world.terrain, world.demoSeed);
      const set = createLandmarks(t, { chemistry: world.id, seaCover: 0.5 });
      const crust = { minerals: world.terrain.crust.minerals, weights: (x: number, z: number) => t.crustWeights(x, z) };
      for (const lm of set.landmarks.filter((l) => ROCK.has(l.kind))) {
        const pal = rockPalette(mineralIdAt(crust, lm.x, lm.z));
        for (const p of landmarkPieces(lm, pal)) for (const h of p.mesh.hex) expect(red(h)).toBe(false);
      }
    }
  });
  it('ironstone keeps the Red World palette; shell and ice ignore the palette', () => {
    expect(rockPalette('ironstone')).toBeUndefined();
    const t = createTerrain(carbon.terrain, carbon.demoSeed);
    const lms = createLandmarks(t, { chemistry: 'carbon', seaCover: 0.5 }).landmarks;
    const rock = lms.find((l) => ROCK.has(l.kind));
    if (rock) expect(landmarkPieces(rock).some((p) => [...p.mesh.hex].some(red))).toBe(true);
    const pal = rockPalette('basalt');
    for (const lm of lms.filter((l) => !ROCK.has(l.kind)))
      expect(landmarkPieces(lm, pal).map((p) => [...p.mesh.hex])).toEqual(landmarkPieces(lm).map((p) => [...p.mesh.hex]));
  });
});
