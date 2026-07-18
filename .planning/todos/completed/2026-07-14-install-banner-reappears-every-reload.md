---
title: InstallBanner should show once per app version, not every reload
created: 2026-07-14T04:10:00Z
source: owner report during Phase 05 UAT Test 3 setup
area: ui
resolves_phase: 8
blocking: false
status: done
resolved_by: already delivered by the Phase-6 D-22 once-per-version gate (verify-and-close 2026-07-18, POLISH-02 / plan 08-07)
resolved_date: 2026-07-18
files:
  - packages/app/src/components/InstallBanner.tsx
---

> **DONE / verified 2026-07-18 (POLISH-02, plan 08-07 verify-and-close):**
> already delivered by the Phase-6 D-22 once-per-version gate — this todo
> predated realizing that work covers it. Verification against every wanted
> point:
> - The banner is gated on a persisted `meta` flag `installBannerSeenVersion`
>   (`INSTALL_BANNER_SEEN_VERSION`, `InstallBanner.tsx:33`) keyed on the build
>   stamp `` `${__APP_VERSION__}+${__GIT_SHA__}` `` (`InstallBanner.tsx:40`) —
>   the "seen for version X" flag the todo asked for, same never-throw meta
>   idiom (T-06-06) as `PERSIST_WARNING_SHOWN`.
> - Shows at most once per build: on first visible render for a never-seen
>   stamp it writes the flag (`InstallBanner.tsx:69-78`); reloads on the SAME
>   stamp read `seenThisVersion === true` → render nothing; a NEW build (new
>   stamp) re-shows once.
> - Session-only dismissal (D-05) is layered on top (`!dismissed`), and the
>   permanent AppMenu "Install" entry remains the always-on fallback.
> - Tests: `installBannerVersion.test.tsx` green (3/3) — shows-once-and-persists,
>   stays-hidden-on-recorded-stamp, re-shows-once-on-older-build.

# InstallBanner reappears on every page load — should show once per version

**Observed:** The "Install Guezzer" banner appears every time the page is
reloaded (or the same version is revisited) when the app is not installed.

**Wanted:** Show the banner at most once per app version. Persist a
"dismissed/seen for version X" flag (meta table, same idiom as
`persistWarningShown` in EndShowDialog) keyed on the build/app version, so the
banner only reappears after an update ships a new version.

**Pointers:**
- Banner component: `packages/app/src/components/InstallBanner.tsx` (platform
  detection in `packages/app/src/pwa/install/platform.ts`)
- One-time-flag idiom to copy: `PERSIST_WARNING_SHOWN` meta flag in
  `packages/app/src/show/EndShowDialog.tsx`
- Version source: build-time constant (e.g. `import.meta.env` injected version
  or the SW precache revision) — needs a stable per-release value
