/**
 * Pure, recency-weighted opener ranking (QUICK-260718-1no). Given the bundled
 * show archive, produces the top-N King Gizzard show openers so the pre-opener
 * SearchSheet can offer a credible head-start on logging the first song — the
 * one moment `predict()` cannot help (there is no current song yet).
 *
 * The opener of a show is the first songId of its Set 1:
 * `show.sets.find(s => s.n === "1")?.songs[0]`. Shows with no Set 1 or an empty
 * Set-1 songs array carry no opener and are skipped.
 *
 * Rank = the sum of `decayedWeight(showDate, asOfDate, halfLifeDays)` over every
 * show a song opened — recent openers dominate, deep-catalog one-offs keep a
 * faint voice (mirrors the matrix's recency-decay convention, D-10). The recency
 * anchor `asOfDate` is passed IN (the app supplies `archive.latestShowDate`) so
 * this stays pure and deterministic: zero React/DOM/`Date.now`.
 */
import type { ArchiveShow } from "./archive-types.ts";
import { decayedWeight } from "../model/decay.ts";
import { config } from "../config.ts";

/** One ranked opener row. `count` is raw opener occurrences; `score` is the summed decayed weight. */
export interface TopOpener {
  songId: number;
  songName: string;
  count: number;
  score: number;
}

export interface DeriveTopOpenersOptions {
  /** Recency anchor (ISO `YYYY-MM-DD`) — pass `archive.latestShowDate`, never `Date.now()`. */
  asOfDate: string;
  /** Exponential decay half-life in days (source from `config.decayHalfLifeDays`). */
  halfLifeDays: number;
  /** Max openers to return (top-N after sorting). */
  limit: number;
}

/**
 * Round to a fixed precision before comparison so float-summation order can
 * never perturb the tie-break (RESEARCH Pitfall 2 — mirrors matrix.ts's
 * `roundWeighted` using the shared `config.weightedCountPrecision`).
 */
function roundScore(value: number): number {
  return Math.round(value * config.weightedCountPrecision) / config.weightedCountPrecision;
}

/**
 * Derive the top-N recency-weighted openers. Pure: reads only its arguments.
 * Sort is deterministic — score desc, then raw count desc, then songId asc.
 */
export function deriveTopOpeners(
  shows: ArchiveShow[],
  songs: Record<string, string>,
  opts: DeriveTopOpenersOptions,
): TopOpener[] {
  const acc = new Map<number, { count: number; score: number }>();

  for (const show of shows) {
    const set1 = show.sets.find((s) => s.n === "1");
    const openerId = set1?.songs[0];
    if (openerId == null) continue; // no Set 1, or an empty Set-1 songs array

    const weight = decayedWeight(show.date, opts.asOfDate, opts.halfLifeDays);
    const prev = acc.get(openerId) ?? { count: 0, score: 0 };
    acc.set(openerId, { count: prev.count + 1, score: prev.score + weight });
  }

  const rows: TopOpener[] = [];
  for (const [songId, { count, score }] of acc) {
    rows.push({
      songId,
      songName: songs[String(songId)] ?? `Song ${songId}`,
      count,
      score: roundScore(score),
    });
  }

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score; // score desc
    if (b.count !== a.count) return b.count - a.count; // raw count desc
    return a.songId - b.songId; // songId asc
  });

  return rows.slice(0, opts.limit);
}
