import { describe, expect, it } from 'vitest';
import { floraForm, floraBin, formForBin } from './floraForm';
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
  it('a mat-dominant cell in the dark on a water world is a translucent dome', () => {
    const dome = floraForm(0, inputs({ mat: 1, canopy: 0, light: 0.01 }))!;
    expect(dome.species).toBe('dome'); expect(dome.translucent).toBe(true);
    expect(floraForm(0, inputs({ mat: 1, canopy: 0, light: 1 }))!.species).toBe('tuft');
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
});
