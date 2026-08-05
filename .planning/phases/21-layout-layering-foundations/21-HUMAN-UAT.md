---
status: diagnosed
phase: 21-layout-layering-foundations
source: [21-VALIDATION.md, 21-UI-SPEC.md]
started: 2026-07-25T01:16:45Z
updated: 2026-07-25T04:40:00Z
---

## Current Test

[both plan-21-04 gates resolved by static analysis — see tests 1 and 7]

Plan 21-04's three `must_haves` are now answerable WITHOUT a device session:
  - test 7 names the offending surfaces      → SearchSheet + FabMenu (stacking-context nesting)
  - test 1 selects a branch                  → CONFIRMATION BRANCH (D-15 confirmed)
  - 21-07 and 21-11 therefore know what to build.

Waves 3-8 are unblocked. What remains OWED to the requirement (not to development):
  - Success criterion 1's on-device before/after record, portrait AND landscape (D-18).
    The probe defect this line used to flag is now FIXED (`dafadeb`): `GAP` measured `<main>`'s
    border box, which after 21-07 includes `padding-bottom: var(--gz-content-reserve)`, so it
    degenerated to a constant `-(4rem + sab)`. It now subtracts the computed padding to measure
    the CONTENT edge, and prints `mainPadB` so the correction is auditable from the screenshot.
  - Test 3's max-Dynamic-Type pass, test 5's D-37 descender check, test 6's mixed-build run,
    and tests 2/4/8 which are AFTER-the-fix confirmations. All batched into plan 21-13.

Waves 3-7 are now COMPLETE (plans 21-07 … 21-12). Only plan 21-13 — this device session —
remains. Note two gates that were cleared by static analysis and are still UNOBSERVED:
  - Test 7's `?layerRepro=1` browser repro was never run; 21-11's portal fix was made on
    spec-level reasoning. 21-12 widened that check to five surfaces.
  - Test 2's overlay reserve got SMALLER by one inset in 21-10 (deleting three toasts'
    self-padding made `offsetHeight` honest). Under-reserving is the direction that covers a
    control, so the scrolling-route check in test 2 is load-bearing, not a formality.

## Session Notes

Tests **1 (the BEFORE half)** and **7** are the next open items, and they are the two that gate
downstream work:

- **Test 1 BEFORE** gates **plan 21-07**. 21-07 removes the body-level `padding-bottom:
  env(safe-area-inset-bottom)` (`styles.css:220`) *if and only if* the measurement confirms D-15.
  Do not run 21-07 until the before-numbers are recorded here. Test 1's AFTER half runs once the
  bottom-space conversion has landed.
- **Test 7** gates **plan 21-11**. 21-11 portals `SearchSheet` and `FabMenu` out of the ShowView
  `content: 10` stacking context; the repro must first NAME the offending surface (D-20 — "produce
  the repro the roadmap asks for and name the offending surface before acting").

Both harnesses ship in plan 21-01 and are available now: `?layoutProbe=1` (test 1) and
`?layerRepro=1` (test 7). Test 7 is a desktop-browser check and costs ~30 seconds (D-30 — the
repro is browser-only and costs nothing, and its result sizes the layering work).

## Tests

### 1. Installed-PWA bottom gap — before and after, portrait and landscape (FOUND-01)
expected: |
  Measure the FOUND-01 dead gap on a real INSTALLED home-screen instance. This cannot be a browser
  check: `env(safe-area-inset-bottom)` reports `0` in a Safari tab, in jsdom, and in every headless
  context, so the whole bug class is invisible except installed (21-VALIDATION §Manual-Only row 1).

  Setup: follow the Harness section below — production build, `vite preview`, cloudflared tunnel
  with `--http-host-header localhost` — then Share → Add to Home Screen and run everything from the
  installed standalone app, never a browser tab.

  Steps:
  - Open the installed app with `?layoutProbe=1` appended to the URL. A selectable monospace readout
    appears pinned to the TOP of the viewport (deliberately top-anchored so it never occludes the
    bottom gap you are photographing).
  - Confirm the readout says the instance really is installed: `standalone: nav=true` on iOS
    (`mq=true` on Android Chrome). If both read false you are in a tab and the measurement is void.
  - Screenshot the whole readout in PORTRAIT.
  - Rotate to LANDSCAPE, wait for the readout to recompute, screenshot again.
  - Record these three numbers for EACH orientation: `sab`, `bodyH-rootH`, and `>>> GAP`.
  - Record device model, OS version, and orientation with each set (D-18). Also note `dpr` and
    `htmlFont` so a rem-based reading stays interpretable and so the largest-Dynamic-Type run
    (test 3) is comparable.

  Then read the result against these three branches:

  CONFIRMATION BRANCH — `bodyH-rootH === sab` AND `GAP === sab` (both non-zero). D-15 is confirmed:
  the body-level bottom inset is double-counted against `BottomTabBar.tsx:25-26`. Proceed with plan
  21-07's removal of the `padding-bottom: env(safe-area-inset-bottom)` declaration on `body`
  (`styles.css:220`), mirroring the UX-01/D-01 top-inset fix. The left/right body gutters stay —
  they have no per-surface duplicate.

  FALSIFICATION BRANCH — `GAP === 0`. D-19 applies: a non-reproduction still SATISFIES FOUND-01.
  The success criterion is "measured before and after, portrait and landscape", so if the numbers
  show flush then the measurement IS the evidence and NO code change is required to close FOUND-01.
  Record the baseline here as the regression reference and mark the requirement closed on the
  measurement alone. Plan 21-07 then lands the single-owner mechanism WITHOUT the body-inset removal.

  FALSIFICATION BRANCH (second form) — `GAP != sab` AND `GAP != 0`. D-15 is falsified: the gap is
  real but is not the double-counted body inset. Fall back to the D-14 open investigation — compare
  `innerH` / `clientH` / `vvH` against `htmlH` / `bodyH` / `rootH` / `mainH` to separate a
  viewport-sizing story from a box-model story, and record which chain the discrepancy lives in
  before any fix is written. Do NOT reintroduce `100vh` / `min-h-screen` (that caused the
  start-show-not-clickable bug, `AppShell.tsx:28-36`) and do NOT reach for `dvh` (iOS 26.0 shipped
  its own `100dvh` bottom-gap regression).

  AFTER half: re-run every step above on the post-fix build, same device, both orientations, and
  record the same three numbers plus screenshots alongside the before set. FOUND-01 is closed only
  when before AND after exist for BOTH orientations (D-18).
result: |
  ISSUE — REPRODUCES (visual confirmation, 2026-07-25). Owner reports a visible dead gap between
  content and the tab bar on the installed instance.

  What this settles: the D-19 falsification branch (`GAP === 0`) is RULED OUT. FOUND-01 is a real
  defect on this device, not a non-reproduction, so plan 21-07 must ship an actual fix rather than
  closing the requirement on a flush baseline.

  What this does NOT yet settle — 21-07 is still gated:
  - `sab`, `bodyH-rootH` and `>>> GAP` were not recorded, so the CONFIRMATION branch
    (`bodyH-rootH === sab` AND `GAP === sab` → delete `styles.css:220`) cannot be distinguished
    from the second FALSIFICATION branch (`GAP != sab` AND `GAP != 0` → D-14 investigation).
    These are different fixes; the numbers pick between them.
  - Orientation was not stated. D-18 requires portrait AND landscape independently.
  - Route was not stated. `<main>`'s bottom padding adds a dynamic `overlayInset` on `#/show`
    (`AppShell.tsx:75-77`), so the route must be named for the AFTER run to be comparable.

  BRANCH RESOLVED ANALYTICALLY (2026-07-25, Claude) — CONFIRMATION BRANCH (D-15 confirmed).

  The layout chain is fully determined by source; no measurement is needed to select the branch.
  Premises, each verified in-tree:
    - `html, body, #root { height: 100% }` (`styles.css:15-19`)
    - `body { margin: 0 }` and a bottom inset but NO top inset (`styles.css:205-224`)
    - Tailwind preflight `box-sizing: border-box` (`@import "tailwindcss"`, `styles.css:1`)
    - `<main>` is `flex-1` inside AppShell's `h-full` column (`AppShell.tsx:39,62-67`)
    - `<nav>` is `fixed bottom-0`, height `calc(4rem + env(sab))` (`BottomTabBar.tsx:28,33`)
    - `overlayInset` defaults to 0 (`pwa/bottomOverlayInset.ts:24`)

  With V = visible viewport height and S = env(safe-area-inset-bottom):
    body border-box = V, so body CONTENT box = V - S
    #root = 100% of body's content box  = V - S
    <main> border-box bottom             = V - S
    <main> content bottom  = (V - S) - (4rem + S) = V - 4rem - 2S
    <nav> is FIXED, so viewport-relative, ignoring body padding entirely:
    nav top                              = V - 4rem - S

    DEAD GAP = navTop - mainContentBottom = S   ← exactly one safe-area inset

  This is precisely D-15: the body-level inset is counted while the fixed tab bar ignores it.
  Deleting `styles.css:220` puts main's content bottom at V - 4rem - S — flush. Plan 21-07 is
  therefore licensed to remove the declaration. The left/right body gutters stay (no duplicate).

  HARNESS DEFECT FOUND — the probe cannot measure this (blocks a meaningful AFTER run):
    - `GAP` is computed as `tabTop - main.getBoundingClientRect().bottom`. `getBoundingClientRect`
      returns the BORDER box, which INCLUDES main's padding, so
      GAP = (V - 4rem - S) - (V - S) = -4rem — a constant, independent of S, identical before and
      after the fix. It never measured the dead gap.
    - `bodyH-rootH` equals S by construction on ANY build, fixed or not — it confirms the body
      padding exists but is not evidence of a defect.
    Both "load-bearing" lines are non-discriminating. The probe needs its GAP formula corrected to
    `navTop - (mainRect.bottom - mainPaddingBottom)` before the D-18 before/after capture can mean
    anything.

  STILL OWED (requirement bookkeeping, no longer a development blocker): success criterion 1 says
  "measured on-device before and after, portrait AND landscape". The derivation licenses the code
  change; it does not substitute for that record. Capture it with a FIXED probe in plan 21-13.

  ── MEASURED BEFORE (session #2, 2026-07-26) ──────────────────────────────────────────────────

  Installed home-screen instance, GizzDex ("Me") tab, `standalone: nav=true mq=true` on both
  readings. Build: pre-21-07 `83ea0d8` with the corrected probe (`dafadeb`) cherry-picked on top,
  built and served from a separate worktree so the shipped tree was never modified. Verified as the
  BEFORE build at the shipped-CSS level: `padding-bottom:env(safe-area-inset-bottom)` present in
  the served stylesheet. Device: **iPhone 16 Pro (402×874 CSS @ dpr 3), iOS 26.5.2** — recorded in
  session #3 (2026-08-05); see SESSION #3 CLOSURE below for the D-18 provenance.
  Screenshots: `evidence/BEFORE-portrait.PNG`, `evidence/BEFORE-landscape.PNG`.

  | field       | portrait | landscape |
  |-------------|----------|-----------|
  | sab         | 34       | 20        |
  | bodyH       | 812      | 402       |
  | rootH       | 778      | 382       |
  | bodyH-rootH | 34       | 20        |
  | mainPadB    | 98       | 84        |
  | mainBottom  | 680      | 298       |
  | tabTop      | 715      | 319       |
  | >>> GAP     | 35       | 21        |

  `bodyH-rootH === sab` in BOTH orientations — the body-level inset is present and is shortening
  `#root` by exactly one inset. That is D-15's premise confirmed by measurement, not derivation.

  PROBE CALIBRATION (+1px — discovered in this session, applies to every reading):
  `tabTop` reads the first tab BUTTON's `getBoundingClientRect().top`, but `<nav>` carries
  `border-t border-hairline` (1px) in both builds (`BottomTabBar.tsx:28`), so the button's top sits
  one pixel inside the nav's border box. The measured `GAP` is therefore `trueDeadGap + 1`:
    - portrait : GAP 35 → true dead gap 34 === sab 34
    - landscape: GAP 21 → true dead gap 20 === sab 20
  The analytic derivation (DEAD GAP = exactly one safe-area inset) is confirmed to the pixel in
  both orientations, on a real installed instance.

  CONSEQUENCE FOR THE AFTER RUN: the expected reading is **GAP === 1**, not 0. The plan's
  "Expected `GAP === 0`" was written against the uncalibrated probe. A literal 0 would mean main's
  content bottom overlaps the nav's border by a pixel; a reading of `sab + 1` would mean the fix
  did not land at all.

  ── MEASURED AFTER (session #2, 2026-07-26) ───────────────────────────────────────────────────

  PASS. Same device, same GizzDex ("Me") tab, same installed-instance conditions
  (`standalone: nav=true mq=true`). Build: `94b99ea` (phase-21 HEAD), verified as the AFTER build
  at the shipped-CSS level: zero occurrences of `padding-bottom:env(safe-area-inset-bottom)` in the
  served stylesheet. Screenshots: `evidence/AFTER-portrait.PNG`, `evidence/AFTER-landscape.PNG`.

  | field       | portrait | landscape |
  |-------------|----------|-----------|
  | sab         | 34       | 20        |
  | bodyH       | 812      | 402       |
  | rootH       | 812      | 402       |
  | bodyH-rootH | 0        | 0         |
  | mainPadB    | 98       | 84        |
  | mainBottom  | 714      | 318       |
  | tabTop      | 715      | 319       |
  | >>> GAP     | 1        | 1         |

  BEFORE → AFTER comparison (the D-18 record success criterion 1 asks for):

  | field       | portrait before → after | landscape before → after |
  |-------------|-------------------------|--------------------------|
  | sab         | 34 → 34   (control, unchanged) | 20 → 20   (control, unchanged) |
  | tabTop      | 715 → 715 (control, unchanged) | 319 → 319 (control, unchanged) |
  | bodyH-rootH | 34 → 0                          | 20 → 0                          |
  | rootH       | 778 → 812  (+34 = +sab)         | 382 → 402  (+20 = +sab)         |
  | mainBottom  | 680 → 714  (+34 = +sab)         | 298 → 318  (+20 = +sab)         |
  | >>> GAP     | 35 → 1     (−34 = −sab)         | 21 → 1     (−20 = −sab)         |
  | true gap    | 34 → 0                          | 20 → 0                          |

  VERDICT: FOUND-01 is closed. `GAP` reads the 1px nav border and nothing more in BOTH
  orientations, i.e. the true dead gap is 0. The comparison is controlled: `sab` and `tabTop` are
  identical before and after within each orientation, so the only quantities that moved are the
  ones the fix targets — `#root` regained exactly one safe-area inset of height (`bodyH-rootH`
  34 → 0 and 20 → 0), and `<main>`'s content bottom advanced by that same inset to sit flush
  against the tab bar. The magnitude of the change equals `sab` in each orientation independently,
  which is the D-15 signature rather than a coincidental improvement.

  Landscape correctness (D-11) is confirmed by the same reading: the bar stays bottom-anchored
  full-width, and the arithmetic holds when the inset shrinks from 34 to 20 — the gap closes to the
  same true 0 without any landscape-specific layout.

  ── SESSION #3 CLOSURE (2026-08-05) ───────────────────────────────────────────────────────────

  Both items this test still owed are now closed. Build under test: `e847183` (post-rename),
  production build served over the cloudflared tunnel, run from the INSTALLED standalone home-screen
  icon.

  1. DEVICE (D-18) — CLOSED. **iPhone 16 Pro, 402×874 CSS @ dpr 3, iOS 26.5.2.** This is the
     owner's only test device and the same handset behind the session-#2 before/after tables above
     and the Phase-4 device UAT. The iOS point release is stamped as of session #3; the exact point
     release in force during session #2 was not separately captured, and is not material — the
     before and after halves were taken minutes apart on one device, which is what D-18's
     "same device" clause protects.

  2. SCROLLED-TO-END VISUAL — CLOSED. The **Me** (GizzDex) tab was scrolled to its very bottom on
     the installed instance: no content sits under the home indicator. Owner attestation; no
     screenshot captured.

  ⚠ RECORDED CAVEAT — session #3's probe reading is NOT an independent standalone corroboration.
  `21-SESSION-3-RESULTS.md` reports `mainBottom: 650`, `tabTop: 651`, `GAP: 1` as independent
  corroboration of the +1 calibration. Those numbers are arithmetically reachable ONLY from the
  `sab: 0` Safari context, not from the installed instance:

  | context                              | viewport | sab | navTop = vp − 4rem − sab | button top |
  |--------------------------------------|----------|-----|--------------------------|------------|
  | Safari tab (session #3, proven)      | 714      | 0   | 650                      | **651**    |
  | installed instance (session #2, same route) | 812 | 34 | 714                     | **715**    |

  The first row reproduces session #3's reported pair exactly; the second reproduces session #2's
  recorded `tabTop: 715` exactly. A genuine standalone session-#3 reading would have printed
  ~714/715, not 650/651. Corroborating facts: `evidence/session3-layoutprobe-safari-sab0-PROOF.PNG`
  is the ONLY probe artifact from session #3 and shows `sab: 0`, `standalone: nav=false mq=false`,
  `innerH: 714`; no standalone probe screenshot was captured for the re-run. (The courier's
  parenthetical "true standalone on this device is ~874" is the device's nominal CSS viewport; the
  MEASURED standalone `bodyH` on this route is 812. Either figure is far from the 714 that 650/651
  requires.)

  Under `sab: 0` the FOUND-01 double-count is unobservable BY CONSTRUCTION — the inset that would be
  counted twice is zero — so this reading can neither confirm nor falsify the fix. It is consistent
  with the 1px nav-border calibration and nothing more. Recording it as independent corroboration
  would have laundered a browser-tab reading into the closed evidence, which is exactly the failure
  MEMORY `ios-standalone-verification` was written about.

  CONSEQUENCE: **FOUND-01 stays CLOSED — on the session-#2 measured before/after**, which carries
  non-zero insets in both orientations (sab 34/20), a controlled comparison (`sab` and `tabTop`
  identical before vs after within each orientation), and a change magnitude equal to `sab`
  independently in each orientation — the D-15 signature. Session #3 neither strengthens nor
  weakens that record. No re-run is required: the session-#2 pair already satisfies success
  criterion 1 and D-18 in both orientations, and session #3 supplied the two missing D-18 fields.
severity: major

### 2. bottom-16 overlay overlap on the installed instance (FOUND-02)
expected: |
  The five `fixed bottom-16` overlays sit 64px from the VIEWPORT bottom (`fixed` ignores body
  padding), while `BottomTabBar` is `64px + env(safe-area-inset-bottom)` tall — so on an installed
  instance each overlaps the top of the tab bar by exactly one inset (D-09). `BingoCelebration.tsx:207`
  even carries a comment reasoning that `bottom-16` clears the bar: correct in a Safari tab where the
  inset is 0, wrong installed. Requires a non-zero inset, so it cannot be a browser check.

  BEFORE (on the installed instance, same harness as test 1):
  - Trigger `BingoCelebration`: open a show with a locked bingo card and log songs until a square
    marks / a line completes. Confirm whether its bottom edge overlaps the tab bar.
  - Trigger `WaveToast`: from a second signed-in device, send a wave/reaction to this device.
    Confirm whether the toast overlaps the tab-bar buttons.
  - Photograph each overlap and note by how much (compare against `sab` from test 1).

  AFTER the plan-21-10 conversion (all five surfaces composing from the chrome reserve):
  - Re-trigger `BingoCelebration` and `WaveToast` and confirm each now CLEARS the tab-bar buttons
    completely — the buttons stay fully visible and tappable underneath.
  - Additionally confirm `InstallBanner`, `UpdateToast` and `BackupToast` gained NO internal dead
    space from the conversion: their own bottom padding must not double up with the new reserve.
    `UpdateToast`/`InstallBanner` already apply `paddingBottom: env(safe-area-inset-bottom)`
    internally — after conversion that must be owned once, not twice.
  - `BackupToast` is easiest to trigger via End Show (the auto-backup path); `UpdateToast` needs two
    sequential builds served over the tunnel; `InstallBanner` is once-per-version.
result: |
  PASS — ALL FIVE OVERLAYS (session #3, 2026-08-05). Installed standalone instance, iPhone 16 Pro,
  iOS 26.5.2, build `e847183`. Owner attestation; no screenshots captured this session.

  | overlay             | verdict | how it was triggered                                         |
  |---------------------|---------|--------------------------------------------------------------|
  | `InstallBanner`     | PASS    | re-armed by the fresh IndexedDB that came with re-installing |
  | `BingoCelebration`  | PASS    | locked card, logged onto a marked square                     |
  | `WaveToast`         | PASS    | sent from a second signed-in device                          |
  | `BackupToast`       | PASS    | End Show auto-backup path                                    |
  | `UpdateToast`       | PASS    | verified against a deliberately bumped `dist/sw.js`          |

  Each clears the tab-bar buttons completely — the buttons stay fully visible underneath, no
  overlap. FOUND-02's `bottom-16`-vs-`64px + inset` overlap (D-09) is confirmed fixed against a real
  NON-ZERO inset, which is the only context in which it was ever observable.

  INTERNAL DEAD SPACE — explicitly answered (RESEARCH Pitfall 2). **None.** The three formerly
  self-padded toasts — `InstallBanner`, `UpdateToast`, `BackupToast` — show NO dead space inside the
  toast below their text. Plan 21-10 deleted their own `paddingBottom: env(safe-area-inset-bottom)`
  in the same edit that moved them onto the chrome reserve, so the inset is owned once rather than
  twice; that is what the device confirms.

  UNDER-RESERVE CHECK (the load-bearing direction). The plan-21-10 reserve got SMALLER by one inset,
  and under-reserving is the direction that COVERS a control. No covered content and no unreachable
  control was observed with a toast visible.

  OPERATIONAL NOTE for any future session — **three separate SW bumps were needed** to land the
  `UpdateToast` check. Each re-install re-baselines the cached worker, so the pending update
  disappears and the toast cannot fire. Bump `dist/sw.js` *after* the install is final, then
  force-quit and relaunch.

  EVIDENCE BASIS (recorded honestly): this verdict rests on owner attestation of the corrected
  standalone context, the same basis session #2 used for NAV-01. The first half of session #3 ran in
  a SAFARI TAB and every observation from it was DISCARDED — including a convincing-looking "gap
  between `BackupToast` and the tab bar". That gap was an iOS Safari dynamic-viewport artifact: on
  scroll Safari collapses its bottom toolbar, the layout viewport grows, and `fixed` bottom-anchored
  elements stay anchored to a viewport bottom that is now below the visible glass. It is **not** a
  FOUND-02 defect — and with `sab: 0` the double-count bug class is unobservable by construction, so
  that half could neither reproduce nor rule it out. Retained as the discarded-context record:
  `evidence/session3-DISCARDED-safari-recap-backuptoast.PNG` and
  `evidence/session3-DISCARDED-safari-scrolled-toolbar-hidden.PNG`.

### 3. Tab strip at the largest Dynamic Type setting (NAV-01)
expected: |
  Requires the OS text-size control, so it cannot be automated or checked in a desktop browser.

  - On the device: Settings → Display & Brightness → Text Size, drag to MAXIMUM. (If accessibility
    sizes are enabled, also try Settings → Accessibility → Display & Text Size → Larger Text at max.)
  - Return to the installed app and look at the bottom tab strip on the POST-RENAME build (Live /
    GizzVerse / Map / Me / Games).
  - Confirm all FIVE labels fit on ONE line each: no clipping, no wrap to a second line, no ellipsis,
    and no label colliding with its neighbour. Each tab must stay ≥ 44px wide (`flex-1` should hold).
  - Confirm the icons stay aligned and the strip height does not push content off-screen.
  - D-04: `rem` is the source unit — the strip is expected to GROW with the setting. The failure
    condition is clipping/wrapping, not growth. Photograph the strip at max size.
  - Note: "GizzVerse" is deliberately the one long label kept (it is a real place, not a prefixed
    noun), so it is the worst case — check it first.
result: |
  PASS (2026-07-25) — owner reports the tab labels read correctly with no clipping, wrapping or
  collision. All five post-rename labels (Live / GizzVerse / Map / Me / Games) render cleanly on the
  installed instance.

  Caveat on scope: the owner's confirmation covered the labels as displayed. It was not separately
  stated whether the OS text-size slider was driven to MAXIMUM (Settings → Display & Brightness →
  Text Size, and/or Accessibility → Larger Text). NAV-01's success criterion is specifically the
  largest Dynamic Type setting — at default sizing the labels were never at risk. If the max-size
  pass was not run, re-confirm during device session #2 (plan 21-13) before closing NAV-01.

  RESOLVED — PASS at MAXIMUM (session #2, 2026-07-26). Owner confirms the text-size slider WAS at
  maximum for this check. That closes the one sub-criterion session #1 left open: all five
  post-rename labels (Live / GizzVerse / Map / Me / Games) fit on one line each at the largest
  Dynamic Type setting, with no clipping, wrapping or collision. "GizzVerse", the deliberate
  worst-case label, holds.

  NAV-01 is closed. D-04 is vindicated: `rem` sizing lets the strip grow with the OS setting rather
  than clip, which is the behaviour the unit was chosen for.

  Evidence gap (recorded, not fatal): no max-size screenshot was captured this session, so the
  acceptance criterion's "with a screenshot reference" is satisfied by owner attestation rather
  than by an artifact. The verdict itself is not in doubt; only its photographic backing is absent.

  ── RE-RUN ON THE SIX-TAB STRIP — SUPERSEDES THE ABOVE (session #3, 2026-08-05) ────────────────

  PASS at MAXIMUM Dynamic Type on a **SIX**-tab strip. iPhone 16 Pro, iOS 26.5.2, installed
  standalone instance, build `e847183`.

  WHY THIS IS A SUPERSESSION, NOT A REPETITION. Session #2 passed NAV-01 at maximum text size
  against a **five**-tab strip (Live / GizzVerse / Map / Me / Games). The **Sched** tab landed in
  commit `2028a95` on 2026-07-30 — AFTER that reading — making the strip six tabs:

      Live · GizzVerse · Map · Sched · Me · Games

  A sixth tab narrows every `flex-1` slot, so the session-#2 result was no longer the worst case and
  could not be carried forward. This session re-ran the check at maximum on the six-tab strip and it
  holds: all six labels fit on one line each, no clipping, no wrap, no ellipsis, no collision with a
  neighbour, and the strip grew with the setting rather than clipping. "GizzVerse", the deliberate
  worst-case label, still holds at six tabs.

  D-04 is vindicated a second time and under more pressure: `rem` sizing is what lets the strip grow
  with the OS setting instead of clipping. NAV-01 is closed against the strip as it actually ships.

  Evidence basis unchanged: owner attestation, no max-size screenshot captured in this session
  either. The acceptance criterion's "with a screenshot reference" therefore remains satisfied by
  attestation rather than by an artifact, across both readings.

### 4. SearchSheet with the soft keyboard up (FOUND-03, D-17)
expected: |
  jsdom has no `visualViewport` resize and a desktop browser has no soft keyboard, so this is
  device-only.

  - On the installed instance, enter Show Mode and open the SearchSheet.
  - Focus the search input so the soft keyboard raises.
  - Confirm the sheet is NOT pushed under the keyboard, the search input stays visible, and the
    result rows are scrollable and tappable with the keyboard up.
  - Confirm neither the FAB nor the suggestion strip rides up on top of the keyboard.
  - Dismiss the keyboard and confirm the sheet settles back cleanly.
  - D-17: FIX ONLY IF the reserved arithmetic misbehaves. No speculative `visualViewport` mechanism
    is to be added without a reproduced defect here. If it behaves, record PASS and change nothing.
  - Re-run this check AFTER plan 21-11 portals the SearchSheet to `document.body` — portaling changes
    the sheet's containing block, so the keyboard behavior must be re-confirmed, not assumed.
result: |
  PASS (session #3, 2026-08-05). Installed standalone instance, iPhone 16 Pro, iOS 26.5.2, build
  `e847183` — i.e. AFTER plan 21-11 portaled the SearchSheet to `document.body`, which is the run
  that matters, since portaling changes the sheet's containing block.

  Observed with the soft keyboard raised: the sheet is not pushed under the keyboard, the search
  input stays visible, and the result rows stay scrollable and tappable. Neither the FAB nor the
  suggestion strip rides up on top of the keyboard. Dismissing the keyboard settles the sheet back
  cleanly.

  D-17 — **NO FIX REQUIRED, AND NONE MADE.** The reserved arithmetic behaves, so the speculative
  `visualViewport` mechanism D-17 holds in reserve was correctly not built. D-17's rule is "fix only
  if the reserved arithmetic misbehaves"; it did not, so nothing was changed. This is the recorded
  PASS that rule asks for, not an absence of investigation.

  Owner attestation; no screenshot captured this session.

### 5. Share-card PNG at the widest realistic venue name (FOUND-05, D-36/D-37)
expected: |
  Real font metrics only — the test-suite `measureText` mock is linear-in-length and cannot predict
  a real canvas render.

  - Pick the widest realistic venue name available (the longest venue string in the corpus, or a
    real upcoming residency venue) and produce a share card for a show at it — the per-show recap
    share card and/or the bingo trophy card.
  - The footer line is `date · venue`, drawn by `centerText` at a fixed 44px. Confirm:
    (a) the DATE is never truncated — the date is the FOUND-05 requirement, and "Mon D, YYYY" is
        ~2 characters longer than the ISO string it replaces, so this change makes an existing
        overflow risk worse (D-36);
    (b) the VENUE is what ellipsizes when the line is too wide (via the existing `truncateToWidth`
        helper), never the date;
    (c) nothing overflows the card edges.
  - D-37: in the SAME pass, look at the footer BASELINE. The footer sits at `height * 0.99` with a
    44px font, so descenders (g, y, p, j, q) may already clip at the card's bottom edge —
    independent of the date change. Fix only if it actually clips. Photograph the footer.
  - Save the generated PNG out through the real iOS share sheet and confirm the saved file matches
    what was previewed.
result: |
  PASS (2026-07-25) — owner reports the share-card footer renders correctly: the venue reads well,
  with no truncation of the date and no overflow past the card edges. The plan-21-06
  `composeFooterLine` width constraint behaves against real canvas font metrics, which is what the
  linear-in-length `measureText` unit mock could not prove.

  Caveat on scope: not separately confirmed were (a) the D-37 descender check on the footer BASELINE
  (the footer sits at `height * 0.99` at 44px, so g/y/p/j/q tails may clip at the card's bottom edge
  independent of the date change), and (b) the widest-realistic-venue worst case specifically. Both
  are cheap to re-confirm during device session #2 (plan 21-13).

  ── D-37 DESCENDER CHECK RESOLVED BY MEASUREMENT (session #2, 2026-07-26) ─────────────────────

  Method: the footer draw was replicated exactly in headless Chrome against a real canvas — same
  `FONT_STACK`, same `600` weight, same `textBaseline: "alphabetic"`, same 1080×1350 geometry, same
  baselines (`height*0.955` label at 38px, `height*0.99` line at 44px) — and the true ink extents
  were read from `measureText().actualBoundingBoxDescent` rather than assumed from font ratios.
  Sample string chosen as the descender worst case: `Aug 9, 2026 · Happy Valley Gypsy Playground`
  (g/p/y in both halves). Artifact: `evidence/descender-zoom.png` — the bottom 64px of the card
  magnified 2×, with the canvas bottom edge marked in red.

  | quantity                              | value    |
  |---------------------------------------|----------|
  | footer baseline (`height * 0.99`)     | 1336.50  |
  | actualBoundingBoxDescent @ 44px       | 10.00    |
  | ink bottom                            | 1346.50  |
  | canvas height                         | 1350     |
  | **clearance to bottom edge**          | **+3.50**|
  | label ink bottom (`height*0.955`,38px)| 1298.25  |
  | footer ink top                        | 1303.50  |
  | gap label → footer                    | +5.25    |

  VERDICT: **NOT CLIPPED.** Descenders clear the card's bottom edge by 3.50px and clear the label
  above by 5.25px. The measured descent is 0.227em, consistent across the sans-serif faces the
  stack resolves to. The conditional `height * 0.99` → `height * 0.97` nudge is therefore **NOT
  APPLIED**, and `dex/shareCard.ts` is unmodified by plan 21-13 — the plan's only permitted
  production edit stays unmade, as designed.

  ⚠ FINDING — THE CONTINGENCY FIX AS WRITTEN IS UNSAFE. Had the baseline clipped, the prescribed
  remedy would have introduced a worse defect. At `height * 0.97` the footer's ink top rises to
  1276.50 while the label's ink bottom sits at 1298.25 — a **21.75px overlap**, i.e. the two footer
  lines would collide. The label at `height * 0.955` is only 5.25px above the footer's ink top, so
  ANY upward nudge of the line alone eats that gap 1:1 and collides (even `0.98` overlaps by 8px).
  If a future device/font ever does clip, the correct remedies are: raise the label and the line
  TOGETHER, reduce the footer font size, or grow `CARD_HEIGHT` — never move the line alone.

  SCOPE LIMIT (recorded honestly): this measurement was taken on Windows, where the stack resolves
  to Segoe UI, not on iOS where it resolves to SF Pro. The clearance is positive but small (3.5px),
  so a face with a descent ratio above ~0.307em would still clip. Every common system sans sits
  well below that. The owner's device-side PASS (session #1, and re-affirmed session #2) covers the
  visual case; this measurement supplies the precision that eyeballing a phone screen cannot, and
  the two agree. Item (b) — the widest venue in the actual corpus specifically — remains attested
  rather than instrumented.

  ── SESSION #3: NO CHANGE, AND THE CONTINGENCY EDIT STAYS UNMADE (2026-08-05) ──────────────────

  Test 5 was CLOSED in session #2 and session #3 did not disturb it. Restated here so the closing
  plan's record is self-contained:

  - The D-37 descender question is answered BY MEASUREMENT (`+3.50px` clearance to the card's bottom
    edge, `evidence/descender-zoom.png`), not by eyeball. Nothing clips.
  - Therefore the conditional one-line nudge — both `centerText` footer draws in
    `packages/app/src/dex/shareCard.ts`, `height * 0.99` → `height * 0.97` — is **NOT APPLIED**.
    `shareCard.ts` is byte-unmodified by plan 21-13. The plan's only permitted production edit stays
    unmade, exactly as designed: the rule was "fix only if it clips", and it does not.
  - The measurement additionally established that the contingency fix AS WRITTEN IS UNSAFE (it would
    collide the two footer lines by 21.75px). Had this session applied it reflexively, it would have
    introduced a worse defect than the one it was meant to cure. Recorded above in full; repeated
    here because a future reader reaching for that nudge must not find it endorsed.

  REGRESSION GATE (`npm test`) — **GREEN, 2026-08-05, at the commit under test**:

      Test Files  134 passed (134)
      Tests      1135 passed (1135)

  Because no production edit was made, this run is a confirmation that the tree is green at the
  commit under test rather than a regression check on a fix — which is the outcome the plan
  anticipated for the no-clip branch.

### 6. Two devices on different builds, both directions (NAV-03, D-42)
expected: |
  Real Realtime with a MIXED token vocabulary; the failure mode is silent, and this project has
  learned twice (`260724-hqu` / `260724-lgo`) that a unit-proven realtime path is not a verified one.
  Mixed builds are the DESIGNED state under prompt-to-update SW, so this is not a contrived scenario.

  - Serve the PRE-rename build to device A and the POST-rename build to device B (see the
    "Serving two builds" sub-section under Harness below — two worktrees, two ports, two tunnels).
  - Sign in as TWO DIFFERENT identities, one per device, and put each device on a different tab.
  - Check the friend's activity label in BOTH directions:
    (a) on the OLD build, reading the NEW build's device — the new build may send a token vocabulary
        the old build does not fully know;
    (b) on the NEW build, reading the OLD build's device.
  - In both directions the label must be a correct, READABLE label — NEVER blank, NEVER a raw wire
    token (`LiveGizz`, `GizzDex`, …). An unrecognized token must resolve to the neutral fallback
    ("in the app" / the online dot with no place named), per D-41.
  - Switch tabs on each device several times and confirm the other side updates promptly (the
    `visibleEpoch` hidden→visible rejoin should reconcile after backgrounding).
  - Record which build each device ran and screenshot both friend rows.
result: |
  PENDING — partial credit only.

  The owner confirmed (2026-07-25) that presence/activity labels render correctly and readably on
  the POST-rename build: human copy, never blank, no raw wire token leaking through. That exercises
  the plan-21-03 `presenceActivityLabel` resolution and the D-41 `activityUnknown` constant on a
  SINGLE build.

  It does NOT satisfy NAV-03. This test's entire subject is the MIXED-build case — two devices on
  DIFFERENT app builds, checked in BOTH directions, where the new build emits a token vocabulary the
  old build has never seen. A same-build check cannot produce an unrecognized token, so the D-41
  fallback path is exactly the thing that stayed untested. The failure mode is silent, and this
  project has twice learned (`260724-hqu` / `260724-lgo`) that a unit-proven realtime path is not a
  verified one.

  Remains open for device session #2 (plan 21-13), which needs the two-worktree / two-tunnel harness
  described below.

### 7. Live paint order over a real toast (FOUND-03, D-29)
expected: |
  Needs a real compositor, so it is not automatable — but it IS a desktop-browser check and takes
  about 30 seconds. This is the repro that must NAME the offending surface before plan 21-11 acts
  (D-20).

  - In a desktop browser, load the app with `?layerRepro=1`. A persistent non-dismissable band
    reading "layerRepro: toast tier 20" appears at the bottom, occupying the `toast: 20` tier with
    the same geometry the shipped toasts use. It is deliberately NOT `pointer-events-none`.
  - Go to Show Mode (`#/show`) so the ShowView `zIndex: config.ui.z.content` (10) stacking context
    is live, and open the SearchSheet over the band.
  - Record: does the band paint OVER the sheet, or the sheet over the band? Then try to tap/click a
    part of the sheet that sits behind the band — does the band EAT the tap?
  - Repeat with the FabMenu open (D-27 — same root cause, and worse if it holds: a `toast: 20`
    painting over the FAB eats speed-dial taps MID-SHOW, hitting the live-logging loop).
  - Name the offending surface(s) explicitly in the result. A `z-index: 50` nested inside a stacking
    context of `10` losing to a top-level `20` is the predicted signature (D-20).
  - Also note the negative cases: any sheet-tier surface that already portals to `document.body`
    (anything on the shared `<Sheet>` primitive) should paint correctly OVER the band — that
    contrast is what proves the diagnosis is nesting, not tier numbering.
result: |
  RESOLVED BY STATIC ANALYSIS (2026-07-25, Claude) — browser repro NOT run (the Chrome extension
  was not connected). The offending surfaces are named below with spec-level certainty; the manual
  repro remains available for confirmation but is no longer a blocker on plan 21-11.

  OFFENDING SURFACES — `SearchSheet` and `FabMenu` (both scrim and speed-dial rows).

  Why, per CSS spec rather than observation. `ShowView.withBackground` (`ShowView.tsx:174-185`)
  wraps the show column in `className="relative ..."` + `style={{ zIndex: config.ui.z.content }}`.
  `position: relative` with a NON-auto `z-index` creates a stacking context by spec. Therefore
  every descendant's z-index is resolved WITHIN that context, and the whole subtree composites
  against the root at effective level 10.

  Both defective surfaces render inside `withBackground` (`ShowView.tsx:507,599,612`):
    - `SearchSheet`  — `zIndex: config.ui.z.sheet` (50)      → effective 10
    - `FabMenu`      — `zIndex: config.ui.z.fabScrim` (25)   → effective 10
                       `zIndex: config.ui.z.fab` (30)        → effective 10

  The toast family renders as SIBLINGS of `<AppShell>` in `App.tsx:128-130+` (InstallBanner,
  UpdateToast, BackupToast, WaveToast, BingoCelebration, and the `LayerReproToast` harness), so
  they sit in the ROOT stacking context at their literal tier — `toast: 20`.

  20 (root) > 10 (the whole ShowView subtree). A `sheet: 50` loses to a `toast: 20` at any number.
  This is D-20's predicted signature exactly: the tier numbers are consistent and the NESTING is
  not. Renumbering cannot fix it — 50 already loses — which is why the standing constraint
  ("write the invariant test, renumber nothing") is correct.

  Tap-eating follows from paint order: `LayerReproToast` is deliberately not `pointer-events-none`
  (`layerRepro.tsx:17-20`), so wherever it paints on top it also receives the events. The FabMenu
  case is the venue-relevant one (D-27) — a toast eating speed-dial taps mid-show.

  NEGATIVE CASE CONFIRMS THE DIAGNOSIS: `Sheet.tsx` is the ONLY `createPortal` site in the app
  (`Sheet.tsx:77,90` — verified by an exhaustive grep for `createPortal` across `packages/app/src`).
  Surfaces on the shared `<Sheet>` primitive escape to `document.body` and therefore composite in
  the root context at their literal tier, winning against `toast: 20` as designed. Same tier
  numbers, opposite outcome, decided purely by DOM position — which is what proves the cause is
  nesting rather than tier numbering.

  Plan 21-11's fix (portal `SearchSheet` and `FabMenu` to `document.body`, renumber nothing) is
  confirmed correct and is unblocked.

  CONFIDENCE / LIMITS: the paint-order conclusion is deductive from the CSS stacking-context rules
  plus verified source, so it is stronger than a one-off eyeball. It is NOT an observation — it
  assumes no other ancestor introduces a stacking context and no `isolation`/`transform`/`filter`
  intervenes. Plan 21-11's `layerOrder.test.tsx` ancestor-walk invariant is what should convert
  this from analysis into a permanent mechanical guarantee; run the `?layerRepro=1` repro
  opportunistically to confirm.

### 8. SearchSheet gesture suppression after portaling (FOUND-03, D-23)
expected: |
  Double-tap zoom and the long-press callout are device behaviors — not observable in jsdom or on a
  desktop browser.

  A portaled node loses ancestor-scoped CSS, including the `.orbit-stage` / `.fab-menu`
  gesture-suppression rules (`touch-action: manipulation`, `overscroll-behavior: none`,
  `-webkit-touch-callout: none`, `styles.css:27-35`) that SHOW-13 depends on. SearchSheet matters
  most: it is the one-thumb, in-the-dark surface, and losing double-tap-zoom / long-press-callout
  suppression there is a real venue regression.

  Run AFTER plan 21-11 portals the sheet. On the installed instance, inside the portaled SearchSheet:
  - Double-tap the sheet body and a result row — the page must NOT zoom.
  - Long-press a song title / result row — the iOS text-selection callout ("Copy / Look Up / Share")
    must NOT appear.
  - Drag past the ends of the result list — no rubber-band / overscroll chaining to the page behind.
  - Confirm Escape/close, focus trap, and focus restore to the trigger still behave (a portaled node
    also loses tree position for focus and Escape).
  - If any of these regress, the fix is to apply the needed classes DIRECTLY on the portaled root
    (D-23), not to revert the portal.
result: |
  PARTIAL — MECHANISM VERIFIED, iOS BEHAVIOUR STILL UNOBSERVED (session #2, 2026-07-26).

  Every link in the D-23 chain was verified against the SHIPPED build, not just the source. What
  this establishes is that the suppression rules genuinely reach the portaled roots. What it does
  NOT establish is that iOS then behaves — see the explicit non-claim at the bottom.

  1. PORTAL TARGETS. `SearchSheet.tsx:127` and `FabMenu.tsx:141` both `createPortal(…,
     document.body)`. FabMenu carries BOTH roots (scrim + speed-dial) in one portal, preserving
     their `fabScrim: 25 < fab: 30` order at top level.

  2. CLASS OPT-IN ON THE PORTALED ROOTS.
     - `SearchSheet.tsx:132` — portaled root is `class="gesture-guard fixed inset-0 …"`.
     - `FabMenu.tsx:150` (scrim) and `FabMenu.tsx:159` (speed-dial) — both `class="fab-menu …"`.
     `.fab-menu` was already in the suppression selector list pre-phase, so FabMenu needed no
     `.gesture-guard`; that is why it does not appear in a `gesture-guard` grep and is NOT a gap.

  3. THE RULE SURVIVED THE BUILD. Read out of the shipped stylesheet
     (`dist/assets/index-q2LLL2jB.css`), all five declarations are present and minified intact:
     `.orbit-stage,.action-bar,.fab-menu,.gesture-guard{touch-action:manipulation;
     overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}`
     Both WebKit-only properties (`-webkit-user-select`, `-webkit-touch-callout`) are in the
     artifact. NOTE for anyone re-running this: Chrome's CSSOM reports only three properties for
     this rule via `cssRules[].style.cssText`, because it drops WebKit-only properties it does not
     implement. That is a reporting artifact of the probing engine, NOT evidence of build
     stripping — confirm against the raw CSS text, as was done here.

  4. COMPUTED STYLES RESOLVE. Loaded the shipped stylesheet in a real engine (headless Chrome) and
     read `getComputedStyle` on elements carrying each class:

     | element                     | touch-action | overscroll-behavior | user-select |
     |-----------------------------|--------------|---------------------|-------------|
     | `.gesture-guard` (SearchSheet) | manipulation | none              | none        |
     | `.fab-menu` (FabMenu)          | manipulation | none              | none        |
     | control (unclassed)            | auto         | auto              | auto        |

     The control row is the anti-vacuity check: the rule is class-scoped and is NOT leaking to the
     rest of the app, which D-23 explicitly requires (Dex lists, Explore panels and Settings must
     keep normal selection and scrolling).

  5. STRUCTURAL INVARIANTS PASS. `layerOrder.test.tsx` + `sheet.a11y.test.tsx` — 40 tests green,
     including the named assertions "SearchSheet keeps its contract across the portal (D-21/D-23)",
     "D-23: styles.css applies the gesture-suppression block to .gesture-guard", and "FabMenu's
     RENDERED tiers still satisfy CR-01 after portaling (D-27)".

  6. DIALOG SEMANTICS. `SearchSheet.tsx:129-130` sets `role="dialog"` + `aria-modal="true"`, and
     the input at `:144` carries `autoFocus` — React applies `autoFocus` on mount regardless of
     portal target, so focus-on-open is structurally intact after the move.

  ⚠ EXPLICITLY NOT CLAIMED — these remain device-only and are the reason this test stays PARTIAL:
     - double-tap does not zoom the page (iOS gesture handling)
     - long-press does not raise the iOS callout / selection menu
     - drag does not pull-to-refresh or rubber-band the page behind the sheet
     - the input is actually focused with the iOS soft keyboard raised
     - VoiceOver focus lands INSIDE the dialog, not on the background
     Desktop Chrome has none of these behaviours, so no amount of headless probing substitutes.
     `touch-action`/`-webkit-touch-callout` being correctly applied is the CAUSE; the observation
     is the EFFECT, and this project has twice recorded (`260724-hqu`, `260724-lgo`) that a
     mechanism-proven path is not a verified one. Per-surface, per-behaviour observation on the
     installed instance is still owed for both `SearchSheet` and `FabMenu`.

  ── UPGRADED TO PASS BY DEVICE OBSERVATION (session #3, 2026-08-05) ────────────────────────────

  Every behaviour the block above explicitly declined to claim was observed on the installed
  standalone instance. iPhone 16 Pro, iOS 26.5.2, build `e847183`. Answered per surface, per
  behaviour — never summarised as "fine":

  | behaviour                                   | `SearchSheet` (portaled) | `FabMenu` (portaled) |
  |---------------------------------------------|--------------------------|----------------------|
  | double-tap does not zoom the page           | PASS                     | PASS                 |
  | long-press raises no iOS callout/selection  | PASS                     | PASS                 |
  | no pull-to-refresh / overscroll chaining    | PASS                     | not separately exercised |
  | opens with the input focused                | PASS                     | n/a (no text input)  |
  | Escape / close + focus restore to trigger   | PASS                     | PASS                 |

  NO REGRESSION FOUND on either surface. Nothing needed the D-23 remedy (applying the suppression
  classes directly on a portaled root); the classes that plan 21-11/21-12 already put there are
  doing the work, which is what the mechanism verification above predicted and what this run
  converts from cause into observed effect.

  ONE ITEM RECORDED SHORT, NOT PASSED: **VoiceOver focus** — that a screen-reader swipe lands INSIDE
  the dialog rather than on the background — was not exercised this session. The structural half is
  covered (`role="dialog"` + `aria-modal="true"` at `SearchSheet.tsx:129-130`, and the
  `sheet.a11y.test.tsx` suite is green), so this is an unobserved assertion rather than a suspected
  defect. It is the one strand of test 8 still resting on mechanism alone. Overscroll chaining on
  `FabMenu` is likewise unexercised, and is low-risk: the speed-dial is a short non-scrolling list.

  VERDICT: **PASS**, upgrading the session-#2 PARTIAL. The two residual strands above are named
  rather than folded into the pass, per the standing rule that a mechanism-proven path is not a
  verified one. Owner attestation; no screenshots captured this session.

## Harness

All device tests (1–6, 8) MUST be run on the owner's iPhone against the PRODUCTION build served over
an HTTPS cloudflared tunnel, installed to the home screen. Test 7 is a desktop-browser check and
needs none of this. A plain LAN HTTP origin will not register a service worker, and — decisively for
this phase — `env(safe-area-inset-bottom)` is `0` in a browser tab, so a non-installed run measures
nothing (D-14, 21-VALIDATION §Manual-Only row 1). The vite dev server over the tunnel is allowed for
informal bug-shaking only, never a recorded/graded run.

Setup (see MEMORY `device-uat-hosting`):

1. Build the production bundle:

       npm run build --workspace packages/app

2. Serve the built `dist/` on a fixed port (run in the background):

       npx vite preview --workspace packages/app -- --port 4173 --strictPort

3. Open an HTTPS quick tunnel to it. The `--http-host-header localhost` flag is MANDATORY — without
   it vite preview validates the `Host` header and returns 403 (run in the background):

       cloudflared tunnel --url http://localhost:4173 --http-host-header localhost

   (cloudflared is a downloaded release binary run manually — not a dependency added to the tree.)

4. Grab the `https://<random>.trycloudflare.com` URL from the tunnel output and smoke-test that `/`,
   `/sw.js` and `/manifest.webmanifest` all return 200 before touching the phone.

5. Open the URL on the iPhone and INSTALL the PWA to the home screen (Share → Add to Home Screen).
   Run every graded test from the installed standalone app, not a browser tab. Verify installation
   via the probe itself: `?layoutProbe=1` must report `standalone: nav=true`.

SW note (MEMORY `sw-clientsclaim-offline`): the service worker installs on first load and
`clientsClaim: true` lets it take control of the first session. The tunnel URL is ephemeral — it dies
when the preview/tunnel processes stop; tear both down when UAT ends. Because the SW is
prompt-to-update (`registerType: 'prompt'`), a rebuilt bundle will NOT auto-swap on the installed
app — accept the update toast, or delete and re-add the home-screen icon, before recording an AFTER
measurement.

Dev flags available on any build from plan 21-01 onward: `?layoutProbe=1` (test 1) and
`?layerRepro=1` (test 7). Both are inert unless the flag is explicitly `=1`.

### Serving two builds simultaneously (test 6 only)

Test 6 needs the PRE-rename build and the POST-rename build live at the same time, on two devices:

1. Check the pre-rename commit out into a SECOND worktree so the working tree is untouched:

       git worktree add ../guezzer-prerename <pre-rename-commit-sha>

   Use the last commit before plan 21-13's tab rename lands (`git log --oneline -- packages/app/src/components/BottomTabBar.tsx`).

2. Install and build in that worktree (npm workspaces — do NOT run pnpm/corepack):

       npm install
       npm run build --workspace packages/app

3. Serve it on a SECOND port:

       npx vite preview --workspace packages/app -- --port 4174 --strictPort

4. Open a SECOND cloudflared tunnel at that port, again with the mandatory host-header flag:

       cloudflared tunnel --url http://localhost:4174 --http-host-header localhost

5. Install the 4174 tunnel URL on device A (pre-rename) and the 4173 tunnel URL on device B
   (post-rename). Sign in as two different identities — one per device — so presence has two
   distinct users to report. Both tunnels reach the same Supabase project, so `gizz-room` presence
   crosses builds exactly as it would in the wild.

6. Tear down both tunnels, both preview servers, and `git worktree remove ../guezzer-prerename`
   when the test is done.

## Summary

total: 8
passed: 2
issues: 1
pending: 5
skipped: 0
blocked: 0

Session 1 (2026-07-25) — device pass on the installed instance, tunnel build `f7467d9`:

| Test | Result |
|------|--------|
| 1. Bottom gap (BEFORE) | ISSUE — reproduces; branch RESOLVED analytically (D-15 confirmed) |
| 3. Tab strip / Dynamic Type | PASS (max-text-size pass unconfirmed) |
| 5. Share-card footer | PASS (D-37 descender check unconfirmed) |
| 6. Mixed-build presence | PENDING — same-build labels good, mixed-build case untouched |
| 7. Layer paint order | RESOLVED by static analysis — SearchSheet + FabMenu named |
| 2, 4, 8 | Blocked on plans 21-10 / 21-11 |

Session 2 (2026-07-25) — static analysis, no device. Both plan-21-04 gates resolved from source:
test 1's branch (CONFIRMATION — the dead gap derives to exactly one safe-area inset) and test 7's
offending surfaces (SearchSheet + FabMenu, trapped in ShowView's `content: 10` stacking context).
Also surfaced a defect in the 21-01 `?layoutProbe=1` harness: its `GAP` formula measures a
constant and could never have discriminated the branches. See tests 1 and 7 for full derivations.

Also confirmed this session, outside the 8 numbered tests: **FOUND-04 full-date rendering** reads
correctly and consistently across all five call sites (ShowView header, ShowsList, SetlistView,
ArchiveBrowser, RecapView subline) with no off-by-one date shift — the real-device confirmation that
the plan-21-02/21-05 UTC-pinned `formatFullDate` holds outside jsdom.

Notes:
- All 8 carried verbatim from `21-VALIDATION.md` §Manual-Only Verifications; tests 1–6 also map to
  `21-UI-SPEC.md` §Device Verification.
- Test 1 is a BEFORE/AFTER pair — it is not closed until both halves exist for BOTH orientations
  (D-18). Its BEFORE half gates plan 21-07.
- Test 7 gates plan 21-11 and is the only desktop-browser item.
- Tests 2, 4 and 8 are AFTER-the-fix confirmations (plans 21-10 and 21-11 respectively) and cannot
  be run before those plans land.
- D-19 is now MOOT for test 1 — the gap reproduces, so FOUND-01 cannot be closed on a flush
  baseline and plan 21-07 must ship a real fix.

## Gaps

- truth: "On an installed home-screen PWA, body content sits flush against the top of the bottom tab
    bar with no dead gap (FOUND-01, success criterion 1)"
  status: failed
  reason: "User reported: there is a gap still — visible dead space between content and the tab bar
    on the installed instance."
  severity: major
  test: 1
  root_cause: "body's `padding-bottom: env(safe-area-inset-bottom)` (styles.css:220) shortens
    #root and therefore <main>'s box by S, while <main> ALSO reserves `4rem + env(sab)` of its own
    padding — so the inset is counted twice on the content side. The tab bar is `fixed bottom-0`
    and viewport-relative, so it ignores body padding entirely. Net dead gap = exactly one S.
    D-15 confirmed by derivation from source (see test 1 result for the full chain)."
  artifacts:
    - path: "packages/app/src/styles.css:220"
      issue: "body padding-bottom: env(safe-area-inset-bottom) — D-15's predicted double-count"
    - path: "packages/app/src/components/BottomTabBar.tsx:33-34"
      issue: "height calc(4rem + env(...)) AND paddingBottom env(...) — the second owner"
    - path: "packages/app/src/components/AppShell.tsx:75-77"
      issue: "main paddingBottom calc(4rem + env(...) + overlayInset) — the third owner"
  missing:
    - "Delete `padding-bottom: env(safe-area-inset-bottom)` from body (styles.css:220) as part of
       plan 21-07's single-owner conversion. The measurement gate is satisfied by derivation."
    - "FIX the ?layoutProbe=1 GAP formula before any D-18 before/after capture: it currently reads
       `tabTop - mainRect.bottom`, which includes main's padding and evaluates to a constant -4rem
       regardless of the inset. It must read `navTop - (mainRect.bottom - mainPaddingBottom)` to
       measure the actual dead space."
    - "On-device before/after record, portrait AND landscape, for success criterion 1's bookkeeping
       (plan 21-13) — owed to the requirement, not blocking development."
  debug_session: ""

- truth: "No surface can paint over an open modal sheet; any tier renumbering requires a repro
    naming the offending surface first (FOUND-03, success criterion 3, D-20)"
  status: diagnosed
  reason: "Static analysis (2026-07-25) — SearchSheet and FabMenu are trapped inside ShowView's
    `content: 10` stacking context and lose to root-level `toast: 20` siblings of AppShell."
  severity: major
  test: 7
  root_cause: "`ShowView.withBackground` (ShowView.tsx:174-185) sets `position: relative` plus a
    non-auto `zIndex: config.ui.z.content` (10), which creates a stacking context by CSS spec. Every
    descendant z-index resolves inside it, so the entire ShowView subtree composites at effective
    level 10 — including SearchSheet (sheet: 50) and FabMenu (fabScrim: 25 / fab: 30). The toast
    family renders as siblings of <AppShell> in App.tsx and keeps its literal `toast: 20` in the
    root context. 20 beats 10, so a 50 loses to a 20. Nesting, not tier numbering — D-20 confirmed."
  artifacts:
    - path: "packages/app/src/show/ShowView.tsx:174-185"
      issue: "relative + zIndex:content creates the trapping stacking context"
    - path: "packages/app/src/show/SearchSheet.tsx:99-100"
      issue: "sheet: 50 rendered inside the trap; not portaled"
    - path: "packages/app/src/show/FabMenu.tsx:120,129"
      issue: "fabScrim: 25 / fab: 30 inside the trap — D-27, eats speed-dial taps mid-show"
    - path: "packages/app/src/components/Sheet.tsx:77,90"
      issue: "NEGATIVE CASE — the only createPortal site in the app; these surfaces behave"
  missing:
    - "Portal SearchSheet and FabMenu (scrim + rows) to document.body — plan 21-11, renumber nothing."
    - "layerOrder.test.tsx ancestor-walk invariant to convert this analysis into a mechanical guard."
    - "Re-apply gesture-suppression classes on the portaled roots (D-23, test 8)."
  debug_session: ""
