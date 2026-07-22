---
phase: 17-backend-foundation-secrets
plan: 02
subsystem: infra
tags: [secrets, gitignore, env, supabase, vitest, core-purity, static-scan]

# Dependency graph
requires: []
provides:
  - ".gitignore now ignores .env / .env.* (with !.env.example last) — real secrets can never be committed"
  - ".env.example — valueless template of every required var, VITE_ public vars separated from non-VITE ops secrets"
  - "packages/core/test/purity.test.ts — automated guard that fails if core ever imports Supabase or a browser DOM/transport global"
affects: [17-01, 17-03, 17-04, phase-18-auth, phase-19-progress, phase-20-presence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VITE_ prefix as the mechanical secret boundary (public bundle vars vs env-only ops secrets)"
    - "Dependency-free fs static-scan Vitest guard for core purity (recursive walk over src/**/*.ts)"

key-files:
  created:
    - ".env.example"
    - "packages/core/test/purity.test.ts"
  modified:
    - ".gitignore"

key-decisions:
  - "Used a deterministic recursive readdir walk (not fs.promises.glob) for the src scan — Windows-safe, no absolute-glob path quirks"
  - "Encoded two load-bearing exceptions explicitly: no fetch ban (4 Node CLIs use global fetch), no bare window. ban (predict.ts has a local `window` array var)"
  - "Added structural hardening: assert packages/core has zero @supabase/* dependency, catching a dep before an import even exists"

patterns-established:
  - "Secret boundary: VITE_-prefixed = ships in bundle (public); everything else = env-only ops secret, never committed (D-09/D-10)"
  - "Core-purity static scan: fs read + regex over src/**/*.ts, DOM/transport globals banned, fetch + local-window excepted (D-12)"

requirements-completed: [SETUP-03, SETUP-04]

# Metrics
duration: ~8min
completed: 2026-07-22
---

# Phase 17 Plan 02: Secrets Hygiene & Core-Purity Guardrails Summary

**Closed the .env-commit gap in .gitignore, committed a valueless .env.example behind the VITE_ boundary, and added a Vitest static-scan guard that fails if packages/core ever imports Supabase or a browser DOM/transport global — proven to catch an injected @supabase import without false-positiving existing core code.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-22
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `.gitignore` now ignores `.env` and `.env.*` with `!.env.example` last — `git check-ignore .env` exits 0, the committed template survives (SETUP-03 / D-11, closes threat T-17-03).
- `.env.example` documents every required var name, all values empty, grouped by the VITE_ boundary: two `VITE_*` public vars, five non-VITE ops secrets, and example per-slug `SEED_EMAIL_*` / `SEED_PASSWORD_*` pairs. No `VITE_`-prefixed name contains service/password/secret (SETUP-03 / D-09/D-10, closes T-17-04).
- `packages/core/test/purity.test.ts` scans `src/**/*.ts` and fails on `@supabase`/`supabase-js`/`createClient` + DOM/transport globals, plus a structural assert that core has no `@supabase/*` dependency (SETUP-04 / D-12, closes T-17-05). Proven to fail on an injected Supabase import, then reverted clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Close the .gitignore gap + commit the valueless .env.example** - `98074b7` (feat)
2. **Task 2: Core-purity static-scan test with fetch + bare-window exceptions** - `cff23fc` (test)

## Files Created/Modified
- `.gitignore` - Appended `.env`, `.env.*`, `!.env.example` (negation last so the template survives; no leading slash → covers nested `packages/app/.env.local`).
- `.env.example` - Valueless template of every var name, VITE_ public vars vs non-VITE ops secrets vs per-slug seed pairs.
- `packages/core/test/purity.test.ts` - Dependency-free node-env Vitest guard (recursive walk + regex scan + package.json dep assert) with a comment block citing D-12 and both exceptions.

## Decisions Made
- **Recursive readdir walk over `fs.promises.glob`:** the plan allowed either; chose the manual walk because it is deterministic and avoids Windows absolute-glob path quirks (drive letters/backslashes). The scan sorts files and asserts `files.length > 0` to guard a silent no-op pass.
- **Both exceptions encoded structurally, not just documented:** the FORBIDDEN array deliberately omits any `/\bfetch\b/` and any bare `/\bwindow\./` rule; a header comment explains why each would false-positive existing core code (four fetch-using Node CLIs; predict.ts's local `window` array variable).
- **Package.json dependency assert added** (optional hardening from RESEARCH Pattern 4) — catches a `@supabase/*` dep before any import exists.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Pre-scan of core src confirmed zero existing matches for the FORBIDDEN set before writing the test, so the guard was green on first run. Full suite (`npm test`) stayed green: 102 files / 784 tests passed. The `@guezzer/core` project did not red on `predict.ts` (bare-window exception) or the four `fetch`-using CLIs (fetch exception). The jsdom "Not implemented" console lines are pre-existing app-test warnings (canvas/navigation), not failures.

## User Setup Required
None - no external service configuration required by this plan. (The live Supabase project provisioning + secret capture is a separate human gate owned by 17-01/17-04, not this plan.)

## Next Phase Readiness
- Both phase guardrails are in place before real secrets are minted (17-04): the `.gitignore` gap is closed and the core-purity guard is active and proven.
- The `.env.example` documents the full var set the 17-01/17-04 runbook and seed script will populate.
- No blockers.

## Self-Check: PASSED

- FOUND: `.gitignore` (modified, `.env` ignored — `git check-ignore .env` exits 0)
- FOUND: `.env.example`
- FOUND: `packages/core/test/purity.test.ts`
- FOUND commit: `98074b7` (Task 1)
- FOUND commit: `cff23fc` (Task 2)

---
*Phase: 17-backend-foundation-secrets*
*Completed: 2026-07-22*
