---
status: partial
phase: 16-gizz-bingo-build-live-marking-celebrations
source: [16-VERIFICATION.md]
started: 2026-07-21T09:15:00Z
updated: 2026-07-21T09:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Deal each vibe on GizzGames, then swap and reshuffle squares
expected: One tap deals a full 4×4 (never blank); the fill meter reacts on every swap/reshuffle and turns amber (never red) below the likely-line threshold; the vibe label flips to "Custom" after an individual swap; reshuffle with custom swaps prompts a confirm.
result: passed (confirmed on device 2026-07-21)

### 2. Lock a card at Start Show, then log songs on LiveGizz
expected: The in-flow peek strip appears (never over the FAB/orbit), auto-marks square-by-square as songs land, glows the single closest needed square, and shows the "🔥 One away…" / "👑 ONE SQUARE FROM BLACKOUT" banner; tapping a stamped square on the full GamesView board reveals which song lit it.
result: [pending]

### 3. Complete a first line, a second line, four-corners/X, and a blackout
expected: Per-square stamp on every mark; a medium badge toast on four-corners / X / subsequent lines; a big supernova on the FIRST line and on blackout ONLY (at most two big moments per show); you can keep logging THROUGH the supernova (it never intercepts taps).
result: [pending]

### 4. Enable reduced-motion (OS setting) and re-trigger celebrations
expected: Supernova degrades to a static full-bloom headline crossfade (no particles/scale); stamps/toasts are opacity-only; the one-away ring is a static accent outline.
result: [pending]

### 5. Share the bingo trophy from RecapView (at the win) and from a GizzGames replay row, on a real iOS/Android device
expected: The share sheet opens with a rendered PNG showing the 4×4 board (marked green / unmarked dark, distinct free center), win badges (glyph + word), and show date · venue on the galaxy canvas + wordmark — no async stall before the native share dialog.
result: [pending]

## Summary

total: 5
passed: 1
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
