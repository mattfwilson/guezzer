/**
 * D-09 / Pitfall 9: the polite online fallback for POST-corpus shows.
 *
 * The bundled `archive.json` ends at `latestShowDate` (2025-12-13 as shipped,
 * a real multi-month gap by summer 2026). This module fetches shows newer than
 * that boundary from kglw.net's per-year `setlists/showyear/{year}.json`
 * endpoint so a fan can still retro-mark a show the bundle has never heard of.
 *
 * It INVERTS `cli/fetch-corpus.ts`'s hard-fail policy and mirrors
 * `live/poll-latest.ts`'s tolerant tier exactly: ANY soft failure (non-OK
 * status, `error: true` envelope, network/timeout rejection, malformed JSON,
 * or even a tripped filter assertion) yields `{ shows: [], songs: {} }` and
 * NEVER throws. A crash here would take down the retro-mark browser.
 *
 * Etiquette (Pitfall 9, cross-plan CONTRACT — the browser fetch cannot enforce
 * this itself): the `User-Agent` header below is INERT in a browser (the
 * platform drops it), so the REAL D-09 etiquette is behavioral and belongs to
 * the CALLER (ArchiveBrowser, plan 06-08):
 *   - user-initiated only (never on load, never a background poll),
 *   - one GET per year per session (an in-memory cache in the caller),
 *   - soft-fail, NEVER retried.
 * This module performs EXACTLY ONE GET per call and no retry of any kind.
 *
 * Trust boundary (kglw.net → app state → DB cache):
 * - T-06-17: rows validated by the existing census zod schema; `artist_id === 1`
 *   filter + `assertFilterApplied` (the API silently ignores filters) — a
 *   foreign-band or unfiltered response is discarded/soft-failed, never surfaced.
 * - T-06-18: strings pass through zod; the app renders them as React text only.
 *
 * The returned `songs` record (songId → name) is the ONLY name source for
 * post-corpus DEBUT songs — songs absent from the bundled `archive.songs` map.
 * The caller resolves a marked show's setlist names from this record FIRST so a
 * debut's name survives end-to-end into the `archiveShows` cache (Pitfall 5).
 */
import { config } from "../config.ts";
import { rawSetlistRowCensus, type RawSetlistRow } from "../ingest/api-types.ts";
import { assertFilterApplied } from "../ingest/validate.ts";
import { type ArchiveSet, type ArchiveShow } from "./archive-types.ts";

export interface RecentShowsDeps {
  fetch: typeof globalThis.fetch;
}

export interface RecentShowsResult {
  /** Post-`sinceDate` shows in the compact ArchiveShow shape (schema-valid). */
  shows: ArchiveShow[];
  /** songId → name for every non-sentinel song in the fetched rows (debut name source). */
  songs: Record<number, string>;
}

interface ApiEnvelope {
  error: boolean;
  error_message: string;
  data: unknown[];
}

const defaultDeps: RecentShowsDeps = { fetch: globalThis.fetch };

/** The census set-vocabulary is closed to "1"|"2"|"e" (docs/SCHEMA.md §13a). Coerce anything else to the main set. */
function normalizeSetNumber(raw: string): ArchiveSet["n"] {
  return raw === "1" || raw === "2" || raw === "e" ? raw : "1";
}

/** Stable set order within a show: main sets, then the encore. */
const SET_RANK: Record<ArchiveSet["n"], number> = { "1": 0, "2": 1, e: 2 };

/**
 * GET one year of setlists newer than `sinceDate`, validated, artist-scoped and
 * filter-asserted, grouped into `ArchiveShow`s with a songId→name record.
 * Returns `{ shows: [], songs: {} }` on ANY soft failure — never throws, never
 * retries.
 */
export async function fetchRecentShows(
  year: number,
  sinceDate: string,
  deps: RecentShowsDeps = defaultDeps,
): Promise<RecentShowsResult> {
  const endpoint = `setlists/showyear/${year}`;
  const sentinelIds = new Set<number>(config.sentinelSongIds);

  try {
    const res = await deps.fetch(`${config.apiBase}/${endpoint}.json`, {
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });

    // Tolerant tier (INVERTED vs. fetchJson): a non-OK status is a soft empty.
    if (!res.ok) return { shows: [], songs: {} };

    const body = (await res.json()) as ApiEnvelope;
    if (body.error) return { shows: [], songs: {} };

    const rawRows = Array.isArray(body.data) ? body.data : [];

    const validated: RawSetlistRow[] = [];
    for (const raw of rawRows) {
      const parsed = rawSetlistRowCensus.safeParse(raw);
      if (!parsed.success) {
        // Per-row tolerance: skip a malformed row, never throw (T-06-17).
        console.debug(`fetchRecentShows: skipping malformed showyear row for ${endpoint}`);
        continue;
      }
      // T-06-17 / DATA-03: artist scope. The API silently ignores filters, so a
      // side-project row can appear — discard it here, never surface it.
      if (parsed.data.artist_id !== 1) continue;
      validated.push(parsed.data);
    }

    // D-09: the API silently ignores an invalid filter path (returns the whole
    // unfiltered table). An assert FAILURE is a soft empty result here (tolerant
    // tier) rather than the build-time hard throw — it's caught below.
    assertFilterApplied(validated, endpoint, { field: "showyear", expected: year });

    // songId → name for every non-sentinel fetched row (the debut name source).
    const songs: Record<number, string> = {};
    // show_id → accumulating show (first-seen insertion order).
    const shows = new Map<number, { show: ArchiveShow; setsByNumber: Map<ArchiveSet["n"], Array<{ position: number; songId: number }>> }>();

    for (const row of validated) {
      if (sentinelIds.has(row.song_id)) continue; // never credit the "Unknown" placeholder
      if (!(row.song_id in songs)) songs[row.song_id] = row.songname;

      let entry = shows.get(row.show_id);
      if (!entry) {
        entry = {
          show: {
            id: row.show_id,
            date: row.showdate,
            venue: row.venuename,
            city: row.city,
            state: row.state,
            country: row.country,
            sets: [],
          },
          setsByNumber: new Map(),
        };
        shows.set(row.show_id, entry);
      }

      const n = normalizeSetNumber(row.setnumber);
      let bucket = entry.setsByNumber.get(n);
      if (!bucket) {
        bucket = [];
        entry.setsByNumber.set(n, bucket);
      }
      bucket.push({ position: row.position, songId: row.song_id });
    }

    // Finalize each show's sets (position-ordered songs, set-rank-ordered sets)
    // and drop shows on/before the sinceDate boundary (never duplicate corpus).
    const result: ArchiveShow[] = [];
    for (const { show, setsByNumber } of shows.values()) {
      if (show.date <= sinceDate) continue;

      const sets: ArchiveSet[] = [...setsByNumber.entries()]
        .sort((a, b) => SET_RANK[a[0]] - SET_RANK[b[0]])
        .map(([n, songsInSet]) => ({
          n,
          songs: [...songsInSet].sort((a, b) => a.position - b.position).map((s) => s.songId),
        }))
        .filter((set) => set.songs.length > 0);

      result.push({ ...show, sets });
    }

    return { shows: result, songs };
  } catch {
    // Network reject, timeout abort, JSON blowup, OR a tripped filter assertion
    // — all soft failures in this tolerant tier. No stack trace surfaced (V7).
    return { shows: [], songs: {} };
  }
}
