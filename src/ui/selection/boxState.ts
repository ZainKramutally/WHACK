// Pure state of the selection-screen particle box, built on canLive and the world's solvent data
// (CLAUDE.md "The particle box"). The box can never show living chains while canLive fails.
import { equilibriumSeaCover, canLive } from '../../sim/limits';
import { vapourPressure } from '../../sim/models';
import { controls } from '../../worlds/controls';
import type { Conditions, LethalLimit, WorldConfig } from '../../worlds/types';

export interface BoxState {
  ok: boolean;                       // canLive passes: chains may link and copy
  effect: LethalLimit['boxEffect'] | null;
  pool: number;                      // liquid depth, fraction of the box height
  frozen: number;                    // 0..1 share of solvent locked in a lattice
  phase: 'liquid' | 'frozen' | 'gas';
  heat: number;                      // temperature across the shared full slider range, 0..1
  iceFloats: boolean;                // from Solvent.solidSinks
  n2Gas: number;                     // N₂ molecules shown in the gas (0..44)
  o2Gas: number;                     // O₂ molecules shown (0..26)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const MAX_N2 = 44;
export const MAX_O2 = 26;

export function boxState(world: WorldConfig, c: Conditions): BoxState {
  const live = canLive(world, c);
  const effect = live.ok ? null : live.limit.boxEffect;
  const s = world.solvent;
  const hasSea = world.derived.some((d) => d.model === 'seaVolume');
  const cover = hasSea ? equilibriumSeaCover(world, c) : 1;

  let phase: BoxState['phase'] = 'liquid';
  let frozen = 0;
  if (c.temperature < s.freezeC) { phase = 'frozen'; frozen = 1; }
  else if (c.temperature > s.criticalC || cover <= 0) phase = 'gas';
  if (effect === 'freeze') frozen = 1;
  const pool = phase === 'gas' ? 0 : hasSea ? clamp(0.12 + 0.46 * cover, 0.12, 0.58) : 0.42;

  const t = controls.temperature;
  const heat = clamp((c.temperature - t.min) / (t.max - t.min), 0, 1);

  // Gas: with a sea model the air sits at the seas' vapour pressure; otherwise the Nitrogen slider (log) sets the count.
  const n2 = hasSea
    ? 10 + 10 * Math.log10(vapourPressure(s, c.temperature) + 0.05)
    : 8 + 7 * Math.log10(c.nitrogen);
  const o2 = c.oxygen > 0 ? Math.max(1, Math.round((c.oxygen / controls.oxygen.max) * MAX_O2)) : 0;
  return { ok: live.ok, effect, pool, frozen, phase, heat, iceFloats: !s.solidSinks, n2Gas: clamp(Math.round(n2), 2, MAX_N2), o2Gas: o2 };
}
