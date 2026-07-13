---
status: partial
phase: 04-show-mode
source: [04-VERIFICATION.md, 04-07-SUMMARY.md]
started: 2026-07-13T18:43:10.784Z
updated: 2026-07-13T18:43:10.784Z
---

## Current Test

[awaiting human testing on a real installed PWA — oldest iOS device in the friend group, before show #1]

## Tests

### 1. Wake Lock holds (SHOW-12)
expected: Start a show; with no interaction the screen stays awake for several minutes. On iOS < 18.4 the calm "keep your screen on manually" fallback appears exactly once (never a silent dim).
result: [pending]

### 2. Silent reacquire on return (SHOW-12)
expected: Background the app and return; the wake lock reacquires silently (no message, screen stays awake).
result: [pending]

### 3. Gesture suppression on the stage (SHOW-13)
expected: Over the orbit stage, pull-to-refresh, double-tap-zoom, and long-press text-select all fail to fire; the stage does not scroll or rubber-band.
result: [pending]

### 4. Weak-fan softening visual (EVAL-04 / D-10)
expected: In a sparse (weak-fan) moment the orbs visibly soften and a "Low confidence · Wide-open moment" hint shows, while the honest percentage still renders.
result: [pending]

### 5. Force-quit / relaunch exact restore (SHOW-11)
expected: Mid-show, force-quit the installed PWA and relaunch; the active session restores exactly — same current song, trail, tally, and set structure.
result: [pending]

### 6. End Show finalize (SHOW-13)
expected: Tap End Show → confirm → the setlist finalizes read-only and returns to the pre-show launcher, ready for the next night. Record the tested iOS/device versions here (resolves the STATE.md iOS-lifecycle blocker).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
