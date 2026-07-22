---
phase: 17-backend-foundation-secrets
fixed_at: 2026-07-22T00:00:00Z
review_path: .planning/phases/17-backend-foundation-secrets/17-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-07-22
**Source review:** .planning/phases/17-backend-foundation-secrets/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Warnings; Info findings IN-01/IN-02 excluded by `critical_warning` scope)
- Fixed: 4
- Skipped: 0

**Verification (run in isolated worktree, fresh `npm install`):**
- App typecheck `tsc --noEmit -p packages/app/tsconfig.json`: PASS (exit 0)
- Full test suite `npm test` (vitest): PASS — 102 files, 784 tests passed, including the
  core-purity guard `packages/core/test/purity.test.ts`
- Seed script parse under Node 24.15 native type-stripping: PASS (`PARSE_OK`)

## Fixed Issues

### WR-01 / WR-02: Seed idempotency check too broad (all-422 + loose `exists` regex)

**Files modified:** `supabase/seed/seed-users.ts`
**Commit:** 1776943
**Applied fix:** Both warnings share one root fix, applied together. Replaced the
`res.status === 422 || /registered|already|exists/i.test(...)` dual-check with a
narrow `isDuplicate` test that matches only GoTrue's specific duplicate-email
signal: an `email_exists`/`user_already_exists` error code (also tolerating an
`error_code` key) or an anchored "already (been) registered" message. A bare HTTP
422 (e.g. `weak_password`) and the standalone `exists` substring (which also
appears in unrelated "... does not exist" errors) now fall through to the
`result.failed` branch and print the full body, so genuine creation failures are
no longer silently reported as `exists (unchanged)`. Genuinely-already-registered
accounts still count as skips, preserving idempotency (re-run reports `Done (0 new)`).
The stale header comment describing the old "dual check" was updated to match.

### WR-03: `progress.updated_at` has no auto-update trigger — goes stale on UPDATE

**Files modified:** `supabase/migrations/20260722180000_progress_updated_at_trigger.sql` (new)
**Commit:** 139bce5
**Applied fix:** Per the live-backend guardrail, the already-applied foundation
migration (`20260722160617_progress_foundation.sql`) was NOT edited in place —
that would create file-vs-remote drift and the trigger would never reach the DB.
Instead added a NEW, later-timestamped additive migration that creates a
re-runnable `public.set_updated_at()` function (`create or replace function`) and a
`BEFORE UPDATE` trigger (`drop trigger if exists ...` then `create trigger`) on
`public.progress`. `supabase db push` was intentionally NOT run — the owner must
apply it (needs live secrets).

**Human action required:** owner runs `supabase db push` to apply the trigger to
the hosted project. The DDL could not be executed/verified against the live
database from tooling, so confirm the trigger fires (an UPDATE bumps `updated_at`)
after applying.

### WR-04: Client passes possibly-undefined env vars to `createClient` with no validation

**Files modified:** `packages/app/src/db/supabase.ts`
**Commit:** 9b35d2f
**Applied fix:** Added a fail-fast guard that reads `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` into locals and throws an explicit, actionable error
("Copy .env.example to packages/app/.env.local ...") when either is missing/empty,
instead of `createClient` throwing an opaque `supabaseUrl is required` at import
time. The guard also narrows `string | undefined` to `string` before the single
`createClient` call. Still the only `createClient` site, reads only
`import.meta.env.VITE_*` (no `process.env`, no non-VITE var) — the 17-02
core-purity test and app typecheck both still pass.

## Skipped Issues

None — all in-scope findings were fixed.

Note: IN-01 (`.env.example` missing placeholder2 seed keys) and IN-02 (seed loop
aborts on first network error) are Info-severity and out of scope for the
`critical_warning` fix pass; they were not attempted.

---

_Fixed: 2026-07-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
