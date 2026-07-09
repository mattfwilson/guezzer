---
phase: 02-transition-matrix-model-backtest
plan: 03
subsystem: model
tags: [prediction, markov, rotation-suppression, hard-segue, era-prior, vitest, typescript, packages-core]

# Dependency graph
requires:
  - phase: 02-transition-matrix-model-backtest
    plan: 02
    provides: predict(matrix, context, cfg, toggles) skeleton, ScoringConfig, defaultSignalToggles, toggle-gated stub call sites for rotation/alreadyPlayed/eraPrior/hardSegue
provides:
  - rotationSuppression(B, ctx, cfg) — real MODL-06 body, rotationPenaltyPerShow^n over the last rotationWindowShows recent-tour shows
  - alreadyPlayedFactor(B, ctx, cfg) — real D-05/MODL-10 body, near-zero once-per-candidate trail-membership multiplier
  - eraPrior(B, index, cfg) — real MODL-07 body, smoothed relative "hot now vs career" multiplier clamped to [floor, ceil]
  - hardSegueOverride(A, B, index, cfg) + applyOverride(score, override, cfg) — real D-04/MODL-05 consistency-gated pin/boost pipeline
  - Completed D-01 multiplicative pipeline — every Phase 2 model signal now has a real, independently-toggleable body
affects: [02-04-backtest, 02-05-backtest-cli, 04-show-mode, 07-explore-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SegueOverride descriptor ({kind: 'pin'|'boost', value}) returned by hardSegueOverride, consumed by a separate applyOverride(score, override, cfg) — keeps the gating decision and its numeric application independently testable/inspectable (D-06 breakdown)."
    - "Shared-ceiling cap: applyOverride caps BOTH the boost and pass-through paths at cfg.hardSegueOverrideCeiling (not just pin) — reuses the existing config constant rather than introducing a new one, closing the gap where eraPrior's 2.0x ceiling or hardSegueBoost's 3.0x could otherwise push an un-gated candidate's score past 1.0."

key-files:
  created: []
  modified:
    - packages/core/src/model/predict.ts
    - packages/core/test/model/predict.test.ts

key-decisions:
  - "eraPrior's allTimeRate(B) reuses basePlayRate(B, index) (t4's marginal) rather than a separately-computed playCount/totalShows rate. The plan's action prose referenced 'totalShows' but eraPrior's locked signature is (B, index, cfg) — index alone has no total-show-count field, and RESEARCH M8 itself defines allTimeRate(B) as 't4's marginal'. Reusing basePlayRate keeps the signature exact, avoids scope creep into index-build.ts (out of this plan's files_modified), and stays self-normalizing over the candidate universe C."
  - "[Rule 1 — bug fix] applyOverride caps the boost and null-override paths at cfg.hardSegueOverrideCeiling, not just pin. Without this, the multiplicative pipeline isn't bound to [0,1]: eraPrior alone can reach 2.0x and hardSegueBoost is 3.0x, either of which can push a non-gated candidate's score past 1.0 — discovered via the Task 2 'no false 100%' test failing with a real 1.0029 score before the fix. The cap reuses the existing hardSegueOverrideCeiling constant (no new config field, CLAUDE.md single-config-file constraint) so nothing except a genuinely gated hard segue can approach the near-1.0 ceiling."
  - "hardSegueFlag is true only for the 'pin' kind, never 'boost' — a boosted (inconsistent/one-off) segue is a strong multiplicative signal but structurally distinct from a consistency-verified gated override, matching the plan's D-04 distinction."

requirements-completed: [MODL-04, MODL-05, MODL-06, MODL-07, MODL-10, EVAL-05]

# Metrics
duration: ~65min
completed: 2026-07-09
---

# Phase 2 Plan 3: Real Multiplier Bodies (Rotation, Already-Played, Era-Prior, Hard-Segue) Summary

**Completes the D-01 multiplicative prediction pipeline: rotation suppression, near-zero-not-zero repeat conditioning, a smoothed relative era-hotness multiplier, and a consistency-gated hard-segue override/boost — closing a real "score can exceed 1.0" bug found along the way.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-07-09T00:43:00Z (approx, base commit 436e9bc)
- **Completed:** 2026-07-09T01:48:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Implemented `rotationSuppression(B, ctx, cfg)` (MODL-06): `rotationPenaltyPerShow ^ n` over the last `rotationWindowShows` entries of `ctx.recentShowSongSets`, approaching hard exclusion in a multi-night run without ever hitting exactly 0
- Implemented `alreadyPlayedFactor(B, ctx, cfg)` (D-05/MODL-10): boolean membership check against `ctx.trail`, applying `cfg.alreadyPlayedFactor` (≈0.02) once per candidate regardless of repeat occurrences — sandwich/reprise-safe
- Implemented `eraPrior(B, index, cfg)` (MODL-07): a relative "is B hot right now vs its career" multiplier, `(eraRate+k)/(allTimeRate+k)` smoothed and clamped to `[eraPriorFloor, eraPriorCeil]`, structurally orthogonal to `albumEraAffinity` (t3) per RESEARCH Pitfall 5
- Confirmed the pre-existing decay-toggle path in `transitionProb` (wired in Plan 02 via `edgeWeight`) with a dedicated Task 1 test
- Implemented `hardSegueOverride(A, B, index, cfg)` (D-04/MODL-05): `segueRate(A→B) = segueCount/totalExits(A)`, gated on both a consistency threshold and a minimum-support floor; returns a `{kind: "pin"|"boost", value}` descriptor or `null`, reading only the pre-accumulated `edge.segueCount` (never re-deriving segue direction — correct by construction per matrix.ts's Pitfall-1-safe accumulation)
- Implemented `applyOverride(score, override, cfg)`: `pin` forces the near-1.0 ceiling; `boost` and pass-through are both capped at the same ceiling, closing a real bug (see Deviations)
- Extended `buildReason` with the D-06 "notated segue N/M times since YYYY" string for gated candidates
- 9 new Wave-0 fixture tests (Test 8–16) across both tasks, all with concrete expected values; full core suite (85 tests) and `tsc --noEmit` green

## Task Commits

Each task was committed atomically:

1. **Task 1: Decay toggle + rotation suppression + already-played + era prior multipliers** - `f6c5fe8` (feat)
2. **Task 2: Consistency-gated hard-segue override + applyOverride + D-06 segue reason string** - `31cf17c` (feat)

_Note: TDD_MODE is false for this phase (MVP+TDD gate context), so both `tdd="true"` tasks were implemented directly rather than via a separate RED/GREEN commit sequence — tests and implementation landed together in one feat commit per task, matching the Plan 02 precedent._

## Files Created/Modified
- `packages/core/src/model/predict.ts` — real bodies for `rotationSuppression`, `alreadyPlayedFactor`, `eraPrior`, `hardSegueOverride`, plus the new `applyOverride`, `totalExits`, `SegueOverride`, `clamp` helpers; `buildReason`/`scoreCandidate` wired to the completed pipeline
- `packages/core/test/model/predict.test.ts` — 9 new numbered assertions (Test 8–16) across 9 describe blocks: already-played, rotation suppression, era prior (incl. clamp-ceiling case), decay toggle, hard segue pin, inconsistent-support boost, segue direction, no-false-100%, D-06 segue reason string

## Decisions Made
- **eraPrior's `allTimeRate` reuses `basePlayRate`.** See key-decisions above — keeps the plan's locked 3-arg signature exact and avoids touching `index-build.ts` (outside this plan's scope) to thread a separate total-show count.
- **[Rule 1 bug fix] Shared ceiling cap in `applyOverride`.** Discovered via the Task 2 "no false 100%" test genuinely failing (`1.0029 to be less than 1`) before the fix — the multiplicative pipeline isn't naturally bound to `[0,1]` once `eraPrior` (up to 2.0×) or `hardSegueBoost` (3.0×) are in play. Capping the `boost`/pass-through paths at `cfg.hardSegueOverrideCeiling` (the same constant `pin` already uses) restores "never 100% except a notated hard segue" (CONTEXT D-02) without adding a new config field.
- **`hardSegueFlag` reflects only the `pin` kind.** A boosted-but-ungated segue is still a strong signal but is not a "hard segue" in the D-04 sense — keeps the flag meaningful for the eventual backtest's hard-segue/free-choice split (M7).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Multiplicative score could exceed 1.0 for a non-gated candidate**
- **Found during:** Task 2 (writing the "no false 100%" test)
- **Issue:** `applyOverride`'s original `pin`/`boost`/`null` implementation only clamped the `pin` path. `base` (≤1) × `rotation`/`alreadyPlayed` (≤1) × `eraPrior` (up to `eraPriorCeil`=2.0), or the same combined with `hardSegueBoost`=3.0 for an inconsistent segue, could push a score above 1.0 — violating CONTEXT D-02's "never 100% except a notated hard segue" and the plan's own acceptance criterion. Verified concretely: the synthetic-corpus end-to-end test produced a real candidate scored `1.0028857...`.
- **Fix:** `applyOverride` now caps the `boost` and pass-through (`null`) paths at `cfg.hardSegueOverrideCeiling` too, reusing the existing config constant (no new magic number, CLAUDE.md single-config-file constraint).
- **Files modified:** `packages/core/src/model/predict.ts` (`applyOverride`), `packages/core/test/model/predict.test.ts` (Test 13 assertions updated to verify against the actual capped formula rather than assuming an uncapped boost)
- **Verification:** `npx vitest run packages/core -t "no false 100%"` and the full 85-test suite pass; `npx tsc -p packages/core --noEmit` clean
- **Committed in:** `31cf17c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary for correctness — without it the model could report false 100% confidence on ordinary free-choice transitions, directly undermining the phase's core trust requirement. No scope creep; no new config surface.

## Issues Encountered
None beyond the deviation above (found and fixed during the plan's own test-writing, not a separate investigation).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The D-01 multiplicative pipeline is now fully real: `predict`/`scoreCandidate` combine transition frequency, recency decay, rotation suppression, already-played conditioning, era prior, and the consistency-gated hard-segue override/boost — every Phase 2 signal (MODL-03 through MODL-10) has a real, independently-toggleable body, ready for Plan 02-04/02-05's walk-forward backtest and per-signal ablation (D-14) to consume `predict`/`scoreCandidate`/`defaultSignalToggles` directly with zero rework.
- `hardSegueOverride`/`applyOverride`'s `SegueOverride` descriptor and the shared-ceiling cap are exported and ready for the backtest's hard-segue/free-choice split (M7) and ablation "off" semantics (M6: `hardSegue` toggle → no override/boost, already wired via `toggles.hardSegue` in `scoreCandidate`).
- Fixture unit tests with known expected outputs now cover every signal in this plan, satisfying phase success criterion 5 for MODL-04/05/06/07/10.
- No blockers.

---
*Phase: 02-transition-matrix-model-backtest*
*Completed: 2026-07-09*
