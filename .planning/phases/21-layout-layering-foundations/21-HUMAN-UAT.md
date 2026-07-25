---
status: pending
phase: 21-layout-layering-foundations
source: [21-VALIDATION.md, 21-UI-SPEC.md]
started: 2026-07-25T01:16:45Z
updated: 2026-07-25T01:16:45Z
---

## Current Test

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
  PENDING

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
  PENDING

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
  PENDING

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
  PENDING

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
  PENDING

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
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

Notes:
- All 8 carried verbatim from `21-VALIDATION.md` §Manual-Only Verifications; tests 1–6 also map to
  `21-UI-SPEC.md` §Device Verification.
- Test 1 is a BEFORE/AFTER pair — it is not closed until both halves exist for BOTH orientations
  (D-18). Its BEFORE half gates plan 21-07.
- Test 7 gates plan 21-11 and is the only desktop-browser item.
- Tests 2, 4 and 8 are AFTER-the-fix confirmations (plans 21-10 and 21-11 respectively) and cannot
  be run before those plans land.
- D-19 stands over test 1: a non-reproduction still satisfies FOUND-01.

## Gaps

- None recorded yet — no test has been run.
