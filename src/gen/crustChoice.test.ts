import { describe, expect, it } from 'vitest';
import { crustMap, withCrustChoice } from './crust';
import { carbon } from '../worlds/carbon';
import { CRUST_PICKS } from '../worlds/controls';
import { silicon } from '../worlds/silicon';

describe('withCrustChoice', () => {
  it('returns the world itself for no, unknown or unpickable ids', () => {
    expect(withCrustChoice(carbon)).toBe(carbon);
    expect(withCrustChoice(carbon, 'nope' as never)).toBe(carbon);
    expect(withCrustChoice(silicon, 'waterIce' as never)).toBe(silicon);
  });
  it('every world offers every chip', () => {
    for (const w of [carbon, silicon]) for (const c of CRUST_PICKS) expect(w.terrain.crust.minerals.filter((m) => m.pick?.id === c.id)).toHaveLength(1);
  });
  it('is memoised and deterministic', () => {
    expect(withCrustChoice(carbon, 'continental')).toBe(withCrustChoice(carbon, 'continental'));
    const a = crustMap(withCrustChoice(carbon, 'continental'), carbon.demoSeed);
    const b = crustMap(withCrustChoice(carbon, 'continental'), carbon.demoSeed);
    expect(Array.from(a.mineral)).toEqual(Array.from(b.mineral));
  });
  for (const w of [carbon, silicon]) {
    for (const c of CRUST_PICKS) {
      const m = w.terrain.crust.minerals.find((x) => x.pick?.id === c.id)!;
      it(`${w.id}/${c.id} (${m.id}) takes about favour of the patch`, () => {
        const map = crustMap(withCrustChoice(w, c.id), w.demoSeed);
        const i = w.terrain.crust.minerals.indexOf(m);
        expect(Math.abs(map.shares[i] - w.terrain.crust.favour)).toBeLessThan(0.03);
      });
    }
  }
  it('leaves the natural map unchanged', () => {
    const before = crustMap(carbon, carbon.demoSeed);
    withCrustChoice(carbon, 'volcanic');
    expect(Array.from(crustMap(carbon, carbon.demoSeed).mineral)).toEqual(Array.from(before.mineral));
  });
});

describe('withCrustChoice ground fact', () => {
  it('names the pick in the Ground row', () => {
    const f = withCrustChoice(carbon, 'continental').facts.find((x) => x.id === 'rock')!;
    expect(f.value).toBe('Mostly granite (Continental)');
    expect(carbon.facts.find((x) => x.id === 'rock')!.value).not.toContain('Mostly');
  });
});
