---
phase: 02-transition-matrix-model-backtest
plan: 01
subsystem: model
tags: [transition-matrix, markov, decay, cli, vitest, typescript, packages-core]

# Dependency graph
requires:
  - phase: 01-corpus-ingestion-schema-foundation
    provides: NormalizedCorpus (data/normalized/corpus.json), config.ts single-source-of-truth pattern, domain/types.ts vocabulary, tuning-tags.json + TuningFamily
provides:
  - Extended config.ts with all 18 Phase 2 model constants (D-16)
  - Extended domain/types.ts with the full Phase 2 type vocabulary (TransitionMatrix, MatrixNode, MatrixEdge, PredictionCandidate, PredictionFactors, BackoffTier, ShowContext, SignalToggles, BacktestResult, BacktestSplit, AblationEntry, AsOfBound)
  - buildMatrix(corpus, asOf, cfg, options) -> TransitionMatrix (D-07/D-08/D-09/D-10)
  - decayedWeight exponential half-life helper
  - buildMatrixIndex(matrix) -> { edgesFrom, nodeById } in-memory successor index
  - build-model CLI emitting the committed data/normalized/transition-matrix.json artifact
affects: [02-02-predict, 02-03-backtest, 04-show-mode, 07-explore-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Options-bag generatedAt override on pure builder functions (mirrors NormalizeOptions) so build artifacts stay byte-stable across reruns of the same input"
    - "Exclusive (date, showOrder) tuple AsOfBound with an inclusive flag, rather than a date-only cutoff, for leak-safe walk-forward matrix construction"

key-files:
  created:
    - packages/core/src/model/decay.ts
    - packages/core/src/model/matrix.ts
    - packages/core/src/model/index-build.ts
    - packages/core/src/cli/build-model.ts
    - packages/core/test/model/matrix.test.ts
    - packages/core/test/fixtures/synthetic-ascutoff.json
    - packages/core/test/fixtures/synthetic-ascutoff.meta.json
    - data/normalized/transition-matrix.json
  modified:
    - packages/core/src/config.ts
    - packages/core/src/domain/types.ts
    - packages/core/src/index.ts

key-decisions:
  - "Matrix generatedAt is set to the input corpus's own generatedAt, not wall-clock new Date() -- required for byte-stable rebuilds against an unchanged corpus.json"
  - "buildMatrix takes an options bag (tuningFamilyBySongId, generatedAt) as its 4th param, mirroring ingest/normalize.ts's NormalizeOptions convention, keeping the primary 3-arg call site clean while enabling deterministic tests and CLI provenance"
  - "--cutoff CLI flag maps to AsOfBound{ showOrder: Number.MAX_SAFE_INTEGER, inclusive: true } -- convenience 'everything on/before this date' semantics distinct from buildMatrix's stricter programmatic tuple bound used by the future backtest walk-forward loop"

patterns-established:
  - "Pattern: model/*.ts pure derivation modules mirror ingest/census.ts (Map-keyed accumulation, explicit sort comparators, fixed iteration order, rounded floats) for determinism"
  - "Pattern: cli/*.ts thin wrappers mirror cli/normalize-corpus.ts (export run*/format*Summary, parseArgs with throw-on-unknown-flag, isMain guard, try/catch/process.exit(1))"

requirements-completed: [DATA-05, MODL-01, MODL-02, MODL-04, MODL-11, EVAL-05]

# Metrics
duration: 14min
completed: 2026-07-08
---

# Phase 2 Plan 1: Transition Matrix Build Slice Summary

**Frozen `TransitionMatrix` JSON artifact (264 nodes, 2987 within-set edges) built via a pure `buildMatrix(corpus, asOf, config)` function with exponential recency decay, exclusive as-of-cutoff leak prevention, and a thin `build-model` CLI verified byte-stable across reruns.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-08T20:58:15-04:00 (base commit a9e363b)
- **Completed:** 2026-07-08T21:12:26-04:00
- **Tasks:** 3
- **Files modified:** 11 (8 created, 3 modified)

## Accomplishments
- Extended `config.ts` and `domain/types.ts` with the complete Phase 2 constant/type vocabulary (interface-first, all downstream plans in this phase can now import from these files)
- Implemented `buildMatrix` with correct set-boundary/encore exclusion (D-07), exclusive `(date, showOrder)` as-of cutoff (D-09 refined by walk-forward needs), and recency-decayed `weightedCount` alongside raw `count` (D-10)
- Shipped the real committed `data/normalized/transition-matrix.json` artifact (738 shows, 264 songs, 2987 distinct directed within-set edges -- matches the corpus census exactly)
- All 5 Wave-0 behaviors green (9 numbered assertions): boundary exclusion, matrix schema, as-of cutoff leak-safety, decay half-life, determinism

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend config.ts + domain/types.ts** - `33a5fea` (feat)
2. **Task 2: buildMatrix + decay helper + Wave-0 matrix.test.ts** - `acb4b2b` (feat)
3. **Task 3: index-build + build-model CLI + barrel export + emit artifact** - `8663750` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: TDD_MODE is false for this phase (MVP+TDD gate context), so Task 2 (tdd="true") was implemented directly rather than via a separate RED/GREEN commit sequence -- tests and implementation landed together in one feat commit._

## Files Created/Modified
- `packages/core/src/config.ts` - added 18 Phase 2 model constants (matrix/backtest artifact paths, decay half-life, backoff weights, rotation/already-played factors, hard-segue gating, era-prior params, candidate list size), each doc-commented with its deciding decision/research section and `[ASSUMED]` flag
- `packages/core/src/domain/types.ts` - added the full Phase 2 type vocabulary (TransitionMatrix, MatrixNode, MatrixEdge, AsOfBound, BackoffTier, PredictionFactors, PredictionCandidate, ShowContext, SignalToggles, BacktestSplit, AblationEntry, BacktestResult)
- `packages/core/src/model/decay.ts` - `decayedWeight(showDate, asOfDate, halfLifeDays)` pure exponential decay helper
- `packages/core/src/model/matrix.ts` - `buildMatrix(corpus, asOf, cfg, options)` pure matrix builder
- `packages/core/src/model/index-build.ts` - `buildMatrixIndex(matrix)` in-memory `from -> edges` + `songId -> node` lookup
- `packages/core/src/cli/build-model.ts` - thin CLI: corpus.json + tuning-tags.json -> transition-matrix.json, `--out`/`--cutoff` flags
- `packages/core/src/index.ts` - barrel-exported the new domain types and pure fns
- `packages/core/test/model/matrix.test.ts` - 9 numbered assertions across 5 describe blocks
- `packages/core/test/fixtures/synthetic-ascutoff.json` + `.meta.json` - new hand-authored fixture for as-of leak-safety
- `data/normalized/transition-matrix.json` - the committed frozen artifact

## Decisions Made
- **Matrix `generatedAt` = input corpus's `generatedAt`, not wall-clock.** The plan's must-have "byte-stable across repeated rebuilds" truth requires two CLI runs against the same committed `corpus.json` to emit byte-identical output. Using `new Date().toISOString()` would break this on every run. Tying `generatedAt` to the input's own timestamp keeps it deterministic while preserving meaningful provenance (it changes exactly when the input corpus changes).
- **`buildMatrix` accepts an options bag as its 4th parameter** (`{ tuningFamilyBySongId?, generatedAt? }`) rather than positional params, mirroring `ingest/normalize.ts`'s `NormalizeOptions` convention already established in Phase 1. Keeps the common 3-arg call site (`buildMatrix(corpus, asOf, config)`) matching the plan's documented signature while enabling the tuning-tags injection (kept `buildMatrix` I/O-free per the plan's explicit instruction) and the deterministic `generatedAt` override.
- **`--cutoff` CLI flag uses `showOrder: Number.MAX_SAFE_INTEGER, inclusive: true`.** The plan specifies an optional `--cutoff <YYYY-MM-DD>` flag without a paired `--show-order` flag; mapping it to "everything on or before this date" (via a maximal showOrder) gives the CLI convenience semantics distinct from the stricter exclusive-tuple bound the future backtest walk-forward loop (plan 02-03) will construct programmatically per held-out show.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Non-deterministic `generatedAt` broke byte-stable rebuilds**
- **Found during:** Task 3 (build-model CLI, verifying the "run CLI twice -> byte-identical" acceptance criterion)
- **Issue:** The initial `buildMatrix` implementation defaulted `generatedAt` to `new Date().toISOString()`. Running `build-model` twice in a row against the unchanged committed corpus produced two different `transition-matrix.json` files, differing only in the timestamp -- violating the plan's must_haves truth "The artifact is byte-stable across repeated rebuilds" and the Task 3 acceptance criterion checked via `git diff --quiet` after a second run.
- **Fix:** Added a `generatedAt` override to `buildMatrix`'s options bag (already present for `tuningFamilyBySongId`); `cli/build-model.ts` passes `corpus.generatedAt` (the input artifact's own provenance timestamp) instead of wall-clock time. Verified with a manual byte-diff of two consecutive CLI runs (see Task 3 verification below) -- zero bytes differ.
- **Files modified:** `packages/core/src/model/matrix.ts`, `packages/core/src/cli/build-model.ts`
- **Verification:** `node packages/core/src/cli/build-model.ts` run twice consecutively; `diff` of the two output files showed zero differences (confirmed independently of `git diff`, which would trivially report no changes on an untracked file regardless of content).
- **Committed in:** `8663750` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness -- this was a genuine violation of an explicit must_haves truth, not scope creep. No other deviations.

## Issues Encountered
None beyond the determinism fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `buildMatrix`, `buildMatrixIndex`, and the full Phase 2 type vocabulary are ready for plan 02-02 (predict.ts) to consume -- `PredictionCandidate`, `PredictionFactors`, `ShowContext`, `SignalToggles`, `BackoffTier` are already defined in `domain/types.ts`.
- `AsOfBound`'s exclusive `(date, showOrder)` tuple bound is exactly what plan 02-03's walk-forward backtest loop needs (`buildMatrix(corpus, { date: S.date, showOrder: S.showOrder, inclusive: false })` per held-out show) -- no rework required.
- The committed `data/normalized/transition-matrix.json` gives 02-02/02-03 real data to test scoring/backtest logic against immediately, not just fixtures.
- No blockers.

---
*Phase: 02-transition-matrix-model-backtest*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 11 created/modified files verified present on disk; all 3 task commits (`33a5fea`, `acb4b2b`, `8663750`) verified present in git history.
