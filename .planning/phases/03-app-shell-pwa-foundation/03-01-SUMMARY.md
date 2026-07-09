---
phase: 03-app-shell-pwa-foundation
plan: 01
subsystem: ui
tags: [vite, react, vite-plugin-pwa, tailwindcss-v4, hash-routing, vitest, workbox]

# Dependency graph
requires:
  - phase: 02-transition-matrix-model-backtest
    provides: "@guezzer/core package (not yet consumed by the app; import path established but unused)"
provides:
  - "Real @guezzer/app Vite + React 19 + TypeScript app replacing the empty stub"
  - "Installable PWA build (manifest.webmanifest + Workbox service worker + precache) via vite-plugin-pwa, registerType:'prompt'"
  - "Tailwind v4 dark-theme design tokens (@theme) matching the approved UI-SPEC"
  - "packages/app/src/config.ts single source of truth for app constants/copy"
  - "Library-free hash router (useHashRoute/navigate/ROUTES) with #/show, #/explore, #/dex and unknown-hash normalization to 'show'"
  - "Navigable nav skeleton: AppShell, BottomTabBar, PlaceholderView"
  - "Root vitest.config.ts @guezzer/app jsdom project alongside @guezzer/core node project"
  - "Build-time version injection (__APP_VERSION__/__GIT_SHA__/__BUILD_DATE__)"
affects: ["03-02 (install onboarding)", "03-03 (update prompt + version stamp)", "03-04 (persistence)", "Phase 4 (Show Mode)", "Phase 6 (Pokédex)", "Phase 7 (Explore/constellation)"]

# Tech tracking
tech-stack:
  added: [vite@8.1.3, "@vitejs/plugin-react@6.0.3", vite-plugin-pwa@1.3.0, tailwindcss@4.3.2, "@tailwindcss/vite@4.3.2", react@19.2.7, react-dom@19.2.7, dexie@4.4.4, dexie-react-hooks@4.4.0, lucide-react@1.23.0, jsdom@29.1.1, "@testing-library/react@16.3.2", "@testing-library/jest-dom@6.9.1", fake-indexeddb@6.2.5]
  patterns:
    - "App tsconfig extends tsconfig.base.json but overrides lib/jsx/module/moduleResolution for a browser+bundler target (core stays Node/no-DOM)"
    - "All app copy/constants centralized in src/config.ts (config.copy.*), never inlined in components"
    - "Hash route validated against a fixed ROUTES allow-list, never used for innerHTML/eval/location assignment"
    - "Vitest test.projects: explicit @guezzer/core (node) + @guezzer/app (jsdom) projects, not a packages/* glob"
    - "@testing-library/jest-dom/vitest (not the plain package entry) required for Vitest 4's expect to be extended"

key-files:
  created:
    - packages/app/vite.config.ts
    - packages/app/tsconfig.json
    - packages/app/index.html
    - packages/app/src/main.tsx
    - packages/app/src/App.tsx
    - packages/app/src/vite-env.d.ts
    - packages/app/src/styles.css
    - packages/app/src/config.ts
    - packages/app/src/routing/useHashRoute.ts
    - packages/app/src/components/AppShell.tsx
    - packages/app/src/components/BottomTabBar.tsx
    - packages/app/src/components/PlaceholderView.tsx
    - packages/app/public/icon-192.png
    - packages/app/public/icon-512.png
    - packages/app/public/icon-512-maskable.png
    - packages/app/public/apple-touch-icon.png
    - packages/app/test/setup.ts
    - packages/app/test/route.test.ts
  modified:
    - packages/app/package.json
    - package.json
    - vitest.config.ts
    - .gitignore

key-decisions:
  - "Generated manifest icons with a hand-rolled zero-dependency PNG encoder (Node zlib deflate) instead of @vite-pwa/assets-generator — solid #0C0C10 background with a centered gold circle mark; explicitly plan-sanctioned as swappable art"
  - "Mapped UI-SPEC's named spacing scale (xs/sm/md/lg/xl/2xl/3xl) onto Tailwind's default numeric spacing utilities (1/2/4/6/8/12/16) rather than declaring redundant --spacing-* theme tokens, since the values already coincide 1:1 with Tailwind v4 defaults"
  - "Used lucide-react Music/Compass/BookOpen for Show/Explore/Dex tab icons and Menu for the header trigger — concrete choices within UI-SPEC's 'icon library: lucide-react' contract"

patterns-established:
  - "Pattern: app config.ts groups all UI copy under config.copy.<feature>.<key> namespaces so later plans (install banner, update toast, version stamp) extend rather than restructure it"
  - "Pattern: App.tsx carries explicit commented mount seams for Plan 02 (InstallController), Plan 03 (UpdateToast), and Plan 04 (persistence trigger) so those plans have an obvious, low-conflict insertion point"

requirements-completed: [PWA-01, PWA-02]

# Metrics
duration: 45min
completed: 2026-07-09
---

# Phase 3 Plan 1: App Shell & PWA Foundation Summary

**Scaffolded @guezzer/app as a Vite 8 + React 19 PWA (Workbox SW, dark Tailwind v4 theme) with a library-free hash router driving a Show/Explore/Dex nav skeleton, and wired the root Vitest config with an app-level jsdom test project.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files modified/created:** 21

## Accomplishments
- Empty `@guezzer/app` stub is now a real Vite + React + TS app that builds to a static PWA bundle (`npm run build -w @guezzer/app` emits `dist/manifest.webmanifest`, `dist/sw.js`, `dist/workbox-*.js`, and 4 valid PNG icons)
- `vite-plugin-pwa` configured with `registerType: 'prompt'` (never `autoUpdate`, per CLAUDE.md #4) and build-time `__APP_VERSION__`/`__GIT_SHA__`/`__BUILD_DATE__` injection
- App is navigable end-to-end via `#/show` (default), `#/explore`, `#/dex`; unknown/empty hash normalizes to `show`
- `npm test` runs both Vitest projects (core `node` + app `jsdom`) — 101 tests pass (96 core + 5 new route tests)
- All app constants and copy centralized in `packages/app/src/config.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Dependencies, build config, PWA plugin, Tailwind, config-as-single-source** - `4abc1ea` (feat)
2. **Task 2: App Vitest jsdom project + test harness** - `5a0561c` (test)
3. **Task 3: Hash router + navigable nav skeleton with placeholder views** - `3fc854a` (feat)

## Files Created/Modified
- `packages/app/vite.config.ts` - react + tailwindcss + VitePWA(registerType:'prompt') plugins, version `define`
- `packages/app/tsconfig.json` - extends base with DOM lib, jsx, bundler resolution overrides
- `packages/app/index.html` - dark theme-color meta, viewport-fit=cover, module entry
- `packages/app/src/main.tsx` - React root mount rendering `<App/>`
- `packages/app/src/App.tsx` - composition root: AppShell + routed PlaceholderView + BottomTabBar, commented seams for Plans 02/03/04
- `packages/app/src/vite-env.d.ts` - ambient `__APP_VERSION__`/`__GIT_SHA__`/`__BUILD_DATE__` + vite-plugin-pwa/react types
- `packages/app/src/styles.css` - Tailwind v4 `@import` + `@theme` dark palette + safe-area base rules
- `packages/app/src/config.ts` - single-source `export const config` with DB_NAME, UPDATE_CHECK_MS, all UI-SPEC copy
- `packages/app/src/routing/useHashRoute.ts` - `useHashRoute`, `navigate`, `ROUTES`, `currentRoute` — the hash-fragment allow-list control
- `packages/app/src/components/{AppShell,BottomTabBar,PlaceholderView}.tsx` - nav skeleton components
- `packages/app/public/{icon-192,icon-512,icon-512-maskable,apple-touch-icon}.png` - generated manifest icons
- `packages/app/test/setup.ts` - `@testing-library/jest-dom/vitest` + `fake-indexeddb/auto`
- `packages/app/test/route.test.ts` - hash normalization + navigate() route test
- `packages/app/package.json` - added react/react-dom/dexie/dexie-react-hooks/lucide-react/@guezzer/core deps + vite/plugin-react/vite-plugin-pwa/tailwindcss devDeps
- `package.json` (root) - added jsdom, @testing-library/react, @testing-library/jest-dom, fake-indexeddb devDeps
- `vitest.config.ts` (root) - added explicit `@guezzer/app` jsdom project alongside `@guezzer/core` node project
- `.gitignore` - added `dist/` (build output, was previously only `node_modules/`)

## Decisions Made
- Generated the four placeholder manifest icons with a small zero-dependency PNG encoder (Node `zlib.deflateSync`) rather than pulling in `@vite-pwa/assets-generator` — solid `#0C0C10` background with a centered gold circle, valid PNGs at the exact declared dimensions (192, 512, 512 maskable-safe-zone, 180). The plan explicitly allowed this as a swappable placeholder (RESEARCH Open Question 2).
- Mapped the UI-SPEC's named spacing scale onto Tailwind v4's default numeric spacing utilities (they coincide exactly: xs=4px=`1`, sm=8px=`2`, md=16px=`4`, lg=24px=`6`, xl=32px=`8`, 2xl=48px=`12`, 3xl=64px=`16`) instead of redeclaring redundant `--spacing-*` theme tokens.
- Chose `lucide-react` `Music`/`Compass`/`BookOpen` for the Show/Explore/Dex tab glyphs and `Menu` for the header trigger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `@testing-library/jest-dom` plain import threw "expect is not defined" under Vitest 4**
- **Found during:** Task 3 (`npm test` verification after adding `route.test.ts`)
- **Issue:** The plan's literal instruction (`import '@testing-library/jest-dom';`) uses the Jest-global entry point, which assumes a global `expect`. Vitest 4 does not expose one by default, so the import threw at setup time and failed the entire `@guezzer/app` suite.
- **Fix:** Changed the import in `packages/app/test/setup.ts` to `@testing-library/jest-dom/vitest`, the package's dedicated Vitest integration entry that extends Vitest's own `expect`.
- **Files modified:** `packages/app/test/setup.ts`
- **Verification:** `npm test` — all 11 test files / 101 tests pass (was 1 failed suite / 96 tests before the fix).
- **Committed in:** `3fc854a` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correctness fix for the test harness to function under the pinned Vitest 4.1.10; no scope creep — same two imports as specified, just the version-correct entry point for one of them.

## Issues Encountered
None beyond the deviation above.

## Known Stubs

The three placeholder views (`Show Mode`, `Explore`, `Your Pokédex`) rendered by `PlaceholderView.tsx` are intentional stubs per plan objective D-01 — this plan's explicit scope is a *navigable nav skeleton*, not feature content. They are not wired to any data source. Resolution path:
- Show Mode → Phase 4 (Show Mode / prediction loop)
- Explore → Phase 7 (constellation)
- Dex → Phase 6 (Pokédex)

No other stubs (hardcoded empty arrays/objects flowing to UI, TODO/FIXME markers, or unwired data props) were introduced.

## User Setup Required

None - no external service configuration required. (`npm install` pulled all new dependencies from the public npm registry; no secrets, API keys, or manual dashboard steps involved.)

## Next Phase Readiness

- `packages/app/src/config.ts` is ready for Plan 02 (install banner/iOS instructions copy already present under `config.copy.installBanner` / `config.copy.iosInstall` / `config.copy.installUnavailable`) and Plan 03 (`config.copy.updateToast`, `config.UPDATE_CHECK_MS`, `config.versionStampFormat`).
- `App.tsx` has commented mount seams for `<InstallController/>` (Plan 02), `<UpdateToast/>` (Plan 03), and the persistence trigger (Plan 04).
- The four manual verification gates from the plan's `<verification>` section (installability audit, offline-after-reload, update-prompt apply-on-Refresh, on-device persistence survival) were **not** run in this automated execution — they require `npm run build && npm run preview -w @guezzer/app` plus DevTools/real-device interaction and are explicitly owner-run gates per the plan (pre-`/gsd-verify-work`). The build itself (`npm run build -w @guezzer/app`) was verified to succeed and emit a valid manifest + service worker + all four icons.
- No blockers for Plan 02/03/04.

---
*Phase: 03-app-shell-pwa-foundation*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 19 created files verified present on disk; all 4 task/metadata commit hashes (`4abc1ea`, `5a0561c`, `3fc854a`, `e271919`) verified present in git log.
