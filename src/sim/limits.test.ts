import { describe, expect, it } from 'vitest';
import { carbonFixture as carbon, siliconFixture as silicon } from './__fixtures__/worlds';
import { applyControl, canLive, clampToBand, insideBand, livingBands, startingConditions, CONTROL_ORDER } from './limits';
import { vapourPressure } from './models';
import { makeRng } from './rng';
import type { Conditions, WorldConfig } from '../worlds/types';

const cold1x: Conditions = { temperature: -183, nitrogen: 1, oxygen: 21 };
const siliconLive: Conditions = { temperature: -183, nitrogen: 30, oxygen: 0 };

describe('canLive', () => {
  it('passes Earth on carbon, and names the failing limit', () => {
    expect(canLive(carbon, { temperature: 15, nitrogen: 1, oxygen: 21 }).ok).toBe(true);
    const r = canLive(carbon, { temperature: 130, nitrogen: 1, oxygen: 21 });
    expect(r.ok === false && r.limit.id).toBe('tooHot');
  });
  it('at −183 °C and 1 × nitrogen both worlds fail; silicon passes once nitrogen is high and oxygen is a trace', () => {
    expect(canLive(carbon, cold1x).ok).toBe(false);
    expect(canLive(silicon, cold1x).ok).toBe(false);
    expect(canLive(silicon, { ...cold1x, nitrogen: 30 })).toMatchObject({ ok: false }); // oxygen still 21 %
    expect(canLive(silicon, siliconLive).ok).toBe(true);
    expect(canLive(silicon, { ...siliconLive, nitrogen: 3 })).toMatchObject({ ok: false, limit: { id: 'seasGone' } });
  });
});

describe('livingBands: carbon', () => {
  it('lower temperature edge is −50 and upper edge stays 122 whatever the nitrogen', () => {
    for (const nitrogen of [0.1, 1, 30, 1000]) {
      const b = livingBands(carbon, { temperature: 15, nitrogen, oxygen: 21 }).temperature;
      expect(b.low).toBeCloseTo(-50, 6);
      expect(b.high).toBeCloseTo(122, 6);
      expect(b.highLimitId).toBe('tooHot');
      expect(b.lowLimitId).toBe('tooCold');
    }
  });
  it('nitrogen has a lower edge of 0.05 and no upper edge at 15 °C', () => {
    const b = livingBands(carbon, { temperature: 15, nitrogen: 1, oxygen: 21 }).nitrogen;
    expect(b.low).toBeCloseTo(0.05, 6);
    expect(b.high).toBe(1000);
    expect(b.highLimitId).toBeUndefined();
  });
  it('near the hot edge, raising nitrogen stops at "too hot" (greenhouse)', () => {
    const b = livingBands(carbon, { temperature: 120, nitrogen: 1, oxygen: 21 }).nitrogen;
    expect(b.high).toBeLessThan(1000);
    expect(b.highLimitId).toBe('tooHot');
  });
  it('oxygen has no red zone', () => {
    const b = livingBands(carbon, { temperature: 15, nitrogen: 1, oxygen: 21 }).oxygen;
    expect([b.low, b.high]).toEqual([0, 40]);
  });
});

describe('livingBands: silicon', () => {
  const upper = (nitrogen: number) => livingBands(silicon, { temperature: -183, nitrogen, oxygen: 0 }).temperature.high;
  it('lowering nitrogen lowers the upper temperature edge, which never passes −147 °C', () => {
    const edges = [1000, 100, 30, 10, 3].map(upper);
    expect(edges[1]).toBeCloseTo(edges[0], 6); // both capped by the critical point
    for (let i = 2; i < edges.length; i++) expect(edges[i]).toBeLessThan(edges[i - 1]);
    for (const e of edges) expect(e).toBeLessThanOrEqual(-147);
    expect(upper(1000)).toBeCloseTo(-147, 3);
  });
  it('lower temperature edge is where the solvent freezes', () => {
    const b = livingBands(silicon, siliconLive).temperature;
    expect(b.low).toBeCloseTo(-210, 6);
    expect(b.lowLimitId).toBe('seasFrozen');
  });
  it('the nitrogen band starts at what the air holds', () => {
    const b = livingBands(silicon, siliconLive).nitrogen;
    expect(b.low).toBeCloseTo(vapourPressure(silicon.solvent, -183) / (0.75 * 0.78), 6);
    expect(b.lowLimitId).toBe('seasGone');
    expect(b.high).toBe(1000);
  });
  it('oxygen is pinned to a trace', () => {
    const b = livingBands(silicon, siliconLive).oxygen;
    expect(b.low).toBe(0);
    expect(b.high).toBeCloseTo(0.1, 6);
    expect(b.highLimitId).toBe('oxygenRusts');
  });
  it('nitrogen band is empty at 15 °C and names the blocking limit', () => {
    const b = livingBands(silicon, { temperature: 15, nitrogen: 1, oxygen: 0 }).nitrogen;
    expect(b.empty).toBe(true);
    expect(b.blockingLimitId).toBeDefined();
  });
});

describe('canLive agrees with livingBands', () => {
  const worlds: [WorldConfig, Conditions][] = [
    [carbon, { temperature: 15, nitrogen: 1, oxygen: 21 }],
    [carbon, { temperature: 100, nitrogen: 2, oxygen: 10 }],
    [silicon, siliconLive],
    [silicon, { temperature: -170, nitrogen: 100, oxygen: 0 }],
  ];
  it('values just inside every edge live; just outside die', () => {
    for (const [w, c] of worlds) {
      const bands = livingBands(w, c);
      for (const id of CONTROL_ORDER) {
        const b = bands[id];
        if (b.empty) continue;
        const span = id === 'nitrogen' ? 1e-6 : 1e-4;
        const rel = (v: number, d: number) => (id === 'nitrogen' ? v * (1 + d) : v + d);
        if (b.low > 0 && b.lowLimitId) {
          expect(canLive(w, { ...c, [id]: b.low }).ok).toBe(true);
          expect(canLive(w, { ...c, [id]: rel(b.low, -span) }).ok).toBe(false);
        }
        if (b.highLimitId) {
          expect(canLive(w, { ...c, [id]: b.high }).ok).toBe(true);
          if (id !== 'nitrogen') expect(canLive(w, { ...c, [id]: rel(b.high, span) }).ok).toBe(false);
        }
      }
    }
  });
});

describe('startingConditions', () => {
  it('keeps in-band values untouched', () => {
    const r = startingConditions(carbon, { temperature: 15, nitrogen: 1, oxygen: 21 });
    expect(r.moved).toEqual([]);
    expect(r.start).toEqual({ temperature: 15, nitrogen: 1, oxygen: 21 });
  });
  it('keeps the player\'s in-band choice while fixing the rest (silicon, nitrogen already high)', () => {
    const r = startingConditions(silicon, { temperature: -190, nitrogen: 200, oxygen: 21 });
    expect(r.start).toEqual({ temperature: -190, nitrogen: 200, oxygen: 0 });
    expect(r.moved.map((m) => m.controlId)).toEqual(['oxygen']);
  });
  it('untouched sliders on silicon move temperature, then nitrogen, then oxygen, each with its limit', () => {
    const r = startingConditions(silicon, { temperature: 15, nitrogen: 1, oxygen: 21 });
    expect(r.start).toEqual(silicon.startDefaults);
    expect(r.moved).toEqual([
      { controlId: 'temperature', limitId: 'seasGone' },
      { controlId: 'nitrogen', limitId: 'seasGone' },
      { controlId: 'oxygen', limitId: 'oxygenRusts' },
    ]);
    expect(canLive(silicon, r.start).ok).toBe(true);
  });
  it('always returns living conditions for random requests', () => {
    const rnd = makeRng(7)('start');
    for (const world of [carbon, silicon]) {
      for (let i = 0; i < 200; i++) {
        const req = { temperature: -250 + rnd() * 400, nitrogen: Math.exp(Math.log(0.01) + rnd() * Math.log(1e5)), oxygen: rnd() * 40 };
        expect(canLive(world, startingConditions(world, req).start), JSON.stringify(req)).toEqual({ ok: true });
      }
    }
  });
  it('carbon at −183 °C moves temperature only', () => {
    const r = startingConditions(carbon, cold1x);
    expect(r.moved).toEqual([{ controlId: 'temperature', limitId: 'tooCold' }]);
    expect(canLive(carbon, r.start).ok).toBe(true);
  });
});

describe('no sequence of clamped control values lands in a red zone', () => {
  for (const [name, world] of [['carbon', carbon], ['silicon', silicon]] as const) {
    it(name, () => {
      const rnd = makeRng(12345)('props');
      let c = startingConditions(world, { temperature: 15, nitrogen: 1, oxygen: 21 }).start;
      expect(canLive(world, c).ok).toBe(true);
      const defs = { temperature: [-250, 150], nitrogen: [0.01, 1000], oxygen: [0, 40] } as const;
      for (let i = 0; i < 400; i++) {
        const id = CONTROL_ORDER[Math.floor(rnd() * 3)];
        const [lo, hi] = defs[id];
        const value = id === 'nitrogen' ? Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo))) : lo + rnd() * (hi - lo);
        const r = applyControl(world, c, id, value);
        c = r.conditions;
        expect(canLive(world, c), `step ${i} ${id}=${value}`).toEqual({ ok: true });
        if (r.blockedBy !== undefined) expect(typeof r.blockedBy).toBe('string');
      }
    });
  }
  it('clampToBand stops at the edge', () => {
    expect(clampToBand({ low: -50, high: 122 }, 500)).toBe(122);
    expect(clampToBand({ low: -50, high: 122 }, -500)).toBe(-50);
  });
});

describe('startingConditions: perf rewrite', () => {
  // Oracle: the original implementation, built on full livingBands calls.
  function oracle(world: WorldConfig, requested: Conditions) {
    let start = { ...requested };
    const moved: { controlId: string; limitId: string }[] = [];
    CONTROL_ORDER.forEach((id, i) => {
      const strict = livingBands(world, start)[id];
      if (insideBand(strict, start[id])) return;
      const later = { ...start };
      for (const l of CONTROL_ORDER.slice(i + 1)) later[l] = world.startDefaults[l];
      const lenient = livingBands(world, later)[id];
      if (insideBand(lenient, start[id])) return;
      const band = strict.empty ? lenient : strict;
      const limitId = band.empty ? band.blockingLimitId : start[id] < band.low ? band.lowLimitId : band.highLimitId;
      start = { ...start, [id]: world.startDefaults[id] };
      moved.push({ controlId: id, limitId: limitId ?? 'unknown' });
    });
    return { start, moved };
  }

  it('matches the old implementation across a sweep on both worlds', () => {
    for (const w of [carbon, silicon])
      for (const temperature of [-250, -183, -150, 15, 130])
        for (const nitrogen of [0.01, 1, 30])
          for (const oxygen of [0, 21]) {
            const c = { temperature, nitrogen, oxygen };
            expect(startingConditions(w, c)).toEqual(oracle(w, c));
          }
  });

  it('returns fresh copies, so mutating a result cannot corrupt the next call', () => {
    const c = { temperature: 15, nitrogen: 1, oxygen: 21 };
    const a = startingConditions(silicon, c);
    const snapshot = JSON.parse(JSON.stringify(a));
    a.start.temperature = 999;
    a.moved.push({ controlId: 'oxygen', limitId: 'x' });
    a.moved[0].limitId = 'corrupt';
    expect(startingConditions(silicon, c)).toEqual(snapshot);
  });
});
