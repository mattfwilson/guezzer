/**
 * D-10: pure, offline archive search + year browse over the bundled show
 * archive. Copies the `search/search-catalog.ts` fuse.js idiom nearly
 * wholesale — build the Fuse index once (the caller memoizes the returned
 * searcher), query it many times, and short-circuit an empty/whitespace query
 * to `[]` so the browser never dumps all 738 shows at once.
 *
 * This module is pure: it holds no state beyond the Fuse index, touches no
 * file/network, and imports zero React/DOM symbols (core's "lib": ["ES2023"]
 * purity). Tuning knobs live in `config.dex.archiveSearch` — no magic numbers
 * here (CLAUDE.md single-config-file constraint).
 *
 * Year browse is deliberately NOT fuse: `groupShowsByYear` is a plain
 * sort/group (per the 06-PATTERNS map), so scrolling the archive by year is a
 * deterministic, score-free list — fuzzy matching is only for the search box.
 */
import Fuse from "fuse.js";
import { config } from "../config.ts";
import type { ArchiveShow } from "./archive-types.ts";

/** One ranked archive hit. `score` is fuse.js's 0 (perfect) .. 1 (worst), or undefined if fuse omitted it. */
export interface ArchiveSearchHit {
  show: ArchiveShow;
  score: number | undefined;
}

/**
 * Build the Fuse index once (the caller memoizes the returned searcher) and
 * query it many times. Fuzzy over date/venue/city; an empty or whitespace-only
 * query short-circuits to `[]` — never a whole-archive dump. `ignoreLocation`
 * makes a match anywhere in a field count equally (so a "2022-10" date
 * substring matches), `includeScore` surfaces fuse.js's rank.
 */
export function makeArchiveSearcher(
  shows: ArchiveShow[],
): (query: string) => ArchiveSearchHit[] {
  const fuse = new Fuse(shows, {
    keys: ["date", "venue", "city"],
    threshold: config.dex.archiveSearch.threshold,
    distance: config.dex.archiveSearch.distance,
    ignoreLocation: true,
    includeScore: true,
  });

  return (query: string): ArchiveSearchHit[] =>
    query.trim() === ""
      ? []
      : fuse.search(query).map((result) => ({
          show: result.item,
          score: result.score,
        }));
}

/**
 * Plain year browse (NOT fuse): group shows by calendar year, newest year
 * first, and newest show first within each year. Does not mutate the input.
 * The year is parsed from the leading `YYYY` of the ISO `date` string.
 */
export function groupShowsByYear(
  shows: ArchiveShow[],
): Array<{ year: number; shows: ArchiveShow[] }> {
  const byYear = new Map<number, ArchiveShow[]>();
  for (const show of shows) {
    const year = Number.parseInt(show.date.slice(0, 4), 10);
    let bucket = byYear.get(year);
    if (!bucket) {
      bucket = [];
      byYear.set(year, bucket);
    }
    bucket.push(show);
  }

  return [...byYear.keys()]
    .sort((a, b) => b - a)
    .map((year) => ({
      year,
      shows: [...(byYear.get(year) as ArchiveShow[])].sort((a, b) =>
        b.date.localeCompare(a.date) || b.id - a.id,
      ),
    }));
}
