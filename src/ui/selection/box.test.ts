// Pins the particle box frame for frame: the optimised createBox must match boxReference.testdata.ts (a verbatim copy of
// the pre-optimisation implementation) in particle positions and in every pixel it puts on the canvas.
import { describe, expect, it } from 'vitest';
import { worldFor } from '../../worlds';
import type { Conditions } from '../../worlds/types';
import { createBox } from './box';
import { createBox as createRef } from './boxReference.testdata';

function stubCanvas() {
  let last: Uint8ClampedArray | null = null;
  const ctx = {
    imageSmoothingEnabled: true,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: (img: { data: Uint8ClampedArray }) => { last = img.data; },
  };
  return { canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement, pixels: () => last! };
}

const hash = (a: Uint8ClampedArray) => { let h = 2166136261; for (let i = 0; i < a.length; i++) h = Math.imul(h ^ a[i], 16777619); return h >>> 0; };

const C = (temperature: number, nitrogen: number, oxygen: number): Conditions => ({ temperature, nitrogen, oxygen });
const scenarios: { name: string; world: 'carbon' | 'silicon'; conds: Conditions[] }[] = [
  { name: 'carbon living', world: 'carbon', conds: [C(15, 1, 21)] },
  { name: 'carbon hot then frozen', world: 'carbon', conds: [C(100, 1, 21), C(-60, 1, 21)] },
  { name: 'silicon living', world: 'silicon', conds: [C(-183, 30, 0)] },
  { name: 'silicon rusting then dry', world: 'silicon', conds: [C(-183, 30, 21), C(15, 1, 21)] },
];

describe('particle box', () => {
  for (const sc of scenarios) {
    it(`matches the pre-change implementation frame for frame: ${sc.name}`, () => {
      const a = stubCanvas(), b = stubCanvas();
      const box = createBox(a.canvas), ref = createRef(b.canvas);
      const world = worldFor(sc.world);
      const frames = 90;
      for (let f = 0; f < frames; f++) {
        const cond = sc.conds[Math.min(sc.conds.length - 1, Math.floor((f * sc.conds.length) / frames))];
        const now = f * 16.7, dt = 0.0167;
        box.frame(now, dt, world, { ...cond });
        ref.frame(now, dt, world, { ...cond });
        if (f % 15 === 14) {
          expect(box.seeds()).toEqual(ref.seeds());
          expect(hash(a.pixels())).toBe(hash(b.pixels()));
          expect(box.liquidTag(world)).toEqual(ref.liquidTag(world));
          expect(box.bedTag(world)).toEqual(ref.bedTag(world));
        }
      }
    });
  }
});
