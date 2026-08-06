---
status: pending
phase: 22-surface-motion-the-chrome-mechanism
source: [22-UI-SPEC.md §Device Verification, 22-RESEARCH.md §Validation Architecture]
requirements: [SHEET-02, NAV-06]
started:
updated:
---

## Current Test

None yet — this script is authored and unrun. Execute tests 0–6 in order at the
end-of-phase verification gate (`workflow.human_verify_mode: end-of-phase`) and write the
outcomes into the **Result** lines below. Do not open a new document for the results.

## Devices and build

Fill this in before grading anything. Every result line below is meaningless without it.

| Field | Value |
|---|---|
| iOS device model | |
| iOS version | |
| External keyboard (make/connection) | |
| Android device model | |
| Android OS + Chrome version | |
| Build SHA under test | |
| Tunnel URL | |
| Session date | |

**The build SHA must include `04b3bc1`** (`feat(22-09): add apple/mobile-web-app-capable meta
tags`). That commit changes the built HTML shell, so **every device tester must delete the
existing home-screen icon and reinstall from a fresh build before grading anything** — otherwise
they are testing the old shell and test 0's "after" reading is a lie.

## Harness

Serve the **production build** over an HTTPS cloudflared tunnel. Plain LAN HTTP will not register
a service worker, and the vite dev server does not exercise the precache path. From Git Bash:

1. Build:
   ```
   npm run build -w @guezzer/app
   ```
2. Serve the built `dist/` on a fixed port (background):
   ```
   npm run preview -w @guezzer/app -- --port 4173 --strictPort
   ```
3. Open the tunnel (background). `cloudflared` is installed but **not on PATH**, and
   `--http-host-header localhost` is **mandatory** — without it vite preview validates the `Host`
   header and returns **403**:
   ```
   "/c/Program Files (x86)/cloudflared/cloudflared.exe" tunnel --url http://localhost:4173 --http-host-header localhost
   ```
4. Take the `https://<random>.trycloudflare.com` URL and smoke-test that `/`, `/sw.js` and
   `/manifest.webmanifest` all return **200** before touching a phone.
5. Install to the home screen and run every graded test from the **installed** app.

The URL is ephemeral — it dies when the preview/tunnel processes stop. Tear both down at the end.

## Tests

### Test 0 — Install-mode proof. GATES EVERY LATER TEST.

**This is a precondition, not a formality. No SHEET-02 (tests 1, 2) or NAV-06 (test 4) evidence
counts for anything until this test reads clean.**

**The trap, stated plainly:** on iOS, "Add to Home Screen" can silently produce a Safari
**bookmark** instead of a standalone web app. The two are **visually identical** — same icon, same
title, same name — and the only reliable tell is that a bookmark launch reports **`sab: 0`** and
`standalone: nav=false mq=false`. This exact confusion invalidated four tests and **cost a full
Phase-21 device session** (2026-08-04/05). Read the probe before you grade anything.

**Android is graded differently.** `sab` is the **iOS** tell, **not** the Android one — do not
grade Android install-mode on `sab`. On Chromium the decisive tells are
`matchMedia("(display-mode: standalone)").matches === true` **plus the fact that
`beforeinstallprompt` fired at all** (Chromium does not fire it when the app is already installed).

Steps:

1. **BEFORE reinstalling**, launch the currently-installed home-screen icon — this is the
   pre-meta-tag shell, since `index.html` was untouched in Phase 21 and everywhere else in Phase
   22, which makes the comparison clean. Navigate so `?layoutProbe=1` is in the URL and record
   `sab`, `sat` (top inset), `standalone: nav=… mq=…` and `innerH`.
2. Rebuild and redeploy the tunnel from a build containing `04b3bc1`.
3. Add a **second** home-screen icon **from the `?layoutProbe=1` URL** — an installed icon always
   relaunches at the URL it was added from, and hash routing preserves the query as the user
   navigates, so this is the only way to see the probe in standalone.
4. Launch that second icon and record the same four values.
5. On Android, install and record `standalone: mq=…`, plus whether `beforeinstallprompt` fired.

Expected:

- `standalone` reads `nav=true mq=true` on iOS; `sab` is **non-zero** on a notched iPhone
  (Phase 21 measured `sab: 34` on iPhone 16 Pro).
- Between the before and after readings, **the status bar does not begin overlapping app
  content**. `apple-mobile-web-app-capable` activates the already-shipped
  `black-translucent` status-bar style, which Apple documents as displaying web content on the
  entire screen partially obscured by the status bar — so `sat` and `innerH` are the numbers that
  matter here, and a change that pushes content under the status bar is a **FAIL** with a named
  one-commit revert (see Revert procedure 2).
- The GizzVerse chrome toggle remains fully inside the safe area in **both** orientations, in both
  readings.

Record both readings:

| Reading | sab | sat | standalone (nav / mq) | innerH |
|---|---|---|---|---|
| BEFORE (pre-meta-tag shell) | | | | |
| AFTER (reinstalled, incl. `04b3bc1`) | | | | |
| Android (mq only) | — | — | | |

**Result: PASS / FAIL**

### Test 1 — SHEET-02: VoiceOver + external keyboard (BLOCKING)

The sample is chosen by **PROP SHAPE, not surface count** (D-21). The `<Sheet>` primitive is
shared, so a primitive defect appears in all 15 surfaces at once — what actually varies between
surfaces is the **prop combination**. Four surfaces, one sub-result each.

**Only prop-driven sheets can exit-animate at all.** A sheet whose parent unmounts it outright
never runs an `AnimatePresence` exit. Six openings across three files remain unmount-driven by
design (`CompareView` ×2, `FriendDetail` ×2, `PinSheet` ×2) — they will **not** exit-animate, and
that is a documented seam, not a defect. Do not substitute one of them into this sample.

Steps — on **each** of the four surfaces below, with **VoiceOver** on:

- Open the sheet, then close it.
- Confirm focus returns to the **trigger** that opened it.
- Confirm the sheet is **not read by VoiceOver while it is leaving**.
- Confirm the background is reachable again **immediately** (not after the animation ends).

Then repeat with an **external keyboard** attached:

- Tab-cycle inside the sheet and confirm focus stays trapped within it.
- Press **Escape** to close.
- Confirm focus lands back on the trigger.

The four surfaces:

- **(a) `fullscreen` variant — the GizzDex trophy case.** Plan 22-04 converted it to prop-driven
  (`open={selfCaseOpen && rarity != null}`); it is the phase's **only** `fullscreen` consumer that
  can exit-animate. It takes the D-26 **fade** path, not the slide. Note that `CompareView` and
  `FriendDetail` are the other fullscreen consumers and remain **unmount-driven by design** — they
  will not exit-animate and are deliberately out of this sample.
- **(b) bottom sheet with backdrop — the top-right menu (`AppMenu`).** The `y: 100%` slide.
- **(c) `initialFocusRef` — `SettingsView`'s "Whose dex is this?" name prompt.**
  **NOT `PinSheet`** — `PinSheet` is unmount-driven and therefore cannot exit-animate, so it
  cannot exercise the close-start half of this requirement at all, even though it is the other
  `initialFocusRef` consumer. **Additional expected result here:** the input receives focus only
  **after** the ~200ms enter animation completes (D-27), and the iOS keyboard opens **without the
  sheet jumping**. Focusing mid-flight is exactly the keyboard-up viewport race D-27 exists to
  avoid.
- **(d) opened from a stacking context Phase 21 portaled — `SwapSheet` or `ShareCardSheet`.**

Expected: all four behave identically on every point above. The primitive is shared, so a
divergence between two of them is more interesting than a uniform failure.

| Sub-test | Surface | VoiceOver | External keyboard |
|---|---|---|---|
| 1a | GizzDex trophy case (fullscreen) | | |
| 1b | AppMenu (bottom sheet + backdrop) | | |
| 1c | SettingsView name prompt (`initialFocusRef`) | | |
| 1d | SwapSheet / ShareCardSheet (portaled stacking context) | | |

**Result: PASS / FAIL**

### Test 2 — SHEET-02: the close-start tap, on each of the four (BLOCKING)

This is the requirement's literal demand and the reason SHEET-02 has a device half at all. It
needs **real touch timing** — a synthetic event cannot prove a 200ms window, and `fireEvent`
ignores `pointer-events` entirely, so jsdom can only assert the style string and the dropped
handler.

Steps, on each of the four surfaces from test 1:

1. Tap the sheet's dismiss control.
2. **During the ~200ms exit animation, while the sheet is still visibly on screen**, tap a
   background control.

Expected: **the background control fires.** Everything except DOM removal — releasing `inert`,
restoring focus to the trigger, `aria-hidden` on the exiting card, `pointer-events: none` on card
and scrim, and dropping the scrim's close handler — happens at close-**start**, so a tap landing
anywhere in the exit window reaches the real background.

| Sub-test | Surface | Background tap landed? |
|---|---|---|
| 2a | GizzDex trophy case | |
| 2b | AppMenu | |
| 2c | SettingsView name prompt | |
| 2d | SwapSheet / ShareCardSheet | |

**Result: PASS / FAIL**

### Test 3 — D-30 perf observation. NON-BLOCKING.

**Observe; fix only what stutters.** This test does **not** gate the phase.

Steps: open `ShareCardSheet` (which pre-builds a PNG `File` on open) and `CompareView` (which
re-runs `deriveDex` over a friend envelope). Note any hitch the animation now makes legible.

Expected: a numbered note either way — including "no visible hitch", which is a perfectly good
result to record.

**The work is pre-existing. The animation adds none of it — it only makes an existing hitch
legible.** In particular the `ShareCardSheet` pre-build **must not** be deferred to "fix" a jank
nobody has seen: Phase-6 Pitfall 7 requires the share tap to have **no async before
`navigator.share`**, and moving the build later would break the share path to smooth an animation.

**Result: PASS / FAIL (non-blocking — record the observation either way)**

### Test 4 — NAV-06: Android install from the relocated Settings affordance (BLOCKING)

**Gated on test 0's Android install-mode proof.** Grade on
`matchMedia("(display-mode: standalone)")` and on `beforeinstallprompt` having fired — never on
`sab`.

Steps, on a real Android device in Chrome:

1. Open the top-right menu and tap the neutral **"Add to Home Screen"** row.
2. Confirm it navigates to Settings **with the install section scrolled into view** and focus moved
   to its heading.
3. Tap **"Install Gizz With Friends"**.
4. Complete the install.
5. Relaunch from the home-screen icon.

Expected:

- The install prompt **appears** — this is the whole point of NAV-06. It proves plan 22-03's
  hoisted module-level `beforeinstallprompt` capture reached a Settings section that mounts **long
  after** the one-shot event fired. A component-local capture cannot do this, which is why the
  requirement could not be closed before.
- The install completes.
- Because plan 22-03 added an **`appinstalled`** listener, **both the Settings install section and
  the menu row disappear without a reload** — they share one `!isInstalled` read, so they can never
  disagree.
- On relaunch, `matchMedia("(display-mode: standalone)").matches` is `true`.

**Result: PASS / FAIL**

### Test 5 — CHROME-03 on a real installed instance. OPTIONAL.

**Not required (D-09).** CHROME-05's own requirement wording is "asserted by test" and
`chromeResize.test.tsx` owns it; this phase already budgets two device sessions, and a third has
real cost. Run this only if the device is already in hand and there is time.

Steps: in GizzVerse, hide and show the chrome ("Hide bars" / "Show bars") in **portrait and
landscape**.

Expected:

- The toggle holds the **same viewport pixel** in both states and both orientations.
- It stays **inside the safe area** with the notch and home indicator present.
- The constellation genuinely **gains the freed height**.
- The constellation still starts **below the status bar** (D-13). This is the on-device check for
  the `<main>` top-inset reserve that jsdom cannot observe, where `env(safe-area-inset-top)`
  resolves to `0` by construction.

**Result: PASS / FAIL (optional)**

### Test 6 — Riders. Cheap while the device is in hand.

Steps, with chrome hidden:

1. Focus a constellation node so `NodeSheet` opens.
2. Trigger a toast — the `?mockLatest=1` harness, or run an export.

Expected:

- `NodeSheet` **settles down into the freed space**. It is `fixed bottom-0` composing from
  `--gz-chrome-reserve`, so collapsing that reserve moves it for free (D-14) — no special case.
- The toast renders at the **collapsed** position **and the chrome does not come back** (D-15).
  Forcing chrome back would yank the user out of a state they deliberately entered, triggered by an
  event they did not cause — and one of those events is the update-available prompt, which must
  never surprise-swap the app mid-show.

**Result: PASS / FAIL**

## Summary

total: 7
passed:
failed:
pending: 7
blocking: tests 0, 1, 2, 4
non-blocking: test 3
optional: test 5

## Revert procedures

Two independent failures, two named answers. Every artifact below is named by path, SHA and
`describe`-block title so that a failure on device night is a **two-minute mechanical decision
rather than an investigation**. Both SHAs resolve under `git show`.

### Procedure 1 — if test 1 or test 2 fails the accessibility bar: the enter-only fallback

**It is THREE mechanical steps, not one.** Two later plans added exit-window assertions that live
**outside** the exit commit, so `git revert` cannot remove them — left in place they would assert
behaviour that no longer exists and the suite would go red for the wrong reason.

**(a)** Revert the single 22-02 exit commit:

```
git revert --no-edit 53d6e59
```

That one commit carries `packages/app/src/components/Sheet.tsx`,
`packages/app/test/sheet.motion.test.tsx` **and** `packages/app/test/sheet.closeStart.test.tsx`, so
the exit behaviour and its own contract test leave together (the last is deleted outright).

**(b)** Delete this block from `packages/app/test/dexView.test.tsx` (plan 22-04), together with its
doc comment:

```
describe("fullscreen sheet exit window (reverts with the 22-02 exit commit)", …)
```

**(c)** Delete this identically-titled block from **both**
`packages/app/test/trailNodeSheet.test.tsx` **and** `packages/app/test/songRow.test.tsx`
(plan 22-10), together with their doc comments:

```
describe("bottom-sheet exit window (reverts with the 22-02 exit commit)", …)
```

All three blocks currently run to the end of their file, so each deletion is a truncation.

**Leftover imports are harmless.** After (b) and (c), `waitForElementToBeRemoved` is unused in all
three files and `within` is unused in `trailNodeSheet.test.tsx` only (`within` is still used in the
other two). `noUnusedLocals` is set in no tsconfig in this repo and there is **no lint toolchain
installed at all**, so leaving them costs nothing — removing them is optional tidiness, not a
required step.

#### What must NOT be reverted

- **Plan 22-02 Task 1's commit `d976ca0`** (the `useFocusTrap` split plus the enter-END
  `initialFocusRef` wiring). It is a **separate commit** and `sheet.a11y.test.tsx`'s `waitFor` case
  depends on it. Verified in the dry-run: that file stays green (16 tests) after step (a).
- **The three prop-driven source conversions** — `DexView` (22-04), `TrailNodeSheet` and
  `WhyDetail` (22-10). A prop-driven `<Sheet open={payload != null}>` is **correct under the
  enter-only ship too**: with the exit reverted it simply removes the node synchronously, exactly as
  the pre-conversion shape did. Reverting them would be pure churn, would re-break `Sheet.tsx`'s
  seam roster, and would additionally require unpicking `dexView.test.tsx`'s `FriendsList` stub.
- **`DexView`'s `key={openShow.showId}`.** It belongs to **CR-02** (it is what makes the
  pending/unresolvable split honest by construction), not to motion. Deleting it would reintroduce
  a stale-pending window with a fully green suite.

#### What the result is

A clean **enter-only** build: sheets still animate in, nothing animates out, and the close-start
window disappears **because there is no exit window to tap into**. That is the degraded ship
**ROADMAP success criterion 2** and **SHEET-02** explicitly sanction — criterion 2 reads
"Enter-only animation is an explicitly acceptable degraded ship if the exit cannot meet that bar."

There is deliberately **NO runtime kill-switch and NO feature flag** (D-18). A flag ships both code
paths, both need testing, and the un-animated path rots unexercised until the night it matters.
`prefers-reduced-motion` remains a genuine user-controlled no-motion mode at zero cost.

After the three steps, re-run `npx vitest run` and `npx tsc -b packages/core packages/app`, and
**record the decision in the Result lines above rather than deleting the failed test.**

#### Dry-run: this procedure was executed end to end before the device session

Run on a scratch branch at `e2911a2`, then deleted. Not a claim — a measurement:

```
git checkout -b scratch-22-09-revert-dryrun
git revert --no-edit 53d6e59        →  3 files changed, 15 insertions(+), 429 deletions(-)
                                       delete mode packages/app/test/sheet.closeStart.test.tsx
steps (b) + (c)                     →  3 files changed, 248 deletions(-)
npx vitest run                      →  EXIT 0   (139 files / 1196 tests passed)
npx tsc -b packages/core packages/app  →  EXIT 0   (no output)
```

`140 files / 1214 tests` → `139 / 1196` is **−1 file and −18 tests**, and the arithmetic closes
exactly: `sheet.closeStart` 5 + `sheet.motion` exit 5 + `dexView` 2 + `trailNodeSheet` 3 +
`songRow` 3 = 18. Step (a) auto-merged `Sheet.tsx` with no conflict despite plan 22-10's later
module-doc edit to that same file.

### Procedure 2 — if test 0's AFTER reading shows the status bar overlapping content

Revert the single meta-tag commit:

```
git revert --no-edit 04b3bc1
```

`04b3bc1` is `feat(22-09): add apple/mobile-web-app-capable meta tags` and touches **exactly one
file** (`packages/app/index.html`) precisely so this is possible. The manifest's
`"display": "standalone"` (`vite.config.ts`) is what actually makes iOS launch standalone, so the
cost of reverting is only the iOS startup-image nicety — **not** standalone launch, and **not**
NAV-06.

## Gaps

- **NAV-03's mixed-build presence check remains PHASE 21's recorded gap (D-38).** It is not closed
  by this phase and must not be read as closed by any later phase.
  `.planning/phases/21-layout-layering-foundations/21-HUMAN-UAT.md` stays **`status: partial`** —
  that is an accepted override, **not** a pass. Folding it in here would be scope widening onto a
  phase already carrying two device sessions, and it is not free: it needs **two devices on two
  different builds** with the harness base at `e92d4a8`.
