// Pure display formatters.

/** Three significant figures for small numbers, fewer decimals as values grow. */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1000) return Math.round(v).toLocaleString('en-GB');
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.001) return v.toPrecision(2);
  return v.toExponential(1);
}

export function formatValue(v: number, unit: string): string {
  const n = formatNumber(v).replace('-', '−');
  return unit === '%' || unit === '°C' ? `${n}${unit === '%' ? '' : ' '}${unit}` : `${n} ${unit}`;
}

/** formatValue for a named stat: a tiny but non-zero oxygen (silicon's trace, at most 0.01%) reads "0% (trace)", not "0.0050%". */
export function formatStat(id: string, v: number, unit: string): string {
  if (id === 'oxygen' && unit === '%' && v > 0 && v <= TRACE_O2_PCT) return '0% (trace)';
  return formatValue(v, unit);
}
export const TRACE_O2_PCT = 0.01;

/** Illustrative years-since-formation counter. */
export function formatYears(years: number): string {
  if (years >= 1e9) return `${(years / 1e9).toFixed(3)} billion years`;
  if (years >= 1e6) return `${(years / 1e6).toFixed(0)} million years`;
  return `${Math.round(years).toLocaleString('en-GB')} years`;
}

export const midpoint = (range: [number, number]): number => (range[0] + range[1]) / 2;
