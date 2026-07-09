---
phase: 02-transition-matrix-model-backtest
verified: 2026-07-09T03:00:00Z
status: passed
score: 5/5 roadmap success criteria verified (16/16 requirement IDs satisfied)
overrides_applied: 0
---

# Phase 2: Transition Matrix, Model & Backtest Verification Report

**Phase Goal:** A deterministic, inspectable prediction model exists as a frozen JSON artifact, and the backtest proves (or honestly disproves) that it can be trusted at a live show
**Verified:** 2026-07-09T03:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running build-model emits a versioned, serializable `TransitionMatrix` JSON with a frozen schema + as-of cutoff, set-boundary/encore transitions excluded | ✓ VERIFIED | `packages/core/src/model/matrix.ts:125-152` walks only `set.performances` position-adjacent pairs (never across sets/encore); `passesAsOf` (lines 32-36) implements the exclusive `(date, showOrder)` tuple bound; committed `data/normalized/transition-matrix.json` has `schemaVersion: 1`, 264 nodes, 2987 edges; re-running `node packages/core/src/cli/build-model.ts` produced a byte-identical file (`git status --porcelain` empty after rebuild) |
| 2 | Predictor returns ranked candidates combining transition frequency, decay, hard-segue override, rotation suppression, era prior, and tuning-family backoff — already-played near-zero, nothing hard-zero, only notated segues reach ~100% | ✓ VERIFIED | `packages/core/src/model/predict.ts` implements all six signals as toggle-gated pure functions (`transitionProb`, `tuningAffinity`, `albumEraAffinity`, `basePlayRate`, `rotationSuppression`, `alreadyPlayedFactor`, `eraPrior`, `hardSegueOverride`/`applyOverride`); Wave-0 tests assert the "backoff floor" (>0, never 0), "already played" (≈0.02, never 0), "no false 100%" (only pinned hard segues reach the 0.97 ceiling) |
| 3 | Backtest runs from Node CLI with zero browser deps, holds out the most recent complete tour, reports top-1/5/10 overall + hard-segue/free-choice split | ✓ VERIFIED | `packages/core/src/eval/backtest.ts` + `eval/holdout.ts` are pure TS with no DOM/React import (`packages/core/package.json` has zero UI deps, `tsconfig.json` `lib: ["ES2023"]`); `findHoldoutShows` identifies by latest-dated show's tourId (never max id); committed `data/backtest-report.md`/`data/backtest.json` show holdout "2025 Phantom Island Australia Tour" (9 shows, 154 eval transitions), overall top-1 54.5%/top-5 66.9%/top-10 74.0%, split by hard-segue (n=36) vs free-choice (n=118) |
| 4 | Per-feature ablation report shows accuracy with each signal toggled off | ✓ VERIFIED | `runBacktest`'s `ABLATION_SIGNALS` loop (`eval/backtest.ts:172-229`) re-runs the identical `walkForward` path per signal (`decay`, `rotation`, `alreadyPlayed`, `eraPrior`, `hardSegue`, `tuning`, `albumEra`) with one `SignalToggles` flag flipped; committed `data/backtest.json`'s `ablation` array has 7 entries each with `deltaVsFull`; `data/backtest-report.md` renders the ablation table; "report-only, no gate" confirmed by test + code inspection (no throw, no pass/fail field) |
| 5 | All model constants live in a single config file; unit tests on fixture setlists with known outputs pass for the scoring pipeline | ✓ VERIFIED | All 15 Phase-2 numeric constants live in `packages/core/src/config.ts` (decayHalfLifeDays, backoffWeights, rotation/alreadyPlayed/hardSegue/eraPrior params, candidateListSize, etc.), each doc-commented with its research citation; `npx vitest run packages/core` → 96/96 tests pass across `matrix.test.ts`, `predict.test.ts`, `backtest.test.ts` on named fixtures with concrete expected values; `npx tsc -p packages/core --noEmit` clean |

**Score:** 5/5 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/model/matrix.ts` | `buildMatrix(corpus, asOf, cfg) → TransitionMatrix` | ✓ VERIFIED | Exists, exported, wired into CLI and backtest; boundary/as-of/decay logic confirmed by code read + passing tests |
| `packages/core/src/model/decay.ts` | `decayedWeight` exponential half-life helper | ✓ VERIFIED | Exists, exported, used by `matrix.ts` |
| `packages/core/src/model/index-build.ts` | `buildMatrixIndex(matrix) → {edgesFrom, nodeById}` | ✓ VERIFIED | Exists, exported, used by `predict.ts` |
| `packages/core/src/cli/build-model.ts` | corpus → `transition-matrix.json` CLI | ✓ VERIFIED | Runs, exits 0, byte-stable across reruns (confirmed via live rerun) |
| `data/normalized/transition-matrix.json` | Frozen matrix artifact | ✓ VERIFIED | Committed, `schemaVersion: 1`, 264 nodes / 2987 edges, byte-stable |
| `packages/core/src/model/predict.ts` | `predict`, `baseFactor`, tier fns, `scoreCandidate`, all 5 real multiplier bodies | ✓ VERIFIED | All functions present with real (non-stub) bodies; barrel-exported |
| `packages/core/test/model/predict.test.ts` | Fixture-based scoring tests | ✓ VERIFIED | 16 numbered assertions, all passing |
| `packages/core/src/eval/holdout.ts` | `findHoldoutShows` | ✓ VERIFIED | Latest-dated-show tour identification, throws loudly on sentinel one-off |
| `packages/core/src/eval/backtest.ts` | `runBacktest` with walk-forward + ablation | ✓ VERIFIED | Both metrics loop and ablation loop present, share single `walkForward` code path |
| `packages/core/src/cli/run-backtest.ts` | corpus → paired `.md`+`.json` CLI | ✓ VERIFIED | Runs, exits 0, `escapeMarkdownExcerpt` used 5×, byte-stable across reruns (confirmed via live rerun) |
| `data/backtest-report.md` / `data/backtest.json` | Committed trust report | ✓ VERIFIED | Both committed, contain real numbers matching the current (post-CR-01-fix) code, byte-identical after live rerun |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `cli/build-model.ts` | `model/matrix.ts` | `buildMatrix(` call | ✓ WIRED | Confirmed by reading CLI + successful artifact emission |
| `model/matrix.ts` | `model/decay.ts` | `decayedWeight(` in weightedCount accumulation | ✓ WIRED | Line 146 of `matrix.ts` |
| `model/predict.ts` | `model/index-build.ts` | `buildMatrixIndex(` | ✓ WIRED | Line 488 of `predict.ts` |
| `model/predict.ts` | `model/matrix.ts` (`tuningFamily`) | tier reads baked-in `MatrixNode.tuningFamily`, no direct I/O | ✓ WIRED | `predict.ts` module doc confirms zero I/O; `tuningAffinity` reads `node.tuningFamily` |
| `model/predict.ts` (hard segue) | `model/matrix.ts` (`segueCount`) | `hardSegueOverride` reads edge `segueCount`/`totalExits` | ✓ WIRED | Confirmed by code read and passing "hard segue override"/"segue direction" tests |
| `eval/backtest.ts` | `model/matrix.ts` | rebuild matrix as-of each held-out show | ✓ WIRED | `walkForward` calls `buildMatrix(corpus, asOf, cfg)` per show, exclusive bound |
| `eval/backtest.ts` | `model/predict.ts` | score each within-set transition | ✓ WIRED | `evalTransitions` calls `predict(matrix, ctx, cfg, toggles)` |
| `eval/backtest.ts` | `eval/holdout.ts` | identify holdout tour | ✓ WIRED | `runBacktest` calls `findHoldoutShows(corpus, cfg.tourIdSentinel)` |
| `cli/run-backtest.ts` | `eval/backtest.ts` | `runBacktest(` then paired write | ✓ WIRED | Confirmed by reading CLI + successful re-emission with unchanged byte content |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full core test suite passes | `npx vitest run packages/core` | 10 files, 96 tests passed | ✓ PASS |
| Core typechecks clean | `npx tsc -p packages/core --noEmit` | no output, exit 0 | ✓ PASS |
| `build-model` CLI emits byte-stable artifact | `node packages/core/src/cli/build-model.ts` (rerun live) | "264 nodes, 2987 edges" logged; `git status --porcelain data/normalized/transition-matrix.json` empty | ✓ PASS |
| `run-backtest` CLI emits byte-stable paired report reflecting current (post-fix) code | `node packages/core/src/cli/run-backtest.ts` (rerun live) | `git status --porcelain data/backtest.json data/backtest-report.md` empty | ✓ PASS |
| CR-01 self-prediction bug fix present in code | `grep -n "currentSongId" packages/core/src/model/predict.ts` | `.filter((node) => node.songId !== context.currentSongId)` at line 490, ahead of scoring | ✓ PASS |
| No debt markers in phase-modified files | `grep -rn -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across `model/`, `eval/`, `cli/build-model.ts`, `cli/run-backtest.ts`, `config.ts`, `domain/types.ts` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-05 | 02-01 | Set-boundary/encore transitions excluded from matrix | ✓ SATISFIED | `matrix.ts` within-set-only edge walk; `matrix.test.ts` "boundary exclusion" tests (2013-encore, 2022-rr1010-multiset) pass |
| MODL-01 | 02-01 | Matrix is a frozen-schema serializable JSON artifact | ✓ SATISFIED | `TransitionMatrix` type + committed artifact with `schemaVersion: 1` |
| MODL-02 | 02-01 | Matrix construction takes an as-of-date cutoff | ✓ SATISFIED | `AsOfBound` exclusive-tuple param; "as-of cutoff" tests pass |
| MODL-03 | 02-02 | First-order transition frequency is the core signal | ✓ SATISFIED | `transitionProb` t1 tier; "transitionProb" test passes |
| MODL-04 | 02-01/02-03 | Exponential recency decay, tunable half-life | ✓ SATISFIED | `decayedWeight`; "decay half-life"/"decay toggle" tests pass |
| MODL-05 | 02-03 | Notated hard segues override at very high confidence | ✓ SATISFIED | `hardSegueOverride`/`applyOverride`; "hard segue override"/"segue direction"/"no false 100%" tests pass |
| MODL-06 | 02-03 | Rotation suppression for recently-played songs | ✓ SATISFIED | `rotationSuppression`; "rotation suppression" test passes |
| MODL-07 | 02-03 | Base play probability / era prior as smoothing signal | ✓ SATISFIED | `eraPrior`; "era prior" test passes |
| MODL-08 | 02-02 | Sparse-data backoff chain, never hard-zero | ✓ SATISFIED | Four-tier Jelinek-Mercer blend with `basePlayRate` floor; "backoff floor" test passes |
| MODL-09 | 02-02 | Tuning-family affinity is backoff-only, never top-level | ✓ SATISFIED | `tuningAffinity` only enters `baseFactor`; `PredictionFactors` has no separate tuning multiplier field; "tuning backoff only" test passes |
| MODL-10 | 02-03 | Already-played songs drop to near-zero, sandwich-aware | ✓ SATISFIED | `alreadyPlayedFactor` (≈0.02, once-per-candidate); "already played" test passes |
| MODL-11 | 02-01 | All model constants in a single config file | ✓ SATISFIED | All 15+ Phase 2 constants in `config.ts`, no scattered magic numbers found in phase files |
| EVAL-01 | 02-04 | Backtest holds out most recent complete tour, reports top-1/5/10 overall + split | ✓ SATISFIED | `findHoldoutShows` + `runBacktest`; committed `data/backtest.json`/`.md` show real numbers |
| EVAL-02 | 02-05 | Per-feature ablation report | ✓ SATISFIED | `ABLATION_SIGNALS` loop; 7-entry `ablation` array committed |
| EVAL-03 | 02-04/02-05 | Backtest runs from Node CLI, zero browser deps | ✓ SATISFIED | `eval/backtest.ts`, `eval/holdout.ts`, `cli/run-backtest.ts` are pure TS, no DOM/React imports; `@guezzer/core/package.json` has zero UI dependencies |
| EVAL-05 | 02-01..05 | Unit tests cover scoring pipeline with known fixture outputs | ✓ SATISFIED | 96 passing tests across `matrix.test.ts`, `predict.test.ts`, `backtest.test.ts`, all using named fixtures with concrete expected values |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly these 16 IDs to Phase 2, matching the union of `requirements:` fields across all 5 plans.

**Note:** `.planning/REQUIREMENTS.md`'s checkboxes for DATA-05, MODL-01/02/03/08/09/11, EVAL-01/02/03 are still unchecked (last touched at commit `4ab317b`, mid-phase). This is a documentation-sync lag, not a code gap — the underlying implementation for every one of these IDs is verified present and working per the table above. Recommend updating the checkboxes as part of phase closeout.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/config.ts:117-118` | — | Doc-comment promises "backoffWeights ... verified by a config test" but no such automated test exists (WR-02, still open post-review) | ⚠️ Warning | Silent-drift risk if `backoffWeights` is edited without re-verifying it sums to 1.0; does not affect current correctness (values currently do sum to 1.0, confirmed) |
| `packages/core/src/cli/build-model.ts:131`, `run-backtest.ts:144` | — | `--out`/`--json-out` flags not validated for a missing trailing value (WR-04) and no path-traversal validation (WR-05), unlike `--cutoff` | ℹ️ Info | Low risk (single-owner local CLI, no attacker-facing surface); inconsistent with the project's own stated CLI-arg-validation convention; documented in 02-REVIEW.md, not required by any must-have |
| `packages/core/src/cli/build-model.ts:75`, `run-backtest.ts:119` | — | Corpus JSON loaded via unchecked type cast, no runtime schema validation on load (WR-06) | ℹ️ Info | Corpus is a committed, Phase-1 zod-validated artifact; risk is future drift, not current correctness |

All three items above were already identified in `02-REVIEW.md` as Warnings/Info (not the one Critical, which is fixed — see below) and were consciously not addressed in this phase. None block the phase goal; they are candidates for a future hardening pass.

### CR-01 Critical Bug — Verified Fixed

`02-REVIEW.md` flagged CR-01 (predict() could rank the currently-playing song as its own next-song prediction). Verified the fix is present and effective:
- `packages/core/src/model/predict.ts:489-490` filters `context.currentSongId` out of the candidate universe before scoring (commit `2aa07b3`).
- Re-ran both `build-model` and `run-backtest` CLIs live against the current code; committed `data/normalized/transition-matrix.json`, `data/backtest.json`, and `data/backtest-report.md` are byte-identical to their pre-rerun committed state — confirming the committed artifacts already reflect the fixed code (the fix does not change matrix output, and per the review's own analysis does not change backtest hit-rate numbers since real transitions are never A→A).
- `npx vitest run packages/core` (96/96 passing, including the extended predict.test.ts assertions covering the fix) and `npx tsc -p packages/core --noEmit` (clean) both confirmed post-fix.

### Human Verification Required

None. All must-haves are verifiable programmatically (pure functions, deterministic CLIs, fixture-based unit tests). No `<human-check>` blocks were deferred from any of the 5 plans (all `<verify>` blocks are `<automated>`). The manual judgment called out in CLAUDE.md/D-14 ("the owner reads `data/backtest-report.md` and judges live-readiness") is an intentional pre-Phase-4 decision point, not a Phase 2 completion blocker — Phase 2's goal is that the report exists and honestly reports the numbers, which is verified true.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria are verified true against the actual codebase (not just SUMMARY.md claims): the frozen matrix artifact exists and is byte-stable, the predictor implements every required signal with no hard-zeros and no false-100%, the walk-forward backtest is leak-free and pure-CLI, ablation is populated and report-only, and all 16 requirement IDs trace to working, tested code. The one Critical finding from code review (CR-01) was subsequently fixed in commit `2aa07b3`, and that fix is confirmed present and effective. The remaining open review Warnings/Info items are minor, non-blocking, and already documented.

---

_Verified: 2026-07-09T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
