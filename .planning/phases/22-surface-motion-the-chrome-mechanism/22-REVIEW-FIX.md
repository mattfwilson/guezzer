---
phase: 22-surface-motion-the-chrome-mechanism
fixed_at: 2026-08-06T09:05:00Z
review_path: .planning/phases/22-surface-motion-the-chrome-mechanism/22-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 10
skipped: 1
status: partial
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-08-06
**Source review:** `.planning/phases/22-surface-motion-the-chrome-mechanism/22-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (CR-01, CR-02, WR-01 … WR-09; the 3 Info findings were out of scope)
- Fixed: 10
- Skipped: 1 (WR-04 — judgment call, reasoning below)

**Gates:** `npx tsc -b packages/core packages/app` exits 0. `npx vitest run` is
**140 files / 1227 tests, all passing** — baseline was 140/1214, so the change set
is +13 tests and 0 regressions. Every gate was re-run after each individual fix,
and the full suite was run four consecutive times at the end (see *Test-suite
notes*).

**Method note.** Every new test in this set was verified **discriminating**: the
shipped (defective) implementation was temporarily restored and the new case
observed to FAIL, before being restored to the fix. Cases that could not be shown
to fail against the shipped code are called out individually below. No fix was
committed on "the suite is still green" alone.

## Fixed Issues

### CR-01: The install-section focus counter is never acknowledged

**Files modified:** `packages/app/src/settings/installSectionFocus.ts`,
`packages/app/src/settings/SettingsView.tsx`,
`packages/app/test/installSection.test.tsx`
**Commit:** `80c2895`

**Applied fix:** Added a `requestCount` / `handledCount` pair; the snapshot is now
the **difference**, so `0` means "nothing pending" for both the never-requested
and the already-handled case. `SettingsView` calls the new
`acknowledgeInstallSectionFocus()` after the focus move. The review's warning was
respected: a `useRef(installFocusRequest)` seed in the view would have broken the
cross-route deep link (the counter is bumped *before* the view mounts), so the
consumable state lives in the store where both orderings read the same value.

Acknowledging **unconditionally** (rather than only when the heading resolved) is
a deliberate small departure from the review's snippet: if the section is not
rendered there is no target on this visit and never will be, so leaving the
request pending would only make it fire on an unrelated later mount. That is
noted in the code.

New regression case renders → requests → unmounts → remounts → asserts the heading
is **not** focused, then asserts a genuinely new request still works. Verified to
fail against the shipped monotonic snapshot.

---

### CR-02: `promptInstall()` can reject unhandled, permanently wedging `canInstall`

**Files modified:** `packages/app/src/pwa/install/installStore.ts`,
`packages/app/test/installStore.test.tsx`
**Commit:** `d8e83cf`

**Applied fix:** Consume the stash synchronously before the first await, wrap both
awaits in `try`/`catch`, notify in `finally`. **The T-22-23 gesture-binding
constraint is preserved and re-documented**: `deferred = null` and entering the
`try` are both synchronous, so `await d.prompt()` remains the first awaited
expression in the body.

Two new cases: a rejecting `prompt()` (asserts `resolves.toBeUndefined()` **and**
`canInstall === false` afterwards) and a second tap during an unsettled
`userChoice` (asserts `prompt` was called exactly once). Both verified to fail
against the shipped body — the second one by hanging until the test timeout,
which is precisely the re-entry.

---

### WR-01: `SetlistView`'s `aria-modal="true"` dialog had no focus containment

**Files modified:** `packages/app/src/dex/SetlistView.tsx`,
`packages/app/test/setlistView.test.tsx`
**Commit:** `cc157de`

**Applied fix:** Took the review's first option (focus move + shared ref-counted
`setRootInert`), not the second (dropping `aria-modal`). Focus moves to the Back
control on entry; `#app-content` goes inert; both are released on exit with the
`useFocusTrap` `isConnected` restore guard.

This is focus **placement** plus background inert, **not** a focus trap — D-22's
"stays hand-rolled, no `<Sheet>` migration, no focus trap" is untouched, and the
deferred five-sheet migration remains the structural fix. Scoped to the **missing**
branch only: the pending branch renders no focusable at all (there is nothing to
move focus to) and is the pre-existing hold-the-frame state rather than a surface
this phase made control-bearing.

New case asserts both halves (focus inside, background inert) and both releases,
with an anti-vacuity check that a real trigger existed to restore to.

---

### WR-02: `useDialogDismiss`'s LIFO position depended on `onClose` identity

**Files modified:** `packages/app/src/components/a11y/useDialogDismiss.ts`,
`packages/app/src/explore/ChromeToggle.tsx`,
`packages/app/test/sheet.a11y.test.tsx`
**Commit:** `fd43f9a`

**Applied fix:** Callback held in a ref (written during render, so the handler
always invokes the latest closure), stable handler pushed, effect keyed on
`[active]` alone. `ChromeToggle`'s `useCallback` comment is updated — it explicitly
documented the old deps array as its reason for existing.

New case uses **two separately-parented sheets** so the lower one can re-render
alone; the shipped stacked case cannot catch this because its two sheets are
siblings in one component and tree-order re-pushes restore the original order by
coincidence. Verified to fail against the shipped deps array.

---

### WR-03: The chrome-toggle header slot ignored `env(safe-area-inset-right)`

**Files modified:** `packages/app/src/components/AppShell.tsx`,
`packages/app/test/chromeToggle.test.tsx`
**Commit:** `8b4a47c`

**Applied fix:** The reserve now carries the same inset term the toggle positions
with, making the clearance a constant 8px at every inset instead of
`8 − insetRight` (negative at a landscape notch, ~36px of overlap between two 44px
tap targets). Fixed as arithmetic — **an orientation lock was explicitly not
added**, per the dispatch instruction.

Test work: the shipped `padding-right: 52px` assertion is updated to jsdom's
normalized `calc()` serialization (the same convention the toggle's own inset
assertions already use), plus a new **source guard** asserting both expressions
read the inset — because jsdom resolves `env()` to nothing and no rendered
assertion can observe the collision.

---

### WR-05: Overlay heights deregistered at exit-START

**Files modified:** `packages/app/src/pwa/bottomOverlayInset.ts`,
`packages/app/src/components/WaveToast.tsx`,
`packages/app/src/components/BingoCelebration.tsx`,
`packages/app/test/bottomOverlayInset.test.tsx`
**Commit:** `36c61c9`

**Applied fix:** Added an optional `clearDelayMs` tail, defaulting to `0` — verified
correct for the three overlays that simply unmount (`InstallBanner`, `UpdateToast`,
`BackupToast` carry no `AnimatePresence`) — and passed `TOAST_DURATION_MS` at the
two `AnimatePresence` call sites.

**The review's suggested snippet does not work as written** — it returns a cleanup
function *from inside* an effect cleanup, and scheduling the timer in the cleanup
is defeated by the next effect body running immediately afterwards and clearing.
The implemented shape moves the clear out of the cleanup into the next run's
`!visible` branch (which knows about the delay), plus an unmount-scoped effect
that clears immediately since a removed subtree plays no exit animation. A re-show
inside the window cancels the pending clear, so interrupt-and-reverse never dips
the reservation.

Three new cases (hold-then-clear, re-show cancels, unmount clears immediately).
The hold-then-clear case is verified to fail with the tail disabled.

---

### WR-06: The registration never re-measured on an `AnimatePresence` key swap

**Files modified:** `packages/app/src/pwa/bottomOverlayInset.ts`,
`packages/app/test/bottomOverlayInset.test.tsx`,
`packages/app/test/components/WaveToast.test.tsx`
**Commit:** `b48a020`

**Applied fix:** Callback ref plus element state, so the element is a dependency.
Took the review's primary fix (the hook), not its fallback (routing
`BingoCelebration` through a null frame), because the hook is the root cause and
the fallback would add a visible flicker.

**One addition the review did not anticipate:** a `null` detach must be **ignored**.
Under `AnimatePresence` the outgoing child is still mounted while its replacement
is already attached, and both share the one callback identity — honouring the
outgoing node's detach would clear the reservation out from under the toast
currently on screen, ~200ms after it appeared. `visible` remains what ends a
registration. The naive callback ref would have made the bug worse; this is
covered by a dedicated assertion.

Return type changed from `RefObject` to a callback ref — verified safe: no consumer
reads `.current` (all five call sites only do `ref={…}`).

**Test-double change, called out explicitly.** This fix required caching
`WaveToast.test.tsx`'s `motion/react` double per tag. An uncached `Proxy` returns a
brand-new `forwardRef` component type on every property read, so React remounted
the toast node on every render and the measure-on-attach cycle never settled
("Maximum update depth exceeded"). That is a **double artifact, not a component
defect** — the real `motion.div` is a stable reference — and `chromeToggle.test.tsx`
already carries this exact correction with the rationale written out. Caching makes
the double strictly more faithful to the library. Two other files
(`sheet.motion.test.tsx`, `songRow.test.tsx`, `trailNodeSheet.test.tsx`) still use
uncached doubles and are unaffected: none renders a registered overlay.

Two new cases (plain key swap; swap while the outgoing node is still mounted, then
its later detach). Both verified to fail against the shipped `[id, visible]` deps.

---

### WR-07: `rankOf()` collided every undeclared id at the same rank

**Files modified:** `packages/app/src/pwa/bottomOverlayInset.ts`,
`packages/app/test/bottomOverlayInset.test.tsx`
**Commit:** `bc7c76b`

**Applied fix:** Exactly as suggested — unknown ids take their own rank in first-seen
order after the declared list, cleared by the test-reset hatch. New case asserts
two undeclared ids get distinct offsets and that the top of the stack equals the
sum the content reserve reserves. The shipped single-undeclared-id case still
passes unchanged (its expected `280` is unaffected).

---

### WR-08: `Sheet.tsx`'s `{...closing}` spread contributed a dead `style`

**Files modified:** `packages/app/src/components/Sheet.tsx`
**Commit:** `db5b847`

**Applied fix:** Split into `closingAriaHidden` / `closingPointerEvents`, one
consumer each, as suggested. The revert-procedure note at the top of the file
(which named "the presence-derived `closing` bundle" as a revert artifact) is
updated to name the two values, so plan 22-09's revert procedure stays accurate.

No new test: `sheet.closeStart.test.tsx:129-130` already pins both `pointerEvents`
values and the exiting `aria-hidden`, and was confirmed still passing. This finding
was explicitly "not currently a behaviour bug", so there is no failing state to
write a discriminating test against.

---

### WR-09: Test-reset hatches cleared the live listener set

**Files modified:** `packages/app/src/layout/chromeVisibility.ts`,
`packages/app/src/pwa/bottomOverlayInset.ts`,
`packages/app/src/pwa/install/installStore.ts`,
`packages/app/src/settings/installSectionFocus.ts`,
`packages/app/test/bottomOverlayInset.test.tsx`
**Commit:** `ac5684c`

**Applied fix:** Took the review's **first** option (drop `listeners.clear()`), not
the throwing variant — throwing adds a new failure mode to a test-only hatch, while
dropping removes the silent-detach failure outright.

One addition: the resets now fan out through `notify()` rather than assigning the
cached snapshots directly, so a still-mounted subscriber re-reads the reset values
instead of holding a snapshot it can never be notified out of. The hatch is now
order-independent, which is what makes the natural `beforeEach(__reset…)` placement
safe. **The production subscribe/unsubscribe contract is untouched**, per the
dispatch constraint — only the four hatches changed.

Zero effect on current call sites: every one of them runs with an empty listener
set, so the added `notify()` iterates nothing. New case resets with a subscriber
deliberately still mounted and asserts a **later** mutation still reaches it —
verified to fail against `listeners.clear()`.

## Skipped Issues

### WR-04: `setChromeVisible(false)` is reachable with zero registered toggles

**File:** `packages/app/src/layout/chromeVisibility.ts:117-149`
**Reason:** Judgment call — the proposed guard is a Phase-23 API redesign, not a
Phase-22 defect fix. Skipped as a guard; carried forward as documentation
(commit `699ce15`, deliberately tagged `docs(22):` not `fix(22):`).

**Original issue:** `setChromeVisible` is a public export with no relationship to
`toggleCount`, so a consumer could hide the chrome with no exit control mounted —
no visible control, no Escape handler, no reset on route change.

**Reasoning, measured rather than asserted.** I applied the review's exact guard
(`if (next === false && toggleCount === 0) return;`) and ran the suite. It fails
**four** shipped cases in `chromeToggle.test.tsx`:

- CHROME-01 "flipping the store collapses the reserve"
- CHROME-04 "both chrome surfaces carry inert + aria-hidden while hidden"
- "hidden chrome is OUT OF FLOW, not merely translated"
- D-13 "`<main>` picks up the inset the header stopped reserving"

All four render `<AppShell>content</AppShell>` with **no `ChromeToggle` mounted**
and drive the store directly. That is not incidental: it is D-12, stated verbatim
in this module's own header — *"MECHANISM, NOT CONTROL. This module owns the STATE;
it renders nothing and knows about no view… control and mechanism must be
separable: Phase 23's consumer has a different trigger entirely (auto-hide while
tracking, no button — D-03)."*

The guard would require Phase 23's **explicitly button-less** consumer to register a
control before it can hide. That is the "speculative API redesign for a consumer
that doesn't exist yet" case, against requirements not yet written. It also
directly contradicts a locked decision this phase documented.

This agrees with the phase verifier, which recorded WR-04 under `deferred:` with an
escapability audit that traced every path into and out of the hidden state and
could construct **no reachable stranded state within Phase 22** (`ChromeToggle` is
the sole caller, registers on mount before any click can reach the setter, and its
unregister forces `visible = true`).

**What was done instead.** The one thing genuinely missing was any note at the call
site a Phase 23 author will edit. `setChromeVisible`'s docstring now records the
unenforced precondition, why it holds today by co-location rather than by
construction, and why the guard is deliberately absent. Zero behaviour change,
zero test change.

**Recommendation for Phase 23:** land the structural guard together with CHROME-02's
auto-hide consumer, in the same commit as the requirement that defines that
consumer's escape route — the four mechanism tests above will need to register a
control (or the guard will need a different shape), and that decision belongs with
the requirement, not here.

## Notes for the developer

**Two fixes warrant a human eye beyond the automated gates:**

1. **WR-05 / WR-06** (`bottomOverlayInset.ts`) — these are the only fixes with
   timing-dependent semantics (a 200ms tail, interrupt-and-reverse cancellation,
   and detach-ordering under `AnimatePresence`). The jsdom cases use fake timers and
   a hand-rolled model of the presence lifecycle rather than the real motion
   library. The behaviour is worth eyeballing once on device: fire two Bingo mark
   toasts back to back (different copy lengths) on a **scrolling** route and confirm
   nothing under them jumps during the crossover.
2. **WR-03** (`AppShell.tsx`) — the arithmetic is verified by source guard only, since
   jsdom resolves `env()` to nothing. Worth one landscape rotation on a notched
   iPhone during the pending device session, alongside 22-HUMAN-UAT test 0.

**Both are already reachable from the pending UAT script**, so they add no new
session — just two extra observations.

**Test-suite notes.** One unrelated flake was observed: `archiveBrowser.test.tsx`
> "renders a live-tracked show as marked with NO unmark control (Pitfall 6)" failed
once in a full parallel run, then passed in four consecutive full runs and five
consecutive isolated runs. That file imports **none** of the four stores touched here
and carries 21 `waitFor`/`findBy` calls, so it is timing-sensitive under parallel
load. It also passes consistently on the pre-change baseline. Flagged as
pre-existing flakiness, not a regression — but worth watching if it recurs.

**Nothing in `.planning/STATE.md` or `.planning/ROADMAP.md` was touched**, and no
lint gate was introduced (this repo has none).

---

_Fixed: 2026-08-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
