---
phase: 10-pre-show-validation-device-dry-run
plan: 01
subsystem: testing
tags: [tuning, validation, backtest, review-cli, data-integrity, vitest]

# Dependency graph
requires:
  - phase: 01-corpus-ingestion-schema-foundation
    provides: tuning-tags.json, deriveCatalogFromCorpus, tuningTagsFileSchema, DATA-04 spot-check
  - phase: 02-transition-matrix-model-backtest
    provides: build-model + run-backtest CLIs, backtest-report.md trust gate
provides:
  - Read-only VALID-01 tuning-review CLI (runReviewTuningTags / formatReviewSummary / formatReviewReport)
  - Owner-confirmed tuning-family tags — 12 canonical spot-checks + hand-tagged overrides eyeballed
  - D-03 fix: 9 Infest the Rats' Nest tracks re-tagged standard → cs-standard (first non-empty cs-standard family)
  - Proof of no backtest top-k regression from the re-tag
affects: [10-02-device-dry-run, show-mode-predictions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only review CLI reuses ingest helpers (findMatchedAlbumTitles / defaultFamilyForAlbum made export-only) — never re-implements the album-join, never touches the write path"
    - "D-03 hand-edit gate: closed-vocabulary family flip + source:hand-tagged, re-run build-model + run-backtest, diff backtest-report.md for zero top-k regression before closing"

key-files:
  created:
    - packages/core/src/cli/review-tuning-tags.ts
    - packages/core/test/review-tuning-tags.test.ts
    - data/tuning-review.md
    - .planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md
    - .planning/phases/10-pre-show-validation-device-dry-run/10-01-SUMMARY.md
  modified:
    - packages/core/src/ingest/tuning-tags.ts
    - data/tuning-tags.json
    - data/normalized/transition-matrix.json
    - data/backtest.json
    - data/backtest-report.md

key-decisions:
  - "D-03 FIX branch fired: 9 Infest the Rats' Nest tracks are C# standard, re-tagged standard → cs-standard / source hand-tagged; the 12 canonical spot-checks and 36 no-album-default hand-tags confirmed correct as-is"
  - "Tuning family is a weak prediction signal — the re-tag produced ZERO backtest top-k regression (byte-identical top-k + ablation tables; only the report timestamp changed)"

patterns-established:
  - "VALID-01 review is read-only + owner-in-the-loop: the CLI surfaces candidates only human musical judgment can settle; the owner's verdict is recorded verbatim in 10-HUMAN-UAT.md"

requirements-completed: [VALID-01]

# Metrics
duration: ~24min
completed: 2026-07-18
---

# Phase 10 Plan 01: Pre-Show Validation (VALID-01) Summary

**Read-only tuning-review CLI proved the tuning-family tags musically sane, and the owner's D-03 fix re-tagged the 9 Infest the Rats' Nest tracks to cs-standard with zero backtest top-k regression.**

## Performance

- **Duration:** ~24 min (Task 1 @ 20:08 → fix commit @ 20:32)
- **Started:** 2026-07-19T00:08:23Z (Task 1 commit)
- **Completed:** 2026-07-18T21:36:14Z (D-03 fix + verdict recorded)
- **Tasks:** 3 (2 autonomous + 1 owner-verify checkpoint resolved)
- **Files modified:** 10

## Accomplishments
- Built a read-only VALID-01 review CLI that cross-checks 12 canonical songs (expected vs actual family) and surfaces cs-standard/other candidates plus hand-tagged overrides worth re-confirming — never touches the write path.
- Owner eyeballed `data/tuning-review.md`: confirmed the 12 canonical spot-checks (all pass) and the 36 no-album-default hand-tags (mostly covers) as correct.
- Applied the D-03 FIX branch: re-tagged 9 Infest the Rats' Nest tracks (Hell, Mars For the Rich, Organ Farmer, Perihelion, Planet B, Self-Immolate, Superbug, Venusian 1, Venusian 2) from `standard`/`album-default` to `cs-standard`/`hand-tagged` — the first non-empty cs-standard family in the corpus.
- Re-ran build-model + run-backtest and proved ZERO top-k regression (overall 84/103/114 identical; only the report timestamp changed).
- Recorded the VALID-01 verdict in `10-HUMAN-UAT.md` test #1 and flipped it to pass.

## Task Commits

1. **Task 1: Read-only review-tuning-tags CLI + unit test (TDD)** - `4a267d0` (feat)
2. **Task 2: Run VALID-01 sweep + scaffold owner UAT evidence** - `b634c36` (docs)
3. **Task 3: Owner review checkpoint → D-03 fix + rebuild + backtest** - `79912dd` (fix)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP) — docs commit follows.

## Files Created/Modified
- `packages/core/src/cli/review-tuning-tags.ts` - Read-only VALID-01 review CLI (spot-check + anomaly sweep, `--out` flag)
- `packages/core/test/review-tuning-tags.test.ts` - 10-assertion unit coverage of spot-check + anomaly derivation
- `packages/core/src/ingest/tuning-tags.ts` - Export-only: added `export` to `findMatchedAlbumTitles` + `defaultFamilyForAlbum` (no body/logic change)
- `data/tuning-tags.json` - D-03 fix: 9 tracks re-tagged standard → cs-standard, source hand-tagged
- `data/normalized/transition-matrix.json`, `data/backtest.json`, `data/backtest-report.md` - Regenerated post-fix
- `data/tuning-review.md` - Regenerated review report reflecting post-fix state (9 now cs-standard, no longer candidates)
- `.planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md` - VALID-01 verdict recorded, status pass

## Decisions Made
- **D-03 FIX branch (owner verdict):** the 9 Infest the Rats' Nest tracks are genuinely C# standard (down-tuned era the album-default logic can never assign) and were re-tagged. The 12 canonical spot-checks and 36 no-album-default hand-tags were confirmed correct with no change.
- **No-regression is the trust gate:** tuning is a minor prediction signal (ablation Δ ≈ 0), so the re-tag was expected to and did produce zero top-k movement. Had a meaningful regression appeared, the plan mandated stopping before commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected canonical spot-check seed anchors in Task 1**
- **Found during:** Task 1 (CANONICAL_SPOT_CHECKS seeding)
- **Issue:** The plan's suggested seed list mis-stated three anchors — it listed "Hot Water" → standard, "Planet B" → standard, and "Mars for the Rich" → standard as canonical spot-checks. "Hot Water" is microtonal-era; "Planet B" / "Mars for the Rich" are exactly the down-tuned Infest tracks under review (so they cannot be asserted `standard` anchors without begging the D-03 question).
- **Fix:** The executor self-corrected the seed set — "Hot Water" resolved to standard as actually tagged, and "Planet B" / "Mars for the Rich" were removed from the standard-anchor list and replaced with unambiguous microtonal anchors (Nuclear Fusion, Sleep Drifter, Minimum Brain Size), yielding a clean 12-pass / 0-fail canonical table.
- **Files modified:** packages/core/src/cli/review-tuning-tags.ts
- **Verification:** Review CLI prints 12 pass / 0 fail; unit test green (10/10)
- **Committed in:** `4a267d0` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — spot-check seed correctness)
**Impact on plan:** The correction kept the canonical spot-check honest (no circular assertion of the songs under D-03 review) and did not change plan scope.

## Backtest No-Regression Delta

| Split | Top-1 | Top-5 | Top-10 |
|---|---|---|---|
| Overall (before) | 84 (54.5%) | 103 (66.9%) | 114 (74.0%) |
| Overall (after)  | 84 (54.5%) | 103 (66.9%) | 114 (74.0%) |
| Δ | 0.0pp | 0.0pp | 0.0pp |

`git diff data/backtest-report.md` shows only the generation timestamp changed — the entire top-k and ablation tables are byte-identical. Post-fix family counts: 264 total — 229 standard, 26 microtonal, 9 cs-standard, 0 other, 61 hand-tagged.

## Issues Encountered
None — the checkpoint resolved cleanly on the owner's FIX verdict; the pipeline rebuild and test re-run were green first-pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VALID-01 closed: tuning model is owner-verified musically sane, recorded in `10-HUMAN-UAT.md`.
- Plan 10-02 (VALID-02 device dry-run) is unblocked — Wave 1 complete.

---
*Phase: 10-pre-show-validation-device-dry-run*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: packages/core/src/cli/review-tuning-tags.ts
- FOUND: data/tuning-review.md
- FOUND: .planning/phases/10-pre-show-validation-device-dry-run/10-01-SUMMARY.md
- FOUND: .planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md
- FOUND commit: 79912dd (fix — D-03 re-tag)
- FOUND commit: e4d32cc (docs — plan metadata)
