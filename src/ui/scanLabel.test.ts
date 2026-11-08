import { describe, expect, it } from 'vitest';
import { scanState } from './scanLabel';

describe('scanState', () => {
  it('known: shows the name of a filed kind', () =>
    expect(scanState({ name: 'Glass Strider', recognised: true })).toEqual({ state: 'known', label: 'Glass Strider' }));
  it('new: announced but not filed, and the name is hidden', () => {
    const s = scanState({ name: 'Glass Strider', recognised: false });
    expect(s.state).toBe('new');
    expect(s.label).not.toContain('Glass');
  });
  it('unclassified: no announced species, or no record', () => {
    expect(scanState({ recognised: false })).toEqual({ state: 'unclassified', label: 'UNCLASSIFIED' });
    expect(scanState(undefined).state).toBe('unclassified');
  });
});
