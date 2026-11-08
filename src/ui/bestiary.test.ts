import { describe, expect, it } from 'vitest';
import { Bestiary, EXTINCT_AFTER_SEC, type KindSighting } from './bestiary';
import { MIN_MEMBERS } from '../sim/guide';
import type { BodyPlan } from '../sim/develop';

const seen = (entries: [string, Partial<KindSighting>][]) =>
  new Map(entries.map(([name, s]) => [name, { alive: 0, largest: 0, type: 'grazer · walker', ...s } as KindSighting]));
const plan = (scale: number) => ({ scale } as BodyPlan);

describe('Bestiary', () => {
  it('adds a kind locked once a cluster reaches MIN_MEMBERS, not before', () => {
    const b = new Bestiary();
    b.update(seen([['Soft Walker', { alive: MIN_MEMBERS, largest: MIN_MEMBERS - 1 }]]), 1);
    expect(b.has('Soft Walker')).toBe(false);
    b.update(seen([['Soft Walker', { alive: 9, largest: MIN_MEMBERS }]]), 2);
    const e = b.get('Soft Walker')!;
    expect(e.found).toBe(false);
    expect(e.alive).toBe(9);
    expect(e.firstSeenSec).toBe(2);
    expect(b.counts()).toEqual({ found: 0, total: 1 });
  });

  it('finds a kind on the first click only, keeping the clicked specimen', () => {
    const b = new Bestiary();
    b.update(seen([['Shell Strider', { alive: 12, largest: 12, plan: plan(1) }]]), 3);
    expect(b.discover('Shell Strider', 4, { plan: plan(2), generation: 7 })).toBe(true);
    expect(b.discover('Shell Strider', 5, { plan: plan(3) })).toBe(false);
    const e = b.get('Shell Strider')!;
    expect(e).toMatchObject({ found: true, foundAtSec: 4, generation: 7 });
    expect(e.plan!.scale).toBe(2);
    b.update(seen([['Shell Strider', { alive: 10, largest: 10, plan: plan(9) }]]), 6);
    expect(b.get('Shell Strider')!.plan!.scale).toBe(2); // a found kind keeps its specimen's picture
    expect(b.counts()).toEqual({ found: 1, total: 1 });
  });

  it('adds a rare kind the player clicks, even below MIN_MEMBERS', () => {
    const b = new Bestiary();
    expect(b.discover('Prism Lattice', 1, { type: 'grazer · crawler' })).toBe(true);
    expect(b.living().map((e) => e.name)).toEqual(['Prism Lattice']);
  });

  it('files a kind as extinct only after EXTINCT_AFTER_SEC with none alive, found or not, and revives it', () => {
    const b = new Bestiary();
    b.update(seen([['Mote Crawler', { alive: 6, largest: 6 }]]), 10);
    b.update(seen([]), 11);
    expect(b.get('Mote Crawler')!).toMatchObject({ alive: 0, extinct: false });
    b.update(seen([]), 10 + EXTINCT_AFTER_SEC - 0.5);
    expect(b.get('Mote Crawler')!.extinct).toBe(false);
    b.update(seen([]), 10 + EXTINCT_AFTER_SEC);
    expect(b.get('Mote Crawler')!.extinct).toBe(true);
    expect(b.get('Mote Crawler')!.found).toBe(false); // never found alive, still filed
    expect(b.extinct().map((e) => e.name)).toEqual(['Mote Crawler']);
    expect(b.living()).toEqual([]);
    b.update(seen([['Mote Crawler', { alive: 2, largest: 2 }]]), 30);
    expect(b.get('Mote Crawler')!.extinct).toBe(false);
  });

  it('orders living kinds found-first then by numbers, and extinct kinds most recent first', () => {
    const b = new Bestiary();
    b.update(seen([['A', { alive: 5, largest: 5 }], ['B', { alive: 50, largest: 50 }], ['C', { alive: 9, largest: 9 }], ['D', { alive: 4, largest: 4 }], ['E', { alive: 4, largest: 4 }]]), 0);
    b.discover('C', 1);
    b.discover('A', 2);
    expect(b.living().map((e) => e.name)).toEqual(['C', 'A', 'B', 'D', 'E']);
    b.update(seen([['A', { alive: 5 }], ['B', { alive: 50 }], ['C', { alive: 9 }], ['E', { alive: 4 }]]), 3); // D gone at 3
    b.update(seen([['A', { alive: 5 }], ['B', { alive: 50 }], ['C', { alive: 9 }]]), 4);                     // E gone at 4
    b.update(seen([['A', { alive: 5 }], ['B', { alive: 50 }], ['C', { alive: 9 }]]), 20);
    expect(b.extinct().map((e) => e.name)).toEqual(['E', 'D']);
  });
});
