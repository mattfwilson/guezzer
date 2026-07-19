---
status: passed
phase: 11-live-sync-prediction-correctness
source: [11-VERIFICATION.md]
started: 2026-07-19T00:00:00Z
updated: 2026-07-19T00:00:00Z
---

## Current Test

[complete]

## Tests

### 1. Schema-drift amber SyncDot + night-2 no-stale (LIVE-01 / LIVE-03)
expected: Over an HTTPS tunnel with `?mockLatest=1` (or `?mockLatest=drift`) injecting an extra `latest` key — amber tappable SyncDot appears; tap popover lists only novel key NAMES (never editor values); logging/suggestions never block; and a previous-night cached payload yields no stale (previous-show) suggestions on night 2.
result: passed — verified on-device over the cloudflared HTTPS tunnel with `?mockLatest=drift`; amber SyncDot + key-name-only popover confirmed.

### 2. Cross-night down-weight + reset control (PRED-01 / PRED-03)
expected: Track two shows in one run — night 2 visibly down-weights night-1 songs. Tap the Settings "start a fresh run" reset (two-tap confirm); on a subsequent show, pre-boundary (prior-run) songs return to normal weight (no longer suppressed).
result: passed (accepted) — reset control UX verified on-device (two-tap confirm → "Fresh run started" message). The behavioral down-weighting is subtle to eyeball on-device (a ~0.5 ranking multiplier — songs are demoted, not removed — and show dates auto-stamp to today with no in-app date editor, so a clean before/after needs device-clock changes); owner accepted the automated coverage as sufficient. Suppression math and the most-recent-N window direction are locked by unit tests, including the CR-01 regression test added this phase.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
