// Pure selection-screen logic: what is selected, what the sliders say, what Generate sends. No DOM.
import { canLive, livingBands, startingConditions } from '../../sim/limits';
import { controlIds, controlList, worldFor } from '../../worlds';
import { CRUST_PICKS } from '../../worlds/controls';
import type { Conditions, ControlId, CrustPickId, LivingBand, WorldConfig, WorldId } from '../../worlds/types';
import { group14 } from './elements';

export interface SelectionState {
  worldId: WorldId;
  conditions: Conditions;
  /** Picked rock chip (chip id); absent = the natural seeded mix. Kept across element switches: every world has the same chips. */
  crust?: CrustPickId;
  /** True once the player has clicked a chip: then `crust` (even undefined = natural mix) rules; until then the world's `defaultPick` does. */
  touched?: boolean;
}

/** The rock pick in effect: the player's choice once they have touched a chip, else the selected world's default. */
export function effectiveCrust(s: SelectionState): CrustPickId | undefined {
  return s.touched ? s.crust : worldFor(s.worldId).terrain.crust.defaultPick;
}

/** Carbon selected, sliders at the control defaults (15 °C, 1 × Earth, 21 % oxygen). */
export function initialSelection(): SelectionState {
  return {
    worldId: 'carbon',
    conditions: Object.fromEntries(controlList.map((c) => [c.id, c.default])) as Conditions,
  };
}

/** Select the row with atomic number `z`. Greyed rows (and unknown numbers) leave the state untouched. */
export function selectElement(s: SelectionState, z: number): SelectionState {
  const row = group14.find((r) => r.z === z);
  if (!row?.worldId || row.worldId === s.worldId) return s;
  return { worldId: row.worldId, conditions: s.conditions, ...(s.crust ? { crust: s.crust } : {}), ...(s.touched ? { touched: true } : {}) };
}

/** Pick a rock chip; picking the picked one again, or an id the world cannot pick, clears it. */
export function toggleCrust(s: SelectionState, id: CrustPickId): SelectionState {
  const ok = CRUST_PICKS.some((c) => c.id === id);
  const crust = ok && effectiveCrust(s) !== id ? id : undefined;
  return { worldId: s.worldId, conditions: s.conditions, touched: true, ...(crust ? { crust } : {}) };
}

/** Move one slider anywhere in its full range: on this screen there is no world yet, so nothing is protected. */
export function setCondition(s: SelectionState, id: ControlId, value: number): SelectionState {
  const def = controlList.find((c) => c.id === id)!;
  const v = Math.min(def.max, Math.max(def.min, value));
  return { ...s, conditions: { ...s.conditions, [id]: id === 'temperature' ? Math.round(v) : v } };
}

/** The `world:selected` payload for Generate. */
export function generatePayload(s: SelectionState): { worldId: WorldId; requested: Conditions; crust?: CrustPickId } {
  const crust = effectiveCrust(s);
  return { worldId: s.worldId, requested: { ...s.conditions }, ...(crust ? { crust } : {}) };
}

export type Viability = { ok: true } | { ok: false; reason: string; limitId: string };

/** Live survivability of one world at the current settings (the element cells). */
export function viability(world: WorldConfig, c: Conditions): Viability {
  const r = canLive(world, c);
  return r.ok ? { ok: true } : { ok: false, reason: r.limit.reason, limitId: r.limit.id };
}

export interface Move { controlId: ControlId; limitId: string; reason: string; from: number; to: number }

/** What Generate will change: the sliders sitting in a red zone, in the fixed order, and where they go. */
export function plannedMoves(s: SelectionState): { start: Conditions; moves: Move[] } {
  const world = worldFor(s.worldId);
  const { start, moved } = startingConditions(world, s.conditions);
  return {
    start,
    moves: moved.map((m) => ({
      controlId: m.controlId,
      limitId: m.limitId,
      reason: world.limits.find((l) => l.id === m.limitId)?.reason ?? '',
      from: s.conditions[m.controlId],
      to: start[m.controlId],
    })),
  };
}

export function bandsFor(s: SelectionState): Record<ControlId, LivingBand> {
  return livingBands(worldFor(s.worldId), s.conditions);
}

/** Red-zone reason under a slider, or null when its thumb sits inside the living band. */
export function redReason(world: WorldConfig, band: LivingBand, value: number): string | null {
  const id = band.empty ? band.blockingLimitId : value < band.low ? band.lowLimitId : value > band.high ? band.highLimitId : undefined;
  if (!band.empty && value >= band.low && value <= band.high) return null;
  return world.limits.find((l) => l.id === id)?.reason ?? null;
}

export { controlIds };
