/**
 * SAFE-04 (D-01): the SINGLE shared attendance-grouping key used by BOTH
 * `merge.ts` (same-show dedupe) and `dex/derive-dex.ts` (tracked∪retro dedupe).
 * Previously each site carried its own `attendanceGroupKey` twin (drift risk,
 * same class of bug D-07 unifies for `triggerDownload`) — this is the deduped
 * source of truth.
 *
 * Mechanism A (12-RESEARCH.md §SAFE-04): a BOUND show keys by `id:${showId}`,
 * so every show_id join and online multi-device dedup is preserved exactly. An
 * UNBOUND show keys by `date:${date}#${sessionId}`, so two distinct unbound
 * sessions on the SAME date become TWO distinct attendances — a genuine
 * doubleheader is never silently collapsed (D-01, the core failure this project
 * exists to prevent). Retro callers always pass a non-null showId, so the
 * `sessionId` argument is ignored on that branch (a dummy value is harmless).
 *
 * Zero DOM, zero I/O, erasable-syntax-only — Node-testable (CLAUDE.md).
 */

/** Stable attendance-grouping key: bound → by show_id, unbound → by date + session. */
export function attendanceKey(
  showId: number | null,
  date: string,
  sessionId: string,
): string {
  return showId != null ? `id:${showId}` : `date:${date}#${sessionId}`;
}
