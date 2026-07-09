/**
 * Pure Show-Mode scoring helpers — hit/miss classification and the running
 * tally. Zero DOM, zero React: these are the honest-metric primitives the
 * live tally (SHOW-09) and per-entry outcome (SHOW-08) are derived from. Types
 * are imported from the persistence schema (db.ts); no runtime dependency on
 * Dexie itself.
 */
import type { EntryOutcome, TrackedEntry } from "../db/db.ts";

/**
 * A confirmed song is a **hit** iff it was among the shown fan — the 5–8 orbs
 * on screen when it was logged (D-06). Anything logged via search or the "???"
 * placeholder passes an id not in the fan (or null) → **miss** (D-08). The
 * visible fan is the honest denominator, not a fixed top-5.
 */
export function classifyOutcome(
  confirmedSongId: number | null,
  shownFanSongIds: readonly number[],
): EntryOutcome {
  return confirmedSongId != null && shownFanSongIds.includes(confirmedSongId)
    ? "hit"
    : "miss";
}

/** The combined running tally (SHOW-09/D-07). `pct` is null in the zero-state → render "—". */
export interface Tally {
  hits: number;
  total: number;
  pct: number | null;
}

/**
 * Derive the single combined "X/Y (%)" tally from the show's entries (D-07).
 * `hits` counts `outcome === "hit"`; `total` is every entry (a "???"/search
 * miss still bumps the denominator, D-08). `pct` is a rounded integer, or null
 * when there are no entries yet (zero-state renders "—", never a bare 0%).
 */
export function deriveTally(
  entries: readonly Pick<TrackedEntry, "outcome">[],
): Tally {
  const total = entries.length;
  const hits = entries.filter((e) => e.outcome === "hit").length;
  return {
    hits,
    total,
    pct: total ? Math.round((100 * hits) / total) : null,
  };
}
