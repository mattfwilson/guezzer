/**
 * D-12: identifies the most-recent COMPLETE tour -- the backtest's holdout
 * set. Pure, zero I/O. Mirrors `ingest/census.ts`'s "pure reducer, one
 * top-level fn" shape.
 *
 * CRITICAL RULE (RESEARCH Pitfall 3, verified against the real corpus:
 * tour 57 starts 2025-05-18 but tour 58 starts 2024-11-01): `tourId` is
 * NOT chronologically monotonic. The holdout tour is identified by the tour
 * CONTAINING THE LATEST-DATED SHOW, never by `max(tourId)`.
 */
import { config } from "../config.ts";
import type { NormalizedCorpus, NormalizedShow } from "../domain/types.ts";

/** Finds the show with the max (date, showOrder) -- the same fixed tie-break `buildMatrix`/`cli/build-model.ts`'s `findLatestShow` uses (Pitfall 2 determinism: `showOrder` disambiguates same-date shows). */
function findLatestShow(corpus: NormalizedCorpus): NormalizedShow {
  return corpus.shows.reduce(
    (latest, show) =>
      show.date > latest.date || (show.date === latest.date && show.showOrder > latest.showOrder)
        ? show
        : latest,
    corpus.shows[0],
  );
}

/**
 * `findHoldoutShows(corpus, tourIdSentinel) -> NormalizedShow[]` (D-12).
 * Reduces `corpus.shows` to the show with max `(date, showOrder)`, reads
 * its `tourId`, and returns every show sharing that `tourId`. Throws a
 * loud error (T-02-09, T-02 error convention) if the latest show's `tourId`
 * equals `tourIdSentinel` -- a one-off show with no complete-tour holdout
 * to evaluate against -- rather than silently emitting a meaningless empty
 * backtest.
 */
export function findHoldoutShows(
  corpus: NormalizedCorpus,
  tourIdSentinel: number = config.tourIdSentinel,
): NormalizedShow[] {
  if (corpus.shows.length === 0) {
    throw new Error("Cannot find a holdout tour: the corpus has 0 shows.");
  }

  const latest = findLatestShow(corpus);
  const tourId = latest.tourId;

  if (tourId === tourIdSentinel) {
    throw new Error(
      `Cannot find a complete-tour holdout: the latest show (showId ${latest.showId}, ` +
        `${latest.date}) has tourId ${tourId}, the "Not Part of a Tour" sentinel. ` +
        `A one-off show has no complete tour to hold out.`,
    );
  }

  return corpus.shows.filter((show) => show.tourId === tourId);
}
