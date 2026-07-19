---
created: 2026-07-19T04:48:04.422Z
title: "Fix wrong-show editor suggestions — no date guard + stale latestRows"
area: bug
resolves_phase: 11
files:
  - packages/app/src/show/ShowView.tsx:180-193
  - packages/app/src/show/ShowView.tsx:221-227
  - packages/app/src/show/ShowView.tsx:335-341
  - packages/core/src/live/suggest.ts
---

## Problem

**Severity: HIGH — fix before first show (Aug 14, 2026). Found in 2026-07-19 bug-hunt review.**

kglw.net's `latest.json` returns the most recent show in their DB — which is the **previous** show until an editor creates tonight's (docs/SCHEMA.md §9 documents this; `bind-show.ts` even has a comment about "a prior night still cached"). The auto-bind path is correctly date-guarded (`bindShowFromLatest` checks `showdate === show.date`, ShowView.tsx:~202), but `diffLatestAgainstTrail` and `resolvePlaceholders` consume `latestRows` **unfiltered**.

Failure scenario: on night 2 of a consecutive-night run (the app's core use case — both 2026 runs are 3-night residencies), the SuggestionStrip offers up to 2 of last night's songs as "kglw editor" suggestions. "Add" (`handleAdopt`, ShowView.tsx:335-341) is a one-tap no-confirm path that writes a wrong-show song into tonight's setlist; a fill-hint can silently rename tonight's `???` to last night's song.

Compounding: `latestRows` state is never cleared when a new session starts — the session-reset effect (ShowView.tsx:221-227) clears only `dismissedIds` — so night-1 rows linger into night 2 before the first poll even fires.

The owner's `tracking_bugs.png` screenshot (repo root, 2026-07-18) shows a likely symptom: "Rattlesnake / kglw editor / Robert S…" suggestion rows bleeding into the orbit view — check suggestion-strip clipping/overflow at desktop viewport while fixing this.

## Solution

1. Filter `latestRows` to `row.showdate === session.active.date` before passing to `diffLatestAgainstTrail` and `resolvePlaceholders`.
2. Clear `latestRows` in the session-reset effect alongside `dismissedIds`.
3. While in there, verify the suggestion strip is clipped/hidden properly (screenshot shows rows overlapping the orbit stage).

Run via /gsd-quick.
