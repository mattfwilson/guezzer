---
phase: 03-app-shell-pwa-foundation
plan: 03
subsystem: ui
tags: [vite-plugin-pwa, service-worker, react, workbox, pwa-update-flow]

# Dependency graph
requires:
  - phase: 03-app-shell-pwa-foundation
    provides: "Plan 01's App.tsx composition root + commented UpdateToast mount seam, config.ts copy (updateToast/versionStampFormat/UPDATE_CHECK_MS), vite-env.d.ts ambient __APP_VERSION__/__GIT_SHA__/__BUILD_DATE__ declarations, vite.config.ts define block; Plan 02's AppMenu.tsx with the commented version-stamp slot"
provides:
  - "useRegisterSW.ts wrapper over virtual:pwa-register/react with an hourly, navigator.onLine-guarded waiting-SW check"
  - "UpdateToast: non-blocking role=\"status\" toast that surfaces a waiting service worker; Refresh is the ONLY code path that ever calls updateServiceWorker(true) (skipWaiting + reload); Later dismisses without applying"
  - "VersionStamp: build-time v<version> · <sha> · built <date> stamp rendered from Vite define constants, no runtime fetch"
  - "AppMenu now renders the real version stamp in place of Plan 02's commented slot"
affects: ["Phase 4 (Show Mode) — inherits an app shell where updates never swap mid-session without a user tap", "Any future phase debugging a friend-reported bug via the visible version stamp"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SW-lifecycle hooks live under src/pwa/ as thin wrappers over vite-plugin-pwa's virtual modules — useRegisterSW.ts wraps virtual:pwa-register/react exactly once; UI components never import the virtual module directly"
    - "Build-time-only globals (__APP_VERSION__/__GIT_SHA__/__BUILD_DATE__) are consumed as plain JSX text expressions, never assigned to innerHTML; component tests stub them via vi.stubGlobal since the Vitest app project has no `define` config of its own"

key-files:
  created:
    - packages/app/src/pwa/useRegisterSW.ts
    - packages/app/src/components/UpdateToast.tsx
    - packages/app/src/components/VersionStamp.tsx
    - packages/app/test/version.test.tsx
  modified:
    - packages/app/src/App.tsx
    - packages/app/src/components/AppMenu.tsx

key-decisions:
  - "VersionStamp splits the SHA into a nested <span className=\"tabular-nums\"> rather than applying tabular-nums to the whole stamp, per UI-SPEC's explicit 'tabular-nums treatment for the SHA segment' — the component test asserts on container.textContent (not getByText) specifically because RTL's default getByText node-text matcher only reads direct text-node children, which would miss text split across a nested element"
  - "UpdateToast and InstallBanner share the same fixed inset-x-0 bottom-16 positioning and motion-safe:transition-all treatment for visual consistency as the two toast/banner surfaces stacked above the tab bar"

patterns-established:
  - "Pattern: PWA lifecycle hooks (useRegisterSW, and by extension useInstallState from Plan 02) live under src/pwa/, are the single point of virtual-module/browser-API contact, and are consumed by exactly one primary UI component each"

requirements-completed: [PWA-02]

# Metrics
duration: 35min
completed: 2026-07-09
---

# Phase 3 Plan 3: Update Prompt & Version Stamp Summary

**Prompt-based service-worker update flow (`useRegisterSW` wrapper + `UpdateToast`, Refresh-only `skipWaiting`+reload) and a build-time `v<version> · <sha> · built <date>` version stamp wired into `AppMenu`, both covered by automated tests.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified/created:** 6 (4 new, 2 modified)

## Accomplishments
- `useRegisterSW.ts` wraps `virtual:pwa-register/react`, adding an hourly `navigator.onLine`-guarded `r.update()` check (`config.UPDATE_CHECK_MS`) and console-only `onRegisterError` logging
- `UpdateToast` renders nothing until a SW is waiting, then shows a non-blocking `role="status"` toast above the tab bar; Refresh is the sole caller of `updateServiceWorker(true)` (skipWaiting + reload — the concrete "never swaps mid-show" mechanism, D-06); Later dismisses without applying
- Mounted `<UpdateToast/>` in `App.tsx` at the Plan-01 seam, alongside the existing `InstallBanner`/`AppMenu`
- `VersionStamp` renders the exact `v<pkgVersion> · <sha> · built <date>` string from build-time `__APP_VERSION__`/`__GIT_SHA__`/`__BUILD_DATE__` `define` constants (D-07) — no runtime fetch, works offline — and is now rendered inside `AppMenu` in place of Plan 02's commented slot
- `packages/app/test/version.test.tsx` stubs the three globals and asserts the rendered stamp via `container.textContent`
- `npm test` — 115/115 tests pass (114 prior + 1 new); `npm run build -w @guezzer/app` succeeds and the real short git SHA (`58e97fa`) is present in the emitted bundle; `tsc --noEmit` on the app package is clean

## Task Commits

Each task was committed atomically:

1. **Task 1: useRegisterSW wrapper + UpdateToast + mount in App** - `58e97fa` (feat)
2. **Task 2: VersionStamp component + placement in AppMenu + component test** - `a437181` (feat)

## Files Created/Modified
- `packages/app/src/pwa/useRegisterSW.ts` - thin wrapper over `virtual:pwa-register/react`'s `useRegisterSW`, hourly online-guarded `r.update()`, `onRegisterError` console logging
- `packages/app/src/components/UpdateToast.tsx` - non-blocking waiting-SW toast; Refresh calls `updateServiceWorker(true)`, Later dismisses
- `packages/app/src/components/VersionStamp.tsx` - `v{__APP_VERSION__} · {__GIT_SHA__} · built {__BUILD_DATE__}` at Label size, text-muted, SHA in `tabular-nums`
- `packages/app/test/version.test.tsx` - RTL/jsdom test stubbing the three globals, asserting via `container.textContent`
- `packages/app/src/App.tsx` - mounts `<UpdateToast/>` at the Plan-01 seam
- `packages/app/src/components/AppMenu.tsx` - renders `<VersionStamp/>` in place of the Plan-02 commented slot

## Decisions Made
- Split the SHA into a nested `<span className="tabular-nums">` inside `VersionStamp` rather than applying `tabular-nums` to the whole line, matching UI-SPEC's instruction that the treatment applies specifically "on the SHA segment."
- The component test reads `container.textContent` instead of `screen.getByText(fullString)` — RTL's default `getByText` node-text matcher only concatenates an element's *direct* text-node children, so a string split by a nested `<span>` would never match a single-node full-string query. `container.textContent` (and `toHaveTextContent`-style assertions) aggregate recursively and are the correct check here.
- Reused `InstallBanner`'s exact positioning classes (`fixed inset-x-0 bottom-16`, `motion-safe:transition-all motion-safe:duration-200`) for `UpdateToast` so the two toast/banner surfaces stacked above the tab bar behave and animate consistently.

## Deviations from Plan

None — plan executed exactly as written. (The worktree had no `node_modules` on setup; `npm install` was run once at the start of execution to establish the baseline test/build environment — this is standard environment setup, not a plan deviation, and no dependency versions or `package.json` files were changed.)

## Issues Encountered
None beyond the `node_modules` setup step noted above.

## Known Stubs

None introduced. Both `UpdateToast` and `VersionStamp` are fully wired to real data sources (the SW registration lifecycle and Vite `define` build constants respectively) — no placeholder/empty-data props.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The three manual verification gates from the plan's `<verification>` section (build v1 → preview → build v2 → reload → confirm the toast appears and Refresh/Later behave correctly; confirm the real menu version stamp shows a real short git SHA) were **not** run in this automated execution — they require `npm run build && npm run preview -w @guezzer/app` plus manual reload/tap interaction and are explicitly owner-run gates per the plan (pre-`/gsd-verify-work`). The automated checks (`npm test`, `npm run build -w @guezzer/app`, `tsc --noEmit`) all pass, and the built bundle was confirmed (via grep) to contain the real short git SHA rather than a placeholder.
- Phase 3's app-shell/PWA foundation (Plans 01-04) is now fully wired: hash routing, install onboarding, update-prompt safety, version stamp, and persistence. No blockers for Phase 4 (Show Mode).

---
*Phase: 03-app-shell-pwa-foundation*
*Completed: 2026-07-09*
