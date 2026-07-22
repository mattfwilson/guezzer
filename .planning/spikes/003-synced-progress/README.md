---
spike: 003
name: synced-progress
type: standard
validates: "Given two logged-in users, when user A bumps their progress, then user B sees A's new number without a manual refresh"
verdict: VALIDATED
related: [002, 004]
tags: [supabase, realtime, postgres-changes, rls, multi-user, throwaway]
---

# Spike 003: Synced Progress

Proves the "understand each other's progress" goal. Shares the demo built in
**spike 002** (`../002-supabase-multiuser/app/`) — no separate code.

## What This Validates

Given two users logged in on separate devices, when user A taps **🎵 +1 caught**,
then user B's friend list updates A's count **live** (no refresh), and RLS stops
either user from editing the other's row.

## Research

- **Table:** `public.progress` (one row/user) — see `../002-supabase-multiuser/seed/schema.sql`.
- **Live transport:** Supabase Realtime **`postgres_changes`**. The table is added
  to the `supabase_realtime` publication; the client subscribes to `*` events and
  re-pulls the 5-row table on any change (cheap; avoids hand-merging payloads).
- **Security:** RLS — `select` open to all `authenticated`; `insert`/`update`
  gated to `auth.uid() = user_id`. This is the "read everyone, write only
  yourself" shape the real build needs.
- **Write path:** optimistic local increment, then `update(...).eq('user_id', me)`.
  A failed write (offline) toasts and the next live pull reconciles.

## How To Run

Same setup and server as spike 002. Open two windows as `gizz1` and `gizz2`; tap
**+1 caught** in one and watch the other.

## What To Expect

- Tapping **+1** bumps your big number instantly and, within a moment, updates
  your row in the other window's friend list (reordered by count).
- Counts survive reload (they're server-side, re-pulled on boot).
- Attempting to write another user's row is rejected by RLS (not exposed in the
  UI; verifiable via the SQL editor / network tab).

## Investigation Trail

1. Reused the 002 demo. `progress` table + RLS + realtime publication in
   `schema.sql`. Client: `channel('progress-feed').on('postgres_changes', …)`.
2. Chose full re-pull over payload-patching — 5 rows, simplest correct thing.
3. **Live run, two remote devices:** tapping **+1 caught** on one device moved the
   count on the other within ~a second and reordered the list — no manual refresh.

## Results

**Verdict: VALIDATED ✓** — cross-device progress sync via `postgres_changes` feels
immediate at this scale, across a real network (one device tunneled). The
read-all / write-own RLS shape is confirmed as the right model for "see each
other's progress." Full-table re-pull on change is fine for a handful of rows;
the real build can keep that simplicity or patch payloads if the table grows.
