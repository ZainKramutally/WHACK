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
    for (const w of [carbon, silicon]) for (const c of CRUST_PICKS) expect(w.terrain.crust.minerals.filter((m) => m.id === c.id && m.pick)).toHaveLength(1);
  });
  it('is memoised and deterministic', () => {
    expect(withCrustChoice(carbon, 'granite')).toBe(withCrustChoice(carbon, 'granite'));
    const a = crustMap(withCrustChoice(carbon, 'granite'), carbon.demoSeed);
    const b = crustMap(withCrustChoice(carbon, 'granite'), carbon.demoSeed);
    expect(Array.from(a.mineral)).toEqual(Array.from(b.mineral));
  });
  for (const w of [carbon, silicon]) {
    for (const c of CRUST_PICKS) {
      const m = w.terrain.crust.minerals.find((x) => x.id === c.id)!;
      it(`${w.id}/${c.id} (${m.id}) takes about its favour of the patch`, () => {
        const map = crustMap(withCrustChoice(w, c.id), w.demoSeed);
        const i = w.terrain.crust.minerals.indexOf(m);
        expect(Math.abs(map.shares[i] - (m.favour ?? w.terrain.crust.favour))).toBeLessThan(0.03);
      });
    }
  }
  it('absent minerals have no natural share, and stay absent when another is picked', () => {
    for (const w of [carbon, silicon]) {
      const nat = crustMap(w, w.demoSeed);
      const absent = w.terrain.crust.minerals.filter((m) => m.share[1] === 0);
      expect(absent.length).toBeGreaterThan(0);
      for (const m of absent) expect(nat.shares[w.terrain.crust.minerals.indexOf(m)]).toBe(0);
    }
  });
  it('leaves the natural map unchanged', () => {
    const before = crustMap(carbon, carbon.demoSeed);
    withCrustChoice(carbon, 'basalt');
    expect(Array.from(crustMap(carbon, carbon.demoSeed).mineral)).toEqual(Array.from(before.mineral));
  });
});

describe('withCrustChoice ground fact', () => {
  it('names the pick in the Ground row', () => {
    const f = withCrustChoice(carbon, 'granite').facts.find((x) => x.id === 'rock')!;
    expect(f.value).toBe('Mostly granite');
    expect(carbon.facts.find((x) => x.id === 'rock')!.value).not.toContain('Mostly');
  });
});
