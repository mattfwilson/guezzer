---
status: partial
phase: 05-live-sync-data-safety
source: [05-VERIFICATION.md]
started: 2026-07-13T23:43:31Z
updated: 2026-07-13T23:43:31Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Offline resilience
expected: Enable airplane mode during an active show; keep logging songs; re-enable network. The app stays fully functional offline (orbit, logging, trail), no error banner, polling resumes silently within one interval when signal returns.
result: [pending]

### 2. Suggestion adopt/dismiss + layout stability
expected: Tap Add on an editor suggestion; dismiss another via both tap-X and horizontal swipe. Adopt logs the song (`source:'editor'`, correct hit/miss); dismiss removes the row with nothing logged; the orbit fan above never re-lays-out.
result: [pending]

### 3. End-show auto-download on installed iOS PWA
expected: End a show on an installed iOS PWA. Backup JSON auto-downloads with a muted confirmation; a persist-denied warning shows at most once.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
