---
phase: 13-interface-explore-polish
plan: 04
subsystem: ui
tags: [react, react-force-graph-2d, constellation, camera, useRef, useEffect]

# Dependency graph
requires:
  - phase: 07-explore-constellation
    provides: settle-and-freeze onEngineStop zoomToFit + fx/fy pinning (EXPL-06)
  - phase: 08-explore-focus
    provides: focus-camera effect (zoom to FOCUS_ZOOM_K + centerAt), A11Y-03 viewport-reframe
provides:
  - firstSettleRef gate so onEngineStop zoomToFit fires only on the first settle per graphData
  - off-screen focus pan re-center (pan-only, at current zoom) on container resize
  - config.explore.FOCUS_OFFSCREEN_MARGIN_PX
affects: [explore-constellation, explore-focus, device-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First-settle ref gate: a useRef(true) reset by a [graphData]-keyed effect gates a one-shot camera action inside an async onEngineStop, so inert resize/filter reheats no longer reframe."
    - "Fresh-frame vs resize discrimination: a (focusId, graphData) key ref lets one effect keep full-reframe behavior on a genuine focus/view change while gating resize re-runs on an actual off-screen test."

key-files:
  created: []
  modified:
    - packages/app/src/explore/ConstellationCanvas.tsx
    - packages/app/src/config.ts
    - packages/app/test/explore/filterFabLift.test.tsx

key-decisions:
  - "onEngineStop keeps pinning fx/fy unconditionally (EXPL-06); only the zoomToFit call is gated by firstSettleRef."
  - "First-settle reset keyed strictly on [graphData] (never [size] or a filter dep) — only a Rotation<->Full view switch rebuilds graphData (Pitfall 4)."
  - "Resize off-screen re-center is pan-only at the user's current zoom (fg.zoom() read), never re-zoom to FOCUS_ZOOM_K (Open Question 3 / Pitfall 5)."
  - "graph2ScreenCoords is present on react-force-graph-2d 1.29.1 fgRef (A4 verified in dist d.ts) — used directly, no fallback path needed."

patterns-established:
  - "Camera-lifecycle gating via refs (firstSettleRef, focusFrameKeyRef) instead of new effects — the constellation stays a single component with one camera pipeline."

requirements-completed: [UX-04]

# Metrics
duration: ~20min
completed: 2026-07-19
---

# Phase 13 Plan 04: Constellation Camera Resize Preservation (UX-04) Summary

**The constellation now preserves the user's exact pan/zoom across every container resize — zoomToFit fires only on the first settle per view switch, and a focused node that leaves the viewport pans back at the current zoom instead of snapping to fit-all.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-19
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `firstSettleRef` (armed only on `[graphData]` view switches) so `onEngineStop`'s `zoomToFit` runs once per genuine Rotation<->Full-catalog switch — resize/filter reheats keep the camera exactly where the user left it. The `fx/fy` pinning loop still runs on every stop (EXPL-06 preserved).
- Extended the existing focus-camera effect: added `size.width` to its deps and a `focusFrameKeyRef` that distinguishes a fresh frame (new focus / view switch → unchanged full FOCUS_ZOOM_K frame) from a pure resize re-run of the same focused node.
- On a resize, the effect only PANS (`centerAt`) the focused node back when it is actually off-screen — tested via `fg.graph2ScreenCoords` inflated by `FOCUS_OFFSCREEN_MARGIN_PX` — keeping the user's current zoom (`fg.zoom()`), never re-zooming, never fit-all. A still-visible focus is left untouched.
- Added the single new config constant `config.explore.FOCUS_OFFSCREEN_MARGIN_PX` (24, `[ASSUMED]`/device-tune) — no inline magic number.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate zoomToFit behind a first-settle ref keyed on [graphData]** - `09ea65e` (fix)
2. **Task 2: Off-screen focus pan re-center + FOCUS_OFFSCREEN_MARGIN_PX config constant** - `a438c22` (fix)

## Files Created/Modified
- `packages/app/src/explore/ConstellationCanvas.tsx` - Added `firstSettleRef` + `[graphData]` reset effect; gated the `onEngineStop` `zoomToFit` (fx/fy pinning stays unconditional); extended the focus-camera effect with `size.width` dep, `focusFrameKeyRef` fresh-frame/resize discrimination, and an off-screen pan-only re-center.
- `packages/app/src/config.ts` - Added `explore.FOCUS_OFFSCREEN_MARGIN_PX: 24` beside the `FOCUS_*` block.
- `packages/app/test/explore/filterFabLift.test.tsx` - Updated the A11Y-03 viewport-reframe test to the superseded UX-04 pan-only contract (see Deviations); added `graph2ScreenCoords` + numeric `zoom()` to the ForceGraph2D mock.

## Decisions Made
- **A4 verification (which off-screen path):** `graph2ScreenCoords(x, y)` exists on the installed `react-force-graph-2d` 1.29.1 `fgRef.current` (confirmed in `node_modules/react-force-graph-2d/dist/*.d.ts` and the underlying `force-graph` typings). Used it directly — the research-noted `fg.zoom()` + `fg.centerAt()`-state fallback was NOT needed.
- Fresh-frame vs resize is discriminated with a `focusFrameKeyRef` holding the last-framed `(focusId, graphData)`. A focus change or view switch is a fresh frame (unchanged FOCUS_ZOOM_K behavior); any other re-run of the effect (size/viewport change on the same focused node) is the gated resize path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the A11Y-03 viewport-reframe test to the UX-04 pan-only contract**
- **Found during:** Task 2 (Off-screen focus pan re-center)
- **Issue:** `packages/app/test/explore/filterFabLift.test.tsx` asserted the pre-UX-04 behavior — that ANY shared-viewport-height change (e.g. iOS keyboard) re-frames a focused node by calling both `fg.zoom(FOCUS_ZOOM_K, ms)` AND `fg.centerAt(...)`. UX-04's locked must-have truths explicitly supersede this: across container resizes (address-bar collapse, orientation, keyboard) the user's exact pan/zoom is preserved, and an off-screen focused node is PANNED back at the current zoom, "never re-zoom." The plan states "only the RESIZE-driven re-evaluation is gated on the off-screen test" — a viewport-height change is a resize. The plan's own mock also lacked `graph2ScreenCoords`, which the new resize path calls, so the test threw before this change.
- **Fix:** Added `graph2ScreenCoords` (and a numeric `zoom()` return) to the ForceGraph2D mock. Replaced the single old assertion with two tests matching the new contract: (a) a viewport change that pushes the focused node off-screen PANS it back (`centerAt` fires) with no re-zoom (every `zoom` call on the resize path is an argument-less read); (b) a still-visible focused node is left untouched (no `centerAt`, no re-zoom). Kept the unchanged "does not reframe when no node is focused" test. The A11Y-03 intent (a focused node is never left snapped off-screen when the keyboard/address bar changes the viewport) is still met — now pan-only instead of re-zoom.
- **Files modified:** packages/app/test/explore/filterFabLift.test.tsx
- **Verification:** `npx vitest run` full suite green (628 tests, 78 files); app project 300 tests green; `tsc -p packages/app/tsconfig.json --noEmit` clean.
- **Committed in:** `a438c22` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test encoded superseded behavior)
**Impact on plan:** Necessary to satisfy the plan's own locked must-have truths and to make the new resize path exercisable under the mock. No scope creep — the change is confined to the one test that asserted the pre-UX-04 contract, and the A11Y-03 no-snap-off guarantee is preserved (pan-only).

## Issues Encountered
- The parallel worktree ships with no `node_modules`. To run `tsc`/`vitest` against the worktree's edited source without a network install (the prior attempt failed on a transient network error), a directory junction was created from the worktree `node_modules` to the main checkout's `node_modules`. The `@guezzer/app`/`@guezzer/core` workspace symlinks there point at the main checkout, but the app project's tests import their own source by relative path (worktree, edited) and only cross-package to the unchanged `@guezzer/core`, so the edited files are the ones actually type-checked and tested. This junction is outside the git tree and is not committed.

## Threat Flags
None — UX-04 is a client-side canvas camera-lifecycle change plus one config constant; no new network, auth, storage, or input-trust surface (matches the plan's threat register, T-13-04 accept).

## Known Stubs
None.

## Next Phase Readiness
- UX-04 code complete and fully green in CI-equivalent local runs. Device UX-04 UAT (camera survives address-bar collapse / orientation / keyboard; re-centers only when a focused node is lost off-screen) remains to be recorded in 13-HUMAN-UAT.md before `/gsd-verify-work`.

## Self-Check: PASSED

- FOUND: `.planning/phases/13-interface-explore-polish/13-04-SUMMARY.md`
- FOUND commits: `09ea65e` (Task 1), `a438c22` (Task 2), `d71a03f` (SUMMARY)
- STATE.md / ROADMAP.md untouched (orchestrator owns those writes).

---
*Phase: 13-interface-explore-polish*
*Completed: 2026-07-19*
