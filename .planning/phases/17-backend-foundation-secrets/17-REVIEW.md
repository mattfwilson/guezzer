---
phase: 17-backend-foundation-secrets
reviewed: 2026-07-22T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - packages/app/src/db/supabase.ts
  - packages/core/test/purity.test.ts
  - supabase/migrations/20260722160617_progress_foundation.sql
  - supabase/seed/seed-users.ts
  - supabase/seed/roster.ts
  - package.json
  - packages/app/package.json
  - .env.example
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Supabase backend foundation: the app-layer client singleton, the
core-purity static-scan guard, the `progress` table migration (table + RLS +
realtime publication), the idempotent GoTrue account-seed script, its roster,
and the secret-handling env template plus package manifests.

**Secret handling is correct.** No secret is present in any committed file. The
client reads only the two public `VITE_`-prefixed vars; the service-role key and
per-person passwords are read exclusively from `process.env` in the seed script;
`.env.example` is a values-empty template. The core-purity guard correctly bans
`@supabase`/`createClient`/DOM globals under `packages/core/src` and additionally
asserts core has no `@supabase/*` dependency.

**RLS is fundamentally sound** — default-deny with authenticated-only read-all and
own-row-only write, no anon access. The concerns below are correctness and
robustness defects, not security holes:

- The seed's idempotency check is too broad on two independent axes (all-422 and a
  loose regex), which can silently mask genuinely-failed account creations.
- `progress.updated_at` has no auto-update trigger, so it goes stale on UPDATE.
- The client crashes opaquely at import time if env vars are missing.

No BLOCKER-severity defects found.

## Warnings

### WR-01: Seed treats ALL HTTP 422 as "already exists", masking real creation failures

**File:** `supabase/seed/seed-users.ts:77-83`
**Issue:** The dual idempotency check counts *any* `res.status === 422` as
"exists → skip". GoTrue's admin `POST /auth/v1/admin/users` returns 422 not only
for `email_exists` but also for validation failures such as `weak_password`
(password below the project minimum length). In that case no user is created, yet
the script prints `• exists   <email> (unchanged)` and exits 0. The operator
believes the friend has an account when they do not, and re-running never fixes it
because it keeps hitting the same 422. For a tool whose entire purpose is letting
<10 named friends sign in, a silently-uncreated account is a real operational
failure.
**Fix:** Narrow the "exists" branch to the actual duplicate signal instead of a
blanket status match:
```ts
const bodyText = JSON.stringify(body);
const isDuplicate =
  /"code"\s*:\s*"email_exists"/.test(bodyText) ||
  /already\s+(been\s+)?registered/i.test(bodyText);
if (res.ok) {
  result.created += 1;
  console.log(`✓ created  ${email}`);
} else if (isDuplicate) {
  result.skipped += 1;
  console.log(`• exists   ${email} (unchanged)`);
} else {
  result.failed += 1;
  console.error(`✗ FAILED   ${email} → ${res.status} ${bodyText}`);
}
```

### WR-02: Over-broad idempotency regex can match unrelated error bodies

**File:** `supabase/seed/seed-users.ts:79`
**Issue:** `/registered|already|exists/i.test(JSON.stringify(body))` matches the
bare substring `exists`, which also appears in unrelated failure messages such as
`relation "..." does not exist`, `bucket does not exist`, or `user does not exist`.
Any such genuine error is miscounted as a skip rather than a failure, so
`result.failed` stays 0 and the process exits 0 despite a real problem. This
compounds WR-01: the two loose checks are OR-ed, so either one alone can swallow a
failure.
**Fix:** Same fix as WR-01 — replace the loose alternation with an anchored match
on `email_exists` / "already registered", and drop the standalone `exists` token.

### WR-03: `progress.updated_at` has no auto-update trigger — goes stale on UPDATE

**File:** `supabase/migrations/20260722160617_progress_foundation.sql:14`
**Issue:** `updated_at timestamptz not null default now()` is set only at INSERT
time. There is no `BEFORE UPDATE` trigger (confirmed: no trigger/`moddatetime`
anywhere in `supabase/`), so every subsequent UPDATE leaves `updated_at` frozen at
the row's creation time unless the client explicitly writes it on every mutation.
A column named `updated_at` strongly implies auto-maintenance, and realtime
consumers in later phases (last-writer / "who updated most recently" ordering)
are the obvious use for it. Silently-stale timestamps are a correctness trap that
surfaces only downstream.
**Fix:** Add the standard moddatetime trigger in this foundation migration:
```sql
create extension if not exists moddatetime schema extensions;

create trigger progress_set_updated_at
  before update on public.progress
  for each row
  execute function extensions.moddatetime (updated_at);
```
(Or, if the intent is that the client always sets `updated_at` explicitly,
document that contract in the migration comment so Phase 19 cannot miss it.)

### WR-04: Client passes possibly-undefined env vars to `createClient` with no validation

**File:** `packages/app/src/db/supabase.ts:19-22`
**Issue:** `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are
`string | undefined`. If `.env.local` is missing or misnamed, `createClient`
throws `supabaseUrl is required` at *module import time*. Because this singleton is
imported by every downstream v2.0 phase (auth/progress/presence), a missing env
var crashes the entire app boot with an error that points at the library, not the
misconfiguration. On a build with strict TS this also risks a typecheck error
passing `string | undefined` where `string` is expected.
**Fix:** Validate and fail with an actionable message:
```ts
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to packages/app/.env.local and fill in the public Supabase values.",
  );
}
export const supabase = createClient(url, anonKey);
```

## Info

### IN-01: `.env.example` is missing the placeholder2 seed keys, defeating the idempotency proof

**File:** `.env.example:19-24`, `supabase/seed/roster.ts:18-22`
**Issue:** The roster ships three entries (`matt`, `placeholder1`, `placeholder2`),
and roster.ts explicitly states the placeholders "exist to prove the seed's
idempotency (D-07): running it twice must report them as exists → skip." But
`.env.example` only defines `SEED_EMAIL_MATT`/`SEED_PASSWORD_MATT` and the
`PLACEHOLDER1` pair — there is no `SEED_EMAIL_PLACEHOLDER2`/`SEED_PASSWORD_PLACEHOLDER2`.
An operator copying the template verbatim leaves placeholder2 with no env values,
so the script hits the `⚠ missing ...` branch and counts it as skipped-for-missing
rather than skipped-for-exists — silently undercutting the stated purpose of the
second placeholder.
**Fix:** Add both keys to `.env.example`:
```dotenv
SEED_EMAIL_PLACEHOLDER2=
SEED_PASSWORD_PLACEHOLDER2=
```

### IN-02: Seed loop aborts the whole run on the first network error

**File:** `supabase/seed/seed-users.ts:58-88`
**Issue:** The `await fetch(...)` has no per-iteration try/catch. A transient
network error on one person rejects the promise, unwinds out of the `for` loop to
the top-level catch (line 104), and abandons everyone later in the roster. The
operation is idempotent so a re-run recovers, but the run reports only the thrown
error's message and none of the per-person progress. For a 3–10 entry roster this
is minor.
**Fix:** Wrap the fetch/branch body in a `try/catch` that increments
`result.failed` and logs the person, so one flaky request doesn't abort the batch.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
