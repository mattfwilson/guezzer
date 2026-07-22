---
phase: 17-backend-foundation-secrets
plan: 04
subsystem: infra
tags: [supabase, provisioning, db-push, rls, realtime, gotrue, seed, secrets, live-verification]

# Dependency graph
requires:
  - phase: 17-01
    provides: "supabase/ CLI scaffold + db:push / seed:accounts scripts + app-layer client"
  - phase: 17-02
    provides: ".gitignore .env coverage + valueless .env.example (secrets can be written safely)"
  - phase: 17-03
    provides: "progress_foundation migration + idempotent GoTrue seed + roster"
provides:
  - "Live hosted project (ref yunfqfldgbgjdqzywbdy, us-east-1) with the progress_foundation migration applied"
  - "public.progress live: summary-jsonb schema + read-all/write-own RLS (cross-user write empirically rejected) + on supabase_realtime"
  - "Seeded owner account (matt) proven; seed re-run idempotent (Done (0 new))"
  - "Populated gitignored .env + packages/app/.env.local (never committed)"
affects: [18 auth, 19 shared-progress, 20 presence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Linked-remote db push needs no Docker (the Docker warning about the local migrations-catalog cache is non-fatal; the remote apply succeeds)"
    - "Live schema/RLS/publication verification via the Supabase Management API query endpoint (POST /v1/projects/{ref}/database/query, PAT-authed) — no psql/Docker required on Windows"
    - "RLS write-own proven by executing an insert under role=authenticated with a mismatched request.jwt.claims sub → 'new row violates row-level security policy'"

key-files:
  created:
    - .env
    - packages/app/.env.local
  modified: []

key-decisions:
  - "Project was the REUSED validated-spike project: public.progress pre-existed with the OLD spike schema (songs_caught column, 2 test rows). Owner chose CLEAN RESET — dropped the stale table so the 17-03 migration created the correct summary-jsonb schema for real and recorded itself (truthful migration history). The 2 spike rows were discarded (auth accounts untouched)."
  - "matt@fov.gizz already existed from the spike, so the idempotent seed left it unchanged (password was the spike's, not the .env value). Owner chose to reset matt's password to SEED_PASSWORD_MATT via the GoTrue admin API (id preserved) so login works with the documented credential."
  - "Placeholder roster slots left blank → gracefully skipped; idempotency still proven with the single owner account (0 new on both runs, no error)."

requirements-completed: [SETUP-01, SETUP-02, SETUP-03]

# Metrics
duration: ~40min (incl. human provisioning gate + spike-schema reconciliation)
completed: 2026-07-22
---

# Phase 17 Plan 04: Provision, Apply, Seed — Live Backend Foundation Summary

**Turned the authored source (17-03) into live, verified backend state: provisioned/linked the hosted Supabase project, cleanly reconciled a stale spike schema, applied the progress_foundation migration for real, and empirically verified all four phase success criteria against the running project — with every real secret kept in gitignored `.env` files.**

## Performance

- **Duration:** ~40 min (dominated by the manual dashboard provisioning gate + reused-spike-project reconciliation)
- **Completed:** 2026-07-22
- **Tasks:** 3 (Task 1 human-action gate + Tasks 2/3 auto)
- **Project:** `mattfwilson's Project` — ref `yunfqfldgbgjdqzywbdy`, region `us-east-1`, status `ACTIVE_HEALTHY`

## Accomplishments

- **Task 1 — [HUMAN GATE D-05] provision + link.** Owner created the hosted free-tier project, captured URL/anon/service_role/DB-password/PAT/project-ref into gitignored `.env` + `packages/app/.env.local` (validated: anon key decodes to role `anon`, service_role to `service_role`, both matching the project ref; the initially-wrong `sb_publishable_…` access token was corrected to a `sbp_…` PAT), and ran `npx supabase link` successfully (`supabase/.temp/linked-project.json` present, gitignored).
- **Task 2 — [BLOCKING] schema push (SETUP-01).** First push failed `42P07 relation "progress" already exists` — the project is the reused validated-spike project and carried the OLD spike schema (`songs_caught`, 2 rows). Per owner decision (clean reset), dropped `public.progress` and re-ran `npx supabase db push --linked`; the migration applied and recorded (`migration list` shows `local == remote`). Verified live via the Management API:
  - Columns now `user_id, display_name, updated_at, summary` (D-01 — `songs_caught` gone, `summary jsonb` present).
  - RLS enabled with the three D-02 policies (`read all progress`, `insert own progress`, `update own progress`).
  - `public.progress` is a member of the `supabase_realtime` publication (D-03).
  - **Cross-user write rejected**: an insert under `role=authenticated` with a mismatched JWT `sub` returned `new row violates row-level security policy` — write-own enforced live.
- **Task 3 — idempotent seed (SETUP-02).** Ran `node --env-file=.env supabase/seed/seed-users.ts` twice; both runs reported `matt@fov.gizz` as `exists (unchanged)`, placeholders skipped, `Done (0 new)` — idempotency proven (no errors, zero new accounts on the second pass). Owner account confirmed in `auth.users` (email confirmed, `display_name` = "Matt"); matt's password reset to the `.env` value via the admin API (id preserved) so it matches the documented credential.
- **SETUP-03 — secrets hygiene.** `git check-ignore .env packages/app/.env.local` returns both; `git status` shows no env files tracked/staged. No secret is committed; service_role/DB-password/PAT live only in the gitignored `.env`.

## Phase success criteria — all TRUE (verified live)

1. **Seed mints accounts; re-run idempotent** (SETUP-02) ✅ — `Done (0 new)` twice, no error; owner account present and confirmed.
2. **`public.progress` enforces read-all/write-own RLS and is on `supabase_realtime`** (SETUP-01) ✅ — schema/policies/publication introspected; cross-user write rejected.
3. **No secret committed; service_role + passwords env-only, never VITE_** (SETUP-03) ✅ — check-ignore + status confirmed; VITE_ carries only the public anon pair.
4. **`packages/core` imports zero Supabase code** (SETUP-04) ✅ — guarded by the 17-02 purity test (784-test suite green).

## Notes / deviations / follow-ups

- **Reused-spike-project reconciliation (deviation from a green-field assumption).** The plan assumed a fresh project; it was the spike project. Clean reset was applied to `public.progress` only. This is recorded for recoverability (ref/region above).
- **Pre-existing spike auth accounts remain** (out of this phase's scope): `gizz1–5@gizz.local` (test accounts) plus `max/tim/shawn/brian@fov.gizz` (friend accounts) exist beyond the current roster (matt + 2 blank placeholders). Consider pruning the `gizz*.local` test accounts and reconciling the friend roster during **Phase 18 (auth)**.
- **`SEED_EMAIL_MATT` uses the non-standard `.gizz` TLD** — accepted by GoTrue (the account exists and confirmed), so no action needed; noted in case a future validation tightens.
- Ran inline by the orchestrator (interactive live-provisioning plan), not via a worktree executor; STATE.md/ROADMAP.md updated centrally after this SUMMARY.
