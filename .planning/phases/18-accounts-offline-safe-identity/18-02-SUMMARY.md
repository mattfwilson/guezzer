---
phase: 18-accounts-offline-safe-identity
plan: 02
subsystem: database
tags: [dexie, indexeddb, migration, userId, namespacing, auth, multi-user]

# Dependency graph
requires:
  - phase: 06-pokedex
    provides: the 5 domain tables (attendedShows, archiveShows, trackedShows, trackedEntries, bingoCards) + snapshot/importSnapshot
  - phase: 15-bingo-persistence
    provides: bingoCards table + envelope v3 (last additive Dexie version, version(5))
provides:
  - "Dexie version(7): additive userId index on the 5 domain tables (attendedShows, archiveShows, trackedShows, trackedEntries, bingoCards)"
  - "userId?: string field on the 5 domain row interfaces (the substrate every scoped read/export in Plans 06/07 builds on)"
  - "claimLegacyDexOnce(userId): meta-gated exactly-once first-login legacy-row stamp (dexClaimedBy gate)"
affects: [18-06 (useDexStats read-scoping), 18-07 (view consumers + export/import scoping), 18-03 (identity accessor), 19-shared-dex-progress]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive Dexie version bump: re-declare each store's full index string to append a new index; adding an index re-indexes structurally with NO .upgrade() data transform"
    - "App-side meta-gated exactly-once claim (dexClaimedBy) — never in the Dexie upgrade hook (Pitfall 2: userId unknown at DB-open)"

key-files:
  created:
    - packages/app/src/auth/claimDex.ts
    - packages/app/test/migrationV7.test.ts
  modified:
    - packages/app/src/db/db.ts
    - packages/app/test/migrationV5.test.ts
    - packages/app/test/migrationV3.test.ts
    - packages/app/test/map/dbV5.test.ts
    - packages/app/test/retroMark.test.ts

key-decisions:
  - "version(7) adds userId as an INDEX (not just a field) so Plans 06/07 can scope reads via .where('userId'); index add needs no .upgrade() data hook"
  - "The legacy-row claim lives in app code at first sign-in, gated by a dexClaimedBy meta flag — NOT in version(7).upgrade() (the userId is unknown at DB-open, Pitfall 2)"
  - "Accepted the &show_id PK-collision limitation on attendedShows/archiveShows (two identities marking the same show on one device interfere) — documented in db.ts per D-09, out of scope for v2.0 (Pitfall 4 / T-18-02-I2)"
  - "claimLegacyDexOnce uses the array-arity db.transaction (6 stores > Dexie's 5-store positional overload) and views the 5 heterogeneous domain tables through a shared { userId?: string } shape for one stamping loop"

patterns-established:
  - "Additive Dexie namespacing: append userId to each store index string in a new version() block; never rewrite prior versions or change DB_NAME"
  - "Exactly-once meta-gated batch stamp: getMeta gate -> single rw transaction (all tables + meta) -> toCollection().modify fills only undefined -> setMeta gate"

requirements-completed: [AUTH-05]

# Metrics
duration: 5min
completed: 2026-07-22
---

# Phase 18 Plan 02: Dex Namespacing + First-Login Claim Summary

**Dexie version(7) adds an additive `userId` index to the 5 domain tables, and `claimLegacyDexOnce` stamps the pre-existing single-user dex to the first signer exactly once via a `dexClaimedBy` meta gate — the local-data-isolation substrate every scoped read/export in Plans 06/07 depends on.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-22T21:19:57Z
- **Completed:** 2026-07-22T21:25:19Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Additive Dexie `version(7)` adds a `userId` index to `attendedShows`, `archiveShows`, `trackedShows`, `trackedEntries`, `bingoCards` — every v1–v6 row survives the re-index (proven by the migration-preservation test).
- `userId?: string` field added to the 5 domain row interfaces (optional so legacy untagged rows and the upgrade both typecheck; undefined until claimed).
- `claimLegacyDexOnce(userId)` stamps all untagged rows across the 5 tables exactly once in a single atomic rw transaction, gated by the `dexClaimedBy` meta flag; a second login with a different userId is a no-op and pre-tagged rows are never re-owned.
- The `snapshot()`/`importSnapshot()` signatures were deliberately left unchanged (their `userId`-scoping is Plan 07, which needs Plan 03's identity accessor) — keeping this Wave-1 plan's `tsc --noEmit` gate green.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing version(7) migration-preservation test** - `30c3b0c` (test)
2. **Task 1 (GREEN): version(7) userId-index namespacing + interface fields** - `234833f` (feat)
3. **Task 2 (RED): failing claimLegacyDexOnce exactly-once claim tests** - `8108381` (test)
4. **Task 2 (GREEN): claimLegacyDexOnce meta-gated claim** - `003c5a4` (feat)

## Files Created/Modified
- `packages/app/src/db/db.ts` - version(7) additive `userId`-index block on the 5 domain stores + `userId?` field on the 5 row interfaces; documents the accepted `&show_id` PK-collision limitation (Pitfall 4).
- `packages/app/src/auth/claimDex.ts` - NEW `claimLegacyDexOnce(userId)`: meta-gated (`dexClaimedBy`) exactly-once legacy-row stamp in a single array-arity rw transaction.
- `packages/app/test/migrationV7.test.ts` - NEW additive-upgrade preservation test (verno===7, all prior rows survive, pre-claim `userId===undefined`) + claim-once regression tests.
- `packages/app/test/migrationV5.test.ts` / `migrationV3.test.ts` / `map/dbV5.test.ts` / `retroMark.test.ts` - updated stale max-verno assertions (`6`→`7`) after the additive bump (see Deviations).

## Decisions Made
- Followed the plan's PATTERNS idiom exactly for both the `version(7)` block and the claim shape. Two implementation-level adaptations were required to pass the `tsc` gate (see Issues): the array-arity `db.transaction` (6 stores exceed Dexie's 5-store positional overload) and a `{ userId?: string }` view over the heterogeneous domain tables so one `modify` loop typechecks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated stale max-verno assertions in four prior migration tests**
- **Found during:** Task 1 (version(7) GREEN)
- **Issue:** `migrationV3.test.ts`, `migrationV5.test.ts`, `map/dbV5.test.ts`, and `retroMark.test.ts` each hard-code `expect(db.verno).toBe(6)` when opening the real schema. The additive `version(7)` bump legitimately changes the DB's max version to 7, breaking those stale assertions — this blocked the plan's acceptance criterion "`migrationV5.test.ts` exits 0" and the full-suite `npm test` gate.
- **Fix:** Updated each stale assertion (and its explanatory comment) from `6` to `7`. No migration behavior was changed — the assertions only track the current max version; the v3/v5 upgrade logic and data-preservation checks are untouched.
- **Files modified:** `packages/app/test/migrationV5.test.ts`, `packages/app/test/migrationV3.test.ts`, `packages/app/test/map/dbV5.test.ts`, `packages/app/test/retroMark.test.ts`
- **Verification:** All four files green; full suite 789 passed.
- **Committed in:** `234833f` (Task 1 GREEN commit; the two test-only files `dbV5`/`retroMark` also ride there)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The verno-assertion updates are a direct, in-scope consequence of the additive version bump — no scope creep, no behavior change. All prior migration logic preserved.

## Issues Encountered
- **tsc typing on the claim transaction (resolved during Task 2 GREEN):** The first draft used the positional `db.transaction("rw", ...7args, cb)` form (8 args) which exceeds Dexie's 5-store positional overload, and iterating the 5 differently-typed tables produced a non-callable `modify` union. Fixed by (a) passing the stores as an array (mirroring `importSnapshot` in `db.ts`) and (b) casting the table list to `Table<{ userId?: string }>[]` so one loop stamps all five. tsc clean afterward.

## User Setup Required
None - no external service configuration required. No npm packages added (RESEARCH Package Legitimacy Audit: none for this plan).

## Next Phase Readiness
- The `userId` field/index and the `dexClaimedBy` claim are in place — Plan 06 (`useDexStats` read-scoping) and Plan 07 (view consumers + export/import scoping, `depends_on: [02, 03]`) can build on them where the current userId is available at the call site.
- `snapshot()`/`importSnapshot()` remain unscoped by design — Plan 07 Task 2 adds the `userId` param + stamps imported rows once Plan 03's `readIdentityRecord()` exists.
- No blockers. `claimLegacyDexOnce` is not yet wired to a sign-in trigger; that wiring lands with the auth flow in a later Plan (the claim function is the reusable primitive).

## Verification
- `npx vitest run packages/app/test/migrationV7.test.ts` — 5 passed (migration preservation + claim-once)
- `npx vitest run packages/app/test/migrationV5.test.ts` / `migrationV3.test.ts` — green (no additive-discipline regression)
- `npx vitest run packages/app/test/exportImportRoundtrip.test.ts` — green (snapshot/import signatures unchanged)
- `npm test` — 103 files, 789 tests passed
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean (exit 0)

---
*Phase: 18-accounts-offline-safe-identity*
*Completed: 2026-07-22*
