---
phase: 22-surface-motion-the-chrome-mechanism
verified: 2026-08-06T06:02:29Z
status: closed_with_deferral
score: 4/5 roadmap success criteria fully verified; SC5 partial (NAV-06 blocked on Android hardware)
overrides_applied: 2
re_verification: 2026-08-10T00:00:00Z
re_verification_note: >-
  The body of this report reflects the 2026-08-06 audit and is left INTACT — it is the
  record of what was true then, and its escapability and a11y audits still stand. Three of
  its four gaps closed afterwards, by events it could not see: the device UAT session
  (2026-08-09) and the code-review fix pass (2026-08-06T09:05, commit 80c2895). Read the
  "Re-verification" section at the top of the body before acting on any gap below.
gaps:
  - truth: "SC3 / CHROME-05 — hiding or showing chrome never reheats the GizzVerse simulation"
    status: partial
    reason: >-
      The "exactly one resize callback, asserted by test" half is verified four independent
      ways. The "never reheats the simulation" half is FALSIFIED by the shipped code:
      ConstellationCanvas's spacing effect has deps [graphData, size.width, size.height] and
      calls fg.d3ReheatSimulation() unconditionally, and a chrome toggle changes size.height.
      chromeResize.test.tsx documents this in a block comment and deliberately declines to
      assert the requirement's own wording ("Do not 'strengthen' this into a failure").
      The mitigation argument (onEngineStop pins fx/fy so the reheat cannot move the layout;
      firstSettleRef gates zoomToFit so the camera cannot snap) is sound and was independently
      confirmed in ConstellationCanvas.tsx, but it makes the reheat INERT, not ABSENT. No
      override was recorded for this deviation, so it stands as an unreconciled gap between
      shipped behaviour and both REQUIREMENTS.md CHROME-05 and ROADMAP SC3.
    artifacts:
      - path: "packages/app/src/explore/ConstellationCanvas.tsx"
        issue: "Line 249 `fg.d3ReheatSimulation()` fires on every size.height change, i.e. on every chrome toggle"
      - path: "packages/app/test/chromeResize.test.tsx"
        issue: "Lines 192-207 explicitly document that the requirement's literal assertion FAILS and must stay absent"
    missing:
      - "Either an accepted override reconciling CHROME-05's wording with the inert-reheat design, or an amendment to REQUIREMENTS.md/ROADMAP SC3 wording, or a change to the spacing effect so a pure box change does not reheat"
  - truth: "SC1 / SHEET-01 — EVERY bottom sheet animates smoothly up on open and down on close"
    status: partial
    reason: >-
      The shared <Sheet> primitive animates correctly and is well tested. But the quantifier
      "every bottom sheet" is not met, by design. FIVE hand-rolled bottom sheets never animate
      at all (SearchSheet, AlbumDetail, ArchiveBrowser, SetlistView, NodeSheet — locked
      decision D-16 in 22-CONTEXT.md, and Sheet.tsx names SearchSheet, "the one-thumb
      in-the-dark surface used most at a show", as a named accepted seam). Separately, SIX of
      the nineteen <Sheet> element openings still hard-code `open` and are removed by their
      parent, so they enter-animate but never exit: CompareView x2 and FriendDetail x2
      (fullscreen) and PinSheet x2 (bottom-sheet). Verified independently — 19 openings found,
      13 prop-driven, 6 hardcoded, exactly matching Sheet.tsx's seam roster. The deviation is
      deliberate, documented and bounded, but no override reconciles it with SC1's wording.
    artifacts:
      - path: "packages/app/src/map/PinSheet.tsx"
        issue: "Two `<Sheet open>` openings (lines 73, 115) — bottom-sheet variant, enter-only, no exit animation and no close-start window"
      - path: "packages/app/src/show/SearchSheet.tsx"
        issue: "Hand-rolled; never adopts the animated primitive (D-16 accepted seam)"
    missing:
      - "Either an accepted override narrowing SC1 from 'every bottom sheet' to 'every <Sheet>-backed prop-driven sheet', or the deferred hand-rolled migration"
  - truth: "SC5 / NAV-05 — the relocated install affordance does not disturb ordinary Settings use"
    status: partial
    reason: >-
      Every behaviour NAV-05 names is present and tested. But the deep-link focus signal ships
      a focus-management defect (already surfaced as 22-REVIEW CR-01, independently confirmed
      here): installSectionFocus.ts is a monotonic counter that is never acknowledged, and
      SettingsView is conditionally mounted at App.tsx:120-121, so after the deep link has been
      used once the counter stays >= 1 and every later remount of SettingsView re-runs the
      effect — scrolling to and focusing the install heading on a plain Settings visit. The
      code's own guard comment ("0 is 'never requested' — do not steal focus on a plain visit
      to Settings") is false as shipped. This is a shipped accessibility regression on a phase
      whose goal is framed around not losing accessibility guarantees.
    artifacts:
      - path: "packages/app/src/settings/installSectionFocus.ts"
        issue: "No acknowledge/consume path; requestCount is monotonic and module-global"
      - path: "packages/app/src/settings/SettingsView.tsx"
        issue: "Lines 84-94: effect keyed on the counter re-fires on every remount, not only on a new request"
    missing:
      - "An acknowledgement step (e.g. SettingsView records the last-handled count in a ref/module and no-ops when unchanged), or a mount-vs-request discriminator"
  - truth: "Phase-22 completion tracking is auditable — folded todos are closed"
    status: partial
    reason: >-
      Three todo files that this phase implemented are still sitting in
      .planning/todos/pending/ with no .planning/todos/done/ directory at all: CR-01
      (2026-07-24-simultaneous-bottom-overlay-stacking.md, delivered by 22-08), CR-02
      (2026-08-05-setlistview-loading-state-is-an-unrecoverable-aria-modal-trap.md, delivered
      by 22-04) and the meta-tag todo (2026-08-05-add-apple-mobile-web-app-capable-...,
      delivered by 22-09 commit 04b3bc1). A later phase reading todos/pending/ will treat
      solved problems as open.
    artifacts:
      - path: ".planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md"
        issue: "Implemented by 22-08 (bottomOverlayInset offsetBelow + omission guard) but not moved"
      - path: ".planning/todos/pending/2026-08-05-setlistview-loading-state-is-an-unrecoverable-aria-modal-trap.md"
        issue: "Implemented by 22-04 (pending/missing split + useDialogDismiss) but not moved"
      - path: ".planning/todos/pending/2026-08-05-add-apple-mobile-web-app-capable-so-ios-installs-are-determi.md"
        issue: "Implemented by 22-09 commit 04b3bc1 but not moved"
    missing:
      - "Move the three delivered todos to .planning/todos/done/ (or mark resolved in place)"
deferred:
  - truth: "setChromeVisible(false) is publicly callable with no toggleCount guard, so a future consumer could hide chrome with no exit control mounted"
    addressed_in: "Phase 23"
    evidence: >-
      Phase 23 success criterion 5 (CHROME-02): "While tracking a show on the Live tab the
      bottom tabs auto-hide for immersion and return the moment the user navigates to another
      tab" — that is precisely the no-button consumer that would exercise the unguarded setter.
      Within Phase 22 there is NO reachable stranded state: ChromeToggle is the sole caller,
      it is the sole entry point into the hidden state, it is always rendered alongside the
      mechanism (ExploreView.tsx:197, first child of the fragment; the error early-return at
      line 153 deliberately renders no toggle AND no mechanism), and registerChromeToggle's
      unregister forces `visible = true` when the mount count reaches 0. Escapability holds
      today by co-location, not by construction — Phase 23 must supply the structural guard.
human_verification:
  - test: "22-HUMAN-UAT test 0 — install-mode proof (?layoutProbe=1, sab reading) before and after commit 04b3bc1"
    expected: "Standalone install confirmed (not a Safari bookmark); status bar does not overlap content"
    why_human: "Requires a real iOS home-screen install over an HTTPS tunnel; gates every later test"
  - test: "22-HUMAN-UAT test 1 — SHEET-02 with VoiceOver and an external keyboard (BLOCKING)"
    expected: "Focus returns to the trigger on close; VoiceOver never reads the exiting sheet; keyboard focus never enters the exiting subtree"
    why_human: "REQUIREMENTS.md SHEET-02 demands on-device VoiceOver + external keyboard re-verification by name. jsdom cannot stand in for an AT virtual cursor."
  - test: "22-HUMAN-UAT test 2 — the close-start background tap, on each of the four exit consumers (BLOCKING)"
    expected: "A tap on the background during the ~200ms exit window lands on the background and is never swallowed"
    why_human: "Real touch dispatch and real pointer-events enforcement; @testing-library/dom's fireEvent ignores pointer-events by design"
  - test: "22-HUMAN-UAT test 4 — NAV-06 Android install from the relocated Settings affordance (BLOCKING)"
    expected: "The Chromium install prompt appears from the Settings button and the install completes; the section and the menu row disappear in-session with no reload"
    why_human: "REQUIREMENTS.md NAV-06 is defined as 'confirmed on-device'. beforeinstallprompt cannot be produced in jsdom."
  - test: "SC1 subjective quality — sheets animate SMOOTHLY on device (all four exit consumers plus a reduced-motion pass)"
    expected: "No jank, no dimmed card through its own scrim, no double-scrim flash; reduced motion shows no movement"
    why_human: "'Smoothly' is a perceptual property; jsdom asserts prop shape only"
  - test: "Double-tap the Settings install button on Android (probe for 22-REVIEW CR-02 during test 4)"
    expected: "The install path recovers; the button does not remain enabled over a dead BeforeInstallPromptEvent"
    why_human: "promptInstall() at installStore.ts:136-143 has no try/catch and clears `deferred` only after both awaits; a rejected second prompt() leaves canInstall true forever. Only reproducible on a real Chromium install flow."
---

# Phase 22: Surface Motion & the Chrome Mechanism — Verification Report

## ⚠ Re-verification 2026-08-10 — READ THIS FIRST

**Everything below this section was written on 2026-08-06 and is now partly superseded.** It is
deliberately preserved rather than rewritten: its escapability audit, its a11y audit and its
artifact table all still hold, and its judgement calls were correct at the time. What it could not
see is that **three of its four gaps closed within days**, by two events that happened after it ran.

| Gap in the 08-06 report | State on 2026-08-10 | Closed by |
|---|---|---|
| SC2 / SHEET-02 device half unrun | ✅ **CLOSED** | Device UAT 2026-08-09 — tests 1 and 2, **12/12** across 4 prop shapes |
| SC5 / NAV-05 focus-steal defect (CR-01) | ✅ **FIXED** | Code-review fix pass, commit `80c2895` — `requestCount`/`handledCount` pair, acknowledged after the focus move |
| Three delivered todos never moved | ✅ **CLOSED** | Moved to `.planning/todos/done/` 2026-08-10, each stamped with the plan that delivered it |
| SC3 / CHROME-05 reheat contradiction | ⚖️ **RESOLVED BY AMENDMENT** | REQUIREMENTS.md CHROME-05 + ROADMAP SC3 amended 2026-08-10 to the inert-reheat property actually shipped |
| SC1 / SHEET-01 quantifier narrowed silently | ⚖️ **RESOLVED BY AMENDMENT** | REQUIREMENTS.md SHEET-01 + ROADMAP SC1 amended to "every `<Sheet>`-backed, prop-driven sheet" |

**Score moves 1/5 → 4/5.** The one criterion still short is **SC5, and only its NAV-06 half.**

### The two amendments are overrides, and should be read as such

Neither amendment was a discovery that the original requirement was wrong. Both are decisions to
make the written contract match shipped behaviour, taken under a deployment deadline. Recording the
cost honestly:

- **CHROME-05.** The reheat is real; the mitigations (pinned `fx`/`fy`, first-settle camera gate)
  make it unable to move the layout or snap the camera, both independently confirmed below. But it
  still runs simulation ticks, so the original clause's **"or degrades battery" was dropped rather
  than disproven** — that was never measured. Tracked at
  `todos/pending/2026-08-10-constellation-reheats-on-pure-box-change.md`. The fix is a deps change
  on the constellation's spacing effect, i.e. the highest-regression edit in the phase — which is
  exactly why it was not attempted on deploy day.
- **SHEET-01.** The narrowing is a locked owner decision (D-16) honestly documented in `Sheet.tsx`.
  Its real cost is that `SearchSheet` — named there as "the one-thumb in-the-dark surface used most
  at a show" — is the sheet that visibly will not animate while everything around it does. Tracked
  at `todos/pending/2026-08-10-migrate-hand-rolled-bottom-sheets-to-the-sheet-primitive.md`.

### The report's central worry is resolved

The 08-06 audit's sharpest structural finding was that the phase goal's second sentence was not yet
satisfiable — *"the overlays of Phase 23 must be built against the final sheet primitive"* — because
the primitive stayed provisional while Revert Procedure 1 (the enter-only fallback) was live.

**Device tests 1 and 2 passing retires that procedure.** Commit `53d6e59` stays, the exit animation
stays, and the primitive Phase 23 depends on is now final. Phase 23 is unblocked on its stated
precondition.

### What is genuinely still open

**NAV-06 only, and it is blocked on hardware rather than on code.** The named engineering risk — the
one-shot `beforeinstallprompt` needing a module-level hoist to reach a late-mounting Settings
section — is resolved and tested (`installStore.ts:145-150`). Unverified is what only a real
Chromium install shows: the prompt appearing, the install completing, and `appinstalled` making the
Settings section and the menu row vanish together with no reload. iOS Safari never fires the event,
so no iOS session can substitute. Deployment risk is accepted as low: the worst case is a degraded
install-discovery path on one platform, with Chrome's own overflow menu still offering the install,
and no data or schema implication.

Also unchanged and still carried: **NAV-03's mixed-build presence check remains Phase 21's recorded
gap (D-38)** — not closed here, and it must not be read as closed by this phase.

---

## Original audit — 2026-08-06

**Phase Goal:** The one shared `<Sheet>` primitive animates without losing a single accessibility guarantee, and the chrome-hide mechanism debuts on GizzVerse — proven escapable, accessible, and cheap on the surface where a stranded user costs the least — before the live-show path depends on it. The overlays of Phase 23 must be built against the *final* sheet primitive, not retrofitted onto it afterwards.

**Verified:** 2026-08-06T06:02:29Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Executive Judgement

This is high-quality work. The implementation is unusually honest: the executors wrote
tests that document what they *cannot* prove rather than passing vacuously, they refused
to mark requirements complete on code-only evidence, and the revert procedure is a real
dry-run measurement (`139 files / 1196 tests`, arithmetic closing to −18) rather than a
claim. Adversarial probing of the two claims the brief flagged as falsifiable found the
a11y contract **intact and strengthened**, and escapability **genuinely unreachable to
strand a user within this phase**.

It nevertheless does not close. Two roadmap success criteria (SC2 SHEET-02, SC5 NAV-06)
are defined *by their own text* as on-device verifications and the device script is
authored but unrun. One criterion (SC3 CHROME-05) contains a clause the shipped code
falsifies. One (SC1 SHEET-01) is met for the primitive but not for the quantifier
"every bottom sheet."

Critically for the goal's own second sentence: the sheet primitive is **not final**.
`22-HUMAN-UAT.md` Procedure 1 exists precisely so that a failure on device tests 1 or 2
reverts the exit animation to an enter-only ship. Until those tests run, Phase 23 would
be building its overlays against a primitive that may still change shape — which is the
exact failure mode this phase goal was written to prevent.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every bottom sheet animates up on open / down on close with a scrim cross-fade; reduced motion has no movement (SHEET-01) | ⚠ PARTIAL | `Sheet.tsx:343-353` slide/fade variants, scrim and card as siblings on one parallel duration; `sheet.motion.test.tsx` 12 cases incl. a source guard that Sheet.tsx hard-codes no duration. BUT 5 hand-rolled bottom sheets never animate (D-16) and 6 of 19 `<Sheet>` openings are enter-only (verified: 19 openings, 13 prop-driven, 6 hardcoded — roster in `Sheet.tsx:66-70` is exactly correct) |
| 2 | Sheet a11y unchanged by the animation; focus returns to trigger and background interactive at close-**START**; re-verified on-device with VoiceOver + external keyboard **inside this phase** (SHEET-02) | ⚠ CODE VERIFIED / DEVICE UNVERIFIED | `sheet.closeStart.test.tsx` (5 cases, real motion library, anti-vacuity assertion that the exiting subtree is still mounted before any of the 5 contract assertions run). `useFocusTrap.ts` layout-destroy + passive-destroy pair, `releasedRef` idempotence, presence-derived `closing` bundle. **Device half UNRUN** — `22-HUMAN-UAT.md` `status: pending`, tests 1 and 2 marked BLOCKING |
| 3 | One tap hides top bar + bottom tabs in GizzVerse and a same-place control restores them; exactly **one** resize callback, no simulation reheat, no battery cost, asserted by test (CHROME-01, CHROME-05) | ⚠ PARTIAL | One-resize half VERIFIED four ways (`chromeResize.test.tsx`: setProperty-name-filtered write count = 1; MutationObserver distinct-value-change count = 1; header out-of-flow + inert from frame 0 so no late second resize; `zoomToFit` not re-called). Round-trip through one node verified (`chromeToggle.test.tsx:438`). **"never reheats the simulation" FALSIFIED** — `ConstellationCanvas.tsx:249` reheats on every `size.height` change |
| 4 | Chrome-hidden is always escapable and never sticky: exit control always rendered, ≥44px, in the safe area, first in tab order; cold boot never hidden; hidden chrome removed from the a11y tree, not translated (CHROME-03, CHROME-04) | ✓ VERIFIED | See the escapability audit below. All six sub-clauses independently confirmed against source and test |
| 5 | Install instructions at the bottom of Settings, hidden once installed; menu keeps one neutral deep-linking row; installing from the relocated affordance confirmed on a real Android device (NAV-05, NAV-06) | ⚠ PARTIAL | Placement, shared `!isInstalled` gate, single neutral row, deep link (incl. the same-hash case) all VERIFIED. **Android device confirmation UNRUN** (UAT test 4, BLOCKING). Plus a shipped focus-steal defect on plain Settings visits |

**Score:** 1/5 success criteria fully verified. 3 partial, 1 code-complete/device-pending.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `setChromeVisible(false)` is public and unguarded by `toggleCount` — a future consumer could hide chrome with no exit control mounted | Phase 23 | Phase 23 SC5 (CHROME-02) is the auto-hide-while-tracking consumer with "a different trigger entirely (auto-hide while tracking, no button — D-03)" per `chromeVisibility.ts:16-17`. Not reachable in Phase 22 (see escapability audit) |

## Escapability Audit (the "proven escapable" claim, probed hard)

The brief asked whether 22-REVIEW WR-04 is a real gap in **this** phase's deliverable.
It is not. I traced every path into and out of the hidden state:

| Escape route | Mechanism | Evidence |
|---|---|---|
| Tap the same control | `ChromeToggle` is never conditionally rendered, never re-parented, never `visibility:hidden`; only the glyph and label change | `ChromeToggle.tsx:120-141`; `chromeToggle.test.tsx:367` asserts the same node survives the flip it causes, still 44px, still inset |
| Tab to it first | DOM order alone — first child of `ExploreView`'s fragment; header and tab bar are `inert` while hidden, and `inert` is inherited | `ExploreView.tsx:197`; `chromeToggle.test.tsx:460` asserts **index 0** of the non-inert focusables, not mere membership, and `tabIndex <= 0` |
| Escape key | `useDialogDismiss(!chromeVisible, showChrome)` — active only while hidden, so the LIFO stack is untouched in the normal state | `ChromeToggle.tsx:113`; `chromeToggle.test.tsx:484` |
| Leave GizzVerse | `registerChromeToggle()`'s unregister forces `visible = true` when the mount count reaches 0 | `chromeVisibility.ts:137-149`; `chromeToggle.test.tsx:290` |
| Reload / cold boot | No persistence of any kind. Grep for `localStorage`/`sessionStorage`/`indexedDB`/`Dexie`/`getMeta`/`setMeta` across `chromeVisibility.ts` and `ChromeToggle.tsx` returns **only prose in comments**, zero call sites | Independently grepped |
| Never painted over | `z.fab` (30) inline vs `z.chrome` (14); pinned by a named test | `layerOrder.test.tsx:823` |

Two edge cases I probed and found already handled:
- **ExploreView's error early-return** (`ExploreView.tsx:153`) renders no `ChromeToggle` — but it also renders no mechanism, and the unmount forces `visible = true`. The comment at lines 147-152 states this reasoning explicitly and it holds.
- **React 19 StrictMode double-invoke** — `registerChromeToggle`'s returned unregister is `released`-guarded, so the count cannot go negative; the intermediate unmount forces `visible = true` during mount, which is harmless.

**Residual weakness (not a Phase-22 failure):** escapability holds by *co-location*, not by
construction. `setChromeVisible` accepts `false` with no `toggleCount > 0` precondition, and
there is no automated guard preventing a future edit from adding persistence to
`chromeVisibility.ts`. Both become live hazards at Phase 23's no-button consumer.

## Sheet Accessibility Audit (the "without losing a single accessibility guarantee" claim)

`Sheet.tsx` was edited by four plans (22-01, 22-02, 22-04, 22-10). I checked the
pre-existing A11Y-01 contract survived rather than trusting the summaries.

| Pre-existing guarantee | Status | Evidence |
|---|---|---|
| Closed sheet renders zero DOM nodes, never throws | ✓ | `if (!open) return null` replaced by `{open && <SheetSurface/>}`; `sheet.a11y.test.tsx:87` case unchanged and still passing |
| Focus trap + Tab wrap | ✓ | `useFocusTrap.ts:119-137` unchanged in substance; `sheet.a11y.test.tsx:98` unchanged |
| Focus restore to trigger | ✓ STRENGTHENED | Now a layout-destroy *and* a passive-destroy pair, with a MEASURED justification (react-dom's `restoreSelection` re-applies its pre-commit snapshot after layout effects). `sheet.a11y.test.tsx:125` unchanged |
| Ref-counted background `inert` | ✓ STRENGTHENED | New `releasedRef` per-instance idempotence guard + a new case that closes the **bottom** sheet of an open stack (`sheet.a11y.test.tsx:252`), which the shipped stacked test could not catch |
| Escape via shared LIFO stack | ✓ | `sheet.a11y.test.tsx:112`, `:207` unchanged |
| Non-modal path: Escape + restore, no inert, no scrim | ✓ | `sheet.a11y.test.tsx:178` unchanged |
| Scrim tap closes | ✓ | Preserved, and now presence-gated so a tap during exit reaches the real background instead of re-closing (`Sheet.tsx:375`) |
| Reduced motion | ✓ | Cross-fade with no translate; both enter and exit asserted (`sheet.motion.test.tsx:151`, `:222`) |
| `initialFocusRef` | ⚠ RE-TIMED, not lost | Moved from open-START to enter-END (D-27), with a `SHEET_DURATION_MS` fallback timer so an interrupted/never-scheduled animation cannot strand a user in a sheet they cannot type into. The test was rewritten to stay **discriminating** — it asserts the target is NOT focused synchronously *and* that focus is inside the trap from frame 0, so `waitFor` alone could not pass it against the old contract |

`git log` confirms `sheet.a11y.test.tsx` was byte-unmodified through 22-01 and touched by
exactly one commit (`d976ca0`, 22-02). The diff is **additive**: no shipped assertion was
weakened or deleted. **No accessibility guarantee was lost.** The one re-timing is
deliberate, justified, and better-tested than the behaviour it replaced.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/app/src/config.ts` | motion/chrome/z/BOTTOM_OVERLAY_ORDER + copy | ✓ VERIFIED | All named constants present (`SHEET_DURATION_MS:200`, `SHEET_EASE_ENTER/EXIT`, `CHROME_DURATION_MS`, `CHROME_TOGGLE_SIZE_PX:44`/`SLOT_PX:52`, `TOAST_DURATION_MS`, 5-entry overlay order, `chromeHide`/`chromeShow`, `install.*`, `setlistLoading`/`setlistMissingHeading`) |
| `packages/app/src/components/Sheet.tsx` | portal → AnimatePresence → SheetSurface, enter+exit | ✓ VERIFIED | 421 lines. Portal outer (documented reason: `onlyElements` drops portals), `useIsPresent`-derived closing bundle, siblings-not-nested scrim, config-read timing |
| `packages/app/src/components/a11y/useFocusTrap.ts` | layout-timed teardown, idempotent release, `focusInitialTarget()` | ✓ VERIFIED | 182 lines, all three exports/behaviours present and wired |
| `packages/app/test/sheet.motion.test.tsx` | SHEET-01 prop shapes + D-25 literal guard | ✓ VERIFIED | 12 cases incl. a source guard reading `Sheet.tsx` |
| `packages/app/test/sheet.closeStart.test.tsx` | D-20 against the REAL motion library, while mounted | ✓ VERIFIED | 5 cases, anti-vacuity mount assertion precedes every contract assertion |
| `packages/app/src/layout/chromeVisibility.ts` | store, mount-counted toggle registration | ✓ VERIFIED | 158 lines, all 5 exports present, no persistence |
| `packages/app/src/layout/bottomSpace.ts` | `--gz-tab-bar-box` + `useBottomSpaceVars(chromeVisible)` | ✓ VERIFIED | Line 94 declares the non-collapsing box; line 97 collapses `--gz-chrome-reserve` to `var(--gz-safe-bottom)` |
| `packages/app/src/explore/ChromeToggle.tsx` | 44x44 always-rendered escape control | ✓ VERIFIED | 142 lines, both the class floor (`min-h-11`/`min-w-11`) and the inline 44px |
| `packages/app/src/explore/ExploreView.tsx` | `<ChromeToggle/>` as FIRST fragment child | ✓ VERIFIED | Line 197, immediately after the fragment open |
| `packages/app/test/chromeResize.test.tsx` | CHROME-05 one-resize, no zoomToFit | ⚠ VERIFIED WITH GAP | Four assertions present and passing; the "no reheat" clause is deliberately absent (see gap 1) |
| `packages/app/src/pwa/install/installStore.ts` | module-load capture + useSyncExternalStore registry | ⚠ VERIFIED WITH DEFECT | 188 lines, all 5 exports, cached snapshot, `appinstalled` listener. `promptInstall` (136-143) lacks try/catch (22-REVIEW CR-02) |
| `packages/app/src/pwa/install/useInstallState.ts` | unchanged public shape over the singleton | ✓ VERIFIED | 80 lines, `useSyncExternalStore(subscribeInstall, …)` |
| `packages/app/src/settings/InstallSection.tsx` | platform-adaptive, `!isInstalled`-gated | ✓ VERIFIED | 96 lines; `id="install"`, `tabIndex={-1}` heading, Android/iOS/unavailable branches, `promptInstall()` called with nothing awaited ahead of it |
| `packages/app/src/settings/installSectionFocus.ts` | request/subscribe counter surviving a same-hash navigate | ⚠ VERIFIED WITH DEFECT | 68 lines, all 4 exports. No acknowledgement path (gap 3) |
| `packages/app/src/settings/SettingsView.tsx` | InstallSection last, deep-link focus | ⚠ VERIFIED WITH DEFECT | Line 362 — last section, below owner identity / data-export / rotation reset, as specified. Effect at 84-94 carries the defect |
| `packages/app/src/components/AppMenu.tsx` | one neutral row, no gold button, no inline iOS steps | ✓ VERIFIED | Lines 74-83; grep confirms no `IosInstallInstructions` import and no accent CTA remain in the menu |
| `packages/app/src/pwa/bottomOverlayInset.ts` | `offsetBelow` + `useBottomOverlayOffset` | ✓ VERIFIED | 229 lines, both exported and consumed |
| `packages/app/src/show/TrailNodeSheet.tsx` | prop-driven with last-non-null ref | ✓ VERIFIED | `open={entry != null}` at 129; `lastEntryRef` at 61-63; T-22-36 note confirms the write-safety guard reads the `entry` **prop**, not the frozen ref |
| `packages/app/src/show/WhyDetail.tsx` | prop-driven with last-non-null ref | ✓ VERIFIED | `open={candidate != null}` at 64; `lastCandidateRef` at 50-52 |
| `packages/app/src/dex/SetlistView.tsx` | pending-vs-missing split, escapable | ✓ VERIFIED | `useDialogDismiss(missing, onClose)` at 184; `setlistLoading` at 201; `setlistMissingHeading` at 218/241 |
| `packages/app/src/dex/DexView.tsx` | `key={openShow.showId}` + prop-driven fullscreen sheet | ✓ VERIFIED | Lines 194 and 238 |
| `packages/app/index.html` | both capability meta tags, own commit | ✓ VERIFIED | Lines 33-34; commit `04b3bc1` touches exactly one file |
| `.planning/.../22-HUMAN-UAT.md` | numbered device script | ✓ AUTHORED, ✗ UNRUN | 7 tests, `status: pending`, `passed:` and `failed:` both empty, `pending: 7` |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `Sheet.tsx` | `config.ui.motion` | duration/ease read from config, no literal | ✓ WIRED (+ source guard test) |
| `WaveToast.tsx` | `config.ui.motion.TOAST_DURATION_MS` | relocated 0.2 literal (D-25) | ✓ WIRED (line 184) |
| `Sheet.tsx` | `motion/react useIsPresent` | aria-hidden/pointer-events/scrim onClick all presence-derived | ✓ WIRED (line 239, consumed at 310-313, 375) |
| `Sheet.tsx` | `useFocusTrap` | `focusInitialTarget()` from `onAnimationComplete` + fallback timer | ✓ WIRED (269-284) |
| `useInstallState.ts` | `installStore.ts` | `useSyncExternalStore(subscribeInstall, …)` | ✓ WIRED |
| `installStore.ts` | `window beforeinstallprompt` | one module-load listener that preventDefaults | ✓ WIRED (145-150) |
| `AppShell.tsx` | `chromeVisibility.ts` | `useChromeVisible()` drives reserve + inert + top reserve + transform | ✓ WIRED (69, 135-158, 252-254) |
| `AppShell.tsx` | `bottomSpace.ts` | `useBottomSpaceVars(chromeVisible)` — the D-16 seam, flipped | ✓ WIRED (71) |
| `BottomTabBar.tsx` | `--gz-tab-bar-box` | height, so the bar does not squash | ✓ WIRED (73) |
| `ChromeToggle.tsx` | `chromeVisibility.ts` | `setChromeVisible` + `registerChromeToggle` on mount | ✓ WIRED (106, 112, 128) |
| `ChromeToggle.tsx` | `useDialogDismiss.ts` | `useDialogDismiss(!chromeVisible, showChrome)` | ✓ WIRED (113) |
| `AppMenu.tsx` | `installSectionFocus.ts` | `requestInstallSectionFocus()` before `navigate('settings')` | ✓ WIRED (43-44) |
| `InstallSection.tsx` | `useInstallState.ts` | shared `!isInstalled` gate + canInstall/isIos branch | ✓ WIRED (42, 46) |
| `SetlistView.tsx` | `useDialogDismiss.ts` | Escape dismisses the missing state | ✓ WIRED (184) |
| `DexView.tsx` | `Sheet.tsx` | `open={selfCaseOpen && rarity != null}` instead of parent-conditional mount | ✓ WIRED (238) |
| `TrailNodeSheet.tsx` / `WhyDetail.tsx` | `Sheet.tsx` | `open` prop so AnimatePresence can exit-animate | ✓ WIRED |
| `WaveToast.tsx` | `bottomOverlayInset.ts` | `useBottomOverlayOffset("waveToast")` | ✓ WIRED (117) |
| `bottomOverlayInset.test.tsx` | `config.ui.BOTTOM_OVERLAY_ORDER` | omission guard greps registration ids out of `src/` | ✓ WIRED (3 guard cases incl. an anti-vacuity check that the extraction found anything) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `AppShell` header / `BottomTabBar` | `chromeVisible` | `useSyncExternalStore` over `chromeVisibility` module state, flipped by `ChromeToggle.onClick` | Yes — round-trip asserted across two clicks of one node | ✓ FLOWING |
| `SheetSurface` closing bundle | `isPresent` | `useIsPresent()` context from `PresenceChild` | Yes — `sheet.closeStart.test.tsx` proves the attribute actually appears on exit (the `open`-derived version would leave it `null`) | ✓ FLOWING |
| `InstallSection` CTA | `canInstall` | `installStore` `deferred != null`, set by the module-load `beforeinstallprompt` listener | Yes in browser; unobservable in jsdom (test pins via `__resetInstallStoreForTests`) | ✓ FLOWING (device-pending) |
| `SettingsView` install focus | `installFocusRequest` | monotonic module counter | Yes, but **over-fires** — flows on remount as well as on request | ⚠ HOLLOW (gap 3) |
| `WaveToast` / toasts | `bottomOffset` | `offsetBelow(id)` over the measured height registry | Yes — `bottomOverlayInset.test.tsx:320` renders a real overlay and asserts the composed `calc(var(--gz-chrome-reserve) + Npx)` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Whole suite green | `npx vitest run` | 140 files / 1214 tests passed, 11.95s | ✓ PASS |
| Scoped typecheck | `npx tsc -b packages/core packages/app` | exit 0, no output | ✓ PASS |
| Bare typecheck (the claim six summaries make) | `npx tsc -b` | `error TS5083: Cannot read file '.../tsconfig.json'` | ✗ FAIL — the summaries' "tsc -b exits 0" phrasing is wrong; only the scoped form works |
| Lint gate | `ls eslint.config.*`, `grep '"lint"' package.json packages/*/package.json`, `ls node_modules/.bin \| grep eslint` | No config, no script, no binary | ? SKIP — **no runnable lint gate exists** despite CLAUDE.md documenting ESLint 10 + typescript-eslint 8.63. Plan 22-09 recorded this rather than claiming a vacuous pass; confirmed |
| Phase-22 targeted files | `npx vitest run chromeToggle chromeResize installSection installStore sheet.closeStart` | 5 files / 39 tests passed | ✓ PASS |
| `<Sheet>` seam roster accuracy | grep all `<Sheet` JSX openings, classify `open` prop | 19 openings, 13 prop-driven, 6 hardcoded (CompareView x2, FriendDetail x2, PinSheet x2) — exactly the roster in `Sheet.tsx:66-70` | ✓ PASS |
| Chrome mechanism has no persistence | grep `localStorage\|sessionStorage\|indexedDB\|dexie\|getMeta\|setMeta` in `chromeVisibility.ts` + `ChromeToggle.tsx` | Comment prose only, zero call sites | ✓ PASS |
| Revert Procedure 1 artifacts resolve | `git show --stat 53d6e59`, `04b3bc1`, `git cat-file -t d976ca0` | All three resolve; `53d6e59` touches exactly the 3 named files; `04b3bc1` touches exactly `index.html` | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no PLAN or SUMMARY declares a
probe path. Step 7c: **SKIPPED (no probe harness in this project)**. The probes referenced
throughout the phase documents (P1, P6, P8) are RESEARCH-phase empirical measurements
recorded in `22-RESEARCH.md`, not runnable scripts.

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| **SHEET-01** | 22-01, 22-02, 22-04, 22-10 | ⚠ PARTIAL | Primitive complete and tested both directions. "Every bottom sheet" not met — 5 hand-rolled static (D-16 locked), PinSheet x2 enter-only. **Abstention was correct**, and remains correct: this needs an override or an SC amendment, not a checkbox |
| **SHEET-02** | 22-02, 22-09, 22-10 | ⚠ NEEDS DEVICE UAT | Code half is the strongest work in the phase. Requirement text names on-device VoiceOver + external keyboard explicitly. UAT tests 1 and 2 unrun. **Abstention was correct** |
| **CHROME-01** | 22-05, 22-07 | ✓ SATISFIED BY CODE | One tap hides both bars; the same node in the same place restores them; round-trip asserted (`chromeToggle.test.tsx:438`). 22-07's summary marks this — justified |
| **CHROME-03** | 22-07 | ✓ SATISFIED BY CODE | All six clauses verified independently (see escapability audit). 22-07's summary marks this — justified. Optional device confirmation is UAT test 5 |
| **CHROME-04** | 22-05, 22-07 | ✓ SATISFIED BY CODE | `inert` + `aria-hidden` + `position:absolute` out of flow + `pointer-events:none`, all in one commit; asserted at `chromeToggle.test.tsx:201` and `:224`. 22-07's summary marks this — justified |
| **CHROME-05** | 22-07 | ⚠ PARTIAL | One-resize half verified four ways. "Never reheats the simulation" clause falsified by `ConstellationCanvas.tsx:249`. **22-07's summary marks this complete — that is an overclaim.** It is the one place in the phase where a summary is ahead of the code |
| **NAV-05** | 22-06 | ⚠ SATISFIED WITH DEFECT | Every clause NAV-05 names is present and tested. The deep-link signal ships a focus-steal regression on plain Settings visits (gap 3). **Abstention was correct** |
| **NAV-06** | 22-03, 22-09 | ⚠ NEEDS DEVICE UAT | Singleton hoist done and tested — this was the named risk ("the relocated affordance is dead on Android unless that capture is hoisted") and it is resolved in code. Requirement text is "confirmed on-device". UAT test 4 unrun. **Abstention was correct** |

**Orphaned requirements:** none. All 8 IDs mapped to Phase 22 in REQUIREMENTS.md appear in
at least one PLAN's `requirements` field. Two carried-over defects (CR-01, CR-02) are
correctly flagged in-plan as non-roadmap IDs sourced from `.planning/todos/pending/`.

**A correction to the briefing:** the claim that *every* plan left `requirements-completed: []`
is not accurate. `22-07-SUMMARY.md` records `[CHROME-01, CHROME-03, CHROME-04, CHROME-05]`
and `22-08-SUMMARY.md` records `[CR-01]`; 22-03 and 22-06 carry no such field at all. Three
of 22-07's four marks are justified; CHROME-05 is not. **`REQUIREMENTS.md` itself still shows
all 8 IDs unchecked**, so no false green reached the traceability matrix.

### Anti-Patterns Found

Scanned all 41 files changed between `ab1e655` (phase plan set) and `HEAD`.

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `packages/app/src/components/AppShell.tsx` | 247 | `FOLLOW-ON TODO` with no issue/PR reference | ℹ️ Info | Descriptive prose recording a deliberate non-goal (hoist `env(safe-area-inset-top)` into `--gz-safe-top`), with its cost stated. Not a debt marker for unfinished phase work |
| — | — | `TBD` / `FIXME` / `XXX` / `HACK` | — | **Zero across all 41 files.** The debt-marker gate passes cleanly |
| `packages/app/src/pwa/install/installStore.ts` | 136-143 | `await` without try/catch on a rejectable API | ⚠️ Warning | 22-REVIEW CR-02, independently confirmed. Not re-reported as new |
| `packages/app/src/settings/installSectionFocus.ts` + `SettingsView.tsx` | 84-94 | Unacknowledged monotonic signal + conditional mount | ⚠️ Warning | 22-REVIEW CR-01, independently confirmed. Not re-reported as new; assessed against NAV-05 above |
| `.planning/todos/pending/` | — | Three delivered todos never moved; no `done/` directory | ⚠️ Warning | Gap 4 — completion is not auditable from the todo tracker |

I found **no** stubs, no placeholder returns, no hardcoded-empty props, and no
console.log-only implementations. Every `return null` I checked is a deliberate,
documented gate (e.g. `InstallSection.tsx:46`, "Returning `null` here is a GATE, not an
empty state"). The test suite contains no vacuous assertions that I could find — several
files carry explicit anti-vacuity guards, and `chromeResize.test.tsx` states its own
epistemic limits before its assertions rather than after.

### Human Verification Required

**All four BLOCKING device tests in `22-HUMAN-UAT.md` are unrun.** The script itself is
well-built: test 0 is an install-mode proof that gates every later reading (learned from
the Phase-21 session that cost a full day to a Safari-bookmark false positive), and the
harness section names the cloudflared `--http-host-header localhost` requirement.

1. **Test 0 — install-mode proof.** Prove `sab:0` standalone before grading anything. Every
   tester must delete the existing home-screen icon and reinstall from a build containing
   `04b3bc1`, or test 0's "after" reading is a lie.
2. **Test 1 — SHEET-02 with VoiceOver + external keyboard (BLOCKING).** Focus returns to
   the trigger; the exiting sheet is never read; keyboard focus never enters it.
3. **Test 2 — the close-start tap on all four exit consumers (BLOCKING).** A background tap
   during the ~200ms window must land.
4. **Test 4 — NAV-06 Android install from the relocated Settings affordance (BLOCKING).**
   Prompt appears, install completes, section and menu row vanish in-session with no reload.
   **While there:** double-tap the install button to probe CR-02.
5. **SC1 subjective quality.** "Smoothly" is perceptual; jsdom asserts prop shape only.

If test 1 or test 2 fails, Procedure 1 is a three-step mechanical revert to a sanctioned
enter-only ship — dry-run verified on a scratch branch at `e2911a2` with closing arithmetic
(`140/1214 → 139/1196`, −18 = 5+5+2+3+3). I confirmed all three referenced commit SHAs
resolve and touch exactly the files claimed. This is the best-prepared fallback I have seen
in this project's plans.

### Gaps Summary

The phase's *engineering* is close to complete; its *evidence* is not, and one requirement
clause is contradicted by the code.

**The sharpest finding** is CHROME-05. `chromeResize.test.tsx` contains a block comment
instructing future readers not to assert the requirement's own wording, because doing so
fails: `ConstellationCanvas` reheats the d3 simulation on every chrome toggle. The
mitigation is real (pinned `fx`/`fy` make the reheat unable to move the layout; the camera
gate makes it unable to snap) and the phase's own framing — one resize, no camera loss —
is fully achieved. But the shipped behaviour and the written requirement disagree, no
override reconciles them, and 22-07's summary marks CHROME-05 complete anyway. Either the
requirement text or the summary needs to change; right now the codebase quietly disagrees
with the roadmap.

**The second finding** is that SC1's quantifier was silently narrowed. "Every bottom sheet"
became "every prop-driven `<Sheet>`-backed sheet." The narrowing is a *locked owner
decision* (D-16 in `22-CONTEXT.md`) and it is honestly documented at the top of `Sheet.tsx`,
including the admission that `SearchSheet` — the surface most used at a show — will visibly
not animate while everything else does. This deserves an explicit override rather than
being left as a discrepancy a future reader has to reconstruct.

**The third finding** is that the phase goal's own second sentence is not yet satisfiable.
"The overlays of Phase 23 must be built against the *final* sheet primitive" — but the
primitive is explicitly provisional until device tests 1 and 2 run, with a documented
revert path that would remove the exit animation entirely. Starting Phase 23 before that
session is exactly the retrofit the goal forbids.

**The fourth** is the NAV-05 focus-steal regression, which lands on the one phase whose goal
is framed around not losing accessibility guarantees. It does not touch the sheet primitive
— that contract I verified intact and strengthened — but it is a focus-management defect
shipped in this phase, on a surface this phase moved.

Everything else holds up. The escapability claim survived hard probing: I could not
construct a reachable state in Phase 22 where a user is stranded with chrome hidden. The
a11y-guarantee claim survived too: the `sheet.a11y.test.tsx` diff is purely additive, and
the one re-timing (`initialFocusRef`) is better-tested after the change than before.

**Recommended next step:** run the device session. It closes SC2 and SC5's blocking halves
in one sitting, and it is the gate on whether the sheet primitive Phase 23 depends on is
final. Resolve the CHROME-05 wording discrepancy in the same pass — it is a one-line
decision, not an investigation.

---

_Verified: 2026-08-06T06:02:29Z_
_Verifier: Claude (gsd-verifier), goal-backward, FORCE stance_
