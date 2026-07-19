---
phase: 12-data-safety-integrity
plan: 01
subsystem: database
tags: [attendance-dedupe, merge, derive-dex, doubleheader, data-integrity, pure-core]

# Dependency graph
requires:
  - phase: 06-pokedex-history-stats
    provides: deriveDex single derivation entry point + parseAndMergeImport union-merge/dedupe
provides:
  - Shared pure-core attendanceKey(showId, date, sessionId) helper — single source of truth for attendance grouping
  - Same-date doubleheaders survive as two distinct attendances through BOTH merge.ts and derive-dex.ts (SAFE-04 / D-01)
  - Bound multi-device nights still dedup to one attendance (D-02 preserved)
affects: [12-02, 12-03, dex-derivation, backup-merge, doubleheader]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deduped grouping key: one shared pure-core attendance-key.ts consumed by merge + derive-dex (kills the twin-drift bug class, same as D-07 triggerDownload)"
    - "Mechanism A: unbound attendance keyed by date#sessionId; bound branch (id:showId) untouched so every show_id join + online multi-device dedup is preserved"

key-files:
  created:
    - packages/core/src/data-safety/attendance-key.ts
  modified:
    - packages/core/src/data-safety/merge.ts
    - packages/core/src/dex/derive-dex.ts
    - packages/core/test/merge.test.ts
    - packages/core/test/dex/derive-dex.test.ts

key-decisions:
  - "Unified the two duplicated attendanceGroupKey twins into one shared pure module rather than editing each in place — removes the drift risk the bug arose from"
  - "Unbound key = date:${date}#${sessionId} (Mechanism A); retro callers pass a dummy sessionId since their showId is always non-null (sessionId ignored on the bound branch)"
  - "derive-dex L126-166 grouping/archive-join and the group.showIds.add guard left byte-for-byte — only the key string changed (D-03 join safety)"

patterns-established:
  - "Attendance grouping is a single pure helper — both dedupe sites (merge, dex) must consume it, never re-implement"

requirements-completed: [SAFE-04]

# Metrics
duration: 6min
completed: 2026-07-19
---

# Phase 12 Plan 01: Same-Date Doubleheader Survival (SAFE-04) Summary

**Shared pure-core `attendanceKey(showId, date, sessionId)` splits unbound same-date sessions into distinct attendances, so a caught doubleheader survives through both `merge.ts` and `derive-dex.ts` while bound multi-device nights still dedup to one.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T20:53:17Z
- **Completed:** 2026-07-19T20:56:57Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- New pure, DOM-free `packages/core/src/data-safety/attendance-key.ts` exporting `attendanceKey` — the single deduped source of truth for attendance grouping.
- Both `merge.ts` (same-show dedupe + `addedShows` metrics) and `derive-dex.ts` (retro + tracked grouping) rewired onto the shared helper; both local `attendanceGroupKey` twins deleted.
- Two intentionally-inverted regression tests now assert doubleheaders survive (merge → 2 attendances; dex → `showCount === 2`), with D-01 comments so a checker cannot restore the old collapse.
- Retained the bound-dedup cases (show_id 999 → one attendance / `showCount === 1`) and added a new bound+unbound same-date case (D-02) plus a D-03 sightings-survive guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared attendanceKey module + write inverted/failing tests** - `469afe0` (test)
2. **Task 2: Adopt attendanceKey in merge.ts and derive-dex.ts (delete both duplicates)** - `9c1d469` (fix)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified
- `packages/core/src/data-safety/attendance-key.ts` - NEW shared pure helper: `id:${showId}` for bound, `date:${date}#${sessionId}` for unbound.
- `packages/core/src/data-safety/merge.ts` - Deleted local `attendanceGroupKey`; import + call `attendanceKey(show.showId, show.date, show.sessionId)` at the dedupe group and both metric sites.
- `packages/core/src/dex/derive-dex.ts` - Deleted local `attendanceGroupKey`; retro call passes `("")` sessionId, tracked call passes `tracked.sessionId`; grouping/archive-join block untouched (D-03).
- `packages/core/test/merge.test.ts` - Inverted the collapse case → two attendances; added a bound+unbound same-date case.
- `packages/core/test/dex/derive-dex.test.ts` - Inverted the collapse case → `showCount === 2`; added per-night sightings assertions.

## Decisions Made
- Unified the duplicated key functions into one shared module (kills the twin-drift bug class) rather than patching each in place.
- Mechanism A unbound key `date:${date}#${sessionId}`; bound `id:${showId}` branch untouched, preserving every show_id join and online multi-device dedup.
- Left `derive-dex.ts` grouping mechanics and the `group.showIds.add` guard byte-for-byte — only the key-producing call swapped (D-03: an unbound-only group adds nothing to `showIds`, so no archive join can be dropped).

## Deviations from Plan

None - plan executed exactly as written. The two doubleheader assertions were RED at the end of Task 1 (module created, sites not yet rewired) and flipped GREEN after Task 2, exactly as the plan specified.

## Issues Encountered
- `merge.ts` shows as "binary" to ripgrep because `entryKey` uses a pre-existing intentional `\x00` separator (present in HEAD, rendered as a space by the reader) — not corruption. Verified the null byte pre-dates this plan; used `git diff --text` to review the diff.

## Verification
- `attendance-key.ts` exists and exports `attendanceKey` with the `date:${date}#${sessionId}` unbound branch.
- No `function attendanceGroupKey` remains anywhere in `packages/core/src` (grep: 0 matches).
- Full core suite green: 328 passed. Full repo suite green: 621 passed (77 files). Core `tsc --noEmit` clean.

## User Setup Required
None - no external service configuration required. No stored data or schema change (the key is a transient in-memory Map key recomputed on every derivation).

## Next Phase Readiness
- SAFE-04 complete. Plans 12-02 (SAFE-01/03 End-Show backup sequencing) and 12-03 (SAFE-02 triggerDownload) are independent and ready.

## Self-Check: PASSED
- All 5 files present on disk.
- Both task commits (`469afe0`, `9c1d469`) present in git history.

---
*Phase: 12-data-safety-integrity*
*Completed: 2026-07-19*
