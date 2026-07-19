---
created: 2026-07-19T04:48:04.422Z
title: "Fix End-Show auto-backup racing the finalize write"
area: bug
files:
  - packages/app/src/show/EndShowDialog.tsx:82-87
---

## Problem

**Severity: MEDIUM — fix before first show. Found in 2026-07-19 bug-hunt review.**

`handleConfirm` fires `void endShow(sessionId)` then `void exportBackup()` — two independent Dexie transactions with no awaited ordering. If the snapshot read wins the race, the downloaded backup (the app's stated iOS-eviction backstop) records the show as `status: "active"`.

Failure scenario: restoring that backup on a wiped device resurrects an active show that blocks `startShow` (single-active invariant) until the user manually ends it again — corrupting the one file meant to survive an iOS eviction.

## Solution

`await endShow(sessionId)` before calling `exportBackup()`. One-line ordering fix.

Run via /gsd-quick.
