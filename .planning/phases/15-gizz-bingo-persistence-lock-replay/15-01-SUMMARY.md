---
phase: 15-gizz-bingo-persistence-lock-replay
plan: 01
subsystem: database
tags: [zod, export-envelope, data-safety, gizz-bingo, merge, migration]

# Dependency graph
requires:
  - phase: 14-gizz-bingo-core-marking-generation
    provides: "the shipped, frozen bingoCardSchema (z.discriminatedUnion on squares) + BingoCard contract"
  - phase: 06-pokedex-history-stats
    provides: "the versioned export envelope (archiveShowRow, .default([]) back-compat, MIGRATIONS chain)"
provides:
  - "envelope v3: bingoCardRow strict-zod schema nesting bingoCardSchema verbatim"
  - "bingoCards field on the export envelope with .default([]) pre-v3 back-compat"
  - "bingoCards on ExportSnapshot + verbatim serializeExport passthrough (stable cardId, no id-strip)"
  - "MIGRATIONS[2] v2->v3 normalizer"
  - "bingoCards union merge with the locked-wins-then-imported-wins collision rule (D-13 Open-Q1 resolution)"
affects: [15-02-bingo-persistence-app-threading, 15-03, 15-04, gizz-bingo-replay, data-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Versioned-envelope extension: strict row schema + .default([]) field + MIGRATIONS[n] + serialize passthrough + union merge (five coordinated edits)"
    - "Nested-schema reuse: nest the shipped bingoCardSchema under card: so the discriminated union validates the card verbatim at the import trust boundary"
    - "Explicit collision resolution over blind local-wins: locked row wins, else incoming wins"

key-files:
  created: []
  modified:
    - "packages/core/src/data-safety/export-schema.ts"
    - "packages/core/src/data-safety/serialize.ts"
    - "packages/core/src/data-safety/merge.ts"
    - "packages/core/test/merge.test.ts"
    - "packages/core/test/serialize.test.ts"

key-decisions:
  - "D-13 contradiction (Open Q1) resolved as a locked, tested rule: on a same-cardId collision the LOCKED row wins (never revert a locked card to a draft); when both share lock-state the INCOMING row wins per D-13's literal first clause"
  - "caughtSnapshot kept REQUIRED on bingoCardRow (RESEARCH Pitfall 1) despite CONTEXT D-11 omitting it — the frozen catch-set is what the replay fold reads for neverCaught"
  - "bingoCardRow nests the pure BingoCard under card: and reuses bingoCardSchema verbatim (RESEARCH Pattern 2) rather than re-declaring the discriminated union"
  - "Defensive `?? []` on local/incoming bingoCards in the merge decouples core from the app-threading order (15-02) so the full suite never crashes on a pre-v3 in-memory snapshot"

patterns-established:
  - "Envelope v3 extension mirrors the v2 archiveShows precedent exactly, inverting only the collision direction"

requirements-completed: [BINGO-07]

# Metrics
duration: ~12min
completed: 2026-07-20
---

# Phase 15 Plan 01: Gizz-Bingo Persistence (Envelope v3 Core) Summary

**Envelope-v3 core schema + merge: a `bingoCardRow` strict-zod schema nesting the shipped `bingoCardSchema`, the `bingoCards` field with `.default([])` back-compat, `MIGRATIONS[2]`, and a `bingoCards` union merge whose locked-wins collision rule keeps a locked historical card from ever reverting to a draft.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-21T01:04Z
- **Completed:** 2026-07-21T01:16Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5

## Accomplishments
- `bingoCardRow` (`z.strictObject`) nests the frozen `bingoCardSchema` under `card:`, so an unknown square `kind` or a leaked extra key hard-fails at the import trust boundary (T-15-01). `caughtSnapshot` is required; no enum widened.
- `bingoCards: z.array(bingoCardRow).default([])` on the envelope, so a genuine v2 backup lacking the key still parses (D-14).
- `bingoCards` threaded onto `ExportSnapshot` and passed through `serializeExport` verbatim (no id-strip — `cardId` is a stable PK, unlike `trackedEntries`' volatile `++id`).
- `MIGRATIONS[2]` registered (mandatory — the migration loop errors "too old" if a step's entry is missing) plus a `bingoCards` union merge whose collision direction resolves the D-13 contradiction explicitly.
- A locked card survives a same-`cardId` import collision; a v3 backup round-trips through serialize → parse → merge unchanged; a pre-v3 backup imports with `bingoCards` defaulting to `[]`.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: bingoCardRow schema + envelope v3 field + serialize passthrough**
   - `8c636aa` (test — RED)
   - `1545c1d` (feat — GREEN, includes in-scope serialize.test v2→v3 shape update)
2. **Task 2: MIGRATIONS[2] + bingoCards union merge (locked-wins collision)**
   - `ae6b19f` (test — RED)
   - `2dcbd47` (feat — GREEN)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP commit)

## Files Created/Modified
- `packages/core/src/data-safety/export-schema.ts` — added `bingoCardRow` strictObject (nests `bingoCardSchema`), `bingoCards: z.array(bingoCardRow).default([])` on the envelope.
- `packages/core/src/data-safety/serialize.ts` — `bingoCards` on `ExportSnapshot`, verbatim passthrough in `serializeExport`.
- `packages/core/src/data-safety/merge.ts` — `MIGRATIONS[2]`, `bingoCards` union merge with the locked-wins-then-imported-wins collision rule, `bingoCards` on the merged snapshot, defensive `?? []` guards.
- `packages/core/test/merge.test.ts` — bingoCard/bingoRow fixtures + 10 new cases (5 schema/serialize, 5 migration/merge).
- `packages/core/test/serialize.test.ts` — fixture gains `bingoCards: []`; the top-level-keys test updated to the nine v3 keys.

## Decisions Made
- **D-13 / Open-Q1 resolution (locked, tested):** on a same-`cardId` collision the LOCKED row wins (`lockedAt != null` beats `null`) so a locked historical card is never reverted to a draft; when both rows share lock-state (both draft or both locked), the INCOMING row wins per D-13's literal first clause. Implemented as an explicit collision resolver, deliberately NOT the blind local-wins loop used for `archiveShows`.
- **`caughtSnapshot` REQUIRED** on `bingoCardRow` (RESEARCH Pitfall 1) — the frozen catch-set drives `neverCaught` on replay; omitting it would let replay drift.
- **Nested `card: bingoCardSchema`** (RESEARCH Pattern 2) — reuse the shipped discriminated union verbatim instead of re-declaring it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Guard `local`/`incoming` bingoCards with `?? []` in the merge**
- **Found during:** Task 2 (MIGRATIONS[2] + union merge)
- **Issue:** Making `ExportSnapshot.bingoCards` required and iterating `local.bingoCards` unconditionally crashed every app-tier import test (`importFork.test.ts`, `exportImportRoundtrip.test.ts`) at runtime — the app's in-memory `DbSnapshot`/`local` snapshot does not carry `bingoCards` until the Phase 15-02 db threading.
- **Fix:** Iterate `local.bingoCards ?? []` and `incoming.bingoCards ?? []`, decoupling core from the app-threading order so a pre-v3 in-memory snapshot never crashes the merge.
- **Files modified:** packages/core/src/data-safety/merge.ts
- **Verification:** Full suite `npx vitest run` → 692 passed (was 6 failing before the guard).
- **Committed in:** `2dcbd47` (Task 2 commit)

**2. [Rule 3 - Blocking] Update serialize.test v2→v3 fixture + key-count assertion**
- **Found during:** Task 1 (ExportSnapshot gains `bingoCards`)
- **Issue:** `serializeExport` now always emits `bingoCards`, so the existing "exactly eight v2 top-level keys" test and the `sampleSnapshot()` fixture (missing the now-required field) failed.
- **Fix:** Added `bingoCards: []` to the fixture; renamed the shape test to the nine v3 keys.
- **Files modified:** packages/core/test/serialize.test.ts
- **Verification:** `npx vitest run packages/core/test/serialize.test.ts` green.
- **Committed in:** `1545c1d` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking).
**Impact on plan:** Both were mechanical consequences of adding the required `bingoCards` field; no scope creep, no design change. The locked-wins collision rule is the plan's own instructed resolution, not a deviation.

## Issues Encountered
- **Expected intermediate app-tsc red (by design):** `npx tsc --noEmit -p packages/app/tsconfig.json` reports 4 errors (`DbSnapshot` missing `bingoCards` at `exportDownload.ts`/`importPicker.ts` + 2 app test fixtures). This is the planned intermediate state — the plan is deliberately core-only and its verification explicitly scopes `tsc` to **core** ("Core `tsc --noEmit` clean"). 15-PATTERNS assigns the `db.ts` `DbSnapshot`/`snapshot()` threading and the `exportImportRoundtrip.test.ts` extension to Phase 15-02, which will make the app `tsc` gate clean. The full runtime suite (both projects) is green because esbuild strips types.

## Verification
- `npx vitest run packages/core/test/merge.test.ts` → **34 passed** (24 existing + 10 new).
- `npx vitest run` (both projects) → **692 passed / 85 files**.
- `npx tsc --noEmit -p packages/core/tsconfig.json` → **clean (exit 0)** — inferred `bingoCardRow` stays assignable downstream.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Envelope-v3 core contract is ready for Phase 15-02 to thread `bingoCards` through the app's `db.ts` (`version(5)` table, `DbSnapshot`, `snapshot()`, `importSnapshot` bulkPut) + bump `config.dataSafety.SCHEMA_VERSION` 2→3. That plan resolves the 4 expected app-`tsc` errors.
- No blockers.

## Self-Check: PASSED

- FOUND: packages/core/src/data-safety/export-schema.ts (`bingoCardRow`)
- FOUND: packages/core/src/data-safety/merge.ts (`MIGRATIONS[2]`, `mergedBingoCards`)
- FOUND: packages/core/src/data-safety/serialize.ts (`bingoCards`)
- FOUND commits: 8c636aa, 1545c1d, ae6b19f, 2dcbd47

---
*Phase: 15-gizz-bingo-persistence-lock-replay*
*Completed: 2026-07-20*
