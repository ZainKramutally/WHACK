// Succession easing (owner ask, 2026-11-08: "ecosystems feel suitably different"). A gated archetype (gates.ts) doesn't
// swap in the instant a slider crosses its condition: each gate's effective share of its plants eases toward its target
// at SHARE_RATE per second, so new species colonise over about 10 s and recede when conditions revert. Which plants flip
// is each plant's own seeded hash against the share (gates.ts gateKey), so the plants already standing stay put and only
// the changing share turns over. Render-only, never fed back to the sim. The targets are a pure function of the stats;
// the eased shares are a pure function of the targets' history (the frame dt sequence), with no randomness.
import type { VisualInputs } from '../../worlds/types';
import { GATES, type GateId, type GateSpec, type WorldEnv } from './gates';

/** Share change per second while easing: a full colonisation (0 → 1) takes 10 s ([art]). */
export const SHARE_RATE = 0.1;
/** Eased share movement since the last placement that triggers a re-placement. */
export const SHARE_REBUILD = 0.05;

export type GateShares = Partial<Record<GateId, number>>;

/** A gate's share target now: 0 while its world-wide condition fails, else its share (all of its plants when unset).
 * Accepts a share function of the world, for ramped gates. */
export function gateTarget(g: GateSpec, e: WorldEnv): number {
  if (!g.world(e)) return 0;
  const s = (g as { share?: number | ((e: WorldEnv) => number) }).share;
  const v = typeof s === 'function' ? s(e) : s ?? 1;
  return Math.min(1, Math.max(0, v));
}

/** Every gate's target for this world's chemistry. */
export function gateTargets(e: WorldEnv, out: GateShares = {}): GateShares {
  const chem = e.carbon ? 'carbon' : 'silicon';
  for (const g of GATES) if (g.chem === chem) out[g.id] = gateTarget(g, e);
  return out;
}

/** Move each eased share toward its target by at most SHARE_RATE × dt (monotone, exact on arrival). `snap`: jump there
 * (a new world, or the build, where the world forms around its conditions). Returns `eased`. */
export function easeShares(eased: GateShares, targets: GateShares, dt: number, snap = false): GateShares {
  const step = SHARE_RATE * Math.max(0, dt);
  for (const id of Object.keys(targets) as GateId[]) {
    const t = targets[id]!, v = eased[id];
    if (snap || v === undefined) { eased[id] = t; continue; }
    eased[id] = v < t ? Math.min(t, v + step) : Math.max(t, v - step);
  }
  for (const id of Object.keys(eased) as GateId[]) if (!(id in targets)) delete eased[id]; // the other chemistry's
  return eased;
}

/** The largest change between two share sets (for the re-placement trigger). */
export function shareDelta(a: GateShares, b: GateShares): number {
  let d = 0;
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<GateId>) d = Math.max(d, Math.abs((a[id] ?? 0) - (b[id] ?? 0)));
  return d;
}

/** The gates placement uses with eased shares: each with share > 0, its world half settled by the share (the share is
 * the condition now), by role, in GATES' priority order. */
export function easedGates(e: WorldEnv, shares: GateShares): Record<GateSpec['role'], GateSpec[]> {
  const out: Record<GateSpec['role'], GateSpec[]> = { ground: [], mid: [], giant: [] };
  const chem = e.carbon ? 'carbon' : 'silicon';
  for (const g of GATES) {
    if (g.chem !== chem) continue;
    const s = shares[g.id] ?? 0;
    if (s > 0) out[g.role].push({ ...g, world: () => true, share: s });
  }
  return out;
}

/** The conditions plant traits and gates read, as placed (flora.ts re-places when any moves past STAT_STEP). */
export interface StatKeys { temperature: number; oxygen: number; nitrogen: number; co2: number; light: number; airDensity: number; heatBand: number; frozen: boolean }
/** Smallest change that re-places: absolute for temperature (°C), oxygen (%) and heat band, relative for the rest. */
export const STAT_STEP = { temperature: 0.5, oxygen: 0.5, heatBand: 0.01, rel: 0.03 } as const;

export function statsOf(i: VisualInputs, out: StatKeys | null = null): StatKeys {
  const s = i.stats, o = out ?? { temperature: 0, oxygen: 0, nitrogen: 0, co2: 0, light: 0, airDensity: 0, heatBand: 0, frozen: false };
  o.temperature = s.temperature ?? 0; o.oxygen = s.oxygen ?? 0; o.nitrogen = s.nitrogen ?? 0; o.co2 = s.co2 ?? 0;
  o.light = i.light; o.airDensity = i.airDensity; o.heatBand = i.heatBand; o.frozen = i.frozen;
  return o;
}

/** A condition the traits and gates read has moved since `last` (always true before the first placement). */
export function statsMoved(i: VisualInputs, last: StatKeys | null): boolean {
  if (!last) return true;
  const s = i.stats, rel = (a: number, b: number) => Math.abs(a - b) > STAT_STEP.rel * Math.max(1e-6, Math.abs(b));
  return Math.abs((s.temperature ?? 0) - last.temperature) > STAT_STEP.temperature || Math.abs((s.oxygen ?? 0) - last.oxygen) > STAT_STEP.oxygen ||
    Math.abs(i.heatBand - last.heatBand) > STAT_STEP.heatBand || i.frozen !== last.frozen ||
    rel(s.nitrogen ?? 0, last.nitrogen) || rel(s.co2 ?? 0, last.co2) || rel(i.light, last.light) || rel(i.airDensity, last.airDensity);
}
