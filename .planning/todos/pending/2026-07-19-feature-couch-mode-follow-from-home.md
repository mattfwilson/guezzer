---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Couch Mode — follow the show from home via the latest.json poll"
area: feature
files:
  - packages/app/src/live/useLatestPoll.ts
  - packages/core/src/live/poll-latest.ts
  - packages/app/src/show/ShowView.tsx
---

## Problem

**Feature idea #5 from 2026-07-19 research session. Cheapest feature on the list relative to value — reuses the entire existing live loop.**

The kglw.net forum runs real-time "Couch Tour" threads during every show — fans who aren't at the venue follow song-by-song as editors log the setlist (forum.kglw.net/c/live-gizz/11). Guezzer already has the entire mechanism: the ≤1/60s `latest.json` poll, suggestion diffing, and the orbit UI. But today the poll only runs during an *active tracked show* — a friend at home has no way to watch.

## Solution

Concept — a read-only spectator mode for a show you're not at:

1. **Follow mode**: start "Follow tonight's show" instead of "Start Show". The app polls `latest.json` (same 60s etiquette floor) and **auto-adopts** editor rows into a read-only trail (no hit/miss logging, no dex catches — you weren't there). The orbit shows predictions off the current editor-logged song, so the couch viewer plays along guessing what's next.
2. **Games ride along**: a Couch Mode viewer can still play their Gizz Bingo card and score their Guezz League picks against the incoming setlist (see those todos) — remote friends stay in the group game on nights they skip.
3. **Guards**: date + artist filtering on rows (see the wrong-show and artist-filter bug todos — those fixes are prerequisites), clear "following, not attending" state so it never pollutes the dex, and show-over detection to end gracefully.
4. Explicitly NOT real-time friend-to-friend state sync (SOCL-V2-01 reopens the no-backend constraint) — this is kglw.net-as-source only.

Architecture fit: a session variant flag + read-only trail rendering; poll/diff/orbit all exist. Small-to-mid size.
