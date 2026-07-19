---
created: 2026-07-19T04:48:04.422Z
title: "Fix premature \"Backup saved\" line in End Show dialog"
area: bug
resolves_phase: 12
files:
  - packages/app/src/show/EndShowDialog.tsx:108-112
---

## Problem

**Severity: LOW-MEDIUM (misleading data-safety copy). Found in 2026-07-19 bug-hunt review.**

The CircleCheck "Backup saved to your downloads." confirmation line renders unconditionally inside the still-open "End show?" dialog — before any backup has happened. A user who taps "Keep tracking" was told a backup was saved when none was. Given backups are the iOS-eviction backstop, falsely claiming one exists is worse than most copy bugs.

## Solution

Show the confirmation only after confirm actually runs the export (post-`endShow`/`exportBackup`, see related todo "Fix End-Show auto-backup racing the finalize write" — fix both together), or reword to future tense ("A backup will be saved to your downloads").

Run via /gsd-quick.
