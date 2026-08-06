---
phase: 22-surface-motion-the-chrome-mechanism
plan: 07
subsystem: ui
tags: [react, a11y, inert, escape, safe-area, resize-observer, mutation-observer, lucide, tab-order]

# Dependency graph
requires:
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 05
    provides: "`layout/chromeVisibility.ts` (`useChromeVisible` / `setChromeVisible` / `registerChromeToggle`), the AppShell one-commit collapse, the header's toggle slot, and `test/chromeToggle.test.tsx`'s 8 cases + reusable harness"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 01
    provides: "`config.ui.chrome.CHROME_TOGGLE_SIZE_PX`, `config.ui.z.chrome` (14) and the named `chrome < fab` guard in `layerOrder.test.tsx`, `config.copy.explore.chromeHide/chromeShow`"
  - phase: 8
    provides: "`components/a11y/useDialogDismiss.ts` + `dialogStack.ts` — the shared LIFO Escape stack"
provides:
  - "`packages/app/src/explore/ChromeToggle.tsx` — the FIRST and ONLY entry point into the chrome-hidden state, shipped in the same commit as every way out"
  - "`ExploreView` mounts `<ChromeToggle />` as the first child of its success-path fragment (the tab-order guarantee)"
  - "`test/chromeToggle.test.tsx` — 15 cases (8 from 22-05 + 7 control cases)"
  - "`packages/app/test/chromeResize.test.tsx` — CHROME-05's one-resize / no-camera-snap assertions"
affects: [22-08, 22-09, phase-23-CHROME-02, phase-23-INSHOW-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "always-rendered escape control: one node, one viewport pixel, both states — only the glyph and the accessible name change"
    - "escapability asserted by holding ONE element reference across the flip it causes (proves no remount/move)"
    - "`closest(\"[inert]\")` filtering over a FOCUSABLE selector to assert real, inherited tab order"
    - "`MutationObserver` + `attributeOldValue` + `takeRecords()` to count DISTINCT resolved custom-property values synchronously"
    - "source-read assertion (`readFileSync` on `src/`) to pin a VERBATIM shared expression that jsdom's CSS normalization would otherwise hide"

key-files:
  created:
    - packages/app/src/explore/ChromeToggle.tsx
    - packages/app/test/chromeResize.test.tsx
  modified:
    - packages/app/src/explore/ExploreView.tsx
    - packages/app/test/chromeToggle.test.tsx

key-decisions:
  - "jsdom REORDERS a `calc()` sum, so the plan's `style` assertion for the exact authored string `calc(env(safe-area-inset-top) + 12px)` is unsatisfiable — the rendered assertion targets the normalized `calc(12px + env(safe-area-inset-top))`, and D-13's verbatim-copy rule is pinned by a NEW source-read case instead"
  - "`chromeResize.test.tsx` uses the REAL `motion/react`, not the pass-through double — the reserve is written by a layout effect, not by motion, and a mock would swallow the very frame-by-frame animation case 4 exists to catch"
  - "the header node is CAPTURED at render in `chromeResize.test.tsx`, never re-queried by role — `getByRole(\"banner\")` returns nothing once the chrome is hidden, so the plan's literal `screen.getByRole(\"banner\")` after the toggle would have failed"
  - "`ExploreView`'s `loadMatrix()` error path deliberately mounts NO toggle, commented at the source so 'always rendered' is not later read as absolute"

requirements-completed: [CHROME-01, CHROME-03, CHROME-04, CHROME-05]

# Metrics
duration: 12min
completed: 2026-08-06
---

# Phase 22 Plan 07: The Chrome Toggle Summary

**GizzVerse now has one always-present 44×44 control at a fixed top-right pixel that hides the header and the tab bar and brings them back, plus Escape and first-in-tab-order as two independent escapes — and one toggle writes the chrome reserve exactly once without touching the constellation camera.**

## Performance

- **Duration:** ~12 min (2026-08-06T05:12Z → 05:24Z)
- **Tasks:** 3
- **Files:** 4 (2 created, 2 modified) — exactly the plan's declared `files_modified`, no extras

## Task Commits

1. **Task 1: `ChromeToggle.tsx` + its `ExploreView` mount point** — `80a2ffb` (feat)
2. **Task 2: the control half of `chromeToggle.test.tsx`** — `8673e45` (test)
3. **Task 3: `chromeResize.test.tsx`** — `7211c79` (test)

## Accomplishments

- **T-22-12 is closed in the commit that opens it.** Wave 3 shipped the hidden state with no way to
  enter it; `80a2ffb` adds the entry point and, in the same commit, all three outs the threat register
  names: an always-rendered ≥44px control at a fixed viewport pixel in both states, first place in the
  document's tab order while hidden, and Escape through the shared LIFO stack. The two structural outs
  from 22-05 (nothing persisted → a reload restores; unregister forces `visible = true`) were already
  in place and are untouched.
- **Escapability is proven by POSITIVE rendered-DOM assertions, not by guard silence.** Case 1 holds
  one element reference across the flip it causes and re-asserts size, insets and non-inertness on the
  far side — the shape 22-VALIDATION §"Carried Limitation from Phase 21" requires for a new surface.
- **The tab-order case was proved able to fail.** Moving `<ChromeToggle />` from first to last child of
  `ExploreView`'s fragment makes `expect(reachable[0]).toBe(toggle)` fail with the FAB reported at
  index 0; the file was restored and re-run green. That mutation check matters because upstream flagged
  that assertions of this shape can be silently vacuous.
- **CHROME-05 is asserted the way D-09 defines it** — one reserve write per toggle (filtered by
  property name), `zoomToFit` not re-called, the header out of flow *and* inert immediately, and a
  `MutationObserver` count of distinct resolved values — with the false "no reheat" assertion
  deliberately absent and a long comment at the site explaining why it must stay absent.
- **Full suite: 140 files / 1199 tests green**, up from the 139 / 1188 base — `+1` file, `+11` cases,
  all new. `npx tsc -b packages/core packages/app` exits 0.
- **`bottomSpace.test.ts`'s bare-`64` allowlist case still asserts exactly
  `["explore/ExploreFilterFab.tsx"]`** — `ChromeToggle.tsx` is a sibling in that directory and carries
  no bottom-space literal of any kind. `layerOrder.test.tsx` is green and no tier was renumbered.

## Decisions Made

- **`Maximize2` visible / `Minimize2` hidden**, `size={24}`, `aria-hidden` — the exact inverse glyph
  pair, so the control reads as one toggle rather than two buttons. Both confirmed live exports of the
  installed `lucide-react`.
- **No `aria-pressed`, no `aria-expanded` (D-05).** The accessible name names the next tap
  (`chromeHide` / `chromeShow`), matching the shipped `Menu` / `Close menu` idiom. Asserted positively
  *and* negatively.
- **The Escape hook is active ONLY while hidden (T-22-26).** In the normal state the toggle contributes
  nothing to the LIFO stack, so one Escape still closes exactly one thing. Both halves asserted.
- **No discovery affordance (D-06)**, no canvas gesture (D-01), no history entry for the back gesture
  (D-04) — all three recorded in the module doc so they are not "fixed" later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npx tsc -b` is vacuous in this repo**

- **Found during:** Task 1 (verification)
- **Issue:** Tasks 1 specifies `npx tsc -b`. There is no root `tsconfig.json`, so the bare command
  prints `TS5083` and still exits 0 — a silently vacuous gate. Same finding as plans 22-01 and 22-05.
- **Fix:** ran `npx tsc -b packages/core packages/app` at every typecheck gate. No config file added.
- **Verification:** exit 0, no output, after every task.

**2. [Rule 3 - Blocking] jsdom REORDERS a `calc()` sum, so the plan's exact-string style assertion is unsatisfiable**

- **Found during:** Task 2 (probed before writing a line of the case)
- **Issue:** Task 2 case 1 requires asserting the toggle's `style` attribute *contains*
  `calc(env(safe-area-inset-top) + 12px)`. jsdom's CSS parser normalizes a `calc()` sum by reordering
  its terms. Probed directly:

  | Authored | `getAttribute("style")` |
  |---|---|
  | `calc(env(safe-area-inset-top) + 12px)` | `top: calc(12px + env(safe-area-inset-top));` |
  | `calc(env(safe-area-inset-right) + 16px)` | `right: calc(16px + env(safe-area-inset-right));` |
  | bare `env(safe-area-inset-top)` | **dropped entirely** (22-05 deviation 2) |

  Written as specified, the case would fail on a byte-correct implementation.
- **Fix:** two assertions instead of one, and the pair is *stronger* than the original:
  1. the rendered case asserts `toggle.style.top === "calc(12px + env(safe-area-inset-top))"` (exact
     equality on the normalized form, not a `toContain` — and still non-vacuous, because a lost
     `env()` term would make the declaration vanish, not merely reorder);
  2. a NEW case reads `src/components/AppShell.tsx` and `src/explore/ChromeToggle.tsx` off disk and
     asserts both contain the literal string `calc(env(safe-area-inset-top) + 12px)`. That is what
     D-13 actually rules on — one top-inset *expression*, copied verbatim, never a second formula that
     can drift — and the rendered assertion alone would have accepted a hand-rolled
     `calc(12px + env(...))`.
- **Files modified:** `packages/app/test/chromeToggle.test.tsx`
- **Committed in:** `8673e45`

**3. [Rule 3 - Blocking] `screen.getByRole("banner")` cannot see the hidden header (`chromeResize` case 3)**

- **Found during:** Task 3 (anticipated from 22-05's SUMMARY trap #2, confirmed by the shipped
  `chromeToggle.test.tsx` case 3, which asserts `screen.queryByRole("banner")` is `null` while hidden)
- **Issue:** Task 3 case 3 and the 22-RESEARCH harness both spell the assertion
  `expect(screen.getByRole("banner")).toHaveStyle({ position: "absolute" })` — but the assertion runs
  *after* the toggle, when the header carries `aria-hidden="true"` and has left the accessibility
  tree. The role query throws exactly when CHROME-04 is working.
- **Fix:** `renderExplore()` captures `container.querySelector("header")` at render and every later
  assertion uses that node. Commented at the helper. Same treatment for `<main>`.
- **Files modified:** `packages/app/test/chromeResize.test.tsx`
- **Committed in:** `7211c79`

### Deliberate divergences (not defects)

**4. `chromeResize.test.tsx` does NOT mock `motion/react`**

- The plan's harness description does not mention the double, and mocking it would have been the
  path of least resistance (the sibling file has one). It is deliberately omitted: case 4 exists to
  catch an implementation that *animates* the reserve frame-by-frame, and the pass-through double
  would swallow exactly that. The reserve is written by `useBottomSpaceVars`' layout effect rather
  than by motion, so the real library adds no flake — all four cases are green and deterministic.

**5. The FOCUSABLE selector is duplicated, not imported**

- Task 2's `read_first` calls it "the exported `FOCUSABLE` selector". It is **not exported** —
  it is a module-private `const` in `components/a11y/useFocusTrap.ts`, and that file is outside this
  plan's declared `files_modified`. The selector string is reproduced verbatim in the test with a
  comment naming its source, rather than widening the plan's file scope to add an export.

**6. Task 2 landed 7 new cases, not the 6 the action lists**

- The extra one is deviation 2's source-read case. `chromeToggle.test.tsx` goes 8 → 15, satisfying
  the acceptance criterion of "at least 6 more passing cases than after plan 22-05".

---

**Total deviations:** 6 (3 Rule-3 blocking auto-fixes, 3 deliberate divergences)
**Impact on plan:** No scope change. No file added or removed beyond the declared `files_modified`;
no dependency added; the shipped runtime behaviour is exactly what the plan specified.

## Issues Encountered

- **Every trap 22-05's SUMMARY flagged was real and was hit by the shapes this plan writes.** The
  cached-per-tag `motion/react` double (inherited, unchanged) is what lets case 1 and case 3 hold one
  element reference across an `act()` and observe a change; `getByRole` on hidden chrome would have
  failed in `chromeResize`; and the `env()`/`calc()` parser behaviour bit again in a new way
  (reordering rather than dropping). Reading that section first saved all three from being written
  wrong.
- **`ExploreView` had no test coverage before this plan** — nothing in `test/` rendered it. It mounts
  cleanly under jsdom with only a `react-force-graph-2d` mock (the bundled matrix/archive artifacts
  resolve through the `@matrix` / `@archive` aliases already configured in `vitest.config.ts`, and
  `fake-indexeddb/auto` in `test/setup.ts` covers the Dexie reads). No new setup was needed.

## Known Stubs

None. Every path in `ChromeToggle.tsx` is reachable and exercised; the store exports 22-05 shipped
without a production caller (`useChromeToggleMounted`, `registerChromeToggle`) now have one.

## Threat Flags

None — no network call, no persistence, no user-supplied data path, no new dependency. The control
mutates a module boolean. Register outcomes:

- **T-22-12** (a stranded user) — **mitigated and asserted**, three independent outs plus 22-05's two
  structural ones. The entry point and every escape landed in one commit, as the plan required.
- **T-22-25** (chrome painting over the escape control) — `zIndex: config.ui.z.fab` inline, no
  Tailwind `z-*` class, `chrome (14) < fab (30)` re-asserted at the rendered level; solid
  `bg-elevated` with no `backdrop-blur`, so Phase-21 D-28's transform-ancestor trap cannot re-anchor
  the `fixed` positioning.
- **T-22-14** (battery at a venue) — one reserve write per toggle, `zoomToFit` not re-called,
  reinforced by a distinct-value count. The reheat that *does* occur is inert by the shipped UX-04
  design, documented at the assertion site.
- **T-22-26** (the LIFO dismiss stack) — the hook is active only while hidden; both the restore and
  the visible-state no-op are asserted.
- **T-22-SC** — no packages installed.

## Next Phase Readiness

- **22-08 and 22-10 are unaffected.** This plan touched only its four declared files;
  `bottomOverlayInset.tsx` and every other wave-4 sibling's file is untouched.
- **Phase 23's `ShowView` consumer (CHROME-02 / INSHOW-02) is unblocked** and, per D-03, needs none of
  this component — it has a different trigger entirely (auto-hide while tracking). The mechanism was
  kept separable precisely so that consumer never has to touch this control.
- **Revert story (D-18):** the three commits are additive and independently revertible. Reverting
  `80a2ffb` alone removes the only entry point into the hidden state and returns the app to its
  wave-3 behaviour (mechanism present, unreachable) — the two test commits then fail loudly rather
  than silently, which is the correct signal.
- **One follow-on, inherited not created:** 22-05's "hoist `env(safe-area-inset-top)` into a
  `--gz-safe-top` custom property" would additionally retire this plan's `calc()`-normalization
  workaround *and* the deviation-2 source-read case. Still out of scope for this phase.

## Self-Check: PASSED

- `packages/app/src/explore/ChromeToggle.tsx` — FOUND
- `packages/app/src/explore/ExploreView.tsx` — FOUND
- `packages/app/test/chromeToggle.test.tsx` — FOUND
- `packages/app/test/chromeResize.test.tsx` — FOUND
- Commits `80a2ffb`, `8673e45`, `7211c79` — all present in `git log a6320ea..HEAD`
- `git diff --stat a6320ea HEAD` → exactly 4 files, matching `files_modified` with no extras
- `npx vitest run` → **140 files / 1199 tests passed** (base: 139 / 1188)
- `npx vitest run --project @guezzer/app packages/app/test/chromeToggle.test.tsx` → 15 passed
- `npx vitest run --project @guezzer/app packages/app/test/chromeResize.test.tsx` → 4 passed
- `npx tsc -b packages/core packages/app` → exit 0, no output
- Mutation check: reordering `<ChromeToggle />` to last in `ExploreView` fails the tab-order case

---
*Phase: 22-surface-motion-the-chrome-mechanism*
*Completed: 2026-08-06*
