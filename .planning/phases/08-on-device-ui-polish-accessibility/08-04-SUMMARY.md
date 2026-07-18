---
phase: 08-on-device-ui-polish-accessibility
plan: 04
subsystem: ui
tags: [react19, accessibility, explore, constellation, viewport, z-index, fab, sheet, vitest]

# Dependency graph
requires:
  - phase: 08-on-device-ui-polish-accessibility
    provides: config.ui.z tiers (fab/sheet/focusedFab) + FAB_SHEET_GAP_PX, useDialogDismiss/dialogStack (Escape LIFO)
provides:
  - "useVisibleViewportHeight() — the ONE shared visible-viewport height source (visualViewport?.height ?? innerHeight) read by NodeSheet peek, the FilterFab lift, and the camera reframe"
  - "ExploreFilterFab `lifted` prop — translateY above the NodeSheet peek at z.focusedFab, reduced-motion gated"
  - "NodeSheet Escape-to-dismiss + focus-restore while staying NON-modal (D-02)"
  - "ConstellationCanvas focus reframe hardened on the shared visible-viewport source (A11Y-03)"
affects: [08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared visible-viewport hook feeding sheet peek + FAB lift + camera offset so they never disagree (Pitfall 3)"
    - "Non-modal dialog a11y: Escape via shared dialogStack + focus-restore WITHOUT trap/inert/scrim (D-02)"
    - "config-driven z-index via inline style (never Tailwind z-[…]) — focusedFab is the one tier above sheet"

key-files:
  created:
    - packages/app/src/explore/useVisibleViewportHeight.ts
    - packages/app/test/explore/filterFabLift.test.tsx
  modified:
    - packages/app/src/explore/NodeSheet.tsx
    - packages/app/src/explore/ExploreFilterFab.tsx
    - packages/app/src/explore/ExploreView.tsx
    - packages/app/src/explore/ConstellationCanvas.tsx

key-decisions:
  - "RESTING_BOTTOM_PX = 64 + 8 (BottomTabBar + gap); env(safe-area-inset-bottom) is not JS-resolvable so the lift math omits it and the FAB_SHEET_GAP_PX cushion absorbs the rounding"
  - "The reframe hardening is a dependency addition (visibleViewportHeight in the focus-camera effect deps), NOT a coordinate-math change — offsetWorld still uses the container box size.height; only the RE-TRIGGER is broadened so an iOS keyboard (visualViewport-only) re-frames"
  - "NodeSheet stays NON-modal: focus-restore only (capture activeElement on mount, restore on unmount) — no trap/inert/scrim so the graph + FilterFab stay reachable (T-08-10)"

requirements-completed: [A11Y-02, A11Y-03]

# Metrics
duration: ~15min
completed: 2026-07-18
---

# Phase 8 Plan 04: Explore FilterFab Lift + Non-Modal NodeSheet + Reframe Summary

**One shared `useVisibleViewportHeight()` now feeds the NodeSheet peek, a lifted FilterFab (z.focusedFab, above the non-modal sheet), and the constellation focus reframe — resolving the A11Y-02 FAB occlusion, giving NodeSheet Escape + focus-restore while staying non-modal (D-02), and hardening the A11Y-03 resize-keeps-camera-framed behavior against the latent `window.innerHeight` mismatch.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-18
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Created `useVisibleViewportHeight()` — reads `window.visualViewport?.height ?? window.innerHeight`, subscribing to `window` `resize` plus `visualViewport` `resize`+`scroll` (feature-detected, cleaned up). This is the single source Pitfall 3 / RESEARCH Q3 mandated; all three consumers now read it.
- NodeSheet: swapped the `window.innerHeight` peek computation for the shared hook; added `useDialogDismiss(true, onClose)` (Escape via the shared LIFO — no bespoke listener) and focus-restore only (capture `document.activeElement` on mount, restore on unmount) with NO trap/inert/scrim (D-02, non-modal); migrated `z-30` → `style={{ zIndex: config.ui.z.sheet }}`; kept `aria-modal={false}` and the bespoke drag/peek shell intact.
- ExploreFilterFab: added a `lifted` prop that computes the peek from the shared hook and `translateY`s the FAB above the sheet's top edge by `FAB_SHEET_GAP_PX`, at `z.focusedFab` (raw `z-30` removed), reduced-motion gated with the same `matchMedia` read as ConstellationCanvas:323. ExploreView passes `lifted={focusId != null}`.
- ConstellationCanvas: hardened the focus-camera effect so an iOS keyboard show/hide (which changes `visualViewport` but NOT the container box, so `size.height` alone misses it) re-frames the focused node — by adding `visibleViewportHeight` to the effect deps. Settle-and-freeze fx/fy (EXPL-06) untouched: only the camera move re-issues.
- New `filterFabLift.test.tsx` (7 tests): FAB lifted → negative translateY + `z.focusedFab`; resting → `translateY(0)` + `z.fab`; `focusedFab > sheet`; reduced-motion → `transition: none`; motion-allowed → animates; and the A11Y-03 reframe re-fires on a viewport-height change when focused, but not when unfocused. Full app suite green (257 tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: shared viewport hook + NodeSheet a11y and peek fix** - `8540c8f` (feat)
2. **Task 2: lift FilterFab above the NodeSheet on focus (A11Y-02/D-03)** - `33f6707` (feat)
3. **Task 3: harden focus reframe on shared visible-viewport source (A11Y-03)** - `b632dc4` (feat)

## Files Created/Modified
- `packages/app/src/explore/useVisibleViewportHeight.ts` (created) — the shared visible-viewport height hook.
- `packages/app/test/explore/filterFabLift.test.tsx` (created) — FAB lift + reframe contract (7 tests).
- `packages/app/src/explore/NodeSheet.tsx` — shared-hook peek, Escape + focus-restore (non-modal), `z.sheet` inline z-index.
- `packages/app/src/explore/ExploreFilterFab.tsx` — `lifted` prop: translateY + `z.focusedFab` + reduced-motion gate.
- `packages/app/src/explore/ExploreView.tsx` — passes `lifted={focusId != null}`.
- `packages/app/src/explore/ConstellationCanvas.tsx` — reframe effect depends on the shared viewport height.

## Decisions Made
- **`RESTING_BOTTOM_PX = 64 + 8`:** `env(safe-area-inset-bottom)` cannot be read in JS, so the lift math omits it (matching the numeric terms of the FAB's `bottomOffset`); the `FAB_SHEET_GAP_PX` cushion absorbs the small rounding. On-device verification will confirm the ~12px gap.
- **Reframe hardening is a dependency-broadening, not a math change:** `offsetWorld` still uses the container box `size.height` for the centering coordinate; adding `visibleViewportHeight` to the deps only broadens WHAT re-triggers the reframe (now includes visualViewport-only changes), leaving the frozen fx/fy layout untouched.
- **NodeSheet stays non-modal:** focus-restore only, no trap/inert/scrim (T-08-10) so the graph and lifted FilterFab remain reachable above it — the sheet is a live window on the sky it describes, not a modal.

## Deviations from Plan

None — plan executed exactly as written. (The Task 1/2 plan text referenced `pnpm vitest` / `pnpm --filter … tsc`; per the worktree toolchain note the same verifications were run via the root-installed `vitest`/`tsc` binaries. Same commands, same assertions — not a behavioral deviation.)

## Known Stubs

None — no hardcoded empty values, placeholders, or unwired data. Every changed surface renders live data.

## Threat Surface Scan

No new security-relevant surface. The focused song name still renders as React text only (T-08-11); the honest-zero NodeSheet branch is preserved (T-08-12); zero new npm packages (T-08-SC). The non-modal focus contract (T-08-10) is upheld — Escape + focus-restore, no trap.

## Verification
- `filterFabLift.test.tsx` — 7/7 pass.
- Full `@guezzer/app` suite — 257/257 pass.
- `tsc -p packages/app/tsconfig.json --noEmit` — exit 0.
- Grep: no `z-[0-9]` literal remains in `NodeSheet.tsx` / `ExploreFilterFab.tsx`; `window.innerHeight` no longer sources the NodeSheet peek (only a comment references it).

## Deferred / Human Verification
- End-of-phase device sweep (deferred to the phase-level on-device pass, per the plan's `<human-check>` items):
  - A11Y-02: focus a node on a real phone — the FilterFab rests ~12px above the NodeSheet top edge, fully tappable, returns on close.
  - D-02: Escape dismisses NodeSheet and the graph stays interactive above it (non-modal, no scrim).
  - A11Y-03: focus a node, rotate + toggle the on-screen keyboard — the camera stays framed (no snap-off).

---
*Phase: 08-on-device-ui-polish-accessibility*
*Completed: 2026-07-18*
