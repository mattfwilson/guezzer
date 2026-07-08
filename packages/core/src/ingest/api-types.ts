/**
 * Raw kglw.net API row shapes — the executable pair of docs/SCHEMA.md (D-09).
 *
 * Stage 1 (this file, current): census-mode schemas. Keys are validated
 * STRICTLY (unknown keys hard-fail — catches API drift), but enum-ish
 * fields (`settype`, `setnumber`, `transition_id`, flag numbers) stay
 * structurally loose (`z.string()`, `z.number().int()`) because the
 * full-corpus census (plan 01-04) is what discovers the real vocabulary —
 * locking enums now would be circular (Pitfall 2).
 *
 * Stage 2 — locked schemas (added post-census in plan 01-04, below): after
 * data/census-report.md resolved the open unknowns in docs/SCHEMA.md §13,
 * a second schema layer uses locked z.literal/z.enum unions that hard-fail
 * on novel values (D-11).
 */
import { z } from "zod";

export const apiEnvelope = z.strictObject({
  error: z.boolean(),
  error_message: z.string(),
  data: z.array(z.unknown()),
});

export const rawSetlistRowCensus = z.strictObject({
  uniqueid: z.string(),
  show_id: z.number().int(),
  showdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  showtime: z.unknown(), // never populated in samples — permissive (docs/SCHEMA.md §2)
  showtitle: z.string(),
  artist: z.string(),
  song_id: z.number().int(),
  songname: z.string(),
  artist_id: z.number().int(),
  permalink: z.string(),
  settype: z.string(), // loose until census locks allowlist (docs/SCHEMA.md §10)
  setnumber: z.string(), // loose until census locks vocabulary (docs/SCHEMA.md §3, §7)
  position: z.number().int().positive(),
  tracktime: z.string().nullable(),
  transition_id: z.number().int(), // loose until census locks 1..6 (docs/SCHEMA.md §4)
  transition: z.string(), // display string — never string-parsed, switch on transition_id only
  footnote: z.string(),
  footnotes: z.string().nullable(), // double-encoded JSON string (docs/SCHEMA.md §8)
  isjamchart: z.number(), // 0/1 flag, not boolean
  jamchart_notes: z.string().nullable(),
  venue_id: z.number().int(),
  shownotes: z.string(), // untrusted content — carry verbatim, never render (docs/SCHEMA.md §12)
  showyear: z.number().int(), // NUMBER, not string (verified trap)
  showorder: z.number().int(),
  opener: z.string(),
  tour_id: z.number().int(),
  tourname: z.string(),
  soundcheck: z.string(),
  isverified: z.number(), // 0/1 flag, not boolean
  slug: z.string(),
  isoriginal: z.number(), // 0/1 flag, not boolean
  original_artist: z.string(),
  venuename: z.string(),
  city: z.string(),
  // Nullable per full-corpus fetch discovery (plan 01-03 Task 2): non-US/
  // non-state venues (e.g. Montreal, Canada, show_id 1678650827, 2014-10-15)
  // return state: null — not present in either committed sample. Structural
  // correction only; D-11 enum-locking is unaffected.
  state: z.string().nullable(),
  country: z.string(),
  timezone: z.unknown(), // never populated in samples — permissive (docs/SCHEMA.md §2)
  isreprise: z.number(), // 0/1 flag, not boolean — unreliable (docs/SCHEMA.md §5, D-14)
  isjam: z.number(), // 0/1 flag, not boolean
  css_class: z.string().nullable(),
  isrecommended: z.number().nullable(),
});

export type RawSetlistRow = z.infer<typeof rawSetlistRowCensus>;

/**
 * Stage 2 — locked schemas (D-11), added after the full-corpus census
 * (plan 01-03 Task 3, data/census-report.md / data/census.json) resolved
 * every docs/SCHEMA.md §13 Open Unknown. Every literal/enum value below is
 * exactly what the census observed across all 10,210 rows, 2010-2026 — no
 * invented vocabulary (api-types.test.ts Test 6 asserts this by cross-
 * checking against data/census.json directly).
 *
 * `rawSetlistRowCensus` above is UNCHANGED and stays enum-loose forever —
 * the census CLI (packages/core/src/ingest/census.ts) must remain runnable
 * on drifted/novel data. These two schemas coexist permanently; only
 * `normalize.ts` (the finalized ingestion consumer) swaps to the locked
 * schema (plan 01-04 Task 2).
 */

/**
 * docs/SCHEMA.md §13a: full-corpus census found exactly three `setnumber`
 * values across all 10,210 rows — "1" (9,545 rows/757 shows), "2" (286
 * rows/22 shows), "e" (27 rows/18 shows). No "3" (or any other value)
 * exists anywhere in 2010-2026.
 */
export const setnumberLocked = z.enum(["1", "2", "e"], {
  error: (issue) =>
    `setnumber must be one of "1", "2", "e" (locked from the full-corpus census, docs/SCHEMA.md §13a) — got ${JSON.stringify(issue.input)}`,
});

/**
 * docs/SCHEMA.md §13b: full-corpus census counts — id 1 (6,404 rows), id 2
 * (2,467), id 3 (377), id 4 (29, first seen 2016-03-04), id 5 (292), id 6
 * (289). This is the FULL observed vocabulary; the locked schema's job is
 * drift DETECTION only — allowlist FILTERING (settypeAllowlist) is a
 * separate, normalizer-level concern (see settypeLocked below vs.
 * config.settypeAllowlist).
 */
export const transitionIdLocked = z.union(
  [z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)],
  {
    error: (issue) =>
      `transition_id must be one of 1-6 (locked from the full-corpus census, docs/SCHEMA.md §13b) — got ${JSON.stringify(issue.input)}`,
  },
);

/**
 * docs/SCHEMA.md §13d: full-corpus census confirmed a closed KGLW-scope
 * (artist_id === 1) set — no new variants anywhere in 2010-2026. "Set"
 * (9,562 rows/696 shows), "One Set" (210 rows/42 shows), "Live Session"
 * (86 rows/19 shows).
 *
 * This locked schema, however, validates raw rows BEFORE the artist filter
 * runs (normalize.ts validates the full multi-artist table first, then
 * filters artist_id === 1 — docs/SCHEMA.md §9). The census intentionally
 * scoped its settype distribution to KGLW rows only (01-03-SUMMARY.md
 * decisions), so it never captured side-project settype values. A direct
 * scan of every committed data/raw/setlists-*.json file (all artist_ids)
 * found two more: "DJ Set" (86 rows, e.g. artist_id 36 "King Gizzard & The
 * Lizard Wizard DJ's") and "Act" (1 row, artist_id 9 "Professor of the
 * Occult"). Both are discovered/deferred to Rule 1: without them, the
 * locked schema would hard-fail on legitimate side-project rows in the
 * ALREADY-COMMITTED corpus before normalize.ts ever gets a chance to
 * filter them out by artist_id.
 *
 * This is the FULL raw-corpus vocabulary (drift detection only);
 * config.settypeAllowlist (D-16) separately excludes "Live Session" (and
 * implicitly everything but "Set"/"One Set") at the normalizer level,
 * after the artist_id filter has already dropped every side-project row.
 */
export const settypeLocked = z.enum(["Set", "One Set", "Live Session", "DJ Set", "Act"], {
  error: (issue) =>
    `settype must be one of "Set", "One Set", "Live Session", "DJ Set", "Act" (locked from a full-corpus raw scan, docs/SCHEMA.md §13d) — got ${JSON.stringify(issue.input)}`,
});

/**
 * Stage-2 locked row schema: the shared 41-key shape with the three
 * census-locked fields swapped in. `.extend()` on a `strictObject` stays
 * strict (unrecognized keys still hard-fail) — verified against zod 4.4.3.
 */
export const rawSetlistRowLocked = rawSetlistRowCensus.extend({
  setnumber: setnumberLocked,
  transition_id: transitionIdLocked,
  settype: settypeLocked,
});

export type RawSetlistRowLocked = z.infer<typeof rawSetlistRowLocked>;

/** The locked transition_id domain: exactly 1-6 (docs/SCHEMA.md §13b). */
export type TransitionIdLocked = z.infer<typeof transitionIdLocked>;

/**
 * D-11 drift UX: appends show-identifying context (show_id / showdate) to
 * every issue message a locked-schema parse produced, so a future refresh
 * failure names the field, the offending value (already in the per-issue
 * custom `error` message above), AND an example show to go look at.
 */
export function formatRowError(zodError: z.ZodError, row: unknown): string {
  const showId = (row as { show_id?: unknown } | null)?.show_id;
  const showDate = (row as { showdate?: unknown } | null)?.showdate;
  const showContext =
    showId !== undefined || showDate !== undefined
      ? ` (show_id=${JSON.stringify(showId)}, showdate=${JSON.stringify(showDate)})`
      : "";
  const messages = zodError.issues.map((issue) => issue.message).join("; ");
  return `${messages}${showContext}`;
}
