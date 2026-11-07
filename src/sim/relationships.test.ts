import { describe, expect, it } from 'vitest';
import { relationship, type RelBody } from './relationships';

const body = (o: Partial<RelBody['plan']> = {}, lineage = 0, sociality = 0.5): RelBody => ({
  plan: { scale: 1, gapeSize: 0.2, defence: 0, diet: 0.1, ...o },
  lineage,
  sociality,
});
const ctx = { hunger: 0.5 };

describe('relationship (derived from bodies only)', () => {
  const hunter = body({ gapeSize: 2, diet: 0.9 });
  const prey = body({ scale: 1, defence: 0.5, diet: 0.1 });
  it('Eats iff the gape beats the prey size × (1 + defence); Afraid is the reverse', () => {
    expect(relationship(hunter, prey, ctx).eats).toBeCloseTo(0.81);
    expect(relationship(prey, hunter, ctx).afraid).toBeCloseTo(0.81);
    expect(relationship(hunter, prey, ctx).afraid).toBe(0);
  });
  it('armour or size can put a prey out of reach', () => {
    expect(relationship(hunter, body({ scale: 1, defence: 1.5 }), ctx).eats).toBe(0);
    expect(relationship(hunter, body({ scale: 3 }), ctx).eats).toBe(0);
  });
  it('a pure grazer eats nothing even with a big mouth', () => {
    expect(relationship(body({ gapeSize: 5, diet: 0 }), prey, ctx).eats).toBe(0);
  });
  it('Kin needs the same lineage and scales with sociality', () => {
    expect(relationship(body({}, 3, 0.8), body({}, 3, 0.4), ctx).kin).toBeCloseTo(0.4);
    expect(relationship(body({}, 3, 0.8), body({}, 4, 0.8), ctx).kin).toBe(0);
  });
  it('Rival is shared plant pools, and grows with plant scarcity', () => {
    const g = body({ diet: 0 });
    expect(relationship(g, g, { hunger: 0 }).rival).toBe(0);
    expect(relationship(g, g, { hunger: 1 }).rival).toBe(1);
    expect(relationship(g, hunter, { hunger: 1 }).rival).toBeLessThan(0.1);
  });
  it('is a function of the inputs alone: lineage names and ids never change Eats or Afraid', () => {
    const a = relationship(hunter, prey, ctx);
    const b = relationship({ ...hunter, lineage: 99 }, { ...prey, lineage: 7 }, ctx);
    expect({ eats: b.eats, afraid: b.afraid }).toEqual({ eats: a.eats, afraid: a.afraid });
  });
});
