---
phase: 03-app-shell-pwa-foundation
plan: 02
subsystem: ui
tags: [pwa, install-onboarding, beforeinstallprompt, ios-safari, react, tailwindcss-v4]

# Dependency graph
requires:
  - phase: 03-app-shell-pwa-foundation
    provides: "Plan 01's App.tsx composition root (mount seam), config.ts copy (installBanner/iosInstall/installUnavailable), AppShell header menu button stub, Tailwind design tokens"
provides:
  - "Platform detection primitives (isStandalone, isIosSafari) — best-effort, non-security-critical"
  - "useInstallState() hook: beforeinstallprompt capture, promptInstall, session-only dismissal (D-05)"
  - "InstallBanner: platform-branched install invitation (Android CTA / iOS illustrated steps / fallback), hidden when standalone or dismissed"
  - "IosInstallInstructions + IosShareGlyph: illustrated iOS manual-install path with an accurate hand-authored Apple Share icon"
  - "AppMenu: permanent Install entry (always-on fallback per D-03) with a commented version-stamp slot for Plan 03"
  - "AppShell.onMenuClick wiring: header menu button now opens AppMenu"
affects: ["03-03 (update prompt + version stamp — will fill the AppMenu version-stamp slot)", "Phase 4+ (Show Mode is the primary consumer of an installed, offline-capable shell)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Install-onboarding state centralized in a single useInstallState() hook consumed by both InstallBanner and AppMenu — no duplicated beforeinstallprompt listeners"
    - "Session-only dismissal via plain useState (never persisted) is the concrete mechanism behind 're-show next launch until installed' (D-05)"
    - "Platform-detection heuristics (UA sniffing) are explicitly non-security-critical per the plan's threat model (T-03-05: accept) — misfires only mis-route UI copy, never a trust decision"

key-files:
  created:
    - packages/app/src/pwa/install/platform.ts
    - packages/app/src/pwa/install/useInstallState.ts
    - packages/app/src/components/InstallBanner.tsx
    - packages/app/src/components/IosInstallInstructions.tsx
    - packages/app/src/components/IosShareGlyph.tsx
    - packages/app/src/components/AppMenu.tsx
    - packages/app/test/platform.test.ts
  modified:
    - packages/app/src/App.tsx
    - packages/app/src/components/AppShell.tsx

key-decisions:
  - "Modified AppShell.tsx (not in the plan's file list) to add an onMenuClick prop — required to satisfy the task's explicit 'wire the header menu button to open/close this sheet' instruction, since the button lives in AppShell, not App.tsx"
  - "AppMenu's permanent Install entry stays visible even when already installed (literal reading of D-03's 'permanent'); tapping is a no-op when neither canInstall nor isIos is true"
  - "IosShareGlyph is a hand-authored SVG (not copied from any icon library's path data) to keep the 'not a lucide substitute' requirement unambiguous"

patterns-established:
  - "Pattern: platform/browser-API detection primitives live under src/pwa/<feature>/ as pure functions, consumed by a single feature-scoped hook, consumed in turn by multiple UI components — keeps beforeinstallprompt capture in exactly one place"

requirements-completed: [PWA-01]

# Metrics
duration: 25min
completed: 2026-07-09
---

# Phase 3 Plan 2: Install Onboarding Summary

**Platform-branched install banner (Android `beforeinstallprompt` CTA vs. illustrated iOS Share-icon steps) plus a permanent AppMenu Install entry, driven by a single `useInstallState()` hook with session-only dismissal.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified/created:** 9 (7 new, 2 modified)

## Accomplishments
- `isStandalone()`/`isIosSafari()` best-effort platform detection, unit-tested against iPhone Safari / Android Chrome / iOS Chrome (`CriOS`) / already-standalone UA cases
- `useInstallState()` captures `beforeinstallprompt` (preventDefault + stash), exposes `promptInstall`, and tracks dismissal as session-only React state — the concrete mechanism behind "re-shows next launch until installed" (D-05)
- `InstallBanner` renders nothing once installed/dismissed, shows the Android accent-CTA path when `beforeinstallprompt` was captured, the illustrated iOS Share-icon steps on detected iOS Safari, and the "can't auto-install here" fallback otherwise — accent color used only on the Install button
- `IosShareGlyph` is a hand-authored inline SVG (rounded tray + up-arrow, `currentColor`), not a lucide `Share`/`Share2` substitute, satisfying D-04
- `AppMenu` sheet opens from the existing header menu button, houses the permanent Install entry (D-03's always-on fallback) and a commented slot for Plan 03's version stamp
- `npm test` — 107/107 tests pass (101 prior + 6 new platform tests); `npm run build -w @guezzer/app` succeeds; `tsc --noEmit` on the app package is clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Platform detection + install-state hook + platform test** - `53de029` (feat)
2. **Task 2: Install banner, iOS instructions, Share glyph, app menu, wire into App** - `1451b3b` (feat)

## Files Created/Modified
- `packages/app/src/pwa/install/platform.ts` - `isStandalone()`, `isIosSafari()` best-effort browser-API detection
- `packages/app/src/pwa/install/useInstallState.ts` - `useInstallState()` hook: beforeinstallprompt capture, promptInstall, session-only dismissed/dismiss
- `packages/app/test/platform.test.ts` - iPhone Safari / Android Chrome / iOS Chrome (CriOS) / standalone UA test cases
- `packages/app/src/components/IosShareGlyph.tsx` - hand-authored inline SVG Apple Share icon, `currentColor`-driven
- `packages/app/src/components/IosInstallInstructions.tsx` - heading + 3 numbered steps from `config`, glyph inline with step 1
- `packages/app/src/components/InstallBanner.tsx` - platform-branched dismissible install invitation
- `packages/app/src/components/AppMenu.tsx` - menu sheet with permanent Install entry + version-stamp slot comment
- `packages/app/src/App.tsx` - mounts `InstallBanner` + `AppMenu`, manages menu-open state
- `packages/app/src/components/AppShell.tsx` - `onMenuClick` prop wired to the existing header menu button (deviation, see below)

## Decisions Made
- Modified `AppShell.tsx` to add an `onMenuClick` prop rather than leaving it untouched, because the header menu button the task explicitly says to "wire ... to open/close this sheet" physically lives in `AppShell`, not `App.tsx`. `App.tsx` now owns the `menuOpen` boolean and passes the toggler down; `AppMenu`/`InstallBanner` mount as siblings of `AppShell` so the routed placeholder view and bottom tab bar are untouched.
- `AppMenu`'s Install row stays visible regardless of install state per D-03's "permanent" wording; it's a no-op tap once already installed (neither `canInstall` nor `isIos` is true at that point) rather than being conditionally hidden.
- Used the already-declared `text-surface` Tailwind theme token (`#0C0C10`) for accent-CTA foreground text instead of a hardcoded hex, keeping with the single-config/no-scattered-magic-numbers convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Modified `AppShell.tsx` to wire the header menu button**
- **Found during:** Task 2 (Install banner, iOS instructions, Share glyph, app menu, wire into App)
- **Issue:** The task's action explicitly requires "Wire the header menu button (stubbed in Plan 01) to open/close this sheet," but that button is rendered inside `AppShell.tsx`, which is not in the plan's `<files>` list for this task (only `App.tsx` is). Completing the literal instruction was impossible without touching `AppShell.tsx`.
- **Fix:** Added an optional `onMenuClick?: () => void` prop to `AppShell`, wired to the existing button's `onClick`. `App.tsx` owns the `menuOpen` state and passes the handler through.
- **Files modified:** `packages/app/src/components/AppShell.tsx`, `packages/app/src/App.tsx`
- **Verification:** `npm test` (107/107 pass) and `npm run build -w @guezzer/app` succeed; manual code read confirms the button now opens `AppMenu` and the close (`X`) button / backdrop tap close it.
- **Committed in:** `1451b3b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — necessary file-scope correction)
**Impact on plan:** No scope creep; the change is a minimal prop addition required to fulfill the task's own explicit wiring instruction. All other files match the plan's `<files>` list exactly.

## Issues Encountered
None beyond the deviation above.

## Known Stubs

None introduced. `AppMenu`'s version-stamp area carries a commented placeholder (`{/* Version stamp slot — wired in Plan 03 ... */}`) per the plan's explicit design — Plan 03 fills it with the real `v{pkgVersion} · {shortSha} · built {date}` stamp using the `__APP_VERSION__`/`__GIT_SHA__`/`__BUILD_DATE__` build-time globals already declared in `vite-env.d.ts` (Plan 01). This is not a data stub (no fake/empty data flows to the UI) — it's an intentionally deferred, clearly-commented feature slot exactly as the plan specifies.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useInstallState()` is the single source of install-onboarding state; Plan 03's `UpdateToast` and version stamp are independent concerns and don't need to touch it.
- `AppMenu`'s commented version-stamp slot is ready for Plan 03 to fill in directly.
- The three manual verification gates from the plan's `<verification>` section (real Android Chrome / DevTools installable-manifest test, real iPhone Safari test, "Not now" re-show-on-relaunch test) were **not** run in this automated execution — they require a real or emulated device and are explicitly owner-run gates per the plan (pre-`/gsd-verify-work`), piggybacking on the Phase 4 iOS device spike already noted in STATE.md. The automated checks (`npm test`, `npm run build -w @guezzer/app`, `tsc --noEmit`) all pass.
- No blockers for Plan 03/04.

---
*Phase: 03-app-shell-pwa-foundation*
*Completed: 2026-07-09*
