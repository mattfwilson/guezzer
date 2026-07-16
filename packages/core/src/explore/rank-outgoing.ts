/**
 * EXPL-02 / D-01..D-04: pure ranking of a song's COMPLETE outgoing transition
 * history straight off the matrix edge records — RAW historical percentages,
 * never `predict()` (Explore has no `ShowContext`; do NOT wire the predictor in,
 * D-01). Zero I/O, no React/DOM.
 *
 * The returned list is the FULL outgoing history (D-03) — independent of the
 * edge slider and rotation toggle, which are visual-only filters on the graph.
 * The app slices to `config.explore.BARS_TOP_N` for the initial sheet and
 * assembles the "why" copy from `count`/`total`/`lastDate`/`segueCount` (D-02).
 */
import type { TransitionMatrix } from "../domain/types.ts";

/** One ranked outgoing bar — raw edge stats, no derived "why" string (app-side, D-02). */
export interface OutgoingBar {
  songId: number;
  count: number;
  pct: number;
  lastDate: string;
  segueCount: number;
}

/** `rankOutgoing` result: the outgoing total (denominator) + the full ranked bar list. */
export interface RankedOutgoing {
  total: number;
  bars: OutgoingBar[];
}

/**
 * Rank a song's outgoing transitions by raw count. Reads the FULL matrix edge
 * list for `songId` (never a pre-filtered link set, D-03), sums `count` into the
 * `total` denominator, and maps each edge to `{ songId: e.to, count, pct, ... }`
 * sorted descending by count. A zero-outgoing song returns an honest
 * `{ total: 0, bars: [] }` — the D-08 free-floating star, no throw.
 */
export function rankOutgoing(matrix: TransitionMatrix, songId: number): RankedOutgoing {
  const out = matrix.edges.filter((e) => e.from === songId);
  const total = out.reduce((sum, e) => sum + e.count, 0);
  const bars: OutgoingBar[] = out
    .map((e) => ({
      songId: e.to,
      count: e.count,
      pct: total ? e.count / total : 0,
      lastDate: e.lastDate,
      segueCount: e.segueCount,
    }))
    .sort((a, b) => b.count - a.count);
  return { total, bars };
}
