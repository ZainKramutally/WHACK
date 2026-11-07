import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';

// DECISIONS.md §G.2, in order. If this list drifts from the doc, update both together.
const G2_NAMES = [
  'P0', 'DISSOLVE', 'B0', 'PLATE_MASS', 'INDUCE', 'REFUGE', 'SIGMA', 'TSR', 'FLY_K',
  'KLEIBER', 'Q10', 'EYE_FRAC', 'EPS0', 'GEN_EXP', 'TSR_LAND',
];

describe('constants budget', () => {
  it('has exactly the 15 names from DECISIONS §G.2 and never more than 25', () => {
    const names = Object.keys(CONSTANTS);
    expect(names.length).toBeLessThanOrEqual(25);
    expect(names).toEqual(G2_NAMES);
  });
  it('tags every constant game or sci, and is frozen', () => {
    for (const k of Object.values(CONSTANTS)) expect(['game', 'sci']).toContain(k.tag);
    expect(Object.isFrozen(CONSTANTS)).toBe(true);
  });
  it('has the pinned defaults', () => {
    expect(CONSTANTS.SIGMA.value).toBe(0.075);
    expect(CONSTANTS.TSR.value).toBe(0.6);
    expect(CONSTANTS.PLATE_MASS.value).toBe(0.15);
  });
});
