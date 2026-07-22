# Requirements: Guezzer — Milestone v2.0 "Multi-User Foundation"

**Defined:** 2026-07-22
**Core Value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.
**Milestone Goal:** Give the ~5-friend group distinct identities and lightweight awareness of each other, backed by Supabase, without breaking offline-first.

> **Backend decision (locked 2026-07-22 — Option A):** Supabase is THE multi-user foundation (accounts, durable read-all/write-own progress, ephemeral Realtime presence — validated by spikes 002–004). The already-merged **GizzMap Cloudflare Worker relay** (`packages/relay`) is kept as-is as a purpose-built satellite for encrypted GPS beacons + pins; it is **not** in this milestone's scope. Converging the map onto Supabase (Option B) stays deferred (see SOCL/Future). See `.claude/skills/spike-findings-guezzer/`.

## v2.0 Requirements

Requirements for the Multi-User Foundation milestone. Each maps to exactly one roadmap phase.

### Foundation & Setup (SETUP)

- [ ] **SETUP-01**: A Supabase project is provisioned with the durable-progress schema — a `public.progress` table keyed by `user_id`, read-all/write-own RLS policies, and `alter publication supabase_realtime add table public.progress` so `postgres_changes` actually fires (blueprint gotcha: without it, live updates silently never arrive).
- [ ] **SETUP-02**: An idempotent account-seed script mints the N friend accounts via the GoTrue admin API (`email_confirm:true`, distinct per-person passwords, `user_metadata.display_name`); re-running skips already-registered accounts. No in-app sign-up.
- [ ] **SETUP-03**: Secrets discipline — the `service_role` key and all account passwords live in env only, never committed; the `anon` key + project URL may ship in client code (anon is public by design).
- [ ] **SETUP-04**: The Supabase client is isolated in the app layer; `packages/core` never imports it, so the transition-matrix / dex derivations stay pure and DOM/network-free (hard constraint preserved).

### Accounts & Identity (AUTH)

- [ ] **AUTH-01**: A friend can sign in with a pre-made email/password (owner-minted) and reach the app as their distinct identity — no self-service registration.
- [ ] **AUTH-02**: The app boots offline from a restored, unexpired session (`getSession()` synchronously from localStorage) — startup is NEVER gated on a live network auth check, so a dead-signal venue still opens the app. `onAuthStateChange` reconciles when connectivity returns. *(Highest-risk item — must not regress the v1 offline boot.)*
- [ ] **AUTH-03**: The signed-in user can see who they are logged in as (seeded `display_name`) surfaced in the app chrome (header/menu chip).
- [ ] **AUTH-04**: The user can sign out; on a shared/borrowed device this is the identity hand-off mechanism.
- [ ] **AUTH-05**: On first login, the existing single-user Dexie data is namespaced to the logged-in user id exactly once — a borrowed or shared phone never cross-contaminates two friends' dexes.
- [ ] **AUTH-06**: The app ships the "Gizz With Friends" rebrand — wordmark, document title, and PWA manifest copy — signalling the multi-user identity. Display labels/chrome only: tab routes, file paths, and persisted Dexie/storage keys stay unchanged (same discipline as the v1 tab rebrand). *(Header title already renamed in commit 30f86cc; remaining surfaces here.)*
- [ ] **AUTH-07**: Each identity has a deterministic auto color/avatar derived from the user id (same idiom as tuning/rarity colors) — no uploads, no storage — legible for presence dots and friend rows in the dark. Feeds PROG + PRES.
- [ ] **AUTH-08**: A stale access token reconnects gracefully — a calm "reconnecting…" affordance rather than a jarring "you're logged out," so the offline→online transition and deferred writes land without a perceived logout. *(Blueprint open-item handled as UX, not an architecture change.)*

### Shared Dex Progress (PROG)

- [ ] **PROG-01**: A new pure-core `deriveSharedProgress(DexStats) → SharedProgress` projects each user's locally-derived dex into a serializable summary using the **Option B payload**: `display_name`, `songs_caught`, completion %, `show_count`, rarest `{songId,tier}`, per-tier counts, `perAlbum`, and the `caughtSongIds` int[]. Core never imports Supabase.
- [ ] **PROG-02**: The app upserts the signed-in user's progress summary to Supabase when their dex changes (debounced), writing only that user's own row; presence-style writes touch identity columns only so counts are never reset.
- [ ] **PROG-03**: Read-all / write-own is enforced by RLS — every friend can read all progress rows, but a user can only insert/update their own (`auth.uid() = user_id`); nobody can inflate another friend's numbers.
- [ ] **PROG-04**: A friends screen lists each friend's headline progress (name + completion % + caught count + rarest badge), read live from Supabase.
- [ ] **PROG-05**: When a friend logs a catch, the friends screen updates live via `postgres_changes` (full-table re-pull is fine at ~5 rows) — progress visibly moves during the residency.
- [ ] **PROG-06**: Tapping a friend shows a live head-to-head comparison by reconstructing a minimal `DexStats` from their synced summary and feeding the **unchanged** shipped `compareDexes(mine, theirs)` — the async file-compare view becomes live with zero new diff logic. *(Requires the Option-B payload.)*
- [ ] **PROG-07**: The friend comparison exposes a per-album / per-tier breakdown, projecting the shipped `DexStats.perAlbum` + rarity tier counts into the summary (reuses `CompareColumn` semantics).
- [ ] **PROG-08**: Each friend's rarest catches are showcased (top-N by rarity), reusing the shipped six-tier rarity language and colors.

### Presence & Interactions (PRES)

- [ ] **PRES-01**: Online presence dots show who is currently in the app, via Supabase Realtime **presence** on one channel keyed by user id — ephemeral, dropped on disconnect, never persisted.
- [ ] **PRES-02**: A user can send a lightweight wave that peers see as a transient toast, via Realtime **broadcast** on the same channel — ephemeral, leaving no durable trace.
- [ ] **PRES-03**: Presence and waves are ephemeral by construction — nothing about who's online or who waved is ever written to Postgres.
- [ ] **PRES-04**: Presence carries a coarse, read-only "what they're doing" status — which tab a friend is in (LiveGizz / GizzDex / GizzVerse / idle) — on the same channel, no new infra. Tab-level only; never per-song (that would cross into the deferred SOCL-V2-01 line).
- [ ] **PRES-05**: Waves can be targeted at one friend (`to:userId`, feels personal) or broadcast to everyone (`to:null`, hypes the group).
- [ ] **PRES-06**: A small fixed emoji reaction palette (e.g. wave / fire / 🦎 / "caught it!") is available as broadcast reactions rendered as reduced-motion-aware toasts (reuses the Bingo celebration-layer discipline).
- [ ] **PRES-07**: The friends screen is presence-aware — each row shows a live online dot + the friend's current coarse activity, fusing PROG + PRES with no new backend.

## Future Requirements

Deferred beyond v2.0. Tracked, not in this roadmap.

### Deferred this milestone (scoped out during requirements)

- **PROG-F1**: Mini-leaderboard with multiple sort keys (completion % / catch count / rarest tier) — pure sort over synced summaries, no new data. *(Deferred by owner during v2.0 scoping.)*
- **PROG-F2**: Live-syncing share card per friend (shipped `buildShareStats`, auto-current instead of manual export). *(Deferred by owner during v2.0 scoping.)*

### Backend convergence (Option A follow-on)

- **MAP-F1**: Reconcile GizzMap membership with account identity — derive the map group-secret from the Supabase session so a friend "joins" once instead of twice (account + map secret). Build only *if the double-join friction proves annoying*; not a rewrite of the relay.
- **MAP-F2**: Full port of GizzMap beacons/pins onto Supabase Realtime + a pins table, retiring the Worker relay (backend "Option B" consolidation). Deferred, not rejected — costs the map's zero-knowledge privacy, so only if operating two backends becomes a real burden.

### Explicitly deferred capabilities

- **SOCL-V2-01**: Shared live setlist co-tracking — see everyone's in-progress trail merged live / co-edit tonight's setlist. The hard scope line: reopens offline reconciliation, conflict resolution, and shared-mutable-state problems v2.0 exists to avoid. Presence-as-awareness (read-only status strings) is the ceiling.
- **PROG-F3**: Historical progress timeline / night-by-night climb graph — needs time-series rows, retention, charting.
- Overlapping casual backlog (Guezz League pregame picks, Couch Mode follow-from-home, badge system) — these *layer on* the multi-user foundation but are separate milestones; noted, not pulled in.

## Out of Scope

Explicitly excluded to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Self-service sign-up / open registration | 5 known friends; open reg invites abuse + email-confirm/reset infra. Owner mints accounts via the seed script. |
| Magic-link / OTP / social login | Needs a mail round-trip at a bad-signal venue — the exact failure mode to avoid. Pre-made passwords win. |
| Password reset / change-password UI | For 5 people the owner re-mints via the idempotent seed script in seconds. |
| Profile editing (bio, avatar upload, settings) | Storage/moderation/upload plumbing for zero value at this scale. Display name is seeded; color/avatar is auto. |
| Multi-account switching on one device | Adds session-juggling complexity; sign-out → sign-in already covers the rare hand-off. |
| Sync raw attendance rows to the server | Bloats payload, pushes derivation server-side (breaks pure-client-core), edges toward SOCL-V2-01. Sync the derived summary. |
| Server-side `deriveDex` | Violates the pure-client-derivation constraint; core must never depend on Postgres. Each client derives locally. |
| Editing/merging a friend's dex from your device | `compareDexes` is deliberately the read-only inverse of merge (T-06-24); RLS enforces write-own anyway. |
| Push notifications on friend catches | Out per PROJECT.md; push infra + permissions overhead. In-app presence/reactions cover live awareness. |
| Chat / DMs / threaded messages | A product unto itself (moderation, history); the group has a chat elsewhere. Waves + reactions suffice. |
| Typing indicators / fine-grained "on song 7 of set 2" status | Needs the live-trail data path that IS SOCL-V2-01; chatty on Realtime. Coarse tab-level status only. |
| Always-on background presence (report online when app closed) | PWAs can't reliably run background presence; drains battery; needs push. Foreground-only, drop on disconnect. |

## Traceability

Which phases cover which requirements. Filled during roadmap creation (Phases 17–20, continue-numbering from v1.2's Phase 16).

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 17 | Pending |
| SETUP-02 | Phase 17 | Pending |
| SETUP-03 | Phase 17 | Pending |
| SETUP-04 | Phase 17 | Pending |
| AUTH-01 | Phase 18 | Pending |
| AUTH-02 | Phase 18 | Pending |
| AUTH-03 | Phase 18 | Pending |
| AUTH-04 | Phase 18 | Pending |
| AUTH-05 | Phase 18 | Pending |
| AUTH-06 | Phase 18 | Pending |
| AUTH-07 | Phase 18 | Pending |
| AUTH-08 | Phase 18 | Pending |
| PROG-01 | Phase 19 | Pending |
| PROG-02 | Phase 19 | Pending |
| PROG-03 | Phase 19 | Pending |
| PROG-04 | Phase 19 | Pending |
| PROG-05 | Phase 19 | Pending |
| PROG-06 | Phase 19 | Pending |
| PROG-07 | Phase 19 | Pending |
| PROG-08 | Phase 19 | Pending |
| PRES-01 | Phase 20 | Pending |
| PRES-02 | Phase 20 | Pending |
| PRES-03 | Phase 20 | Pending |
| PRES-04 | Phase 20 | Pending |
| PRES-05 | Phase 20 | Pending |
| PRES-06 | Phase 20 | Pending |
| PRES-07 | Phase 20 | Pending |

**Coverage:**
- v2.0 requirements: 27 total (SETUP ×4, AUTH ×8, PROG ×8, PRES ×7)
- Mapped to phases: 27 / 27 ✓ (Phase 17 ×4, Phase 18 ×8, Phase 19 ×8, Phase 20 ×7)
- Unmapped: 0 ✓ — no orphans, no double-mapping

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 — traceability filled at roadmap creation (Phases 17–20, 100% coverage)*
