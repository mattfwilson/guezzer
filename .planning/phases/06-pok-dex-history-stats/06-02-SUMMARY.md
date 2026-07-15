---
phase: 06-pok-dex-history-stats
plan: 02
subsystem: ui
tags: [react, show-mode, fab, orb-label, pwa, install-banner, dexie-meta, tdd]

# Dependency graph
requires:
  - phase: 04-show-mode
    provides: ActionBar callback contract, PredictionOrb/CenterNode, orbitLayout pure-helper idiom, styles.css gesture-suppression scope
  - phase: 03-app-shell-pwa
    provides: InstallBanner, useInstallState session-only dismissal, build-stamp globals, meta table helpers
provides:
  - FabMenu speed-dial replacing the in-flow ActionBar (D-20)
  - Pure fitOrbLabel(name, diameterPx, opts) wrap/scale/ellipsis helper wired into PredictionOrb + CenterNode (D-21)
  - Version-gated InstallBanner (once per app build via meta flag, D-22)
  - config keys ui.FAB_DIAMETER/ui.FAB_ACTION_HEIGHT, show.ORB_LABEL_* floors, copy.show.fabLabel
affects: [show-mode polish, pokedex-views, install-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed speed-dial FAB with full-viewport scrim + auto-collapse-then-act (supersedes in-flow action bar)"
    - "Pure layout-heuristic helper (fitOrbLabel) mirroring orbitLayout.ts — injected tunables, deterministic, unit-pinned"
    - "Once-per-build-version meta-flag gate keyed on __APP_VERSION__+__GIT_SHA__ (EndShowDialog PERSIST_WARNING_SHOWN idiom)"

key-files:
  created:
    - packages/app/src/show/FabMenu.tsx
    - packages/app/src/show/orbLabelFit.ts
    - packages/app/test/fabMenu.test.tsx
    - packages/app/test/orbLabelFit.test.ts
    - packages/app/test/installBannerVersion.test.tsx
  modified:
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/show/PredictionOrb.tsx
    - packages/app/src/show/CenterNode.tsx
    - packages/app/src/components/InstallBanner.tsx
    - packages/app/src/pwa/install/useInstallState.ts
    - packages/app/src/config.ts
    - packages/app/src/styles.css

key-decisions:
  - "FabMenu supersedes Phase-4 D-13..D-15 ActionBar layout (recorded, not restored); same five-callback contract kept so ShowView wiring barely changed"
  - "Added config.show.ORB_LABEL_CENTER_WIDTH_PX (220px) — the center pill has no px diameter, so the pure fitOrbLabel needs a nominal width budget (single-config ethos)"
  - "Set-break FAB row uses the lucide Minus icon per the plan's explicit icon list (Phase-4 ActionBar used SkipForward)"

patterns-established:
  - "Speed-dial FAB: collapsed-default (no action buttons in the a11y tree), scrim blocks+collapses, auto-collapse-then-act"
  - "fitOrbLabel: word-wrap up to maxLines, then uniform integer font shrink to a floor, then last-line ellipsis"
  - "Once-per-version banner gate via a persisted meta stamp; session dismissal layers on top"

requirements-completed: [SHOW-02, SHOW-04, SHOW-05]

# Metrics
duration: 8min
completed: 2026-07-14
---

# Phase 6 Plan 02: Folded Show-Mode Polish Summary

**Collapsed the five Show-Mode actions into one bottom-right FAB speed-dial (D-20), made orb/center song names readable in full via a pure wrap+scale-to-fit helper (D-21), and gated the InstallBanner to once per app build via a persisted meta stamp (D-22).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-14T20:56:03-04:00
- **Completed:** 2026-07-14T21:03:58-04:00
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 14 (5 created, 7 modified, 2 deleted)

## Accomplishments
- **FabMenu (D-20):** one 56px bottom-right FAB carries Search/???/Set break/Encore/Undo; a full-viewport scrim under the open menu blocks orbit taps (T-06-04); any action auto-collapses then fires the inherited Phase-4 behavior once. Fixed anchor clears the BottomTabBar + SuggestionStrip slot + home indicator (T-06-05); the orbit stage absorbs the reclaimed height. ActionBar.tsx + actionBar.test.tsx deleted.
- **Orb label fit (D-21):** pure `fitOrbLabel(name, diameterPx, opts)` wraps to a line budget, shrinks font uniformly to a config floor, then ellipsizes; wired into PredictionOrb (14px base / 11px floor / 2 lines) and CenterNode (20px base / 14px floor / 3 lines). SHOW-02 tap targets untouched; full name stays in the aria-label + Info "why" detail.
- **InstallBanner once-per-version (D-22):** persisted `installBannerSeenVersion` meta flag keyed on `__APP_VERSION__+__GIT_SHA__`; same build never re-shows, a new build re-shows once. Never-throw meta I/O (T-06-06); session dismissal layered on top; AppMenu Install remains the always-on fallback.

## Task Commits

Each task was executed test-first (TDD RED → GREEN):

1. **Task 1: FabMenu replaces ActionBar (D-20)** — `466c70e` (test) → `c408ab7` (feat)
2. **Task 2: Orb label fit helper + orb/center wiring (D-21)** — `a01848c` (test) → `f2082b5` (feat)
3. **Task 3: InstallBanner once per app version (D-22)** — `1d758f0` (test) → `20ecf75` (feat)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `packages/app/src/show/FabMenu.tsx` - Collapsed speed-dial FAB (created; replaces ActionBar)
- `packages/app/src/show/orbLabelFit.ts` - Pure wrap/scale/ellipsis label-fit helper (created)
- `packages/app/src/show/ShowView.tsx` - Renders FabMenu in place of ActionBar; SuggestionStrip re-anchor note
- `packages/app/src/show/PredictionOrb.tsx` - Multi-line fit render replacing the truncate span
- `packages/app/src/show/CenterNode.tsx` - Multi-line fit render for the current-song pill
- `packages/app/src/components/InstallBanner.tsx` - Once-per-build-version meta gate
- `packages/app/src/pwa/install/useInstallState.ts` - Comment trail updated for the D-22 supersession
- `packages/app/src/config.ts` - FAB + orb-label constants, fabLabel copy
- `packages/app/src/styles.css` - `.fab-menu` added to the gesture-suppression scope
- `packages/app/test/{fabMenu,orbLabelFit,installBannerVersion}.test.*` - New tests (created)
- `packages/app/src/show/ActionBar.tsx`, `packages/app/test/actionBar.test.tsx` - Deleted (superseded)

## Decisions Made
- FabMenu supersedes the Phase-4 ActionBar layout (D-13..D-15) — recorded as a supersession, the old two-row in-flow layout is intentionally not restored.
- Set-break FAB row uses the lucide `Minus` icon (plan's explicit icon list), where Phase-4 ActionBar used `SkipForward`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added config.show.ORB_LABEL_CENTER_WIDTH_PX**
- **Found during:** Task 2 (CenterNode wiring)
- **Issue:** `fitOrbLabel` requires a px width to compute wrapping, but CenterNode receives no px diameter (the pill is `max-w-[70%]` of the stage with no measured size passed in).
- **Fix:** Added a nominal center-pill width budget (`220`) to `config.show` with a doc comment, honoring the single-config-file rule (a bare `220` literal in CenterNode would violate CLAUDE.md "no scattered magic numbers"). The plan's four named constants are all present alongside it.
- **Files modified:** packages/app/src/config.ts, packages/app/src/show/CenterNode.tsx
- **Verification:** orbLabelFit.test.ts center-budget case passes; full app suite + tsc green.
- **Committed in:** f2082b5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to run the pure helper for the center pill while keeping the single-config ethos. No scope creep — all four planned constants delivered.

## Issues Encountered
- None. jsdom lacks `window.matchMedia`; the InstallBanner test stubs it (existing platform.test.ts idiom).

## Known Stubs
None — all three behaviors are fully wired and unit-covered.

## Threat Flags
None — no new network endpoints, auth paths, or trust-boundary surface introduced. The plan's threat register (T-06-04/T-06-05/T-06-06) mitigations are implemented (scrim + auto-collapse + `.fab-menu` gesture scope; safe-area/tab-bar/strip bottom offset; never-throw meta I/O).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Show-Mode polish trio complete and green (132 app tests, 24 files; tsc clean).
- End-of-phase on-device gate still pending (per plan human-checks): FAB thumb-reach in the dark, no overlap with SuggestionStrip X / home indicator, taller orbit, long titles readable inside orbs.

## Self-Check: PASSED

- All created files present (FabMenu.tsx, orbLabelFit.ts, 3 test files, SUMMARY).
- Both superseded files deleted (ActionBar.tsx, actionBar.test.tsx).
- All six task commits present (466c70e, c408ab7, a01848c, f2082b5, 1d758f0, 20ecf75).

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-14*
