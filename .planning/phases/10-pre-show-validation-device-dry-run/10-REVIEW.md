---
phase: 10-pre-show-validation-device-dry-run
reviewed: 2026-07-18T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - packages/core/src/cli/review-tuning-tags.ts
  - packages/core/src/ingest/tuning-tags.ts
  - packages/core/src/dex/share-stats.ts
  - packages/core/src/index.ts
  - packages/app/src/dex/shareCard.ts
  - packages/app/src/dex/ShareCardSheet.tsx
  - packages/app/src/dex/RecapView.tsx
  - packages/app/src/config.ts
  - packages/app/src/live/SuggestionStrip.tsx
  - packages/app/src/show/FabMenu.tsx
  - packages/app/src/show/ShowView.tsx
  - packages/core/test/review-tuning-tags.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: resolved
resolution:
  reviewed_status: issues_found
  warnings_fixed: 2
  info_deferred: 3
  fix_commit: 868667d
  note: >-
    Both Warnings (WR-01 SuggestionStrip scroll-clip, WR-02 ShareCardSheet
    rebuild flicker) fixed in 868667d; suite 587/587 green. The 3 Info items
    (FabMenu JSDoc "five actions" drift, unescaped `|` in the read-only tuning
    report tables, `--out` no-value silent no-op) are accepted/deferred as
    cosmetic/non-blocking for the personal offline tool.
---

# Phase 10: Code Review Report

> **Resolution (2026-07-18):** Both Warnings fixed in commit `868667d`
> (full suite 587/587 green). The 3 Info items are accepted as non-blocking.
> Original review findings preserved below for the record.

**Reviewed:** 2026-07-18
**Depth:** standard
**Files Reviewed:** 12 (8 source + 4 tests, tests reviewed for sanity only)
**Status:** issues_found

## Summary

Phase 10 adds a read-only tuning-review CLI, a per-show share-card projection, and
the device-dry-run layout fixes (taller SuggestionStrip slot, FAB lift, share-sheet
chrome refactor). The core logic is solid across the focus areas:

- **`buildRecapShareStats` (per-show projection)** is correct: the discriminated
  union narrows cleanly at every call site; placeholder + sentinel rows are excluded
  exactly as `deriveRecap` derives them; `songsCaught` equals the sum of the six
  tier counts by construction (one tier per distinct songId); the six-tier order and
  0-fill match the lifetime path; and there is no division (no NaN/zero-division on
  a single-show card). Verified against `share-stats.test.ts` fixtures.
- **`review-tuning-tags.ts` read-only guarantee** holds: it imports only the
  read-only helpers (`deriveCatalogFromCorpus`, `findMatchedAlbumTitles`,
  `defaultFamilyForAlbum`) and never the write path (`mergeTuningTags` /
  `generateTuningTags`). The only write is the optional `--out` report. Catalog
  song names are HTML-escaped (`&`/`<`/`>`) before entering the markdown report,
  closing the T-10-01 injection surface (test-pinned).
- **SuggestionStrip / FAB reservation mirror** is exact: the strip reserves height
  when `openerSeeded || hasContent`, and `FabMenu.stripReserved` is computed from
  the identical `openerSeeded || visibleSuggestions.length > 0 || visibleFillHints.length > 0`
  over the SAME arrays passed to the strip — no jump/mismatch, including the
  pre-opener-with-content case.
- **Pitfall-7 contract** is intact: the File is built up front in the open-effect,
  the share icon is `disabled` until `build.ok`, `handleShare` re-guards `build`, and
  `shareOrDownload` does no async work before `navigator.share`.
- **Hook order** in ShowView is unconditional (all hooks precede the early returns;
  `getOpenerSuggestions`/`visibleSuggestions`/`stripReserved` are plain consts below
  the returns).

Two Warnings and three Info items follow. No Critical/BLOCKER issues found.

## Warnings

### WR-01: SuggestionStrip `justify-center` + `overflow-y-auto` clips the top row when content overflows the fixed slot

**File:** `packages/app/src/live/SuggestionStrip.tsx:141-148`
**Issue:** The device-dry-run fix (commit `b0213c0`) switched the strip container
from `overflow-hidden` to `overflow-y-auto` but kept `justify-center`:

```
className={`flex shrink-0 flex-col justify-center overflow-y-auto ${
  hasContent ? "border-t border-hairline bg-elevated" : ""
}`}
```

`justify-content: center` combined with `overflow-y: auto` is a well-known flexbox
scroll bug (present in iOS Safari and Chromium): when the children's total height
exceeds the container, the content overflows in BOTH directions and the top overflow
is **not reachable by scrolling** — the first row(s) get clipped and cannot be
scrolled to. This is exactly reachable in normal operation: `live.SUGGESTION_COUNT`
allows 2 suggestion rows (2×44 = 88px) and `resolvePlaceholders` can add one or more
fill-hint rows uncapped, so 2 suggestions + ≥1 fill hint (≈132px) overflows the
112px slot. The result is that the top editor suggestion — the very row the strip
exists to surface — becomes hidden on the phase's own device target. The config
comment claims overflow "scrolls inside the slot rather than clipping," but with
`justify-center` the top clip is not scrollable.

**Fix:** Top-align the rows so scroll starts from the top; keep centered blank space
only when empty. e.g.:
```tsx
className={`flex shrink-0 flex-col overflow-y-auto ${
  hasContent ? "justify-start border-t border-hairline bg-elevated" : "justify-center"
}`}
```
(or drop `justify-center` and center the empty slot another way). Verify on-device
with 2 suggestions + 2 fill hints that the first row is fully reachable.

### WR-02: ShareCardSheet rebuilds the per-show card (flicker + object-URL churn + transient disabled share) when the unrelated live dex resolves

**File:** `packages/app/src/dex/ShareCardSheet.tsx:54-77`
**Issue:** The build effect lists `dex` and `archive` (from `useDexStats`) in its
dependency array even on the per-show path where `data` is supplied and those values
are ignored (`cardData = data ?? buildShareStats(dex!, archive!)`). The sheet mounts
`useDexStats` unconditionally, so on the RecapView per-show path the live dex resolves
asynchronously AFTER the sheet opens. Each resolution re-runs the effect, which calls
`setBuild(null)` (the preview `<img>` disappears, the hold frame flashes), revokes the
already-built object URL, and rebuilds the identical File. During the `await
buildShareCardFile` gap the share icon is re-`disabled` (`build == null`). Net effect:
a visible preview flicker and a briefly un-tappable share button on the per-show card,
plus redundant canvas encode + object-URL churn. Not a crash and Pitfall-7 is not
violated (a mid-flicker tap is a safe no-op), but it is a user-visible regression of
the "File ready before the tap" intent.

**Fix:** Don't depend on `dex`/`archive` when `data` is provided. Either split into a
per-show effect keyed on `[open, data]` and a lifetime effect keyed on
`[open, ready, dex, archive]`, or short-circuit rebuilds when `data != null`:
```ts
useEffect(() => {
  if (!open || !ready) return;
  // ...
}, [open, ready, data, ...(data == null ? [dex, archive] : [])]);
```
(or gate the whole `useDexStats` consumption behind `selfSource`).

## Info

### IN-01: FabMenu header JSDoc is stale — describes five actions / omits End Show

**File:** `packages/app/src/show/FabMenu.tsx:1-33`
**Issue:** The module JSDoc still says "All five actions collapse into one 56px FAB,"
lists the contract as "onSearch/onUnknown/onSetBreak/onEncore/onUndo" (no `onEndShow`),
and states "five action rows opening upward. Nearest-thumb order bottom→top is Undo,
???, Search, Set break, Encore." The component now renders **six** rows with `onEndShow`
appended as the bottom-most (nearest-thumb) item — so the documented contract and the
nearest-thumb ordering are both wrong. Misleads a future reader about which item sits
under the thumb (End Show, gated by a confirm dialog, not Undo).
**Fix:** Update the header block to six actions, add `onEndShow` to the contract line,
and correct the nearest-thumb order (End Show now bottom-most).

### IN-02: Markdown report does not escape the pipe (`|`) in table cells

**File:** `packages/core/src/cli/review-tuning-tags.ts:284-286, 307, 335`
**Issue:** `escapeMarkdownExcerpt` escapes `&`/`<`/`>` (closing the HTML-injection
threat T-10-01, which is the real security concern and IS handled), but not `|`. A
catalog song name containing a literal pipe would split into extra markdown table
columns and corrupt the report layout. This is a cosmetic/robustness gap, not an
injection vector (raw HTML remains escaped), and KGLW song names with pipes are
unlikely — hence Info.
**Fix:** Also replace `|` (e.g. with `\|` or `&#124;`) inside the excerpt escaper, or
document the omission if pipes are known-absent.

### IN-03: `--out` with no following value silently produces no report

**File:** `packages/core/src/cli/review-tuning-tags.ts:381-392`
**Issue:** `parseArgs` sets `options.outPath = argv[++i]`; when `--out` is the last
argv token, `argv[++i]` is `undefined`, so `outPath` stays undefined and
`runReviewTuningTags` writes nothing without any error. A user who typed `--out`
expecting a report gets silent stdout-only output.
**Fix:** Validate that a value follows `--out`; throw `Unknown flag` / "--out requires
a path" when the next token is missing.

---

_Reviewed: 2026-07-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
