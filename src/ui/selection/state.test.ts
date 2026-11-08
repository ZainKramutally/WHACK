import { describe, expect, it } from 'vitest';
import { worldFor } from '../../worlds';
import type { MineralDef, WorldConfig } from '../../worlds/types';
import { boxState } from './boxState';
import { group14 } from './elements';
import { generatePayload, initialSelection, plannedMoves, selectElement, setCondition, viability } from './state';

describe('selection state', () => {
  it('defaults to carbon with the control defaults', () => {
    const s = initialSelection();
    expect(s.worldId).toBe('carbon');
    expect(s.conditions).toEqual({ temperature: 15, nitrogen: 1, oxygen: 21 });
  });

  it('selects silicon and carbon but never a greyed element', () => {
    let s = initialSelection();
    s = selectElement(s, 14);
    expect(s.worldId).toBe('silicon');
    for (const z of [32, 50, 82, 114, 99]) expect(selectElement(s, z)).toBe(s);
    expect(selectElement(s, 6).worldId).toBe('carbon');
  });

  it('greys exactly germanium, tin, lead and flerovium, each with a reason', () => {
    const grey = group14.filter((r) => !r.worldId);
    expect(grey.map((r) => r.symbol)).toEqual(['Ge', 'Sn', 'Pb', 'Fl']);
    expect(grey.every((r) => r.reason)).toBe(true);
  });

  it('Generate sends the chosen world and the slider values as they are', () => {
    let s = selectElement(initialSelection(), 14);
    s = setCondition(s, 'temperature', -183.4);
    s = setCondition(s, 'nitrogen', 5000);
    expect(generatePayload(s)).toEqual({ worldId: 'silicon', requested: { temperature: -183, nitrogen: 1000, oxygen: 21 }, crust: 'silicide' });
  });

  it('carbon at defaults is viable and moves nothing; silicon at defaults moves its sliders to startDefaults', () => {
    const c = initialSelection();
    expect(viability(worldFor('carbon'), c.conditions).ok).toBe(true);
    expect(plannedMoves(c).moves).toEqual([]);
    const si = selectElement(c, 14);
    expect(viability(worldFor('silicon'), si.conditions).ok).toBe(false);
    const { start, moves } = plannedMoves(si);
    expect(moves.map((m) => m.controlId)).toEqual(['temperature', 'nitrogen', 'oxygen']);
    expect(start).toEqual(worldFor('silicon').startDefaults);
  });

  it('at -183 °C and 1 × nitrogen both cells are red; silicon turns green with enough nitrogen and no oxygen', () => {
    let s = setCondition(initialSelection(), 'temperature', -183);
    expect(viability(worldFor('carbon'), s.conditions).ok).toBe(false);
    expect(viability(worldFor('silicon'), s.conditions).ok).toBe(false);
    s = setCondition(setCondition(s, 'nitrogen', 40), 'oxygen', 0);
    expect(viability(worldFor('silicon'), s.conditions).ok).toBe(true);
  });
});

describe('boxState', () => {
  it('plays the failing limit effect and never lives when canLive fails', () => {
    const si = worldFor('silicon');
    const rust = boxState(si, { temperature: -183, nitrogen: 30, oxygen: 10 });
    expect(rust.ok).toBe(false);
    expect(rust.effect).toBe('rust');
    const warm = boxState(si, { temperature: 15, nitrogen: 30, oxygen: 0 });
    expect(warm.ok).toBe(false);
    expect(warm.phase).toBe('gas');
    const live = boxState(si, { temperature: -183, nitrogen: 30, oxygen: 0 });
    expect(live.ok).toBe(true);
    expect(live.effect).toBeNull();
    expect(live.pool).toBeGreaterThan(0.12);
  });

  it('ice floats on carbon and sinks on silicon (from solidSinks)', () => {
    expect(boxState(worldFor('carbon'), { temperature: -60, nitrogen: 1, oxygen: 21 }).iceFloats).toBe(true);
    expect(boxState(worldFor('silicon'), { temperature: -215, nitrogen: 30, oxygen: 0 }).iceFloats).toBe(false);
  });
});

describe('boxState bed', () => {
  const minerals = (o: Partial<MineralDef>[]) => o.map((m, i) => ({
    id: `m${i}`, label: `M${i}`, description: '', share: [0.2, 0.4], elevation: 0.5,
    supply: { c: 1, si: 1, o: 0 }, oxidises: false, why: '', sources: [], assumption: true, ...m,
  }) as MineralDef);
  const withCrust = (world: WorldConfig, ms: MineralDef[]): WorldConfig =>
    ({ ...world, terrain: { ...world.terrain, crust: { minerals: ms, patchCells: 8, rustOxygen: 20, favour: 0.65, why: '', sources: [], assumption: true } } });
  const ms = minerals([{ id: 'volcanic', oxidises: true }, { id: 'continental', share: [0.1, 0.3] }, { id: 'waterIce', supply: { c: 0, si: 0, o: 0 } }]);
  const carbon = withCrust(worldFor('carbon'), ms), silicon = withCrust(worldFor('silicon'), ms);
  const good = { temperature: 15, nitrogen: 1, oxygen: 0 };

  it('real worlds have a bed that rusts by their own rustOxygen', () => {
    for (const id of ['carbon', 'silicon'] as const) {
      const w = worldFor(id), ro = w.terrain.crust!.rustOxygen;
      const dry = boxState(w, { ...good, oxygen: 0 }).bed, wet = boxState(w, { ...good, oxygen: ro }).bed;
      expect(dry.length).toBeGreaterThan(0);
      expect(dry.reduce((x, y) => x + y.share, 0)).toBeCloseTo(1);
      expect(dry.every((g) => g.rust === 0)).toBe(true);
      expect(wet.some((g) => g.rust === 1)).toBe(true);
    }
  });
  it('shares sum to 1', () => {
    expect(boxState(carbon, good).bed.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1);
  });
  it('rusts only oxidising minerals, and only with oxygen', () => {
    expect(boxState(carbon, good).bed.every((b) => b.rust === 0)).toBe(true);
    const bed = boxState(carbon, { ...good, oxygen: 10 }).bed;
    expect(bed.find((b) => b.id === 'volcanic')!.rust).toBeCloseTo(0.5);
    expect(bed.filter((b) => b.id !== 'volcanic').every((b) => b.rust === 0)).toBe(true);
  });
  it('ice never feeds; rock feeds while life can live', () => {
    const st = boxState(carbon, { ...good, oxygen: 21 });
    expect(st.ok).toBe(true);
    expect(st.bed.find((b) => b.id === 'waterIce')!.feeds).toBe(0);
    expect(st.bed.find((b) => b.id === 'continental')!.feeds).toBe(1);
  });
  it('feeds nothing when canLive fails or the solvent is frozen', () => {
    for (const [w, c] of [[carbon, { temperature: -183, nitrogen: 1, oxygen: 21 }], [carbon, { temperature: -80, nitrogen: 1, oxygen: 21 }], [silicon, { temperature: 15, nitrogen: 1, oxygen: 21 }]] as const) {
      const st = boxState(w, c);
      expect(st.ok && st.phase === 'liquid' && st.frozen === 0).toBe(false);
      expect(st.bed.every((b) => b.feeds === 0)).toBe(true);
    }
  });
});

describe('rock chip', () => {
  it('defaults per world, persists once touched, un-picks to the natural mix', async () => {
    const { toggleCrust, selectElement, generatePayload, initialSelection, effectiveCrust } = await import('./state');
    const s0 = initialSelection();
    expect(generatePayload(s0).crust).toBe('ironstone');
    expect(generatePayload(selectElement(s0, 14)).crust).toBe('silicide');   // untouched: the new world's default
    let s = toggleCrust(s0, 'granite');
    expect(generatePayload(s).crust).toBe('granite');
    expect(toggleCrust(s, 'granite').crust).toBeUndefined();
    expect(toggleCrust(s, 'nitride').crust).toBe('nitride');
    expect(toggleCrust(s0, 'waterIce' as never).crust).toBeUndefined();
    s = selectElement(s, 14);
    expect(s.worldId).toBe('silicon');
    expect(effectiveCrust(s)).toBe('granite');
    const un = toggleCrust(s0, 'ironstone');   // clicking the lit default un-picks it
    expect(generatePayload(un)).not.toHaveProperty('crust');
    expect(generatePayload(selectElement(un, 14))).not.toHaveProperty('crust');   // and that persists
  });
  it('each world default is a pickable mineral in its crust', async () => {
    const { worldFor } = await import('../../worlds');
    const { CRUST_PICKS } = await import('../../worlds/controls');
    for (const id of ['carbon', 'silicon'] as const) {
      const c = worldFor(id).terrain.crust;
      expect(CRUST_PICKS.some((p) => p.id === c.defaultPick)).toBe(true);
      expect(c.minerals.some((m) => m.id === c.defaultPick && m.pick)).toBe(true);
    }
  });
});
