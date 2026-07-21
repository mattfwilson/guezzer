---
phase: 15-gizz-bingo-persistence-lock-replay
plan: 02
subsystem: database
tags: [dexie, gizz-bingo, persistence, lock, export-envelope, migration, config]

# Dependency graph
requires:
  - phase: 15-gizz-bingo-persistence-lock-replay
    plan: 01
    provides: "envelope v3 core: bingoCardRow schema, bingoCards on ExportSnapshot + serializeExport passthrough, MIGRATIONS[2], locked-wins union merge"
  - phase: 06-pokedex-history-stats
    provides: "the additive-Dexie-version + stable-key bulkPut + DbSnapshot threading precedents (archiveShows v4)"
provides:
  - "Dexie version(5) additive bingoCards table (&cardId, sessionId) — one card per show (D-07/D-12)"
  - "BingoCardRow interface (frozen core BingoCard + caughtSnapshot + lockedAt + denormalized identity)"
  - "saveDraftCard/lockCard write helpers with the app-side reshuffle-rejection guard (SC-1/D-10)"
  - "bingoCards threaded through DbSnapshot/snapshot()/importSnapshot (union-only bulkPut, D-13)"
  - "app SCHEMA_VERSION = 3 + all Phase-15 copy (copy.games, copy.recap bingo keys, copy.catchUp)"
affects: [15-03-gizzgames-tab-replay, 15-04-catchup, gizz-bingo-replay, data-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive Dexie version(N): new table, no .upgrade, all prior stores untouched — populated DBs upgrade in place losslessly (v4 archiveShows precedent)"
    - "App-side invariant guard at the write boundary (saveDraftCard reshuffle-rejection) — core stays DB-free (RESEARCH Pitfall 5)"
    - "Stable-key bulkPut union-only import (cardId), never clear+rewrite — a local row absent from the snapshot survives"
    - "Dexie transaction array-arity form once table count exceeds the 5-store positional overload"

key-files:
  created:
    - "packages/app/test/bingoLock.test.ts"
    - "packages/app/test/migrationV5.test.ts"
  modified:
    - "packages/app/src/db/db.ts"
    - "packages/app/src/config.ts"
    - "packages/app/test/exportImportRoundtrip.test.ts"
    - "packages/app/test/migrationV3.test.ts"
    - "packages/app/test/retroMark.test.ts"

key-decisions:
  - "cardId == sessionId (D-12 / RESEARCH Pattern 6): one card per show, so a pre-lock reshuffle overwrites the same row in place (the seed lives in card.seed) — no orphaned drafts"
  - "saveDraftCard guards finalized-session AND locked-card app-side (SC-1/D-10); lockCard is a no-op (not a throw) on a card-less session so a card-less Start Show is safe to wire (D-09)"
  - "importSnapshot commits bingoCards via stable-cardId bulkPut union-only (like archiveShows), NEVER the clear+rewrite path used for trackedShows/trackedEntries (D-13)"
  - "Dexie transaction switched to the array-of-stores signature — six tables exceed the positional transaction(mode, ...t5, cb) overload (was a real tsc error, not a style choice)"

patterns-established:
  - "Envelope-v3 app threading mirrors the v4 archiveShows precedent exactly: additive table + DbSnapshot field + snapshot() read + importSnapshot union bulkPut"

requirements-completed: [BINGO-07]

# Metrics
duration: ~8min
completed: 2026-07-20
---

# Phase 15 Plan 02: Gizz-Bingo Persistence (App Threading) Summary

**Landed the app-side persistence for Gizz Bingo: an additive Dexie `version(5)` `bingoCards` table, the `BingoCardRow` shape freezing the pure core `BingoCard` + its `caughtSnapshot`, the `saveDraftCard`/`lockCard` write helpers with the app-side reshuffle-rejection guard, and the `bingoCards` export/import threading — plus `SCHEMA_VERSION = 3` and every Phase-15 copy string. Closes the 4 expected app-`tsc` errors 15-01 left open.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3 (all TDD RED→GREEN)
- **Files:** 2 created, 5 modified
- **Tests:** 704 passing across both projects (was 692 in 15-01; +12 net new)

## Accomplishments
- **version(5) additive table** — `this.version(5).stores({ bingoCards: "&cardId, sessionId" })` appended after v4, no `.upgrade`. A populated v4 DB (meta/attendedShows/archiveShows/trackedShows/trackedEntries all seeded) upgrades in place to verno 5, every prior table intact, `bingoCards` present and empty (T-15-04 / SC-4, proven by migrationV5.test.ts).
- **`BingoCardRow`** — wraps the core `BingoCard` under `card:` (embedding the frozen `squares`, D-08), with the REQUIRED `caughtSnapshot: number[]` freeze (RESEARCH Pitfall 1), `lockedAt: number | null`, and denormalized `showDate`/`venueName`/`city` (D-11). Keyed by `cardId == sessionId` (D-12).
- **`saveDraftCard`** — writes an unlocked draft (`lockedAt: null`, `caughtSnapshot: []`); a reshuffle with a new seed overwrites the same row in place. Throws on a finalized session or an already-locked card (SC-1/D-10) — the invariant lives app-side, core stays DB-free (RESEARCH Pitfall 5, T-15-06).
- **`lockCard`** — stamps `lockedAt` + freezes `caughtSnapshot`; idempotent (first freeze wins); a no-op (not a throw) on a card-less session so a card-less Start Show is safe to wire (D-09).
- **Export/import threading** — `bingoCards` added to `DbSnapshot`, read in `snapshot()`, committed in `importSnapshot` via a stable-`cardId` `bulkPut` union-only upsert (a local card absent from the snapshot survives; a same-`cardId` row is overwritten, D-13 / T-15-05). `exportDownload.ts`/`importPicker.ts` thread it with zero edits (they forward the whole snapshot).
- **`SCHEMA_VERSION = 3`** + all Phase-15 copy in the single config file: `copy.recap` bingo keys (heading, win labels, `litBy`, free, lock explainer), a `copy.games` teaser+empty-state block, and a `copy.catchUp` block. A v3 backup round-trips; a v2 backup (no `bingoCards` key) still imports via `.default([])` + `MIGRATIONS[2]`.
- **App `tsc --noEmit` is now clean** — the 4 expected errors from 15-01 (`DbSnapshot` missing `bingoCards` in `exportDownload.ts`/`importPicker.ts` + 2 test fixtures) are resolved by the threading.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: BingoCardRow + version(5) + saveDraftCard/lockCard/guard**
   - `5c6ce53` (test — RED)
   - `94fcd94` (feat — GREEN)
2. **Task 2: DbSnapshot/snapshot/importSnapshot threading + v4→v5 migration test**
   - `22e1871` (test — RED)
   - `55e4823` (feat — GREEN, includes the transaction array-arity fix + stale-fixture updates)
3. **Task 3: SCHEMA_VERSION 3 + Phase-15 copy + round-trip test**
   - `063c330` (test — RED)
   - `a0be544` (feat — GREEN)

**Post-task fix:** `d09e952` (test — stale verno 4→5 assertion in retroMark.test.ts).

## Files Created/Modified
- `packages/app/src/db/db.ts` — `BingoCardRow` interface; `bingoCards` table field + `version(5)` block; `DraftCardInput`; `saveDraftCard`/`lockCard` helpers; `bingoCards` on `DbSnapshot`, in `snapshot()`, and in `importSnapshot` (array-arity transaction + union `bulkPut`).
- `packages/app/src/config.ts` — `SCHEMA_VERSION` 2→3; `copy.recap` bingo keys; new `copy.games` + `copy.catchUp` blocks.
- `packages/app/test/bingoLock.test.ts` *(new)* — six write-helper behaviors.
- `packages/app/test/migrationV5.test.ts` *(new)* — v4→v5 additive upgrade + snapshot/import threading (3 cases).
- `packages/app/test/exportImportRoundtrip.test.ts` — envelope-v3 bingoCards round-trip + v2-import back-compat; two pre-existing `serializeExport` fixtures gain `bingoCards: []`; the "schemaVersion 2" assertion generalized to `config.dataSafety.SCHEMA_VERSION`.
- `packages/app/test/migrationV3.test.ts` — two `DbSnapshot` fixtures gain `bingoCards: []`; verno assertion 4→5.
- `packages/app/test/retroMark.test.ts` — DB-open verno assertion 4→5.

## Decisions Made
- **`cardId == sessionId` (D-12 / RESEARCH Pattern 6)** — one card per show (D-07), so a pre-lock reshuffle is an in-place overwrite (the seed lives in `card.seed`), never an orphaned draft.
- **Guard is app-side** (RESEARCH Pitfall 5) — `saveDraftCard` throws on finalized/locked; `packages/core` stays DB-free. `lockCard` is a no-op on a card-less session so the Phase-16 Start-Show trigger can call it unconditionally (D-09).
- **Union-only `bulkPut` for bingoCards** — a stable `cardId` means the import never needs the destructive clear+rewrite path (that path exists only for `trackedShows`/`trackedEntries` whose merge can legitimately drop rows, D-13).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dexie `transaction` array-arity form for six tables**
- **Found during:** Task 2 (adding `db.bingoCards` to the `importSnapshot` transaction)
- **Issue:** `db.transaction("rw", ...6 tables, cb)` exceeds Dexie's positional overload (max 5 stores), producing `TS2554: Expected 3-7 arguments, but got 8`.
- **Fix:** Passed the six stores as an array (`db.transaction("rw", [t1..t6], cb)`) — same single atomic rw transaction, just the array-arity signature.
- **Files modified:** packages/app/src/db/db.ts
- **Verification:** app `tsc --noEmit` exit 0; migrationV5 + roundtrip tests green.
- **Committed in:** `55e4823`

**2. [Rule 3 - Blocking] Update stale `DbSnapshot`/`ExportSnapshot` test fixtures for the required `bingoCards` field**
- **Found during:** Task 2 (making `bingoCards` required on `DbSnapshot`)
- **Issue:** Four pre-existing test literals (2 in migrationV3.test.ts, 2 `serializeExport` calls in exportImportRoundtrip.test.ts) lacked the now-required `bingoCards` field → tsc errors.
- **Fix:** Added `bingoCards: []` to each literal.
- **Files modified:** packages/app/test/migrationV3.test.ts, packages/app/test/exportImportRoundtrip.test.ts
- **Committed in:** `55e4823` (roundtrip fixtures) and `55e4823` (migrationV3 fixtures)

**3. [Rule 3 - Blocking] Stale `db.verno` assertions after additive version(5)**
- **Found during:** Task 2 (migrationV3) and the full-suite gate (retroMark)
- **Issue:** Adding `version(5)` bumped the real DB's `verno` 4→5; two pre-existing DB-open tests asserted `verno === 4`.
- **Fix:** Updated both assertions to `5` with an explanatory comment (the additive table is why).
- **Files modified:** packages/app/test/migrationV3.test.ts, packages/app/test/retroMark.test.ts
- **Committed in:** `55e4823` (migrationV3) and `d09e952` (retroMark)

---

**Total deviations:** 3 auto-fixed (all Rule 3 blocking). All were mechanical consequences of the additive version(5) + the required `bingoCards` field — no scope creep, no design change. The reshuffle-rejection guard and union merge direction are the plan's own instructions, not deviations.

## Known Stubs
None. `saveDraftCard`/`lockCard` are fully-functional write helpers (fixture-tested), not stubs — the Phase-16 note is only about the UI *trigger* that will CALL them, which is out of this plan's scope by design (CONTEXT sequencing). No hardcoded empty data flows to any UI.

## Issues Encountered
None beyond the three mechanical Rule-3 fixes above.

## Verification
- `npx vitest run packages/app/test/bingoLock.test.ts` → **6 passed**.
- `npx vitest run packages/app/test/migrationV5.test.ts` → **3 passed**.
- `npx vitest run packages/app/test/exportImportRoundtrip.test.ts` → **14 passed**.
- `npx vitest run` (both projects) → **704 passed / 87 files**.
- `npx tsc --noEmit -p packages/app/tsconfig.json` → **clean (exit 0)** — the 4 expected 15-01 errors resolved.
- `npx tsc --noEmit -p packages/core/tsconfig.json` → **clean (exit 0)**.

## TDD Gate Compliance
All three tasks show the RED (`test(...)`) → GREEN (`feat(...)`) commit sequence in git log. No test passed unexpectedly during RED (each RED run failed on the missing helper/field/version before implementation).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Persistence + lock machinery is ready. Plan 15-03 (GizzGames tab + replay) consumes `db.bingoCards` (`useLiveQuery`), `config.copy.games.*`, and `config.copy.recap` bingo keys read-only. Plan 15-04 (catch-up) consumes `config.copy.catchUp.*`.
- Phase 16 wires the real Start-Show/deal trigger that calls `saveDraftCard`/`lockCard` — the helpers already fire correctly for real once a card is dealt.
- No blockers.

## Self-Check: PASSED

- FOUND: packages/app/test/bingoLock.test.ts
- FOUND: packages/app/test/migrationV5.test.ts
- FOUND: packages/app/src/db/db.ts (`BingoCardRow`, `version(5)`, `saveDraftCard`, `lockCard`)
- FOUND: packages/app/src/config.ts (`SCHEMA_VERSION: 3`, `copy.games`, `copy.catchUp`, recap bingo keys)
- FOUND: .planning/phases/15-gizz-bingo-persistence-lock-replay/15-02-SUMMARY.md
- FOUND commits: 5c6ce53, 94fcd94, 22e1871, 55e4823, 063c330, a0be544, d09e952
