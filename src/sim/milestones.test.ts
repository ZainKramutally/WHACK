import { describe, expect, it } from 'vitest';
import { MilestoneTracker, type MilestoneAnimal, type MilestoneInput } from './milestones';

const an = (id: number, o: Partial<MilestoneAnimal> = {}): MilestoneAnimal => ({ id, mode: 1, diet: 0.1, scale: 0.3, ageSec: 10, onLand: false, armoured: false, ...o });
const crowd = (n: number, o: Partial<MilestoneAnimal> = {}) => Array.from({ length: n }, (_, i) => an(i + 1, o));
const inp = (o: Partial<MilestoneInput> = {}): MilestoneInput => ({ sec: 100, animals: crowd(50), speciesLive: [], seaCover: 60, buildComplete: true, ...o });
const ids = (t: MilestoneTracker, i: MilestoneInput) => t.update(i).map((f) => f.id);

describe('milestones', () => {
  it('fires nothing in a plain swimming crowd', () => {
    expect(ids(new MilestoneTracker(), inp())).toEqual([]);
  });

  it('first walker on land, first flier, first hunter and a giant each fire once, then never again', () => {
    const t = new MilestoneTracker();
    const world = [...crowd(30), an(101, { mode: 0, onLand: true }), an(102, { mode: 2 }), an(103, { diet: 0.9 }), an(104, { scale: 2.5 })];
    const first = ids(t, inp({ animals: world }));
    expect(first).toEqual(expect.arrayContaining(['walker', 'flier', 'hunter', 'giant']));
    expect(ids(t, inp({ animals: world, sec: 101 }))).toEqual([]);
    expect(ids(t, inp({ animals: world, sec: 200 }))).toEqual([]);
  });

  it('a walker in the water, or a newborn hunter, does not count', () => {
    const t = new MilestoneTracker();
    expect(ids(t, inp({ animals: [...crowd(30), an(101, { mode: 0, onLand: false }), an(102, { diet: 0.9, ageSec: 1 })] }))).toEqual([]);
    expect(ids(t, inp({ animals: [...crowd(30), an(102, { diet: 0.9, ageSec: 5 })], sec: 105 }))).toContain('hunter');
  });

  it('an apex predator is a hunter in the top size decile', () => {
    const small = new MilestoneTracker();
    expect(ids(small, inp({ animals: [...crowd(40, { scale: 1 }), an(101, { diet: 0.9, scale: 0.2 })] }))).not.toContain('apex');
    const big = new MilestoneTracker();
    const f = big.update(inp({ animals: [...crowd(40, { scale: 0.3 }), an(101, { diet: 0.9, scale: 1.4 })] }));
    expect(f.map((x) => x.id)).toEqual(expect.arrayContaining(['hunter', 'apex']));
    expect(f.find((x) => x.id === 'apex')!.organismId).toBe(101);
  });

  it('five species then eight, an armoured walker, and the first extinction', () => {
    const t = new MilestoneTracker();
    const sp = (n: number, live = 5) => Array.from({ length: n }, (_, i) => ({ id: i + 1, live }));
    expect(ids(t, inp({ speciesLive: sp(4) }))).toEqual([]);
    expect(ids(t, inp({ speciesLive: sp(5) }))).toEqual(['species5']);
    expect(ids(t, inp({ speciesLive: sp(8) }))).toEqual(['species8']);
    expect(ids(t, inp({ animals: [...crowd(30), an(101, { mode: 0, armoured: true })] }))).toContain('armoured');
    // species 3 empties and stays empty for 20 s
    const gone = [...sp(8)].map((s) => (s.id === 3 ? { ...s, live: 0 } : s));
    expect(ids(t, inp({ speciesLive: gone, sec: 110 }))).toEqual([]);
    expect(ids(t, inp({ speciesLive: gone, sec: 131 }))).toEqual(['extinct']);
    expect(ids(t, inp({ speciesLive: gone, sec: 200 }))).toEqual([]);
  });

  it('a species that dips and returns is not extinct', () => {
    const t = new MilestoneTracker();
    t.update(inp({ speciesLive: [{ id: 1, live: 5 }], sec: 100 }));
    t.update(inp({ speciesLive: [{ id: 1, live: 0 }], sec: 105 }));
    expect(ids(t, inp({ speciesLive: [{ id: 1, live: 3 }], sec: 115 }))).toEqual([]);
    expect(ids(t, inp({ speciesLive: [{ id: 1, live: 0 }], sec: 130 }))).toEqual([]);
  });

  it('a crash below 40% of the recent peak fires once, and recovery above 80% of that peak fires once', () => {
    const t = new MilestoneTracker();
    for (let s = 0; s < 30; s += 5) t.update(inp({ animals: crowd(500), sec: s }));
    expect(ids(t, inp({ animals: crowd(150), sec: 30 }))).toEqual(['crash']);
    expect(ids(t, inp({ animals: crowd(100), sec: 31 }))).toEqual([]);
    expect(ids(t, inp({ animals: crowd(300), sec: 60 }))).toEqual([]);
    expect(ids(t, inp({ animals: crowd(450), sec: 90 }))).toEqual(['recover']);
    expect(ids(t, inp({ animals: crowd(500), sec: 120 }))).toEqual([]);
  });

  it('a small world never "crashes"', () => {
    const t = new MilestoneTracker();
    t.update(inp({ animals: crowd(40), sec: 0 }));
    expect(ids(t, inp({ animals: crowd(5), sec: 10 }))).toEqual([]);
  });

  it('the seas shrinking: 10 points down from their value when the build ends', () => {
    const t = new MilestoneTracker();
    expect(ids(t, inp({ seaCover: 60, buildComplete: false }))).toEqual([]);
    expect(ids(t, inp({ seaCover: 60 }))).toEqual([]);
    expect(ids(t, inp({ seaCover: 52 }))).toEqual([]);
    expect(ids(t, inp({ seaCover: 49 }))).toEqual(['seasShrink']);
    expect(ids(t, inp({ seaCover: 40 }))).toEqual([]);
  });

  it('is deterministic: the same inputs give the same output', () => {
    const run = () => {
      const t = new MilestoneTracker();
      const out: string[] = [];
      for (let s = 0; s < 120; s += 5) out.push(...t.update(inp({ sec: s, animals: [...crowd(30), an(101, { mode: 0, onLand: true, ageSec: s }), an(102, { diet: 0.9, ageSec: s })] })).map((f) => `${s}:${f.id}`));
      return out;
    };
    expect(run()).toEqual(run());
  });
});
