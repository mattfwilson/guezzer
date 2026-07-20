---
phase: 14-gizz-bingo-core-marking-generation
plan: 05
subsystem: testing
tags: [bingo, monte-carlo, calibration, cli, gate, typescript, vitest]

# Dependency graph
requires:
  - phase: 14-gizz-bingo-core-marking-generation
    provides: "deriveMarks (mark.ts), deal (generate.ts), detectWins/expectedFill (wins.ts), buildBingoContext (context.ts), BingoCard/BingoContext types (types.ts)"
  - phase: 02-transition-matrix-model
    provides: "run-backtest.ts CLI idiom (isMain guard, byte-stable writes, escapeMarkdownExcerpt), config artifact-path convention"
  - phase: 06-pokedex-derivation
    provides: "buildRarityIndex, archive/dex-albums artifact schemas"
provides:
  - "Bingo public API barrel exports from @guezzer/core (deal, deriveMarks, detectWins, expectedFill, buildBingoContext + types + MarkTrailEntry)"
  - "cli/bingo-calibrate.ts — real-fold Monte-Carlo calibration report + D-02/D-03/D-05 hard-assert gate (process.exit(1) on violation)"
  - "--candidates roster mode emitting jam-vehicle + album pool proposals to a review file (D-20 checkpoint input)"
  - "Exported pure engine fns: runBingoCalibration, formatCalibrationReport, assertCalibrationInvariants, buildRosterCandidates"
affects: [14-06 (runs the D-20 checkpoint + locks config.bingo constants), 16 (app consumes the bingo barrel API)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Calibration gate CLI mirrors run-backtest.ts cell-for-cell (isMain guard, byte-stable writes, escapeMarkdownExcerpt)"
    - "Sim IS production marking: CLI imports the REAL deriveMarks/deal/detectWins — never a forked reimplementation (Pitfall 3 / T-14-12)"
    - "Two-dex-assumption reporting: empty (first-show edge, reported) + mid-collection (gated) from one run"

key-files:
  created:
    - packages/core/src/cli/bingo-calibrate.ts
    - packages/core/test/bingo/calibrate.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "LINE_TARGET_TOLERANCE (±0.05) kept a CLI-internal gate constant — config.bingo owns point targets; Plan 06 may promote it once locked (config.ts is out of this plan's scope)"
  - "Exported MarkTrailEntry from the barrel (beyond the plan's literal list) — the app cannot type its trail adapter without it (D-22 trail contract)"
  - "Mid-collection dex built deterministically from a seeded ~50% show subset (mulberry32/xmur3, seed 'bingo-mid-collection-dex') for byte-stable snapshots"

patterns-established:
  - "Reliable-square classification: album + reliableEvents floored; bustOut/neverCaught (glory) exempt (D-15)"
  - "assertCalibrationInvariants gates the mid-collection assumption ONLY; the empty-dex run is reported, never gated"

requirements-completed: [BINGO-03]

# Metrics
duration: 30min
completed: 2026-07-20
---

# Phase 14 Plan 05: Bingo Calibration Gate Summary

**Real-fold Monte-Carlo calibration CLI that replays recent-era shows through the production `deriveMarks`/`detectWins` fold, reports per-vibe P(line)/P(blackout)/dark-share/expected-marks under empty + mid-collection dex assumptions, and hard-asserts the D-02/D-03/D-05 invariants with `process.exit(1)` — plus a `--candidates` roster mode and the bingo public-API barrel exports.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-20
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Added the bingo barrel export block to `index.ts` (deal, deriveMarks, detectWins, expectedFill, buildBingoContext, all types + MarkTrailEntry); the CLI stays behind the boundary, never exported.
- Built `cli/bingo-calibrate.ts`: `runBingoCalibration` deals `simCardsPerVibe` seeded cards per vibe and replays each show through the REAL marking fold (no fork), aggregating win probabilities, expected marks, and per-reliable-type dark share under two dex assumptions.
- Implemented `assertCalibrationInvariants` — the D-02/D-03/D-05 gate (reliable-square fire floor + never-fired check, per-vibe P(line) target ± tolerance, per-vibe P(blackout) band); glory events exempt (D-15).
- Added `--candidates` mode emitting corpus-measured jam-vehicle + album pool proposals to a review file (never config.ts) for the D-20 checkpoint.
- Byte-stable output (generatedAt from corpus.generatedAt, stable-key sorts) and `escapeMarkdownExcerpt` on embedded song/album names (T-14-11).
- Verified end-to-end against the real 241-show corpus: the gate correctly FAILS (exit 1) pre-calibration (empty rosters → marathonJam never fires, un-tuned mix → P(line) off), and `--candidates` succeeds (exit 0, 19 album + 9 jam-vehicle proposals). Plan 06 tunes constants to green.

## Task Commits

1. **Task 1: Add the bingo barrel export block (index.ts)** — `b668ded` (feat)
2. **Task 2 (RED): failing calibration gate tests** — `dfa907c` (test)
3. **Task 2 (GREEN): calibration gate CLI implementation** — `1ce0ca6` (feat)

_Note: Task 2 was executed TDD (test → feat); no separate refactor commit was needed — the GREEN implementation was already clean._

## Files Created/Modified
- `packages/core/src/cli/bingo-calibrate.ts` — Monte-Carlo calibration report + hard-assert gate + `--candidates` roster mode; exported pure engine fns + isMain wrapper.
- `packages/core/test/bingo/calibrate.test.ts` — aggregation-shape, determinism, gate (dark-share==1.0 / off-band P(line) / mid-collection-only gating), and formatter tests on a tiny synthetic corpus.
- `packages/core/src/index.ts` — bingo barrel export block; CLI stays behind the boundary.

## Decisions Made
- **LINE_TARGET_TOLERANCE (±0.05)** is a CLI-internal gate constant, not a config value — `config.bingo` is out of this plan's `files_modified` scope, and Plan 06 owns the constant lock. Documented inline so Plan 06 can promote it to config if desired.
- **Mid-collection dex** is built deterministically from a seeded ~50% subset of the shows (RESEARCH Open Q2), so the gated run is byte-reproducible.
- **corpusVersion source (Open Q4):** used `corpus.generatedAt` for both the byte-stable `generatedAt` and the deal `corpusVersion`.

## Deviations from Plan

### Auto-fixed / judgment additions

**1. [Rule 2 - Missing Critical] Exported `MarkTrailEntry` from the barrel**
- **Found during:** Task 1 (barrel exports)
- **Issue:** The plan's export list omitted `MarkTrailEntry`, but `deriveMarks` takes `ReadonlyArray<MarkTrailEntry>` — the Phase-16 app cannot type its setlist-row-to-trail adapter (D-22) without the contract type.
- **Fix:** Added `export { deriveMarks, type MarkTrailEntry } from "./bingo/mark.ts"`.
- **Files modified:** packages/core/src/index.ts
- **Verification:** `npx tsc -p packages/core --noEmit` clean; full bingo + core suites green.
- **Committed in:** `b668ded`

**2. [Rule 3 - Blocking] Cloned test results into a mutable type**
- **Found during:** Task 2 GREEN typecheck
- **Issue:** The result interfaces are deeply `readonly`; the gate tests mutated fields to build broken variants → `tsc` TS2540 (esbuild/vitest ignored it, but the typecheck gate failed).
- **Fix:** Added a `DeepMutable<T>` helper + `brokenClone()` (`structuredClone`) so tests build broken variants without mutating readonly props.
- **Files modified:** packages/core/test/bingo/calibrate.test.ts
- **Verification:** `npx tsc -p packages/core --noEmit` exits 0.
- **Committed in:** `1ce0ca6`

**3. [Rule 1 - Verification-literal fix] Reworded an index.ts JSDoc note**
- **Found during:** Task 2 verification
- **Issue:** The plan verifies `grep -n "bingo-calibrate" packages/core/src/index.ts` returns nothing; my boundary JSDoc comment contained the literal `cli/bingo-calibrate.ts`, tripping the check even though there is no actual export.
- **Fix:** Reworded the comment to "the calibration CLI stays behind the boundary" — no literal path.
- **Files modified:** packages/core/src/index.ts
- **Verification:** grep now returns nothing.
- **Committed in:** `1ce0ca6`

---

**Total deviations:** 3 (1 missing-critical export, 1 blocking typecheck fix, 1 verification-literal reword)
**Impact on plan:** All necessary for correctness / passing the plan's own verification. No scope creep — config.ts was left untouched per the plan's `files_modified`.

## Issues Encountered
- None beyond the readonly-mutation typecheck fix documented above.

## User Setup Required
None - no external service configuration required. (Plan 06 runs the interactive D-20 roster checkpoint.)

## Next Phase Readiness
- The calibration machinery is complete and verified end-to-end. Plan 06 can now: run `--candidates` to generate roster proposals, hold the D-20 human checkpoint, write the approved `jamVehicleSongIds`/`albumSquarePool` + per-vibe `mix` weights into `config.bingo`, and iterate the mix until `assertCalibrationInvariants` returns green.
- Expected pre-Plan-06 state: the gate FAILS by design (empty rosters + un-tuned mix). This is the "un-calibrated config cannot silently ship" trust property, not a regression.
- The bingo public API is barrel-exported for Phase-16 app consumption.

## Self-Check: PASSED

- All created/modified files exist on disk (bingo-calibrate.ts, calibrate.test.ts, index.ts, this SUMMARY).
- All task commits present in git history (`b668ded`, `dfa907c`, `1ce0ca6`).
- `npx tsc -p packages/core --noEmit` exits 0; `npx vitest run --project @guezzer/core` — 380/380 pass (40 bingo, 8 calibrate).
- Plan verification greps satisfied: `bingo-calibrate` absent from index.ts; `escapeMarkdown` present in the CLI; real fold imported (no fork); `process.exit(1)` + `--candidates`/`--out`/`--json-out` present.

---
*Phase: 14-gizz-bingo-core-marking-generation*
*Completed: 2026-07-20*
