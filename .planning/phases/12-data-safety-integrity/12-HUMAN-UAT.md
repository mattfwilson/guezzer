---
status: partial
phase: 12-data-safety-integrity
source: [12-VERIFICATION.md]
started: 2026-07-19T21:24:00Z
updated: 2026-07-19T21:24:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. iOS Safari backup download (SAFE-02)
On a real iOS Safari device (installed PWA and a browser tab): end a show and confirm the auto-backup JSON actually downloads and saves.
expected: The backup .json file lands in Downloads / Files without the download aborting.
result: [pending]

### 2. iOS Safari share-card download (SAFE-02)
On a real iOS Safari device: open a share card and confirm the PNG downloads and saves (web-share unavailable / dismissed fallback branch).
expected: The share-card .png saves without the download aborting.
result: [pending]

### 3. Export→restore round-trip (SAFE-01)
Restore a backup that was exported immediately after ending a show, then observe whether any show appears "active".
expected: The restored show is finalized (read-only); no show is resurrected as active.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
