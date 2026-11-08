import { describe, expect, it } from 'vitest';
import { crustMap, withCrustChoice } from './crust';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';

describe('withCrustChoice', () => {
  it('returns the world itself for no, unknown or unpickable ids', () => {
    expect(withCrustChoice(carbon)).toBe(carbon);
    expect(withCrustChoice(carbon, 'nope')).toBe(carbon);
    expect(withCrustChoice(silicon, 'waterIce')).toBe(silicon);
  });
  it('is memoised and deterministic', () => {
    expect(withCrustChoice(carbon, 'granite')).toBe(withCrustChoice(carbon, 'granite'));
    const a = crustMap(withCrustChoice(carbon, 'granite'), carbon.demoSeed);
    const b = crustMap(withCrustChoice(carbon, 'granite'), carbon.demoSeed);
    expect(Array.from(a.mineral)).toEqual(Array.from(b.mineral));
  });
  for (const w of [carbon, silicon]) {
    for (const m of w.terrain.crust.minerals.filter((x) => x.pick)) {
      it(`${w.id}/${m.id} takes about favour of the patch`, () => {
        const map = crustMap(withCrustChoice(w, m.id), w.demoSeed);
        const i = w.terrain.crust.minerals.indexOf(m);
        expect(Math.abs(map.shares[i] - w.terrain.crust.favour)).toBeLessThan(0.03);
      });
    }
  }
  it('leaves the natural map unchanged', () => {
    const before = crustMap(carbon, carbon.demoSeed);
    withCrustChoice(carbon, 'basalt');
    expect(Array.from(crustMap(carbon, carbon.demoSeed).mineral)).toEqual(Array.from(before.mineral));
  });
});

describe('withCrustChoice ground fact', () => {
  it('names the pick in the Ground row', () => {
    const f = withCrustChoice(carbon, 'granite').facts.find((x) => x.id === 'rock')!;
    expect(f.value).toBe('Mostly granite (Continental)');
    expect(carbon.facts.find((x) => x.id === 'rock')!.value).not.toContain('Mostly');
  });
});
