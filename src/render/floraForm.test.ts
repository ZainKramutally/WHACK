import { describe, expect, it } from 'vitest';
import { floraForm, floraBin, formForBin, cellSubmerged } from './floraForm';
import { makeStubVisualInputs } from './visualInputs';
import type { VisualInputs } from '../worlds/types';

function inputs(over: Partial<VisualInputs> & { si?: boolean; water?: boolean; mat?: number; canopy?: number } = {}): VisualInputs {
  const base = makeStubVisualInputs();
  const flora = new Float32Array(64 * 64 * 2);
  flora[0] = over.mat ?? 0.5; flora[1] = over.canopy ?? 0;
  return {
    ...base,
    world: {
      ...base.world,
      composition: over.si ? { c: 0, si: 0.9, o: 0.1 } : { c: 0.8, si: 0, o: 0.2 },
      solvent: { ...base.world.solvent, name: over.water === false || over.si ? 'Liquid nitrogen' : 'Water' },
    },
    light: over.light ?? 1, heatBand: over.heatBand ?? 0.5, flora,
  };
}

describe('floraForm', () => {
  it('is pure and deterministic: same inputs give the identical archetype', () => {
    const a = floraForm(0, inputs({ canopy: 1 })), b = floraForm(0, inputs({ canopy: 1 }));
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('returns null where there is no biomass', () => {
    expect(floraForm(5, inputs())).toBeNull();
  });
  it('does not mutate its inputs', () => {
    const i = inputs({ canopy: 1 });
    const copy = Array.from(i.flora.slice(0, 4));
    floraForm(0, i);
    expect(Array.from(i.flora.slice(0, 4))).toEqual(copy);
  });
  it('chemistry sets the grammar: silicon is straight, faceted, 60° branches; carbon curls', () => {
    const si = floraForm(0, inputs({ si: true, canopy: 1, mat: 0.1, light: 0.01 }))!;
    const c = floraForm(0, inputs({ canopy: 1, mat: 0.1 }))!;
    expect(si.curl).toBe(0); expect(si.branchDeg).toBe(60); expect(si.facets).toBe(true);
    expect(c.curl).toBeGreaterThan(0); expect(c.branchDeg).toBe(0); expect(c.facets).toBe(false);
  });
  it('light picks caps vs lantern cups; darkness adds glow', () => {
    const bright = floraForm(0, inputs({ canopy: 1, mat: 0.1, light: 1 }))!;
    const dim = floraForm(0, inputs({ canopy: 1, mat: 0.1, light: 0.2 }))!;
    const dark = floraForm(0, inputs({ canopy: 1, mat: 0.1, light: 0.01 }))!;
    expect(bright.species).toBe('capped'); expect(bright.glow).toBe(0);
    expect(dim.species).toBe('cup');
    expect(dark.species).toBe('cup'); expect(dark.glow).toBeGreaterThan(dim.glow);
  });
  it('a mat-dominant submerged cell on a water world is a translucent dome; the same cell on land is a tuft', () => {
    const i = inputs({ mat: 1, canopy: 0, light: 1 });
    const dome = formForBin(floraBin(1, 0, i, true));
    expect(dome.species).toBe('dome'); expect(dome.translucent).toBe(true); expect(dome.submerged).toBe(true);
    expect(floraForm(0, i)!.species).toBe('tuft');
  });
  it('submerged is read per cell from the terrain height against sea level', () => {
    const base = inputs({ mat: 1, canopy: 0 });
    const i = { ...base, seaLevel: 0, terrain: { ...base.terrain, patchSize: 400, height: (x: number) => (x < 0 ? -5 : 5) } };
    expect(cellSubmerged(0, i)).toBe(true);       // cell 0 is at the patch's -x edge
    expect(cellSubmerged(63, i)).toBe(false);
    expect(cellSubmerged(0, { ...i, terrain: { ...i.terrain, patchSize: undefined } })).toBe(false);
    i.flora[63 * 2] = 1;
    expect(floraForm(0, i)!.species).toBe('dome');
    expect(floraForm(63, i)!.species).toBe('tuft');
  });
  it('biomass magnitude gives sparse, normal and lush variants', () => {
    const i = inputs();
    const f = (m: number, c: number) => formForBin(floraBin(m, c, i));
    expect(new Set([f(0.1, 0).lush, f(0.6, 0).lush, f(0.8, 0.5).lush])).toEqual(new Set([0, 1, 2]));
    expect(f(0.8, 0.5).capScale).toBeGreaterThan(f(0.1, 0).capScale);
  });
  it('one world shows at least 4 archetypes from per-cell axes alone (carbon and silicon)', () => {
    for (const si of [false, true]) {
      const i = inputs({ si });
      const keys = new Set<string>();
      for (const sub of [false, true]) for (const [m, c] of [[0.1, 0], [0.9, 0], [0.5, 0.4], [0.4, 1], [0.3, 0.9]]) keys.add(formForBin(floraBin(m, c, i, sub)).key);
      expect(keys.size).toBeGreaterThanOrEqual(4);
    }
  });
  it('heat band sets height: cold is taller than hot', () => {
    const cold = floraForm(0, inputs({ canopy: 1, heatBand: 0 }))!, hot = floraForm(0, inputs({ canopy: 1, heatBand: 1 }))!;
    expect(cold.heightScale).toBeGreaterThan(hot.heightScale);
  });
  it('distinct inputs give distinct archetypes; mat vs canopy picks the species', () => {
    const keys = new Set([
      floraForm(0, inputs({ mat: 1, canopy: 0 }))!, floraForm(0, inputs({ mat: 0.1, canopy: 1 }))!,
      floraForm(0, inputs({ mat: 1, canopy: 0, light: 0.01 }))!, floraForm(0, inputs({ si: true, mat: 1, canopy: 0, light: 0.01 }))!,
      floraForm(0, inputs({ si: true, mat: 0.1, canopy: 1, light: 0.01 }))!, floraForm(0, inputs({ mat: 0.1, canopy: 1, light: 0.2 }))!,
    ].map((f) => f.key));
    expect(keys.size).toBe(6);
    expect(floraForm(0, inputs({ si: true, mat: 1, canopy: 0 }))!.species).toBe('crust');
    expect(floraForm(0, inputs({ si: true, mat: 0.1, canopy: 1 }))!.species).toBe('spire');
  });
  it('bins are quantised: tiny changes stay in the same bin', () => {
    const a = floraBin(0.5, 0.5, inputs({ heatBand: 0.5 })), b = floraBin(0.5, 0.52, inputs({ heatBand: 0.52 }));
    expect(formForBin(a)).toBe(formForBin(b));
  });

  it('cellSubmerged cache agrees with direct sampling and skips repeat height calls', () => {
    const base = makeStubVisualInputs();
    let calls = 0;
    const mk = (off: number) => (x: number, z: number) => { calls++; return Math.sin(x * 0.05 + off) * 5 + z * 0.01; };
    const direct = (f: (x: number, z: number) => number, sea: number) =>
      Array.from({ length: 4096 }, (_, c) => { const w = 400 / 64; return f(((c % 64) + 0.5) * w - 200, (Math.floor(c / 64) + 0.5) * w - 200) < sea; });
    for (const [off, sea] of [[0, 0], [0, 1.5], [1, 1.5]] as const) {   // sea level move, then new terrain function
      const f = mk(off);
      const i = { ...base, seaLevel: sea, terrain: { ...base.terrain, patchSize: 400, height: f } };
      const got = Array.from({ length: 4096 }, (_, c) => cellSubmerged(c, i));
      expect(got).toEqual(direct(mk(off), sea));
      const before = calls;
      Array.from({ length: 4096 }, (_, c) => cellSubmerged(c, { ...i, seaLevel: sea + 0.3 }));
      expect(calls).toBe(before);
    }
  });
});
