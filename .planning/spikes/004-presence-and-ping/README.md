---
spike: 004
name: presence-and-ping
type: standard
validates: "Given several users with the app open, when they're active, then everyone sees who's online AND can send a lightweight wave the recipient receives"
verdict: VALIDATED
related: [002, 003]
tags: [supabase, realtime, presence, broadcast, multi-user, throwaway]
---

# Spike 004: Presence + Ping

Proves the "simple interactions / see what they're doing" goal without full live
setlist sync. Shares the demo built in **spike 002**
(`../002-supabase-multiuser/app/`).

## What This Validates

Given multiple users with the app open, when they connect, then everyone's friend
list shows a live **green dot** for who's currently online; and when someone taps
**👋**, the target (or everyone) gets a toast — proving ephemeral presence and
low-latency messaging both work.

## Research

- **Who's online:** Supabase Realtime **Presence** (CRDT-synced). One channel
  `gizz-room` keyed by `user_id`; each client `track()`s on `SUBSCRIBED`, and a
  `presence:sync` handler reads `presenceState()` → set of online ids.
- **Waves:** Supabase Realtime **Broadcast** on the same channel
  (`event: 'wave'`), `{from, to}` payload. `to:null` = wave at everyone; a set
  `to` is a targeted wave (recipient filters on its own id).
- **Why not persist waves:** they're ephemeral by design — presence + broadcast
  are the right primitives (no DB row, no RLS needed). Durable state (progress)
  stays in Postgres (spike 003); ephemeral activity rides Realtime. This
  presence-vs-persistence split is the intended pattern for the real build.

## How To Run

Same setup and server as spike 002. Open two+ windows as different `gizz#`.

## What To Expect

- Each friend with the app open shows a **green dot**; closing a window drops
  their dot within a few seconds.
- A **👋** button appears next to online friends. Tapping it pops
  "👋 {you} waved at you" in that friend's window; the header shows the sender.
- Presence and progress update independently (two channels, two concerns).

## Investigation Trail

1. Reused the 002 demo. Single `gizz-room` channel carries both presence and
   broadcast; `progress-feed` stays a separate channel for DB changes.
2. Targeted vs broadcast-to-all waves handled by a `to` field + client-side filter.
3. **Live run, two remote devices:** green online dots appeared for both users and
   dropped a few seconds after a tab closed; **👋** delivered a toast to the other
   device near-instantly.

## Results

**Verdict: VALIDATED ✓** — Presence (who's online) and Broadcast (waves) both work
across a real network with low latency. The presence-vs-persistence split is
confirmed as the right architecture: ephemeral activity rides Realtime with no DB
row, durable progress lives in Postgres (spike 003). This is the foundation the
"see what they're doing" features build on — the same channel can later carry
richer status payloads (e.g. "in Show Mode, on song 7") without new infrastructure.
