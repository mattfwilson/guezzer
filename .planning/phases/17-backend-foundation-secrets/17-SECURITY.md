---
phase: 17
slug: backend-foundation-secrets
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-22
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified 2026-07-22 by gsd-security-auditor — 12/12 threats CLOSED, 0 blockers (block_on: high).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → repo build | Third-party package code enters the tree at install | Package tarballs + CLI binary |
| app bundle → Supabase | Anon-keyed client crosses to the hosted backend | Public JWT (anon key) + project URL |
| owner machine → dashboard/secrets | Real secrets captured and stored locally in gitignored `.env` | service_role, DB password, PAT, project ref |
| CLI → remote DB | `supabase link` / `db push` authenticated by DB password + PAT | Migration DDL |
| service_role (runtime) → Postgres | Node seed bypasses ALL RLS — must never touch bundle/git | service_role key (`process.env` only) |
| authenticated user → other users' rows | RLS read-all / write-own enforced live | `public.progress` rows |
| `packages/core` ↔ Supabase/DOM | Core purity: client isolated in app layer | (must be zero — enforced by guard test) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01 | Tampering | `@supabase/supabase-js` + `supabase` CLI installs | mitigate | Owner legitimacy checkpoint (both confirmed first-party on npmjs.com); versions pinned exactly — `@supabase/supabase-js` `2.110.8`, `supabase` `2.109.1` (no caret) | closed |
| T-17-02 | Information Disclosure | `packages/app/src/db/supabase.ts` | mitigate | Reads ONLY `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; zero `process.env`, no non-VITE secret | closed |
| T-17-03 | Information Disclosure | `.env` committed to git | mitigate | `.gitignore` = `.env`, `.env.*`, `!.env.example` (negation last); `git check-ignore .env` + `packages/app/.env.local` exit 0; only `.env.example` tracked | closed |
| T-17-04 | Information Disclosure | secret placed behind a `VITE_` prefix | mitigate | `.env.example` separates VITE_ public vars from non-VITE ops secrets; no `VITE_` name carries service/password/secret (mechanical D-10 boundary) | closed |
| T-17-05 | EoP / Information Disclosure | `packages/core` importing Supabase client or DOM/network | mitigate | Purity static-scan test bans `@supabase`/`supabase-js`/`createClient` + DOM/transport globals and asserts core has no `@supabase/*` dep (proven to fail on an injected import) | closed |
| T-17-06 | Tampering / EoP | `public.progress` RLS | mitigate | RLS enabled; `insert`/`update` gated `with check (auth.uid() = user_id)`; `select` read-all to `authenticated` only, no `anon`; cross-user write empirically REJECTED live | closed |
| T-17-07 | Information Disclosure | `seed-users.ts` service_role handling | mitigate | service_role read from `process.env` only (never `import.meta.env`/VITE_); roster is credential-free; passwords env-keyed by slug | closed |
| T-17-08 | Information Disclosure | Realtime publication | mitigate | `select` policy to `authenticated` only (no anon grant) → unauthenticated `postgres_changes` cannot read; `progress` on `supabase_realtime` confirmed live | closed |
| T-17-09 | Information Disclosure | DB password / PAT / service_role in `.env` | mitigate | `.env`/`.env.local` gitignored + shell-exported at run; `.env.example` valueless; `git check-ignore` confirmed; no secret env file tracked | closed |
| T-17-10 | Tampering / EoP | RLS actually enforced post-push | mitigate | Post-push live verification: 3 policies present, RLS enabled, cross-user write rejected, `pg_publication_tables` membership = 1 row (authoritative live evidence in 17-04-SUMMARY) | closed |
| T-17-11 | Broken Authentication | shared/weak account passwords | mitigate | Distinct per-person passwords via `.env` `SEED_PASSWORD_<SLUG>` (D-06); no in-app self-signup (accounts minted only by the ops seed via GoTrue admin API) | closed |
| T-17-SC | Tampering (supply chain) | package installs / service_role misuse | mitigate | Installs gated behind the owner legitimacy checkpoint; service_role used ONLY by the Node seed via `process.env`, never the Vite bundle; core has zero `@supabase` dep; seed is dependency-free | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks — every threat is mitigated and verified CLOSED.

---

## Additive hardening (no new attack surface)

Two implementation changes appeared during execution/review; both are hardening with no new attack surface and no threat mapping needed:
- **WR-04** — fail-fast env validation in `supabase.ts` (narrows `string | undefined`, actionable error); still reads only VITE_ vars — reinforces T-17-02.
- **WR-03** — additive `updated_at` trigger migration `20260722180000_progress_updated_at_trigger.sql` (server-side timestamp maintenance); touches no RLS/publication/secret surface. Applied and probe-verified live.

## Informational observation (not a blocker)

The reused spike project carries pre-existing auth accounts beyond the current roster (`gizz1–5@gizz.local`, `max/tim/shawn/brian@fov.gizz`). These are outside Phase 17's declared threat register and its roster-minted account model (T-17-11). **Recommend Phase 18 (auth) threat-model and reconcile/prune these residual accounts explicitly.**

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-22 | 12 | 12 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-22
