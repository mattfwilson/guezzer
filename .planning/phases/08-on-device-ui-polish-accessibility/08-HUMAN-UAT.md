---
status: partial
phase: 08-on-device-ui-polish-accessibility
source: [08-VERIFICATION.md]
started: 2026-07-18T09:00:00Z
updated: 2026-07-18T09:00:00Z
---

## Current Test

[awaiting human testing on the physical iPhone over the cloudflared HTTPS UAT tunnel]

## Tests

### 1. Orb-label legibility on the physical iPhone via `#/dev/orb-fit`
expected: All 264 real @matrix song names render fully — no truncation/overflow/oversizing — and the harness reports ZERO overflow offenders (especially the 44-char outlier "(You Gotta) Fight for Your Right (To Party!)" and "Deserted Dunes Welcome Weary Feet"). (POLISH-01)
result: [pending]

### 2. `inert` propagation through `display:contents` on iOS Safari with VoiceOver (WR-02)
expected: With a modal `<Sheet>` open, VoiceOver cannot reach any background control — swipe past the last in-sheet element and confirm focus stays inside the sheet. If the background remains reachable, the documented fallback is to move `id`/`inert` onto AppShell's root flex box. (A11Y-01)
result: [pending]

### 3. Real-device dismiss / trap / restore on the 7 audited surfaces (VoiceOver + external keyboard)
expected: For each of NodeSheet, AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, "Whose dex is this?" prompt, CompareView — Escape dismisses; a modal traps the AT virtual cursor and Tab wraps; focus restores to the trigger on close; NodeSheet stays non-modal (graph reachable). (A11Y-01)
result: [pending]

### 4. FilterFab no-occlusion on a real phone (A11Y-02)
expected: Focus a constellation node — the FilterFab rests ~12px above the NodeSheet peek top edge, fully visible and tappable, no overlap with sheet content; it returns to bottom-right when the sheet closes.
result: [pending]

### 5. Resize-keeps-camera-framed on a real phone (A11Y-03)
expected: Focus a node, then rotate the device and toggle the on-screen keyboard — the camera stays framed on that node with no snap-off.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
