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
result: passed — verified on-device (iPhone, 2026-07-14): SyncDot flips to hollow ring in airplane mode with the offline reassurance line, app fully functional offline, silent resume on reconnect. User approved. (Note: two real bugs were found and fixed en route — stale dist serving, and crypto.randomUUID unavailable on insecure LAN origins breaking Start Show; see .planning/debug/resolved/.)

### 2. Suggestion adopt/dismiss + layout stability
expected: Tap Add on an editor suggestion; dismiss another via both tap-X and horizontal swipe. Adopt logs the song (`source:'editor'`, correct hit/miss); dismiss removes the row with nothing logged; the orbit fan above never re-lays-out.
result: passed — verified 2026-07-14 via automated Playwright browser drive (mobile viewport, touch context) at the user's request, using the ?mockLatest=1 fixture harness (quick task 260713-wjd). Adopt logged instantly with no confirm (tally 0/1 · 0%, honest pre-opener miss, orbit recentered onto the adopted song with a real prediction fan); X-dismiss and ~100px pointer-swipe both removed rows with nothing logged (tally unchanged); orbit stage bounding box byte-identical across suggestion appearance and both dismissals. Screenshots reviewed. FOUND+FIXED one real defect: dismissed suggestions permanently occupied strip slots (post-truncation filter) — dismissals now free the slot so the next editor song slides in (core suggest.ts excludeSongIds param + regression tests).

### 3. End-show auto-download on installed iOS PWA
expected: End a show on an installed iOS PWA. Backup JSON auto-downloads with a muted confirmation; a persist-denied warning shows at most once.
result: [pending]

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
