import { describe, expect, it } from 'vitest';
import { carbon } from './carbon';
import { leadVariant } from './lead';
import { setEgg, worldFor } from './index';

describe('lead easter egg', () => {
  it('has zero mutation and is flagged', () => {
    const m = leadVariant(carbon).life.rules.mutation;
    expect([m.size, m.prefTemp, m.tolerance, m.chem, m.sizeBoost, m.dietBoost, m.jumpRate, m.jumpScale]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(leadVariant(carbon).easterEgg).toBe('lead');
  });
  it('leaves carbon untouched with the egg off', () => {
    const before = structuredClone(carbon);
    setEgg('lead'); worldFor('carbon'); setEgg(undefined);
    expect(worldFor('carbon')).toBe(carbon);
    expect(carbon).toEqual(before);
    expect(carbon.easterEgg).toBeUndefined();
  });
});
