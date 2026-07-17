---
title: InstallBanner should show once per app version, not every reload
created: 2026-07-14T04:10:00Z
source: owner report during Phase 05 UAT Test 3 setup
area: ui
resolves_phase: 8
blocking: false
---

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
