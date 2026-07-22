# Architecture Research

**Domain:** Multi-user sync layer for an offline-first PWA (Supabase auth + Postgres + Realtime bolted onto a shipped, pure-core React/Vite app)
**Researched:** 2026-07-22
**Confidence:** HIGH (approach is spike-validated 002–004; the open items below are design choices, not feasibility unknowns)

> **Scope note.** The multi-user *approach* is already validated live across two remote devices (see `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md`). This document does not re-derive it — it designs the **integration** into the existing v1.2 architecture: where the client lives, the data model, the sync/offline strategy, the auth boot flow, local-data namespacing, and a de-risked build order. All findings are grounded in the real shipped files (`useDexStats.ts`, `deriveDex`, `db.ts`, `App.tsx`, `AppShell.tsx`, `config.ts`, `vite.config.ts`).

---

## The One Load-Bearing Constraint

Everything below flows from a single rule that must not bend:

> **`packages/core` stays pure. All Supabase auth/networking lives in `packages/app`. The Supabase client is never imported — transitively or directly — from `packages/core`.**

Core is already compile-time-fenced (`"lib": ["ES2023"]`, no DOM, no React, no `@supabase/*` dependency in its `package.json`, `erasableSyntaxOnly`). The integration **preserves** that fence: the only thing core gains is one new *pure* function — `deriveDexSummary(DexStats): DexSummary` — that takes the already-derived dex and returns a small serializable object. It touches no network, no Dexie, no `window`. The app layer does all the pushing, pulling, subscribing, and session handling.

This mirrors the existing discipline exactly: `deriveDex` / `compareDexes` are pure and DB-free; `useDexStats` (app) wires them to Dexie via `useLiveQuery`. The sync layer is the same shape — pure core derivation, app-layer I/O.

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     packages/app  (React / Vite / DOM)               │
│                                                                      │
│  ┌────────────┐   ┌──────────────┐   ┌───────────────┐              │
│  │ AppShell   │   │  FriendsView │   │  Presence UI  │              │
│  │ (identity  │   │ (read-all    │   │ (online dots, │              │
│  │  affordance)│  │  progress)   │   │  wave toasts) │              │
│  └─────┬──────┘   └──────┬───────┘   └───────┬───────┘              │
│        │                 │                   │                      │
│  ┌─────┴─────────────────┴───────────────────┴──────────────┐      │
│  │                packages/app/src/sync/  (NEW)              │      │
│  │  supabase.ts   useSession.ts   useProgressSync.ts         │      │
│  │  useFriends.ts usePresence.ts  syncQueue.ts               │      │
│  │  ── the ONLY module that imports @supabase/supabase-js ── │      │
│  └───┬───────────────────────┬──────────────────────┬───────┘      │
│      │ reads DexStats         │ reads/writes Dexie    │             │
│  ┌───┴────────────┐   ┌───────┴────────┐             │             │
│  │ useDexStats.ts │   │   db.ts (Dexie)│             │             │
│  │ (useLiveQuery  │   │  LOCAL SOURCE  │             │             │
│  │  + deriveDex)  │   │   OF TRUTH     │             │             │
│  └───┬────────────┘   └────────────────┘             │             │
│      │ calls (pure)                                   │             │
├──────┼───────────────────────────────────────────────┼─────────────┤
│      │            packages/core  (PURE, DOM-FREE)     │             │
│  ┌───┴──────────────────────────────────────┐        │             │
│  │ deriveDex → DexStats                      │        │             │
│  │ deriveDexSummary(DexStats) → DexSummary   │ (NEW,  │             │
│  │ compareDexes                              │  pure) │             │
│  │  ✗ NEVER imports @supabase/*              │        │             │
│  └──────────────────────────────────────────┘        │             │
└──────────────────────────────────────────────────────┼─────────────┘
                                                        │ HTTPS / WSS
                            ┌───────────────────────────┴───────────┐
                            │   Supabase (hosted; no server we run)  │
                            │  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
                            │  │ GoTrue   │ │ Postgres │ │Realtime │ │
                            │  │ (auth)   │ │ progress │ │presence │ │
                            │  │          │ │ + RLS    │ │+broadcast│ │
                            │  └──────────┘ └──────────┘ └─────────┘ │
                            └────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `sync/supabase.ts` (NEW) | The single `createClient(URL, ANON_KEY)` singleton | Thin app-layer module; reads `import.meta.env.VITE_SUPABASE_*` |
| `sync/useSession.ts` (NEW) | Offline-safe auth boot; expose `{ session, user, status }` | `getSession()` sync restore + `onAuthStateChange` |
| `sync/useProgressSync.ts` (NEW) | Push my derived dex **summary** to `progress` on change | Consumes `useDexStats()`; debounced upsert; enqueue when offline |
| `sync/useFriends.ts` (NEW) | Read all friends' progress rows, live | `select *` + `postgres_changes` re-pull |
| `sync/usePresence.ts` (NEW) | Who's online + wave/reaction broadcast | One Realtime channel, presence + broadcast, **no DB** |
| `sync/syncQueue.ts` (NEW) | Offline write-queue for the one pending summary | Dexie table or `meta` row; flush on reconnect |
| `core/dex/dex-summary.ts` (NEW) | **Pure** `deriveDexSummary(DexStats): DexSummary` | Zero I/O; mirrors `compare.ts` shape |
| `useDexStats.ts` (consumed, not changed) | Reactive `DexStats` from Dexie | Unchanged — `useProgressSync` subscribes to it |
| `db.ts` (MODIFIED) | Local source of truth; add `version(6)`: `syncQueue` + `userId` claim | Additive Dexie migration (v5 precedent) |
| `App.tsx` (MODIFIED) | Mount session gate + presence + friend/wave toasts | Wrap tree; render offline regardless of network |
| `AppShell.tsx` (MODIFIED) | Header identity affordance (avatar/name → account sheet) | Rebrand already done ("Gizz With Friends") |
| `config.ts` (MODIFIED) | New `sync` block (channel name, table name, debounce, presence copy) | Single-config-file ethos |

---

## Recommended Project Structure

```
packages/
├── core/src/
│   └── dex/
│       ├── derive-dex.ts        # UNCHANGED — deriveDex → DexStats
│       ├── compare.ts           # UNCHANGED — compareDexes
│       └── dex-summary.ts       # NEW (pure): deriveDexSummary(DexStats) → DexSummary
│
├── app/src/
│   ├── sync/                    # NEW — the ONLY home of @supabase/supabase-js
│   │   ├── supabase.ts          #   createClient singleton (env-driven)
│   │   ├── useSession.ts        #   getSession() boot + onAuthStateChange
│   │   ├── useProgressSync.ts   #   push my DexSummary on change (+ offline queue)
│   │   ├── useFriends.ts        #   read-all progress + realtime re-pull
│   │   ├── usePresence.ts       #   presence + wave/reaction broadcast (no DB)
│   │   ├── syncQueue.ts         #   offline write-queue flush-on-reconnect
│   │   └── namespaceLocalData.ts#   first-login userId claim / guard
│   ├── components/
│   │   ├── LoginGate.tsx        # NEW — email/password sign-in (online-only path)
│   │   ├── AccountSheet.tsx     # NEW — identity + sign-out (opened from header)
│   │   └── AppShell.tsx         # MODIFIED — header identity affordance
│   ├── friends/                 # NEW — the shared-progress + presence surface
│   │   ├── FriendsView.tsx      #   friends' completion %, catches, rarest
│   │   └── PresenceRow.tsx      #   online dots + wave buttons
│   ├── dex/useDexStats.ts       # UNCHANGED (consumed by useProgressSync)
│   ├── db/db.ts                 # MODIFIED — version(6): syncQueue + userId
│   ├── config.ts                # MODIFIED — config.sync block
│   └── App.tsx                  # MODIFIED — session gate + presence mounts
│
└── ../supabase/                 # NEW (repo root, outside the bundle)
    ├── schema.sql               # progress table + RLS + realtime publication
    └── seed-users.mjs           # GoTrue admin API, service_role via env (NEVER committed)
```

### Structure Rationale

- **`sync/` is a hard boundary.** Concentrating every `@supabase/*` import in one folder makes the core-purity rule *auditable in one place* and gives you a single lint target (an `import/no-restricted-paths` or `no-restricted-imports` rule: "`@supabase/*` may only be imported under `app/src/sync/`, never anywhere in `packages/core`"). Same discipline that keeps `parseAndMergeImport` out of `CompareView`.
- **`dex-summary.ts` lives in core, not app.** The *shape* of what gets shared is domain logic (which numbers are "your progress") and must be unit-testable from Node with fixture setlists — exactly like `deriveDex` and `compareDexes`. Only the *transport* is app-side.
- **`friends/` is a new view surface, parallel to `dex/` and `explore/`.** It reads the network mirror, never Dexie directly.
- **`supabase/` sits at repo root, outside `packages/app`,** so the seed script and schema never ride the client bundle and the `service_role` key never gets near Vite.

---

## Data Model

### Postgres: one durable table — `progress`

Each user owns exactly one row: a **derived summary** of their dex, computed locally by `deriveDexSummary` and pushed on change. This is the spike's `progress` table widened from the two-column proof to the real dex summary.

```sql
create table public.progress (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  completion_pct int  not null default 0,   -- DexStats.completion.pct
  songs_caught   int  not null default 0,   -- DexStats.completion.caught
  total_songs    int  not null default 0,   -- DexStats.completion.total
  shows_count    int  not null default 0,   -- DexStats.showCount
  rarest_song_id int,                        -- DexStats.rarestCatch?.songId (nullable)
  rarest_tier    text,                        -- DexStats.rarestCatch?.tier   (nullable)
  per_album      jsonb,                       -- OPTIONAL: {albumUrl:{caught,total}} (see below)
  updated_at     timestamptz not null default now()
);

alter table public.progress enable row level security;

-- read-all / write-own (the non-negotiable RLS shape)
create policy "read all"   on public.progress for select to authenticated using (true);
create policy "write own"  on public.progress for insert to authenticated with check (auth.uid() = user_id);
create policy "update own" on public.progress for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- REQUIRED or postgres_changes silently never fires
alter publication supabase_realtime add table public.progress;
```

**Column-choice guidance (MEDIUM confidence — confirm with owner during requirements):**
- **Ship the flat scalar columns first** (`completion_pct`, `songs_caught`, `total_songs`, `shows_count`, `rarest_*`). They map 1:1 onto `DexStats` fields the FriendsView needs and keep the table trivially indexable/sortable ("who has the highest completion").
- **`per_album` is optional and deferred.** It's the natural extension for a richer friends-diff, but it bloats the row and isn't needed for the headline "completion % / catches / rarest" view. Model it as `jsonb` only if a per-album friend comparison lands; otherwise omit the column. **Do NOT push the full `perSong` map** — that's ~264 entries per user and belongs to the file-export/`compareDexes` path, not the live table. (If a full head-to-head friends diff is wanted later, reuse the existing export-envelope + `compareDexes` flow, not the `progress` row.)

> **Key architectural distinction preserved:** nothing is *stored* that can be *derived*. The `progress` row is a **projection**, not a source of truth — it's regenerated from `deriveDex` on every change. If a row is lost, the next local dex change rebuilds it. This mirrors "Pokédex counts derived, never hand-tallied" exactly, just projected one hop further to the server.

### Realtime: presence + broadcast (never Postgres)

One channel carries all ephemeral activity. No rows, no persistence — matches the spike's validated `gizz-room` design.

```js
const ch = sb.channel("gizz-room", { config: { presence: { key: userId } } });

ch.on("presence", { event: "sync" }, () => {
  onlineIds = Object.keys(ch.presenceState());
})
  .on("broadcast", { event: "wave" }, ({ payload }) => showWaveToast(payload))
  .subscribe(async (s) => {
    if (s === "SUBSCRIBED") await ch.track({ name: displayName, at: Date.now() });
  });

// wave/reaction — to:null = everyone
ch.send({ type: "broadcast", event: "wave", payload: { from: userId, to: null } });
```

- **Presence state** = "who's online." The tracked payload starts as `{ name, at }`.
- **Broadcast `wave`** = lightweight reactions/pings, surfaced as a non-blocking toast (reuse the `BackupToast` / `useBingoCelebrations` precedent — a module emitter rendered once at `App.tsx`).
- **Forward-compatible status:** the same `ch.track({ ... })` payload later carries `{ status: "in Show Mode", song: 7 }` with **zero new infrastructure** — this is the intended path to "see what they're doing" without reopening the deferred SOCL-V2-01 (full collaborative setlist co-tracking stays out of scope).

---

## Sync Strategy — Dexie-as-local-truth ↔ Supabase-as-shared

### The core insight: this is a **low-conflict, one-way projection**, not bidirectional sync

Each user writes **only their own row** (RLS `write own`). No two clients ever contend for the same row. That collapses the entire hard problem of offline sync:

- **No merge logic on the server side.** Last-write-wins is correct *by construction* — the only writer of your row is you, across your own devices, and a newer local dex always supersedes an older push.
- **Dexie stays the single local source of truth.** The `progress` row is downstream of it, never upstream. Reads from the server (`useFriends`) populate *other people's* numbers only; they never write back into your Dexie tables. Your own numbers on screen always come from `useDexStats` (local), never from a server round-trip — so the UI is correct offline and instant.

### Write path (push my summary on change)

```
Dexie write (mark show / log song / import)
    ↓ useLiveQuery re-fires
useDexStats() → fresh DexStats
    ↓ useProgressSync (app)
deriveDexSummary(DexStats) → DexSummary   [PURE core]
    ↓ shallow-equal vs last-pushed? skip : proceed
    ↓ debounce (config.sync.PUSH_DEBOUNCE_MS)
  online?  ── yes ──▶ sb.from("progress").upsert(summary, { onConflict: "user_id" })
     │
     └── no ──▶ syncQueue.put(summary)   (Dexie; overwrites — only the LATEST matters)
```

- **`useProgressSync` subscribes to the existing `useDexStats()` hook** — it does not re-read Dexie or re-derive independently. One derivation, one reactive source (the same rule `useDexStats` enforces internally).
- **Change-gated + debounced.** A dex change fires the live query; the hook diffs the new `DexSummary` against the last-pushed one and only upserts on a real change, debounced so a burst of logs during a show coalesces into one write. (Note: this is *our* Supabase, not the volunteer kglw API — the 1/60s etiquette rule does not apply here; debounce is a cost/noise choice, not a politeness one.)
- **Upsert the whole summary keyed `onConflict: "user_id"`.** (The spike upserted only identity columns to avoid resetting counts written by a *different* actor; here the same client owns identity and counts, so upserting the whole summary is correct and simplest.)

### Offline write-queue (flush on reconnect)

- **A `syncQueue` Dexie table (or a single `meta` row) holds at most the one pending latest summary.** Because only the newest matters and no one else writes your row, the offline queue is not an append log — it's a **single overwriting slot**. Deliberately trivial: no ordering, no dedupe, no conflict.
- **Flush trigger:** the app already has `live/useOnlineStatus.ts`. `useProgressSync` watches it; on `offline → online` (and on a session token becoming valid again), it drains the slot with one upsert, then clears it.
- **Token-staleness caveat (the spike's one open item):** an *unexpired* access token writes fine on reconnect; a *very stale* token needs a refresh (network) before the write succeeds. Handle as a reconnect/UX detail — the queue simply retries after `onAuthStateChange` fires a refreshed session. Not an architecture change.

### Read path (friends' progress, live)

```
subscribe: sb.channel("progress-feed")
  .on("postgres_changes", { event:"*", schema:"public", table:"progress" }, refresh)
  .subscribe()
refresh() → sb.from("progress").select("*")  → useFriends state → FriendsView
```

Full-table re-pull on any change is fine for ~5 rows (the spike's guidance; patch payloads only if the table ever grows large — it won't at <10 users).

### Why this is safe against the offline-first core value

- The app **never blocks on the network** to render your own dex — that comes from Dexie.
- A friend's numbers being stale (offline) degrades gracefully to "last known," never to a broken screen.
- The `progress` projection can be wiped and rebuilt from local truth at any time.

---

## Auth / Session Boot Flow (must NOT block startup on network)

This is the highest-risk seam (the venue-with-no-signal case) and therefore **build-order phase 1**. The spike validated the offline boot live; the integration must preserve it.

```
App mounts
    ↓
useSession():  const { data } = await sb.auth.getSession()   ← reads localStorage, NO network
    ↓                                                           (synchronous restore)
  session?  ── yes ──▶  status = "authed"  → render full app (offline-capable)
     │                   register onAuthStateChange(...) to reconcile refresh/logout
     │
     └── no ──▶  online?  ── yes ──▶  render <LoginGate/> (email/password)
                    │
                    └── no ──▶  render "sign in when you have signal" hint
                                (NEVER a spinner that hangs the app)
```

Rules (all from the validated blueprint):
- **`getSession()` first, never a live `getUser()`/network check to gate startup.** An unexpired token in localStorage boots the whole app with zero round-trips.
- **`onAuthStateChange` reconciles** login/logout/token-refresh *after* first paint — it is a subscription, not a boot gate.
- **Auth = pre-made email/password accounts** (hand out N credentials, created via GoTrue admin API with `email_confirm:true`). **No magic-link / OTP** — a mail round-trip at a venue with bad signal is the wrong failure mode.
- **The `LoginGate` is the only network-dependent screen, and it only appears when there is genuinely no restorable session.** Once signed in, the token persists and offline boot works forever after (until expiry + no reconnect).

**Existing-user reality:** the app already ships and people have local dexes *before* any account exists. So the login gate must be **non-destructive and deferrable** — the app should remain fully usable pre-login for the existing single-user experience, with sync/presence simply inactive until first sign-in. This also de-risks rollout: v2.0 can ship auth without forcing every user through it on day one.

---

## Namespacing Existing Single-User Local Data Under a userId

Today the Dexie DB is a fixed name (`config.DB_NAME = "guezzer"`) and identity is a free-text `meta.ownerName`. On first login we must bind the existing local dex to the authenticated `user_id` **without moving or copying data** (the personal tool is one-human-per-device in practice).

**Recommended approach — a `userId` claim in `meta`, not a per-user database:**

1. On first successful sign-in, read `meta.userId`.
   - **Unset (the common case):** the existing local data is unclaimed → **claim it**: write `meta.userId = session.user.id` and backfill `meta.ownerName` from the account's `display_name` if empty. The device's existing dex simply *becomes* this user's dex. No migration, no data movement.
   - **Set and equal:** normal boot, nothing to do.
   - **Set and *different* (a second person signs in on the same device — rare):** do **not** silently merge. Guard it: either (a) refuse and prompt "this device already holds {name}'s dex — export first," or (b) namespace a *separate* Dexie DB `guezzer:{userId}` for the new user. Recommend (a) for v2.0 simplicity; (b) only if shared-device use actually emerges.

**Why `meta.userId` over per-user DB names:** the whole app (`db.ts`, `useDexStats`, every write helper) is hard-wired to the single `db` singleton. Renaming the DB per user would thread a userId through `new GuezzerDB()` construction and every module that imports `db`. A `meta.userId` claim is additive, testable, and leaves the existing single-user code path byte-identical. It's the same idiom as the existing `meta.ownerName` fork key.

- **Dexie migration:** `version(6)` adds the `syncQueue` table (new table → no `.upgrade` needed, per the v4/v5 precedent) and formalizes the `userId` meta key (a `meta` row, not a schema change). Fully additive; a populated v5 DB upgrades in place losslessly.
- **`display_name`** is the account's, sourced from `user_metadata.display_name` (set at seed time) — this becomes both the `progress.display_name` and the local `meta.ownerName`, unifying the two identity notions (and the existing `CompareView` / `ownerMatch` "whose dex is this?" fork keeps working).

---

## Environment & Deploy

- **Client secrets (safe in the bundle):** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is public by design; RLS is the actual security boundary. Read via `import.meta.env.VITE_*` in `sync/supabase.ts` — **no `vite.config.ts` change required** (Vite exposes `VITE_`-prefixed env automatically; do not add them to `define`).
- **Local dev:** `.env.local` (git-ignored) with the two `VITE_` vars.
- **Deploy:** set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as build-time env in the static host (Vercel/Netlify/GitHub Pages env settings). The build stays pure-static — Supabase is a hosted dependency, no server we run. Deploy target unchanged.
- **`service_role` key:** env-only, consumed **only** by `supabase/seed-users.mjs` (Node ≥18 `fetch`, dependency-free). Never committed, never `VITE_`-prefixed, never in the client bundle. Real per-person passwords live in the seeder's env, not git.
- **PWA/service-worker:** no Workbox change needed — Supabase calls are runtime `fetch`/WebSocket, not precached assets. The existing `registerType: 'prompt'` + `clientsClaim` config is untouched. **Do not** add Supabase endpoints to `globPatterns`; live data must never be precached.
- **`config.ts` additions (single-config-file ethos):** a new `sync` block — `PROGRESS_TABLE: "progress"`, `PRESENCE_CHANNEL: "gizz-room"`, `PROGRESS_CHANNEL: "progress-feed"`, `PUSH_DEBOUNCE_MS`, plus presence/wave copy strings. No magic strings scattered in the `sync/` modules.

---

## Architectural Patterns

### Pattern 1: Pure derivation, app-layer transport (the core-purity contract)

**What:** The *shape* of shared state is a pure core function; the *movement* of it is app-only.
**When to use:** Every piece of durable shared state.
**Trade-offs:** One extra tiny function vs. an ironclad, lint-enforceable purity boundary and Node-testable summary logic.

```typescript
// packages/core/src/dex/dex-summary.ts  — PURE, no I/O, no @supabase/*
import type { DexStats } from "./derive-dex.ts";

export interface DexSummary {
  completionPct: number;
  songsCaught: number;
  totalSongs: number;
  showsCount: number;
  rarestSongId: number | null;
  rarestTier: string | null;
}

export function deriveDexSummary(dex: DexStats): DexSummary {
  return {
    completionPct: dex.completion.pct,
    songsCaught: dex.completion.caught,
    totalSongs: dex.completion.total,
    showsCount: dex.showCount,
    rarestSongId: dex.rarestCatch?.songId ?? null,
    rarestTier: dex.rarestCatch?.tier ?? null,
  };
}
```

```typescript
// packages/app/src/sync/useProgressSync.ts — app layer owns ALL networking
import { deriveDexSummary } from "@guezzer/core";
import { useDexStats } from "../dex/useDexStats.ts";
// ...subscribe to useDexStats(), deriveDexSummary(dex), debounce, upsert-or-enqueue.
```

### Pattern 2: Projection, not a second source of truth

**What:** `progress` is a regenerable projection of Dexie-derived `DexStats`, one hop further than the Pokédex projection of attendance.
**When to use:** Any server-mirrored user state.
**Trade-offs:** A transient stale row on the server is harmless (next change rebuilds it); the cost is you must never *read your own numbers back* from the server (always render from local `useDexStats`).

### Pattern 3: Single-slot offline write-queue (last-write-wins)

**What:** Offline writes overwrite one slot rather than appending a log, because only the newest summary matters and no one else writes your row.
**When to use:** Idempotent, own-row-only writes.
**Trade-offs:** Trivially simple and conflict-free; loses intermediate history (irrelevant here — nobody wants your dex's step-by-step deltas).

### Pattern 4: Module-emitter toast for ephemeral events

**What:** Waves/reactions surface via a module emitter rendered once at `App.tsx`, exactly like `BackupToast` and `useBingoCelebrations`.
**When to use:** Presence-driven, cross-tab, non-blocking notifications.
**Trade-offs:** Reuses a proven pattern; the live logging loop is never intercepted (the loop stays sacred).

---

## Data Flow

### Write (my progress → shared)

```
mark show / log song / import backup
    ↓ Dexie write-through
useLiveQuery re-fires → useDexStats → DexStats
    ↓ useProgressSync
deriveDexSummary (pure) → diff vs last → debounce
    ↓ online?
  yes → upsert progress (own row, RLS write-own)
  no  → syncQueue slot ← summary ; flush on useOnlineStatus → online
```

### Read (friends → my screen)

```
postgres_changes on progress  ─▶ re-pull select *  ─▶ useFriends ─▶ FriendsView
presence sync / broadcast wave ─▶ usePresence ─▶ online dots + wave toast
```

### Boot (offline-safe)

```
mount → getSession() [localStorage, no net] → authed? render app : (online? LoginGate : hint)
                                             → onAuthStateChange reconciles after paint
```

---

## Scaling Considerations

| Scale | Adjustments |
|-------|-------------|
| ~5–10 users (target) | Everything above as written. Full-table re-pull, single channel, one row per user. Supabase free tier covers it comfortably. |
| ~50 users (implausible) | Switch `useFriends` from full re-pull to `postgres_changes` patch payloads; index `progress(completion_pct)` for a leaderboard sort. |
| 100+ (out of scope) | Not a design goal — this is a <10-friend personal tool. Do not build for it. |

### Scaling Priorities

1. **First "bottleneck" is not load, it's token refresh at venues** — the one validated open item. Prioritize a clean reconnect/retry UX in `useProgressSync` over any throughput concern.
2. **Realtime connection churn** on flaky venue signal — let the Supabase client's built-in reconnect handle it; don't hand-roll. Re-`track()` presence on resubscribe.

---

## Anti-Patterns

### Anti-Pattern 1: Importing the Supabase client from `packages/core`

**What people do:** Reach for `sb` inside a core derivation to "just push it here."
**Why it's wrong:** Violates the pure-core constraint, adds a DOM/network dependency to a Node-runnable module, breaks the compile-time fence.
**Do this instead:** Core exposes `deriveDexSummary` (pure); `app/src/sync/` does the push. Enforce with a lint boundary rule scoped to `app/src/sync/`.

### Anti-Pattern 2: Gating app startup on a live auth/network check

**What people do:** `await getUser()` or a connectivity probe before first render.
**Why it's wrong:** Breaks the dead-signal venue case — the core value. A spinner that never resolves offline is the exact failure this project exists to avoid.
**Do this instead:** `getSession()` synchronous restore; reconcile via `onAuthStateChange` after paint.

### Anti-Pattern 3: Persisting presence/waves to Postgres

**What people do:** Log "who's online" or waves to a table for history.
**Why it's wrong:** They're ephemeral by design; a table adds RLS surface, write load, and cleanup for zero value.
**Do this instead:** Realtime presence + broadcast only. No rows.

### Anti-Pattern 4: Treating the `progress` row as a source of truth

**What people do:** Read your own completion % back from the server, or store data there that isn't derivable.
**Why it's wrong:** Reintroduces the exact "stored count that drifts from reality" bug the derived-Pokédex design eliminated; makes offline reads wrong.
**Do this instead:** Server row is a write-only projection *for you*; your screen reads local `useDexStats`. Only *friends'* numbers come from the server.

### Anti-Pattern 5: Forgetting `alter publication supabase_realtime add table progress`

**What people do:** Create the table + RLS, subscribe, and wonder why nothing updates.
**Why it's wrong:** Without adding the table to the publication, `postgres_changes` silently never fires (validated gotcha).
**Do this instead:** Include the `alter publication` line in `schema.sql` as a required step.

### Anti-Pattern 6: Committing `service_role` or shared passwords

**What people do:** Hardcode the admin key in the seed script or a committed `.env`.
**Why it's wrong:** `service_role` bypasses RLS entirely — a full compromise.
**Do this instead:** `service_role` + per-person passwords via env only, in a git-ignored seeder env. Only the anon key ships.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth (GoTrue) | `signInWithPassword` + `getSession` (sync restore) + `onAuthStateChange` | Pre-made email/password; `email_confirm:true` at seed; no OTP/magic-link |
| Supabase Postgres | `from("progress").upsert/select` under read-all/write-own RLS | One row/user; projection of `DexStats`; add table to realtime publication |
| Supabase Realtime | One channel: presence (who's online) + broadcast (waves); `progress-feed` channel for `postgres_changes` | Ephemeral only; forward-compatible status payload |
| `@supabase/supabase-js` v2 | npm dependency of `packages/app` **only** (not core) | Spike cites v2.91+ current as of 2026-07; pin latest v2 at build — **verify the exact current version at implementation time** (LOW confidence on the specific patch, HIGH on "v2") |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `core/dex` ↔ `app/sync` | `app/sync` imports pure `deriveDexSummary` from `@guezzer/core` | One-directional; core never imports app or `@supabase/*` |
| `app/sync` ↔ `useDexStats` | `useProgressSync` subscribes to the existing hook | No second Dexie read / re-derivation — one reactive source |
| `app/sync` ↔ `db.ts` | `syncQueue` table (v6) + `meta.userId` claim | Additive migration; `useDexStats`/write-helpers untouched |
| `app/sync` ↔ `App.tsx` | Session gate + presence mounts + wave-toast emitter | Renders offline regardless of network |
| `AppShell.tsx` ↔ `AccountSheet` | Header identity affordance opens account/sign-out sheet | Rebrand ("Gizz With Friends") already shipped |

---

## Suggested Build Order (de-risk auth/identity first)

The residency run — not show #1 — is the target; the core app is already show-ready. Order the work so the riskiest seam (offline-safe identity) is proven before anything depends on it.

**Phase A — Auth & Identity Foundation** *(de-risks the offline-boot concern first)*
- `supabase/schema.sql` (progress table + RLS + publication) and `supabase/seed-users.mjs` (service_role env).
- `sync/supabase.ts` (client singleton, env-driven) + the lint boundary rule.
- `sync/useSession.ts` — `getSession()` sync restore + `onAuthStateChange`; prove offline boot on-device (the one validated-but-critical path).
- `components/LoginGate.tsx` + `AccountSheet.tsx`; `AppShell.tsx` identity affordance.
- `db.ts` `version(6)` — `meta.userId` claim + `namespaceLocalData.ts` (first-login binding of existing local dex).
- **Exit gate:** sign in on two devices with distinct accounts; kill signal; app still boots to the full dex offline; distinct identities confirmed. (Mirrors spike 002's validated result.)

**Phase B — Shared Progress** *(depends on A's identity)*
- `core/dex/dex-summary.ts` (`deriveDexSummary`, pure) + unit tests with fixture setlists (the existing dex-derivation test discipline).
- `sync/useProgressSync.ts` (push on change, debounce, diff) + `sync/syncQueue.ts` (offline slot, flush on `useOnlineStatus`).
- `sync/useFriends.ts` (read-all + `postgres_changes` re-pull) + `friends/FriendsView.tsx`.
- **Exit gate:** mark a show offline on device 1 → reconnect → device 2's FriendsView reflects the new completion %. (Mirrors spike 003.)

**Phase C — Presence & Reactions** *(depends on A's identity; independent of B)*
- `sync/usePresence.ts` (presence + wave broadcast, no DB) + `friends/PresenceRow.tsx` + wave-toast emitter in `App.tsx`.
- **Exit gate:** device 1 sees device 2 come online; a wave from 1 toasts on 2. Forward-compatible status payload stubbed. (Mirrors spike 004.)

Rationale: A is the load-bearing risk (venue offline boot); B and C both sit on A's `session`/`userId`. B and C are mutually independent and could parallelize after A, but A must land and be device-verified first.

---

## Sources

- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — the validated blueprint (spikes 002/003/004, live across two remote devices incl. offline boot) — **HIGH confidence** on approach, offline-boot, RLS shape, presence design, and the token-refresh open item.
- Shipped codebase (read directly): `packages/core/src/dex/derive-dex.ts`, `compare.ts`; `packages/app/src/dex/useDexStats.ts`, `CompareView.tsx`; `packages/app/src/db/db.ts`; `packages/app/src/App.tsx`, `components/AppShell.tsx`, `components/BottomTabBar.tsx`; `packages/app/src/config.ts`; `packages/app/vite.config.ts`; `packages/app/src/settings/ownerMatch.ts`; `packages/core/src/data-safety/export-schema.ts` — **HIGH confidence** on integration seams and existing patterns.
- `.planning/PROJECT.md` — v2.0 milestone scope, constraints, and the Supabase key decision — **HIGH confidence**.
- `@supabase/supabase-js` exact current patch version — **LOW confidence** (cited v2.91+ from the spike; verify at implementation time via npm).

---
*Architecture research for: Multi-user Supabase foundation integrated into an offline-first pure-core PWA*
*Researched: 2026-07-22*
