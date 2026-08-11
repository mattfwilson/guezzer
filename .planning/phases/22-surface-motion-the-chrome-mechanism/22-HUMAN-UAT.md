---
status: partial
closed_with_deferral: 2026-08-10
deferred_items: [test 4 / NAV-06 — blocked on Android hardware]
phase: 22-surface-motion-the-chrome-mechanism
source: [22-UI-SPEC.md §Device Verification, 22-RESEARCH.md §Validation Architecture]
requirements: [SHEET-02, NAV-06]
started: 2026-08-07
updated: 2026-08-09
---

## Current Test

[testing paused — 1 item outstanding: test 4 (NAV-06), blocked on an Android device]

6 of 7 executed and passed. Resume with `/gsd-verify-work 22` once an Android device is available;
test 4 is the only remaining item and needs no iOS re-run.

**Resume attempt 2026-08-09 (second): still no Android device — test 4 remains BLOCKED, held.**
Harness was stood up and then torn down unused. Two things learned that are worth reusing:

- **The build under test is still valid.** `dist/` from `ae5e0d1` matches current HEAD `4cb156d`
  (docs-only commits since), verified probe-free: `start_url: "."`, `apple-mobile-web-app-capable`
  present. **Do not rebuild on the next attempt** unless code lands after `4cb156d` — the
  probe-overlay defect below makes a probe-carrying build actively wrong for test 4, whose step 1
  is a top-right menu tap.
- **The orphaned-cloudflared gotcha recurred**, exactly as documented below: one `cloudflared.exe`
  from 2026-07-31 still pointed at a `:4173` nothing was listening on. Killed before opening the new
  tunnel; the replacement then served **200 on `/`, `/sw.js` and `/manifest.webmanifest` first try**.
  `Get-Process cloudflared` is now a confirmed-twice precondition, not a hunch.
- **One tunnel is correct from here on.** The two-origin BEFORE/AFTER split existed only for test 0's
  A/B, which passed. Test 4 grades current-build behaviour and needs a single origin — but it must be
  a **fresh** one: Chromium does not fire `beforeinstallprompt` when the app is already installed, so
  an origin carrying a prior install makes the whole test silently no-op instead of failing loudly.

## Session log — 2026-08-07

**Device availability: iPhone + external keyboard. NO Android device.**
Consequence, stated up front: **test 4 (NAV-06) is BLOCKED**, not failed. It is one of the four
blocking tests, so the best available outcome for this session is `status: partial`. Test 0's
Android row is blocked for the same reason.

**Harness deviation — two tunnels, not one.** The script assumes the BEFORE reading comes from
the already-installed home-screen icon. That is not reachable: cloudflared URLs are ephemeral, so
the existing icon points at a dead origin from a prior session. Rebuilding under one tunnel does
not fix it either — both icons would share **one origin, one service worker and one precache**,
and with `registerType: 'prompt'` the AFTER icon could be served the BEFORE icon's cached shell.

So: **two builds, two ports, two tunnels, two origins**, fully isolated caches.

| | BEFORE (pre-meta-tag shell) | AFTER (current HEAD) |
|---|---|---|
| Build | `04b3bc1` reverted in working tree only | `ae5e0d1`, tree clean |
| Served from | `packages/app/dist-before` :4174 | `packages/app/dist` :4173 |
| Tunnel (respun 2026-08-09) | `https://peers-vertical-tones-goto.trycloudflare.com` | `https://bob-metabolism-purchase-bin.trycloudflare.com` |

### Script defect found on device — the probe cannot be reached in standalone as written

**Symptom (2026-08-09):** the `?layoutProbe=1` readout renders in Safari but is **absent from the
installed home-screen app**, so test 0 was unexecutable as scripted.

**Cause.** `LayoutProbe` gates on the query string — `new URLSearchParams(location.search)`,
`packages/app/src/dev/LayoutProbe.tsx:65` — but the app ships a manifest declaring
`"start_url": "."` (`packages/app/vite.config.ts:99`). iOS 16.4+ honours the manifest for
Add-to-Home-Screen, so the icon launches at **`start_url`** — the bare origin root — and the query
is discarded. `isLayoutProbeEnabled()` returns false and the probe never mounts.

**This falsifies an assumption written into this script**, which asserted that "an installed icon
always relaunches at the URL it was added from, and hash routing preserves the query as the user
navigates". That held before the app shipped a manifest; it does not hold now. Any future device
script that reaches a query-gated dev flag from an installed instance hits the same wall.

**Harness workaround (NOT committed).** `start_url` set to `"./?layoutProbe=1"` in the working tree
and both shells rebuilt, so the launch URL itself carries the flag. Verified served: both origins
report `start_url = ./?layoutProbe=1`. `vite.config.ts` **must be reverted** at teardown — the
production manifest must not ship a dev flag. Because `start_url` affects only the launch URL and
not status-bar geometry, and both shells carry it identically, the A/B remains clean.

Fresh origins were issued deliberately: the previously installed `GZ-BEFORE` icon left an active
service worker holding the old manifest, which a same-origin reinstall would have kept serving.

**`vite.config.ts` was reverted to `start_url: "."` after test 0 passed** — the repo is clean of
harness edits, and the probe was dropped from the build for tests 1+ (below).

### Second script defect — the probe and top-bar interaction tests are mutually exclusive

`LayoutProbe` renders `fixed left-0 right-0 top-0` at `zIndex: config.ui.z.sheet` with
`pointerEvents: "auto"` and **no dismiss control** (`packages/app/src/dev/LayoutProbe.tsx:262-283`).
It therefore sits directly on top of the top-right menu button and the Settings affordance and
swallows their taps. Test 1b (`AppMenu`) and 1c (Settings name prompt) are **unreachable while the
probe is mounted**, which this script did not anticipate when it directed the tester to install
*from* the probe URL and then run every graded test from that instance.

Resolution: test 0 is the only test that needs the probe, so once it passed the probe was removed
and a probe-free build reinstalled. Any future script must either sequence the probe tests first
(as happened here by luck) or give `LayoutProbe` a collapse control.

### Harness gotcha — orphaned cloudflared processes silently break new tunnels

Stopping a backgrounded tunnel kills the wrapper but **leaves `cloudflared.exe` running** (the same
is true of `vite preview`). Four accumulated across sessions; new quick tunnels then registered
successfully (`Registered tunnel connection`, precheck all PASS) but every request returned
**curl 000** — the URL simply never became reachable, with nothing in the log indicating why.
Killing the orphans fixed it instantly: the next tunnel served **200 on the first attempt**.
Check `Get-Process cloudflared` before debugging an unreachable quick tunnel.
| `apple-mobile-web-app-capable` present | no (0 matches) | yes (1 match) |

All six smoke checks green: `/`, `/sw.js`, `/manifest.webmanifest` → **200** on both origins.

**A/B cleanliness, verified rather than assumed.** The two builds' JS bundles are **byte-identical**
(1,744,799 bytes both, `cmp` clean) — the differing asset hash is entry-graph-derived, since
`index.html` is a bundle entry. `__GIT_SHA__` and `__BUILD_DATE__` resolve identically for both.

**Incidental finding (minor, not phase-22 behaviour).** The CSS bundles are *not* identical:
AFTER is **+908 bytes**. Tailwind v4 scans `index.html`, and the 24-line explanatory comment
`04b3bc1` added contains the bare words *hidden*, *transform*, *drop-shadow*, *ease-in*,
*ease-in-out*, *ease-out* — Tailwind harvested them as class candidates and emitted
`.hidden\!`, `.transform\!`, `.drop-shadow`, `.ease-in`, `.ease-in-out`, `.ease-out` plus
`--ease-in`/`--ease-in-out` theme vars into production CSS. Dead rules: no element carries those
classes, so this is **layout-neutral and does not compromise the A/B**. Worth a follow-up
(move the prose out of `index.html`, or scope Tailwind's `@source`), not worth blocking on.

Execute tests 0–6 in order and write outcomes into the **Result** lines below. Do not open a new
document for the results.

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
| BEFORE (pre-meta-tag shell) | 34 | 62 | nav=true / mq=true | 812 |
| AFTER (reinstalled, incl. `04b3bc1`) | 34 | 62 | nav=true / mq=true | 812 |
| Android (mq only) | — | — | BLOCKED — no Android device this session | — |

**Result: PASS** (2026-08-09, iOS)

Every decisive criterion is met:

- `standalone` reads `nav=true mq=true` on **both** icons, so both are genuine standalone web apps.
  The Phase-21 bookmark trap (`sab: 0`, `nav=false mq=false`) is cleared.
- `sab: 34` is non-zero and **matches Phase 21's iPhone 16 Pro measurement exactly**.
- **BEFORE and AFTER are identical on all four values.** `sat` (62) and `innerH` (812) do not move,
  so the meta tags do **not** push content under the status bar. **Revert procedure 2 is NOT
  triggered; `04b3bc1` stays.**

**What the identity means, stated so it is not over-read later.** `apple-mobile-web-app-capable`
produced **zero measurable geometry change** on this device. That is the documented expectation, not
a null result: the manifest's `display: "standalone"` was already driving launch mode, so the tag's
live contribution is the iOS startup-image nicety — precisely what `index.html`'s comment claims and
what makes Revert procedure 2 cheap. It also means `black-translucent` is not, in practice,
relocating where app content begins on this device.

**Coverage caveat.** The GizzVerse chrome toggle was confirmed fully inside the safe area in
`GZ-AFTER`, but **portrait only** — landscape was not separately confirmed. The both-orientations
half of this check is therefore **deferred to test 5**, which exercises portrait and landscape
directly. Do not read test 0 as having closed the landscape case.

**Unrecorded:** exact iPhone model and iOS version were not captured. `sab: 34` is consistent with
iPhone 16 Pro but that is inference, not a reading — fill the devices table before archiving.

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
| 1a | GizzDex trophy case (fullscreen) | PASS | PASS |
| 1b | AppMenu (bottom sheet + backdrop) | PASS | PASS |
| 1c | SettingsView name prompt (`initialFocusRef`) | PASS | PASS |
| 1d | SwapSheet / ShareCardSheet (portaled stacking context) | PASS | PASS |

**Result: PASS — 8/8 (4 surfaces × VoiceOver + external keyboard), 2026-08-09.**

Keyboard half: focus stayed trapped inside the sheet on all four, Escape closed each, and focus
returned to the trigger every time. **SHEET-02's accessibility bar is met — Revert procedure 1
(the enter-only fallback) is NOT triggered.** The 22-02 exit commit `53d6e59` and the three
prop-driven source conversions stay.

All four prop shapes behave identically under VoiceOver: focus returns to the trigger, the sheet is
not read while leaving, and the background is reachable at close-**start** rather than after the
animation. Since `<Sheet>` is shared, four identical results across four different prop combinations
(`fullscreen` fade, backdrop slide, `initialFocusRef`, portaled stacking context) is evidence about
the **primitive**, not four coincidences.

1c additionally confirms **D-27** on device: the input takes focus only after the ~200ms enter
animation completes, and the iOS keyboard opens without the sheet jumping — the keyboard-up viewport
race that deferred focus exists to avoid.

**Sequencing note:** 1a and 1d were graded on the probe-carrying build, 1b and 1c on the probe-free
rebuild (see the probe-overlay defect above). Same commit (`ae5e0d1`), same shell; the only
difference is the manifest `start_url`, which cannot affect sheet behaviour.

Setup discovered for 1c, worth reusing: the "Whose dex is this?" prompt needs an **unowned**
classification, and `classifyImport` returns `unowned` when the file's owner is empty **or the local
owner name is unknown** (`packages/app/src/settings/importPicker.ts:69-79`). So the reachable path is
Export → **clear the local owner-name field** → Import that same file. No specially-crafted fixture
needed.

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
| 2a | GizzDex trophy case | YES |
| 2b | AppMenu | YES |
| 2c | SettingsView name prompt | YES |
| 2d | SwapSheet / ShareCardSheet | YES |

**Result: PASS (2026-08-09).** Background control fired on all four while the sheet was still
visibly leaving. Method: tap dismiss, then tap a bottom tab within the exit window and confirm the
tab actually switched — an unambiguous visible effect, and the tester confirmed the sheet was still
on screen as the tap landed.

**Both blocking SHEET-02 tests now pass (tests 1 and 2), on all four prop shapes.** This is the half
the suite structurally cannot cover: `fireEvent` ignores `pointer-events` entirely, so jsdom can
only assert the style string and the dropped scrim handler, never that a real touch reaches the real
background inside a real 200ms window. **SHEET-02 is closed on device.**

Reduced-motion note recorded while scoping this test: the exit window exists in **both** motion
modes. Under `prefers-reduced-motion` the bottom-sheet card drops the translate but keeps an opacity
cross-fade (`Sheet.tsx:339-341`), so it does not go instant, and the close-start window is present
either way. This test is therefore valid regardless of the device's Reduce Motion setting.

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

**Result: PASS — no visible hitch on either surface (2026-08-09).**

Observed: `ShareCardSheet` (opened via the Games share action, which pre-builds the PNG `File` on
open) and `CompareView` (opened via Settings → Import → answering "Whose dex is this?" with a name
that is not the local owner, which routes the parsed envelope to a read-only compare and re-runs
`deriveDex` over it). Neither stuttered.

**No action follows from this result, which is the point of recording it.** Because nothing hitched,
the `ShareCardSheet` pre-build stays exactly where it is — Phase-6 Pitfall 7 requires the share tap
to have no async before `navigator.share`, so deferring the build to smooth an animation would trade
a working share path for a cosmetic gain nobody needed.

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

**Result: BLOCKED — no Android device available this session (2026-08-09).**
`blocked_by: physical-device`

**Not a failure and must not be recorded as one.** NAV-06 is Android-only by construction: it exists
to prove that plan 22-03's hoisted module-level `beforeinstallprompt` capture reaches a Settings
section mounting long after the one-shot event fired, and `beforeinstallprompt` is a Chromium event
that iOS Safari never fires. No amount of iOS testing can substitute.

**This is the one blocking test left open, and it is why this session closes `partial` rather than
`complete`.** Everything it would have exercised remains unverified on device: the install prompt
actually appearing, the install completing, and the `appinstalled` listener making the Settings
install section and the menu row disappear together without a reload.

To close it later, an Android device in Chrome is required — and per the script, grade it on
`matchMedia("(display-mode: standalone)")` plus the fact that `beforeinstallprompt` fired at all.
**Never grade Android install-mode on `sab`; that is the iOS tell.**

### Desktop Chrome was tried as a substitute on 2026-08-10 and is NOT worth repeating

`InstallSection` branches on `canInstall`, not on platform (`InstallSection.tsx:61`), so desktop
Chrome nominally exercises the same code path as Android. It was attempted. **It did not produce a
usable reading, and the next person should not spend the time.**

What was observed on a clean origin (`localhost:4180`, fresh build, no prior install,
`standalone: false`): the section renders in the right place with the right heading and body, but
`sectionButtons` is empty and the copy falls through to *"Gizz With Friends can't auto-install
here"* — i.e. `canInstall === false` and `isIos === false`. Chrome simply never fired
`beforeinstallprompt`, most likely because the service worker was not yet controlling the page.

**Why this is a dead end rather than a bug.** The check is one-directional. A button appearing would
be strong evidence the module-level capture works; a button *not* appearing is inconclusive, because
at least three causes are unrelated to our code — already-installed for that origin, Chrome's own
installability verdict, or enterprise policy. Only one configuration falsifies anything: Chrome
reporting the app installable (DevTools → Application → Manifest) **while** the section still shows
the fallback. Anything else is noise.

**Two traps that cost time on 2026-08-10, both worth knowing:**

- **A long-lived localhost port carries a stale service worker.** `:4173` had been reused across
  many sessions and, with `registerType: 'prompt'`, kept serving a **pre-Phase-22 shell** — no Map or
  Sched tabs, and the old gold "Install Gizz With Friends" menu CTA that NAV-05 removed. Every
  reading taken against it was void. Serve verification builds on a **fresh port** (a new origin has
  no SW history and no prior install), and confirm the tab strip shows **Map** and **Sched** before
  grading anything.
- **A closed `<Sheet>` renders zero DOM nodes** (an A11Y-01 guarantee). So any DOM probe for the
  AppMenu install row reports "absent" identically whether the row is missing or the menu is merely
  closed. Probe `[aria-label="Close menu"]` first to prove the sheet is open, or the reading means
  nothing.

**Re-confirmed BLOCKED on the second 2026-08-09 resume attempt** — still no Android device. Held
deliberately rather than substituted: there is no iOS stand-in for this test, and grading it on
anything an iPhone can report would be a false pass. Setup cost to retry is now ~2 minutes (see the
resume note under Current Test); the only missing input is the hardware.

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

**Result: PASS (2026-08-09).** Run despite being optional, and worth the minutes: it is the **only**
test covering landscape, so it closes the both-orientations gap that test 0 deferred (test 0's
chrome-toggle check was portrait-only). Confirmed on device: the toggle holds the same viewport
pixel across both states and both orientations, stays inside the safe area with notch and home
indicator present, the constellation gains the freed height, and the constellation still starts
below the status bar — the `<main>` top-inset reserve (D-13) that jsdom cannot observe, because
`env(safe-area-inset-top)` resolves to `0` there by construction.

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

**Result: PASS (2026-08-09).** With chrome hidden, `NodeSheet` settled down into the freed space —
it is `fixed bottom-0` composing from `--gz-chrome-reserve`, so collapsing the reserve moves it for
free (D-14), no special case. The toast rendered at the collapsed position and **the chrome did not
come back** (D-15), confirming on device that an event the user did not cause cannot yank them out
of a state they deliberately entered.

## Summary

total: 7
passed: 6
failed: 0
blocked: 1
pending: 0
blocking: tests 0, 1, 2, 4 — **0, 1, 2 PASS; 4 BLOCKED (no Android device)**
non-blocking: test 3 — PASS
optional: test 5 — PASS (run anyway; it closes test 0's deferred landscape gap)

**Session verdict: `partial`.** Every test executable on the available hardware passed, with zero
failures and zero defects found in phase-22 behaviour. The single outstanding item is test 4
(NAV-06), blocked on hardware rather than unresolved.

**What this session closes:**

- **SHEET-02 — CLOSED on device.** Tests 1 and 2, 4 prop shapes × (VoiceOver + external keyboard +
  close-start touch) = 12/12. Revert procedure 1 not triggered; `53d6e59` stays.
- **Test 0's install-mode gate — CLEAN.** Genuine standalone on both shells (`nav=true mq=true`),
  `sab: 34`. The meta tags move no geometry, so Revert procedure 2 not triggered; `04b3bc1` stays.
- **D-13, D-14, D-15, D-26, D-27, CHROME-03** — all observed directly on device.

**What remains open after this session:**

- **NAV-06 (test 4)** — blocked, Android required. The only blocking test not closed.
- **NAV-03's mixed-build presence check** — still Phase 21's gap (D-38), untouched here, as designed.
- **SC3 / CHROME-05** — `22-VERIFICATION.md` records the shipped reheat as inert-not-absent. This
  session did **not** address it; it is a code/requirements reconciliation, not a device question.

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
