// Pure slider maths: value <-> track position, clamping to the living band, red-zone segments.
import type { ControlDef, LivingBand } from '../worlds/types';

type Range = Pick<ControlDef, 'min' | 'max' | 'scale'>;

const clamp01 = (f: number) => (f < 0 ? 0 : f > 1 ? 1 : f);

/** Value (display units) to a 0..1 position along the track. Out-of-range values clamp. */
export function valueToFrac(value: number, r: Range): number {
  const v = Math.min(Math.max(value, r.min), r.max);
  if (r.scale === 'log' && r.min > 0) {
    return clamp01((Math.log(v) - Math.log(r.min)) / (Math.log(r.max) - Math.log(r.min)));
  }
  return clamp01((v - r.min) / (r.max - r.min));
}

/** 0..1 track position to a value in display units. */
export function fracToValue(frac: number, r: Range): number {
  const f = clamp01(frac);
  if (r.scale === 'log' && r.min > 0) {
    return Math.exp(Math.log(r.min) + f * (Math.log(r.max) - Math.log(r.min)));
  }
  return r.min + f * (r.max - r.min);
}

export interface ClampResult { value: number; blocked: 'low' | 'high' | null; limitId?: string }

/** Stop a requested value at the edge of the living band. An empty band never moves the thumb. */
export function clampToBand(value: number, band: LivingBand): ClampResult {
  if (band.empty) return { value, blocked: null };
  if (value < band.low) return { value: band.low, blocked: 'low', limitId: band.lowLimitId };
  if (value > band.high) return { value: band.high, blocked: 'high', limitId: band.highLimitId };
  return { value, blocked: null };
}

export interface RedSegment { side: 'low' | 'high' | 'all'; from: number; to: number; limitId?: string }

/** Red zones as 0..1 track segments. Nothing is drawn where the band reaches the end of the track. */
export function redSegments(band: LivingBand, r: Range): RedSegment[] {
  if (band.empty) return [{ side: 'all', from: 0, to: 1, limitId: band.blockingLimitId }];
  const out: RedSegment[] = [];
  const lo = valueToFrac(band.low, r);
  const hi = valueToFrac(band.high, r);
  if (band.low > r.min && lo > 0) out.push({ side: 'low', from: 0, to: lo, limitId: band.lowLimitId });
  if (band.high < r.max && hi < 1) out.push({ side: 'high', from: hi, to: 1, limitId: band.highLimitId });
  return out;
}
