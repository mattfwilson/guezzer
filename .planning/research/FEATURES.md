# Feature Research

**Domain:** Multi-user foundation for a private friend-group PWA (accounts, shared progress, presence) — Guezzer v2.0 "Gizz With Friends"
**Researched:** 2026-07-22
**Confidence:** HIGH (grounded in spike-validated blueprint 002–004 + inspection of the shipped `deriveDex`/`compareDexes`/share-card code; ecosystem norms MEDIUM)

## Framing

This is **not** a greenfield product. The three feature areas are chosen and spike-validated. The job here is to specify *how each should behave* for a ~5-person private group and to bucket each sub-feature as table-stakes / differentiator / anti-feature so requirements definition can be ruthless.

Two facts shape everything:

1. **Async friend comparison already ships.** `deriveDex` → `DexStats`, `compareDexes(mine, theirs)` → live diff/columns, and `buildShareStats`/`buildRecapShareStats` → share cards all exist and are pure/DOM-free in `packages/core/src/dex/`. v2.0 does **not** invent friend comparison — it removes the manual file-export handoff by syncing a derived summary so the *same* `compareDexes` renders against live data.
2. **The scope wall is SOCL-V2-01.** Anything that pushes toward collaborative *live setlist logging* (shared trail writes, merge/reconcile of in-progress shows, "we're both editing tonight's setlist") is out. v2.0 delivers presence + shared *progress* (durable, low-frequency) + ephemeral reactions — never a shared mutable setlist.

## The Sync Payload Decision (drives everything below)

The single most important design question is **what projection of `DexStats` gets written to Postgres.** Three options:

| Option | What's synced | Enables | Payload | Verdict |
|--------|---------------|---------|---------|---------|
| **A. Counters only** | `songs_caught`, completion %, showCount, rarest tier, per-tier counts, per-album `{caught,total}` | Friends list + mini-leaderboard + headline compare columns | ~1–2 KB/user | Table-stakes floor |
| **B. Counters + caught songId set** | Option A **plus** `int[]` of caught songIds | Everything in A **+ live `compareDexes` diff lists** (onlyMine / onlyTheirs / shared) with zero new logic | ~1–3 KB/user (264 ids max) | **Recommended** |
| **C. Raw attendance rows** | Full tracked shows + entries + retro marks | Re-derive anything server-side; collaborative features | 10s–100s KB/user, PII-ish | Anti-feature (see below) |

**Recommendation: Option B.** Privacy is explicitly low-stakes among 5 friends, the caught-songId array is at most 264 small ints, and it makes the *already-shipped* `compareDexes` run live for free — the friend screen becomes "run `deriveDex` locally for me, receive each friend's synced summary, `compareDexes` pairwise." Option A can't produce the rarest-first onlyMine/onlyTheirs/shared lists that the existing CompareView already renders, so choosing A would mean *throwing away* working code. Option C reopens offline-reconciliation questions that belong to SOCL-V2-01.

The synced summary should be produced by a **new pure-core projector** (e.g. `deriveSharedProgress(dexStats): SharedProgress`) so the app layer only reads Dexie, derives locally, and hands a plain-JSON summary to the Supabase client. Core never imports Supabase (hard constraint).

---

## Feature Landscape

### Area 1 — Accounts & Identity

#### Table Stakes

| Feature | Why Expected | Complexity | Notes / Reuse |
|---------|--------------|------------|---------------|
| Pre-made email/password sign-in | It's the whole premise; hand out N credentials | LOW | `sb.auth.signInWithPassword`; seed via GoTrue admin API `email_confirm:true` (blueprint step 3). No sign-up UI — accounts are minted by the owner. |
| Offline-safe session restore | Core value is offline-first; a login wall at a dead-signal venue is unacceptable | MEDIUM | `getSession()` synchronous from localStorage on boot; **never** gate startup on a network auth check. `onAuthStateChange` reconciles when online. This is the highest-risk item — validated by spike but must not regress the v1 offline boot. |
| Display name shown on your own stuff | Users need to see "who am I logged in as" | LOW | `user_metadata.display_name`, seeded at account creation. Surface in a header/menu chip. |
| Sign-out | Table stakes for any account; also the identity-switch mechanism | LOW | `sb.auth.signOut()`. On a shared device this is how you hand the phone over. |
| Namespace existing single-user data under the user id on first login | v1 users have a local dex; it must become "their" dex, not leak across identities | MEDIUM | Blueprint calls this out explicitly. One-time migration: tag existing Dexie rows with the logged-in user id. Get this wrong and a shared/borrowed phone cross-contaminates dexes. |
| "Gizz With Friends" rebrand | The milestone ships it; signals the app is now multi-user | LOW | Wordmark/title/manifest copy. Pure chrome; no logic. Keep tab route/storage keys unchanged (same discipline as the v1 tab rebrand — labels only). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Distinct per-device identity with graceful stale-token reconnect | Mixed iOS/Android; each phone is "them" without re-login friction | MEDIUM | Blueprint open-item: an unexpired access token boots offline fine; a *very stale* one needs a network refresh before writes land. Handle as a reconnect-banner UX detail ("reconnecting…"), not an architecture change. A polished version is a differentiator; a crude "you're logged out" is a regression. |
| Identity color/avatar (auto from name) | Cheap way to make presence dots and leaderboard rows instantly legible in the dark | LOW | Deterministic color from user id (same idiom as tuning/rarity colors). No uploads, no storage. Feeds Area 3 presence dots and Area 2 rows. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Self-service sign-up / open registration | "Feels like a real app" | 5 known friends; open reg invites abuse, email-confirm flows, reset infra — overhead for a private tool | Owner mints accounts via the seed script; hand out credentials |
| Magic-link / OTP / social login | "Passwordless is modern" | Needs a mail round-trip at a venue with bad signal — the exact failure mode to avoid | Pre-made passwords (blueprint: explicitly the right call) |
| Password reset / change-password UI | "Users forget passwords" | For 5 people the owner re-mints via the admin API in seconds | Re-run the idempotent seed script; no in-app flow |
| Profile editing (bio, avatar upload, settings) | "Accounts have profiles" | Storage, moderation, upload plumbing for zero value at this scale | Display name is seeded and fixed; auto color/avatar |
| Multi-account switching on one device | "Share the phone" | Adds session-juggling complexity; sign-out already covers the rare hand-off | Sign-out → sign-in as the other person |

---

### Area 2 — Shared Dex Progress

#### Table Stakes

| Feature | Why Expected | Complexity | Notes / Reuse |
|---------|--------------|------------|---------------|
| Sync **a derived summary** of my dex, not raw attendance | The point is friends seeing progress; raw rows are wrong (see anti-features) | MEDIUM | New pure-core `deriveSharedProgress(DexStats)` → `{ display_name, songs_caught, completion_pct, show_count, rarest {songId,tier}, tierCounts, perAlbum, caughtSongIds }`. App upserts on dex change (debounced); core stays Supabase-free. |
| Friends screen listing each friend's headline progress | Core deliverable: "each friend's real dex progress visible" | MEDIUM | Read-all RLS `select`; full-table re-pull on `postgres_changes` (fine for ~5 rows). Rows = name + completion % + caught count + rarest badge. |
| Live update when a friend logs a catch | "Real dex progress synced" implies it moves during the residency | MEDIUM | `postgres_changes` on `public.progress`; **must** run `alter publication supabase_realtime add table progress` or it silently never fires (blueprint gotcha). |
| Write-own / read-all enforcement | Nobody should be able to inflate my numbers | LOW | RLS: `select` open to `authenticated`; `insert`/`update` gated to `auth.uid() = user_id`. Upsert **identity columns only** on presence so counts aren't reset (blueprint pattern). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes / Reuse |
|---------|-------------------|------------|---------------|
| **Live head-to-head compare via existing `compareDexes`** | The killer reuse: the async file-compare view becomes a live tap-a-friend view with zero new diff logic | LOW–MEDIUM | Requires Option-B payload (caught songIds). Reconstruct a minimal `DexStats`-shaped object from a friend's synced summary → feed the *unchanged* `compareDexes(myDex, theirDex)` → render the existing onlyMine/onlyTheirs/shared + columns. Highest-leverage feature in the milestone. |
| Mini-leaderboard (rank by completion % / caught / rarest) | A 5-person group *will* compete on the residency; makes progress a game | LOW | Pure sort over the synced summaries. Multiple sort keys (completion %, catch count, rarest tier). No new data. |
| Per-album / per-tier friend breakdown | Deepens compare beyond one number; leans on shipped `perAlbum` + rarity tiers | LOW | `DexStats.perAlbum` and tier counts already exist; project them into the summary. Reuses `CompareColumn.tierCounts` semantics. |
| "Rarest catches" showcase per friend | Bragging rights; rarity tiers already computed | LOW | Rarest catch already in `DexStats.rarestCatch`; expose top-N rarest per friend. Reuses the six-tier rarity language from share cards. |
| Live-syncing share card | The shipped `buildShareStats` card, but auto-current instead of a manual export | LOW | `buildShareStats(dex, archive)` unchanged; the friends screen can render each friend's card from their synced summary. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Sync **raw attendance rows** to the server | "Then we can re-derive anything / do collaborative stuff" | Bloats payload, edges toward server-side derivation (breaks "model/derivations stay client-side"), pushes toward SOCL-V2-01 reconciliation; most PII-ish option | Sync the derived summary (Option B); derivation stays in local core |
| Server-side `deriveDex` | "One source of truth on the server" | Violates the pure-client-derivation constraint; core must never depend on Postgres | Each client derives its own dex locally, syncs only the summary |
| Editing/merging a friend's dex from your device | Mirrors the old import-merge affordance | `compareDexes` is deliberately the *inverse* of merge — read-only by construction (T-06-24). Live sync must preserve that: read-all, write-own | Compare only; never write another user's row (RLS enforces it anyway) |
| Historical progress timeline / graph over the residency | "Show my climb night-by-night" | Needs time-series rows, retention, charting — scope creep for v2.0 | Defer; the live current-state summary is enough for the first multi-user milestone |
| Push notifications on friend catches | "Tell me when Dave catches a rarity" | Explicitly out of scope (PROJECT.md); push infra + permissions overhead | In-app presence/reactions (Area 3) cover live awareness while the app is open |

---

### Area 3 — Presence & Interactions

#### Table Stakes

| Feature | Why Expected | Complexity | Notes / Reuse |
|---------|--------------|------------|---------------|
| Online dots — who's currently in the app | The baseline of "awareness of each other" | MEDIUM | Supabase Realtime **presence** on one channel (`gizz-room`), keyed by user id. `presence sync` → `onlineIds`. Ephemeral — never persisted to Postgres (blueprint hard rule). |
| Lightweight reactions / waves | The milestone's stated "reactions/waves" | MEDIUM | Realtime **broadcast** on the same channel; `payload:{from,to}`, `to:null` = broadcast to everyone. Render as a transient toast. Ephemeral by design. |
| Ephemeral-only (nothing durable) | Presence/waves are moments, not records | LOW | Blueprint: rides Realtime, never Postgres. A wave leaves no trace — that's correct, not a gap. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "What they're doing" status | Turns a dumb online dot into ambient co-presence: "Dave's in LiveGizz," "Sam's browsing GizzDex" | MEDIUM | Track a coarse status enum in the presence payload (`{name, view: "live"\|"dex"\|"verse"\|"idle"}`). Blueprint explicitly says the same channel later carries richer status **with no new infrastructure** — this is the intended path. Keep it coarse (which tab), not fine-grained. |
| Targeted vs broadcast waves | A wave *at* a specific friend feels personal; a broadcast "🙌" hypes the group | LOW | `to` field already in the blueprint payload; targeted = `to:userId`, broadcast = `to:null`. |
| Small emoji/reaction palette (wave, fire, 🦎, "caught it!") | Cheap personality; fits the band fandom | LOW | Fixed small set of broadcast events; render as toasts. Reduced-motion-aware (reuse the Bingo celebration-layer discipline). |
| Presence-aware friends screen | Fuse Area 2 + Area 3: the leaderboard rows show a live dot + current activity | LOW | Merge presence state into the friends list render. No new backend. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Shared live setlist co-tracking** (see everyone's in-progress trail merge live) | "We're at the same show, let's track together" | This **is SOCL-V2-01** — deferred. Reopens offline-reconciliation, conflict resolution, and shared-mutable-state problems v2.0 exists to *avoid* | Presence "in LiveGizz" as a *status string* is fine (read-only awareness); a shared editable trail is not. Hard line. |
| Persisting waves/presence to Postgres (activity feed / history) | "See who waved earlier" | Blueprint hard rule: ephemeral rides Realtime, never DB. A durable feed adds tables, retention, RLS, cleanup | Keep it ephemeral; the moment is the feature |
| Chat / DMs / threaded messages | "We want to talk during the show" | Full messaging is a product unto itself; moderation, history, notifications | Waves + a tiny reaction palette; the group already has a group chat elsewhere |
| Typing indicators / read receipts / fine-grained "on song 7 of set 2" | "More real-time = better" | Fine-grained status needs the live-trail data that's SOCL-V2-01; also chatty on Realtime | Coarse tab-level status only ("in LiveGizz") — no per-song stream |
| Always-on background presence (report online when app closed) | "Show me as available all night" | PWAs can't reliably run background presence; drains battery; needs push | Presence only while foregrounded/open; drop on disconnect |

---

## Feature Dependencies

```
Accounts & Identity (Area 1)
    └──requires──> Supabase project + seed script + RLS schema (blueprint steps 3–4)
    └──gates──────> EVERYTHING (no identity → no per-user rows, no presence key)

Shared Dex Progress (Area 2)
    └──requires──> Area 1 (user_id keys every progress row; RLS = auth.uid())
    └──requires──> deriveSharedProgress(DexStats)   [new pure-core projector]
    └──reuses─────> deriveDex, compareDexes, buildShareStats   [SHIPPED, unchanged]
    └──requires──> Option-B sync payload (caught songIds) to unlock live compareDexes

Presence & Interactions (Area 3)
    └──requires──> Area 1 (presence keyed by user id; wave from/to = user ids)
    └──independent of──> Area 2 (Realtime channel, no Postgres dependency)

Live head-to-head compare ──enhances──> Friends screen (Area 2)
"What they're doing" status ──enhances──> Friends screen (Area 2)

SOCL-V2-01 (shared live setlist) ──CONFLICTS/OUT-OF-SCOPE──> Area 3 presence status
    (coarse status string OK; shared mutable trail is the deferred line)
```

### Dependency Notes

- **Area 1 gates the milestone.** No identity → no `user_id` to key progress rows or presence. Build accounts + offline-safe session first; it's also the highest-risk item (offline boot must not regress).
- **Area 2 depends on a new pure-core projector**, not new derivation logic. `deriveDex` already produces everything; `deriveSharedProgress` is a thin serializable projection. The Supabase upsert lives entirely in the app layer.
- **Live compare requires the Option-B payload.** If requirements pick counters-only (Option A), the shipped `compareDexes` diff lists can't be rendered live — you'd be discarding working code. Flag this decision explicitly in requirements.
- **Area 3 is Postgres-independent.** Presence + waves ride one Realtime channel; it can ship in parallel with Area 2 once Area 1 exists. Most self-contained area.
- **The status-string conflict with SOCL-V2-01 is subtle.** "Dave is in LiveGizz" as a read-only presence broadcast is in scope; "Dave and I share tonight's editable setlist" is the deferred feature. Requirements must draw this line so presence status doesn't creep into collaborative logging.

---

## MVP Definition

### Launch With (v2.0 core)

- [ ] **Pre-made email/password sign-in + offline-safe session restore** — the gate for everything; the offline-boot behavior is make-or-break.
- [ ] **First-login data namespacing** — existing single-user dex becomes the logged-in user's, cleanly, once.
- [ ] **"Gizz With Friends" rebrand** — ships with the milestone; trivial but part of the deliverable.
- [ ] **`deriveSharedProgress` + progress upsert (Option B payload)** — sync the derived summary incl. caught songIds.
- [ ] **Friends screen with live headline progress + `postgres_changes` updates** — the visible payoff of shared progress.
- [ ] **Live head-to-head compare reusing `compareDexes`** — highest-leverage reuse; makes the async compare view live.
- [ ] **Online presence dots + broadcast/targeted waves** — the "awareness of each other" baseline.

### Add After Validation (v2.x)

- [ ] **"What they're doing" coarse status** — add once presence dots are solid; same channel, no new infra (blueprint-blessed path).
- [ ] **Mini-leaderboard sorts + per-album/per-tier friend breakdowns** — deepen the friends screen once the summary sync is trusted.
- [ ] **Emoji reaction palette + reaction-on-friends-screen** — personality layer after core waves work.
- [ ] **Polished stale-token reconnect UX** — upgrade from a crude banner once the happy path is proven.

### Future Consideration (post-v2.0 / explicitly deferred)

- [ ] **Shared live setlist co-tracking (SOCL-V2-01)** — the hard line; reopens offline reconciliation. Not this milestone.
- [ ] **Historical progress timelines / night-by-night climb graphs** — needs time-series storage.
- [ ] **Push notifications** — out of scope per PROJECT.md.
- [ ] **Overlaps with the deferred casual backlog** (Guezz League pregame picks, Couch Mode follow-from-home, badge system) — these *layer on* the multi-user foundation but are separate milestones. Note the overlap; do not pull them in.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pre-made login + offline-safe session | HIGH | MEDIUM (spike-validated, but offline-boot is the risk) | P1 |
| First-login data namespacing | HIGH (correctness) | MEDIUM | P1 |
| `deriveSharedProgress` projector (Option B) | HIGH | LOW–MEDIUM | P1 |
| Friends screen + live `postgres_changes` | HIGH | MEDIUM | P1 |
| Live compare via `compareDexes` (reuse) | HIGH | LOW–MEDIUM | P1 |
| Presence dots + waves | HIGH | MEDIUM | P1 |
| "Gizz With Friends" rebrand | LOW (but in-scope) | LOW | P1 |
| Auto identity color/avatar | MEDIUM | LOW | P2 |
| "What they're doing" status | MEDIUM–HIGH | MEDIUM | P2 |
| Mini-leaderboard sorts | MEDIUM | LOW | P2 |
| Per-album/per-tier friend breakdown | MEDIUM | LOW | P2 |
| Emoji reaction palette | MEDIUM | LOW | P2 |
| Polished reconnect UX | MEDIUM | MEDIUM | P2 |
| Shared live setlist (SOCL-V2-01) | HIGH (but deferred) | HIGH | P3 / out |
| Push notifications | LOW | HIGH | Out |

## Reuse Map (existing code the roadmap must lean on)

| Existing artifact | Location | v2.0 reuse |
|-------------------|----------|------------|
| `deriveDex(snapshot, archive, albums, rarity) → DexStats` | `packages/core/src/dex/derive-dex.ts` | Runs locally per user; its output feeds the new `deriveSharedProgress` projector. **Unchanged.** |
| `DexStats` shape (completion, perSong sightings, neverSeen, rarestCatch, showCount, perAlbum) | same | The superset the synced summary projects from. |
| `compareDexes(mine, theirs) → CompareResult` | `packages/core/src/dex/compare.ts` | Reconstruct a minimal `DexStats` from a friend's synced summary → feed unchanged → render live head-to-head. **The key reuse.** Requires Option-B (caught songIds) payload. |
| `buildShareStats(dex, archive)` / `buildRecapShareStats` | `packages/core/src/dex/share-stats.ts` | Live-current share cards on the friends screen; no export step. **Unchanged.** |
| Six-tier rarity language + tier colors | `config.dex.tierColors`, `rarity.ts` | Consistent tier badges in leaderboard/compare rows. |
| Auto/identity color idiom (tuning/rarity colors) | app | Deterministic per-user color for presence dots + rows. |
| **New:** `deriveSharedProgress(DexStats) → SharedProgress` | to build, `packages/core/src/dex/` | Pure serializable projection; the ONLY new core piece. App-layer Supabase upsert consumes it — core never imports the client. |

## Scope Boundary vs SOCL-V2-01 (explicit)

**In scope (v2.0):**
- Presence *status strings* — "in LiveGizz," "browsing GizzDex" — read-only, ephemeral, broadcast.
- Shared *durable progress* — derived dex summaries, low-frequency upserts, read-all/write-own.
- Ephemeral reactions/waves.

**Out of scope (SOCL-V2-01, deferred):**
- Any *shared mutable setlist* — co-editing tonight's trail, merging friends' in-progress logs, conflict resolution, offline reconciliation of live show state.
- Fine-grained "on song 7 of set 2" streaming (needs the live-trail data path that is SOCL-V2-01).

**The tripwire for requirements review:** if a proposed sub-feature requires writing another user's setlist/trail, or reconciling two people's in-progress show logs, it has crossed into SOCL-V2-01 and must be cut. Presence-as-awareness (read-only) is the ceiling for live show interaction in v2.0.

## Sources

- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — spike-validated blueprint (auth/identity 002, synced-progress 003, presence-and-ping 004), all VALIDATED — **HIGH confidence**
- `.planning/PROJECT.md` — v2.0 milestone scope, revised constraints, SOCL-V2-01 deferral, out-of-scope list — **HIGH confidence**
- `.planning/STATE.md` — deferred backlog (Guezz League, Couch Mode, badges) for overlap awareness — **HIGH confidence**
- `packages/core/src/dex/derive-dex.ts`, `compare.ts`, `share-stats.ts` — inspected shipped derivations for exact reuse surface — **HIGH confidence**
- Ecosystem norms for tiny-group presence/reactions (ephemeral-first, coarse status, no chat) — training knowledge cross-checked against the blueprint's Realtime patterns — **MEDIUM confidence**

---
*Feature research for: multi-user foundation of a private friend-group live-music PWA*
*Researched: 2026-07-22*
