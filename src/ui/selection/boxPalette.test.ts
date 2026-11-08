import { describe, expect, it } from 'vitest';
import { carbon } from '../../worlds/carbon';
import { silicon } from '../../worlds/silicon';
import { BOX_PAL, HEX_GRAIN_SPRITE, columnMinerals, grainSprite } from './box';
import type { WorldConfig } from '../../worlds/types';

describe('box palette', () => {
  for (const w of [carbon, silicon]) {
    it(`${w.id}: every crust mineral has a crust grain colour`, () => {
      for (const m of w.terrain.crust.minerals) expect(BOX_PAL.crust[m.id], m.id).toBeDefined();
    });
    it(`${w.id}: every oxidising mineral has a rust colour`, () => {
      for (const m of w.terrain.crust.minerals.filter((m) => m.oxidises)) expect(BOX_PAL.crustRust[m.id], m.id).toBeDefined();
    });
  }

  it('column-forming lava (the M7 minerals) uses the hexagon sprite; other minerals keep square variants', () => {
    const hex = columnMinerals(carbon);
    expect(grainSprite('basalt', 1, hex)).toBe(HEX_GRAIN_SPRITE);
    expect(grainSprite('granite', 1, hex)).not.toBe(HEX_GRAIN_SPRITE);
    expect(HEX_GRAIN_SPRITE[0][0]).toBe('.');
    // fixture: a silicon world whose M7 is gated on reducedLava (the config lands in another branch)
    const fixture = { terrain: { machines: [{ id: 'M7', minerals: ['reducedLava'] }] } } as unknown as WorldConfig;
    const si = columnMinerals(fixture);
    expect(grainSprite('reducedLava', 2, si)).toBe(HEX_GRAIN_SPRITE);
    expect(grainSprite('basalt', 2, si)).not.toBe(HEX_GRAIN_SPRITE);
  });

  it('reducedLava has grain and rust colours', () => {
    expect(BOX_PAL.crust.reducedLava).toBeDefined();
    expect(BOX_PAL.crustRust.reducedLava).toBeDefined();
  });
});
