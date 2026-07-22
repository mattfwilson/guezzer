---
phase: 17-backend-foundation-secrets
plan: 01
subsystem: infra
tags: [supabase, supabase-js, supabase-cli, vite-env, npm-workspaces, client-isolation]

# Dependency graph
requires:
  - phase: (v1) 03-app-shell-pwa-foundation
    provides: packages/app + Vite env typing (import.meta.env.VITE_*) and the src/db/ feature folder
provides:
  - "@supabase/supabase-js@2.110.8 pinned in the app package (app-layer only, D-14)"
  - "supabase@2.109.1 root devDependency — npx-runnable CLI (not -g)"
  - "supabase/ CLI project scaffold (config.toml + .gitignore) for migrations"
  - "Root npm scripts db:push and seed:accounts"
  - "packages/app/src/db/supabase.ts — the ONLY createClient call; exported `supabase` singleton"
affects: [17-02 core-purity guard, 18 auth, 19 shared-progress, 20 presence, 17-04 provisioning/db-push]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js@2.110.8", "supabase@2.109.1 (CLI)"]
  patterns:
    - "Single-createClient app-layer client module (D-14); core stays @supabase-free"
    - "Public VITE_-only secret surface (D-09/D-10) via import.meta.env"

key-files:
  created:
    - packages/app/src/db/supabase.ts
    - supabase/config.toml
    - supabase/.gitignore
  modified:
    - package.json
    - packages/app/package.json
    - package-lock.json

key-decisions:
  - "CLI installed as a ROOT devDependency (not -g, unsupported on Windows; not pnpm/corepack — repo is npm workspaces)"
  - "Client kept minimal (no custom auth options) — offline-session tuning deferred to Phase 18"

patterns-established:
  - "Pattern: the sole createClient site lives at packages/app/src/db/supabase.ts; 17-02 asserts it never appears under packages/core"
  - "Pattern: exact-pin third-party deps with -E/--save-exact so the lockfile freezes versions (threat T-17-01 mitigation)"

requirements-completed: [SETUP-04]

# Metrics
duration: ~10min
completed: 2026-07-22
---

# Phase 17 Plan 01: Backend Foundation — Supabase Client, CLI & Scaffold Summary

**Stood up the app-side Supabase foundation: pinned `@supabase/supabase-js@2.110.8` in the app package, the `supabase@2.109.1` CLI as a root devDependency with a scaffolded `supabase/` project, and the single `createClient` module at `packages/app/src/db/supabase.ts` that every v2.0 phase imports — with `packages/core` left @supabase-free.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-22
- **Tasks:** 3 (1 pre-cleared checkpoint + 2 auto)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Package-legitimacy gate (Task 1, T-17-SC) recorded as owner-approved — both packages pre-verified on npmjs.com as first-party official Supabase org packages (see below).
- `@supabase/supabase-js@2.110.8` installed exact into `packages/app` (app-layer only, D-14); lockfile freezes the version (T-17-01 mitigation).
- `supabase@2.109.1` CLI installed as a root devDependency (npx-runnable, not `-g`); `npx supabase --version` resolves the platform binary.
- `supabase/` project scaffolded via `npx supabase init` (`config.toml` + `.gitignore`); root scripts `db:push` and `seed:accounts` added.
- `packages/app/src/db/supabase.ts` authored as the ONLY `createClient` call, reading only public `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; app typechecks clean.
- `packages/core` untouched — dependencies remain only `fuse.js` + `zod` (no `@supabase/*`), preserving the core-purity invariant that 17-02 enforces.

## Task Commits

1. **Task 1: Package-legitimacy gate (T-17-SC)** — no commit (no files; pre-cleared owner approval, a no-op gate)
2. **Task 2: Install deps, scaffold supabase/, add root scripts** — `4d5479b` (chore)
3. **Task 3: Author the app-layer Supabase client module (D-14)** — `3c97648` (feat)

_Plan metadata commit follows this SUMMARY (docs)._

## Files Created/Modified
- `packages/app/src/db/supabase.ts` (created) — the single `createClient` call; exports the `supabase` singleton built from the two public `VITE_` vars.
- `supabase/config.toml` (created) — CLI project scaffold from `supabase init`.
- `supabase/.gitignore` (created) — ignores `.branches`/`.temp` + local `.env*` (unmodified, as generated).
- `package.json` (modified) — `supabase@2.109.1` devDependency; new scripts `db:push`, `seed:accounts`.
- `packages/app/package.json` (modified) — `@supabase/supabase-js@2.110.8` dependency.
- `package-lock.json` (modified) — pins exact versions of both new packages and their trees.

## Package-Legitimacy Gate (Task 1 / T-17-SC)
The owner had already visually verified both packages on npmjs.com and explicitly approved the installs BEFORE execution began (pre-cleared in the executor prompt):
- `@supabase/supabase-js@2.110.8` — confirmed official Supabase org package (github.com/supabase/supabase-js), no unexpected postinstall.
- `supabase@2.109.1` — confirmed official Supabase CLI (github.com/supabase/cli); downloads a platform binary on install (expected for a CLI wrapper).

Per the pre-cleared instruction, execution did not re-pause at this blocking-human gate. No package install failed and no substitution was ever attempted.

## Decisions Made
- Installed the CLI as a **root devDependency** (not `-g`, unsupported on Windows; not pnpm/corepack — this repo is npm workspaces), matching the plan and the `packages/relay` npx precedent.
- Kept the client module **minimal** (no custom auth/storage options) — offline-session tuning is deliberately Phase 18 scope.
- Did NOT run `supabase link` / `db push` — that needs the live project and is plan 17-04.

## Deviations from Plan

None — plan executed exactly as written.

_Note: the client module's doc-comment was authored to avoid the literal substring `process.env` so it satisfies the plan's `! grep -q "process.env"` acceptance check; the module references only `import.meta.env.VITE_*`. This is a wording choice within the planned file, not a scope deviation._

## Issues Encountered
None. `npm audit` reports 1 pre-existing high-severity advisory in the transitive tree (out of scope — not introduced by this task's direct deps; logged here for visibility, not fixed).

## User Setup Required
None in this plan. The `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values are loaded from `packages/app/.env.local` at runtime; provisioning the live project and populating those vars is later-phase scope (17-04 / secrets).

## Next Phase Readiness
- 17-02 can now add the core-purity guard test asserting `createClient` / `@supabase` never appears under `packages/core` (the single client site is in place and named as expected).
- Phases 18–20 can import `{ supabase }` from `packages/app/src/db/supabase.ts`.
- 17-04 can `supabase link` + `db push` once the live project exists (CLI + `db:push` script ready).

## Self-Check: PASSED
- FOUND: `packages/app/src/db/supabase.ts`
- FOUND: `supabase/config.toml`
- FOUND: `supabase/.gitignore`
- FOUND commit: `4d5479b` (Task 2)
- FOUND commit: `3c97648` (Task 3)

---
*Phase: 17-backend-foundation-secrets*
*Completed: 2026-07-22*
