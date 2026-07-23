# Phase 19: Shared Dex Progress - Research

**Researched:** 2026-07-23
**Domain:** Pure-core stat projection + reconstruction; Supabase Postgres/Realtime sync in the app fence; offline-first friends UI
**Confidence:** HIGH (reconstruction contract, sync mechanics, core-purity guard all verified against shipped source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Friends view is a **third toggle inside GizzDex** — `Albums | Shows | Friends` — view-state within `#/dex`, never a 6th bottom tab, never a new hash route. Label: **"Friends"**.
- **D-02:** Signed-in user appears as a **pinned "You" row on top**, sourced from the **live local dex (`useDexStats`)** — NOT the Supabase read — so it is always current and works fully offline.
- **D-03:** Friends below "You" ordered by **completion % descending**, tie-break by caught count, then display name. Single fixed default order (no sort switcher — PROG-F1 deferred).
- **D-04:** Each friend **list row** shows name + completion % + caught count + a **single rarest-tier badge**, reusing the shipped six-tier rarity colors.
- **D-05:** A friend who synced a row but has **0 catches** is **shown at the bottom** (`0% · 0 caught`, no badge, sorted last) — never hidden. A friend who never upserted a row simply has no row.
- **D-06:** Tapping the **"You" row opens your own trophy case** — rarest-catches showcase, **no head-to-head columns** (no self-compare).
- **D-07:** Friend detail is a **full-screen overlay** (own back/close), rendered as **view-state within the dex view** (not a new hash route). Visual is full-screen either way.
- **D-08:** Detail **leads with the head-to-head** ("You vs {name}" columns: completion %, caught, per-tier counts) — same shape as shipped `CompareView` — then per-album/per-tier breakdown (expandable), then their rarest-catches showcase.
- **D-09:** Build a **new `FriendDetail.tsx`**. Leave shipped `CompareView.tsx` **untouched**. `FriendDetail` reuses pure core (`compareDexes`) + `TierBadge` + rarity styling, fed a **reconstructed `theirs: DexStats`** (it does NOT run `deriveDex`). Some render similarity accepted for zero coupling.
- **D-10:** Rarest-catches showcase shows the friend's **top-5** rarest catches (config constant).
- **D-11:** Per-tier/per-album breakdown reuses shipped `CompareColumn` semantics and `DexStats.perAlbum`, reconstructed from the synced payload.
- **D-12:** `deriveSharedProgress(DexStats) → SharedProgress` is a **new pure-core projector** (zero Supabase import) producing the Option-B payload: `display_name`, caught count, completion %, `show_count`, rarest `{songId,tier}`, per-tier counts, `perAlbum`, and **`caughtSongIds` int[]**. Shapes the Phase-17 `summary jsonb` with zero migration.
- **D-13:** Friend **song tiers reconstructed via the local bundled rarity index** (`rarityIndex[songId].tier`) — NOT carried per-song on the wire. Payload carries `caughtSongIds` (ids only) for `perSong` reconstruction + per-tier **counts** for column display.
- **D-14 (privacy — confirmed):** The **full `caughtSongIds` int[] syncs** and is readable by all ~5 friends (read-all RLS). Required for the head-to-head diff lists; exactly what the old manual JSON handoff already exposed. Owner explicitly accepted.
- **D-15:** Own-row upsert is **debounced ~5s** after the last local dex change (config constant, tunable). Writes are **identity-safe**: an identity-only write (`user_id`, `display_name`) must never clobber the `summary` counts.
- **D-16:** The `postgres_changes` subscription is **active app-wide while signed in** (not only while the Friends toggle is open). Full ~5-row re-pull on any change.
- **D-17:** **On reconnect** (tie into existing `useOnlineStatus`/SyncDot), **flush the own row** and **re-pull all friend rows once**. Also initial upsert-own + pull on sign-in / first foreground while online.
- **D-18:** **Offline / dead-signal venue:** Friends section shows **last-known cached friend rows** (persisted locally) with a calm **"Offline · as of {time}"** marker + dimmed rows. The pinned "You" row stays **live** (local dex). Never blank.
- **D-19:** A friend's synced `summary` and `display_name` are **untrusted external data**: validate the summary shape with **zod at the read boundary** (malformed row → skipped, never crash), render friend strings as **escaped React text only, visually clamped**, and do all set arithmetic by **songId only** (never name — duplicate names in the matrix).

### Claude's Discretion

- Exact debounce constant value; config-block location (new `config.progress`/`config.friends` block; keep any core/app-mirrored constant equal across both); reconnect/first-sync wiring mechanics (D-15/16/17).
- Where the Supabase progress-sync code lives — a new app-layer module under `packages/app/src/sync/`, never imported by `packages/core`.
- Exact `SharedProgress` TypeScript shape and the reconstruction helper (as long as it feeds the **unchanged** `compareDexes`).
- Where/how the last-known friend pull is persisted (Dexie table vs localStorage) and how the "as of {time}" stamp is derived (D-18).
- Exact copy strings; visual treatment of the FriendDetail overlay, list rows, self-row.
- Rarest-showcase constant name/value (default top-5, D-10); neutral treatment of a friend with no rarest badge (D-05).

### Deferred Ideas (OUT OF SCOPE)

- **Sortable multi-key leaderboard** → PROG-F1. This phase ships one fixed default order only.
- **Per-friend live-syncing share card** → PROG-F2.
- **Historical progress timeline / night-by-night climb graph** → PROG-F3.
- **Presence dots, coarse activity, waves, reactions** → Phase 20 (PRES-01…07). Build the Friends rows to *accept* presence later (leading online-dot slot + trailing activity slot) without a rebuild.
- **Any change to the shipped file-import compare (`CompareView.tsx`)** — untouched.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROG-01 | Pure-core `deriveSharedProgress(DexStats) → SharedProgress`, Option-B payload; core never imports Supabase | §Projector Contract; zod schema lives in core (zod already a core dep). Core-purity guard (`packages/core/test/purity.test.ts`) enforces no `@supabase`. |
| PROG-02 | App upserts signed-in user's summary on dex change (debounced); write-own; identity-only writes never reset counts | §Sync Mechanics — `upsert({user_id, display_name}, {onConflict})` for identity-only; full `{…, summary}` for the debounced content write. Phase-17 kept `display_name` a first-class column for exactly this. |
| PROG-03 | Read-all / write-own RLS | **Already provisioned Phase 17** (D-02 there). No new DDL. Verified in 17-CONTEXT. |
| PROG-04 | Friends screen lists headline progress, read live | §Read Path — pinned "You" from `useDexStats`, friends from validated synced/cached rows. |
| PROG-05 | Live `postgres_changes` update; full-table re-pull fine at ~5 rows | §Sync Mechanics — app-wide subscription while signed in (D-16), full re-pull on any change. |
| PROG-06 | Live head-to-head via reconstructed `DexStats` → **unchanged** `compareDexes` | §Reconstruction Contract — **VERIFIED achievable, zero gap**. Every field `compareDexes` reads is reconstructable from the payload. |
| PROG-07 | Per-album / per-tier breakdown reusing `CompareColumn` semantics | §Reconstruction Contract — `perAlbum` reconstructed from payload; per-tier counts recomputed by `compareDexes` from reconstructed `perSong`. |
| PROG-08 | Rarest catches showcase (top-N by rarity), six-tier language/colors | §UI Reuse — top-5 from payload rarest + `caughtSongIds` sorted by local rarity; reuse `TierBadge` + `config.dex.tierColors`. |
</phase_requirements>

## Summary

This is a deliberate "reuse, don't reinvent" phase. Its hardest constraint (PROG-06) is that the live head-to-head must reach the **exact shipped `compareDexes(mine, theirs)` diff** by reconstructing a minimal `DexStats` from a synced Option-B summary — with zero change to the shipped diff logic and zero change to the shipped file-import path (`CompareView.tsx`).

**The crux is settled and it is achievable with zero fidelity loss.** I read `compareDexes` line-by-line. It reads exactly five things from each `DexStats` argument: `perSong[id].sightings` (only tested as `> 0`), `perSong[id].tier`, `completion.pct`, `completion.caught`, and `showCount`. It never reads `completion.total`, `neverSeen`, `rarestCatch`, `perAlbum`, `perSong[].lastSeenDate`, or `perSong[].personalGap`. Every one of the five it *does* read is directly reconstructable from the Option-B payload (`caughtSongIds` + local bundled `rarityIndex` + `completion` + `show_count`). There is **no `DexStats` field `compareDexes` touches that the payload cannot supply.** The "unchanged `compareDexes`" mandate is not just possible — it is clean.

The sync/reconnect/subscription wiring is already validated end-to-end across two remote devices (spikes 002–004) and captured in the `spike-findings-guezzer` skill. The RLS table, `summary jsonb` column, and `supabase_realtime` publication were all provisioned in Phase 17. The identity substrate (deterministic per-user color, `useAuthIdentity`, offline-safe boot) shipped in Phase 18. This phase is the *first data consumer* of the Phase-17 Supabase client, and it composes existing pieces.

**Primary recommendation:** Add one pure-core module (`packages/core/src/dex/shared-progress.ts`) exporting `deriveSharedProgress(dex) → SharedProgress`, a zod `sharedProgressSchema`, and a `reconstructDexStats(summary, rarityIndex) → DexStats` helper — all pure, all Node-testable, all round-trip-verified against `compareDexes`. Add one app-layer sync module under the `packages/app/src/sync/` fence that wires the debounced upsert, the app-wide `postgres_changes` subscription, the reconnect flush, and the offline cache. Feed `FriendDetail.tsx` the reconstructed `theirs` and the shipped `compareDexes`. Nothing else in core or the file-import path changes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `deriveSharedProgress` projection | **Core (pure)** | — | Pure fn of `DexStats`, zero I/O — mirrors `buildShareStats(dex, archive)`. Must stay DOM/Supabase-free (core-purity guard). |
| `SharedProgress` zod schema | **Core (pure)** | — | zod is already a `packages/core` dependency; core already exports zod schemas (`archiveArtifact`, `exportEnvelope`). App validates via the core-exported schema → app never imports zod for this. |
| `reconstructDexStats` (payload → minimal `DexStats`) | **Core (pure)** | — | Pure inverse of the projector; the round-trip fidelity invariant is unit-testable in Node. |
| `compareDexes` diff | **Core (pure, UNCHANGED)** | — | Shipped. Feed it reconstructed `theirs`. No edit. |
| Debounced own-row upsert | **App (sync fence)** | — | Touches the Supabase client + timers — must live in `packages/app/src/sync/`. |
| `postgres_changes` subscription + re-pull | **App (sync fence)** | — | Realtime channel lifecycle is app-owned (blueprint). |
| Reconnect flush + first-sync | **App (sync fence)** | App (`useOnlineStatus`/reconnect ctx) | Ties into existing connection signal. |
| Offline last-known cache | **App (Dexie)** | — | Persistence is a browser concern; recommend a Dexie table (already the app's IndexedDB layer). |
| Friends list / rows / self-row / detail overlay | **App (React)** | Core (`compareDexes`, rarity) | UI composition; reuses shipped primitives. |
| Untrusted-string escaping / clamp | **App (React)** | Core (zod schema) | React escapes by default; core zod parse gates the shape. |

## Standard Stack

**No new packages are installed in this phase.** Every dependency is already present and shipped through 18 phases.

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.4.3 (`packages/core`) | `sharedProgressSchema` — validate the untrusted synced summary at the app read boundary (D-19) | `[VERIFIED: packages/core/package.json]` Already a core dep; core already exports zod schemas that the app re-guards with. Keeps zod out of the app package. |

### Supporting (app layer — already installed)
| Library | Version (installed) | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | 2.110.8 (`packages/app`) | `.from("progress").upsert(...)`, `.channel(...).on("postgres_changes", ...)` | `[VERIFIED: packages/app/package.json]` The Phase-17 client singleton (`packages/app/src/db/supabase.ts`) is imported by the new sync module. |
| dexie | 4.4.4 (`packages/app`) | Offline last-known friend-pull cache table (D-18) | `[VERIFIED: packages/app/package.json]` Recommended over localStorage — see §Don't Hand-Roll. |
| dexie-react-hooks | 4.4.0 (`packages/app`) | `useLiveQuery` over the cache table if a reactive read of cached friends is wanted | `[VERIFIED]` Optional; the subscription callback can also drive `useState`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dexie table for offline cache | localStorage | localStorage is synchronous, 5 MB cap, string-only, worse iOS eviction story. The friend pull is small (~5 rows), but Dexie is already the app's persistence layer and CLAUDE.md explicitly bans localStorage for dex/setlist data. **Recommend Dexie.** `[CITED: CLAUDE.md "What NOT to Use"]` |
| Full-table re-pull on change | Per-row patch from the `postgres_changes` payload | At ~5 rows, full re-pull is simpler and correct (D-16, PROG-05, blueprint). Patch payloads only if the table grows large — it won't. |

**Installation:** none required — verify nothing needs adding:
```bash
# All already present; no `npm install` in this phase.
grep -n "@supabase/supabase-js\|dexie\|zod" packages/app/package.json packages/core/package.json
```

## Package Legitimacy Audit

**No external packages are installed in this phase.** All libraries used (`zod`, `@supabase/supabase-js`, `dexie`, `dexie-react-hooks`) were vetted and installed in prior phases (17/18/1) and are load-bearing across the shipped app. slopcheck is **not applicable** — there is no new install surface. If the planner adds any new package (it should not need to), gate it behind a `checkpoint:human-verify` task per the standard protocol.

## The Reconstruction Contract (PROG-06/07 — the crux)

This is the load-bearing section. It answers: *can the live head-to-head reach the exact shipped `compareDexes` diff by reconstructing `DexStats` from the payload, without touching the diff logic?* **Yes, with zero fidelity loss.**

### What `compareDexes` actually reads from each `DexStats`

Verified line-by-line against `packages/core/src/dex/compare.ts`:

| Field read | Where | How used | Reconstructable from payload? |
|------------|-------|----------|-------------------------------|
| `dex.perSong` (the Map) | `caughtSongIds()` iterates entries | `caught = sightings > 0` → the set of caught ids | **YES** — from `caughtSongIds` int[]. Set membership only. |
| `perSong[id].sightings` | `caughtSongIds()` | tested **only** as `> 0` (boolean) | **YES** — set `sightings: 1` for every caught id. Multiplicity is never read. |
| `perSong[id].tier` | `tierCounts()`, `mineTierOf`/`theirsTierOf` sort | per-tier counts + rarest-first diff-list sort | **YES** — `rarityIndex.get(id)?.tier` (D-13). Deterministic from the shared bundled corpus. |
| `completion.pct` | `column()` | column completion figure | **YES** — payload `completion.pct`. |
| `completion.caught` | `column()` | column caught figure | **YES** — payload caught count (`songs_caught`). |
| `showCount` | `column()` | column shows figure | **YES** — payload `show_count`. |

### What `compareDexes` NEVER reads (so the payload need not carry, and the reconstruction may stub)

`completion.total`, `neverSeen`, `rarestCatch`, `perAlbum`, `perSong[].lastSeenDate`, `perSong[].personalGap`. These are required only to satisfy the `DexStats` **type**, or are consumed by *other* parts of `FriendDetail` (breakdown + showcase), not by the diff.

### The minimal reconstructed `DexStats`

```ts
function reconstructDexStats(s: SharedProgress, rarity: RarityIndex): DexStats {
  const perSong = new Map<number, SongDexStats>();
  for (const songId of s.caughtSongIds) {
    perSong.set(songId, {
      songId,
      sightings: 1,                 // compareDexes only tests > 0; multiplicity never read
      lastSeenDate: null,           // not read by compareDexes
      personalGap: null,            // not read by compareDexes
      tier: rarity.get(songId)?.tier ?? null,  // D-13: local rarity index, deterministic
    });
  }
  return {
    completion: { caught: s.completion.caught, total: s.completion.total, pct: s.completion.pct },
    perSong,
    neverSeen: [],                  // not read by compareDexes
    rarestCatch: s.rarest,          // used by the showcase (PROG-08), not by the diff
    showCount: s.showCount,
    perAlbum: new Map(s.perAlbum.map((a) => [a.key, { caught: a.caught, total: a.total }])), // PROG-07 breakdown
  };
}
```

### Why D-13 (tier-from-local-index) is faithful — the key correctness argument

`buildRarityIndex` (`packages/core/src/dex/rarity.ts`) is a **pure function of the static bundled show archive**: tier is a tie-inclusive band lookup on corpus `playCount`, with *no* songId tie-break, so equal playCounts always share a tier. Every client ships the **same** bundled archive artifact per deploy. Therefore the tier a friend's own client would assign to song `X` is bit-identical to the tier *your* client's `rarityIndex.get(X).tier` assigns. Reconstructing tiers locally reproduces exactly what a full `deriveDex(theirs)` would have produced — which is why per-song tiers are redundant on the wire. `[VERIFIED: packages/core/src/dex/rarity.ts + useDexStats.ts module-memoized single index]`

**One low-risk caveat (flagged):** this fidelity holds *only while every client runs the same bundled corpus version.* A client on a stale service-worker cache (older archive) could reconstruct a slightly different tier for a song near a band boundary. This is already mitigated by the app's `registerType: 'prompt'` SW discipline (users refresh between shows) and is identical to the corpus-version assumption the whole app already rests on. See §Common Pitfalls #3.

### The round-trip invariant (what the core test pins)

For any fixture `theirsSnapshot`:
```
compareDexes(mine, deriveDex(theirsSnapshot, …))
  ===
compareDexes(mine, reconstructDexStats(deriveSharedProgress(deriveDex(theirsSnapshot, …)), rarityIndex))
```
The diff lists (`onlyMine`/`onlyTheirs`/`shared`) and the `theirs` column (`completion`, `caught`, `shows`, `tierCounts`) must be **deep-equal**. This is the single most load-bearing test in the phase (§Validation Architecture).

Two invariants the projector must uphold for this to hold (both trivially true since both derive from the same dex):
1. `deriveSharedProgress(dex).caughtSongIds` === the set `{id : dex.perSong.get(id).sightings > 0}` (i.e. exactly `compareDexes`' own `caughtSongIds(dex)`).
2. `deriveSharedProgress(dex).completion.caught` === `|caughtSongIds|` === `dex.completion.caught`.

**Confidence: HIGH.** Grounded entirely in shipped source, not assumption.

## Projector Contract (PROG-01)

New pure-core module `packages/core/src/dex/shared-progress.ts`, exported through `packages/core/src/index.ts` beside `compareDexes`. Mirrors the `buildShareStats(dex, archive) → CollectionShareCard` idiom (pure projection of a derived `DexStats`, zero I/O).

```ts
import type { DexStats } from "./derive-dex.ts";
import type { RarityTier, RarityIndex } from "./rarity.ts";
import { z } from "zod";

export interface SharedProgress {
  /** Payload schema version — bump only on a breaking shape change (forward-compat read guard). */
  v: 1;
  completion: { caught: number; total: number; pct: number };
  showCount: number;
  /** Rarest caught song (for the showcase headline + row badge). Null when 0 catches. */
  rarest: { songId: number; tier: RarityTier } | null;
  /** Count of caught songs per tier (list/column display; also cross-checkable against reconstruction). */
  tierCounts: Record<RarityTier, number>;
  /** perAlbum as a JSON-serializable array (Map is not JSON-serializable). */
  perAlbum: Array<{ key: string; caught: number; total: number }>;
  /** D-14: the full caught-song id set — the ONLY input the diff set-arithmetic needs. Sorted ascending (determinism). */
  caughtSongIds: number[];
}

export function deriveSharedProgress(dex: DexStats): SharedProgress { /* pure projection */ }

/** D-19: validate an untrusted synced summary at the app read boundary. safeParse → null on failure. */
export const sharedProgressSchema: z.ZodType<SharedProgress> = z.object({ /* … */ });
export function parseSharedProgress(raw: unknown): SharedProgress | null { /* safeParse wrapper */ }

/** Pure inverse: minimal DexStats for the UNCHANGED compareDexes (see Reconstruction Contract). */
export function reconstructDexStats(summary: SharedProgress, rarity: RarityIndex): DexStats { /* … */ }
```

**`display_name` note (discretion — D-12 lists it in the payload, Phase-17 D-01 makes it a first-class column).** Recommended resolution: keep `deriveSharedProgress` a **pure function of `DexStats` alone** (no identity leak — matches `buildShareStats`'s dex-only signature) and let the app compose the `display_name` **column** on write from `useAuthIdentity`. The row is `{ user_id, display_name (column), summary (SharedProgress jsonb), updated_at }`. On read, `display_name` comes from the **column** (authoritative — present even for identity-only rows). This satisfies PROG-01's "payload includes display_name" at the row level and keeps the projector clean. If the planner prefers literal payload completeness, `deriveSharedProgress(dex, displayName)` returning a `displayName` field is an acceptable alternative — dual-write the column and treat the column as authoritative on read. **Flag as a discretion decision for the planner.**

**`tierCounts` redundancy (note, not a gap):** `compareDexes` recomputes `tierCounts` from the reconstructed `perSong` (deterministic, identical to the payload's). The payload's `tierCounts` therefore exists for **cheap list-level display** (rendering the friend row / column without reconstructing the whole `perSong`), and as a self-check. Carrying it is cheap and matches D-12; it is not consumed by the diff.

## Sync Mechanics (PROG-02/03/05)

New app-layer module under the fence, e.g. `packages/app/src/sync/progressSync.ts` (+ a React hook `useFriendsProgress.ts`). Imports the Phase-17 `supabase` singleton; **never imported by `packages/core`.**

### Write path (D-15 debounced own-row upsert)
```ts
// Content write — the debounced summary upsert (writes summary + touches identity + updated_at).
await supabase.from("progress").upsert(
  { user_id, display_name, summary: deriveSharedProgress(dex), updated_at: new Date().toISOString() },
  { onConflict: "user_id" },
);

// Identity-only write (if ever needed, e.g. a display-name change) — D-15 identity-safe:
// touch identity columns ONLY so the summary counts are never reset.
await supabase.from("progress").upsert({ user_id, display_name }, { onConflict: "user_id" });
```
- Trigger: subscribe to `useDexStats` changes; debounce ~5s (config constant) before the content upsert. Rationale: progress visibly moves during the residency (PROG-05) without hammering Supabase during a rapid live-logging burst (D-15).
- Keyed by the current `user_id` from `useAuthIdentity()` (Phase 18). RLS (`auth.uid() = user_id`) makes cross-user inflation structurally impossible (PROG-03 — already provisioned).

### Read path (D-16 app-wide subscription, PROG-05 live update)
```ts
const ch = supabase
  .channel("progress-feed")
  .on("postgres_changes", { event: "*", schema: "public", table: "progress" }, () => refreshAll())
  .subscribe();
// refreshAll(): full ~5-row re-pull → parseSharedProgress each row (D-19) → drop malformed → cache → set state.
```
- Subscription is **active app-wide while signed in** (D-16), not gated on the Friends toggle — keeps friend rows warm and the "You" comparison current, and dovetails with Phase 20's persistent channel.
- **Realtime-publication gotcha (blueprint, Phase-17 D-03):** `postgres_changes` fires only because `alter publication supabase_realtime add table public.progress` was run in the Phase-17 migration. Do **not** assume it — it is already done; the failure mode if it were missing is *silent* (events never fire). Verified provisioned in 17-CONTEXT.
- Full-table re-pull on any change is correct at ~5 rows (PROG-05, blueprint).

### Reconnect + first-sync (D-17)
- Tie into the existing `useOnlineStatus()` (`packages/app/src/live/useOnlineStatus.ts`) and the `ReconnectContext` (`packages/app/src/auth/reconnectContext.ts`). On an offline→online transition: **flush the own row** (fresh summary upsert, catching friends up on anything logged offline) **and re-pull all friend rows once**, beyond the normal ~5s debounce.
- On sign-in / first foreground while online: initial upsert-own + pull.
- The `postgres_changes` subscription should be (re)established on the same signal — a dropped socket must resubscribe on reconnect.

**Confidence: HIGH** — this exact client pattern is VALIDATED across two remote devices (spikes 003) and captured verbatim in `references/multi-user-supabase.md` §"Durable shared progress."

## Offline Backstop (D-18)

- Persist the most recent successful friend pull to a **Dexie table** (recommended over localStorage — §Don't Hand-Roll; CLAUDE.md bans localStorage for this class of data). Suggested shape: one row per friend `{ userId, displayName, summary (jsonb), updatedAt, fetchedAt }`, or a single `{ fetchedAt, rows[] }` snapshot row.
- The "as of {time}" stamp derives from the cache's `fetchedAt` (the wall-clock of the last successful pull), formatted with the app's existing time idiom. When `useOnlineStatus()` is false, render the cached rows **dimmed** + a calm `Offline · as of {time}` chip reusing the `SyncDot` connection vocabulary (never a spinner, never blank).
- The pinned **"You" row stays live** from `useDexStats` regardless of connectivity (D-02) — it never reads the cache.

## Untrusted-Data Hardening (D-19)

- **Shape validation at the read boundary:** run every synced row's `summary` through the core-exported `parseSharedProgress` (`safeParse`). A malformed row degrades to **skipped** (dropped from the list), never a per-row error, never a crash (matches the file-import `T-06-26` discipline).
- **String rendering:** `display_name` and any resolved song name render as **escaped React text only** (React escapes by default — never `dangerouslySetInnerHTML`), `truncate`/`min-w-0` clamped. The friend name is untrusted (kglw-adjacent / user-set).
- **Set arithmetic by songId only:** the matrix has duplicate names (`"Bit"×3`, `"Jam"×2`, `"Ghost"×2`) — all diff/set math is over `caughtSongIds` (ints), names resolved only for display via `archive.songs[String(id)]`. This is already how `compareDexes` and `CompareView` operate.
- **Clamp/sanity the numbers too:** `parseSharedProgress` should bound `completion.pct` to `[0,100]`, reject negative counts, and cap `caughtSongIds` length to a sane ceiling (≥ catalog size is impossible) so a malformed/hostile row can't blow up rendering. (Own-inflation remains honor-system for a ~5-friend private tool per CONTEXT deferred notes; RLS covers cross-user inflation.)

## Core-Purity Guardrail (verified)

The existing Vitest boundary test **`packages/core/test/purity.test.ts`** (SETUP-04 / D-12) statically scans every `.ts` under `packages/core/src` and fails on `@supabase/`, `supabase-js`, `createClient`, `document.`, `localStorage`, `navigator.`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and asserts `packages/core/package.json` has no `@supabase/*` dependency. The new `shared-progress.ts` (pure, zod-only, no Supabase/DOM) passes by construction. `[VERIFIED: packages/core/test/purity.test.ts read in full]`

**Guardrail note for the planner:** zod is *permitted* in core (already a dep; the scan does not forbid it). The new module must import only `zod` + core-internal types — no Supabase, no DOM globals, no `Date.now()` in the projector (keep it a pure function of `DexStats`; the app stamps `updated_at`/`fetchedAt`).

## Architecture Patterns

### System Architecture Diagram

```
  LOCAL DEX (source of truth)                        SUPABASE (public.progress)
  ┌─────────────────────────┐                        ┌──────────────────────────────┐
  │ Dexie attendance tables │                        │ row: user_id (PK)            │
  │        │                │                        │      display_name (column)   │
  │        ▼                │                        │      summary jsonb           │
  │  useDexStats ──► DexStats│                        │      updated_at              │
  └────────┬────────────────┘                        │ RLS: read-all / write-own    │
           │                                         │ publication: supabase_realtime│
           │ (A) pinned "You" row (always live)      └───────────┬──────────────────┘
           │                                                     │
           ▼                                          ▲          │ postgres_changes (event:*)
  ┌─────────────────────┐   debounce ~5s   ┌──────────┴───────┐  │ (D-16 app-wide while signed in)
  │ deriveSharedProgress│ ───────────────► │ progressSync     │  │
  │  (PURE CORE)        │   own-row upsert  │ (APP sync fence) │◄─┘  full ~5-row re-pull on change
  └─────────────────────┘                  └──────┬───────────┘
                                                  │ (B) validate each row: parseSharedProgress (zod, D-19)
                                                  │     malformed → skipped
                                                  ▼
                                    ┌─────────────────────────────┐
                                    │ Dexie offline cache (D-18)  │  ── offline ──► dimmed rows + "as of {time}"
                                    │ {fetchedAt, friend rows}    │
                                    └──────────────┬──────────────┘
                                                   ▼
                          ┌────────────────────────────────────────────────┐
                          │ FriendsList (Friends toggle in DexView, D-01)  │
                          │  • SelfRow "You"  ◄── (A) live local dex        │
                          │  • FriendRow × N  ◄── (B) validated/cached      │
                          └───────────────┬────────────────────────────────┘
                                          │ tap friend
                                          ▼
                          ┌────────────────────────────────────────────────┐
                          │ FriendDetail overlay (new file, D-09)          │
                          │  reconstructDexStats(summary, rarityIndex) ──►  │
                          │  compareDexes(myDex, theirs)  [UNCHANGED CORE]  │
                          │  → head-to-head cols + by-album/by-rarity       │
                          │  → RarestShowcase (top-5, PROG-08)              │
                          └────────────────────────────────────────────────┘
```
Reconnect (D-17): `useOnlineStatus` offline→online ⇒ flush own row + re-pull all + resubscribe.

### Recommended Structure (new files only)
```
packages/core/src/dex/
├── shared-progress.ts        # NEW: deriveSharedProgress + SharedProgress + sharedProgressSchema
│                             #      + parseSharedProgress + reconstructDexStats (all pure)
packages/core/test/dex/
├── shared-progress.test.ts   # NEW: projector + reconstruction + ROUND-TRIP-vs-compareDexes
packages/app/src/sync/        # NEW dir (the app-layer Supabase fence for this milestone)
├── progressSync.ts           # NEW: upsert (debounced + identity-safe), subscription, re-pull, reconnect flush
├── useFriendsProgress.ts     # NEW: React hook exposing {selfRow-source, friends[], offline, asOf}
├── friendCache.ts            # NEW: Dexie table read/write for the offline last-known pull (D-18)
packages/app/src/dex/
├── FriendsList.tsx           # NEW: pinned SelfRow + FriendRow[] (D-02/03/04/05)
├── FriendRow.tsx             # NEW: name + pct + caught + rarest TierBadge + identity glyph (+Phase-20 slots)
├── SelfRow.tsx               # NEW: "You" row from live useDexStats (D-02/06)
├── FriendDetail.tsx          # NEW: reconstruct → UNCHANGED compareDexes → columns/breakdown/showcase (D-07/08/09)
├── RarestShowcase.tsx        # NEW: top-5 rarest (D-10), shared by FriendDetail + You trophy case
├── DexView.tsx               # EDIT: add "Friends" to the Albums|Shows segment toggle (D-01)
```

### Anti-Patterns to Avoid
- **Editing `compareDexes` or `CompareView.tsx`.** The whole phase premise is zero change to either. If you feel tempted to edit `compareDexes`, the reconstruction is wrong — fix the reconstruction.
- **Carrying per-song tiers on the wire.** Redundant with the deterministic local rarity index (D-13); bloats the payload.
- **Running `deriveDex` on the live friend path.** That is the file-import path's job. The live path reconstructs directly (D-09).
- **A new hash route for Friends or FriendDetail.** View-state within `#/dex` only (D-01/07, 06-06 discipline).
- **Importing the Supabase client from core, or adding `Date.now()`/DOM to the projector.** Fails the purity guard / breaks purity.
- **Gating the subscription on the Friends toggle being open.** D-16 wants it app-wide while signed in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| The head-to-head diff | A new "live compare" diff | Shipped `compareDexes` (unchanged) fed reconstructed `theirs` | The entire phase premise (PROG-06); zero new diff logic. |
| Friend song tiers | Carry per-song tiers on the wire / recompute a bespoke tiering | Local `buildRarityIndex` (module-memoized in `useDexStats`) | Deterministic from the shared corpus (D-13); already computed once. |
| Untrusted payload validation | Manual field checks / try-catch JSON | Core `sharedProgressSchema` (zod) via `parseSharedProgress` | Matches the shipped file-import validation discipline; malformed → skipped, never crash (D-19). |
| Offline persistence | localStorage / hand-rolled cache | Dexie table | localStorage banned for this data class (CLAUDE.md); Dexie is the app's IndexedDB layer. |
| Online/offline signal | A second connectivity indicator | Existing `useOnlineStatus` + `SyncDot` vocabulary | D-18 explicitly reuses the shipped connection language. |
| Identity color / avatar | New per-friend color hashing | `identityColorIndex(userId, len)` + `IdentityAvatar` (Phase 18) | Built specifically for reuse here; stable per user across devices. |
| Live upsert/subscribe wiring | A novel sync design | The VALIDATED blueprint pattern (`multi-user-supabase.md`) | Proven across two devices; do not reinvent. |

**Key insight:** the load-bearing correctness (diff, tiers, projection, validation) is *all* pure core and *all* already exists or is a thin pure projection over things that exist. The genuinely new work is the app-layer sync plumbing — and even that is a captured, validated pattern.

## Common Pitfalls

### Pitfall 1: Reconstructed `perSong.sightings` is not the friend's real multiplicity
**What goes wrong:** a future feature reads `theirs.perSong.get(id).sightings` expecting the friend's true sighting count.
**Why:** the payload carries ids only (D-13/D-14); reconstruction sets `sightings: 1`. `compareDexes` only tests `> 0`, so it's faithful *for the diff* — but the value is a boolean-equivalent, not a count.
**How to avoid:** treat reconstructed `sightings` as caught/not-caught only. If per-friend multiplicity is ever needed, it must be added to the payload deliberately. Document this at the reconstruction call site.
**Warning signs:** any code path reading a friend's `sightings` as a magnitude.

### Pitfall 2: Silent `postgres_changes` non-firing
**What goes wrong:** upserts persist (RLS ok) but the friends screen never updates live.
**Why:** the table not being on `supabase_realtime`, or the subscription not (re)established after a socket drop.
**How to avoid:** the publication is already provisioned (Phase-17 D-03) — do not remove it. Re-subscribe on the reconnect signal (D-17). Verify with a two-tab manual test (blueprint validated this).
**Warning signs:** rows change on refresh but not live.

### Pitfall 3: Corpus-version skew breaks tier reconstruction fidelity
**What goes wrong:** a friend on a stale SW cache (older bundled archive) reconstructs a slightly different tier for a band-boundary song, so a rarest badge or a tier count differs from what their own client shows.
**Why:** tiers are reconstructed from the *reader's* local rarity index; fidelity assumes identical bundled corpus across clients.
**How to avoid:** rely on the app's `registerType: 'prompt'` SW discipline (refresh between shows). Optionally include a corpus/build version in the payload later to detect skew — **not needed this phase** (flag only). This is the same corpus-version assumption the entire app already rests on.
**Warning signs:** a friend's rarest tier disagrees across two devices for a boundary song.

### Pitfall 4: Debounced upsert clobbering an identity-only write (or vice-versa)
**What goes wrong:** an identity update resets `summary` counts, or a content write races an identity write.
**Why:** upserting a partial object without `onConflict` discipline, or writing `summary: null`.
**How to avoid:** identity-only writes touch `{user_id, display_name}` **only** (never `summary`); content writes always include a full fresh `summary`. Phase-17 kept `display_name` a first-class column precisely for this (D-01 there). The content upsert is the source of truth for counts.
**Warning signs:** a friend's counts drop to zero after a name change.

### Pitfall 5: `useDexStats`-driven upsert firing during initial load / empty tables
**What goes wrong:** on first paint `useLiveQuery` resolves `[]` and an upsert fires a zero-dex summary, or fires before `ready`.
**Why:** the derive runs over empty tables (zero counts, no NaN) before the live reads resolve.
**How to avoid:** gate the debounced upsert on `stats.ready === true` and skip the write while `dex == null`. The initial legitimate sync is the sign-in/first-foreground upsert (D-17), not an accidental empty-table fire.
**Warning signs:** own row shows 0% right after boot despite a full local dex.

### Pitfall 6: `perAlbum` serialized as a `Map`
**What goes wrong:** `JSON.stringify(new Map(...))` yields `{}` — the album breakdown silently empties over the wire.
**Why:** `DexStats.perAlbum` is a `Map`; jsonb needs plain JSON.
**How to avoid:** project `perAlbum` to an **array** (`[{key, caught, total}]`) in `SharedProgress`, rebuild the `Map` in `reconstructDexStats`. (Same applies to `caughtSongIds` — already an array; and the `perSong` Map is never serialized, only reconstructed.)
**Warning signs:** empty "By album" breakdown.

## Code Examples

### `deriveSharedProgress` — mirroring the `buildShareStats` idiom
```ts
// Source: packages/core/src/dex/share-stats.ts (buildShareStats), adapted — pure projection of DexStats.
export function deriveSharedProgress(dex: DexStats): SharedProgress {
  const caughtSongIds: number[] = [];
  const tierCounts: Record<RarityTier, number> = {
    common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0,
  };
  for (const [songId, stat] of dex.perSong) {
    if (stat.sightings > 0) {                 // exactly compareDexes' caught rule
      caughtSongIds.push(songId);
      if (stat.tier != null) tierCounts[stat.tier] += 1;
    }
  }
  caughtSongIds.sort((a, b) => a - b);        // deterministic
  return {
    v: 1,
    completion: { caught: dex.completion.caught, total: dex.completion.total, pct: dex.completion.pct },
    showCount: dex.showCount,
    rarest: dex.rarestCatch,                  // {songId, tier} | null
    tierCounts,
    perAlbum: [...dex.perAlbum].map(([key, v]) => ({ key, caught: v.caught, total: v.total })),
    caughtSongIds,
  };
}
```

### `FriendDetail` compare — the UNCHANGED core, reconstructed input
```ts
// Source: pattern echoes packages/app/src/dex/CompareView.tsx (useMemo → compareDexes),
// but feeds a RECONSTRUCTED theirs instead of deriveDex(envelope). CompareView stays untouched (D-09).
const compare = useMemo<CompareResult | null>(() => {
  if (stats.dex == null || stats.rarity == null) return null;
  const theirs = reconstructDexStats(friendSummary, stats.rarity);  // core, pure
  return compareDexes(stats.dex, theirs);                            // core, UNCHANGED
}, [friendSummary, stats.dex, stats.rarity]);
```

### App-wide subscription + validated re-pull
```ts
// Source: .claude/skills/spike-findings-guezzer/references/multi-user-supabase.md §"Durable shared progress"
async function refreshAll() {
  const { data, error } = await supabase.from("progress").select("user_id, display_name, summary, updated_at");
  if (error) return; // keep last-known cache; surface the calm "can't reach friends" copy
  const rows = (data ?? [])
    .map((r) => {
      const summary = parseSharedProgress(r.summary);          // D-19: malformed → null → skipped
      return summary && r.user_id !== myUserId
        ? { userId: r.user_id, displayName: r.display_name, summary, updatedAt: r.updated_at }
        : null;
    })
    .filter((r): r is FriendRowData => r != null);
  await friendCache.write(rows, Date.now());                    // D-18 offline backstop
  setFriends(rows);
}
```

## Validation Architecture

> Nyquist Dimension 8 is enabled (`workflow.nyquist_validation` not disabled). This section derives VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`test.projects`: core=`node`, app=`jsdom`) |
| Config file | root `vitest.config.ts` (projects config; no `vitest.workspace.ts` — removed in Vitest 4) |
| Quick run command | `npx vitest run packages/core/test/dex/shared-progress.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROG-01 | `deriveSharedProgress(fixtureDex)` deep-equals a known `SharedProgress` (incl. caught set, tierCounts, perAlbum array, sorted ids) | unit (core/node) | `npx vitest run packages/core/test/dex/shared-progress.test.ts -t "deriveSharedProgress"` | ❌ Wave 0 |
| PROG-06 | **Round-trip:** `compareDexes(mine, deriveDex(theirs))` deep-equals `compareDexes(mine, reconstructDexStats(deriveSharedProgress(deriveDex(theirs)), rarity))` | unit (core/node) | `… -t "round-trip fidelity"` | ❌ Wave 0 |
| PROG-06 | `reconstructDexStats` produces a `DexStats` whose caught set = payload `caughtSongIds`; stubbed fields (`neverSeen`, `personalGap`) never read by `compareDexes` | unit (core/node) | `… -t "reconstructDexStats"` | ❌ Wave 0 |
| PROG-07 | Reconstructed `perAlbum` round-trips (array→Map) and the by-album breakdown matches `deriveDex(theirs).perAlbum` | unit (core/node) | `… -t "perAlbum"` | ❌ Wave 0 |
| PROG-08 | Top-5 rarest selection from `caughtSongIds` + local rarity matches expected order (rarest-first, id tie-break) | unit (core/node) | `… -t "rarest showcase"` | ❌ Wave 0 |
| PROG-01/D-19 | `parseSharedProgress` accepts a valid payload; returns `null` for malformed/hostile shapes (missing fields, out-of-range pct, negative counts, non-int ids) | unit (core/node) | `… -t "parseSharedProgress"` | ❌ Wave 0 |
| PROG-01 | **Core purity:** new `shared-progress.ts` imports no Supabase/DOM (existing static scan) | unit (core/node) | `npx vitest run packages/core/test/purity.test.ts` | ✅ exists |
| PROG-02 | Debounced upsert fires once after ~5s of dex changes; gated on `ready`; identity-only write leaves `summary` untouched | integration (app/jsdom, mocked supabase) | `npx vitest run packages/app` (new spec) | ❌ Wave 0 |
| PROG-05 | A `postgres_changes` callback triggers a full re-pull; malformed rows skipped; state + cache updated | integration (app/jsdom, mocked supabase) | `npx vitest run packages/app` (new spec) | ❌ Wave 0 |
| PROG-03/04 | Own row excluded from the friends list; sort = completion desc → caught → name; 0-catch friend last (D-05) | unit/integration (app) | `npx vitest run packages/app` (new spec) | ❌ Wave 0 |
| D-18 | Offline (`useOnlineStatus=false`) renders cached rows + "as of {time}"; "You" row stays from live dex | integration (app/jsdom) | `npx vitest run packages/app` (new spec) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/test/dex/shared-progress.test.ts` (the round-trip invariant is the highest-value fast check).
- **Per wave merge:** `npx vitest run packages/core` then `npx vitest run packages/app`.
- **Phase gate:** full `npx vitest run` green before `/gsd-verify-work`.

### What is pure-core unit-testable (most load-bearing correctness) vs app-integration
- **Pure core (deterministic, node, no mocks):** `deriveSharedProgress`, `reconstructDexStats`, the **round-trip-vs-`compareDexes`** invariant, `parseSharedProgress` validation, rarest-top-5 selection, perAlbum array↔Map. *This is where the phase's correctness actually lives — nearly all of it.*
- **App integration (jsdom, mock the `supabase` singleton + Dexie):** debounce timing + `ready` gating, identity-safe upsert, subscription→re-pull→skip-malformed→cache, offline cache read + "as of {time}", list sort/self-exclusion. Mock `@supabase/supabase-js` client methods (`from().upsert`, `channel().on().subscribe`, `from().select`) — do not hit the network in tests.
- **Manual (venue-realistic, not automated):** two-device live `postgres_changes` propagation and reconnect flush — validated once via the blueprint's two-tab method; re-verify manually at `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/test/dex/shared-progress.test.ts` — projector + reconstruction + **round-trip fidelity** + parse (covers PROG-01/06/07/08 + D-19). Needs a small fixture `DexSnapshotInput` (reuse the existing dex fixtures if present under `packages/core/test/dex/`).
- [ ] `packages/app/src/sync/*.test.ts` — mocked-supabase integration specs (debounce, subscription re-pull, offline cache).
- [ ] Confirm/adjust root `vitest.config.ts` `projects` already picks up new `packages/core/test/dex/*.test.ts` and `packages/app/src/**/*.test.ts` (it should — no framework install needed).

*Framework is already installed and configured; no Wave 0 framework install task required.*

## Security Domain

> `security_enforcement` absent = enabled. Included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (this phase) | Handled Phase 18; this phase consumes the identity, adds no auth flow. |
| V3 Session Management | no (this phase) | Phase 18 offline-safe boot; must not regress (don't gate on a live auth check). |
| V4 Access Control | **yes** | **RLS read-all / write-own** (`auth.uid() = user_id`) — provisioned Phase 17, enforced server-side. Client cannot write another user's row (PROG-03). No client-side authz is trusted. |
| V5 Input Validation | **yes** | **zod `sharedProgressSchema`** at the read boundary (D-19): malformed/hostile synced rows → skipped; bound pct `[0,100]`, reject negative counts / non-int ids / oversized arrays. |
| V6 Cryptography | no | No secrets handled here. `anon` key + URL are public by design; no `service_role` on the client. `identityColorIndex` is an explicit NON-security display hash. |

### Known Threat Patterns for {Supabase Postgres + Realtime, static PWA}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A friend row with a hostile `summary` (malformed jsonb, huge arrays, XSS-y `display_name`) crashing the list | Tampering / DoS | zod `safeParse` → skip; array-length + numeric clamps; React auto-escaping, `truncate` clamp (D-19). |
| Cross-user count inflation (writing another friend's row) | Tampering / Elevation | Server-side RLS `with check (auth.uid() = user_id)` — structurally impossible from the client (PROG-03). |
| Identity write resetting a friend's summary counts | Tampering | Identity-only upserts touch identity columns only; `summary` never `null`-written (D-15, Phase-17 first-class columns). |
| `display_name` / song name injection via `dangerouslySetInnerHTML` | Tampering (XSS) | Escaped React text only, never raw HTML (carried convention T-06-26 / D-19). |
| Privacy: full `caughtSongIds` readable by all friends | Information Disclosure | **Accepted by owner** (D-14) — same exposure as the old manual JSON handoff; private ~5-friend tool, read-all RLS scoped to `authenticated`. |
| Own-count inflation (a user overstating their own dex) | Repudiation | Honor-system, out of scope (CONTEXT deferred) — RLS covers cross-user; own inflation not a concern for a 5-friend tool. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `deriveSharedProgress` should be a pure fn of `DexStats` alone, with the app composing the `display_name` **column** on write (column authoritative on read). PROG-01 lists `display_name` in the payload; I read that as satisfied at the row level. | Projector Contract | Low — a discretion call. Alternative (`deriveSharedProgress(dex, displayName)` with a `displayName` field) is equally valid; planner picks. Either way `compareDexes` is unaffected. |
| A2 | Dexie (a table) is the right home for the offline last-known friend cache vs localStorage. | Offline Backstop | Low — both work; Dexie aligns with CLAUDE.md's localStorage ban for this data class. |
| A3 | Full ~5-row re-pull on every change is acceptable (no per-row patch). | Sync Mechanics | Very low — blueprint + PROG-05 explicitly endorse this at ~5 rows. |
| A4 | Corpus/archive version is identical across all clients (so local tier reconstruction is faithful). | Reconstruction / Pitfall 3 | Low — the whole app already assumes this; SW `prompt` discipline covers it. Not worth a payload version field this phase. |
| A5 | The `progress` table has exactly the Phase-17 columns (`user_id`, `display_name`, `updated_at`, `summary jsonb`) with RLS + realtime publication live. | Sync Mechanics | Low — verified in 17-CONTEXT (D-01/02/03); confirm against the live project (Management API) before first write if any doubt. |
| A6 | Existing dex test fixtures exist under `packages/core/test/dex/` to seed the round-trip test. | Validation Architecture | Low — if absent, author a small `DexSnapshotInput` fixture (cheap). |

## Open Questions

1. **`display_name` placement in the payload (A1).**
   - What we know: Phase-17 keeps `display_name` a first-class column for identity-only upserts; PROG-01 lists it in the payload.
   - What's unclear: whether to also duplicate it inside `summary`.
   - Recommendation: keep the projector dex-only; write the column; read the column. Duplicate into `summary` only if the planner wants a literally self-contained payload. Either satisfies PROG-01.

2. **Whether to persist `updated_at` client-set vs a DB trigger.**
   - What we know: Phase-17 discretion left this as "client-set unless a trigger is trivially cleaner"; no trigger was added.
   - What's unclear: nothing blocking.
   - Recommendation: client-set `updated_at` on the content upsert (matches the blueprint); it is not read for correctness (the offline "as of {time}" uses the client's own `fetchedAt`).

3. **Config block naming (discretion).**
   - Recommendation: a single `config.friends` (app) block for debounce ms, top-5 showcase count, copy strings; if any constant is mirrored in core, keep it equal (single-config rule).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | upsert + realtime | ✓ | 2.110.8 (app) | — |
| `zod` | payload validation | ✓ | 4.4.3 (core) | — |
| `dexie` / `dexie-react-hooks` | offline cache | ✓ | 4.4.4 / 4.4.0 | — |
| Vitest (`projects`) | tests | ✓ | 4.1.10 | — |
| Supabase project (`public.progress` + RLS + realtime) | live sync | ✓ (provisioned Phase 17) | project ref `yunfqfldgbgjdqzywbdy`, us-east-1 | — |
| Two devices / two tabs | manual live-propagation verify | ✓ (blueprint method) | — | Single-tab mock covers the code path; live propagation is manual. |

No missing dependencies. No new installs.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON-file handoff → `CompareView` (file-import, `deriveDex(envelope)`) | Live synced summary → `reconstructDexStats` → **same** `compareDexes` | This phase | The file-import path stays as a fallback; the live path is additive and shares the diff core. |
| `vitest.workspace.ts` | `test.projects` in root `vitest.config.ts` | Vitest 4 | Do not follow pre-2025 tutorials. |

**Deprecated/outdated:** none relevant to this phase.

## Sources

### Primary (HIGH confidence — shipped source read in full)
- `packages/core/src/dex/compare.ts` — exact fields `compareDexes` reads (the reconstruction target contract).
- `packages/core/src/dex/derive-dex.ts` — `DexStats` / `SongDexStats` / `perAlbum` shapes; `deriveDex` (projector mirror).
- `packages/core/src/dex/rarity.ts` — `buildRarityIndex` is a pure function of the static corpus (D-13 fidelity argument).
- `packages/core/src/dex/share-stats.ts` — `buildShareStats(dex, archive)` idiom the projector mirrors.
- `packages/core/src/index.ts` — export surface (`compareDexes`, `deriveDex`, `buildRarityIndex` exported; new exports slot in here).
- `packages/core/test/purity.test.ts` — the core-purity static-scan guard (forbidden patterns; zod permitted).
- `packages/app/src/dex/CompareView.tsx` — file-import compare (untouched reference layout for `FriendDetail`).
- `packages/app/src/dex/useDexStats.ts` — live local-dex hook (self-row source + upsert trigger; module-memoized rarity).
- `packages/app/src/dex/DexView.tsx` — the Albums|Shows segment toggle the Friends option joins.
- `packages/app/src/db/supabase.ts` — the Phase-17 app-layer client singleton (only `createClient` call in the repo).
- `packages/app/src/live/SyncDot.tsx` + `useOnlineStatus.ts` + `auth/reconnectContext.ts` — connection vocabulary + reconnect seam.
- `packages/app/src/auth/useAuthIdentity.ts` + `packages/core/src/identity/color.ts` — identity keying + deterministic color.
- `.claude/skills/spike-findings-guezzer/SKILL.md` + `references/multi-user-supabase.md` — VALIDATED sync/subscribe/reconnect blueprint.
- `.planning/phases/17-backend-foundation-secrets/17-CONTEXT.md` — provisioned `public.progress` schema, RLS, realtime publication.
- `.planning/phases/19-shared-dex-progress/19-CONTEXT.md` + `19-UI-SPEC.md` + `REQUIREMENTS.md` + `ROADMAP.md` — decisions, UI contract, PROG-01…08, success criteria.
- `package.json` (core + app) — installed versions verified directly.

### Secondary (MEDIUM confidence)
- `.planning/phases/18-accounts-offline-safe-identity/18-CONTEXT.md` — identity substrate (read via CONTEXT canonical refs, not re-opened in full).

### Tertiary (LOW confidence)
- none — every claim is grounded in shipped source or the validated spike blueprint.

## Metadata

**Confidence breakdown:**
- Reconstruction contract (PROG-06/07): **HIGH** — `compareDexes` read-set enumerated line-by-line; every field reconstructable; no gap.
- Projector shape (PROG-01): **HIGH** — mirrors shipped `buildShareStats`; purity guarded by existing test.
- Sync mechanics (PROG-02/05, reconnect, offline): **HIGH** — VALIDATED blueprint + provisioned Phase-17 schema.
- Tier reconstruction fidelity (D-13): **HIGH** — grounded in `rarity.ts` being a pure fn of the static shared corpus (one flagged low-risk corpus-version caveat).
- Validation architecture: **HIGH** — round-trip invariant is deterministic and pure-core testable.

**Research date:** 2026-07-23
**Valid until:** ~2026-08-22 (30 days — stable; all internal source + a locked backend schema, no fast-moving external deps).
