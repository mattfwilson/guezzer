---
phase: 11-live-sync-prediction-correctness
plan: 01
subsystem: core/model
tags: [prediction, era-prior, tdd, red-gate, PRED-02]
requires:
  - packages/core/src/model/predict.ts (eraPrior, basePlayRate)
  - packages/core/src/model/index-build.ts (buildMatrixIndex, MatrixIndex)
  - packages/core/src/config.ts (eraWindowShows/eraPriorSmoothingK/eraPriorFloor/eraPriorCeil)
provides:
  - Production-scale era-prior regression test (RED) proving PRED-02's dead floor
affects:
  - plan 11-03 (PRED-02 fix flips this test green)
tech-stack:
  added: []
  patterns:
    - "Build the test index via buildMatrixIndex(matrix) over a full TransitionMatrix, never a hand-built MatrixIndex literal — forward-compatible with the showCount field 11-03 adds"
    - "Assertions read scoringConfig bounds by name (eraPriorFloor/eraPriorCeil), never bare 0.3/2.0 literals"
key-files:
  created: []
  modified:
    - packages/core/test/model/predict.test.ts
decisions:
  - "The masking 3-node (Σ playCount=120) era-prior fixture is replaced by a ~260-node, Σ playCount ~14,000 matrix — the scale at which k=1 smoothing pins the ratio near 1.0 and eraPriorFloor becomes unreachable on current code"
metrics:
  duration: ~10min
  completed: 2026-07-19
---

# Phase 11 Plan 01: Era-Prior Production-Scale RED Gate Summary

Rewrote the masking era-prior unit test to exercise `eraPrior` at production catalog scale (~260 nodes, Σ playCount ~14,000), making PRED-02's unreachable retired-song floor a testable RED assertion that plan 11-03 will flip green.

## What Was Built

Task 1 replaced Test 10 in `packages/core/test/model/predict.test.ts`. The prior fixture hand-built a 3-node `MatrixIndex` whose `Σ playCount = 120`, which accidentally made `basePlayRate()` commensurate with the per-window `eraRate`, letting `eraPriorFloor` fire and hiding the PRED-02 unit mismatch. The rewrite:

- Builds a `buildProductionScaleEraMatrix()` helper returning a full `TransitionMatrix` — one RETIRED node (`eraPlayCount: 0`, career `playCount: 50`), one HOT node (`eraPlayCount: 38` near `eraWindowShows: 40`, career `playCount: 300`), plus 258 filler catalog nodes (career `playCount` 10..99) so `Σ playCount ≈ 14,400`. `showCount: 241` (corpus-realistic), `edges: []` (eraPrior reads only `nodeById` + config).
- Constructs the index via `buildMatrixIndex(matrix)` — never a hand-built literal — so it stays forward-compatible with the `showCount` field plan 11-03 threads into `MatrixIndex`.
- Asserts the retired song reaches `≤ eraPriorFloor + ε` (RED on current code) and the hot song scores `> 1` and `≤ eraPriorCeil`, reading bounds from `scoringConfig` by name.
- Dropped the now-unused `type MatrixIndex` import; added `MatrixNode`/`TransitionMatrix` type imports from `domain/types`.

## RED Result (verbatim — for 11-03 to confirm it flips green)

```
FAIL  |@guezzer/core| test/model/predict.test.ts > predict — era prior at production scale (MODL-07 / PRED-02 RED gate) > Test 10: a zero-era-play retired song reaches ~eraPriorFloor and a currently-hot song scores > 1 at real catalog scale (RED on current eraPrior — flipped green by plan 11-03)
AssertionError: expected 0.9964267848209819 to be less than or equal to 0.30000099999999996
 ❯ test/model/predict.test.ts:478:27
    477|     const retiredFactor = eraPrior(ERA_RETIRED, index, cfg);
    478|     expect(retiredFactor).toBeLessThanOrEqual(cfg.eraPriorFloor + epsi…

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)
```

The retired song's `eraPrior` returns **0.9964267848209819** (≈ 1.0), not `≈ eraPriorFloor` (0.3). This is the accepted deliverable of the Wave-0 gate: the floor is proven genuinely unreachable on current arithmetic. Only Test 10 (era-prior) is red; the other 16 tests in the file remain green.

Arithmetic on current code: `ratio = (eraRate + k) / (allTimeRate + k) = (0/40 + 1) / (50/14400 + 1) = 1 / 1.00347 ≈ 0.9964`, clamped into `[0.3, 2.0]` → unchanged. The `k=1` smoothing over the ~14,000 all-time denominator pins the ratio near 1.0 (RESEARCH Pitfall 1).

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Baseline before edit: `npx vitest run packages/core/test/model/predict.test.ts` → 17 passed.
- After edit: 16 passed | 1 failed (only the era-prior Test 10, as designed).
- `npx tsc --noEmit` in `packages/core` → exit 0 (clean).
- `git diff --diff-filter=D HEAD~1 HEAD` → no deletions.
- No production source (`predict.ts`, `config.ts`, `index-build.ts`) modified — only the test file.

## TDD Gate Compliance

This is the Wave-0 RED gate of a multi-plan TDD cycle (PRED-02). The `test(11-01): ...` RED commit (`5cdfb46`) is the RED gate; the GREEN gate lands in plan 11-03. The intentional Test 10 failure is the deliverable and does NOT make this plan incomplete.

## Self-Check: PASSED

- FOUND: packages/core/test/model/predict.test.ts (modified)
- FOUND: commit 5cdfb46 (test(11-01) RED gate)
- FOUND: .planning/phases/11-live-sync-prediction-correctness/11-01-SUMMARY.md
