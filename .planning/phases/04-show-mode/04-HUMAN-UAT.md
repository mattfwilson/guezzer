---
status: resolved
phase: 04-show-mode
source: [04-VERIFICATION.md, 04-07-SUMMARY.md]
started: 2026-07-13T18:43:10.784Z
updated: 2026-07-13T20:15:00.000Z
device_tested: iPhone 16 Pro, iOS 26.3.1
---

## Current Test

[testing complete — all six on-device checks passed on iPhone 16 Pro, iOS 26.3.1]

## Tests

### 1. Wake Lock holds (SHOW-12)
expected: Start a show; with no interaction the screen stays awake for several minutes. On iOS < 18.4 the calm "keep your screen on manually" fallback appears exactly once (never a silent dim).
result: pass — screen stayed awake without interaction (iOS ≥18.4 "holds" path). NOTE: test device is iOS 26.3.1, so the pre-18.4 false-positive fallback path was not exercised — see Gaps.

### 2. Silent reacquire on return (SHOW-12)
expected: Background the app and return; the wake lock reacquires silently (no message, screen stays awake).
result: pass — reacquired silently on return, no notice.

### 3. Gesture suppression on the stage (SHOW-13)
expected: Over the orbit stage, pull-to-refresh, double-tap-zoom, and long-press text-select all fail to fire; the stage does not scroll or rubber-band.
result: pass — none fired; stage did not scroll or rubber-band.

### 4. Weak-fan softening visual (EVAL-04 / D-10)
expected: In a sparse (weak-fan) moment the orbs visibly soften and a "Low confidence · Wide-open moment" hint shows, while the honest percentage still renders.
result: pass — hit a weak-fan moment with multiple orbs under 10% confidence; orbs softened and the honest percentages still rendered.

### 5. Force-quit / relaunch exact restore (SHOW-11)
expected: Mid-show, force-quit the installed PWA and relaunch; the active session restores exactly — same current song, trail, tally, and set structure.
result: pass — force-quit and relaunch restored the active session exactly.

### 6. End Show finalize (SHOW-13)
expected: Tap End Show → confirm → the setlist finalizes read-only and returns to the pre-show launcher, ready for the next night. Record the tested iOS/device versions here (resolves the STATE.md iOS-lifecycle blocker).
result: pass — End Show returned to the pre-show launcher ("Tap the opener"), ready for the next night. Tested on iPhone 16 Pro, iOS 26.3.1. Owner noted the finished show is not viewable in-app; confirmed EXPECTED, not data loss: endShow (packages/app/src/db/db.ts:272) flips the tracked-show status active→finalized and retains the row plus all entries in IndexedDB; finished-show viewing is scoped to Phase 6 (ROADMAP line 166, "past tracked shows remain viewable as complete setlists"). Check #5's exact restore confirms the same persistence layer retains the finalized record.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- **iOS <18.4 Wake Lock false-positive fallback path not exercised** (check #1). The test device (iPhone 16 Pro, iOS 26.3.1) is well past the 18.4 threshold, so the "holds" path was confirmed but the calm once-per-show WakeLockNotice fallback that triggers on the pre-18.4 installed-PWA false-positive was not observed live. The fallback logic is unit-covered (`packages/app/test/wakeLock.test.ts` — API-absent case) and the verify-held guard is sound (`wakeLock.ts:54`), but the live pre-18.4 path is unconfirmed. Non-blocking, same posture as the deferred Android install check in Phase 3 — close out opportunistically if a pre-18.4 device becomes available in the friend group.
