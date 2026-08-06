---
phase: 22-surface-motion-the-chrome-mechanism
plan: 02
subsystem: ui
tags: [react, motion, framer-motion, animate-presence, useIsPresent, a11y, focus-trap, inert, aria-hidden, pointer-events]

# Dependency graph
requires:
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 01
    provides: "the portal → AnimatePresence → SheetSurface restructure with the scrim and card as body-level SIBLINGS, `config.ui.motion` (incl. the then-unused `SHEET_EASE_EXIT`), and `sheet.motion.test.tsx`'s pass-through-double harness"
  - phase: 08-accessibility-the-modal-layer
    provides: "`useFocusTrap` + the ref-counted `inertRoot`, `useDialogDismiss`, and `sheet.a11y.test.tsx` — the VoiceOver-verified a11y lifecycle this plan RE-TIMES rather than rewrites"
provides:
  - "`useFocusTrap` returns `{ focusInitialTarget }` (was `void`) — the D-27 enter-END focus move, referentially stable so it can ride a `motion` callback prop"
  - "SHEET-02 close-START teardown: `inert` released, focus on the trigger, exiting card `aria-hidden`, card + scrim `pointer-events: none`, scrim `onClick` dropped — ALL derived from `useIsPresent()`, all true before the exit animation finishes"
  - "SHEET-01 EXIT animation: bottom-sheet card `y: 100%` (translate only), scrim `opacity: 0`, in parallel on one config duration with `SHEET_EASE_EXIT`; fullscreen and reduced-motion fade"
  - "a per-instance `releasedRef` making the shared `inert` release idempotent (T-22-03)"
  - "a `SHEET_DURATION_MS` fallback timer so `initialFocusRef` focus can never fail to happen at all (T-22-21)"
  - "`packages/app/test/sheet.closeStart.test.tsx` — the D-20 contract, against the REAL motion library, mutation-verified"
affects: [22-04, 22-05, 22-09, 22-10, phase-23-overlays]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "presence-derived close-start bundle: one `closing = { \"aria-hidden\", style.pointerEvents }` object built from `useIsPresent()` inside the AnimatePresence CHILD, spread onto both siblings — never computed from `open` in the portal owner (§Pitfall 14)"
    - "two mechanisms, one contract: inline `pointer-events: none` makes the exiting surface untappable in a browser; DROPPING the scrim's `onClick` makes it provable in jsdom, where `fireEvent` ignores `pointer-events`"
    - "layout-effect teardown + PASSIVE re-assert for focus restore — `react-dom`'s `restoreSelection` re-applies its pre-commit focus snapshot at the end of `flushMutationEffects`, after every layout destroy"
    - "callback-plus-fallback-timer for any animation-completion side effect, cleared by whichever fires first"
    - "wait on the NODE, never `queryByRole`, when asserting removal of an `aria-hidden` subtree"

key-files:
  created:
    - packages/app/test/sheet.closeStart.test.tsx
  modified:
    - packages/app/src/components/a11y/useFocusTrap.ts
    - packages/app/src/components/Sheet.tsx
    - packages/app/test/sheet.a11y.test.tsx
    - packages/app/test/sheet.motion.test.tsx

key-decisions:
  - "MEASURED CORRECTION to the plan's Pitfall-4a premise: `useLayoutEffect` ALONE cannot guarantee the focus restore. `react-dom` captures `document.activeElement` in `prepareForCommit` and re-applies it in `restoreSelection` at the END of `flushMutationEffects` — after every layout destroy. A second, PASSIVE effect destroy re-asserts the restore and gets the last word."
  - "Task 2 + Task 3 landed as ONE commit (`53d6e59`) via `--amend`, exactly three files. The revert dry-run was executed on a scratch branch: vitest exit 0, tsc exit 0."
  - "`sheet.closeStart.test.tsx` was MUTATION-VERIFIED: with `closing` hard-coded to the §Pitfall 14 defect (values not derived from `isPresent`), 4 of its 5 cases fail. It is not a vacuous green."
  - "`SHEET-01`/`SHEET-02` are still NOT checked off in REQUIREMENTS.md — plan 22-04 also carries SHEET-01, and SHEET-02's device half is plan 22-09 UAT test 2."

patterns-established:
  - "Pattern: assert removal with `waitForElementToBeRemoved(node)`, never `waitForElementToBeRemoved(() => screen.queryByRole(...))`, for any surface that becomes `aria-hidden` on the way out — `*ByRole` ignores `aria-hidden` subtrees and reports 'already removed' while the node is still painted, which is a SILENT false green"
  - "Pattern: any focus restore that must survive a React commit belongs in a passive effect, or in a layout effect PAIRED with a passive re-assert"

requirements-completed: []

# Metrics
duration: 21min
completed: 2026-08-06
---

# Phase 22 Plan 02: The Sheet Close-Start Contract Summary

**Every part of a sheet's teardown except DOM removal now fires in the same tick `onClose` is requested — background un-`inert`, focus back on the trigger, exiting card `aria-hidden`, card and scrim both non-interactive and the scrim's close handler gone — all derived from `useIsPresent()` so they actually fire on a frozen exiting element, with the card sliding down and the scrim fading out in parallel over 200ms before `AnimatePresence` finally removes the node.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-08-06T04:29:30Z (base `e0ca708`)
- **Completed:** 2026-08-06T04:50:07Z
- **Tasks:** 3 (landing as 2 commits, by design — D-17)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **The phase's single hardest invariant is now executable.** `sheet.closeStart.test.tsx` asserts all six D-19 close-start conditions with the exiting subtree still mounted, against the **real** `motion` library — anti-vacuity check first, then inert/focus/`aria-hidden`/`pointer-events`×2/scrim-tap.
- **It is provably non-vacuous.** Before committing, `closing` was temporarily hard-coded to the §Pitfall 14 defect (attributes not derived from `isPresent`). **4 of the 5 cases went red.** The test discriminates the defect it exists to catch, which is the whole point of not using a hand-rolled double.
- **A real ordering defect was measured and fixed, not assumed.** The plan's premise — "switch to `useLayoutEffect` and the focus restore lands before `aria-hidden`" — is *half* true. React re-applies its own pre-commit focus snapshot after every layout destroy, so a layout-phase restore is silently undone. Found by instrumenting `HTMLElement.prototype.focus` and `Node.prototype.removeChild`; fixed with a passive re-assert. Without it, `document.activeElement === trigger` is false at close-start and every consumer of D-19 item 2 is a lie.
- **The one-command revert is verified, not hoped.** Scratch branch, `git revert --no-edit 53d6e59`, `npx vitest run --project @guezzer/app` → **exit 0** (87 files / 699 tests), `npx tsc -b packages/core packages/app` → **exit 0**, `sheet.closeStart.test.tsx` gone, `sheet.motion.test.tsx` back to enter-only, and Task 1's enter-END `waitFor` case in `sheet.a11y.test.tsx` still green.
- **Full suite green on the real branch:** 136 test files / 1158 tests; app project alone 88 files / 709 tests; `tsc` exit 0.

## Task Commits

1. **Task 1: Re-time `useFocusTrap` + wire its enter-END focus** — `d976ca0` (feat)
2. **Tasks 2 + 3: the atomic exit commit** — `53d6e59` (feat; Task 3 folded in with `git commit --amend --no-edit`)

`git log -1 --name-only` on `53d6e59` lists exactly three files: `packages/app/src/components/Sheet.tsx`, `packages/app/test/sheet.motion.test.tsx`, `packages/app/test/sheet.closeStart.test.tsx`.

## Files Created/Modified

- **`packages/app/src/components/a11y/useFocusTrap.ts`** — return type `void` → `FocusTrapHandle { focusInitialTarget }`. `useEffect` → `useLayoutEffect` for the trap itself. Per-instance `releasedRef` guards the release. Activation no longer reads `initialFocusRef` (it focuses the first focusable / the container). A second, passive effect re-asserts the focus restore. `initialFocusRef` dropped from the dep array (activation no longer reads it, so a fresh ref object must not rebuild the trap). The `active`-is-a-function-of-`open` INVARIANT is recorded at the top of the module doc.
- **`packages/app/src/components/Sheet.tsx`** — `Sheet` destructures `focusInitialTarget` and passes it down. `SheetSurface` calls `useIsPresent()`, builds the `closing` bundle from it, spreads it onto card **and** scrim, flips the transition `ease` on presence, adds `exit` to both siblings, drops the scrim's `onClick` while exiting, and calls `focusInitialTarget()` from `onAnimationComplete` under an `isPresent` guard plus a `SHEET_DURATION_MS` fallback timer. The stale "ENTER ONLY" module-doc block is replaced by the close-start contract and the back-out procedure.
- **`packages/app/test/sheet.a11y.test.tsx`** — the `initialFocusRef` case now asserts the target is **not** focused synchronously *and* that focus is nonetheless inside the dialog, then `await waitFor(() => expect(target).toHaveFocus())`. New case: closing the **bottom** sheet of an open stack leaves `#app-content` inert (T-22-03 / Pitfall 5). Limits header gains notes 4 (the `inert` **expando**, not an attribute — probe P8) and 5 (post-22-02 exit window: every close case here asserts synchronously, which *is* close-start and stays correct, but any future post-close query must await removal).
- **`packages/app/test/sheet.motion.test.tsx`** — the pass-through double gains `useIsPresent: () => true` and strips `onAnimationComplete` (Task 1, so the file survives the revert); re-emits `data-exit` and gains five exit-shape cases (Task 2, so they revert with it).
- **`packages/app/test/sheet.closeStart.test.tsx`** — **new**, 5 cases, no `vi.mock("motion/react"`, no `vi.useFakeTimers()`.

## Decisions Made

- **Two effects, not one, for the a11y teardown.** See the deviation below. The layout effect still performs the restore first (which is what Pitfall 4a wants whenever React does *not* override — a hard unmount detaches the captured element and `restoreSelection` skips it); the passive one guarantees it. Together: focus leaves the exiting subtree as early as possible and is *guaranteed* off it by the end of the commit.
- **`initialFocusRef` dropped from the trap's dep array.** Activation no longer reads it, so keeping it would tear down and rebuild the whole trap — releasing `inert` and restoring focus — whenever a caller passed a fresh ref object. Strictly safer than the shipped behaviour.
- **`SHEET-01`/`SHEET-02` deliberately not checked off.** `requirements-completed: []`. SHEET-01's exit half is here but plan 22-04 still converts `DexView`; SHEET-02's device half is 22-09 UAT test 2. Marking either would be a false green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 – Bug] A layout-phase focus restore is silently undone by `react-dom`'s own `restoreSelection`**

- **Found during:** Task 1 (the shipped `close restores focus to the trigger and clears inert` case went red the moment `useEffect` became `useLayoutEffect`).
- **Issue:** The plan states that `useLayoutEffect` makes the destroy "run synchronously inside the commit's mutation phase" and thereby completes the focus restore before `aria-hidden` lands. Measured behaviour in this repo (React 19.2.7) is that `react-dom` captures `document.activeElement` in `prepareForCommit` **before** the mutation phase and **re-applies it** in `restoreSelection` at the end of `flushMutationEffects` — i.e. *after* every layout-effect destroy has run. On a sheet close the captured element is a control **inside** the sheet, so React re-focused the sheet's own button and undid the restore. With an `exit` variant the exiting card is still in the DOM, so React's `isInDocument` guard passes and the override **always** fires — this would have broken D-19 item 2 in production, not just in a test.
- **How it was found:** instrumented `HTMLElement.prototype.focus` / `Node.prototype.removeChild` in a scratch test; the stack trace named `flushMutationEffects` → `commitRoot` explicitly. A separate characterisation test ruled out a jsdom focus-fixup quirk (removing an unrelated subtree does **not** move focus in jsdom).
- **Fix:** keep the layout effect for the trap (listener, `inert`, and a best-effort early restore), and add a **passive** effect whose destroy re-asserts the restore. Passive destroys run after `restoreSelection`, and they flush inside `act()`, so the close-start assertion stays synchronous in tests. This is also the timing the shipped Phase-8 hook already had, so nothing VoiceOver-verified regresses. The restore helper is idempotent and skips a disconnected trigger.
- **Files modified:** `packages/app/src/components/a11y/useFocusTrap.ts`
- **Verification:** `sheet.a11y.test.tsx` and `sheet.closeStart.test.tsx` both green; case 1 of the latter asserts `document.activeElement === trigger` **synchronously** at close-start with the dialog still mounted.
- **Committed in:** `d976ca0`

**2. [Rule 3 – Blocking] `sheet.motion.test.tsx`'s double had no `useIsPresent`**

- **Found during:** Task 1 (introducing the `useIsPresent` import).
- **Issue:** that file mocks `motion/react` wholesale; the mock lacked `useIsPresent`, so `Sheet` would call `undefined()`. Also, `onAnimationComplete` reaching a plain `<div>` makes React DOM warn "Unknown event handler property".
- **Fix:** added `useIsPresent: () => true` and stripped `onAnimationComplete` in the double — both in **Task 1's** commit, so they survive the exit revert (the reverted `Sheet.tsx` still uses both).
- **Files modified:** `packages/app/test/sheet.motion.test.tsx`
- **Committed in:** `d976ca0`

**3. [Rule 1 – Bug] `waitForElementToBeRemoved(() => screen.queryByRole("dialog"))` is a silent false green**

- **Found during:** Task 3 (first run: four cases errored with "the element(s) given … are already removed" while `document.body.contains(dialog)` had just passed).
- **Issue:** the plan's `<action>` (and 22-RESEARCH's code example) specify waiting on `queryByRole("dialog")`. But `*ByRole` ignores `aria-hidden` subtrees by default — and D-19 item 3 puts `aria-hidden="true"` on the exiting card. So the role query returns `null` the instant the contract *works*. Here it surfaced as a loud error; in a file whose earlier assertions differed it would resolve instantly and **mask** a broken exit window.
- **Fix:** wait on the captured NODE — `waitForElementToBeRemoved(dialog, { timeout: 2000 })` — and record the trap in a comment at the assertion.
- **Files modified:** `packages/app/test/sheet.closeStart.test.tsx`
- **Committed in:** `53d6e59`

**4. [Rule 3 – Blocking] `npx tsc -b` is vacuous in this repo**

- **Found during:** every verification gate (carried from plan 22-01's identical finding).
- **Issue:** there is no root `tsconfig.json` (only `tsconfig.base.json` + per-package configs). Bare `npx tsc -b` prints `TS5083: Cannot read file '…/tsconfig.json'` and **still exits 0**.
- **Fix:** ran `npx tsc -b packages/core packages/app` at every gate. No config file added.
- **Files modified:** none (verification-only)
- **Committed in:** n/a

### Deliberate deviation from one plan instruction

**5. Task 3 case 4 (`initialFocusRef`) is one of the five cases but does not itself depend on `aria-hidden`**

Noted for honesty, not as a change: under the mutation check, cases 1, 2, 3 and 5 go red against the §Pitfall 14 defect and case 4 stays green — it exercises D-27/Pitfall 12 (the focus timing), which is a different mechanism. The file's discriminating power over Pitfall 14 is 4 cases, not 5.

---

**Total deviations:** 5 (2 Rule-1 bugs, 2 Rule-3 blocking, 1 disclosure)
**Impact on plan:** No scope change. Deviation 1 adds one effect to a file the plan already owns; deviations 2–4 are test/verification corrections. No file, dependency or behaviour beyond the plan's `<action>` text was added.

## ⚠ The enter-only fallback: what a REAL revert must remove

`git revert 53d6e59` is the single command, and it was proven green on a scratch branch (below). **But three artifacts outside that commit also assert an exit window and must go with it.** Do not read this summary as "one revert and you're done" on a device night:

| # | File | `describe` block | Lands in |
|---|------|------------------|----------|
| 1 | `packages/app/test/dexView.test.tsx` | `describe("fullscreen sheet exit window (reverts with the 22-02 exit commit)", …)` | plan 22-04 |
| 2 | `packages/app/test/trailNodeSheet.test.tsx` | `describe("bottom-sheet exit window (reverts with the 22-02 exit commit)", …)` | plan 22-10 |
| 3 | `packages/app/test/songRow.test.tsx` | `describe("bottom-sheet exit window (reverts with the 22-02 exit commit)", …)` | plan 22-10 |

These are steps **(b)** and **(c)** of **plan 22-09's revert procedure 1**, which is the authoritative copy and whose own dry-run re-runs with all three deletions applied. Follow that procedure, not this table alone.

### Revert dry-run, as executed (Task 3 part C)

```
git checkout -b scratch-22-02-revert-dryrun
git revert --no-edit 53d6e59      →  3 files changed, 15 insertions(+), 429 deletions(-)
                                     delete mode packages/app/test/sheet.closeStart.test.tsx
npx vitest run --project @guezzer/app   →  EXIT 0   (87 files / 699 tests passed)
npx tsc -b packages/core packages/app   →  EXIT 0   (no output)
git checkout worktree-agent-…; git branch -D scratch-22-02-revert-dryrun
```

Observed post-revert state, all three as the plan predicted:
- `sheet.closeStart.test.tsx` — **gone** (removed by the revert).
- `sheet.a11y.test.tsx` — untouched by the revert; its `await waitFor` `initialFocusRef` case **still passes**, because Task 1's enter-END wiring is in the *other* commit and survives.
- `sheet.motion.test.tsx` — back to its enter-only cases (87/699 is exactly the count from before the exit commit).

## Issues Encountered

- **The React `restoreSelection` interaction (deviation 1) cost most of this plan's debugging time and is the most transferable finding.** Any future "restore focus on teardown" written as a layout effect in this codebase will be silently overridden. The rule is recorded in `useFocusTrap.ts` as a long comment at the passive effect, because a future reader deleting that "redundant duplicate" would reintroduce the bug with a green test suite (the a11y test would still pass — it is the *close-start* assertion that catches it).
- **`aria-hidden` vs `*ByRole` (deviation 3) is the same class of trap** and will bite plans 22-04/22-10 when they add their own exit-window blocks. The pattern is recorded in `patterns-established`.
- No package was installed. `@testing-library/user-event` remains deliberately absent (T-22-SC); the `pointer-events` contract is carried by the style string plus the dropped handler.

## Known Stubs

None. Every value added is live: `SHEET_EASE_EXIT` (front-loaded by 22-01) now has its consumer, and every branch of `closing`, the `exit` variants, the fallback timer and `focusInitialTarget` is exercised by a passing assertion.

## Threat Flags

None. No network call, no persistence, no user-supplied data path, no dependency — the `<threat_model>`'s "none new" trust-boundary row holds exactly. The four registered mitigations behave as predicted:

- **T-22-03** (double release un-inerts a live modal) — `releasedRef` plus the new bottom-of-stack case in `sheet.a11y.test.tsx`.
- **T-22-04** (interaction with a control the UI claims is gone) — `aria-hidden` + `pointer-events` + dropped handler, all three from `useIsPresent()`; asserted anti-vacuity-first.
- **T-22-21** (`initialFocusRef` focus that never fires) — `SHEET_DURATION_MS` fallback timer, cleared by whichever path wins.
- **T-22-35** (revert leaving orphaned tests) — one commit, dry-run green, three out-of-commit artifacts named above.

**T-22-05** (a tap swallowed at a venue) keeps its device half: plan 22-09 UAT test 2.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **22-04 and 22-10 are unblocked** and inherit a `<Sheet>` whose close behaviour is animated and contractually asserted. Both will add exit-window `describe` blocks; both must use `waitForElementToBeRemoved(node)`, never a role query, and both must be listed in 22-09's revert procedure 1.
- **The nine unmount-driven sites are unchanged** (module doc note (b)): their parent removes the `<Sheet>` outright, so `AnimatePresence` never runs an exit and they get no close-start window. That is still a documented seam. The passive focus re-assert makes their focus restore *more* robust than before, not less.
- **Carried to the device session:** the ~200ms window in which the background is live while a sheet is still painted is now real on device. `22-HUMAN-UAT.md` test 2 owns it; if it fails, the revert above is one verified command plus 22-09's three deletions.

## Self-Check: PASSED

Files verified on disk: `packages/app/src/components/a11y/useFocusTrap.ts`,
`packages/app/src/components/Sheet.tsx`, `packages/app/test/sheet.a11y.test.tsx`,
`packages/app/test/sheet.motion.test.tsx`, `packages/app/test/sheet.closeStart.test.tsx`,
and this SUMMARY.

Commits verified in `git log` on `worktree-agent-ada7b9743b14c5e10` (base `e0ca708`):
`d976ca0`, `53d6e59`.

Verification re-run at close on the real branch:
`npx vitest run` → 136 files / 1158 tests passed;
`npx vitest run --project @guezzer/app` → 88 files / 709 tests passed, exit 0;
`npx tsc -b packages/core packages/app` → exit 0, no output;
`grep -n "open ?" packages/app/src/components/Sheet.tsx` → no match;
`git log -1 --name-only` → exactly the three expected files.

---
*Phase: 22-surface-motion-the-chrome-mechanism*
*Completed: 2026-08-06*
