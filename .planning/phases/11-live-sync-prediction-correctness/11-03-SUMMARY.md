---
phase: 11-live-sync-prediction-correctness
plan: 03
subsystem: core/model + core/live
tags: [prediction, era-prior, run-grouping, PRED-01, PRED-02, PRED-03, tdd, green-gate]
requires:
  - packages/core/src/model/predict.ts (eraPrior)
  - packages/core/src/model/index-build.ts (MatrixIndex, buildMatrixIndex)
  - packages/core/src/config.ts (eraPriorSmoothingK, rotationWindowShows)
  - packages/core/src/domain/types.ts (ShowContext.recentShowSongSets)
provides:
  - Dimensionally-correct eraPrior (per-show career rate) — floor reachable at production scale
  - MatrixIndex.showCount field
  - currentRunShowSets + FinalizedShowInput (the recentShowSongSets window)
  - config.runGapDays; rescaled config.eraPriorSmoothingK
affects:
  - plan 11-05 (app wiring: feed currentRunShowSets into buildShowContext + reset control)
tech-stack:
  added: []
  patterns:
    - "eraPrior compares plays-per-show to plays-per-show: eraRate = eraPlayCount/eraWindowShows vs allTimeRate = node.playCount/index.showCount"
    - "Run-grouping is a pure DOM-free fn with a locally re-declared FinalizedShowInput (never imports app types); UTC Date.parse on YYYY-MM-DD, zero Date.now"
key-files:
  created:
    - packages/core/src/live/run-grouping.ts
    - packages/core/test/run-grouping.test.ts
  modified:
    - packages/core/src/model/predict.ts
    - packages/core/src/model/index-build.ts
    - packages/core/src/config.ts
    - packages/core/src/index.ts
    - packages/core/test/model/predict.test.ts
decisions:
  - "eraPriorSmoothingK rescaled 1 -> 0.08 (per-show scale, A1 0.05-0.1) — FLAG for the backtest/human-verify gate"
  - "runGapDays default 2 (D-03/A2) — FLAG for the backtest/human-verify gate"
  - "Rule 1 fix of the 11-01 fixture HOT node: career playCount 300 -> 120; 300/241 was a dimensionally-impossible >1 plays/show that the corrected per-show ratio rightly scored < 1. Retired node + all assertions/thresholds untouched — the floor RED->GREEN signal is preserved."
metrics:
  duration: ~12min
  completed: 2026-07-19
---

# Phase 11 Plan 03: Prediction-Model Correctness (PRED-01/02/03) Summary

Fixed the eraPrior unit mismatch so the retired-song floor is reachable at production scale (the 11-01 RED test flips GREEN), and added the pure `currentRunShowSets` run-grouping that produces the `recentShowSongSets` window the already-correct `rotationSuppression` is starved of in live use. Pure core only — no app wiring (that is plan 11-05).

## What Was Built

### Task 1 — PRED-02 eraPrior unit fix (commit `529d46c`)

- **`MatrixIndex.showCount`** (`index-build.ts`): added `showCount: number` to the interface and `showCount: matrix.showCount` to the `buildMatrixIndex` return. The value already lives on the matrix header (`matrix.ts:186`) — no rebuild, no schemaVersion bump. No hand-built `MatrixIndex` literal exists anywhere (all consumers go through `buildMatrixIndex`), so the additive field breaks no caller.
- **`eraPrior`** (`predict.ts`): `allTimeRate` changed from `basePlayRate(B, index)` (the catalog-marginal share, ~0.001–0.02 — a ~100× smaller unit that pinned the ratio near 1.0 and left `eraPriorFloor` dead) to `node.playCount / index.showCount` (career plays-per-show, dimensionally matching the per-show `eraRate`). Added a `!node || index.showCount <= 0 → return 1` guard. `basePlayRate` stays exported/unchanged (other callers use it); `eraPlayCount` is NOT recomputed (baked into the frozen matrix — RESEARCH anti-pattern).
- **`eraPriorSmoothingK`** (`config.ts`): rescaled `1 → 0.08` (per-show scale, A1 range 0.05–0.1) with an updated `[ASSUMED]` comment explaining the per-show rescale. Mandatory — leaving `k=1` re-swamps the per-show rates and re-breaks the floor.

Arithmetic on the fixed code, retired song (eraPlayCount 0, playCount 50, showCount 241): `ratio = (0 + 0.08) / (50/241 + 0.08) = 0.08 / 0.2875 ≈ 0.278 → clamps to eraPriorFloor 0.3`. The floor now fires.

### Task 2 — PRED-01/PRED-03 run-grouping (commit `2cce7a8`)

- **`packages/core/src/live/run-grouping.ts`** (new, pure, DOM-free): `currentRunShowSets(finalized, currentDate, cfg, resetBoundaryDate?)` filters out shows `>= currentDate` and (when set) `>= resetBoundaryDate`, sorts newest-first, then walks back from `currentDate` keeping shows while each consecutive calendar-day gap is `<= cfg.runGapDays`, stopping at the first larger gap. Returns the kept shows' `songIds` arrays newest-first. `FinalizedShowInput { date; songIds }` is re-declared locally (mirroring suggest.ts's `TonightGuardInput` idiom) — never imports app/DOM types. Date arithmetic is UTC `Date.parse` on `YYYY-MM-DD`, no `Date.now`.
- **`config.runGapDays: 2`** — single named `[ASSUMED] D-03/A2` value.
- **Barrel** (`index.ts`): exports `currentRunShowSets` + `type FinalizedShowInput` beside the suggest/bind exports.
- **`run-grouping.test.ts`** (8 tests): in-run inclusion (newest-first), gap-break exclusion, exactly-`runGapDays` boundary (inclusive), reset-boundary exclusion, active-show exclusion, empty input, beyond-gap → `[]`, and a sanity feed proving a run-played song scores lower through the unchanged `rotationSuppression`.

`rotationSuppression` (`predict.ts:251`) is UNCHANGED — it further slices this window to `cfg.rotationWindowShows`.

## Signature for plan 11-05

```ts
export interface FinalizedShowInput { date: string; songIds: number[] }
export function currentRunShowSets(
  finalized: FinalizedShowInput[],
  currentDate: string,
  cfg: { runGapDays: number },
  resetBoundaryDate?: string,
): number[][]
```

Plan 11-05 supplies `finalized` from a Dexie `status === "finalized"` query (excluding the active session), `currentDate` = the active show's OWN date, `cfg` = `config`, and the optional reset marker from `db.meta`; it passes the result as the 3rd `buildShowContext` arg (currently hardcoded `[]`).

## Values flagged for the backtest / human-verify gate

- `eraPriorSmoothingK = 0.08` (was 1) — per-show smoothing constant; owner-tunable.
- `runGapDays = 2` — run-break threshold in calendar days; owner-tunable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the 11-01 fixture's dimensionally-invalid HOT node**
- **Found during:** Task 1 (running `predict.test.ts` after the fix).
- **Issue:** With the corrected per-show arithmetic the 11-01 HOT node (`playCount: 300`, `eraPlayCount: 38`, `showCount: 241`) computes `eraRate = 0.95` plays/show recently vs `allTimeRate = 300/241 ≈ 1.245` plays/show career — i.e. it plays LESS per show now than over its career, so `eraPrior ≈ 0.777 < 1`. The `hot > 1` assertion failed. A career rate of 1.245 plays/show is also physically impossible for a single song. The node was tuned against the OLD marginal-share denominator (300/14400 ≈ 0.02, which gave ~1.91 on the buggy code); its author assumed the fix would preserve `hot > 1` without recomputing. No value of `k` can flip `(0.95+k)/(1.245+k)` above 1.
- **Fix:** Changed only the HOT node's career `playCount` 300 → 120 (career rate 120/241 ≈ 0.50 plays/show, well under the 0.95 recent rate → genuinely hot, `eraPrior ≈ 1.78`). The RETIRED node and every assertion/threshold are untouched, so the floor RED→GREEN deliverable (`retiredFactor <= eraPriorFloor`) is fully preserved. This is a fixture bug the PRED-02 fix exposed, not a weakening of the RED gate.
- **Files modified:** `packages/core/test/model/predict.test.ts`
- **Commit:** `529d46c`

## Verification

- `npx vitest run packages/core/test/model/predict.test.ts` → 17 passed (the 11-01 era-prior Test 10 is now GREEN; retired reaches `eraPriorFloor`, hot > 1 ≤ ceil, unknown id → 1).
- `npx vitest run packages/core/test/run-grouping.test.ts` → 8 passed.
- `npx vitest run --project @guezzer/core` (full core suite) → **326 passed / 0 failed** (prior 318 + 8 new run-grouping tests).
- `npx tsc --noEmit` in `packages/core` → exit 0 (clean).
- No React/DOM/browser imports added to `packages/core` (run-grouping re-declares `FinalizedShowInput` locally; UTC `Date.parse` only, no `Date.now`).
- Barrel `packages/core/src/index.ts` exports `currentRunShowSets` + `FinalizedShowInput`.

## TDD Gate Compliance

Task 1 is the GREEN gate of the multi-plan PRED-02 TDD cycle: the RED `test(11-01)` commit (`5cdfb46`) landed the failing production-scale era-prior test; this plan's `feat(11-03)` commit (`529d46c`) flips it green by fixing the production `eraPrior` arithmetic. Task 2 is a new pure fn delivered with its fixture tests in the same GREEN commit (`2cce7a8`).

## Self-Check: PASSED

- FOUND: packages/core/src/live/run-grouping.ts
- FOUND: packages/core/test/run-grouping.test.ts
- FOUND: packages/core/src/model/predict.ts (modified — eraPrior)
- FOUND: packages/core/src/model/index-build.ts (modified — showCount)
- FOUND: packages/core/src/config.ts (modified — eraPriorSmoothingK, runGapDays)
- FOUND: packages/core/src/index.ts (modified — barrel)
- FOUND: commit 529d46c (feat 11-03 PRED-02 fix)
- FOUND: commit 2cce7a8 (feat 11-03 run-grouping)
