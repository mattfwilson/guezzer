# Stack Research

**Domain:** Multi-user layer (auth + shared progress + presence) for an existing offline-first React/Vite PWA — v2.0 "Multi-User Foundation"
**Researched:** 2026-07-22
**Confidence:** HIGH

> Scope note: The existing v1 stack (Vite 8 + React 19 + TS 6 + npm workspaces with pure `packages/core`, Dexie 4 + `dexie-react-hooks`, vite-plugin-pwa/Workbox `registerType:'prompt'`, zod, Tailwind v4, Node ≥24) is **already shipped and validated — do NOT re-research it.** This file covers ONLY the additions/changes the spike-validated Supabase layer needs (see `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md`). The technical approach is already spike-proven across two devices (spikes 002–004); this document translates it into exact package/version/integration decisions for THIS repo.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` | **2.110.8** (v2 `latest`) | Auth (GoTrue), Postgres REST (PostgREST), and Realtime (presence/broadcast/`postgres_changes`) client — the whole multi-user backend in one client | The blueprint's validated client. One meta-package pulls `@supabase/auth-js`, `@supabase/postgrest-js`, `@supabase/realtime-js`, `@supabase/storage-js`, `@supabase/functions-js` (all pinned to 2.110.8), so auth + DB + Realtime need **exactly one dependency**. Framework-agnostic (no React peer dep), ships ESM — drops into Vite 8's esbuild pipeline with zero config. Blueprint floor was "v2.91+ current as of 2026-07"; `latest` is now 2.110.8 (published 2026-07-21). **Stay on the v2 line** — `3.0.0-next.29` exists only on the `next` pre-release tag and is not GA. Verify pin at install time with `npm view @supabase/supabase-js version`. |

That is the **only new runtime dependency.** Everything else the multi-user features need is already in the tree (Dexie for the offline write queue, zod for payload validation, React state for UI). See "What NOT to Use."

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Dexie | 4.4.4 (**already present**) | Offline write-queue / "outbox" table + per-user data namespacing | **Already installed.** Add an additive Dexie `version(N)` migration with an `outbox` table (or a `syncedProgress` mirror) — a hand-rolled queue that flushes to Supabase on reconnect. Do NOT add a new offline-sync library; the queue is ~40 lines against tables you already have. |
| zod | 4.4.3 (**already present, in `core`**) | Runtime validation of Realtime broadcast/presence payloads and `progress` rows | **Already installed.** Reuse the existing zod dependency to schema-validate untrusted Realtime payloads (waves, presence status, `postgres_changes` rows) at the app-layer boundary before they touch UI state — same discipline as the existing kglw.net ingestion schemas. Schemas for **network payloads** are app concerns and may live in the app layer, not necessarily `core`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `seed-users.mjs` (repo script, **zero deps**) | Idempotent bulk-create of the ~5 pre-made email/password accounts via the GoTrue admin API | Blueprint-provided (`sources/002-supabase-multiuser/seed/seed-users.mjs`). Pure Node ≥18 `fetch` — **not a package dependency.** `POST {URL}/auth/v1/admin/users` with `Authorization: Bearer {service_role}`, `email_confirm:true`, distinct per-person passwords. Reads `SERVICE_ROLE_KEY` + passwords from env; re-run-safe (422/"already registered" → skip). Repo already runs Node ≥24, so `fetch` is native. |
| `schema.sql` (paste into Supabase SQL editor) | Creates `progress` table, RLS policies, and `alter publication supabase_realtime add table public.progress` | Blueprint-provided (`sources/002-supabase-multiuser/seed/schema.sql`). No migration tooling required at this scale — pasting the SQL once is sufficient. |
| Supabase CLI (`supabase`) | *Optional* — generate TypeScript types from the DB schema (`supabase gen types typescript`) + manage migrations | **Optional, not required.** For ~2 tables, hand-writing the row types (or zod-inferring them) is faster than wiring the CLI. Adopt only if the schema grows. If used, keep it a devDependency / one-off `npx`, never a runtime import. |

## Installation

```bash
# Core — the ONE new runtime dependency, in the app workspace only (never core)
npm install @supabase/supabase-js@2.110.8 --workspace packages/app

# Supporting — nothing to install; Dexie 4.4.4 and zod 4.4.3 are already present.

# Dev dependencies — none required.
# (Optional, only if you later want generated DB types:)
#   npx supabase gen types typescript --project-id <ref> > packages/app/src/lib/supabase/db-types.ts
```

**Critical placement rule:** the dependency goes in `packages/app/package.json`, **NOT** `packages/core/package.json`. `core` must stay DOM-free/network-free — importing the Supabase client from `core` is an architecture violation (blueprint "What to Avoid" + PROJECT.md constraint). The client lives behind a thin app-layer module (e.g. `packages/app/src/lib/supabase/client.ts`).

## Integration Points (concrete — real files in THIS repo)

### 1. New app-layer client module (never in `core`)
Create `packages/app/src/lib/supabase/client.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

export const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,      // default — writes session to localStorage
      autoRefreshToken: true,    // default — refresh needs network (see offline note)
      storageKey: "gizz.auth",   // optional: explicit, app-namespaced key
    },
  },
);
```
`persistSession` + default `localStorage` storage is exactly what makes **offline boot** work: `sb.auth.getSession()` reads the token synchronously from `localStorage` with no network. This is a hard requirement (session survives dead-signal venue) and is unaffected by the service worker (localStorage is not HTTP-cached — see SW note below).

### 2. Vite env vars for URL + anon key
Vite exposes only `VITE_`-prefixed vars to client code via `import.meta.env.VITE_*`, inlined as string literals at build time. **No `vite.config.ts` change is needed** — `import.meta.env` works out of the box.
- Create `packages/app/.env.local` (developer machine) with:
  ```
  VITE_SUPABASE_URL=https://<ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon public key>
  ```
- **Add `.env.local` / `.env*.local` to `.gitignore`** — the root `.gitignore` currently has no env entry (verified: only `node_modules/ dist/ .claude/ *.tsbuildinfo`). This is a required one-line addition.

**Is shipping the anon key in a static bundle safe? YES.** The `anon` key is a public, publishable key by design — it only grants what Row-Level Security allows. Every table is `read-all / write-own` RLS (blueprint schema), so a leaked anon key lets an unauthenticated caller do *nothing* durable, and an authenticated friend can only write their own rows. The **`service_role` key is the secret** — it bypasses RLS and must live **only** in the seed script's env (`SERVICE_ROLE_KEY`), never in a `VITE_*` var, never inlined, never committed. (Naming a secret `VITE_SERVICE_ROLE_KEY` would leak it into the bundle — do not.)

### 3. Static-deploy secret handling
The frontend stays a pure static export. Because the anon key is public, injecting it is low-stakes, but keep it out of git:
- **Vercel / Netlify:** set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` as build-time environment variables in the dashboard; the build inlines them. This is the smoothest path.
- **GitHub Pages:** there is no host-side build, so provide the vars via a GitHub Actions build job (repo/environment **Secrets** → `env:` on the `vite build` step). Since the anon key is public anyway, a committed `.env.production` is also *acceptable* here as a fallback — but the Actions-secret path keeps the key out of git and matches the other hosts.

### 4. Service worker / Workbox interaction (integrate with existing `packages/app/vite.config.ts`)
The existing `VitePWA` config uses `registerType:'prompt'`, `clientsClaim:true`, and `globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webp}"]`. **No Workbox change is required, and that is the correct outcome** — here's why each Supabase channel is safe:
- **Precache:** `globPatterns` only matches **same-origin build output**. Supabase calls go cross-origin to `https://<ref>.supabase.co` — they can never enter the precache manifest. The Supabase client *code* rides the JS bundle (matched by `**/*.js`), so the app boots offline; the *network calls* it makes do not.
- **REST + auth (HTTPS fetch/XHR):** no `runtimeCaching` rule is configured for the Supabase origin, so these requests are **network-only pass-through** — exactly the required "network-first / never-precached" behavior. Auth token endpoints and `progress` upserts must always hit the live network; do NOT add a runtime-cache rule for `*.supabase.co`.
- **`navigateFallback`:** Workbox's SPA fallback (`index.html`) only intercepts **navigation requests** (`mode: 'navigate'`). supabase-js issues `fetch`/XHR data requests, which are *not* navigations, so the fallback never shadows them. No `navigateFallbackDenylist` entry is needed.
- **Realtime (`wss://`):** Service Workers **cannot intercept WebSocket connections** — the SW `fetch` event never fires for a WS handshake/frames. Workbox is therefore structurally incapable of caching or blocking Realtime. Presence/broadcast/`postgres_changes` are unaffected by the SW by construction. No config, no risk.
- **localStorage session:** the persisted auth token lives in `localStorage`, which the service worker / Workbox does not touch (that's HTTP-response caching, a different layer). Offline `getSession()` restore is inherently SW-safe.

**Net:** the only thing to double-check when the client lands is that no one accidentally adds a `runtimeCaching` entry for the Supabase origin. The default config already does the right thing.

### 5. Offline write queue (hand-rolled on existing Dexie — NO new library)
Durable writes (e.g. a friend's `songs_caught` count) must survive an offline show and flush on reconnect. Implement as an additive Dexie migration:
- Add `version(N)` with an `outbox` table (pending upserts) — or a `syncedProgress` mirror table + a `dirty` flag.
- App-layer sync module: on `online` / `onAuthStateChange('SIGNED_IN')` / Realtime reconnect, drain the outbox → `sb.from('progress').upsert(...)`.
- Reconcile inbound `postgres_changes` into the same Dexie mirror; `useLiveQuery` re-renders the friends view automatically (same reactive pattern already used for the dex/setlist).

This is ~40 lines against infrastructure you already own. A dedicated offline-sync engine (Replicache, PowerSync, WatermelonDB, RxDB) is heavyweight overkill for one small counters table and ~5 users — do not add one.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@supabase/supabase-js` 2.110.8 (v2) | `@supabase/supabase-js` 3.0.0-next (pre-release) | Never for this milestone — v3 is on the `next` tag, not GA. Revisit only after v3 ships `latest` and the spike patterns are re-verified against it. |
| Single meta-package `supabase-js` | Individual sub-packages (`@supabase/auth-js` + `postgrest-js` + `realtime-js` only) | Only if bundle size becomes a measured problem and you want to drop unused `storage-js`/`functions-js`. Not worth the import-surface complexity for a precached offline app at this scale; the meta-package is the documented path. |
| Hand-rolled Dexie outbox | RxDB / PowerSync / Replicache / WatermelonDB | Only if you later build **full collaborative live setlist co-tracking** (SOCL-V2-01, explicitly deferred). For one counters table + presence, they're multi-hundred-KB solutions to a non-problem. |
| Pre-made email/password auth | Magic-link / OTP / OAuth | Never here — magic-link needs a mail round-trip at a bad-signal venue (blueprint "What to Avoid"). Pre-made passwords are the validated choice. |
| React state + `useLiveQuery` for multi-user UI | zustand / Redux | Only if prop-drilling the auth/session/presence state becomes genuinely painful across many components. Start without it; add zustand *only* if measured. (Matches existing CLAUDE.md state-management stance.) |
| Supabase Realtime for presence/waves | A separate WebSocket/PubNub/Ably/socket.io service | Never — `realtime-js` is already bundled inside `supabase-js`. A second realtime stack is pure redundancy. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Importing the Supabase client from `packages/core` | Violates the pure/DOM-free core constraint (blueprint + PROJECT.md); `core` has no network/browser deps and its tsconfig forbids DOM | App-layer module only: `packages/app/src/lib/supabase/client.ts` |
| The vendored supabase-js UMD from the spike | That was a throwaway trick so a static demo page could boot offline; brittle and unversioned | The npm package `@supabase/supabase-js@2.110.8` via Vite's normal ESM import |
| `service_role` key anywhere client-side (incl. any `VITE_*` var) | It bypasses RLS — inlining it into the static bundle hands anyone full DB write access | Keep it env-only in the seed script (`SERVICE_ROLE_KEY`); ship only the public `anon` key as `VITE_SUPABASE_ANON_KEY` |
| A `runtimeCaching` rule for `*.supabase.co` | Auth/REST/Realtime must always be live; caching them serves stale sessions/data or breaks token refresh | Leave Supabase calls as network-only pass-through (the default — add nothing) |
| A separate offline-sync engine (RxDB, PowerSync, Replicache, WatermelonDB) | Heavyweight for one small counters table + ~5 users; adds a second persistence model beside Dexie | Hand-rolled Dexie `outbox` table drained on reconnect |
| A separate realtime lib (Ably, PubNub, socket.io) | `@supabase/realtime-js` is already bundled in supabase-js | Supabase `channel()` presence + broadcast + `postgres_changes` |
| Redux / heavy global state for auth/presence | Overkill; session comes from `getSession()` + `onAuthStateChange`, shared state from `useLiveQuery` | React state + `dexie-react-hooks`; add zustand only if prop-drilling hurts |
| Any server framework (Express/Next API routes/Fastify) | "No server we run" is preserved; Supabase is the only backend, hosted | Supabase hosted auth + Postgres + Realtime; static frontend unchanged |
| Persisting waves/presence to Postgres | They're ephemeral by design; DB rows are for durable progress only | Realtime broadcast + presence channel (no DB write) |
| Blocking app startup on a live auth check | Breaks the dead-signal venue boot | Synchronous `getSession()` first; reconcile via `onAuthStateChange` when online |

## Stack Patterns by Variant

**If deploying to Vercel/Netlify:**
- Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` as dashboard build-time env vars.
- Because host-side build injects them, no env file ships in git.

**If deploying to GitHub Pages:**
- Add a GitHub Actions build job; pass the two vars via repo/environment Secrets into the `vite build` step's `env:`.
- (Anon key is public, so a committed `.env.production` is an acceptable fallback — but Actions secrets keep git clean and match the other hosts.)

**If/when presence carries richer "what they're doing" status:**
- Reuse the *same* `gizz-room` channel — `ch.track({ name, view:"show", song: 7 })`. No new infrastructure; this is the intended path (blueprint §5).

**If the shared `progress` table ever grows beyond a handful of rows:**
- Switch the `postgres_changes` handler from full-table re-pull to patching the changed row from the payload (blueprint §4).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@supabase/supabase-js@2.110.8` | Vite 8.1.3 / React 19.2.7 / TS 6.0.3 | Framework-agnostic, **no React peer dependency**; ships ESM + CJS + own `.d.ts`. Bundles `auth-js`/`postgrest-js`/`realtime-js`/`storage-js`/`functions-js` all @2.110.8 (verified via `npm view ... dependencies`). No conflict with the existing tree. |
| `@supabase/supabase-js@2.110.8` | vite-plugin-pwa 1.3.0 / Workbox 7.4.x | Independent layers — Supabase is cross-origin runtime traffic; Workbox precaches same-origin build output. WebSockets are un-interceptable by SWs. No integration edits required. |
| seed-users.mjs | Node ≥18 (repo runs ≥24) | Pure native `fetch`, zero deps. |
| `@supabase/supabase-js@2.110.8` | esbuild (Vite transpile) | Transpiled by esbuild like all app code; the erasable-syntax constraint applies to `core`, not the app, so no concern. |

## Sources

- `npm view @supabase/supabase-js version` / `dist-tags` / `time` / `dependencies` (run 2026-07-22) — `latest` = **2.110.8**, published 2026-07-21; sub-packages all pinned 2.110.8; `3.0.0-next.29` is pre-release on the `next` tag only — **HIGH confidence** (registry-authoritative)
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — validated blueprint (spikes 002–004, two-device live validation): client-in-app-layer, anon-vs-service_role, offline `getSession()`, RLS, Realtime presence/broadcast, "what to avoid" — **HIGH confidence** (spike-proven)
- Repo inspection: `packages/app/package.json`, `packages/core/package.json`, `packages/app/vite.config.ts`, root `.gitignore`, root `package.json` (2026-07-22) — existing deps, PWA/Workbox config, absent `.env` gitignore entry — **HIGH confidence** (direct read)
- `.planning/PROJECT.md` — v2.0 milestone scope, revised constraints, core-purity + offline-first requirements — **HIGH confidence**
- Vite env-var behavior (`import.meta.env.VITE_*` build-time inlining) and Workbox navigation/precache/runtime-caching model — training knowledge cross-checked against the repo's existing PWA config and the blueprint — **MEDIUM-HIGH confidence** (well-established standard behavior)

---
*Stack research for: multi-user layer on an offline-first React/Vite PWA (v2.0 Supabase foundation)*
*Researched: 2026-07-22*
