---
phase: 04-show-mode
plan: 01
subsystem: database
tags: [dexie, indexeddb, react, typescript, persistence, config]

# Dependency graph
requires:
  - phase: 03-app-shell-pwa-foundation
    provides: Dexie v1 schema (meta + attendedShows), fake-indexeddb test wiring, app config idiom
  - phase: 02-transition-matrix-model-backtest
    provides: core SetNumber union ("1"|"2"|"e") mirrored by the persistence schema
provides:
  - Dexie version(2) additive schema — trackedShows + trackedEntries (v1 untouched)
  - Tracked-show/entry row types + unions (TrackedShow, TrackedEntry, ShowStatus, SetNumber, EntryOutcome)
  - Write helpers — startShow, getActiveShow, logSong, undoLast, markSetBreak, markEncore, renameEntry, endShow
  - config.show tunables (seven UI-SPEC keys) + config.copy.show strings
  - Pure scoring helpers — classifyOutcome (hit-if-in-fan) + deriveTally (combined X/Y/pct)
affects: [04-06-actionbar-wiring, 04-04-showview-layout, 04-03-predictions, 04-02-orbit-stage, phase-05-live-sync-export, phase-06-pokedex]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive Dexie version(2) migration — never rewrite version(1); tables carry forward automatically"
    - "Tracked-show row doubles as the provisional attendance record (no separate table, D-02/DEX-01)"
    - "logSong snapshots setNumber from the show's currentSetNumber (true set-structure snapshot, SHOW-06)"
    - "Pure app-side scoring helpers importing only db.ts types (zero Dexie/DOM runtime dependency)"

key-files:
  created:
    - packages/app/src/show/scoring.ts
    - packages/app/test/showSession.test.ts
    - packages/app/test/tally.test.ts
  modified:
    - packages/app/src/db/db.ts
    - packages/app/src/config.ts

key-decisions:
  - "logSong stamps setNumber from the show's currentSetNumber rather than accepting it from the caller — gives true snapshot semantics and prevents set-number drift"
  - "Single provisional-attendance store: the trackedShows row itself IS the dex credit (D-02/D-05), no separate attendance table"
  - "SetNumber re-declared in db.ts (not imported from core) to keep the persistence schema free of a core type dependency; the closed vocabulary is stable"

patterns-established:
  - "Additive version(2).stores() after an untouched version(1) block (v1-intact acceptance criterion)"
  - "Module-level async write helpers wrapping db.transaction('rw', …), mirroring setMeta/getMeta"
  - "Test it-names carry literal filter substrings (write-through, restore, set-structure, undo, attendance) so both broad -t filters and granular VALIDATION bindings resolve"

requirements-completed: [SHOW-11, SHOW-06, SHOW-07, SHOW-09, SHOW-03, DEX-01]

# Metrics
duration: 5min
completed: 2026-07-09
---

# Phase 4 Plan 01: Show Mode Persistence & Scoring Substrate Summary

**Additive Dexie version(2) tracked-setlist schema with crash-proof write-through helpers (start/log/undo/set-break/encore/rename/end), the tracked-show row as provisional dex credit, plus config.show/copy.show tunables and pure hit/miss + tally derivation — all Node-testable under fake-indexeddb with zero UI.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-09T12:04:46Z
- **Completed:** 2026-07-09T12:09:34Z
- **Tasks:** 2
- **Files modified:** 5 (2 modified, 3 created)

## Accomplishments

- Grew the Dexie schema to `version(2)` additively — `trackedShows` (`&sessionId, status, date`) + `trackedEntries` (`++id, sessionId, [sessionId+position]`) — with `version(1)` (`meta`/`attendedShows`) left byte-for-byte intact.
- Delivered the eight write helpers the whole Show Mode loop writes through to, with the two show-#1 invariants proven under `fake-indexeddb`: crash-proof write-through (SHOW-11) and provisional dex credit as the tracked-show row itself (DEX-01/D-02).
- Enforced the single-active invariant (`startShow` rejects while a show is active, D-03) and set-structure snapshotting (`markSetBreak`→"2"/`markEncore`→"e", entries snapshot the current set, SHOW-06) without altering show status (D-04).
- Populated `config.show` (seven UI-SPEC tunables) and `config.copy.show` (every Show-Mode string verbatim), and shipped the pure `classifyOutcome`/`deriveTally` helpers with honest hit-if-in-fan semantics (D-06/D-08) and a null-pct zero-state (D-07).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing showSession suite** - `6a7051c` (test)
2. **Task 1 (GREEN): version(2) schema + write helpers** - `bc882ba` (feat)
3. **Task 2: config.show/copy.show + pure scoring helpers + tally suite** - `b9f5f43` (feat)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP.

_Task 1 was TDD (test → feat); Task 2 shipped implementation + tests in one commit._

## Files Created/Modified

- `packages/app/src/db/db.ts` - MODIFIED: added `version(2)` tables + field declarations, row types/unions (`TrackedShow`, `TrackedEntry`, `ShowStatus`, `SetNumber`, `EntryOutcome`), and eight async write helpers. `version(1)` untouched.
- `packages/app/src/config.ts` - MODIFIED: added `config.show` (seven tunables) and `config.copy.show` (all Show-Mode copy verbatim, incl. destructive-dialog strings).
- `packages/app/src/show/scoring.ts` - CREATED: pure `classifyOutcome` + `deriveTally` helpers, zero DOM, importing only db.ts types.
- `packages/app/test/showSession.test.ts` - CREATED: 10 cases — write-through, restore/single-active, set-structure, undo, rename, attendance.
- `packages/app/test/tally.test.ts` - CREATED: 10 cases — hit/miss classification, tally math/rounding, zero-state, config surface.

## Decisions Made

- **logSong stamps setNumber from the show row** (not from the caller). RESEARCH Pattern 5's signature included `setNumber` in the entry, but stamping from `currentSetNumber` gives true "snapshot" semantics per SHOW-06 and removes a way for callers to desync the set structure. `logSong`'s param is therefore `Omit<TrackedEntry, "id"|"sessionId"|"position"|"setNumber">`.
- **The trackedShows row is the sole provisional-attendance store** (D-02/D-05) — no separate table, keeping the schema lean; reconciliation to a canonical `show_id` is the deferred Phase 5/6 seam (`showId` always null here).
- **SetNumber re-declared locally** in db.ts with a comment pointing at `packages/core/src/domain/types.ts:48`, rather than importing core, to keep the app persistence layer free of a core type dependency (the closed `"1"|"2"|"e"` vocabulary is census-stable).

## Deviations from Plan

None — plan executed as written. One naming refinement was required to satisfy the plan's own acceptance criterion: the `-t "tally"` filter must cover classification + math + zero-state, so the `classifyOutcome` and config describe blocks were named to include the literal substring "tally" (the plan mandates filter-resolvable names). This is compliance with the stated acceptance criterion, not a scope change.

## Issues Encountered

- Initial `-t "tally"` run selected only the `deriveTally` describe (4 tests) because the classification/config describes lacked the "tally" substring. Renamed those describes so the filter selects all 10 — matching the acceptance criterion that the filter cover classification + tally math + zero-state.

## User Setup Required

None - no external service configuration required (Phase 4 is fully offline; no network, no new dependencies installed).

## Next Phase Readiness

- The persistence + scoring substrate is complete and the source of truth every later Show Mode slice reads: `getActiveShow`/`useLiveQuery` restore (04-04 ShowView), `logSong`/`undoLast`/set-structure (04-06 ActionBar wiring), `deriveTally` (TallyReadout), `classifyOutcome` + `shownFanSongIds` (orbit tap logging).
- No component/UI code was introduced (per plan scope). The `show/scoring.ts` + `config.show` surface is ready for the orbit-layout and predictions plans to consume.
- Full app suite green (39 tests, 7 files) and `tsc --noEmit` clean for `@guezzer/app`. `version(1)` verified intact.

## Self-Check: PASSED

- FOUND: packages/app/src/db/db.ts (version(2) + helpers)
- FOUND: packages/app/src/config.ts (config.show + copy.show)
- FOUND: packages/app/src/show/scoring.ts
- FOUND: packages/app/test/showSession.test.ts
- FOUND: packages/app/test/tally.test.ts
- FOUND commit: 6a7051c (test), bc882ba (feat), b9f5f43 (feat)

---
*Phase: 04-show-mode*
*Completed: 2026-07-09*
