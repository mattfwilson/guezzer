---
phase: 08-on-device-ui-polish-accessibility
plan: 06
subsystem: show-mode-orb-labels
tags: [POLISH-01, orb-label-fit, legibility, dev-harness, tdd]
requires:
  - "08-01: config.show z-tiers + App #app-content wrapper (preserved, not reverted)"
  - "@matrix bundled transition-matrix artifact (264 nodes)"
provides:
  - "Conservative, real-catalog-locked orb-label fit heuristic (no ellipsis for any real name)"
  - "orbLabelFit.catalog.test.ts — zero-ellipsization lock over all 264 @matrix names"
  - "OrbFitHarness dev route (#/dev/orb-fit) for on-device overflow verification"
affects:
  - "packages/app/src/show/PredictionOrb.tsx + CenterNode.tsx (read the retuned constants)"
tech-stack:
  added: []
  patterns:
    - "Real-artifact catalog test over @matrix (not just synthetic fixtures)"
    - "Dev-gated throwaway route via exact hash check outside the ROUTES allow-list"
key-files:
  created:
    - packages/app/test/orbLabelFit.catalog.test.ts
    - packages/app/src/dev/OrbFitHarness.tsx
  modified:
    - packages/app/src/config.ts
    - packages/app/src/show/orbLabelFit.ts
    - packages/app/src/App.tsx
    - packages/app/test/orbLabelFit.test.ts
decisions:
  - "10px @ weight 600 documented as the minimum-legibility floor for orb data-text in the dark"
  - "CHAR_WIDTH_FACTOR raised 0.52 -> 0.55 (conservative) paired with +1 wrap line + lower floor"
  - "ORB_LABEL_MAX_LINES_CENTER bumped 3 -> 4 (the 44-char outlier needs a 4th center line at the 12px floor)"
metrics:
  duration: "~35 min"
  completed: "2026-07-18"
  tasks: 2
  files: 6
---

# Phase 8 Plan 06: Orb-Label Fit Retune + On-Device Harness Summary

Retuned `orbLabelFit`/`ORB_LABEL_*` so every one of the 264 real catalog song names renders fully legible (no ellipsis, overflow, or oversizing) at realistic rendered orb/center sizes, locked by an automated catalog test over the real `@matrix` artifact and verifiable on-device via a throwaway `#/dev/orb-fit` harness that flags overflow by real `scrollWidth/scrollHeight` measurement.

## What was built

**Task 1 (TDD) — retune + real-catalog lock:**
- `orbLabelFit.catalog.test.ts` (RED first): imports the real `@matrix`, extracts all 264 `songName`s, asserts `ellipsized === false` for the orb variant at the realistic min diameter (64px) and the center variant at the center inner width (92px = 116 − 2×12 padding). Also asserts the ellipsis fallback stays unreachable at realistic sizes, and that at the absolute `ORB_MIN_DIAMETER` (56px) floor at most the single 44-char outlier `(You Gotta) Fight for Your Right (To Party!)` may ellipsize (documented safety-net case).
- Retune (GREEN): `CHAR_WIDTH_FACTOR` 0.52 → **0.55** (conservative, removes the optimistic drift); `ORB_LABEL_MAX_LINES` 3 → **4**; `ORB_LABEL_MIN_FONT_PX` 11 → **10** (with a doc comment declaring 10px @ weight 600 as the minimum-legibility floor); `ORB_LABEL_MAX_LINES_CENTER` 3 → **4** (needed so the 44-char outlier renders fully inside the 92px center at the 12px floor). The ellipsis fallback is retained as an unreachable safety net. No matrix/scoring/layout code touched — constants only.

**Task 2 — dev-only on-device harness:**
- `OrbFitHarness.tsx` renders every real `@matrix` name as a real `PredictionOrb` (at `ORB_MIN_DIAMETER` 56px and a representative solved `ORB_MAX_DIAMETER` 112px) plus a real `CenterNode`, each inside a diameter-sized `overflow:hidden` cell. After two rAFs it measures each `[data-fit-cell]`'s `scrollWidth/scrollHeight` vs `clientWidth/clientHeight` and lists any overflow offenders on-screen with a pass/fail banner.
- `App.tsx` mounts it via an early return gated on the exact `location.hash === "#/dev/orb-fit"`, placed AFTER all hooks (rules of hooks), OUTSIDE the `ROUTES` allow-list so it never appears as a tab and leaves existing routing untouched. Marked throwaway / remove-post-phase. The 08-01 `#app-content` inert wrapper and persistence hooks are preserved unchanged.

## Verification

- `orbLabelFit.catalog.test.ts` + `orbLabelFit.test.ts`: 13 passed.
- `route.test.ts`: 6 passed (existing routing unaffected).
- Full app suite: **255 passed / 43 files**.
- `tsc -p packages/app/tsconfig.json --noEmit`: exit 0.
- Grep: `ORB_LABEL_MAX_LINES: 4`, `ORB_LABEL_MIN_FONT_PX: 10`, `ORB_LABEL_MAX_LINES_CENTER: 4`, `CHAR_WIDTH_FACTOR = 0.55` all present.
- On-device (human, end-of-phase, POLISH-01): serve over the cloudflared HTTPS tunnel, open `#/dev/orb-fit` on the owner's iPhone, confirm the banner reads zero overflow offenders. NOT yet performed — this is the plan's `<human-check>` and remains the final gate.

## Deviations from Plan

### Adaptation — realigned pre-retune fixture boundary pins (not a plan-listed change)

The plan's acceptance said "the pre-existing `orbLabelFit.test.ts` fixtures stay green", but the three mandated constant changes each invalidate a specific boundary pin that was hardcoded to the OLD constants at diameter 88:
- `CHAR_WIDTH_FACTOR` 0.52 → 0.55 changed "The Dripping Tap" from a 2-line to a 3-line wrap.
- `ORB_LABEL_MAX_LINES` 3 → 4 let "Nonagon Infinity Opens The Door Again" fit at the base font (no shrink) and let the two-long-word ellipsis case fit in 4 hard-broken lines (no ellipsis).
- `ORB_LABEL_MIN_FONT_PX` 11 → 10 let "Interdimensional" fit whole at the floor (no hard-break).

Keeping the mandated constants AND the literal old assertions is mathematically impossible (e.g., the 2-line assertion requires `CHAR_WIDTH_FACTOR ≤ 0.523`, contradicting the required `≥ 0.55`). Resolution: updated four fixture assertions to preserve each test's INTENT under the new constants — the two shrink/hard-break/ellipsis cases now use a tight 56px orb (which still exercises those branches), and the wrap case now asserts a multi-line (not exactly-2-line) wrap. All other fixtures unchanged.

- **Found during:** Task 1 GREEN.
- **Files modified:** `packages/app/test/orbLabelFit.test.ts`.
- **Commit:** 4a96345.

## Known Stubs

None. `OrbFitHarness` uses dummy `score`/`factors` on its candidates by design (only the label text is under test); it is a throwaway dev-only route marked for post-phase removal and never renders on a production tab.

## Self-Check: PASSED

- FOUND: packages/app/test/orbLabelFit.catalog.test.ts
- FOUND: packages/app/src/dev/OrbFitHarness.tsx
- FOUND commit 472eb7d (test RED)
- FOUND commit 4a96345 (retune GREEN)
- FOUND commit f62b8d2 (dev harness)

## TDD Gate Compliance

- RED: 472eb7d `test(08-06): add failing real-catalog zero-ellipsis lock…` (verified failing before retune — 16 names ellipsized at floor).
- GREEN: 4a96345 `fix(08-06): retune orb-label fit…` (catalog test passes).
- No separate REFACTOR commit needed (retune was minimal, constants-only).
