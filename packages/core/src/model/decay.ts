/**
 * D-10: exponential recency-decay weight for a single observed transition
 * instance. Half-life is measured relative to the matrix's own `asOfDate`
 * cutoff, NEVER wall-clock `Date.now()` — a matrix built as-of an earlier
 * backtest cutoff must decay correctly for that cutoff, not for today.
 * Pure, no I/O. See 02-RESEARCH.md M2.
 */
const MS_PER_DAY = 86_400_000;

/**
 * `ageDays` is the number of days `showDate` precedes `asOfDate` (positive
 * for a show strictly before the cutoff). Returns `Math.exp(-ln2 *
 * ageDays / halfLifeDays)` — 1.0 at age 0, 0.5 at exactly one half-life,
 * approaching 0 as age grows. `showDate`/`asOfDate` are ISO date strings
 * (`YYYY-MM-DD`).
 */
export function decayedWeight(showDate: string, asOfDate: string, halfLifeDays: number): number {
  const ageDays = (Date.parse(asOfDate) - Date.parse(showDate)) / MS_PER_DAY;
  return Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
}
