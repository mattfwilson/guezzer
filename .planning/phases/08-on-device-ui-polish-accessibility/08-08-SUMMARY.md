---
phase: 08-on-device-ui-polish-accessibility
plan: 08
subsystem: ui
tags: [react, orb-label-fit, geometry, circular-fit, tdd, vitest, polish-01]

# Dependency graph
requires:
  - phase: 08-on-device-ui-polish-accessibility (plan 08-06)
    provides: rectangular fitOrbLabel + catalog/boundary tests + OrbFitHarness (the regressing baseline this repairs)
provides:
  - Circle-aware fitOrbLabel (per-line chord budget + total-height budget), no more rectangular over-fit
  - Exported geometric predicate labelFitsCircle + exported CHAR_WIDTH_FACTOR (single fit-truth source)
  - Padding-subtracting PredictionOrb + reserved percent-line height; CenterNode reserved=0
  - Geometric catalog test swept over [56..112] + center width (fails-before / passes-after regression guard)
  - OrbFitHarness that measures real per-line spill vs the circle chord (no overflow:hidden, no rectangular scroll)
affects: [show-mode, orb-rendering, on-device-uat, polish-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Circular text-fit: per-line usable width = circle chord 2·√(r²−y²) at the line's vertical offset; total block (lines·lineHeight + reservedHeightPx) ≤ diameter"
    - "Fit/predicate consistency: fitOrbLabel accepts a wrap only when it passes the same labelFitsCircle predicate the catalog test asserts — a returned non-ellipsized result is a geometric fit guarantee"
    - "Geometric fail-before/pass-after regression lock swept across the full dynamic size range, not fixed sample diameters"

key-files:
  created: []
  modified:
    - packages/app/src/show/orbLabelFit.ts
    - packages/app/src/config.ts
    - packages/app/src/show/PredictionOrb.tsx
    - packages/app/src/show/CenterNode.tsx
    - packages/app/test/orbLabelFit.catalog.test.ts
    - packages/app/test/orbLabelFit.test.ts
    - packages/app/src/dev/OrbFitHarness.tsx

key-decisions:
  - "Kept CHAR_WIDTH_FACTOR at 0.55 (unchanged conservatism); tuned the geometry levers instead: LINE_HEIGHT_FACTOR 1.15→1.0, PERCENT_LINE_PX 16→12, MAX_LINES 4→5, MIN_FONT_PX 10→7"
  - "fitOrbLabel validates each candidate wrap with labelFitsCircle itself (not a min-1 char budget), guaranteeing the heuristic and the regression predicate can never disagree"
  - "7px floor is only reached by the longest names at the absolute smallest orbs (~1% of the swept range); ~78% of the catalog renders at the full 13px base"

patterns-established:
  - "Circle-aware per-line chord fit for any text-in-circle component"
  - "On-device harness measures glyph rect vs circle chord, never rectangular scrollWidth on a clipped square"

requirements-completed: [POLISH-01]

# Metrics
duration: 40 min
completed: 2026-07-18
---

# Phase 8 Plan 08: Circle-Aware Orb-Label Fit Summary

**Made `fitOrbLabel` geometrically honest — each wrapped line's usable width is the circle chord at its vertical offset and the stacked lines + reserved percent line must fit the circle's height — closing the POLISH-01 small-orb label-overflow regression, guarded by a fail-before/pass-after geometric sweep over [56..112].**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-18
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Replaced the rectangular fit (USABLE_WIDTH_FACTOR = 1, no height check) with a per-line circular chord budget + total-height budget; the fitter now rejects the near-full-diameter multi-line wraps that spilled small orbs on iPhone.
- Added the pure `labelFitsCircle` predicate and exported `CHAR_WIDTH_FACTOR` so the catalog test and the heuristic share one fit-truth source; `fitOrbLabel` accepts a wrap only if it passes that predicate.
- Wired both callers to fit the CONTENT circle: PredictionOrb subtracts its `px-1` face padding (2×4px) and reserves the 14px percent line; CenterNode keeps its 12px padding subtraction and reserves 0.
- Rewrote the catalog test to a geometric sweep across every diameter [56..112] plus the center inner width — it FAILS against the rectangular heuristic (RED) and PASSES after the circle-aware rewrite (GREEN).
- Fixed OrbFitHarness's rectangular blind spot: dropped `overflow:hidden`, and each rendered line's real width is now measured against the circle chord at its y (plus a top/bottom pole check), naming the specific spilled line.

## Task Commits

1. **Task 1 (RED): geometric predicate + swept catalog test** — `84973dd` (test) — added `labelFitsCircle` + exported `CHAR_WIDTH_FACTOR`, the three new config constants (starting values L=1.15, R=16, FACE=4), and the geometric sweep; demonstrably fails against the unchanged rectangular heuristic (geometric/height failures, not import errors).
2. **Task 2 (GREEN): circle-aware fitOrbLabel + padding-subtracting callers** — `988b26d` (fix) — rewrote the wrap algorithm to per-line chord budgets, extended `FitOrbLabelOptions` with required `lineHeightFactor`/`reservedHeightPx`, wired both callers, tuned constants to GREEN, realigned one boundary fixture.
3. **Task 3: circular OrbFitHarness** — `cbb54b2` (fix) — per-line glyph-rect-vs-chord measurement, no clip, offender list names the spilled line.

**Plan metadata:** _(this commit)_

## Final tuned constant values + rationale

| Constant | Before (08-06) | After (08-08) | Rationale |
|----------|----------------|---------------|-----------|
| `CHAR_WIDTH_FACTOR` | 0.55 | **0.55 (unchanged)** | Preserve the conservative char-advance proxy; the plan orders it last as a lever and it wasn't needed. |
| `ORB_LABEL_LINE_HEIGHT_FACTOR` | — (new) | **1.0** | First lever. A tighter line box lets more lines stack inside the circle's vertical extent so the longest names clear the height budget without dropping to an illegible floor. Started at 1.15, tuned down to 1.0. |
| `ORB_LABEL_PERCENT_LINE_PX` | — (new) | **12** | Honest reserve for the always-present `text-[14px]` percent line; 12 is the value that clears the geometric sweep. Started at 16. |
| `ORB_LABEL_FACE_PADDING_PX` | — (new) | **4** | The prediction-orb `px-1` = 4px face padding, subtracted per side (mirrors CenterNode's 12px). Fixed by the component, not tuned. |
| `ORB_LABEL_MAX_LINES` | 4 | **5** | Under the stricter circular model the outer lines hold fewer chars (narrow chords), so a 5th line is needed for the longest names to fit without ellipsis. |
| `ORB_LABEL_MIN_FONT_PX` | 10 | **7** | Last-resort lever. Only reached by the longest names at the absolute smallest orbs — ~1% of the swept [56..112] range; ~78% of the catalog still renders at the full 13px base (font histogram over the sweep: 13px→11700, 12→897, 11→773, 10→675, 9→516, 8→324, 7→162). |
| center (`*_CENTER`) constants | — | **unchanged** (base 18, floor 12, maxLines 4) | The 92px center circle passes the geometric sweep as-is. |

Constant search method: modelled the exact circle-aware algorithm + predicate offline over all 264 real names × every diameter in [56..112] plus the center width, and swept CHAR/L/R/floor/maxLines to find the set with zero failures that (a) keeps CHAR at 0.55, (b) maximizes the font floor, (c) minimizes the maxLines bump. That set is CHAR=0.55, L=1.0, R=12, floor=7, maxLines=5.

## Realigned boundary pins (orbLabelFit.test.ts)

Seven of the eight fixtures held their outcome unchanged under the circular model. The opts objects gained the two now-required fields (`lineHeightFactor` from config, `reservedHeightPx: 0` — these synthetic pins exercise the raw wrap/break branches, not the percent-reserve). **One** pin was realigned:

- **"never shrinks below minFontPx and ellipsizes only at the floor when over budget"** — the old input `"Supercalifragilistic Antidisestablishmentarian"` at 56px now hard-breaks and FITS without ellipsis under the circle model (font 7, 4 lines), so it no longer reaches the ellipsis safety net. Replaced with `"Pneumonoultramicroscopicsilicovolcanoconiosis Floccinaucinihilipilification"` (two absurdly long words) at 56px, which genuinely overflows all 5 lines at the floor — preserving the fixture's intent (the safety-net ellipsis branch fires only for the real-name-unreachable case). Precedent: the 08-06 fixture realignment.

Pins that held (intent + branch unchanged): short pass-through (`Rattlesnake`/88), multi-line whole-word wrap (`The Dripping Tap`/88), shrink-to-floor (`Nonagon Infinity Opens The Door Again`/56), one-word shrink (`Consciousness`/88), hard-break-whole-word (`Interdimensional`/56), center short + center long budget (`Rattlesnake`/220, `Supercalifragilistic…`/220), determinism.

## RED / GREEN commit SHAs

- **RED:** `84973dd` — geometric catalog test fails against the rectangular heuristic (verified: geometric/height failures like `fits=false ellipsized=false lines=4`, with the CHAR_WIDTH_FACTOR + 264-bundle sanity assertions passing, proving it's not an import/type error).
- **GREEN:** `988b26d` — circle-aware `fitOrbLabel`; both label-fit files pass (13 tests), `tsc --noEmit` clean, full app suite green (74 files / 558 tests).

## Files Created/Modified
- `packages/app/src/show/orbLabelFit.ts` — exported `CHAR_WIDTH_FACTOR`; added pure `labelFitsCircle`; rewrote `fitOrbLabel` to per-line circular chord budgets with a robust ellipsis-at-floor safety net; two new required options.
- `packages/app/src/config.ts` — added `ORB_LABEL_LINE_HEIGHT_FACTOR` (1.0), `ORB_LABEL_PERCENT_LINE_PX` (12), `ORB_LABEL_FACE_PADDING_PX` (4); tuned `ORB_LABEL_MAX_LINES` 4→5 and `ORB_LABEL_MIN_FONT_PX` 10→7.
- `packages/app/src/show/PredictionOrb.tsx` — fit against `diameter − 2·ORB_LABEL_FACE_PADDING_PX` and reserve `ORB_LABEL_PERCENT_LINE_PX`.
- `packages/app/src/show/CenterNode.tsx` — pass `lineHeightFactor` + `reservedHeightPx: 0`.
- `packages/app/test/orbLabelFit.catalog.test.ts` — geometric sweep over [56..112] + center width asserting `labelFitsCircle` + `.ellipsized === false`.
- `packages/app/test/orbLabelFit.test.ts` — opts gain the two required fields; one ellipsis fixture realigned.
- `packages/app/src/dev/OrbFitHarness.tsx` — circular per-line spill measurement; no `overflow:hidden`; offender list names the spilled line.

## Decisions Made
See the tuned-constant table above. Core/UI separation preserved (all edits in `packages/app`; no core/schema/artifact changes) and the single-config-file rule preserved (every new geometric value is a named `config.ts` constant).

## Deviations from Plan

None - plan executed exactly as written. The two boundary fixtures the plan flagged as candidates for realignment resolved to exactly one realigned pin; the seven others held.

## Issues Encountered
None. Confirmed via an offline constant search that the plan's POLISH-01 bar (every non-outlier name fits with no ellipsis across the full sweep) is achievable, and that keeping `CHAR_WIDTH_FACTOR` at 0.55 requires the `MAX_LINES` 4→5 and floor 10→7 moves the plan authorized as levers.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **PENDING on-device human-check (Task 3 gate):** the POLISH-01 re-verification on the owner's iPhone is NOT yet done. Serve over the cloudflared HTTPS tunnel (`--http-host-header localhost`), open `#/dev/orb-fit`, and confirm the banner reads ZERO circular-spill offenders across all 264 names + the center node (watch `(You Gotta) Fight for Your Right (To Party!)` and `Deserted Dunes Welcome Weary Feet`). Record the result in 08-HUMAN-UAT.md. This is the true POLISH-01 close-out; the automated geometric sweep is the proxy that made the fix, not the final on-device proof.
- All automated verification is green (both label-fit files, `tsc --noEmit`, full 558-test suite).

---
*Phase: 08-on-device-ui-polish-accessibility*
*Completed: 2026-07-18*

## Self-Check: PASSED

All three task commits (84973dd, 988b26d, cbb54b2) exist in history; all 7 modified files present on disk; `labelFitsCircle` exported from orbLabelFit.ts. Automated verification green: both label-fit files, `tsc --noEmit`, full 558-test suite.
