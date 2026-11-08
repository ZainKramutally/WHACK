import { describe, expect, it } from 'vitest';
import { scanLabel } from './scanLabel';

describe('scanLabel', () => {
  it('shows the name of a found kind', () => expect(scanLabel({ name: 'Glass Strider', recognised: true })).toBe('Glass Strider'));
  it('hides the name of an undiscovered kind', () => expect(scanLabel({ name: 'Glass Strider', recognised: false })).toBe('NEW SPECIES'));
  it('says NEW SPECIES with no announced species or no record', () => {
    expect(scanLabel({ recognised: false })).toBe('NEW SPECIES');
    expect(scanLabel(undefined)).toBe('NEW SPECIES');
  });
});
