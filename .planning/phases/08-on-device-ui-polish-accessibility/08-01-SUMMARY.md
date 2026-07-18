---
phase: 08-on-device-ui-polish-accessibility
plan: 01
subsystem: ui
tags: [react19, accessibility, inert, focus-trap, z-index, dialog, sheet, vitest]

# Dependency graph
requires:
  - phase: 07-explore-mode-constellation
    provides: NodeSheet non-modal shell + ConstellationCanvas reduced-motion matchMedia read this plan's stub satisfies
provides:
  - "config.ui.z named z-index tier scale (content..focusedFab) + config.ui.FAB_SHEET_GAP_PX"
  - "window.matchMedia stub centralized in packages/app/test/setup.ts"
  - "useFocusTrap hook (initial focus + Tab-wrap + ref-counted inert + focus-restore)"
  - "useDialogDismiss hook + dialogStack LIFO (Escape fires topmost dialog only)"
  - "setRootInert ref-counted #app-content inert toggle (composes with stacked modals)"
  - "shared <Sheet> primitive (modal | non-modal | fullscreen) portaling to document.body"
  - "#app-content inert target wrapper in App.tsx (display:contents)"
affects: [08-02, 08-03, 08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React 19 native inert boolean, toggled imperatively via a ref-counted module singleton"
    - "Module-level LIFO dialog stack with one shared document keydown listener"
    - "Portal-to-body dialog primitive so open sheets stay interactive above an inert root"
    - "config-driven z-index via inline style (never Tailwind z-[…]) to keep config.ts the single source"

key-files:
  created:
    - packages/app/src/components/Sheet.tsx
    - packages/app/src/components/a11y/useFocusTrap.ts
    - packages/app/src/components/a11y/useDialogDismiss.ts
    - packages/app/src/components/a11y/dialogStack.ts
    - packages/app/src/components/a11y/inertRoot.ts
    - packages/app/test/sheet.a11y.test.tsx
  modified:
    - packages/app/src/config.ts
    - packages/app/src/App.tsx
    - packages/app/test/setup.ts

key-decisions:
  - "inert toggled imperatively (root.inert = value) on #app-content rather than as a React prop, so a portaled sheet can suppress the whole app tree without threading a prop through every view"
  - "Sheet passes active: open && modal to useFocusTrap so the effect re-fires on open toggles (ref identity alone never changes)"
  - "#app-content wrapper uses display:contents so it adds no layout box while still propagating inert to descendants"
  - "Non-modal Sheet never calls setRootInert, so #app-content.inert stays unset (undefined) — verified as not-true rather than strictly false"

patterns-established:
  - "a11y layer lives in components/a11y/* as dependency-free hooks + module singletons (no new npm deps)"
  - "Every modal <Sheet> gets focus trap + inert + Escape + restore in ONE place; migrations wrap children only"

requirements-completed: [A11Y-01, A11Y-02]

# Metrics
duration: ~20min
completed: 2026-07-18
---

# Phase 8 Plan 01: A11y + Layering Foundation Summary

**Dependency-free React 19 accessibility layer — a shared portal-to-body `<Sheet>` primitive with `useFocusTrap`/`useDialogDismiss`/`dialogStack`/ref-counted `inertRoot`, plus the centralized `config.ui.z` tier scale, the `#app-content` inert target, and a `matchMedia` test stub.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-18
- **Tasks:** 3
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- Built the entire net-new a11y layer (no `useFocusTrap`, `inert`, Escape handling, or focus-restore existed anywhere in the app before): `useFocusTrap`, `useDialogDismiss`, `dialogStack` LIFO, ref-counted `setRootInert`.
- Shipped the shared `<Sheet>` primitive (modal / non-modal / fullscreen) that portals to `document.body`, wires the a11y hooks, and preserves the `if (!open) return null` V7 guard.
- Added the `config.ui.z` named z-index scale + `FAB_SHEET_GAP_PX`, and the `#app-content` inert target in `App.tsx` (`display:contents`, zero layout change).
- Closed the Wave-0 test gap with a centralized `window.matchMedia` stub so downstream reduced-motion / camera tests run without per-file shims.
- New `sheet.a11y.test.tsx` (8 tests) proves closed→null, focus-in + inert, Escape→topmost, focus-restore + inert-clear, `initialFocusRef`, non-modal no-inert/no-scrim, stacked LIFO + two-decrement ref-count, and fullscreen. Full app suite green (250 tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: z-tier scale + FAB gap + matchMedia stub** - `8b1f209` (feat)
2. **Task 2: a11y hooks + utilities (dialogStack, inertRoot, useDialogDismiss, useFocusTrap)** - `93504a5` (feat)
3. **Task 3: `<Sheet>` primitive + #app-content inert target + sheet.a11y.test** - `368899e` (feat)

## Files Created/Modified
- `packages/app/src/config.ts` - Added `ui.z` named tiers + `ui.FAB_SHEET_GAP_PX`.
- `packages/app/test/setup.ts` - Centralized `window.matchMedia` stub (`matches:false`).
- `packages/app/src/components/a11y/inertRoot.ts` - Ref-counted `setRootInert` toggling native `inert` on `#app-content`.
- `packages/app/src/components/a11y/dialogStack.ts` - Module LIFO + one shared `document` Escape listener (topmost only).
- `packages/app/src/components/a11y/useDialogDismiss.ts` - React binding pushing `onClose` to the stack while active.
- `packages/app/src/components/a11y/useFocusTrap.ts` - Capture activeElement + inert + initial focus + Tab-wrap + restore.
- `packages/app/src/components/Sheet.tsx` - Shared modal/non-modal/fullscreen dialog primitive (portal to body).
- `packages/app/src/App.tsx` - Wrapped body in `<div id="app-content" style="display:contents">`.
- `packages/app/test/sheet.a11y.test.tsx` - 8-test A11Y-01 contract.

## Decisions Made
- **Imperative inert over a React prop:** `inertRoot` sets `root.inert` directly so any portaled sheet can suppress the whole app tree via a module singleton, without threading an `inert` prop through every view. Ref-counting makes stacked modals compose (Pitfall 4).
- **`active: open && modal` for the trap:** passing the composed flag guarantees the `useFocusTrap` effect re-fires on open/close (the `ref` object identity never changes, so it can't be the trigger).
- **`display:contents` wrapper:** the `#app-content` target adds no box, keeping layout byte-identical while still propagating `inert`. Documented the AppShell-root fallback in a code comment if a device shows inert not propagating through `display:contents`.

## Deviations from Plan

None - plan executed exactly as written.

The only adjustment was a test-assertion refinement (not a plan deviation): a non-modal `<Sheet>` never calls `setRootInert`, so `#app-content.inert` is never assigned and reads back `undefined` in jsdom. The non-modal assertion checks `.not.toBe(true)` (correctly non-inert) rather than strict `=== false`, which would only hold after a modal had explicitly cleared it.

## Issues Encountered
- **jsdom `inert` semantics:** jsdom does not pre-define `HTMLElement.inert`, so an untouched element reports `undefined` rather than `false`. Handled in the non-modal test as above. Modal open→close paths still assert strict `false` because `applyInert(false)` explicitly assigns it.

## TDD Gate Compliance
Tasks 2 and 3 carried `tdd="true"`. Phase config has `tdd_mode: false`, so strict per-gate RED/GREEN commit separation was not enforced; the behavioral contract (`sheet.a11y.test.tsx`) is authored in Task 3 per the plan's own task structure (Task 2's acceptance defers verification to "the inert-toggle test in Task 3"). All eight behavioral assertions pass and the full app suite (250 tests) is green.

## User Setup Required
None - no external service configuration required. This plan installs ZERO new npm packages (T-08-SC): the a11y layer is dependency-free hooks on React 19 native `inert` + baseline DOM.

## Next Phase Readiness
- The A11Y-01 primitives are ready for the modal migrations: plans 08-02 (AppMenu, WhyDetail, TrailNodeSheet, EndShowDialog) and 08-03 (ShareCardSheet, CompareView, Settings prompt) wrap their sheets in `<Sheet>`; 08-04 lifts the FilterFab using `config.ui.z.focusedFab` + `FAB_SHEET_GAP_PX` and adds the non-modal NodeSheet Escape/restore; 08-05 migrates the remaining ~24 raw `z-*` literals onto `config.ui.z`.
- Deferred (per plan): real Tab-order focus movement and the on-device VoiceOver/keyboard AT sweep (jsdom cannot move focus on Tab without `@testing-library/user-event`, intentionally not added).

---
*Phase: 08-on-device-ui-polish-accessibility*
*Completed: 2026-07-18*
