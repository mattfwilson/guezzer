---
phase: 14-gizz-bingo-core-marking-generation
plan: 01
subsystem: core
tags: [bingo, zod, prng, config, typescript, determinism]

# Dependency graph
requires:
  - phase: 02-transition-matrix
    provides: config.ts single-source-of-truth pattern + MatrixNode fields the bingo context will read
  - phase: 06-dex-archive
    provides: archive-types.ts strictObject/schemaVersion header discipline mirrored here
provides:
  - BingoCard serializable JSON contract + zod bingoCardSchema (superRefine-guarded)
  - BingoVibe/BingoEvent/BingoWinKind string-literal unions (no "segue", D-24)
  - BingoSquareDef discriminated union + MarkedSquare/MarkedCard/Win marking types + FREE_SENTINEL
  - Deterministic string-seeded PRNG (xmur3 + mulberry32), pure
  - config.bingo constant surface (specificityRank total order, per-vibe bands, empty rosters)
affects: [14-02-context, 14-03-mark, 14-04-wins, 14-05-generate, 14-06-calibrate, phase-15-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Paired values-as-const tuple + z.enum + z.infer cross-check (mirrors tuning-tags.ts)"
    - "z.discriminatedUnion on kind + superRefine for structural invariants zod types can't express"
    - "Public-domain PRNG copied inline with source comment (zero new dependency)"
    - "config sub-section with [ASSUMED]/[VERIFIED] per-value JSDoc discipline"

key-files:
  created:
    - packages/core/src/bingo/types.ts
    - packages/core/src/bingo/prng.ts
    - packages/core/test/bingo/prng.test.ts
    - packages/core/test/config.test.ts
  modified:
    - packages/core/src/config.ts

key-decisions:
  - "seed is string not number (D-21) — bidirectional compile-time schema<->interface cross-check enforces it"
  - "specificityRank stored as config total order (song=0, neverCaught=1 > bustOut=2, D-09) — never inlined in mark.ts"
  - "jamVehicleSongIds/albumSquarePool ship as empty typed arrays — populated only at D-20 checkpoint / Plan 06 gate"

patterns-established:
  - "Bingo closed vocabularies are as-const tuples + derived unions, never enum (erasable-syntax-only)"
  - "Trust-boundary card contract is a zod strictObject + superRefine (16 squares, one free at freeIndex) for Phase-15 import validation"

requirements-completed: [BINGO-03]

# Metrics
duration: ~10min
completed: 2026-07-19
---

# Phase 14 Plan 01: Bingo Core Foundations Summary

**Interface-first pure-core bingo foundations: the serializable BingoCard JSON contract + zod schema, a deterministic xmur3/mulberry32 string-seeded PRNG, and the full config.bingo constant surface with a total-order specificityRank and empty rosters.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-19T23:33:00Z (approx)
- **Completed:** 2026-07-19T23:38:00Z (approx)
- **Tasks:** 3
- **Files modified:** 5 (3 created source/test, 1 config modified, 1 test created)

## Accomplishments
- `BingoCard` JSON contract with `seed: string` (D-21), discriminated `BingoSquareDef`, marking types (`MarkedSquare`/`MarkedCard`/`Win`) and `FREE_SENTINEL`, plus a `bingoCardSchema` `z.strictObject` with a `superRefine` enforcing 16 squares and exactly one free cell at `freeIndex`.
- String-literal unions `bingoVibeValues`/`bingoEventValues`/`bingoWinKindValues` — `"segue"` deliberately absent (D-24), verified by grep.
- Pure deterministic PRNG (`xmur3` + `mulberry32`) copied verbatim from the public-domain source with attribution; no clock or entropy source; determinism pinned by a byte-identical reproducibility test.
- `config.bingo` section with calibration/roster paths, `freeIndex`, `darkSquareFloor`, `bustOutGapShows`, `simCardsPerVibe`, a total-order `specificityRank` (song=0, neverCaught outranks bustOut per D-09), disjoint `reliableEvents`/`gloryEvents` that cover the event union, empty `jamVehicleSongIds`/`albumSquarePool` rosters, and per-vibe `line`/`blackout` target bands.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define BingoCard contract + unions + zod schema (types.ts)** - `822d908` (feat)
2. **Task 2: Deterministic string-seeded PRNG (prng.ts)** - `a87b77e` (test, RED) → `f958124` (feat, GREEN)
3. **Task 3: config.bingo section + config invariants test** - `d6f28b9` (feat)

## Files Created/Modified
- `packages/core/src/bingo/types.ts` - BingoCard contract, unions, marking types, bingoCardSchema
- `packages/core/src/bingo/prng.ts` - xmur3 + mulberry32 pure deterministic PRNG
- `packages/core/test/bingo/prng.test.ts` - PRNG range/advance/reproducibility determinism test
- `packages/core/test/config.test.ts` - config.bingo invariants (freeIndex domain, total order, coverage, bands)
- `packages/core/src/config.ts` - added `bingo:` constant section

## Decisions Made
- Added a bidirectional compile-time cross-check (`BingoCard` ⇆ `z.infer<typeof bingoCardSchema>`) so the hand-written interface and the schema can never silently drift — stronger than the plan's one-way `z.infer` alias, at zero runtime cost.
- Typed the empty rosters as `[] as number[]` / `[] as string[]` so downstream `config.bingo.jamVehicleSongIds.includes(...)` typechecks without an `as const` widening fight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected test import depth in config.test.ts**
- **Found during:** Task 3 (config invariants test)
- **Issue:** Initial import used `../../src/config.ts` (copied from `test/eval/backtest.test.ts`), but `config.test.ts` lives directly in `test/`, so the module failed to resolve.
- **Fix:** Changed imports to `../src/config.ts` and `../src/bingo/types.ts`.
- **Files modified:** packages/core/test/config.test.ts
- **Verification:** `npx vitest run --project @guezzer/core config` exits 0 (5 tests pass).
- **Committed in:** `d6f28b9` (Task 3 commit)

**2. [Rule 1 - Bug] Reworded comments to keep verification greps clean**
- **Found during:** Tasks 1 & 2 (post-write verification)
- **Issue:** Explanatory comments literally contained `"segue"` (types.ts) and `Math.random`/`Date.now` (prng.ts); the plan's verification greps assert these strings are ABSENT from the files, so the comments would have tripped a false verification failure.
- **Fix:** Reworded the comments to describe the excluded concepts without the literal tokens.
- **Files modified:** packages/core/src/bingo/types.ts, packages/core/src/bingo/prng.ts
- **Verification:** `grep -c segue types.ts` = 0; `grep -cE "Math\.random|Date\.now" prng.ts` = 0.
- **Committed in:** `822d908` (Task 1), `f958124` (Task 2)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 verification-hygiene bug)
**Impact on plan:** Both trivial and necessary — one fixes a broken import path, one keeps the plan's own verification greps accurate. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above. Full core suite (34 files, 346 tests) passes; core typechecks clean (no DOM/React import — purity intact).

## Known Stubs
None. The empty rosters (`jamVehicleSongIds`, `albumSquarePool`) and the empty `mix: {}` weights are intentional [ASSUMED] config placeholders explicitly deferred to the D-20 owner checkpoint / Plan 06 calibration gate — documented in-file and pinned by `config.test.ts`, not accidental stubs.

## Next Phase Readiness
- Types, PRNG, and config keys are stable inputs for Plan 02 (context), Plan 03 (mark), Plan 04 (wins), Plan 05 (generate), and Plan 06 (calibrate).
- `bingoCardSchema` gives Phase-15 persistence a validated contract to reject malformed cards (T-14-01).
- Roster values and per-vibe `mix` weights remain empty by design — Plan 06's calibration gate locks them.

## Self-Check: PASSED

All 5 created/modified files exist on disk; all 5 commits (822d908, a87b77e, f958124, d6f28b9, 0f77d5d) present in git log.

---
*Phase: 14-gizz-bingo-core-marking-generation*
*Completed: 2026-07-19*
