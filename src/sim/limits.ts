// Slider viability (CLAUDE.md "Condition sliders"): pure, no side effects. Used by the worker and the selection screen.
// The sim's kill conditions, the red zones and the element cells all read the same `world.limits` list through canLive.
import type { Conditions, ControlDef, ControlId, LethalLimit, LivingBand, WorldConfig } from '../worlds/types';
import {
  nitrogenWarming,
  seaCover,
  seaVolume,
  type RadiativeParams,
  type SeaParams,
} from './models';

export type CanLive = { ok: true } | { ok: false; limit: LethalLimit };

export interface LimitsEnv {
  /** Surface gravity in g. The worker passes the seeded sample; the selection screen uses the range midpoint. */
  gravity?: number;
  /** Slider definitions. Defaults to FALLBACK_CONTROLS until worlds/controls.ts is wired in. */
  controls?: readonly Pick<ControlDef, 'id' | 'min' | 'max' | 'scale'>[];
}

/** Same ranges as CLAUDE.md "Condition sliders" / worlds/controls.ts. Pass `env.controls` to override. */
export const FALLBACK_CONTROLS: readonly Pick<ControlDef, 'id' | 'min' | 'max' | 'scale'>[] = [
  { id: 'temperature', min: -250, max: 150, scale: 'linear' },
  { id: 'nitrogen', min: 0.01, max: 1000, scale: 'log' },
  { id: 'oxygen', min: 0, max: 40, scale: 'linear' },
];

export const CONTROL_ORDER: readonly ControlId[] = ['temperature', 'nitrogen', 'oxygen'];

const GRID = 600;
const BISECT = 60;
const EDGE_EPS = 1e-9; // relative slack when asking "is this value inside its band"

function gravityOf(world: WorldConfig, env?: LimitsEnv): number {
  if (env?.gravity !== undefined) return env.gravity;
  const r = world.ranges.gravity;
  return r ? (r[0] + r[1]) / 2 : 1;
}

function controlsOf(env?: LimitsEnv) {
  return env?.controls ?? FALLBACK_CONTROLS;
}

function derivedParams<T>(world: WorldConfig, model: string, statId?: string): T | undefined {
  return world.derived.find((d) => d.model === model && (statId === undefined || d.statId === statId))
    ?.params as T | undefined;
}

/** Sea cover (0..1) the conditions imply at equilibrium. Zero when the world has no sea model. */
export function equilibriumSeaCover(world: WorldConfig, c: Conditions, env?: LimitsEnv): number {
  const sea = derivedParams<SeaParams>(world, 'seaVolume');
  if (!sea) return 0;
  return seaCover(sea, seaVolume(sea, world.solvent, c.nitrogen, c.temperature, gravityOf(world, env)));
}

function statValue(world: WorldConfig, c: Conditions, statId: string, env?: LimitsEnv): number {
  if (statId === 'temperature' || statId === 'nitrogen' || statId === 'oxygen') return c[statId];
  if (statId === 'seaCover') return equilibriumSeaCover(world, c, env);
  throw new Error(`limits: unknown statId '${statId}'`);
}

/** Does this limit fail? Failing means life dies. Edges are inclusive on the living side. */
function limitFails(world: WorldConfig, limit: LethalLimit, c: Conditions, env?: LimitsEnv): boolean {
  const v = statValue(world, c, limit.statId, env);
  const p = limit.params;
  switch (limit.model) {
    case 'fixed':
      return limit.side === 'below' ? v < p.value : v > p.value;
    case 'solventFreezes': {
      const edge = world.solvent.freezeC + (p.offset ?? 0);
      return limit.side === 'below' ? v < edge : v > edge;
    }
    case 'solventCritical': {
      const edge = world.solvent.criticalC + (p.offset ?? 0);
      return limit.side === 'above' ? v > edge : v < edge;
    }
    case 'seasEmpty': {
      // Seas could not exist at equilibrium. `minCover` (default 0) is the cover at or below which they count as gone.
      const min = p.minCover ?? 0;
      return limit.side === 'below' ? v <= min : v > min;
    }
  }
}

/** Drives the element cells: does life survive at these conditions? Reports the first failing limit in config order. */
export function canLive(world: WorldConfig, conditions: Conditions, env?: LimitsEnv): CanLive {
  for (const limit of world.limits) if (limitFails(world, limit, conditions, env)) return { ok: false, limit };
  return { ok: true };
}

/** Temperature shift (K) when nitrogen moves from `from` to `to` with the orbit held still. Zero on worlds without a greenhouse term. */
function greenhouseShift(world: WorldConfig, from: number, to: number): number {
  const rad = derivedParams<RadiativeParams>(world, 'radiativeBalance', 'temperature');
  return rad ? nitrogenWarming(rad, to, from) : 0;
}

/** Conditions with `id` set to `value`; nitrogen also warms the planet at a fixed orbit. */
function probe(world: WorldConfig, c: Conditions, id: ControlId, value: number): Conditions {
  if (id === 'nitrogen') return { ...c, nitrogen: value, temperature: c.temperature + greenhouseShift(world, c.nitrogen, value) };
  return { ...c, [id]: value };
}

function gridPoint(def: Pick<ControlDef, 'min' | 'max' | 'scale'>, t: number): number {
  return def.scale === 'log'
    ? Math.exp(Math.log(def.min) + t * (Math.log(def.max) - Math.log(def.min)))
    : def.min + t * (def.max - def.min);
}

function mid(def: Pick<ControlDef, 'scale'>, a: number, b: number): number {
  return def.scale === 'log' ? Math.sqrt(a * b) : (a + b) / 2;
}

/** Edge between a living value `ok` and a failing value `bad`, as the living-side value. */
function bisect(world: WorldConfig, c: Conditions, def: Pick<ControlDef, 'id' | 'scale'>, ok: number, bad: number, env?: LimitsEnv): number {
  for (let i = 0; i < BISECT; i++) {
    const m = mid(def, ok, bad);
    if (canLive(world, probe(world, c, def.id, m), env).ok) ok = m;
    else bad = m;
  }
  return ok;
}

function failingLimitId(world: WorldConfig, c: Conditions, id: ControlId, value: number, env?: LimitsEnv): string | undefined {
  const r = canLive(world, probe(world, c, id, value), env);
  return r.ok ? undefined : r.limit.id;
}

function bandFor(world: WorldConfig, c: Conditions, def: Pick<ControlDef, 'id' | 'min' | 'max' | 'scale'>, env?: LimitsEnv): LivingBand {
  const pts: number[] = [];
  const oks: boolean[] = [];
  for (let i = 0; i <= GRID; i++) {
    const v = gridPoint(def, i / GRID);
    pts.push(v);
    oks.push(canLive(world, probe(world, c, def.id, v), env).ok);
  }

  // Maximal living runs on the grid; choose the one holding the current value, else the nearest.
  const runs: [number, number][] = [];
  for (let i = 0; i <= GRID; i++) {
    if (!oks[i]) continue;
    let j = i;
    while (j + 1 <= GRID && oks[j + 1]) j++;
    runs.push([i, j]);
    i = j;
  }
  if (runs.length === 0) {
    const near = pts.reduce((best, v) => (Math.abs(v - c[def.id]) < Math.abs(best - c[def.id]) ? v : best), pts[0]);
    return { low: def.min, high: def.max, empty: true, blockingLimitId: failingLimitId(world, c, def.id, near, env) };
  }
  const cur = c[def.id];
  const dist = ([a, b]: [number, number]) => (cur < pts[a] ? pts[a] - cur : cur > pts[b] ? cur - pts[b] : 0);
  const [a, b] = runs.reduce((best, r) => (dist(r) < dist(best) ? r : best));

  const band: LivingBand = { low: pts[a], high: pts[b] };
  if (a > 0) {
    band.low = bisect(world, c, def, pts[a], pts[a - 1], env);
    band.lowLimitId = failingLimitId(world, c, def.id, pts[a - 1], env);
  } else band.low = def.min;
  if (b < GRID) {
    band.high = bisect(world, c, def, pts[b], pts[b + 1], env);
    band.highLimitId = failingLimitId(world, c, def.id, pts[b + 1], env);
  } else band.high = def.max;
  return band;
}

/**
 * Living band for each slider: the range of positions where no limit fails, holding the other sliders' physical
 * settings (orbit, nitrogen and oxygen inventories) still. Edges are found by searching canLive along each slider.
 * Nitrogen also moves temperature at a fixed orbit (greenhouse), so couplings show up without special cases.
 */
export function livingBands(world: WorldConfig, conditions: Conditions, env?: LimitsEnv): Record<ControlId, LivingBand> {
  const out = {} as Record<ControlId, LivingBand>;
  for (const def of controlsOf(env)) out[def.id] = bandFor(world, conditions, def, env);
  return out;
}

export function insideBand(band: LivingBand, value: number): boolean {
  if (band.empty) return false;
  const slack = EDGE_EPS * Math.max(1, Math.abs(value));
  return value >= band.low - slack && value <= band.high + slack;
}

/** Stop a value at the edge of its band. An empty band returns the value unchanged (nothing is safe). */
export function clampToBand(band: LivingBand, value: number): number {
  if (band.empty) return value;
  return Math.min(band.high, Math.max(band.low, value));
}

/**
 * The worker's handling of `control:set`: clamp to the living band and return the new conditions.
 * `blockedBy` names the limit whose edge stopped the thumb. Nitrogen also warms the planet at a fixed orbit.
 */
export function applyControl(
  world: WorldConfig,
  conditions: Conditions,
  id: ControlId,
  value: number,
  env?: LimitsEnv,
): { conditions: Conditions; blockedBy?: string } {
  const band = livingBands(world, conditions, env)[id];
  if (band.empty) return { conditions, blockedBy: band.blockingLimitId };
  const clamped = clampToBand(band, value);
  const blockedBy = clamped === value ? undefined : value < band.low ? band.lowLimitId : band.highLimitId;
  return { conditions: probe(world, conditions, id, clamped), blockedBy };
}

/**
 * Starting conditions for Generate: keep sliders inside their band, replace those in a red zone with the
 * world's startDefaults. Fixed order (temperature, nitrogen, oxygen), re-checking bands after each move.
 */
export function startingConditions(
  world: WorldConfig,
  requested: Conditions,
  env?: LimitsEnv,
): { start: Conditions; moved: { controlId: ControlId; limitId: string }[] } {
  let start = { ...requested };
  const moved: { controlId: ControlId; limitId: string }[] = [];
  CONTROL_ORDER.forEach((id, i) => {
    // A red zone may be caused by a slider not yet processed (silicon at 21 % oxygen has no living temperature at all),
    // so a value also counts as fine if it is inside its band once the later sliders sit at their defaults.
    const strict = livingBands(world, start, env)[id];
    if (insideBand(strict, start[id])) return;
    const later = { ...start };
    for (const l of CONTROL_ORDER.slice(i + 1)) later[l] = world.startDefaults[l];
    const lenient = livingBands(world, later, env)[id];
    if (insideBand(lenient, start[id])) return;
    const band = strict.empty ? lenient : strict;
    const limitId = band.empty ? band.blockingLimitId : start[id] < band.low ? band.lowLimitId : band.highLimitId;
    start = { ...start, [id]: world.startDefaults[id] };
    moved.push({ controlId: id, limitId: limitId ?? 'unknown' });
  });
  return { start, moved };
}

