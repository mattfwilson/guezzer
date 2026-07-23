# Phase 19: Shared Dex Progress - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make each friend's **real dex progress** sync to Supabase and be **visible and comparable live** in a friends view — the visible payoff of v2.0, replacing the manual JSON-file handoff. Each signed-in user's locally-derived dex is projected (pure core) into a serializable summary and **upserted to their own row** (debounced); a **Friends** surface inside GizzDex lists every friend's headline progress read live via `postgres_changes`; tapping a friend opens a **live head-to-head** by reconstructing a minimal `DexStats` from their synced summary and feeding the **unchanged** shipped `compareDexes`, with per-album/per-tier breakdown and a rarest-catches showcase.

Depends on Phase 18's identity (every `progress` row is keyed by `user_id`; friend rows reuse the deterministic per-user color/avatar) and the new pure-core `deriveSharedProgress` projector. All Supabase access stays fenced in the app layer; `packages/core` stays pure by construction.

**In scope:** PROG-01 (pure-core `deriveSharedProgress(DexStats) → SharedProgress`, Option-B payload), PROG-02 (debounced own-row upsert; identity-only writes never reset counts), PROG-03 (read-all / write-own RLS — already provisioned Phase 17), PROG-04 (friends list of headline progress read live), PROG-05 (live `postgres_changes` updates), PROG-06 (live head-to-head via reconstructed `DexStats` → unchanged `compareDexes`), PROG-07 (per-album / per-tier breakdown reusing `CompareColumn` semantics), PROG-08 (rarest catches showcase, six-tier rarity language + colors).

**Explicitly NOT in this phase:**
- **Presence / waves / reactions / coarse activity** → Phase 20 (PRES-01…07). The Friends surface is *built to accept* presence later (PRES-07 fuses PROG + PRES on this same screen) but ships PROG-only here.
- **Sortable multi-key leaderboard** (completion / catch-count / rarest sort switcher) → deferred PROG-F1. This phase ships **one fixed default order** only.
- **Per-friend live-syncing share card** → deferred PROG-F2.
- **Historical progress timeline / night-by-night climb graph** → deferred PROG-F3 (needs time-series rows + retention).
- **Any change to the shipped file-import compare (`CompareView.tsx`)** — it stays untouched; the live path is a new component.

</domain>

<decisions>
## Implementation Decisions

### Friends surface placement & navigation (PROG-04)
- **D-01:** The friends view lives as a **third toggle inside GizzDex** — `Albums | Shows | Friends` — **not** a 6th bottom tab. The bottom bar is already at 5 tabs (LiveGizz / GizzVerse / GizzMap / GizzDex / GizzGames); a 6th crowds tap targets. GizzDex is the thematically correct home — it is literally "your dex vs their dexes," and the compare logic already lives in the dex domain. Toggle label is **"Friends"** (plain; matches the "Gizz With Friends" framing). The toggle is view-state within `#/dex` (mirrors the existing Albums/Shows toggle + album drill-in discipline — never a new hash route).

### Friend list & self-row (PROG-04)
- **D-02:** The signed-in user appears as a **pinned "You" row on top** of the list, sourced from the **live local dex (`useDexStats`)** — *not* the Supabase read — so it is always current and works fully offline. It is the self-anchor for at-a-glance "me vs everyone."
- **D-03:** Friends below "You" are ordered by **completion % descending** (implicit, engaging ranking), tie-break by caught count, then display name. This is the single fixed default order — the sortable multi-key leaderboard (PROG-F1) is deferred, so no sort switcher ships.
- **D-04:** Each friend **list row** shows name + completion % + caught count + a **single rarest-tier badge** (PROG-04's "rarest badge"), reusing the shipped six-tier rarity colors. Rows stay scannable; the multi-trophy showcase lives in the detail.
- **D-05:** A friend who has signed in and synced a row but has **0 catches (0%)** is **shown at the bottom** (0% · 0 caught · no badge, sorted last) — honest "they're here, haven't caught yet," never hidden. (A friend who has never upserted a row simply has no row yet and does not appear — see D-14 empty state.)
- **D-06:** Tapping the **"You" row opens your own trophy case** — the same detail layout showing your rarest-catches showcase, **without** head-to-head columns (no self-compare). Your full dex is already the rest of GizzDex.

### Friend detail & head-to-head compare (PROG-06, PROG-07, PROG-08)
- **D-07:** Tapping a friend opens a **full-screen overlay** (its own back/close affordance), **not** a bottom sheet. Owner chose the extra room for the head-to-head over strict consistency with the app's sheet-based drill-ins. (Planner: prefer rendering it as view-state within the dex view rather than a new hash route, to preserve the routing discipline — visual is full-screen either way.)
- **D-08:** The detail **leads with the head-to-head**: "You vs {name}" stat columns (completion %, caught, per-tier counts) — the same shape as the shipped file-import `CompareView` — then the per-album / per-tier breakdown (expandable), then **their rarest-catches showcase** below.
- **D-09:** Build a **new `FriendDetail.tsx`** for the live path. Leave the shipped file-import `CompareView.tsx` **untouched**. `FriendDetail` reuses the pure core (`compareDexes`) + `TierBadge` + rarity styling, but is fed a **reconstructed `theirs: DexStats`** from the synced summary (it does **not** run `deriveDex` — that is the file-import path's job). Some render similarity to `CompareView` is accepted in exchange for zero coupling risk to the shipped import path.
- **D-10:** The rarest-catches showcase shows the friend's **top-5** rarest catches (rarity-sorted), reusing the six-tier rarity language/colors. (Config constant, e.g. mirror the existing top-5 opener idiom.)
- **D-11:** The per-tier / per-album breakdown reuses the shipped `CompareColumn` semantics and `DexStats.perAlbum`, reconstructed from the synced Option-B payload (`perAlbum`, per-tier counts).

### Payload projection & tier reconstruction (PROG-01, PROG-06)
- **D-12:** `deriveSharedProgress(DexStats) → SharedProgress` is a **new pure-core projector** (zero Supabase import) producing the **Option-B payload**: `display_name`, `songs_caught` / caught count, completion %, `show_count`, rarest `{songId, tier}`, per-tier counts, `perAlbum`, and **`caughtSongIds` int[]**. This shapes the Phase-17 `summary jsonb` column with **zero later migration** (schema already provisioned).
- **D-13:** For the compare, a friend's **song tiers are reconstructed via the local bundled shared rarity index** (`rarityIndex[songId].tier`) — **not** carried per-song on the wire. Rarity is deterministic from the corpus every client shares, so per-song tiers on the payload would be redundant bulk. The payload carries `caughtSongIds` (ids only) for reconstructing `perSong` (sightings > 0 + tier-from-index); it also carries per-tier **counts** for the column display. This keeps the synced payload lean.
- **D-14 (privacy — confirmed):** The **full `caughtSongIds` int[] syncs** to the user's Supabase row and is readable by all ~5 friends (read-all RLS). This is required for the live head-to-head diff lists (only-mine / only-theirs / shared) and is exactly what the old manual JSON handoff already exposed — now automatic. Owner explicitly accepted this scope for the private ~5-friend tool.

### Own-row upsert, live sync & offline behavior (PROG-02, PROG-05)
- **D-15:** The own-row upsert is **debounced ~5s** after the last local dex change (config constant, tunable). Balances "progress visibly moves during the residency" (PROG-05) against hammering Supabase during a rapid live-logging/correction burst. Writes are **identity-safe**: an identity-only write (`user_id`, `display_name`) must never clobber the `summary` counts (Phase-17 D-01 kept identity columns first-class for exactly this).
- **D-16:** The `postgres_changes` subscription is **active app-wide while signed in** (not only while the Friends toggle is open). Keeps friend rows warm and the pinned "You" comparison always current; dovetails with Phase 20's persistent presence channel. Full ~5-row re-pull on any change is fine (PROG-05).
- **D-17:** **On reconnect** after being offline (tie into the existing `useOnlineStatus` / SyncDot signal), **flush the own row** (upsert a fresh summary of the current dex, catching friends up on anything logged offline) **and re-pull all friend rows once** — beyond the normal ~5s live-change debounce. Also do an initial upsert-own + pull on sign-in / first foreground while online.
- **D-18:** **Offline / dead-signal venue behavior:** the Friends section shows **last-known cached friend rows** (persist the most recent pull locally) with a **calm "offline · as of {time}" marker** and dimmed friend rows — reusing the existing SyncDot connection language, never a spinner or blank. The pinned "You" row stays **live** (local dex). Friends are never blank at the venue — exactly when the owner wants to peek.

### Untrusted-data hardening (carried convention — not re-discussed)
- **D-19:** A friend's synced `summary` payload and `display_name` are **untrusted external data** (same discipline as the file-import compare, T-06-26): validate the summary shape with zod at the read boundary (a malformed row degrades to a neutral/skipped row, never crashes the list), and render friend name + any song names as **escaped React text only, visually clamped**. Songs are identified by **songId only** (never name) for all set arithmetic — the matrix has duplicate names.

### Claude's Discretion
- Exact debounce constant value, config-block location (new `config.progress`/`config.friends` block; keep any core/app-mirrored constant equal across both), and the reconnect/first-sync wiring mechanics (D-15, D-16, D-17).
- Where the Supabase progress-sync code lives — a new app-layer module under the milestone's `packages/app/src/sync/` fence (per PROJECT.md / CLAUDE.md), never imported by `packages/core`.
- The exact `SharedProgress` TypeScript shape and the reconstruction helper that turns a synced summary back into a minimal `DexStats` (perSong from `caughtSongIds` + local rarity tiers, completion, showCount, perAlbum) — as long as it feeds the **unchanged** `compareDexes` (D-09, D-13).
- Where/how the last-known friend pull is persisted for the offline view (Dexie table vs localStorage) and how the "as of {time}" stamp is derived (D-18).
- Exact copy strings ("offline · as of …", the empty-before-sync note, showcase heading) and the visual treatment of the FriendDetail overlay, list rows, and self-row.
- Rarest-showcase constant name/value (default top-5, D-10); the neutral treatment of a friend with no rarest badge (D-05).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — **PROG-01…08** (this phase's exact requirement text, incl. the Option-B payload enumeration in PROG-01 and the "unchanged `compareDexes`" mandate in PROG-06); the **deferred PROG-F1/F2/F3** lines (leaderboard sort, per-friend share card, history timeline — explicitly out of this phase); the **Out-of-Scope** table.
- `.planning/ROADMAP.md` §"Phase 19" — goal + the 5 success criteria this phase is verified against; the milestone framing (PROG rides AUTH identity + the pure-core projector; parallelizable with Phase 20).

### Core reuse targets (the load-bearing "reuse, don't reinvent" surfaces)
- `packages/core/src/dex/compare.ts` — the shipped, **unchanged** `compareDexes(mine, theirs)` + `CompareColumn` / `CompareResult` shapes. PROG-06/07 feed it a reconstructed `theirs: DexStats`; the diff logic must not change.
- `packages/core/src/dex/derive-dex.ts` — `DexStats` / `SongDexStats` shapes (the reconstruction target), `DexSnapshotInput` (the file-import path's input, *not* the live path's), and the `deriveDex` derivation the projector's payload mirrors. `deriveSharedProgress` is a **new** pure-core fn beside these.
- `packages/core/src/dex/rarity.ts` (+ `RarityIndex` / `RarityTier`) — the shared, corpus-deterministic rarity index used to reconstruct friend song tiers (D-13).
- `packages/core/src/index.ts` — the core public export surface (`compareDexes` already exported); the new `deriveSharedProgress` + `SharedProgress` type export here.

### App reuse targets
- `packages/app/src/dex/CompareView.tsx` — the shipped file-import compare (envelope → `deriveDex` → `compareDexes`, rendered in a `Sheet`). **Untouched** (D-09); it is the reference layout `FriendDetail.tsx` echoes.
- `packages/app/src/dex/useDexStats.ts` — the live local-dex `useLiveQuery` + `deriveDex` hook. Source of the pinned "You" row (D-02) and the trigger for the debounced own-row upsert (D-15).
- `packages/app/src/dex/DexView.tsx` — hosts the existing `Albums | Shows` toggle the new `Friends` toggle joins (D-01).
- `packages/app/src/dex/TierBadge.tsx` + `packages/app/src/dex/rarityStyle.ts` — the six-tier rarity badge + colors reused for the row badge (D-04) and showcase (D-10).
- `packages/app/src/db/supabase.ts` — the single app-layer Supabase client singleton (Phase 17). This phase is its first **data** consumer (`.from("progress").upsert(...)` + `.channel(...).on("postgres_changes", ...)`).
- `packages/app/src/auth/useAuthIdentity.ts` + `packages/app/src/auth/IdentityAvatar.tsx` + the Phase-18 deterministic per-user color helper — the current `user_id` keys the own-row upsert; the avatar/color renders friend rows.
- `packages/app/src/live/SyncDot.tsx` + `packages/app/src/live/useOnlineStatus.ts` — the connection-status idiom to reuse for the "offline · as of {time}" marker (D-18) and the reconnect flush trigger (D-17).

### Backend foundation (already provisioned — do not re-build)
- `.planning/phases/17-backend-foundation-secrets/17-CONTEXT.md` — the `public.progress` schema (D-01 there: `user_id` PK, `display_name`, `updated_at`, **`summary jsonb`** holding the whole Option-B payload with zero later migration), the **read-all / write-own RLS** (D-02 there — PROG-03 is already enforced), and the `supabase_realtime` publication (D-03 there — required for `postgres_changes` to fire). The `summary jsonb` was chosen precisely so PROG-01 shapes it without DDL.
- `.planning/phases/18-accounts-offline-safe-identity/18-CONTEXT.md` — the identity substrate this phase keys off: the deterministic per-user color (D-13 there), `IdentityAvatar`, the offline-safe boot rule (must not regress), and the current-identity scoping every write follows.

### Sync blueprint (validated across two remote devices)
- `.claude/skills/spike-findings-guezzer/SKILL.md` + `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` §"Durable shared progress" — the exact client pattern: `upsert` identity columns only so counts aren't reset, `.on("postgres_changes", {event:"*", schema:"public", table:"progress"}, refresh).subscribe()`, and the realtime-publication gotcha. **The load-bearing reference for the sync mechanics (D-15/D-16).**

### Project constraints
- `CLAUDE.md` — strict core purity (`packages/core` = zero DOM/browser/network/Supabase deps); the core/UI separation; single-config-file convention; all Supabase imports fenced into the app layer (`packages/app/src/sync/`).
- `.planning/PROJECT.md` — v2.0 backend decision (Option A): Supabase is THE multi-user foundation; offline-first is not to be regressed.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`compareDexes` (core, unchanged)** — the entire head-to-head diff (only-mine / only-theirs / shared + You/them columns) already exists and is pure. PROG-06's whole point is to reach it via a reconstructed `DexStats` instead of a parsed file envelope. Zero new diff logic.
- **`useDexStats` (app)** — already the single reactive source of the live local dex (`useLiveQuery` over attendance tables + memoized `deriveDex`). It drives both the pinned "You" row and the upsert trigger.
- **`CompareView.tsx` (app)** — the shipped file-compare is the visual reference for `FriendDetail.tsx`; it demonstrates the columns + `TierBadge` + escaped-name/clamp discipline to echo (not import).
- **Phase-18 identity color + `IdentityAvatar`** — the deterministic-from-`user_id` color built in Phase 18 *specifically for reuse here* renders friend rows and the self-row consistently across devices.
- **`SyncDot` / `useOnlineStatus`** — the app's single connection vocabulary; the offline marker and reconnect flush extend it rather than inventing a second indicator.

### Established Patterns
- **Pure-core projector idiom.** `deriveSharedProgress` mirrors `deriveDex` / `buildShareStats` — a pure fn over already-derived stats, zero I/O, no Dexie/Supabase types. It lives in `packages/core/src/dex/` and exports through `core/index.ts`.
- **GizzDex sub-view toggle.** The `Albums | Shows` toggle in `DexView` and the album drill-in are **component view-state within `#/dex`**, never new hash routes (06-06 decision). The `Friends` toggle + `FriendDetail` overlay follow this — no react-router, no new route string.
- **App-layer Supabase fence.** Every `@supabase/*` import stays in `packages/app` (Phase 17 D-14 + the core-purity guard test SETUP-04). The new sync module obeys this by construction; a core-purity regression fails the existing Vitest boundary test.
- **Untrusted external data.** Friend-supplied strings (name, song names) are escaped React text, clamped; identity by songId only (T-06-26). Validate the synced `summary` with zod at the read boundary.

### Integration Points
- **Write path:** `useDexStats` change → (debounce ~5s) → `deriveSharedProgress(dex)` → app-layer `progress` upsert keyed by current `user_id` (from `useAuthIdentity`). Plus reconnect-flush + first-sync-on-login (D-17).
- **Read path:** app-wide (while signed in) `.channel("progress").on("postgres_changes", …).subscribe()` → full ~5-row re-pull → validate → cache locally (offline backstop) → feed the Friends list + `FriendDetail`.
- **Friends toggle:** new option in `DexView`'s toggle; renders the list (pinned "You" from local dex + friends from the synced/cached rows). Row tap → `FriendDetail` full-screen overlay.
- **Downstream (Phase 20):** PRES-07 makes this same Friends screen presence-aware (online dot + coarse activity per row) with no new backend — build the list rows so a presence dot + activity label can be added without restructuring.

</code_context>

<specifics>
## Specific Ideas

- **The whole phase is "reuse, don't reinvent."** The single hardest constraint is PROG-06's "unchanged `compareDexes`" — the live head-to-head must reach the *exact* shipped diff by reconstructing a minimal `DexStats` (perSong from `caughtSongIds` + local rarity tiers, plus completion / showCount / perAlbum). If the reconstruction is faithful, no diff code changes and the file-import path stays untouched.
- **"You" is always live, friends are eventually-consistent.** The self-row reads the local dex directly (correct even offline / mid-show); friend rows are live-when-online, last-known-when-not. This split is what lets the payoff screen stay useful at a dead-signal venue.
- **Lean payload by design.** Tiers reconstructed locally (D-13), not carried per-song — the summary stays a compact set of ids + counts + perAlbum, and the `summary jsonb` column (Phase-17 D-01) absorbs it with no migration.
- **Built for Phase 20 fusion.** The Friends screen is the exact surface PRES-07 later makes presence-aware — structure the rows so an online dot + coarse activity slot in without a rebuild.

</specifics>

<deferred>
## Deferred Ideas

- **Sortable multi-key leaderboard** (sort by completion % / catch count / rarest tier) → **PROG-F1** (deferred by owner during v2.0 scoping). This phase ships one fixed default order (completion % desc) only.
- **Per-friend live-syncing share card** (auto-current instead of manual export) → **PROG-F2** (deferred).
- **Historical progress timeline / night-by-night climb graph** → **PROG-F3** (needs time-series rows, retention, charting — a later milestone).
- **Presence dots, coarse activity, waves, reactions on the Friends screen** → **Phase 20** (PRES-01…07). PRES-07 fuses PROG + PRES on this screen with no new backend; the row structure here is built to accept it.
- **Notifications of a friend's rare catch outside the Friends toggle** (subtle nudges) → out of scope here; borders Phase 20 territory; not planned.
- **Data lifecycle / resettable rows for a fresh residency run, and own-inflation trust hardening** → not raised as needs; the row is the cumulative all-time dex, RLS covers cross-user inflation, own-inflation is honor-system for a ~5-friend private tool. Revisit only if it becomes a real concern.

### Reviewed Todos (not folded)
- 15 pending todos remain (v2 UI-polish + future-feature seeds: bottom-sheet animation, "Mon D, YYYY" date format, badge system, Couch Mode, Guezz League, Gizzle, Residency Mode, GizzVerse decluttering/particles, etc.). **None touch the shared-progress / friends-sync domain; none folded.**

</deferred>

---

*Phase: 19-shared-dex-progress*
*Context gathered: 2026-07-23*
