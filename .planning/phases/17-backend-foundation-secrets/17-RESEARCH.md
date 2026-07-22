# Phase 17: Backend Foundation & Secrets - Research

**Researched:** 2026-07-22
**Domain:** Supabase backend provisioning (Postgres + RLS + Realtime), GoTrue admin account seeding, secrets hygiene, monorepo purity enforcement
**Confidence:** HIGH (spike-validated blueprint + verified current versions; two LOW/flagged items noted)

## Summary

This phase stands up the hosted Supabase foundation that every downstream v2.0 phase (18 auth, 19 progress, 20 presence) keys off. The good news: **the entire approach is already validated.** The spike blueprint (`multi-user-supabase.md`, spikes 002–004 validated across two remote devices) is the load-bearing how-to — client setup, the GoTrue admin seed pattern, the schema/RLS SQL, and the realtime-publication gotcha are all proven. This research verifies the current library versions against that blueprint, resolves the Windows/CLI operational details the spike didn't cover, and flags the two places where the phase's own decisions need a small sharpening.

The work splits cleanly into four independent tracks matching SETUP-01…04: (1) a committed `supabase/migrations/*.sql` migration carrying the `public.progress` schema + read-all/write-own RLS + the `alter publication supabase_realtime add table` line, applied via `supabase db push` against a manually-created linked project; (2) a Node-native-TS, dependency-free, idempotent seed script hitting `POST /auth/v1/admin/users`; (3) the `VITE_`-prefix secret boundary + a `.gitignore` fix + a committed `.env.example`; (4) an automated Vitest test in `packages/core` that fails if core ever imports Supabase. None of these depend on each other, so they parallelize.

**Primary recommendation:** Follow the spike blueprint verbatim for the schema, RLS, and seed patterns (they are validated — cite, don't re-derive). Pin `@supabase/supabase-js@2.110.8` in `packages/app` only. Install the Supabase CLI as a **root devDependency** (`npm install -D supabase`) driven via `npx supabase` — NOT `npm install -g` (unsupported on Windows). Load ops secrets into the Node seed script and `db push` via **`node --env-file=.env`** and shell-exported env — no `dotenv` dependency needed. Two things to sharpen at plan time: (a) the core-purity check must **not** ban the global `fetch` (core legitimately uses `fetch` in its Node CLIs — see `poll-latest.ts`, `fetch-corpus.ts`); scope it to Supabase specifiers + browser-DOM globals. (b) `supabase db push` against a *linked remote* does **not** require Docker — only local `supabase start` does.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Progress schema (SETUP-01)**
- **D-01:** `public.progress` columns = `user_id uuid primary key references auth.users(id) on delete cascade`, `display_name text not null`, `updated_at timestamptz not null default now()`, and `summary jsonb` — the single `jsonb` column holds the **whole Option-B derived payload** (completion %, `show_count`, rarest `{songId,tier}`, per-tier counts, `perAlbum`, `caughtSongIds int[]`, etc.). Phase 19's `deriveSharedProgress` shapes the payload with **zero later migration**. Identity columns stay first-class so the "touch identity only" upsert (PROG-02) never resets the summary.
- **D-02:** Read-all / write-own RLS — `SELECT` granted to `authenticated` **only** (`using (true)`); `INSERT`/`UPDATE` gated to `auth.uid() = user_id` (both `using` and `with check` on update). No `anon` read.
- **D-03:** `alter publication supabase_realtime add table public.progress` is included in the migration — REQUIRED or `postgres_changes` silently never fires (blueprint gotcha).

**Schema deployment (SETUP-01)**
- **D-04:** Schema ships as a committed `supabase/migrations/*.sql` file, applied with `supabase db push` against the CLI-linked remote project. Version-controlled, reviewable, re-runnable.
- **D-05:** The Supabase project is **created manually** in the dashboard (free tier, region nearest the friend group). Phase 17 **documents** the provisioning steps, captures `URL` / `anon` / `service_role` into env, and runs `supabase link` to connect the CLI.

**Account seeding (SETUP-02)**
- **D-06:** Seed script = **Node-native TypeScript** (`.ts` run directly on Node ≥ 24.12 type-stripping, erasable syntax, dependency-free global `fetch` → GoTrue admin API `POST /auth/v1/admin/users`). Sets `email_confirm:true`, distinct per-person passwords, `user_metadata.display_name`. **Idempotent**: a 422 / "already registered" response is treated as skip, not error. No `supabase-js`, no `tsx`, no build step.
- **D-07:** Build and **prove the mechanism now** with the owner's real account + a couple of placeholders. The real friend roster is filled in right before minting credentials.
- **D-08:** Roster source = a **committed roster file** listing `display_name` + a stable slug per friend (non-secret). The seed script reads each account's **email and password from env keyed by that slug** — no email or password in git.

**Secrets & env (SETUP-03)**
- **D-09:** Client `anon` key + project URL live in **`VITE_` env vars** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), read in the app-layer client module. Both public-by-design; inlining into the bundle is fine.
- **D-10:** `service_role` key and **all account passwords are env-only, NEVER `VITE_`-prefixed**, never committed. The `VITE_` prefix is the mechanical line between "ships in the bundle" and "server/ops secret."
- **D-11:** Commit a valueless **`.env.example`** documenting every required var name. Real values go in a gitignored `.env` / `.env.local`. **Add `.env*` (except `.env.example`) to `.gitignore`** — today `.gitignore` ignores no `.env` files.

**Core purity (SETUP-04)**
- **D-12:** The boundary check is an **automated Vitest test in `packages/core`** that scans core source for any `@supabase` / `supabase-js` / `createClient` import (and DOM/network globals) and fails on a hit. Runs in the existing suite/CI.

**Repo layout & client dependency**
- **D-13:** All backend artifacts live under a **root `supabase/` directory** (`supabase/migrations/*.sql` + `supabase/seed/seed-users.ts`), driven by root npm scripts (e.g. `db:push`, `seed:accounts`).
- **D-14:** Add **`@supabase/supabase-js` (v2.91+)** to `packages/app` only. The client sits behind a thin app-layer module and is never imported from `packages/core` (enforced by D-12).

### Claude's Discretion
- Exact migration filename/timestamp and npm script names.
- `updated_at` maintenance (client-set on write vs. a DB trigger) — default to client-set unless a trigger is trivially cleaner.
- Placeholder account count / example emails used to prove idempotency.
- The intermediate shape of the `summary` jsonb for any placeholder write this phase — Phase 19 owns the final payload shape.
- Supabase CLI version handling and any local dev-vs-prod project distinction (single shared project is the assumption for ~5 users).

### Deferred Ideas (OUT OF SCOPE)
- Auth flow, offline session boot, `display_name` chrome chip, Dexie per-user namespacing → **Phase 18** (AUTH-01…08).
- `deriveSharedProgress`, progress upsert/sync, friends screen, live `postgres_changes` refresh, head-to-head compare → **Phase 19** (PROG-01…08).
- Presence dots, waves, reactions, coarse activity status → **Phase 20** (PRES-01…07).
- GizzMap ↔ account convergence (MAP-F1/MAP-F2) → deferred backlog, out of v2.0.
- Full real-time shared setlist co-tracking (SOCL-V2-01) → later milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Supabase project + `public.progress` (keyed by `user_id`), read-all/write-own RLS, `alter publication supabase_realtime add table` | Exact migration SQL below (Architecture Patterns → Migration). Adapts validated `schema.sql` to D-01 columns. `db push` operational details resolved. |
| SETUP-02 | Idempotent GoTrue admin seed script; `email_confirm:true`, distinct passwords, `user_metadata.display_name`; re-run skips existing | GoTrue admin endpoint/headers/body verified; duplicate → **422 `email_exists`** confirmed; dependency-free `node --env-file` env loading; roster-file + env-keyed-by-slug pattern (D-08). |
| SETUP-03 | Secrets discipline — `service_role` + passwords env-only; `anon` + URL may ship; `.gitignore` fix; `.env.example` | Exact `.gitignore` pattern; Vite `import.meta.env` VITE_-prefix boundary explained; two-mechanism env-loading model (Vite auto-load vs `node --env-file`). |
| SETUP-04 | Supabase client isolated in app layer; `packages/core` never imports it | Static-scan Vitest test recommended (not AST/import-graph); **critical caveat: do NOT ban `fetch`** — core uses it in Node CLIs. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `public.progress` schema + RLS | Database (Postgres) | — | Access control (read-all/write-own) is enforced at the DB via RLS, not in client code — the only trustworthy place. |
| Realtime publication | Database + Supabase Realtime | — | `postgres_changes` streams from the WAL publication; a DB-level `alter publication`. |
| Account minting | Ops / build-time script (Node) | GoTrue (hosted) | `service_role` admin calls MUST run server-side/ops-side, never in the browser bundle. |
| Supabase client (`createClient`) | Frontend app layer (`packages/app`) | — | Anon-keyed client; app-only per D-14. Never in `core`. |
| Derivations (matrix, dex, `deriveSharedProgress` later) | Pure core (`packages/core`) | — | Zero network/DOM; the summary payload is *shaped* in core, *transported* by app. |
| Secret storage | Env / ops (`.env`, shell) | — | `service_role` + passwords never touch git or the bundle. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | **2.110.8** | Supabase client (auth + Postgres + Realtime) — app layer only (D-14) | The official first-party SDK. `latest` published 2026-07-21 [VERIFIED: npm registry]. Repo `github.com/supabase/supabase-js` [VERIFIED: npm registry]. Blueprint-validated. Satisfies CONTEXT's "v2.91+". |
| `supabase` (CLI) | **2.109.1** | Migration + link tooling (`supabase init`, `link`, `db push`) | The official CLI. `latest` 2.109.1 [VERIFIED: npm registry]. Repo `github.com/supabase/cli`. Install as **root devDependency**, run via `npx supabase`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | Seed script is **dependency-free** (global `fetch`, `node --env-file`) | Per D-06 — no `supabase-js`, no `tsx`, no `dotenv`, no build step. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CLI as devDependency (`npm i -D supabase` + `npx supabase`) | Scoop global (`scoop install supabase`) | Scoop is the other officially-supported Windows path [CITED: supabase.com/docs/guides/local-development/cli/getting-started]. DevDependency pins the version in the lockfile (reproducible, matches the repo's `npx wrangler@latest` precedent in `packages/relay`), so prefer it. **Do NOT** `npm install -g supabase` — unsupported on Windows. |
| `node --env-file=.env` for the seed | `dotenv` package | `--env-file` is built into Node ≥20.6 (stable in 24.x) — zero deps, matches the "dependency-free" ethos of D-06. Prefer it. |
| Client-set `updated_at` | `moddatetime` trigger extension | Trigger is arguably cleaner but adds a Postgres extension + a `create trigger` to the migration. For a foundation phase, client-set (`updated_at: now()` in the upsert, landing in Phase 19) is simpler. Default to client-set per D-discretion. |
| Static file scan for purity | AST / import-graph (ts-morph, madge) | AST adds a dependency and complexity. A dependency-free `fs` + regex scan over `packages/core/src/**/*.ts` matches the repo's test idioms and is sufficient. Prefer static scan. |

**Installation:**
```bash
# App-layer client (packages/app only — D-14)
npm install -w @guezzer/app @supabase/supabase-js@2.110.8

# CLI as a ROOT devDependency (run via `npx supabase …`)
npm install -D supabase@2.109.1
```

**Version verification (2026-07-22):**
- `npm view @supabase/supabase-js version` → **2.110.8** (published 2026-07-21) [VERIFIED: npm registry]. `engines.node` `>=22.0.0` — fine on Node 24.15.
- `npm view supabase version` → **2.109.1** [VERIFIED: npm registry].
- Note the registry also shows `3.0.0-next.29` (supabase-js) — a **prerelease**; stay on the `2.x` `latest` line.

## Package Legitimacy Audit

> slopcheck was **unavailable** at research time (pip install failed in the sandbox). Both packages are nonetheless first-party official Supabase packages, cross-checked against official docs and repo provenance.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/supabase-js` | npm | mature (2.x line, years) | very high (official SDK) | `github.com/supabase/supabase-js` [VERIFIED] | unavailable | Approved — first-party, cited from official docs + blueprint |
| `supabase` (CLI) | npm | mature | very high | `github.com/supabase/cli` [VERIFIED] | unavailable | Approved — first-party official CLI |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

*slopcheck could not run. Per protocol, absent slopcheck these would normally be `[ASSUMED]`. However, both are unambiguously first-party Supabase packages — the repository URLs resolve to the `supabase` GitHub org, they are the exact packages the validated spike used, and they are cited from official Supabase documentation. Risk is negligible. The planner may still add a light `checkpoint:human-verify` before the first `npm install` if it wants belt-and-suspenders, but no cross-ecosystem or typosquat signal exists. Postinstall check: `@supabase/supabase-js` has no unexpected postinstall; the `supabase` CLI package downloads a platform binary on install (expected behavior for a CLI wrapper).*

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────┐
                       │  Supabase project (hosted, free tier)    │
   owner (ops) ──┐     │  ┌──────────┐  ┌───────────┐  ┌────────┐ │
                 │     │  │  GoTrue   │  │ Postgres  │  │Realtime│ │
  seed-users.ts ─┼────▶│  │  (auth)   │  │  + RLS    │  │  (WAL) │ │
  POST /auth/v1/ │ svc │  └──────────┘  └───────────┘  └────────┘ │
  admin/users    │ role│        ▲             ▲   ▲         ▲      │
  (email_confirm)│     │        │             │   │ publication    │
                 │     │  supabase db push ───┘   │supabase_realtime
  supabase link ─┘     │  (migration: table+RLS+pub)              │
  supabase db push     └─────────────────────────────────────────┘
                                          ▲ anon key (public)
                                          │
                       ┌──────────────────┴──────────────────┐
                       │  packages/app  (Vite bundle)          │
                       │  src/…/supabase.ts:                    │
                       │    createClient(VITE_SUPABASE_URL,     │
                       │                 VITE_SUPABASE_ANON_KEY)│  ◀── ONLY place createClient is called
                       └───────────────────────────────────────┘
                                          ▲ imports (one direction)
                       ┌──────────────────┴──────────────────┐
                       │  packages/core  (pure)                │
                       │  NO @supabase import (D-12 test guards)│
                       └───────────────────────────────────────┘

  Secret boundary:  service_role + passwords + DB password  → env only (never VITE_, never git)
                    anon key + project URL                   → VITE_ (safe in bundle)
```

### Recommended Project Structure
```
supabase/                          # NEW root dir (D-13) — created by `supabase init`
├── config.toml                    #   CLI project config (committed)
├── .gitignore                     #   auto-generated (ignores .branches/.temp/.env)
├── migrations/
│   └── <timestamp>_progress_foundation.sql   # D-04: table + RLS + publication
└── seed/
    ├── roster.ts (or .json)       # D-08: committed display_name + slug (non-secret)
    └── seed-users.ts              # D-06: Node-native-TS, dependency-free, idempotent

packages/app/
└── src/
    └── lib/supabase.ts (or similar)   # D-14: the ONLY createClient call

packages/core/
└── test/
    └── purity.test.ts             # D-12: static scan; fails on @supabase import in core

.env.example                       # D-11: committed, valueless, documents every var
.env / .env.local                  # gitignored real values
.gitignore                         # D-11: add .env pattern
```

### Pattern 1: The migration (D-01/D-02/D-03) — schema + RLS + realtime publication
**What:** One committed SQL migration carrying the whole foundation. Adapts the validated `sources/002-supabase-multiuser/seed/schema.sql` to the D-01 columns (drops `songs_caught`; adds `summary jsonb`).
**When to use:** Applied once via `npx supabase db push --linked`.
```sql
-- Source: adapted from spike-findings-guezzer/.../schema.sql (VALIDATED) + D-01 columns
create table public.progress (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  updated_at   timestamptz not null default now(),
  summary      jsonb       -- whole Option-B payload (D-01); Phase 19 shapes it, no later migration
);

alter table public.progress enable row level security;

-- D-02: read-all to authenticated (NOT anon).
create policy "read all progress"
  on public.progress for select
  to authenticated
  using (true);

-- D-02: insert only your own row.
create policy "insert own progress"
  on public.progress for insert
  to authenticated
  with check (auth.uid() = user_id);

-- D-02: update only your own row (using + with check).
create policy "update own progress"
  on public.progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- D-03: REQUIRED — without this, postgres_changes silently never fires (blueprint gotcha).
alter publication supabase_realtime add table public.progress;
```
Notes:
- In a **tracked migration applied once**, plain DDL is correct (no `if not exists` / `drop policy if exists` needed — the reference file used those only because it was pasted repeatedly into the dashboard SQL editor). [CITED: supabase.com/docs/reference/cli/supabase-db-push]
- `alter publication … add table` errors if the table is already a member. Since migrations run exactly once and are tracked in `supabase_migrations.schema_migrations`, this is safe. If you ever intend to re-run manually, guard it in a `do $$ … $$` block.
- **RLS + Realtime interaction:** `postgres_changes` respects RLS — a subscriber receives a change only if their JWT passes the `select` policy. D-02's `using (true)` for `authenticated` means every signed-in friend receives every row change. Correct for the friends feed (Phase 19/20). [CITED: supabase.com/docs — Realtime Postgres Changes authorization]

### Pattern 2: Idempotent GoTrue admin seed (D-06/D-08) — Node-native TS, dependency-free
**What:** Port `sources/002-supabase-multiuser/seed/seed-users.mjs` (VALIDATED) to Node-native `.ts` with the D-08 roster/env split.
**When to use:** `node --env-file=.env supabase/seed/seed-users.ts` (run twice to prove idempotency).
```ts
// Source: ported from spike seed-users.mjs (VALIDATED) with D-08 roster/env-slug split.
// Run: node --env-file=.env supabase/seed/seed-users.ts   (dependency-free; global fetch; Node >=24.12)
const URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

// D-08: roster is committed (display_name + slug), email/password come from env keyed by slug.
interface RosterEntry { slug: string; display_name: string }
const roster: RosterEntry[] = [/* imported from committed roster.ts */];

let created = 0;
for (const person of roster) {
  const email = process.env[`SEED_EMAIL_${person.slug.toUpperCase()}`];
  const password = process.env[`SEED_PASSWORD_${person.slug.toUpperCase()}`];
  if (!email || !password) {
    console.error(`✗ missing env for slug "${person.slug}" — skipping`);
    continue;
  }
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,                          // D-06: no email step
      user_metadata: { display_name: person.display_name },
    }),
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (res.ok) {
    created++;
    console.log(`✓ created  ${email}`);
  } else if (res.status === 422 || /registered|already|exists/i.test(JSON.stringify(body))) {
    console.log(`• exists   ${email} (unchanged)`);   // D-06 idempotency: skip, not error
  } else {
    console.error(`✗ FAILED   ${email} → ${res.status} ${JSON.stringify(body)}`);
  }
}
console.log(`\nDone (${created} new).`);
```
Key verified facts:
- Endpoint: `POST {URL}/auth/v1/admin/users`. Headers: `apikey: <service_role>` + `Authorization: Bearer <service_role>` + `Content-Type: application/json`. Body: `email`, `password`, `email_confirm`, `user_metadata`. [VERIFIED: spike seed-users.mjs, VALIDATED across two devices]
- **Duplicate email → HTTP 422, error code `email_exists`** in current GoTrue [CITED: github.com/supabase/gotrue discussions + drdroid stack-diagnosis]. Older GoTrue builds returned 400 with a "User already registered" message — the reference script's **dual check (status 422 OR body regex)** is deliberately defensive; keep it. Confidence MEDIUM on the exact code across all versions, HIGH that the dual check handles every observed shape.
- **Erasable-syntax constraint (core tsconfig ethos):** the seed lives under `supabase/`, not `packages/core`, so it isn't under core's `erasableSyntaxOnly`. But to run via Node type-stripping it must still avoid `enum`/`namespace`/parameter-properties. Use `interface` + `type` only (as above). Mirrors `packages/app/scripts/fetch-covers.ts`, which runs as `node scripts/fetch-covers.ts`.

### Pattern 3: The app-layer client (D-14) — the single `createClient`
```ts
// Source: spike blueprint multi-user-supabase.md §1 (VALIDATED). packages/app only.
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```
Only `VITE_`-prefixed vars are exposed to the bundle via `import.meta.env` — the anon key and URL are public by design (D-09). This file is the one place `createClient` appears; the D-12 test asserts it never appears under `packages/core`.

### Pattern 4: Core-purity static scan (D-12/SETUP-04)
```ts
// Source: repo test idioms (fs read + assert). packages/core/test/purity.test.ts, node env.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { glob } from "node:fs/promises"; // Node 22+ has fs.promises.glob; else walk manually
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

// FORBIDDEN in core: Supabase + browser-DOM globals. NOTE: `fetch` is NOT banned —
// core legitimately uses global fetch in its Node CLIs (poll-latest.ts, fetch-corpus.ts).
const FORBIDDEN = [
  /@supabase\//,
  /supabase-js/,
  /\bcreateClient\b/,
  /\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bnavigator\./, /\bXMLHttpRequest\b/,
];

describe("core purity (SETUP-04)", () => {
  it("packages/core imports no Supabase / browser DOM", async () => {
    for await (const file of glob(`${SRC}**/*.ts`)) {
      const text = await readFile(file, "utf8");
      for (const pattern of FORBIDDEN) {
        expect(text, `${file} violates ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
```
Design notes:
- **Static scan over AST/import-graph** — dependency-free, matches repo idioms, fast. AST (ts-morph) would add a dep for no real gain at this scale.
- **The `fetch` caveat is load-bearing.** D-12's wording says "DOM/network globals," but `packages/core/src/live/poll-latest.ts` and `packages/core/src/cli/fetch-corpus.ts` **use global `fetch` in Node on purpose**. Banning `fetch` would immediately red the existing suite. Scope the "network" ban to *browser-only* transports (`XMLHttpRequest`, `WebSocket`, `EventSource`) and DOM globals — NOT `fetch`. **Flag for planner: this is where CONTEXT's D-12 phrasing and current code reality meet — the plan must encode the `fetch` exception explicitly.**
- Verify `node`-env project (existing `vitest.config.ts` runs `@guezzer/core` under `environment: "node"`). Place the test at `packages/core/test/purity.test.ts` so the existing `include: ["test/**/*.test.ts"]` picks it up with zero config change.
- Optional hardening: also assert `packages/core/package.json` has no `@supabase/*` dependency (structural, catches a dep before an import even exists).

### Anti-Patterns to Avoid
- **Banning `fetch` in the core-purity test** — false-positives the existing Node CLIs (`poll-latest.ts`, `fetch-corpus.ts`). See Pattern 4.
- **Putting `service_role` (or any password) behind a `VITE_` prefix** — that inlines it into the client bundle. The `VITE_` prefix is the exact mechanical secret line (D-10).
- **`npm install -g supabase`** — unsupported on Windows [CITED: supabase.com/docs/.../cli/getting-started]. Use `npm i -D supabase` + `npx supabase`, or Scoop.
- **Assuming `db push` needs Docker** — it does not against a *linked remote*. Only `supabase start` (local stack) needs Docker. See Environment Availability.
- **Forgetting `alter publication supabase_realtime add table`** — `postgres_changes` silently never fires (the single most-repeated blueprint warning).
- **`registerType: 'autoUpdate'`** (existing CLAUDE.md rule) is unrelated here but stays in force — not touched this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing / auth token issuance | A custom auth table + bcrypt | GoTrue (`supabase.auth`, admin API) | Auth is a solved, high-risk domain; the hosted GoTrue does it correctly. |
| Row-level access control | App-side `if (row.user_id === me)` checks | Postgres RLS policies (D-02) | Client-side checks are bypassable; RLS is enforced in the DB regardless of client. |
| Change subscriptions ("friend caught a song") | Polling the table on an interval | Realtime `postgres_changes` on the `supabase_realtime` publication | WAL-based push; no polling; free tier covers ~5 users. |
| Env loading for the Node seed | A `dotenv` dependency | `node --env-file=.env` (built-in ≥20.6) | Zero deps, matches D-06's dependency-free rule. |
| Schema deployment / drift tracking | Ad-hoc SQL pasted in the dashboard | `supabase migration new` + committed SQL + `db push` | Version-controlled, reviewable, re-runnable (D-04); the dashboard-paste path leaves no git trail. |

**Key insight:** Every "backend" concern in this phase is either a Supabase managed primitive (auth, RLS, realtime) or a built-in Node capability (`fetch`, `--env-file`). There is genuinely nothing to hand-roll — the phase is configuration + one small idempotent script + one guard test.

## Runtime State Inventory

> This phase is **greenfield backend provisioning**, not a rename/refactor. But it introduces durable external state, so the equivalent "what exists after the files land" audit is worthwhile.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The hosted Supabase project's `auth.users` (minted accounts) + `public.progress` rows live **outside git**, in the remote project only. | Provisioning is manual (D-05); accounts created by the seed script; document the project ref so it's recoverable. |
| Live service config | The `supabase_realtime` publication membership + RLS policies live in the remote DB. Committed in the migration, applied by `db push`. | None beyond running `db push` — the migration IS the source of truth. |
| OS-registered state | None — no Task Scheduler / pm2 / launchd involvement this phase. | None — verified: no scheduled jobs introduced (corpus refresh stays manual per existing etiquette). |
| Secrets/env vars | NEW: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` (PAT for `link`), per-slug `SEED_EMAIL_*` / `SEED_PASSWORD_*` (all secret). Currently `.gitignore` ignores **no** `.env` (the D-11 gap). | Add `.gitignore` pattern (below); commit `.env.example`; store real values in gitignored `.env`. |
| Build artifacts | `supabase/.temp/` (link state, project ref) and `supabase/.branches/` are generated by the CLI. | `supabase init` auto-writes `supabase/.gitignore` covering these — confirm it's committed, don't hand-edit. |

**Recoverability note:** because the project is created manually (D-05) and its state (accounts, rows) lives only in the hosted project, the provisioning doc must record the **project ref**, region, and which secrets map to which dashboard values — otherwise a lost `.env` means re-deriving everything from the dashboard.

## Common Pitfalls

### Pitfall 1: The realtime publication line is omitted
**What goes wrong:** Schema deploys, RLS works, but `postgres_changes` subscriptions (Phase 19/20) never fire.
**Why it happens:** `alter publication supabase_realtime add table public.progress` is easy to drop; nothing errors without it.
**How to avoid:** Include it in the migration (D-03). It's the single most-repeated blueprint warning.
**Warning signs:** A subscription's callback never runs even though rows change (only surfaces in Phase 19 — so verify the publication membership NOW: `select * from pg_publication_tables where pubname='supabase_realtime';`).

### Pitfall 2: Core-purity test bans `fetch` and reds the existing suite
**What goes wrong:** A literal reading of "network globals" adds `/\bfetch\b/` to the ban list; `poll-latest.ts` and `fetch-corpus.ts` immediately fail.
**Why it happens:** Core legitimately uses global `fetch` in its Node CLIs — "no network in core" was always about the *browser* Supabase client, not Node fetch.
**How to avoid:** Scope the ban to Supabase specifiers + browser-DOM/transport globals; exclude `fetch`. See Pattern 4.
**Warning signs:** `@guezzer/core` project turns red on files unrelated to Supabase.

### Pitfall 3: `db push` prompts for a password / fails non-interactively on Windows
**What goes wrong:** `npx supabase db push` blocks on an interactive DB-password prompt, or `link` fails without auth.
**Why it happens:** The CLI needs `SUPABASE_DB_PASSWORD` (for `db push`) and `SUPABASE_ACCESS_TOKEN` (a dashboard PAT, for `link`/remote auth) to run non-interactively. [CITED: supabase.com/docs/guides/deployment/managing-environments]
**How to avoid:** Export both before running (`SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`), and use `db push --linked`. Document these in `.env.example`.
**Warning signs:** A hang at "Enter your database password" or an auth error from `link`.

### Pitfall 4: `service_role` accidentally VITE_-prefixed or logged
**What goes wrong:** The service-role key (which **bypasses RLS entirely**) leaks into the client bundle or a committed file — total DB compromise.
**Why it happens:** Naming a var `VITE_SUPABASE_SERVICE_ROLE_KEY`, or committing `.env` (the current gap).
**How to avoid:** The `VITE_` prefix is the mechanical line (D-10). Close the `.gitignore` gap (D-11). The seed script reads `process.env` (Node), never `import.meta.env`, so the key is structurally invisible to the bundle.
**Warning signs:** Any `VITE_`-prefixed name containing "service", "password", or "secret"; a `.env` showing in `git status`.

### Pitfall 5: Vite doesn't see the `VITE_` vars (wrong env dir)
**What goes wrong:** `import.meta.env.VITE_SUPABASE_URL` is `undefined` in the app.
**Why it happens:** Vite loads `.env` files from its **project root** (`packages/app`, where `vite.config.ts` lives), not the repo root, unless `envDir` is set. [CITED: vite.dev/guide/env-and-mode]
**How to avoid:** Either put the `VITE_` pair in `packages/app/.env.local`, or set `envDir` to the repo root in `vite.config.ts` so one root `.env` serves both. Decide and document. (Ops secrets for the Node scripts are loaded separately via `node --env-file`, so they don't depend on this.)
**Warning signs:** Client can't reach Supabase; `import.meta.env.VITE_SUPABASE_URL` logs `undefined`.

## Code Examples

### `.gitignore` addition (D-11)
```gitignore
# Source: standard Vite/Node env hygiene [CITED: vite.dev/guide/env-and-mode + create-vite template]
# Existing: node_modules/  dist/  .claude/  *.tsbuildinfo
.env
.env.*
!.env.example
```
Patterns without a leading slash match at **any depth**, so this also covers `packages/app/.env.local`. Keep the `!.env.example` negation last so the committed template survives.

### `.env.example` (D-11) — valueless, documents every var
```dotenv
# Client (public — safe in the bundle, VITE_-prefixed per D-09)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Ops / server secrets (NEVER VITE_-prefixed, NEVER committed — D-10)
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=            # for `supabase db push` non-interactively
SUPABASE_ACCESS_TOKEN=          # dashboard PAT for `supabase link`
SUPABASE_URL=                   # non-VITE copy the Node seed script reads

# Per-friend account secrets, keyed by roster slug (D-08). Example slugs:
SEED_EMAIL_MATT=
SEED_PASSWORD_MATT=
SEED_EMAIL_PLACEHOLDER1=
SEED_PASSWORD_PLACEHOLDER1=
```

### Provisioning + deploy runbook (D-05) — the documented one-time steps
```bash
# 1. Manually create the project in the dashboard (free tier, region near the friends). D-05.
#    Capture from Settings → API: Project URL, anon key, service_role key.
#    Capture from Settings → Database: the DB password (or reset it).
#    Create a Personal Access Token (Account → Access Tokens) for the CLI.

# 2. Scaffold the CLI project dir (creates supabase/config.toml + supabase/.gitignore). D-13.
npx supabase init

# 3. Link the CLI to the remote project (needs SUPABASE_ACCESS_TOKEN + DB password).
export SUPABASE_ACCESS_TOKEN=...        # PAT
npx supabase link --project-ref <ref>

# 4. Author the migration, then push it to the linked remote. D-04.
npx supabase migration new progress_foundation   # creates supabase/migrations/<ts>_progress_foundation.sql
#   → paste the Pattern 1 SQL into that file
export SUPABASE_DB_PASSWORD=...
npx supabase db push --linked                     # no Docker needed for a linked remote

# 5. Seed accounts (dependency-free, idempotent). D-06. Run twice to prove idempotency.
node --env-file=.env supabase/seed/seed-users.ts
node --env-file=.env supabase/seed/seed-users.ts  # second run: all "• exists (unchanged)"
```
Suggested root npm scripts (D-13, names are Claude's discretion):
```jsonc
// package.json "scripts"
"db:push": "supabase db push --linked",
"seed:accounts": "node --env-file=.env supabase/seed/seed-users.ts"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm install -g supabase` | `npm i -D supabase` + `npx`, or Scoop | Long-standing on Windows | Global npm install is not a supported channel; use devDependency or Scoop. |
| `dotenv` package for scripts | `node --env-file=.env` | Node 20.6+ (stable in 24) | Zero-dependency env loading — matches D-06. |
| GoTrue duplicate → 400 "User already registered" | 422 `email_exists` | Newer GoTrue | Seed's dual check (422 OR regex) covers both — keep it. |
| Manual dashboard SQL paste | `supabase migration new` + `db push` | Current CLI norm | Version-controlled, reviewable schema (D-04). |

**Deprecated/outdated:**
- `vitest.workspace.ts` — already removed in this repo (uses `test.projects`); don't re-introduce.
- Do not follow tutorials that put the anon key in a non-`VITE_` var and proxy it — this app inlines the anon key by design (it's public).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Duplicate-email response is 422 with `email_exists` across the GoTrue version fronting this project | Pattern 2 / Pitfall (seed) | Low — the seed's dual check (status 422 **OR** body regex `/registered|already|exists/i`) already covers 400-with-message variants; idempotency holds regardless. Verify by running the seed twice (Success Criterion 1). |
| A2 | `supabase db push --linked` needs no Docker; only `supabase start` does | Environment Availability | Low-Med — if wrong, planner adds a Docker-availability step. Strongly supported by CLI docs (db push targets the *remote*). Confirm on first push. |
| A3 | `updated_at` client-set (not a trigger) is acceptable for the foundation | Alternatives / discretion | Low — D explicitly leaves this to discretion; a trigger can be added later without breaking the summary column. |
| A4 | Node type-stripping runs `supabase/seed/seed-users.ts` directly (erasable syntax) exactly as it runs `packages/app/scripts/fetch-covers.ts` | Pattern 2 | Low — same Node ≥24.12 mechanism, proven by the existing `fetch:covers` script; keep the seed erasable (no enum/namespace/param-props). |

## Open Questions (RESOLVED)

1. **Exact GoTrue duplicate status code for THIS project's version**
   - What we know: current GoTrue returns 422 `email_exists`; older returned 400 with a message.
   - What's unclear: the precise version fronting the (yet-to-be-created) project.
   - RESOLVED: irrelevant to correctness — keep the dual check; the twice-run test (SETUP-02 success criterion) empirically confirms idempotency. No pre-work needed.

2. **Where the `VITE_` env vars live (packages/app/.env vs root `.env` + `envDir`)**
   - What we know: Vite loads from its project root (`packages/app`) unless `envDir` is set.
   - What's unclear: owner preference for one root `.env` vs a client-only `packages/app/.env.local`.
   - RESOLVED: default to `packages/app/.env.local` for the `VITE_` pair and a root `.env` for ops secrets (loaded via `node --env-file`); the `.gitignore` pattern covers both. Planner picks; document in the runbook.

3. **`updated_at`: client-set vs `moddatetime` trigger** — discretion (D). RESOLVED: recommend client-set for the foundation; revisit in Phase 19 if the upsert path wants a DB guarantee.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥24.12 (type-stripping, `--env-file`) | Seed script (D-06), all CLIs | ✓ | **v24.15.0** [VERIFIED: `node --version`] | — |
| npm workspaces | Installing `@supabase/supabase-js` (app), `supabase` (root dev) | ✓ | repo uses npm (MEMORY: not pnpm) | — |
| Supabase CLI | `init`, `link`, `db push` (D-04/D-05) | ✗ (not installed; no `supabase/` dir yet) | target 2.109.1 | Install as root devDependency: `npm i -D supabase` |
| `@supabase/supabase-js` | App client (D-14) | ✗ (not in `packages/app` deps yet) | target 2.110.8 | `npm i -w @guezzer/app @supabase/supabase-js` |
| Docker | ONLY `supabase start` (local stack) — **not** `db push --linked` | n/a | — | **Not required this phase** — all DB work targets the linked remote (A2). |
| A hosted Supabase project | Everything (D-05) | ✗ (manual creation) | free tier | None — manual dashboard creation is a documented gate (D-05). |
| Personal Access Token + DB password | `supabase link` / `db push` non-interactively | ✗ (owner-provided) | — | Captured into gitignored `.env`; documented in `.env.example`. |

**Missing dependencies with no fallback:**
- The hosted Supabase project (D-05, manual) and its PAT/DB-password — owner must create/capture these before `link`/`push`/`seed` can run. This is the phase's one human gate.

**Missing dependencies with fallback:**
- Supabase CLI and `@supabase/supabase-js` — install via the commands above (no blocker).
- Docker — **not needed** for `db push --linked`; only for optional local dev.

## Validation Architecture

> `nyquist_validation` config key not found in `.planning/config.json` search scope — treated as **enabled** (absent = enabled). Confirm `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: root package.json] |
| Config file | `vitest.config.ts` (root; `test.projects` for core=node / app=jsdom) |
| Quick run command | `npx vitest run packages/core/test/purity.test.ts` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-04 | `packages/core` imports zero Supabase / browser DOM (excl. `fetch`) | unit (static scan) | `npx vitest run packages/core/test/purity.test.ts` | ❌ Wave 0 |
| SETUP-02 | Seed script parses roster + builds correct GoTrue request; treats 422 as skip | unit (mock `fetch`) | `npx vitest run <seed test>` (optional; the twice-run is the real proof) | ❌ Wave 0 (optional) |
| SETUP-02 | Idempotency (empirical) | manual/integration | `node --env-file=.env supabase/seed/seed-users.ts` run twice → all "exists" | manual — needs live project |
| SETUP-01 | Migration applies; table + RLS + publication exist | manual/integration | `npx supabase db push --linked`; then `select … from pg_publication_tables` | manual — needs live project |
| SETUP-03 | No secret in git; `.env` ignored; `.env.example` present | unit/CI check | `git check-ignore .env` returns 0; grep bundle for `service_role` finds nothing | ❌ Wave 0 (a small guard test is cheap) |

**Manual-only justification:** SETUP-01's `db push` and SETUP-02's twice-run idempotency require the live hosted project (D-05, manual). These are verified in the runbook, not in CI (no service_role in CI). The **automatable** guards are SETUP-04 (purity scan) and a SETUP-03 secret-hygiene assertion.

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/test/purity.test.ts` (fast, deterministic).
- **Per wave merge:** `npm test` (full suite — ensures the purity/hygiene tests plus the existing ~48 core suites stay green; confirms the `fetch` exception didn't red `poll-latest`/`fetch-corpus`).
- **Phase gate:** full suite green + the manual runbook (push applied, seed run twice, secrets absent from git) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/test/purity.test.ts` — SETUP-04 static scan (with the `fetch` exception).
- [ ] (optional) a small secret-hygiene guard — assert no `VITE_`-prefixed name contains `service|password|secret`, and `.env` is git-ignored — SETUP-03.
- [ ] (optional) `supabase/seed/seed-users.test.ts` — unit-test request-building + 422-skip with a mocked `fetch`.
- No framework install needed — Vitest 4 + the `@guezzer/core` node project already exist.

## Security Domain

> `security_enforcement` treated as enabled (absent = enabled). This phase is security-central — it defines the app's entire auth + access-control + secrets posture.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Secrets management | **yes** | `VITE_` boundary (D-09/D-10), `.gitignore` fix (D-11), `.env.example` template. `service_role`/passwords env-only. |
| V2 Authentication | **yes** | GoTrue email/password, `email_confirm:true`, distinct per-person passwords (D-06). No self-signup (owner-minted). |
| V3 Session Management | deferred | Phase 18 (offline session boot, `getSession`). Not this phase. |
| V4 Access Control | **yes** | Postgres RLS read-all/write-own (D-02) — enforced in the DB, not client. `service_role` bypasses RLS → must never ship. |
| V5 Input Validation | minor | Seed reads a committed roster + env; `user_metadata.display_name` is owner-controlled. No untrusted external input this phase. |
| V6 Cryptography | **yes (don't hand-roll)** | Password hashing + JWT issuance handled entirely by GoTrue. No custom crypto. |

### Known Threat Patterns for {Supabase + static PWA + Node ops scripts}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `service_role` key leaks into bundle or git (bypasses ALL RLS) | Information Disclosure / Elevation of Privilege | `VITE_` boundary (D-10); `.gitignore` `.env` (D-11); seed reads `process.env` only. **Highest-severity risk in the phase.** |
| RLS misconfigured → a friend edits another's row | Tampering / EoP | D-02 `with check (auth.uid() = user_id)` on insert AND update; no `anon` policy. Verify with a cross-user write attempt. |
| Realtime leaks rows past RLS | Information Disclosure | `postgres_changes` respects the `select` policy; D-02 grants read-all to `authenticated` intentionally (friends feed) — confirm `anon` is NOT granted. |
| Anon key mistaken for a secret and proxied | (design confusion) | Documented: anon key is a public JWT (`role: anon`), safe to inline (D-09). |
| Weak/shared account passwords | Broken Authentication | D-06 mandates distinct per-person passwords (spike used one shared throwaway — the real build must not). |
| DB password / PAT committed for CLI convenience | Information Disclosure | `SUPABASE_DB_PASSWORD` + `SUPABASE_ACCESS_TOKEN` in gitignored `.env`, shell-exported at run time; documented in `.env.example` with empty values. |

## Sources

### Primary (HIGH confidence)
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — VALIDATED blueprint (client, seed, schema, RLS, realtime gotcha, "what to avoid").
- `.claude/skills/spike-findings-guezzer/sources/002-supabase-multiuser/seed/schema.sql` — reference schema/RLS/publication (adapted to D-01).
- `.claude/skills/spike-findings-guezzer/sources/002-supabase-multiuser/seed/seed-users.mjs` — reference dependency-free seed (ported to Node-native TS).
- npm registry via `npm view` (2026-07-22) — `@supabase/supabase-js` 2.110.8, `supabase` CLI 2.109.1, repos + engines [VERIFIED].
- Repo files read directly — `vitest.config.ts`, `packages/core/tsconfig.json` (erasableSyntaxOnly, ES2023, no DOM), `packages/{core,app}/package.json`, `.gitignore`, `packages/app/scripts/fetch-covers.ts` (Node-native-TS precedent), `packages/app/src/config.ts` (single-config convention), `packages/core/src/live/poll-latest.ts` + `cli/fetch-corpus.ts` (core uses global `fetch`).

### Secondary (MEDIUM confidence)
- [supabase.com/docs/guides/local-development/cli/getting-started](https://supabase.com/docs/guides/local-development/cli/getting-started) — Windows CLI install (Scoop / npm devDependency; global npm not listed).
- [supabase.com/docs/guides/deployment/managing-environments](https://supabase.com/docs/guides/deployment/managing-environments) — `SUPABASE_DB_PASSWORD` / non-interactive CI.
- [supabase.com/docs/reference/cli/supabase-db-push](https://supabase.com/docs/reference/cli/supabase-db-push) — `db push`, `--linked`.
- [vite.dev/guide/env-and-mode](https://vite.dev/guide/env-and-mode) — `VITE_` prefix exposure + `envDir`.

### Tertiary (LOW confidence — flagged)
- [github.com/supabase/gotrue discussions #7632 / #513](https://github.com/orgs/supabase/discussions/7632) + [drdroid.io stack-diagnosis: supabase-auth-email-already-exists](https://drdroid.io/stack-diagnosis/supabase-auth-email-already-exists) — duplicate-email → 422 `email_exists` (A1; mitigated by the seed's dual check).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry today; blueprint validated across two devices.
- Architecture (schema/RLS/realtime/seed): HIGH — directly adapted from validated spike artifacts; SQL and endpoint proven live.
- Operational (Windows CLI, non-interactive `db push`, Docker-not-needed): MEDIUM-HIGH — cited from official docs; confirm on first run (A2).
- Core-purity `fetch` caveat: HIGH — grounded in the actual core source (poll-latest.ts / fetch-corpus.ts use global fetch).
- GoTrue duplicate status code: MEDIUM — exact code version-dependent, but idempotency is robust to it via the dual check (A1).

**Research date:** 2026-07-22
**Valid until:** 2026-08-21 (stable ecosystem; re-verify `@supabase/supabase-js` if a 3.x GA lands — a `3.0.0-next` prerelease already exists on the registry).
