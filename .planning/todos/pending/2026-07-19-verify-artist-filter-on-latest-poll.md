---
created: 2026-07-19T04:48:04.422Z
title: "Verify/enforce artist filter on latest.json live poll"
area: bug
files:
  - packages/core/src/live/poll-latest.ts
  - packages/core/src/live/bind-show.ts
  - packages/core/src/live/suggest.ts
---

## Problem

**Severity: needs verification — potentially HIGH if unguarded. Found in 2026-07-19 kglw.net API research.**

kglw.net's `/api/v2/latest.json` returns the latest show for **any artist the site tracks**, not just King Gizzard proper — a live fetch during research returned a Stu Mackenzie solo DJ set (`artist_id: 4`). If the live poll path doesn't filter rows by `artist_id`/`artist`, a side-project show entering the DB during the August runs could feed wrong-artist songs into suggestions or auto-bind (compounded by the missing date guard — see "Fix wrong-show editor suggestions" todo).

Rows carry `artist` and `artist_id` fields (verified against the live API 2026-07-19).

## Solution

Audit `poll-latest.ts` / `bind-show.ts` / `suggest.ts` for an artist guard. If absent, filter rows to KGLW's artist_id (confirm the canonical id — likely 1 — against the API/corpus) at the poll boundary so every downstream consumer is safe. Add a fixture test with a wrong-artist row.

Run via /gsd-quick.
