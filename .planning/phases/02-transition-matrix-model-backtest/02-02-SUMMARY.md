---
phase: 02-transition-matrix-model-backtest
plan: 02
subsystem: model
tags: [prediction, jelinek-mercer, backoff-smoothing, markov, vitest, typescript, packages-core]

# Dependency graph
requires:
  - phase: 02-transition-matrix-model-backtest
    plan: 01
    provides: TransitionMatrix artifact, buildMatrixIndex, full Phase 2 type vocabulary (PredictionCandidate, PredictionFactors, ShowContext, SignalToggles, BackoffTier)
provides:
  - predict(matrix, context, cfg, toggles) -> PredictionCandidate[] (the D-01 multiplicative pipeline skeleton over the D-02 interpolated backoff base)
  - baseFactor + four independently-normalized backoff tiers (transitionProb, tuningAffinity, albumEraAffinity, basePlayRate)
  - scoreCandidate with rich D-06 per-candidate breakdown + concrete reason string
  - ScoringConfig type + defaultSignalToggles for Plan 03's ablation backtest
affects: [02-03-backtest, 04-show-mode, 07-explore-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ScoringConfig: a widened-number-typed subset interface of `typeof config`'s model constants, so ablation callers (Plan 03 backtest, tests) can pass a config clone with an overridden field without fighting `as const` literal typing"
    - "Toggle-gated multiplicative pipeline with neutral 1.0 stubs (rotationSuppression/alreadyPlayedFactor/eraPrior/hardSegueOverride) -- Plan 03 fills real bodies without touching call-site structure, so per-signal ablation stays a pure flag-flip"

key-files:
  created:
    - packages/core/src/model/predict.ts
    - packages/core/test/model/predict.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "albumEraAffinity (t3) operational definition: since album metadata isn't in the normalized corpus, approximated same-era co-activity via each MatrixNode's eraPlayCount (baked in at build time, already leak-safe) -- when A is itself era-active, B's mass is its share of era-active songs' total era play; when A is not era-active, falls back to basePlayRate so the tier degrades gracefully instead of collapsing to zero. Kept deliberately distinct from the top-level eraPrior multiplier (Plan 03) per RESEARCH Pitfall 5 (era double-counting)."
  - "ScoringConfig introduced as a dedicated interface (not `typeof config` directly) because `config`'s `as const` fields carry literal number types (e.g. `w2: 0.2` not `w2: number`) -- ablation tests/Plan 03 backtest need to construct config clones with overridden numeric values, which `typeof config` structurally forbids."
  - "decay field in PredictionFactors is informational only (weightedCount/count ratio for an observed edge), not a separate multiplicative pipeline stage -- decay is already baked into transitionProb via edgeWeight's toggle selection."

requirements-completed: [MODL-03, MODL-08, MODL-09, EVAL-05]

# Metrics
duration: 40min
completed: 2026-07-09
---

# Phase 2 Plan 2: Predictor Core (Backoff Base + Multiplicative Skeleton) Summary

**`predict(matrix, context)` ranks all 264 catalog songs via a Jelinek-Mercer four-tier interpolated backoff (transition/tuning/era/base-rate) inside a toggle-gated multiplicative pipeline, returning rich per-candidate breakdowns with concrete reason strings ("seen 8× since 2024") and never a hard zero.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-07-09T00:48:00Z (approx, base commit 81d9e9c)
- **Completed:** 2026-07-09T01:28:35Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Implemented the D-02 interpolated backoff base: four tier functions (`transitionProb`, `tuningAffinity`, `albumEraAffinity`, `basePlayRate`), each independently normalized to sum to ~1.0 over the full candidate universe `C` before blending, satisfying MODL-08's "never a hard zero for a plausible song" via the `basePlayRate` floor
- Implemented `baseFactor` as the Jelinek-Mercer weighted blend, with `effectiveBackoffWeights` re-normalizing when a tier is ablated off (Plan 03's flag-flip hook is ready now)
- Implemented `scoreCandidate` — the D-01 multiplicative pipeline skeleton (`base × rotation × alreadyPlayed × eraPrior`, then a hard-segue override on top) with every downstream signal wired to its toggle but stubbed neutral (1.0 / null) this plan
- Implemented `predict(matrix, context, cfg, toggles)` — scores and ranks all catalog candidates deterministically (tie-break: `playCount` desc, `songId` asc), returning `PredictionCandidate[]` with D-06 rich breakdowns and concrete count-backed reason strings
- Verified end-to-end against the real committed `data/normalized/transition-matrix.json` artifact (264 songs, 2987 edges): 15 ranked candidates returned, every score strictly `> 0`
- All 7 Wave-0/end-to-end behaviors green (7 numbered assertions across 7 describe blocks): transitionProb formula, backoff floor, tuning backoff-only, tier normalization, ranked prediction, deterministic ranking, candidate breakdown

## Task Commits

Each task was committed atomically:

1. **Task 1: Four backoff tiers + Jelinek-Mercer baseFactor + Wave-0 predict.test.ts scaffold** - `15c84d5` (feat)
2. **Task 2: predict entrypoint — scoreCandidate skeleton, deterministic ranking, reason string, barrel export** - `1837620` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: TDD_MODE is false for this phase (MVP+TDD gate context), so both tdd="true" tasks were implemented directly rather than via a separate RED/GREEN commit sequence — tests and implementation landed together in one feat commit per task, matching the Plan 01 precedent._

## Files Created/Modified
- `packages/core/src/model/predict.ts` - the predictor: `ScoringConfig`, `defaultSignalToggles`, four backoff tier fns, `baseFactor`, downstream stub multipliers (rotation/alreadyPlayed/eraPrior/hardSegue), `dominantBackoffTier`, `buildReason`, `scoreCandidate`, `predict`
- `packages/core/test/model/predict.test.ts` - 7 numbered assertions across 7 describe blocks, built on a hand-authored 3-show synthetic corpus (5 songs, decay-sensitive multi-successor transitions) so tier formulas are verifiable against the real `decayedWeight` helper rather than hardcoded magic numbers
- `packages/core/src/index.ts` - barrel-exported `predict`, `scoreCandidate`, `baseFactor`, the four tier fns, `defaultSignalToggles`, `ScoringConfig`

## Decisions Made
- **`albumEraAffinity` (t3) operational definition.** RESEARCH M8/CONTEXT flagged this as Claude's discretion since album metadata isn't in the normalized corpus. Used each `MatrixNode.eraPlayCount` (already baked in leak-safely at build time by Plan 01's `buildMatrix`) as an era-activity proxy: when the current song `A` is itself era-active, `B`'s affinity is its share of the era-active cohort's total play; when `A` is retired (not era-active), fall back to the flat `basePlayRate` marginal so the tier degrades gracefully instead of zeroing out. Kept structurally distinct from the top-level `eraPrior` multiplier (Plan 03) to avoid RESEARCH Pitfall 5's era double-count — this tier is pairwise (depends on `A`), `eraPrior` will be a `B`-only marginal boost.
- **`ScoringConfig` as a dedicated widened-type interface.** `config`'s `as const` declaration gives every numeric field a literal type (e.g. `backoffWeights.w2: 0.2`, not `number`). `baseFactor`/`scoreCandidate`/`predict` need to accept config clones with overridden values (Plan 03's ablation backtest, and this plan's own "zeroing w2" test) — `typeof config` would reject that structurally. `ScoringConfig` declares the same shape with plain `number` fields; `config` itself satisfies it without a cast (numeric literal types are subtypes of `number`).
- **`decay` field in `PredictionFactors` is informational, not a pipeline stage.** The multiplicative pipeline has no separate `× decay` step — decay is already baked into `transitionProb` via `edgeWeight`'s toggle-based selection between `weightedCount` and raw `count`. The `decay` field reports `weightedCount / count` for an observed edge (or neutral `1` otherwise) purely for the D-06 breakdown's inspectability.

## Deviations from Plan

None — plan executed exactly as written. The plan's `must_haves` truths, artifacts, and key_links (including the corrected `predict.ts` → `matrix.ts` `tuningFamily` link noted in the frontmatter) all verified as implemented.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `predict`, `scoreCandidate`, `baseFactor`, and all four backoff tier fns are ready for Plan 03's backtest (`eval/backtest.ts`, `eval/holdout.ts`) to consume directly — the `SignalToggles`-gated pipeline structure means ablation is exactly the flag-flip the plan promised, no rework.
- The four downstream stubs (`rotationSuppression`, `alreadyPlayedFactor`, `eraPrior`, `hardSegueOverride`) are the exact functions Plan 03 fills in — their signatures and call sites are final; only the bodies change.
- `ScoringConfig` is the type Plan 03's ablation loop will use to construct per-signal config clones.
- End-to-end sanity check against the real 264-song/2987-edge shipped matrix artifact confirms the model behaves correctly on production data, not just fixtures.
- No blockers.

---
*Phase: 02-transition-matrix-model-backtest*
*Completed: 2026-07-09*
