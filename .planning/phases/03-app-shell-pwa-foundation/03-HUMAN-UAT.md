---
status: resolved
phase: 03-app-shell-pwa-foundation
source: [03-VERIFICATION.md]
started: 2026-07-09T04:32:38Z
updated: 2026-07-09T05:12:24Z
---

## Current Test

[all tests closed out]

## Tests

### 1. Offline reload after first load
expected: Build + preview the app (`npm run build -w @guezzer/app && npm run preview -w @guezzer/app`), load once, DevTools → Network → Offline, reload → the app shell (header, tab bar, current placeholder view) still loads with no network errors.
result: PASSED — tested on installed iPhone PWA via Airplane Mode + force-quit/relaunch. App shell loaded with no network errors.

### 2. Install onboarding on real Android Chrome and real iPhone Safari
expected: Android: DevTools/Chrome shows the manifest as installable and the banner's Install button fires the native install prompt. iPhone Safari: the banner shows the illustrated Share-icon steps, never a dead Android prompt, and Add to Home Screen actually installs the app.
result: PARTIAL — iPhone Safari PASSED (illustrated instructions displayed, Add to Home Screen installed, launched standalone). Android Chrome DEFERRED via explicit owner override (no device available) — see 03-VERIFICATION.md overrides.

### 3. Update-prompt real swap: build v1 → preview → load → build v2 → reload → confirm toast, Refresh, Later
expected: After a second build while the first is still open in preview, the "New version available — Refresh" toast appears; tapping Refresh reloads onto v2; tapping Later (or ignoring) keeps v1 running indefinitely — the version never swaps without an explicit tap.
result: PASSED — tested in Arc browser via two sequential empty-commit rebuilds against one open preview tab, forced via DevTools Service Workers > Update. Toast appeared; Later kept old version; Refresh applied new version.

### 4. On-device persistence survival (install → write → force-quit → relaunch)
expected: On an installed PWA (iOS and Android), write an attendedShows/meta row, force-quit the app, relaunch, and confirm the row is still present.
result: PASSED (soft) — installed iPhone PWA survived force-quit/relaunch with no errors or reset. Deep IndexedDB inspection via remote Web Inspector not performed (no Mac available); owner accepted app-level behavior plus existing fake-indexeddb unit coverage as sufficient.

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred: 1 (Android Chrome install prompt — see Gaps)

## Gaps

- **Android Chrome install onboarding**: not tested on a physical device. Code-level evidence is strong (beforeinstallprompt capture logic, unit-tested platform detection, 0 critical code review findings) but the live native-prompt flow is unconfirmed. Accepted via explicit owner override in 03-VERIFICATION.md; not blocking. Close out opportunistically when an Android device is available.
