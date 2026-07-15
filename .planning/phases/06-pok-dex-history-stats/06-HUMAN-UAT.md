---
status: partial
phase: 06-pok-dex-history-stats
source: [06-VERIFICATION.md]
started: 2026-07-15T00:10:00Z
updated: 2026-07-15T00:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Dark-room dex legibility
expected: Open #/dex on a phone in a dark room and drill into an album — album drill-in is readable in the dark; dimmed (unseen) rows are legible; tier/Debut badges are readable without relying on color.
result: [pending]

### 2. On-device retro mark
expected: Mark a real past show from the archive browser — Dex header counts jump instantly; "+N songs caught" flashes; airplane-mode archive browse still works fully offline.
result: [pending]

### 3. End-show recap flow
expected: End a real tracked show on device — the recap appears immediately after the backup download, still within the venue flow (not orphaned).
result: [pending]

### 4. Share card on iPhone + desktop
expected: Tap Share card on an iPhone, then on desktop — real navigator.share sheet opens on iPhone with the 1080×1350 PNG attached; anchor-download fallback works on desktop; the card renders correctly.
result: [pending]

### 5. Cover rendering quality
expected: View the album shelf grid on device — covers render crisply at ~80px; the shelf reads as a coherent discography.
result: [pending]

### 6. Friend compare fork
expected: Import a friend's exported dex file (different owner name) — read-only CompareView opens with You vs {name} columns + diff lists; NOTHING is written to the DB; no adopt/merge affordance exists.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
