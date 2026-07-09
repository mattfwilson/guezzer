---
phase: 02-transition-matrix-model-backtest
plan: 04
subsystem: eval
tags: [backtest, walk-forward, holdout, top-k, hard-segue, vitest, typescript, packages-core]

# Dependency graph
requires:
  - phase: 02-transition-matrix-model-backtest
    plan: 03
    provides: the complete predict()/scoreCandidate() multiplicative pipeline (transition frequency, decay, rotation suppression, already-played, era prior, consistency-gated hard-segue override) that this plan evaluates walk-forward
provides:
  - findHoldoutShows(corpus, tourIdSentinel) — most-recent-complete-tour identification by latest-dated show (never max tourId), throws loudly on a one-off latest show
  - runBacktest(corpus, cfg, toggles) -> BacktestResult — leak-free walk-forward evaluation: rebuilds the matrix with an exclusive (date, showOrder) as-of bound per held-out show, walks every within-set adjacent transition, reports top-1/5/10 hit rates overall and split by hard-segue vs free-choice
  - synthetic-multitour.json(+.meta.json) fixture — a 2-tour, 6-show corpus with hand-designed, implementation-cross-checked expected holdout + metrics, reused by Plan 05's ablation sweep
affects: [02-05-backtest-cli-ablation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Walk-forward eval loop: process held-out shows in (date, showOrder) order, rebuild the matrix per show with an EXCLUSIVE as-of tuple bound (inclusive: false), and accumulate each processed show's song set into a growing `recentShowSongSets` list passed UNSLICED to predict() — rotationSuppression's own internal `.slice(-rotationWindowShows)` does the windowing, so the caller never duplicates that logic."
    - "In-progress trail accumulates across the WHOLE show (not reset per set) — matches D-05's 'already-played so far this show' wording; a song repeated across set 1 and set 2 is correctly flagged."
    - "Eval-target exclusion is a single guard (`!next.isPlaceholder`) at the point of building the pair — set-openers and single-song sets are excluded for free by only ever walking adjacent-pair indices, never a dedicated filter pass."

key-files:
  created:
    - packages/core/src/eval/holdout.ts
    - packages/core/src/eval/backtest.ts
    - packages/core/test/eval/backtest.test.ts
    - packages/core/test/fixtures/synthetic-multitour.json
    - packages/core/test/fixtures/synthetic-multitour.meta.json
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "BacktestResult.generatedAt is set directly from the input corpus's own `generatedAt`, never `new Date().toISOString()` — mirrors the Plan 01 precedent (`TransitionMatrix.generatedAt` in matrix.ts / build-model.ts's explicit `generatedAt: corpus.generatedAt` pass-through) so runBacktest stays a pure function and Plan 05's CLI output is byte-stable across reruns of the same committed corpus."
  - "recentShowSongSets is passed to evalTransitions UNSLICED (the full growing list of prior processed holdout-tour shows) rather than pre-windowed to rotationWindowShows in backtest.ts, because rotationSuppression() already does `ctx.recentShowSongSets.slice(-cfg.rotationWindowShows)` internally (predict.ts, Plan 03). Pre-slicing in both places would be redundant and risks the two windows drifting out of sync."
  - "Eval-transition exclusion is scoped exactly to the plan's literal wording — only B (the target) being a placeholder is excluded; A being a placeholder is not specially handled (not required by the plan's must_haves.truths, and never arises in this fixture). Avoids speculative scope beyond what's specified and tested."
  - "Fixture expected values (evalTransitionCount=5, overall/hardSegue/freeChoice top-k) were designed via a structural dominance argument (every correct next-song has either an EXCLUSIVE t1=1.0 training successor or clears the D-04 hard-segue pin gate, and the small/near-uniform-playCount catalog keeps eraPrior a near-uniform multiplier that can't overturn a 0.6-vs-0.4 backoff margin) and then cross-checked against the real deterministic implementation via a throwaway Node script before being baked into the test — see synthetic-multitour.meta.json's `why` field for the full reasoning a human reviewer can verify by inspection."

requirements-completed: [EVAL-01, EVAL-03, EVAL-05]

# Metrics
duration: ~20min
completed: 2026-07-09
---

# Phase 2 Plan 4: Walk-Forward Backtest Core (Holdout + Metrics) Summary

**Leak-free walk-forward backtest core: `findHoldoutShows` identifies the most-recent complete tour by latest-dated show (never max tourId), and `runBacktest` rebuilds an exclusive-as-of matrix per held-out show, reporting top-1/5/10 hit rates overall and split by hard-segue vs free-choice.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-08T21:50:48-04:00 (approx, base commit 5f28ccf)
- **Completed:** 2026-07-08T22:06:43-04:00
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- Implemented `findHoldoutShows(corpus, tourIdSentinel)` (D-12): identifies the holdout tour by the LATEST-DATED show's tourId, never `max(tourId)` (tourId is not chronologically monotonic — Pitfall 3); throws a loud, descriptive error when the latest show is a one-off (`tourIdSentinel`), per the T-02 error convention (T-02-09)
- Hand-designed a 2-tour, 6-show `synthetic-multitour.json`(+`.meta.json`) fixture where the max tourId (999) is chronologically EARLIEST and the true holdout tour (id 7) is chronologically LATEST — traps a `max(tourId)` holdout bug directly
- Implemented `runBacktest(corpus, cfg, toggles)` (D-12/D-13): walk-forward loop over held-out shows in `(date, showOrder)` order, rebuilding the matrix per show with an EXCLUSIVE as-of tuple bound so the show's own transitions are never in training but the tour's earlier nights are (exercising rotation suppression, MODL-06); walks every within-set adjacent transition, excludes placeholder targets (set-openers and single-song sets are excluded for free by construction), scores via `predict()`, and reports top-1/5/10 hit rates overall and split by whether the actual transition was a notated hard segue
- 6 new Wave-0 fixture tests across both tasks (holdout identification, sentinel guard, backtest metrics, hard-segue/free-choice split, eval-target exclusions, no-leakage), all with concrete hand-designed expected values cross-checked against the real implementation; full core suite (91 tests) and `tsc --noEmit` green

## Task Commits

Each task was committed atomically:

1. **Task 1: findHoldoutShows + synthetic multi-tour fixture** - `3176c66` (feat)
2. **Task 2: runBacktest — walk-forward loop, top-k metrics, hard-segue split** - `9f69df3` (feat)

_Note: TDD_MODE is false for this phase (MVP+TDD gate context), so both `tdd="true"` tasks were implemented directly rather than via a separate RED/GREEN commit sequence — tests and implementation landed together in one feat commit per task, matching the Plan 02/03 precedent._

## Files Created/Modified
- `packages/core/src/eval/holdout.ts` — `findHoldoutShows`, the D-12 most-recent-complete-tour reducer
- `packages/core/src/eval/backtest.ts` — `runBacktest` plus internal (non-barrel) helpers `evalTransitions`, `hitAtK` (as `hitAtK`), `aggregateSplit` (the `splitBy`-shaped aggregation), and `showSongSet`
- `packages/core/test/eval/backtest.test.ts` — 6 numbered assertions across 6 describe blocks: holdout identification, sentinel guard, backtest metrics, hard-segue/free-choice split, eval-target exclusions, no-leakage
- `packages/core/test/fixtures/synthetic-multitour.json`(+`.meta.json`) — the 2-tour/6-show fixture, generated via a throwaway Node script (not hand-typed) to avoid transcription errors, with the full design rationale in the `.meta.json` sidecar
- `packages/core/src/index.ts` — barrel-exports `findHoldoutShows` and `runBacktest`

## Decisions Made
- **`generatedAt` sourced from the input corpus, not wall-clock.** See key-decisions above — required for `runBacktest` to stay pure and for Plan 05's `data/backtest.json` CLI output to be byte-stable across reruns (explicitly called out in the plan's amended Task 2 action text, mirroring Plan 01's `TransitionMatrix.generatedAt` precedent).
- **`recentShowSongSets` passed unsliced.** rotationSuppression already windows internally; avoiding a second window computation in `backtest.ts` prevents the two from drifting.
- **Placeholder exclusion scoped to B only**, matching the plan's literal `must_haves.truths` wording exactly, not extended to A (never required, never exercised).
- **Fixture expected values were designed then verified against the real implementation** (via a throwaway Node script, not committed) rather than asserted purely from hand arithmetic — the full multiplicative pipeline (interpolated backoff blend + rotation + already-played + era prior + hard-segue override) is not practical to hand-derive to exact floating-point precision, but the STRUCTURAL dominance argument (documented in `synthetic-multitour.meta.json`) is independently verifiable by a human reviewer, and the deterministic pure implementation confirms the intended outcome. This is not "fitting the test to the implementation" — the fixture's design intent (exclusive single training successor per chain link; consistency-gated hard-segue pin for Y->Z) was fixed BEFORE the implementation was exercised.

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `runBacktest`/`findHoldoutShows` are exported and ready for Plan 05's CLI wrapper (`cli/run-backtest.ts`, mirroring `cli/build-model.ts`/`cli/run-census.ts`) and per-signal ablation sweep (D-14: re-invoke `runBacktest` once per signal with `toggles` cloned and one flag flipped, populating the currently-empty `ablation: []` array).
- The synthetic-multitour fixture is explicitly designed for reuse by Plan 05's ablation test (D-17/EVAL-05, hand-computed known outputs) — its `.meta.json` documents the exclusive-successor structure that makes ablation deltas predictable (e.g., disabling the `hardSegue` toggle should demonstrably drop Y->Z out of the pinned top-1).
- Fixture unit tests with known expected outputs now cover EVAL-01 end-to-end (holdout + walk-forward + top-k + split), satisfying phase success criterion 5 for the backtest's metrics leg.
- No blockers.

---
*Phase: 02-transition-matrix-model-backtest*
*Completed: 2026-07-09*
