# Phase 17: Backend Foundation & Secrets - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the hosted **Supabase backend foundation** that every later v2.0 phase keys off, and prove its secret-hygiene gate holds:

- A hosted Supabase project exists (manually created), CLI-linked.
- A durable, RLS-enforced `public.progress` table exists and is on the `supabase_realtime` publication.
- An **idempotent** account-seed script mints friend accounts via the GoTrue admin API.
- Secrets discipline holds: `service_role` + passwords are env-only and never committed; the `.gitignore` gap is closed.
- `packages/core` stays pure by construction — a boundary check proves it imports zero Supabase code.

**In scope:** SETUP-01 (schema + RLS + realtime publication), SETUP-02 (idempotent seed script + mechanism), SETUP-03 (secrets discipline + `.gitignore` fix + env convention), SETUP-04 (core-purity boundary check), and adding the `@supabase/supabase-js` client dependency to the app layer.

**Explicitly NOT in this phase:** no client login/auth flow, no offline session boot, no Dexie namespacing (Phase 18); no progress upsert/sync, friends screen, or `deriveSharedProgress` (Phase 19); no presence/waves Realtime channel (Phase 20). This phase builds the foundation, not the features that consume it.

</domain>

<decisions>
## Implementation Decisions

### Progress schema (SETUP-01)
- **D-01:** `public.progress` columns = `user_id uuid primary key references auth.users(id) on delete cascade`, `display_name text not null`, `updated_at timestamptz not null default now()`, and `summary jsonb` — the single `jsonb` column holds the **whole Option-B derived payload** (completion %, `show_count`, rarest `{songId,tier}`, per-tier counts, `perAlbum`, `caughtSongIds int[]`, etc.). Phase 19's `deriveSharedProgress` shapes the payload with **zero later migration**. Identity columns stay first-class so the "touch identity only" upsert (PROG-02) never resets the summary.
- **D-02:** Read-all / write-own RLS — `SELECT` granted to `authenticated` **only** (`using (true)`); `INSERT`/`UPDATE` gated to `auth.uid() = user_id` (both `using` and `with check` on update). No `anon` read.
- **D-03:** `alter publication supabase_realtime add table public.progress` is included in the migration — REQUIRED or `postgres_changes` silently never fires (blueprint gotcha).

### Schema deployment (SETUP-01)
- **D-04:** Schema ships as a committed `supabase/migrations/*.sql` file, applied with `supabase db push` against the CLI-linked remote project. Version-controlled, reviewable, re-runnable. (This also trips plan-phase's schema-push gate so verification stays honest.)
- **D-05:** The Supabase project is **created manually** in the dashboard (free tier, region nearest the friend group) — project creation is not meaningfully scriptable without the management API + a PAT, and it's a one-time action. Phase 17 **documents** the provisioning steps, captures `URL` / `anon` / `service_role` into env, and runs `supabase link` to connect the CLI.

### Account seeding (SETUP-02)
- **D-06:** Seed script = **Node-native TypeScript** (`.ts` run directly on Node ≥ 24.12 type-stripping, erasable syntax, dependency-free global `fetch` → GoTrue admin API `POST /auth/v1/admin/users`). Sets `email_confirm:true`, distinct per-person passwords, `user_metadata.display_name`. **Idempotent**: a 422 / "already registered" response for an existing account is treated as skip, not error. Matches the project's Node-native-TS convention (CLAUDE.md); no `supabase-js`, no `tsx`, no build step.
- **D-07:** Build and **prove the mechanism now** with the owner's real account + a couple of placeholders. The real friend roster is filled in right before minting/handing out credentials — collecting all ~5 friends' details is not a gate for this foundation phase.
- **D-08:** Roster source = a **committed roster file** listing `display_name` + a stable slug per friend (non-secret, reviewable). The seed script reads each account's **email and password from env keyed by that slug** — no email or password ever lands in git.

### Secrets & env (SETUP-03)
- **D-09:** Client `anon` key + project URL live in **`VITE_` env vars** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), read in the app-layer client module. Both are public-by-design; inlining them into the bundle at build is fine.
- **D-10:** `service_role` key and **all account passwords are env-only, NEVER `VITE_`-prefixed**, never committed. The `VITE_` prefix boundary is the mechanical line between "ships in the bundle" and "server/ops secret."
- **D-11:** Commit a valueless **`.env.example`** documenting every required var name (the `VITE_*` pair, `SUPABASE_SERVICE_ROLE_KEY`, per-account password/email vars). Real values go in a gitignored `.env` / `.env.local`. **Add `.env*` (except `.env.example`) to `.gitignore`** — today `.gitignore` ignores no `.env` files at all, a real gap this phase must close.

### Core purity (SETUP-04)
- **D-12:** The boundary check is an **automated Vitest test in `packages/core`** that scans core source for any `@supabase` / `supabase-js` / `createClient` import (and DOM/network globals) and fails on a hit. Runs in the existing suite/CI so a future regression is caught automatically — not a run-when-you-remember script.

### Repo layout & client dependency
- **D-13:** All backend artifacts live under a **root `supabase/` directory** (`supabase/migrations/*.sql` + `supabase/seed/seed-users.ts`), driven by root npm scripts (e.g. `db:push`, `seed:accounts`). Matches the Supabase CLI's expected layout and keeps ops out of the app bundle.
- **D-14:** Add **`@supabase/supabase-js` (v2.91+)** to `packages/app` only. The client sits behind a thin app-layer module and is never imported from `packages/core` (enforced by D-12).

### Claude's Discretion
- Exact migration filename/timestamp and npm script names.
- `updated_at` maintenance (client-set on write vs. a DB trigger) — default to client-set unless a trigger is trivially cleaner.
- Placeholder account count / example emails used to prove idempotency.
- The intermediate shape of the `summary` jsonb for any placeholder write this phase — Phase 19 owns the final payload shape.
- Supabase CLI version handling and any local dev-vs-prod project distinction (single shared project is the assumption for ~5 users).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spike blueprint (primary — validated across two remote devices)
- `.claude/skills/spike-findings-guezzer/SKILL.md` — blueprint index + non-negotiable requirements.
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — the full how-to: client setup, seed pattern, schema.sql, RLS policies, the realtime-publication gotcha, and the "what to avoid" list. **The load-bearing reference for this phase.**
- `.claude/skills/spike-findings-guezzer/sources/002-supabase-multiuser/seed/schema.sql` — reference schema + RLS + publication SQL to adapt into the migration.
- `.claude/skills/spike-findings-guezzer/sources/002-supabase-multiuser/seed/seed-users.mjs` — reference (dependency-free) seed script to port to Node-native TS.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — SETUP-01…04 (this phase); **PROG-01** defines the exact Option-B payload the `summary` jsonb (D-01) will eventually carry; Out-of-Scope table (no self-signup, no magic-link, no password-reset UI).
- `.planning/ROADMAP.md` §"Phase 17" — goal + the 4 success criteria this phase is verified against.

### Project constraints
- `CLAUDE.md` — Node ≥ 24.12 native-TS execution (erasable syntax, no `enum`/`namespace`); strict core purity (`packages/core` = zero DOM/browser/network deps); single-config-file convention. **Note:** the "no backend / no accounts" hard constraints are deliberately revised by v2.0 (see PROJECT.md Key Decisions) — do not treat them as blockers.
- `.planning/PROJECT.md` — v2.0 backend decision (Option A): Supabase is THE multi-user foundation; GizzMap relay kept as-is, out of this milestone's scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/app/scripts/fetch-covers.ts` — an existing Node-run script in the app package; precedent for the Node-native-TS script style the seed script (D-06) follows.
- `packages/app/src/config.ts` — the project's single-config-file convention; any client-side Supabase config constants that aren't secrets follow this pattern.
- `packages/relay` — an existing remote-endpoint + secret-handling precedent (GizzMap Cloudflare Worker, `wrangler.toml`). Kept **as-is**; NOT modified this phase (out of milestone scope per PROJECT.md).

### Established Patterns
- `packages/core` and `packages/app` are separate workspace packages (`@guezzer/core`, `@guezzer/app`). Core purity is **structural today** — core has no Supabase dependency and app depends on core, never the reverse. D-12's test hardens this against regression.
- Existing `.gitignore` ignores only `node_modules/`, `dist/`, `.claude/`, `*.tsbuildinfo` — **no `.env` handling yet** (the gap D-11 closes).
- `packages/app` currently has no `@supabase/*` dependency — D-14 adds it.

### Integration Points
- New thin **app-layer Supabase client module** (e.g. `packages/app/src/…/supabase.ts`) — the only place `createClient` is called; imported by nothing in `packages/core`.
- New root **`supabase/`** directory for migrations + seed (D-13), with root-level npm scripts.
- Downstream: Phase 18 auth consumes this client; Phase 19 writes the `summary` payload to `public.progress`; Phase 20 opens a Realtime channel. None of those surfaces exist yet.

</code_context>

<specifics>
## Specific Ideas

- The `summary jsonb` (D-01) is explicitly a decoupling choice: it lets Phase 19 evolve the Option-B payload shape without a DDL migration, while identity columns (`display_name`) remain queryable and independently upsertable so presence-style identity writes never clobber counts (satisfies the PROG-02 "touch identity only" rule ahead of time).
- The `VITE_`-prefix rule (D-09/D-10) is the phase's single mechanical secret boundary — the boundary check and code review should key off it: anything sensitive must NOT carry `VITE_`.
- Idempotency (D-06) is the seed script's headline property — re-running must be a safe no-op for existing accounts, verified by running it twice.

</specifics>

<deferred>
## Deferred Ideas

- **Auth flow, offline session boot, `display_name` chrome chip, Dexie per-user namespacing** → Phase 18 (AUTH-01…08).
- **`deriveSharedProgress`, progress upsert/sync, friends screen, live `postgres_changes` refresh, head-to-head compare** → Phase 19 (PROG-01…08).
- **Presence dots, waves, reactions, coarse activity status on a Realtime channel** → Phase 20 (PRES-01…07).
- **GizzMap ↔ account convergence (MAP-F1 derive map secret from session; MAP-F2 full relay port)** → deferred backlog; explicitly out of v2.0.
- **Full real-time shared setlist co-tracking (SOCL-V2-01)** → out of scope, later milestone.

### Reviewed Todos (not folded)
- 15 pending todos surfaced by `todo.match-phase` — all matched only on the generic `packages/app` / `packages/core` keyword and are UI-polish or future-feature ideas from other milestones (bottom-sheet animation, directional-flow particles, date-format, badge system, Couch Mode, Guezz League, Gizzle, Residency Mode, etc.). **None touch the backend/secrets domain; none folded.**

</deferred>

---

*Phase: 17-backend-foundation-secrets*
*Context gathered: 2026-07-22*
