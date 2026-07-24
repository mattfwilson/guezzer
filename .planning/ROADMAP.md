# Roadmap: Guezzer

## Milestones

- ✅ **v1.0 MVP** — Phases 1–7 (shipped 2026-07-17) — [archived roadmap](./milestones/v1.0-ROADMAP.md) · [requirements](./milestones/v1.0-REQUIREMENTS.md) · [audit](./milestones/v1.0-MILESTONE-AUDIT.md)
- ✅ **v1.1 Polish & Pre-Show Hardening** — Phases 8–10 (shipped 2026-07-19) — [archived roadmap](./milestones/v1.1-ROADMAP.md) · [requirements](./milestones/v1.1-REQUIREMENTS.md)
- ✅ **v1.2 Pre-Show Hardening** — Phases 11–16 (shipped 2026-07-22) — [archived roadmap](./milestones/v1.2-ROADMAP.md) · [requirements](./milestones/v1.2-REQUIREMENTS.md)
- 🚧 **v2.0 Multi-User Foundation** — Phases 17–20 (in progress, started 2026-07-22) — "Gizz With Friends": Supabase-backed accounts, shared dex progress, and presence/reactions for the ~5-friend group, without breaking offline-first.

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–7) — SHIPPED 2026-07-17</summary>

- [x] Phase 1: Corpus Ingestion & Schema Foundation (5/5 plans) — completed 2026-07-08
- [x] Phase 2: Transition Matrix, Model & Backtest (5/5 plans) — completed 2026-07-09
- [x] Phase 3: App Shell & PWA Foundation (4/4 plans) — completed 2026-07-09
- [x] Phase 4: Show Mode (7/7 plans) — completed 2026-07-13
- [x] Phase 5: Live Sync & Data Safety (6/6 plans) — completed 2026-07-14
- [x] Phase 6: Pokédex, History & Stats (12/12 plans) — completed 2026-07-16
- [x] Phase 7: Explore Mode Constellation (7/7 plans) — completed 2026-07-16

Full phase detail, success criteria, and plan breakdowns: [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Polish & Pre-Show Hardening (Phases 8–10) — SHIPPED 2026-07-19</summary>

Small, low-risk hardening milestone — no new user-facing features. Closed the v1.0 audit's non-blocking gaps (UI legibility, accessibility, data integrity, restore UX) and proved the app show-ready on real hardware before show #1 (late Aug/Sep 2026).

- [x] Phase 8: On-Device UI Polish & Accessibility (8/8 plans) — completed 2026-07-18
- [x] Phase 9: Data Integrity & Restore UX (2/2 plans) — completed 2026-07-18
- [x] Phase 10: Pre-Show Validation & Device Dry-Run (2/2 plans) — completed 2026-07-18

Full phase detail, success criteria, and plan breakdowns: [milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Pre-Show Hardening (Phases 11–16) — SHIPPED 2026-07-22</summary>

Hardened the show-critical paths (live sync, prediction correctness, data safety) before the Aug 14, 2026 residency, then shipped the first casual engagement feature — Gizz Bingo. Bugs landed before Bingo (the show-#1 trust gate); Gizz Bingo cleared two hard upstream gates (Phase 11 live-sync correctness + the Monte-Carlo fill-rate calibration that wrote locked constants to config). All 22 requirements delivered; all human UAT confirmed on-device.

- [x] Phase 11: Live-Sync & Prediction Correctness (5/5 plans) — completed 2026-07-19
- [x] Phase 12: Data Safety & Integrity (3/3 plans) — completed 2026-07-19
- [x] Phase 13: Interface & Explore Polish (4/4 plans) — completed 2026-07-20
- [x] Phase 14: Gizz Bingo — Core Marking & Generation (6/6 plans) — completed 2026-07-20
- [x] Phase 15: Gizz Bingo — Persistence, Lock & Replay (4/4 plans) — completed 2026-07-21
- [x] Phase 16: Gizz Bingo — Build, Live Marking & Celebrations (6/6 plans) — completed 2026-07-21

Full phase detail, success criteria, and plan breakdowns: [milestones/v1.2-ROADMAP.md](./milestones/v1.2-ROADMAP.md)

</details>

### 🚧 v2.0 Multi-User Foundation (Phases 17–20) — IN PROGRESS

Give the ~5-friend group distinct identities and lightweight awareness of each other, backed by a hosted Supabase (auth + Postgres + Realtime), **without breaking offline-first**. The prediction model + all v1 derivations stay client-side and pure; every Supabase import is fenced into the app layer (`packages/app/src/sync/`) so `core` purity is preserved by construction. Not a show-#1 gate — the core app is already show-ready for Aug 14, 2026; this milestone targets the residency run. Ships the "Gizz With Friends" rebrand.

Ordering is dependency- and risk-driven: **SETUP + AUTH gate everything** (no identity → no `user_id` to key progress or presence), and AUTH-02 (offline-safe session restore) is the highest-risk item — it must not regress the shipped v1 offline boot, so it is device-verified before anything depends on it. PROG rides AUTH's identity + the pure-core `deriveSharedProgress` projector; PRES rides AUTH's identity but is Postgres-independent (Realtime only).

- [x] **Phase 17: Backend Foundation & Secrets** - Provision the Supabase project — RLS'd `progress` schema, idempotent account seeding, secret hygiene, core-purity boundary (completed 2026-07-22)
- [x] **Phase 18: Accounts & Offline-Safe Identity** - Pre-made email/password sign-in with a distinct per-device identity that still boots fully offline; ships the "Gizz With Friends" rebrand (completed 2026-07-22)
- [x] **Phase 19: Shared Dex Progress** - Each friend's real dex progress synced and visible/comparable live in a friends view (completed 2026-07-24)
- [ ] **Phase 20: Presence & Interactions** - Who's online / what they're doing, plus lightweight targeted/broadcast waves and reactions

## Phase Details

### Phase 17: Backend Foundation & Secrets

**Goal**: A hosted Supabase backend exists with a secure, RLS-enforced durable-progress schema and idempotently-seeded friend accounts — and `core` stays pure by construction. This is the foundation every downstream phase keys off; it must exist (and its secret-hygiene gate must hold) before any client code depends on it.
**Depends on**: Nothing (first phase of the milestone)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04
**Success Criteria** (what must be TRUE):

  1. Running the account-seed script mints the friend accounts (`email_confirm:true`, distinct per-person passwords, `user_metadata.display_name`); re-running it skips already-registered accounts (idempotent) — there is no in-app sign-up (SETUP-02).
  2. The `public.progress` table (keyed by `user_id`) enforces read-all / write-own RLS, and is added to the `supabase_realtime` publication so `postgres_changes` actually fires (SETUP-01).
  3. No secret is committed to git — the `service_role` key and all account passwords live in env only (never `VITE_`-prefixed); the `anon` key + project URL may ship in client code (SETUP-03).
  4. `packages/core` imports zero Supabase code — a boundary check confirms the transition-matrix / dex derivations stay pure and DOM/network-free (SETUP-04).

**Plans**: 4 plans

**Wave 1**

- [x] 17-01-PLAN.md — Supabase client dep, CLI scaffold + app-layer client module (SETUP-04 / D-14)
- [x] 17-02-PLAN.md — Secret hygiene (.gitignore + .env.example) + core-purity guard test (SETUP-03, SETUP-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-03-PLAN.md — Progress migration (schema + RLS + realtime pub) + idempotent seed script & roster (SETUP-01, SETUP-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-04-PLAN.md — Provision project, link, [BLOCKING] db push, seed twice for idempotency (SETUP-01, SETUP-02, SETUP-03)

### Phase 18: Accounts & Offline-Safe Identity

**Goal**: Each friend signs into their own pre-made identity and reaches the app — and the app still cold-boots fully offline at a dead-signal venue. This owns the milestone's highest-risk seam (offline-safe identity) and is the gate for all shared state; prove offline boot on-device before Phases 19–20 build on it.
**Depends on**: Phase 17
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):

  1. A friend signs in with a pre-made (owner-minted) email/password and reaches the app as their distinct identity — no self-service registration (AUTH-01).
  2. After signing in once on wifi, the app cold-boots fully offline to the complete dex — startup is NEVER gated on a live network auth check, and reconnecting reconciles quietly (AUTH-02, highest-risk; must not regress v1 offline boot).
  3. The signed-in user can see who they are (seeded `display_name`) in the app chrome and can sign out to hand a shared device to another friend (AUTH-03, AUTH-04).
  4. On first login the existing single-user Dexie data is namespaced to that user id exactly once, so a borrowed/shared phone never cross-contaminates two friends' dexes (AUTH-05).
  5. The app shows the "Gizz With Friends" rebrand (wordmark, title, manifest), each identity gets a deterministic auto color/avatar from its user id, and a stale token reconnects with a calm "reconnecting…" affordance rather than a jarring logout (AUTH-06, AUTH-07, AUTH-08).

**Plans**: 7 plans

**Wave 1** *(parallel — no file overlap)*

- [x] 18-01-PLAN.md — Identity color core helper + `config.auth` palette/copy + "Gizz With Friends" rebrand chrome (AUTH-07, AUTH-06)
- [x] 18-02-PLAN.md — Dexie `version(7)` namespacing + `userId` field + one-time claim (AUTH-05)
- [x] 18-03-PLAN.md — App-owned identity record substrate + `useAuthIdentity` hook (AUTH-02)

**Wave 2** *(depends on Wave 1)*

- [x] 18-04-PLAN.md — Sign-in surface: name-picker + password + connect-once + inline error + roster (AUTH-01)
- [x] 18-05-PLAN.md — Identity chrome: header avatar + sign-out sheet + SyncDot reconnecting state (AUTH-03, AUTH-04, AUTH-07, AUTH-08)
- [x] 18-07-PLAN.md — Scope the four view consumers + export/import to the current identity AND stamp userId on every create path via Dexie hooks (AUTH-05)

**Wave 3** *(depends on Wave 2 — THE CRUX)*

- [x] 18-06-PLAN.md — Offline-safe boot gate + main/App integration + scoped `useDexStats` + device offline-boot UAT (AUTH-02, AUTH-04, AUTH-05)

**UI hint**: yes

### Phase 19: Shared Dex Progress

**Goal**: Each friend's real dex progress (completion %, catches, rarities) syncs to Supabase and is visible and comparable live in a friends view — the visible payoff of the milestone, replacing the manual JSON-file handoff. Depends on Phase 18's identity (every progress row is keyed by `user_id`) and the new pure-core `deriveSharedProgress` projector.
**Depends on**: Phase 18
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, PROG-05, PROG-06, PROG-07, PROG-08
**Success Criteria** (what must be TRUE):

  1. A friends screen lists each friend's headline progress (name + completion % + caught count + rarest badge), read live from Supabase, and the signed-in user's own summary upserts (debounced) to their own row when their dex changes (PROG-01, PROG-02, PROG-04).
  2. When a friend logs a catch, the friends screen updates live via `postgres_changes` — progress visibly moves during the residency (PROG-05).
  3. Write-own is enforced by RLS — every friend can read all rows, but nobody can inflate another friend's numbers (`auth.uid() = user_id`) (PROG-03).
  4. Tapping a friend shows a live head-to-head comparison — reconstructing a minimal `DexStats` from their synced summary and feeding the unchanged shipped `compareDexes` — with a per-album / per-tier breakdown (PROG-06, PROG-07).
  5. Each friend's rarest catches are showcased (top-N by rarity), reusing the shipped six-tier rarity language and colors (PROG-08).

**Plans**: 4 plans

**Wave 1** *(pure core — no dependencies)*

- [x] 19-01-PLAN.md — Pure-core `deriveSharedProgress` projector + `reconstructDexStats` + `selectRarestCaught` + `sharedProgressSchema`/`parseSharedProgress` + round-trip fidelity test (PROG-01, PROG-06, PROG-07, PROG-08)

**Wave 2** *(app sync fence — depends on 19-01)*

- [x] 19-02-PLAN.md — App-layer `packages/app/src/sync/` module: debounced identity-safe own-row upsert, app-wide `postgres_changes` subscription + validated re-pull, reconnect flush, Dexie offline cache, `config.friends` (PROG-02, PROG-03, PROG-05)

**Wave 3** *(Friends UI — depends on 19-01 + 19-02)*

- [x] 19-03-PLAN.md — Friends surface in GizzDex: `Friends` segment, `FriendsList`/`FriendRow`/`SelfRow`, `FriendDetail` (reconstruct → unchanged `compareDexes`), `RarestShowcase` (PROG-04, PROG-06, PROG-07, PROG-08)

**Wave 4** *(device UAT checkpoint — depends on 19-03)*

- [x] 19-04-PLAN.md — [BLOCKING] Two-device live-propagation + reconnect flush + never-blank offline + RLS write-own verification (PROG-03, PROG-05)

**UI hint**: yes

### Phase 20: Presence & Interactions

**Goal**: Friends can see who is currently online and (coarsely) what they're doing, and send lightweight waves and reactions to each other — all ephemeral, never persisted. Depends on Phase 18's identity but is Postgres-independent (Realtime presence + broadcast only), so it can proceed in parallel with Phase 19 once identity is device-verified. Hard scope line: coarse tab-level status only — any shared mutable setlist is the deferred SOCL-V2-01 line.
**Depends on**: Phase 18 (parallelizable with Phase 19)
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04, PRES-05, PRES-06, PRES-07
**Success Criteria** (what must be TRUE):

  1. Online presence dots show who is currently in the app, via Realtime presence on one channel keyed by user id — ephemeral, dropped on disconnect, and never written to Postgres (PRES-01, PRES-03).
  2. Each presence entry carries a coarse, read-only "what they're doing" status — which tab a friend is in (LiveGizz / GizzDex / GizzVerse / idle), tab-level only, never per-song (PRES-04).
  3. A user can send a wave — targeted at one friend (`to:userId`) or broadcast to everyone (`to:null`) — that peers see as a transient, reduced-motion-aware toast (PRES-02, PRES-05).
  4. A small fixed emoji reaction palette (wave / fire / 🦎 / "caught it!") broadcasts reactions rendered as toasts, reusing the Bingo celebration-layer discipline (PRES-06).
  5. The friends screen is presence-aware — each row shows a live online dot + the friend's current coarse activity, fusing PROG + PRES with no new backend (PRES-07).

**Plans**: 5 plans

**Wave 1**

- [ ] 20-01-PLAN.md — Foundation: config.presence/copy + pure activity derivation + visibility hook + presence store/channel primitives/validateWave/sendWave (PRES-01/03/04/05)

**Wave 2** *(depends on Wave 1)*

- [ ] 20-02-PLAN.md — WaveToast host (bounded FIFO brief-drain queue) + ReactionPalette (fixed 4-emoji + target picker) (PRES-02/05/06)

**Wave 3** *(depends on Waves 1–2)*

- [ ] 20-03-PLAN.md — Singleton usePresence() engine (sole gizz-room owner) + pure presence readers + App.tsx mount (PRES-01/02/03/04)

**Wave 4** *(depends on Waves 1–3)*

- [ ] 20-04-PLAN.md — Friends-screen fusion: fill reserved FriendRow/SelfRow presence slots + palette/FriendDetail send entry points (PRES-07/01/04/05)

**Wave 5** *(device gate — depends on Wave 4)*

- [ ] 20-05-PLAN.md — [BLOCKING] Two-device live presence + wave/reaction UAT (PRES-01/02/05/07)

**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Corpus Ingestion & Schema Foundation | v1.0 | 5/5 | Complete | 2026-07-08 |
| 2. Transition Matrix, Model & Backtest | v1.0 | 5/5 | Complete | 2026-07-09 |
| 3. App Shell & PWA Foundation | v1.0 | 4/4 | Complete | 2026-07-09 |
| 4. Show Mode | v1.0 | 7/7 | Complete | 2026-07-13 |
| 5. Live Sync & Data Safety | v1.0 | 6/6 | Complete | 2026-07-14 |
| 6. Pokédex, History & Stats | v1.0 | 12/12 | Complete | 2026-07-16 |
| 7. Explore Mode Constellation | v1.0 | 7/7 | Complete | 2026-07-16 |
| 8. On-Device UI Polish & Accessibility | v1.1 | 8/8 | Complete | 2026-07-18 |
| 9. Data Integrity & Restore UX | v1.1 | 2/2 | Complete | 2026-07-18 |
| 10. Pre-Show Validation & Device Dry-Run | v1.1 | 2/2 | Complete | 2026-07-18 |
| 11. Live-Sync & Prediction Correctness | v1.2 | 5/5 | Complete | 2026-07-19 |
| 12. Data Safety & Integrity | v1.2 | 3/3 | Complete | 2026-07-19 |
| 13. Interface & Explore Polish | v1.2 | 4/4 | Complete | 2026-07-20 |
| 14. Gizz Bingo — Core Marking & Generation | v1.2 | 6/6 | Complete | 2026-07-20 |
| 15. Gizz Bingo — Persistence, Lock & Replay | v1.2 | 4/4 | Complete | 2026-07-21 |
| 16. Gizz Bingo — Build, Live Marking & Celebrations | v1.2 | 6/6 | Complete | 2026-07-21 |
| 17. Backend Foundation & Secrets | v2.0 | 4/4 | Complete    | 2026-07-22 |
| 18. Accounts & Offline-Safe Identity | v2.0 | 7/7 | Complete   | 2026-07-22 |
| 19. Shared Dex Progress | v2.0 | 4/4 | Complete    | 2026-07-24 |
| 20. Presence & Interactions | v2.0 | 0/5 | Not started | - |

---
*Roadmap created: 2026-07-08*
*v1.0 MVP milestone archived: 2026-07-17 (7 phases, 46 plans, all shipped)*
*v1.1 Polish & Pre-Show Hardening milestone archived: 2026-07-19 (Phases 8–10, 12 plans, 9 requirements, all shipped)*
*v1.2 Pre-Show Hardening milestone archived: 2026-07-22 (Phases 11–16, 28 plans, 22 requirements — 13 bug fixes across Phases 11–13, Gizz Bingo across Phases 14–16)*
*v2.0 Multi-User Foundation roadmap added: 2026-07-22 (Phases 17–20, 27 requirements — SETUP×4 / AUTH×8 / PROG×8 / PRES×7 — 100% coverage; continue-numbering from Phase 16)*
