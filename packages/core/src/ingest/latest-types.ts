/**
 * The `latest` endpoint's row schema (SYNC-01 / D-06, Phase 5 plan 05-01).
 *
 * `latest.json` returns the single most-recent show's rows, updated LIVE by
 * kglw.net editors during a show. Its row shape is the `setlists` row MINUS
 * five keys that `latest` never emits — `css_class`, `isrecommended`,
 * `tracktime`, `timezone`, `showtime` (docs/SCHEMA.md §11). Because
 * `rawSetlistRowCensus` (api-types.ts) requires all five (three are
 * `.nullable()`-but-REQUIRED), reusing it to parse a live latest row throws
 * on every row (RESEARCH Pitfall 1). This dedicated schema fixes that — it
 * is authored fresh (NOT `rawSetlistRowCensus.omit(...)`, per plan) so the
 * live path never inherits the census's requirement of the 5 absent keys.
 *
 * WHY every present key is still enumerated (not just the consumed subset):
 * the enumerated shape now feeds `KNOWN_LATEST_KEYS`, driving drift DETECTION
 * (LIVE-03) rather than `strictObject` REJECTION. The schema is
 * `.catchall(z.unknown())`, so an additive API key leaves the row USABLE — one
 * new kglw.net field never silently empties suggestions mid-set. A real latest
 * row carries 36 keys; the schema lists that full present shape (each present-
 * but-unconsumed key `z.unknown()`, value-ignored) and types ONLY the 11 fields
 * the poller/binder actually consume (show_id, showdate, song_id, songname,
 * artist_id, position, setnumber, settype, venue_id, venuename, city). Net
 * effect: a genuinely NOVEL key is TOLERATED (kept usable) yet surfaced by
 * `detectNovelKeys` for a one-per-poll drift signal, while a wrong-typed
 * CONSUMED field is still rejected per-row (D-07 unchanged), and the real
 * 36-key row parses cleanly.
 *
 * Enum-ish consumed fields stay structurally loose (`setnumber`/`settype`
 * as `z.string()`) mirroring api-types.ts:35-36 — the live path must not
 * crash on a novel enum value it merely needs to route around.
 *
 * Security (T-05-01, ASVS V5): every consumed field crossing the kglw.net →
 * core trust boundary is type-checked here before use. `songname`/`venuename`
 * are untrusted editor content carried verbatim, NEVER rendered here
 * (docs/SCHEMA.md §12).
 */
import { z } from "zod";

export const latestSetlistRow = z.object({
  // ── The 11 consumed fields — precisely typed ──────────────────────────────
  show_id: z.number().int(),
  showdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  song_id: z.number().int(),
  songname: z.string(), // untrusted editor content — carry verbatim, never render (SCHEMA §12)
  artist_id: z.number().int(),
  position: z.number().int().positive(),
  setnumber: z.string(), // loose, mirroring api-types.ts:36 (SCHEMA §3, §7)
  settype: z.string(), // loose, mirroring api-types.ts:35 (SCHEMA §10)
  venue_id: z.number().int(),
  venuename: z.string(), // untrusted editor content — carry verbatim, never render (SCHEMA §12)
  city: z.string(),

  // ── Present-but-unconsumed keys — enumerated so KNOWN_LATEST_KEYS knows the
  //    full present shape for drift DETECTION, value-ignored (z.unknown()).
  //    This is the full latest key set (census 41 keys minus the 5 latest
  //    omits) MINUS the 11 consumed above. ────────────────────────────────────
  uniqueid: z.unknown(),
  showtitle: z.unknown(),
  artist: z.unknown(),
  permalink: z.unknown(),
  transition_id: z.unknown(),
  transition: z.unknown(),
  footnote: z.unknown(),
  footnotes: z.unknown(),
  isjamchart: z.unknown(),
  jamchart_notes: z.unknown(),
  shownotes: z.unknown(),
  showyear: z.unknown(),
  showorder: z.unknown(),
  opener: z.unknown(),
  tour_id: z.unknown(),
  tourname: z.unknown(),
  soundcheck: z.unknown(),
  isverified: z.unknown(),
  slug: z.unknown(),
  isoriginal: z.unknown(),
  original_artist: z.unknown(),
  state: z.unknown(),
  country: z.unknown(),
  isreprise: z.unknown(),
  isjam: z.unknown(),
}).catchall(z.unknown()); // LIVE-03: additive API keys stay usable, not rejected.

export type LatestSetlistRow = z.infer<typeof latestSetlistRow>;

/**
 * Every key the schema knows about (the full present latest shape). Derived
 * from the schema's own `.shape` so the two can never drift — no second hand-
 * maintained list (CLAUDE.md: no scattered magic numbers). `detectNovelKeys`
 * diffs a raw row against this to surface API drift (LIVE-03).
 */
export const KNOWN_LATEST_KEYS: ReadonlySet<string> = new Set(
  Object.keys(latestSetlistRow.shape),
);

/**
 * Return the NAME(s) of any key on `raw` the schema does not know about — the
 * drift signal for a new kglw.net field (LIVE-03). Returns `[]` for a row with
 * only known keys. Returns key NAMES ONLY, never any editor-supplied value
 * string (`songname`/`venuename` are untrusted editor content, SCHEMA §12) —
 * the poller logs these names, so a value must never ride along (T-11-02-03).
 */
export function detectNovelKeys(raw: Record<string, unknown>): string[] {
  return Object.keys(raw).filter((k) => !KNOWN_LATEST_KEYS.has(k));
}

/**
 * Re-exported so the live poller (poll-latest.ts) appends show-identifying
 * context (show_id/showdate) to a per-row parse failure using the exact same
 * failure-UX convention the ingestion layer established (api-types.ts).
 */
export { formatRowError } from "./api-types.ts";
