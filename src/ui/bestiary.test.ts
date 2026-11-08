import { describe, expect, it } from 'vitest';
import { Bestiary, EXTINCT_AFTER_SEC, type KindSighting } from './bestiary';
import type { BodyPlan } from '../sim/develop';

const seen = (entries: [string, Partial<KindSighting>][]) =>
  new Map(entries.map(([name, s]) => [name, { alive: 0, type: 'grazer · walker', ...s } as KindSighting]));
const plan = (scale: number) => ({ scale } as BodyPlan);

describe('Bestiary', () => {
  it('only files announced species: sightings of unannounced names add nothing', () => {
    const b = new Bestiary();
    b.update(seen([['Soft Walker', { alive: 9 }]]), 1);
    expect(b.has('Soft Walker')).toBe(false);
    expect(b.announce('Soft Walker', 'grazer · walker', 2)).toBe(true);
    expect(b.announce('Soft Walker', 'grazer · walker', 3)).toBe(false);
    b.update(seen([['Soft Walker', { alive: 9 }]]), 4);
    const e = b.get('Soft Walker')!;
    expect(e.found).toBe(false);
    expect(e.alive).toBe(9);
    expect(e.firstSeenSec).toBe(2);
    expect(b.counts()).toEqual({ found: 0, total: 1 });
  });

  it('finds a kind on the first click only, keeping the clicked specimen', () => {
    const b = new Bestiary();
    b.announce('Shell Strider', 'grazer · strider', 2, plan(1));
    b.update(seen([['Shell Strider', { alive: 12 }]]), 3);
    expect(b.discover('Shell Strider', 4, { generation: 7 })).toBe(true);
    expect(b.discover('Shell Strider', 5)).toBe(false);
    const e = b.get('Shell Strider')!;
    expect(e).toMatchObject({ found: true, foundAtSec: 4, generation: 7 });
    expect(e.plan!.scale).toBe(1); // the announced organism's plan, not the clicked one
    b.update(seen([['Shell Strider', { alive: 10 }]]), 6);
    expect(b.get('Shell Strider')!.plan!.scale).toBe(1); // never replaced
    expect(b.setPlan('Shell Strider', plan(5))).toBe(false);
    expect(b.counts()).toEqual({ found: 1, total: 1 });
  });

  it('takes a late plan once, for a species announced before its plan arrived', () => {
    const b = new Bestiary();
    b.announce('Late', 'grazer · walker', 1);
    expect(b.get('Late')!.plan).toBeUndefined();
    expect(b.setPlan('Late', plan(4))).toBe(true);
    expect(b.setPlan('Late', plan(5))).toBe(false);
    expect(b.get('Late')!.plan!.scale).toBe(4);
  });

  it('cannot find a kind the sim never announced', () => {
    const b = new Bestiary();
    expect(b.discover('Prism Lattice', 1, { type: 'grazer · crawler' })).toBe(false);
    expect(b.living()).toEqual([]);
  });

  it('files a kind as extinct only after EXTINCT_AFTER_SEC with none alive, found or not, and revives it', () => {
    const b = new Bestiary();
    b.announce('Mote Crawler', 'grazer · crawler', 10);
    b.update(seen([['Mote Crawler', { alive: 6}]]), 10);
    b.update(seen([]), 11);
    expect(b.get('Mote Crawler')!).toMatchObject({ alive: 0, extinct: false });
    b.update(seen([]), 10 + EXTINCT_AFTER_SEC - 0.5);
    expect(b.get('Mote Crawler')!.extinct).toBe(false);
    b.update(seen([]), 10 + EXTINCT_AFTER_SEC);
    expect(b.get('Mote Crawler')!.extinct).toBe(true);
    expect(b.get('Mote Crawler')!.found).toBe(false); // never found alive, still filed
    expect(b.extinct().map((e) => e.name)).toEqual(['Mote Crawler']);
    expect(b.living()).toEqual([]);
    b.update(seen([['Mote Crawler', { alive: 2}]]), 30);
    expect(b.get('Mote Crawler')!.extinct).toBe(false);
  });

  it('orders living kinds found-first then by numbers, and extinct kinds most recent first', () => {
    const b = new Bestiary();
    for (const n of 'ABCDE') b.announce(n, 'grazer · walker', 0);
    b.update(seen([['A', { alive: 5}], ['B', { alive: 50}], ['C', { alive: 9}], ['D', { alive: 4}], ['E', { alive: 4}]]), 0);
    b.discover('C', 1);
    b.discover('A', 2);
    expect(b.living().map((e) => e.name)).toEqual(['C', 'A', 'B', 'D', 'E']);
    b.update(seen([['A', { alive: 5 }], ['B', { alive: 50 }], ['C', { alive: 9 }], ['E', { alive: 4 }]]), 3); // D gone at 3
    b.update(seen([['A', { alive: 5 }], ['B', { alive: 50 }], ['C', { alive: 9 }]]), 4);                     // E gone at 4
    b.update(seen([['A', { alive: 5 }], ['B', { alive: 50 }], ['C', { alive: 9 }]]), 20);
    expect(b.extinct().map((e) => e.name)).toEqual(['E', 'D']);
  });
});
