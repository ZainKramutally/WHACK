import { describe, expect, it } from 'vitest';
import { worldFor } from '../../worlds';
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
    expect(generatePayload(s)).toEqual({ worldId: 'silicon', requested: { temperature: -183, nitrogen: 1000, oxygen: 21 } });
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
