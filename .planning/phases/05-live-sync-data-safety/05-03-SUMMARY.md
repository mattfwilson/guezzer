---
phase: 05-live-sync-data-safety
plan: 03
subsystem: database
tags: [dexie, indexeddb, migration, config, provenance, live-sync, data-safety]

# Dependency graph
requires:
  - phase: 03-app-shell-pwa
    provides: Dexie v1 schema (meta/attendedShows), config.ts single-source pattern
  - phase: 04-show-mode
    provides: Dexie v2 tracked-show schema, logSong/transaction idiom, classifyOutcome scoring
provides:
  - "Additive Dexie version(3) migration: EntrySource provenance + trackedShows venue/show_id binding columns, with source='manual' backfill and null binding defaults"
  - "adoptSuggestion(sessionId, entry) — editor-provenance write-through with honest hit/miss classification"
  - "bindShow(sessionId, binding) — silent, non-destructive kglw.net reconciliation seam"
  - "importSnapshot(snapshot) — atomic single-transaction merged-import commit"
  - "config.live / config.ui / config.dataSafety tunables + config.copy.live / config.copy.settings strings"
affects: [05-04, 05-05, live-poller, suggestion-strip, settings-view, export-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only Dexie versioned migration (version(3) never touches version(1)/version(2))"
    - "Entry provenance (source) stamped at every write path so the tally stays decomposable"
    - "Atomic import via a single rw transaction wrapping all table bulkPuts (validate-in-memory, commit-once)"

key-files:
  created:
    - packages/app/test/migrationV3.test.ts
  modified:
    - packages/app/src/db/db.ts
    - packages/app/src/config.ts
    - packages/app/test/showSession.test.ts
    - packages/app/test/cometTrail.test.tsx
    - packages/app/test/trailNodeSheet.test.tsx

key-decisions:
  - "Backfill source='manual' in the upgrade callback so no pre-existing entry ever has an undefined source (D-03)"
  - "Index showId (reconciliation) and source (provenance filter) but NOT the venue binding columns — Phase 6 reads those per-row"
  - "importSnapshot is a pure atomic-write seam; union-merge/dedupe is the caller's job (Plan 05-05)"
  - "Copy templates with interpolation (fill-??? body, import counts) stored as arrow functions in config so no component hardcodes sentence structure"

patterns-established:
  - "Additive migration: new this.version(N).stores(...).upgrade(...) block, prior version blocks immutable"
  - "Every trackedEntries write path stamps source explicitly (logSong→manual, adoptSuggestion→editor)"

requirements-completed: [SYNC-01, SYNC-02, PWA-04]

# Metrics
duration: 18min
completed: 2026-07-13
---

# Phase 5 Plan 03: App Persistence Substrate Summary

**Additive Dexie version(3) migration adding entry provenance (`source`) and tracked-show venue/`show_id` binding, plus the `adoptSuggestion`/`bindShow`/`importSnapshot` write helpers and every Phase-5 config tunable + copy string — the shared substrate both Wave-2 UI slices consume.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-13T17:44:00Z
- **Completed:** 2026-07-13T17:50:00Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Additive `this.version(3)` migration: `EntrySource` type, `TrackedEntry.source`, `TrackedShow.venueId/venueName/city`, new `showId`+`source` indexes, and an upgrade callback that backfills `source='manual'` and defaults binding columns to null — v1/v2 data survives untouched.
- Three write helpers for the Wave-2 UIs: `adoptSuggestion` (stamps `source='editor'`, classifies hit/miss with the same Phase-4 `classifyOutcome` rule), `bindShow` (writes the kglw.net binding without altering status/date/set), and `importSnapshot` (commits all four tables in one rw transaction — a mid-write throw rolls the whole import back).
- All Phase-5 numeric tunables (`live`/`ui`/`dataSafety`) and copy strings (`copy.live`/`copy.settings`) added to the single app config file, verbatim from 05-UI-SPEC.
- New `migrationV3.test.ts` (7 tests) proves backfill, v1/v2 preservation, binding-column defaults, editor provenance + outcome, and atomic import rollback.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dexie version(3) additive migration + write helpers** - `9197eae` (feat)
2. **Task 2: Phase-5 config constants + copy strings** - `347e247` (feat)

## Files Created/Modified
- `packages/app/src/db/db.ts` - version(3) migration; `EntrySource` type; `source` on `TrackedEntry`; `venueId/venueName/city` on `TrackedShow`; `logSong` stamps `source='manual'`; `startShow` inits binding nulls; new `adoptSuggestion`/`bindShow`/`importSnapshot` helpers + `ShowBinding`/`AdoptedEntry`/`DbSnapshot` types
- `packages/app/src/config.ts` - `live`/`ui`/`dataSafety` tunable blocks; `copy.live`/`copy.settings` string blocks
- `packages/app/test/migrationV3.test.ts` - fake-indexeddb migration + helper tests (7)
- `packages/app/test/showSession.test.ts` - fixture `hit()` return type now also omits `source` (matches new `logSong` signature)
- `packages/app/test/cometTrail.test.tsx` - fixture entry gains `source: "manual"`
- `packages/app/test/trailNodeSheet.test.tsx` - both fixture entries gain `source: "manual"`

## Decisions Made
- Backfill `source='manual'` in the upgrade callback (not a nullable/optional field) so downstream tally math never sees an undefined provenance (D-03).
- Indexed `showId` (reconciliation) and `source` (provenance filtering) only; the venue binding columns are stored but unindexed — Phase 6 reads them per-row, matching the RESEARCH guidance.
- Kept `importSnapshot` a pure atomic-write seam; the union-merge/dedupe logic (D-11) belongs to the caller in Plan 05-05, so this helper only guarantees all-or-nothing commit.
- Interpolating copy (fill-??? body, import success counts) stored as arrow functions in config to keep sentence structure out of components while satisfying the single-config-file ethos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Backfilled `source` in three existing TrackedEntry test fixtures**
- **Found during:** Task 1 (verification typecheck)
- **Issue:** Making `TrackedEntry.source` a required field broke `tsc` on three pre-existing test fixtures (`cometTrail.test.tsx`, `trailNodeSheet.test.tsx`) that build full `TrackedEntry` literals, and on `showSession.test.ts`'s `hit()` helper whose return type annotated the old `logSong` Omit.
- **Fix:** Added `source: "manual"` to the two component-test fixtures; widened the `showSession` `hit()` Omit to also exclude `"source"` (matching `logSong`'s new signature so the fixture stays source-less by design).
- **Files modified:** `packages/app/test/cometTrail.test.tsx`, `packages/app/test/trailNodeSheet.test.tsx`, `packages/app/test/showSession.test.ts`
- **Verification:** `tsc --noEmit` clean; full app project 88/88 green.
- **Committed in:** `9197eae` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was a direct, in-scope consequence of the required `source` field — no behavior change to the fixtures' assertions, no scope creep.

## Issues Encountered
- The plan's verify command `cd packages/app && npx vitest run test/migrationV3.test.ts` fails in this monorepo — the jsdom + `fake-indexeddb/auto` setup lives in the root `vitest.config.ts` `projects` config, so vitest must run from the repo root. Correct invocation: `npx vitest run --project @guezzer/app packages/app/test/migrationV3.test.ts`. This is a test-harness invocation nuance, not a code issue; the typecheck command (`cd packages/app && npx tsc ...`) works as written. Verified all tests green via the root invocation.

## User Setup Required
None - no external service configuration required. No new dependencies added this phase (T-05-SC vacuously satisfied).

## Next Phase Readiness
- Wave-2 slices (Plan 05-04 live poller / SuggestionStrip, Plan 05-05 export/import + SettingsView) have their persistence substrate: provenance-aware writes, the binding seam, the atomic import commit, and all tunables/copy.
- No blockers. `importSnapshot` is intentionally merge-agnostic — Plan 05-05 must implement the in-memory validate + union-merge + dedupe (D-10/D-11/D-12) before calling it.

## Self-Check

Files:
- FOUND: packages/app/src/db/db.ts (version(3) block present)
- FOUND: packages/app/src/config.ts (live/dataSafety/copy.settings present)
- FOUND: packages/app/test/migrationV3.test.ts

Commits:
- FOUND: 9197eae (Task 1)
- FOUND: 347e247 (Task 2)

## Self-Check: PASSED

---
*Phase: 05-live-sync-data-safety*
*Completed: 2026-07-13*
