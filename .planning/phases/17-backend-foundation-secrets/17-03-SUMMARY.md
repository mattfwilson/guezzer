---
phase: 17-backend-foundation-secrets
plan: 03
subsystem: infra
tags: [supabase, migration, rls, realtime, gotrue, seed, node-native-ts]

# Dependency graph
requires:
  - phase: 17-01
    provides: "supabase/ CLI scaffold (config.toml) + root scripts db:push / seed:accounts"
provides:
  - "supabase/migrations/20260722160617_progress_foundation.sql — public.progress table + read-all/write-own RLS + supabase_realtime publication"
  - "supabase/seed/seed-users.ts — dependency-free idempotent GoTrue admin seed (POST /auth/v1/admin/users)"
  - "supabase/seed/roster.ts — committed non-secret roster (RosterEntry: slug + display_name)"
affects: [17-04 provisioning/db-push/seed-run, 18 auth, 19 shared-progress, 20 presence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One committed one-shot DDL migration carries table + RLS + realtime publication (no if-not-exists/drop guards — tracked migration runs once)"
    - "D-08 roster/secret split: committed roster carries slug + display_name only; emails/passwords read from process.env keyed by uppercased slug"
    - "Node-native-TS ops script idiom (erasable syntax, isMain guard, top-level try/catch → process.exit(1)) reused from packages/app/scripts/fetch-covers.ts"

key-files:
  created:
    - supabase/migrations/20260722160617_progress_foundation.sql
    - supabase/seed/seed-users.ts
    - supabase/seed/roster.ts
  modified:
    - .planning/phases/17-backend-foundation-secrets/17-03-PLAN.md

key-decisions:
  - "CLI-chosen migration timestamp (20260722160617) differs from the frontmatter placeholder; synced files_modified to the real name per plan instruction"
  - "summary jsonb kept as a single first-class column so Phase 19 shapes the Option-B payload with zero later migration; identity columns (display_name/updated_at) stay separate so PROG-02's identity-only upsert never resets summary"
  - "Idempotency via the reference dual-check (HTTP 422 OR /registered|already|exists/i body) — defensive across GoTrue versions"

requirements-completed: [SETUP-01, SETUP-02]

# Metrics
duration: ~15min
completed: 2026-07-22
---

# Phase 17 Plan 03: Durable-Progress Schema & Account-Seed Authoring Summary

**Authored the version-controlled source of truth for the multi-user backend: a one-shot `public.progress` migration (user-keyed table + read-all/write-own RLS + the required `supabase_realtime` publication line) and a dependency-free, idempotent Node-native-TS GoTrue admin seed with a committed non-secret roster — pure authoring, no live project touched (that is 17-04).**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-22
- **Tasks:** 2 (both auto)
- **Files:** 3 created, 1 modified

## Accomplishments

- **SETUP-01 migration** — `npx supabase migration new progress_foundation` generated `supabase/migrations/20260722160617_progress_foundation.sql`, filled with plain one-shot DDL adapted from the VALIDATED spike schema:
  - `public.progress` with the four D-01 columns: `user_id uuid primary key references auth.users(id) on delete cascade`, `display_name text not null`, `updated_at timestamptz not null default now()`, `summary jsonb` (the single Option-B payload column).
  - RLS enabled with exactly the three D-02 policies: `select` read-all to `authenticated` `using (true)` (NO `anon`); `insert` write-own `with check (auth.uid() = user_id)`; `update` write-own `using (...) with check (...)`.
  - The REQUIRED D-03 line `alter publication supabase_realtime add table public.progress` (without it `postgres_changes` silently never fires).
- **SETUP-02 seed + roster:**
  - `supabase/seed/roster.ts` exports `interface RosterEntry { slug; display_name }` and `const roster` seeded with the owner (`matt` / "Matt") plus two placeholders (`placeholder1`/`placeholder2`) to prove idempotency (D-07) — no email/password (D-08).
  - `supabase/seed/seed-users.ts` is dependency-free Node-native TS (erasable syntax, global `fetch`, `isMain` guard, top-level try/catch → `process.exit(1)`): reads `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` and per-slug `SEED_EMAIL_*`/`SEED_PASSWORD_*` from `process.env` only; POSTs `{ email, password, email_confirm: true, user_metadata: { display_name } }` to `/auth/v1/admin/users` with the `apikey` + `Authorization: Bearer` service_role headers; classifies HTTP 422 OR a `/registered|already|exists/i` body as skip-not-error (D-06 dual-check); tallies and prints `Done (N new)`.
- **Static proof:** grep-verified all acceptance criteria, `node --check` parses clean under type-stripping, and a safe no-env smoke run exercised the runtime path (imports the roster, hits the missing-env guard, exits 1 — zero network calls).

## Task Commits

1. **Task 1: progress-foundation migration (SETUP-01 / D-01/D-02/D-03/D-04)** — `71036ec` (feat)
2. **Task 2: idempotent GoTrue seed + committed roster (SETUP-02 / D-06/D-07/D-08)** — `1e26475` (feat)

_Plan metadata commit (this SUMMARY) follows._

## Files Created/Modified

- `supabase/migrations/20260722160617_progress_foundation.sql` (created) — `public.progress` table + three RLS policies + the `supabase_realtime` publication line.
- `supabase/seed/seed-users.ts` (created) — dependency-free idempotent GoTrue admin seed.
- `supabase/seed/roster.ts` (created) — `RosterEntry` interface + committed non-secret `roster` array.
- `.planning/phases/17-backend-foundation-secrets/17-03-PLAN.md` (modified) — synced `files_modified` to the CLI-chosen migration timestamp.

## Decisions Made

- **Migration timestamp synced:** the CLI chose `20260722160617` (not the frontmatter placeholder `20260722120000`); the plan's `files_modified` was updated to the real filename per the plan's own instruction.
- **`summary jsonb` as one first-class column** (not modeled as PROG-01 sub-columns this phase) so Phase 19 shapes the payload with zero later migration; identity columns stay separate so an identity-only upsert never clobbers `summary`.
- **Client-set `updated_at`, no trigger** (D-04 discretion) — keeps the migration a single reviewable DDL block.

## Deviations from Plan

None affecting scope. Two in-file wording adjustments were required so the plan's own `! grep` acceptance checks pass (the same substring gotcha 17-01 documented): the seed's doc comments were reworded to avoid the literal substrings `import.meta.env` and `enum`/`namespace`. The code references only `process.env`, uses erasable syntax only, and behavior is unchanged — this is a comment-wording choice within the planned file, not a scope deviation.

## Issues Encountered

None. No package installs (the seed is dependency-free — T-17-SC "accept"). The migration was authored only; `supabase link` / `db push` and the live twice-run idempotency proof are 17-04.

## Threat Surface

No new surface beyond the plan's `<threat_model>`. T-17-06 (RLS write-own + no-anon), T-17-07 (service_role/passwords via `process.env` only, roster carries no secrets), and T-17-08 (realtime read-all to `authenticated`, `anon` not granted) are all realized as authored source; their runtime verification (cross-user write attempt, twice-run) is 17-04.

## User Setup Required

None in this plan. Populating `.env` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and per-slug `SEED_EMAIL_*`/`SEED_PASSWORD_*`, then applying the migration and running the seed against the live project, is 17-04 scope.

## Next Phase Readiness

- 17-04 can `supabase db push --linked` the committed migration and run `npm run seed:accounts` (`node --env-file=.env supabase/seed/seed-users.ts`) twice to prove live idempotency.
- Phases 18–20 can rely on `public.progress` existing with read-all/write-own RLS and being on the realtime publication.

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260722160617_progress_foundation.sql`
- FOUND: `supabase/seed/seed-users.ts`
- FOUND: `supabase/seed/roster.ts`
- FOUND: `.planning/phases/17-backend-foundation-secrets/17-03-SUMMARY.md`
- FOUND commit: `71036ec` (Task 1)
- FOUND commit: `1e26475` (Task 2)
