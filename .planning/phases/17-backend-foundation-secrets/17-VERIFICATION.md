---
phase: 17-backend-foundation-secrets
verified: 2026-07-22T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 17: Backend Foundation & Secrets Verification Report

**Phase Goal:** Stand up the multi-user Supabase backend foundation — an app-layer Supabase client module (the single createClient site), a core-purity guard test, the durable progress-table migration (table + read-all/write-own RLS + supabase_realtime publication), and an idempotent GoTrue account-seed script + roster — with all real secrets kept out of git. Prove it against the live hosted project.
**Verified:** 2026-07-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Seed script mints accounts (`email_confirm:true`, distinct passwords, `user_metadata.display_name`); re-run skips already-registered (idempotent); no in-app sign-up (SETUP-02) | ✓ VERIFIED | `supabase/seed/seed-users.ts` POSTs `/auth/v1/admin/users` with `email_confirm:true` + `user_metadata.display_name`; dual-check (status 422 OR `/registered\|already\|exists/i`) treats existing as skip; `node --check` parses clean; no in-app signup path exists. Live: 17-04-SUMMARY records `Done (0 new)` on two consecutive runs, owner account confirmed with `display_name` "Matt". |
| 2 | `public.progress` (keyed by `user_id`) enforces read-all/write-own RLS + is on `supabase_realtime` publication (SETUP-01) | ✓ VERIFIED | `supabase/migrations/20260722160617_progress_foundation.sql`: table keyed `user_id uuid primary key references auth.users(id)`, RLS enabled, 3 policies (read-all→authenticated `using(true)`, insert/update write-own `with check (auth.uid()=user_id)`), NO anon, plus `alter publication supabase_realtime add table public.progress`. Live: 17-04-SUMMARY Management-API introspection confirms columns `[user_id, display_name, updated_at, summary]`, RLS enabled, 3 policies, publication membership, and cross-user write rejected ("new row violates row-level security policy"). |
| 3 | No secret committed; `service_role` + passwords env-only (never `VITE_`); anon key + URL may ship (SETUP-03) | ✓ VERIFIED | `.gitignore` ends `.env` / `.env.*` / `!.env.example` (negation last). `git check-ignore .env packages/app/.env.local` returns both (exit 0); `git ls-files` shows no `.env`/`.env.local` tracked (only `.env.example`). `.env.example` valueless; no `VITE_`-prefixed name contains service/password/secret; service_role read from `process.env` only in seed. |
| 4 | `packages/core` imports zero Supabase code — boundary check confirms purity (SETUP-04) | ✓ VERIFIED | `packages/app/src/db/supabase.ts` is the single `createClient` site (reads only `import.meta.env.VITE_SUPABASE_URL`/`_ANON_KEY`). `packages/core/test/purity.test.ts` passes (2/2); negative control (injected `@supabase` import into core/src) makes it FAIL as designed. `packages/core/package.json` deps = `{fuse.js, zod}` only, no `@supabase/*`. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/db/supabase.ts` | Single `createClient` site, VITE_ vars only | ✓ VERIFIED | 23 lines; imports `createClient`, exports `supabase` singleton from `import.meta.env.VITE_SUPABASE_URL`/`_ANON_KEY`; no `process.env`; app `tsc --noEmit` exits 0 |
| `packages/app/package.json` | `@supabase/supabase-js@2.110.8` | ✓ VERIFIED | Pinned exact `"2.110.8"` in dependencies |
| `package.json` (root) | `supabase` devDep + `db:push`/`seed:accounts` scripts | ✓ VERIFIED | `"supabase": "2.109.1"` devDep; both scripts present |
| `supabase/config.toml` | CLI scaffold from `supabase init` | ✓ VERIFIED | Present |
| `.gitignore` | `.env`/`.env.*`/`!.env.example` (negation last) | ✓ VERIFIED | Lines 5-7, negation last |
| `.env.example` | Valueless template, VITE_ vs non-VITE separated | ✓ VERIFIED | All values empty; both VITE_ pair + ops secrets + SEED_* pairs; no VITE_ name carries a secret |
| `packages/core/test/purity.test.ts` | Static-scan purity guard | ✓ VERIFIED | 96 lines; scans core/src for `@supabase`/`createClient`/DOM globals; encodes fetch + bare-window exceptions; asserts no `@supabase/*` core dep; passes + fails-on-injection |
| `supabase/migrations/*_progress_foundation.sql` | Table + RLS + realtime pub | ✓ VERIFIED | Full DDL as specified (see truth #2). Filename timestamp `20260722160617` matches 17-03 `files_modified` (CLI-chosen, per plan note) |
| `supabase/seed/seed-users.ts` | Idempotent GoTrue admin seed | ✓ VERIFIED | Dependency-free, erasable syntax, `process.env`-only secrets, 422 dual-check |
| `supabase/seed/roster.ts` | Non-secret roster (slug + display_name) | ✓ VERIFIED | `RosterEntry` interface + `roster` array (matt + 2 placeholders); no email/password |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `supabase.ts` | `import.meta.env.VITE_SUPABASE_*` | createClient args | ✓ WIRED | Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` passed to `createClient` |
| `purity.test.ts` | `packages/core/src/**/*.ts` | fs read + regex scan | ✓ WIRED | Recursive `collectTsFiles` walk; asserts `files.length > 0`; negative control confirms detection |
| `seed-users.ts` | `process.env[SEED_(EMAIL\|PASSWORD)_<SLUG>]` + service_role | env indexed by roster slug | ✓ WIRED | `process.env[\`SEED_EMAIL_${slug}\`]` / `_PASSWORD_`; service_role from `process.env` |
| `db push --linked` | `public.progress` on `supabase_realtime` | applied migration | ✓ WIRED | 17-04-SUMMARY: migration applied (`migration list` local==remote), `pg_publication_tables` membership confirmed live |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Core purity guard passes | `npx vitest run packages/core/test/purity.test.ts` | 2 passed | ✓ PASS |
| Guard catches Supabase import | inject `@supabase` import into core/src, rerun | test FAILS as designed, reverted | ✓ PASS |
| Seed parses under type-stripping | `node --check supabase/seed/seed-users.ts` | PARSE OK | ✓ PASS |
| App typechecks with client module | `npx tsc --noEmit` (packages/app) | exit 0 | ✓ PASS |
| `.env` cannot be committed | `git check-ignore .env packages/app/.env.local` | both returned, exit 0 | ✓ PASS |
| No env secret tracked | `git ls-files \| grep .env` | only `.env.example` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SETUP-01 | 17-03, 17-04 | Provisioned durable-progress schema (table + read-all/write-own RLS + realtime pub) | ✓ SATISFIED | Migration source + live introspection (truth #2) |
| SETUP-02 | 17-03, 17-04 | Idempotent GoTrue account-seed; re-run skips; no in-app signup | ✓ SATISFIED | Seed source + live twice-run `Done (0 new)` (truth #1) |
| SETUP-03 | 17-02, 17-04 | Secrets discipline — service_role/passwords env-only, anon+URL may ship | ✓ SATISFIED | .gitignore + .env.example + git check-ignore (truth #3) |
| SETUP-04 | 17-01, 17-02 | Supabase client isolated in app layer; core imports zero Supabase | ✓ SATISFIED | Single client module + passing purity guard (truth #4) |

All four phase requirement IDs (SETUP-01..04) are declared across plans and satisfied. No orphaned requirements: REQUIREMENTS.md maps exactly SETUP-01..04 to Phase 17, all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `supabase/seed/roster.ts` | 20-21 | "Placeholder One/Two" roster entries | ℹ️ Info | Intentional per D-07 — placeholder slots prove seed idempotency; not stubs |
| `test/map/group-crypto.test.ts` | 46 | 1 failing test in full suite | ℹ️ Info | Pre-existing FLAKY probabilistic assertion (base64 ciphertext randomly contained substring "Max"); passes on rerun (5/5). Last modified commit 38c9054 (GizzMap core, pre-Phase-17). NOT a Phase 17 regression — Phase 17 touched no crypto code. |

No debt markers (TODO/FIXME/XXX/TBD/HACK) found in any Phase 17-modified source file.

### Human Verification Required

None. The live-only aspects (migration applied, RLS enforced, realtime publication membership, seed idempotency) were verified inline by the orchestrator against the live hosted project (ref `yunfqfldgbgjdqzywbdy`, us-east-1) via Management-API introspection and recorded as authoritative evidence in 17-04-SUMMARY.md. Source artifacts were verified directly against the codebase.

### Gaps Summary

No gaps. All four ROADMAP success criteria (SETUP-01..04) are satisfied. Source artifacts — the single app-layer client module, the core-purity guard (passing and proven to catch injected Supabase imports), the progress-foundation migration (table + read-all/write-own RLS + supabase_realtime publication, no anon), the idempotent GoTrue seed + non-secret roster, and the secrets-hygiene guardrails (.gitignore + valueless .env.example) — all verified in the codebase. Real secrets (`.env`, `packages/app/.env.local`) are correctly gitignored and absent from git (a PASS for SETUP-03). Live runtime facts are corroborated by 17-04-SUMMARY's Management-API records, treated as authoritative per phase context.

The single full-suite failure is an unrelated pre-existing flaky crypto test, not a Phase 17 regression.

---

_Verified: 2026-07-22_
_Verifier: Claude (gsd-verifier)_
