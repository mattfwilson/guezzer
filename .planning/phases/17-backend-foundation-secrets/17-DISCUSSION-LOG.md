# Phase 17: Backend Foundation & Secrets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 17-backend-foundation-secrets
**Areas discussed:** Progress table schema scope, Schema deployment method, Friend accounts & passwords, Secrets & env layout, Core-purity boundary check, Provisioning / seed runtime / file layout / RLS audience

---

## Progress table schema scope

| Option | Description | Selected |
|--------|-------------|----------|
| Identity cols + jsonb summary | user_id (PK), display_name, updated_at real columns + one jsonb 'summary'; Phase 19 shapes payload with zero migration | ✓ |
| Full typed columns now | Every Option-B field as its own typed column; commits to exact shape before Phase 19 | |
| Minimal now, ALTER in Phase 19 | Blueprint columns only; add rest via migration in Phase 19 | |

**User's choice:** Identity cols + jsonb summary (Recommended)
**Notes:** Decouples Phase 17 from Phase 19's exact `deriveSharedProgress` shape; identity columns stay independently upsertable so the PROG-02 "touch identity only" write never resets counts. → D-01.

---

## Schema deployment method

| Option | Description | Selected |
|--------|-------------|----------|
| Committed migration + Supabase CLI | supabase/migrations/*.sql applied via `supabase db push`; reproducible, trips schema-push gate | ✓ |
| Committed schema.sql, run in dashboard | SQL in repo, pasted/run manually in dashboard | |
| Dashboard SQL editor only | SQL authored in dashboard, nothing in git | |

**User's choice:** Committed migration + Supabase CLI (Recommended)
**Notes:** → D-04. Project itself is created manually (D-05) since project creation isn't scriptable without a management-API PAT.

---

## Friend accounts & passwords

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanism now, real roster later | Prove idempotent seed with owner + placeholders; fill real friends at hand-out | ✓ |
| Define real roster now | Collect actual display names now, ship as committed config | |

| Option | Description | Selected |
|--------|-------------|----------|
| Committed display_names + count; emails & passwords via env | Roster file = display_name + slug (non-secret); emails/passwords from env keyed by slug | ✓ |
| Entire roster in one gitignored file | email + name + password all in one gitignored file, nothing committed | |
| Everything via individual env vars | No roster file; per-index env vars | |

**User's choice:** Mechanism now, real roster later + Committed display_names / env-keyed secrets
**Notes:** Repo is on public GitHub, so no email/password in git; display names committed as reviewable config. → D-07, D-08.

---

## Secrets & env layout

| Option | Description | Selected |
|--------|-------------|----------|
| VITE_ env vars | VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY via .env, read in app-layer client | ✓ |
| Hardcoded in committed client config | URL + anon key written directly into a committed config file | |

| Option | Description | Selected |
|--------|-------------|----------|
| .env.example committed + .env gitignored | Valueless example documents var names; real values gitignored; add .env* to .gitignore | ✓ |
| Single gitignored .env, no example | Just .env gitignored; document vars in README | |

**User's choice:** VITE_ env vars + .env.example committed / .env gitignored
**Notes:** VITE_ prefix is the mechanical secret boundary — service_role + passwords never carry it. Current .gitignore ignores no .env files, a real gap to close. → D-09, D-10, D-11.

---

## Core-purity boundary check (SETUP-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Automated test in the suite | Vitest test in core scanning for @supabase/createClient imports + DOM/network globals | ✓ |
| Standalone CLI boundary script | npm run check that greps core, exits non-zero on violation | |
| ESLint no-restricted-imports rule | Lint rule banning @supabase/* in packages/core | |

**User's choice:** Automated test in the suite (Recommended)
**Notes:** Runs in existing suite/CI so regressions are caught automatically. → D-12.

---

## Provisioning / seed runtime / file layout / RLS audience

| Question | Selected |
|----------|----------|
| Provisioning | Manual dashboard create, documented + CLI-linked (Recommended) → D-05 |
| Seed runtime | Node-native TypeScript (Recommended) → D-06 |
| File layout | Root supabase/ directory (Recommended) → D-13 |
| RLS read audience | SELECT to authenticated only (Recommended) → D-02 |

**Notes:** Free-tier project, region nearest the group; all backend ops under root `supabase/` driven by root npm scripts; no anonymous reads of progress.

---

## Claude's Discretion

- Exact migration filename/timestamp and npm script names.
- `updated_at` maintenance (client-set vs DB trigger) — default client-set.
- Placeholder account count / example emails for the idempotency proof.
- Intermediate shape of the `summary` jsonb for any placeholder write (Phase 19 owns the final shape).
- Supabase CLI version handling; single shared project assumed for ~5 users.

## Deferred Ideas

- Auth flow / offline session boot / Dexie namespacing → Phase 18.
- `deriveSharedProgress` / progress sync / friends screen / live compare → Phase 19.
- Presence / waves / reactions / coarse activity → Phase 20.
- GizzMap ↔ account convergence (MAP-F1/F2) → deferred backlog, out of v2.0.
- Full real-time shared setlist co-tracking (SOCL-V2-01) → out of scope.
- 15 keyword-matched todos (UI polish / future features from other milestones) — reviewed, none folded.
