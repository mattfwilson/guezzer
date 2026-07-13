/**
 * Wrong-show-guarded auto-bind decision (D-07, Phase 5 plan 05-01 Task 3).
 *
 * A live-tracked show starts PROVISIONAL — its `showId` is null (db.ts:
 * TrackedShow.showId, the Phase 5/6 reconciliation seam). Once the editor's
 * `latest` rows describe tonight's show, we can bind the tracked row to the
 * canonical kglw.net `show_id` + venue. But `latest` can surface the WRONG
 * show (a Stu Mackenzie solo set, a prior night still cached, SCHEMA §9), so
 * binding is gated hard:
 *
 *   bind IFF  latestRows non-empty
 *        AND  latestRows[0].showdate === todayIso   (wrong-show/date guard)
 *        AND  trackedShow.showId === null           (never overwrite a bound show)
 *
 * Otherwise return null and stay provisional — the app retries next poll. This
 * is a pure decision fn; the app tier (plan 05-04) applies the binding via a
 * Dexie update and owns the `todayIso` clock.
 */
import type { LatestSetlistRow } from "../ingest/latest-types.ts";

/** Minimal projection of the app's `TrackedShow` (db.ts) the binder needs. */
export interface TrackedShowInput {
  showId: number | null;
}

/** The canonical binding derived from `latest`'s first row. */
export interface ShowBinding {
  showId: number;
  venueId: number;
  venueName: string;
  city: string;
}

/**
 * Return a `ShowBinding` only for today's `latest` on an unbound tracked show;
 * otherwise `null` (stay provisional). Never overwrites an already-set
 * `showId` and never binds on a date mismatch (D-07).
 */
export function bindShowFromLatest(
  latestRows: LatestSetlistRow[],
  trackedShow: TrackedShowInput,
  todayIso: string,
): ShowBinding | null {
  if (latestRows.length === 0) return null;
  if (trackedShow.showId !== null) return null;

  const head = latestRows[0];
  if (head.showdate !== todayIso) return null;

  return {
    showId: head.show_id,
    venueId: head.venue_id,
    venueName: head.venuename,
    city: head.city,
  };
}
