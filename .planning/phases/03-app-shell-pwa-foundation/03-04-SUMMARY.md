---
phase: 03-app-shell-pwa-foundation
plan: 04
subsystem: database
tags: [dexie, indexeddb, storage-persist, pwa, vitest, fake-indexeddb]

# Dependency graph
requires:
  - phase: 03-app-shell-pwa-foundation
    provides: "Vite/React app shell, config.ts single-source constants, App.tsx composition root with a commented Plan-04 mount seam (Plan 01)"
provides:
  - "Real Dexie v1 IndexedDB database (GuezzerDB): meta settings table + attendedShows stub table keyed by the stable 10-digit show_id"
  - "setMeta/getMeta typed helpers for reading/writing arbitrary settings, including persistStatus"
  - "requestPersistenceOnce(): idempotent, silent-on-denial navigator.storage.persist() request wired into App.tsx on mount + first pointerdown"
  - "Additive-migration-ready v1 schema (version(2+) pattern documented) for Phase 4+ tables"
affects: ["Phase 4 (Show Mode) - attendedShows/meta grow via version(2+)", "Phase 5 (JSON export/import) - reads persistStatus for the export nudge", "Phase 6 (Pokédex) - attendedShows is the derivation source"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dexie subclass (GuezzerDB) constructed from config.DB_NAME, version(1).stores() only declares the initial shape; later versions declare only changed/new tables"
    - "Storage-API calls wrapped in try/catch with a guarded recovery write, so requestPersistenceOnce() is a true never-throws contract even if the fallback setMeta write itself fails"
    - "App.tsx fires a side-effecting async call on mount AND on a one-time first pointerdown listener, relying on the callee's own idempotency rather than component state to dedupe"

key-files:
  created:
    - packages/app/src/db/db.ts
    - packages/app/src/pwa/persist.ts
    - packages/app/test/db.test.ts
    - packages/app/test/persist.test.ts
  modified:
    - packages/app/src/App.tsx

key-decisions:
  - "requestPersistenceOnce() catches Storage-API rejections and records 'best-effort' as the recovery status (rather than leaving persistStatus unset), so a later phase's export-nudge read always sees a defined value"
  - "Fired the persistence request from both component mount and a one-time first-interaction (pointerdown) listener per RESEARCH Open Question 3, since some platforms only grant persistence after user engagement; safe because the function is idempotent"

patterns-established:
  - "Pattern: db/db.ts is the single Dexie entry point (singleton `db` export) — later phases add tables via `this.version(2).stores({...})` inside the GuezzerDB constructor, never by re-declaring version(1)"

requirements-completed: [PWA-03]

# Metrics
duration: 25min
completed: 2026-07-09
---

# Phase 3 Plan 4: Data Foundation (IndexedDB + Persistence Request) Summary

**Dexie v1 IndexedDB database (`meta` + `attendedShows` keyed by the stable 10-digit show_id) with a genuine put/get round-trip test, plus a silent, status-recorded, never-throwing `navigator.storage.persist()` request wired early into App.tsx.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified/created:** 5 (4 created, 1 modified)

## Accomplishments
- A real Dexie v1 database (`GuezzerDB`) exists with typed `meta` and `attendedShows` tables, keyed by the stable 10-digit `show_id` that mirrors core's `NormalizedShow.showId`
- A domain write (`attendedShows` put→get) round-trips under `fake-indexeddb`, proving the personal-data-survives-relaunch foundation
- `requestPersistenceOnce()` requests eviction-resistant storage early, records `persistStatus` (`'persisted' | 'best-effort' | 'unsupported'`) to `meta`, is idempotent, and never throws — verified across all three outcome paths plus the idempotent-short-circuit path
- `npm test` — 114/114 tests pass across 14 files (107 pre-existing + 3 new in `db.test.ts` + 4 new in `persist.test.ts`, no regressions); `npm run build -w @guezzer/app` succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Dexie v1 schema + meta helpers + round-trip test** - `81f3c2c` (feat)
2. **Task 2: requestPersistenceOnce (silent, status-recorded) + wire early in App + test** - `601d477` (feat)

## Files Created/Modified
- `packages/app/src/db/db.ts` - `GuezzerDB` Dexie subclass, singleton `db`, `setMeta`/`getMeta`, `MetaRow`/`AttendedShow` types, `version(1).stores({ meta: '&key', attendedShows: '&show_id, showDate' })` with an additive-migration comment for Phase 4+
- `packages/app/src/pwa/persist.ts` - `requestPersistenceOnce()`: unsupported/already-persisted/persist() branches, all wrapped so the function never throws
- `packages/app/src/App.tsx` - invokes `requestPersistenceOnce()` on mount and once more on the first `pointerdown`; removed the now-fulfilled Plan-04 seam comment (Plan-03's `<UpdateToast/>` seam is untouched)
- `packages/app/test/db.test.ts` - `attendedShows` put→get round-trip by `show_id`; `setMeta`/`getMeta` round-trip; undefined-on-missing-key case
- `packages/app/test/persist.test.ts` - persisted / best-effort / unsupported / idempotent-already-persisted cases, each asserting no throw

## Decisions Made
- Wrapped the denial-recovery `setMeta` write in its own nested `try/catch` inside `requestPersistenceOnce()`'s outer `catch` block, so a failing IndexedDB write during the fallback path cannot violate the function's never-throws contract (defense-in-depth beyond what the plan's action text spelled out, still within D-09's "never throw" acceptance criterion).
- Kept the persistence trigger scoped entirely to `App.tsx` per the plan's constraint — no changes to `BottomTabBar` or `InstallBanner`.

## Deviations from Plan

None - plan executed exactly as written. The extra nested try/catch in `persist.ts` is a strict-superset defensive measure within the plan's own "must never throw" acceptance criterion, not a scope change.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. `dexie`/`dexie-react-hooks` were already installed as part of Plan 01's dependency set; no new packages were added in this plan.

## Next Phase Readiness
- `packages/app/src/db/db.ts` is ready for Phase 4 to grow via `this.version(2).stores({...})` (e.g. a `trackedShows` table for the live setlist trail) without touching the `version(1)` declaration.
- `persistStatus` is recorded in `meta` and ready for Phase 5 to read for the JSON-export nudge (D-09) — no UI reads it yet, as specified (Phase 3 records silently only).
- Manual on-device verification (install → write attendedShows/meta → force-quit → relaunch → confirm row present) was **not** run in this automated execution — it is an owner-run gate per the plan's `<verification>` section, to be piggybacked onto the Phase 4 iOS device spike already noted in STATE.md.
- No blockers for Phase 4.

---
*Phase: 03-app-shell-pwa-foundation*
*Completed: 2026-07-09*

## Self-Check: PASSED
