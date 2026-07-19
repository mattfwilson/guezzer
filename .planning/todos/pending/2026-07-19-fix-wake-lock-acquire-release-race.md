---
created: 2026-07-19T04:48:04.422Z
title: "Fix wake-lock acquire/release race leaving screen locked awake"
area: bug
resolves_phase: 13
files:
  - packages/app/src/wakeLock.ts:49-84
---

## Problem

**Severity: LOW (battery drain after End Show). Found in 2026-07-19 bug-hunt review.**

If `releaseWakeLock()` runs while an acquire `request("screen")` is still in flight, the release no-ops on a null sentinel, and the late-resolving request then stores a sentinel that nothing ever releases (`showActive` is already false by then). The screen stays locked awake after End Show until the app is backgrounded.

## Solution

After the `await request("screen")` resolves, re-check `showActive`; if false, release the just-acquired lock immediately instead of storing it.

Run via /gsd-quick.
