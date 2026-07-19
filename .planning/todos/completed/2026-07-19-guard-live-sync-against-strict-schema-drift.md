---
created: 2026-07-19T04:48:04.422Z
title: "Guard live sync against strict-schema silent death on API drift"
area: bug
resolves_phase: 11
files:
  - packages/core/src/ingest/api-types.ts
  - packages/core/src/live/poll-latest.ts
  - packages/app/src/live/useLatestPoll.ts
---

## Problem

**Severity: MEDIUM risk going into tour. Found in 2026-07-19 bug-hunt review (non-finding that became a finding).**

The strict zod schema on `latest.json` rows hard-rejects ALL rows if kglw.net ever **adds** a new field to their API response. That's deliberate drift-detection for the build-time corpus fetch (fail loudly at build), but on the **live path** it means live sync dies silently mid-tour until an app update ships — no suggestions, no auto-bind, and the SyncDot gives no explanation. kglw.net is volunteer-run and recently upgraded their Songfish setlist software, so additive drift during August tour is plausible.

## Solution

Two-part: (1) loosen the live-poll schema to tolerate unknown keys (`.passthrough()` / `.loose()` on the live path only — keep the build-time fetch strict for drift detection); (2) if validation still fails, surface a visible "sync unavailable — schema mismatch" state on the SyncDot/status line instead of silent death, so the owner knows to fall back to fully-manual logging.

Run via /gsd-quick.
