import { describe, expect, it } from 'vitest';
import { carbon } from '../../worlds/carbon';
import { silicon } from '../../worlds/silicon';
import { BOX_PAL } from './box';

describe('box palette', () => {
  for (const w of [carbon, silicon]) {
    it(`${w.id}: every crust mineral has a crust grain colour`, () => {
      for (const m of w.terrain.crust.minerals) expect(BOX_PAL.crust[m.id], m.id).toBeDefined();
    });
    it(`${w.id}: every oxidising mineral has a rust colour`, () => {
      for (const m of w.terrain.crust.minerals.filter((m) => m.oxidises)) expect(BOX_PAL.crustRust[m.id], m.id).toBeDefined();
    });
  }
});
