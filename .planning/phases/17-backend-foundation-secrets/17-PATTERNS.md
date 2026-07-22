# Phase 17: Backend Foundation & Secrets - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 9 (7 new, 2 modified)
**Analogs found:** 7 / 9 (2 greenfield: SQL migration, `.env.example` — no in-repo precedent)

> Read-only mapping. All excerpts below are from real repo files with line numbers.
> The load-bearing how-to (schema SQL, seed body, client body, purity scan) already lives
> verbatim in `17-RESEARCH.md` Patterns 1–4 — this doc maps each new file to the closest
> *existing repo* analog for scaffolding/conventions, and defers the domain SQL/TS bodies to RESEARCH.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/<ts>_progress_foundation.sql` | migration | schema DDL (RLS + realtime pub) | — (no SQL in repo) | no analog → use RESEARCH Pattern 1 + spike `schema.sql` |
| `supabase/seed/seed-users.ts` | utility / ops script | request-response (HTTP → GoTrue admin) | `packages/app/scripts/fetch-covers.ts` | exact (Node-native-TS script idiom) |
| `supabase/seed/roster.ts` (or `.json`) | config / data | static data | `packages/app/scripts/fetch-covers.ts` (interface + const array) / `src/config.ts` (single-source export) | role-match |
| `packages/app/src/db/supabase.ts` | provider / client module | client init (singleton) | `packages/app/src/db/db.ts` + `src/config.ts` | role-match; body = RESEARCH Pattern 3 |
| `packages/core/test/purity.test.ts` | test (static scan) | file-I/O (fs read + assert) | `packages/core/test/config.test.ts`, `smoke.test.ts` | role-match; scan = RESEARCH Pattern 4 |
| `.env.example` | config (template) | — | — (no `.env*` in repo) | no analog → use RESEARCH code example |
| `.gitignore` | config | — | `.gitignore` (itself, current 4 lines) | modify-in-place |
| `package.json` (root) | config | — | root `package.json` scripts + `packages/relay/package.json` (`npx` CLI) | exact |
| `packages/app/package.json` | config | — | `packages/app/package.json` (itself, deps block) | exact |

---

## Pattern Assignments

### `supabase/seed/seed-users.ts` (ops script, request-response)

**Analog:** `packages/app/scripts/fetch-covers.ts` — the repo's proven Node-native-TS one-command script (`node scripts/fetch-covers.ts`, run via `"fetch:covers"` in `packages/app/package.json:10`). Copy its scaffolding; copy the seed *body* from `17-RESEARCH.md` Pattern 2. Key shared traits: erasable syntax (`interface`/`type` only — no `enum`/`namespace`), global `fetch`, an `isMain` guard, and a top-level `try/catch` → `process.exit(1)`.

**Import + node built-ins pattern** (`fetch-covers.ts:28-32`):
```typescript
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { config } from "@guezzer/core/config";
```
(The seed is dependency-free per D-06 — drop `sharp`/`@guezzer/core`; keep only the `node:` imports it needs, e.g. reading the roster.)

**Interface-only type declarations** (`fetch-covers.ts:53-60`, erasable-syntax convention):
```typescript
interface CoverManifestEntry {
  title: string;
  sourceUrl: string;
  mbid: string;
  fetchedAt: string;
}
type CoverManifest = Record<string, CoverManifestEntry>;
```
Mirror as `interface RosterEntry { slug: string; display_name: string }` (RESEARCH Pattern 2 line 245).

**`fetch` call idiom** (`fetch-covers.ts:118-127`) — the seed's GoTrue POST replaces this GET, but the shape (await `fetch`, check `res.ok`, branch on status, `await res.json()`) is identical:
```typescript
const res = await fetch(url, {
  headers: { "User-Agent": config.userAgent },
  signal: AbortSignal.timeout(config.fetchTimeoutMs),
});
if (!res.ok) {
  throw new Error(`MusicBrainz HTTP ${res.status} for "${title}" — hard failure ...`);
}
const body = (await res.json()) as MbSearchResponse;
```

**Idempotent skip-existing loop + result tally** (`fetch-covers.ts:202-210`) — the exact "already present → skip, not error" idiom the seed's 422-is-skip needs (RESEARCH Pattern 2, lines 271-278):
```typescript
for (const card of cards) {
  const slug = slugForAlbum(card.albumUrl);
  const webpPath = join(coversDir, `${slug}.webp`);
  if (!options.force && (await fileExists(webpPath))) {
    console.log(`  ⏭ ${slug}: cover exists — skipping (pass --force to refetch).`);
    result.skippedExisting += 1;
    continue;
  }
```

**`isMain` guard + top-level error handling** (`fetch-covers.ts:279-294`) — copy verbatim as the seed's entrypoint:
```typescript
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runFetchCovers(options);
    console.log(...);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
```

**Deviations from analog (per decisions):**
- Env is loaded by `node --env-file=.env` (RESEARCH), read via `process.env` — NEVER `import.meta.env` (that would bundle secrets). `fetch-covers.ts` reads no secrets, so this is net-new but structurally the seed just indexes `process.env[`SEED_EMAIL_${slug.toUpperCase()}`]`.
- Lives under root `supabase/seed/` (D-13), NOT `packages/app/scripts/` — so it does not import `@guezzer/core`. It is still run the same way (`node <path>.ts`).

---

### `supabase/seed/roster.ts` (config data, committed non-secret)

**Analog:** the interface + `const roster: RosterEntry[]` array shape (RESEARCH Pattern 2 lines 245-246). Repo precedent for a committed, git-diff-reviewable data export is `packages/app/scripts/fetch-covers.ts`'s typed const-array style and `src/config.ts`'s single-source object export (`src/config.ts:14` `export const config = { ... }`). Roster carries `display_name` + stable `slug` only — email/password come from env keyed by slug (D-08). Seed the file with the owner's real slug + a couple of placeholders (D-07).

---

### `packages/app/src/db/supabase.ts` (provider / client module)

**Analog:** `packages/app/src/db/db.ts` — the app's existing pattern for a module-level singleton backed by a data library, importing app config. Placement note: the repo uses **feature folders** (`src/db/`, `src/map/`, `src/live/`), so `src/db/supabase.ts` fits conventions better than the `src/lib/` the RESEARCH structure sketch suggested (RESEARCH itself hedges "or similar"). Planner's discretion; keep it the ONE place `createClient` is called (D-14).

**Module-singleton + config-import idiom** (`db/db.ts:9-13`):
```typescript
import Dexie, { type Table } from "dexie";
import type { BingoCard } from "@guezzer/core";
import { config } from "../config.ts";
import { classifyOutcome } from "../show/scoring.ts";
import { randomUUID } from "../uuid.ts";
```

**Client body** — copy verbatim from `17-RESEARCH.md` Pattern 3 (the single `createClient` reading `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). `import.meta.env` is already typed via `packages/app/src/vite-env.d.ts:1` (`/// <reference types="vite/client" />`), so `VITE_`-prefixed vars resolve with no extra typing work.

---

### `packages/core/test/purity.test.ts` (test, static scan)

**Analog:** `packages/core/test/config.test.ts` + `smoke.test.ts` for Vitest idioms; the scan body is `17-RESEARCH.md` Pattern 4. The test auto-collects: `vitest.config.ts:13-18` runs the `@guezzer/core` project under `environment: "node"` with `include: ["test/**/*.test.ts"]`, so a file at `packages/core/test/purity.test.ts` is picked up with **zero config change**.

**Vitest import + describe/it idiom** (`config.test.ts:1-13`):
```typescript
import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
// ...
describe("config.bingo", () => {
  const bingo = config.bingo;
  it("freeIndex is one of the four center cells {5,6,9,10}", () => {
    expect([5, 6, 9, 10]).toContain(bingo.freeIndex);
  });
```

**CRITICAL — do NOT ban `fetch`.** `Grep "fetch("` confirms four core files legitimately use global `fetch` in Node: `packages/core/src/live/poll-latest.ts` (line 35 `fetch: typeof globalThis.fetch;`, line 70 `await deps.fetch(...)`), `packages/core/src/cli/fetch-corpus.ts`, `packages/core/src/map/relay-client.ts`, `packages/core/src/dex/recent-shows.ts`. A `/\bfetch\b/` rule would immediately red the existing ~44-file core suite. Scope the ban to Supabase specifiers (`@supabase/`, `supabase-js`, `createClient`) + browser-only DOM/transport globals (`window.`, `document.`, `localStorage`, `navigator.`, `XMLHttpRequest`, `WebSocket`, `EventSource`) — exactly the FORBIDDEN list in RESEARCH Pattern 4. Optional hardening: also assert `packages/core/package.json` has no `@supabase/*` dep (it currently has only `fuse.js` + `zod`, per `packages/core/package.json:10-13`).

Note `packages/core/tsconfig.json:5` sets `"erasableSyntaxOnly": true` and `"lib": ["ES2023"]` (no DOM) — so core purity is already *structural*; this test just guards against regression (D-12).

---

## Shared Patterns

### Secret boundary (the phase's one mechanical line — D-09/D-10)
**Rule:** `VITE_`-prefixed → ships in the Vite bundle (anon key + URL, public by design). Everything else (`service_role`, DB password, PAT, `SEED_*` passwords) is `process.env`-only, never `VITE_`, never committed.
**Apply to:** `src/db/supabase.ts` (reads `import.meta.env.VITE_*` ONLY), `supabase/seed/seed-users.ts` (reads `process.env` ONLY), `.env.example`, `.gitignore`.

### `.gitignore` modification (D-11)
**Source (current full file — `.gitignore:1-4`):**
```gitignore
node_modules/
dist/
.claude/
*.tsbuildinfo
```
**Append** (RESEARCH code example) — the negation must stay last so the template survives:
```gitignore
.env
.env.*
!.env.example
```
No leading slash → matches at any depth (covers `packages/app/.env.local`). This closes the real gap: today no `.env` is ignored.

### `.env.example` (D-11) — no repo analog
**Source:** copy verbatim from `17-RESEARCH.md` Code Examples §`.env.example` — valueless, documents every var (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_URL`, per-slug `SEED_EMAIL_*` / `SEED_PASSWORD_*`).

### npm scripts + dependency additions (D-13/D-14)
**Root `package.json` scripts** — analog is the existing `node <path>.ts` CLI idiom (`package.json:10-12`):
```json
"refresh": "node packages/core/src/cli/refresh.ts",
"build:archive": "node packages/core/src/cli/build-archive.ts",
"build:albums": "node packages/core/src/cli/build-albums.ts"
```
Add: `"db:push": "supabase db push --linked"`, `"seed:accounts": "node --env-file=.env supabase/seed/seed-users.ts"` (names are discretion).

**Root `-D supabase` CLI dep** — precedent for a pinned CLI run via `npx` is `packages/relay/package.json:8-9` (`"dev": "npx wrangler@latest dev"`). RESEARCH pins `supabase@2.109.1` as a **root devDependency** (NOT `-g`, unsupported on Windows), invoked `npx supabase …`. Root devDeps live in `package.json:14-21` (currently test tooling only).

**App client dep** — add `@supabase/supabase-js@2.110.8` to `packages/app/package.json` `dependencies` (currently `packages/app/package.json:12-21`: core, dexie, react, force-graph, etc.). App-layer ONLY (D-14); NEVER added to `packages/core/package.json`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/migrations/<ts>_progress_foundation.sql` | migration | schema DDL | Repo has **zero** SQL files — no migration precedent exists. Use `17-RESEARCH.md` Pattern 1 (table + read-all/write-own RLS + `alter publication supabase_realtime add table public.progress`), adapted from the validated spike `schema.sql`. The `alter publication` line is REQUIRED (D-03) or `postgres_changes` silently never fires. |
| `.env.example` | config template | — | No `.env*` file has ever existed in the repo (`.gitignore` ignores none). Use RESEARCH's valueless template. |

---

## Metadata

**Analog search scope:** `packages/app/scripts/`, `packages/app/src/**` (config, db, live, map), `packages/core/{src,test}/**`, `packages/relay/`, repo root (`.gitignore`, `package.json`, `vitest.config.ts`), and a `supabase/**` glob (confirmed absent — greenfield).
**Files scanned:** ~15 read in full/part; `fetch(` grep across `packages/core/src` (4 hits confirming the `fetch` exception is load-bearing).
**Pattern extraction date:** 2026-07-22
