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
  the served stylesheet. Device: [PENDING — owner to record model + iOS version, D-18].
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

  STILL OWED ON THIS TEST:
  - Device model + iOS version (D-18) — [PENDING — owner to record from Settings → General → About]
  - The "scroll the Me tab to the very bottom, confirm no content under the home indicator" check
    was not separately performed; the measurement above establishes the geometry but not the
    scrolled-to-end visual. [PENDING]
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
  PENDING

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
  PENDING

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
  PENDING

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
