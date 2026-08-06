---
phase: 22-surface-motion-the-chrome-mechanism
plan: 01
subsystem: ui
tags: [react, motion, framer-motion, animate-presence, createPortal, a11y, config, z-index]

# Dependency graph
requires:
  - phase: 21-foundation-the-bottom-space-ladder
    provides: "the portaled `<Sheet>` primitive, `--gz-sheet-pad-bottom` (D-07), the FOUND-03 layer-order invariant test, and the FOUND-02 bare-numeric-mirror guard that forces ChromeToggle's geometry into config"
  - phase: 20-presence
    provides: "`WaveToast`'s AnimatePresence + motion.div + useReducedMotion idiom (I-2) — the motion shape this plan copies, and the owner of the `0.2` literal it relocates"
provides:
  - "`<Sheet>` restructured as portal → AnimatePresence → SheetSurface, with the scrim and card as SIBLINGS at document.body"
  - "SHEET-01 ENTER animation: bottom-sheet card translates without dimming, scrim cross-fades in parallel, reduced motion drops the translate, fullscreen never translates"
  - "`config.ui.motion` — the phase's seven timing/easing constants (D-24/D-25)"
  - "`config.ui.chrome` — ChromeToggle's 44/52 px geometry"
  - "`config.ui.z.chrome: 14` — the one new stacking tier, plus its two named numeric guards"
  - "`config.ui.BOTTOM_OVERLAY_ORDER` — the declared bottom-overlay stack order (CR-01)"
  - "`config.copy.explore.chromeHide/chromeShow`, `config.copy.install.*`, `config.copy.dex.setlist*`"
  - "`packages/app/test/sheet.motion.test.tsx` — the SHEET-01 prop-shape + sibling-structure + D-25 pin"
affects: [22-02, 22-04, 22-05, 22-06, 22-07, 22-08, 22-09, phase-23-overlays]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "portal-outside-AnimatePresence: `createPortal(<AnimatePresence>{open && <Surface/>}</AnimatePresence>, document.body)` — the portal is the OUTER layer because `onlyElements()` silently drops a `react.portal` child"
    - "sibling scrim + card in a fragment: one AnimatePresence child, two parallel timelines, one unmount — so an animating scrim can never drag the card's opacity"
    - "emptiness-by-absent-child: `{open && …}` replaces an `if (!open) return null` guard while preserving zero-DOM and never-throw"
    - "config-sourced motion: `duration: config.ui.motion.X_MS / 1000` at the consumer; the config value stays in ms"

key-files:
  created:
    - packages/app/test/sheet.motion.test.tsx
  modified:
    - packages/app/src/config.ts
    - packages/app/src/components/Sheet.tsx
    - packages/app/src/components/WaveToast.tsx
    - packages/app/test/layerOrder.test.tsx

key-decisions:
  - "OQ2 resolved as SIBLINGS, not nesting: `opacity` applies to a whole subtree, so a scrim PARENT animating 0 → 1 drags the card's rendered opacity with it — nesting cannot satisfy the UI-SPEC's 'card translates with opacity unchanged'"
  - "The scrim carries a static `aria-hidden=\"true\"`, which is only safe now that it is a sibling rather than the dialog's parent (documented deviation against one acceptance-criteria line)"
  - "`AnimatePresence` gets neither `initial` nor `mode`: `initial={false}` would silently kill the enter for the nine already-open-at-mount instances; `popLayout` destroys a fixed full-viewport scrim's geometry and `wait` delays re-open"
  - "ENTER ONLY. No `exit`, no `useIsPresent`, no close-start teardown — close behaviour is byte-identical to today, which is what keeps this commit independently revertible (D-17/D-18)"
  - "SHEET-01 is NOT marked complete in REQUIREMENTS.md: this plan ships the enter half only, and 22-02/22-04 also claim the requirement"

patterns-established:
  - "Pattern: presence-dependent rendering lives in a child component (`SheetSurface`), never in the portal owner — deriving it from `open` in the owner no-ops for the whole exit window (§Pitfall 14)"
  - "Pattern: the a11y lifecycle hooks stay functions of `open`, never of presence — recorded as a source INVARIANT comment in Sheet.tsx"
  - "Pattern: a motion test reads `data-initial` / `data-animate` / `data-transition` off the pass-through double, never a `transition` prop (the double strips it)"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-08-06
---

# Phase 22 Plan 01: Sheet Enter Motion & the Phase Config Surface Summary

**`<Sheet>` restructured to `portal → AnimatePresence → SheetSurface` with the scrim and card as body-level siblings, giving every sheet a 200ms config-sourced enter animation in which the card translates without ever dimming through its own scrim — plus the whole phase's config surface (motion, chrome geometry, the `chrome: 14` tier, the bottom-overlay order and eleven copy strings) landed in one commit.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-06T04:13:00Z
- **Completed:** 2026-08-06T04:25:20Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **The highest-regression-risk file in the milestone landed green.** One primitive backs 19 `<Sheet>` element openings across 16 files, 11+ of them VoiceOver/keyboard-verified. `sheet.a11y.test.tsx` passes **byte-unmodified** — including the V7 closed-sheet case, the fullscreen no-scrim case and the `var(--gz-sheet-pad-bottom)` case — against the **real** `motion` library, not a double.
- **The card no longer double-dims.** Making the scrim a sibling rather than the card's parent is what makes "translate with opacity unchanged" structurally possible; `sheet.motion.test.tsx` asserts the *absence* of an `opacity` key, not merely the presence of `y`.
- **Every Phase-22 constant and string exists in `config.ts`**, so no later plan in this phase has to touch that file inside a wave — the whole point of front-loading it here.
- **Two new named z-tier guards** (`peek < chrome < page`, `chrome < fab`) in the shape of the shipped WR-01/CR-01 cases, so the new tier's justification is executable rather than prose.
- **Full suite green:** 135 test files / 1147 tests, `tsc` exits 0.

## Task Commits

1. **Task 1: Land the phase's entire config surface** — `9b77586` (feat)
2. **Task 2: Restructure Sheet to portal → AnimatePresence → SheetSurface** — `6bc328f` (feat)
3. **Task 3: `sheet.motion.test.tsx`** — `2b5d797` (test)

## Files Created/Modified

- `packages/app/src/config.ts` — added `ui.motion` (7 constants), `ui.chrome` (2), `ui.z.chrome: 14`, `ui.BOTTOM_OVERLAY_ORDER`, `copy.explore.chromeHide/chromeShow`, `copy.install.*` (5), `copy.dex.setlist*` (3). Nothing deleted, nothing renumbered.
- `packages/app/src/components/Sheet.tsx` — rewritten: portal outside `AnimatePresence`, new internal `SheetSurface` returning a fragment of two `motion.div`s (`sheet-scrim`, `sheet-card`), enter-only variants, config-sourced transition, the two stale D-31 doc comments corrected, and the four forward-looking notes (D-16 seam, the nine unmount-driven sites, D-28/D-29 non-goals, the P6 `transform`-containing-block constraint) recorded in the module doc.
- `packages/app/src/components/WaveToast.tsx` — the one hard-coded `duration: 0.2` **moved** to `config.ui.motion.TOAST_DURATION_MS / 1000`. Nothing else changed.
- `packages/app/test/layerOrder.test.tsx` — two added numeric guards; the `<Sheet>` negative case rewritten to assert both siblings' tiers, both stacking-ancestor walks, both content-tree escapes and both `parentElement === document.body`.
- `packages/app/test/sheet.motion.test.tsx` — **new.** 8 cases: enter prop shape, reduced motion, fullscreen ×2, scrim parallel cross-fade, sibling structure, config-sourced timing, and the D-25 comment-stripped source guard.

## Decisions Made

- **Siblings over nesting (OQ2), as planned.** Recorded in the `SheetSurface` doc with all three reasons so the next reader does not "simplify" it back into a wrapper.
- **`initial` and `mode` both left at their defaults**, each with a one-line comment naming the failure the alternative causes.
- **`SHEET_EASE_EXIT` is defined but unused this plan.** It is consumed by 22-02's exit variants; landing the whole motion group in one commit is the plan's explicit anti-contention goal.
- **`SHEET-01` deliberately not checked off in `REQUIREMENTS.md`.** Its wording is "animates smoothly up on open **and down on close**"; this plan ships the enter half only, and plans 22-02 and 22-04 also carry the requirement. Marking it here would be a false green. `requirements-completed` is therefore `[]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npx tsc -b` has no root project in this repo**

- **Found during:** Task 1 (verification)
- **Issue:** Both tasks' `<automated>` gates specify `npx tsc -b`, but this repo has **no root `tsconfig.json`** (only `tsconfig.base.json` plus per-package `packages/{core,app}/tsconfig.json`, and there is no `typecheck` npm script). The bare command fails with `TS5083: Cannot read file '…/tsconfig.json'` — and, critically, **still exits 0**, so it would have been a silently vacuous gate.
- **Fix:** Ran the equivalent explicit form, `npx tsc -b packages/core packages/app`, at every gate. No config file was added — introducing a root `tsconfig.json` is a build-topology change this plan has no mandate for.
- **Files modified:** none
- **Verification:** `npx tsc -b packages/core packages/app` exits 0 with no output after each task.
- **Committed in:** n/a (verification-only)

### Deliberate deviation from one acceptance-criteria line

**2. The scrim keeps `aria-hidden="true"`, which one acceptance bullet forbids**

- **Found during:** Task 2
- **The conflict:** the task's `<action>` block specifies the scrim carries `aria-hidden="true"` (and `22-RESEARCH.md`'s target code example does too), while an `<acceptance_criteria>` bullet says `Sheet.tsx` contains "no `aria-hidden`".
- **Resolution:** followed the `<action>`. That bullet's six forbidden tokens (`exit=`, `useIsPresent`, `aria-hidden`, `pointerEvents`, `onAnimationComplete`, `focusInitialTarget`) are the **D-19 close-start teardown set**, and its stated reason — "all six land in plan 22-02, where `useFocusTrap` first returns that function" — is about the *presence-derived* `aria-hidden={isPresent ? undefined : true}` on the **card**. A static `aria-hidden` on a decorative, nameless, contentless **scrim** is a different thing entirely, has nothing to do with 22-02, and is only *possible* now that the scrim is a sibling (as the card's former parent it would have hidden the dialog with it). Removing it would leave an unlabelled full-viewport click target exposed to AT.
- **Note for 22-02:** the card's presence-derived `aria-hidden` is still absent, as required. A source-text check for `aria-hidden` in `Sheet.tsx` will now match the scrim's static one — 22-02 should assert *behaviour* (the card's attribute during the exit window), which is what its D-20 close-start test does anyway.
- **Files modified:** `packages/app/src/components/Sheet.tsx`
- **Committed in:** `6bc328f`

---

**Total deviations:** 2 (1 Rule-3 blocking auto-fix, 1 deliberate action-over-acceptance resolution)
**Impact on plan:** No scope change. Neither deviation adds or removes a file, a dependency or a behaviour beyond the plan's own `<action>` text.

## Issues Encountered

- **`sheet.a11y.test.tsx` runs `<Sheet>` against the REAL `motion` library** (it mocks only `dexie-react-hooks`), which made it the plan's real risk: an `AnimatePresence` that deferred unmount would have broken the focus-restore and inert-clear cases. It did not — with no `exit` variant the child is released in the same commit, so all 8 `<Sheet>` cases plus the padding case pass byte-unmodified. This is the empirical confirmation of probe P3 (motion's rAF fallback under this repo's jsdom) and of D-17's premise that an enter-only commit is safe to ship without the close-start teardown.
- A shell quoting artifact mangled one bullet of the Task 2 commit message on first write; amended via `git commit --amend -F <file>`. No content change.

## Known Stubs

None. Every constant and copy string added in Task 1 is a real value from `22-UI-SPEC.md`; the ones with no consumer yet (`config.ui.chrome`, `config.ui.BOTTOM_OVERLAY_ORDER`, `config.copy.install.*`, `config.copy.dex.setlist*`, `SHEET_EASE_EXIT`, `CHROME_*`) are **deliberately front-loaded** by this plan's objective so no later plan in the phase competes for `config.ts` inside a wave. Consumers land in 22-02 (`SHEET_EASE_EXIT`), 22-04 (`setlist*`), 22-05/22-07 (`chrome*`, `CHROME_*`), 22-06 (`install.*`) and 22-08 (`BOTTOM_OVERLAY_ORDER`).

## Threat Flags

None. This plan adds no network call, no persistence, no user-supplied data path and no dependency. The two registered threats behave as the register predicts: **T-22-01** (a user stranded behind a sheet) is mitigated exactly as planned — the `open`-driven `useFocusTrap`/`useDialogDismiss` wiring is untouched and `sheet.a11y.test.tsx`'s Escape / focus-restore / V7 cases passed byte-unmodified as the gate. **T-22-20** (a `position: fixed` descendant anchoring to the animating card) remains `accept`, recorded as note (d) in the module doc.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **22-02 is unblocked and is the load-bearing follow-up.** It owns the `exit` variants, `useIsPresent`, the presence-derived `aria-hidden` / `pointer-events`, the `useFocusTrap` split that returns `focusInitialTarget`, and the `onAnimationComplete` D-27 hook — deliberately none of which exist yet. `SHEET_EASE_EXIT` is already in config waiting for it.
- **Every other Phase-22 plan can now read its constants and strings from `config.ts`** without touching that file, which was this plan's contention-avoidance objective.
- **Revert story intact (D-18):** the three commits are independent and additive. Reverting `6bc328f` alone restores the shipped static `<Sheet>` — no feature flag, no runtime kill-switch, and the config commit can stay.
- **Carried forward for the device session (named risk, not a regression):** the bottom-sheet card moved from `flex flex-col justify-end` inside a `fixed inset-0` parent to its own `fixed inset-x-0 bottom-0`. Overflow behaviour for a taller-than-viewport card is the same in both shapes, and `SwapSheet` bounds itself with `max-h-[70vh] overflow-y-auto` — but **`CatchUpSheet` bounds nothing**. Plan 22-09 carries the numbered observation.

## Self-Check: PASSED

All five source/test files and this SUMMARY exist on disk. All four commits
(`9b77586`, `6bc328f`, `2b5d797`, `d546169`) are present in `git log` on
`worktree-agent-aab1627513e07df3e`, based on `511e603`.

Verification re-run at close: `npx vitest run` → 135 files / 1147 tests passed;
`npx tsc -b packages/core packages/app` → exit 0, no output;
`git diff --stat 511e603 HEAD` → 5 files, `sheet.a11y.test.tsx` untouched and
`layerOrder.test.tsx` changed only in the two places the plan names.

---
*Phase: 22-surface-motion-the-chrome-mechanism*
*Completed: 2026-08-06*
