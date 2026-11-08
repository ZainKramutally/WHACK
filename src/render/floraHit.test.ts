import { describe, expect, it } from 'vitest';
import { makePlantList } from './floraLib/place';
import { rayPlants } from './floraHit';

function listOf(plants: { x: number; y: number; z: number; h: number }[]) {
  const l = makePlantList(8);
  plants.forEach((p, i) => { l.x[i] = p.x; l.y[i] = p.y; l.z[i] = p.z; l.h[i] = p.h; l.arch[i] = 0; });
  l.n = plants.length;
  return l;
}
const dir = { x: 0, y: 0, z: -1 };
const rph = [0.2];

describe('rayPlants', () => {
  it('hits a plant in front of the ray', () => {
    const l = listOf([{ x: 0, y: 0, z: -10, h: 10 }]);
    const h = rayPlants(l, rph, { x: 0, y: 5, z: 0 }, dir, 100);
    expect(h?.index).toBe(0);
    expect(h!.dist).toBeGreaterThan(8);
    expect(h!.dist).toBeLessThan(10);
  });
  it('misses a plant beside the ray and one above it', () => {
    const l = listOf([{ x: 6, y: 0, z: -10, h: 10 }, { x: 0, y: 20, z: -10, h: 5 }]);
    expect(rayPlants(l, rph, { x: 0, y: 5, z: 0 }, dir, 100)).toBeNull();
  });
  it('picks the nearest of several', () => {
    const l = listOf([{ x: 0, y: 0, z: -30, h: 10 }, { x: 0, y: 0, z: -10, h: 10 }]);
    expect(rayPlants(l, rph, { x: 0, y: 5, z: 0 }, dir, 100)?.index).toBe(1);
  });
  it('follows a base sunk onto its slope and the flora stretch', () => {
    const l = listOf([{ x: 0, y: 0, z: -10, h: 10 }]);
    l.sink[0] = 4; // drawn from y −4.3 to 5.7
    expect(rayPlants(l, rph, { x: 0, y: 6.2, z: 0 }, dir, 100)).toBeNull();
    expect(rayPlants(l, rph, { x: 0, y: -3, z: 0 }, dir, 100)?.index).toBe(0);
    l.sink[0] = 0; // drawn from −0.3 to 9.7; stretched × 1.1 to 10.67
    expect(rayPlants(l, rph, { x: 0, y: 10.2, z: 0 }, dir, 100, 0.03, 1.1)?.index).toBe(0);
    expect(rayPlants(l, rph, { x: 0, y: 10.2, z: 0 }, dir, 100)).toBeNull();
  });
  it('spans the plant as drawn: no further than its top, a flat crust only its drawn height, and its own crown', () => {
    const l = listOf([{ x: 0, y: 0, z: -10, h: 10 }]);
    expect(rayPlants(l, rph, { x: 0, y: 9.5, z: 0 }, dir, 100)?.index).toBe(0); // just under the top (9.7)
    expect(rayPlants(l, rph, { x: 0, y: 10.2, z: 0 }, dir, 100)).toBeNull(); // over it: no cap above the plant
    // a crust drawn at 0.48 of its size: from −0.3 to 4.5
    expect(rayPlants(l, rph, { x: 0, y: 4.2, z: 0 }, dir, 100, 0.03, 1, [0.48])?.index).toBe(0);
    expect(rayPlants(l, rph, { x: 0, y: 6, z: 0 }, dir, 100, 0.03, 1, [0.48])).toBeNull();
    // a crown 30% wider (girth 1.1 × crown 1.18): capsule radius 1.4 → 1.82
    const side = { x: 1.6, y: 5, z: 0 };
    expect(rayPlants(l, rph, side, dir, 100)).toBeNull();
    l.wg[0] = 0.1; l.wc[0] = 0.18;
    expect(rayPlants(l, rph, side, dir, 100)?.index).toBe(0);
  });
  it('hits the crown from above', () => {
    const l = listOf([{ x: 0, y: 0, z: -10, h: 10 }]);
    const d = { x: 0, y: -0.6, z: -0.8 };
    expect(rayPlants(l, rph, { x: 0, y: 14, z: 0 }, d, 100)).not.toBeNull();
  });
});
