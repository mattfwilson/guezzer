---
phase: 22
slug: surface-motion-the-chrome-mechanism
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `22-RESEARCH.md` § Validation Architecture. Read that section before
> writing any test in this phase — it names the two hardest assertion techniques
> (CHROME-05 one-resize, SHEET-02 close-start) and their honest jsdom limits.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + `@testing-library/react` 16.3.2, jsdom 29.1.1 |
| **Config file** | `vitest.config.ts` (root) — `test.projects`; app project rooted at `packages/app`, `setupFiles: ["./test/setup.ts"]` |
| **Quick run command** | `npx vitest run --project @guezzer/app packages/app/test/<file>.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5s single file · app project (134 files) ~60s · full suite ~90s |

---

## Sampling Rate

- **After every task commit:** Run the single test file that task touches — `npx vitest run --project @guezzer/app packages/app/test/<file>.test.tsx`
- **After every plan wave:** Run `npx vitest run --project @guezzer/app`
- **Before `/gsd-verify-work`:** `npx vitest run` (core + app) green, plus `npx tsc -b` and lint
- **Max feedback latency:** 5 seconds per task; 60 seconds per wave

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SHEET-01 | Enter/exit props carry translate under motion, opacity-only under reduced motion; `variant="fullscreen"` never translates (D-26) | unit (jsdom, mocked `motion`) | `npx vitest run --project @guezzer/app packages/app/test/sheet.motion.test.tsx` | ❌ W0 | ⬜ pending |
| SHEET-01 | Motion constants come from `config.ui.motion`, not literals (D-25) | source guard | same file — grep `Sheet.tsx` for `duration: 0.` | ❌ W0 | ⬜ pending |
| SHEET-01 | Primitive still portals to `document.body` and renders nothing when closed (Phase-21 D-24 + V7) | unit | `npx vitest run --project @guezzer/app packages/app/test/sheet.a11y.test.tsx` | ✅ amend | ⬜ pending |
| **SHEET-02** | **Close-start contract (D-20):** after `open→false` with subtree still in DOM — background not `inert`, `document.activeElement === trigger`, card+scrim carry `pointer-events: none`, click on exiting scrim does **not** call `onClose` | unit (**real `AnimatePresence`** — see Correction below) | `npx vitest run --project @guezzer/app packages/app/test/sheet.closeStart.test.tsx` | ❌ W0 | ⬜ pending |
| SHEET-02 | `aria-hidden="true"` on the exiting card, and `document.activeElement` is **outside** it at that moment (Pitfall 4a) | unit | same file | ❌ W0 | ⬜ pending |
| SHEET-02 | Stacked release does not underflow: closing the **bottom** sheet while the top stays open leaves `#app-content` inert (Pitfall 5) | unit | extend `sheet.a11y.test.tsx` stacked-modals case | ✅ extend | ⬜ pending |
| SHEET-02 | `initialFocusRef` focused only after `onAnimationComplete`, and not at all on exit (D-27, Pitfall 12) | unit | `sheet.closeStart.test.tsx` | ❌ W0 | ⬜ pending |
| CHROME-01 | `--gz-chrome-reserve` collapses to `var(--gz-safe-bottom)` when `chromeVisible === false`; `--gz-tab-bar-box` does **not** collapse; `<nav>` reads `--gz-tab-bar-box` (Pitfall 6) | unit (pure fn + render) | `npx vitest run --project @guezzer/app packages/app/test/bottomSpace.test.ts` | ✅ amend | ⬜ pending |
| CHROME-01 | Toggling the store flips `AppShell`'s reserve and re-renders header out of flow; toggle label swaps between the two `config.copy` strings (D-05) | unit | `npx vitest run --project @guezzer/app packages/app/test/chromeToggle.test.tsx` | ❌ W0 | ⬜ pending |
| CHROME-03 | Exit control rendered in **both** states, `min-h-11 min-w-11` (≥44px), composes from the safe area | unit (positive assertion, not source guard) | `chromeToggle.test.tsx` | ❌ W0 | ⬜ pending |
| CHROME-03 | Exit control is **first** in the non-inert tab order while hidden | unit | `chromeToggle.test.tsx` | ❌ W0 | ⬜ pending |
| CHROME-04 | `<header>` and `<nav>` carry `inert` (React JSX prop — Pitfall 7) and `aria-hidden` while hidden, neither while visible | unit | `chromeToggle.test.tsx` | ❌ W0 | ⬜ pending |
| CHROME-04 | Hidden chrome is **not** merely translated: header carries `position: absolute` (out of flow) for the whole exit | unit | `chromeToggle.test.tsx` | ❌ W0 | ⬜ pending |
| **CHROME-05** | **Exactly one `--gz-chrome-reserve` write per toggle, `zoomToFit` not re-called** (D-09) — see RESEARCH § Code Examples harness and its stated jsdom limits | unit (stubbed `ResizeObserver` + mocked `ForceGraph2D`) | `npx vitest run --project @guezzer/app packages/app/test/chromeResize.test.tsx` | ❌ W0 | ⬜ pending |
| NAV-05 | Install section renders below the three existing Settings sections; renders nothing when `isInstalled` | unit | `npx vitest run --project @guezzer/app packages/app/test/installSection.test.tsx` | ❌ W0 | ⬜ pending |
| NAV-05 | Menu row is neutral (no `bg-accent`), navigates to `#/settings`, hides when installed — sharing one gate with the section (D-34) | unit | `installSection.test.tsx` | ❌ W0 | ⬜ pending |
| NAV-05 | Deep-link moves focus to the section heading (`tabIndex=-1`) after mount, and survives being already on `#/settings` (Pitfall 10) | unit | `installSection.test.tsx` | ❌ W0 | ⬜ pending |
| NAV-06 | Store is a **singleton**: one captured `beforeinstallprompt` makes `canInstall` true for two independently-mounted consumers; `promptInstall()` clears it for both (D-33) | unit | `npx vitest run --project @guezzer/app packages/app/test/installStore.test.tsx` | ❌ W0 | ⬜ pending |
| NAV-06 | `isStandalone()` evaluated once and read from the shared store, so two consumers cannot disagree (D-36) | unit | `installStore.test.tsx` | ❌ W0 | ⬜ pending |
| CR-01 | Two simultaneously-visible overlays get distinct offsets in declared order; `<main>`'s sum equals real occupied height | unit | `npx vitest run --project @guezzer/app packages/app/test/bottomOverlayInset.test.tsx` | ✅ extend | ⬜ pending |
| CR-01 | **Omission guard:** every `useBottomOverlayHeightRegistration` id in `src/` appears in `config.ui.BOTTOM_OVERLAY_ORDER` | source guard (omission-detecting) | `bottomOverlayInset.test.tsx` | ❌ W0 | ⬜ pending |
| CR-02 | `SetlistView` holds the frame while pending and renders a **labelled, escapable** error state when the row is genuinely absent; `aria-label` is not `copy.albumBack`; Back calls `onClose`; Escape dismisses | unit (fake-indexeddb) | `npx vitest run --project @guezzer/app packages/app/test/setlistView.test.tsx` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files:

- [ ] `packages/app/test/sheet.motion.test.tsx` — SHEET-01 prop shape + reduced motion + fullscreen
- [ ] `packages/app/test/sheet.closeStart.test.tsx` — SHEET-02 (D-20); **use the real `AnimatePresence`, no hand-rolled double** — see § Correction below. The shipped pass-through mock at `WaveToast.test.tsx:18` makes this assertion vacuous — do not copy it.
- [ ] `packages/app/test/chromeToggle.test.tsx` — CHROME-01 / 03 / 04
- [ ] `packages/app/test/chromeResize.test.tsx` — CHROME-05 (D-09); requires stubbed `ResizeObserver` + mocked `ForceGraph2D`
- [ ] `packages/app/test/installSection.test.tsx` — NAV-05
- [ ] `packages/app/test/installStore.test.tsx` — NAV-06; needs `vi.resetModules()` discipline and a `__resetInstallStoreForTests()` escape hatch mirroring `__resetBottomOverlayInsetForTests`

Amendments to shipped tests (deliberate, not incidental):

- [ ] `packages/app/test/bottomSpace.test.ts` — three shipped exact-string assertions change under `--gz-tab-bar-box` (Pitfall 6)
- [ ] `packages/app/test/sheet.a11y.test.tsx` — portal-parity `parentElement` assertion under the new structure (Pitfall 2), stacked-release case (Pitfall 5), `inert`-expando limits note (Pitfall 7)
- [ ] `packages/app/test/bottomOverlayInset.test.tsx` — extend (CR-01)
- [ ] `packages/app/test/setlistView.test.tsx` — extend (CR-02)

No framework install needed — existing Vitest/jsdom infrastructure covers this phase.

---

## Manual-Only Verifications

Belongs in `22-HUMAN-UAT.md`, following the `.planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md` format (device model, OS version, numbered pass/fail).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VoiceOver + external-keyboard session across four sheet prop shapes, plus a close-start tap test on each | SHEET-02 (D-21) | Screen-reader focus order and real touch timing during a 200ms exit window are not observable in jsdom | Sample re-picked per Pitfall 1: (a) a `fullscreen` variant, (b) a bottom sheet with backdrop, (c) the `initialFocusRef` case — **`SettingsView`'s name prompt, NOT `PinSheet`** (PinSheet is unmount-driven and cannot exit-animate), (d) one opened from a Phase-21-portaled stacking context (`SwapSheet` / `ShareCardSheet`). On each: tap a background control during the exit and confirm it fires. |
| Android install from the relocated Settings affordance | NAV-06 | `beforeinstallprompt` + real install flow has no jsdom equivalent | **Gated on install-mode proof.** Record `standalone: mq=…` and confirm the install produced a genuine standalone launch before grading. On iOS, record `sab` / `nav` / `mq` / `innerH` from `?layoutProbe=1`, added as a *second* home-screen icon from the probe URL. A bookmark launch is visually identical and reports `sab: 0` — this cost a full Phase-21 session. |
| Perf observation: does `ShareCardSheet` (pre-builds a PNG `File` on open) or `CompareView` (re-runs `deriveDex`) visibly stutter now that animation makes an existing hitch legible? | D-30 | Subjective frame-timing judgment | Numbered, **non-blocking** note only. Does not gate the phase. |
| Chrome-hide on a real installed instance — toggle stays inside the safe area with notch/home-indicator present; constellation genuinely gains the freed height | CHROME-03 | Safe-area geometry only exists on device | **Optional, not required.** D-09 is explicit that CHROME-05 gets no device item. Cheap to do while the device is in hand. |

---

## Structural / By Construction — do NOT write a test

Listed so the planner does not over-test and the checker does not flag these as gaps.

- **CHROME-03 "a cold boot never starts hidden."** True by construction under D-11: plain component/module state, no `sessionStorage`, no `db.meta` row, no storage key. A fresh module evaluation *is* the visible state. A test would assert `useState(true)` initialises to `true`. At most, a one-line source guard that no storage API name appears in `chromeVisibility.ts` — and even that is arguably ceremony.
- **CHROME-01 "the control stays visible in the same place."** True by construction under D-01/D-02: one control, one fixed position, whose only per-state change is label and icon. Assert the label swap (that is real); do not attempt to assert screen position in a layout-free jsdom.
- **D-14 "an open `NodeSheet` settles into the freed space."** `NodeSheet` is `fixed bottom-0` composing from `--gz-chrome-reserve`, which the toggle collapses. No new code, no new test. (One cheap positive assertion that `NodeSheet` reads the variable and not a literal is already CR-01/FOUND-02 territory.)
- **D-15 "a toast fires at the collapsed position."** Same reasoning — toasts compose from `--gz-chrome-reserve`. No special case, no test.
- **D-18 "no kill-switch."** The absence of a flag is the deliverable.

---

## Correction — D-20 close-start test uses the REAL library (supersedes the earlier draft)

The first research pass assumed jsdom could not run exit animations and specified a hand-rolled
"retaining `AnimatePresence` double". **That assumption was wrong and is now retracted**, verified
by live probe against the repo's actual `motion@12.42.2` + `jsdom@29.1.1`:

- `Element.prototype.animate` is undefined in jsdom, so motion falls back to rAF.
- The exit **completes**: the node is retained synchronously and removed after the duration.
- Therefore the real `AnimatePresence` is sufficient — and required.

**Why the double is not merely unnecessary but actively harmful:** a double that re-renders
`children` fresh would make the D-20 test **pass against the Pitfall 14 defect** below. It would
be a green test proving nothing.

### Pitfall 14 — frozen React element on exit (highest-risk finding in this phase)

An exiting `AnimatePresence` child renders from a **frozen React element**. Any value derived from
the `open` prop — `aria-hidden`, `pointer-events`, scrim `onClick`, `onAnimationComplete` guards —
keeps its open-state value for the entire exit window. D-19 items 3 and 4 silently never happen,
**and every test written against the open state still passes.**

Derive all of these from `useIsPresent()`, not from `open`. Every close-start assertion in this
phase must include an anti-vacuity check (see RESEARCH § Code Examples) that would fail if the
component were reading `open`.

If an imperative teardown is used instead of `useIsPresent()`, it MUST explicitly undo the
imperative `aria-hidden` / `pointer-events` on re-activate — D-22 requires interrupt-and-reverse
and the DOM node is reused on re-open. `useIsPresent()` self-corrects; imperative mutation does not.

### Two further verified items affecting device UAT

- **`apple-mobile-web-app-capable` is not a cosmetic no-op.** Apple's reference states verbatim that
  `apple-mobile-web-app-status-bar-style` — already shipped as `black-translucent` at
  `index.html:9` — has no effect unless full-screen mode is first specified via
  `apple-mobile-web-app-capable`. Adding the tag can push content under the status bar, in the very
  phase whose exit control must be *provably* inside the safe area. If the tag is added, a
  before/after `?layoutProbe=1` capture on a **reinstalled** instance is mandatory.
- **Safe-area top reserve trap.** `env(safe-area-inset-top)` is reserved only by the header's own
  `paddingTop`. The instant the header goes `position: absolute`, nothing reserves it and the
  constellation runs under the notch — **invisible on desktop**, where the inset is `0`.

---

## Carried Limitation from Phase 21 — read before writing any guard

`bottomSpace.test.ts` is **pattern-matching over source text**. It catches a surface that writes the *wrong* inset; it **cannot** catch a surface that omits the inset entirely — that gap shipped a real bug in `ArchiveBrowser`, fixed in `61e0b90`.

This phase adds three new surfaces inside that blast radius:

1. the **chrome toggle** (bottom-adjacent within the constellation stage),
2. the **Settings install section** (bottom of a scrolling `<main>`),
3. `SetlistView`'s **new error state**.

Each needs a **positive assertion that the thing is present and correct** — a rendered-DOM check of the actual style/attribute — not merely silence from the pattern guard. The CR-01 omission-detecting guard is the model: it *fails when something new is added and not registered*, which is the only guard shape that catches an omission.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
