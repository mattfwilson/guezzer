/**
 * Pure raw-rows -> NormalizedCorpus function — the D-08/D-13/D-14/D-15/D-16
 * normalizer this plan implements. Reads docs/SCHEMA.md as its spec.
 *
 * CRITICAL RULE (docs/SCHEMA.md §4, Anti-Pattern 1): set/show structure is
 * derived ONLY from `setnumber` grouping + `position` sort. `transition_id`
 * is NEVER used to determine structure — it is mapped to a TransitionKind
 * for segue/terminal metadata only.
 */
import { z } from "zod";
import { config } from "../config.ts";
import { formatRowError, rawSetlistRowLocked, type RawSetlistRowLocked, type TransitionIdLocked } from "./api-types.ts";
import type {
  NormalizedCorpus,
  NormalizedShow,
  Performance,
  SetNumber,
  SetSection,
  TransitionKind,
} from "../domain/types.ts";

export interface NormalizeStats {
  /** Total rows validated against the locked schema, before any filtering. */
  totalRowsValidated: number;
  /** Rows dropped because artist_id !== 1 (DATA-03 client-side artist filter). */
  nonKglwRowsExcluded: number;
  /** Shows dropped because their settype is not in config.settypeAllowlist (D-16). */
  showsExcludedBySettype: Array<{ showId: number; showDate: string; settype: string }>;
  /**
   * Shows whose rows carried DISAGREEING `shownotes` values (D-01). `shownotes`
   * is show-level prose denormalized onto every row; a within-show mismatch is
   * cosmetic editor data, NOT structural — so it is recorded here for build-log
   * visibility and the position-1 value wins, but it NEVER throws (unlike the
   * `settype` mixed-value hard-fail). Identifying context per entry, mirroring
   * `showsExcludedBySettype`.
   */
  showsWithShownotesDisagreement: Array<{ showId: number; showDate: string }>;
  /** Count of shows that made it into the normalized corpus. */
  showsIncluded: number;
}

export interface NormalizeOptions {
  /** ISO timestamp override for the artifact header. Defaults to `new Date().toISOString()`; exposed for deterministic tests/CLI reproduction. */
  generatedAt?: string;
}

export interface NormalizeResult {
  corpus: NormalizedCorpus;
  stats: NormalizeStats;
}

/**
 * Maps the locked transition_id to a clean TransitionKind. Exhaustive over
 * TransitionIdLocked's full 1-6 domain (D-11): 1 -> "none"; 2/3 -> "segue";
 * 4/5/6 -> "terminal". `rawSetlistRowLocked` guarantees no other value can
 * reach this function — a novel id hard-fails at validation time, before
 * normalization ever runs (plan 01-04 Task 2 removes the prior
 * "any other value -> none" tolerance now that the id set is guaranteed).
 */
function mapTransitionKind(transitionId: TransitionIdLocked): TransitionKind {
  switch (transitionId) {
    case 1:
      return "none";
    case 2:
    case 3:
      return "segue";
    case 4:
    case 5:
    case 6:
      return "terminal";
  }
}

/**
 * D-15 guarded footnotes parse. `footnotes` is a double-encoded JSON
 * string (docs/SCHEMA.md §8): null -> both fields null; a parseable JSON
 * array of strings -> footnotesParsed populated, footnotesRaw null;
 * anything else (malformed JSON, or valid JSON that isn't a string array)
 * -> footnotesRaw carries the verbatim raw string, footnotesParsed null.
 * NEVER throws (Pitfall 5).
 */
export function parseFootnotesGuarded(
  raw: string | null,
): { footnotesParsed: string[] | null; footnotesRaw: string | null } {
  if (raw === null) {
    return { footnotesParsed: null, footnotesRaw: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) {
      return { footnotesParsed: parsed as string[], footnotesRaw: null };
    }
    return { footnotesParsed: null, footnotesRaw: raw };
  } catch {
    return { footnotesParsed: null, footnotesRaw: raw };
  }
}

export function normalizeCorpus(rows: unknown[], options: NormalizeOptions = {}): NormalizeResult {
  // 1. Validate every row with rawSetlistRowLocked (D-11: normalization runs
  // only on vocabulary-verified data — the census CLI keeps using its own
  // enum-loose census-mode schema separately, in api-types.ts). A drift
  // failure hard-fails naming the
  // field, offending value (per-issue custom zod message), and an example
  // show (formatRowError) — never a silent corruption of the matrix input.
  const validated: RawSetlistRowLocked[] = rows.map((row) => {
    try {
      return rawSetlistRowLocked.parse(row);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new Error(formatRowError(err, row));
      }
      throw err;
    }
  });

  // 2. Filter to artist_id === 1, counting exclusions (D-12/DATA-03).
  const kglwRows = validated.filter((row) => row.artist_id === 1);
  const nonKglwRowsExcluded = validated.length - kglwRows.length;

  // 3. Group rows by show_id.
  const rowsByShow = new Map<number, RawSetlistRowLocked[]>();
  for (const row of kglwRows) {
    const existing = rowsByShow.get(row.show_id);
    if (existing) {
      existing.push(row);
    } else {
      rowsByShow.set(row.show_id, [row]);
    }
  }

  // Sort shows by (showdate, showorder).
  const showRowGroups = [...rowsByShow.values()].sort((a, b) => {
    const dateCompare = a[0].showdate.localeCompare(b[0].showdate);
    if (dateCompare !== 0) return dateCompare;
    return a[0].showorder - b[0].showorder;
  });

  const showsExcludedBySettype: NormalizeStats["showsExcludedBySettype"] = [];
  const showsWithShownotesDisagreement: NormalizeStats["showsWithShownotesDisagreement"] = [];
  const normalizedShows: NormalizedShow[] = [];
  const distinctSongIds = new Set<number>();

  for (const showRows of showRowGroups) {
    const showId = showRows[0].show_id;
    const showDate = showRows[0].showdate;

    // 4. settype consistency + allowlist (D-16). A single show mixing
    // settypes across rows is a hard failure naming the show.
    const settypesInShow = new Set(showRows.map((row) => row.settype));
    if (settypesInShow.size > 1) {
      throw new Error(
        `Show ${showId} (${showDate}) has mixed settype values across its rows: ` +
          `${[...settypesInShow].join(", ")}. Every row in a show is expected to share one settype.`,
      );
    }
    const settype = showRows[0].settype;
    if (!(config.settypeAllowlist as readonly string[]).includes(settype)) {
      showsExcludedBySettype.push({ showId, showDate, settype });
      continue;
    }

    // 5. Sort by position, assert contiguity 1..N (hard fail naming show_id + showdate on gaps).
    const sortedRows = [...showRows].sort((a, b) => a.position - b.position);
    for (let i = 0; i < sortedRows.length; i++) {
      const expectedPosition = i + 1;
      if (sortedRows[i].position !== expectedPosition) {
        throw new Error(
          `Show ${showId} (${showDate}) has a non-contiguous position sequence: ` +
            `expected position ${expectedPosition} but found ${sortedRows[i].position}. ` +
            `Positions must be contiguous 1..N within a show.`,
        );
      }
    }

    // shownotes carry (D-01/D-02): `shownotes` is show-level prose repeated on
    // every row. Detect within-show disagreement with the SAME Set idiom as the
    // settype check — but record it to stats and CONTINUE rather than throw:
    // prose is non-structural, and a cosmetic editor mismatch must never break a
    // corpus refresh (D-01, D-15 tolerant-prose ethos). The position-1 row wins.
    if (new Set(showRows.map((row) => row.shownotes)).size > 1) {
      showsWithShownotesDisagreement.push({ showId, showDate });
    }

    // Group into SetSections by setnumber, in order of first appearance.
    // NEVER branch on transition_id for structure (Pitfall 1) — setnumber + position sort only.
    const setNumberOrder: SetNumber[] = [];
    const performancesBySet = new Map<SetNumber, Performance[]>();

    for (const row of sortedRows) {
      if (!performancesBySet.has(row.setnumber)) {
        setNumberOrder.push(row.setnumber);
        performancesBySet.set(row.setnumber, []);
      }

      // 7. Sentinel handling (Pitfall 7): placeholder occurrences occupy
      // their position slot but are excluded from the distinct-song count
      // and are never treated as a cover, regardless of isoriginal.
      const isPlaceholder = (config.sentinelSongIds as readonly number[]).includes(row.song_id);

      // 8. Covers per D-13. Sandwiches per D-14: no reprise-linking detection —
      // the raw reprise flag is never read; every appearance is its own positional entry.
      const isCover = !isPlaceholder && row.isoriginal === 0;
      const originalArtist = isCover && row.original_artist !== "" ? row.original_artist : null;

      // 9. Footnotes per D-15.
      const { footnotesParsed, footnotesRaw } = parseFootnotesGuarded(row.footnotes);

      const performance: Performance = {
        songId: row.song_id,
        songName: row.songname,
        slug: row.slug,
        position: row.position,
        // 6. transition_id -> TransitionKind mapping (metadata only, never structural).
        transitionKind: mapTransitionKind(row.transition_id),
        transitionId: row.transition_id,
        isCover,
        originalArtist,
        isPlaceholder,
        footnotesParsed,
        footnotesRaw,
        footnote: row.footnote,
      };

      performancesBySet.get(row.setnumber)!.push(performance);

      if (!isPlaceholder) {
        distinctSongIds.add(row.song_id);
      }
    }

    const sets: SetSection[] = setNumberOrder.map((setNumber) => ({
      setNumber,
      performances: performancesBySet.get(setNumber)!,
    }));

    const firstRow = showRows[0];
    normalizedShows.push({
      showId,
      date: showDate,
      showOrder: firstRow.showorder,
      year: firstRow.showyear,
      venue: {
        venueId: firstRow.venue_id,
        name: firstRow.venuename,
        city: firstRow.city,
        state: firstRow.state,
        country: firstRow.country,
      },
      tourId: firstRow.tour_id,
      tourName: firstRow.tourname,
      // D-01/D-02: verbatim carry from the POSITION-SORTED first row (not
      // `firstRow`, which is unsorted input order) — zero transformation.
      shownotes: sortedRows[0].shownotes,
      sets,
    });
  }

  // 10. Header.
  const latestShowDate = normalizedShows.reduce(
    (max, show) => (show.date > max ? show.date : max),
    normalizedShows[0]?.date ?? "",
  );

  const corpus: NormalizedCorpus = {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    latestShowDate,
    showCount: normalizedShows.length,
    songCount: distinctSongIds.size,
    shows: normalizedShows,
  };

  const stats: NormalizeStats = {
    totalRowsValidated: validated.length,
    nonKglwRowsExcluded,
    showsExcludedBySettype,
    showsWithShownotesDisagreement,
    showsIncluded: normalizedShows.length,
  };

  return { corpus, stats };
}
