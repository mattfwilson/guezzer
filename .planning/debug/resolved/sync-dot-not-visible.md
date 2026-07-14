---
status: resolved
trigger: "SyncDot status indicator not visible on Show screen despite being rendered in ShowView.tsx (packages/app/src/show/ShowView.tsx:288) next to the tally. User confirmed they have an active show started and cleared site data / unregistered service worker / hard-reloaded, and still does not see the 8px online/offline indicator dot in the show sub-header row."
created: 2026-07-14T00:40:22Z
updated: 2026-07-14T01:40:00Z
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: CONFIRMED — packages/app/dist was a stale build produced before SyncDot was wired into ShowView; user tested against dist that never contained the dot's code
test: rebuilt `npm run build` and grepped dist/assets/*.js for the SyncDot aria-label string "Sync: online" before and after rebuild
expecting: stale dist (pre-rebuild) has no match; fresh dist (post-rebuild) has a match
next_action: none — root cause confirmed, fix applied (rebuild), proceed to human verification of preview server
reasoning_checkpoint:
  hypothesis: "The dist/ the user served via `npm run preview` was built on 2026-07-11 15:41, before commit b114445 (2026-07-13) wired SyncDot into ShowView.tsx — so the served bundle never contained the SyncDot component at all, regardless of cache-clearing."
  confirming_evidence:
    - "dist/assets/index-_E_F2pDd.js (old) mtime 2026-07-11 15:41; source files SyncDot.tsx/ShowView.tsx mtime 2026-07-13 18:04 — dist predates the feature."
    - "grep for the literal string 'Sync: online' (SyncDot's aria-label, unique and unminified-friendly) in the OLD dist JS returned no match (exit code 1)."
    - "After running `npm run build` fresh, grep for 'Sync: online' in the NEW dist JS (index-C88U674Y.js) found a match."
    - "SyncDot.tsx and ShowView.tsx source code both read correctly on inspection — no conditional, CSS, or config bug that would hide the dot when it IS mounted (config.ui.SYNC_DOT_DIAMETER=8, MUTED color high-contrast against elevated bg, no display:none/visually-hidden CSS rule targeting [role=status] anywhere in styles.css)."
  falsification_test: "If the OLD dist's JS bundle had contained the 'Sync: online' string, that would disprove staleness as the cause and point back to a runtime/CSS bug in the mounted component."
  fix_rationale: "The fix is not a code change — it's rebuilding: `npm run build` regenerates dist/ from current source, which now includes SyncDot. No source defect exists; the bug was an out-of-date build artifact being served by `npm run preview`."
  blind_spots: "Haven't watched the user's actual terminal session to confirm they ran `npm run preview` against this exact same dist/ folder (vs. a different stale copy) — inferring from the reproduction steps and dist mtime alone. Have not ruled out that the user's local dist folder differs from the one in this workspace, though the debug session's own recorded reproduction steps point at the same packages/app directory."
tdd_checkpoint: null

## Symptoms
<!-- Written during gathering, then immutable -->

expected: After tapping "Start Show" and reaching the active Show screen, an 8px status dot renders in the sub-header row (date on far left, dot + tally + End Show button on the right), filled light-gray (#A1A1AA) when online, hollow ring when offline. Confirmed present in source: `<SyncDot online={online} />` at packages/app/src/show/ShowView.tsx:288, inside the header block rendered unconditionally once `session.active` exists and `session.matrixOk` is true (i.e. renders even before an opener song is picked).
actual: User does not see the dot on the Show screen at all, even after: (1) DevTools Application tab → unregister service worker, (2) clear site data, (3) hard reload (Ctrl+Shift+R).
errors: None reported yet — not yet asked whether browser console shows any errors.
reproduction: `cd packages/app && npm run build && npm run preview` (per vite.config.ts comment, PWA/SW behavior must be tested against build+preview, not `vite dev`), open http://localhost:4173, tap Start Show, look at the sub-header row next to the date/tally.
started: First noticed during phase-5 human-UAT manual verification (2026-07-13/14) — unknown whether this ever worked, since automated tests only exercise this via jsdom (no visual/CSS verification) and no prior manual verification of the Show screen SyncDot has been recorded.

## Eliminated
<!-- APPEND only - prevents re-investigating after /clear -->

## Evidence
<!-- APPEND only - facts discovered during investigation -->

- timestamp: 2026-07-14T00:35:00Z
  checked: packages/app/src/show/ShowView.tsx lines 275-310 (JSX return, header block)
  found: SyncDot is rendered unconditionally in the header row as soon as `session.active` is truthy and `session.matrixOk` is true — no additional conditional wraps it. Sits between the date span and the TallyReadout/End-Show button group.
  implication: no obvious JSX-level conditional bug from static read alone; need to check runtime DOM / whether user's build actually matches current source.
- timestamp: 2026-07-14T00:35:00Z
  checked: packages/app/src/live/SyncDot.tsx full file
  found: renders a `<span role="status" aria-label=...>` with inline style width/height = config.ui.SYNC_DOT_DIAMETER (8px), backgroundColor MUTED (#A1A1AA) when online, transparent + inset box-shadow ring when offline. No hidden/display:none logic.
  implication: component itself has no bug that would make it invisible when online is true, assuming it mounts.
- timestamp: 2026-07-14T00:35:00Z
  checked: packages/app/src/styles.css color tokens
  found: --color-elevated is #17171F (near-black), --color-text-muted is #A1A1AA (mid-gray) — high contrast, not a subtlety/contrast issue.
  implication: rules out low-contrast-blends-into-background as an explanation.
- timestamp: 2026-07-14T01:05:00Z
  checked: packages/app/src/show/ShowView.tsx full file (imports, hooks, header JSX at lines 275-302), packages/app/src/config.ts (ui.SYNC_DOT_DIAMETER), packages/app/src/live/useOnlineStatus.ts
  found: SyncDot is imported and mounted unconditionally in the header row (line 288), config.ui.SYNC_DOT_DIAMETER = 8 (valid, non-zero), useOnlineStatus returns a plain boolean via useSyncExternalStore with no logic that could produce a non-boolean/undefined. Grepped whole app src for "role=\"status\"", "[role=", "sr-only", "visually-hidden", "clip-path" — no global CSS rule anywhere hides [role=status] elements; only other role="status" usage is UpdateToast.tsx (unrelated, not visually hidden either).
  implication: source code path is correct end-to-end — no JSX conditional bug, no CSS visibility bug, no config bug. The defect must be environmental, not in the source.
- timestamp: 2026-07-14T01:10:00Z
  checked: packages/app/dist/assets/*.js mtime vs packages/app/src/live/SyncDot.tsx and src/show/ShowView.tsx mtime; also `git log --oneline -- SyncDot.tsx ShowView.tsx`
  found: dist/assets/index-_E_F2pDd.js and index-Dx6Q5J4x.css were last built 2026-07-11 15:41. SyncDot.tsx and ShowView.tsx source mtimes are 2026-07-13 18:04:56, matching commit b114445 "feat(05-04): wire poll + strip + dot + adopt/bind into ShowView" (2026-07-13) — two days AFTER the last build. Grepped the OLD dist JS bundle for the literal string "Sync: online" (SyncDot's unique aria-label) — no match (grep exit code 1).
  implication: the dist/ folder the user served via `npm run preview` predates the feature entirely — it was built before SyncDot existed in the source tree. Clearing site data / unregistering SW / hard-reloading cannot surface code that was never in the served bundle. This is the root cause.
- timestamp: 2026-07-14T01:12:00Z
  checked: ran `npm run build` fresh in packages/app, then grepped the new dist/assets/index-C88U674Y.js for "Sync: online"
  found: fresh build succeeded (vite build + vite-plugin-pwa regenerated sw.js/workbox-2fbc6a65.js), and the new JS bundle DOES contain the "Sync: online" string (grep match confirmed).
  implication: confirms the fix — a fresh build now includes the SyncDot code. No source change was needed.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: >
  No source-code defect. The `packages/app/dist/` bundle the user served via
  `npm run preview` was built on 2026-07-11 (before SyncDot existed in the
  codebase). SyncDot was wired into ShowView.tsx on 2026-07-13 in commit
  b114445 — two days after that build. The user's cache-clearing steps
  (unregister SW, clear site data, hard reload) correctly cleared the
  browser's cache of the OLD bundle, but `npm run preview` kept re-serving
  the same stale `dist/` folder on disk, which never contained the SyncDot
  component in the first place, so no amount of client-side cache-busting
  could reveal it.
fix: >
  Ran `npm run build` in packages/app to regenerate dist/ from current
  source. No source code changed — this is a build-freshness issue, not a
  logic bug. Verified the new bundle (dist/assets/index-C88U674Y.js)
  contains the SyncDot aria-label string "Sync: online", confirming the
  component is now present in the served build.
verification: >
  Self-verified: (1) grepped OLD dist JS for the SyncDot aria-label string —
  no match, confirming staleness. (2) ran fresh `npm run build`. (3) grepped
  NEW dist JS for the same string — match found, confirming the rebuilt
  bundle includes SyncDot. (4) User confirmed 2026-07-14: reloaded against
  the fresh dist via `npm run preview` and the dot is now visible.
files_changed: []
