---
phase: 21-layout-layering-foundations
plan: 05
subsystem: ui
tags: [date-formatting, accessibility, aria-label, data-integrity, vitest]

# Dependency graph
requires:
  - phase: 21-layout-layering-foundations
    plan: 02
    provides: "packages/app/src/dex/formatDate.ts — formatFullDate, UTC-pinned and never-throw"
provides:
  - "Every full calendar date in the app rendered as 'Mon D, YYYY' from one helper"
  - "SetlistView + ArchiveBrowser accessible names announcing the same text the eye sees (D-33)"
  - "packages/app/test/setlistView.test.tsx — first render coverage of SetlistView"
  - "The D-35 display-only storage boundary enforced by test rather than convention"
affects: [21-06, 21-07, show-view, shows-list, setlist-view, archive-browser, recap-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Format at the call site, never in the copy template — config.copy stays strings-only (D-34)"
    - "Render assertions paired with a negative check on the raw ISO form, so a regression fails instead of silently passing"
    - "Identity normalizer ({ normalizer: (s) => s }) when asserting text whose leading/trailing whitespace is the contract"
    - "Source-scan guard (readFileSync + fileURLToPath) for a site whose render harness would cost the full Dexie/session/matrix stack"

key-files:
  created:
    - packages/app/test/setlistView.test.tsx
  modified:
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/dex/ShowsList.tsx
    - packages/app/src/dex/SetlistView.tsx
    - packages/app/src/dex/ArchiveBrowser.tsx
    - packages/app/src/dex/RecapView.tsx
    - packages/app/test/showsList.test.tsx
    - packages/app/test/archiveBrowser.test.tsx
    - packages/app/test/recapView.test.tsx
    - packages/app/test/authViewScoping.test.tsx
    - packages/app/test/exportImportRoundtrip.test.ts

key-decisions:
  - "RecapView's absent-`show` case cannot produce the plan's ' · {venue}' shape — `venue` derives from the same optional `show`, so an absent show yields an EMPTY subline. Drove the empty-string path via a stored row with an empty date instead, which reaches the identical `formatFullDate('') === ''` branch WITH a venue present, so the ' · {venue}' shape is genuinely asserted."
  - "attendanceKey imported by deep relative path (../../core/src/data-safety/attendance-key.ts) rather than widening core's public index — Task 3 forbids production changes, and the symbol is deliberately internal."

patterns-established:
  - "Two date vocabularies coexist deliberately: formatFullDate for show dates, formatMonYear for a song's coarse era (D-32). Neither converts the other's call sites."
  - "Every full-date render site is paired with a negative ISO assertion; the ISO form appearing on screen is now always a test failure."

requirements-completed: [FOUND-04]

# Metrics
duration: 11min
completed: 2026-07-24
---

# Phase 21 Plan 05: Full-Date Call-Site Conversion Summary

**All seven full-calendar-date sites — five visible renders plus the two accessible names — now read "Mon D, YYYY" from `formatFullDate`, and the D-35 display-only boundary is enforced by a regex guard on the `attendanceKey` join key rather than by convention.**

## Performance

- **Duration:** ~11 min
- **Tasks:** 3
- **Files modified:** 11 (1 created, 10 modified)
- **Test delta:** 1011 → 1015 tests, 128 → 129 files (baseline at wave start was 1011 after 21-02's +11)

## Accomplishments

- Five components converted at the call site: `ShowView` header, `ShowsList` row, `SetlistView` header, `ArchiveBrowser` row, `RecapView` subline. `tabular-nums` retained at all four date spans — "Mon D, YYYY" still has a numeric day and year, so date columns stay optically aligned.
- Both accessible names now announce the formatted text (D-33). The `ArchiveBrowser` unmark-confirm label matters most: it is the only thing identifying *which* show a VoiceOver user is about to unmark, and it previously announced `2025-11-20` as a bare number sequence.
- `config.copy.recap.subline` left untouched — formatting happens at the call site (D-34), so the copy layer stays strings-only and `formatDate.ts` remains the single owner of the format.
- `formatMonYear`'s two call sites (`SongRow`, `WhyDetail`) provably unchanged (`git diff` empty) — a song's era stays coarse (D-32).
- `setlistView.test.tsx` created: this component previously had no direct render coverage at all, only an indirect drill-in assertion on set headings and song rows.
- The D-35 boundary is now mechanical. The plan's own framing is what makes this load-bearing: the date **is** a join key, so a formatted date leaking into storage produces a still-valid string that throws nothing, fails no validation, and silently misaligns dex derivation and backup merge.

## Task Commits

1. **Task 1: convert five components + two accessible names** — `cf06612` (feat)
2. **Task 2: render coverage for all seven sites** — `8f920bb` (test)
3. **Task 3: D-35 display-only boundary guard** — `7643c77` (test)

## Files Created/Modified

- `packages/app/src/show/ShowView.tsx` — header date via `formatFullDate`.
- `packages/app/src/dex/ShowsList.tsx` — row date via `formatFullDate`.
- `packages/app/src/dex/SetlistView.tsx` — header text **and** dialog `aria-label`.
- `packages/app/src/dex/ArchiveBrowser.tsx` — row text **and** unmark-confirm `aria-label`; D-35 comments at both (nearest the write paths).
- `packages/app/src/dex/RecapView.tsx` — subline via call-site formatting; `?? ""` preserved inside the call; D-35 comment.
- `packages/app/test/setlistView.test.tsx` (created) — 4 cases: formatted header, ISO absent, `aria-label` equality, `tabular-nums`, plus venue/rows regression net.
- `packages/app/test/showsList.test.tsx` — formatted row dates + negative ISO checks; new FOUND-04 source-guard block for `ShowView`.
- `packages/app/test/archiveBrowser.test.tsx` — new FOUND-04 block: visible row date + the unmark-confirm accessible name composed from `config.copy.archive.unmarkConfirm`.
- `packages/app/test/recapView.test.tsx` — new FOUND-04 block: formatted subline + the empty-date `" · {venue}"` shape.
- `packages/app/test/authViewScoping.test.tsx` — updated (see Deviation 1).
- `packages/app/test/exportImportRoundtrip.test.ts` — the D-35 guard block.

## Decisions Made

- **The plan's absent-`show` RecapView case is unreachable as specified.** The plan asks for "a recap whose `show` is absent still renders `' · <venue>'`". But `venue` is `show?.venueName ?? null` — derived from the *same* optional `show` — so when `show` is absent the template's `venue ? ... : date` branch returns the bare (empty) date, producing `""`, not `" · <venue>"`. Asserting the plan's literal shape would have required asserting something the component cannot emit. Instead the empty-string path is driven by a stored row whose `date` is `""`: that reaches the identical `formatFullDate("") === ""` branch *with* a venue present, so the `" · {venue}"` shape is genuinely exercised and the byte-identical claim is actually proven.
- **Identity normalizer for the whitespace assertion.** Testing Library's default text normalizer trims, which would have silently hidden exactly the leading-space regression that case exists to catch. Passing `{ normalizer: (s) => s }` makes the separator-and-space contract real.
- **`attendanceKey` reached by deep relative import.** It is absent from `packages/core/src/index.ts` by design. Task 3 explicitly forbids production changes, so widening core's public API purely to make an internal symbol observable would have been the wrong trade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A fourth test file asserted the raw ISO date and broke**

- **Found during:** Task 2 (full-suite run)
- **Issue:** `packages/app/test/authViewScoping.test.tsx` (not in the plan's `files_modified`) identifies ShowsList rows by their *displayed* date to prove AUTH-05 identity scoping. The Task-1 conversion changed that displayed text, so `getByText("2025-05-01")` failed. Directly caused by this plan's change — in scope.
- **Fix:** Updated the four date literals to the formatted form, with a comment noting the display/storage split. The test's actual subject (identity scoping) is untouched.
- **Files modified:** `packages/app/test/authViewScoping.test.tsx`
- **Verification:** Full suite green.
- **Committed in:** `8f920bb`

**2. [Rule 3 - Blocking] Plan's `attendance-key.ts` path is wrong**

- **Found during:** Task 3
- **Issue:** The plan's `<read_first>` cites `packages/core/src/dex/attendance-key.ts`. The module actually lives at `packages/core/src/data-safety/attendance-key.ts` (`src/dex/` has no such file).
- **Fix:** Read and imported the real path. No code change.
- **Files modified:** None
- **Committed in:** N/A

**3. [Rule 3 - Blocking] Plan's vitest command and build-typecheck assumption (known repo defects)**

- **Found during:** Tasks 1–3
- **Issue:** Every `<verify>` block specifies `cd packages/app && npx vitest run --project @guezzer/app`, which fails — the projects list lives in the ROOT `vitest.config.ts`. Separately, `npm run build` is `vite build` (esbuild transpile only) and does **not** typecheck, so Task 1's "build succeeds" criterion does not prove typing.
- **Fix:** Ran vitest from the workspace root, and ran `npx tsc --noEmit -p packages/app/tsconfig.json` explicitly in addition to the build. Pre-flagged as known-good corrections in the executor prompt; same defect 21-02 hit.
- **Files modified:** None
- **Committed in:** N/A

**4. [Rule 1 - Bug] Task 1's `<verify>` cannot pass as sequenced**

- **Found during:** Task 1
- **Issue:** Task 1's verify runs `showsList.test.tsx`, but that file asserts the ISO date until Task 2 updates it — so the plan's own sequencing guarantees one failure at the Task-1 gate.
- **Fix:** Confirmed the failure was exactly and only the expected date-literal assertion (21 of 22 passing, the one failure on the pre-conversion literal), verified Task 1 against its acceptance criteria (which are grep/build based and all passed), and let Task 2 resolve it as the plan assigns. No change to task boundaries.
- **Files modified:** None
- **Committed in:** N/A

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking). Zero architectural changes, zero packages touched.
**Impact on plan:** No scope creep. Deviation 1 is the only one that changed a file beyond the plan's list, and it was a direct consequence of the plan's own conversion.

## Verification

- `npm test` — **129 files / 1015 tests passed**, zero failures (wave-start baseline 128 / 1011; +1 file, +4 tests).
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds; PWA precache 40 entries.
- `grep -rn '{session.active.date}\|{row.date}\|{resolved.date}\|{show.date}' packages/app/src` — **no match** (exit 1); no bare-render site remains.
- `grep -c 'formatFullDate('` per file — ShowView 1, ShowsList 1, SetlistView 2, ArchiveBrowser 2, RecapView 2. Meets the ≥1 / ≥2 requirement.
- `git diff packages/app/src/config.ts packages/app/src/dex/SongRow.tsx packages/app/src/show/WhyDetail.tsx` — **empty**; copy templates and the coarse formatter's call sites provably untouched.
- `git diff --stat packages/app/src packages/core/src` at Task 3 — **empty**; the boundary guard added zero production code.
- `tabular-nums` still present at all four converted date spans.

## Known Stubs

None. Every converted site renders real formatted data; no placeholder or empty-value paths were introduced.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes. Zero packages added, removed or upgraded.

Threat register dispositions from the plan:
- **T-21-11 (Tampering, storage boundary):** now **mitigated mechanically**, not by convention. `attendanceKey`'s unbound branch is pinned to `/^date:\d{4}-\d{2}-\d{2}#/` with a negative assertion that a formatted date does NOT match; every round-tripped `date`/`showDate` across `trackedShows`, `archiveShows` and `attendedShows` is asserted `/^\d{4}-\d{2}-\d{2}$/` in both the restored rows and the envelope; the export filename is asserted `/^[\w.-]+$/` and rejects a comma-and-space. No writer imports `formatFullDate`.
- **T-21-12 (DoS, unparseable date):** inherited from 21-02's never-throw contract; a malformed corpus row degrades a label rather than crashing a page.
- **T-21-13 (Tampering, aria-label composition):** accepted as planned. The composed label is a copy constant plus a formatter-returned string; React escapes attribute values and no HTML sink is involved.
- **T-21-SC (Tampering, npm installs):** no install performed; `package.json` untouched.

## Issues Encountered

- The plan's RecapView absent-`show` expectation is not producible by the component (see Decisions). Resolved by exercising the same code branch through a reachable state.
- Two plan-text errors (the `attendance-key.ts` path, the Task-1 verify sequencing) plus the two known repo-wide verification defects. All resolved without production impact.

## User Setup Required

None.

## Next Phase Readiness

- FOUND-04 is complete for the app surface: every full date reads from one helper, both accessible names match their visible text, and the storage boundary is test-enforced.
- `shareCard` is listed as a `formatFullDate` consumer in 21-02's module doc comment but is **not** in this plan's scope and was not converted — if a share-card date is meant to read "Mon D, YYYY", it remains open for 21-06/21-07.
- No shared layout, CSS, or config surface touched, so this carries no merge risk against the other Wave-2 plans. `config.ts` is provably unmodified.

## Self-Check: PASSED

- `packages/app/test/setlistView.test.tsx` — FOUND
- `packages/app/src/dex/formatDate.ts` (upstream dependency) — FOUND
- `.planning/phases/21-layout-layering-foundations/21-05-SUMMARY.md` — FOUND
- Commits `cf06612`, `8f920bb`, `7643c77` — all present in `git log`

---
*Phase: 21-layout-layering-foundations*
*Completed: 2026-07-24*
