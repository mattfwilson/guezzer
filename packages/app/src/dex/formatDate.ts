/**
 * The single owner of the app's two display date formats (FOUND-04, D-31): the
 * coarse "Mon YYYY" subline format and the precise "Mon D, YYYY" show-date
 * format. Both are module-scope `Intl.DateTimeFormat` instances constructed
 * once at import, both pinned to UTC via `timeZone`, and both never throw.
 *
 * D-31 places this in the app presentation tier, not `core` — `core` has zero
 * `Intl` usage and no display layer.
 *
 * D-35 — DISPLAY ONLY. A formatted date must never flow back into storage: not
 * into Dexie rows, not into the export envelope, not into export filenames, and
 * never into the `attendanceKey` unbound join key (which stays raw ISO,
 * `date:YYYY-MM-DD#…`). These helpers are pure and return strings; no writer
 * imports them.
 */

/**
 * Format an ISO date ("2025-01-15") as "Mon YYYY" ("Jan 2025") for the dex song
 * sublines and the WhyDetail corpus line (06-06, STAT-01/03). Parsed in UTC so a
 * "2025-01-01" never slips to "Dec 2024" in a negative-offset timezone. Shared by
 * SongRow + WhyDetail so the phrasing stays identical.
 */
const MON_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonYear(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : MON_YEAR.format(date);
}

/**
 * Format an ISO date ("2026-08-15") as "Mon D, YYYY" ("Aug 15, 2026") — the
 * precise show-date display format (FOUND-04, FOUND-05; decision D-31).
 *
 * UTC hazard, the reason the pin exists: `new Date("2026-08-15")` parses as UTC
 * midnight, so formatting it in a negative-offset zone (e.g. `America/New_York`)
 * renders `Aug 14, 2026` — every US user reading every show date one day early.
 * The UTC `timeZone` pin below is what prevents that; do not remove it.
 *
 * Never-throw contract: an unparseable input returns the RAW input string, never
 * `"Invalid Date"`. That also makes `""` round-trip to `""`, which RecapView's
 * `show?.date ?? ""` path depends on being byte-identical.
 *
 * Consumers: the `ShowView` header, `ShowsList`, `SetlistView` (visible text +
 * `aria-label`), `ArchiveBrowser` (visible text + the unmark-confirm
 * `aria-label`), the `RecapView` subline, and `shareCard`.
 */
const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : FULL_DATE.format(date);
}
