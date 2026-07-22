---
phase: 17
slug: backend-foundation-secrets
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-22
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (root; `test.projects` — core=node / app=jsdom) [VERIFIED: root package.json] |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run packages/core/test/purity.test.ts` |
| **Full suite command** | `npm test` (`vitest run` — purity + hygiene guards + existing ~48 core suites) |
| **Estimated runtime** | ~5s quick · ~15s full |

No framework install needed — Vitest 4 + the `@guezzer/core` node project already exist.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/core/test/purity.test.ts` (fast, deterministic)
- **After every plan wave:** Run `npm test` (confirms the `fetch`/bare-`window` purity exceptions did not red `poll-latest`/`fetch-corpus`)
- **Before `/gsd-verify-work`:** Full suite green + manual runbook complete (schema pushed, seed run twice, secrets absent from git)
- **Max feedback latency:** ~15 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-02 | 01 | 1 | SETUP-04 | T-17-01 / T-17-SC | Pinned-exact first-party installs; CLI scaffold; core stays Supabase-free | integration | `grep -q '"@supabase/supabase-js": "2.110.8"' packages/app/package.json && grep -q '"supabase": "2.109.1"' package.json && grep -q '"db:push"' package.json && grep -q '"seed:accounts"' package.json && test -f supabase/config.toml && npx supabase --version` | ✅ | ⬜ pending |
| 17-01-03 | 01 | 1 | SETUP-04 | T-17-02 | Single `createClient` site reads only public `VITE_` anon key + URL; no `process.env` | unit (static grep) + typecheck | `grep -q "createClient" packages/app/src/db/supabase.ts && grep -q "import.meta.env.VITE_SUPABASE_URL" … && ! grep -q "process.env" … && (cd packages/app && npx tsc --noEmit)` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 1 | SETUP-03 | T-17-03 | `.env`/`.env.*` git-ignored, `.env.example` valueless, no `VITE_`-prefixed secret name | unit (git + grep) | `grep -qx '.env' .gitignore && grep -qx '.env.*' .gitignore && grep -qx '!.env.example' .gitignore && test -f .env.example && ! grep -iE '^VITE_[A-Z_]*(SERVICE\|PASSWORD\|SECRET)' .env.example && git check-ignore .env` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 1 | SETUP-04 | T-17-04 | `packages/core` imports zero Supabase / browser DOM (excl. global `fetch` + bare `window`) | unit (static scan) | `npx vitest run packages/core/test/purity.test.ts && npm test` | ✅ | ⬜ pending |
| 17-03-01 | 03 | 2 | SETUP-01 | T-17-09 | Migration creates `public.progress` table, jsonb summary, RLS write-own, realtime publication, no `anon` grant | unit (SQL grep) | `f=$(ls supabase/migrations/*_progress_foundation.sql) && grep -qi 'create table public.progress' "$f" && grep -qi 'with check (auth.uid() = user_id)' "$f" && grep -qi 'alter publication supabase_realtime add table public.progress' "$f" && ! grep -qi 'to anon' "$f"` | ✅ | ⬜ pending |
| 17-03-02 | 03 | 2 | SETUP-02 | T-17-10 | Idempotent seed: `email_confirm`, admin users endpoint, service-role env only, 422-skip, no `import.meta.env`, erasable syntax | unit (grep + `node --check`) | `grep -q 'email_confirm' supabase/seed/seed-users.ts && grep -q '/auth/v1/admin/users' … && grep -q 'SUPABASE_SERVICE_ROLE_KEY' … && grep -Eq '422\|registered\|already\|exists' … && ! grep -q 'import.meta.env' … && node --check supabase/seed/seed-users.ts` | ✅ | ⬜ pending |
| 17-04-02 | 04 | 3 | SETUP-01 | T-17-11 | Migration applied to linked remote; migration list confirms | integration (live) | `npx supabase migration list --linked` | ⚠️ live | ⬜ pending |
| 17-04-03 | 04 | 3 | SETUP-02 | T-17-10 | Second seed run reports zero new accounts (empirical idempotency) | integration (live) | `node --env-file=.env supabase/seed/seed-users.ts \| tee /tmp/seed-run2.log && grep -qi 'Done (0 new)' /tmp/seed-run2.log` | ⚠️ live | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists: ✅ = target created within the task · ⚠️ live = command runs only after the D-05 human gate provisions the hosted project (17-04 Task 1).*

Sampling continuity check: no run of 3 consecutive tasks lacks an automated verify (every auto task across 17-01…17-04 has one; the only non-automated task is the 17-04 Task 1 human gate).

---

## Wave 0 Requirements

- [ ] `packages/core/test/purity.test.ts` — SETUP-04 static scan asserting `packages/core` imports zero `@supabase/*` / browser DOM, with the documented global-`fetch` + bare-`window` exceptions (created by 17-02 Task 2)
- [ ] (optional) secret-hygiene guard — assert no `VITE_`-prefixed name contains `service|password|secret` and `.env` is git-ignored — SETUP-03 (covered inline by 17-02 Task 1's `<automated>`)
- [ ] (optional) `supabase/seed/seed-users.test.ts` — unit-test request-building + 422-skip with a mocked `fetch` — SETUP-02 (the live twice-run in 17-04 is the real proof)

No framework install required — Vitest 4 + the `@guezzer/core` node project already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create hosted Supabase project, capture URL/anon/service_role/DB-password/PAT into gitignored `.env` + `packages/app/.env.local`, run `supabase link` | SETUP-01, SETUP-02, SETUP-03 (D-05) | Dashboard project creation + owner credentials cannot be performed by Claude; it is the phase's one human gate (17-04 Task 1) | Follow RESEARCH §"Provisioning + deploy runbook": create free-tier project, capture secrets per `.env.example`, confirm `git check-ignore .env packages/app/.env.local` returns both, `npx supabase link --project-ref <ref>` |
| Migration applies to the live remote; table + RLS + realtime publication exist | SETUP-01 | `supabase db push --linked` + `select … from pg_publication_tables` require the provisioned hosted project (gated by D-05) | After the human gate: `npx supabase db push --linked`, then `npx supabase migration list --linked` shows the migration applied (17-04 Task 2) |
| Seed run twice → all accounts report "exists" (empirical idempotency) | SETUP-02 | Requires the live GoTrue admin endpoint + service_role key on the provisioned project | After the human gate: run `node --env-file=.env supabase/seed/seed-users.ts` twice; second run reports `Done (0 new)` (17-04 Task 3) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (only the 17-04 Task 1 human gate is non-automated)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`packages/core/test/purity.test.ts` — created in 17-02)
- [x] No watch-mode flags (`vitest run`, not `vitest`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-22
