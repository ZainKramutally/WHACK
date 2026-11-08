import { describe, expect, it } from 'vitest';
import { cellPlateColour, otherGroundColour } from './cardGround';
import { mineralColour } from './crustLook';
import { groundColour } from './palette';
import { worlds } from '../worlds';

const minerals = (w: typeof worlds.carbon) => w.terrain.crust.minerals;
const terrainAt = (w: typeof worlds.carbon, id: string) => {
  const ms = minerals(w);
  return { crust: { minerals: ms, weights: () => ms.map(m => (m.id === id ? 1 : 0)) } };
};

describe('cellPlateColour', () => {
  it('basalt is a warm grey, not the Red World red', () => {
    const c = cellPlateColour(terrainAt(worlds.carbon, 'basalt'), 0, 0, 1, worlds.carbon);
    expect(c).toBe(mineralColour('basalt', 1));
    expect(c).not.toBe(mineralColour('ironstone', 1));
  });
  it('ironstone is red', () => {
    expect(cellPlateColour(terrainAt(worlds.carbon, 'ironstone'), 0, 0, 1, worlds.carbon)).toBe(0xe8331f);
  });
  it('silicon cells are never the old lilac ground', () => {
    const w = worlds.silicon;
    for (const m of minerals(w)) {
      expect(cellPlateColour(terrainAt(w, m.id), 0, 0, 1, w)).not.toBe(groundColour(w.life.composition, 1));
    }
  });
  it('falls back to a mineral colour without crust data', () => {
    const c = cellPlateColour({}, 0, 0, 0, worlds.carbon);
    expect(c).not.toBe(groundColour(worlds.carbon.life.composition, 1));
  });
});

describe('otherGroundColour', () => {
  it('uses the other world default rock, unrusted', () => {
    for (const w of [worlds.carbon, worlds.silicon]) {
      expect(otherGroundColour(w)).toBe(mineralColour(w.terrain.crust.defaultPick!, 0));
    }
  });
});
