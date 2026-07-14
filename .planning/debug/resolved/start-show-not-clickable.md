---
status: resolved
trigger: "Start Show button on the pre-show launcher (packages/app/src/show/PreShowLauncher.tsx) is not clickable/tappable on mobile at http://192.168.1.178:4173/. Strong hypothesis from static code read: InstallBanner (packages/app/src/components/InstallBanner.tsx) is a `fixed inset-x-0 bottom-16 z-10` element that renders whenever the app is not yet installed and not dismissed for the session — on iOS Safari it renders IosInstallInstructions (a heading + multi-step ordered list), which is likely taller than the pb-16 (4rem) bottom padding that <main> (AppShell.tsx) reserves for the BottomTabBar. Since InstallBanner is position:fixed and later in the DOM than <main>, it would visually and functionally overlay the vertically-centered Start Show button in PreShowLauncher.tsx whenever the banner's actual rendered height exceeds 4rem, intercepting the tap before it reaches the button underneath. User is very likely testing on iOS Safari (asked earlier about re-adding to home screen / installed PWA), on a fresh origin (LAN IP:port) where isInstalled would be false, so the banner is showing."
created: 2026-07-14T01:55:19Z
updated: 2026-07-14T03:40:00Z
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: REOPENED — overlay-inset fix (commit 7b866db) AND min-h-screen→h-full 100vh fix both applied and confirmed served on a fresh origin (port 4175, bundle index-Cge8_KjJ.js), yet the user STILL cannot tap Start Show on the iPhone. Desktop works. The banner-overlap theory may be wrong or incomplete; no on-device evidence has ever been captured. Candidates still open: (a) banner still genuinely covering the button despite both fixes, (b) tap reaches the button but startShow()'s Dexie/IndexedDB write fails silently on iOS (unhandledrejection — screen would stay on launcher with zero visual feedback, matching "nothing at all"), (c) some other element/stacking context intercepting.
test: deployed an INSTRUMENTED build (scratchpad diag-dist, served on port 4176, no service worker, Cache-Control no-store) with an on-screen diagnostic overlay that reports, for every tap in capture phase — event target, document.elementFromPoint at the tap coords, viewport vs visualViewport size — plus window.onerror and unhandledrejection text. User will tap Start Show and report what the red overlay shows.
expecting: (a) if elementAtPoint shows the InstallBanner region div instead of the button → overlap still real, fixes ineffective on iOS, need on-device geometry. (b) if target IS the button but nothing happens → the click handler fires and startShow() fails async; expect an UNHANDLED REJECTION line naming Dexie/IndexedDB. (c) if a different element entirely → new lead.
next_action: user loads http://192.168.1.178:4176 on the iPhone, taps Start Show, reports the red diagnostic box contents (plus whether bottom-tab buttons Explore/Dex respond).
reasoning_checkpoint:
  hypothesis: "InstallBanner is a `fixed inset-x-0 bottom-16 z-10` opaque block, later in the DOM than AppShell's `<main>`, rendered whenever `!isInstalled && !dismissed`. Both are true on a first-ever visit to a fresh LAN-IP origin in Safari (isInstalled reads standalone display-mode/navigator.standalone, both false in a normal tab; dismissed is a non-persisted useState(false), D-05 by design). Its real content — heading + 3-step iOS instructions list + a min-h-11 dismiss button, inside py-4 padding — renders well over the 64px (pb-16) AppShell reserves for the BottomTabBar, so the banner physically covers whatever `<main>` content sits in that band. PreShowLauncher centers its heading/body/Start-Show-button vertically in the remaining viewport height via `flex-1 items-center justify-center`, which commonly lands in exactly that lower band on typical phone viewports — so the banner both visually covers and functionally intercepts the tap (it's a normal opaque, non-pointer-events-none div)."
  confirming_evidence:
    - "useInstallState.ts: `isInstalled: isStandalone()` and `dismissed` is `useState(false)` — never persisted/hydrated, so both read false-showing on first load of a never-visited origin, exactly the user's reported reproduction (fresh LAN IP:port, never installed from this host:port)."
    - "config.ts copy.iosInstall: heading 'Add Guezzer to your Home Screen' + 3 steps ('Tap the Share button', 'Choose Add to Home Screen', 'Tap Add') — real, non-trivial rendered content, not a one-liner."
    - "InstallBanner.tsx / UpdateToast.tsx both render `fixed inset-x-0 bottom-16 z-10 ... py-4` — an opaque `bg-elevated` block with no `pointer-events-none`, so any tap landing in its rect is captured by the banner, not whatever is underneath."
    - "AppShell.tsx `<main>` had only a single static `pb-16` (64px) class — sized to match BottomTabBar, with no accounting anywhere for InstallBanner or UpdateToast, both of which stack directly above the tab bar at the exact same `bottom-16` offset."
    - "PreShowLauncher.tsx (the default view — useHashRoute() normalizes empty/invalid hash to 'show', and ShowView renders PreShowLauncher whenever `!session.active`, i.e. on every fresh session) centers its Start Show button via `flex-1 flex-col items-center justify-center` — position depends on viewport height, commonly landing in the lower-middle of a phone screen, i.e. inside the banner's overlap band."
  falsification_test: "If isInstalled had read true (already standalone) or dismissed had defaulted true, the banner would never show and this hypothesis would be wrong — investigation would have pivoted to a JS error, Dexie open failure, or a genuine touch-event bug in the button itself. Neither was the case."
  fix_rationale: "Rather than hand-picking a new fixed pb-* guess (which just relocates the same class of bug to the next copy/locale/font-size change), added a small shared store (packages/app/src/pwa/bottomOverlayInset.ts): InstallBanner and UpdateToast measure their own real rendered height via ResizeObserver and register it; AppShell subscribes and sets `<main>`'s padding-bottom to `calc(4rem + {registered}px)`. The reserved space now always matches whatever is actually on screen, so this class of overlap bug cannot recur regardless of banner content changes."
  blind_spots: "jsdom (the test environment) never lays out real DOM, so `offsetHeight` is always 0 in unit tests — the new tests validate the store/wiring logic (registration, summation, AppShell reactivity) but cannot themselves prove the on-device pixel overlap is gone. That final confirmation needs the user to reload on their actual phone."
tdd_checkpoint: null

## Symptoms
<!-- Written during gathering, then immutable -->

expected: Tapping "Start Show" on the pre-show launcher (packages/app/src/show/PreShowLauncher.tsx) should call startShow() and transition into the active show / orbit view.
actual: User reports they cannot click/tap the Start Show button at all when visiting http://192.168.1.178:4173/ on their phone.
errors: None reported yet — user has not been asked to check the mobile browser console.
reproduction: Open http://192.168.1.178:4173/ on a phone (LAN, fresh origin, app not previously installed from this exact host:port) and attempt to tap the "Start Show" button on the pre-show launcher screen.
started: First noticed just now during phase-5 human-UAT manual verification (2026-07-14), immediately after fixing the unrelated stale-dist/SyncDot bug and restarting the preview server bound to LAN.

## Eliminated
<!-- APPEND only - prevents re-investigating after /clear -->

- hypothesis: InstallBanner overlap is what blocks the Start Show tap (the banner covering the button and intercepting the touch)
  evidence: instrumented on-device build showed the tap's event target WAS the button (click handler fired, produced an unhandled rejection from startShow) — the touch was never intercepted. The overlay-inset accounting fix (7b866db) is a real latent defect and stays, but it was not this bug.
  timestamp: 2026-07-14T03:05:00Z
- hypothesis: iOS 100vh (min-h-screen) forcing the layout taller than the visible viewport, pushing the centered button under the banner
  evidence: min-h-screen removed, confirmed absent from the served bundle on a fresh origin (port 4175) — symptom unchanged. Kept as a correctness improvement, but not this bug.
  timestamp: 2026-07-14T02:50:00Z

## Evidence
<!-- APPEND only - facts discovered during investigation -->

- timestamp: 2026-07-14T01:50:00Z
  checked: packages/app/src/components/AppShell.tsx
  found: '<main>' reserves only `pb-16` (4rem / 64px) bottom padding, sized to match the fixed `BottomTabBar` (`fixed bottom-0`). No additional padding accounts for any other fixed bottom overlay.
  implication: any other fixed-bottom element taller than 64px will overlap page content that AppShell assumes is clear.
- timestamp: 2026-07-14T01:50:00Z
  checked: packages/app/src/components/InstallBanner.tsx
  found: 'fixed inset-x-0 bottom-16 z-10' (positioned directly above the BottomTabBar, not accounted for by <main>'s pb-16), renders IosInstallInstructions (heading + ordered list of steps) when isIos is true and not isInstalled/dismissed. No pointer-events:none or transparent-to-clicks styling — a normal opaque `bg-elevated` block.
  implication: on iOS, when shown, this banner's height depends on the iosInstall.steps copy and could easily exceed 64px, overlapping whatever <main> content sits in that vertical band and intercepting taps there.
- timestamp: 2026-07-14T01:50:00Z
  checked: packages/app/src/show/PreShowLauncher.tsx
  found: Start Show button + heading/body are centered via `flex-1 flex-col items-center justify-center` inside <main> — vertical position depends on viewport height and content height, commonly landing in the lower-middle/lower portion of a typical phone viewport.
  implication: plausible for the button's tap target to fall within the InstallBanner's overlapping region on common phone screen sizes.
- timestamp: 2026-07-14T02:05:00Z
  checked: packages/app/src/pwa/install/useInstallState.ts (full file)
  found: "`isInstalled: isStandalone()` (display-mode:standalone or navigator.standalone, both false in a normal Safari tab) and `dismissed` is a plain `useState(false)`, deliberately never persisted (comment cites D-05: banner must re-show next launch until actually installed)."
  implication: on the user's exact repro (fresh LAN-IP origin, normal Safari tab, never installed), both gate conditions read false → banner renders unconditionally on first load. Hypothesis's precondition confirmed, not falsified.
- timestamp: 2026-07-14T02:05:00Z
  checked: packages/app/src/pwa/install/platform.ts (isIosSafari/isStandalone), packages/app/src/config.ts copy.iosInstall/copy.installBanner
  found: iosInstall.heading + 3 real steps ('Tap the Share button', 'Choose Add to Home Screen', 'Tap Add'); installBanner wrapper adds its own heading/py-4/dismiss-button chrome around IosInstallInstructions when isIos.
  implication: real rendered content is substantial (heading + 3-item list + button row inside py-4 padding) — comfortably exceeds the 64px AppShell reserves; hypothesis confirmed on content grounds without needing an on-device pixel measurement.
- timestamp: 2026-07-14T02:05:00Z
  checked: packages/app/src/App.tsx, packages/app/src/show/ShowView.tsx, packages/app/src/routing/useHashRoute.ts, packages/app/src/components/UpdateToast.tsx
  found: "useHashRoute() normalizes empty/unknown hash to 'show' (the default/first view); ShowView renders `<PreShowLauncher />` whenever `!session.active`, i.e. on every fresh session — so PreShowLauncher is exactly what a first-time visitor sees. InstallBanner and UpdateToast are both rendered as AppShell's siblings in App.tsx (after `</AppShell>`), both `fixed inset-x-0 bottom-16 z-10` — the identical unaccounted-for-overlay bug class exists in UpdateToast too (currently short single-line text, so less likely to overflow 64px today, but with zero margin and the same root defect)."
  implication: confirms PreShowLauncher is the exact screen a fresh visitor lands on (matches reproduction), and surfaces that the fix needs to generalize to any fixed-bottom overlay, not just InstallBanner, to actually close the root cause rather than patch one symptom.
- timestamp: 2026-07-14T02:15:00Z
  checked: implemented fix — created packages/app/src/pwa/bottomOverlayInset.ts (shared external store: `setBottomOverlayHeight`/`useBottomOverlayInset`/`useBottomOverlayHeightRegistration`, ResizeObserver-based); wired InstallBanner.tsx and UpdateToast.tsx to register their own measured height via a ref on their root div; wired AppShell.tsx's `<main>` to `style={{ paddingBottom: "calc(4rem + ${overlayInset}px)" }}` instead of the static `pb-16` class.
  found: clean, minimal diff; base BottomTabBar reservation (4rem) untouched/unaffected (not implicated in this bug); registration always unregisters (height→0) on hide/unmount so dismissing the banner shrinks `<main>`'s reservation back down live.
  implication: <main> content — including PreShowLauncher's Start Show button — can no longer be covered by InstallBanner/UpdateToast regardless of their real content length, locale, or font-size, closing the root architectural gap rather than just bumping a magic number.
- timestamp: 2026-07-14T02:20:00Z
  checked: ran `npm test` (root, `vitest run` across @guezzer/core + @guezzer/app projects) and `npx tsc --noEmit -p packages/app/tsconfig.json`, plus `npx vite build` in packages/app
  found: "278/278 tests pass (37 test files), including 7 new tests in packages/app/test/bottomOverlayInset.test.tsx (store unit tests + AppShell reservation reactivity tests, using a mocked overlay height of 220px to model InstallBanner's iOS-instructions branch). `tsc --noEmit` exits 0 with no errors. `vite build` succeeds (pre-existing >500kB chunk-size warning only, unrelated to this change)."
  implication: fix is structurally sound and does not regress any existing behavior; the one thing unit tests structurally cannot prove (jsdom never lays out real DOM, offsetHeight is always 0) is the actual on-device pixel overlap being gone — needs the user's phone to confirm fully.
- timestamp: 2026-07-14T02:50:00Z
  checked: on-device retest after BOTH fixes — overlay-inset store (commit 7b866db) AND the min-h-screen (100vh) removal from AppShell — served from a brand-new origin (port 4175) confirmed to carry bundle index-Cge8_KjJ.js with min-h-screen absent
  found: "User answered structured questions: (1) tapping Start Show does NOTHING at all — no highlight, no reaction; (2) the 'Add Guezzer to your Home Screen' banner with numbered steps IS visible above the tab bar; (3) the Start Show button sits LOW on the screen, near the bottom clutter. Desktop (same bundle) works fine."
  implication: both applied fixes failed to change the observed on-device behavior. Either the overlay-inset registration isn't actually lifting the centered content on real iOS (geometry differs from the model), or the overlap theory itself is wrong/incomplete (e.g. tap lands on the button but startShow()'s async Dexie write fails silently — also renders as 'nothing at all'). No on-device evidence has been captured yet; static reasoning has now mispredicted twice — instrumentation required.
- timestamp: 2026-07-14T02:55:00Z
  checked: built and deployed an instrumented diagnostic build — copied packages/app/dist to scratchpad/diag-dist, injected a capture-phase tap reporter (event target + document.elementFromPoint + viewport/visualViewport sizes rendered into a fixed on-screen box) plus window.onerror/unhandledrejection reporters into index.html, deleted sw.js, served via a no-store static server on port 4176
  found: server up; page serves bundle index-Cge8_KjJ.js with 4 diag markers present; sw.js 404s as intended
  implication: next evidence will be ground truth from the device itself — which element actually receives the tap at the button's coordinates, and whether any JS error/rejection fires — replacing two rounds of failed static inference.
- timestamp: 2026-07-14T03:05:00Z
  checked: user tapped Start Show on the instrumented build (iPhone, http://192.168.1.178:4176)
  found: "red box reported: [diag] UNHANDLED REJECTION @http://192.168.1.178:4176/assets/index-Cge8_KjJ.js:11:91143 — i.e. the tap DID reach the button and the click handler fired; startShow() rejected asynchronously."
  implication: overlap theory dead — this is failure mode (b), a silent async crash inside startShow(). The `void startShow()` onClick swallows the rejection with zero UI feedback, which is why it read as 'button not clickable'.
- timestamp: 2026-07-14T03:08:00Z
  checked: extracted bundle line 11 around column 91143 from dist/assets/index-Cge8_KjJ.js
  found: "the exact rejection column lands on `sessionId:crypto.randomUUID()` inside startShow()'s TrackedShow construction. crypto.randomUUID is a SECURE-CONTEXT-ONLY API — undefined on plain-HTTP LAN origins (http://192.168.1.178:PORT), present on http://localhost (localhost counts as secure)."
  implication: ROOT CAUSE. TypeError('crypto.randomUUID is not a function') → Dexie transaction rejects → no trackedShows row → launcher stays put with no feedback. Explains every observation — desktop-localhost works, phone-LAN fails, all other buttons work (only startShow mints a UUID), 'nothing at all' on tap, and why two layout fixes changed nothing.
- timestamp: 2026-07-14T03:12:00Z
  checked: grepped source for other randomUUID call sites and for other secure-context-only APIs that could break LAN testing (navigator.storage.persist, serviceWorker, wake lock)
  found: "db.ts:246 was the ONLY randomUUID call site. persist.ts wraps storage.persist in never-throw guards; wakeLock.ts feature-detects; SW registration simply doesn't happen on insecure origins (degrades gracefully). Only randomUUID crashed."
  implication: single fix suffices — a uuid helper with a crypto.getRandomValues-based v4 fallback (getRandomValues IS available in insecure contexts, incl. iOS Safari).

## Resolution
<!-- OVERWRITE as understanding evolves -->
<!-- REOPENED 2026-07-14T02:50Z: the fix below did NOT resolve the symptom on
     the actual device (fresh origin, correct bundle). Root cause below is now
     UNCONFIRMED-AS-COMPLETE — the overlay accounting was a real latent defect
     and stays fixed, but it evidently wasn't (all of) what blocks the tap.
     Awaiting instrumented-build evidence from port 4176. -->

root_cause: >
  crypto.randomUUID() is a SECURE-CONTEXT-ONLY API. startShow() (db.ts:246,
  the only call site) minted its sessionId with it. On the standard on-device
  testing path — a plain-HTTP LAN origin like http://192.168.1.178:PORT —
  crypto.randomUUID is undefined, so the call threw TypeError inside the
  Dexie 'rw' transaction, the trackedShows row was never written, and the
  Start Show tap silently did nothing (the onClick's 'void startShow()'
  swallows the rejection with zero UI feedback). Desktop always worked
  because http://localhost counts as a secure context. Pinpointed by an
  instrumented on-device build whose unhandledrejection line:col
  (index-Cge8_KjJ.js:11:91143) landed exactly on the crypto.randomUUID()
  expression in the bundle. Two earlier layout hypotheses (InstallBanner
  overlap; iOS 100vh min-h-screen) were real latent defects — both fixed and
  kept — but neither was this bug.
fix: >
  Added packages/app/src/uuid.ts: randomUUID() prefers native
  crypto.randomUUID when present, else derives a spec-compliant v4 UUID from
  crypto.getRandomValues (available in insecure contexts everywhere, incl.
  iOS Safari) with correct version/variant bits. startShow() now mints
  sessionIds through it (db.ts). Committed as d25a047; the earlier overlay
  fixes remain (7b866db + the min-h-screen removal).
verification: >
  Self-verified: 3 new tests in packages/app/test/uuid.test.ts (native path
  preferred; fallback matches the v4 shape incl. version nibble 4 and RFC
  4122 variant; 100 fallback calls all unique) — full suite 281/281 green,
  tsc --noEmit clean, vite build succeeds; rebuilt bundle
  (index-BAscnPb1.js) confirmed served on the instrumented no-store port
  4176 with the getRandomValues fallback present. User CONFIRMED on-device 2026-07-14: Start Show works on the iPhone, and the SyncDot flips to the hollow outline in airplane mode.
files_changed:
  - packages/app/src/uuid.ts (new)
  - packages/app/src/db/db.ts
  - packages/app/test/uuid.test.ts (new)
  - packages/app/src/pwa/bottomOverlayInset.ts (earlier round, kept)
  - packages/app/src/components/AppShell.tsx (earlier rounds, kept)
  - packages/app/src/components/InstallBanner.tsx (earlier round, kept)
  - packages/app/src/components/UpdateToast.tsx (earlier round, kept)
